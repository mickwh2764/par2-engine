import * as fs from 'fs';
import * as path from 'path';
import { ENSEMBL_TO_SYMBOL } from './gene-categories';

const CLOCK_GENES_UPPER = new Set([
  'PER1', 'PER2', 'PER3', 'CRY1', 'CRY2', 'CLOCK', 'ARNTL', 'BMAL1',
  'NR1D1', 'NR1D2', 'RORC', 'DBP', 'TEF', 'NPAS2'
]);

const TARGET_GENES_UPPER = new Set([
  'MYC', 'CCND1', 'CCNB1', 'CDK1', 'WEE1', 'CDKN1A', 'LGR5', 'AXIN2',
  'CTNNB1', 'APC', 'TP53', 'TRP53', 'MDM2', 'ATM', 'CHEK2', 'BCL2',
  'BAX', 'PPARG', 'SIRT1', 'HIF1A', 'CCNE1', 'CCNE2', 'MCM6', 'MKI67'
]);

function fitAR2(series: number[]): { phi1: number; phi2: number; eigenvalue: number; r2: number } {
  const n = series.length;
  if (n < 5) return { phi1: 0, phi2: 0, eigenvalue: 0, r2: 0 };

  const mean = series.reduce((a, b) => a + b, 0) / n;
  const y = series.map(x => x - mean);

  const Y = y.slice(2);
  const Y1 = y.slice(1, n - 1);
  const Y2 = y.slice(0, n - 2);

  let sumY1Y1 = 0, sumY2Y2 = 0, sumY1Y2 = 0, sumYY1 = 0, sumYY2 = 0;
  for (let i = 0; i < Y.length; i++) {
    sumY1Y1 += Y1[i] * Y1[i];
    sumY2Y2 += Y2[i] * Y2[i];
    sumY1Y2 += Y1[i] * Y2[i];
    sumYY1 += Y[i] * Y1[i];
    sumYY2 += Y[i] * Y2[i];
  }

  const denom = sumY1Y1 * sumY2Y2 - sumY1Y2 * sumY1Y2;
  if (Math.abs(denom) < 1e-10) return { phi1: 0, phi2: 0, eigenvalue: 0, r2: 0 };

  const phi1 = (sumYY1 * sumY2Y2 - sumYY2 * sumY1Y2) / denom;
  const phi2 = (sumYY2 * sumY1Y1 - sumYY1 * sumY1Y2) / denom;

  const discriminant = phi1 * phi1 + 4 * phi2;
  let eigenvalue: number;
  if (discriminant < 0) {
    eigenvalue = Math.sqrt(-phi2);
  } else {
    const r1 = (phi1 + Math.sqrt(discriminant)) / 2;
    const r2val = (phi1 - Math.sqrt(discriminant)) / 2;
    eigenvalue = Math.max(Math.abs(r1), Math.abs(r2val));
  }

  let ssTot = 0, ssRes = 0;
  const yMean = Y.reduce((a, b) => a + b, 0) / Y.length;
  for (let i = 0; i < Y.length; i++) {
    const pred = phi1 * Y1[i] + phi2 * Y2[i];
    ssRes += (Y[i] - pred) ** 2;
    ssTot += (Y[i] - yMean) ** 2;
  }
  const r2 = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;

  return { phi1, phi2, eigenvalue, r2 };
}

function classifyGene(name: string): 'clock' | 'target' | 'other' {
  const upper = name.toUpperCase();
  if (CLOCK_GENES_UPPER.has(upper)) return 'clock';
  if (TARGET_GENES_UPPER.has(upper)) return 'target';
  return 'other';
}

function parseDataset(filePath: string): Map<string, { gene: string; type: 'clock' | 'target' | 'other'; values: number[] }> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  const genes = new Map<string, { gene: string; type: 'clock' | 'target' | 'other'; values: number[] }>();

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const rawGene = cols[0].trim().replace(/"/g, '');
    if (!rawGene) continue;
    const gene = ENSEMBL_TO_SYMBOL[rawGene] || rawGene;
    const values = cols.slice(1).map(v => parseFloat(v)).filter(v => !isNaN(v));
    if (values.length < 8) continue;
    const type = classifyGene(gene);
    if (type !== 'other') {
      genes.set(gene, { gene, type, values });
    }
  }
  return genes;
}

