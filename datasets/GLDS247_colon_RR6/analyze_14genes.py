import csv
import math
from scipy import stats

TARGET_GENES = {
    'ENSMUSG00000059824': 'Dbp',
    'ENSMUSG00000022389': 'Tef',
    'ENSMUSG00000003949': 'Hlf',
    'ENSMUSG00000020572': 'Nampt',
    'ENSMUSG00000056749': 'Nfil3',
    'ENSMUSG00000031016': 'Wee1',
    'ENSMUSG00000023067': 'Cdkn1a',
    'ENSMUSG00000023087': 'Noct',
    'ENSMUSG00000030103': 'Bhlhe40',
    'ENSMUSG00000030256': 'Bhlhe41',
    'ENSMUSG00000032238': 'Rora',
    'ENSMUSG00000036192': 'Rorb',
    'ENSMUSG00000028150': 'Rorc',
    'ENSMUSG00000038550': 'Ciart',
}

CONTRASTS = {
    'LAR':  '(Space Flight & ~30 day & On Earth & Upon euthanasia)v(Ground Control & ~30 day & On Earth & Upon euthanasia)',
    'ISST': '(Space Flight & ~60 day & On ISS & Carcass)v(Ground Control & ~60 day & On Earth & Carcass)',
}

results = {}
with open('datasets/GLDS247_colon_RR6/de_results.csv', 'r') as f:
    reader = csv.DictReader(f)
    for row in reader:
        eid = row['ENSEMBL'].strip('"')
        if eid in TARGET_GENES:
            gene = TARGET_GENES[eid]
            results[gene] = {}
            for key, contrast in CONTRASTS.items():
                try:
                    lfc  = float(row['Log2fc_' + contrast])
                    pval = float(row['P.value_' + contrast])
                    adjp = float(row['Adj.p.value_' + contrast])
                except Exception:
                    lfc, pval, adjp = None, None, None
                results[gene][key] = {'log2fc': lfc, 'pval': pval, 'adjp': adjp}

gene_order = ['Dbp','Tef','Hlf','Nampt','Nfil3','Wee1','Cdkn1a','Noct',
              'Bhlhe40','Bhlhe41','Rora','Rorb','Rorc','Ciart']

print("=" * 70)
print("ISS-T arm (60-day spaceflight, sacrificed on ISS) — 14-gene results")
print("=" * 70)
print(f"{'Gene':<10} {'log2FC':>8} {'p-value':>10} {'adjp':>8}  FDR<0.05?")
print("-" * 55)

isst_pvals = []
isst_down = 0
isst_up = 0
n_fdr_sig = 0

for gene in gene_order:
    r = results[gene]['ISST']
    lfc  = r['log2fc']
    pval = r['pval']
    adjp = r['adjp']
    sig = "***" if adjp is not None and adjp < 0.05 else ""
    if adjp and adjp < 0.05:
        n_fdr_sig += 1
    direction = "DOWN" if lfc < 0 else "UP"
    print(f"{gene:<10} {lfc:>+8.3f} {pval:>10.5f} {adjp:>8.4f}  {sig:3s}  {direction}")
    isst_pvals.append(pval)
    if lfc < 0:
        isst_down += 1
    else:
        isst_up += 1

chi2_stat = -2 * sum(math.log(p) for p in isst_pvals if p > 0)
fisher_df  = 2 * len(isst_pvals)
fisher_p   = 1 - stats.chi2.cdf(chi2_stat, fisher_df)

print()
print(f"FDR-significant (adjp < 0.05): {n_fdr_sig}/14")
print(f"Fisher combined p (14 genes):  chi2({fisher_df}) = {chi2_stat:.2f}, p = {fisher_p:.2e}")

print()
print("Directional breakdown:")
print(f"  DOWN: {isst_down}/14  |  UP: {isst_up}/14")
binom_down = stats.binomtest(isst_down, 14, 0.5, alternative='greater').pvalue
print(f"  Binomial test (DOWN excess, H0=50%): p = {binom_down:.4f}")

print()
print("=" * 70)
print("PAR bZIP core output trio: Dbp, Tef, Hlf")
print("=" * 70)
for gene in ['Dbp', 'Tef', 'Hlf']:
    r = results[gene]['ISST']
    print(f"  {gene}: log2FC = {r['log2fc']:+.3f}, p = {r['pval']:.6f}, adjp = {r['adjp']:.6f}")
par_pvals = [results[g]['ISST']['pval'] for g in ['Dbp','Tef','Hlf']]
trio_chi2 = -2 * sum(math.log(p) for p in par_pvals)
trio_p    = 1 - stats.chi2.cdf(trio_chi2, 6)
print(f"  Fisher combined (trio): chi2(6) = {trio_chi2:.2f}, p = {trio_p:.2e}")
all_trio_fdr = all(results[g]['ISST']['adjp'] < 0.05 for g in ['Dbp','Tef','Hlf'])
print(f"  All 3 FDR-significant: {all_trio_fdr}")

print()
print("=" * 70)
print("LAR arm (29-day, returned to Earth ~4 days before dissection)")
print("=" * 70)
lar_pvals = [results[g]['LAR']['pval'] for g in gene_order if results[g]['LAR']['pval'] is not None]
lar_down = sum(1 for g in gene_order if results[g]['LAR']['log2fc'] is not None and results[g]['LAR']['log2fc'] < 0)
lar_chi2 = -2 * sum(math.log(p) for p in lar_pvals)
lar_p    = 1 - stats.chi2.cdf(lar_chi2, 2*len(lar_pvals))
lar_binom = stats.binomtest(lar_down, 14, 0.5, alternative='greater').pvalue
print(f"  DOWN: {lar_down}/14")
print(f"  Fisher combined p: {lar_p:.4f}")
print(f"  Binomial p: {lar_binom:.4f}")
print("  Note: animals had ~4 days Earth re-exposure before dissection")
print("        — partial clock re-entrainment expected, diluting spaceflight signal")
