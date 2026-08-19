import * as fs from 'fs';
import * as path from 'path';
import { classifyGene, ENSEMBL_TO_SYMBOL, resolveGeneAliases, ALL_CATEGORIES, CATEGORY_META, type GeneCategory } from './gene-categories';
import { fitAR2WithDiagnostics, type DiagnosticsResult } from './edge-case-diagnostics';

const DISEASE_PAIRS = [
  { healthyId: 'GSE157357_Organoid_WT-WT', diseaseId: 'GSE157357_Organoid_ApcKO-WT', label: 'WT vs APC-Mutant Organoids', category: 'Cancer' },
  { healthyId: 'GSE157357_Organoid_WT-WT', diseaseId: 'GSE157357_Organoid_WT-BmalKO', label: 'WT vs BMAL-KO Organoids', category: 'Clock Disruption' },
  { healthyId: 'GSE157357_Organoid_WT-WT', diseaseId: 'GSE157357_Organoid_ApcKO-BmalKO', label: 'WT vs Double-Mutant Organoids', category: 'Cancer' },
  { healthyId: 'GSE221103_Neuroblastoma_MYC_OFF', diseaseId: 'GSE221103_Neuroblastoma_MYC_ON', label: 'MYC-OFF vs MYC-ON Neuroblastoma', category: 'Cancer' },
  { healthyId: 'GSE93903_Liver_Young', diseaseId: 'GSE93903_Liver_Old', label: 'Young vs Old Liver', category: 'Aging' },
  { healthyId: 'GSE93903_Liver_YoungCR', diseaseId: 'GSE93903_Liver_OldCR', label: 'Young+CR vs Old+CR Liver', category: 'Aging' },
  { healthyId: 'GSE70499_Liver_Bmal1WT', diseaseId: 'GSE70499_Liver_Bmal1KO', label: 'Bmal1-WT vs Bmal1-KO Liver', category: 'Clock Disruption' },
  { healthyId: 'GSE48113_ForcedDesync_Aligned', diseaseId: 'GSE48113_ForcedDesync_Misaligned', label: 'Aligned vs Misaligned (Forced Desync)', category: 'Circadian Disruption' },
  { healthyId: 'GSE39445_Blood_SufficientSleep', diseaseId: 'GSE39445_Blood_SleepRestriction', label: 'Sufficient vs Restricted Sleep', category: 'Circadian Disruption' },
  { healthyId: 'GSE122541_Nurses_DayShift', diseaseId: 'GSE122541_Nurses_NightShift', label: 'Day vs Night Shift Nurses', category: 'Circadian Disruption' },
];

const DATASET_ID_TO_FILE: Record<string, string> = {
  'GSE157357_Organoid_WT-WT': 'GSE157357_Organoid_WT-WT_circadian.csv',
  'GSE157357_Organoid_ApcKO-WT': 'GSE157357_Organoid_ApcKO-WT_circadian.csv',
  'GSE157357_Organoid_WT-BmalKO': 'GSE157357_Organoid_WT-BmalKO_circadian.csv',
  'GSE157357_Organoid_ApcKO-BmalKO': 'GSE157357_Organoid_ApcKO-BmalKO_circadian.csv',
  'GSE221103_Neuroblastoma_MYC_OFF': 'GSE221103_Neuroblastoma_MYC_OFF.csv',
  'GSE221103_Neuroblastoma_MYC_ON': 'GSE221103_Neuroblastoma_MYC_ON.csv',
  'GSE93903_Liver_Young': 'GSE93903_Liver_Young_circadian.csv',
  'GSE93903_Liver_Old': 'GSE93903_Liver_Old_circadian.csv',
  'GSE93903_Liver_YoungCR': 'GSE93903_Liver_YoungCR_circadian.csv',
  'GSE93903_Liver_OldCR': 'GSE93903_Liver_OldCR_circadian.csv',
  'GSE70499_Liver_Bmal1WT': 'GSE70499_Liver_Bmal1WT_circadian.csv',
  'GSE70499_Liver_Bmal1KO': 'GSE70499_Liver_Bmal1KO_circadian.csv',
  'GSE48113_ForcedDesync_Aligned': 'GSE48113_ForcedDesync_Aligned_circadian.csv',
  'GSE48113_ForcedDesync_Misaligned': 'GSE48113_ForcedDesync_Misaligned_circadian.csv',
  'GSE39445_Blood_SufficientSleep': 'GSE39445_Blood_SufficientSleep_circadian.csv',
  'GSE39445_Blood_SleepRestriction': 'GSE39445_Blood_SleepRestriction_circadian.csv',
  'GSE122541_Nurses_DayShift': 'GSE122541_Nurses_DayShift_circadian.csv',
  'GSE122541_Nurses_NightShift': 'GSE122541_Nurses_NightShift_circadian.csv',
};

