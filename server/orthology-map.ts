export type Species = 'Mus musculus' | 'Homo sapiens' | 'Arabidopsis thaliana' | 'Papio anubis';

export interface OrthologEntry {
  orthologGroup: string;
  geneType: 'clock' | 'target';
  symbols: Record<Species, string | null>;
  source: string;
  confidence: 'high' | 'moderate';
  note?: string;
  locusId?: string;
}

const ALIASES: Record<string, string> = {
  'BMAL1': 'ARNTL',
  'TRP53': 'TP53',
  'P53': 'TP53',
  'BMAL': 'ARNTL',
  'REV-ERBA': 'NR1D1',
  'REV-ERBB': 'NR1D2',
  'REVERBA': 'NR1D1',
  'REVERBB': 'NR1D2',
  'P21': 'CDKN1A',
  'CDC2': 'CDK1',
  'CYCLIN-D1': 'CCND1',
  'CYCLIN-B1': 'CCNB1',
};

const ORTHOLOG_TABLE: OrthologEntry[] = [
  { orthologGroup: 'PER1', geneType: 'clock', symbols: { 'Mus musculus': 'Per1', 'Homo sapiens': 'PER1', 'Arabidopsis thaliana': null, 'Papio anubis': 'PER1' }, source: 'Ensembl Compara 112', confidence: 'high' },
  { orthologGroup: 'PER2', geneType: 'clock', symbols: { 'Mus musculus': 'Per2', 'Homo sapiens': 'PER2', 'Arabidopsis thaliana': null, 'Papio anubis': 'PER2' }, source: 'Ensembl Compara 112', confidence: 'high' },
  { orthologGroup: 'PER3', geneType: 'clock', symbols: { 'Mus musculus': 'Per3', 'Homo sapiens': 'PER3', 'Arabidopsis thaliana': null, 'Papio anubis': 'PER3' }, source: 'Ensembl Compara 112', confidence: 'high' },
  { orthologGroup: 'CRY1', geneType: 'clock', symbols: { 'Mus musculus': 'Cry1', 'Homo sapiens': 'CRY1', 'Arabidopsis thaliana': 'CRY1', 'Papio anubis': 'CRY1' }, source: 'Ensembl Compara 112 / OrthoDB v11', confidence: 'moderate', note: 'Arabidopsis CRY1 (AT4G08920) is a blue-light photoreceptor, not a transcriptional repressor like mammalian CRY1; functional analog only' },
  { orthologGroup: 'CRY2', geneType: 'clock', symbols: { 'Mus musculus': 'Cry2', 'Homo sapiens': 'CRY2', 'Arabidopsis thaliana': 'CRY2', 'Papio anubis': 'CRY2' }, source: 'Ensembl Compara 112 / OrthoDB v11', confidence: 'moderate', note: 'Arabidopsis CRY2 (AT1G04400) is a blue-light photoreceptor; sequence homology exists but function diverged from mammalian CRY2' },
  { orthologGroup: 'CLOCK', geneType: 'clock', symbols: { 'Mus musculus': 'Clock', 'Homo sapiens': 'CLOCK', 'Arabidopsis thaliana': null, 'Papio anubis': 'CLOCK' }, source: 'Ensembl Compara 112', confidence: 'high' },
  { orthologGroup: 'ARNTL', geneType: 'clock', symbols: { 'Mus musculus': 'Arntl', 'Homo sapiens': 'ARNTL', 'Arabidopsis thaliana': null, 'Papio anubis': 'ARNTL' }, source: 'Ensembl Compara 112', confidence: 'high' },
  { orthologGroup: 'NR1D1', geneType: 'clock', symbols: { 'Mus musculus': 'Nr1d1', 'Homo sapiens': 'NR1D1', 'Arabidopsis thaliana': null, 'Papio anubis': 'NR1D1' }, source: 'Ensembl Compara 112', confidence: 'high' },
  { orthologGroup: 'NR1D2', geneType: 'clock', symbols: { 'Mus musculus': 'Nr1d2', 'Homo sapiens': 'NR1D2', 'Arabidopsis thaliana': null, 'Papio anubis': 'NR1D2' }, source: 'Ensembl Compara 112', confidence: 'high' },
  { orthologGroup: 'DBP', geneType: 'clock', symbols: { 'Mus musculus': 'Dbp', 'Homo sapiens': 'DBP', 'Arabidopsis thaliana': null, 'Papio anubis': 'DBP' }, source: 'Ensembl Compara 112', confidence: 'high' },
  { orthologGroup: 'TEF', geneType: 'clock', symbols: { 'Mus musculus': 'Tef', 'Homo sapiens': 'TEF', 'Arabidopsis thaliana': null, 'Papio anubis': 'TEF' }, source: 'Ensembl Compara 112', confidence: 'high' },
  { orthologGroup: 'NPAS2', geneType: 'clock', symbols: { 'Mus musculus': 'Npas2', 'Homo sapiens': 'NPAS2', 'Arabidopsis thaliana': null, 'Papio anubis': 'NPAS2' }, source: 'Ensembl Compara 112', confidence: 'high' },
  { orthologGroup: 'RORC', geneType: 'clock', symbols: { 'Mus musculus': 'Rorc', 'Homo sapiens': 'RORC', 'Arabidopsis thaliana': null, 'Papio anubis': 'RORC' }, source: 'Ensembl Compara 112', confidence: 'high' },
  { orthologGroup: 'CCA1', geneType: 'clock', symbols: { 'Mus musculus': null, 'Homo sapiens': null, 'Arabidopsis thaliana': 'CCA1', 'Papio anubis': null }, source: 'TAIR / OrthoDB v11', confidence: 'high', locusId: 'AT2G46830' },
  { orthologGroup: 'LHY', geneType: 'clock', symbols: { 'Mus musculus': null, 'Homo sapiens': null, 'Arabidopsis thaliana': 'LHY', 'Papio anubis': null }, source: 'TAIR / OrthoDB v11', confidence: 'high', locusId: 'AT1G01060' },
  { orthologGroup: 'TOC1', geneType: 'clock', symbols: { 'Mus musculus': null, 'Homo sapiens': null, 'Arabidopsis thaliana': 'TOC1', 'Papio anubis': null }, source: 'TAIR / OrthoDB v11', confidence: 'high', locusId: 'AT5G61380' },
  { orthologGroup: 'PRR3', geneType: 'clock', symbols: { 'Mus musculus': null, 'Homo sapiens': null, 'Arabidopsis thaliana': 'PRR3', 'Papio anubis': null }, source: 'TAIR / OrthoDB v11', confidence: 'high', locusId: 'AT5G60100' },
  { orthologGroup: 'PRR5', geneType: 'clock', symbols: { 'Mus musculus': null, 'Homo sapiens': null, 'Arabidopsis thaliana': 'PRR5', 'Papio anubis': null }, source: 'TAIR / OrthoDB v11', confidence: 'high', locusId: 'AT5G24470' },
  { orthologGroup: 'PRR7', geneType: 'clock', symbols: { 'Mus musculus': null, 'Homo sapiens': null, 'Arabidopsis thaliana': 'PRR7', 'Papio anubis': null }, source: 'TAIR / OrthoDB v11', confidence: 'high', locusId: 'AT5G02810' },
  { orthologGroup: 'PRR9', geneType: 'clock', symbols: { 'Mus musculus': null, 'Homo sapiens': null, 'Arabidopsis thaliana': 'PRR9', 'Papio anubis': null }, source: 'TAIR / OrthoDB v11', confidence: 'high', locusId: 'AT2G46790' },
  { orthologGroup: 'GI', geneType: 'clock', symbols: { 'Mus musculus': null, 'Homo sapiens': null, 'Arabidopsis thaliana': 'GI', 'Papio anubis': null }, source: 'TAIR / OrthoDB v11', confidence: 'high', locusId: 'AT1G22770' },
  { orthologGroup: 'ZTL', geneType: 'clock', symbols: { 'Mus musculus': null, 'Homo sapiens': null, 'Arabidopsis thaliana': 'ZTL', 'Papio anubis': null }, source: 'TAIR / OrthoDB v11', confidence: 'high', locusId: 'AT5G57360' },
  { orthologGroup: 'ELF3', geneType: 'clock', symbols: { 'Mus musculus': null, 'Homo sapiens': null, 'Arabidopsis thaliana': 'ELF3', 'Papio anubis': null }, source: 'TAIR / OrthoDB v11', confidence: 'high', locusId: 'AT2G25930' },
  { orthologGroup: 'ELF4', geneType: 'clock', symbols: { 'Mus musculus': null, 'Homo sapiens': null, 'Arabidopsis thaliana': 'ELF4', 'Papio anubis': null }, source: 'TAIR / OrthoDB v11', confidence: 'high', locusId: 'AT2G40080' },
  { orthologGroup: 'LUX', geneType: 'clock', symbols: { 'Mus musculus': null, 'Homo sapiens': null, 'Arabidopsis thaliana': 'LUX', 'Papio anubis': null }, source: 'TAIR / OrthoDB v11', confidence: 'high', locusId: 'AT3G46640' },
  // RVE (REVEILLE) morning-expressed MYB TFs — confirmed oscillating in Qin et al. 2025 snRNA-seq (Nat Commun 16:4171)
  { orthologGroup: 'RVE4', geneType: 'clock', symbols: { 'Mus musculus': null, 'Homo sapiens': null, 'Arabidopsis thaliana': 'RVE4', 'Papio anubis': null }, source: 'TAIR 10 / Qin et al. 2025 Nat Commun', confidence: 'high', locusId: 'AT5G02840', note: 'Morning-expressed MYB TF; activates CCA1/LHY targets; oscillation confirmed by snRNA-seq pseudo-bulk' },
  { orthologGroup: 'RVE6', geneType: 'clock', symbols: { 'Mus musculus': null, 'Homo sapiens': null, 'Arabidopsis thaliana': 'RVE6', 'Papio anubis': null }, source: 'TAIR 10 / Qin et al. 2025 Nat Commun', confidence: 'high', locusId: 'AT5G52660', note: 'Morning-expressed MYB TF; partially redundant with RVE4/RVE8; oscillation confirmed by snRNA-seq pseudo-bulk' },
  { orthologGroup: 'RVE8', geneType: 'clock', symbols: { 'Mus musculus': null, 'Homo sapiens': null, 'Arabidopsis thaliana': 'RVE8', 'Papio anubis': null }, source: 'TAIR 10 / Qin et al. 2025 Nat Commun', confidence: 'high', locusId: 'AT3G09600', note: 'Morning-expressed MYB TF; activates evening element genes (PRR5/TOC1); oscillation confirmed by snRNA-seq pseudo-bulk' },
  // LNK (NIGHT LIGHT INDUCIBLE AND CLOCK REGULATED) — scaffold proteins linking RVE8 to evening complex
  { orthologGroup: 'LNK1', geneType: 'clock', symbols: { 'Mus musculus': null, 'Homo sapiens': null, 'Arabidopsis thaliana': 'LNK1', 'Papio anubis': null }, source: 'TAIR 10 / Qin et al. 2025 Nat Commun', confidence: 'high', locusId: 'AT5G64170', note: 'Evening-expressed scaffold; links RVE8 to RNA Pol II at clock gene promoters; oscillation confirmed by snRNA-seq pseudo-bulk' },
  { orthologGroup: 'LNK2', geneType: 'clock', symbols: { 'Mus musculus': null, 'Homo sapiens': null, 'Arabidopsis thaliana': 'LNK2', 'Papio anubis': null }, source: 'TAIR 10 / Qin et al. 2025 Nat Commun', confidence: 'high', locusId: 'AT3G54500', note: 'Evening-expressed scaffold; partially redundant with LNK1; oscillation confirmed by snRNA-seq pseudo-bulk' },
  // ABF1 — newly identified circadian regulator (overexpression shortens period); Qin et al. 2025
  { orthologGroup: 'ABF1', geneType: 'clock', symbols: { 'Mus musculus': null, 'Homo sapiens': null, 'Arabidopsis thaliana': 'ABF1', 'Papio anubis': null }, source: 'TAIR 10 / Qin et al. 2025 Nat Commun', confidence: 'moderate', locusId: 'AT1G49720', note: 'ABA-responsive bZIP TF; overexpression shortens circadian period; identified as clock regulator by snRNA-seq; functional validation pending broader replication' },
  { orthologGroup: 'MYC', geneType: 'target', symbols: { 'Mus musculus': 'Myc', 'Homo sapiens': 'MYC', 'Arabidopsis thaliana': null, 'Papio anubis': 'MYC' }, source: 'Ensembl Compara 112', confidence: 'high' },
  { orthologGroup: 'CCND1', geneType: 'target', symbols: { 'Mus musculus': 'Ccnd1', 'Homo sapiens': 'CCND1', 'Arabidopsis thaliana': null, 'Papio anubis': 'CCND1' }, source: 'Ensembl Compara 112', confidence: 'high' },
  { orthologGroup: 'CCNB1', geneType: 'target', symbols: { 'Mus musculus': 'Ccnb1', 'Homo sapiens': 'CCNB1', 'Arabidopsis thaliana': null, 'Papio anubis': 'CCNB1' }, source: 'Ensembl Compara 112', confidence: 'high' },
  { orthologGroup: 'CDK1', geneType: 'target', symbols: { 'Mus musculus': 'Cdk1', 'Homo sapiens': 'CDK1', 'Arabidopsis thaliana': null, 'Papio anubis': 'CDK1' }, source: 'Ensembl Compara 112', confidence: 'high' },
  { orthologGroup: 'WEE1', geneType: 'target', symbols: { 'Mus musculus': 'Wee1', 'Homo sapiens': 'WEE1', 'Arabidopsis thaliana': null, 'Papio anubis': 'WEE1' }, source: 'Ensembl Compara 112', confidence: 'high' },
  { orthologGroup: 'CDKN1A', geneType: 'target', symbols: { 'Mus musculus': 'Cdkn1a', 'Homo sapiens': 'CDKN1A', 'Arabidopsis thaliana': null, 'Papio anubis': 'CDKN1A' }, source: 'Ensembl Compara 112', confidence: 'high' },
  { orthologGroup: 'LGR5', geneType: 'target', symbols: { 'Mus musculus': 'Lgr5', 'Homo sapiens': 'LGR5', 'Arabidopsis thaliana': null, 'Papio anubis': 'LGR5' }, source: 'Ensembl Compara 112', confidence: 'high' },
  { orthologGroup: 'AXIN2', geneType: 'target', symbols: { 'Mus musculus': 'Axin2', 'Homo sapiens': 'AXIN2', 'Arabidopsis thaliana': null, 'Papio anubis': 'AXIN2' }, source: 'Ensembl Compara 112', confidence: 'high' },
  { orthologGroup: 'CTNNB1', geneType: 'target', symbols: { 'Mus musculus': 'Ctnnb1', 'Homo sapiens': 'CTNNB1', 'Arabidopsis thaliana': null, 'Papio anubis': 'CTNNB1' }, source: 'Ensembl Compara 112', confidence: 'high' },
  { orthologGroup: 'APC', geneType: 'target', symbols: { 'Mus musculus': 'Apc', 'Homo sapiens': 'APC', 'Arabidopsis thaliana': null, 'Papio anubis': 'APC' }, source: 'Ensembl Compara 112 / MGI', confidence: 'high' },
  { orthologGroup: 'TP53', geneType: 'target', symbols: { 'Mus musculus': 'Tp53', 'Homo sapiens': 'TP53', 'Arabidopsis thaliana': null, 'Papio anubis': 'TP53' }, source: 'Ensembl Compara 112 / MGI', confidence: 'high' },
  { orthologGroup: 'MDM2', geneType: 'target', symbols: { 'Mus musculus': 'Mdm2', 'Homo sapiens': 'MDM2', 'Arabidopsis thaliana': null, 'Papio anubis': 'MDM2' }, source: 'Ensembl Compara 112', confidence: 'high' },
  { orthologGroup: 'BCL2', geneType: 'target', symbols: { 'Mus musculus': 'Bcl2', 'Homo sapiens': 'BCL2', 'Arabidopsis thaliana': null, 'Papio anubis': 'BCL2' }, source: 'Ensembl Compara 112', confidence: 'high' },
  { orthologGroup: 'BAX', geneType: 'target', symbols: { 'Mus musculus': 'Bax', 'Homo sapiens': 'BAX', 'Arabidopsis thaliana': null, 'Papio anubis': 'BAX' }, source: 'Ensembl Compara 112', confidence: 'high' },
];

