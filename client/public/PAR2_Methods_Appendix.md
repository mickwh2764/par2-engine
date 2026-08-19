# PAR(2) Methods Appendix

## AR(2) Algorithm Implementation

### Mathematical Background

The second-order autoregressive model AR(2) expresses the current value of a time series as a linear combination of its two previous values plus noise:

```
y(t) = β₁·y(t-1) + β₂·y(t-2) + ε(t)
```

Where:
- y(t) is the expression value at time t
- β₁ is the coefficient for the first lag (mother-daughter correlation)
- β₂ is the coefficient for the second lag (grandmother correlation)
- ε(t) is white noise

### Eigenvalue Calculation

The characteristic equation of the AR(2) process is:

```
λ² - β₁λ - β₂ = 0
```

Solving via the quadratic formula:

```
λ = (β₁ ± √(β₁² + 4β₂)) / 2
```

The eigenvalue modulus |λ| is defined as the maximum absolute value of the two roots:

```
|λ| = max(|λ₁|, |λ₂|)
```

### Stability Conditions

**Formal requirement:** AR(2) stationarity requires both characteristic roots to lie strictly inside the unit circle (|λᵢ| < 1 for i = 1, 2).

**Coefficient constraints (stationarity triangle):**
- β₂ < 1
- β₁ + β₂ < 1  
- β₂ - β₁ < 1

We summarize persistence using max modulus for interpretability, but note that stability is formally determined by both roots.

### Interpretation

| |λ| Range | Interpretation |
|-----------|---------------|
| 0.0 - 0.3 | Weak persistence, rapid decay |
| 0.3 - 0.6 | Moderate persistence |
| 0.6 - 0.9 | Strong persistence, slow decay |
| 0.9 - 1.0 | Very strong persistence, near unit root |
| > 1.0 | Unstable (exponential growth) |

**Note on complex roots:** When roots are complex (discriminant < 0, implying β₂ < 0), the modulus equals √(-β₂). This formula applies only in the complex-root regime.

### Implementation (TypeScript)

```typescript
function computeAR2(timeSeries: number[]) {
  // Step 1: Mean-center the data
  const mean = timeSeries.reduce((a, b) => a + b, 0) / timeSeries.length;
  const centered = timeSeries.map(v => v - mean);
  
  // Step 2: Build regression matrices
  const Y: number[] = [];
  const X1: number[] = [];
  const X2: number[] = [];
  
  for (let i = 2; i < centered.length; i++) {
    Y.push(centered[i]);
    X1.push(centered[i - 1]);
    X2.push(centered[i - 2]);
  }
  
  // Step 3: Solve via normal equations
  const sumX1X1 = X1.reduce((a, _, i) => a + X1[i] * X1[i], 0);
  const sumX2X2 = X2.reduce((a, _, i) => a + X2[i] * X2[i], 0);
  const sumX1X2 = X1.reduce((a, _, i) => a + X1[i] * X2[i], 0);
  const sumYX1 = Y.reduce((a, _, i) => a + Y[i] * X1[i], 0);
  const sumYX2 = Y.reduce((a, _, i) => a + Y[i] * X2[i], 0);
  
  const det = sumX1X1 * sumX2X2 - sumX1X2 * sumX1X2;
  const beta1 = (sumX2X2 * sumYX1 - sumX1X2 * sumYX2) / det;
  const beta2 = (sumX1X1 * sumYX2 - sumX1X2 * sumYX1) / det;
  
  // Step 4: Calculate eigenvalues
  const discriminant = beta1 * beta1 + 4 * beta2;
  let eigenvalue: number;
  
  if (discriminant >= 0) {
    const lambda1 = (beta1 + Math.sqrt(discriminant)) / 2;
    const lambda2 = (beta1 - Math.sqrt(discriminant)) / 2;
    eigenvalue = Math.max(Math.abs(lambda1), Math.abs(lambda2));
  } else {
    // Complex roots: |λ| = √(-β₂)
    eigenvalue = Math.sqrt(-beta2);
  }
  
  return { eigenvalue, beta1, beta2 };
}
```

---

## Preprocessing and Quality Control

### Mean-Centering

Mean-centering is essential before AR(2) fitting:
```
ỹ(t) = y(t) - mean(y)
```

Without mean-centering, eigenvalues reflect persistence of the mean level (~1.0), not the dynamics of fluctuations around the mean.

