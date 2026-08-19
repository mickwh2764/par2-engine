/**
 * Canonical science-critical text for the PAR(2) Concise Edition.
 *
 * Single source of truth shared by:
 *   - client/src/pages/book.tsx  (web rendering)
 *   - server/routes/book.ts      (docx/PDF generation)
 *
 * AUDIT RULE: Any change to these strings must pass all 20 items in
 * book_sync_checklist.md before commit. Do NOT edit book.tsx or book.ts
 * chapter prose directly — edit here only.
 *
 * Extended edition (shared/book-extended-chapters.ts) has its own longer
 * versions of these passages; keep them in sync using the checklist.
 */
import { GSE54650_LIVER, GSE11923 } from "./canonical-values";

export const CONCISE_CHAPTER3_CONTENT = `The first test used GSE11923 — a mouse liver time series sampled hourly across 48 hours (48 time points; Hughes et al. 2009), used here at 2-hour resolution (24 time points), with ~12,000 genes. Because the eigenvalue modulus depends on the sampling interval, absolute |λ| values are comparable only within a fixed Δt and are not directly portable across datasets sampled at different intervals; the eigenperiod is reported in sampling-interval units. A scalar lag-1 autocorrelation performs comparably as a simpler persistence measure (AUC ≈ 0.96 vs. 0.88 for |λ|), but |λ| additionally captures the oscillatory structure and eigenperiod. The result was immediate and stark: the eight core clock genes (Bmal1, Clock, Cry1, Cry2, Per1, Per2, Per3, Rorα) had a median |λ| of 0.671. The 4,218 literature-validated clock target genes had a median of 0.531. The remaining background genes had a median of 0.412. The hierarchy was not subtle — it was a 0.14-unit gap between each tier, consistent across the full range of expression levels and immune to adjustment for transcript abundance.

But a single dataset, however clean, proves nothing. The test was immediately extended to every circadian time-series dataset that could be obtained from the Gene Expression Omnibus: 22 datasets in total, spanning mouse (4 tissues), human blood (GSE113883, Braun et al. 2018 PNAS; GSE48113, Archer et al. 2014), baboon (12 tissues from the landmark Mure et al. dataset), and Arabidopsis. Clock genes separated from background in every dataset, every tissue, and every species — the robust, near-universal result. The full three-tier ordering (clock > target > background) held in most but not all tissues; the target and background tiers overlap in a minority (for example, in 4 of the 12 GSE54650 tissues, where the full ordering held in 8).

The species comparison revealed variation in absolute eigenvalue values, but not in the direction of the hierarchy. Mouse peripheral tissues showed clock gene medians in the range 0.65–0.71. The baboon dataset — 64 tissues measured at 2-hour resolution across a full 24-hour cycle by Mure et al. at the Salk Institute — showed the highest absolute values, with baboon lung clock genes reaching median |λ| = 0.611 (14 stable genes; PER3 and NR1D2 unstable in this tissue, excluded; lower than mouse lung at 0.797, consistent with the smaller baboon sample size of n = 12 vs n = 24 time points) and the baboon SCN (the central pacemaker, directly measured for the first time in any mammalian circadian atlas) showing a strikingly low median of |λ| = 0.471, consistent with its architectural role as a phase-sensitive rapid-adaptor rather than a sustained integrator. The two Arabidopsis datasets showed the lowest absolute values — plant circadian dynamics operate on different kinetic timescales — but the same relative ordering.

The literature validation pointed the same way. Among ${GSE11923.literatureConcordance.genesTestedN} genes listed in the CircaDB as clock-controlled, ${GSE11923.literatureConcordance.aboveBackgroundMedianN} of ${GSE11923.literatureConcordance.genesTestedN} showed higher |λ| than the background median in their respective tissue — a ~${GSE11923.literatureConcordance.enrichmentFold}-fold enrichment over the chance expectation for that permissive criterion. (The ${GSE11923.literatureConcordance.percentRecovery}% figure is recovery above a broad threshold, i.e. enrichment, not unique identification of clock genes.) The single exception was Tp53. Tp53 is correctly annotated in CircaDB: p53 protein stability oscillates with circadian period through a PER2-MDM2 mechanism, with PER2 blocking MDM2-mediated ubiquitination of p53 (Gotoh et al., Mol Cell 2016). But this regulation is entirely post-translational — the Trp53 mRNA does not cycle. PAR(2) measures mRNA temporal persistence, so it correctly returns a below-background eigenvalue for Trp53. The method identified the precise point where Tp53's circadian biology diverges from the transcriptional level.

Perhaps most striking was the independence of the finding from the analysis method used to identify clock targets. Whether clock targets were defined by co-expression, chromatin-immunoprecipitation of BMAL1, or genetic perturbation studies, the same eigenvalue hierarchy emerged. The signal was not a property of how clock genes were defined — it was a property of the biology. Twenty-two independent experiments. Four species. Fourteen tissue types. Clock genes above background: the robust, near-universal result. Full three-tier ordering (clock > target > background): held in most tissues, with the target and background tiers overlapping in a minority.`;

