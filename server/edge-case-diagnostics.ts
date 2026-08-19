export interface EdgeCaseDiagnostic {
  id: string;
  label: string;
  triggered: boolean;
  severity: 'info' | 'warning' | 'critical';
  detail: string;
}

export interface QualityCheck {
  name: string;
  passed: boolean;
  value: string;
  explanation: string;
  severity: 'info' | 'warning' | 'critical';
}

export interface DiagnosticsResult {
  edgeCaseDiagnostics: EdgeCaseDiagnostic[];
  qualityChecks: QualityCheck[];
  overallConfidence: 'High' | 'Moderate' | 'Low' | 'Unreliable';
  confidenceColor: string;
  confidenceScore: number;
}

export interface DiagnosticsInput {
  series: number[];
  phi1: number;
  phi2: number;
  eigenvalue: number;
  r2: number;
  residuals: number[];
  sampleCount: number;
  ljungBoxPassed: boolean;
  ljungBoxPValue: number;
  acf: number[];
}

export interface ADFResult {
  testStatistic: number;
  criticalValue1: number;
  criticalValue5: number;
  criticalValue10: number;
  stationary: boolean;
  nLags: number;
  nObs: number;
}

export function computeADF(series: number[], maxLags?: number): ADFResult {
  const n = series.length;
  const nLags = maxLags ?? Math.min(Math.floor(Math.pow(n - 1, 1 / 3)), Math.floor((n - 3) / 3));
  const effectiveLags = Math.max(0, Math.min(nLags, Math.floor((n - 3) / 2)));

  const critN = Math.max(n, 25);
  const criticalValue1 = -3.43 - 6.0 / critN + 2.0 / (critN * critN);
  const criticalValue5 = -2.86 - 2.74 / critN + 0.3 / (critN * critN);
  const criticalValue10 = -2.57 - 1.67 / critN + 0.2 / (critN * critN);

  if (n < 8) {
    return { testStatistic: 0, criticalValue1, criticalValue5, criticalValue10, stationary: false, nLags: 0, nObs: n };
  }

  const dy: number[] = [];
  for (let i = 1; i < n; i++) dy.push(series[i] - series[i - 1]);

  const start = effectiveLags + 1;
  const m = dy.length - start;
  if (m < 4) {
    return { testStatistic: 0, criticalValue1, criticalValue5, criticalValue10, stationary: false, nLags: effectiveLags, nObs: m };
  }

  const nRegressors = 2 + effectiveLags;
  const Y: number[] = [];
  const X: number[][] = [];
  for (let t = start; t < dy.length; t++) {
    Y.push(dy[t]);
    const row: number[] = [1, series[t]];
    for (let j = 1; j <= effectiveLags; j++) {
      row.push(dy[t - j]);
    }
    X.push(row);
  }

  const p = nRegressors;
  const XtX: number[][] = Array.from({ length: p }, () => Array(p).fill(0));
  const XtY: number[] = Array(p).fill(0);
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < p; j++) {
      XtY[j] += X[i][j] * Y[i];
      for (let k = 0; k < p; k++) {
        XtX[j][k] += X[i][j] * X[i][k];
      }
    }
  }

  const inv = invertMatrix(XtX, p);
  if (!inv) {
    return { testStatistic: 0, criticalValue1, criticalValue5, criticalValue10, stationary: false, nLags: effectiveLags, nObs: m };
  }

  const beta: number[] = Array(p).fill(0);
  for (let j = 0; j < p; j++) {
    for (let k = 0; k < p; k++) {
      beta[j] += inv[j][k] * XtY[k];
    }
  }

  const gamma = beta[1];

  let ssRes = 0;
  for (let i = 0; i < m; i++) {
    let pred = 0;
    for (let j = 0; j < p; j++) pred += beta[j] * X[i][j];
    ssRes += (Y[i] - pred) ** 2;
  }
  const sigma2 = ssRes / Math.max(1, m - p);
  const seGamma = Math.sqrt(Math.max(0, sigma2 * inv[1][1]));

  const testStatistic = seGamma > 1e-15 ? gamma / seGamma : -99;

  return {
    testStatistic,
    criticalValue1,
    criticalValue5,
    criticalValue10,
    stationary: testStatistic < criticalValue5,
    nLags: effectiveLags,
    nObs: m
  };
}

