import * as fs from 'fs';
import { parse } from 'csv-parse/sync';

const CLOCK_GENES = ['Arntl', 'Clock', 'Per1', 'Per2', 'Per3', 'Cry1', 'Cry2', 'Nr1d1', 'Nr1d2', 'Dbp'];

const FUNCTIONAL_GENE_SETS: Record<string, string[]> = {
  'Cell Cycle': ['Cdk1','Cdk2','Cdk4','Cdk6','Ccna1','Ccna2','Ccnb1','Ccnb2','Ccnd1','Ccnd2','Ccnd3','Ccne1','Ccne2','Cdkn1a','Cdkn1b','Cdkn2a','Cdkn2b','Chek1','Chek2','Plk1','Aurka','Aurkb','Wee1','Cdc20','Cdc25a','Cdc25b','Cdc25c','Cdc45','Mcm2','Mcm3','Mcm4','Mcm5','Mcm6','Mcm7','E2f1','E2f2','E2f3','E2f4','Rb1','Tp53','Mdm2','Bub1','Bub1b','Mad2l1','Pcna','Rrm1','Rrm2','Cdc6','Orc1','Gmnn','Skp2'],
  'DNA Repair': ['Brca1','Brca2','Rad51','Xpa','Xpc','Xrcc1','Xrcc4','Ercc1','Ercc2','Ogg1','Mutyh','Msh2','Msh6','Mlh1','Pms2','Atm','Atr','Chek1','Chek2','Tp53bp1','Lig4','Parp1','Parp2','Fancd2','Fanca','Ddb2','Neil1','Nthl1','Apex1','Mgmt'],
  'Circadian Clock': ['Arntl','Arntl2','Clock','Npas2','Per1','Per2','Per3','Cry1','Cry2','Nr1d1','Nr1d2','Rora','Rorb','Rorc','Dbp','Tef','Hlf','Nfil3','Bhlhe40','Bhlhe41','Ciart','Csnk1d','Csnk1e','Fbxl3','Fbxl21'],
  'Apoptosis': ['Bcl2','Bcl2l1','Bcl2l11','Bax','Bak1','Bid','Bad','Bim','Mcl1','Casp3','Casp6','Casp7','Casp8','Casp9','Apaf1','Cycs','Diablo','Xiap','Birc2','Birc3','Birc5','Fadd','Fas','Tnfrsf10b','Cflar','Bok','Pmaip1','Bbc3','Bnip3','Bnip3l'],
  'Gluconeogenesis / Glycolysis': ['G6pc','Pck1','Pck2','Fbp1','Fbp2','Aldob','Gck','Hk1','Hk2','Pfkl','Pfkm','Pkm','Pklr','Ldha','Ldhb','Gapdh','Pgk1','Eno1','Eno2','Tpi1','Aldoa','Pgam1','Gpi1'],
  'Lipid Metabolism': ['Fasn','Acaca','Acacb','Scd1','Scd2','Elovl5','Elovl6','Fads1','Fads2','Hmgcr','Hmgcs1','Hmgcs2','Mvk','Fdps','Sqle','Cyp51','Dhcr7','Dhcr24','Srebf1','Srebf2','Ppara','Pparg','Nr1h3','Nr1h4','Cpt1a','Cpt2','Acox1','Acadm','Hadha','Hadhb'],
  'Xenobiotic / Drug Metabolism': ['Cyp1a1','Cyp1a2','Cyp1b1','Cyp2b10','Cyp2c29','Cyp2c55','Cyp2d22','Cyp2e1','Cyp2f2','Cyp3a11','Cyp3a25','Cyp4a10','Cyp4a14','Cyp7a1','Cyp8b1','Cyp27a1','Ugt1a1','Ugt2b5','Gstm1','Gstm2','Gstp1','Gstt1','Abcb1a','Abcb1b','Abcc2','Abcg2','Slco1b2','Sult1a1','Sult2a1','Nqo1','Ephx1','Aldh1a1','Ces1','Ces2a','Fmo3','Fmo5','Por','Ahr','Nr1i2','Nr1i3'],
  'Immune / Inflammatory': ['Tnf','Il1b','Il6','Il10','Ifng','Cxcl1','Cxcl2','Ccl2','Ccl5','Nfkb1','Nfkb2','Rela','Stat1','Stat3','Jak1','Jak2','Irf1','Irf3','Irf7','Tlr2','Tlr4','Myd88','Nlrp3','Il1a','Csf1','Csf2','Cd14','Nos2','Ptgs2','Hmox1'],
  'Autophagy': ['Atg3','Atg4b','Atg5','Atg7','Atg12','Atg13','Atg14','Atg16l1','Becn1','Map1lc3a','Map1lc3b','Sqstm1','Bnip3','Bnip3l','Lamp1','Lamp2','Ulk1','Ulk2','Pik3c3','Rb1cc1','Wipi1','Wipi2','Tfeb','Ctsd','Ctsl'],
  'Oxidative Stress': ['Sod1','Sod2','Cat','Gpx1','Gpx2','Gpx4','Gsr','Txn1','Txn2','Txnrd1','Txnrd2','Prdx1','Prdx2','Prdx3','Prdx4','Prdx5','Prdx6','Nfe2l2','Keap1','Hmox1','Hmox2','Nqo1','Gclc','Gclm','Gss'],
  'Amino Acid Metabolism': ['Got1','Got2','Gpt','Gpt2','Glud1','Gls','Gls2','Oat','Ass1','Asl','Arg1','Arg2','Nos1','Nos2','Nos3','Mat1a','Mat2a','Bhmt','Cbs','Cth','Mtr','Mthfr','Pah','Tat','Hpd','Fah'],
  'mTOR / Growth Signaling': ['Mtor','Rptor','Rictor','Tsc1','Tsc2','Rheb','Akt1','Akt2','Pten','Pik3ca','Pik3cb','Pik3r1','Rps6kb1','Eif4ebp1','Eif4e','Ulk1','Deptor','Mlst8','Igf1','Igf1r','Insr','Irs1','Irs2','Foxo1','Foxo3'],
  'Chromatin / Epigenetic': ['Hdac1','Hdac2','Hdac3','Hdac4','Hdac5','Hdac6','Sirt1','Sirt2','Sirt3','Sirt6','Sirt7','Kat2a','Kat2b','Ep300','Crebbp','Ezh2','Suz12','Eed','Kdm1a','Kdm5a','Kdm6a','Dnmt1','Dnmt3a','Dnmt3b','Tet1','Tet2','Tet3'],
  'Mitochondrial / OXPHOS': ['Ndufa1','Ndufa2','Ndufb5','Ndufs1','Ndufs2','Ndufs3','Sdha','Sdhb','Sdhc','Uqcrc1','Uqcrc2','Uqcrfs1','Cox4i1','Cox5a','Cox5b','Cox6a1','Cox7a2','Atp5a1','Atp5b','Atp5c1','Atp5d','Atp5o','Cs','Aco2','Idh2','Idh3a','Ogdh','Sucla2','Suclg1','Mdh2','Fh1','Dlat','Dld','Pdha1'],
  'Unfolded Protein Response': ['Hspa5','Hsp90b1','Ddit3','Atf4','Atf6','Ern1','Eif2ak3','Xbp1','Dnajb9','Dnajc3','Hyou1','Calr','Canx','P4hb','Pdia3','Pdia4','Pdia6','Ero1l','Herpud1','Derl1','Vimp','Syvn1'],
};