const HIGHLIGHTS = [
  'Per1', 'Per2', 'Cry1', 'Cry2', 'Clock', 'Arntl', 'Nr1d1', 'Nr1d2',
  'Wee1', 'Lgr5', 'Myc', 'Apc', 'Cdkn1a', 'Ccnd1', 'Trp53', 'Brca1',
];

const CATEGORIES_FOR_PERMUTATION: GeneCategory[] = [
  'clock', 'target', 'housekeeping', 'immune', 'metabolic',
  'chromatin', 'signaling', 'dna_repair', 'stem',
];

function mulberry32(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fitAR2(series: number[]): { phi1: number; phi2: number; eigenvalue: number; r2: number; residuals: number[] } {
  const n = series.length;
  if (n < 5) return { phi1: 0, phi2: 0, eigenvalue: 0, r2: 0, residuals: [] };

  const mean = series.reduce((a, b) => a + b, 0) / n;
  const y = series.map(x => x - mean);

  const Y = y.slice(2);
  const Y1 = y.slice(1, n - 1);
  const Y2 = y.slice(0, n - 2);

  let sumY1Y1 = 0, sumY2Y2 = 0, sumY1Y2 = 0, sumYY1 = 0, sumYY2 = 0;
  for (let i = 0; i < Y.length; i++) {
    sumY1Y1 += Y1[i] * Y1[i];
    sumY2Y2 += Y2[i] * Y2[i];
    sumY1Y2 += Y1[i] * Y2[i];
    sumYY1 += Y[i] * Y1[i];
    sumYY2 += Y[i] * Y2[i];
  }

  const denom = sumY1Y1 * sumY2Y2 - sumY1Y2 * sumY1Y2;
  if (Math.abs(denom) < 1e-10) return { phi1: 0, phi2: 0, eigenvalue: 0, r2: 0, residuals: [] };

  const phi1 = (sumYY1 * sumY2Y2 - sumYY2 * sumY1Y2) / denom;
  const phi2 = (sumYY2 * sumY1Y1 - sumYY1 * sumY1Y2) / denom;

  const discriminant = phi1 * phi1 + 4 * phi2;
  let eigenvalue: number;
  if (discriminant < 0) {
    eigenvalue = Math.sqrt(-phi2);
  } else {
    const r1 = (phi1 + Math.sqrt(discriminant)) / 2;
    const r2val = (phi1 - Math.sqrt(discriminant)) / 2;
    eigenvalue = Math.max(Math.abs(r1), Math.abs(r2val));
  }

  const residuals: number[] = [];
  let ssTot = 0, ssRes = 0;
  const yMean = Y.reduce((a, b) => a + b, 0) / Y.length;
  for (let i = 0; i < Y.length; i++) {
    const pred = phi1 * Y1[i] + phi2 * Y2[i];
    const res = Y[i] - pred;
    residuals.push(res);
    ssRes += res * res;
    ssTot += (Y[i] - yMean) ** 2;
  }
  const r2 = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;

  return { phi1, phi2, eigenvalue, r2, residuals };
}

interface GeneTimeSeries {
  gene: string;
  values: number[];
  category: GeneCategory;
}

function parseDatasetFile(filePath: string): Map<string, GeneTimeSeries> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  const genes = new Map<string, GeneTimeSeries>();

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const rawGene = cols[0].trim().replace(/"/g, '');
    if (!rawGene) continue;
    const gene = ENSEMBL_TO_SYMBOL[rawGene] || rawGene;
    const values = cols.slice(1).map(v => parseFloat(v)).filter(v => !isNaN(v));
    if (values.length < 5) continue;
    const category = classifyGene(gene);
    genes.set(gene.toUpperCase(), { gene, values, category });
  }
  return genes;
}

