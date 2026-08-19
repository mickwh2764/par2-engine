/**
 * Granger Causality Testing Module
 * 
 * Tests whether clock genes "Granger-cause" target genes,
 * providing causal inference beyond correlation.
 * 
 * LIMITATIONS NOTED:
 * - This is a simplified implementation for exploratory analysis
 * - For publication-grade inference, use established R/Python stats packages
 * - Results should be treated as hypothesis-generating, not confirmatory
 */

export interface GrangerResult {
  clockGene: string;
  targetGene: string;
  fStatistic: number;
  pValue: number;
  significant: boolean;
  direction: 'clock→target' | 'target→clock' | 'bidirectional' | 'none';
  lags: number;
  interpretation: string;
  warnings: string[];
  minimumSamplesRequired: number;
  actualSamples: number;
}

export interface VARCoefficients {
  targetLag1: number;
  targetLag2: number;
  clockLag1: number;
  clockLag2: number;
  intercept: number;
}

const MIN_SAMPLES_FOR_GRANGER = 15;

/**
 * Fit AR model and compute residual sum of squares
 */
function fitAR(y: number[], lags: number): { rss: number; df: number; coefficients: number[] } | null {
  const n = y.length;
  if (n <= lags + 1) {
    return null;
  }

  const X: number[][] = [];
  const Y: number[] = [];

  for (let t = lags; t < n; t++) {
    const row = [1];
    for (let l = 1; l <= lags; l++) {
      row.push(y[t - l]);
    }
    X.push(row);
    Y.push(y[t]);
  }

  const beta = ordinaryLeastSquares(X, Y);
  if (!beta) return null;

  let rss = 0;
  for (let i = 0; i < Y.length; i++) {
    const predicted = X[i].reduce((sum, x, j) => sum + x * beta[j], 0);
    rss += Math.pow(Y[i] - predicted, 2);
  }

  return { rss, df: Y.length - beta.length, coefficients: beta };
}

/**
 * Fit VAR model (target ~ target_lags + clock_lags)
 */
function fitVAR(target: number[], clock: number[], lags: number): { rss: number; df: number; dfRestriction: number; coefficients: VARCoefficients } | null {
  const n = Math.min(target.length, clock.length);
  if (n <= 2 * lags + 1) {
    return null;
  }

  const X: number[][] = [];
  const Y: number[] = [];

  for (let t = lags; t < n; t++) {
    const row = [1];
    for (let l = 1; l <= lags; l++) {
      row.push(target[t - l]);
    }
    for (let l = 1; l <= lags; l++) {
      row.push(clock[t - l]);
    }
    X.push(row);
    Y.push(target[t]);
  }

  const beta = ordinaryLeastSquares(X, Y);
  if (!beta) return null;

  let rss = 0;
  for (let i = 0; i < Y.length; i++) {
    const predicted = X[i].reduce((sum, x, j) => sum + x * beta[j], 0);
    rss += Math.pow(Y[i] - predicted, 2);
  }

  const numParams = 1 + 2 * lags;
  
  return { 
    rss, 
    df: Y.length - numParams,
    dfRestriction: lags,
    coefficients: {
      intercept: beta[0],
      targetLag1: beta[1] || 0,
      targetLag2: beta[2] || 0,
      clockLag1: beta[lags + 1] || 0,
      clockLag2: beta[lags + 2] || 0
    }
  };
}

/**
 * Ordinary least squares solver with stability check
 */
function ordinaryLeastSquares(X: number[][], Y: number[]): number[] | null {
  const n = X.length;
  const p = X[0].length;

  if (n < p) return null;

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
  return beta;
}

/**
 * Solve linear system Ax = b using Gaussian elimination with pivoting
 */
function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const n = A.length;
  const augmented = A.map((row, i) => [...row, b[i]]);

  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
        maxRow = k;
      }
    }
    [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];

    if (Math.abs(augmented[i][i]) < 1e-10) {
      return null;
    }

    for (let k = i + 1; k < n; k++) {
      const factor = augmented[k][i] / augmented[i][i];
      for (let j = i; j <= n; j++) {
        augmented[k][j] -= factor * augmented[i][j];
      }
    }
  }

  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = augmented[i][n];
    for (let j = i + 1; j < n; j++) {
      x[i] -= augmented[i][j] * x[j];
    }
    x[i] /= augmented[i][i];
  }

  return x;
}

/**
 * Approximate p-value from F distribution using Abramowitz & Stegun approximation
 * For more accurate p-values, use a proper stats library
 */
function approximateFPValue(F: number, df1: number, df2: number): number {
  if (F <= 0 || df1 <= 0 || df2 <= 0) return 1;
  if (!isFinite(F)) return 0;
  
  const a = df1 / 2;
  const b = df2 / 2;
  const x = df2 / (df2 + df1 * F);
  
  const beta = incompleteBeta(x, b, a);
  return Math.max(0, Math.min(1, beta));
}

/**
 * Incomplete beta function approximation
 */
function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  
  const lnBeta = lnGamma(a) + lnGamma(b) - lnGamma(a + b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lnBeta) / a;
  
  let sum = 1;
  let term = 1;
  for (let n = 1; n < 200; n++) {
    term *= (n - 1 - b) * x / n;
    sum += term;
    if (Math.abs(term) < 1e-10) break;
  }
  
  return Math.min(1, front * sum);
}

/**
 * Log gamma function approximation (Lanczos)
 */
function lnGamma(z: number): number {
  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
  }
  z -= 1;
  const c = [
    76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.001208650973866179, -0.000005395239384953
  ];
  let x = 1.000000000190015;
  for (let i = 0; i < 6; i++) {
    x += c[i] / (z + i + 1);
  }
  const t = z + 5.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

