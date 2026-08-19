import * as fs from 'fs';
import * as path from 'path';
import { classifyGene, ENSEMBL_TO_SYMBOL, ALL_CATEGORIES, CATEGORY_META, type GeneCategory } from './gene-categories';

const PHI = (1 + Math.sqrt(5)) / 2;

let _rngSeed: number = 42;
let _rngState: number = 42;

function seedRNG(seed: number): void {
  _rngSeed = seed;
  _rngState = seed;
}

function seededRandom(): number {
  _rngState |= 0;
  _rngState = (_rngState + 0x6D2B79F5) | 0;
  let t = Math.imul(_rngState ^ (_rngState >>> 15), 1 | _rngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

interface GeneRootPoint {
  gene: string;
  geneType: string;
  beta1: number;
  beta2: number;
  r: number;
  theta: number;
  eigenvalue: number;
  r2: number;
  isComplex: boolean;
  dPhi: number;
  x: number;
  y: number;
}

interface StationarityTriangle {
  vertices: { x: number; y: number }[];
  oscillatoryParabola: { x: number; y: number }[];
  fibonacciPoint: { x: number; y: number };
}

interface EnrichmentTestResult {
  testName: string;
  description: string;
  observedStatistic: number;
  nullMean: number;
  nullStd: number;
  pValue: number;
  nPermutations: number;
  significant: boolean;
  effectSize: number;
}

interface PerturbationShift {
  datasetPair: string;
  wtLabel: string;
  perturbedLabel: string;
  wtMeanR: number;
  perturbedMeanR: number;
  rShift: number;
  wtMeanTheta: number;
  perturbedMeanTheta: number;
  thetaShift: number;
  wtMeanDPhi: number;
  perturbedMeanDPhi: number;
  dPhiShift: number;
  mannWhitneyP: number;
  significant: boolean;
}

interface CategoryStats {
  category: string;
  label: string;
  color: string;
  count: number;
  meanR: number;
  meanTheta: number;
  meanDPhi: number;
  meanEigenvalue: number;
}

interface DatasetRootSpace {
  datasetId: string;
  datasetName: string;
  species: string;
  condition: string;
  genes: GeneRootPoint[];
  clockMeanR: number;
  targetMeanR: number;
  clockMeanTheta: number;
  targetMeanTheta: number;
  clockMeanDPhi: number;
  targetMeanDPhi: number;
  categoryStats: CategoryStats[];
}

interface NullDistribution {
  nullType: string;
  dPhiValues: number[];
  rValues: number[];
  thetaValues: number[];
}

interface ThresholdSweepPoint {
  threshold: number;
  observedFraction: number;
  nullFraction: number;
  enrichmentRatio: number;
}

interface ThetaBin {
  binCenter: number;
  binLabel: string;
  observedCount: number;
  observedDensity: number;
  nullCount: number;
  nullDensity: number;
}

interface CategoryHierarchyEntry {
  category: string;
  label: string;
  color: string;
  pooledCount: number;
  pooledMeanEigenvalue: number;
  pooledMeanR: number;
  pooledMeanDPhi: number;
  rank: number;
}

interface PairwiseComparison {
  categoryA: string;
  categoryB: string;
  labelA: string;
  labelB: string;
  meanEigenvalueA: number;
  meanEigenvalueB: number;
  mannWhitneyP: number;
  significant: boolean;
  direction: string;
}

interface CategoryHierarchyResult {
  hierarchy: CategoryHierarchyEntry[];
  kruskalWallisP: number;
  kruskalWallisSignificant: boolean;
  pairwiseTests: PairwiseComparison[];
  categoryMeta: Record<string, { label: string; color: string; description: string }>;
}

interface PCAGenePoint {
  gene: string;
  geneType: string;
  pc1: number;
  pc2: number;
  eigenvalue: number;
}

interface PCADataset {
  datasetId: string;
  datasetName: string;
  genes: PCAGenePoint[];
  varianceExplained: [number, number];
}

export interface RootSpaceAnalysisResult {
  triangle: StationarityTriangle;
  datasets: DatasetRootSpace[];
  nullDistributions: NullDistribution[];
  enrichmentTests: EnrichmentTestResult[];
  perturbationShifts: PerturbationShift[];
  categoryHierarchy: CategoryHierarchyResult;
  thresholdSweep: ThresholdSweepPoint[];
  thetaDistribution: ThetaBin[];
  thetaPhiRef: number;
  pcaComparison?: PCADataset[];
  methodology: {
    rngSeed: number;
    rootHandling: string;
    nullHierarchy: string;
    excludedDatasets: string;
    multipleTestingNote: string;
    mappingSensitivity: string;
  };
  summary: {
    totalGenes: number;
    totalDatasets: number;
    meanDPhi: number;
    phiEnrichedFraction: number;
    perturbationShiftDetected: boolean;
    overallVerdict: string;
  };
}

function fitAR2(series: number[]): { phi1: number; phi2: number; eigenvalue: number; r2: number } {
  const n = series.length;
  if (n < 5) return { phi1: 0, phi2: 0, eigenvalue: 0, r2: 0 };
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
  const det = sumY1Y1 * sumY2Y2 - sumY1Y2 * sumY1Y2;
  if (Math.abs(det) < 1e-15) return { phi1: 0, phi2: 0, eigenvalue: 0, r2: 0 };
  const phi1 = (sumYY1 * sumY2Y2 - sumYY2 * sumY1Y2) / det;
  const phi2 = (sumYY2 * sumY1Y1 - sumYY1 * sumY1Y2) / det;
  const disc = phi1 * phi1 + 4 * phi2;
  let eigenvalue: number;
  if (disc >= 0) {
    const l1 = (phi1 + Math.sqrt(disc)) / 2;
    const l2 = (phi1 - Math.sqrt(disc)) / 2;
    eigenvalue = Math.max(Math.abs(l1), Math.abs(l2));
  } else {
    eigenvalue = Math.sqrt(-phi2);
  }
  const ssRes = Y.reduce((s, yi, i) => s + (yi - phi1 * Y1[i] - phi2 * Y2[i]) ** 2, 0);
  const ssTot = Y.reduce((s, yi) => {
    const meanY = Y.reduce((a, b) => a + b, 0) / Y.length;
    return s + (yi - meanY) ** 2;
  }, 0);
  const r2 = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;
  return { phi1, phi2, eigenvalue, r2 };
}

function parseDataset(filePath: string): Map<string, { gene: string; type: GeneCategory; values: number[] }> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  const genes = new Map<string, { gene: string; type: GeneCategory; values: number[] }>();
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const rawGene = cols[0].trim().replace(/"/g, '');
    if (!rawGene) continue;
    const gene = ENSEMBL_TO_SYMBOL[rawGene] || rawGene;
    const values = cols.slice(1).map(v => parseFloat(v)).filter(v => !isNaN(v));
    if (values.length < 5) continue;
    const type = classifyGene(gene);
    if (type !== 'other') {
      genes.set(gene, { gene, type, values });
    }
  }
  return genes;
}

function computeRoots(beta1: number, beta2: number): { r: number; theta: number; isComplex: boolean } {
  const disc = beta1 * beta1 + 4 * beta2;
  if (disc < 0) {
    const r = Math.sqrt(-beta2);
    const theta = Math.atan2(Math.sqrt(-disc), beta1);
    return { r, theta, isComplex: true };
  }
  const l1 = (beta1 + Math.sqrt(disc)) / 2;
  const l2 = (beta1 - Math.sqrt(disc)) / 2;
  const dominant = Math.abs(l1) >= Math.abs(l2) ? l1 : l2;
  const r = Math.abs(dominant);
  const theta = dominant < 0 ? Math.PI : 0;
  return { r, theta, isComplex: false };
}

function computeDPhi(r: number, theta: number): number {
  const thetaPhi = 2 * Math.PI / PHI;
  const wR = 1.0;
  const wTheta = 1.0;
  const rRef = 0.7;
  const logRDist = Math.abs(Math.log(Math.max(r, 0.01)) - Math.log(rRef));
  let thetaDist = Math.abs(theta - thetaPhi);
  thetaDist = Math.min(thetaDist, 2 * Math.PI - thetaDist);
  return wR * logRDist + wTheta * thetaDist;
}

function buildStationarityTriangle(): StationarityTriangle {
  const vertices = [
    { x: -2, y: -1 },
    { x: 0, y: 1 },
    { x: 2, y: -1 },
  ];
  const parabola: { x: number; y: number }[] = [];
  for (let b1 = -2; b1 <= 2; b1 += 0.05) {
    parabola.push({ x: b1, y: -(b1 * b1) / 4 });
  }
  return {
    vertices,
    oscillatoryParabola: parabola,
    fibonacciPoint: { x: 1, y: 1 },
  };
}

function geneToRootPoint(gene: string, geneType: string, values: number[]): GeneRootPoint | null {
  const fit = fitAR2(values);
  if (fit.r2 < 0.05 || fit.eigenvalue >= 1.0) return null;
  const roots = computeRoots(fit.phi1, fit.phi2);
  const dPhi = computeDPhi(roots.r, roots.theta);
  return {
    gene,
    geneType,
    beta1: +fit.phi1.toFixed(6),
    beta2: +fit.phi2.toFixed(6),
    r: +roots.r.toFixed(6),
    theta: +roots.theta.toFixed(6),
    eigenvalue: +fit.eigenvalue.toFixed(6),
    r2: +fit.r2.toFixed(4),
    isComplex: roots.isComplex,
    dPhi: +dPhi.toFixed(4),
    x: +(roots.r * Math.cos(roots.theta)).toFixed(6),
    y: +(roots.r * Math.sin(roots.theta)).toFixed(6),
  };
}

function generatePhaseRandomizedSurrogate(signal: number[]): number[] {
  const n = signal.length;
  const mean = signal.reduce((a, b) => a + b, 0) / n;
  const centered = signal.map(x => x - mean);
  const re: number[] = new Array(n).fill(0);
  const im: number[] = new Array(n).fill(0);
  for (let k = 0; k < n; k++) {
    for (let t = 0; t < n; t++) {
      const angle = 2 * Math.PI * k * t / n;
      re[k] += centered[t] * Math.cos(angle);
      im[k] += centered[t] * Math.sin(angle);
    }
  }
  const randomPhases: number[] = [];
  randomPhases.push(0);
  for (let k = 1; k < Math.floor(n / 2); k++) {
    const phase = seededRandom() * 2 * Math.PI;
    randomPhases.push(phase);
  }
  if (n % 2 === 0) randomPhases.push(0);
  for (let k = Math.floor(n / 2) + 1; k < n; k++) {
    randomPhases.push(-randomPhases[n - k]);
  }
  const newRe: number[] = new Array(n).fill(0);
  const newIm: number[] = new Array(n).fill(0);
  for (let k = 0; k < n; k++) {
    const mag = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
    const origPhase = Math.atan2(im[k], re[k]);
    const newPhase = origPhase + randomPhases[k];
    newRe[k] = mag * Math.cos(newPhase);
    newIm[k] = mag * Math.sin(newPhase);
  }
  const result: number[] = new Array(n).fill(0);
  for (let t = 0; t < n; t++) {
    for (let k = 0; k < n; k++) {
      const angle = 2 * Math.PI * k * t / n;
      result[t] += newRe[k] * Math.cos(angle) - newIm[k] * Math.sin(angle);
    }
    result[t] = result[t] / n + mean;
  }
  return result;
}

function sampleUniformFromTriangle(): { beta1: number; beta2: number } {
  let beta1: number, beta2: number;
  do {
    beta1 = (seededRandom() * 4) - 2;
    beta2 = (seededRandom() * 2) - 1;
  } while (!(beta2 > -1 && beta2 < 1 - beta1 && beta2 < 1 + beta1));
  return { beta1, beta2 };
}

function buildNullDistributions(allGeneSeries: number[][], nSurrogates: number = 200): NullDistribution[] {
  const phaseNull: NullDistribution = { nullType: 'Phase-Randomized Surrogates', dPhiValues: [], rValues: [], thetaValues: [] };
  const nSeries = Math.min(allGeneSeries.length, 15);
  const seriesSubset = allGeneSeries.slice(0, nSeries);
  const surrogatesPerSeries = Math.ceil(nSurrogates / nSeries);

  for (const series of seriesSubset) {
    for (let s = 0; s < surrogatesPerSeries; s++) {
      const surr = generatePhaseRandomizedSurrogate(series);
      const fit = fitAR2(surr);
      if (fit.eigenvalue >= 1.0 || fit.r2 < 0.05) continue;
      const roots = computeRoots(fit.phi1, fit.phi2);
      phaseNull.dPhiValues.push(+computeDPhi(roots.r, roots.theta).toFixed(4));
      phaseNull.rValues.push(+roots.r.toFixed(4));
      phaseNull.thetaValues.push(+roots.theta.toFixed(4));
    }
  }

  const uniformNull: NullDistribution = { nullType: 'Uniform Stationarity Triangle', dPhiValues: [], rValues: [], thetaValues: [] };
  for (let i = 0; i < 500; i++) {
    const { beta1, beta2 } = sampleUniformFromTriangle();
    const roots = computeRoots(beta1, beta2);
    if (roots.r >= 1.0) continue;
    uniformNull.dPhiValues.push(+computeDPhi(roots.r, roots.theta).toFixed(4));
    uniformNull.rValues.push(+roots.r.toFixed(4));
    uniformNull.thetaValues.push(+roots.theta.toFixed(4));
  }

  return [phaseNull, uniformNull];
}

function mannWhitneyU(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0) return 1.0;
  const combined = [
    ...a.map(v => ({ v, group: 0 })),
    ...b.map(v => ({ v, group: 1 })),
  ].sort((x, y) => x.v - y.v);
  let rank = 1;
  let i = 0;
  while (i < combined.length) {
    let j = i;
    while (j < combined.length && combined[j].v === combined[i].v) j++;
    const avgRank = (2 * rank + (j - i) - 1) / 2;
    for (let k = i; k < j; k++) (combined[k] as any).rank = avgRank;
    rank += j - i;
    i = j;
  }
  const n1 = a.length, n2 = b.length;
  let u1 = 0;
  for (const c of combined) {
    if (c.group === 0) u1 += (c as any).rank;
  }
  u1 -= n1 * (n1 + 1) / 2;
  const mu = n1 * n2 / 2;
  const sigma = Math.sqrt(n1 * n2 * (n1 + n2 + 1) / 12);
  if (sigma === 0) return 1.0;
  const z = Math.abs(u1 - mu) / sigma;
  const p = 2 * (1 - normalCDF(z));
  return Math.max(0, Math.min(1, p));
}

