/**
 * Run AR(2) OLS on Per2 (ENSMUSG00000055866) in GSE157357 WT-WT
 * to check whether Per2's high-amplitude circadian signal survives
 * the 22 h ZT24–ZT46 window in this dataset.
 *
 * Also tests log2(FPKM+1) preprocessing to determine whether
 * expression-unit normalisation rescues the AR(2) signal.
 *
 * Replicates the same pipeline as notch2_gse157357_ar2.cjs.
 */

'use strict';
const fs   = require('fs');
const path = require('path');

const PHI      = (1 + Math.sqrt(5)) / 2;
const INV_PHI  = 1 / PHI;              // ≈ 0.6180
const PER2_ID  = 'ENSMUSG00000055866';
const N_PERM   = 10000;
const LOG2_WIN = 0.5;

const WT_FILE  = 'datasets/GSE157357_Organoid_WT-WT_circadian.csv';

// ── helpers (identical to notch2 script) ─────────────────────────────────────

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

console.log('Per2 (ENSMUSG00000055866) AR(2) analysis — GSE157357 WT-WT');
console.log('φ⁻¹ = 1/φ =', INV_PHI.toFixed(4));
console.log('Comparison reference (GSE179027 22h truncated): |λ|=0.6396, R²=0.652, Δ=0.022');
console.log('');

process.stdout.write('Loading dataset...');
const data = parseCSV(WT_FILE);
console.log(' done');

const obs = data[PER2_ID];
if (!obs) {
  console.error(`ERROR: Per2 (${PER2_ID}) not found in dataset`);
  // List some gene IDs to help debug
  const keys = Object.keys(data).slice(0, 10);
  console.error('First 10 gene IDs in dataset:', keys);
  process.exit(1);
}

const collapsed = collapseReplicates(obs);
console.log(`Per2 ZT timepoints after averaging replicates: ${collapsed.map(r=>r.zt).join(', ')}`);
console.log(`Number of timepoints: ${collapsed.length}`);
const rawMeans = collapsed.map(r => r.mean);
console.log(`Mean expression (raw FPKM): ${(rawMeans.reduce((s,v)=>s+v,0)/rawMeans.length).toFixed(4)}`);

// ── RAW preprocessing (original) ─────────────────────────────────────────────

console.log('\n=== RAW FPKM — AR(2) FIT ===');
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

// ── LOG2(FPKM+1) preprocessing ───────────────────────────────────────────────

console.log('\n=== LOG2(FPKM+1) PREPROCESSING — AR(2) FIT ===');
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

// ── permutation test (log2) ───────────────────────────────────────────────────

process.stdout.write('\nRunning permutation test — log2(FPKM+1) (10,000 draws)...');

const per2LogMean_log2 = log2Mean(log2Means);  // log2 of already-log2 values (double-log) not desired;
// Use the log2 mean of the original raw values for expression matching
const per2LogMean_raw = log2Mean(rawMeans);
const allGenes = Object.keys(data).filter(g => g !== PER2_ID);
const pool_log2 = [];
for (const gene of allGenes) {
  const rawVals = collapseReplicates(data[gene]).map(r => r.mean);
  if (Math.abs(log2Mean(rawVals) - per2LogMean_raw) <= LOG2_WIN) {
    pool_log2.push(gene);
  }
}
console.log(` pool size = ${pool_log2.length}`);

let nLessEq_log2 = 0;
for (let i = 0; i < N_PERM; i++) {
  const g     = pool_log2[Math.floor(Math.random() * pool_log2.length)];
  const rawVals = collapseReplicates(data[g]).map(r => r.mean);
  const gLog2Vals = meanCentre(rawVals.map(v => Math.log2(v + 1)));
  const gFit  = fitAR2(gLog2Vals);
  if (!gFit || !isStable(gFit.beta1, gFit.beta2)) continue;
  const gMod  = eigenModulus(gFit.beta1, gFit.beta2);
  if (Math.abs(gMod - INV_PHI) <= delta_log2) nLessEq_log2++;
}
const perm_p_log2 = nLessEq_log2 / N_PERM;

console.log(`Permutation p (log2) = ${perm_p_log2.toFixed(4)} (${nLessEq_log2}/${N_PERM} controls closer or equal to 1/φ)`);

// ── permutation test (raw, for comparison) ────────────────────────────────────

process.stdout.write('\nRunning permutation test — raw FPKM (10,000 draws)...');

const pool_raw = [];
for (const gene of allGenes) {
  const rawVals = collapseReplicates(data[gene]).map(r => r.mean);
  if (Math.abs(log2Mean(rawVals) - per2LogMean_raw) <= LOG2_WIN) {
    pool_raw.push(gene);
  }
}
console.log(` pool size = ${pool_raw.length}`);

