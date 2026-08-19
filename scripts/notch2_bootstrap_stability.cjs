/**
 * Bootstrap temporal stability of NOTCH2 AR(2) eigenvalue in GSE161566
 * (Human Intestinal Enteroid, 24 timepoints CH_24 → CH_70 in 2 h steps).
 *
 * Method:
 *   - 1,000 sub-samples of 18 out of 24 timepoints (without replacement),
 *     drawn randomly.  For each sub-sample the timepoints are kept in
 *     chronological order before fitting AR(2).
 *   - AR(2) OLS: mean-centre → fit y[t] = β1·y[t-1] + β2·y[t-2]
 *   - Eigenvalue modulus: same Cramer/complex formula used everywhere else.
 *   - Report: mean |λ|, 95 % CI (2.5th–97.5th percentile), and fraction of
 *     resamples with |λ| within Δ<0.05 of 1/φ ≈ 0.6180.
 */

'use strict';
const fs   = require('fs');
const path = require('path');

// ── constants ─────────────────────────────────────────────────────────────────
const PHI        = (1 + Math.sqrt(5)) / 2;
const INV_PHI    = 1 / PHI;                // ≈ 0.6180
const NOTCH2_ID  = 'NOTCH2';
const N_BOOT     = 1000;
const KEEP       = 18;                     // timepoints retained per resample
const TOL        = 0.05;                   // Δ<0.05 from 1/φ counts as "stable"
const DATA_FILE  = 'datasets/GSE161566_Human_Enteroid_circadian.csv';

// ── helpers ───────────────────────────────────────────────────────────────────

/** Parse the GSE161566 CSV.  Header row: gene, CH_24, CH_26, …, CH_70.
 *  Returns { headers: string[], rows: Map<gene → number[]> }
 */
function parseCSV(filePath) {
  const raw   = fs.readFileSync(filePath, 'utf-8').trim();
  const lines = raw.split('\n');
  const header = lines[0].split(',');          // gene, CH_24, …
  const tpCols  = header.slice(1);             // "CH_24", …, "CH_70"

  const rows = new Map();
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const gene = cols[0].trim();
    const vals = cols.slice(1).map(Number);
    rows.set(gene, vals);
  }
  return { tpCols, rows };
}

/** Mean-centre an array */
function meanCentre(arr) {
  const mu = arr.reduce((s, v) => s + v, 0) / arr.length;
  return arr.map(v => v - mu);
}

/**
 * Fit AR(2) via OLS on a series that is ALREADY mean-centred.
 * Returns { beta1, beta2 } or null if rank-deficient.
 */
function fitAR2(series) {
  const n = series.length;
  if (n < 4) return null;

  let s11 = 0, s12 = 0, s22 = 0, sy1 = 0, sy2 = 0;
  for (let t = 2; t < n; t++) {
    const y  = series[t];
    const y1 = series[t - 1];
    const y2 = series[t - 2];
    s11 += y1 * y1;
    s12 += y1 * y2;
    s22 += y2 * y2;
    sy1 += y  * y1;
    sy2 += y  * y2;
  }

  const det = s11 * s22 - s12 * s12;
  if (Math.abs(det) < 1e-14) return null;

  const beta1 = (sy1 * s22 - sy2 * s12) / det;
  const beta2 = (sy2 * s11 - sy1 * s12) / det;
  return { beta1, beta2 };
}

/** AR(2) eigenvalue modulus from companion matrix */
function eigenModulus(beta1, beta2) {
  const disc = beta1 * beta1 + 4 * beta2;
  if (disc >= 0) {
    const sqrtD   = Math.sqrt(disc);
    const lambda1 = (beta1 + sqrtD) / 2;
    const lambda2 = (beta1 - sqrtD) / 2;
    return Math.max(Math.abs(lambda1), Math.abs(lambda2));
  }
  // complex conjugate pair: modulus = √(−β₂)
  return Math.sqrt(-beta2);
}

/** Draw k indices from [0, n) without replacement (Fisher-Yates partial) */
function sampleIndices(n, k, rng) {
  const idx = Array.from({ length: n }, (_, i) => i);
  for (let i = 0; i < k; i++) {
    const j = i + Math.floor(rng() * (n - i));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, k).sort((a, b) => a - b); // keep chronological order
}

// ── main ──────────────────────────────────────────────────────────────────────

console.log('NOTCH2 bootstrap temporal stability — GSE161566 Human Intestinal Enteroid');
console.log(`φ⁻¹ = 1/φ = ${INV_PHI.toFixed(4)}`);
console.log(`Sub-samples: ${N_BOOT} × ${KEEP} of 24 timepoints (without replacement)`);
console.log(`Stability criterion: |λ| within Δ<${TOL} of 1/φ`);
console.log('');

const { tpCols, rows } = parseCSV(DATA_FILE);
const N_TP = tpCols.length;   // should be 24

if (!rows.has(NOTCH2_ID)) {
  console.error(`ERROR: ${NOTCH2_ID} not found in ${DATA_FILE}`);
  process.exit(1);
}

const notch2Vals = rows.get(NOTCH2_ID);
console.log(`Timepoints found: ${N_TP}  (${tpCols[0]} → ${tpCols[N_TP - 1]})`);

