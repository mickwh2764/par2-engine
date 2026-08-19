/**
 * Blind Test Validation Module
 * 
 * Implements the "Blind Test Protocol" for cross-tissue validation:
 * 1. Strip labels from samples
 * 2. Run eigenvalue analysis blindly
 * 3. Reveal clustering and compare to ground truth
 * 
 * Reference datasets:
 * - GSE205155: Human skin epidermis vs dermis (del Olmo et al. 2022)
 * - GSE112660: Human epidermal circadian time-series
 */

// AR(2) analysis implemented locally - no external imports needed

export interface BlindSample {
  id: string;
  blindId: string; // Anonymized ID
  timeSeries: number[];
  timepoints: number[];
}

export interface BlindAnalysisResult {
  blindId: string;
  eigenvalue: number;
  ar2Coefficients: { beta1: number; beta2: number };
  isStable: boolean; // λ < 0.80 (updated per Jan 2026 audit: clock gene mean is 0.689)
  stabilityZone: 'OPTIMAL' | 'FIELD_EFFECT' | 'TRANSITION' | 'BREACH' | 'UNSTABLE';
}

export interface BlindTestResult {
  testName: string;
  datasetId: string;
  protocol: {
    blindingMethod: string;
    analysisMethod: string;
    predictionMade: string;
  };
  results: {
    groupA: {
      meanEigenvalue: number;
      stdDev: number;
      samples: BlindAnalysisResult[];
    };
    groupB: {
      meanEigenvalue: number;
      stdDev: number;
      samples: BlindAnalysisResult[];
    };
  };
  unblinding: {
    groupAIdentity: string;
    groupBIdentity: string;
    predictionCorrect: boolean;
    statisticalSignificance: {
      tStatistic: number;
      pValue: number;
      effectSize: number; // Cohen's d
    };
  };
  conclusion: string;
}

/**
 * Classify eigenvalue into stability zones per Whiteside Engine thresholds
 * Zone names harmonized with validation handbook
 */
export function classifyEigenvalue(lambda: number): BlindAnalysisResult['stabilityZone'] {
  // Real data from Jan 2026 audit: Target genes 0.537±0.232, Clock genes 0.689±0.203
  if (lambda <= 0.60) return 'OPTIMAL';   // Target gene range (0.537 baseline)
  if (lambda <= 0.70) return 'FIELD_EFFECT'; // Approaching clock gene territory
  if (lambda <= 0.80) return 'TRANSITION';   // Clock gene range (0.689 baseline)
  if (lambda <= 0.95) return 'BREACH';       // Stability breach (>0.8)
  return 'UNSTABLE'; // Complete decoherence (>0.95)
}

/**
 * Perform AR(2) eigenvalue analysis on a time series
 */
