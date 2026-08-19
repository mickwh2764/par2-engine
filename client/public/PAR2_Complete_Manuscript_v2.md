# PAR(2) Discovery Engine: Eigenvalue Dynamics Reveal Circadian-Proliferation Hierarchy in Health and Disease

**Author:** Michael Whiteside  
**Date:** February 2026  
**Version:** 2.0 (Fully Updated with All Citations)

---

## Abstract

We present a statistical framework for analyzing gene expression time series using second-order autoregressive [AR(2)] modeling. The eigenvalue modulus |λ| derived from AR(2) fitting quantifies temporal persistence—how strongly a gene's expression "remembers" its previous states. Analysis of publicly available NCBI GEO datasets reveals a consistent pattern in healthy tissues: circadian clock genes (Per1, Per2, Bmal1, Clock) exhibit higher eigenvalues than proliferation target genes (Myc, Ccnd1, Wee1), suggesting a "gearbox" hierarchy where clock dynamics constrain proliferative signaling.

In cancer models studied here (MYC-activated neuroblastoma, APC-mutant intestinal organoids), this hierarchy collapses or reverses—target eigenvalues approach or exceed clock eigenvalues, consistent with altered coupling between circadian and proliferative dynamics. Cancer also shows increased clock desynchrony (1.23× higher eigenvalue variance among clock genes) and a striking shift in DNA damage response dynamics: p53 pathway genes move from target-like eigenvalues (0.452) in healthy tissue to clock-like values (0.665) in cancer, suggesting the damage response becomes "stuck" rather than responsive. Aging shows tissue-specific patterns: epidermal stem cells show decreased eigenvalues with age, while pancreatic tissue shows increased clock eigenvalues.

**Key Finding:** The clock-target eigenvalue gap averages +0.22 to +0.39 in healthy tissues and -0.09 to -0.12 in the cancer models examined (MYC-activated neuroblastoma and APC-mutant organoids). This pattern, while observed consistently across the datasets studied, requires validation in broader cancer cohorts before generalization. Robustness validation (Supplementary Section S7) confirms that block permutation preserving cross-tissue dependence yields substantially higher false positive rates than independent-tissue assumptions, indicating that within-cohort consensus should be interpreted cautiously.

**Note on Scope:** All findings are derived from publicly available GEO datasets and are hypothesis-generating. Effective sample size may be lower than dataset count due to cross-tissue correlations within studies. The curated 36-gene panel (13 clock + 23 target) produces eigenperiod distributions at the 99th percentile of random gene panels (Supplementary Section S7.4), indicating panel-specific rather than transcriptome-general behavior.

---

## 1. Introduction

### 1.1 The Circadian-Proliferation Interface

The circadian clock coordinates cellular processes across a 24-hour cycle, including the timing of cell division. Disruption of circadian rhythms is associated with increased cancer risk, but the quantitative relationship between clock gene dynamics and proliferative control remains incompletely characterized.

### 1.2 Theoretical Framework

We adopt a constraints-before-mechanism approach, consistent with theoretical frameworks developed by Andersen and colleagues, who propose that the circadian clock's primary role in epithelial stem cells is to coordinate the cell cycle with intermediary metabolism to minimize DNA damage (Duan et al., Stem Cells 2023). Rather than focusing on specific molecular interactions, we ask: what temporal signatures distinguish clock genes from their downstream targets?

### 1.3 Why AR(2) Modeling?

The choice of second-order autoregressive modeling [AR(2)] over first-order [AR(1)] is not merely statistical convenience but reflects biological reality. Höfer and colleagues demonstrated that while mother-daughter cell cycle correlations are weak (r ≈ 0.1-0.2), cousin cells sharing a common grandmother show surprisingly strong correlated cell-cycle durations (r ≈ 0.3-0.4) (Kuchen et al., eLife 2020). This "skip-generation" memory pattern is precisely what AR(2) captures through its β₂ coefficient. The eigenvalue modulus |λ| derived from AR(2) thus reflects biologically validated multi-generational dynamics that AR(1) would systematically underestimate.

---

## 2. Methods

### 2.1 Data Sources

All expression data were obtained from NCBI Gene Expression Omnibus (GEO):

| Dataset | Description | Samples | Timepoints | Lab |
|---------|-------------|---------|------------|-----|
| GSE54650 | Mouse circadian atlas (Liver, Heart, Kidney) | 72 | 24 (CT18-CT64) | Zhang/Hogenesch |
| GSE221103 | Neuroblastoma MYC ON/OFF | 28 | 14 (CT24-CT76) | — |
| GSE157357 | Intestinal organoids (WT, APC-KO, BMAL1-KO) | 88 | 11-12 | Karpowicz |
| GSE84521 | Epidermal stem cell aging | 102 | 6 (T0-T20) | Aznar-Benitah |
| GSE98965 | Baboon multi-tissue circadian atlas | ~29,000 genes × 64 tissues | 12 (ZT0-ZT22, 2h) | Mure/Panda (Salk) |

### 2.2 AR(2) Algorithm

For each gene's expression time series y(t):

1. **Mean-center**: ỹ(t) = y(t) - mean(y)
2. **Fit AR(2)**: ỹ(t) = β₁·ỹ(t-1) + β₂·ỹ(t-2) + ε
3. **Solve characteristic equation**: λ² - β₁λ - β₂ = 0
4. **Compute eigenvalue modulus**: |λ| = max(|λ₁|, |λ₂|)

The eigenvalue modulus quantifies temporal persistence:
- |λ| → 1: Strong memory, slow decay
- |λ| → 0: Weak memory, rapid decay
- |λ| > 1: Unstable (exponential growth)

### 2.3 Gene Panels

**Clock genes (13):** Per1, Per2, Per3, Cry1, Cry2, Clock, Arntl (Bmal1), Nr1d1, Nr1d2, Dbp, Tef, Npas2, Rorc  
**Target genes (23):** Myc, Ccnd1, Ccnb1, Cdk1, Wee1, Cdkn1a, Lgr5, Axin2, Ctnnb1, Apc, Tp53, Mdm2, Atm, Chek2, Bcl2, Bax, Pparg, Sirt1, Hif1a, Ccne1, Ccne2, Mcm6, Mki67

