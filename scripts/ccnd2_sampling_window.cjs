/**
 * Sampling-window sensitivity analysis for Ccnd2 in GSE179027
 *
 * Question: is Ccnd2's φ-proximity result (|λ|=0.6162, BH q=0.017 from
 * GSE157357 WT-WT scan) stable across window lengths, or is it an artefact
 * of the short 22 h window (as Notch2 was)?
 *
 * Method: identical AR(2) OLS to per2_mad2l1_sampling_window.cjs.
 * Dataset: GSE179027 mouse enteroid (ZT24–ZT70), gene symbol "Ccnd2".
 * Windows: ZT24–ZT46, ZT24–ZT48, ZT24–ZT54, ZT24–ZT60, ZT24–ZT70.
 *
 * Classification:
 *   Per2-like   — stable φ-proximity across all windows (genuine signal)
 *   Notch2-like — collapses at short windows, recovers at ≥36 h
 *   Mad2l1-like — universally low R² (gene noise, not circadian AR(2))
 *   Ccnd2 class — TBD by this script
 */

'use strict';
const fs   = require('fs');
const path = require('path');

const PHI     = (1 + Math.sqrt(5)) / 2;
const INV_PHI = 1 / PHI;   // ≈ 0.6180

function meanCentre(arr) {
  const mu = arr.reduce((s, v) => s + v, 0) / arr.length;
  return arr.map(v => v - mu);
}

function fitAR2(series) {
  const n = series.length;
  if (n < 4) return null;

  let s11 = 0, s12 = 0, s22 = 0, sy1 = 0, sy2 = 0;
  for (let t = 2; t < n; t++) {
    const y  = series[t];
    const y1 = series[t - 1];
    const y2 = series[t - 2];
    s11 += y1 * y1;
    s12 += y1 * y2;
    s22 += y2 * y2;
    sy1 += y  * y1;
    sy2 += y  * y2;
  }

  const det = s11 * s22 - s12 * s12;
  if (Math.abs(det) < 1e-14) return null;

  const beta1 = (sy1 * s22 - sy2 * s12) / det;
  const beta2 = (sy2 * s11 - sy1 * s12) / det;

  let ss_res = 0;
  for (let t = 2; t < n; t++) {
    const pred  = beta1 * series[t - 1] + beta2 * series[t - 2];
    ss_res += (series[t] - pred) ** 2;
  }
  const yVals  = series.slice(2);
  const yMu    = yVals.reduce((s, v) => s + v, 0) / yVals.length;
  const ss_tot = yVals.reduce((s, v) => s + (v - yMu) ** 2, 0);
  const r2 = ss_tot > 1e-14 ? 1 - ss_res / ss_tot : 0;

  return { beta1, beta2, r2 };
}

function eigenModulus(beta1, beta2) {
  const disc = beta1 * beta1 + 4 * beta2;
  if (disc >= 0) {
    const sq = Math.sqrt(disc);
    return Math.max(Math.abs((beta1 + sq) / 2), Math.abs((beta1 - sq) / 2));
  }
  return Math.sqrt(-beta2);
}

function rootType(beta1, beta2) {
  return (beta1 * beta1 + 4 * beta2) >= 0 ? 'real' : 'complex';
}

// ── load GSE179027 ─────────────────────────────────────────────────────────────
const filePath = 'datasets/GSE179027_Mouse_Enteroid_circadian.csv';
const raw  = fs.readFileSync(filePath, 'utf-8').trim().split('\n');
const hdr  = raw[0].split(',');
const ztCols = hdr.slice(1).map(h => parseInt(h.replace('ZT','').trim(), 10));

function findGene(name) {
  for (let i = 1; i < raw.length; i++) {
    const cols = raw[i].split(',');
    if (cols[0].trim() === name) return cols.slice(1).map(Number);
  }
  return null;
}

const ccnd2Row = findGene('Ccnd2');
if (!ccnd2Row) { console.error('Ccnd2 not found in GSE179027'); process.exit(1); }

console.log('Ccnd2 sampling-window sensitivity — GSE179027 mouse enteroid');
console.log(`Full ZT range: ZT${ztCols[0]}–ZT${ztCols[ztCols.length-1]} (${ztCols.length} timepoints)`);
console.log(`φ⁻¹ = 1/φ = ${INV_PHI.toFixed(4)}`);
console.log('');

const windows = [
  { label: 'ZT24–ZT46 (22 h)', maxZT: 46  },
  { label: 'ZT24–ZT48 (24 h)', maxZT: 48  },
  { label: 'ZT24–ZT54 (30 h)', maxZT: 54  },
  { label: 'ZT24–ZT60 (36 h)', maxZT: 60  },
  { label: 'ZT24–ZT70 (46 h — full)', maxZT: 70 },
];

