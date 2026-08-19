/**
 * Pre-registered 16 core clock genes for Paper Q (light-entrainment analysis).
 *
 * Exactly as stated in manuscript Methods §Gene selection:
 *   "Arntl (Bmal1), Per1, Per2, Per3, Cry1, Cry2, Clock, Npas2,
 *    Nr1d1 (Rev-erbα), Nr1d2 (Rev-erbβ), Dbp, Tef, Hlf, Rora, Rorb, Rorc"
 *
 * Do NOT modify this list without a corresponding manuscript amendment.
 * Rorb (Rorβ) is the correct 16th gene — Nfil3 is NOT in the pre-registered set.
 */
export const CLOCK_GENES_16: readonly string[] = [
  'Arntl', 'Per1', 'Per2', 'Per3', 'Cry1',  'Cry2',
  'Nr1d1', 'Nr1d2', 'Dbp',  'Tef',  'Hlf',  'Npas2',
  'Clock', 'Rorc',  'Rora', 'Rorb',
] as const;

/**
 * Pre-registered 16 baboon (Papio anubis) clock gene orthologues for Paper Q
 * cross-species validation (GSE98965, Mure et al. 2018).
 *
 * These are the primate-uppercase equivalents of CLOCK_GENES_16, exactly as
 * they appear in the GSE98965 FPKM matrix and as stated in manuscript §Methods
 * ("AR(2) was applied to 16 clock gene orthologues…"):
 *   ARNTL (BMAL1), PER1, PER2, PER3, CRY1, CRY2, CLOCK, NPAS2,
 *   NR1D1 (REV-ERBα), NR1D2 (REV-ERBβ), DBP, TEF, HLF, RORA, RORB, RORC
 *
 * NOTE: In the Lung tissue PER3 and NR1D2 yield unstable λ≥1 and are excluded
 * from that tissue's mean (n=14), but they remain in the pre-registered set.
 *
 * Do NOT modify this list without a corresponding manuscript amendment and an
 * update to CLOCK_GENES_16 — the two lists must remain in strict 1:1 orthologue
 * correspondence.
 */
export const CLOCK_GENES_BABOON_16: readonly string[] = [
  'ARNTL', 'PER1', 'PER2', 'PER3', 'CRY1',  'CRY2',
  'NR1D1', 'NR1D2', 'DBP',  'TEF',  'HLF',  'NPAS2',
  'CLOCK', 'RORC',  'RORA', 'RORB',
] as const;
