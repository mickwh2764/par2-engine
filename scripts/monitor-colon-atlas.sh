#!/usr/bin/env bash
# =============================================================================
# monitor-colon-atlas.sh
# Checks NCBI GEO for a public GSE deposit of the Carmona-Alcocer / Naef colon
# scRNA-seq dataset (bioRxiv preprint Nov 2025).
#
# Usage:
#   bash scripts/monitor-colon-atlas.sh
#
# Returns exit 0 if a genuine GSE candidate is found, exit 1 if not yet deposited.
# =============================================================================

set -euo pipefail

ESEARCH_URL="https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
ESUMMARY_URL="https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi"

# Author-specific searches (most specific — fewest false positives)
AUTHOR_SEARCHES=(
  "Carmona-Alcocer[Author]+colon+circadian"
  "Naef[Author]+colon+single+cell+circadian"
  "Costello[Author]+colon+circadian"
)

# Fallback broad search (will produce false positives — cross-check entrytype)
BROAD_SEARCHES=(
  "colon+circadian+single+cell+2025[PDAT]"
  "colon+circadian+single+cell+2026[PDAT]"
  "human+colon+biopsy+circadian+2025[PDAT]"
  "human+intestinal+biopsy+circadian+2026[PDAT]"
)

echo "========================================================"
echo "  Chrono-atlas colon dataset monitor"
echo "  Date: $(date -u +%Y-%m-%d)"
echo "  Target 1: Carmona-Alcocer / Naef — colon scRNA-seq"
echo "  Preprint : bioRxiv Nov 2025"
echo "  Target 2: Costello et al. — human colon biopsy circadian timeseries"
echo "  Status   : accession unverified (GSE183714 is incorrect)"
echo "========================================================"
echo ""

FOUND=0

run_search() {
  local TERM="$1"
  local DB="${2:-gse}"     # search GSE series, not GPL platforms
  echo "Searching GEO (db=${DB}) for: ${TERM}"

  RESULT=$(curl -sf \
    "${ESEARCH_URL}?db=${DB}&term=${TERM}&retmax=10&retmode=json" \
    2>/dev/null || echo '{"esearchresult":{"count":"0","idlist":[]}}')

  COUNT=$(echo "$RESULT" | python3 -c \
    "import sys,json; d=json.load(sys.stdin); print(d['esearchresult']['count'])" \
    2>/dev/null || echo "0")

  if [ "${COUNT:-0}" -gt 0 ] 2>/dev/null; then
    IDS=$(echo "$RESULT" | python3 -c \
      "import sys,json; d=json.load(sys.stdin); print(' '.join(d['esearchresult']['idlist']))" \
      2>/dev/null || echo "")

    local GENUINE=0
    for ID in $IDS; do
      SUMMARY=$(curl -sf \
        "${ESUMMARY_URL}?db=${DB}&id=${ID}&retmode=json" \
        2>/dev/null || echo "{}")

      # Parse; skip GPL platform entries (entrytype == "GPL")
      PARSED=$(echo "$SUMMARY" | python3 - <<PYEOF 2>/dev/null || echo "SKIP|||(parse error)"
import sys, json
d = json.load(sys.stdin)
r = d.get('result', {})
uids = r.get('uids', [])
if not uids:
    print("SKIP|||(no uids)")
else:
    uid = uids[0]
    item = r.get(uid, {})
    etype = item.get('entrytype', '')
    if etype.upper() == 'GPL':
        print(f"SKIP|{etype}|(platform record, not a dataset)")
    else:
        title = item.get('title', '(no title)')
        acc   = item.get('accession', '(no accession)')
        org   = item.get('organism', '(no organism)')
        summ  = item.get('summary', '')[:200].replace('\n', ' ')
        print(f"KEEP|{acc}|{title}|{org}|{summ}")
PYEOF
      )

      DECISION=$(echo "$PARSED" | cut -d'|' -f1)
      ACC=$(echo "$PARSED" | cut -d'|' -f2)
      TITLE=$(echo "$PARSED" | cut -d'|' -f3)
      ORG=$(echo "$PARSED" | cut -d'|' -f4)
      SUMM=$(echo "$PARSED" | cut -d'|' -f5)

      if [ "$DECISION" = "KEEP" ]; then
        echo "  ✅ CANDIDATE: ${ACC} — ${TITLE}"
        echo "     Organism : ${ORG}"
        echo "     Summary  : ${SUMM}"
        GENUINE=1
        FOUND=1
      else
        echo "  — Skipped (${ACC:-ID:$ID}): ${TITLE}"
      fi
    done

    [ "$GENUINE" -eq 0 ] && echo "  — All results were platform/GPL records (false positives)"
  else
    echo "  — Not found yet"
  fi
  echo ""
}

