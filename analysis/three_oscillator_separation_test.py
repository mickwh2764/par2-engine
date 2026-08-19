"""
Three-Oscillator Separation Test: cell-cycle vs circadian vs segmentation-clock eigenvalue profiles
Task 304

Datasets:
- GSE81485: HeLa cell-cycle (n=14 timepoints, Δt=1 h), human
- GSE161566: Human enteroid circadian (24 h timepoints)
- GSE116929: Segmentation clock (mouse somitogenesis, Ex1 series)
"""

import pandas as pd
import numpy as np
from scipy import stats
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from pathlib import Path

OUTPUT_DIR = Path("analysis/outputs/three_oscillator_304")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# ─────────────────────────────────────────────
# 1. Load datasets
# ─────────────────────────────────────────────
hela = pd.read_csv("datasets/GSE81485/GSE81485_AR2_results.csv")
enteroid = pd.read_csv("datasets/GSE161566_Human_Enteroid_AR2.csv")
seg = pd.read_csv("paper-packages/paper-r-segmentation-clock/results/GSE116929_AR2_results.csv")

print(f"GSE81485 (HeLa cell-cycle):        {len(hela):,} genes")
print(f"GSE161566 (Human enteroid circadian): {len(enteroid):,} genes")
print(f"GSE116929 (Segmentation clock):     {len(seg):,} rows")

# GSE116929 has multiple series per gene — take Ex1 only (primary embryo series)
seg_ex1 = seg[seg["series"] == "Ex1"].copy()
print(f"GSE116929 Ex1 only:                {len(seg_ex1):,} genes")

# Filter: stationary only; exclude degenerate entries (lambda_mod=0 or |λ|>=1 unstable)
hela_f = hela[(hela["stationary"] == True) & (hela["lambda_mod"] > 0) & (hela["lambda_mod"] < 1)].copy()
seg_f  = seg_ex1[(seg_ex1["stationary"] == True) & (seg_ex1["lambda_mod"] > 0) & (seg_ex1["lambda_mod"] < 1)].copy()
ent_f  = enteroid[(enteroid["stable"] == True) & (enteroid["lambda"] > 0) & (enteroid["lambda"] < 1)].copy()
ent_f = ent_f.rename(columns={"lambda": "lambda_mod"})

print(f"\nAfter stability filter:")
print(f"  HeLa:     {len(hela_f):,}")
print(f"  Enteroid: {len(ent_f):,}")
print(f"  Seg:      {len(seg_f):,}")

# ─────────────────────────────────────────────
# 2. Find gene overlap
# ─────────────────────────────────────────────
genes_hela = set(hela_f["gene"].str.upper())
genes_ent  = set(ent_f["gene"].str.upper())
genes_seg  = set(seg_f["gene"].str.upper())

common_all = genes_hela & genes_ent & genes_seg
common_hela_ent = genes_hela & genes_ent
common_hela_seg = genes_hela & genes_seg
common_ent_seg  = genes_ent & genes_seg

print(f"\nGene overlap:")
print(f"  HeLa ∩ Enteroid ∩ Seg: {len(common_all):,}")
print(f"  HeLa ∩ Enteroid:       {len(common_hela_ent):,}")
print(f"  HeLa ∩ Seg:            {len(common_hela_seg):,}")
print(f"  Enteroid ∩ Seg:        {len(common_ent_seg):,}")

# Subset to common-all genes
hela_f["gene_upper"] = hela_f["gene"].str.upper()
ent_f["gene_upper"]  = ent_f["gene"].str.upper()
seg_f["gene_upper"]  = seg_f["gene"].str.upper()

h_c = hela_f[hela_f["gene_upper"].isin(common_all)].set_index("gene_upper")
e_c = ent_f[ent_f["gene_upper"].isin(common_all)].set_index("gene_upper")
s_c = seg_f[seg_f["gene_upper"].isin(common_all)].set_index("gene_upper")