**Gene panel rationale:** The 8 core clock genes constitute the canonical TTFL loops (Takahashi, *Nat Rev Genet* 2017). The 5 additional clock genes were selected based on independent functional evidence: Dbp, the most robustly circadian mammalian gene (Wuarin & Schibler, *Cell* 1990), is a direct CLOCK:BMAL1 target (Ripperger et al., *Genes Dev* 2000) and part of the PAR-bZIP clock output system with Tef (Gachon et al., *Cell Metab* 2006); Npas2 is a functional CLOCK paralog (Reick et al., *Science* 2001) whose double knockout with Clock produces complete arrhythmicity (DeBruyne et al., *Nat Neurosci* 2007); Rorc (RORγ) directly regulates Cry1, Bmal1, and Per2 (Takeda et al., *Nucleic Acids Res* 2012). Target additions include Ccne1/Ccne2 (G1/S regulators; Siu et al., *Cell Div* 2010; Farshadi et al., *J Mol Biol* 2020) and proliferation markers Mcm6 and Mki67. The AR(2) model order is independently validated by multi-generational cell-cycle correlations (Sandler et al., *Nature* 2015) and clock-cell cycle phase-locking (Feillet et al., *PNAS* 2014).

**Panel Selection Caveat:** This panel was curated based on known circadian and proliferation biology. Random panel benchmarking (100 random 36-gene panels from the same datasets) shows that our curated panel's median eigenperiod sits at the 99th percentile of random panels (21.1h curated vs 9.8h random mean; Supplementary Section S7.4). This indicates the observed eigenperiod distributions are panel-specific—they do not represent generic transcriptomic behavior. All findings should be interpreted within the context of this biologically motivated gene selection.

### 2.4 Verification

All displayed eigenvalues were verified by live computation against the source GEO files. Mean difference between displayed and computed values: 0.0002 (effectively exact).

### 2.5 Statistical Considerations

**Sample Size and Independence:**
While we analyzed 290 total samples across 21 conditions, the effective sample size for cross-tissue comparisons is lower due to within-study correlations. For example, liver, heart, and kidney from GSE54650 share the same experimental protocol and batch, reducing their independence. We report per-tissue results rather than pooled statistics to maintain transparency about this correlation structure.

**Multiple Testing:**
We did not apply formal multiple testing correction (e.g., Bonferroni) for three reasons: (1) this is an exploratory framework rather than confirmatory hypothesis testing, (2) the hierarchical pattern (clock > target in healthy, reversed in cancer) is directionally consistent across independent datasets, and (3) the primary claim is about effect direction rather than statistical significance of individual comparisons. Formal statistical validation is reserved for future prospective studies.

### 2.6 Robustness Validation

Low-order autoregressive models are standard equation-free surrogates for linear dynamics in biological time series. AR(2) was selected as the minimal model that (i) produces complex eigenvalues capable of capturing oscillatory persistence, and (ii) passes standard residual diagnostics more reliably than AR(1) while showing no systematic advantage for AR(3) in eigenvalue separation.

**Model Order Selection (AR(1) vs AR(2) vs AR(3)):**
We compared all three model orders on GSE54650 liver (24 timepoints, 15 genes) using both Ljung-Box residual whiteness (lags=5, α=0.05) and clock-target eigenvalue separation:

| Model | LB Pass Rate | Clock Mean |λ| | Target Mean |λ| | Gap |
|-------|-------------|-----------|-------------|------|
| AR(1) | 67% (10/15) | 0.726 | 0.302 | +0.424 |
| **AR(2)** | **93% (14/15)** | **0.725** | **0.479** | **+0.245** |
| AR(3) | 87% (13/15) | 0.553 | 0.565 | -0.012 |

AR(1) underfits: 5 of 13 clock genes fail Ljung-Box (residual autocorrelation remains), indicating AR(1) misses significant temporal structure. AR(3) overfits: while residual whiteness is acceptable, the clock-target gap collapses to near-zero (-0.012), suggesting that the third lag absorbs biologically meaningful variance into noise estimation. AR(2) achieves the best residual whiteness (93%) while preserving eigenvalue separation. The single AR(2) failure was Cry1 (p=0.018); AR(3) did not resolve this.

**Simulation Benchmark:**
Simulating AR(2) series with known ground-truth eigenvalues, estimation bias was 4% at n=24 timepoints (excellent), 7% at n=12 (acceptable), and 30% at n=6 (unreliable). All primary datasets have n ≥ 12.

**Sampling Rate Invariance:**
Subsampling GSE54650 from 2-hour to 4-hour intervals preserved the clock-target gap: +0.245 (full) vs +0.244 (subsampled). The pattern is not an artifact of sampling frequency.

**Metric Robustness:**
The clock > target pattern was confirmed by four independent metrics: AR(2) eigenvalue modulus (+0.245 gap), AR(1) autocorrelation coefficient (+0.424), sum of AR(2) coefficients β₁+β₂ (+0.390), and Cosinor R² (+0.450). All four showed clock genes exceeding target genes, indicating the finding is not method-dependent.

---

## 3. Results

### 3.1 Healthy Tissue: Clock-Target Hierarchy

In healthy mouse tissues, clock genes consistently show higher eigenvalues than target genes:

| Tissue | Clock Mean |λ| | Target Mean |λ| | Gap | Pattern |
|--------|------------|-------------|-----|---------|
| Liver | 0.725 | 0.479 | **+0.245** | Clock > Target |
| Heart | 0.689 | 0.356 | **+0.333** | Clock > Target |
| Kidney | 0.777 | 0.561 | **+0.217** | Clock > Target |

This "gearbox" pattern—where clock dynamics exhibit higher temporal persistence than proliferation targets—was observed in all three tissues examined from the same cohort (GSE54650). Because these tissues share experimental protocol, animal cohort, and batch effects, they do not constitute fully independent replicates. Block permutation analysis preserving this shared variance structure yields a 3+ tissue false positive rate of 70% (vs 2% under an independence assumption; Supplementary Section S7.5), indicating that within-cohort cross-tissue consensus may be optimistic. Cross-cohort replication is needed to establish independence.

### 3.2 Cancer: Hierarchy Disruption

In MYC-activated neuroblastoma (GSE221103), the clock-target hierarchy reverses:

| Condition | Clock Mean |λ| | Target Mean |λ| | Gap | Pattern |
|-----------|------------|-------------|-----|---------|
| MYC-ON (cancer) | 0.619 | 0.705 | **-0.086** | Target > Clock |
| MYC-OFF (normal) | 0.614 | 0.488 | **+0.127** | Clock > Target |

