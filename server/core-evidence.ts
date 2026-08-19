import * as fs from 'fs';
import * as path from 'path';

const datasetsDir = path.join(process.cwd(), 'datasets');

const CLOCK_GENES = ['Per1', 'Per2', 'Per3', 'Cry1', 'Cry2', 'Arntl', 'Clock', 'Nr1d1', 'Nr1d2', 'Dbp', 'Tef', 'Npas2', 'Rorc'];
const TARGET_GENES = ['Myc', 'Ccnd1', 'Ccnb1', 'Cdk1', 'Wee1', 'Cdkn1a', 'Ccne1', 'Ccne2', 'Mcm6', 'Mki67',
  'Lgr5', 'Axin2', 'Ctnnb1', 'Apc', 'Tp53', 'Mdm2', 'Atm', 'Chek2', 'Bcl2', 'Bax', 'Pparg', 'Sirt1', 'Hif1a'];

const GSE54650_TISSUES = [
  'Adrenal', 'Aorta', 'Brainstem', 'Brown_Fat', 'Cerebellum',
  'Heart', 'Hypothalamus', 'Kidney', 'Liver', 'Lung', 'Muscle', 'White_Fat'
];

function fitAR2(series: number[]): number | null {
  const n = series.length;
  if (n < 5) return null;
  const mean = series.reduce((a, b) => a + b, 0) / n;
  const y = series.map(x => x - mean);
  let s11 = 0, s22 = 0, s12 = 0, sy1 = 0, sy2 = 0;
  for (let t = 2; t < n; t++) {
    s11 += y[t - 1] * y[t - 1];
    s22 += y[t - 2] * y[t - 2];
    s12 += y[t - 1] * y[t - 2];
    sy1 += y[t] * y[t - 1];
    sy2 += y[t] * y[t - 2];
  }
  const det = s11 * s22 - s12 * s12;
  if (Math.abs(det) < 1e-10) return null;
  const beta1 = (s22 * sy1 - s12 * sy2) / det;
  const beta2 = (s11 * sy2 - s12 * sy1) / det;
  const disc = beta1 * beta1 + 4 * beta2;
  let ev: number;
  if (disc < 0) {
    ev = Math.sqrt(-beta2);
  } else {
    const r1 = (beta1 + Math.sqrt(disc)) / 2;
    const r2 = (beta1 - Math.sqrt(disc)) / 2;
    ev = Math.max(Math.abs(r1), Math.abs(r2));
  }
  return isFinite(ev) && ev > 0 && ev < 1.5 ? ev : null;
}

function parseCSV(filepath: string): Map<string, number[]> {
  const geneMap = new Map<string, number[]>();
  if (!fs.existsSync(filepath)) return geneMap;
  const lines = fs.readFileSync(filepath, 'utf8').split('\n');
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts.length < 3) continue;
    const gene = parts[0].trim();
    const values = parts.slice(1).map(Number).filter(v => isFinite(v));
    if (gene && values.length >= 5) geneMap.set(gene, values);
  }
  return geneMap;
}

