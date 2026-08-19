/**
 * Compute AR(2) eigenvalues for Notch2 (ENSMUSG00000027878) across all 4
 * GSE157357 conditions (WT-WT, ApcKO-WT, WT-BmalKO, ApcKO-BmalKO) and
 * run expression-matched permutation tests.
 *
 * Uses the same OLS AR(2) method as the organoid pipeline:
 *  - mean-centre the series
 *  - fit y[t] = β1·y[t-1] + β2·y[t-2] via OLS
 *  - eigenvalues from companion matrix: λ = (β1 ± √(β1²+4β2)) / 2
 *  - |λ| = modulus (real roots: max abs; complex roots: √(β1²/4−β2/1) = √(-disc/4))
 */

'use strict';
const fs   = require('fs');
const path = require('path');

// ── constants ────────────────────────────────────────────────────────────────
const PHI        = (1 + Math.sqrt(5)) / 2;
const INV_PHI    = 1 / PHI;            // ≈ 0.6180
const NOTCH2_ID  = 'ENSMUSG00000027878';
const N_PERM     = 10000;
const LOG2_WIN   = 0.5;               // expression-matching window (log2)
const TOL        = 0.05;              // stability tolerance (strict)

const CONDITIONS = [
  { label: 'WT-WT',        file: 'datasets/GSE157357_Organoid_WT-WT_circadian.csv'        },
  { label: 'ApcKO-WT',     file: 'datasets/GSE157357_Organoid_ApcKO-WT_circadian.csv'     },
  { label: 'WT-BmalKO',    file: 'datasets/GSE157357_Organoid_WT-BmalKO_circadian.csv'    },
  { label: 'ApcKO-BmalKO', file: 'datasets/GSE157357_Organoid_ApcKO-BmalKO_circadian.csv' },
];

// ── helpers ──────────────────────────────────────────────────────────────────