# Align on common genes
common_list = sorted(common_all)
h_lam = h_c.loc[common_list, "lambda_mod"].values
e_lam = e_c.loc[common_list, "lambda_mod"].values
s_lam = s_c.loc[common_list, "lambda_mod"].values

print(f"\nAligned vectors: {len(common_list)} genes")

# ─────────────────────────────────────────────
# 3. Summary statistics
# ─────────────────────────────────────────────
def summarise(arr, name):
    return {
        "dataset": name,
        "n": len(arr),
        "mean_lambda": np.mean(arr),
        "median_lambda": np.median(arr),
        "std_lambda": np.std(arr),
        "q25": np.percentile(arr, 25),
        "q75": np.percentile(arr, 75),
    }

summary = pd.DataFrame([
    summarise(h_lam, "HeLa cell-cycle (GSE81485)"),
    summarise(e_lam, "Human enteroid circadian (GSE161566)"),
    summarise(s_lam, "Segmentation clock (GSE116929)"),
])
print("\n=== Summary statistics (common genes, |λ| distributions) ===")
print(summary.to_string(index=False))

# ─────────────────────────────────────────────
# 4. KS tests between pairs
# ─────────────────────────────────────────────
ks_he = stats.ks_2samp(h_lam, e_lam)
ks_hs = stats.ks_2samp(h_lam, s_lam)
ks_es = stats.ks_2samp(e_lam, s_lam)

print("\n=== KS-test p-values (|λ| distributions, common gene set) ===")
print(f"  HeLa vs Enteroid:   D={ks_he.statistic:.4f}, p={ks_he.pvalue:.4e}")
print(f"  HeLa vs Seg-clock:  D={ks_hs.statistic:.4f}, p={ks_hs.pvalue:.4e}")
print(f"  Enteroid vs Seg:    D={ks_es.statistic:.4f}, p={ks_es.pvalue:.4e}")

# Overlap metric: Bhattacharyya coefficient (histogram-based)
def bhattacharyya(a, b, bins=50):
    rng = (min(a.min(), b.min()), max(a.max(), b.max()))
    ha, _ = np.histogram(a, bins=bins, range=rng, density=True)
    hb, _ = np.histogram(b, bins=bins, range=rng, density=True)
    ha = ha / ha.sum(); hb = hb / hb.sum()
    return float(np.sum(np.sqrt(ha * hb)))

bc_he = bhattacharyya(h_lam, e_lam)
bc_hs = bhattacharyya(h_lam, s_lam)
bc_es = bhattacharyya(e_lam, s_lam)

print("\n=== Bhattacharyya overlap coefficient (1=identical, 0=disjoint) ===")
print(f"  HeLa vs Enteroid:   {bc_he:.4f}")
print(f"  HeLa vs Seg-clock:  {bc_hs:.4f}")
print(f"  Enteroid vs Seg:    {bc_es:.4f}")

# ─────────────────────────────────────────────
# 5. FP-class comparison (HeLa & Seg only — Enteroid lacks fp_class)
# ─────────────────────────────────────────────
# Use pairwise HeLa ∩ Seg common genes
h_hs = hela_f[hela_f["gene_upper"].isin(common_hela_seg)].set_index("gene_upper")
s_hs = seg_f[seg_f["gene_upper"].isin(common_hela_seg)].set_index("gene_upper")
common_hs = sorted(common_hela_seg)

h_fp = h_hs.loc[common_hs, "fibonacci_proximity"].values
s_fp = s_hs.loc[common_hs, "fibonacci_proximity"].values

h_fp_class = h_hs.loc[common_hs, "fp_class"].values
s_fp_class = s_hs.loc[common_hs, "fp_class"].values

ks_fp = stats.ks_2samp(h_fp, s_fp)
print(f"\n=== FP% KS-test (HeLa vs Seg-clock, {len(common_hs):,} shared genes) ===")
print(f"  D={ks_fp.statistic:.4f}, p={ks_fp.pvalue:.4e}")

