/**
 * Alternative Phase Estimation Methods
 * 
 * Provides multiple phase estimation approaches beyond fixed 24h cosinor
 * to test robustness of PAR(2) findings.
 * 
 * LIMITATIONS:
 * - These are simplified implementations for exploratory analysis
 * - For publication-grade phase estimation, use established tools (JTK_CYCLE, RAIN, etc.)
 * - All methods assume evenly-spaced timepoints
 */

export interface PhaseEstimate {
  method: string;
  phaseHours: number;
  amplitude: number;
  period: number;
  rSquared: number;
  confidence: { lower: number; upper: number };
  isHeuristic: boolean;
  warnings: string[];
}

export interface PhaseRobustnessResult {
  gene: string;
  estimates: PhaseEstimate[];
  consensus: {
    meanPhase: number;
    phaseSD: number;
    robust: boolean;
    agreement: number;
  };
  warnings: string[];
}

const MIN_TIMEPOINTS = 6;

/**
 * Validate input arrays
 */
function validateInputs(times: number[], values: number[]): string[] {
  const warnings: string[] = [];
  
  if (times.length !== values.length) {
    warnings.push('Times and values arrays have different lengths');
  }
  
  if (times.length < MIN_TIMEPOINTS) {
    warnings.push(`Only ${times.length} timepoints; minimum ${MIN_TIMEPOINTS} recommended for reliable phase estimation`);
  }
  
  if (values.some(v => !isFinite(v))) {
    warnings.push('Values contain NaN or Infinite entries');
  }
  
  const diffs = times.slice(1).map((t, i) => t - times[i]);
  const meanDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  const unevenSpacing = diffs.some(d => Math.abs(d - meanDiff) > 0.5);
  if (unevenSpacing) {
    warnings.push('Timepoints are not evenly spaced; results may be less reliable');
  }
  
  return warnings;
}

/**
 * Standard cosinor fit with fixed period
 */
export function cosinorFit(
  times: number[],
  values: number[],
  period: number = 24
): PhaseEstimate {
  const warnings = validateInputs(times, values);
  const n = times.length;
  
  if (n < 4) {
    return {
      method: `Cosinor (T=${period}h)`,
      phaseHours: 0,
      amplitude: 0,
      period,
      rSquared: 0,
      confidence: { lower: 0, upper: 24 },
      isHeuristic: true,
      warnings: [...warnings, 'Insufficient data for cosinor fit']
    };
  }
  
  const omega = (2 * Math.PI) / period;
  
  let sumCos = 0, sumSin = 0, sumCosCos = 0, sumSinSin = 0, sumCosSin = 0;
  let sumYCos = 0, sumYSin = 0, sumY = 0, sumY2 = 0;
  
  for (let i = 0; i < n; i++) {
    const c = Math.cos(omega * times[i]);
    const s = Math.sin(omega * times[i]);
    sumCos += c;
    sumSin += s;
    sumCosCos += c * c;
    sumSinSin += s * s;
    sumCosSin += c * s;
    sumYCos += values[i] * c;
    sumYSin += values[i] * s;
    sumY += values[i];
    sumY2 += values[i] * values[i];
  }
  
  const mesor = sumY / n;
  
  const denom1 = sumCosCos - (sumCos * sumCos) / n;
  const denom2 = sumSinSin - (sumSin * sumSin) / n;
  
  const beta = denom1 > 1e-10 ? (sumYCos - (sumY * sumCos) / n) / denom1 : 0;
  const gamma = denom2 > 1e-10 ? (sumYSin - (sumY * sumSin) / n) / denom2 : 0;
  
  const amplitude = Math.sqrt(beta * beta + gamma * gamma);
  const phaseRad = Math.atan2(-gamma, beta);
  const phaseHours = ((phaseRad / omega) % period + period) % period;
  
  let ssRes = 0, ssTot = 0;
  for (let i = 0; i < n; i++) {
    const predicted = mesor + beta * Math.cos(omega * times[i]) + gamma * Math.sin(omega * times[i]);
    ssRes += Math.pow(values[i] - predicted, 2);
    ssTot += Math.pow(values[i] - mesor, 2);
  }
  const rSquared = ssTot > 1e-10 ? Math.max(0, 1 - ssRes / ssTot) : 0;
  
  const residualVar = n > 3 ? ssRes / (n - 3) : ssRes;
  const phaseError = amplitude > 0.01 && residualVar > 0 
    ? Math.sqrt(residualVar) / (amplitude * omega * Math.sqrt(n / 2)) * (180 / Math.PI) / 15
    : 6;
  
  return {
    method: `Cosinor (T=${period}h)`,
    phaseHours,
    amplitude,
    period,
    rSquared,
    confidence: { 
      lower: (phaseHours - phaseError + period) % period, 
      upper: (phaseHours + phaseError) % period 
    },
    isHeuristic: false,
    warnings
  };
}

