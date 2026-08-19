/**
 * Manuscript Validation Engine
 * 
 * Computes PAR(2) phase-interaction F-tests to reproduce headline claims
 * from Papers A through E.
 * 
 * Paper A: Core Methods & Pan-Tissue Atlas
 * Paper B: Resonance Zone Discovery
 * Paper C: 12-Tissue BMAL1 Coupling Atlas
 * Paper D: Cross-Metric Independence (Perspective)
 * Paper E: Cancer Biology
 */

import * as fs from 'fs';
import * as path from 'path';
import { resolveGeneName, getDisplayName, GENE_SYMBOL_TO_ENSEMBL } from './par2-engine';
import { analyzeCrossMetricIndependence } from './cross-metric-independence';

interface ParsedDataset {
  timepoints: number[];
  geneTimeSeries: Map<string, number[]>;
  geneIds: string[];
  format: string;
}

interface GatingResult {
  clockGene: string;
  targetGene: string;
  fStatistic: number;
  pValue: number;
  pValueBonferroni: number;
  cohenF2: number;
  nObs: number;
  rSquaredFull: number;
  rSquaredReduced: number;
  significant: boolean;
  significantBonferroni: boolean;
  qValue?: number;
  significantFDR?: boolean;
}

interface TissueResults {
  tissue: string;
  dataset: string;
  results: GatingResult[];
  discoveryRate: number;
  totalPairs: number;
  significantPairs: number;
}

interface ManuscriptValidationResult {
  paperA: {
    tissueResults: TissueResults[];
    totalSignificant: number;
    totalPairs: number;
    overallDiscoveryRate: number;
    cry1Wee1Conservation: {
      tissues: string[];
      count: number;
      pValues: Record<string, number>;
    };
    mycTissues: string[];
    bmal1KO: {
      wtGap: number;
      koGap: number;
      hierarchyCollapsed: boolean;
    } | null;
  };
  paperB: {
    resonanceZone: {
      clockInZone: number;
      clockTotal: number;
      clockPercent: number;
      bgInZone: number;
      bgTotal: number;
      bgPercent: number;
      enrichmentRatio: number;
      pValue: number;
    };
    multiTissueResonanceGenes: string[];
    tissueScans: { tissue: string; totalGenes: number; inZone: number; clockInZone: number }[];
  };
  paperC: {
    tissueResults: { tissue: string; totalTested: number; significantCoupled: number; rate: number; wee1Coupled: boolean }[];
    wee1TissueCount: number;
    totalSignificant: number;
    overallRate: number;
    arntlVsRandom: {
      arntlRate: number;
      randomRate: number;
      enrichmentRatio: number;
    };
    topCoupledGenes: { gene: string; tissueCount: number }[];
  };
  paperD: {
    correlations: {
      eigenvalue_vs_network: { rho: number; pValue: number; n: number };
      eigenvalue_vs_amplitude: { rho: number; pValue: number; n: number };
      eigenvalue_vs_chromatin: { rho: number; pValue: number; n: number };
    };
    partialCorrelations: {
      eigenvalue_amplitude_controllingNetwork: { rho: number };
      eigenvalue_network_controllingAmplitude: { rho: number };
    };
    conservation: {
      clockMeanCV: number;
      targetMeanCV: number;
      clockMoreConserved: boolean;
    };
    independence_confirmed: boolean;
  };
  paperE: {
    organoidResults: Record<string, TissueResults>;
    discoveryRates: Record<string, number>;
    apcCompensation: {
      wtRate: number;
      apcRate: number;
      foldChange: number;
      doubleMutRate: number;
      collapseRatio: number;
    };
    lgr5Gating: {
      clockGenes: string[];
      pValues: Record<string, number>;
      allEightGated: boolean;
    } | null;
    ppargGating: {
      clockGenes: string[];
      pValues: Record<string, number>;
      meanF2: number;
      allSignificant: boolean;
    } | null;
    eigenperiods: {
      healthyRange: number[];
      cancerRange: number[];
    } | null;
  };
  computedAt: string;
  methodology: string;
}

const CLOCK_GENES = ['Per1', 'Per2', 'Per3', 'Cry1', 'Cry2', 'Arntl', 'Clock', 'Nr1d1', 'Nr1d2', 'Dbp', 'Tef', 'Npas2', 'Rorc'];
const CORE_CLOCK_GENES = ['Per1', 'Per2', 'Cry1', 'Cry2', 'Arntl', 'Clock', 'Nr1d1', 'Nr1d2'];
const TARGET_GENES = ['Myc', 'Ccnd1', 'Ccnb1', 'Cdk1', 'Wee1', 'Cdkn1a', 'Ccne1', 'Ccne2', 'Mcm6', 'Mki67',
  'Lgr5', 'Axin2', 'Ctnnb1', 'Apc', 'Tp53', 'Mdm2', 'Atm', 'Chek2', 'Bcl2', 'Bax', 'Pparg', 'Sirt1', 'Hif1a'];

function logGamma(z: number): number {
  const g = 7;
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  }
  z -= 1;
  let x = c[0];
  for (let i = 1; i < g + 2; i++) {
    x += c[i] / (z + i);
  }
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function betaCF(a: number, b: number, x: number): number {
  const maxIter = 200;
  const eps = 3e-14;
  const fpMin = 1e-30;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - qab * x / qap;
  if (Math.abs(d) < fpMin) d = fpMin;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= maxIter; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < fpMin) d = fpMin;
    c = 1 + aa / c;
    if (Math.abs(c) < fpMin) c = fpMin;
    d = 1 / d;
    h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < fpMin) d = fpMin;
    c = 1 + aa / c;
    if (Math.abs(c) < fpMin) c = fpMin;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < eps) break;
  }
  return h;
}

function incompleteBeta(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const logBeta = logGamma(a) + logGamma(b) - logGamma(a + b);
  if (x < (a + 1) / (a + b + 2)) {
    const bt = Math.exp(a * Math.log(x) + b * Math.log(1 - x) - logBeta);
    return bt * betaCF(a, b, x) / a;
  } else {
    const y = 1 - x;
    const bt_swapped = Math.exp(b * Math.log(y) + a * Math.log(1 - y) - logBeta);
    return 1 - bt_swapped * betaCF(b, a, y) / b;
  }
}

