#!/usr/bin/env python3
"""
GSE81485 — HeLa Cell Cycle AR(2) Analysis
==========================================
Dataset: Dominguez et al. 2016, eLife (doi:10.7554/eLife.10288)
Cell type: HeLa (human cervical carcinoma)
Synchronisation: Double thymidine block → release
Timepoints: 0, 3, 4.5, 6, 9, 10.5, 12, 15, 18, 19.5, 21, 22.5, 25.5, 30 h
             (14 timepoints, irregular spacing, covering ~1.25 HeLa cell cycles)
Data: FPKM per gene per timepoint (Cufflinks output, already normalised)
Normalisation applied here: log2(FPKM + 0.1), mean-centred per gene

LIMITATION: Irregular sampling intervals (mostly 1.5h or 3h steps, ends at 4.5h).
AR(2) assumes uniform spacing; an effective mean interval of
  30h / 13 gaps ≈ 2.31h is used for eigenperiod conversion.
For a strictly uniform sub-series analysis see --uniform flag (TODO).

GEO accession: GSE81485
Data files: datasets/GSE81485/D{1..14}.txt.gz
Output: datasets/GSE81485/GSE81485_AR2_results.csv
"""

import sys
import os
import gzip
import numpy as np
import pandas as pd
from pathlib import Path

# ── Constants ────────────────────────────────────────────────────────────────
# Timepoints in hours after release from double thymidine block
TIMEPOINTS_H = [0, 3, 4.5, 6, 9, 10.5, 12, 15, 18, 19.5, 21, 22.5, 25.5, 30]
N_TIMEPOINTS  = len(TIMEPOINTS_H)        # 14

# For eigenperiod conversion: mean interval = 30h / 13 gaps
MEAN_INTERVAL_H = (TIMEPOINTS_H[-1] - TIMEPOINTS_H[0]) / (N_TIMEPOINTS - 1)  # ≈ 2.31h

# Floor added before log2 to handle zeros: log2(FPKM + PSEUDOCOUNT)
PSEUDOCOUNT = 0.1

MIN_EXPRESSED_FRACTION = 0.50    # gene must have FPKM > 0 in ≥50% of timepoints
NONSTATIONARITY_THRESHOLD = 1.0  # |λ| ≥ 1 → exclude
FP_FIBONACCI   = 0.618           # 1/φ
FP_LIKE_THRESH = 85.0
FP_NEAR_THRESH = 50.0

DATA_DIR  = Path("datasets/GSE81485")
OUT_DIR   = DATA_DIR
OUT_CSV   = OUT_DIR / "GSE81485_AR2_results.csv"
MATRIX_CSV = OUT_DIR / "GSE81485_expression_matrix.csv"

# ── Cell-cycle gene panel (same as scan_cell_cycle_ar2.cjs) ─────────────────
CELL_CYCLE_GENES = [
    # MCM family
    'MCM2','MCM3','MCM4','MCM5','MCM6','MCM7','MCM10',
    # CDKs
    'CDK1','CDK2','CDK4','CDK6','CDK7',
    # Cyclins
    'CCNA2','CCNB1','CCNB2','CCND1','CCND2','CCND3','CCNE1','CCNE2',
    # Spindle checkpoint
    'MAD2L1','BUB1','BUB1B','BUB3','CDC20',
    # Proliferation / S-phase
    'MKI67','PCNA',
    # Aurora/PLK
    'PLK1','AURKA','AURKB',
    # G2/M checkpoint
    'WEE1','CHEK1','CHEK2',
    # CKIs
    'CDKN1A','CDKN1B','CDKN2A','CDKN3',
    # Rb pathway
    'RB1','E2F1','E2F2','E2F3',
    # CDCA family
    'CDCA3','CDCA5','CDCA8',
    # Segmentation clock cross-check (expect NOT to oscillate at cell-cycle period)
    'HES7','LFNG','DLL3','AXIN2','HES1','NOTCH1','NOTCH2',
    # GMNN (Geminin — cell-cycle licensing factor; known oscillator)
    'GMNN',
    # Additional oscillators from Whitfield et al. 2002 signature
    'TOP2A','TYMS','DHFR','RFC4','POLA2','ORC6','CDC6','CDC45','CDC25A','CDC25B',
    'CCNF','NEK2','CENPA','CENPE','CENPF','KIF2C','KIF11','PTTG1',
    # WEE1 pathway
    'MYT1','PKMYT1',
    # Additional G2/M
    'BIRC5','TPX2','CDKN2B','SKP2',
]
CELL_CYCLE_GENES = sorted(set(CELL_CYCLE_GENES))


