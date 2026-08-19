#!/usr/bin/env python3
"""
Paper R — Benchmark Comparison: AR(2) vs Cosinor vs Lag-1 Autocorrelation
===========================================================================
Pre-specified in analysis_plan.md §6.

For each gene in human Ex1 normalised data:
  1. Cosinor regression at each period T ∈ 3–8 h range (step 0.5 h)
     → R², amplitude, p-value (F-test, 2 df)
  2. Lag-1 Pearson autocorrelation
  3. Cross-correlation with HES7 at lags −3 to +3 samples
  4. Compare to AR(2) Fibonacci-like classification from GSE116929_AR2_results.csv

Outputs:
  results/GSE116929_benchmark_Ex1.csv   — per-gene comparison table
  results/GSE116929_benchmark_summary.txt — printed summary matching §3.5
"""

import sys
import os
import json
import numpy as np
import pandas as pd
from pathlib import Path
from datetime import date
from scipy import stats

# ── Constants ────────────────────────────────────────────────────────────────
SAMPLING_INTERVAL_MIN = 43.0
SAMPLING_INTERVAL_H   = SAMPLING_INTERVAL_MIN / 60.0
MIN_NONZERO_FRACTION  = 0.50
FP_FIBONACCI = 0.618
FP_LIKE_THRESH = 85.0          # Fibonacci-like threshold
COSINOR_P_THRESH = 0.05        # significance threshold for cosinor
HES7_GENE = "HES7"

# Period sweep: 3 h to 8 h in 0.5 h steps
PERIODS_H = np.arange(3.0, 8.5, 0.5)   # [3.0, 3.5, 4.0, …, 8.0]

DATA_PATH = Path("datasets/paper-r/GSE116929_Raw_Counts_matrix_S2.txt.gz")
AR2_CSV   = Path("paper-packages/paper-r-segmentation-clock/results/GSE116929_AR2_results.csv")
OUT_DIR   = Path("paper-packages/paper-r-segmentation-clock/results")


def log2cpm_normalise(counts: pd.DataFrame) -> pd.DataFrame:
    lib_sizes = counts.sum(axis=0)
    cpm = counts.div(lib_sizes, axis=1) * 1e6
    return np.log2(cpm + 1)


def filter_low_count_genes(counts: pd.DataFrame) -> pd.DataFrame:
    nonzero_counts = (counts > 0).sum(axis=1)
    keep = nonzero_counts >= (MIN_NONZERO_FRACTION * counts.shape[1])
    return counts.loc[keep]


def cosinor_fit(y: np.ndarray, t_min: np.ndarray, period_h: float):
    """
    Fit cosinor model: y(t) = A·cos(2πt/T) + B·sin(2πt/T) + C
    Returns (R2, amplitude, phase_h, p_value).
    p-value from F-test for the cos+sin terms (2 df).
    """
    T_min = period_h * 60.0
    cos_t = np.cos(2 * np.pi * t_min / T_min)
    sin_t = np.sin(2 * np.pi * t_min / T_min)
    X = np.column_stack([cos_t, sin_t, np.ones(len(y))])
    n = len(y)
    try:
        coeffs, res, rank, sv = np.linalg.lstsq(X, y, rcond=None)
    except np.linalg.LinAlgError:
        return np.nan, np.nan, np.nan, np.nan
    A, B, C = coeffs
    y_hat = X @ coeffs
    ss_res = np.sum((y - y_hat)**2)
    ss_tot = np.sum((y - y.mean())**2)
    r2 = 1 - ss_res / ss_tot if ss_tot > 1e-10 else 0.0
    amplitude = np.sqrt(A**2 + B**2)
    phase_rad = np.arctan2(-B, A)
    phase_h = (phase_rad / (2 * np.pi)) * period_h
    # F-test: H0: A=B=0; df1=2, df2=n-3
    df1, df2 = 2, n - 3
    if df2 <= 0 or ss_res < 1e-12:
        p_value = np.nan
    else:
        ss_reg = ss_tot - ss_res
        F = (ss_reg / df1) / (ss_res / df2)
        p_value = 1 - stats.f.cdf(F, df1, df2)
    return r2, amplitude, phase_h, p_value


def lag1_autocorr(y: np.ndarray) -> float:
    """Lag-1 Pearson autocorrelation."""
    if len(y) < 3:
        return np.nan
    return float(np.corrcoef(y[:-1], y[1:])[0, 1])


