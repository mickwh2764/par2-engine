/**
 * Residual bootstrap stability of AR(2) eigenvalue for Wee1 in GSE54650 Liver.
 *
 * Method: AR(2) RESIDUAL BOOTSTRAP (Freedman & Peters 1984; Efron & Tibshirani 1993 §9.6)
 *   GSE54650 requires log2(x) transformation before mean-centring (confirmed by dataset audit).
 *   Timepoints: CT18–CT64, 24 points at 2h spacing.
 *
 *   1. log2-transform the raw expression values.
 *   2. Fit AR(2) OLS on mean-centred log2 series → β₁, β₂.
 *   3. Compute OLS residuals: e[t] = y[t] - β₁·y[t-1] - β₂·y[t-2]  (t=2…N-1)
 *   4. For each of 1,000 bootstraps:
 *        a. Draw N-2 residuals with replacement → e*[2…N-1]
 *        b. Seed y*[0]=y[0], y*[1]=y[1]; propagate:
 *             y*[t] = β₁·y*[t-1] + β₂·y*[t-2] + e*[t]
 *        c. Mean-centre y*.
 *        d. Refit AR(2) → β₁*, β₂* → |λ*|.
 *   5. Report: full-series |λ|, mean, median, SD, 95% CI, fraction stable.
 *
 * Stability criterion: |λ*| within Δ<0.05 of 1/φ ≈ 0.6180.
 * Stability ratings:
 *   Strong   : fracStable > 0.40  (>40%)
 *   Moderate : fracStable 0.15–0.40
 *   Weak     : fracStable < 0.15  (<15%)
 */

'use strict';
const fs = require('fs');

// ── constants ────────────────────────────────────────────────────────────────
const PHI     = (1 + Math.sqrt(5)) / 2;
const INV_PHI = 1 / PHI;          // ≈ 0.6180
const N_BOOT  = 1000;
const TOL     = 0.05;            // Δ<0.05 from 1/φ

const LIVER_FILE = 'datasets/GSE54650_Liver_circadian.csv';
const GENE = 'Wee1';

// ── helpers ──────────────────────────────────────────────────────────────────

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