let nLessEq_raw = 0;
for (let i = 0; i < N_PERM; i++) {
  const g     = pool_raw[Math.floor(Math.random() * pool_raw.length)];
  const gVals = meanCentre(collapseReplicates(data[g]).map(r => r.mean));
  const gFit  = fitAR2(gVals);
  if (!gFit || !isStable(gFit.beta1, gFit.beta2)) continue;
  const gMod  = eigenModulus(gFit.beta1, gFit.beta2);
  if (Math.abs(gMod - INV_PHI) <= delta_raw) nLessEq_raw++;
}
const perm_p_raw = nLessEq_raw / N_PERM;
console.log(`Permutation p (raw)   = ${perm_p_raw.toFixed(4)} (${nLessEq_raw}/${N_PERM} controls closer or equal to 1/φ)`);

// ── interpretation ────────────────────────────────────────────────────────────

console.log('\n=== COMPARISON TABLE ===');
console.log(`Preprocessing        | |λ|    | Δ     | R²    | Roots   | Perm p`);
console.log(`---------------------|--------|-------|-------|---------|-------`);
console.log(`GSE179027 22h ref    | 0.6396 | 0.022 | 0.652 | complex | —     `);
console.log(`Raw FPKM             | ${modulus_raw.toFixed(4)} | ${delta_raw.toFixed(3)} | ${r2_raw.toFixed(3)} | ${roots_raw.padEnd(7)} | ${perm_p_raw.toFixed(4)}`);
console.log(`log2(FPKM+1)         | ${modulus_log2.toFixed(4)} | ${delta_log2.toFixed(3)} | ${r2_log2.toFixed(3)} | ${roots_log2.padEnd(7)} | ${perm_p_log2.toFixed(4)}`);

const r2Pass_log2    = r2_log2 > 0.4;
const deltaPass_log2 = delta_log2 < 0.05;
const r2Pass_raw     = r2_raw > 0.4;

console.log('\n=== INTERPRETATION ===');
console.log(`Raw FPKM:        R²=${r2_raw.toFixed(3)} ${r2Pass_raw ? 'PASS' : 'FAIL'}, Δ=${delta_raw.toFixed(4)} ${delta_raw < 0.05 ? 'PASS' : 'FAIL'}, p=${perm_p_raw.toFixed(4)} ${perm_p_raw < 0.05 ? 'PASS' : 'FAIL'}`);
console.log(`log2(FPKM+1):    R²=${r2_log2.toFixed(3)} ${r2Pass_log2 ? 'PASS' : 'FAIL'}, Δ=${delta_log2.toFixed(4)} ${delta_log2 < 0.05 ? 'PASS' : 'FAIL'}, p=${perm_p_log2.toFixed(4)} ${perm_p_log2 < 0.05 ? 'PASS' : 'FAIL'}`);

if (r2Pass_log2 && deltaPass_log2) {
  console.log('\nCONCLUSION: log2(FPKM+1) RESCUES Per2 (both R²>0.4 and Δ<0.05 pass).');
  console.log('log2 preprocessing partially rehabilitates GSE157357 for Per2 circadian analysis.');
  console.log('Dataset exclusion rationale should specify raw-FPKM only as the failing condition.');
} else if (r2Pass_log2 && !deltaPass_log2) {
  console.log('\nCONCLUSION: Partial rescue — R² improves above 0.4 with log2, but Δ does not reach <0.05.');
  console.log('log2 preprocessing improves fit quality but Per2 remains far from 1/φ.');
  console.log('GSE157357 is not reliable for Per2 eigenvalue estimation under either preprocessing.');
} else if (!r2Pass_raw && !r2Pass_log2) {
  console.log('\nCONCLUSION: NEITHER preprocessing rescues Per2. log2 does not improve the AR(2) fit.');
  console.log('GSE157357 exclusion is robust across raw and log2(FPKM+1) preprocessing.');
  console.log('Expression-unit differences from kallisto FPKM are not the primary cause of failure;');
  console.log('the 22 h window limitation combined with dataset-specific noise drives the collapse.');
} else {
  console.log('\nCONCLUSION: Partial result — see threshold checks above.');
}

// ── save results ──────────────────────────────────────────────────────────────

const outPath = 'scripts/per2_gse157357_results.json';
fs.writeFileSync(outPath, JSON.stringify({
  gene: 'Per2', ensemblId: PER2_ID, dataset: 'GSE157357_WT-WT',
  invPhi: INV_PHI,
  nTimepoints: collapsed.length,
  raw: {
    beta1: b1_raw, beta2: b2_raw, modulus: modulus_raw, delta: delta_raw,
    r2: r2_raw, roots: roots_raw, stable: stable_raw,
    permutation: { poolSize: pool_raw.length, nLessEq: nLessEq_raw, perm_p: perm_p_raw }
  },
  log2: {
    preprocessing: 'log2(FPKM+1)',
    beta1: b1_log2, beta2: b2_log2, modulus: modulus_log2, delta: delta_log2,
    r2: r2_log2, roots: roots_log2, stable: stable_log2,
    permutation: { poolSize: pool_log2.length, nLessEq: nLessEq_log2, perm_p: perm_p_log2 }
  },
  reference_gse179027_22h: { modulus: 0.6396, r2: 0.652, delta: 0.022 }
}, null, 2));
console.log(`\nResults saved to ${outPath}`);
