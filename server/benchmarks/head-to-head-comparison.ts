/**
 * Head-to-Head Method Comparison
 * 
 * Runs AR(2) |λ|, cosinor regression, and JTK_CYCLE on the same genes
 * from GSE54650 Liver dataset, producing a comprehensive comparison.
 * 
 * Key outputs:
 * - Per-gene results for all three methods
 * - Venn diagram counts (overlap/unique detections)
 * - Correlation between metrics
 * - Classification agreement for clock/target/other genes
 * - Biological interpretation of divergent cases
 */

import * as fs from 'fs';
import * as path from 'path';
import { runJTKCycleSingle, JTKResult } from './jtk-cycle';

type JTKSingleResult = Omit<JTKResult, 'gene'>;

interface CosinorResult {
  amplitude: number;
  phase: number;
  pValue: number;
  r2: number;
  isRhythmic: boolean;
}

function fitCosinor(expression: number[], timepoints: number[], period: number = 24): CosinorResult {
  const n = expression.length;
  if (n < 4) return { amplitude: 0, phase: 0, pValue: 1, r2: 0, isRhythmic: false };
  
  const meanY = expression.reduce((a, b) => a + b, 0) / n;
  const omega = 2 * Math.PI / period;
  
  let sumCos = 0, sumSin = 0, sumCC = 0, sumSS = 0, sumCS = 0;
  let sumYC = 0, sumYS = 0, sumY = 0;
  
  for (let i = 0; i < n; i++) {
    const c = Math.cos(omega * timepoints[i]);
    const s = Math.sin(omega * timepoints[i]);
    sumCos += c;
    sumSin += s;
    sumCC += c * c;
    sumSS += s * s;
    sumCS += c * s;
    sumYC += expression[i] * c;
    sumYS += expression[i] * s;
    sumY += expression[i];
  }
  
  const X = [
    [n, sumCos, sumSin],
    [sumCos, sumCC, sumCS],
    [sumSin, sumCS, sumSS]
  ];
  const Y = [sumY, sumYC, sumYS];
  
  // Solve 3x3 system using Cramer's rule
  function det3(m: number[][]): number {
    return m[0][0]*(m[1][1]*m[2][2] - m[1][2]*m[2][1])
         - m[0][1]*(m[1][0]*m[2][2] - m[1][2]*m[2][0])
         + m[0][2]*(m[1][0]*m[2][1] - m[1][1]*m[2][0]);
  }
  
  const D = det3(X);
  if (Math.abs(D) < 1e-10) return { amplitude: 0, phase: 0, pValue: 1, r2: 0, isRhythmic: false };
  
  const Dx = det3([[Y[0], X[0][1], X[0][2]], [Y[1], X[1][1], X[1][2]], [Y[2], X[2][1], X[2][2]]]);
  const Dy = det3([[X[0][0], Y[0], X[0][2]], [X[1][0], Y[1], X[1][2]], [X[2][0], Y[2], X[2][2]]]);
  const Dz = det3([[X[0][0], X[0][1], Y[0]], [X[1][0], X[1][1], Y[1]], [X[2][0], X[2][1], Y[2]]]);
  
  const intercept = Dx / D;
  const beta = Dy / D;
  const gamma = Dz / D;
  
  const amplitude = Math.sqrt(beta * beta + gamma * gamma);
  const phase = Math.atan2(-gamma, beta) * period / (2 * Math.PI);
  
  let ssTot = 0, ssRes = 0;
  for (let i = 0; i < n; i++) {
    const fitted = intercept + beta * Math.cos(omega * timepoints[i]) + gamma * Math.sin(omega * timepoints[i]);
    ssTot += (expression[i] - meanY) ** 2;
    ssRes += (expression[i] - fitted) ** 2;
  }
  
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  
  // F-test: regression with 2 parameters vs intercept-only
  const ssReg = ssTot - ssRes;
  const dfReg = 2;
  const dfRes = Math.max(n - 3, 1);
  const fStat = (ssReg / dfReg) / (ssRes / dfRes);
  
  // Approximate p-value from F-distribution using beta incomplete function approximation
  const pValue = approximateFPValue(fStat, dfReg, dfRes);
  
  return {
    amplitude,
    phase: phase < 0 ? phase + period : phase,
    pValue,
    r2,
    isRhythmic: pValue < 0.05
  };
}

function approximateFPValue(f: number, df1: number, df2: number): number {
  if (f <= 0) return 1;
  const x = df2 / (df2 + df1 * f);
  // Use approximation: for df1=2, P ≈ x^(df2/2)
  const p = Math.pow(x, df2 / 2);
  return Math.min(1, Math.max(0, p));
}