/**
 * Free-period cosinor: fits both phase AND period
 */
export function freePeriodCosinor(
  times: number[],
  values: number[],
  periodRange: [number, number] = [20, 28]
): PhaseEstimate {
  let bestFit: PhaseEstimate | null = null;
  let bestR2 = -Infinity;
  
  for (let T = periodRange[0]; T <= periodRange[1]; T += 0.5) {
    const fit = cosinorFit(times, values, T);
    if (fit.rSquared > bestR2) {
      bestR2 = fit.rSquared;
      bestFit = { ...fit, method: `Free-period Cosinor (T=${T}h)` };
    }
  }
  
  if (!bestFit) {
    return cosinorFit(times, values, 24);
  }
  
  bestFit.warnings.push('Period selected by grid search; true period uncertainty not quantified');
  return bestFit;
}

/**
 * FFT-based phase estimation
 * More robust than naive Hilbert for noisy data
 */
export function fftPhase(
  times: number[],
  values: number[]
): PhaseEstimate {
  const warnings = validateInputs(times, values);
  const n = values.length;
  
  if (n < 6) {
    return {
      method: 'FFT Phase',
      phaseHours: 0,
      amplitude: 0,
      period: 24,
      rSquared: 0,
      confidence: { lower: 0, upper: 24 },
      isHeuristic: true,
      warnings: [...warnings, 'Insufficient data for FFT']
    };
  }
  
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const centered = values.map(v => v - mean);
  
  const totalTime = times[n - 1] - times[0];
  const dt = totalTime / (n - 1);
  
  let targetFreqIndex = 1;
  let maxPower = 0;
  
  for (let k = 1; k < Math.floor(n / 2); k++) {
    let realPart = 0, imagPart = 0;
    for (let j = 0; j < n; j++) {
      const angle = -2 * Math.PI * k * j / n;
      realPart += centered[j] * Math.cos(angle);
      imagPart += centered[j] * Math.sin(angle);
    }
    const power = realPart * realPart + imagPart * imagPart;
    
    const freq = k / totalTime;
    const period = 1 / freq;
    
    if (period >= 18 && period <= 30 && power > maxPower) {
      maxPower = power;
      targetFreqIndex = k;
    }
  }
  
  let realPart = 0, imagPart = 0;
  for (let j = 0; j < n; j++) {
    const angle = -2 * Math.PI * targetFreqIndex * j / n;
    realPart += centered[j] * Math.cos(angle);
    imagPart += centered[j] * Math.sin(angle);
  }
  
  const amplitude = 2 * Math.sqrt(realPart * realPart + imagPart * imagPart) / n;
  const phaseRad = Math.atan2(-imagPart, realPart);
  const period = totalTime / targetFreqIndex;
  const phaseHours = (((-phaseRad / (2 * Math.PI)) * period) % period + period) % period;
  
  const totalVar = centered.reduce((s, x) => s + x * x, 0);
  const rSquared = totalVar > 0 ? maxPower / totalVar : 0;
  
  return {
    method: 'FFT Phase',
    phaseHours,
    amplitude,
    period: Math.max(18, Math.min(30, period)),
    rSquared: Math.min(1, rSquared),
    confidence: { lower: (phaseHours - 4 + 24) % 24, upper: (phaseHours + 4) % 24 },
    isHeuristic: true,
    warnings: [...warnings, 'FFT resolution limited by sample length; phase confidence is approximate']
  };
}

/**
 * Zero-crossing phase estimation
 */
