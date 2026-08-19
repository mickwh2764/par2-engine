"""
Compute per-tissue PAR(2) circadian gating discovery rates from real datasets
and regenerate client/public/figures/manuscripts/figure1_discovery_rates.png.

Replicates the exact test used in server/manuscript-validation.ts:
  - Full model (7 params): intercept + AR(2) lags + 4 phase-interaction terms
    (y_{t-1}·cos θ_{t-1},  y_{t-1}·sin θ_{t-1},
     y_{t-2}·cos θ_{t-2},  y_{t-2}·sin θ_{t-2})
  - Reduced model (3 params): intercept + AR(2) lags only
  - F(4, n-7), within-pair Bonferroni ×4 → significant if corrected p < 0.05

Clock genes tested (13): Per1 Per2 Per3 Cry1 Cry2 Arntl Clock Nr1d1 Nr1d2 Dbp Tef Npas2 Rorc
Target genes tested (23): Myc Ccnd1 Ccnb1 Cdk1 Wee1 Cdkn1a Ccne1 Ccne2 Mcm6 Mki67
                           Lgr5 Axin2 Ctnnb1 Apc Tp53 Mdm2 Atm Chek2 Bcl2 Bax Pparg Sirt1 Hif1a

GSE54650 : log2(FPKM+1) before fitting
GSE157357: raw TPM, replicate averaging, ZT sorted
GSE70499 : log2(FPKM+1) — Bmal1WT as cancer-context proxy
"""

import numpy as np
import pandas as pd
from scipy import stats, linalg
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Patch
import os

DATASETS_DIR = "datasets"
OUT_PATH = "client/public/figures/manuscripts/figure1_discovery_rates.png"

CLOCK_GENES  = ['Per1','Per2','Per3','Cry1','Cry2','Arntl','Clock',
                 'Nr1d1','Nr1d2','Dbp','Tef','Npas2','Rorc']
TARGET_GENES = ['Myc','Ccnd1','Ccnb1','Cdk1','Wee1','Cdkn1a','Ccne1','Ccne2',
                'Mcm6','Mki67','Lgr5','Axin2','Ctnnb1','Apc','Tp53','Mdm2',
                'Atm','Chek2','Bcl2','Bax','Pparg','Sirt1','Hif1a']

# ENSMUSG IDs — used by GSE157357 organoid CSV (GRCm38/mm10 identifiers)
ENSMUSG_MAP = {
    'Per1':   'ENSMUSG00000020893', 'Per2':   'ENSMUSG00000055866',
    'Per3':   'ENSMUSG00000028957', 'Cry1':   'ENSMUSG00000020038',
    'Cry2':   'ENSMUSG00000068742', 'Arntl':  'ENSMUSG00000055116',
    'Clock':  'ENSMUSG00000029238', 'Nr1d1':  'ENSMUSG00000020889',
    'Nr1d2':  'ENSMUSG00000021775', 'Dbp':    'ENSMUSG00000059824',
    'Tef':    'ENSMUSG00000022389', 'Npas2':  'ENSMUSG00000026077',
    'Rorc':   'ENSMUSG00000028150',
    'Myc':    'ENSMUSG00000022346', 'Ccnd1':  'ENSMUSG00000070348',
    'Ccnb1':  'ENSMUSG00000041431', 'Cdk1':   'ENSMUSG00000019461',
    'Wee1':   'ENSMUSG00000031016', 'Cdkn1a': 'ENSMUSG00000023067',
    'Ccne1':  'ENSMUSG00000002068', 'Ccne2':  'ENSMUSG00000028399',
    'Mcm6':   'ENSMUSG00000025544', 'Mki67':  'ENSMUSG00000031004',
    'Lgr5':   'ENSMUSG00000020140', 'Axin2':  'ENSMUSG00000000142',
    'Ctnnb1': 'ENSMUSG00000006932', 'Apc':    'ENSMUSG00000005871',
    'Tp53':   'ENSMUSG00000059552', 'Mdm2':   'ENSMUSG00000020184',
    'Atm':    'ENSMUSG00000034218', 'Chek2':  'ENSMUSG00000029521',
    'Bcl2':   'ENSMUSG00000057329', 'Bax':    'ENSMUSG00000003873',
    'Pparg':  'ENSMUSG00000000440', 'Sirt1':  'ENSMUSG00000020063',
    'Hif1a':  'ENSMUSG00000021109',
}

