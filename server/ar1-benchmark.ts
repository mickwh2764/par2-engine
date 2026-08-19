import * as fs from 'fs';
import * as path from 'path';

const CLOCK_GENES = new Set([
  'PER1','PER2','PER3','CRY1','CRY2','CLOCK','ARNTL','BMAL1',
  'NR1D1','NR1D2','RORC','DBP','TEF','NPAS2','CIPC','BHLHE40','BHLHE41',
  'RORA','RORB','RORC','CSNK1D','CSNK1E','FBXL3','FBXW11','NFIL3'
]);

const TARGET_GENES = new Set([
  'CCND1','MYC','MCM6','WEE1','CDK1','CCNB1','CCNE1','CCNE2',
  'LGR5','MKI67','AXIN2','TP53','CDKN1A','BCL2','BAX','CHEK2',
  'CDK2','CDK4','CDK6','CCNA2','E2F1','RB1','PCNA','TOP2A',
  'BRCA1','RAD51','CDC25A','CDC25B','PLK1','AURKA','AURKB',
  'BUB1','MAD2L1','CENPE','KIF11','TERT','DKK1','WNT3','WNT5A',
  'CTNNB1','APC','GSK3B','NOTCH1','HES1','DLL1','JAG1'
]);

const TISSUES = [
  'Adrenal','Aorta','Brainstem','Brown_Fat','Cerebellum',
  'Heart','Hypothalamus','Kidney','Liver','Lung','Muscle','White_Fat'
];

function parseCSV(filePath: string): Map<string, number[]> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  const genes = new Map<string, number[]>();
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    const gene = parts[0].trim().replace(/"/g, '');
    const values = parts.slice(1).map(Number).filter(v => !isNaN(v));
    if (values.length >= 5 && !values.every(v => v === 0)) {
      genes.set(gene, values);
    }
  }
  return genes;
}

