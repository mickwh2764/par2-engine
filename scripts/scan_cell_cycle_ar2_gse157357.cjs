#!/usr/bin/env node
/**
 * AR(2) cell-cycle scan on GSE157357 WT-WT condition
 * Independent replication dataset for the MCM S-phase cluster finding
 *
 * GSE157357: Mouse intestinal organoid (WT-WT arm)
 * 12 timepoints ZT24–ZT46 (22 h window, 2 h steps, biological replicates averaged)
 * Data: kallisto-estimated expression (TPM-like, GRCm38/mm10 ENSEMBL IDs)
 *
 * Method: identical to scan_cell_cycle_ar2_mouse.cjs except:
 *   - Dataset uses ENSEMBL IDs → gene-symbol map required
 *   - Biological replicates averaged per ZT before AR(2)
 *   - Short window noted as a key caveat
 */

'use strict';
const fs = require('fs');
const PHI = (1 + Math.sqrt(5)) / 2;
const PHI_RECIP = 1 / PHI; // ≈ 0.6180

// ─── ENSEMBL ID → gene symbol map (GRCm38/mm10) ─────────────────────────────
// All confirmed from codebase (server/par2-engine.ts, server/organoid-evolutionary-gene-age.ts,
// scripts/generate_figures.py, scripts/fix_discovery_rates_figure.py)
const ENSEMBL_TO_SYMBOL = {
  // MCM family (DNA replication licensing) — KEY TARGETS
  // NOTE: ENSMUSG00000000031 (listed as Mcm4 in earlier scripts) is ABSENT from
  //       this dataset; correct GRCm38 Mcm4 ID is ENSMUSG00000022673 (MGI:103199)
  'ENSMUSG00000040204': 'Mcm2',
  'ENSMUSG00000025479': 'Mcm3',
  'ENSMUSG00000022673': 'Mcm4',   // Corrected: ENSMUSG00000000031 was wrong; MGI:103199 confirmed
  'ENSMUSG00000003360': 'Mcm5',
  'ENSMUSG00000025544': 'Mcm6',
  'ENSMUSG00000022300': 'Mcm7',   // MGI:1333776; GRCm38 confirmed, present in dataset
  'ENSMUSG00000020485': 'Mcm10',  // MGI:1918936; GRCm38 confirmed, present in dataset
  // CDKs
  'ENSMUSG00000019461': 'Cdk1',
  'ENSMUSG00000064373': 'Cdk2',
  'ENSMUSG00000028212': 'Cdk4',
  'ENSMUSG00000028551': 'Cdk6',
  'ENSMUSG00000006715': 'Cdk7',   // MGI:107414; GRCm38 confirmed, present in dataset
  // Cyclins
  'ENSMUSG00000027490': 'Ccna2',
  'ENSMUSG00000041431': 'Ccnb1',
  'ENSMUSG00000038379': 'Ccnb2',
  'ENSMUSG00000070348': 'Ccnd1',
  'ENSMUSG00000000184': 'Ccnd2',  // MGI:88311; GRCm38 confirmed, present in dataset
  'ENSMUSG00000034165': 'Ccnd3',  // MGI:88312; GRCm38 confirmed, present in dataset
  'ENSMUSG00000002068': 'Ccne1',
  'ENSMUSG00000028399': 'Ccne2',
  // Spindle assembly checkpoint
  'ENSMUSG00000029910': 'Mad2l1', // MGI:1860374; GRCm38 confirmed (NOT ENSMUSG00000029298)
  'ENSMUSG00000031839': 'Bub1',   // MGI:1203504; GRCm38 confirmed, present in dataset
  'ENSMUSG00000040084': 'Bub1b',  // MGI:1340063; GRCm38 confirmed (BubR1/BUB1B)
  'ENSMUSG00000031262': 'Bub3',   // MGI:1858283; GRCm38 confirmed, present in dataset
  'ENSMUSG00000020897': 'Cdc20',
  // Proliferation / S-phase
  'ENSMUSG00000031004': 'Mki67',
  'ENSMUSG00000031627': 'Pcna',
  // Kinases / aurora
  'ENSMUSG00000005410': 'Plk1',
  'ENSMUSG00000017716': 'Aurka',
  'ENSMUSG00000026970': 'Aurkb',
  // G2/M checkpoint
  'ENSMUSG00000031016': 'Wee1',
  'ENSMUSG00000030528': 'Chek1',  // MGI:1351614; GRCm38 confirmed, present in dataset
  'ENSMUSG00000029521': 'Chek2',
  // CKIs
  'ENSMUSG00000023067': 'Cdkn1a',
  'ENSMUSG00000003031': 'Cdkn1b',
  'ENSMUSG00000037628': 'Cdkn3',  // MGI:1914251; GRCm38 confirmed (NOT ENSMUSG00000028204)
  // Rb pathway
  'ENSMUSG00000027699': 'Rb1',
  'ENSMUSG00000026490': 'E2f1',
  'ENSMUSG00000027371': 'E2f2',
  'ENSMUSG00000016477': 'E2f3',
  // CDCA family (cell division cycle associated)
  'ENSMUSG00000020235': 'Cdca3',  // MGI:2442583; GRCm38 confirmed, present in dataset
  'ENSMUSG00000020808': 'Cdca5',  // MGI:2443538; GRCm38 confirmed, present in dataset
  'ENSMUSG00000031264': 'Cdca8',  // MGI:2443540; GRCm38 confirmed, present in dataset
};

