import * as fs from 'fs';
import * as path from 'path';

const CLOCK_GENES = new Set([
  'PER1','PER2','PER3','CRY1','CRY2','CLOCK','ARNTL','BMAL1',
  'NR1D1','NR1D2','RORC','DBP','TEF','NPAS2','CIPC','BHLHE40','BHLHE41',
  'RORA','RORB','RORC','CSNK1D','CSNK1E','FBXL3','FBXW11','NFIL3'
]);

function parseCSV(filePath: string): Map<string, number[]> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  const genes = new Map<string, number[]>();
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    const gene = parts[0].trim().replace(/"/g, '');
    const values = parts.slice(1).map(Number).filter(v => !isNaN(v));
    if (values.length >= 8 && !values.every(v => v === 0)) {
      genes.set(gene, values);
    }
  }
  return genes;
}

function olsRegression(X: number[][], y: number[]): { coefficients: number[]; residuals: number[]; stdErrors: number[] } {
  const n = X.length;
  const k = X[0].length;
  const XtX: number[][] = Array.from({ length: k }, () => new Array(k).fill(0));
  const Xty: number[] = new Array(k).fill(0);

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < k; j++) {
      for (let l = 0; l < k; l++) {
        XtX[j][l] += X[i][j] * X[i][l];
      }
      Xty[j] += X[i][j] * y[i];
    }
  }

  const inv = invertMatrix(XtX);
  if (!inv) return { coefficients: new Array(k).fill(0), residuals: y.slice(), stdErrors: new Array(k).fill(Infinity) };

  const beta: number[] = new Array(k).fill(0);
  for (let j = 0; j < k; j++) {
    for (let l = 0; l < k; l++) {
      beta[j] += inv[j][l] * Xty[l];
    }
  }

  const residuals: number[] = [];
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    let pred = 0;
    for (let j = 0; j < k; j++) pred += X[i][j] * beta[j];
    const r = y[i] - pred;
    residuals.push(r);
    ssRes += r * r;
  }

  const sigma2 = ssRes / Math.max(n - k, 1);
  const stdErrors: number[] = new Array(k).fill(Infinity);
  for (let j = 0; j < k; j++) {
    if (inv[j][j] * sigma2 > 0) stdErrors[j] = Math.sqrt(inv[j][j] * sigma2);
  }

  return { coefficients: beta, residuals, stdErrors };
}

function invertMatrix(m: number[][]): number[][] | null {
  const n = m.length;
  const aug: number[][] = m.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => i === j ? 1 : 0)]);
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
    if (Math.abs(aug[col][col]) < 1e-15) return null;
    const pivot = aug[col][col];
    for (let j = 0; j < 2 * n; j++) aug[col][j] /= pivot;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = aug[row][col];
      for (let j = 0; j < 2 * n; j++) aug[row][j] -= factor * aug[col][j];
    }
  }
  return aug.map(row => row.slice(n));
}

function studentTCDF(t: number, df: number): number {
  const x = df / (df + t * t);
  return 1 - 0.5 * incompleteBeta(x, df / 2, 0.5);
}

function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const maxIter = 200;
  let sum = 0, term = 1;
  for (let n = 0; n < maxIter; n++) {
    if (n === 0) {
      term = Math.pow(x, a) * Math.pow(1 - x, b) / (a * beta(a, b));
    } else {
      term *= x * (a + b + n - 1) * (a + n - 1) / ((a + 2 * n - 1) * (a + 2 * n));
      if (n > 1) term *= (n - b) / (a + 2 * n - 2);
    }
    sum += term;
    if (Math.abs(term) < 1e-10) break;
  }
  return Math.min(Math.max(sum, 0), 1);
}

function beta(a: number, b: number): number {
  return Math.exp(logGamma(a) + logGamma(b) - logGamma(a + b));
}

function logGamma(x: number): number {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.001208650973866179, -0.000005395239384953];
  let y = x, tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += c[j] / ++y;
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}

function fitAR2Simple(values: number[]): { r2: number; aic: number; residuals: number[] } {
  const n = values.length - 2;
  if (n < 4) return { r2: 0, aic: Infinity, residuals: [] };

  const y = values.slice(2);
  const X: number[][] = [];
  for (let i = 0; i < n; i++) {
    X.push([1, values[i + 1], values[i]]);
  }

  const reg = olsRegression(X, y);
  const k = 3;
  const ssRes = reg.residuals.reduce((a, r) => a + r * r, 0);
  const yMean = y.reduce((a, v) => a + v, 0) / y.length;
  const ssTot = y.reduce((a, v) => a + (v - yMean) ** 2, 0);
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  const sigma2 = ssRes / n;
  const aic = n * Math.log(Math.max(sigma2, 1e-20)) + 2 * k;
  return { r2, aic, residuals: reg.residuals };
}

