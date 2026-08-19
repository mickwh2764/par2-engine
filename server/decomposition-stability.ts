import * as fs from 'fs';
import * as path from 'path';
import { ENSEMBL_TO_GENE_SYMBOL } from './par2-engine';

const CLOCK_GENES = ['Per1', 'Per2', 'Per3', 'Cry1', 'Cry2', 'Clock', 'Arntl', 'Nr1d1', 'Nr1d2', 'Dbp', 'Tef', 'Npas2', 'Rorc'];
const TARGET_GENES = ['Myc', 'Ccnd1', 'Ccnb1', 'Cdk1', 'Wee1', 'Cdkn1a', 'Lgr5', 'Axin2', 'Ctnnb1', 'Apc',
  'Tp53', 'Mdm2', 'Atm', 'Chek2', 'Bcl2', 'Bax', 'Pparg', 'Sirt1', 'Hif1a',
  'Ccne1', 'Ccne2', 'Mcm6', 'Mki67'];
const CLOCK_GENES_UPPER = CLOCK_GENES.map(g => g.toUpperCase());
const TARGET_GENES_UPPER = TARGET_GENES.map(g => g.toUpperCase());

interface DecompositionMethod {
  name: string;
  key: string;
  description: string;
}

const METHODS: DecompositionMethod[] = [
  { name: 'No Removal (Raw)', key: 'raw', description: 'Fit AR(2) directly on raw expression values' },
  { name: 'Mean Driver Removal', key: 'mean', description: 'Subtract OLS regression on global mean across all genes per timepoint' },
  { name: 'Median Driver Removal', key: 'median', description: 'Subtract OLS regression on global median across all genes per timepoint' },
  { name: 'PC1 Removal', key: 'pc1', description: 'Project out first principal component of the expression matrix' },
  { name: '25% Variance Removal', key: 'var25', description: 'Remove top PCs explaining 25% of total variance' },
  { name: '50% Variance Removal', key: 'var50', description: 'Remove top PCs explaining 50% of total variance' },
];

function fitAR2(series: number[]): { phi1: number; phi2: number; eigenvalue: number } {
  const n = series.length;
  if (n < 5) return { phi1: 0, phi2: 0, eigenvalue: 0 };

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
  if (Math.abs(denom) < 1e-10) return { phi1: 0, phi2: 0, eigenvalue: 0 };

  const phi1 = (sumYY1 * sumY2Y2 - sumYY2 * sumY1Y2) / denom;
  const phi2 = (sumYY2 * sumY1Y1 - sumYY1 * sumY1Y2) / denom;

  const discriminant = phi1 * phi1 + 4 * phi2;
  let eigenvalue: number;
  if (discriminant < 0) {
    eigenvalue = Math.sqrt(-phi2);
  } else {
    const r1 = (phi1 + Math.sqrt(discriminant)) / 2;
    const r2 = (phi1 - Math.sqrt(discriminant)) / 2;
    eigenvalue = Math.max(Math.abs(r1), Math.abs(r2));
  }

  return { phi1, phi2, eigenvalue };
}

function parseCSV(content: string): Map<string, number[]> {
  const lines = content.trim().split('\n');
  const rows = new Map<string, number[]>();
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const geneName = cols[0].trim().replace(/"/g, '');
    const values = cols.slice(1).map(v => parseFloat(v)).filter(v => !isNaN(v));
    if (values.length >= 5) {
      rows.set(geneName, values);
    }
  }
  return rows;
}

