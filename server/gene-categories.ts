export const GENE_CATEGORIES = {
  clock: new Set([
    'PER1', 'PER2', 'PER3', 'CRY1', 'CRY2', 'CLOCK', 'ARNTL', 'BMAL1',
    'NR1D1', 'NR1D2', 'RORA', 'RORC', 'DBP', 'TEF', 'HLF', 'NFIL3', 'NPAS2'
  ]),
  target: new Set([
    'MYC', 'CCND1', 'CCNB1', 'CDK1', 'WEE1', 'CDKN1A', 'LGR5', 'AXIN2',
    'CTNNB1', 'APC', 'TP53', 'TRP53', 'MDM2', 'ATM', 'CHEK2', 'BCL2',
    'BAX', 'PPARG', 'SIRT1', 'HIF1A', 'CCNE1', 'CCNE2', 'MCM6', 'MKI67'
  ]),
  housekeeping: new Set([
    'GAPDH', 'ACTB', 'HPRT', 'TBP', 'B2M', 'RPLP0', 'PGK1', 'PPIA', 'GUSB',
    'SDHA', 'TUBB5', 'UBC', 'YWHAZ', 'HMBS', 'ALDOA', 'ENO1', 'LDHA', 'TPI1',
    'RPL13A', 'RPS18', 'POLR2A', 'EEF1A1', 'EIF4A2'
  ]),
  immune: new Set([
    'TNF', 'IL1B', 'IL6', 'IL10', 'IFNG', 'STAT1', 'STAT3', 'IRF1', 'IRF7',
    'NFKB1', 'NFKB2', 'RELA', 'TLR2', 'TLR4', 'CD4', 'CD8A', 'CD19', 'CD68',
    'FCGR1', 'CXCL1', 'CXCL10', 'CCL2', 'CCL5', 'ICOS', 'PTPRC'
  ]),
  metabolic: new Set([
    'PPARA', 'PPARD', 'PPARGC1A', 'FASN', 'ACACA', 'HMGCR', 'CYP7A1', 'GPX1',
    'SOD1', 'SOD2', 'CAT', 'GLUT1', 'SLC2A1', 'SLC2A2', 'GCK', 'PCK1', 'G6PC',
    'FBP1', 'CS', 'IDH1', 'IDH2', 'OGDH', 'NDUFV1', 'COX4I1', 'ATP5A1',
    'ACOX1', 'CPT1A', 'ACADM'
  ]),
  chromatin: new Set([
    'HDAC1', 'HDAC2', 'HDAC3', 'HDAC4', 'SIRT2', 'SIRT3', 'SIRT6', 'SIRT7',
    'KAT2A', 'KAT2B', 'EP300', 'CREBBP', 'EZH2', 'KDM5A', 'KDM1A', 'DNMT1',
    'DNMT3A', 'DNMT3B', 'TET1', 'TET2', 'TET3', 'SMARCA4', 'ARID1A', 'CTCF',
    'SUV39H1', 'SETDB1'
  ]),
  signaling: new Set([
    'NOTCH1', 'NOTCH2', 'HES1', 'HEY1', 'DLL1', 'JAG1', 'WNT3A', 'WNT5A',
    'FZD1', 'FZD7', 'LRP5', 'LRP6', 'DKK1', 'RSPO1', 'SHH', 'GLI1', 'GLI2',
    'PTCH1', 'SMO', 'MAPK1', 'MAPK3', 'AKT1', 'AKT2', 'PTEN', 'MTOR',
    'RPTOR', 'EGFR', 'ERBB2', 'FGFR1', 'VEGFA', 'TGFB1', 'SMAD2', 'SMAD3',
    'SMAD4', 'BMP2', 'BMP4'
  ]),
  dna_repair: new Set([
    'BRCA1', 'BRCA2', 'RAD51', 'RAD50', 'XRCC1', 'XRCC4', 'ERCC1', 'ERCC2',
    'MLH1', 'MSH2', 'MSH6', 'PMS2', 'XPC', 'DDB2', 'OGG1', 'APEX1', 'LIG1',
    'LIG3', 'LIG4', 'PARP1', 'PARP2', 'POLB', 'POLK', 'REV3L', 'FANCD2',
    'FANCA', 'H2AFX'
  ]),
  stem: new Set([
    'LGR5', 'ASCL2', 'SMOC2', 'OLFM4', 'BMI1', 'SOX2', 'SOX9', 'POU5F1',
    'NANOG', 'KLF4', 'LIN28A', 'ALDH1A1', 'PROM1', 'CD44', 'LRIG1', 'HOPX',
    'TERT', 'LY6A'
  ]),
} as const;

export type GeneCategory = keyof typeof GENE_CATEGORIES | 'other';

export const ALL_CATEGORIES: GeneCategory[] = [
  'clock', 'target', 'housekeeping', 'immune', 'metabolic',
  'chromatin', 'signaling', 'dna_repair', 'stem', 'other'
];

export const CATEGORY_META: Record<GeneCategory, { label: string; color: string; description: string }> = {
  clock:        { label: 'Clock',         color: '#f59e0b', description: 'Core circadian clock machinery' },
  target:       { label: 'Target',        color: '#ef4444', description: 'Cell cycle / cancer-relevant targets' },
  housekeeping: { label: 'Housekeeping',  color: '#6b7280', description: 'Constitutively expressed reference genes' },
  immune:       { label: 'Immune',        color: '#8b5cf6', description: 'Immune response and inflammation' },
  metabolic:    { label: 'Metabolic',     color: '#10b981', description: 'Metabolism and energy pathways' },
  chromatin:    { label: 'Chromatin',     color: '#ec4899', description: 'Epigenetic regulation and chromatin remodeling' },
  signaling:    { label: 'Signaling',     color: '#3b82f6', description: 'Developmental and growth factor signaling' },
  dna_repair:   { label: 'DNA Repair',    color: '#14b8a6', description: 'DNA damage response and repair' },
  stem:         { label: 'Stem Cell',     color: '#f97316', description: 'Stem cell markers and pluripotency factors' },
  other:        { label: 'Other',         color: '#475569', description: 'Unclassified genes' },
};

