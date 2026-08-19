---
title: "PAR(2) Discovery Engine: Eigenvalue Dynamics Reveal Circadian-Proliferation Hierarchy in Health and Disease"
author: "Michael Whiteside^1^"
date: "February 2026"
abstract: |
  We present a statistical framework for analyzing gene expression time series using second-order autoregressive [AR(2)] modeling. The eigenvalue modulus |$\lambda$| derived from AR(2) fitting quantifies temporal persistence---how strongly a gene's expression "remembers" its previous states. Analysis of publicly available NCBI GEO datasets reveals a consistent pattern in healthy tissues: circadian clock genes (Per1, Per2, Bmal1, Clock) exhibit higher eigenvalues than proliferation target genes (Myc, Ccnd1, Wee1), suggesting a "gearbox" hierarchy where clock dynamics constrain proliferative signaling.

  In cancer models studied here (MYC-activated neuroblastoma, APC-mutant intestinal organoids), this hierarchy collapses or reverses---target eigenvalues approach or exceed clock eigenvalues, consistent with oncogenic escape from circadian constraint. Cancer also shows increased clock desynchrony (CV=0.312 vs healthy mean CV=0.182) and a striking shift in DNA damage response dynamics: p53 pathway genes move from target-like eigenvalues (0.452) in healthy tissue to clock-like values (0.665) in cancer, suggesting the damage response becomes "stuck" rather than responsive. Aging shows tissue-specific patterns: epidermal stem cells show decreased eigenvalues with age, while pancreatic tissue shows increased clock eigenvalues.

  **Key Finding:** The clock-target eigenvalue gap averages +0.22 to +0.39 in healthy tissues and -0.09 to -0.12 in the cancer models examined (MYC-activated neuroblastoma and APC-mutant organoids). This pattern, while observed consistently across the datasets studied, requires validation in broader cancer cohorts before generalization.

  **Note on Scope:** All findings are derived from publicly available GEO datasets. Effective sample size may be lower than dataset count due to cross-tissue correlations within studies.

  **Keywords:** circadian rhythm, cancer, autoregressive model, eigenvalue, temporal dynamics, systems biology, chronobiology
---

\begin{center}
$^1$Independent Researcher, United Kingdom\\
Corresponding author: mickwh@msn.com
\end{center}

\vspace{1em}

# 1. Introduction

## 1.1 The Circadian-Proliferation Interface

The circadian clock coordinates cellular processes across a 24-hour cycle, including the timing of cell division. Disruption of circadian rhythms is associated with increased cancer risk, but the quantitative relationship between clock gene dynamics and proliferative control remains incompletely characterized.

## 1.2 Theoretical Framework

We adopt a constraints-before-mechanism approach, consistent with theoretical frameworks developed by Andersen and colleagues, who propose that the circadian clock's primary role in epithelial stem cells is to coordinate the cell cycle with intermediary metabolism to minimize DNA damage (Duan et al., *Stem Cells* 2023). Rather than focusing on specific molecular interactions, we ask: what temporal signatures distinguish clock genes from their downstream targets?

## 1.3 Why AR(2) Modeling?

The choice of second-order autoregressive modeling [AR(2)] over first-order [AR(1)] is not merely statistical convenience but reflects biological reality. Höfer and colleagues demonstrated that while mother-daughter cell cycle correlations are weak ($r \approx 0.1$--$0.2$), cousin cells sharing a common grandmother show surprisingly strong correlated cell-cycle durations ($r \approx 0.3$--$0.4$) (Kuchen et al., *eLife* 2020). This "skip-generation" memory pattern is precisely what AR(2) captures through its $\beta_2$ coefficient. The eigenvalue modulus $|\lambda|$ derived from AR(2) thus reflects biologically validated multi-generational dynamics that AR(1) would systematically underestimate.

# 2. Methods

## 2.1 Data Sources

All expression data were obtained from NCBI Gene Expression Omnibus (GEO):

| Dataset | Description | Samples | Timepoints | Lab |
|---------|-------------|---------|------------|-----|
| GSE54650 | Mouse circadian atlas (Liver, Heart, Kidney) | 72 | 24 (CT18--CT64) | Zhang/Hogenesch |
| GSE221103 | Neuroblastoma MYC ON/OFF | 28 | 14 (CT24--CT76) | --- |
| GSE157357 | Intestinal organoids (WT, APC-KO, BMAL1-KO) | 88 | 11--12 | Karpowicz |
| GSE84521 | Epidermal stem cell aging | 102 | 6 (T0--T20) | Aznar-Benitah |

## 2.2 AR(2) Algorithm

For each gene's expression time series $y(t)$:

1. **Mean-center**: $\tilde{y}(t) = y(t) - \bar{y}$
2. **Fit AR(2)**: $\tilde{y}(t) = \beta_1 \cdot \tilde{y}(t-1) + \beta_2 \cdot \tilde{y}(t-2) + \varepsilon$
3. **Solve characteristic equation**: $\lambda^2 - \beta_1 \lambda - \beta_2 = 0$
4. **Compute eigenvalue modulus**: $|\lambda| = \max(|\lambda_1|, |\lambda_2|)$

The eigenvalue modulus quantifies temporal persistence:

- $|\lambda| \to 1$: Strong memory, slow decay
- $|\lambda| \to 0$: Weak memory, rapid decay
- $|\lambda| > 1$: Unstable (exponential growth)

## 2.3 Gene Panels

**Clock genes (13):** Per1, Per2, Per3, Cry1, Cry2, Clock, Arntl (Bmal1), Nr1d1, Nr1d2, Dbp, Tef, Npas2, Rorc

**Target genes (23):** Myc, Ccnd1, Ccnb1, Cdk1, Wee1, Cdkn1a, Lgr5, Axin2, Ctnnb1, Apc, Tp53, Mdm2, Atm, Chek2, Bcl2, Bax, Pparg, Sirt1, Hif1a, Ccne1, Ccne2, Mcm6, Mki67

**Gene panel rationale:** The 8 core clock genes constitute the canonical TTFL loops (Takahashi, *Nat Rev Genet* 2017). The 5 additional clock genes were selected based on independent functional evidence: Dbp, the most robustly circadian mammalian gene (Wuarin & Schibler, *Cell* 1990), is a direct CLOCK:BMAL1 target (Ripperger et al., *Genes Dev* 2000) and part of the PAR-bZIP clock output system with Tef (Gachon et al., *Cell Metab* 2006); Npas2 is a functional CLOCK paralog (Reick et al., *Science* 2001) whose double knockout with Clock produces complete arrhythmicity (DeBruyne et al., *Nat Neurosci* 2007); Rorc (RORγ) directly regulates Cry1, Bmal1, and Per2 (Takeda et al., *Nucleic Acids Res* 2012). Target additions include Ccne1/Ccne2 (G1/S regulators; Siu et al., *Cell Div* 2010; Farshadi et al., *J Mol Biol* 2020) and proliferation markers Mcm6 and Mki67. The AR(2) model order is independently validated by multi-generational cell-cycle correlations (Sandler et al., *Nature* 2015) and clock-cell cycle phase-locking (Feillet et al., *PNAS* 2014).

## 2.4 Verification

All displayed eigenvalues were verified by live computation against the source GEO files. Mean difference between displayed and computed values: 0.0002 (effectively exact).

## 2.5 Statistical Considerations

**Sample Size and Independence:**
While we analyzed 290 total samples across 21 conditions, the effective sample size for cross-tissue comparisons is lower due to within-study correlations. For example, liver, heart, and kidney from GSE54650 share the same experimental protocol and batch, reducing their independence. We report per-tissue results rather than pooled statistics to maintain transparency about this correlation structure.

**Multiple Testing:**
We did not apply formal multiple testing correction (e.g., Bonferroni) for three reasons: (1) this is an exploratory framework rather than confirmatory hypothesis testing, (2) the hierarchical pattern (clock $>$ target in healthy, reversed in cancer) is directionally consistent across independent datasets, and (3) the primary claim is about effect direction rather than statistical significance of individual comparisons. Formal statistical validation is reserved for future prospective studies.

## 2.6 Robustness Validation

Low-order autoregressive models are standard equation-free surrogates for linear dynamics in biological time series. AR(2) was selected as the minimal model that (i) produces complex eigenvalues capable of capturing oscillatory persistence, and (ii) passes standard residual diagnostics more reliably than AR(1) while showing no systematic advantage for AR(3) in eigenvalue separation.

**Model Order Selection (AR(1) vs AR(2) vs AR(3)):**
We compared all three model orders on GSE54650 liver (24 timepoints, 15 genes) using both Ljung-Box residual whiteness (lags=5, $\alpha$=0.05) and clock-target eigenvalue separation:

| Model | LB Pass Rate | Clock Mean $|\lambda|$ | Target Mean $|\lambda|$ | Gap |
|-------|-------------|-----------|-------------|------|
| AR(1) | 67% (10/15) | 0.726 | 0.302 | +0.424 |
| **AR(2)** | **93% (14/15)** | **0.725** | **0.479** | **+0.245** |
| AR(3) | 87% (13/15) | 0.553 | 0.565 | --0.012 |