# ── Helpers ──────────────────────────────────────────────────────────────────
def load_fpkm_file(path: Path) -> pd.Series:
    """Read a Cufflinks FPKM file and return a Series indexed by gene_name."""
    with gzip.open(path, 'rt') as f:
        df = pd.read_csv(f, sep='\t', usecols=['gene_name', 'FPKM'])
    # Some genes appear multiple times (isoforms); take max FPKM per gene
    return df.groupby('gene_name')['FPKM'].max()


def build_matrix() -> pd.DataFrame:
    """Assemble all 14 FPKM files into a gene × timepoint DataFrame."""
    cols = []
    for d in range(1, N_TIMEPOINTS + 1):
        path = DATA_DIR / f"D{d}.txt.gz"
        if not path.exists():
            raise FileNotFoundError(f"Missing: {path}")
        s = load_fpkm_file(path)
        s.name = f"D{d}_{TIMEPOINTS_H[d-1]}h"
        cols.append(s)
    mat = pd.concat(cols, axis=1)
    mat = mat.fillna(0.0)
    return mat


def filter_low_expressed(mat: pd.DataFrame) -> pd.DataFrame:
    """Keep genes expressed (FPKM > 0) in ≥50% of timepoints."""
    expressed = (mat > 0).sum(axis=1)
    keep = expressed >= MIN_EXPRESSED_FRACTION * N_TIMEPOINTS
    n_removed = (~keep).sum()
    print(f"  Expression filter: {keep.sum():,} genes pass (removed {n_removed:,})")
    return mat.loc[keep]


def log2_transform(mat: pd.DataFrame) -> pd.DataFrame:
    """log2(FPKM + pseudocount) per cell."""
    return np.log2(mat + PSEUDOCOUNT)


def fit_ar2(series: np.ndarray):
    """
    Fit AR(2) by OLS on mean-centred series.
    Returns dict with model parameters, or None if fit fails.
    """
    y = series - series.mean()
    n = len(y)
    if n < 4:
        return None

    Y = y[2:]
    X = np.column_stack([y[1:-1], y[:-2]])

    try:
        coeffs, residuals, rank, _ = np.linalg.lstsq(X, Y, rcond=None)
    except np.linalg.LinAlgError:
        return None

    a1, a2 = coeffs

    # Characteristic polynomial: λ² - a1·λ - a2 = 0
    companion = np.array([[a1, a2], [1.0, 0.0]])
    eigenvals = np.linalg.eigvals(companion)

    # Pick dominant root (largest modulus)
    idx = np.argmax(np.abs(eigenvals))
    lam = eigenvals[idx]
    lam_mod = float(np.abs(lam))

    # Root type
    if np.iscomplex(lam) and abs(lam.imag) > 1e-10:
        root_type = 'complex'
        angle = float(np.angle(lam))          # radians
        period_samples = abs(2 * np.pi / angle)
        period_h = period_samples * MEAN_INTERVAL_H
    else:
        root_type = 'real'
        period_samples = float('nan')
        period_h = float('nan')

    # R²
    y_hat = X @ coeffs
    ss_res = float(np.sum((Y - y_hat) ** 2))
    ss_tot = float(np.sum((Y - Y.mean()) ** 2))
    r2 = 1 - ss_res / ss_tot if ss_tot > 0 else float('nan')

    # Fibonacci proximity: |λ| proximity to 1/φ
    fp = max(0.0, 100.0 * (1 - abs(lam_mod - FP_FIBONACCI) / FP_FIBONACCI))
    if fp >= FP_LIKE_THRESH:
        fp_class = 'Fibonacci-like'
    elif fp >= FP_NEAR_THRESH:
        fp_class = 'Near-Fibonacci'
    else:
        fp_class = 'Other'

    stationary = lam_mod < NONSTATIONARITY_THRESHOLD

    return dict(
        a1=round(a1, 6),
        a2=round(a2, 6),
        lambda_mod=round(lam_mod, 6),
        root_type=root_type,
        period_samples=round(period_samples, 2) if not np.isnan(period_samples) else None,
        period_h=round(period_h, 2) if not np.isnan(period_h) else None,
        fibonacci_proximity=round(fp, 2),
        fp_class=fp_class,
        r2=round(r2, 4),
        stationary=stationary,
    )