function findGene(rows: Map<string, number[]>, gene: string, useEnsembl: boolean = false): number[] | null {
  const variants = [gene, gene.toLowerCase(), gene.toUpperCase(),
    gene.charAt(0).toUpperCase() + gene.slice(1).toLowerCase()];
  for (const v of variants) {
    if (rows.has(v)) return rows.get(v)!;
  }
  if (useEnsembl) {
    for (const [ensemblId, symbol] of Object.entries(ENSEMBL_TO_GENE_SYMBOL)) {
      if (symbol.toUpperCase() === gene.toUpperCase()) {
        const cleanId = ensemblId.replace(/"/g, '');
        if (rows.has(cleanId)) return rows.get(cleanId)!;
        if (rows.has(`"${cleanId}"`)) return rows.get(`"${cleanId}"`)!;
      }
    }
  }
  return null;
}

function computeGlobalMean(rows: Map<string, number[]>, nTimepoints: number): number[] {
  const gm = new Array(nTimepoints).fill(0);
  let count = 0;
  for (const values of rows.values()) {
    if (values.length === nTimepoints) {
      for (let t = 0; t < nTimepoints; t++) gm[t] += values[t];
      count++;
    }
  }
  if (count === 0) return gm;
  return gm.map(v => v / count);
}

function computeGlobalMedian(rows: Map<string, number[]>, nTimepoints: number): number[] {
  const columns: number[][] = Array.from({ length: nTimepoints }, () => []);
  for (const values of rows.values()) {
    if (values.length === nTimepoints) {
      for (let t = 0; t < nTimepoints; t++) columns[t].push(values[t]);
    }
  }
  return columns.map(col => {
    col.sort((a, b) => a - b);
    const mid = Math.floor(col.length / 2);
    return col.length % 2 === 0 ? (col[mid - 1] + col[mid]) / 2 : col[mid];
  });
}

function regressOut(series: number[], driver: number[]): number[] {
  const n = Math.min(series.length, driver.length);
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let t = 0; t < n; t++) {
    sumX += driver[t];
    sumY += series[t];
    sumXY += driver[t] * series[t];
    sumX2 += driver[t] * driver[t];
  }
  const denom = n * sumX2 - sumX * sumX;
  if (Math.abs(denom) < 1e-10) return series.slice();
  const b = (n * sumXY - sumX * sumY) / denom;
  const a = (sumY - b * sumX) / n;
  return series.map((v, t) => v - (a + b * driver[t]));
}

function computePC1(rows: Map<string, number[]>, nTimepoints: number): number[] {
  const allSeries: number[][] = [];
  for (const values of rows.values()) {
    if (values.length === nTimepoints) {
      const mean = values.reduce((a, b) => a + b, 0) / nTimepoints;
      allSeries.push(values.map(v => v - mean));
    }
  }
  if (allSeries.length === 0) return new Array(nTimepoints).fill(0);

  let pc = new Array(nTimepoints).fill(0);
  for (let t = 0; t < nTimepoints; t++) pc[t] = Math.random() - 0.5;
  let norm = Math.sqrt(pc.reduce((s, v) => s + v * v, 0));
  pc = pc.map(v => v / norm);

  for (let iter = 0; iter < 50; iter++) {
    const newPC = new Array(nTimepoints).fill(0);
    for (const series of allSeries) {
      const dot = series.reduce((s, v, t) => s + v * pc[t], 0);
      for (let t = 0; t < nTimepoints; t++) newPC[t] += dot * series[t];
    }
    norm = Math.sqrt(newPC.reduce((s, v) => s + v * v, 0));
    if (norm < 1e-10) break;
    pc = newPC.map(v => v / norm);
  }

  return pc;
}

function removePC1(series: number[], pc1: number[]): number[] {
  const n = Math.min(series.length, pc1.length);
  const mean = series.reduce((a, b) => a + b, 0) / n;
  const centered = series.map(v => v - mean);
  const proj = centered.reduce((s, v, t) => s + v * pc1[t], 0);
  return centered.map((v, t) => v - proj * pc1[t]);
}

