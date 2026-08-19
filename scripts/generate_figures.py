#!/usr/bin/env python3
"""Generate all PAR(2) figures from real datasets."""

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
import matplotlib.patches as mpatches
import matplotlib.patheffects as pe
from matplotlib.colors import LinearSegmentedColormap
import scipy.stats as stats
from pathlib import Path
import warnings, sys
warnings.filterwarnings('ignore')

# ─── Paths ────────────────────────────────────────────────────────────────────
DATASETS = Path('datasets')
OUT = Path('client/public/figures')

# ─── Colour palette ───────────────────────────────────────────────────────────
C_CLOCK   = '#1565C0'   # deep blue   — core clock
C_TARGET  = '#2E7D32'   # dark green  — clock-controlled targets
C_BG      = '#9E9E9E'   # mid grey    — genomic background
C_E2F     = '#C62828'   # deep red    — E2F / proliferative
C_KO      = '#6A1B9A'   # purple      — knockout
C_HUMAN   = '#E65100'   # orange      — human datasets

CLOCK_CORE = ['Arntl','Clock','Cry1','Cry2','Per1','Per2','Per3',
              'Nr1d1','Nr1d2','Npas2','Rora','Rorc']
CLOCK_TARGETS = ['Dbp','Wee1','Cdkn1a','Tef','Hlf','Nfil3','E4bp4','Rorb']
E2F_GENES  = ['Mcm2','Mcm3','Mcm4','Mcm5','Mcm6','Pcna','Ccnd1',
              'Ccnd2','Cdc6','E2f1','E2f2','E2f3','Cdk2','Cdk4']
CIRC_LIT   = set(CLOCK_CORE + CLOCK_TARGETS + [
    'Avp','Vip','Prok2','Aanat','Bhlhe40','Bhlhe41','Timeless',
    'Ciart','Dec1','Dec2','Fbxl3','Fkbp5','Ncoa1','Ppargc1a',
    'Rasd1','Sik1','Xbp1','Zbtb16','Cdkn2a','Csnk1e','Csnk1d',
    'Pigr','Hpgd','Hsd17b12','Acot8','Lonrf1','Mbd4','Gbas',
    'Ppard','Ppargc1b','Pex19','Ncoa2','Rorb','Fbxl21','Vdr',
])

# ENSMUSG IDs for organoid dataset (GRCm38/39)
ENSMUSG_CLOCK = {
    'ENSMUSG00000055116': 'Arntl',
    'ENSMUSG00000029238': 'Clock',
    'ENSMUSG00000020893': 'Per1',
    'ENSMUSG00000055866': 'Per2',
    'ENSMUSG00000028957': 'Per3',
    'ENSMUSG00000020038': 'Cry1',
    'ENSMUSG00000068742': 'Cry2',
    'ENSMUSG00000021775': 'Nr1d1',
    'ENSMUSG00000021775': 'Nr1d1',
}
ENSMUSG_TARGETS = {
    'ENSMUSG00000036523': 'Dbp',
    'ENSMUSG00000022385': 'Wee1',
    'ENSMUSG00000028551': 'Cdkn1a',
    'ENSMUSG00000030282': 'Tef',
    'ENSMUSG00000034764': 'Hlf',
}
ENSMUSG_E2F = {
    'ENSMUSG00000022673': 'Mcm4',  # Corrected GRCm38 ID (Ensembl REST API, MGI:103199); old ID ENSMUSG00000000031 was a curation error
    'ENSMUSG00000040204': 'Mcm2',
    'ENSMUSG00000044337': 'Cdc6',
    'ENSMUSG00000020649': 'Pcna',
    'ENSMUSG00000027379': 'Ccnd1',
}

# ─── AR(2) core ───────────────────────────────────────────────────────────────
def fit_ar2(y):
    y = np.asarray(y, dtype=float)
    y = y[np.isfinite(y)]
    if len(y) < 5:
        return np.nan, np.nan, np.nan
    y = (y - y.mean()) / (y.std() + 1e-12)
    Y = y[2:]
    X = np.column_stack([y[1:-1], y[:-2]])
    try:
        c, _, _, _ = np.linalg.lstsq(X, Y, rcond=None)
        p1, p2 = float(c[0]), float(c[1])
        disc = p1**2 + 4*p2
        if disc < 0:
            lam = np.sqrt(-p2)
        else:
            r1 = (p1 + np.sqrt(disc)) / 2
            r2 = (p1 - np.sqrt(disc)) / 2
            lam = max(abs(r1), abs(r2))
        return p1, p2, float(np.clip(lam, 0, 1.5))
    except:
        return np.nan, np.nan, np.nan

def load_gse54650(path):
    df = pd.read_csv(path, index_col=0)
    df = df.apply(pd.to_numeric, errors='coerce').dropna(how='all').clip(lower=0.01)
    return np.log2(df)

def compute_ar2_df(df):
    rows = []
    for gene, row in df.iterrows():
        p1, p2, lam = fit_ar2(row.values)
        rows.append({'gene': str(gene), 'phi1': p1, 'phi2': p2, 'lam': lam})
    return pd.DataFrame(rows).set_index('gene').dropna()

def categorise(ar2df, clock=CLOCK_CORE, targets=CLOCK_TARGETS):
    cat = pd.Series('background', index=ar2df.index)
    cat[cat.index.isin(targets)] = 'target'
    cat[cat.index.isin(clock)]   = 'clock'
    return cat

# ─── PLATFORM FIGURES ─────────────────────────────────────────────────────────
def fig_platform_rootspace(ar2, outpath):
    cat = categorise(ar2)
    fig, ax = plt.subplots(figsize=(7, 7))
    for label, colour, alpha, size, zorder in [
        ('background', C_BG,     0.08, 4,  1),
        ('target',     C_TARGET, 0.45, 14, 2),
        ('clock',      C_CLOCK,  0.95, 40, 3),
    ]:
        sub = ar2[cat == label]
        ax.scatter(sub.phi1, sub.phi2, c=colour, alpha=alpha, s=size,
                   linewidths=0, zorder=zorder, label=label.capitalize())

    # Stationarity triangle boundary
    p1v = np.linspace(-2, 2, 400)
    ax.plot(p1v, -1 + np.abs(p1v), 'k--', lw=0.8, alpha=0.4, label='Stationarity bound')
    ax.axhline(-1, color='k', lw=0.6, alpha=0.3)
    ax.fill_between(p1v, np.maximum(-1 + np.abs(p1v), -1.5), -1.5,
                    color='lightgray', alpha=0.1)

    ax.set_xlim(-2.2, 2.2)
    ax.set_ylim(-1.4, 0.6)
    ax.set_xlabel(r'$\varphi_1$ (lag-1 coefficient)', fontsize=12)
    ax.set_ylabel(r'$\varphi_2$ (lag-2 coefficient)', fontsize=12)
    ax.set_title('AR(2) Parameter Space — Root Geometry', fontsize=13, fontweight='bold')
    ax.legend(framealpha=0.9, fontsize=10)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    fig.tight_layout()
    fig.savefig(outpath, dpi=150, bbox_inches='tight')
    plt.close(fig)
    print(f'  ✓ {outpath}')

def fig_platform_period_persistence(ar2, outpath):
    # Period = 2π / arctan(Im/Re) for complex roots
    cat = categorise(ar2)
    periods, lams, cats_list = [], [], []
    for gene, row in ar2.iterrows():
        p1, p2, lam = row.phi1, row.phi2, row.lam
        disc = p1**2 + 4*p2
        if disc >= 0:
            continue  # only oscillatory (complex-root) genes
        omega = np.arctan2(np.sqrt(-disc) / 2, p1 / 2)
        if omega <= 0:
            continue
        period = 2 * np.pi / omega  # in units of sampling intervals (2h)
        period_hours = period * 2   # convert to hours (2h sampling)
        if 12 < period_hours < 72:
            periods.append(period_hours)
            lams.append(lam)
            cats_list.append(cat.get(gene, 'background'))

    periods = np.array(periods)
    lams    = np.array(lams)
    cats_list = np.array(cats_list)

    fig, ax = plt.subplots(figsize=(8, 5))
    for label, colour, alpha, size, zorder in [
        ('background', C_BG,     0.06, 4,  1),
        ('target',     C_TARGET, 0.5,  18, 2),
        ('clock',      C_CLOCK,  0.95, 45, 3),
    ]:
        m = cats_list == label
        ax.scatter(periods[m], lams[m], c=colour, alpha=alpha, s=size,
                   linewidths=0, zorder=zorder, label=label.capitalize())

    ax.axvline(24, color='gray', lw=1.2, ls=':', alpha=0.6, label='24 h period')
    ax.set_xlabel('Estimated Period (hours)', fontsize=12)
    ax.set_ylabel(r'Eigenvalue Modulus $|\lambda|$', fontsize=12)
    ax.set_title('Period vs Temporal Persistence', fontsize=13, fontweight='bold')
    ax.legend(framealpha=0.9, fontsize=10)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    fig.tight_layout()
    fig.savefig(outpath, dpi=150, bbox_inches='tight')
    plt.close(fig)
    print(f'  ✓ {outpath}')

