#!/usr/bin/env node
/**
 * AR(2) analysis for MAD2L1, BUB1B, BUB3 in GSE161566 (human intestinal enteroid)
 * Task 10: Replicate the Mad2l1 cell-cycle finding in human intestinal data
 *
 * Usage: node scripts/ar2_human_cell_cycle.mjs
 *
 * Reports |λ|, Δ from 1/φ, R², and permutation p-value (10,000 draws,
 * expression-matched pool log2 mean ± 0.5) for each target gene.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PHI = (1 + Math.sqrt(5)) / 2;
const PHI_RECIP = 1 / PHI;

// ── Load GSE161566 ────────────────────────────────────────────────────────────
const csvPath = join(__dirname, '../datasets/GSE161566_Human_Enteroid_circadian.csv');
const lines = readFileSync(csvPath, 'utf8').trim().split('\n');
const header = lines[0].split(',');
const nTimepoints = header.length - 1;

/** @type {Map<string, number[]>} */
const geneMap = new Map();
for (let i = 1; i < lines.length; i++) {
  const parts = lines[i].split(',');
  const gene = parts[0].trim();
  const values = parts.slice(1).map(Number);
  geneMap.set(gene, values);
}

console.log(`Loaded ${geneMap.size} genes, ${nTimepoints} timepoints from GSE161566`);

// ── AR(2) OLS fit ─────────────────────────────────────────────────────────────
/**
 * Fit AR(2) model: X[t] = β1·X[t-1] + β2·X[t-2] + ε on mean-centred series.
 * Returns {beta1, beta2, r2, lambda, delta, isComplex} or null if fit fails.
 */
function fitAR2(series) {
  const mean = series.reduce((a, b) => a + b, 0) / series.length;
  const y = series.map(v => v - mean);
  const n = y.length;
  if (n < 4) return null;

  // Build (X'X) and (X'y) for design matrix cols = [y[t-1], y[t-2]]
  let S11 = 0, S12 = 0, S22 = 0, T1 = 0, T2 = 0;
  const m = n - 2;
  for (let t = 2; t < n; t++) {
    S11 += y[t-1] * y[t-1];
    S12 += y[t-1] * y[t-2];
    S22 += y[t-2] * y[t-2];
    T1  += y[t-1] * y[t];
    T2  += y[t-2] * y[t];
  }
  const det = S11 * S22 - S12 * S12;
  if (Math.abs(det) < 1e-12) return null;

  const beta1 = (S22 * T1 - S12 * T2) / det;
  const beta2 = (S11 * T2 - S12 * T1) / det;

  // R² from residuals
  const ySlice  = Array.from({ length: m }, (_, i) => y[i + 2]);
  const yhatArr = Array.from({ length: m }, (_, i) => beta1 * y[i + 1] + beta2 * y[i]);
  const yMean   = ySlice.reduce((a, b) => a + b, 0) / m;
  const ssTot   = ySlice.reduce((acc, v) => acc + (v - yMean) ** 2, 0);
  const ssRes   = ySlice.reduce((acc, v, i) => acc + (v - yhatArr[i]) ** 2, 0);
  const r2      = Math.max(0, 1 - ssRes / ssTot);

  // Eigenvalues: λ² − β1λ − β2 = 0
  const disc = beta1 * beta1 + 4 * beta2;
  let lambda, isComplex;
  if (disc >= 0) {
    const sqrtD = Math.sqrt(disc);
    lambda    = Math.max(Math.abs((beta1 + sqrtD) / 2), Math.abs((beta1 - sqrtD) / 2));
    isComplex = false;
  } else {
    lambda    = Math.sqrt(-beta2);   // modulus of complex conjugate pair = √(−β2)
    isComplex = true;
  }

  return { beta1, beta2, r2, lambda, delta: Math.abs(lambda - PHI_RECIP), isComplex };
}

// ── Permutation test ──────────────────────────────────────────────────────────
/**
 * Draw nPerm expression-matched controls (log2 mean ± 0.5) and count those
 * with Δ ≤ focalDelta.  Returns {pValue, poolSize}.
 */
function permutationTest(focalDelta, focalLogMean, nPerm = 10_000, seed = 42) {
  // Simple seeded LCG for reproducibility
  let state = seed >>> 0;
  function rand() {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0xFFFFFFFF;
  }

  const keys = Array.from(geneMap.keys());
  const pool = keys.filter(g => {
    const vals = geneMap.get(g);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    if (mean <= 0) return false;
    return Math.abs(Math.log2(mean) - focalLogMean) <= 0.5;
  });

  let countLE = 0;
  for (let i = 0; i < nPerm; i++) {
    const ctrl = geneMap.get(pool[Math.floor(rand() * pool.length)]);
    const fit  = fitAR2(ctrl);
    if (fit && fit.delta <= focalDelta) countLE++;
  }

  return { pValue: countLE / nPerm, poolSize: pool.length };
}

// ── Analysis ──────────────────────────────────────────────────────────────────
const targets = ['MAD2L1', 'BUB1B', 'BUB3'];

console.log(`\n1/φ = ${PHI_RECIP.toFixed(6)}\n`);
console.log('Gene     |λ|      Δ       R²    Roots    Pool   p (perm)');
console.log('─'.repeat(60));

const results = [];
for (const gene of targets) {
  const series = geneMap.get(gene);
  if (!series) { console.log(`${gene}: NOT FOUND in dataset`); continue; }

  const fit = fitAR2(series);
  if (!fit) { console.log(`${gene}: AR(2) fit failed`); continue; }

  const mean    = series.reduce((a, b) => a + b, 0) / series.length;
  const logMean = Math.log2(mean);
  const perm    = permutationTest(fit.delta, logMean);

  console.log(
    `${gene.padEnd(7)}  ${fit.lambda.toFixed(4)}   ${fit.delta.toFixed(4)}   ` +
    `${fit.r2.toFixed(3)}   ${fit.isComplex ? 'complex' : 'real'.padEnd(7)}   ` +
    `${String(perm.poolSize).padStart(4)}   ${perm.pValue.toFixed(4)}`
  );
  results.push({ gene, ...fit, pValue: perm.pValue, poolSize: perm.poolSize });
}

console.log('\nMouse reference: Mad2l1 (GSE179027) |λ|=0.6173, Δ=0.0008, p=0.0015 (Bonferroni)');

const mad2 = results.find(r => r.gene === 'MAD2L1');
if (mad2) {
  console.log(
    `\nConclusion: Human MAD2L1 replication ${mad2.delta < 0.020 ? 'CONFIRMED ✓' : 'NOT CONFIRMED ✗'}`
  );
  console.log(`  Mouse Δ=0.0008 → Human Δ=${mad2.delta.toFixed(4)} (${(mad2.delta/0.0008).toFixed(0)}× further from 1/φ)`);
  console.log(`  Human p=${mad2.pValue.toFixed(4)} (${mad2.pValue < 0.05 ? 'significant' : 'not significant'})`);
}
