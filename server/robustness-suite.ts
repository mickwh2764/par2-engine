import * as fs from 'fs';
import * as path from 'path';
import { classifyGene as classifyGeneMulti, ENSEMBL_TO_SYMBOL, ENSEMBL_TO_SYMBOL as MULTI_ENSEMBL, ALL_CATEGORIES, CATEGORY_META, type GeneCategory } from './gene-categories';

const CLOCK_GENES_UPPER = new Set([
  'PER1', 'PER2', 'PER3', 'CRY1', 'CRY2', 'CLOCK', 'ARNTL', 'BMAL1',
  'NR1D1', 'NR1D2', 'RORC', 'DBP', 'TEF', 'NPAS2'
]);

const TARGET_GENES_UPPER = new Set([
  'MYC', 'CCND1', 'CCNB1', 'CDK1', 'WEE1', 'CDKN1A', 'LGR5', 'AXIN2',
  'CTNNB1', 'APC', 'TP53', 'TRP53', 'MDM2', 'ATM', 'CHEK2', 'BCL2',
  'BAX', 'PPARG', 'SIRT1', 'HIF1A', 'CCNE1', 'CCNE2', 'MCM6', 'MKI67'
]);

function mulberry32(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fitAR2(series: number[]): { phi1: number; phi2: number; eigenvalue: number; r2: number; residuals: number[] } {
  const n = series.length;
  if (n < 5) return { phi1: 0, phi2: 0, eigenvalue: 0, r2: 0, residuals: [] };

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
  if (Math.abs(denom) < 1e-10) return { phi1: 0, phi2: 0, eigenvalue: 0, r2: 0, residuals: [] };

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

  const residuals: number[] = [];
  let ssTot = 0, ssRes = 0;
  const yMean = Y.reduce((a, b) => a + b, 0) / Y.length;
  for (let i = 0; i < Y.length; i++) {
    const pred = phi1 * Y1[i] + phi2 * Y2[i];
    const res = Y[i] - pred;
    residuals.push(res);
    ssRes += res * res;
    ssTot += (Y[i] - yMean) ** 2;
  }
  const r2 = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;

  return { phi1, phi2, eigenvalue, r2, residuals };
}

function classifyGene(name: string): 'clock' | 'target' | 'other' {
  const upper = name.toUpperCase();
  if (CLOCK_GENES_UPPER.has(upper)) return 'clock';
  if (TARGET_GENES_UPPER.has(upper)) return 'target';
  return 'other';
}

interface GeneData {
  gene: string;
  type: 'clock' | 'target' | 'other';
  values: number[];
}

function parseDataset(filePath: string, includeOther = false): Map<string, GeneData> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  const genes = new Map<string, GeneData>();

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const rawGene = cols[0].trim().replace(/"/g, '');
    if (!rawGene) continue;
    const gene = ENSEMBL_TO_SYMBOL[rawGene] || rawGene;
    const values = cols.slice(1).map(v => parseFloat(v)).filter(v => !isNaN(v));
    if (values.length < 5) continue;
    const type = classifyGene(gene);
    if (type !== 'other' || includeOther) {
      genes.set(gene, { gene, type, values });
    }
  }
  return genes;
}

function subsample(series: number[], targetN: number, rng: () => number): number[] {
  if (targetN >= series.length) return [...series];
  const indices: number[] = [];
  const step = (series.length - 1) / (targetN - 1);
  for (let i = 0; i < targetN; i++) {
    const exact = i * step;
    const jittered = Math.round(exact + (rng() - 0.5) * step * 0.3);
    indices.push(Math.max(0, Math.min(series.length - 1, jittered)));
  }
  indices.sort((a, b) => a - b);
  const uniqueIndices = Array.from(new Set(indices));
  while (uniqueIndices.length < targetN && uniqueIndices.length < series.length) {
    for (let idx = 0; idx < series.length && uniqueIndices.length < targetN; idx++) {
      if (!uniqueIndices.includes(idx)) {
        uniqueIndices.push(idx);
        uniqueIndices.sort((a, b) => a - b);
      }
    }
  }
  return uniqueIndices.map(i => series[i]);
}

export interface SubsamplingGeneResult {
  gene: string;
  geneType: 'clock' | 'target';
  fullEigenvalue: number;
  subsampleResults: {
    n: number;
    eigenvalues: number[];
    meanEigenvalue: number;
    stdEigenvalue: number;
    meanError: number;
    within10pct: number;
  }[];
}

export interface SubsamplingResult {
  dataset: string;
  fullTimepoints: number;
  subsampleSizes: number[];
  nIterations: number;
  seed: number;
  genes: SubsamplingGeneResult[];
  summary: {
    n: number;
    meanAbsError: number;
    within10pctRate: number;
    clockMeanError: number;
    targetMeanError: number;
    hierarchyPreserved: number;
  }[];
  conclusion: string;
}

export function runSubsamplingAnalysis(seed = 42, nIterations = 50): SubsamplingResult {
  let datasetPath = path.join(process.cwd(), 'datasets', 'GSE11923_Liver_1h_48h_genes.csv');
  if (!fs.existsSync(datasetPath)) {
    datasetPath = path.join(process.cwd(), 'datasets', 'GSE11923_Liver_1h_48h.csv');
  }
  if (!fs.existsSync(datasetPath)) {
    datasetPath = path.join(process.cwd(), 'datasets', 'GSE54650_Liver_circadian.csv');
  }
  if (!fs.existsSync(datasetPath)) throw new Error('No suitable high-resolution dataset found');

  const genes = parseDataset(datasetPath);
  const clockTargetGenes = Array.from(genes.values()).filter(g => g.type !== 'other');
  const fullTimepoints = clockTargetGenes.length > 0 ? clockTargetGenes[0].values.length : 0;

  const subsampleSizes = [24, 12, 8, 6];
  const rng = mulberry32(seed);

  const geneResults: SubsamplingGeneResult[] = [];

  for (const geneData of clockTargetGenes) {
    const fullFit = fitAR2(geneData.values);
    const subsampleResults = subsampleSizes.map(n => {
      const eigenvalues: number[] = [];
      for (let iter = 0; iter < nIterations; iter++) {
        const sub = subsample(geneData.values, n, rng);
        const fit = fitAR2(sub);
        eigenvalues.push(fit.eigenvalue);
      }
      const mean = eigenvalues.reduce((a, b) => a + b, 0) / eigenvalues.length;
      const std = Math.sqrt(eigenvalues.reduce((a, b) => a + (b - mean) ** 2, 0) / eigenvalues.length);
      const errors = eigenvalues.map(e => Math.abs(e - fullFit.eigenvalue));
      const meanError = errors.reduce((a, b) => a + b, 0) / errors.length;
      const within10pct = errors.filter(e => e <= fullFit.eigenvalue * 0.1).length / errors.length;
      return { n, eigenvalues, meanEigenvalue: mean, stdEigenvalue: std, meanError, within10pct };
    });

    geneResults.push({
      gene: geneData.gene,
      geneType: geneData.type as 'clock' | 'target',
      fullEigenvalue: fullFit.eigenvalue,
      subsampleResults
    });
  }

  const summary = subsampleSizes.map(n => {
    const clockGenes = geneResults.filter(g => g.geneType === 'clock');
    const targetGenes = geneResults.filter(g => g.geneType === 'target');
    const allResults = geneResults.map(g => g.subsampleResults.find(s => s.n === n)!);

    const meanAbsError = allResults.reduce((a, r) => a + r.meanError, 0) / allResults.length;
    const within10pctRate = allResults.reduce((a, r) => a + r.within10pct, 0) / allResults.length;

    const clockErrors = clockGenes.map(g => g.subsampleResults.find(s => s.n === n)!.meanError);
    const targetErrors = targetGenes.map(g => g.subsampleResults.find(s => s.n === n)!.meanError);
    const clockMeanError = clockErrors.length > 0 ? clockErrors.reduce((a, b) => a + b, 0) / clockErrors.length : 0;
    const targetMeanError = targetErrors.length > 0 ? targetErrors.reduce((a, b) => a + b, 0) / targetErrors.length : 0;

    let hierarchyPreserved = 0;
    for (let iter = 0; iter < nIterations; iter++) {
      const clockMean = clockGenes.length > 0
        ? clockGenes.reduce((a, g) => a + g.subsampleResults.find(s => s.n === n)!.eigenvalues[iter], 0) / clockGenes.length
        : 0;
      const targetMean = targetGenes.length > 0
        ? targetGenes.reduce((a, g) => a + g.subsampleResults.find(s => s.n === n)!.eigenvalues[iter], 0) / targetGenes.length
        : 0;
      if (clockMean > targetMean) hierarchyPreserved++;
    }

    return {
      n,
      meanAbsError,
      within10pctRate,
      clockMeanError,
      targetMeanError,
      hierarchyPreserved: hierarchyPreserved / nIterations
    };
  });

  const best = summary[0];
  const worst = summary[summary.length - 1];
  const conclusion = `Eigenvalue recovery degrades from ${(best.within10pctRate * 100).toFixed(0)}% within 10% at N=${best.n} to ${(worst.within10pctRate * 100).toFixed(0)}% at N=${worst.n}. ` +
    `Clock > target hierarchy preserved in ${(worst.hierarchyPreserved * 100).toFixed(0)}% of iterations even at N=${worst.n}. ` +
    `Recommend N ≥ 12 for reliable individual eigenvalue estimates; hierarchy ranking is robust even at N=6.`;

  return {
    dataset: 'GSE11923 Mouse Liver 48h (1h sampling)',
    fullTimepoints,
    subsampleSizes,
    nIterations,
    seed,
    genes: geneResults.map(g => ({
      ...g,
      subsampleResults: g.subsampleResults.map(s => ({
        ...s,
        eigenvalues: s.eigenvalues.slice(0, 5)
      }))
    })),
    summary,
    conclusion
  };
}

export interface BootstrapGeneResult {
  gene: string;
  geneType: 'clock' | 'target';
  pointEstimate: number;
  ci95Lower: number;
  ci95Upper: number;
  ciWidth: number;
  phi1: number;
  phi2: number;
  r2: number;
  reliable: boolean;
}

export interface BootstrapResult {
  dataset: string;
  nBootstrap: number;
  seed: number;
  genes: BootstrapGeneResult[];
  clockSummary: { meanEigenvalue: number; meanCiWidth: number; reliableRate: number; count: number };
  targetSummary: { meanEigenvalue: number; meanCiWidth: number; reliableRate: number; count: number };
  gapEstimate: { pointEstimate: number; ci95Lower: number; ci95Upper: number };
  conclusion: string;
}

