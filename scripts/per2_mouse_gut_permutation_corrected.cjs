/**
 * Corrected Per2 mouse gut permutation test (GSE179027)
 *
 * ROOT CAUSE OF 0.6311 vs 0.5997 DISCREPANCY:
 *   - datasets/GSE179028/GSE179027_AR2_results.csv was generated from a
 *     log2-transformed version of the data (log2 |λ|≈0.596, very close to the
 *     file's 0.5997). All current scripts read raw TPM values from
 *     datasets/GSE179027_Mouse_Enteroid_circadian.csv, giving |λ|=0.6311.
 *   - The prior permutation (p=0.031) used Δ=0.018 from the log2-derived value.
 *     This script uses the canonical raw CSV consistently for both the focal
 *     gene and all pool genes.
 *
 * Method: identical to the prior test (10,000 expression-matched controls,
 * log2 mean ± 0.5 window, Δ from 1/φ as the statistic).
 */

'use strict';
const fs = require('fs');

const PHI     = (1 + Math.sqrt(5)) / 2;
const INV_PHI = 1 / PHI;   // ≈ 0.6180
const N_PERM  = 10000;
const EXPR_WINDOW = 0.5;   // ± 0.5 log2 units for expression matching

const FILE = 'datasets/GSE179027_Mouse_Enteroid_circadian.csv';

// ── helpers ──────────────────────────────────────────────────────────────────

function meanCentre(arr) {
  const mu = arr.reduce((s, v) => s + v, 0) / arr.length;
  return arr.map(v => v - mu);
}

function fitAR2(vals) {
  const y = meanCentre(vals);
  const n = y.length;
  if (n < 4) return null;
  let s11=0, s12=0, s22=0, sy1=0, sy2=0;
  for (let t = 2; t < n; t++) {
    s11 += y[t-1]*y[t-1]; s12 += y[t-1]*y[t-2]; s22 += y[t-2]*y[t-2];
    sy1 += y[t]*y[t-1];   sy2 += y[t]*y[t-2];
  }
  const det = s11*s22 - s12*s12;
  if (Math.abs(det) < 1e-14) return null;
  const b1 = (sy1*s22 - sy2*s12) / det;
  const b2 = (sy2*s11 - sy1*s12) / det;

  // R²
  const pred = y.slice(2).map((_, i) => b1*y[i+1] + b2*y[i]);
  const yVals = y.slice(2);
  const yMu   = yVals.reduce((s,v)=>s+v,0)/yVals.length;
  const ssRes = yVals.reduce((s,v,i) => s + (v-pred[i])**2, 0);
  const ssTot = yVals.reduce((s,v)   => s + (v-yMu)**2, 0);
  const r2    = ssTot > 1e-14 ? 1 - ssRes/ssTot : 0;

  const disc = b1*b1 + 4*b2;
  const mod  = disc >= 0
    ? Math.max(Math.abs((b1+Math.sqrt(disc))/2), Math.abs((b1-Math.sqrt(disc))/2))
    : Math.sqrt(-b2);

  const mean = vals.reduce((s,v)=>s+v,0)/vals.length;

  return { b1, b2, mod, r2, mean, log2mean: Math.log2(mean > 0 ? mean : 1e-9) };
}

// ── load and compute AR(2) for all genes ─────────────────────────────────────

console.log('Loading GSE179027 and computing AR(2) for all genes...');
const raw   = fs.readFileSync(FILE, 'utf-8').trim().split('\n');
const hdr   = raw[0].split(',');

const geneResults = [];
for (let i = 1; i < raw.length; i++) {
  const cols = raw[i].split(',');
  const gene = cols[0].trim();
  const vals = cols.slice(1).map(Number);
  if (vals.length < 4 || vals.some(isNaN)) continue;
  const fit = fitAR2(vals);
  if (!fit) continue;
  geneResults.push({ gene, ...fit });
}

console.log(`Computed AR(2) for ${geneResults.length} genes from raw CSV.`);

// ── Per2 focal result ─────────────────────────────────────────────────────────

const per2 = geneResults.find(g => g.gene === 'Per2');
if (!per2) { console.error('Per2 not found!'); process.exit(1); }

console.log(`\nPer2 (raw CSV, no log2):`);
console.log(`  β₁=${per2.b1.toFixed(6)}  β₂=${per2.b2.toFixed(6)}`);
console.log(`  |λ|=${per2.mod.toFixed(6)}  Δ=${Math.abs(per2.mod - INV_PHI).toFixed(6)}`);
console.log(`  R²=${per2.r2.toFixed(4)}  mean expr=${per2.mean.toFixed(4)}  log2mean=${per2.log2mean.toFixed(4)}`);

const per2Delta   = Math.abs(per2.mod - INV_PHI);
const per2Log2Mu  = per2.log2mean;

