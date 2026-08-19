#!/usr/bin/env bash
# ============================================================
#  PAR(2) Master Audit Runner — Tier 2 Numeric Verification
#
#  Chains all seven number-verification scripts in sequence,
#  collects per-paper PASS/FAIL results, and exits non-zero
#  if any script fails.
#
#  Usage:
#    bash scripts/master-audit.sh
#
#  Exit codes:
#    0 — all seven Tier 2 scripts passed
#    1 — one or more scripts failed
#
#  Scripts audited:
#    1. verify_ch11_ks_test.cjs       Paper J  — Ch.11 KS test (proteomics vs mRNA FP)
#    2. verify-paper-claims.ts        Papers G & N — AR(2) eigenvalue claims
#    3. verify_paper_g2_values.py     Paper G2 — E-box/D-box/RRE permutation values
#    4. check_floquet_table1.py       Paper G2 — Table 1 vs floquet_coefficients.json
#    5. check-glds247-pdf-values.sh   GLDS-247 — canonical IFN-γ values in PDF
#    6. verify-paper-r-claims.py      Paper R  — segmentation clock AR(2) claims
#    7. verify-paper-r-claims.py      Paper R  — §3.5 benchmark comparison claims
#
#  Dataset dependencies:
#    Each verify script has a companion <scriptname>.deps file in scripts/.
#    The .deps file lists "Display label|relative/path/to/file" entries.
#    This script reads all *.deps files automatically — add a .deps file
#    alongside any new verify script to register its datasets here.
#    (#286: self-updating pre-flight list)
#
#  Corruption checks (#285):
#    For each dataset file, the pre-flight checks:
#      1. File exists
#      2. File is not empty (size > 0)
#      3. For CSV files: has at least 2 lines (header + 1 data row)
#      4. For JSON files: parses as valid JSON
#      5. For PDF files: size > 1 KB (basic truncation guard)
# ============================================================

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPTS_DIR="$ROOT/scripts"

# ── colours ──────────────────────────────────────────────────
bold()  { echo -e "\033[1m$*\033[0m"; }
green() { echo -e "\033[0;32m  PASS\033[0m  $*"; }
red()   { echo -e "\033[0;31m  FAIL\033[0m  $*"; }
cyan()  { echo -e "\033[1;36m── $* ──\033[0m"; }

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

bold ""
bold "╔══════════════════════════════════════════════════════╗"
bold "║   PAR(2) Master Audit Runner  —  Tier 2 Numerics"
bold "║   $TIMESTAMP"
bold "╚══════════════════════════════════════════════════════╝"

# ── result tracking ──────────────────────────────────────────
declare -a LABELS=()
declare -a STATUSES=()
OVERALL=0

# ── pre-flight: load dataset dependencies from *.deps files ──
#
#  Each verify script has a companion <scriptname>.deps file.
#  Adding a new verify script + its .deps file is all that is
#  needed — no changes to this script required. (#286)
#
declare -a REQUIRED_FILES=()

