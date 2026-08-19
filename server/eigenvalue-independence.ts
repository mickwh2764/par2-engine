import * as fs from 'fs';
import * as path from 'path';
import { generateProcessedTable, GeneResult } from './processed-tables';

export interface CosinorResult {
  amplitude: number;
  phase: number;
  mesor: number;
  rSquared: number;
}

export interface IndependenceResult {
  dataset: string;
  datasetId: string;
  totalGenes: number;
  stableGenes: number;
  correlations: {
    eigenvalue_vs_rSquared: { spearman: number; pValue: number; n: number };
    eigenvalue_vs_amplitude: { spearman: number; pValue: number; n: number };
    rSquared_vs_amplitude: { spearman: number; pValue: number; n: number };
  };
  clockGenesSummary: {
    n: number;
    meanEigenvalue: number;
    meanRSquared: number;
    meanAmplitude: number;
  };
  targetGenesSummary: {
    n: number;
    meanEigenvalue: number;
    meanRSquared: number;
    meanAmplitude: number;
  };
  scatterData: {
    gene: string;
    geneType: string;
    eigenvalue: number;
    rSquared: number;
    amplitude: number;
  }[];
  interpretation: string;
}

function fitCosinor(values: number[], period: number = 24, samplingInterval: number = 2): CosinorResult {
  const n = values.length;
  if (n < 4) return { amplitude: 0, phase: 0, mesor: 0, rSquared: 0 };

  const omega = (2 * Math.PI) / period;
  let sumY = 0, sumCos = 0, sumSin = 0;
  let sumCosCos = 0, sumSinSin = 0, sumCosSin = 0;
  let sumYCos = 0, sumYSin = 0;

  for (let i = 0; i < n; i++) {
    const t = i * samplingInterval;
    const c = Math.cos(omega * t);
    const s = Math.sin(omega * t);
    sumY += values[i];
    sumCos += c;
    sumSin += s;
    sumCosCos += c * c;
    sumSinSin += s * s;
    sumCosSin += c * s;
    sumYCos += values[i] * c;
    sumYSin += values[i] * s;
  }

  const A = [
    [n, sumCos, sumSin],
    [sumCos, sumCosCos, sumCosSin],
    [sumSin, sumCosSin, sumSinSin]
  ];
  const b = [sumY, sumYCos, sumYSin];

  const det = A[0][0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1])
            - A[0][1] * (A[1][0] * A[2][2] - A[1][2] * A[2][0])
            + A[0][2] * (A[1][0] * A[2][1] - A[1][1] * A[2][0]);

  if (Math.abs(det) < 1e-15) return { amplitude: 0, phase: 0, mesor: 0, rSquared: 0 };

  const invA = [
    [(A[1][1]*A[2][2]-A[1][2]*A[2][1])/det, (A[0][2]*A[2][1]-A[0][1]*A[2][2])/det, (A[0][1]*A[1][2]-A[0][2]*A[1][1])/det],
    [(A[1][2]*A[2][0]-A[1][0]*A[2][2])/det, (A[0][0]*A[2][2]-A[0][2]*A[2][0])/det, (A[0][2]*A[1][0]-A[0][0]*A[1][2])/det],
    [(A[1][0]*A[2][1]-A[1][1]*A[2][0])/det, (A[0][1]*A[2][0]-A[0][0]*A[2][1])/det, (A[0][0]*A[1][1]-A[0][1]*A[1][0])/det]
  ];

  const mesor = invA[0][0]*b[0] + invA[0][1]*b[1] + invA[0][2]*b[2];
  const beta  = invA[1][0]*b[0] + invA[1][1]*b[1] + invA[1][2]*b[2];
  const gamma = invA[2][0]*b[0] + invA[2][1]*b[1] + invA[2][2]*b[2];

  const amplitude = Math.sqrt(beta * beta + gamma * gamma);
  const phase = Math.atan2(-gamma, beta) * (period / (2 * Math.PI));

  let ssTot = 0, ssRes = 0;
  const meanY = sumY / n;
  for (let i = 0; i < n; i++) {
    const t = i * samplingInterval;
    const predicted = mesor + beta * Math.cos(omega * t) + gamma * Math.sin(omega * t);
    ssRes += (values[i] - predicted) ** 2;
    ssTot += (values[i] - meanY) ** 2;
  }
  const rSquared = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;

  return { amplitude, phase: phase < 0 ? phase + period : phase, mesor, rSquared };
}

