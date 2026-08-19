/**
 * Sampling-window sensitivity analysis for Notch2 in GSE179027
 *
 * Question: does truncating GSE179027 to the same 22 h ZT window as
 * GSE157357 (ZT 24–46) produce eigenvalues and R² values similar to
 * what is observed in GSE157357 WT-WT (|λ|=0.4891, R²=0.057)?
 *
 * Method:
 *  1. Load GSE179027 mouse enteroid timeseries (gene-symbol CSV, ZT24–ZT70)
 *  2. Fit full-series AR(2) for Notch2 (24 timepoints)
 *  3. Truncate to ZT24–ZT46 (12 timepoints, matching GSE157357 window)
 *  4. Refit AR(2) on truncated series
 *  5. Compare |λ|, R², root type, and Δ from 1/φ
 *  6. Also test intermediate windows (ZT24–ZT48, ZT24–ZT54) to show trend
 *
 * Uses same OLS AR(2) as notch2_gse157357_ar2.cjs
 */

'use strict';
const fs   = require('fs');
const path = require('path');

const PHI     = (1 + Math.sqrt(5)) / 2;
const INV_PHI = 1 / PHI;   // ≈ 0.6180

// ── helpers (identical to notch2_gse157357_ar2.cjs) ──────────────────────────

function meanCentre(arr) {
  const mu = arr.reduce((s, v) => s + v, 0) / arr.length;
  return arr.map(v => v - mu);
}

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

  // R² on AR(2) residuals
  let ss_res = 0;
  for (let t = 2; t < n; t++) {
    const pred  = beta1 * series[t - 1] + beta2 * series[t - 2];
    ss_res += (series[t] - pred) ** 2;
  }
  const yVals  = series.slice(2);
  const yMu    = yVals.reduce((s, v) => s + v, 0) / yVals.length;
  const ss_tot = yVals.reduce((s, v) => s + (v - yMu) ** 2, 0);
  const r2 = ss_tot > 1e-14 ? 1 - ss_res / ss_tot : 0;

  return { beta1, beta2, r2 };
}

function eigenModulus(beta1, beta2) {
  const disc = beta1 * beta1 + 4 * beta2;
  if (disc >= 0) {
    const sq = Math.sqrt(disc);
    return Math.max(Math.abs((beta1 + sq) / 2), Math.abs((beta1 - sq) / 2));
  }
  return Math.sqrt(-beta2);
}

function rootType(beta1, beta2) {
  return (beta1 * beta1 + 4 * beta2) >= 0 ? 'real' : 'complex';
}

// ── load GSE179027 ─────────────────────────────────────────────────────────────

const filePath = 'datasets/GSE179027_Mouse_Enteroid_circadian.csv';
const raw  = fs.readFileSync(filePath, 'utf-8').trim().split('\n');
const hdr  = raw[0].split(',');                     // gene, ZT24, ZT26, ...
const ztCols = hdr.slice(1).map(h => parseInt(h.replace('ZT',''), 10));

// Find Notch2 row (first occurrence)
let notch2Row = null;
for (let i = 1; i < raw.length; i++) {
  const cols = raw[i].split(',');
  if (cols[0].trim() === 'Notch2') {
    notch2Row = cols.slice(1).map(Number);
    break;
  }
}
if (!notch2Row) { console.error('Notch2 not found in GSE179027'); process.exit(1); }

console.log('Notch2 sampling-window sensitivity — GSE179027 mouse enteroid');
console.log(`Full ZT range: ZT${ztCols[0]}–ZT${ztCols[ztCols.length-1]} (${ztCols.length} timepoints, ${ztCols[ztCols.length-1]-ztCols[0]} h window)`);
console.log(`φ⁻¹ = 1/φ = ${INV_PHI.toFixed(4)}`);
console.log('');

// ── define windows to test ─────────────────────────────────────────────────────

const windows = [
  { label: 'ZT24–ZT46 (22 h, matches GSE157357)', maxZT: 46  },
  { label: 'ZT24–ZT48 (24 h)',                     maxZT: 48  },
  { label: 'ZT24–ZT54 (30 h)',                     maxZT: 54  },
  { label: 'ZT24–ZT60 (36 h)',                     maxZT: 60  },
  { label: 'ZT24–ZT70 (46 h, full series)',         maxZT: 70  },
];