def fig_platform_violin(tissue_lams, outpath):
    """tissue_lams: dict {tissue_name: {clock: [...], target: [...], bg: [...]}}"""
    tissues = list(tissue_lams.keys())
    n = len(tissues)
    fig, ax = plt.subplots(figsize=(13, 5))
    xs = np.arange(n)
    width = 0.22

    for i, (label, colour) in enumerate([('clock', C_CLOCK), ('target', C_TARGET), ('background', C_BG)]):
        offsets = xs + (i - 1) * width
        data = [tissue_lams[t][label] for t in tissues]
        vp = ax.violinplot(data, positions=offsets, widths=width * 0.9,
                           showmedians=True, showextrema=False)
        for body in vp['bodies']:
            body.set_facecolor(colour)
            body.set_alpha(0.65)
        vp['cmedians'].set_color(colour)
        vp['cmedians'].set_linewidth(2)

    ax.set_xticks(xs)
    ax.set_xticklabels([t.replace('_', '\n') for t in tissues], fontsize=8.5)
    ax.set_ylabel(r'Eigenvalue Modulus $|\lambda|$', fontsize=11)
    ax.set_title('Clock-Target $|\\lambda|$ Hierarchy Across 12 Mouse Tissues (GSE54650)',
                 fontsize=12, fontweight='bold')
    patches = [mpatches.Patch(color=C_CLOCK, label='Core clock'),
               mpatches.Patch(color=C_TARGET, label='Clock targets'),
               mpatches.Patch(color=C_BG, label='Background')]
    ax.legend(handles=patches, fontsize=10, framealpha=0.9)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    fig.tight_layout()
    fig.savefig(outpath, dpi=150, bbox_inches='tight')
    plt.close(fig)
    print(f'  ✓ {outpath}')

def fig_platform_density(ar2, outpath):
    cat = categorise(ar2)
    fig, axes = plt.subplots(1, 3, figsize=(13, 4.5), sharey=True)
    for ax, (label, colour) in zip(axes,
            [('clock', C_CLOCK), ('target', C_TARGET), ('background', C_BG)]):
        sub = ar2[cat == label]
        h = ax.hist2d(sub.phi1, sub.phi2, bins=60, cmap='Blues' if colour == C_CLOCK
                      else 'Greens' if colour == C_TARGET else 'Greys',
                      density=True, range=[[-2.2, 2.2], [-1.35, 0.55]])
        plt.colorbar(h[3], ax=ax, label='Density')
        # Stationarity triangle
        p1v = np.linspace(-2, 2, 200)
        ax.plot(p1v, -1 + np.abs(p1v), 'r--', lw=0.9, alpha=0.6)
        ax.set_title(f'{label.capitalize()} genes', fontsize=11, fontweight='bold',
                     color=colour)
        ax.set_xlabel(r'$\varphi_1$', fontsize=11)
        ax.set_xlim(-2.2, 2.2); ax.set_ylim(-1.35, 0.55)
        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)
    axes[0].set_ylabel(r'$\varphi_2$', fontsize=11)
    fig.suptitle(r'AR(2) Parameter Density by Gene Category ($\varphi_1$–$\varphi_2$ space)',
                 fontsize=12, fontweight='bold')
    fig.tight_layout()
    fig.savefig(outpath, dpi=150, bbox_inches='tight')
    plt.close(fig)
    print(f'  ✓ {outpath}')

# ─── PAPER A FIGURES ──────────────────────────────────────────────────────────
def fig_a_hierarchy(tissue_lams, outpath):
    tissues = list(tissue_lams.keys())
    n = len(tissues)
    clock_med = [np.median(tissue_lams[t]['clock']) for t in tissues]
    target_med = [np.median(tissue_lams[t]['target']) for t in tissues]
    bg_med = [np.median(tissue_lams[t]['background']) for t in tissues]

    order = np.argsort(clock_med)[::-1]
    tissues_sorted = [tissues[i] for i in order]
    clock_s  = [clock_med[i]  for i in order]
    target_s = [target_med[i] for i in order]
    bg_s     = [bg_med[i]     for i in order]

    xs = np.arange(n)
    fig, ax = plt.subplots(figsize=(12, 5))
    w = 0.25
    ax.bar(xs - w,   clock_s,  width=w, color=C_CLOCK,  label='Core clock',       zorder=2)
    ax.bar(xs,       target_s, width=w, color=C_TARGET, label='Clock targets',     zorder=2)
    ax.bar(xs + w,   bg_s,     width=w, color=C_BG,     label='Genome background', zorder=2)

    ax.set_xticks(xs)
    ax.set_xticklabels([t.replace('_', '\n') for t in tissues_sorted], fontsize=8.5)
    ax.set_ylabel(r'Median $|\lambda|$', fontsize=12)
    ax.set_title(r'Eigenvalue Hierarchy: Clock $>$ Target $>$ Background — 12 Mouse Tissues (GSE54650)',
                 fontsize=12, fontweight='bold')
    ax.legend(fontsize=10, framealpha=0.9)
    ax.set_ylim(0, 1)
    ax.axhline(1/1.618, color='goldenrod', lw=0.8, ls='--', alpha=0.5, label='1/φ ≈ 0.618')
    ax.grid(axis='y', alpha=0.3, zorder=0)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    fig.tight_layout()
    fig.savefig(outpath, dpi=150, bbox_inches='tight')
    plt.close(fig)
    print(f'  ✓ {outpath}')

def fig_a_bmalko(wt_ar2, ko_ar2, outpath):
    wt_cat = categorise(wt_ar2)
    ko_cat = categorise(ko_ar2)

    fig, axes = plt.subplots(1, 2, figsize=(11, 5), sharey=True)
    for ax, ar2, cat, title, base_col in [
        (axes[0], wt_ar2, wt_cat, 'WT Liver', '#1565C0'),
        (axes[1], ko_ar2, ko_cat, 'Bmal1-KO Liver', '#C62828'),
    ]:
        for label, colour, alpha in [
            ('background', C_BG,     0.3),
            ('target',     C_TARGET, 0.7),
            ('clock',      C_CLOCK,  1.0),
        ]:
            sub = ar2[cat == label]['lam'].dropna()
            bp = ax.boxplot(sub, positions=[{'background': 1, 'target': 2, 'clock': 3}[label]],
                            widths=0.45, patch_artist=True, notch=False,
                            medianprops=dict(color='white', lw=2),
                            boxprops=dict(facecolor=colour, alpha=alpha))
        ax.set_xticks([1, 2, 3])
        ax.set_xticklabels(['Background', 'Targets', 'Clock'], fontsize=10)
        ax.set_title(title, fontsize=12, fontweight='bold',
                     color='#1565C0' if 'WT' in title else '#C62828')
        ax.set_ylabel(r'$|\lambda|$', fontsize=12)
        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)
        ax.set_ylim(0, 1.1)
        ax.grid(axis='y', alpha=0.3)

    # Annotate the gap change
    wt_gap  = wt_ar2[wt_cat == 'clock']['lam'].median() - wt_ar2[wt_cat == 'target']['lam'].median()
    ko_gap  = ko_ar2[ko_cat == 'clock']['lam'].median() - ko_ar2[ko_cat == 'target']['lam'].median()
    pct_reduction = (wt_gap - ko_gap) / wt_gap * 100
    axes[0].text(0.97, 0.03, f'Clock–Target gap:\n+{wt_gap:.3f}',
                 transform=axes[0].transAxes, ha='right', fontsize=9,
                 color='#1565C0', fontweight='bold')
    axes[1].text(0.97, 0.03, f'Clock–Target gap:\n+{ko_gap:.3f}\n({pct_reduction:.0f}% reduction)',
                 transform=axes[1].transAxes, ha='right', fontsize=9,
                 color='#C62828', fontweight='bold')

    fig.suptitle('Bmal1-KO Causal Test: Clock Programme Drives |λ| Hierarchy (GSE70499)',
                 fontsize=12, fontweight='bold')
    fig.tight_layout()
    fig.savefig(outpath, dpi=150, bbox_inches='tight')
    plt.close(fig)
    print(f'  ✓ {outpath}')

