/**
 * Sampling-window sensitivity analysis for TEF and NOTCH2 in GSE161566
 *
 * Question: do TEF and NOTCH2 in human intestinal enteroid show the same
 * ~36 h recovery threshold as Notch2 (mouse, GSE179027), confirming the
 * threshold is a dataset-level criterion, or do they show different
 * sensitivity characteristics?
 *
 * Five focal genes across two species now fully checked:
 *   Mouse GSE179027: Per2 (circadian), Mad2l1 (cell-cycle), Notch2 (Notch)
 *   Human GSE161566: TEF  (circadian), NOTCH2 (Notch)  ← this script
 *
 * Method: identical AR(2) OLS to per2_mad2l1_sampling_window.cjs.
 * Windows: CH_24–CH_46 (22 h), CH_24–CH_48 (24 h), CH_24–CH_54 (30 h),
 *          CH_24–CH_60 (36 h), CH_24–CH_70 (46 h — full series).
 * Dataset uses raw TPM values; mean-centering applied before OLS (no log2).
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

// ── load dataset ───────────────────────────────────────────────────────────────
const filePath = 'datasets/GSE161566_Human_Enteroid_circadian.csv';
const raw  = fs.readFileSync(filePath, 'utf-8').trim().split('\n');
const hdr  = raw[0].split(',');
// CH_24, CH_26, … → numeric times
const ctTimes = hdr.slice(1).map(h => parseInt(h.replace('CH_', '').trim(), 10));

function findGene(name) {
  for (let i = 1; i < raw.length; i++) {
    const cols = raw[i].split(',');
    if (cols[0].trim() === name) return cols.slice(1).map(Number);
  }
  return null;
}

const tefRow    = findGene('TEF');
const notch2Row = findGene('NOTCH2');

if (!tefRow)    { console.error('TEF not found in GSE161566');    process.exit(1); }
if (!notch2Row) { console.error('NOTCH2 not found in GSE161566'); process.exit(1); }

console.log('TEF and NOTCH2 sampling-window sensitivity — GSE161566 human intestinal enteroid');
console.log(`Full CH range: CH_${ctTimes[0]}–CH_${ctTimes[ctTimes.length-1]} (${ctTimes.length} timepoints, 2h steps)`);
console.log(`φ⁻¹ = 1/φ = ${INV_PHI.toFixed(4)}`);
console.log('');

// Windows defined by maximum CT time to include (identical to mouse analysis)
const windows = [
  { label: 'CT24–CT46 (22 h)', maxCT: 46  },
  { label: 'CT24–CT48 (24 h)', maxCT: 48  },
  { label: 'CT24–CT54 (30 h)', maxCT: 54  },
  { label: 'CT24–CT60 (36 h)', maxCT: 60  },
  { label: 'CT24–CT70 (46 h — full)', maxCT: 70  },
];

function analyseGene(name, dataRow) {
  console.log(`\n=== ${name} ===`);
  console.log(`${'Window'.padEnd(30)} ${'N'.padEnd(4)} ${'|λ|'.padEnd(8)} ${'Δ from 1/φ'.padEnd(12)} ${'R²'.padEnd(8)} Roots`);
  console.log('-'.repeat(72));

  const results = [];
  for (const win of windows) {
    const indices = ctTimes.map((ct, i) => ({ ct, i })).filter(x => x.ct <= win.maxCT);
    const vals    = indices.map(x => dataRow[x.i]);
    const series  = meanCentre(vals);
    const n       = series.length;

    const fit = fitAR2(series);
    if (!fit) { console.log(`${win.label.padEnd(30)} ${n} OLS failed`); continue; }

    const { beta1, beta2, r2 } = fit;
    const modulus = eigenModulus(beta1, beta2);
    const delta   = Math.abs(modulus - INV_PHI);
    const roots   = rootType(beta1, beta2);

    results.push({ label: win.label, maxCT: win.maxCT, n, modulus, delta, r2, roots, beta1, beta2 });

    console.log(
      `${win.label.padEnd(30)} ${String(n).padEnd(4)} ${modulus.toFixed(4).padEnd(8)} ${delta.toFixed(4).padEnd(12)} ${r2.toFixed(3).padEnd(8)} ${roots}`
    );
  }

  // Threshold detection: first window where R² > 0.15 AND |λ| within 0.10 of 1/φ
  const recovered = results.filter(r => r.r2 > 0.15 && r.delta < 0.10);
  if (recovered.length > 0) {
    const first = recovered[0];
    const windowH = first.maxCT - 24;
    console.log(`\n  ✓ Recovery threshold: ~${windowH} h (${first.label})`);
    console.log(`    First window with R²>0.15, Δ<0.10: N=${first.n}, |λ|=${first.modulus.toFixed(4)}, R²=${first.r2.toFixed(3)}`);
  } else {
    // Check if R² is high throughout (like Per2) or low throughout (like Mad2l1)
    const full = results.find(r => r.maxCT === 70);
    if (full && full.r2 > 0.15) {
      console.log('\n  ~ R² > 0.15 not reached at short windows — checking full series ...');
    } else {
      console.log('\n  ✗ No clear recovery threshold — R² consistently low, or |λ| far from 1/φ throughout');
    }
  }

  // Also check TEF/Per2-style: good R² at 22 h already?
  const w22 = results.find(r => r.maxCT === 46);
  if (w22 && w22.r2 > 0.15 && w22.delta < 0.10) {
    console.log(`  ✓ Already reliable at 22 h: R²=${w22.r2.toFixed(3)}, |λ|=${w22.modulus.toFixed(4)} (Δ=${w22.delta.toFixed(4)})`);
  }

  return results;
}

const tefResults    = analyseGene('TEF',    tefRow);
const notch2Results = analyseGene('NOTCH2', notch2Row);

// ── Mouse Notch2 reference from prior analysis ─────────────────────────────────
console.log('\n\n=== Notch2 reference (mouse GSE179027, notch2_sampling_window.cjs) ===');
const notch2MouseRef = [
  { label: 'ZT24–ZT46 (22 h)', maxCT: 46, n: 12, modulus: 0.2851, delta: 0.3329, r2: 0.036, roots: 'complex' },
  { label: 'ZT24–ZT48 (24 h)', maxCT: 48, n: 13, modulus: 0.2987, delta: 0.3193, r2: 0.034, roots: 'complex' },
  { label: 'ZT24–ZT54 (30 h)', maxCT: 54, n: 16, modulus: 0.3295, delta: 0.2885, r2: 0.150, roots: 'real'    },
  { label: 'ZT24–ZT60 (36 h)', maxCT: 60, n: 19, modulus: 0.5906, delta: 0.0274, r2: 0.250, roots: 'real'    },
  { label: 'ZT24–ZT70 (46 h — full)', maxCT: 70, n: 24, modulus: 0.6367, delta: 0.0187, r2: 0.294, roots: 'real' },
];
console.log(`${'Window'.padEnd(30)} ${'N'.padEnd(4)} ${'|λ|'.padEnd(8)} ${'Δ from 1/φ'.padEnd(12)} ${'R²'.padEnd(8)} Roots`);
console.log('-'.repeat(72));
for (const r of notch2MouseRef) {
  console.log(
    `${r.label.padEnd(30)} ${String(r.n).padEnd(4)} ${r.modulus.toFixed(4).padEnd(8)} ${r.delta.toFixed(4).padEnd(12)} ${r.r2.toFixed(3).padEnd(8)} ${r.roots}`
  );
}
console.log('\n  ✓ Recovery threshold: ~36 h (ZT24–ZT60)');

// ── Five-gene summary ───────────────────────────────────────────────────────────
console.log('\n\n=== FIVE-GENE THRESHOLD SUMMARY (all focal genes, both species) ===');
console.log('Gene      Dataset    22 h R²   22 h |λ| (Δ)     36 h R²   36 h |λ| (Δ)     Full R²   Full |λ| (Δ)     Threshold');
console.log('-'.repeat(115));

function summariseLine(name, dataset, results, refMode) {
  if (refMode) {
    const r22  = notch2MouseRef.find(r => r.maxCT === 46);
    const r36  = notch2MouseRef.find(r => r.maxCT === 60);
    const rFull= notch2MouseRef.find(r => r.maxCT === 70);
    console.log(
      `${'Notch2'.padEnd(10)}${dataset.padEnd(11)}` +
      `${r22.r2.toFixed(3).padEnd(10)}${(r22.modulus.toFixed(4)+' ('+r22.delta.toFixed(4)+')').padEnd(17)}` +
      `${r36.r2.toFixed(3).padEnd(10)}${(r36.modulus.toFixed(4)+' ('+r36.delta.toFixed(4)+')').padEnd(17)}` +
      `${rFull.r2.toFixed(3).padEnd(10)}${(rFull.modulus.toFixed(4)+' ('+rFull.delta.toFixed(4)+')').padEnd(17)}` +
      `~36 h`
    );
    return;
  }
  const r22  = results.find(r => r.maxCT === 46);
  const r36  = results.find(r => r.maxCT === 60);
  const rFull= results.find(r => r.maxCT === 70);

  const recovered = results.filter(r => r.r2 > 0.15 && r.delta < 0.10);
  let thr;
  if (recovered.length > 0) {
    const first = recovered[0];
    thr = `~${first.maxCT - 24} h`;
  } else {
    const full = results.find(r => r.maxCT === 70);
    if (full && full.r2 > 0.30) thr = 'always reliable';
    else thr = 'none in range';
  }

  const fmt22  = r22  ? r22.r2.toFixed(3) +'   '+ r22.modulus.toFixed(4)  +' ('+r22.delta.toFixed(4)+')'  : '—';
  const fmt36  = r36  ? r36.r2.toFixed(3) +'   '+ r36.modulus.toFixed(4)  +' ('+r36.delta.toFixed(4)+')'  : '—';
  const fmtFull= rFull? rFull.r2.toFixed(3)+'   '+rFull.modulus.toFixed(4)+' ('+rFull.delta.toFixed(4)+')': '—';

  console.log(
    `${name.padEnd(10)}${dataset.padEnd(11)}` +
    `${(r22?.r2 ?? 0).toFixed(3).padEnd(10)}${(r22?.modulus.toFixed(4)+' ('+r22?.delta.toFixed(4)+')').padEnd(17)}` +
    `${(r36?.r2 ?? 0).toFixed(3).padEnd(10)}${(r36?.modulus.toFixed(4)+' ('+r36?.delta.toFixed(4)+')').padEnd(17)}` +
    `${(rFull?.r2 ?? 0).toFixed(3).padEnd(10)}${(rFull?.modulus.toFixed(4)+' ('+rFull?.delta.toFixed(4)+')').padEnd(17)}` +
    thr
  );
}

// Mouse genes (from prior scripts)
const per2MouseRef = [
  { maxCT: 46, n: 12, modulus: 0.6396, delta: 0.0216, r2: 0.652, roots: 'complex' },
  { maxCT: 48, n: 13, modulus: 0.6658, delta: 0.0477, r2: 0.630, roots: 'complex' },
  { maxCT: 54, n: 16, modulus: 0.6969, delta: 0.0789, r2: 0.655, roots: 'complex' },
  { maxCT: 60, n: 19, modulus: 0.6557, delta: 0.0377, r2: 0.590, roots: 'complex' },
  { maxCT: 70, n: 24, modulus: 0.6311, delta: 0.0131, r2: 0.619, roots: 'complex' },
];
const mad2l1MouseRef = [
  { maxCT: 46, n: 12, modulus: 0.5333, delta: 0.0847, r2: 0.089, roots: 'real' },
  { maxCT: 48, n: 13, modulus: 0.5367, delta: 0.0813, r2: 0.068, roots: 'real' },
  { maxCT: 54, n: 16, modulus: 0.3875, delta: 0.2305, r2: 0.039, roots: 'real' },
  { maxCT: 60, n: 19, modulus: 0.6046, delta: 0.0134, r2: 0.066, roots: 'real' },
  { maxCT: 70, n: 24, modulus: 0.6173, delta: 0.0008, r2: 0.137, roots: 'real' },
];

// Adapt summariseLine for reference arrays
function summariseRef(name, dataset, refArr, label22, label36, labelFull) {
  const r22  = refArr.find(r => r.maxCT === 46);
  const r36  = refArr.find(r => r.maxCT === 60);
  const rFull= refArr.find(r => r.maxCT === 70);
  // threshold from prior analysis
  const thr = (name === 'Per2') ? 'always reliable' : (name === 'Mad2l1') ? 'none (low R²)' : '~36 h';
  console.log(
    `${name.padEnd(10)}${dataset.padEnd(11)}` +
    `${r22.r2.toFixed(3).padEnd(10)}${(r22.modulus.toFixed(4)+' ('+r22.delta.toFixed(4)+')').padEnd(17)}` +
    `${r36.r2.toFixed(3).padEnd(10)}${(r36.modulus.toFixed(4)+' ('+r36.delta.toFixed(4)+')').padEnd(17)}` +
    `${rFull.r2.toFixed(3).padEnd(10)}${(rFull.modulus.toFixed(4)+' ('+rFull.delta.toFixed(4)+')').padEnd(17)}` +
    thr
  );
}

summariseRef('Per2',   'GSE179027', per2MouseRef);
summariseRef('Mad2l1', 'GSE179027', mad2l1MouseRef);
summariseLine('Notch2', 'GSE179027', null, true);
summariseLine('TEF',    'GSE161566', tefResults, false);
summariseLine('NOTCH2', 'GSE161566', notch2Results, false);

// ── save results ───────────────────────────────────────────────────────────────
const outPath = 'scripts/tef_notch2_sampling_window_results.json';
fs.writeFileSync(outPath, JSON.stringify({
  dataset: 'GSE161566_Human_Enteroid_circadian.csv',
  invPhi: INV_PHI,
  TEF:    tefResults,
  NOTCH2: notch2Results,
  mouse_references: {
    Per2:   per2MouseRef,
    Mad2l1: mad2l1MouseRef,
    Notch2: notch2MouseRef
  }
}, null, 2));
console.log(`\nResults saved to ${outPath}`);