function getDatasetPath(datasetId: string): string {
  const file = DATASET_ID_TO_FILE[datasetId];
  if (!file) throw new Error(`Unknown dataset ID: ${datasetId}`);
  const filePath = path.join(process.cwd(), 'datasets', file);
  if (!fs.existsSync(filePath)) throw new Error(`Dataset file not found: ${file}`);
  return filePath;
}

function getSharedGenes(
  healthyGenes: Map<string, GeneTimeSeries>,
  diseaseGenes: Map<string, GeneTimeSeries>,
  minR2: number,
  onlyStable: boolean
): { gene: string; healthySeries: number[]; diseaseSeries: number[]; healthyEV: number; diseaseEV: number; shift: number; category: GeneCategory; healthyR2: number; diseaseR2: number }[] {
  const shared: ReturnType<typeof getSharedGenes> = [];
  for (const [key, hGene] of Array.from(healthyGenes.entries())) {
    const dGene = diseaseGenes.get(key);
    if (!dGene) continue;
    const hFit = fitAR2(hGene.values);
    const dFit = fitAR2(dGene.values);
    if (hFit.r2 < minR2 && dFit.r2 < minR2) continue;
    if (onlyStable && (hFit.eigenvalue >= 1.0 || dFit.eigenvalue >= 1.0)) continue;
    shared.push({
      gene: hGene.gene,
      healthySeries: hGene.values,
      diseaseSeries: dGene.values,
      healthyEV: hFit.eigenvalue,
      diseaseEV: dFit.eigenvalue,
      shift: dFit.eigenvalue - hFit.eigenvalue,
      category: hGene.category,
      healthyR2: hFit.r2,
      diseaseR2: dFit.r2,
    });
  }
  return shared;
}

interface CategoryPermutationResult {
  category: GeneCategory;
  nGenes: number;
  observedMeanShift: number;
  pValue: number;
  zScore: number;
  nullHistogram: { binMin: number; binMax: number; count: number }[];
}

interface GlobalKruskalWallisResult {
  testStatistic: number;
  pValue: number;
  significant: boolean;
}

interface BootstrapGeneShiftResult {
  gene: string;
  category: GeneCategory;
  pointEstimate: number;
  ci95Lower: number;
  ci95Upper: number;
  ciWidth: number;
  excludesZero: boolean;
}

interface FDRResult {
  totalGenesTested: number;
  significantAt005: number;
  significantAt010: number;
  significantAt020: number;
  highlightQValues: { gene: string; pValue: number; qValue: number; significant005: boolean }[];
}

interface DiagnosticsSummary {
  healthyCounts: Record<string, number>;
  diseaseCounts: Record<string, number>;
  confidenceDropped: { gene: string; healthyConfidence: string; diseaseConfidence: string }[];
  highlightDiagnostics: { gene: string; healthyConfidence: string; diseaseConfidence: string; healthyScore: number; diseaseScore: number }[];
}

export interface DiseaseScreenRobustnessResult {
  pairIndex: number;
  pairLabel: string;
  pairCategory: string;
  healthyId: string;
  diseaseId: string;
  sharedGeneCount: number;
  categoryPermutations: CategoryPermutationResult[];
  globalTest: GlobalKruskalWallisResult;
  bootstrapShifts: BootstrapGeneShiftResult[];
  fdr: FDRResult;
  diagnosticsSummary: DiagnosticsSummary;
  conclusion: string;
}

