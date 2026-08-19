import { Router } from "express";
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, PageBreak, TableOfContents, StyleLevel,
  LevelFormat, convertInchesToTwip, BorderStyle, ShadingType,
  ExternalHyperlink,
} from "docx";
import { EXTENDED_CHAPTERS } from "../../shared/book-extended-chapters";
import { CONCISE_CHAPTER3_CONTENT, CONCISE_CHAPTER3_DOCX_FIGURE, CONCISE_APPENDIX_C_CONTENT } from "../../shared/book-chapters-core";

export const bookRouter = Router();


const CHAPTERS = [
  {
    number: "Preface",
    title: "On Finding the Second Number",
    content: `I did not set out to write about Fibonacci sequences. I set out to understand why intestinal crypts don't fail — why the gut lining, replacing itself at 10 billion cells per day, maintains almost exactly constant cell-type proportions across decades of a human life. The standard answer was the Wnt gradient. It didn't explain the temporal stability.

What if the timing was the key? Not just the spatial gradient, but the autocorrelative structure of gene expression dynamics — whether a gene's current expression level is a reliable predictor of its next level? That question led to AR(2) autoregression.

The first result was the eigenvalue for Bmal1 in mouse intestinal organoids: characteristic roots 0.623 ± 0.551j, eigenvalue modulus |λ| = 0.832. The real part of the root — 0.623 — sat near the golden ratio reciprocal 1/φ ≈ 0.618. Two weeks later, fitting the same model to liver clock genes from an independent dataset, clock gene medians clustered near 0.647. Then kidney. Then heart. Then baboon. At that point I looked up what 0.618 is. It is 1/φ — the reciprocal of the golden ratio. What follows is what happened next.`,
  },
  {
    number: "Prologue",
    title: "The Clock That Was Only Half Described",
    content: `For more than three decades, circadian biology operated under a powerful and productive simplification: the clock is a transcriptional feedback loop. BMAL1 and CLOCK proteins bind E-box enhancers, drive expression of CRY and PER, which accumulate overnight, repress their own activators, and then degrade at dawn — resetting the cycle. The elegance of this molecular description earned its discoverers the 2017 Nobel Prize in Physiology or Medicine, and rightfully so.

But the Nobel story, compelling as it is, describes the mechanism without fully answering the question that matters most for biology and medicine: how much does the clock actually control the rest of the genome? Not qualitatively — "it oscillates" — but quantitatively: how strongly, and how persistently?

The dominant computational tools in chronobiology — JTK_CYCLE, cosinor regression, RAIN — were designed to answer a specific, well-posed binary question: does this gene oscillate significantly with a 24-hour period? They are exquisitely sensitive to that objective, and the decades of discovery they enabled made this next step possible. But by design, they are purpose-built for detection, not quantification. A gene with a fragile, easily disrupted rhythm and one whose oscillation is deeply embedded across multiple regulatory pathways will receive comparable scores. These are meaningfully different biological realities, and the existing toolkit was never intended to distinguish between them.

We are only able to see this second dimension of clock control because the last three decades of research mapped the first — the molecular mechanism — so thoroughly. This book describes what the data reveal when a quantitative lens is added alongside the qualitative one. That lens turned out to be the eigenvalue of a second-order autoregressive process. What follows is how the idea was developed, stress-tested, and ultimately found to hold across species, tissues, diseases, and time scales that none of the original analyses were designed to address.`,
  },
  {
    number: "Chapter 1",
    title: "A Different Question",
    content: `The shift in framing was the hardest part. Chronobiology already had excellent answers to the question it was asking. What was needed was a complementary question — one that extended beyond binary detection toward continuous quantification of clock control strength.

The distinction becomes clear with a thought experiment. Imagine two genes, both showing a statistically significant 24-hour rhythm in a liver time-series dataset. Gene A: its rhythm is detectable but fragile — remove BMAL1, and within two cycles, the oscillation collapses entirely. Gene B: its rhythm persists for days after the clock is perturbed, decaying only slowly, because the regulatory constraints maintaining it are distributed across multiple pathways. Detection-based tools, designed for a different purpose, are not equipped to separate these cases. Yet intuitively, and biologically, they represent very different relationships to the clock.

What distinguishes them is temporal persistence — the degree to which the past state of the gene's expression constrains its future state. A highly persistent gene cannot easily escape its trajectory; it has strong regulatory memory. A weakly persistent gene is largely memoryless — its current state tells you little about where it will be tomorrow.

The mathematical language for this is the autoregressive model. If you model a gene's expression trajectory as an AR(2) process — where the current value depends on the previous two time points — the characteristic roots of that system are complex numbers whose modulus captures exactly what we want. An eigenvalue modulus |λ| near 1 means the system has long temporal memory: perturbations decay slowly, the trajectory is strongly self-referential. An |λ| near 0 means rapid forgetting: each observation is nearly independent of its predecessors.

The core hypothesis was therefore testable and specific: clock genes should have systematically higher |λ| than their downstream targets, which in turn should have higher |λ| than background genes with no special relationship to circadian timing. If that hierarchy held across species and tissues, the eigenvalue was measuring something real.

KEY FINDING — Figure 1.1: The Three-Tier Eigenvalue Hierarchy
Clock Genes:   |λ| = 0.65  (n = 8 core genes)
Target Genes:  |λ| = 0.53  (n = 4,218 genes)
Background:    |λ| = 0.41  (n = 16,482 genes)
Gap of 0.12 units between each tier · holds across 22 datasets, 4 species`,
  },
  {
    number: "Chapter 2",
    title: "The Mathematics of Memory",
    content: `The AR(2) model is among the simplest non-trivial time-series structures. For a gene with expression y(t) at time t, the model is: y(t) = φ₁·y(t−1) + φ₂·y(t−2) + ε(t), where φ₁ and φ₂ are the autoregressive coefficients and ε(t) is white noise. The characteristic equation is z² − φ₁z − φ₂ = 0, whose two roots λ₁ and λ₂ encode the entire dynamic personality of the process.

When the discriminant φ₁² + 4φ₂ < 0, the roots are complex conjugates — the gene oscillates. The oscillation frequency is determined by the argument of the complex root: ω = arctan(Im(λ)/Re(λ)). The decay rate — and therefore the persistence — is determined by the modulus |λ| = √(Re(λ)² + Im(λ)²). For a 24-hour rhythm sampled at 2-hour intervals, 12 time points complete one cycle, and a |λ| of 0.65 means the amplitude halves in roughly 3.2 hours — about 1.6 sampling intervals. A perturbation to a clock gene's trajectory with |λ| = 0.65 would decay to half its magnitude within two time points in the absence of clock-circuit driving.

The geometry of this becomes intuitive when plotted in the complex plane. Each gene's characteristic root is a point inside (stable) or outside (unstable) the unit disk. The radial distance from the origin is |λ|. Clock genes cluster at higher radii than targets — not randomly, but in a structured, reproducible way that reflects genuine biological hierarchy.

The stability triangle — the region of (φ₁, φ₂) parameter space where both roots are inside the unit disk — has three qualitatively distinct regimes: real positive roots (overdamped, monotone decay), real negative roots (alternating decay), and complex conjugate roots (oscillatory). Biological circadian genes fall almost exclusively in the complex oscillatory regime, confirming that we are measuring the right class of dynamics.

Fitting the AR(2) model to short time series (typically 12–48 points in circadian experiments) requires careful handling. The maximum likelihood estimator for φ₁ and φ₂ is biased for small samples, and standard errors must account for the autocorrelation structure. A battery of diagnostic checks — Ljung-Box residual tests, stationarity verification, Cramer's rule validation of coefficient estimates — was developed and applied to every gene in every dataset before any downstream analysis was performed.

FIGURE 2.1 — Root-Space Geometry (Unit Disk):
Each gene plots as a point in the complex eigenvalue plane.
Stable oscillators (|λ| < 1) lie inside the unit disk.
Clock genes cluster at radii ~0.62–0.68.
Target genes cluster at radii ~0.48–0.57.
The radial distance from origin = eigenvalue modulus = temporal persistence.`,
  },
  {
    number: "Chapter 3",
    title: "The Discovery",
    content: `${CONCISE_CHAPTER3_CONTENT}

${CONCISE_CHAPTER3_DOCX_FIGURE}`,
  },
  {
    number: "Chapter 4",
    title: "Is It Real or Noise?",
    content: `Every finding in computational biology must survive a sustained attempt at its own destruction. A hierarchy this clean, appearing across 22 independent datasets, inevitably raises the question: what confound could produce this pattern?

Transcript half-life: the correlation between |λ| and mRNA half-life across 23,118 genes was ρ = 0.012 (p = 0.31). The signal is orthogonal to stability. Expression level: the correlation between mean expression and |λ| was ρ = 0.08 — negligible. Sampling resolution: testing with synthetic data at 1h, 2h, and 4h intervals showed |λ| estimates were stable across all resolutions.

The gap-classifier analysis asked a pointed question: could a classifier trained on |λ| alone predict clock gene identity? Across a held-out test set, AUC values were: clock vs. background = 0.81, target vs. background = 0.69, clock vs. target = 0.74. All three are well above chance but well below perfect — exactly the expected profile for a genuine but noisy biological signal. False negatives clustered in tissue-restricted targets, confirming tissue-specificity.

Rolling-window analysis: computing |λ| in consecutive 12-point windows across the 48h series, the clock/target gap remained stable across every window — the signal is not driven by a single outlier time segment.

Stationarity testing with augmented Dickey-Fuller confirmed that greater than 94% of clock-classified genes met strict stationarity criteria, validating the AR(2) model assumption.

Eigenvalue independence: |λ| shows no significant correlation with gene centrality in protein interaction networks (ρ = 0.04), chromatin accessibility (ρ = 0.07), or GC content (ρ = 0.03). The eigenvalue hierarchy is not a proxy for any known confounding biological variable.`,
  },
  {
    number: "Chapter 5",
    title: "Cancer Breaks the Clock",
    content: `If eigenvalue modulus measures how deeply a gene is embedded in the circadian architecture, cancer — which systematically disrupts circadian output — should reduce it. Paper E tested this across colorectal organoids, TCGA tumour data, and glioblastoma.

The organoid experiment used GSE157357, a four-condition dataset comparing wildtype, BMAL1-knockout, APC-knockout, and double-knockout intestinal organoids. APC-knockout — modelling the most common initiating mutation in colorectal cancer — produced a distinctive eigenvalue signature: the clock/target gap collapsed almost entirely. Double-knockout showed partial recovery — a "tug-of-war equilibrium" phenotype not predicted in advance.

Phase-gating analysis quantified the temporal relationship between clock genes and their targets across 28,138 gene pairs. In healthy tissue, targets are phase-locked to clocks within a consistent window; in APC-KO, this phase coherence degrades measurably.

The disease phase diagram traces a clear trajectory from Healthy (clock/target τ_c ratio: 2.19×) through APC-KO (0.43×) corresponding to loss of circadian gating.

In TCGA colorectal validation, 10 of 15 genes (7 clock, 8 target) showed concordant directional change between ApcKO organoid eigenvalue shifts and human CRC tumour expression (p = 0.151 vs. 50% null; not significant — a directionally consistent preliminary finding). A post-hoc exploratory sub-analysis of the 8 canonical CRC target genes showed 7/8 concordance (p = 0.035, nominal, unadjusted, non-confirmatory).

The GBM immune clock result: NK cell circadian rhythm in glioblastoma is not merely attenuated but appears non-existent — a confirmed true negative showing the platform can distinguish absent clocks from disrupted ones.

FIGURE 5.1 — Phase-Gating: clock genes (|λ|=0.65) set the temporal reference frame. Targets (|λ|=0.53) are phase-locked within a clock-permissive window. Background genes (|λ|=0.41) show unconstrained oscillation. In cancer, this phase-locking is disrupted.`,
  },
  {
    number: "Chapter 6",
    title: "The Drug Question",
    content: `If eigenvalue modulus is to be useful for chronotherapy — optimising drug administration timing based on circadian control of target gene expression — one potential confound looms large: drug targets tend to have long-lived proteins. If the eigenvalue were tracking protein half-life rather than circadian architecture, the clinical application would be compromised.

Paper F addressed this directly. Using published mRNA half-life measurements for 23,118 genes from metabolic labelling experiments in mouse liver, the Spearman correlation between |λ| and half-life was ρ = 0.012, p = 0.31 — not merely non-significant but essentially zero in effect size.

The analysis was extended to protein half-life data for ~6,400 genes with proteomics measurements. Correlation: ρ = 0.021. Drug targets showed no elevation in half-life relative to their |λ| values compared with non-target genes. The eigenvalue signal is orthogonal to thermodynamic stability.

Before/after comparisons in drug perturbation experiments confirmed the biological interpretation. Chronotherapy candidates — genes with high |λ|, clock-gated phase relationships, and annotated therapeutic relevance — showed predictable eigenvalue shifts after pharmacological clock disruption, confirming that the signal changes when circadian architecture changes.

FIGURE 6.1 — Half-Life Scatter: 23,118 genes plotted as mRNA half-life (x-axis) vs |λ| (y-axis). The regression line is essentially flat (ρ = 0.012, p = 0.31, shown in red). The eigenvalue measures temporal embeddedness, not mRNA stability.`,
  },
  {
    number: "Chapter 7",
    title: "Fibonacci in the Gut",
    content: `Paper G is a reply to a two-paper framework by Bruce M. Boman and colleagues.

The 2017 paper (The Fibonacci Quarterly, Vol. 55, No. 5) established the mathematical foundation: a model of asymmetric cell division where each dividing cell produces one mature daughter (continues dividing) and one immature daughter (maturation delay c). When c = 2, population counts follow Fibonacci numbers and the steady-state mature/immature ratio satisfies q² = 1 − q, giving q ≈ 0.618 = 1/φ.

The 2025 paper (Biology of the Cell, 117:e70017. DOI: 10.1111/boc.70017) extended this into a five-rule tissue code governing the dynamic organisation of colonic epithelium. The five rules are: Rule 1 — timing of cell division (fixed cell cycle duration); Rule 2 — temporal order (M cells divide every cycle, I cells only after maturation period c); Rule 3 — spatial direction (division angle rotates by a fixed increment each cycle, a function of c, inherited by each daughter cell); Rule 4 — number of cell divisions (limited by whole-maturation time nwm, a function of generation g); Rule 5 — cell lifespan L (birth to death). Agent-based and continuous ODE simulations driven by these rules produce emergent geometric structures reproducing human colonic crypt organisation, including Fibonacci cell counts per branch.

The connection to PAR(2) was noticed algebraically. Each of Boman's five biological rules generates an independent constraint on (φ₁, φ₂) space — and all five converge on the zone where |λ| ≈ 1/φ ≈ 0.618. This is an algebraic consequence of the tissue code applied to a dynamical systems framework Boman did not use.

The Floquet connection is mathematical: at Boman's q parameter values, the monodromy matrix of the crypt ODE system has a dominant multiplier of ≈ 0.618 — the same as the stable twin of the Fibonacci characteristic root. The biological mechanism that would produce this correspondence remains hypothetical; the mathematical identity is clear, but whether it reflects a mechanistic constraint or an algebraic coincidence is the central open question of Paper G.

As a proof-of-concept, AR(2) was fitted to seven crypt-relevant genes from the GSE157357 WT organoid dataset (z-scored log-expression, CT24 to CT46, 12 timepoints). All seven yield stable roots (|r| < 1). Three fall within 0.05 of the 1/phi = 0.618 reference:

Gene     | Role                        | Roots              | Max|r|
---------|-----------------------------|--------------------|--------
Lgr5     | Stem cell marker            | 0.350 +/- 0.108j   | 0.366
Arntl    | Core clock (Bmal1)          | 0.623 +/- 0.551j   | 0.832(*)
Per2     | Clock output                | 0.442, 0.305       | 0.442
Axin2    | Wnt readout                 | 0.188 +/- 0.594j   | 0.623 [near 1/phi]
Nr1d1    | Rev-erbalpha (TTFL)         | 0.509 +/- 0.432j   | 0.668 [near 1/phi]
Nr1d2    | Rev-erbbeta (TTFL)          | 0.654, 0.034       | 0.654 [near 1/phi]
Hes1     | Notch effector, crypt base  | 0.592, -0.072      | 0.593 [near 1/phi]

(*) Arntl: |λ| = 0.832 from the quantile-normalised WT data. The value 0.063 that appeared in the originally submitted Table 1 was a data-indexing error in that analysis; 0.832 is the correct platform value.

The pattern is biologically coherent: the core clock driver (Arntl, |r| = 0.832) shows strong temporal persistence, consistent with its role as the oscillator that must sustain rhythm across many renewal cycles. The Wnt readout (Axin2) and the Notch/TTFL junction genes (Hes1, Nr1d2) cluster near the Fibonacci stability boundary — consistent with Boman's five rules constraining the renewal system toward that region. No covariance-stationary series can sit at the exact Fibonacci point (1,1) — it lies outside the stationarity triangle.

FIGURE 7.1 — Boman's Five Rules (Biol. Cell 2025) → PAR(2) Constraints:
Rule 1: Timing (fixed cell cycle)      →  AR(2) time unit; ω = 2π/24
Rule 2: Temporal order (M÷cycle, I÷c)  →  q²=1−q for c=2 → |λ|≈0.618
Rule 3: Spatial direction (rotation∝c) →  Complex-conjugate eigenvalues (structural; not a gradient correlation)
Rule 4: No. of divisions (nwm, gen g)  →  |λ|<1 stability ceiling; nwm = memory cap (empirically: 4/6 cell types)
Rule 5: Cell lifespan (L)              →  Short-order AR, finite memory (empirically: 3/6 cell types; see note below)
All five converge on |λ| ≈ 0.618 = 1/φ

Empirical refinement (Rule 3 & 4 Validation): Computational testing using live AR(2) eigenvalues from GSE179027 (mouse intestinal enteroid, 48 timepoints) across six intestinal cell types (stem, TA, enterocyte, goblet, tuft, EEC). Rule 3 spatial zone vs |λ| — Spearman r=−0.272, p=0.247, correctly non-significant (the mapping is categorical, not a gradient claim). Rule 4 division count vs |λ| — correctly ranks 4/6 cell types; the single failure is Enterocyte, whose high mean |λ| (0.887) is driven by FABP1 at 5,367 TPM, a structural abundance confound rather than a biological counterexample. Rule 5 lifespan vs |λ| — correctly ranks 3/6 cell types; EEC and Tuft (longest-lived) yield the lowest measured eigenvalues, but both are below the reliable expression threshold in bulk RNA-seq (DCLK1 at 1.07 TPM is essentially unmeasured). The conclusion: neither Rule 4 nor Rule 5 cleanly predicts |λ| with current bulk RNA-seq data. Expression stability (marker gene abundance) is a dominant confound. Proper testing of the lifespan and division hypotheses requires single-cell or enriched time-series data for rare secretory cell types, which are not yet available in GEO for this system.`,
  },
  {
    number: "Chapter 8",
    title: "From Brain to Periphery",
    content: `The mammalian circadian system is hierarchically organised. The suprachiasmatic nucleus (SCN) receives direct photic input and serves as the master pacemaker. It entrains peripheral clocks — in liver, lung, skin, heart, and other organs — through hormonal signals, autonomic innervation, and feeding cues. But the quantitative relationship between centrality in this hierarchy and eigenvalue modulus had never been measured.

Paper Q applied AR(2) eigenvalue analysis to 16 core clock genes across 12 mouse tissues from the Zhang et al. multi-tissue atlas (GSE54650). The result was a monotone increase from hypothalamus to lung: hypothalamus |λ| = 0.469 (τ_c = 2.6 h), lung |λ| = 0.797 (τ_c = 8.8 h). All three central nervous system tissues ranked below all nine peripheral tissues. The 3.33-fold lung–hypothalamus τ_c ratio (8.8 h / 2.6 h) provides a quantitative basis for the well-documented 7–14 day peripheral re-entrainment lag observed after transmeridian travel.

Cross-species replication in baboon (Mure et al. GSE98965) confirmed the gradient with directly isolated SCN tissue: baboon SCN |λ| = 0.471 (16 clock genes, raw FPKM), indistinguishable from mouse hypothalamus (Δ = 0.002), and baboon lung τ_c / SCN τ_c = 1.53× (lung |λ| = 0.611, 14 stable clock genes; PER3 and NR1D2 were unstable in this tissue and excluded) — directionally consistent with the mouse ratio, attenuated relative to mouse after accounting for the smaller baboon sample size (n = 12 versus n = 24 time points) and the two excluded lung genes.

The interpretation is counterintuitive at first glance: why would the master pacemaker — the most important circadian tissue — have the lowest eigenvalue? The SCN must be maximally entrained by external light: it needs to respond to environmental input, not resist it. A high |λ| would make it resistant to re-entrainment after seasonal changes or transmeridian travel. Peripheral tissues, conversely, must resist transient noise in humoral signals to maintain their temporal programme. High |λ| in the periphery is a design feature, not a failure.

The retinal analysis added an unplanned finding: OPN4 (melanopsin), the primary phototransduction gene for non-image forming light responses, showed the lowest |λ| values in the retina — lower even than the SCN. Consistent with its function as a light-responsive reset switch rather than a persistent oscillator.

FIGURE 8.1 — Central-to-Peripheral Eigenvalue Gradient (GSE54650, 16 clock genes):
Hypothalamus: |λ| = 0.4691  τ_c = 2.6 h  ← Fastest reset (CNS)
Cerebellum:   |λ| = 0.5501  τ_c = 3.3 h
Brainstem:    |λ| = 0.5964  τ_c = 3.9 h
Skeletal Muscle: |λ| = 0.6219  τ_c = 4.2 h
Liver:        |λ| = 0.6413  τ_c = 4.5 h
Aorta:        |λ| = 0.6535  τ_c = 4.7 h
Brown Adipose:|λ| = 0.6627  τ_c = 4.9 h
White Adipose:|λ| = 0.6655  τ_c = 4.9 h
Adrenal Gland:|λ| = 0.6821  τ_c = 5.2 h  (neuroendocrine)
Heart:        |λ| = 0.6978  τ_c = 5.6 h
Kidney:       |λ| = 0.7377  τ_c = 6.6 h
Lung:         |λ| = 0.7966  τ_c = 8.8 h  ← Slowest reset (peripheral)
τ_c ratio lung/hypothalamus: 3.33× (mouse); baboon lung/SCN: 1.53× (14 stable genes)`,
  },
  {
    number: "Chapter 9",
    title: "What This Changes",
    content: `The eigenvalue hierarchy is a measurement, not a therapy. But it points towards applications that were not visible from any previous vantage point in chronobiology.

Chronotherapy — adjusting drug dosing time to the circadian phase of the target — has been studied empirically for decades, with frustrating variability in results. The problem is that circadian phase varies between individuals, tissues, and health states in ways that are hard to measure non-invasively. The eigenvalue offers a partial solution: genes with high |λ| maintain their phase relationships more robustly. A drug target with |λ| = 0.79 is a better candidate for chronotherapy than one with |λ| = 0.43, because the high-|λ| target's phase can be predicted more reliably from an accessible proxy tissue. This is a prediction that can be tested prospectively.

The evolutionary gene age analysis revealed an unexpected gradient: genes with greater evolutionary age showed systematically higher |λ|. Ancient, conserved genes are more deeply embedded in temporal architecture. This gradient was steeper for clock targets than background genes, suggesting circadian integration has been a conserved selective pressure throughout eukaryotic evolution.

The Turing deep dive asks whether the spatial patterns formed by reaction-diffusion systems and the temporal patterns maintained by AR(2) processes share a common mathematical substrate. Preliminary bifurcation analysis suggests the parameter zone where AR(2) processes show maximal persistence (|λ| ≈ 0.618–0.72) corresponds to where reaction-diffusion systems transition from pattern-forming to pattern-suppressing dynamics. If real rather than coincidental, it would suggest biological systems operating near the golden ratio are exploiting a deep mathematical property of self-organisation at the edge of instability.

None of these downstream findings were planned at the outset. The platform was built to test one hypothesis about one number. The number has held up. What it is measuring — and what it will reveal as more datasets, diseases, and perturbations are fed through it — remains genuinely open.`,
  },
  {
    number: "Chapter 10",
    title: "The Immune Clock",
    content: `The innate immune system is profoundly circadian. Macrophage phagocytic capacity, neutrophil recruitment, sepsis susceptibility, and vaccine immunogenicity all vary by time of day — effects traceable to direct CLOCK:BMAL1 regulation of Tlr9, Nlrp3, and the NF-κB pathway. Yet whether this temporal control is implemented through a stable eigenvalue architecture — a clock gating low-persistence effectors, as in the intestine and brain — had never been measured.

Application of AR(2) to a mouse peritoneal macrophage circadian dataset (GSE25585; 22,105 probes, 12 timepoints at 4h intervals over 48h) reveals the expected hierarchy — but with a structural asymmetry not visible in metabolic tissues. After excluding unstable genes, 20,771 genes remain; the genome median is |λ| = 0.558 (∆t = 4h). Clock genes as a panel (16 genes, mean |λ| = 0.762, median |λ| = 0.882) sit 0.204 above the genome background (permutation p < 0.0001). The clock-versus-background gap is intact. But within the clock gene panel, the two arms of the transcription-translation feedback loop (TTFL) are not equal.

The negative-arm repressors — PER1-3, CRY1-2, NR1D1-2 (REV-ERBα/β) — carry mean |λ| = 0.889 (bootstrap 95% CI [0.84, 0.93]), all ranked in the top 15% of the genome. The PAR bZip output factors DBP, TEF, HLF follow at mean |λ| = 0.838. The positive-arm activators — CLOCK, ARNTL/BMAL1, RORα/β/γ — show mean |λ| = 0.576 (CI [0.37, 0.76]), statistically indistinguishable from genome background. The negative arm is 1.55× the positive arm; the gap of 0.313 (CI [0.12, 0.53]) is confirmed by permutation (arm-label shuffle p = 0.004), expression-matched null (p = 0.006), and time-shuffle destruction (p = 0.001).

The highest-ranked clock gene is NR1D1 (REV-ERBα): rank #66 of 20,771 genes, |λ| = 0.978, oscillation period 22.1h — the most persistently expressed gene in the entire macrophage circadian transcriptome by a substantial margin. CLOCK sits at rank #14,707 (|λ| = 0.436), and RORα at rank #20,446 (|λ| = 0.144, bottom 1.5% of all genes). The activating limb in peritoneal macrophages carries essentially no dynamic regulatory memory. The repressive limb carries almost all of it.

This asymmetry is biologically coherent. REV-ERBα directly gates inflammatory gene programmes: its continuous suppressive load on NF-κB target genes requires sustained, self-reinforcing expression dynamics. CLOCK and BMAL1 in macrophages may function more as permissive scaffolds than as dynamic drivers — their persistence near genome background is consistent with a tissue where the negative arm carries the regulatory burden. The clock-controlled target gene panel (23 genes, mean |λ| = 0.621) sits above genome background and below clock genes, preserving the expected ordering. Among targets, CDC25C and MCM2 show clock-level persistence, consistent with circadian control of DNA replication licensing; MYC shows near-zero persistence (|λ| = 0.206), consistent with its role as a rapid-response factor rather than a sustained regulatory programme.`,
  },
  {
    number: "Chapter 11",
    title: "The Protein Level",
    content: `A persistent question in circadian biology is whether transcript-level rhythms are faithfully translated to protein. Fewer than half of rhythmically expressed proteins are encoded by rhythmic mRNAs; post-translational dynamics can impose or erase temporal structure independently of transcription. The Fibonacci-proximate eigenvalue signal in mRNA data — if it is a genuine biological property — should survive translation and post-translational processing to appear at the protein level.

Circadian nuclear proteomics of mouse liver (Wang et al., 2018) across 28 clock gene–target protein pairings gives mean |λ| = 0.594 and mean Fibonacci proximity = 86.2%. All 28 pairs are Fibonacci-like or Near-Fibonacci. Protein-level FP values (mean 86.2%) are significantly higher than matched mRNA FP values from the same tissue (mean 64.6%; exact two-sample KS test D = 0.857, p = 0.008), consistent with post-translational stabilisation amplifying Fibonacci-proximate dynamics rather than attenuating them. The signal is not an artefact of transcript kinetics.

WEE1, the primary G2/M cell-cycle gate, is Fibonacci-like at the protein level (FP = 88.5%, |λ| = 0.689) — consistent across all four clock-gene predictors and with an eigenperiod of 12.6 hours, suggesting twice-daily gating. YAP1, the Hippo effector implicated in crypt cancer initiation, shows Near-Fibonacci protein dynamics (FP = 79.8%, |λ| = 0.493), consistent with its role as a conditionally sustained growth integrator. The PAR(2) temporal hierarchy is a post-translational reality.`,
  },
  {
    number: "Chapter 12",
    title: "The Metabolic Clock",
    content: `Circadian clocks regulate glucose homeostasis at every level — β-cell insulin secretion, hepatic glucose production, peripheral insulin sensitivity. Clock gene polymorphisms in ARNTL, CLOCK, and CRY2 are associated with T2DM risk in GWAS; circadian misalignment substantially worsens metabolic outcomes. Yet continuous glucose monitor data — now routinely collected in clinical diabetes management — have never been analysed for temporal persistence structure.

AR(2) eigenvalue analysis of CGM time-series from the Shanghai T2DM dataset (Zhao et al. 2023; n = 10 participants spanning the glycaemic spectrum, multi-day 5-minute recordings) reveals exploratory, directionally consistent associations between Fibonacci proximity and glycaemic control status; subgroups show substantial overlap and heterogeneity. The pre-diabetic participant shows |λ| = 0.831 and FP = 92.8% — Fibonacci-like, comparable to the healthiest peripheral tissue clock genes. Well-controlled T2DM shows a bimodal distribution: one subgroup remains Fibonacci-like (FP = 92.5%); the other has already departed (FP = 47.7%). Uncontrolled T2DM ranges from 19.6% to 67.6%.

The gradient is not simply tracking mean glucose level. Two participants with similar mean glucose (~141–148 mg/dL) show a three-fold difference in Fibonacci proximity, suggesting that standard HbA1c and time-in-range metrics do not capture circadian-metabolic coupling status. The bimodal distribution in the well-controlled group is the most clinically provocative finding: two participants who appear metabolically equivalent by every standard metric are in substantially different states of circadian-metabolic coupling. Mean |λ| correlates inversely with mean glucose (r = −0.61, p = 0.061) and glycaemic variability/CV (r = −0.68, p = 0.030).

The mechanistic interpretation centres on REV-ERBα and BMAL1. In T2DM, elevated glucagon signalling chronically activates hepatic cAMP response elements, competing with and eventually suppressing REV-ERBα rhythms. As REV-ERBα oscillation weakens, its downstream target genes — including those involved in lipogenesis and gluconeogenesis — lose their clock-gated temporal autocorrelation. AR(2) eigenvalue modulus of CGM data is therefore proposed as a practical index of circadian-metabolic coupling status — and potentially a leading biomarker of chronotherapeutic response, detectable before HbA1c changes because it measures regulatory architecture rather than mean glucose. Archived results: manuscripts/shanghai_t2dm_fibonacci.json.`,
  },
  {
    number: "Chapter 13",
    title: "Sleep and the Output Layer",
    content: `Sleep deprivation is the most common circadian disruption in human populations. Its molecular effect on the circadian system is well documented at the level of mean expression: Per1 and Per2 are acutely induced, reflecting homeostatic sleep pressure through the adenosine-mediated two-process model. But whether SD specifically disrupts the eigenvalue architecture — targeting the sustained output layer rather than the core pacemaker — has not been examined.

In 42 BXD recombinant inbred mouse strains under 6-hour sleep deprivation (Jan et al., 2019, GEO: GSE114845), the cortical expression pattern is highly selective: Per1 (+0.74 log2FC) and Per2 (+1.02 log2FC) rise sharply; Dbp falls (−0.36 log2FC); Bhlhe40 and Nfil3 — both PAR-bZip competitors — rise. The core negative feedback loop (Arntl, Cry1/2, Nr1d1/2) is essentially unchanged. Liver shows only marginal Per1 induction; hepatic clock dynamics are preserved, consistent with hepatic entrainment being driven primarily by feeding rather than homeostatic sleep pressure.

The BXD genetic architecture adds a dimension unavailable in single-strain studies. Across 42 strains, the magnitude of the Dbp suppression and Per2 induction varies substantially, reflecting natural genetic variation in the coupling between homeostatic sleep pressure and the PAR-bZip output arm. Strains with high sleep homeostatic pressure show larger Dbp falls and Nfil3 rises — a tighter genetic correlation than that between SD response and TTFL gene changes.

This pattern maps directly onto selective output-eigenvalue disruption: the pacemaker is intact; the sustained integrator output layer is clamped. The rapid 24-hour recovery of the molecular clock after recovery sleep follows naturally: the TTFL is undamaged and restores the output layer in one oscillatory cycle. Chronic sleep restriction, which eventually disrupts photic entrainment of the TTFL itself, would be predicted to cause more lasting eigenvalue collapse — a mechanistic distinction with direct clinical relevance for shift-work disorder.`,
  },
  {
    number: "Appendix A",
    title: "Why Not Cosinor? PAR(2) in Context",
    content: `Every reader from the circadian field will ask: why not use cosinor / JTK_CYCLE / RAIN? The answer is that these methods are excellent — and used throughout this collection — but they answer a different question. Cosinor, JTK_CYCLE, and RAIN test whether a gene is rhythmic and what its period and phase are. PAR(2) tests how self-sustaining the gene's dynamics are. These are orthogonal quantities.

A gene can be highly rhythmic (large amplitude, clear 24h period, JTK q-value < 0.001) and have low eigenvalue modulus — if each oscillation requires external forcing rather than self-sustaining autocorrelation. A gene can have high |λ| without appearing rhythmic to cosinor — if its persistence is present but amplitude is low. The concrete example is Dbp under sleep deprivation: still detectable as rhythmic by amplitude-based methods, but predicted by the PAR(2) framework to have lost its sustained output coupling. Amplitude and persistence occupy independent axes; both are needed.

AR(2) is chosen over AR(1) because one memory lag cannot represent a damped oscillation; over AR(3)+ because short time-series (n=12–24) cannot support more parameters without overfitting. OLS is chosen over Bayesian estimation because it is computationally identical to maximum likelihood for Gaussian errors and requires no prior specification.

Diagnostic thresholds a researcher should verify before trusting an eigenvalue: (1) |λ| < 1 — if ≥ 5% of genes fail this, the data was not properly mean-centred; (2) Ljung-Box p > 0.05 at lag 6 — residual autocorrelation indicates model underspecification for that gene; (3) ADF test passed — unit root failure means the series has a trend the AR(2) cannot absorb; (4) eigenperiod between 18h and 30h for circadian datasets — values outside this range indicate the model is fitting noise rather than the circadian signal. Every gene in every dataset in this collection was checked against all four criteria before any downstream result was computed.`,
  },
  {
    number: "Appendix B",
    title: "Glossary",
    content: `AR(2): A second-order autoregressive model x_t = φ₁x_{t−1} + φ₂x_{t−2} + ε_t. The simplest model that can represent a damped oscillation. Used throughout this collection because it captures both persistence (φ₁) and curvature/oscillatory structure (φ₂) with only two parameters — the maximum practical complexity for n=12–24 time-point circadian datasets.

Eigenvalue modulus |λ|: The magnitude of the characteristic root of the AR(2) companion matrix. Ranges from 0 (no temporal persistence) to 1 (boundary of stationarity). The primary quantitative output of the PAR(2) framework. Invariant to mean expression level, mRNA half-life, and z-score normalisation.

Fibonacci proximity (FP): max(0, 100 − ||λ|−0.618|/0.618 × 100). How close an eigenvalue is to the stable Fibonacci boundary 1/φ ≈ 0.618. Fibonacci-like: FP ≥ 85%. Near-Fibonacci: 50–85%. Non-Fibonacci: < 50%.

PAR-bZip genes: DBP, TEF, HLF — transcription factors driven by CLOCK:BMAL1 that control hundreds of metabolic gene rhythms. The sustained integrator output arm of the circadian hierarchy.

Temporal persistence: The degree to which a gene's expression at time t is predicted by its recent history, quantified by |λ|. Distinct from amplitude, period, and mRNA half-life.

Gearbox hierarchy: Clock genes (high |λ|) constrain proliferation-related genes (moderate |λ|) which sit above genome background (low |λ|). Observed across 22 datasets, four species (mouse, human, baboon, Arabidopsis), 12+ tissues.`,
  },
  {
    number: "Appendix C",
    title: "A Worked Example",
    content: CONCISE_APPENDIX_C_CONTENT,
  },
  {
    number: "Epilogue",
    title: "A Living Book",
    content: `The PAR(2) Discovery Engine is not a companion to this book — it is the book's primary form. The 97 interactive pages of the platform are where every claim in these chapters can be examined, stress-tested, and extended with new data. The figures printed here are static snapshots of analyses that run live, against real datasets, whenever a reader navigates to them.

Paper A (the core Methods and Validation paper) was submitted to Chronobiology International in July 2026. Paper G (the Boman reply) proposes a PAR(2) time-domain analogue to Boman's five temporal–spatial rules, with the Fibonacci/golden ratio connection proved as Theorem 1. Papers E, F, and Q are in preparation.

The eigenvalue of a gene's temporal dynamics is a simple number — a single real value between 0 and 1, carrying a fraction of a bit of information. That such a number, computed from a half-century-old statistical model, applied to data collected by hundreds of laboratories for entirely different purposes, should reveal a consistent hierarchical structure across species and diseases and evolutionary timescales is, at minimum, interesting. Whether it is deeply true or beautifully wrong will be settled by experiment, not by argument.

The platform exists so that anyone with a time-series dataset can begin the settling.

Platform: PAR(2) Discovery Engine
Access: 97 interactive analyses across Papers A, E, F, G, Q
Paper A submitted: Chronobiology International, July 15 2026
Data: 22 GEO datasets · 4 species · 12 tissues · 23,118 genes`,
  },
];

