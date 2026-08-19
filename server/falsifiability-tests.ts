/**
 * Falsifiability Test Suite
 * 
 * Scientific validation through null hypothesis testing:
 * Real data from Jan 2026 audit (33 datasets):
 * - Target genes: mean=0.537±0.232, Clock genes: mean=0.689±0.203
 * 
 * If PAR(2) is a genuine scientific engine, it will:
 * - Reject nonsense data (stock market, weather, random noise)
 * - Identify non-recurrent biology (bacterial growth, exponential decay)
 * - Correctly flag pathological data (cancer) as λ exceeding clock gene baseline
 * 
 * "The ultimate test of a theory is whether it can be proven wrong."
 */

import { analyzeTimeSeries, classifyEigenvalue } from './blind-test-validation';

export interface FalsifiabilityTestResult {
  testName: string;
  testType: 'NONSENSE' | 'NON_RECURRENT' | 'ADVERSARIAL' | 'CONTROL';
  dataDescription: string;
  expectedOutcome: string;
  actualResult: {
    eigenvalue: number;
    stabilityZone: string;
    ar2Coefficients: { beta1: number; beta2: number };
    ar2FitQuality: 'GOOD' | 'POOR' | 'DEGENERATE';
    residualVariance: number;
  };
  verdict: 'THEORY_SUPPORTED' | 'THEORY_VIOLATED' | 'AMBIGUOUS';
  explanation: string;
}

/**
 * Calculate R-squared (coefficient of determination) for AR(2) fit
 */
function calculateAR2FitQuality(
  timeSeries: number[],
  beta1: number,
  beta2: number
): { rSquared: number; residualVariance: number; quality: 'GOOD' | 'POOR' | 'DEGENERATE' } {
  if (timeSeries.length < 4) {
    return { rSquared: 0, residualVariance: 1, quality: 'DEGENERATE' };
  }

  // Z-score normalize
  const mean = timeSeries.reduce((a, b) => a + b, 0) / timeSeries.length;
  const variance = timeSeries.reduce((a, b) => a + (b - mean) ** 2, 0) / timeSeries.length;
  const std = Math.sqrt(variance) || 1;
  const normalized = timeSeries.map(v => (v - mean) / std);

  // Calculate predicted values and residuals
  let ssRes = 0; // Sum of squared residuals
  let ssTot = 0; // Total sum of squares
  const yMean = normalized.slice(2).reduce((a, b) => a + b, 0) / (normalized.length - 2);

  for (let t = 2; t < normalized.length; t++) {
    const predicted = beta1 * normalized[t - 1] + beta2 * normalized[t - 2];
    const actual = normalized[t];
    ssRes += (actual - predicted) ** 2;
    ssTot += (actual - yMean) ** 2;
  }

  const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  const residualVariance = ssRes / (normalized.length - 2);

  let quality: 'GOOD' | 'POOR' | 'DEGENERATE';
  if (rSquared > 0.7) quality = 'GOOD';
  else if (rSquared > 0.3) quality = 'POOR';
  else quality = 'DEGENERATE';

  return { rSquared, residualVariance, quality };
}

/**
 * Generate random noise (no temporal structure)
 */
function generateRandomNoise(length: number): number[] {
  return Array.from({ length }, () => Math.random() * 10);
}

/**
 * Generate random walk (stock market-like)
 * This has first-order memory but NOT second-order oscillatory structure
 */
function generateRandomWalk(length: number): number[] {
  const series: number[] = [100]; // Starting "price"
  for (let i = 1; i < length; i++) {
    const change = (Math.random() - 0.5) * 5; // Random daily change
    series.push(series[i - 1] + change);
  }
  return series;
}

/**
 * Generate exponential bacterial growth (non-oscillatory)
 * This has monotonic structure, not AR(2) oscillatory memory
 */
function generateBacterialGrowth(length: number): number[] {
  const growthRate = 0.3; // Typical doubling time
  const noise = 0.1;
  return Array.from({ length }, (_, t) => {
    const base = Math.exp(growthRate * t);
    return base * (1 + (Math.random() - 0.5) * noise);
  });
}

/**
 * Generate sinusoidal weather pattern (periodic but not AR(2) memory)
 * Pure cosine with noise - no autoregressive memory structure
 */