function resolveGene(name: string, geneMap: Map<string, number[]>): number[] | null {
  const lower = name.toLowerCase();
  for (const [key, vals] of geneMap) {
    if (key.toLowerCase() === lower) return vals;
  }
  return null;
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

function quantile(arr: number[], q: number): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const pos = q * (s.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

function mannWhitneyP(a: number[], b: number[]): number {
  if (a.length < 2 || b.length < 2) return 1;
  const combined = [...a.map(v => ({ v, g: 0 })), ...b.map(v => ({ v, g: 1 }))];
  combined.sort((x, y) => x.v - y.v);
  let rank = 1;
  const ranks: number[] = new Array(combined.length);
  let i = 0;
  while (i < combined.length) {
    let j = i;
    while (j < combined.length - 1 && combined[j].v === combined[j + 1].v) j++;
    const avgRank = (rank + rank + (j - i)) / 2;
    for (let k = i; k <= j; k++) ranks[k] = avgRank;
    rank += j - i + 1;
    i = j + 1;
  }
  let R1 = 0;
  for (let k = 0; k < combined.length; k++) if (combined[k].g === 0) R1 += ranks[k];
  const n1 = a.length, n2 = b.length;
  const U = R1 - n1 * (n1 + 1) / 2;
  const muU = n1 * n2 / 2;
  const sigmaU = Math.sqrt(n1 * n2 * (n1 + n2 + 1) / 12);
  if (sigmaU === 0) return 1;
  const z = Math.abs((U - muU) / sigmaU);
  return 2 * (1 - normalCDF(z));
}

function normalCDF(z: number): number {
  const t = 1 / (1 + 0.2316419 * z);
  const poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return 1 - (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-z * z / 2) * poly;
}

function getGroupLambdas(geneMap: Map<string, number[]>, geneList: string[]): number[] {
  const vals: number[] = [];
  for (const gene of geneList) {
    const series = resolveGene(gene, geneMap);
    if (!series) continue;
    const ev = fitAR2(series);
    if (ev !== null) vals.push(ev);
  }
  return vals;
}

function getBackgroundSample(geneMap: Map<string, number[]>, excludeSet: Set<string>, sampleSize = 200): number[] {
  const excludeLower = new Set([...excludeSet].map(g => g.toLowerCase()));
  const vals: number[] = [];
  const keys = [...geneMap.keys()];
  const shuffled = keys.sort(() => Math.random() - 0.5);
  for (const key of shuffled) {
    if (excludeLower.has(key.toLowerCase())) continue;
    const ev = fitAR2(geneMap.get(key)!);
    if (ev !== null) vals.push(ev);
    if (vals.length >= sampleSize) break;
  }
  return vals;
}

function summaryStats(vals: number[]) {
  return {
    n: vals.length,
    median: median(vals),
    q1: quantile(vals, 0.25),
    q3: quantile(vals, 0.75),
    mean: vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0,
  };
}

function timeShuffle(series: number[]): number[] {
  const s = [...series];
  for (let i = s.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [s[i], s[j]] = [s[j], s[i]];
  }
  return s;
}

let cachedResult: CoreEvidenceResult | null = null;

export interface CoreEvidenceResult {
  distributions: {
    clock: number[];
    target: number[];
    background: number[];
    clockStats: ReturnType<typeof summaryStats>;
    targetStats: ReturnType<typeof summaryStats>;
    backgroundStats: ReturnType<typeof summaryStats>;
    pClockVsTarget: number;
    pClockVsBackground: number;
    pTargetVsBackground: number;
  };
  tissues: Array<{
    tissue: string;
    clockMedian: number;
    targetMedian: number;
    backgroundMedian: number;
    clockN: number;
    targetN: number;
  }>;
  permutation: {
    nullDistribution: number[];
    realMedian: number;
    pValue: number;
  };
  bmal1KO: {
    wt: { clockValues: number[]; targetValues: number[]; clockStats: ReturnType<typeof summaryStats>; targetStats: ReturnType<typeof summaryStats> };
    ko: { clockValues: number[]; targetValues: number[]; clockStats: ReturnType<typeof summaryStats>; targetStats: ReturnType<typeof summaryStats> };
    wtGap: number;
    koGap: number;
    hierarchyCollapsed: boolean;
    available: boolean;
  };
}

export async function computeCoreEvidence(): Promise<CoreEvidenceResult> {
  if (cachedResult) return cachedResult;

  const excludeSet = new Set([...CLOCK_GENES, ...TARGET_GENES]);

  const liverPath = path.join(datasetsDir, 'GSE54650_Liver_circadian.csv');
  const liverMap = parseCSV(liverPath);

  const clockVals = getGroupLambdas(liverMap, CLOCK_GENES);
  const targetVals = getGroupLambdas(liverMap, TARGET_GENES);
  const bgVals = getBackgroundSample(liverMap, excludeSet, 300);

  const pClockVsTarget = mannWhitneyP(clockVals, targetVals);
  const pClockVsBackground = mannWhitneyP(clockVals, bgVals);
  const pTargetVsBackground = mannWhitneyP(targetVals, bgVals);

  const tissues: CoreEvidenceResult['tissues'] = [];
  for (const tissue of GSE54650_TISSUES) {
    const tissuePath = path.join(datasetsDir, `GSE54650_${tissue}_circadian.csv`);
    const tm = parseCSV(tissuePath);
    if (tm.size === 0) continue;
    const cv = getGroupLambdas(tm, CLOCK_GENES);
    const tv = getGroupLambdas(tm, TARGET_GENES);
    const bv = getBackgroundSample(tm, excludeSet, 100);
    tissues.push({
      tissue: tissue.replace(/_/g, ' '),
      clockMedian: median(cv),
      targetMedian: median(tv),
      backgroundMedian: median(bv),
      clockN: cv.length,
      targetN: tv.length,
    });
  }

  const realClockMedian = median(clockVals);
  const nullDist: number[] = [];
  const clockSeries: number[][] = [];
  for (const gene of CLOCK_GENES) {
    const s = resolveGene(gene, liverMap);
    if (s) clockSeries.push(s);
  }
  for (let i = 0; i < 500; i++) {
    const shuffledLambdas: number[] = [];
    for (const s of clockSeries) {
      const ev = fitAR2(timeShuffle(s));
      if (ev !== null) shuffledLambdas.push(ev);
    }
    if (shuffledLambdas.length > 0) nullDist.push(median(shuffledLambdas));
  }
  const permP = nullDist.filter(v => v >= realClockMedian).length / nullDist.length;

  let bmal1KO: CoreEvidenceResult['bmal1KO'] = {
    wt: { clockValues: [], targetValues: [], clockStats: summaryStats([]), targetStats: summaryStats([]) },
    ko: { clockValues: [], targetValues: [], clockStats: summaryStats([]), targetStats: summaryStats([]) },
    wtGap: 0, koGap: 0, hierarchyCollapsed: false, available: false,
  };

  const wtPath = path.join(datasetsDir, 'GSE70499_Liver_Bmal1WT_circadian.csv');
  const koPath = path.join(datasetsDir, 'GSE70499_Liver_Bmal1KO_circadian.csv');
  if (fs.existsSync(wtPath) && fs.existsSync(koPath)) {
    const wtMap = parseCSV(wtPath);
    const koMap = parseCSV(koPath);
    const wtClock = getGroupLambdas(wtMap, CLOCK_GENES);
    const wtTarget = getGroupLambdas(wtMap, TARGET_GENES);
    const koClock = getGroupLambdas(koMap, CLOCK_GENES);
    const koTarget = getGroupLambdas(koMap, TARGET_GENES);
    const wtGap = median(wtClock) - median(wtTarget);
    const koGap = median(koClock) - median(koTarget);
    bmal1KO = {
      wt: { clockValues: wtClock, targetValues: wtTarget, clockStats: summaryStats(wtClock), targetStats: summaryStats(wtTarget) },
      ko: { clockValues: koClock, targetValues: koTarget, clockStats: summaryStats(koClock), targetStats: summaryStats(koTarget) },
      wtGap, koGap, hierarchyCollapsed: Math.abs(koGap) < 0.05, available: true,
    };
  }

  cachedResult = {
    distributions: {
      clock: clockVals, target: targetVals, background: bgVals,
      clockStats: summaryStats(clockVals), targetStats: summaryStats(targetVals), backgroundStats: summaryStats(bgVals),
      pClockVsTarget, pClockVsBackground, pTargetVsBackground,
    },
    tissues,
    permutation: { nullDistribution: nullDist, realMedian: realClockMedian, pValue: permP },
    bmal1KO,
  };
  return cachedResult;
}
