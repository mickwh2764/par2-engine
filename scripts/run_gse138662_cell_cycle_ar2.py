#!/usr/bin/env python3
"""
GSE138662 — T98G Glioblastoma Cell Cycle AR(2) Analysis
=========================================================
Dataset: Muskovic et al. 2022, Genome Research (doi:10.1101/gr.276818.122)
Paper title: "No evidence for lncRNA cis-regulatory roles from high
             temporal resolution RNA-seq time-course data"
Cell type: T98G human glioblastoma cells (serum-starved → serum stimulation)
Synchronisation: Serum starvation (G0 arrest) → serum stimulation (G0→G1 re-entry)
Timepoints: 0, 10, 20, ..., 400 min (41 timepoints, perfectly uniform 10-min intervals)
Interval: 10 min = 1/6 h (UNIFORM — eliminates the GSE81485 irregular-spacing caveat)
Data: Raw RNA-seq counts (featureCounts output)
Normalisation applied here: log2(count + 1), mean-centred per gene

NOTE ON EXPERIMENTAL DESIGN:
This dataset covers 400 min (~6.7 h) of transcriptional response after serum
stimulation in G0-arrested cells. This captures G0→G1 re-entry dynamics, NOT
multiple full cell cycles (HeLa/T98G cell cycle ≈ 24h). The AR(2) analysis
detects oscillatory structure in the early serum-response transcriptome and
provides a stringent test: AR(2) Fibonacci-like enrichment in canonical
cell-cycle genes on a uniformly-spaced design is free of the irregular-interval
approximation that affected GSE81485.

COMPARISON TARGET: datasets/GSE81485/GSE81485_AR2_results.csv
  - Key benchmark genes: CDC20, AURKB, BIRC5, CDC6 (Fibonacci-like cluster)
  - GSE81485 null FP≥85% rate: check GSE81485_permutation_null.csv

GEO accession: GSE138662
Data file: datasets/GSE138662/GSE138662_T98G_gene_counts.tsv.gz
Output: datasets/GSE138662/GSE138662_AR2_results.csv
"""

import sys
import os
import gzip
import numpy as np
import pandas as pd
from pathlib import Path

# ── Constants ────────────────────────────────────────────────────────────────
# Timepoints in minutes
TIMEPOINTS_MIN = list(range(0, 401, 10))   # 0, 10, 20, ..., 400
N_TIMEPOINTS = len(TIMEPOINTS_MIN)          # 41
INTERVAL_MIN = 10.0                         # perfectly uniform
INTERVAL_H   = INTERVAL_MIN / 60.0         # 0.1667 h

# Pseudocount for log2 of raw counts
PSEUDOCOUNT = 1.0   # log2(count + 1) — standard for raw counts

# Expression filter: gene must have count > 0 in ≥50% of timepoints
MIN_EXPRESSED_FRACTION = 0.50

NONSTATIONARITY_THRESHOLD = 1.0   # |λ| ≥ 1 → exclude
FP_FIBONACCI   = 0.618            # 1/φ
FP_LIKE_THRESH = 85.0
FP_NEAR_THRESH = 50.0

DATA_DIR  = Path("datasets/GSE138662")
OUT_DIR   = DATA_DIR
OUT_CSV   = OUT_DIR / "GSE138662_AR2_results.csv"
MATRIX_CSV = OUT_DIR / "GSE138662_expression_matrix.csv"

