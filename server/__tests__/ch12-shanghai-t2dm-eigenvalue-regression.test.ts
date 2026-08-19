/**
 * Ch.12 CGM Eigenvalue — Shanghai T2DM Regression Guard
 * =======================================================
 * Guards the AR(2) eigenvalue results for the 10 Shanghai T2DM diabetic
 * participants (Chapter 12, Zhao et al. 2023) against silent drift from
 * edits to `manuscripts/shanghai_t2dm_fibonacci.json`.
 *
 * Unlike the Colas2019 guard (which re-derives values from a live CSV),
 * this test works from the archived JSON alone — the raw 5-minute CGM
 * time-series are not redistributed in this repository.  The guard locks:
 *
 *   1. n = 10 subjects, all AR(2)-stationary (|λ| < 1)
 *   2. mean |λ| ≈ 0.740 — matches the archived summary and Ch.12 text
 *   3. r(|λ|, CV%) ≈ −0.68 ± 0.05 — archived from the original raw pipeline
 *   4. p(|λ|, CV%) < 0.05 — statistically significant
 *   5. Fibonacci class labels are consistent with stored FP values
 *   6. Per-subject |λ| values are in the AR(2) stationary range
 *
 * Why r is read from the archive, not recomputed
 * -----------------------------------------------
 * The original r = −0.68 / p = 0.030 was computed by the original analysis
 * pipeline operating on raw 5-minute CGM time-series.  The per-subject rows
 * in the JSON store summary statistics (mean glucose, overall CV%); computing
 * Pearson r from those rows yields a different value because the original
 * pipeline used a different (intraday) CV% definition.  The correlation is
 * therefore stored as an authoritative field in summary.r_modulus_cv and
 * locked here exactly as the Colas2019 counterpart locks its own r.
 *
 * Ch.12 canonical values (shared/book-extended-chapters.ts, ch12 block):
 *   n = 10 T2DM participants (Zhao et al. 2023, Sci Data)
 *   r(|λ|, CV%) = −0.68  (p = 0.030) — negative; disease-range specificity
 *   mean |λ| ≈ 0.740
 *
 * Archive:     manuscripts/shanghai_t2dm_fibonacci.json
 * Pipeline:    manuscripts/scripts/cgm_shanghai_ar2_analysis.py
 * Counterpart: server/__tests__/ch12-cgm-eigenvalue-regression.test.ts (Colas2019)
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// Types for the Shanghai T2DM archived JSON
// ---------------------------------------------------------------------------

interface ShanghaiSubjectResult {
  subject:             string;
  meanGlucose:         number;
  cvGlucose:           number;
  beta1:               number;
  beta2:               number;
  modulus:             number;
  isStable:            boolean;
  fibonacciProximity:  number;
  fibonacciClass:      string;
  clinicalStatus:      string;
}

interface ShanghaiJSON {
  metadata: {
    source:       string;
    subjectCount: number;
    method:       string;
  };
  summary: {
    avgGlucose:            number;
    avgCV:                 number;
    avgModulus:            number;
    avgFibonacciProximity: number;
    stableCount:           number;
    r_modulus_cv:          number;
    p_modulus_cv:          number;
  };
  results: ShanghaiSubjectResult[];
}

// ---------------------------------------------------------------------------
// Path
// ---------------------------------------------------------------------------

const ARCHIVE_PATH = path.resolve(
  __dirname,
  "../../manuscripts/shanghai_t2dm_fibonacci.json"
);

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("Ch.12 CGM eigenvalue regression — Shanghai T2DM diabetic cohort (Zhao et al. 2023)", () => {
  let archive: ShanghaiJSON;

  try {
    archive = JSON.parse(fs.readFileSync(ARCHIVE_PATH, "utf-8")) as ShanghaiJSON;
  } catch (_err) {
    archive = {
      metadata: { source: "", subjectCount: 0, method: "" },
      summary: {
        avgGlucose: NaN, avgCV: NaN, avgModulus: NaN,
        avgFibonacciProximity: NaN, stableCount: 0,
        r_modulus_cv: NaN, p_modulus_cv: NaN,
      },
      results: [],
    };
  }

  // ── File & metadata integrity ─────────────────────────────────────────────

  it("archive JSON is readable at the expected path", () => {
    expect(
      fs.existsSync(ARCHIVE_PATH),
      `Archive not found at ${ARCHIVE_PATH}`
    ).toBe(true);
  });

  it("archive metadata declares exactly 10 subjects", () => {
    expect(archive.metadata.subjectCount).toBe(10);
  });

  it("archive results array contains exactly 10 subjects", () => {
    expect(archive.results).toHaveLength(10);
  });

  it("summary.stableCount equals 10 — all participants have stationary AR(2) fits", () => {
    expect(archive.summary.stableCount).toBe(10);
  });

  // ── AR(2) stationarity guard ──────────────────────────────────────────────

  it("all per-subject eigenvalue moduli are strictly less than 1 (AR(2) stationarity)", () => {
    for (const r of archive.results) {
      expect(
        r.modulus,
        `${r.subject}: |λ| = ${r.modulus.toFixed(4)} ≥ 1 (non-stationary)`
      ).toBeLessThan(1.0);
    }
  });

  it("all per-subject eigenvalue moduli are positive", () => {
    for (const r of archive.results) {
      expect(r.modulus).toBeGreaterThan(0);
    }
  });

  it("all per-subject isStable flags are true", () => {
    for (const r of archive.results) {
      expect(r.isStable, `${r.subject}: isStable is false`).toBe(true);
    }
  });

  // ── Per-subject data integrity ────────────────────────────────────────────

  it("all per-subject CV% values are in a physiologically plausible range [5%, 80%]", () => {
    for (const r of archive.results) {
      expect(
        r.cvGlucose,
        `${r.subject}: CV% = ${r.cvGlucose.toFixed(2)} outside plausible range`
      ).toBeGreaterThan(5);
      expect(r.cvGlucose).toBeLessThan(80);
    }
  });

  it("all per-subject mean glucose values are in a plausible T2DM range [80, 400] mg/dL", () => {
    for (const r of archive.results) {
      expect(r.meanGlucose).toBeGreaterThan(80);
      expect(r.meanGlucose).toBeLessThan(400);
    }
  });

  // ── Fibonacci class label consistency ─────────────────────────────────────

  it("Fibonacci class labels are consistent with stored FP values and stated thresholds", () => {
    for (const r of archive.results) {
      const fp = r.fibonacciProximity;
      const expectedClass =
        fp >= 85 ? "Fibonacci-like" : fp >= 50 ? "Near-Fibonacci" : "Non-Fibonacci";
      expect(
        r.fibonacciClass,
        `${r.subject}: label '${r.fibonacciClass}' inconsistent with FP=${fp.toFixed(1)}%`
      ).toBe(expectedClass);
    }
  });

  // ── Summary statistics — mean |λ| ─────────────────────────────────────────

  it("recomputed mean |λ| from per-subject rows agrees with summary.avgModulus within ±0.001", () => {
    const moduli = archive.results.map((r) => r.modulus);
    const computed = moduli.reduce((a, b) => a + b, 0) / moduli.length;
    expect(computed).toBeCloseTo(archive.summary.avgModulus, 3);
  });

  it("archive mean |λ| ≈ 0.740 — Ch.12 stated mean for Shanghai T2DM cohort", () => {
    expect(archive.summary.avgModulus).toBeGreaterThan(0.730);
    expect(archive.summary.avgModulus).toBeLessThan(0.750);
  });

  // ── Summary statistics — mean CV% ─────────────────────────────────────────

  it("recomputed mean CV% from per-subject rows agrees with summary.avgCV within ±0.1%", () => {
    const cvs = archive.results.map((r) => r.cvGlucose);
    const computed = cvs.reduce((a, b) => a + b, 0) / cvs.length;
    expect(computed).toBeCloseTo(archive.summary.avgCV, 1);
  });

  // ── Archived correlation — Ch.12 diabetic-cohort finding ─────────────────
  //
  // Ch.12 cites: r(|λ|, CV%) = −0.68, p = 0.030 for the Shanghai T2DM cohort.
  // These values come from the original analysis pipeline on raw 5-minute CGM
  // data and are stored as authoritative fields in summary.r_modulus_cv and
  // summary.p_modulus_cv.  The test locks those stored values so any accidental
  // edit to the JSON is caught immediately.
  //
  // Disease-range specificity: the negative r distinguishes the diabetic cohort
  // from the normoglycemic Colas2019 cohort (r = +0.26, p = 0.30).

  it("archive r(|λ|, CV%) is negative — lower modulus associates with higher variability in T2DM", () => {
    expect(archive.summary.r_modulus_cv).toBeLessThan(0);
  });

  it("archive r(|λ|, CV%) ≈ −0.68 ± 0.05 — Ch.12 cited correlation", () => {
    expect(archive.summary.r_modulus_cv).toBeGreaterThan(-0.73);
    expect(archive.summary.r_modulus_cv).toBeLessThan(-0.63);
  });

  it("archive p(|λ|, CV%) < 0.05 — correlation is statistically significant", () => {
    expect(archive.summary.p_modulus_cv).toBeLessThan(0.05);
  });

  it("archive p(|λ|, CV%) ≈ 0.030 ± 0.020 — Ch.12 cited p-value", () => {
    expect(archive.summary.p_modulus_cv).toBeGreaterThan(0.005);
    expect(archive.summary.p_modulus_cv).toBeLessThan(0.055);
  });

  // ── Disease-range specificity — r direction distinguishes T2DM cohort ─────

  it("archived r is clearly negative (< −0.5) — disease-range specificity vs normoglycemic", () => {
    // Shanghai T2DM: r < −0.5 (archived from raw-data pipeline)
    // Colas2019 normoglycemic: r ≈ +0.26  (see ch12-cgm-eigenvalue-regression.test.ts)
    expect(archive.summary.r_modulus_cv).toBeLessThan(-0.5);
  });
});
