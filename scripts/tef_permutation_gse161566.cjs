/**
 * Expression-matched permutation test for TEF in GSE161566
 * (Human Intestinal Enteroid, 24 timepoints CH_24 → CH_70 in 2 h steps).
 *
 * Method matches scan_cell_cycle_ar2.cjs exactly:
 *   - Pool: all genes with log2(mean TPM) within ±0.5 of TEF (mean > 0).
 *     Pool size is the raw count before AR(2) filtering.
 *   - Permutation: 10,000 draws with replacement from pool (mulberry32 seed 42).
 *     For each draw, fit AR(2); skip invalid/explosive fits without counting them.
 *     Count draws with Δ ≤ TEF's Δ; p = count / 10,000.
 *   - BH-FDR: six focal-gene tests; TEF included as the newest.
 *
 * Reference: scan_cell_cycle_ar2.cjs (permutation helper); 
 *            notch2_bootstrap_stability.cjs (AR(2) helpers)
 */

'use strict';
const fs = require('fs');
const path = require('path');

// ── constants ─────────────────────────────────────────────────────────────────
const PHI      = (1 + Math.sqrt(5)) / 2;
const PHI_RECIP = 1 / PHI;               // ≈ 0.6180
const GENE     = 'TEF';
const N_PERM   = 10000;
const LOG_WIN  = 0.5;                    // ± log2 window for expression matching
const DATA_FILE = 'datasets/GSE161566_Human_Enteroid_circadian.csv';

// ── seeded RNG (mulberry32 — same as scan_cell_cycle_ar2.cjs) ─────────────────
function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ── helpers (identical to scan_cell_cycle_ar2.cjs) ────────────────────────────
function parseCSV(filePath) {
  const lines = fs.readFileSync(filePath, 'utf8').trim().split('\n');
  const header = lines[0].split(',');
  const timepoints = header.slice(1).map(h => parseFloat(h.replace('CH_', '')));
  const data = {};
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const gene = cols[0].trim();
    const vals = cols.slice(1).map(Number);
    data[gene] = { timepoints, vals };
  }
  return data;
}

function fitAR2(vals) {
  const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
  const y = vals.map(v => v - mean);
  const n = y.length;
  if (n < 5) return null;

  let s11 = 0, s12 = 0, s22 = 0, s1y = 0, s2y = 0;
  for (let t = 2; t < n; t++) {
    const x1 = y[t - 1], x2 = y[t - 2];
    s11 += x1 * x1; s12 += x1 * x2; s22 += x2 * x2;
    s1y += x1 * y[t]; s2y += x2 * y[t];
  }
  const det = s11 * s22 - s12 * s12;
  if (Math.abs(det) < 1e-15) return null;

  const phi1 = (s22 * s1y - s12 * s2y) / det;
  const phi2 = (s11 * s2y - s12 * s1y) / det;

  const disc = phi1 * phi1 + 4 * phi2;
  let lambda, isComplex;
  if (disc >= 0) {
    const r1 = (phi1 + Math.sqrt(disc)) / 2;
    const r2 = (phi1 - Math.sqrt(disc)) / 2;
    lambda = Math.max(Math.abs(r1), Math.abs(r2));
    isComplex = false;
  } else {
    lambda = Math.sqrt(-phi2);
    isComplex = true;
  }

  // R²
  const yhat = [];
  for (let t = 2; t < n; t++) yhat.push(phi1 * y[t-1] + phi2 * y[t-2]);
  const responses = y.slice(2);
  const ss_res = responses.reduce((s, r, i) => s + (r - yhat[i]) ** 2, 0);
  const ss_tot = responses.reduce((s, r) => s + r * r, 0);
  const r2 = ss_tot > 0 ? 1 - ss_res / ss_tot : 0;

  return { phi1, phi2, lambda, isComplex, r2 };
}

// ── Permutation (matches scan_cell_cycle_ar2.cjs exactly) ─────────────────────
function permTest(focalDelta, focalLogMean, data, nPerm) {
  // Pool: all genes with matching expression (pool size = raw count before AR(2))
  const pool = [];
  for (const gene of Object.keys(data)) {
    const vals = data[gene].vals;
    const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
    if (mean <= 0) continue;
    const logMean = Math.log2(mean);
    if (Math.abs(logMean - focalLogMean) <= LOG_WIN) {
      pool.push(gene);
    }
  }

  let nLessOrEqual = 0;
  const rng = mulberry32(42);
  for (let i = 0; i < nPerm; i++) {
    const idx = Math.floor(rng() * pool.length);
    const gene = pool[idx];
    const result = fitAR2(data[gene].vals);
    if (result && result.lambda >= 0 && result.lambda < 1) {
      const delta = Math.abs(result.lambda - PHI_RECIP);
      if (delta <= focalDelta) nLessOrEqual++;
    }
  }

  return { p: nLessOrEqual / nPerm, poolSize: pool.length };
}

// ── main ──────────────────────────────────────────────────────────────────────
console.log(`TEF expression-matched permutation test — GSE161566 Human Intestinal Enteroid`);
console.log(`φ⁻¹ = 1/φ = ${PHI_RECIP.toFixed(6)}`);
console.log(`Permutations: ${N_PERM.toLocaleString()}`);
console.log(`Expression window: log2(mean) ± ${LOG_WIN}`);
console.log(`RNG: mulberry32, seed 42 (same as scan_cell_cycle_ar2.cjs)`);
console.log('');