function computeTopPCs(rows: Map<string, number[]>, nTimepoints: number, varianceTarget: number): number[][] {
  const allSeries: number[][] = [];
  for (const values of rows.values()) {
    if (values.length === nTimepoints) {
      const mean = values.reduce((a, b) => a + b, 0) / nTimepoints;
      allSeries.push(values.map(v => v - mean));
    }
  }
  if (allSeries.length === 0) return [];

  let totalVar = 0;
  for (const s of allSeries) {
    totalVar += s.reduce((acc, v) => acc + v * v, 0);
  }

  const pcs: number[][] = [];
  let explainedVar = 0;
  const residuals = allSeries.map(s => [...s]);

  for (let k = 0; k < Math.min(nTimepoints, 10); k++) {
    let pc = new Array(nTimepoints).fill(0).map(() => Math.random() - 0.5);
    let norm = Math.sqrt(pc.reduce((s, v) => s + v * v, 0));
    pc = pc.map(v => v / norm);

    for (let iter = 0; iter < 50; iter++) {
      const newPC = new Array(nTimepoints).fill(0);
      for (const series of residuals) {
        const dot = series.reduce((s, v, t) => s + v * pc[t], 0);
        for (let t = 0; t < nTimepoints; t++) newPC[t] += dot * series[t];
      }
      norm = Math.sqrt(newPC.reduce((s, v) => s + v * v, 0));
      if (norm < 1e-10) break;
      pc = newPC.map(v => v / norm);
    }

    let pcVar = 0;
    for (const series of residuals) {
      const dot = series.reduce((s, v, t) => s + v * pc[t], 0);
      pcVar += dot * dot;
    }

    for (const series of residuals) {
      const dot = series.reduce((s, v, t) => s + v * pc[t], 0);
      for (let t = 0; t < nTimepoints; t++) series[t] -= dot * pc[t];
    }

    pcs.push(pc);
    explainedVar += pcVar;

    if (explainedVar / totalVar >= varianceTarget) break;
  }

  return pcs;
}

function removeMultiplePCs(series: number[], pcs: number[][]): number[] {
  const n = series.length;
  const mean = series.reduce((a, b) => a + b, 0) / n;
  let result = series.map(v => v - mean);
  for (const pc of pcs) {
    const dot = result.reduce((s, v, t) => s + v * pc[t], 0);
    result = result.map((v, t) => v - dot * pc[t]);
  }
  return result;
}

function spearmanRankCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n < 3) return 0;
  const rankX = toRanks(x);
  const rankY = toRanks(y);
  const meanRX = rankX.reduce((a, b) => a + b, 0) / n;
  const meanRY = rankY.reduce((a, b) => a + b, 0) / n;
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = rankX[i] - meanRX;
    const dy = rankY[i] - meanRY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const denom = Math.sqrt(denX * denY);
  return denom < 1e-10 ? 0 : num / denom;
}

function toRanks(arr: number[]): number[] {
  const indexed = arr.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v);
  const ranks = new Array(arr.length);
  for (let i = 0; i < indexed.length; i++) {
    ranks[indexed[i].i] = i + 1;
  }
  return ranks;
}

interface DatasetSpec {
  file: string;
  label: string;
  species: string;
  tissue: string;
  useEnsembl?: boolean;
}

const CORE_DATASETS: DatasetSpec[] = [
  { file: 'GSE54650_Liver_circadian.csv', label: 'Mouse Liver (GSE54650)', species: 'Mus musculus', tissue: 'Liver' },
  { file: 'GSE54650_Kidney_circadian.csv', label: 'Mouse Kidney (GSE54650)', species: 'Mus musculus', tissue: 'Kidney' },
  { file: 'GSE54650_Heart_circadian.csv', label: 'Mouse Heart (GSE54650)', species: 'Mus musculus', tissue: 'Heart' },
  { file: 'GSE54650_Lung_circadian.csv', label: 'Mouse Lung (GSE54650)', species: 'Mus musculus', tissue: 'Lung' },
  { file: 'GSE54650_Muscle_circadian.csv', label: 'Mouse Muscle (GSE54650)', species: 'Mus musculus', tissue: 'Muscle' },
  { file: 'GSE54650_Cerebellum_circadian.csv', label: 'Mouse Cerebellum (GSE54650)', species: 'Mus musculus', tissue: 'Cerebellum' },
  { file: 'GSE54650_Adrenal_circadian.csv', label: 'Mouse Adrenal (GSE54650)', species: 'Mus musculus', tissue: 'Adrenal' },
  { file: 'GSE54650_Aorta_circadian.csv', label: 'Mouse Aorta (GSE54650)', species: 'Mus musculus', tissue: 'Aorta' },
  { file: 'GSE11923_Liver_1h_48h_genes.csv', label: 'Mouse Liver 48h (GSE11923)', species: 'Mus musculus', tissue: 'Liver' },
  { file: 'GSE157357_Organoid_WT-WT_circadian.csv', label: 'Organoid WT (GSE157357)', species: 'Mus musculus', tissue: 'Organoid', useEnsembl: true },
  { file: 'GSE157357_Organoid_ApcKO-WT_circadian.csv', label: 'Organoid APC-KO (GSE157357)', species: 'Mus musculus', tissue: 'Organoid', useEnsembl: true },
  { file: 'GSE113883_Human_WholeBlood.csv', label: 'Human Blood (GSE113883)', species: 'Homo sapiens', tissue: 'Blood' },
  { file: 'GSE122541_Nurses_DayShift_circadian.csv', label: 'Human Nurses Day Shift (GSE122541)', species: 'Homo sapiens', tissue: 'Blood' },
  { file: 'GSE122541_Nurses_NightShift_circadian.csv', label: 'Human Nurses Night Shift (GSE122541)', species: 'Homo sapiens', tissue: 'Blood' },
  { file: 'GSE221103_Neuroblastoma_MYC_ON.csv', label: 'Neuroblastoma MYC-ON (GSE221103)', species: 'Homo sapiens', tissue: 'Cancer' },
  { file: 'GSE221103_Neuroblastoma_MYC_OFF.csv', label: 'Neuroblastoma MYC-OFF (GSE221103)', species: 'Homo sapiens', tissue: 'Cancer' },
  { file: 'GSE179027_MouseEnteroid_circadian.csv', label: 'Mouse Enteroid (GSE179027)', species: 'Mus musculus', tissue: 'Enteroid' },
  { file: 'GSE161566_HumanEnteroid_circadian.csv', label: 'Human Enteroid (GSE161566)', species: 'Homo sapiens', tissue: 'Enteroid' },
];