interface WindowResult {
  windowStart: number;
  windowEnd: number;
  windowSize: number;
  phi1: number;
  phi2: number;
  eigenvalue: number;
  r2: number;
}

interface GeneWindowAnalysis {
  gene: string;
  geneType: 'clock' | 'target';
  totalTimepoints: number;
  windowSize: number;
  nWindows: number;
  fullSeriesEigenvalue: number;
  windows: WindowResult[];
  meanEigenvalue: number;
  stdEigenvalue: number;
  maxDrift: number;
  coefficientOfVariation: number;
  isStable: boolean;
}

interface ChowTestResult {
  fStatistic: number;
  breakpoint: number;
  significantBreak: boolean;
  pApprox: number;
}

interface DatasetRollingResult {
  datasetId: string;
  datasetName: string;
  species: string;
  totalTimepoints: number;
  windowSize: number;
  stepSize: number;
  nWindows: number;
  clockGenes: GeneWindowAnalysis[];
  targetGenes: GeneWindowAnalysis[];
  clockMeanDrift: number;
  targetMeanDrift: number;
  clockMeanCV: number;
  targetMeanCV: number;
  clockStableCount: number;
  targetStableCount: number;
  gapStability: {
    windowGaps: { windowIdx: number; clockMean: number; targetMean: number; gap: number }[];
    gapMean: number;
    gapStd: number;
    gapCV: number;
    hierarchyPreservedInAllWindows: boolean;
  };
  chowTest: ChowTestResult | null;
  verdict: 'STABLE' | 'MARGINAL' | 'UNSTABLE';
  verdictExplanation: string;
}

function computeRollingWindows(
  values: number[],
  windowSize: number,
  stepSize: number
): WindowResult[] {
  const windows: WindowResult[] = [];
  for (let start = 0; start + windowSize <= values.length; start += stepSize) {
    const windowValues = values.slice(start, start + windowSize);
    const result = fitAR2(windowValues);
    windows.push({
      windowStart: start,
      windowEnd: start + windowSize - 1,
      windowSize,
      phi1: result.phi1,
      phi2: result.phi2,
      eigenvalue: result.eigenvalue,
      r2: result.r2,
    });
  }
  return windows;
}

function computeSSR(s: number[], phi1: number, phi2: number): { ssr: number; nObs: number } {
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  const y = s.map(x => x - mean);
  let ssr = 0;
  const nObs = y.length - 2;
  for (let i = 2; i < y.length; i++) {
    const pred = phi1 * y[i - 1] + phi2 * y[i - 2];
    ssr += (y[i] - pred) ** 2;
  }
  return { ssr, nObs };
}

function fDistPValue(f: number, d1: number, d2: number): number {
  if (f <= 0 || d1 <= 0 || d2 <= 0) return 1.0;
  const x = d2 / (d2 + d1 * f);
  return regularizedIncompleteBeta(x, d2 / 2, d1 / 2);
}

function regularizedIncompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lnBeta = lnGamma(a) + lnGamma(b) - lnGamma(a + b);
  const cf = continuedFractionBeta(x, a, b);
  const result = Math.exp(a * Math.log(x) + b * Math.log(1 - x) - lnBeta) * cf / a;
  return Math.min(1.0, Math.max(0.0, result));
}

function continuedFractionBeta(x: number, a: number, b: number): number {
  let c = 1, d = 1 - (a + b) * x / (a + 1);
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 100; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((a + m2 - 1) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    h *= d * c;
    aa = -(a + m) * (a + b + m) * x / ((a + m2) * (a + m2 + 1));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-10) break;
  }
  return h;
}

