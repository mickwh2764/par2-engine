"""
Benchmark: AR(2) eigenvalue persistence vs JTK_Cycle and Cosinor
================================================================
Dataset : GSE70499 mouse liver (WT), 24 timepoints at CT18–CT64
          (2h circadian-time intervals, ~2 full cycles)
Methods :
  1. AR(2) |lambda|   — oscillatory persistence (this project's method)
  2. JTK_Cycle        — rank-based rhythmicity (Hughes et al. 2010)
                        Implemented in Python using vectorised Kendall tau
                        against cosine references at 24h period across 12 phases.
  3. Cosinor          — harmonic OLS regression with F-test (Nelson et al. 1979)

Outputs:
  analysis/outputs/benchmark/GSE70499_benchmark_results.csv
  analysis/outputs/benchmark/benchmark_concordance.png
  analysis/outputs/benchmark/benchmark_scatter.png
  analysis/outputs/benchmark/benchmark_clock_genes.png
  analysis/outputs/benchmark/benchmark_summary.txt

Run: python scripts/benchmark_vs_jtk_rain.py
"""

import sys
import os
import time
import warnings
from itertools import combinations
from pathlib import Path

import numpy as np
import pandas as pd
import scipy.stats as stats
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.gridspec import GridSpec

# ── paths ──────────────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "par2-python-package"))

from par2.core import fit_ar2_batch

DATA_FILE = ROOT / "datasets" / "GSE70499_Liver_Bmal1WT_circadian.csv"
OUT_DIR = ROOT / "analysis" / "outputs" / "benchmark"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# ── canonical circadian clock genes (mouse symbols) ───────────────────────────
CLOCK_GENES = {
    # Core negative loop
    "Per1", "Per2", "Per3", "Cry1", "Cry2",
    # Core positive loop
    "Arntl", "Clock", "Arntl2",
    # Stabilising loop / output
    "Nr1d1", "Nr1d2", "Rora", "Rorb", "Rorc",
    # PAR-bZIP output genes (strongly rhythmic, often used as positive controls)
    "Dbp", "Tef", "Hlf",
    # Additional well-characterised rhythmic outputs
    "Ciart", "Npas2", "Avp", "Aanat",
}
# Alternative capitalisation that may appear in GEO data
CLOCK_GENES_LOWER = {g.lower() for g in CLOCK_GENES}

# ── 1. Load and filter expression matrix ──────────────────────────────────────

def load_expression(path: Path):
    print(f"Loading {path.name} ...", flush=True)
    df = pd.read_csv(path, index_col=0)
    print(f"  Raw: {df.shape[0]:,} genes × {df.shape[1]} timepoints")

    # Require ≥50% non-zero counts
    nonzero_frac = (df > 0).mean(axis=1)
    df = df[nonzero_frac >= 0.5]
    print(f"  After ≥50% non-zero filter: {df.shape[0]:,} genes")

    # log2(FPKM + 1) transform
    df = np.log2(df + 1)
    return df


# ── 2. AR(2) via par2 package ─────────────────────────────────────────────────

def run_ar2(df: pd.DataFrame) -> pd.DataFrame:
    print("Running AR(2) on all genes ...", flush=True)
    t0 = time.time()
    matrix = df.values.astype(np.float64)
    results = fit_ar2_batch(matrix, gene_names=list(df.index))
    elapsed = time.time() - t0
    print(f"  Done in {elapsed:.1f}s — {len(results):,} genes fitted")

    ar2_df = pd.DataFrame(results).set_index("gene")
    ar2_df = ar2_df.rename(columns={
        "eigenvalue": "ar2_lambda",
        "r2":         "ar2_r2",
        "root_type":  "ar2_root_type",
        "phi1":       "ar2_phi1",
        "phi2":       "ar2_phi2",
        "half_life":  "ar2_half_life",
        "eigenperiod":"ar2_eigenperiod",
    })
    return ar2_df


# ── 3. JTK_Cycle (Python implementation) ─────────────────────────────────────
#
# Algorithm (Hughes et al. 2010, J Biol Rhythms):
#   For each candidate period P and phase offset φ:
#     1. Generate cosine reference cos(2π·t/P + φ)
#     2. Compute Kendall τ between gene expression ranks and reference ranks
#     3. The JTK statistic S = Σ_{i<j} sgn(x_j-x_i)·sgn(ref_j-ref_i)
#     4. p-value from normal approx: var(S) = n(n-1)(2n+5)/18
#   Omnibus p per gene = Bonferroni(min p across phases) × n_phases
#   Genome-wide correction: Benjamini-Hochberg (FDR)
#
# We test period = 24h only (the circadian period), with 12 phase offsets
# (every 2h across one full cycle) at Δt = 2h sampling.

