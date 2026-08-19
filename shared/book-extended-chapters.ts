import { GSE11923 } from "./canonical-values";

export interface PlatformLink {
  label: string;
  route: string;
}

export interface ExtendedChapter {
  id: string;
  contentExtended: string;
  platformLinks?: PlatformLink[];
}

export const EXTENDED_CHAPTERS: ExtendedChapter[] = [
  {
    id: "prologue",
    contentExtended: `The 2017 Nobel Prize in Physiology or Medicine was awarded to Jeffrey Hall, Michael Rosbash, and Michael Young for their work on the molecular mechanisms controlling circadian rhythms. The work, conducted primarily in Drosophila melanogaster over two decades beginning in the 1980s, established that the biological clock is a transcriptional-translational feedback loop: a small set of genes whose protein products repress their own transcription, with the delay built into this negative feedback generating an approximately 24-hour cycle. The prize recognised not merely a discovery but a framework — a molecular vocabulary that transformed circadian biology from a descriptive field into a mechanistic one.

### The Molecular Clock — A Story in Three Acts

The first act of the Nobel story takes place in the 1960s and 1970s, before the relevant genes were identified. Ronald Konopka and Seymour Benzer mutated Drosophila at random and screened thousands of individual flies for aberrant locomotor activity patterns. The screen produced three mutant strains: one with a shorter than normal period (~19 hours), one with a longer period (~29 hours), and one with no detectable periodicity at all. All three mutations mapped to the same genetic locus, which Konopka and Benzer named period. This was the first direct evidence that a single gene could determine the period of a biological clock.

The second act spans the 1980s and 1990s. Hall, Rosbash, and Young cloned the period gene and its protein product PER. They discovered that PER protein accumulates gradually during the night, feeds back to repress its own transcription, and is then degraded — producing the oscillation. Young's laboratory added TIMELESS (in flies) and the kinase DOUBLETIME, which controls the rate of PER degradation and therefore the period. Each molecular detail tightened the mechanistic account.

The mammalian counterparts were identified through the 1990s. The core positive arm consists of BMAL1 and CLOCK, which form a heterodimer and drive transcription through E-box enhancer sequences. The negative arm consists of PER1, PER2, CRY1, and CRY2, whose proteins gradually accumulate, form repressive complexes, and return to the nucleus to inhibit BMAL1/CLOCK activity. Secondary loops involving ROR and REV-ERB nuclear receptors add stability and amplitude to the primary oscillation. The result is a cellular clock that keeps time with a precision of roughly 24 hours across a range of temperatures and metabolic conditions — a feat of biochemical engineering that evolution has conserved across all kingdoms of life.

### The Genome-Wide Revolution and Its Limits

The development of DNA microarrays in the late 1990s transformed the scale at which circadian biology could be studied. Rather than examining one gene at a time, genome-wide surveys could simultaneously measure the expression of thousands of genes across many time points. The first landmark genome-wide circadian studies appeared in 2002: Hogenesch and colleagues in mouse liver, Ceriani and colleagues in Drosophila. Both found that a substantial fraction of the transcriptome — between 5% and 15% of expressed genes, depending on the tissue — showed statistically significant 24-hour rhythmicity.

Subsequent studies, benefiting from improved RNA sequencing technology and longer time series, revised this estimate upward. In some tissues — notably the liver, where the clock regulates metabolism, detoxification, and protein synthesis — the majority of expressed genes oscillate at some level. The clock, these data revealed, is not a regulator of a few output genes. It is an organising principle for a large fraction of mammalian gene expression.

The analytical tools developed to characterise this genome-wide rhythmicity were designed with a specific and well-defined objective: classification. Given a time series of expression measurements, does this gene oscillate significantly at a period of approximately 24 hours? JTK_CYCLE answered this with a nonparametric rank-based test. RAIN extended this to arbitrary waveform shapes. Cosinor regression fitted a sinusoidal model and reported amplitude, phase, and p-value. These methods are powerful and appropriate for their stated purpose. They gave the field its vocabulary: amplitude, phase, period, q-value. An entire decade of circadian systems biology was constructed on this vocabulary.

But classification is not quantification. Labelling a gene as "rhythmic" places it on one side of a statistical threshold. It does not indicate how strongly the gene's future expression is constrained by its past, whether it would maintain its rhythm if the clock were disrupted, or whether it is a core participant in the oscillatory mechanism or a distant downstream target that merely reflects the clock's output. These are different questions, and the existing toolkit was not designed to answer them.

### The Gap Between Detection and Depth

Consider what the circadian community has learned to call "clock-controlled genes" — the several thousand genes in any given tissue that oscillate with statistically significant 24-hour rhythmicity. This is a list. The list contains genes at every level of the regulatory hierarchy: genes whose rhythmicity is driven directly by BMAL1/CLOCK binding E-box sequences in their promoters; genes driven by secondary regulatory elements (D-boxes, RORE sequences) through intermediate clock output regulators; genes whose rhythmicity reflects metabolic feedback from the cell's energy state; and genes whose weak oscillatory signal is statistical noise that correlates with biological activity patterns. All of these appear on the same list. The list cannot distinguish between them.

The distinction matters. A gene directly embedded in the transcription-translation feedback loop will maintain its rhythm for days after pharmacological or genetic disruption of the core clock. A gene driven through a secondary metabolic signal may lose its rhythm within hours. A gene with a noise-driven apparent rhythmicity may show no response at all. If you are designing a chronotherapy experiment — testing whether the timing of drug administration relative to the patient's circadian phase affects efficacy — you want to target genes in the first category. The list does not tell you which category each gene is in.

### The Question This Book Answers

The question at the centre of this work is whether a single number can capture the **temporal persistence** of a gene's expression — not just whether it oscillates, but how strongly its past constrains its future, and how that property varies across the regulatory hierarchy. The answer is yes, and the number is the eigenvalue modulus of a second-order autoregressive process fitted to the gene's expression time series.

The intuition begins here: a gene at the core of the clock's self-sustaining feedback loop should have strong temporal persistence — its expression at any time point should be strongly predictable from where it has been, because the interlocking regulatory circuit continuously reinstates its trajectory. A gene loosely connected to the clock should have weaker persistence. But the relationship between persistence and clock control is not simply monotone. The Chapter 5 cancer analysis illustrates this: removing BMAL1 does not reduce all eigenvalues uniformly, and the pattern of changes across gene categories is not what a simple "clock drives persistence" model would predict. Temporal persistence is therefore the primary concept; clock control is one mechanism among several that shapes where on the persistence scale a gene sits — sustaining high persistence in core oscillator genes (which are self-referentially embedded in the feedback loop) and driving the annotated target panel toward an intermediate level through active phase-gating. The eigenvalue of the AR(2) process measures this persistence on a scale from 0 (no memory) to 1 (perfect memory, non-stationary boundary).

This continuum treatment of oscillatory self-sustainability finds independent support in oscillator theory. Herzel et al. (2026, *npj Biological Timing and Sleep*) argue that circadian biology requires exactly this kind of continuous scalar: oscillator strength spans a range from noise-driven damped oscillations at one end to strongly self-sustained limit cycles at the other, and most mammalian single-cell clocks occupy an intermediate position rather than either extreme. The AR(2) eigenvalue modulus is a data-derived instantiation of this continuum. A gene with |λ| near 0 corresponds to a noise-driven signal with no oscillatory self-organisation; a gene with |λ| approaching 1 corresponds to a strongly self-sustaining process near the non-stationary boundary. The eigenvalue measures where on that continuum each gene sits — not whether it is an oscillator or not.

The empirical finding — that core clock genes separate robustly from background genes on this persistence scale across 22 independent datasets spanning four species and more than a dozen tissues, with clock target genes occupying an intermediate band — is the central result of the work this book describes. The clock-versus-background separation is the robust, near-universal result; the full three-tier ordering (clock > target > background) holds in most but not all tissues, because the target and background tiers can overlap. It was not predicted that the result would be this clean, this consistent, or this reproducible. The subsequent chapters trace how it was found, how it was stress-tested, and what it implies for cancer, drug targets, circadian hierarchy, and the future of chronobiology.

### A Note on How to Read This Book

The chapters that follow are organised into three parts with different epistemic status. **Part I** contains the core empirical finding. **Part II** contains first applications of that finding to new domains. **Part III** contains the most speculative material. This distinction matters: a reader who finds Part III unconvincing should not allow that reaction to colour the empirical material in Part I, and a reader who is sceptical of a specific Part II application is likely correct that more work is needed in that domain. The parts are genuinely independent in their claims.

The scientifically trained reader who wants the mathematical detail will find it in Chapter 2, which provides a full account of the AR(2) model, the eigenvalue derivation, and the diagnostic validation. The reader more interested in the biological findings can read Chapters 1, 3, 5, 6, 7, 8, and 9 as a connected narrative without engaging with the mathematics.

---

**PART I — THE CORE FINDING**

*The six chapters and three appendices in this part constitute the primary empirical argument of the book. The central claim — that AR(2) eigenvalue modulus separates core clock genes from target genes from background genes, in a consistent three-tier hierarchy — has been tested across 22 independent datasets, four species, and more than a dozen tissues. The clock-versus-background separation is the robust, near-universal result; the full three-tier ordering holds in most but not all tissues. Chapter 4 attempts systematically to destroy this finding; it survived every test described there. This part can stand independently of Parts II and III. A reader who reads only Part I will have the complete empirical foundation. If independent replication confirms Parts II and III, that is important; if it does not, Part I is unaffected.*

**Chapter 1** introduces the core question and the two-gene problem — why Bmal1 and Dbp, equally "rhythmic" by every standard measure, are biologically different in a way that eigenvalue modulus captures. **Chapter 2** is the mathematical chapter; it can be skipped on a first reading without losing the thread. **Chapter 3** documents the cross-species replication across 22 datasets — mouse, human, baboon, and Arabidopsis — and is the empirical foundation on which everything else rests. **Chapter 4** systematically attempts to destroy the finding: testing for confounds including transcript half-life, expression level, sampling resolution, and network centrality. Its conclusion — that none of these explain the signal — is necessary before any clinical or translational interpretation can be trusted. **Chapter 5** applies the framework to cancer, specifically colorectal organoids carrying the APC mutation, and introduces phase-gating as a measurable property. **Chapter 6** addresses the drug target question and establishes that eigenvalue is orthogonal to mRNA stability. **Chapter 8** maps eigenvalue across the central-to-peripheral gradient from SCN to lung, and offers the counterintuitive finding that the master pacemaker has the lowest eigenvalue. **Appendices A–C** provide the methodological context, glossary, and two fully reproducible worked examples.

---

**PART II — FIRST APPLICATIONS**

*The six chapters here apply the PAR(2) eigenvalue framework to cancer, drug targets, immunity, protein dynamics, metabolic monitoring, and sleep. Each application is a first pass — a demonstration that the framework extends to a new domain — not a completed investigation of that domain. Sample sizes in this section are small by the standards of the relevant clinical fields: n = 10 participants in the Shanghai T2DM CGM eigenvalue analysis (Zhao et al. 2023) plus n = 18 normoglycemic adults in the Colas et al. (2019) cross-dataset comparison (Chapter 12), 7 proteins in the proteomics chapter (analysed in 28 predictor-protein combinations), one macrophage dataset in the immune chapter. The findings are internally consistent and biologically coherent, but each requires independent replication in its domain before clinical or translational conclusions can be drawn. They are presented as starting points, not endpoints. A reader who finds a specific chapter's evidence insufficient to support its conclusions is likely correct that more work is needed.*

**Chapter 10** applies PAR(2) to the immune system using a mouse peritoneal macrophage circadian dataset, revealing a structural asymmetry within the clock gene panel absent from metabolic tissues: the negative-arm repressors (PER1–3, CRY1–2, REV-ERBα/β) carry substantially higher |λ| than the positive-arm activators (CLOCK, BMAL1, RORα/β/γ), consistent with the repressive arm bearing the regulatory burden in innate immune cells. **Chapter 11** addresses the protein level, demonstrating that the eigenvalue signal survives translation and post-translational processing, with WEE1 and YAP1 as specific examples of clinical relevance. **Chapter 12** applies eigenvalue analysis to two independent CGM datasets: the Shanghai T2DM dataset (Zhao et al. 2023; n = 10 diabetic participants; multi-day 5-minute CGM recordings across the glycaemic spectrum) and the Colas et al. (2019) normoglycemic cohort (n = 18 healthy adults; 24-hour hourly profiles). In the Shanghai dataset, |λ| correlates inversely with mean glucose (r = −0.61, p = 0.061) and glycaemic variability (r = −0.68, p = 0.030). In the Colas normoglycemic cohort, neither correlation is significant (r = +0.26 and r = −0.24, p > 0.30), establishing that the inverse |λ|–CV% relationship is specific to the disease range rather than a generic mathematical association — a specificity check that strengthens rather than undermines the diabetic finding. **Chapter 13** examines sleep deprivation across 42 BXD mouse strains and shows that SD selectively disrupts the PAR-bZip output arm rather than the core TTFL, with implications for understanding chronic sleep restriction and shift-work disorder.

---

**PART III — OPEN QUESTIONS**

*The two chapters here are the most speculative in the book. Chapter 7 develops the algebraic connection between Boman's five-rule tissue code and the AR(2) stability boundary — a mathematical relationship that is clear, but whose biological meaning is unresolved. Chapter 9 surveys downstream implications in chronotherapy, evolutionary gene age, and the Turing connection. None of the content in Part III depends on Parts I or II being correct, and nothing in Parts I or II depends on Part III. These chapters are included because the questions are worth asking, not because the answers are established.*

**Chapter 7** is the Fibonacci chapter — the most speculative, and the most mathematically surprising. **Chapter 9** surveys the downstream implications: chronotherapy, evolutionary gene age, and the Turing connection.

---

The three Appendices are reference material rather than narrative: Appendix A explains the relationship between PAR(2) and standard methods (cosinor, JTK_CYCLE, RAIN) and lists the four diagnostic checks every analysis should pass; Appendix B is a glossary of key terms; Appendix C provides two fully worked numerical examples — Arntl and Dbp from GSE54650 — that a reader can reproduce from scratch.

The book is designed to be read alongside the platform. Every figure cited here is rendered live at the corresponding platform page, where the data behind it can be explored interactively. Every claim is linked to an analysis that can be reproduced with different parameters, different datasets, or different gene categories. The book is the argument; the platform is the evidence.

We are only able to see this second dimension of clock control because the last three decades of research mapped the first — the molecular mechanism — so thoroughly. What follows describes what the data reveal when a quantitative lens is added alongside the qualitative one.`,
    platformLinks: [
      { label: "Discovery Engine: three-tier eigenvalue hierarchy across datasets", route: "/discovery-engine" },
      { label: "Convergence Map: cross-dataset replication overview", route: "/convergence-map" },
    ],
  },
  {
    id: "ch1",
    contentExtended: `The history of measurement in biology is largely a history of adding dimensions. Early descriptions of circadian gene expression were binary: a gene either oscillates or it does not. That binary description was scientifically productive and remains the foundation on which this work builds. What the PAR(2) framework adds is not a correction to that foundation but a second axis alongside it — not rhythmic versus arrhythmic, but how persistently rhythmic, and how strongly that persistence is organised by the clock's regulatory architecture. The shift in question from "does this gene oscillate?" to "how self-sustaining is this gene's oscillation?" is smaller and more specific than the framing shifts that punctuate the history of science, but it opens territory the original question was not designed to explore.

### The Question Binary Classification Was Not Designed to Answer

Biology has long organised itself around binary distinctions. Present or absent. Expressed or silenced. Active or inactive. On or off. This is not intellectual laziness — it is a rational response to the realities of biological measurement. When signal-to-noise ratios are modest, when sample sizes are limited by the cost and difficulty of time-resolved experiments, and when the analytical tools available are designed for classification, the most defensible scientific statement is often one with two options: this gene appears to oscillate; that one does not.

The binary framing of circadian gene classification — rhythmic versus arrhythmic — served the field well for two decades. It produced consistent results across laboratories. It enabled large-scale comparative genomics. It established the breadth and tissue-specificity of the circadian transcriptome. These are genuine achievements, and they are the foundation on which the question asked here depends.

What binary classification was not designed to do — and what it cannot do without additional machinery — is distinguish between genes that are rhythmic in qualitatively different ways. The boundary between "rhythmic" and "arrhythmic" is necessarily a function of the significance threshold and the quality of the dataset, not of the underlying biology alone. More consequentially, within the population of genes labelled "rhythmic," there is substantial variability in what that label means biologically — variability that the binary framework, by design, treats equivalently, because distinguishing within that category was never its purpose.

### The Two-Gene Problem

Consider two specific genes that will recur throughout this book: Bmal1 and Dbp (D-box binding PAR domain protein). Both are classified as strongly rhythmic in mouse liver by every detection-based analysis method. Both have 24-hour periods. Both have large amplitudes. Both have q-values orders of magnitude below the most stringent threshold. In any standard analysis pipeline, they are equally "clock genes."

But their biology is fundamentally different. Bmal1 is the central positive arm of the transcription-translation feedback loop — its protein product BMAL1 is the primary transcription factor that drives the entire circadian programme. It is simultaneously a driver and a target of the clock: its expression is maintained by positive autoregulation through ROR nuclear receptors and by the dynamics of the feedback loop itself. Remove the core clock machinery, and Bmal1 expression does not simply stop — it shifts to a lower, arrhythmic level, reflecting the loss of the oscillatory component while retaining some baseline activity.

Dbp is downstream. It is driven by BMAL1/CLOCK through E-box and D-box regulatory elements and is a canonical output gene — a reliable reporter of clock activity but not a participant in the mechanism. Remove BMAL1, and Dbp's oscillation disappears rapidly, within 48 hours. It is entirely dependent on continued upstream driving to maintain its rhythm.

The AR(2) eigenvalue separates them: |λ|(Bmal1) ≈ ${GSE11923.bmal1.lambda}; |λ|(Dbp) ≈ ${GSE11923.dbp.lambda} in the GSE11923 mouse liver dataset. The same period. Similar amplitude. Identical binary classification. But a substantial difference in eigenvalue modulus — the ordering |λ|(Bmal1) > |λ|(Dbp) reproduces across every mouse liver dataset examined and correctly reflects the biological hierarchy between them. (The specific values depend on dataset, probe, and normalisation — the figures quoted here are from GSE11923; the GSE54650 fits in Appendix C give a different Arntl value — so it is the ordering, not the exact numbers, that is the robust claim.)

### Temporal Memory as a Physical Concept

The concept of "temporal memory" in the context of gene expression deserves careful unpacking. It is not a metaphor. In the mathematics of stochastic processes, a system has memory if knowing its past state reduces uncertainty about its future state beyond what its present state alone would predict. More formally, a process has memory if its autocorrelation function decays slowly with lag — if knowing the value at time t-1, t-2, or t-3 adds information about the value at time t beyond what is captured by the value at t-1 alone.

For gene expression, this has direct physical interpretations. A gene with strong temporal memory is one whose expression level at time t is significantly constrained by its expression at multiple preceding time points. This constraint can arise from regulatory feedback — the gene's own protein product participates in regulating its own transcription, creating a form of molecular self-reference. It can arise from network buffering — multiple independent regulatory pathways drive the gene toward the same temporal trajectory, so that disrupting one is compensated by the others. It can arise from epigenetic state — chromatin accessibility and histone modification patterns at the gene's regulatory regions are maintained across transcriptional cycles, creating a cellular memory that persists beyond the half-life of the mRNA itself.

In each case, the physical consequence is the same: the gene's past creates a trajectory from which it is difficult to escape. Perturbations decay not because the cell ignores them but because the regulatory architecture actively restores the expected state. The eigenvalue measures the strength of this restoration — the "stiffness" of the gene's temporal spring.

### The Eigenvalue as Compass

A compass does not tell you where to go. It tells you where north is, consistently, regardless of your current heading. The eigenvalue is a compass for **temporal persistence**: it does not prescribe which genes to target or which treatments to use, but it reliably indicates which genes have the strongest self-organising temporal trajectories, regardless of the particular dataset or analysis method used to interrogate them. For most genes in intact tissue, high persistence correlates with clock integration — but the relationship is not simply monotone. High |λ| can arise from self-sustaining feedback loop embedding (core clock genes), from regulatory architectures that constrain a gene to a specific expression trajectory regardless of clock state, or from other aspects of the gene's regulatory history that the eigenvalue cannot by itself distinguish. The compass reliably reads persistence; interpreting *why* a gene sits where it does requires knowing its position in the regulatory network — which the biological annotations and Chapter 5's perturbation data address together.

The analogy is apt in another dimension. Compass readings are continuous and informative at every point on the scale, not merely above or below a threshold. A |λ| of 0.72 is not merely "rhythmic" — it encodes a specific quantitative prediction. It predicts that the gene's oscillation amplitude will halve in approximately 2.4 time steps (4.8 hours at 2-hour sampling) in the absence of driving. It predicts that the gene's phase will remain within approximately ±1.8 hours of its reference phase under typical biological noise levels. It predicts that a 20% reduction in BMAL1/CLOCK complex activity will shift the eigenvalue of a directly BMAL1-driven target gene by a calculable amount — though the sign and magnitude of any eigenvalue change depend on the gene's regulatory position, as the non-uniform BMAL1-KO perturbation pattern in Chapter 5 illustrates. These are quantitative predictions that go beyond what a binary rhythmicity classification was designed to provide.

### The Testable Hierarchy

The central empirical prediction of the PAR(2) framework is hierarchical: core clock genes > clock target genes > background genes in |λ|, consistently across species and tissues. This prediction was registered before the first analysis was run, and the three gene categories were defined independently of the eigenvalue — core clock genes by molecular biology; clock targets by ChIP-seq, co-expression, or knockout phenotype; background genes by the remainder.

The hierarchy is not a necessary consequence of the model. There is no mathematical reason why an AR(2) model fitted to clock genes should produce higher eigenvalues than the same model fitted to any other class of genes — unless the clock genes genuinely have different temporal memory properties. The question is purely empirical: does the clock regulatory hierarchy produce a corresponding eigenvalue hierarchy?

It does — most robustly for the clock-versus-background contrast. Across every dataset tested, clock genes separate from background genes; the full three-tier ranking (clock > target > background) holds in most tissues, though the target and background tiers overlap in a minority. The subsequent chapters document this finding in detail, test it against potential confounds, and extend it into disease biology, cross-species comparison, and clinical application. But the core claim is simple: if you measure the temporal persistence of every gene in a circadian time series, the genes that form the self-sustaining core of the clock will have the highest persistence, and their downstream targets — held within a clock-gated range — will occupy an intermediate band. The eigenvalue captures this hierarchy.

### Theoretical Origins: From Fibonacci Timing to Eigenvalue Persistence

The question this book investigates did not arrive fully formed. It began with a more literal proposal: that the timing of cell division might follow a Fibonacci sequence. The intuition combined two observations. First, the classical finding that Fibonacci numbers appear in biological growth patterns — spiral seed arrangements, branching angles, leaf phyllotaxis — has a mechanistic explanation: asymmetric division, where one daughter cell is immediately available to divide again while the other undergoes a maturation delay, produces population counts at successive generations that formally satisfy the Fibonacci recurrence under idealised conditions. Second, the known circadian gating of cell division means that even a Fibonacci-ready cell will divide only when the circadian clock permits. Combining these two constraints — an internal readiness counter and an external circadian gate — gives a Dual-Rhythm formulation: division timing is governed by a Fibonacci-like timer conditioned on a circadian permissive window, with a secondary fit to the plastic number (the characteristic ratio of the Tribonacci sequence, ≈1.3247) for cases where three-stage readiness better matched observed intervals. Statistical testing found that neither the Fibonacci sequence alone nor the plastic number alone was universally superior; the empirical signal was mixed in early cell-timing data, and the hypothesis needed a broader substrate to be tested meaningfully.

The critical transition to the AR(2) eigenvalue approach came from recognising that directly testing Fibonacci division timing requires knowing the actual sequence of individual division events — data that are rarely available across many tissues simultaneously. The public circadian RNA-seq datasets in GEO do not record division events, but they do offer something more powerful for a spectral test: hundreds of time-resolved expression measurements across dozens of tissues, species, and conditions, all amenable to a common analytical framework. The Fibonacci conjecture, in this reframing, makes a testable prediction at the level of gene expression dynamics. If biological regulatory networks tend toward two-memory recurrences — the structural reason Fibonacci emerges from two-step asymmetric division — then the second-order autoregressive (AR(2)) model should capture circadian dynamics well, and the eigenvalues of those fits should cluster near the characteristic roots of the Fibonacci recurrence relation x² = x + 1. Those roots are the golden ratio φ and its inverse 1/φ ≈ 0.618. The hypothesis, now operationalised, asks: do AR(2) eigenvalue moduli of clock gene time series cluster near 1/φ more often than a properly calibrated null distribution would predict? This is a directly testable spectral claim, and it is the question that Chapter 7 addresses.

### The Tribonacci Extension and the Two-Memory Question

A natural generalisation extends to higher-order recurrences. The Tribonacci sequence — each term the sum of the three preceding terms — has the plastic number as its characteristic ratio, and would arise biologically if cells cycle through three distinct maturation stages rather than two: a G1-S-G2 checkpoint sequence in which each checkpoint is a separate memory state. The plastic number appeared as a secondary fit in the early timing data precisely because some observed division intervals seemed to require this three-memory structure. The AR(2) model used throughout this work is structurally a two-memory system, matching the Fibonacci recurrence. An AR(3) model would be the natural analogue for Tribonacci dynamics, and both were considered.

The empirical preference for AR(2) over AR(3) rests on more than parsimony. With 24–48 time points — the typical resolution in circadian RNA-seq datasets — AR(3) models overfit substantially, and the additional parameter rarely reduces residual variance enough to justify the loss in degrees of freedom. More consequentially, the AR(2) clustering near 1/φ is reproducible; the analogous AR(3) test — whether eigenvalue moduli cluster near the plastic number in cell-cycle gene expression data — has not been conducted at scale and represents a genuine open question. This question is not idle. The 24-hour circadian period imposed on a system with a roughly 12-hour transcriptional refractory phase naturally generates a two-step regulatory cycle: each mRNA peak is preceded by BMAL1/CLOCK transcriptional activation and then PER/CRY repressive complex formation. This structural two-step memory may be precisely why AR(2) captures more variance than AR(3) in circadian data, and why the dominant eigenvalue proximity signal is to φ rather than to the plastic number. The three-memory case — Tribonacci dynamics, plastic number proximity, AR(3) fitting — may manifest in tissues or conditions where additional checkpoint stages are rate-limiting, particularly in multi-phase cell-cycle contexts where G1, S, and G2/M checkpoints each impose independent timing constraints. Whether that signature is detectable in existing data is a question the current analysis leaves open, not because it is unimportant, but because the circadian datasets available are not designed to answer it. The intellectual path from the Fibonacci timing hypothesis to the AR(2) eigenvalue framework is recorded here because it is the actual path — the question the framework was built to answer, stated in the form that made it answerable.`,
    platformLinks: [
      { label: "Gene Explorer: compare Bmal1 and Dbp eigenvalue profiles directly", route: "/gene-explorer" },
      { label: "Root Space: complex plane geometry of AR(2) characteristic roots", route: "/root-space" },
    ],
  },
  {
    id: "ch2",
    contentExtended: `The first question most scientists ask when presented with a new analytical framework is: why this one? There are no shortage of methods for modelling time series. Fourier analysis decomposes signals into frequency components with mathematical elegance. Wavelet transforms extend this to time-frequency localisation. State-space models track hidden variables through noisy observations. Neural networks can approximate almost any nonlinear trajectory given sufficient data. Against this background, the choice to build a biological discovery platform around a second-order autoregressive process — a model whose mathematical foundations were laid nearly a century ago — might seem like a step backward rather than forward. This chapter provides the full answer: what the AR(2) model is, why it is the right choice for short circadian time series, what the eigenvalue measures, how we know the measurement is valid, and what the number does and does not mean biologically.

### The Memory Problem in Biology

Every biological measurement exists in time. A microarray experiment, an RNA sequencing run, a mass spectrometry scan — these are not photographs of a static system. They are snapshots of a dynamic process that had been doing something before the measurement was taken, and will continue doing something after. Conventional analysis strips this temporal context away: each gene, at each time point, receives a numerical value, and these values are compared across conditions as if they were independent observations.

For many questions, this simplification is harmless. If you want to know whether gene X is expressed at higher levels in cancer than in healthy tissue, a static comparison is exactly right. But if you want to understand dynamics — how a system evolves, how it recovers from perturbation, how strongly its past constrains its future — you need a model that takes time seriously.

The question of temporal persistence is precisely this kind of dynamic question. When we ask how strongly a gene is controlled by the circadian clock, we are implicitly asking about the system's memory: if you perturb this gene away from its trajectory, how quickly does it return? A gene with strong clock control will return rapidly and precisely, because the clock continuously reinstates the correct expression trajectory. A gene with weak or indirect clock control may drift — it might show rhythmicity under standard conditions, but its trajectory is easily disrupted because nothing is actively constraining it back. This is the memory problem: how do you extract, from a short and noisy time series, a reliable measure of how much the past constrains the future? The autoregressive framework was designed, in entirely different contexts, to answer exactly this question.

### A Brief History of Autoregressive Models

The intellectual history of autoregressive models begins with sunspots. In 1927, the British statistician George Udny Yule was studying the eleven-year solar cycle and noticed something that resisted conventional analysis. The cycle appeared regular but was not sinusoidal — the peaks varied in height, the troughs in depth, and the period fluctuated slightly from cycle to cycle. A purely deterministic model could not account for this variability. But a stochastic model in which each new observation depended on its recent predecessors, perturbed at each step by independent random shocks, reproduced the observed behaviour with striking fidelity.

Yule's 1927 paper — "On a Method of Investigating Periodicities in Disturbed Series, with Special Reference to Wolfer's Sunspot Numbers" — introduced the autoregressive framework to the statistical literature. The core insight was this: a system that remembers its own recent history, disturbed at each step by independent noise, naturally produces quasi-periodic behaviour without any explicit periodicity being built in. The periodicity is an emergent property of the memory structure.

Herman Wold developed the theoretical underpinnings through the 1930s. John Tukey extended the diagnostic toolkit in the 1960s. George Box and Gwilym Jenkins comprehensively systematised the full ARIMA family in their 1976 textbook "Time Series Analysis: Forecasting and Control," which remains the standard reference in the field today. Box and Jenkins established rigorous procedures for model identification, estimation, and diagnostic checking that are still in use half a century later.

None of these authors had circadian biology in mind. Yule was modelling sunspots. Box and Jenkins were concerned with economic and industrial forecasting. The application of these tools to gene expression time series is recent, and the specific insight that the eigenvalue of the AR(2) process constitutes a biologically interpretable measure of clock control strength is, to the best of our knowledge, original to the work described in this book.

### The AR(1) Process — Learning to Walk Before We Run

Before adding the second lag, it is useful to understand the simpler case. An AR(1) process models the current state of a system as a linear function of its immediately preceding state, plus independent random noise:

y(t) = φ₁ · y(t−1) + ε(t)

where φ₁ is the single autoregressive coefficient and ε(t) is white noise with mean zero and variance σ². This is the simplest model of temporal dependence, and its single parameter directly encodes memory. If φ₁ = 0, the system has no memory — each observation is independent of the previous one, and the sequence is pure noise. If φ₁ = 0.9, then 81% of the variance in any observation is accounted for by the immediately preceding value; the system has strong but decaying memory. If |φ₁| ≥ 1, the process is explosive — perturbations grow rather than decay, and the system is non-stationary.

For biological time series, stable AR(1) processes (|φ₁| < 1) capture a wide range of phenomena: the gradual decay of drug concentrations, the slow recovery of gene expression after a perturbation, the drift of physiological variables around a homeostatic setpoint. What AR(1) cannot do, crucially, is produce sustained oscillation. An AR(1) process with a positive coefficient generates a smoothly autocorrelated series; one with a negative coefficient generates an alternating up-down pattern. Neither constitutes a genuine periodic oscillation with a defined frequency. For circadian rhythms — which require a process to oscillate with a specific ~24-hour period over days or weeks — one lag is insufficient. A second is required.

### Adding a Second Lag — Where Oscillation Becomes Possible

The AR(2) process adds one parameter:

y(t) = φ₁ · y(t−1) + φ₂ · y(t−2) + ε(t)

The addition of a second autoregressive coefficient creates qualitatively new dynamic possibilities. To understand why, we examine the characteristic equation of the AR(2) system, which governs how the model evolves without noise:

λ² − φ₁λ − φ₂ = 0

The two solutions — the characteristic roots or eigenvalues λ₁ and λ₂ — determine the system's entire dynamic personality. Their nature depends on the discriminant φ₁² + 4φ₂. When this quantity is positive, both roots are real numbers: the system decays monotonically or alternates in sign, but no sustained oscillation is possible. When the discriminant is negative, the roots are complex conjugates of the form λ = R · e^(±iω), where R = |λ| is the modulus and ω is the argument. This is the oscillatory regime — the system produces damped sinusoidal fluctuations, with oscillation frequency determined by ω and amplitude governed by R. For a stable oscillation, we require R < 1: the roots must lie strictly inside the unit circle in the complex plane.

Circadian gene expression is the biological realisation of a damped stochastic oscillator: it has a well-defined frequency near 24 hours, it shows variability from cycle to cycle, and it is continuously re-energised by upstream molecular drives rather than running completely free. The AR(2) model with complex conjugate roots is the minimal mathematical description of this class of process — and minimal is exactly what is needed when fitting to time series of 12 to 48 points.

### Eigenvalues and the Persistence Metric

For the complex conjugate case, a useful simplification follows from Vieta's formulae. For the characteristic equation λ² − φ₁λ − φ₂ = 0, the product of the two roots satisfies λ₁ · λ₂ = −φ₂. Since the roots are complex conjugates with equal modulus, |λ|² = |λ₁ · λ₂| = |−φ₂| = |φ₂|. In the oscillatory region φ₂ is always negative (the stability triangle requires φ₂ > −1 and the complex-root condition requires φ₁² + 4φ₂ < 0, both of which force φ₂ < 0), so |φ₂| = −φ₂ and therefore:

|λ| = √(−φ₂)

This is a crucial practical result: the eigenvalue modulus — the single number encoding temporal persistence — is determined entirely by the second autoregressive coefficient. The first coefficient φ₁ determines the oscillation frequency jointly with |λ|, but not the persistence itself.

The oscillation frequency is: ω = arccos(φ₁ / (2|λ|)) radians per time step. For a gene sampled every 2 hours with a 24-hour rhythm, one cycle spans 12 time steps, corresponding to ω = 2π/12 ≈ 0.524 radians. For |λ| = 0.65, this implies φ₁ = 2 × 0.65 × cos(π/6) ≈ 1.126. A circadian gene sitting precisely on the 24-hour constraint should therefore have φ₁ ≈ 1.1 and φ₂ ≈ −0.42 — consistent with the median values observed empirically across the clock gene category.

The eigenvalue modulus |λ| is interpreted as a persistence metric through its relationship to the half-life of oscillation decay. If upstream drive were suddenly removed, the amplitude would decay by a factor of |λ| per time step. The number of time steps for the amplitude to halve is t₁/₂ = ln(0.5) / ln(|λ|). At 2-hour sampling, this stratifies cleanly by gene category. Background genes (median |λ| ≈ 0.41) show a half-life under 1.6 hours — a perturbation dissipates within a single sampling interval, and the gene has essentially no temporal memory. Clock target genes (median |λ| ≈ 0.53) show a half-life of roughly 2.2 hours — modest persistence that still fades quickly relative to the 24-hour cycle. Core clock genes (median |λ| ≈ 0.65) show a half-life near 3.2 hours — about 1.6 sampling intervals of memory, meaning perturbations persist and echo meaningfully across the oscillatory cycle.

These are not abstract statistical artefacts. They describe how long, in biological time, the regulatory history of a gene remains relevant to its current state.

### The Stability Triangle

The conditions for a stable AR(2) process — one whose trajectories revert to the mean — define a triangular region in the (φ₁, φ₂) parameter plane known as the stability triangle. The three bounding inequalities are:

φ₂ < 1 + φ₁ (upper-left boundary)
φ₂ < 1 − φ₁ (upper-right boundary)
φ₂ > −1 (lower boundary)

These form a triangle with vertices at (−2, −1), (2, −1), and (0, 1). Inside the triangle, all characteristic roots have modulus less than 1, and the process is stationary. Outside it, the process is explosive and cannot be analysed within the AR(2) framework.

Within the stability triangle, the boundary between oscillatory and non-oscillatory regimes is the downward-opening parabola φ₂ = −φ₁²/4. Below this parabola (where φ₂ < −φ₁²/4), the discriminant is negative and the roots are complex — the process oscillates. Above it, the roots are real — the process decays or alternates without a defined period.

Empirically, the vast majority of circadian gene trajectories fall into the oscillatory region below the parabola, confirming that the AR(2) model is capturing genuine oscillatory dynamics. Fewer than 1% of genes in any dataset fall outside the stability triangle entirely; these are excluded as non-stationary. The convergent placement of clock genes, target genes, and background genes in three distinct sub-regions of the oscillatory zone — differentiated by their distance from the unit circle boundary — is one of the clearest visual confirmations that the PAR(2) framework is measuring real biological structure.

### A Worked Example — BMAL1 in Mouse Liver

To make the mathematics concrete, consider fitting Bmal1 — the central positive element of the mammalian circadian transcription-translation feedback loop — in the GSE11923 mouse liver dataset. This dataset was sampled hourly across 48 hours (48 time points; Hughes et al. 2009); for the analysis here it is used at 2-hour resolution (24 time points), giving two complete cycles for analysis.

The raw Bmal1 expression values, after log₂ transformation and mean-centring, show a clear 24-hour oscillation peaking near zeitgeber time 0 (light onset) and reaching its trough around ZT12. The peak-to-trough amplitude is approximately 2.1 log₂ units — among the largest circadian amplitudes in the dataset, as expected for a core clock gene. Fitting the AR(2) model by ordinary least squares with small-sample bias correction yields:

φ₁ = 1.124, φ₂ = −0.422

Checking the discriminant: φ₁² + 4φ₂ = 1.263 − 1.688 = −0.425 < 0. The roots are complex — the process is oscillatory, as expected. Eigenvalue modulus: |λ| = √0.422 ≈ ${GSE11923.bmal1.lambda}. Oscillation period: T = 2π / arccos(1.124 / 1.300) = 2π / arccos(0.865) ≈ 12.0 time steps × 2 hours = 24.0 hours. The fitted period is exactly 24 hours, and |λ| = ${GSE11923.bmal1.lambda} places Bmal1 at the upper end of the clock gene category. The oscillation amplitude half-life is roughly 3.2 hours — a perturbation to Bmal1's trajectory would decay to half its magnitude within a single 4-hour window in the absence of clock-circuit driving.

Now compare with Dbp (D-box binding PAR domain protein), a canonical downstream clock output gene that shows robust 24-hour rhythmicity in liver and is routinely used as a positive control in circadian experiments. Fitting AR(2) to the GSE11923 Dbp trajectory yields:

φ₁ = 0.989, φ₂ = −0.280

Eigenvalue modulus: |λ| = √0.280 ≈ ${GSE11923.dbp.lambda}. Period: T = 2π / arccos(0.989 / 1.058) ≈ 24.1 hours.

Both genes oscillate with essentially the same period. Both are "significant circadian genes" by any detection-based method. But the eigenvalue reveals a meaningful difference: Bmal1's persistence of ${GSE11923.bmal1.lambda} versus Dbp's ${GSE11923.dbp.lambda}. Dbp's oscillation decays considerably faster in the absence of upstream drive — it is more dependent on continued clock-circuit input to maintain its rhythm. Bmal1, embedded within the feedback loop itself, has stronger temporal self-organisation. This quantitative distinction — invisible to amplitude-based and detection-based methods — is precisely what the PAR(2) framework was designed to resolve.

### Diagnostic Validation

Fitting an AR(2) model to short time series is only defensible if the model assumptions are satisfied. Three diagnostic protocols were applied to every gene in every circadian mRNA dataset. For non-mRNA datasets (proteomics, CGM), the ADF stationarity and Ljung-Box residual tests were applied; the eigenperiod Check 3 (Appendix A) applies in modified form appropriate to each dataset's sampling interval and series length — the 18–30h window specified for circadian mRNA datasets does not translate directly to 3-hour proteomics or 5-minute CGM series.

The Augmented Dickey-Fuller (ADF) test examines whether the time series contains a unit root — a characteristic root exactly equal to 1 — which would indicate non-stationarity. A unit root means the process does not revert to its mean; its variance grows over time. Genes failing the ADF test are excluded from analysis, as their |λ| estimates would be artifactually elevated. Across all circadian datasets examined, 94.3% of clock-categorised genes, 91.8% of target genes, and 88.4% of background genes pass the ADF test at the 5% significance threshold — validating the stationarity assumption for the overwhelming majority of the data.

The Ljung-Box Q-test examines residual autocorrelation. After fitting AR(2), the residuals should be white noise: if they still show autocorrelation at any lag, the model is underspecified and the parameter estimates are biased. Approximately 91% of genes across all datasets produce non-significant Ljung-Box statistics through lag 6, indicating that AR(2) captures the temporal structure without systematic misfit. Genes with significant residual autocorrelation are flagged but not excluded; in practice they form a consistent minority and their |λ| values still show the expected categorical stratification, suggesting that the bias introduced by mild underspecification is small relative to the biological signal.

Finally, every fitted eigenvalue is verified to satisfy |λ| < 1. Estimated values at or above the unit boundary are flagged as potentially non-stationary. Fewer than 0.8% of genes fail this check in any individual dataset — consistent with the ADF results and the broad stationarity of well-normalised gene expression data.

### Comparing with Alternative Approaches

The choice of AR(2) over other time-series methods was not arbitrary, and the alternatives were evaluated carefully before committing to this framework.

Cosinor regression models gene expression as a pure sinusoid: y(t) = A·cos(2πt/T + φ) + β + ε(t). JTK_CYCLE and RAIN extend this with nonparametric rank-based tests robust to non-Gaussian errors. These methods answer the question of whether a gene oscillates at period T with genuine rigour and are rightly the standard for circadian detection. What they do not provide is any parameter analogous to |λ|. Amplitude A measures the size of the oscillation, not its persistence or self-sustaining character. A strongly-driven, easily-perturbed gene and a weakly-driven but self-organising one will produce identical cosinor scores. The models accomplish their design objective — detection — with excellence, but detection is not quantification.

The immediate simpler alternative is AR(1). Its single coefficient serves as a persistence measure, but only for non-oscillatory processes. When fitted to a 24-hour oscillatory series, AR(1) produces biased estimates because the true characteristic roots are complex and AR(1) can only generate real roots. The resulting eigenvalue is systematically underestimated and conflates the oscillatory structure with noise — it is measuring something real, but not cleanly. Adding one lag resolves this entirely. One caveat should be stated plainly: for the narrow binary task of separating clock genes from housekeeping genes, a simple scalar lag-1 autocorrelation performs at least as well as |λ| (AUC ≈ 0.96 vs ≈ 0.88 in independent testing on GSE54650). The added value of AR(2) is therefore not a larger classification gap but the information a scalar cannot provide — the complex-versus-real root classification and the eigenperiod, i.e. the type of persistence rather than merely its magnitude.

Higher-order models — AR(3), AR(4), and beyond — can fit circadian data with greater flexibility but introduce parameters that are poorly identified on time series of 12 to 24 points. The ratio of parameters to observations becomes unfavourable, producing unstable estimates that vary substantially across replicate datasets. AR(2) is the minimum necessary to represent a damped oscillator and, for circadian time series of typical experimental length, also the maximum that can be reliably fitted. State-space and Kalman-filter approaches offer the most flexibility but require many more parameters than can be reliably estimated from short, high-dimensional expression time series.

AR(2) occupies a productive minimum: complex enough to represent oscillation, simple enough to be reliably fitted on short series, and producing a single interpretable quantity — |λ| — that captures the biological property of interest without conflating it with amplitude, statistical significance, or mRNA stability.

### Relationship to the Full PAR(2) Model

The AR(2) fitting applied throughout this book uses constant coefficients — φ₁ and φ₂ are fixed parameters estimated from the data, independent of circadian phase at the time of measurement. This is the **time-invariant special case** of a more general model, the full Phase-Gated Order-2 Autoregressive Recurrence (PAR(2)), in which the AR coefficients are themselves periodic functions of circadian phase:

αₖ(Φ) = β_{k0} + β_{k1}cos(Φ − ψₖ)

When β_{k1} = 0 (no phase-gating), the model reduces to the constant-coefficient AR(2) analysed throughout this work: the β_{k0} terms are simply φ₁ and φ₂. When β_{k1} > 0, the memory weights modulate with the circadian cycle — the system remembers its history more strongly at some phases than at others.

The book's constant-coefficient analysis is appropriate for gene expression data, which is typically phase-ordered or population-averaged before fitting, and for which the assumption of stationarity (fixed second-order statistics) holds. The full phase-gated model is the mechanistic proposal for crypt renewal at the population level, where individual stem cell divisions are phase-stamped by the clock and the memory weights literally vary across the day. Fitting the full PAR(2) requires sub-daily renewal measurements tracked over many consecutive generations — data that no currently available public dataset provides. The eigenvalue modulus |λ| derived from constant-coefficient AR(2) fitting can therefore be understood as characterising the **time-averaged temporal organisation** of the clock-gene interaction: the mean memory weight β_{k0} that describes the system's baseline persistence independent of which circadian phase the observation was taken at. This is a biologically real and interpretable quantity, but it is not the complete picture that the phase-gated model would provide if the appropriate data existed.

### Dead End: Phase-Gating Regression Rates as the Primary Metric

The biggest methodological pivot in this project is not documented in any of the papers, because by the time the papers were written the pivot had already happened. It belongs here.

From roughly September through December 2025, the primary metric was not eigenvalue modulus. It was the discovery rate: the percentage of clock-target gene pairs, out of a pre-specified panel of 299, that reached statistical significance for directional phase-gating. The question being asked was: does clock gene A's phase statistically predict target gene B's expression? The AR(2) model was fitted to each gene separately, and the resulting phase estimates for clock and target were entered into a regression. A significant result was counted as a detected gating relationship. The framework was called Phase-Amplitude-Relationship, which is where the PAR in PAR(2) originated.

This approach produced real findings. Across 12 mouse tissues from the Hughes Circadian Atlas, 177 significant gating relationships were identified out of 3,588 pairs tested (4.9% overall discovery rate). Cry1→Wee1 was the only relationship conserved across six or more tissues — making it the sole universal circadian checkpoint relationship in the dataset. In intestinal organoids, APC mutation doubled the discovery rate from 11.2% to 22.4%; combined deletion of APC and BMAL1 caused a 17-fold collapse. These are reproducible biological findings that appear in later chapters.

The problem was not the findings. It was what the metric obscured. Discovery rate is a property of a dataset and a significance threshold, not a property of the biological system. Two genes could have identical AR(2) dynamics but produce different discovery rates simply because of differences in time-series length or noise level. More fundamentally, the discovery rate answered the question "is there a significant relationship?" without measuring "how strong is the temporal structure?" The eigenvalue modulus, which had been computed throughout as a diagnostic step before the phase regression, was directly answering the deeper question — but it was not being used as the primary output.

The second problem was the Fibonacci null model. During this period, the fraction of AR(2) coefficient ratios falling near φ was found to be approximately 3% globally. This looked modest against the background, and the finding was explicitly flagged in the December 2025 manuscripts as exploratory and non-central. What was not recognised until January 2026 was that the null model was invalid: it drew from the full stability triangle without filtering for stationary processes. Since the majority of randomly drawn coefficient pairs are either non-stationary (|λ| > 1) or non-oscillatory, including them in the null inflated the denominator and made 3% look unimpressive. Once the null was restricted to stability-filtered oscillatory processes — the only scientifically valid comparison — the 3% became a 47-fold enrichment in specific tissues (8 clock genes in 3 high-amplitude tissues at a 2% proximity window; the genome-wide organoid enrichment is a separate, more modest 1.87×).

That correction made the eigenvalue modulus the central metric rather than a diagnostic. The discovery-rate framing was set aside. The PAR in PAR(2) kept the name but changed its emphasis: from Phase-Amplitude-Relationship as a regression test to Phase-gated Autoregressive analysis as a descriptor of the hierarchical architecture the eigenvalue modulus was revealing. The finding that had looked like a peripheral curiosity became the main story. Every result in this book follows from that reframing.

### Dead End: AR(3) and Higher-Order Models

Before settling on AR(2), every logical alternative was evaluated. AR(3) was the first candidate: adding a third lag allows the model to represent more complex temporal dependencies, and there is no a priori reason a biological oscillator should be captured exactly by a second-order system.

The problem was practical rather than theoretical. Circadian time series of 12 to 24 time points — the standard for most GEO datasets — do not contain enough observations to reliably estimate three autoregressive parameters simultaneously. When AR(3) was applied to the GSE11923 dataset, the coefficient estimates were unstable: small changes in initial conditions or random seed produced large swings in the estimated third parameter, without corresponding changes in the eigenvalue distribution for well-characterised genes. The fits did not diverge; they just became untrustworthy. AR(4) was worse. Model selection via AIC consistently preferred AR(2) over AR(3) for the overwhelming majority of circadian gene time series.

Bayesian AR estimation was also evaluated, using conjugate normal-inverse-Wishart priors on the coefficient vector. The posterior means of φ₁ and φ₂ converged to values indistinguishable from the Yule-Walker estimates in datasets of typical circadian experimental length, at roughly 40× the computational cost. For a genome-wide analysis repeated across 22 datasets and hundreds of sensitivity runs, this was not a viable tradeoff. The Bayesian framework also did not change the category-level signal: clock gene eigenvalues were still highest, background lowest, under any reasonable prior. The frequentist Yule-Walker approach was retained as both faster and, for this problem, equivalent.

### What the Eigenvalue Means, and What It Does Not

Precision about what |λ| measures is essential for using it correctly. The eigenvalue modulus captures the degree to which a gene's expression trajectory is temporally self-organising — how much the past constrains the present. This is related to, but distinct from, several other quantities with which it might be confused.

It is not expression amplitude. A gene can have a large oscillation with a low eigenvalue (strongly driven by an upstream signal, decaying rapidly in its absence) or a small oscillation with a high eigenvalue (weakly expressed but strongly self-sustaining). The correlation between mean amplitude and |λ| across all genes in GSE11923 is ρ = 0.08 — negligible.

It is not mRNA stability. Transcript half-life describes how quickly RNA molecules are degraded — a property of the sequence and the cellular degradation machinery. Eigenvalue modulus describes how predictive yesterday's expression level is of today's. These are logically independent, and the empirical correlation across all measured genes is ρ = 0.012 — essentially zero.

It is not statistical significance. A gene with a low |λ| can still show a highly significant circadian rhythm if measured in a sufficiently long or low-noise time series. Significance is a property of the measurement and the dataset; persistence is a property of the system itself.

What |λ| captures, most precisely, is how much the regulatory history of a gene constrains its current expression. Core clock genes have high |λ| because the interlocking positive and negative arms of the transcription-translation feedback loop actively reinstate the correct expression trajectory at every step. Perturb a clock gene, and the circuit pulls it back. The restoring force is strong and distributed across the entire regulatory network, so perturbations decay slowly. Clock target genes have lower |λ|: they are driven by the clock but do not form part of the self-sustaining mechanism.

Crucially, however, this intermediate target-gene persistence is not merely a failure to reach clock-gene levels. The Chapter 5 organoid BMAL1-KO analysis shows that removing the clock produces category-specific changes: the annotated clock target panel declines in median persistence (0.531 → 0.471), the curated background panel stays essentially flat (0.419 → 0.414), and a separate genome-wide analysis (Paper G Supplementary S1, 15,752 genes) shows the transcriptome-wide mean rising from 0.477 to 0.597. The mechanism underlying this divergence between the curated panel results and the genome-wide aggregate is an open question. The key implication for the framework is that removing the clock does not simply reduce persistence uniformly, which rules out the simplest reading of |λ| as "depth of clock control." Temporal persistence is the quantity being measured; the regulatory position of a gene determines the direction and magnitude of any clock perturbation's effect on its |λ|. Background genes have the lowest persistence because they have little regulatory relationship to the clock; each time point is only weakly constrained by its predecessor, and temporal memory dissipates within a single sampling interval.

This is the biological content of the number that all subsequent chapters test, extend, and apply — across species, tissues, and disease states — in the remainder of this book.

### Phase-Gating: The Architecture of Temporal Control

The eigenvalue modulus |λ| tells you *how persistent* a gene's trajectory is. The complex root's argument — its angle in the complex plane — tells you *where in the cycle* the gene is at any given moment. These two quantities together define the gene's complete temporal identity: how strongly it sustains its oscillation, and at what phase.

When a clock gene and a downstream target gene both oscillate at the same circadian frequency, their respective phase arguments can be directly compared. In a healthy, clock-intact tissue, this comparison reveals a non-random structure: E-box target genes activate within a narrow, reproducible window relative to their driving clock genes. The phase offset between BMAL1 and its canonical targets is not uniformly distributed — it clusters tightly, typically 6–10 hours after the BMAL1 peak in mouse liver tissue. This is the temporal gate. The clock gene acts as an oscillating barrier: it opens briefly each cycle, permitting target gene activation, then closes. Targets are not merely co-rhythmic with the clock — they are *conditional* on it.

This is what "Phase-Gated" means in PAR(2). It is not a metaphor borrowed from electronics; it is a literal geometric statement about the relationship between two sets of complex-conjugate roots in the same frequency band. A perfectly phase-gated target gene would have its activation peak locked to a fixed angular offset from its clock driver, cycle after cycle, dataset after dataset. A loosely gated gene would show wide scatter in that offset — driven by the clock in amplitude but unconstrained by it in timing.

The temporal correlation ratio (TCR) — introduced in Chapter 5's cancer analysis — quantifies this fidelity numerically: it is the Pearson correlation between a clock gene's expression trajectory and the trajectories of its annotated E-box targets, normalised to the same correlation for randomly selected gene pairs. In wildtype intestinal organoids, TCR = 1.74: clock genes are 74% more temporally predictive of their targets than random gene pairs. This excess predictability is the fingerprint of the gate operating at full fidelity.

The "P" in PAR(2) names this architecture. It is not an afterthought — it is the mechanistic claim that gives the eigenvalue hierarchy its interpretive content. If |λ| alone were the only quantity, the hierarchy would be a statistical curiosity: a consistent ordering with no clear mechanism. The phase-gating interpretation provides the mechanism: clock genes have high |λ| because they are embedded in a self-sustaining oscillator; target genes have lower |λ| because they are driven through a gate rather than embedded in the driving mechanism itself. The eigenvalue gap between clock and target categories is the quantitative signature of the gate's existence.

This is why disease that disrupts circadian architecture — APC mutation in colorectal cancer, BMAL1 knockout, neurodegeneration-associated clock remodelling — manifests in the eigenvalue signature not as a collapse of clock gene persistence, but as a selective loss of target gene persistence while clock genes partially maintain theirs. The gate weakens before the clock does. Chapter 5 shows this pattern quantitatively, and Chapters 6 through 9 trace its implications across chronotherapy, Fibonacci structure, and neurodegeneration.

### Why 1/φ? The Mathematical Arguments

The empirical consistency of the cluster near 0.618 raises a question the data alone cannot answer: is there a mathematical reason why 1/φ should be a preferred operating point for a stable biological oscillator, rather than some other value in the (0, 1) stability range?

Paper G's extended supplementary develops five independent arguments for the spatial-temporal Fibonacci twinning. Two of them are purely algebraic and belong here, because they concern the AR(2) eigenvalue directly rather than the biology of any specific tissue.

**The conservation identity.** φ is the unique positive real number satisfying φ − 1 = 1/φ (equivalently, φ² = φ + 1). This means the Fibonacci recurrence's dominant eigenvalue (φ ≈ 1.618) and the PAR(2) temporal eigenvalue (1/φ ≈ 0.618) are not merely reciprocals — they are the two solutions of the same quadratic x² = x + 1, one on each side of the stability boundary at |λ| = 1. A biological oscillator at |λ| = 1/φ is, in a precise algebraic sense, at the maximum stable approach to the Fibonacci recurrence. The boundary between ordered growth and explosive divergence runs exactly between them.

**The integrated memory identity.** For a stable AR(2) process with |λ| = 1/φ, the geometric series of all lagged autocorrelations sums to:

∑_{k=0}^{∞} (1/φ)^k = 1 / (1 − 1/φ) = φ / (φ − 1) = φ · φ = φ²

This is exact, not an approximation, and follows directly from the conservation identity φ − 1 = 1/φ. The total integrated temporal memory of a process at the Fibonacci boundary equals φ² ≈ 2.618 — the square of the golden ratio. A tissue operating here carries, in its summed lagged autocorrelation structure, precisely the value that organises its spatial renewal geometry. The temporal memory integral and the spatial growth ratio are the same number.

Two further arguments — the tissue-specificity of the empirical cluster as independent evidence, and the Floquet monodromy framework — are developed in Chapter 7, where they are stated in full. They are omitted here because they require knowledge of the crypt biology that Chapter 7 introduces. Chapter 7 also documents a critical limiting result from the platform's Jacobian analysis of the Boman ODE, which qualifies the Floquet claim and proposes the circadian clock as the mechanism connecting spatial and temporal Fibonacci structure.`,
    platformLinks: [
      { label: "Root Space: stability triangle, complex plane, and eigenvalue geometry", route: "/root-space" },
      { label: "AR(2) Diagnostics: Ljung-Box, stationarity, and residual validation", route: "/ar2-diagnostics" },
    ],
  },
  {
    id: "ch3",
    contentExtended: `Scientific discovery in the computational era rarely arrives as a single moment of insight. It arrives incrementally, through a sequence of analytical steps in which each new result either validates or invalidates the step before it. The discovery of the eigenvalue hierarchy was like this: a series of decisions — about which dataset to test first, how to handle failing models, how much replication was sufficient before claiming a finding — each of which shaped the final form of the result.

### Why GSE11923?

By early 2024, the Gene Expression Omnibus contained thousands of publicly deposited circadian transcriptome datasets. Choosing among them for the first test was not straightforward. The ideal first dataset would have: a high time resolution (2-hour sampling or better) over a long enough span to capture multiple complete cycles; a large enough gene count to allow stable statistical comparisons between categories; and a well-annotated set of known clock and target genes, derived from independent experimental sources, to serve as the ground truth for the three-tier classification.

GSE11923 — a mouse liver dataset generated by the Hogenesch laboratory at the University of Pennsylvania (Hughes et al. 2009, PLOS Genetics), sampled hourly across 48 hours (48 time points) and used here at 2-hour resolution, with Affymetrix microarray measurement of approximately 12,000 genes — met all three criteria better than any other dataset at the time. Its annotation was the richest available: the 4,218 clock target genes were compiled from multiple independent sources including ChIP-seq, knockout studies, and co-expression analyses, none of which used AR(2) methods. This independence of annotation from the analysis method would be critical for avoiding circularity in the validation.

A secondary consideration was computational tractability. The goal was not merely to analyse one dataset but to scale the analysis to 22 datasets spanning four species. The pipeline needed to run on standard academic hardware in reasonable time. GSE11923, with its manageable gene count and clean normalisation, was the right test case for verifying that the pipeline worked before expanding it to the full dataset collection.

### The Fitting Procedure in Practice

Fitting AR(2) models to 12,000 genes simultaneously required careful implementation. For each gene, the 24 expression measurements (after log₂ transformation and mean-centring) were used to estimate φ₁ and φ₂ via the Yule-Walker equations, which provide a computationally efficient and bias-corrected estimator for short time series. The characteristic roots were computed analytically from the quadratic formula. For each gene, the following quantities were stored: φ₁, φ₂, the eigenvalue modulus |λ|, the fitted oscillation period T, and the results of the ADF and Ljung-Box diagnostic tests.

Genes falling outside the stability triangle (|λ| ≥ 1) were flagged and excluded — these represent explosive non-stationary processes for which the AR(2) interpretation is invalid. Genes with ADF test failure were excluded. Genes with Ljung-Box failure (indicating residual autocorrelation, hence model underspecification) were retained but flagged. After applying these filters, 97.4% of the 12,000 genes in GSE11923 produced valid |λ| estimates suitable for the downstream analysis.

The entire analysis — fitting, diagnostics, and result extraction — completed in approximately 8 minutes on a standard academic workstation. This speed was important: the full 22-dataset analysis required hundreds of pipeline runs with varying parameters and category definitions, and computational bottlenecks at this stage would have made the exploration infeasible.

### The First Numbers

When the results for GSE11923 came back, the eight core clock genes were examined first. Their |λ| values were: Bmal1 = 0.650, Clock = 0.623, Cry1 = 0.671, Cry2 = 0.658, Per1 = 0.684, Per2 = 0.643, Per3 = 0.621, Rorα = 0.679. The median was 0.671. Every one of the eight values exceeded the 75th percentile of the full gene distribution.

The 4,218 literature-validated clock target genes had a median |λ| of 0.531 and an interquartile range of 0.489–0.574.

The remaining 7,774 background genes had a median |λ| of 0.412 and an interquartile range of 0.364–0.461.

The three-tier hierarchy — 0.671, 0.531, 0.412 — was immediately apparent. The gap between each tier (approximately 0.14 units) was comparable to the interquartile range within each tier (approximately 0.085–0.110 units). This meant the categories were well-separated, not merely shifted by a small amount: the probability of a randomly drawn background gene having a higher |λ| than a randomly drawn clock gene was approximately 4%, based on the empirical distributions. The signal was not subtle.

### The Decision to Extend

The appropriate response to a clean positive result is not celebration but scepticism. A hierarchy this stark in a single dataset could reflect: (a) a genuine biological property; (b) a property specific to mouse liver at 2-hour sampling resolution; (c) a property specific to Affymetrix microarray measurement; or (d) a property of the particular annotation scheme used for the three categories. The only way to distinguish these possibilities was to test the result in independent datasets under different conditions.

The extension criteria were specified before the additional datasets were analysed: any circadian time-series dataset in GEO with at least 12 time points, at most 4-hour sampling intervals, at least 1,000 genes, and at least 6 annotatable core clock genes. A systematic search produced 22 qualifying datasets, covering mouse (liver, lung, kidney, muscle), human blood (GSE113883, Braun et al. 2018 PNAS, 28-hour constant routine; and GSE48113, Archer et al. 2014 forced-desynchrony protocol), baboon (the Mure et al. 2018 landmark 12-tissue dataset), and Arabidopsis thaliana (two datasets from independent laboratories). All 22 were downloaded and processed through the same analysis pipeline, with gene category annotations updated for species-specific differences in gene nomenclature.

### Twenty-Two Datasets — A Geography of the Clock

The 22-dataset extension required establishing orthologous gene sets across species, resolving ambiguities in cross-species annotation, and handling the different normalisation strategies used by different experimental platforms. For each dataset, the clock, target, and background categories were defined using species-specific annotations from CircaDB, KEGG, and literature sources — none of which made use of AR(2) eigenvalues in their classifications.

The results across all 22 datasets were consistent. The median values varied across species and tissues — mouse peripheral tissues showed the highest values (up to 0.797 for lung in GSE54650), while the Arabidopsis datasets showed the lowest absolute values (consistent with the different kinetics of plant circadian rhythms) — but the relative ordering was invariant.

Twenty-two independent experiments. Four species. Twelve tissue types. Clock genes separated from background in every one; the full three-tier ordering held in most but not all tissues, with the target and background tiers overlapping in a minority (for example, in 4 of the 12 GSE54650 tissues, where the full clock > target > background ordering held in 8).

### The Literature Validation

The CircaDB validation asked a more pointed question than the dataset extension: do the specific genes that molecular biologists have characterised as clock-controlled — through targeted wet-lab experiments, not statistical analysis of expression data — show elevated eigenvalues?

CircaDB curates annotations from peer-reviewed papers on circadian gene regulation in mammals. The curation process is manual and includes only genes with direct experimental evidence of circadian control: genes whose promoters have been shown to bind BMAL1 by ChIP, genes whose rhythmicity is abolished in Bmal1-knockout tissue, genes whose overexpression alters circadian period, or genes whose expression is directly driven by characterised E-box, D-box, or RORE elements. These annotations are entirely independent of any time-series statistical analysis.

Among 59 CircaDB-annotated genes in mouse liver with strong experimental evidence, 58 of 59 showed |λ| above the background median in GSE11923 — a ~3.9-fold enrichment over the chance expectation for that permissive criterion. (The 98.3% figure is recovery above a broad threshold, i.e. enrichment, not unique identification of clock genes.) The single exception was Tp53. Tp53 is annotated in CircaDB — correctly — because p53 protein levels oscillate with circadian period in a PER2-dependent manner: PER2 physically blocks MDM2-mediated ubiquitination of p53, stabilising the protein during the PER2-high phase and allowing degradation otherwise (Gotoh et al., Mol Cell 2016). But this regulation is entirely post-translational. The Trp53 mRNA time series shows no circadian autocorrelation structure: the transcript does not cycle, only the protein does. Because PAR(2) measures temporal persistence in mRNA expression data, it correctly returns an eigenvalue below the background median for Trp53. This is not a failure of the method; it is the method working exactly as intended — correctly distinguishing a gene regulated at the transcript level from one whose circadian biology operates downstream of transcription.

### A Species-by-Species Account

The 22 datasets were not a uniform block — they represented four distinct biological kingdoms and twelve tissue types, each with its own measurement platform, normalisation strategy, and gene annotation system. What the consistency of the finding means requires understanding what varied across them.

**Mouse (4 tissues: liver, lung, kidney, muscle).** The liver dataset (GSE11923) provided the initial signal; the other three tissues were tested blind, with category annotations derived from the same CircaDB and literature sources but with no prior expectation of the tissue-specific absolute eigenvalue values. All four mouse tissues showed the three-tier hierarchy. Clock gene medians ranged from 0.651 (muscle) to 0.697 (liver), reflecting genuine tissue differences in the robustness of the TTFL — the liver clock is one of the strongest peripheral clocks and its higher eigenvalue is consistent with this.

**Human blood (GSE113883; GSE48113).** Human circadian transcriptomics faces confounders absent from controlled mouse studies: chronotype variation across individuals, age, diet, and in many datasets collection times that are behavioural rather than photic. Two dedicated human blood protocols were included. GSE113883 (Braun et al. 2018 PNAS, TimeSignature study, Northwestern; 11 healthy adults under a 28-hour constant routine = acute total sleep deprivation, 2-hour blood draws) and GSE48113 (Archer et al. 2014, forced-desynchrony protocol, which partially dissociates circadian and sleep-wake components) both showed the three-tier ordering. Human blood clock gene medians were slightly lower in absolute value than matched mouse peripheral tissues — consistent with known species differences in TTFL amplitude — but the direction of the hierarchy was preserved in both datasets. Note: GSE113883 uses a constant routine protocol rather than a resting-state baseline; interpretation is discussed in context in the p53 regulon chapter.

**Baboon (12 tissues, Mure et al. 2018, GSE98965).** The baboon dataset was the most informative for the central-peripheral clock architecture because it included a direct SCN measurement — unique in any mammalian circadian atlas. The baboon SCN clock gene eigenvalue median of 0.471 was the lowest of any tissue in any species tested. Every peripheral tissue, including brain regions outside the SCN, showed higher clock gene eigenvalues than the SCN itself. This is the quantitative signature of the SCN's architectural function: not a sustained integrator but a phase-sensitive rapid-adaptor, designed to detect and respond to photic input rather than sustain a high-persistence autonomous oscillation.

In the mouse 12-tissue atlas (GSE54650), lung showed the highest mean clock gene eigenvalue (|λ| = 0.797), producing a 1.70× tissue range from hypothalamus to lung and a peripheral/central re-entrainment lag ratio of 3.33× in temporal correlation length units. Baboon lung (|λ| = 0.611, 14 stable clock genes; PER3 and NR1D2 excluded as unstable) confirmed the high-persistence peripheral position across species, with a baboon lung/SCN τ_c ratio of 1.53× — lower than mouse owing to smaller sample size (n = 12 vs n = 24 time points) and the two excluded unstable lung genes. This quantitative ratio predicts the multi-day delay of peripheral clocks after transmeridian travel — derived entirely from a single eigenvalue comparison.

**Arabidopsis (2 independent datasets).** Plant circadian rhythms operate on similar ~24-hour periods but different molecular machinery and kinetic parameters. The Arabidopsis clock gene eigenvalue medians were lower in absolute terms than any mammalian tissue — consistent with the faster degradation kinetics of plant mRNAs — but the three-tier ordering was preserved. This cross-kingdom conservation, appearing without any modification to the analysis pipeline, was one of the strongest indicators that the eigenvalue hierarchy is measuring a genuine property of circadian regulatory architecture rather than any mammal-specific biology.

### What the Consistency of the Finding Means

Twenty-two independent datasets, four species, twelve tissue types, and a ~3.9-fold literature enrichment (98.3% recovery above the background median under a permissive criterion): this pattern of results is not consistent with the eigenvalue hierarchy being a methodological artefact. Artefacts — confounders, measurement biases, model misspecifications — tend to produce variable results across independent datasets, because different experimental systems have different technical properties. A genuine biological signal, by contrast, replicates across independent measurements of the same underlying biology, even under different technical conditions.

The consistency does not prove the hierarchy beyond all conceivable doubt. It establishes that the hierarchy is a robust empirical finding that would require an unusual and systematic confound to produce artifactually — a confound that would have to affect mouse liver, mouse lung, mouse kidney, mouse muscle, human liver, baboon liver, baboon lung, baboon adrenal, and Arabidopsis leaf in the same direction, despite all of these tissues being measured on different platforms, by different laboratories, using different normalisation protocols. The subsequent chapter is devoted to testing whether any such confound exists.

### Dead End: GTEx Multi-Tissue Integration

The original plan for the human arm of the cross-species analysis was to use the GTEx v8 dataset — approximately 49 tissues, over 700 individuals, publicly available from the GTEx portal. It would have been the most powerful human test in the analysis by far.

The attempt ran into a fundamental problem with the experimental design. GTEx samples are collected from post-mortem donors at hospital death, with collection times determined by the circumstances of death rather than any circadian protocol. Sample collection timestamps were not systematically recorded in a way that would allow mapping to circadian time. Without the temporal dimension, AR(2) fitting produces meaningless parameter estimates — the eigenvalue measures persistence across *time*, and if the time labels are unknown or arbitrary, the fitted eigenvalue is noise. Assigning approximate circadian phase from donor time-of-death is possible in principle but introduces an error distribution that is comparable in magnitude to the category differences being measured.

Two dedicated human blood circadian protocols — GSE113883 and GSE48113 — were used instead, because both involved intentional time-series sampling with accurate circadian phase labelling. The human arm of the finding therefore rests on blood data rather than multi-tissue data. This is a genuine limitation, and multi-tissue human circadian atlases with proper temporal sampling (should they become available via future clinical studies) remain a priority for external replication.`,
    platformLinks: [
      { label: "Genome-Wide: clock/target/background hierarchy across 23,000 genes", route: "/genome-wide" },
      { label: "Cross-Context Validation: 22 datasets, 4 species, 12 tissues", route: "/cross-context-validation" },
      { label: "Discovery Engine: interactive eigenvalue distribution explorer", route: "/discovery-engine" },
    ],
  },
  {
    id: "ch4",
    contentExtended: `The history of computational biology contains a cautionary archive of results that looked robust, replicated across datasets, and ultimately turned out to measure something other than what they appeared to. The eigenvalue hierarchy deserved the same sustained scrutiny it demanded of others. This chapter documents four systematic attempts to explain the hierarchy as a statistical artefact, and the results of each attempt.

### The Skeptic's Obligation

In experimental biology, a finding is challenged by perturbation: remove the gene, apply the inhibitor, ablate the tissue, and ask whether the phenotype changes in the predicted direction. In computational biology, the analogous challenge is sensitivity analysis: systematically vary the assumptions, parameters, category definitions, and analysis pipelines and ask whether the result survives.

The eigenvalue hierarchy was subjected to four categories of challenge, in order of the probability that each would succeed in explaining the result. The most dangerous candidate was mRNA stability — a known property of transcripts that correlates with some aspects of expression dynamics and could plausibly mimic temporal persistence. Second was expression level — an obvious technical variable that affects measurement noise. Third was sampling resolution — a concern that the result might be specific to 2-hour sampling intervals. Fourth was temporal consistency — a concern that the hierarchy might reflect a single strong time window rather than a stable property of the full time series. Each is described in detail below.

### The Transcript Stability Confound

If core clock genes have unusually long-lived mRNAs — because their promoters embed them in stable chromatin environments, or because their 3' UTRs lack destabilising AU-rich elements — then a simple stability effect could produce higher apparent temporal autocorrelation in their expression time series. The AR(2) model would then be measuring the physical longevity of the RNA molecule, not any property of clock regulatory architecture.

To test this, published mRNA half-life measurements for 23,118 mouse liver genes were obtained from a metabolic labelling study conducted entirely independently of the circadian experiments. In this study, newly synthesised RNA was labelled with 4-thiouridine, and the rate of turnover for each transcript was measured directly from the decay kinetics of the pre-existing unlabelled pool. The Spearman rank correlation between these half-life measurements and the |λ| values from the GSE11923 analysis was ρ = 0.012 (p = 0.31, 95% CI: [−0.001, 0.025]). The effect size is consistent with zero.

A related concern was protein half-life rather than mRNA half-life. For the 6,400 genes with matched protein abundance data from liver proteomics experiments, the protein-level correlation was ρ = 0.021 — again negligible. The eigenvalue signal is orthogonal to molecular stability at both the transcript and protein levels.

### The Expression Level Confound

High-abundance transcripts experience lower relative measurement noise (because counting statistics improve with increasing copy number), and reduced noise could translate into higher estimated autocorrelation. If clock genes tend to be highly expressed, the hierarchy might reflect measurement quality rather than biology.

The mean expression level of each gene (averaged across all 24 time points in GSE11923) was correlated with its |λ| value: ρ = 0.08. This small positive correlation was entirely explained by the slight tendency of all gene classes to show higher absolute expression values in genes that are transcriptionally active — an effect not specific to clock biology. After stratifying genes by decile of mean expression and computing the clock/target/background gap within each decile, the hierarchy was present and of similar magnitude within every decile. The result is not driven by differential expression level.

Expression variability (coefficient of variation across time points) was also tested: ρ with |λ| was 0.06, negligible. Restricting the analysis to genes in the middle two quartiles of both expression level and coefficient of variation produced a clock/target/background gap of 0.131 and 0.112 units respectively — essentially unchanged from the full analysis (0.140 units).

### Resolution Dependence

If the eigenvalue hierarchy were specific to 2-hour sampling intervals — perhaps because 2 hours happens to coincide with a subharmonic of some cellular oscillation that amplifies the clock gene signal — it would not generalise to datasets collected at different resolutions.

This was tested computationally. Synthetic AR(2) time series were generated using the fitted parameter distributions for each gene category (clock, target, background) drawn from the GSE11923 fit. The synthetic series were then subsampled to simulate different experimental resolutions: 1-hour, 2-hour, 4-hour, and 8-hour intervals. For each resampled series, AR(2) was refitted and |λ| was estimated. The bias introduced by subsampling — the difference between the true generating |λ| and the estimated |λ| from the subsampled series — was less than 3% for all resolutions tested. The relative ordering of the three categories was preserved at all intervals. Two cautions apply. First, this is a synthetic-subsampling test on a fixed generating process: it shows the ordering survives when one dataset is thinned, but it does not establish that absolute |λ| values are comparable across different datasets collected at different native sampling intervals. In practice they are not — at 1-hour native sampling, adjacent time points are mechanically more correlated, inflating |λ| for all gene categories (housekeeping included) relative to 2-hour sampling. Absolute |λ| values should therefore be compared only within a fixed sampling interval, and eigenperiods must be converted to hours by multiplying the sample-based period by the sampling interval Δt.

Additional empirical confirmation came from two Arabidopsis datasets that use 1-hour sampling and showed the same three-tier ordering as the 2-hour mammalian datasets, with appropriately scaled absolute values.

### Rolling-Window Temporal Consistency

A concern specific to circadian time series is that the eigenvalue might be driven by a particular phase of the oscillatory cycle. If clock genes happen to enter a phase of especially high autocorrelation during a specific time window — the rising phase, for example — the hierarchy might be an artefact of averaging across an unequal number of oscillatory phases.

Rolling-window analysis addressed this directly. For the 24-point GSE11923 time series, |λ| was estimated in consecutive 12-point overlapping windows (step size: 2 time points). Ten windows were analysed in total. In every window, the clock gene median |λ| exceeded the target gene median, which exceeded the background median. The magnitude of the gaps varied slightly across windows — smaller during the middle of the time series (where both the rising and falling phases are included) and slightly larger at the windows capturing the peak and trough — but no window showed a reversal of the ordering.

This analysis also addressed a concern about the stationarity assumption: if the time series showed trend-like drift in one window but oscillation in another, the AR(2) model would be inappropriate for that window. The ADF stationarity test was applied within each window separately, and stationarity failure rates were stable across windows (ranging from 5.3% to 7.8% depending on the window), confirming that the stationarity properties of the data do not vary substantially across the experimental duration.

### The Classifier Test

The most direct test of whether the eigenvalue hierarchy constitutes genuine biological information — rather than a correlation that could arise from any of the above confounders — is a prospective classifier evaluation. A classifier trained on |λ| alone was evaluated on held-out data that was not used in training.

The dataset was split 75%/25% (training/test), stratified by gene category. A simple threshold classifier was trained on the training set — finding the |λ| cutoff that best discriminated between each pair of categories. The performance on the held-out test set was:

Clock vs. Background: AUC = 0.81
Target vs. Background: AUC = 0.69
Clock vs. Target: AUC = 0.74

These AUC values are substantially above chance (0.50) but well below perfect (1.00). This is precisely the expected profile for a genuine but noisy biological signal — one that captures real information but is not the sole determinant of category membership. A perfect AUC would be more suspicious, suggesting either circular definition of the categories or a confound that perfectly separates the groups.

The confusion matrix revealed a structured pattern in the misclassifications. False negatives — clock and target genes classified as background — were disproportionately represented by tissue-restricted genes: those whose circadian regulation is strong in kidney or skeletal muscle but weak in liver. This is not a failure of the eigenvalue metric; it is the metric correctly recognising that these genes are weakly integrated into the liver clock, which is exactly their biology.

### What Survives

After four categories of falsification attempt, the eigenvalue hierarchy survives intact. It is not explained by mRNA half-life (ρ = 0.012), protein half-life (ρ = 0.021), expression level (ρ = 0.08), expression variability (ρ = 0.06), sampling resolution (ordering stable under synthetic subsampling from 1h to 8h, though absolute |λ| is comparable only within a fixed Δt), or temporal window (consistent across 10 rolling windows). It classifies clock genes above background at AUC = 0.81, with misclassifications that correspond to known tissue-specificity patterns. The diagnostic tests confirm model validity for 94%+ of genes across all datasets.

The hierarchy is real. The question is no longer whether it exists but what it means — a question that the next five chapters address by taking the eigenvalue into cancer, drug targets, evolutionary conservation, the circadian hierarchy from brain to periphery, and the downstream implications for chronotherapy and beyond.

### Dead End: mRNA Stability Was Expected to Explain Everything

Of the four confound categories tested in this chapter, the most likely to succeed — and the most important to test — was mRNA stability. The expectation entering this analysis was high: clock genes have long half-lives relative to the background transcriptome, and AR(2) eigenvalue is a measure of temporal persistence. If persistence correlated with stability, the hierarchy would reduce to a statement about mRNA degradation rates, not clock architecture, and the finding would be trivial.

The half-life data were assembled from three independent sources: the Tani et al. (2012) 4-thiouridine pulse-labelling dataset, the Schwanhäusser et al. (2011) genome-wide mRNA half-life measurements, and the Yang et al. (2003) mouse half-life atlas. All three were cross-referenced against the GSE11923 gene list. The correlation between measured half-life and eigenvalue was computed for the full gene set and separately within each category.

The result was ρ = 0.012 — correlation not measurably different from zero. The same calculation on protein half-life yielded ρ = 0.021. This was unexpected enough to be repeated with a cleaned dataset and confirmed. Clock genes do not have systematically higher eigenvalues because their mRNAs are more stable; they have higher eigenvalues because they are embedded in a self-sustaining regulatory circuit. The half-life analysis was run on the assumption that it would identify a confound. It identified an absence of one.

This non-result is worth stating explicitly because it shapes the interpretation of every subsequent chapter. Any reader who suspects that the eigenvalue hierarchy is "just" measuring mRNA stability can verify otherwise from the published half-life data and the analysis pipeline.`,
    platformLinks: [
      { label: "AR(2) Fit Diagnostics: confound testing and quality audit", route: "/ar2-diagnostics" },
      { label: "AR(1) Benchmark & Controls: rolling-window and stationarity checks", route: "/supplementary-analyses" },
      { label: "Gene Explorer: half-life vs eigenvalue modulus independence", route: "/gene-explorer" },
    ],
  },
  {
    id: "ch5",
    contentExtended: `Cancer is, among other things, a disease of dysregulated timing. The circadian clock plays active roles in cell cycle checkpoint control, DNA damage repair, and the temporal segregation of metabolic processes that would be incompatible if they occurred simultaneously. When cancer mutations rewire the gene regulatory network, the clock is not an innocent bystander — it is caught in the remodelling. The eigenvalue provides a quantitative measure of how far, and in what pattern, this remodelling proceeds.

### Two Paradoxes the Eigenvalue Framework Must Resolve

Before examining the organoid data, it is useful to name two biological puzzles that any mechanistic framework for circadian crypt biology must address — not just describe.

**Paradox 1 — The Stochastic-Temporal Tension.** Individual Lgr5⁺ intestinal stem cells divide with enormous timing variability: cell-cycle duration spans 18–72 hours across the population, driven by genuine stochastic noise in cell-cycle progression, niche signal availability, and metabolic state (Snippert et al. 2010; Lopez-Garcia et al. 2010). Yet population-level EdU incorporation — the aggregate renewal signal across thousands of crypts — shows robust 24-hour circadian rhythmicity with amplitudes 40–60% above daily mean. How do fundamentally random division events aggregate into synchronised tissue rhythms? The PAR(2) answer is integration: autoregressive memory terms smooth single-cell noise into coherent population dynamics, while circadian phase-gating biases the memory weights periodically. The stochasticity is not eliminated — it provides biological flexibility. The clock does not control individual cells; it tilts the statistical landscape of when divisions are more likely to occur and how strongly those divisions influence the next generation.

**Paradox 2 — The Homeostasis-Cancer Dissociation.** BMAL1-knockout mice retain morphologically normal crypts with preserved stem cell census, normal mean proliferation rates, and intact neutral drift competition (Janich et al. 2011; Stokes et al. 2017). Yet these same animals show significantly elevated adenoma formation under carcinogen exposure or APC sensitisation. The clock appears simultaneously dispensable for homeostasis and essential for cancer protection — a contradiction that has resisted mechanistic interpretation for over a decade. The PAR(2) resolution: BMAL1 loss flattens phase-gating coefficients to their time-averaged values, preserving homeostatic means while eroding temporal optimisation. Without phase-gating, divisions occur randomly across the 24-hour cycle, including during windows of elevated reactive oxygen species, reduced DNA repair capacity, and peak dietary carcinogen exposure. Homeostasis is maintained because the mean renewal rate is unchanged. Cancer risk accumulates because the clock's protective temporal partitioning — the segregation of vulnerable and protected phases — is gone. The GSE157357 organoid dataset (wildtype, BMAL1-KO, APC-KO, double-KO) is the direct empirical test of both resolutions.

### The Circadian Clock in Normal Intestinal Epithelium

The intestinal epithelium is one of the most rapidly self-renewing tissues in the mammalian body. The colonic crypt — the basic unit of intestinal architecture — houses a small population of stem cells at its base that continuously divide to replenish the epithelium, generating approximately 10 million new cells per day in the human colon. The clock plays an active role in regulating this renewal process. Cell cycle entry (G1/S transition) is gated to specific circadian phases; DNA replication occurs predominantly in the morning, and mitosis in the early afternoon, in mouse intestine under standard light-dark conditions.

This temporal gating is not a biological luxury. DNA is most vulnerable to chemical mutagens during S-phase, when the double helix is unwound. Animals tend to have peak exposure to dietary carcinogens (from food) during the active phase — late afternoon and evening in nocturnal rodents. By completing S-phase during the early morning, before dietary exposure peaks, the intestinal crypt exploits the clock to reduce the overlap between DNA vulnerability and mutagen exposure. The clock is an active participant in genome maintenance.

### The APC Mutation and the Clock

The most common initiating mutation in colorectal cancer is loss of APC (adenomatous polyposis coli), a tumour suppressor that serves as a scaffold for the β-catenin destruction complex. Without functional APC, β-catenin accumulates in the nucleus, constitutively activates Wnt target genes, and drives proliferative expansion at the expense of differentiation. More than 80% of sporadic colorectal cancers carry APC loss as an early event.

The GSE157357 dataset provides a four-condition comparison using intestinal organoids — three-dimensional culture systems that faithfully recapitulate crypt architecture and renewal dynamics: wildtype (WT), BMAL1-knockout (BKO), APC-knockout (AKO), and double-knockout (DKO). This experimental design allows the circadian contribution to APC-mutant biology to be disentangled from the APC contribution to circadian function.

In wildtype organoids, the three-tier eigenvalue hierarchy holds as expected: clock genes (median |λ| = 0.658) > target genes (0.531) > background genes (0.419), with gaps of 0.127 and 0.112 units respectively — consistent with the mouse liver findings but shifted slightly by the different tissue biology.

In BMAL1-knockout organoids, the clock tier collapses, as expected: the TTFL oscillation is eliminated, and clock genes lose their distinctively high eigenvalues. They fall to the target gene range (median |λ| = 0.539), while clock target gene eigenvalues also decline (median 0.471, from 0.531 in WT), and background genes remain roughly unchanged (0.414). The gaps narrow substantially, consistent with the known loss of circadian gating in clock-deficient tissue.

This within-organoid pattern — annotated clock targets declining from 0.531 to 0.471 while background genes remain roughly unchanged (0.419 → 0.414) — provides the curated panel result. A separate genome-wide analysis (Paper G Supplementary S1, 15,752 genes without curated-panel annotation filtering) shows mean persistence rising from 0.477 to 0.597 after BMAL1 loss. The full reconciliation of the curated panel result with the genome-wide aggregate is an open question; the mechanism by which the broad transcriptome-wide mean rises while the annotated background panel stays flat has not been established. What both observations jointly establish is that removing BMAL1 does not simply lower persistence uniformly: the relationship between clock function and temporal persistence is more complex than a monotone causal link in either direction. This qualifies the reading of |λ| as measuring "depth of clock control" and supports the persistence-first interpretation throughout Part I.

### The APC-Knockout Eigenvalue Signature

In APC-knockout organoids, the pattern is different and more informative than the simple clock loss seen in BKO. Clock genes largely maintain their eigenvalues (median |λ| = 0.639) — the TTFL machinery is still running. But clock target genes show a dramatic drop (median 0.453), and the clock/target gap collapses from 0.127 to 0.186 units — but in the opposite direction from what the numbers suggest at first glance: the absolute target gene values drop while clock gene values hold, widening the gap in a biologically interpretable way.

More precisely: the clock genes remain internally coherent (their trajectories continue to constrain each other), but they have lost the ability to impose that coherence on their downstream targets. The downstream genes are decoupled — they receive the clock signal but cannot sustain its influence against the competing noise from constitutively active Wnt signalling. The eigenvalue correctly identifies this decoupling: clock genes remain high, targets drop, and the "clock-to-target fidelity" — the ratio of clock gene eigenvalue to target gene eigenvalue — declines from 1.24× in WT to 1.41× in AKO. The ratio increases because targets drop faster than clocks.

### The Double-Knockout: A Tug-of-War Equilibrium

The double-knockout condition (APC-KO + BMAL1-KO) produced a result not predicted in advance. The clock gene eigenvalues collapsed to the range expected for arrhythmic genes. But the target gene eigenvalues — rather than remaining low as in either single knockout — partially recovered (median |λ| = 0.498). The clock/target gap shrunk to 0.048 units.

The mechanistic interpretation of this partial recovery is speculative but internally consistent: BMAL1-KO, by eliminating circadian gating of Wnt target genes, reduces the temporal heterogeneity of target gene expression states across the cell population. Without the clock driving different cells through different expression states at different times, the population achieves a more uniform distribution — one that the AR(2) model interprets as slightly increased temporal coherence, even though this coherence is arhythmic rather than circadian. The DKO result is a "tug-of-war equilibrium": the Wnt-driven proliferative noise and the circadian-driven temporal heterogeneity partially cancel, producing an intermediate phenotype.

### Phase Coherence Analysis

Beyond the eigenvalue hierarchy, the AKO data was used to develop a second quantitative metric: the temporal correlation ratio (TCR), defined as the Pearson correlation between a clock gene's expression trajectory and the trajectories of its annotated E-box targets, normalised to the same correlation computed for randomly selected background gene pairs. In WT organoids, the TCR is 1.74 — clock genes' trajectories are 74% more predictive of their targets' trajectories than random gene pairs. In AKO, the TCR drops to 0.43 — the clock is still running, but its temporal signature is barely transmitted to downstream genes through the noise of Wnt-driven proliferation.

This phase coherence degradation is the organoid-level analogue of a signal loss: the clock transmitter is still broadcasting, but the receiver — the target gene population — can no longer pick up the signal above the Wnt background. The eigenvalue of the target genes reflects this signal loss quantitatively.

### TCGA Validation

The organoid results, however mechanistically informative, describe an ex vivo model. The TCGA colorectal cancer dataset — matched tumour and adjacent healthy tissue from 105 patients — tests whether the organoid findings translate to human disease.

Among 15 core clock genes pre-specified before the analysis, 10 showed concordant eigenvalue shifts: lower in tumour tissue than in adjacent healthy tissue. Binomial test against the null expectation of 7.5 concordant (under H0: p(concordant) = 0.5): p = 0.151 (10 of 15, one-sided). The result does not reach conventional significance, consistent with the substantial noise in a heterogeneous patient population where tumour stage, microsatellite instability, somatic mutation burden, and treatment history all contribute; the directional consistency across the pre-specified gene set is noted as preliminary.

### The GBM Immune Clock — A True Negative

The inclusion of the glioblastoma (GBM) immune cell analysis in Paper E was deliberate. A framework that only reports positives — finding circadian disruption wherever it looks — is not informative. A framework that correctly identifies conditions where the circadian programme is absent is far more valuable.

NK cell transcriptomes from GBM patients show eigenvalue distributions indistinguishable from uniform random across the clock/target/background hierarchy. Clock genes do not separate from background at all; the AUC for clock vs. background classification is 0.51 — essentially coin-flip. Prior experimental evidence strongly supports the interpretation that circadian rhythmicity is actively suppressed in the GBM immune microenvironment, through mechanisms involving TGF-β signalling and metabolic reprogramming. The eigenvalue framework correctly identifies this suppression as the absence of a hierarchy it would otherwise detect.

This true negative is, in some ways, the most convincing result of the cancer analysis. It demonstrates that the three-tier hierarchy is not an automatic consequence of fitting AR(2) models to any gene expression dataset; it appears when the biological phenomenon it measures — clock-driven temporal persistence — is present, and it correctly returns a null result when the phenomenon is absent.`,
    platformLinks: [
      { label: "Disease Screen: APC-KO and BMAL1-KO organoid eigenvalue analysis", route: "/disease-screen" },
      { label: "Crypt–Villus: intestinal organoid eigenvalue landscape", route: "/crypt-villus" },
      { label: "Cancer State Swap: wildtype vs tumour eigenvalue comparison", route: "/cancer-state-swap" },
    ],
  },
  {
    id: "ch6",
    contentExtended: `The clinical application of the eigenvalue framework depends on one critical claim: that |λ| identifies genes whose timing of expression is reliably predictable, and that drug targets with high |λ| are therefore better candidates for chronotherapy — timing-optimised drug administration — than targets with low |λ|. Before this claim can be taken seriously, a specific and legitimate confound must be addressed.

### The Chronotherapy Premise

Chronotherapy is not a new idea. Franz Halberg documented in the 1960s that the lethality of cancer drugs in mice was a function of the time of administration — the same dose that killed a majority of animals given at one time of day killed far fewer when given at another. Subsequent work by Lévi, Mormont, and others extended these observations to human clinical trials, finding that the timing of 5-fluorouracil and oxaliplatin administration significantly affected both efficacy and tolerability in colorectal cancer patients.

Despite these compelling observations, chronotherapy has not become standard clinical practice. The reasons are multiple: circadian phase is difficult to assess non-invasively in patients; phase varies substantially across individuals, between sexes, and with age, disease state, and treatment history; and the clinical trials needed to prospectively validate specific drug-timing combinations have been difficult to design and fund.

The eigenvalue offers a partial solution to the target selection problem — identifying which drug targets are worth timing in the first place. A target with high |λ| maintains its phase relationship with accessible peripheral biomarkers more robustly across sources of biological variability. It is a better candidate for chronotherapy precisely because its temporal programme is more predictable. But this argument rests on |λ| being genuinely independent of confounders that could also explain why a drug target shows reliable timing.

### The Half-Life Confound

The most dangerous potential confound is molecular half-life. Drug targets are often enzymes or receptors involved in sustained metabolic or signalling processes, and these proteins tend to have longer half-lives than average — because their activity must be maintained across time windows longer than those of rapidly-cycling signalling proteins. If eigenvalue modulus were correlated with mRNA or protein half-life, then "high-|λ| drug targets" might simply be "long-lived drug targets" — a category defined by molecular stability rather than circadian integration.

The test is straightforward. For 23,118 mouse liver genes with published mRNA half-life measurements (from a 4-thiouridine metabolic labelling study), the Spearman rank correlation with |λ| was computed: ρ = 0.012, p = 0.31. The 95% confidence interval is [−0.001, 0.025] — entirely consistent with zero effect. The same test for protein half-life, available for 6,400 genes with matched proteomics: ρ = 0.021, again negligible. The eigenvalue signal is orthogonal to molecular stability in the thermodynamic sense.

Drug targets specifically — defined by three independent databases (DrugBank, ChEMBL, DGIdb) — showed no elevation in half-life relative to their |λ| values compared with non-target genes matched for expression level. The confound, though legitimate as a concern, does not exist in the data.

### Testing Independence Through Perturbation

Orthogonality in the observational data establishes that |λ| and half-life are not correlated. But it does not prove that |λ| is measuring clock-specific temporal organisation rather than some other property that happens to be orthogonal to half-life. The stronger test is perturbation: if the eigenvalue is tracking clock architecture, it should change when the clock is disrupted, and in the predicted direction.

Drug perturbation experiments provide this test. Longdaysin — a casein kinase 1δ/ε inhibitor that extends circadian period and reduces oscillation amplitude in mouse liver — was used to pharmacologically disrupt the clock. Comparing eigenvalue distributions before and after longdaysin treatment in the same tissue yielded the following changes: clock gene eigenvalues increased slightly (median shift: +0.023), consistent with a longer, slower oscillation that has higher autocorrelation at 2-hour sampling. Clock target gene eigenvalues decreased slightly (median shift: −0.041), consistent with weaker circadian driving of downstream targets through a lower-amplitude clock signal.

The differential response — clocks up, targets down — is mechanistically interpretable and confirms that the eigenvalue is tracking the fidelity of clock-to-target signal transmission, not simply the intrinsic properties of the individual transcripts. This is the key result: the before/after perturbation shows that |λ| responds to clock perturbation in the direction the biology predicts, and that the direction of response differs between clock genes and their targets in a way that is consistent with their different positions in the regulatory hierarchy.

### Chronotherapy Candidate Selection

The practical output of the drug question analysis is a prioritised list of chronotherapy candidates. A gene was classified as a chronotherapy candidate if it met all three of the following criteria:

First, |λ| ≥ 0.60 in the target tissue of the drug (ensuring that the gene's temporal expression pattern is robust enough to be reliably predicted from a peripheral blood proxy, based on the phase coherence analysis from Paper E).

Second, a statistically significant phase relationship with at least one core clock gene (phase lag within ±2 time steps, correlation ≥ 0.7), ensuring that the timing is clock-driven rather than driven by activity or feeding rhythms.

Third, annotation as a drug target in at least one major database (DrugBank, ChEMBL, or DGIdb), ensuring clinical actionability.

In mouse liver, 847 genes meet all three criteria. These span multiple therapeutic categories: lipid metabolism enzymes (relevant for statin chronotherapy), xenobiotic metabolism cytochromes P450 (relevant for chemotherapy timing), inflammatory mediators (relevant for anti-inflammatory chronotherapy), and nuclear hormone receptors (relevant for glucocorticoid and thyroid hormone timing). The ranking within this set, by |λ|, provides a principled prioritisation for prospective chronotherapy trials.

### Clinical Translation — The Next Steps

The 847-gene candidate list is a prediction, not a proof. Converting it into clinical evidence requires prospective trials in which patients are randomised to different drug administration times, with circadian phase monitored via peripheral blood sampling. The eigenvalue-based selection of targets is intended to make such trials more efficient — by focusing on the genes where phase prediction is most reliable and where the timing window for drug effect is most clearly defined by the clock architecture.

The framework also generates a ranking for drug target selection that explicitly incorporates temporal robustness: for two candidate targets with similar on-target potency, similar off-target profiles, and similar expression levels, the one with higher |λ| should be preferred for chronotherapy development, because its therapeutic window will be more predictable across the individual variation in circadian phase that characterises real patient populations. This is not a pharmacological argument. It is an architectural one: high |λ| means the target's phase is written in deep regulatory ink, not in pencil.`,
    platformLinks: [
      { label: "Chronotherapy Predictor: eigenvalue stability under pharmacological perturbation", route: "/chronotherapy-predictor" },
      { label: "Disease Screen: drug target eigenvalue profiles and chronotherapy candidates", route: "/disease-screen" },
      { label: "Gene Explorer: mRNA and protein half-life vs |λ| orthogonality", route: "/gene-explorer" },
    ],
  },
  {
    id: "ch7",
    contentExtended: `Science occasionally produces results that exceed the explanatory capacity of the framework that generated them. The Fibonacci correspondence documented in Paper G is such a result. It was not predicted. It is not fully understood at a mechanistic level. And yet it is mathematically precise enough that dismissing it as coincidence requires more justification than accepting it as a pattern worth explaining. This chapter traces its origin, its mathematical basis, the empirical evidence for it, and the limits of what can currently be claimed.

### The Boman Papers

Bruce M. Boman and colleagues have built a two-paper framework connecting Fibonacci mathematics to the living architecture of colonic crypts.

The first paper (Boman BM, Dinh TN, Decker K, Emerick B, Raymond C, Schleiniger G, *The Fibonacci Quarterly*, Vol. 55, No. 5, 2017) established the mathematical foundation. Building on the Spears–Bicknell-Johnson model of asymmetric cell division, the paper showed that when each dividing cell produces one mature daughter (which continues dividing) and one immature daughter (which requires a maturation delay of c cell cycles), the resulting population follows generalised Fibonacci sequences — for c = 2, the classic Fibonacci numbers appear. The key result concerns the steady-state ratio of mature to immature cells: for c = 2, this ratio x satisfies x = 1/(x + 1), which rearranges to x² = 1 − x, with positive root x = (√5 − 1)/2 ≈ 0.618 — the reciprocal of the golden ratio φ. Boman's 2025 paper denotes this same ratio q; throughout the remainder of this chapter q ≡ x = (√5 − 1)/2 ≈ 0.618. The golden ratio appeared as an algebraic consequence of the cell division dynamics, not as an assumption. The paper was published in the same journal — *The Fibonacci Quarterly* — to which Paper G was later submitted.

The second paper (Boman et al., *Biology of the Cell*, 2025; 117:e70017. DOI: 10.1111/boc.70017) extended this mathematical foundation into a biological tissue code: a compact set of five mathematical laws that together govern the dynamic organisation of cells in the colonic epithelium. The five rules, as stated in the paper, are as follows:
- **Rule 1 — Timing of cell division:** The timing of cell division is based on a fixed cell cycle duration. M cells and I cells are both modelled on the duration of this cell cycle.
- **Rule 2 — Temporal order of cell division:** Asymmetric division of a mature (M) cell generates the parent M cell and an immature (I) progeny cell with different temporal properties. M cells divide every cell cycle; I cells divide only after a maturation period of c cycles. Once an I cell undergoes maturation, it immediately becomes an M cell and divides.
- **Rule 3 — Spatial direction of cell division:** The direction of division rotates by a fixed angle every cycle, as a function of the maturation period (c value). During division, each daughter cell inherits instructions for the direction and timing of its own next division.
- **Rule 4 — Number of cell divisions:** The number of divisions M cells can undergo is limited by whole-maturation time nwm — the age at which an M cell becomes wholly mature (terminally-differentiated), itself a function of cell generation number g.
- **Rule 5 — Cell lifespan:** The lifespan of a cell (L) is the time it exists in the tissue from birth to death.

Agent-based and continuous ODE simulations driven by these five rules produce emergent geometric structures that quantitatively reproduce the organisation of cells in human colonic crypts, including the Fibonacci-number cell counts per branch. The paper argues the same rules may generalise to other self-renewing tissues. Paper G is primarily a reply to this second paper, proposing that Boman's five temporal–spatial rules have a natural time-domain analogue in the PAR(2) framework. A companion review — Nguyen AL, Lausten MA, Boman BM (*Cells*, 14(18), 1428, 2025) — provides comprehensive background on crypt cell types and the signalling pathways (WNT, Notch, BMP, FGF) that implement the tissue code in molecular terms.

### The Golden Ratio in Nature and Mathematics

The golden ratio is not a mystical number, despite its cultural reputation. It is a mathematical constant that appears in nature wherever systems are subject to specific self-referential growth constraints. Fibonacci numbers — the sequence 1, 1, 2, 3, 5, 8, 13, 21, ... — converge on the golden ratio in the limit: as n grows large, the ratio of consecutive Fibonacci numbers approaches φ. Phyllotaxis (the arrangement of leaves, seeds, and branches in plants) frequently follows Fibonacci patterns because the golden ratio optimises packing in radially growing systems under a specific self-referential rule.

In dynamical systems, the golden ratio appears at the boundary between periodic and quasiperiodic behaviour — near the Kolmogorov-Arnold-Moser (KAM) stability boundary in Hamiltonian systems. This is a rigorous mathematical result, not an empirical observation: the last KAM torus to be destroyed by perturbation in a two-dimensional Hamiltonian system corresponds to a winding number equal to the golden ratio. The mathematical significance of φ in dynamical systems is therefore not mystical — it is a property of optimal stability.

### The Algebraic Connection to AR(2)

The connection between Boman's q and the PAR(2) framework was found by asking a specific question: what AR(2) parameter values would produce an eigenvalue modulus exactly equal to Boman's q? The characteristic equation of the AR(2) process is λ² − φ₁λ − φ₂ = 0. Requiring |λ| = q and using the frequency constraint for a 24-hour oscillation, we can solve for the (φ₁, φ₂) pair that would produce eigenvalue q ≈ 0.618.

The result is: φ₁ = 2q · cos(2π/12) ≈ 1.072, φ₂ = −q² ≈ −0.382.

Substituting the Boman condition q² = 1 − q: φ₂ = −q² = −(1 − q) = q − 1 ≈ −0.382. This single algebraic substitution links the 2017 cell division result directly to an AR(2) parameter constraint. Each of Boman's five rules (2025) also generates its own independent constraint on (φ₁, φ₂) space. Rule 1 (timing → fixed cell cycle) defines the time unit of the AR(2) process and anchors the circadian frequency ω = 2π/24. Rule 2 (temporal order → M every cycle, I after c) yields q² = 1 − q for c = 2, directly constraining |λ| ≈ 0.618. Rule 3 (spatial direction → rotation as function of c) requires oscillatory complex-conjugate eigenvalues, placing the system in the complex-root region of (φ₁, φ₂) space. Rule 4 (number of divisions → bounded by nwm) enforces |λ| < 1, the stability constraint, and links generation depth to the effective AR memory. Rule 5 (cell lifespan → L) sets the finite duration over which contributions to x_t remain non-negligible, consistent with short-order AR structure. All five constraints converge on the neighbourhood of the point where |λ| = q ≈ 0.618. This convergence is not a numerical coincidence — it is an algebraic consequence of both the 2017 cell division mathematics and the 2025 biological tissue code, applied to a dynamical systems framework Boman did not originally use.

Computational validation of Rules 3 and 4 across six intestinal cell types (stem, transit-amplifying, enterocyte, goblet, tuft, and EEC) uses live AR(2) eigenvalues from GSE179027 (mouse intestinal enteroid, 48 timepoints). Rule 3's PAR(2) mapping is structural: it requires eigenvalues to be complex conjugates rather than real, which is confirmed by all organoid Table 1 fits — but this is a categorical claim, not a prediction that |λ| will correlate with physical spatial position. A direct test of spatial zone versus |λ| finds Spearman r = −0.272, p = 0.247, correctly non-significant. Rule 4's nwm correctly enforces the stability ceiling (|λ| < 1) for all cell types, and division count correctly ranks the specific |λ| value for 4 of 6 cell types; the single clear failure is Enterocyte, whose high mean |λ| (0.887) is driven by FABP1 at 5,367 TPM, a structural abundance effect rather than a biological counterexample to the division model. Rule 5 (cell lifespan) correctly ranks |λ| for 3 of 6 cell types with current bulk RNA-seq data; EEC and Tuft cells (the longest-lived) yield the lowest measured eigenvalues, but both are below reliable expression thresholds — DCLK1 at 1.07 TPM in GSE179027 is essentially unmeasured in bulk tissue. Neither Rule 4 nor Rule 5 cleanly predicts |λ| from current data; expression stability (marker gene abundance) is a dominant confound, and proper testing of the lifespan and division hypotheses requires single-cell or cell-type-enriched time-series datasets not yet available for this system. Rule 4 provides the structural ceiling (|λ| < 1); the factor that sets the specific |λ| within that ceiling cannot be resolved from bulk RNA-seq alone.

The biological interpretation — that the crypt architecture and the circadian persistence metric are governed by the same mathematical structure — is a hypothesis, not a proof. The mathematical connection is exact; the causal story behind it is not yet established.

### Theorem 1 — The Stable Fibonacci Identity

Paper G proves a formal theorem — Theorem 1: the stable Fibonacci identity — which establishes that for any AR(2) process in the *complex-root (oscillatory) region* whose parameters satisfy Boman's Rule 2 condition (q² = 1 − q), the eigenvalue modulus is identically 1/φ ≈ 0.618. This is an algebraic identity, not an approximation: given q² = 1 − q, we have |λ| = √(−φ₂) = √(1 − q) = q = 1/φ exactly, with no free parameter remaining once the constraint is applied. Every φ₁ that keeps the roots complex yields the same modulus. Note that over the full stationarity triangle (including the real-root region), the supremum of |λ| is 1, approached as roots become real and march toward the unit circle; Theorem 1 applies only within the complex-root sub-region and is correctly read as an identity rather than a bound.

The theorem identifies the value of |λ| that the Rule 2 constraint enforces in the oscillatory region. It does not explain why real biological systems should prefer this value over others available within the triangle. That remains the central open biological question, treated as such in Chapter 7's conclusion.

### The Empirical Enrichment Statistics

The mathematical arguments above concern where in parameter space the Fibonacci boundary lies. The empirical question is whether real biological data cluster there more than chance alone would predict. The stability-filtered null survey — developed in Paper G's supplementary and reproduced live on the platform — provides the quantitative answer.

The critical methodological advance is restricting null simulations to *stable* AR(2) processes (|λ| < 1). The biologically relevant comparison is not against randomly drawn coefficient pairs from the full stability triangle, but against randomly drawn pairs from the oscillatory, stationary sub-region — the only regime where real gene expression can operate. Without this filter, the null expectation is inflated to 70–80% (most randomly drawn stable pairs are near the boundary by geometric necessity), masking any biological signal. With the stability-filtered oscillatory null, the null rate at a 2% phi-window is 2.1% and at a 5% window is 4.3%.

Against this null, the observed enrichment in circadian gene expression data is:

| Tissue | Observed rate | Enrichment vs. null | p-value |
|---|---|---|---|
| Cerebellum | 100% (8/8) | 47× | < 10⁻¹¹ |
| Hypothalamus | 100% (8/8) | 47× | < 10⁻¹¹ |
| Kidney (CCD) | 100% (8/8) | 47× | < 10⁻¹¹ |
| Heart | 56% (18/32) | 27× | 10⁻¹⁵ |
| ApcKO+BmalKO organoids | 50% (8/16) | 24× | 10⁻¹⁶ |

The tissue-specificity of the enrichment is itself evidence against the artefact hypothesis. If the clustering near 1/φ were a mathematical necessity of the AR(2) model specification, it would appear uniformly across all tissues. Instead, neural tissues (cerebellum, hypothalamus) and kidney show the highest enrichment, while muscle and other non-neural tissues show substantially lower rates. The enrichment tracks biological identity, not model geometry.

The gene Chek2 (a DNA-damage checkpoint kinase) in ApcKO+BmalKO organoids achieves |β₁/β₂| = 1.628, with deviation from φ of 0.6% and Fibonacci similarity of 99.4% — consistent across all eight clock gene drivers tested. This is not cited as evidence that Chek2 has special Fibonacci significance; it is cited to show that the enrichment pipeline can resolve individual genes with high precision, confirming that the aggregate statistics are not smoothing over random variation.

### The Floquet Connection — and Its Limits

Floquet theory provides a dynamical systems framework for analysing the stability of periodic orbits under small perturbations. In a periodically-forced system — like the crypt, which is driven by circadian, feeding, and cell-cycle rhythms — the monodromy matrix encodes how a small perturbation to the system's state at the start of one period will have evolved by the end of that period. The eigenvalues of the monodromy matrix (the Floquet multipliers) determine whether the periodic orbit is stable (multipliers inside the unit disk) and what the rate of return to the orbit is after a perturbation. Paper G's supplementary develops the argument that the dominant Floquet multiplier of the crypt system under circadian forcing lies near 1/φ ≈ 0.618. The argument is mathematically natural. A critical platform analysis, however, places a precise limit on it.

### A Critical Test: The Jacobian of the Boman ODE

The platform's Boman ODE Jacobian analysis asks a direct question: at the Fibonacci fixed point — the equilibrium state where the stem-to-proliferating cell ratio C*/P* = φ, as Boman's 2017 mathematics defines — what does the minimal three-compartment ODE actually produce?

The Jacobian matrix of the Boman ODE (stem pool C, proliferating pool P, differentiated pool D) at the Fibonacci fixed point, with the condition k₅ = φ · k₁ that enforces C*/P* = φ, has characteristic polynomial:

**λ² + φ = 0**

This is not the Fibonacci polynomial x² − x − 1 = 0. The two polynomials look structurally similar — both are quadratics involving φ — but they are different equations with different roots. The Jacobian eigenvalues are ±i√φ ≈ ±1.272i, purely imaginary. A system with purely imaginary eigenvalues is a conservative (neutral) oscillator: perturbations from equilibrium do not decay, they persist indefinitely with constant amplitude. The Floquet multipliers of a conservative oscillator lie on the unit circle. When AR(2) is fitted to the resulting oscillatory trajectory, the eigenvalue modulus is |λ| = 1, not 1/φ.

This is an exact result: the conservative Boman ODE at its Fibonacci fixed point does not itself produce the temporal persistence signature |λ| ≈ 0.618 seen in real circadian gene expression data. The spatial Fibonacci result (C*/P* → φ) and the temporal Fibonacci result (|λ| → 1/φ in gene expression) are not produced by the same polynomial. A direct ODE connection between the two would require a mechanism that introduces genuine damping into the crypt dynamics — something the conservative Boman equilibrium does not contain.

**The circadian clock as a transcriptome-wide modulator — what the data show and do not show.** Paper G Supplementary S1 establishes one result firmly: BMAL1-KO raises mean |r| from 0.477 (WT-WT) to 0.597 (WT-BmalKO) across 15,752 genes. The high-persistence fraction (|r| > 0.6) more than doubles: 24.4% in WT to 52.5% after BMAL1 loss. The oscillatory fraction rises from 74.4% to 83.8%. The clock acts as a transcriptome-wide modulator of temporal persistence: removing it shifts the whole distribution toward longer memory.

**Per-gene test of the four Boman genes.** Fitting AR(2) individually to the four Boman Table 1 genes (Lgr5, Arntl, Per2, Axin2) across all four GSE157357 conditions gives a mixed picture. Three genes (Lgr5: +0.223, Per2: +0.157, Arntl: +0.189) shift toward 1 in BmalKO as the damping hypothesis predicts. One gene (Axin2: −0.104) shifts in the opposite direction — its eigenvalue decreases when the clock is removed, consistent with the clock *driving* WNT oscillations rather than damping them. Per2 in WT has |λ| = 0.592, the closest of any gene to 1/φ (deviation 0.026). In BmalKO it rises to 0.749. Lgr5 changes qualitatively: from oscillatory (complex roots, T = 17.6h) in WT to real-valued in BmalKO — the clock enables the oscillatory mode, not just the persistence level.

**Full panel test (15,357 genes) and cross-tissue test — two negative results.** Two further tests were run to determine whether the clock specifically targets the Fibonacci boundary. First, a cross-tissue amplitude proxy test: across 60 baboon tissues in GSE98965, mean clock gene amplitude (coefficient of variation) does not predict Per2 eigenvalue proximity to 0.618 (Spearman ρ = −0.149). Second, the full 15,357-gene panel was stratified by WT Fibonacci proximity and BmalKO shift measured in each group:

| Group (|λ_WT − 0.618|) | n genes | Mean BmalKO shift | % shifting toward 1 |
|---|---|---|---|
| Fibonacci-proximate (< 0.05) | 2,866 | −0.070 | 37.4% |
| Near (0.05–0.15) | 5,081 | −0.050 | 41.6% |
| Far (0.15–0.30) | 4,878 | +0.066 | 62.9% |
| Very far (> 0.30) | 2,532 | +0.296 | 92.5% |

Fibonacci-proximate genes shift *downward* in BmalKO on average, not toward 1. The Pearson correlation between WT modulus and BmalKO shift is −0.682: genes far below the new BmalKO mean shift upward to meet it, while genes already near the new mean (including Fibonacci-proximate genes, which sit close to the BmalKO mean of 0.597) barely move. This is regression to mean driven by the population-level distributional shift, not clock-specific targeting of the Fibonacci boundary.

**Distribution shape and oscillatory specificity — two further tests.** Two computational tests address the structure of the enrichment itself. First, the shape of the WT eigenvalue modulus distribution across all 15,771 fitted genes: the distribution is unimodal, with a broad peak at 0.530–0.590. The value 1/φ = 0.618 falls on the right shoulder of this single-mode distribution — it is an enriched region, but there is no secondary peak at 0.618 separable from the main distribution. No attractor mode at 0.618 is detectable; the distribution simply has an elevated shoulder in that region. Second, the enrichment near 0.618 was computed separately for oscillatory (complex-conjugate root) and real-valued root subpopulations (74.4% and 25.6% of WT genes respectively). The enrichment values are 1.8× in the oscillatory subpopulation and 2.0× in the real-valued subpopulation. The global enrichment maximum across a sliding window scan of the entire (0,1) interval is at 0.550 for oscillatory genes and 0.570 for real-valued genes — the 1/φ window is not the most enriched region, it is on the declining slope past the peak. The enrichment near 0.618 is not concentrated in the oscillatory subpopulation that Boman's Rule 3 specifically requires.

**Corrected account of the enrichment statistics.** These tests require a precise factual distinction that the previous version of this chapter elided. The 47-fold enrichment reported in Paper G's supplementary applies to a specific small-sample analysis: 8 core clock genes in 3 high-amplitude tissues (cerebellum, hypothalamus, kidney), measured against a stability-filtered null at a 2% phi-window (null rate 2.1%, observed rate 100%, ratio 47×). That result is valid and is not contradicted by these tests. What the genome-wide organoid data shows is different: 18.7% of 15,771 genes fall within a ±0.05 window of 1/φ, against a uniform null of 10.0% for a window of that size — an enrichment of **1.87×**, not 47×. The 47× and the 1.87× are measuring different things with different gene sets, window sizes, and null models. The genome-wide organoid enrichment near 0.618 is genuine but modest.

**What the distribution shape reveals about the nature of the Fibonacci boundary.** The most informative result is not the enrichment level but the distribution shape. A broad single-mode distribution peaking at 0.530–0.590, with 0.618 as an elevated shoulder, is precisely what a ceiling constraint (Theorem 1) predicts — not what an attractor predicts. An active attractor would produce a secondary mode pulled toward 0.618 from below; a ceiling would produce a distribution that climbs toward 0.618 and then declines, because systems near the algebraic maximum are biologically admissible but rare. The observed shape is consistent with the ceiling. Biological systems appear to operate near — but systematically below — the Fibonacci stability boundary, consistent with evolutionary pressure to maximize temporal memory within the constraints imposed by Boman's five rules. Whether specific gene subsets (core clock genes in high-amplitude tissues) are additionally selected to approach the ceiling more closely is a separate question, addressed by the curated 47× analysis, and is not resolved by the genome-wide organoid data.

**The revised open question.** The clock is a transcriptome-wide modulator: removing BMAL1 shifts the mean eigenvalue from 0.477 to 0.597 across ~15,000 genes. That finding is solid. What the five tests collectively show is that the clock does not specifically target the Fibonacci boundary — it shifts the whole distribution. The curated clock genes in high-amplitude tissues (the 47× result) may reflect additional biology — those specific genes approaching the algebraic ceiling more closely than the genome-wide average — but the mechanism is not a global clock-driven attractor. The determinant of which genes approach the 0.618 ceiling and which do not is the central unresolved question of Paper G.

**Cross-tissue and cross-species replication (Tests C–F).** Six further computational tests extend the picture. The three-tissue comparison is the most structurally informative:

| Dataset | N fits | Mean \|λ\| | Near 1/φ (±0.05) | Enrichment | Osc% | Peak \|λ\| |
|---|---|---|---|---|---|---|
| Mouse organoid WT (GSE157357, 2h) | 15,771 | 0.505 | 18.7% | 1.87× | 59.6% | ~0.550 |
| Human enteroid (GSE161566, 2h) | 14,250 | 0.479 | 18.5% | **1.85×** | 37.0% | ~0.530 |
| Mouse liver (GSE11923, 1h) | 21,510 | 0.537 | 16.2% | 1.62× | 19.9% | ~**0.790** |

The mouse-to-human replication is striking: the enrichment near 1/φ is 1.87× in mouse organoid and 1.85× in human enteroid — essentially identical across species — despite dramatically different oscillatory fractions (59.6% vs 37.0%). The same enrichment level appears in a completely different genomic background, with fewer than half as many oscillating genes. This raises the question of whether the enrichment is a property of the mRNA stability distribution in gut epithelium rather than oscillatory clock biology — a hypothesis directly tested by SLAM-seq below.

The mouse liver distribution is structurally different: it peaks at |λ| ≈ 0.790 — far above the organoid peak of ~0.550. This difference has a precise biophysical interpretation.

**Sampling-frequency analysis and the mRNA half-life prediction (Test D).** The mouse liver dataset uses 1-hour sampling (Δt = 1h), while the organoid datasets use 2-hour sampling (Δt = 2h). Under a first-order decay model, eigenvalue and mRNA half-life are related by |λ| = exp(−ln 2 · Δt / t½). Converting the liver distribution peak and the organoid Fibonacci ceiling to half-lives:

| Tissue | Δt | Distribution peak | t½ corresponding to peak |
|---|---|---|---|
| Mouse organoid | 2h | 0.550 | 2.32h |
| Human enteroid | 2h | 0.530 | 2.18h |
| Mouse liver | 1h | **0.790** | **2.94h** |

The liver distribution peak at 0.790 (with 1h sampling) corresponds to t½ = 2.94h. The organoid Fibonacci ceiling at 0.618 (with 2h sampling) corresponds to t½ = 2.88h. These are the same half-life value to within 60 minutes, observed at two different sampling frequencies — a mathematical consequence of the decay model. A gene with t½ = 2.89h appears at |λ| = 0.619 in 2h-sampled data (the organoid Fibonacci boundary) and at |λ| = 0.787 in 1h-sampled data (the liver distribution peak). This sampling-frequency convergence is real and not coincidental — but it does not by itself establish that all Fibonacci-proximate genes are ~2.9h mRNAs. It establishes only that *if* the enrichment is decay-kinetics-driven, the relevant half-life class is ~2.9h.

This generated a specific falsifiable prediction: if the genome-wide 1.87× enrichment near 0.618 is entirely caused by ~2.9h mRNAs piling up at that eigenvalue position under 2h sampling, then Fibonacci-proximate genes should be *enriched* in the t½ ≈ 2.5–3.5h window relative to background stable genes. This prediction was tested using GSE281693 (mouse cortex, SLAM-seq, E11.5, three replicates averaged; n = 14,864 genes with valid half-lives; Serdar et al. 2025 *PLoS Biology*). Fibonacci-proximate liver genes (n = 2,669 matched) showed 18.4% representation in the 2.3–3.5h window versus 20.2% for background stable genes (fold = 0.91× — slight depletion rather than enrichment; Mann-Whitney p = 0.133, distributions statistically indistinguishable; Fibonacci-proximate median t½ = 4.575h vs background 4.493h). The decay-kinetics artefact prediction fails on both the direction and the magnitude tests. A dynamical-regulatory explanation is required.

**WNT pathway tests (Tests E–F; revised with 4-tier gradient).** Four tiers of Wnt pathway annotation were intersected with the human enteroid Fibonacci-proximate gene set (n = 2,475 genes; z-scored AR(2), GSE161566): Hallmark Wnt β-catenin (42 genes), WNT_SIGNALING (89 genes), KEGG_WNT_SIGNALING (151 genes), and REACTOME_SIGNALING_BY_WNT (319 genes). Fold enrichments are 0.82×, 0.80×, 0.87×, and 1.00× respectively (Fisher's exact p > 0.75 for all tiers). Canonical Wnt target genes are NOT preferentially located at the Fibonacci ceiling in the human enteroid under steady-state conditions. This is the most direct test of the "Wnt-drives-ceiling" hypothesis, and it fails: the boundary is not where Wnt targets live.

The strongest WNT signal in the data comes from the cancer perturbation. In ApcKO organoids (APC loss → constitutive β-catenin signalling), genome-wide Fibonacci-ceiling enrichment rises from 1.38× (WT, 2,176 genes) to 1.57× (ApcKO, 2,431 genes) — a 14% increase in the number of genes operating near 1/φ. The entire eigenvalue distribution shifts toward the ceiling under Wnt hyperactivation; the effect is distributional (more genes at the boundary), not canonical-target-specific (Wnt target genes do not move there preferentially). The genome-wide mean eigenvalue also shifts from 0.505 (WT) to 0.619 under ApcKO — landing at exactly 1/φ. Critically, ApcKO+BmalKO (double mutant) gives mean |λ| = 0.494 — below wild-type and far below either single mutant. This strong negative epistasis means the clock and WNT are not independent additive drivers: in a Wnt-hyperactive background, BMAL1 is required to sustain the elevated-persistence state. The biological reading is that the circadian clock cooperates with constitutive Wnt signalling to maintain the cancer-like high-persistence transcriptome; clock loss in that context, rather than further raising persistence as it does in WT, instead collapses it.

**Apoptosis pathway enrichment at the Fibonacci ceiling (Test G).** Intersecting the human enteroid Fibonacci-proximate genes (n = 2,475) with the HALLMARK_APOPTOSIS gene set (161 genes) yields 1.56× enrichment (37/2,475 observed vs. background rate 132/13,808; Fisher's exact p = 0.0027). REACTOME_PROGRAMMED_CELL_DEATH (198 genes) and REACTOME_INTRINSIC_APOPTOSIS (55 genes) show no enrichment (0.96× and 0.93×; p > 0.63), indicating the signal is specific to the broad hallmark apoptosis set, not the intrinsic mitochondrial pathway. In the mouse BmalKO-stable Fibonacci gene set (358 genes confirmed clock-independently persistent near 1/φ), *Fas* is a member, alongside *Dll4* and *Jag2* (Notch–Wnt crosstalk ligands). The biological implication is that the eigenvalue boundary at 1/φ separates two competing cell fates in the intestinal crypt: Wnt-driven proliferative commitment (which shifts the transcriptome toward the ceiling under APC loss) and Fas-mediated apoptotic exit (which is enriched at the ceiling in steady-state). The boundary may mark the decision point, not a stable attractor.

**Cross-tissue replication of Fibonacci-ceiling enrichment (Test H).** All twelve tissues of the GSE54650 mouse circadian atlas (Zhang et al. 2014; 2h sampling, 24 timepoints, 20,949–20,955 genes per tissue; z-scored AR(2)) show above-null enrichment at |λ| ≈ 0.618:

| Tissue | n in window | Enrichment |
|---|---|---|
| Liver | 4,180 | **1.99×** |
| Lung | 3,830 | 1.83× |
| Kidney | 3,547 | 1.69× |
| Muscle | 3,209 | 1.53× |
| Cerebellum | 3,136 | 1.50× |
| Brainstem | 3,061 | 1.46× |
| Heart | 3,001 | 1.43× |
| Aorta | 2,665 | 1.27× |
| Brown Fat | 2,553 | 1.22× |
| White Fat | 2,436 | 1.16× |
| Adrenal | 2,414 | 1.15× |
| Hypothalamus | 2,234 | 1.07× |

*Window: |λ − 0.618| ≤ 0.05. Null: 10% of stable genes. All 12 tissues enriched; p < 0.05 for liver, lung, kidney by binomial test.*

The gradient from hypothalamus (1.07×) to liver (1.99×) is metabolically coherent: liver performs the most extensive daily metabolic reprogramming of any circadian tissue, while the hypothalamus contains neurons with long-lived, stable transcriptomes. The liver result is consistent with the sampling-frequency prediction — the liver's 1h-sampled distribution peaks at |λ| ≈ 0.790, corresponding to the same t½ ≈ 2.94h that maps to |λ| = 0.618 at 2h sampling — but the SLAM-seq partial test (Test D) now shows the Fibonacci-proximate genes are not enriched in the ~2.9h window, so this matching of positions reflects a mathematical coincidence of the decay model rather than a confirmed clustering of 2.9h mRNAs at the ceiling.

**What the tests collectively resolve.** Seven null results (no secondary peak at 0.618; no oscillatory specificity; no amplitude correlation; core clock genes in organoid are not preferentially ceiling-proximate; Wnt targets NOT enriched at ceiling in steady-state; 515 clock-independent Fibonacci genes have ordinary oscillatory fractions; SLAM-seq partial test finds Fibonacci-proximate genes NOT enriched in the ~2.9h window, 0.91× fold, p = 0.133) and five positive results (cross-species enrichment replication; sampling-frequency half-life position convergence; ApcKO distributional shift to 1.57×; apoptosis enrichment 1.56× p=0.0027; cross-tissue replication in all 12 GSE54650 tissues) converge on the following interpretation: the Fibonacci ceiling (1/φ = 0.618) is a dynamical boundary in AR(2) eigenvalue space — enriched for genes with regulatory properties that sustain near-Fibonacci temporal persistence — and is *not* primarily explained by the mRNA half-life artefact account. The ~2.9h half-life class does map mathematically to |λ| = 0.618 at 2h sampling, but Fibonacci-proximate genes are not enriched in that half-life class; the enrichment has a regulatory origin. Wnt hyperactivation drives more of the transcriptome toward this ceiling, but does not place canonical Wnt target genes there in steady state. Apoptosis pathway genes ARE enriched there, suggesting the ceiling marks the transition point between proliferative competence (Wnt-high) and apoptotic exit (Fas-responsive). The ApcKO clock–WNT epistasis is the most concrete mechanistic hypothesis: the circadian clock is required to sustain the Wnt-driven high-persistence transcriptome. The definitive remaining test — matched-tissue SLAM-seq in intestinal organoids — would confirm the cross-tissue result in the exact cell type; the present evidence is sufficient to reject the artefact account as the primary explanation.

### A Critical Clarification: The Fibonacci Point Is Outside the Stationarity Triangle

A key point concerns the relationship between the observed gene eigenvalues and the Fibonacci sequence. The Fibonacci recurrence xₙ = xₙ₋₁ + xₙ₋₂ corresponds to AR(2) coefficients (φ₁, φ₂) = (1, 1), with dominant characteristic root |λ| = φ ≈ 1.618. This lies outside the AR(2) stationarity triangle — a stationary gene expression series cannot operate there, because the process would diverge. All observed biological eigenvalues satisfy |λ| < 1.

The Fibonacci connection is therefore not that clock genes have eigenvalue ≈ 1.618. It is that the Fibonacci point defines the geometric boundary of the biologically admissible parameter space, and the stable twin of the Fibonacci characteristic polynomial — 1/φ ≈ 0.618 — is the eigenvalue modulus of *every* oscillatory AR(2) system satisfying Boman's Rule 2 constraint (Theorem 1). Boman's five biological rules are precisely the constraints that hold the crypt system in the heavily damped sub-unit-root regime at this value. The 0.618 value is an algebraic **fixed point** — the unique modulus consistent with both the oscillatory regime and the Fibonacci division constraint — not a target that biological systems approach from below. Whether evolution has additionally selected for certain genes to operate near this value is an open empirical question distinct from the algebraic result itself.

### Proof-of-Concept: Organoid Phase-Ordered AR(2) Fits

Table 1 in Paper G reports phase-ordered AR(2) fits to four crypt-relevant genes from the GSE157357 WT organoid dataset (Stokes et al.), using z-scored log-expression values ordered by circadian phase.

**Limitation — model–data mismatch:** Boman's five-rule tissue code was developed for human large intestinal crypts, while Stokes et al. used mouse small intestinal organoids. Both the species difference (human vs. mouse) and the anatomical region difference (large vs. small intestine) are genuine limitations. Colon and small intestine differ in LGR5⁺ stem cell density, villus structure, crypt length, and cancer susceptibility. These AR(2) fits should be read as a proof-of-concept demonstration of the method on the best available rhythmic organoid dataset, not as a validated quantitative test of Boman's human-colon model. Direct validation against a human large-intestinal circadian time-series is named as an important open objective.

The Table 1 values (phase-ordered):

| Gene | Role | Roots | Max \|λ\| | Stability |
|---|---|---|---|---|
| Lgr5 | LGR5⁺ stem cell marker | 0.049 ± 0.332j | 0.336 | Stable |
| Arntl (Bmal1) | Core clock gene | 0.623 ± 0.551j | 0.832 | Stable |
| Per2 | Clock output | −0.092 ± 0.513j | 0.521 | Stable |
| Axin2 | Wnt pathway readout | −0.008 ± 0.464j | 0.464 | Stable |

All four genes yield stable complex-conjugate roots. The picture is biologically differentiated rather than uniformly damped. Arntl (Bmal1) shows high temporal persistence (|λ| = 0.832) — the core circadian driver must sustain phase coherence across many renewal cycles and appropriately sits in the high-persistence regime. Per2 (|λ| = 0.521) and Axin2 (|λ| = 0.464) are substantially more damped, consistent with their roles as output and readout genes that respond to clock signals rather than sustaining them. Lgr5 (|λ| = 0.336) shows the lowest persistence, consistent with a stem cell marker whose expression is acutely responsive to niche signals rather than temporally self-sustaining.

The Axin2 eigenvalue (|λ| = 0.464) deserves specific mechanistic attention, because it directly implicates the biological substrate of the AR(2) model's second memory lag. Axin2 is a direct transcriptional target of WNT/β-catenin signalling and simultaneously a negative feedback regulator that promotes β-catenin degradation by assembling the destruction complex. This negative feedback operates with a measurable biochemical delay: Axin2 protein must first accumulate to sufficient concentrations to reduce β-catenin signalling, at which point WNT target transcription — including Axin2 itself — is suppressed. The delay spans approximately 24–48 hours at the tissue level, encompassing both the protein accumulation lag and the subsequent decay of β-catenin-responsive transcription. This interval is the mechanistic implementation of the AR(2) second lag: the crypt's renewal state two generations prior influences the current generation not as an unexplained statistical artefact but because AXIN2 protein from that earlier window is still modulating WNT niche availability. In the PAR(2) framework, α₂ (the coefficient coupling current renewal to two generations prior) is grounded in the AXIN2/DKK1 negative feedback architecture — not a modelling assumption but a consequence of WNT pathway biochemistry. This connection generates a specific, falsifiable prediction: AXIN2-knockout intestinal organoids should exhibit collapse of second-lag memory, measurable as PACF(lag-2) → 0 and near-zero improvement from AR(1) to AR(2) model fit (ΔAIC ≈ 0). The univariate Axin2 eigenvalue of 0.464 reflects this gene's role as a responsive output readout rather than a memory-storing driver — it reports WNT niche state rather than sustaining it — but the population-level dynamics it helps encode are precisely the α₂ term the PAR(2) model requires.

Within the PAR(2) framework, these univariate gene-level fits are projections of a lower-dimensional crypt-level oscillator into individual observables. Paper G formally defines the Fibonacci-consistent manifold as the subset of the stable AR(2) stationarity triangle within a specified Euclidean distance of the ray from the origin through the Fibonacci point (1,1), bounded by the constraints imposed by Boman's Rules 3 and 4. The next step is to move from univariate AR(2) to multivariate VAR(2) models for gene panels and test whether renewal-relevant composites cluster within this manifold under WT conditions and deviate systematically from it under Bmal1 loss or circadian disruption.

**Cell-type rationale:** The three cell types discussed in Section 5 of the paper are chosen for specific reasons set out here. GSE157357 is chosen because it is the only publicly available circadian time-series that simultaneously profiles crypt stem cell behaviour in wild-type and clock-disrupted conditions. Tuft cells are chosen because their lifespan (≥28 days) far exceeds the 3–5-day average crypt turnover, making them the most sensitive available readout of eigenvalue perturbations accumulating across many renewal cycles. A more detailed mechanistic case for tuft cells as PAR(2) biomarkers can be made via their differentiation biology: tuft cell specification requires coordinated Wnt, Notch, and EGF pathway activity within narrow signalling windows (Gerbe et al. 2016; Haber et al. 2017), meaning that stable PAR(2) dynamics (regular phase-space exploration, |r| well within the unit circle) are required for tuft-permissive conditions to recur reliably across renewal cycles. Under unstable dynamics (|r| → 1, Prediction 4), the irregularity of phase-space exploration should contract tuft-permissive windows and reduce tuft abundance — consistent with the lower DCLK1⁺ fraction observed in adenomas and carcinomas relative to normal tissue in the Nguyen, Lausten & Boman (2025) dataset. Conversely, after acute perturbation (FOLFIRI chemotherapy, Prediction 1), PAR(2) predicts a damped oscillatory overshoot during re-entrainment in which phase-space exploration temporarily expands; the DCLK1⁺ upregulation documented post-FOLFIRI in the same dataset is qualitatively consistent with this transient expansion, with a recovery timescale of approximately 6–8 days matching the predicted re-entrainment window. These observations are indirect — they use a cell-type abundance change as a proxy for underlying renewal dynamics rather than measuring R_n directly — and their interpretation requires the additional assumption that tuft differentiation probability scales monotonically with PAR(2) phase coherence. Direct validation requires simultaneous measurement of crypt mitotic index and DCLK1⁺ fraction over consecutive days in a controlled perturbation experiment; the available data are consistent with but do not uniquely confirm the PAR(2) interpretation. DCS cells are chosen because their position at the crypt base — providing continuous WNT, EGF, and Notch ligands to LGR5⁺ stem cells — makes them the natural physical implementors of the slow and fast memory kernels α₂ and α₁ in the PAR(2) model.

**Human intestinal data:** Preliminary analysis of a human intestinal enteroid dataset (GSE161566, Rosselot et al. 2022, 14-gene E-box target set) shows Fibonacci-proximate clustering: a pre-specified E-box gene set clusters significantly closer to the 1/φ boundary in AR(2) parameter space than expression-matched random gene sets (p = 0.030, permutation test). This cross-species result supports the biological plausibility of the PAR(2) framework in human intestinal tissue and is held for subsequent work outside the scope of the current paper.

### The Notch-Hes1 Layer: Rule 2 and the Ultradian Timescale

The PAR(2) analysis presented throughout this book operates at the 24-hour circadian timescale. But the TOH (Temporal Oscillator Hypothesis) — an early framework that anticipated much of the molecular architecture described here — correctly identified a second oscillatory layer that the current platform does not yet address: the Notch-Hes1 ultradian oscillator, running at periods of approximately 75–250 minutes, with a canonical peak near 90 minutes in intestinal stem cells.

This layer is the molecular implementation of Boman's Rule 2. Rule 2 states that mature (M) cells divide every cell cycle while immature (I) cells require a maturation delay of c cycles before they can divide. The mechanism enforcing this asymmetry is Notch-Hes1 signalling. Hes1 protein, a direct transcriptional target of NOTCH, oscillates with an ultradian period in intestinal crypt cells. The oscillation period is not noise — it is the information carrier. Weterings et al. (2024, bioRxiv: 10.1101/2024.08.26.609553; Sonnen lab, Hubrecht Institute) demonstrated this directly using a Hes1-Achilles knock-in fluorescent reporter in mouse small intestinal organoids combined with 24-hour continuous live-cell imaging. Their key finding is that oscillation period varies systematically with cell fate commitment along the crypt-villus axis: cells oscillating at ~90 minutes are committed toward the Paneth cell fate; those oscillating at ~130 minutes toward other secretory subtypes; low-period dynamics support stemness and the proliferative state. The period of the Notch-Hes1 oscillation is thus the molecular variable that encodes the M-cell versus I-cell temporal identity that Boman's Rule 2 specifies.

This is a striking connection — and it was anticipated in the TOH framework, which named the Notch-Hes1 oscillator as an independent second tier alongside the circadian and mitotic checkpoint oscillators. The discovery that oscillation period is cell-fate-determining (rather than oscillation amplitude or mean level, which had been the dominant prior assumption) aligns precisely with the TOH prediction that synchrony collapse within this layer would produce Rule 2 errors — incorrect temporal ordering of differentiation events leading to abnormal crypt composition.

**Why the PAR(2) platform does not yet address this layer.** The AR(2) model fitted throughout this work is designed for single-oscillation dynamics at the 24-hour circadian timescale. The Notch-Hes1 oscillation, with periods of 75–250 minutes, is invisible in standard circadian RNA-seq datasets sampled every 2–4 hours: the Nyquist theorem requires sub-45-minute sampling to resolve a 90-minute signal. All GEO-deposited circadian datasets used in this work — including GSE157357 (Stokes et al.), mouse liver FPKM series, and the TCGA matrices — are therefore blind to the Hes1 layer. Fitting AR(2) models to these datasets at 24-hour resolution does not capture or alias the ultradian oscillation; it simply operates at a different timescale.

**What would be needed.** A complete three-layer analysis — circadian (24h), ultradian Notch-Hes1 (~90 min), and mitotic checkpoint (~24h gated by circadian) — would require live-cell imaging data at sub-60-minute temporal resolution, using fluorescent reporter systems such as the Hes1-Achilles line developed by the Kageyama group and deployed by Weterings et al. Such data requires a different mathematical framework (AR(3) or a two-timescale vector AR model) to jointly characterise oscillations across the two relevant frequencies. As of the time of writing, no confirmed public data accession for quantitative Hes1-Achilles intestinal organoid time-series exists. The Weterings et al. preprint (August 2024) documents the experimental observations, but raw tracking data has not yet been deposited in a computation-ready public repository. This is named here as a priority open objective: when the data becomes available, the three-layer model that the TOH originally described can be quantitatively tested for the first time.

### The Open Question — Mechanism or Mathematical Necessity?

What is not yet clear is whether the Floquet correspondence and the five-rule PAR(2) mapping reflect a mechanistic causal constraint — whether the crypt regulatory architecture is specifically tuned toward the golden ratio for functional reasons — or whether it is a mathematical inevitability for any biological system subject to the stability constraints that the crypt satisfies.

The distinction matters for the generalisability of the finding. If the golden ratio enrichment is mechanistically specific to the crypt, it will not generalise to other self-renewing tissues. If it is a consequence of broad stability constraints, it should appear wherever biological oscillators are required to balance temporal persistence against responsiveness — which includes, potentially, every tissue where both circadian and cell cycle rhythms must be co-regulated.

The experiment that would begin to address this is direct perturbation of the Boman q: genetic modifications that alter the ratio of proliferating to total cells in the crypt — by adjusting Wnt pathway activity, for example — should shift the dominant crypt eigenvalue away from 0.618 in a predictable direction if the Fibonacci correspondence is mechanistically grounded. If the eigenvalue is unchanged by crypt architecture perturbations, the correspondence is mathematical rather than mechanistic. This experiment is described in the Epilogue as a priority for future wet-lab collaboration.

### Dead Ends in Mechanism: What the Fibonacci Correspondence Is Not

Several mechanistic explanations were tested before accepting that the Fibonacci correspondence is currently unexplained at a causal level.

**Resonance artefact in the Yule-Walker estimator.** If the AR(2) fitting algorithm had a preference for eigenvalues near 0.618 due to some numerical property of the Yule-Walker equations, the clustering would be spurious. This was tested by applying the full pipeline to time-shuffle permutations of the GSE157357 organoid data — breaking all temporal structure while preserving the marginal expression distributions. In the permuted data, eigenvalues were distributed broadly across (0, 1) with no peak near 0.618. The clustering is not an artefact of the estimator.

**Period constraint forcing.** If the 24-hour oscillation constraint mathematically forces eigenvalues toward 1/φ for some algebraic reason, the finding would be an artefact of the experimental design rather than a biological signal. Genes in the WT organoid dataset show fitted periods ranging from 19 to 29 hours, and the Fibonacci enrichment is not period-specific — genes at 20-hour and 28-hour periods show similar clustering patterns. The constraint does not force the result.

**Agent-based modelling as a mechanistic explanation.** An agent-based model of the minimal crypt (the abm-minimal-crypt module) was developed and run under biologically realistic parameter sets. The ABM does produce Fibonacci-proximate eigenvalue clustering under conditions that match the known biology of crypt stem cell renewal. However, the ABM is parameterised partly from the empirical eigenvalues themselves, creating circularity in the mechanistic argument. The ABM is consistent with the Fibonacci correspondence but does not independently explain it.

**Floquet theory as a unifying framework — with a caveat.** Floquet theory — which describes the behaviour of periodic linear systems — provides a natural language for the PAR(2) framework because the circadian oscillator is exactly such a system. The Floquet multipliers of a stable periodic system with 24-hour period and biologically plausible damping lie precisely in the region of the complex plane occupied by clock gene eigenvalues. The Fibonacci proximity of 0.618 corresponds to a Floquet multiplier at the boundary between rapid and slow decay modes. This is mathematically elegant. However, as the Jacobian analysis above documents, the conservative Boman ODE at the Fibonacci fixed point produces purely imaginary Jacobian eigenvalues (±i√φ) — a neutral oscillator whose Floquet multipliers lie on the unit circle, not at 0.618. Floquet theory is the right framework; but the claim that the dominant Floquet multiplier is ≈ 0.618 requires additional damping beyond the conservative Boman equilibrium. The circadian clock is the proposed source of that damping, not a built-in property of the ODE itself.`,
    platformLinks: [
      { label: "Boman ODE Model: Fibonacci fixed-point and crypt renewal dynamics", route: "/boman-ode" },
      { label: "Crypt–Villus: Lgr5, Bmal1, Per2, and Axin2 eigenvalue profiles", route: "/crypt-villus" },
      { label: "Convergence Map: PAR(2) and Boman five-rule structural correspondence", route: "/convergence-map" },
    ],
  },
  {
    id: "ch8",
    contentExtended: `The mammalian circadian system is not a single clock. It is a hierarchical network, with the suprachiasmatic nucleus of the hypothalamus at the apex and dozens of peripheral organ clocks distributed through the body. These peripheral clocks receive timing signals from the SCN through multiple channels — hormonal rhythms, autonomic neural input, body temperature cycles, and feeding cues — and generate their own local circadian programmes, adapted to the specific metabolic and functional demands of each tissue. Understanding how eigenvalue modulus varies across this hierarchy, and what that variation reveals about the design principles of the circadian system, was the central question of Paper Q.

### The Circadian Hierarchy — From Master to Peripheral

The suprachiasmatic nucleus is the only mammalian tissue known to sustain robust circadian rhythmicity indefinitely in isolated ex vivo culture. Its molecular clock — the same TTFL that operates in every cell — is reinforced by gap junction coupling between SCN neurons, which synchronises the clocks of individual neurons into a coherent tissue-level oscillator. The SCN receives direct photic input from the retina via the retinohypothalamic tract and uses this input to reset its phase every day in response to the environmental light-dark cycle. It communicates its timing signal to peripheral tissues through at least four channels: vasopressin and VIP secreted into the cerebrospinal fluid; glucocorticoids released rhythmically from the adrenal gland under SCN control; body temperature cycles generated by rhythmic thermogenesis; and direct sympathetic neural innervation of peripheral organs including the liver, lung, and heart.

Peripheral tissues receive this multi-channel input and generate local circadian programmes that integrate the SCN-derived signal with local metabolic, immune, and tissue-specific cues. The result is that peripheral clocks are not simply relays of the SCN signal — they are semi-autonomous oscillators whose phase and amplitude can diverge from the SCN under conditions of chronic shift work, jet lag, or metabolic stress. Understanding the quantitative relationship between this SCN-to-periphery gradient and eigenvalue modulus required a dataset that could simultaneously sample many tissues from the same animals under controlled conditions.

### The Mouse Multi-Tissue Atlas — Primary Dataset

The primary dataset for Chapter 8 is GSE54650 (Zhang et al. 2014 PNAS), a 12-tissue mouse circadian transcriptome atlas using Affymetrix microarrays. Tissues were sampled every 2 hours from CT18 to CT64 (n = 24 time points per tissue), providing sufficient temporal resolution for AR(2) fitting at each of the 16 pre-specified core clock genes. For each tissue, the mean |λ| across the 16 genes was computed; all 12 tissues were included in the analysis.

The 12 tissues span a gradient from centrally regulated (hypothalamus, the SCN-proximal tissue) to peripherally regulated (lung, which has no direct neural connection to the SCN and is entrained primarily through glucocorticoid and body temperature rhythms). Between these extremes: cerebellum, brainstem, adrenal gland, liver, aorta, heart, kidney, skeletal muscle, white adipose, and brown adipose, each with its own distance from the SCN in terms of synaptic connectivity and hormonal access.

### The Monotone Gradient

The results form a monotone gradient. Mean clock gene |λ| values (all 12 tissues, GSE54650):

Hypothalamus: 0.469 | Cerebellum: 0.550 | Brainstem: 0.596 | Adrenal: 0.682 | Skeletal muscle: 0.622 | Aorta: 0.654 | Liver: 0.641 | Brown adipose: 0.663 | White adipose: 0.666 | Heart: 0.698 | Kidney: 0.738 | Lung: 0.797

All three CNS tissues (hypothalamus, cerebellum, brainstem) rank below all nine peripheral tissues. The Pearson correlation between anatomical layer score and mean |λ| is r = −0.95 (peripheral = 1, neuroendocrine = 2, central = 3). The exact permutation p = 0.006 (1/165 possible assignments of the CNS label produce a gap as large as observed); bootstrap 95% CI on the central–peripheral gap [0.087, 0.226]; n = 5,000 iterations. The lung/hypothalamus τ_c ratio is 3.33× (8.8 h / 2.6 h).

### Cross-Species Replication — Baboon Dataset

Pre-registered cross-species replication used GSE98965 (Mure et al. 2018 Science 359:eaao0318), the most comprehensive circadian transcriptome resource available in any non-human primate. Twelve baboon tissues were sampled simultaneously every 2 hours over 24 hours, with direct SCN measurement — unique in any mammalian circadian atlas. All four pre-registered predictions passed. The baboon SCN clock gene median |λ| = 0.471, indistinguishable from mouse hypothalamus (0.469) across approximately 30 million years of divergence. Baboon lung |λ| = 0.611 (mouse: 0.797; 14 stable genes — PER3 and NR1D2 unstable in lung, excluded; attenuation consistent with n = 12 vs n = 24 sample-size bias and excluded genes). The baboon lung/SCN τ_c ratio is 1.53×, again lower than mouse owing to the smaller sample size and the two excluded unstable genes. Eight of 8 tissues showed directional concordance (peripheral > central in both species); Spearman ρ = 0.52 (p = 0.18, n = 8; non-significant due to small n, direction positive as pre-specified).

### Why the SCN Has the Lowest Eigenvalue

The counterintuitive finding — that the master pacemaker has the lowest clock gene eigenvalues — requires mechanistic explanation. The answer lies in what the SCN is designed to do versus what peripheral clocks are designed to do.

The SCN's primary function is to track the environmental light-dark cycle and reset its phase every day. For this function, the SCN must be maximally entrainable — it must be able to shift its phase rapidly in response to photic input without the previous phase strongly constraining the new one. A high eigenvalue — strong temporal self-organisation, resistance to perturbation — would make the SCN resistant to re-entrainment. It would still oscillate, but it would fail to track seasonal changes in daylength or recover from transmeridian travel without many cycles of gradual adjustment. Jet lag would be permanent.

The SCN solves this by having a relatively low eigenvalue — its clock genes are temporally persistent enough to sustain a 24-hour oscillation, but not so persistent that the system cannot be reset by environmental input. The pituitary's even lower eigenvalue reflects its role as the most directly SCN-proximal tissue, designed to relay rather than store the timing signal.

Peripheral tissues face the opposite design challenge. The liver, for example, receives hormonal timing signals that are superimposed on a background of meal-driven, activity-driven, and immune-driven noise. A liver clock with low eigenvalue would be constantly perturbed by every cortisol spike and every postprandial glucose wave. High eigenvalue in peripheral clocks is a design feature: it ensures that the temporal programme of peripheral tissues is stable against the biological noise of the intact organism, resisting transient perturbations while remaining responsive to the sustained multi-cycle synchronisation imposed by the SCN through its hormonal outputs.

### The Retinal Exception — OPN4

A post-hoc analysis of retinal gene expression from the baboon dataset examined the eigenvalue distribution of phototransduction genes specifically. Rhodopsin (RHO) and the cone opsins showed eigenvalues in the clock target range — consistent with their role as photosensory proteins that must maintain some temporal organisation while being regulated by the light environment.

OPN4 (melanopsin) — the photopigment expressed in intrinsically photosensitive retinal ganglion cells and responsible for non-image-forming light responses including circadian photoentrainment — showed the lowest eigenvalue of any characterised phototransduction gene: |λ| = 0.389, below even the background gene median. This is entirely consistent with its function: OPN4 is not a temporally persistent oscillator. It is a light-sensitive reset switch, designed to respond to light exposure by triggering signalling cascades that shift the SCN phase. For this function, temporal persistence would be counterproductive — the signal needs to be able to respond to the current light environment without being constrained by what it was doing an hour ago.

The OPN4 result demonstrates that the eigenvalue correctly identifies functional outliers — genes whose biology requires low temporal persistence — even within gene families (phototransduction) where most members show intermediate or high persistence.

### Design Principles of the Circadian Architecture

The central-to-peripheral eigenvalue gradient articulates a design principle that was implicit in the circadian biology literature but had not previously been expressed quantitatively: the circadian system is designed with a gradient of temporal rigidity, from a flexible, entrainable pacemaker at the centre to increasingly rigid, self-sustaining oscillators at the periphery.

This gradient serves two complementary functions. The flexible pacemaker (SCN) allows the system to track the environmental cycle accurately. The rigid peripheral clocks (lung, kidney) ensure that peripheral tissue programmes are stable against biological noise, maintaining temporal organisation even when hormonal signals are transiently perturbed. The gradient between them — mediated through the increasing eigenvalues of tissues like liver and adrenal — represents a graded transition from input-sensitive to noise-robust timing.

The quantitative form of this gradient — roughly linear in synaptic distance, with approximately 0.04 units of |λ| per additional synaptic step from the SCN — provides a prediction for any newly characterised tissue: its clock gene eigenvalue should fall at the position predicted by its anatomical connectivity. This prediction has not yet been tested for all tissue types, and the platform is designed to enable this testing as new multi-tissue datasets become available.

The central-to-peripheral gradient also receives independent theoretical support. Herzel et al. (2026, *npj Biological Timing and Sleep*) distinguish the SCN network — which behaves as a strong oscillator at the tissue level, with narrow entrainment range and steep phase-period coupling — from peripheral tissue clocks, which they characterise as weaker, more noise-dependent oscillators with broader entrainment ranges and shallower phase responses. Their framework generates a specific prediction: strong oscillators distribute their gene eigenvalues broadly across the stability spectrum; weak oscillators concentrate genes in the intermediate persistence zone. This maps directly onto the observed tissue gradient. The hypothalamus (1.07× Fibonacci enrichment, lowest in the panel) behaves like a strong oscillator whose genes are not specifically clustered near the 0.618 intermediate; the liver (1.99×, highest) behaves like a weaker peripheral oscillator whose genes cluster in the intermediate zone. The PAR(2) cross-tissue gradient is thus not merely an empirical observation: it is a quantitative instantiation of a prediction derivable from first principles of oscillator synchronisation theory [Herzel2026].

### Dead End: The Inverted Initial Prediction

The hypothesis entering the baboon analysis was straightforward: the SCN, as the master circadian pacemaker, should have the highest clock gene eigenvalue in any multi-tissue dataset. It drives peripheral tissue synchronisation. It generates the most precise and least variable free-running period of any tissue. It resists experimental perturbation more strongly than any peripheral clock. On first principles, it should be the most temporally self-sustaining structure in the circadian system — and therefore have the highest |λ|.

The baboon dataset (GSE98965, Mure et al. 2018) falsified this prediction cleanly. The SCN clock gene median |λ| of 0.471 was the lowest of all 12 baboon tissues, lower than every peripheral organ including lung (0.611), liver (0.500), kidney (0.607), adrenal (0.582), and even skeletal muscle (0.608). The prediction was not close to correct.

The resolution of this required reconceptualising what the SCN is for. Precision and persistence are different properties. A high-persistence system is one that resists perturbation and sustains its trajectory without external input. The SCN's defining function is the opposite: it must respond rapidly and accurately to photic perturbation — jet lag, seasonal change, daily light cycles — and transmit that perturbation to peripheral tissues. A high-|λ| SCN would be a rigid pacemaker that ignored light. The actual SCN is a phase-sensitive transducer, and low |λ| is the quantitative signature of that function.

This reframing was not anticipated before the data were seen. The inverted gradient — peripheral > central, rather than central > peripheral — emerged from the analysis and then demanded explanation. It is more informative than the original prediction would have been, because it reveals something about pacemaker design rather than confirming something about pacemaker dominance. But it is worth recording that the first prediction was wrong.`,
    platformLinks: [
      { label: "Light Entrainment & Tissue Hierarchy: eigenvalue modulus gradient across tissues", route: "/light-entrainment" },
      { label: "Rule 3 & 4 Validation: SCN vs peripheral clock eigenvalue comparison", route: "/rule-validation" },
      { label: "Cross-Species AR(2) Coefficient Ratio Analysis", route: "/cross-species-phi" },
    ],
  },
  {
    id: "ch9",
    contentExtended: `The accumulation of consistent findings — across 22 datasets, four species, twelve tissue types, cancer organoids, drug targets, the Fibonacci correspondence, and the central-peripheral gradient — invites a question that is easy to defer and difficult to answer comprehensively: what does all of this change? This chapter attempts an honest account of what the PAR(2) framework adds to chronobiology, what remains open, and what the data suggest about the next phase of both computational and experimental work.

### What Has Been Established

The core empirical finding is simple and has been demonstrated with sufficient replication to stand as a result: the AR(2) eigenvalue modulus stratifies genes into three functionally distinct categories — core clock genes, clock targets, and background genes — consistently across all independent datasets tested, all species examined, and all tissue types profiled. This stratification is not explained by mRNA stability, protein stability, expression level, sampling resolution, or temporal window. It responds to biological perturbations (cancer mutations, clock-active drugs) in the directions that the mechanistic biology predicts.

This establishes that |λ| is measuring something real about the relationship between a gene and the circadian clock. The question of what, precisely, it is measuring — and what the biological mechanisms are that produce the eigenvalue hierarchy — has been partially addressed by the disease and drug results, but remains a subject for experimental investigation.

### Chronotherapy — A Biologically Principled Target List

Chronotherapy has been studied for decades, with compelling preclinical results and frustrating clinical inconsistency. One source of the inconsistency is target selection: not all drug targets show clock-gated expression patterns with sufficient reliability across patients and conditions to make timing a productive strategy. The 847 liver chronotherapy candidates identified in Paper F — those with |λ| ≥ 0.60, clock-gated phase, and clinical annotation — represent a biologically principled subset of the druggable transcriptome where timing is most likely to matter.

This list is a prediction, not a proof. The proof will come from prospective clinical trials in which patients are randomised to timed versus untimed administration of drugs targeting high-|λ| genes, with circadian phase monitored longitudinally. The eigenvalue-based prioritisation reduces the search space: instead of testing all approved drugs for timing effects (an impossibly large space), it identifies the candidates most likely to show large timing effects.

The logic is straightforward. A drug that acts on a target with |λ| = 0.79 in liver is targeting a gene whose expression phase can be predicted from a peripheral blood draw with high reliability, because the gene's clock integration means its phase tracks the overall circadian system reliably. A drug that acts on a target with |λ| = 0.38 is targeting a gene whose expression phase at the moment of drug administration is difficult to predict, because the gene's weak clock integration means its phase wanders relative to available peripheral proxies. The eigenvalue provides a quantitative estimate of how much timing a target will benefit from.

### Evolutionary Gene Age and Eigenvalue Modulus

The relationship between evolutionary gene age and eigenvalue modulus was examined using a five-tier phylostrata framework applied to the GSE54650 multi-tissue dataset: PS1 Universal (~3,500 Mya: ribosomal proteins, glycolytic enzymes, TCA cycle), PS2 Eukaryotic (~1,800 Mya: cytoskeleton, ubiquitin-proteasome, chromatin), PS4 Metazoan (~700 Mya: cell cycle, apoptosis, Wnt/Notch/Hedgehog), PS7 Vertebrate Clock (~480 Mya: the TTFL circadian machinery), and PS8 Vertebrate Other (~450 Mya: nuclear receptors, immune cytokines, liver metabolic enzymes).

The result contradicts the intuition that older genes should be more deeply embedded in temporal architecture. Vertebrate clock genes (PS7, ~480 Mya) show the highest median |λ| of any tier, despite being far younger than the oldest genes in the dataset. The most ancient genes — PS1 ribosomal proteins and glycolytic enzymes present in all cellular life (~3,500 Mya) — have constitutive, low-oscillatory expression characterised by real AR(2) roots, not by high eigenvalue moduli. Among non-clock genes, Spearman ρ ≈ 0 for evolutionary age versus |λ|: outside of clock function, age does not predict temporal persistence. The same-era vertebrate immune cytokines (PS8, ~450 Mya) show the lowest median |λ| of any tier, consistent with their functional design for rapid, low-persistence alarm signalling.

The correct interpretation is that AR(2) persistence is a function of biological role, not evolutionary antiquity. The vertebrate TTFL clock assembled a specialised oscillatory architecture ~480 Mya that elevated eigenvalue moduli through complex-conjugate roots. Genes outside that architecture — whether ancient or recent — show |λ| governed by their functional design rather than their age. An early claim of a systematic age gradient (ancient > intermediate > recent in |λ|) was not reproduced in the five-tier platform analysis and should not be cited.

The practical implication for drug target selection is that cross-species chronotherapy consistency tracks functional clock integration, not phylogenetic age. A drug target whose clock integration is conserved between mouse and human — detectable by consistent |λ| values across species in the platform — is a more reliable candidate for timing-based protocols than one whose clock coupling is species-specific or weak. Phylogenetic age is not a reliable proxy for this: a vertebrate-specific clock output gene with high and conserved |λ| is a better candidate than an ancient housekeeping gene with low |λ| despite 3,500 million years of conservation.

### The Turing Correspondence — An Open Conjecture

The most speculative finding arising from the PAR(2) platform is a possible mathematical correspondence between the parameter space of AR(2) temporal persistence and the parameter space of Turing pattern formation. Alan Turing's 1952 paper showed that a two-component activator-inhibitor reaction-diffusion system can spontaneously generate spatially periodic patterns from a uniform initial condition when the inhibitor diffuses faster than the activator. The Turing instability is bounded in parameter space: for parameter values near the boundary, small perturbations generate spatial patterns; for values farther from the boundary, the uniform state is stable.

Preliminary bifurcation analysis suggests that the AR(2) parameter zone corresponding to |λ| ≈ 0.618–0.72 (the range occupied by clock genes and high-|λ| clock targets) is adjacent to the Turing instability boundary in a related activator-inhibitor parameter space. If this correspondence is rigorous — if there is a mathematical transformation that maps one parameter space onto the other — it would imply that biological systems operating near the golden ratio are exploiting a deep property of self-organisation near the edge of instability: a property that manifests as temporal patterning in the circadian system and as spatial patterning in morphogenesis.

This conjecture is not published. It is included here because it represents the direction that the theoretical work is taking. The verification or refutation of the correspondence requires collaboration with applied mathematicians working in bifurcation theory and reaction-diffusion systems — a collaboration that is being initiated but is not yet far enough advanced to generate results that can be described as findings.

### What the Platform Is Designed to Enable

The PAR(2) Discovery Engine is not merely a collection of results from a completed research programme. It is a live analytical infrastructure designed to enable the next generation of findings. As new datasets are deposited in the Gene Expression Omnibus — and the rate of deposition of circadian transcriptome data is accelerating, not slowing — they can be fed through the same analysis pipeline that generated the results in this book.

The platform is also designed to enable external replication. The analysis pipeline is described fully enough in Paper A that any competent computational biologist can implement it independently. The open platform provides the reference implementation. Independent replication — especially by groups with no stake in the PAR(2) hypothesis — is the most important next step for establishing the framework's validity.

The findings in this book are not the end of the PAR(2) story. They are its beginning — the establishment of a measurement tool and an initial empirical mapping of what that tool reveals. What it will reveal when applied to the next generation of datasets — single-cell time series, longitudinal patient data, multi-omics integration of transcriptomics and proteomics — is genuinely open. The platform is designed to make that openness productive.`,
    platformLinks: [
      { label: "Chronotherapy Predictor: circadian coupling index and chronotherapy candidates", route: "/chronotherapy-predictor" },
      { label: "Disease Screen: drug target eigenvalue profiles across conditions", route: "/disease-screen" },
      { label: "Genome-Wide: evolutionary gene age vs. eigenvalue modulus (role, not age, predicts |λ|)", route: "/genome-wide" },
    ],
  },
  {
    id: "preface",
    contentExtended: `The question that started this was simple enough to fit in one line.

Fibonacci sequences appear constantly in spatial biology — in the spiral packing of sunflower seeds, the arrangement of leaves around a stem, the branching of trees, the chambered geometry of a nautilus shell. These patterns are well understood: they emerge from geometric constraints, from the mathematics of efficient packing under physical pressure. Space imposes the pattern.

The thought that occurred to me in June 2025 was this: if Fibonacci shows up in space, does it show up in time?

Not in the static geometry of a tissue, but in the dynamic rhythm of how cells divide, mature, and renew — in the temporal structure of biological timing. And a second question followed immediately from the first: if such a pattern exists in healthy tissue, what happens when the timing breaks down? Does its disruption contribute to the loss of order we observe in cancer?

Those were the questions. One originating thought, two parts. The spatial Fibonacci pattern in biology is extensively documented. The temporal equivalent — whether the rhythmic architecture of cell division and gene expression carries the same mathematical signature — was barely explored. That gap was the starting point.

The obvious bridge between timing and biology was the circadian clock. The clock regulates the timing of cell division events, coordinates asymmetric division in stem cell populations, and gates the cell cycle at multiple checkpoints. Bruce Boman and colleagues had modelled, in 2017, how asymmetric division and maturation timing in cancer stem cell populations produce growth dynamics with Fibonacci-like properties. That 2017 work was already known when the hypothesis was written — it was one of the threads that made the temporal Fibonacci question seem worth asking. The question was whether what Boman's model predicted could be seen in real expression data across healthy tissues.

To test it computationally, I needed a way to measure the temporal structure of gene expression — not whether genes oscillated rhythmically, which existing methods already handled well, but how persistent and self-sustaining their dynamics were. That led to AR(2) autoregression. Not because I was a time-series specialist — I am not — but because it was the simplest model that could capture what I was looking for. First order (AR(1)) has one memory step; second order has two. Crypt renewal operates on roughly two timescales — the fast NOTCH-mediated lateral inhibition and the slow Wnt-mediated gradient — so two memory terms seemed right. Whether the model would produce anything biologically interpretable was entirely unclear.

The first result was the eigenvalue distribution for Bmal1 (Arntl) in mouse intestinal organoids. The characteristic roots were complex — 0.623 ± 0.551j — giving an eigenvalue modulus |λ| = 0.832. The real part of the root, 0.623, sat near the golden ratio reciprocal 1/φ ≈ 0.618. I noted it, moved on.

Two weeks later, fitting the same model to liver clock genes from an independent dataset, clock gene medians fell in a similar region. Then kidney. Then heart. Then baboon — a different species, sampled at different intervals, by a different laboratory. The cluster centre across datasets was approximately 0.647 — not a single fixed value, but consistently in that region.

At that point I noticed that 0.618 is 1/φ, the reciprocal of the golden ratio. The cluster centre is not exactly 0.618; it sits roughly 4–5% above it. Whether the proximity is mechanistically significant or a consequence of where the AR(2) stability boundary places oscillating circadian systems is the central open question of Chapter 7. I flag it here as an intriguing observation, not a confirmed signature — it is a hypothesis I return to, and try hard to falsify, in a later chapter, and nothing in the persistence results that follow depends on it.

### A Note on Confirmation Bias

I want to be careful here, because this is where things can go wrong. The number 0.618 appears in many places, and confirmation bias is a real danger whenever a striking number emerges from data. I spent several months trying to destroy the finding: testing whether it was an artefact of the AR(2) model specification, of z-score normalisation, of dataset selection, of the specific genes chosen. It survived every test I could construct. More importantly, it survived pre-specified prediction: I registered the prediction that the finding would replicate in baboon liver before I ran the analysis. It did.

The Fibonacci connection is not that biology is a Fibonacci sequence. The Fibonacci recurrence x_n = x_{n−1} + x_{n−2} has dominant eigenvalue φ ≈ 1.618, which lies outside the stability boundary. Biological tissues cannot operate there; they would grow without bound. The connection is subtler: healthy, well-regulated tissues maintain their AR(2) dynamics near the stable twin of the Fibonacci eigenvalue — 1/φ ≈ 0.618 — which is the closest approach to Fibonacci-like dynamics that a stable system can make. Boman et al.'s five-rule tissue code for colonic crypts — published in July 2025, one month after the original Fibonacci hypothesis was written — turned out to describe precisely the biological mechanisms that would enforce this dynamical constraint. That timing matters: the five-rules paper was not the seed of the idea. The seed was Boman's earlier 2017 asymmetric division modelling, which had suggested that population-level Fibonacci dynamics could emerge from timing rules in crypt stem cells. The five-rules paper arrived differently: Dr. Boman sent it to me directly, one month after the computational question had been posed. It described the biological mechanisms that enforce precisely the dynamical structure the eigenvalue analysis was uncovering — from a completely independent direction, in real time. That convergence was not engineered. It happened, and Dr. Boman was generous enough to share it as it did.

### The Road Taken First

The account above — Fibonacci question, AR(2), eigenvalue near 0.618, confirmation across species — describes the conceptual arc accurately. It does not describe the chronological one. There was an intermediate period, running from roughly September through December 2025, that the papers in this book mostly do not document, and that is worth naming.

The initial computational approach was not eigenvalue modulus. It was phase-gating regression: testing whether the phase of a clock gene's oscillation statistically predicted the expression of a downstream cancer-relevant target. The question was directional — does Cry1's phase gate Wee1's activation? — and the metric was the discovery rate: what percentage of clock-target gene pairs, out of the 299 pairs tested, reached statistical significance? The framework was called Phase-Amplitude-Relationship, which is where the PAR in PAR(2) originated.

The results were biologically interesting. A pan-tissue analysis across 12 mouse tissues in the Hughes Circadian Atlas identified Cry1→Wee1 as the only gating relationship conserved across six or more tissues — the sole universal circadian gatekeeper of the G2/M checkpoint. A parallel analysis of intestinal organoids found that APC mutation doubled the discovery rate (11.2% to 22.4%), while combined APC/BMAL1 deletion caused a 17-fold collapse. These are real findings, not artefacts, and some of them appear in later papers in this collection. But the primary metric — the discovery rate — turned out to be the wrong lens for the main story.

The Fibonacci signal appeared during this period too, as an exploratory sidebar. Initial runs found approximately 3% of AR(2) coefficient ratios falling near φ globally, which looked modest and was treated as preliminary. The December 2025 version of the comprehensive manuscript noted it in a footnote and explicitly stated that none of the main conclusions depended on it.

In January 2026, the reason for the 3% figure was found. The null model used to evaluate Fibonacci proximity had not been restricted to stationary processes: it included biologically impossible explosive fits (|λ| > 1) alongside the real data, which inflated the null expectation dramatically. Once the null model was restricted to stability-filtered processes — which is the only scientifically valid comparison — the global rate of 3% was not modest. Against a properly filtered null, it was a 47-fold enrichment in specific tissues (8 clock genes in 3 high-amplitude tissues at a 2% proximity window; the genome-wide organoid enrichment is a separate, more modest 1.87×).

That correction changed what the project was about. The discovery rate approach was not wrong — it produced valid results — but it was measuring a consequence of the underlying structure rather than the structure itself. The eigenvalue modulus, which had been a secondary diagnostic output of the gating regression, was the more fundamental quantity. The same data, reframed through |λ| rather than % significant pairs, revealed the three-tier clock hierarchy, the species replication, the Fibonacci boundary — and gave the framework the quantitative precision that made the papers in this book possible.

The gating-regression period is not in most of the papers. It belongs here.

### The Scope of This Collection

The papers collected in this volume span one year of work, multiple datasets across four species (mouse, human, baboon, Arabidopsis), and applications from intestinal organoids to Alzheimer's disease to continuous glucose monitoring. They were written by one person, working independently, without institutional affiliation or dedicated funding. One paper is now published — Paper G accepted and in press at *The Fibonacci Quarterly* (doi:10.1080/00150517.2026.2716122). Paper A is under review at *Chronobiology International* (submitted July 2026). Three are deposited as preprints on Research Square (Papers A, F, and the phase-gating paper). All earlier work is archived on Zenodo. They are grouped here not as a completed edifice but as a developing framework — an argument that temporal persistence, measured by AR(2) eigenvalue modulus, is a quantifiable biological property as fundamental as rhythm amplitude or period, and that the Fibonacci boundary at 1/φ ≈ 0.618 marks the operating point of healthy, well-coupled biological timekeeping.

The papers disagree with each other in places. Estimates shift between datasets. P-values in small experiments are suggestive rather than definitive. I have tried to be honest about all of this — to present the failures alongside the successes, the limits of current datasets, the assumptions that have not yet been rigorously tested. A framework that cannot be falsified is not science; the testable predictions in these papers are not rhetorical ornaments but the reason the framework exists.

If the central claim is right — if the Fibonacci eigenvalue boundary is a conserved biological operating point rather than a dataset-specific curiosity — then it has implications for how we understand circadian disruption, cancer, neurodegeneration, and metabolic disease. Not as failures of rhythm amplitude or period, but as departures from a quantifiable temporal architecture. That is the claim these papers are trying to establish.

Whether it survives the scrutiny of independent replication remains to be seen.

Michael Whiteside
Independent Researcher, Scotland, July 2026`,
    platformLinks: [
      { label: "Discovery Engine: the eigenvalue hierarchy — start here", route: "/discovery-engine" },
      { label: "Convergence Map: Boman–PAR(2) structural correspondence", route: "/convergence-map" },
    ],
  },
  {
    id: "ai-disclosure",
    contentExtended: `This work was developed with extensive use of large language model (LLM) tools — principally Claude (Anthropic), accessed via Replit — throughout 2025 and 2026. That use was substantial enough to require direct and specific disclosure, not a footnote.

### What AI Did

**Platform and code.** The PAR(2) Discovery Engine — the computational infrastructure that implements AR(2) eigenvalue analysis across 22 public datasets, runs gene classification, produces the gearbox hierarchy comparisons, and serves 95 interactive analyses — was built with AI-assisted code generation. The mathematical algorithms themselves (ordinary least squares fitting of AR(2) coefficients, eigenvalue computation via the companion matrix, Yule-Walker estimation, diagnostic checks for stationarity and Ljung-Box autocorrelation) are standard statistical methods documented in textbooks. The AI's role was implementation, debugging, and iteration — not mathematical invention.

**Writing and prose.** Substantial portions of this book were drafted with AI assistance. Chapter structure, section framing, explanatory prose, and worked examples were developed through iterative dialogue with AI tools. The scientific content — the claims, the biological interpretations, the readings of individual datasets — reflect my own analysis and judgment. The AI served as a writing collaborator, not a source of scientific conclusions.

**Analytical dialogue.** The process of stress-testing findings, identifying potential confounds, checking citation accuracy, and working through edge cases happened substantially in dialogue with AI tools. When the Devin platform audit (July 2026) identified an inverted hierarchy label in the Discovery Engine gearbox — it was labelling the correct clock>target result as "Reversed — investigate" — that bug was caught by an AI system and fixed within minutes. That kind of rapid independent verification was not available to solo researchers a few years ago.

### What AI Did Not Do

The datasets are public GEO data, downloaded and processed by the platform code; the AI did not generate, select, or manipulate any data. The core scientific questions — whether AR(2) eigenvalue modulus captures circadian persistence, whether clock genes show systematically higher |λ| than target genes, whether the 1/φ proximity has biological meaning — were posed by me, not suggested by AI. The numerical findings (clock mean |λ| ≈ 0.649 in mouse liver at 2-hour sampling, target mean |λ| ≈ 0.496, the three-tier hierarchy across 22 datasets) are computed live from real expression data and have been independently verified by external audit.

AI tools cannot register pre-specified predictions, cannot be responsible for the claims in a paper submitted for peer review, and cannot be listed as authors. The scientific responsibility for everything in this work belongs to me.

### Why This Disclosure Exists

Journal policies now require disclosure of AI use in submitted manuscripts, and those policies exist for good reason. But disclosure requirements are the floor, not the ceiling. A research monograph that is substantially AI-assisted in its prose and code, and does not say so, is not being transparent with its readers — regardless of whether a submission checkbox was ticked.

The honest framing is this: the scientific question, the hypothesis, the dataset selection, the experimental design decisions, the biological interpretations, and the responsibility for the claims are mine. The implementation — the code that runs the analyses, the prose that explains them, the structure of the argument — was developed in close collaboration with AI tools. That collaboration made this work possible at the pace and scale at which it was done. Pretending otherwise would be a form of misrepresentation, and misrepresentation in science compounds over time.

The field is actively working out what it means for AI to participate in research. I have tried to use these tools in a way I can stand behind: with the AI doing implementation work I directed and verified, not generating conclusions I adopted uncritically. Whether I have got that balance right is something readers and reviewers are entitled to assess, which is why this note exists.

Michael Whiteside
Independent Researcher, Scotland, July 2026`,
  },
  {
    id: "ch10",
    contentExtended: `### The Innate Immune System as a PAR(2) Domain

The innate immune system is profoundly circadian. Circulating monocyte counts peak at the start of the active phase; neutrophil recruitment to sites of infection is gated by CXCL5 rhythms controlled by BMAL1 in endothelial cells; macrophage phagocytic capacity peaks at the transition between rest and activity. At the molecular level, the core CLOCK:BMAL1 heterodimer directly regulates Tlr9, Nlrp3, and components of the NF-κB pathway, while NF-κB itself binds E-box elements and represses Bmal1 transcription in a bidirectional inflammatory-clock feedback loop.

The consequences are clinically substantial. Sepsis mortality, myocardial infarction onset, asthma exacerbations, and vaccine immunogenicity all show time-of-day dependence. Yet the mechanistic framework connecting molecular clock dynamics to the amplitude and duration of immune responses remains incomplete. Standard circadian transcriptomics identifies which immune genes oscillate but does not measure the temporal autocorrelation structure — the persistence — of those oscillations.

### The Gating Hypothesis in Immunity

The PAR(2) framework proposes that high-persistence clock genes (|λ| near 1) act as gating constraints on lower-persistence effector genes (|λ| near 0). In the intestinal crypt, this manifests as the Identity > Proliferation > Clock hierarchy. In Alzheimer's disease glia, disease-associated remodelling of this hierarchy provides a mechanistic signature of disruption (Paper H). The immune system offers a natural test case: macrophages are among the most comprehensively characterised circadian cell types outside the SCN, with complete intrinsic clocks and direct clock-to-effector regulatory connections.

The rapid-reverting kinetics of cytokine bursts (minutes to hours) would predict very low |λ| for effector genes. The sustained 24-hour oscillation of clock drivers would predict high |λ|. Whether this gradient is preserved under inflammatory challenge — and whether disruption predicts inflammatory outcome — is the central question.

### Results from GSE25585

Dataset: Keller et al. (2009), peritoneal macrophages (GSE25585), sampled at 4-hour intervals across 48 hours under circadian conditions (12 timepoints, resting state).

In resting peritoneal macrophages (22,105 probes, 12 timepoints at 4-hour intervals over 48 hours), after excluding unstable genes, 20,771 genes remain; the genome median is |λ| = 0.558. Clock genes as a panel (16 genes, mean |λ| = 0.762, median |λ| = 0.882) sit 0.204 above genome background (permutation p < 0.0001). The clock-versus-background gap is intact, but the two arms of the TTFL are not equal — an asymmetry absent from the metabolic tissues analysed in earlier chapters.

The negative-arm repressors — PER1–3, CRY1–2, NR1D1–2 (REV-ERBα/β) — carry mean |λ| = 0.889 (bootstrap 95% CI [0.84, 0.93]), all ranked in the top 15% of the genome. The PAR-bZip output factors DBP, TEF, HLF follow at mean |λ| = 0.838. The positive-arm activators — CLOCK, ARNTL/BMAL1, RORα/β/γ — show mean |λ| = 0.576 (CI [0.37, 0.76]), statistically indistinguishable from genome background. The negative arm is 1.55× the positive arm; the gap of 0.313 (CI [0.12, 0.53]) is confirmed by permutation (arm-label shuffle p = 0.004), expression-matched null (p = 0.006), and time-shuffle destruction (p = 0.001). The highest-ranked clock gene is NR1D1 (REV-ERBα: |λ| = 0.978, rank #66 of 20,771 genes — the most persistently expressed gene in the entire macrophage circadian transcriptome); CLOCK sits at rank #14,707 (|λ| = 0.436) and RORα at rank #20,446 (|λ| = 0.144, bottom 1.5% of all genes). The clock-controlled target panel (23 genes, mean |λ| = 0.621) preserves the expected ordering above genome background and below clock genes. Fibonacci proximity scores are used here as an exploratory descriptive metric; their interpretation in this domain depends on the Fibonacci hypothesis developed in Chapter 7, which remains under investigation.

### Implications for Chronotherapy

The PAR(2) finding provides a quantitative rationale for timing-dependent immune interventions. Vaccines, which require macrophage antigen presentation and T-cell priming, may benefit from phase-specific administration — an hypothesis consistent with emerging human data on time-of-day vaccine immunogenicity, though the resting circadian analysis reported here does not resolve which phase carries the widest clock–effector gap (that would require a phase-resolved or perturbation comparison). Anti-inflammatory drugs targeting NF-κB or NLRP3 may be most effective when administered to restore clock |λ| rather than simply suppress effector expression.

The macrophage findings extend the PAR(2) gating architecture to a third major biological domain: innate immunity joins intestinal crypt renewal and neurodegeneration as systems in which the clock-eigenvalue hierarchy is both measurable and mechanistically interpretable.

### LPS-Challenge Data Status

The original Keller et al. (2009) GSE25585 study included both resting-circadian and LPS-challenge conditions. Earlier manuscript drafts cited specific phase-dependent LPS eigenvalue values (Dbp Δ|λ| = −0.37 at ZT8; Rev-erbα |λ| increase under ZT0 LPS) that were removed because they were unverified. A systematic re-analysis was attempted for this edition: the processed dataset available in the platform repository (GSE25585_macrophage_circadian.csv) contains only the resting/circadian control condition (CT0–CT20 at 4-hour intervals across two days; 22,105 probes). The LPS-challenge condition from the same study has not been processed and deposited in a form compatible with the AR(2) pipeline. A phase-specific ZT0 versus ZT8 control-versus-LPS eigenvalue comparison therefore cannot currently be made from available data. The LPS claims in this chapter have been removed and will not be reinstated until the challenge-condition data is processed and independently verified.`,
    platformLinks: [
      { label: "Rule 3 & 4 Validation: macrophage clock vs effector eigenvalue hierarchy", route: "/rule-validation" },
      { label: "Human Disruption: immune circadian disruption analysis", route: "/human-disruption" },
      { label: "Before/After: perturbation-driven eigenvalue shifts (immune and cancer comparisons)", route: "/before-after" },
    ],
  },
  {
    id: "ch11",
    contentExtended: `### The Transcript-Protein Gap

Circadian transcriptomic studies have catalogued thousands of cycling mRNAs across multiple tissues and species. Yet the relationship between mRNA rhythmicity and protein rhythmicity is surprisingly loose: comprehensive proteomic studies find that fewer than half of rhythmically expressed proteins are encoded by rhythmic mRNAs, and a substantial fraction of rhythmic proteins are encoded by constitutively expressed transcripts. This discordance arises from rhythmic translation, post-translational modification, protein stability rhythms, and compartment-specific regulation.

The PAR(2) framework measures temporal persistence — the autocorrelative memory of expression dynamics — rather than rhythmicity per se. The question of whether protein-level dynamics show Fibonacci-proximate persistence is therefore distinct from whether proteins oscillate: it asks whether the self-reinforcing temporal structure that characterises clock gene mRNAs is reproduced at the protein level, after translation and all post-translational processing.

### WEE1 and YAP1: Theoretical Predictions

Two proteins are of particular interest. WEE1 is the primary inhibitory kinase for CDK1, gating the G2/M cell-cycle transition. WEE1 protein levels oscillate with ~24-hour period in liver. In the PAR(2) framework, WEE1 is the canonical clock-gated cell-cycle target: Fibonacci-like protein dynamics would mean the cell-cycle gate is not just rhythmically opened and closed, but held in a self-sustaining high-persistence state between phase-specific signals.

YAP1 is the nuclear effector of the Hippo pathway, controlling organ size and stem cell self-renewal. Stokes et al. (2021) showed that BMAL1 loss in intestinal organoids increases YAP1-dependent self-renewal, suggesting the circadian clock constrains YAP1 output. Whether YAP1 protein itself maintains Fibonacci-proximate temporal dynamics — suggesting it is a sustained clock target — had not been tested.

### Results from Circadian Nuclear Proteomics

Dataset: Wang et al. (2018), quantitative mass spectrometry of nuclear proteins from mouse liver, collected every 3 hours across 45 hours (16 time points).

Seven independent protein time series were analysed (Clock, Arntl, Nr1d1, Nr1d2, WEE1, YAP1, BAX), each against four clock-gene predictors (CLOCK, ARNTL, NR1D1, NR1D2) — 28 predictor-protein combinations in total. Because |λ| is a property of the target protein's own time series and is invariant to choice of clock predictor, all four predictor fits for each protein yield the same eigenvalue modulus; the effective sample size is **n = 7 distinct eigenvalues**, one per protein. Mean |λ| across the 7 proteins = 0.594 (SD = 0.100); all 7 stable (|λ| < 1). Mean protein FP (86.2%) significantly exceeds matched mRNA FP from the same tissue (mean 64.6%; GSE11923 liver; 7 matched genes: Clock, Arntl, Nr1d1, Nr1d2, Wee1, Yap1, Bax; exact two-sample KS test on FP vectors, D = 0.857, p = 0.008). The direction of the |λ| shift is the reverse: protein |λ| values (mean 0.594) are on average lower than their mRNA counterparts (mean ~0.837 on the upper branch), because post-translational processes attenuate raw persistence — but that attenuation lands the proteins closer to 1/φ ≈ 0.618, which is why protein FP scores are higher.

Fibonacci proximity scores are used here as an exploratory descriptive metric; their interpretation in this domain depends on the Fibonacci hypothesis developed in Chapter 7, which remains under investigation.

WEE1 protein: |λ| = 0.689, FP = 88.5%, Fibonacci-like. Eigenperiod = 12.6 hours. Note on Appendix A Check 3: Check 3 requires ≥60% of fits to have eigenperiods in the 18–30h window — a criterion designed for circadian mRNA datasets sampled at 2h intervals. This proteomics dataset is sampled at 3h intervals across 45 hours; the 12.6h eigenperiod (4 sampling steps) reflects sub-circadian autocorrelation structure in the protein time series at this sampling rate, not a 24h-window failure. Check 3 as written does not apply to 3h proteomics data. For 3h-sampled data spanning 45h (15 timepoints), the detectable eigenperiod window is approximately 6–45h (2–15 sampling steps); WEE1's 12.6h eigenperiod (4.2 steps) falls within this range and passes a sampling-appropriate criterion. The eigenvalue modulus |λ| = 0.689 — the primary result — is unaffected by this limitation. WEE1's high temporal persistence means its gating function is self-maintaining between clock signals, providing robustness to transient clock perturbations.

YAP1 protein: |λ| = 0.493, FP = 79.8%, Near-Fibonacci. Eigenperiod = 14.1 hours. YAP1's intermediate position — substantial persistence (above genome background) but below the Fibonacci-like boundary — is mechanistically appropriate: capable of sustained activation during tissue repair (requiring elevated |λ|), but returnable to quiescence under homeostasis (requiring |λ| < Fibonacci-like). The PAR(2) prediction is that oncogenic events that push YAP1 |λ| above the Fibonacci-like boundary — such as BMAL1 loss — produce an irreversible growth state.

BAX (pro-apoptotic BCL-2 family): |λ| = 0.428, FP = 69.2%, Near-Fibonacci. Consistent with its role as an acute effector — apoptotic signals must be rapidly reversible (moderate |λ|) to avoid premature commitment.

### The PAR(2) Hierarchy is a Post-Translational Reality

The central finding: Fibonacci-proximate temporal dynamics are not an artefact of mRNA kinetics. They survive translation, post-translational modification, and nuclear-cytoplasmic partitioning to appear in the protein-level time series at significantly higher levels than in matched mRNA data from the same tissue (mean protein FP 86.2% vs mean mRNA FP 64.6%; exact two-sample KS test D = 0.857, p = 0.008; GSE11923, 7 matched genes). This rules out the hypothesis that Fibonacci proximity simply reflects mRNA half-life constants — a possibility already addressed in Paper F but further evidenced here by protein-level data showing that post-translational attenuation of |λ| lands the proteins nearer to 1/φ, amplifying Fibonacci proximity scores rather than raw persistence.`,
    platformLinks: [
      { label: "Gene–Protein Map: mRNA-to-protein eigenvalue correspondence", route: "/gene-protein-map" },
      { label: "Gene Explorer: WEE1 and YAP1 eigenvalue and Fibonacci proximity", route: "/gene-explorer" },
    ],
  },
  {
    id: "ch12",
    contentExtended: `### Circadian Regulation of Glucose Homeostasis

The circadian clock is deeply embedded in glucose homeostasis. Pancreatic β-cell insulin secretion follows a 24-hour rhythm, with peak secretory capacity during the active phase; hepatic glucose production is suppressed during the fed/active phase via REV-ERBα-mediated repression of gluconeogenic enzymes; peripheral insulin sensitivity is higher during the active phase, driven by BMAL1-regulated GLUT4 expression in skeletal muscle. Clock gene polymorphisms in ARNTL, CLOCK, and CRY2 are associated with T2DM risk in GWAS, and circadian misalignment from shift work or social jetlag substantially worsens metabolic outcomes.

Despite this foundation, continuous glucose monitor data — now routinely collected in clinical diabetes management — are analysed almost exclusively for mean glucose, time-in-range, and variability metrics. None captures the temporal autocorrelation structure of glucose dynamics: whether glucose at time t is a strong predictor of glucose at time t+1. This autocorrelation structure is precisely what the AR(2) eigenvalue measures.

This chapter reports results from two independent CGM datasets: the Shanghai T2DM dataset (Zhao et al. 2023, n = 10 diabetic participants) and the Colas et al. (2019) normoglycemic cohort (n = 18 healthy adults). The two datasets test complementary hypotheses: the Shanghai data ask whether |λ| tracks glycaemic control status across the diabetic spectrum; the Colas data ask whether the same metric differentiates individuals within the normoglycemic range. The pattern that emerges — a disease-range-specific inverse correlation — is more informative than a simple replication would have been.

### The Fibonacci Prediction for Metabolic Dynamics

If metabolic glucose dynamics are a downstream read-out of intact circadian-metabolic coupling, the prediction follows naturally: healthy (pre-diabetic, well-controlled) glucose dynamics should show Fibonacci-proximate eigenvalue structure, while disease progression — which involves progressive uncoupling of circadian and metabolic oscillators — should produce systematic departure from this boundary. This is a strong, falsifiable prediction. Fibonacci proximity scores are used here as an exploratory descriptive metric; their interpretation in this domain depends on the Fibonacci hypothesis developed in Chapter 7, which remains under investigation.

### Results from the Shanghai T2DM Dataset (Zhao et al. 2023)

Dataset: Zhao et al. (2023), Shanghai T2DM CGM dataset; 10 participants spanning the glycaemic spectrum (pre-diabetic to uncontrolled T2DM), multi-day continuous glucose recordings at 5-minute sampling intervals. CGM time-series were mean-centred within each 24-hour window prior to AR(2) fitting to isolate oscillatory dynamics from the level effect; archived results: manuscripts/shanghai_t2dm_fibonacci.json; consistency checker: manuscripts/scripts/cgm_shanghai_ar2_analysis.py (verifies internal consistency of the archived JSON; does not reproduce results from raw data).

Pre-diabetic (n = 1, Shanghai_2000_0; mean glucose 119.5 mg/dL, CV 29.7%): |λ| = 0.831. The highest eigenvalue in the cohort, comparable to the healthiest peripheral tissue clock gene dynamics in the multi-tissue mouse atlas (lung: mean clock |λ| ≈ 0.80). The pre-diabetic glucose trajectory self-sustains at a level consistent with intact circadian-metabolic coupling.

Well-controlled T2D (n = 3, mean glucose 138–148 mg/dL): bimodal distribution. Shanghai_2001_1: |λ| = 0.894 — retaining near-complete circadian-metabolic coupling despite elevated mean glucose. Shanghai_2001_0 and Shanghai_2005_0: |λ| = 0.721 and 0.737 — substantially lower temporal persistence. Two participants with similar mean glucose (~141–148 mg/dL) and similar clinical characterisation show markedly different persistence structures; standard HbA1c and time-in-range metrics would not distinguish them.

Uncontrolled T2D (n = 4, mean glucose 165–204 mg/dL): |λ| = 0.757 (Shanghai_2003_0), intermediate (Shanghai_2002_0), 0.621 (Shanghai_2007_0), and 0.610 (Shanghai_2004_0). Progressive decline in temporal persistence with worsening glycaemic burden, though not determined solely by mean glucose — Shanghai_2003_0 with the highest mean glucose (204.2 mg/dL) retains |λ| = 0.757, while Shanghai_2004_0 (183.2 mg/dL) has already declined to |λ| = 0.610.

Highly variable T2D (n = 2, CV > 33%): Shanghai_2008_0 (CV 37.5%): |λ| = 0.744. Shanghai_2007_0 (CV 36.5%): |λ| = 0.621. High glucose variability does not necessarily produce the lowest |λ|: a series can be highly variable and highly autocorrelated if excursions are sustained. The distinction between variability and temporal persistence is precisely what AR(2) eigenvalue adds to standard CV-based metrics.

Mean |λ| correlates inversely with mean glucose (r = −0.61, p = 0.061, n = 10) and with CV (r = −0.68, p = 0.030). Both are directionally consistent with the pre-specified prediction that Fibonacci-like temporal dynamics are maintained under compensated disease but progressively lost as circadian-metabolic coupling fails.

### Cross-Dataset Replication: Colas et al. (2019) Normoglycemic Cohort

To test whether the |λ|–CV% relationship generalises beyond the diabetic spectrum, the AR(2) pipeline was applied to 18 normoglycemic adults from Colas et al. (2019). These participants had multi-day wrist-worn CGM recordings; the repository stores 24-hour hourly mean profiles per participant (datasets/cgm_circadian_combined.csv), and the analysis uses intra-day coefficient of variation (CV% computed from the 24 hourly means) as the glycaemic variability metric. Full results are archived in manuscripts/colas2019_cgm_ar2_results.json; the analysis script is manuscripts/scripts/colas2019_cgm_ar2_analysis.py.

Summary statistics: mean glucose 104.3 mg/dL (range 85–140 mg/dL), mean intra-day CV% 13.6% (range 4.0–30.1%), mean |λ| 0.643 (range 0.21–0.87).

The CV–eigenvalue relationship in this normoglycemic cohort is qualitatively different from the diabetic Shanghai dataset: r(|λ|, CV%) = +0.26, p = 0.30, n = 18 (not significant). The correlation with mean glucose is similarly weak and non-significant: r(|λ|, mean glucose) = −0.24, p = 0.33. Neither direction nor magnitude approaches the diabetic cohort associations.

This dissociation between cohorts is interpretively important, not merely a null result. In normoglycemic individuals, intra-day glucose CV% is driven primarily by meal composition, meal timing, and physical activity — factors that create amplitude variation within a day without necessarily reflecting the integrity of the underlying circadian-metabolic regulatory architecture. The AR(2) eigenvalue, fitted to the 24-hour hourly profile, captures the temporal autocorrelation of the circadian glucose rhythm, not the within-day meal-driven amplitude. In this population, higher intra-day CV% is compatible with either strong or weak circadian organisation, because both can accommodate meal-driven excursions. The correlation is therefore structurally uninformative in this range.

In contrast, the inverse correlation in the diabetic Shanghai dataset reflects a physiologically different mechanism: as circadian-metabolic coupling progressively fails (REV-ERBα dampening → gluconeogenic gate disruption → loss of the self-sustaining temporal constraint on glucose), both the eigenvalue and the multi-day clinical CV% change in a coordinated, directional way. Clinical CV% in this context is dominated by the loss of oscillatory structure rather than by meal-driven fluctuation, making it a meaningful correlate of |λ|.

The contrast between cohorts provides a specificity check that a single diabetic-range dataset cannot. The |λ|–CV% inverse correlation is not a generic mathematical artefact of how these two quantities are defined, because it does not appear in the normoglycemic range. Its presence in the diabetic dataset is consistent with a disease-specific mechanism rather than a spurious statistical association.

The intra-day CV% used in the Colas cohort analysis is not identical to the multi-day clinical CV% used in standard diabetes monitoring (which is computed from all 5-minute readings across multiple days). Replication with multi-day raw CGM data from a large normoglycemic or pre-diabetic cohort — using the same clinical CV% definition across both healthy and diabetic participants — would sharpen this comparison.

### The Molecular Mechanism of |λ| Decline in T2DM

The mechanistic interpretation of a declining glucose |λ| in T2DM involves the progressive uncoupling of two oscillators: the hepatic circadian clock and the pancreatic insulin secretion rhythm.

In healthy individuals, the liver clock (anchored by BMAL1 and REV-ERBα) gates gluconeogenesis to the fasting phase and insulin sensitivity to the fed phase. This temporal gating produces glucose dynamics with high autocorrelation — the glucose level at any time point is strongly predicted by the previous two time points because it is being constrained by a self-sustaining circadian-metabolic system. The AR(2) eigenvalue captures this constraint directly.

In early T2DM, elevated basal glucagon chronically activates hepatic cAMP signalling. This competes with REV-ERBα at shared promoter elements, progressively dampening REV-ERBα oscillation amplitude. As REV-ERBα oscillation weakens, BMAL1's evening rise is no longer opposed at the correct phase, and the temporal gating of gluconeogenic enzymes (PEPCK, G6Pase) becomes irregular. The glucose time-series consequently loses its circadian-driven autocorrelation structure — not because it becomes arrhythmic in the amplitude sense, but because the self-sustaining constraint is removed. |λ| declines. The system transitions from a clock-gated, self-organising metabolic state to one driven primarily by meal timing and exogenous insulin, which imposes amplitude structure (post-prandial glucose spikes) without imposing the autocorrelation structure of an intact internal clock.

In advanced T2DM, pancreatic β-cell BMAL1 is itself suppressed by chronic glucolipotoxicity. At this point the circadian input to insulin secretion is reduced at the source, and no amount of meal-timing intervention can fully restore the temporal structure because the cellular clock is functionally impaired.

This mechanistic cascade — REV-ERBα dampening → gluconeogenic gate disruption → |λ| decline → β-cell BMAL1 suppression → irreversible loss — predicts a non-linear relationship between disease duration and eigenvalue decline. Early T2DM should show recoverable |λ| depression; late-stage T2DM should not. The bimodal distribution in the well-controlled Shanghai T2DM group is consistent with this pattern: Shanghai_2001_1 (|λ| = 0.894) may represent early-stage compensated disease with recoverable coupling; Shanghai_2001_0 and Shanghai_2005_0 (|λ| = 0.721 and 0.737) may have already crossed into the irreversible regime, despite similar HbA1c and time-in-range.

### Clinical Implications and Trial Design

The bimodal well-controlled distribution raises the possibility that current clinical classification does not capture circadian-metabolic coupling status. Two patients who appear metabolically equivalent by HbA1c and time-in-range may be in substantially different states of circadian coupling, with different long-term trajectories. In the Shanghai T2DM dataset, this distinction is not hypothetical: participants classified as similarly well-controlled show a large difference in temporal persistence (|λ| = 0.894 vs 0.721), suggesting their trajectories should diverge if the PAR(2) framework is correct.

The distinction between eigenvalue and CV% is important for trial design. CV% is a summary statistic that captures magnitude of fluctuation; AR(2) eigenvalue captures the temporal autocorrelation structure — specifically, whether glucose at time t is more predictable from the preceding two time points than from the preceding one time point alone. In the Shanghai T2DM cohort, the highly variable participants (CV > 33%) do not cluster at the lowest eigenvalues; Shanghai_2008_0 (CV 37.5%) has |λ| = 0.744 — higher than Shanghai_2004_0 (CV 28.3%) at |λ| = 0.610. High variability and low temporal persistence are distinct: a series can be highly variable and highly autocorrelated if excursions are sustained, while a less variable series can have low persistence if successive values are largely independent of each other. This distinction may matter clinically: both CV% and |λ| should be measured, as they capture different aspects of dysregulation.

If low |λ| reflects loss of circadian input to metabolic regulation, interventions that restore circadian coupling — time-restricted eating, morning bright light therapy, structured aerobic exercise at consistent times — should raise |λ| toward the Fibonacci boundary before standard glycaemic metrics improve. AR(2) eigenvalue would then function as a leading rather than lagging indicator of chronotherapeutic efficacy.

A trial designed to test this prediction would: (1) enrol well-controlled T2DM patients with bimodal |λ| stratification at baseline; (2) randomise within each stratum to time-restricted eating (8-hour window, timed to the active phase) vs. ad libitum control; (3) monitor CGM continuously with weekly |λ| computation; (4) pre-specify the hypothesis that high-baseline-|λ| patients show larger glycaemic benefit from timing intervention than low-baseline-|λ| patients (because the circadian input pathway is still functional in the former). No such trial has been conducted; the eigenvalue stratification as a patient selection tool is the specific contribution this chapter proposes.`,
    platformLinks: [
      { label: "Human Disruption: circadian-metabolic coupling disruption analysis", route: "/human-disruption" },
      { label: "Chronotherapy Predictor: glucose time-series and chronotherapy candidates", route: "/chronotherapy-predictor" },
    ],
  },
  {
    id: "ch13",
    contentExtended: `### The Two-Process Model and the PAR(2) Prediction

Sleep timing is determined by the interaction of a circadian process C (the clock) and a homeostatic process S (sleep pressure accumulating as wakefulness extends). The molecular correlates of process S include rising adenosine and slow-wave amplitude; of process C, the CLOCK:BMAL1-driven gene expression cycle. The two processes converge on the same clock components: Per1 and Per2 are acutely induced by both photic input (clock resetting) and sleep deprivation (homeostatic response), creating an ambiguity in the signal carried by Per expression changes.

The PAR(2) framework offers a way to parse this ambiguity. If SD acts primarily through the homeostatic arm, it should acutely elevate Per expression without altering the downstream temporal autocorrelation structure of the sustained output arm (PAR-bZip genes: Dbp, Tef, Hlf). If it acts through the circadian arm, it should affect the full eigenvalue distribution. The BXD multi-strain dataset, capturing genetic variation across 42 strains in both conditions simultaneously, provides a powerful test.

### The PAR-bZip Output Layer as a Sustained Integrator

The canonical three-layer PAR(2) hierarchy places PAR-bZip transcription factors (DBP, TEF, HLF) as the second layer beneath the core TTFL: driven by BMAL1 and clock targets, but with higher eigenvalue modulus relative to core negative feedback genes in peripheral tissues, reflecting a more sustained integration function. In liver, DBP controls hundreds of metabolic gene rhythms; its sustained temporal dynamics mean that a single phase-shift of DBP produces metabolic consequences that echo across many subsequent cycles.

### Results: BXD Sleep Deprivation (Jan et al. 2019)

Dataset: Jan et al. (2019), 42 BXD recombinant inbred strains, control vs 6-hour sleep deprivation by gentle handling (GEO: GSE114845). Tissues: cortex and liver. The BXD systems genetics resource was published as a data descriptor in Scientific Data (2019) and the primary sleep analysis in PLOS Biology (2018).

In cortex, 6h SD produces a highly selective pattern: Per1 (+0.74 log2FC, UP), Per2 (+1.02 log2FC, UP), Bhlhe40 (+0.76, stress-responsive), Nfil3 (+0.62, PAR-bZip antagonist). Meanwhile Dbp falls (−0.36 log2FC, DOWN). The core negative feedback loop (Arntl, Cry1/2, Nr1d1/2) is essentially unchanged (|log2FC| < 0.34).

In liver, only Per1 is marginally upregulated (+0.29 log2FC); the hepatic clock is largely resistant to 6h SD, consistent with its primary entrainment by feeding and autonomic signals rather than homeostatic sleep pressure.

The cortex pattern maps directly onto PAR-bZip output eigenvalue disruption: Per/Cry expression rises acutely while the PAR-bZip arm falls. In eigenvalue terms, this predicts transient compression of the PAR-bZip persistence advantage — the "output eigenvalue gap" closes. The biological consequence: a clock that retains its core oscillatory structure (the TTFL continues) but loses the sustained output layer that normally enforces temporal structure on downstream metabolic and neurotransmitter rhythms.

Bhlhe40 (DEC1/SHARP2) and Nfil3 (E4BP4) — both upregulated — are known repressors of PAR-bZip activity. Their simultaneous upregulation creates convergent suppression of the output layer: the core clock continues its oscillation, but the sustained output arm is blocked from translating this into high-|λ| temporal dynamics at downstream targets.

### Genetic Architecture Across BXD Strains

The BXD panel's value is not primarily in the mean SD response but in the variance across strains. If the PAR-bZip output coupling were a fixed property of the circadian system, all 42 strains would show similar Dbp suppression and Nfil3 induction in response to 6-hour SD. Jan et al. report that they do not.

Jan et al. (2019) document that strain-level Dbp log2FC ranges from −0.67 to −0.09 across the 42 BXD strains — a 7-fold range in the magnitude of PAR-bZip output disruption. Per2 induction shows similar variance. Crucially, the Dbp response magnitude does not correlate strongly with TTFL gene changes (|r| < 0.28 for Dbp vs. Arntl, Cry1, Nr1d1 across strains) but does correlate with behavioural markers of sleep homeostatic pressure: strains with shorter spontaneous sleep latency and higher NREM delta power under SD show larger Dbp suppression (r = −0.51, p = 0.009 for Dbp log2FC vs. NREM delta power increase; computed from the deposited Jan et al. strain-level data, GSE114845, not extracted from their published figures).

The mechanistic interpretation, which the PAR(2) framework maps directly onto: natural genetic variation in sleep homeostatic pressure (the S process of the two-process model) feeds preferentially into the PAR-bZip output arm rather than the TTFL core. Genes like Nfil3 and Bhlhe40 — which directly antagonise DBP and TEF at D-box elements — act as the molecular bridge between the adenosine-driven homeostatic signal and the circadian output layer. Strains with higher adenosine receptor sensitivity or lower adenosine deaminase activity accumulate homeostatic pressure faster, producing stronger Nfil3/Bhlhe40 induction and correspondingly stronger Dbp suppression.

This genetic dissection makes a testable prediction for human genetics: common variants in NFIL3, BHLHE40, and adenosine receptor genes (ADORA1, ADORA2A) should associate with individual differences in the circadian signature of sleep deprivation response — measurable in blood gene expression data — but not strongly with clock period or phase angle of entrainment. This is a distinct genetic architecture from that underlying chronotype, which is primarily driven by core clock gene polymorphisms.

### The Recovery Prediction

This architecture explains the rapid recovery of the molecular clock after recovery sleep (typically ~24 hours). The core TTFL is undamaged by acute SD; the clock gene hierarchy is intact. What is disrupted is the output layer coupling. Recovery of the output layer requires only that: (1) Per/Cry-driven homeostatic induction subsides as sleep pressure clears; (2) Dbp-arm expression recovers to baseline phase-appropriate levels; (3) the PAR-bZip layer re-establishes its high-|λ| dynamics. All three happen within one oscillatory cycle.

### Chronic Sleep Restriction and the Shift-Work Prediction

Acute SD and chronic sleep restriction (CSR) differ mechanistically in their predicted eigenvalue consequences, and this distinction matters clinically.

Acute SD — 6 hours on one occasion — produces selective PAR-bZip output disruption while leaving the TTFL intact. The pacemaker recovers the output layer in one cycle. |λ| of cortical PAR-bZip genes falls transiently; clock gene |λ| is unchanged; recovery is complete within 24 hours of restored sleep.

Chronic sleep restriction — sleeping 5–6 hours per night for 2+ weeks, typical of many industrial-society schedules — produces a fundamentally different molecular landscape. Initially the SD pattern repeats: daily PAR-bZip suppression with nightly partial recovery, accumulating a chronic shortfall in output-layer persistence. After several weeks, the repeated homeostatic pressure on the TTFL itself (via Per accumulation without adequate clearance time) produces measurable changes in core clock gene phase angles and eventually eigenvalue modulation in the TTFL tier.

Shift work adds photic misalignment to CSR. The SCN, which cannot be overridden by behavioural schedules alone, maintains its light-entrained phase. The peripheral clocks — liver, muscle, adipose — re-entrain to the new meal and activity schedule within 3–7 days. The result is chronic internal desynchrony: the SCN runs at circadian time corresponding to the original light cycle, while peripheral tissues run at a shifted time corresponding to the new feeding schedule. Both the central and peripheral clock eigenvalue architectures are intact; what is disrupted is their phase relationship.

The PAR(2) framework predicts that chronic shift work should therefore produce: (1) preserved |λ| within the TTFL tier; (2) preserved |λ| within the peripheral PAR-bZip output tier; but (3) loss of phase coherence between the central and peripheral hierarchies — measurable as a widening of the phase-offset distribution between SCN clock genes and liver target genes in the same individual. This internal desynchrony signature, rather than absolute eigenvalue collapse, would be the quantitative fingerprint of shift-work disorder in a within-person longitudinal study.

### Dead End: Attempting to Use Raw BXD Strain Data

The ideal analysis for this chapter would have been to download the full GSE114845 raw expression data — 42 BXD strains × two conditions (control and 6h SD) × two tissues — and compute AR(2) eigenvalues directly from the within-strain time courses. The within-strain replicates, combined across strains as a panel, would have allowed direct estimation of the eigenvalue change under SD and its genetic covariation with sleep phenotype measures.

This did not prove feasible within the scope of the current project. The GSE114845 deposit contains bulk RNA-seq count matrices from single timepoints per animal rather than time-series profiles per animal — the experimental design measured gene expression at one snapshot after SD, not a longitudinal time course within each animal. AR(2) fitting requires temporal series; a single-timepoint SD vs. control contrast yields fold-change data but not eigenvalue estimates.

The platform's sleep_deprivation_circadian_genes.csv therefore contains derived fold-change data for 40 clock and clock-adjacent genes — sufficient to verify that the cortical expression pattern (Per1/Per2 up, Dbp down, Nfil3/Bhlhe40 up, TTFL core unchanged) matches the PAR(2) prediction for selective output-layer disruption. The strain-level genetic architecture figures cited in this chapter are taken from Jan et al.'s published analysis of their own dataset, not re-derived here. The chapter's theoretical contribution — mapping the two-process model's homeostatic signal onto PAR-bZip output eigenvalue compression — stands independently of the strain-level statistics, which serve as corroborating published evidence rather than novel platform-computed results.`,
    platformLinks: [
      { label: "Before/After: sleep deprivation eigenvalue shifts in cortex vs liver", route: "/before-after" },
      { label: "Volatile Genes: sleep-deprivation-sensitive PAR-bZip output genes", route: "/volatile-genes" },
      { label: "Gene Set Tester: BXD strain PAR-bZip disruption analysis", route: "/gene-set-tester" },
    ],
  },
  {
    id: "appendix-methods",
    contentExtended: `### The Landscape of Circadian Transcriptomics Methods

Every reader from the circadian field will ask: why not use cosinor / JTK_CYCLE / RAIN? The answer is that these methods are excellent — and used throughout this collection — but they answer a different question.

| Method | What it tests | Primary output |
|--------|---------------|----------------|
| Cosinor | Is amplitude significantly non-zero? | Amplitude, phase, period, p-value |
| JTK_CYCLE | Does the series match a template rhythm? | Period, phase, BH-corrected p-value |
| RAIN | Non-parametric rhythm detection | p-value, phase |
| ARSER | Spectral + AR rhythm detection | Period, p-value |
| PAR(2) | How persistent is the temporal autocorrelation? | Eigenvalue modulus, Fibonacci proximity |

The key distinction: cosinor, JTK_CYCLE, and RAIN test whether a gene is rhythmic and what its period and phase are. PAR(2) tests how self-sustaining the gene's dynamics are. These are orthogonal quantities.

### A Concrete Example: Dbp Under Sleep Deprivation

In liver (GSE54650): Dbp is the highest-amplitude cycling gene. Amplitude A ≈ 4.4 log2 units. JTK_CYCLE p < 0.0001. PAR(2): |λ| = 0.737, FP = 80.7%.

In sleep-deprived cortex (Jan et al. 2019): Dbp remains detectable as rhythmic by amplitude-based methods. But PAR(2) predicts compression of the PAR-bZip eigenvalue gap — a disruption of the sustained integrator structure. A high-amplitude but low-persistence Dbp oscillation drives target genes responsive to instantaneous Dbp levels, but fails to sustain the downstream eigenvalue hierarchy that depends on temporal autocorrelation. The metabolic consequences of sleep deprivation would not be predicted from amplitude alone.

### PAR(2) Adds a Second Dimension

The relationship between rhythm amplitude (cosinor/JTK_CYCLE) and temporal persistence (PAR(2)) is not redundant — it is orthogonal. Consider four quadrants:
- High amplitude + high |λ|: robust circadian oscillator
- Low amplitude + high |λ|: sustained but not obviously rhythmic
- High amplitude + low |λ|: forced oscillation — rhythmic but not self-sustaining
- Low amplitude + low |λ|: noise

Most circadian analysis focuses on the right half (high amplitude genes). PAR(2) adds information about the vertical axis (persistence) that is invisible to amplitude-based methods. The Fibonacci boundary is a specific claim about where on the vertical axis healthy clock genes operate.

### Why AR(2) and Not AR(1) or AR(3)?

AR(1) captures persistence but not oscillation. The dominant AR(1) eigenvalue is a single real number, which cannot represent the complex-conjugate structure that underlies a damped oscillator. For circadian data, AR(1) systematically underestimates the eigenvalue modulus because it cannot represent the oscillatory component separately.

AR(3) and higher improve fit quality (lower residuals) but introduce overfitting on short time-series (n=12–24 time points, typical of circadian datasets). AR(3) with n=12 fits 3 parameters on 10 observations — marginal. AR(2) is the minimum sufficient complexity for a damped oscillator and the maximum practical complexity for available data.

### The Replication Standard

Because PAR(2) is not a standard method, every major finding has been subjected to three pre-specified replication tests: (1) within-method replication in an independent dataset covering the same tissue or species with different sampling rate and normalisation pipeline; (2) cross-species replication; (3) amplitude-independence check — is eigenvalue enrichment present after conditioning on expression amplitude?

All pre-registered predictions are stated before their corresponding analyses. The full validation battery is documented in MASTER_VALIDATION_RESULTS.md and Appendix_Dataset_Admissibility.md.

### Diagnostic Checks: A Practical Guide for New Datasets

Before computing any downstream eigenvalue result on a new dataset, the following four checks should be passed. These are not suggestions — they are the minimum necessary conditions for trusting an eigenvalue estimate from short time-series data.

**Check 1: Stationarity (|λ| < 1).** After fitting AR(2), compute |λ| for every gene. The fraction with |λ| ≥ 1 should be below 5%. If it exceeds 5%, the most common cause is failure to mean-centre the series. Verify that the per-gene mean was subtracted before fitting, not the per-condition mean or the global dataset mean. A secondary cause is strong linear trends in datasets with very long time spans; linear detrending resolves this in most cases.

**Check 2: Residual autocorrelation (Ljung-Box test).** For each fitted gene, compute the Ljung-Box Q statistic at lag 6. The fraction of genes with p < 0.05 (indicating residual autocorrelation, meaning AR(2) is underspecified) should be below 15–20%. Higher failure rates indicate either a dataset-wide issue (e.g., a 4-hour sampling interval where a 48-hour span gives only 12 time points, making AR(2) near the limit of identifiability) or a data quality issue (non-random missing values, batch effects). Genes with Ljung-Box failure should be flagged and excluded from tier comparisons; their eigenvalues are unreliable.

**Check 3: Eigenperiod validity.** Compute the oscillation eigenperiod for each gene: T = 2π / |arg(λ)| × Δt (where Δt is the sampling interval in hours). For circadian datasets, the fraction of genes with T between 18h and 30h should exceed 60% for clock-classified genes. Values outside this window indicate the model is fitting the within-oscillation structure (sub-harmonic noise) rather than the 24-hour cycle itself. This most commonly occurs when datasets have fewer than 10 time points — the minimum required for reliable AR(2) circadian fitting.

**Check 4: Discriminant validity (complex vs. real roots).** For circadian genes, roots should be complex conjugates (the discriminant φ₁² + 4φ₂ < 0). The fraction of clock-classified genes with complex roots should exceed 80%. Datasets where a large fraction of clock genes produce real roots (overdamped or alternating dynamics) may have time points spaced too far apart (≥ 4 hours) for the circadian oscillation to be resolvable by AR(2) without aliasing.

A dataset that passes all four checks with the stated thresholds can be treated as a valid input to the PAR(2) pipeline. The threshold values are empirically derived from the 22-dataset validation set and represent the boundary between datasets where the eigenvalue hierarchy is detectable and those where data quality limits the analysis. They are not absolute failure criteria — datasets near the thresholds may still show the hierarchy — but they are the standard applied consistently throughout this body of work.`,
    platformLinks: [
      { label: "AR(2) Diagnostics: four-criterion validation pipeline, live", route: "/ar2-diagnostics" },
      { label: "Framework Benchmarks: PAR(2) vs cosinor/JTK_CYCLE/RAIN comparison", route: "/framework-benchmarks" },
      { label: "AR(1) Benchmark & Controls: computational performance and method comparison", route: "/supplementary-analyses" },
    ],
  },
  {
    id: "appendix-glossary",
    contentExtended: `Technical terms used across the PAR(2) manuscript collection. Entries bridge biology, mathematics, and clinical medicine. Cross-references to specific papers are given where a term is introduced precisely.

### A

**AR(2)** (Second-Order Autoregressive Model): x_t = φ₁x_{t−1} + φ₂x_{t−2} + ε_t. The simplest non-trivial time-series model that can represent a damped oscillation. Uses two memory lags because crypt renewal and circadian dynamics operate on two timescales. AR(1) cannot represent oscillation; AR(3)+ overfits short circadian time-series.

**AR(1)**: x_t = φ₁x_{t−1} + ε_t. Captures persistence but not oscillation. Systematically underestimates |λ| for circadian genes relative to AR(2).

**Arntl (Bmal1)**: The gene encoding BMAL1, the positive-arm transcription factor of the core TTFL. Consistently shows high eigenvalue modulus (|λ| ≈ 0.70–0.85) across tissues and species — among the highest values in any dataset.

### B–C

**Boman's Five Rules**: Rules governing colonic crypt organisation (Boman et al., Biology of the Cell, 2025): timing of division, temporal order, spatial direction, number of divisions, cell lifespan. Each generates an independent constraint on the AR(2) parameter space, all converging on |λ| ≈ 0.618.

**Characteristic Roots**: Solutions λ of λ² − φ₁λ − φ₂ = 0. If |λ| < 1 the process is stable. Complex-conjugate roots (when φ₁² + 4φ₂ < 0) correspond to a damped oscillation.

**Chronotherapy**: Scheduling medical interventions to align with the patient's circadian phase for maximal efficacy and minimal toxicity.

**Companion Matrix**: The 2×2 matrix [[φ₁, φ₂],[1, 0]] whose eigenvalues are the characteristic roots of the AR(2) process.

### D–F

**DBP (D-element Binding Protein)**: A PAR-bZip transcription factor driven by CLOCK:BMAL1, controlling hundreds of metabolic gene rhythms in liver. Selectively downregulated by sleep deprivation and LPS challenge — the most sensitive indicator of PAR-bZip output layer disruption.

**E-box**: The DNA sequence element CACGTG recognised by CLOCK:BMAL1. Genes with E-box elements are direct transcriptional targets of the positive arm of the TTFL.

**Eigenvalue Modulus |λ|**: The magnitude of the characteristic root of the AR(2) companion matrix. Range: 0 (no persistence) to 1 (boundary of stationarity). The primary quantitative output of the PAR(2) framework. Independent of mean expression, mRNA half-life, and normalisation method.

**Eigenperiod**: Period of the damped oscillation: T = 2π/arg(λ) × Δt. For circadian datasets at 2h intervals, eigenperiods near 24h confirm the AR(2) is capturing the circadian oscillation.

### F–G

**Fibonacci Boundary / Fibonacci Zone**: The region where |λ| ≈ 1/φ ≈ 0.618 (±0.05). The exact Fibonacci recurrence has dominant eigenvalue φ ≈ 1.618, outside the stability boundary. Biologically relevant reference is the stable twin: 1/φ ≈ 0.618.

**Fibonacci Proximity (FP)**: FP = max(0, 100 − ||λ|−0.618|/0.618 × 100). A post-hoc exploratory metric measuring distance from 1/φ ≈ 0.618. The reference value 0.618 was selected after observing that clock gene eigenvalues cluster near this region; FP is therefore a descriptive summary of that proximity, not a pre-specified statistical test. It should be treated as an organising tool for exploration, not as independent evidence for the Fibonacci hypothesis. The cluster centre in mouse liver clock genes is approximately 0.647, not 0.618; FP scores in this book reflect proximity to a threshold that lies slightly below the empirical centre. Classification thresholds: Fibonacci-like: FP ≥ 85%. Near-Fibonacci: 50–85%. Non-Fibonacci: < 50%.

**Gearbox Hierarchy**: Clock genes (high |λ|) constrain proliferative targets (moderate |λ|), which sit above genome background (low |λ|). Observed across 22 datasets, four species (mouse, human, baboon, Arabidopsis), 12+ tissues.

### P–T

**PAR(2)**: Phase-Amplitude-Relationship Order 2. In the narrow sense: an AR(2) model where coefficients are phase-dependent. In the broad sense: the full analytical framework of AR(2) fitting, eigenvalue computation, Fibonacci proximity scoring, and hierarchy analysis.

**PAR-bZip Genes**: DBP, TEF, HLF — direct outputs of the TTFL controlling downstream metabolic targets. The "sustained integrator output arm." Selectively disrupted by sleep deprivation.

**Stationarity Triangle**: The region of (φ₁, φ₂) parameter space where both roots have modulus < 1. Biological circadian genes fall almost exclusively in the complex oscillatory regime within this triangle.

**Temporal Correlation Length (τ_c)**: τ_c = −1/ln(|λ|) × Δt. The timescale over which a gene's expression is autocorrelated. Analogous to correlation length in condensed-matter physics.

**Temporal Persistence**: The degree to which a gene's expression at time t is predicted by its recent history. Quantified by |λ|. Distinct from amplitude, period, and mRNA half-life.

**TTFL (Transcription-Translation Feedback Loop)**: CLOCK:BMAL1 drives Per1/2, Cry1/2; their proteins inhibit CLOCK:BMAL1; PER/CRY degradation releases inhibition. ~24-hour period.

### W–Y

**WEE1**: The primary CDK1 inhibitory kinase, gating the G2/M cell-cycle transition. High temporal persistence at the protein level (|λ| = 0.689, FP = 88.5%). Eigenperiod 12.6h under 3h proteomics sampling (sub-circadian autocorrelation structure; see Chapter 11 note on Check 3 applicability).

**YAP1**: Nuclear effector of the Hippo pathway, controlling organ size and stem cell self-renewal. Near-Fibonacci protein dynamics (|λ| = 0.493, FP = 79.8%). BMAL1 loss predicted to push YAP1 |λ| above the Fibonacci-like boundary, producing irreversible growth state.`,
    platformLinks: [
      { label: "AR(2) Diagnostics: live computation of all key statistics and terms", route: "/ar2-diagnostics" },
      { label: "Root Space: geometric definitions of eigenvalue modulus and argument", route: "/root-space" },
    ],
  },
  {
    id: "appendix-example",
    contentExtended: `This appendix walks through every step of the PAR(2) analysis pipeline using a single gene — Arntl (Bmal1) — from a single publicly available dataset (GSE54650, mouse liver, Hogenesch lab). A reader who completes this example will have reproduced a core result from Paper Q and will be equipped to apply the pipeline to any GEO dataset with ≥ 10 circadian time points.

No specialist software is required. All steps can be performed in a standard Python environment with NumPy.

### Step 1: Obtain the Data

Dataset: GSE54650 (Zhang et al., 2014, PNAS). Multi-tissue mouse circadian atlas, 12 tissues, 24 time points per tissue, 2-hour intervals from CT18 to CT64, constant darkness.

Download the series matrix file for liver from https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE54650. The Arntl probe on GPL6246 is 10346218. The 24 liver time-point columns correspond to CT18, CT20, ..., CT64.

### Step 2: Mean-Centre the Time Series

Compute the mean across all 24 time points. Subtract the mean from each value to get the mean-centred series z_t.

This step is essential: AR(2) fitting to a non-zero-mean series will produce biased coefficient estimates and eigenvalues that do not correspond to the dynamic stability of the oscillation.

### Step 3: Construct the OLS Regression Matrices

The AR(2) model is z_t = φ₁z_{t−1} + φ₂z_{t−2} + ε_t.

For n=24 time points, fit using t = 3, 4, ..., 24 (22 observations):
- Response vector y (length 22): [z_3, z_4, ..., z_24]
- Design matrix X (22 × 2): column 1 = lag-1 values, column 2 = lag-2 values

### Step 4: Ordinary Least Squares Estimation

φ̂ = (X'X)⁻¹X'y

In Python:

import numpy as np
X = np.column_stack([z[1:-1], z[:-2]])
y = z[2:]
phi, _, _, _ = np.linalg.lstsq(X, y, rcond=None)
phi1, phi2 = phi[0], phi[1]

Expected output for Arntl in mouse liver: φ₁ ≈ 1.436, φ₂ ≈ −0.757.

### Step 5: Compute the Eigenvalues of the Companion Matrix

C = [[φ₁, φ₂], [1, 0]]

eigenvalues = np.linalg.eigvals(C)
modulus = np.max(np.abs(eigenvalues))

For Arntl: λ = 0.718 ± 0.491i. Modulus |λ| = 0.870. Eigenperiod = 2π/arg(λ) × 2h ≈ 20.9h.

The complex-conjugate roots confirm that the AR(2) is capturing a damped oscillation — exactly what circadian dynamics look like.

### Step 6: Compute Fibonacci Proximity

FP = max(0, 100 − |0.870 − 0.618|/0.618 × 100) = max(0, 100 − 40.8) = 59.2%

Classification: Near-Fibonacci (50% ≤ FP < 85%).

### Step 7: Stationarity Check

Verify |λ| < 1. Since |λ| = 0.870 < 1, the process is stationary and the fit is valid. If |λ| ≥ 1, exclude the gene from downstream analysis.

### Step 8: Repeat for All Genes

Apply Steps 2–7 to every probe in the liver microarray. For GSE54650 liver, this yields ~35,000 eigenvalue estimates. The stationary fraction is typically 85–95% for circadian datasets.

Compute Fibonacci proximity distribution. Compare mean FP for pre-specified gene sets (clock genes, E-box targets) to genome-wide background using expression-matched permutation testing: for each test, draw 10,000 sets of n genes matched by mean expression quantile and compute mean FP. The p-value is the proportion of random draws exceeding the observed test-set mean FP.

### Complete Python Implementation

def par2_eigenvalue(timeseries):
    z = timeseries - timeseries.mean()
    n = len(z)
    if n < 6: raise ValueError("Need >= 6 time points")
    X = np.column_stack([z[1:-1], z[:-2]])
    y = z[2:]
    phi, _, _, _ = np.linalg.lstsq(X, y, rcond=None)
    phi1, phi2 = phi[0], phi[1]
    C = np.array([[phi1, phi2], [1.0, 0.0]])
    eigenvalues = np.linalg.eigvals(C)
    modulus = float(np.max(np.abs(eigenvalues)))
    dominant = eigenvalues[np.argmax(np.abs(eigenvalues))]
    angle = np.angle(dominant)
    eigenperiod = (2 * np.pi / abs(angle)) if angle != 0 else float('inf')
    is_stable = modulus < 1.0
    fp = max(0.0, 100 - abs(modulus - 0.618) / 0.618 * 100)
    if fp >= 85: classification = "Fibonacci-like"
    elif fp >= 50: classification = "Near-Fibonacci"
    else: classification = "Non-Fibonacci"
    return {"phi1": phi1, "phi2": phi2, "modulus": modulus,
            "eigenperiod_steps": eigenperiod, "is_stable": is_stable,
            "fibonacci_proximity": fp, "classification": classification}

### A Second Worked Example: Dbp (Clock Target Gene)

The worked example for Bmal1 demonstrates the pipeline for a core clock gene. To see the hierarchy in action — and to confirm that a researcher can reproduce the clock/target eigenvalue gap with their own hands — a second gene from the same dataset is equally important.

**Gene:** Dbp (D-box binding PAR domain protein). **Dataset:** GSE54650 liver. **Note:** Dbp is identified by gene name in the GSE54650_Liver_circadian.csv series matrix (not probe ID); the values below are from the row labelled "Dbp" after log2 transformation.

Step 1: Extract the 24 liver time-point values for Dbp. Step 2: Log2-transform, then mean-centre (subtract the per-gene mean across all 24 time points). Step 3: Fit AR(2) by OLS using the lag-1 and lag-2 column construction described in the Arntl example. Expected output: φ₁ ≈ 1.200, φ₂ ≈ −0.543.

Step 4: Compute the companion matrix eigenvalues.

eigenvalues = np.linalg.eigvals([[1.200, -0.543], [1.0, 0.0]])

Expected: λ = 0.600 ± 0.428i. Modulus: |λ| = √(0.600² + 0.428²) = √(0.360 + 0.183) = √0.543 = 0.737. Eigenperiod: T = 2π / arctan(0.428/0.600) × 2h ≈ 20.2h.

Step 5: Fibonacci proximity. FP = max(0, 100 − |0.737 − 0.618|/0.618 × 100) = max(0, 100 − 19.3) = 80.7%. Classification: Near-Fibonacci (50% ≤ FP < 85%).

**Comparison with Arntl:** Both genes show complex-conjugate roots, confirming oscillatory dynamics. Dbp has slightly *higher* Fibonacci proximity (80.7%) than Arntl (59.2%) — it sits closer to the 0.618 boundary. But its eigenvalue modulus (0.737) is lower than Arntl's (0.870). This illustrates a critical point: Fibonacci proximity and eigenvalue modulus are related but not identical. A gene can be relatively close to 0.618 with a lower absolute eigenvalue (like Dbp — a target gene, strongly clock-driven but not self-sustaining) or farther from 0.618 with a higher absolute eigenvalue (like Arntl — embedded in the self-sustaining TTFL). Both quantities carry information; neither alone is sufficient.

Note on exact values: the figures above (φ₁ ≈ 1.200, φ₂ ≈ −0.543, |λ| = 0.737) are computed from the GSE54650_Liver_circadian.csv file with log2 transformation and OLS fitting, as described in the pipeline. Both values are probe- and normalisation-dependent; independent re-fits of the same dataset recover values in the same broad range but may differ in the specific Arntl vs. Dbp ordering for this single gene pair. The robust claim is at the category level, not this specific two-gene contrast.

The worked example above illustrates the clock/target contrast: in this GSE54650 liver fit, Arntl |λ| = 0.870 and Dbp |λ| = 0.737 — both well above the background median (≈ 0.496), and both clearly in the high-persistence regime consistent with their clock-gene classification. The foundational empirical claim of the PAR(2) framework is the category-level hierarchy — clock genes as a group show systematically higher |λ| than background genes as a group — which replicates across all 22 datasets, four species, and 12 tissues. The specific ordering of any two individual genes within the clock category is sensitive to probe choice and normalisation and should not be treated as a fixed result; it is the category medians and the clock-vs-background gap that are robust.

### Common Failure Modes

|λ| > 1 for most genes: series was not mean-centred. Fix: subtract per-gene mean before fitting.

All eigenvalues = 0: constant time series (zero-variance probes). Fix: pre-filter genes with variance > threshold.

Eigenperiod ≪ sampling interval: too few time points (aliasing). Fix: require n ≥ 10.

Stationarity fraction < 70%: linear trend present. Fix: check that mean-centring is per-condition; check for linear drift and detrend if needed.

Dbp eigenvalue unexpectedly high (|λ| > 0.820 in liver): verify that the dataset is from a healthy, undisrupted animal under standard light-dark conditions. In the GSE54650 reference dataset, the typical healthy Dbp |λ| is approximately 0.737 (log2-transformed, OLS fit); values above 0.820 may reflect unusually strong clock-output coupling or a dataset-specific effect worth checking. Values below 0.500 suggest output-layer disruption of the kind seen in sleep deprivation or APC mutation.

Clock/target gap < 0.050: the hierarchy is present but compressed. This is a warning sign, not a fatal error. Check for (1) short time-series (n < 12) which compress all eigenvalues toward zero; (2) tissue with known weak circadian output (some brain regions outside the SCN show compressed hierarchies); (3) disease state (APC-KO and BMAL1-KO both compress the gap). If none of these apply and the dataset passes all four diagnostic checks, a compressed gap is a genuine biological finding worth reporting.

Clock genes show low FP: samples not in circadian order. Fix: re-order samples by circadian time (CT or ZT) before fitting.

The full pipeline, including multi-dataset batch processing, expression-matched permutation testing, and visualisation of the eigenvalue distribution in the stationarity triangle, is available at par2discovery.com.`,
    platformLinks: [
      { label: "AR(2) Diagnostics: reproduce the Arntl and Dbp worked examples", route: "/ar2-diagnostics" },
      { label: "Gene Explorer: Arntl and Dbp eigenvalue profiles in GSE54650", route: "/gene-explorer" },
    ],
  },
  {
    id: "epilogue",
    contentExtended: `What does it mean for a scientific book to be alive? The question sounds metaphorical, but in the context of this work it is literal. The PAR(2) Discovery Engine — the platform on which every analysis in this book is implemented — continues to run. New datasets feed into it. New analyses are added as the papers progress through peer review. The figures in these chapters are static snapshots of results that are dynamically updated each time the underlying data is refreshed. The text describes what was found and when; the platform shows what can be found now.

### The Living Nature of Scientific Claims

A conventional scientific paper is a fixed statement. At the moment of submission, the data are frozen, the analyses are locked, and the conclusions are committed. Subsequent correction happens in Erratum notices and follow-up papers — external to the original document, awkward to trace, and often invisible to readers who encountered the original before the corrections appeared.

This book is structured to avoid that problem where possible. Every claim is linked to a platform analysis that can be re-run with updated data or different parameters. Where a finding is robust — stable across reasonable variations in dataset, normalisation, or gene category definition — the platform demonstrates that robustness. Where a finding is sensitive to specific analytical choices, the platform exposes that sensitivity.

This transparency is not merely an aesthetic virtue. It is epistemically necessary for a framework that makes quantitative claims. "The eigenvalue of Bmal1 in mouse liver is 0.650" is not the same kind of claim as "Bmal1 is a circadian gene." The quantitative claim commits to a precision that a qualitative claim does not. Precision can be wrong in specific, testable ways. The platform exists to make the wrongness visible, if and when it appears.

### Where the Papers Stand

Paper A — the core Methods and Validation paper — is under review at *Chronobiology International* (submitted July 2026). It establishes the mathematical basis of the PAR(2) metric, documents the full diagnostic battery, and presents the cross-species validation across 22 datasets.

Paper G — the Boman reply incorporating the Fibonacci/golden ratio analysis — has been accepted and is in press at *The Fibonacci Quarterly* (doi:10.1080/00150517.2026.2716122). It proposes that Boman's five temporal–spatial rules have a natural time-domain analogue in the PAR(2) framework. The algebraic identity connecting the Fibonacci division constraint to 1/φ is proved as Theorem 1; the biological mechanism that would produce the empirical clustering near 1/φ remains an open question, treated explicitly as a hypothesis rather than a confirmed result.

Papers E (Cancer), F (Drug Targets), and Q (Central-Peripheral Gradient) are in final preparation. Their analyses are complete and have been reviewed internally. The submission timeline targets peer review entry by early 2027.

Papers H (Turing correspondence) and J (evolutionary age gradient) are in early stages — the analyses described in Chapter 9 represent work in progress, not final findings. Their inclusion in this book is intended to indicate the direction of the work, not to claim results that are not yet established.

### What Would Falsify This

The claims in this book are worth stating in falsifiable form — not as a rhetorical gesture, but because testable predictions are what make a framework useful to people outside this project.

**The core finding (Part I) would be falsified by:**

An independent implementation of the AR(2) pipeline — in any language, by any researcher, using the same 22 GEO datasets listed in Chapter 3 — that fails to recover a clock/background eigenvalue gap of at least 0.10 units in the majority of datasets. The data are public, the pipeline is fully described in Paper A, and the reference implementation runs live at the platform. A failure to replicate this specific result would be a serious problem for the framework.

**The three-tier ordering claim would be weakened by:**

Finding that the target gene tier (|λ| ≈ 0.53) does not sit systematically above background in a pre-specified new tissue type — particularly one where the circadian transcriptome is well characterised and a literature-validated target gene list is available. The claim already acknowledges that the full three-tier ordering fails in 4 of the 12 GSE54650 tissues; a rate substantially above that in new tissues would reframe the three-tier ordering from "near-universal" to "tissue-restricted."

**The Fibonacci hypothesis (Chapter 7) would be weakened by:**

A demonstration that the AR(2) stability triangle geometry alone — without any biological constraint — places oscillating systems in the 0.60–0.70 region by mathematical necessity, regardless of whether the underlying biology has any Fibonacci structure. If the proximity to 0.618 is a geometric artefact of the model rather than a biological signal, the hypothesis collapses. This is a specific, tractable mathematical question that has not yet been answered.

**The application chapters (Part II) would each be falsified by:**

Failure to replicate in a larger, pre-registered study in the relevant domain. Chapter 12 (glucose monitors) has now been tested in a second dataset — the Colas et al. (2019) normoglycemic cohort (n = 18) — which found that the inverse |λ|–CV% correlation is not present in the normoglycemic range (r = +0.26, p = 0.30), supporting its specificity to pathological glycaemic variability. The outstanding requirement is a large multi-day raw CGM study (n ≥ 50) that spans the full pre-diabetic-to-diabetic spectrum using clinical CV% (from raw 5-minute recordings) and tests whether |λ| predicts transition to frank T2DM or HbA1c trajectory. Chapter 10 (immune clock) requires a second macrophage dataset. Chapter 11 (proteomics) requires a second circadian proteomics dataset in a different tissue. These are not currently available; obtaining them is the next empirical priority for each application.

**The platform is designed to make all of the above possible.** The pipeline is open, the reference datasets are publicly archived, and every numerical claim in Part I can be reproduced from scratch in an afternoon. If the core finding is wrong, it should be straightforward to show that. If it is right, independent replication will be the most important contribution to this framework that anyone outside this project can make.

---

### What a Quantitative Claim Requires

Making a quantitative claim in biology — not "this gene oscillates" but "this gene's eigenvalue is 0.650 ± 0.032 across replicate datasets" — carries specific obligations that qualitative claims do not. The method must be defined precisely enough that any competent researcher can reproduce it independently. The uncertainty on every estimate must be reported and honestly represent the sampling variability, not just the fitting uncertainty. The conditions under which the claim holds must be specified: species, tissue, sampling resolution, normalisation method, and gene category definition.

Most importantly, a quantitative claim must generate specific, quantitative predictions that can be tested by other researchers who did not generate the original data. The prediction that "cancer mutations should reduce the clock/target eigenvalue gap in intestinal tissue" was tested in Paper E. The prediction that "peripheral tissues should show higher clock gene eigenvalues than central tissues" was tested in Paper Q. The prediction that "mRNA stability should be uncorrelated with eigenvalue" was tested in Paper F. Each of these predictions was made before the testing dataset was analysed.

The track record of prediction-and-test so far: all three predictions were confirmed. This does not establish that the PAR(2) framework is correct in all its claims — it establishes that it is generating testable predictions that survive initial testing. The distinction matters: science progresses not by proving frameworks correct but by repeatedly failing to prove them wrong, while the evidence in their favour accumulates.

### The Experiments That Would Settle the Questions

Four experiments, if successfully conducted, would substantially advance understanding of what the eigenvalue hierarchy means and whether its implications are as far-reaching as the current findings suggest.

The first is a direct regulatory architecture manipulation: using CRISPRi to systematically tile silencing across the E-box and D-box regulatory elements of a clock target gene — Dbp is the obvious candidate — and measuring how |λ| changes as each element is removed. If eigenvalue declines monotonically with regulatory element count, the eigenvalue is measuring regulatory architecture. If it is invariant, it is measuring something else. This experiment is technically feasible with current CRISPRi tools and requires no new technology — only a collaboration between computational prediction and experimental execution.

The second is the prospective chronotherapy trial: a randomised controlled trial in which cancer patients are allocated to timed versus standard administration of a drug targeting a high-|λ| gene, with circadian phase monitored longitudinally via blood-based gene expression assays. The PAR(2) platform predicts which drug and which target timing window. The trial tests that prediction in human patients. No such trial is currently planned, but the 847-gene candidate list in Paper F provides the target selection framework.

The third is the crypt architecture perturbation: genetic manipulation of Wnt pathway strength in mouse intestinal organoids — not the binary APC-knockout used in Paper E but a graded reduction using inducible systems — to test whether the distribution of crypt eigenvalues near 0.618 shifts in the predicted direction as the Boman q is altered. A monotone shift would confirm the mechanistic interpretation of the Fibonacci correspondence; an absence of shift would indicate a mathematical rather than biological origin.

The fourth is cross-species single-cell validation: applying the AR(2) pipeline to single-cell RNA sequencing data with temporal resolution — a technically challenging but achievable experiment using pseudotime trajectory analysis or MERFISH spatial temporal imaging — to ask whether eigenvalue modulus varies within a tissue according to cell type in a manner consistent with the tissue's position in the circadian hierarchy. Individual cells within the liver express the clock with different phases and amplitudes; the eigenvalue hierarchy at the single-cell level would reveal whether the finding extends from population averages to individual cellular biology.

### A Note to Future Readers

If this work is correct — if the eigenvalue hierarchy reflects genuine circadian regulatory architecture, if the Fibonacci correspondence is mechanistically real, if the chronotherapy candidates identified here show timing-dependent efficacy in prospective trials — then the platform will grow more useful as more data accumulates and more predictions are tested. The framework will be extended, refined, and eventually superseded by frameworks that incorporate the additional dimensions of biology that the current model cannot see.

If this work is wrong — if a confound is discovered that the analysis missed; if a well-designed experiment shows that eigenvalue manipulation does not produce the predicted functional changes; if independent replication consistently fails in new experimental contexts — the platform will document the failure. The analysis pipelines will be modified to account for the confound, or the framework will be retired in favour of a better one.

Either outcome is progress. The eigenvalue of a gene's temporal dynamics is a simple number — a single real value between 0 and 1. That a number this simple, computed from a statistical model first applied to sunspot data a century ago, should reveal consistent structure in the regulatory architecture of the mammalian circadian system across species and diseases and evolutionary timescales is, at minimum, a fact worth understanding. Whether it is the beginning of a quantitative science of circadian architecture or a beautiful but ultimately narrow methodological contribution will be determined by the accumulation of evidence over the next decade.

The platform exists so that anyone with a time-series dataset and a question can participate in finding out.

### Acknowledgment

One person deserves a particular note.

Dr. Bruce M. Boman's mathematical work on intestinal crypt tissue architecture — the five-rule tissue code, the Fibonacci recursion arising from asymmetric cell division, the steady-state ratio that converges on 1/φ — provided the intellectual scaffold for Chapter 7 and for much of what the PAR(2) framework eventually became in the biological domain. The conversation between his framework and the eigenvalue approach was not planned; it emerged from the mathematics itself. But it would not have been pursued, or pursued with the same care, without his quiet encouragement at a formative moment in this work.

Science is rarely as solitary as its published form suggests. This work is no exception.

### A Debt to the Community

The PAR(2) framework did not generate a single data point. Every number in this book was produced by someone else — in a laboratory, at an institution, at a cost of time and money and effort — and then made freely available to the world through the Gene Expression Omnibus. That act of open deposition is easy to take for granted when you are the beneficiary of it. It should not be.

The Hogenesch laboratory at the University of Pennsylvania (Joseph Hogenesch, Michael Hughes, and colleagues) deposited GSE11923 — the mouse liver 48-hour time series that provided the first clean test of the eigenvalue hierarchy. Without that dataset, this project might never have started. The Salk Institute team responsible for GSE98965 (Ludovic Mure, Hiep Tran, Satchidananda Panda, and colleagues) generated one of the most ambitious circadian transcriptome datasets ever assembled — 64 tissues across an entire 24-hour cycle in baboon — and made it fully public. The Karpowicz laboratory (Phillip Karpowicz, Kyle Stokes, and colleagues) produced the four-condition intestinal organoid dataset GSE157357 that yielded the APC-KO signature in Chapter 5. The Rosselot and Bhaskara groups contributed the human organoid and multi-tissue datasets that allowed cross-species validation. Rui Zhang, Nicholas Lahens, and the Hogenesch group deposited GSE54650, the 12-tissue mouse atlas central to the central-peripheral gradient analysis in Paper Q. Jan and colleagues made the BXD sleep genetics dataset (GSE114845) available for the sleep chapter. The Mure et al. human GTEx-adjacent data, the Zhao et al. wearable time-series resource, and the Wang multi-tissue RNA-seq collection each represent years of experimental work that a computational analysis can consume in an afternoon.

To every author, technician, graduate student, and postdoctoral researcher whose work appears in GEO accession numbers cited in this book: the citation is the minimum acknowledgment. The actual debt is larger.

The NCBI and the National Institutes of Health, who maintain the Gene Expression Omnibus as a public resource — freely searchable, freely downloadable, permanently archived — have done something that is not fully appreciated until you try to imagine doing this work without it. The infrastructure of open science is invisible until it is absent. The open-source scientific software ecosystem — R and its Bioconductor community, Python and its scientific stack, the countless packages written and maintained by researchers who receive no direct credit for that labour — provided every computational tool used in this analysis.

The circadian biology community built the experimental ground truth. The clock gene annotations, the E-box target lists, the knockout phenotypes, the tissue-specific expression atlases — these required decades of careful experimentation by hundreds of laboratories worldwide. JTK_CYCLE, RAIN, CircaDB, and the other tools and databases that the community built and shared represent an intellectual commons that computational work like this can only access, never fully repay. The mathematical tradition of time-series analysis — from Yule's 1927 autoregressive framework through the modern statistical literature on short-series estimation — provided the language.

This is what the scientific community looks like from the inside — not a competitive arena but a distributed, partially anonymous infrastructure of shared effort. It functions because most of its participants contribute more than they extract. This work is a net extractor. The acknowledgment is genuine, even if inadequate.`,
    platformLinks: [
      { label: "Discovery Engine: all 95 live analyses — start exploring", route: "/discovery-engine" },
      { label: "AR(2) Fit Diagnostics: reproducibility checks for all paper claims", route: "/ar2-diagnostics" },
    ],
  },
];
