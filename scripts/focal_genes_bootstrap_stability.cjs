/**
 * Residual bootstrap stability of AR(2) eigenvalues for all seven focal
 * three-oscillator genes: Per2, TEF, Hes1, Mad2l1, NOTCH2, Notch2 (mouse),
 * and MCM6 (GSE179027 mouse enteroid / GSE161566 human enteroid).
 *
 * Method: RESIDUAL BOOTSTRAP (not sub-sampling)
 *   Unlike temporal sub-sampling (which drops timepoints and creates variable
 *   time gaps, breaking the fixed-lag AR assumption), residual bootstrap
 *   preserves the original 2-hour spacing:
 *
 *   1. Fit AR(2) on the full mean-centred series → β₁, β₂.
 *   2. Compute OLS residuals: e[t] = y[t] - β₁·y[t-1] - β₂·y[t-2]  (t=2…N-1)
 *   3. For each of 1,000 bootstraps:
 *        a. Draw N-2 residuals with replacement → e*[2…N-1]
 *        b. Seed y*[0]=y[0], y*[1]=y[1]; propagate:
 *             y*[t] = β₁·y*[t-1] + β₂·y*[t-2] + e*[t]
 *        c. Mean-centre y*.
 *        d. Refit AR(2) on mean-centred y* → β₁*, β₂* → |λ*|.
 *   4. Report: full-series |λ|, mean, median, SD, 95 % CI, fraction stable.
 *
 * Stability criterion: |λ*| within Δ<0.05 of 1/φ ≈ 0.6180.
 * Stability ratings:
 *   Strong   : fracStable > 0.40  (>40 %)
 *   Moderate : fracStable 0.15–0.40
 *   Weak     : fracStable < 0.15  (<15 %)
 *
 * Note: this replaces an earlier temporal sub-sampling approach
 * (scripts/notch2_bootstrap_stability.cjs) that sorted arbitrary timepoints
 * chronologically but created irregular 2/4/6+ h gaps — invalidating fixed-lag
 * AR(2) interpretation. Residual bootstrap is the standard time-series-valid
 * approach (Freedman & Peters 1984; Efron & Tibshirani 1993, §9.6).
 */

'use strict';
const fs = require('fs');

// ── constants ─────────────────────────────────────────────────────────────────
const PHI     = (1 + Math.sqrt(5)) / 2;
const INV_PHI = 1 / PHI;          // ≈ 0.6180
const N_BOOT  = 1000;
const TOL     = 0.05;            // Δ<0.05 from 1/φ

const MOUSE_FILE = 'datasets/GSE179027_Mouse_Enteroid_circadian.csv';
const HUMAN_FILE = 'datasets/GSE161566_Human_Enteroid_circadian.csv';

// Gene registry
const GENES = [
  { id: 'Per2',   dataset: 'GSE179027', file: MOUSE_FILE, oscillator: 'Circadian',        species: 'Mouse' },
  { id: 'TEF',    dataset: 'GSE161566', file: HUMAN_FILE, oscillator: 'Circadian',        species: 'Human' },
  { id: 'Hes1',   dataset: 'GSE179027', file: MOUSE_FILE, oscillator: 'Notch/ultradian',  species: 'Mouse' },
  { id: 'Mad2l1', dataset: 'GSE179027', file: MOUSE_FILE, oscillator: 'Cell cycle',       species: 'Mouse' },
  { id: 'NOTCH2', dataset: 'GSE161566', file: HUMAN_FILE, oscillator: 'Notch/ultradian',  species: 'Human' },
  { id: 'Notch2', dataset: 'GSE179027', file: MOUSE_FILE, oscillator: 'Notch/ultradian',  species: 'Mouse' },
  { id: 'MCM6',   dataset: 'GSE161566', file: HUMAN_FILE, oscillator: 'Cell cycle',        species: 'Human' },
];

// ── helpers ───────────────────────────────────────────────────────────────────

function parseCSV(filePath) {
  const raw    = fs.readFileSync(filePath, 'utf-8').trim();
  const lines  = raw.split('\n');
  const header = lines[0].split(',');
  const tpCols = header.slice(1);
  const rows   = new Map();
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const gene = cols[0].trim();
    const vals = cols.slice(1).map(Number);
    rows.set(gene, vals);
  }
  return { tpCols, rows };
}

function meanCentre(arr) {
  const mu = arr.reduce((s, v) => s + v, 0) / arr.length;
  return arr.map(v => v - mu);
}

/**
 * Fit AR(2) via OLS on an ALREADY mean-centred series.
 * Returns { beta1, beta2 } or null if rank-deficient.
 */