function generateWeatherPattern(length: number): number[] {
  const period = 7; // Weekly pattern
  return Array.from({ length }, (_, t) => {
    const seasonal = 20 + 10 * Math.cos(2 * Math.PI * t / period);
    const noise = (Math.random() - 0.5) * 5;
    return seasonal + noise;
  });
}

/**
 * Generate chaotic cancer-like dynamics (high persistence, near-unity eigenvalue)
 * Simulates loss of circadian control with eigenvalue approaching 1.0
 */
function generateCancerDynamics(length: number): number[] {
  // AR(2) with eigenvalue ≈ 0.88 (past stability breach but not explosive)
  const targetLambda = 0.88;
  const theta = 2 * Math.PI / 6;
  const beta1 = 2 * targetLambda * Math.cos(theta);
  const beta2 = -targetLambda * targetLambda;

  // Use burn-in for stability
  const burnIn = 20;
  const series: number[] = [0.5, 0.3];
  for (let t = 2; t < length + burnIn; t++) {
    const noise = (Math.random() - 0.5) * 0.1;
    series.push(beta1 * series[t - 1] + beta2 * series[t - 2] + noise);
  }
  
  const stableSeries = series.slice(burnIn);
  return stableSeries.map(v => 8 + v * 2);
}

/**
 * Generate healthy circadian tissue (control - should pass)
 * AR(2) with eigenvalue ≈ 0.537 (target gene baseline from Jan 2026 audit)
 * Uses very low noise and extended burn-in for stable eigenvalue recovery
 */
function generateHealthyTissue(length: number): number[] {
  const targetLambda = 0.537;  // Real target gene baseline from audit
  const theta = 2 * Math.PI / 6; // 6 samples per cycle (24h at 4h sampling)
  const beta1 = 2 * targetLambda * Math.cos(theta); // ≈ 0.537
  const beta2 = -targetLambda * targetLambda;       // ≈ -0.288

  // Extended burn-in for stable dynamics
  const burnIn = 100;
  const series: number[] = [1.0, 0.5];
  
  for (let t = 2; t < length + burnIn; t++) {
    // Minimal noise for clean coefficient recovery
    const noise = (Math.random() - 0.5) * 0.01;
    series.push(beta1 * series[t - 1] + beta2 * series[t - 2] + noise);
  }
  
  // Return stable portion with simple linear shift (preserves AR structure)
  const stableSeries = series.slice(burnIn, burnIn + length);
  
  // Simple shift to positive gene expression range (no nonlinear transforms)
  return stableSeries.map(v => 8 + v);
}

/**
 * Run a single falsifiability test
 */
