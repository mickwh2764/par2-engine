/**
 * Wee1 liver permutation test — GSE54650, WITH log2 preprocessing
 *
 * CONTEXT:
 *   The original permutation (|λ|=0.6151) was run without log2 transformation.
 *   GSE54650 standard preprocessing is log2(x) before mean-centring (confirmed
 *   by Appendix C audit and bootstrap script). This script re-runs the test with
 *   the canonical log2 → mean-centre → OLS AR(2) pipeline.
 *
 * Method: expression-matched permutation (10,000 controls).
 *   - log2-transform all raw intensities.
 *   - Compute AR(2) OLS on mean-centred log2 series.
 *   - Pool: all genes with log2-mean within ±0.5 of Wee1's log2-mean.
 *   - Statistic: |Δ| = | |λ| − 1/φ |.
 *   - p = fraction of pool genes with Δ ≤ focal gene's Δ.
 */

'use strict';
const fs = require('fs');

const PHI        = (1 + Math.sqrt(5)) / 2;
const INV_PHI    = 1 / PHI;        // ≈ 0.6180
const EXPR_WINDOW = 0.5;           // ±0.5 log2 units for expression matching
const GENE       = 'Wee1';
const LIVER_FILE = 'datasets/GSE54650_Liver_circadian.csv';

// ── helpers ──────────────────────────────────────────────────────────────────

function log2Transform(arr) {
  return arr.map(v => (v > 0 ? Math.log2(v) : 0));
}

function meanCentre(arr) {
  const mu = arr.reduce((s, v) => s + v, 0) / arr.length;
  return arr.map(v => v - mu);
}

function fitAR2log2(rawVals) {
  if (!rawVals || rawVals.length < 4) return null;
  const log2Vals = log2Transform(rawVals);
  const y        = meanCentre(log2Vals);
  const n        = y.length;

  let s11=0, s12=0, s22=0, sy1=0, sy2=0;
  for (let t = 2; t < n; t++) {
    s11 += y[t-1]*y[t-1]; s12 += y[t-1]*y[t-2]; s22 += y[t-2]*y[t-2];
    sy1 += y[t]*y[t-1];   sy2 += y[t]*y[t-2];
  }
  const det = s11*s22 - s12*s12;
  if (Math.abs(det) < 1e-14) return null;
  const b1 = (sy1*s22 - sy2*s12) / det;
  const b2 = (sy2*s11 - sy1*s12) / det;

  const disc = b1*b1 + 4*b2;
  const mod  = disc >= 0
    ? Math.max(Math.abs((b1 + Math.sqrt(disc)) / 2), Math.abs((b1 - Math.sqrt(disc)) / 2))
    : Math.sqrt(-b2);

  if (!isFinite(mod) || mod > 2) return null;

  // R²
  const pred  = y.slice(2).map((_, i) => b1*y[i+1] + b2*y[i]);
  const yVals = y.slice(2);
  const yMu   = yVals.reduce((s,v)=>s+v,0) / yVals.length;
  const ssRes = yVals.reduce((s,v,i) => s + (v-pred[i])**2, 0);
  const ssTot = yVals.reduce((s,v)   => s + (v-yMu)**2, 0);
  const r2    = ssTot > 1e-14 ? 1 - ssRes/ssTot : 0;

  // log2-mean of the raw values (for expression matching)
  const rawMean   = rawVals.reduce((s,v)=>s+v,0) / rawVals.length;
  const log2mean  = Math.log2(rawMean > 0 ? rawMean : 1e-9);

  return { b1, b2, mod, r2, log2mean };
}

// ── load data ────────────────────────────────────────────────────────────────

console.log('='.repeat(72));
console.log('WEE1 LIVER PERMUTATION TEST — GSE54650 (log2 preprocessing)');
console.log(`φ⁻¹ = 1/φ = ${INV_PHI.toFixed(4)}`);
console.log('='.repeat(72));
console.log('');

const rawCSV  = fs.readFileSync(LIVER_FILE, 'utf-8').trim().split('\n');
const header  = rawCSV[0].split(',');
const tpCols  = header.slice(1);

console.log(`Dataset    : ${LIVER_FILE}`);
console.log(`Timepoints : ${tpCols[0]}–${tpCols[tpCols.length-1]} (${tpCols.length} points at 2h spacing)`);
console.log('');

// Fit AR(2) with log2 for every gene
const geneResults = [];
for (let i = 1; i < rawCSV.length; i++) {
  const cols = rawCSV[i].split(',');
  const gene = cols[0].trim();
  const vals = cols.slice(1).map(Number);
  if (vals.some(isNaN) || vals.length < 4) continue;
  const fit = fitAR2log2(vals);
  if (!fit) continue;
  geneResults.push({ gene, ...fit });
}

console.log(`Total genes computed: ${geneResults.length}`);