function fitAR2(series) {
  const n = series.length;
  if (n < 4) return null;
  let s11 = 0, s12 = 0, s22 = 0, sy1 = 0, sy2 = 0;
  for (let t = 2; t < n; t++) {
    const y = series[t], y1 = series[t - 1], y2 = series[t - 2];
    s11 += y1 * y1; s12 += y1 * y2; s22 += y2 * y2;
    sy1 += y * y1;  sy2 += y * y2;
  }
  const det = s11 * s22 - s12 * s12;
  if (Math.abs(det) < 1e-14) return null;
  return {
    beta1: (sy1 * s22 - sy2 * s12) / det,
    beta2: (sy2 * s11 - sy1 * s12) / det,
  };
}

/** AR(2) eigenvalue modulus from companion matrix */
function eigenModulus(beta1, beta2) {
  const disc = beta1 * beta1 + 4 * beta2;
  if (disc >= 0) {
    const sq = Math.sqrt(disc);
    return Math.max(Math.abs((beta1 + sq) / 2), Math.abs((beta1 - sq) / 2));
  }
  return Math.sqrt(-beta2);
}

function percentile(sorted, p) {
  const pos = (sorted.length - 1) * p;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function stabilityLabel(frac) {
  if (frac > 0.40) return 'Strong   (>40%)';
  if (frac >= 0.15) return 'Moderate (15–40%)';
  return 'Weak     (<15%)';
}

// Seeded LCG RNG for reproducibility
const BASE_SEED = 42;
const A = 1664525, C = 1013904223;
function makeRng(seed) {
  let s = seed >>> 0;
  return () => { s = (A * s + C) >>> 0; return s / 0x100000000; };
}

// Pre-load datasets
const mouseData = parseCSV(MOUSE_FILE);
const humanData = parseCSV(HUMAN_FILE);
function getData(file) { return file === MOUSE_FILE ? mouseData : humanData; }

// ── main loop ─────────────────────────────────────────────────────────────────
console.log('='.repeat(72));
console.log('FOCAL GENES RESIDUAL BOOTSTRAP STABILITY — Three-Oscillator Framework');
console.log(`φ⁻¹ = 1/φ = ${INV_PHI.toFixed(4)}`);
console.log(`Method : AR(2) residual bootstrap (N=${N_BOOT}), 2-hour spacing preserved`);
console.log(`Stability Δ : <${TOL} of 1/φ counts as "stable"`);
console.log('='.repeat(72));
console.log('');

const allResults = [];

for (let gi = 0; gi < GENES.length; gi++) {
  const { id, dataset, file, oscillator, species } = GENES[gi];
  const { tpCols, rows } = getData(file);
  const N = tpCols.length; // 24

  console.log(`── ${id}  [${oscillator}, ${species}, ${dataset}] ─────────────────`);

  if (!rows.has(id)) {
    console.error(`  ERROR: ${id} not found in ${file}`);
    continue;
  }

  const vals = rows.get(id);

  // ── Step 1: full-series fit ──────────────────────────────────────────────
  const yCentre = meanCentre(vals);
  const fullFit = fitAR2(yCentre);
  if (!fullFit) { console.error(`  ERROR: AR(2) fit failed for ${id}`); continue; }
  const { beta1, beta2 } = fullFit;
  const fullMod   = eigenModulus(beta1, beta2);
  const fullDelta = Math.abs(fullMod - INV_PHI);
  console.log(`  Full-series β₁=${beta1.toFixed(4)}  β₂=${beta2.toFixed(4)}`);
  console.log(`  Full-series |λ|=${fullMod.toFixed(4)}  Δ=${fullDelta.toFixed(4)}`);

  // ── Step 2: residuals ────────────────────────────────────────────────────
  // e[t] = y[t] - β₁·y[t-1] - β₂·y[t-2]  for t = 2…N-1
  const residuals = [];
  for (let t = 2; t < N; t++) {
    residuals.push(yCentre[t] - beta1 * yCentre[t - 1] - beta2 * yCentre[t - 2]);
  }
  // Mean-centre the residuals (standard residual bootstrap practice)
  const resMu = residuals.reduce((s, v) => s + v, 0) / residuals.length;
  const resid = residuals.map(v => v - resMu);

  // ── Step 3: bootstrap ────────────────────────────────────────────────────
  const rng     = makeRng(BASE_SEED + gi * 1000);
  const lambdas = [];
  let nFailed   = 0;
  const nRes    = resid.length; // N - 2

  for (let b = 0; b < N_BOOT; b++) {
    // Draw N-2 residuals with replacement
    const eStar = Array.from({ length: nRes }, () => resid[Math.floor(rng() * nRes)]);

    // Reconstruct bootstrap series y*
    const yStar = new Array(N);
    yStar[0] = yCentre[0];
    yStar[1] = yCentre[1];
    for (let t = 2; t < N; t++) {
      yStar[t] = beta1 * yStar[t - 1] + beta2 * yStar[t - 2] + eStar[t - 2];
    }

    // Mean-centre y* before refitting
    const yStarC = meanCentre(yStar);
    const fit    = fitAR2(yStarC);
    if (!fit) { nFailed++; continue; }
    const mod = eigenModulus(fit.beta1, fit.beta2);
    if (!isFinite(mod) || mod > 2) { nFailed++; continue; }
    lambdas.push(mod);
  }

  // ── Step 4: statistics ───────────────────────────────────────────────────
  lambdas.sort((a, b) => a - b);
  const n    = lambdas.length;
  const mean = lambdas.reduce((s, v) => s + v, 0) / n;
  const sd   = Math.sqrt(lambdas.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1));

  const ci_lo  = percentile(lambdas, 0.025);
  const ci_hi  = percentile(lambdas, 0.975);
  const median = percentile(lambdas, 0.5);

  const nStable    = lambdas.filter(v => Math.abs(v - INV_PHI) < TOL).length;
  const fracStable = nStable / n;
  const label      = stabilityLabel(fracStable);

  console.log(`  Valid resamples : ${n}/${N_BOOT}  (${nFailed} discarded)`);
  console.log(`  Mean  |λ*|      : ${mean.toFixed(4)}  (Median: ${median.toFixed(4)})`);
  console.log(`  95 % CI         : [${ci_lo.toFixed(4)}, ${ci_hi.toFixed(4)}]`);
  console.log(`  1/φ inside CI?  : ${INV_PHI >= ci_lo && INV_PHI <= ci_hi ? 'YES' : 'no'}`);
  console.log(`  Fraction stable : ${(fracStable * 100).toFixed(1)} %  (n=${nStable}/${n})`);
  console.log(`  Stability rating: ${label}`);
  console.log('');

  allResults.push({
    gene: id, oscillator, species, dataset,
    fullSeriesLambda: fullMod,
    fullSeriesDelta: fullDelta,
    fullSeriesBeta1: beta1,
    fullSeriesBeta2: beta2,
    nValid: n, nFailed, mean, median, sd,
    ci95: [ci_lo, ci_hi],
    invPhiInCI: INV_PHI >= ci_lo && INV_PHI <= ci_hi,
    nStable, fracStable,
    stabilityLabel: label.trim(),
  });
}