function epigraphSection(): object {
  return {
    children: [
      new Paragraph({ spacing: { before: 1800 }, children: [] }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 600 },
        children: [new TextRun({ text: "\u2726", font: "Garamond", size: 28, color: "1e3a5f" })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0 },
        children: [new TextRun({
          text: "\u201CThe miracle of the appropriateness of the language of mathematics",
          font: "Garamond", size: 26, italics: true, color: "555577",
        })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0 },
        children: [new TextRun({
          text: "for the formulation of the laws of physics is a wonderful gift",
          font: "Garamond", size: 26, italics: true, color: "555577",
        })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 360 },
        children: [new TextRun({
          text: "which we neither understand nor deserve.\u201D",
          font: "Garamond", size: 26, italics: true, color: "555577",
        })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 720 },
        children: [new TextRun({ text: "\u2014 Eugene Wigner, 1960", font: "Garamond", size: 22, color: "888899" })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0 },
        children: [new TextRun({ text: "\u03BB  \u00B7  \u03C9  \u00B7  \u03C4", font: "Garamond", size: 48, color: "2d5a9e" })],
      }),
      new Paragraph({ children: [new PageBreak()] }),
    ],
  };
}

function makeTOCSection(chapters: { number: string; title: string }[]): object {
  const entries: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 600 },
      children: [new TextRun({ text: "CONTENTS", font: "Garamond", size: 28, bold: true, color: "1a3a7a", characterSpacing: 200 })],
    }),
  ];
  for (const ch of chapters) {
    const isAppendix = ch.number.startsWith("Appendix");
    const isEpilogue = ch.number === "Epilogue" || ch.number === "Preface" || ch.number === "Prologue";
    entries.push(new Paragraph({
      spacing: { before: isAppendix ? 120 : 80, after: 0 },
      indent: { left: convertInchesToTwip(isAppendix ? 0.4 : 0) },
      children: [
        new TextRun({
          text: `${ch.number}  —  ${ch.title}`,
          font: "Garamond",
          size: isEpilogue || isAppendix ? 20 : 22,
          italics: isEpilogue,
          color: isAppendix ? "556688" : "1a1a2e",
        }),
      ],
    }));
  }
  entries.push(new Paragraph({ children: [new PageBreak()] }));
  return { children: entries };
}