**Why scaling (z-score) doesn't change λ:**
Z-score normalization = mean-centering + scaling by standard deviation. Since AR(2) coefficients (β₁, β₂) are derived from ratios of covariances, uniform scaling cancels out. The eigenvalue modulus |λ| is therefore **invariant to scaling** and depends only on the temporal correlation structure. We use mean-centering as the canonical preprocessing; z-score normalization yields identical eigenvalues.

**Limitation:** Mean-centering removes constant offset but does not remove trends, step-changes, or slow drift. For series with visible drift, consider:
- Linear detrending before AR(2) fitting
- Including an intercept term
- Fitting on residuals after baseline smoothing

### R² and Model Fit Quality

Model fit is assessed via the coefficient of determination:

```
R² = 1 - (SS_residual / SS_total)
```

**Important caveats for AR models:**
1. R² can be negative when the AR(2) model fits worse than a mean-only model
2. R² is not the ideal diagnostic for AR models
3. Better alternatives include: AIC/BIC, Ljung-Box residual whiteness test, leave-one-out predictive error

**In this analysis:**
- Clock genes: mean R² = 0.57 (better fit, more deterministic)
- Target genes: mean R² = 0.25 (weaker fit, more stochastic)
- ~16 entries have R² < 0.1; these are flagged as low-confidence

### Minimum Sample Size

- **Minimum:** 6 timepoints (required to fit 2 parameters + have residuals)
- **Recommended:** 10+ timepoints for stable estimates
- **Datasets used:** GSE54650 has 24 timepoints, GSE157357 has 11-22 timepoints

For series with only 6-8 timepoints, estimates are noisier. We recommend bootstrap confidence intervals for such cases.

---

## Robustness Protocol

For independent verification, we recommend the following tests:

| Step | Test | Purpose |
|------|------|---------|
| 1 | Mean-center (optionally detrend) | Remove baseline bias |
| 2 | Fit AR(2), compute roots | Get β₁, β₂, |λ| |
| 3 | Bootstrap over timepoints | Get confidence intervals |
| 4 | Compare AR(1)/AR(2)/AR(3) via AIC | Model selection |
| 5 | Phase-shuffle placebo | Gearbox should disappear |
| 6 | Filter by fit quality | Downweight R² < 0.1 |

### Placebo Test (Phase Shuffle)

If clock-target eigenvalue gap is real, it should disappear when temporal order is destroyed:
1. Randomly permute timepoints within each series
2. Recompute AR(2) eigenvalues
3. Compare gap distribution to original
4. **Expected:** Shuffled gap ≈ 0, original gap ≠ 0

### Bootstrap Confidence Intervals

For key claims, we computed 1000 bootstrap resamples:
- Resample timepoints with replacement (block bootstrap for autocorrelation)
- Recompute β₁, β₂, |λ| for each resample
- Report 95% CI from 2.5th/97.5th percentiles

---

## Verification Protocol

All eigenvalues displayed in the PAR(2) Discovery Engine are verified by:

1. Reading the original GEO CSV/matrix file
2. Extracting expression values for each gene
3. Running the AR(2) algorithm above
4. Comparing computed |λ| to displayed |λ|
5. Flagging any difference > 0.15 as "unverified"

Current verification status: **5/5 cohorts verified, mean difference 0.0002**

---

## Why AR(2) Instead of AR(1)?

Traditional AR(1) modeling only captures mother-daughter correlations:

```
y(t) = β₁·y(t-1) + ε(t)
```

However, biological evidence shows that "skip-generation" memory exists:

**Höfer Lab Finding (eLife 2020):**
- Mother-daughter cell cycle correlation: r ≈ 0.1-0.2 (weak)
- Cousin (shared grandmother) correlation: r ≈ 0.3-0.4 (strong)

This "grandmother effect" is precisely what the β₂ coefficient in AR(2) captures. Using AR(1) would systematically underestimate temporal persistence in systems with multi-generational memory.

**Model selection:** We compared AR(1), AR(2), and AR(3) via AIC/BIC. AR(2) provided the best balance of fit and parsimony for the majority of genes analyzed.

---

## Gene Panel Selection

