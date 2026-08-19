#!/usr/bin/env python3
"""
Paper R — Mouse Benchmark: AR(2) vs Cosinor vs Lag-1 Autocorrelation (GSE132811)
==================================================================================
Analogue of scripts/run_paper_r_benchmark.py for the mouse PSM time-series dataset.

For each gene in mouse Ex4 / Ex5 normalised data:
  1. Cosinor regression at each period T ∈ 3–8 h (step 0.5 h)
     → R², amplitude, p-value (F-test, 2 df)
  2. Lag-1 Pearson autocorrelation
  3. Cross-correlation with Hes7 at lags −3 to +3 samples
  4. AR(2) Fibonacci-like classification pulled from GSE132811_AR2_results.csv

Outputs (one file per series):
  results/GSE132811_benchmark_Ex4.csv   — per-gene comparison table
  results/GSE132811_benchmark_Ex5.csv   — per-gene comparison table
  results/GSE132811_benchmark_summary.txt — printed summary matching §3.6

Sampling interval: 15 min (GEO-confirmed for GSE132811).
"""

import sys
import os
import numpy as np
import pandas as pd
from pathlib import Path
from datetime import date
from scipy import stats

# ── Constants ────────────────────────────────────────────────────────────────
SAMPLING_INTERVAL_MIN = 15.0
SAMPLING_INTERVAL_H   = SAMPLING_INTERVAL_MIN / 60.0
MIN_NONZERO_FRACTION  = 0.50
FP_LIKE_THRESH        = 85.0          # Fibonacci-like threshold (same as human)
COSINOR_P_THRESH      = 0.05          # significance threshold for cosinor
HES7_MOUSE_GENE       = "Hes7"

# Period sweep: 3 h to 8 h in 0.5 h steps (identical to human benchmark)
PERIODS_H = np.arange(3.0, 8.5, 0.5)   # [3.0, 3.5, 4.0, …, 8.0]

DATA_PATH = Path("datasets/paper-r/GSE132811_Raw_Counts_matrix_S5.txt.gz")
AR2_CSV   = Path("paper-packages/paper-r-segmentation-clock/results/GSE132811_AR2_results.csv")
OUT_DIR   = Path("paper-packages/paper-r-segmentation-clock/results")


# ── Helper functions (identical logic to human benchmark) ────────────────────

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
    ss_res = np.sum((y - y_hat) ** 2)
    ss_tot = np.sum((y - y.mean()) ** 2)
    r2 = 1 - ss_res / ss_tot if ss_tot > 1e-10 else 0.0
    amplitude = np.sqrt(A ** 2 + B ** 2)
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


def process_series(series_label: str, norm: pd.DataFrame, ar2_series: pd.DataFrame,
                   t_min: np.ndarray, hes7_ts) -> pd.DataFrame:
    """Run benchmark for one series (Ex4 or Ex5). Returns per-gene DataFrame."""
    print(f"\nRunning benchmark for {series_label}: {len(norm)} genes × {norm.shape[1]} timepoints …")
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

        # Hes7 cross-correlation
        xcorr_hes7 = cross_corr_with_ref(y, hes7_ts) if hes7_ts is not None else np.nan

        # AR(2) values from existing results
        if gene in ar2_series.index:
            lam = ar2_series.loc[gene, "lambda_mod"]
            fp_class = ar2_series.loc[gene, "fp_class"]
            fib_like = (fp_class == "Fibonacci-like")
            root_type = ar2_series.loc[gene, "root_type"]
            stationary = bool(ar2_series.loc[gene, "stationary"])
        else:
            lam, fp_class, fib_like, root_type, stationary = np.nan, "", False, "", False

        rows.append({
            "gene": gene,
            "lambda_mod": round(float(lam), 4) if not (isinstance(lam, float) and np.isnan(lam)) else np.nan,
            "fp_class": fp_class,
            "fib_like": fib_like,
            "root_type": root_type,
            "stationary": stationary,
            "cosinor_best_p": round(best_p, 4),
            "cosinor_best_r2": round(best_r2, 4),
            "cosinor_best_period_h": best_period,
            "cosinor_sig": best_p < COSINOR_P_THRESH,
            "lag1_r": round(r1, 4),
            "xcorr_hes7": round(xcorr_hes7, 4) if not np.isnan(xcorr_hes7) else np.nan,
        })

    return pd.DataFrame(rows)


