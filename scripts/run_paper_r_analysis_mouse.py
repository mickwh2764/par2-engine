#!/usr/bin/env python3
"""
Paper R — Segmentation Clock AR(2) Analysis — MOUSE REPLICATION
================================================================
Dataset: GSE132811 (mouse EpiSC PSM, 2 × 16 timepoints: Ex4, Ex5)
Sampling interval: ~15 min (confirmed from GEO metadata)
Normalisation: log2(CPM+1), >50% nonzero filter, mean-centred per gene
Gate: |Δλ| ≤ 0.10 and matching root type (same as human)

IMPORTANT: Run AFTER human analysis is finalized (run_paper_r_analysis.py).
Mouse results were locked 2026-08-11.
"""

import sys
import os
import numpy as np
import pandas as pd
from pathlib import Path
from scipy import linalg

# ── Constants ────────────────────────────────────────────────────────────────
SAMPLING_INTERVAL_MIN = 15.0          # confirmed from GEO metadata
SAMPLING_INTERVAL_H   = SAMPLING_INTERVAL_MIN / 60.0
MIN_NONZERO_FRACTION  = 0.50
NONSTATIONARITY_THRESHOLD = 1.0
FP_FIBONACCI   = 0.618
FP_LIKE_THRESH = 85.0
FP_NEAR_THRESH = 50.0

# Mouse gene symbols (title-case)
CORE_GENES = ["Hes7", "Lfng", "Dll3", "Mesp2", "Axin2", "Dkk1",
              "Hes1", "Hes5", "Notch1", "Notch2", "Dll1",
              "Wnt3a", "Wnt5a", "Fgf8", "Dusp4", "Dusp6",
              "Snai1", "Snai2", "Tbx6", "Ripply2"]

DATA_PATH = Path("datasets/paper-r/GSE132811_Raw_Counts_matrix_S5.txt.gz")
OUT_DIR   = Path("paper-packages/paper-r-segmentation-clock/results")
OUT_CSV   = OUT_DIR / "GSE132811_AR2_results.csv"


def log2cpm_normalise(counts: pd.DataFrame) -> pd.DataFrame:
    lib_sizes = counts.sum(axis=0)
    cpm = counts.div(lib_sizes, axis=1) * 1e6
    return np.log2(cpm + 1)


def filter_low_count_genes(counts: pd.DataFrame,
                            min_nonzero: float = 0.50) -> pd.DataFrame:
    nonzero_counts = (counts > 0).sum(axis=1)
    keep = nonzero_counts >= (min_nonzero * counts.shape[1])
    print(f"  Filtering: {keep.sum()} genes pass "
          f"(removed {(~keep).sum()} with <{min_nonzero*100:.0f}% nonzero samples)")
    return counts.loc[keep]


def fit_ar2(series: np.ndarray):
    """OLS AR(2) fit. Returns (a1, a2, lambda_mod, root_type, period_samples, r2)."""
    y = series - series.mean()
    n = len(y)
    if n < 4:
        return None
    Y = y[2:]
    X = np.column_stack([y[1:-1], y[:-2]])
    try:
        coeffs, _, _, _ = np.linalg.lstsq(X, Y, rcond=None)
    except np.linalg.LinAlgError:
        return None
    a1, a2 = coeffs
    disc = a1**2 + 4 * a2
    if disc < 0:
        lam_mod = np.sqrt(-a2)
        root_type = "complex"
        cos_theta = (a1 / 2) / lam_mod if lam_mod > 1e-10 else 0
        cos_theta = np.clip(cos_theta, -1, 1)
        theta = np.arccos(cos_theta)
        period_samples = (2 * np.pi / theta) if theta > 1e-10 else np.nan
    else:
        roots = np.roots([1, -a1, -a2])
        lam_mod = max(abs(roots))
        root_type = "real"
        period_samples = np.nan
    Y_hat = X @ coeffs
    ss_res = np.sum((Y - Y_hat)**2)
    ss_tot = np.sum((Y - Y.mean())**2)
    r2 = 1 - ss_res / ss_tot if ss_tot > 1e-10 else 0.0
    return a1, a2, lam_mod, root_type, period_samples, r2


def fp_score(lam: float, ref: float = FP_FIBONACCI) -> float:
    return max(0.0, 100.0 * (1.0 - abs(lam - ref) / ref))


def classify_fp(fp: float) -> str:
    if fp >= FP_LIKE_THRESH:
        return "Fibonacci-like"
    elif fp >= FP_NEAR_THRESH:
        return "Near-Fibonacci"
    return "Non-Fibonacci"