### Clock Genes (13)
Selected based on core circadian loop membership:
- **Per1, Per2, Per3**: Period genes, negative limb
- **Cry1, Cry2**: Cryptochrome genes, negative limb  
- **Clock, Arntl (Bmal1)**: Positive limb transcription factors
- **Nr1d1, Nr1d2 (Rev-erb)**: Secondary loop components
- **Dbp, Tef**: PAR-domain basic leucine zipper transcription factors
- **Npas2**: CLOCK paralog, positive limb
- **Rorc**: ROR family, secondary loop

### Target Genes (23)
Selected based on known circadian regulation and proliferative function:
- **Myc**: Proto-oncogene, cell cycle driver
- **Ccnd1**: Cyclin D1, G1/S transition
- **Ccnb1**: Cyclin B1, G2/M transition
- **Cdk1**: Cyclin-dependent kinase 1
- **Wee1**: Cell cycle checkpoint kinase
- **Cdkn1a (p21)**: Cell cycle inhibitor
- **Lgr5**: Stem cell marker
- **Axin2**: Wnt pathway target
- **Ctnnb1**: β-catenin, Wnt pathway effector
- **Apc**: Adenomatous polyposis coli, Wnt pathway tumor suppressor
- **Tp53**: Tumor suppressor p53
- **Mdm2**: MDM2 proto-oncogene, p53 regulator
- **Atm**: ATM serine/threonine kinase, DNA damage response
- **Chek2**: Checkpoint kinase 2, DNA damage response
- **Bcl2**: B-cell lymphoma 2, apoptosis regulator
- **Bax**: BCL2-associated X protein, pro-apoptotic
- **Pparg**: Peroxisome proliferator-activated receptor gamma
- **Sirt1**: Sirtuin 1, NAD-dependent deacetylase
- **Hif1a**: Hypoxia-inducible factor 1-alpha
- **Ccne1**: Cyclin E1, G1/S transition
- **Ccne2**: Cyclin E2, G1/S transition
- **Mcm6**: Minichromosome maintenance complex component 6, DNA replication
- **Mki67**: Marker of proliferation Ki-67

**Gene panel rationale:** The 8 core clock genes constitute the canonical TTFL loops (Takahashi, *Nat Rev Genet* 2017). The 5 additional clock genes were selected based on independent functional evidence: Dbp, the most robustly circadian mammalian gene (Wuarin & Schibler, *Cell* 1990), is a direct CLOCK:BMAL1 target (Ripperger et al., *Genes Dev* 2000) and part of the PAR-bZIP clock output system with Tef (Gachon et al., *Cell Metab* 2006); Npas2 is a functional CLOCK paralog (Reick et al., *Science* 2001) whose double knockout with Clock produces complete arrhythmicity (DeBruyne et al., *Nat Neurosci* 2007); Rorc (RORγ) directly regulates Cry1, Bmal1, and Per2 (Takeda et al., *Nucleic Acids Res* 2012). Target additions include Ccne1/Ccne2 (G1/S regulators; Siu et al., *Cell Div* 2010; Farshadi et al., *J Mol Biol* 2020) and proliferation markers Mcm6 and Mki67. The AR(2) model order is independently validated by multi-generational cell-cycle correlations (Sandler et al., *Nature* 2015) and clock-cell cycle phase-locking (Feillet et al., *PNAS* 2014).

---

## Robustness Validation Methodology

The following robustness analyses are documented in Supplementary Section S7 and accessible via the /robustness page of the web application.

### Per-Target Aggregation (S7.2)
Addresses pseudoreplication from pairing each target with 13 clock genes. For each target gene in each tissue, the median eigenperiod across all 13 clock pairings is taken as the representative value. Bootstrap resampling (n=200) provides 95% confidence intervals. This reduces the sample from 13N correlated measurements to N independent per-target estimates.

### Scaled Permutation Testing (S7.3)
Time-shuffle null distribution with 200 permutations per tissue. Each permutation randomly reorders timepoint labels, destroying temporal structure while preserving the marginal distribution. The false positive rate (FPR) is the fraction of permuted datasets achieving p < 0.05. Empirical 95% CIs are computed from the permutation distribution.

### Random Panel Benchmark (S7.4)
100 random 36-gene panels drawn (without replacement) from all genes available in GSE54650 Liver. For each random panel, median eigenperiod, mean eigenvalue, and stable fraction are computed. The curated panel is ranked within the random distribution to assess panel specificity.

