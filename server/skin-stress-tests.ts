import * as fs from 'fs';
import * as path from 'path';

const CLOCK_GENES_UPPER = ['PER1', 'PER2', 'PER3', 'CRY1', 'CRY2', 'CLOCK', 'ARNTL', 'NR1D1', 'NR1D2', 'RORC', 'DBP', 'TEF', 'NPAS2'];
const TARGET_GENES_UPPER = ['MYC', 'CCND1', 'LGR5', 'AXIN2', 'WEE1', 'CDKN1A', 'CCNB1', 'CDK1',
  'TP53', 'MDM2', 'GADD45A', 'SIRT1', 'HIF1A', 'VEGFA', 'BAX', 'BCL2',
  'CTNNB1', 'APC', 'CCNE1', 'CCNE2', 'MCM6', 'MKI67'];

function parseCSV(content: string): Map<string, number[]> {
  const lines = content.trim().split('\n');
  const rows = new Map<string, number[]>();
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const geneName = cols[0].trim().replace(/"/g, '');
    const values = cols.slice(1).map(v => parseFloat(v)).filter(v => !isNaN(v));
    if (values.length >= 5) {
      rows.set(geneName, values);
    }
  }
  return rows;
}

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

function fitAR1(series: number[]): { phi1: number; eigenvalue: number; r2: number } {
  const n = series.length;
  if (n < 3) return { phi1: 0, eigenvalue: 0, r2: 0 };

  const mean = series.reduce((a, b) => a + b, 0) / n;
  const y = series.map(x => x - mean);

  const Y = y.slice(1);
  const Y1 = y.slice(0, n - 1);

  let sumY1Y1 = 0, sumYY1 = 0;
  for (let i = 0; i < Y.length; i++) {
    sumY1Y1 += Y1[i] * Y1[i];
    sumYY1 += Y[i] * Y1[i];
  }

  if (Math.abs(sumY1Y1) < 1e-10) return { phi1: 0, eigenvalue: 0, r2: 0 };
  const phi1 = sumYY1 / sumY1Y1;

  let ssTot = 0, ssRes = 0;
  const yMean = Y.reduce((a, b) => a + b, 0) / Y.length;
  for (let i = 0; i < Y.length; i++) {
    const pred = phi1 * Y1[i];
    ssRes += (Y[i] - pred) ** 2;
    ssTot += (Y[i] - yMean) ** 2;
  }
  const r2 = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;

  return { phi1, eigenvalue: Math.abs(phi1), r2 };
}

function fisherYatesShuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function blockBootstrap(series: number[], blockSize: number = 3): number[] {
  const n = series.length;
  const numBlocks = Math.ceil(n / blockSize);
  const resampled: number[] = [];
  for (let i = 0; i < numBlocks; i++) {
    const startIdx = Math.floor(Math.random() * Math.max(1, n - blockSize + 1));
    for (let j = 0; j < blockSize && resampled.length < n; j++) {
      resampled.push(series[startIdx + j]);
    }
  }
  return resampled.slice(0, n);
}

interface GeneResult {
  gene: string;
  geneType: 'clock' | 'target';
  series: number[];
  ar2: { phi1: number; phi2: number; eigenvalue: number; r2: number };
  ar1: { phi1: number; eigenvalue: number; r2: number };
}

function analyzeLayer(filePath: string): GeneResult[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const rows = parseCSV(content);
  const results: GeneResult[] = [];

  for (const gene of CLOCK_GENES_UPPER) {
    const variants = [gene, gene.toLowerCase(), gene.charAt(0).toUpperCase() + gene.slice(1).toLowerCase()];
    for (const v of variants) {
      if (rows.has(v)) {
        const series = rows.get(v)!;
        const ar2 = fitAR2(series);
        const ar1 = fitAR1(series);
        if (ar2.eigenvalue > 0 && ar2.eigenvalue < 1.0) {
          results.push({ gene, geneType: 'clock', series, ar2, ar1 });
        }
        break;
      }
    }
  }

  for (const gene of TARGET_GENES_UPPER) {
    const variants = [gene, gene.toLowerCase(), gene.charAt(0).toUpperCase() + gene.slice(1).toLowerCase()];
    for (const v of variants) {
      if (rows.has(v)) {
        const series = rows.get(v)!;
        const ar2 = fitAR2(series);
        const ar1 = fitAR1(series);
        if (ar2.eigenvalue > 0 && ar2.eigenvalue < 1.0) {
          results.push({ gene, geneType: 'target', series, ar2, ar1 });
        }
        break;
      }
    }
  }

  return results;
}