function invertMatrix(M: number[][], n: number): number[][] | null {
  const aug: number[][] = M.map((row, i) => {
    const newRow = [...row];
    for (let j = 0; j < n; j++) newRow.push(i === j ? 1 : 0);
    return newRow;
  });

  for (let col = 0; col < n; col++) {
    let maxVal = Math.abs(aug[col][col]);
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > maxVal) {
        maxVal = Math.abs(aug[row][col]);
        maxRow = row;
      }
    }
    if (maxVal < 1e-12) return null;
    if (maxRow !== col) [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

    const pivot = aug[col][col];
    for (let j = 0; j < 2 * n; j++) aug[col][j] /= pivot;

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = aug[row][col];
      for (let j = 0; j < 2 * n; j++) aug[row][j] -= factor * aug[col][j];
    }
  }

  return aug.map(row => row.slice(n));
}

export function computeSampleSizeError(n: number): number {
  if (n < 15) return 0.25;
  if (n < 25) return 0.17;
  if (n < 50) return 0.10;
  if (n < 100) return 0.06;
  if (n < 200) return 0.03;
  return 0.01;
}

export function runEdgeCaseDiagnostics(input: DiagnosticsInput): EdgeCaseDiagnostic[] {
  const { series, phi1, phi2, eigenvalue, r2, residuals, sampleCount: n } = input;
  const diagnostics: EdgeCaseDiagnostic[] = [];
  const mean = series.reduce((a, b) => a + b, 0) / n;
  const variance = series.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance) || 1;

  {
    const meanIdx = (n - 1) / 2;
    let sumXY = 0, sumXX = 0;
    for (let i = 0; i < n; i++) {
      const dx = i - meanIdx;
      sumXY += dx * (series[i] - mean);
      sumXX += dx * dx;
    }
    const slope = sumXX > 0 ? sumXY / sumXX : 0;
    const slopeNorm = Math.abs(slope * n / std);
    const trendDetected = slopeNorm > 3.0 && eigenvalue > 0.9;
    diagnostics.push({
      id: 'trend_detection',
      label: 'Trend / Non-Stationarity',
      triggered: trendDetected,
      severity: trendDetected ? 'critical' : 'info',
      detail: trendDetected
        ? `Significant linear trend detected (normalized slope = ${slopeNorm.toFixed(1)}). The near-critical |λ| = ${eigenvalue.toFixed(4)} may reflect a data trend rather than true biological persistence. Consider detrending before analysis.`
        : `No significant trend detected (normalized slope = ${slopeNorm.toFixed(1)}). Eigenvalue reflects genuine temporal dynamics.`
    });
  }

  {
    const expectedError = computeSampleSizeError(n);
    const lowBound = Math.max(0, eigenvalue - expectedError);
    const highBound = Math.min(1.2, eigenvalue + expectedError);
    const lowSample = n < 50;
    diagnostics.push({
      id: 'sample_size_confidence',
      label: 'Eigenvalue Confidence Band',
      triggered: lowSample,
      severity: n < 25 ? 'critical' : lowSample ? 'warning' : 'info',
      detail: lowSample
        ? `With only ${n} samples, the true |λ| likely falls between ${lowBound.toFixed(3)} and ${highBound.toFixed(3)} (±${expectedError.toFixed(3)}). A reported |λ| of ${eigenvalue.toFixed(3)} could be as high as ${highBound.toFixed(3)} or as low as ${lowBound.toFixed(3)} due to finite-sample noise.`
        : `With ${n} samples, eigenvalue precision is ±${expectedError.toFixed(3)}. Confidence band: [${lowBound.toFixed(3)}, ${highBound.toFixed(3)}].`
    });
  }

  {
    const nParams = 3;
    const nEffective = Math.max(0, n - 2);
    const npRatio = nEffective / nParams;
    const criticallyLow = npRatio < 5;
    const dangerouslyLow = npRatio < 3;
    diagnostics.push({
      id: 'np_ratio',
      label: 'Observations-per-Parameter Ratio (n/p)',
      triggered: criticallyLow,
      severity: dangerouslyLow ? 'critical' : criticallyLow ? 'warning' : 'info',
      detail: dangerouslyLow
        ? `n/p = ${npRatio.toFixed(2)} (${nEffective} effective observations / ${nParams} parameters) is dangerously low. AR(2) estimates are likely unreliable with overfitting risk. Minimum n/p ≥ 10 recommended; n/p < 3 means the model is essentially unconstrained. Eigenvalue estimates should be treated as rough approximations only.`
        : criticallyLow
          ? `n/p = ${npRatio.toFixed(2)} (${nEffective} effective observations / ${nParams} parameters) is below the recommended minimum of 10. AR(2) coefficient estimates have high variance and limited degrees of freedom for significance testing. Results are suggestive but underpowered.`
          : `n/p = ${npRatio.toFixed(2)} (${nEffective} effective observations / ${nParams} parameters). Adequate for AR(2) estimation.`
    });
  }

  {
    let ar3Better = false;
    let ar3Detail = '';
    const centered = series.map(v => v - mean);
    if (n >= 10) {
      const Y3 = centered.slice(3);
      const Y3_1 = centered.slice(2, n - 1);
      const Y3_2 = centered.slice(1, n - 2);
      const Y3_3 = centered.slice(0, n - 3);
      const m = Y3.length;
      if (m >= 4) {
        const X = [Y3_1, Y3_2, Y3_3];
        const XtX: number[][] = Array.from({ length: 3 }, () => Array(3).fill(0));
        const XtY: number[] = Array(3).fill(0);
        for (let i = 0; i < m; i++) {
          for (let j = 0; j < 3; j++) {
            XtY[j] += X[j][i] * Y3[i];
            for (let k = 0; k < 3; k++) {
              XtX[j][k] += X[j][i] * X[k][i];
            }
          }
        }
        const det3 = XtX[0][0] * (XtX[1][1] * XtX[2][2] - XtX[1][2] * XtX[2][1])
          - XtX[0][1] * (XtX[1][0] * XtX[2][2] - XtX[1][2] * XtX[2][0])
          + XtX[0][2] * (XtX[1][0] * XtX[2][1] - XtX[1][1] * XtX[2][0]);
        if (Math.abs(det3) > 1e-10) {
          const inv: number[][] = Array.from({ length: 3 }, () => Array(3).fill(0));
          inv[0][0] = (XtX[1][1] * XtX[2][2] - XtX[1][2] * XtX[2][1]) / det3;
          inv[0][1] = (XtX[0][2] * XtX[2][1] - XtX[0][1] * XtX[2][2]) / det3;
          inv[0][2] = (XtX[0][1] * XtX[1][2] - XtX[0][2] * XtX[1][1]) / det3;
          inv[1][0] = (XtX[1][2] * XtX[2][0] - XtX[1][0] * XtX[2][2]) / det3;
          inv[1][1] = (XtX[0][0] * XtX[2][2] - XtX[0][2] * XtX[2][0]) / det3;
          inv[1][2] = (XtX[0][2] * XtX[1][0] - XtX[0][0] * XtX[1][2]) / det3;
          inv[2][0] = (XtX[1][0] * XtX[2][1] - XtX[1][1] * XtX[2][0]) / det3;
          inv[2][1] = (XtX[0][1] * XtX[2][0] - XtX[0][0] * XtX[2][1]) / det3;
          inv[2][2] = (XtX[0][0] * XtX[1][1] - XtX[0][1] * XtX[1][0]) / det3;
          const beta3 = [0, 0, 0];
          for (let j = 0; j < 3; j++) {
            for (let k = 0; k < 3; k++) {
              beta3[j] += inv[j][k] * XtY[k];
            }
          }
          const pred3 = Y3.map((_, i) => beta3[0] * Y3_1[i] + beta3[1] * Y3_2[i] + beta3[2] * Y3_3[i]);
          const ssRes3 = Y3.reduce((sum, y, i) => sum + (y - pred3[i]) ** 2, 0);
          const ssTot3 = Y3.reduce((sum, y) => sum + y * y, 0);
          const r2_ar3 = ssTot3 > 0 ? Math.max(0, 1 - ssRes3 / ssTot3) : 0;
          const Y2 = centered.slice(2);
          const ssResAR2 = residuals.reduce((sum, r) => sum + r * r, 0);
          const aicAR2 = m * Math.log(ssResAR2 / Math.max(1, Y2.length)) + 2 * 2;
          const aicAR3 = m * Math.log(ssRes3 / Math.max(1, m)) + 2 * 3;
          ar3Better = (aicAR3 < aicAR2 - 2) && (r2_ar3 - r2 > 0.02);
          ar3Detail = `AR(2) AIC: ${aicAR2.toFixed(1)}, AR(3) AIC: ${aicAR3.toFixed(1)}, AR(3) R²: ${r2_ar3.toFixed(4)}. ${ar3Better ? 'AR(3) fits meaningfully better — the signal may have 3rd-order memory the AR(2) model misses.' : 'AR(2) is adequate — no evidence of higher-order dynamics.'}`;
        } else {
          ar3Detail = 'Could not fit AR(3) — near-singular design matrix.';
        }
      } else {
        ar3Detail = 'Too few samples for AR(3) comparison.';
      }
    } else {
      ar3Detail = 'Too few samples for AR(3) comparison.';
    }
    diagnostics.push({
      id: 'model_order_check',
      label: 'Model Order (AR(3) Check)',
      triggered: ar3Better,
      severity: ar3Better ? 'warning' : 'info',
      detail: ar3Detail
    });
  }

  {
    const resN = residuals.length;
    if (resN >= 10) {
      const resMu = residuals.reduce((a, b) => a + b, 0) / resN;
      const resSigma = Math.sqrt(residuals.reduce((a, b) => a + (b - resMu) ** 2, 0) / resN) || 1;
      const standardized = residuals.map(r => (r - resMu) / resSigma);
      const skewness = standardized.reduce((a, b) => a + b ** 3, 0) / resN;
      const kurtosis = standardized.reduce((a, b) => a + b ** 4, 0) / resN - 3;
      const nonlinear = Math.abs(skewness) > 1.0 || Math.abs(kurtosis) > 3.0;
      diagnostics.push({
        id: 'nonlinearity_test',
        label: 'Non-Linearity Check',
        triggered: nonlinear,
        severity: nonlinear ? 'warning' : 'info',
        detail: nonlinear
          ? `Residuals show non-Gaussian shape (skewness: ${skewness.toFixed(2)}, excess kurtosis: ${kurtosis.toFixed(2)}). This suggests the signal may have nonlinear dynamics (e.g., sudden spikes, arrhythmia, panic events) that the linear AR(2) model cannot capture. Interpret eigenvalue with caution.`
          : `Residuals are approximately Gaussian (skewness: ${skewness.toFixed(2)}, excess kurtosis: ${kurtosis.toFixed(2)}). Linear AR(2) assumption is reasonable.`
      });
    } else {
      diagnostics.push({
        id: 'nonlinearity_test',
        label: 'Non-Linearity Check',
        triggered: false,
        severity: 'info',
        detail: 'Too few residuals to assess nonlinearity.'
      });
    }
  }

  {
    const resN = residuals.length;
    if (resN >= 10) {
      const resMu = residuals.reduce((a, b) => a + b, 0) / resN;
      const resSigma = Math.sqrt(residuals.reduce((a, b) => a + (b - resMu) ** 2, 0) / resN) || 1;
      const standardized = residuals.map(r => (r - resMu) / resSigma);
      const skew = standardized.reduce((a, b) => a + b ** 3, 0) / resN;
      const asymmetric = Math.abs(skew) > 0.5;
      diagnostics.push({
        id: 'residual_asymmetry',
        label: 'Waveform Asymmetry (Residual Skewness)',
        triggered: asymmetric,
        severity: asymmetric ? 'warning' : 'info',
        detail: asymmetric
          ? `Residual skewness = ${skew.toFixed(3)} (|skew| > 0.5). The underlying waveform may be asymmetric ("shark-fin" shape: fast rise/slow decay or vice versa). AR(2) models symmetric dynamics and may misestimate eigenvalue for strongly asymmetric signals. Consider comparing with a threshold AR model or verifying that gene rankings are robust.`
          : `Residual skewness = ${skew.toFixed(3)} (|skew| ≤ 0.5). No evidence of waveform asymmetry — the AR(2) symmetric dynamics assumption is reasonable.`
      });
    } else {
      diagnostics.push({
        id: 'residual_asymmetry',
        label: 'Waveform Asymmetry (Residual Skewness)',
        triggered: false,
        severity: 'info',
        detail: 'Too few residuals to assess waveform asymmetry.'
      });
    }
  }

  {
    const nearBoundary = eigenvalue > 0.93 && eigenvalue < 1.07;
    diagnostics.push({
      id: 'boundary_proximity',
      label: 'Stability Boundary Proximity',
      triggered: nearBoundary,
      severity: nearBoundary ? 'warning' : 'info',
      detail: nearBoundary
        ? `|λ| = ${eigenvalue.toFixed(4)} is very close to the stability boundary (|λ| = 1.0). Small data artifacts, trends, or sensor noise could push the estimate across this boundary. The distinction between "Near-Critical" and "Unstable" is unreliable in this range.`
        : `|λ| = ${eigenvalue.toFixed(4)} is comfortably within the ${eigenvalue < 0.93 ? 'stable' : 'unstable'} region.`
    });
  }

  {
    const adfResult = computeADF(series);
    const adfFailed = !adfResult.stationary;
    diagnostics.push({
      id: 'adf_stationarity',
      label: 'ADF Stationarity Test',
      triggered: adfFailed,
      severity: adfFailed ? 'warning' : 'info',
      detail: adfFailed
        ? `ADF test statistic = ${adfResult.testStatistic.toFixed(3)} (critical value at 5%: ${adfResult.criticalValue5.toFixed(3)}). The null hypothesis of a unit root cannot be rejected — the series may be non-stationary. AR(2) eigenvalue could be inflated by trends or drift. Consider differencing or detrending.`
        : `ADF test statistic = ${adfResult.testStatistic.toFixed(3)} < ${adfResult.criticalValue5.toFixed(3)} (5% critical value). The null hypothesis of a unit root is rejected — the series is stationary. AR(2) parameters are on firm ground.`
    });
  }

  return diagnostics;
}