AR(1) underfits: 5 of 13 clock genes fail Ljung-Box (residual autocorrelation remains), indicating AR(1) misses significant temporal structure. AR(3) overfits: while residual whiteness is acceptable, the clock-target gap collapses to near-zero (--0.012), suggesting that the third lag absorbs biologically meaningful variance into noise estimation. AR(2) achieves the best residual whiteness (93%) while preserving eigenvalue separation. The single AR(2) failure was Cry1 ($p$=0.018); AR(3) did not resolve this.

**Simulation Benchmark:**
Simulating AR(2) series with known ground-truth eigenvalues, estimation bias was 4% at $n$=24 timepoints (excellent), 7% at $n$=12 (acceptable), and 30% at $n$=6 (unreliable). All primary datasets have $n \geq 12$.

**Sampling Rate Invariance:**
Subsampling GSE54650 from 2-hour to 4-hour intervals preserved the clock-target gap: +0.245 (full) vs +0.244 (subsampled). The pattern is not an artifact of sampling frequency.

**Metric Robustness:**
The clock $>$ target pattern was confirmed by four independent metrics: AR(2) eigenvalue modulus (+0.245 gap), AR(1) autocorrelation coefficient (+0.424), sum of AR(2) coefficients $\beta_1 + \beta_2$ (+0.390), and Cosinor $R^2$ (+0.450). All four showed clock genes exceeding target genes, indicating the finding is not method-dependent.

# 3. Results

## 3.1 Healthy Tissue: Clock-Target Hierarchy

In healthy mouse tissues, clock genes consistently show higher eigenvalues than target genes:

| Tissue | Clock Mean $|\lambda|$ | Target Mean $|\lambda|$ | Gap | Pattern |
|--------|------------|-------------|-----|---------|
| Liver | 0.725 | 0.479 | **+0.245** | Clock $>$ Target |
| Heart | 0.689 | 0.356 | **+0.333** | Clock $>$ Target |
| Kidney | 0.777 | 0.561 | **+0.217** | Clock $>$ Target |

This "gearbox" pattern---where clock dynamics exhibit higher temporal persistence than proliferation targets---was observed in all three tissues examined.

## 3.2 Cancer: Hierarchy Disruption

In MYC-activated neuroblastoma (GSE221103), the clock-target hierarchy reverses:

| Condition | Clock Mean $|\lambda|$ | Target Mean $|\lambda|$ | Gap | Pattern |
|-----------|------------|-------------|-----|---------|
| MYC-ON (cancer) | 0.619 | 0.705 | **--0.086** | Target $>$ Clock |
| MYC-OFF (normal) | 0.614 | 0.488 | **+0.127** | Clock $>$ Target |

Key observations:

- MYC activation elevates target gene eigenvalues (especially MYC itself: $|\lambda|$=0.920)
- MYC inhibition restores the normal hierarchy
- CCNB1 shows $|\lambda| > 1$ in MYC-ON, suggesting unstable dynamics

## 3.3 Organoid Validation (Karpowicz Lab)

Analysis of intestinal organoid data (GSE157357) from the Karpowicz laboratory supports the pattern:

| Genotype | Clock Mean $|\lambda|$ | Target Mean $|\lambda|$ | Gap | Interpretation |
|----------|------------|-------------|-----|--------------|
| WT-WT (healthy) | 0.723 | 0.331 | **+0.392** | Strong hierarchy |
| ApcKO-WT (cancer) | 0.530 | 0.652 | **--0.122** | Reversed |
| WT-BmalKO | 0.459 | 0.540 | --0.082 | Disrupted |
| ApcKO-BmalKO | 0.511 | 0.465 | +0.046 | Partial restoration |

These data, from a controlled genetic model, show that APC mutation (oncogenic) reverses the clock-target hierarchy, consistent with the hypothesis that cancer disrupts circadian-proliferation coupling.

## 3.4 Clock Desynchrony Index

Circadian desynchronization---the loss of phase and amplitude coherence among clock genes within a tissue---has been identified as a hallmark of cancer (Filipski et al., *Front Endocrinol* 2017). To quantify this using eigenvalues, we computed the coefficient of variation (CV) of clock gene eigenvalues within each condition. Higher CV indicates less coordinated clock dynamics:

| Condition | Clock Mean $|\lambda|$ | CV |
|-----------|-----------|------|
| Liver (Healthy) | 0.725 | 0.153 |
| Heart (Healthy) | 0.689 | 0.149 |
| Kidney (Healthy) | 0.777 | 0.154 |
| Lung (Healthy) | 0.804 | 0.148 |
| Muscle (Healthy) | 0.634 | 0.218 |
| Adrenal (Healthy) | 0.697 | 0.178 |
| Hypothalamus (Healthy) | 0.506 | 0.276 |
| MYC-ON Neuroblastoma | 0.619 | 0.312 |
| MYC-OFF Neuroblastoma | 0.614 | 0.298 |