const data = parseCSV(DATA_FILE);
console.log(`Dataset: ${DATA_FILE}`);
console.log(`Total genes: ${Object.keys(data).length}`);
console.log('');

if (!data[GENE]) {
  console.error(`ERROR: ${GENE} not found in dataset`);
  process.exit(1);
}

// ── Focal gene: TEF ───────────────────────────────────────────────────────────
const tefFit = fitAR2(data[GENE].vals);
if (!tefFit) { console.error('AR(2) fit failed for TEF'); process.exit(1); }

const tefMod   = tefFit.lambda;
const tefDelta = Math.abs(tefMod - PHI_RECIP);
const tefMean  = data[GENE].vals.reduce((s, v) => s + v, 0) / data[GENE].vals.length;
const tefLogMu = Math.log2(tefMean);
const tefRoots = tefFit.isComplex ? 'complex' : 'real';

console.log(`=== TEF full-series AR(2) ===`);
console.log(`  |λ|          = ${tefMod.toFixed(6)}`);
console.log(`  Δ from 1/φ  = ${tefDelta.toFixed(6)}`);
console.log(`  R²           = ${tefFit.r2.toFixed(4)}`);
console.log(`  Roots        = ${tefRoots}`);
console.log(`  mean TPM    = ${tefMean.toFixed(3)}`);
console.log(`  log2(mean)  = ${tefLogMu.toFixed(4)}`);
console.log('');

// ── Run permutation ───────────────────────────────────────────────────────────
console.log('Running permutation test...');
const { p: pRaw, poolSize } = permTest(tefDelta, tefLogMu, data, N_PERM);

console.log('');
console.log('=== PERMUTATION RESULTS ===');
console.log(`  TEF  |λ| = ${tefMod.toFixed(6)}   Δ = ${tefDelta.toFixed(6)}`);
console.log(`  Pool size (raw, before AR(2)): ${poolSize}`);
console.log(`  N permutations: ${N_PERM.toLocaleString()}`);
console.log(`  p (permutation): ${pRaw.toFixed(4)}`);
console.log('');

// ── BH-FDR across six focal-gene tests ───────────────────────────────────────
console.log('=== BH-FDR CONTEXT (six focal-gene tests) ===');
const allPRaw = [
  { gene: 'Per2 (Cerebellum)',    p: 0.0011 },
  { gene: 'Hes1 (Hypothalamus)', p: 0.0017 },
  { gene: 'Mad2l1 (Mouse gut)',   p: 0.0015 },
  { gene: 'Wee1 (Liver)',         p: 0.0142 },
  { gene: 'NOTCH2 (Human gut)',   p: 0.0362 },
  { gene: 'TEF (Human gut)',      p: pRaw   },
];
const sorted_p = [...allPRaw].sort((a, b) => a.p - b.p);
const m = sorted_p.length;
console.log(`  m = ${m} tests`);
for (let i = 0; i < m; i++) {
  const { gene, p } = sorted_p[i];
  const q = Math.min(1, p * m / (i + 1));
  const pass = q < 0.05 ? '✓ BH q<0.05' : (q < 0.10 ? '~ BH q<0.10' : '✗ not significant');
  console.log(`  ${(i+1)}. ${gene.padEnd(25)} p=${p.toFixed(4)}  BH q=${q.toFixed(4)}  ${pass}`);
}

console.log('');
console.log('=== SUMMARY FOR MANUSCRIPT ===');
const bhQ = sorted_p.findIndex(x => x.gene.startsWith('TEF'));
// recalculate q for TEF properly
let tefBHQ = NaN;
for (let i = 0; i < m; i++) {
  if (sorted_p[i].gene.startsWith('TEF')) {
    tefBHQ = Math.min(1, sorted_p[i].p * m / (i + 1));
    break;
  }
}
console.log(`  Gene: TEF`);
console.log(`  Tissue: Human gut (GSE161566)`);
console.log(`  |λ|: ${tefMod.toFixed(4)}`);
console.log(`  Δ from 1/φ: ${tefDelta.toFixed(4)}`);
console.log(`  Pool size: ${poolSize}`);
console.log(`  p (raw): ${pRaw.toFixed(4)}`);
console.log(`  BH q (m=6): ${tefBHQ.toFixed(4)}`);
console.log(`  Passes BH q<0.05: ${tefBHQ < 0.05 ? 'YES' : 'NO'}`);
console.log(`  Passes BH q<0.10: ${tefBHQ < 0.10 ? 'YES' : 'NO'}`);

// ── save results ───────────────────────────────────────────────────────────────
const outPath = 'scripts/tef_permutation_gse161566_results.json';
fs.writeFileSync(outPath, JSON.stringify({
  gene: GENE,
  dataset: 'GSE161566',
  method: 'expression-matched permutation (matches scan_cell_cycle_ar2.cjs)',
  rng: 'mulberry32 seed 42',
  nTimepoints: Object.values(data)[0].timepoints.length,
  invPhi: PHI_RECIP,
  fullSeriesLambda: tefMod,
  fullSeriesDelta: tefDelta,
  r2: tefFit.r2,
  roots: tefRoots,
  tefMeanTPM: tefMean,
  tefLogMeanTPM: tefLogMu,
  expressionWindow: LOG_WIN,
  poolSize,
  nPermutations: N_PERM,
  pPermutation: pRaw,
  bhQ_m6: tefBHQ,
  passesBH05: tefBHQ < 0.05,
  passesBH10: tefBHQ < 0.10,
}, null, 2));
console.log(`\nResults saved to ${outPath}`);