function parseCSV(filePath) {
  const raw  = fs.readFileSync(filePath, 'utf-8').trim();
  const rows = raw.split('\n');

  // Header: "target_id","34","36","36", ...
  const headerCols = rows[0].split(',').map(c => c.replace(/"/g, ''));
  const colLabels  = headerCols.slice(1).map(Number); // ZT values (with dups)

  const data = {};   // ensemblId → array of { zt, val }

  for (let i = 1; i < rows.length; i++) {
    const cols    = rows[i].split(',');
    const gene    = cols[0].replace(/"/g, '');
    const vals    = cols.slice(1).map(Number);
    data[gene] = colLabels.map((zt, j) => ({ zt, val: vals[j] }));
  }

  return data;
}

/** Average replicates per ZT and return sorted chronological series */
function collapseReplicates(obs) {
  const map = {};
  for (const { zt, val } of obs) {
    if (!map[zt]) map[zt] = [];
    map[zt].push(val);
  }
  const sorted = Object.keys(map).map(Number).sort((a, b) => a - b);
  return sorted.map(zt => {
    const arr = map[zt];
    return { zt, mean: arr.reduce((s, v) => s + v, 0) / arr.length };
  });
}

/** Mean-centre an array */
function meanCentre(arr) {
  const mu = arr.reduce((s, v) => s + v, 0) / arr.length;
  return arr.map(v => v - mu);
}

/**
 * Fit AR(2) via OLS.
 * Returns { beta1, beta2, r2 }
 * Uses lags: y[t] = β1·y[t-1] + β2·y[t-2]
 */
function fitAR2(series) {
  const n = series.length;
  if (n < 4) return null;

  let s11 = 0, s12 = 0, s22 = 0, sy1 = 0, sy2 = 0, syy = 0;
  let m = 0;
  for (let t = 2; t < n; t++) {
    const y  = series[t];
    const y1 = series[t - 1];
    const y2 = series[t - 2];
    s11 += y1 * y1;
    s12 += y1 * y2;
    s22 += y2 * y2;
    sy1 += y  * y1;
    sy2 += y  * y2;
    syy += y  * y;
    m++;
  }

  // Solve 2×2 system: [s11 s12; s12 s22] [β1; β2] = [sy1; sy2]
  const det = s11 * s22 - s12 * s12;
  if (Math.abs(det) < 1e-14) return null;

  const beta1 = (sy1 * s22 - sy2 * s12) / det;
  const beta2 = (sy2 * s11 - sy1 * s12) / det;

  // R² on AR(2) residuals vs mean-centred response
  let ss_res = 0;
  for (let t = 2; t < n; t++) {
    const pred  = beta1 * series[t - 1] + beta2 * series[t - 2];
    const resid = series[t] - pred;
    ss_res += resid * resid;
  }
  // Total SS of the response values (already mean-centred globally)
  const yVals = series.slice(2);
  const yMu   = yVals.reduce((s, v) => s + v, 0) / yVals.length;
  const ss_tot = yVals.reduce((s, v) => s + (v - yMu) ** 2, 0);
  const r2 = ss_tot > 1e-14 ? 1 - ss_res / ss_tot : 0;

  return { beta1, beta2, r2 };
}

/** Compute eigenvalue modulus from AR(2) coefficients */
function eigenModulus(beta1, beta2) {
  const disc = beta1 * beta1 + 4 * beta2;
  if (disc >= 0) {
    const sqrtD   = Math.sqrt(disc);
    const lambda1 = (beta1 + sqrtD) / 2;
    const lambda2 = (beta1 - sqrtD) / 2;
    return Math.max(Math.abs(lambda1), Math.abs(lambda2));
  } else {
    // complex conjugate pair: modulus = √(-beta2)
    return Math.sqrt(-beta2);
  }
}

/** Is the AR(2) process stable (both |λ| < 1)? */
function isStable(beta1, beta2) {
  const disc = beta1 * beta1 + 4 * beta2;
  if (disc >= 0) {
    const sqrtD = Math.sqrt(disc);
    return Math.abs((beta1 + sqrtD) / 2) < 1 && Math.abs((beta1 - sqrtD) / 2) < 1;
  } else {
    return Math.sqrt(-beta2) < 1;
  }
}

function rootType(beta1, beta2) {
  return (beta1 * beta1 + 4 * beta2) >= 0 ? 'real' : 'complex';
}

/** log2 mean of a series (add 1 to avoid log(0)) */
function log2Mean(series) {
  const mu = series.reduce((s, v) => s + v, 0) / series.length;
  return Math.log2(mu + 1);
}

// ── main analysis ─────────────────────────────────────────────────────────────

function analyseCondition(cond) {
  const data    = parseCSV(cond.file);
  const obs     = data[NOTCH2_ID];
  if (!obs) { console.error(`${cond.label}: Notch2 not found`); return null; }

  const series   = meanCentre(collapseReplicates(obs).map(r => r.mean));
  const fit      = fitAR2(series);
  if (!fit) { console.error(`${cond.label}: OLS failed`); return null; }

  const { beta1, beta2, r2 } = fit;
  const modulus = eigenModulus(beta1, beta2);
  const delta   = Math.abs(modulus - INV_PHI);
  const stable  = isStable(beta1, beta2);
  const roots   = rootType(beta1, beta2);

  // Permutation test: expression-matched controls
  const notch2LogMean = log2Mean(collapseReplicates(obs).map(r => r.mean));
  let nLessEq = 0;
  let poolSize = 0;

  const allGenes = Object.keys(data).filter(g => g !== NOTCH2_ID);
  const pool = [];
  for (const gene of allGenes) {
    const rawVals = collapseReplicates(data[gene]).map(r => r.mean);
    const lm      = log2Mean(rawVals);
    if (Math.abs(lm - notch2LogMean) <= LOG2_WIN) {
      pool.push(gene);
    }
  }
  poolSize = pool.length;

  // Shuffle pool and draw N_PERM (with replacement)
  const rng = () => Math.random();
  for (let i = 0; i < N_PERM; i++) {
    const g       = pool[Math.floor(rng() * pool.length)];
    const gVals   = meanCentre(collapseReplicates(data[g]).map(r => r.mean));
    const gFit    = fitAR2(gVals);
    if (!gFit || !isStable(gFit.beta1, gFit.beta2)) continue;
    const gMod    = eigenModulus(gFit.beta1, gFit.beta2);
    const gDelta  = Math.abs(gMod - INV_PHI);
    if (gDelta <= delta) nLessEq++;
  }
  const perm_p = nLessEq / N_PERM;

  return { label: cond.label, beta1, beta2, modulus, delta, r2, stable, roots, poolSize, perm_p };
}

// ── run ────────────────────────────────────────────────────────────────────────

console.log('Notch2 (ENSMUSG00000027878) AR(2) analysis — GSE157357 organoids');
console.log('φ⁻¹ = 1/φ =', INV_PHI.toFixed(4));
console.log('');

const results = [];
for (const cond of CONDITIONS) {
  process.stdout.write(`Analysing ${cond.label}...`);
  const r = analyseCondition(cond);
  if (r) { results.push(r); console.log(' done'); }
}

console.log('\n=== RESULTS ===');
console.log(`${'Condition'.padEnd(16)} ${'|λ|'.padEnd(8)} ${'Δ from 1/φ'.padEnd(12)} ${'R²'.padEnd(8)} ${'Roots'.padEnd(8)} ${'Pool'.padEnd(6)} ${'p (perm)'}`);
console.log('-'.repeat(80));
for (const r of results) {
  const sig = r.perm_p < 0.05 ? '✓' : (r.perm_p < 0.1 ? '~' : '');
  console.log(
    `${r.label.padEnd(16)} ${r.modulus.toFixed(4).padEnd(8)} ${r.delta.toFixed(4).padEnd(12)} ${r.r2.toFixed(3).padEnd(8)} ${r.roots.padEnd(8)} ${String(r.poolSize).padEnd(6)} ${r.perm_p.toFixed(4)} ${sig}`
  );
}

console.log('\n=== INTERPRETATION ===');
const wt     = results.find(r => r.label === 'WT-WT');
const apckow = results.find(r => r.label === 'ApcKO-WT');
const bmalkow = results.find(r => r.label === 'WT-BmalKO');
const double = results.find(r => r.label === 'ApcKO-BmalKO');

if (wt && apckow) {
  const shift = apckow.delta - wt.delta;
  console.log(`ApcKO-WT  shift (Δ−Δ_WT): ${shift > 0 ? '+' : ''}${shift.toFixed(4)} (${shift > 0 ? 'away from' : 'towards'} 1/φ)`);
}
if (wt && bmalkow) {
  const shift = bmalkow.delta - wt.delta;
  console.log(`WT-BmalKO shift (Δ−Δ_WT): ${shift > 0 ? '+' : ''}${shift.toFixed(4)} (${shift > 0 ? 'away from' : 'towards'} 1/φ)`);
}
if (wt && double) {
  const shift = double.delta - wt.delta;
  console.log(`DblKO     shift (Δ−Δ_WT): ${shift > 0 ? '+' : ''}${shift.toFixed(4)} (${shift > 0 ? 'away from' : 'towards'} 1/φ)`);
}

// Save JSON results
const outPath = 'scripts/notch2_gse157357_results.json';
fs.writeFileSync(outPath, JSON.stringify({ invPhi: INV_PHI, results }, null, 2));
console.log(`\nResults saved to ${outPath}`);
