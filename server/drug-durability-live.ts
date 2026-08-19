import * as fs from 'fs';
import * as path from 'path';
import { ENSEMBL_TO_SYMBOL } from './gene-categories';

interface GeneAR2Result {
  gene: string;
  eigenvalue: number;
  phi1: number;
  phi2: number;
  rootType: 'complex' | 'real';
}

interface CategorySpec {
  name: string;
  genes: string[];
}

interface CategoryResult {
  name: string;
  genesFound: number;
  genesTotal: number;
  meanLambda: number;
  vsGlobal: number;
  permP: number;
  zScore: number;
  significant: boolean;
}

interface LiveAnalysisResult {
  dataset: string;
  totalGenes: number;
  totalProbes: number;
  globalMeanLambda: number;
  globalMedianLambda: number;
  categories: CategoryResult[];
  topGenes: Array<{
    gene: string;
    category: string;
    lambda: number;
    rootType: string;
  }>;
  computedAt: string;
  computationTimeMs: number;
}

function fitAR2(series: number[]): { eigenvalue: number; phi1: number; phi2: number; rootType: 'complex' | 'real' } {
  const n = series.length;
  if (n < 5) return { eigenvalue: 0, phi1: 0, phi2: 0, rootType: 'real' };
  const m = series.reduce((a, b) => a + b, 0) / n;
  const y = series.map(x => x - m);
  const Y = y.slice(2), Y1 = y.slice(1, n - 1), Y2 = y.slice(0, n - 2);
  let s11 = 0, s22 = 0, s12 = 0, sy1 = 0, sy2 = 0;
  for (let i = 0; i < Y.length; i++) {
    s11 += Y1[i] * Y1[i]; s22 += Y2[i] * Y2[i]; s12 += Y1[i] * Y2[i];
    sy1 += Y[i] * Y1[i]; sy2 += Y[i] * Y2[i];
  }
  const det = s11 * s22 - s12 * s12;
  if (Math.abs(det) < 1e-15) return { eigenvalue: 0, phi1: 0, phi2: 0, rootType: 'real' };
  const phi1 = (sy1 * s22 - sy2 * s12) / det;
  const phi2 = (sy2 * s11 - sy1 * s12) / det;
  const disc = phi1 * phi1 + 4 * phi2;
  let eigenvalue: number;
  let rootType: 'complex' | 'real';
  if (disc >= 0) {
    eigenvalue = Math.max(Math.abs((phi1 + Math.sqrt(disc)) / 2), Math.abs((phi1 - Math.sqrt(disc)) / 2));
    rootType = 'real';
  } else {
    eigenvalue = Math.sqrt(-phi2);
    rootType = 'complex';
  }
  if (eigenvalue > 2 || isNaN(eigenvalue)) return { eigenvalue: 0, phi1: 0, phi2: 0, rootType: 'real' };
  return { eigenvalue, phi1, phi2, rootType };
}

function parseCSV(filePath: string): { genes: Map<string, number[]>; probeCount: number } {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  if (lines.length < 2) return { genes: new Map(), probeCount: 0 };
  const header = lines[0].replace(/"/g, '').split(',');
  const numCols = header.length - 1;
  const geneMap = new Map<string, number[][]>();
  let probeCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].replace(/"/g, '').split(',');
    let geneName = parts[0].trim().toUpperCase();
    if (geneName.startsWith('ENSMUSG')) continue;
    const values = parts.slice(1).map(Number).filter(v => !isNaN(v));
    if (values.length < 4) continue;
    const allZero = values.every(v => v === 0);
    if (allZero) continue;
    probeCount++;
    if (!geneMap.has(geneName)) geneMap.set(geneName, []);
    geneMap.get(geneName)!.push(values);
  }

  const genes = new Map<string, number[]>();
  for (const [gene, probeArrays] of geneMap) {
    if (probeArrays.length === 1) {
      genes.set(gene, probeArrays[0]);
    } else {
      const len = Math.min(...probeArrays.map(p => p.length));
      const avg = Array.from({ length: len }, (_, i) =>
        probeArrays.reduce((s, p) => s + (p[i] || 0), 0) / probeArrays.length
      );
      genes.set(gene, avg);
    }
  }

  return { genes, probeCount };
}