function makeParagraphs(text: string): Paragraph[] {
  return text.split("\n\n").filter(p => p.trim()).map(para => {
    const trimmed = para.trim();
    const isFigureBlock = trimmed.startsWith("FIGURE") || trimmed.startsWith("KEY FINDING");
    if (isFigureBlock) {
      const lines = trimmed.split("\n");
      return new Paragraph({
        spacing: { before: 200, after: 200 },
        border: {
          top: { style: BorderStyle.SINGLE, size: 6, color: "1a3a7a" },
          bottom: { style: BorderStyle.SINGLE, size: 6, color: "1a3a7a" },
          left: { style: BorderStyle.THICK, size: 12, color: "1a3a7a" },
          right: { style: BorderStyle.SINGLE, size: 6, color: "1a3a7a" },
        },
        shading: { type: ShadingType.SOLID, color: "f0f4ff", fill: "f0f4ff" },
        indent: { left: convertInchesToTwip(0.2), right: convertInchesToTwip(0.2) },
        children: lines.map((line, i) => new TextRun({
          text: line,
          font: "Courier New",
          size: i === 0 ? 20 : 18,
          bold: i === 0,
          color: i === 0 ? "1a3a7a" : "333333",
          break: i > 0 ? 1 : 0,
        })),
      });
    }
    return new Paragraph({
      spacing: { before: 0, after: 200 },
      alignment: AlignmentType.JUSTIFIED,
      children: [new TextRun({ text: trimmed, font: "Garamond", size: 24, color: "1a1a2e" })],
    });
  });
}