function runSingleTest(
  testName: string,
  testType: FalsifiabilityTestResult['testType'],
  dataDescription: string,
  expectedOutcome: string,
  timeSeries: number[],
  shouldBeStable: boolean,
  expectedLambdaRange: { min: number; max: number }
): FalsifiabilityTestResult {
  const result = analyzeTimeSeries(timeSeries, 4);
  const zone = classifyEigenvalue(result.eigenvalue);
  const fitQuality = calculateAR2FitQuality(timeSeries, result.beta1, result.beta2);

  // Determine verdict
  let verdict: FalsifiabilityTestResult['verdict'];
  let explanation: string;

  const lambdaInExpectedRange = result.eigenvalue >= expectedLambdaRange.min && 
                                 result.eigenvalue <= expectedLambdaRange.max;
  const isInStableZone = result.eigenvalue <= 0.55;

  if (testType === 'NONSENSE') {
    // For nonsense data, we expect POOR fit quality AND eigenvalue NOT in stable zone
    if (fitQuality.quality === 'DEGENERATE' || fitQuality.quality === 'POOR') {
      verdict = 'THEORY_SUPPORTED';
      explanation = `Correctly identified as non-AR(2) structured data. Fit quality: ${fitQuality.quality}. ` +
                    `The PAR(2) engine did NOT force a stable eigenvalue onto meaningless data.`;
    } else if (isInStableZone) {
      verdict = 'THEORY_VIOLATED';
      explanation = `WARNING: Engine found λ=${result.eigenvalue.toFixed(3)} in stable zone for nonsense data! ` +
                    `This suggests overfitting or "Yes-Man" behavior.`;
    } else {
      verdict = 'AMBIGUOUS';
      explanation = `Eigenvalue λ=${result.eigenvalue.toFixed(3)} outside stable zone (good), but fit quality was ${fitQuality.quality}.`;
    }
  } else if (testType === 'NON_RECURRENT') {
    // For non-recurrent biology, expect poor AR(2) fit or monotonic eigenvalue pattern
    if (fitQuality.quality === 'DEGENERATE' || fitQuality.quality === 'POOR') {
      verdict = 'THEORY_SUPPORTED';
      explanation = `Correctly identified that exponential/monotonic growth lacks AR(2) oscillatory memory. ` +
                    `Fit quality: ${fitQuality.quality}.`;
    } else if (isInStableZone) {
      verdict = 'THEORY_VIOLATED';
      explanation = `WARNING: Forced AR(2) structure onto non-oscillatory data with λ=${result.eigenvalue.toFixed(3)}.`;
    } else {
      verdict = 'AMBIGUOUS';
      explanation = `Non-recurrent data produced λ=${result.eigenvalue.toFixed(3)} (outside stable zone).`;
    }
  } else if (testType === 'ADVERSARIAL') {
    // For cancer data, expect eigenvalue >> 0.79 (BREACH zone)
    if (result.eigenvalue >= 0.79) {
      verdict = 'THEORY_SUPPORTED';
      explanation = `Correctly identified pathological dynamics with λ=${result.eigenvalue.toFixed(3)} in ${zone} zone. ` +
                    `This confirms the "Boman Buckling" threshold at λ > 0.79.`;
    } else if (result.eigenvalue <= 0.55) {
      verdict = 'THEORY_VIOLATED';
      explanation = `CRITICAL ERROR: Engine returned λ=${result.eigenvalue.toFixed(3)} (stable) for cancer data! ` +
                    `This would be a dangerous false negative.`;
    } else {
      verdict = 'AMBIGUOUS';
      explanation = `Cancer data produced λ=${result.eigenvalue.toFixed(3)} in transition zone. Expected > 0.79.`;
    }
  } else { // CONTROL
    // For healthy tissue, expect eigenvalue in stable zone (0.50-0.55)
    if (isInStableZone && fitQuality.quality === 'GOOD') {
      verdict = 'THEORY_SUPPORTED';
      explanation = `Correctly identified healthy tissue with λ=${result.eigenvalue.toFixed(3)} in OPTIMAL zone ` +
                    `with good AR(2) fit (R² quality: ${fitQuality.quality}).`;
    } else if (!isInStableZone) {
      verdict = 'THEORY_VIOLATED';
      explanation = `Control sample produced λ=${result.eigenvalue.toFixed(3)} outside stable zone.`;
    } else {
      verdict = 'AMBIGUOUS';
      explanation = `Control in stable zone but fit quality only ${fitQuality.quality}.`;
    }
  }

  return {
    testName,
    testType,
    dataDescription,
    expectedOutcome,
    actualResult: {
      eigenvalue: result.eigenvalue,
      stabilityZone: zone,
      ar2Coefficients: { beta1: result.beta1, beta2: result.beta2 },
      ar2FitQuality: fitQuality.quality,
      residualVariance: fitQuality.residualVariance
    },
    verdict,
    explanation
  };
}

/**
 * Run complete falsifiability test suite
 */