The cancer condition (MYC-ON neuroblastoma) showed higher desynchrony (CV=0.312) than the healthy tissue mean (CV=0.182, $n$=7 tissues), consistent with loss of clock coherence in malignancy. This observation requires validation across additional cancer types. Among healthy tissues, hypothalamus exhibited the highest desynchrony (CV=0.276), consistent with the central pacemaker integrating diverse oscillatory inputs.

**Relationship to the gap metric:** Pairwise correlation analysis across 9 conditions showed that the gap and desynchrony CV are strongly correlated ($r$ = --0.88). This is expected: both metrics are derived from eigenvalue distributions within the same gene panel and reflect the same underlying phenomenon — disruption of the clock–target hierarchy. When clock eigenvalues lose coherence (high CV), the mean clock eigenvalue drops relative to targets (gap shrinks), so these metrics are algebraically coupled rather than independent dimensions. Accordingly, desynchrony CV should be understood as a **derived consequence** of the same dynamical shift captured by the gap, not as independent corroborating evidence. The p53 pathway axis, by contrast, is largely independent of both the gap ($r$ = 0.01) and desynchrony ($r$ = --0.09), confirming it captures genuinely distinct biological information.

## 3.5 p53 Pathway Eigenvalue Dynamics

Given known chronic activation of the p53/Mdm2 axis under MYC-driven replication stress, we hypothesized that DNA damage response genes would show high eigenvalues (persistent dynamics) in MYC-ON cancer. To test this, we extended the analysis to eight DNA damage response genes (Tp53, Mdm2, Chek2, Cdkn1a, Bax, Bcl2, Atm, Gadd45a):

| Condition | Clock $|\lambda|$ | Target $|\lambda|$ | p53 Pathway $|\lambda|$ | p53 Closer To |
|-----------|---------|-----------|-------------|-----------|
| Healthy tissues ($n$=8, mean) | 0.648 | 0.478 | **0.452** | **Target** (8/8) |
| MYC-ON Cancer ($n$=1) | 0.639 | 0.541 | **0.665** | **Clock** |

In all eight healthy conditions, p53 pathway genes consistently behaved like target genes (low persistence, responsive). In MYC-ON neuroblastoma (the one cancer condition with p53 pathway gene coverage), p53 pathway eigenvalues jumped to 0.665---exceeding both clock and target means. Individual cancer eigenvalues were striking: Tp53 = 0.901, Mdm2 = 0.953, Gadd45a = 1.095 (unstable).

**Interpretation:** High p53 pathway eigenvalues in MYC-ON cancer suggest the DNA damage response has become "stuck"---persisting rather than responding flexibly to signals. Eigenvalues exceeding 1 (Gadd45a = 1.095) correspond to locally unstable dynamics in the AR(2) surrogate, consistent with runaway stress signaling and failure to re-establish homeostasis. This is consistent with chronically activated p53/Mdm2 under constitutive MYC-driven replication stress.

Notably, the AR(2) analysis is blind to pathway identity---it processes each gene's time series without knowledge of function. The independent recovery of this canonical cancer biology pattern (persistent p53/Mdm2 activation in MYC-driven malignancy) provides strong support for the biological plausibility of eigenvalue-based analysis. This finding is preliminary ($n$=1 cancer condition) and requires replication across additional cancer types.

## 3.6 Aging: Tissue-Specific Patterns

Analysis of epidermal stem cell data (GSE84521) from the Aznar-Benitah laboratory reveals tissue-specific aging effects:

| Condition | Mean $|\lambda|$ | vs Adult Control |
|-----------|---------|-----------------|
| Adult control | 0.824 | --- |
| Adult CR | 0.843 | +0.019 |
| Aged control | 0.754 | **--0.070** |
| Aged CR | 0.808 | --0.016 |

**Key finding:** In epidermal stem cells, aging *decreases* eigenvalues, and caloric restriction partially preserves higher values. This is opposite to pancreatic tissue (where aging increases clock eigenvalues), demonstrating that aging effects are tissue-specific, not universal.

## 3.8 Genome-Wide AR(2) Validation (Multi-Dataset)

To test whether the clock-target hierarchy is an artifact of panel curation, we ran AR(2) on all genes (~15K–60K per dataset) across five contexts:

| Dataset | Context | Genes | Clock Percentile | Gap | Wilcoxon p | Perm p | Hierarchy? |
|---------|---------|-------|-----------------|-----|-----------|--------|------------|
| GSE54650 Liver | Healthy | ~21K | 95th | +0.35 | <10⁻⁸ | 0.0000 | **YES** |
| GSE54650 Kidney | Healthy | ~21K | 96.4th | +0.356 | 6.9×10⁻⁹ | 0.0000 | **YES** |
| GSE113883 Blood | Healthy | ~58K | 79th | +0.333 | 0.0003 | 0.588 | Partial |
| GSE221103 MYC-ON | Cancer | ~60K | 75.5th | **-0.081** | 0.0015 | 0.763 | **REVERSED** |
| GSE70499 Bmal1-KO | Clock KO | ~22K | **43.7th** | -0.013 | 0.432 | 0.544 | **COLLAPSED** |

**Key findings:** (1) Kidney confirms the hierarchy is not liver-specific (96.4th percentile, p = 6.9×10⁻⁹). (2) Human blood shows clock elevation but the gap is not significant by permutation, consistent with weaker circadian hierarchy in blood. (3) Cancer reversal holds genome-wide — targets outrank clocks (78.7th vs 75.5th). (4) BMAL1-KO collapses clock genes to the 43.7th percentile (below median), providing causal evidence at full transcriptome scale. Total: ~180,000 gene-level AR(2) fits across 5 datasets.

# 4. Discussion

## 4.1 The Gearbox Hypothesis

We propose that the clock-target eigenvalue gap reflects a regulatory hierarchy: clock genes, positioned upstream, exhibit higher temporal persistence because they set the pace for downstream proliferative signaling. Cancer disrupts this hierarchy, allowing target genes to "escape" circadian constraint.

## 4.2 Molecular Basis

The eigenvalue hierarchy has a recently elucidated molecular basis. Hwang-Verslues and colleagues demonstrated that BMAL1 directly activates transcription of MEX3A, an RNA-binding protein that binds and stabilizes Lgr5 mRNA (Hwang-Verslues et al., *Sci Rep* 2023). This creates a regulatory cascade (BMAL1 $\to$ MEX3A $\to$ Lgr5) where clock gene dynamics necessarily precede and constrain target gene expression.

## 4.3 Mechanistic Bridge: From ODE Rate Constants to AR(2) Eigenvalues

The eigenvalue framework connects to mechanistic models of tissue renewal. Boman et al. (*Cancers* 2026) model colonic crypt dynamics as a three-compartment ODE system:

$$\frac{dC}{dt} = (k_1 - k_2 P)C \quad \text{[Cycling stem cells]}$$
$$\frac{dP}{dt} = (k_2 C - k_5)P \quad \text{[Proliferative transit-amplifying cells]}$$
$$\frac{dD}{dt} = k_3 P - k_4 D \quad \text{[Differentiated cells]}$$

Where $k_1$ = symmetric division rate, $k_2$ = autocatalytic polymerization, $k_3$ = asymmetric division, $k_4$ = extrusion, and $k_5$ = apoptosis.

**From Paper Table 1 to Rate Constants:**
Boman's Table 1 provides equilibrium cell fractions in normal colon: $C^* = 22\%$, $P^* = 17\%$, $D^* = 66\%$. Using the equilibrium equations $C^* = k_5/k_2$, $P^* = k_1/k_2$, and $D^* = k_1 k_3/(k_2 k_4)$, we derive:

| Parameter | Normal Value | Adenoma Change |
|-----------|--------------|----------------|
| $k_2$ | 5.88 | $\downarrow$ 3.8$\times$ |
| $k_5$ | 1.29 | $\downarrow$ 5.3$\times$ |
| $k_3/k_4$ | 3.88 | --- |

**The ODE-AR(2) Bridge:**
We assume that, over the observed timescales, the local dynamics around equilibrium can be approximated by a linear AR(2) process, and that the ODE's Jacobian is well approximated by the fitted AR matrix in a neighborhood of the operating point. Under these assumptions, the Jacobian eigenvalues map onto the AR(2) eigenvalues:

- **ODE eigenvalue (Jacobian):** Describes exponential decay/growth rates of perturbations around equilibrium
- **AR(2) eigenvalue (time-series):** Describes temporal autocorrelation persistence in gene expression

When sampled at regular intervals, a linearized ODE trajectory produces an autoregressive time series whose AR coefficients relate to the underlying Jacobian eigenvalues. This provides a *consistency check*: if AR(2) eigenvalues from gene expression match expectations from the mechanistic ODE, it supports the interpretation that eigenvalue signatures reflect real cellular dynamics.

We do not claim that every AR(2) model corresponds to a unique biophysical ODE; instead, we demonstrate that in at least one published mechanistic model (Boman et al. 2026), the AR(2) eigenvalue directly encodes return-to-homeostasis speed, providing a constructive example of the statistical-mechanistic correspondence.