export function runQualityChecks(input: DiagnosticsInput): QualityCheck[] {
  const { series, phi1, phi2, eigenvalue, r2, residuals, sampleCount: n, ljungBoxPassed, ljungBoxPValue, acf } = input;
  const mean = series.reduce((a, b) => a + b, 0) / n;
  const variance = series.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance) || 1;
  const checks: QualityCheck[] = [];

  const sampleAdequate = n >= 30;
  checks.push({
    name: 'Sample Size',
    passed: sampleAdequate,
    value: `${n} samples`,
    explanation: sampleAdequate
      ? `${n} samples provides reliable AR(2) estimation (minimum recommended: 30)`
      : `Only ${n} samples — AR(2) needs at least 30 for reliable estimation. Results may be unreliable.`,
    severity: n < 10 ? 'critical' : n < 30 ? 'warning' : 'info'
  });

  checks.push({
    name: 'Residual Whiteness (Ljung-Box)',
    passed: ljungBoxPassed,
    value: `p = ${ljungBoxPValue.toFixed(4)}`,
    explanation: ljungBoxPassed
      ? 'Residuals are white noise (p > 0.05) — the AR(2) model captured the time-series structure. No remaining patterns left unexplained.'
      : 'Residuals show autocorrelation (p < 0.05) — the AR(2) model may not fully capture the dynamics. A higher-order model or additional features might be needed.',
    severity: ljungBoxPassed ? 'info' : 'warning'
  });

  const r2Adequate = r2 >= 0.3;
  checks.push({
    name: 'Goodness of Fit (R-squared)',
    passed: r2Adequate,
    value: `R² = ${r2.toFixed(4)}`,
    explanation: r2 >= 0.7
      ? `The model explains ${(r2 * 100).toFixed(1)}% of the variance — excellent fit.`
      : r2 >= 0.3
        ? `The model explains ${(r2 * 100).toFixed(1)}% of the variance — acceptable fit. Some dynamics may not be captured by AR(2).`
        : `The model only explains ${(r2 * 100).toFixed(1)}% of the variance — poor fit. The data may not follow an AR(2) pattern, or may be too noisy.`,
    severity: r2 < 0.1 ? 'critical' : r2 < 0.3 ? 'warning' : 'info'
  });

  const isStationary = eigenvalue < 1.0;
  const adfResult = computeADF(series);
  const adfPassed = adfResult.stationary;
  const bothPass = isStationary && adfPassed;
  checks.push({
    name: 'Stationarity (Eigenvalue)',
    passed: isStationary,
    value: `|λ| = ${eigenvalue.toFixed(4)}`,
    explanation: isStationary
      ? `Eigenvalue modulus ${eigenvalue.toFixed(4)} < 1.0 — the process is stationary (stable). AR(2) parameters are meaningful.`
      : `Eigenvalue modulus ${eigenvalue.toFixed(4)} ≥ 1.0 — the process is non-stationary (explosive). The eigenvalue is outside the valid range and results may be artifacts of a trend or unit root.`,
    severity: isStationary ? 'info' : 'critical'
  });

  checks.push({
    name: 'Stationarity (ADF Test)',
    passed: adfPassed,
    value: `τ = ${adfResult.testStatistic.toFixed(3)}, cv₅% = ${adfResult.criticalValue5.toFixed(3)}`,
    explanation: adfPassed
      ? `Augmented Dickey-Fuller test rejects the unit root null (τ = ${adfResult.testStatistic.toFixed(3)} < ${adfResult.criticalValue5.toFixed(3)}). Formal statistical confirmation that the series is stationary.`
      : `Augmented Dickey-Fuller test cannot reject the unit root null (τ = ${adfResult.testStatistic.toFixed(3)} ≥ ${adfResult.criticalValue5.toFixed(3)}). The series may contain a unit root — AR(2) persistence could be inflated by non-stationarity.`,
    severity: adfPassed ? 'info' : 'warning'
  });

  const coeffRange = Math.abs(phi1) + Math.abs(phi2);
  const coeffReasonable = coeffRange < 3.0 && Math.abs(phi2) < 1.5;
  checks.push({
    name: 'Coefficient Plausibility',
    passed: coeffReasonable,
    value: `|φ₁| + |φ₂| = ${coeffRange.toFixed(3)}`,
    explanation: coeffReasonable
      ? 'AR(2) coefficients are within expected biological ranges — no sign of overfitting or numerical instability.'
      : 'AR(2) coefficients are unusually large — possible overfitting, near-collinearity, or data artifacts. Interpret with caution.',
    severity: coeffReasonable ? 'info' : 'warning'
  });

  const confBound = 1.96 / Math.sqrt(n);
  const significantLags = acf.filter(a => Math.abs(a) > confBound).length;
  const acfClean = significantLags <= Math.ceil(acf.length * 0.15);
  checks.push({
    name: 'Residual ACF Check',
    passed: acfClean,
    value: `${significantLags}/${acf.length} lags significant`,
    explanation: acfClean
      ? `Only ${significantLags} of ${acf.length} ACF lags exceed the 95% confidence band — consistent with white noise residuals.`
      : `${significantLags} of ${acf.length} ACF lags exceed the 95% confidence band — residuals may have remaining structure the AR(2) model did not capture.`,
    severity: acfClean ? 'info' : 'warning'
  });

  const cv = std / Math.abs(mean || 1);
  const varianceOk = cv < 5.0 && std > 1e-10;
  checks.push({
    name: 'Data Variance',
    passed: varianceOk,
    value: `CV = ${cv.toFixed(3)}`,
    explanation: varianceOk
      ? 'Data shows natural variability appropriate for time-series analysis.'
      : cv >= 5.0
        ? 'Extremely high coefficient of variation — data may contain outliers or measurement errors.'
        : 'Near-zero variance — data is essentially constant. AR(2) analysis is not meaningful.',
    severity: !varianceOk ? 'warning' : 'info'
  });

  return checks;
}

