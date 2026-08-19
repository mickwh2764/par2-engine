/**
 * Ch.12 CGM Eigenvalue — Regression Guard
 * =========================================
 * Guards the AR(2) eigenvalue results for the 18 Colas et al. (2019)
 * normoglycemic participants (Chapter 12) against silent drift from edits
 * to `datasets/cgm_circadian_combined.csv` or the AR(2) fitting algorithm.
 *
 * Strategy
 * --------
 * 1. Read the live CSV and recompute per-subject modulus and CV% using the
 *    exact same algorithm as the canonical Python pipeline:
 *      manuscripts/scripts/colas2019_cgm_ar2_analysis.py
 *    (mean-centred OLS; sample SD for CV, i.e. n-1 denominator).
 * 2. Load the canonical archived results:
 *      manuscripts/colas2019_cgm_ar2_results.json
 * 3. Assert per-subject modulus and CV% match the archive within ±0.001
 *    to catch any change to the CSV or the fitting code.
 * 4. Assert the archive's summary statistics match Ch.12's stated values
 *    so stale numbers in the manuscript are also caught.
 *
 * Ch.12 canonical values (shared/book-extended-chapters.ts, ch12 block):
 *   n = 18 normoglycemic adults
 *   mean |λ| = 0.643  (range 0.21–0.87)
 *   mean intra-day CV% = 13.6%
 *   r(|λ|, CV%) = +0.26  (not significant, p = 0.30)
 *
 * Source:  datasets/cgm_circadian_combined.csv  (dataset == "Colas2019")
 * Archive: manuscripts/colas2019_cgm_ar2_results.json
 * Pipeline: manuscripts/scripts/colas2019_cgm_ar2_analysis.py
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// AR(2) OLS fit — exactly matches colas2019_cgm_ar2_analysis.py
// Mean-centred; returns modulus of the dominant eigenvalue.
// ---------------------------------------------------------------------------

function fitAR2Modulus(series: number[]): number | null {
  const n = series.length;
  if (n < 6) return null;

  const mean = series.reduce((a, b) => a + b, 0) / n;
  const s = series.map((x) => x - mean);

  const Y  = s.slice(2);
  const Y1 = s.slice(1, n - 1);
  const Y2 = s.slice(0, n - 2);
  const m  = Y.length;

  let s11 = 0, s22 = 0, s12 = 0, sy1 = 0, sy2 = 0;
  for (let i = 0; i < m; i++) {
    s11 += Y1[i] * Y1[i];
    s22 += Y2[i] * Y2[i];
    s12 += Y1[i] * Y2[i];
    sy1 += Y[i]  * Y1[i];
    sy2 += Y[i]  * Y2[i];
  }

  const denom = s11 * s22 - s12 * s12;
  if (Math.abs(denom) < 1e-12) return null;

  const phi1 = (sy1 * s22 - sy2 * s12) / denom;
  const phi2 = (sy2 * s11 - sy1 * s12) / denom;

  const disc = phi1 * phi1 + 4.0 * phi2;
  if (disc >= 0) {
    const r1 = (phi1 + Math.sqrt(disc)) / 2;
    const r2 = (phi1 - Math.sqrt(disc)) / 2;
    return Math.max(Math.abs(r1), Math.abs(r2));
  } else {
    const real = phi1 / 2;
    const imag = Math.sqrt(-disc) / 2;
    return Math.sqrt(real * real + imag * imag);
  }
}

/**
 * Sample CV% (n-1 denominator) — matches the Python pipeline's calculation:
 *   std = sqrt(sum((x - mean)^2) / (n - 1))
 *   cv  = 100 * std / mean
 */
function cvPercentSample(series: number[]): number {
  const n = series.length;
  const mean = series.reduce((a, b) => a + b, 0) / n;
  const variance = series.reduce((a, x) => a + (x - mean) ** 2, 0) / (n - 1);
  return (Math.sqrt(variance) / mean) * 100;
}

// ---------------------------------------------------------------------------
// Pearson r — matches the Python pipeline's pearson() function
// ---------------------------------------------------------------------------

function pearsonR(xs: number[], ys: number[]): number {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const sx = Math.sqrt(xs.reduce((a, x) => a + (x - mx) ** 2, 0));
  const sy = Math.sqrt(ys.reduce((a, y) => a + (y - my) ** 2, 0));
  if (sx === 0 || sy === 0) return 0;
  const cov = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0);
  return cov / (sx * sy);
}

// ---------------------------------------------------------------------------
// CSV parser: read hourly glucose profile rows for a given dataset label
// ---------------------------------------------------------------------------

interface SubjectProfile {
  subject: string;
  hourly: number[];  // H0..H23
}