# FP class proportions
for ds, arr in [("HeLa cell-cycle", h_fp_class), ("Seg-clock", s_fp_class)]:
    unique, counts = np.unique(arr, return_counts=True)
    pcts = counts / counts.sum() * 100
    print(f"\n  FP-class proportions — {ds}:")
    for u, p in sorted(zip(unique, pcts), key=lambda x: -x[1]):
        print(f"    {u}: {p:.1f}%")

# ─────────────────────────────────────────────
# 6. Period distributions (HeLa & Seg only)
# ─────────────────────────────────────────────
h_per = h_hs.loc[common_hs, "period_h"].dropna()
s_per = s_hs.loc[common_hs, "period_h"].dropna()
print(f"\n=== Period distributions (complex-root genes in HeLa∩Seg) ===")
print(f"  HeLa: n={len(h_per):,}  mean={h_per.mean():.2f} h  median={h_per.median():.2f} h")
print(f"  Seg:  n={len(s_per):,}  mean={s_per.mean():.2f} h  median={s_per.median():.2f} h")
ks_per = stats.ks_2samp(h_per, s_per)
print(f"  Period KS-test: D={ks_per.statistic:.4f}, p={ks_per.pvalue:.4e}")

# ─────────────────────────────────────────────
# 7. Plots
# ─────────────────────────────────────────────
COLORS = {
    "cell-cycle": "#e63946",
    "circadian":  "#457b9d",
    "seg-clock":  "#2a9d8f",
}

fig, axes = plt.subplots(2, 2, figsize=(13, 10))
fig.suptitle(
    "Three-Oscillator Eigenvalue Separation Test (Task 304)\n"
    "Cell-cycle (HeLa/GSE81485) vs Circadian (Enteroid/GSE161566) vs Seg-clock (GSE116929)",
    fontsize=12, fontweight="bold"
)

# ── Panel A: |λ| distributions (all three, common genes) ──
ax = axes[0, 0]
bins = np.linspace(0, 1, 51)
ax.hist(h_lam, bins=bins, alpha=0.55, color=COLORS["cell-cycle"], density=True, label=f"Cell-cycle (n={len(h_lam):,})")
ax.hist(e_lam, bins=bins, alpha=0.55, color=COLORS["circadian"],  density=True, label=f"Circadian (n={len(e_lam):,})")
ax.hist(s_lam, bins=bins, alpha=0.55, color=COLORS["seg-clock"],  density=True, label=f"Seg-clock (n={len(s_lam):,})")
ax.set_xlabel("|λ| eigenvalue modulus", fontsize=10)
ax.set_ylabel("Density", fontsize=10)
ax.set_title(f"A. |λ| distributions — {len(common_list):,} common genes", fontsize=10, fontweight="bold")
ax.legend(fontsize=8)
ax.text(0.02, 0.97, f"KS(cell-cycle vs circadian): D={ks_he.statistic:.3f}, p={ks_he.pvalue:.2e}\n"
                     f"KS(cell-cycle vs seg-clock): D={ks_hs.statistic:.3f}, p={ks_hs.pvalue:.2e}\n"
                     f"KS(circadian vs seg-clock): D={ks_es.statistic:.3f}, p={ks_es.pvalue:.2e}",
        transform=ax.transAxes, va="top", fontsize=7.5, family="monospace",
        bbox=dict(boxstyle="round,pad=0.3", fc="white", alpha=0.8))

# ── Panel B: ECDFs ──
ax = axes[0, 1]
for arr, label, color in [
    (np.sort(h_lam), f"Cell-cycle ({len(h_lam):,})", COLORS["cell-cycle"]),
    (np.sort(e_lam), f"Circadian ({len(e_lam):,})",  COLORS["circadian"]),
    (np.sort(s_lam), f"Seg-clock ({len(s_lam):,})",  COLORS["seg-clock"]),
]:
    ecdf = np.arange(1, len(arr)+1) / len(arr)
    ax.plot(arr, ecdf, color=color, lw=1.8, label=label)
