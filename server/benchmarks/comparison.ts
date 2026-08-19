/**
 * Unified Benchmark Comparison Suite
 * 
 * Compares PAR(2) eigenvalue analysis against established circadian tools:
 * - JTK_CYCLE: Nonparametric rhythm detection
 * - RAIN: Rhythmicity with asymmetry detection  
 * - ARMA: Model selection to validate AR(2) choice
 */

import { runJTKCycleSingle, JTKResult } from './jtk-cycle';
import { runRAINSingle, RAINResult } from './rain';
import { runARMAComparison, ModelComparison } from './arma';

export interface BenchmarkComparisonResult {
  gene: string;
  timepoints: number[];
  par2: {
    eigenvalue: number;
    phi1: number;
    phi2: number;
    isStable: boolean;
    inStableBand: boolean;
  };
  jtkCycle: {
    pValue: number;
    period: number;
    phase: number;
    tau: number;
    isRhythmic: boolean;
  };
  rain: {
    pValue: number;
    period: number;
    phase: number;
    peakShape: string;
    isRhythmic: boolean;
  };
  arma: {
    bestModel: string;
    ar2Rank: number;
    deltaAICFromBest: number;
    allModels: ModelComparison[];
  };
  agreement: {
    allAgree: boolean;
    par2VsJTK: boolean;
    par2VsRAIN: boolean;
    ar2Supported: boolean;
    summary: string;
  };
}

export interface BenchmarkSummary {
  totalGenes: number;
  rhythmicByPAR2: number;
  rhythmicByJTK: number;
  rhythmicByRAIN: number;
  ar2PreferredCount: number;
  agreementRate: number;
  par2UniqueDetections: number;
  jtkUniqueDetections: number;
  rainUniqueDetections: number;
  crossValidated: number;
  timestamp: string;
}

function fitAR2(series: number[]): { phi1: number; phi2: number; eigenvalue: number } {
  const n = series.length;
  if (n < 5) {
    return { phi1: 0, phi2: 0, eigenvalue: 0 };
  }
  
  const mean = series.reduce((a, b) => a + b, 0) / n;
  const y = series.map(x => x - mean);
  
  let sumY_Y1 = 0, sumY_Y2 = 0;
  let sumY1_Y1 = 0, sumY1_Y2 = 0, sumY2_Y2 = 0;
  
  for (let t = 2; t < n; t++) {
    sumY_Y1 += y[t] * y[t - 1];
    sumY_Y2 += y[t] * y[t - 2];
    sumY1_Y1 += y[t - 1] * y[t - 1];
    sumY1_Y2 += y[t - 1] * y[t - 2];
    sumY2_Y2 += y[t - 2] * y[t - 2];
  }
  
  const det = sumY1_Y1 * sumY2_Y2 - sumY1_Y2 * sumY1_Y2;
  if (Math.abs(det) < 1e-10) {
    return { phi1: 0, phi2: 0, eigenvalue: 0 };
  }
  
  const phi1 = (sumY_Y1 * sumY2_Y2 - sumY_Y2 * sumY1_Y2) / det;
  const phi2 = (sumY1_Y1 * sumY_Y2 - sumY_Y1 * sumY1_Y2) / det;
  
  const discriminant = phi1 * phi1 + 4 * phi2;
  let eigenvalue: number;
  
  if (discriminant >= 0) {
    const lambda1 = (phi1 + Math.sqrt(discriminant)) / 2;
    const lambda2 = (phi1 - Math.sqrt(discriminant)) / 2;
    eigenvalue = Math.max(Math.abs(lambda1), Math.abs(lambda2));
  } else {
    eigenvalue = Math.sqrt(-phi2);
  }
  
  return { phi1, phi2, eigenvalue };
}

export function runBenchmarkComparison(
  gene: string,
  expression: number[],
  timepoints: number[],
  period: number = 24
): BenchmarkComparisonResult {
  const ar2 = fitAR2(expression);
  const isStable = ar2.eigenvalue < 1.0;
  // Updated: Jan 2026 audit range (Target=0.537, Clock=0.689)
  const inStableBand = ar2.eigenvalue >= 0.40 && ar2.eigenvalue <= 0.80;
  
  const jtkResult = runJTKCycleSingle(expression, timepoints, [period, period - 1, period + 1]);
  
  const rainResult = runRAINSingle(expression, timepoints, period);
  
  const armaResult = runARMAComparison(expression, { maxP: 3, maxQ: 2, criterion: 'aic' });
  const ar2Model = armaResult.allModels.find(m => m.p === 2 && m.q === 0);
  const ar2DeltaAIC = ar2Model ? ar2Model.deltaAIC : Infinity;
  
  const par2Rhythmic = inStableBand;
  const jtkRhythmic = jtkResult.isRhythmic;
  const rainRhythmic = rainResult.isRhythmic;
  
  const par2VsJTK = par2Rhythmic === jtkRhythmic;
  const par2VsRAIN = par2Rhythmic === rainRhythmic;
  const ar2Supported = armaResult.ar2Rank <= 2;
  const allAgree = par2VsJTK && par2VsRAIN;
  
  let summary: string;
  if (allAgree && ar2Supported) {
    summary = 'Full agreement: All methods concur, AR(2) validated';
  } else if (allAgree) {
    summary = 'Rhythmicity agreement, but AR(2) not optimal model';
  } else if (par2Rhythmic && !jtkRhythmic && !rainRhythmic) {
    summary = 'PAR(2) unique detection: May capture dynamics missed by rhythm-only tests';
  } else if (!par2Rhythmic && (jtkRhythmic || rainRhythmic)) {
    summary = 'Rhythm detected but eigenvalue outside stable band';
  } else {
    summary = 'Partial agreement between methods';
  }
  
  return {
    gene,
    timepoints,
    par2: {
      eigenvalue: ar2.eigenvalue,
      phi1: ar2.phi1,
      phi2: ar2.phi2,
      isStable,
      inStableBand
    },
    jtkCycle: {
      pValue: jtkResult.pValue,
      period: jtkResult.period,
      phase: jtkResult.phase,
      tau: jtkResult.tau,
      isRhythmic: jtkResult.isRhythmic
    },
    rain: {
      pValue: rainResult.pValue,
      period: rainResult.period,
      phase: rainResult.phase,
      peakShape: rainResult.peakShape,
      isRhythmic: rainResult.isRhythmic
    },
    arma: {
      bestModel: armaResult.bestModel.model,
      ar2Rank: armaResult.ar2Rank,
      deltaAICFromBest: ar2DeltaAIC,
      allModels: armaResult.allModels
    },
    agreement: {
      allAgree,
      par2VsJTK,
      par2VsRAIN,
      ar2Supported,
      summary
    }
  };
}