function resolveAlias(gene: string): string {
  const upper = gene.toUpperCase();
  return ALIASES[upper] || gene;
}

function findEntry(gene: string, species: Species): OrthologEntry | null {
  const resolved = resolveAlias(gene);
  const upper = resolved.toUpperCase();
  for (const entry of ORTHOLOG_TABLE) {
    const sym = entry.symbols[species];
    if (sym && sym.toUpperCase() === upper) return entry;
  }
  return null;
}

export function getOrtholog(gene: string, fromSpecies: Species, toSpecies: Species): string | null {
  const entry = findEntry(gene, fromSpecies);
  if (!entry) return null;
  return entry.symbols[toSpecies];
}

export function getCanonicalSymbol(gene: string, species: Species): string | null {
  const entry = findEntry(gene, species);
  if (!entry) return null;
  return entry.symbols['Mus musculus'] || entry.orthologGroup;
}

export function getAllOrthologs(gene: string, species: Species): Record<Species, string | null> {
  const entry = findEntry(gene, species);
  if (!entry) return { 'Mus musculus': null, 'Homo sapiens': null, 'Arabidopsis thaliana': null, 'Papio anubis': null };
  return { ...entry.symbols };
}

export function isOrthologousGene(gene1: string, species1: Species, gene2: string, species2: Species): boolean {
  const entry1 = findEntry(gene1, species1);
  const entry2 = findEntry(gene2, species2);
  if (!entry1 || !entry2) return false;
  return entry1.orthologGroup === entry2.orthologGroup;
}