# ── Gene-name → Ensembl-ID mapping (built from NCBI gene2ensembl + gene_info)
# Allows identification of canonical cell-cycle genes in the count matrix.
GENE_TO_ENSEMBL = {
    "AURKA":   "ENSG00000087586",
    "AURKB":   "ENSG00000178999",
    "AXIN2":   "ENSG00000168646",
    "BIRC5":   "ENSG00000089685",
    "BUB1":    "ENSG00000169679",
    "BUB1B":   "ENSG00000156970",
    "BUB3":    "ENSG00000154473",
    "CCNA2":   "ENSG00000145386",
    "CCNB1":   "ENSG00000134057",
    "CCNB2":   "ENSG00000157456",
    "CCND1":   "ENSG00000110092",
    "CCND2":   "ENSG00000118971",
    "CCND3":   "ENSG00000112576",
    "CCNE1":   "ENSG00000105173",
    "CCNE2":   "ENSG00000175305",
    "CCNF":    "ENSG00000162063",
    "CDC20":   "ENSG00000117399",
    "CDC25A":  "ENSG00000164045",
    "CDC25B":  "ENSG00000101224",
    "CDC45":   "ENSG00000093009",
    "CDC6":    "ENSG00000094804",
    "CDCA3":   "ENSG00000111665",
    "CDCA5":   "ENSG00000146670",
    "CDCA8":   "ENSG00000134690",
    "CDK1":    "ENSG00000170312",
    "CDK2":    "ENSG00000123374",
    "CDK4":    "ENSG00000135446",
    "CDK6":    "ENSG00000105810",
    "CDK7":    "ENSG00000134058",
    "CDKN1A":  "ENSG00000124762",
    "CDKN1B":  "ENSG00000111276",
    "CDKN2A":  "ENSG00000147889",
    "CDKN2B":  "ENSG00000147883",
    "CDKN3":   "ENSG00000100526",
    "CENPA":   "ENSG00000115163",
    "CENPE":   "ENSG00000138778",
    "CENPF":   "ENSG00000117724",
    "CHEK1":   "ENSG00000149554",
    "CHEK2":   "ENSG00000183765",
    "DHFR":    "ENSG00000228716",
    "DLL3":    "ENSG00000090932",
    "E2F1":    "ENSG00000101412",
    "E2F2":    "ENSG00000007968",
    "E2F3":    "ENSG00000112242",
    "GMNN":    "ENSG00000112312",
    "HES1":    "ENSG00000114315",
    "HES7":    "ENSG00000179111",
    "KIF11":   "ENSG00000138160",
    "KIF2C":   "ENSG00000142945",
    "LFNG":    "ENSG00000106003",
    "MAD2L1":  "ENSG00000164109",
    "MCM10":   "ENSG00000065328",
    "MCM2":    "ENSG00000073111",
    "MCM3":    "ENSG00000112118",
    "MCM4":    "ENSG00000104738",
    "MCM5":    "ENSG00000100297",
    "MCM6":    "ENSG00000076003",
    "MCM7":    "ENSG00000166508",
    "MKI67":   "ENSG00000148773",
    "MYT1":    "ENSG00000196132",
    "NEK2":    "ENSG00000117650",
    "NOTCH1":  "ENSG00000148400",
    "NOTCH2":  "ENSG00000134250",
    "ORC6":    "ENSG00000091651",
    "PCNA":    "ENSG00000132646",
    "PKMYT1":  "ENSG00000127564",
    "PLK1":    "ENSG00000166851",
    "POLA2":   "ENSG00000014138",
    "PTTG1":   "ENSG00000164611",
    "RB1":     "ENSG00000139687",
    "RFC4":    "ENSG00000163918",
    "SKP2":    "ENSG00000145604",
    "TOP2A":   "ENSG00000131747",
    "TPX2":    "ENSG00000088325",
    "TYMS":    "ENSG00000176890",
    "WEE1":    "ENSG00000166483",
}

# Reverse map: Ensembl base ID → gene symbol
ENSEMBL_TO_GENE = {v: k for k, v in GENE_TO_ENSEMBL.items()}

# Full cell-cycle panel (same as GSE81485 script)
CELL_CYCLE_GENES = sorted(GENE_TO_ENSEMBL.keys())


# ── Helpers ──────────────────────────────────────────────────────────────────
def load_count_matrix() -> pd.DataFrame:
    """
    Load GSE138662 count matrix (Ensembl ID rows, timepoint columns).
    Strips Ensembl version suffix (e.g. ENSG00000073111.19 → ENSG00000073111).
    Returns DataFrame with gene base IDs as index, timepoints as columns.
    """
    path = DATA_DIR / "GSE138662_T98G_gene_counts.tsv.gz"
    if not path.exists():
        raise FileNotFoundError(f"Missing count matrix: {path}")
    mat = pd.read_csv(path, sep='\t', index_col=0, compression='gzip')
    # Strip version suffix
    mat.index = mat.index.str.replace(r'\.\d+$', '', regex=True)
    return mat