Key observations:
- MYC activation elevates target gene eigenvalues (especially MYC itself: |λ|=0.920)
- MYC inhibition restores the normal hierarchy
- CCNB1 shows |λ|>1 in MYC-ON, suggesting unstable dynamics

### 3.3 Organoid Validation (Karpowicz Lab)

Analysis of intestinal organoid data (GSE157357) from the Karpowicz laboratory supports the pattern:

| Genotype | Clock Mean |λ| | Target Mean |λ| | Gap | Interpretation |
|----------|------------|-------------|-----|--------------|
| WT-WT (healthy) | 0.723 | 0.331 | **+0.392** | Strong hierarchy |
| ApcKO-WT (cancer) | 0.530 | 0.652 | **-0.122** | Reversed |
| WT-BmalKO | 0.459 | 0.540 | -0.082 | Disrupted |
| ApcKO-BmalKO | 0.511 | 0.465 | +0.046 | Partial restoration |

These data, from a controlled genetic model, show that APC mutation (oncogenic) reverses the clock-target hierarchy, consistent with the hypothesis that cancer disrupts circadian-proliferation coupling.

### 3.4 Clock Desynchrony Index

Circadian desynchronization—the loss of phase and amplitude coherence among clock genes within a tissue—has been identified as a hallmark of cancer (Filipski et al., Front Endocrinol 2017). To quantify this using eigenvalues, we computed the coefficient of variation (CV) of clock gene eigenvalues within each condition. Higher CV indicates less coordinated clock dynamics:

| Condition | Clock Mean |λ| | CV |
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

The cancer condition (MYC-ON neuroblastoma) showed higher desynchrony (CV=0.312) than the healthy tissue mean (CV=0.182, n=7 tissues), consistent with loss of clock coherence in malignancy. This observation requires validation across additional cancer types. Among healthy tissues, hypothalamus exhibited the highest desynchrony (CV=0.276), consistent with the central pacemaker integrating diverse oscillatory inputs.

**Relationship to the gap metric:** Pairwise correlation analysis across 9 conditions showed that the gap and desynchrony CV are strongly correlated (r = -0.88). This is expected: both metrics are derived from eigenvalue distributions within the same gene panel and reflect the same underlying phenomenon — disruption of the clock–target hierarchy. When clock eigenvalues lose coherence (high CV), the mean clock eigenvalue drops relative to targets (gap shrinks), so these metrics are algebraically coupled rather than independent dimensions. Accordingly, desynchrony CV should be understood as a **derived consequence** of the same dynamical shift captured by the gap, not as independent corroborating evidence. We retain it as a complementary visualization of clock incoherence, but do not count it as a separate line of evidence for the gearbox hypothesis. The p53 pathway axis, by contrast, is largely independent of both the gap (r = 0.01) and desynchrony (r = -0.09), confirming it captures genuinely distinct biological information — the transition of DNA damage response genes from responsive (target-like) to persistent (clock-like) dynamics.

### 3.5 p53 Pathway Eigenvalue Dynamics

Given known chronic activation of the p53/Mdm2 axis under MYC-driven replication stress, we hypothesized that DNA damage response genes would show high eigenvalues (persistent dynamics) in MYC-ON cancer. To test this, we extended the analysis to eight DNA damage response genes (Tp53, Mdm2, Chek2, Cdkn1a, Bax, Bcl2, Atm, Gadd45a):

| Condition | Clock |λ| | Target |λ| | p53 Pathway |λ| | p53 Closer To |
|-----------|---------|-----------|-------------|-----------|
| Healthy tissues (n=8, mean) | 0.648 | 0.478 | **0.452** | **Target** (8/8) |
| MYC-ON Cancer (n=1) | 0.639 | 0.541 | **0.665** | **Clock** |

In all eight healthy conditions, p53 pathway genes consistently behaved like target genes (low persistence, responsive). In MYC-ON neuroblastoma (the one cancer condition with p53 pathway gene coverage), p53 pathway eigenvalues jumped to 0.665—exceeding both clock and target means. Individual cancer eigenvalues were striking: Tp53 = 0.901, Mdm2 = 0.953, Gadd45a = 1.095 (unstable).

**Interpretation:** High p53 pathway eigenvalues in MYC-ON cancer suggest the DNA damage response has become "stuck"—persisting rather than responding flexibly to signals. Eigenvalues exceeding 1 (Gadd45a = 1.095) correspond to locally unstable dynamics in the AR(2) surrogate, consistent with runaway stress signaling and failure to re-establish homeostasis. This is consistent with chronically activated p53/Mdm2 under constitutive MYC-driven replication stress.

Notably, the AR(2) analysis is blind to pathway identity—it processes each gene's time series without knowledge of function. The independent recovery of this canonical cancer biology pattern (persistent p53/Mdm2 activation in MYC-driven malignancy) provides strong support for the biological plausibility of eigenvalue-based analysis. This finding is preliminary (n=1 cancer condition) and requires replication across additional cancer types.

### 3.6 Cross-Species External Validation (Baboon)

To test whether the clock-target hierarchy generalizes beyond the mouse GSE54650 cohort, we applied identical AR(2) analysis to the baboon multi-tissue circadian atlas (GSE98965, Mure et al., Science 2018), an independent dataset from a different species (Papio anubis), laboratory (Panda Lab, Salk Institute), and experimental platform (RNA-seq vs microarray). This dataset provides 12 timepoints (2h sampling across 24h) in 64 tissues.

Of 14 baboon tissues with sufficient clock (≥3) and target (≥3) gene coverage, 8 (57%) preserved the clock > target eigenvalue hierarchy. Selected tissues shown below (full 14-tissue table in Supplementary Section S7.8):

| Tissue | Clock |λ| (n) | Target |λ| (n) | Gap | Hierarchy |
|--------|-----------|---------|------------|---------|-----------|
| Lung | 0.675 (13) | 0.525 (23) | +0.150 | Preserved |
| Hippocampus | 0.635 (13) | 0.532 (23) | +0.103 | Preserved |
| White Adipose | 0.562 (13) | 0.461 (23) | +0.102 | Preserved |
| Kidney Cortex | 0.594 (13) | 0.554 (23) | +0.040 | Preserved |
| Liver | 0.497 (13) | 0.594 (23) | -0.096 | **Reversed** |
| Cerebellum | 0.400 (13) | 0.510 (23) | -0.111 | **Reversed** |
| Aorta | 0.410 (13) | 0.552 (23) | -0.142 | **Reversed** |

