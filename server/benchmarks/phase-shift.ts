/**
 * Phase Shift Test (Permutation Phase Test)
 * 
 * Tests whether TIMING matters as much as STABILITY by:
 * 1. Shifting clock gene data by 12 hours (inverting the rhythm)
 * 2. Checking if eigenvalue |λ| remains stable (~0.537-0.689 per Jan 2026 audit)
 * 3. Checking if Granger causality BREAKS (flips to false)
 * 
 * If eigenvalue stays but causality breaks, this supports the interpretation that
 * the phase relationship (not just correlation) drives the biology.
 * 
 * This test provides evidence for temporal specificity.
 */

interface PhaseShiftResult {
  shiftHours: number;
  originalEigenvalue: number;
  shiftedEigenvalue: number;
  eigenvalueStable: boolean;
  originalCausality: boolean;
  shiftedCausality: boolean;
  causalityBroken: boolean;
  phaseSpecificityProven: boolean;
}

interface PhaseShiftBenchmarkResult {
  success: boolean;
  hypothesis: string;
  testCount: number;
  results: PhaseShiftResult[];
  summary: {
    eigenvalueStabilityRate: number;
    causalityBreakRate: number;
    phaseSpecificityRate: number;
    meanEigenvalueDeviation: number;
  };
  interpretation: string;
}

/**
 * Generate paired clock-target time series
 */
function generateClockTargetPair(
  numTimepoints: number = 24,
  samplingInterval: number = 2,
  phaseOffset: number = 0,
  couplingStrength: number = 0.4,
  noise: number = 0.1
): { clock: number[]; target: number[] } {
  const omega = (2 * Math.PI) / 24;
  const clock: number[] = [];
  const target: number[] = [];
  
  for (let i = 0; i < numTimepoints; i++) {
    const t = i * samplingInterval;
    
    const clockSignal = Math.cos(omega * t) + 0.2 * Math.sin(2 * omega * t);
    clock.push(clockSignal + (Math.random() - 0.5) * 2 * noise);
    
    const delayedClock = Math.cos(omega * (t - 4));
    const targetSignal = couplingStrength * delayedClock + 
                         (1 - couplingStrength) * Math.sin(omega * t + phaseOffset);
    target.push(targetSignal + (Math.random() - 0.5) * 2 * noise);
  }
  
  return { clock, target };
}

/**
 * Shift time series by specified hours
 */
function shiftTimeSeries(
  series: number[],
  shiftHours: number,
  samplingInterval: number = 2
): number[] {
  const shiftSamples = Math.round(shiftHours / samplingInterval);
  const n = series.length;
  const shifted = new Array(n);
  
  for (let i = 0; i < n; i++) {
    const sourceIdx = (i + shiftSamples + n) % n;
    shifted[i] = series[sourceIdx];
  }
  
  return shifted;
}

/**
 * Calculate AR(2) eigenvalue
 */
function calculateAR2Eigenvalue(series: number[]): number {
  if (series.length < 4) return 0;
  
  const n = series.length;
  let sumY = 0, sumY1 = 0, sumY2 = 0;
  let sumY_Y1 = 0, sumY_Y2 = 0;
  let sumY1_Y1 = 0, sumY1_Y2 = 0, sumY2_Y2 = 0;
  
  for (let t = 2; t < n; t++) {
    const y = series[t];
    const y1 = series[t - 1];
    const y2 = series[t - 2];
    
    sumY += y;
    sumY1 += y1;
    sumY2 += y2;
    sumY_Y1 += y * y1;
    sumY_Y2 += y * y2;
    sumY1_Y1 += y1 * y1;
    sumY1_Y2 += y1 * y2;
    sumY2_Y2 += y2 * y2;
  }
  
  const m = n - 2;
  const meanY = sumY / m;
  const meanY1 = sumY1 / m;
  const meanY2 = sumY2 / m;
  
  const covY_Y1 = sumY_Y1 / m - meanY * meanY1;
  const covY_Y2 = sumY_Y2 / m - meanY * meanY2;
  const covY1_Y1 = sumY1_Y1 / m - meanY1 * meanY1;
  const covY1_Y2 = sumY1_Y2 / m - meanY1 * meanY2;
  const covY2_Y2 = sumY2_Y2 / m - meanY2 * meanY2;
  
  const det = covY1_Y1 * covY2_Y2 - covY1_Y2 * covY1_Y2;
  if (Math.abs(det) < 1e-10) return 0.5;
  
  const phi1 = (covY_Y1 * covY2_Y2 - covY_Y2 * covY1_Y2) / det;
  const phi2 = (covY_Y2 * covY1_Y1 - covY_Y1 * covY1_Y2) / det;
  
  const discriminant = phi1 * phi1 + 4 * phi2;
  
  if (discriminant >= 0) {
    const lambda1 = (phi1 + Math.sqrt(discriminant)) / 2;
    const lambda2 = (phi1 - Math.sqrt(discriminant)) / 2;
    return Math.max(Math.abs(lambda1), Math.abs(lambda2));
  } else {
    return Math.sqrt(-phi2);
  }
}

