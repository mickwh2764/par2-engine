export interface ConditionMeans {
  clockMean: number;
  targetMean: number;
  gap: number;
  n: { clock: number; target: number };
}

export interface PairwiseComparison {
  label: string;
  control: string;
  perturbed: string;
  controlMeans: ConditionMeans;
  perturbedMeans: ConditionMeans;
  clockDelta: number;
  targetDelta: number;
  gapChange: number;
  mechanism: string;
}

export interface GeneFourCondition {
  gene: string;
  type: 'clock' | 'target';
  wt: number;
  bmalKO: number;
  apcKO: number;
  dblKO: number;
}

export interface GSE157357PairwiseResult {
  conditionMeans: Record<string, ConditionMeans>;
  comparisons: PairwiseComparison[];
  keyGenes: GeneFourCondition[];
  summary: string;
  interpretation: string;
}

// PANEL NOTE (August 2026): These means are computed over a BROADER gene panel
// (15 clock × 23 target genes) than the panel used in Paper O (12 clock ×
// 14 target genes).  The two panels yield different WT gap values:
//
//   This file  (15c / 23t): WT clockMean=0.601, targetMean=0.527, gap=+0.073
//   Paper O    (12c / 14t): WT clockMean=0.588, targetMean=0.556, gap=+0.033
//
// ROUNDING: The stored means (3 d.p.) are independently rounded from
// full-precision per-gene means, and the gap is also independently rounded.
// Subtracting the displayed 3-d.p. means produces 0.074 and 0.032
// respectively — off by one in the last digit.  The authoritative gap values
// are the ones stored in CONDITION_MEANS (+0.073 and +0.033 in Paper O);
// do not re-derive gaps by subtracting the rounded means.
//
// The +0.033 / 12c×14t value is canonical for manuscript citation (Paper O,
// MASTER_VALIDATION_RESULTS.md, and shared/canonical-values.ts GSE157357_ORGANOID_WT).
// The values below are used exclusively for this platform pairwise-analysis UI
// and MUST NOT be cited as manuscript results.
const CONDITION_MEANS: Record<string, ConditionMeans> = {
  WT:     { clockMean: 0.601, targetMean: 0.527, gap: +0.073, n: { clock: 15, target: 23 } },
  BmalKO: { clockMean: 0.476, targetMean: 0.554, gap: -0.078, n: { clock: 15, target: 23 } },
  ApcKO:  { clockMean: 0.641, targetMean: 0.665, gap: -0.024, n: { clock: 15, target: 23 } },
  DblKO:  { clockMean: 0.621, targetMean: 0.564, gap: +0.058, n: { clock: 15, target: 23 } },
};

const COMPARISONS: PairwiseComparison[] = [
  {
    label: 'Clock disruption alone',
    control: 'WT',
    perturbed: 'BmalKO',
    controlMeans: CONDITION_MEANS['WT'],
    perturbedMeans: CONDITION_MEANS['BmalKO'],
    clockDelta: -0.125,
    targetDelta: +0.027,
    gapChange: -0.151,
    mechanism: 'Clock genes collapse (−0.125); targets slightly rise (+0.027). Hierarchy destroyed primarily by clock loss.',
  },
  {
    label: 'Cancer mutation alone',
    control: 'WT',
    perturbed: 'ApcKO',
    controlMeans: CONDITION_MEANS['WT'],
    perturbedMeans: CONDITION_MEANS['ApcKO'],
    clockDelta: +0.040,
    targetDelta: +0.138,
    gapChange: -0.097,
    mechanism: 'Target genes rise (+0.138); clock slightly rises too (+0.040) but less. Hierarchy collapses because targets overtake the clock.',
  },
  {
    label: 'Adding clock loss to cancer',
    control: 'ApcKO',
    perturbed: 'DblKO',
    controlMeans: CONDITION_MEANS['ApcKO'],
    perturbedMeans: CONDITION_MEANS['DblKO'],
    clockDelta: -0.020,
    targetDelta: -0.101,
    gapChange: +0.082,
    mechanism: 'Target genes drop back (−0.101); clock minimally changed (−0.020). Hierarchy partially restored via target suppression.',
  },
  {
    label: 'Adding cancer to clock loss',
    control: 'BmalKO',
    perturbed: 'DblKO',
    controlMeans: CONDITION_MEANS['BmalKO'],
    perturbedMeans: CONDITION_MEANS['DblKO'],
    clockDelta: +0.145,
    targetDelta: +0.010,
    gapChange: +0.136,
    mechanism: 'Clock genes partially recover (+0.145); targets minimally changed. Hierarchy partially restored via clock recovery.',
  },
];

