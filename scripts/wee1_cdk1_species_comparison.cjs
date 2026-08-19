#!/usr/bin/env node
// AR(2) species comparison: Wee1/CDK1 axis (G2/M) vs CDT1/GMNN (G1/S licensing)
// Genes: Wee1/WEE1, Cdk1/CDK1, Cdt1/CDT1, Gmnn/GMNN, Cdkn1a/CDKN1A
// Both GSE179027 (mouse) and GSE161566 (human)

const fs = require('fs');

const PHI = (1 + Math.sqrt(5)) / 2;
const PHI_RECIP = 1 / PHI; // ≈ 0.6180

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

// ─── Cosinor OLS fit ──────────────────────────────────────────────────────────
// Fits: y = A + B*sin(2π*t/T) + C*cos(2π*t/T)
// Acrophase φ = atan2(B, C); CT peak = (φ / ω + T) % T
// Returns { ctPeak (h), amplitude (relative to mean), r2 }
function fitCosinor(timepoints, vals, period) {
  period = period || 24;
  const n = vals.length;
  if (n < 3) return null;
  const omega = 2 * Math.PI / period;

  // Design matrix [1, sin, cos]; OLS via 3×3 normal equations
  let s11=0, s12=0, s13=0, s22=0, s23=0, s33=0, sy1=0, sy2=0, sy3=0;
  for (let i = 0; i < n; i++) {
    const t = timepoints[i];
    const x1=1, x2=Math.sin(omega*t), x3=Math.cos(omega*t);
    s11+=x1*x1; s12+=x1*x2; s13+=x1*x3;
    s22+=x2*x2; s23+=x2*x3; s33+=x3*x3;
    sy1+=x1*vals[i]; sy2+=x2*vals[i]; sy3+=x3*vals[i];
  }
  const M = [[s11,s12,s13],[s12,s22,s23],[s13,s23,s33]];
  const det = M[0][0]*(M[1][1]*M[2][2]-M[1][2]*M[2][1])
            - M[0][1]*(M[1][0]*M[2][2]-M[1][2]*M[2][0])
            + M[0][2]*(M[1][0]*M[2][1]-M[1][1]*M[2][0]);
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

  const ymean = vals.reduce((s,v)=>s+v,0)/n;
  const ss_tot = vals.reduce((s,v)=>s+(v-ymean)**2, 0);
  const ss_res = vals.reduce((s,v,i)=>{
    const yhat = A + B*Math.sin(omega*timepoints[i]) + Cv*Math.cos(omega*timepoints[i]);
    return s+(v-yhat)**2;
  }, 0);
  const r2 = ss_tot > 0 ? 1 - ss_res/ss_tot : 0;

  // atan2(B, C) → peak time: y ≈ A + R*cos(ωt - φ), φ = atan2(B, C)
  const phi = Math.atan2(B, Cv);
  const ctPeak = ((phi / omega) % period + period) % period;
  const relAmplitude = A > 0 ? Math.sqrt(B*B + Cv*Cv) / A : NaN;
  return { ctPeak, relAmplitude, r2, A, B, C: Cv };
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

// ─── Main ─────────────────────────────────────────────────────────────────────

// Mouse dataset (GSE179027) - ZT prefix
const mousePath = 'datasets/GSE179027_Mouse_Enteroid_circadian.csv';
const humanPath = 'datasets/GSE161566_Human_Enteroid_circadian.csv';

const mouseData = parseCSV(mousePath, 'ZT');
const humanData = parseCSV(humanPath, 'CH_');

console.log(`Mouse dataset: ${Object.keys(mouseData).length} genes`);
console.log(`Human dataset: ${Object.keys(humanData).length} genes`);

// Focal genes for G2/M vs G1/S hypothesis test
const focalGenes = [
  { mouse: 'Wee1',   human: 'WEE1',   category: 'G2/M checkpoint' },
  { mouse: 'Cdk1',   human: 'CDK1',   category: 'G2/M CDK' },
  { mouse: 'Cdt1',   human: 'CDT1',   category: 'G1/S licensing' },
  { mouse: 'Gmnn',   human: 'GMNN',   category: 'G1/S licensing (antagonist)' },
  { mouse: 'Cdkn1a', human: 'CDKN1A', category: 'CKI (both phases)' },
];

// Also include the reference genes Mad2l1/MCM6 for context
const referenceGenes = [
  { mouse: 'Mad2l1', human: 'MAD2L1', category: 'G2/M SAC (mouse peak)' },
  { mouse: 'Mcm6',   human: 'MCM6',   category: 'G1/S MCM (human peak)' },
];

function analyzeGene(symbol, data, datasetName, nPerm = 10000) {
  if (!data[symbol]) {
    return { symbol, found: false, dataset: datasetName };
  }
  const vals = data[symbol].vals;
  const fit = fitAR2(vals);
  if (!fit) {
    return { symbol, found: true, fitOk: false, dataset: datasetName };
  }
  const delta = Math.abs(fit.lambda - PHI_RECIP);
  const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
  const logMean = mean > 0 ? Math.log2(mean) : NaN;
  const perm = permTest(delta, logMean, data, nPerm);
  return {
    symbol, found: true, fitOk: true, dataset: datasetName,
    lambda: fit.lambda, delta, r2: fit.r2, isComplex: fit.isComplex,
    logMean, poolSize: perm.poolSize, p: perm.p
  };
}

console.log('\n========================================================');
console.log('  G2/M vs G1/S SPECIES COMPARISON — Wee1/CDK1 axis');
console.log('========================================================\n');
console.log('PHI_RECIP (1/φ) =', PHI_RECIP.toFixed(4));
console.log('');

const allResults = [];

// Process focal genes
for (const gene of [...focalGenes, ...referenceGenes]) {
  const mouseResult = analyzeGene(gene.mouse, mouseData, 'GSE179027 (mouse)', 10000);
  const humanResult = analyzeGene(gene.human, humanData, 'GSE161566 (human)', 10000);

  allResults.push({ ...gene, mouseResult, humanResult });
}

// Print comparison table
console.log('Gene'.padEnd(12) + 'Category'.padEnd(28) +
  'Mouse |λ|'.padStart(10) + 'Mouse Δ'.padStart(10) + 'Mouse p'.padStart(10) +
  'Human |λ|'.padStart(10) + 'Human Δ'.padStart(10) + 'Human p'.padStart(10));
console.log('-'.repeat(90));

for (const r of allResults) {
  const mL = r.mouseResult.found && r.mouseResult.fitOk ? r.mouseResult.lambda.toFixed(4) : 'N/A';
  const mD = r.mouseResult.found && r.mouseResult.fitOk ? r.mouseResult.delta.toFixed(4) : 'N/A';
  const mP = r.mouseResult.found && r.mouseResult.fitOk ? r.mouseResult.p.toFixed(4) : 'N/A';
  const hL = r.humanResult.found && r.humanResult.fitOk ? r.humanResult.lambda.toFixed(4) : 'N/A';
  const hD = r.humanResult.found && r.humanResult.fitOk ? r.humanResult.delta.toFixed(4) : 'N/A';
  const hP = r.humanResult.found && r.humanResult.fitOk ? r.humanResult.p.toFixed(4) : 'N/A';

  console.log(
    r.mouse.padEnd(12) + r.category.padEnd(28) +
    mL.padStart(10) + mD.padStart(10) + mP.padStart(10) +
    hL.padStart(10) + hD.padStart(10) + hP.padStart(10)
  );
}

// Per-gene detailed output
console.log('\n\n=== Detailed per-gene results ===\n');
for (const r of allResults) {
  console.log(`--- ${r.mouse}/${r.human} (${r.category}) ---`);
  const mr = r.mouseResult;
  const hr = r.humanResult;
  if (mr.found && mr.fitOk) {
    console.log(`  Mouse (${mr.dataset}): |λ|=${mr.lambda.toFixed(4)}, Δ=${mr.delta.toFixed(4)}, R²=${mr.r2.toFixed(3)}, ` +
      `roots=${mr.isComplex ? 'complex' : 'real'}, pool=${mr.poolSize}, p=${mr.p.toFixed(4)}`);
  } else {
    console.log(`  Mouse: ${!mr.found ? 'NOT FOUND in dataset' : 'FIT FAILED'}`);
  }
  if (hr.found && hr.fitOk) {
    console.log(`  Human (${hr.dataset}): |λ|=${hr.lambda.toFixed(4)}, Δ=${hr.delta.toFixed(4)}, R²=${hr.r2.toFixed(3)}, ` +
      `roots=${hr.isComplex ? 'complex' : 'real'}, pool=${hr.poolSize}, p=${hr.p.toFixed(4)}`);
  } else {
    console.log(`  Human: ${!hr.found ? 'NOT FOUND in dataset' : 'FIT FAILED'}`);
  }

  // Species difference assessment
  if (mr.found && mr.fitOk && hr.found && hr.fitOk) {
    const mCloser = mr.delta < hr.delta;
    const ratio = (hr.delta / mr.delta).toFixed(1);
    if (mCloser) {
      console.log(`  → Mouse is ${ratio}× closer to 1/φ than human (Δ_mouse=${mr.delta.toFixed(4)} vs Δ_human=${hr.delta.toFixed(4)})`);
    } else {
      const ratioH = (mr.delta / hr.delta).toFixed(1);
      console.log(`  → Human is ${ratioH}× closer to 1/φ than mouse (Δ_human=${hr.delta.toFixed(4)} vs Δ_mouse=${mr.delta.toFixed(4)})`);
    }
  }
  console.log('');
}

// Check if G2/M genes are closer in mouse, G1/S genes closer in human
console.log('\n=== HYPOTHESIS TEST SUMMARY ===\n');
console.log('Hypothesis: G2/M genes (Wee1, CDK1) closer to 1/φ in MOUSE;');
console.log('           G1/S genes (CDT1, GMNN, MCM6) closer to 1/φ in HUMAN\n');

const g2mGenes  = allResults.filter(r => ['G2/M checkpoint', 'G2/M CDK', 'G2/M SAC (mouse peak)'].includes(r.category));
const g1sGenes  = allResults.filter(r => ['G1/S licensing', 'G1/S licensing (antagonist)', 'G1/S MCM (human peak)'].includes(r.category));

console.log('G2/M genes:');
let g2mConsistent = 0, g2mTotal = 0;
for (const r of g2mGenes) {
  if (r.mouseResult.found && r.mouseResult.fitOk && r.humanResult.found && r.humanResult.fitOk) {
    const consistent = r.mouseResult.delta < r.humanResult.delta;
    g2mTotal++;
    if (consistent) g2mConsistent++;
    console.log(`  ${r.mouse}/${r.human}: mouse Δ=${r.mouseResult.delta.toFixed(4)} vs human Δ=${r.humanResult.delta.toFixed(4)} → ${consistent ? '✓ consistent' : '✗ inconsistent'}`);
  }
}

console.log('\nG1/S genes:');
let g1sConsistent = 0, g1sTotal = 0;
for (const r of g1sGenes) {
  if (r.mouseResult.found && r.mouseResult.fitOk && r.humanResult.found && r.humanResult.fitOk) {
    const consistent = r.humanResult.delta < r.mouseResult.delta;
    g1sTotal++;
    if (consistent) g1sConsistent++;
    console.log(`  ${r.mouse}/${r.human}: human Δ=${r.humanResult.delta.toFixed(4)} vs mouse Δ=${r.mouseResult.delta.toFixed(4)} → ${consistent ? '✓ consistent' : '✗ inconsistent'}`);
  }
}

const totalConsistent = g2mConsistent + g1sConsistent;
const totalGenes = g2mTotal + g1sTotal;
console.log(`\nOverall: ${totalConsistent}/${totalGenes} genes consistent with G2/M-mouse/G1/S-human hypothesis`);