export function zeroCrossingPhase(
  times: number[],
  values: number[]
): PhaseEstimate {
  const warnings = validateInputs(times, values);
  const n = values.length;
  
  if (n < 4) {
    return {
      method: 'Zero-crossing',
      phaseHours: 0,
      amplitude: 0,
      period: 24,
      rSquared: 0,
      confidence: { lower: 0, upper: 24 },
      isHeuristic: true,
      warnings: [...warnings, 'Insufficient data']
    };
  }
  
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const centered = values.map(v => v - mean);
  
  const crossings: { time: number; rising: boolean }[] = [];
  for (let i = 1; i < n; i++) {
    if ((centered[i - 1] < 0 && centered[i] >= 0) || (centered[i - 1] >= 0 && centered[i] < 0)) {
      const frac = Math.abs(centered[i - 1]) / (Math.abs(centered[i - 1]) + Math.abs(centered[i]));
      const crossTime = times[i - 1] + frac * (times[i] - times[i - 1]);
      crossings.push({ time: crossTime, rising: centered[i] > centered[i - 1] });
    }
  }
  
  if (crossings.length < 2) {
    return { 
      method: 'Zero-crossing', 
      phaseHours: 0, 
      amplitude: 0, 
      period: 24, 
      rSquared: 0, 
      confidence: { lower: 0, upper: 24 },
      isHeuristic: true,
      warnings: [...warnings, 'Fewer than 2 zero crossings detected']
    };
  }
  
  const periods: number[] = [];
  for (let i = 2; i < crossings.length; i += 2) {
    periods.push(crossings[i].time - crossings[i - 2].time);
  }
  const period = periods.length > 0 
    ? periods.reduce((a, b) => a + b, 0) / periods.length 
    : 24;
  
  const risingCrossing = crossings.find(c => c.rising);
  const phaseHours = risingCrossing ? (risingCrossing.time % period) : 0;
  
  const maxVal = Math.max(...values);
  const minVal = Math.min(...values);
  const amplitude = (maxVal - minVal) / 2;
  
  const periodVar = periods.length > 1 
    ? periods.reduce((s, p) => s + Math.pow(p - period, 2), 0) / periods.length 
    : 0;
  const rSquared = periodVar < 4 ? 0.7 - periodVar * 0.1 : 0.3;
  
  return {
    method: 'Zero-crossing',
    phaseHours: phaseHours % 24,
    amplitude,
    period: Math.max(18, Math.min(30, period)),
    rSquared: Math.max(0, Math.min(1, rSquared)),
    confidence: { lower: (phaseHours - 4 + 24) % 24, upper: (phaseHours + 4) % 24 },
    isHeuristic: true,
    warnings: [...warnings, 'Zero-crossing is a heuristic method; use cosinor for publication']
  };
}

/**
 * Run all phase estimation methods and compute consensus
 */
export function runPhaseRobustnessPanel(
  gene: string,
  times: number[],
  values: number[]
): PhaseRobustnessResult {
  const inputWarnings = validateInputs(times, values);
  
  const estimates: PhaseEstimate[] = [
    cosinorFit(times, values, 24),
    cosinorFit(times, values, 22),
    cosinorFit(times, values, 26),
    freePeriodCosinor(times, values),
    fftPhase(times, values),
    zeroCrossingPhase(times, values)
  ];
  
  const validEstimates = estimates.filter(e => e.rSquared > 0.3 && e.amplitude > 0.01);
  
  if (validEstimates.length === 0) {
    return {
      gene,
      estimates,
      consensus: { meanPhase: 0, phaseSD: 12, robust: false, agreement: 0 },
      warnings: [...inputWarnings, 'No methods produced valid phase estimates']
    };
  }
  
  const phases = validEstimates.map(e => e.phaseHours);
  
  const sinSum = phases.reduce((a, p) => a + Math.sin(2 * Math.PI * p / 24), 0);
  const cosSum = phases.reduce((a, p) => a + Math.cos(2 * Math.PI * p / 24), 0);
  const meanPhase = ((Math.atan2(sinSum, cosSum) / (2 * Math.PI)) * 24 + 24) % 24;
  
  const circularDiffs = phases.map(p => {
    const diff = Math.abs(p - meanPhase);
    return Math.min(diff, 24 - diff);
  });
  const phaseSD = Math.sqrt(circularDiffs.reduce((a, b) => a + b * b, 0) / circularDiffs.length);
  
  const agreement = validEstimates.length / estimates.length;
  const robust = phaseSD < 3 && agreement > 0.5;
  
  const warnings = [...inputWarnings];
  if (!robust) {
    warnings.push('Phase estimates show poor agreement across methods');
  }
  
  return {
    gene,
    estimates,
    consensus: { meanPhase, phaseSD, robust, agreement },
    warnings
  };
}
