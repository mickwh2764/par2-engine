#!/usr/bin/env python3
"""
Paper R — Segmentation Clock AR(2) Analysis
==============================================
Pre-specified protocol: analysis_plan.md
Dataset: GSE116929 (human iPSC PSM, 2 × 16 timepoints)
Locked normalisation: log2(CPM+1), mean-centred per gene
Sampling interval: 43 min (confirmed from GEO metadata 2026-08-11)

Run order: Human discovery first.
Mouse (GSE132811) is LOCKED until human results are finalised.
"""

import sys
import os
import numpy as np
import pandas as pd
from pathlib import Path
from scipy import linalg

# ── Constants (locked in analysis_plan.md) ──────────────────────────────────
SAMPLING_INTERVAL_MIN = 43.0          # confirmed from GEO metadata
SAMPLING_INTERVAL_H   = SAMPLING_INTERVAL_MIN / 60.0
MIN_NONZERO_FRACTION  = 0.50          # filter: >50% samples must be nonzero
NONSTATIONARITY_THRESHOLD = 1.0       # |λ| ≥ 1.0 → exclude from comparisons
FP_FIBONACCI   = 0.618                # 1/φ, the PAR(2) reference value
FP_LIKE_THRESH = 85.0                 # Fibonacci-like: FP ≥ 85%
FP_NEAR_THRESH = 50.0                 # Near-Fibonacci: FP ≥ 50%

# Core segmentation-clock genes — test first (analysis_plan.md §4)
CORE_GENES = ["HES7", "LFNG", "DLL3", "MESP2", "AXIN2", "DKK1",
              # Additional Notch/Wnt clock genes from source paper
              "HES1", "HES5", "NOTCH1", "NOTCH2", "DLL1",
              "WNT3A", "WNT5A", "FGF8", "DUSP4", "DUSP6",
              "SNAI1", "SNAI2", "TBX6", "RIPPLY2"]

DATA_PATH = Path("datasets/paper-r/GSE116929_Raw_Counts_matrix_S2.txt.gz")
OUT_DIR   = Path("paper-packages/paper-r-segmentation-clock/results")


def log2cpm_normalise(counts: pd.DataFrame) -> pd.DataFrame:
    """log2(CPM + 1) normalisation per sample."""
    lib_sizes = counts.sum(axis=0)
    cpm = counts.div(lib_sizes, axis=1) * 1e6
    return np.log2(cpm + 1)


def filter_low_count_genes(counts: pd.DataFrame, min_nonzero: float = 0.50) -> pd.DataFrame:
    """Remove genes with zero counts in > (1 - min_nonzero) fraction of samples."""
    n_samples = counts.shape[1]
    nonzero_counts = (counts > 0).sum(axis=1)
    keep = nonzero_counts >= (min_nonzero * n_samples)
    n_removed = (~keep).sum()
    print(f"  Filtering: {keep.sum()} genes pass (removed {n_removed} with <{min_nonzero*100:.0f}% nonzero samples)")
    return counts.loc[keep]


def fit_ar2(series: np.ndarray):
    """
    Fit AR(2) by OLS on mean-centred series.
    Returns (a1, a2, lambda_dominant, lambda_modulus, root_type, period_samples, r2)
    """
    y = series - series.mean()
    n = len(y)
    if n < 4:
        return None

    # Design matrix: Y = [y_2..y_{n-1}], X = [[y_1..y_{n-2}], [y_0..y_{n-3}]]
    Y = y[2:]
    X = np.column_stack([y[1:-1], y[:-2]])

    # OLS: coeffs = (X'X)^{-1} X'Y
    try:
        coeffs, _, _, _ = np.linalg.lstsq(X, Y, rcond=None)
    except np.linalg.LinAlgError:
        return None

    a1, a2 = coeffs

    # Characteristic polynomial: λ² - a1·λ - a2 = 0
    # Companion matrix [[a1, a2],[1, 0]], eigenvalues = roots
    companion = np.array([[a1, a2], [1.0, 0.0]])
    eigenvalues = np.linalg.eigvals(companion)

    # Dominant root = largest modulus
    moduli = np.abs(eigenvalues)
    dom_idx = np.argmax(moduli)
    lam = eigenvalues[dom_idx]
    lam_mod = moduli[dom_idx]

    # Root type
    is_complex = abs(np.imag(lam)) > 1e-10
    root_type = "complex" if is_complex else "real"

    # Period in sampling intervals (only meaningful for complex roots)
    if is_complex and lam_mod > 0:
        angle = np.arccos(np.clip(np.real(lam) / lam_mod, -1, 1))
        period_samples = 2 * np.pi / angle if angle > 0 else np.inf
    else:
        period_samples = np.nan

    # R² of AR(2) fit
    y_hat = X @ coeffs
    ss_res = np.sum((Y - y_hat) ** 2)
    ss_tot = np.sum((Y - Y.mean()) ** 2)
    r2 = 1.0 - ss_res / ss_tot if ss_tot > 0 else np.nan

    return a1, a2, lam, lam_mod, root_type, period_samples, r2