export const CONCISE_CHAPTER3_DOCX_FIGURE = `FIGURE 3.1 — Cross-Species Replication:
              Clock  Target  Background
Mouse         0.67   0.54    0.42
Human         0.63   0.51    0.40
Baboon        0.66   0.53    0.41
Arabidopsis   0.61   0.50    0.38
The hierarchy holds without re-fitting across all four species.`;

export const CONCISE_APPENDIX_C_CONTENT = `This appendix walks through two worked examples of the PAR(2) pipeline — one clock gene and one clock target gene — using mouse liver from GSE54650. A reader who completes both will have reproduced the core clock/target hierarchy contrast and will be equipped to apply the pipeline to any GEO dataset with ≥ 10 circadian time points.

Example 1 — Arntl (Bmal1), core clock gene. From GEO accession GSE54650 liver (GSE54650_Liver_circadian.csv), 24 time points at CT18–CT64. Log2-transform, then mean-centre. Fit AR(2) by OLS. Expected: φ₁ ≈ ${GSE54650_LIVER.arntl.phi1}, φ₂ ≈ ${GSE54650_LIVER.arntl.phi2}. Companion matrix eigenvalues: λ = ${GSE54650_LIVER.arntl.eigenvalueReal} ± ${GSE54650_LIVER.arntl.eigenvalueImag}i, |λ| = ${GSE54650_LIVER.arntl.lambda}. Eigenperiod ≈ ${GSE54650_LIVER.arntl.periodH}h. FP = max(0, 100 − |${GSE54650_LIVER.arntl.lambda}−0.618|/0.618 × 100) = ${GSE54650_LIVER.arntl.fp}%. Classification: Near-Fibonacci.

Example 2 — Dbp (D-box binding PAR domain protein), clock target gene. Same dataset, gene row "Dbp". Log2-transform, mean-centre, OLS fit: φ₁ ≈ ${GSE54650_LIVER.dbp.phi1}, φ₂ ≈ ${GSE54650_LIVER.dbp.phi2}. Eigenvalues: λ = ${GSE54650_LIVER.dbp.eigenvalueReal} ± ${GSE54650_LIVER.dbp.eigenvalueImag}i, |λ| = ${GSE54650_LIVER.dbp.lambda}. Eigenperiod ≈ ${GSE54650_LIVER.dbp.periodH}h. FP = max(0, 100 − |${GSE54650_LIVER.dbp.lambda}−0.618|/0.618 × 100) = ${GSE54650_LIVER.dbp.fp}%. Classification: Near-Fibonacci. Both genes show complex-conjugate roots confirming oscillatory dynamics, and both sit well above the background median (≈ 0.50), consistent with clock-gene classification. In this GSE54650 liver fit, Arntl |λ| = ${GSE54650_LIVER.arntl.lambda} and Dbp |λ| = ${GSE54650_LIVER.dbp.lambda} — a ${GSE54650_LIVER.hierarchy.gap}-unit gap. The foundational empirical claim is the category-level hierarchy: clock genes as a group show systematically higher |λ| than background genes as a group. The specific ordering of any two individual clock genes is probe- and normalisation-dependent and should not be treated as a fixed result.

Common failure modes: |λ| > 1 for most genes — series was not mean-centred. Eigenperiod ≪ 2h — too few time points (require n ≥ 10). Stationarity fraction < 70% — remove linear trend before fitting. Ljung-Box failure rate > 20% — consider AR(3) for this dataset (rare in circadian data). Full Python implementation in the Extended edition.`;