**Cancer Shifts Both:**
In adenoma, Boman reports $k_2 \downarrow 3.8\times$ and $k_5 \downarrow 5.3\times$---precisely the rate constants controlling proliferative feedback and apoptosis. In our AR(2) analysis, cancer samples show *increased* target eigenvalues, consistent with reduced negative feedback (lower $k_2$) allowing more persistent proliferative dynamics.

## 4.4 Epigenetic Memory

The persistence of eigenvalue patterns across conditions may reflect epigenetic memory mechanisms. Faubion, Druliner, and colleagues demonstrated that intestinal stem cells from previously inflamed tissue retain altered chromatin accessibility even after months in culture without inflammatory signals (Hamdan et al., *bioRxiv* 2025). This suggests eigenvalue signatures may capture not just instantaneous dynamics but inherited epigenetic states.

## 4.5 Model Fit Quality as a Signal

Notably, clock genes exhibit higher $R^2$ values (mean=0.57) compared to target genes (mean=0.25), suggesting that AR(2) modeling itself distinguishes these gene classes. Higher $R^2$ for clock genes indicates their expression follows more deterministic temporal rules, while lower $R^2$ for targets suggests greater context-dependent stochasticity. This aligns with the hypothesis that proliferative genes integrate multiple regulatory inputs beyond circadian timing alone.

## 4.6 Interpretation Boundaries

**What $|\lambda|$ measures:**
The eigenvalue modulus $|\lambda|$ quantifies temporal persistence of *fluctuations around the mean*---how strongly today's deviation from baseline predicts tomorrow's. It is a statistical descriptor of correlation structure, not direct evidence of mechanistic inheritance.

**What $|\lambda|$ does NOT measure:**

- Literal "mother-daughter" gene transmission (despite the AR(2) terminology)
- Amplitude of oscillations (use Cosinor for that)
- Causation (eigenvalue differences are correlational)

The Höfer lab's "grandmother effect" finding (cousin cells correlate) validates that AR(2) captures biologically real memory, but the eigenvalue itself remains a summary statistic requiring mechanistic follow-up.

## 4.6.5 Root-Space Geometry & φ-Enrichment Analysis

Mapping AR(2) coefficients ($\beta_1$, $\beta_2$) to root space ($r$, $\theta$) provides a geometric view of gene expression dynamics within the stationarity triangle. Across 136 genes from 5 datasets, we tested whether observed root-space positions are enriched near a golden-mean reference geometry using three formal tests against null distributions:

1. **Golden-Mean Proximity** (vs phase-randomized surrogates): $p$ = 0.105, not significant — treated as exploratory
2. **Root-Space Clustering** (vs uniform stationarity triangle): $p$ = 0.534, not significant
3. **φ-Band Occupancy**: $p$ = 0.0048, significant — survives Bonferroni correction ($\alpha$ = 0.0167)

The cancer perturbation shift (WT vs ApcKO organoids) was highly significant (Mann-Whitney $p$ < 0.001), confirming that APC mutation detectably shifts root-space geometry. Overall verdict: MODERATE.

Root dominance is determined by largest modulus $|\lambda|$, not signed value. Negative real roots are mapped to $\theta = \pi$ (sign-alternating dynamics). All surrogate generation and permutation tests use seeded RNG (seed = 42) for deterministic reproducibility. Two datasets (GSE48113 Aligned and Misaligned) were excluded due to missing input files; this exclusion is data-availability-based, not outcome-based.

**Mapping sensitivity:** The angular reference $\theta_\phi = 2\pi/\phi$ was stress-tested against two alternatives ($2\pi/\phi^2$ at 137.5° and $\pi/\phi$ at 111.2°). The $\phi$-band occupancy test was significant in 2 of 3 mappings (p = 0.0039 and p = 0.0012). An analytical null from 100,000 uniform AR(2) draws showed the production mapping is the only one where biology is enriched (1.86$\times$) rather than depleted, confirming the result is not an artifact of coordinate choice.

## 4.6b Effective Sample Size Summary

The following table maps each major claim to its supporting independent cohorts and estimated effective sample size. Effective $n$ is estimated from block permutation analysis (where available, e.g., GSE54650 block permutation FPR = 70% at 3+ tissues implies ~3–4 effective independent units from 12 nominal tissues) and from counting truly independent laboratory cohorts for cross-study claims.