export function computeConfidenceScore(qualityChecks: QualityCheck[], edgeCaseDiagnostics: EdgeCaseDiagnostic[], input: DiagnosticsInput): { score: number; confidence: 'High' | 'Moderate' | 'Low' | 'Unreliable'; color: string } {
  let score = 100;
  const { sampleCount: n, eigenvalue, r2, ljungBoxPassed } = input;

  if (n < 10) score -= 40;
  else if (n < 30) score -= 20;
  else if (n < 100) score -= 5;

  if (!ljungBoxPassed) score -= 20;
  if (r2 < 0.1) score -= 30;
  else if (r2 < 0.3) score -= 15;

  if (eigenvalue >= 1.0) score -= 35;

  const coeffRange = Math.abs(input.phi1) + Math.abs(input.phi2);
  if (coeffRange >= 3.0 || Math.abs(input.phi2) >= 1.5) score -= 15;

  const confBound = 1.96 / Math.sqrt(n);
  const significantLags = input.acf.filter(a => Math.abs(a) > confBound).length;
  if (significantLags > Math.ceil(input.acf.length * 0.15)) score -= 10;

  const mean = input.series.reduce((a, b) => a + b, 0) / n;
  const variance = input.series.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance) || 1;
  const cv = std / Math.abs(mean || 1);
  if (cv >= 5.0 || std <= 1e-10) score -= 15;

  for (const d of edgeCaseDiagnostics) {
    if (!d.triggered) continue;
    switch (d.id) {
      case 'trend_detection': score -= 20; break;
      case 'model_order_check': score -= 10; break;
      case 'nonlinearity_test': score -= 10; break;
      case 'adf_stationarity': score -= 15; break;
    }
  }

  score = Math.max(0, Math.min(100, score));
  let confidence: 'High' | 'Moderate' | 'Low' | 'Unreliable';
  let color: string;
  if (score >= 75) { confidence = 'High'; color = '#22c55e'; }
  else if (score >= 50) { confidence = 'Moderate'; color = '#facc15'; }
  else if (score >= 25) { confidence = 'Low'; color = '#f97316'; }
  else { confidence = 'Unreliable'; color = '#ef4444'; }

  return { score, confidence, color };
}