function fTestPValue(fStat: number, df1: number, df2: number): number {
  if (fStat <= 0 || df2 <= 0) return 1;
  const x = (df1 * fStat) / (df1 * fStat + df2);
  const cdf = incompleteBeta(df1 / 2, df2 / 2, x);
  return Math.max(1e-16, 1 - cdf);
}

function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const size = b.length;
  const aug: number[][] = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < size; col++) {
    let maxRow = col;
    for (let row = col + 1; row < size; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) {
        maxRow = row;
      }
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
    if (Math.abs(aug[col][col]) < 1e-10) return null;
    for (let row = col + 1; row < size; row++) {
      const factor = aug[row][col] / aug[col][col];
      for (let j = col; j <= size; j++) {
        aug[row][j] -= factor * aug[col][j];
      }
    }
  }
  const result = Array(size).fill(0);
  for (let i = size - 1; i >= 0; i--) {
    result[i] = aug[i][size];
    for (let j = i + 1; j < size; j++) {
      result[i] -= aug[i][j] * result[j];
    }
    result[i] /= aug[i][i];
  }
  return result;
}

function estimateClockPhase(clockExpr: number[], timepoints: number[]): number[] {
  const n = clockExpr.length;
  const timeRange = timepoints[timepoints.length - 1] - timepoints[0];
  const candidatePeriods = timeRange > 20 ? [24, 23, 25, 22, 26] : [timeRange, timeRange * 0.9, timeRange * 1.1];

  let bestPeriod = 24;
  let bestR2 = -Infinity;

  for (const period of candidatePeriods) {
    const omega = 2 * Math.PI / period;
    const XtX = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    const XtY = [0, 0, 0];
    for (let i = 0; i < n; i++) {
      const t = timepoints[i];
      const row = [1, Math.cos(omega * t), Math.sin(omega * t)];
      for (let j = 0; j < 3; j++) {
        XtY[j] += row[j] * clockExpr[i];
        for (let k = 0; k < 3; k++) {
          XtX[j][k] += row[j] * row[k];
        }
      }
    }
    const beta = solveLinearSystem(XtX, XtY);
    if (!beta) continue;
    let ssRes = 0, ssTot = 0;
    const mean = clockExpr.reduce((a, b) => a + b, 0) / n;
    for (let i = 0; i < n; i++) {
      const pred = beta[0] + beta[1] * Math.cos(omega * timepoints[i]) + beta[2] * Math.sin(omega * timepoints[i]);
      ssRes += (clockExpr[i] - pred) ** 2;
      ssTot += (clockExpr[i] - mean) ** 2;
    }
    const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
    if (r2 > bestR2) {
      bestR2 = r2;
      bestPeriod = period;
    }
  }

  const omega = 2 * Math.PI / bestPeriod;
  const XtX = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const XtY = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    const t = timepoints[i];
    const row = [1, Math.cos(omega * t), Math.sin(omega * t)];
    for (let j = 0; j < 3; j++) {
      XtY[j] += row[j] * clockExpr[i];
      for (let k = 0; k < 3; k++) {
        XtX[j][k] += row[j] * row[k];
      }
    }
  }
  const phaseCoeffs = solveLinearSystem(XtX, XtY);
  let phaseOffset = 0;
  if (phaseCoeffs) {
    phaseOffset = Math.atan2(phaseCoeffs[2], phaseCoeffs[1]);
  }

  return timepoints.map(t => {
    let phase = (omega * t - phaseOffset) % (2 * Math.PI);
    if (phase < 0) phase += 2 * Math.PI;
    return phase;
  });
}

function runPAR2PhaseInteractionFTest(
  targetExpr: number[],
  clockExpr: number[],
  timepoints: number[]
): GatingResult | null {
  const n = targetExpr.length;
  if (n < 10) return null;

  const phases = estimateClockPhase(clockExpr, timepoints);

  const Y: number[] = [];
  const X_full: number[][] = [];
  const X_reduced: number[][] = [];

  for (let t = 2; t < n; t++) {
    Y.push(targetExpr[t]);
    X_full.push([
      1,
      targetExpr[t - 1],
      targetExpr[t - 2],
      targetExpr[t - 1] * Math.cos(phases[t - 1]),
      targetExpr[t - 1] * Math.sin(phases[t - 1]),
      targetExpr[t - 2] * Math.cos(phases[t - 2]),
      targetExpr[t - 2] * Math.sin(phases[t - 2])
    ]);
    X_reduced.push([
      1,
      targetExpr[t - 1],
      targetExpr[t - 2]
    ]);
  }

  const nObs = Y.length;
  if (nObs < 8) return null;

  const p_full = 7;
  const p_reduced = 3;

  const XtX_full: number[][] = Array(p_full).fill(0).map(() => Array(p_full).fill(0));
  const XtY_full: number[] = Array(p_full).fill(0);
  for (let i = 0; i < nObs; i++) {
    for (let j = 0; j < p_full; j++) {
      XtY_full[j] += X_full[i][j] * Y[i];
      for (let k = 0; k < p_full; k++) {
        XtX_full[j][k] += X_full[i][j] * X_full[i][k];
      }
    }
  }

  const XtX_red: number[][] = Array(p_reduced).fill(0).map(() => Array(p_reduced).fill(0));
  const XtY_red: number[] = Array(p_reduced).fill(0);
  for (let i = 0; i < nObs; i++) {
    for (let j = 0; j < p_reduced; j++) {
      XtY_red[j] += X_reduced[i][j] * Y[i];
      for (let k = 0; k < p_reduced; k++) {
        XtX_red[j][k] += X_reduced[i][j] * X_reduced[i][k];
      }
    }
  }

  const beta_full = solveLinearSystem(XtX_full, XtY_full);
  const beta_red = solveLinearSystem(XtX_red, XtY_red);
  if (!beta_full || !beta_red) return null;
  if (beta_full.some(b => !isFinite(b)) || beta_red.some(b => !isFinite(b))) return null;

  let ssRes_full = 0, ssRes_red = 0, ssTot = 0;
  const yMean = Y.reduce((a, b) => a + b, 0) / nObs;

  for (let i = 0; i < nObs; i++) {
    let yPred_full = 0, yPred_red = 0;
    for (let j = 0; j < p_full; j++) yPred_full += beta_full[j] * X_full[i][j];
    for (let j = 0; j < p_reduced; j++) yPred_red += beta_red[j] * X_reduced[i][j];
    ssRes_full += (Y[i] - yPred_full) ** 2;
    ssRes_red += (Y[i] - yPred_red) ** 2;
    ssTot += (Y[i] - yMean) ** 2;
  }

  const df1 = p_full - p_reduced; // 4
  const df2 = nObs - p_full; // n-7

  if (df2 <= 0 || ssRes_full <= 0) return null;

  const fStat = ((ssRes_red - ssRes_full) / df1) / (ssRes_full / df2);
  const pValue = fTestPValue(Math.max(0, fStat), df1, df2);
  const pValueBonferroni = Math.min(1, pValue * 4);

  const rSquaredFull = ssTot > 0 ? 1 - ssRes_full / ssTot : 0;
  const rSquaredReduced = ssTot > 0 ? 1 - ssRes_red / ssTot : 0;
  const cohenF2 = ssRes_full > 0 ? (ssRes_red - ssRes_full) / ssRes_full : 0;

  return {
    clockGene: '',
    targetGene: '',
    fStatistic: fStat,
    pValue,
    pValueBonferroni,
    cohenF2: Math.max(0, cohenF2),
    nObs,
    rSquaredFull,
    rSquaredReduced,
    significant: pValue < 0.05,
    significantBonferroni: pValueBonferroni < 0.05
  };
}