/**
 * Calculate Granger causality (simplified F-test)
 */
function calculateGrangerCausality(
  clock: number[],
  target: number[],
  lag: number = 2
): { causality: boolean; fStatistic: number; pValue: number } {
  if (clock.length < lag + 3 || target.length < lag + 3) {
    return { causality: false, fStatistic: 0, pValue: 1 };
  }
  
  const n = target.length - lag;
  
  let ssrRestricted = 0;
  let ssrUnrestricted = 0;
  
  for (let t = lag; t < target.length; t++) {
    let predRestricted = 0;
    let predUnrestricted = 0;
    
    for (let l = 1; l <= lag; l++) {
      predRestricted += 0.3 * target[t - l];
      predUnrestricted += 0.25 * target[t - l] + 0.15 * clock[t - l];
    }
    
    const actualMean = target.slice(lag).reduce((a, b) => a + b, 0) / n;
    const residRestricted = target[t] - predRestricted;
    const residUnrestricted = target[t] - predUnrestricted;
    
    ssrRestricted += residRestricted * residRestricted;
    ssrUnrestricted += residUnrestricted * residUnrestricted;
  }
  
  const df1 = lag;
  const df2 = n - 2 * lag - 1;
  
  if (df2 <= 0 || ssrUnrestricted <= 0) {
    return { causality: false, fStatistic: 0, pValue: 1 };
  }
  
  const fStatistic = ((ssrRestricted - ssrUnrestricted) / df1) / (ssrUnrestricted / df2);
  
  const pValue = 1 - fDistributionCDF(fStatistic, df1, df2);
  const causality = pValue < 0.05;
  
  return { causality, fStatistic, pValue };
}

/**
 * F-distribution CDF approximation
 */
function fDistributionCDF(f: number, d1: number, d2: number): number {
  if (f <= 0) return 0;
  
  const x = d2 / (d2 + d1 * f);
  return 1 - incompleteBeta(x, d2 / 2, d1 / 2);
}

/**
 * Incomplete beta function approximation
 */
function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  
  const bt = Math.exp(
    a * Math.log(x) + b * Math.log(1 - x) -
    logGamma(a) - logGamma(b) + logGamma(a + b)
  );
  
  if (x < (a + 1) / (a + b + 2)) {
    return bt * betaCF(x, a, b) / a;
  } else {
    return 1 - bt * betaCF(1 - x, b, a) / b;
  }
}

function betaCF(x: number, a: number, b: number): number {
  const maxIter = 100;
  const eps = 1e-10;
  
  let qab = a + b;
  let qap = a + 1;
  let qam = a - 1;
  let c = 1;
  let d = 1 - qab * x / qap;
  if (Math.abs(d) < eps) d = eps;
  d = 1 / d;
  let h = d;
  
  for (let m = 1; m <= maxIter; m++) {
    let m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < eps) d = eps;
    c = 1 + aa / c;
    if (Math.abs(c) < eps) c = eps;
    d = 1 / d;
    h *= d * c;
    
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < eps) d = eps;
    c = 1 + aa / c;
    if (Math.abs(c) < eps) c = eps;
    d = 1 / d;
    let del = d * c;
    h *= del;
    
    if (Math.abs(del - 1) < eps) break;
  }
  
  return h;
}

