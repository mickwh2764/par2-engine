#!/usr/bin/env bash
# ============================================================
#  GLDS-247 PDF Canonical-Value Guard
#
#  Extracts text from the compiled submission PDF via pdftotext
#  and asserts every corrected IFN-γ key value is present with
#  exact numeric boundaries and surrounding prose context.
#  Exits 0 if all values found; exits 1 if any are missing.
#
#  Usage:
#    bash scripts/check-glds247-pdf-values.sh
#    bash scripts/check-glds247-pdf-values.sh path/to/override.pdf
#
#  Canonical values guarded (April 2026 correction):
#    GC   delta  +0.377 log2 units, Mann-Whitney p = 0.027
#    FLT  delta  +0.185 log2 units, p = 0.25 vs baseline
#    deficit     –0.192 log2 unit deficit
#    cage corr   Spearman r = –0.25, p = 0.52
#    gene count  117 detected genes
# ============================================================

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PDF="${1:-$ROOT/manuscripts/future_iterations/glds247_spaceflight_colon_submission.pdf}"

bold()  { echo -e "\033[1m$*\033[0m"; }

bold ""
bold "══════════════════════════════════════════════════════"
bold "  GLDS-247 PDF canonical-value guard"
bold "  PDF: $PDF"
bold "══════════════════════════════════════════════════════"

# ── preflight ────────────────────────────────────────────────
if ! command -v pdftotext &>/dev/null; then
  echo -e "\033[0;31m  ERROR\033[0m  pdftotext not found — install poppler-utils"
  exit 1
fi

if [ ! -f "$PDF" ]; then
  echo -e "\033[0;31m  ERROR\033[0m  PDF not found: $PDF"
  exit 1
fi

# ── delegate all assertions to Python for precise regex ──────
python3 - "$PDF" <<'PYEOF'
import re, subprocess, sys

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
GREEN = "\033[0;32m"
RED   = "\033[0;31m"
RESET = "\033[0m"
PASS_COUNT = 0
FAIL_COUNT = 0
FAILURES   = []

def ok(label):
    global PASS_COUNT
    print(f"{GREEN}  PASS{RESET}  {label}")
    PASS_COUNT += 1

def fail(label, detail=""):
    global FAIL_COUNT
    msg = label + (f" — {detail}" if detail else "")
    print(f"{RED}  FAIL{RESET}  {msg}")
    FAIL_COUNT += 1
    FAILURES.append(msg)

def assert_pattern(label, pattern, text, flags=re.DOTALL):
    """Require pattern present AND numeric boundaries (no stray digit immediately
    adjacent to the matched number).  The pattern itself must be written so that
    the key number is the first capture group or appears verbatim."""
    if re.search(pattern, text, flags):
        ok(label)
    else:
        fail(label, f"pattern not found: {pattern!r}")

# ---------------------------------------------------------------------------
# Extract PDF text
# ---------------------------------------------------------------------------
result = subprocess.run(
    ["pdftotext", sys.argv[1], "-"],
    capture_output=True, text=True, errors="replace"
)
if result.returncode != 0:
    print(f"{RED}  ERROR{RESET}  pdftotext failed (exit {result.returncode})")
    sys.exit(1)

txt = result.stdout
# Collapse line-breaks so multi-line prose can be matched as one span
# (preserve paragraph breaks represented by blank lines)
txt_joined = re.sub(r'\n(?!\n)', ' ', txt)

# ---------------------------------------------------------------------------
# Canonical assertions
#
# Boundaries: (?<!\d) before and (?!\d) after each key number ensure that
# 0.3771, 0.0279, 0.251 etc. do NOT satisfy the check.
#
# Context: each pattern includes enough surrounding prose to prove the number
# appears in the correct claim, not in an unrelated table cell or caption.
# ---------------------------------------------------------------------------

# 1. GC delta: +0.377 log2 units, in the GC/FLT IFN-γ priming paragraph
#    "mean score gain +0.377 log2 units"
assert_pattern(
    "GC IFN-γ delta: +0.377 log2 units (in IFN-γ priming context)",
    r'mean score gain \+(?<!\d)0\.377(?!\d) log2 units',
    txt_joined
)