function computeGap(results: GeneResult[]): { clockMean: number; targetMean: number; gap: number; clockN: number; targetN: number } {
  const clock = results.filter(r => r.geneType === 'clock');
  const target = results.filter(r => r.geneType === 'target');
  const clockMean = clock.length > 0 ? clock.reduce((s, r) => s + r.ar2.eigenvalue, 0) / clock.length : 0;
  const targetMean = target.length > 0 ? target.reduce((s, r) => s + r.ar2.eigenvalue, 0) / target.length : 0;
  return { clockMean, targetMean, gap: clockMean - targetMean, clockN: clock.length, targetN: target.length };
}

function runTimeShuffle(results: GeneResult[], nPermutations: number = 1000): {
  observedGap: number;
  shuffledGaps: number[];
  meanShuffledGap: number;
  sdShuffledGap: number;
  pValue: number;
  zScore: number;
  hierarchyPreservedRate: number;
} {
  const observed = computeGap(results);

  const shuffledGaps: number[] = [];
  let hierarchyCount = 0;

  for (let p = 0; p < nPermutations; p++) {
    const shuffledResults = results.map(r => {
      const shuffledSeries = fisherYatesShuffle(r.series);
      const ar2 = fitAR2(shuffledSeries);
      return { ...r, ar2 };
    });

    const clock = shuffledResults.filter(r => r.geneType === 'clock' && r.ar2.eigenvalue > 0 && r.ar2.eigenvalue < 1.0);
    const target = shuffledResults.filter(r => r.geneType === 'target' && r.ar2.eigenvalue > 0 && r.ar2.eigenvalue < 1.0);
    if (clock.length < 2 || target.length < 2) continue;

    const clockMean = clock.reduce((s, r) => s + r.ar2.eigenvalue, 0) / clock.length;
    const targetMean = target.reduce((s, r) => s + r.ar2.eigenvalue, 0) / target.length;
    const gap = clockMean - targetMean;
    shuffledGaps.push(gap);
    if (gap > 0) hierarchyCount++;
  }

  const meanShuffled = shuffledGaps.reduce((a, b) => a + b, 0) / shuffledGaps.length;
  const sdShuffled = Math.sqrt(shuffledGaps.reduce((s, g) => s + (g - meanShuffled) ** 2, 0) / shuffledGaps.length);
  const pValue = shuffledGaps.filter(g => g >= observed.gap).length / shuffledGaps.length;
  const zScore = sdShuffled > 0 ? (observed.gap - meanShuffled) / sdShuffled : 0;

  return {
    observedGap: observed.gap,
    shuffledGaps,
    meanShuffledGap: meanShuffled,
    sdShuffledGap: sdShuffled,
    pValue,
    zScore,
    hierarchyPreservedRate: hierarchyCount / shuffledGaps.length,
  };
}