function lnGamma(z: number): number {
  const g = 7;
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
  }
  z -= 1;
  let x = c[0];
  for (let i = 1; i < g + 2; i++) {
    x += c[i] / (z + i);
  }
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function chowTest(series: number[], breakpoint: number): ChowTestResult {
  const n = series.length;
  const fullFit = fitAR2(series);
  const sub1 = series.slice(0, breakpoint);
  const sub2 = series.slice(breakpoint);

  if (sub1.length < 5 || sub2.length < 5) {
    return { fStatistic: 0, breakpoint, significantBreak: false, pApprox: 1.0 };
  }

  const fit1 = fitAR2(sub1);
  const fit2 = fitAR2(sub2);

  const fullSSR = computeSSR(series, fullFit.phi1, fullFit.phi2);
  const ssr1 = computeSSR(sub1, fit1.phi1, fit1.phi2);
  const ssr2 = computeSSR(sub2, fit2.phi1, fit2.phi2);

  const k = 2;
  const ssrRestricted = fullSSR.ssr;
  const ssrUnrestricted = ssr1.ssr + ssr2.ssr;

  const dfNum = k;
  const dfDen = (ssr1.nObs + ssr2.nObs) - 2 * k;

  if (dfDen <= 0 || ssrUnrestricted <= 0) {
    return { fStatistic: 0, breakpoint, significantBreak: false, pApprox: 1.0 };
  }

  const fStat = ((ssrRestricted - ssrUnrestricted) / dfNum) / (ssrUnrestricted / dfDen);

  const pValue = fDistPValue(fStat, dfNum, dfDen);

  return {
    fStatistic: +fStat.toFixed(4),
    breakpoint,
    significantBreak: pValue < 0.05,
    pApprox: +pValue.toFixed(4),
  };
}

const ROLLING_DATASETS = [
  { id: 'GSE11923_Liver_1h_48h_genes', name: 'Mouse Liver 48h (Hughes 2009, GSE11923)', species: 'Mus musculus', file: 'GSE11923_Liver_1h_48h_genes.csv', timepoints: 48 },
  { id: 'GSE54650_Liver_circadian', name: 'Mouse Liver (Zhang 2014, GSE54650)', species: 'Mus musculus', file: 'GSE54650_Liver_circadian.csv', timepoints: 24 },
  { id: 'GSE113883_Human_WholeBlood', name: 'Human Whole Blood (Braun 2018, GSE113883)', species: 'Homo sapiens', file: 'GSE113883_Human_WholeBlood.csv', timepoints: 15 },
  { id: 'GSE157357_Organoid_WT-WT_circadian', name: 'Mouse Organoid WT-WT (Stokes 2021, GSE157357)', species: 'Mus musculus', file: 'GSE157357_Organoid_WT-WT_circadian.csv', timepoints: 24 },
  { id: 'GSE157357_Organoid_ApcKO-WT_circadian', name: 'Mouse Organoid ApcKO-WT Cancer (Stokes 2021, GSE157357)', species: 'Mus musculus', file: 'GSE157357_Organoid_ApcKO-WT_circadian.csv', timepoints: 24 },
];