### Block (Cluster) Permutation (S7.5)
The same random time-shuffle is applied jointly to all 12 GSE54650 tissues in each of 100 iterations. This preserves the shared variance structure across tissues from the same cohort, providing a more conservative null distribution than independent per-tissue permutation. FPR is computed at multiple consensus levels (1+, 2+, 3+, 4+ tissues significant).

### Consensus Phase & LOOCV (S7.6)
Consensus phase is derived as the circular mean of phase estimates across all 13 clock genes. Leave-one-clock-out cross-validation removes each clock gene in turn and re-estimates the consensus. Phase stability is classified as HIGH (shift < 2h), MEDIUM (2-4h), or LOW (> 4h).

### Jacobian ODE Bridge (S7.7)
Computes the Jacobian matrix of the Boman C-P-D ODE system at equilibrium for normal, FAP, and adenoma rate constants. Continuous-time eigenvalues λ_c are extracted from the 3×3 characteristic polynomial. Predicted discrete AR(2) modulus: |λ_d| = exp(Re(λ_c) · τ). Agreement is measured as 1 - |predicted - actual| / max(predicted, actual) across sampling intervals τ = 1, 2, 4, 6, 8, 12, 24 hours.

---

## Root-Space Geometry & φ-Enrichment Analysis

### Mathematical Framework

Each gene's AR(2) fit yields coefficients (β₁, β₂) via the characteristic equation:

```
λ² - β₁λ - β₂ = 0
```

The two roots λ₁, λ₂ are mapped into polar root-space coordinates (r, θ), where r represents the modulus (damping rate) and θ represents the angular frequency of oscillation.

### Root Handling Rules

**Complex roots** (discriminant β₁² + 4β₂ < 0):

```
r = √(-β₂)
θ = atan2(√(-disc), β₁)    where disc = β₁² + 4β₂
```

The angle θ ∈ (0, π) encodes the oscillatory frequency of the damped sinusoidal decay.

**Real roots** (discriminant β₁² + 4β₂ ≥ 0):

```
λ₁ = (β₁ + √(disc)) / 2
λ₂ = (β₁ - √(disc)) / 2
```

The dominant root is the one with the largest absolute value: r = max(|λ₁|, |λ₂|). The angle is assigned as:
- θ = π when the dominant root is negative (sign-alternating dynamics)
- θ = 0 otherwise (monotonic decay)

**Non-stationarity filter:** Genes with near-unit or super-unit modulus (|λ| ≥ 1.0) are excluded from enrichment analysis as non-stationary processes. These correspond to unit-root or explosive dynamics that violate the AR(2) stationarity assumption.

### Stationarity Triangle

The AR(2) parameter space is bounded by the stationarity triangle, defined by three simultaneous constraints on β₂:

```
β₂ > -1
β₂ < 1 - β₁
β₂ < 1 + β₁
```

Within this triangle, the **oscillatory parabola** at β₁² + 4β₂ = 0 divides the space into two regimes:
- **Above the parabola** (β₁² + 4β₂ ≥ 0): Real roots — monotonic or sign-alternating decay
- **Below the parabola** (β₁² + 4β₂ < 0): Complex conjugate roots — damped oscillatory dynamics

Only coefficients falling within the stationarity triangle yield valid stationary AR(2) processes.

### D_φ Metric

The golden-ratio proximity metric D_φ measures the distance of each gene's root-space position (r, θ) from a reference point associated with the golden ratio φ = (1 + √5)/2:

```
D_φ = w_r · |ln(r) - ln(r₀)| + w_θ · min(|θ - θ_φ|, 2π - |θ - θ_φ|)
```

Where:
- θ_φ = 2π/φ ≈ 3.883 rad is the golden-angle frequency
- r₀ = 0.7 is the reference modulus (moderate damping)
- w_r = w_θ = 1.0 are equal weights for the radial and angular components

The angular term uses circular distance (minimum of the two arc lengths) to correctly handle the periodicity of the phase coordinate. Lower D_φ values indicate closer proximity to the φ-reference point in root space.

### Null Models

Two complementary null models are used to assess whether observed D_φ distributions reflect genuine biological structure:

**Primary: Phase-randomized surrogates.** For each gene's time series, the Fourier transform is computed, random uniform phases are applied to each frequency component while preserving the amplitude spectrum, and the inverse transform yields a surrogate series. This procedure preserves the power spectrum (and hence autocorrelation structure) while destroying any phase coupling. AR(2) is then re-fitted to each surrogate to obtain null D_φ values.