function parseCGMRows(csvPath: string, datasetFilter: string): SubjectProfile[] {
  const lines = fs.readFileSync(csvPath, "utf-8").trim().split("\n");
  const header = lines[0].split(",");
  const rows: SubjectProfile[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    if (cols[1].trim() !== datasetFilter) continue;
    const hourly: number[] = [];
    for (let h = 0; h < 24; h++) {
      const idx = header.indexOf(`H${h}`);
      if (idx === -1) throw new Error(`Column H${h} not found in CSV header`);
      hourly.push(parseFloat(cols[idx]));
    }
    rows.push({ subject: cols[0].trim(), hourly });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Types for the archived JSON
// ---------------------------------------------------------------------------

interface ArchivedResult {
  subject:   string;
  modulus:   number;
  cvPercent: number;
  meanGlucose: number;
  phi1: number;
  phi2: number;
}

interface ArchivedJSON {
  metadata: { subjectCount: number };
  summary: {
    avgModulus:            number;
    avgCV_intraday:        number;
    r_modulus_cv_intraday: number;
    p_modulus_cv_intraday: number;
  };
  results: ArchivedResult[];
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const CSV_PATH     = path.resolve(__dirname, "../../datasets/cgm_circadian_combined.csv");
const ARCHIVE_PATH = path.resolve(__dirname, "../../manuscripts/colas2019_cgm_ar2_results.json");

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

// datasets/ is gitignored, so the CSV-backed assertions only run where it is present.
const HAS_CGM_CSV = fs.existsSync(CSV_PATH);

describe("Ch.12 CGM eigenvalue regression — Colas2019 normoglycemic cohort", () => {
  // Compute everything once and share across all assertions
  let csvRows: SubjectProfile[];
  let archive: ArchivedJSON;

  // Per-subject computation from the live CSV
  let computed: Array<{ subject: string; modulus: number; cv: number }>;

  archive = JSON.parse(fs.readFileSync(ARCHIVE_PATH, "utf-8")) as ArchivedJSON;

  try {
    csvRows  = parseCGMRows(CSV_PATH, "Colas2019");
    computed = csvRows.map((row) => ({
      subject: row.subject,
      modulus: fitAR2Modulus(row.hourly) ?? NaN,
      cv:      cvPercentSample(row.hourly),
    }));
  } catch (_err) {
    csvRows  = [];
    computed = [];
  }

  // ── Dataset integrity ─────────────────────────────────────────────────────

  it.skipIf(!HAS_CGM_CSV)("CSV is readable and contains exactly 18 Colas2019 rows", () => {
    expect(fs.existsSync(CSV_PATH), `CSV not found at ${CSV_PATH}`).toBe(true);
    expect(csvRows).toHaveLength(18);
  });

  it("archive JSON is readable and declares 18 subjects", () => {
    expect(fs.existsSync(ARCHIVE_PATH), `Archive not found at ${ARCHIVE_PATH}`).toBe(true);
    expect(archive.metadata.subjectCount).toBe(18);
    expect(archive.results).toHaveLength(18);
  });

  it.skipIf(!HAS_CGM_CSV)("every Colas2019 CSV row has 24 valid hourly glucose values in [40, 400] mg/dL", () => {
    for (const row of csvRows) {
      expect(row.hourly).toHaveLength(24);
      for (const v of row.hourly) {
        expect(isFinite(v), `${row.subject} contains non-finite value`).toBe(true);
        expect(v, `${row.subject}: ${v} outside physiological range`).toBeGreaterThan(40);
        expect(v, `${row.subject}: ${v} outside physiological range`).toBeLessThan(400);
      }
    }
  });

  it.skipIf(!HAS_CGM_CSV)("AR(2) fit converges for all 18 subjects", () => {
    for (const c of computed) {
      expect(isFinite(c.modulus), `${c.subject}: AR(2) fit did not converge`).toBe(true);
    }
  });

  // ── Per-subject agreement: live CSV vs. canonical archive ─────────────────
  //
  // Tolerance ±0.001 on modulus: tight enough to catch any meaningful shift
  // in the AR(2) algorithm or in a single data point, while allowing for
  // floating-point differences between JS and Python OLS implementations.

  it.skipIf(!HAS_CGM_CSV)("per-subject |λ| from live CSV matches archived values within ±0.001", () => {
    const archiveBySubject = new Map(archive.results.map((r) => [r.subject, r]));
    for (const c of computed) {
      const a = archiveBySubject.get(c.subject);
      expect(a, `Archive missing subject ${c.subject}`).toBeDefined();
      expect(c.modulus).toBeCloseTo(a!.modulus, 3);  // ±0.001
    }
  });

  it.skipIf(!HAS_CGM_CSV)("per-subject CV% from live CSV matches archived values within ±0.010", () => {
    const archiveBySubject = new Map(archive.results.map((r) => [r.subject, r]));
    for (const c of computed) {
      const a = archiveBySubject.get(c.subject);
      expect(a, `Archive missing subject ${c.subject}`).toBeDefined();
      expect(c.cv).toBeCloseTo(a!.cvPercent, 2);  // ±0.01%
    }
  });

  // ── Archive summary matches Ch.12 cited values ────────────────────────────
  //
  // Ch.12 (shared/book-extended-chapters.ts): "mean |λ| 0.643 (range 0.21–0.87)"
  // The archive holds the authoritative computed summary; the assertions below
  // lock both the archive and the chapter text together.

  it("archive mean |λ| ≈ 0.643 — Ch.12 stated mean", () => {
    expect(archive.summary.avgModulus).toBeGreaterThan(0.640);
    expect(archive.summary.avgModulus).toBeLessThan(0.646);
  });

  it("archive min |λ| ≈ 0.214 — Ch.12 lower bound", () => {
    const minMod = Math.min(...archive.results.map((r) => r.modulus));
    expect(minMod).toBeGreaterThan(0.210);
    expect(minMod).toBeLessThan(0.220);
  });

  it("archive max |λ| ≈ 0.874 — Ch.12 upper bound", () => {
    const maxMod = Math.max(...archive.results.map((r) => r.modulus));
    expect(maxMod).toBeGreaterThan(0.870);
    expect(maxMod).toBeLessThan(0.880);
  });

  it("archive mean intra-day CV% ≈ 13.6% — Ch.12 stated mean", () => {
    expect(archive.summary.avgCV_intraday).toBeGreaterThan(13.0);
    expect(archive.summary.avgCV_intraday).toBeLessThan(14.2);
  });

  // ── Correlation — disease-range-specificity finding ───────────────────────
  //
  // Ch.12: normoglycemic Colas cohort shows NO significant |λ|–CV% association
  // (r = +0.26, p = 0.30). This is the disease-range specificity check that
  // distinguishes the normoglycemic from the diabetic (Shanghai) finding.

  it("archive r(|λ|, CV%) ≈ +0.26 — normoglycemic, not significant", () => {
    expect(archive.summary.r_modulus_cv_intraday).toBeGreaterThan(0.20);
    expect(archive.summary.r_modulus_cv_intraday).toBeLessThan(0.32);
  });

  it("archive r(|λ|, CV%) is positive — no inverse correlation in normoglycemic range", () => {
    // The negative correlation seen in Shanghai T2DM (r = −0.68, p = 0.030) is
    // absent here. A positive r confirms disease-range specificity.
    expect(archive.summary.r_modulus_cv_intraday).toBeGreaterThan(0);
  });

  it("archive p(|λ|, CV%) > 0.05 — correlation not significant", () => {
    expect(archive.summary.p_modulus_cv_intraday).toBeGreaterThan(0.05);
  });

  // ── Recomputed summary agrees with archive ────────────────────────────────
  //
  // If someone re-runs the Python pipeline and regenerates the JSON, the
  // recomputed values should still agree with the archive's summary to confirm
  // the pipeline itself hasn't shifted.

  it.skipIf(!HAS_CGM_CSV)("recomputed mean |λ| from CSV agrees with archive mean within ±0.002", () => {
    const meanMod = computed.reduce((a, c) => a + c.modulus, 0) / computed.length;
    expect(meanMod).toBeCloseTo(archive.summary.avgModulus, 3);
  });

  it.skipIf(!HAS_CGM_CSV)("recomputed r(|λ|, CV%) from CSV agrees with archive r within ±0.01", () => {
    const mods = computed.map((c) => c.modulus);
    const cvs  = computed.map((c) => c.cv);
    const r = pearsonR(mods, cvs);
    expect(r).toBeCloseTo(archive.summary.r_modulus_cv_intraday, 2);
  });
});

// =============================================================================
// Ch.12 CGM eigenvalue regression — Shanghai T2DM cohort
// =============================================================================
//
// Guards the Shanghai T2DM eigenvalue results (Zhao et al. 2023; n = 10)
// cited in the book preface and Part II intro against silent drift.
//
// Canonical values (shared/book-extended-chapters.ts, Part II intro):
//   n = 10 diabetic participants
//   mean |λ| ≈ 0.740
//   r(|λ|, mean glucose) ≈ −0.61  (p = 0.061)
//   r(|λ|, CV%)          ≈ −0.68  (p = 0.030)
//
// Archive: manuscripts/shanghai_t2dm_fibonacci.json
//
// PROVENANCE NOTE — both r(|λ|, mean glucose) and r(|λ|, CV%) are provenance-
// locked archived scalars.  Both were computed by the original Python pipeline
// from raw 5-minute multi-day CGM recordings (Zhao et al. 2023).  They cannot
// be re-derived from the per-subject summary rows in this JSON because those
// rows store per-window means aggregated over days, while the original pipeline
// used multi-day clinical aggregates (mean/CV across every raw 5-min reading).
//
// Computing Pearson r from the stored rows gives r ≈ −0.447 for mean glucose
// and a different value for CV% — the negative direction is preserved but the
// magnitude diverges due to the aggregation difference.  The archived −0.61 and
// −0.68 are authoritative; the regression tests below lock them as such.
//
// Full provenance (pipeline steps, raw data source, aggregation method):
//   manuscripts/scripts/shanghai_t2dm_cgm_pipeline_provenance.md
// Correlation diagnostic (rows vs. archived):
//   python3 manuscripts/scripts/cgm_shanghai_ar2_analysis.py --check-correlations
// =============================================================================

interface ShanghaiResult {
  subject:           string;
  meanGlucose:       number;
  cvGlucose:         number;
  modulus:           number;
  isStable:          boolean;
  fibonacciProximity: number;
}

interface ShanghaiJSON {
  metadata: { subjectCount: number };
  summary: {
    avgModulus:              number;
    avgCV:                   number;
    r_modulus_mean_glucose:  number;
    p_modulus_mean_glucose:  number;
    r_modulus_cv:            number;
    p_modulus_cv:            number;
  };
  results: ShanghaiResult[];
}

const SHANGHAI_ARCHIVE_PATH = path.resolve(
  __dirname,
  "../../manuscripts/shanghai_t2dm_fibonacci.json"
);

describe("Ch.12 CGM eigenvalue regression — Shanghai T2DM cohort", () => {
  let shanghai: ShanghaiJSON;

  try {
    shanghai = JSON.parse(
      fs.readFileSync(SHANGHAI_ARCHIVE_PATH, "utf-8")
    ) as ShanghaiJSON;
  } catch (_err) {
    shanghai = {
      metadata: { subjectCount: 0 },
      summary: {
        avgModulus: NaN, avgCV: NaN,
        r_modulus_mean_glucose: NaN, p_modulus_mean_glucose: NaN,
        r_modulus_cv: NaN, p_modulus_cv: NaN,
      },
      results: [],
    };
  }

  // ── Dataset integrity ────────────────────────────────────────────────────

  it("Shanghai archive JSON is readable and declares 10 subjects", () => {
    expect(
      fs.existsSync(SHANGHAI_ARCHIVE_PATH),
      `Archive not found at ${SHANGHAI_ARCHIVE_PATH}`
    ).toBe(true);
    expect(shanghai.metadata.subjectCount).toBe(10);
  });

  it("Shanghai archive contains exactly 10 result rows", () => {
    expect(shanghai.results).toHaveLength(10);
  });

  it("all 10 Shanghai subjects are flagged stable (|λ| < 1)", () => {
    for (const r of shanghai.results) {
      expect(r.isStable, `${r.subject} expected stable`).toBe(true);
      expect(r.modulus, `${r.subject} modulus must be < 1`).toBeLessThan(1);
    }
  });

  // ── Mean |λ| — archived summary value ──────────────────────────────────
  //
  // The book does not cite an explicit mean |λ| for the Shanghai cohort, but
  // the archive summary records 0.740. Locked to manuscript reporting precision
  // (±0.001) to catch any regeneration that shifts the centre.

  it("archive avgModulus = 0.740 at manuscript reporting precision", () => {
    expect(shanghai.summary.avgModulus).toBeCloseTo(0.7399, 3);
  });

  // ── r(|λ|, mean glucose) = −0.61 — authoritative archived scalar ─────────
  //
  // Both this correlation and r(|λ|, CV%) were computed by the original Python
  // pipeline on raw 5-minute multi-day CGM recordings (Zhao et al. 2023).
  // Neither can be reconstructed from the per-subject summary rows in this JSON:
  // the per-subject meanGlucose and cvGlucose are stored summaries, not the
  // multi-day clinical aggregates used in the original analysis (Pearson r from
  // the rows computes to ≈ −0.447, not −0.61). Both are stored in the archive
  // as locked authoritative scalars identical to the pattern used for
  // r_modulus_cv / p_modulus_cv.
  //
  // Book Part II intro cites: r(|λ|, mean glucose) = −0.61 (p = 0.061)
  //                           r(|λ|, CV%)          = −0.68 (p = 0.030)

  it("archive r(|λ|, mean glucose) = −0.61 at manuscript reporting precision", () => {
    expect(shanghai.summary.r_modulus_mean_glucose).toBeCloseTo(-0.61, 2);
  });

  it("archive r(|λ|, mean glucose) is negative — higher mean glucose → lower eigenvalue", () => {
    expect(shanghai.summary.r_modulus_mean_glucose).toBeLessThan(0);
  });

  it("archive p(|λ|, mean glucose) = 0.061 at manuscript reporting precision", () => {
    expect(shanghai.summary.p_modulus_mean_glucose).toBeCloseTo(0.061, 3);
  });

  // ── r(|λ|, CV%) = −0.68 — authoritative archived scalar ─────────────────

  it("archive r(|λ|, CV%) = −0.68 at manuscript reporting precision", () => {
    expect(shanghai.summary.r_modulus_cv).toBeCloseTo(-0.68, 2);
  });

  it("archive r(|λ|, CV%) is negative — higher variability → lower eigenvalue", () => {
    expect(shanghai.summary.r_modulus_cv).toBeLessThan(0);
  });

  // ── p(|λ|, CV%) = 0.030 — cited as statistically significant ────────────
  //
  // The book cites p = 0.030. Locked at manuscript precision; also verified
  // against the α = 0.05 significance threshold stated in the text.

  it("archive p(|λ|, CV%) = 0.030 at manuscript reporting precision", () => {
    expect(shanghai.summary.p_modulus_cv).toBeCloseTo(0.030, 3);
  });

  it("archive p(|λ|, CV%) < 0.05 — significant inverse correlation", () => {
    expect(shanghai.summary.p_modulus_cv).toBeLessThan(0.05);
  });

  // ── Contrast with normoglycemic Colas cohort ────────────────────────────
  //
  // The disease-range specificity argument requires that the Shanghai cohort
  // shows a clearly negative r(|λ|, CV%) while the normoglycemic Colas cohort
  // does not. This test documents that contrast at the archive level.

  it("Shanghai r(|λ|, CV%) is substantially more negative than Colas2019 r = +0.26", () => {
    // Colas2019 normoglycemic: r ≈ +0.26 (not significant)
    // Shanghai T2DM:           r ≈ −0.68 (p = 0.030)
    // The difference must exceed 0.5 to confirm disease-range specificity.
    const colasCvR = 0.26; // archived from colas2019_cgm_ar2_results.json
    expect(colasCvR - shanghai.summary.r_modulus_cv).toBeGreaterThan(0.5);
  });
});

// =============================================================================
// Ch.12 Shanghai T2DM — pipeline infrastructure and provenance verification
// =============================================================================
//
// PATH TAKEN: provenance-locked (path 2 of the task description) — the raw
// ShanghaiT2DM data are not distributed in this repository.  r = −0.61 and
// r = −0.68 are archived as authoritative scalars.
//
// A complete, runnable reproducibility pipeline exists at:
//   manuscripts/scripts/shanghai_t2dm_cgm_r_pipeline.py
//
// It implements the analysis from paper_k_t2dm_glucose.md §2.1–2.4:
//   - Clinical mean/CV from ALL raw 5-min readings (not mean-of-daily-means)
//   - AR(2) fitted per 24-hour window independently; |λ| = mean daily |λ|
//   - Pearson r over 10 subjects
//
// The tests below verify the pipeline infrastructure works without raw data.
// When raw data is available, set SHANGHAI_T2DM_DATA_DIR + SHANGHAI_T2DM_FILE_MAP
// to run the full recompute-and-compare (the final test below).
//
// Full provenance: manuscripts/scripts/shanghai_t2dm_cgm_pipeline_provenance.md
// =============================================================================

import { execFileSync } from "child_process";

const PIPELINE_SCRIPT = path.resolve(
  __dirname,
  "../../manuscripts/scripts/shanghai_t2dm_cgm_r_pipeline.py"
);
const PROVENANCE_DOC = path.resolve(
  __dirname,
  "../../manuscripts/scripts/shanghai_t2dm_cgm_pipeline_provenance.md"
);

describe("Ch.12 Shanghai T2DM — reproducibility pipeline infrastructure", () => {
  it("reproducibility pipeline script exists", () => {
    expect(fs.existsSync(PIPELINE_SCRIPT), `Pipeline not found at ${PIPELINE_SCRIPT}`).toBe(true);
  });

  it("provenance document exists", () => {
    expect(fs.existsSync(PROVENANCE_DOC), `Provenance doc not found at ${PROVENANCE_DOC}`).toBe(true);
  });

  it("pipeline --describe runs cleanly and lists all 10 archived subjects", () => {
    // --describe requires no raw data; verifies the pipeline is executable and
    // reads the archived JSON correctly.
    let stdout = "";
    try {
      stdout = execFileSync(
        "python3",
        [PIPELINE_SCRIPT, "--describe"],
        { encoding: "utf-8", timeout: 15_000 }
      );
    } catch (err: unknown) {
      const e = err as { stdout?: string; stderr?: string; message?: string };
      throw new Error(
        `Pipeline --describe failed: ${[e.stdout, e.stderr, e.message].filter(Boolean).join("\n")}`
      );
    }

    // All 10 subject IDs must appear in the output
    const subjects = [
      "Shanghai_2000_0", "Shanghai_2001_0", "Shanghai_2001_1",
      "Shanghai_2002_0", "Shanghai_2003_0", "Shanghai_2004_0",
      "Shanghai_2005_0", "Shanghai_2006_0", "Shanghai_2007_0",
      "Shanghai_2008_0",
    ];
    for (const sid of subjects) {
      expect(stdout, `${sid} missing from --describe output`).toContain(sid);
    }

    // Archived correlation values must appear in the output
    expect(stdout).toContain("-0.61");
    expect(stdout).toContain("-0.68");
  });

  it("pipeline --describe documents the clinical aggregate definition (all raw readings, not mean-of-daily-means)", () => {
    // This is the key aggregation difference that explains why r from stored
    // JSON rows ≈ −0.447, not −0.61.  The description must document it.
    let stdout = "";
    try {
      stdout = execFileSync(
        "python3",
        [PIPELINE_SCRIPT, "--describe"],
        { encoding: "utf-8", timeout: 15_000 }
      );
    } catch (_err) {
      stdout = "";
    }
    expect(stdout.toLowerCase()).toMatch(/all.*raw|every.*raw|raw.*reading/i);
  });

  // ── Full recompute-and-compare (requires raw data) ─────────────────────────
  //
  // Set SHANGHAI_T2DM_DATA_DIR + SHANGHAI_T2DM_FILE_MAP to run this test.
  // It executes the pipeline with --verify-archive and asserts the computed
  // r values match the archived values within ±0.05.

  const SHANGHAI_DATA_DIR = process.env["SHANGHAI_T2DM_DATA_DIR"];

  (SHANGHAI_DATA_DIR ? it : it.skip)(
    "full pipeline recompute-and-compare: r(|λ|, mean glucose) ≈ −0.61 (requires SHANGHAI_T2DM_DATA_DIR + SHANGHAI_T2DM_FILE_MAP)",
    () => {
      const fileMap = process.env["SHANGHAI_T2DM_FILE_MAP"];
      if (!fileMap) {
        throw new Error(
          "SHANGHAI_T2DM_FILE_MAP must be set alongside SHANGHAI_T2DM_DATA_DIR.\n" +
          'Example: SHANGHAI_T2DM_FILE_MAP=\'{"Shanghai_2000_0":"p2000v0.csv",...}\'\n' +
          "Consult the ShanghaiT2DM dataset README for exact filenames."
        );
      }
      let stdout = "";
      try {
        stdout = execFileSync(
          "python3",
          [PIPELINE_SCRIPT,
           "--data-dir", SHANGHAI_DATA_DIR!,
           "--file-map", fileMap,
           "--verify-archive"],
          { encoding: "utf-8", timeout: 120_000 }
        );
      } catch (err: unknown) {
        const e = err as { stdout?: string; stderr?: string; message?: string };
        throw new Error(
          `Pipeline failed:\n${[e.stdout, e.stderr, e.message].filter(Boolean).join("\n")}`
        );
      }
      // Parse computed r from output
      const rMeanMatch = stdout.match(/r\(\|λ\|, mean glucose\)\s*:\s*([+-]?\d+\.\d+)/);
      const rCvMatch   = stdout.match(/r\(\|λ\|, CV%\)\s*:\s*([+-]?\d+\.\d+)/);
      expect(rMeanMatch, "Could not parse r(|λ|, mean glucose) from output").toBeTruthy();
      expect(rCvMatch,   "Could not parse r(|λ|, CV%) from output").toBeTruthy();
      const computedRMean = parseFloat(rMeanMatch![1]);
      const computedRCv   = parseFloat(rCvMatch![1]);
      expect(computedRMean).toBeCloseTo(-0.61, 1);  // ±0.05
      expect(computedRCv).toBeCloseTo(-0.68, 1);
      expect(computedRMean).toBeLessThan(0);
      expect(computedRCv).toBeLessThan(0);
      expect(stdout).toContain("PASS");
    }
  );
});

// =============================================================================
// Ch.12 Shanghai T2DM — book text ↔ JSON archive cross-check
// =============================================================================
//
// Guards against the JSON archive being regenerated with new pipeline output
// while the book text in shared/book-extended-chapters.ts still cites the old
// values (or vice versa).
//
// Each assertion is scoped to the specific metric-labelled correlation clause
// within the Part II intro Chapter 12 paragraph, not the file as a whole.
// This prevents two failure modes that a file-wide search would miss:
//
//   1. STALE INTRO — the intro still says −0.61/−0.68 but the JSON was updated.
//      (Same values appear in the Ch.12 body at ~line 1161; a file-wide check
//      would pass because the body was updated even though the intro was not.)
//
//   2. SWAPPED PAIR — the archive r values are swapped (glucose ↔ CV); a
//      paragraph-wide check would pass because both numbers are present, just
//      attributed to the wrong metrics.
//
// Relevant files:
//   manuscripts/shanghai_t2dm_fibonacci.json  (authoritative archive)
//   shared/book-extended-chapters.ts          (Part II intro, "Chapter 12" paragraph)
// =============================================================================

const BOOK_PATH = path.resolve(__dirname, "../../shared/book-extended-chapters.ts");

// ---------------------------------------------------------------------------
// Helpers for the book-text ↔ archive cross-check
// ---------------------------------------------------------------------------

/**
 * Extract the single paragraph from `text` that contains `anchor`.
 * Paragraphs are separated by one or more blank lines.
 * Throws a descriptive error if no paragraph matches.
 */
function extractParagraphByAnchor(
  text: string,
  anchor: string,
  label: string
): string {
  const paragraphs = text.split(/\n\n+/);
  const match = paragraphs.find((p) => p.includes(anchor));
  if (!match) {
    throw new Error(
      `Could not locate the ${label} in shared/book-extended-chapters.ts. ` +
      `Searched for anchor: ${JSON.stringify(anchor)}. ` +
      `If the Part II intro paragraph was restructured, update the anchor in the test.`
    );
  }
  return match;
}

/**
 * Extract the metric-specific correlation clause from `paragraph`.
 *
 * Searches for `metricLabel` within the paragraph, then returns the
 * substring from that label up to and including the next closing
 * parenthesis — i.e. the fragment that should contain the r/p pair
 * attributed to that metric.
 *
 * Example:
 *   paragraph = "... mean glucose (r = −0.61, p = 0.061) and glycaemic variability (r = −0.68, p = 0.030)."
 *   extractMetricClause(paragraph, "mean glucose")
 *   → "mean glucose (r = −0.61, p = 0.061)"
 *
 * Returns null when `metricLabel` is not found, which is itself caught as a
 * test failure so a reorganised sentence is never silently ignored.
 */
function extractMetricClause(
  paragraph: string,
  metricLabel: string
): string | null {
  const idx = paragraph.indexOf(metricLabel);
  if (idx === -1) return null;
  const fragment = paragraph.slice(idx);
  const parenClose = fragment.indexOf(")");
  return parenClose === -1 ? fragment : fragment.slice(0, parenClose + 1);
}

/**
 * True if `clause` contains `r` formatted to 2 decimal places with the
 * correct sign.  Accepts both ASCII hyphen-minus ("-") and Unicode minus
 * sign ("−", U+2212) for negative values; bare decimal for non-negative.
 */
function clauseContainsR(clause: string, r: number): boolean {
  const absStr = Math.abs(r).toFixed(2);
  if (r < 0) {
    return clause.includes(`-${absStr}`) || clause.includes(`\u2212${absStr}`);
  }
  return clause.includes(absStr) || clause.includes(`+${absStr}`);
}

describe("Ch.12 Shanghai T2DM — book text ↔ JSON archive cross-check", () => {
  // NOTE: setup runs at describe-evaluation time (outside beforeAll) to keep
  // the same pattern used throughout this file.

  let bookText: string;
  let shanghaiForCrossCheck: ShanghaiJSON;

  try {
    bookText = fs.readFileSync(BOOK_PATH, "utf-8");
  } catch (_err) {
    bookText = "";
  }

  try {
    shanghaiForCrossCheck = JSON.parse(
      fs.readFileSync(SHANGHAI_ARCHIVE_PATH, "utf-8")
    ) as ShanghaiJSON;
  } catch (_err) {
    shanghaiForCrossCheck = {
      metadata: { subjectCount: 0 },
      summary: {
        avgModulus: NaN, avgCV: NaN,
        r_modulus_mean_glucose: NaN, p_modulus_mean_glucose: NaN,
        r_modulus_cv: NaN, p_modulus_cv: NaN,
      },
      results: [],
    };
  }

  // Paragraph anchor — unique to the Part II intro Chapter 12 summary sentence.
  // Update if the wording changes.
  const PART_II_CH12_ANCHOR =
    "**Chapter 12** applies eigenvalue analysis to two independent CGM datasets";

  // Metric labels used to locate each correlation clause within the paragraph.
  // These match the exact wording of the Part II intro sentence:
  //   "... mean glucose (r = −0.61, p = 0.061) and glycaemic variability (r = −0.68, p = 0.030)."
  const GLUCOSE_LABEL     = "mean glucose";
  const VARIABILITY_LABEL = "glycaemic variability";

  // ── Sanity: book file is readable ─────────────────────────────────────────

  it("book-extended-chapters.ts is readable and non-empty", () => {
    expect(fs.existsSync(BOOK_PATH), `Book file not found at ${BOOK_PATH}`).toBe(true);
    expect(bookText.length, "Book file is empty").toBeGreaterThan(0);
  });

  // ── Sanity: Part II intro Ch.12 paragraph is locatable ───────────────────

  it("Part II intro contains the Chapter 12 summary paragraph (anchor check)", () => {
    const found = bookText.split(/\n\n+/).some((p) => p.includes(PART_II_CH12_ANCHOR));
    expect(
      found,
      `Part II intro Chapter 12 summary paragraph not found in shared/book-extended-chapters.ts. ` +
      `Anchor: ${JSON.stringify(PART_II_CH12_ANCHOR)}. ` +
      `Update PART_II_CH12_ANCHOR in the test if the paragraph wording changed.`
    ).toBe(true);
  });

  // ── r(|λ|, mean glucose) = −0.61 — metric-specific clause check ──────────
  //
  // Extracts the "mean glucose (...)" clause from the Part II intro paragraph
  // and asserts the archived r value appears within that clause.
  // This catches both a stale value AND a value-swap (r_mean_glucose ↔ r_cv).

  it("Part II intro 'mean glucose' clause cites r matching JSON archive r_modulus_mean_glucose (−0.61)", () => {
    const r = shanghaiForCrossCheck.summary.r_modulus_mean_glucose;
    expect(isFinite(r), "JSON r_modulus_mean_glucose is not a finite number").toBe(true);

    const para = extractParagraphByAnchor(bookText, PART_II_CH12_ANCHOR, "Part II intro Chapter 12 paragraph");
    const clause = extractMetricClause(para, GLUCOSE_LABEL);
    expect(
      clause,
      `"${GLUCOSE_LABEL}" not found in the Part II intro Chapter 12 paragraph. ` +
      `If the sentence was rephrased, update GLUCOSE_LABEL in the test.`
    ).not.toBeNull();

    expect(
      clauseContainsR(clause!, r),
      `"${GLUCOSE_LABEL}" clause does not cite r = ${r.toFixed(2)}. ` +
      `Clause text: ${JSON.stringify(clause)}. ` +
      `JSON archive has r_modulus_mean_glucose = ${r}. ` +
      `Update shared/book-extended-chapters.ts to match the archive (or vice versa).`
    ).toBe(true);
  });

  // ── p(|λ|, mean glucose) = 0.061 — within the mean-glucose clause ─────────

  it("Part II intro 'mean glucose' clause cites p matching JSON archive p_modulus_mean_glucose (0.061)", () => {
    const p = shanghaiForCrossCheck.summary.p_modulus_mean_glucose;
    expect(isFinite(p), "JSON p_modulus_mean_glucose is not a finite number").toBe(true);
    const pStr = p.toFixed(3);

    const para = extractParagraphByAnchor(bookText, PART_II_CH12_ANCHOR, "Part II intro Chapter 12 paragraph");
    const clause = extractMetricClause(para, GLUCOSE_LABEL);
    expect(clause, `"${GLUCOSE_LABEL}" not found in Part II intro paragraph`).not.toBeNull();

    expect(
      clause!.includes(pStr),
      `"${GLUCOSE_LABEL}" clause does not cite p = ${pStr}. ` +
      `Clause text: ${JSON.stringify(clause)}. ` +
      `JSON archive has p_modulus_mean_glucose = ${p}. ` +
      `Update shared/book-extended-chapters.ts to match the archive (or vice versa).`
    ).toBe(true);
  });

  // ── r(|λ|, CV%) = −0.68 — metric-specific clause check ───────────────────
  //
  // Checks the "glycaemic variability (...)" clause specifically, so a
  // value-swap (where −0.68 appears in the glucose clause rather than the
  // variability clause) is caught.

  it("Part II intro 'glycaemic variability' clause cites r matching JSON archive r_modulus_cv (−0.68)", () => {
    const r = shanghaiForCrossCheck.summary.r_modulus_cv;
    expect(isFinite(r), "JSON r_modulus_cv is not a finite number").toBe(true);

    const para = extractParagraphByAnchor(bookText, PART_II_CH12_ANCHOR, "Part II intro Chapter 12 paragraph");
    const clause = extractMetricClause(para, VARIABILITY_LABEL);
    expect(
      clause,
      `"${VARIABILITY_LABEL}" not found in the Part II intro Chapter 12 paragraph. ` +
      `If the sentence was rephrased, update VARIABILITY_LABEL in the test.`
    ).not.toBeNull();

    expect(
      clauseContainsR(clause!, r),
      `"${VARIABILITY_LABEL}" clause does not cite r = ${r.toFixed(2)}. ` +
      `Clause text: ${JSON.stringify(clause)}. ` +
      `JSON archive has r_modulus_cv = ${r}. ` +
      `Update shared/book-extended-chapters.ts to match the archive (or vice versa).`
    ).toBe(true);
  });

  // ── p(|λ|, CV%) = 0.030 — within the variability clause ──────────────────

  it("Part II intro 'glycaemic variability' clause cites p matching JSON archive p_modulus_cv (0.030)", () => {
    const p = shanghaiForCrossCheck.summary.p_modulus_cv;
    expect(isFinite(p), "JSON p_modulus_cv is not a finite number").toBe(true);
    const pStr = p.toFixed(3);

    const para = extractParagraphByAnchor(bookText, PART_II_CH12_ANCHOR, "Part II intro Chapter 12 paragraph");
    const clause = extractMetricClause(para, VARIABILITY_LABEL);
    expect(clause, `"${VARIABILITY_LABEL}" not found in Part II intro paragraph`).not.toBeNull();

    expect(
      clause!.includes(pStr),
      `"${VARIABILITY_LABEL}" clause does not cite p = ${pStr}. ` +
      `Clause text: ${JSON.stringify(clause)}. ` +
      `JSON archive has p_modulus_cv = ${p}. ` +
      `Update shared/book-extended-chapters.ts to match the archive (or vice versa).`
    ).toBe(true);
  });

  // ── Swap regression ───────────────────────────────────────────────────────
  //
  // Explicitly guard against the archive's two r values being swapped:
  //   r_modulus_mean_glucose ↔ r_modulus_cv
  //
  // If the glucose r is in the variability clause (or vice versa), the four
  // metric-specific tests above would catch the stale clause, but this test
  // makes the swap scenario explicit and self-documenting.

  it("r values are not swapped: mean-glucose clause does NOT contain the CV r value (−0.68), variability clause does NOT contain the glucose r value (−0.61)", () => {
    const rGlucose = shanghaiForCrossCheck.summary.r_modulus_mean_glucose;
    const rCv      = shanghaiForCrossCheck.summary.r_modulus_cv;

    // Only meaningful when the two values differ (which they do: −0.61 vs −0.68)
    if (!isFinite(rGlucose) || !isFinite(rCv) || rGlucose === rCv) return;

    const para = extractParagraphByAnchor(bookText, PART_II_CH12_ANCHOR, "Part II intro Chapter 12 paragraph");
    const glucoseClause     = extractMetricClause(para, GLUCOSE_LABEL);
    const variabilityClause = extractMetricClause(para, VARIABILITY_LABEL);

    if (glucoseClause && variabilityClause) {
      // The CV r value must NOT appear in the mean-glucose clause
      expect(
        clauseContainsR(glucoseClause, rCv),
        `The r_modulus_cv value (${rCv.toFixed(2)}) appears in the "${GLUCOSE_LABEL}" clause — ` +
        `the two r values appear to be swapped in the book text. ` +
        `Clause: ${JSON.stringify(glucoseClause)}`
      ).toBe(false);

      // The glucose r value must NOT appear in the variability clause
      expect(
        clauseContainsR(variabilityClause, rGlucose),
        `The r_modulus_mean_glucose value (${rGlucose.toFixed(2)}) appears in the "${VARIABILITY_LABEL}" clause — ` +
        `the two r values appear to be swapped in the book text. ` +
        `Clause: ${JSON.stringify(variabilityClause)}`
      ).toBe(false);
    }
  });
});
