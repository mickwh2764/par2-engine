#!/usr/bin/env bash
# ============================================================
#  PAR(2) Post-Merge Setup Script
#  Runs automatically after a task agent merges changes.
#
#  Keeps dependencies in sync and recompiles any stale PDFs.
# ============================================================
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "── Installing dependencies ──"
npm install --prefer-offline 2>&1 | tail -5

echo "── Recompiling stale PDFs ──"
bash scripts/regenerate-pdfs.sh 2>&1 || true

echo "── Post-merge setup complete ──"