def run_jtk(df: pd.DataFrame, period_h: float = 24.0) -> pd.DataFrame:
    print("Running JTK_Cycle (Python, vectorised) ...", flush=True)
    t0 = time.time()

    # Circadian time in hours for CT18..CT64
    t_hours = np.array([float(c.replace("CT", "")) for c in df.columns])
    n = len(t_hours)
    delta_t = float(t_hours[1] - t_hours[0])        # 2h
    n_phases = int(period_h / delta_t)               # 12

    # Pair indices for Kendall τ
    pairs = np.array(list(combinations(range(n), 2)))
    i_idx, j_idx = pairs[:, 0], pairs[:, 1]          # shape (n_pairs,)

    # Reference sign matrix: shape (n_phases, n_pairs)
    # For each phase φ (in samples), generate cosine at the given period
    phase_offsets_rad = np.linspace(0, 2 * np.pi, n_phases, endpoint=False)
    ref_cosines = np.array([
        np.cos(2 * np.pi * t_hours / period_h + phi)
        for phi in phase_offsets_rad
    ])                                                 # (n_phases, n)
    ref_signs = np.sign(ref_cosines[:, j_idx] - ref_cosines[:, i_idx])
    # shape: (n_phases, n_pairs); cast to int8 for speed
    ref_signs = ref_signs.astype(np.float32)

    # Variance of S under H0 (no ties in reference, assuming no ties in data)
    var_S = n * (n - 1) * (2 * n + 5) / 18.0
    std_S = np.sqrt(var_S)
    n_pairs_total = n * (n - 1) / 2

    # Gene sign matrix: shape (n_genes, n_pairs)
    X = df.values.astype(np.float32)                  # (n_genes, n)
    gene_signs = np.sign(X[:, j_idx] - X[:, i_idx])   # (n_genes, n_pairs)

    # S matrix: shape (n_genes, n_phases)
    # = gene_signs @ ref_signs.T
    S_matrix = gene_signs @ ref_signs.T               # (n_genes, n_phases)

    # Best |S| and corresponding phase for each gene
    abs_S = np.abs(S_matrix)
    best_phase_idx = np.argmax(abs_S, axis=1)          # (n_genes,)
    best_S = S_matrix[np.arange(len(S_matrix)), best_phase_idx]

    # One-sided p-value for best S, then Bonferroni × n_phases
    z_scores = np.abs(best_S) / std_S
    p_best = 2.0 * (1.0 - stats.norm.cdf(z_scores))
    p_bonf = np.clip(p_best * n_phases, 0.0, 1.0)

    # Kendall τ
    tau = best_S / n_pairs_total

    # Phase of peak (hours after CT0)
    peak_phase_h = phase_offsets_rad[best_phase_idx] / (2 * np.pi) * period_h

    # BH correction across genes
    order = np.argsort(p_bonf)
    n_genes = len(p_bonf)
    ranks = np.empty(n_genes, dtype=int)
    ranks[order] = np.arange(1, n_genes + 1)
    adj_p = np.minimum(1.0, p_bonf * n_genes / ranks)
    # Ensure monotonicity (enforce BH step-up)
    for k in range(n_genes - 2, -1, -1):
        adj_p[order[k]] = min(adj_p[order[k]], adj_p[order[k + 1]])

    elapsed = time.time() - t0
    print(f"  Done in {elapsed:.1f}s")

    return pd.DataFrame({
        "jtk_tau":        tau,
        "jtk_pval":       p_bonf,
        "jtk_adjp":       adj_p,
        "jtk_peak_phase": peak_phase_h,
    }, index=df.index)


# ── 4. Cosinor regression ─────────────────────────────────────────────────────
#
# Model: y(t) = A·cos(2πt/24) + B·sin(2πt/24) + C + ε
# Amplitude = √(A² + B²)
# Acrophase = arctan2(B, A) converted to hours
# p-value: F-test for H0: A = B = 0 (2 df numerator, n-3 denominator)