function fitAR2WithExogenous(values: number[], exogenous: number[]): { gammaExog: number; gammaPValue: number; r2: number; aic: number; residuals: number[] } {
  const n = values.length - 2;
  if (n < 5) return { gammaExog: 0, gammaPValue: 1, r2: 0, aic: Infinity, residuals: [] };

  const y = values.slice(2);
  const exogLagged = exogenous.slice(1, -1);
  const X: number[][] = [];
  for (let i = 0; i < n; i++) {
    X.push([1, values[i + 1], values[i], exogLagged[i]]);
  }

  const reg = olsRegression(X, y);
  const k = 4;
  const ssRes = reg.residuals.reduce((a, r) => a + r * r, 0);
  const yMean = y.reduce((a, v) => a + v, 0) / y.length;
  const ssTot = y.reduce((a, v) => a + (v - yMean) ** 2, 0);
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  const sigma2 = ssRes / n;
  const aic = n * Math.log(Math.max(sigma2, 1e-20)) + 2 * k;

  const df = n - k;
  const gammaSE = reg.stdErrors ? reg.stdErrors[3] : Infinity;
  const gammaT = gammaSE > 0 && isFinite(gammaSE) ? reg.coefficients[3] / gammaSE : 0;
  const gammaPValue = df > 0 ? 2 * (1 - studentTCDF(Math.abs(gammaT), df)) : 1;

  return { gammaExog: reg.coefficients[3], gammaPValue, r2, aic, residuals: reg.residuals };
}

function fDistCDF(f: number, d1: number, d2: number): number {
  if (f <= 0) return 0;
  const x = d1 * f / (d1 * f + d2);
  return 1 - incompleteBeta(1 - x, d2 / 2, d1 / 2);
}

function benjaminiHochberg(pValues: { index: number; p: number }[]): number[] {
  const n = pValues.length;
  const sorted = [...pValues].sort((a, b) => a.p - b.p);
  const qValues = new Array(n).fill(1);
  let minQ = 1;
  for (let i = n - 1; i >= 0; i--) {
    const rank = i + 1;
    const q = Math.min(sorted[i].p * n / rank, minQ);
    minQ = q;
    qValues[sorted[i].index] = Math.min(q, 1);
  }
  return qValues;
}

function cosinorAmplitude(values: number[], period: number = 24, dt: number = 2): { amplitude: number; phase: number } {
  const n = values.length;
  let sumCos = 0, sumSin = 0, sumY = 0, sumCos2 = 0, sumSin2 = 0, sumCosSin = 0, sumYCos = 0, sumYSin = 0;
  for (let i = 0; i < n; i++) {
    const t = i * dt;
    const c = Math.cos(2 * Math.PI * t / period);
    const s = Math.sin(2 * Math.PI * t / period);
    sumCos += c; sumSin += s; sumY += values[i];
    sumCos2 += c * c; sumSin2 += s * s; sumCosSin += c * s;
    sumYCos += values[i] * c; sumYSin += values[i] * s;
  }

  const det = (sumCos2 - sumCos * sumCos / n) * (sumSin2 - sumSin * sumSin / n) - (sumCosSin - sumCos * sumSin / n) ** 2;
  if (Math.abs(det) < 1e-15) return { amplitude: 0, phase: 0 };

  const yBar = sumY / n;
  const syCos = sumYCos - yBar * sumCos;
  const sySin = sumYSin - yBar * sumSin;
  const sCos2 = sumCos2 - sumCos * sumCos / n;
  const sSin2 = sumSin2 - sumSin * sumSin / n;
  const sCosSin = sumCosSin - sumCos * sumSin / n;

  const betaCos = (syCos * sSin2 - sySin * sCosSin) / det;
  const betaSin = (sySin * sCos2 - syCos * sCosSin) / det;

  const amplitude = Math.sqrt(betaCos * betaCos + betaSin * betaSin);
  const phase = Math.atan2(-betaSin, betaCos) * period / (2 * Math.PI);

  return { amplitude, phase: ((phase % period) + period) % period };
}