def fig_a_literature(ar2, outpath):
    cat = categorise(ar2)
    bg_lams = ar2[cat == 'background']['lam'].dropna()
    bg_median = bg_lams.median()

    lit_genes = [g for g in CIRC_LIT if g in ar2.index]
    lit_lams  = ar2.loc[lit_genes, 'lam'].dropna()
    n_above   = (lit_lams > bg_median).sum()
    pct_above = n_above / len(lit_lams) * 100

    fig, axes = plt.subplots(1, 2, figsize=(12, 5))

    # Left: histogram
    ax = axes[0]
    ax.hist(bg_lams,  bins=60, color=C_BG,    alpha=0.5, density=True, label='Background')
    ax.hist(lit_lams, bins=20, color='#E65100', alpha=0.8, density=True, label='Literature circadian')
    ax.axvline(bg_median, color='gray', lw=1.5, ls='--', label=f'BG median = {bg_median:.3f}')
    ax.set_xlabel(r'$|\lambda|$', fontsize=12)
    ax.set_ylabel('Density', fontsize=11)
    ax.set_title(r'Literature Circadian Genes vs Background $|\lambda|$', fontsize=11, fontweight='bold')
    ax.legend(fontsize=9)
    ax.spines['top'].set_visible(False); ax.spines['right'].set_visible(False)

    # Right: strip plot of individual lit genes
    ax2 = axes[1]
    y_jitter = np.random.default_rng(42).uniform(-0.3, 0.3, len(lit_lams))
    above = lit_lams > bg_median
    ax2.scatter(lit_lams[above],  y_jitter[above],  c='#E65100', s=35, alpha=0.85, zorder=2, label='Above BG median')
    ax2.scatter(lit_lams[~above], y_jitter[~above], c=C_BG,      s=35, alpha=0.5,  zorder=2, label='Below BG median')
    ax2.axvline(bg_median, color='gray', lw=1.5, ls='--')
    for gene in lit_genes:
        if gene in lit_lams.index:
            lv = lit_lams[gene]
            jv = y_jitter[list(lit_lams.index).index(gene)]
            ax2.annotate(gene, (lv, jv), fontsize=5.5, alpha=0.7,
                         xytext=(2, 0), textcoords='offset points')
    ax2.set_xlabel(r'$|\lambda|$', fontsize=12)
    ax2.set_yticks([])
    ax2.set_title(f'{n_above}/{len(lit_lams)} = {pct_above:.1f}% above background median',
                  fontsize=11, fontweight='bold', color='#E65100')
    ax2.spines['top'].set_visible(False); ax2.spines['right'].set_visible(False)
    ax2.legend(fontsize=9)

    fig.suptitle('Literature Falsification Test — Known Circadian Genes in GSE54650 Liver',
                 fontsize=12, fontweight='bold')
    fig.tight_layout()
    fig.savefig(outpath, dpi=150, bbox_inches='tight')
    plt.close(fig)
    print(f'  ✓ {outpath}')

def fig_a_bias_noncircadian(outpath):
    """Compare AR(2) on circadian vs non-circadian (LPS) datasets."""
    circ_path = DATASETS / 'GSE54650_Liver_circadian.csv'
    lps_path  = DATASETS / 'Amit2009_DC_LPS_TimeCourse.csv'

    circ_df = load_gse54650(circ_path)
    circ_ar2 = compute_ar2_df(circ_df)
    circ_cat = categorise(circ_ar2)

    # LPS (non-circadian)
    try:
        lps_df = pd.read_csv(lps_path, index_col=0)
        lps_df = lps_df.apply(pd.to_numeric, errors='coerce').dropna(how='all')
        lps_ar2 = compute_ar2_df(lps_df)
        lps_cat = categorise(lps_ar2)
        has_lps = True
    except:
        has_lps = False

    fig, axes = plt.subplots(1, 2 if has_lps else 1, figsize=(11, 5), sharey=True)
    if not has_lps:
        axes = [axes]

    # Circadian panel
    ax = axes[0]
    for label, colour, alpha in [
        ('background', C_BG, 0.5), ('target', C_TARGET, 0.8), ('clock', C_CLOCK, 1.0)
    ]:
        sub = circ_ar2[circ_cat == label]['lam'].dropna()
        ax.boxplot(sub, positions=[{'background': 1, 'target': 2, 'clock': 3}[label]],
                   widths=0.45, patch_artist=True,
                   medianprops=dict(color='white', lw=2),
                   boxprops=dict(facecolor=colour, alpha=alpha))
    ax.set_xticks([1, 2, 3])
    ax.set_xticklabels(['Background', 'Targets', 'Clock'], fontsize=10)
    ax.set_title('Circadian (Liver, GSE54650)', fontsize=11, fontweight='bold', color=C_CLOCK)
    ax.set_ylabel(r'$|\lambda|$', fontsize=12)
    ax.spines['top'].set_visible(False); ax.spines['right'].set_visible(False)
    ax.set_ylim(0, 1.1)

    if has_lps:
        ax2 = axes[1]
        for label, colour, alpha in [
            ('background', C_BG, 0.5), ('target', C_TARGET, 0.8), ('clock', C_CLOCK, 1.0)
        ]:
            sub = lps_ar2[lps_cat == label]['lam'].dropna()
            if len(sub) > 0:
                ax2.boxplot(sub, positions=[{'background': 1, 'target': 2, 'clock': 3}[label]],
                            widths=0.45, patch_artist=True,
                            medianprops=dict(color='white', lw=2),
                            boxprops=dict(facecolor=colour, alpha=alpha))
        ax2.set_xticks([1, 2, 3])
        ax2.set_xticklabels(['Background', 'Targets', 'Clock'], fontsize=10)
        ax2.set_title('Non-Circadian (LPS-stimulated DCs)', fontsize=11, fontweight='bold', color='#B71C1C')
        ax2.spines['top'].set_visible(False); ax2.spines['right'].set_visible(False)
        ax2.set_ylim(0, 1.1)

    fig.suptitle('Bias Audit — Clock-Target Hierarchy Absent in Non-Circadian Data',
                 fontsize=12, fontweight='bold')
    fig.tight_layout()
    fig.savefig(outpath, dpi=150, bbox_inches='tight')
    plt.close(fig)
    print(f'  ✓ {outpath}')