function runCategoryPermutations(
  sharedGenes: ReturnType<typeof getSharedGenes>,
  nPermutations: number,
  rng: () => number
): { categoryResults: CategoryPermutationResult[]; globalTest: GlobalKruskalWallisResult } {
  const categoryGenes = new Map<GeneCategory, number[]>();
  for (const cat of CATEGORIES_FOR_PERMUTATION) {
    categoryGenes.set(cat, []);
  }
  for (const g of sharedGenes) {
    if (g.category !== 'other') {
      const arr = categoryGenes.get(g.category);
      if (arr) arr.push(g.shift);
    }
  }

  const allShifts = sharedGenes.map(g => g.shift);
  const allCategories = sharedGenes.map(g => g.category);

  const observedMeans = new Map<GeneCategory, number>();
  for (const [cat, shifts] of Array.from(categoryGenes.entries())) {
    if (shifts.length > 0) {
      observedMeans.set(cat, shifts.reduce((a: number, b: number) => a + b, 0) / shifts.length);
    }
  }

  const nullDistributions = new Map<GeneCategory, number[]>();
  for (const cat of CATEGORIES_FOR_PERMUTATION) {
    nullDistributions.set(cat, []);
  }

  for (let p = 0; p < nPermutations; p++) {
    const shuffledCategories = [...allCategories];
    for (let i = shuffledCategories.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffledCategories[i], shuffledCategories[j]] = [shuffledCategories[j], shuffledCategories[i]];
    }

    const permCatShifts = new Map<GeneCategory, number[]>();
    for (const cat of CATEGORIES_FOR_PERMUTATION) {
      permCatShifts.set(cat, []);
    }
    for (let i = 0; i < allShifts.length; i++) {
      const cat = shuffledCategories[i];
      if (cat !== 'other') {
        const arr = permCatShifts.get(cat);
        if (arr) arr.push(allShifts[i]);
      }
    }
    for (const [cat, shifts] of Array.from(permCatShifts.entries())) {
      const nd = nullDistributions.get(cat)!;
      if (shifts.length > 0) {
        nd.push(shifts.reduce((a: number, b: number) => a + b, 0) / shifts.length);
      } else {
        nd.push(0);
      }
    }
  }

  const categoryResults: CategoryPermutationResult[] = [];
  for (const cat of CATEGORIES_FOR_PERMUTATION) {
    const shifts = categoryGenes.get(cat)!;
    if (shifts.length === 0) continue;
    const observed = observedMeans.get(cat)!;
    const nullDist = nullDistributions.get(cat)!;
    const pValue = (nullDist.filter(n => Math.abs(n) >= Math.abs(observed)).length + 1) / (nullDist.length + 1);
    const nullMean = nullDist.reduce((a, b) => a + b, 0) / nullDist.length;
    const nullStd = Math.sqrt(nullDist.reduce((a, b) => a + (b - nullMean) ** 2, 0) / nullDist.length) || 1e-10;
    const zScore = (observed - nullMean) / nullStd;

    const minVal = Math.min(...nullDist);
    const maxVal = Math.max(...nullDist);
    const nBins = 30;
    const binWidth = (maxVal - minVal) / nBins || 1;
    const histogram: { binMin: number; binMax: number; count: number }[] = [];
    for (let b = 0; b < nBins; b++) {
      const binMin = minVal + b * binWidth;
      const binMax = minVal + (b + 1) * binWidth;
      const count = nullDist.filter(v => v >= binMin && (b === nBins - 1 ? v <= binMax : v < binMax)).length;
      histogram.push({ binMin: +binMin.toFixed(6), binMax: +binMax.toFixed(6), count });
    }

    categoryResults.push({
      category: cat,
      nGenes: shifts.length,
      observedMeanShift: +observed.toFixed(6),
      pValue: +pValue.toFixed(6),
      zScore: +zScore.toFixed(4),
      nullHistogram: histogram,
    });
  }

  const categoriesWithData = categoryResults.filter(c => c.nGenes > 0);
  let kwStat = 0;
  let kwPValue = 1;
  if (categoriesWithData.length >= 2) {
    const N = sharedGenes.filter(g => g.category !== 'other').length;
    const allCatShifts = sharedGenes.filter(g => g.category !== 'other').map(g => g.shift);
    const ranked = allCatShifts
      .map((v, i) => ({ v, i }))
      .sort((a, b) => a.v - b.v)
      .map((item, rank) => ({ ...item, rank: rank + 1 }));
    const rankMap = new Map<number, number>();
    for (const r of ranked) rankMap.set(r.i, r.rank);

    let idx = 0;
    const catRanks = new Map<GeneCategory, number[]>();
    for (const g of sharedGenes) {
      if (g.category === 'other') continue;
      if (!catRanks.has(g.category)) catRanks.set(g.category, []);
      catRanks.get(g.category)!.push(rankMap.get(idx)!);
      idx++;
    }

    const meanRank = (N + 1) / 2;
    let H = 0;
    for (const [, ranks] of Array.from(catRanks.entries())) {
      if (ranks.length === 0) continue;
      const catMeanRank = ranks.reduce((a: number, b: number) => a + b, 0) / ranks.length;
      H += ranks.length * (catMeanRank - meanRank) ** 2;
    }
    H = (12 / (N * (N + 1))) * H;
    kwStat = H;

    const df = categoriesWithData.length - 1;
    kwPValue = 1 - chiSquaredCDF(H, df);
    if (kwPValue < 0) kwPValue = 0;
  }

  return {
    categoryResults,
    globalTest: {
      testStatistic: +kwStat.toFixed(4),
      pValue: +kwPValue.toFixed(6),
      significant: kwPValue < 0.05,
    },
  };
}