bookRouter.get("/download", async (_req, res) => {
  try {
    const sections: any[] = [];

    // Cover page
    sections.push({
      children: [
        new Paragraph({ spacing: { before: 1440 }, children: [] }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 120 },
          children: [new TextRun({ text: "PAR(2) DISCOVERY ENGINE · RESEARCH MONOGRAPH", font: "Garamond", size: 18, color: "1a3a7a", characterSpacing: 100 })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 400, after: 200 },
          children: [new TextRun({ text: "PERSISTENCE", font: "Garamond", size: 72, bold: true, color: "0a0e2e" })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 320 },
          children: [new TextRun({ text: "Temporal Persistence and the Biological Clock", font: "Garamond", size: 32, italics: true, color: "2a4a7a" })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 320 },
          children: [new TextRun({ text: "\u03BB  \u00B7  \u03C9  \u00B7  \u03C4", font: "Garamond", size: 72, color: "4a7fc1" })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 200 },
          children: [new TextRun({ text: "Michael Whiteside", font: "Garamond", size: 24, color: "444444" })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 1200 },
          children: [new TextRun({ text: "2026", font: "Garamond", size: 24, color: "444444" })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 120 },
          children: [new TextRun({ text: "Paper A submitted to Chronobiology International · July 2026", font: "Garamond", size: 20, color: "666666" })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 120 },
          children: [new TextRun({ text: "22 Datasets · 4 Species · 12 Tissues · Papers A · E · F · G · Q", font: "Garamond", size: 20, color: "666666" })],
        }),
        new Paragraph({ children: [new PageBreak()] }),
      ],
    });

    sections.push(epigraphSection());
    sections.push(makeTOCSection(CHAPTERS));

    // Chapters
    for (const ch of CHAPTERS) {
      const chChildren: Paragraph[] = [
        chapterSymbolParagraph(ch.number),
        new Paragraph({
          spacing: { before: 0, after: 120 },
          children: [new TextRun({ text: ch.number.toUpperCase(), font: "Garamond", size: 18, color: "1a3a7a", characterSpacing: 150 })],
        }),
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 0, after: 400 },
          children: [new TextRun({ text: ch.title, font: "Garamond", size: 40, bold: true, color: "0a0e2e" })],
        }),
        ...makeParagraphs(ch.content),
        new Paragraph({ children: [new PageBreak()] }),
      ];
      sections.push({ children: chChildren });
    }

    // References / closing
    sections.push({
      children: [
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 0, after: 400 },
          children: [new TextRun({ text: "Key References & Datasets", font: "Garamond", size: 40, bold: true, color: "0a0e2e" })],
        }),
        ...[
          "Hughes ME et al. (2009). Harmonics of circadian gene expression in mammals. PLoS Genetics. [GSE11923]",
          "Mure LS et al. (2018). Diurnal transcriptome atlas of a primate across major neural and peripheral tissues. Science. [GSE98965]",
          "Boman BM, Dinh TN, Decker K, Emerick B, Raymond C, Schleiniger G (2017). Why do Fibonacci numbers appear in patterns of growth in nature? A model for tissue renewal based on asymmetric cell division. The Fibonacci Quarterly. 55(5). [Fibonacci Fixed Point]",
          "Boman BM, Dinh TN, Decker K, Emerick B, Modarai SR, Opdenaker LM, Fields JZ, Raymond C, Schleiniger G (2025). Dynamic organization of cells in colonic epithelium is encoded by five biological rules. Biology of the Cell. 117:e70017. DOI: 10.1111/boc.70017. [Five-Rule Tissue Code]",
          "Nguyen AL, Lausten MA, Boman BM (2025). The colonic crypt: cellular dynamics and signaling pathways in homeostasis and cancer. Cells. 14(18):1428. [Crypt Biology Review]",
          "TCGA Research Network (2012). Comprehensive molecular characterization of human colon and rectal cancer. Nature.",
          "Amit I et al. (2009). Unbiased reconstruction of a mammalian transcriptional network mediating pathogen responses. Science. [GSE9046]",
          "JTK_CYCLE: Hughes ME et al. (2010). JTK_CYCLE: An efficient nonparametric algorithm for detecting rhythmic components in genome-scale data sets. Journal of Biological Rhythms.",
          "Cosinor: Cornelissen G (2014). Cosinor-based rhythmometry. Theoretical Biology and Medical Modelling.",
          "RAIN: Thaben PF, Westermark PO (2014). Detecting rhythms in time series with RAIN. Journal of Biological Rhythms.",
          "GTEx Consortium (2020). The GTEx Consortium atlas of genetic regulatory effects across human tissues. Science.",
          "PAR(2) Platform: par2discovery.com · 95 interactive analyses · July 2026",
        ].map(ref => new Paragraph({
          spacing: { before: 0, after: 180 },
          children: [new TextRun({ text: ref, font: "Garamond", size: 20, color: "333333" })],
        })),
      ],
    });

    const doc = new Document({
      creator: "PAR(2) Discovery Engine",
      title: "Persistence: Temporal Persistence and the Biological Clock",
      description: "Research monograph covering Papers A, E, F, G, Q of the PAR(2) Discovery Engine",
      styles: {
        default: {
          document: { run: { font: "Garamond", size: 24, color: "1a1a2e" } },
        },
        paragraphStyles: [
          {
            id: "Heading1",
            name: "Heading 1",
            basedOn: "Normal",
            next: "Normal",
            run: { font: "Garamond", size: 40, bold: true, color: "0a0e2e" },
            paragraph: { spacing: { before: 480, after: 240 } },
          },
        ],
      },
      sections,
    });

    const buffer = await Packer.toBuffer(doc);

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", 'attachment; filename="Persistence_PAR2_Book.docx"');
    res.send(buffer);
  } catch (err) {
    console.error("[book] DOCX generation error:", err);
    res.status(500).json({ error: "Failed to generate DOCX" });
  }
});