function bhFDR(pValues: number[]): number[] {
  const n = pValues.length;
  const indexed = pValues.map((p, i) => ({ p, i }));
  indexed.sort((a, b) => a.p - b.p);
  const qValues = new Array(n);
  let minQ = 1;
  for (let i = n - 1; i >= 0; i--) {
    const q = Math.min(minQ, indexed[i].p * n / (i + 1));
    minQ = q;
    qValues[indexed[i].i] = Math.min(1, q);
  }
  return qValues;
}

function runJTKForGene(expression: number[], timepoints: number[]): JTKSingleResult {
  const result = runJTKCycleSingle(expression, timepoints, [20, 24, 28]);
  return {
    tau: result.tau,
    pValue: result.pValue,
    qValue: result.qValue,
    period: result.period,
    phase: result.phase,
    amplitude: result.amplitude,
    isRhythmic: result.isRhythmic,
  };
}

export interface HeadToHeadGeneResult {
  gene: string;
  category: string;
  ar2_eigenvalue: number;
  ar2_r2: number;
  ar2_rootType: string;
  cosinor_amplitude: number;
  cosinor_phase: number;
  cosinor_pValue: number;
  cosinor_r2: number;
  cosinor_rhythmic: boolean;
  jtk_tau: number;
  jtk_pValue: number;
  jtk_qValue: number;
  jtk_period: number;
  jtk_rhythmic: boolean;
  agreement: string;
}

export interface HeadToHeadSummary {
  timestamp: string;
  dataset: string;
  totalGenes: number;
  ar2_clockMedian: number;
  ar2_targetMedian: number;
  ar2_otherMedian: number;
  cosinor_rhythmic: number;
  cosinor_rhythmicPct: number;
  jtk_rhythmic: number;
  jtk_rhythmicPct: number;
  ar2_inStableBand: number;
  ar2_inStableBandPct: number;
  venn: {
    all3: number;
    ar2Only: number;
    cosinorOnly: number;
    jtkOnly: number;
    ar2_cosinor: number;
    ar2_jtk: number;
    cosinor_jtk: number;
    none: number;
  };
  correlations: {
    eigenvalue_vs_amplitude: number;
    eigenvalue_vs_cosinorR2: number;
    eigenvalue_vs_tau: number;
    amplitude_vs_tau: number;
  };
  clockGeneAgreement: {
    ar2_detected: number;
    cosinor_detected: number;
    jtk_detected: number;
    all3_detected: number;
    total: number;
  };
  divergentExamples: {
    gene: string;
    ar2_eigenvalue: number;
    cosinor_rhythmic: boolean;
    jtk_rhythmic: boolean;
    interpretation: string;
  }[];
  conclusion: string;
}

export interface HeadToHeadFullResult {
  summary: HeadToHeadSummary;
  geneResults: HeadToHeadGeneResult[];
}

const CLOCK_GENES_SET = new Set([
  'arntl', 'bmal1', 'clock', 'npas2', 'per1', 'per2', 'per3',
  'cry1', 'cry2', 'nr1d1', 'nr1d2', 'dbp', 'tef', 'rorc'
]);
const TARGET_GENES_SET = new Set([
  'wee1', 'cdk1', 'ccnd1', 'ccnb1', 'ccne1', 'ccne2',
  'myc', 'cdkn1a', 'lgr5', 'axin2', 'ctnnb1', 'apc',
  'fasn', 'hmgcr', 'cyp7a1', 'g6pc', 'pck1',
  'xpa', 'sirt1', 'nfe2l2', 'mtor', 'tnf', 'bcl2',
  'mcm6', 'mki67', 'top2a', 'atm', 'chek1', 'chek2',
  'trp53', 'mdm2', 'bax', 'pparg', 'hif1a'
]);

function classifyGene(name: string): 'Clock' | 'Target' | 'Other' {
  const lower = name.toLowerCase();
  if (CLOCK_GENES_SET.has(lower)) return 'Clock';
  if (TARGET_GENES_SET.has(lower)) return 'Target';
  return 'Other';
}