def print_series_summary(series_label: str, df: pd.DataFrame) -> str:
    """Return a formatted summary string for one series."""
    ar2_valid = df["lambda_mod"].notna()
    df_v = df[ar2_valid].copy()

    # §3.6 claims are computed over stationary genes only
    df_stat = df_v[df_v["stationary"] == True] if "stationary" in df_v.columns else df_v
    n_stat = len(df_stat)

    fib_genes   = df_stat[df_stat["fib_like"] == True]
    cos_genes   = df_stat[df_stat["cosinor_sig"] == True]
    both_genes  = df_stat[(df_stat["fib_like"] == True) & (df_stat["cosinor_sig"] == True)]

    rho_lam_r2, p_lam_r2 = stats.spearmanr(df_stat["lambda_mod"], df_stat["cosinor_best_r2"])
    rho_lam_r1, p_lam_r1 = stats.spearmanr(df_stat["lambda_mod"], df_stat["lag1_r"])

    fib_frac = len(fib_genes) / n_stat if n_stat > 0 else 0.0
    mean_lam = df_stat["lambda_mod"].mean()

    out = f"""
====================================================================
PAPER R — MOUSE BENCHMARK  (GSE132811, {series_label})
====================================================================

Sampling interval : {SAMPLING_INTERVAL_MIN:.0f} min ({SAMPLING_INTERVAL_H:.4f} h)
Cosinor periods   : {min(PERIODS_H):.1f}–{max(PERIODS_H):.1f} h (step 0.5 h); best p per gene
Significance      : p < {COSINOR_P_THRESH} (F-test, 2 df for cos+sin terms)
AR(2) gate        : Fibonacci-like (FP ≥ {FP_LIKE_THRESH}%)
Total genes       : {len(df_v)}  (stationary: {n_stat})

── Key §3.6 claims (stationary genes) ──────────────────────────────
  Fibonacci-like fraction  : {len(fib_genes):6,} / {n_stat} = {fib_frac:.3f} ({fib_frac:.1%})
  Mean |λ| (stationary)    : {mean_lam:.4f}

── Detection overlap (stationary) ──────────────────────────────────
  AR(2) Fibonacci-like              : {len(fib_genes):6,} genes ({len(fib_genes)/n_stat:.1%})
  Cosinor-detected (p < {COSINOR_P_THRESH})        : {len(cos_genes):6,} genes ({len(cos_genes)/n_stat:.1%})
  Both AR(2) Fib-like AND cosinor   : {len(both_genes):6,} genes ({len(both_genes)/n_stat:.1%})

── Spearman correlations (stationary) ──────────────────────────────
  ρ(|λ|, cosinor R²)  = {rho_lam_r2:+.3f}  (p = {p_lam_r2:.2e})
  ρ(|λ|, lag-1 r₁)   = {rho_lam_r1:+.3f}  (p = {p_lam_r1:.2e})
"""
    # Core mouse gene spotlight
    core = ["Hes7", "Axin2", "Lfng", "Dll3", "Mesp2"]
    out += "\n── Core gene spotlight ──────────────────────────────────────────\n"
    for gene in core:
        row = df_v[df_v["gene"] == gene]
        if row.empty:
            continue
        r = row.iloc[0]
        lam_str = f"{r['lambda_mod']:.3f}" if pd.notna(r['lambda_mod']) else "n/a"
        out += (f"  {gene:<8}  |λ|={lam_str}  {str(r['fp_class']):<16}  "
                f"cosinor p={r['cosinor_best_p']:.3f}  "
                f"(T={r['cosinor_best_period_h']:.1f}h)  "
                f"lag-1 r={r['lag1_r']:.3f}\n")
    out += "====================================================================\n"
    return out


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    print("Loading AR(2) results …")
    ar2 = pd.read_csv(AR2_CSV)

    print(f"Loading raw counts: {DATA_PATH}")
    raw = pd.read_csv(DATA_PATH, sep="\t", index_col=0)

    all_summary = ""

    for series_label in ("Ex4", "Ex5"):
        sl = series_label.lower()   # "ex4" / "ex5"
        cols = sorted([c for c in raw.columns if f"_{sl}" in c.lower()])
        if not cols:
            print(f"ERROR: no columns found for {series_label} in {DATA_PATH}", file=sys.stderr)
            sys.exit(1)

        counts = raw[cols].copy()
        filtered = filter_low_count_genes(counts)
        norm = log2cpm_normalise(filtered)
        norm = norm.sub(norm.mean(axis=1), axis=0)   # mean-centre
        print(f"  {series_label} normalised: {norm.shape[0]} genes × {norm.shape[1]} timepoints")

        # Timepoints in minutes (15-min intervals)
        n_tp = norm.shape[1]
        t_min = np.arange(n_tp) * SAMPLING_INTERVAL_MIN

        # Hes7 reference series for cross-correlation
        if HES7_MOUSE_GENE in norm.index:
            hes7_ts = norm.loc[HES7_MOUSE_GENE].values.astype(float)
        else:
            print(f"WARNING: {HES7_MOUSE_GENE} not in normalised {series_label} data; "
                  "skipping cross-correlation")
            hes7_ts = None

        # AR(2) lookup for this series
        ar2_series = ar2[ar2["series"] == series_label].set_index("gene")

        df = process_series(series_label, norm, ar2_series, t_min, hes7_ts)

        out_csv = OUT_DIR / f"GSE132811_benchmark_{series_label}.csv"
        df.to_csv(out_csv, index=False)
        print(f"✓ {series_label} benchmark written to {out_csv}")

        summary = print_series_summary(series_label, df)
        print(summary)
        all_summary += summary

    summary_path = OUT_DIR / "GSE132811_benchmark_summary.txt"
    with open(summary_path, "w") as f:
        f.write(all_summary)
    print(f"✓ Summary written to {summary_path}")


if __name__ == "__main__":
    main()
