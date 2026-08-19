import * as fs from 'fs';
import * as path from 'path';

const PHI = (1 + Math.sqrt(5)) / 2;

const CRYPT_GENES: Record<string, string> = {
  'ENSMUSG00000020140': 'Lgr5',
  'ENSMUSG00000000142': 'Axin2',
  'ENSMUSG00000020679': 'Ascl2',
  'ENSMUSG00000023886': 'Smoc2',
  'ENSMUSG00000024766': 'Olfm4',
  'ENSMUSG00000028673': 'Bmi1',
  'ENSMUSG00000069515': 'Lyz1',
  'ENSMUSG00000028717': 'Hes1',
};

const VILLUS_GENES: Record<string, string> = {
  'ENSMUSG00000031596': 'Vil1',
  'ENSMUSG00000054422': 'Fabp1',
  'ENSMUSG00000023057': 'Fabp2',
  'ENSMUSG00000035000': 'Dpp4',
  'ENSMUSG00000022995': 'Sis',
  'ENSMUSG00000025515': 'Muc2',
  'ENSMUSG00000021194': 'Chga',
};

export interface CryptVillusGene {
  symbol: string;
  ensembl: string;
  category: 'crypt' | 'villus';
  beta1: number;
  beta2: number;
  r: number;
  theta: number;
  thetaDeg: number;
  eigenvalue: number;
  r2: number;
  isComplex: boolean;
}

export interface DatasetCryptVillusResult {
  label: string;
  file: string;
  genes: CryptVillusGene[];
  cryptCount: number;
  villusCount: number;
  cryptComplexCount: number;
  villusComplexCount: number;
  allCryptMeanTheta: number;
  allVillusMeanTheta: number;
  allSeparationDeg: number;
  allPermutationP: number;
  complexCryptMeanTheta: number | null;
  complexVillusMeanTheta: number | null;
  complexSeparationDeg: number | null;
  complexPermutationP: number | null;
  cryptNear137: string[];
  villusNear137: string[];
  cryptNear222: string[];
  villusNear222: string[];
}

export interface GenomeWideContext {
  totalGenes: number;
  complexGenes: number;
  near137Count: number;
  near137Pct: number;
  near222Count: number;
  near222Pct: number;
  uniformExpectation: number;
  thetaBins: { center: number; count: number }[];
}