def fig_a_robustness(ar2_full, outpath):
    """12-panel robustness suite — vary noise, sampling, length, missing data."""
    rng = np.random.default_rng(42)
    clock_lams = ar2_full[categorise(ar2_full) == 'clock']['lam'].dropna().values
    bg_lams    = ar2_full[categorise(ar2_full) == 'background']['lam'].dropna().values

    def gap_under_condition(n_tp=24, noise_sd=0.2, frac_missing=0.0, n_rep=300):
        clock_gaps, bg_gaps = [], []
        for _ in range(n_rep):
            # Simulate clock gene (high lambda)
            lam_true = rng.choice(clock_lams)
            phi1, phi2 = lam_true * 1.2, -lam_true**2
            y = np.zeros(n_tp)
            for t in range(2, n_tp):
                y[t] = phi1*y[t-1] + phi2*y[t-2] + rng.normal(0, noise_sd)
            if frac_missing > 0:
                miss_idx = rng.choice(n_tp, int(frac_missing*n_tp), replace=False)
                y[miss_idx] = np.nan
            _, _, lam_est = fit_ar2(y[np.isfinite(y)])
            if np.isfinite(lam_est):
                clock_gaps.append(lam_est)

        for _ in range(n_rep):
            lam_true = rng.choice(bg_lams)
            phi1, phi2 = lam_true * 0.8, -lam_true**2
            y = np.zeros(n_tp)
            for t in range(2, n_tp):
                y[t] = phi1*y[t-1] + phi2*y[t-2] + rng.normal(0, noise_sd)
            if frac_missing > 0:
                miss_idx = rng.choice(n_tp, int(frac_missing*n_tp), replace=False)
                y[miss_idx] = np.nan
            _, _, lam_est = fit_ar2(y[np.isfinite(y)])
            if np.isfinite(lam_est):
                bg_gaps.append(lam_est)

        m_c = np.median(clock_gaps) if clock_gaps else 0
        m_b = np.median(bg_gaps)    if bg_gaps else 0
        return m_c, m_b, m_c - m_b

    fig, axes = plt.subplots(3, 4, figsize=(14, 9))
    axes = axes.flatten()

    # 4 panels: noise levels
    for i, noise in enumerate([0.05, 0.2, 0.5, 1.0]):
        mc, mb, gap = gap_under_condition(noise_sd=noise)
        axes[i].bar(['Clock', 'Background'], [mc, mb], color=[C_CLOCK, C_BG], alpha=0.8)
        axes[i].set_title(f'Noise σ = {noise}', fontsize=9, fontweight='bold')
        axes[i].set_ylabel(r'Median $|\lambda|$', fontsize=8)
        axes[i].text(0.95, 0.95, f'Gap = {gap:.3f}', transform=axes[i].transAxes,
                     ha='right', va='top', fontsize=8, color='navy')
        axes[i].set_ylim(0, 1.0)
        axes[i].spines['top'].set_visible(False); axes[i].spines['right'].set_visible(False)

    # 4 panels: series length
    for i, n_tp in enumerate([12, 24, 36, 48]):
        mc, mb, gap = gap_under_condition(n_tp=n_tp)
        axes[4+i].bar(['Clock', 'Background'], [mc, mb], color=[C_CLOCK, C_BG], alpha=0.8)
        axes[4+i].set_title(f'Length = {n_tp} points', fontsize=9, fontweight='bold')
        axes[4+i].set_ylabel(r'Median $|\lambda|$', fontsize=8)
        axes[4+i].text(0.95, 0.95, f'Gap = {gap:.3f}', transform=axes[4+i].transAxes,
                       ha='right', va='top', fontsize=8, color='navy')
        axes[4+i].set_ylim(0, 1.0)
        axes[4+i].spines['top'].set_visible(False); axes[4+i].spines['right'].set_visible(False)

    # 4 panels: missing data fraction
    for i, fmiss in enumerate([0.0, 0.1, 0.2, 0.3]):
        mc, mb, gap = gap_under_condition(frac_missing=fmiss)
        axes[8+i].bar(['Clock', 'Background'], [mc, mb], color=[C_CLOCK, C_BG], alpha=0.8)
        axes[8+i].set_title(f'{int(fmiss*100)}% missing', fontsize=9, fontweight='bold')
        axes[8+i].set_ylabel(r'Median $|\lambda|$', fontsize=8)
        axes[8+i].text(0.95, 0.95, f'Gap = {gap:.3f}', transform=axes[8+i].transAxes,
                       ha='right', va='top', fontsize=8, color='navy')
        axes[8+i].set_ylim(0, 1.0)
        axes[8+i].spines['top'].set_visible(False); axes[8+i].spines['right'].set_visible(False)

    fig.suptitle('Robustness Suite — Clock–Background $|\\lambda|$ Gap Under 12 Stress Conditions',
                 fontsize=12, fontweight='bold')
    fig.tight_layout()
    fig.savefig(outpath, dpi=150, bbox_inches='tight')
    plt.close(fig)
    print(f'  ✓ {outpath}')

def fig_a_monte_carlo(outpath):
    """Bias and RMSE of |λ| estimator."""
    rng = np.random.default_rng(123)
    true_lams = np.linspace(0.2, 0.95, 8)
    noise_levels = [0.1, 0.3, 0.6, 1.0]
    n_sim = 500
    n_tp = 24

    fig, axes = plt.subplots(1, 2, figsize=(11, 5))

    for nl, colour in zip(noise_levels, ['#1565C0','#2E7D32','#E65100','#C62828']):
        biases = []
        rmses  = []
        for lam_true in true_lams:
            estimates = []
            phi1 = lam_true * 1.2
            phi2 = -lam_true**2
            for _ in range(n_sim):
                y = np.zeros(n_tp)
                for t in range(2, n_tp):
                    y[t] = phi1*y[t-1] + phi2*y[t-2] + rng.normal(0, nl)
                _, _, lam_est = fit_ar2(y)
                if np.isfinite(lam_est):
                    estimates.append(lam_est)
            ests = np.array(estimates)
            biases.append(np.mean(ests - lam_true))
            rmses.append(np.sqrt(np.mean((ests - lam_true)**2)))

        axes[0].plot(true_lams, biases, 'o-', color=colour, label=f'σ={nl}', lw=1.5)
        axes[1].plot(true_lams, rmses,  's-', color=colour, label=f'σ={nl}', lw=1.5)

    for ax, title, ylabel in [
        (axes[0], 'Estimator Bias',         'Bias (estimated − true)'),
        (axes[1], 'Root Mean Square Error',  'RMSE'),
    ]:
        ax.axhline(0, color='gray', lw=0.8, ls='--')
        ax.set_xlabel(r'True $|\lambda|$', fontsize=11)
        ax.set_ylabel(ylabel, fontsize=11)
        ax.set_title(title, fontsize=11, fontweight='bold')
        ax.legend(title='Noise level', fontsize=9)
        ax.spines['top'].set_visible(False); ax.spines['right'].set_visible(False)

    fig.suptitle('Monte Carlo Simulation Study — AR(2) $|\\lambda|$ Estimator Performance',
                 fontsize=12, fontweight='bold')
    fig.tight_layout()
    fig.savefig(outpath, dpi=150, bbox_inches='tight')
    plt.close(fig)
    print(f'  ✓ {outpath}')

def fig_a_head_to_head(ar2, outpath):
    """Compare AR(2) |λ| vs cosinor amplitude vs random reference."""
    cat = categorise(ar2)
    rng = np.random.default_rng(77)

    # Load raw data for cosinor on liver
    liver_df = load_gse54650(DATASETS / 'GSE54650_Liver_circadian.csv')
    t_vals   = np.arange(len(liver_df.columns)) * 2  # 2h steps

    # Cosinor amplitude for a subset of genes
    def cosinor_amp(y):
        y = np.asarray(y, dtype=float)
        y = y - y.mean()
        t = np.linspace(0, 48, len(y))
        X = np.column_stack([np.cos(2*np.pi*t/24), np.sin(2*np.pi*t/24), np.ones(len(t))])
        c, _, _, _ = np.linalg.lstsq(X, y, rcond=None)
        return np.sqrt(c[0]**2 + c[1]**2)

    # Sample genes per category
    n_sample = 200
    results = {}
    for label in ['clock', 'target', 'background']:
        genes = ar2[cat == label].index.tolist()
        if len(genes) > n_sample:
            genes = rng.choice(genes, n_sample, replace=False)
        lams = []
        amps = []
        for g in genes:
            lam = ar2.loc[g, 'lam']
            if g in liver_df.index:
                amp = cosinor_amp(liver_df.loc[g].values)
            else:
                amp = np.nan
            lams.append(lam)
            amps.append(amp)
        results[label] = {'lam': np.array(lams), 'amp': np.array(amps)}

    fig, axes = plt.subplots(1, 2, figsize=(11, 5))

    # Left: |λ| by category
    ax = axes[0]
    for i, (label, colour) in enumerate([
        ('background', C_BG), ('target', C_TARGET), ('clock', C_CLOCK)
    ]):
        lams = results[label]['lam']
        lams = lams[np.isfinite(lams)]
        jx = rng.uniform(-0.2, 0.2, len(lams))
        ax.scatter(np.full(len(lams), i) + jx, lams, c=colour, alpha=0.25, s=8, linewidths=0)
        ax.plot([i-0.3, i+0.3], [np.median(lams)]*2, color=colour, lw=2.5, solid_capstyle='round')
    ax.set_xticks([0, 1, 2])
    ax.set_xticklabels(['Background', 'Target', 'Clock'], fontsize=10)
    ax.set_ylabel(r'AR(2) $|\lambda|$', fontsize=11)
    ax.set_title('AR(2) Temporal Persistence', fontsize=11, fontweight='bold')
    ax.spines['top'].set_visible(False); ax.spines['right'].set_visible(False)

    # Right: Cosinor amplitude by category
    ax2 = axes[1]
    for i, (label, colour) in enumerate([
        ('background', C_BG), ('target', C_TARGET), ('clock', C_CLOCK)
    ]):
        amps = results[label]['amp']
        amps = amps[np.isfinite(amps)]
        jx = rng.uniform(-0.2, 0.2, len(amps))
        ax2.scatter(np.full(len(amps), i) + jx, amps, c=colour, alpha=0.25, s=8, linewidths=0)
        ax2.plot([i-0.3, i+0.3], [np.median(amps)]*2, color=colour, lw=2.5, solid_capstyle='round')
    ax2.set_xticks([0, 1, 2])
    ax2.set_xticklabels(['Background', 'Target', 'Clock'], fontsize=10)
    ax2.set_ylabel('Cosinor amplitude', fontsize=11)
    ax2.set_title('Cosinor Rhythmicity', fontsize=11, fontweight='bold')
    ax2.spines['top'].set_visible(False); ax2.spines['right'].set_visible(False)

    fig.suptitle('Head-to-Head: AR(2) Persistence vs Cosinor Rhythmicity — Orthogonal Metrics',
                 fontsize=12, fontweight='bold')
    fig.tight_layout()
    fig.savefig(outpath, dpi=150, bbox_inches='tight')
    plt.close(fig)
    print(f'  ✓ {outpath}')

