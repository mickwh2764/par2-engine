/**
 * CANONICAL VALUES REGISTRY
 *
 * Single source of truth for all key numerical claims cited in the book,
 * papers, and platform pages. Every value here is traceable to a specific
 * dataset, computation method, and verification date.
 *
 * RULE: No hardcoded numerical claim about PAR(2) results should appear
 * anywhere in book content, paper abstracts, or platform UI without being
 * imported from (or traceable to) this file.
 *
 * When a value changes (new normalisation, updated pipeline, new dataset),
 * update it here and it propagates everywhere automatically.
 */

// ─── GSE11923 — Mouse Liver, Hughes et al. 2009 ──────────────────────────────
// Dataset: Hogenesch lab, Affymetrix, 48 time points at 1h native resolution
// Used in book at 2h subsampled resolution (24 time points, 2 complete cycles)
// Verified: original analysis, not independently re-run 2026
export const GSE11923 = {
  citation: "Hughes et al. 2009, PLOS Genetics",
  species: "mouse",
  tissue: "liver",
  nativeTimepoints: 48,
  nativeSamplingH: 1,
  usedTimepoints: 24,
  usedSamplingH: 2,
  probes: 12000,

  // Core gene fits (used in Ch.2 worked example)
  bmal1: {
    lambda: 0.650,
    note: "Bmal1 (Arntl), probe from GPL1261",
  },
  dbp: {
    lambda: 0.529,
    phi1: 0.989,
    phi2: -0.280,
    eigenvalueReal: 0.495,
    eigenvalueImag: 0.188,
    periodH: 24.1,
    fp: 85.6,
    note: "Dbp, probe from GPL1261. Confirmed correct for GSE11923.",
  },

  // Three-tier hierarchy (genome-wide, GSE11923 liver)
  tiers: {
    clock:      { median: 0.671, label: "Clock genes" },
    target:     { median: 0.531, label: "Clock target genes" },
    background: { median: 0.412, label: "Background genes" },
    gapClockTarget:      0.140,
    gapTargetBackground: 0.119,
    note: "Medians from full genome-wide analysis, expression-matched permutation p < 0.001",
  },

  // Literature concordance (CircaDB, 59 annotated genes)
  literatureConcordance: {
    genesTestedN: 59,
    aboveBackgroundMedianN: 58,
    percentRecovery: 98.3,
    enrichmentFold: 3.9,
    note: "98.3% is recovery above the background median (enrichment), NOT unique identification. 3.9-fold enrichment over chance.",
  },
} as const;


// ─── GSE54650 — Mouse 12-Tissue Atlas, Storch et al. 2002 ───────────────────
// Dataset: Affymetrix GPL6246, 24 time points CT18–CT64 (2h spacing)
// IMPORTANT: Raw CSV contains linear-scale intensities; log2 transformation
// required before AR(2) fitting. See Appendix C.
// Verified: live AR(2) fit on GSE54650_Liver_circadian.csv, July 2026
export const GSE54650_LIVER = {
  citation: "Storch et al. 2002 / Hughes et al. 2009 extended",
  species: "mouse",
  tissue: "liver",
  timepoints: 24,
  samplingH: 2,
  ctRange: "CT18–CT64",
  preprocessing: "log2 transformation, mean-centering, OLS AR(2)",
  verifiedDate: "2026-07-18",

  // Core gene fits (Appendix C worked examples)
  arntl: {
    phi1: 1.436,
    phi2: -0.757,
    eigenvalueReal: 0.718,
    eigenvalueImag: 0.491,
    lambda: 0.870,
    periodH: 20.9,
    fp: 59.2,
    classification: "Near-Fibonacci",
    note: "Arntl (Bmal1), identified by gene name in CSV. |λ| = sqrt(-phi2) = sqrt(0.757) = 0.870.",
  },
  dbp: {
    phi1: 1.200,
    phi2: -0.543,
    eigenvalueReal: 0.600,
    eigenvalueImag: 0.428,
    lambda: 0.737,
    periodH: 20.2,
    fp: 80.7,
    amplitudeLog2: 4.4,
    classification: "Near-Fibonacci",
    note: "Dbp, identified by gene name in CSV. Previously cited as 0.529 (error: GSE11923 value copy-pasted).",
  },

  // Clock/target hierarchy (single-gene comparison)
  hierarchy: {
    gap: 0.133,
    note: "Arntl |λ| - Dbp |λ| = 0.870 - 0.737. Gap ordering is the robust claim; exact values normalisation-dependent.",
    robustClaim: "Arntl > Dbp ordering reproduces across normalisation choices",
  },

  // Disease phase ratio (τ_c = -2/ln|λ|, clock τ / target τ)
  healthyPhaseRatio: {
    ratio: 2.19,
    clockTauH: 14.4,
    targetTauH: 6.6,
    formula: "tau_c = -2 / ln(|lambda|)",
    note: "Corrected from 1.74× (which used wrong Dbp |λ| = 0.529).",
  },
} as const;


