/**
 * Client routes that are blocked in production (draft papers, private
 * analytics, exploratory analyses not tied to a submitted paper).
 *
 * Single source of truth: the server returns 404 for these paths and the
 * sitemap generator excludes them, so the sitemap never advertises a URL that
 * the deployment refuses to serve.
 */
export const INTERNAL_PAGES: readonly string[] = [
  // Paper G draft review pages
  "/paper-g-original",
  "/paper-g-revision",
  // Private analytics dashboard
  "/analytics",
  // Internal manuscript cross-validation tool
  "/manuscript-validation",
  // Paper N (p53 regulon) draft analysis pages — not for public display
  "/p53-regulon",
  "/u2os-myc-ar2",
  // Paper N correction detail (misreadable without paper context)
  "/myc-on-discrepancy",
  // GSE11923 post-hoc exclusion checkpoint (Paper N)
  "/gse11923-checkpoint",
  // Internal report library
  "/reports",
  // Exploratory analyses not yet tied to any submitted paper
  "/mnd-als",
  "/gbm-zman-seq",
  "/retinal-analysis",
  "/wearable-analysis",
  "/evolutionary-gene-age",
];