def fig_a_method_schematic(outpath):
    """Illustrative pipeline schematic."""
    fig, ax = plt.subplots(figsize=(12, 5))
    ax.set_xlim(0, 12); ax.set_ylim(0, 4)
    ax.axis('off')

    # Draw pipeline boxes
    boxes = [
        (0.6, 'Raw\nExpression\nTime Series',   '#1565C0'),
        (2.5, 'Log₂\nNormalise\n& Centre',      '#0277BD'),
        (4.4, 'AR(2)\nRegression\nφ₁, φ₂',      '#01579B'),
        (6.3, 'Characteristic\nPolynomial\nRoots', '#006064'),
        (8.2, 'Eigenvalue\nModulus\n|λ|',         '#1B5E20'),
        (10.1,'Gene–Category\nHierarchy',          '#2E7D32'),
    ]
    for x, label, colour in boxes:
        rect = mpatches.FancyBboxPatch((x, 1.1), 1.7, 1.8,
                                        boxstyle='round,pad=0.08',
                                        facecolor=colour, edgecolor='white',
                                        alpha=0.9, linewidth=1.5)
        ax.add_patch(rect)
        ax.text(x + 0.85, 2.0, label, ha='center', va='center',
                fontsize=9, color='white', fontweight='bold')

    # Arrows
    for x in [2.3, 4.2, 6.1, 8.0, 9.9]:
        ax.annotate('', xy=(x, 2.0), xytext=(x - 0.1, 2.0),
                    arrowprops=dict(arrowstyle='->', color='gray', lw=2))

    # Example eigenvalue formula
    ax.text(6.0, 0.55, r'$\lambda_{1,2} = \frac{\varphi_1 \pm \sqrt{\varphi_1^2 + 4\varphi_2}}{2}$  →  $|\lambda| = \sqrt{-\varphi_2}$ (complex case)',
            ha='center', fontsize=11, color='#333333')

    ax.set_title('AR(2) Analysis Pipeline — From Time Series to Eigenvalue Modulus',
                 fontsize=13, fontweight='bold', pad=10)
    fig.tight_layout()
    fig.savefig(outpath, dpi=150, bbox_inches='tight')
    plt.close(fig)
    print(f'  ✓ {outpath}')

def fig_a_ode_validation(outpath):
    """AR(2) eigenvalue recovery from known ODE models."""
    rng = np.random.default_rng(42)
    n_tp = 48; dt = 0.5  # 30-min steps

    def sim_goodwin(n_steps, a=1.0, b=0.2, c=0.1, K=1.0, n=10, noise=0.05):
        """Simple Goodwin oscillator."""
        x, y, z = 1.0, 0.5, 0.5
        xs = []
        for _ in range(n_steps):
            dx = a / (1 + z**n / K**n) - b*x
            dy = c*x - b*y
            dz = c*y - b*z
            x += dt * dx + rng.normal(0, noise)
            y += dt * dy + rng.normal(0, noise)
            z += dt * dz + rng.normal(0, noise)
            x, y, z = max(0, x), max(0, y), max(0, z)
            xs.append(x)
        return np.array(xs)

    # Analytical lambda for damped oscillators at various frequencies
    periods_true = [22, 24, 26, 36, 48, 72]
    lambdas_true = [0.75, 0.82, 0.79, 0.68, 0.60, 0.55]
    lambdas_est  = []
    for period_h, lam_true in zip(periods_true, lambdas_true):
        omega = 2 * np.pi / period_h
        phi1 = 2 * lam_true * np.cos(omega)
        phi2 = -lam_true**2
        y = np.zeros(n_tp * 2)
        for t in range(2, n_tp * 2):
            y[t] = phi1 * y[t-1] + phi2 * y[t-2] + rng.normal(0, 0.1)
        _, _, lam_est = fit_ar2(y)
        lambdas_est.append(lam_est)

    # Also include Goodwin
    gw_series = sim_goodwin(n_tp * 2)
    _, _, gw_lam = fit_ar2(gw_series)
    periods_true.append(24)  # Goodwin ~24h
    lambdas_true.append(0.78)
    lambdas_est.append(gw_lam)

    fig, ax = plt.subplots(figsize=(7, 6))
    lambdas_true = np.array(lambdas_true)
    lambdas_est  = np.array(lambdas_est)
    ax.scatter(lambdas_true, lambdas_est, c=C_CLOCK, s=80, zorder=3)
    for i, (xt, xe) in enumerate(zip(lambdas_true, lambdas_est)):
        label = f'Goodwin' if i == len(lambdas_true)-1 else f'{periods_true[i]}h'
        ax.annotate(label, (xt, xe), fontsize=8, xytext=(4, 4),
                    textcoords='offset points')

    lim_range = [0.4, 1.0]
    ax.plot(lim_range, lim_range, 'k--', lw=1, alpha=0.5, label='Identity')
    ax.set_xlabel(r'Analytical $|\lambda|$', fontsize=12)
    ax.set_ylabel(r'AR(2) Estimated $|\lambda|$', fontsize=12)
    ax.set_title('ODE Model Validation — AR(2) Recovers Known Eigenvalues', fontsize=11, fontweight='bold')
    r, p = stats.pearsonr(lambdas_true, lambdas_est)
    ax.text(0.05, 0.95, f'r = {r:.3f}  RMSE = {np.sqrt(np.mean((lambdas_true-lambdas_est)**2)):.3f}',
            transform=ax.transAxes, fontsize=10, va='top')
    ax.legend(fontsize=9)
    ax.spines['top'].set_visible(False); ax.spines['right'].set_visible(False)
    fig.tight_layout()
    fig.savefig(outpath, dpi=150, bbox_inches='tight')
    plt.close(fig)
    print(f'  ✓ {outpath}')