// ── Summary table ─────────────────────────────────────────────────────────────
console.log('='.repeat(72));
console.log('SUMMARY — Residual Bootstrap Stability Ranking (strongest first)');
console.log('='.repeat(72));
console.log('');
console.log('Gene'.padEnd(8) + 'Osc.'.padEnd(18) + '|λ|full'.padEnd(9) +
            'Mean|λ*|'.padEnd(10) + '95%CI'.padEnd(16) + 'Stable%'.padEnd(10) + 'Rating');
console.log('-'.repeat(82));
const sorted = [...allResults].sort((a, b) => b.fracStable - a.fracStable);
for (const r of sorted) {
  const ci = `[${r.ci95[0].toFixed(3)},${r.ci95[1].toFixed(3)}]`;
  console.log(
    r.gene.padEnd(8) + r.oscillator.padEnd(18) +
    r.fullSeriesLambda.toFixed(4).padEnd(9) +
    r.mean.toFixed(4).padEnd(10) + ci.padEnd(16) +
    `${(r.fracStable * 100).toFixed(1)}%`.padEnd(10) + r.stabilityLabel
  );
}
console.log('');
console.log('Strong (>40%): claim stable across bootstrap resamples');
console.log('Moderate (15–40%): cite with explicit hedging about variability');
console.log('Weak (<15%): do not cite as primary stability evidence');

// ── Save JSON ─────────────────────────────────────────────────────────────────
const outPath = 'scripts/focal_genes_bootstrap_stability_results.json';
fs.writeFileSync(outPath, JSON.stringify({
  method: {
    name: 'AR(2) residual bootstrap',
    description: 'Resample OLS residuals with replacement; reconstruct series at original 2h spacing; refit AR(2)',
    reference: 'Freedman & Peters 1984; Efron & Tibshirani 1993 §9.6',
    nResamples: N_BOOT,
    nTimepoints: 24,
    tolerance: TOL,
    invPhi: INV_PHI,
    stabilityThresholds: { strong: 0.40, moderate_low: 0.15 },
    note: 'Replaces earlier temporal sub-sampling approach (notch2_bootstrap_stability.cjs) which created variable time gaps incompatible with fixed-lag AR(2)',
  },
  results: allResults,
}, null, 2));
console.log(`\nResults saved to ${outPath}`);