export const GENE_ALIASES: Record<string, string[]> = {
  'BMAL1': ['ARNTL'],
  'ARNTL': ['BMAL1'],
  'TP53': ['TRP53'],
  'TRP53': ['TP53'],
  'MMP7': ['MATRILYSIN'],
  'CCNA2': ['CYCLIN_A2'],
  'HPRT1': ['HPRT'],
  'HPRT': ['HPRT1'],
  'SLC2A1': ['GLUT1'],
  'GLUT1': ['SLC2A1'],
};

export function resolveGeneAliases(name: string): string[] {
  const upper = name.toUpperCase();
  const aliases = GENE_ALIASES[upper] || [];
  return [upper, ...aliases];
}

export function classifyGene(name: string): GeneCategory {
  const candidates = resolveGeneAliases(name);
  for (const candidate of candidates) {
    for (const [category, geneSet] of Object.entries(GENE_CATEGORIES)) {
      if (geneSet.has(candidate)) return category as GeneCategory;
    }
  }
  return 'other';
}

export const ENSEMBL_TO_SYMBOL: Record<string, string> = {
  'ENSMUSG00000020893': 'Per1', 'ENSMUSG00000055866': 'Per2', 'ENSMUSG00000028957': 'Per3',
  'ENSMUSG00000020038': 'Cry1', 'ENSMUSG00000068742': 'Cry2',
  'ENSMUSG00000029238': 'Clock', 'ENSMUSG00000055116': 'Arntl',
  'ENSMUSG00000020889': 'Nr1d1', 'ENSMUSG00000021775': 'Nr1d2',
  'ENSMUSG00000032238': 'Rora', 'ENSMUSG00000028150': 'Rorc',
  'ENSMUSG00000059824': 'Dbp', 'ENSMUSG00000022389': 'Tef',
  'ENSMUSG00000003949': 'Hlf', 'ENSMUSG00000056749': 'Nfil3',
  'ENSMUSG00000022346': 'Myc', 'ENSMUSG00000070348': 'Ccnd1',
  'ENSMUSG00000041431': 'Ccnb1', 'ENSMUSG00000019942': 'Cdk1',
  'ENSMUSG00000031016': 'Wee1', 'ENSMUSG00000023067': 'Cdkn1a',
  'ENSMUSG00000020140': 'Lgr5', 'ENSMUSG00000000142': 'Axin2',
  'ENSMUSG00000006932': 'Ctnnb1', 'ENSMUSG00000005871': 'Apc',
  'ENSMUSG00000059552': 'Trp53', 'ENSMUSG00000020184': 'Mdm2',
  'ENSMUSG00000034218': 'Atm', 'ENSMUSG00000029521': 'Chek2',
  'ENSMUSG00000057329': 'Bcl2', 'ENSMUSG00000003873': 'Bax',
  'ENSMUSG00000000440': 'Pparg', 'ENSMUSG00000020063': 'Sirt1',
  'ENSMUSG00000021109': 'Hif1a',
  'ENSMUSG00000026077': 'Npas2',
  'ENSMUSG00000002068': 'Ccne1', 'ENSMUSG00000028399': 'Ccne2',
  'ENSMUSG00000025544': 'Mcm6', 'ENSMUSG00000031004': 'Mki67',
  'ENSMUSG00000028530': 'Gapdh', 'ENSMUSG00000029580': 'Actb',
  'ENSMUSG00000025630': 'Hprt', 'ENSMUSG00000014767': 'Tbp',
  'ENSMUSG00000060802': 'B2m', 'ENSMUSG00000067274': 'Rplp0',
  'ENSMUSG00000018585': 'Pgk1', 'ENSMUSG00000071866': 'Ppia',
  'ENSMUSG00000025534': 'Gusb',
  'ENSMUSG00000028234': 'Tnf', 'ENSMUSG00000027398': 'Il1b',
  'ENSMUSG00000025746': 'Il6', 'ENSMUSG00000016529': 'Il10',
  'ENSMUSG00000055170': 'Ifng', 'ENSMUSG00000026104': 'Stat1',
  'ENSMUSG00000004040': 'Stat3',
  'ENSMUSG00000053113': 'Hdac1', 'ENSMUSG00000019777': 'Hdac2',
  'ENSMUSG00000028800': 'Hdac3',
  'ENSMUSG00000017146': 'Brca1', 'ENSMUSG00000041147': 'Brca2',
  'ENSMUSG00000027323': 'Rad51',
  'ENSMUSG00000020053': 'Notch1', 'ENSMUSG00000027878': 'Notch2',
  'ENSMUSG00000028717': 'Hes1',
  'ENSMUSG00000027763': 'Fasn', 'ENSMUSG00000020532': 'Ppara',
  'ENSMUSG00000022015': 'Ppargc1a',
  'ENSMUSG00000020679': 'Ascl2', 'ENSMUSG00000023886': 'Smoc2',
  'ENSMUSG00000024766': 'Olfm4', 'ENSMUSG00000028673': 'Bmi1',
  'ENSMUSG00000074637': 'Sox2', 'ENSMUSG00000000567': 'Sox9',
};