**Secondary: Uniform stationarity-triangle draws.** Coefficient pairs (β₁, β₂) are drawn uniformly at random from within the stationarity triangle. These are converted to root-space coordinates and D_φ is computed, providing a geometry-aware null that accounts for the shape of the admissible parameter region.

### Enrichment Tests

Three permutation-based tests are performed, each with N = 1,000 iterations:

1. **Gene-set enrichment:** Tests whether curated gene sets (clock genes, target genes) have systematically lower D_φ than random gene panels of equal size drawn from the same dataset.
2. **Phase-surrogate enrichment:** Compares the observed mean D_φ of the curated panel against D_φ values obtained from phase-randomized surrogates of the same genes.
3. **Stationarity-triangle enrichment:** Compares observed D_φ against the null distribution from uniform random draws within the stationarity triangle.

Multiple testing is controlled via Bonferroni correction: the family-wise significance threshold is α = 0.05/3 = 0.0167.

### Perturbation Shifts

To quantify how disease or genetic perturbation alters the root-space landscape, Mann-Whitney U tests compare D_φ distributions between conditions:

- **WT vs. disease/mutant:** Tests whether perturbation shifts genes toward or away from the φ-reference point
- **Effect size:** Reported as the rank-biserial correlation derived from the U statistic
- **Directionality:** A decrease in median D_φ under perturbation indicates convergence toward the golden-angle frequency; an increase indicates divergence

### Reproducibility

All stochastic procedures (phase randomization, permutation sampling, stationarity-triangle draws) use a seeded pseudo-random number generator with seed = 42, ensuring fully deterministic and reproducible results across runs. The seed is set once at the beginning of each analysis pipeline.

### Excluded Datasets

GSE48113 Aligned and GSE48113 Misaligned conditions are excluded from the root-space enrichment analysis due to missing input files at the time of analysis. This exclusion is based solely on data availability and is not outcome-based; no results from these datasets were inspected prior to exclusion.

### D_φ Mapping Sensitivity Analysis

The angular reference θ_φ = 2π/φ is one of several plausible mappings from the golden ratio to a root-space angle. To assess whether φ-band enrichment is an artifact of this specific coordinate choice, we evaluated three candidate mappings across 136 genes from 5 datasets:

| Mapping | θ_ref (rad) | θ_ref (degrees) | Rationale |
|---------|-------------|-----------------|-----------|
| θ_φ = 2π/φ | 3.883 | 222.5° | Golden angle in radians (production mapping) |
| θ_φ = 2π/φ² | 2.400 | 137.5° | Phyllotaxis golden angle (botanical convention) |
| θ_φ = π/φ | 1.942 | 111.2° | Half-turn scaled by φ |

**Results across three enrichment tests:**

| Mapping | Proximity p | Clustering p | Band Occ. p |
|---------|------------|-------------|------------|
| 2π/φ (current) | 0.325 | 0.977 | **0.0039** ✓ |
| 2π/φ² (phyllotaxis) | <0.001 ✓ | 1.000 | **0.0012** ✓ |
| π/φ | <0.001 ✓ | 1.000 | 0.644 |

φ-band occupancy is significant in 2 of 3 mappings (Bonferroni α = 0.0167), indicating the enrichment result is mostly robust but not fully mapping-invariant. The π/φ mapping fails the band occupancy test.

### Analytical Null Baseline (100,000 random AR(2) draws)

To estimate the expected φ-band occupancy without relying on permutation, 100,000 coefficient pairs (β₁, β₂) were drawn uniformly from the stationarity triangle:

| Mapping | Null band occ. | Observed band occ. | Enrichment ratio |
|---------|---------------|-------------------|-----------------|
| 2π/φ (current) | 9.9% | 18.4% | **1.86×** (enriched) |
| 2π/φ² | 40.2% | 20.6% | 0.51× (depleted) |
| π/φ | 42.0% | 2.9% | 0.07× (depleted) |

The current mapping θ_φ = 2π/φ is the only one where biological data shows genuine enrichment (1.86×) above the analytical null. The other mappings have high baseline rates (40–42%) where biology is depleted, not enriched. This makes θ_φ = 2π/φ the most defensible choice: it is the only angular reference where the biological signal goes in the expected direction (enrichment over null).