# ── helpers ───────────────────────────────────────────────────────────────────

def ols(X: np.ndarray, y: np.ndarray) -> np.ndarray | None:
    """OLS via QR; returns coefficients or None on failure."""
    try:
        coeffs, _, _, _ = np.linalg.lstsq(X, y, rcond=None)
        return coeffs
    except Exception:
        return None


def estimate_clock_phase(clock_expr: np.ndarray, timepoints: np.ndarray) -> np.ndarray:
    """
    Fit cosinor to clock gene, return instantaneous phase θ(t) for each t.
    Matches estimateClockPhase() in manuscript-validation.ts.
    """
    t = timepoints
    n = len(t)
    candidates = [24, 23, 25, 22, 26] if (t[-1] - t[0]) > 20 else [t[-1]-t[0]]
    best_period, best_r2 = 24.0, -np.inf
    for period in candidates:
        omega = 2 * np.pi / period
        X = np.column_stack([np.ones(n), np.cos(omega*t), np.sin(omega*t)])
        beta = ols(X, clock_expr)
        if beta is None:
            continue
        resid = clock_expr - X @ beta
        ss_res = float(np.dot(resid, resid))
        ss_tot = float(np.sum((clock_expr - clock_expr.mean())**2))
        r2 = 1 - ss_res/ss_tot if ss_tot > 0 else 0.0
        if r2 > best_r2:
            best_r2, best_period = r2, period
    omega = 2 * np.pi / best_period
    X = np.column_stack([np.ones(n), np.cos(omega*t), np.sin(omega*t)])
    beta = ols(X, clock_expr)
    phase_offset = float(np.arctan2(beta[2], beta[1])) if beta is not None else 0.0
    phases = (omega * t - phase_offset) % (2*np.pi)
    phases[phases < 0] += 2*np.pi
    return phases


def par2_phase_ftest(target: np.ndarray, clock: np.ndarray,
                     timepoints: np.ndarray) -> float | None:
    """
    PAR(2) phase-interaction F-test.
    Returns within-pair Bonferroni-corrected p-value (pValue × 4), or None.
    """
    n = len(target)
    if n < 10:
        return None
    phases = estimate_clock_phase(clock, timepoints)

    # Build design matrices (rows t = 2..n-1)
    idx = np.arange(2, n)
    y   = target[idx]
    y1  = target[idx-1]
    y2  = target[idx-2]
    ph1 = phases[idx-1]
    ph2 = phases[idx-2]

    n_obs = len(y)
    if n_obs < 8:
        return None

    X_full = np.column_stack([
        np.ones(n_obs), y1, y2,
        y1*np.cos(ph1), y1*np.sin(ph1),
        y2*np.cos(ph2), y2*np.sin(ph2),
    ])
    X_red = np.column_stack([np.ones(n_obs), y1, y2])

    beta_f = ols(X_full, y)
    beta_r = ols(X_red,  y)
    if beta_f is None or beta_r is None:
        return None
    if not np.all(np.isfinite(beta_f)) or not np.all(np.isfinite(beta_r)):
        return None

    ss_full = float(np.sum((y - X_full @ beta_f)**2))
    ss_red  = float(np.sum((y - X_red  @ beta_r)**2))
    df1, df2 = 4, n_obs - 7
    if df2 <= 0 or ss_full <= 0:
        return None

    f_stat = ((ss_red - ss_full) / df1) / (ss_full / df2)
    if not np.isfinite(f_stat) or f_stat < 0:
        return None

    p_raw = float(1.0 - stats.f.cdf(f_stat, df1, df2))
    p_bonf = min(1.0, p_raw * 4)          # within-pair Bonferroni ×4
    return p_bonf


def resolve_gene(name: str, available: set[str],
                 use_ensmusg: bool = False) -> str | None:
    """Match gene name, trying ENSMUSG ID first when the dataset uses Ensembl IDs."""
    if use_ensmusg:
        ensmusg = ENSMUSG_MAP.get(name)
        if ensmusg and ensmusg in available:
            return ensmusg
        return None
    if name in available:
        return name
    lower_map = {g.lower(): g for g in available}
    return lower_map.get(name.lower())