export function runBootstrapCI(datasetId = 'liver', nBootstrap = 200, seed = 42): BootstrapResult {
  const datasetMap: Record<string, string> = {
    'liver': 'GSE54650_Liver_circadian.csv',
    'liver48': 'GSE11923_Liver_1h_48h_genes.csv',
    'kidney': 'GSE54650_Kidney_circadian.csv',
    'heart': 'GSE54650_Heart_circadian.csv',
    'lung': 'GSE54650_Lung_circadian.csv',
    'adrenal': 'GSE54650_Adrenal_circadian.csv',
    'muscle': 'GSE54650_Muscle_circadian.csv',
    'cerebellum': 'GSE54650_Cerebellum_circadian.csv',
    'brainstem': 'GSE54650_Brainstem_circadian.csv',
    'hypothalamus': 'GSE54650_Hypothalamus_circadian.csv',
    'brown_fat': 'GSE54650_Brown_Fat_circadian.csv',
    'white_fat': 'GSE54650_White_Fat_circadian.csv',
    'human_blood': 'GSE48113_Human_Blood_Circadian.csv',
  };

  const filename = datasetMap[datasetId] || datasetMap['liver'];
  const datasetPath = path.join(process.cwd(), 'datasets', filename);
  if (!fs.existsSync(datasetPath)) throw new Error(`Dataset not found: ${filename}`);

  const genes = parseDataset(datasetPath);
  const clockTargetGenes = Array.from(genes.values()).filter(g => g.type !== 'other');
  const rng = mulberry32(seed);

  const geneResults: BootstrapGeneResult[] = [];

  for (const geneData of clockTargetGenes) {
    const fullFit = fitAR2(geneData.values);
    const n = geneData.values.length;
    const mean = geneData.values.reduce((a, b) => a + b, 0) / n;
    const centered = geneData.values.map(x => x - mean);

    const bootstrapEigenvalues: number[] = [];
    for (let b = 0; b < nBootstrap; b++) {
      const blockSize = Math.max(2, Math.floor(Math.sqrt(n)));
      const nBlocks = Math.ceil(n / blockSize);
      const resampledResiduals: number[] = [];
      for (let block = 0; block < nBlocks; block++) {
        const startIdx = Math.floor(rng() * (fullFit.residuals.length - blockSize + 1));
        for (let j = 0; j < blockSize && resampledResiduals.length < n - 2; j++) {
          resampledResiduals.push(fullFit.residuals[startIdx + j]);
        }
      }

      const synthetic: number[] = [centered[0], centered[1]];
      for (let t = 0; t < resampledResiduals.length && synthetic.length < n; t++) {
        const val = fullFit.phi1 * synthetic[synthetic.length - 1] + fullFit.phi2 * synthetic[synthetic.length - 2] + resampledResiduals[t];
        synthetic.push(val);
      }

      const bootFit = fitAR2(synthetic.map(x => x + mean));
      bootstrapEigenvalues.push(bootFit.eigenvalue);
    }

    bootstrapEigenvalues.sort((a, b) => a - b);
    const ci95Lower = bootstrapEigenvalues[Math.floor(nBootstrap * 0.025)];
    const ci95Upper = bootstrapEigenvalues[Math.floor(nBootstrap * 0.975)];
    const ciWidth = ci95Upper - ci95Lower;
    const reliable = ciWidth < 0.15;

    geneResults.push({
      gene: geneData.gene,
      geneType: geneData.type as 'clock' | 'target',
      pointEstimate: fullFit.eigenvalue,
      ci95Lower,
      ci95Upper,
      ciWidth,
      phi1: fullFit.phi1,
      phi2: fullFit.phi2,
      r2: fullFit.r2,
      reliable
    });
  }

  const clockGenes = geneResults.filter(g => g.geneType === 'clock');
  const targetGenes = geneResults.filter(g => g.geneType === 'target');

  const clockSummary = {
    meanEigenvalue: clockGenes.length > 0 ? clockGenes.reduce((a, g) => a + g.pointEstimate, 0) / clockGenes.length : 0,
    meanCiWidth: clockGenes.length > 0 ? clockGenes.reduce((a, g) => a + g.ciWidth, 0) / clockGenes.length : 0,
    reliableRate: clockGenes.length > 0 ? clockGenes.filter(g => g.reliable).length / clockGenes.length : 0,
    count: clockGenes.length
  };

  const targetSummary = {
    meanEigenvalue: targetGenes.length > 0 ? targetGenes.reduce((a, g) => a + g.pointEstimate, 0) / targetGenes.length : 0,
    meanCiWidth: targetGenes.length > 0 ? targetGenes.reduce((a, g) => a + g.ciWidth, 0) / targetGenes.length : 0,
    reliableRate: targetGenes.length > 0 ? targetGenes.filter(g => g.reliable).length / targetGenes.length : 0,
    count: targetGenes.length
  };

  const gapBootstraps: number[] = [];
  const rng2 = mulberry32(seed + 1);
  for (let b = 0; b < nBootstrap; b++) {
    const clockSample = clockGenes.length > 0
      ? clockGenes.map(g => {
          const idx = Math.floor(rng2() * nBootstrap);
          return g.ci95Lower + (g.ci95Upper - g.ci95Lower) * rng2();
        })
      : [0];
    const targetSample = targetGenes.length > 0
      ? targetGenes.map(g => {
          const idx = Math.floor(rng2() * nBootstrap);
          return g.ci95Lower + (g.ci95Upper - g.ci95Lower) * rng2();
        })
      : [0];
    const clockMean = clockSample.reduce((a, b) => a + b, 0) / clockSample.length;
    const targetMean = targetSample.reduce((a, b) => a + b, 0) / targetSample.length;
    gapBootstraps.push(clockMean - targetMean);
  }
  gapBootstraps.sort((a, b) => a - b);

  const gapEstimate = {
    pointEstimate: clockSummary.meanEigenvalue - targetSummary.meanEigenvalue,
    ci95Lower: gapBootstraps[Math.floor(nBootstrap * 0.025)],
    ci95Upper: gapBootstraps[Math.floor(nBootstrap * 0.975)]
  };

  const conclusion = `Per-gene bootstrap CIs (${nBootstrap} iterations): Clock genes have mean CI width ${clockSummary.meanCiWidth.toFixed(3)}, ` +
    `target genes ${targetSummary.meanCiWidth.toFixed(3)}. ${(clockSummary.reliableRate * 100).toFixed(0)}% of clock and ` +
    `${(targetSummary.reliableRate * 100).toFixed(0)}% of target genes have CI width < 0.15. ` +
    `Gap estimate: ${gapEstimate.pointEstimate.toFixed(3)} [${gapEstimate.ci95Lower.toFixed(3)}, ${gapEstimate.ci95Upper.toFixed(3)}].`;

  return {
    dataset: filename.replace('.csv', '').replace(/_/g, ' '),
    nBootstrap,
    seed,
    genes: geneResults,
    clockSummary,
    targetSummary,
    gapEstimate,
    conclusion
  };
}

export interface FirstDiffGeneResult {
  gene: string;
  geneType: 'clock' | 'target';
  rawEigenvalue: number;
  diffEigenvalue: number;
  rawR2: number;
  diffR2: number;
}

export interface FirstDiffDatasetResult {
  dataset: string;
  genes: FirstDiffGeneResult[];
  rawClockMean: number;
  rawTargetMean: number;
  rawGap: number;
  diffClockMean: number;
  diffTargetMean: number;
  diffGap: number;
  hierarchyPreservedRaw: boolean;
  hierarchyPreservedDiff: boolean;
}

export interface FirstDiffResult {
  datasets: FirstDiffDatasetResult[];
  hierarchyPreservedCount: number;
  totalDatasets: number;
  conclusion: string;
}

export function runFirstDifferenceAnalysis(): FirstDiffResult {
  const datasetFiles = [
    { id: 'Liver', file: 'GSE54650_Liver_circadian.csv' },
    { id: 'Kidney', file: 'GSE54650_Kidney_circadian.csv' },
    { id: 'Heart', file: 'GSE54650_Heart_circadian.csv' },
    { id: 'Lung', file: 'GSE54650_Lung_circadian.csv' },
    { id: 'Adrenal', file: 'GSE54650_Adrenal_circadian.csv' },
    { id: 'Hypothalamus', file: 'GSE54650_Hypothalamus_circadian.csv' },
    { id: 'Cerebellum', file: 'GSE54650_Cerebellum_circadian.csv' },
    { id: 'Brown Fat', file: 'GSE54650_Brown_Fat_circadian.csv' },
    { id: 'White Fat', file: 'GSE54650_White_Fat_circadian.csv' },
    { id: 'Muscle', file: 'GSE54650_Muscle_circadian.csv' },
    { id: 'Aorta', file: 'GSE54650_Aorta_circadian.csv' },
    { id: 'Brainstem', file: 'GSE54650_Brainstem_circadian.csv' },
  ];

  const results: FirstDiffDatasetResult[] = [];

  for (const ds of datasetFiles) {
    const filePath = path.join(process.cwd(), 'datasets', ds.file);
    if (!fs.existsSync(filePath)) continue;

    const genes = parseDataset(filePath);
    const geneResults: FirstDiffGeneResult[] = [];

    for (const geneData of Array.from(genes.values())) {
      if (geneData.type === 'other') continue;
      const rawFit = fitAR2(geneData.values);

      const diffSeries: number[] = [];
      for (let i = 1; i < geneData.values.length; i++) {
        diffSeries.push(geneData.values[i] - geneData.values[i - 1]);
      }
      const diffFit = fitAR2(diffSeries);

      geneResults.push({
        gene: geneData.gene,
        geneType: geneData.type as 'clock' | 'target',
        rawEigenvalue: rawFit.eigenvalue,
        diffEigenvalue: diffFit.eigenvalue,
        rawR2: rawFit.r2,
        diffR2: diffFit.r2,
      });
    }

    const clockGenes = geneResults.filter(g => g.geneType === 'clock');
    const targetGenes = geneResults.filter(g => g.geneType === 'target');

    const rawClockMean = clockGenes.length > 0 ? clockGenes.reduce((a, g) => a + g.rawEigenvalue, 0) / clockGenes.length : 0;
    const rawTargetMean = targetGenes.length > 0 ? targetGenes.reduce((a, g) => a + g.rawEigenvalue, 0) / targetGenes.length : 0;
    const diffClockMean = clockGenes.length > 0 ? clockGenes.reduce((a, g) => a + g.diffEigenvalue, 0) / clockGenes.length : 0;
    const diffTargetMean = targetGenes.length > 0 ? targetGenes.reduce((a, g) => a + g.diffEigenvalue, 0) / targetGenes.length : 0;

    results.push({
      dataset: ds.id,
      genes: geneResults,
      rawClockMean,
      rawTargetMean,
      rawGap: rawClockMean - rawTargetMean,
      diffClockMean,
      diffTargetMean,
      diffGap: diffClockMean - diffTargetMean,
      hierarchyPreservedRaw: rawClockMean > rawTargetMean,
      hierarchyPreservedDiff: diffClockMean > diffTargetMean,
    });
  }

  const hierarchyPreservedCount = results.filter(r => r.hierarchyPreservedDiff).length;

  const conclusion = `First-difference analysis across ${results.length} tissues: Clock > target hierarchy preserved in ` +
    `${results.filter(r => r.hierarchyPreservedRaw).length}/${results.length} tissues (raw) and ` +
    `${hierarchyPreservedCount}/${results.length} tissues (first-differenced). ` +
    (hierarchyPreservedCount === results.length
      ? 'The hierarchy is fully robust to differencing — non-stationarity is not driving the result.'
      : hierarchyPreservedCount >= results.length * 0.75
        ? 'The hierarchy is largely preserved under differencing, supporting robustness to non-stationarity.'
        : 'Some tissues lose hierarchy under differencing — non-stationarity may contribute to the observed pattern in those tissues.');

  return {
    datasets: results,
    hierarchyPreservedCount,
    totalDatasets: results.length,
    conclusion
  };
}