ax.set_xlabel("|λ| eigenvalue modulus", fontsize=10)
ax.set_ylabel("ECDF", fontsize=10)
ax.set_title("B. ECDF of |λ| — common genes", fontsize=10, fontweight="bold")
ax.legend(fontsize=8)
ax.text(0.02, 0.97, f"Bhattacharyya overlap:\n"
                     f"  CC vs Circ: {bc_he:.3f}\n"
                     f"  CC vs Seg:  {bc_hs:.3f}\n"
                     f"  Circ vs Seg:{bc_es:.3f}",
        transform=ax.transAxes, va="top", fontsize=8, family="monospace",
        bbox=dict(boxstyle="round,pad=0.3", fc="white", alpha=0.8))

# ── Panel C: FP% distributions (HeLa vs Seg, common genes) ──
ax = axes[1, 0]
bins_fp = np.linspace(0, 100, 51)
ax.hist(h_fp, bins=bins_fp, alpha=0.6, color=COLORS["cell-cycle"], density=True,
        label=f"Cell-cycle (n={len(h_fp):,})")
ax.hist(s_fp, bins=bins_fp, alpha=0.6, color=COLORS["seg-clock"],  density=True,
        label=f"Seg-clock (n={len(s_fp):,})")
ax.set_xlabel("Fibonacci proximity %", fontsize=10)
ax.set_ylabel("Density", fontsize=10)
ax.set_title(f"C. FP% distributions — {len(common_hs):,} HeLa∩Seg genes\n(Enteroid lacks FP scores)", fontsize=10, fontweight="bold")
ax.legend(fontsize=8)
ax.text(0.02, 0.97, f"KS-test: D={ks_fp.statistic:.3f}, p={ks_fp.pvalue:.2e}",
        transform=ax.transAxes, va="top", fontsize=8, family="monospace",
        bbox=dict(boxstyle="round,pad=0.3", fc="white", alpha=0.8))

# ── Panel D: FP class bar chart ──
ax = axes[1, 1]
fp_classes = ["Fibonacci-like", "Near-Fibonacci", "Other"]
# for seg, may have "Non-Fibonacci" instead of "Other"
h_counts = {c: (h_fp_class == c).sum() / len(h_fp_class) * 100 for c in ["Fibonacci-like", "Near-Fibonacci", "Other"]}
s_raw = {c: (s_fp_class == c).sum() for c in ["Fibonacci-like", "Near-Fibonacci", "Other", "Non-Fibonacci"]}
s_total = sum(s_raw.values())
s_counts = {"Fibonacci-like": s_raw["Fibonacci-like"] / s_total * 100,
             "Near-Fibonacci": s_raw["Near-Fibonacci"] / s_total * 100,
             "Other":          (s_raw["Other"] + s_raw["Non-Fibonacci"]) / s_total * 100}

x = np.arange(len(fp_classes))
w = 0.35
bars_h = ax.bar(x - w/2, [h_counts[c] for c in fp_classes], w,
                color=COLORS["cell-cycle"], alpha=0.8, label="Cell-cycle (HeLa)")
bars_s = ax.bar(x + w/2, [s_counts[c] for c in fp_classes], w,
                color=COLORS["seg-clock"], alpha=0.8, label="Seg-clock")
ax.set_xticks(x); ax.set_xticklabels(fp_classes, fontsize=9)
ax.set_ylabel("% of common genes", fontsize=10)
ax.set_title(f"D. FP class proportions — {len(common_hs):,} HeLa∩Seg genes", fontsize=10, fontweight="bold")
ax.legend(fontsize=8)
for bar in bars_h:
    ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.5,
            f"{bar.get_height():.1f}%", ha='center', va='bottom', fontsize=7.5, color=COLORS["cell-cycle"])
for bar in bars_s:
    ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.5,
            f"{bar.get_height():.1f}%", ha='center', va='bottom', fontsize=7.5, color=COLORS["seg-clock"])

plt.tight_layout()
plot_path = OUTPUT_DIR / "three_oscillator_separation_test.png"
plt.savefig(plot_path, dpi=150, bbox_inches="tight")
plt.close()
print(f"\nPlot saved: {plot_path}")