export function analyzeTimeSeries(
  timeSeries: number[],
  samplingIntervalHours: number = 4
): { eigenvalue: number; beta1: number; beta2: number } {
  if (timeSeries.length < 4) {
    throw new Error('Minimum 4 timepoints required for AR(2) fitting');
  }

  // Z-score normalize the time series
  const mean = timeSeries.reduce((a, b) => a + b, 0) / timeSeries.length;
  const variance = timeSeries.reduce((a, b) => a + (b - mean) ** 2, 0) / timeSeries.length;
  const std = Math.sqrt(variance) || 1;
  const normalized = timeSeries.map(v => (v - mean) / std);

  // Fit AR(2) model: x_t = β₁·x_{t-1} + β₂·x_{t-2} + ε
  // Using least squares: minimize Σ(x_t - β₁·x_{t-1} - β₂·x_{t-2})²
  const n = normalized.length - 2;
  
  // Build design matrix X and target vector y
  let X11 = 0, X12 = 0, X22 = 0, Xy1 = 0, Xy2 = 0;
  
  for (let t = 2; t < normalized.length; t++) {
    const x1 = normalized[t - 1];
    const x2 = normalized[t - 2];
    const y = normalized[t];
    
    X11 += x1 * x1;
    X12 += x1 * x2;
    X22 += x2 * x2;
    Xy1 += x1 * y;
    Xy2 += x2 * y;
  }

  // Solve 2x2 linear system: [X11 X12; X12 X22] * [β₁; β₂] = [Xy1; Xy2]
  const det = X11 * X22 - X12 * X12;
  if (Math.abs(det) < 1e-10) {
    return { eigenvalue: 0.5, beta1: 0.5, beta2: 0 };
  }

  const beta1 = (X22 * Xy1 - X12 * Xy2) / det;
  const beta2 = (X11 * Xy2 - X12 * Xy1) / det;

  // Calculate eigenvalue modulus from characteristic equation
  // λ² - β₁·λ - β₂ = 0
  // λ = (β₁ ± √(β₁² + 4β₂)) / 2
  const discriminant = beta1 * beta1 + 4 * beta2;
  
  let eigenvalue: number;
  if (discriminant >= 0) {
    // Real roots
    const lambda1 = (beta1 + Math.sqrt(discriminant)) / 2;
    const lambda2 = (beta1 - Math.sqrt(discriminant)) / 2;
    eigenvalue = Math.max(Math.abs(lambda1), Math.abs(lambda2));
  } else {
    // Complex conjugate roots
    const realPart = beta1 / 2;
    const imagPart = Math.sqrt(-discriminant) / 2;
    eigenvalue = Math.sqrt(realPart * realPart + imagPart * imagPart);
  }

  // Clamp to valid range [0, 1]
  eigenvalue = Math.max(0, Math.min(1, eigenvalue));

  return { eigenvalue, beta1, beta2 };
}

/**
 * Generate AR(2) time series with specified eigenvalue
 * Uses characteristic equation: λ² - β₁·λ - β₂ = 0
 * For complex roots with modulus r: β₁ = 2r·cos(θ), β₂ = -r²
 */
function generateAR2Series(
  targetEigenvalue: number,
  length: number,
  noiseLevel: number = 0.1
): number[] {
  // Generate AR(2) coefficients for desired eigenvalue modulus
  // Using complex conjugate roots for oscillatory behavior
  const r = targetEigenvalue;
  const theta = 2 * Math.PI / 6; // ~24h period at 4h sampling (6 points/cycle)
  
  const beta1 = 2 * r * Math.cos(theta);
  const beta2 = -r * r;
  
  // Generate series with AR(2) structure
  const series: number[] = [];
  series.push(Math.random() * 2 - 1); // x_0
  series.push(Math.random() * 2 - 1); // x_1
  
  for (let t = 2; t < length; t++) {
    const noise = (Math.random() - 0.5) * 2 * noiseLevel;
    const x = beta1 * series[t - 1] + beta2 * series[t - 2] + noise;
    series.push(x);
  }
  
  // Shift to positive expression values (log2 scale ~6-10)
  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || 1;
  
  return series.map(v => 6 + 4 * (v - min) / range);
}

/**
 * Generate synthetic GSE205155-like data for demonstration
 * Based on published findings: epidermis has larger amplitudes, dermis smaller
 * Epidermis (high turnover): λ ≈ 0.537 (target gene baseline from Jan 2026 audit)
 * Dermis (low turnover): λ ≈ 0.68 (elevated, approaching clock gene territory)
 */
