/**
 * Coupling ROC/PR Benchmarking
 * 
 * Evaluates whether PAR(2) coupling scores separate experimentally validated
 * clock–target pairs (positives) from phase-aligned non-causal pairs (negatives)
 * better than simpler baseline methods.
 * 
 * Methods compared:
 *   1. PAR(2) coupling: delta-AIC from coupled vs uncoupled AR(2) model
 *   2. Phase correlation: absolute cosinor peak-phase difference
 *   3. Cross-correlation: maximum |xcorr| at lags -2..+2
 *   4. Static Pearson: |r| between raw time series
 */

import * as fs from 'fs';
import { parse } from 'csv-parse/sync';
import * as path from 'path';

// ── Gold-standard pair definitions ──────────────────────────────────────────

export const POSITIVE_PAIRS = [
  { predictor: 'Arntl', target: 'Wee1',   citation: 'Matsuo 2003 Science',        evidence: 'BMAL1/CLOCK E-box directly activates Wee1 transcription' },
  { predictor: 'Arntl', target: 'Dbp',    citation: 'Falvey 1995; Ripperger 2000', evidence: 'Canonical BMAL1/CLOCK E-box output gene' },
  { predictor: 'Clock', target: 'Dbp',    citation: 'Falvey 1995',                 evidence: 'CLOCK/BMAL1 heterodimer activates Dbp' },
  { predictor: 'Nr1d1', target: 'Arntl',  citation: 'Preitner 2002 Cell',          evidence: 'REV-ERBα directly represses Bmal1 via RORE' },
  { predictor: 'Nr1d2', target: 'Arntl',  citation: 'Guillaumond 2005',            evidence: 'REV-ERBβ functional redundancy at Bmal1 RORE' },
  { predictor: 'Arntl', target: 'Cdkn1a', citation: 'Grechez-Cassiau 2008 JBC',    evidence: 'BMAL1 drives p21 expression in liver' },
  { predictor: 'Arntl', target: 'Myc',    citation: 'Fu 2002 Cell; Altman 2015',   evidence: 'E-box in Myc promoter; functional CLOCK/BMAL1 activation' },
  { predictor: 'Cry1',  target: 'Clock',  citation: 'Kume 1999 Cell',              evidence: 'CRY1 represses CLOCK/BMAL1 heterodimer (core negative feedback)' },
  { predictor: 'Per2',  target: 'Arntl',  citation: 'Shearman 2000 Science',       evidence: 'PER/CRY complex represses CLOCK/BMAL1 including Bmal1 locus' },
  { predictor: 'Per1',  target: 'Arntl',  citation: 'Shearman 2000',               evidence: 'PER complex contributes to Bmal1 transcriptional repression' },
  { predictor: 'Arntl', target: 'Ccnd1',  citation: 'Jiang 2016; Fu 2002',         evidence: 'BMAL1 regulates Cyclin D1 expression' },
  { predictor: 'Nr1d1', target: 'Ccnd1',  citation: 'Duez 2012; Jiang 2016',       evidence: 'REV-ERBα regulates Ccnd1 expression in liver' },
  { predictor: 'Arntl', target: 'Tef',    citation: 'Falvey 1996; Gachon 2004',    evidence: 'Direct BMAL1/CLOCK E-box activation of PAR-bZip output gene' },
  { predictor: 'Clock', target: 'Cry1',   citation: 'Jin 1999 Cell',               evidence: 'CLOCK/BMAL1 activates Cry1 (core positive arm)' },
  { predictor: 'Cry2',  target: 'Arntl',  citation: 'van der Horst 1999',          evidence: 'CRY2 represses BMAL1-driven transcription' },
];