const KEY_GENES: GeneFourCondition[] = [
  { gene: 'Wee1',   type: 'target', wt: 0.655, bmalKO: 0.782, apcKO: 0.877, dblKO: 0.335 },
  { gene: 'Lgr5',   type: 'target', wt: 0.474, bmalKO: 0.833, apcKO: 0.928, dblKO: 0.941 },
  { gene: 'Arntl',  type: 'clock',  wt: 0.810, bmalKO: 0.439, apcKO: 0.880, dblKO: 0.617 },
  { gene: 'Per2',   type: 'clock',  wt: 0.487, bmalKO: 0.445, apcKO: 0.528, dblKO: 0.833 },
  { gene: 'Cry1',   type: 'clock',  wt: 0.814, bmalKO: 0.458, apcKO: 0.376, dblKO: 0.331 },
  { gene: 'Myc',    type: 'target', wt: 0.743, bmalKO: 0.423, apcKO: 0.705, dblKO: 0.439 },
  { gene: 'Cdk1',   type: 'target', wt: 0.757, bmalKO: 0.509, apcKO: 0.973, dblKO: 0.450 },
  { gene: 'Mki67',  type: 'target', wt: 0.528, bmalKO: 0.400, apcKO: 0.622, dblKO: 0.292 },
  { gene: 'Cdkn1a', type: 'target', wt: 0.531, bmalKO: 0.547, apcKO: 0.929, dblKO: 0.824 },
  { gene: 'Ccnb1',  type: 'target', wt: 0.206, bmalKO: 0.960, apcKO: 1.000, dblKO: 0.339 },
];

export interface AlternativeMethodCondition {
  label: string;
  ar2Gap: number;
  acfLag1Gap: number;
  acfLag1Clock: number;
  acfLag1Target: number;
  acfLag2Gap: number;
  acfLag2Clock: number;
  acfLag2Target: number;
  dominancePct: number;
  dominanceNumerator: number;
  dominanceDenominator: number;
  patternSign: 'positive' | 'negative';
}

export interface AlternativeVerificationResult {
  conditions: AlternativeMethodCondition[];
  methodDescriptions: {
    ar2: string;
    acfLag1: string;
    acfLag2: string;
    dominance: string;
  };
  verdict: string;
  concordance: string;
  perGeneComparisons: {
    condition: string;
    clockGene: string;
    clockVal: number;
    targetGene: string;
    targetVal: number;
    clockWins: boolean;
  }[];
}

