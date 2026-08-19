#!/usr/bin/env node
// AR(2) G2/M vs G1/S species test — human intestinal biopsy vs organoid (GSE161566)
//
// PURPOSE: Run the same Wee1/CDK1-axis comparison from wee1_cdk1_species_comparison.cjs
//          on an inhibitor-free human biopsy timeseries, then print a cross-dataset table
//          comparing biopsy vs organoid for the five focal genes.
//
// STATUS (August 2026): No human intestinal biopsy timeseries is publicly available on GEO.
//   This script is ready to run when a dataset is deposited. To use it:
//     1. Set BIOPSY_PATH to the CSV file path (gene × timepoint matrix, comma-separated).
//     2. Set BIOPSY_ZT_PREFIX to the column-header prefix before each timepoint number
//        (e.g. 'ZT' for ZT0,ZT4,... or 'CT_' for CT_0,CT_4,... or '' if headers are bare numbers).
//     3. Run:  node scripts/wee1_cdk1_biopsy_comparison.cjs
//     4. Update the cross-dataset table in:
//        manuscripts/future_iterations/intestinal_three_oscillator_phi_proximity.md
//        §"Biopsy Extension — Inhibitor-Free Human Tissue Test"
//
// ELIGIBILITY CHECK (run before trusting results):
//   - ≥12 regularly-spaced timepoints (≤4 h step) — minimum for AR(2) signal detection
//   - ≥24 h total coverage strongly preferred; ≥36 h recommended for NOTCH2-class genes
//   - Gene names must be HGNC symbols (WEE1, CDK1, GMNN, CDT1, CDKN1A, MCM6, MAD2L1)
//     If the CSV uses ENSEMBL IDs, add a symbol→ENSEMBL mapping below.
//
// Reference (organoid, GSE161566):
//   WEE1   |λ|=0.4002 Δ=0.2179 p=0.666
//   CDK1   |λ|=0.5118 Δ=0.1063 p=0.354
//   GMNN   |λ|=0.5352 Δ=0.0828 p=0.294
//   CDT1   |λ|=0.2845 Δ=0.3336 p=0.861
//   CDKN1A |λ|=0.4535 Δ=0.1645 p=0.565
//   MCM6   |λ|=0.6268 Δ=0.0088 p=0.039
//   MAD2L1 |λ|=0.6615 Δ=0.0435 p=0.163

const fs = require('fs');

// ─── CONFIGURATION — update these for the biopsy dataset ──────────────────────
const BIOPSY_PATH   = 'datasets/REPLACE_WITH_BIOPSY_ACCESSION_circadian.csv';
const BIOPSY_ZT_PREFIX = 'ZT'; // adjust to match column headers (ZT, CT_, CH_, '' etc.)
const BIOPSY_LABEL  = 'Human biopsy (REPLACE_WITH_ACCESSION)';
const N_PERM = 10000;
// ──────────────────────────────────────────────────────────────────────────────

const PHI = (1 + Math.sqrt(5)) / 2;
const PHI_RECIP = 1 / PHI; // ≈ 0.6180

// Organoid reference values (GSE161566, human enteroid)
const ORGANOID_REF = {
  WEE1:   { lambda: 0.4002, delta: 0.2179, p: 0.666 },
  CDK1:   { lambda: 0.5118, delta: 0.1063, p: 0.354 },
  GMNN:   { lambda: 0.5352, delta: 0.0828, p: 0.294 },
  CDT1:   { lambda: 0.2845, delta: 0.3336, p: 0.861 },
  CDKN1A: { lambda: 0.4535, delta: 0.1645, p: 0.565 },
  MCM6:   { lambda: 0.6268, delta: 0.0088, p: 0.039 },
  MAD2L1: { lambda: 0.6615, delta: 0.0435, p: 0.163 },
};