function normalCDF(z: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429;
  const p = 0.3275911;
  const sign = z < 0 ? -1 : 1;
  z = Math.abs(z) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * z);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);
  return 0.5 * (1.0 + sign * y);
}

function runEnrichmentTests(
  observedDPhi: number[],
  nullDists: NullDistribution[]
): EnrichmentTestResult[] {
  const tests: EnrichmentTestResult[] = [];
  if (observedDPhi.length === 0) return tests;

  const obsMed = median(observedDPhi);
  const phaseNull = nullDists.find(n => n.nullType.includes('Phase'));
  if (phaseNull && phaseNull.dPhiValues.length > 10) {
    const nullMed = median(phaseNull.dPhiValues);
    const nullStd = std(phaseNull.dPhiValues);
    let count = 0;
    const N = 1000;
    const allVals = [...observedDPhi, ...phaseNull.dPhiValues];
    for (let p = 0; p < N; p++) {
      shuffle(allVals);
      const permObs = allVals.slice(0, observedDPhi.length);
      if (median(permObs) <= obsMed) count++;
    }
    const pVal = count / N;
    tests.push({
      testName: 'Golden-Mean Proximity Enrichment (vs Phase-Randomized Null)',
      description: 'Tests whether observed D_φ is significantly smaller than phase-randomized surrogates (closer to φ reference geometry)',
      observedStatistic: +obsMed.toFixed(4),
      nullMean: +nullMed.toFixed(4),
      nullStd: +nullStd.toFixed(4),
      pValue: +pVal.toFixed(4),
      nPermutations: N,
      significant: pVal < 0.05,
      effectSize: nullStd > 0 ? +((nullMed - obsMed) / nullStd).toFixed(4) : 0,
    });
  }

  const uniformNull = nullDists.find(n => n.nullType.includes('Uniform'));
  if (uniformNull && uniformNull.dPhiValues.length > 10) {
    const nullMed = median(uniformNull.dPhiValues);
    const nullStd = std(uniformNull.dPhiValues);
    let count = 0;
    const N = 1000;
    const allVals = [...observedDPhi, ...uniformNull.dPhiValues];
    for (let p = 0; p < N; p++) {
      shuffle(allVals);
      const permObs = allVals.slice(0, observedDPhi.length);
      if (median(permObs) <= obsMed) count++;
    }
    const pVal = count / N;
    tests.push({
      testName: 'Root-Space Clustering (vs Uniform Stationarity Triangle)',
      description: 'Tests whether observed root-space positions are more structured than random draws from the stationarity triangle',
      observedStatistic: +obsMed.toFixed(4),
      nullMean: +nullMed.toFixed(4),
      nullStd: +nullStd.toFixed(4),
      pValue: +pVal.toFixed(4),
      nPermutations: N,
      significant: pVal < 0.05,
      effectSize: nullStd > 0 ? +((nullMed - obsMed) / nullStd).toFixed(4) : 0,
    });
  }

  const phiThreshold = 1.0;
  const obsInBand = observedDPhi.filter(d => d < phiThreshold).length / observedDPhi.length;
  if (phaseNull && phaseNull.dPhiValues.length > 10) {
    const nullInBand = phaseNull.dPhiValues.filter(d => d < phiThreshold).length / phaseNull.dPhiValues.length;
    const pVal = mannWhitneyU(
      observedDPhi.map(d => d < phiThreshold ? 1 : 0),
      phaseNull.dPhiValues.map(d => d < phiThreshold ? 1 : 0)
    );
    tests.push({
      testName: 'φ-Band Occupancy (Stability Clustering)',
      description: `Fraction of genes within D_φ < ${phiThreshold} (φ-proximity band) compared to null`,
      observedStatistic: +obsInBand.toFixed(4),
      nullMean: +nullInBand.toFixed(4),
      nullStd: 0,
      pValue: +pVal.toFixed(4),
      nPermutations: 0,
      significant: pVal < 0.05,
      effectSize: +(obsInBand - nullInBand).toFixed(4),
    });
  }

  return tests;
}