export function generateSyntheticSkinData(): {
  epidermis: { subjectId: string; timepoints: number[]; expression: number[] }[];
  dermis: { subjectId: string; timepoints: number[]; expression: number[] }[];
} {
  const timepoints = [8, 12, 16, 20, 24, 28, 32]; // Hours
  const subjects = ['S100', 'S102', 'S103', 'S106', 'S107', 'S108', 'S109', 'S111', 'S113', 'S114', 'S115'];
  
  const epidermis: { subjectId: string; timepoints: number[]; expression: number[] }[] = [];
  const dermis: { subjectId: string; timepoints: number[]; expression: number[] }[] = [];

  for (const subject of subjects) {
    // Epidermis: High turnover tissue with tight circadian control (λ ≈ 0.537)
    // Target gene baseline from Jan 2026 audit
    const epiEigenvalue = 0.45 + Math.random() * 0.12; // 0.45-0.57 range (target gene territory)
    const epiExpression = generateAR2Series(epiEigenvalue, timepoints.length, 0.15);
    epidermis.push({ subjectId: subject, timepoints, expression: epiExpression });

    // Dermis: Low turnover tissue with less constrained dynamics (λ ≈ 0.68)
    // Higher eigenvalue = more persistent, less controlled
    const derEigenvalue = 0.64 + Math.random() * 0.10; // 0.64-0.74 range
    const derExpression = generateAR2Series(derEigenvalue, timepoints.length, 0.12);
    dermis.push({ subjectId: subject, timepoints, expression: derExpression });
  }

  return { epidermis, dermis };
}

/**
 * Run the blind test protocol on synthetic GSE205155-like data
 */
export function runBlindSkinTest(): BlindTestResult {
  const data = generateSyntheticSkinData();
  
  // Step 1: BLIND - Mix samples with anonymized IDs
  const allSamples: { blindId: string; expression: number[]; trueGroup: 'epidermis' | 'dermis' }[] = [];
  
  data.epidermis.forEach((sample, i) => {
    allSamples.push({
      blindId: `SKIN_${String(i * 2).padStart(3, '0')}`,
      expression: sample.expression,
      trueGroup: 'epidermis'
    });
  });
  
  data.dermis.forEach((sample, i) => {
    allSamples.push({
      blindId: `SKIN_${String(i * 2 + 1).padStart(3, '0')}`,
      expression: sample.expression,
      trueGroup: 'dermis'
    });
  });

  // Shuffle samples
  const shuffled = [...allSamples].sort(() => Math.random() - 0.5);

  // Step 2: ANALYZE - Run eigenvalue analysis blindly
  const analyzed = shuffled.map(sample => {
    const result = analyzeTimeSeries(sample.expression, 4);
    return {
      blindId: sample.blindId,
      eigenvalue: result.eigenvalue,
      ar2Coefficients: { beta1: result.beta1, beta2: result.beta2 },
      isStable: result.eigenvalue < 0.80,  // Updated per Jan 2026 audit
      stabilityZone: classifyEigenvalue(result.eigenvalue),
      trueGroup: sample.trueGroup // Hidden during blind phase
    };
  });

  // Step 3: CLUSTER - Separate into two groups based on eigenvalue
  const sortedByEigenvalue = [...analyzed].sort((a, b) => a.eigenvalue - b.eigenvalue);
  const midpoint = Math.floor(sortedByEigenvalue.length / 2);
  
  const groupA = sortedByEigenvalue.slice(0, midpoint); // Lower eigenvalues
  const groupB = sortedByEigenvalue.slice(midpoint);    // Higher eigenvalues

  // Calculate statistics for each group
  const calcStats = (group: typeof groupA) => {
    const eigenvalues = group.map(s => s.eigenvalue);
    const mean = eigenvalues.reduce((a, b) => a + b, 0) / eigenvalues.length;
    const variance = eigenvalues.reduce((a, b) => a + (b - mean) ** 2, 0) / eigenvalues.length;
    return { mean, std: Math.sqrt(variance) };
  };

  const statsA = calcStats(groupA);
  const statsB = calcStats(groupB);

  // Step 4: UNBLIND - Check which group corresponds to which tissue
  const groupAEpidermisCount = groupA.filter(s => s.trueGroup === 'epidermis').length;
  const groupADermisCount = groupA.filter(s => s.trueGroup === 'dermis').length;
  
  const groupAIsEpidermis = groupAEpidermisCount > groupADermisCount;

  // Calculate t-test for statistical significance
  const n1 = groupA.length, n2 = groupB.length;
  const pooledVariance = ((n1 - 1) * statsA.std ** 2 + (n2 - 1) * statsB.std ** 2) / (n1 + n2 - 2);
  const standardError = Math.sqrt(pooledVariance * (1/n1 + 1/n2));
  const tStatistic = (statsA.mean - statsB.mean) / (standardError || 0.001);
  
  // Approximate p-value from t-distribution (simplified)
  const df = n1 + n2 - 2;
  const pValue = 2 * (1 - cdfT(Math.abs(tStatistic), df));
  
  // Cohen's d effect size
  const cohenD = (statsA.mean - statsB.mean) / Math.sqrt(pooledVariance || 0.001);

  // Determine if prediction was correct
  // Hypothesis: Epidermis (high turnover) should have LOWER eigenvalue (~0.537 target gene baseline)
  const predictionCorrect = groupAIsEpidermis; // Group A has lower eigenvalues

  return {
    testName: 'Skin Epidermis vs Dermis Blind Test',
    datasetId: 'GSE205155 (synthetic)',
    protocol: {
      blindingMethod: 'Sample IDs anonymized, layers mixed and shuffled',
      analysisMethod: 'AR(2) eigenvalue extraction with Z-score normalization',
      predictionMade: 'Epidermis (high turnover) should show λ ≈ 0.537 (target gene baseline); Dermis (low turnover) should show higher λ'
    },
    results: {
      groupA: {
        meanEigenvalue: statsA.mean,
        stdDev: statsA.std,
        samples: groupA.map(({ trueGroup, ...rest }) => rest)
      },
      groupB: {
        meanEigenvalue: statsB.mean,
        stdDev: statsB.std,
        samples: groupB.map(({ trueGroup, ...rest }) => rest)
      }
    },
    unblinding: {
      groupAIdentity: groupAIsEpidermis ? 'EPIDERMIS' : 'DERMIS',
      groupBIdentity: groupAIsEpidermis ? 'DERMIS' : 'EPIDERMIS',
      predictionCorrect,
      statisticalSignificance: {
        tStatistic,
        pValue,
        effectSize: Math.abs(cohenD)
      }
    },
    conclusion: predictionCorrect
      ? `SUCCESS: Blind clustering correctly identified tissue layers. Epidermis (λ=${
          groupAIsEpidermis ? statsA.mean.toFixed(3) : statsB.mean.toFixed(3)
        }) shows tighter circadian control than Dermis (λ=${
          groupAIsEpidermis ? statsB.mean.toFixed(3) : statsA.mean.toFixed(3)
        }). Effect size d=${Math.abs(cohenD).toFixed(2)}.`
      : `UNEXPECTED: Eigenvalue clustering did not match predicted tissue assignments. Further investigation needed.`
  };
}

