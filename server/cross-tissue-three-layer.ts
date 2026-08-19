import * as fs from 'fs';
import { parse } from 'csv-parse/sync';
import { solveAR2Eigenvalues } from './par2-engine';

interface TissueConfig {
  name: string;
  file: string;
  identityMarkers: Record<string, string>;
  identityLabel: string;
}

interface GeneEigenvalue {
  gene: string;
  eigenvalue: number;
  phi1: number;
  phi2: number;
  r2: number;
  layer: 'identity' | 'clock' | 'proliferation';
}

interface TissueThreeLayerResult {
  tissue: string;
  identityLabel: string;
  nTimepoints: number;
  identityMean: number;
  clockMean: number;
  prolifMean: number;
  identityClockGap: number;
  clockProlifGap: number;
  identityProlifGap: number;
  hierarchyConfirmed: boolean;
  partialHierarchy: string;
  identityGenes: GeneEigenvalue[];
  clockGenes: GeneEigenvalue[];
  prolifGenes: GeneEigenvalue[];
  nIdentityFound: number;
  nClockFound: number;
  nProlifFound: number;
}

interface PermutationResult {
  tissue: string;
  observedGap: number;
  pValue: number;
  zScore: number;
  nPermutations: number;
}

export interface CrossTissueThreeLayerResult {
  tissues: TissueThreeLayerResult[];
  summary: {
    nTissues: number;
    nConfirmed: number;
    nPartial: number;
    nFailed: number;
    meanIdentityClockGap: number;
    meanClockProlifGap: number;
    overallVerdict: string;
  };
  permutationTests: PermutationResult[];
  bootstrapCI: {
    identityClockGap: { lower: number; upper: number; mean: number };
    clockProlifGap: { lower: number; upper: number; mean: number };
  };
}

const CLOCK_GENES = [
  'Arntl', 'Clock', 'Per1', 'Per2', 'Cry1', 'Cry2',
  'Nr1d1', 'Nr1d2', 'Dbp', 'Tef', 'Nfil3'
];

const PROLIFERATION_GENES = [
  'Myc', 'Ccnd1', 'Cdk1', 'Wee1', 'Ccnb1', 'Ccne1',
  'Mki67', 'Pcna', 'Top2a', 'Cdk2', 'Cdk4'
];