// ── Expression-matched pool ───────────────────────────────────────────────────

const pool = geneResults.filter(g =>
  g.gene !== 'Per2' &&
  Math.abs(g.log2mean - per2Log2Mu) <= EXPR_WINDOW &&
  isFinite(g.mod) &&
  g.mod >= 0 && g.mod <= 2
);

console.log(`\nExpression-matched pool (log2mean ± ${EXPR_WINDOW}):`);
console.log(`  Pool size: ${pool.length} genes`);
console.log(`  Per2 log2mean: ${per2Log2Mu.toFixed(4)}, window: [${(per2Log2Mu - EXPR_WINDOW).toFixed(4)}, ${(per2Log2Mu + EXPR_WINDOW).toFixed(4)}]`);

// Pool Δ distribution statistics
const poolDeltas = pool.map(g => Math.abs(g.mod - INV_PHI));
poolDeltas.sort((a, b) => a - b);
const poolBelow = poolDeltas.filter(d => d <= per2Delta).length;
const rawP      = poolBelow / pool.length;

console.log(`\nPermutation result (full pool, no resampling):`);
console.log(`  Per2 Δ = ${per2Delta.toFixed(6)}`);
console.log(`  Pool genes with Δ ≤ Per2's Δ: ${poolBelow} / ${pool.length}`);
console.log(`  p = ${rawP.toFixed(4)}`);

// ── Seeded permutation (10,000 draws) ────────────────────────────────────────

const A = 1664525, C_LCG = 1013904223;
function lcg(seed) {
  let s = seed >>> 0;
  return () => { s = (A*s + C_LCG) >>> 0; return s / 0x100000000; };
}

const rng      = lcg(42);
let nExceed    = 0;
const N_VALID  = Math.min(pool.length, N_PERM);

for (let i = 0; i < N_PERM; i++) {
  // Draw one random gene from pool
  const idx = Math.floor(rng() * pool.length);
  const d   = Math.abs(pool[idx].mod - INV_PHI);
  if (d <= per2Delta) nExceed++;
}

const permP = nExceed / N_PERM;

console.log(`\nPermutation test (${N_PERM} random draws with replacement):`);
console.log(`  Draws with Δ ≤ Per2's Δ: ${nExceed} / ${N_PERM}`);
console.log(`  p = ${permP.toFixed(4)}`);

// ── Comparison with prior result ──────────────────────────────────────────────

console.log('\n─────────────────────────────────────────────────────────────');
console.log('COMPARISON');
console.log('─────────────────────────────────────────────────────────────');
console.log(`  Prior result  : |λ|=0.5997 (log2-preprocessed), Δ=0.0183, pool=1541, p=0.031`);
console.log(`  Correct result: |λ|=${per2.mod.toFixed(4)} (raw TPM),         Δ=${per2Delta.toFixed(4)}, pool=${pool.length}, p=${permP.toFixed(4)}`);
console.log(`  Conclusion    : 0.6311 is the canonical value; p=${permP.toFixed(4)} is correct`);
console.log('─────────────────────────────────────────────────────────────');

// ── Save results ──────────────────────────────────────────────────────────────

const out = {
  method: 'Expression-matched permutation test from raw CSV (no log2 preprocessing)',
  dataset: 'GSE179027 (Mouse Intestinal Enteroid, Rosselot 2022)',
  focalGene: 'Per2',
  focalLambda: per2.mod,
  focalDelta: per2Delta,
  focalR2: per2.r2,
  focalBeta1: per2.b1,
  focalBeta2: per2.b2,
  focalMeanExpr: per2.mean,
  focalLog2Mean: per2.log2mean,
  poolSize: pool.length,
  expressionWindow: EXPR_WINDOW,
  nPermutations: N_PERM,
  nExceedPermutation: nExceed,
  permutationP: permP,
  poolExactP: rawP,
  genesInPoolBelowDelta: poolBelow,
  priorResult: {
    source: 'GSE179028/GSE179027_AR2_results.csv (log2-preprocessed)',
    lambda: 0.5997,
    delta: 0.0183,
    poolSize: 1541,
    permutationP: 0.0311,
    note: 'log2-derived value; inconsistent with all other script preprocessing'
  },
  rootCauseSummary: 'AR2 results CSV was generated with log2 transformation applied to raw TPM values. All current bootstrap/sampling-window scripts read raw TPM from GSE179027_Mouse_Enteroid_circadian.csv and get |λ|=0.6311. The canonical value is 0.6311 (Δ=0.013); the permutation should be cited with this value and the updated p-value.'
};

fs.writeFileSync('scripts/per2_mouse_gut_permutation_corrected_results.json', JSON.stringify(out, null, 2));
console.log('\nResults saved to scripts/per2_mouse_gut_permutation_corrected_results.json');