interface PerGeneResult {
  gene: string;
  category: 'clock' | 'target';
  eigenvalues: Record<string, number>;
}

interface DatasetResult {
  dataset: string;
  label: string;
  tissue: string;
  nGenes: number;
  nTimepoints: number;
  methods: Record<string, { clockMean: number; targetMean: number; gap: number; clockN: number; targetN: number }>;
  geneResults: PerGeneResult[];
  rankCorrelations: { method1: string; method2: string; rho: number }[];
  gapStability: { method: string; gap: number }[];
  gapCV: number;
  gapPreserved: boolean;
  gapDirection: 'correct' | 'inverted' | 'mixed';
  dsi: number;
}

interface SimulationResult {
  scenario: string;
  description: string;
  trueClockMean: number;
  truetargetMean: number;
  trueGap: number;
  recoveredGaps: Record<string, number>;
  recoveredRankCorrelations: Record<string, number>;
  structureRecovered: boolean;
  falseInflation: boolean;
}

export interface DecompositionStabilityResult {
  timestamp: string;
  methods: DecompositionMethod[];
  datasets: DatasetResult[];
  simulations: SimulationResult[];
  overallDSI: number;
  overallRankCorrelation: number;
  gapPreservedCount: number;
  gapPreservedTotal: number;
  correctDirectionCount: number;
  invertedCount: number;
  verdict: string;
  specification: {
    globalDriverDefinition: string;
    removalEquation: string;
    pseudocode: string[];
  };
}

