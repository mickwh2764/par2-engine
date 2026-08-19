export interface TCGAGeneRecord {
  gene: string;
  type: 'clock' | 'target';
  log2FC: number;
  pValue: string;
  significant: boolean;
  direction: 'up' | 'down' | 'ns';
  organoidApcKOLambda: number;
  organoidWTLambda: number;
  lambdaChange: number;
  concordant: boolean;
  notes: string;
}

export interface TCGAConditionSummary {
  label: string;
  nTumors: number;
  nNormals: number;
  clockGenesDown: number;
  clockGenesMean_log2FC: number;
  targetGenesUp: number;
  targetGenesMean_log2FC: number;
  hierarchyGapDirection: string;
}

// CORRECTED April 2026: eigenvalues recomputed from replicate-averaged 12-unique-timepoint series
// (CT24–CT46, 2h intervals). Prior values used non-chronological column order without averaging.
// Concordance drops from 15/15 → 10/15 (p=0.151, not significant).
// Discordant genes: ARNTL, PER2, PER1, DBP (all rise in ApcKO organoids but fall in TCGA CRC),
// and MYC (slightly falls in ApcKO organoids but rises in TCGA). Clock genes on average
// slightly RISE in ApcKO (mean Δ=+0.040); hierarchy collapses due to target elevation (+0.138).
const GENES: TCGAGeneRecord[] = [
  {
    gene: 'ARNTL',        type: 'clock',  log2FC: -0.87, pValue: '<0.001', significant: true,  direction: 'down',
    organoidApcKOLambda: 0.880, organoidWTLambda: 0.810, lambdaChange: +0.070, concordant: false,
    notes: 'Eigenvalue RISES in ApcKO organoids (+0.070) but expression FALLS in TCGA (−0.87) — discordant. Suggests different regulatory mechanisms between organoid and tumour contexts.',
  },
  {
    gene: 'PER2',         type: 'clock',  log2FC: -0.71, pValue: '<0.001', significant: true,  direction: 'down',
    organoidApcKOLambda: 0.528, organoidWTLambda: 0.487, lambdaChange: +0.041, concordant: false,
    notes: 'Eigenvalue slightly rises in ApcKO organoids (+0.041) but expression falls in TCGA — discordant. Promoter methylation silencing of PER2 in CRC may not be captured by organoid model.',
  },
  {
    gene: 'PER1',         type: 'clock',  log2FC: -0.62, pValue: '<0.001', significant: true,  direction: 'down',
    organoidApcKOLambda: 0.915, organoidWTLambda: 0.240, lambdaChange: +0.675, concordant: false,
    notes: 'Large eigenvalue rise in ApcKO organoids (+0.675) but expression falls in TCGA — discordant. Low WT eigenvalue (0.240) reflects sparse 12-point estimation; ApcKO estimate may be unreliable.',
  },
  {
    gene: 'CRY1',         type: 'clock',  log2FC: -0.43, pValue: '<0.01',  significant: true,  direction: 'down',
    organoidApcKOLambda: 0.376, organoidWTLambda: 0.814, lambdaChange: -0.438, concordant: true,
    notes: 'Largest individual clock decrease in ApcKO organoids (−0.438); TCGA also shows reduction — concordant.',
  },
  {
    gene: 'NR1D1',        type: 'clock',  log2FC: -0.55, pValue: '<0.001', significant: true,  direction: 'down',
    organoidApcKOLambda: 0.539, organoidWTLambda: 0.743, lambdaChange: -0.203, concordant: true,
    notes: 'REV-ERBα; eigenvalue falls in ApcKO organoids and expression falls in TCGA — concordant.',
  },
  {
    gene: 'DBP',          type: 'clock',  log2FC: -0.44, pValue: '<0.001', significant: true,  direction: 'down',
    organoidApcKOLambda: 1.000, organoidWTLambda: 0.782, lambdaChange: +0.218, concordant: false,
    notes: 'ApcKO eigenvalue capped at 1.000 (unit root — unreliable from 12-point series). Rise in organoids is discordant with TCGA expression fall. Treat as unresolved with current data.',
  },
  {
    gene: 'CLOCK',        type: 'clock',  log2FC: -0.19, pValue: '0.12',   significant: false, direction: 'ns',
    organoidApcKOLambda: 0.413, organoidWTLambda: 0.475, lambdaChange: -0.062, concordant: true,
    notes: 'Eigenvalue falls slightly in ApcKO; TCGA also non-significantly down — directionally concordant.',
  },
  {
    gene: 'WEE1',         type: 'target', log2FC: +0.82, pValue: '<0.001', significant: true,  direction: 'up',
    organoidApcKOLambda: 0.877, organoidWTLambda: 0.655, lambdaChange: +0.222, concordant: true,
    notes: 'Eigenvalue rises in ApcKO organoids (+0.222); overexpressed in CRC (+0.82 log2FC) — concordant. NOTE: WT eigenvalue corrected from 0.093 to 0.655; Wee1 is no longer "near-zero" in WT.',
  },
  {
    gene: 'LGR5',         type: 'target', log2FC: +1.24, pValue: '<0.001', significant: true,  direction: 'up',
    organoidApcKOLambda: 0.928, organoidWTLambda: 0.474, lambdaChange: +0.454, concordant: true,
    notes: 'Near-unit-root in ApcKO (|λ|=0.928); CRC stem cell marker strongly elevated in TCGA — concordant.',
  },
  {
    gene: 'MYC',          type: 'target', log2FC: +1.67, pValue: '<0.001', significant: true,  direction: 'up',
    organoidApcKOLambda: 0.705, organoidWTLambda: 0.743, lambdaChange: -0.037, concordant: false,
    notes: 'Eigenvalue slightly FALLS in ApcKO organoids (−0.037) but expression strongly RISES in TCGA (+1.67) — discordant. MYC is a direct Wnt target; the organoid 12-point estimate may not capture its dynamics.',
  },
  {
    gene: 'CDK1',         type: 'target', log2FC: +2.41, pValue: '<0.001', significant: true,  direction: 'up',
    organoidApcKOLambda: 0.973, organoidWTLambda: 0.757, lambdaChange: +0.216, concordant: true,
    notes: 'G2/M kinase; large eigenvalue rise in ApcKO; most strongly upregulated target in TCGA — concordant.',
  },
  {
    gene: 'MKI67',        type: 'target', log2FC: +2.89, pValue: '<0.001', significant: true,  direction: 'up',
    organoidApcKOLambda: 0.622, organoidWTLambda: 0.528, lambdaChange: +0.094, concordant: true,
    notes: 'Proliferation marker; eigenvalue rises in ApcKO; largest log2FC in TCGA — concordant.',
  },
  {
    gene: 'CCNB1',        type: 'target', log2FC: +2.12, pValue: '<0.001', significant: true,  direction: 'up',
    organoidApcKOLambda: 1.000, organoidWTLambda: 0.206, lambdaChange: +0.794, concordant: true,
    notes: 'Cyclin B1; ApcKO eigenvalue capped at 1.000 (explosive/unit root); strongly elevated in TCGA — concordant in direction.',
  },
  {
    gene: 'AXIN2',        type: 'target', log2FC: +0.67, pValue: '<0.001', significant: true,  direction: 'up',
    organoidApcKOLambda: 0.937, organoidWTLambda: 0.637, lambdaChange: +0.301, concordant: true,
    notes: 'Wnt pathway target; eigenvalue rises substantially in ApcKO; elevated in APC-mutant CRC — concordant.',
  },
  {
    gene: 'CDKN1A',       type: 'target', log2FC: +0.31, pValue: '<0.05',  significant: true,  direction: 'up',
    organoidApcKOLambda: 0.929, organoidWTLambda: 0.531, lambdaChange: +0.398, concordant: true,
    notes: 'p21/WAF1; large eigenvalue rise in ApcKO; elevated in TCGA (stress response) — concordant.',
  },
];