function spearmanCorrelation(x: number[], y: number[]): { rho: number; pValue: number } {
  const n = x.length;
  if (n < 5) return { rho: 0, pValue: 1 };

  const rank = (arr: number[]) => {
    const indexed = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
    const ranks = new Array(n);
    for (let i = 0; i < n; ) {
      let j = i;
      while (j < n && indexed[j].v === indexed[i].v) j++;
      const avgRank = (i + 1 + j) / 2;
      for (let k = i; k < j; k++) ranks[indexed[k].i] = avgRank;
      i = j;
    }
    return ranks;
  };

  const rx = rank(x);
  const ry = rank(y);

  let sumD2 = 0;
  for (let i = 0; i < n; i++) {
    const d = rx[i] - ry[i];
    sumD2 += d * d;
  }

  const rho = 1 - (6 * sumD2) / (n * (n * n - 1));

  const t = rho * Math.sqrt((n - 2) / (1 - rho * rho + 1e-15));
  const df = n - 2;
  const pValue = 2 * tDistCDF(-Math.abs(t), df);

  return { rho: +rho.toFixed(4), pValue: Math.max(pValue, 1e-300) };
}

function tDistCDF(t: number, df: number): number {
  const x = df / (df + t * t);
  return 0.5 * incompleteBeta(x, df / 2, 0.5);
}

function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const maxIter = 200;
  const eps = 1e-10;
  let result = 0;
  let term = 1;
  for (let k = 0; k < maxIter; k++) {
    if (k === 0) {
      term = Math.pow(x, a) * Math.pow(1 - x, b) / (a * betaFunction(a, b));
      result = term;
    } else {
      term *= x * (a + b + k - 1) * (a + k - 1) / ((a + k) * k);
      if (Math.abs(term) < eps) break;
      result += term;
    }
  }
  return Math.min(1, Math.max(0, result));
}

function betaFunction(a: number, b: number): number {
  return Math.exp(lgamma(a) + lgamma(b) - lgamma(a + b));
}

function lgamma(x: number): number {
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7
  ];
  if (x < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
  }
  x -= 1;
  let a = c[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) {
    a += c[i] / (x + i);
  }
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