function analyzeDatasetUnderMethods(spec: DatasetSpec): DatasetResult | null {
  const datasetsDir = path.join(process.cwd(), 'datasets');
  const filePath = path.join(datasetsDir, spec.file);
  if (!fs.existsSync(filePath)) return null;

  const content = fs.readFileSync(filePath, 'utf-8');
  const rows = parseCSV(content);
  if (rows.size < 50) return null;

  const firstSeries = rows.values().next().value;
  if (!firstSeries) return null;
  const nTimepoints = firstSeries.length;

  const isHuman = spec.species === 'Homo sapiens';
  const clockList = isHuman ? CLOCK_GENES_UPPER : CLOCK_GENES;
  const targetList = isHuman ? TARGET_GENES_UPPER : TARGET_GENES;

  const globalMean = computeGlobalMean(rows, nTimepoints);
  const globalMedian = computeGlobalMedian(rows, nTimepoints);
  const pc1 = computePC1(rows, nTimepoints);
  const pcs25 = computeTopPCs(rows, nTimepoints, 0.25);
  const pcs50 = computeTopPCs(rows, nTimepoints, 0.50);

  function getProcessedSeries(raw: number[], methodKey: string): number[] {
    switch (methodKey) {
      case 'raw': return raw;
      case 'mean': return regressOut(raw, globalMean);
      case 'median': return regressOut(raw, globalMedian);
      case 'pc1': return removePC1(raw, pc1);
      case 'var25': return removeMultiplePCs(raw, pcs25);
      case 'var50': return removeMultiplePCs(raw, pcs50);
      default: return raw;
    }
  }

  const geneResults: PerGeneResult[] = [];
  const methodResults: Record<string, { clockEVs: number[]; targetEVs: number[]; clockN: number; targetN: number }> = {};

  for (const m of METHODS) {
    methodResults[m.key] = { clockEVs: [], targetEVs: [], clockN: 0, targetN: 0 };
  }

  const allGenes = [...clockList.map(g => ({ gene: g, category: 'clock' as const })),
                    ...targetList.map(g => ({ gene: g, category: 'target' as const }))];

  for (const { gene, category } of allGenes) {
    const raw = findGene(rows, gene, spec.useEnsembl || false);
    if (!raw) continue;

    const evByMethod: Record<string, number> = {};
    let anyValid = false;

    for (const m of METHODS) {
      const processed = getProcessedSeries(raw, m.key);
      const result = fitAR2(processed);
      const ev = result.eigenvalue;
      if (ev > 0 && ev < 2.0) {
        evByMethod[m.key] = parseFloat(ev.toFixed(4));
        if (ev < 1.0) {
          if (category === 'clock') {
            methodResults[m.key].clockEVs.push(ev);
            methodResults[m.key].clockN++;
          } else {
            methodResults[m.key].targetEVs.push(ev);
            methodResults[m.key].targetN++;
          }
        }
        anyValid = true;
      }
    }

    if (anyValid) {
      geneResults.push({ gene, category, eigenvalues: evByMethod });
    }
  }

  const methods: Record<string, { clockMean: number; targetMean: number; gap: number; clockN: number; targetN: number }> = {};
  const gaps: number[] = [];

  for (const m of METHODS) {
    const mr = methodResults[m.key];
    const clockMean = mr.clockEVs.length > 0 ? mr.clockEVs.reduce((a, b) => a + b, 0) / mr.clockEVs.length : 0;
    const targetMean = mr.targetEVs.length > 0 ? mr.targetEVs.reduce((a, b) => a + b, 0) / mr.targetEVs.length : 0;
    const gap = clockMean - targetMean;
    methods[m.key] = {
      clockMean: parseFloat(clockMean.toFixed(4)),
      targetMean: parseFloat(targetMean.toFixed(4)),
      gap: parseFloat(gap.toFixed(4)),
      clockN: mr.clockN,
      targetN: mr.targetN,
    };
    gaps.push(gap);
  }

  const rankCorrelations: { method1: string; method2: string; rho: number }[] = [];
  const genesWithMultiple = geneResults.filter(g => Object.keys(g.eigenvalues).length >= 2);

  for (let i = 0; i < METHODS.length; i++) {
    for (let j = i + 1; j < METHODS.length; j++) {
      const m1 = METHODS[i].key;
      const m2 = METHODS[j].key;
      const pairs = genesWithMultiple.filter(g => g.eigenvalues[m1] !== undefined && g.eigenvalues[m2] !== undefined);
      if (pairs.length >= 5) {
        const x = pairs.map(g => g.eigenvalues[m1]);
        const y = pairs.map(g => g.eigenvalues[m2]);
        const rho = spearmanRankCorrelation(x, y);
        rankCorrelations.push({ method1: m1, method2: m2, rho: parseFloat(rho.toFixed(4)) });
      }
    }
  }

  const meanGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const gapVariance = gaps.reduce((s, g) => s + (g - meanGap) ** 2, 0) / gaps.length;
  const gapSD = Math.sqrt(gapVariance);
  const gapCV = meanGap !== 0 ? Math.abs(gapSD / meanGap) : 1;

  const allPositive = gaps.every(g => g > 0);
  const allNegative = gaps.every(g => g <= 0);
  const gapPreserved = allPositive || allNegative;
  const gapDirection: 'correct' | 'inverted' | 'mixed' = allPositive ? 'correct' : allNegative ? 'inverted' : 'mixed';

  const meanRho = rankCorrelations.length > 0
    ? rankCorrelations.reduce((s, r) => s + r.rho, 0) / rankCorrelations.length
    : 0;

  const dsi = parseFloat(((1 - gapCV) * 0.5 + meanRho * 0.3 + (gapPreserved ? 0.2 : 0)).toFixed(3));

  return {
    dataset: spec.file,
    label: spec.label,
    tissue: spec.tissue,
    nGenes: rows.size,
    nTimepoints,
    methods,
    geneResults,
    rankCorrelations,
    gapStability: METHODS.map(m => ({ method: m.key, gap: methods[m.key]?.gap || 0 })),
    gapCV: parseFloat(gapCV.toFixed(4)),
    gapPreserved,
    gapDirection,
    dsi,
  };
}