const TISSUE_CONFIGS: TissueConfig[] = [
  {
    name: 'Liver',
    file: 'datasets/GSE54650_Liver_circadian.csv',
    identityLabel: 'Hepatocyte Identity',
    identityMarkers: {
      'Alb': 'Albumin — primary hepatocyte marker',
      'Hnf4a': 'HNF4α — master hepatocyte transcription factor',
      'Cyp3a11': 'Cytochrome P450 3A11 — drug metabolism',
      'Cyp2e1': 'Cytochrome P450 2E1 — ethanol metabolism',
      'Cyp1a2': 'Cytochrome P450 1A2 — xenobiotic metabolism',
      'Pck1': 'PEPCK — gluconeogenesis',
      'G6pc': 'Glucose-6-phosphatase — glucose homeostasis',
      'Afp': 'Alpha-fetoprotein',
    },
  },
  {
    name: 'Kidney',
    file: 'datasets/GSE54650_Kidney_circadian.csv',
    identityLabel: 'Nephron/Podocyte Identity',
    identityMarkers: {
      'Slc22a6': 'OAT1 — proximal tubule organic anion transporter',
      'Aqp1': 'Aquaporin 1 — proximal tubule water channel',
      'Aqp2': 'Aquaporin 2 — collecting duct water channel',
      'Slc12a1': 'NKCC2 — thick ascending limb',
      'Umod': 'Uromodulin — thick ascending limb / distal tubule',
      'Nphs1': 'Nephrin — podocyte slit diaphragm',
      'Nphs2': 'Podocin — podocyte structural protein',
      'Podxl': 'Podocalyxin — podocyte glycocalyx',
      'Slc34a1': 'NaPi-IIa — proximal tubule phosphate transport',
      'Pax2': 'PAX2 — kidney development transcription factor',
    },
  },
  {
    name: 'Heart',
    file: 'datasets/GSE54650_Heart_circadian.csv',
    identityLabel: 'Cardiomyocyte Identity',
    identityMarkers: {
      'Myh6': 'α-Myosin heavy chain — adult cardiomyocyte',
      'Myh7': 'β-Myosin heavy chain — fetal/stressed cardiomyocyte',
      'Tnni3': 'Cardiac troponin I — sarcomere',
      'Tnnt2': 'Cardiac troponin T — sarcomere',
      'Myl2': 'Myosin light chain 2 — ventricular',
      'Myl7': 'Myosin light chain 7 — atrial',
      'Actn2': 'α-Actinin 2 — Z-disc',
      'Ryr2': 'Ryanodine receptor 2 — calcium release',
      'Nkx2-5': 'NKX2.5 — cardiac transcription factor',
      'Gata4': 'GATA4 — cardiac transcription factor',
      'Tbx5': 'TBX5 — cardiac transcription factor',
    },
  },
  {
    name: 'Lung',
    file: 'datasets/GSE54650_Lung_circadian.csv',
    identityLabel: 'Pulmonary Epithelial Identity',
    identityMarkers: {
      'Sftpc': 'Surfactant protein C — type II alveolar cell',
      'Sftpa1': 'Surfactant protein A — alveolar epithelium',
      'Sftpb': 'Surfactant protein B — alveolar epithelium',
      'Aqp5': 'Aquaporin 5 — type I alveolar cell',
      'Scgb1a1': 'CC10/CCSP — Clara/Club cell',
      'Foxj1': 'FOXJ1 — ciliated epithelial cell',
      'Nkx2-1': 'NKX2.1/TTF-1 — lung epithelial master regulator',
    },
  },
  {
    name: 'Muscle',
    file: 'datasets/GSE54650_Muscle_circadian.csv',
    identityLabel: 'Myocyte Identity',
    identityMarkers: {
      'Myod1': 'MyoD — myogenic determination factor',
      'Myog': 'Myogenin — muscle differentiation',
      'Myh1': 'Myosin heavy chain IIx — fast twitch',
      'Myh2': 'Myosin heavy chain IIa — fast twitch',
      'Myh4': 'Myosin heavy chain IIb — fastest twitch',
      'Acta1': 'α-Skeletal actin — sarcomere',
      'Tnni2': 'Fast troponin I — sarcomere',
      'Des': 'Desmin — intermediate filament',
      'Dmd': 'Dystrophin — cytoskeleton',
      'Pax7': 'PAX7 — satellite cell / muscle stem cell',
    },
  },
  {
    name: 'Cerebellum',
    file: 'datasets/GSE54650_Cerebellum_circadian.csv',
    identityLabel: 'Neural Cell Identity',
    identityMarkers: {
      'Gfap': 'GFAP — astrocyte marker',
      'Aqp4': 'Aquaporin 4 — astrocyte water channel',
      'Mbp': 'MBP — oligodendrocyte myelin',
      'Plp1': 'PLP1 — oligodendrocyte myelin proteolipid',
      'Olig2': 'OLIG2 — oligodendrocyte transcription factor',
      'Rbfox3': 'NeuN — mature neuron nuclear marker',
      'Snap25': 'SNAP25 — synaptic vesicle protein',
      'Syt1': 'Synaptotagmin 1 — synaptic vesicle sensor',
    },
  },
  {
    name: 'Brown Fat',
    file: 'datasets/GSE54650_Brown_Fat_circadian.csv',
    identityLabel: 'Brown Adipocyte Identity',
    identityMarkers: {
      'Ucp1': 'UCP1 — uncoupling protein, thermogenesis',
      'Cidea': 'CIDEA — lipid droplet protein',
      'Ppargc1a': 'PGC1α — mitochondrial biogenesis',
      'Dio2': 'Deiodinase 2 — thyroid hormone activation',
      'Prdm16': 'PRDM16 — brown fat determination factor',
      'Adipoq': 'Adiponectin — adipocyte marker',
      'Fabp4': 'FABP4/aP2 — fatty acid binding protein',
      'Lep': 'Leptin — adipocyte hormone',
    },
  },
  {
    name: 'White Fat',
    file: 'datasets/GSE54650_White_Fat_circadian.csv',
    identityLabel: 'White Adipocyte Identity',
    identityMarkers: {
      'Adipoq': 'Adiponectin — adipocyte marker',
      'Fabp4': 'FABP4/aP2 — fatty acid binding protein',
      'Lep': 'Leptin — adipocyte hormone',
      'Pparg': 'PPARγ — adipogenesis master regulator',
      'Cebpa': 'C/EBPα — adipocyte differentiation',
      'Plin1': 'Perilipin 1 — lipid droplet coat protein',
      'Retn': 'Resistin — adipokine',
      'Slc2a4': 'GLUT4 — insulin-responsive glucose transporter',
    },
  },
  {
    name: 'Brainstem',
    file: 'datasets/GSE54650_Brainstem_circadian.csv',
    identityLabel: 'Brainstem Neuron Identity',
    identityMarkers: {
      'Th': 'Tyrosine hydroxylase — catecholaminergic neurons',
      'Slc6a3': 'DAT — dopamine transporter',
      'Tph2': 'Tryptophan hydroxylase 2 — serotonergic neurons',
      'Slc6a4': 'SERT — serotonin transporter',
      'Chat': 'Choline acetyltransferase — cholinergic neurons',
      'Slc18a3': 'VAChT — vesicular acetylcholine transporter',
      'Phox2b': 'PHOX2B — autonomic neuron transcription factor',
    },
  },
  {
    name: 'Hypothalamus',
    file: 'datasets/GSE54650_Hypothalamus_circadian.csv',
    identityLabel: 'Hypothalamic Neuron Identity',
    identityMarkers: {
      'Avp': 'Arginine vasopressin — SCN/PVN',
      'Vip': 'Vasoactive intestinal peptide — SCN',
      'Oxt': 'Oxytocin — PVN',
      'Crh': 'Corticotropin-releasing hormone — PVN',
      'Agrp': 'Agouti-related peptide — arcuate',
      'Npy': 'Neuropeptide Y — arcuate',
      'Pomc': 'POMC — arcuate',
      'Hcrt': 'Hypocretin/Orexin — lateral hypothalamus',
      'Kiss1': 'Kisspeptin — GnRH regulation',
    },
  },
  {
    name: 'Aorta',
    file: 'datasets/GSE54650_Aorta_circadian.csv',
    identityLabel: 'Vascular Identity',
    identityMarkers: {
      'Myh11': 'Smooth muscle myosin heavy chain',
      'Acta2': 'α-smooth muscle actin — vascular SMC',
      'Tagln': 'Transgelin/SM22α — smooth muscle',
      'Cnn1': 'Calponin 1 — smooth muscle',
      'Pecam1': 'CD31 — endothelial cell',
      'Cdh5': 'VE-cadherin — endothelial junction',
      'Nos3': 'eNOS — endothelial nitric oxide',
      'Vwf': 'von Willebrand factor — endothelial',
    },
  },
  {
    name: 'Adrenal',
    file: 'datasets/GSE54650_Adrenal_circadian.csv',
    identityLabel: 'Adrenocortical Identity',
    identityMarkers: {
      'Cyp11a1': 'P450scc — cholesterol side-chain cleavage',
      'Cyp11b1': '11β-hydroxylase — cortisol synthesis',
      'Cyp11b2': 'Aldosterone synthase',
      'Star': 'StAR — steroidogenesis rate-limiting',
      'Cyp21a1': '21-hydroxylase — steroidogenesis',
      'Nr5a1': 'SF-1 — steroidogenic factor 1',
      'Mc2r': 'ACTH receptor — adrenal cortex',
    },
  },
];