// Reverse map
const SYMBOL_TO_ENSEMBL = Object.fromEntries(
  Object.entries(ENSEMBL_TO_SYMBOL).map(([e, s]) => [s, e])
);

// NOTE: All 42 canonical cell-cycle genes now have confirmed GRCm38/mm10 ENSEMBL IDs.
// The MISSING_FROM_MAP list that previously existed (Mad2l1, Bub1, Bub1b, Bub3, Mcm7,
// Mcm10, Cdk7, Ccnd2, Ccnd3, Chek1, Cdkn3, Cdca3, Cdca5, Cdca8) has been resolved.
// Additionally: ENSMUSG00000000031 was previously used for Mcm4 in error; correct ID
// is ENSMUSG00000022673 (Ensembl REST API / MGI:103199 confirmed).

// ─── Parse GSE157357 CSV ─────────────────────────────────────────────────────
function parseGSE157357(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8').trim();
  const rows = raw.split('\n');

  // Header: "target_id","34","36","36","38",...
  const headerCols = rows[0].split(',').map(c => c.replace(/"/g, ''));
  const ztLabels = headerCols.slice(1).map(Number); // ZT values with duplicates

  const data = {};
  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i].split(',');
    const ensembl = cols[0].replace(/"/g, '');
    const vals = cols.slice(1).map(Number);
    // Average biological replicates per ZT and sort chronologically
    const map = {};
    for (let j = 0; j < ztLabels.length; j++) {
      const zt = ztLabels[j];
      if (!map[zt]) map[zt] = [];
      map[zt].push(vals[j]);
    }
    const sortedZT = Object.keys(map).map(Number).sort((a, b) => a - b);
    const avgVals = sortedZT.map(zt => {
      const arr = map[zt];
      return arr.reduce((s, v) => s + v, 0) / arr.length;
    });
    data[ensembl] = { timepoints: sortedZT, vals: avgVals };
  }
  return data;
}

// ─── AR(2) OLS fit ────────────────────────────────────────────────────────────
function fitAR2(vals) {
  const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
  const y = vals.map(v => v - mean);
  const n = y.length;
  if (n < 5) return null;

  let s11 = 0, s12 = 0, s22 = 0, s1y = 0, s2y = 0;
  for (let t = 2; t < n; t++) {
    s11 += y[t-1]*y[t-1]; s12 += y[t-1]*y[t-2]; s22 += y[t-2]*y[t-2];
    s1y += y[t-1]*y[t];   s2y += y[t-2]*y[t];
  }
  const det = s11*s22 - s12*s12;
  if (Math.abs(det) < 1e-15) return null;
  const phi1 = (s22*s1y - s12*s2y) / det;
  const phi2 = (s11*s2y - s12*s1y) / det;

  const disc = phi1*phi1 + 4*phi2;
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

  const yhat = [];
  for (let t = 2; t < n; t++) yhat.push(phi1*y[t-1] + phi2*y[t-2]);
  const ss_res = y.slice(2).reduce((s, r, i) => s + (r - yhat[i])**2, 0);
  const ss_tot = y.slice(2).reduce((s, r) => s + r*r, 0);
  const r2 = ss_tot > 0 ? 1 - ss_res/ss_tot : 0;

  return { phi1, phi2, lambda, isComplex, r2 };
}

// ─── Permutation test ─────────────────────────────────────────────────────────
function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function permTest(focalDelta, focalLogMean, data, nPerm = 10000) {
  const pool = [];
  for (const ensembl of Object.keys(data)) {
    const vals = data[ensembl].vals;
    const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
    if (mean <= 0) continue;
    const logMean = Math.log2(mean);
    if (Math.abs(logMean - focalLogMean) <= 0.5) {
      pool.push(ensembl);
    }
  }
  let nLE = 0;
  const rng = mulberry32(42);
  for (let i = 0; i < nPerm; i++) {
    const idx = Math.floor(rng() * pool.length);
    const result = fitAR2(data[pool[idx]].vals);
    if (result && result.lambda >= 0 && result.lambda < 1) {
      const delta = Math.abs(result.lambda - PHI_RECIP);
      if (delta <= focalDelta) nLE++;
    }
  }
  return { p: nLE / nPerm, poolSize: pool.length };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const filePath = 'datasets/GSE157357_Organoid_WT-WT_circadian.csv';
console.log('Loading GSE157357 WT-WT...');
const data = parseGSE157357(filePath);

// Verify timepoints
const sampleEnsembl = Object.keys(data)[0];
const timepoints = data[sampleEnsembl].timepoints;
console.log(`Dataset: ${Object.keys(data).length} genes, ${timepoints.length} averaged timepoints`);
console.log(`Timepoints (ZT): ${timepoints.join(', ')}`);
console.log(`Window: ZT${timepoints[0]}–ZT${timepoints[timepoints.length-1]} = ${timepoints[timepoints.length-1]-timepoints[0]} h`);
console.log();

// Run AR(2) on known cell-cycle genes
const results = [];
const foundGenes = [];
const missingGenes = [];

for (const [ensembl, symbol] of Object.entries(ENSEMBL_TO_SYMBOL)) {
  if (!data[ensembl]) {
    missingGenes.push(`${symbol} (${ensembl})`);
    continue;
  }
  const fit = fitAR2(data[ensembl].vals);
  if (!fit) {
    missingGenes.push(`${symbol} — fit failed`);
    continue;
  }
  const vals = data[ensembl].vals;
  const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
  const logMean = mean > 0 ? Math.log2(mean) : NaN;
  const delta = Math.abs(fit.lambda - PHI_RECIP);
  results.push({ gene: symbol, ensembl, ...fit, delta, logMean, mean });
  foundGenes.push(symbol);
}

// Sort by delta
results.sort((a, b) => a.delta - b.delta);

console.log('=== AR(2) Scan — Cell Cycle Genes in GSE157357 WT-WT (Mouse Organoid) ===');
console.log(`Dataset: GSE157357 — WT-WT condition (22 h window, ZT24–ZT46)`);
console.log(`WARNING: 22 h window is known to be insufficient for reliable AR(2) estimates`);
console.log(`         (see sampling window sensitivity analysis in the manuscript)`);
console.log(`Sorted by Δ from 1/φ ≈ 0.6180\n`);
console.log('Gene'.padEnd(12) + '|λ|'.padStart(8) + 'Δ'.padStart(8) + 'R²'.padStart(7) + ' Type'.padEnd(10) + 'logMean');
console.log('-'.repeat(65));

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

// Missing genes report (genes in map but absent from dataset)
console.log('\n=== Missing from dataset (ID mapped but not in CSV) ===');
if (missingGenes.length === 0) {
  console.log('  (none — all 42 mapped genes found in dataset)');
} else {
  for (const g of missingGenes) console.log(`  MISSING: ${g}`);
}

// ─── MCM S-phase cluster specifically ─────────────────────────────────────────
console.log('\n=== MCM S-phase cluster in GSE157357 WT-WT ===');
console.log('Comparison to GSE179027 (mouse enteroid, 24-timepoint, 46 h window)\n');
console.log('Gene'.padEnd(12) + 'GSE157357 |λ|'.padStart(16) + 'GSE157357 Δ'.padStart(14) + 'GSE157357 R²'.padStart(14) + '  Rank  ' + 'GSE179027 Δ (ref)');
console.log('-'.repeat(85));

const mcmRef = {
  'Mcm2': { lambda: 0.6053, delta: 0.0127, r2: 0.181, rank: 3 },
  'Mcm3': { lambda: 0.6065, delta: 0.0115, r2: 0.139, rank: 2 },
  'Mcm4': { lambda: 0.5243, delta: 0.0937, r2: 0.064, rank: 24 },
  'Mcm5': { lambda: 0.5080, delta: 0.1100, r2: 0.197, rank: 27 },
  'Mcm6': { lambda: 0.5945, delta: 0.0236, r2: 0.290, rank: 6  },
};

for (const [gene, ref] of Object.entries(mcmRef)) {
  const r = results.find(x => x.gene === gene);
  if (r) {
    const rank = results.indexOf(r) + 1;
    const inTopQuartile = rank <= Math.ceil(results.length / 4) ? ' ✓ top 25%' : '';
    console.log(
      gene.padEnd(12) +
      r.lambda.toFixed(4).padStart(16) +
      r.delta.toFixed(4).padStart(14) +
      r.r2.toFixed(3).padStart(14) +
      `  ${rank}/${results.length}  ` +
      `Δ=${ref.delta.toFixed(4)} (rank ${ref.rank} in GSE179027)` +
      inTopQuartile
    );
  } else {
    console.log(gene.padEnd(12) + '  NOT FOUND IN DATASET');
  }
}

// ─── Permutation tests for top candidates ─────────────────────────────────────
console.log('\n=== Permutation tests (top 10 by Δ) ===\n');
console.log('Gene'.padEnd(12) + '|λ|'.padStart(8) + 'Δ'.padStart(8) + 'R²'.padStart(7) + ' Pool'.padStart(8) + ' p-perm');
console.log('-'.repeat(60));

const top10 = results.slice(0, 10);
const permResults = [];

for (const r of top10) {
  const { p, poolSize } = permTest(r.delta, r.logMean, data, 10000);
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
const nP = permResults.length;
console.log('\n=== BH-FDR correction ===\n');
console.log('Rank  Gene        p        BH-adj   Pass?');
permResults.forEach((r, i) => {
  const adj = Math.min(1, r.p * nP / (i + 1));
  const pass = adj < 0.05 ? '✓ q<0.05' : '';
  console.log(`${(i+1).toString().padStart(4)}  ${r.gene.padEnd(12)} ${r.p.toFixed(4).padStart(6)}   ${adj.toFixed(4).padStart(6)}   ${pass}`);
  r.bhAdj = adj;
});

// ─── Summary for manuscript ────────────────────────────────────────────────────
console.log('\n=== MANUSCRIPT SUMMARY ===');
console.log(`GSE157357 WT-WT: ${timepoints.length} timepoints, ZT${timepoints[0]}–ZT${timepoints[timepoints.length-1]} (${timepoints[timepoints.length-1]-timepoints[0]}h window)`);
console.log('CRITICAL CAVEAT: 22h window insufficient for AR(2) of circadian-period genes');
console.log('  (Sampling window sensitivity analysis shows AR(2) unreliable below ~36h)');
console.log();
console.log('MCM S-phase cluster status in GSE157357 WT-WT:');

for (const gene of ['Mcm2', 'Mcm3', 'Mcm6']) {
  const r = results.find(x => x.gene === gene);
  if (r) {
    const rank = results.indexOf(r) + 1;
    const topQ = rank <= Math.ceil(results.length / 4);
    console.log(`  ${gene}: |λ|=${r.lambda.toFixed(4)}, Δ=${r.delta.toFixed(4)}, R²=${r.r2.toFixed(3)}, rank ${rank}/${results.length} ${topQ ? '(top 25%)' : ''}`);
  } else {
    console.log(`  ${gene}: NOT FOUND`);
  }
}

console.log();
console.log('VERDICT: Short 22h window means results are methodologically unreliable for');
console.log('  circadian-period genes. GSE157357 is NOT suitable as an independent');
console.log('  replication dataset for MCM AR(2) claims (same limitation as Notch2).');
console.log('  GSE179027 remains the sole independent mouse intestinal organoid dataset');
console.log('  for reliable AR(2) eigenvalue analysis.');