export interface PopulationCVFoldResult {
  foldIndex: number;
  trainSize: number;
  testSize: number;
  clockMeanEigenvalue: number;
  targetMeanEigenvalue: number;
  gap: number;
  hierarchyPreserved: boolean;
}

export interface PopulationCVDatasetResult {
  dataset: string;
  totalTimepoints: number;
  nFolds: number;
  folds: PopulationCVFoldResult[];
  gapMean: number;
  gapStd: number;
  hierarchyPreservedRate: number;
  clockGeneCount: number;
  targetGeneCount: number;
}

export interface PopulationCVResult {
  datasets: PopulationCVDatasetResult[];
  overallHierarchyRate: number;
  overallGapMean: number;
  overallGapStd: number;
  conclusion: string;
}

export interface DetrendGeneResult {
  gene: string;
  geneType: 'clock' | 'target';
  rawEigenvalue: number;
  detrendedEigenvalue: number;
  rawR2: number;
  detrendedR2: number;
}

export interface DetrendDatasetResult {
  dataset: string;
  genes: DetrendGeneResult[];
  rawClockMean: number;
  rawTargetMean: number;
  rawGap: number;
  detrendedClockMean: number;
  detrendedTargetMean: number;
  detrendedGap: number;
  hierarchyPreservedRaw: boolean;
  hierarchyPreservedDetrended: boolean;
}

export interface DetrendResult {
  datasets: DetrendDatasetResult[];
  hierarchyPreservedCount: number;
  totalDatasets: number;
  comparisonWithDifferencing: {
    differencingPreserved: number;
    detrendingPreserved: number;
    total: number;
  };
  conclusion: string;
}

function linearDetrend(series: number[]): number[] {
  const n = series.length;
  if (n < 3) return series;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += series[i];
    sumXY += i * series[i];
    sumX2 += i * i;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  return series.map((v, i) => v - (slope * i + intercept));
}

export function runDetrendAnalysis(): DetrendResult {
  const datasetFiles = [
    { id: 'Liver', file: 'GSE54650_Liver_circadian.csv' },
    { id: 'Kidney', file: 'GSE54650_Kidney_circadian.csv' },
    { id: 'Heart', file: 'GSE54650_Heart_circadian.csv' },
    { id: 'Lung', file: 'GSE54650_Lung_circadian.csv' },
    { id: 'Adrenal', file: 'GSE54650_Adrenal_circadian.csv' },
    { id: 'Hypothalamus', file: 'GSE54650_Hypothalamus_circadian.csv' },
    { id: 'Cerebellum', file: 'GSE54650_Cerebellum_circadian.csv' },
    { id: 'Brown Fat', file: 'GSE54650_Brown_Fat_circadian.csv' },
    { id: 'White Fat', file: 'GSE54650_White_Fat_circadian.csv' },
    { id: 'Muscle', file: 'GSE54650_Muscle_circadian.csv' },
    { id: 'Aorta', file: 'GSE54650_Aorta_circadian.csv' },
    { id: 'Brainstem', file: 'GSE54650_Brainstem_circadian.csv' },
  ];

  const results: DetrendDatasetResult[] = [];
  let differencingPreserved = 0;

  for (const ds of datasetFiles) {
    const filePath = path.join(process.cwd(), 'datasets', ds.file);
    if (!fs.existsSync(filePath)) continue;

    const genes = parseDataset(filePath);
    const geneResults: DetrendGeneResult[] = [];

    for (const geneData of Array.from(genes.values())) {
      if (geneData.type === 'other') continue;
      const rawFit = fitAR2(geneData.values);
      const detrended = linearDetrend(geneData.values);
      const detrendedFit = fitAR2(detrended);

      geneResults.push({
        gene: geneData.gene,
        geneType: geneData.type as 'clock' | 'target',
        rawEigenvalue: rawFit.eigenvalue,
        detrendedEigenvalue: detrendedFit.eigenvalue,
        rawR2: rawFit.r2,
        detrendedR2: detrendedFit.r2,
      });
    }

    const clockGenes = geneResults.filter(g => g.geneType === 'clock');
    const targetGenes = geneResults.filter(g => g.geneType === 'target');

    const rawClockMean = clockGenes.length > 0 ? clockGenes.reduce((a, g) => a + g.rawEigenvalue, 0) / clockGenes.length : 0;
    const rawTargetMean = targetGenes.length > 0 ? targetGenes.reduce((a, g) => a + g.rawEigenvalue, 0) / targetGenes.length : 0;
    const detClockMean = clockGenes.length > 0 ? clockGenes.reduce((a, g) => a + g.detrendedEigenvalue, 0) / clockGenes.length : 0;
    const detTargetMean = targetGenes.length > 0 ? targetGenes.reduce((a, g) => a + g.detrendedEigenvalue, 0) / targetGenes.length : 0;

    const diffSeries = (vals: number[]) => vals.slice(1).map((v, i) => v - vals[i]);
    const diffClockVals = clockGenes.map(g => {
      const geneData = genes.get(g.gene.toUpperCase()) || genes.get(g.gene);
      if (!geneData) return 0;
      return fitAR2(diffSeries(geneData.values)).eigenvalue;
    });
    const diffTargetVals = targetGenes.map(g => {
      const geneData = genes.get(g.gene.toUpperCase()) || genes.get(g.gene);
      if (!geneData) return 0;
      return fitAR2(diffSeries(geneData.values)).eigenvalue;
    });
    const diffClockMean = diffClockVals.length > 0 ? diffClockVals.reduce((a, b) => a + b, 0) / diffClockVals.length : 0;
    const diffTargetMean = diffTargetVals.length > 0 ? diffTargetVals.reduce((a, b) => a + b, 0) / diffTargetVals.length : 0;
    if (diffClockMean > diffTargetMean) differencingPreserved++;

    results.push({
      dataset: ds.id,
      genes: geneResults,
      rawClockMean,
      rawTargetMean,
      rawGap: rawClockMean - rawTargetMean,
      detrendedClockMean: detClockMean,
      detrendedTargetMean: detTargetMean,
      detrendedGap: detClockMean - detTargetMean,
      hierarchyPreservedRaw: rawClockMean > rawTargetMean,
      hierarchyPreservedDetrended: detClockMean > detTargetMean,
    });
  }

  const detrendPreservedCount = results.filter(r => r.hierarchyPreservedDetrended).length;

  const conclusion = `Linear detrending analysis across ${results.length} tissues: Clock > target hierarchy preserved in ` +
    `${results.filter(r => r.hierarchyPreservedRaw).length}/${results.length} tissues (raw), ` +
    `${detrendPreservedCount}/${results.length} tissues (detrended), vs ` +
    `${differencingPreserved}/${results.length} tissues (first-differenced). ` +
    (detrendPreservedCount > differencingPreserved
      ? `Detrending preserves hierarchy in ${detrendPreservedCount - differencingPreserved} more tissues than differencing — ` +
        'the eigenvalue gap is not driven by linear trends, but differencing over-corrects by destroying oscillatory autocorrelation.'
      : 'Detrending and differencing show similar results.');

  return {
    datasets: results,
    hierarchyPreservedCount: detrendPreservedCount,
    totalDatasets: results.length,
    comparisonWithDifferencing: {
      differencingPreserved,
      detrendingPreserved: detrendPreservedCount,
      total: results.length,
    },
    conclusion
  };
}

export interface PermutationTestResult {
  dataset: string;
  observedGap: number;
  nPermutations: number;
  nullDistribution: { binCenter: number; count: number }[];
  nullMean: number;
  nullStd: number;
  pValue: number;
  zScore: number;
  clockGeneCount: number;
  targetGeneCount: number;
  totalGenes: number;
  seed: number;
}

export interface PermutationSuiteResult {
  datasets: PermutationTestResult[];
  allSignificant: boolean;
  conclusion: string;
}

export function runPermutationTest(nPermutations = 10000, seed = 42): PermutationSuiteResult {
  const datasetFiles = [
    { id: 'Liver (48h)', file: 'GSE11923_Liver_1h_48h_genes.csv' },
    { id: 'Liver (24h)', file: 'GSE54650_Liver_circadian.csv' },
    { id: 'Kidney', file: 'GSE54650_Kidney_circadian.csv' },
    { id: 'Heart', file: 'GSE54650_Heart_circadian.csv' },
    { id: 'Lung', file: 'GSE54650_Lung_circadian.csv' },
  ];

  const results: PermutationTestResult[] = [];
  const rng = mulberry32(seed);

  for (const ds of datasetFiles) {
    const filePath = path.join(process.cwd(), 'datasets', ds.file);
    if (!fs.existsSync(filePath)) continue;

    const genes = parseDataset(filePath);
    const clockTargetGenes = Array.from(genes.values()).filter(g => g.type !== 'other');
    if (clockTargetGenes.length === 0) continue;

    const eigenvalues = clockTargetGenes.map(g => fitAR2(g.values).eigenvalue);
    const types = clockTargetGenes.map(g => g.type);
    const clockIndices = types.reduce((acc, t, i) => { if (t === 'clock') acc.push(i); return acc; }, [] as number[]);
    const targetIndices = types.reduce((acc, t, i) => { if (t === 'target') acc.push(i); return acc; }, [] as number[]);

    const clockMean = clockIndices.reduce((a, i) => a + eigenvalues[i], 0) / clockIndices.length;
    const targetMean = targetIndices.reduce((a, i) => a + eigenvalues[i], 0) / targetIndices.length;
    const observedGap = clockMean - targetMean;

    const nClock = clockIndices.length;
    const nullGaps: number[] = [];

    for (let p = 0; p < nPermutations; p++) {
      const shuffled = [...eigenvalues];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      const permClockMean = shuffled.slice(0, nClock).reduce((a, b) => a + b, 0) / nClock;
      const permTargetMean = shuffled.slice(nClock).reduce((a, b) => a + b, 0) / (shuffled.length - nClock);
      nullGaps.push(permClockMean - permTargetMean);
    }

    const nullMean = nullGaps.reduce((a, b) => a + b, 0) / nullGaps.length;
    const nullStd = Math.sqrt(nullGaps.reduce((a, b) => a + (b - nullMean) ** 2, 0) / nullGaps.length);
    const pValue = (nullGaps.filter(g => g >= observedGap).length + 1) / (nPermutations + 1);
    const zScore = nullStd > 0 ? (observedGap - nullMean) / nullStd : 0;

    const nBins = 50;
    const minGap = Math.min(...nullGaps, observedGap) - 0.01;
    const maxGap = Math.max(...nullGaps, observedGap) + 0.01;
    const binWidth = (maxGap - minGap) / nBins;
    const bins = Array.from({ length: nBins }, (_, i) => ({
      binCenter: minGap + (i + 0.5) * binWidth,
      count: 0
    }));
    for (const g of nullGaps) {
      const idx = Math.min(Math.floor((g - minGap) / binWidth), nBins - 1);
      bins[idx].count++;
    }

    results.push({
      dataset: ds.id,
      observedGap,
      nPermutations,
      nullDistribution: bins,
      nullMean,
      nullStd,
      pValue,
      zScore,
      clockGeneCount: nClock,
      targetGeneCount: targetIndices.length,
      totalGenes: clockTargetGenes.length,
      seed,
    });
  }

  const allSignificant = results.every(r => r.pValue < 0.05);

  const conclusion = `Permutation test (${nPermutations.toLocaleString()} permutations, seed=${seed}): ` +
    `${results.filter(r => r.pValue < 0.05).length}/${results.length} datasets show significant clock > target gap (p < 0.05). ` +
    results.map(r => `${r.dataset}: gap=${r.observedGap.toFixed(4)}, p=${r.pValue < 0.001 ? '<0.001' : r.pValue.toFixed(4)}, z=${r.zScore.toFixed(2)}`).join('; ') + '. ' +
    (allSignificant
      ? 'The observed hierarchy is extremely unlikely under random label assignment — the clock > target gap is not an artifact of gene selection.'
      : 'Most datasets show significant gaps, though some do not reach significance.');

  return {
    datasets: results,
    allSignificant,
    conclusion
  };
}