function classifyGene(gene: string): 'clock' | 'target' | 'background' {
  const upper = gene.toUpperCase();
  if (CLOCK_GENES.has(upper)) return 'clock';
  if (TARGET_GENES.has(upper)) return 'target';
  return 'background';
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function fitAR1(series: number[]): { phi1: number; eigenvalue: number; r2: number } | null {
  const n = series.length;
  if (n < 4) return null;

  const m = series.reduce((a, b) => a + b, 0) / n;
  const y = series.map(x => x - m);

  const Y = y.slice(1);
  const Y1 = y.slice(0, n - 1);

  let s11 = 0, sy1 = 0;
  for (let i = 0; i < Y.length; i++) {
    s11 += Y1[i] * Y1[i];
    sy1 += Y[i] * Y1[i];
  }

  if (Math.abs(s11) < 1e-15) return null;
  const phi1 = sy1 / s11;
  const eigenvalue = Math.abs(phi1);

  let ssRes = 0, ssTot = 0;
  const yMean = Y.reduce((a, b) => a + b, 0) / Y.length;
  for (let i = 0; i < Y.length; i++) {
    const pred = phi1 * Y1[i];
    ssRes += (Y[i] - pred) ** 2;
    ssTot += (Y[i] - yMean) ** 2;
  }
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  return { phi1, eigenvalue, r2 };
}

function fitAR2(series: number[]): { phi1: number; phi2: number; eigenvalue: number; r2: number } | null {
  const n = series.length;
  if (n < 5) return null;

  const m = series.reduce((a, b) => a + b, 0) / n;
  const y = series.map(x => x - m);

  const Y = y.slice(2);
  const Y1 = y.slice(1, n - 1);
  const Y2 = y.slice(0, n - 2);

  let s11 = 0, s22 = 0, s12 = 0, sy1 = 0, sy2 = 0;
  for (let i = 0; i < Y.length; i++) {
    s11 += Y1[i] * Y1[i];
    s22 += Y2[i] * Y2[i];
    s12 += Y1[i] * Y2[i];
    sy1 += Y[i] * Y1[i];
    sy2 += Y[i] * Y2[i];
  }

  const det = s11 * s22 - s12 * s12;
  if (Math.abs(det) < 1e-15) return null;

  const phi1 = (sy1 * s22 - sy2 * s12) / det;
  const phi2 = (sy2 * s11 - sy1 * s12) / det;

  const disc = phi1 * phi1 + 4 * phi2;
  let eigenvalue: number;
  if (disc >= 0) {
    eigenvalue = Math.max(
      Math.abs((phi1 + Math.sqrt(disc)) / 2),
      Math.abs((phi1 - Math.sqrt(disc)) / 2)
    );
  } else {
    eigenvalue = Math.sqrt(-phi2);
  }

  if (isNaN(eigenvalue)) return null;

  let ssRes = 0, ssTot = 0;
  const yMean = Y.reduce((a, b) => a + b, 0) / Y.length;
  for (let i = 0; i < Y.length; i++) {
    const pred = phi1 * Y1[i] + phi2 * Y2[i];
    ssRes += (Y[i] - pred) ** 2;
    ssTot += (Y[i] - yMean) ** 2;
  }
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  const nObs = Y.length;
  const aic1 = nObs * Math.log(Math.max(ssRes / nObs, 1e-20)) + 2 * 1;
  const aic2 = nObs * Math.log(Math.max(ssRes / nObs, 1e-20)) + 2 * 2;

  return { phi1, phi2, eigenvalue, r2 };
}

function computeAIC(series: number[], order: 1 | 2): number {
  const n = series.length;
  const m = series.reduce((a, b) => a + b, 0) / n;
  const y = series.map(x => x - m);

  if (order === 1) {
    const Y = y.slice(1);
    const Y1 = y.slice(0, n - 1);
    let s11 = 0, sy1 = 0;
    for (let i = 0; i < Y.length; i++) {
      s11 += Y1[i] * Y1[i];
      sy1 += Y[i] * Y1[i];
    }
    if (Math.abs(s11) < 1e-15) return Infinity;
    const phi1 = sy1 / s11;
    let ssRes = 0;
    for (let i = 0; i < Y.length; i++) {
      ssRes += (Y[i] - phi1 * Y1[i]) ** 2;
    }
    const nObs = Y.length;
    return nObs * Math.log(Math.max(ssRes / nObs, 1e-20)) + 2 * 1;
  } else {
    const Y = y.slice(2);
    const Y1 = y.slice(1, n - 1);
    const Y2 = y.slice(0, n - 2);
    let s11 = 0, s22 = 0, s12 = 0, sy1 = 0, sy2 = 0;
    for (let i = 0; i < Y.length; i++) {
      s11 += Y1[i] * Y1[i];
      s22 += Y2[i] * Y2[i];
      s12 += Y1[i] * Y2[i];
      sy1 += Y[i] * Y1[i];
      sy2 += Y[i] * Y2[i];
    }
    const det = s11 * s22 - s12 * s12;
    if (Math.abs(det) < 1e-15) return Infinity;
    const phi1 = (sy1 * s22 - sy2 * s12) / det;
    const phi2 = (sy2 * s11 - sy1 * s12) / det;
    let ssRes = 0;
    for (let i = 0; i < Y.length; i++) {
      ssRes += (Y[i] - phi1 * Y1[i] - phi2 * Y2[i]) ** 2;
    }
    const nObs = Y.length;
    return nObs * Math.log(Math.max(ssRes / nObs, 1e-20)) + 2 * 2;
  }
}

function wilcoxonRankSum(a: number[], b: number[]): number {
  const combined = [
    ...a.map(v => ({ v, group: 0 })),
    ...b.map(v => ({ v, group: 1 }))
  ].sort((x, y) => x.v - y.v);

  for (let i = 0; i < combined.length; i++) {
    (combined[i] as any).rank = i + 1;
  }

  let i = 0;
  while (i < combined.length) {
    let j = i;
    while (j < combined.length && combined[j].v === combined[i].v) j++;
    const avgRank = (i + j + 1) / 2;
    for (let k = i; k < j; k++) (combined[k] as any).rank = avgRank;
    i = j;
  }

  const n1 = a.length;
  const n2 = b.length;
  const R1 = combined.filter(c => c.group === 0).reduce((s, c) => s + (c as any).rank, 0);
  const U1 = R1 - n1 * (n1 + 1) / 2;
  const meanU = n1 * n2 / 2;
  const sdU = Math.sqrt(n1 * n2 * (n1 + n2 + 1) / 12);
  const z = sdU > 0 ? (U1 - meanU) / sdU : 0;
  const p = 2 * (1 - normalCDF(Math.abs(z)));
  return p;
}

function normalCDF(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327;
  const p = d * Math.exp(-x * x / 2) * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - p : p;
}

function cohensD(a: number[], b: number[]): number {
  const ma = mean(a), mb = mean(b);
  const va = a.reduce((s, x) => s + (x - ma) ** 2, 0) / (a.length - 1);
  const vb = b.reduce((s, x) => s + (x - mb) ** 2, 0) / (b.length - 1);
  const pooledSD = Math.sqrt(((a.length - 1) * va + (b.length - 1) * vb) / (a.length + b.length - 2));
  return pooledSD > 0 ? (ma - mb) / pooledSD : 0;
}

export interface AR1BenchmarkResult {
  perTissue: Record<string, TissueBenchmark>;
  grandSummary: GrandSummary;
  modelSelection: ModelSelectionSummary;
  computationTimeMs: number;
}

interface TissueBenchmark {
  tissue: string;
  ar1: CategoryStats;
  ar2: CategoryStats;
  ar2Preferred: { clock: number; target: number; background: number; overall: number };
}

interface CategoryStats {
  clock: { median: number; mean: number; n: number };
  target: { median: number; mean: number; n: number };
  background: { median: number; mean: number; n: number };
  hierarchyPreserved: boolean;
  clockTargetGap: number;
  clockBackgroundGap: number;
  clockTargetP: number;
  clockBackgroundP: number;
  clockTargetD: number;
  clockBackgroundD: number;
}

interface GrandSummary {
  ar1: CategoryStats;
  ar2: CategoryStats;
  discriminationRatio: {
    ar1ClockTargetD: number;
    ar2ClockTargetD: number;
    ar2Advantage: number;
  };
}

interface ModelSelectionSummary {
  totalGenes: number;
  ar2PreferredByAIC: number;
  ar2PreferredPct: number;
  perCategory: {
    clock: { total: number; ar2Preferred: number; pct: number };
    target: { total: number; ar2Preferred: number; pct: number };
    background: { total: number; ar2Preferred: number; pct: number };
  };
}

export function runAR1Benchmark(): AR1BenchmarkResult {
  const startTime = Date.now();
  const allAR1: Record<string, number[]> = { clock: [], target: [], background: [] };
  const allAR2: Record<string, number[]> = { clock: [], target: [], background: [] };
  const modelPref: Record<string, { total: number; ar2: number }> = {
    clock: { total: 0, ar2: 0 },
    target: { total: 0, ar2: 0 },
    background: { total: 0, ar2: 0 }
  };
  const perTissue: Record<string, TissueBenchmark> = {};

  for (const tissue of TISSUES) {
    const filePath = path.join('datasets', `GSE54650_${tissue}_circadian.csv`);
    if (!fs.existsSync(filePath)) continue;

    const genes = parseCSV(filePath);
    const tissueAR1: Record<string, number[]> = { clock: [], target: [], background: [] };
    const tissueAR2: Record<string, number[]> = { clock: [], target: [], background: [] };
    const tissuePref: Record<string, { total: number; ar2: number }> = {
      clock: { total: 0, ar2: 0 },
      target: { total: 0, ar2: 0 },
      background: { total: 0, ar2: 0 }
    };

    for (const [gene, values] of Array.from(genes)) {
      const ar1Fit = fitAR1(values);
      const ar2Fit = fitAR2(values);
      if (!ar1Fit || !ar2Fit) continue;

      const cat = classifyGene(gene);
      const ar1Lambda = Math.min(ar1Fit.eigenvalue, 1.0);
      const ar2Lambda = Math.min(ar2Fit.eigenvalue, 1.0);

      tissueAR1[cat].push(ar1Lambda);
      tissueAR2[cat].push(ar2Lambda);
      allAR1[cat].push(ar1Lambda);
      allAR2[cat].push(ar2Lambda);

      const aic1 = computeAIC(values, 1);
      const aic2 = computeAIC(values, 2);
      tissuePref[cat].total++;
      modelPref[cat].total++;
      if (aic2 < aic1) {
        tissuePref[cat].ar2++;
        modelPref[cat].ar2++;
      }
    }

    const ar1Stats = buildCategoryStats(tissueAR1);
    const ar2Stats = buildCategoryStats(tissueAR2);

    perTissue[tissue] = {
      tissue,
      ar1: ar1Stats,
      ar2: ar2Stats,
      ar2Preferred: {
        clock: tissuePref.clock.total > 0 ? (tissuePref.clock.ar2 / tissuePref.clock.total) * 100 : 0,
        target: tissuePref.target.total > 0 ? (tissuePref.target.ar2 / tissuePref.target.total) * 100 : 0,
        background: tissuePref.background.total > 0 ? (tissuePref.background.ar2 / tissuePref.background.total) * 100 : 0,
        overall: (tissuePref.clock.ar2 + tissuePref.target.ar2 + tissuePref.background.ar2) /
                 Math.max(tissuePref.clock.total + tissuePref.target.total + tissuePref.background.total, 1) * 100
      }
    };
  }

  const ar1Grand = buildCategoryStats(allAR1);
  const ar2Grand = buildCategoryStats(allAR2);

  const totalGenes = modelPref.clock.total + modelPref.target.total + modelPref.background.total;
  const totalAR2Pref = modelPref.clock.ar2 + modelPref.target.ar2 + modelPref.background.ar2;

  return {
    perTissue,
    grandSummary: {
      ar1: ar1Grand,
      ar2: ar2Grand,
      discriminationRatio: {
        ar1ClockTargetD: ar1Grand.clockTargetD,
        ar2ClockTargetD: ar2Grand.clockTargetD,
        ar2Advantage: ar2Grand.clockTargetD > 0 && ar1Grand.clockTargetD > 0
          ? ar2Grand.clockTargetD / ar1Grand.clockTargetD
          : 0
      }
    },
    modelSelection: {
      totalGenes,
      ar2PreferredByAIC: totalAR2Pref,
      ar2PreferredPct: totalGenes > 0 ? (totalAR2Pref / totalGenes) * 100 : 0,
      perCategory: {
        clock: { total: modelPref.clock.total, ar2Preferred: modelPref.clock.ar2, pct: modelPref.clock.total > 0 ? (modelPref.clock.ar2 / modelPref.clock.total) * 100 : 0 },
        target: { total: modelPref.target.total, ar2Preferred: modelPref.target.ar2, pct: modelPref.target.total > 0 ? (modelPref.target.ar2 / modelPref.target.total) * 100 : 0 },
        background: { total: modelPref.background.total, ar2Preferred: modelPref.background.ar2, pct: modelPref.background.total > 0 ? (modelPref.background.ar2 / modelPref.background.total) * 100 : 0 }
      }
    },
    computationTimeMs: Date.now() - startTime
  };
}

function buildCategoryStats(data: Record<string, number[]>): CategoryStats {
  const clockMed = median(data.clock);
  const targetMed = median(data.target);
  const bgMed = median(data.background);

  return {
    clock: { median: clockMed, mean: mean(data.clock), n: data.clock.length },
    target: { median: targetMed, mean: mean(data.target), n: data.target.length },
    background: { median: bgMed, mean: mean(data.background), n: data.background.length },
    hierarchyPreserved: clockMed > targetMed && targetMed > bgMed,
    clockTargetGap: clockMed - targetMed,
    clockBackgroundGap: clockMed - bgMed,
    clockTargetP: data.clock.length > 0 && data.target.length > 0 ? wilcoxonRankSum(data.clock, data.target) : 1,
    clockBackgroundP: data.clock.length > 0 && data.background.length > 0 ? wilcoxonRankSum(data.clock, data.background) : 1,
    clockTargetD: data.clock.length > 1 && data.target.length > 1 ? cohensD(data.clock, data.target) : 0,
    clockBackgroundD: data.clock.length > 1 && data.background.length > 1 ? cohensD(data.clock, data.background) : 0
  };
}