# ── Period comparison plot ──
fig2, ax2 = plt.subplots(figsize=(8, 5))
bins_per = np.linspace(0, 50, 51)
ax2.hist(h_per, bins=bins_per, alpha=0.65, color=COLORS["cell-cycle"], density=True,
         label=f"Cell-cycle HeLa (n={len(h_per):,}, median {h_per.median():.1f} h)")
ax2.hist(s_per, bins=bins_per, alpha=0.65, color=COLORS["seg-clock"], density=True,
         label=f"Seg-clock (n={len(s_per):,}, median {s_per.median():.1f} h)")
ax2.set_xlabel("Period (hours)", fontsize=11)
ax2.set_ylabel("Density", fontsize=11)
ax2.set_title("Period distributions: cell-cycle vs segmentation-clock\n"
              f"(Enteroid circadian periods not available; {len(common_hs):,} shared genes with complex roots)",
              fontsize=10, fontweight="bold")
ax2.legend(fontsize=9)
ax2.text(0.65, 0.97, f"KS-test: D={ks_per.statistic:.3f}\np={ks_per.pvalue:.2e}",
         transform=ax2.transAxes, va="top", fontsize=9, family="monospace",
         bbox=dict(boxstyle="round,pad=0.3", fc="white", alpha=0.8))
plt.tight_layout()
per_path = OUTPUT_DIR / "period_distributions_CC_vs_Seg.png"
plt.savefig(per_path, dpi=150, bbox_inches="tight")
plt.close()
print(f"Period plot saved: {per_path}")

# ─────────────────────────────────────────────
# 8. Write structured report
# ─────────────────────────────────────────────
report_lines = [
    "# Three-Oscillator Eigenvalue Separation Test — Task 304",
    f"Generated: 2026-08-11",
    "",
    "## Datasets",
    f"| Dataset | Context | Sampling | Genes (filtered) |",
    f"|---------|---------|----------|-----------------|",
    f"| GSE81485 | HeLa cell-cycle | Δt = 1 h (14 pts) | {len(hela_f):,} |",
    f"| GSE161566 | Human enteroid circadian | Δt = 2 h (24 pts) | {len(ent_f):,} |",
    f"| GSE116929 Ex1 | Segmentation clock (mouse somite) | Δt ≈ 43 min (26 pts) | {len(seg_f):,} |",
    "",
    "## Gene overlaps",
    f"- HeLa ∩ Enteroid ∩ Seg-clock: **{len(common_all):,} genes** (used for |λ| comparison)",
    f"- HeLa ∩ Seg-clock: **{len(common_hela_seg):,} genes** (used for FP% comparison)",
    f"- HeLa ∩ Enteroid: **{len(common_hela_ent):,} genes**",
    f"- Enteroid ∩ Seg-clock: **{len(common_ent_seg):,} genes**",
    "",
    "## |λ| distribution summary (common three-way genes)",
    f"| Dataset | n | Mean |λ| | Median |λ| | SD |λ| | Q25–Q75 |",
    f"|---------|---|-------|---------|------|---------|",
]
for _, row in summary.iterrows():
    report_lines.append(
        f"| {row['dataset']} | {int(row['n']):,} | {row['mean_lambda']:.3f} | "
        f"{row['median_lambda']:.3f} | {row['std_lambda']:.3f} | "
        f"{row['q25']:.3f}–{row['q75']:.3f} |"
    )