def filter_low_expressed(mat: pd.DataFrame) -> pd.DataFrame:
    """Keep genes with count > 0 in ≥50% of timepoints."""
    expressed = (mat > 0).sum(axis=1)
    keep = expressed >= MIN_EXPRESSED_FRACTION * N_TIMEPOINTS
    n_removed = (~keep).sum()
    print(f"  Expression filter: {keep.sum():,} genes pass (removed {n_removed:,})")
    return mat.loc[keep]


def log2_transform(mat: pd.DataFrame) -> pd.DataFrame:
    """log2(count + 1) per cell."""
    return np.log2(mat + PSEUDOCOUNT)


def fit_ar2(series: np.ndarray):
    """
    Fit AR(2) by OLS on mean-centred series.
    Returns dict with model parameters, or None if fit fails.
    Eigenperiod conversion uses INTERVAL_H (uniform, exact).
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
        angle = float(np.angle(lam))           # radians
        period_samples = abs(2 * np.pi / angle)
        period_h = period_samples * INTERVAL_H  # exact conversion (uniform spacing)
        period_min = period_samples * INTERVAL_MIN
    else:
        root_type = 'real'
        period_samples = float('nan')
        period_h = float('nan')
        period_min = float('nan')

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
        period_min=round(period_min, 1) if not np.isnan(period_min) else None,
        period_h=round(period_h, 3) if not np.isnan(period_h) else None,
        fibonacci_proximity=round(fp, 2),
        fp_class=fp_class,
        r2=round(r2, 4),
        stationary=stationary,
    )


def add_gene_names(df: pd.DataFrame) -> pd.DataFrame:
    """Map Ensembl IDs back to gene symbols where available."""
    df['gene_symbol'] = df['ensembl_id'].map(ENSEMBL_TO_GENE).fillna('')
    return df


def run_analysis():
    print("=" * 60)
    print("GSE138662 T98G Cell-Cycle AR(2) Analysis")
    print("=" * 60)
    print(f"\nDataset: Muskovic et al. 2022, Genome Research")
    print(f"Cell type: T98G human glioblastoma (serum-stimulated)")
    print(f"Timepoints ({N_TIMEPOINTS}): 0–400 min, uniform {INTERVAL_MIN:.0f}-min intervals")
    print(f"Interval: {INTERVAL_MIN:.0f} min = {INTERVAL_H:.4f} h (exact — no approximation)")
    print(f"Pseudocount for log2: {PSEUDOCOUNT}")

    # 1. Load count matrix
    print("\n[1] Loading count matrix...")
    mat = load_count_matrix()
    print(f"  Raw matrix: {mat.shape[0]:,} genes × {mat.shape[1]} timepoints")

    # 2. Confirm column order matches TIMEPOINTS_MIN
    expected_cols = [f"{t:03d}_min" for t in TIMEPOINTS_MIN]
    actual_cols = list(mat.columns)
    if actual_cols != expected_cols:
        print(f"  WARNING: column order mismatch. Reordering...")
        mat = mat[[c for c in expected_cols if c in mat.columns]]
    print(f"  Columns verified: {mat.columns[0]} … {mat.columns[-1]}")

    # 3. Filter
    print("[2] Filtering low-expressed genes...")
    mat = filter_low_expressed(mat)

    # 4. Log2 transform
    print("[3] log2(count + 1) transformation...")
    log2mat = log2_transform(mat)

    # 5. Save expression matrix
    log2mat.to_csv(MATRIX_CSV)
    print(f"  Expression matrix saved → {MATRIX_CSV}")

    # 6. Fit AR(2) to all genes
    print(f"[4] Fitting AR(2) to {log2mat.shape[0]:,} genes...")
    results = []
    for ens_id, row in log2mat.iterrows():
        r = fit_ar2(row.values)
        if r is None:
            continue
        r['ensembl_id'] = ens_id
        results.append(r)

    df = pd.DataFrame(results)[['ensembl_id','a1','a2','lambda_mod','root_type',
                                  'period_samples','period_min','period_h',
                                  'fibonacci_proximity','fp_class','r2','stationary']]
    df = add_gene_names(df)

    df.to_csv(OUT_CSV, index=False)
    print(f"  Results saved → {OUT_CSV}  ({len(df):,} genes fitted)")

    # 7. Summary statistics
    print("\n[5] Summary")
    stationary = df[df['stationary']]
    complex_roots = stationary[stationary['root_type'] == 'complex']
    print(f"  Total genes fitted:          {len(df):,}")
    print(f"  Stationary (|λ| < 1):        {len(stationary):,}")
    print(f"  Complex roots (oscillatory): {len(complex_roots):,}")

    fib_like = complex_roots[complex_roots['fp_class'] == 'Fibonacci-like']
    near_fib = complex_roots[complex_roots['fp_class'] == 'Near-Fibonacci']
    print(f"  Fibonacci-like (FP≥85%):     {len(fib_like):,}")
    print(f"  Near-Fibonacci (FP≥50%):     {len(near_fib):,}")

    # Period window: AR(2) on 10-min intervals; cell-cycle at ~24h = 144 samples
    # Short-period oscillations (1–3h = 6–18 samples) are also shown
    print(f"\n  Period distribution of complex-root stationary genes:")
    for lo, hi, label in [(0,60,'<1h'), (60,180,'1–3h'), (180,360,'3–6h'),
                           (360,1440,'6–24h'), (1440,99999,'>24h')]:
        n = ((complex_roots['period_min'] >= lo) & (complex_roots['period_min'] < hi)).sum()
        print(f"    {label:>8}: {n:,}")

    # 8. Cell-cycle gene panel report
    print("\n[6] Cell-cycle gene panel results")
    print(f"{'Gene':<12} {'Ensembl':>15} {'|λ|':>7} {'Period(h)':>10} {'Period(min)':>12} {'FP%':>6} {'FP class':<18} {'R²':>6} {'Stat'}")
    print("-" * 97)

    panel_in_matrix = df[df['gene_symbol'].isin(CELL_CYCLE_GENES)].sort_values('lambda_mod', ascending=False)
    for _, row in panel_in_matrix.iterrows():
        ph = f"{row['period_h']:.2f}" if row['period_h'] is not None and not (isinstance(row['period_h'], float) and np.isnan(row['period_h'])) else "—"
        pm = f"{row['period_min']:.0f}" if row['period_min'] is not None and not (isinstance(row['period_min'], float) and np.isnan(row['period_min'])) else "—"
        stat = "yes" if row['stationary'] else "NO"
        print(f"{row['gene_symbol']:<12} {row['ensembl_id']:>15} {row['lambda_mod']:>7.4f} {ph:>10} {pm:>12} "
              f"{row['fibonacci_proximity']:>6.1f} {row['fp_class']:<18} {row['r2']:>6.4f} {stat}")

    # 9. Report panel genes NOT found in matrix
    found_syms = set(panel_in_matrix['gene_symbol'])
    missing = set(CELL_CYCLE_GENES) - found_syms
    if missing:
        print(f"\n  Panel genes absent from expressed set: {sorted(missing)}")

    # 10. Top Fibonacci-like oscillators (all periods)
    print(f"\n[7] Top 30 Fibonacci-like oscillators (FP≥85%, stationary, complex root)")
    top_fib = fib_like.sort_values('fibonacci_proximity', ascending=False).head(30)
    print(f"{'Ensembl':>15} {'Symbol':<12} {'|λ|':>7} {'Period(h)':>10} {'Period(min)':>12} {'FP%':>6} {'R²':>6}")
    print("-" * 75)
    for _, row in top_fib.iterrows():
        sym = row['gene_symbol'] if row['gene_symbol'] else '—'
        ph = f"{row['period_h']:.2f}" if row['period_h'] is not None and not (isinstance(row['period_h'], float) and np.isnan(row['period_h'])) else "—"
        pm = f"{row['period_min']:.0f}" if row['period_min'] is not None and not (isinstance(row['period_min'], float) and np.isnan(row['period_min'])) else "—"
        print(f"{row['ensembl_id']:>15} {sym:<12} {row['lambda_mod']:>7.4f} {ph:>10} {pm:>12} "
              f"{row['fibonacci_proximity']:>6.1f} {row['r2']:>6.4f}")

    print(f"\nDone. Full results → {OUT_CSV}")

    # 11. Permutation null
    run_permutation_null(log2mat, df)

    return df


# ── Permutation null ──────────────────────────────────────────────────────────
def run_permutation_null(log2mat: pd.DataFrame, results_df: pd.DataFrame,
                         n_perm: int = 1000,
                         n_genes_sample: int = 500,
                         seed: int = 42):
    """
    Permutation test for Fibonacci enrichment.
    Same methodology as GSE81485 script for direct comparison.

    With 41 uniform timepoints (vs 14 irregular), the null distribution
    is expected to be much cleaner — fewer artefactual high-FP fits.
    """
    from scipy.stats import fisher_exact

    rng = np.random.default_rng(seed)

    print("\n" + "=" * 60)
    print("Permutation Null Test (FP≥85% rate)")
    print("=" * 60)
    print(f"  n_perm={n_perm}, n_genes_sample={n_genes_sample}, seed={seed}")

    stat_complex = results_df[
        results_df['stationary'] &
        (results_df['root_type'] == 'complex')
    ]
    print(f"  Stationary+complex gene pool: {len(stat_complex):,}")

    available = [g for g in stat_complex['ensembl_id'].tolist() if g in log2mat.index]
    print(f"  Genes available in matrix: {len(available):,}")

    sample_size = min(n_genes_sample, len(available))
    sampled_genes = list(rng.choice(available, size=sample_size, replace=False))
    print(f"  Sampled for permutation: {sample_size:,}")

    # Cell-cycle observed rate (by Ensembl ID)
    panel_ensembl = set(GENE_TO_ENSEMBL.values())
    cc_stat_complex = results_df[
        results_df['stationary'] &
        (results_df['root_type'] == 'complex') &
        results_df['ensembl_id'].isin(panel_ensembl)
    ]
    cc_fib = (cc_stat_complex['fibonacci_proximity'] >= FP_LIKE_THRESH).sum()
    cc_total = len(cc_stat_complex)
    cc_obs_rate = cc_fib / cc_total if cc_total > 0 else float('nan')
    print(f"\n  Cell-cycle genes (stationary+complex): {cc_total}")
    print(f"  Observed FP≥85% count:                 {cc_fib}")
    print(f"  Observed FP≥85% rate:                  {cc_obs_rate*100:.1f}%")

    all_fib = (stat_complex['fibonacci_proximity'] >= FP_LIKE_THRESH).sum()
    all_total = len(stat_complex)
    all_obs_rate = all_fib / all_total if all_total > 0 else float('nan')
    print(f"\n  All stationary+complex genes: {all_total}")
    print(f"  All FP≥85% count:             {all_fib}")
    print(f"  All FP≥85% rate (background): {all_obs_rate*100:.1f}%")

    print(f"\n  Running {n_perm} permutations × {sample_size} genes...")
    perm_fp_all = []
    perm_rates  = []

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

    perm_fp_all = np.array(perm_fp_all)
    perm_rates  = np.array(perm_rates)

    null_fp_rate = (perm_fp_all >= FP_LIKE_THRESH).mean()
    print(f"\n  Null FP≥85% rate (pooled permutations): {null_fp_rate*100:.2f}%")

    emp_p = (perm_rates >= cc_obs_rate).mean()
    print(f"  Empirical p-value (CC rate vs null):    {emp_p:.4f}")

    null_fib_expected = int(round(null_fp_rate * all_total))
    null_non_expected = all_total - null_fib_expected
    cc_non = cc_total - cc_fib
    odds, fisher_p = fisher_exact(
        [[cc_fib, cc_non], [null_fib_expected, null_non_expected]],
        alternative='greater'
    )
    print(f"  Fisher's exact (CC vs null background): OR={odds:.2f}, p={fisher_p:.4f}")

    INCONCLUSIVE_THRESHOLD = 0.20
    inconclusive = null_fp_rate > INCONCLUSIVE_THRESHOLD

    p5, p25, p50, p75, p95 = np.percentile(perm_rates, [5, 25, 50, 75, 95])
    print(f"\n  Null FP≥85% rate percentiles:")
    print(f"    p5={p5*100:.1f}%  p25={p25*100:.1f}%  p50={p50*100:.1f}%  "
          f"p75={p75*100:.1f}%  p95={p95*100:.1f}%")

    PERM_OUT = OUT_DIR / "GSE138662_permutation_null.csv"
    perm_summary = pd.DataFrame([{
        'dataset': 'GSE138662',
        'cell_type': 'T98G_glioblastoma',
        'n_timepoints': N_TIMEPOINTS,
        'interval_min': INTERVAL_MIN,
        'interval_uniform': True,
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

    print("\n" + "─" * 60)
    print("PERMUTATION NULL VERDICT")
    print("─" * 60)
    if inconclusive:
        print(f"⚠ INCONCLUSIVE: Null FP≥85% rate ({null_fp_rate*100:.1f}%) exceeds the")
        print(f"  20% threshold. High Fibonacci-like rate in shuffled data.")
    else:
        verdict = "SIGNIFICANT" if emp_p < 0.05 else "NOT SIGNIFICANT"
        print(f"  Null FP≥85% rate:    {null_fp_rate*100:.1f}%  (below 20% threshold)")
        print(f"  CC panel rate:       {cc_obs_rate*100:.1f}%")
        print(f"  Empirical p-value:   {emp_p:.4f}  → {verdict}")
        print(f"  Fisher's exact:      OR={odds:.2f}, p={fisher_p:.4f}")
    print(f"  Results saved → {PERM_OUT}")
    print("─" * 60)

    # Cross-dataset comparison summary
    print_cross_dataset_comparison(null_fp_rate, cc_obs_rate, emp_p, fisher_p, odds, cc_fib, cc_total)


def print_cross_dataset_comparison(null_fp_rate, cc_obs_rate, emp_p, fisher_p, odds,
                                   cc_fib, cc_total):
    """Print side-by-side comparison with GSE81485 results."""
    gse81485_null = Path("datasets/GSE81485/GSE81485_permutation_null.csv")

    print("\n" + "=" * 70)
    print("CROSS-DATASET COMPARISON: GSE81485 vs GSE138662")
    print("=" * 70)
    print(f"{'':30} {'GSE81485':>16} {'GSE138662':>16}")
    print(f"{'':30} {'(Dominguez 2016)':>16} {'(Muskovic 2022)':>16}")
    print(f"{'':30} {'HeLa, irregular':>16} {'T98G, uniform':>16}")
    print(f"{'':30} {'14 tp, ~2.3h':>16} {'41 tp, 10min':>16}")
    print("-" * 65)

    g81_null_rate = g81_cc_rate = g81_emp_p = g81_fisher_p = g81_or = '—'
    if gse81485_null.exists():
        try:
            g = pd.read_csv(gse81485_null)
            g81_null_rate = f"{g['null_fp_rate'].iloc[0]*100:.1f}%"
            g81_cc_rate   = f"{g['cc_obs_rate'].iloc[0]*100:.1f}%"
            g81_emp_p     = f"{g['empirical_pvalue'].iloc[0]:.4f}"
            g81_fisher_p  = f"{g['fisher_pvalue'].iloc[0]:.4f}"
            g81_or        = f"{g['fisher_OR'].iloc[0]:.2f}"
        except Exception:
            pass

    print(f"  {'Null FP≥85% rate':28} {g81_null_rate:>16} {null_fp_rate*100:>15.1f}%")
    print(f"  {'CC panel FP≥85% rate':28} {g81_cc_rate:>16} {cc_obs_rate*100:>15.1f}%")
    print(f"  {'Empirical p-value':28} {g81_emp_p:>16} {emp_p:>15.4f}")
    print(f"  {'Fisher OR':28} {g81_or:>16} {odds:>15.2f}")
    print(f"  {'Fisher p-value':28} {g81_fisher_p:>16} {fisher_p:>15.4f}")
    print("-" * 65)
    print(f"  {'CC genes in pool':28} {'—':>16} {cc_total:>16}")
    print(f"  {'CC Fibonacci-like count':28} {'—':>16} {cc_fib:>16}")
    print("=" * 70)


if __name__ == '__main__':
    df = run_analysis()