def fibonacci_proximity(lam_mod: float) -> float:
    """FP = max(0, 100 - |lam_mod - 0.618| / 0.618 * 100)"""
    return max(0.0, 100.0 - abs(lam_mod - FP_FIBONACCI) / FP_FIBONACCI * 100.0)


def classify_fp(fp: float) -> str:
    if fp >= FP_LIKE_THRESH:
        return "Fibonacci-like"
    elif fp >= FP_NEAR_THRESH:
        return "Near-Fibonacci"
    else:
        return "Non-Fibonacci"


def analyse_series(norm_expr: pd.DataFrame, series_name: str) -> pd.DataFrame:
    """Run AR(2) on every gene in a single series. Returns results DataFrame."""
    results = []
    for gene, row in norm_expr.iterrows():
        vals = row.values.astype(float)
        fit = fit_ar2(vals)
        if fit is None:
            continue
        a1, a2, lam, lam_mod, root_type, period_samples, r2 = fit
        period_h = period_samples * SAMPLING_INTERVAL_H if not np.isnan(period_samples) else np.nan
        fp = fibonacci_proximity(lam_mod)
        fp_class = classify_fp(fp)
        stationary = lam_mod < NONSTATIONARITY_THRESHOLD

        results.append({
            "gene": gene,
            "series": series_name,
            "a1": round(a1, 6),
            "a2": round(a2, 6),
            "lambda_mod": round(lam_mod, 6),
            "root_type": root_type,
            "period_samples": round(period_samples, 3) if not np.isnan(period_samples) else np.nan,
            "period_h": round(period_h, 3) if not np.isnan(period_h) else np.nan,
            "fibonacci_proximity": round(fp, 2),
            "fp_class": fp_class,
            "r2": round(r2, 4) if not np.isnan(r2) else np.nan,
            "stationary": stationary,
        })

    return pd.DataFrame(results)


def print_core_genes(results: pd.DataFrame, series: str):
    """Print a focused table for the core segmentation-clock genes."""
    core = results[results["gene"].isin(CORE_GENES)].copy()
    if core.empty:
        print(f"  [No core genes found in {series}]")
        return

    print(f"\n{'Gene':<10} {'|λ|':>7} {'Type':>8} {'Period(h)':>10} {'FP%':>7} {'Class':>15} {'R²':>6}")
    print("-" * 70)
    for _, r in core.sort_values("fibonacci_proximity", ascending=False).iterrows():
        ph = f"{r['period_h']:.2f}" if not pd.isna(r['period_h']) else "  n/a"
        print(f"{r['gene']:<10} {r['lambda_mod']:>7.4f} {r['root_type']:>8} {ph:>10} "
              f"{r['fibonacci_proximity']:>7.1f} {r['fp_class']:>15} {r['r2']:>6.3f}")