// ─── Cross-tissue Population Statistics (Paper P) ────────────────────────────
// GSE54650 (12 tissues) + GSE48113, log2 OLS AR(2)
// 169 oscillatory clock-gene measurements, 286 oscillatory target-gene measurements
export const CROSS_TISSUE_TAU = {
  datasets: ["GSE54650", "GSE48113"],
  nTissues: 13,
  clockGeneN: 169,
  targetGeneN: 286,
  meanClockTauH: 3.9,
  meanTargetTauH: 2.0,
  tauRatio: 2.0,
  tauRatioCI95: [1.6, 2.4] as const,
  tauRatioPValue: 0.000122,
  concordantTissues: "13/13",
  g24Ratio: 18.5,   // G(24): clock vs target 24h autocorrelation residual
  note: "Population means across all tissues — NOT the same as GSE54650_LIVER single-gene comparison. Ratio 2.0× vs 2.19× are different quantities.",
} as const;


// ─── Disease Phase Diagram States ────────────────────────────────────────────
// Clock τ_c / Target τ_c ratio across biological conditions
export const DISEASE_PHASE_STATES = {
  healthy: {
    ratio: 2.19,
    clockLambda: 0.870,
    targetLambda: 0.737,
    dataset: "GSE54650 liver",
    note: "Arntl vs Dbp, log2 OLS. tau_c = -2/ln|lambda|.",
  },
  dblKORescue: {
    ratio: 1.22,
    // IMPORTANT: clockLambda and targetLambda below are ILLUSTRATIVE REPRESENTATIVE VALUES
    // only. They do NOT reproduce the stated ratio via τ_c = −2/ln|λ|:
    //   −2/ln(0.565) / −2/ln(0.462) ≈ 1.35, NOT 1.22.
    // The definitive claim is ratio=1.22, sourced from the median clock vs. median target
    // λ values across the DblKO genotype in GSE157357. The exact defining gene pair
    // cannot be recovered without an Ensembl→gene-symbol mapping for GSE157357
    // (dataset uses Ensembl IDs only). Do not use these lambdas to re-derive τ values.
    clockLambda: 0.565,
    targetLambda: 0.462,
    dataset: "GSE157357 (ApcKO+BmalKO organoids, Stokes et al. 2021)",
    note: "ratio=1.22 is the authoritative result; lambda pair is illustrative and does not reproduce this ratio via τ_c = −2/ln|λ|. See audit-log-2026-08.md §10.",
  },
  bmal1KO: {
    ratio: 0.99,
    clockLambda: 0.498,
    targetLambda: 0.503,
    dataset: "GSE70499 (BmalKO mouse liver, Yang et al. 2016)",
    note: "Clock autonomy lost; hierarchy collapses to parity.",
  },
  apcKO: {
    ratio: 0.43,
    // IMPORTANT: clockLambda and targetLambda below are ILLUSTRATIVE REPRESENTATIVE VALUES
    // only. They do NOT reproduce the stated ratio via τ_c = −2/ln|λ|:
    //   −2/ln(0.663) / −2/ln(0.790) ≈ 0.57, NOT 0.43.
    // The definitive claim is ratio=0.43, sourced from the median clock vs. median target
    // λ values across the ApcKO genotype in GSE157357. The exact defining gene pair
    // cannot be recovered without an Ensembl→gene-symbol mapping for GSE157357
    // (dataset uses Ensembl IDs only). Do not use these lambdas to re-derive τ values.
    clockLambda: 0.663,
    targetLambda: 0.790,
    dataset: "GSE157357 (ApcKO organoids, Stokes et al. 2021)",
    note: "E2F programme dominant; hierarchy inverted. ratio=0.43 is the authoritative result; lambda pair is illustrative and does not reproduce this ratio via τ_c = −2/ln|λ|. See audit-log-2026-08.md §10.",
  },
} as const;