function logGamma(x: number): number {
  const coeffs = [
    76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.001208650973866179, -0.000005395239384953
  ];
  
  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  
  for (let j = 0; j < 6; j++) {
    ser += coeffs[j] / ++y;
  }
  
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}

/**
 * Proper Granger causality using OLS regression
 */
function calculateProperGrangerCausality(
  clock: number[],
  target: number[],
  lag: number = 2
): { causality: boolean; fStatistic: number; pValue: number } {
  if (clock.length < lag + 5 || target.length < lag + 5) {
    return { causality: false, fStatistic: 0, pValue: 1 };
  }
  
  const n = target.length - lag;
  
  const Y: number[] = [];
  const X_restricted: number[][] = [];
  const X_unrestricted: number[][] = [];
  
  for (let t = lag; t < target.length; t++) {
    Y.push(target[t]);
    
    const row_r: number[] = [1];
    const row_u: number[] = [1];
    
    for (let l = 1; l <= lag; l++) {
      row_r.push(target[t - l]);
      row_u.push(target[t - l]);
      row_u.push(clock[t - l]);
    }
    
    X_restricted.push(row_r);
    X_unrestricted.push(row_u);
  }
  
  const ssrRestricted = fitOLSAndGetSSR(X_restricted, Y);
  const ssrUnrestricted = fitOLSAndGetSSR(X_unrestricted, Y);
  
  const df1 = lag;
  const df2 = n - 2 * lag - 1;
  
  if (df2 <= 0 || ssrUnrestricted <= 1e-10) {
    return { causality: false, fStatistic: 0, pValue: 1 };
  }
  
  const fStatistic = ((ssrRestricted - ssrUnrestricted) / df1) / (ssrUnrestricted / df2);
  const pValue = 1 - fDistributionCDF(Math.max(0, fStatistic), df1, df2);
  const causality = pValue < 0.05 && fStatistic > 0;
  
  return { causality, fStatistic, pValue };
}

/**
 * OLS fitting returning sum of squared residuals
 */
function fitOLSAndGetSSR(X: number[][], Y: number[]): number {
  const n = X.length;
  const p = X[0].length;
  
  const XtX: number[][] = Array(p).fill(0).map(() => Array(p).fill(0));
  const XtY: number[] = Array(p).fill(0);
  
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < p; j++) {
      XtY[j] += X[i][j] * Y[i];
      for (let k = 0; k < p; k++) {
        XtX[j][k] += X[i][j] * X[i][k];
      }
    }
  }
  
  const beta = solveLinearSystem(XtX, XtY);
  if (!beta) return Infinity;
  
  let ssr = 0;
  for (let i = 0; i < n; i++) {
    let pred = 0;
    for (let j = 0; j < p; j++) {
      pred += X[i][j] * beta[j];
    }
    const resid = Y[i] - pred;
    ssr += resid * resid;
  }
  
  return ssr;
}

/**
 * Solve linear system using Gaussian elimination
 */
function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const n = A.length;
  const aug: number[][] = A.map((row, i) => [...row, b[i]]);
  
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) {
        maxRow = row;
      }
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
    
    if (Math.abs(aug[col][col]) < 1e-10) return null;
    
    for (let row = col + 1; row < n; row++) {
      const factor = aug[row][col] / aug[col][col];
      for (let j = col; j <= n; j++) {
        aug[row][j] -= factor * aug[col][j];
      }
    }
  }
  
  const x: number[] = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = aug[i][n];
    for (let j = i + 1; j < n; j++) {
      x[i] -= aug[i][j] * x[j];
    }
    x[i] /= aug[i][i];
  }
  
  return x;
}

/**
 * Run single phase shift test
 */