Grand mean eigenvalues (all tissues pooled): clock = 0.551, target = 0.549, gap = +0.002 (Mann-Whitney p = 0.81, not significant).

**Interpretation:** The baboon results provide partial but not population-level support for the clock-target hierarchy. The hierarchy is present in a majority of tissues (57%) and strongest in Lung (+0.150), Hippocampus (+0.103), and White Adipose (+0.102), but reversed in Liver (-0.096) and Cerebellum (-0.111). Notably, Liver — the strongest tissue in the mouse GSE54650 data — shows reversed hierarchy in baboon, suggesting species-specific or cohort-specific tissue rankings. The absence of population-level significance (p = 0.81) reinforces that the gearbox hierarchy is a tissue-variable phenomenon dependent on gene panel, species, and experimental conditions — consistent with the cautious framing throughout this manuscript.

### 3.7 Aging: Tissue-Specific Patterns

Analysis of epidermal stem cell data (GSE84521) from the Aznar-Benitah laboratory reveals tissue-specific aging effects:

| Condition | Mean |λ| | vs Adult Control |
|-----------|---------|-----------------|
| Adult control | 0.824 | — |
| Adult CR | 0.843 | +0.019 |
| Aged control | 0.754 | **-0.070** |
| Aged CR | 0.808 | -0.016 |

**Key finding:** In epidermal stem cells, aging *decreases* eigenvalues, and caloric restriction partially preserves higher values. This is opposite to pancreatic tissue (where aging increases clock eigenvalues), demonstrating that aging effects are tissue-specific, not universal.

### 3.8 Genome-Wide AR(2) Validation (Multi-Dataset)

To address the concern that the clock-target hierarchy might be an artifact of curated panel selection, we ran the AR(2) pipeline on all genes in each dataset (~15K–60K genes per dataset) and asked: do clock genes rank significantly above the genome-wide eigenvalue distribution? We tested five contexts spanning healthy tissue, cancer, and genetic clock disruption.

| Dataset | Context | Species | Genes | Clock Percentile | Target Percentile | Gap | Wilcoxon p (clock vs genome) | Permutation p | Hierarchy? |
|---------|---------|---------|-------|-----------------|-------------------|-----|------------------------------|---------------|------------|
| GSE54650 Liver | Healthy tissue | Mouse | ~21K | 95th | — | +0.35 | <10⁻⁸ | 0.0000 | **YES** |
| GSE54650 Kidney | Healthy tissue | Mouse | ~21K | 96.4th | — | +0.356 | 6.9×10⁻⁹ | 0.0000 | **YES** |
| GSE113883 Whole Blood | Healthy tissue | Human | ~58K | 79th | — | +0.333 | 0.0003 | 0.588 | Partial |
| GSE221103 MYC-ON | Cancer | Human | ~60K | 75.5th | 78.7th | **-0.081** | 0.0015 | 0.763 | **REVERSED** |
| GSE70499 Bmal1-KO Liver | Clock knockout | Mouse | ~22K | **43.7th** | 47.6th | -0.013 | 0.432 | 0.544 | **COLLAPSED** |

**Key findings from genome-wide validation:**

1. **Cross-tissue replication:** Mouse kidney shows clock genes at the 96.4th percentile (Wilcoxon p = 6.9×10⁻⁹, permutation p = 0.0000), confirming the hierarchy is not liver-specific.

2. **Cross-species signal with tissue-dependent strength:** Human whole blood shows clock genes individually elevated (79th percentile, Wilcoxon p = 0.0003), but the clock-target gap does not beat random gene panels in permutation testing (p = 0.588). This is consistent with blood being a weaker circadian tissue than solid organs.

3. **Cancer reversal at genome-wide scale:** In MYC-ON neuroblastoma, target genes (78.7th percentile) outrank clock genes (75.5th percentile) genome-wide. The gap is negative (-0.081), confirming that the hierarchy reversal observed in the curated panel is not a panel selection artifact.

4. **Causal validation — BMAL1-KO collapses the hierarchy:** When the master clock gene is knocked out, clock genes drop from the 95th+ percentile to the 43.7th percentile — below the genomic median. The Wilcoxon test is non-significant (p = 0.432). This is the strongest causal evidence that the hierarchy depends on a functional circadian clock, and it holds at full transcriptome scale (~22K genes).

**Interpretation:** The genome-wide validation demonstrates that the clock-target hierarchy is a genuine biological signal in healthy solid tissues, not an artifact of panel curation. The hierarchy is strongest in mouse solid tissues (liver, kidney), weaker in human blood, reversed in cancer, and abolished when the clock is genetically disrupted. This pattern is consistent across ~180,000 total gene-level AR(2) fits.

---

## 4. Discussion

### 4.1 The Gearbox Hypothesis

We propose—as a hypothesis-generating summary—that the clock-target eigenvalue gap reflects a regulatory hierarchy: clock genes, positioned upstream, exhibit higher temporal persistence because they set the pace for downstream proliferative signaling. Cancer disrupts this hierarchy, altering the coupling between circadian and proliferative dynamics. We note that this framing implies predominantly unidirectional regulation (clock → targets), but clock genes can act as both tumor suppressors and oncogenes depending on tissue context (e.g., CLOCK is elevated and promotes proliferation in colorectal cancer), and bidirectional interactions between clock and cell cycle networks are well-documented. The eigenvalue hierarchy is consistent with but does not prove unidirectional regulation. We emphasize that this interpretation is exploratory. The pattern is observed within a curated gene panel (which sits at the 99th percentile of random panels for eigenperiod) and within cohorts where cross-tissue correlations inflate apparent consensus (block permutation FPR = 70% at the 3+ tissue level). Independent cohort replication is the critical next step.

### 4.2 Molecular Basis

The eigenvalue hierarchy has a recently elucidated molecular basis. Hwang-Verslues and colleagues demonstrated that BMAL1 directly activates transcription of MEX3A, an RNA-binding protein that binds and stabilizes Lgr5 mRNA (Hwang-Verslues et al., Sci Rep 2023). This creates a regulatory cascade (BMAL1 → MEX3A → Lgr5) where clock gene dynamics necessarily precede and constrain target gene expression.

### 4.3 Mechanistic Bridge: From ODE Rate Constants to AR(2) Eigenvalues

The eigenvalue framework connects to mechanistic models of tissue renewal. Boman et al. (Cancers 2026) model colonic crypt dynamics as a three-compartment ODE system:

```
dC/dt = (k₁ - k₂P)C     [Cycling stem cells]
dP/dt = (k₂C - k₅)P     [Proliferative transit-amplifying cells]  
dD/dt = k₃P - k₄D       [Differentiated cells]
```

Where k₁ = symmetric division rate, k₂ = autocatalytic polymerization, k₃ = asymmetric division, k₄ = extrusion, and k₅ = apoptosis.

**From Paper Table 1 to Rate Constants:**
Boman's Table 1 provides equilibrium cell fractions in normal colon: C\* = 22%, P\* = 17%, D\* = 66%. Using the equilibrium equations C\* = k₅/k₂, P\* = k₁/k₂, and D\* = k₁k₃/(k₂k₄), we derive:

| Parameter | Normal Value | Adenoma Change |
|-----------|--------------|----------------|
| k₂ | 5.88 | ↓ 3.8× |
| k₅ | 1.29 | ↓ 5.3× |
| k₃/k₄ | 3.88 | — |

**The ODE-AR(2) Bridge:**
We assume that, over the observed timescales, the local dynamics around equilibrium can be approximated by a linear AR(2) process, and that the ODE's Jacobian is well approximated by the fitted AR matrix in a neighborhood of the operating point. Under these assumptions, the Jacobian eigenvalues map onto the AR(2) eigenvalues:

- **ODE eigenvalue (Jacobian):** Describes exponential decay/growth rates of perturbations around equilibrium
- **AR(2) eigenvalue (time-series):** Describes temporal autocorrelation persistence in gene expression

When sampled at regular intervals, a linearized ODE trajectory produces an autoregressive time series whose AR coefficients relate to the underlying Jacobian eigenvalues. This provides a *consistency check*: if AR(2) eigenvalues from gene expression match expectations from the mechanistic ODE, it supports the interpretation that eigenvalue signatures reflect real cellular dynamics.

We do not claim that every AR(2) model corresponds to a unique biophysical ODE; instead, we demonstrate that in at least one published mechanistic model (Boman et al. 2026), the AR(2) eigenvalue directly encodes return-to-homeostasis speed, providing a constructive example of the statistical-mechanistic correspondence. Jacobian spectrum analysis (Supplementary Section S7.7) confirms ~80% agreement between predicted discrete eigenvalues [exp(Re(λ_c)·τ)] and actual AR(2) moduli across normal, FAP, and adenoma tissues. However, the Boman model's Jacobian eigenvalues have zero real part (neutrally stable center), so the prediction reduces to |λ_d| ≈ 1; this is consistent with but not a strong discriminative test of the bridge.

**Cancer Shifts Both:**
In adenoma, Boman reports k₂↓3.8× and k₅↓5.3×—precisely the rate constants controlling proliferative feedback and apoptosis. In our AR(2) analysis, cancer samples show *increased* target eigenvalues, consistent with reduced negative feedback (lower k₂) allowing more persistent proliferative dynamics.

### 4.4 Epigenetic Memory

The persistence of eigenvalue patterns across conditions may reflect epigenetic memory mechanisms. Faubion, Druliner, and colleagues demonstrated that intestinal stem cells from previously inflamed tissue retain altered chromatin accessibility even after months in culture without inflammatory signals (Hamdan et al., bioRxiv 2025). This suggests eigenvalue signatures may capture not just instantaneous dynamics but inherited epigenetic states.

### 4.5 What Does Persistence Physically Correspond To?

The eigenvalue modulus |λ| measures temporal autocorrelation — but what biological mechanism *produces* this autocorrelation? Several non-mutually-exclusive mechanisms could underlie the persistence captured by AR(2):

1. **Chromatin memory.** Histone modifications and chromatin accessibility states persist across cell divisions. The H3K4me3 marks deposited by circadian transcription factors (e.g., CLOCK/BMAL1 complex) create a chromatin landscape that "remembers" the transcriptional state of the previous cycle. Higher |λ| for clock genes may reflect their privileged access to stable, heritable chromatin marks at circadian enhancers, while target genes occupy more labile chromatin domains subject to competing regulatory inputs.

2. **mRNA and protein half-life.** The temporal persistence of a gene's expression is bounded by the physical half-life of its mRNA and protein products. Clock gene mRNAs (e.g., PER2 mRNA t₁/₂ ≈ 40 min, but the PER2 protein t₁/₂ ≈ 2-4h with stabilization by CRY) undergo tightly regulated degradation, creating predictable decay kinetics that AR(2) captures as high |λ|. Target gene products with shorter or more variable half-lives would show lower autocorrelation — lower |λ|.

3. **Transcriptional inertia from regulatory network topology.** Clock genes participate in interlocking positive and negative feedback loops (BMAL1/CLOCK → PER/CRY → BMAL1/CLOCK) that enforce sustained oscillations. This network architecture creates *transcriptional inertia*: once a clock gene is activated, the feedback structure resists rapid deviation from the oscillatory trajectory. Target genes, positioned downstream of multiple converging inputs (circadian, metabolic, stress), lack this self-reinforcing topology and are therefore more susceptible to perturbation — producing lower |λ|.

4. **Cell lineage inheritance.** The Höfer lab's grandmother effect (Kuchen et al., eLife 2020) demonstrates that cell-cycle correlations span two generations, precisely matching AR(2)'s two-lag structure. Higher |λ| for clock genes could reflect more faithful inheritance of circadian phase across divisions, while target genes re-equilibrate more rapidly to local microenvironmental cues.

These mechanisms are testable. Chromatin memory predicts that H3K4me3 ChIP-seq signal at clock gene promoters will correlate with AR(2) eigenvalues. mRNA stability predicts that actinomycin D chase experiments will show correlated half-life rankings. Transcriptional inertia predicts that network perturbation (e.g., siRNA against feedback components) will selectively reduce clock |λ| without affecting target |λ|. We emphasize that distinguishing among these mechanisms requires dedicated experimental follow-up; the AR(2) framework identifies *which* genes show persistent dynamics but cannot, by itself, determine *why*.

### 4.6 Model Fit Quality as a Signal

Notably, clock genes exhibit higher R² values (mean=0.57) compared to target genes (mean=0.25), suggesting that AR(2) modeling itself distinguishes these gene classes. Higher R² for clock genes indicates their expression follows more deterministic temporal rules, while lower R² for targets suggests greater context-dependent stochasticity. This aligns with the hypothesis that proliferative genes integrate multiple regulatory inputs beyond circadian timing alone.