function parseOrganoidCSV(filePath: string): { genes: Map<string, number[]>; probeCount: number } {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  if (lines.length < 2) return { genes: new Map(), probeCount: 0 };
  
  const headerParts = lines[0].replace(/"/g, '').split(',');
  const timeLabels = headerParts.slice(1).map(Number);
  
  const uniqueTimes = [...new Set(timeLabels)].sort((a, b) => a - b);
  const timeToIndices = new Map<number, number[]>();
  timeLabels.forEach((t, i) => {
    if (!timeToIndices.has(t)) timeToIndices.set(t, []);
    timeToIndices.get(t)!.push(i);
  });
  
  const geneMap = new Map<string, number[]>();
  let probeCount = 0;
  
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].replace(/"/g, '').split(',');
    const geneId = parts[0].trim();
    const rawValues = parts.slice(1).map(Number);
    if (rawValues.length !== timeLabels.length) continue;
    
    const averaged: number[] = [];
    for (const t of uniqueTimes) {
      const indices = timeToIndices.get(t)!;
      const vals = indices.map(idx => rawValues[idx]).filter(v => !isNaN(v));
      if (vals.length === 0) continue;
      averaged.push(vals.reduce((a, b) => a + b, 0) / vals.length);
    }
    
    if (averaged.length < 4) continue;
    if (averaged.every(v => v === 0)) continue;
    probeCount++;
    
    let displayName = geneId;
    if (geneId.startsWith('ENSMUSG')) {
      const symbol = ENSEMBL_TO_SYMBOL[geneId];
      if (symbol) {
        geneMap.set(symbol.toUpperCase(), averaged);
      }
    }
    geneMap.set(geneId.startsWith('ENSMUSG') ? geneId : geneId.toUpperCase(), averaged);
  }
  
  return { genes: geneMap, probeCount };
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function permutationTest(categoryValues: number[], allValues: number[], nPerms: number = 5000): { p: number; z: number } {
  const observedMean = categoryValues.reduce((a, b) => a + b, 0) / categoryValues.length;
  const globalMean = allValues.reduce((a, b) => a + b, 0) / allValues.length;
  const observedDiff = observedMean - globalMean;
  const k = categoryValues.length;
  let count = 0;
  for (let p = 0; p < nPerms; p++) {
    let sum = 0;
    for (let j = 0; j < k; j++) {
      sum += allValues[Math.floor(Math.random() * allValues.length)];
    }
    const permMean = sum / k;
    if (Math.abs(permMean - globalMean) >= Math.abs(observedDiff)) count++;
  }
  const pValue = (count + 1) / (nPerms + 1);
  const stdev = Math.sqrt(allValues.reduce((s, v) => s + (v - globalMean) ** 2, 0) / allValues.length);
  const z = stdev > 0 ? observedDiff / (stdev / Math.sqrt(k)) : 0;
  return { p: pValue, z };
}

const BLOOD_CATEGORIES: CategorySpec[] = [
  { name: "Immune Response", genes: ["TNF","IFNG","IL2","IL12A","IL12B","STAT1","STAT4","IRF1","IRF7","IRF8","TLR2","TLR4","CD14","CD80","CD86","HLA-DRA","HLA-DRB1","ICAM1","VCAM1","CCL2","CCL3","CCL4","CCL5","CXCL8","CXCL10","CXCL11","CCR5","CCR7","NFKBIA","NFKB1","NFKB2","RELA","RELB","MYD88","IRAK4","TRAF6","JAK1","JAK2","TYK2","SOCS1","SOCS3","FOS","JUN","EGR1","DUSP1"] },
  { name: "Cytokine Signaling", genes: ["IL1B","IL1A","IL6","IL10","IL4","IL13","IL17A","IL18","IL23A","IL33","TGFB1","CSF1","CSF2","CSF3","LIF","OSM","CNTF","IL6ST","IL1R1","IL6R","IL10RA","IL10RB","IL4R","IL13RA1","IFNAR1","IFNAR2"] },
  { name: "Inflammatory", genes: ["PTGS2","ALOX5","LTA4H","PLA2G4A","NLRP3","CASP1","IL1B","HMGB1","S100A8","S100A9","S100A12","MMP9","MMP2","ADAM17","TNFAIP3","TNFAIP6","RIPK1","RIPK3","MLKL","PYCARD","GSDMD"] },
  { name: "Circadian Core", genes: ["ARNTL","CLOCK","PER1","PER2","PER3","CRY1","CRY2","NR1D1","NR1D2","DBP","TEF","HLF","BHLHE40","BHLHE41","RORA","RORC","CSNK1D","CSNK1E","FBXL3","FBXW11","SIRT1","NAMPT","CIART","NFIL3"] },
  { name: "Metabolism", genes: ["HK1","HK2","PFKFB3","PKM","LDHA","PDK1","IDH2","SDHA","SDHB","CS","ACO2","FH","MDH2","OGDH","DLST","ATP5F1A","UQCRC1","NDUFS1","COX5A","SLC2A1"] },
];

const ORGANOID_CATEGORIES: CategorySpec[] = [
  { name: "Wnt Pathway", genes: ["WNT3","WNT3A","WNT5A","WNT7B","CTNNB1","APC","AXIN1","AXIN2","GSK3B","LRP5","LRP6","FZD1","FZD2","FZD5","FZD7","TCF7","TCF7L2","LEF1","DKK1","DKK3","SFRP1","SFRP5"] },
  { name: "Stem Cell Markers", genes: ["LGR5","OLFM4","ASCL2","SOX9","BMI1","LRIG1","SMOC2","CD44","CDH1","EPHB2","EPHB3","MYC","KRT19","PROM1","ALDH1A1","HOPX"] },
  { name: "Circadian Core", genes: ["ARNTL","CLOCK","PER1","PER2","PER3","CRY1","CRY2","NR1D1","NR1D2","DBP","TEF","HLF","BHLHE40","BHLHE41","RORA","RORC","CSNK1D","CSNK1E","FBXL3","FBXW11","SIRT1"] },
  { name: "Proliferation", genes: ["MKI67","PCNA","TOP2A","MCM2","MCM4","MCM6","CDK1","CDK2","CDK4","CCNA2","CCNB1","CCND1","CCNE1","E2F1","RB1","CDKN1A","CDKN2A","AURKA"] },
  { name: "Apoptosis", genes: ["BAX","BAK1","BCL2","BCL2L1","MCL1","BID","BIM","CASP3","CASP7","CASP8","CASP9","APAF1","CYCS","XIAP"] },
];

const MOUSE_SYMBOL_MAP: Record<string, string> = {
  'ARNTL': 'Arntl', 'CLOCK': 'Clock', 'PER1': 'Per1', 'PER2': 'Per2', 'PER3': 'Per3',
  'CRY1': 'Cry1', 'CRY2': 'Cry2', 'NR1D1': 'Nr1d1', 'NR1D2': 'Nr1d2', 'DBP': 'Dbp',
  'LGR5': 'Lgr5', 'AXIN2': 'Axin2', 'WNT3': 'Wnt3', 'MKI67': 'Mki67', 'MYC': 'Myc',
  'CCND1': 'Ccnd1', 'CDK1': 'Cdk1', 'CDK2': 'Cdk2', 'CDK4': 'Cdk4', 'TP53': 'Trp53',
  'CTNNB1': 'Ctnnb1', 'APC': 'Apc', 'GSK3B': 'Gsk3b', 'SIRT1': 'Sirt1',
  'BAX': 'Bax', 'BCL2': 'Bcl2', 'CASP3': 'Casp3', 'TNF': 'Tnf', 'CDH1': 'Cdh1',
};

function lookupGene(geneMap: Map<string, number[]>, symbol: string): number[] | null {
  const upper = symbol.toUpperCase();
  if (geneMap.has(upper)) return geneMap.get(upper)!;
  if (geneMap.has(symbol)) return geneMap.get(symbol)!;
  const mouseForm = MOUSE_SYMBOL_MAP[upper];
  if (mouseForm && geneMap.has(mouseForm)) return geneMap.get(mouseForm)!;
  const titleCase = symbol.charAt(0).toUpperCase() + symbol.slice(1).toLowerCase();
  if (geneMap.has(titleCase)) return geneMap.get(titleCase)!;
  for (const [key, val] of geneMap) {
    if (key.toUpperCase() === upper) return val;
  }
  return null;
}

function runLiveAnalysis(
  datasetLabel: string,
  genes: Map<string, number[]>,
  probeCount: number,
  categories: CategorySpec[]
): LiveAnalysisResult {
  const startTime = Date.now();

  const allResults: GeneAR2Result[] = [];
  for (const [gene, values] of genes) {
    if (gene.startsWith('ENSMUSG')) continue;
    const result = fitAR2(values);
    if (result.eigenvalue > 0 && result.eigenvalue <= 1.0) {
      allResults.push({ gene, eigenvalue: result.eigenvalue, phi1: result.phi1, phi2: result.phi2, rootType: result.rootType });
    }
  }

  const allEigenvalues = allResults.map(r => r.eigenvalue);
  const globalMean = allEigenvalues.reduce((a, b) => a + b, 0) / allEigenvalues.length;
  const globalMedian = median(allEigenvalues);

  const eigenMap = new Map<string, GeneAR2Result>();
  for (const r of allResults) eigenMap.set(r.gene.toUpperCase(), r);

  const categoryResults: CategoryResult[] = [];
  for (const cat of categories) {
    const matched: number[] = [];
    for (const g of cat.genes) {
      const series = lookupGene(genes, g);
      if (!series) continue;
      const result = fitAR2(series);
      if (result.eigenvalue > 0 && result.eigenvalue <= 1.0) {
        matched.push(result.eigenvalue);
      }
    }
    if (matched.length === 0) continue;
    const catMean = matched.reduce((a, b) => a + b, 0) / matched.length;
    const { p, z } = permutationTest(matched, allEigenvalues, 5000);
    categoryResults.push({
      name: cat.name,
      genesFound: matched.length,
      genesTotal: cat.genes.length,
      meanLambda: catMean,
      vsGlobal: catMean - globalMean,
      permP: p,
      zScore: z,
      significant: p < 0.05,
    });
  }

  categoryResults.sort((a, b) => b.meanLambda - a.meanLambda);

  const topGenes: LiveAnalysisResult['topGenes'] = [];
  for (const cat of categories) {
    for (const g of cat.genes) {
      const upper = g.toUpperCase();
      const r = eigenMap.get(upper);
      if (r) {
        topGenes.push({ gene: r.gene, category: cat.name, lambda: r.eigenvalue, rootType: r.rootType });
      }
    }
  }
  topGenes.sort((a, b) => b.lambda - a.lambda);

  return {
    dataset: datasetLabel,
    totalGenes: genes.size,
    totalProbes: probeCount,
    globalMeanLambda: globalMean,
    globalMedianLambda: globalMedian,
    categories: categoryResults,
    topGenes: topGenes.slice(0, 25),
    computedAt: new Date().toISOString(),
    computationTimeMs: Date.now() - startTime,
  };
}

export function runBloodAnalysis(): LiveAnalysisResult {
  const filePath = path.join(process.cwd(), 'datasets', 'GSE113883_Human_WholeBlood.csv');
  if (!fs.existsSync(filePath)) throw new Error('GSE113883 dataset not found');
  const { genes, probeCount } = parseCSV(filePath);
  return runLiveAnalysis('GSE113883 (Human Whole Blood — LPS Response)', genes, probeCount, BLOOD_CATEGORIES);
}

export function runOrganoidAnalysis(): LiveAnalysisResult {
  const filePath = path.join(process.cwd(), 'datasets', 'GSE157357_Organoid_WT-WT_circadian.csv');
  if (!fs.existsSync(filePath)) throw new Error('GSE157357 dataset not found');
  const { genes, probeCount } = parseOrganoidCSV(filePath);
  return runLiveAnalysis('GSE157357 (Intestinal Organoids — WT)', genes, probeCount, ORGANOID_CATEGORIES);
}

export type { LiveAnalysisResult };