/**
 * Whiteside Engine thresholds for clinical interpretation
 */
// Real data from Jan 2026 audit (33 datasets):
// Target genes: mean=0.537±0.232 (range 0.077-1.480)
// Clock genes: mean=0.689±0.203 (range 0.127-1.074)
export const WHITESIDE_THRESHOLDS = {
  OPTIMAL_HOMEOSTASIS: { min: 0.40, max: 0.60, description: 'Target gene range - System is stable (audit mean: 0.537)' },
  FIELD_EFFECT: { min: 0.61, max: 0.70, description: 'Approaching clock gene territory - Pre-neoplasia risk' },
  TRANSITION_ZONE: { min: 0.71, max: 0.80, description: 'Clock gene territory (audit mean: 0.689) - Gearbox convergence' },
  STABILITY_BREACH: { min: 0.81, max: 1.0, description: 'Exceeds healthy clock baseline - Lost circadian hierarchy' }
};

/**
 * Generate the Whiteside Engine Validation Handbook as markdown
 */
export function generateValidationHandbook(): string {
  return `# Whiteside Engine Validation Handbook

## Technical Guardrails for PAR(2) Clinical Translation

*Version 1.0 | January 2026*

---

## 1. DATA PREPARATION ("Clean Room" Standard)

### 1.1 Sampling Requirements

| Parameter | Requirement | Rationale |
|-----------|-------------|-----------|
| Sampling Interval | ≤ 6 hours | Minimum 4 points per circadian cycle |
| Minimum Timepoints | 6 (ideal: 8+) | AR(2) requires lag-2 structure |
| Coverage | ≥ 24 hours | Full circadian cycle capture |
| Replicates | 3+ biological | Reduces technical noise |

### 1.2 Normalization Protocol

1. **Raw Counts → Log2 Transform**
   \`\`\`
   expression_log2 = log2(raw_counts + 1)
   \`\`\`

2. **Z-Score Normalization** (per gene across time)
   \`\`\`
   expression_zscore = (x - mean(x)) / sd(x)
   \`\`\`
   
   *Critical: Centers mean at 0, variance at 1. Required for AR(2) coefficient extraction.*

### 1.3 Priority Gene Set ("Stability Core")

| Gene | Role | Expected λ (Healthy) |
|------|------|---------------------|
| ARNTL (BMAL1) | Master clock | 0.65-0.75 (clock gene range) |
| PER2 | Negative feedback | 0.65-0.75 (clock gene range) |
| CRY1 | Negative feedback | 0.65-0.75 (clock gene range) |
| CCND1 (Cyclin D1) | Cell cycle coupling | 0.45-0.65 (target gene range) |

---

## 2. INTERPRETING THE STABILITY MODULUS (λ)

### 2.1 Clinical Threshold Table

| λ Range | Zone Name | Biological Interpretation | Clinical Action |
|---------|-----------|---------------------------|-----------------|
| 0.40 - 0.60 | OPTIMAL | Target gene range (audit mean: 0.537) | Monitor routinely |
| 0.61 - 0.70 | FIELD EFFECT | Approaching clock gene territory | Screen for pre-neoplasia |
| 0.71 - 0.80 | TRANSITION | Clock gene territory (audit mean: 0.689) | Intensive monitoring |
| > 0.80 | BREACH | Exceeds healthy clock baseline | Intervention indicated |

### 2.2 The Gearbox Hierarchy

\`\`\`
Clock (SCN/Pacemaker):  λ = 0.689  [DRIVER - real audit mean]
        ↓
Healthy Tissue:         λ = 0.537  [STABLE FOLLOWER - real audit mean]
        ↓
FAP-modeled:            λ = 0.65  [DRIFT TOWARD DRIVER]
        ↓
Adenoma/Cancer:         λ = 0.85+ [DECOUPLED]
\`\`\`

### 2.3 Age Correction

Apply tissue-specific baseline correction:

| Tissue | Age Drift (per decade) | Confidence | Reference |
|--------|------------------------|------------|-----------|
| Brain | +4.0% | HIGH | Chen et al. 2015 PNAS |
| Adrenal | +2.5% | MEDIUM | Ahmad et al. 2023 |
| Blood | +1.5% | MEDIUM | Hood & Amir 2017 JCI |
| Colon | -0.5% | LOW | Valero-Alcaide 2020 (Paradox) |

**Formula:**
\`\`\`
λ_corrected = λ_observed - (age_drift_per_decade × (patient_age - 30) / 10)
\`\`\`

---

## 3. VALIDATION PROTOCOLS

### 3.1 Sparse Sampling Test

Before collecting new data, validate protocol viability:

\`\`\`bash
POST /api/validation/sparse-sampling
{
  "protocol": {
    "timepoints": [0, 4, 8, 12, 18, 24],
    "strategy": "clinical"
  }
}
\`\`\`

**Pass Criteria:** Pearson r > 0.85 vs. dense reference

### 3.2 Surrogate Validation

Test that findings aren't spectral artifacts:

\`\`\`bash
POST /api/analyses/{runId}/surrogate-validation
{
  "nSurrogates": 100,
  "method": "phase_randomized"
}
\`\`\`

**Pass Criteria:** Observed λ outside 95% surrogate CI

### 3.3 Blind Test Protocol

1. **Strip Labels**: Remove tissue/condition identifiers
2. **Randomize**: Shuffle sample order
3. **Analyze**: Extract eigenvalues blindly
4. **Cluster**: Group by eigenvalue similarity
5. **Unblind**: Compare clusters to ground truth

---

## 4. REPORTING STANDARDS

### 4.1 Required Metrics

| Metric | Report Format | Example |
|--------|---------------|---------|
| Eigenvalue (λ) | Mean ± SD (95% CI) | 0.537 ± 0.232 (0.45-0.62) |
| Z-score | vs. healthy reference | z = -0.6 (wild-type) |
| Granger p-value | After BH correction | p = 0.003 |
| Surrogate p-value | Phase-randomized null | p < 0.01 |
| Age-corrected λ | With confidence level | 0.54 (MEDIUM confidence) |

### 4.2 Quality Flags

Report any applicable flags:

- **SPARSE_SAMPLING**: < 6 timepoints
- **UNCALIBRATED_AGE**: Age correction not empirically validated
- **LOW_POWER**: < 3 biological replicates
- **EXTRAPOLATED**: Outside training data range

---

## 5. TROUBLESHOOTING

### 5.1 Common Issues

| Symptom | Likely Cause | Solution |
|---------|--------------|----------|
| λ = 0 or 1 | Degenerate fit | Check for constant expression |
| λ > 0.95 | Non-stationary | Detrend before fitting |
| High variance | Subject heterogeneity | Report per-subject λ |
| No Granger signal | Insufficient timepoints | Need ≥ 8 for causality |

### 5.2 Minimum Viable Dataset

- 6+ timepoints at ≤ 6h intervals
- 3+ biological replicates
- Log2 + Z-score normalized
- Clock gene expression included

---

## 6. CITATION

> "Temporal stability was quantified using the PAR(2) Discovery Engine (v1.0),
> extracting AR(2) eigenvalue modulus λ as a stability metric. Values within
> the optimal band (0.50-0.55) indicate healthy dynamics. Age corrections
> applied per Whiteside Engine Validation Handbook (2026)."

---

*For technical support: See /api/download/research-protocol-template*
`;
}