export function runFullDiagnostics(input: DiagnosticsInput): DiagnosticsResult {
  const edgeCaseDiagnostics = runEdgeCaseDiagnostics(input);
  const qualityChecks = runQualityChecks(input);
  const { score, confidence, color } = computeConfidenceScore(qualityChecks, edgeCaseDiagnostics, input);
  return {
    edgeCaseDiagnostics,
    qualityChecks,
    overallConfidence: confidence,
    confidenceColor: color,
    confidenceScore: score,
  };
}

export function computeGapUncertainty(clockSampleCount: number, targetSampleCount: number, gap: number): { gapUncertainty: number; gapReliable: boolean } {
  const clockErr = computeSampleSizeError(clockSampleCount);
  const targetErr = computeSampleSizeError(targetSampleCount);
  const gapUncertainty = Math.sqrt(clockErr ** 2 + targetErr ** 2);
  const gapReliable = Math.abs(gap) > gapUncertainty;
  return { gapUncertainty, gapReliable };
}

export function computeAcf(residuals: number[], maxLags?: number): number[] {
  const acf: number[] = [];
  const maxLag = maxLags || Math.min(20, Math.floor(residuals.length / 4));
  const resMean = residuals.reduce((a, b) => a + b, 0) / residuals.length;
  const resVar = residuals.reduce((a, b) => a + (b - resMean) ** 2, 0);
  for (let lag = 1; lag <= maxLag; lag++) {
    let sum = 0;
    for (let t = lag; t < residuals.length; t++) {
      sum += (residuals[t] - resMean) * (residuals[t - lag] - resMean);
    }
    acf.push(resVar > 0 ? sum / resVar : 0);
  }
  return acf;
}

