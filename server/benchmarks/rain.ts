/**
 * RAIN-Inspired Implementation (Simplified)
 * 
 * Simplified TypeScript implementation inspired by RAIN (Thaben & Westermark, 2014)
 * "Detecting Rhythms in Time Series with RAIN"
 * Journal of Biological Rhythms, 29(6):391-400
 * 
 * NOTE: This is a SIMPLIFIED implementation using umbrella-style statistics.
 * The original RAIN uses a more sophisticated umbrella/anti-umbrella test
 * framework with exact phase enumeration and proper multiple testing correction.
 * 
 * For exact RAIN results, use the original R implementation (rain package).
 * This implementation captures the core asymmetric rhythm detection concept.
 * 
 * Key features (simplified):
 * - Detects peak position and asymmetric rise/fall patterns
 * - Uses umbrella-inspired statistic for oscillation detection
 */

export interface RAINResult {
  gene: string;
  period: number;
  phase: number;
  peakShape: 'symmetric' | 'asymmetric';
  riseTime: number;
  fallTime: number;
  pValue: number;
  qValue: number;
  isRhythmic: boolean;
}

export interface RAINConfig {
  period: number;
  timepoints: number[];
  deltat?: number;
  pValueThreshold?: number;
}

function umbrellaStatistic(data: number[], peak: number, n: number): number {
  let sumBefore = 0;
  let sumAfter = 0;
  let countBefore = 0;
  let countAfter = 0;
  
  for (let i = 0; i < n; i++) {
    if (i < peak) {
      for (let j = i + 1; j <= peak; j++) {
        if (data[j] > data[i]) sumBefore++;
        else if (data[j] < data[i]) sumBefore--;
      }
      countBefore++;
    } else if (i > peak) {
      for (let j = peak; j < i; j++) {
        if (data[j] > data[i]) sumAfter++;
        else if (data[j] < data[i]) sumAfter--;
      }
      countAfter++;
    }
  }
  
  const expectedBefore = countBefore > 0 ? (peak * (peak + 1)) / 4 : 0;
  const expectedAfter = countAfter > 0 ? ((n - peak - 1) * (n - peak)) / 4 : 0;
  
  return sumBefore + sumAfter - expectedBefore - expectedAfter;
}

function mannKendallStatistic(data: number[]): number {
  const n = data.length;
  let s = 0;
  
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) {
      if (data[j] > data[i]) s++;
      else if (data[j] < data[i]) s--;
    }
  }
  
  return s;
}

function umbrellaVariance(n: number, peak: number): number {
  const k = peak;
  const m = n - peak - 1;
  
  const varBefore = k * (k + 1) * (2 * k + 1) / 6;
  const varAfter = m * (m + 1) * (2 * m + 1) / 6;
  
  return varBefore + varAfter;
}

function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  
  return 0.5 * (1.0 + sign * y);
}

function computeRAINPValue(statistic: number, variance: number): number {
  if (variance <= 0) return 1;
  const z = statistic / Math.sqrt(variance);
  return 2 * (1 - normalCDF(Math.abs(z)));
}

function detectAsymmetry(data: number[], peak: number): { rise: number; fall: number; isAsymmetric: boolean } {
  const n = data.length;
  const rise = peak;
  const fall = n - peak - 1;
  
  const ratio = rise / (rise + fall);
  const isAsymmetric = ratio < 0.35 || ratio > 0.65;
  
  return { rise, fall, isAsymmetric };
}

function findBestPeak(data: number[], period: number): number {
  const n = data.length;
  let bestPeak = 0;
  let bestStatistic = -Infinity;
  
  for (let peak = 1; peak < n - 1; peak++) {
    const stat = umbrellaStatistic(data, peak, n);
    if (stat > bestStatistic) {
      bestStatistic = stat;
      bestPeak = peak;
    }
  }
  
  return bestPeak;
}

function benjaminiHochberg(pValues: number[]): number[] {
  const n = pValues.length;
  const indexed = pValues.map((p, i) => ({ p, i }));
  indexed.sort((a, b) => a.p - b.p);
  
  const qValues = new Array(n);
  let minQ = 1;
  
  for (let i = n - 1; i >= 0; i--) {
    const q = Math.min(minQ, indexed[i].p * n / (i + 1));
    minQ = q;
    qValues[indexed[i].i] = q;
  }
  
  return qValues;
}

export function runRAIN(
  geneData: Map<string, number[]>,
  config: RAINConfig
): RAINResult[] {
  const { period, timepoints, pValueThreshold = 0.05 } = config;
  const results: RAINResult[] = [];
  
  for (const [gene, expression] of Array.from(geneData.entries())) {
    if (expression.length !== timepoints.length) {
      continue;
    }
    
    const n = expression.length;
    const peak = findBestPeak(expression, period);
    
    const statistic = umbrellaStatistic(expression, peak, n);
    const variance = umbrellaVariance(n, peak);
    const pValue = computeRAINPValue(statistic, variance);
    
    const asymmetry = detectAsymmetry(expression, peak);
    const phase = timepoints[peak] % period;
    
    results.push({
      gene,
      period,
      phase,
      peakShape: asymmetry.isAsymmetric ? 'asymmetric' : 'symmetric',
      riseTime: asymmetry.rise,
      fallTime: asymmetry.fall,
      pValue,
      qValue: 0,
      isRhythmic: false
    });
  }
  
  const pValues = results.map(r => r.pValue);
  const qValues = benjaminiHochberg(pValues);
  
  for (let i = 0; i < results.length; i++) {
    results[i].qValue = qValues[i];
    results[i].isRhythmic = qValues[i] < pValueThreshold;
  }
  
  return results.sort((a, b) => a.pValue - b.pValue);
}

export function runRAINSingle(
  expression: number[],
  timepoints: number[],
  period: number = 24
): Omit<RAINResult, 'gene'> {
  const n = expression.length;
  const peak = findBestPeak(expression, period);
  
  const statistic = umbrellaStatistic(expression, peak, n);
  const variance = umbrellaVariance(n, peak);
  const pValue = computeRAINPValue(statistic, variance);
  
  const asymmetry = detectAsymmetry(expression, peak);
  const phase = timepoints[peak] % period;
  
  return {
    period,
    phase,
    peakShape: asymmetry.isAsymmetric ? 'asymmetric' : 'symmetric',
    riseTime: asymmetry.rise,
    fallTime: asymmetry.fall,
    pValue,
    qValue: pValue,
    isRhythmic: pValue < 0.05
  };
}