export function analyzeEigenvalueIndependence(
  datasetPath: string,
  datasetId: string,
  datasetName: string,
  samplingInterval: number = 2
): IndependenceResult {
  const content = fs.readFileSync(datasetPath, 'utf-8');
  const lines = content.trim().split('\n');
  if (lines.length < 2) throw new Error('Dataset too small');

  const arResults = generateProcessedTable(datasetPath);
  const stableResults = arResults.filter(r => r.stable);

  const ENSEMBL_TO_SYMBOL: Record<string, string> = {
    'ENSMUSG00000020893': 'Per1', 'ENSMUSG00000055866': 'Per2', 'ENSMUSG00000028957': 'Per3',
    'ENSMUSG00000020038': 'Cry1', 'ENSMUSG00000068742': 'Cry2',
    'ENSMUSG00000029238': 'Clock', 'ENSMUSG00000055116': 'Arntl',
    'ENSMUSG00000020889': 'Nr1d1', 'ENSMUSG00000021775': 'Nr1d2',
    'ENSMUSG00000032238': 'Rora', 'ENSMUSG00000028150': 'Rorc',
    'ENSMUSG00000059824': 'Dbp', 'ENSMUSG00000022389': 'Tef',
    'ENSMUSG00000022346': 'Myc', 'ENSMUSG00000070348': 'Ccnd1',
    'ENSMUSG00000041431': 'Ccnb1', 'ENSMUSG00000019942': 'Cdk1',
    'ENSMUSG00000031016': 'Wee1', 'ENSMUSG00000023067': 'Cdkn1a',
    'ENSMUSG00000020140': 'Lgr5', 'ENSMUSG00000000142': 'Axin2',
    'ENSMUSG00000006932': 'Ctnnb1', 'ENSMUSG00000005871': 'Apc',
    'ENSMUSG00000059552': 'Trp53', 'ENSMUSG00000020184': 'Mdm2',
    'ENSMUSG00000034218': 'Atm', 'ENSMUSG00000029521': 'Chek2',
    'ENSMUSG00000057329': 'Bcl2', 'ENSMUSG00000003873': 'Bax',
    'ENSMUSG00000000440': 'Pparg', 'ENSMUSG00000020063': 'Sirt1',
    'ENSMUSG00000021109': 'Hif1a', 'ENSMUSG00000026077': 'Npas2',
    'ENSMUSG00000002068': 'Ccne1', 'ENSMUSG00000028399': 'Ccne2',
    'ENSMUSG00000025544': 'Mcm6', 'ENSMUSG00000031004': 'Mki67',
  };

  const geneTimeSeries: Map<string, number[]> = new Map();
  const header = lines[0].split(',');
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts.length < 2) continue;
    const rawGeneId = parts[0].trim().replace(/"/g, '');
    if (!rawGeneId) continue;
    const values: number[] = [];
    for (let j = 1; j < parts.length; j++) {
      const v = parseFloat(parts[j]);
      if (!isNaN(v)) values.push(v);
    }
    if (values.length >= 4) {
      geneTimeSeries.set(rawGeneId, values);
      const symbol = ENSEMBL_TO_SYMBOL[rawGeneId];
      if (symbol) geneTimeSeries.set(symbol, values);
    }
  }

  const scatterData: { gene: string; geneType: string; eigenvalue: number; rSquared: number; amplitude: number }[] = [];
  const eigenvalues: number[] = [];
  const rSquareds: number[] = [];
  const amplitudes: number[] = [];

  for (const r of stableResults) {
    const rawGene = r.gene;
    const resolvedGene = ENSEMBL_TO_SYMBOL[rawGene] || rawGene;
    const ts = geneTimeSeries.get(rawGene) || geneTimeSeries.get(resolvedGene);
    if (!ts) continue;

    const cosinor = fitCosinor(ts, 24, samplingInterval);

    scatterData.push({
      gene: resolvedGene,
      geneType: r.geneType,
      eigenvalue: +r.eigenvalueModulus.toFixed(4),
      rSquared: +r.rSquared.toFixed(4),
      amplitude: +cosinor.amplitude.toFixed(4)
    });
    eigenvalues.push(r.eigenvalueModulus);
    rSquareds.push(r.rSquared);
    amplitudes.push(cosinor.amplitude);
  }

  const evVsR2 = spearmanCorrelation(eigenvalues, rSquareds);
  const evVsAmp = spearmanCorrelation(eigenvalues, amplitudes);
  const r2VsAmp = spearmanCorrelation(rSquareds, amplitudes);

  const clockData = scatterData.filter(d => d.geneType === 'clock');
  const targetData = scatterData.filter(d => d.geneType === 'target');

  const mean = (arr: number[]) => arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;

  const allCorrelationsWeak = Math.abs(evVsR2.rho) < 0.7 && Math.abs(evVsAmp.rho) < 0.7;
  const interpretation = allCorrelationsWeak
    ? `Eigenvalue |λ| is NOT redundant with R² (Spearman ρ=${evVsR2.rho}) or Cosinor amplitude (ρ=${evVsAmp.rho}). These metrics capture distinct properties of gene expression dynamics. |λ| measures temporal persistence/memory, R² measures AR(2) model fit quality, and amplitude measures oscillation strength. The low correlations confirm that the eigenvalue hierarchy provides information beyond what existing rhythmicity measures offer.`
    : `Eigenvalue |λ| shows moderate-to-strong correlation with R² (ρ=${evVsR2.rho}) and/or amplitude (ρ=${evVsAmp.rho}). Partial redundancy exists, but the metrics are not identical — |λ| still captures unique variance in temporal dynamics.`;

  return {
    dataset: datasetName,
    datasetId,
    totalGenes: arResults.length,
    stableGenes: stableResults.length,
    correlations: {
      eigenvalue_vs_rSquared: { spearman: evVsR2.rho, pValue: evVsR2.pValue, n: eigenvalues.length },
      eigenvalue_vs_amplitude: { spearman: evVsAmp.rho, pValue: evVsAmp.pValue, n: eigenvalues.length },
      rSquared_vs_amplitude: { spearman: r2VsAmp.rho, pValue: r2VsAmp.pValue, n: eigenvalues.length }
    },
    clockGenesSummary: {
      n: clockData.length,
      meanEigenvalue: +mean(clockData.map(d => d.eigenvalue)).toFixed(4),
      meanRSquared: +mean(clockData.map(d => d.rSquared)).toFixed(4),
      meanAmplitude: +mean(clockData.map(d => d.amplitude)).toFixed(4)
    },
    targetGenesSummary: {
      n: targetData.length,
      meanEigenvalue: +mean(targetData.map(d => d.eigenvalue)).toFixed(4),
      meanRSquared: +mean(targetData.map(d => d.rSquared)).toFixed(4),
      meanAmplitude: +mean(targetData.map(d => d.amplitude)).toFixed(4)
    },
    scatterData: scatterData.filter(d => d.geneType !== 'other').concat(
      scatterData.filter(d => d.geneType === 'other').slice(0, 500)
    ),
    interpretation
  };
}