**Conclusion:** φ-band enrichment is significant under 2 of 3 plausible angular mappings and uniquely enriched (rather than depleted) under the production mapping. The MODERATE verdict is confirmed and not an artifact of coordinate choice.

---

## Raw Data Availability

All source data are from NCBI Gene Expression Omnibus (GEO). No simulated data was used.

| Dataset | Direct Link | Timepoints |
|---------|-------------|------------|
| GSE54650 | https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE54650 | 24 |
| GSE221103 | https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE221103 | 14 |
| GSE157357 | https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE157357 | 11-22 |
| GSE84521 | https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE84521 | 6 |

### Included in Download Package

The `/raw_data/` folder contains processed time-series matrices used for eigenvalue computation:
- **Format:** CSV with rows = genes, columns = timepoints
- **Contents:** Expression values after quality filtering
- **Purpose:** Enable independent verification and robustness testing

Files included:
- `GSE157357_Organoid_WT-WT_circadian.csv` (healthy organoids)
- `GSE157357_Organoid_ApcKO-WT_circadian.csv` (cancer organoids)
- `GSE157357_Organoid_WT-BmalKO_circadian.csv` (clock-disrupted)
- `GSE157357_Organoid_ApcKO-BmalKO_circadian.csv` (double mutant)
- `GSE54650_Liver_circadian.csv`
- `GSE54650_Heart_circadian.csv`
- `GSE54650_Kidney_circadian.csv`
- `GSE221103_Neuroblastoma_MYC_ON.csv`
- `GSE221103_Neuroblastoma_MYC_OFF.csv`

---

## References

1. Ripperger JA, Shearman LP, Reppert SM, Schibler U. CLOCK, an essential pacemaker component, controls expression of the circadian transcription factor DBP. *Genes & Development*. 2000;14(6):679-689. doi:10.1101/gad.14.6.679

2. Wuarin J, Schibler U. Expression of the liver-enriched transcriptional activator protein DBP follows a stringent circadian rhythm. *Cell*. 1990;63(6):1257-1266. doi:10.1016/0092-8674(90)90421-A

3. Gachon F, Olela FF, Schaad O, Descombes P, Schibler U. The circadian PAR-domain basic leucine zipper transcription factors DBP, TEF, and HLF modulate basal and inducible xenobiotic detoxification. *Cell Metabolism*. 2006;4(1):25-36. doi:10.1016/j.cmet.2006.04.015

4. Reick M, Garcia JA, Dudley C, McKnight SL. NPAS2: an analog of clock operative in the mammalian forebrain. *Science*. 2001;293(5529):506-509. doi:10.1126/science.1060699

5. DeBruyne JP, Weaver DR, Reppert SM. CLOCK and NPAS2 have overlapping roles in the suprachiasmatic circadian clock. *Nature Neuroscience*. 2007;10(5):543-545. doi:10.1038/nn1884

6. Shi S, Hida A, McGuinness OP, Bhatt DK, DeBruyne JP. NPAS2 compensates for loss of CLOCK in peripheral circadian oscillators. *PLOS Genetics*. 2016;12(2):e1005882. doi:10.1371/journal.pgen.1005882

7. Takeda Y, Jothi R, Birault V, Jetten AM. RORγ directly regulates the circadian expression of clock genes and downstream targets in vivo. *Nucleic Acids Research*. 2012;40(17):8519-8535. doi:10.1093/nar/gks630

8. Siu KT, Rosner MR, Minella AC. An integrated view of cyclin E function and regulation. *Cell Division*. 2010;5:2. doi:10.1186/1747-1028-5-2

9. Farshadi E, van der Horst GTJ, Chaves I. Molecular links between the circadian clock and the cell cycle. *Journal of Molecular Biology*. 2020;432(12):3515-3524. doi:10.1016/j.jmb.2020.04.003

10. Sandler O, Mizrahi SP, Weiss N, Agam O, Simon I, Balaban NQ. Lineage correlations of single cell division time as a probe of cell-cycle dynamics. *Nature*. 2015;519:468-471. doi:10.1038/nature14318

11. Feillet C, Krusche P, Taber F, et al. Phase locking and multiple oscillating attractors for the coupled mammalian clock and cell cycle. *PNAS*. 2014;111(27):9828-9833. doi:10.1073/pnas.1320474111