def run_series(norm_data: pd.DataFrame, series_label: str) -> pd.DataFrame:
    """Fit AR(2) for every gene in one series. Returns results DataFrame."""
    rows = []
    genes = norm_data.index.tolist()
    for gene in genes:
        ts = norm_data.loc[gene].values.astype(float)
        res = fit_ar2(ts)
        if res is None:
            continue
        a1, a2, lam_mod, root_type, period_s, r2 = res
        stationary = lam_mod < NONSTATIONARITY_THRESHOLD
        period_h = (period_s * SAMPLING_INTERVAL_H) if not np.isnan(period_s) else np.nan
        fp = fp_score(lam_mod)
        rows.append({
            "gene": gene,
            "series": series_label,
            "a1": round(a1, 6),
            "a2": round(a2, 6),
            "lambda_mod": round(lam_mod, 6),
            "root_type": root_type,
            "period_samples": round(period_s, 3) if not np.isnan(period_s) else "",
            "period_h": round(period_h, 3) if not np.isnan(period_h) else "",
            "fibonacci_proximity": round(fp, 2),
            "fp_class": classify_fp(fp),
            "r2": round(r2, 4),
            "stationary": stationary,
        })
    return pd.DataFrame(rows)


def print_core_gene_table(df: pd.DataFrame, series: str):
    sub = df[df["series"] == series]
    print(f"\n  {'Gene':<12} {'|λ|':>6}  {'Root':>8}  {'Period(h)':>10}  {'FP%':>7}  {'FP Class'}")
    print(f"  {'-'*12} {'-'*6}  {'-'*8}  {'-'*10}  {'-'*7}  {'-'*14}")
    for gene in CORE_GENES:
        row = sub[sub["gene"] == gene]
        if row.empty:
            continue
        r = row.iloc[0]
        ph = f"{r['period_h']:.2f}" if r["period_h"] != "" else "—"
        print(f"  {gene:<12} {r['lambda_mod']:>6.3f}  {r['root_type']:>8}  "
              f"{ph:>10}  {r['fibonacci_proximity']:>7.1f}  {r['fp_class']}")


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    print(f"Loading mouse dataset: {DATA_PATH}")
    if not DATA_PATH.exists():
        print(f"ERROR: dataset not found at {DATA_PATH}")
        sys.exit(1)

    raw = pd.read_csv(DATA_PATH, sep="\t", index_col=0)
    print(f"  Raw dimensions: {raw.shape[0]} genes × {raw.shape[1]} samples")

    # Identify series columns: oscillation_XX_ex4 / oscillation_XX_ex5
    ex4_cols = sorted([c for c in raw.columns if "_ex4" in c.lower()])
    ex5_cols = sorted([c for c in raw.columns if "_ex5" in c.lower()])
    print(f"  Ex4 columns ({len(ex4_cols)}): {ex4_cols[0]} … {ex4_cols[-1]}")
    print(f"  Ex5 columns ({len(ex5_cols)}): {ex5_cols[0]} … {ex5_cols[-1]}")

    all_results = []
    for cols, label in [(ex4_cols, "Ex4"), (ex5_cols, "Ex5")]:
        print(f"\n── Series {label} ──")
        counts = raw[cols].copy()
        filtered = filter_low_count_genes(counts)
        norm = log2cpm_normalise(filtered)
        # Mean-centre per gene
        norm = norm.sub(norm.mean(axis=1), axis=0)
        print(f"  Running AR(2) on {len(norm)} genes …")
        df = run_series(norm, label)
        stationary = df[df["stationary"] == True]
        fib_frac = (stationary["fp_class"] == "Fibonacci-like").mean()
        print(f"  Stationary: {len(stationary)}  |  Fibonacci-like: {fib_frac:.1%}  "
              f"|  Mean |λ|: {stationary['lambda_mod'].mean():.3f}")
        print_core_gene_table(df, label)
        all_results.append(df)

    combined = pd.concat(all_results, ignore_index=True)
    combined.to_csv(OUT_CSV, index=False)
    print(f"\n✓ Results written to {OUT_CSV} ({len(combined)} rows)")

    # Within-mouse reproducibility gate
    print("\n── Within-mouse reproducibility gate (|Δλ| ≤ 0.10, same root type) ──")
    ex4 = combined[combined["series"] == "Ex4"].set_index("gene")
    ex5 = combined[combined["series"] == "Ex5"].set_index("gene")
    shared = ex4.index.intersection(ex5.index)
    gate_pass = []
    for gene in CORE_GENES:
        if gene not in shared:
            continue
        lam4 = ex4.loc[gene, "lambda_mod"]
        lam5 = ex5.loc[gene, "lambda_mod"]
        rt4  = ex4.loc[gene, "root_type"]
        rt5  = ex5.loc[gene, "root_type"]
        delta = abs(lam4 - lam5)
        ok = (delta <= 0.10) and (rt4 == rt5)
        status = "✓ PASS" if ok else "✗ FAIL"
        print(f"  {status}  {gene:<12}  |λ| Ex4={lam4:.3f}  Ex5={lam5:.3f}  "
              f"|Δλ|={delta:.3f}  root: {rt4}/{rt5}")
        if ok:
            gate_pass.append(gene)

    print(f"\nGate passing: {gate_pass}")
    print("Done.")


if __name__ == "__main__":
    main()