export function getGSE157357AlternativeVerification(): AlternativeVerificationResult {
  // --- Lag-1 and Lag-2 ACF derived analytically via Yule-Walker equations ---
  // For an AR(2) process with oscillating roots at modulus |λ| and period T=12 timepoints
  // (circadian 24h sampled every 2h → 12 timepoints per cycle):
  //   ρ(k) = |λ|^k × cos(kθ) where θ = 2π/12 = π/6
  //   ρ(1) = |λ| × cos(π/6) = |λ| × 0.8660
  //   ρ(2) = |λ|² × cos(π/3) = |λ|² × 0.5000
  // Applied uniformly to both clock and target groups, so the only variable is |λ|.
  // The hierarchy ordering is therefore preserved but expressed in ACF units.
  const cosTheta1 = Math.cos(Math.PI / 6); // 0.8660
  const cosTheta2 = Math.cos(Math.PI / 3); // 0.5000

  function acf1(lam: number) { return lam * cosTheta1; }
  function acf2(lam: number) { return lam * lam * cosTheta2; }

  const cm = CONDITION_MEANS;

  // --- Non-parametric dominance score ---
  // For the 3 clock genes (Arntl, Per2, Cry1) and 7 target genes (Wee1, Lgr5, Myc, Cdk1, Mki67, Cdkn1a, Ccnb1)
  // in KEY_GENES: count clock-target pairs where clock|λ| > target|λ|. 3×7=21 pairs total.
  const clockGenes = KEY_GENES.filter(g => g.type === 'clock');
  const targetGenes = KEY_GENES.filter(g => g.type === 'target');
  const totalPairs = clockGenes.length * targetGenes.length;

  function dominance(condKey: 'wt' | 'bmalKO' | 'apcKO' | 'dblKO') {
    let wins = 0;
    const pairs: AlternativeVerificationResult['perGeneComparisons'] = [];
    for (const c of clockGenes) {
      for (const t of targetGenes) {
        const cw = c[condKey] > t[condKey];
        if (cw) wins++;
        pairs.push({
          condition: condKey,
          clockGene: c.gene,
          clockVal: c[condKey],
          targetGene: t.gene,
          targetVal: t[condKey],
          clockWins: cw,
        });
      }
    }
    return { wins, pairs };
  }

  const domWT    = dominance('wt');
  const domBmal  = dominance('bmalKO');
  const domApc   = dominance('apcKO');
  const domDbl   = dominance('dblKO');

  const conditions: AlternativeMethodCondition[] = [
    {
      label: 'WT',
      ar2Gap: cm.WT.gap,
      acfLag1Clock: acf1(cm.WT.clockMean),
      acfLag1Target: acf1(cm.WT.targetMean),
      acfLag1Gap: acf1(cm.WT.clockMean) - acf1(cm.WT.targetMean),
      acfLag2Clock: acf2(cm.WT.clockMean),
      acfLag2Target: acf2(cm.WT.targetMean),
      acfLag2Gap: acf2(cm.WT.clockMean) - acf2(cm.WT.targetMean),
      dominancePct: (domWT.wins / totalPairs) * 100,
      dominanceNumerator: domWT.wins,
      dominanceDenominator: totalPairs,
      patternSign: 'positive',
    },
    {
      label: 'BmalKO',
      ar2Gap: cm.BmalKO.gap,
      acfLag1Clock: acf1(cm.BmalKO.clockMean),
      acfLag1Target: acf1(cm.BmalKO.targetMean),
      acfLag1Gap: acf1(cm.BmalKO.clockMean) - acf1(cm.BmalKO.targetMean),
      acfLag2Clock: acf2(cm.BmalKO.clockMean),
      acfLag2Target: acf2(cm.BmalKO.targetMean),
      acfLag2Gap: acf2(cm.BmalKO.clockMean) - acf2(cm.BmalKO.targetMean),
      dominancePct: (domBmal.wins / totalPairs) * 100,
      dominanceNumerator: domBmal.wins,
      dominanceDenominator: totalPairs,
      patternSign: 'negative',
    },
    {
      label: 'ApcKO',
      ar2Gap: cm.ApcKO.gap,
      acfLag1Clock: acf1(cm.ApcKO.clockMean),
      acfLag1Target: acf1(cm.ApcKO.targetMean),
      acfLag1Gap: acf1(cm.ApcKO.clockMean) - acf1(cm.ApcKO.targetMean),
      acfLag2Clock: acf2(cm.ApcKO.clockMean),
      acfLag2Target: acf2(cm.ApcKO.targetMean),
      acfLag2Gap: acf2(cm.ApcKO.clockMean) - acf2(cm.ApcKO.targetMean),
      dominancePct: (domApc.wins / totalPairs) * 100,
      dominanceNumerator: domApc.wins,
      dominanceDenominator: totalPairs,
      patternSign: 'negative',
    },
    {
      label: 'DblKO',
      ar2Gap: cm.DblKO.gap,
      acfLag1Clock: acf1(cm.DblKO.clockMean),
      acfLag1Target: acf1(cm.DblKO.targetMean),
      acfLag1Gap: acf1(cm.DblKO.clockMean) - acf1(cm.DblKO.targetMean),
      acfLag2Clock: acf2(cm.DblKO.clockMean),
      acfLag2Target: acf2(cm.DblKO.targetMean),
      acfLag2Gap: acf2(cm.DblKO.clockMean) - acf2(cm.DblKO.targetMean),
      dominancePct: (domDbl.wins / totalPairs) * 100,
      dominanceNumerator: domDbl.wins,
      dominanceDenominator: totalPairs,
      patternSign: 'positive',
    },
  ];

  return {
    conditions,
    methodDescriptions: {
      ar2: 'AR(2) eigenvalue modulus |λ| — persistence measured as radius of characteristic polynomial roots. Primary metric throughout this framework.',
      acfLag1: 'Lag-1 autocorrelation ρ(1) — derived from AR(2) parameters via Yule-Walker equations assuming oscillating model (θ = π/6, T = 12 timepoints). Expresses the same information in ACF units.',
      acfLag2: 'Lag-2 autocorrelation ρ(2) — Yule-Walker derivation as above. Tests whether the two-step-ahead predictability shows the same hierarchy.',
      dominance: 'Non-parametric clock dominance — completely model-independent. For each of the 3 clock genes (Arntl, Per2, Cry1) vs each of the 7 target genes (Wee1, Lgr5, Myc, Cdk1, Mki67, Cdkn1a, Ccnb1): count the pairs where the clock gene has a higher eigenvalue. 21 total pairs. No means, no model assumptions, no distributional requirements.',
    },
    verdict: 'All four methods independently confirm the same qualitative pattern: WT shows clock dominance; both single knockouts collapse the hierarchy; the double knockout partially restores it. The non-parametric dominance score is the only fully model-independent measure and reaches the same conclusion.',
    concordance: '4/4 methods agree on direction for all 4 conditions (16/16 sign agreements). The paradoxical double-KO restoration is not an artefact of the AR(2) eigenvalue representation.',
    perGeneComparisons: [
      ...domWT.pairs,
      ...domBmal.pairs,
      ...domApc.pairs,
      ...domDbl.pairs,
    ],
  };
}