function analyseGene(name, dataRow) {
  console.log(`=== ${name} ===`);
  console.log(`${'Window'.padEnd(30)} ${'N'.padEnd(4)} ${'|λ|'.padEnd(8)} ${'Δ from 1/φ'.padEnd(12)} ${'R²'.padEnd(8)} Roots`);
  console.log('-'.repeat(72));

  const results = [];
  for (const win of windows) {
    const indices = ztCols.map((zt, i) => ({ zt, i })).filter(x => x.zt <= win.maxZT);
    const vals    = indices.map(x => dataRow[x.i]);
    const series  = meanCentre(vals);
    const n       = series.length;

    const fit = fitAR2(series);
    if (!fit) { console.log(`${win.label.padEnd(30)} ${n} OLS failed`); continue; }

    const { beta1, beta2, r2 } = fit;
    const modulus = eigenModulus(beta1, beta2);
    const delta   = Math.abs(modulus - INV_PHI);
    const roots   = rootType(beta1, beta2);

    results.push({ label: win.label, maxZT: win.maxZT, n, modulus, delta, r2, roots, beta1, beta2 });

    console.log(
      `${win.label.padEnd(30)} ${String(n).padEnd(4)} ${modulus.toFixed(4).padEnd(8)} ${delta.toFixed(4).padEnd(12)} ${r2.toFixed(3).padEnd(8)} ${roots}`
    );
  }

  // Note: do NOT print a "recovery threshold" line — that framing implies the short-window value
  // is a recovery of the true signal, which is the opposite of what a diverging artefact shows.
  // Classification is performed below using all windows, not just the 22 h window.

  return results;
}

const ccnd2Results = analyseGene('Ccnd2', ccnd2Row);

// ── Reference values from per2_mad2l1_sampling_window_results.json ──────────
let per2Ref = null, mad2l1Ref = null, notch2Ref = null;
const refPath = 'scripts/per2_mad2l1_sampling_window_results.json';
if (fs.existsSync(refPath)) {
  const ref = JSON.parse(fs.readFileSync(refPath, 'utf-8'));
  per2Ref   = ref.Per2;
  mad2l1Ref = ref.Mad2l1;
  notch2Ref = ref.Notch2_reference;
}

// ── Classification ─────────────────────────────────────────────────────────────
// Classification requires evaluation across ALL windows, not just the 22 h window.
//
//   Per2-like (genuine signal):         φ-proximate at ALL windows (Δ<0.10 at 22 h AND full)
//   Notch2-like (window artefact):      fails at 22 h (Δ>0.20 or R²<0.10), recovers at ≥36 h
//   Mad2l1-like (universally low R²):   R²<0.10 at every window
//   Diverging artefact (new pattern):   φ-proximate at short window but DRIFTS AWAY at longer
//                                       windows; full-window Δ > short-window Δ (reverse of genuine)
console.log('\n\n=== CLASSIFICATION ===');
const r22   = ccnd2Results.find(r => r.maxZT === 46);
const r36   = ccnd2Results.find(r => r.maxZT === 60);
const rFull = ccnd2Results.find(r => r.maxZT === 70);

// Stability requires φ-proximity at BOTH the short AND the full window
const proximateAt22  = r22  && r22.r2  > 0.15 && r22.delta  < 0.10;
const proximateFull  = rFull && rFull.r2 > 0.15 && rFull.delta < 0.10;
const stableAcrossAllWindows = proximateAt22 && proximateFull;

// Notch2-like: absent at 22 h but present at 36 h+
const failsAt22    = r22  && (r22.r2 < 0.10 || r22.delta > 0.20);
const recoversAt36 = r36  && r36.r2 > 0.15 && r36.delta < 0.10;

// Mad2l1-like: universally low R² (no window reaches fit quality threshold)
const lowThroughout = ccnd2Results.every(r => r.r2 < 0.10);

// Diverging artefact: starts near 1/φ at short window but drifts away monotonically
// (full-window Δ substantially larger than 22 h Δ, and full-window Δ > 0.10)
const divergingArtefact = proximateAt22 && !proximateFull &&
                          rFull && r22 && rFull.delta > r22.delta + 0.05;

let classification;
if (stableAcrossAllWindows) {
  classification = 'Per2-like (stable φ-proximity at all window lengths — genuine signal)';
} else if (divergingArtefact) {
  classification = 'Diverging window artefact (φ-proximate at short 22 h window only; drifts away at longer windows — do NOT cite as genuine)';
} else if (failsAt22 && recoversAt36) {
  classification = 'Notch2-like (window artefact — collapses at 22 h, recovers at 36 h)';
} else if (lowThroughout) {
  classification = 'Mad2l1-like (universally low R² — not circadian AR(2))';
} else {
  classification = 'Ambiguous — inspect values manually';
}