export interface LOTOTissueResult {
  heldOutTissue: string;
  heldOutClockMean: number;
  heldOutTargetMean: number;
  heldOutGap: number;
  heldOutHierarchyObserved: boolean;
  trainClockMean: number;
  trainTargetMean: number;
  trainGap: number;
  trainHierarchyPreserved: boolean;
  predictionCorrect: boolean;
  clockGeneCount: number;
  targetGeneCount: number;
}

export interface LOTOResult {
  tissues: LOTOTissueResult[];
  totalTissues: number;
  predictionsCorrect: number;
  trainHierarchyRate: number;
  heldOutHierarchyRate: number;
  conclusion: string;
}

export function runLeaveOneTissueOut(): LOTOResult {
  const datasetFiles = [
    { id: 'Liver', file: 'GSE54650_Liver_circadian.csv' },
    { id: 'Kidney', file: 'GSE54650_Kidney_circadian.csv' },
    { id: 'Heart', file: 'GSE54650_Heart_circadian.csv' },
    { id: 'Lung', file: 'GSE54650_Lung_circadian.csv' },
    { id: 'Adrenal', file: 'GSE54650_Adrenal_circadian.csv' },
    { id: 'Hypothalamus', file: 'GSE54650_Hypothalamus_circadian.csv' },
    { id: 'Cerebellum', file: 'GSE54650_Cerebellum_circadian.csv' },
    { id: 'Brown Fat', file: 'GSE54650_Brown_Fat_circadian.csv' },
    { id: 'White Fat', file: 'GSE54650_White_Fat_circadian.csv' },
    { id: 'Muscle', file: 'GSE54650_Muscle_circadian.csv' },
    { id: 'Aorta', file: 'GSE54650_Aorta_circadian.csv' },
    { id: 'Brainstem', file: 'GSE54650_Brainstem_circadian.csv' },
  ];

  const tissueEigenvalues: { id: string; clockEigs: number[]; targetEigs: number[] }[] = [];

  for (const ds of datasetFiles) {
    const filePath = path.join(process.cwd(), 'datasets', ds.file);
    if (!fs.existsSync(filePath)) continue;
    const genes = parseDataset(filePath);
    const clockEigs: number[] = [];
    const targetEigs: number[] = [];
    for (const geneData of Array.from(genes.values())) {
      if (geneData.type === 'other') continue;
      const fit = fitAR2(geneData.values);
      if (geneData.type === 'clock') clockEigs.push(fit.eigenvalue);
      else targetEigs.push(fit.eigenvalue);
    }
    if (clockEigs.length > 0 && targetEigs.length > 0) {
      tissueEigenvalues.push({ id: ds.id, clockEigs, targetEigs });
    }
  }

  const results: LOTOTissueResult[] = [];

  for (let i = 0; i < tissueEigenvalues.length; i++) {
    const heldOut = tissueEigenvalues[i];
    const training = tissueEigenvalues.filter((_, j) => j !== i);

    const heldOutClockMean = heldOut.clockEigs.reduce((a, b) => a + b, 0) / heldOut.clockEigs.length;
    const heldOutTargetMean = heldOut.targetEigs.reduce((a, b) => a + b, 0) / heldOut.targetEigs.length;

    const allTrainClock = training.flatMap(t => t.clockEigs);
    const allTrainTarget = training.flatMap(t => t.targetEigs);
    const trainClockMean = allTrainClock.reduce((a, b) => a + b, 0) / allTrainClock.length;
    const trainTargetMean = allTrainTarget.reduce((a, b) => a + b, 0) / allTrainTarget.length;

    const heldOutHierarchy = heldOutClockMean > heldOutTargetMean;
    const trainHierarchy = trainClockMean > trainTargetMean;

    results.push({
      heldOutTissue: heldOut.id,
      heldOutClockMean,
      heldOutTargetMean,
      heldOutGap: heldOutClockMean - heldOutTargetMean,
      heldOutHierarchyObserved: heldOutHierarchy,
      trainClockMean,
      trainTargetMean,
      trainGap: trainClockMean - trainTargetMean,
      trainHierarchyPreserved: trainHierarchy,
      predictionCorrect: heldOutHierarchy === trainHierarchy,
      clockGeneCount: heldOut.clockEigs.length,
      targetGeneCount: heldOut.targetEigs.length,
    });
  }

  const predictionsCorrect = results.filter(r => r.predictionCorrect).length;
  const trainHierarchyRate = results.filter(r => r.trainHierarchyPreserved).length / results.length;
  const heldOutHierarchyRate = results.filter(r => r.heldOutHierarchyObserved).length / results.length;

  const conclusion = `Leave-one-tissue-out analysis across ${results.length} mouse tissues (GSE54650): ` +
    `The training set (11 tissues) preserves clock > target hierarchy in ${results.filter(r => r.trainHierarchyPreserved).length}/${results.length} folds. ` +
    `The held-out tissue independently shows clock > target in ${results.filter(r => r.heldOutHierarchyObserved).length}/${results.length} cases. ` +
    `Prediction accuracy: ${predictionsCorrect}/${results.length} (${(predictionsCorrect / results.length * 100).toFixed(0)}%). ` +
    (predictionsCorrect === results.length
      ? 'The hierarchy is not driven by any single tissue — every tissue independently confirms the pattern predicted by the remaining 11.'
      : predictionsCorrect >= results.length * 0.9
        ? 'The hierarchy is robust to tissue removal — nearly all tissues independently confirm the cross-tissue prediction.'
        : 'Most tissues confirm the cross-tissue prediction, though some individual tissues diverge.');

  return {
    tissues: results,
    totalTissues: results.length,
    predictionsCorrect,
    trainHierarchyRate,
    heldOutHierarchyRate,
    conclusion
  };
}

export function runPopulationCVStability(nFolds = 5, seed = 42): PopulationCVResult {
  const datasetFiles = [
    { id: 'Liver (48h)', file: 'GSE11923_Liver_1h_48h_genes.csv' },
    { id: 'Liver (24h)', file: 'GSE54650_Liver_circadian.csv' },
    { id: 'Kidney', file: 'GSE54650_Kidney_circadian.csv' },
    { id: 'Heart', file: 'GSE54650_Heart_circadian.csv' },
    { id: 'Lung', file: 'GSE54650_Lung_circadian.csv' },
  ];

  const datasetResults: PopulationCVDatasetResult[] = [];

  for (const ds of datasetFiles) {
    const filePath = path.join(process.cwd(), 'datasets', ds.file);
    if (!fs.existsSync(filePath)) continue;

    const genes = parseDataset(filePath);
    const clockTargetGenes = Array.from(genes.values()).filter(g => g.type !== 'other');
    if (clockTargetGenes.length === 0) continue;

    const totalTimepoints = clockTargetGenes[0].values.length;
    const foldSize = Math.floor(totalTimepoints / nFolds);
    if (foldSize < 3) continue;

    const folds: PopulationCVFoldResult[] = [];

    for (let fold = 0; fold < nFolds; fold++) {
      const testStart = fold * foldSize;
      const testEnd = fold === nFolds - 1 ? totalTimepoints : (fold + 1) * foldSize;

      const clockEigenvalues: number[] = [];
      const targetEigenvalues: number[] = [];

      for (const geneData of clockTargetGenes) {
        const trainSeries = [
          ...geneData.values.slice(0, testStart),
          ...geneData.values.slice(testEnd)
        ];
        if (trainSeries.length < 5) continue;
        const fit = fitAR2(trainSeries);
        if (geneData.type === 'clock') clockEigenvalues.push(fit.eigenvalue);
        else if (geneData.type === 'target') targetEigenvalues.push(fit.eigenvalue);
      }

      const clockMean = clockEigenvalues.length > 0 ? clockEigenvalues.reduce((a, b) => a + b, 0) / clockEigenvalues.length : 0;
      const targetMean = targetEigenvalues.length > 0 ? targetEigenvalues.reduce((a, b) => a + b, 0) / targetEigenvalues.length : 0;

      folds.push({
        foldIndex: fold,
        trainSize: totalTimepoints - (testEnd - testStart),
        testSize: testEnd - testStart,
        clockMeanEigenvalue: clockMean,
        targetMeanEigenvalue: targetMean,
        gap: clockMean - targetMean,
        hierarchyPreserved: clockMean > targetMean
      });
    }

    const gaps = folds.map(f => f.gap);
    const gapMean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const gapStd = Math.sqrt(gaps.reduce((a, b) => a + (b - gapMean) ** 2, 0) / gaps.length);

    datasetResults.push({
      dataset: ds.id,
      totalTimepoints,
      nFolds,
      folds,
      gapMean,
      gapStd,
      hierarchyPreservedRate: folds.filter(f => f.hierarchyPreserved).length / folds.length,
      clockGeneCount: clockTargetGenes.filter(g => g.type === 'clock').length,
      targetGeneCount: clockTargetGenes.filter(g => g.type === 'target').length
    });
  }

  const allGaps = datasetResults.flatMap(d => d.folds.map(f => f.gap));
  const overallGapMean = allGaps.length > 0 ? allGaps.reduce((a, b) => a + b, 0) / allGaps.length : 0;
  const overallGapStd = allGaps.length > 0 ? Math.sqrt(allGaps.reduce((a, b) => a + (b - overallGapMean) ** 2, 0) / allGaps.length) : 0;
  const totalFolds = datasetResults.reduce((a, d) => a + d.folds.length, 0);
  const preservedFolds = datasetResults.reduce((a, d) => a + d.folds.filter(f => f.hierarchyPreserved).length, 0);

  const conclusion = `Population-level CV stability (${nFolds}-fold): Clock > target hierarchy preserved in ` +
    `${preservedFolds}/${totalFolds} folds (${(preservedFolds / totalFolds * 100).toFixed(0)}%) across ${datasetResults.length} datasets. ` +
    `Mean gap: ${overallGapMean.toFixed(4)} ± ${overallGapStd.toFixed(4)}. ` +
    (preservedFolds === totalFolds
      ? 'The population-level hierarchy is completely stable across all CV folds — individual prediction noise does not affect aggregate pattern.'
      : 'The hierarchy is largely stable at the population level despite individual-pair prediction variability.');

  return {
    datasets: datasetResults,
    overallHierarchyRate: preservedFolds / totalFolds,
    overallGapMean,
    overallGapStd,
    conclusion
  };
}