function chiSquaredCDF(x: number, k: number): number {
  if (x <= 0) return 0;
  return regularizedGammaP(k / 2, x / 2);
}

function regularizedGammaP(a: number, x: number): number {
  if (x < 0) return 0;
  if (x === 0) return 0;
  if (x < a + 1) {
    let sum = 1 / a;
    let term = 1 / a;
    for (let n = 1; n < 200; n++) {
      term *= x / (a + n);
      sum += term;
      if (Math.abs(term) < 1e-12 * Math.abs(sum)) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - lnGamma(a));
  } else {
    let f = 1;
    let c = 1;
    let d = 1 / (x + 1 - a);
    let h = d;
    for (let n = 1; n < 200; n++) {
      const an = -n * (n - a);
      const bn = x + 2 * n + 1 - a;
      d = bn + an * d;
      if (Math.abs(d) < 1e-30) d = 1e-30;
      c = bn + an / c;
      if (Math.abs(c) < 1e-30) c = 1e-30;
      d = 1 / d;
      const delta = c * d;
      h *= delta;
      if (Math.abs(delta - 1) < 1e-12) break;
    }
    return 1 - h * Math.exp(-x + a * Math.log(x) - lnGamma(a));
  }
}

function lnGamma(z: number): number {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.001208650973866179, -0.000005395239384953];
  let x = z;
  let y = z;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) {
    y += 1;
    ser += c[j] / y;
  }
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}

function runBootstrapCIShifts(
  sharedGenes: ReturnType<typeof getSharedGenes>,
  nBootstrap: number,
  rng: () => number
): BootstrapGeneShiftResult[] {
  const highlightUpper = new Set(HIGHLIGHTS.map(h => h.toUpperCase()));
  const highlightGenes = sharedGenes.filter(g => highlightUpper.has(g.gene.toUpperCase()));

  const results: BootstrapGeneShiftResult[] = [];
  const blockSize = 3;

  for (const g of highlightGenes) {
    const shifts: number[] = [];
    for (let b = 0; b < nBootstrap; b++) {
      const hBoot = blockBootstrap(g.healthySeries, blockSize, rng);
      const dBoot = blockBootstrap(g.diseaseSeries, blockSize, rng);
      const hFit = fitAR2(hBoot);
      const dFit = fitAR2(dBoot);
      shifts.push(dFit.eigenvalue - hFit.eigenvalue);
    }
    shifts.sort((a, b) => a - b);
    const ci95Lower = shifts[Math.floor(nBootstrap * 0.025)];
    const ci95Upper = shifts[Math.floor(nBootstrap * 0.975)];
    const ciWidth = ci95Upper - ci95Lower;
    const excludesZero = ci95Lower > 0 || ci95Upper < 0;

    results.push({
      gene: g.gene,
      category: g.category,
      pointEstimate: +g.shift.toFixed(6),
      ci95Lower: +ci95Lower.toFixed(6),
      ci95Upper: +ci95Upper.toFixed(6),
      ciWidth: +ciWidth.toFixed(6),
      excludesZero,
    });
  }

  return results;
}

