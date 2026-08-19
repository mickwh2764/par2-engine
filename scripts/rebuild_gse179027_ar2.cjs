/**
 * Rebuild datasets/GSE179028/GSE179027_AR2_results.csv from raw TPM.
 *
 * The previous file was generated from log2-transformed TPM values.
 * This script recomputes AR(2) eigenvalues from the raw (untransformed)
 * TPM values in datasets/GSE179027_Mouse_Enteroid_circadian.csv, using
 * exactly the same OLS AR(2) pipeline as focal_genes_bootstrap_stability.cjs.
 *
 * Columns preserved: b1, b2, modulus, root_type, r2, gene, mean_expr, category
 * Category assignments are carried over from the old CSV where available.
 */

'use strict';
const fs = require('fs');
const path = require('path');

const RAW_CSV   = 'datasets/GSE179027_Mouse_Enteroid_circadian.csv';
const OLD_CSV   = 'datasets/GSE179028/GSE179027_AR2_results.csv';
const OUT_CSV   = 'datasets/GSE179028/GSE179027_AR2_results.csv';
const ARCH_CSV  = 'datasets/GSE179028/GSE179027_AR2_results_log2_archive.csv';

// ── helpers ────────────────────────────────────────────────────────────────────

function meanCentre(arr) {
  const mu = arr.reduce((s, v) => s + v, 0) / arr.length;
  return arr.map(v => v - mu);
}

/**
 * Fit AR(2) via OLS on an already mean-centred series.
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

/** R² of the AR(2) fit (prediction t=2..N-1 on mean-centred series) */
function computeR2(yc, beta1, beta2) {
  const n = yc.length;
  // subset y for t=2..N-1
  let ssRes = 0, ssTot = 0;
  let sumY = 0;
  for (let t = 2; t < n; t++) sumY += yc[t];
  const muY = sumY / (n - 2);
  for (let t = 2; t < n; t++) {
    const pred = beta1 * yc[t - 1] + beta2 * yc[t - 2];
    ssRes += (yc[t] - pred) ** 2;
    ssTot += (yc[t] - muY)  ** 2;
  }
  if (ssTot < 1e-20) return 0;
  return Math.max(0, 1 - ssRes / ssTot);
}

/** root_type: real if discriminant >= 0, else complex */
function rootType(beta1, beta2) {
  return (beta1 * beta1 + 4 * beta2) >= 0 ? 'real' : 'complex';
}

// ── load category mapping from old CSV ─────────────────────────────────────────

const categoryMap = new Map();
{
  const lines = fs.readFileSync(OLD_CSV, 'utf-8').trim().split('\n');
  // header: b1,b2,modulus,root_type,r2,gene,mean_expr,category
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 8) continue;
    const gene     = cols[5].trim();
    const category = cols[7].trim();
    categoryMap.set(gene, category);
  }
}
console.log(`Loaded ${categoryMap.size} category assignments from old CSV.`);

// ── archive old CSV ─────────────────────────────────────────────────────────────

if (!fs.existsSync(ARCH_CSV)) {
  fs.copyFileSync(OLD_CSV, ARCH_CSV);
  console.log(`Archived old (log2) CSV to ${ARCH_CSV}`);
} else {
  console.log(`Archive already exists at ${ARCH_CSV}, skipping copy.`);
}

// ── parse raw TPM CSV ──────────────────────────────────────────────────────────

const rawLines  = fs.readFileSync(RAW_CSV, 'utf-8').trim().split('\n');
const rawHeader = rawLines[0].split(',');
// columns: gene, ZT24, ZT26, …, ZT70  (24 time points)
const nTP = rawHeader.length - 1;
console.log(`Raw TPM CSV: ${rawLines.length - 1} genes, ${nTP} time points.`);

// ── compute AR(2) for every gene ────────────────────────────────────────────────

const outRows = ['b1,b2,modulus,root_type,r2,gene,mean_expr,category'];
let nOk = 0, nFail = 0;

// Spot-check genes
const SPOT = ['Per2', 'Axin2', 'Arntl'];
const spotResults = {};

for (let i = 1; i < rawLines.length; i++) {
  const cols = rawLines[i].split(',');
  const gene = cols[0].trim();
  const vals = cols.slice(1).map(Number);

  if (vals.length !== nTP || vals.some(isNaN)) {
    nFail++;
    continue;
  }

  const mean_expr = vals.reduce((s, v) => s + v, 0) / vals.length;
  const yc        = meanCentre(vals);
  const fit       = fitAR2(yc);
  if (!fit) { nFail++; continue; }

  const { beta1, beta2 } = fit;
  const modulus  = eigenModulus(beta1, beta2);
  const rt       = rootType(beta1, beta2);
  const r2       = computeR2(yc, beta1, beta2);
  const category = categoryMap.get(gene) ?? 'other';

  if (SPOT.includes(gene)) {
    spotResults[gene] = { beta1, beta2, modulus, r2, mean_expr };
  }

  outRows.push(`${beta1},${beta2},${modulus},${rt},${r2},${gene},${mean_expr},${category}`);
  nOk++;
}

console.log(`\nProcessed: ${nOk} genes OK, ${nFail} failed.`);

// ── write new CSV ───────────────────────────────────────────────────────────────

fs.writeFileSync(OUT_CSV, outRows.join('\n') + '\n', 'utf-8');
console.log(`\nNew CSV written to ${OUT_CSV} (${outRows.length - 1} gene rows).`);

// ── spot-check ─────────────────────────────────────────────────────────────────

const PHI     = (1 + Math.sqrt(5)) / 2;
const INV_PHI = 1 / PHI;

console.log('\n── SPOT CHECK ──────────────────────────────────────────────────────');
console.log('Gene'.padEnd(8) + 'b1'.padEnd(10) + 'b2'.padEnd(10) +
            '|λ| (new)'.padEnd(12) + 'Δ from 1/φ'.padEnd(14) + 'R²');
console.log('-'.repeat(65));
for (const g of SPOT) {
  if (!spotResults[g]) {
    console.log(`${g}: NOT FOUND`);
    continue;
  }
  const r = spotResults[g];
  const delta = Math.abs(r.modulus - INV_PHI);
  console.log(
    g.padEnd(8) +
    r.beta1.toFixed(4).padEnd(10) +
    r.beta2.toFixed(4).padEnd(10) +
    r.modulus.toFixed(4).padEnd(12) +
    delta.toFixed(4).padEnd(14) +
    r.r2.toFixed(4)
  );
}
console.log(`\n1/φ = ${INV_PHI.toFixed(4)}`);
console.log('Per2 canonical |λ| from raw TPM: 0.6311 (memory note per2-gse179027-canonical.md)');
console.log('Done.');