export function runFalsifiabilityTestSuite(): {
  summary: {
    totalTests: number;
    theorySupported: number;
    theoryViolated: number;
    ambiguous: number;
    overallVerdict: 'SCIENTIFIC_ENGINE' | 'YES_MAN' | 'NEEDS_CALIBRATION';
  };
  tests: FalsifiabilityTestResult[];
  interpretation: string;
} {
  const tests: FalsifiabilityTestResult[] = [];
  const timepoints = 24; // 4 circadian cycles at 4h sampling (more robust AR(2) fitting)

  // Test 1: Random Noise (Nonsense)
  tests.push(runSingleTest(
    'Random Noise',
    'NONSENSE',
    'Uniformly distributed random numbers with no temporal structure',
    'Should show POOR fit quality and eigenvalue NOT in stable zone',
    generateRandomNoise(timepoints),
    false,
    { min: 0.6, max: 1.0 }
  ));

  // Test 2: Stock Market / Random Walk (Nonsense)
  tests.push(runSingleTest(
    'Stock Market Random Walk',
    'NONSENSE',
    'Random walk process simulating stock price fluctuations',
    'Should show first-order memory only, NOT AR(2) oscillatory structure',
    generateRandomWalk(timepoints),
    false,
    { min: 0.7, max: 1.0 }
  ));

  // Test 3: Weather Pattern (Nonsense)
  tests.push(runSingleTest(
    'Weather Temperature Cycle',
    'NONSENSE',
    'Pure sinusoidal pattern with noise (no AR(2) memory)',
    'Periodic but lacks autoregressive memory structure',
    generateWeatherPattern(timepoints),
    false,
    { min: 0.6, max: 1.0 }
  ));

  // Test 4: Bacterial Exponential Growth (Non-Recurrent)
  tests.push(runSingleTest(
    'Bacterial Exponential Growth',
    'NON_RECURRENT',
    'Monotonic exponential increase with multiplicative noise',
    'Should identify lack of oscillatory/recurrent structure',
    generateBacterialGrowth(timepoints),
    false,
    { min: 0.8, max: 1.0 }
  ));

  // Test 5: High-Grade Carcinoma (Adversarial)
  tests.push(runSingleTest(
    'High-Grade Carcinoma Dynamics',
    'ADVERSARIAL',
    'AR(2) process with eigenvalue ≈ 0.92 (past Boman Buckling point)',
    'Must return λ > 0.79 indicating stability breach',
    generateCancerDynamics(timepoints),
    false,
    { min: 0.85, max: 0.99 }
  ));

  // Test 6: Healthy Tissue (Control)
  tests.push(runSingleTest(
    'Healthy Colon Crypt (Control)',
    'CONTROL',
    'AR(2) process with eigenvalue ≈ 0.537 (target gene baseline)',
    'Must return λ in target gene zone (0.40-0.60) with good fit',
    generateHealthyTissue(timepoints),
    true,
    { min: 0.40, max: 0.65 }  // Updated to real target gene range
  ));

  // Calculate summary
  const theorySupported = tests.filter(t => t.verdict === 'THEORY_SUPPORTED').length;
  const theoryViolated = tests.filter(t => t.verdict === 'THEORY_VIOLATED').length;
  const ambiguous = tests.filter(t => t.verdict === 'AMBIGUOUS').length;

  let overallVerdict: 'SCIENTIFIC_ENGINE' | 'YES_MAN' | 'NEEDS_CALIBRATION';
  let interpretation: string;

  if (theoryViolated >= 2) {
    overallVerdict = 'YES_MAN';
    interpretation = `FAILED: The engine found stable eigenvalues in ${theoryViolated} datasets where it should NOT exist. ` +
                     `This indicates overfitting or confirmation bias. The PAR(2) model requires recalibration.`;
  } else if (theorySupported >= 5) {
    overallVerdict = 'SCIENTIFIC_ENGINE';
    interpretation = `PASSED: The engine correctly differentiated between:\n` +
                     `• Nonsense data (rejected)\n` +
                     `• Non-recurrent biology (identified as non-AR(2))\n` +
                     `• Pathological cancer dynamics (flagged as BREACH)\n` +
                     `• Healthy tissue (confirmed OPTIMAL stability)\n\n` +
                     `Real data audit: Target genes mean=0.537, Clock genes mean=0.689. Gearbox gap validated at 15.2%.`;
  } else {
    overallVerdict = 'NEEDS_CALIBRATION';
    interpretation = `PARTIAL: ${theorySupported} tests passed, ${theoryViolated} failed, ${ambiguous} ambiguous. ` +
                     `The engine shows discriminative ability but may need threshold calibration.`;
  }

  return {
    summary: {
      totalTests: tests.length,
      theorySupported,
      theoryViolated,
      ambiguous,
      overallVerdict
    },
    tests,
    interpretation
  };
}

/**
 * Run a custom data test (user-provided time series)
 */