export function runBatchBenchmark(
  geneData: Map<string, number[]>,
  timepoints: number[],
  period: number = 24
): { results: BenchmarkComparisonResult[]; summary: BenchmarkSummary } {
  const results: BenchmarkComparisonResult[] = [];
  
  for (const [gene, expression] of Array.from(geneData.entries())) {
    if (expression.length === timepoints.length) {
      results.push(runBenchmarkComparison(gene, expression, timepoints, period));
    }
  }
  
  const rhythmicByPAR2 = results.filter(r => r.par2.inStableBand).length;
  const rhythmicByJTK = results.filter(r => r.jtkCycle.isRhythmic).length;
  const rhythmicByRAIN = results.filter(r => r.rain.isRhythmic).length;
  const ar2PreferredCount = results.filter(r => r.arma.ar2Rank === 1).length;
  const agreementCount = results.filter(r => r.agreement.allAgree).length;
  
  const par2Only = results.filter(r => r.par2.inStableBand && !r.jtkCycle.isRhythmic && !r.rain.isRhythmic).length;
  const jtkOnly = results.filter(r => !r.par2.inStableBand && r.jtkCycle.isRhythmic && !r.rain.isRhythmic).length;
  const rainOnly = results.filter(r => !r.par2.inStableBand && !r.jtkCycle.isRhythmic && r.rain.isRhythmic).length;
  const crossValidated = results.filter(r => r.par2.inStableBand && r.jtkCycle.isRhythmic && r.rain.isRhythmic).length;
  
  const summary: BenchmarkSummary = {
    totalGenes: results.length,
    rhythmicByPAR2: rhythmicByPAR2,
    rhythmicByJTK: rhythmicByJTK,
    rhythmicByRAIN: rhythmicByRAIN,
    ar2PreferredCount,
    agreementRate: results.length > 0 ? (agreementCount / results.length) * 100 : 0,
    par2UniqueDetections: par2Only,
    jtkUniqueDetections: jtkOnly,
    rainUniqueDetections: rainOnly,
    crossValidated,
    timestamp: new Date().toISOString()
  };
  
  return { results, summary };
}

export function generateBenchmarkReport(summary: BenchmarkSummary): string {
  return `
# PAR(2) Benchmark Comparison Report
Generated: ${summary.timestamp}

## Summary Statistics
- **Total Genes Analyzed**: ${summary.totalGenes}
- **AR(2) Model Preferred**: ${summary.ar2PreferredCount} (${((summary.ar2PreferredCount / summary.totalGenes) * 100).toFixed(1)}%)

## Rhythmicity Detection Comparison
| Method | Rhythmic Genes | Percentage |
|--------|----------------|------------|
| PAR(2) Stable Band | ${summary.rhythmicByPAR2} | ${((summary.rhythmicByPAR2 / summary.totalGenes) * 100).toFixed(1)}% |
| JTK_CYCLE (q<0.05) | ${summary.rhythmicByJTK} | ${((summary.rhythmicByJTK / summary.totalGenes) * 100).toFixed(1)}% |
| RAIN (q<0.05) | ${summary.rhythmicByRAIN} | ${((summary.rhythmicByRAIN / summary.totalGenes) * 100).toFixed(1)}% |

## Cross-Method Agreement
- **Full Agreement Rate**: ${summary.agreementRate.toFixed(1)}%
- **Cross-Validated (all 3 methods)**: ${summary.crossValidated}

## Unique Detections
- **PAR(2) Only**: ${summary.par2UniqueDetections} genes detected exclusively by eigenvalue analysis
- **JTK_CYCLE Only**: ${summary.jtkUniqueDetections} genes detected exclusively by JTK
- **RAIN Only**: ${summary.rainUniqueDetections} genes detected exclusively by RAIN

## Interpretation
${summary.ar2PreferredCount > summary.totalGenes * 0.5 
  ? '✓ AR(2) is the preferred model for majority of genes, validating PAR(2) framework choice.'
  : '⚠ AR(2) is not always the optimal model; consider extended ARMA analysis for specific genes.'}

${summary.crossValidated > 0 
  ? `✓ ${summary.crossValidated} genes show rhythmicity across all three methods, providing strong cross-validation.`
  : ''}

${summary.par2UniqueDetections > 0 
  ? `ℹ ${summary.par2UniqueDetections} genes detected only by PAR(2) may reflect dynamic stability patterns not captured by traditional rhythm tests.`
  : ''}
`;
}