export interface TissueProliferationCorrelation {
  tissues: {
    tissue: string;
    gap: number;
    clockMeanEV: number;
    targetMeanEV: number;
    proliferationIndex: number;
    proliferationSource: string;
    nGenes: number;
  }[];
  correlation: {
    gapVsProliferation: { spearman: number; pValue: number; n: number };
    interpretation: string;
  };
}

const MOUSE_TISSUE_PROLIFERATION: Record<string, { index: number; source: string }> = {
  'Liver': { index: 0.005, source: 'Hepatocyte turnover ~200-400d, ~0.5% Ki67+ (Magami 2002, Macdonald 1961)' },
  'Heart': { index: 0.001, source: 'Cardiomyocyte turnover ~1%/yr, 0.04% Ki67+ (Bergmann 2009, Ali 2014)' },
  'Kidney': { index: 0.003, source: 'Low baseline tubular proliferation (Humphreys 2008)' },
  'Lung': { index: 0.004, source: 'Baseline LI 0.2-0.4%, Clara/Type II cells (toxicology studies)' },
  'Cerebellum': { index: 0.0001, source: 'Post-mitotic neurons, essentially no turnover (consensus)' },
  'Hypothalamus': { index: 0.0001, source: 'Post-mitotic neurons, minimal neurogenesis (consensus)' },
  'Brainstem': { index: 0.0001, source: 'Post-mitotic neurons, no turnover (consensus)' },
  'Muscle': { index: 0.0005, source: 'Satellite cell activation rare at baseline (Charge & Rudnicki 2004)' },
  'Adrenal': { index: 0.01, source: 'Adrenal cortex zone migration, moderate turnover (Freedman 2013)' },
  'Aorta': { index: 0.001, source: 'Endothelial turnover ~0.1%/day (Schwartz & Benditt 1977)' },
  'Brown_Fat': { index: 0.002, source: 'Adipocyte precursor turnover (Spalding 2008)' },
  'White_Fat': { index: 0.002, source: 'Adipocyte turnover ~10%/yr (Spalding 2008)' },
};

export function analyzeGapVsProliferation(datasetsDir: string): TissueProliferationCorrelation {
  const tissues: TissueProliferationCorrelation['tissues'] = [];

  for (const [tissue, prolif] of Object.entries(MOUSE_TISSUE_PROLIFERATION)) {
    const fileName = `GSE54650_${tissue}_circadian.csv`;
    const filePath = path.join(datasetsDir, fileName);
    if (!fs.existsSync(filePath)) continue;

    try {
      const results = generateProcessedTable(filePath);
      const stable = results.filter(r => r.stable);
      const clock = stable.filter(r => r.geneType === 'clock');
      const target = stable.filter(r => r.geneType === 'target');

      if (clock.length === 0 || target.length === 0) continue;

      const meanClock = clock.reduce((s, r) => s + r.eigenvalueModulus, 0) / clock.length;
      const meanTarget = target.reduce((s, r) => s + r.eigenvalueModulus, 0) / target.length;

      tissues.push({
        tissue,
        gap: +(meanClock - meanTarget).toFixed(4),
        clockMeanEV: +meanClock.toFixed(4),
        targetMeanEV: +meanTarget.toFixed(4),
        proliferationIndex: prolif.index,
        proliferationSource: prolif.source,
        nGenes: stable.length
      });
    } catch (e) {
      continue;
    }
  }

  const gaps = tissues.map(t => t.gap);
  const prolifs = tissues.map(t => t.proliferationIndex);
  const corr = spearmanCorrelation(gaps, prolifs);

  const significant = corr.pValue < 0.05;
  const interpretation = significant
    ? `The eigenvalue gap (clock minus target |λ|) correlates significantly with tissue proliferation rate (Spearman ρ=${corr.rho}, p=${corr.pValue.toExponential(2)}, n=${tissues.length} tissues). This supports the hypothesis that the clock-target persistence hierarchy is functionally linked to proliferative capacity: tissues with stronger circadian gating show different proliferative dynamics.`
    : `The eigenvalue gap does not correlate significantly with tissue proliferation rate (Spearman ρ=${corr.rho}, p=${corr.pValue.toFixed(3)}, n=${tissues.length} tissues). The persistence hierarchy may reflect circadian regulatory strength rather than proliferative capacity per se. This null result is itself informative — it suggests the eigenvalue hierarchy captures circadian network integrity independently of tissue turnover rate.`;

  return {
    tissues,
    correlation: {
      gapVsProliferation: { spearman: corr.rho, pValue: corr.pValue, n: tissues.length },
      interpretation
    }
  };
}