function runPhaseShiftTest(shiftHours: number): PhaseShiftResult {
  const { clock, target } = generateClockTargetPair(24, 2, 0, 0.5, 0.1);
  
  const originalEigenvalue = calculateAR2Eigenvalue(target);
  const originalGranger = calculateProperGrangerCausality(clock, target, 2);
  
  const shiftedClock = shiftTimeSeries(clock, shiftHours, 2);
  const shiftedTarget = shiftTimeSeries(target, shiftHours, 2);
  
  const shiftedEigenvalue = calculateAR2Eigenvalue(shiftedTarget);
  const shiftedGranger = calculateProperGrangerCausality(shiftedClock, target, 2);
  
  const eigenvalueDeviation = Math.abs(shiftedEigenvalue - originalEigenvalue) / Math.max(originalEigenvalue, 0.01);
  const eigenvalueStable = eigenvalueDeviation < 0.15;
  
  const causalityBroken = originalGranger.causality && !shiftedGranger.causality;
  
  const phaseSpecificityProven = eigenvalueStable && causalityBroken;
  
  return {
    shiftHours,
    originalEigenvalue,
    shiftedEigenvalue,
    eigenvalueStable,
    originalCausality: originalGranger.causality,
    shiftedCausality: shiftedGranger.causality,
    causalityBroken,
    phaseSpecificityProven,
  };
}

/**
 * Run full Phase Shift benchmark
 */
export function runPhaseShiftBenchmark(
  numTrials: number = 100
): PhaseShiftBenchmarkResult {
  const shiftHours = [6, 12, 18];
  const results: PhaseShiftResult[] = [];
  
  for (const shift of shiftHours) {
    for (let trial = 0; trial < numTrials / shiftHours.length; trial++) {
      const result = runPhaseShiftTest(shift);
      results.push(result);
    }
  }
  
  const eigenvalueStableCount = results.filter(r => r.eigenvalueStable).length;
  const causalityBrokenCount = results.filter(r => r.causalityBroken).length;
  const phaseSpecificCount = results.filter(r => r.phaseSpecificityProven).length;
  
  const eigenvalueStabilityRate = eigenvalueStableCount / results.length;
  const causalityBreakRate = causalityBrokenCount / results.length;
  const phaseSpecificityRate = phaseSpecificCount / results.length;
  
  const eigenvalueDeviations = results.map(r => 
    Math.abs(r.shiftedEigenvalue - r.originalEigenvalue) / r.originalEigenvalue
  );
  const meanEigenvalueDeviation = eigenvalueDeviations.reduce((a, b) => a + b, 0) / eigenvalueDeviations.length;
  
  const at12Hours = results.filter(r => r.shiftHours === 12);
  const at12HoursPhaseSpecific = at12Hours.filter(r => r.phaseSpecificityProven).length / at12Hours.length;
  
  const success = eigenvalueStabilityRate > 0.7 && causalityBreakRate > 0.3;
  
  return {
    success,
    hypothesis: "When clock phase is shifted by 12 hours, eigenvalue remains stable but Granger causality breaks",
    testCount: results.length,
    results,
    summary: {
      eigenvalueStabilityRate,
      causalityBreakRate,
      phaseSpecificityRate,
      meanEigenvalueDeviation,
    },
    interpretation: success
      ? `PASSED: Phase shift test confirms temporal specificity. Eigenvalue stable (${(eigenvalueStabilityRate * 100).toFixed(0)}%) while causality breaks (${(causalityBreakRate * 100).toFixed(0)}%). TIMING matters, not just correlation.`
      : `PARTIAL: Eigenvalue stability ${(eigenvalueStabilityRate * 100).toFixed(0)}%, causality break ${(causalityBreakRate * 100).toFixed(0)}%. Further investigation needed.`,
  };
}

/**
 * Run targeted phase shift analysis
 */
export function analyzePhaseShift(
  shiftHours: number,
  numTrials: number = 50
): {
  shiftHours: number;
  eigenvalueStabilityRate: number;
  causalityBreakRate: number;
  phaseSpecificityRate: number;
  trials: PhaseShiftResult[];
} {
  const trials: PhaseShiftResult[] = [];
  
  for (let i = 0; i < numTrials; i++) {
    const result = runPhaseShiftTest(shiftHours);
    trials.push(result);
  }
  
  return {
    shiftHours,
    eigenvalueStabilityRate: trials.filter(t => t.eigenvalueStable).length / trials.length,
    causalityBreakRate: trials.filter(t => t.causalityBroken).length / trials.length,
    phaseSpecificityRate: trials.filter(t => t.phaseSpecificityProven).length / trials.length,
    trials,
  };
}
