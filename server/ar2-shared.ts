/**
 * Shared AR(2) fitting module.
 *
 * Consolidates the core autoregressive(2) OLS fit, eigenvalue extraction and
 * related helpers into a single canonical implementation.  Every server module
 * that needs to fit x(t) = φ₁·x(t-1) + φ₂·x(t-2) + ε should import from
 * here rather than redefining the algorithm locally.
 */

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface AR2Result {
  /** AR(2) coefficient on x(t-1) */
  phi1: number;
  /** AR(2) coefficient on x(t-2) */
  phi2: number;
  /** Dominant eigenvalue modulus |λ| */
  eigenvalue: number;
  /** Coefficient of determination */
  r2: number;
  /** Whether the characteristic roots are complex (oscillatory) */
  isComplex: boolean;
}

export interface AR2FullResult extends AR2Result {
  /** Residuals from the fitted model */
  residuals: number[];
  /** Predictions from the fitted model */
  predictions: number[];
}

// ────────────────────────────────────────────────────────────────────────────
// Core fit
// ────────────────────────────────────────────────────────────────────────────

/**
 * Fit a mean-centred AR(2) model to a univariate time series via OLS normal
 * equations.
 *
 * Returns null when the series is too short (< `minLength`, default 5) or the
 * design matrix is singular.
 */
export function fitAR2(
  series: number[],
  options: { minLength?: number; meanCenter?: boolean } = {},
): AR2Result | null {
  const minLength = options.minLength ?? 5;
  const meanCenter = options.meanCenter ?? true;

  const n = series.length;
  if (n < minLength) return null;

  const mean = meanCenter
    ? series.reduce((a, b) => a + b, 0) / n
    : 0;
  const centered = meanCenter ? series.map(v => v - mean) : series;

  // Form lagged arrays
  const Y  = centered.slice(2);
  const Y1 = centered.slice(1, n - 1);
  const Y2 = centered.slice(0, n - 2);

  // Normal equations: (X'X) β = X'y  for a 2-column design [Y1, Y2]
  let s11 = 0, s22 = 0, s12 = 0, sy1 = 0, sy2 = 0;
  for (let i = 0; i < Y.length; i++) {
    s11 += Y1[i] * Y1[i];
    s22 += Y2[i] * Y2[i];
    s12 += Y1[i] * Y2[i];
    sy1 += Y[i]  * Y1[i];
    sy2 += Y[i]  * Y2[i];
  }

  const det = s11 * s22 - s12 * s12;
  if (Math.abs(det) < 1e-10) return null;

  const phi1 = (sy1 * s22 - sy2 * s12) / det;
  const phi2 = (sy2 * s11 - sy1 * s12) / det;

  const { eigenvalue, isComplex } = computeEigenvalue(phi1, phi2);

  // R² (always centered, matching standard statistical practice)
  const meanY = Y.reduce((a, b) => a + b, 0) / Y.length;
  const ssTot = Y.reduce((sum, y) => sum + (y - meanY) ** 2, 0);
  let ssRes = 0;
  for (let i = 0; i < Y.length; i++) {
    const e = Y[i] - phi1 * Y1[i] - phi2 * Y2[i];
    ssRes += e * e;
  }
  const r2 = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;

  return { phi1, phi2, eigenvalue, r2, isComplex };
}

/**
 * Like {@link fitAR2} but also returns residuals and predictions.
 */