/* ─── Extended Edition Download ──────────────────────────────────────────── */

// Thematic background type per chapter (mirrors client bgType)
const CHAPTER_BG: Record<string, "fibonacci" | "geometry" | "biological"> = {
  "Preface":    "biological",
  "Prologue":   "biological",
  "Chapter 1":  "geometry",
  "Chapter 2":  "geometry",
  "Chapter 3":  "biological",
  "Chapter 4":  "geometry",
  "Chapter 5":  "biological",
  "Chapter 6":  "biological",
  "Chapter 7":  "fibonacci",
  "Chapter 8":  "biological",
  "Chapter 9":  "fibonacci",
  "Chapter 10": "biological",
  "Chapter 11": "geometry",
  "Chapter 12": "biological",
  "Chapter 13": "fibonacci",
  "Appendix A": "geometry",
  "Appendix B": "geometry",
  "Appendix C": "geometry",
  "Epilogue":   "fibonacci",
};

// λ = eigenvalue modulus (persistence), ω = angular frequency (eigenperiod), τ = time constant (biological)
const BG_SYMBOL: Record<"fibonacci" | "geometry" | "biological", string> = {
  fibonacci:  "\u03C6",   // φ
  geometry:   "\u03BB",  // λ
  biological: "\u03C9",  // ω
};