const CONCORDANCE_SUMMARY = {
  totalGenes: GENES.length,
  concordant: GENES.filter(g => g.concordant).length,
  concordantClock: GENES.filter(g => g.type === 'clock' && g.concordant).length,
  concordantTarget: GENES.filter(g => g.type === 'target' && g.concordant).length,
  clockGenes: GENES.filter(g => g.type === 'clock').length,
  targetGenes: GENES.filter(g => g.type === 'target').length,
  concordanceRate: 0,
  // Binomial p-values (one-tailed vs 50% null): P(X≥k | n, 0.5)
  // All 15: 10/15 → p=0.151  |  Target 8: 7/8 → p=0.035  |  Clock 7: 3/7 → p=0.774
  pValueAll: 0.151,
  pValueTarget: 0.035,
  pValueClock: 0.774,
};
CONCORDANCE_SUMMARY.concordanceRate = CONCORDANCE_SUMMARY.concordant / CONCORDANCE_SUMMARY.totalGenes;

const CONDITION_SUMMARY: TCGAConditionSummary = {
  label: 'TCGA-COAD (Colorectal Adenocarcinoma)',
  nTumors: 480,
  nNormals: 41,
  clockGenesDown: GENES.filter(g => g.type === 'clock' && g.direction === 'down').length,
  clockGenesMean_log2FC: -0.54,
  targetGenesUp: GENES.filter(g => g.type === 'target' && g.direction === 'up').length,
  targetGenesMean_log2FC: +1.52,
  hierarchyGapDirection: 'Collapse via target elevation (ApcKO-like); clock genes RISE on average in ApcKO organoids (corrected), 3/7 clock concordant, 7/8 target concordant',
};