function log2Transform(arr) {
  return arr.map(v => Math.log2(v));
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

// ── main ─────────────────────────────────────────────────────────────────────
console.log('='.repeat(72));
console.log('WEE1 LIVER RESIDUAL BOOTSTRAP STABILITY — GSE54650');
console.log(`φ⁻¹ = 1/φ = ${INV_PHI.toFixed(4)}`);
console.log(`Method : AR(2) residual bootstrap (N=${N_BOOT}), log2-transformed, 2-hour spacing`);
console.log(`Stability Δ : <${TOL} of 1/φ counts as "stable"`);
console.log('='.repeat(72));
console.log('');

const { tpCols, rows } = parseCSV(LIVER_FILE);
const N = tpCols.length;

console.log(`Dataset : ${LIVER_FILE}`);
console.log(`Timepoints : ${tpCols[0]}–${tpCols[N-1]} (${N} points at 2h spacing)`);
console.log(`Gene : ${GENE}`);
console.log('');

if (!rows.has(GENE)) {
  console.error(`ERROR: ${GENE} not found in ${LIVER_FILE}`);
  process.exit(1);
}

const rawVals = rows.get(GENE);
console.log(`Raw values (first 5): ${rawVals.slice(0,5).join(', ')}`);

// ── Step 1: log2-transform then mean-centre ───────────────────────────────
const log2Vals = log2Transform(rawVals);
const yCentre  = meanCentre(log2Vals);

console.log(`log2 values (first 5): ${log2Vals.slice(0,5).map(v=>v.toFixed(4)).join(', ')}`);
console.log('');

// ── Step 2: full-series AR(2) fit ─────────────────────────────────────────
const fullFit = fitAR2(yCentre);
if (!fullFit) {
  console.error('ERROR: AR(2) fit failed');
  process.exit(1);
}
const { beta1, beta2 } = fullFit;
const fullMod   = eigenModulus(beta1, beta2);
const fullDelta = Math.abs(fullMod - INV_PHI);
const rootType  = (beta1 * beta1 + 4 * beta2) >= 0 ? 'real' : 'complex';

console.log(`Full-series β₁ = ${beta1.toFixed(6)}`);
console.log(`Full-series β₂ = ${beta2.toFixed(6)}`);
console.log(`Full-series |λ| = ${fullMod.toFixed(4)}  (root type: ${rootType})`);
console.log(`Full-series Δ from 1/φ = ${fullDelta.toFixed(4)}`);
console.log('');

// ── Step 3: compute residuals ────────────────────────────────────────────
const residuals = [];
for (let t = 2; t < N; t++) {
  residuals.push(yCentre[t] - beta1 * yCentre[t - 1] - beta2 * yCentre[t - 2]);
}
// Mean-centre residuals (standard residual bootstrap practice)
const resMu = residuals.reduce((s, v) => s + v, 0) / residuals.length;
const resid = residuals.map(v => v - resMu);
console.log(`Residuals: ${residuals.length} values, mean-centred`);
console.log('');

// ── Step 4: bootstrap ─────────────────────────────────────────────────────
const rng     = makeRng(BASE_SEED);
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

// ── Step 5: statistics ────────────────────────────────────────────────────
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

console.log('='.repeat(72));
console.log('BOOTSTRAP RESULTS');
console.log('='.repeat(72));
console.log(`Valid resamples : ${n}/${N_BOOT}  (${nFailed} discarded)`);
console.log(`Mean  |λ*|      : ${mean.toFixed(4)}  (Median: ${median.toFixed(4)})`);
console.log(`SD              : ${sd.toFixed(4)}`);
console.log(`95 % CI         : [${ci_lo.toFixed(4)}, ${ci_hi.toFixed(4)}]`);
console.log(`1/φ inside CI?  : ${INV_PHI >= ci_lo && INV_PHI <= ci_hi ? 'YES' : 'no'}`);
console.log(`Fraction stable : ${(fracStable * 100).toFixed(1)} %  (n=${nStable}/${n})`);
console.log(`Stability rating: ${label}`);
console.log('');

// ── Save JSON ──────────────────────────────────────────────────────────────
const result = {
  gene: GENE,
  tissue: 'Liver',
  dataset: 'GSE54650',
  oscillator: 'Cell cycle / G2/M gate',
  species: 'Mouse',
  preprocessing: 'log2(x) then mean-centre (GSE54650 standard)',
  nTimepoints: N,
  timepointRange: `${tpCols[0]}–${tpCols[N-1]}`,
  fullSeriesBeta1: beta1,
  fullSeriesBeta2: beta2,
  fullSeriesLambda: fullMod,
  fullSeriesDelta: fullDelta,
  rootType,
  method: {
    name: 'AR(2) residual bootstrap',
    description: 'log2-transform → mean-centre → OLS residuals resampled with replacement; series reconstructed at original 2h spacing; AR(2) refit',
    reference: 'Freedman & Peters 1984; Efron & Tibshirani 1993 §9.6',
    nResamples: N_BOOT,
    tolerance: TOL,
    invPhi: INV_PHI,
    stabilityThresholds: { strong: 0.40, moderate_low: 0.15 },
  },
  nValid: n,
  nFailed,
  bootstrapMean: mean,
  bootstrapMedian: median,
  bootstrapSD: sd,
  ci95: [ci_lo, ci_hi],
  invPhiInCI: INV_PHI >= ci_lo && INV_PHI <= ci_hi,
  nStable,
  fracStable,
  stabilityLabel: label.trim(),
};

const outPath = 'scripts/wee1_liver_bootstrap_stability_results.json';
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
console.log(`Results saved to ${outPath}`);