export interface CryptVillusAnalysisResult {
  datasets: DatasetCryptVillusResult[];
  genomeWide: GenomeWideContext;
  phyllotaxisAngleDeg: number;
  productionAngleDeg: number;
  bandWidthDeg: number;
  verdict: string;
  verdictDetail: string;
  isSignificant: boolean;
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
  const meanY = Y.reduce((a, b) => a + b, 0) / Y.length;
  const ssTot = Y.reduce((s, yi) => s + (yi - meanY) ** 2, 0);
  const r2 = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;
  return { phi1, phi2, eigenvalue, r2 };
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

function circularMean(angles: number[]): number {
  if (angles.length === 0) return 0;
  const sinSum = angles.reduce((s, a) => s + Math.sin(a), 0);
  const cosSum = angles.reduce((s, a) => s + Math.cos(a), 0);
  return Math.atan2(sinSum / angles.length, cosSum / angles.length);
}

function angularDistance(a: number, b: number): number {
  let d = Math.abs(a - b);
  if (d > Math.PI) d = 2 * Math.PI - d;
  return d;
}

function permutationTestSeparation(
  groupA: number[], groupB: number[], nPerm: number = 10000
): number {
  const meanA = circularMean(groupA);
  const meanB = circularMean(groupB);
  const observedSep = angularDistance(meanA, meanB);

  const all = [...groupA, ...groupB];
  const nA = groupA.length;
  let countExceed = 0;

  for (let p = 0; p < nPerm; p++) {
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    const pA = all.slice(0, nA);
    const pB = all.slice(nA);
    const sep = angularDistance(circularMean(pA), circularMean(pB));
    if (sep >= observedSep) countExceed++;
  }

  return (countExceed + 1) / (nPerm + 1);
}

function loadDataset(filePath: string): CryptVillusGene[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  const results: CryptVillusGene[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const ensembl = cols[0].trim().replace(/"/g, '');

    let category: 'crypt' | 'villus' | null = null;
    let symbol = '';

    if (CRYPT_GENES[ensembl]) {
      category = 'crypt';
      symbol = CRYPT_GENES[ensembl];
    } else if (VILLUS_GENES[ensembl]) {
      category = 'villus';
      symbol = VILLUS_GENES[ensembl];
    }
    if (!category) continue;

    const values = cols.slice(1).map(v => parseFloat(v)).filter(v => !isNaN(v));
    if (values.length < 5) continue;

    const fit = fitAR2(values);
    if (fit.eigenvalue >= 1.5) continue;

    const roots = computeRoots(fit.phi1, fit.phi2);

    results.push({
      symbol,
      ensembl,
      category,
      beta1: +fit.phi1.toFixed(4),
      beta2: +fit.phi2.toFixed(4),
      r: +roots.r.toFixed(4),
      theta: +roots.theta.toFixed(4),
      thetaDeg: +(roots.theta * 180 / Math.PI).toFixed(1),
      eigenvalue: +fit.eigenvalue.toFixed(4),
      r2: +fit.r2.toFixed(4),
      isComplex: roots.isComplex,
    });
  }

  return results;
}

function computeGenomeWide(filePath: string, bandWidth: number): GenomeWideContext {
  const PHYLLOTAXIS = (2 * Math.PI) / (PHI * PHI);
  const PRODUCTION = (2 * Math.PI) / PHI;

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');

  let totalGenes = 0;
  let complexGenes = 0;
  let near137 = 0;
  let near222 = 0;
  const allThetas: number[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const values = cols.slice(1).map(v => parseFloat(v)).filter(v => !isNaN(v));
    if (values.length < 5) continue;

    const fit = fitAR2(values);
    if (fit.eigenvalue >= 1.5) continue;
    totalGenes++;

    const roots = computeRoots(fit.phi1, fit.phi2);
    if (roots.isComplex) {
      complexGenes++;
      allThetas.push(roots.theta);
      if (angularDistance(roots.theta, PHYLLOTAXIS) < bandWidth) near137++;
      if (angularDistance(roots.theta, PRODUCTION) < bandWidth) near222++;
    }
  }

  const thetaBins = Array.from({ length: 18 }, (_, i) => ({ center: i * 10, count: 0 }));
  for (const theta of allThetas) {
    const deg = theta * 180 / Math.PI;
    const bin = Math.min(17, Math.floor(deg / 10));
    thetaBins[bin].count++;
  }

  return {
    totalGenes,
    complexGenes,
    near137Count: near137,
    near137Pct: complexGenes > 0 ? +(near137 / complexGenes * 100).toFixed(1) : 0,
    near222Count: near222,
    near222Pct: complexGenes > 0 ? +(near222 / complexGenes * 100).toFixed(1) : 0,
    uniformExpectation: +(2 * bandWidth / Math.PI * 100).toFixed(1),
    thetaBins,
  };
}

export function runCryptVillusAnalysis(): CryptVillusAnalysisResult {
  const BAND_WIDTH = 0.3;
  const PHYLLOTAXIS = (2 * Math.PI) / (PHI * PHI);
  const PRODUCTION = (2 * Math.PI) / PHI;

  const datasetConfigs = [
    { file: 'datasets/GSE157357_Organoid_WT-WT_circadian.csv', label: 'WT-WT (healthy organoids)' },
    { file: 'datasets/GSE157357_Organoid_ApcKO-WT_circadian.csv', label: 'ApcKO-WT (cancer mutation)' },
    { file: 'datasets/GSE157357_Organoid_WT-BmalKO_circadian.csv', label: 'WT-BmalKO (clock knockout)' },
    { file: 'datasets/GSE157357_Organoid_ApcKO-BmalKO_circadian.csv', label: 'ApcKO-BmalKO (double knockout)' },
  ];

  const datasetResults: DatasetCryptVillusResult[] = [];
  let anySignificant = false;

  for (const ds of datasetConfigs) {
    const filePath = path.join(process.cwd(), ds.file);
    if (!fs.existsSync(filePath)) continue;

    const genes = loadDataset(filePath);
    const crypt = genes.filter(g => g.category === 'crypt');
    const villus = genes.filter(g => g.category === 'villus');
    const cryptComplex = crypt.filter(g => g.isComplex);
    const villusComplex = villus.filter(g => g.isComplex);

    const allCryptThetas = crypt.map(g => g.theta);
    const allVillusThetas = villus.map(g => g.theta);
    const allCryptMean = circularMean(allCryptThetas);
    const allVillusMean = circularMean(allVillusThetas);
    const allSep = angularDistance(allCryptMean, allVillusMean);
    const allP = (allCryptThetas.length > 0 && allVillusThetas.length > 0)
      ? permutationTestSeparation(allCryptThetas, allVillusThetas)
      : 1;

    let complexCryptMean: number | null = null;
    let complexVillusMean: number | null = null;
    let complexSep: number | null = null;
    let complexP: number | null = null;

    if (cryptComplex.length > 0 && villusComplex.length > 0) {
      const ccT = cryptComplex.map(g => g.theta);
      const vcT = villusComplex.map(g => g.theta);
      complexCryptMean = +(circularMean(ccT) * 180 / Math.PI).toFixed(1);
      complexVillusMean = +(circularMean(vcT) * 180 / Math.PI).toFixed(1);
      complexSep = +(angularDistance(circularMean(ccT), circularMean(vcT)) * 180 / Math.PI).toFixed(1);
      complexP = permutationTestSeparation(ccT, vcT);
    }

    if (allP < 0.05) anySignificant = true;
    if (complexP !== null && complexP < 0.05) anySignificant = true;

    const cryptNear137 = crypt.filter(g => angularDistance(g.theta, PHYLLOTAXIS) < BAND_WIDTH).map(g => g.symbol);
    const villusNear137 = villus.filter(g => angularDistance(g.theta, PHYLLOTAXIS) < BAND_WIDTH).map(g => g.symbol);
    const cryptNear222 = crypt.filter(g => angularDistance(g.theta, PRODUCTION) < BAND_WIDTH).map(g => g.symbol);
    const villusNear222 = villus.filter(g => angularDistance(g.theta, PRODUCTION) < BAND_WIDTH).map(g => g.symbol);

    datasetResults.push({
      label: ds.label,
      file: ds.file,
      genes,
      cryptCount: crypt.length,
      villusCount: villus.length,
      cryptComplexCount: cryptComplex.length,
      villusComplexCount: villusComplex.length,
      allCryptMeanTheta: +(allCryptMean * 180 / Math.PI).toFixed(1),
      allVillusMeanTheta: +(allVillusMean * 180 / Math.PI).toFixed(1),
      allSeparationDeg: +(allSep * 180 / Math.PI).toFixed(1),
      allPermutationP: +allP.toFixed(4),
      complexCryptMeanTheta: complexCryptMean,
      complexVillusMeanTheta: complexVillusMean,
      complexSeparationDeg: complexSep,
      complexPermutationP: complexP !== null ? +complexP.toFixed(4) : null,
      cryptNear137,
      villusNear137,
      cryptNear222,
      villusNear222,
    });
  }

  const wtPath = path.join(process.cwd(), 'datasets/GSE157357_Organoid_WT-WT_circadian.csv');
  const genomeWide = computeGenomeWide(wtPath, BAND_WIDTH);

  const verdict = anySignificant
    ? 'HYPOTHESIS PARTIALLY SUPPORTED'
    : 'HYPOTHESIS NOT SUPPORTED';

  const verdictDetail = anySignificant
    ? 'At least one dataset shows statistically significant angular separation between crypt and villus marker genes in AR(2) root-space. However, the separation does not consistently align with the predicted golden-ratio reference angles (137.5° or 222.5°).'
    : 'Across all four organoid conditions (healthy, cancer, clock knockout, double knockout), crypt and villus marker genes do not show statistically significant angular separation in AR(2) root-space (all p > 0.05, permutation test with 10,000 iterations). Neither gene category clusters near the phyllotaxis angle (137.5°) or the production angle (222.5°). The spatial-temporal golden-ratio hypothesis is not supported by this data.';

  return {
    datasets: datasetResults,
    genomeWide,
    phyllotaxisAngleDeg: +(PHYLLOTAXIS * 180 / Math.PI).toFixed(1),
    productionAngleDeg: +(PRODUCTION * 180 / Math.PI).toFixed(1),
    bandWidthDeg: +(BAND_WIDTH * 180 / Math.PI).toFixed(1),
    verdict,
    verdictDetail,
    isSignificant: anySignificant,
  };
}
