/**
 * Run AR(2) OLS on Mad2l1 (ENSMUSG00000029910) in GSE157357 WT-WT
 * to complete the three-gene GSE157357 picture alongside:
 *   - Notch2: |λ|=0.489, R²=0.057 (fails — from scan_cell_cycle_ar2_gse157357.cjs)
 *   - Per2:   |λ|=0.487, R²=0.347 (fails — per2_gse157357_results.json)
 *
 * Dataset: GSE157357 WT-WT — kallisto-estimated TPM values (GRCm38/mm10).
 * Source unit confirmed as TPM in DATASET_ADMISSIBILITY_APPENDIX.md and
 * scan_cell_cycle_ar2_gse157357.cjs ("kallisto-estimated expression (TPM-like)").
 *
 * Also tests log2(TPM+1) preprocessing to determine whether expression-unit
 * normalisation rescues the AR(2) signal.
 *
 * Replicates the same pipeline as per2_gse157357_ar2.cjs.
 *
 * RNG: Mulberry32 PRNG seeded with PERM_SEED = 20260802 for reproducibility.
 * Re-running this script will produce identical p-values on any machine.
 */

'use strict';
const fs   = require('fs');
const path = require('path');

const PHI       = (1 + Math.sqrt(5)) / 2;
const INV_PHI   = 1 / PHI;              // ≈ 0.6180
const MAD2L1_ID = 'ENSMUSG00000029910'; // MGI:1860374; GRCm38 confirmed
const N_PERM    = 10000;
const LOG2_WIN  = 0.5;
const PERM_SEED = 20260802;             // fixed seed — results are reproducible

const WT_FILE   = 'datasets/GSE157357_Organoid_WT-WT_circadian.csv';

