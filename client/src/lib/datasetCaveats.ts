/**
 * Frontend mirror of server/routes/discovery.ts DATASET_TEMPORAL_CAVEATS.
 *
 * Any dataset ID listed here has a known limitation that users must see before
 * drawing AR(2) eigenvalue conclusions from it. Keyed by the GSE accession
 * prefix (upper-case) so that dataset IDs like "GSE157357_Organoid_WT-WT" are
 * matched by checking startsWith / includes "GSE157357".
 *
 * Keep in sync with server/routes/discovery.ts DATASET_TEMPORAL_CAVEATS.
 */
export const DATASET_TEMPORAL_CAVEATS: Record<string, string> = {
  GSE157357:
    "22 h ZT window (ZT24–46) — insufficient for AR(2) circadian eigenvalue analysis; ≥36 h required. Results should be treated as indicative only.",
};

/**
 * Returns the caveat string for a given dataset ID, or null if no caveat exists.
 * Matches against the accession prefix so partial IDs (e.g. "GSE157357_Organoid_WT-WT")
 * are correctly flagged.
 */
export function getDatasetCaveat(datasetId: string): string | null {
  const id = datasetId.toUpperCase();
  for (const [key, caveat] of Object.entries(DATASET_TEMPORAL_CAVEATS)) {
    if (id.includes(key.toUpperCase())) return caveat;
  }
  return null;
}

// ── Per-gene tissue-specific caveats ─────────────────────────────────────────
//
// Some genes have results that are qualified by a specific dataset's
// experimental conditions (e.g. inhibitor-loaded organoid media). These caveats
// are tied to a particular gene + tissue/dataset combination and should appear
// on that gene's card whenever that tissue row is visible.
//
// tissueKeyword: substring matched against the tissue label (case-insensitive).
// label:         short title shown in the caveat header.
// caveat:        full caveat text surfaced in the UI.

export interface GeneTissueCaveat {
  tissueKeyword: string;
  label: string;
  caveat: string;
}

export const PER_GENE_TISSUE_CAVEATS: Record<string, GeneTissueCaveat[]> = {
  NOTCH2: [
    {
      tissueKeyword: "Enteroid",
      label: "Inhibitor bias — GSE161566",
      caveat:
        "GSE161566 enteroid uses WNT3a + SB202190 + A83-01 — these inhibitors modulate Notch signalling; biopsy validation pending",
    },
  ],
};

/**
 * Returns the caveat for a specific gene in a specific tissue context, or null.
 * Gene matching is case-insensitive. Tissue matching uses substring search.
 */
export function getGeneTissueCaveat(
  gene: string,
  tissue: string
): GeneTissueCaveat | null {
  const entries = PER_GENE_TISSUE_CAVEATS[gene.toUpperCase()];
  if (!entries) return null;
  const t = tissue.toLowerCase();
  return entries.find((e) => t.includes(e.tissueKeyword.toLowerCase())) ?? null;
}