export function fitAR2Full(
  series: number[],
  options: { minLength?: number; meanCenter?: boolean } = {},
): AR2FullResult | null {
  const minLength = options.minLength ?? 5;
  const meanCenter = options.meanCenter ?? true;

  const n = series.length;
  if (n < minLength) return null;

  const mean = meanCenter
    ? series.reduce((a, b) => a + b, 0) / n
    : 0;
  const centered = meanCenter ? series.map(v => v - mean) : series;

  const Y  = centered.slice(2);
  const Y1 = centered.slice(1, n - 1);
  const Y2 = centered.slice(0, n - 2);

  let s11 = 0, s22 = 0, s12 = 0, sy1 = 0, sy2 = 0;
  for (let i = 0; i < Y.length; i++) {
    s11 += Y1[i] * Y1[i];
    s22 += Y2[i] * Y2[i];
    s12 += Y1[i] * Y2[i];
    sy1 += Y[i]  * Y1[i];
    sy2 += Y[i]  * Y2[i];
  }

  const det = s11 * s22 - s12 * s12;
  if (Math.abs(det) < 1e-10) return null;

  const phi1 = (sy1 * s22 - sy2 * s12) / det;
  const phi2 = (sy2 * s11 - sy1 * s12) / det;

  const { eigenvalue, isComplex } = computeEigenvalue(phi1, phi2);

  const predictions: number[] = [];
  const residuals: number[] = [];
  let ssRes = 0;
  const meanY = Y.reduce((a, b) => a + b, 0) / Y.length;
  const ssTot = Y.reduce((sum, y) => sum + (y - meanY) ** 2, 0);
  for (let i = 0; i < Y.length; i++) {
    const pred = phi1 * Y1[i] + phi2 * Y2[i];
    predictions.push(pred);
    const e = Y[i] - pred;
    residuals.push(e);
    ssRes += e * e;
  }
  const r2 = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;

  return { phi1, phi2, eigenvalue, r2, isComplex, residuals, predictions };
}

// ────────────────────────────────────────────────────────────────────────────
// Uncertainty
// ────────────────────────────────────────────────────────────────────────────

export interface AR2Interval {
  /** Point estimate of |λ| */
  eigenvalue: number;
  /**
   * Percentile confidence interval for |λ| as [low, high].
   *
   * Unlike the point estimate, interval bounds are not clamped to the
   * stationary region: on a near-critical series the upper bound can exceed 1
   * (and phi2CI can fall below −1). That is the correct percentile interval —
   * clamping it would understate the uncertainty — but it means an interval
   * should not be displayed alongside a clamped point estimate without saying
   * which is which.
   */
  eigenvalueCI: [number, number];
  /** Percentile confidence interval for φ₁ */
  phi1CI: [number, number];
  /** Percentile confidence interval for φ₂ */
  phi2CI: [number, number];
  /** Series length the interval was computed from */
  n: number;
}

/**
 * Residual-bootstrap confidence interval for an AR(2) fit.
 *
 * Resamples the fitted residuals with replacement, regenerates the series from
 * the fitted recursion, refits, and takes the percentile interval over the
 * refits — the standard interval for autoregressive coefficients, and the only
 * one available for designs with a single pooled sample per timepoint.
 *
 * A per-gene |λ| is far less precise than its decimal places suggest: at 24
 * evenly sampled timepoints the interval is typically ~0.4 wide, and below ~24
 * points the estimator is biased upward. Differences narrower than the interval
 * are not interpretable.
 *
 * Returns null when the series is too short or the fit is singular.
 */