function blockBootstrap(series: number[], blockSize: number, rng: () => number): number[] {
  const n = series.length;
  const result: number[] = [];
  while (result.length < n) {
    const start = Math.floor(rng() * (n - blockSize + 1));
    for (let j = 0; j < blockSize && result.length < n; j++) {
      result.push(series[start + j]);
    }
  }
  return result;
}

function runFDRCorrection(
  sharedGenes: ReturnType<typeof getSharedGenes>,
  rng: () => number
): FDRResult {
  const nShuffles = 200;
  const pValues: number[] = [];
  const geneNames: string[] = [];

  for (const g of sharedGenes) {
    const observedAbsShift = Math.abs(g.shift);
    let countGreater = 0;
    for (let s = 0; s < nShuffles; s++) {
      const hShuffled = shuffleArray([...g.healthySeries], rng);
      const dShuffled = shuffleArray([...g.diseaseSeries], rng);
      const hFit = fitAR2(hShuffled);
      const dFit = fitAR2(dShuffled);
      const nullShift = Math.abs(dFit.eigenvalue - hFit.eigenvalue);
      if (nullShift >= observedAbsShift) countGreater++;
    }
    const p = (countGreater + 1) / (nShuffles + 1);
    pValues.push(p);
    geneNames.push(g.gene);
  }

  const indexed = pValues.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p);
  const m = indexed.length;
  const qValues = new Array(m).fill(1);
  for (let rank = 0; rank < m; rank++) {
    const bh = indexed[rank].p * m / (rank + 1);
    qValues[indexed[rank].i] = bh;
  }
  for (let i = m - 2; i >= 0; i--) {
    const sortedIdx = indexed[i].i;
    const nextSortedIdx = indexed[i + 1].i;
    if (qValues[sortedIdx] > qValues[nextSortedIdx]) {
      qValues[sortedIdx] = qValues[nextSortedIdx];
    }
  }
  for (let i = 0; i < m; i++) {
    qValues[i] = Math.min(1, qValues[i]);
  }

  const significantAt005 = qValues.filter(q => q < 0.05).length;
  const significantAt010 = qValues.filter(q => q < 0.10).length;
  const significantAt020 = qValues.filter(q => q < 0.20).length;

  const highlightUpper = new Set(HIGHLIGHTS.map(h => h.toUpperCase()));
  const highlightQValues: FDRResult['highlightQValues'] = [];
  for (let i = 0; i < m; i++) {
    if (highlightUpper.has(geneNames[i].toUpperCase())) {
      highlightQValues.push({
        gene: geneNames[i],
        pValue: +pValues[i].toFixed(6),
        qValue: +qValues[i].toFixed(6),
        significant005: qValues[i] < 0.05,
      });
    }
  }

  return {
    totalGenesTested: m,
    significantAt005,
    significantAt010,
    significantAt020,
    highlightQValues,
  };
}