function loadDataset(filePath: string): { geneData: Map<string, number[]>; timepoints: number[] } {
  const content = fs.readFileSync(filePath, 'utf-8');
  const records = parse(content, { columns: true, skip_empty_lines: true }) as Record<string, string>[];

  const geneData = new Map<string, number[]>();
  let timepoints: number[] = [];

  if (records.length > 0) {
    const headers = Object.keys(records[0]).filter(k => k !== 'Gene' && k !== 'gene');
    const parsed = headers.map((h, idx) => {
      const match = h.match(/(?:CT|ZT|T)(\d+)/i) || h.match(/(\d+)/);
      return { idx, time: match ? parseInt(match[1]) : idx };
    });
    parsed.sort((a, b) => a.time - b.time);
    timepoints = parsed.map(p => p.time);
    const colOrder = parsed.map(p => headers[p.idx]);

    for (const record of records) {
      const gene = record.Gene || record.gene || Object.values(record)[0];
      if (!gene) continue;
      const values = colOrder
        .map(col => parseFloat(record[col]))
        .filter(v => !isNaN(v));
      if (values.length > 0) {
        geneData.set(gene, values);
      }
    }
  }

  return { geneData, timepoints };
}

function normalizeGeneName(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

function olsRegression(X: number[][], y: number[]): { coefficients: number[]; residuals: number[]; stdErrors: number[] } {
  const n = X.length;
  const k = X[0].length;
  if (n <= k) {
    return { coefficients: new Array(k).fill(0), residuals: new Array(n).fill(0), stdErrors: new Array(k).fill(Infinity) };
  }

  const XT = X[0].map((_, j) => X.map(row => row[j]));
  const XTX: number[][] = [];
  for (let i = 0; i < k; i++) {
    XTX[i] = [];
    for (let j = 0; j < k; j++) {
      let s = 0;
      for (let m = 0; m < n; m++) s += XT[i][m] * X[m][j];
      XTX[i][j] = s;
    }
  }
  const XTy: number[] = [];
  for (let i = 0; i < k; i++) {
    let s = 0;
    for (let m = 0; m < n; m++) s += XT[i][m] * y[m];
    XTy[i] = s;
  }

  let XTXInv: number[][];
  try {
    XTXInv = invertMatrix(XTX);
  } catch {
    return { coefficients: new Array(k).fill(0), residuals: new Array(n).fill(0), stdErrors: new Array(k).fill(Infinity) };
  }

  const coefficients: number[] = [];
  for (let i = 0; i < k; i++) {
    let s = 0;
    for (let j = 0; j < k; j++) s += XTXInv[i][j] * XTy[j];
    coefficients[i] = s;
  }

  if (coefficients.some(c => !isFinite(c))) {
    return { coefficients: new Array(k).fill(0), residuals: new Array(n).fill(0), stdErrors: new Array(k).fill(Infinity) };
  }

  const predictions = X.map(row => row.reduce((s, x, i) => s + x * coefficients[i], 0));
  const residuals = y.map((v, i) => v - predictions[i]);
  const ssRes = residuals.reduce((a, r) => a + r * r, 0);
  const df = n - k;
  const mse = df > 0 ? ssRes / df : 0;
  const stdErrors = coefficients.map((_, i) => {
    const v = mse * XTXInv[i][i];
    return v > 0 ? Math.sqrt(v) : Infinity;
  });

  return { coefficients, residuals, stdErrors };
}

function invertMatrix(M: number[][]): number[][] {
  const n = M.length;
  const aug: number[][] = M.map((row, i) => {
    const r = [...row];
    for (let j = 0; j < n; j++) r.push(i === j ? 1 : 0);
    return r;
  });
  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(aug[k][i]) > Math.abs(aug[maxRow][i])) maxRow = k;
    }
    [aug[i], aug[maxRow]] = [aug[maxRow], aug[i]];
    if (Math.abs(aug[i][i]) < 1e-12) throw new Error('Singular matrix');
    const pivot = aug[i][i];
    for (let j = 0; j < 2 * n; j++) aug[i][j] /= pivot;
    for (let k = 0; k < n; k++) {
      if (k === i) continue;
      const factor = aug[k][i];
      for (let j = 0; j < 2 * n; j++) aug[k][j] -= factor * aug[i][j];
    }
  }
  return aug.map(row => row.slice(n));
}