def run_cosinor(df: pd.DataFrame, period_h: float = 24.0) -> pd.DataFrame:
    print("Running Cosinor regression ...", flush=True)
    t0 = time.time()

    t_hours = np.array([float(c.replace("CT", "")) for c in df.columns])
    n = len(t_hours)

    cos_t = np.cos(2 * np.pi * t_hours / period_h)
    sin_t = np.sin(2 * np.pi * t_hours / period_h)

    # Design matrix: [cos, sin, intercept]  shape (n, 3)
    X = np.column_stack([cos_t, sin_t, np.ones(n)])
    XtX_inv = np.linalg.pinv(X.T @ X)      # (3, 3)

    Y = df.values.astype(np.float64)        # (n_genes, n)

    # OLS: coefficients beta = (XtX)^{-1} Xt y  for all genes at once
    # beta shape: (3, n_genes)
    beta = XtX_inv @ X.T @ Y.T             # (3, n_genes)
    A = beta[0]                             # cos coefficient
    B = beta[1]                             # sin coefficient
    C = beta[2]                             # intercept

    amplitude = np.sqrt(A ** 2 + B ** 2)
    acrophase_h = (np.arctan2(B, A) / (2 * np.pi) * period_h) % period_h

    # Residuals and F-test
    Y_pred = (X @ beta).T                  # (n_genes, n)
    Y_mean = Y.mean(axis=1, keepdims=True) # (n_genes, 1)
    SS_res = np.sum((Y - Y_pred) ** 2, axis=1)
    SS_tot = np.sum((Y - Y_mean) ** 2, axis=1)
    SS_reg = SS_tot - SS_res

    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        F = (SS_reg / 2) / (SS_res / (n - 3))
    p_F = 1.0 - stats.f.cdf(F, 2, n - 3)

    # BH correction
    order = np.argsort(p_F)
    n_genes = len(p_F)
    ranks = np.empty(n_genes, dtype=int)
    ranks[order] = np.arange(1, n_genes + 1)
    adj_p = np.minimum(1.0, p_F * n_genes / ranks)
    for k in range(n_genes - 2, -1, -1):
        adj_p[order[k]] = min(adj_p[order[k]], adj_p[order[k + 1]])

    elapsed = time.time() - t0
    print(f"  Done in {elapsed:.1f}s")

    return pd.DataFrame({
        "cosinor_amplitude": amplitude,
        "cosinor_acrophase": acrophase_h,
        "cosinor_pval":      p_F,
        "cosinor_adjp":      adj_p,
    }, index=df.index)


# ── 5. Concordance statistics ─────────────────────────────────────────────────

def jaccard(set_a, set_b):
    a, b = set(set_a), set(set_b)
    return len(a & b) / len(a | b) if (a | b) else 0.0


def concordance_table(merged: pd.DataFrame, cutoffs=(100, 200, 500, 1000)):
    """Jaccard overlap between top-N gene lists for each method pair."""
    # Rank each method (ascending rank = more rhythmic / more persistent)
    merged["rank_ar2"]     = merged["ar2_lambda"].rank(ascending=False)
    merged["rank_jtk"]     = merged["jtk_adjp"].rank(ascending=True)
    merged["rank_cosinor"] = merged["cosinor_adjp"].rank(ascending=True)

    rows = []
    for n in cutoffs:
        top_ar2     = set(merged.nsmallest(n, "rank_ar2").index)
        top_jtk     = set(merged.nsmallest(n, "rank_jtk").index)
        top_cosinor = set(merged.nsmallest(n, "rank_cosinor").index)
        rows.append({
            "top_N":               n,
            "jaccard_ar2_jtk":     jaccard(top_ar2, top_jtk),
            "jaccard_ar2_cosinor": jaccard(top_ar2, top_cosinor),
            "jaccard_jtk_cosinor": jaccard(top_jtk, top_cosinor),
        })
    return pd.DataFrame(rows)


# ── 6. Figures ────────────────────────────────────────────────────────────────

def label_is_clock(gene: str) -> bool:
    return gene.lower() in CLOCK_GENES_LOWER