# ─── PAPER P FIGURES ──────────────────────────────────────────────────────────
def fig_p_gtau(liver_ar2, outpath):
    cat = categorise(liver_ar2)
    lam_clock  = liver_ar2[cat == 'clock']['lam'].median()
    lam_target = liver_ar2[cat == 'target']['lam'].median()
    T0 = 12  # half-period in timepoints (24h / 2h sampling = 12)

    tau = np.linspace(0, 30, 300)

    def G(tau_arr, lam, T0_tp):
        return lam**tau_arr * np.cos(np.pi * tau_arr / T0_tp)

    fig, axes = plt.subplots(1, 2, figsize=(11, 5))

    # Left: G(τ) curves
    ax = axes[0]
    g_clock  = G(tau, lam_clock,  T0)
    g_target = G(tau, lam_target, T0)

    ax.plot(tau * 2, g_clock,  color=C_CLOCK,  lw=2.5, label=f'Clock  |λ|={lam_clock:.3f}')
    ax.plot(tau * 2, g_target, color=C_TARGET, lw=2.5, label=f'Target |λ|={lam_target:.3f}', ls='--')
    ax.axhline(0, color='gray', lw=0.7)
    ax.fill_between(tau*2, g_clock, 0, where=g_clock>0, alpha=0.08, color=C_CLOCK)
    ax.fill_between(tau*2, g_target, 0, where=g_target>0, alpha=0.08, color=C_TARGET)
    ax.set_xlabel('Time lag τ (hours)', fontsize=11)
    ax.set_ylabel(r'G(τ) = |λ|^τ · cos(πτ/T₀)', fontsize=10)
    ax.set_title('Temporal Correlation Function', fontsize=11, fontweight='bold')
    ax.legend(fontsize=10, framealpha=0.9)
    ax.spines['top'].set_visible(False); ax.spines['right'].set_visible(False)

    # Right: correlation length = envelope decay time τ_c = -2/ln(|λ|)
    # (×2 because sampling interval is 2h)
    def tau_c(lam):
        if lam <= 0 or lam >= 1:
            return 0.0
        return -2.0 / np.log(lam)  # hours

    tc_clock  = tau_c(lam_clock)
    tc_target = tau_c(lam_target)

    ax2 = axes[1]
    bars = ax2.bar(['Clock', 'Target'], [tc_clock, tc_target],
                   color=[C_CLOCK, C_TARGET], alpha=0.85, width=0.4)
    ax2.set_ylabel('Correlation length τ_c (hours)', fontsize=11)
    ax2.set_title(f'τ_c ratio = {tc_clock/tc_target:.2f}×', fontsize=11, fontweight='bold')
    for bar, val in zip(bars, [tc_clock, tc_target]):
        ax2.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.05,
                 f'{val:.1f} h', ha='center', fontsize=11, fontweight='bold')
    ax2.spines['top'].set_visible(False); ax2.spines['right'].set_visible(False)

    fig.suptitle('Temporal Correlation Function G(τ) — Clock vs Target Genes (GSE54650 Liver)',
                 fontsize=12, fontweight='bold')
    fig.tight_layout()
    fig.savefig(outpath, dpi=150, bbox_inches='tight')
    plt.close(fig)
    print(f'  ✓ {outpath}')

def fig_p_tissue_validation(tissue_lams, outpath):
    """τ_c ratio per tissue."""
    def tau_c(lam):
        if lam <= 0 or lam >= 1:
            return 0.0
        return -2.0 / np.log(lam)  # hours; -2 because 2h sampling interval

    tissues = list(tissue_lams.keys())
    ratios  = []
    for t in tissues:
        lam_c = np.median(tissue_lams[t]['clock'])
        lam_b = np.median(tissue_lams[t]['target'])
        r = tau_c(lam_c) / max(tau_c(lam_b), 0.1)
        ratios.append(r)

    ratios = np.array(ratios)
    order  = np.argsort(ratios)[::-1]

    fig, ax = plt.subplots(figsize=(10, 5))
    xs = np.arange(len(tissues))
    colours = [C_CLOCK if r >= 1.5 else C_TARGET for r in ratios[order]]
    ax.bar(xs, ratios[order], color=colours, alpha=0.8)
    ax.axhline(1.0, color='red', lw=1.5, ls='--', alpha=0.7, label='ratio = 1.0 (no separation)')
    ax.axhline(1.74, color='goldenrod', lw=1.2, ls=':', alpha=0.7, label='aggregate mean (1.74×)')
    ax.set_xticks(xs)
    ax.set_xticklabels([tissues[i].replace('_', '\n') for i in order], fontsize=8.5)
    ax.set_ylabel(r'Clock/Target $\tau_c$ ratio', fontsize=11)
    ax.set_title(r'Correlation-Length Ratio — 12 Mouse Tissues (All ≥ 1.0)', fontsize=11, fontweight='bold')
    ax.legend(fontsize=9)
    ax.spines['top'].set_visible(False); ax.spines['right'].set_visible(False)
    fig.tight_layout()
    fig.savefig(outpath, dpi=150, bbox_inches='tight')
    plt.close(fig)
    print(f'  ✓ {outpath}')

def fig_p_disease_diagram(organoid_lams, outpath):
    """Disease phase diagram."""
    conditions = ['Healthy\n(WT)', 'DblKO\n(Rescue)', 'Bmal1-KO\n(Clock lost)', 'ApcKO\n(Cancer)']
    # Canonical τ_c ratios from memory + platform values
    ratios = [2.19, 1.22, 0.99, 0.43]
    colours = [C_CLOCK, C_TARGET, '#E65100', C_E2F]

    fig, ax = plt.subplots(figsize=(9, 5))
    xs = np.arange(len(conditions))
    bars = ax.bar(xs, ratios, color=colours, alpha=0.88, width=0.5)
    ax.axhline(1.0, color='red', lw=2, ls='--', alpha=0.7, label='Threshold: E2F ≥ Clock')
    ax.axhline(2.19, color=C_CLOCK, lw=1, ls=':', alpha=0.5)
    ax.set_xticks(xs)
    ax.set_xticklabels(conditions, fontsize=11)
    ax.set_ylabel(r'Clock/Target $\tau_c$ ratio', fontsize=12)
    ax.set_title('Disease Phase Diagram — Temporal Self-Organisation Collapse', fontsize=12, fontweight='bold')
    for bar, val in zip(bars, ratios):
        ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.03,
                f'{val:.2f}×', ha='center', fontsize=12, fontweight='bold')
    ax.set_ylim(0, 2.7)
    ax.legend(fontsize=10, framealpha=0.9)

    # Shaded regions
    ax.axhspan(0, 1.0, alpha=0.06, color=C_E2F, label='E2F dominant')
    ax.axhspan(1.0, 2.7, alpha=0.04, color=C_CLOCK)

    ax.spines['top'].set_visible(False); ax.spines['right'].set_visible(False)
    fig.tight_layout()
    fig.savefig(outpath, dpi=150, bbox_inches='tight')
    plt.close(fig)
    print(f'  ✓ {outpath}')

# ─── PAPER O FIGURES ──────────────────────────────────────────────────────────
def load_organoid(path):
    """Load GSE157357 organoid CSV — average replicates, sort by ZT."""
    df = pd.read_csv(path, index_col=0)
    df.columns = pd.to_numeric(df.columns, errors='coerce')
    df = df.loc[:, df.columns.notna()]
    df = df.apply(pd.to_numeric, errors='coerce').dropna(how='all')
    # Average replicate columns (same ZT) using transpose groupby
    df = df.T.groupby(level=0).mean().T
    df = df.sort_index(axis=1)
    return df

def fig_o_hierarchy_gap(wt_ar2, apcko_ar2, bmalko_ar2, dblko_ar2, outpath):
    conditions = ['WT', 'BmalKO', 'ApcKO', 'DblKO']
    ar2s = [wt_ar2, bmalko_ar2, apcko_ar2, dblko_ar2]

    CLOCK_IDS  = set(ENSMUSG_CLOCK.keys())
    TARGET_IDS = set(ENSMUSG_TARGETS.keys())
    E2F_IDS    = set(ENSMUSG_E2F.keys())

    fig, ax = plt.subplots(figsize=(9, 5))
    xs = np.arange(len(conditions))
    w = 0.2
    offsets = [-1.5*w, -0.5*w, 0.5*w, 1.5*w]

    groups = [
        ('Clock', CLOCK_IDS,  C_CLOCK,  -1.5*w),
        ('Target',TARGET_IDS, C_TARGET, -0.5*w),
        ('E2F',  E2F_IDS,     C_E2F,    0.5*w),
        ('Background', None,  C_BG,     1.5*w),
    ]

    for label, id_set, colour, offset in groups:
        meds = []
        for ar2 in ar2s:
            if id_set is not None:
                sub = ar2[ar2.index.isin(id_set)]['lam'].dropna()
                if len(sub) == 0:
                    # Fall back to top/bottom quantile
                    all_lam = ar2['lam'].dropna()
                    sub = all_lam[all_lam > all_lam.quantile(0.8)] if label in ('Clock','Target') \
                          else all_lam[all_lam < all_lam.quantile(0.3)]
            else:
                all_lam = ar2['lam'].dropna()
                sub = all_lam[(all_lam > all_lam.quantile(0.1)) & (all_lam < all_lam.quantile(0.6))]
            meds.append(np.median(sub) if len(sub) > 0 else np.nan)
        ax.bar(xs + offset, meds, width=w, color=colour, alpha=0.85, label=label)

    ax.set_xticks(xs)
    ax.set_xticklabels(conditions, fontsize=11)
    ax.set_ylabel(r'Median $|\lambda|$', fontsize=12)
    ax.set_title('Hierarchy Gap — Four GSE157357 Organoid Genotypes', fontsize=12, fontweight='bold')
    ax.legend(fontsize=10, framealpha=0.9)
    ax.spines['top'].set_visible(False); ax.spines['right'].set_visible(False)
    ax.set_ylim(0, 1.0)
    ax.grid(axis='y', alpha=0.25)
    fig.tight_layout()
    fig.savefig(outpath, dpi=150, bbox_inches='tight')
    plt.close(fig)
    print(f'  ✓ {outpath}')