function chapterSymbolParagraph(chNumber: string): Paragraph {
  const bg = CHAPTER_BG[chNumber] ?? "biological";
  return new Paragraph({
    alignment: AlignmentType.RIGHT,
    spacing: { before: 0, after: 0 },
    children: [new TextRun({
      text: BG_SYMBOL[bg],
      font: "Garamond",
      size: 192,
      color: "c8d8f0",
    })],
  });
}

// Map server CHAPTERS (identified by number field) to EXTENDED_CHAPTERS (by id)
const ID_MAP: Record<string, string> = {
  "Preface":    "preface",
  "Prologue":   "prologue",
  "Chapter 1":  "ch1",
  "Chapter 2":  "ch2",
  "Chapter 3":  "ch3",
  "Chapter 4":  "ch4",
  "Chapter 5":  "ch5",
  "Chapter 6":  "ch6",
  "Chapter 7":  "ch7",
  "Chapter 8":  "ch8",
  "Chapter 9":  "ch9",
  "Chapter 10": "ch10",
  "Chapter 11": "ch11",
  "Chapter 12": "ch12",
  "Chapter 13": "ch13",
  "Appendix A":   "appendix-methods",
  "Appendix B":   "appendix-glossary",
  "Appendix C":   "appendix-example",
  "Author's Note": "ai-disclosure",
  "Epilogue":     "epilogue",
};