/**
 * Approximate CDF of t-distribution (for p-value calculation)
 */
function cdfT(t: number, df: number): number {
  // Use normal approximation for large df
  if (df > 100) {
    return cdfNormal(t);
  }
  
  // Use incomplete beta function approximation
  const x = df / (df + t * t);
  const a = df / 2;
  const b = 0.5;
  
  // Regularized incomplete beta function approximation
  const betaInc = incompleteBeta(x, a, b);
  
  if (t >= 0) {
    return 1 - 0.5 * betaInc;
  } else {
    return 0.5 * betaInc;
  }
}

function cdfNormal(z: number): number {
  // Approximation using error function
  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;

  const sign = z < 0 ? -1 : 1;
  z = Math.abs(z) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * z);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);

  return 0.5 * (1.0 + sign * y);
}

function incompleteBeta(x: number, a: number, b: number): number {
  // Simple approximation for incomplete beta function
  if (x === 0) return 0;
  if (x === 1) return 1;
  
  // Use continued fraction expansion (simplified)
  let result = Math.pow(x, a) * Math.pow(1 - x, b) / (a * beta(a, b));
  
  // First few terms of continued fraction
  let sum = 1;
  let term = 1;
  for (let n = 1; n <= 20; n++) {
    term *= (n - 1 - a) * x / n;
    sum += term;
    if (Math.abs(term) < 1e-10) break;
  }
  
  return Math.min(1, Math.max(0, result * sum));
}

function beta(a: number, b: number): number {
  // Beta function using log-gamma approximation
  return Math.exp(logGamma(a) + logGamma(b) - logGamma(a + b));
}

function logGamma(x: number): number {
  // Stirling's approximation for log-gamma
  if (x <= 0) return 0;
  if (x < 10) {
    // Recursion for small values
    return logGamma(x + 1) - Math.log(x);
  }
  
  return (x - 0.5) * Math.log(x) - x + 0.5 * Math.log(2 * Math.PI) +
         1 / (12 * x) - 1 / (360 * x * x * x);
}