// CORRECTED April 2026: concordance is 10/15 (p=0.151, not significant).
// The old claim of 15/15 was based on incorrectly preprocessed eigenvalues.
const MECHANISM_INTERPRETATION = {
  primaryMechanism: 'Overall directional concordance: 10/15 genes (p=0.151, not significant) — the primary TCGA result, reported honestly as a preliminary directionally consistent finding. Post-hoc exploratory sub-analysis: 7/8 target genes concordant (p=0.035, nominal, unadjusted, non-confirmatory).',
  secondaryMechanism: 'Clock genes show mixed results: 3/7 concordant (CRY1, NR1D1, CLOCK fall); 4/7 discordant (ARNTL, PER2, PER1, DBP rise in organoids but fall in TCGA)',
  dominantDriver: 'APC mutation (~75% of CRC) drives target gene elevation. Post-hoc sub-analysis shows 7/8 target genes directionally concordant (p=0.035, nominal, unadjusted, post-hoc — not a confirmatory result). This sub-analysis is exploratory and should not be cited as significant.',
  clockSuppression: 'Clock gene concordance only 3/7 (43%) with corrected eigenvalues. Clock genes on average RISE slightly in ApcKO organoids (Δ=+0.040), unlike the previous claim of suppression. CRY1 and NR1D1 are the reliable clock concordance signals.',
  wee1Finding: 'Wee1 rises in ApcKO organoids (|λ| 0.655→0.877, Δ=+0.222) and is elevated in TCGA CRC (+0.82 log2FC) — concordant. NOTE: WT eigenvalue corrected from prior erroneous 0.093 to 0.655.',
  lgr5Finding: 'LGR5 near-unit-root in ApcKO organoids (|λ|=0.928) consistent with CRC stem cell marker elevation in TCGA (+1.24 log2FC) — concordant.',
  keyConclusion: 'Corrected analysis: 10/15 gene concordance (p=0.151, not statistically significant). Target gene concordance is stronger (7/8) than clock gene concordance (3/7). The prior claim of 15/15 (p=3.05×10⁻⁵) was based on incorrectly preprocessed organoid eigenvalues and is retracted.',
};

const DATA_SOURCES = [
  { label: 'TCGA-COAD primary analysis', reference: 'TCGA Research Network (2012). Nature 487:330–337. PMID:22810696', url: 'https://www.nature.com/articles/nature11252' },
  { label: 'Clock gene expression in CRC', reference: 'Ye Y et al. (2020). EBioMedicine 55:102763. Clock gene disruption in colorectal cancer from TCGA pan-cancer analysis.', url: 'https://pubmed.ncbi.nlm.nih.gov/32361318/' },
  { label: 'Wee1 overexpression in CRC', reference: 'Zeng L et al. (2020). Oncotarget: WEE1 expression and poor prognosis in colorectal cancer.', url: 'https://pubmed.ncbi.nlm.nih.gov/' },
  { label: 'LGR5 as CRC stem cell marker', reference: 'Barker N et al. (2007). Nature 449:1003–1007. LGR5+ stem cells at the origin of colon cancer.', url: 'https://pubmed.ncbi.nlm.nih.gov/17934449/' },
  { label: 'PER gene silencing in CRC', reference: 'Hrushesky WJ et al. — multiple studies on PER1/PER2 methylation in colorectal cancer.', url: 'https://pubmed.ncbi.nlm.nih.gov/' },
  { label: 'Expression fold-changes', reference: 'Values derived from GEPIA2 (Gene Expression Profiling Interactive Analysis) and TIMER2.0 analysis of TCGA-COAD vs matched GTEx normal colon.', url: 'http://gepia2.cancer-pku.cn/' },
];

const METHODOLOGICAL_NOTE = `CORRECTION NOTICE (April 2026): The prior concordance of 15/15 was based on incorrectly preprocessed eigenvalues (non-chronological column order, no replicate averaging). Corrected eigenvalues computed from replicate-averaged 12-unique-timepoint series (CT24-CT46) give 10/15 concordance (p=0.151, not significant under binomial test vs 50% null).

This analysis cross-validates two independent measurements:
(1) AR(2) eigenvalue changes from GSE157357 intestinal organoids (ApcKO vs WT) — CORRECTED values
(2) RNA-seq expression fold-changes from TCGA-COAD (tumor vs matched normal)

Important caveat: TCGA data is cross-sectional — each sample is one timepoint from one patient. Direct AR(2) eigenvalue computation requires a time series and cannot be applied to TCGA data. The concordance analysis tests whether the *direction* of eigenvalue change in organoid ApcKO agrees with the direction of expression change in human CRC tumors. With corrected eigenvalues, 10/15 directional agreements are observed. Target genes show stronger concordance (7/8) than clock genes (3/7).`;

export function getTCGAColorectalValidation() {
  return {
    dataset: 'TCGA-COAD',
    analysisType: 'Cross-validation: organoid eigenvalues (GSE157357) vs TCGA expression fold-changes',
    conditionSummary: CONDITION_SUMMARY,
    genes: GENES,
    concordanceSummary: CONCORDANCE_SUMMARY,
    mechanismInterpretation: MECHANISM_INTERPRETATION,
    dataSources: DATA_SOURCES,
    methodologicalNote: METHODOLOGICAL_NOTE,
    clockMedian_WT: 0.601,
    clockMedian_ApcKO: 0.641,
    targetMedian_WT: 0.527,
    targetMedian_ApcKO: 0.665,
    hierarchyGap_WT: +0.073,
    hierarchyGap_ApcKO: -0.024,
    generatedAt: new Date().toISOString(),
  };
}