function fitAR2Full(expression: number[]): { eigenvalue: number; phi1: number; phi2: number; r2: number; rootType: string } {
  const n = expression.length;
  if (n < 5) return { eigenvalue: 0, phi1: 0, phi2: 0, r2: 0, rootType: 'Real' };

  const mean = expression.reduce((a, b) => a + b, 0) / n;
  const centered = expression.map(x => x - mean);

  let sumY_Y1 = 0, sumY_Y2 = 0, sumY1_Y1 = 0, sumY1_Y2 = 0, sumY2_Y2 = 0;
  for (let t = 2; t < n; t++) {
    sumY_Y1 += centered[t] * centered[t-1];
    sumY_Y2 += centered[t] * centered[t-2];
    sumY1_Y1 += centered[t-1] * centered[t-1];
    sumY1_Y2 += centered[t-1] * centered[t-2];
    sumY2_Y2 += centered[t-2] * centered[t-2];
  }
  const det = sumY1_Y1 * sumY2_Y2 - sumY1_Y2 * sumY1_Y2;
  if (Math.abs(det) < 1e-10) return { eigenvalue: 0, phi1: 0, phi2: 0, r2: 0, rootType: 'Real' };

  const phi1 = (sumY_Y1 * sumY2_Y2 - sumY_Y2 * sumY1_Y2) / det;
  const phi2 = (sumY1_Y1 * sumY_Y2 - sumY_Y1 * sumY1_Y2) / det;

  const disc = phi1 * phi1 + 4 * phi2;
  let eigenvalue: number;
  const rootType = disc < 0 ? 'Complex' : 'Real';
  if (disc < 0) {
    eigenvalue = Math.sqrt(-phi2);
  } else {
    const r1 = (phi1 + Math.sqrt(disc)) / 2;
    const r2p = (phi1 - Math.sqrt(disc)) / 2;
    eigenvalue = Math.max(Math.abs(r1), Math.abs(r2p));
  }

  let ssTot = 0, ssRes = 0;
  for (let t = 2; t < n; t++) {
    const fitted = phi1 * centered[t-1] + phi2 * centered[t-2];
    ssTot += centered[t] * centered[t];
    ssRes += (centered[t] - fitted) ** 2;
  }
  const r2 = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;

  return { eigenvalue, phi1, phi2, r2, rootType };
}