function runSimulations(): SimulationResult[] {
  const results: SimulationResult[] = [];
  const seed = 42;
  const rng = createSeededRNG(seed);

  results.push(runSimulationScenario(rng,
    'Known hierarchy with global driver',
    'Simulate 200 genes with a shared sinusoidal global driver, 10 clock genes with high persistence (phi1=0.8, phi2=-0.3), and 10 target genes with low persistence (phi1=0.4, phi2=-0.1). Verify hierarchy is recovered after driver removal.',
    200, 48, { clockPhi1: 0.8, clockPhi2: -0.3, targetPhi1: 0.4, targetPhi2: -0.1 }, 1.0
  ));

  results.push(runSimulationScenario(rng,
    'No hierarchy (null model)',
    'Simulate 200 genes all with identical AR(2) parameters (phi1=0.5, phi2=-0.15). Verify that no false hierarchy emerges after any decomposition method.',
    200, 48, { clockPhi1: 0.5, clockPhi2: -0.15, targetPhi1: 0.5, targetPhi2: -0.15 }, 1.0
  ));

  results.push(runSimulationScenario(rng,
    'Weak hierarchy with strong driver',
    'Simulate 200 genes with a dominant global driver (5x amplitude) and a subtle hierarchy (clock phi1=0.6, target phi1=0.5). Test whether the weak hierarchy survives decomposition.',
    200, 48, { clockPhi1: 0.6, clockPhi2: -0.2, targetPhi1: 0.5, targetPhi2: -0.15 }, 5.0
  ));

  results.push(runSimulationScenario(rng,
    'Short time-series (12 timepoints)',
    'Same as scenario 1 but with only 12 timepoints. Tests whether decomposition introduces artifacts in short series.',
    200, 12, { clockPhi1: 0.8, clockPhi2: -0.3, targetPhi1: 0.4, targetPhi2: -0.1 }, 1.0
  ));

  return results;
}

