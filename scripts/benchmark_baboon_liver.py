"""
Benchmark: AR(2) eigenvalue persistence vs JTK_Cycle and Cosinor — Baboon Liver
=================================================================================
Dataset : GSE98965 baboon multi-tissue (Mure et al. 2018, Science)
          Tissue  : LIV (liver), 12 ZT timepoints at ZT00–ZT22 (2h intervals,
                    one full circadian cycle)
Species : Papio anubis (olive baboon) — second-species replication run

Purpose : Replicate the GSE70499 mouse liver benchmark in a second species/dataset
          so that the "scope caveat" in the methods manuscripts can be assessed.

Outputs :
  analysis/outputs/benchmark/baboon/GSE98965_LIV_benchmark_results.csv
  analysis/outputs/benchmark/baboon/baboon_scatter.png
  analysis/outputs/benchmark/baboon/baboon_concordance.png
  analysis/outputs/benchmark/baboon/baboon_clock_genes.png
  analysis/outputs/benchmark/baboon/baboon_benchmark_summary.txt

Run: python scripts/benchmark_baboon_liver.py
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

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "par2-python-package"))

from par2.core import fit_ar2_batch

DATA_FILE = ROOT / "datasets" / "GSE98965_baboon_FPKM.csv"
OUT_DIR   = ROOT / "analysis" / "outputs" / "benchmark" / "baboon"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Baboon uses human/primate gene symbols (Papio anubis genome annotated with
# human ortholog symbols in GSE98965).
CLOCK_GENES = {
    "PER1", "PER2", "PER3", "CRY1", "CRY2",
    "ARNTL", "ARNTL2", "CLOCK",
    "NR1D1", "NR1D2", "RORA", "RORB", "RORC",
    "DBP", "TEF", "HLF",
    "CIART", "NPAS2", "AVP", "AANAT",
}
CLOCK_GENES_LOWER = {g.lower() for g in CLOCK_GENES}

TISSUE = "LIV"   # baboon liver


# ── 1. Load baboon liver expression ──────────────────────────────────────────

def load_baboon_liver(path: Path, tissue: str = "LIV") -> pd.DataFrame:
    print(f"Loading {path.name} ...", flush=True)
    raw = pd.read_csv(path)

    # Columns: EnsemblID, Symbol, then TISSUE.ZTxx ...
    # Use Symbol as gene identifier
    raw = raw.set_index("Symbol")
    raw = raw.drop(columns=["EnsemblID"], errors="ignore")

    # Select columns for the requested tissue
    tissue_cols = [c for c in raw.columns if c.startswith(f"{tissue}.") or c.startswith(f"{tissue}_")]
    if not tissue_cols:
        raise ValueError(f"No columns found for tissue '{tissue}'")

    # Sort chronologically by ZT value
    def zt_val(col):
        return int(col.split("ZT")[-1].replace(".approx", ""))

    tissue_cols_sorted = sorted(tissue_cols, key=zt_val)
    df = raw[tissue_cols_sorted].copy()

    # Rename columns to plain ZT integers for downstream parsers
    df.columns = [f"ZT{zt_val(c):02d}" for c in tissue_cols_sorted]

    print(f"  Tissue {tissue}: {len(tissue_cols_sorted)} timepoints, {df.shape[0]:,} genes")

    # ≥50% non-zero filter
    nonzero_frac = (df > 0).mean(axis=1)
    df = df[nonzero_frac >= 0.5]
    print(f"  After ≥50% non-zero filter: {df.shape[0]:,} genes")

    # Deduplicate gene symbols (keep row with highest mean expression)
    df["_mean"] = df.mean(axis=1)
    df = df.sort_values("_mean", ascending=False)
    df = df[~df.index.duplicated(keep="first")]
    df = df.drop(columns=["_mean"])
    print(f"  After dedup: {df.shape[0]:,} genes")

    # log2(FPKM + 1)
    df = np.log2(df + 1)
    return df


# ── 2. AR(2) ─────────────────────────────────────────────────────────────────

def run_ar2(df: pd.DataFrame) -> pd.DataFrame:
    print("Running AR(2) ...", flush=True)
    t0 = time.time()
    matrix = df.values.astype(np.float64)
    results = fit_ar2_batch(matrix, gene_names=list(df.index))
    print(f"  Done in {time.time()-t0:.1f}s — {len(results):,} genes")
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


# ── 3. JTK_Cycle ─────────────────────────────────────────────────────────────

def run_jtk(df: pd.DataFrame, period_h: float = 24.0) -> pd.DataFrame:
    print("Running JTK_Cycle ...", flush=True)
    t0 = time.time()

    # ZT times in hours
    t_hours = np.array([int(c.replace("ZT", "")) for c in df.columns], dtype=float)
    n = len(t_hours)
    delta_t = float(t_hours[1] - t_hours[0])   # 2h
    n_phases = int(period_h / delta_t)           # 12

    pairs = np.array(list(combinations(range(n), 2)))
    i_idx, j_idx = pairs[:, 0], pairs[:, 1]

    phase_offsets_rad = np.linspace(0, 2 * np.pi, n_phases, endpoint=False)
    ref_cosines = np.array([
        np.cos(2 * np.pi * t_hours / period_h + phi)
        for phi in phase_offsets_rad
    ])
    ref_signs = np.sign(ref_cosines[:, j_idx] - ref_cosines[:, i_idx]).astype(np.float32)

    var_S = n * (n - 1) * (2 * n + 5) / 18.0
    std_S = np.sqrt(var_S)
    n_pairs_total = n * (n - 1) / 2

    X = df.values.astype(np.float32)
    gene_signs = np.sign(X[:, j_idx] - X[:, i_idx])
    S_matrix = gene_signs @ ref_signs.T

    abs_S = np.abs(S_matrix)
    best_phase_idx = np.argmax(abs_S, axis=1)
    best_S = S_matrix[np.arange(len(S_matrix)), best_phase_idx]

    z_scores = np.abs(best_S) / std_S
    p_best = 2.0 * (1.0 - stats.norm.cdf(z_scores))
    p_bonf = np.clip(p_best * n_phases, 0.0, 1.0)
    tau = best_S / n_pairs_total
    peak_phase_h = phase_offsets_rad[best_phase_idx] / (2 * np.pi) * period_h

    order = np.argsort(p_bonf)
    n_genes = len(p_bonf)
    ranks = np.empty(n_genes, dtype=int)
    ranks[order] = np.arange(1, n_genes + 1)
    adj_p = np.minimum(1.0, p_bonf * n_genes / ranks)
    for k in range(n_genes - 2, -1, -1):
        adj_p[order[k]] = min(adj_p[order[k]], adj_p[order[k + 1]])

    print(f"  Done in {time.time()-t0:.1f}s")
    return pd.DataFrame({
        "jtk_tau":        tau,
        "jtk_pval":       p_bonf,
        "jtk_adjp":       adj_p,
        "jtk_peak_phase": peak_phase_h,
    }, index=df.index)


# ── 4. Cosinor ───────────────────────────────────────────────────────────────

def run_cosinor(df: pd.DataFrame, period_h: float = 24.0) -> pd.DataFrame:
    print("Running Cosinor ...", flush=True)
    t0 = time.time()

    t_hours = np.array([int(c.replace("ZT", "")) for c in df.columns], dtype=float)
    n = len(t_hours)
    cos_t = np.cos(2 * np.pi * t_hours / period_h)
    sin_t = np.sin(2 * np.pi * t_hours / period_h)
    X = np.column_stack([cos_t, sin_t, np.ones(n)])
    XtX_inv = np.linalg.pinv(X.T @ X)
    Y = df.values.astype(np.float64)
    beta = XtX_inv @ X.T @ Y.T
    A, B = beta[0], beta[1]
    amplitude = np.sqrt(A**2 + B**2)
    acrophase_h = (np.arctan2(B, A) / (2 * np.pi) * period_h) % period_h

    Y_pred = (X @ beta).T
    Y_mean = Y.mean(axis=1, keepdims=True)
    SS_res = np.sum((Y - Y_pred)**2, axis=1)
    SS_tot = np.sum((Y - Y_mean)**2, axis=1)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        F = ((SS_tot - SS_res) / 2) / (SS_res / (n - 3))
    p_F = 1.0 - stats.f.cdf(F, 2, n - 3)

    order = np.argsort(p_F)
    n_genes = len(p_F)
    ranks = np.empty(n_genes, dtype=int)
    ranks[order] = np.arange(1, n_genes + 1)
    adj_p = np.minimum(1.0, p_F * n_genes / ranks)
    for k in range(n_genes - 2, -1, -1):
        adj_p[order[k]] = min(adj_p[order[k]], adj_p[order[k + 1]])

    print(f"  Done in {time.time()-t0:.1f}s")
    return pd.DataFrame({
        "cosinor_amplitude": amplitude,
        "cosinor_acrophase": acrophase_h,
        "cosinor_pval":      p_F,
        "cosinor_adjp":      adj_p,
    }, index=df.index)


# ── 5. Concordance ───────────────────────────────────────────────────────────

def jaccard(a, b):
    a, b = set(a), set(b)
    return len(a & b) / len(a | b) if (a | b) else 0.0


def concordance_table(merged, cutoffs=(50, 100, 200, 500)):
    merged = merged.copy()
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


# ── 6. Figures ───────────────────────────────────────────────────────────────

def label_is_clock(gene):
    return gene.lower() in CLOCK_GENES_LOWER


def fig_scatter(merged, out_path):
    is_clock = merged.index.map(label_is_clock)
    bg  = merged[~is_clock]
    clk = merged[is_clock]

    fig, axes = plt.subplots(1, 2, figsize=(13, 5.5))
    fig.suptitle(
        f"AR(2) vs JTK_Cycle and Cosinor — GSE98965 Baboon Liver (n={len(merged):,} genes)",
        fontsize=12, y=1.01
    )

    ax = axes[0]
    jtk_lp_bg  = -np.log10(bg["jtk_adjp"].clip(1e-20))
    jtk_lp_clk = -np.log10(clk["jtk_adjp"].clip(1e-20))
    ax.scatter(bg["ar2_lambda"],  jtk_lp_bg,  s=2,  alpha=0.15, c="#aaaaaa", rasterized=True)
    ax.scatter(clk["ar2_lambda"], jtk_lp_clk, s=40, alpha=0.9,  c="#d62728",
               edgecolors="k", linewidths=0.5, zorder=5)
    for gene, row in clk.iterrows():
        ax.annotate(gene, xy=(row["ar2_lambda"], -np.log10(max(row["jtk_adjp"], 1e-20))),
                    fontsize=7, xytext=(3,3), textcoords="offset points", color="#d62728")
    ax.axhline(-np.log10(0.05), color="#888888", lw=0.8, ls="--", label="adj.p=0.05")
    ax.set_xlabel("AR(2) eigenvalue modulus |λ|", fontsize=11)
    ax.set_ylabel("JTK_Cycle  −log₁₀(adj.p)", fontsize=11)
    ax.set_title("Panel A: AR(2) vs JTK_Cycle — Baboon Liver")
    ax.legend(handles=[
        mpatches.Patch(color="#d62728", label="Canonical clock genes"),
        mpatches.Patch(color="#aaaaaa", label="All other genes"),
    ], fontsize=9, loc="upper left")
    sp_jtk = stats.spearmanr(merged["ar2_lambda"], -np.log10(merged["jtk_adjp"].clip(1e-20))).statistic
    ax.text(0.98, 0.04, f"Spearman r = {sp_jtk:.3f}", transform=ax.transAxes,
            ha="right", fontsize=9, color="#333333")

    ax = axes[1]
    ax.scatter(bg["ar2_lambda"],  bg["cosinor_amplitude"],  s=2,  alpha=0.15, c="#aaaaaa", rasterized=True)
    ax.scatter(clk["ar2_lambda"], clk["cosinor_amplitude"], s=40, alpha=0.9,  c="#1f77b4",
               edgecolors="k", linewidths=0.5, zorder=5)
    for gene, row in clk.iterrows():
        ax.annotate(gene, xy=(row["ar2_lambda"], row["cosinor_amplitude"]),
                    fontsize=7, xytext=(3,3), textcoords="offset points", color="#1f77b4")
    ax.set_xlabel("AR(2) eigenvalue modulus |λ|", fontsize=11)
    ax.set_ylabel("Cosinor amplitude (log₂ FPKM units)", fontsize=11)
    ax.set_title("Panel B: AR(2) vs Cosinor — Baboon Liver")
    ax.legend(handles=[
        mpatches.Patch(color="#1f77b4", label="Canonical clock genes"),
        mpatches.Patch(color="#aaaaaa", label="All other genes"),
    ], fontsize=9, loc="upper left")
    sp_cos = stats.spearmanr(merged["ar2_lambda"], merged["cosinor_amplitude"]).statistic
    ax.text(0.98, 0.04, f"Spearman r = {sp_cos:.3f}", transform=ax.transAxes,
            ha="right", fontsize=9, color="#333333")

    fig.tight_layout()
    fig.savefig(out_path, dpi=180, bbox_inches="tight")
    plt.close(fig)
    print(f"  Saved {out_path.name}")
    return sp_jtk, sp_cos


def fig_concordance(conc_df, out_path):
    x = np.arange(len(conc_df))
    width = 0.25
    colors = ["#2ca02c", "#ff7f0e", "#9467bd"]
    fig, ax = plt.subplots(figsize=(9, 5))
    b1 = ax.bar(x - width, conc_df["jaccard_ar2_jtk"],     width, label="AR(2) ∩ JTK_Cycle",  color=colors[0])
    b2 = ax.bar(x,          conc_df["jaccard_ar2_cosinor"], width, label="AR(2) ∩ Cosinor",     color=colors[1])
    b3 = ax.bar(x + width,  conc_df["jaccard_jtk_cosinor"], width, label="JTK_Cycle ∩ Cosinor", color=colors[2])
    ax.set_xticks(x)
    ax.set_xticklabels([f"Top {n}" for n in conc_df["top_N"]], fontsize=11)
    ax.set_ylabel("Jaccard overlap", fontsize=11)
    ax.set_ylim(0, 1)
    ax.set_title("Gene-list concordance — GSE98965 Baboon Liver (24h period)", fontsize=12)
    ax.legend(fontsize=10)
    ax.yaxis.grid(True, alpha=0.4)
    ax.set_axisbelow(True)
    for bars in [b1, b2, b3]:
        for bar in bars:
            h = bar.get_height()
            ax.text(bar.get_x() + bar.get_width()/2, h + 0.01, f"{h:.2f}",
                    ha="center", va="bottom", fontsize=8)
    fig.tight_layout()
    fig.savefig(out_path, dpi=180, bbox_inches="tight")
    plt.close(fig)
    print(f"  Saved {out_path.name}")


def fig_clock_ranks(merged, out_path):
    n_total = len(merged)
    is_clock = merged.index.map(label_is_clock)
    # Compute genome-wide ranks BEFORE subsetting to clock genes
    full = merged.copy()
    full["rank_ar2_gw"]     = full["ar2_lambda"].rank(ascending=False)
    full["rank_jtk_gw"]     = full["jtk_adjp"].rank(ascending=True)
    full["rank_cosinor_gw"] = full["cosinor_adjp"].rank(ascending=True)
    clk = full[is_clock].copy()
    if clk.empty:
        print("  WARNING: no clock genes found — skipping rank figure")
        return
    # Convert genome-wide ranks to percentiles
    clk["pct_ar2"]     = 100 * (1 - (clk["rank_ar2_gw"]     - 1) / n_total)
    clk["pct_jtk"]     = 100 * (1 - (clk["rank_jtk_gw"]     - 1) / n_total)
    clk["pct_cosinor"] = 100 * (1 - (clk["rank_cosinor_gw"] - 1) / n_total)
    clk_sorted = clk.sort_values("pct_ar2", ascending=True)
    genes = clk_sorted.index.tolist()
    y = np.arange(len(genes))
    fig, ax = plt.subplots(figsize=(9, max(4, len(genes) * 0.45)))
    ax.barh(y - 0.25, clk_sorted["pct_ar2"],     height=0.25, label="AR(2)",     color="#2ca02c", alpha=0.85)
    ax.barh(y,         clk_sorted["pct_jtk"],     height=0.25, label="JTK_Cycle", color="#1f77b4", alpha=0.85)
    ax.barh(y + 0.25,  clk_sorted["pct_cosinor"], height=0.25, label="Cosinor",   color="#ff7f0e", alpha=0.85)
    ax.set_yticks(y)
    ax.set_yticklabels(genes, fontsize=10)
    ax.set_xlabel("Percentile rank (100 = most rhythmic/persistent)", fontsize=11)
    ax.set_title("Canonical clock gene rankings — Baboon Liver (GSE98965)", fontsize=12)
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


# ── 7. Complex-root Spearman (the key replication statistic) ─────────────────

def complex_root_spearman(merged):
    # root_type is "Complex" or "Real" (title-case from par2 package)
    cx = merged[merged["ar2_root_type"].str.lower() == "complex"]
    if len(cx) < 10:
        return None, None, len(cx)
    r_jtk = stats.spearmanr(cx["ar2_lambda"], -np.log10(cx["jtk_adjp"].clip(1e-20))).statistic
    r_cos  = stats.spearmanr(cx["ar2_lambda"], cx["cosinor_amplitude"]).statistic
    return r_jtk, r_cos, len(cx)


# ── 8. Summary text ───────────────────────────────────────────────────────────

def write_summary(merged, conc_df, sp_jtk_all, sp_cos_all, out_path):
    n_total  = len(merged)
    is_clock = np.array([label_is_clock(g) for g in merged.index])
    n_clock  = is_clock.sum()

    merged2 = merged.copy()
    merged2["rank_ar2"]     = merged2["ar2_lambda"].rank(ascending=False)
    merged2["rank_jtk"]     = merged2["jtk_adjp"].rank(ascending=True)
    merged2["rank_cosinor"] = merged2["cosinor_adjp"].rank(ascending=True)
    clk = merged2[is_clock].copy()

    sig_ar2     = (merged2["ar2_lambda"] >= 0.8).sum()
    sig_jtk     = (merged2["jtk_adjp"] < 0.05).sum()
    sig_cosinor = (merged2["cosinor_adjp"] < 0.05).sum()

    # root_type is "Complex" or "Real" (title-case from par2 package)
    n_complex = (merged2["ar2_root_type"].str.lower() == "complex").sum()
    n_real    = (merged2["ar2_root_type"].str.lower() != "complex").sum()

    sp_cx_jtk, sp_cx_cos, n_cx = complex_root_spearman(merged2)

    lines = [
        "=" * 70,
        "BENCHMARK SUMMARY: AR(2) vs JTK_Cycle vs Cosinor — BABOON LIVER",
        "Dataset : GSE98965 (Mure et al. 2018, Science)",
        "Tissue  : LIV (liver), ZT00–ZT22, 2h intervals (12 timepoints)",
        "Species : Papio anubis (olive baboon) — SECOND-SPECIES REPLICATION",
        "=" * 70,
        "",
        f"Genes analysed       : {n_total:,}",
        f"Clock genes found    : {n_clock} / {len(CLOCK_GENES)}",
        f"Complex-root genes   : {n_complex:,} ({100*n_complex/n_total:.1f}%)",
        f"Real-root genes      : {n_real:,}   ({100*n_real/n_total:.1f}%)",
        "",
        "── Significant gene counts ─────────────────────────────────────",
        f"  AR(2) |λ| ≥ 0.8         : {sig_ar2:,}  ({100*sig_ar2/n_total:.1f}%)",
        f"  JTK_Cycle adj.p < 0.05  : {sig_jtk:,}  ({100*sig_jtk/n_total:.1f}%)",
        f"  Cosinor adj.p < 0.05    : {sig_cosinor:,}  ({100*sig_cosinor/n_total:.1f}%)",
        "",
        "── Rank-correlation between methods (all genes) ────────────────",
        f"  Spearman(AR2 λ, JTK −log10p) : {sp_jtk_all:.4f}",
        f"  Spearman(AR2 λ, cosinor amp) : {sp_cos_all:.4f}",
        "",
        "── Rank-correlation within complex-root (oscillatory) genes ────",
        f"  Complex-root genes           : {n_cx:,}",
    ]
    if sp_cx_jtk is not None:
        lines += [
            f"  Spearman(AR2 λ, JTK)         : {sp_cx_jtk:.4f}  ← KEY REPLICATION STAT",
            f"  Spearman(AR2 λ, cosinor amp) : {sp_cx_cos:.4f}",
            "",
            f"  ▸ Mouse liver (GSE70499) benchmark: {0.059:.3f}",
            f"  ▸ Baboon liver (this run)         : {sp_cx_jtk:.3f}",
            f"  ▸ Conclusion: {'LOW SHARED VARIANCE (|r|<0.25, R²<6%) — consistent with orthogonality' if abs(sp_cx_jtk) < 0.25 else 'ELEVATED (|r|≥0.25) — requires explanation'}",
        ]
    lines += [
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

    lines += ["", "=" * 70]
    text = "\n".join(lines)
    out_path.write_text(text)
    print(f"\n  Saved {out_path.name}")
    print()
    print(text)
    return sp_cx_jtk, sp_cx_cos, n_cx


# ── main ──────────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("PAR(2) Benchmark vs JTK_Cycle + Cosinor — BABOON LIVER")
    print("Dataset: GSE98965 (Mure 2018) — LIV tissue, ZT00–ZT22")
    print("=" * 60, "\n")

    df = load_baboon_liver(DATA_FILE, tissue=TISSUE)

    ar2_df     = run_ar2(df)
    jtk_df     = run_jtk(df)
    cosinor_df = run_cosinor(df)

    merged = ar2_df.join(jtk_df, how="inner").join(cosinor_df, how="inner")
    print(f"\nMerged: {len(merged):,} genes with all three methods")

    merged.to_csv(OUT_DIR / "GSE98965_LIV_benchmark_results.csv")
    print("Saved GSE98965_LIV_benchmark_results.csv")

    conc_df = concordance_table(merged)

    print("\nGenerating figures ...")
    sp_jtk_all, sp_cos_all = fig_scatter(merged, OUT_DIR / "baboon_scatter.png")
    fig_concordance(conc_df, OUT_DIR / "baboon_concordance.png")
    fig_clock_ranks(merged, OUT_DIR / "baboon_clock_genes.png")

    write_summary(merged, conc_df, sp_jtk_all, sp_cos_all,
                  OUT_DIR / "baboon_benchmark_summary.txt")


if __name__ == "__main__":
    main()