// ── Full-series baseline ──────────────────────────────────────────────────────
const fullCentred = meanCentre(notch2Vals);
const fullFit     = fitAR2(fullCentred);
const fullMod     = fullFit ? eigenModulus(fullFit.beta1, fullFit.beta2) : NaN;
const fullDelta   = Math.abs(fullMod - INV_PHI);
console.log(`Full-series |λ| = ${fullMod.toFixed(4)}   Δ from 1/φ = ${fullDelta.toFixed(4)}`);
console.log('');

// ── Bootstrap ─────────────────────────────────────────────────────────────────
// Use a simple seeded-style LCG for reproducibility.
// LCG: xₙ₊₁ = (a·xₙ + c) mod m
let seed = 42;
const M = 2 ** 31;
const A = 1664525;
const C = 1013904223;
function rng() {
  seed = (A * seed + C) >>> 0;   // unsigned 32-bit
  return seed / 0x100000000;
}

const lambdas = [];
let nFailed   = 0;

for (let b = 0; b < N_BOOT; b++) {
  const idx       = sampleIndices(N_TP, KEEP, rng);
  const subSeries = idx.map(i => notch2Vals[i]);
  const centred   = meanCentre(subSeries);
  const fit       = fitAR2(centred);
  if (!fit) { nFailed++; continue; }
  const mod = eigenModulus(fit.beta1, fit.beta2);
  // keep only finite values; discard explosive fits (|λ|>2)
  if (!isFinite(mod) || mod > 2) { nFailed++; continue; }
  lambdas.push(mod);
}

// ── Statistics ────────────────────────────────────────────────────────────────
lambdas.sort((a, b) => a - b);
const n = lambdas.length;

const mean = lambdas.reduce((s, v) => s + v, 0) / n;
const variance = lambdas.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
const sd = Math.sqrt(variance);

// Percentile helper (linear interpolation)
function percentile(sorted, p) {
  const pos = (sorted.length - 1) * p;
  const lo  = Math.floor(pos);
  const hi  = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

const ci_lo  = percentile(lambdas, 0.025);
const ci_hi  = percentile(lambdas, 0.975);
const median = percentile(lambdas, 0.5);

const nStable   = lambdas.filter(v => Math.abs(v - INV_PHI) < TOL).length;
const fracStable = nStable / n;

// ── Report ────────────────────────────────────────────────────────────────────
console.log('=== BOOTSTRAP RESULTS ===');
console.log(`Valid resamples : ${n} / ${N_BOOT}  (${nFailed} discarded as rank-deficient or explosive)`);
console.log(`Mean  |λ|       : ${mean.toFixed(4)}`);
console.log(`Median |λ|      : ${median.toFixed(4)}`);
console.log(`SD              : ${sd.toFixed(4)}`);
console.log(`95 % CI         : [${ci_lo.toFixed(4)}, ${ci_hi.toFixed(4)}]`);
console.log(`Full-series |λ| : ${fullMod.toFixed(4)}  (${fullMod >= ci_lo && fullMod <= ci_hi ? 'inside' : 'OUTSIDE'} 95 % CI)`);
console.log(`1/φ             : ${INV_PHI.toFixed(4)}  (${INV_PHI >= ci_lo && INV_PHI <= ci_hi ? 'inside' : 'outside'} 95 % CI)`);
console.log(`Fraction stable : ${(fracStable * 100).toFixed(1)} %  (Δ<${TOL} of 1/φ; n=${nStable}/${n})`);

// Distribution summary
const bins = [0.50, 0.55, 0.60, 0.65, 0.70, 0.75, 0.80, 0.85, 0.90];
console.log('\nDistribution of resampled |λ|:');
for (let i = 0; i < bins.length - 1; i++) {
  const lo = bins[i];
  const hi = bins[i + 1];
  const cnt = lambdas.filter(v => v >= lo && v < hi).length;
  const bar = '█'.repeat(Math.round(cnt / n * 50));
  console.log(`  [${lo.toFixed(2)}, ${hi.toFixed(2)})  ${String(cnt).padStart(4)}  ${bar}`);
}
const above = lambdas.filter(v => v >= bins[bins.length - 1]).length;
const below = lambdas.filter(v => v < bins[0]).length;
if (below > 0) console.log(`  [<${bins[0].toFixed(2)})           ${below}`);
if (above > 0) console.log(`  [≥${bins[bins.length - 1].toFixed(2)})          ${above}`);

// ── Save JSON ─────────────────────────────────────────────────────────────────
const outPath = 'scripts/notch2_bootstrap_stability_results.json';
fs.writeFileSync(outPath, JSON.stringify({
  gene: NOTCH2_ID,
  dataset: 'GSE161566',
  nTimepoints: N_TP,
  keepPerResample: KEEP,
  nResamples: N_BOOT,
  nValid: n,
  nFailed,
  invPhi: INV_PHI,
  fullSeriesLambda: fullMod,
  fullSeriesDelta: fullDelta,
  mean,
  median,
  sd,
  ci95: [ci_lo, ci_hi],
  fracStable,
  nStable,
  tolerance: TOL,
}, null, 2));
console.log(`\nResults saved to ${outPath}`);