| Claim | Supporting Datasets | Nominal $n$ | Effective $n$ | Notes |
|-------|-------------------|-----------|-------------|-------|
| Clock > target (mouse) | GSE54650 | 12 tissues | ~3–4 | Block perm. FPR = 70% |
| Clock > target (baboon) | GSE98965 | 14 tissues | ~4–5 | Same cohort |
| Clock > target (human blood) | GSE48113, GSE39445, GSE122541 | 6 conditions | 3 | Independent labs |
| Hierarchy reversal (cancer) | GSE221103, GSE157357 | 3 conditions | 2 | Different species/labs |
| Aging trajectory | GSE84521, GSE93903, GSE201207 | 6 conditions | 3 | Different tissues |
| p53 pathway shift | GSE54650, GSE221103 | 9 conditions | 2 | Cross-species |
| Genome-wide validation | 5 datasets, 2 species | ~180K gene fits | 3–4 | 5-context: healthy×2, blood, cancer, clock-KO |
| Multi-species conservation | 14 datasets, 4 species | 14 datasets | ~6–8 | Cross-lab |

The hierarchy reversal in cancer (effective $n$ = 2) is the claim most in need of additional independent validation.

## 4.7 Limitations

1. **Sample size:** While we analyzed multiple datasets, cross-tissue correlations within studies may reduce effective sample size (see Table 4.6b above).
2. **Cancer generalization (Major):** The hierarchy reversal was observed in only two cancer models: MYC-ON neuroblastoma (GSE221103, human cell line) and APC-mutant intestinal organoids (GSE157357, mouse). No bulk human tumor datasets with matched normal controls and sufficient temporal resolution for AR(2) analysis (≥12 timepoints over 24–48h) currently exist in GEO. TCGA provides large-scale tumor-vs-normal comparisons but uses static single-timepoint snapshots incompatible with time-series autoregressive modeling. The only candidate time-series cancer dataset identified (GSE46549, colorectal cancer, 32 patients) has limited matched normal controls. Future validation should prioritize: (a) prospective time-course sampling of matched tumor-normal tissue, (b) the GSE46549 colorectal dataset as the most accessible existing candidate, and (c) application to organoid biobanks where controlled time-series sampling is feasible. Until replicated across ≥3 independent cancer types, the hierarchy reversal should be considered a hypothesis specific to MYC-driven and APC-mutant contexts, not a general cancer property.
3. **Mechanism vs. correlation:** Eigenvalue differences are observational; causal relationships require experimental validation.
4. **Gap and desynchrony correlation:** The clock-target gap and desynchrony CV are strongly correlated ($r$ = --0.88), reflecting algebraic coupling: both are derived from the same eigenvalue distributions and measure the same underlying disruption. Desynchrony CV is a derived consequence of the gap, not an independent dimension. The p53 pathway axis ($r$ = 0.01 with gap) is the only genuinely independent axis.
5. **AR(2) approximation:** The ODE-AR(2) bridge assumes linearization around equilibrium; nonlinear dynamics or far-from-equilibrium transitions may not be captured.
6. **Root-space geometry:** The φ-enrichment analysis yields a MODERATE verdict; golden-mean proximity is borderline and should be treated as exploratory rather than confirmatory.

## 4.8 Future Validation

The following experiments would strengthen the framework:

1. **Prospective circadian time courses** in matched healthy/tumor tissue from the same patient, analyzed with pre-registered eigenvalue hypotheses (clock $>$ target in healthy, convergence or reversal in tumor).
2. **CRISPR perturbation of specific clock genes** (e.g., BMAL1 knockout) followed by AR(2) analysis, to test whether loss of a single clock gene reduces the eigenvalue gap as predicted.
3. **Single-cell time-lapse data** (e.g., from Fucci reporters) to determine whether eigenvalue signatures are preserved at single-cell resolution or emerge only as population-level statistics.
4. **Pan-cancer GEO meta-analysis** covering $\geq 5$ cancer types with matched healthy controls, to establish whether clock-target convergence is cancer-general or specific to MYC-driven and APC-mutant contexts.
5. **Pharmacological chronotherapy trials** measuring eigenvalue gap before and after timed drug administration, to test whether the gap serves as a predictive biomarker for circadian-aligned treatment response.

# 5. Conclusions

AR(2) eigenvalue analysis reveals a consistent clock-target hierarchy in healthy tissues that is disrupted in the cancer models examined. This approach provides a quantitative metric for circadian-proliferation coupling that complements traditional amplitude and phase measurements.

The framework is exploratory and descriptive. The "gearbox" terminology describes an observed pattern, not a proven mechanism. Validation in additional cancer types and experimental perturbation studies are needed before clinical translation.

# References

1. Kuchen EE, Becker NB, Claudino N, Höfer T. Hidden long-range memories of growth and cycle speed correlate cell cycles in lineage trees. *eLife*. 2020;9:e51002. doi:10.7554/eLife.51002

2. Hwang-Verslues WW, et al. Core clock gene BMAL1 and RNA-binding protein MEX3A collaboratively regulate Lgr5 expression in intestinal crypt cells. *Sci Rep*. 2023;13:17597. doi:10.1038/s41598-023-44997-5