export function computeLjungBox(acf: number[], T: number): { ljungBoxPassed: boolean; ljungBoxPValue: number } {
  let ljungBoxQ = 0;
  const lbLags = Math.min(10, acf.length);
  for (let k = 0; k < lbLags; k++) {
    ljungBoxQ += (acf[k] * acf[k]) / (T - (k + 1));
  }
  ljungBoxQ *= T * (T + 2);
  const df = Math.max(1, lbLags - 2);
  let ljungBoxPValue = 1;
  if (ljungBoxQ > 0) {
    const x = ljungBoxQ / 2;
    const k = df / 2;
    let gammaLn = 0;
    for (let j = 1; j < k; j++) gammaLn += Math.log(j);
    const pApprox = Math.exp(-x + k * Math.log(x) - gammaLn);
    ljungBoxPValue = Math.min(1, Math.max(0, 1 - pApprox));
  }
  return { ljungBoxPassed: ljungBoxPValue > 0.05, ljungBoxPValue };
}

export function fitAR2WithDiagnostics(series: number[]): {
  phi1: number;
  phi2: number;
  eigenvalue: number;
  r2: number;
  residuals: number[];
  acf: number[];
  ljungBoxPassed: boolean;
  ljungBoxPValue: number;
  diagnostics: DiagnosticsResult;
} | null {
  const n = series.length;
  if (n < 5) return null;

  const mean = series.reduce((a, b) => a + b, 0) / n;
  const centered = series.map(v => v - mean);

  const Y = centered.slice(2);
  const Y1 = centered.slice(1, n - 1);
  const Y2 = centered.slice(0, n - 2);

  let sumY1Y1 = 0, sumY2Y2 = 0, sumY1Y2 = 0, sumYY1 = 0, sumYY2 = 0;
  for (let i = 0; i < Y.length; i++) {
    sumY1Y1 += Y1[i] * Y1[i];
    sumY2Y2 += Y2[i] * Y2[i];
    sumY1Y2 += Y1[i] * Y2[i];
    sumYY1 += Y[i] * Y1[i];
    sumYY2 += Y[i] * Y2[i];
  }

  const det = sumY1Y1 * sumY2Y2 - sumY1Y2 * sumY1Y2;
  let phi1 = 0, phi2 = 0;
  if (Math.abs(det) > 1e-10) {
    phi1 = (sumYY1 * sumY2Y2 - sumYY2 * sumY1Y2) / det;
    phi2 = (sumYY2 * sumY1Y1 - sumYY1 * sumY1Y2) / det;
  }

  const disc = phi1 * phi1 + 4 * phi2;
  let eigenvalue: number;
  if (disc >= 0) {
    const l1 = (phi1 + Math.sqrt(disc)) / 2;
    const l2 = (phi1 - Math.sqrt(disc)) / 2;
    eigenvalue = Math.max(Math.abs(l1), Math.abs(l2));
  } else {
    eigenvalue = Math.sqrt(-phi2);
  }

  const predicted = Y1.map((y1, i) => phi1 * y1 + phi2 * Y2[i]);
  const residuals = Y.map((y, i) => y - predicted[i]);
  const ssTot = Y.reduce((sum, y) => sum + y * y, 0);
  const ssRes = residuals.reduce((sum, r) => sum + r * r, 0);
  const r2 = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;

  const acf = computeAcf(residuals);
  const { ljungBoxPassed, ljungBoxPValue } = computeLjungBox(acf, residuals.length);

  const input: DiagnosticsInput = {
    series, phi1, phi2, eigenvalue, r2, residuals,
    sampleCount: n, ljungBoxPassed, ljungBoxPValue, acf
  };

  const diagnostics = runFullDiagnostics(input);

  return { phi1, phi2, eigenvalue, r2, residuals, acf, ljungBoxPassed, ljungBoxPValue, diagnostics };
}