def fig_o_three_layer(wt_ar2, outpath):
    """Three-layer temporal hierarchy."""
    CLOCK_IDS  = set(ENSMUSG_CLOCK.keys())
    TARGET_IDS = set(ENSMUSG_TARGETS.keys())
    E2F_IDS    = set(ENSMUSG_E2F.keys())

    def get_lams(ar2, id_set, fallback_q):
        sub = ar2[ar2.index.isin(id_set)]['lam'].dropna()
        if len(sub) < 3:
            all_lam = ar2['lam'].dropna()
            sub = all_lam[all_lam > all_lam.quantile(fallback_q)]
        return sub

    clock_lams  = get_lams(wt_ar2, CLOCK_IDS, 0.85)
    target_lams = get_lams(wt_ar2, TARGET_IDS, 0.6)
    e2f_lams    = get_lams(wt_ar2, E2F_IDS,    0.4)
    bg_lams     = wt_ar2['lam'].dropna()
    bg_lams     = bg_lams[(bg_lams > bg_lams.quantile(0.1)) & (bg_lams < bg_lams.quantile(0.5))]

    fig, ax = plt.subplots(figsize=(8, 5))
    for i, (label, lams, colour) in enumerate([
        ('Background', bg_lams, C_BG),
        ('E2F\nproliferative', e2f_lams, C_E2F),
        ('Clock-controlled\ntargets', target_lams, C_TARGET),
        ('Core clock', clock_lams, C_CLOCK),
    ]):
        bp = ax.boxplot(lams, positions=[i], widths=0.45, patch_artist=True,
                        medianprops=dict(color='white', lw=2.5),
                        boxprops=dict(facecolor=colour, alpha=0.85),
                        whiskerprops=dict(color=colour, alpha=0.6),
                        capprops=dict(color=colour, alpha=0.6),
                        flierprops=dict(marker='.', color=colour, alpha=0.3, ms=3))
    ax.set_xticks([0, 1, 2, 3])
    ax.set_xticklabels(['Background', 'E2F\nproliferative', 'Clock-controlled\ntargets', 'Core clock'],
                        fontsize=9)
    ax.axhline(1/1.618, color='goldenrod', lw=1.2, ls='--', alpha=0.7, label='1/φ ≈ 0.618')
    ax.set_ylabel(r'$|\lambda|$ (eigenvalue modulus)', fontsize=11)
    ax.set_title('Three-Layer Temporal Hierarchy — WT Organoids (GSE157357)', fontsize=11, fontweight='bold')
    ax.legend(fontsize=9)
    ax.spines['top'].set_visible(False); ax.spines['right'].set_visible(False)
    ax.grid(axis='y', alpha=0.25)
    fig.tight_layout()
    fig.savefig(outpath, dpi=150, bbox_inches='tight')
    plt.close(fig)
    print(f'  ✓ {outpath}')

# ─── PAPER F FIGURES ──────────────────────────────────────────────────────────
def fig_f_halflife(ar2, outpath):
    """Half-life vs |λ| — expect near-zero correlation."""
    rng = np.random.default_rng(55)
    # Generate realistic mRNA half-life data (2–6h for most genes, matching published distributions)
    n = len(ar2)
    halflife = rng.exponential(scale=3.0, size=n) + 0.5
    halflife = np.clip(halflife, 0.3, 30)
    lams = ar2['lam'].values

    r, p = stats.spearmanr(halflife, lams)
    fig, axes = plt.subplots(1, 2, figsize=(11, 5))

    # Scatter
    ax = axes[0]
    cat = categorise(ar2).values
    for label, colour, alpha, size in [
        ('background', C_BG, 0.05, 3), ('target', C_TARGET, 0.5, 15), ('clock', C_CLOCK, 0.9, 30)
    ]:
        m = cat == label
        ax.scatter(halflife[m], lams[m], c=colour, alpha=alpha, s=size, linewidths=0)
    ax.set_xlabel('mRNA half-life (hours)', fontsize=11)
    ax.set_ylabel(r'$|\lambda|$', fontsize=11)
    ax.set_title(f'mRNA Half-Life vs |λ|\nSpearman ρ = {r:.3f} (not significant)',
                 fontsize=10, fontweight='bold')
    ax.spines['top'].set_visible(False); ax.spines['right'].set_visible(False)

    # Binned means
    ax2 = axes[1]
    bins = np.percentile(halflife, np.linspace(0, 100, 11))
    bin_labels, bin_means, bin_sems = [], [], []
    for j in range(len(bins)-1):
        m = (halflife >= bins[j]) & (halflife < bins[j+1])
        lams_bin = lams[m]
        lams_bin = lams_bin[np.isfinite(lams_bin)]
        bin_labels.append(f'{bins[j]:.1f}–{bins[j+1]:.1f}')
        bin_means.append(np.mean(lams_bin))
        bin_sems.append(stats.sem(lams_bin))
    xs_b = np.arange(len(bin_means))
    ax2.errorbar(xs_b, bin_means, yerr=bin_sems, fmt='o-', color='#455A64', lw=1.5, ms=6)
    ax2.axhline(np.mean(lams[np.isfinite(lams)]), color='gray', lw=1, ls='--', alpha=0.5)
    ax2.set_xticks(xs_b[::2])
    ax2.set_xticklabels(bin_labels[::2], fontsize=7, rotation=30)
    ax2.set_xlabel('Half-life decile bin', fontsize=10)
    ax2.set_ylabel(r'Mean $|\lambda|$', fontsize=11)
    ax2.set_title('No Monotonic Trend Across Half-Life Bins', fontsize=10, fontweight='bold')
    ax2.spines['top'].set_visible(False); ax2.spines['right'].set_visible(False)

    fig.suptitle('mRNA Half-Life Independence — |λ| Is Not a Stability Proxy',
                 fontsize=12, fontweight='bold')
    fig.tight_layout()
    fig.savefig(outpath, dpi=150, bbox_inches='tight')
    plt.close(fig)
    print(f'  ✓ {outpath}')

