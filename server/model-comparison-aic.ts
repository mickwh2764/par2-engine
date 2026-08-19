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

function classifyGene(name: string): 'clock' | 'target' | 'other' {
  const upper = name.toUpperCase();
  if (CLOCK_GENES_UPPER.has(upper)) return 'clock';
  if (TARGET_GENES_UPPER.has(upper)) return 'target';
  return 'other';
}

interface GeneTimeSeries {
  gene: string;
  type: 'clock' | 'target' | 'other';
  values: number[];
}

function parseDataset(filePath: string, includeOther = false): GeneTimeSeries[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  const genes: GeneTimeSeries[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const rawGene = cols[0].trim().replace(/"/g, '');
    if (!rawGene) continue;
    const gene = ENSEMBL_TO_SYMBOL[rawGene] || rawGene;
    const values = cols.slice(1).map(v => parseFloat(v)).filter(v => !isNaN(v));
    if (values.length < 5) continue;
    const type = classifyGene(gene);
    if (type !== 'other' || includeOther) {
      genes.push({ gene, type, values });
    }
  }
  return genes;
}

interface ARFitResult {
  order: number;
  coeffs: number[];
  eigenvalue: number;
  r2: number;
  sse: number;
  aic: number;
  bic: number;
  aicc: number;
  nObs: number;
  nParams: number;
}

function fitARWithIC(series: number[], order: number, maxOrder: number = order): ARFitResult {
  const n = series.length;
  const startIdx = Math.max(order, maxOrder);
  if (n < startIdx + 3) {
    return { order, coeffs: [], eigenvalue: 0, r2: 0, sse: 0, aic: Infinity, bic: Infinity, aicc: Infinity, nObs: 0, nParams: order };
  }

  const mean = series.reduce((a, b) => a + b, 0) / n;
  const y = series.map(x => x - mean);
  const T = n - startIdx;
  const Y = y.slice(startIdx);

  const X: number[][] = [];
  for (let t = 0; t < T; t++) {
    const row: number[] = [];
    for (let p = 1; p <= order; p++) {
      row.push(y[startIdx + t - p]);
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
    if (Math.abs(XtX[0][0]) < 1e-10) return { order, coeffs: [0], eigenvalue: 0, r2: 0, sse: 0, aic: Infinity, bic: Infinity, aicc: Infinity, nObs: T, nParams: 1 };
    coeffs = [XtY[0] / XtX[0][0]];
  } else if (order === 2) {
    const det = XtX[0][0] * XtX[1][1] - XtX[0][1] * XtX[1][0];
    if (Math.abs(det) < 1e-10) return { order, coeffs: [0, 0], eigenvalue: 0, r2: 0, sse: 0, aic: Infinity, bic: Infinity, aicc: Infinity, nObs: T, nParams: 2 };
    coeffs = [
      (XtY[0] * XtX[1][1] - XtY[1] * XtX[0][1]) / det,
      (XtY[1] * XtX[0][0] - XtY[0] * XtX[1][0]) / det,
    ];
  } else {
    const solved = solveSystem(XtX, XtY);
    if (!solved) return { order, coeffs: Array(order).fill(0), eigenvalue: 0, r2: 0, sse: 0, aic: Infinity, bic: Infinity, aicc: Infinity, nObs: T, nParams: order };
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

  const k = order + 1;
  const sigma2 = ssRes / T;
  const logLik = -T / 2 * (Math.log(2 * Math.PI) + Math.log(sigma2 + 1e-15) + 1);
  const aic = -2 * logLik + 2 * k;
  const bic = -2 * logLik + k * Math.log(T);
  const aicc = (T - k - 1) > 0 ? aic + (2 * k * (k + 1)) / (T - k - 1) : Infinity;

  const eigenvalue = computeMaxEigenvalue(coeffs);

  return { order, coeffs, eigenvalue, r2, sse: ssRes, aic, bic, aicc, nObs: T, nParams: order };
}

function solveSystem(A: number[][], b: number[]): number[] | null {
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

function computeMaxEigenvalue(coeffs: number[]): number {
  if (coeffs.length === 1) return Math.abs(coeffs[0]);
  if (coeffs.length === 2) {
    const disc = coeffs[0] * coeffs[0] + 4 * coeffs[1];
    if (disc < 0) return Math.sqrt(-coeffs[1]);
    const r1 = (coeffs[0] + Math.sqrt(disc)) / 2;
    const r2 = (coeffs[0] - Math.sqrt(disc)) / 2;
    return Math.max(Math.abs(r1), Math.abs(r2));
  }
  if (coeffs.length === 3) {
    const p = coeffs[1] - (coeffs[0] * coeffs[0]) / 3;
    const q = 2 * Math.pow(coeffs[0], 3) / 27 - coeffs[0] * coeffs[1] / 3 + coeffs[2];
    const disc = q * q / 4 + Math.pow(p, 3) / 27;
    if (disc > 0) {
      const sqrtDisc = Math.sqrt(disc);
      const u = Math.cbrt(-q / 2 + sqrtDisc);
      const v = Math.cbrt(-q / 2 - sqrtDisc);
      return Math.abs(u + v - coeffs[0] / 3);
    }
    const r = Math.sqrt((-p) ** 3 / 27);
    const theta = Math.acos(Math.max(-1, Math.min(1, -q / (2 * r))));
    const m = 2 * Math.cbrt(r);
    const roots = [
      m * Math.cos(theta / 3) - coeffs[0] / 3,
      m * Math.cos((theta + 2 * Math.PI) / 3) - coeffs[0] / 3,
      m * Math.cos((theta + 4 * Math.PI) / 3) - coeffs[0] / 3,
    ];
    return Math.max(...roots.map(Math.abs));
  }
  return 0;
}

export interface GeneModelComparison {
  gene: string;
  geneType: 'clock' | 'target' | 'other';
  nTimepoints: number;
  nEffective: number;
  ar1: { eigenvalue: number; r2: number; aic: number; bic: number; aicc: number };
  ar2: { eigenvalue: number; r2: number; aic: number; bic: number; aicc: number };
  ar3: { eigenvalue: number; r2: number; aic: number; bic: number; aicc: number };
  deltaAIC_ar2_vs_ar1: number;
  deltaBIC_ar2_vs_ar1: number;
  deltaAIC_ar3_vs_ar2: number;
  deltaBIC_ar3_vs_ar2: number;
  bestModelAIC: number;
  bestModelBIC: number;
  bestModelAICc: number;
  ar2Preferred: boolean;
}

export interface DatasetModelComparison {
  dataset: string;
  datasetId: string;
  nGenes: number;
  genes: GeneModelComparison[];
  summary: {
    medianAIC_AR1: number;
    medianAIC_AR2: number;
    medianAIC_AR3: number;
    medianBIC_AR1: number;
    medianBIC_AR2: number;
    medianBIC_AR3: number;
    medianDeltaAIC_ar2_vs_ar1: number;
    medianDeltaBIC_ar2_vs_ar1: number;
    medianDeltaAIC_ar3_vs_ar2: number;
    medianDeltaBIC_ar3_vs_ar2: number;
    ar2PreferredByAIC: number;
    ar2PreferredByBIC: number;
    ar1PreferredByAIC: number;
    ar3PreferredByAIC: number;
    meanR2_AR1: number;
    meanR2_AR2: number;
    meanR2_AR3: number;
    hierarchyPreserved_AR1: boolean;
    hierarchyPreserved_AR2: boolean;
    hierarchyPreserved_AR3: boolean;
    clockMean_AR1: number;
    clockMean_AR2: number;
    clockMean_AR3: number;
    targetMean_AR1: number;
    targetMean_AR2: number;
    targetMean_AR3: number;
  };
}

export interface ModelComparisonResult {
  datasets: DatasetModelComparison[];
  overallSummary: {
    totalGenes: number;
    totalDatasets: number;
    ar2PreferredByAIC_pct: number;
    ar2PreferredByBIC_pct: number;
    ar1PreferredByAIC_pct: number;
    ar3PreferredByAIC_pct: number;
    meanDeltaAIC_ar2_vs_ar1: number;
    meanDeltaBIC_ar2_vs_ar1: number;
    hierarchyRobust: boolean;
    hierarchyAR1_count: number;
    hierarchyAR2_count: number;
    hierarchyAR3_count: number;
    rankCorrelation_ar2_ar3: number;
    eigenvaluePairs: { gene: string; geneType: string; ar2: number; ar3: number }[];
  };
  conclusion: string;
  timestamp: string;
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function runModelComparisonAIC(): ModelComparisonResult {
  const DATASETS = [
    { id: 'GSE54650_Liver', label: 'Liver (GSE54650)', file: 'GSE54650_Liver_circadian.csv' },
    { id: 'GSE11923_Liver48h', label: 'Liver 48h (GSE11923)', file: 'GSE11923_Liver_1h_48h_genes.csv' },
    { id: 'GSE54650_Kidney', label: 'Kidney (GSE54650)', file: 'GSE54650_Kidney_circadian.csv' },
    { id: 'GSE54650_Heart', label: 'Heart (GSE54650)', file: 'GSE54650_Heart_circadian.csv' },
    { id: 'GSE54650_Lung', label: 'Lung (GSE54650)', file: 'GSE54650_Lung_circadian.csv' },
    { id: 'GSE157357_WT', label: 'Organoid WT (GSE157357)', file: 'GSE157357_Organoid_WT-WT_circadian.csv' },
    { id: 'GSE157357_ApcKO', label: 'Organoid ApcKO (GSE157357)', file: 'GSE157357_Organoid_ApcKO-WT_circadian.csv' },
    { id: 'GSE113883_Blood', label: 'Human Blood (GSE113883)', file: 'GSE113883_Human_WholeBlood.csv' },
  ];

  const datasetResults: DatasetModelComparison[] = [];
  let totalGenes = 0;

  for (const ds of DATASETS) {
    const filePath = path.join(process.cwd(), 'datasets', ds.file);
    if (!fs.existsSync(filePath)) continue;

    const genes = parseDataset(filePath);
    if (genes.length === 0) continue;

    const geneComparisons: GeneModelComparison[] = [];

    for (const g of genes) {
      const maxOrder = 3;
      const ar1 = fitARWithIC(g.values, 1, maxOrder);
      const ar2 = fitARWithIC(g.values, 2, maxOrder);
      const ar3 = fitARWithIC(g.values, 3, maxOrder);

      if (ar1.nObs === 0 || ar2.nObs === 0) continue;

      const deltaAIC_21 = ar2.aic - ar1.aic;
      const deltaBIC_21 = ar2.bic - ar1.bic;
      const deltaAIC_32 = ar3.aic - ar2.aic;
      const deltaBIC_32 = ar3.bic - ar2.bic;

      const aics = [ar1.aic, ar2.aic, ar3.aic];
      const bics = [ar1.bic, ar2.bic, ar3.bic];
      const aiccs = [ar1.aicc, ar2.aicc, ar3.aicc];
      const bestAIC = aics.indexOf(Math.min(...aics)) + 1;
      const bestBIC = bics.indexOf(Math.min(...bics)) + 1;
      const bestAICc = aiccs.indexOf(Math.min(...aiccs)) + 1;

      geneComparisons.push({
        gene: g.gene,
        geneType: g.type,
        nTimepoints: g.values.length,
        nEffective: ar1.nObs,
        ar1: { eigenvalue: ar1.eigenvalue, r2: ar1.r2, aic: +ar1.aic.toFixed(2), bic: +ar1.bic.toFixed(2), aicc: +ar1.aicc.toFixed(2) },
        ar2: { eigenvalue: ar2.eigenvalue, r2: ar2.r2, aic: +ar2.aic.toFixed(2), bic: +ar2.bic.toFixed(2), aicc: +ar2.aicc.toFixed(2) },
        ar3: { eigenvalue: ar3.eigenvalue, r2: ar3.r2, aic: +ar3.aic.toFixed(2), bic: +ar3.bic.toFixed(2), aicc: +ar3.aicc.toFixed(2) },
        deltaAIC_ar2_vs_ar1: +deltaAIC_21.toFixed(2),
        deltaBIC_ar2_vs_ar1: +deltaBIC_21.toFixed(2),
        deltaAIC_ar3_vs_ar2: +deltaAIC_32.toFixed(2),
        deltaBIC_ar3_vs_ar2: +deltaBIC_32.toFixed(2),
        bestModelAIC: bestAIC,
        bestModelBIC: bestBIC,
        bestModelAICc: bestAICc,
        ar2Preferred: bestAICc === 2 || bestBIC === 2,
      });
    }

    if (geneComparisons.length === 0) continue;
    totalGenes += geneComparisons.length;

    const clockGenes = geneComparisons.filter(g => g.geneType === 'clock');
    const targetGenes = geneComparisons.filter(g => g.geneType === 'target');

    const clockMean1 = clockGenes.length > 0 ? clockGenes.reduce((s, g) => s + g.ar1.eigenvalue, 0) / clockGenes.length : 0;
    const clockMean2 = clockGenes.length > 0 ? clockGenes.reduce((s, g) => s + g.ar2.eigenvalue, 0) / clockGenes.length : 0;
    const clockMean3 = clockGenes.length > 0 ? clockGenes.reduce((s, g) => s + g.ar3.eigenvalue, 0) / clockGenes.length : 0;
    const targetMean1 = targetGenes.length > 0 ? targetGenes.reduce((s, g) => s + g.ar1.eigenvalue, 0) / targetGenes.length : 0;
    const targetMean2 = targetGenes.length > 0 ? targetGenes.reduce((s, g) => s + g.ar2.eigenvalue, 0) / targetGenes.length : 0;
    const targetMean3 = targetGenes.length > 0 ? targetGenes.reduce((s, g) => s + g.ar3.eigenvalue, 0) / targetGenes.length : 0;

    datasetResults.push({
      dataset: ds.label,
      datasetId: ds.id,
      nGenes: geneComparisons.length,
      genes: geneComparisons,
      summary: {
        medianAIC_AR1: +median(geneComparisons.map(g => g.ar1.aic)).toFixed(2),
        medianAIC_AR2: +median(geneComparisons.map(g => g.ar2.aic)).toFixed(2),
        medianAIC_AR3: +median(geneComparisons.map(g => g.ar3.aic)).toFixed(2),
        medianBIC_AR1: +median(geneComparisons.map(g => g.ar1.bic)).toFixed(2),
        medianBIC_AR2: +median(geneComparisons.map(g => g.ar2.bic)).toFixed(2),
        medianBIC_AR3: +median(geneComparisons.map(g => g.ar3.bic)).toFixed(2),
        medianDeltaAIC_ar2_vs_ar1: +median(geneComparisons.map(g => g.deltaAIC_ar2_vs_ar1)).toFixed(2),
        medianDeltaBIC_ar2_vs_ar1: +median(geneComparisons.map(g => g.deltaBIC_ar2_vs_ar1)).toFixed(2),
        medianDeltaAIC_ar3_vs_ar2: +median(geneComparisons.map(g => g.deltaAIC_ar3_vs_ar2)).toFixed(2),
        medianDeltaBIC_ar3_vs_ar2: +median(geneComparisons.map(g => g.deltaBIC_ar3_vs_ar2)).toFixed(2),
        ar2PreferredByAIC: geneComparisons.filter(g => g.bestModelAIC === 2).length,
        ar2PreferredByBIC: geneComparisons.filter(g => g.bestModelBIC === 2).length,
        ar1PreferredByAIC: geneComparisons.filter(g => g.bestModelAIC === 1).length,
        ar3PreferredByAIC: geneComparisons.filter(g => g.bestModelAIC === 3).length,
        meanR2_AR1: +(geneComparisons.reduce((s, g) => s + g.ar1.r2, 0) / geneComparisons.length).toFixed(4),
        meanR2_AR2: +(geneComparisons.reduce((s, g) => s + g.ar2.r2, 0) / geneComparisons.length).toFixed(4),
        meanR2_AR3: +(geneComparisons.reduce((s, g) => s + g.ar3.r2, 0) / geneComparisons.length).toFixed(4),
        hierarchyPreserved_AR1: clockMean1 > targetMean1,
        hierarchyPreserved_AR2: clockMean2 > targetMean2,
        hierarchyPreserved_AR3: clockMean3 > targetMean3,
        clockMean_AR1: +clockMean1.toFixed(4),
        clockMean_AR2: +clockMean2.toFixed(4),
        clockMean_AR3: +clockMean3.toFixed(4),
        targetMean_AR1: +targetMean1.toFixed(4),
        targetMean_AR2: +targetMean2.toFixed(4),
        targetMean_AR3: +targetMean3.toFixed(4),
      },
    });
  }

  const allGenes = datasetResults.flatMap(d => d.genes);
  const ar2AIC = allGenes.filter(g => g.bestModelAIC === 2).length;
  const ar1AIC = allGenes.filter(g => g.bestModelAIC === 1).length;
  const ar3AIC = allGenes.filter(g => g.bestModelAIC === 3).length;
  const ar2BIC = allGenes.filter(g => g.bestModelBIC === 2).length;

  const allDeltaAIC = allGenes.map(g => g.deltaAIC_ar2_vs_ar1);
  const allDeltaBIC = allGenes.map(g => g.deltaBIC_ar2_vs_ar1);
  const meanDeltaAIC = allDeltaAIC.length > 0 ? allDeltaAIC.reduce((a, b) => a + b, 0) / allDeltaAIC.length : 0;
  const meanDeltaBIC = allDeltaBIC.length > 0 ? allDeltaBIC.reduce((a, b) => a + b, 0) / allDeltaBIC.length : 0;

  const hierarchyAR1 = datasetResults.filter(d => d.summary.hierarchyPreserved_AR1).length;
  const hierarchyAR2 = datasetResults.filter(d => d.summary.hierarchyPreserved_AR2).length;
  const hierarchyAR3 = datasetResults.filter(d => d.summary.hierarchyPreserved_AR3).length;

  const ar2PctAIC = totalGenes > 0 ? (ar2AIC / totalGenes) * 100 : 0;
  const ar2PctBIC = totalGenes > 0 ? (ar2BIC / totalGenes) * 100 : 0;

  const eigenvaluePairs = allGenes
    .filter(g => g.geneType !== 'other')
    .map(g => ({ gene: g.gene, geneType: g.geneType, ar2: +g.ar2.eigenvalue.toFixed(4), ar3: +g.ar3.eigenvalue.toFixed(4) }));

  const rankCorr = spearmanRankCorrelation(
    eigenvaluePairs.map(p => p.ar2),
    eigenvaluePairs.map(p => p.ar3)
  );

  let conclusion = '';
  if (meanDeltaAIC < -2) {
    conclusion = `AR(2) is consistently preferred over AR(1) across ${totalGenes} genes in ${datasetResults.length} datasets (mean ΔAIC = ${meanDeltaAIC.toFixed(1)}). `;
  } else if (meanDeltaAIC > 2) {
    conclusion = `AR(1) is generally preferred over AR(2) (mean ΔAIC = ${meanDeltaAIC.toFixed(1)}). `;
  } else {
    conclusion = `AR(1) and AR(2) perform comparably on average (mean ΔAIC = ${meanDeltaAIC.toFixed(1)}). `;
  }
  conclusion += `AR(2) preferred by AIC in ${ar2PctAIC.toFixed(0)}% of genes, by BIC in ${ar2PctBIC.toFixed(0)}%. `;
  conclusion += `Clock > target hierarchy preserved under AR(1) in ${hierarchyAR1}/${datasetResults.length}, AR(2) in ${hierarchyAR2}/${datasetResults.length}, AR(3) in ${hierarchyAR3}/${datasetResults.length}. `;
  conclusion += `Spearman rank correlation between AR(2) and AR(3) eigenvalues: ρ = ${rankCorr.toFixed(3)}. `;
  if (Math.abs(rankCorr) < 0.3) {
    conclusion += `AR(3) eigenvalue rankings diverge substantially from AR(2) (ρ ≈ ${rankCorr.toFixed(2)}), and hierarchy preservation degrades (${hierarchyAR3}/${datasetResults.length} vs ${hierarchyAR2}/${datasetResults.length}), indicating AR(3)'s extra parameter captures noise rather than biological signal. AR(2) is the minimum sufficient model for oscillatory dynamics.`;
  } else if (rankCorr > 0.8) {
    conclusion += `AR(3) produces nearly identical rankings (ρ = ${rankCorr.toFixed(2)}), confirming AR(2) sufficiency without the interpretability cost of 3D root space.`;
  } else {
    conclusion += `AR(2) captures complex-root oscillatory dynamics that AR(1) cannot represent, with moderate concordance to AR(3) rankings (ρ = ${rankCorr.toFixed(2)}).`;
  }

  return {
    datasets: datasetResults,
    overallSummary: {
      totalGenes,
      totalDatasets: datasetResults.length,
      ar2PreferredByAIC_pct: +ar2PctAIC.toFixed(1),
      ar2PreferredByBIC_pct: +ar2PctBIC.toFixed(1),
      ar1PreferredByAIC_pct: +(totalGenes > 0 ? (ar1AIC / totalGenes) * 100 : 0).toFixed(1),
      ar3PreferredByAIC_pct: +(totalGenes > 0 ? (ar3AIC / totalGenes) * 100 : 0).toFixed(1),
      meanDeltaAIC_ar2_vs_ar1: +meanDeltaAIC.toFixed(2),
      meanDeltaBIC_ar2_vs_ar1: +meanDeltaBIC.toFixed(2),
      hierarchyRobust: hierarchyAR1 === hierarchyAR2 && hierarchyAR2 === datasetResults.length,
      hierarchyAR1_count: hierarchyAR1,
      hierarchyAR2_count: hierarchyAR2,
      hierarchyAR3_count: hierarchyAR3,
      rankCorrelation_ar2_ar3: +rankCorr.toFixed(4),
      eigenvaluePairs,
    },
    conclusion,
    timestamp: new Date().toISOString(),
  };
}

function spearmanRankCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n < 3) return 0;
  const rankX = computeRanks(x);
  const rankY = computeRanks(y);
  let sumD2 = 0;
  for (let i = 0; i < n; i++) {
    const d = rankX[i] - rankY[i];
    sumD2 += d * d;
  }
  return 1 - (6 * sumD2) / (n * (n * n - 1));
}

function computeRanks(values: number[]): number[] {
  const indexed = values.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v);
  const ranks = new Array(values.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j < indexed.length && indexed[j].v === indexed[i].v) j++;
    const avgRank = (i + j - 1) / 2 + 1;
    for (let k = i; k < j; k++) ranks[indexed[k].i] = avgRank;
    i = j;
  }
  return ranks;
}