def fig_scatter(merged: pd.DataFrame, out_path: Path):
    """Two scatter plots: AR(2) λ vs JTK and AR(2) λ vs Cosinor."""
    is_clock = merged.index.map(label_is_clock)
    bg   = merged[~is_clock]
    clk  = merged[is_clock]

    fig, axes = plt.subplots(1, 2, figsize=(13, 5.5))
    fig.suptitle(
        "AR(2) vs JTK_Cycle and Cosinor — GSE70499 Mouse Liver (WT, n=20k genes)",
        fontsize=12, y=1.01
    )

    # ── Panel A: AR(2) λ vs JTK_Cycle -log10(adj.p) ──
    ax = axes[0]
    jtk_logp_bg  = -np.log10(bg["jtk_adjp"].clip(1e-20))
    jtk_logp_clk = -np.log10(clk["jtk_adjp"].clip(1e-20))

    ax.scatter(bg["ar2_lambda"],  jtk_logp_bg,  s=2,  alpha=0.15, c="#aaaaaa", rasterized=True)
    ax.scatter(clk["ar2_lambda"], jtk_logp_clk, s=40, alpha=0.9,  c="#d62728",
               edgecolors="k", linewidths=0.5, zorder=5)

    # Label clock genes
    for gene, row in clk.iterrows():
        ax.annotate(
            gene, xy=(row["ar2_lambda"], -np.log10(max(row["jtk_adjp"], 1e-20))),
            fontsize=7, xytext=(3, 3), textcoords="offset points",
            color="#d62728"
        )

    ax.axhline(-np.log10(0.05), color="#888888", lw=0.8, ls="--", label="adj.p = 0.05")
    ax.set_xlabel("AR(2) eigenvalue modulus |λ|", fontsize=11)
    ax.set_ylabel("JTK_Cycle  –log₁₀(adj.p)", fontsize=11)
    ax.set_title("Panel A: AR(2) vs JTK_Cycle")
    ax.legend(handles=[
        mpatches.Patch(color="#d62728", label="Canonical clock genes"),
        mpatches.Patch(color="#aaaaaa", label="All other genes"),
    ], fontsize=9, loc="upper left")

    spearman_jtk = stats.spearmanr(merged["ar2_lambda"], -np.log10(merged["jtk_adjp"].clip(1e-20))).statistic
    ax.text(0.98, 0.04, f"Spearman r = {spearman_jtk:.3f}", transform=ax.transAxes,
            ha="right", fontsize=9, color="#333333")

    # ── Panel B: AR(2) λ vs Cosinor amplitude ──
    ax = axes[1]
    ax.scatter(bg["ar2_lambda"],  bg["cosinor_amplitude"],  s=2,  alpha=0.15, c="#aaaaaa", rasterized=True)
    ax.scatter(clk["ar2_lambda"], clk["cosinor_amplitude"], s=40, alpha=0.9,  c="#1f77b4",
               edgecolors="k", linewidths=0.5, zorder=5)

    for gene, row in clk.iterrows():
        ax.annotate(
            gene, xy=(row["ar2_lambda"], row["cosinor_amplitude"]),
            fontsize=7, xytext=(3, 3), textcoords="offset points",
            color="#1f77b4"
        )

    ax.set_xlabel("AR(2) eigenvalue modulus |λ|", fontsize=11)
    ax.set_ylabel("Cosinor amplitude (log₂ FPKM units)", fontsize=11)
    ax.set_title("Panel B: AR(2) vs Cosinor")
    ax.legend(handles=[
        mpatches.Patch(color="#1f77b4", label="Canonical clock genes"),
        mpatches.Patch(color="#aaaaaa", label="All other genes"),
    ], fontsize=9, loc="upper left")

    spearman_cos = stats.spearmanr(merged["ar2_lambda"], merged["cosinor_amplitude"]).statistic
    ax.text(0.98, 0.04, f"Spearman r = {spearman_cos:.3f}", transform=ax.transAxes,
            ha="right", fontsize=9, color="#333333")

    fig.tight_layout()
    fig.savefig(out_path, dpi=180, bbox_inches="tight")
    plt.close(fig)
    print(f"  Saved {out_path.name}")
    return spearman_jtk, spearman_cos


def fig_concordance(conc_df: pd.DataFrame, out_path: Path):
    """Grouped bar chart of Jaccard overlap at each top-N cutoff."""
    x = np.arange(len(conc_df))
    width = 0.25
    colors = ["#2ca02c", "#ff7f0e", "#9467bd"]

    fig, ax = plt.subplots(figsize=(9, 5))
    b1 = ax.bar(x - width, conc_df["jaccard_ar2_jtk"],     width, label="AR(2) ∩ JTK_Cycle",  color=colors[0])
    b2 = ax.bar(x,          conc_df["jaccard_ar2_cosinor"], width, label="AR(2) ∩ Cosinor",     color=colors[1])
    b3 = ax.bar(x + width, conc_df["jaccard_jtk_cosinor"], width, label="JTK_Cycle ∩ Cosinor", color=colors[2])

    ax.set_xticks(x)
    ax.set_xticklabels([f"Top {n}" for n in conc_df["top_N"]], fontsize=11)
    ax.set_ylabel("Jaccard overlap", fontsize=11)
    ax.set_ylim(0, 1)
    ax.set_title("Gene-list concordance between methods\nGSE70499 Mouse Liver — 24h period", fontsize=12)
    ax.legend(fontsize=10)
    ax.yaxis.grid(True, alpha=0.4)
    ax.set_axisbelow(True)

    for bars in [b1, b2, b3]:
        for bar in bars:
            h = bar.get_height()
            ax.text(bar.get_x() + bar.get_width() / 2, h + 0.01, f"{h:.2f}",
                    ha="center", va="bottom", fontsize=8)

    fig.tight_layout()
    fig.savefig(out_path, dpi=180, bbox_inches="tight")
    plt.close(fig)
    print(f"  Saved {out_path.name}")