function applyBHFDR(results: GatingResult[]): GatingResult[] {
  const sorted = [...results].sort((a, b) => a.pValue - b.pValue);
  const m = sorted.length;
  const qValues: number[] = new Array(m);

  for (let i = m - 1; i >= 0; i--) {
    const raw = sorted[i].pValue * m / (i + 1);
    qValues[i] = i < m - 1 ? Math.min(raw, qValues[i + 1]) : raw;
    qValues[i] = Math.min(1, qValues[i]);
  }

  const resultMap = new Map<string, number>();
  sorted.forEach((r, i) => {
    resultMap.set(`${r.clockGene}|${r.targetGene}`, qValues[i]);
  });

  return results.map(r => {
    const q = resultMap.get(`${r.clockGene}|${r.targetGene}`) ?? 1;
    return {
      ...r,
      significant: r.pValueBonferroni < 0.05,
      significantBonferroni: r.pValueBonferroni < 0.05,
      qValue: q,
      significantFDR: q < 0.05,
    };
  });
}

async function parseDatasetFile(filepath: string): Promise<ParsedDataset> {
  const { parse } = await import('csv-parse/sync');
  let content: string;
  const fileName = path.basename(filepath);

  if (fileName.endsWith('.gz')) {
    const zlib = await import('zlib');
    const { promisify } = await import('util');
    const gunzip = promisify(zlib.gunzip);
    const buffer = fs.readFileSync(filepath);
    const decompressed = await gunzip(buffer);
    content = decompressed.toString('utf-8');
  } else {
    content = fs.readFileSync(filepath, 'utf-8');
  }

  const delimiter = fileName.endsWith('.tsv') ? '\t' : ',';
  const records = parse(content, {
    columns: false,
    skip_empty_lines: true,
    delimiter,
    relax_column_count: true
  }) as string[][];

  if (records.length < 2) throw new Error("Dataset must have at least 2 rows");

  const headerRow = records[0];
  const looksLikeTimepoint = (s: string) =>
    /^(ct|zt|t|time|x\d)/i.test(s) || /^\d+$/.test(s.replace(/[."]/g, '')) || /hr$/i.test(s);

  const secondHeader = (headerRow[1] || '').replace(/"/g, '');
  const isGeneRowFormat = looksLikeTimepoint(secondHeader) ||
    headerRow.slice(1).some(h => looksLikeTimepoint(h.replace(/"/g, '')));

  const geneTimeSeries = new Map<string, number[]>();
  let timepoints: number[] = [];
  const geneIds: string[] = [];

  if (isGeneRowFormat) {
    timepoints = headerRow.slice(1).map((h, i) => {
      const clean = h.replace(/"/g, '');
      const numMatch = clean.match(/(\d+)/);
      return numMatch ? parseFloat(numMatch[1]) : i;
    });
    for (let i = 1; i < records.length; i++) {
      const row = records[i];
      const geneId = (row[0] || '').trim().replace(/"/g, '');
      if (!geneId) continue;
      geneIds.push(geneId);
      const expressionValues = row.slice(1).map(v => parseFloat(v) || 0);
      geneTimeSeries.set(geneId, expressionValues);
    }
  } else {
    const geneHeaders = headerRow.slice(1).map(h => h.replace(/"/g, ''));
    geneHeaders.forEach(g => {
      geneIds.push(g);
      geneTimeSeries.set(g, []);
    });
    for (let i = 1; i < records.length; i++) {
      const row = records[i];
      const timepoint = parseFloat(row[0]?.replace(/"/g, '') || '') || (i - 1);
      timepoints.push(timepoint);
      for (let j = 1; j < row.length && j - 1 < geneHeaders.length; j++) {
        const geneId = geneHeaders[j - 1];
        geneTimeSeries.get(geneId)?.push(parseFloat(row[j]) || 0);
      }
    }
  }

  return { timepoints, geneTimeSeries, geneIds, format: isGeneRowFormat ? 'gene-rows' : 'time-rows' };
}

function runGatingAnalysis(
  parsedData: ParsedDataset,
  clockGenes: string[],
  targetGenes: string[]
): GatingResult[] {
  const geneIds = Array.from(parsedData.geneTimeSeries.keys());
  const timeIndices = parsedData.timepoints.map((t, i) => ({ time: t, index: i }));
  timeIndices.sort((a, b) => a.time - b.time);
  const sortedTimepoints = timeIndices.map(x => x.time);
  const results: GatingResult[] = [];

  for (const clockName of clockGenes) {
    const clockResolved = resolveGeneName(clockName, geneIds);
    if (!clockResolved) continue;
    const clockRaw = parsedData.geneTimeSeries.get(clockResolved);
    if (!clockRaw) continue;
    const clockExpr = timeIndices.map(x => clockRaw[x.index]);

    for (const targetName of targetGenes) {
      const targetResolved = resolveGeneName(targetName, geneIds);
      if (!targetResolved || targetResolved === clockResolved) continue;
      const targetRaw = parsedData.geneTimeSeries.get(targetResolved);
      if (!targetRaw) continue;
      const targetExpr = timeIndices.map(x => targetRaw[x.index]);

      const result = runPAR2PhaseInteractionFTest(targetExpr, clockExpr, sortedTimepoints);
      if (result) {
        result.clockGene = clockName;
        result.targetGene = targetName;
        results.push(result);
      }
    }
  }

  return applyBHFDR(results);
}

function computeEigenvaluesForGene(
  expr: number[],
  timepoints: number[]
): { modulus: number; eigenperiod: number | null; beta1: number; beta2: number } | null {
  const timeIndices = timepoints.map((t, i) => ({ time: t, index: i }));
  timeIndices.sort((a, b) => a.time - b.time);
  const sortedExpr = timeIndices.map(x => expr[x.index]);
  const sortedTime = timeIndices.map(x => x.time);
  const n = sortedExpr.length;
  if (n < 5) return null;

  const Y: number[] = [];
  const X: number[][] = [];
  for (let t = 2; t < n; t++) {
    Y.push(sortedExpr[t]);
    X.push([1, sortedExpr[t - 1], sortedExpr[t - 2]]);
  }

  const XtX = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const XtY = [0, 0, 0];
  for (let i = 0; i < Y.length; i++) {
    for (let j = 0; j < 3; j++) {
      XtY[j] += X[i][j] * Y[i];
      for (let k = 0; k < 3; k++) {
        XtX[j][k] += X[i][j] * X[i][k];
      }
    }
  }

  const beta = solveLinearSystem(XtX, XtY);
  if (!beta || beta.some(b => !isFinite(b))) return null;

  const beta1 = beta[1];
  const beta2 = beta[2];
  const discriminant = beta1 * beta1 + 4 * beta2;
  let modulus: number;
  let eigenperiod: number | null = null;

  if (discriminant >= 0) {
    const e1 = (beta1 + Math.sqrt(discriminant)) / 2;
    const e2 = (beta1 - Math.sqrt(discriminant)) / 2;
    modulus = Math.max(Math.abs(e1), Math.abs(e2));
  } else {
    const realPart = beta1 / 2;
    const imagPart = Math.sqrt(-discriminant) / 2;
    modulus = Math.sqrt(realPart * realPart + imagPart * imagPart);
    const theta = Math.atan2(imagPart, realPart);
    if (Math.abs(theta) > 0.001) {
      const samplingInterval = sortedTime.length > 1 ? sortedTime[1] - sortedTime[0] : 2;
      eigenperiod = (2 * Math.PI / Math.abs(theta)) * samplingInterval;
    }
  }

  return { modulus, eigenperiod, beta1, beta2 };
}

let cachedResult: ManuscriptValidationResult | null = null;

export async function runManuscriptValidation(): Promise<ManuscriptValidationResult> {
  cachedResult = null;
  if (cachedResult) return cachedResult;

  const datasetsDir = path.join(process.cwd(), 'datasets');

  const GSE54650_TISSUES = [
    'Adrenal', 'Aorta', 'Brainstem', 'Brown_Fat', 'Cerebellum',
    'Heart', 'Hypothalamus', 'Kidney', 'Liver', 'Lung', 'Muscle', 'White_Fat'
  ];

  const tissueResults: TissueResults[] = [];

  for (const tissue of GSE54650_TISSUES) {
    const filename = `GSE54650_${tissue}_circadian.csv`;
    const filepath = path.join(datasetsDir, filename);
    if (!fs.existsSync(filepath)) continue;

    try {
      const parsedData = await parseDatasetFile(filepath);
      const results = runGatingAnalysis(parsedData, CLOCK_GENES, TARGET_GENES);
      const significantPairs = results.filter(r => r.significant).length;

      tissueResults.push({
        tissue: tissue.replace(/_/g, ' '),
        dataset: filename,
        results,
        discoveryRate: results.length > 0 ? significantPairs / results.length : 0,
        totalPairs: results.length,
        significantPairs
      });
    } catch (e) {
      console.error(`Error processing ${filename}:`, e);
    }
  }

  const totalSignificant = tissueResults.reduce((sum, t) => sum + t.significantPairs, 0);
  const totalPairs = tissueResults.reduce((sum, t) => sum + t.totalPairs, 0);
  const overallDiscoveryRate = totalPairs > 0 ? totalSignificant / totalPairs : 0;

  const cry1Wee1Tissues: string[] = [];
  const cry1Wee1PValues: Record<string, number> = {};
  for (const tr of tissueResults) {
    const cry1Wee1 = tr.results.find(r => r.clockGene === 'Cry1' && r.targetGene === 'Wee1' && r.significant);
    if (cry1Wee1) {
      cry1Wee1Tissues.push(tr.tissue);
      cry1Wee1PValues[tr.tissue] = cry1Wee1.pValue;
    }
  }

  const mycTissues: string[] = [];
  for (const tr of tissueResults) {
    const mycSig = tr.results.filter(r => r.targetGene === 'Myc' && r.significant);
    if (mycSig.length > 0) {
      mycTissues.push(tr.tissue);
    }
  }

  let bmal1KO: { wtGap: number; koGap: number; hierarchyCollapsed: boolean } | null = null;
  try {
    const wtPath = path.join(datasetsDir, 'GSE70499_Liver_Bmal1WT_circadian.csv');
    const koPath = path.join(datasetsDir, 'GSE70499_Liver_Bmal1KO_circadian.csv');
    if (fs.existsSync(wtPath) && fs.existsSync(koPath)) {
      const wtData = await parseDatasetFile(wtPath);
      const koData = await parseDatasetFile(koPath);

      const computeHierarchyGap = (parsed: ParsedDataset): number => {
        const geneIds = Array.from(parsed.geneTimeSeries.keys());
        const clockModuli: number[] = [];
        const targetModuli: number[] = [];

        for (const gene of CLOCK_GENES) {
          const resolved = resolveGeneName(gene, geneIds);
          if (!resolved) continue;
          const expr = parsed.geneTimeSeries.get(resolved);
          if (!expr) continue;
          const ev = computeEigenvaluesForGene(expr, parsed.timepoints);
          if (ev && isFinite(ev.modulus) && ev.modulus < 1.5 && ev.modulus > 0) clockModuli.push(ev.modulus);
        }
        for (const gene of TARGET_GENES) {
          const resolved = resolveGeneName(gene, geneIds);
          if (!resolved) continue;
          const expr = parsed.geneTimeSeries.get(resolved);
          if (!expr) continue;
          const ev = computeEigenvaluesForGene(expr, parsed.timepoints);
          if (ev && isFinite(ev.modulus) && ev.modulus < 1.5 && ev.modulus > 0) targetModuli.push(ev.modulus);
        }

        const mean = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
        return mean(clockModuli) - mean(targetModuli);
      };

      const wtGap = computeHierarchyGap(wtData);
      const koGap = computeHierarchyGap(koData);
      bmal1KO = { wtGap, koGap, hierarchyCollapsed: Math.abs(koGap) < 0.05 };
    }
  } catch (e) {
    console.error('Error computing Bmal1-KO:', e);
  }

  const ORGANOID_CONDITIONS: Record<string, string> = {
    'WT': 'GSE157357_Organoid_WT-WT_circadian.csv',
    'APC-Mut': 'GSE157357_Organoid_ApcKO-WT_circadian.csv',
    'BMAL-Mut': 'GSE157357_Organoid_WT-BmalKO_circadian.csv',
    'Double-Mut': 'GSE157357_Organoid_ApcKO-BmalKO_circadian.csv'
  };

  const organoidResults: Record<string, TissueResults> = {};
  const discoveryRates: Record<string, number> = {};

  for (const [condition, filename] of Object.entries(ORGANOID_CONDITIONS)) {
    const filepath = path.join(datasetsDir, filename);
    if (!fs.existsSync(filepath)) continue;

    try {
      const parsedData = await parseDatasetFile(filepath);
      const results = runGatingAnalysis(parsedData, CORE_CLOCK_GENES, TARGET_GENES);
      const significantPairs = results.filter(r => r.significant).length;
      const totalPairsOrg = results.length;
      const rate = totalPairsOrg > 0 ? significantPairs / totalPairsOrg : 0;

      organoidResults[condition] = {
        tissue: condition,
        dataset: filename,
        results,
        discoveryRate: rate,
        totalPairs: totalPairsOrg,
        significantPairs
      };
      discoveryRates[condition] = rate;
    } catch (e) {
      console.error(`Error processing organoid ${filename}:`, e);
    }
  }

  const wtRate = discoveryRates['WT'] || 0;
  const apcRate = discoveryRates['APC-Mut'] || 0;
  const doubleMutRate = discoveryRates['Double-Mut'] || 0;
  const apcCompensation = {
    wtRate: wtRate * 100,
    apcRate: apcRate * 100,
    foldChange: wtRate > 0 ? apcRate / wtRate : 0,
    doubleMutRate: doubleMutRate * 100,
    collapseRatio: doubleMutRate > 0 && apcRate > 0 ? apcRate / doubleMutRate : 0
  };

  let lgr5Gating: ManuscriptValidationResult['paperE']['lgr5Gating'] = null;
  const bmalMutResults = organoidResults['BMAL-Mut'];
  if (bmalMutResults) {
    const lgr5Hits = bmalMutResults.results.filter(r => r.targetGene.toLowerCase() === 'lgr5' && r.significant);
    const lgr5PValues: Record<string, number> = {};
    lgr5Hits.forEach(r => { lgr5PValues[r.clockGene] = r.pValue; });
    lgr5Gating = {
      clockGenes: lgr5Hits.map(r => r.clockGene),
      pValues: lgr5PValues,
      allEightGated: lgr5Hits.length >= 8
    };
  }

  let ppargGating: ManuscriptValidationResult['paperE']['ppargGating'] = null;
  try {
    const mycOnPath = path.join(datasetsDir, 'GSE221103_Neuroblastoma_MYC_ON.csv');
    if (fs.existsSync(mycOnPath)) {
      const mycOnData = await parseDatasetFile(mycOnPath);
      const mycOnResults = runGatingAnalysis(mycOnData, CORE_CLOCK_GENES, ['Pparg']);
      const ppargHits = mycOnResults.filter(r => r.targetGene === 'Pparg' && r.significantFDR);
      const ppargPValues: Record<string, number> = {};
      ppargHits.forEach(r => { ppargPValues[r.clockGene] = r.pValue; });
      const meanF2 = ppargHits.length > 0
        ? ppargHits.reduce((s, r) => s + r.cohenF2, 0) / ppargHits.length
        : 0;
      ppargGating = {
        clockGenes: ppargHits.map(r => r.clockGene),
        pValues: ppargPValues,
        meanF2,
        allSignificant: ppargHits.length >= 8
      };
    }
  } catch (e) {
    console.error('Error computing Pparg gating:', e);
  }

  let eigenperiods: ManuscriptValidationResult['paperE']['eigenperiods'] = null;
  try {
    const healthyPeriods: number[] = [];
    for (const tr of tissueResults) {
      const filepath = path.join(datasetsDir, tr.dataset);
      if (!fs.existsSync(filepath)) continue;
      const parsed = await parseDatasetFile(filepath);
      const geneIds = Array.from(parsed.geneTimeSeries.keys());

      for (const gene of [...CLOCK_GENES, ...TARGET_GENES]) {
        const resolved = resolveGeneName(gene, geneIds);
        if (!resolved) continue;
        const expr = parsed.geneTimeSeries.get(resolved);
        if (!expr) continue;
        const ev = computeEigenvaluesForGene(expr, parsed.timepoints);
        if (ev && ev.eigenperiod && ev.eigenperiod > 0 && ev.eigenperiod < 100) {
          healthyPeriods.push(ev.eigenperiod);
        }
      }
    }

    const cancerPeriods: number[] = [];
    for (const filename of ['GSE221103_Neuroblastoma_MYC_ON.csv', 'GSE221103_Neuroblastoma_MYC_OFF.csv']) {
      const filepath = path.join(datasetsDir, filename);
      if (!fs.existsSync(filepath)) continue;
      const parsed = await parseDatasetFile(filepath);
      const geneIds = Array.from(parsed.geneTimeSeries.keys());

      for (const gene of [...CLOCK_GENES, ...TARGET_GENES]) {
        const resolved = resolveGeneName(gene, geneIds);
        if (!resolved) continue;
        const expr = parsed.geneTimeSeries.get(resolved);
        if (!expr) continue;
        const ev = computeEigenvaluesForGene(expr, parsed.timepoints);
        if (ev && ev.eigenperiod && ev.eigenperiod > 0 && ev.eigenperiod < 100) {
          cancerPeriods.push(ev.eigenperiod);
        }
      }
    }

    if (healthyPeriods.length > 0 || cancerPeriods.length > 0) {
      eigenperiods = {
        healthyRange: healthyPeriods,
        cancerRange: cancerPeriods
      };
    }
  } catch (e) {
    console.error('Error computing eigenperiods:', e);
  }

  // === Paper B: Resonance Zone Discovery ===
  const RESONANCE_PHI1_MIN = 0.8, RESONANCE_PHI1_MAX = 1.2;
  const RESONANCE_PHI2_MIN = -0.8, RESONANCE_PHI2_MAX = -0.3;

  const clockGeneSet = new Set(CLOCK_GENES.map(g => g.toLowerCase()));
  const targetGeneSet = new Set(TARGET_GENES.map(g => g.toLowerCase()));

  let totalClockInZone = 0, totalClockGenes = 0;
  let totalBgInZone = 0, totalBgGenes = 0;
  const tissueScans: ManuscriptValidationResult['paperB']['tissueScans'] = [];
  const geneZoneTissueMap = new Map<string, string[]>();

  for (const tissue of GSE54650_TISSUES) {
    const filename = `GSE54650_${tissue}_circadian.csv`;
    const filepath = path.join(datasetsDir, filename);
    if (!fs.existsSync(filepath)) continue;

    try {
      const parsed = await parseDatasetFile(filepath);
      const geneIds = Array.from(parsed.geneTimeSeries.keys());
      let inZone = 0, clockInZone = 0, totalGenesInTissue = 0;

      for (const geneId of geneIds) {
        const expr = parsed.geneTimeSeries.get(geneId);
        if (!expr || expr.length < 5) continue;

        const ev = computeEigenvaluesForGene(expr, parsed.timepoints);
        if (!ev || !isFinite(ev.beta1) || !isFinite(ev.beta2)) continue;

        totalGenesInTissue++;
        const phi1 = ev.beta1, phi2 = ev.beta2;
        const inResonance = phi1 >= RESONANCE_PHI1_MIN && phi1 <= RESONANCE_PHI1_MAX &&
                            phi2 >= RESONANCE_PHI2_MIN && phi2 <= RESONANCE_PHI2_MAX;

        const resolvedName = getDisplayName(geneId) || geneId;
        const isClockGene = clockGeneSet.has(resolvedName.toLowerCase()) ||
                            clockGeneSet.has(geneId.toLowerCase());

        if (isClockGene) {
          totalClockGenes++;
          if (inResonance) { totalClockInZone++; clockInZone++; }
        } else {
          totalBgGenes++;
          if (inResonance) totalBgInZone++;
        }

        if (inResonance) {
          inZone++;
          const displayName = resolvedName;
          if (!geneZoneTissueMap.has(displayName)) geneZoneTissueMap.set(displayName, []);
          geneZoneTissueMap.get(displayName)!.push(tissue.replace(/_/g, ' '));
        }
      }

      tissueScans.push({ tissue: tissue.replace(/_/g, ' '), totalGenes: totalGenesInTissue, inZone, clockInZone });
    } catch (e) {
      console.error(`Paper B scan error for ${tissue}:`, e);
    }
  }

  const clockPercent = totalClockGenes > 0 ? (totalClockInZone / totalClockGenes) * 100 : 0;
  const bgPercent = totalBgGenes > 0 ? (totalBgInZone / totalBgGenes) * 100 : 0;
  const enrichmentRatio = bgPercent > 0 ? clockPercent / bgPercent : 0;

  const a = totalClockInZone, b = totalClockGenes - totalClockInZone;
  const c = totalBgInZone, d = totalBgGenes - totalBgInZone;
  const n_fisher = a + b + c + d;
  const chi2 = n_fisher > 0 ? (n_fisher * (a * d - b * c) ** 2) / ((a + b) * (c + d) * (a + c) * (b + d) || 1) : 0;
  const resonancePValue = chi2 > 0 ? Math.max(1e-16, Math.exp(-chi2 / 2)) : 1;

  const multiTissueResonanceGenes = Array.from(geneZoneTissueMap.entries())
    .filter(([name, tissues]) => tissues.length >= 3 && !clockGeneSet.has(name.toLowerCase()) && !targetGeneSet.has(name.toLowerCase()))
    .map(([name]) => name);

  const paperB: ManuscriptValidationResult['paperB'] = {
    resonanceZone: {
      clockInZone: totalClockInZone,
      clockTotal: totalClockGenes,
      clockPercent: +clockPercent.toFixed(2),
      bgInZone: totalBgInZone,
      bgTotal: totalBgGenes,
      bgPercent: +bgPercent.toFixed(2),
      enrichmentRatio: +enrichmentRatio.toFixed(1),
      pValue: resonancePValue,
    },
    multiTissueResonanceGenes,
    tissueScans,
  };

  // === Paper C: 12-Tissue BMAL1 Coupling Atlas ===
  const couplingTissueResults: ManuscriptValidationResult['paperC']['tissueResults'] = [];
  const geneCouplingCounts = new Map<string, number>();
  let totalCoupledSignificant = 0;
  let totalCoupledTested = 0;
  let arntlSigCount = 0, arntlTestCount = 0;
  let randomSigCount = 0, randomTestCount = 0;

  const ALL_TESTED_GENES = [...CLOCK_GENES, ...TARGET_GENES];

  for (const tissue of GSE54650_TISSUES) {
    const filename = `GSE54650_${tissue}_circadian.csv`;
    const filepath = path.join(datasetsDir, filename);
    if (!fs.existsSync(filepath)) continue;

    try {
      const parsed = await parseDatasetFile(filepath);
      const geneIds = Array.from(parsed.geneTimeSeries.keys());
      const timeIndices = parsed.timepoints.map((t, i) => ({ time: t, index: i }));
      timeIndices.sort((a, b) => a.time - b.time);
      const sortedTime = timeIndices.map(x => x.time);

      const arntlResolved = resolveGeneName('Arntl', geneIds);
      if (!arntlResolved) continue;
      const arntlRaw = parsed.geneTimeSeries.get(arntlResolved);
      if (!arntlRaw) continue;
      const arntlExpr = timeIndices.map(x => arntlRaw[x.index]);

      const bgGeneIds = geneIds.filter(g => {
        const disp = (getDisplayName(g) || g).toLowerCase();
        return !clockGeneSet.has(disp) && !targetGeneSet.has(disp);
      });
      const randomPredictor = bgGeneIds.length > 0 ? bgGeneIds[Math.floor(bgGeneIds.length / 2)] : null;
      let randomExpr: number[] | null = null;
      if (randomPredictor) {
        const rawRandom = parsed.geneTimeSeries.get(randomPredictor);
        if (rawRandom) randomExpr = timeIndices.map(x => rawRandom[x.index]);
      }

      const rawPValues: number[] = [];
      const geneResults: { gene: string; pValue: number }[] = [];
      let wee1Coupled = false;
      let tissueRandomSig = 0, tissueRandomTest = 0;

      for (const geneName of ALL_TESTED_GENES) {
        if (geneName === 'Arntl') continue;
        const resolved = resolveGeneName(geneName, geneIds);
        if (!resolved) continue;
        const rawExpr = parsed.geneTimeSeries.get(resolved);
        if (!rawExpr) continue;
        const targetExpr = timeIndices.map(x => rawExpr[x.index]);

        const n = targetExpr.length;
        if (n < 6) continue;

        const Y: number[] = [];
        const X_red: number[][] = [];
        const X_full: number[][] = [];

        for (let t = 2; t < n; t++) {
          Y.push(targetExpr[t]);
          X_red.push([1, targetExpr[t - 1], targetExpr[t - 2]]);
          X_full.push([1, targetExpr[t - 1], targetExpr[t - 2], arntlExpr[t]]);
        }

        const nObs = Y.length;
        if (nObs < 5) continue;

        const XtX_red = Array(3).fill(0).map(() => Array(3).fill(0));
        const XtY_red = Array(3).fill(0);
        for (let i = 0; i < nObs; i++) {
          for (let j = 0; j < 3; j++) {
            XtY_red[j] += X_red[i][j] * Y[i];
            for (let k = 0; k < 3; k++) XtX_red[j][k] += X_red[i][j] * X_red[i][k];
          }
        }

        const XtX_full = Array(4).fill(0).map(() => Array(4).fill(0));
        const XtY_full = Array(4).fill(0);
        for (let i = 0; i < nObs; i++) {
          for (let j = 0; j < 4; j++) {
            XtY_full[j] += X_full[i][j] * Y[i];
            for (let k = 0; k < 4; k++) XtX_full[j][k] += X_full[i][j] * X_full[i][k];
          }
        }

        const betaRed = solveLinearSystem(XtX_red, XtY_red);
        const betaFull = solveLinearSystem(XtX_full, XtY_full);
        if (!betaRed || !betaFull) continue;
        if (betaRed.some(b => !isFinite(b)) || betaFull.some(b => !isFinite(b))) continue;

        let ssResRed = 0, ssResFull = 0;
        for (let i = 0; i < nObs; i++) {
          let predRed = 0, predFull = 0;
          for (let j = 0; j < 3; j++) predRed += betaRed[j] * X_red[i][j];
          for (let j = 0; j < 4; j++) predFull += betaFull[j] * X_full[i][j];
          ssResRed += (Y[i] - predRed) ** 2;
          ssResFull += (Y[i] - predFull) ** 2;
        }

        const df1 = 1;
        const df2 = nObs - 4;
        if (df2 <= 0 || ssResFull <= 0) continue;

        const fStat = ((ssResRed - ssResFull) / df1) / (ssResFull / df2);
        const pVal = fTestPValue(Math.max(0, fStat), df1, df2);
        rawPValues.push(pVal);
        geneResults.push({ gene: geneName, pValue: pVal });
        arntlTestCount++;

        if (randomExpr) {
          const X_rand: number[][] = [];
          for (let t = 2; t < n; t++) {
            X_rand.push([1, targetExpr[t - 1], targetExpr[t - 2], randomExpr[t]]);
          }
          const XtX_rand = Array(4).fill(0).map(() => Array(4).fill(0));
          const XtY_rand = Array(4).fill(0);
          for (let i = 0; i < nObs; i++) {
            for (let j = 0; j < 4; j++) {
              XtY_rand[j] += X_rand[i][j] * Y[i];
              for (let k = 0; k < 4; k++) XtX_rand[j][k] += X_rand[i][j] * X_rand[i][k];
            }
          }
          const betaRand = solveLinearSystem(XtX_rand, XtY_rand);
          if (betaRand && betaRand.every(b => isFinite(b))) {
            let ssResRand = 0;
            for (let i = 0; i < nObs; i++) {
              let pred = 0;
              for (let j = 0; j < 4; j++) pred += betaRand[j] * X_rand[i][j];
              ssResRand += (Y[i] - pred) ** 2;
            }
            const fRand = ((ssResRed - ssResRand) / df1) / (ssResRand / df2);
            const pRand = fTestPValue(Math.max(0, fRand), df1, df2);
            tissueRandomTest++;
            if (pRand < 0.05) tissueRandomSig++;
          }
        }
      }

      randomSigCount += tissueRandomSig;
      randomTestCount += tissueRandomTest;

      if (rawPValues.length === 0) continue;

      const sorted = [...rawPValues].sort((a, b) => a - b);
      const m = sorted.length;
      const qValues: number[] = new Array(m);
      for (let i = m - 1; i >= 0; i--) {
        const raw = sorted[i] * m / (i + 1);
        qValues[i] = i < m - 1 ? Math.min(raw, qValues[i + 1]) : raw;
        qValues[i] = Math.min(1, qValues[i]);
      }

      const pToQ = new Map<number, number>();
      sorted.forEach((p, i) => pToQ.set(p, qValues[i]));

      let sigCount = 0;
      for (const gr of geneResults) {
        const q = pToQ.get(gr.pValue) ?? 1;
        const sig = q < 0.05;
        if (sig) {
          sigCount++;
          arntlSigCount++;
          geneCouplingCounts.set(gr.gene, (geneCouplingCounts.get(gr.gene) || 0) + 1);
          if (gr.gene === 'Wee1') wee1Coupled = true;
        }
      }

      totalCoupledSignificant += sigCount;
      totalCoupledTested += geneResults.length;

      couplingTissueResults.push({
        tissue: tissue.replace(/_/g, ' '),
        totalTested: geneResults.length,
        significantCoupled: sigCount,
        rate: geneResults.length > 0 ? +(sigCount / geneResults.length * 100).toFixed(1) : 0,
        wee1Coupled,
      });
    } catch (e) {
      console.error(`Paper C coupling error for ${tissue}:`, e);
    }
  }

  const wee1TissueCount = couplingTissueResults.filter(t => t.wee1Coupled).length;
  const arntlRate = arntlTestCount > 0 ? (arntlSigCount / arntlTestCount) * 100 : 0;
  const randomRate = randomTestCount > 0 ? (randomSigCount / randomTestCount) * 100 : 0;
  const couplingEnrichment = randomRate > 0 ? arntlRate / randomRate : arntlRate > 0 ? Infinity : 0;

  const topCoupledGenes = Array.from(geneCouplingCounts.entries())
    .map(([gene, tissueCount]) => ({ gene, tissueCount }))
    .sort((a, b) => b.tissueCount - a.tissueCount)
    .slice(0, 25);

  const paperC: ManuscriptValidationResult['paperC'] = {
    tissueResults: couplingTissueResults,
    wee1TissueCount,
    totalSignificant: totalCoupledSignificant,
    overallRate: totalCoupledTested > 0 ? +(totalCoupledSignificant / totalCoupledTested * 100).toFixed(1) : 0,
    arntlVsRandom: {
      arntlRate: +arntlRate.toFixed(2),
      randomRate: +randomRate.toFixed(2),
      enrichmentRatio: isFinite(couplingEnrichment) ? +couplingEnrichment.toFixed(1) : 0,
    },
    topCoupledGenes,
  };

  // === Paper D: Cross-Metric Independence ===
  let paperD: ManuscriptValidationResult['paperD'];
  try {
    const crossMetricResult = analyzeCrossMetricIndependence(datasetsDir, 'mouse');
    const corrNetwork = crossMetricResult.correlations.eigenvalue_vs_networkDegree;
    const corrAmplitude = crossMetricResult.correlations.eigenvalue_vs_amplitude;
    const corrChromatin = crossMetricResult.correlations.eigenvalue_vs_h3k4me3;
    const partial = crossMetricResult.partialCorrelations;
    const conservation = crossMetricResult.conservationSummary;

    paperD = {
      correlations: {
        eigenvalue_vs_network: { rho: corrNetwork.rho, pValue: corrNetwork.pValue, n: corrNetwork.n },
        eigenvalue_vs_amplitude: { rho: corrAmplitude.rho, pValue: corrAmplitude.pValue, n: corrAmplitude.n },
        eigenvalue_vs_chromatin: { rho: corrChromatin.rho, pValue: corrChromatin.pValue, n: corrChromatin.n },
      },
      partialCorrelations: {
        eigenvalue_amplitude_controllingNetwork: { rho: partial.eigenvalue_amplitude_controllingNetwork?.rho ?? 0 },
        eigenvalue_network_controllingAmplitude: { rho: partial.eigenvalue_network_controllingAmplitude?.rho ?? 0 },
      },
      conservation: {
        clockMeanCV: conservation.clockMeanCV,
        targetMeanCV: conservation.targetMeanCV,
        clockMoreConserved: conservation.clockMoreConserved,
      },
      independence_confirmed: Math.abs(corrChromatin.rho) < 0.15,
    };
  } catch (e) {
    console.error('Paper D cross-metric independence error:', e);
    paperD = {
      correlations: {
        eigenvalue_vs_network: { rho: 0, pValue: 1, n: 0 },
        eigenvalue_vs_amplitude: { rho: 0, pValue: 1, n: 0 },
        eigenvalue_vs_chromatin: { rho: 0, pValue: 1, n: 0 },
      },
      partialCorrelations: {
        eigenvalue_amplitude_controllingNetwork: { rho: 0 },
        eigenvalue_network_controllingAmplitude: { rho: 0 },
      },
      conservation: { clockMeanCV: 0, targetMeanCV: 0, clockMoreConserved: false },
      independence_confirmed: false,
    };
  }

  const result: ManuscriptValidationResult = {
    paperA: {
      tissueResults,
      totalSignificant,
      totalPairs,
      overallDiscoveryRate,
      cry1Wee1Conservation: {
        tissues: cry1Wee1Tissues,
        count: cry1Wee1Tissues.length,
        pValues: cry1Wee1PValues
      },
      mycTissues,
      bmal1KO
    },
    paperB,
    paperC: paperC,
    paperD,
    paperE: {
      organoidResults,
      discoveryRates,
      apcCompensation,
      lgr5Gating,
      ppargGating,
      eigenperiods
    },
    computedAt: new Date().toISOString(),
    methodology: 'Current papers (A, E, F, G) plus archived analyses (resonance zone, coupling atlas, cross-metric independence — content incorporated into Papers A and E). Paper A: PAR(2) phase-interaction F-test (df1=4, df2=n-7) with Bonferroni correction. Paper E: BH FDR on raw p-values (q < 0.05). Paper F: Half-life independence replication across 7 datasets (22,989 genes), Spearman ρ with partial correlation controls. Paper G: Fibonacci Reply cross-validation across 22 datasets/5 species with honest caveats (φ-enrichment p=0.154, BMAL1-KO partially disconfirmed). Archived resonance zone: AR(2) resonance zone classification (φ₁∈[0.8,1.2], φ₂∈[-0.8,-0.3]). Archived coupling atlas: AR(2)+exogenous Arntl coupling F-test (df1=1, df2=n-4) with BH FDR. Archived cross-metric: Spearman correlations from curated cross-metric data.'
  };

  cachedResult = result;
  return result;
}

export function clearValidationCache() {
  cachedResult = null;
}