export function getOrthologTable(): OrthologEntry[] {
  return [...ORTHOLOG_TABLE];
}

export function resolveToCanonical(gene: string): { canonical: string; species: Species; geneType: 'clock' | 'target' | 'unknown' } | null {
  const allSpecies: Species[] = ['Mus musculus', 'Homo sapiens', 'Arabidopsis thaliana', 'Papio anubis'];
  for (const sp of allSpecies) {
    const entry = findEntry(gene, sp);
    if (entry) {
      const canonical = entry.symbols['Mus musculus'] || entry.orthologGroup;
      return { canonical, species: sp, geneType: entry.geneType };
    }
  }
  return null;
}

export function getOrthologConfidence(gene: string, species: Species): 'high' | 'moderate' | null {
  const entry = findEntry(gene, species);
  return entry ? entry.confidence : null;
}

export function getOrthologSource(gene: string, species: Species): string | null {
  const entry = findEntry(gene, species);
  return entry ? entry.source : null;
}

export function getOrthologGroup(gene: string, species: Species): string | null {
  const entry = findEntry(gene, species);
  return entry ? entry.orthologGroup : null;
}

export function buildCrossSpeciesComparison(
  geneEigenvalues: { gene: string; eigenvalue: number; geneType: string }[],
  species: Species
): { orthologGroup: string; gene: string; eigenvalue: number; geneType: string; confidence: 'high' | 'moderate'; source: string; hasMultiSpeciesOrthologs: boolean }[] {
  const results: { orthologGroup: string; gene: string; eigenvalue: number; geneType: string; confidence: 'high' | 'moderate'; source: string; hasMultiSpeciesOrthologs: boolean }[] = [];
  for (const g of geneEigenvalues) {
    const entry = findEntry(g.gene, species);
    if (entry) {
      const speciesWithOrtholog = Object.values(entry.symbols).filter(s => s !== null).length;
      results.push({
        orthologGroup: entry.orthologGroup,
        gene: g.gene,
        eigenvalue: g.eigenvalue,
        geneType: g.geneType,
        confidence: entry.confidence,
        source: entry.source,
        hasMultiSpeciesOrthologs: speciesWithOrtholog >= 2
      });
    }
  }
  return results;
}