def run_analysis():
    print("=" * 60)
    print("GSE81485 HeLa Cell Cycle AR(2) Analysis")
    print("=" * 60)
    print(f"\nTimepoints ({N_TIMEPOINTS}): {TIMEPOINTS_H}")
    print(f"Mean interval: {MEAN_INTERVAL_H:.2f} h (irregular spacing — see header)")
    print(f"Pseudocount for log2: {PSEUDOCOUNT}")

    # 1. Build matrix
    print("\n[1] Loading FPKM files...")
    mat = build_matrix()
    print(f"  Raw matrix: {mat.shape[0]:,} genes × {mat.shape[1]} timepoints")

    # 2. Filter
    print("[2] Filtering low-expressed genes...")
    mat = filter_low_expressed(mat)

    # 3. Log2 transform
    print("[3] log2(FPKM + 0.1) transformation...")
    log2mat = log2_transform(mat)

    # 4. Save expression matrix
    log2mat.to_csv(MATRIX_CSV)
    print(f"  Expression matrix saved → {MATRIX_CSV}")

    # 5. Fit AR(2) to all genes
    print(f"[4] Fitting AR(2) to {log2mat.shape[0]:,} genes...")
    results = []
    for gene, row in log2mat.iterrows():
        r = fit_ar2(row.values)
        if r is None:
            continue
        r['gene'] = gene
        results.append(r)

    df = pd.DataFrame(results)[['gene','a1','a2','lambda_mod','root_type',
                                  'period_samples','period_h',
                                  'fibonacci_proximity','fp_class','r2','stationary']]

    df.to_csv(OUT_CSV, index=False)
    print(f"  Results saved → {OUT_CSV}  ({len(df):,} genes fitted)")

    # 6. Summary statistics
    print("\n[5] Summary")
    stationary = df[df['stationary']]
    complex_roots = stationary[stationary['root_type'] == 'complex']
    print(f"  Total genes fitted:          {len(df):,}")
    print(f"  Stationary (|λ| < 1):        {len(stationary):,}")
    print(f"  Complex roots (oscillatory): {len(complex_roots):,}")

    cell_period = 24.0  # HeLa cell cycle ~24h
    window = 6.0        # ±6h window
    on_target = complex_roots[
        (complex_roots['period_h'] >= cell_period - window) &
        (complex_roots['period_h'] <= cell_period + window)
    ]
    print(f"  Period in [{cell_period-window:.0f}, {cell_period+window:.0f}]h: {len(on_target):,}")

    fib_like = complex_roots[complex_roots['fp_class'] == 'Fibonacci-like']
    near_fib = complex_roots[complex_roots['fp_class'] == 'Near-Fibonacci']
    print(f"  Fibonacci-like (FP≥85%):     {len(fib_like):,}")
    print(f"  Near-Fibonacci (FP≥50%):     {len(near_fib):,}")

    # 7. Cell-cycle gene panel report
    print("\n[6] Cell-cycle gene panel results")
    print(f"{'Gene':<12} {'|λ|':>7} {'Period(h)':>10} {'FP%':>6} {'FP class':<18} {'R²':>6} {'Stationary'}")
    print("-" * 75)
    panel_df = df[df['gene'].isin(CELL_CYCLE_GENES)].sort_values('lambda_mod', ascending=False)
    for _, row in panel_df.iterrows():
        period_str = f"{row['period_h']:.1f}" if row['period_h'] is not None and not (isinstance(row['period_h'], float) and np.isnan(row['period_h'])) else "—"
        stat_str = "yes" if row['stationary'] else "NO"
        print(f"{row['gene']:<12} {row['lambda_mod']:>7.4f} {period_str:>10} "
              f"{row['fibonacci_proximity']:>6.1f} {row['fp_class']:<18} {row['r2']:>6.4f} {stat_str}")

    # 8. Top Fibonacci-like oscillators in cell-cycle period window
    print(f"\n[7] Top oscillators (complex root, {cell_period-window:.0f}–{cell_period+window:.0f}h period, FP≥50%)")
    top = on_target[on_target['fp_class'].isin(['Fibonacci-like','Near-Fibonacci'])]\
              .sort_values('fibonacci_proximity', ascending=False).head(30)
    print(f"{'Gene':<12} {'|λ|':>7} {'Period(h)':>10} {'FP%':>6} {'FP class':<18} {'R²':>6}")
    print("-" * 65)
    for _, row in top.iterrows():
        print(f"{row['gene']:<12} {row['lambda_mod']:>7.4f} {row['period_h']:>10.1f} "
              f"{row['fibonacci_proximity']:>6.1f} {row['fp_class']:<18} {row['r2']:>6.4f}")

    print(f"\nDone. Full results → {OUT_CSV}")

    # 9. Permutation null test
    run_permutation_null(log2mat, df)

    return df