// ─── Three-Tier Universality Scope ───────────────────────────────────────────
// What exactly "holds" across datasets
export const THREE_TIER_SCOPE = {
  totalDatasets: 22,
  species: 4,
  tissueTypes: 14,
  // What is universal:
  clockVsBackground: "Clock genes separate from background in every dataset — no exceptions.",
  // What is most-but-not-all:
  fullThreeTier: "Full clock > target > background ordering holds in most tissues; target and background tiers overlap in a minority.",
  // Specific GSE54650 data point:
  gse54650FullTierN: 8,
  gse54650TotalTissues: 12,
  gse54650FullTierFraction: "8/12",
  note: "Critical: 'zero exceptions' refers to clock-vs-background only. The full three-tier claim requires qualification.",
} as const;


// ─── AR(2) vs AR(1) Comparison ───────────────────────────────────────────────
// Honest baseline comparison (from Devin's independent analysis)
export const METHOD_COMPARISON = {
  ar1AUC: 0.96,
  ar2AUC: 0.88,
  note: "For the binary task of separating clock genes from housekeeping genes, AR(1) AUC ≈ 0.96 vs AR(2) AUC ≈ 0.88 in independent testing on GSE54650. AR(2)'s added value is root-type classification and eigenperiod (structural information), not a larger classification gap.",
  ar2Advantages: [
    "Complex-versus-real root classification",
    "Eigenperiod estimate (~20–24h circadian)",
    "Fibonacci proximity metric",
    "Stationarity triangle geometry",
    "Detects oscillatory vs monotone persistence",
  ],
} as const;


// ─── Sampling Interval Comparability Rule ────────────────────────────────────
export const SAMPLING_COMPARABILITY = {
  rule: "Absolute |λ| values are comparable ONLY within a fixed native sampling interval.",
  reason: "At 1h native sampling, adjacent time points are mechanically more correlated, inflating |λ| for all gene categories relative to 2h sampling. The ordering (clock > target > background) is robust; the absolute numbers are not cross-interval comparable.",
  gse11923NativeSamplingH: 1,
  bookUsageSamplingH: 2,
  note: "GSE11923 used at 2h subsampling in the book — values derived from this subsampled series, not the native 1h series.",
} as const;


// ─── Wee1 Liver φ-Proximity (Three-Oscillator Analysis) ─────────────────────
// GSE54650 Liver, log2-preprocessed AR(2) OLS, expression-matched permutation
// Corrected Aug 2026: original permutation used raw (non-log2) intensities,
// giving |λ|=0.6151 (Δ=0.0030, p=0.0142, BH q<0.05) — an artifact of the
// missing log2 step. Canonical log2 result does NOT reach significance.
export const WEE1_LIVER_PHI_PROXIMITY = {
  gene: "Wee1",
  tissue: "Liver",
  dataset: "GSE54650",
  species: "Mouse",
  preprocessing: "log2(x) then mean-centre (GSE54650 canonical)",

  // Canonical (log2-corrected) values — use these
  lambdaLog2: 0.6390,
  deltaLog2: 0.021,
  beta1Log2: 1.0345,
  beta2Log2: -0.4083,
  r2Log2: 0.623,
  poolSizeLog2: 2532,
  pPermutationLog2: 0.113,
  bhQLog2: 0.113,           // BH q in m=8 family; rank 8, q = 0.113×8/8
  bhFamilySizeM: 8,
  significantLog2: false,
  note: "p=0.113 (BH q=0.113, m=8) does not pass any FDR threshold. Bootstrap CI [0.412, 0.864] includes 1/φ (Moderate, 25 %) but without significant permutation the liver φ-proximity claim is unconfirmed.",

  // Superseded raw-scale values — DO NOT USE
  superseded: {
    lambdaRaw: 0.6151,
    deltaRaw: 0.0030,
    poolSizeRaw: 3648,
    pRaw: 0.0142,
    note: "Original permutation computed on raw (non-log2) intensities. Preprocessing error; superseded by log2-corrected result above.",
  },

  // Bootstrap (always used log2 — unaffected by this correction)
  bootstrap: {
    lambda: 0.6390,
    meanLambdaStar: 0.670,
    ci95: [0.412, 0.864] as const,
    fracStable: 0.25,
    stabilityRating: "Moderate (15–40%)",
    invPhiInCI: true,
    script: "scripts/wee1_liver_bootstrap_stability.cjs",
  },

  scripts: {
    permutation: "scripts/wee1_liver_permutation_log2.cjs",
    bootstrap: "scripts/wee1_liver_bootstrap_stability.cjs",
  },
  verifiedDate: "2026-08-02",
} as const;