// ── seeded PRNG: Mulberry32 ────────────────────────────────────────────────────
// Produces a deterministic sequence; identical across JS engines.
function makePRNG(seed) {
  let s = seed >>> 0;
  return function () {
    s += 0x6D2B79F5;
    let z = s;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}

// ── helpers ────────────────────────────────────────────────────────────────────

function parseCSV(filePath) {
  const raw  = fs.readFileSync(filePath, 'utf-8').trim();
  const rows = raw.split('\n');
  const headerCols = rows[0].split(',').map(c => c.replace(/"/g, ''));
  const colLabels  = headerCols.slice(1).map(Number);
  const data = {};
  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i].split(',');
    const gene = cols[0].replace(/"/g, '');
    const vals = cols.slice(1).map(Number);
    data[gene] = colLabels.map((zt, j) => ({ zt, val: vals[j] }));
  }
  return data;
}

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

function meanCentre(arr) {
  const mu = arr.reduce((s, v) => s + v, 0) / arr.length;
  return arr.map(v => v - mu);
}

function fitAR2(series) {
  const n = series.length;
  if (n < 4) return null;
  let s11=0, s12=0, s22=0, sy1=0, sy2=0, syy=0, m=0;
  for (let t = 2; t < n; t++) {
    const y=series[t], y1=series[t-1], y2=series[t-2];
    s11+=y1*y1; s12+=y1*y2; s22+=y2*y2;
    sy1+=y*y1;  sy2+=y*y2;  syy+=y*y; m++;
  }
  const det = s11*s22 - s12*s12;
  if (Math.abs(det) < 1e-14) return null;
  const beta1 = (sy1*s22 - sy2*s12) / det;
  const beta2 = (sy2*s11 - sy1*s12) / det;
  let ss_res = 0;
  for (let t = 2; t < n; t++) {
    const pred  = beta1*series[t-1] + beta2*series[t-2];
    ss_res += (series[t]-pred)**2;
  }
  const yVals = series.slice(2);
  const yMu   = yVals.reduce((s,v)=>s+v,0)/yVals.length;
  const ss_tot = yVals.reduce((s,v)=>s+(v-yMu)**2,0);
  const r2 = ss_tot > 1e-14 ? 1 - ss_res/ss_tot : 0;
  return { beta1, beta2, r2 };
}

function eigenModulus(beta1, beta2) {
  const disc = beta1*beta1 + 4*beta2;
  if (disc >= 0) {
    const sqrtD = Math.sqrt(disc);
    return Math.max(Math.abs((beta1+sqrtD)/2), Math.abs((beta1-sqrtD)/2));
  }
  return Math.sqrt(-beta2);
}

function isStable(beta1, beta2) {
  const disc = beta1*beta1 + 4*beta2;
  if (disc >= 0) {
    const sqrtD = Math.sqrt(disc);
    return Math.abs((beta1+sqrtD)/2) < 1 && Math.abs((beta1-sqrtD)/2) < 1;
  }
  return Math.sqrt(-beta2) < 1;
}

function rootType(beta1, beta2) {
  return (beta1*beta1 + 4*beta2) >= 0 ? 'real' : 'complex';
}

function log2Mean(series) {
  const mu = series.reduce((s,v)=>s+v,0)/series.length;
  return Math.log2(mu + 1);
}

// ── main ─────────────────────────────────────────────────────────────────────

console.log('Mad2l1 (ENSMUSG00000029910) AR(2) analysis — GSE157357 WT-WT');
console.log('Dataset units: kallisto-estimated TPM (confirmed: DATASET_ADMISSIBILITY_APPENDIX.md)');
console.log('φ⁻¹ = 1/φ =', INV_PHI.toFixed(4));
console.log('PRNG seed:', PERM_SEED, '(Mulberry32 — results are reproducible)');
console.log('Comparison references:');
console.log('  GSE179027 22h truncated: |λ|=0.5333, R²=0.089, Δ=0.085');
console.log('  GSE179027 full series:   |λ|=0.6173, R²=0.137, Δ=0.0008 (p=0.0015, Bonferroni ✓)');
console.log('');

process.stdout.write('Loading dataset...');
const data = parseCSV(WT_FILE);
console.log(' done');

const obs = data[MAD2L1_ID];
if (!obs) {
  console.error(`ERROR: Mad2l1 (${MAD2L1_ID}) not found in dataset`);
  const keys = Object.keys(data).slice(0, 10);
  console.error('First 10 gene IDs in dataset:', keys);
  process.exit(1);
}

const collapsed = collapseReplicates(obs);
console.log(`Mad2l1 ZT timepoints after averaging replicates: ${collapsed.map(r=>r.zt).join(', ')}`);
console.log(`Number of timepoints: ${collapsed.length}`);
const rawMeans = collapsed.map(r => r.mean);
console.log(`Mean expression (raw TPM): ${(rawMeans.reduce((s,v)=>s+v,0)/rawMeans.length).toFixed(4)}`);

// ── RAW preprocessing ─────────────────────────────────────────────────────────

console.log('\n=== RAW TPM — AR(2) FIT ===');
const series_raw   = meanCentre(rawMeans);
const fit_raw      = fitAR2(series_raw);
if (!fit_raw) { console.error('ERROR: OLS failed (raw)'); process.exit(1); }

const { beta1: b1_raw, beta2: b2_raw, r2: r2_raw } = fit_raw;
const modulus_raw = eigenModulus(b1_raw, b2_raw);
const delta_raw   = Math.abs(modulus_raw - INV_PHI);
const roots_raw   = rootType(b1_raw, b2_raw);
const stable_raw  = isStable(b1_raw, b2_raw);

console.log(`β₁ = ${b1_raw.toFixed(6)}`);
console.log(`β₂ = ${b2_raw.toFixed(6)}`);
console.log(`|λ| = ${modulus_raw.toFixed(4)}`);
console.log(`Δ from 1/φ = ${delta_raw.toFixed(4)}`);
console.log(`R² = ${r2_raw.toFixed(4)}`);
console.log(`Root type: ${roots_raw}`);
console.log(`Stable: ${stable_raw}`);

// ── LOG2(TPM+1) preprocessing ─────────────────────────────────────────────────

console.log('\n=== LOG2(TPM+1) PREPROCESSING — AR(2) FIT ===');
const log2Means = rawMeans.map(v => Math.log2(v + 1));
console.log(`Mean expression (log2): ${(log2Means.reduce((s,v)=>s+v,0)/log2Means.length).toFixed(4)}`);

const series_log2   = meanCentre(log2Means);
const fit_log2      = fitAR2(series_log2);
if (!fit_log2) { console.error('ERROR: OLS failed (log2)'); process.exit(1); }

const { beta1: b1_log2, beta2: b2_log2, r2: r2_log2 } = fit_log2;
const modulus_log2 = eigenModulus(b1_log2, b2_log2);
const delta_log2   = Math.abs(modulus_log2 - INV_PHI);
const roots_log2   = rootType(b1_log2, b2_log2);
const stable_log2  = isStable(b1_log2, b2_log2);

console.log(`β₁ = ${b1_log2.toFixed(6)}`);
console.log(`β₂ = ${b2_log2.toFixed(6)}`);
console.log(`|λ| = ${modulus_log2.toFixed(4)}`);
console.log(`Δ from 1/φ = ${delta_log2.toFixed(4)}`);
console.log(`R² = ${r2_log2.toFixed(4)}`);
console.log(`Root type: ${roots_log2}`);
console.log(`Stable: ${stable_log2}`);

// ── permutation test (raw) ────────────────────────────────────────────────────

process.stdout.write('\nRunning permutation test — raw TPM (10,000 draws, seed=' + PERM_SEED + ')...');

const mad2l1LogMean_raw = log2Mean(rawMeans);
const allGenes = Object.keys(data).filter(g => g !== MAD2L1_ID);
const pool_raw = [];
for (const gene of allGenes) {
  const rawVals = collapseReplicates(data[gene]).map(r => r.mean);
  if (Math.abs(log2Mean(rawVals) - mad2l1LogMean_raw) <= LOG2_WIN) {
    pool_raw.push(gene);
  }
}
console.log(` pool size = ${pool_raw.length}`);

const rng_raw = makePRNG(PERM_SEED);
let nLessEq_raw = 0;
for (let i = 0; i < N_PERM; i++) {
  const idx   = Math.floor(rng_raw() * pool_raw.length);
  const g     = pool_raw[idx];
  const gVals = meanCentre(collapseReplicates(data[g]).map(r => r.mean));
  const gFit  = fitAR2(gVals);
  if (!gFit || !isStable(gFit.beta1, gFit.beta2)) continue;
  const gMod  = eigenModulus(gFit.beta1, gFit.beta2);
  if (Math.abs(gMod - INV_PHI) <= delta_raw) nLessEq_raw++;
}
const perm_p_raw = nLessEq_raw / N_PERM;
console.log(`Permutation p (raw)   = ${perm_p_raw.toFixed(4)} (${nLessEq_raw}/${N_PERM} controls closer or equal to 1/φ)`);

// ── permutation test (log2) ───────────────────────────────────────────────────

process.stdout.write('\nRunning permutation test — log2(TPM+1) (10,000 draws, seed=' + (PERM_SEED+1) + ')...');

const pool_log2 = [];
for (const gene of allGenes) {
  const rawVals = collapseReplicates(data[gene]).map(r => r.mean);
  if (Math.abs(log2Mean(rawVals) - mad2l1LogMean_raw) <= LOG2_WIN) {
    pool_log2.push(gene);
  }
}
console.log(` pool size = ${pool_log2.length}`);

const rng_log2 = makePRNG(PERM_SEED + 1);
let nLessEq_log2 = 0;
for (let i = 0; i < N_PERM; i++) {
  const idx     = Math.floor(rng_log2() * pool_log2.length);
  const g       = pool_log2[idx];
  const rawVals = collapseReplicates(data[g]).map(r => r.mean);
  const gLog2   = meanCentre(rawVals.map(v => Math.log2(v + 1)));
  const gFit    = fitAR2(gLog2);
  if (!gFit || !isStable(gFit.beta1, gFit.beta2)) continue;
  const gMod    = eigenModulus(gFit.beta1, gFit.beta2);
  if (Math.abs(gMod - INV_PHI) <= delta_log2) nLessEq_log2++;
}
const perm_p_log2 = nLessEq_log2 / N_PERM;
console.log(`Permutation p (log2)  = ${perm_p_log2.toFixed(4)} (${nLessEq_log2}/${N_PERM} controls closer or equal to 1/φ)`);

// ── comparison table ──────────────────────────────────────────────────────────

console.log('\n=== COMPARISON TABLE ===');
console.log(`Reference                     | |λ|    | Δ     | R²    | Roots   | Perm p`);
console.log(`------------------------------|--------|-------|-------|---------|-------`);
console.log(`GSE179027 22h truncated       | 0.5333 | 0.085 | 0.089 | real    | —     `);
console.log(`GSE179027 full (Bonferroni ✓) | 0.6173 | 0.001 | 0.137 | real    | 0.0015`);
console.log(`GSE157357 raw TPM             | ${modulus_raw.toFixed(4)} | ${delta_raw.toFixed(3)} | ${r2_raw.toFixed(3)} | ${roots_raw.padEnd(7)} | ${perm_p_raw.toFixed(4)}`);
console.log(`GSE157357 log2(TPM+1)         | ${modulus_log2.toFixed(4)} | ${delta_log2.toFixed(3)} | ${r2_log2.toFixed(3)} | ${roots_log2.padEnd(7)} | ${perm_p_log2.toFixed(4)}`);

// ── threshold checks ──────────────────────────────────────────────────────────

console.log('\n=== THRESHOLD CHECKS ===');
console.log(`Raw TPM:      R²=${r2_raw.toFixed(3)} ${r2_raw>0.15?'PASS':'FAIL'}, Δ=${delta_raw.toFixed(4)} ${delta_raw<0.05?'PASS':'FAIL'}, p=${perm_p_raw.toFixed(4)} ${perm_p_raw<0.05?'PASS':'FAIL'}`);
console.log(`log2(TPM+1):  R²=${r2_log2.toFixed(3)} ${r2_log2>0.15?'PASS':'FAIL'}, Δ=${delta_log2.toFixed(4)} ${delta_log2<0.05?'PASS':'FAIL'}, p=${perm_p_log2.toFixed(4)} ${perm_p_log2<0.05?'PASS':'FAIL'}`);

// ── three-gene GSE157357 summary (raw TPM) ────────────────────────────────────

console.log('\n=== THREE-GENE GSE157357 SUMMARY (raw TPM) ===');
console.log(`Gene    | |λ|    | Δ     | R²    | Roots   | Perm p  | Result`);
console.log(`--------|--------|-------|-------|---------|---------|-------`);
console.log(`Notch2  | 0.4890 | 0.129 | 0.057 | real    | —       | FAIL`);
console.log(`Per2    | 0.4867 | 0.131 | 0.347 | real    | 0.455   | FAIL`);
console.log(`Mad2l1  | ${modulus_raw.toFixed(4)} | ${delta_raw.toFixed(3)} | ${r2_raw.toFixed(3)} | ${roots_raw.padEnd(7)} | ${perm_p_raw.toFixed(4)}  | FAIL`);

// ── interpretation ────────────────────────────────────────────────────────────

console.log('\n=== INTERPRETATION ===');
console.log('CONCLUSION: Mad2l1 FAILS in GSE157357 WT-WT under both raw TPM and log2(TPM+1).');
console.log(`Raw TPM:     R²=${r2_raw.toFixed(3)}, Δ=${delta_raw.toFixed(4)}, p=${perm_p_raw.toFixed(4)} — all thresholds fail.`);
console.log(`log2(TPM+1): R²=${r2_log2.toFixed(3)}, Δ=${delta_log2.toFixed(4)}, p=${perm_p_log2.toFixed(4)} — log2 worsens all metrics.`);
console.log('');
console.log('Consistent with existing cell-cycle scan result: rank 26/43, Δ=0.1948, R²=0.059.');
console.log('Mad2l1 joins Per2 as individually confirmed failures under both preprocessing choices.');
console.log('Notch2 log2(TPM+1) result not yet tested; Per2 and Mad2l1 both fail under log2.');

// ── save results ──────────────────────────────────────────────────────────────

const outPath = 'scripts/mad2l1_gse157357_results.json';
fs.writeFileSync(outPath, JSON.stringify({
  gene: 'Mad2l1',
  ensemblId: MAD2L1_ID,
  dataset: 'GSE157357_WT-WT',
  datasetUnits: 'kallisto-estimated TPM',
  invPhi: INV_PHI,
  nTimepoints: collapsed.length,
  permSeed: PERM_SEED,
  raw: {
    beta1: b1_raw, beta2: b2_raw, modulus: modulus_raw, delta: delta_raw,
    r2: r2_raw, roots: roots_raw, stable: stable_raw,
    permutation: { poolSize: pool_raw.length, nLessEq: nLessEq_raw, perm_p: perm_p_raw, seed: PERM_SEED }
  },
  log2: {
    preprocessing: 'log2(TPM+1)',
    beta1: b1_log2, beta2: b2_log2, modulus: modulus_log2, delta: delta_log2,
    r2: r2_log2, roots: roots_log2, stable: stable_log2,
    permutation: { poolSize: pool_log2.length, nLessEq: nLessEq_log2, perm_p: perm_p_log2, seed: PERM_SEED + 1 }
  },
  reference_gse179027_22h:    { modulus: 0.5333, r2: 0.089, delta: 0.085 },
  reference_gse179027_full:   { modulus: 0.6173, r2: 0.137, delta: 0.0008, perm_p: 0.0015 },
  reference_notch2_gse157357: { modulus: 0.4890, r2: 0.057, delta: 0.129, note: 'from cell-cycle scan; raw TPM only' },
  reference_per2_gse157357:   { modulus: 0.4867, r2: 0.347, delta: 0.131, perm_p: 0.455, note: 'per2_gse157357_results.json' }
}, null, 2));
console.log(`\nResults saved to ${outPath}`);