// ── Focal gene ───────────────────────────────────────────────────────────────

const focal = geneResults.find(g => g.gene === GENE);
if (!focal) {
  console.error(`ERROR: ${GENE} not found!`);
  process.exit(1);
}

const focalDelta = Math.abs(focal.mod - INV_PHI);

console.log('');
console.log(`Focal gene : ${GENE}`);
console.log(`  β₁       = ${focal.b1.toFixed(6)}`);
console.log(`  β₂       = ${focal.b2.toFixed(6)}`);
console.log(`  |λ|      = ${focal.mod.toFixed(6)}`);
console.log(`  Δ        = ${focalDelta.toFixed(6)}`);
console.log(`  R²       = ${focal.r2.toFixed(4)}`);
console.log(`  log2mean = ${focal.log2mean.toFixed(4)}`);
console.log('');

// ── Expression-matched pool ───────────────────────────────────────────────────

const pool = geneResults.filter(g =>
  g.gene !== GENE &&
  Math.abs(g.log2mean - focal.log2mean) <= EXPR_WINDOW &&
  isFinite(g.mod)
);

console.log(`Expression-matched pool (log2mean ± ${EXPR_WINDOW}):`);
console.log(`  Pool size : ${pool.length} genes`);
console.log(`  Window    : [${(focal.log2mean - EXPR_WINDOW).toFixed(4)}, ${(focal.log2mean + EXPR_WINDOW).toFixed(4)}]`);
console.log('');

if (pool.length === 0) {
  console.error('ERROR: Empty pool — cannot compute permutation p-value.');
  process.exit(1);
}

// ── Permutation test ──────────────────────────────────────────────────────────
// p = fraction of pool genes with Δ ≤ focal Δ (one-tailed)

const poolDeltas  = pool.map(g => Math.abs(g.mod - INV_PHI));
const nAtLeastAs  = poolDeltas.filter(d => d <= focalDelta).length;
const rawP        = nAtLeastAs / pool.length;

// BH-FDR context: this test is one of m=8 total three-oscillator permutation tests
// (Per2 Cerebellum, Hes1 Hypothalamus, Mad2l1 mouse gut, Wee1 liver,
//  NOTCH2 human gut, Per2 mouse gut, TEF human gut, Notch2 mouse gut)
const M_TESTS = 8;
const ALPHA   = 0.05;

// Rank this p among the 8 tests and compute BH threshold at this rank
// Using approximate BH: p ≤ (k/m) * α where k is rank (1-indexed by sorted p)
// For a single test in isolation, BH-adjusted q = p * m / k (min over k)
// We just report the raw p and note BH context.

console.log('='.repeat(72));
console.log('PERMUTATION RESULT');
console.log('='.repeat(72));
console.log(`Wee1 |λ| (log2)  : ${focal.mod.toFixed(4)}`);
console.log(`Wee1 Δ from 1/φ  : ${focalDelta.toFixed(4)}`);
console.log(`Pool size        : ${pool.length}`);
console.log(`Pool genes ≤ Δ   : ${nAtLeastAs}`);
console.log(`p (permutation)  : ${rawP.toFixed(4)}`);
console.log(`BH context       : ${M_TESTS} total tests, α=0.05`);

// Compare with original (no-log2) result
console.log('');
console.log('COMPARISON WITH ORIGINAL PERMUTATION (no log2):');
console.log('  Original |λ|  = 0.6151  Δ=0.0030  pool=3,648  p=0.0142');
console.log(`  Corrected |λ| = ${focal.mod.toFixed(4)}  Δ=${focalDelta.toFixed(4)}  pool=${pool.length}  p=${rawP.toFixed(4)}`);
console.log('');

// ── Save results ──────────────────────────────────────────────────────────────

const result = {
  gene: GENE,
  tissue: 'Liver',
  dataset: 'GSE54650',
  species: 'Mouse',
  preprocessing: 'log2(x) then mean-centre (GSE54650 canonical)',
  timepoints: tpCols.length,
  ctRange: `${tpCols[0]}–${tpCols[tpCols.length-1]}`,
  focalLambda: focal.mod,
  focalDelta: focalDelta,
  focalBeta1: focal.b1,
  focalBeta2: focal.b2,
  focalR2: focal.r2,
  focalLog2mean: focal.log2mean,
  exprWindow: EXPR_WINDOW,
  poolSize: pool.length,
  poolGenesAtLeastAsExtreme: nAtLeastAs,
  pPermutation: rawP,
  bhContextNTests: M_TESTS,
  comparison: {
    original_no_log2: { lambda: 0.6151, delta: 0.0030, poolSize: 3648, p: 0.0142, note: 'original pipeline without log2' },
  },
};

const outPath = 'scripts/wee1_liver_permutation_log2_results.json';
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
console.log(`Results saved to ${outPath}`);
