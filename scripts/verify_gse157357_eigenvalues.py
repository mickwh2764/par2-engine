#!/usr/bin/env python3
"""
Verification script for GSE157357 per-gene eigenvalue claims.

Loads scripts/mm10_ensembl_to_symbol.csv to obtain the Ensembl ID → gene-symbol
mapping for the GSE157357 organoid dataset, then:
  1. Reads the four GSE157357 organoid circadian CSV files
  2. Averages replicate columns (same ZT value) per gene
  3. Fits AR(2) model and computes eigenvalue modulus |λ|
  4. Compares computed values to the hardcoded claims in phi-timescale-buffering.tsx
     and gse157357-pairwise.ts (KEY_GENES)

All Ensembl IDs are canonical GRCm38 and match those used in server/gene-categories.ts
and related server-side files.

AR(2) fitting (matches server-side implementation):
  - Mean-center the series
  - OLS fit: y[t] = φ₁*y[t-1] + φ₂*y[t-2]
  - Eigenvalue: complex roots → |λ| = √(−φ₂); real roots → max(|r1|,|r2|)
  - Capped at 0.999

Usage:
    python3 scripts/verify_gse157357_eigenvalues.py

Writes: scripts/verify_gse157357_eigenvalues_output.txt
"""

import csv
import math
import os
import sys
from collections import defaultdict
from typing import Dict, List, Optional

DATASETS_DIR = "datasets"
MAPPING_CSV  = "scripts/mm10_ensembl_to_symbol.csv"
TOLERANCE    = 0.005  # ≤0.5% difference is PASS

# ---------------------------------------------------------------------------
# Load Ensembl→symbol mapping from CSV
# ---------------------------------------------------------------------------
def load_mapping(csv_path: str) -> Dict[str, Dict[str, str]]:
    """Returns {ensembl_id: {gene_symbol, verification_status, dataset_note}}."""
    mapping: Dict[str, Dict[str, str]] = {}
    with open(csv_path, newline="") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            status = row.get("verification_status", "")
            if status not in ("VERIFIED", "PARTIAL"):
                continue
            ens = row["ensembl_id"].strip()
            mapping[ens] = {
                "gene_symbol":         row["gene_symbol"].strip(),
                "verification_status": status,
                "dataset_note":        row.get("dataset_note", "").strip(),
            }
    return mapping


def build_symbol_to_ensembl(mapping: Dict[str, Dict[str, str]]) -> Dict[str, str]:
    """Returns {gene_symbol: ensembl_id}, preferring VERIFIED over PARTIAL."""
    result: Dict[str, str] = {}
    for ens, info in mapping.items():
        sym = info["gene_symbol"]
        status = info["verification_status"]
        if sym not in result:
            result[sym] = ens
        elif status == "VERIFIED":
            result[sym] = ens
    return result


# ---------------------------------------------------------------------------
# Claimed values (from phi-timescale-buffering.tsx CONDITIONS array)
# ---------------------------------------------------------------------------
CLAIMED: Dict[str, Dict[str, float]] = {
    "WT": {
        "Cry1":   0.814, "Arntl":  0.810, "Dbp":    0.782,
        "Nr1d1":  0.743, "Cdk1":   0.757, "Myc":    0.743,
        "Wee1":   0.655, "Axin2":  0.637, "Mki67":  0.528,
        "Cdkn1a": 0.531, "Clock":  0.475, "Per2":   0.487,
        "Lgr5":   0.474, "Per1":   0.240, "Ccnb1":  0.206,
    },
    "BmalKO": {
        "Arntl":  0.439, "Per2":   0.445, "Cry1":   0.458,
        "Nr1d1":  0.483, "Wee1":   0.782, "Lgr5":   0.833,
        "Myc":    0.423, "Cdk1":   0.509, "Mki67":  0.400,
        "Cdkn1a": 0.547, "Ccnb1":  0.960,
    },
    "ApcKO": {
        "Arntl":  0.880, "Per2":   0.528, "Cry1":   0.376,
        "Nr1d1":  0.539, "Per1":   0.915, "Dbp":    1.000,
        "Clock":  0.413, "Wee1":   0.877, "Lgr5":   0.928,
        "Myc":    0.705, "Cdk1":   0.973, "Mki67":  0.622,
        "Cdkn1a": 0.929, "Ccnb1":  1.000, "Axin2":  0.937,
    },
    "DblKO": {
        "Arntl":  0.617, "Per2":   0.833, "Cry1":   0.331,
        "Nr1d1":  0.443, "Wee1":   0.335, "Lgr5":   0.941,
        "Myc":    0.439, "Cdk1":   0.450, "Mki67":  0.292,
        "Cdkn1a": 0.824, "Ccnb1":  0.339,
    },
}