def fig_clock_ranks(merged: pd.DataFrame, out_path: Path):
    """Percentile rank of canonical clock genes under each method."""
    n_total = len(merged)
    is_clock = merged.index.map(label_is_clock)
    clk = merged[is_clock].copy()

    if clk.empty:
        print("  WARNING: no canonical clock genes found in this dataset — skipping rank figure")
        return

    # Convert rank → percentile (higher = more rhythmic)
    clk["pct_ar2"]     = 100 * (1 - (clk["ar2_lambda"].rank(ascending=False) - 1) / n_total)
    clk["pct_jtk"]     = 100 * (1 - (clk["jtk_adjp"].rank(ascending=True) - 1) / n_total)
    clk["pct_cosinor"] = 100 * (1 - (clk["cosinor_adjp"].rank(ascending=True) - 1) / n_total)

    clk_sorted = clk.sort_values("pct_ar2", ascending=True)
    genes = clk_sorted.index.tolist()
    y = np.arange(len(genes))

    fig, ax = plt.subplots(figsize=(9, max(4, len(genes) * 0.45)))
    ax.barh(y - 0.25, clk_sorted["pct_ar2"],     height=0.25, label="AR(2)",     color="#2ca02c", alpha=0.85)
    ax.barh(y,         clk_sorted["pct_jtk"],     height=0.25, label="JTK_Cycle", color="#1f77b4", alpha=0.85)
    ax.barh(y + 0.25,  clk_sorted["pct_cosinor"], height=0.25, label="Cosinor",   color="#ff7f0e", alpha=0.85)

    ax.set_yticks(y)
    ax.set_yticklabels(genes, fontsize=10)
    ax.set_xlabel("Percentile rank (100 = most rhythmic)", fontsize=11)
    ax.set_title("Canonical clock gene rankings — all three methods\nGSE70499 Mouse Liver", fontsize=12)
    ax.axvline(95, color="red", lw=0.8, ls="--", label="95th pct")
    ax.axvline(90, color="gray", lw=0.8, ls=":", label="90th pct")
    ax.set_xlim(0, 105)
    ax.legend(fontsize=9, loc="lower right")
    ax.xaxis.grid(True, alpha=0.4)
    ax.set_axisbelow(True)

    fig.tight_layout()
    fig.savefig(out_path, dpi=180, bbox_inches="tight")
    plt.close(fig)
    print(f"  Saved {out_path.name}")


# ── 7. Summary text ───────────────────────────────────────────────────────────

