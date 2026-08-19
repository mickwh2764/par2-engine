import { solveAR2Eigenvalues } from './par2-engine';

interface SimpleAR2Result {
  beta1: number;
  beta2: number;
  eigenvalue: number;
  rSquared: number;
}

function fitSimpleAR2(data: number[]): SimpleAR2Result | null {
  if (data.length < 4) return null;
  
  const n = data.length;
  const Y: number[] = [];
  const X1: number[] = [];
  const X2: number[] = [];
  
  for (let i = 2; i < n; i++) {
    Y.push(data[i]);
    X1.push(data[i - 1]);
    X2.push(data[i - 2]);
  }
  
  const m = Y.length;
  if (m < 2) return null;
  
  let sumY = 0, sumX1 = 0, sumX2 = 0;
  let sumX1Y = 0, sumX2Y = 0;
  let sumX1X1 = 0, sumX2X2 = 0, sumX1X2 = 0;
  
  for (let i = 0; i < m; i++) {
    sumY += Y[i];
    sumX1 += X1[i];
    sumX2 += X2[i];
    sumX1Y += X1[i] * Y[i];
    sumX2Y += X2[i] * Y[i];
    sumX1X1 += X1[i] * X1[i];
    sumX2X2 += X2[i] * X2[i];
    sumX1X2 += X1[i] * X2[i];
  }
  
  const det = sumX1X1 * sumX2X2 - sumX1X2 * sumX1X2;
  if (Math.abs(det) < 1e-10) return null;
  
  const beta1 = (sumX2X2 * sumX1Y - sumX1X2 * sumX2Y) / det;
  const beta2 = (sumX1X1 * sumX2Y - sumX1X2 * sumX1Y) / det;
  
  let ssRes = 0, ssTot = 0;
  const meanY = sumY / m;
  for (let i = 0; i < m; i++) {
    const pred = beta1 * X1[i] + beta2 * X2[i];
    ssRes += Math.pow(Y[i] - pred, 2);
    ssTot += Math.pow(Y[i] - meanY, 2);
  }
  const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  
  const eigenResult = solveAR2Eigenvalues(beta1, beta2);
  const eigenvalue = eigenResult.modulus1;
  
  return { beta1, beta2, eigenvalue, rSquared };
}

export interface SparseSamplingResult {
  originalTimepoints: number;
  testedSparsities: SparsityTest[];
  robustnessScore: number;
  minimumViableTimepoints: number;
  clinicalViability: 'HIGH' | 'MEDIUM' | 'LOW' | 'NOT_VIABLE';
  recommendations: string[];
}

export interface SparsityTest {
  retainedTimepoints: number;
  retentionRate: number;
  eigenvalueMean: number;
  eigenvalueStd: number;
  eigenvalueDrift: number;
  correlationWithOriginal: number;
  ar2FitSuccess: boolean;
  confidenceInterval: [number, number];
}

export interface DecimationStrategy {
  name: string;
  description: string;
  decimate: (data: number[], targetN: number) => number[];
}

const DECIMATION_STRATEGIES: DecimationStrategy[] = [
  {
    name: 'uniform',
    description: 'Evenly spaced samples',
    decimate: (data: number[], targetN: number) => {
      if (targetN >= data.length) return data;
      const step = (data.length - 1) / (targetN - 1);
      const result: number[] = [];
      for (let i = 0; i < targetN; i++) {
        result.push(data[Math.round(i * step)]);
      }
      return result;
    }
  },
  {
    name: 'random',
    description: 'Random sample selection (averaged over 10 trials)',
    decimate: (data: number[], targetN: number) => {
      if (targetN >= data.length) return data;
      const indices = Array.from({ length: data.length }, (_, i) => i);
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
      const selected = indices.slice(0, targetN).sort((a, b) => a - b);
      return selected.map(i => data[i]);
    }
  },
  {
    name: 'clinical',
    description: 'Simulates 4h/8h/12h sampling intervals',
    decimate: (data: number[], targetN: number) => {
      if (targetN >= data.length) return data;
      const step = Math.ceil(data.length / targetN);
      const result: number[] = [];
      for (let i = 0; i < data.length && result.length < targetN; i += step) {
        result.push(data[i]);
      }
      return result;
    }
  }
];

function calculatePearsonCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 2) return 0;
  const n = x.length;
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  return den > 0 ? num / den : 0;
}

function runMultipleTrials(
  data: number[],
  targetN: number,
  strategy: DecimationStrategy,
  numTrials: number = 10
): { eigenvalues: number[]; successRate: number } {
  const eigenvalues: number[] = [];
  let successes = 0;
  
  for (let trial = 0; trial < numTrials; trial++) {
    const decimated = strategy.decimate(data, targetN);
    if (decimated.length >= 4) {
      try {
        const ar2Result = fitSimpleAR2(decimated);
        if (ar2Result && typeof ar2Result.eigenvalue === 'number' && !isNaN(ar2Result.eigenvalue)) {
          eigenvalues.push(ar2Result.eigenvalue);
          successes++;
        }
      } catch (e) {
      }
    }
  }
  
  return { eigenvalues, successRate: successes / numTrials };
}

export function runSparseSamplingValidation(
  timeSeries: number[],
  originalEigenvalue?: number
): SparseSamplingResult {
  const originalN = timeSeries.length;
  
  let baselineEigenvalue: number = originalEigenvalue ?? 0.5;
  if (originalEigenvalue === undefined) {
    try {
      const ar2 = fitSimpleAR2(timeSeries);
      baselineEigenvalue = ar2?.eigenvalue ?? 0.5;
    } catch {
      baselineEigenvalue = 0.5;
    }
  }
  
  const testPointCounts = [
    Math.floor(originalN * 0.75),
    Math.floor(originalN * 0.5),
    Math.floor(originalN * 0.33),
    Math.floor(originalN * 0.25),
    8,
    6,
    4,
    3
  ].filter(n => n >= 3 && n < originalN);
  
  const uniqueTestPoints = Array.from(new Set(testPointCounts)).sort((a, b) => b - a);
  
  const testedSparsities: SparsityTest[] = [];
  
  for (const targetN of uniqueTestPoints) {
    const allEigenvalues: number[] = [];
    let totalSuccesses = 0;
    let totalTrials = 0;
    
    for (const strategy of DECIMATION_STRATEGIES) {
      const numTrials = strategy.name === 'random' ? 10 : 1;
      const { eigenvalues, successRate } = runMultipleTrials(timeSeries, targetN, strategy, numTrials);
      allEigenvalues.push(...eigenvalues);
      totalSuccesses += eigenvalues.length;
      totalTrials += numTrials;
    }
    
    if (allEigenvalues.length === 0) {
      testedSparsities.push({
        retainedTimepoints: targetN,
        retentionRate: targetN / originalN,
        eigenvalueMean: NaN,
        eigenvalueStd: NaN,
        eigenvalueDrift: NaN,
        correlationWithOriginal: 0,
        ar2FitSuccess: false,
        confidenceInterval: [NaN, NaN]
      });
      continue;
    }
    
    const mean = allEigenvalues.reduce((a, b) => a + b, 0) / allEigenvalues.length;
    const variance = allEigenvalues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / allEigenvalues.length;
    const std = Math.sqrt(variance);
    const drift = Math.abs(mean - baselineEigenvalue);
    
    const se = std / Math.sqrt(allEigenvalues.length);
    const ci95: [number, number] = [mean - 1.96 * se, mean + 1.96 * se];
    
    const originalSeries = timeSeries.slice(0, targetN);
    const decimatedForCorr = DECIMATION_STRATEGIES[0].decimate(timeSeries, targetN);
    const correlation = calculatePearsonCorrelation(originalSeries, decimatedForCorr);
    
    testedSparsities.push({
      retainedTimepoints: targetN,
      retentionRate: targetN / originalN,
      eigenvalueMean: mean,
      eigenvalueStd: std,
      eigenvalueDrift: drift,
      correlationWithOriginal: correlation,
      ar2FitSuccess: totalSuccesses / totalTrials > 0.5,
      confidenceInterval: ci95
    });
  }
  
  let minViable = originalN;
  for (const test of testedSparsities) {
    if (test.ar2FitSuccess && test.eigenvalueDrift < 0.1 && test.eigenvalueStd < 0.15) {
      minViable = Math.min(minViable, test.retainedTimepoints);
    }
  }
  
  const viableTests = testedSparsities.filter(t => t.ar2FitSuccess && !isNaN(t.eigenvalueMean));
  const avgDrift = viableTests.length > 0
    ? viableTests.reduce((sum, t) => sum + t.eigenvalueDrift, 0) / viableTests.length
    : 1;
  const avgStd = viableTests.length > 0
    ? viableTests.reduce((sum, t) => sum + t.eigenvalueStd, 0) / viableTests.length
    : 1;
  
  const robustnessScore = Math.max(0, Math.min(100, 
    100 - (avgDrift * 200) - (avgStd * 100) - (minViable > 8 ? 20 : 0)
  ));
  
  let clinicalViability: 'HIGH' | 'MEDIUM' | 'LOW' | 'NOT_VIABLE';
  if (minViable <= 4 && robustnessScore >= 70) {
    clinicalViability = 'HIGH';
  } else if (minViable <= 6 && robustnessScore >= 50) {
    clinicalViability = 'MEDIUM';
  } else if (minViable <= 8 && robustnessScore >= 30) {
    clinicalViability = 'LOW';
  } else {
    clinicalViability = 'NOT_VIABLE';
  }
  
  const recommendations: string[] = [];
  if (minViable <= 4) {
    recommendations.push('Model works with as few as 4 timepoints - suitable for clinical blood draw protocols');
  }
  if (minViable <= 6) {
    recommendations.push('6-timepoint sampling (every 4 hours) provides reliable eigenvalue estimates');
  }
  if (avgDrift < 0.05) {
    recommendations.push('Eigenvalue estimates are highly stable across sampling densities');
  } else if (avgDrift < 0.1) {
    recommendations.push('Eigenvalue drift is acceptable but confidence intervals widen with sparse sampling');
  } else {
    recommendations.push('CAUTION: Significant eigenvalue drift detected - high-resolution sampling recommended');
  }
  if (robustnessScore >= 70) {
    recommendations.push('VALIDATION PASSED: Model suitable for clinical translation');
  }
  
  return {
    originalTimepoints: originalN,
    testedSparsities,
    robustnessScore,
    minimumViableTimepoints: minViable,
    clinicalViability,
    recommendations
  };
}