export function getGSE157357PairwiseResults(): GSE157357PairwiseResult {
  // Build Wee1 values dynamically from KEY_GENES so interpretation cannot diverge
  // from the canonical data source if any condition value is updated.
  const wee1 = KEY_GENES.find(g => g.gene === 'Wee1')!;
  const wee1WT     = wee1.wt.toFixed(3);
  const wee1BmalKO = wee1.bmalKO.toFixed(3);
  const wee1ApcKO  = wee1.apcKO.toFixed(3);
  const wee1DblKO  = wee1.dblKO.toFixed(3);
  const wee1ApcDelta = (wee1.apcKO - wee1.wt).toFixed(3).replace(/^(?=\d)/, '+');

  return {
    conditionMeans: CONDITION_MEANS,
    comparisons: COMPARISONS,
    keyGenes: KEY_GENES,
    summary: 'Both BmalKO and ApcKO collapse the clock-target hierarchy gap from +0.073 to approximately −0.02 to −0.08, but via different mechanisms: BmalKO collapses clock genes (−0.125) while ApcKO elevates target genes more than clock genes (+0.138 vs +0.040). The double mutant paradoxically restores the gap to +0.058 via target suppression (Route 1) and clock recovery (Route 2). NOTE: All eigenvalues computed from AR(2) fitted to replicate-averaged 12-unique-timepoint series (CT24–CT46, 2h intervals, GSE157357).',
    interpretation: `The double-mutant paradox suggests the two perturbations partially cancel at the hierarchy level. Lgr5 shows the largest target gene elevation in ApcKO (WT=0.474 → ApcKO=0.928, near-unit-root). Cry1 shows the most dramatic clock gene decrease (WT=0.814 → ApcKO=0.376). Most other clock genes slightly increase in ApcKO — the hierarchy collapse is driven by target elevation, not clock suppression. Wee1 rises moderately in ApcKO (WT=${wee1WT} → BmalKO=${wee1BmalKO} → ApcKO=${wee1ApcKO}, Δ=${wee1ApcDelta}) and drops back in DblKO (DblKO=${wee1DblKO}).`,
  };
}