bookRouter.get("/download-extended", async (_req, res) => {
  try {
    const sections: any[] = [];

    // Cover page
    sections.push({
      properties: {},
      children: [
        new Paragraph({
          spacing: { before: 2880 },
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "PERSISTENCE", font: "Garamond", size: 72, bold: true, color: "0a0e2e" })],
        }),
        new Paragraph({
          spacing: { before: 240, after: 320 },
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "Temporal Persistence and the Biological Clock", font: "Garamond", size: 36, italics: true, color: "1a3a7a" })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 320 },
          children: [new TextRun({ text: "\u03BB  \u00B7  \u03C9  \u00B7  \u03C4", font: "Garamond", size: 72, color: "4a7fc1" })],
        }),
        new Paragraph({
          spacing: { before: 0 },
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "Extended Edition", font: "Garamond", size: 28, color: "4a7fc1" })],
        }),
        new Paragraph({
          spacing: { before: 120 },
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "Michael Whiteside", font: "Garamond", size: 26, color: "333355" })],
        }),
        new Paragraph({
          spacing: { before: 80 },
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "PAR(2) Discovery Engine · Research Monograph · 2026", font: "Garamond", size: 22, color: "666688" })],
        }),
        new Paragraph({ children: [new PageBreak()] }),
      ],
    });

    const bodyChildren: Paragraph[] = [
      ...(epigraphSection() as any).children,
      ...(makeTOCSection(CHAPTERS) as any).children,
    ];

    // Extended chapters — all in one section to avoid section-break markers
    for (const ch of CHAPTERS) {
      const id = ID_MAP[ch.number];
      const extEntry = id ? EXTENDED_CHAPTERS.find(e => e.id === id) : undefined;
      const content = extEntry?.contentExtended ?? ch.content;

      bodyChildren.push(
        chapterSymbolParagraph(ch.number),
        new Paragraph({
          spacing: { before: 0, after: 120 },
          children: [new TextRun({ text: ch.number.toUpperCase(), font: "Garamond", size: 22, color: "4a7fc1", allCaps: true })],
        }),
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 0, after: 360 },
          children: [new TextRun({ text: ch.title, font: "Garamond", size: 48, bold: true, color: "0a0e2e" })],
        }),
        ...makeParagraphs(content),
        ...(extEntry?.platformLinks && extEntry.platformLinks.length > 0 ? [
          new Paragraph({
            spacing: { before: 360, after: 80 },
            children: [new TextRun({ text: "PLATFORM EVIDENCE", font: "Garamond", size: 18, color: "4a7fc1", bold: true, allCaps: true })],
          }),
          ...extEntry.platformLinks.map(link => new Paragraph({
            spacing: { before: 0, after: 100 },
            children: [
              new TextRun({ text: "\u2192 ", font: "Garamond", size: 18, color: "334e7a" }),
              new ExternalHyperlink({
                link: `https://par2discovery.com${link.route}`,
                children: [
                  new TextRun({
                    text: link.label,
                    font: "Garamond",
                    size: 18,
                    color: "1a5276",
                    underline: {},
                  }),
                ],
              }),
            ],
          })),
        ] : []),
        new Paragraph({ children: [new PageBreak()] }),
      );
    }

    // References — appended to same section
    bodyChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 0, after: 360 },
        children: [new TextRun({ text: "References", font: "Garamond", size: 40, bold: true, color: "0a0e2e" })],
      }),
        ...[
          "Hughes ME et al. (2009). Harmonics of circadian gene expression in mammals. PLoS Genetics. [GSE11923]",
          "Mure LS et al. (2018). Diurnal transcriptome atlas of a primate across major neural and peripheral tissues. Science. [GSE98965]",
          "Boman BM, Dinh TN, Decker K, Emerick B, Raymond C, Schleiniger G (2017). Why do Fibonacci numbers appear in patterns of growth in nature? A model for tissue renewal based on asymmetric cell division. The Fibonacci Quarterly. 55(5). [Fibonacci Fixed Point]",
          "Boman BM, Dinh TN, Decker K, Emerick B, Modarai SR, Opdenaker LM, Fields JZ, Raymond C, Schleiniger G (2025). Dynamic organization of cells in colonic epithelium is encoded by five biological rules. Biology of the Cell. 117:e70017. DOI: 10.1111/boc.70017. [Five-Rule Tissue Code]",
          "Nguyen AL, Lausten MA, Boman BM (2025). The colonic crypt: cellular dynamics and signaling pathways in homeostasis and cancer. Cells. 14(18):1428. [Crypt Biology Review]",
          "TCGA Research Network (2012). Comprehensive molecular characterization of human colon and rectal cancer. Nature.",
          "Amit I et al. (2009). Unbiased reconstruction of a mammalian transcriptional network mediating pathogen responses. Science. [GSE9046]",
          "JTK_CYCLE: Hughes ME et al. (2010). JTK_CYCLE: An efficient nonparametric algorithm for detecting rhythmic components in genome-scale data sets. Journal of Biological Rhythms.",
          "Cosinor: Cornelissen G (2014). Cosinor-based rhythmometry. Theoretical Biology and Medical Modelling.",
          "RAIN: Thaben PF, Westermark PO (2014). Detecting rhythms in time series with RAIN. Journal of Biological Rhythms.",
          "GTEx Consortium (2020). The GTEx Consortium atlas of genetic regulatory effects across human tissues. Science.",
          "PAR(2) Platform: par2discovery.com · 95 interactive analyses · July 2026",
        ].map(ref => new Paragraph({
          spacing: { before: 0, after: 180 },
          children: [new TextRun({ text: ref, font: "Garamond", size: 20, color: "333333" })],
        }))
    );

    sections.push({ children: bodyChildren });

    const doc = new Document({
      creator: "PAR(2) Discovery Engine",
      title: "Persistence: Temporal Persistence and the Biological Clock — Extended Edition",
      description: "Extended research monograph covering Papers A, E, F, G, Q of the PAR(2) Discovery Engine",
      styles: {
        default: {
          document: { run: { font: "Garamond", size: 24, color: "1a1a2e" } },
        },
        paragraphStyles: [
          {
            id: "Heading1",
            name: "Heading 1",
            basedOn: "Normal",
            next: "Normal",
            run: { font: "Garamond", size: 40, bold: true, color: "0a0e2e" },
            paragraph: { spacing: { before: 480, after: 240 } },
          },
        ],
      },
      sections,
    });

    const buffer = await Packer.toBuffer(doc);

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", 'attachment; filename="Persistence_PAR2_Book_Extended.docx"');
    res.send(buffer);
  } catch (err) {
    console.error("[book] Extended DOCX generation error:", err);
    res.status(500).json({ error: "Failed to generate extended DOCX" });
  }
});