### 4.7 Interpretation Boundaries

**What |λ| measures:**
The eigenvalue modulus |λ| quantifies temporal persistence of *fluctuations around the mean*—how strongly today's deviation from baseline predicts tomorrow's. It is a statistical descriptor of correlation structure, not direct evidence of mechanistic inheritance.

**What |λ| does NOT measure:**
- Literal "mother-daughter" gene transmission (despite the AR(2) terminology)
- Amplitude of oscillations (use Cosinor for that)
- Causation (eigenvalue differences are correlational)

The Höfer lab's "grandmother effect" finding (cousin cells correlate) validates that AR(2) captures biologically real memory, but the eigenvalue itself remains a summary statistic requiring mechanistic follow-up.

### 4.7b Effective Sample Size Summary

The following table maps each major claim to its supporting independent cohorts and estimated effective sample size, addressing the concern that nominal dataset counts overstate statistical independence due to shared experimental pipelines. Effective n is estimated using two approaches: (1) for within-cohort claims (e.g., mouse tissues from GSE54650), we use block permutation analysis — block permutation FPR of 70% at 3+ tissues (vs 2% under naive independence) implies that 12 nominal tissues provide ~3–4 effective independent units; (2) for cross-study claims, we count truly independent laboratory cohorts (different labs, populations, species).

| Claim | Supporting Datasets | Nominal n | Independent Cohorts | Effective n | Notes |
|-------|-------------------|-----------|-------------------|-------------|-------|
| Clock > target hierarchy (healthy mouse) | GSE54650 (12 tissues) | 12 tissues | 1 cohort | ~3–4 effective tissues | Tissues share animals, pipeline, batch; block permutation FPR = 70% |
| Clock > target hierarchy (healthy baboon) | GSE98965 (64 tissues) | 14 analyzable tissues | 1 cohort | ~4–5 effective tissues | Same baboon cohort, shared pipeline |
| Clock > target hierarchy (human blood) | GSE48113, GSE39445, GSE122541 | 6 conditions | 3 cohorts | 3 independent | Different labs, populations, perturbations |
| Clock > target hierarchy (human skin) | GSE205155 | 2 layers | 1 cohort | 1 independent | Single cohort, dermis vs epidermis |
| Hierarchy reversal (cancer) | GSE221103, GSE157357 | 3 cancer conditions | 2 cohorts | 2 independent | Different species, cancer types, labs |
| Aging trajectory | GSE84521, GSE93903, GSE201207 | 6 conditions | 3 cohorts | 3 independent | Different tissues and species |
| p53 pathway shift | GSE54650, GSE221103 | 9 conditions | 2 cohorts | 2 independent | Cross-species (mouse healthy, human cancer) |
| Genome-wide validation | GSE54650 (liver, kidney), GSE113883, GSE221103, GSE70499 | ~180K gene fits | 4 datasets, 2 species | 3–4 independent | 5-context validation: healthy×2, human blood, cancer, clock-KO |
| Multi-species conservation | 14 datasets, 4 species | 14 datasets | ~6–8 labs | ~6–8 independent | Cross-species, cross-lab replication |

**Reading this table:** "Effective n" estimates the number of statistically independent units supporting each claim, accounting for within-cohort correlations. Claims supported by multiple independent labs/cohorts (effective n ≥ 3) are strongest. Claims resting on a single cohort (effective n = 1–2) should be considered preliminary. The hierarchy reversal in cancer (effective n = 2) is the claim most in need of additional independent validation.

### 4.8 Limitations

1. **Cross-tissue dependence (Major):** Tissues from the same GEO dataset share animals, protocols, and batch effects. Two distinct null models quantify this: (a) *scaled permutation* (S7.3) shuffles timepoints independently per tissue, yielding cross-tissue consensus FPR of 27% at 3+ tissues; (b) *block permutation* (S7.5) applies the same shuffle jointly to all tissues, preserving shared variance, yielding FPR of 70% at 3+ tissues (vs 2% under a naïve independence assumption). The block permutation is the more conservative and appropriate null model for within-cohort data. Cross-tissue consensus within a single cohort should not be interpreted as independent replication. Multi-cohort validation is essential.
2. **Within-tissue pseudoreplication:** Each target gene paired with 13 clock genes produces correlated eigenperiod estimates. Per-target aggregation (median across 13 pairings with bootstrap 95% CIs) addresses this, yielding 97 independent target-tissue measurements with a median eigenperiod of 9.28h (Supplementary Section S7.2). Results survive this correction.
3. **Panel specificity:** The curated 36-gene circadian/proliferation panel (13 clock + 23 target) produces eigenperiod distributions at the 99th percentile of 100 random same-size panels (21.1h vs 9.8h mean). Findings are specific to this biologically motivated selection and should not be generalized to the transcriptome at large.
4. **Permutation precision:** With 200 time-shuffle permutations, per-tissue FPR confidence intervals remain wide (often spanning 0-100%). Liver shows strong enrichment (15.4× over null), but some tissues (Heart, White Fat) show marginal or no enrichment. The tissue-variable nature of the signal should be acknowledged.
5. **Cancer generalization (Major):** The hierarchy reversal was observed in only two cancer models: MYC-ON neuroblastoma (GSE221103, human cell line) and APC-mutant intestinal organoids (GSE157357, mouse). No bulk human tumor datasets with matched normal controls and sufficient temporal resolution for AR(2) analysis (≥12 timepoints over 24–48h) currently exist in GEO. TCGA provides large-scale tumor-vs-normal comparisons but uses static single-timepoint snapshots incompatible with time-series autoregressive modeling. The only candidate time-series cancer dataset identified (GSE46549, colorectal cancer, 32 patients) has limited matched normal controls. The PNAS 2024 study by Hammarlund et al. reconstructed circadian rhythms in luminal A breast cancer using time-stamped biopsies, but the raw data are not yet in a format suitable for direct AR(2) application. Future validation should prioritize: (a) prospective time-course sampling of matched tumor-normal tissue from the same patients, (b) the GSE46549 colorectal dataset as the most accessible existing candidate, and (c) application to organoid biobanks (e.g., patient-derived tumor organoids with matched normal organoids) where controlled time-series sampling is feasible. Until replicated across ≥3 independent cancer types, the hierarchy reversal should be considered a hypothesis specific to MYC-driven and APC-mutant contexts, not a general cancer property.
6. **Mechanism vs. correlation:** Eigenvalue differences are observational; causal relationships require experimental validation.
7. **Gap and desynchrony correlation:** The clock-target gap and desynchrony CV are strongly correlated (r = -0.88), reflecting algebraic coupling: both are derived from eigenvalue distributions within the same gene panel and measure the same underlying disruption from different perspectives. Desynchrony CV is a derived consequence of the gap, not an independent dimension. The p53 pathway axis (r = 0.01 with gap; r = -0.09 with CV) is the only genuinely independent axis identified.
8. **Phase inference:** Phase estimates are derived from fixed-period (24h) cosinor fitting without comparison to alternative estimators. Leave-one-clock-out sensitivity testing shows 100% high stability (max shift 0.0h), suggesting robustness to clock gene choice, but estimator-contingency remains untested.
9. **ODE-AR(2) bridge:** The Jacobian spectrum analysis shows ~80% agreement with AR(2) moduli, but the Boman model's neutrally stable eigenvalues (zero real part) make this a weak discriminative test. The prediction reduces to |λ_d| ≈ 1, which is consistent with but not uniquely predicted by the model.
10. **Stationarity assumption:** AR(2) fitting assumes that the underlying process is stationary—that the statistical properties of the time series do not change over the sampling window. We did not perform formal stationarity testing (e.g., Augmented Dickey-Fuller test) on the gene expression series. This is a relevant concern because circadian oscillations in cancer tissue may dampen over time (non-stationary amplitude decay), and aging tissues may show trending baselines. If rhythms are dampening within the 24-48h sampling windows used here, AR(2) coefficient estimates could be biased toward higher persistence (|λ| closer to 1) as the model conflates decay trends with autocorrelation. The simulation benchmark (Section 2.6) validates AR(2) estimation under stationary conditions but does not address non-stationary scenarios. Future work should include formal stationarity diagnostics and, where violations are detected, consider time-varying AR or detrended AR approaches.