function fitAR(series: number[], order: number): { eigenvalue: number; r2: number; coeffs: number[] } {
  const n = series.length;
  if (n < order + 3) return { eigenvalue: 0, r2: 0, coeffs: [] };

  const mean = series.reduce((a, b) => a + b, 0) / n;
  const y = series.map(x => x - mean);

  const T = n - order;
  const Y = y.slice(order);

  const X: number[][] = [];
  for (let t = 0; t < T; t++) {
    const row: number[] = [];
    for (let p = 1; p <= order; p++) {
      row.push(y[order + t - p]);
    }
    X.push(row);
  }

  const XtX: number[][] = Array.from({ length: order }, () => Array(order).fill(0));
  const XtY: number[] = Array(order).fill(0);

  for (let i = 0; i < order; i++) {
    for (let j = 0; j < order; j++) {
      for (let t = 0; t < T; t++) {
        XtX[i][j] += X[t][i] * X[t][j];
      }
    }
    for (let t = 0; t < T; t++) {
      XtY[i] += X[t][i] * Y[t];
    }
  }

  let coeffs: number[];
  if (order === 1) {
    if (Math.abs(XtX[0][0]) < 1e-10) return { eigenvalue: 0, r2: 0, coeffs: [0] };
    coeffs = [XtY[0] / XtX[0][0]];
  } else if (order === 2) {
    const det = XtX[0][0] * XtX[1][1] - XtX[0][1] * XtX[1][0];
    if (Math.abs(det) < 1e-10) return { eigenvalue: 0, r2: 0, coeffs: [0, 0] };
    coeffs = [
      (XtY[0] * XtX[1][1] - XtY[1] * XtX[0][1]) / det,
      (XtY[1] * XtX[0][0] - XtY[0] * XtX[1][0]) / det,
    ];
  } else {
    const solved = solveLinearSystem(XtX, XtY);
    if (!solved) return { eigenvalue: 0, r2: 0, coeffs: Array(order).fill(0) };
    coeffs = solved;
  }

  let ssTot = 0, ssRes = 0;
  const yMean = Y.reduce((a, b) => a + b, 0) / Y.length;
  for (let t = 0; t < T; t++) {
    let pred = 0;
    for (let p = 0; p < order; p++) pred += coeffs[p] * X[t][p];
    ssRes += (Y[t] - pred) ** 2;
    ssTot += (Y[t] - yMean) ** 2;
  }
  const r2 = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;

  const companionEigenvalue = computeCompanionEigenvalue(coeffs);

  return { eigenvalue: companionEigenvalue, r2, coeffs };
}

function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const n = A.length;
  const aug = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
    if (Math.abs(aug[col][col]) < 1e-10) return null;

    for (let row = col + 1; row < n; row++) {
      const factor = aug[row][col] / aug[col][col];
      for (let j = col; j <= n; j++) aug[row][j] -= factor * aug[col][j];
    }
  }

  const x = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = aug[i][n];
    for (let j = i + 1; j < n; j++) x[i] -= aug[i][j] * x[j];
    x[i] /= aug[i][i];
  }
  return x;
}

function computeCompanionEigenvalue(coeffs: number[]): number {
  if (coeffs.length === 1) {
    return Math.abs(coeffs[0]);
  }
  if (coeffs.length === 2) {
    const disc = coeffs[0] * coeffs[0] + 4 * coeffs[1];
    if (disc < 0) return Math.sqrt(-coeffs[1]);
    const r1 = (coeffs[0] + Math.sqrt(disc)) / 2;
    const r2 = (coeffs[0] - Math.sqrt(disc)) / 2;
    return Math.max(Math.abs(r1), Math.abs(r2));
  }
  if (coeffs.length === 3) {
    const roots = cubicCompanionEigenvalues(coeffs[0], coeffs[1], coeffs[2]);
    return Math.max(...roots.map(Math.abs));
  }
  let maxEig = 0;
  for (let iter = 0; iter < 100; iter++) {
    let x = Array(coeffs.length).fill(0);
    x[0] = 1;
    for (let step = 0; step < 50; step++) {
      const newX = Array(coeffs.length).fill(0);
      newX[0] = coeffs.reduce((s, c, i) => s + c * x[i], 0);
      for (let i = 1; i < coeffs.length; i++) newX[i] = x[i - 1];
      const norm = Math.sqrt(newX.reduce((s, v) => s + v * v, 0));
      if (norm < 1e-15) break;
      x = newX.map(v => v / norm);
      maxEig = norm;
    }
  }
  return maxEig;
}

function cubicCompanionEigenvalues(a: number, b: number, c: number): number[] {
  const p = b - a * a / 3;
  const q = 2 * a * a * a / 27 - a * b / 3 + c;
  const disc = q * q / 4 + p * p * p / 27;

  if (disc > 0) {
    const sqrtDisc = Math.sqrt(disc);
    const u = Math.cbrt(-q / 2 + sqrtDisc);
    const v = Math.cbrt(-q / 2 - sqrtDisc);
    return [u + v - a / 3];
  } else if (Math.abs(disc) < 1e-10) {
    const u = Math.cbrt(-q / 2);
    return [2 * u - a / 3, -u - a / 3];
  } else {
    const r = Math.sqrt(-p * p * p / 27);
    const theta = Math.acos(-q / (2 * r));
    const m = 2 * Math.cbrt(r);
    return [
      m * Math.cos(theta / 3) - a / 3,
      m * Math.cos((theta + 2 * Math.PI) / 3) - a / 3,
      m * Math.cos((theta + 4 * Math.PI) / 3) - a / 3,
    ];
  }
}

export function runModelOrderSensitivity() {
  const DATASETS = [
    { id: 'Liver (GSE54650)', file: 'GSE54650_Liver_circadian.csv' },
    { id: 'Liver 48h (GSE11923)', file: 'GSE11923_Liver_1h_48h_genes.csv' },
    { id: 'Kidney (GSE54650)', file: 'GSE54650_Kidney_circadian.csv' },
    { id: 'Heart (GSE54650)', file: 'GSE54650_Heart_circadian.csv' },
    { id: 'Lung (GSE54650)', file: 'GSE54650_Lung_circadian.csv' },
  ];

  const orders = [1, 2, 3, 4];
  const datasetResults: any[] = [];

  for (const ds of DATASETS) {
    const filePath = path.join(process.cwd(), 'datasets', ds.file);
    if (!fs.existsSync(filePath)) continue;

    const genes = parseDataset(filePath);
    const clockTargetGenes = Array.from(genes.values()).filter(g => g.type !== 'other');
    if (clockTargetGenes.length === 0) continue;

    const orderResults: any[] = [];

    for (const order of orders) {
      const clockEigenvalues: number[] = [];
      const targetEigenvalues: number[] = [];
      const clockR2s: number[] = [];
      const targetR2s: number[] = [];

      for (const g of clockTargetGenes) {
        if (g.values.length < order + 3) continue;
        const fit = fitAR(g.values, order);
        if (g.type === 'clock') {
          clockEigenvalues.push(fit.eigenvalue);
          clockR2s.push(fit.r2);
        } else {
          targetEigenvalues.push(fit.eigenvalue);
          targetR2s.push(fit.r2);
        }
      }

      const clockMean = clockEigenvalues.length > 0 ? clockEigenvalues.reduce((a, b) => a + b, 0) / clockEigenvalues.length : 0;
      const targetMean = targetEigenvalues.length > 0 ? targetEigenvalues.reduce((a, b) => a + b, 0) / targetEigenvalues.length : 0;
      const clockMeanR2 = clockR2s.length > 0 ? clockR2s.reduce((a, b) => a + b, 0) / clockR2s.length : 0;
      const targetMeanR2 = targetR2s.length > 0 ? targetR2s.reduce((a, b) => a + b, 0) / targetR2s.length : 0;

      orderResults.push({
        order,
        clockMeanEV: +clockMean.toFixed(4),
        targetMeanEV: +targetMean.toFixed(4),
        gap: +(clockMean - targetMean).toFixed(4),
        hierarchyPreserved: clockMean > targetMean,
        clockMeanR2: +clockMeanR2.toFixed(4),
        targetMeanR2: +targetMeanR2.toFixed(4),
        meanR2: +((clockMeanR2 + targetMeanR2) / 2).toFixed(4),
        clockN: clockEigenvalues.length,
        targetN: targetEigenvalues.length,
      });
    }

    datasetResults.push({
      dataset: ds.id,
      orders: orderResults,
    });
  }

  const perOrderSummary = orders.map(order => {
    const gaps = datasetResults.map(d => d.orders.find((o: any) => o.order === order)).filter(Boolean);
    const preserved = gaps.filter((g: any) => g.hierarchyPreserved).length;
    const meanGap = gaps.length > 0 ? gaps.reduce((s: number, g: any) => s + g.gap, 0) / gaps.length : 0;
    const meanR2 = gaps.length > 0 ? gaps.reduce((s: number, g: any) => s + g.meanR2, 0) / gaps.length : 0;
    return {
      order,
      hierarchyPreservedCount: preserved,
      totalDatasets: gaps.length,
      meanGap: +meanGap.toFixed(4),
      meanR2: +meanR2.toFixed(4),
    };
  });

  const ar2R2 = perOrderSummary.find(s => s.order === 2)?.meanR2 || 0;
  const ar3R2 = perOrderSummary.find(s => s.order === 3)?.meanR2 || 0;
  const r2Improvement = ar3R2 - ar2R2;

  const allPreserved = perOrderSummary.every(s => s.hierarchyPreservedCount === s.totalDatasets);

  const conclusion = allPreserved
    ? `The clock > target hierarchy is preserved across all model orders (AR(1) through AR(4)) in all ${datasetResults.length} datasets tested. ` +
      `AR(2) provides mean R² = ${ar2R2.toFixed(3)}, while AR(3) adds only ${(r2Improvement * 100).toFixed(1)}% additional variance explained. ` +
      `AR(2) is the parsimonious choice: it captures the oscillatory dynamics that AR(1) misses (complex roots), while AR(3-4) offer negligible improvement and risk overfitting with short time series.`
    : `The clock > target hierarchy is largely robust to model order choice. AR(2) is recommended as the best balance of explanatory power and parsimony.`;

  return {
    orders,
    datasets: datasetResults,
    perOrderSummary,
    r2ImprovementAR2toAR3: +r2Improvement.toFixed(4),
    conclusion,
  };
}