export interface RhythmMatchedCouplingResult {
  predictorComparisons: PredictorCouplingResult[];
  summary: {
    arntlCouplingPct: number;
    meanRhythmMatchedCouplingPct: number;
    specificityRatio: number;
    housekeepingCouplingPct: number;
    randomCouplingPct: number;
  };
  amplitudeMatchedControls: AmplitudeMatchedResult[];
  computationTimeMs: number;
}

interface PredictorCouplingResult {
  predictor: string;
  isClockGene: boolean;
  cosinorAmplitude: number;
  cosinorPhase: number;
  coupledGenePct: number;
  coupledGeneCount: number;
  totalGenesAnalyzed: number;
  medianDeltaAIC: number;
  topCoupledGenes: string[];
}

interface AmplitudeMatchedResult {
  predictor: string;
  amplitude: number;
  coupledPct: number;
  isRhythmic: boolean;
}

export function runRhythmMatchedCoupling(datasetFile: string = 'GSE11923_Liver_1h_48h_genes.csv'): RhythmMatchedCouplingResult {
  const startTime = Date.now();
  const filePath = path.join('datasets', datasetFile);
  const geneData = parseCSV(filePath);

  const nTimepoints = geneData.values().next().value?.length || 48;
  const dt = datasetFile.includes('1h') ? 1 : 2;

  const arntlValues = findGene(geneData, 'Arntl');
  if (!arntlValues) throw new Error('ARNTL/BMAL1 not found in dataset');

  const arntlAmp = cosinorAmplitude(arntlValues, 24, dt);

  const clockPredictors = ['Per1', 'Per2', 'Cry1', 'Nr1d1', 'Dbp'];
  const housekeepingPredictors = ['Actb', 'Gapdh', 'Rpl13a', 'Hprt', 'Tbp'];
  const allPredictors = ['Arntl', ...clockPredictors, ...housekeepingPredictors];

  const comparisons: PredictorCouplingResult[] = [];
  const clockGenesLower = new Set([...CLOCK_GENES].map(g => g.toLowerCase()));
  const allGenes = Array.from(geneData.keys()).filter(g => !clockGenesLower.has(g.toLowerCase()));

  for (const predictorName of allPredictors) {
    const predictorValues = findGene(geneData, predictorName);
    if (!predictorValues) continue;

    const amp = cosinorAmplitude(predictorValues, 24, dt);
    const result = runCouplingForPredictor(allGenes, geneData, predictorValues, predictorName);

    comparisons.push({
      predictor: predictorName,
      isClockGene: clockGenesLower.has(predictorName.toLowerCase()),
      cosinorAmplitude: amp.amplitude,
      cosinorPhase: amp.phase,
      ...result
    });
  }

  const amplitudeMatched = findAmplitudeMatchedControls(geneData, arntlValues, arntlAmp.amplitude, allGenes, clockGenesLower, dt);

  const arntlResult = comparisons.find(c => c.predictor === 'Arntl');
  const rhythmMatchedResults = comparisons.filter(c => c.isClockGene && c.predictor !== 'Arntl');
  const hkResults = comparisons.filter(c => housekeepingPredictors.includes(c.predictor));

  const arntlPct = arntlResult?.coupledGenePct || 0;
  const meanRhythm = rhythmMatchedResults.length > 0
    ? rhythmMatchedResults.reduce((s, r) => s + r.coupledGenePct, 0) / rhythmMatchedResults.length : 0;
  const meanHK = hkResults.length > 0
    ? hkResults.reduce((s, r) => s + r.coupledGenePct, 0) / hkResults.length : 0;

  return {
    predictorComparisons: comparisons,
    summary: {
      arntlCouplingPct: arntlPct,
      meanRhythmMatchedCouplingPct: meanRhythm,
      specificityRatio: meanRhythm > 0 ? arntlPct / meanRhythm : 0,
      housekeepingCouplingPct: meanHK,
      randomCouplingPct: meanHK
    },
    amplitudeMatchedControls: amplitudeMatched,
    computationTimeMs: Date.now() - startTime
  };
}

function findGene(geneData: Map<string, number[]>, name: string): number[] | undefined {
  const direct = geneData.get(name);
  if (direct) return direct;
  const lower = name.toLowerCase();
  for (const [gene, values] of geneData) {
    if (gene.toLowerCase() === lower) return values;
  }
  return undefined;
}

