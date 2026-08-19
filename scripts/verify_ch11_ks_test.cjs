#!/usr/bin/env node
/**
 * verify_ch11_ks_test.cjs
 *
 * Deterministic verification of the Chapter 11 / Paper J KS test result.
 *
 * Claim: Protein-level FP values (mean 86.2%) are significantly higher than
 * matched mRNA FP values from GSE11923 mouse liver (mean 64.6%;
 * exact two-sample KS test D = 0.857, p = 0.008).
 *
 * Usage:  node scripts/verify_ch11_ks_test.cjs
 * Output: per-gene table + exact KS statistic and p-value
 *
 * Data sources (read-only, not modified):
 *   datasets/mouse_liver_circadian_proteomics.csv   (Wang et al. 2018, 7 genes, 16 ZT)
 *   datasets/GSE11923_Liver_1h_48h_genes.csv         (48 circadian timepoints)
 *
 * AR(2) formula mirrors server/proteomics-landscape.ts :: fitAR2()
 * FP formula: max(0, (1 - |λ - 0.618| / 0.618) * 100)
 * KS p-value: exact two-sided permutation (enumerates all C(2n,n) arrangements)
 */

'use strict';

const fs = require('fs');

// ── AR(2) fitting (identical to server/proteomics-landscape.ts) ──────────────
function fitAR2(series) {
  const n = series.length;
  if (n < 5) return { eigenvalue: 0 };

  const mean = series.reduce((a, b) => a + b, 0) / n;
  const y = series.map(x => x - mean);
  const T = n - 2;
  const Y  = y.slice(2);
  const Y1 = y.slice(1, n - 1);
  const Y2 = y.slice(0, n - 2);

  let s11 = 0, s22 = 0, s12 = 0, sy1 = 0, sy2 = 0;
  for (let i = 0; i < T; i++) {
    s11 += Y1[i] * Y1[i];
    s22 += Y2[i] * Y2[i];
    s12 += Y1[i] * Y2[i];
    sy1 += Y[i]  * Y1[i];
    sy2 += Y[i]  * Y2[i];
  }

  const det = s11 * s22 - s12 * s12;
  if (Math.abs(det) < 1e-10) return { eigenvalue: 0 };

  const phi1 = (sy1 * s22 - sy2 * s12) / det;
  const phi2 = (sy2 * s11 - sy1 * s12) / det;

  const disc = phi1 * phi1 + 4 * phi2;
  let eigenvalue;
  if (disc < 0) {
    eigenvalue = Math.sqrt(-phi2);
  } else {
    const r1 = (phi1 + Math.sqrt(disc)) / 2;
    const r2 = (phi1 - Math.sqrt(disc)) / 2;
    eigenvalue = Math.max(Math.abs(r1), Math.abs(r2));
  }

  return { eigenvalue: Math.min(eigenvalue, 0.99) };
}

// ── Fibonacci Proximity ───────────────────────────────────────────────────────
function fibProx(lambda) {
  return Math.max(0, (1 - Math.abs(lambda - 0.618) / 0.618) * 100);
}

// ── CSV parser ────────────────────────────────────────────────────────────────
function parseCSV(filePath) {
  const lines = fs.readFileSync(filePath, 'utf-8').trim().split('\n');
  const results = {};
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const gene = cols[0].trim().replace(/"/g, '');
    if (!gene) continue;
    const vals = cols.slice(1).map(Number).filter(v => !isNaN(v));
    if (vals.length >= 4) results[gene.toUpperCase()] = vals;
  }
  return results;
}

// ── KS statistic for two sorted arrays ───────────────────────────────────────
function ksStatistic(a, b) {
  const n1 = a.length, n2 = b.length;
  const s1 = [...a].sort((x, y) => x - y);
  const s2 = [...b].sort((x, y) => x - y);
  let i = 0, j = 0, maxD = 0;
  while (i < n1 && j < n2) {
    if (s1[i] <= s2[j]) { i++; } else { j++; }
    maxD = Math.max(maxD, Math.abs(i / n1 - j / n2));
  }
  return maxD;
}