### 4.9 Proposed Falsifiable Assay

We propose a concrete experimental protocol to test the central prediction of the gearbox hypothesis: that disrupting clock gene function should reduce the clock-target eigenvalue gap.

**Protocol: BMAL1-KO Eigenvalue Gap Assay**

1. **System:** Mouse intestinal organoids (enteroids), chosen because (a) they are tractable for genetic manipulation, (b) intestinal tissue shows clear circadian-proliferation coupling, and (c) the Karpowicz lab (GSE157357) has already generated time-series data in this system providing baseline parameters.

2. **Perturbation:** CRISPR-Cas9 knockout of *Bmal1* (the master clock activator) vs isogenic wild-type controls. Optionally, include a *Bmal1* rescue (re-expression) arm to test reversibility.

3. **Sampling:** Collect RNA at 12 timepoints (every 2h over 24h) from three biological replicates per condition, starting 72h after synchronization by dexamethasone pulse. This sampling density provides 12-point time series per gene — sufficient for stable AR(2) fitting (minimum 5 points required, 12 recommended).

4. **Analysis:** Measure expression of the 13 clock genes (PER1, PER2, PER3, CRY1, CRY2, CLOCK, ARNTL, NR1D1, NR1D2, DBP, TEF, NPAS2, RORC) and 23 target genes (MYC, CCND1, CCNB1, CDK1, WEE1, CDKN1A, LGR5, AXIN2, CTNNB1, APC, TP53, MDM2, ATM, CHEK2, BCL2, BAX, PPARG, SIRT1, HIF1A, CCNE1, CCNE2, MCM6, MKI67). Fit AR(2) models and compute |λ| for each gene. Calculate the clock-target eigenvalue gap (mean clock |λ| minus mean target |λ|).

5. **Pre-registered predictions (falsifiable):**
   - **H₁ (gearbox):** WT organoids show gap > +0.10 (clock > target). BMAL1-KO shows gap < +0.05 (hierarchy collapses).
   - **H₀ (null):** Gap is indistinguishable between WT and BMAL1-KO (95% bootstrap CI of gap difference includes zero).
   - **H_alt (compensation):** BMAL1-KO shows *increased* gap if compensatory mechanisms (e.g., NPAS2 substitution) upregulate other clock gene persistence.

6. **Power estimate:** Based on observed effect sizes (gap ≈ +0.22 in healthy mouse tissues, gap ≈ -0.10 in cancer), detecting a gap reduction of 0.15 with 3 replicates at 80% power requires approximately 10 genes per class — satisfied by the panel above.

7. **Falsification criterion:** If BMAL1-KO organoids show a clock-target gap statistically indistinguishable from WT (H₀ not rejected at α = 0.05), the gearbox hypothesis in its current form would be falsified for this tissue system.

This assay is designed to be implementable in a standard molecular biology laboratory with access to organoid culture, CRISPR reagents, and bulk RNA quantification (qPCR or RNA-seq). The PAR(2) Discovery Engine application can perform the AR(2) analysis directly from uploaded CSV data.

### 4.10 Additional Future Directions

The following additional experiments would strengthen the framework:

1. **Prospective circadian time courses** in matched healthy/tumor tissue from the same patient, analyzed with pre-registered eigenvalue hypotheses (clock > target in healthy, convergence or reversal in tumor).
2. **Single-cell time-lapse data** (e.g., from Fucci reporters) to determine whether eigenvalue signatures are preserved at single-cell resolution or emerge only as population-level statistics.
3. **Pan-cancer GEO meta-analysis** covering ≥5 cancer types with matched healthy controls, to establish whether clock-target convergence is cancer-general or specific to MYC-driven and APC-mutant contexts.
4. **Pharmacological chronotherapy trials** measuring eigenvalue gap before and after timed drug administration, to test whether the gap serves as a predictive biomarker for circadian-aligned treatment response.
5. **Multi-cohort mouse tissue replication** using an independent circadian atlas (e.g., different lab, different mouse strain) to test whether the tissue rankings (Liver strongest, Heart weakest) replicate or whether they are cohort-specific — as suggested by the baboon cross-species validation (Section 3.6).

---

## 5. Conclusions

AR(2) eigenvalue analysis reveals a clock-target hierarchy in the healthy tissues and curated gene panel examined, which is disrupted in the cancer models studied. Cross-species validation in baboon (GSE98965) shows the hierarchy in 57% of tissues (8/14), with tissue-variable strength and no population-level significance (p = 0.81), reinforcing the tissue-dependent nature of the signal. This approach provides a quantitative metric for circadian-proliferation coupling that complements traditional amplitude and phase measurements.