function runCouplingForPredictor(
  allGenes: string[],
  geneData: Map<string, number[]>,
  predictorValues: number[],
  predictorName: string
): { coupledGenePct: number; coupledGeneCount: number; totalGenesAnalyzed: number; medianDeltaAIC: number; topCoupledGenes: string[] } {
  const results: { gene: string; deltaAIC: number; fPValue: number }[] = [];

  for (const gene of allGenes) {
    if (gene.toLowerCase() === predictorName.toLowerCase()) continue;
    const values = geneData.get(gene);
    if (!values || values.length < 8) continue;

    const variance = (() => {
      const m = values.reduce((a, b) => a + b, 0) / values.length;
      return values.reduce((a, v) => a + (v - m) ** 2, 0) / values.length;
    })();
    if (variance < 1e-10) continue;

    const uncoupled = fitAR2Simple(values);
    const coupled = fitAR2WithExogenous(values, predictorValues);
    if (uncoupled.residuals.length === 0 || coupled.residuals.length === 0) continue;

    const ssResUnc = uncoupled.residuals.reduce((a, r) => a + r * r, 0);
    const ssResCoup = coupled.residuals.reduce((a, r) => a + r * r, 0);
    const nObs = uncoupled.residuals.length;
    const dfCoupled = nObs - 4;

    let fPValue = 1;
    if (dfCoupled > 0 && ssResCoup > 0) {
      const fStat = ((ssResUnc - ssResCoup) / 1) / (ssResCoup / dfCoupled);
      fPValue = fStat > 0 ? 1 - fDistCDF(fStat, 1, dfCoupled) : 1;
    }

    results.push({ gene, deltaAIC: uncoupled.aic - coupled.aic, fPValue });
  }

  const pValues = results.map((r, i) => ({ index: i, p: r.fPValue }));
  const qValues = benjaminiHochberg(pValues);

  let coupledCount = 0;
  const coupledGenes: { gene: string; deltaAIC: number }[] = [];
  for (let i = 0; i < results.length; i++) {
    if (qValues[i] < 0.05 && results[i].deltaAIC > 2) {
      coupledCount++;
      coupledGenes.push({ gene: results[i].gene, deltaAIC: results[i].deltaAIC });
    }
  }

  coupledGenes.sort((a, b) => b.deltaAIC - a.deltaAIC);
  const deltaAICs = results.map(r => r.deltaAIC).sort((a, b) => a - b);
  const medianDeltaAIC = deltaAICs.length > 0 ? deltaAICs[Math.floor(deltaAICs.length / 2)] : 0;

  return {
    coupledGenePct: results.length > 0 ? (coupledCount / results.length) * 100 : 0,
    coupledGeneCount: coupledCount,
    totalGenesAnalyzed: results.length,
    medianDeltaAIC,
    topCoupledGenes: coupledGenes.slice(0, 10).map(g => g.gene)
  };
}

function findAmplitudeMatchedControls(
  geneData: Map<string, number[]>,
  arntlValues: number[],
  arntlAmplitude: number,
  allGenes: string[],
  clockGenesLower: Set<string>,
  dt: number
): AmplitudeMatchedResult[] {
  const geneAmplitudes: { gene: string; amplitude: number; phase: number; values: number[] }[] = [];

  for (const gene of allGenes) {
    if (clockGenesLower.has(gene.toLowerCase())) continue;
    const values = geneData.get(gene);
    if (!values || values.length < 8) continue;
    const amp = cosinorAmplitude(values, 24, dt);
    geneAmplitudes.push({ gene, amplitude: amp.amplitude, phase: amp.phase, values });
  }

  geneAmplitudes.sort((a, b) => Math.abs(a.amplitude - arntlAmplitude) - Math.abs(b.amplitude - arntlAmplitude));

  const tolerance = arntlAmplitude * 0.25;
  const matched = geneAmplitudes.filter(g => Math.abs(g.amplitude - arntlAmplitude) <= tolerance).slice(0, 30);

  const results: AmplitudeMatchedResult[] = [];
  for (const control of matched.slice(0, 10)) {
    const coupling = runCouplingForPredictor(
      allGenes.filter(g => g !== control.gene),
      geneData,
      control.values,
      control.gene
    );
    results.push({
      predictor: control.gene,
      amplitude: control.amplitude,
      coupledPct: coupling.coupledGenePct,
      isRhythmic: control.amplitude > arntlAmplitude * 0.3
    });
  }

  return results;
}
