'use strict';
/**
 * Compute AR(2) eigenvalue for Notch2 (ENSMUSG00000027878) in GSE157357 WT-WT
 * under log2(TPM+1) preprocessing. Mirrors the raw analysis in
 * notch2_gse157357_ar2.cjs but applies log2(x+1) before mean-centering.
 *
 * Output: updates scripts/notch2_gse157357_results.json with a "log2" entry
 * for the WT-WT condition.
 */

const fs   = require('fs');
const path = require('path');

const PHI       = (1 + Math.sqrt(5)) / 2;
const INV_PHI   = 1 / PHI;
const NOTCH2_ID = 'ENSMUSG00000027878';
const N_PERM    = 10000;
const LOG2_WIN  = 0.5;
const DATA_FILE = 'datasets/GSE157357_Organoid_WT-WT_circadian.csv';
const SEED      = 20260802;

// ── helpers ──────────────────────────────────────────────────────────────────

function parseCSV(filePath) {
  const rows = fs.readFileSync(filePath, 'utf-8').trim().split('\n');
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
  let s11=0,s12=0,s22=0,sy1=0,sy2=0;
  for (let t = 2; t < n; t++) {
    const y=series[t], y1=series[t-1], y2=series[t-2];
    s11+=y1*y1; s12+=y1*y2; s22+=y2*y2; sy1+=y*y1; sy2+=y*y2;
  }
  const det = s11*s22 - s12*s12;
  if (Math.abs(det) < 1e-14) return null;
  const beta1 = (sy1*s22 - sy2*s12) / det;
  const beta2 = (sy2*s11 - sy1*s12) / det;
  let ss_res = 0;
  for (let t = 2; t < n; t++) {
    const pred = beta1*series[t-1] + beta2*series[t-2];
    ss_res += (series[t]-pred)**2;
  }
  const yVals = series.slice(2);
  const yMu = yVals.reduce((s,v)=>s+v,0)/yVals.length;
  const ss_tot = yVals.reduce((s,v)=>s+(v-yMu)**2,0);
  const r2 = ss_tot > 1e-14 ? 1 - ss_res/ss_tot : 0;
  return { beta1, beta2, r2 };
}

function eigenModulus(beta1, beta2) {
  const disc = beta1*beta1 + 4*beta2;
  if (disc >= 0) {
    const sq = Math.sqrt(disc);
    return Math.max(Math.abs((beta1+sq)/2), Math.abs((beta1-sq)/2));
  }
  return Math.sqrt(-beta2);
}

function isStable(beta1, beta2) {
  const disc = beta1*beta1 + 4*beta2;
  if (disc >= 0) {
    const sq = Math.sqrt(disc);
    return Math.abs((beta1+sq)/2)<1 && Math.abs((beta1-sq)/2)<1;
  }
  return Math.sqrt(-beta2)<1;
}

function rootType(beta1, beta2) {
  return (beta1*beta1+4*beta2) >= 0 ? 'real' : 'complex';
}

// Simple seeded LCG for reproducibility
function makePRNG(seed) {
  let s = seed >>> 0;
  return function() {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ── main ──────────────────────────────────────────────────────────────────────

console.log('Notch2 GSE157357 WT-WT — log2(TPM+1) AR(2) analysis');
console.log('φ⁻¹ =', INV_PHI.toFixed(6));

const data = parseCSV(DATA_FILE);
const obs  = data[NOTCH2_ID];
if (!obs) { console.error('Notch2 not found in WT-WT dataset'); process.exit(1); }

// log2(TPM+1) transform on raw collapsed means
const collapsed = collapseReplicates(obs).map(r => r.mean);
const log2Series = meanCentre(collapsed.map(v => Math.log2(v + 1)));

const fit = fitAR2(log2Series);
if (!fit) { console.error('OLS failed'); process.exit(1); }

const { beta1, beta2, r2 } = fit;
const modulus = eigenModulus(beta1, beta2);
const delta   = Math.abs(modulus - INV_PHI);
const roots   = rootType(beta1, beta2);
const stable  = isStable(beta1, beta2);

console.log(`beta1=${beta1.toFixed(6)}, beta2=${beta2.toFixed(6)}`);
console.log(`|λ|=${modulus.toFixed(6)}, Δ=${delta.toFixed(6)}, R²=${r2.toFixed(4)}, roots=${roots}, stable=${stable}`);

// Expression-matched permutation using log2 means for matching
const notch2LogMean = collapsed.reduce((s,v)=>s+Math.log2(v+1),0)/collapsed.length;
const pool = Object.keys(data).filter(g => g !== NOTCH2_ID).filter(g => {
  const vals = collapseReplicates(data[g]).map(r => r.mean);
  const lm   = vals.reduce((s,v)=>s+Math.log2(v+1),0)/vals.length;
  return Math.abs(lm - notch2LogMean) <= LOG2_WIN;
});
console.log(`Pool size: ${pool.length}`);

const rng = makePRNG(SEED);
let nLessEq = 0;
for (let i = 0; i < N_PERM; i++) {
  const g     = pool[Math.floor(rng() * pool.length)];
  const gVals = meanCentre(collapseReplicates(data[g]).map(r => Math.log2(r.mean + 1)));
  const gFit  = fitAR2(gVals);
  if (!gFit || !isStable(gFit.beta1, gFit.beta2)) continue;
  const gMod  = eigenModulus(gFit.beta1, gFit.beta2);
  if (Math.abs(gMod - INV_PHI) <= delta) nLessEq++;
}
const perm_p = nLessEq / N_PERM;
console.log(`perm_p=${perm_p.toFixed(4)}, nLessEq=${nLessEq}`);

// ── update JSON ───────────────────────────────────────────────────────────────
const jsonPath  = 'scripts/notch2_gse157357_results.json';
const existing  = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

// Add/update log2 entry on the WT-WT result
const wtResult = existing.results.find(r => r.label === 'WT-WT');
if (!wtResult) { console.error('WT-WT result not found in JSON'); process.exit(1); }

wtResult.log2 = {
  preprocessing: 'log2(TPM+1)',
  beta1,
  beta2,
  modulus,
  delta,
  r2,
  roots,
  stable,
  poolSize: pool.length,
  perm_p,
  seed: SEED
};

fs.writeFileSync(jsonPath, JSON.stringify(existing, null, 2));
console.log('\nUpdated', jsonPath, 'with log2(TPM+1) WT-WT result');