export const NEGATIVE_PAIRS = [
  { predictor: 'Gys2',   target: 'Wee1',   reason: 'Glycogen synthase; phase-similar in liver, no clock→Wee1 regulatory link' },
  { predictor: 'Hmgcr',  target: 'Dbp',    reason: 'Cholesterol synthesis; co-expressed in liver, not a transcriptional driver of Dbp' },
  { predictor: 'Fasn',   target: 'Arntl',  reason: 'Fatty acid synthase; diurnally expressed but no known input to Bmal1 promoter' },
  { predictor: 'Pck1',   target: 'Wee1',   reason: 'PEPCK gluconeogenic enzyme; liver-specific, not in Wee1 circadian circuit' },
  { predictor: 'Scd1',   target: 'Cdkn1a', reason: 'Stearoyl-CoA desaturase; lipid gene, no link to p21' },
  { predictor: 'Apoe',   target: 'Myc',    reason: 'Apolipoprotein E; liver-abundant, not a transcriptional activator of Myc' },
  { predictor: 'G6pc',   target: 'Dbp',    reason: 'Glucose-6-phosphatase; glucoregulatory, not a driver of Dbp transcription' },
  { predictor: 'Cyp7a1', target: 'Arntl',  reason: 'Bile acid synthesis; liver-specific, not known to regulate Bmal1' },
  { predictor: 'Acly',   target: 'Wee1',   reason: 'ATP citrate lyase; metabolic enzyme, no Wee1 regulatory link' },
  { predictor: 'Aldob',  target: 'Dbp',    reason: 'Aldolase B; glycolytic, liver-specific, not a Dbp regulator' },
  { predictor: 'Acaca',  target: 'Cdkn1a', reason: 'Acetyl-CoA carboxylase; fatty acid synthesis, no p21 link' },
  { predictor: 'Elovl6', target: 'Myc',    reason: 'Fatty acid elongase; liver lipid metabolism, no Myc regulatory link' },
  { predictor: 'Dgat1',  target: 'Arntl',  reason: 'Diacylglycerol acyltransferase; triglyceride synthesis, not a Bmal1 regulator' },
  { predictor: 'Hadha',  target: 'Wee1',   reason: 'Mitochondrial beta-oxidation enzyme; no Wee1 regulatory link' },
  { predictor: 'Alb',    target: 'Ccnd1',  reason: 'Albumin; most abundant liver protein, no causal link to Cyclin D1' },
];

// ── OLS helpers ──────────────────────────────────────────────────────────────

function gaussianElim(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) maxRow = row;
    }
    [M[col], M[maxRow]] = [M[maxRow], M[col]];
    if (Math.abs(M[col][col]) < 1e-12) continue;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = M[row][col] / M[col][col];
      for (let k = col; k <= n; k++) M[row][k] -= factor * M[col][k];
    }
  }
  return M.map((row, i) => (Math.abs(M[i][i]) > 1e-12 ? row[n] / M[i][i] : 0));
}

function fitOLS(X: number[][], y: number[]): { coef: number[]; rss: number; n: number; k: number } {
  const n = y.length;
  const k = X[0].length;
  const XtX: number[][] = Array.from({ length: k }, () => new Array(k).fill(0));
  const Xty: number[] = new Array(k).fill(0);
  for (let t = 0; t < n; t++) {
    for (let i = 0; i < k; i++) {
      Xty[i] += X[t][i] * y[t];
      for (let j = 0; j < k; j++) XtX[i][j] += X[t][i] * X[t][j];
    }
  }
  const coef = gaussianElim(XtX, Xty);
  let rss = 0;
  for (let t = 0; t < n; t++) {
    let yhat = 0;
    for (let i = 0; i < k; i++) yhat += coef[i] * X[t][i];
    rss += (y[t] - yhat) ** 2;
  }
  return { coef, rss, n, k };
}

function aic(rss: number, n: number, k: number): number {
  if (rss <= 0 || n <= k) return Infinity;
  return n * Math.log(rss / n) + 2 * k;
}

// ── Cosinor fit ──────────────────────────────────────────────────────────────

function cosinorFit(values: number[], timepoints: number[]): { phase: number; amplitude: number; mesor: number } {
  const T = 24;
  const n = values.length;
  const X: number[][] = timepoints.map(t => [1, Math.cos(2 * Math.PI * t / T), Math.sin(2 * Math.PI * t / T)]);
  const { coef } = fitOLS(X, values);
  const [mesor, b, c] = coef;
  const amplitude = Math.sqrt(b * b + c * c);
  const phase = Math.atan2(c, b);
  return { phase, amplitude, mesor };
}

function phaseDiff(phA: number, phB: number): number {
  let d = Math.abs(phA - phB) % (2 * Math.PI);
  if (d > Math.PI) d = 2 * Math.PI - d;
  return d;
}