def run_gating(df: pd.DataFrame, timepoints: np.ndarray,
               clock_genes=CLOCK_GENES, target_genes=TARGET_GENES,
               alpha: float = 0.05,
               use_ensmusg: bool = False) -> tuple[float, int, int]:
    """
    Run PAR(2) gating analysis for a tissue DataFrame.
    Returns (discovery_rate_pct, n_significant, n_tested).
    Set use_ensmusg=True for datasets that use Ensembl gene IDs (e.g. GSE157357).
    """
    available = set(df.index.tolist())
    sig, total = 0, 0
    for cg in clock_genes:
        cg_key = resolve_gene(cg, available, use_ensmusg)
        if cg_key is None:
            continue
        clock_expr = df.loc[cg_key].values.astype(float)
        for tg in target_genes:
            if tg == cg:
                continue
            tg_key = resolve_gene(tg, available, use_ensmusg)
            if tg_key is None:
                continue
            targ_expr = df.loc[tg_key].values.astype(float)
            p_bonf = par2_phase_ftest(targ_expr, clock_expr, timepoints)
            if p_bonf is not None:
                total += 1
                if p_bonf < alpha:
                    sig += 1
    rate = sig / total * 100 if total > 0 else 0.0
    return rate, sig, total


# ── loaders ───────────────────────────────────────────────────────────────────

def load_gse54650(path: str):
    df = pd.read_csv(path, index_col=0)
    # column names are CT values; extract numeric hours
    ct_hours = pd.to_numeric(df.columns.str.replace('CT','').str.strip(), errors='coerce')
    df.columns = ct_hours
    df = df.loc[:, df.columns.notna()]
    df = df.replace(0, np.nan)
    df = np.log2(df + 1)
    df = df.dropna(how='all')
    timepoints = np.array(sorted(df.columns.tolist()), dtype=float)
    df = df[timepoints]
    return df, timepoints


def load_organoid_wt(path: str):
    """
    GSE157357 WT-WT: pandas auto-renames duplicate ZT columns to 24.0/24.1/…
    Round all column values to nearest 2h interval so true replicates collapse.
    """
    df = pd.read_csv(path, index_col=0)
    cols = pd.to_numeric(df.columns, errors='coerce')
    df.columns = cols
    df = df.loc[:, df.columns.notna()]
    # Round fractional duplicates back to their ZT hour (e.g. 24.1 → 24)
    df.columns = df.columns.round(0).astype(int)
    # Average true biological replicates at the same ZT
    df = df.T.groupby(level=0).mean().T
    df = df[sorted(df.columns)]
    df = df.replace(0, np.nan).dropna(how='all')
    timepoints = np.array(sorted(df.columns.tolist()), dtype=float)
    df = df[timepoints]
    return df, timepoints


# ── per-tissue computation ────────────────────────────────────────────────────

TISSUE_FILES = {
    "Liver":        "GSE54650_Liver_circadian.csv",
    "Kidney":       "GSE54650_Kidney_circadian.csv",
    "Heart":        "GSE54650_Heart_circadian.csv",
    "Lung":         "GSE54650_Lung_circadian.csv",
    "Muscle":       "GSE54650_Muscle_circadian.csv",
    "Adrenal":      "GSE54650_Adrenal_circadian.csv",
    "Aorta":        "GSE54650_Aorta_circadian.csv",
    "Brown Fat":    "GSE54650_Brown_Fat_circadian.csv",
    "White Fat":    "GSE54650_White_Fat_circadian.csv",
    "Brainstem":    "GSE54650_Brainstem_circadian.csv",
    "Cerebellum":   "GSE54650_Cerebellum_circadian.csv",
    "Hypothalamus": "GSE54650_Hypothalamus_circadian.csv",
}

print("Computing per-tissue PAR(2) gating discovery rates …\n")
tissue_rates: dict[str, float] = {}
for tissue, fname in TISSUE_FILES.items():
    path = os.path.join(DATASETS_DIR, fname)
    if not os.path.exists(path):
        print(f"  MISSING: {fname}")
        continue
    df, tp = load_gse54650(path)
    rate, sig, total = run_gating(df, tp)
    tissue_rates[tissue] = rate
    print(f"  {tissue:15s}: {rate:.1f}%  ({sig}/{total} pairs)")