def cross_corr_with_ref(y: np.ndarray, ref: np.ndarray, max_lag: int = 3) -> float:
    """Max absolute cross-correlation with ref at lags −max_lag to +max_lag."""
    n = len(y)
    best = 0.0
    for lag in range(-max_lag, max_lag + 1):
        if lag >= 0:
            a, b = y[:n - lag], ref[lag:]
        else:
            a, b = y[-lag:], ref[:n + lag]
        if len(a) < 4:
            continue
        r = np.corrcoef(a, b)[0, 1]
        if not np.isnan(r) and abs(r) > abs(best):
            best = r
    return float(best)


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    print("Loading AR(2) results …")
    ar2 = pd.read_csv(AR2_CSV)
    ar2_ex1 = ar2[ar2["series"] == "Ex1"].set_index("gene")

    print(f"Loading raw counts: {DATA_PATH}")
    raw = pd.read_csv(DATA_PATH, sep="\t", index_col=0)
    ex1_cols = sorted([c for c in raw.columns if "_ex1" in c.lower()])
    counts = raw[ex1_cols].copy()
    filtered = filter_low_count_genes(counts)
    norm = log2cpm_normalise(filtered)
    norm = norm.sub(norm.mean(axis=1), axis=0)   # mean-centre
    print(f"  Normalised: {norm.shape[0]} genes × {norm.shape[1]} timepoints")

    # Timepoints in minutes
    n_tp = norm.shape[1]
    t_min = np.arange(n_tp) * SAMPLING_INTERVAL_MIN

    # Get HES7 reference series
    if HES7_GENE not in norm.index:
        print(f"WARNING: {HES7_GENE} not in normalised data; skipping cross-correlation")
        hes7_ts = None
    else:
        hes7_ts = norm.loc[HES7_GENE].values.astype(float)

    print(f"Running benchmark for {len(norm)} genes "
          f"(cosinor at {len(PERIODS_H)} periods × lag-1 × HES7 xcorr) …")

    rows = []
    genes = norm.index.tolist()
    for i, gene in enumerate(genes):
        if i % 2000 == 0:
            print(f"  {i}/{len(genes)} …")
        y = norm.loc[gene].values.astype(float)

        # Best cosinor over period sweep
        best_r2, best_amp, best_phase, best_p, best_period = 0, np.nan, np.nan, 1.0, np.nan
        for period_h in PERIODS_H:
            r2, amp, phase, p = cosinor_fit(y, t_min, period_h)
            if not np.isnan(p) and p < best_p:
                best_p = p
                best_r2 = r2
                best_amp = amp
                best_phase = phase
                best_period = period_h

        # Lag-1 autocorrelation
        r1 = lag1_autocorr(y)

        # HES7 cross-correlation
        xcorr_hes7 = cross_corr_with_ref(y, hes7_ts) if hes7_ts is not None else np.nan

        # AR(2) values from existing results
        if gene in ar2_ex1.index:
            lam = ar2_ex1.loc[gene, "lambda_mod"]
            fp_class = ar2_ex1.loc[gene, "fp_class"]
            fib_like = (fp_class == "Fibonacci-like")
            root_type = ar2_ex1.loc[gene, "root_type"]
        else:
            lam, fp_class, fib_like, root_type = np.nan, "", False, ""

        rows.append({
            "gene": gene,
            "lambda_mod": round(lam, 4) if not np.isnan(lam) else "",
            "fp_class": fp_class,
            "fib_like": fib_like,
            "root_type": root_type,
            "cosinor_best_p": round(best_p, 4),
            "cosinor_best_r2": round(best_r2, 4),
            "cosinor_best_period_h": best_period,
            "cosinor_sig": best_p < COSINOR_P_THRESH,
            "lag1_r": round(r1, 4),
            "xcorr_hes7": round(xcorr_hes7, 4) if not np.isnan(xcorr_hes7) else "",
        })

    df = pd.DataFrame(rows)
    out_csv = OUT_DIR / "GSE116929_benchmark_Ex1.csv"
    df.to_csv(out_csv, index=False)
    print(f"\n✓ Per-gene benchmark written to {out_csv}")

    # ── Write manifest recording the parameters that produced this CSV ─────────
    manifest = {
        "description": "Generation parameters for GSE116929_benchmark_Ex1.csv (§3.5 benchmark)",
        "dataset": "GSE116929",
        "series": "Ex1",
        "period_grid_min_h": float(PERIODS_H[0]),
        "period_grid_max_h": float(PERIODS_H[-1]),
        "period_grid_step_h": round(float(PERIODS_H[1] - PERIODS_H[0]), 6),
        "significance_threshold_p": COSINOR_P_THRESH,
        "gene_count": len(df),
        "generation_date": date.today().isoformat(),
    }
    manifest_path = OUT_DIR / "GSE116929_benchmark_Ex1.manifest.json"
    with open(manifest_path, "w") as mf:
        json.dump(manifest, mf, indent=2)
    print(f"✓ Manifest written to {manifest_path}")

    # ── Summary statistics ────────────────────────────────────────────────────
    ar2_valid = df["lambda_mod"].apply(lambda x: x != "").astype(bool)
    df_v = df[ar2_valid].copy()
    df_v["lambda_mod"] = df_v["lambda_mod"].astype(float)

    fib_genes   = df_v[df_v["fib_like"] == True]
    cos_genes   = df_v[df_v["cosinor_sig"] == True]
    both_genes  = df_v[(df_v["fib_like"] == True) & (df_v["cosinor_sig"] == True)]
    ar2_only    = df_v[(df_v["fib_like"] == True) & (df_v["cosinor_sig"] == False)]
    cos_only    = df_v[(df_v["fib_like"] == False) & (df_v["cosinor_sig"] == True)]

    # Spearman correlations
    rho_lam_r2, p_lam_r2 = stats.spearmanr(df_v["lambda_mod"], df_v["cosinor_best_r2"])
    rho_lam_r1, p_lam_r1 = stats.spearmanr(df_v["lambda_mod"], df_v["lag1_r"])

    summary = f"""
====================================================================
PAPER R — BENCHMARK COMPARISON SUMMARY  (Human GSE116929, Ex1)
====================================================================

Normalisation  : log2(CPM+1), >50% nonzero filter, mean-centred
Cosinor periods: {min(PERIODS_H):.1f}–{max(PERIODS_H):.1f} h (step 0.5 h); best p per gene
Significance   : p < {COSINOR_P_THRESH} (F-test, 2 df for cos+sin terms)
AR(2) gate     : Fibonacci-like (FP ≥ {FP_LIKE_THRESH}%)
Total genes    : {len(df_v)}

── Detection overlap ──────────────────────────────────────────────

  AR(2) Fibonacci-like              : {len(fib_genes):6,} genes ({len(fib_genes)/len(df_v):.1%})
  Cosinor-detected (p < {COSINOR_P_THRESH})        : {len(cos_genes):6,} genes ({len(cos_genes)/len(df_v):.1%})
  Both AR(2) Fib-like AND cosinor   : {len(both_genes):6,} genes ({len(both_genes)/len(df_v):.1%})
  AR(2)-only (Fib-like, not cosinor): {len(ar2_only):6,} genes ({len(ar2_only)/len(df_v):.1%})
  Cosinor-only (not Fib-like)       : {len(cos_only):6,} genes ({len(cos_only)/len(df_v):.1%})

  Fraction of Fib-like genes also cosinor-detected : {len(both_genes)/max(1,len(fib_genes)):.1%}
  Fraction of cosinor genes also Fib-like          : {len(both_genes)/max(1,len(cos_genes)):.1%}

── Spearman correlations ─────────────────────────────────────────

  ρ(|λ|, cosinor R²)  = {rho_lam_r2:+.3f}  (p = {p_lam_r2:.2e})
  ρ(|λ|, lag-1 r₁)   = {rho_lam_r1:+.3f}  (p = {p_lam_r1:.2e})

── Core gene spotlight ────────────────────────────────────────────
"""
    core = ["HES7", "LFNG", "AXIN2", "DLL3", "MESP2", "DKK1"]
    for gene in core:
        row = df_v[df_v["gene"] == gene]
        if row.empty:
            continue
        r = row.iloc[0]
        summary += (f"  {gene:<8}  |λ|={r['lambda_mod']:.3f}  {r['fp_class']:<16}  "
                    f"cosinor p={r['cosinor_best_p']:.3f}  "
                    f"(T={r['cosinor_best_period_h']:.1f}h)  "
                    f"lag-1 r={r['lag1_r']:.3f}  "
                    f"HES7 xcorr={r['xcorr_hes7']}\n")

    summary += "====================================================================\n"

    summary_path = OUT_DIR / "GSE116929_benchmark_summary.txt"
    with open(summary_path, "w") as f:
        f.write(summary)
    print(summary)
    print(f"✓ Summary written to {summary_path}")


if __name__ == "__main__":
    main()