def write_summary(merged, conc_df, spearman_jtk, spearman_cos, out_path: Path):
    n_total = len(merged)
    is_clock = np.array([label_is_clock(g) for g in merged.index])
    n_clock_found = is_clock.sum()

    # Percentile of each clock gene under each method
    merged["rank_ar2"]     = merged["ar2_lambda"].rank(ascending=False)
    merged["rank_jtk"]     = merged["jtk_adjp"].rank(ascending=True)
    merged["rank_cosinor"] = merged["cosinor_adjp"].rank(ascending=True)

    clk = merged[is_clock].copy()
    med_pct_ar2     = 100 * (1 - (clk["rank_ar2"] - 1) / n_total)
    med_pct_jtk     = 100 * (1 - (clk["rank_jtk"] - 1) / n_total)
    med_pct_cosinor = 100 * (1 - (clk["rank_cosinor"] - 1) / n_total)

    sig_ar2     = (merged["ar2_lambda"] >= 0.8).sum()
    sig_jtk     = (merged["jtk_adjp"] < 0.05).sum()
    sig_cosinor = (merged["cosinor_adjp"] < 0.05).sum()

    lines = [
        "=" * 70,
        "BENCHMARK SUMMARY: AR(2) vs JTK_Cycle vs Cosinor",
        "Dataset: GSE70499 Mouse Liver Bmal1-WT, CT18–CT64 (2h intervals)",
        "=" * 70,
        "",
        f"Genes analysed       : {n_total:,}",
        f"Clock genes found    : {n_clock_found} / {len(CLOCK_GENES)}",
        "",
        "── Significant gene counts ─────────────────────────────────────",
        f"  AR(2) |λ| ≥ 0.8           : {sig_ar2:,}  ({100*sig_ar2/n_total:.1f}%)",
        f"  JTK_Cycle adj.p < 0.05    : {sig_jtk:,}  ({100*sig_jtk/n_total:.1f}%)",
        f"  Cosinor adj.p < 0.05      : {sig_cosinor:,}  ({100*sig_cosinor/n_total:.1f}%)",
        "",
        "── Rank-correlation between methods ────────────────────────────",
        f"  Spearman(AR2 λ, JTK –log10p) : {spearman_jtk:.4f}",
        f"  Spearman(AR2 λ, cosinor amp) : {spearman_cos:.4f}",
        "",
        "── Jaccard concordance at top-N gene lists ──────────────────────",
    ]
    for _, row in conc_df.iterrows():
        lines.append(
            f"  Top {int(row.top_N):5d}: "
            f"AR2∩JTK={row.jaccard_ar2_jtk:.3f}  "
            f"AR2∩Cos={row.jaccard_ar2_cosinor:.3f}  "
            f"JTK∩Cos={row.jaccard_jtk_cosinor:.3f}"
        )

    lines += [
        "",
        "── Clock gene percentile ranks ─────────────────────────────────",
        f"  {'Gene':<12} {'AR(2) pct':>10} {'JTK pct':>10} {'Cosinor pct':>12}",
        "  " + "-" * 46,
    ]
    for gene in sorted(clk.index):
        p_ar2 = 100 * (1 - (clk.loc[gene, "rank_ar2"] - 1) / n_total)
        p_jtk = 100 * (1 - (clk.loc[gene, "rank_jtk"] - 1) / n_total)
        p_cos = 100 * (1 - (clk.loc[gene, "rank_cosinor"] - 1) / n_total)
        lines.append(f"  {gene:<12} {p_ar2:>10.1f} {p_jtk:>10.1f} {p_cos:>12.1f}")

    lines += [
        "",
        "── Interpretation guide ────────────────────────────────────────",
        "  Concordance ≥ 0.50 at top-200 : methods broadly agree",
        "  Clock gene pct ≥ 90           : method reliably ranks clock genes",
        "  Spearman r ≥ 0.50             : methods share substantial rank information",
        "",
        "Output files:",
        f"  {(OUT_DIR / 'GSE70499_benchmark_results.csv').name}",
        f"  benchmark_scatter.png, benchmark_concordance.png, benchmark_clock_genes.png",
        "=" * 70,
    ]

    text = "\n".join(lines)
    out_path.write_text(text)
    print(f"  Saved {out_path.name}")
    print()
    print(text)


# ── main ──────────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("PAR(2) Benchmark vs JTK_Cycle + Cosinor")
    print("Dataset: GSE70499 Mouse Liver WT  (CT18–CT64, 2h)")
    print("=" * 60)
    print()

    df = load_expression(DATA_FILE)

    ar2_df     = run_ar2(df)
    jtk_df     = run_jtk(df)
    cosinor_df = run_cosinor(df)

    # Merge on gene index (inner join — only genes that survived AR(2) fit)
    merged = ar2_df.join(jtk_df,     how="inner") \
                   .join(cosinor_df, how="inner")

    print(f"\nMerged dataset: {len(merged):,} genes with all three methods")

    # Save full results
    results_path = OUT_DIR / "GSE70499_benchmark_results.csv"
    merged.to_csv(results_path)
    print(f"Saved {results_path.name}")

    # Concordance
    print("\nComputing concordance ...")
    conc_df = concordance_table(merged)

    # Figures
    print("\nGenerating figures ...")
    sp_jtk, sp_cos = fig_scatter(merged, OUT_DIR / "benchmark_scatter.png")
    fig_concordance(conc_df, OUT_DIR / "benchmark_concordance.png")
    fig_clock_genes = fig_clock_ranks(merged, OUT_DIR / "benchmark_clock_genes.png")

    # Summary
    print()
    write_summary(merged, conc_df, sp_jtk, sp_cos, OUT_DIR / "benchmark_summary.txt")


if __name__ == "__main__":
    main()