echo "--- Author-specific searches ---"
for TERM in "${AUTHOR_SEARCHES[@]}"; do
  run_search "$TERM" "gse"
done

echo "--- Date-filtered broad searches ---"
for TERM in "${BROAD_SEARCHES[@]}"; do
  run_search "$TERM" "gse"
done

echo "--- Naef lab website check (EPFL) ---"
echo "Checking https://www.epfl.ch/labs/naef-lab/ for new publications..."
NAEF_PAGE=$(curl -sf --max-time 15 \
  "https://www.epfl.ch/labs/naef-lab/" 2>/dev/null || echo "")

if [ -n "$NAEF_PAGE" ]; then
  # Look specifically for GEO accession numbers (GSE[digits]) — a strong deposit signal.
  # Generic biology words (gut, intestin, colon) are present on the lab page at all times
  # and must NOT be used to set FOUND or trigger exit 0.
  GSE_HITS=$(echo "$NAEF_PAGE" | grep -oE "GSE[0-9]+" | sort -u | tr '\n' ' ' || true)
  # Also look for "colon" appearing within 120 chars of a year >= 2026 (new publication signal)
  NEW_COLON=$(echo "$NAEF_PAGE" | grep -oiE ".{0,60}colon.{0,60}202[6-9].{0,30}" | head -3 || true)

  if [ -n "$GSE_HITS" ]; then
    echo "  ⚠️  MANUAL REVIEW — GEO accession(s) found on Naef lab page: ${GSE_HITS}"
    echo "     → Visit https://www.epfl.ch/labs/naef-lab/ and verify these are new"
    echo "        colon scRNA-seq deposits. If confirmed, run NOTCH2 AR(2) immediately."
  elif [ -n "$NEW_COLON" ]; then
    echo "  ℹ️  MANUAL REVIEW — Recent 'colon' context found on Naef lab page (2026+):"
    echo "     ${NEW_COLON}"
    echo "     → Visit https://www.epfl.ch/labs/naef-lab/ to check for a new deposit"
  else
    echo "  — No new GEO accessions or 2026+ colon publications detected on Naef lab page"
    echo "     (informational only — manual spot-check recommended each session)"
  fi
  # NOTE: FOUND is intentionally NOT set here. The EPFL page check is informational only.
  # Only a confirmed GEO deposit returned by the Entrez searches above sets FOUND=1.
else
  echo "  — Could not reach Naef lab page (network unavailable or timeout)"
fi
echo ""

echo "========================================================"
if [ "$FOUND" -eq 1 ]; then
  echo "  STATUS: 🟢 GENUINE CANDIDATE FOUND — review above"
  echo ""
  echo "  ⚡ IMMEDIATE ACTION REQUIRED:"
  echo "     Run NOTCH2 AR(2) φ-proximity analysis using the pipeline in:"
  echo "     manuscripts/future_iterations/intestinal_three_oscillator_phi_proximity.md"
  echo "     (§ NOTCH2 φ-Proximity Verification section)"
  echo ""
  echo "  Steps:"
  echo "  1. Confirm dataset organism (mouse vs human) and timepoint regularity"
  echo "  2. Extract NOTCH2/Notch2 expression and apply AR(2) OLS (mean-centred)"
  echo "  3. Compute |λ| and Δ from 1/φ = 0.6180"
  echo "  4. Run expression-matched permutation test (10,000 controls, log2 ± 0.5)"
  echo "  5. Compare against existing results:"
  echo "       Human GSE161566: NOTCH2 |λ|=0.6277, Δ=0.0097, p=0.036 (BH q<0.05)"
  echo "       Mouse GSE179027: Notch2 |λ|=0.6367, Δ=0.0187, p=0.061 (directional)"
  echo "  6. Update the three-oscillator table in the manuscript if cross-species"
  echo "     replication is confirmed"
  echo ""
  echo "  Reference pipeline: scripts/focal_genes_bootstrap_stability.cjs"
  echo "========================================================"
  exit 0
else
  echo "  STATUS: 🔴 NOT YET DEPOSITED — run again next session"
  echo ""
  echo "  Monitoring targets:"
  echo "    • Carmona-Alcocer/Naef — Chrono-atlas colon scRNA-seq (bioRxiv Nov 2025)"
  echo "    • Costello et al. — human colon biopsy circadian timeseries"
  echo ""
  echo "  Hint  : When bioRxiv DOI is known, add it above and"
  echo "          search for it directly via the preprint API."
  echo "  Hint  : Also check https://www.epfl.ch/labs/naef-lab/ manually"
  echo "          and bioRxiv: https://www.biorxiv.org/search/carmona-alcocer+colon"
  echo "========================================================"
  exit 1
fi