// ─── GSE157357 — Mouse Intestinal Organoids, Stokes et al. 2021 ──────────────
// Two different WT hierarchy gap values exist for this dataset. They are both
// correct — they were computed from different gene panels.
//
// PANEL RECONCILIATION (August 2026):
//
//   • Paper O canonical (manuscript citation): 12 clock genes (Hlf and Rorc
//     absent from dataset; Ctnnb1 excluded from targets due to near-zero
//     variance) × 14 target genes.  WT gap = +0.033.
//
//   • Platform pairwise API (server/gse157357-pairwise.ts): broader panel of
//     15 clock genes × 23 target genes used for the platform UI comparisons.
//     WT gap = +0.073.
//
// For any Paper A or Paper O cross-paper citation, use the PAPER_O_PANEL
// values (+0.033).  The PLATFORM_PANEL values are valid only for the
// platform's pairwise-analysis page and must not be cited as manuscript
// results.
export const GSE157357_ORGANOID_WT = {
  citation: "Stokes et al. 2021, JClinMolGastroenterol doi:10.1016/j.jcmgh.2021.08.013",
  species: "mouse",
  tissue: "intestinal organoids",
  timepoints: 12,
  samplingH: 2,
  ctRange: "CT24–CT46",
  preprocessing: "replicate-averaged, chronological sort, mean-centering, OLS AR(2)",

  // ── Manuscript-canonical values (Paper O, 12-clock / 14-target panel) ──────
  // Use these for any cross-paper citation.
  //
  // ROUNDING NOTE: clockMean and targetMean are each independently rounded to
  // 3 decimal places from their full-precision per-gene means. The gap (+0.033)
  // is rounded independently from its own full-precision calculation and may
  // differ by ±0.001 from clockMean − targetMean as displayed here
  // (0.588 − 0.556 = 0.032). The authoritative value is the gap figure (+0.033)
  // as reported in Paper O Table 1 and Table 1c; it should not be re-derived by
  // subtracting the rounded means.
  paperOPanel: {
    clockGeneN: 12,
    targetGeneN: 14,
    clockGenesNote: "Arntl, Clock, Per1-3, Cry1-2, Nr1d1-2, Dbp, Tef, Npas2 (Hlf and Rorc absent from dataset)",
    targetGenesNote: "Lgr5, Axin2, Myc, Ccnd1, Sox9, Ascl2, Wee1, Ccnb1, Ccne1, Ccne2, Cdk1, Mcm6, Mki67, Cdkn1a (Ctnnb1 excluded — near-zero variance)",
    clockMeanRounded3dp:  0.588,   // rounded; full-precision mean yields gap=+0.033
    targetMeanRounded3dp: 0.556,   // rounded; full-precision mean yields gap=+0.033
    gap: +0.033,                   // independently rounded from full-precision calculation
    bootstrapCI95: [-0.105, +0.171] as const,
    permutationP: 0.669,
    note: "WT gap is modest and not statistically significant. Canonical for manuscript citation. Gap independently rounded; subtract full-precision means, not displayed 3-dp values.",
  },

  // ── Platform pairwise panel (server/gse157357-pairwise.ts, 15-clock / 23-target) ──
  // Used only for the platform's pairwise-analysis UI. Do NOT cite in manuscripts.
  //
  // ROUNDING NOTE: same independent-rounding applies here. The gap (+0.073) is
  // rounded from full-precision means; 0.601 − 0.527 = 0.074 in displayed
  // 3-dp arithmetic. The authoritative gap is +0.073 as stored in CONDITION_MEANS.
  platformPanel: {
    clockGeneN: 15,
    targetGeneN: 23,
    clockMeanRounded3dp:  0.601,   // rounded; full-precision yields gap=+0.073
    targetMeanRounded3dp: 0.527,   // rounded; full-precision yields gap=+0.073
    gap: +0.073,                   // independently rounded from full-precision calculation
    note: "Broader gene panel used for platform UI; differs from Paper O panel. Not for manuscript citation. Gap independently rounded; subtract full-precision means, not displayed 3-dp values.",
  },

  verifiedDate: "2026-08-04",
} as const;


// ─── Convenience export for downstream imports ───────────────────────────────
export const CANONICAL = {
  gse11923: GSE11923,
  gse54650Liver: GSE54650_LIVER,
  crossTissueTau: CROSS_TISSUE_TAU,
  diseasePhaseDiagram: DISEASE_PHASE_STATES,
  threeTierScope: THREE_TIER_SCOPE,
  methodComparison: METHOD_COMPARISON,
  samplingComparability: SAMPLING_COMPARABILITY,
  wee1LiverPhiProximity: WEE1_LIVER_PHI_PROXIMITY,
  gse157357OrganoidWt: GSE157357_ORGANOID_WT,
} as const;
