#!/usr/bin/env python3
"""
Paper R — Bootstrap confidence intervals for AR(2) |λ|
=======================================================
Pre-specified in analysis_plan.md §8: N=1,000 bootstrap resamples of the time series.
Focal genes: HES7 + all genes passing the reproducibility gate.
"""

import numpy as np
import pandas as pd
from pathlib import Path

SAMPLING_INTERVAL_MIN = 43.0
SAMPLING_INTERVAL_H   = SAMPLING_INTERVAL_MIN / 60.0
N_BOOTSTRAP = 1000
RNG_SEED    = 42

DATA_PATH = Path("datasets/paper-r/GSE116929_Raw_Counts_matrix_S2.txt.gz")
OUT_DIR   = Path("paper-packages/paper-r-segmentation-clock/results")

# Genes that passed the reproducibility gate
GATE_GENES = ["HES7", "AXIN2", "DKK1", "DUSP4", "DUSP6", "HES5",
              "RIPPLY2", "SNAI2", "WNT5A", "LFNG"]  # LFNG borderline — include for reporting


def log2cpm_normalise(counts):
    lib_sizes = counts.sum(axis=0)
    cpm = counts.div(lib_sizes, axis=1) * 1e6
    return np.log2(cpm + 1)


def fit_ar2_lambda(series: np.ndarray):
    """Return dominant |λ| from AR(2) OLS fit, or NaN on failure."""
    y = series - series.mean()
    n = len(y)
    if n < 4:
        return np.nan
    Y = y[2:]
    X = np.column_stack([y[1:-1], y[:-2]])
    try:
        coeffs, _, _, _ = np.linalg.lstsq(X, Y, rcond=None)
    except Exception:
        return np.nan
    a1, a2 = coeffs
    companion = np.array([[a1, a2], [1.0, 0.0]])
    eigs = np.linalg.eigvals(companion)
    return float(np.max(np.abs(eigs)))


def bootstrap_lambda(series: np.ndarray, n_boot: int = N_BOOTSTRAP, seed: int = RNG_SEED):
    """
    Block bootstrap (block size 3) of a time series, return array of |λ| estimates.
    Block bootstrap preserves short-range temporal autocorrelation.
    """
    rng = np.random.default_rng(seed)
    n = len(series)
    block_size = 3
    n_blocks = int(np.ceil(n / block_size))
    boot_lambdas = []
    for _ in range(n_boot):
        # Sample blocks with replacement
        starts = rng.integers(0, n - block_size + 1, size=n_blocks)
        boot_series = np.concatenate([series[s:s + block_size] for s in starts])[:n]
        lam = fit_ar2_lambda(boot_series)
        if not np.isnan(lam):
            boot_lambdas.append(lam)
    return np.array(boot_lambdas)


def main():
    print("=" * 60)
    print("  Paper R — Bootstrap CIs for AR(2) |λ|")
    print(f"  N bootstrap = {N_BOOTSTRAP}, block size = 3, seed = {RNG_SEED}")
    print("=" * 60)

    # Load and normalise
    raw = pd.read_csv(DATA_PATH, sep="\t", index_col=0)
    ex1_cols = [c for c in raw.columns if "ex1" in c]
    ex2_cols = [c for c in raw.columns if "ex2" in c]
    ex1_norm = log2cpm_normalise(raw[ex1_cols])
    ex2_norm = log2cpm_normalise(raw[ex2_cols])

    results = []
    print(f"\n{'Gene':<10} {'Series':<6} {'|λ|':>7} {'CI_lo':>7} {'CI_hi':>7} {'n_boot':>7}")
    print("-" * 50)

    for gene in GATE_GENES:
        for label, norm in [("Ex1", ex1_norm), ("Ex2", ex2_norm)]:
            if gene not in norm.index:
                print(f"{gene:<10} {label:<6}  [not in dataset]")
                continue
            series = norm.loc[gene].values.astype(float)
            obs_lam = fit_ar2_lambda(series)
            boot = bootstrap_lambda(series)
            ci_lo = float(np.percentile(boot, 2.5))
            ci_hi = float(np.percentile(boot, 97.5))
            n_valid = len(boot)
            print(f"{gene:<10} {label:<6} {obs_lam:>7.4f} {ci_lo:>7.4f} {ci_hi:>7.4f} {n_valid:>7}")
            results.append({
                "gene": gene, "series": label,
                "lambda_obs": round(obs_lam, 6),
                "ci_lo_95": round(ci_lo, 6),
                "ci_hi_95": round(ci_hi, 6),
                "n_bootstrap_valid": n_valid,
            })

    df = pd.DataFrame(results)
    out = OUT_DIR / "GSE116929_bootstrap_CIs.csv"
    df.to_csv(out, index=False)
    print(f"\nSaved: {out}")

    # Summary: does HES7 CI bracket Fibonacci reference (0.618)?
    hes7 = df[df["gene"] == "HES7"]
    print("\n── HES7 summary ──")
    for _, r in hes7.iterrows():
        fib_in_ci = r["ci_lo_95"] <= 0.618 <= r["ci_hi_95"]
        print(f"  {r['series']}: |λ| = {r['lambda_obs']:.4f} "
              f"[{r['ci_lo_95']:.4f}, {r['ci_hi_95']:.4f}]  "
              f"(0.618 in CI: {fib_in_ci})")


if __name__ == "__main__":
    main()