function studentTCDF(t: number, df: number): number {
  if (df <= 0) return 0.5;
  const x = df / (df + t * t);
  return t >= 0 ? 1 - 0.5 * incompleteBeta(x, df / 2, 0.5) : 0.5 * incompleteBeta(x, df / 2, 0.5);
}

function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lnBeta = lnGamma(a) + lnGamma(b) - lnGamma(a + b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lnBeta);
  if (x < (a + 1) / (a + b + 2)) {
    return front * cfBeta(x, a, b) / a;
  } else {
    return 1 - front * cfBeta(1 - x, b, a) / b;
  }
}

function cfBeta(x: number, a: number, b: number): number {
  const maxIter = 200;
  const eps = 1e-10;
  let qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - qab * x / qap;
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= maxIter; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d;
    c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30;
    h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d;
    c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < eps) break;
  }
  return h;
}

function lnGamma(x: number): number {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x, tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += c[j] / ++y;
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}

function fDistCDF(f: number, df1: number, df2: number): number {
  if (f <= 0 || df1 <= 0 || df2 <= 0) return 0;
  const x = df2 / (df2 + df1 * f);
  return 1 - incompleteBeta(x, df2 / 2, df1 / 2);
}

interface GeneCouplingResult {
  gene: string;
  uncoupledAIC: number;
  coupledAIC: number;
  deltaAIC: number;
  uncoupledBIC: number;
  coupledBIC: number;
  deltaBIC: number;
  uncoupledR2: number;
  coupledR2: number;
  deltaR2: number;
  couplingCoefficient: number;
  couplingPValue: number;
  fStatistic: number;
  fPValue: number;
  fdrQ: number;
  significant: boolean;
  clockPredictor: string;
}