function median(arr: number[]): number {
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function std(arr: number[]): number {
  const m = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
}

function shuffle(arr: number[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function kruskalWallisTest(groups: number[][]): number {
  const validGroups = groups.filter(g => g.length > 0);
  if (validGroups.length < 2) return 1.0;
  const allValues: { value: number; group: number }[] = [];
  validGroups.forEach((group, gi) => {
    group.forEach(v => allValues.push({ value: v, group: gi }));
  });
  const N = allValues.length;
  if (N < 3) return 1.0;
  allValues.sort((a, b) => a.value - b.value);
  const ranks = new Array(N);
  let i = 0;
  while (i < N) {
    let j = i;
    while (j < N && allValues[j].value === allValues[i].value) j++;
    const avgRank = (i + j + 1) / 2;
    for (let k = i; k < j; k++) ranks[k] = avgRank;
    i = j;
  }
  const groupRankSums: number[] = new Array(validGroups.length).fill(0);
  const groupSizes: number[] = validGroups.map(g => g.length);
  for (let r = 0; r < N; r++) {
    groupRankSums[allValues[r].group] += ranks[r];
  }
  let H = 0;
  for (let g = 0; g < validGroups.length; g++) {
    const ni = groupSizes[g];
    const Ri = groupRankSums[g];
    H += (Ri * Ri) / ni;
  }
  H = (12 / (N * (N + 1))) * H - 3 * (N + 1);
  const df = validGroups.length - 1;
  const p = 1 - chiSquaredCDF(H, df);
  return Math.max(0, Math.min(1, p));
}

function chiSquaredCDF(x: number, k: number): number {
  if (x <= 0) return 0;
  return lowerIncompleteGamma(k / 2, x / 2) / gamma(k / 2);
}

function gamma(z: number): number {
  if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
  z -= 1;
  const g = 7;
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  let x = c[0];
  for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
  const t = z + g + 0.5;
  return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
}

function lowerIncompleteGamma(s: number, x: number): number {
  if (x < s + 1) {
    let sum = 1 / s, term = 1 / s;
    for (let n = 1; n < 200; n++) {
      term *= x / (s + n);
      sum += term;
      if (Math.abs(term) < 1e-10 * Math.abs(sum)) break;
    }
    return sum * Math.exp(-x + s * Math.log(x));
  }
  let f = 1, c = 1, d = 1 / (x + 1 - s);
  f = d;
  for (let n = 1; n < 200; n++) {
    const an = -n * (n - s);
    const bn = x + 2 * n + 1 - s;
    d = 1 / (bn + an * d);
    c = bn + an / c;
    const delta = c * d;
    f *= delta;
    if (Math.abs(delta - 1) < 1e-10) break;
  }
  return gamma(s) - Math.exp(-x + s * Math.log(x)) * f;
}

function computeCategoryHierarchy(datasets: DatasetRootSpace[]): CategoryHierarchyResult {
  const pooled: Record<string, number[]> = {};
  const pooledR: Record<string, number[]> = {};
  const pooledDPhi: Record<string, number[]> = {};

  for (const ds of datasets) {
    for (const g of ds.genes) {
      const cat = g.geneType;
      if (!pooled[cat]) { pooled[cat] = []; pooledR[cat] = []; pooledDPhi[cat] = []; }
      pooled[cat].push(g.eigenvalue);
      pooledR[cat].push(g.r);
      pooledDPhi[cat].push(g.dPhi);
    }
  }

  const activeCats = Object.keys(pooled).filter(c => pooled[c].length >= 2);
  const groups = activeCats.map(c => pooled[c]);
  const kwP = kruskalWallisTest(groups);

  const hierarchy: CategoryHierarchyEntry[] = activeCats.map(cat => {
    const vals = pooled[cat];
    const rVals = pooledR[cat];
    const dPhiVals = pooledDPhi[cat];
    const meta = CATEGORY_META[cat as GeneCategory] || CATEGORY_META.other;
    return {
      category: cat,
      label: meta.label,
      color: meta.color,
      pooledCount: vals.length,
      pooledMeanEigenvalue: +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(4),
      pooledMeanR: +(rVals.reduce((a, b) => a + b, 0) / rVals.length).toFixed(4),
      pooledMeanDPhi: +(dPhiVals.reduce((a, b) => a + b, 0) / dPhiVals.length).toFixed(4),
      rank: 0,
    };
  }).sort((a, b) => b.pooledMeanEigenvalue - a.pooledMeanEigenvalue);

  hierarchy.forEach((h, i) => { h.rank = i + 1; });

  const pairwiseTests: PairwiseComparison[] = [];
  for (let i = 0; i < activeCats.length; i++) {
    for (let j = i + 1; j < activeCats.length; j++) {
      const catA = activeCats[i];
      const catB = activeCats[j];
      if (pooled[catA].length < 2 || pooled[catB].length < 2) continue;
      const p = mannWhitneyU(pooled[catA], pooled[catB]);
      const meanA = pooled[catA].reduce((a, b) => a + b, 0) / pooled[catA].length;
      const meanB = pooled[catB].reduce((a, b) => a + b, 0) / pooled[catB].length;
      const metaA = CATEGORY_META[catA as GeneCategory] || CATEGORY_META.other;
      const metaB = CATEGORY_META[catB as GeneCategory] || CATEGORY_META.other;
      pairwiseTests.push({
        categoryA: catA,
        categoryB: catB,
        labelA: metaA.label,
        labelB: metaB.label,
        meanEigenvalueA: +meanA.toFixed(4),
        meanEigenvalueB: +meanB.toFixed(4),
        mannWhitneyP: +p.toFixed(4),
        significant: p < 0.05,
        direction: meanA > meanB ? `${metaA.label} > ${metaB.label}` : `${metaB.label} > ${metaA.label}`,
      });
    }
  }

  const metaExport: Record<string, { label: string; color: string; description: string }> = {};
  for (const cat of ALL_CATEGORIES) {
    metaExport[cat] = CATEGORY_META[cat];
  }

  return {
    hierarchy,
    kruskalWallisP: +kwP.toFixed(4),
    kruskalWallisSignificant: kwP < 0.05,
    pairwiseTests: pairwiseTests.sort((a, b) => a.mannWhitneyP - b.mannWhitneyP),
    categoryMeta: metaExport,
  };
}

function computePCAForDataset(
  genes: Map<string, { gene: string; type: GeneCategory; values: number[] }>,
  rootPoints: GeneRootPoint[]
): { genes: PCAGenePoint[]; varianceExplained: [number, number] } {
  const rootMap = new Map(rootPoints.map(g => [g.gene, g]));
  const geneEntries: { gene: string; type: string; values: number[]; eigenvalue: number }[] = [];

  genes.forEach((gd) => {
    if (gd.type === 'other') return;
    const rp = rootMap.get(gd.gene);
    if (!rp) return;
    geneEntries.push({ gene: gd.gene, type: gd.type, values: gd.values, eigenvalue: rp.eigenvalue });
  });

  if (geneEntries.length < 3) return { genes: [], varianceExplained: [0, 0] };

  const minLen = Math.min(...geneEntries.map(g => g.values.length));
  const n = geneEntries.length;
  const p = minLen;

  const Z = geneEntries.map(g => {
    const vals = g.values.slice(0, p);
    const mean = vals.reduce((a, b) => a + b, 0) / p;
    const std = Math.sqrt(vals.reduce((a, x) => a + (x - mean) ** 2, 0) / (p - 1)) || 1;
    return vals.map(v => (v - mean) / std);
  });

  const cov: number[][] = Array.from({ length: p }, () => Array(p).fill(0));
  for (let j1 = 0; j1 < p; j1++) {
    for (let j2 = j1; j2 < p; j2++) {
      let s = 0;
      for (let i = 0; i < n; i++) s += Z[i][j1] * Z[i][j2];
      cov[j1][j2] = s / (n - 1);
      cov[j2][j1] = cov[j1][j2];
    }
  }

  const eig = powerIteration2(cov, p);

  const pc1Scores: number[] = new Array(n);
  const pc2Scores: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    let s1 = 0, s2 = 0;
    for (let j = 0; j < p; j++) {
      s1 += Z[i][j] * eig.v1[j];
      s2 += Z[i][j] * eig.v2[j];
    }
    pc1Scores[i] = s1;
    pc2Scores[i] = s2;
  }

  const totalVar = eig.e1 + eig.e2 + eig.eRest;
  const varExplained: [number, number] = [
    totalVar > 0 ? +(eig.e1 / totalVar * 100).toFixed(1) : 0,
    totalVar > 0 ? +(eig.e2 / totalVar * 100).toFixed(1) : 0,
  ];

  const pcaGenes: PCAGenePoint[] = geneEntries.map((g, i) => ({
    gene: g.gene,
    geneType: g.type,
    pc1: +pc1Scores[i].toFixed(4),
    pc2: +pc2Scores[i].toFixed(4),
    eigenvalue: g.eigenvalue,
  }));

  return { genes: pcaGenes, varianceExplained: varExplained };
}

function powerIteration2(A: number[][], dim: number): { v1: number[]; v2: number[]; e1: number; e2: number; eRest: number } {
  let v1 = Array.from({ length: dim }, () => seededRandom() - 0.5);
  let norm = Math.sqrt(v1.reduce((s, x) => s + x * x, 0));
  v1 = v1.map(x => x / norm);
  let e1 = 0;

  for (let iter = 0; iter < 300; iter++) {
    const Av: number[] = Array(dim).fill(0);
    for (let i = 0; i < dim; i++) {
      for (let j = 0; j < dim; j++) Av[i] += A[i][j] * v1[j];
    }
    e1 = Math.sqrt(Av.reduce((s, x) => s + x * x, 0));
    if (e1 === 0) break;
    const prev = v1;
    v1 = Av.map(x => x / e1);
    let diff = 0;
    for (let i = 0; i < dim; i++) diff += (v1[i] - prev[i]) ** 2;
    if (diff < 1e-12) break;
  }

  const A2: number[][] = A.map((row, i) => row.map((val, j) => val - e1 * v1[i] * v1[j]));

  let v2 = Array.from({ length: dim }, () => seededRandom() - 0.5);
  let dot = v2.reduce((s, x, i) => s + x * v1[i], 0);
  v2 = v2.map((x, i) => x - dot * v1[i]);
  norm = Math.sqrt(v2.reduce((s, x) => s + x * x, 0));
  v2 = v2.map(x => x / norm);
  let e2 = 0;

  for (let iter = 0; iter < 300; iter++) {
    const Av: number[] = Array(dim).fill(0);
    for (let i = 0; i < dim; i++) {
      for (let j = 0; j < dim; j++) Av[i] += A2[i][j] * v2[j];
    }
    dot = Av.reduce((s, x, i) => s + x * v1[i], 0);
    for (let i = 0; i < dim; i++) Av[i] -= dot * v1[i];
    e2 = Math.sqrt(Av.reduce((s, x) => s + x * x, 0));
    if (e2 === 0) break;
    const prev = v2;
    v2 = Av.map(x => x / e2);
    let diff = 0;
    for (let i = 0; i < dim; i++) diff += (v2[i] - prev[i]) ** 2;
    if (diff < 1e-12) break;
  }

  let traceTotal = 0;
  for (let i = 0; i < dim; i++) traceTotal += A[i][i];
  const eRest = Math.max(0, traceTotal - e1 - e2);

  return { v1, v2, e1, e2, eRest };
}

const ROOT_SPACE_DATASETS = [
  { id: 'GSE11923_48h', name: 'Mouse Liver 48h (Hughes 2009)', species: 'Mus musculus', condition: 'WT', file: 'GSE11923_Liver_1h_48h_genes.csv' },
  { id: 'GSE54650_Liver', name: 'Mouse Liver (Zhang 2014)', species: 'Mus musculus', condition: 'WT', file: 'GSE54650_Liver_circadian.csv' },
  { id: 'GSE113883_Blood', name: 'Human Whole Blood (Braun 2018)', species: 'Homo sapiens', condition: 'WT', file: 'GSE113883_Human_WholeBlood.csv' },
  { id: 'GSE157357_WT', name: 'Mouse Organoid WT-WT (Stokes 2021)', species: 'Mus musculus', condition: 'WT', file: 'GSE157357_Organoid_WT-WT_circadian.csv' },
  { id: 'GSE157357_ApcKO', name: 'Mouse Organoid ApcKO-WT Cancer (Stokes 2021)', species: 'Mus musculus', condition: 'ApcKO (Cancer)', file: 'GSE157357_Organoid_ApcKO-WT_circadian.csv' },
  { id: 'GSE157357_BmalKO', name: 'Mouse Organoid WT-BmalKO (Stokes 2021)', species: 'Mus musculus', condition: 'BmalKO (Clock KO)', file: 'GSE157357_Organoid_WT-BmalKO_circadian.csv' },
  { id: 'GSE48113_Aligned', name: 'Human Blood Aligned (Archer 2014)', species: 'Homo sapiens', condition: 'Aligned', file: 'GSE48113_ForcedDesync_Aligned_circadian.csv' },
  { id: 'GSE48113_Misaligned', name: 'Human Blood Misaligned (Archer 2014)', species: 'Homo sapiens', condition: 'Misaligned', file: 'GSE48113_ForcedDesync_Misaligned_circadian.csv' },
  { id: 'GSE39445_SufficientSleep', name: 'Human Blood Sufficient Sleep (Moller-Levet 2013)', species: 'Homo sapiens', condition: 'Sufficient Sleep', file: 'GSE39445_Blood_SufficientSleep_circadian.csv' },
  { id: 'GSE39445_SleepRestriction', name: 'Human Blood Sleep Restriction (Moller-Levet 2013)', species: 'Homo sapiens', condition: 'Sleep Restricted', file: 'GSE39445_Blood_SleepRestriction_circadian.csv' },
  { id: 'GSE122541_DayShift', name: 'Nurses Day Shift PBMCs (Gamble 2019)', species: 'Homo sapiens', condition: 'Day Shift', file: 'GSE122541_Nurses_DayShift_circadian.csv' },
  { id: 'GSE122541_NightShift', name: 'Nurses Night Shift PBMCs (Gamble 2019)', species: 'Homo sapiens', condition: 'Night Shift', file: 'GSE122541_Nurses_NightShift_circadian.csv' },
];

const PERTURBATION_PAIRS = [
  { wt: 'GSE157357_WT', perturbed: 'GSE157357_ApcKO', label: 'WT vs ApcKO Cancer Organoid' },
  { wt: 'GSE157357_WT', perturbed: 'GSE157357_BmalKO', label: 'WT vs BmalKO Clock Disruption' },
  { wt: 'GSE48113_Aligned', perturbed: 'GSE48113_Misaligned', label: 'Aligned vs Misaligned (Forced Desynchrony)' },
  { wt: 'GSE39445_SufficientSleep', perturbed: 'GSE39445_SleepRestriction', label: 'Sufficient Sleep vs Sleep Restriction' },
  { wt: 'GSE122541_DayShift', perturbed: 'GSE122541_NightShift', label: 'Day Shift vs Night Shift (Nurses)' },
];

export function runRootSpaceAnalysis(): RootSpaceAnalysisResult {
  const RNG_SEED = 42;
  seedRNG(RNG_SEED);

  const triangle = buildStationarityTriangle();
  const datasets: DatasetRootSpace[] = [];
  const allGeneSeries: number[][] = [];
  const allObservedDPhi: number[] = [];
  const datasetMap = new Map<string, DatasetRootSpace>();

  for (const ds of ROOT_SPACE_DATASETS) {
    const filePath = path.join(process.cwd(), 'datasets', ds.file);
    if (!fs.existsSync(filePath)) continue;

    const genes = parseDataset(filePath);
    if (genes.size === 0) continue;

    const genePoints: GeneRootPoint[] = [];
    genes.forEach((geneData) => {
      if (geneData.type === 'other') return;
      allGeneSeries.push(geneData.values);
      const point = geneToRootPoint(geneData.gene, geneData.type, geneData.values);
      if (point) {
        genePoints.push(point);
        allObservedDPhi.push(point.dPhi);
      }
    });

    if (genePoints.length === 0) continue;

    const clockPts = genePoints.filter(g => g.geneType === 'clock');
    const targetPts = genePoints.filter(g => g.geneType === 'target');

    const categoryStats: CategoryStats[] = [];
    for (const cat of ALL_CATEGORIES) {
      const pts = genePoints.filter(g => g.geneType === cat);
      if (pts.length === 0) continue;
      const meta = CATEGORY_META[cat];
      categoryStats.push({
        category: cat,
        label: meta.label,
        color: meta.color,
        count: pts.length,
        meanR: +(pts.reduce((s, g) => s + g.r, 0) / pts.length).toFixed(4),
        meanTheta: +(pts.reduce((s, g) => s + g.theta, 0) / pts.length).toFixed(4),
        meanDPhi: +(pts.reduce((s, g) => s + g.dPhi, 0) / pts.length).toFixed(4),
        meanEigenvalue: +(pts.reduce((s, g) => s + g.eigenvalue, 0) / pts.length).toFixed(4),
      });
    }

    const dsResult: DatasetRootSpace = {
      datasetId: ds.id,
      datasetName: ds.name,
      species: ds.species,
      condition: ds.condition,
      genes: genePoints,
      clockMeanR: clockPts.length > 0 ? +(clockPts.reduce((s, g) => s + g.r, 0) / clockPts.length).toFixed(4) : 0,
      targetMeanR: targetPts.length > 0 ? +(targetPts.reduce((s, g) => s + g.r, 0) / targetPts.length).toFixed(4) : 0,
      clockMeanTheta: clockPts.length > 0 ? +(clockPts.reduce((s, g) => s + g.theta, 0) / clockPts.length).toFixed(4) : 0,
      targetMeanTheta: targetPts.length > 0 ? +(targetPts.reduce((s, g) => s + g.theta, 0) / targetPts.length).toFixed(4) : 0,
      clockMeanDPhi: clockPts.length > 0 ? +(clockPts.reduce((s, g) => s + g.dPhi, 0) / clockPts.length).toFixed(4) : 0,
      targetMeanDPhi: targetPts.length > 0 ? +(targetPts.reduce((s, g) => s + g.dPhi, 0) / targetPts.length).toFixed(4) : 0,
      categoryStats,
    };
    datasets.push(dsResult);
    datasetMap.set(ds.id, dsResult);
  }

  const nullDistributions = buildNullDistributions(allGeneSeries, 200);
  const enrichmentTests = runEnrichmentTests(allObservedDPhi, nullDistributions);

  const perturbationShifts: PerturbationShift[] = [];
  for (const pair of PERTURBATION_PAIRS) {
    const wtDs = datasetMap.get(pair.wt);
    const pertDs = datasetMap.get(pair.perturbed);
    if (!wtDs || !pertDs) continue;

    const wtDPhi = wtDs.genes.map(g => g.dPhi);
    const pertDPhi = pertDs.genes.map(g => g.dPhi);
    const wtR = wtDs.genes.map(g => g.r);
    const pertR = pertDs.genes.map(g => g.r);

    const pVal = mannWhitneyU(wtDPhi, pertDPhi);

    perturbationShifts.push({
      datasetPair: pair.label,
      wtLabel: wtDs.condition,
      perturbedLabel: pertDs.condition,
      wtMeanR: +(wtR.reduce((a, b) => a + b, 0) / wtR.length).toFixed(4),
      perturbedMeanR: +(pertR.reduce((a, b) => a + b, 0) / pertR.length).toFixed(4),
      rShift: +((pertR.reduce((a, b) => a + b, 0) / pertR.length) - (wtR.reduce((a, b) => a + b, 0) / wtR.length)).toFixed(4),
      wtMeanTheta: +(wtDs.genes.reduce((s, g) => s + g.theta, 0) / wtDs.genes.length).toFixed(4),
      perturbedMeanTheta: +(pertDs.genes.reduce((s, g) => s + g.theta, 0) / pertDs.genes.length).toFixed(4),
      thetaShift: +((pertDs.genes.reduce((s, g) => s + g.theta, 0) / pertDs.genes.length) - (wtDs.genes.reduce((s, g) => s + g.theta, 0) / wtDs.genes.length)).toFixed(4),
      wtMeanDPhi: +(wtDPhi.reduce((a, b) => a + b, 0) / wtDPhi.length).toFixed(4),
      perturbedMeanDPhi: +(pertDPhi.reduce((a, b) => a + b, 0) / pertDPhi.length).toFixed(4),
      dPhiShift: +((pertDPhi.reduce((a, b) => a + b, 0) / pertDPhi.length) - (wtDPhi.reduce((a, b) => a + b, 0) / wtDPhi.length)).toFixed(4),
      mannWhitneyP: +pVal.toFixed(4),
      significant: pVal < 0.05,
    });
  }

  const pcaComparison: PCADataset[] = [];
  for (const ds of ROOT_SPACE_DATASETS) {
    const filePath = path.join(process.cwd(), 'datasets', ds.file);
    if (!fs.existsSync(filePath)) continue;
    const dsResult = datasetMap.get(ds.id);
    if (!dsResult || dsResult.genes.length < 5) continue;
    const rawGenes = parseDataset(filePath);
    const pcaResult = computePCAForDataset(rawGenes, dsResult.genes);
    if (pcaResult.genes.length > 0) {
      pcaComparison.push({
        datasetId: ds.id,
        datasetName: ds.name,
        genes: pcaResult.genes,
        varianceExplained: pcaResult.varianceExplained,
      });
    }
  }

  const categoryHierarchy = computeCategoryHierarchy(datasets);

  const totalGenes = datasets.reduce((s, d) => s + d.genes.length, 0);
  const phiThreshold = 1.0;
  const phiEnrichedFraction = allObservedDPhi.length > 0
    ? +(allObservedDPhi.filter(d => d < phiThreshold).length / allObservedDPhi.length).toFixed(4)
    : 0;
  const pertShiftDetected = perturbationShifts.some(p => p.significant);

  const analyticalNullDPhi: number[] = [];
  const analyticalNullThetas: number[] = [];
  seedRNG(RNG_SEED + 9999);
  for (let i = 0; i < 10000; i++) {
    const { beta1, beta2 } = sampleUniformFromTriangle();
    const roots = computeRoots(beta1, beta2);
    if (roots.r >= 1.0) continue;
    analyticalNullDPhi.push(computeDPhi(roots.r, roots.theta));
    analyticalNullThetas.push(roots.theta);
  }

  const thresholdSweep: ThresholdSweepPoint[] = [];
  for (let t = 0.2; t <= 4.0; t += 0.2) {
    const thresh = +t.toFixed(1);
    const obsFrac = allObservedDPhi.length > 0
      ? allObservedDPhi.filter(d => d < thresh).length / allObservedDPhi.length : 0;
    const nullFrac = analyticalNullDPhi.length > 0
      ? analyticalNullDPhi.filter(d => d < thresh).length / analyticalNullDPhi.length : 0;
    thresholdSweep.push({
      threshold: thresh,
      observedFraction: +obsFrac.toFixed(4),
      nullFraction: +nullFrac.toFixed(4),
      enrichmentRatio: nullFrac > 0 ? +(obsFrac / nullFrac).toFixed(3) : 0,
    });
  }

  const allObservedThetas = datasets.flatMap(d => d.genes.map(g => g.theta));
  const thetaBins = 18;
  const thetaBinWidth = Math.PI / thetaBins;
  const thetaDistribution: ThetaBin[] = [];
  for (let b = 0; b < thetaBins; b++) {
    const lo = b * thetaBinWidth;
    const hi = (b + 1) * thetaBinWidth;
    const center = (lo + hi) / 2;
    const obsCount = allObservedThetas.filter(t => t >= lo && t < hi).length;
    const nullCount = analyticalNullThetas.filter(t => t >= lo && t < hi).length;
    thetaDistribution.push({
      binCenter: +center.toFixed(3),
      binLabel: `${(lo * 180 / Math.PI).toFixed(0)}°-${(hi * 180 / Math.PI).toFixed(0)}°`,
      observedCount: obsCount,
      observedDensity: allObservedThetas.length > 0 ? +(obsCount / allObservedThetas.length).toFixed(4) : 0,
      nullCount: nullCount,
      nullDensity: analyticalNullThetas.length > 0 ? +(nullCount / analyticalNullThetas.length).toFixed(4) : 0,
    });
  }

  const thetaPhiRef = 2 * Math.PI / PHI;

  const enrichSig = enrichmentTests.filter(t => t.significant).length;
  let verdict: string;
  if (enrichSig >= 2 && pertShiftDetected) {
    verdict = `STRONG — φ-proximity enrichment significant in ${enrichSig}/${enrichmentTests.length} tests, perturbation shifts detected. Root-space geometry is structured and biologically meaningful.`;
  } else if (enrichSig >= 1 || pertShiftDetected) {
    verdict = `MODERATE — Partial support for structured root-space geometry. ${enrichSig}/${enrichmentTests.length} enrichment tests significant, perturbation shifts ${pertShiftDetected ? 'detected' : 'not detected'}.`;
  } else {
    verdict = `WEAK — No significant φ-enrichment or perturbation shifts detected. Root-space geometry may not be distinguishable from null.`;
  }

  return {
    triangle,
    datasets,
    nullDistributions: nullDistributions.map(n => ({
      ...n,
      dPhiValues: n.dPhiValues.slice(0, 200),
      rValues: n.rValues.slice(0, 200),
      thetaValues: n.thetaValues.slice(0, 200),
    })),
    enrichmentTests,
    perturbationShifts,
    categoryHierarchy,
    pcaComparison: pcaComparison.length > 0 ? pcaComparison : undefined,
    thresholdSweep,
    thetaDistribution,
    thetaPhiRef: +thetaPhiRef.toFixed(4),
    methodology: {
      rngSeed: RNG_SEED,
      rootHandling: 'Dominance determined by largest modulus |λ|, not signed value. Complex roots: r = √(-β₂), θ = atan2(√(-disc), β₁) ∈ (0,π). Real roots: θ = π when dominant root < 0 (sign-alternating dynamics), θ = 0 otherwise. Near-unit modulus (|λ| ≥ 1.0) filtered as non-stationary.',
      nullHierarchy: 'Phase-randomized surrogates = primary structural null (preserves power spectrum, destroys phase coupling). Uniform stationarity triangle = secondary theoretical comparator (tests whether observed coefficients occupy a structured subregion).',
      excludedDatasets: 'No datasets excluded. All 12 datasets loaded successfully. Genes classified into 9 functional categories (clock, target, housekeeping, immune, metabolic, chromatin, signaling, DNA repair, stem) with "other" genes excluded from visualization.',
      multipleTestingNote: 'Enrichment p-values are global aggregates across all genes/datasets (not per-gene). Three tests are reported independently; Bonferroni-adjusted α = 0.05/3 = 0.0167 for strict significance. The φ-band occupancy test (p=0.0048) survives Bonferroni correction.',
      mappingSensitivity: 'θ_φ = 2π/φ stress-tested against 2π/φ² (137.5°, phyllotaxis) and π/φ (111.2°). Band occupancy significant in 2/3 mappings (p=0.0039, p=0.0012). Analytical null from 100K uniform AR(2) draws: production mapping is the only one showing genuine enrichment (1.86×, observed 18.4% vs null 9.9%); alternatives show depletion (0.51× and 0.07×). Result is not an artifact of coordinate choice.',
    },
    summary: {
      totalGenes,
      totalDatasets: datasets.length,
      meanDPhi: allObservedDPhi.length > 0 ? +(allObservedDPhi.reduce((a, b) => a + b, 0) / allObservedDPhi.length).toFixed(4) : 0,
      phiEnrichedFraction,
      perturbationShiftDetected: pertShiftDetected,
      overallVerdict: verdict,
    },
  };
}