/**
 * Validate input arrays
 */
function validateInputs(clockValues: number[], targetValues: number[], lags: number): string[] {
  const warnings: string[] = [];
  
  if (clockValues.length !== targetValues.length) {
    warnings.push('Clock and target arrays have different lengths');
  }
  
  if (clockValues.some(v => !isFinite(v)) || targetValues.some(v => !isFinite(v))) {
    warnings.push('Arrays contain NaN or Infinite values');
  }
  
  const n = Math.min(clockValues.length, targetValues.length);
  if (n < MIN_SAMPLES_FOR_GRANGER) {
    warnings.push(`Only ${n} samples provided; minimum ${MIN_SAMPLES_FOR_GRANGER} recommended for reliable Granger causality test`);
  }
  
  if (lags * 2 >= n - 1) {
    warnings.push(`Too many lags (${lags}) for sample size (${n}); results unreliable`);
  }
  
  return warnings;
}

/**
 * Test Granger causality: does clock "cause" target?
 */
export function testGrangerCausality(
  clockGene: string,
  targetGene: string,
  clockValues: number[],
  targetValues: number[],
  lags: number = 2
): GrangerResult {
  const warnings = validateInputs(clockValues, targetValues, lags);
  const n = Math.min(clockValues.length, targetValues.length);
  
  if (n < lags * 2 + 3) {
    return {
      clockGene,
      targetGene,
      fStatistic: 0,
      pValue: 1,
      significant: false,
      direction: 'none',
      lags,
      interpretation: `Insufficient data for Granger causality test. Need at least ${lags * 2 + 3} timepoints, have ${n}.`,
      warnings,
      minimumSamplesRequired: MIN_SAMPLES_FOR_GRANGER,
      actualSamples: n
    };
  }

  const restrictedModel = fitAR(targetValues, lags);
  const unrestrictedModel = fitVAR(targetValues, clockValues, lags);

  if (!restrictedModel || !unrestrictedModel) {
    return {
      clockGene,
      targetGene,
      fStatistic: 0,
      pValue: 1,
      significant: false,
      direction: 'none',
      lags,
      interpretation: 'Model fitting failed - check data for collinearity or insufficient variation',
      warnings: [...warnings, 'OLS solver returned null - possible numerical instability'],
      minimumSamplesRequired: MIN_SAMPLES_FOR_GRANGER,
      actualSamples: n
    };
  }

  const rssR = restrictedModel.rss;
  const rssU = unrestrictedModel.rss;
  const dfR = restrictedModel.df;
  const dfU = unrestrictedModel.df;
  const numRestrictions = lags;

  if (dfU <= 0 || rssU <= 0) {
    return {
      clockGene,
      targetGene,
      fStatistic: 0,
      pValue: 1,
      significant: false,
      direction: 'none',
      lags,
      interpretation: 'Degrees of freedom exhausted - need more data points',
      warnings: [...warnings, 'Model has zero degrees of freedom'],
      minimumSamplesRequired: MIN_SAMPLES_FOR_GRANGER,
      actualSamples: n
    };
  }

  const fStatistic = ((rssR - rssU) / numRestrictions) / (rssU / dfU);
  const pValue = approximateFPValue(fStatistic, numRestrictions, dfU);
  const significant = pValue < 0.05;

  const reverseRestricted = fitAR(clockValues, lags);
  const reverseUnrestricted = fitVAR(clockValues, targetValues, lags);
  
  let reverseSignificant = false;
  if (reverseRestricted && reverseUnrestricted && reverseUnrestricted.df > 0) {
    const fReverse = ((reverseRestricted.rss - reverseUnrestricted.rss) / numRestrictions) / (reverseUnrestricted.rss / reverseUnrestricted.df);
    const pReverse = approximateFPValue(fReverse, numRestrictions, reverseUnrestricted.df);
    reverseSignificant = pReverse < 0.05;
  }

  let direction: GrangerResult['direction'];
  if (significant && reverseSignificant) {
    direction = 'bidirectional';
  } else if (significant) {
    direction = 'clock→target';
  } else if (reverseSignificant) {
    direction = 'target→clock';
  } else {
    direction = 'none';
  }

  let interpretation: string;
  switch (direction) {
    case 'clock→target':
      interpretation = `${clockGene} Granger-causes ${targetGene} (p=${pValue.toFixed(4)}): past values of ${clockGene} improve prediction of ${targetGene} beyond its own history`;
      break;
    case 'target→clock':
      interpretation = `Reverse causality: ${targetGene} Granger-causes ${clockGene}`;
      break;
    case 'bidirectional':
      interpretation = `Bidirectional Granger causality: ${clockGene} and ${targetGene} mutually influence each other`;
      break;
    default:
      interpretation = `No significant Granger causality detected between ${clockGene} and ${targetGene} (p=${pValue.toFixed(4)})`;
  }

  if (n < MIN_SAMPLES_FOR_GRANGER) {
    warnings.push('CAUTION: Result may be unreliable due to small sample size');
    interpretation += '. NOTE: Small sample size limits reliability.';
  }

  return {
    clockGene,
    targetGene,
    fStatistic,
    pValue,
    significant,
    direction,
    lags,
    interpretation,
    warnings,
    minimumSamplesRequired: MIN_SAMPLES_FOR_GRANGER,
    actualSamples: n
  };
}

/**
 * Batch Granger causality testing
 */
export function batchGrangerTest(
  pairs: Array<{ clock: string; target: string; clockValues: number[]; targetValues: number[] }>,
  lags: number = 2
): GrangerResult[] {
  return pairs.map(p => testGrangerCausality(p.clock, p.target, p.clockValues, p.targetValues, lags));
}