interface PathwayEnrichment {
  pathway: string;
  genesInPathway: number;
  coupledInPathway: number;
  totalCoupled: number;
  totalGenes: number;
  foldEnrichment: number;
  pValue: number;
  fdrQ: number;
  coupledGenes: string[];
}

export interface GenomeWideCouplingResult {
  dataset: string;
  totalGenesAnalyzed: number;
  totalSignificant: number;
  fdrThreshold: number;
  clockPredictor: string;
  topCoupledGenes: GeneCouplingResult[];
  allResults: GeneCouplingResult[];
  pathwayEnrichment: PathwayEnrichment[];
  summary: {
    percentCoupled: number;
    meanDeltaAIC: number;
    medianDeltaAIC: number;
    topPathways: string[];
    knownClockGenesCoupled: string[];
    novelFindings: string[];
  };
  interpretation: string;
}

function fitAR2Simple(values: number[]): { r2: number; aic: number; bic: number; residuals: number[] } {
  const n = values.length - 2;
  if (n < 4) return { r2: 0, aic: Infinity, bic: Infinity, residuals: [] };

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
  const bic = n * Math.log(Math.max(sigma2, 1e-20)) + k * Math.log(n);
  return { r2, aic, bic, residuals: reg.residuals };
}

function fitAR2WithExogenous(values: number[], exogenous: number[]): { gammaExog: number; gammaPValue: number; r2: number; aic: number; bic: number; residuals: number[] } {
  const n = values.length - 2;
  if (n < 5) return { gammaExog: 0, gammaPValue: 1, r2: 0, aic: Infinity, bic: Infinity, residuals: [] };

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
  const bic = n * Math.log(Math.max(sigma2, 1e-20)) + k * Math.log(n);

  const df = n - k;
  const gammaSE = reg.stdErrors ? reg.stdErrors[3] : Infinity;
  const gammaT = gammaSE > 0 && isFinite(gammaSE) ? reg.coefficients[3] / gammaSE : 0;
  const gammaPValue = df > 0 ? 2 * (1 - studentTCDF(Math.abs(gammaT), df)) : 1;

  return { gammaExog: reg.coefficients[3], gammaPValue, r2, aic, bic, residuals: reg.residuals };
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

function hypergeometricTest(k: number, K: number, n: number, N: number): number {
  if (K === 0 || n === 0 || N === 0) return 1;
  let pValue = 0;
  for (let i = k; i <= Math.min(K, n); i++) {
    pValue += hypergeometricPMF(i, K, N - K, n);
  }
  return Math.min(pValue, 1);
}

function hypergeometricPMF(k: number, K: number, notK: number, n: number): number {
  const N = K + notK;
  const logP = logChoose(K, k) + logChoose(notK, n - k) - logChoose(N, n);
  return Math.exp(logP);
}

function logChoose(n: number, k: number): number {
  if (k < 0 || k > n) return -Infinity;
  if (k === 0 || k === n) return 0;
  return logFactorial(n) - logFactorial(k) - logFactorial(n - k);
}

const logFactCache: number[] = [0, 0];
function logFactorial(n: number): number {
  if (n <= 1) return 0;
  if (logFactCache[n] !== undefined) return logFactCache[n];
  let result = 0;
  for (let i = 2; i <= n; i++) {
    result += Math.log(i);
    logFactCache[i] = result;
  }
  return result;
}

export function runGenomeWideCoupling(datasetPath: string, clockPredictorName: string = 'Arntl'): GenomeWideCouplingResult {
  const { geneData, timepoints } = loadDataset(datasetPath);
  const dataset = datasetPath.split('/').pop() || datasetPath;

  let clockValues = geneData.get(clockPredictorName);
  if (!clockValues) {
    const lowerTarget = clockPredictorName.toLowerCase();
    const entries = Array.from(geneData.entries());
    for (let ei = 0; ei < entries.length; ei++) {
      if (entries[ei][0].toLowerCase() === lowerTarget) {
        clockValues = entries[ei][1];
        break;
      }
    }
  }
  if (!clockValues || clockValues.length < 8) {
    throw new Error(`Clock predictor gene '${clockPredictorName}' not found or has insufficient data points`);
  }

  const clockGenesLower = new Set(CLOCK_GENES.map(g => g.toLowerCase()));
  const allGenes = Array.from(geneData.keys()).filter(g => !clockGenesLower.has(g.toLowerCase()));

  const results: GeneCouplingResult[] = [];
  const minPoints = 8;

  for (const gene of allGenes) {
    const values = geneData.get(gene)!;
    if (values.length < minPoints) continue;

    const variance = (() => {
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      return values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
    })();
    if (variance < 1e-10) continue;

    const uncoupled = fitAR2Simple(values);
    const coupled = fitAR2WithExogenous(values, clockValues);

    if (uncoupled.residuals.length === 0 || coupled.residuals.length === 0) continue;

    const ssResUnc = uncoupled.residuals.reduce((a, r) => a + r * r, 0);
    const ssResCoup = coupled.residuals.reduce((a, r) => a + r * r, 0);
    const nObs = uncoupled.residuals.length;
    const dfCoupled = nObs - 4;

    let fStat = 0, fPValue = 1;
    if (dfCoupled > 0 && ssResCoup > 0) {
      fStat = ((ssResUnc - ssResCoup) / 1) / (ssResCoup / dfCoupled);
      fPValue = fStat > 0 ? 1 - fDistCDF(fStat, 1, dfCoupled) : 1;
    }

    results.push({
      gene,
      uncoupledAIC: uncoupled.aic,
      coupledAIC: coupled.aic,
      deltaAIC: uncoupled.aic - coupled.aic,
      uncoupledBIC: uncoupled.bic,
      coupledBIC: coupled.bic,
      deltaBIC: uncoupled.bic - coupled.bic,
      uncoupledR2: uncoupled.r2,
      coupledR2: coupled.r2,
      deltaR2: coupled.r2 - uncoupled.r2,
      couplingCoefficient: coupled.gammaExog,
      couplingPValue: coupled.gammaPValue,
      fStatistic: fStat,
      fPValue,
      fdrQ: 1,
      significant: false,
      clockPredictor: clockPredictorName
    });
  }

  const pValues = results.map((r, i) => ({ index: i, p: r.fPValue }));
  const qValues = benjaminiHochberg(pValues);
  const fdrThreshold = 0.05;

  for (let i = 0; i < results.length; i++) {
    results[i].fdrQ = qValues[i];
    results[i].significant = qValues[i] < fdrThreshold && results[i].deltaAIC > 2;
  }

  results.sort((a, b) => a.fdrQ - b.fdrQ || b.deltaAIC - a.deltaAIC);

  const significantGenesLower = new Set(results.filter(r => r.significant).map(r => r.gene.toLowerCase()));
  const analyzedGenesLower = new Set(results.map(r => r.gene.toLowerCase()));
  const geneNameMap = new Map(results.map(r => [r.gene.toLowerCase(), r.gene]));

  const pathwayResults: PathwayEnrichment[] = [];
  for (const [pathway, genes] of Object.entries(FUNCTIONAL_GENE_SETS)) {
    const genesInDataset = genes.filter(g => analyzedGenesLower.has(g.toLowerCase()));
    const coupledInPathway = genesInDataset.filter(g => significantGenesLower.has(g.toLowerCase()));

    if (genesInDataset.length < 2) continue;

    const K = genesInDataset.length;
    const k = coupledInPathway.length;
    const N = analyzedGenesLower.size;
    const n = significantGenesLower.size;

    const expected = n > 0 ? (K / N) * n : 0;
    const foldEnrichment = expected > 0 ? k / expected : 0;
    const pValue = hypergeometricTest(k, K, n, N);

    pathwayResults.push({
      pathway,
      genesInPathway: K,
      coupledInPathway: k,
      totalCoupled: n,
      totalGenes: N,
      foldEnrichment,
      pValue,
      fdrQ: 1,
      coupledGenes: coupledInPathway.map(g => geneNameMap.get(g.toLowerCase()) || g)
    });
  }

  const pathwayPValues = pathwayResults.map((r, i) => ({ index: i, p: r.pValue }));
  const pathwayQ = benjaminiHochberg(pathwayPValues);
  for (let i = 0; i < pathwayResults.length; i++) {
    pathwayResults[i].fdrQ = pathwayQ[i];
  }
  pathwayResults.sort((a, b) => a.pValue - b.pValue);

  const significantCount = results.filter(r => r.significant).length;
  const allDeltaAIC = results.map(r => r.deltaAIC).sort((a, b) => a - b);
  const medianDeltaAIC = allDeltaAIC.length > 0 ? allDeltaAIC[Math.floor(allDeltaAIC.length / 2)] : 0;
  const meanDeltaAIC = results.length > 0 ? results.reduce((a, r) => a + r.deltaAIC, 0) / results.length : 0;

  const knownCellCycleSet = new Set(['cdk1','cdk2','cdk4','cdk6','ccna2','ccnb1','ccnb2','ccnd1','ccne1','ccne2','cdkn1a','cdkn1b','chek1','chek2','plk1','aurka','aurkb','wee1']);
  const knownClockCoupled = results.filter(r => r.significant && clockGenesLower.has(r.gene.toLowerCase())).map(r => r.gene);
  const knownCellCycleCoupled = results.filter(r => r.significant && knownCellCycleSet.has(r.gene.toLowerCase())).map(r => r.gene);

  const novelGenes = results
    .filter(r => r.significant)
    .filter(r => !clockGenesLower.has(r.gene.toLowerCase()))
    .filter(r => !knownCellCycleSet.has(r.gene.toLowerCase()))
    .slice(0, 20)
    .map(r => r.gene);

  const topPathways = pathwayResults
    .filter(r => r.pValue < 0.05 && r.coupledInPathway > 0)
    .slice(0, 5)
    .map(r => r.pathway);

  let interpretation = `Genome-wide coupled model scan: tested ${results.length} genes for ${clockPredictorName} (BMAL1) coupling. `;
  interpretation += `${significantCount} genes (${(significantCount / results.length * 100).toFixed(1)}%) show significant coupling (FDR < ${fdrThreshold}, ΔAIC > 2). `;
  interpretation += `Median ΔAIC across all genes: ${medianDeltaAIC.toFixed(2)} (positive = coupling helps). `;

  if (topPathways.length > 0) {
    interpretation += `Top enriched pathways: ${topPathways.join(', ')}. `;
  }
  if (novelGenes.length > 0) {
    interpretation += `Novel clock-coupled genes (not in predefined clock/cell-cycle lists): ${novelGenes.slice(0, 10).join(', ')}${novelGenes.length > 10 ? '...' : ''}. `;
  }
  interpretation += `Note: Statistical coupling does not prove causal regulation. FDR correction (Benjamini-Hochberg) applied to control false discovery rate across ${results.length} simultaneous tests.`;

  return {
    dataset,
    totalGenesAnalyzed: results.length,
    totalSignificant: significantCount,
    fdrThreshold,
    clockPredictor: clockPredictorName,
    topCoupledGenes: results.filter(r => r.significant).slice(0, 50),
    allResults: results,
    pathwayEnrichment: pathwayResults,
    summary: {
      percentCoupled: results.length > 0 ? (significantCount / results.length) * 100 : 0,
      meanDeltaAIC,
      medianDeltaAIC,
      topPathways,
      knownClockGenesCoupled: [...knownClockCoupled, ...knownCellCycleCoupled],
      novelFindings: novelGenes
    },
    interpretation
  };
}