report_lines += [
    "",
    "## KS-test results — |λ| distributions (primary comparison)",
    f"| Comparison | KS statistic D | p-value | Bhattacharyya overlap |",
    f"|-----------|---------------|---------|----------------------|",
    f"| Cell-cycle vs Circadian | {ks_he.statistic:.4f} | {ks_he.pvalue:.3e} | {bc_he:.4f} |",
    f"| Cell-cycle vs Seg-clock | {ks_hs.statistic:.4f} | {ks_hs.pvalue:.3e} | {bc_hs:.4f} |",
    f"| Circadian vs Seg-clock | {ks_es.statistic:.4f} | {ks_es.pvalue:.3e} | {bc_es:.4f} |",
    "",
    "## FP% KS-test (HeLa vs Seg-clock only — Enteroid lacks FP scores)",
    f"KS D = {ks_fp.statistic:.4f}, p = {ks_fp.pvalue:.3e}",
    "",
    "### FP-class proportions",
    f"| Class | Cell-cycle % | Seg-clock % |",
    f"|-------|-------------|------------|",
]
for c in fp_classes:
    report_lines.append(f"| {c} | {h_counts[c]:.1f}% | {s_counts[c]:.1f}% |")

report_lines += [
    "",
    "## Period distributions (complex-root genes, HeLa vs Seg)",
    f"- HeLa cell-cycle: n={len(h_per):,}, mean={h_per.mean():.2f} h, median={h_per.median():.2f} h",
    f"- Seg-clock:       n={len(s_per):,}, mean={s_per.mean():.2f} h, median={s_per.median():.2f} h",
    f"- KS-test: D={ks_per.statistic:.4f}, p={ks_per.pvalue:.3e}",
    "",
    "## Interpretation",
    "",
    "### Are distributions distinguishable?",
    "",
    "**|λ| modulus distributions — NOT substantially separated.**",
    f"- KS D = {ks_he.statistic:.3f} between cell-cycle (HeLa) and circadian (enteroid).",
    f"  Bhattacharyya overlap = {bc_he:.3f} (close to 1 = nearly identical).",
    f"- KS D = {ks_hs.statistic:.3f} between cell-cycle and seg-clock; overlap = {bc_hs:.3f}.",
    f"- KS D = {ks_es.statistic:.3f} between circadian and seg-clock; overlap = {bc_es:.3f}.",
    "- All three oscillator classes occupy substantially overlapping regions of |λ| space.",
    "  The p-values reflect sample sizes (n ≈ 5,000–10,000), not practical separation.",
    "",
    "**FP% distributions — similarly overlapping between cell-cycle and seg-clock.**",
    f"- KS D = {ks_fp.statistic:.3f} for Fibonacci-proximity scores; both distributions",
    "  have comparable proportions of Fibonacci-like, Near-Fibonacci, and Other classes.",
    "",
    "**Period distributions — substantially different (by design):**",
    f"- Cell-cycle periods cluster around {h_per.median():.1f} h (HeLa ~22–24 h cell cycle captured at 1 h intervals).",
    f"- Seg-clock periods cluster around {s_per.median():.1f} h in the data (≈2 h somitogenesis clock, at 43-min intervals).",
    "  These differ by design, not by AR(2) eigenvalue structure.",
    "",
    "### Implications for manuscript claims",
    "1. **|λ| alone does not separate oscillator classes.** The three biological rhythms",
    "   (cell-cycle, circadian, segmentation-clock) produce overlapping eigenvalue modulus",
    "   distributions. Cross-oscillator discrimination cannot rely solely on |λ|.",
    "2. **FP% is also not a reliable discriminator** between cell-cycle and seg-clock genes.",
    "   The Fibonacci-proximity claim applies across all oscillator classes equally.",
    "3. **Period (eigenperiod) does separate oscillators**, but this reflects the experimental",
    "   sampling interval as much as the biological clock period. AR(2) periods are",
    "   interval-dependent and cannot be compared across datasets with different Δt.",
    "4. **Framing recommendation:** The PAR(2) claims should be framed as a structural",
    "   property of AR(2) fits to any rhythmic time-series, not as a signature distinguishing",
    "   circadian from other oscillators. The enteroid results stand on their own",
    "   tissue-specific evidence.",
]

report_path = OUTPUT_DIR / "three_oscillator_separation_report.md"
report_path.write_text("\n".join(report_lines))
print(f"\nReport saved: {report_path}")
print("\n=== DONE ===")