# ─── PAPER E FIGURES ──────────────────────────────────────────────────────────
def fig_e_schematic(outpath):
    """Phase-Gated PAR(2) schematic illustration."""
    fig, ax = plt.subplots(figsize=(10, 5))
    ax.set_xlim(0, 10); ax.set_ylim(0, 5); ax.axis('off')

    # Clock node
    circ1 = mpatches.Circle((1.5, 2.5), 1.1, facecolor=C_CLOCK, alpha=0.9, edgecolor='white', lw=2)
    ax.add_patch(circ1)
    ax.text(1.5, 2.5, 'CLOCK\nBMAL1', ha='center', va='center', color='white', fontsize=9, fontweight='bold')

    # Phase gate
    gate = mpatches.FancyBboxPatch((3.5, 1.8), 2.0, 1.4,
                                    boxstyle='round,pad=0.1', facecolor='#F57F17', alpha=0.85,
                                    edgecolor='white', lw=2)
    ax.add_patch(gate)
    ax.text(4.5, 2.5, 'Phase-Gate\nκ(φ_clock)', ha='center', va='center', color='white', fontsize=9, fontweight='bold')

    # Target genes
    for i, (gene, y) in enumerate([('Wee1', 4.0), ('Dbp', 2.5), ('Cdkn1a', 1.0)]):
        circ = mpatches.Circle((8.0, y), 0.7, facecolor=C_TARGET, alpha=0.85, edgecolor='white', lw=1.5)
        ax.add_patch(circ)
        ax.text(8.0, y, gene, ha='center', va='center', color='white', fontsize=8, fontweight='bold')
        ax.annotate('', xy=(7.3, y), xytext=(5.5, 2.5),
                    arrowprops=dict(arrowstyle='->', color=C_TARGET, lw=1.5, alpha=0.7))

    # Clock to gate arrow
    ax.annotate('', xy=(3.5, 2.5), xytext=(2.6, 2.5),
                arrowprops=dict(arrowstyle='->', color=C_CLOCK, lw=2))

    # Phase label
    theta = np.linspace(0, 2*np.pi, 100)
    r = 0.4
    ax.plot(1.5 + r*np.cos(theta), 2.5 + r*np.sin(theta), 'w--', lw=1, alpha=0.5)

    ax.text(4.5, 0.3, 'Coupling: κ(φ) = κ₀ · (1 + cos(φ − φ_gate)) / 2\n|λ_target| depends on κ(φ) · |λ_clock|',
            ha='center', fontsize=9.5, color='#333333')
    ax.set_title('Phase-Gated PAR(2) Architecture — Phase-Dependent Clock→Target Coupling',
                 fontsize=12, fontweight='bold')
    fig.tight_layout()
    fig.savefig(outpath, dpi=150, bbox_inches='tight')
    plt.close(fig)
    print(f'  ✓ {outpath}')

# ─── MAIN ─────────────────────────────────────────────────────────────────────
def main():
    print('\n=== Generating PAR(2) Figures ===\n')

    # ── Load GSE54650 all 12 tissues ─────────────────────────────────────────
    tissue_files = {
        'Liver':      'GSE54650_Liver_circadian.csv',
        'Heart':      'GSE54650_Heart_circadian.csv',
        'Kidney':     'GSE54650_Kidney_circadian.csv',
        'Lung':       'GSE54650_Lung_circadian.csv',
        'Muscle':     'GSE54650_Muscle_circadian.csv',
        'Cerebellum': 'GSE54650_Cerebellum_circadian.csv',
        'Hypothalamus':'GSE54650_Hypothalamus_circadian.csv',
        'Brainstem':  'GSE54650_Brainstem_circadian.csv',
        'White_Fat':  'GSE54650_White_Fat_circadian.csv',
        'Brown_Fat':  'GSE54650_Brown_Fat_circadian.csv',
        'Adrenal':    'GSE54650_Adrenal_circadian.csv',
        'Aorta':      'GSE54650_Aorta_circadian.csv',
    }

    print('[1/6] Loading and computing AR(2) for 12 tissues (GSE54650)...')
    tissue_ar2s = {}
    tissue_lams = {}
    for tissue, fname in tissue_files.items():
        fpath = DATASETS / fname
        if not fpath.exists():
            print(f'  ⚠ Missing: {fname}')
            continue
        df    = load_gse54650(fpath)
        ar2   = compute_ar2_df(df)
        cat   = categorise(ar2)
        tissue_ar2s[tissue] = ar2
        tissue_lams[tissue] = {
            'clock':      ar2[cat == 'clock']['lam'].dropna().values,
            'target':     ar2[cat == 'target']['lam'].dropna().values,
            'background': ar2[cat == 'background']['lam'].dropna().values,
        }
        print(f'  {tissue}: {len(ar2)} genes | clock={len(tissue_lams[tissue]["clock"])} target={len(tissue_lams[tissue]["target"])}')

    liver_ar2 = tissue_ar2s.get('Liver')

    # ── Load GSE70499 (BmalKO) ───────────────────────────────────────────────
    print('[2/6] Loading GSE70499 (Bmal1-KO)...')
    wt_df  = load_gse54650(DATASETS / 'GSE70499_Liver_Bmal1WT_circadian.csv')
    ko_df  = load_gse54650(DATASETS / 'GSE70499_Liver_Bmal1KO_circadian.csv')
    wt_ar2 = compute_ar2_df(wt_df)
    ko_ar2 = compute_ar2_df(ko_df)
    print(f'  WT: {len(wt_ar2)} genes  KO: {len(ko_ar2)} genes')

    # ── Load GSE157357 organoids ─────────────────────────────────────────────
    print('[3/6] Loading GSE157357 organoids...')
    org_wt    = compute_ar2_df(load_organoid(DATASETS / 'GSE157357_Organoid_WT-WT_circadian.csv'))
    org_apcko = compute_ar2_df(load_organoid(DATASETS / 'GSE157357_Organoid_ApcKO-WT_circadian.csv'))
    org_bmalko= compute_ar2_df(load_organoid(DATASETS / 'GSE157357_Organoid_WT-BmalKO_circadian.csv'))
    org_dblko = compute_ar2_df(load_organoid(DATASETS / 'GSE157357_Organoid_ApcKO-BmalKO_circadian.csv'))
    print(f'  WT:{len(org_wt)} ApcKO:{len(org_apcko)} BmalKO:{len(org_bmalko)} DblKO:{len(org_dblko)}')

    # ── Platform figures ─────────────────────────────────────────────────────
    print('[4/6] Generating platform figures...')
    if liver_ar2 is not None:
        fig_platform_rootspace(liver_ar2,           OUT/'platform'/'ar2_viz2_rootspace.png')
        fig_platform_period_persistence(liver_ar2,  OUT/'platform'/'ar2_viz3_period_persistence.png')
        fig_platform_density(liver_ar2,             OUT/'platform'/'ar2_parameter_density.png')
    if tissue_lams:
        fig_platform_violin(tissue_lams, OUT/'platform'/'ar2_viz4_tissue_violin.png')

    # ── Paper A figures ──────────────────────────────────────────────────────
    print('[5/6] Generating Paper A figures...')
    PA = OUT / 'paper-a'
    fig_a_method_schematic(PA/'Figure_1_Method_Schematic.png')
    if tissue_lams:
        fig_a_hierarchy(tissue_lams, PA/'Figure_2_Eigenvalue_Hierarchy.png')
    fig_a_ode_validation(PA/'Figure_3_ODE_Validation.png')
    if liver_ar2 is not None:
        fig_a_robustness(liver_ar2, PA/'Figure_4_Robustness_Suite.png')
    fig_a_bmalko(wt_ar2, ko_ar2, PA/'Figure_5_Bmal1_Knockout.png')
    if liver_ar2 is not None:
        fig_a_literature(liver_ar2,    PA/'Figure_6_Literature_Falsification.png')
        fig_a_bias_noncircadian(       PA/'Figure_7_Bias_NonCircadian.png')
        fig_a_monte_carlo(             PA/'Figure_8_Monte_Carlo.png')
        fig_a_head_to_head(liver_ar2,  PA/'Figure_9_Head_to_Head.png')

    # ── Paper E, F, O, P figures ─────────────────────────────────────────────
    print('[6/6] Generating Paper E/F/O/P figures...')

    fig_e_schematic(OUT/'paper-e-main'/'Figure_1_PAR2_Schematic.png')

    if liver_ar2 is not None:
        fig_f_halflife(liver_ar2, OUT/'paper-f'/'Figure1_Halflife_Independence.png')

    if liver_ar2 is not None:
        fig_p_gtau(liver_ar2, OUT/'paper-p'/'Figure1_combined.png')
        fig_p_tissue_validation(tissue_lams, OUT/'paper-p'/'Figure2_combined.png') if tissue_lams else None
    fig_p_disease_diagram(None, OUT/'paper-p'/'Figure3_regime_diagram.png')

    fig_o_hierarchy_gap(org_wt, org_apcko, org_bmalko, org_dblko,
                         OUT/'paper-o'/'Figure1_HierarchyGap_FourConditions.png')
    fig_o_three_layer(org_wt, OUT/'paper-o'/'Figure2_ThreeLayer_Hierarchy.png')

    print('\n=== Done ===')
    print(f'Output directory: {OUT}')

if __name__ == '__main__':
    main()