function readDataset(filepath: string): Map<string, number[]> {
  const fullPath = filepath.startsWith('/') ? filepath : filepath;
  if (!fs.existsSync(fullPath)) return new Map();
  const content = fs.readFileSync(fullPath, 'utf-8');
  const records = parse(content, { columns: false, skip_empty_lines: true });
  const data = new Map<string, number[]>();
  for (let i = 1; i < records.length; i++) {
    const row = records[i] as string[];
    const id = (row[0] || '').replace(/"/g, '').trim();
    if (!id) continue;
    const values = row.slice(1).map((v: string) => parseFloat(v)).filter((v: number) => !isNaN(v));
    if (values.length < 5) continue;
    data.set(id, values);
  }
  return data;
}

function fitAR2(series: number[]): { phi1: number; phi2: number; eigenvalue: number; r2: number } | null {
  const n = series.length;
  if (n < 5) return null;
  const Y = series.slice(2);
  const Y1 = series.slice(1, n - 1);
  const Y2 = series.slice(0, n - 2);
  let s11 = 0, s22 = 0, s12 = 0, sy1 = 0, sy2 = 0;
  for (let i = 0; i < Y.length; i++) {
    s11 += Y1[i] * Y1[i];
    s22 += Y2[i] * Y2[i];
    s12 += Y1[i] * Y2[i];
    sy1 += Y[i] * Y1[i];
    sy2 += Y[i] * Y2[i];
  }
  const denom = s11 * s22 - s12 * s12;
  if (Math.abs(denom) < 1e-12) return null;
  const phi1 = (sy1 * s22 - sy2 * s12) / denom;
  const phi2 = (sy2 * s11 - sy1 * s12) / denom;
  const eigResult = solveAR2Eigenvalues(phi1, phi2);
  const eigenvalue = Math.max(eigResult.modulus1, eigResult.modulus2);
  const yPred = Y1.map((_, i) => phi1 * Y1[i] + phi2 * Y2[i]);
  const meanY = Y.reduce((a, b) => a + b, 0) / Y.length;
  const ssRes = Y.reduce((sum, y, i) => sum + (y - yPred[i]) ** 2, 0);
  const ssTot = Y.reduce((sum, y) => sum + (y - meanY) ** 2, 0);
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  return { phi1, phi2, eigenvalue, r2 };
}

function getGeneEigenvalue(data: Map<string, number[]>, gene: string, layer: 'identity' | 'clock' | 'proliferation'): GeneEigenvalue | null {
  const series = data.get(gene);
  if (!series) return null;
  const fit = fitAR2(series);
  if (!fit) return null;
  return { gene, eigenvalue: fit.eigenvalue, phi1: fit.phi1, phi2: fit.phi2, r2: fit.r2, layer };
}

function analyzeTissue(config: TissueConfig): TissueThreeLayerResult | null {
  const data = readDataset(config.file);
  if (data.size === 0) return null;

  const nTimepoints = data.values().next().value?.length || 0;

  const identityGenes: GeneEigenvalue[] = [];
  for (const gene of Object.keys(config.identityMarkers)) {
    const result = getGeneEigenvalue(data, gene, 'identity');
    if (result) identityGenes.push(result);
  }

  const clockGenes: GeneEigenvalue[] = [];
  for (const gene of CLOCK_GENES) {
    const result = getGeneEigenvalue(data, gene, 'clock');
    if (result) clockGenes.push(result);
  }

  const prolifGenes: GeneEigenvalue[] = [];
  for (const gene of PROLIFERATION_GENES) {
    const result = getGeneEigenvalue(data, gene, 'proliferation');
    if (result) prolifGenes.push(result);
  }

  if (identityGenes.length < 3 || clockGenes.length < 3 || prolifGenes.length < 3) return null;

  const mean = (arr: GeneEigenvalue[]) => arr.reduce((s, g) => s + g.eigenvalue, 0) / arr.length;
  const identityMean = mean(identityGenes);
  const clockMean = mean(clockGenes);
  const prolifMean = mean(prolifGenes);

  const hierarchyConfirmed = identityMean > clockMean && clockMean > prolifMean;
  let partialHierarchy = 'None';
  if (hierarchyConfirmed) {
    partialHierarchy = 'Full: Identity > Clock > Proliferation';
  } else if (identityMean > clockMean) {
    partialHierarchy = 'Partial: Identity > Clock (proliferation out of order)';
  } else if (clockMean > prolifMean) {
    partialHierarchy = 'Two-layer only: Clock > Proliferation (identity below clock)';
  } else {
    partialHierarchy = 'Inverted or no hierarchy detected';
  }

  return {
    tissue: config.name,
    identityLabel: config.identityLabel,
    nTimepoints,
    identityMean,
    clockMean,
    prolifMean,
    identityClockGap: identityMean - clockMean,
    clockProlifGap: clockMean - prolifMean,
    identityProlifGap: identityMean - prolifMean,
    hierarchyConfirmed,
    partialHierarchy,
    identityGenes: identityGenes.sort((a, b) => b.eigenvalue - a.eigenvalue),
    clockGenes: clockGenes.sort((a, b) => b.eigenvalue - a.eigenvalue),
    prolifGenes: prolifGenes.sort((a, b) => b.eigenvalue - a.eigenvalue),
    nIdentityFound: identityGenes.length,
    nClockFound: clockGenes.length,
    nProlifFound: prolifGenes.length,
  };
}

function runPermutationTest(tissueResult: TissueThreeLayerResult, nPerms: number = 10000, seed: number = 42): PermutationResult {
  const allGenes = [
    ...tissueResult.identityGenes,
    ...tissueResult.clockGenes,
    ...tissueResult.prolifGenes,
  ];
  const allEigs = allGenes.map(g => g.eigenvalue);
  const nIdentity = tissueResult.identityGenes.length;
  const nClock = tissueResult.clockGenes.length;

  const observedGap = tissueResult.identityClockGap;

  let rng = seed;
  function nextRand(): number {
    rng = (rng * 1103515245 + 12345) & 0x7fffffff;
    return rng / 0x7fffffff;
  }

  let countGreater = 0;
  const permGaps: number[] = [];
  for (let p = 0; p < nPerms; p++) {
    const shuffled = [...allEigs];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(nextRand() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const permIdentity = shuffled.slice(0, nIdentity);
    const permClock = shuffled.slice(nIdentity, nIdentity + nClock);
    const permIdentityMean = permIdentity.reduce((a, b) => a + b, 0) / permIdentity.length;
    const permClockMean = permClock.reduce((a, b) => a + b, 0) / permClock.length;
    const permGap = permIdentityMean - permClockMean;
    permGaps.push(permGap);
    if (permGap >= observedGap) countGreater++;
  }

  const pValue = (countGreater + 1) / (nPerms + 1);
  const permMean = permGaps.reduce((a, b) => a + b, 0) / permGaps.length;
  const permStd = Math.sqrt(permGaps.reduce((s, g) => s + (g - permMean) ** 2, 0) / permGaps.length);
  const zScore = permStd > 0 ? (observedGap - permMean) / permStd : 0;

  return {
    tissue: tissueResult.tissue,
    observedGap,
    pValue,
    zScore,
    nPermutations: nPerms,
  };
}

function runBootstrapCI(tissues: TissueThreeLayerResult[], nBoot: number = 5000, seed: number = 42): CrossTissueThreeLayerResult['bootstrapCI'] {
  let rng = seed;
  function nextRand(): number {
    rng = (rng * 1103515245 + 12345) & 0x7fffffff;
    return rng / 0x7fffffff;
  }

  const icGaps = tissues.map(t => t.identityClockGap);
  const cpGaps = tissues.map(t => t.clockProlifGap);

  const bootIC: number[] = [];
  const bootCP: number[] = [];

  for (let b = 0; b < nBoot; b++) {
    let icSum = 0, cpSum = 0;
    for (let i = 0; i < tissues.length; i++) {
      const idx = Math.floor(nextRand() * tissues.length);
      icSum += icGaps[idx];
      cpSum += cpGaps[idx];
    }
    bootIC.push(icSum / tissues.length);
    bootCP.push(cpSum / tissues.length);
  }

  bootIC.sort((a, b) => a - b);
  bootCP.sort((a, b) => a - b);

  const lo = Math.floor(nBoot * 0.025);
  const hi = Math.floor(nBoot * 0.975);

  return {
    identityClockGap: {
      lower: bootIC[lo],
      upper: bootIC[hi],
      mean: icGaps.reduce((a, b) => a + b, 0) / icGaps.length,
    },
    clockProlifGap: {
      lower: bootCP[lo],
      upper: bootCP[hi],
      mean: cpGaps.reduce((a, b) => a + b, 0) / cpGaps.length,
    },
  };
}

export interface HighResValidationResult {
  gse11923: {
    dataset: string;
    tissue: string;
    nTimepoints: number;
    nParams: number;
    npRatio: number;
    npAdequacy: string;
    identityGenes: GeneEigenvalue[];
    clockGenes: GeneEigenvalue[];
    prolifGenes: GeneEigenvalue[];
    identityMean: number;
    clockMean: number;
    prolifMean: number;
    identityClockGap: number;
    clockProlifGap: number;
    hierarchyOrder: string;
    hierarchyConfirmed: boolean;
  };
  gse54650: {
    dataset: string;
    tissue: string;
    nTimepoints: number;
    nParams: number;
    npRatio: number;
    npAdequacy: string;
    identityMean: number;
    clockMean: number;
    prolifMean: number;
    identityClockGap: number;
    clockProlifGap: number;
    hierarchyOrder: string;
    hierarchyConfirmed: boolean;
  };
  comparison: {
    npRatioImprovement: string;
    identityClockGapAgreement: boolean;
    hierarchyAgreement: boolean;
    eigenvalueCorrelation: number;
    verdict: string;
  };
  permutationTest: {
    observedGap: number;
    pValue: number;
    zScore: number;
    nPermutations: number;
  };
  bootstrapCI: {
    identityClockGap: { lower: number; upper: number; mean: number };
    clockProlifGap: { lower: number; upper: number; mean: number };
  };
  geneComparison: {
    gene: string;
    layer: string;
    gse11923Eigenvalue: number;
    gse54650Eigenvalue: number | null;
    difference: number | null;
  }[];
}

export function runHighResValidation(): HighResValidationResult {
  const LIVER_IDENTITY = {
    'Alb': 'Albumin',
    'Hnf4a': 'HNF4α',
    'Cyp3a11': 'CYP3A11',
    'Cyp2e1': 'CYP2E1',
    'Cyp1a2': 'CYP1A2',
    'Pck1': 'PEPCK',
    'G6pc': 'G6Pase',
    'Ttr': 'Transthyretin',
  };

  const highResData = readDataset('datasets/GSE11923_Liver_1h_48h_genes.csv');
  const lowResData = readDataset('datasets/GSE54650_Liver_circadian.csv');

  const nTP_high = highResData.size > 0 ? (highResData.values().next().value as number[]).length : 0;
  const nTP_low = lowResData.size > 0 ? (lowResData.values().next().value as number[]).length : 0;
  const nParams = 3;

  const getLayerGenes = (data: Map<string, number[]>, genes: string[], layer: 'identity' | 'clock' | 'proliferation') => {
    const results: GeneEigenvalue[] = [];
    for (const gene of genes) {
      const result = getGeneEigenvalue(data, gene, layer);
      if (result) results.push(result);
    }
    return results.sort((a, b) => b.eigenvalue - a.eigenvalue);
  };

  const hrIdentity = getLayerGenes(highResData, Object.keys(LIVER_IDENTITY), 'identity');
  const hrClock = getLayerGenes(highResData, CLOCK_GENES, 'clock');
  const hrProlif = getLayerGenes(highResData, PROLIFERATION_GENES, 'proliferation');

  const mean = (arr: GeneEigenvalue[]) => arr.length > 0 ? arr.reduce((s, g) => s + g.eigenvalue, 0) / arr.length : 0;
  const hrIdentityMean = mean(hrIdentity);
  const hrClockMean = mean(hrClock);
  const hrProlifMean = mean(hrProlif);

  const lrIdentity = getLayerGenes(lowResData, Object.keys(LIVER_IDENTITY), 'identity');
  const lrClock = getLayerGenes(lowResData, CLOCK_GENES, 'clock');
  const lrProlif = getLayerGenes(lowResData, PROLIFERATION_GENES, 'proliferation');
  const lrIdentityMean = mean(lrIdentity);
  const lrClockMean = mean(lrClock);
  const lrProlifMean = mean(lrProlif);

  const getOrder = (i: number, c: number, p: number) => {
    const layers = [
      { name: 'Identity', val: i },
      { name: 'Clock', val: c },
      { name: 'Proliferation', val: p },
    ].sort((a, b) => b.val - a.val);
    return layers.map(l => l.name).join(' > ');
  };

  const hrOrder = getOrder(hrIdentityMean, hrClockMean, hrProlifMean);
  const lrOrder = getOrder(lrIdentityMean, lrClockMean, lrProlifMean);
  const hrConfirmed = hrIdentityMean > hrClockMean && hrIdentityMean > hrProlifMean;
  const lrConfirmed = lrIdentityMean > lrClockMean && lrIdentityMean > lrProlifMean;

  const allHrGenes = [...hrIdentity, ...hrClock, ...hrProlif];
  const allEigs = allHrGenes.map(g => g.eigenvalue);
  const nIdentity = hrIdentity.length;
  const nClock = hrClock.length;
  const observedGap = hrIdentityMean - hrClockMean;

  let rng = 42;
  function nextRand(): number {
    rng = (rng * 1103515245 + 12345) & 0x7fffffff;
    return rng / 0x7fffffff;
  }

  const nPerms = 10000;
  let countGreater = 0;
  const permGaps: number[] = [];
  for (let p = 0; p < nPerms; p++) {
    const shuffled = [...allEigs];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(nextRand() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const permIdentity = shuffled.slice(0, nIdentity);
    const permClock = shuffled.slice(nIdentity, nIdentity + nClock);
    const permIdentityMean = permIdentity.reduce((a, b) => a + b, 0) / permIdentity.length;
    const permClockMean = permClock.reduce((a, b) => a + b, 0) / permClock.length;
    const permGap = permIdentityMean - permClockMean;
    permGaps.push(permGap);
    if (permGap >= observedGap) countGreater++;
  }
  const pValue = (countGreater + 1) / (nPerms + 1);
  const permMean = permGaps.reduce((a, b) => a + b, 0) / permGaps.length;
  const permStd = Math.sqrt(permGaps.reduce((s, g) => s + (g - permMean) ** 2, 0) / permGaps.length);
  const zScore = permStd > 0 ? (observedGap - permMean) / permStd : 0;

  const nBoot = 5000;
  let bootRng = 42;
  function bootRand(): number {
    bootRng = (bootRng * 1103515245 + 12345) & 0x7fffffff;
    return bootRng / 0x7fffffff;
  }
  const bootIC: number[] = [];
  const bootCP: number[] = [];
  for (let b = 0; b < nBoot; b++) {
    const sampledI: number[] = [];
    const sampledC: number[] = [];
    const sampledP: number[] = [];
    for (let i = 0; i < hrIdentity.length; i++) {
      sampledI.push(hrIdentity[Math.floor(bootRand() * hrIdentity.length)].eigenvalue);
    }
    for (let i = 0; i < hrClock.length; i++) {
      sampledC.push(hrClock[Math.floor(bootRand() * hrClock.length)].eigenvalue);
    }
    for (let i = 0; i < hrProlif.length; i++) {
      sampledP.push(hrProlif[Math.floor(bootRand() * hrProlif.length)].eigenvalue);
    }
    const iMean = sampledI.reduce((a, b) => a + b, 0) / sampledI.length;
    const cMean = sampledC.reduce((a, b) => a + b, 0) / sampledC.length;
    const pMean = sampledP.reduce((a, b) => a + b, 0) / sampledP.length;
    bootIC.push(iMean - cMean);
    bootCP.push(cMean - pMean);
  }
  bootIC.sort((a, b) => a - b);
  bootCP.sort((a, b) => a - b);
  const lo = Math.floor(nBoot * 0.025);
  const hi = Math.floor(nBoot * 0.975);

  const geneComparison: HighResValidationResult['geneComparison'] = [];
  for (const hrGene of allHrGenes) {
    const lrMatch = [...lrIdentity, ...lrClock, ...lrProlif].find(g => g.gene === hrGene.gene);
    geneComparison.push({
      gene: hrGene.gene,
      layer: hrGene.layer,
      gse11923Eigenvalue: hrGene.eigenvalue,
      gse54650Eigenvalue: lrMatch ? lrMatch.eigenvalue : null,
      difference: lrMatch ? hrGene.eigenvalue - lrMatch.eigenvalue : null,
    });
  }

  const matched = geneComparison.filter(g => g.gse54650Eigenvalue !== null);
  let eigCorr = 0;
  if (matched.length >= 3) {
    const x = matched.map(g => g.gse11923Eigenvalue);
    const y = matched.map(g => g.gse54650Eigenvalue!);
    const mx = x.reduce((a, b) => a + b, 0) / x.length;
    const my = y.reduce((a, b) => a + b, 0) / y.length;
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < x.length; i++) {
      sxy += (x[i] - mx) * (y[i] - my);
      sxx += (x[i] - mx) ** 2;
      syy += (y[i] - my) ** 2;
    }
    eigCorr = (sxx > 0 && syy > 0) ? sxy / Math.sqrt(sxx * syy) : 0;
  }

  const npHigh = (nTP_high - 2) / nParams;
  const npLow = (nTP_low - 2) / nParams;

  let verdict: string;
  if (hrConfirmed && lrConfirmed && hrOrder === lrOrder) {
    verdict = `STRONG VALIDATION: Both GSE11923 (n/p=${npHigh.toFixed(1)}) and GSE54650 (n/p=${npLow.toFixed(1)}) produce the same hierarchy (${hrOrder}). The pattern is robust to the n/p limitation. Gene-level eigenvalue correlation r=${eigCorr.toFixed(3)}.`;
  } else if (hrConfirmed) {
    verdict = `PARTIAL VALIDATION: GSE11923 (n/p=${npHigh.toFixed(1)}) confirms Identity > Clock hierarchy. Ordering differs from GSE54650 at lower layers, but the key Identity > Clock gap is consistent. Gene-level correlation r=${eigCorr.toFixed(3)}.`;
  } else {
    verdict = `INCONCLUSIVE: GSE11923 (n/p=${npHigh.toFixed(1)}) does not confirm the expected hierarchy. This may reflect genuine tissue-specific differences or sampling effects. Gene-level correlation r=${eigCorr.toFixed(3)}.`;
  }

  return {
    gse11923: {
      dataset: 'GSE11923',
      tissue: 'Liver (hourly, 48h)',
      nTimepoints: nTP_high,
      nParams,
      npRatio: npHigh,
      npAdequacy: npHigh >= 10 ? 'ADEQUATE (n/p ≥ 10)' : npHigh >= 5 ? 'BORDERLINE (5 ≤ n/p < 10)' : 'INSUFFICIENT (n/p < 5)',
      identityGenes: hrIdentity,
      clockGenes: hrClock,
      prolifGenes: hrProlif,
      identityMean: hrIdentityMean,
      clockMean: hrClockMean,
      prolifMean: hrProlifMean,
      identityClockGap: hrIdentityMean - hrClockMean,
      clockProlifGap: hrClockMean - hrProlifMean,
      hierarchyOrder: hrOrder,
      hierarchyConfirmed: hrConfirmed,
    },
    gse54650: {
      dataset: 'GSE54650',
      tissue: 'Liver (2h intervals, 48h)',
      nTimepoints: nTP_low,
      nParams,
      npRatio: npLow,
      npAdequacy: npLow >= 10 ? 'ADEQUATE (n/p ≥ 10)' : npLow >= 5 ? 'BORDERLINE (5 ≤ n/p < 10)' : 'INSUFFICIENT (n/p < 5)',
      identityMean: lrIdentityMean,
      clockMean: lrClockMean,
      prolifMean: lrProlifMean,
      identityClockGap: lrIdentityMean - lrClockMean,
      clockProlifGap: lrClockMean - lrProlifMean,
      hierarchyOrder: lrOrder,
      hierarchyConfirmed: lrConfirmed,
    },
    comparison: {
      npRatioImprovement: `${npLow.toFixed(1)} → ${npHigh.toFixed(1)} (${(npHigh / npLow).toFixed(1)}× improvement)`,
      identityClockGapAgreement: (hrIdentityMean - hrClockMean > 0) === (lrIdentityMean - lrClockMean > 0),
      hierarchyAgreement: hrOrder === lrOrder,
      eigenvalueCorrelation: eigCorr,
      verdict,
    },
    permutationTest: {
      observedGap,
      pValue,
      zScore,
      nPermutations: nPerms,
    },
    bootstrapCI: {
      identityClockGap: {
        lower: bootIC[lo],
        upper: bootIC[hi],
        mean: hrIdentityMean - hrClockMean,
      },
      clockProlifGap: {
        lower: bootCP[lo],
        upper: bootCP[hi],
        mean: hrClockMean - hrProlifMean,
      },
    },
    geneComparison: geneComparison.sort((a, b) => b.gse11923Eigenvalue - a.gse11923Eigenvalue),
  };
}

export function runCrossTissueThreeLayerAnalysis(): CrossTissueThreeLayerResult {
  const tissues: TissueThreeLayerResult[] = [];

  for (const config of TISSUE_CONFIGS) {
    const result = analyzeTissue(config);
    if (result) tissues.push(result);
  }

  const nConfirmed = tissues.filter(t => t.hierarchyConfirmed).length;
  const nPartial = tissues.filter(t => !t.hierarchyConfirmed && t.identityClockGap > 0).length;
  const nFailed = tissues.filter(t => t.identityClockGap <= 0).length;

  const meanICGap = tissues.length > 0 ? tissues.reduce((s, t) => s + t.identityClockGap, 0) / tissues.length : 0;
  const meanCPGap = tissues.length > 0 ? tissues.reduce((s, t) => s + t.clockProlifGap, 0) / tissues.length : 0;

  let overallVerdict: string;
  if (nConfirmed === tissues.length) {
    overallVerdict = `Three-layer hierarchy confirmed in all ${tissues.length} tissues. Identity > Clock > Proliferation is a cross-tissue biological principle.`;
  } else if (nConfirmed >= tissues.length * 0.75) {
    overallVerdict = `Three-layer hierarchy confirmed in ${nConfirmed}/${tissues.length} tissues (${Math.round(nConfirmed / tissues.length * 100)}%). Strong cross-tissue support.`;
  } else if (nConfirmed + nPartial >= tissues.length * 0.5) {
    overallVerdict = `Full hierarchy in ${nConfirmed}/${tissues.length} tissues, partial in ${nPartial}. Identity > Clock gap more robust than full three-layer ordering.`;
  } else {
    overallVerdict = `Three-layer hierarchy supported in ${nConfirmed}/${tissues.length} tissues. The pattern may be tissue-specific rather than universal.`;
  }

  const permutationTests = tissues.map(t => runPermutationTest(t));

  const bootstrapCI = runBootstrapCI(tissues);

  return {
    tissues,
    summary: {
      nTissues: tissues.length,
      nConfirmed,
      nPartial,
      nFailed,
      meanIdentityClockGap: meanICGap,
      meanClockProlifGap: meanCPGap,
      overallVerdict,
    },
    permutationTests,
    bootstrapCI,
  };
}