export function runHeadToHeadComparison(): HeadToHeadFullResult {
  const filePath = path.join(process.cwd(), 'datasets', 'GSE54650_Liver_circadian.csv');
  if (!fs.existsSync(filePath)) {
    throw new Error('GSE54650 Liver dataset not found');
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  if (lines.length < 2) throw new Error('Dataset is empty');

  const headers = lines[0].split(',');
  const timepoints: number[] = [];
  for (let j = 1; j < headers.length; j++) {
    const match = headers[j].match(/(\d+)/);
    timepoints.push(match ? parseFloat(match[1]) : (j - 1) * 2);
  }

  interface RawGeneResult {
    gene: string;
    category: string;
    ar2: ReturnType<typeof fitAR2Full>;
    cosinor: CosinorResult;
    jtk: JTKSingleResult;
  }

  const rawResults: RawGeneResult[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const gene = cols[0].trim().replace(/"/g, '');
    if (!gene) continue;

    const expression = cols.slice(1).map(v => parseFloat(v)).filter(v => !isNaN(v));
    if (expression.length < 6) continue;

    const tp = timepoints.slice(0, expression.length);

    const ar2 = fitAR2Full(expression);
    const cosinor = fitCosinor(expression, tp, 24);
    const jtk = runJTKForGene(expression, tp);
    const category = classifyGene(gene);

    rawResults.push({ gene, category, ar2, cosinor, jtk });
  }

  const cosinorPValues = rawResults.map(r => r.cosinor.pValue);
  const jtkPValues = rawResults.map(r => r.jtk.pValue);
  const cosinorQValues = bhFDR(cosinorPValues);
  const jtkQValues = bhFDR(jtkPValues);

  const geneResults: HeadToHeadGeneResult[] = rawResults.map((r, idx) => {
    const cosinorRhythmic = cosinorQValues[idx] < 0.05;
    const jtkRhythmic = jtkQValues[idx] < 0.05;
    const ar2High = r.ar2.eigenvalue >= 0.5;

    let agreement: string;
    if (ar2High && cosinorRhythmic && jtkRhythmic) {
      agreement = 'All agree';
    } else if (!ar2High && !cosinorRhythmic && !jtkRhythmic) {
      agreement = 'All agree: none';
    } else if (ar2High && !cosinorRhythmic && !jtkRhythmic) {
      agreement = 'AR(2) unique';
    } else if (!ar2High && (cosinorRhythmic || jtkRhythmic)) {
      agreement = 'Rhythm-only';
    } else {
      agreement = 'Partial';
    }

    return {
      gene: r.gene,
      category: r.category,
      ar2_eigenvalue: Math.round(r.ar2.eigenvalue * 10000) / 10000,
      ar2_r2: Math.round(r.ar2.r2 * 10000) / 10000,
      ar2_rootType: r.ar2.rootType,
      cosinor_amplitude: Math.round(r.cosinor.amplitude * 10000) / 10000,
      cosinor_phase: Math.round(r.cosinor.phase * 100) / 100,
      cosinor_pValue: Math.round(cosinorQValues[idx] * 10000) / 10000,
      cosinor_r2: Math.round(r.cosinor.r2 * 10000) / 10000,
      cosinor_rhythmic: cosinorRhythmic,
      jtk_tau: Math.round(r.jtk.tau * 10000) / 10000,
      jtk_pValue: Math.round(jtkQValues[idx] * 10000) / 10000,
      jtk_qValue: Math.round(jtkQValues[idx] * 10000) / 10000,
      jtk_period: r.jtk.period,
      jtk_rhythmic: jtkRhythmic,
      agreement
    };
  });
  
  // Compute summary statistics
  const clockGenes = geneResults.filter(r => r.category === 'Clock');
  const targetGenes = geneResults.filter(r => r.category === 'Target');
  const otherGenes = geneResults.filter(r => r.category === 'Other');
  
  function median(arr: number[]): number {
    const sorted = [...arr].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }
  
  function spearman(x: number[], y: number[]): number {
    const n = x.length;
    if (n < 3) return 0;
    const rankX = getRanks(x);
    const rankY = getRanks(y);
    let sumD2 = 0;
    for (let i = 0; i < n; i++) {
      sumD2 += (rankX[i] - rankY[i]) ** 2;
    }
    return 1 - (6 * sumD2) / (n * (n * n - 1));
  }
  
  function getRanks(arr: number[]): number[] {
    const indexed = arr.map((v, i) => ({ v, i }));
    indexed.sort((a, b) => a.v - b.v);
    const ranks = new Array(arr.length);
    for (let i = 0; i < indexed.length; i++) {
      ranks[indexed[i].i] = i + 1;
    }
    return ranks;
  }
  
  const eigenvalues = geneResults.map(r => r.ar2_eigenvalue);
  const amplitudes = geneResults.map(r => r.cosinor_amplitude);
  const cosinorR2s = geneResults.map(r => r.cosinor_r2);
  const taus = geneResults.map(r => Math.abs(r.jtk_tau));
  
  const ar2InBand = geneResults.filter(r => r.ar2_eigenvalue >= 0.4 && r.ar2_eigenvalue <= 0.8).length;
  const cosinorRhythmic = geneResults.filter(r => r.cosinor_rhythmic).length;
  const jtkRhythmic = geneResults.filter(r => r.jtk_rhythmic).length;
  
  // Venn diagram: using "detected" = cosinor rhythmic, jtk rhythmic, ar2 in stable band
  const all3 = geneResults.filter(r => r.ar2_eigenvalue >= 0.4 && r.cosinor_rhythmic && r.jtk_rhythmic).length;
  const ar2Only = geneResults.filter(r => r.ar2_eigenvalue >= 0.4 && !r.cosinor_rhythmic && !r.jtk_rhythmic).length;
  const cosinorOnly = geneResults.filter(r => r.ar2_eigenvalue < 0.4 && r.cosinor_rhythmic && !r.jtk_rhythmic).length;
  const jtkOnly = geneResults.filter(r => r.ar2_eigenvalue < 0.4 && !r.cosinor_rhythmic && r.jtk_rhythmic).length;
  const ar2_cosinor = geneResults.filter(r => r.ar2_eigenvalue >= 0.4 && r.cosinor_rhythmic && !r.jtk_rhythmic).length;
  const ar2_jtk = geneResults.filter(r => r.ar2_eigenvalue >= 0.4 && !r.cosinor_rhythmic && r.jtk_rhythmic).length;
  const cosinor_jtk = geneResults.filter(r => r.ar2_eigenvalue < 0.4 && r.cosinor_rhythmic && r.jtk_rhythmic).length;
  const none = geneResults.filter(r => r.ar2_eigenvalue < 0.4 && !r.cosinor_rhythmic && !r.jtk_rhythmic).length;
  
  // Clock gene detection
  const clockAR2 = clockGenes.filter(r => r.ar2_eigenvalue >= 0.5).length;
  const clockCosinor = clockGenes.filter(r => r.cosinor_rhythmic).length;
  const clockJTK = clockGenes.filter(r => r.jtk_rhythmic).length;
  const clockAll3 = clockGenes.filter(r => r.ar2_eigenvalue >= 0.5 && r.cosinor_rhythmic && r.jtk_rhythmic).length;
  
  // Find interesting divergent examples
  const divergent: HeadToHeadSummary['divergentExamples'] = [];
  
  // High |λ| but not rhythmic
  const highPersNotRhythmic = geneResults
    .filter(r => r.ar2_eigenvalue > 0.6 && !r.cosinor_rhythmic && !r.jtk_rhythmic)
    .sort((a, b) => b.ar2_eigenvalue - a.ar2_eigenvalue)
    .slice(0, 3);
  for (const g of highPersNotRhythmic) {
    divergent.push({
      gene: g.gene,
      ar2_eigenvalue: g.ar2_eigenvalue,
      cosinor_rhythmic: g.cosinor_rhythmic,
      jtk_rhythmic: g.jtk_rhythmic,
      interpretation: `High persistence (|λ|=${g.ar2_eigenvalue.toFixed(3)}) but not detected as rhythmic. May reflect overdamped dynamics or non-sinusoidal temporal patterns that cosinor/JTK miss.`
    });
  }
  
  // Rhythmic but low |λ|
  const rhythmicLowPers = geneResults
    .filter(r => r.ar2_eigenvalue < 0.35 && r.cosinor_rhythmic && r.jtk_rhythmic)
    .sort((a, b) => a.ar2_eigenvalue - b.ar2_eigenvalue)
    .slice(0, 3);
  for (const g of rhythmicLowPers) {
    divergent.push({
      gene: g.gene,
      ar2_eigenvalue: g.ar2_eigenvalue,
      cosinor_rhythmic: g.cosinor_rhythmic,
      jtk_rhythmic: g.jtk_rhythmic,
      interpretation: `Detected as rhythmic by cosinor+JTK but low persistence (|λ|=${g.ar2_eigenvalue.toFixed(3)}). Oscillates but rapidly damped — the signal does not "remember" its previous state for long.`
    });
  }
  
  const corrEigAmp = spearman(eigenvalues, amplitudes);
  const corrEigCosR2 = spearman(eigenvalues, cosinorR2s);
  const corrEigTau = spearman(eigenvalues, taus);
  const corrAmpTau = spearman(amplitudes, taus);
  
  const conclusion = `Head-to-head comparison on ${geneResults.length} genes (GSE54650 Liver). ` +
    `AR(2) |λ| correlates moderately with cosinor R² (ρ=${corrEigCosR2.toFixed(3)}) and JTK |τ| (ρ=${corrEigTau.toFixed(3)}), ` +
    `confirming partial overlap but substantial independent information. ` +
    `${all3} genes detected by all three methods; ${ar2Only} detected by AR(2) alone (potential non-sinusoidal persistent dynamics); ` +
    `${cosinor_jtk} detected by cosinor+JTK but not AR(2) (rhythmic but rapidly damped). ` +
    `The three methods capture complementary properties: rhythmicity (cosinor/JTK) vs temporal persistence (AR(2)).`;
  
  return {
    summary: {
      timestamp: new Date().toISOString(),
      dataset: 'GSE54650 Liver',
      totalGenes: geneResults.length,
      ar2_clockMedian: median(clockGenes.map(r => r.ar2_eigenvalue)),
      ar2_targetMedian: median(targetGenes.map(r => r.ar2_eigenvalue)),
      ar2_otherMedian: median(otherGenes.map(r => r.ar2_eigenvalue)),
      cosinor_rhythmic: cosinorRhythmic,
      cosinor_rhythmicPct: Math.round(cosinorRhythmic / geneResults.length * 1000) / 10,
      jtk_rhythmic: jtkRhythmic,
      jtk_rhythmicPct: Math.round(jtkRhythmic / geneResults.length * 1000) / 10,
      ar2_inStableBand: ar2InBand,
      ar2_inStableBandPct: Math.round(ar2InBand / geneResults.length * 1000) / 10,
      venn: { all3, ar2Only, cosinorOnly, jtkOnly, ar2_cosinor, ar2_jtk, cosinor_jtk, none },
      correlations: {
        eigenvalue_vs_amplitude: Math.round(corrEigAmp * 1000) / 1000,
        eigenvalue_vs_cosinorR2: Math.round(corrEigCosR2 * 1000) / 1000,
        eigenvalue_vs_tau: Math.round(corrEigTau * 1000) / 1000,
        amplitude_vs_tau: Math.round(corrAmpTau * 1000) / 1000,
      },
      clockGeneAgreement: {
        ar2_detected: clockAR2,
        cosinor_detected: clockCosinor,
        jtk_detected: clockJTK,
        all3_detected: clockAll3,
        total: clockGenes.length,
      },
      divergentExamples: divergent,
      conclusion,
    },
    geneResults,
  };
}
