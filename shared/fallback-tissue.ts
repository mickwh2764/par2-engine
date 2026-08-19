/**
 * FALLBACK_TISSUE — pre-computed mean |λ| values for Paper Q Table 1
 *
 * These are the tissue-level mean AR(2) eigenvalue moduli derived from
 * GSE54650 (12 mouse tissues, 16 core clock genes each), pre-computed
 * in May 2026 for use when the live CSV files are unavailable.
 *
 * *** These values are also the numbers printed in Paper Q Table 1. ***
 * Any edit here MUST be reflected in manuscripts/paper_q_light_entrainment.md
 * Table 1 (and vice versa).  The vitest guard in
 * client/src/__tests__/fallback-tissue-table1.test.ts enforces agreement
 * to 3 decimal places automatically.
 */

export interface FallbackTissueRow {
  abbr: string;
  tissue: string;
  meanLam: number;
  n: number;
  layer: 'peripheral' | 'neuroendocrine' | 'central';
}

export const FALLBACK_TISSUE: readonly FallbackTissueRow[] = [
  { abbr: 'Lun',  tissue: 'Lung',            meanLam: 0.7966, n: 16, layer: 'peripheral' },
  { abbr: 'Kid',  tissue: 'Kidney',           meanLam: 0.7377, n: 16, layer: 'peripheral' },
  { abbr: 'Hrt',  tissue: 'Heart',            meanLam: 0.6978, n: 16, layer: 'peripheral' },
  { abbr: 'Adr',  tissue: 'Adrenal Gland',    meanLam: 0.6821, n: 16, layer: 'neuroendocrine' },
  { abbr: 'WFat', tissue: 'White Adipose',    meanLam: 0.6655, n: 16, layer: 'peripheral' },
  { abbr: 'BFat', tissue: 'Brown Adipose',    meanLam: 0.6627, n: 16, layer: 'peripheral' },
  { abbr: 'Aor',  tissue: 'Aorta',            meanLam: 0.6535, n: 16, layer: 'peripheral' },
  { abbr: 'Liv',  tissue: 'Liver',            meanLam: 0.6413, n: 16, layer: 'peripheral' },
  { abbr: 'Mus',  tissue: 'Skeletal Muscle',  meanLam: 0.6219, n: 16, layer: 'peripheral' },
  { abbr: 'Bstm', tissue: 'Brainstem',        meanLam: 0.5964, n: 16, layer: 'central' },
  { abbr: 'Cer',  tissue: 'Cerebellum',       meanLam: 0.5501, n: 16, layer: 'central' },
  { abbr: 'Hyp',  tissue: 'Hypothalamus',     meanLam: 0.4691, n: 16, layer: 'central' },
] as const;