function shuffleArray(arr: number[], rng: () => number): number[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function runDiagnosticsSummary(
  sharedGenes: ReturnType<typeof getSharedGenes>
): DiagnosticsSummary {
  const healthyCounts: Record<string, number> = { High: 0, Moderate: 0, Low: 0, Unreliable: 0 };
  const diseaseCounts: Record<string, number> = { High: 0, Moderate: 0, Low: 0, Unreliable: 0 };
  const confidenceDropped: DiagnosticsSummary['confidenceDropped'] = [];
  const highlightDiagnostics: DiagnosticsSummary['highlightDiagnostics'] = [];
  const highlightUpper = new Set(HIGHLIGHTS.map(h => h.toUpperCase()));

  const confidenceRank: Record<string, number> = { High: 3, Moderate: 2, Low: 1, Unreliable: 0 };

  for (const g of sharedGenes) {
    const hDiag = fitAR2WithDiagnostics(g.healthySeries);
    const dDiag = fitAR2WithDiagnostics(g.diseaseSeries);

    const hConf = hDiag?.diagnostics.overallConfidence ?? 'Unreliable';
    const dConf = dDiag?.diagnostics.overallConfidence ?? 'Unreliable';

    healthyCounts[hConf] = (healthyCounts[hConf] || 0) + 1;
    diseaseCounts[dConf] = (diseaseCounts[dConf] || 0) + 1;

    if (confidenceRank[hConf] >= 3 && confidenceRank[dConf] <= 1) {
      confidenceDropped.push({
        gene: g.gene,
        healthyConfidence: hConf,
        diseaseConfidence: dConf,
      });
    }

    if (highlightUpper.has(g.gene.toUpperCase())) {
      highlightDiagnostics.push({
        gene: g.gene,
        healthyConfidence: hConf,
        diseaseConfidence: dConf,
        healthyScore: hDiag?.diagnostics.confidenceScore ?? 0,
        diseaseScore: dDiag?.diagnostics.confidenceScore ?? 0,
      });
    }
  }

  return { healthyCounts, diseaseCounts, confidenceDropped, highlightDiagnostics };
}

export function runDiseaseScreenRobustness(pairIndex: number, options?: {
  nPermutations?: number;
  nBootstrap?: number;
  seed?: number;
  minR2?: number;
  onlyStable?: boolean;
}): DiseaseScreenRobustnessResult {
  const nPermutations = options?.nPermutations ?? 10000;
  const nBootstrap = options?.nBootstrap ?? 5000;
  const seed = options?.seed ?? 42;
  const minR2 = options?.minR2 ?? 0.0;
  const onlyStable = options?.onlyStable ?? false;

  if (pairIndex < 0 || pairIndex >= DISEASE_PAIRS.length) {
    throw new Error(`Invalid pairIndex ${pairIndex}. Must be 0-${DISEASE_PAIRS.length - 1}`);
  }

  const pair = DISEASE_PAIRS[pairIndex];
  const healthyPath = getDatasetPath(pair.healthyId);
  const diseasePath = getDatasetPath(pair.diseaseId);

  const healthyGenes = parseDatasetFile(healthyPath);
  const diseaseGenes = parseDatasetFile(diseasePath);

  const sharedGenes = getSharedGenes(healthyGenes, diseaseGenes, minR2, onlyStable);

  if (sharedGenes.length === 0) {
    throw new Error(`No shared genes found between ${pair.healthyId} and ${pair.diseaseId}`);
  }

  const rng1 = mulberry32(seed);
  const { categoryResults, globalTest } = runCategoryPermutations(sharedGenes, nPermutations, rng1);

  const rng2 = mulberry32(seed + 1000);
  const bootstrapShifts = runBootstrapCIShifts(sharedGenes, nBootstrap, rng2);

  const rng3 = mulberry32(seed + 2000);
  const fdr = runFDRCorrection(sharedGenes, rng3);

  const diagnosticsSummary = runDiagnosticsSummary(sharedGenes);

  const sigCats = categoryResults.filter(c => c.pValue < 0.05);
  const excludeZeroCount = bootstrapShifts.filter(b => b.excludesZero).length;
  const conclusion = `Disease screen robustness for "${pair.label}" (${pair.category}): ` +
    `${sharedGenes.length} shared genes analyzed. ` +
    `${sigCats.length}/${categoryResults.length} categories show significant mean shift (p<0.05). ` +
    `Global Kruskal-Wallis ${globalTest.significant ? 'significant' : 'not significant'} (p=${globalTest.pValue}). ` +
    `Bootstrap: ${excludeZeroCount}/${bootstrapShifts.length} highlight genes have CIs excluding zero. ` +
    `FDR: ${fdr.significantAt005} genes significant at q<0.05, ${fdr.significantAt010} at q<0.10. ` +
    `Diagnostics: ${diagnosticsSummary.confidenceDropped.length} genes dropped confidence High→Low/Unreliable in disease.`;

  return {
    pairIndex,
    pairLabel: pair.label,
    pairCategory: pair.category,
    healthyId: pair.healthyId,
    diseaseId: pair.diseaseId,
    sharedGeneCount: sharedGenes.length,
    categoryPermutations: categoryResults,
    globalTest,
    bootstrapShifts,
    fdr,
    diagnosticsSummary,
    conclusion,
  };
}