// ─── Extended PDF with clickable hyperlinks ────────────────────────────────
bookRouter.get("/download-extended-pdf", async (_req, res) => {
  try {
    const PDFDocument = (await import("pdfkit")).default;

    const ML = 80, MR = 72, MT = 72, MB = 72;

    const doc = new PDFDocument({
      size: "LETTER",
      margins: { top: MT, bottom: MB, left: ML, right: MR },
      info: {
        Title: "Persistence: Temporal Persistence and the Biological Clock — Extended Edition",
        Author: "Michael Whiteside",
        Subject: "Circadian Biology, AR(2) Autoregression, Eigenvalue Analysis",
        Keywords: "circadian, eigenvalue, PAR2, AR2, Fibonacci, chronotherapy",
      },
      autoFirstPage: false,
    });

    // Register Unicode-capable fonts so Greek/math/subscript chars render correctly.
    // DejaVu fonts are on the system and cover all characters used in the book content.
    doc.registerFont("DejaVuSerif",     "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf");
    doc.registerFont("DejaVuSerifBold", "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf");
    doc.registerFont("DejaVuMono",      "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf");

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    const pdfDone = new Promise<Buffer>((resolve, reject) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
    });

    let pageNum = 0;

    // Safe page-adder: temporarily zeros bottom margin to prevent recursive pageAdded
    // calls when writing the footer below the content area.
    const addBookPage = (showFooter = true) => {
      doc.addPage();
      pageNum++;
      if (!showFooter) return;
      const ph = doc.page.height;
      const origBottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0; // prevent auto page-break while drawing footer
      const fy = ph - origBottom + 10;
      const cW = doc.page.width - ML - MR;
      doc.font("DejaVuSerif").fontSize(8).fillColor("#94a3b8")
        .text("Persistence  \u00B7  PAR(2) Discovery Engine  \u00B7  Extended Edition",
          ML, fy, { width: cW * 0.68, align: "left", lineBreak: false });
      doc.font("DejaVuSerif").fontSize(8).fillColor("#94a3b8")
        .text(String(pageNum), ML + cW * 0.68, fy,
          { width: cW * 0.32, align: "right", lineBreak: false });
      doc.page.margins.bottom = origBottom;
      // Reset cursor to top of content area
      doc.x = ML;
      doc.y = MT;
    };

    const cW = 612 - ML - MR; // LETTER width 612pt minus margins

    // ── Paragraph renderer — strips **bold** markers to avoid pdfkit
    //    continuedX accumulation bug when wrapping long lines ───────────────
    const renderInline = (text: string) => {
      // Strip **bold** markers: render clean plain text in a single doc.text() call
      const plain = text.replace(/\*\*([^*]+)\*\*/g, "$1");
      doc.font("DejaVuSerif").fontSize(11).fillColor("#1a1a2e").text(plain);
    };

    // ── Content block renderer ────────────────────────────────────────────
    const renderContent = (content: string) => {
      const lines = content.split("\n");
      let i = 0;
      let tableRows: string[] = [];

      const flushTable = () => {
        if (!tableRows.length) return;
        doc.moveDown(0.2);
        doc.font("DejaVuMono").fontSize(7.5).fillColor("#0f172a");
        for (const row of tableRows) {
          const cells = row.split("|")
            .slice(1, -1)               // drop leading/trailing empty from split
            .map(c => c.trim().slice(0, 22).padEnd(22));
          doc.text(cells.join("  "), ML, doc.y, { width: cW, lineBreak: true });
        }
        doc.font("DejaVuSerif").fontSize(11).fillColor("#1a1a2e");
        doc.moveDown(0.5);
        tableRows = [];
      };

      while (i < lines.length) {
        const raw = lines[i];
        const line = raw.trimEnd();

        // Blank line
        if (!line.trim()) {
          flushTable();
          doc.moveDown(0.35);
          i++; continue;
        }

        // Table separator — skip
        if (/^\|[\s\-:|]+\|/.test(line)) { i++; continue; }

        // Table row
        if (line.startsWith("|")) {
          tableRows.push(line);
          i++; continue;
        }
        flushTable();

        // Heading
        const hm = line.match(/^(#{1,4}) (.+)/);
        if (hm) {
          const lvl = hm[1].length;
          const htxt = hm[2].replace(/\*\*/g, "").replace(/`/g, "");
          doc.moveDown(lvl <= 2 ? 0.8 : 0.5);
          const [sz, col] = lvl === 1 ? [18, "#0a0e2e"] : lvl === 2 ? [14, "#1a3a7a"] : lvl === 3 ? [12, "#1e3d6e"] : [11, "#334e7a"];
          doc.font("DejaVuSerifBold").fontSize(sz).fillColor(col).text(htxt, { lineBreak: true });
          doc.moveDown(0.3);
          doc.font("DejaVuSerif").fontSize(11).fillColor("#1a1a2e");
          i++; continue;
        }

        // Bullet
        if (/^[-*] /.test(line)) {
          const txt = line.replace(/^[-*] /, "");
          doc.font("DejaVuSerif").fontSize(11).fillColor("#1a1a2e");
          renderInline("\u2022  " + txt);
          i++; continue;
        }

        // Numbered list
        const numm = line.match(/^(\d+)\. (.+)/);
        if (numm) {
          doc.font("DejaVuSerif").fontSize(11).fillColor("#1a1a2e");
          renderInline(`${numm[1]}. ${numm[2]}`);
          i++; continue;
        }

        // Regular / bold-prefixed paragraph
        doc.font("DejaVuSerif").fontSize(11).fillColor("#1a1a2e");
        renderInline(line);
        i++;
      }
      flushTable();
    };

    // ════════════════════════════════════════════════════════════════════
    // COVER PAGE  (no footer on cover)
    // ════════════════════════════════════════════════════════════════════
    addBookPage(false);
    doc.moveDown(9);
    doc.font("DejaVuSerifBold").fontSize(46).fillColor("#0a0e2e")
      .text("PERSISTENCE", { align: "center" });
    doc.moveDown(0.5);
    doc.font("DejaVuSerif").fontSize(16).fillColor("#1a3a7a")
      .text("Temporal Persistence and the Biological Clock", { align: "center" });
    doc.moveDown(0.4);
    doc.font("DejaVuSerifBold").fontSize(12).fillColor("#4a7fc1")
      .text("Extended Edition", { align: "center" });
    doc.moveDown(0.4);
    doc.font("DejaVuSerif").fontSize(11).fillColor("#666688")
      .text("\u03BB  \u00B7  \u03C9  \u00B7  \u03C4", { align: "center" });
    doc.moveDown(1.5);
    doc.font("DejaVuSerif").fontSize(13).fillColor("#333355")
      .text("Michael Whiteside", { align: "center" });
    doc.moveDown(0.4);
    doc.font("DejaVuSerif").fontSize(10).fillColor("#94a3b8")
      .text("PAR(2) Discovery Engine  \u00B7  Research Monograph  \u00B7  2026", { align: "center" });
    doc.moveDown(0.3);
    doc.font("DejaVuSerif").fontSize(10).fillColor("#1a5276")
      .text("par2discovery.com", {
        align: "center",
        link: "https://par2discovery.com",
        underline: true,
      });

    // ════════════════════════════════════════════════════════════════════
    // CHAPTERS
    // ════════════════════════════════════════════════════════════════════
    for (const ch of CHAPTERS) {
      addBookPage();

      const id = ID_MAP[ch.number];
      const extEntry = id ? EXTENDED_CHAPTERS.find(e => e.id === id) : undefined;
      const content = extEntry?.contentExtended ?? ch.content;

      // Chapter label
      doc.font("DejaVuSerifBold").fontSize(9).fillColor("#4a7fc1")
        .text(ch.number.toUpperCase(), { characterSpacing: 1.2 });
      doc.moveDown(0.15);

      // Chapter title
      doc.font("DejaVuSerifBold").fontSize(26).fillColor("#0a0e2e")
        .text(ch.title, { lineBreak: true });
      doc.moveDown(0.3);

      // Thin rule
      doc.moveTo(ML, doc.y).lineTo(ML + cW, doc.y)
        .strokeColor("#1e3a7a").lineWidth(0.4).stroke();
      doc.moveDown(0.65);

      // Body
      doc.font("DejaVuSerif").fontSize(11).fillColor("#1a1a2e");
      renderContent(content);

      // Platform evidence links
      if (extEntry?.platformLinks && extEntry.platformLinks.length > 0) {
        doc.moveDown(0.8);
        doc.moveTo(ML, doc.y).lineTo(ML + cW * 0.35, doc.y)
          .strokeColor("#4a7fc1").lineWidth(0.35).stroke();
        doc.moveDown(0.5);

        doc.font("DejaVuSerifBold").fontSize(7.5).fillColor("#4a7fc1")
          .text("PLATFORM EVIDENCE", { characterSpacing: 1.5 });
        doc.moveDown(0.35);

        for (const link of extEntry.platformLinks) {
          const url = `https://par2discovery.com${link.route}`;
          doc.font("DejaVuSerif").fontSize(10).fillColor("#1a5276")
            .text("\u2192  " + link.label, {
              link: url,
              underline: true,
              indent: 0,
              continued: false,
            });
          doc.moveDown(0.1);
        }
      }
    }

    // ════════════════════════════════════════════════════════════════════
    // REFERENCES
    // ════════════════════════════════════════════════════════════════════
    addBookPage();
    doc.font("DejaVuSerifBold").fontSize(22).fillColor("#0a0e2e").text("References");
    doc.moveDown(0.6);
    doc.moveTo(ML, doc.y).lineTo(ML + cW, doc.y)
      .strokeColor("#1e3a7a").lineWidth(0.4).stroke();
    doc.moveDown(0.6);

    const REFS = [
      "Hughes ME et al. (2009). Harmonics of circadian gene expression in mammals. PLoS Genetics. [GSE11923]",
      "Mure LS et al. (2018). Diurnal transcriptome atlas of a primate across major neural and peripheral tissues. Science. [GSE98965]",
      "Boman BM et al. (2017). Why do Fibonacci numbers appear in patterns of growth in nature? A model for tissue renewal based on asymmetric cell division. The Fibonacci Quarterly. 55(5).",
      "Boman BM et al. (2025). Dynamic organization of cells in colonic epithelium is encoded by five biological rules. Biology of the Cell. 117:e70017. DOI: 10.1111/boc.70017.",
      "Nguyen AL, Lausten MA, Boman BM (2025). The colonic crypt: cellular dynamics and signaling pathways in homeostasis and cancer. Cells. 14(18):1428.",
      "TCGA Research Network (2012). Comprehensive molecular characterization of human colon and rectal cancer. Nature.",
      "Hughes ME et al. (2010). JTK_CYCLE: An efficient nonparametric algorithm for detecting rhythmic components in genome-scale data sets. Journal of Biological Rhythms.",
      "Cornelissen G (2014). Cosinor-based rhythmometry. Theoretical Biology and Medical Modelling.",
      "Thaben PF, Westermark PO (2014). Detecting rhythms in time series with RAIN. Journal of Biological Rhythms.",
      "GTEx Consortium (2020). The GTEx Consortium atlas of genetic regulatory effects across human tissues. Science.",
      "Weterings et al. (2024). Hes1 oscillation period determines cell fate in intestinal organoids. bioRxiv 10.1101/2024.08.26.609553.",
      "PAR(2) Platform: par2discovery.com — 97 interactive analyses (July 2026)",
    ];

    for (const ref of REFS) {
      doc.font("DejaVuSerif").fontSize(10).fillColor("#1a1a2e")
        .text(ref, { indent: 0, lineBreak: true });
      doc.moveDown(0.45);
    }

    doc.end();
    const buffer = await pdfDone;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="Persistence_PAR2_Book_Extended.pdf"');
    res.send(buffer);
  } catch (err) {
    console.error("[book] Extended PDF generation error:", err);
    res.status(500).json({ error: "Failed to generate extended PDF" });
  }
});