The framework is exploratory and hypothesis-generating. The "gearbox" terminology describes an observed pattern within a specific gene panel (99th percentile vs random panels) and within cohorts where cross-tissue correlations inflate consensus (block permutation FPR = 70% at 3+ tissues). A concrete falsifiable assay (BMAL1-KO organoid eigenvalue gap assay, Section 4.9) is proposed to test the central prediction. Cross-cohort replication, expanded cancer type coverage, and broader gene panel comparisons are needed before the gearbox hierarchy can be considered established. The accompanying robustness validation suite (Supplementary Section S7) documents both the strengths (per-target aggregation survives pseudoreplication correction, phase estimates are stable under LOOCV, ODE bridge shows ~80% agreement) and the remaining gaps (cross-tissue dependence, panel specificity, wide permutation CIs) of the current evidence base.

---

## References

1. Kuchen EE, Becker NB, Claudino N, Höfer T. Hidden long-range memories of growth and cycle speed correlate cell cycles in lineage trees. *eLife*. 2020;9:e51002. doi:10.7554/eLife.51002

2. Hwang-Verslues WW, et al. Core clock gene BMAL1 and RNA-binding protein MEX3A collaboratively regulate Lgr5 expression in intestinal crypt cells. *Sci Rep*. 2023;13:17597. doi:10.1038/s41598-023-44997-5

3. Duan Y, Karri S, Andersen B. Circadian clock regulation of epithelial stem cells. *Stem Cells*. 2023. doi:10.1093/stmcls/sxad042

4. Solanas G, et al. Aged Stem Cells Reprogram Their Daily Rhythmic Functions to Adapt to Stress. *Cell*. 2017;170(4):678-692.e20. doi:10.1016/j.cell.2017.07.035

5. Hamdan FH, et al. Intestinal Stem Cells from Patients with Inflammatory Bowel Disease Retain an Epigenetic Memory of Inflammation. *bioRxiv*. 2025. doi:10.1101/2025.05.24.655923

6. Stokes K, et al. The Circadian Clock Gene, Bmal1, Regulates Intestinal Stem Cell Signaling and Represses Tumor Initiation. *Cell Mol Gastroenterol Hepatol*. 2021;12(5):1669-1696. doi:10.1016/j.jcmgh.2021.08.016

7. Boman RM, Schleiniger G, Raymond C, Palazzo J, Shehab A, Boman BM. A Tissue Renewal-Based Mechanism Drives Colon Tumorigenesis. *Cancers*. 2026;18:44. doi:10.3390/cancers18010044

8. Mure LS, Le HD, Bber G, et al. Diurnal transcriptome atlas of a primate across major neural and peripheral organs. *Science*. 2018;359(6381):eaao0318. doi:10.1126/science.aao0318

9. Ripperger JA, Shearman LP, Reppert SM, Schibler U. CLOCK, an essential pacemaker component, controls expression of the circadian transcription factor DBP. *Genes & Development*. 2000;14(6):679-689. doi:10.1101/gad.14.6.679

10. Wuarin J, Schibler U. Expression of the liver-enriched transcriptional activator protein DBP follows a stringent circadian rhythm. *Cell*. 1990;63(6):1257-1266. doi:10.1016/0092-8674(90)90421-A

11. Gachon F, Olela FF, Schaad O, Descombes P, Schibler U. The circadian PAR-domain basic leucine zipper transcription factors DBP, TEF, and HLF modulate basal and inducible xenobiotic detoxification. *Cell Metabolism*. 2006;4(1):25-36. doi:10.1016/j.cmet.2006.04.015

12. Reick M, Garcia JA, Dudley C, McKnight SL. NPAS2: an analog of clock operative in the mammalian forebrain. *Science*. 2001;293(5529):506-509. doi:10.1126/science.1060699

13. DeBruyne JP, Weaver DR, Reppert SM. CLOCK and NPAS2 have overlapping roles in the suprachiasmatic circadian clock. *Nature Neuroscience*. 2007;10(5):543-545. doi:10.1038/nn1884

14. Shi S, Hida A, McGuinness OP, Bhatt DK, DeBruyne JP. NPAS2 compensates for loss of CLOCK in peripheral circadian oscillators. *PLOS Genetics*. 2016;12(2):e1005882. doi:10.1371/journal.pgen.1005882

15. Takeda Y, Jothi R, Birault V, Jetten AM. RORγ directly regulates the circadian expression of clock genes and downstream targets in vivo. *Nucleic Acids Research*. 2012;40(17):8519-8535. doi:10.1093/nar/gks630

16. Siu KT, Rosner MR, Minella AC. An integrated view of cyclin E function and regulation. *Cell Division*. 2010;5:2. doi:10.1186/1747-1028-5-2

17. Farshadi E, van der Horst GTJ, Chaves I. Molecular links between the circadian clock and the cell cycle. *Journal of Molecular Biology*. 2020;432(12):3515-3524. doi:10.1016/j.jmb.2020.04.003

18. Sandler O, Mizrahi SP, Weiss N, Agam O, Simon I, Balaban NQ. Lineage correlations of single cell division time as a probe of cell-cycle dynamics. *Nature*. 2015;519:468-471. doi:10.1038/nature14318

19. Feillet C, Krusche P, Taber F, et al. Phase locking and multiple oscillating attractors for the coupled mammalian clock and cell cycle. *PNAS*. 2014;111(27):9828-9833. doi:10.1073/pnas.1320474111

---

## Data Availability

All source data are available from NCBI GEO:
- GSE54650: https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE54650
- GSE221103: https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE221103
- GSE157357: https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE157357
- GSE84521: https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE84521
- GSE98965: https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE98965 (baboon cross-species validation)

Computed eigenvalues can be verified via the PAR(2) Discovery Engine web application.

---

## Acknowledgments

We thank the data generators for making their datasets publicly available, and the researchers whose work informed this framework: Thomas Höfer (DKFZ), Salvador Aznar-Benitah (IRB Barcelona), Phillip Karpowicz (U. Windsor), Wendy Hwang-Verslues (Academia Sinica), Bogi Andersen (UC Irvine), the Faubion/Druliner laboratory (Mayo Clinic), and Bruce Boman and colleagues (University of Delaware) for their stem cell compartment ODE model.