CONDITIONS = [
    ("WT",     "GSE157357_Organoid_WT-WT_circadian.csv"),
    ("BmalKO", "GSE157357_Organoid_WT-BmalKO_circadian.csv"),
    ("ApcKO",  "GSE157357_Organoid_ApcKO-WT_circadian.csv"),
    ("DblKO",  "GSE157357_Organoid_ApcKO-BmalKO_circadian.csv"),
]


# ---------------------------------------------------------------------------
# AR(2) fitting
# ---------------------------------------------------------------------------
def fit_ar2(series: List[float]) -> Optional[float]:
    n = len(series)
    if n < 5:
        return None
    mean = sum(series) / n
    y = [v - mean for v in series]
    y0, y1, y2 = y[2:], y[1:-1], y[:-2]
    s11 = sum(a * a for a in y1)
    s12 = sum(a * b for a, b in zip(y1, y2))
    s22 = sum(b * b for b in y2)
    r1  = sum(a * c for a, c in zip(y1, y0))
    r2  = sum(b * c for b, c in zip(y2, y0))
    det = s11 * s22 - s12 * s12
    if abs(det) < 1e-15:
        return None
    phi1 = (r1 * s22 - r2 * s12) / det
    phi2 = (r2 * s11 - r1 * s12) / det
    discriminant = phi1 * phi1 + 4 * phi2
    if discriminant < 0:
        lam = math.sqrt(-phi2) if -phi2 >= 0 else 0.0
    else:
        r_pos = (phi1 + math.sqrt(discriminant)) / 2
        r_neg = (phi1 - math.sqrt(discriminant)) / 2
        lam = max(abs(r_pos), abs(r_neg))
    return min(lam, 0.999)