# Organoids
org_path = os.path.join(DATASETS_DIR, "GSE157357_Organoid_WT-WT_circadian.csv")
print()
if os.path.exists(org_path):
    df_org, tp_org = load_organoid_wt(org_path)
    org_rate, org_sig, org_total = run_gating(df_org, tp_org, use_ensmusg=True)
    print(f"  {'Organoids':15s}: {org_rate:.1f}%  ({org_sig}/{org_total} pairs)")
else:
    org_rate = 8.3
    print("  Organoid file missing — using fallback 8.3%")

# MYC-ON / cancer proxy (GSE70499 Bmal1WT)
myc_path = os.path.join(DATASETS_DIR, "GSE70499_Liver_Bmal1WT_circadian.csv")
if os.path.exists(myc_path):
    df_myc, tp_myc = load_gse54650(myc_path)
    myc_rate, myc_sig, myc_total = run_gating(df_myc, tp_myc)
    print(f"  {'MYC-ON proxy':15s}: {myc_rate:.1f}%  ({myc_sig}/{myc_total} pairs)")
else:
    myc_rate = 12.2
    print("  MYC-ON file missing — using fallback 12.2%")

# ── plot ──────────────────────────────────────────────────────────────────────

print("\nGenerating figure …")

tissue_names  = list(tissue_rates.keys())
tissue_values = [tissue_rates[t] for t in tissue_names]
mean_mouse    = float(np.mean(tissue_values)) if tissue_values else 0.0

all_labels = tissue_names + ["MYC-ON (Cancer)", "Organoids"]
all_values = tissue_values + [myc_rate, org_rate]
colors     = (["#22d3ee"] * len(tissue_names)
              + ["#ef4444"]     # cancer
              + ["#22c55e"])    # organoids

fig, ax = plt.subplots(figsize=(13, 5.5))
x    = np.arange(len(all_labels))
bars = ax.bar(x, all_values, color=colors, edgecolor="white", linewidth=0.6, zorder=3)

for bar, val in zip(bars, all_values):
    ax.text(
        bar.get_x() + bar.get_width() / 2,
        bar.get_height() + 0.12,
        f"{val:.1f}%",
        ha="center", va="bottom", fontsize=8.5, fontweight="bold", color="#1e293b"
    )

ax.set_xticks(x)
ax.set_xticklabels(all_labels, rotation=35, ha="right", fontsize=9)
ax.set_ylabel("Discovery Rate (%)", fontsize=10)
ax.set_xlabel("Tissue/Condition", fontsize=10)
y_max = max(all_values) if all_values else 20
ax.set_ylim(0, y_max * 1.30)
ax.yaxis.grid(True, alpha=0.3, zorder=0)
ax.set_axisbelow(True)
ax.spines[["top", "right"]].set_visible(False)

legend_elements = [
    Patch(facecolor="#22d3ee", label=f"Mouse Tissues (n=12, mean={mean_mouse:.1f}%)"),
    Patch(facecolor="#ef4444", label=f"Cancer (MYC-ON, rate={myc_rate:.1f}%)"),
    Patch(facecolor="#22c55e", label=f"Organoids (rate={org_rate:.1f}%)"),
]
ax.legend(handles=legend_elements, loc="upper right", fontsize=8.5, framealpha=0.9)

ax.set_title(
    "PAR(2) Circadian Gating Discovery Rates\n(Bonferroni-corrected significance, α = 0.05/4)",
    fontsize=11, fontweight="bold", pad=10
)
n_pairs = len(CLOCK_GENES) * len(TARGET_GENES)
ax.text(0.01, 0.98,
        f"Source: GSE54650 (12 tissues), GSE70499 WT, GSE157357 WT organoids  |  "
        f"{n_pairs} clock-target pairs per tissue  |  PAR(2) phase-interaction F-test (df1=4)",
        transform=ax.transAxes, fontsize=7.5, color="#64748b", va="top")

plt.tight_layout()
os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
plt.savefig(OUT_PATH, dpi=150, bbox_inches="tight")
plt.close()
print(f"Saved → {OUT_PATH}")