// ── Exact two-sample KS p-value via full enumeration of C(2n, n) ─────────────
// For equal-sized groups of size n, enumerates all C(2n, n) ways to assign
// the combined sample labels and counts how many yield D >= observed D.
// Feasible up to n ≈ 10; n=7 gives C(14,7)=3432 permutations.
function exactKSPValue(a, b) {
  const n = a.length;
  if (b.length !== n) throw new Error('Groups must be equal size for exact test');

  const combined = [...a, ...b].sort((x, y) => x - y);
  const total    = combined.length; // 2n
  const obsD     = ksStatistic(a, b);

  // Enumerate all C(2n, n) subsets of size n from the combined sorted array
  // Using the label-assignment approach: for each C(2n,n) combination,
  // treat selected indices as group 1, remainder as group 2.
  let count = 0, extreme = 0;

  function choose(start, remaining, selected) {
    if (remaining === 0) {
      // Build group1 and group2 from selected indices
      const g1 = selected.map(i => combined[i]);
      const g2 = combined.filter((_, i) => !selected.includes(i));
      const d  = ksStatistic(g1, g2);
      count++;
      if (d >= obsD - 1e-9) extreme++;
      return;
    }
    for (let i = start; i <= total - remaining; i++) {
      choose(i + 1, remaining - 1, [...selected, i]);
    }
  }

  choose(0, n, []);
  return { D: +obsD.toFixed(4), pValue: +(extreme / count).toFixed(4), extreme, total: count };
}

// ── Main ──────────────────────────────────────────────────────────────────────
const PROT_FILE = 'datasets/mouse_liver_circadian_proteomics.csv';
const MRNA_FILE = 'datasets/GSE11923_Liver_1h_48h_genes.csv';

for (const f of [PROT_FILE, MRNA_FILE]) {
  if (!fs.existsSync(f)) {
    console.error(`Missing data file: ${f}`);
    process.exit(1);
  }
}

const protData = parseCSV(PROT_FILE);
const mrnaData = parseCSV(MRNA_FILE);

const GENES = ['CLOCK', 'ARNTL', 'NR1D1', 'NR1D2', 'WEE1', 'YAP1', 'BAX'];

const protFPs = [], mrnaFPs = [];
const rows = [];

for (const gene of GENES) {
  const pVals = protData[gene];
  const mVals = mrnaData[gene];

  if (!pVals) { console.error(`Protein data missing for ${gene}`); process.exit(1); }
  if (!mVals) { console.error(`mRNA data missing for ${gene}`);    process.exit(1); }

  const pLambda = fitAR2(pVals).eigenvalue;
  const mLambda = fitAR2(mVals).eigenvalue;
  const pFP     = fibProx(pLambda);
  const mFP     = fibProx(mLambda);

  protFPs.push(pFP);
  mrnaFPs.push(mFP);
  rows.push({ gene, pLambda: pLambda.toFixed(4), pFP: pFP.toFixed(1),
                    mLambda: mLambda.toFixed(4), mFP: mFP.toFixed(1) });
}

// ── Report ────────────────────────────────────────────────────────────────────
console.log('\n=== Per-gene results ===');
console.log('Gene    | Protein λ | Protein FP | mRNA λ | mRNA FP');
console.log('--------|-----------|------------|--------|--------');
for (const r of rows) {
  console.log(
    `${r.gene.padEnd(7)} | ${r.pLambda.padEnd(9)} | ${(r.pFP + '%').padEnd(10)} | ${r.mLambda.padEnd(6)} | ${r.mFP}%`
  );
}

const meanProt = (protFPs.reduce((a, b) => a + b, 0) / protFPs.length).toFixed(1);
const meanMRNA = (mrnaFPs.reduce((a, b) => a + b, 0) / mrnaFPs.length).toFixed(1);

console.log(`\nMean protein FP : ${meanProt}%`);
console.log(`Mean mRNA FP    : ${meanMRNA}%`);

console.log('\nRunning exact two-sample KS test (enumerates all C(14,7)=3432 arrangements)...');
const ks = exactKSPValue(protFPs, mrnaFPs);

console.log(`KS statistic D  : ${ks.D}`);
console.log(`Extreme arrangements : ${ks.extreme} / ${ks.total}`);
console.log(`Exact KS p-value : ${ks.pValue}`);

// ── Assertions ────────────────────────────────────────────────────────────────
// Expected: exact p = 28/3432 ≈ 0.00816 (reported in text as p = 0.008)
let ok = true;

if (Math.abs(parseFloat(meanProt) - 86.2) > 0.2) {
  console.error(`FAIL: mean protein FP ${meanProt} ≠ expected 86.2`); ok = false;
}
if (Math.abs(parseFloat(meanMRNA) - 64.6) > 0.2) {
  console.error(`FAIL: mean mRNA FP ${meanMRNA} ≠ expected 64.6`); ok = false;
}
if (Math.abs(ks.D - 0.857) > 0.01) {
  console.error(`FAIL: KS D ${ks.D} ≠ expected 0.857`); ok = false;
}
if (ks.pValue >= 0.02) {
  console.error(`FAIL: KS p ${ks.pValue} ≥ 0.02 threshold`); ok = false;
}

if (ok) {
  console.log(`\nAll assertions PASSED — exact KS p=${ks.pValue} (≈ 0.008) confirmed.`);
} else {
  process.exit(1);
}