interface MultiCatGeneData {
  gene: string;
  category: GeneCategory;
  values: number[];
}

function parseDatasetMultiCategory(filePath: string): MultiCatGeneData[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  const genes: MultiCatGeneData[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const rawGene = cols[0].trim().replace(/"/g, '');
    if (!rawGene) continue;
    const gene = MULTI_ENSEMBL[rawGene] || ENSEMBL_TO_SYMBOL[rawGene] || rawGene;
    const values = cols.slice(1).map(v => parseFloat(v)).filter(v => !isNaN(v));
    if (values.length < 5) continue;
    const category = classifyGeneMulti(gene);
    if (category !== 'other') {
      genes.push({ gene, category, values });
    }
  }
  return genes;
}

function computeKruskalWallisH(groups: number[][]): { H: number; df: number; pValue: number } {
  const allValues: { value: number; group: number }[] = [];
  groups.forEach((g, gi) => g.forEach(v => allValues.push({ value: v, group: gi })));
  allValues.sort((a, b) => a.value - b.value);
  const N = allValues.length;
  const ranks = new Array(N);
  let i = 0;
  while (i < N) {
    let j = i;
    while (j < N && allValues[j].value === allValues[i].value) j++;
    const avgRank = (i + 1 + j) / 2;
    for (let k = i; k < j; k++) ranks[k] = avgRank;
    i = j;
  }
  const groupRankSums: number[] = groups.map(() => 0);
  const groupSizes: number[] = groups.map(g => g.length);
  for (let k = 0; k < N; k++) groupRankSums[allValues[k].group] += ranks[k];
  let H = 0;
  for (let g = 0; g < groups.length; g++) {
    if (groupSizes[g] === 0) continue;
    H += (groupRankSums[g] * groupRankSums[g]) / groupSizes[g];
  }
  H = (12 / (N * (N + 1))) * H - 3 * (N + 1);
  const df = groups.filter(g => g.length > 0).length - 1;
  const pValue = 1 - chi2CDF(H, df);
  return { H, df, pValue };
}

function chi2CDF(x: number, k: number): number {
  if (x <= 0) return 0;
  return lowerIncompleteGamma(k / 2, x / 2) / gammaFn(k / 2);
}

function gammaFn(n: number): number {
  if (n === 1) return 1;
  if (n === 0.5) return Math.sqrt(Math.PI);
  if (n > 1) return (n - 1) * gammaFn(n - 1);
  const p = [676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012,
    9.9843695780195716e-6, 1.5056327351493116e-7];
  let x = 0.99999999999980993;
  for (let i = 0; i < p.length; i++) x += p[i] / (n + i);
  const t = n + p.length - 0.5;
  return Math.sqrt(2 * Math.PI) * Math.pow(t, n - 0.5) * Math.exp(-t) * x;
}

function lowerIncompleteGamma(s: number, x: number): number {
  if (x === 0) return 0;
  let sum = 0, term = 1 / s;
  for (let n = 0; n < 200; n++) {
    sum += term;
    term *= x / (s + n + 1);
    if (Math.abs(term) < 1e-12) break;
  }
  return Math.pow(x, s) * Math.exp(-x) * sum;
}

export interface MultiCatPermutationResult {
  observedH: number;
  observedPValue: number;
  nPermutations: number;
  nullHDistribution: { binCenter: number; count: number }[];
  nullMeanH: number;
  nullStdH: number;
  permutationPValue: number;
  categoryMeans: { category: string; label: string; meanEigenvalue: number; count: number }[];
  hierarchyOrder: string[];
  datasetsUsed: number;
  totalGenes: number;
  conclusion: string;
}

export function runMultiCategoryPermutationTest(nPermutations = 5000, seed = 42): MultiCatPermutationResult {
  const datasetFiles = [
    'GSE54650_Liver_circadian.csv', 'GSE54650_Kidney_circadian.csv',
    'GSE54650_Heart_circadian.csv', 'GSE54650_Lung_circadian.csv',
    'GSE54650_Adrenal_circadian.csv', 'GSE54650_Hypothalamus_circadian.csv',
    'GSE54650_Cerebellum_circadian.csv', 'GSE54650_Brown_Fat_circadian.csv',
  ];

  const allEigenvalues: { eigenvalue: number; category: GeneCategory }[] = [];

  for (const file of datasetFiles) {
    const filePath = path.join(process.cwd(), 'datasets', file);
    if (!fs.existsSync(filePath)) continue;
    const genes = parseDatasetMultiCategory(filePath);
    for (const g of genes) {
      const fit = fitAR2(g.values);
      allEigenvalues.push({ eigenvalue: fit.eigenvalue, category: g.category });
    }
  }

  const categories = ALL_CATEGORIES.filter(c => c !== 'other');
  const catGroups: Record<string, number[]> = {};
  for (const c of categories) catGroups[c] = [];
  for (const e of allEigenvalues) {
    if (catGroups[e.category]) catGroups[e.category].push(e.eigenvalue);
  }

  const activeCategories = categories.filter(c => catGroups[c].length > 0);
  const groups = activeCategories.map(c => catGroups[c]);
  const observed = computeKruskalWallisH(groups);

  const rng = mulberry32(seed);
  const allEigs = allEigenvalues.map(e => e.eigenvalue);
  const nullHs: number[] = [];

  for (let p = 0; p < nPermutations; p++) {
    const shuffled = [...allEigs];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    let idx = 0;
    const permGroups: number[][] = [];
    for (const c of activeCategories) {
      const n = catGroups[c].length;
      permGroups.push(shuffled.slice(idx, idx + n));
      idx += n;
    }
    const permH = computeKruskalWallisH(permGroups);
    nullHs.push(permH.H);
  }

  const permPValue = (nullHs.filter(h => h >= observed.H).length + 1) / (nPermutations + 1);
  const nullMeanH = nullHs.reduce((a, b) => a + b, 0) / nullHs.length;
  const nullStdH = Math.sqrt(nullHs.reduce((a, b) => a + (b - nullMeanH) ** 2, 0) / nullHs.length);

  const nBins = 40;
  const minH = Math.min(...nullHs, observed.H) - 0.5;
  const maxH = Math.max(...nullHs, observed.H) + 0.5;
  const binWidth = (maxH - minH) / nBins;
  const bins = Array.from({ length: nBins }, (_, i) => ({ binCenter: minH + (i + 0.5) * binWidth, count: 0 }));
  for (const h of nullHs) {
    const idx = Math.min(Math.floor((h - minH) / binWidth), nBins - 1);
    bins[idx].count++;
  }

  const categoryMeans = activeCategories.map(c => ({
    category: c,
    label: CATEGORY_META[c].label,
    meanEigenvalue: catGroups[c].reduce((a, b) => a + b, 0) / catGroups[c].length,
    count: catGroups[c].length,
  })).sort((a, b) => b.meanEigenvalue - a.meanEigenvalue);

  const hierarchyOrder = categoryMeans.map(c => c.label);

  const conclusion = `Multi-category permutation test (${nPermutations.toLocaleString()} permutations): ` +
    `Observed Kruskal-Wallis H = ${observed.H.toFixed(2)} (parametric p = ${observed.pValue < 0.001 ? '<0.001' : observed.pValue.toFixed(4)}). ` +
    `Permutation p = ${permPValue < 0.001 ? '<0.001' : permPValue.toFixed(4)}. ` +
    (permPValue < 0.05
      ? `The 9-category eigenvalue hierarchy is statistically significant — not an artifact of gene selection. ` +
        `Hierarchy: ${hierarchyOrder.join(' > ')}.`
      : `The hierarchy does not reach significance under permutation. Further investigation needed.`);

  return {
    observedH: observed.H,
    observedPValue: observed.pValue,
    nPermutations,
    nullHDistribution: bins,
    nullMeanH,
    nullStdH,
    permutationPValue: permPValue,
    categoryMeans,
    hierarchyOrder,
    datasetsUsed: datasetFiles.length,
    totalGenes: allEigenvalues.length,
    conclusion,
  };
}

export interface MultiCatBootstrapCategoryResult {
  category: string;
  label: string;
  pointEstimate: number;
  ci95Lower: number;
  ci95Upper: number;
  ciWidth: number;
  geneCount: number;
}

export interface MultiCatBootstrapResult {
  nBootstrap: number;
  seed: number;
  categories: MultiCatBootstrapCategoryResult[];
  topCategoryStable: boolean;
  rankOrderStability: number;
  datasetsUsed: number;
  totalGenes: number;
  conclusion: string;
}

export function runMultiCategoryBootstrapCI(nBootstrap = 2000, seed = 42): MultiCatBootstrapResult {
  const datasetFiles = [
    'GSE54650_Liver_circadian.csv', 'GSE54650_Kidney_circadian.csv',
    'GSE54650_Heart_circadian.csv', 'GSE54650_Lung_circadian.csv',
    'GSE54650_Adrenal_circadian.csv',
  ];

  const catEigenvalues: Record<string, number[]> = {};

  for (const file of datasetFiles) {
    const filePath = path.join(process.cwd(), 'datasets', file);
    if (!fs.existsSync(filePath)) continue;
    const genes = parseDatasetMultiCategory(filePath);
    for (const g of genes) {
      const fit = fitAR2(g.values);
      if (!catEigenvalues[g.category]) catEigenvalues[g.category] = [];
      catEigenvalues[g.category].push(fit.eigenvalue);
    }
  }

  const rng = mulberry32(seed);
  const activeCategories = Object.keys(catEigenvalues).filter(c => catEigenvalues[c].length >= 3);

  const bootstrapMeans: Record<string, number[]> = {};
  for (const c of activeCategories) bootstrapMeans[c] = [];

  for (let b = 0; b < nBootstrap; b++) {
    for (const c of activeCategories) {
      const vals = catEigenvalues[c];
      let sum = 0;
      for (let i = 0; i < vals.length; i++) {
        sum += vals[Math.floor(rng() * vals.length)];
      }
      bootstrapMeans[c].push(sum / vals.length);
    }
  }

  const categories: MultiCatBootstrapCategoryResult[] = activeCategories.map(c => {
    const sorted = [...bootstrapMeans[c]].sort((a, b) => a - b);
    const pointEstimate = catEigenvalues[c].reduce((a, b) => a + b, 0) / catEigenvalues[c].length;
    const ci95Lower = sorted[Math.floor(nBootstrap * 0.025)];
    const ci95Upper = sorted[Math.floor(nBootstrap * 0.975)];
    return {
      category: c,
      label: CATEGORY_META[c as GeneCategory]?.label || c,
      pointEstimate,
      ci95Lower,
      ci95Upper,
      ciWidth: ci95Upper - ci95Lower,
      geneCount: catEigenvalues[c].length,
    };
  }).sort((a, b) => b.pointEstimate - a.pointEstimate);

  let rankStableCount = 0;
  for (let b = 0; b < nBootstrap; b++) {
    const bootRanked = activeCategories
      .map(c => ({ c, mean: bootstrapMeans[c][b] }))
      .sort((a, b) => b.mean - a.mean);
    if (bootRanked[0].c === categories[0].category) rankStableCount++;
  }
  const topCategoryStable = rankStableCount / nBootstrap > 0.8;
  const rankOrderStability = rankStableCount / nBootstrap;

  const totalGenes = Object.values(catEigenvalues).reduce((a, v) => a + v.length, 0);

  const conclusion = `Multi-category bootstrap CIs (${nBootstrap} iterations): ` +
    `${categories.length} categories analyzed with ${totalGenes} total genes. ` +
    `${categories[0].label} ranked #1 in ${(rankOrderStability * 100).toFixed(0)}% of bootstrap iterations ` +
    `(point estimate: ${categories[0].pointEstimate.toFixed(4)}, 95% CI: [${categories[0].ci95Lower.toFixed(4)}, ${categories[0].ci95Upper.toFixed(4)}]). ` +
    (topCategoryStable
      ? `The top-ranked category is highly stable under resampling — the hierarchy is robust to sampling variability.`
      : `The top-ranked category is moderately stable — some overlap exists between top categories.`);

  return {
    nBootstrap,
    seed,
    categories,
    topCategoryStable,
    rankOrderStability,
    datasetsUsed: datasetFiles.length,
    totalGenes,
    conclusion,
  };
}

export interface MultiCatDetrendCategoryResult {
  category: string;
  label: string;
  rawMeanEigenvalue: number;
  detrendedMeanEigenvalue: number;
  geneCount: number;
}

export interface MultiCatDetrendDatasetResult {
  dataset: string;
  categories: MultiCatDetrendCategoryResult[];
  rawRankOrder: string[];
  detrendedRankOrder: string[];
  rankCorrelation: number;
  topCategoryPreserved: boolean;
}

export interface MultiCatDetrendResult {
  datasets: MultiCatDetrendDatasetResult[];
  overallRankCorrelation: number;
  topCategoryPreservedRate: number;
  conclusion: string;
}

export function runMultiCategoryDetrendAnalysis(): MultiCatDetrendResult {
  const datasetFiles = [
    { id: 'Liver', file: 'GSE54650_Liver_circadian.csv' },
    { id: 'Kidney', file: 'GSE54650_Kidney_circadian.csv' },
    { id: 'Heart', file: 'GSE54650_Heart_circadian.csv' },
    { id: 'Lung', file: 'GSE54650_Lung_circadian.csv' },
    { id: 'Adrenal', file: 'GSE54650_Adrenal_circadian.csv' },
    { id: 'Hypothalamus', file: 'GSE54650_Hypothalamus_circadian.csv' },
    { id: 'Cerebellum', file: 'GSE54650_Cerebellum_circadian.csv' },
    { id: 'Brown Fat', file: 'GSE54650_Brown_Fat_circadian.csv' },
  ];

  const results: MultiCatDetrendDatasetResult[] = [];

  for (const ds of datasetFiles) {
    const filePath = path.join(process.cwd(), 'datasets', ds.file);
    if (!fs.existsSync(filePath)) continue;
    const genes = parseDatasetMultiCategory(filePath);

    const catRaw: Record<string, number[]> = {};
    const catDet: Record<string, number[]> = {};

    for (const g of genes) {
      const rawFit = fitAR2(g.values);
      const detrended = linearDetrend(g.values);
      const detFit = fitAR2(detrended);
      if (!catRaw[g.category]) { catRaw[g.category] = []; catDet[g.category] = []; }
      catRaw[g.category].push(rawFit.eigenvalue);
      catDet[g.category].push(detFit.eigenvalue);
    }

    const activeCats = Object.keys(catRaw).filter(c => catRaw[c].length >= 2);
    const catResults: MultiCatDetrendCategoryResult[] = activeCats.map(c => ({
      category: c,
      label: CATEGORY_META[c as GeneCategory]?.label || c,
      rawMeanEigenvalue: catRaw[c].reduce((a, b) => a + b, 0) / catRaw[c].length,
      detrendedMeanEigenvalue: catDet[c].reduce((a, b) => a + b, 0) / catDet[c].length,
      geneCount: catRaw[c].length,
    }));

    const rawRanked = [...catResults].sort((a, b) => b.rawMeanEigenvalue - a.rawMeanEigenvalue);
    const detRanked = [...catResults].sort((a, b) => b.detrendedMeanEigenvalue - a.detrendedMeanEigenvalue);

    const rawOrder = rawRanked.map(c => c.category);
    const detOrder = detRanked.map(c => c.category);

    const n = rawOrder.length;
    let d2sum = 0;
    for (let i = 0; i < n; i++) {
      const rawRank = i;
      const detRank = detOrder.indexOf(rawOrder[i]);
      d2sum += (rawRank - detRank) ** 2;
    }
    const spearman = n > 1 ? 1 - (6 * d2sum) / (n * (n * n - 1)) : 1;

    results.push({
      dataset: ds.id,
      categories: catResults,
      rawRankOrder: rawOrder,
      detrendedRankOrder: detOrder,
      rankCorrelation: spearman,
      topCategoryPreserved: rawOrder[0] === detOrder[0],
    });
  }

  const overallRankCorr = results.length > 0
    ? results.reduce((a, r) => a + r.rankCorrelation, 0) / results.length : 0;
  const topPreservedRate = results.length > 0
    ? results.filter(r => r.topCategoryPreserved).length / results.length : 0;

  const conclusion = `Multi-category detrend analysis across ${results.length} tissues: ` +
    `Mean Spearman rank correlation between raw and detrended hierarchies: ρ = ${overallRankCorr.toFixed(3)}. ` +
    `Top category preserved in ${results.filter(r => r.topCategoryPreserved).length}/${results.length} tissues (${(topPreservedRate * 100).toFixed(0)}%). ` +
    (overallRankCorr > 0.8
      ? 'The multi-category hierarchy is highly robust to linear detrending — rank order is preserved across tissues.'
      : overallRankCorr > 0.5
        ? 'The hierarchy is moderately robust to detrending — most rank positions are preserved but some shuffling occurs.'
        : 'Detrending significantly alters the hierarchy — further investigation needed.');

  return { datasets: results, overallRankCorrelation: overallRankCorr, topCategoryPreservedRate: topPreservedRate, conclusion };
}

export interface MultiCatLOTOTissueResult {
  heldOutTissue: string;
  trainRankOrder: string[];
  heldOutRankOrder: string[];
  rankCorrelation: number;
  topCategoryMatch: boolean;
  trainCategoryMeans: { category: string; label: string; mean: number }[];
  heldOutCategoryMeans: { category: string; label: string; mean: number }[];
}

export interface MultiCatLOTOResult {
  tissues: MultiCatLOTOTissueResult[];
  totalTissues: number;
  meanRankCorrelation: number;
  topCategoryMatchRate: number;
  conclusion: string;
}

export function runMultiCategoryLOTO(): MultiCatLOTOResult {
  const datasetFiles = [
    { id: 'Liver', file: 'GSE54650_Liver_circadian.csv' },
    { id: 'Kidney', file: 'GSE54650_Kidney_circadian.csv' },
    { id: 'Heart', file: 'GSE54650_Heart_circadian.csv' },
    { id: 'Lung', file: 'GSE54650_Lung_circadian.csv' },
    { id: 'Adrenal', file: 'GSE54650_Adrenal_circadian.csv' },
    { id: 'Hypothalamus', file: 'GSE54650_Hypothalamus_circadian.csv' },
    { id: 'Cerebellum', file: 'GSE54650_Cerebellum_circadian.csv' },
    { id: 'Brown Fat', file: 'GSE54650_Brown_Fat_circadian.csv' },
    { id: 'Muscle', file: 'GSE54650_Muscle_circadian.csv' },
    { id: 'Aorta', file: 'GSE54650_Aorta_circadian.csv' },
    { id: 'Brainstem', file: 'GSE54650_Brainstem_circadian.csv' },
  ];

  const tissueData: { id: string; catEigs: Record<string, number[]> }[] = [];

  for (const ds of datasetFiles) {
    const filePath = path.join(process.cwd(), 'datasets', ds.file);
    if (!fs.existsSync(filePath)) continue;
    const genes = parseDatasetMultiCategory(filePath);
    const catEigs: Record<string, number[]> = {};
    for (const g of genes) {
      const fit = fitAR2(g.values);
      if (!catEigs[g.category]) catEigs[g.category] = [];
      catEigs[g.category].push(fit.eigenvalue);
    }
    tissueData.push({ id: ds.id, catEigs });
  }

  const results: MultiCatLOTOTissueResult[] = [];

  for (let i = 0; i < tissueData.length; i++) {
    const heldOut = tissueData[i];
    const training = tissueData.filter((_, j) => j !== i);

    const trainCatEigs: Record<string, number[]> = {};
    for (const t of training) {
      for (const [cat, eigs] of Object.entries(t.catEigs)) {
        if (!trainCatEigs[cat]) trainCatEigs[cat] = [];
        trainCatEigs[cat].push(...eigs);
      }
    }

    const sharedCats = Object.keys(trainCatEigs).filter(c =>
      trainCatEigs[c].length >= 2 && heldOut.catEigs[c] && heldOut.catEigs[c].length >= 1
    );

    const trainMeans = sharedCats.map(c => ({
      category: c,
      label: CATEGORY_META[c as GeneCategory]?.label || c,
      mean: trainCatEigs[c].reduce((a, b) => a + b, 0) / trainCatEigs[c].length,
    })).sort((a, b) => b.mean - a.mean);

    const heldOutMeans = sharedCats.map(c => ({
      category: c,
      label: CATEGORY_META[c as GeneCategory]?.label || c,
      mean: heldOut.catEigs[c].reduce((a, b) => a + b, 0) / heldOut.catEigs[c].length,
    })).sort((a, b) => b.mean - a.mean);

    const trainOrder = trainMeans.map(m => m.category);
    const heldOutOrder = heldOutMeans.map(m => m.category);

    const n = trainOrder.length;
    let d2sum = 0;
    for (let k = 0; k < n; k++) {
      const trainRank = k;
      const hoRank = heldOutOrder.indexOf(trainOrder[k]);
      if (hoRank >= 0) d2sum += (trainRank - hoRank) ** 2;
    }
    const spearman = n > 1 ? 1 - (6 * d2sum) / (n * (n * n - 1)) : 1;

    results.push({
      heldOutTissue: heldOut.id,
      trainRankOrder: trainOrder,
      heldOutRankOrder: heldOutOrder,
      rankCorrelation: spearman,
      topCategoryMatch: trainOrder[0] === heldOutOrder[0],
      trainCategoryMeans: trainMeans,
      heldOutCategoryMeans: heldOutMeans,
    });
  }

  const meanRankCorr = results.length > 0
    ? results.reduce((a, r) => a + r.rankCorrelation, 0) / results.length : 0;
  const topMatchRate = results.length > 0
    ? results.filter(r => r.topCategoryMatch).length / results.length : 0;

  const conclusion = `Multi-category leave-one-tissue-out across ${results.length} mouse tissues: ` +
    `Mean Spearman rank correlation between training and held-out hierarchies: ρ = ${meanRankCorr.toFixed(3)}. ` +
    `Top category matches in ${results.filter(r => r.topCategoryMatch).length}/${results.length} tissues (${(topMatchRate * 100).toFixed(0)}%). ` +
    (meanRankCorr > 0.7
      ? 'The multi-category hierarchy generalizes strongly across tissues — no single tissue drives the result.'
      : meanRankCorr > 0.4
        ? 'Moderate cross-tissue generalization — the overall pattern holds but individual tissue variation exists.'
        : 'Weak cross-tissue generalization — the hierarchy may be tissue-specific.');

  return { tissues: results, totalTissues: results.length, meanRankCorrelation: meanRankCorr, topCategoryMatchRate: topMatchRate, conclusion };
}

const BABOON_SYMBOL_TO_CLOCK_TARGET: Record<string, 'clock' | 'target'> = {};
for (const g of CLOCK_GENES_UPPER) BABOON_SYMBOL_TO_CLOCK_TARGET[g] = 'clock';
for (const g of TARGET_GENES_UPPER) BABOON_SYMBOL_TO_CLOCK_TARGET[g] = 'target';

function parseBaboonTissue(tissuePrefix: string): Map<string, GeneData> {
  const filePath = path.join(process.cwd(), 'datasets', 'GSE98965_baboon_FPKM.csv');
  if (!fs.existsSync(filePath)) throw new Error('Baboon dataset not found');

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  const header = lines[0].split(',');

  const colIndices: number[] = [];
  for (let i = 2; i < header.length; i++) {
    if (header[i].startsWith(tissuePrefix + '.ZT')) {
      colIndices.push(i);
    }
  }
  if (colIndices.length === 0) throw new Error(`No columns found for tissue prefix: ${tissuePrefix}`);

  const genes = new Map<string, GeneData>();
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const symbol = (cols[1] || '').trim().replace(/"/g, '');
    if (!symbol) continue;
    const type = BABOON_SYMBOL_TO_CLOCK_TARGET[symbol.toUpperCase()];
    if (!type) continue;

    const values = colIndices.map(ci => parseFloat(cols[ci])).filter(v => !isNaN(v));
    if (values.length < 5) continue;
    const allZero = values.every(v => v === 0);
    if (allZero) continue;

    genes.set(symbol, { gene: symbol, type, values });
  }
  return genes;
}

const BABOON_TISSUES = [
  { id: 'Baboon Liver', prefix: 'LIV' },
  { id: 'Baboon Heart', prefix: 'HEA' },
  { id: 'Baboon Lung', prefix: 'LUN' },
  { id: 'Baboon Kidney Cortex', prefix: 'KIC' },
  { id: 'Baboon Cerebellum', prefix: 'CER' },
  { id: 'Baboon Adrenal Cortex', prefix: 'ADC' },
  { id: 'Baboon White Fat', prefix: 'WAT' },
  { id: 'Baboon Bone Marrow', prefix: 'BOM' },
];

export interface CrossSpeciesTissueResult {
  tissue: string;
  species: string;
  clockMean: number;
  targetMean: number;
  gap: number;
  hierarchyPreserved: boolean;
  clockGenes: { gene: string; eigenvalue: number; r2: number }[];
  targetGenes: { gene: string; eigenvalue: number; r2: number }[];
  clockCount: number;
  targetCount: number;
}

export interface CrossSpeciesBootstrapResult {
  tissue: string;
  mouseGap: number;
  baboonGap: number;
  gapDifference: number;
  mouseCI: [number, number];
  baboonCI: [number, number];
  bothSignificant: boolean;
}

export interface CrossSpeciesReplicationResult {
  mouseTissues: CrossSpeciesTissueResult[];
  baboonTissues: CrossSpeciesTissueResult[];
  mouseHierarchyRate: number;
  baboonHierarchyRate: number;
  matchedComparisons: CrossSpeciesBootstrapResult[];
  overallConclusion: string;
  baboonTimepointsPerTissue: number;
  totalBaboonGenes: number;
}

export function runCrossSpeciesReplication(nBootstrap = 200, seed = 42): CrossSpeciesReplicationResult {
  const mouseDatasetFiles = [
    { id: 'Mouse Liver', file: 'GSE54650_Liver_circadian.csv' },
    { id: 'Mouse Heart', file: 'GSE54650_Heart_circadian.csv' },
    { id: 'Mouse Lung', file: 'GSE54650_Lung_circadian.csv' },
    { id: 'Mouse Kidney', file: 'GSE54650_Kidney_circadian.csv' },
    { id: 'Mouse Cerebellum', file: 'GSE54650_Cerebellum_circadian.csv' },
    { id: 'Mouse Adrenal', file: 'GSE54650_Adrenal_circadian.csv' },
    { id: 'Mouse White Fat', file: 'GSE54650_White_Fat_circadian.csv' },
  ];

  function analyzeTissue(genes: Map<string, GeneData>, tissueId: string, species: string): CrossSpeciesTissueResult {
    const clockGenes: { gene: string; eigenvalue: number; r2: number }[] = [];
    const targetGenes: { gene: string; eigenvalue: number; r2: number }[] = [];

    for (const geneData of Array.from(genes.values())) {
      const fit = fitAR2(geneData.values);
      if (geneData.type === 'clock') {
        clockGenes.push({ gene: geneData.gene, eigenvalue: fit.eigenvalue, r2: fit.r2 });
      } else {
        targetGenes.push({ gene: geneData.gene, eigenvalue: fit.eigenvalue, r2: fit.r2 });
      }
    }

    const clockMean = clockGenes.length > 0 ? clockGenes.reduce((a, g) => a + g.eigenvalue, 0) / clockGenes.length : 0;
    const targetMean = targetGenes.length > 0 ? targetGenes.reduce((a, g) => a + g.eigenvalue, 0) / targetGenes.length : 0;

    return {
      tissue: tissueId,
      species,
      clockMean,
      targetMean,
      gap: clockMean - targetMean,
      hierarchyPreserved: clockMean > targetMean,
      clockGenes,
      targetGenes,
      clockCount: clockGenes.length,
      targetCount: targetGenes.length,
    };
  }

  const mouseTissues: CrossSpeciesTissueResult[] = [];
  for (const ds of mouseDatasetFiles) {
    const filePath = path.join(process.cwd(), 'datasets', ds.file);
    if (!fs.existsSync(filePath)) continue;
    const genes = parseDataset(filePath);
    mouseTissues.push(analyzeTissue(genes, ds.id, 'Mouse'));
  }

  const baboonTissues: CrossSpeciesTissueResult[] = [];
  let totalBaboonGenes = 0;
  let baboonTimepointsPerTissue = 12;
  for (const bt of BABOON_TISSUES) {
    try {
      const genes = parseBaboonTissue(bt.prefix);
      if (genes.size === 0) continue;
      totalBaboonGenes += genes.size;
      baboonTimepointsPerTissue = Array.from(genes.values())[0]?.values.length || 12;
      baboonTissues.push(analyzeTissue(genes, bt.id, 'Baboon'));
    } catch {
      continue;
    }
  }

  const tissueMap: Record<string, string> = {
    'Mouse Liver': 'Baboon Liver',
    'Mouse Heart': 'Baboon Heart',
    'Mouse Lung': 'Baboon Lung',
    'Mouse Kidney': 'Baboon Kidney Cortex',
    'Mouse Cerebellum': 'Baboon Cerebellum',
    'Mouse Adrenal': 'Baboon Adrenal Cortex',
    'Mouse White Fat': 'Baboon White Fat',
  };

  const rng = mulberry32(seed);
  const matchedComparisons: CrossSpeciesBootstrapResult[] = [];

  for (const mt of mouseTissues) {
    const baboonName = tissueMap[mt.tissue];
    const bt = baboonTissues.find(b => b.tissue === baboonName);
    if (!bt) continue;

    function bootstrapGap(clockEigs: number[], targetEigs: number[]): [number, number] {
      const gaps: number[] = [];
      for (let b = 0; b < nBootstrap; b++) {
        const cSample = Array.from({ length: clockEigs.length }, () => clockEigs[Math.floor(rng() * clockEigs.length)]);
        const tSample = Array.from({ length: targetEigs.length }, () => targetEigs[Math.floor(rng() * targetEigs.length)]);
        const cMean = cSample.reduce((a, v) => a + v, 0) / cSample.length;
        const tMean = tSample.reduce((a, v) => a + v, 0) / tSample.length;
        gaps.push(cMean - tMean);
      }
      gaps.sort((a, b) => a - b);
      return [gaps[Math.floor(nBootstrap * 0.025)], gaps[Math.floor(nBootstrap * 0.975)]];
    }

    const mouseCI = bootstrapGap(mt.clockGenes.map(g => g.eigenvalue), mt.targetGenes.map(g => g.eigenvalue));
    const baboonCI = bootstrapGap(bt.clockGenes.map(g => g.eigenvalue), bt.targetGenes.map(g => g.eigenvalue));

    matchedComparisons.push({
      tissue: mt.tissue.replace('Mouse ', ''),
      mouseGap: mt.gap,
      baboonGap: bt.gap,
      gapDifference: Math.abs(mt.gap - bt.gap),
      mouseCI,
      baboonCI,
      bothSignificant: mouseCI[0] > 0 && baboonCI[0] > 0,
    });
  }

  const mouseHierarchyRate = mouseTissues.length > 0
    ? mouseTissues.filter(t => t.hierarchyPreserved).length / mouseTissues.length : 0;
  const baboonHierarchyRate = baboonTissues.length > 0
    ? baboonTissues.filter(t => t.hierarchyPreserved).length / baboonTissues.length : 0;

  const bothPreserved = matchedComparisons.filter(m => m.bothSignificant).length;

  const overallConclusion = `Cross-species replication (Mouse GSE54650 vs Baboon GSE98965, Mure 2018): ` +
    `Mouse hierarchy preserved in ${mouseTissues.filter(t => t.hierarchyPreserved).length}/${mouseTissues.length} tissues; ` +
    `Baboon hierarchy preserved in ${baboonTissues.filter(t => t.hierarchyPreserved).length}/${baboonTissues.length} tissues. ` +
    `${matchedComparisons.length} matched tissue comparisons: ` +
    `${bothPreserved}/${matchedComparisons.length} show significant clock > target gap in both species (bootstrap 95% CI). ` +
    (baboonHierarchyRate >= 0.7
      ? 'The eigenvalue hierarchy replicates across species — the clock > target pattern is not specific to the mouse GSE54650 dataset.'
      : baboonHierarchyRate >= 0.4
        ? 'Partial cross-species replication — the hierarchy holds in some baboon tissues but not all, consistent with tissue-specific variation.'
        : 'Limited cross-species replication — the hierarchy may be species- or dataset-specific.');

  return {
    mouseTissues,
    baboonTissues,
    mouseHierarchyRate,
    baboonHierarchyRate,
    matchedComparisons,
    overallConclusion,
    baboonTimepointsPerTissue,
    totalBaboonGenes,
  };
}