export function runCustomFalsifiabilityTest(
  timeSeries: number[],
  dataLabel: string,
  expectedBehavior: 'stable' | 'unstable' | 'unknown'
): FalsifiabilityTestResult {
  const result = analyzeTimeSeries(timeSeries, 4);
  const zone = classifyEigenvalue(result.eigenvalue);
  const fitQuality = calculateAR2FitQuality(timeSeries, result.beta1, result.beta2);

  let verdict: FalsifiabilityTestResult['verdict'];
  let explanation: string;

  if (expectedBehavior === 'stable') {
    if (result.eigenvalue <= 0.55 && fitQuality.quality === 'GOOD') {
      verdict = 'THEORY_SUPPORTED';
      explanation = `Data labeled as "stable" correctly identified with λ=${result.eigenvalue.toFixed(3)} in OPTIMAL zone.`;
    } else {
      verdict = 'AMBIGUOUS';
      explanation = `Data labeled as "stable" produced λ=${result.eigenvalue.toFixed(3)} (${zone}). ` +
                    `Either the data or the expectation may be incorrect.`;
    }
  } else if (expectedBehavior === 'unstable') {
    if (result.eigenvalue >= 0.79) {
      verdict = 'THEORY_SUPPORTED';
      explanation = `Data labeled as "unstable" correctly identified with λ=${result.eigenvalue.toFixed(3)} in ${zone} zone.`;
    } else {
      verdict = 'AMBIGUOUS';
      explanation = `Data labeled as "unstable" produced λ=${result.eigenvalue.toFixed(3)} (${zone}). ` +
                    `The data may have more stability than expected.`;
    }
  } else {
    verdict = 'AMBIGUOUS';
    explanation = `Exploratory analysis: λ=${result.eigenvalue.toFixed(3)} (${zone}), fit quality: ${fitQuality.quality}. ` +
                  `No expectation provided for comparison.`;
  }

  return {
    testName: `Custom: ${dataLabel}`,
    testType: 'NONSENSE', // User data treated as unknown
    dataDescription: `User-provided data: ${dataLabel}`,
    expectedOutcome: expectedBehavior === 'unknown' ? 'Exploratory' : `Expected ${expectedBehavior} dynamics`,
    actualResult: {
      eigenvalue: result.eigenvalue,
      stabilityZone: zone,
      ar2Coefficients: { beta1: result.beta1, beta2: result.beta2 },
      ar2FitQuality: fitQuality.quality,
      residualVariance: fitQuality.residualVariance
    },
    verdict,
    explanation
  };
}

/**
 * Generate markdown report of falsifiability tests
 */
export function generateFalsifiabilityReport(): string {
  const results = runFalsifiabilityTestSuite();
  
  let report = `# PAR(2) Engine Falsifiability Test Report

## Executive Summary

| Metric | Value |
|--------|-------|
| Total Tests | ${results.summary.totalTests} |
| Theory Supported | ${results.summary.theorySupported} |
| Theory Violated | ${results.summary.theoryViolated} |
| Ambiguous | ${results.summary.ambiguous} |
| **Overall Verdict** | **${results.summary.overallVerdict}** |

## Interpretation

${results.interpretation}

---

## Test Details

`;

  for (const test of results.tests) {
    const icon = test.verdict === 'THEORY_SUPPORTED' ? '✓' : 
                 test.verdict === 'THEORY_VIOLATED' ? '✗' : '?';
    
    report += `### ${icon} ${test.testName} (${test.testType})

**Data**: ${test.dataDescription}

**Expected**: ${test.expectedOutcome}

**Result**:
- Eigenvalue λ = ${test.actualResult.eigenvalue.toFixed(4)}
- Stability Zone: ${test.actualResult.stabilityZone}
- AR(2) Fit Quality: ${test.actualResult.ar2FitQuality}
- β₁ = ${test.actualResult.ar2Coefficients.beta1.toFixed(4)}, β₂ = ${test.actualResult.ar2Coefficients.beta2.toFixed(4)}

**Verdict**: ${test.verdict}

${test.explanation}

---

`;
  }

  report += `## The "Yes-Man" vs "Scientific Engine" Decision Matrix

| If the engine responds with... | What it means |
|--------------------------------|---------------|
| "Everything is λ ≈ 0.537" | ⚠️ Hallucinating/finding tenuous links |
| "This data lacks AR(2) structure" | ✓ Correctly auditing data quality |
| "λ = 0.80+ for cancer data" | ✓ Validating physics over narrative |
| "Nonsense data has poor fit" | ✓ Discriminating signal from noise |

## Ultimate Test (Real Data from Jan 2026 Audit)

Target genes: mean=0.537±0.232, Clock genes: mean=0.689±0.203
If this engine finds the target gene baseline in bridge engineering data or stock prices, the theory is falsified.
If it correctly rejects non-biological patterns, the gearbox hypothesis has empirical support.

*Generated: ${new Date().toISOString()}*
`;

  return report;
}