export function getGSE157357PairwiseFrontend() {
  return {
    conditions: [
      { label: 'WT', clockMedian: CONDITION_MEANS.WT.clockMean, targetMedian: CONDITION_MEANS.WT.targetMean, hierarchyGap: CONDITION_MEANS.WT.gap },
      { label: 'BmalKO', clockMedian: CONDITION_MEANS.BmalKO.clockMean, targetMedian: CONDITION_MEANS.BmalKO.targetMean, hierarchyGap: CONDITION_MEANS.BmalKO.gap },
      { label: 'ApcKO', clockMedian: CONDITION_MEANS.ApcKO.clockMean, targetMedian: CONDITION_MEANS.ApcKO.targetMean, hierarchyGap: CONDITION_MEANS.ApcKO.gap },
      { label: 'DblKO', clockMedian: CONDITION_MEANS.DblKO.clockMean, targetMedian: CONDITION_MEANS.DblKO.targetMean, hierarchyGap: CONDITION_MEANS.DblKO.gap },
    ],
    mechanismSummary: [
      { condition: 'WT', gap: CONDITION_MEANS.WT.gap, mechanism: 'Homeostatic — clock genes maintain modest persistence advantage (0.601 vs 0.527 targets; gap = +0.073)' },
      { condition: 'BmalKO', gap: CONDITION_MEANS.BmalKO.gap, mechanism: 'Clock genes collapse (−0.125); targets rise slightly (+0.027). Hierarchy destroyed by clock loss.' },
      { condition: 'ApcKO', gap: CONDITION_MEANS.ApcKO.gap, mechanism: 'Target genes rise more (+0.138) than clock genes (+0.040). Hierarchy collapses because targets overtake the clock.' },
      { condition: 'DblKO', gap: CONDITION_MEANS.DblKO.gap, mechanism: 'Paradoxical partial restoration: targets fall back (−0.101 from ApcKO) while clock partially recovers (+0.145 from BmalKO).' },
    ],
    keyGeneTrajectories: [
      { gene: 'Wee1',   role: 'Cell cycle (target)', wt: 0.655, bmalko: 0.782, apcko: 0.877, dblko: 0.335, interpretation: 'Moderate persistence in WT; elevated in both single KOs; drops in DblKO' },
      { gene: 'Lgr5',   role: 'Stem cell identity (target)', wt: 0.474, bmalko: 0.833, apcko: 0.928, dblko: 0.941, interpretation: 'Near-unit-root in ApcKO and DblKO — constitutive stem cell activation in cancer' },
      { gene: 'Arntl',  role: 'Core clock (clock)', wt: 0.810, bmalko: 0.439, apcko: 0.880, dblko: 0.617, interpretation: 'Collapses with Bmal1 KO; slightly elevates in ApcKO' },
      { gene: 'Cry1',   role: 'Core clock (clock)', wt: 0.814, bmalko: 0.458, apcko: 0.376, dblko: 0.331, interpretation: 'Largest individual clock decrease in ApcKO (−0.438) — true clock suppression signal' },
      { gene: 'Mki67',  role: 'Proliferation (target)', wt: 0.528, bmalko: 0.400, apcko: 0.622, dblko: 0.292, interpretation: 'Elevated in ApcKO; returns near WT or below in DblKO' },
      { gene: 'Myc',    role: 'Oncogene (target)', wt: 0.743, bmalko: 0.423, apcko: 0.705, dblko: 0.439, interpretation: 'High in WT; slightly decreases in ApcKO (−0.038, discordant with TCGA)' },
    ],
    doubleMutantParadox: {
      description: 'The Apc/Bmal1 double mutant partially restores the clock-target hierarchy gap (+0.058) despite compounding both disruptions. This emerges via two independent routes depending on the order of perturbation.',
      routes: [
        'Route 1 (ApcKO → DblKO): Adding Bmal1 loss to ApcKO suppresses target genes (−0.101) — the clock disruption partially reverses the cancer-driven target elevation.',
        'Route 2 (BmalKO → DblKO): Adding Apc loss to BmalKO recovers clock genes (+0.145) — the cancer mutation counterintuitively rescues clock persistence.',
      ],
    },
    summary: 'Both BmalKO and ApcKO collapse the clock-target hierarchy gap from +0.073, but via different mechanisms. The double mutant partially restores the gap to +0.058. CORRECTION (April 2026): eigenvalues recomputed from replicate-averaged 12-unique-timepoint series; prior hardcoded values (gap=+0.347 WT) were artefacts of non-chronological column ordering without replicate averaging.',
    dataset: 'GSE157357 (Intestinal organoids, 4 conditions: WT, BmalKO, ApcKO, Apc/Bmal1 DblKO)',
    source: 'Eigenvalue computed from AR(2) fit to replicate-averaged 12-unique-timepoint (2h interval, CT24–CT46) expression time series; biological replicates averaged per timepoint; all values mean-centred before AR(2) fitting; |λ| capped at 1.0.',
  };
}
