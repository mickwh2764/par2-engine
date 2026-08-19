/**
 * Sampling-window sensitivity analysis for Per2 and Mad2l1 in GSE179027
 *
 * Question: do Per2 and Mad2l1 show the same ~36 h recovery threshold
 * as Notch2, making the 36 h minimum-window criterion gene-independent
 * (dataset-level) rather than Notch2-specific?
 *
 * Method: identical AR(2) OLS to notch2_sampling_window.cjs.
 * Windows: ZT24–ZT46, ZT24–ZT48, ZT24–ZT54, ZT24–ZT60, ZT24–ZT70.
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

const per2Row   = findGene('Per2');
const mad2l1Row = findGene('Mad2l1');

if (!per2Row)   { console.error('Per2 not found in GSE179027');   process.exit(1); }
if (!mad2l1Row) { console.error('Mad2l1 not found in GSE179027'); process.exit(1); }

console.log('Per2 and Mad2l1 sampling-window sensitivity — GSE179027 mouse enteroid');
console.log(`Full ZT range: ZT${ztCols[0]}–ZT${ztCols[ztCols.length-1]} (${ztCols.length} timepoints)`);
console.log(`φ⁻¹ = 1/φ = ${INV_PHI.toFixed(4)}`);
console.log('');

const windows = [
  { label: 'ZT24–ZT46 (22 h)', maxZT: 46  },
  { label: 'ZT24–ZT48 (24 h)', maxZT: 48  },
  { label: 'ZT24–ZT54 (30 h)', maxZT: 54  },
  { label: 'ZT24–ZT60 (36 h)', maxZT: 60  },
  { label: 'ZT24–ZT70 (46 h — full)', maxZT: 70  },
];

function analyseGene(name, dataRow) {
  console.log(`\n=== ${name} ===`);
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

  // Threshold detection: first window where R² > 0.15 AND roots are real AND |λ| within 0.10 of 1/φ
  const recovered = results.filter(r => r.r2 > 0.15 && r.roots === 'real' && r.delta < 0.10);
  if (recovered.length > 0) {
    const first = recovered[0];
    const windowH = first.maxZT - 24;
    console.log(`\n  ✓ Recovery threshold: ~${windowH} h (${first.label})`);
    console.log(`    First window with R²>${0.15.toFixed(2)}, real roots, Δ<0.10: N=${first.n}, |λ|=${first.modulus.toFixed(4)}, R²=${first.r2.toFixed(3)}`);
  } else {
    console.log('\n  ✗ No clear recovery threshold within tested windows');
  }

  return results;
}

const per2Results   = analyseGene('Per2',   per2Row);
const mad2l1Results = analyseGene('Mad2l1', mad2l1Row);

// ── Notch2 reference (from prior analysis) ────────────────────────────────────
console.log('\n\n=== NOTCH2 reference (from notch2_sampling_window.cjs) ===');
const notch2Ref = [
  { label: 'ZT24–ZT46 (22 h)', maxZT: 46, n: 12, modulus: 0.2851, delta: 0.3329, r2: 0.036, roots: 'complex' },
  { label: 'ZT24–ZT48 (24 h)', maxZT: 48, n: 13, modulus: 0.2987, delta: 0.3193, r2: 0.034, roots: 'complex' },
  { label: 'ZT24–ZT54 (30 h)', maxZT: 54, n: 16, modulus: 0.3295, delta: 0.2885, r2: 0.150, roots: 'real'    },
  { label: 'ZT24–ZT60 (36 h)', maxZT: 60, n: 19, modulus: 0.5906, delta: 0.0274, r2: 0.250, roots: 'real'    },
  { label: 'ZT24–ZT70 (46 h — full)', maxZT: 70, n: 24, modulus: 0.6367, delta: 0.0187, r2: 0.294, roots: 'real' },
];
console.log(`${'Window'.padEnd(30)} ${'N'.padEnd(4)} ${'|λ|'.padEnd(8)} ${'Δ from 1/φ'.padEnd(12)} ${'R²'.padEnd(8)} Roots`);
console.log('-'.repeat(72));
for (const r of notch2Ref) {
  console.log(
    `${r.label.padEnd(30)} ${String(r.n).padEnd(4)} ${r.modulus.toFixed(4).padEnd(8)} ${r.delta.toFixed(4).padEnd(12)} ${r.r2.toFixed(3).padEnd(8)} ${r.roots}`
  );
}
console.log('\n  ✓ Recovery threshold: ~36 h (ZT24–ZT60)');

// ── summary comparison ─────────────────────────────────────────────────────────
console.log('\n\n=== THREE-GENE THRESHOLD SUMMARY ===');
console.log('Gene      22 h R²   22 h |λ|   36 h R²   36 h |λ|   Full R²   Full |λ|   Threshold');
console.log('-'.repeat(95));

function summarise(name, results, notch2mode) {
  if (notch2mode) {
    const r22 = notch2Ref.find(r => r.maxZT === 46);
    const r36 = notch2Ref.find(r => r.maxZT === 60);
    const rFull = notch2Ref.find(r => r.maxZT === 70);
    const thr = '~36 h';
    console.log(`${'Notch2'.padEnd(10)}${r22.r2.toFixed(3).padEnd(10)}${r22.modulus.toFixed(4).padEnd(12)}${r36.r2.toFixed(3).padEnd(10)}${r36.modulus.toFixed(4).padEnd(12)}${rFull.r2.toFixed(3).padEnd(10)}${rFull.modulus.toFixed(4).padEnd(12)}${thr}`);
    return;
  }
  const r22   = results.find(r => r.maxZT === 46);
  const r36   = results.find(r => r.maxZT === 60);
  const rFull = results.find(r => r.maxZT === 70);
  const recovered = results.filter(r => r.r2 > 0.15 && r.roots === 'real' && r.delta < 0.10);
  const thr = recovered.length > 0 ? `~${recovered[0].maxZT - 24} h` : 'none';
  console.log(
    `${name.padEnd(10)}${(r22?.r2 ?? 0).toFixed(3).padEnd(10)}${(r22?.modulus ?? 0).toFixed(4).padEnd(12)}${(r36?.r2 ?? 0).toFixed(3).padEnd(10)}${(r36?.modulus ?? 0).toFixed(4).padEnd(12)}${(rFull?.r2 ?? 0).toFixed(3).padEnd(10)}${(rFull?.modulus ?? 0).toFixed(4).padEnd(12)}${thr}`
  );
}

summarise('Per2',   per2Results,   false);
summarise('Mad2l1', mad2l1Results, false);
summarise('Notch2', null,          true);

// ── save results ───────────────────────────────────────────────────────────────
const outPath = 'scripts/per2_mad2l1_sampling_window_results.json';
fs.writeFileSync(outPath, JSON.stringify({
  invPhi: INV_PHI,
  Per2:   per2Results,
  Mad2l1: mad2l1Results,
  Notch2_reference: notch2Ref
}, null, 2));
console.log(`\nResults saved to ${outPath}`);
