#!/usr/bin/env node
// AR(2) scan of cell-cycle genes in GSE161566 (human enteroid)
// Reports |λ|, Δ from 1/φ, R², roots type, and permutation p-value

const fs = require('fs');

const PHI = (1 + Math.sqrt(5)) / 2;
const PHI_RECIP = 1 / PHI; // ≈ 0.6180

// ─── Cell-cycle gene panel (canonical ~30 genes) ─────────────────────────────
const CELL_CYCLE_GENES = [
  // MCM family (DNA replication licensing)
  'MCM2','MCM3','MCM4','MCM5','MCM6','MCM7','MCM10',
  // CDKs
  'CDK1','CDK2','CDK4','CDK6','CDK7',
  // Cyclins
  'CCNA2','CCNB1','CCNB2','CCND1','CCND2','CCND3','CCNE1','CCNE2',
  // Spindle assembly checkpoint
  'MAD2L1','BUB1','BUB1B','BUB3','CDC20',
  // Proliferation / S-phase
  'MKI67','PCNA',
  // Kinases / aurora
  'PLK1','AURKA','AURKB',
  // G2/M checkpoint
  'WEE1','CHEK1','CHEK2',
  // CKIs
  'CDKN1A','CDKN1B','CDKN2A','CDKN3',
  // Rb pathway
  'RB1','E2F1','E2F2','E2F3',
  // CDCA family
  'CDCA3','CDCA5','CDCA8',
];

// ─── Parse CSV ────────────────────────────────────────────────────────────────
function parseCSV(path) {
  const lines = fs.readFileSync(path, 'utf8').trim().split('\n');
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

// ─── AR(2) OLS fit ────────────────────────────────────────────────────────────
function fitAR2(vals) {
  // Mean-centre
  const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
  const y = vals.map(v => v - mean);

  const n = y.length;
  if (n < 5) return null;

  // Build X matrix: [y_{t-1}, y_{t-2}] → y_t
  const responses = [];
  const predictors = [];
  for (let t = 2; t < n; t++) {
    responses.push(y[t]);
    predictors.push([y[t - 1], y[t - 2]]);
  }

  const m = responses.length;

  // OLS: (X'X)^{-1} X'y via 2x2 normal equations
  let s11 = 0, s12 = 0, s22 = 0, s1y = 0, s2y = 0;
  for (let i = 0; i < m; i++) {
    const x1 = predictors[i][0], x2 = predictors[i][1];
    s11 += x1 * x1; s12 += x1 * x2; s22 += x2 * x2;
    s1y += x1 * responses[i]; s2y += x2 * responses[i];
  }
  const det = s11 * s22 - s12 * s12;
  if (Math.abs(det) < 1e-15) return null;
  const phi1 = (s22 * s1y - s12 * s2y) / det;
  const phi2 = (s11 * s2y - s12 * s1y) / det;

  // Characteristic roots: λ² - φ₁λ - φ₂ = 0
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
  const yhat = predictors.map(p => phi1 * p[0] + phi2 * p[1]);
  const ss_res = responses.reduce((s, r, i) => s + (r - yhat[i]) ** 2, 0);
  const ss_tot = responses.reduce((s, r) => s + r * r, 0);
  const r2 = ss_tot > 0 ? 1 - ss_res / ss_tot : 0;

  return { phi1, phi2, lambda, isComplex, r2 };
}

// ─── Permutation test ─────────────────────────────────────────────────────────
function permTest(focalDelta, focalLogMean, allGenes, data, nPerm = 10000) {
  // Collect expression-matched pool (log2 mean ± 0.5)
  const pool = [];
  for (const gene of Object.keys(data)) {
    const vals = data[gene].vals;
    const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
    if (mean <= 0) continue;
    const logMean = Math.log2(mean);
    if (Math.abs(logMean - focalLogMean) <= 0.5) {
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

// Simple seeded RNG
function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const data = parseCSV('datasets/GSE161566_Human_Enteroid_circadian.csv');
console.log(`Dataset loaded: ${Object.keys(data).length} genes, ${Object.values(data)[0].timepoints.length} timepoints`);

const results = [];

for (const gene of CELL_CYCLE_GENES) {
  if (!data[gene]) {
    console.log(`  MISSING: ${gene}`);
    continue;
  }
  const fit = fitAR2(data[gene].vals);
  if (!fit) {
    console.log(`  FIT FAILED: ${gene}`);
    continue;
  }
  const delta = Math.abs(fit.lambda - PHI_RECIP);
  const vals = data[gene].vals;
  const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
  const logMean = Math.log2(mean);
  results.push({ gene, ...fit, delta, logMean, mean });
}

// Sort by delta
results.sort((a, b) => a.delta - b.delta);

console.log('\n=== AR(2) Scan — Cell Cycle Genes in GSE161566 ===');
console.log('sorted by Δ from 1/φ ≈ 0.6180\n');
console.log('Gene'.padEnd(12) + '|λ|'.padStart(8) + 'Δ'.padStart(8) + 'R²'.padStart(7) + ' Type'.padEnd(10) + 'logMean');
console.log('-'.repeat(55));

for (const r of results) {
  const type = r.isComplex ? 'complex' : 'real';
  console.log(
    r.gene.padEnd(12) +
    r.lambda.toFixed(4).padStart(8) +
    r.delta.toFixed(4).padStart(8) +
    r.r2.toFixed(3).padStart(7) +
    (' ' + type).padEnd(10) +
    r.logMean.toFixed(2)
  );
}

// ─── Permutation tests for top 10 candidates ─────────────────────────────────
console.log('\n=== Permutation Tests (top 10 by Δ) ===\n');
console.log('Gene'.padEnd(12) + '|λ|'.padStart(8) + 'Δ'.padStart(8) + 'R²'.padStart(7) + ' Pool'.padStart(8) + ' p-perm');
console.log('-'.repeat(55));

const top10 = results.slice(0, 10);
const permResults = [];

for (const r of top10) {
  const { p, poolSize } = permTest(r.delta, r.logMean, CELL_CYCLE_GENES, data, 10000);
  permResults.push({ ...r, p, poolSize });
  console.log(
    r.gene.padEnd(12) +
    r.lambda.toFixed(4).padStart(8) +
    r.delta.toFixed(4).padStart(8) +
    r.r2.toFixed(3).padStart(7) +
    poolSize.toString().padStart(8) +
    (' ' + p.toFixed(4)).padStart(8)
  );
}

// BH-FDR correction
permResults.sort((a, b) => a.p - b.p);
const n = permResults.length;
console.log('\n=== BH-FDR correction ===\n');
console.log('Rank  Gene        p        BH-adj   Pass?');
permResults.forEach((r, i) => {
  const adj = Math.min(1, r.p * n / (i + 1));
  const pass = adj < 0.05 ? '✓ q<0.05' : '';
  console.log(`${(i+1).toString().padStart(4)}  ${r.gene.padEnd(12)} ${r.p.toFixed(4).padStart(6)}   ${adj.toFixed(4).padStart(6)}   ${pass}`);
  r.bhAdj = adj;
});
