#!/usr/bin/env node
// Cosinor phase analysis for G2/M and G1/S focal genes in both gut datasets
// Fits y = A + B*sin(2π*t/24) + C*cos(2π*t/24) via OLS; acrophase = atan2(B,C) → CT hours

const fs = require('fs');

// ─── Parse CSV ────────────────────────────────────────────────────────────────
function parseCSV(path, ztPrefix) {
  const lines = fs.readFileSync(path, 'utf8').trim().split('\n');
  const header = lines[0].split(',');
  const timepoints = header.slice(1).map(h => {
    const s = h.replace(ztPrefix, '').trim();
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

// ─── Cosinor OLS fit ──────────────────────────────────────────────────────────
// Fits: y = A + B*sin(2π*t/24) + C*cos(2π*t/24)
// Acrophase φ = atan2(B, C); CT peak = (φ * 24 / (2π) + 24) % 24
// Amplitude = sqrt(B² + C²) / mean(y)   (relative)
// R² from residuals
function fitCosinor(timepoints, vals, period) {
  period = period || 24;
  const n = vals.length;
  if (n < 3) return null;

  // Build design matrix [1, sin, cos]
  const omega = 2 * Math.PI / period;
  const X = timepoints.map(t => [1, Math.sin(omega * t), Math.cos(omega * t)]);
  const y = vals;

  // OLS via normal equations: (X'X) β = X'y  (3×3 system)
  // X'X
  let s11=0, s12=0, s13=0, s22=0, s23=0, s33=0;
  let sy1=0, sy2=0, sy3=0;
  for (let i = 0; i < n; i++) {
    const [x1, x2, x3] = X[i];
    s11 += x1*x1; s12 += x1*x2; s13 += x1*x3;
    s22 += x2*x2; s23 += x2*x3; s33 += x3*x3;
    sy1 += x1*y[i]; sy2 += x2*y[i]; sy3 += x3*y[i];
  }

  // Invert 3×3 symmetric matrix via cofactors
  const M = [[s11,s12,s13],[s12,s22,s23],[s13,s23,s33]];
  const det =
    M[0][0]*(M[1][1]*M[2][2]-M[1][2]*M[2][1]) -
    M[0][1]*(M[1][0]*M[2][2]-M[1][2]*M[2][0]) +
    M[0][2]*(M[1][0]*M[2][1]-M[1][1]*M[2][0]);
  if (Math.abs(det) < 1e-15) return null;

  const inv = [
    [(M[1][1]*M[2][2]-M[1][2]*M[2][1])/det, -(M[0][1]*M[2][2]-M[0][2]*M[2][1])/det,  (M[0][1]*M[1][2]-M[0][2]*M[1][1])/det],
    [-(M[1][0]*M[2][2]-M[1][2]*M[2][0])/det,  (M[0][0]*M[2][2]-M[0][2]*M[2][0])/det, -(M[0][0]*M[1][2]-M[0][2]*M[1][0])/det],
    [(M[1][0]*M[2][1]-M[1][1]*M[2][0])/det, -(M[0][0]*M[2][1]-M[0][1]*M[2][0])/det,  (M[0][0]*M[1][1]-M[0][1]*M[1][0])/det],
  ];

  const rhs = [sy1, sy2, sy3];
  const beta = [0, 0, 0];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) beta[i] += inv[i][j]*rhs[j];

  const [A, B, Cv] = beta;

  // Fitted values and R²
  const yhat = timepoints.map((t, i) => A + B*Math.sin(omega*t) + Cv*Math.cos(omega*t));
  const ymean = y.reduce((s,v)=>s+v,0)/n;
  const ss_tot = y.reduce((s,v)=>s+(v-ymean)**2, 0);
  const ss_res = y.reduce((s,v,i)=>s+(v-yhat[i])**2, 0);
  const r2 = ss_tot > 0 ? 1 - ss_res/ss_tot : 0;

  // Acrophase: peak phase in the cosine component convention
  // y ≈ A + R*cos(ωt - φ)  where R = sqrt(B²+C²), tan(φ) = B/C
  // φ = atan2(B, C);  CT_peak = (φ / ω + 24) % 24
  const phi = Math.atan2(B, Cv); // radians
  const ctPeak = ((phi / omega) % period + period) % period;

  const amplitude = Math.sqrt(B*B + Cv*Cv); // absolute amplitude
  const relAmplitude = A > 0 ? amplitude / A : NaN; // relative to mean

  return { A, B, C: Cv, phi, ctPeak, amplitude, relAmplitude, r2 };
}

// ─── BMAL1 target phase alignment ────────────────────────────────────────────
// Known BMAL1-driven transcriptional peaks (from literature):
// BMAL1:CLOCK peak binding ~CT6; Wee1 mRNA peak ~CT4-6 (Matsuo et al. 2003)
// Known phases from Yan et al., Zhang et al. 2014 (liver): Per2 ~CT12, Bmal1 ~CT0
// For intestinal tissue: Per2 expected ~CT12-14, Bmal1 ~CT0-2
// BMAL1 target zone: CT0-CT8 (activation window)
// G2/M checkpoint genes driven by BMAL1 should peak in CT0-CT8
// G1/S genes: CDT1 peaks in late G1 (~CT8-16?), GMNN peaks in S/G2/M (~CT0-CT8 in fast-cycling)

function phaseAlignment(ctPeak) {
  // BMAL1 direct target window: CT0-CT8
  if (ctPeak <= 8 || ctPeak >= 20) return 'BMAL1 window (CT0-8)';
  if (ctPeak >= 10 && ctPeak <= 16) return 'PER/CRY window (CT10-16)';
  return 'transition phase';
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const mousePath = 'datasets/GSE179027_Mouse_Enteroid_circadian.csv';
const humanPath = 'datasets/GSE161566_Human_Enteroid_circadian.csv';

const mouseData = parseCSV(mousePath, 'ZT');
const humanData = parseCSV(humanPath, 'CH_');

// Focal genes
const focalGenes = [
  { mouse: 'Wee1',   human: 'WEE1',   category: 'G2/M checkpoint' },
  { mouse: 'Cdk1',   human: 'CDK1',   category: 'G2/M CDK' },
  { mouse: 'Gmnn',   human: 'GMNN',   category: 'G1/S licensing (geminin)' },
  { mouse: 'Cdt1',   human: 'CDT1',   category: 'G1/S licensing' },
  { mouse: 'Mcm6',   human: 'MCM6',   category: 'G1/S MCM' },
  { mouse: 'Mad2l1', human: 'MAD2L1', category: 'G2/M SAC' },
];

function analyzeGene(symbol, data, datasetLabel) {
  if (!data[symbol]) return { symbol, found: false, dataset: datasetLabel };
  const { timepoints, vals } = data[symbol];
  const fit = fitCosinor(timepoints, vals, 24);
  if (!fit) return { symbol, found: true, fitOk: false, dataset: datasetLabel };
  return {
    symbol, found: true, fitOk: true, dataset: datasetLabel,
    ctPeak: fit.ctPeak, r2: fit.r2, relAmplitude: fit.relAmplitude,
    alignment: phaseAlignment(fit.ctPeak),
    phi_deg: fit.phi * 180 / Math.PI,
  };
}

console.log('========================================================');
console.log('  COSINOR PHASE ANALYSIS — G2/M and G1/S Focal Genes');
console.log('  GSE179027 (mouse) & GSE161566 (human) intestinal enteroids');
console.log('========================================================\n');
console.log('Period = 24 h. Acrophase computed as CT peak of best-fit cosine.');
console.log('BMAL1 direct target window: CT0–CT8 (Matsuo et al. 2003, Ripperger & Schibler 2006)\n');

const results = [];
for (const gene of focalGenes) {
  const mr = analyzeGene(gene.mouse, mouseData, 'GSE179027');
  const hr = analyzeGene(gene.human, humanData, 'GSE161566');
  results.push({ ...gene, mr, hr });
}

// ─── Summary table ────────────────────────────────────────────────────────────
console.log('Gene pair'.padEnd(16) + 'Category'.padEnd(30) +
  'Mouse CT peak'.padStart(14) + 'Mouse R²'.padStart(10) +
  'Human CT peak'.padStart(14) + 'Human R²'.padStart(10) + '  BMAL1 alignment');
console.log('-'.repeat(110));

for (const r of results) {
  const mPeak = r.mr.found && r.mr.fitOk ? r.mr.ctPeak.toFixed(1) + 'h' : 'N/A';
  const mR2   = r.mr.found && r.mr.fitOk ? r.mr.r2.toFixed(3) : 'N/A';
  const hPeak = r.hr.found && r.hr.fitOk ? r.hr.ctPeak.toFixed(1) + 'h' : 'N/A';
  const hR2   = r.hr.found && r.hr.fitOk ? r.hr.r2.toFixed(3) : 'N/A';
  const mAlign = r.mr.found && r.mr.fitOk ? r.mr.alignment : '';
  const hAlign = r.hr.found && r.hr.fitOk ? r.hr.alignment : '';

  console.log(
    (r.mouse + '/' + r.human).padEnd(16) +
    r.category.padEnd(30) +
    mPeak.padStart(14) + mR2.padStart(10) +
    hPeak.padStart(14) + hR2.padStart(10) +
    '  mouse:' + mAlign + ' / human:' + hAlign
  );
}

// ─── Detailed output ──────────────────────────────────────────────────────────
console.log('\n\n=== Detailed cosinor results ===\n');
for (const r of results) {
  console.log(`--- ${r.mouse}/${r.human} (${r.category}) ---`);
  const mr = r.mr, hr = r.hr;
  if (mr.found && mr.fitOk) {
    const bmal1 = (mr.ctPeak <= 8 || mr.ctPeak >= 20) ? '✓ within BMAL1 window' : '✗ outside BMAL1 window';
    console.log(`  Mouse (${mr.dataset}): CT peak = ${mr.ctPeak.toFixed(1)}h, R² = ${mr.r2.toFixed(3)}, rel.amp = ${(mr.relAmplitude*100).toFixed(1)}%  [${bmal1}]`);
  } else {
    console.log(`  Mouse: ${!mr.found ? 'NOT FOUND in dataset' : 'FIT FAILED'}`);
  }
  if (hr.found && hr.fitOk) {
    const bmal1 = (hr.ctPeak <= 8 || hr.ctPeak >= 20) ? '✓ within BMAL1 window' : '✗ outside BMAL1 window';
    console.log(`  Human (${hr.dataset}): CT peak = ${hr.ctPeak.toFixed(1)}h, R² = ${hr.r2.toFixed(3)}, rel.amp = ${(hr.relAmplitude*100).toFixed(1)}%  [${bmal1}]`);
  } else {
    console.log(`  Human: ${!hr.found ? 'NOT FOUND in dataset' : 'FIT FAILED'}`);
  }
  console.log('');
}

// ─── Hypothesis check ────────────────────────────────────────────────────────
console.log('\n=== BMAL1→Wee1 MECHANISTIC LINK ASSESSMENT ===\n');
console.log('Prediction: Wee1 in mouse gut should peak CT0-CT8 (BMAL1→Wee1 direct target, Matsuo 2003).\n');

const wee1 = results.find(r => r.mouse === 'Wee1');
if (wee1 && wee1.mr.found && wee1.mr.fitOk) {
  const ct = wee1.mr.ctPeak;
  const inWindow = ct <= 8 || ct >= 20;
  console.log(`Wee1 mouse CT peak: ${ct.toFixed(1)}h`);
  console.log(`  → ${inWindow ? '✓ CONSISTENT with BMAL1→Wee1 mechanism (CT0-8 window)' : '✗ OUTSIDE BMAL1 window — mechanistic link weakened'}`);
  console.log(`  R² = ${wee1.mr.r2.toFixed(3)} (${wee1.mr.r2 > 0.15 ? 'moderate-good fit' : wee1.mr.r2 > 0.05 ? 'weak fit' : 'very poor fit — interpret cautiously'})`);
}
if (wee1 && wee1.hr.found && wee1.hr.fitOk) {
  const ct = wee1.hr.ctPeak;
  const inWindow = ct <= 8 || ct >= 20;
  console.log(`\nWEE1 human CT peak: ${ct.toFixed(1)}h`);
  console.log(`  → ${inWindow ? '✓ within BMAL1 window' : '✗ outside BMAL1 window'}`);
  console.log(`  R² = ${wee1.hr.r2.toFixed(3)}`);
}

const gmnn = results.find(r => r.mouse === 'Gmnn');
if (gmnn && gmnn.mr.found && gmnn.mr.fitOk && gmnn.hr.found && gmnn.hr.fitOk) {
  console.log(`\nGmnn/GMNN (geminin, G1/S licensing antagonist):`);
  console.log(`  Mouse CT peak: ${gmnn.mr.ctPeak.toFixed(1)}h (R²=${gmnn.mr.r2.toFixed(3)})`);
  console.log(`  Human CT peak: ${gmnn.hr.ctPeak.toFixed(1)}h (R²=${gmnn.hr.r2.toFixed(3)})`);
  console.log(`  Geminin peaks in S/G2/M (high) and is low in G1 — expected peak CT0-8 if driven by BMAL1:CLOCK-gated G2/M entry.`);
}