export function bootstrapAR2(
  series: number[],
  options: { draws?: number; ci?: number; seed?: number; minLength?: number } = {},
): AR2Interval | null {
  const draws = options.draws ?? 2000;
  const ciLevel = options.ci ?? 95;

  const fit = fitAR2Full(series, { minLength: options.minLength });
  if (!fit) return null;

  const n = series.length;
  const mean = series.reduce((a, b) => a + b, 0) / n;
  const centered = series.map(v => v - mean);

  const residMean = fit.residuals.reduce((a, b) => a + b, 0) / fit.residuals.length;
  const resid = fit.residuals.map(e => e - residMean);

  const rand = mulberry32(options.seed ?? 42);
  const lambdas: number[] = [];
  const phi1s: number[] = [];
  const phi2s: number[] = [];

  for (let b = 0; b < draws; b++) {
    const xb = new Array<number>(n);
    xb[0] = centered[0];
    xb[1] = centered[1];
    for (let t = 2; t < n; t++) {
      const e = resid[Math.floor(rand() * resid.length)];
      xb[t] = fit.phi1 * xb[t - 1] + fit.phi2 * xb[t - 2] + e;
    }
    const refit = fitAR2(xb, { minLength: options.minLength });
    if (!refit) continue;
    lambdas.push(refit.eigenvalue);
    phi1s.push(refit.phi1);
    phi2s.push(refit.phi2);
  }
  if (lambdas.length === 0) return null;

  const lo = (100 - ciLevel) / 2;
  const hi = 100 - lo;
  return {
    eigenvalue: fit.eigenvalue,
    eigenvalueCI: [percentile(lambdas, lo), percentile(lambdas, hi)],
    phi1CI: [percentile(phi1s, lo), percentile(phi1s, hi)],
    phi2CI: [percentile(phi2s, lo), percentile(phi2s, hi)],
    n,
  };
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

/** Small deterministic PRNG so intervals are reproducible across runs. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Eigenvalue helpers
// ────────────────────────────────────────────────────────────────────────────

/**
 * Compute the dominant eigenvalue modulus from AR(2) coefficients.
 *
 * Characteristic polynomial: z² − φ₁·z − φ₂ = 0
 * Discriminant Δ = φ₁² + 4·φ₂
 *
 * - Δ ≥ 0 → two real roots: |λ| = max(|r₁|, |r₂|)
 * - Δ < 0 → complex conjugate pair: |λ| = √(−φ₂)
 */
export function computeEigenvalue(
  phi1: number,
  phi2: number,
): { eigenvalue: number; isComplex: boolean } {
  const disc = phi1 * phi1 + 4 * phi2;

  if (disc >= 0) {
    const sqrtDisc = Math.sqrt(disc);
    const r1 = (phi1 + sqrtDisc) / 2;
    const r2 = (phi1 - sqrtDisc) / 2;
    return { eigenvalue: Math.max(Math.abs(r1), Math.abs(r2)), isComplex: false };
  }
  return { eigenvalue: Math.sqrt(-phi2), isComplex: true };
}

/**
 * Classify the AR(2) dynamics based on eigenvalue modulus.
 */
export function classifyStability(eigenvalue: number): {
  stability: string;
  stabilityColor: string;
} {
  if (eigenvalue >= 1.0) {
    return { stability: 'Explosive', stabilityColor: '#ef4444' };
  }
  if (eigenvalue >= 0.95) {
    return { stability: 'Boundary', stabilityColor: '#f97316' };
  }
  if (eigenvalue >= 0.7) {
    return { stability: 'Highly Persistent', stabilityColor: '#eab308' };
  }
  if (eigenvalue >= 0.4) {
    return { stability: 'Moderate', stabilityColor: '#22c55e' };
  }
  return { stability: 'Transient', stabilityColor: '#6b7280' };
}

/**
 * Compute eigenperiod (intrinsic oscillation period) from AR(2) coefficients.
 * Only meaningful when roots are complex.
 *
 * @param samplingInterval  Hours between consecutive observations (default 2).
 * @returns Period in hours, or `null` when roots are real.
 */
export function computeEigenperiod(
  phi1: number,
  phi2: number,
  samplingInterval: number = 2,
): number | null {
  const disc = phi1 * phi1 + 4 * phi2;
  if (disc >= 0) return null;

  const omega = Math.atan2(Math.sqrt(-disc), phi1);
  if (omega <= 0) return null;
  return (2 * Math.PI / omega) * samplingInterval;
}

/**
 * Half-life of an AR(2) process.
 *
 *   t½ = samplingInterval × ln(2) / (−ln(|λ|))
 */
export function computeHalfLife(
  eigenvalue: number,
  samplingInterval: number = 2,
): number | null {
  if (eigenvalue <= 0 || eigenvalue >= 1) return null;
  return samplingInterval * Math.log(2) / (-Math.log(eigenvalue));
}