// ── Cross-correlation ────────────────────────────────────────────────────────

function pearson(a: number[], b: number[]): number {
  const n = a.length;
  const ma = a.reduce((s, v) => s + v, 0) / n;
  const mb = b.reduce((s, v) => s + v, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return da > 0 && db > 0 ? num / Math.sqrt(da * db) : 0;
}

function maxCrossCorr(a: number[], b: number[], maxLag = 2): number {
  let maxAbs = 0;
  for (let lag = -maxLag; lag <= maxLag; lag++) {
    const aSlice = lag >= 0 ? a.slice(0, a.length - lag) : a.slice(-lag);
    const bSlice = lag >= 0 ? b.slice(lag) : b.slice(0, b.length + lag);
    if (aSlice.length < 3) continue;
    maxAbs = Math.max(maxAbs, Math.abs(pearson(aSlice, bSlice)));
  }
  return maxAbs;
}

// ── PAR(2) coupling delta-AIC ────────────────────────────────────────────────

function couplingDeltaAIC(predictor: number[], target: number[]): number {
  // Uses lags 1 and 2 of target, and lag 1 of predictor as exogenous
  const T = target.length;
  if (T < 5) return 0;
  const yObs: number[] = [];
  const Xunc: number[][] = [];
  const Xcoup: number[][] = [];
  for (let t = 2; t < T; t++) {
    yObs.push(target[t]);
    Xunc.push([target[t - 1], target[t - 2]]);
    Xcoup.push([target[t - 1], target[t - 2], predictor[t - 1]]);
  }
  const n = yObs.length;
  const uncoupled = fitOLS(Xunc, yObs);
  const coupled   = fitOLS(Xcoup, yObs);
  return aic(coupled.rss, n, 3) - aic(uncoupled.rss, n, 2);
}

// ── ROC / AUC ────────────────────────────────────────────────────────────────

function rocAuc(posScores: number[], negScores: number[]): number {
  const all = [
    ...posScores.map(s => ({ s, label: 1 })),
    ...negScores.map(s => ({ s, label: 0 })),
  ].sort((a, b) => b.s - a.s);

  const nPos = posScores.length;
  const nNeg = negScores.length;
  if (nPos === 0 || nNeg === 0) return 0.5;

  let auc = 0;
  let tp = 0; let fp = 0;
  let prevTp = 0; let prevFp = 0;
  for (const item of all) {
    if (item.label === 1) tp++;
    else {
      fp++;
      auc += ((tp + prevTp) / 2) * (fp - prevFp);
      prevTp = tp;
      prevFp = fp;
    }
  }
  return auc / (nPos * nNeg);
}

function rocCurve(posScores: number[], negScores: number[]): { fpr: number; tpr: number }[] {
  const all = [
    ...posScores.map(s => ({ s, label: 1 })),
    ...negScores.map(s => ({ s, label: 0 })),
  ].sort((a, b) => b.s - a.s);
  const nPos = posScores.length;
  const nNeg = negScores.length;
  const pts: { fpr: number; tpr: number }[] = [{ fpr: 0, tpr: 0 }];
  let tp = 0; let fp = 0;
  for (const item of all) {
    if (item.label === 1) tp++;
    else fp++;
    pts.push({ fpr: fp / nNeg, tpr: tp / nPos });
  }
  return pts;
}

function prCurve(posScores: number[], negScores: number[]): { recall: number; precision: number }[] {
  const all = [
    ...posScores.map(s => ({ s, label: 1 })),
    ...negScores.map(s => ({ s, label: 0 })),
  ].sort((a, b) => b.s - a.s);
  const nPos = posScores.length;
  const pts: { recall: number; precision: number }[] = [];
  let tp = 0; let fp = 0;
  for (const item of all) {
    if (item.label === 1) tp++;
    else fp++;
    pts.push({ recall: tp / nPos, precision: tp / (tp + fp) });
  }
  return pts;
}

function prAuc(posScores: number[], negScores: number[]): number {
  const curve = prCurve(posScores, negScores);
  if (curve.length < 2) return 0;
  let area = 0;
  for (let i = 1; i < curve.length; i++) {
    area += (curve[i].recall - curve[i - 1].recall) * (curve[i].precision + curve[i - 1].precision) / 2;
  }
  return Math.abs(area);
}

function bootstrapAucCI(posScores: number[], negScores: number[], nBoot = 1000): { lower: number; upper: number; mean: number } {
  const aucs: number[] = [];
  for (let b = 0; b < nBoot; b++) {
    const bPos = Array.from({ length: posScores.length }, () => posScores[Math.floor(Math.random() * posScores.length)]);
    const bNeg = Array.from({ length: negScores.length }, () => negScores[Math.floor(Math.random() * negScores.length)]);
    aucs.push(rocAuc(bPos, bNeg));
  }
  aucs.sort((a, b) => a - b);
  return {
    lower: aucs[Math.floor(0.025 * nBoot)],
    upper: aucs[Math.floor(0.975 * nBoot)],
    mean: aucs.reduce((s, v) => s + v, 0) / nBoot,
  };
}

// ── Dataset loader ────────────────────────────────────────────────────────────

function loadLiverDataset(): Map<string, number[]> {
  const filePath = path.join(process.cwd(), 'datasets', 'GSE54650_Liver_circadian.csv');
  const content = fs.readFileSync(filePath, 'utf-8');
  const records = parse(content, { columns: true, skip_empty_lines: true }) as Record<string, string>[];
  const geneData = new Map<string, number[]>();
  for (const record of records) {
    const gene = record.Gene || record.gene || Object.values(record)[0];
    if (!gene) continue;
    const values = Object.entries(record)
      .filter(([k]) => k !== 'Gene' && k !== 'gene')
      .map(([, v]) => parseFloat(v))
      .filter(v => !isNaN(v));
    if (values.length > 0) geneData.set(gene, values);
  }
  return geneData;
}

function getTimepoints(geneData: Map<string, number[]>): number[] {
  const filePath = path.join(process.cwd(), 'datasets', 'GSE54650_Liver_circadian.csv');
  const content = fs.readFileSync(filePath, 'utf-8');
  const records = parse(content, { columns: true, skip_empty_lines: true }) as Record<string, string>[];
  if (records.length === 0) return [];
  const headers = Object.keys(records[0]).filter(k => k !== 'Gene' && k !== 'gene');
  return headers.map(h => {
    const m = h.match(/CT(\d+)/i) || h.match(/(\d+)/);
    return m ? parseInt(m[1]) : 0;
  });
}

// ── Main analysis ─────────────────────────────────────────────────────────────

export interface PairScore {
  predictor: string;
  target: string;
  label: 1 | 0;
  note: string;
  par2DeltaAIC: number;
  par2Score: number;
  phaseDiffRad: number;
  phaseScore: number;
  xcorrPeak: number;
  pearsonAbs: number;
  predictorFound: boolean;
  targetFound: boolean;
}

export interface CouplingROCResult {
  methods: {
    name: string;
    key: string;
    description: string;
    auc: number;
    aucCI: { lower: number; upper: number };
    prAuc: number;
    rocCurve: { fpr: number; tpr: number }[];
    prCurve: { recall: number; precision: number }[];
  }[];
  pairScores: PairScore[];
  nPositive: number;
  nNegative: number;
  nPositiveUsed: number;
  nNegativeUsed: number;
  dataset: string;
  nTimepoints: number;
}

let _cachedResult: CouplingROCResult | null = null;

export function runCouplingROC(): CouplingROCResult {
  if (_cachedResult) return _cachedResult;

  const geneData = loadLiverDataset();
  const timepoints = getTimepoints(geneData);

  const pairScores: PairScore[] = [];

  // Process positive pairs
  for (const pair of POSITIVE_PAIRS) {
    const predSeries = geneData.get(pair.predictor);
    const targSeries = geneData.get(pair.target);
    const found = !!predSeries && !!targSeries;
    if (!found) {
      pairScores.push({
        predictor: pair.predictor, target: pair.target, label: 1,
        note: pair.citation,
        par2DeltaAIC: 0, par2Score: 0,
        phaseDiffRad: 0, phaseScore: 0,
        xcorrPeak: 0, pearsonAbs: 0,
        predictorFound: !!predSeries, targetFound: !!targSeries,
      });
      continue;
    }
    const daic = couplingDeltaAIC(predSeries, targSeries);
    const cosPred = cosinorFit(predSeries, timepoints);
    const cosTarg = cosinorFit(targSeries, timepoints);
    const phDiff = phaseDiff(cosPred.phase, cosTarg.phase);
    const xcorr = maxCrossCorr(predSeries, targSeries);
    const pAbs = Math.abs(pearson(predSeries, targSeries));
    pairScores.push({
      predictor: pair.predictor, target: pair.target, label: 1,
      note: pair.citation,
      par2DeltaAIC: daic, par2Score: -daic,
      phaseDiffRad: phDiff, phaseScore: -phDiff,
      xcorrPeak: xcorr, pearsonAbs: pAbs,
      predictorFound: true, targetFound: true,
    });
  }

  // Process negative pairs
  for (const pair of NEGATIVE_PAIRS) {
    const predSeries = geneData.get(pair.predictor);
    const targSeries = geneData.get(pair.target);
    const found = !!predSeries && !!targSeries;
    if (!found) {
      pairScores.push({
        predictor: pair.predictor, target: pair.target, label: 0,
        note: pair.reason,
        par2DeltaAIC: 0, par2Score: 0,
        phaseDiffRad: 0, phaseScore: 0,
        xcorrPeak: 0, pearsonAbs: 0,
        predictorFound: !!predSeries, targetFound: !!targSeries,
      });
      continue;
    }
    const daic = couplingDeltaAIC(predSeries, targSeries);
    const cosPred = cosinorFit(predSeries, timepoints);
    const cosTarg = cosinorFit(targSeries, timepoints);
    const phDiff = phaseDiff(cosPred.phase, cosTarg.phase);
    const xcorr = maxCrossCorr(predSeries, targSeries);
    const pAbs = Math.abs(pearson(predSeries, targSeries));
    pairScores.push({
      predictor: pair.predictor, target: pair.target, label: 0,
      note: pair.reason,
      par2DeltaAIC: daic, par2Score: -daic,
      phaseDiffRad: phDiff, phaseScore: -phDiff,
      xcorrPeak: xcorr, pearsonAbs: pAbs,
      predictorFound: true, targetFound: true,
    });
  }

  const usablePairs = pairScores.filter(p => p.predictorFound && p.targetFound);
  const pos = usablePairs.filter(p => p.label === 1);
  const neg = usablePairs.filter(p => p.label === 0);

  function buildMethod(name: string, key: string, description: string, scoreKey: keyof PairScore) {
    const posScores = pos.map(p => p[scoreKey] as number);
    const negScores = neg.map(p => p[scoreKey] as number);
    const auc = rocAuc(posScores, negScores);
    const aucCI = bootstrapAucCI(posScores, negScores, 2000);
    const prauc = prAuc(posScores, negScores);
    return {
      name, key, description,
      auc, aucCI, prAuc: prauc,
      rocCurve: rocCurve(posScores, negScores),
      prCurve: prCurve(posScores, negScores),
    };
  }

  const methods = [
    buildMethod('PAR(2) Coupling (ΔAICc)', 'par2', 'Delta-AIC: coupled AR(2)+exogenous vs uncoupled AR(2). More negative = stronger coupling.', 'par2Score'),
    buildMethod('Phase Correlation', 'phase', 'Negative cosinor peak-phase difference (radians). Less phase offset = more correlated timing.', 'phaseScore'),
    buildMethod('Cross-Correlation (peak)', 'xcorr', 'Maximum |Pearson r| across lags −2 to +2 timepoints.', 'xcorrPeak'),
    buildMethod('Static Pearson |r|', 'pearson', 'Absolute Pearson correlation between raw time series (no lag).', 'pearsonAbs'),
  ];

  _cachedResult = {
    methods,
    pairScores,
    nPositive: POSITIVE_PAIRS.length,
    nNegative: NEGATIVE_PAIRS.length,
    nPositiveUsed: pos.length,
    nNegativeUsed: neg.length,
    dataset: 'GSE54650 (Mouse Liver, 24 timepoints, 20,954 genes)',
    nTimepoints: timepoints.length,
  };
  return _cachedResult;
}