// Mouse organoid reference (GSE179027) for three-way context
const MOUSE_REF = {
  Wee1:   { lambda: 0.5441, delta: 0.0739, p: 0.206 },
  Cdk1:   { lambda: 0.8811, delta: 0.2631, p: 0.686 },
  Gmnn:   { lambda: 0.1592, delta: 0.4588, p: 0.966 },
  Cdt1:   { lambda: 0.7535, delta: 0.1355, p: 0.376 },
  Cdkn1a: { lambda: 0.7821, delta: 0.1641, p: 0.404 },
  Mcm6:   { lambda: 0.5945, delta: 0.0236, p: 0.066 },
  Mad2l1: { lambda: 0.6173, delta: 0.0008, p: 0.001 },
};

// ─── Parse CSV ────────────────────────────────────────────────────────────────
function parseCSV(path, ztPrefix) {
  const lines = fs.readFileSync(path, 'utf8').trim().split('\n');
  const header = lines[0].split(',');
  const timepoints = header.slice(1).map(h => {
    const s = ztPrefix ? h.replace(ztPrefix, '').trim() : h.trim();
    return parseFloat(s);
  });
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
  const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
  const y = vals.map(v => v - mean);
  const n = y.length;
  if (n < 5) return null;

  const responses = [];
  const predictors = [];
  for (let t = 2; t < n; t++) {
    responses.push(y[t]);
    predictors.push([y[t - 1], y[t - 2]]);
  }

  const m = responses.length;
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

  const yhat = predictors.map(p => phi1 * p[0] + phi2 * p[1]);
  const ss_res = responses.reduce((s, r, i) => s + (r - yhat[i]) ** 2, 0);
  const ss_tot = responses.reduce((s, r) => s + r * r, 0);
  const r2 = ss_tot > 0 ? 1 - ss_res / ss_tot : 0;

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

function permTest(focalDelta, focalLogMean, data, nPerm) {
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

// ─── Analyse one gene in biopsy data ─────────────────────────────────────────
function analyzeGene(symbol, data, nPerm) {
  if (!data[symbol]) {
    return { symbol, found: false };
  }
  const vals = data[symbol].vals;
  const fit = fitAR2(vals);
  if (!fit) {
    return { symbol, found: true, fitOk: false };
  }
  const delta = Math.abs(fit.lambda - PHI_RECIP);
  const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
  const logMean = mean > 0 ? Math.log2(mean) : NaN;
  const perm = permTest(delta, logMean, data, nPerm);
  return {
    symbol, found: true, fitOk: true,
    lambda: fit.lambda, delta, r2: fit.r2, isComplex: fit.isComplex,
    logMean, poolSize: perm.poolSize, p: perm.p
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
if (!fs.existsSync(BIOPSY_PATH)) {
  console.error(`\n⚠  BIOPSY DATASET NOT FOUND: ${BIOPSY_PATH}`);
  console.error('');
  console.error('No human intestinal biopsy timeseries was publicly available on GEO as of August 2026.');
  console.error('This script is ready to run when a dataset is deposited.');
  console.error('');
  console.error('Steps to run the biopsy analysis:');
  console.error('  1. Download the circadian expression matrix (gene × timepoint CSV)');
  console.error('  2. Update BIOPSY_PATH, BIOPSY_ZT_PREFIX, and BIOPSY_LABEL in this script');
  console.error('  3. Run: node scripts/wee1_cdk1_biopsy_comparison.cjs');
  console.error('  4. Update the cross-dataset table in:');
  console.error('     manuscripts/future_iterations/intestinal_three_oscillator_phi_proximity.md');
  console.error('     §"Biopsy Extension — Inhibitor-Free Human Tissue Test"');
  console.error('');
  console.error('Datasets to monitor:');
  console.error('  - Costello et al. human colon biopsy (attribution unverifiable — GSE183714 is wrong; no paper found on PubMed as of August 2026; see PENDING_DATASETS.md item #0)');
  console.error('  - Carmona-Alcocer/Naef Chrono-atlas colon deposit (bioRxiv Nov 2025)');
  console.error('  - GEO search: colon biopsy circadian timeseries human 2026[PDAT]');
  process.exit(0);
}

console.log(`\nLoading biopsy dataset: ${BIOPSY_PATH}`);
const biopsyData = parseCSV(BIOPSY_PATH, BIOPSY_ZT_PREFIX);
console.log(`Biopsy dataset: ${Object.keys(biopsyData).length} genes`);

// Eligibility check
const timepoints = Object.values(biopsyData)[0].timepoints;
const nPoints = timepoints.length;
const totalHours = nPoints > 1 ? (timepoints[timepoints.length - 1] - timepoints[0]) : 0;
console.log(`\nTimepoint check: ${nPoints} points, ${totalHours.toFixed(1)} h total window`);
if (nPoints < 12) {
  console.warn(`⚠  ELIGIBILITY WARNING: only ${nPoints} timepoints. Minimum for AR(2) is 12 (≥24 h coverage). Results may be unreliable.`);
}
if (totalHours < 36) {
  console.warn(`⚠  ELIGIBILITY WARNING: ${totalHours.toFixed(1)} h window. ≥36 h recommended for reliable AR(2) for Notch2-class genes (see window-threshold analysis in the manuscript). Clock-gene-class genes (Per2) may still be reliable.`);
}

// Focal genes
const focalGenes = [
  { human: 'WEE1',   category: 'G2/M checkpoint',            hypothesis: 'mouse-closer' },
  { human: 'CDK1',   category: 'G2/M CDK',                   hypothesis: 'mouse-closer' },
  { human: 'GMNN',   category: 'G1/S licensing (geminin)',    hypothesis: 'human-closer' },
  { human: 'CDT1',   category: 'G1/S licensing',              hypothesis: 'human-closer' },
  { human: 'CDKN1A', category: 'CKI (dual phase)',            hypothesis: 'neutral' },
  { human: 'MCM6',   category: 'G1/S MCM (reference)',        hypothesis: 'human-closer' },
  { human: 'MAD2L1', category: 'G2/M SAC (reference)',        hypothesis: 'mouse-closer' },
];

console.log('\n========================================================');
console.log('  Wee1/CDK1 Axis: Biopsy vs Organoid Comparison');
console.log('========================================================\n');
console.log(`PHI_RECIP (1/φ) = ${PHI_RECIP.toFixed(4)}`);
console.log(`Biopsy: ${BIOPSY_LABEL}`);
console.log(`Organoid reference: GSE161566 (human intestinal enteroid)\n`);

const results = [];
for (const gene of focalGenes) {
  const biopsyResult = analyzeGene(gene.human, biopsyData, N_PERM);
  const organoidRef = ORGANOID_REF[gene.human];
  results.push({ ...gene, biopsyResult, organoidRef });
}

// Print cross-dataset table
console.log(
  'Gene'.padEnd(10) + 'Category'.padEnd(28) +
  'Organoid |λ|'.padStart(14) + 'Organoid Δ'.padStart(12) + 'Organoid p'.padStart(12) +
  'Biopsy |λ|'.padStart(12) + 'Biopsy Δ'.padStart(10) + 'Biopsy p'.padStart(10)
);
console.log('-'.repeat(108));

for (const r of results) {
  const oL = r.organoidRef.lambda.toFixed(4);
  const oD = r.organoidRef.delta.toFixed(4);
  const oP = r.organoidRef.p.toFixed(3);
  const bL = r.biopsyResult.found && r.biopsyResult.fitOk ? r.biopsyResult.lambda.toFixed(4) : (r.biopsyResult.found ? 'FIT FAIL' : 'NOT FOUND');
  const bD = r.biopsyResult.found && r.biopsyResult.fitOk ? r.biopsyResult.delta.toFixed(4) : 'N/A';
  const bP = r.biopsyResult.found && r.biopsyResult.fitOk ? r.biopsyResult.p.toFixed(3) : 'N/A';

  console.log(
    r.human.padEnd(10) + r.category.padEnd(28) +
    oL.padStart(14) + oD.padStart(12) + oP.padStart(12) +
    bL.padStart(12) + bD.padStart(10) + bP.padStart(10)
  );
}

// Hypothesis test summary
console.log('\n\n=== HYPOTHESIS TEST ===\n');
console.log('G2/M genes should sit closer to 1/φ in MOUSE (i.e. further from 1/φ in human biopsy than in mouse GSE179027).');
console.log('G1/S genes should sit closer to 1/φ in HUMAN (i.e. biopsy Δ ≤ mouse GSE179027 Δ).\n');

let consistent = 0, total = 0;
for (const r of results) {
  if (r.hypothesis === 'neutral') continue;
  if (!r.biopsyResult.found || !r.biopsyResult.fitOk) continue;
  const mouseRef = MOUSE_REF[Object.keys(MOUSE_REF).find(k => k.toLowerCase() === r.human.toLowerCase())] ||
                   MOUSE_REF[Object.keys(MOUSE_REF).find(k => k.toLowerCase() === r.human.toLowerCase().replace('1', '1'))];
  if (!mouseRef) continue;

  total++;
  const biopsyDelta = r.biopsyResult.delta;
  const mouseDelta  = mouseRef.delta;
  let isConsistent = false;
  if (r.hypothesis === 'mouse-closer') {
    // Mouse should be closer to 1/φ: mouse Δ < biopsy Δ
    isConsistent = mouseDelta < biopsyDelta;
  } else {
    // Human should be closer to 1/φ: biopsy Δ < mouse Δ
    isConsistent = biopsyDelta < mouseDelta;
  }
  if (isConsistent) consistent++;

  const marker = isConsistent ? '✓ consistent' : '✗ inconsistent';
  console.log(`  ${r.human.padEnd(10)} ${r.hypothesis === 'mouse-closer' ? 'G2/M' : 'G1/S'}: mouse Δ=${mouseDelta.toFixed(4)}, biopsy Δ=${biopsyDelta.toFixed(4)} → ${marker}`);
}

if (total > 0) {
  console.log(`\nOverall: ${consistent}/${total} genes consistent with G2/M-mouse / G1/S-human hypothesis in biopsy data`);
  console.log(`Organoid reference: 4/6 consistent (Wee1✓, GMNN✓, Mad2l1✓, MCM6✓; CDK1✗, CDT1✗)`);
} else {
  console.log('\n  No genes with valid biopsy fits found — check gene names in biopsy CSV.');
}

// Per-gene detail
console.log('\n\n=== Per-gene detail ===\n');
for (const r of results) {
  console.log(`--- ${r.human} (${r.category}) ---`);
  const oRef = r.organoidRef;
  console.log(`  Organoid (GSE161566): |λ|=${oRef.lambda.toFixed(4)}, Δ=${oRef.delta.toFixed(4)}, p=${oRef.p.toFixed(3)}`);
  const br = r.biopsyResult;
  if (!br.found) {
    console.log(`  Biopsy (${BIOPSY_LABEL}): NOT FOUND — check gene symbol or mapping`);
  } else if (!br.fitOk) {
    console.log(`  Biopsy: AR(2) fit failed — insufficient timepoints or degenerate series`);
  } else {
    console.log(`  Biopsy (${BIOPSY_LABEL}): |λ|=${br.lambda.toFixed(4)}, Δ=${br.delta.toFixed(4)}, R²=${br.r2.toFixed(3)}, roots=${br.isComplex ? 'complex' : 'real'}, pool=${br.poolSize}, p=${br.p.toFixed(3)}`);
    if (br.delta < oRef.delta) {
      console.log(`  → Biopsy is ${(oRef.delta / br.delta).toFixed(1)}× closer to 1/φ than organoid`);
    } else {
      console.log(`  → Organoid is ${(br.delta / oRef.delta).toFixed(1)}× closer to 1/φ than biopsy`);
    }
  }
  console.log('');
}