console.log(`Ccnd2 classification: ${classification}`);
console.log('');
console.log('Stability diagnostics (genuine signal requires φ-proximity at BOTH short AND full window):');
console.log(`  22 h window: R²=${r22?.r2.toFixed(3) ?? 'N/A'}, |λ|=${r22?.modulus.toFixed(4) ?? 'N/A'}, Δ=${r22?.delta.toFixed(4) ?? 'N/A'} → proximate at 22 h: ${proximateAt22}`);
console.log(`  36 h window: R²=${r36?.r2.toFixed(3) ?? 'N/A'}, |λ|=${r36?.modulus.toFixed(4) ?? 'N/A'}, Δ=${r36?.delta.toFixed(4) ?? 'N/A'}`);
console.log(`  Full window: R²=${rFull?.r2.toFixed(3) ?? 'N/A'}, |λ|=${rFull?.modulus.toFixed(4) ?? 'N/A'}, Δ=${rFull?.delta.toFixed(4) ?? 'N/A'} → proximate at full: ${proximateFull}`);
console.log(`  Stable across all windows: ${stableAcrossAllWindows}`);
console.log(`  Diverging artefact (near 1/φ at 22 h, drifts away): ${divergingArtefact}`);

// ── Four-gene summary table ───────────────────────────────────────────────────
console.log('\n\n=== FOUR-GENE COMPARISON TABLE ===');
console.log('Gene      22 h R²   22 h |λ|   36 h R²   36 h |λ|   Full R²   Full |λ|   Threshold');
console.log('-'.repeat(95));

function row(name, results, overrideClassification) {
  const r22   = results.find(r => r.maxZT === 46);
  const r36   = results.find(r => r.maxZT === 60);
  const rFull = results.find(r => r.maxZT === 70);
  // Stability requires φ-proximity at BOTH 22 h AND the full window
  const proximateAt22  = r22  && r22.r2  > 0.15 && r22.delta  < 0.10;
  const proximateFull  = rFull && rFull.r2 > 0.15 && rFull.delta < 0.10;
  const stableAll = proximateAt22 && proximateFull;
  const diverging = proximateAt22 && !proximateFull && rFull && r22 && rFull.delta > r22.delta + 0.05;
  let thr;
  if (overrideClassification) {
    thr = overrideClassification;
  } else if (stableAll) {
    thr = 'stable (genuine)';
  } else if (diverging) {
    thr = 'diverging artefact';
  } else {
    thr = 'n/a';
  }
  console.log(
    `${name.padEnd(10)}${(r22?.r2 ?? 0).toFixed(3).padEnd(10)}${(r22?.modulus ?? 0).toFixed(4).padEnd(12)}${(r36?.r2 ?? 0).toFixed(3).padEnd(10)}${(r36?.modulus ?? 0).toFixed(4).padEnd(12)}${(rFull?.r2 ?? 0).toFixed(3).padEnd(10)}${(rFull?.modulus ?? 0).toFixed(4).padEnd(12)}${thr}`
  );
}

if (per2Ref)   row('Per2',   per2Ref,   'stable (genuine)');
if (mad2l1Ref) row('Mad2l1', mad2l1Ref, 'low R² (noise)');
row('Ccnd2', ccnd2Results);

// Notch2 hardcoded reference
const notch2Data = notch2Ref ?? [
  { maxZT: 46, r2: 0.036, modulus: 0.2851, delta: 0.3329 },
  { maxZT: 60, r2: 0.250, modulus: 0.5906, delta: 0.0274 },
  { maxZT: 70, r2: 0.294, modulus: 0.6367, delta: 0.0187 },
];
const n22r = notch2Data.find(r => r.maxZT === 46);
const n36r = notch2Data.find(r => r.maxZT === 60);
const nFr  = notch2Data.find(r => r.maxZT === 70);
console.log(
  `${'Notch2'.padEnd(10)}${(n22r?.r2 ?? 0).toFixed(3).padEnd(10)}${(n22r?.modulus ?? 0).toFixed(4).padEnd(12)}${(n36r?.r2 ?? 0).toFixed(3).padEnd(10)}${(n36r?.modulus ?? 0).toFixed(4).padEnd(12)}${(nFr?.r2 ?? 0).toFixed(3).padEnd(10)}${(nFr?.modulus ?? 0).toFixed(4).padEnd(12)}~36 h`
);

// ── Save ───────────────────────────────────────────────────────────────────────
const outPath = 'scripts/ccnd2_sampling_window_results.json';
fs.writeFileSync(outPath, JSON.stringify({
  gene: 'Ccnd2',
  dataset: 'GSE179027',
  invPhi: INV_PHI,
  classification,
  results: ccnd2Results
}, null, 2));
console.log(`\nResults saved to ${outPath}`);