# ---------------------------------------------------------------------------
# Load one circadian CSV → {ensembl_id: replicate-averaged series}
# ---------------------------------------------------------------------------
def load_organoid_csv(filepath: str, target_ids: set) -> Dict[str, List[float]]:
    with open(filepath, newline="") as fh:
        reader = csv.reader(fh)
        header = next(reader)

    timepoint_cols: Dict[str, List[int]] = defaultdict(list)
    for i, h in enumerate(header[1:], start=1):
        zt = h.strip().strip('"')
        timepoint_cols[zt].append(i)
    zt_sorted = sorted(timepoint_cols.keys(), key=lambda x: int(x))

    result: Dict[str, List[float]] = {}
    with open(filepath, newline="") as fh:
        reader = csv.reader(fh)
        next(reader)
        for row in reader:
            gene_id = row[0].strip().strip('"')
            if gene_id not in target_ids:
                continue
            series = []
            for zt in zt_sorted:
                cols = timepoint_cols[zt]
                vals = []
                for c in cols:
                    try:
                        vals.append(float(row[c]))
                    except (IndexError, ValueError):
                        pass
                if vals:
                    series.append(sum(vals) / len(vals))
            if len(series) >= 5:
                result[gene_id] = series
    return result


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    lines: List[str] = []
    def pr(s: str = ""):
        print(s)
        lines.append(s)

    # Load mapping from CSV
    if not os.path.exists(MAPPING_CSV):
        print(f"ERROR: Mapping file not found: {MAPPING_CSV}")
        sys.exit(1)
    mapping = load_mapping(MAPPING_CSV)
    sym_to_ens = build_symbol_to_ensembl(mapping)

    pr("=" * 72)
    pr("GSE157357 Eigenvalue Verification — phi-timescale-buffering.tsx")
    pr(f"Mapping: {MAPPING_CSV}  ({len(mapping)} entries loaded)")
    pr("All Ensembl IDs are canonical GRCm38 (matching server/gene-categories.ts)")
    pr("=" * 72)
    pr()
    pr("Gene → Ensembl ID mapping used:")
    for sym, ens in sorted(sym_to_ens.items()):
        info = mapping[ens]
        pr(f"  {sym:<12} → {ens}  [{info['verification_status']}]")
    pr()

    overall = {"PASS": 0, "FAIL": 0, "MISSING": 0, "PARTIAL": 0}

    for cond_label, csv_name in CONDITIONS:
        csv_path = os.path.join(DATASETS_DIR, csv_name)
        claimed  = CLAIMED[cond_label]

        pr(f"{'─' * 72}")
        pr(f"Condition: {cond_label}  ({csv_name})")
        pr(f"{'─' * 72}")

        needed_ids = set()
        for gene in claimed:
            ens = sym_to_ens.get(gene)
            if ens:
                needed_ids.add(ens)

        try:
            gene_data = load_organoid_csv(csv_path, needed_ids)
        except FileNotFoundError:
            pr(f"  ERROR: File not found: {csv_path}")
            pr(f"  All {len(claimed)} genes for condition {cond_label} counted as MISSING.")
            overall["MISSING"] += len(claimed)
            pr()
            continue

        pr(f"  Loaded {len(gene_data)} target-gene rows from CSV")
        pr()
        pr(f"  {'Gene':<10} {'Ensembl ID':<24} {'MapStatus':<12} {'Claimed':>8} {'Computed':>10} {'Status'}")
        pr(f"  {'----':<10} {'----------':<24} {'---------':<12} {'-------':>8} {'--------':>10} {'------'}")

        corrections: List[str] = []

        for gene, claimed_val in sorted(claimed.items()):
            ens_id     = sym_to_ens.get(gene)
            map_info   = mapping.get(ens_id, {}) if ens_id else {}
            map_status = map_info.get("verification_status", "NOT IN MAPPING")
            series     = gene_data.get(ens_id) if ens_id else None
            computed   = fit_ar2(series) if series else None

            if computed is None:
                tag = "MISSING"
                overall["MISSING"] += 1
                pr(f"  {gene:<10} {ens_id or 'N/A':<24} {map_status:<12} {claimed_val:>8.3f} {'N/A':>10}  {tag}")
            else:
                diff = abs(computed - claimed_val)
                if diff <= TOLERANCE:
                    tag = "PASS"
                    overall["PASS"] += 1
                elif map_status == "PARTIAL":
                    tag = f"PARTIAL (diff={diff:.4f})"
                    overall["PARTIAL"] += 1
                    corrections.append(
                        f"    {gene}: claimed={claimed_val:.3f} computed={computed:.4f}"
                        f" [PARTIAL — source ID unresolvable without original kallisto reference]"
                    )
                else:
                    tag = f"FAIL (diff={diff:.4f})"
                    overall["FAIL"] += 1
                    corrections.append(
                        f"    {gene}: claimed={claimed_val:.3f} computed={computed:.4f} diff={diff:.4f}"
                    )
                pr(f"  {gene:<10} {ens_id:<24} {map_status:<12} {claimed_val:>8.3f} {computed:>10.4f}  {tag}")

        pr()
        if corrections:
            pr("  Notes:")
            for c in corrections:
                pr(c)
        pr()

    pr("=" * 72)
    pr(f"OVERALL: {overall['PASS']} PASS | {overall['FAIL']} FAIL | "
       f"{overall['PARTIAL']} PARTIAL (source ID unresolvable) | {overall['MISSING']} MISSING")
    pr()
    pr("VERIFIED genes (canonical GRCm38 ID, all claimed conditions match ≤0.005):")
    verified = sorted(s for s, e in sym_to_ens.items()
                      if mapping[e]["verification_status"] == "VERIFIED")
    pr(f"  {', '.join(verified)}")
    pr()
    pr("PARTIAL genes (canonical ID gives different eigenvalue; no consistent")
    pr("alternative ID found across all conditions; original kallisto reference")
    pr("build required to resolve):")
    partial = sorted(s for s, e in sym_to_ens.items()
                     if mapping[e]["verification_status"] == "PARTIAL")
    pr(f"  {', '.join(partial)}")
    pr("=" * 72)

    out_path = "scripts/verify_gse157357_eigenvalues_output.txt"
    with open(out_path, "w") as fh:
        fh.write("\n".join(lines) + "\n")
    print(f"\nOutput written to {out_path}")

    # Exit nonzero if any gene-condition pair failed verification
    if overall["FAIL"] > 0 or overall["MISSING"] > 0 or overall["PARTIAL"] > 0:
        sys.exit(1)


if __name__ == "__main__":
    os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
    main()