shopt -s nullglob
DEPS_FILES=("$SCRIPTS_DIR"/*.deps)
shopt -u nullglob

if [ "${#DEPS_FILES[@]}" -eq 0 ]; then
  echo -e "  \033[0;33m  WARN\033[0m  No .deps files found in scripts/ — pre-flight skipped."
  echo "         Add a <scriptname>.deps file alongside each verify script"
  echo "         to register its required dataset files."
  echo ""
else
  for deps_file in "${DEPS_FILES[@]}"; do
    while IFS= read -r line; do
      # Skip blank lines and comment lines
      [[ -z "$line" || "$line" == \#* ]] && continue
      REQUIRED_FILES+=("$line")
    done < "$deps_file"
  done
fi

# ── pre-flight integrity checks ───────────────────────────────
#
#  For each required file:
#    1. Existence check
#    2. Non-empty check (#285: catch truncated/corrupt files)
#    3. Format-specific sanity check (#285):
#       - CSV: minimum 2 lines (header + 1 data row)
#       - JSON: valid JSON parse
#       - PDF: size > 1 KB
#

bold ""
cyan "PRE-FLIGHT — checking required dataset files"
echo ""

PREFLIGHT_FAIL=0

check_file_integrity() {
  local label="$1"
  local filepath="$2"
  local fullpath="$ROOT/$filepath"
  local ext="${filepath##*.}"

  # 1. Existence
  if [ ! -f "$fullpath" ]; then
    echo -e "  \033[0;31m  MISSING\033[0m  $filepath"
    echo "           (needed by: $label)"
    LABELS+=("$label")
    STATUSES+=("FAIL — file missing: $filepath")
    PREFLIGHT_FAIL=1
    OVERALL=1
    return
  fi

  # 2. Non-empty
  if [ ! -s "$fullpath" ]; then
    echo -e "  \033[0;31m  CORRUPT\033[0m  $filepath  [empty file — 0 bytes]"
    echo "           (needed by: $label)"
    LABELS+=("$label")
    STATUSES+=("FAIL — empty file: $filepath")
    PREFLIGHT_FAIL=1
    OVERALL=1
    return
  fi

  # 3. Format-specific sanity
  case "$ext" in
    csv|CSV)
      local line_count
      line_count=$(wc -l < "$fullpath")
      if [ "$line_count" -lt 2 ]; then
        echo -e "  \033[0;31m  CORRUPT\033[0m  $filepath  [only $line_count line(s) — needs header + data]"
        echo "           (needed by: $label)"
        LABELS+=("$label")
        STATUSES+=("FAIL — corrupt CSV ($line_count lines): $filepath")
        PREFLIGHT_FAIL=1
        OVERALL=1
        return
      fi
      ;;
    json|JSON)
      if ! python3 -c "import json,sys; json.load(open(sys.argv[1]))" "$fullpath" 2>/dev/null; then
        echo -e "  \033[0;31m  CORRUPT\033[0m  $filepath  [invalid JSON — parse failed]"
        echo "           (needed by: $label)"
        LABELS+=("$label")
        STATUSES+=("FAIL — invalid JSON: $filepath")
        PREFLIGHT_FAIL=1
        OVERALL=1
        return
      fi
      ;;
    pdf|PDF)
      local size_bytes
      size_bytes=$(wc -c < "$fullpath")
      if [ "$size_bytes" -lt 1024 ]; then
        echo -e "  \033[0;31m  CORRUPT\033[0m  $filepath  [only ${size_bytes}B — likely truncated PDF]"
        echo "           (needed by: $label)"
        LABELS+=("$label")
        STATUSES+=("FAIL — truncated PDF (${size_bytes}B): $filepath")
        PREFLIGHT_FAIL=1
        OVERALL=1
        return
      fi
      ;;
  esac

  # All checks passed
  echo -e "  \033[0;32m  OK\033[0m  $filepath"
}

if [ "${#REQUIRED_FILES[@]}" -eq 0 ]; then
  echo -e "  \033[0;33m  WARN\033[0m  No dataset files registered. Add .deps files to scripts/."
  echo ""
else
  for entry in "${REQUIRED_FILES[@]}"; do
    label="${entry%%|*}"
    filepath="${entry##*|}"
    check_file_integrity "$label" "$filepath"
  done
  echo ""
fi

if [ "$PREFLIGHT_FAIL" -ne 0 ]; then
  # Print summary and exit — don't run scripts against missing/corrupt data
  bold "╔══════════════════════════════════════════════════════╗"
  bold "║   MASTER AUDIT SUMMARY  —  $TIMESTAMP"
  bold "╚══════════════════════════════════════════════════════╝"
  echo ""
  printf "  %-50s  %s\n" "Script / Paper" "Result"
  printf "  %-50s  %s\n" "--------------------------------------------------" "------"
  for i in "${!LABELS[@]}"; do
    printf "  %-50s  \033[0;31m%s\033[0m\n" "${LABELS[$i]}" "${STATUSES[$i]}"
  done
  echo ""
  bold "══════════════════════════════════════════════════════"
  echo "  Passed : 0 / ${#LABELS[@]}"
  echo "  Failed : ${#LABELS[@]} / ${#LABELS[@]}"
  bold "══════════════════════════════════════════════════════"
  echo ""
  echo -e "\033[0;31m  AUDIT ABORTED — fix missing or corrupt files before re-running\033[0m"
  bold "══════════════════════════════════════════════════════"
  exit 1
fi

# ── run_check helper ─────────────────────────────────────────
run_check() {
  local label="$1"
  local paper="$2"
  shift 2
  # "$@" is the command to run

  bold ""
  cyan "$label"
  echo "       Command: $*"
  echo ""

  local out exit_code
  set +e
  out=$(cd "$ROOT" && "$@" 2>&1)
  exit_code=$?
  set -e

  # Print the script's own output, indented
  echo "$out" | sed 's/^/    /'
  echo ""

  LABELS+=("$paper")
  if [ "$exit_code" -eq 0 ]; then
    STATUSES+=("PASS")
  else
    STATUSES+=("FAIL")
    OVERALL=1
  fi
}

# ── 1. Paper J — Ch.11 KS test ───────────────────────────────
run_check \
  "1. Paper J — Ch.11 KS test (proteomics vs mRNA Fibonacci proximity)" \
  "Paper J  (Ch.11 KS)" \
  node scripts/verify_ch11_ks_test.cjs

# ── 2. Papers G & N — AR(2) eigenvalue claims ────────────────
run_check \
  "2. Papers G & N — AR(2) eigenvalue claims (GSE54650, GSE221103)" \
  "Papers G & N  (AR(2) claims)" \
  npx tsx scripts/verify-paper-claims.ts

# ── 3. Paper G2 — E-box/D-box/RRE permutation values ─────────
run_check \
  "3. Paper G2 — E-box/D-box/RRE tissue-specificity permutation" \
  "Paper G2  (E-box permutation)" \
  python3 scripts/verify_paper_g2_values.py

# ── 4. Paper G2 — Table 1 vs floquet_coefficients.json ───────
run_check \
  "4. Paper G2 — Table 1 eigenvalues vs floquet_coefficients.json" \
  "Paper G2  (Floquet Table 1)" \
  python3 scripts/check_floquet_table1.py

# ── 5. GLDS-247 — canonical IFN-γ values in PDF ──────────────
run_check \
  "5. GLDS-247 — canonical IFN-γ values confirmed in submission PDF" \
  "GLDS-247  (PDF canonical values)" \
  bash scripts/check-glds247-pdf-values.sh

# ── 6. Paper R — segmentation clock AR(2) claims ─────────────
run_check \
  "6. Paper R — segmentation clock AR(2) claims (GSE116929, GSE132811)" \
  "Paper R   (segmentation clock)" \
  python3 scripts/verify-paper-r-claims.py

# ── 7. Paper R — §3.5 benchmark comparison claims ────────────
run_check \
  "7. Paper R — §3.5 benchmark claims (GSE116929_benchmark_Ex1.csv)" \
  "Paper R   (§3.5 benchmark)" \
  python3 scripts/verify-paper-r-claims.py --benchmark-only

# ── Per-paper PASS/FAIL table ─────────────────────────────────
bold ""
bold "╔══════════════════════════════════════════════════════╗"
bold "║   MASTER AUDIT SUMMARY  —  $TIMESTAMP"
bold "╚══════════════════════════════════════════════════════╝"
echo ""
printf "  %-38s  %s\n" "Script / Paper" "Result"
printf "  %-38s  %s\n" "--------------------------------------" "------"

PASS_COUNT=0
FAIL_COUNT=0
for i in "${!LABELS[@]}"; do
  label="${LABELS[$i]}"
  status="${STATUSES[$i]}"
  if [ "$status" = "PASS" ]; then
    printf "  %-38s  \033[0;32m%s\033[0m\n" "$label" "PASS"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    printf "  %-38s  \033[0;31m%s\033[0m\n" "$label" "FAIL"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
done

echo ""
bold "══════════════════════════════════════════════════════"
echo "  Passed : $PASS_COUNT / ${#LABELS[@]}"
echo "  Failed : $FAIL_COUNT / ${#LABELS[@]}"
bold "══════════════════════════════════════════════════════"

if [ "$OVERALL" -ne 0 ]; then
  echo ""
  echo -e "\033[0;31m  AUDIT FAILED — fix failing scripts before submission\033[0m"
  bold "══════════════════════════════════════════════════════"
  exit 1
else
  echo ""
  echo -e "\033[0;32m  ALL TIER 2 AUDITS PASSED — numeric claims verified\033[0m"
  bold "══════════════════════════════════════════════════════"
  exit 0
fi