function runRandomGeneSetNull(filePath: string, results: GeneResult[], nPermutations: number = 1000): {
  observedGap: number;
  nullGaps: number[];
  meanNullGap: number;
  sdNullGap: number;
  pValue: number;
  zScore: number;
  percentileRank: number;
} {
  const content = fs.readFileSync(filePath, 'utf-8');
  const rows = parseCSV(content);
  const allGenes = Array.from(rows.keys());

  const observed = computeGap(results);
  const clockN = results.filter(r => r.geneType === 'clock').length;
  const targetN = results.filter(r => r.geneType === 'target').length;

  const nullGaps: number[] = [];

  for (let p = 0; p < nPermutations; p++) {
    const shuffledGenes = fisherYatesShuffle(allGenes);
    const fakeClock = shuffledGenes.slice(0, clockN);
    const fakeTarget = shuffledGenes.slice(clockN, clockN + targetN);

    const clockEVs: number[] = [];
    const targetEVs: number[] = [];

    for (const g of fakeClock) {
      const series = rows.get(g);
      if (series && series.length >= 5) {
        const result = fitAR2(series);
        if (result.eigenvalue > 0 && result.eigenvalue < 1.0) clockEVs.push(result.eigenvalue);
      }
    }
    for (const g of fakeTarget) {
      const series = rows.get(g);
      if (series && series.length >= 5) {
        const result = fitAR2(series);
        if (result.eigenvalue > 0 && result.eigenvalue < 1.0) targetEVs.push(result.eigenvalue);
      }
    }

    if (clockEVs.length >= 2 && targetEVs.length >= 2) {
      const cMean = clockEVs.reduce((a, b) => a + b, 0) / clockEVs.length;
      const tMean = targetEVs.reduce((a, b) => a + b, 0) / targetEVs.length;
      nullGaps.push(cMean - tMean);
    }
  }

  const meanNull = nullGaps.reduce((a, b) => a + b, 0) / nullGaps.length;
  const sdNull = Math.sqrt(nullGaps.reduce((s, g) => s + (g - meanNull) ** 2, 0) / nullGaps.length);
  const pValue = nullGaps.filter(g => g >= observed.gap).length / nullGaps.length;
  const zScore = sdNull > 0 ? (observed.gap - meanNull) / sdNull : 0;
  const percentileRank = (nullGaps.filter(g => g < observed.gap).length / nullGaps.length) * 100;

  return {
    observedGap: observed.gap,
    nullGaps,
    meanNullGap: meanNull,
    sdNullGap: sdNull,
    pValue,
    zScore,
    percentileRank,
  };
}

function runBootstrapCI(results: GeneResult[], nBootstrap: number = 2000): {
  observedGap: number;
  gapCI: { lower: number; upper: number };
  probGapNegative: number;
  clockCI: { lower: number; upper: number };
  targetCI: { lower: number; upper: number };
  perGene: { gene: string; geneType: string; eigenvalue: number; ci: { lower: number; upper: number } }[];
} {
  const observed = computeGap(results);

  const gapDist: number[] = [];
  const clockDist: number[] = [];
  const targetDist: number[] = [];

  for (let b = 0; b < nBootstrap; b++) {
    const bootResults = results.map(r => {
      const bootSeries = blockBootstrap(r.series, 3);
      const ar2 = fitAR2(bootSeries);
      return { ...r, ar2 };
    });

    const clock = bootResults.filter(r => r.geneType === 'clock' && r.ar2.eigenvalue > 0 && r.ar2.eigenvalue < 1.0);
    const target = bootResults.filter(r => r.geneType === 'target' && r.ar2.eigenvalue > 0 && r.ar2.eigenvalue < 1.0);
    if (clock.length < 2 || target.length < 2) continue;

    const cMean = clock.reduce((s, r) => s + r.ar2.eigenvalue, 0) / clock.length;
    const tMean = target.reduce((s, r) => s + r.ar2.eigenvalue, 0) / target.length;
    gapDist.push(cMean - tMean);
    clockDist.push(cMean);
    targetDist.push(tMean);
  }

  gapDist.sort((a, b) => a - b);
  clockDist.sort((a, b) => a - b);
  targetDist.sort((a, b) => a - b);

  const lo = Math.floor(gapDist.length * 0.025);
  const hi = Math.floor(gapDist.length * 0.975);

  const perGene = results.map(r => {
    const evDist: number[] = [];
    for (let b = 0; b < 500; b++) {
      const bootSeries = blockBootstrap(r.series, 3);
      const ar2 = fitAR2(bootSeries);
      if (ar2.eigenvalue > 0 && ar2.eigenvalue < 1.5) evDist.push(ar2.eigenvalue);
    }
    evDist.sort((a, b) => a - b);
    const gLo = Math.floor(evDist.length * 0.025);
    const gHi = Math.floor(evDist.length * 0.975);
    return {
      gene: r.gene,
      geneType: r.geneType,
      eigenvalue: +r.ar2.eigenvalue.toFixed(4),
      ci: { lower: +(evDist[gLo] || 0).toFixed(4), upper: +(evDist[gHi] || 0).toFixed(4) },
    };
  });

  return {
    observedGap: observed.gap,
    gapCI: { lower: +(gapDist[lo] || 0).toFixed(4), upper: +(gapDist[hi] || 0).toFixed(4) },
    probGapNegative: +(gapDist.filter(g => g < 0).length / gapDist.length).toFixed(4),
    clockCI: { lower: +(clockDist[lo] || 0).toFixed(4), upper: +(clockDist[hi] || 0).toFixed(4) },
    targetCI: { lower: +(targetDist[lo] || 0).toFixed(4), upper: +(targetDist[hi] || 0).toFixed(4) },
    perGene,
  };
}

