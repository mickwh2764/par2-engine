import csv
import math
from scipy import stats

# MSigDB HALLMARK_CIRCADIAN_CLOCK - mouse orthologs (symbol lookup)
HALLMARK_GENES = [
    # Core activators
    'Arntl', 'Arntl2', 'Clock', 'Npas2',
    # Core repressors
    'Per1', 'Per2', 'Per3', 'Cry1', 'Cry2',
    # Kinases
    'Csnk1d', 'Csnk1e', 'Csnk2a1', 'Mknk1', 'Wee1',
    # E3 ligases
    'Fbxl3', 'Fbxl21', 'Btrc',
    # Nuclear receptors
    'Nr1d1', 'Nr1d2', 'Rora', 'Rorb', 'Rorc',
    # PAR bZIP outputs
    'Dbp', 'Tef', 'Hlf', 'Nfil3',
    # bHLH repressors
    'Bhlhe40', 'Bhlhe41',
    # Replication / DNA
    'Timeless', 'Tipin', 'Top2a',
    # Deubiquitinases / SUMO
    'Usp2', 'Senp3',
    # Metabolic / epigenetic
    'Sirt1', 'Nampt',
    # Structural / other
    'Sptbn1', 'Skp1',
    # Additional clock-output
    'Ciart',
]

ISST_CONTRAST = '(Space Flight & ~60 day & On ISS & Carcass)v(Ground Control & ~60 day & On Earth & Carcass)'
LAR_CONTRAST  = '(Space Flight & ~30 day & On Earth & Upon euthanasia)v(Ground Control & ~30 day & On Earth & Upon euthanasia)'

results = {}
missing = []

with open('datasets/GLDS247_colon_RR6/de_results.csv', 'r') as f:
    reader = csv.DictReader(f)
    for row in reader:
        sym = row['SYMBOL'].strip('"').strip()
        sym_cap = sym[0].upper() + sym[1:].lower() if sym else sym
        for gene in HALLMARK_GENES:
            if sym.lower() == gene.lower() and gene not in results:
                results[gene] = {'symbol': sym}
                for key, contrast in [('ISST', ISST_CONTRAST), ('LAR', LAR_CONTRAST)]:
                    try:
                        lfc  = float(row['Log2fc_' + contrast])
                        pval = float(row['P.value_' + contrast])
                        adjp = float(row['Adj.p.value_' + contrast])
                    except Exception:
                        lfc, pval, adjp = None, None, None
                    results[gene][key] = {'log2fc': lfc, 'pval': pval, 'adjp': adjp}

for g in HALLMARK_GENES:
    if g not in results:
        missing.append(g)

print(f"Hallmark Circadian Clock genes found in GLDS-247: {len(results)}/{len(HALLMARK_GENES)}")
print(f"Missing: {missing}\n")

# ---- ISS-T Results Table ----
gene_order = [g for g in HALLMARK_GENES if g in results]

print("=" * 80)
print("HALLMARK_CIRCADIAN_CLOCK vs GLDS-247 ISS-Terminal (60-day spaceflight)")
print("=" * 80)
print(f"{'Gene':<12} {'log2FC':>8} {'p-value':>10} {'adjp':>8}  {'':4}  Direction")
print("-" * 65)

isst_pvals = []
isst_down = 0
isst_up = 0
n_fdr = 0

for gene in gene_order:
    r = results[gene]['ISST']
    lfc  = r['log2fc']
    pval = r['pval']
    adjp = r['adjp']
    sig  = "***" if adjp is not None and adjp < 0.05 else (
           "**"  if adjp is not None and adjp < 0.1  else "")
    direction = "DOWN" if lfc < 0 else "UP"
    if adjp and adjp < 0.05:
        n_fdr += 1
    print(f"{gene:<12} {lfc:>+8.3f} {pval:>10.5f} {adjp:>8.4f}  {sig:4s}  {direction}")
    isst_pvals.append(pval)
    if lfc < 0:
        isst_down += 1
    else:
        isst_up += 1

n = len(isst_pvals)
chi2_stat = -2 * sum(math.log(p) for p in isst_pvals if p > 0)
fisher_df  = 2 * n
fisher_p   = 1 - stats.chi2.cdf(chi2_stat, fisher_df)

print()
print(f"Genes tested:          {n}")
print(f"FDR-significant:       {n_fdr}/{n} ({100*n_fdr/n:.0f}%)")
print(f"DOWN:                  {isst_down}/{n}")
print(f"UP:                    {isst_up}/{n}")

binom_p = stats.binomtest(isst_down, n, 0.5, alternative='greater').pvalue
print(f"Fisher combined p:     {fisher_p:.2e}  (chi2={chi2_stat:.1f}, df={fisher_df})")
print(f"Binomial p (DOWN>50%): {binom_p:.4f}")

# ---- Compare: E-box 14 vs Hallmark ----
ebox_14 = ['Dbp','Tef','Hlf','Nampt','Nfil3','Wee1','Cdkn1a','Noct',
           'Bhlhe40','Bhlhe41','Rora','Rorb','Rorc','Ciart']
hallmark_only = [g for g in gene_order if g not in [x.lower() for x in ebox_14]
                 and g not in ebox_14]
shared = [g for g in gene_order if g in ebox_14 or g.capitalize() in ebox_14]

print()
print("=" * 80)
print("Genes in Hallmark set OUTSIDE the 14-gene E-box set (new information)")
print("=" * 80)
print(f"{'Gene':<12} {'log2FC':>8} {'p-value':>10} {'adjp':>8}  Direction")
print("-" * 55)
for gene in gene_order:
    if gene not in ebox_14:
        r = results[gene]['ISST']
        lfc = r['log2fc']
        adjp = r['adjp']
        pval = r['pval']
        sig  = "***" if adjp < 0.05 else ""
        print(f"{gene:<12} {lfc:>+8.3f} {pval:>10.5f} {adjp:>8.4f}  {sig:3s}  {'DOWN' if lfc<0 else 'UP'}")

# ---- Core clock machine (activators + repressors only) ----
core_clock = ['Arntl','Clock','Npas2','Per1','Per2','Per3','Cry1','Cry2']
core_in    = [g for g in core_clock if g in results]
print()
print("=" * 80)
print("Core clock machine (BMAL1/CLOCK + PER/CRY) only")
print("=" * 80)
core_pvals = []
for gene in core_in:
    r = results[gene]['ISST']
    lfc = r['log2fc']
    pval = r['pval']
    adjp = r['adjp']
    sig  = "***" if adjp < 0.05 else ""
    print(f"{gene:<12} {lfc:>+8.3f} {pval:>10.5f} {adjp:>8.4f}  {sig:3s}  {'DOWN' if lfc<0 else 'UP'}")
    core_pvals.append(pval)
core_chi2 = -2 * sum(math.log(p) for p in core_pvals)
core_p    = 1 - stats.chi2.cdf(core_chi2, 2*len(core_pvals))
core_down = sum(1 for g in core_in if results[g]['ISST']['log2fc'] < 0)
print(f"\nCore clock Fisher p: {core_p:.4f}")
print(f"Core clock DOWN: {core_down}/{len(core_in)}")
