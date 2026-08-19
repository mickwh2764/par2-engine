#!/usr/bin/env bash
# Download and prepare the three source datasets needed to verify
# UNVERIFIABLE pages from the August 2026 platform accuracy audit.
#
# Pages:
#   client/src/pages/u2os-myc-ar2.tsx         (GSE221173)
#   client/src/pages/gbm-zman-seq.tsx          (GSE232040)
#   client/src/pages/bacterial-persistence.tsx (GSE67402)
#
# Run from the workspace root:
#   bash scripts/download_missing_datasets.sh
#
# Requirements: curl, python3, gunzip (standard on macOS/Linux).
# Output files (all in datasets/, which is gitignored per project convention):
#   datasets/GSE67402_Ecoli_starvation_averaged.csv
#   datasets/GSE221173_U2OS_Rep2_MYC-OFF.csv     (Ensembl ID rows)
#   datasets/GSE221173_U2OS_Rep2_MYC-ON.csv      (Ensembl ID rows)
#   datasets/GSE232040_GBM_ZmanSeq_metadata.csv  (per-cell annotations only)
#
# NOTE: datasets/ is gitignored ("too large for GitHub, served from Replit
# storage"). Re-run this script after a fresh checkout to restore datasets
# before running scripts/verify_missing_datasets.py.

set -euo pipefail

GEO_BASE="https://ftp.ncbi.nlm.nih.gov/geo/series"
TMP="${TMPDIR:-/tmp}/geo_download_$$"
mkdir -p "$TMP" datasets

echo "=== Downloading source datasets from NCBI GEO ==="

# ── GSE67402 — E. coli glucose starvation ─────────────────────────────────
echo ""
echo "1/3  GSE67402 counts (Houser et al. PLoS Comput Biol 2015)..."
curl -fsSL \
  "${GEO_BASE}/GSE67nnn/GSE67402/suppl/GSE67402_counts.csv.gz" \
  -o "${TMP}/GSE67402_counts.csv.gz"

ACTUAL=$(md5sum "${TMP}/GSE67402_counts.csv.gz" | cut -d' ' -f1)
EXPECTED="bfb52a92ea7b5e8984606c1cee528817"
if [ "$ACTUAL" != "$EXPECTED" ]; then
  echo "  CHECKSUM MISMATCH for GSE67402_counts.csv.gz"
  echo "  Expected: $EXPECTED  Got: $ACTUAL"
  exit 1
fi
echo "  Checksum OK"

# ── GSE221173 — U2OS MYC-ER RNA-seq ──────────────────────────────────────
echo ""
echo "2/3  GSE221173 TPM (U2OS MYC-ER time course, 2 replicates × 2 conditions)..."
curl -fsSL \
  "${GEO_BASE}/GSE221nnn/GSE221173/suppl/GSE221173_MYC-ER_RNA-Seq_TPM_Circadian_U2OS.txt.gz" \
  -o "${TMP}/GSE221173_tpm.txt.gz"

ACTUAL=$(md5sum "${TMP}/GSE221173_tpm.txt.gz" | cut -d' ' -f1)
EXPECTED="3e87331e53e14613de7cbb6a58e21df5"
if [ "$ACTUAL" != "$EXPECTED" ]; then
  echo "  CHECKSUM MISMATCH for GSE221173_MYC-ER_RNA-Seq_TPM_Circadian_U2OS.txt.gz"
  echo "  Expected: $EXPECTED  Got: $ACTUAL"
  exit 1
fi
echo "  Checksum OK"

# ── GSE232040 — GBM Zman-seq metadata ────────────────────────────────────
echo ""
echo "3/3  GSE232040 metadata (Kirschenbaum et al. Cell 2024)..."
curl -fsSL \
  "${GEO_BASE}/GSE232nnn/GSE232040/suppl/GSE232040_metadata_q27_annotated.txt.gz" \
  -o "${TMP}/GSE232040_meta.txt.gz"

ACTUAL=$(md5sum "${TMP}/GSE232040_meta.txt.gz" | cut -d' ' -f1)
EXPECTED="a1ca516ce6c1157ed5cfcac74200118f"
if [ "$ACTUAL" != "$EXPECTED" ]; then
  echo "  CHECKSUM MISMATCH for GSE232040_metadata_q27_annotated.txt.gz"
  echo "  Expected: $EXPECTED  Got: $ACTUAL"
  exit 1
fi
echo "  Checksum OK"

# ── Run Python preparation script ─────────────────────────────────────────
echo ""
echo "=== Running preparation script ==="
GSE67402_GZ="${TMP}/GSE67402_counts.csv.gz" \
GSE221173_GZ="${TMP}/GSE221173_tpm.txt.gz" \
GSE232040_GZ="${TMP}/GSE232040_meta.txt.gz" \
python3 scripts/prepare_missing_datasets.py

echo ""
echo "=== Done. Datasets ready in datasets/ ==="
echo "    To verify: python3 scripts/verify_missing_datasets.py"

rm -rf "$TMP"