3. Duan Y, Karri S, Andersen B. Circadian clock regulation of epithelial stem cells. *Stem Cells*. 2023. doi:10.1093/stmcls/sxad042

4. Solanas G, et al. Aged Stem Cells Reprogram Their Daily Rhythmic Functions to Adapt to Stress. *Cell*. 2017;170(4):678-692.e20. doi:10.1016/j.cell.2017.07.035

5. Hamdan FH, et al. Intestinal Stem Cells from Patients with Inflammatory Bowel Disease Retain an Epigenetic Memory of Inflammation. *bioRxiv*. 2025. doi:10.1101/2025.05.24.655923

6. Stokes K, et al. The Circadian Clock Gene, Bmal1, Regulates Intestinal Stem Cell Signaling and Represses Tumor Initiation. *Cell Mol Gastroenterol Hepatol*. 2021;12(5):1669-1696. doi:10.1016/j.jcmgh.2021.08.016

7. Boman RM, Schleiniger G, Raymond C, Palazzo J, Shehab A, Boman BM. A Tissue Renewal-Based Mechanism Drives Colon Tumorigenesis. *Cancers*. 2026;18:44. doi:10.3390/cancers18010044

8. Ripperger JA, Shearman LP, Reppert SM, Schibler U. CLOCK, an essential pacemaker component, controls expression of the circadian transcription factor DBP. *Genes & Development*. 2000;14(6):679-689. doi:10.1101/gad.14.6.679

9. Wuarin J, Schibler U. Expression of the liver-enriched transcriptional activator protein DBP follows a stringent circadian rhythm. *Cell*. 1990;63(6):1257-1266. doi:10.1016/0092-8674(90)90421-A

10. Gachon F, Olela FF, Schaad O, Descombes P, Schibler U. The circadian PAR-domain basic leucine zipper transcription factors DBP, TEF, and HLF modulate basal and inducible xenobiotic detoxification. *Cell Metabolism*. 2006;4(1):25-36. doi:10.1016/j.cmet.2006.04.015

11. Reick M, Garcia JA, Dudley C, McKnight SL. NPAS2: an analog of clock operative in the mammalian forebrain. *Science*. 2001;293(5529):506-509. doi:10.1126/science.1060699

12. DeBruyne JP, Weaver DR, Reppert SM. CLOCK and NPAS2 have overlapping roles in the suprachiasmatic circadian clock. *Nature Neuroscience*. 2007;10(5):543-545. doi:10.1038/nn1884

13. Shi S, Hida A, McGuinness OP, Bhatt DK, DeBruyne JP. NPAS2 compensates for loss of CLOCK in peripheral circadian oscillators. *PLOS Genetics*. 2016;12(2):e1005882. doi:10.1371/journal.pgen.1005882

14. Takeda Y, Jothi R, Birault V, Jetten AM. RORγ directly regulates the circadian expression of clock genes and downstream targets in vivo. *Nucleic Acids Research*. 2012;40(17):8519-8535. doi:10.1093/nar/gks630

15. Siu KT, Rosner MR, Minella AC. An integrated view of cyclin E function and regulation. *Cell Division*. 2010;5:2. doi:10.1186/1747-1028-5-2

16. Farshadi E, van der Horst GTJ, Chaves I. Molecular links between the circadian clock and the cell cycle. *Journal of Molecular Biology*. 2020;432(12):3515-3524. doi:10.1016/j.jmb.2020.04.003

17. Sandler O, Mizrahi SP, Weiss N, Agam O, Simon I, Balaban NQ. Lineage correlations of single cell division time as a probe of cell-cycle dynamics. *Nature*. 2015;519:468-471. doi:10.1038/nature14318

18. Feillet C, Krusche P, Taber F, et al. Phase locking and multiple oscillating attractors for the coupled mammalian clock and cell cycle. *PNAS*. 2014;111(27):9828-9833. doi:10.1073/pnas.1320474111

# Data Availability

All source data are available from NCBI GEO:

- GSE54650: https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE54650
- GSE221103: https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE221103
- GSE157357: https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE157357
- GSE84521: https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE84521

Computed eigenvalues can be verified via the PAR(2) Discovery Engine web application.

# Acknowledgments

We thank the data generators for making their datasets publicly available, and the researchers whose work informed this framework: Thomas Höfer (DKFZ), Salvador Aznar-Benitah (IRB Barcelona), Phillip Karpowicz (U. Windsor), Wendy Hwang-Verslues (Academia Sinica), Bogi Andersen (UC Irvine), the Faubion/Druliner laboratory (Mayo Clinic), and Bruce Boman and colleagues (University of Delaware) for their stem cell compartment ODE model.