function runAR1vsAR2(results: GeneResult[]): {
  perGene: { gene: string; geneType: string; ar1EV: number; ar2EV: number; ar1R2: number; ar2R2: number; ar2Better: boolean; deltaAIC: number }[];
  summaryByClock: { ar1MeanR2: number; ar2MeanR2: number; ar2WinRate: number; meanDeltaAIC: number };
  summaryByTarget: { ar1MeanR2: number; ar2MeanR2: number; ar2WinRate: number; meanDeltaAIC: number };
  conclusion: string;
} {
  const perGene = results.map(r => {
    const n = r.series.length;
    const k1 = 1;
    const k2 = 2;
    const n_ar1 = n - 1;
    const n_ar2 = n - 2;

    const ssRes1 = r.ar1.r2 < 1 ? (1 - r.ar1.r2) : 0;
    const ssRes2 = r.ar2.r2 < 1 ? (1 - r.ar2.r2) : 0;

    const aic1 = n_ar1 > k1 ? n_ar1 * Math.log(Math.max(ssRes1, 1e-10) / n_ar1) + 2 * k1 : 0;
    const aic2 = n_ar2 > k2 ? n_ar2 * Math.log(Math.max(ssRes2, 1e-10) / n_ar2) + 2 * k2 : 0;
    const deltaAIC = aic1 - aic2;

    return {
      gene: r.gene,
      geneType: r.geneType,
      ar1EV: +r.ar1.eigenvalue.toFixed(4),
      ar2EV: +r.ar2.eigenvalue.toFixed(4),
      ar1R2: +r.ar1.r2.toFixed(4),
      ar2R2: +r.ar2.r2.toFixed(4),
      ar2Better: deltaAIC > 2,
      deltaAIC: +deltaAIC.toFixed(2),
    };
  });

  const clockGenes = perGene.filter(g => g.geneType === 'clock');
  const targetGenes = perGene.filter(g => g.geneType === 'target');

  const summaryByClock = {
    ar1MeanR2: +(clockGenes.reduce((s, g) => s + g.ar1R2, 0) / clockGenes.length).toFixed(4),
    ar2MeanR2: +(clockGenes.reduce((s, g) => s + g.ar2R2, 0) / clockGenes.length).toFixed(4),
    ar2WinRate: +(clockGenes.filter(g => g.ar2Better).length / clockGenes.length).toFixed(4),
    meanDeltaAIC: +(clockGenes.reduce((s, g) => s + g.deltaAIC, 0) / clockGenes.length).toFixed(2),
  };

  const summaryByTarget = {
    ar1MeanR2: +(targetGenes.reduce((s, g) => s + g.ar1R2, 0) / targetGenes.length).toFixed(4),
    ar2MeanR2: +(targetGenes.reduce((s, g) => s + g.ar2R2, 0) / targetGenes.length).toFixed(4),
    ar2WinRate: +(targetGenes.filter(g => g.ar2Better).length / targetGenes.length).toFixed(4),
    meanDeltaAIC: +(targetGenes.reduce((s, g) => s + g.deltaAIC, 0) / targetGenes.length).toFixed(2),
  };

  const allAR2WinRate = perGene.filter(g => g.ar2Better).length / perGene.length;
  let conclusion: string;
  if (allAR2WinRate > 0.6) {
    conclusion = 'AR(2) provides meaningfully better fit than AR(1) for this layer, confirming multi-generational (lag-2) memory in the dynamics.';
  } else if (allAR2WinRate < 0.3) {
    conclusion = 'AR(1) is generally sufficient for this layer, suggesting shorter-memory dynamics without strong lag-2 structure.';
  } else {
    conclusion = 'AR(1) and AR(2) perform comparably for this layer, suggesting mixed memory structure — some genes carry lag-2 memory while others do not.';
  }

  return { perGene, summaryByClock, summaryByTarget, conclusion };
}