def main():
    print("=" * 65)
    print("  Paper R — AR(2) Analysis of Human Segmentation Clock")
    print("  Dataset : GSE116929 (Matsuda/Yamanaka et al. 2020)")
    print(f"  Interval: {SAMPLING_INTERVAL_MIN} min = {SAMPLING_INTERVAL_H:.4f} h")
    print("=" * 65)

    # ── Load raw counts ──────────────────────────────────────────
    print(f"\nLoading {DATA_PATH} ...")
    raw = pd.read_csv(DATA_PATH, sep="\t", index_col=0)
    print(f"  Raw matrix: {raw.shape[0]} genes × {raw.shape[1]} samples")
    print(f"  Columns: {list(raw.columns)}")

    # Split into two experimental series
    ex1_cols = [c for c in raw.columns if "ex1" in c]
    ex2_cols = [c for c in raw.columns if "ex2" in c]
    print(f"  Ex1: {len(ex1_cols)} samples, Ex2: {len(ex2_cols)} samples")

    # ── Filter ───────────────────────────────────────────────────
    print("\n[Ex1] Filtering low-count genes ...")
    ex1_raw = filter_low_count_genes(raw[ex1_cols])
    print("[Ex2] Filtering low-count genes ...")
    ex2_raw = filter_low_count_genes(raw[ex2_cols])

    # Keep union of genes passing in either series (genes analysable in at least one)
    passing_genes = ex1_raw.index.union(ex2_raw.index)
    print(f"  Union of passing genes: {len(passing_genes)}")

    # ── Normalise ─────────────────────────────────────────────────
    print("\nNormalising: log2(CPM+1) ...")
    ex1_norm = log2cpm_normalise(raw.loc[passing_genes.intersection(ex1_raw.index), ex1_cols])
    ex2_norm = log2cpm_normalise(raw.loc[passing_genes.intersection(ex2_raw.index), ex2_cols])
    print(f"  Ex1 normalised: {ex1_norm.shape}, Ex2 normalised: {ex2_norm.shape}")

    # ── AR(2) fitting ─────────────────────────────────────────────
    print("\nFitting AR(2) — Series 1 (Ex1) ...")
    res_ex1 = analyse_series(ex1_norm, "Ex1")
    print(f"  Fitted: {len(res_ex1)} genes")

    print("Fitting AR(2) — Series 2 (Ex2) ...")
    res_ex2 = analyse_series(ex2_norm, "Ex2")
    print(f"  Fitted: {len(res_ex2)} genes")

    # ── Core gene results ─────────────────────────────────────────
    print("\n" + "═" * 65)
    print("  CORE SEGMENTATION-CLOCK GENES — Ex1")
    print("═" * 65)
    print_core_genes(res_ex1, "Ex1")

    print("\n" + "═" * 65)
    print("  CORE SEGMENTATION-CLOCK GENES — Ex2")
    print("═" * 65)
    print_core_genes(res_ex2, "Ex2")

    # ── Within-species replication check ─────────────────────────
    print("\n" + "═" * 65)
    print("  WITHIN-SPECIES REPLICATION (Ex1 vs Ex2) — Core genes")
    print("═" * 65)
    merged = pd.merge(
        res_ex1[res_ex1["gene"].isin(CORE_GENES)][["gene", "lambda_mod", "root_type", "period_h", "fp_class"]],
        res_ex2[res_ex2["gene"].isin(CORE_GENES)][["gene", "lambda_mod", "root_type", "period_h", "fp_class"]],
        on="gene", suffixes=("_ex1", "_ex2")
    )
    print(f"\n{'Gene':<10} {'|λ|_ex1':>8} {'|λ|_ex2':>8} {'Match':>6} {'Th(h)_ex1':>10} {'Th(h)_ex2':>10}")
    print("-" * 60)
    for _, r in merged.iterrows():
        lam_match = "✓" if abs(r["lambda_mod_ex1"] - r["lambda_mod_ex2"]) < 0.1 else "✗"
        ph1 = f"{r['period_h_ex1']:.2f}" if not pd.isna(r['period_h_ex1']) else "  n/a"
        ph2 = f"{r['period_h_ex2']:.2f}" if not pd.isna(r['period_h_ex2']) else "  n/a"
        print(f"{r['gene']:<10} {r['lambda_mod_ex1']:>8.4f} {r['lambda_mod_ex2']:>8.4f} {lam_match:>6} {ph1:>10} {ph2:>10}")

    # ── Genome-wide summary ───────────────────────────────────────
    print("\n" + "═" * 65)
    print("  GENOME-WIDE SUMMARY")
    print("═" * 65)
    for label, res in [("Ex1", res_ex1), ("Ex2", res_ex2)]:
        stat = res[res["stationary"]]
        n_total = len(stat)
        n_complex = (stat["root_type"] == "complex").sum()
        n_fiblike = (stat["fp_class"] == "Fibonacci-like").sum()
        n_fibnear = (stat["fp_class"] == "Near-Fibonacci").sum()
        mean_lam = stat["lambda_mod"].mean()
        # Genes with period 3–8 h (segmentation clock range: expected ~5 h)
        clock_range = stat[stat["period_h"].between(3, 8)] if "period_h" in stat else pd.DataFrame()
        print(f"\n  {label} (n={n_total} stationary genes):")
        print(f"    Mean |λ|        : {mean_lam:.4f}")
        print(f"    Complex roots   : {n_complex} ({100*n_complex/n_total:.1f}%)")
        print(f"    Fibonacci-like  : {n_fiblike} ({100*n_fiblike/n_total:.1f}%)")
        print(f"    Near-Fibonacci  : {n_fibnear} ({100*n_fibnear/n_total:.1f}%)")
        print(f"    Period 3–8 h    : {len(clock_range)} genes with eigenperiod in segmentation-clock range")

    # ── Save results ──────────────────────────────────────────────
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    combined = pd.concat([res_ex1, res_ex2], ignore_index=True)
    out_path = OUT_DIR / "GSE116929_AR2_results.csv"
    combined.to_csv(out_path, index=False)
    print(f"\nResults saved: {out_path} ({len(combined)} rows)")

    # Save core genes separately for quick reference
    core_out = OUT_DIR / "GSE116929_core_genes.csv"
    combined[combined["gene"].isin(CORE_GENES)].to_csv(core_out, index=False)
    print(f"Core genes  : {core_out}")

    print("\n✓ Human discovery analysis complete.")
    print("  Next: review results, lock thresholds, then unlock mouse (GSE132811).")


if __name__ == "__main__":
    main()