# 2. GC p-value: p = 0.027, immediately after the +0.377 claim
#    "Mann-Whitney p = 0.027 versus"
assert_pattern(
    "GC Mann-Whitney p-value: p = 0.027 (exact, IFN-γ priming context)",
    r'Mann-Whitney p\s*=\s*(?<!\d)0\.027(?!\d)\b',
    txt_joined
)

# 3. FLT delta: +0.185, attributed to spaceflight animals, no immune priming
#    "comparable immune priming (+0.185 log2 units"
assert_pattern(
    "FLT IFN-γ delta: +0.185 log2 units (spaceflight, no-priming context)",
    r'comparable immune priming \(\+(?<!\d)0\.185(?!\d) log2 units',
    txt_joined
)

# 4. FLT p-value: p = 0.25 vs baseline (immediately after +0.185 claim)
#    "0.185 log2 units; p = 0.25 vs baseline"
assert_pattern(
    "FLT p-value: p = 0.25 vs baseline (exact, paired with +0.185 claim)",
    r'0\.185 log2 units;\s*p\s*=\s*(?<!\d)0\.25(?!\d)\s+vs baseline',
    txt_joined
)

# 5. GC–FLT deficit: –0.192 log2 unit deficit
#    The en-dash in the PDF is U+2013; also allow plain hyphen for robustness.
#    "a –0.192 log2 unit deficit"
assert_pattern(
    "GC–FLT deficit: –0.192 log2 units (deficit context)",
    r'a\s+[\u2013\-](?<!\d)0\.192(?!\d) log2 unit deficit',
    txt_joined
)

# 6. Cage Spearman r = –0.25 (non-significant, flight animals)
#    "Spearman r = –0.25,"
assert_pattern(
    "Cage Spearman r = –0.25 (cage-artifact ruling-out context)",
    r'Spearman r\s*=\s*[\u2013\-](?<!\d)0\.25(?!\d)',
    txt_joined
)

# 7. Cage p = 0.52 (paired with r = –0.25)
#    "r = –0.25, p = 0.52"  or  "r = –0.25 (p = 0.52)"
assert_pattern(
    "Cage p-value: p = 0.52 (exact, cage-correlation context)",
    r'[\u2013\-]0\.25[^\n]{0,20}p\s*=\s*(?<!\d)0\.52(?!\d)',
    txt_joined
)

# 8. 117 detected genes in IFN-γ score definition
#    "117 detected genes"
assert_pattern(
    "IFN-γ score: 117 detected genes (exact, score-definition context)",
    r'(?<!\d)117(?!\d)\s+detected genes',
    txt_joined
)

# 9. G2M directional count: 81/106 genes UP
assert_pattern(
    "G2M directional count: 81/106 genes UP",
    r'(?<!\d)81/106(?!\d)',
    txt_joined
)

# 10. G2M binomial p = 2.2×10⁻⁸ (pdftotext renders superscript as plain "10-8")
assert_pattern(
    "G2M binomial p = 2.2×10⁻⁸ (corrected from 4.5×10⁻¹³)",
    r'2\.2\s*[\u00d7x\*]\s*10[-\u207b\u2212]8',
    txt_joined
)

# 11. G2M total detected genes: 106 (Table 3 N column)
assert_pattern(
    "G2M N=106 detected genes in Table 3 context",
    r'G2M_CHECKPOINT[^\n]{0,40}(?<!\d)106(?!\d)',
    txt_joined
)

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
total = PASS_COUNT + FAIL_COUNT
print()
print("\033[1m══════════════════════════════════════════════════════\033[0m")
print(f"  Passed : {PASS_COUNT} / {total}")
print(f"  Failed : {FAIL_COUNT} / {total}")
print("\033[1m══════════════════════════════════════════════════════\033[0m")

if FAIL_COUNT > 0:
    print(f"{RED}  REGRESSION DETECTED — one or more canonical values are missing from the PDF{RESET}")
    print(f"{RED}  Rebuild the PDF from source and re-run this check before submitting.{RESET}")
    sys.exit(1)
else:
    print(f"\033[0;32m  All canonical values confirmed present in PDF\033[0m")
    sys.exit(0)
PYEOF