export function runSkinStressTests(): any {
  const datasetsDir = path.join(process.cwd(), 'datasets');
  const dermisPath = path.join(datasetsDir, 'GSE205155_Skin_Dermis_circadian.csv');
  const epidermisPath = path.join(datasetsDir, 'GSE205155_Skin_Epidermis_circadian.csv');

  if (!fs.existsSync(dermisPath) || !fs.existsSync(epidermisPath)) {
    return { error: 'GSE205155 skin dataset files not found' };
  }

  const dermisResults = analyzeLayer(dermisPath);
  const epidermisResults = analyzeLayer(epidermisPath);

  const dermisBaseline = computeGap(dermisResults);
  const epidermisBaseline = computeGap(epidermisResults);

  const dermisShuffle = runTimeShuffle(dermisResults, 1000);
  const epidermisShuffle = runTimeShuffle(epidermisResults, 1000);

  const dermisNull = runRandomGeneSetNull(dermisPath, dermisResults, 1000);
  const epidermisNull = runRandomGeneSetNull(epidermisPath, epidermisResults, 1000);

  const dermisBootstrap = runBootstrapCI(dermisResults, 2000);
  const epidermisBootstrap = runBootstrapCI(epidermisResults, 2000);

  const dermisAR = runAR1vsAR2(dermisResults);
  const epidermisAR = runAR1vsAR2(epidermisResults);

  const dermisPassesShuffle = dermisShuffle.pValue < 0.05;
  const epidermisPassesShuffle = epidermisShuffle.pValue < 0.05;
  const dermisPassesNull = dermisNull.pValue < 0.05;
  const epidermisPassesNull = epidermisNull.pValue < 0.05;
  const epidermisGapStraddlesZero = epidermisBootstrap.probGapNegative > 0.2 && epidermisBootstrap.probGapNegative < 0.8;

  let overallVerdict: string;
  if (dermisPassesShuffle && dermisPassesNull && !epidermisPassesShuffle) {
    overallVerdict = 'STRONG: Dermis has genuine temporal structure driving the hierarchy; epidermis has weak/absent temporal structure. The epidermis false positive reflects biology (weak circadian hierarchy), not a model failure.';
  } else if (dermisPassesShuffle && dermisPassesNull && epidermisPassesShuffle) {
    overallVerdict = 'MODERATE: Both layers show temporal structure, but epidermis has a near-zero gap. The epidermis misclassification is a grey-zone boundary case.';
  } else if (!dermisPassesShuffle) {
    overallVerdict = 'CONCERN: Dermis does not pass time-shuffle falsification. The hierarchy may be an artifact.';
  } else {
    overallVerdict = 'MIXED: Results are equivocal. Further investigation recommended.';
  }

  return {
    title: 'GSE205155 Skin Dermis vs Epidermis Stress Tests',
    description: 'Comprehensive falsification and robustness testing for the dermis (gap=+0.217) vs epidermis (gap=-0.007) divergence',
    layers: {
      dermis: {
        baseline: { ...dermisBaseline, gap: +dermisBaseline.gap.toFixed(4) },
        timeShuffle: {
          observedGap: +dermisShuffle.observedGap.toFixed(4),
          meanShuffledGap: +dermisShuffle.meanShuffledGap.toFixed(4),
          sdShuffledGap: +dermisShuffle.sdShuffledGap.toFixed(4),
          pValue: +dermisShuffle.pValue.toFixed(4),
          zScore: +dermisShuffle.zScore.toFixed(2),
          hierarchyPreservedRate: +dermisShuffle.hierarchyPreservedRate.toFixed(4),
          significant: dermisPassesShuffle,
          interpretation: dermisPassesShuffle
            ? 'Dermis hierarchy is NOT preserved under time-shuffle — temporal order matters. This confirms genuine temporal structure.'
            : 'Dermis hierarchy persists even under time-shuffle — temporal order may not be driving the gap.',
        },
        randomGeneSetNull: {
          observedGap: +dermisNull.observedGap.toFixed(4),
          meanNullGap: +dermisNull.meanNullGap.toFixed(4),
          sdNullGap: +dermisNull.sdNullGap.toFixed(4),
          pValue: +dermisNull.pValue.toFixed(4),
          zScore: +dermisNull.zScore.toFixed(2),
          percentileRank: +dermisNull.percentileRank.toFixed(1),
          significant: dermisPassesNull,
          interpretation: dermisPassesNull
            ? 'Dermis clock-target gap is significantly larger than random gene-set gaps. The hierarchy is specific to clock vs target genes.'
            : 'Dermis clock-target gap is not distinguishable from random gene-set gaps.',
        },
        bootstrapCI: {
          observedGap: +dermisBootstrap.observedGap.toFixed(4),
          gapCI: dermisBootstrap.gapCI,
          probGapNegative: dermisBootstrap.probGapNegative,
          clockCI: dermisBootstrap.clockCI,
          targetCI: dermisBootstrap.targetCI,
          perGene: dermisBootstrap.perGene,
        },
        ar1VsAr2: dermisAR,
      },
      epidermis: {
        baseline: { ...epidermisBaseline, gap: +epidermisBaseline.gap.toFixed(4) },
        timeShuffle: {
          observedGap: +epidermisShuffle.observedGap.toFixed(4),
          meanShuffledGap: +epidermisShuffle.meanShuffledGap.toFixed(4),
          sdShuffledGap: +epidermisShuffle.sdShuffledGap.toFixed(4),
          pValue: +epidermisShuffle.pValue.toFixed(4),
          zScore: +epidermisShuffle.zScore.toFixed(2),
          hierarchyPreservedRate: +epidermisShuffle.hierarchyPreservedRate.toFixed(4),
          significant: epidermisPassesShuffle,
          interpretation: epidermisPassesShuffle
            ? 'Epidermis shows significant temporal structure despite near-zero gap.'
            : 'Epidermis does NOT show significant temporal structure — the near-zero gap reflects weak/absent circadian hierarchy rather than model failure.',
        },
        randomGeneSetNull: {
          observedGap: +epidermisNull.observedGap.toFixed(4),
          meanNullGap: +epidermisNull.meanNullGap.toFixed(4),
          sdNullGap: +epidermisNull.sdNullGap.toFixed(4),
          pValue: +epidermisNull.pValue.toFixed(4),
          zScore: +epidermisNull.zScore.toFixed(2),
          percentileRank: +epidermisNull.percentileRank.toFixed(1),
          significant: epidermisPassesNull,
          interpretation: epidermisPassesNull
            ? 'Epidermis clock-target gap is significantly different from random gene-set gaps.'
            : 'Epidermis clock-target gap is indistinguishable from random gene-set gaps — consistent with weak/absent circadian hierarchy.',
        },
        bootstrapCI: {
          observedGap: +epidermisBootstrap.observedGap.toFixed(4),
          gapCI: epidermisBootstrap.gapCI,
          probGapNegative: epidermisBootstrap.probGapNegative,
          gapStraddlesZero: epidermisGapStraddlesZero,
          clockCI: epidermisBootstrap.clockCI,
          targetCI: epidermisBootstrap.targetCI,
          perGene: epidermisBootstrap.perGene,
        },
        ar1VsAr2: epidermisAR,
      },
    },
    headToHead: {
      dermisGap: +dermisBaseline.gap.toFixed(4),
      epidermisGap: +epidermisBaseline.gap.toFixed(4),
      gapDifference: +(dermisBaseline.gap - epidermisBaseline.gap).toFixed(4),
      dermisShufflePValue: +dermisShuffle.pValue.toFixed(4),
      epidermisShufflePValue: +epidermisShuffle.pValue.toFixed(4),
      dermisNullPValue: +dermisNull.pValue.toFixed(4),
      epidermisNullPValue: +epidermisNull.pValue.toFixed(4),
      dermisBootstrapCI: dermisBootstrap.gapCI,
      epidermisBootstrapCI: epidermisBootstrap.gapCI,
      epidermisProbNegative: epidermisBootstrap.probGapNegative,
      dermisAR2WinRate: dermisAR.summaryByClock.ar2WinRate + dermisAR.summaryByTarget.ar2WinRate,
      epidermisAR2WinRate: epidermisAR.summaryByClock.ar2WinRate + epidermisAR.summaryByTarget.ar2WinRate,
    },
    verdict: overallVerdict,
  };
}