# ── Permutation null ──────────────────────────────────────────────────────────
def run_permutation_null(log2mat: pd.DataFrame, results_df: pd.DataFrame,
                         n_perm: int = 1000,
                         n_genes_sample: int = 500,
                         seed: int = 42):
    """
    Permutation test for Fibonacci enrichment.

    Strategy
    --------
    * Sample up to `n_genes_sample` genes from the stationary + complex-root set
      (the same population in which the 33.5% FP≥85 rate was observed).
    * For each sampled gene shuffle its 14 expression values N=n_perm times,
      re-fit AR(2), and record fibonacci_proximity.
    * Pool all permutation FP values → null distribution.
    * Empirical null FP≥85% rate = fraction of pooled permutation fits with FP≥85.
    * Observed cell-cycle rate = fraction of cell-cycle genes (stationary+complex)
      with FP≥85.
    * Empirical p-value: fraction of per-permutation FP≥85 rates ≥ observed CC rate.
      (One draw = one permutation across all sampled genes → one "permuted dataset rate".)
    * Flag result as inconclusive if null rate > 20%.

    Saves results to datasets/GSE81485/GSE81485_permutation_null.csv and prints
    a plain-language summary.
    """
    import random as _random
    from scipy.stats import fisher_exact

    rng = np.random.default_rng(seed)

    print("\n" + "=" * 60)
    print("Permutation Null Test (FP≥85% rate)")
    print("=" * 60)
    print(f"  n_perm={n_perm}, n_genes_sample={n_genes_sample}, seed={seed}")

    # ── Identify the population: stationary + complex roots ──────────────────
    stat_complex = results_df[
        results_df['stationary'] &
        (results_df['root_type'] == 'complex')
    ]
    print(f"  Stationary+complex gene pool: {len(stat_complex):,}")

    # Genes present in the expression matrix
    available = [g for g in stat_complex['gene'].tolist() if g in log2mat.index]
    print(f"  Genes available in matrix: {len(available):,}")

    # Sample without replacement
    sample_size = min(n_genes_sample, len(available))
    sampled_genes = list(rng.choice(available, size=sample_size, replace=False))
    print(f"  Sampled for permutation: {sample_size:,}")

    # ── Cell-cycle observed rate ─────────────────────────────────────────────
    cc_stat_complex = results_df[
        results_df['stationary'] &
        (results_df['root_type'] == 'complex') &
        results_df['gene'].isin(CELL_CYCLE_GENES)
    ]
    cc_fib = (cc_stat_complex['fibonacci_proximity'] >= FP_LIKE_THRESH).sum()
    cc_total = len(cc_stat_complex)
    cc_obs_rate = cc_fib / cc_total if cc_total > 0 else float('nan')
    print(f"\n  Cell-cycle genes (stationary+complex): {cc_total}")
    print(f"  Observed FP≥85% count:                 {cc_fib}")
    print(f"  Observed FP≥85% rate:                  {cc_obs_rate*100:.1f}%")

    # ── Global observed rate (all stationary+complex) ────────────────────────
    all_fib = (stat_complex['fibonacci_proximity'] >= FP_LIKE_THRESH).sum()
    all_total = len(stat_complex)
    all_obs_rate = all_fib / all_total if all_total > 0 else float('nan')
    print(f"\n  All stationary+complex genes: {all_total}")
    print(f"  All FP≥85% count:             {all_fib}")
    print(f"  All FP≥85% rate (background): {all_obs_rate*100:.1f}%")

    # ── Run permutations ─────────────────────────────────────────────────────
    print(f"\n  Running {n_perm} permutations × {sample_size} genes...")
    perm_fp_all = []          # flat list of all permuted FP values
    perm_rates  = []          # per-permutation fraction with FP≥85

    for perm_i in range(n_perm):
        if (perm_i + 1) % 200 == 0:
            print(f"    ... {perm_i+1}/{n_perm}")
        perm_fib_count = 0
        perm_total     = 0
        for gene in sampled_genes:
            vals = log2mat.loc[gene].values.copy()
            rng.shuffle(vals)
            r = fit_ar2(vals)
            if r is None:
                continue
            perm_fp_all.append(r['fibonacci_proximity'])
            perm_total += 1
            if r['fibonacci_proximity'] >= FP_LIKE_THRESH:
                perm_fib_count += 1
        if perm_total > 0:
            perm_rates.append(perm_fib_count / perm_total)

    perm_fp_all  = np.array(perm_fp_all)
    perm_rates   = np.array(perm_rates)

    null_fp_rate = (perm_fp_all >= FP_LIKE_THRESH).mean()
    print(f"\n  Null FP≥85% rate (pooled permutations): {null_fp_rate*100:.2f}%")

    # ── Empirical p-value for cell-cycle panel rate ──────────────────────────
    # p = fraction of permuted-dataset rates ≥ observed cell-cycle rate
    emp_p = (perm_rates >= cc_obs_rate).mean()
    print(f"  Empirical p-value (CC rate vs null):    {emp_p:.4f}")

    # ── Fisher's exact test: CC vs background under null ────────────────────
    # Null background: null_fp_rate over all_total genes
    null_fib_expected = int(round(null_fp_rate * all_total))
    null_non_expected = all_total - null_fib_expected
    cc_non = cc_total - cc_fib
    # 2×2 table: [CC fib, CC non-fib; null fib, null non-fib]
    odds, fisher_p = fisher_exact(
        [[cc_fib, cc_non], [null_fib_expected, null_non_expected]],
        alternative='greater'
    )
    print(f"  Fisher's exact (CC vs null background): OR={odds:.2f}, p={fisher_p:.4f}")

    # ── Inconclusiveness flag ────────────────────────────────────────────────
    INCONCLUSIVE_THRESHOLD = 0.20
    inconclusive = null_fp_rate > INCONCLUSIVE_THRESHOLD

    # ── Null distribution summary ─────────────────────────────────────────────
    p5, p25, p50, p75, p95 = np.percentile(perm_rates, [5, 25, 50, 75, 95])
    print(f"\n  Null FP≥85% rate percentiles:")
    print(f"    p5={p5*100:.1f}%  p25={p25*100:.1f}%  p50={p50*100:.1f}%  "
          f"p75={p75*100:.1f}%  p95={p95*100:.1f}%")

    # ── Save results ──────────────────────────────────────────────────────────
    PERM_OUT = OUT_DIR / "GSE81485_permutation_null.csv"
    perm_summary = pd.DataFrame([{
        'n_perm': n_perm,
        'n_genes_sampled': sample_size,
        'null_fp_rate': round(null_fp_rate, 6),
        'null_median_rate': round(float(np.median(perm_rates)), 6),
        'null_p5_rate': round(p5, 6),
        'null_p95_rate': round(p95, 6),
        'cc_genes_stationary_complex': cc_total,
        'cc_fib_count': int(cc_fib),
        'cc_obs_rate': round(cc_obs_rate, 6),
        'all_background_rate': round(all_obs_rate, 6),
        'empirical_pvalue': round(float(emp_p), 6),
        'fisher_OR': round(float(odds), 4),
        'fisher_pvalue': round(float(fisher_p), 6),
        'inconclusive_flag': inconclusive,
        'inconclusive_threshold': INCONCLUSIVE_THRESHOLD,
    }])
    perm_summary.to_csv(PERM_OUT, index=False)

    # ── Plain-language verdict ────────────────────────────────────────────────
    print("\n" + "─" * 60)
    print("PERMUTATION NULL VERDICT")
    print("─" * 60)
    if inconclusive:
        print(f"⚠ INCONCLUSIVE: Null FP≥85% rate ({null_fp_rate*100:.1f}%) exceeds the")
        print(f"  20% threshold. The 14-timepoint irregular-spacing design produces")
        print(f"  high Fibonacci-like rates even for shuffled data. The cell-cycle")
        print(f"  panel enrichment cannot be distinguished from a sampling artefact.")
    else:
        verdict = "SIGNIFICANT" if emp_p < 0.05 else "NOT SIGNIFICANT"
        print(f"  Null FP≥85% rate:    {null_fp_rate*100:.1f}%  (below 20% threshold)")
        print(f"  CC panel rate:       {cc_obs_rate*100:.1f}%")
        print(f"  Empirical p-value:   {emp_p:.4f}  → {verdict}")
        print(f"  Fisher's exact:      OR={odds:.2f}, p={fisher_p:.4f}")
    print(f"  Results saved → {PERM_OUT}")
    print("─" * 60)


if __name__ == '__main__':
    df = run_analysis()