export function runRollingWindowAnalysis(options?: { windowFraction?: number; stepFraction?: number }): {
  datasets: DatasetRollingResult[];
  summary: {
    totalDatasets: number;
    stableCount: number;
    marginalCount: number;
    unstableCount: number;
    overallVerdict: string;
    meanClockCV: number;
    meanTargetCV: number;
    gapPreservedInAllWindows: boolean;
  };
} {
  const windowFrac = options?.windowFraction ?? 0.5;
  const stepFrac = options?.stepFraction ?? 0.25;
  const datasets: DatasetRollingResult[] = [];

  for (const ds of ROLLING_DATASETS) {
    const filePath = path.join(process.cwd(), 'datasets', ds.file);
    if (!fs.existsSync(filePath)) continue;

    const genes = parseDataset(filePath);
    if (genes.size === 0) continue;

    const firstGene = genes.values().next().value;
    if (!firstGene) continue;
    const totalTimepoints = firstGene.values.length;

    const windowSize = Math.max(8, Math.floor(totalTimepoints * windowFrac));
    const stepSize = Math.max(1, Math.floor((totalTimepoints - windowSize) * stepFrac));

    const clockGenes: GeneWindowAnalysis[] = [];
    const targetGenes: GeneWindowAnalysis[] = [];

    genes.forEach((geneData) => {
      if (geneData.type === 'other') return;

      const fullFit = fitAR2(geneData.values);
      const windows = computeRollingWindows(geneData.values, windowSize, stepSize || 1);

      if (windows.length < 2) return;

      const qualityWindows = windows.filter(w => w.eigenvalue < 1.0 && w.r2 >= 0.1);
      const eigenvalues = qualityWindows.map(w => w.eigenvalue);

      if (eigenvalues.length < 2) return;

      const meanEV = eigenvalues.reduce((a, b) => a + b, 0) / eigenvalues.length;
      const stdEV = Math.sqrt(eigenvalues.reduce((s, e) => s + (e - meanEV) ** 2, 0) / eigenvalues.length);
      const maxDrift = Math.max(...eigenvalues) - Math.min(...eigenvalues);
      const cv = meanEV > 0 ? stdEV / meanEV : 0;

      const analysis: GeneWindowAnalysis = {
        gene: geneData.gene,
        geneType: geneData.type as 'clock' | 'target',
        totalTimepoints: geneData.values.length,
        windowSize,
        nWindows: windows.length,
        fullSeriesEigenvalue: fullFit.eigenvalue,
        windows,
        meanEigenvalue: +meanEV.toFixed(4),
        stdEigenvalue: +stdEV.toFixed(4),
        maxDrift: +maxDrift.toFixed(4),
        coefficientOfVariation: +cv.toFixed(4),
        isStable: cv < 0.15 && maxDrift < 0.15,
      };

      if (geneData.type === 'clock') clockGenes.push(analysis);
      else targetGenes.push(analysis);
    });

    if (clockGenes.length === 0 && targetGenes.length === 0) continue;

    const clockMeanDrift = clockGenes.length > 0
      ? +(clockGenes.reduce((s, g) => s + g.maxDrift, 0) / clockGenes.length).toFixed(4) : 0;
    const targetMeanDrift = targetGenes.length > 0
      ? +(targetGenes.reduce((s, g) => s + g.maxDrift, 0) / targetGenes.length).toFixed(4) : 0;
    const clockMeanCV = clockGenes.length > 0
      ? +(clockGenes.reduce((s, g) => s + g.coefficientOfVariation, 0) / clockGenes.length).toFixed(4) : 0;
    const targetMeanCV = targetGenes.length > 0
      ? +(targetGenes.reduce((s, g) => s + g.coefficientOfVariation, 0) / targetGenes.length).toFixed(4) : 0;

    const clockStableCount = clockGenes.filter(g => g.isStable).length;
    const targetStableCount = targetGenes.filter(g => g.isStable).length;

    const nWindows = clockGenes.length > 0 ? clockGenes[0].nWindows : (targetGenes.length > 0 ? targetGenes[0].nWindows : 0);
    const windowGaps: { windowIdx: number; clockMean: number; targetMean: number; gap: number }[] = [];

    for (let w = 0; w < nWindows; w++) {
      const clockEVs = clockGenes.map(g => g.windows[w]?.eigenvalue).filter((e): e is number => e !== undefined && e < 1.0);
      const targetEVs = targetGenes.map(g => g.windows[w]?.eigenvalue).filter((e): e is number => e !== undefined && e < 1.0);

      const clockMean = clockEVs.length > 0 ? clockEVs.reduce((a, b) => a + b, 0) / clockEVs.length : 0;
      const targetMean = targetEVs.length > 0 ? targetEVs.reduce((a, b) => a + b, 0) / targetEVs.length : 0;

      windowGaps.push({
        windowIdx: w,
        clockMean: +clockMean.toFixed(4),
        targetMean: +targetMean.toFixed(4),
        gap: +(clockMean - targetMean).toFixed(4),
      });
    }

    const gaps = windowGaps.map(g => g.gap);
    const gapMean = gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
    const gapStd = gaps.length > 0 ? Math.sqrt(gaps.reduce((s, g) => s + (g - gapMean) ** 2, 0) / gaps.length) : 0;
    const gapCV = gapMean > 0 ? gapStd / gapMean : (gapStd === 0 ? 0 : Infinity);
    const hierarchyPreservedInAllWindows = windowGaps.every(g => g.gap > 0);

    let chowResult: ChowTestResult | null = null;
    if (clockGenes.length > 0 && totalTimepoints >= 12) {
      const representativeClock = clockGenes[0];
      const midpoint = Math.floor(representativeClock.totalTimepoints / 2);
      chowResult = chowTest(
        genes.get(representativeClock.gene)!.values,
        midpoint
      );
    }

    const totalGenes = clockGenes.length + targetGenes.length;
    const totalStable = clockStableCount + targetStableCount;
    const stableRatio = totalGenes > 0 ? totalStable / totalGenes : 0;

    let verdict: 'STABLE' | 'MARGINAL' | 'UNSTABLE';
    let verdictExplanation: string;

    const shortSeriesNote = windowSize < 16 ? ` Note: small window size (${windowSize} points) increases sampling variability — apparent drift may reflect estimation noise rather than true non-stationarity.` : '';

    if (stableRatio >= 0.75 && hierarchyPreservedInAllWindows && clockMeanCV < 0.15) {
      verdict = 'STABLE';
      verdictExplanation = `${(stableRatio * 100).toFixed(0)}% of genes show stable |λ| across windows (CV < 0.15). The Clock > Target hierarchy is preserved in all ${nWindows} windows. Non-stationarity is effectively ruled out for this dataset.`;
    } else if (stableRatio >= 0.5 || hierarchyPreservedInAllWindows) {
      verdict = 'MARGINAL';
      verdictExplanation = `${(stableRatio * 100).toFixed(0)}% of genes show stable |λ|. Hierarchy preserved in ${windowGaps.filter(g => g.gap > 0).length}/${nWindows} windows. Some parameter drift detected but core pattern holds.${shortSeriesNote}`;
    } else {
      verdict = 'UNSTABLE';
      verdictExplanation = `Only ${(stableRatio * 100).toFixed(0)}% of genes show stable |λ|. Significant parameter drift detected.${shortSeriesNote || ' Non-stationarity concern is warranted for this dataset.'}`;
    }

    datasets.push({
      datasetId: ds.id,
      datasetName: ds.name,
      species: ds.species,
      totalTimepoints,
      windowSize,
      stepSize: stepSize || 1,
      nWindows,
      clockGenes,
      targetGenes,
      clockMeanDrift,
      targetMeanDrift,
      clockMeanCV,
      targetMeanCV,
      clockStableCount,
      targetStableCount,
      gapStability: {
        windowGaps,
        gapMean: +gapMean.toFixed(4),
        gapStd: +gapStd.toFixed(4),
        gapCV: +gapCV.toFixed(4),
        hierarchyPreservedInAllWindows,
      },
      chowTest: chowResult,
      verdict,
      verdictExplanation,
    });
  }

  const stableCount = datasets.filter(d => d.verdict === 'STABLE').length;
  const marginalCount = datasets.filter(d => d.verdict === 'MARGINAL').length;
  const unstableCount = datasets.filter(d => d.verdict === 'UNSTABLE').length;
  const allClockCVs = datasets.map(d => d.clockMeanCV).filter(v => v > 0);
  const allTargetCVs = datasets.map(d => d.targetMeanCV).filter(v => v > 0);
  const meanClockCV = allClockCVs.length > 0 ? +(allClockCVs.reduce((a, b) => a + b, 0) / allClockCVs.length).toFixed(4) : 0;
  const meanTargetCV = allTargetCVs.length > 0 ? +(allTargetCVs.reduce((a, b) => a + b, 0) / allTargetCVs.length).toFixed(4) : 0;
  const gapPreservedInAllWindows = datasets.every(d => d.gapStability.hierarchyPreservedInAllWindows);

  let overallVerdict: string;
  if (stableCount === datasets.length) {
    overallVerdict = 'PARAMETER STABILITY CONFIRMED — Non-stationarity effectively ruled out across all datasets. AR(2) eigenvalue signatures represent genuine biological states.';
  } else if (unstableCount === 0) {
    overallVerdict = `LARGELY STABLE — ${stableCount}/${datasets.length} datasets show full stability, ${marginalCount} show marginal drift. Core AR(2) signatures are robust.`;
  } else {
    overallVerdict = `MIXED — ${stableCount} stable, ${marginalCount} marginal, ${unstableCount} unstable. Some datasets show parameter drift warranting caution.`;
  }

  return {
    datasets,
    summary: {
      totalDatasets: datasets.length,
      stableCount,
      marginalCount,
      unstableCount,
      overallVerdict,
      meanClockCV,
      meanTargetCV,
      gapPreservedInAllWindows,
    },
  };
}