function createSeededRNG(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function gaussianRNG(rng: () => number): number {
  let u1 = 0, u2 = 0;
  while (u1 === 0) u1 = rng();
  while (u2 === 0) u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function runSimulationScenario(
  rng: () => number,
  scenario: string,
  description: string,
  nGenes: number,
  nTimepoints: number,
  params: { clockPhi1: number; clockPhi2: number; targetPhi1: number; targetPhi2: number },
  driverAmplitude: number
): SimulationResult {
  const nClock = 10;
  const nTarget = 10;

  const globalDriver = Array.from({ length: nTimepoints }, (_, t) =>
    driverAmplitude * Math.sin(2 * Math.PI * t / 24)
  );

  const allSeries: { series: number[]; category: 'clock' | 'target' | 'other'; trueEV: number }[] = [];

  for (let g = 0; g < nGenes; g++) {
    let phi1: number, phi2: number, category: 'clock' | 'target' | 'other';
    if (g < nClock) {
      phi1 = params.clockPhi1;
      phi2 = params.clockPhi2;
      category = 'clock';
    } else if (g < nClock + nTarget) {
      phi1 = params.targetPhi1;
      phi2 = params.targetPhi2;
      category = 'target';
    } else {
      phi1 = 0.3 + rng() * 0.4;
      phi2 = -0.05 - rng() * 0.2;
      category = 'other';
    }

    const disc = phi1 * phi1 + 4 * phi2;
    let trueEV: number;
    if (disc < 0) {
      trueEV = Math.sqrt(-phi2);
    } else {
      trueEV = Math.max(Math.abs((phi1 + Math.sqrt(disc)) / 2), Math.abs((phi1 - Math.sqrt(disc)) / 2));
    }

    const series = new Array(nTimepoints).fill(0);
    series[0] = gaussianRNG(rng);
    series[1] = gaussianRNG(rng);
    for (let t = 2; t < nTimepoints; t++) {
      series[t] = phi1 * series[t - 1] + phi2 * series[t - 2] + gaussianRNG(rng) * 0.5;
    }

    for (let t = 0; t < nTimepoints; t++) {
      series[t] += globalDriver[t] + gaussianRNG(rng) * 0.1;
    }

    allSeries.push({ series, category, trueEV });
  }

  const trueClockEVs = allSeries.filter(s => s.category === 'clock').map(s => s.trueEV);
  const trueTargetEVs = allSeries.filter(s => s.category === 'target').map(s => s.trueEV);
  const trueClockMean = trueClockEVs.reduce((a, b) => a + b, 0) / trueClockEVs.length;
  const trueTargetMean = trueTargetEVs.reduce((a, b) => a + b, 0) / trueTargetEVs.length;
  const trueGap = trueClockMean - trueTargetMean;

  const rows = new Map<string, number[]>();
  allSeries.forEach((s, i) => rows.set(`Gene${i}`, s.series));

  const gm = computeGlobalMean(rows, nTimepoints);
  const gmed = computeGlobalMedian(rows, nTimepoints);
  const pc = computePC1(rows, nTimepoints);
  const pcs25 = computeTopPCs(rows, nTimepoints, 0.25);
  const pcs50 = computeTopPCs(rows, nTimepoints, 0.50);

  const methodDrivers: Record<string, (s: number[]) => number[]> = {
    'raw': (s) => s,
    'mean': (s) => regressOut(s, gm),
    'median': (s) => regressOut(s, gmed),
    'pc1': (s) => removePC1(s, pc),
    'var25': (s) => removeMultiplePCs(s, pcs25),
    'var50': (s) => removeMultiplePCs(s, pcs50),
  };

  const recoveredGaps: Record<string, number> = {};
  const recoveredRankCorrelations: Record<string, number> = {};

  for (const [methodKey, processor] of Object.entries(methodDrivers)) {
    const clockEVs: number[] = [];
    const targetEVs: number[] = [];
    const recoveredEVs: number[] = [];
    const trueEVs: number[] = [];

    for (const entry of allSeries) {
      const processed = processor(entry.series);
      const result = fitAR2(processed);
      const ev = result.eigenvalue;
      if (ev > 0 && ev < 2.0) {
        if (entry.category === 'clock' && ev < 1.0) clockEVs.push(ev);
        if (entry.category === 'target' && ev < 1.0) targetEVs.push(ev);
        if (entry.category === 'clock' || entry.category === 'target') {
          recoveredEVs.push(ev);
          trueEVs.push(entry.trueEV);
        }
      }
    }

    const clockMean = clockEVs.length > 0 ? clockEVs.reduce((a, b) => a + b, 0) / clockEVs.length : 0;
    const targetMean = targetEVs.length > 0 ? targetEVs.reduce((a, b) => a + b, 0) / targetEVs.length : 0;
    recoveredGaps[methodKey] = parseFloat((clockMean - targetMean).toFixed(4));

    if (recoveredEVs.length >= 5 && trueEVs.length >= 5) {
      recoveredRankCorrelations[methodKey] = parseFloat(spearmanRankCorrelation(trueEVs, recoveredEVs).toFixed(4));
    }
  }

  const isNullModel = Math.abs(trueGap) < 0.01;
  const structureRecovered = isNullModel
    ? Object.values(recoveredGaps).every(g => Math.abs(g) < 0.1)
    : Object.values(recoveredGaps).filter(g => Math.sign(g) === Math.sign(trueGap)).length >= 4;

  const falseInflation = isNullModel
    ? Object.values(recoveredGaps).some(g => Math.abs(g) > 0.15)
    : false;

  return {
    scenario,
    description,
    trueClockMean: parseFloat(trueClockMean.toFixed(4)),
    truetargetMean: parseFloat(trueTargetMean.toFixed(4)),
    trueGap: parseFloat(trueGap.toFixed(4)),
    recoveredGaps,
    recoveredRankCorrelations,
    structureRecovered,
    falseInflation,
  };
}

export function runDecompositionStability(): DecompositionStabilityResult {
  const datasets: DatasetResult[] = [];

  for (const spec of CORE_DATASETS) {
    const result = analyzeDatasetUnderMethods(spec);
    if (result) datasets.push(result);
  }

  const simulations = runSimulations();

  const allRhos = datasets.flatMap(d => d.rankCorrelations.map(r => r.rho));
  const overallRankCorrelation = allRhos.length > 0
    ? parseFloat((allRhos.reduce((a, b) => a + b, 0) / allRhos.length).toFixed(4))
    : 0;

  const gapPreservedCount = datasets.filter(d => d.gapPreserved).length;
  const gapPreservedTotal = datasets.length;
  const correctDirectionCount = datasets.filter(d => d.gapDirection === 'correct').length;
  const invertedCount = datasets.filter(d => d.gapDirection === 'inverted').length;

  const dsis = datasets.map(d => d.dsi);
  const overallDSI = dsis.length > 0
    ? parseFloat((dsis.reduce((a, b) => a + b, 0) / dsis.length).toFixed(3))
    : 0;

  let verdict: string;
  if (overallRankCorrelation >= 0.85 && correctDirectionCount === gapPreservedTotal) {
    verdict = 'STRONG: Hierarchy is robust to decomposition method choice. Clock > target gap preserved across all variants.';
  } else if (overallRankCorrelation >= 0.85 && correctDirectionCount >= gapPreservedTotal * 0.8 && invertedCount > 0) {
    verdict = `STRONG (with note): Clock > target hierarchy robust in ${correctDirectionCount}/${gapPreservedTotal} datasets. ${invertedCount} dataset(s) show a consistently inverted curated-panel gap — see individual dataset notes.`;
  } else if (overallRankCorrelation >= 0.7 && gapPreservedCount >= gapPreservedTotal * 0.8) {
    verdict = 'MODERATE: Hierarchy is mostly robust. Minor sensitivity to decomposition method in some datasets.';
  } else {
    verdict = 'WEAK: Hierarchy shows sensitivity to decomposition method. Results should be interpreted with caution.';
  }

  return {
    timestamp: new Date().toISOString(),
    methods: METHODS,
    datasets,
    simulations,
    overallDSI,
    overallRankCorrelation,
    gapPreservedCount,
    gapPreservedTotal,
    correctDirectionCount,
    invertedCount,
    verdict,
    specification: {
      globalDriverDefinition: 'G(t) = (1/N) * Σᵢ xᵢ(t), where N is the number of genes and xᵢ(t) is expression of gene i at timepoint t. Alternatives: median, PC1, or top-k PCs explaining target variance fraction.',
      removalEquation: 'x_residual(t) = x(t) - (a + b * G(t)), where a and b are OLS regression coefficients of gene expression on global driver. For PC removal: x_residual(t) = x_centered(t) - Σₖ (x_centered · PCₖ) * PCₖ(t).',
      pseudocode: [
        '1. Load gene expression matrix X [genes × timepoints]',
        '2. Compute global driver G(t) using chosen method (mean/median/PC1/top-k PCs)',
        '3. For each gene i:',
        '   a. Regress xᵢ(t) = a + b·G(t) + εᵢ(t) via OLS',
        '   b. Compute residuals: εᵢ(t) = xᵢ(t) - â - b̂·G(t)',
        '   c. Fit AR(2) to residuals: εᵢ(t) = φ₁·εᵢ(t-1) + φ₂·εᵢ(t-2) + noise',
        '   d. Compute eigenvalue modulus |λ| from characteristic equation λ² - φ₁λ - φ₂ = 0',
        '4. Classify genes into clock/target categories',
        '5. Compute hierarchy gap = mean(clock |λ|) - mean(target |λ|)',
      ],
    },
  };
}
