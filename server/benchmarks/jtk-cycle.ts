/**
 * JTK_CYCLE Implementation
 * 
 * Faithful TypeScript implementation of JTK_CYCLE (Hughes et al., 2010)
 * "JTK_CYCLE: An Efficient Nonparametric Algorithm for Detecting Rhythmic Components"
 * Journal of Biological Rhythms, 25(5):372-380
 * 
 * Key features matching the original:
 * - Kendall's τ-b with tie-corrected variance (exact formula)
 * - Multiple period testing (20, 24, 28h)
 * - Phase grid at sampling interval resolution
 * - Bonferroni correction within each gene for multiple phases/periods tested
 * - Benjamini-Hochberg FDR across genes
 */

export interface JTKResult {
  gene: string;
  period: number;
  phase: number;
  amplitude: number;
  pValue: number;
  qValue: number;
  tau: number;
  isRhythmic: boolean;
}

export interface JTKConfig {
  periods: number[];
  timepoints: number[];
  pValueThreshold?: number;
}

function rankDataWithTies(data: number[]): { ranks: number[]; tieGroups: number[] } {
  const indexed = data.map((val, idx) => ({ val, idx }));
  indexed.sort((a, b) => a.val - b.val);

  const ranks = new Array(data.length);
  const tieGroups: number[] = [];
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j < indexed.length && indexed[j].val === indexed[i].val) {
      j++;
    }
    const tieSize = j - i;
    if (tieSize > 1) {
      tieGroups.push(tieSize);
    }
    const avgRank = (i + j - 1) / 2 + 1;
    for (let k = i; k < j; k++) {
      ranks[indexed[k].idx] = avgRank;
    }
    i = j;
  }
  return { ranks, tieGroups };
}

function kendallTauB(x: number[], y: number[]): {
  tau: number;
  S: number;
  variance: number;
  zScore: number;
  pValue: number;
} {
  const n = x.length;
  if (n < 4) return { tau: 0, S: 0, variance: 1, zScore: 0, pValue: 1 };

  let concordant = 0;
  let discordant = 0;
  let tiedX = 0;
  let tiedY = 0;
  let tiedBoth = 0;

  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) {
      const xDiff = x[j] - x[i];
      const yDiff = y[j] - y[i];

      if (xDiff === 0 && yDiff === 0) {
        tiedBoth++;
      } else if (xDiff === 0) {
        tiedX++;
      } else if (yDiff === 0) {
        tiedY++;
      } else if (xDiff * yDiff > 0) {
        concordant++;
      } else {
        discordant++;
      }
    }
  }

  const S = concordant - discordant;
  const n0 = n * (n - 1) / 2;
  const n1 = tiedX + tiedBoth;
  const n2 = tiedY + tiedBoth;
  const denominator = Math.sqrt((n0 - n1) * (n0 - n2));
  const tau = denominator > 0 ? S / denominator : 0;

  const { tieGroups: tGroupsX } = rankDataWithTies(x);
  const { tieGroups: tGroupsY } = rankDataWithTies(y);

  let v0 = n * (n - 1) * (2 * n + 5);
  let vt = 0;
  for (const t of tGroupsX) {
    vt += t * (t - 1) * (2 * t + 5);
  }
  let vu = 0;
  for (const u of tGroupsY) {
    vu += u * (u - 1) * (2 * u + 5);
  }

  let v1 = 0;
  for (const t of tGroupsX) {
    v1 += t * (t - 1);
  }
  let v1u = 0;
  for (const u of tGroupsY) {
    v1u += u * (u - 1);
  }
  const v1Term = (v1 * v1u) / (2 * n * (n - 1));

  let v2 = 0;
  for (const t of tGroupsX) {
    v2 += t * (t - 1) * (t - 2);
  }
  let v2u = 0;
  for (const u of tGroupsY) {
    v2u += u * (u - 1) * (u - 2);
  }
  const v2Term = (v2 * v2u) / (9 * n * (n - 1) * (n - 2));

  const variance = (v0 - vt - vu) / 18 + v1Term + v2Term;

  const zScore = variance > 0 ? S / Math.sqrt(variance) : 0;
  const pValue = 2 * (1 - normalCDF(Math.abs(zScore)));

  return { tau, S, variance, zScore, pValue };
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

function estimateAmplitude(data: number[], timepoints: number[], period: number, phase: number): number {
  const omega = (2 * Math.PI) / period;
  const n = data.length;
  const mean = data.reduce((a, b) => a + b, 0) / n;

  let sumCos = 0;
  let sumSin = 0;
  for (let i = 0; i < n; i++) {
    sumCos += (data[i] - mean) * Math.cos(omega * timepoints[i] - phase);
    sumSin += (data[i] - mean) * Math.sin(omega * timepoints[i] - phase);
  }
  return Math.sqrt(sumCos * sumCos + sumSin * sumSin) / n * 2;
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

export function runJTKCycleSingle(
  expression: number[],
  timepoints: number[],
  periods: number[] = [20, 24, 28]
): Omit<JTKResult, 'gene'> {
  const n = expression.length;
  if (n < 6) {
    return { period: 24, phase: 0, amplitude: 0, pValue: 1, qValue: 1, tau: 0, isRhythmic: false };
  }

  let bestTau = 0;
  let bestPValue = 1;
  let bestPeriod = periods[0];
  let bestPhaseHours = 0;
  let totalTests = 0;

  const samplingInterval = timepoints.length > 1 ? timepoints[1] - timepoints[0] : 2;

  for (const period of periods) {
    const nPhases = Math.max(4, Math.round(period / samplingInterval));
    for (let p = 0; p < nPhases; p++) {
      const phaseHours = (p / nPhases) * period;
      const omega = (2 * Math.PI) / period;
      const reference = timepoints.map(t => Math.cos(omega * (t - phaseHours)));

      const result = kendallTauB(expression, reference);
      totalTests++;

      if (result.pValue < bestPValue) {
        bestPValue = result.pValue;
        bestTau = result.tau;
        bestPeriod = period;
        bestPhaseHours = phaseHours;
      }
    }
  }

  const correctedP = Math.min(1, bestPValue * totalTests);

  const amplitude = estimateAmplitude(expression, timepoints, bestPeriod,
    bestPhaseHours * 2 * Math.PI / bestPeriod);

  return {
    period: bestPeriod,
    phase: bestPhaseHours,
    amplitude,
    pValue: correctedP,
    qValue: correctedP,
    tau: bestTau,
    isRhythmic: correctedP < 0.05
  };
}

export function runJTKCycle(
  geneData: Map<string, number[]>,
  config: JTKConfig
): JTKResult[] {
  const { periods, timepoints, pValueThreshold = 0.05 } = config;
  const results: JTKResult[] = [];

  for (const [gene, expression] of Array.from(geneData.entries())) {
    if (expression.length !== timepoints.length) continue;

    const single = runJTKCycleSingle(expression, timepoints, periods);
    results.push({ gene, ...single });
  }

  const pValues = results.map(r => r.pValue);
  const qValues = benjaminiHochberg(pValues);

  for (let i = 0; i < results.length; i++) {
    results[i].qValue = qValues[i];
    results[i].isRhythmic = qValues[i] < pValueThreshold;
  }

  return results.sort((a, b) => a.pValue - b.pValue);
}