const results = [];

for (const win of windows) {
  // Select timepoints within window
  const indices = ztCols.map((zt, i) => ({ zt, i })).filter(x => x.zt <= win.maxZT);
  const vals    = indices.map(x => notch2Row[x.i]);
  const series  = meanCentre(vals);
  const n       = series.length;

  const fit = fitAR2(series);
  if (!fit) {
    console.log(`${win.label}: OLS failed (n=${n})`);
    continue;
  }

  const { beta1, beta2, r2 } = fit;
  const modulus = eigenModulus(beta1, beta2);
  const delta   = Math.abs(modulus - INV_PHI);
  const roots   = rootType(beta1, beta2);

  results.push({ label: win.label, n, modulus, delta, r2, roots, beta1, beta2 });
}

// ── print table ────────────────────────────────────────────────────────────────

console.log('=== RESULTS ===');
console.log(`${'Window'.padEnd(42)} ${'N'.padEnd(4)} ${'|λ|'.padEnd(8)} ${'Δ from 1/φ'.padEnd(12)} ${'R²'.padEnd(8)} Roots`);
console.log('-'.repeat(90));
for (const r of results) {
  console.log(
    `${r.label.padEnd(42)} ${String(r.n).padEnd(4)} ${r.modulus.toFixed(4).padEnd(8)} ${r.delta.toFixed(4).padEnd(12)} ${r.r2.toFixed(3).padEnd(8)} ${r.roots}`
  );
}

// ── compare to GSE157357 WT-WT ─────────────────────────────────────────────────

console.log('\n=== COMPARISON TO GSE157357 WT-WT ===');
console.log('GSE157357 WT-WT (22 h window, n=12):  |λ|=0.4891, Δ=0.1290, R²=0.057, roots=real');

const truncated = results.find(r => r.label.includes('ZT24–ZT46'));
const full      = results.find(r => r.label.includes('ZT24–ZT70'));

if (truncated && full) {
  console.log(`\nGSE179027 truncated (22 h, n=${truncated.n}): |λ|=${truncated.modulus.toFixed(4)}, Δ=${truncated.delta.toFixed(4)}, R²=${truncated.r2.toFixed(3)}, roots=${truncated.roots}`);
  console.log(`GSE179027 full     (46 h, n=${full.n}):      |λ|=${full.modulus.toFixed(4)}, Δ=${full.delta.toFixed(4)}, R²=${full.r2.toFixed(3)}, roots=${full.roots}`);

  const lambdaShift = Math.abs(truncated.modulus - full.modulus);
  const r2Drop      = full.r2 - truncated.r2;

  console.log(`\n|λ| shift on truncation: ${lambdaShift.toFixed(4)} (full→truncated)`);
  console.log(`R² drop on truncation:  ${r2Drop.toFixed(3)}`);

  // Does truncation bring GSE179027 to match GSE157357 levels?
  const gse157357_lambda = 0.4891;
  const gse157357_r2     = 0.057;

  console.log('\n=== INTERPRETATION ===');
  if (Math.abs(truncated.modulus - gse157357_lambda) < 0.05 && truncated.r2 < 0.15) {
    console.log('✓ Truncation brings GSE179027 Notch2 |λ| and R² to levels matching GSE157357 WT-WT.');
    console.log('  → The ZT window length is the primary driver of the discrepancy (sampling artefact).');
  } else if (Math.abs(truncated.modulus - gse157357_lambda) < 0.10) {
    console.log('~ Truncation partially reduces the |λ| discrepancy but does not fully account for it.');
    console.log('  → Window length is a contributing factor; expression measure differences also matter.');
  } else {
    console.log('✗ Truncation alone does not account for the GSE157357 discrepancy.');
    console.log('  → Other factors (expression units, normalization, or genuine biology) drive the difference.');
  }
}

// ── save JSON ──────────────────────────────────────────────────────────────────

const outPath = 'scripts/notch2_sampling_window_results.json';
fs.writeFileSync(outPath, JSON.stringify({
  invPhi: INV_PHI,
  gse157357_wt_reference: { modulus: 0.4891, delta: 0.1290, r2: 0.057, roots: 'real', n: 12 },
  gse179027_windows: results
}, null, 2));
console.log(`\nResults saved to ${outPath}`);
