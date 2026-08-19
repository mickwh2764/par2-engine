/**
 * TEF mouse gut permutation test (GSE179027)
 *
 * Tests whether TEF's AR(2) eigenvalue proximity to 1/φ in mouse intestinal
 * enteroid (GSE179027) is significantly closer than expression-matched controls.
 *
 * Method: identical to per2_mouse_gut_permutation_corrected.cjs —
 *   raw TPM values (no log2), 10,000 expression-matched draws,
 *   pool = log2 mean ± 0.5, Δ from 1/φ as the statistic.
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

// ── TEF focal result ──────────────────────────────────────────────────────────

const tef = geneResults.find(g => g.gene === 'Tef');
if (!tef) { console.error('Tef not found!'); process.exit(1); }

console.log(`\nTef (raw CSV, no log2):`);
console.log(`  β₁=${tef.b1.toFixed(6)}  β₂=${tef.b2.toFixed(6)}`);
console.log(`  |λ|=${tef.mod.toFixed(6)}  Δ=${Math.abs(tef.mod - INV_PHI).toFixed(6)}`);
console.log(`  R²=${tef.r2.toFixed(4)}  mean expr=${tef.mean.toFixed(4)}  log2mean=${tef.log2mean.toFixed(4)}`);

const tefDelta   = Math.abs(tef.mod - INV_PHI);
const tefLog2Mu  = tef.log2mean;

// ── Expression-matched pool ───────────────────────────────────────────────────

const pool = geneResults.filter(g =>
  g.gene !== 'Tef' &&
  Math.abs(g.log2mean - tefLog2Mu) <= EXPR_WINDOW &&
  isFinite(g.mod) &&
  g.mod >= 0 && g.mod <= 2
);

console.log(`\nExpression-matched pool (log2mean ± ${EXPR_WINDOW}):`);
console.log(`  Pool size: ${pool.length} genes`);
console.log(`  Tef log2mean: ${tefLog2Mu.toFixed(4)}, window: [${(tefLog2Mu - EXPR_WINDOW).toFixed(4)}, ${(tefLog2Mu + EXPR_WINDOW).toFixed(4)}]`);

// Pool Δ distribution statistics
const poolDeltas = pool.map(g => Math.abs(g.mod - INV_PHI));
poolDeltas.sort((a, b) => a - b);
const poolBelow = poolDeltas.filter(d => d <= tefDelta).length;
const rawP      = poolBelow / pool.length;

console.log(`\nPool result (full pool, no resampling):`);
console.log(`  Tef Δ = ${tefDelta.toFixed(6)}`);
console.log(`  Pool genes with Δ ≤ Tef's Δ: ${poolBelow} / ${pool.length}`);
console.log(`  p = ${rawP.toFixed(4)}`);

// ── Seeded permutation (10,000 draws) ────────────────────────────────────────

const A = 1664525, C_LCG = 1013904223;
function lcg(seed) {
  let s = seed >>> 0;
  return () => { s = (A*s + C_LCG) >>> 0; return s / 0x100000000; };
}

const rng      = lcg(42);
let nExceed    = 0;

for (let i = 0; i < N_PERM; i++) {
  const idx = Math.floor(rng() * pool.length);
  const d   = Math.abs(pool[idx].mod - INV_PHI);
  if (d <= tefDelta) nExceed++;
}

const permP = nExceed / N_PERM;

console.log(`\nPermutation test (${N_PERM} random draws with replacement):`);
console.log(`  Draws with Δ ≤ Tef's Δ: ${nExceed} / ${N_PERM}`);
console.log(`  p = ${permP.toFixed(4)}`);

// ── BH correction in the 8-test family ───────────────────────────────────────
// Existing 8 p-values (sorted): 0.0011, 0.0015, 0.0017, 0.032, 0.036, 0.061, 0.065, 0.113
// Adding TEF mouse gut as 9th test

const existingPs = [0.0011, 0.0015, 0.0017, 0.032, 0.036, 0.061, 0.065, 0.113];
const allPs = [...existingPs, permP].sort((a,b) => a-b);
const m = allPs.length;
const bhQ = allPs.map((p, k) => Math.min(1, p * m / (k+1)));
// Apply step-down: q[i] = min(q[i], q[i+1], ...)
for (let i = m-2; i >= 0; i--) bhQ[i] = Math.min(bhQ[i], bhQ[i+1]);

const tefRank = allPs.indexOf(permP) + 1;
const tefBhQ  = bhQ[allPs.indexOf(permP)];

console.log(`\nBH correction (9-test family, including all prior tests + TEF mouse gut):`);
console.log(`  Sorted p-values: ${allPs.map(p=>p.toFixed(4)).join(', ')}`);
console.log(`  BH q-values:     ${bhQ.map(q=>q.toFixed(4)).join(', ')}`);
console.log(`  TEF mouse gut rank: ${tefRank}/${m}, BH q = ${tefBhQ.toFixed(4)}`);
console.log(`  TEF mouse gut passes BH q<0.05? ${tefBhQ < 0.05 ? 'YES ✓' : 'NO (directional only)'}`);

// ── Summary ───────────────────────────────────────────────────────────────────

console.log('\n─────────────────────────────────────────────────────────────');
console.log('SUMMARY');
console.log('─────────────────────────────────────────────────────────────');
console.log(`  Gene       : Tef (mouse intestinal enteroid, GSE179027)`);
console.log(`  |λ|        : ${tef.mod.toFixed(4)}`);
console.log(`  Δ from 1/φ : ${tefDelta.toFixed(4)}`);
console.log(`  R²         : ${tef.r2.toFixed(4)}`);
console.log(`  β₁         : ${tef.b1.toFixed(6)}`);
console.log(`  β₂         : ${tef.b2.toFixed(6)}`);
console.log(`  Pool size  : ${pool.length}`);
console.log(`  Perm p     : ${permP.toFixed(4)}`);
console.log(`  BH q (9-test family): ${tefBhQ.toFixed(4)}`);
console.log('─────────────────────────────────────────────────────────────');

// ── Save results ──────────────────────────────────────────────────────────────

const out = {
  method: 'Expression-matched permutation test from raw CSV (no log2 preprocessing)',
  dataset: 'GSE179027 (Mouse Intestinal Enteroid, Rosselot 2022)',
  focalGene: 'Tef',
  focalLambda: tef.mod,
  focalDelta: tefDelta,
  focalR2: tef.r2,
  focalBeta1: tef.b1,
  focalBeta2: tef.b2,
  focalMeanExpr: tef.mean,
  focalLog2Mean: tef.log2mean,
  poolSize: pool.length,
  expressionWindow: EXPR_WINDOW,
  nPermutations: N_PERM,
  nExceedPermutation: nExceed,
  permutationP: permP,
  poolExactP: rawP,
  genesInPoolBelowDelta: poolBelow,
  bhQ_9testFamily: tefBhQ,
  passesQ05: tefBhQ < 0.05
};

fs.writeFileSync('scripts/tef_mouse_gut_permutation_results.json', JSON.stringify(out, null, 2));
console.log('\nResults saved to scripts/tef_mouse_gut_permutation_results.json');