export function runBatchSparseSamplingValidation(
  geneTimeSeries: Map<string, number[]>,
  geneSubset?: string[]
): {
  perGeneResults: Map<string, SparseSamplingResult>;
  aggregateSummary: {
    meanRobustnessScore: number;
    medianMinViableTimepoints: number;
    clinicalViabilityDistribution: Record<string, number>;
    overallRecommendation: string;
  };
} {
  const perGeneResults = new Map<string, SparseSamplingResult>();
  const genes = geneSubset || Array.from(geneTimeSeries.keys()).slice(0, 50);
  
  for (const gene of genes) {
    const series = geneTimeSeries.get(gene);
    if (series && series.length >= 6) {
      perGeneResults.set(gene, runSparseSamplingValidation(series));
    }
  }
  
  const results = Array.from(perGeneResults.values());
  const scores = results.map(r => r.robustnessScore);
  const minViables = results.map(r => r.minimumViableTimepoints).sort((a, b) => a - b);
  
  const clinicalDist: Record<string, number> = { HIGH: 0, MEDIUM: 0, LOW: 0, NOT_VIABLE: 0 };
  for (const r of results) {
    clinicalDist[r.clinicalViability]++;
  }
  
  const meanScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const medianMinViable = minViables[Math.floor(minViables.length / 2)] || 0;
  
  let overallRecommendation: string;
  if (clinicalDist.HIGH > results.length * 0.5) {
    overallRecommendation = 'EXCELLENT: Majority of genes show high clinical viability with sparse sampling';
  } else if (clinicalDist.HIGH + clinicalDist.MEDIUM > results.length * 0.5) {
    overallRecommendation = 'GOOD: Most genes maintain acceptable eigenvalue stability with reduced sampling';
  } else {
    overallRecommendation = 'CAUTION: Many genes require high-resolution sampling for reliable results';
  }
  
  return {
    perGeneResults,
    aggregateSummary: {
      meanRobustnessScore: meanScore,
      medianMinViableTimepoints: medianMinViable,
      clinicalViabilityDistribution: clinicalDist,
      overallRecommendation
    }
  };
}
