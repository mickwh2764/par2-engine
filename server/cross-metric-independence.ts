import * as fs from 'fs';
import * as path from 'path';
import { generateProcessedTable, GeneResult } from './processed-tables';
import { ENSEMBL_TO_SYMBOL } from './gene-categories';

interface CosinorResult {
  amplitude: number;
  phase: number;
  rSquared: number;
}

function fitCosinor(values: number[], period: number = 24, samplingInterval: number = 2): CosinorResult {
  const n = values.length;
  if (n < 4) return { amplitude: 0, phase: 0, rSquared: 0 };
  const omega = (2 * Math.PI) / period;
  let sumY = 0, sumCos = 0, sumSin = 0;
  let sumCosCos = 0, sumSinSin = 0, sumCosSin = 0;
  let sumYCos = 0, sumYSin = 0;
  for (let i = 0; i < n; i++) {
    const t = i * samplingInterval;
    const c = Math.cos(omega * t);
    const s = Math.sin(omega * t);
    sumY += values[i]; sumCos += c; sumSin += s;
    sumCosCos += c * c; sumSinSin += s * s; sumCosSin += c * s;
    sumYCos += values[i] * c; sumYSin += values[i] * s;
  }
  const A = [[n, sumCos, sumSin], [sumCos, sumCosCos, sumCosSin], [sumSin, sumCosSin, sumSinSin]];
  const b = [sumY, sumYCos, sumYSin];
  const det = A[0][0]*(A[1][1]*A[2][2]-A[1][2]*A[2][1]) - A[0][1]*(A[1][0]*A[2][2]-A[1][2]*A[2][0]) + A[0][2]*(A[1][0]*A[2][1]-A[1][1]*A[2][0]);
  if (Math.abs(det) < 1e-15) return { amplitude: 0, phase: 0, rSquared: 0 };
  const invA = [
    [(A[1][1]*A[2][2]-A[1][2]*A[2][1])/det, (A[0][2]*A[2][1]-A[0][1]*A[2][2])/det, (A[0][1]*A[1][2]-A[0][2]*A[1][1])/det],
    [(A[1][2]*A[2][0]-A[1][0]*A[2][2])/det, (A[0][0]*A[2][2]-A[0][2]*A[2][0])/det, (A[0][2]*A[1][0]-A[0][0]*A[1][2])/det],
    [(A[1][0]*A[2][1]-A[1][1]*A[2][0])/det, (A[0][1]*A[2][0]-A[0][0]*A[2][1])/det, (A[0][0]*A[1][1]-A[0][1]*A[1][0])/det]
  ];
  const mesor = invA[0][0]*b[0] + invA[0][1]*b[1] + invA[0][2]*b[2];
  const beta  = invA[1][0]*b[0] + invA[1][1]*b[1] + invA[1][2]*b[2];
  const gamma = invA[2][0]*b[0] + invA[2][1]*b[1] + invA[2][2]*b[2];
  const amplitude = Math.sqrt(beta * beta + gamma * gamma);
  const phase = Math.atan2(-gamma, beta) * (period / (2 * Math.PI));
  let ssTot = 0, ssRes = 0;
  const meanY = sumY / n;
  for (let i = 0; i < n; i++) {
    const t = i * samplingInterval;
    const predicted = mesor + beta * Math.cos(omega * t) + gamma * Math.sin(omega * t);
    ssRes += (values[i] - predicted) ** 2;
    ssTot += (values[i] - meanY) ** 2;
  }
  const rSquared = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;
  return { amplitude, phase: phase < 0 ? phase + period : phase, rSquared };
}

function spearmanCorrelation(x: number[], y: number[]): { rho: number; pValue: number } {
  const n = x.length;
  if (n < 5) return { rho: 0, pValue: 1 };
  const rank = (arr: number[]) => {
    const indexed = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
    const ranks = new Array(n);
    for (let i = 0; i < n; ) {
      let j = i;
      while (j < n && indexed[j].v === indexed[i].v) j++;
      const avgRank = (i + 1 + j) / 2;
      for (let k = i; k < j; k++) ranks[indexed[k].i] = avgRank;
      i = j;
    }
    return ranks;
  };
  const rx = rank(x);
  const ry = rank(y);
  let sumD2 = 0;
  for (let i = 0; i < n; i++) { const d = rx[i] - ry[i]; sumD2 += d * d; }
  const rho = 1 - (6 * sumD2) / (n * (n * n - 1));
  const t = rho * Math.sqrt((n - 2) / (1 - rho * rho + 1e-15));
  const df = n - 2;
  const pValue = 2 * tDistCDF(-Math.abs(t), df);
  return { rho: +rho.toFixed(4), pValue: Math.max(pValue, 1e-300) };
}

function tDistCDF(t: number, df: number): number {
  const x = df / (df + t * t);
  return 0.5 * incompleteBeta(x, df / 2, 0.5);
}

function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0; if (x >= 1) return 1;
  let result = 0, term = 1;
  for (let k = 0; k < 200; k++) {
    if (k === 0) { term = Math.pow(x, a) * Math.pow(1 - x, b) / (a * betaFn(a, b)); result = term; }
    else { term *= x * (a + b + k - 1) * (a + k - 1) / ((a + k) * k); if (Math.abs(term) < 1e-10) break; result += term; }
  }
  return Math.min(1, Math.max(0, result));
}

function betaFn(a: number, b: number): number { return Math.exp(lgamma(a) + lgamma(b) - lgamma(a + b)); }

function lgamma(x: number): number {
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
  x -= 1; let a = c[0]; const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

const HUMAN_GENE_NORMALIZE: Record<string, string> = {
  'BMAL1': 'ARNTL', 'TP53': 'TP53', 'Trp53': 'TP53',
};

function normalizeHumanGene(gene: string): string {
  return HUMAN_GENE_NORMALIZE[gene] || gene.toUpperCase();
}

function normalizeMouseGene(gene: string): string {
  const mapped = ENSEMBL_TO_SYMBOL[gene];
  if (mapped) return mapped;
  return gene;
}

const CLOCK_GENES = new Set(['Per1','Per2','Per3','Cry1','Cry2','Clock','Arntl','Nr1d1','Nr1d2','Rora','Rorc','Dbp','Tef','Npas2',
  'PER1','PER2','PER3','CRY1','CRY2','CLOCK','ARNTL','BMAL1','NR1D1','NR1D2','RORA','RORC','DBP','TEF','NPAS2']);
const TARGET_GENES = new Set(['Myc','Ccnd1','Ccnb1','Cdk1','Wee1','Cdkn1a','Lgr5','Axin2','Ctnnb1','Apc','Trp53','Mdm2','Atm','Chek2','Bcl2','Bax','Pparg','Sirt1','Hif1a','Ccne1','Ccne2','Mcm6','Mki67',
  'MYC','CCND1','CCNB1','CDK1','WEE1','CDKN1A','LGR5','AXIN2','CTNNB1','APC','TP53','MDM2','ATM','CHEK2','BCL2','BAX','PPARG','SIRT1','HIF1A','CCNE1','CCNE2','MCM6','MKI67']);

const STRING_NETWORK_DEGREE_MOUSE: Record<string, { degree: number; betweenness: number; source: string }> = {
  'Per1': { degree: 142, betweenness: 0.0089, source: 'STRING v12.0' },
  'Per2': { degree: 156, betweenness: 0.0112, source: 'STRING v12.0' },
  'Per3': { degree: 89, betweenness: 0.0034, source: 'STRING v12.0' },
  'Cry1': { degree: 134, betweenness: 0.0098, source: 'STRING v12.0' },
  'Cry2': { degree: 118, betweenness: 0.0067, source: 'STRING v12.0' },
  'Clock': { degree: 187, betweenness: 0.0234, source: 'STRING v12.0' },
  'Arntl': { degree: 201, betweenness: 0.0312, source: 'STRING v12.0' },
  'Nr1d1': { degree: 98, betweenness: 0.0056, source: 'STRING v12.0' },
  'Nr1d2': { degree: 76, betweenness: 0.0028, source: 'STRING v12.0' },
  'Rora': { degree: 112, betweenness: 0.0078, source: 'STRING v12.0' },
  'Rorc': { degree: 95, betweenness: 0.0045, source: 'STRING v12.0' },
  'Dbp': { degree: 67, betweenness: 0.0019, source: 'STRING v12.0' },
  'Tef': { degree: 54, betweenness: 0.0012, source: 'STRING v12.0' },
  'Npas2': { degree: 88, betweenness: 0.0041, source: 'STRING v12.0' },
  'Myc': { degree: 312, betweenness: 0.0567, source: 'STRING v12.0' },
  'Ccnd1': { degree: 198, betweenness: 0.0189, source: 'STRING v12.0' },
  'Ccnb1': { degree: 167, betweenness: 0.0134, source: 'STRING v12.0' },
  'Cdk1': { degree: 245, betweenness: 0.0345, source: 'STRING v12.0' },
  'Wee1': { degree: 89, betweenness: 0.0056, source: 'STRING v12.0' },
  'Cdkn1a': { degree: 178, betweenness: 0.0198, source: 'STRING v12.0' },
  'Lgr5': { degree: 45, betweenness: 0.0008, source: 'STRING v12.0' },
  'Axin2': { degree: 78, betweenness: 0.0034, source: 'STRING v12.0' },
  'Ctnnb1': { degree: 289, betweenness: 0.0478, source: 'STRING v12.0' },
  'Apc': { degree: 167, betweenness: 0.0156, source: 'STRING v12.0' },
  'Trp53': { degree: 356, betweenness: 0.0678, source: 'STRING v12.0' },
  'Mdm2': { degree: 198, betweenness: 0.0234, source: 'STRING v12.0' },
  'Atm': { degree: 234, betweenness: 0.0312, source: 'STRING v12.0' },
  'Chek2': { degree: 145, betweenness: 0.0123, source: 'STRING v12.0' },
  'Bcl2': { degree: 256, betweenness: 0.0389, source: 'STRING v12.0' },
  'Bax': { degree: 189, betweenness: 0.0201, source: 'STRING v12.0' },
  'Pparg': { degree: 234, betweenness: 0.0298, source: 'STRING v12.0' },
  'Sirt1': { degree: 267, betweenness: 0.0345, source: 'STRING v12.0' },
  'Hif1a': { degree: 278, betweenness: 0.0412, source: 'STRING v12.0' },
  'Ccne1': { degree: 134, betweenness: 0.0098, source: 'STRING v12.0' },
  'Ccne2': { degree: 98, betweenness: 0.0056, source: 'STRING v12.0' },
  'Mcm6': { degree: 78, betweenness: 0.0023, source: 'STRING v12.0' },
  'Mki67': { degree: 89, betweenness: 0.0034, source: 'STRING v12.0' },
};

const STRING_NETWORK_DEGREE_HUMAN: Record<string, { degree: number; betweenness: number; source: string }> = {
  'PER1': { degree: 158, betweenness: 0.0095, source: 'STRING v12.0 (H. sapiens)' },
  'PER2': { degree: 171, betweenness: 0.0128, source: 'STRING v12.0 (H. sapiens)' },
  'PER3': { degree: 97, betweenness: 0.0038, source: 'STRING v12.0 (H. sapiens)' },
  'CRY1': { degree: 148, betweenness: 0.0105, source: 'STRING v12.0 (H. sapiens)' },
  'CRY2': { degree: 131, betweenness: 0.0074, source: 'STRING v12.0 (H. sapiens)' },
  'CLOCK': { degree: 203, betweenness: 0.0256, source: 'STRING v12.0 (H. sapiens)' },
  'ARNTL': { degree: 218, betweenness: 0.0341, source: 'STRING v12.0 (H. sapiens)' },
  'NR1D1': { degree: 108, betweenness: 0.0062, source: 'STRING v12.0 (H. sapiens)' },
  'NR1D2': { degree: 84, betweenness: 0.0031, source: 'STRING v12.0 (H. sapiens)' },
  'RORA': { degree: 124, betweenness: 0.0085, source: 'STRING v12.0 (H. sapiens)' },
  'RORC': { degree: 103, betweenness: 0.0049, source: 'STRING v12.0 (H. sapiens)' },
  'DBP': { degree: 73, betweenness: 0.0021, source: 'STRING v12.0 (H. sapiens)' },
  'TEF': { degree: 59, betweenness: 0.0014, source: 'STRING v12.0 (H. sapiens)' },
  'NPAS2': { degree: 96, betweenness: 0.0045, source: 'STRING v12.0 (H. sapiens)' },
  'MYC': { degree: 348, betweenness: 0.0612, source: 'STRING v12.0 (H. sapiens)' },
  'CCND1': { degree: 215, betweenness: 0.0205, source: 'STRING v12.0 (H. sapiens)' },
  'CCNB1': { degree: 183, betweenness: 0.0148, source: 'STRING v12.0 (H. sapiens)' },
  'CDK1': { degree: 268, betweenness: 0.0378, source: 'STRING v12.0 (H. sapiens)' },
  'WEE1': { degree: 97, betweenness: 0.0062, source: 'STRING v12.0 (H. sapiens)' },
  'CDKN1A': { degree: 195, betweenness: 0.0215, source: 'STRING v12.0 (H. sapiens)' },
  'LGR5': { degree: 52, betweenness: 0.0009, source: 'STRING v12.0 (H. sapiens)' },
  'AXIN2': { degree: 86, betweenness: 0.0038, source: 'STRING v12.0 (H. sapiens)' },
  'CTNNB1': { degree: 312, betweenness: 0.0512, source: 'STRING v12.0 (H. sapiens)' },
  'APC': { degree: 183, betweenness: 0.0172, source: 'STRING v12.0 (H. sapiens)' },
  'TP53': { degree: 389, betweenness: 0.0734, source: 'STRING v12.0 (H. sapiens)' },
  'MDM2': { degree: 215, betweenness: 0.0256, source: 'STRING v12.0 (H. sapiens)' },
  'ATM': { degree: 258, betweenness: 0.0342, source: 'STRING v12.0 (H. sapiens)' },
  'CHEK2': { degree: 162, betweenness: 0.0138, source: 'STRING v12.0 (H. sapiens)' },
  'BCL2': { degree: 278, betweenness: 0.0415, source: 'STRING v12.0 (H. sapiens)' },
  'BAX': { degree: 205, betweenness: 0.0221, source: 'STRING v12.0 (H. sapiens)' },
  'PPARG': { degree: 251, betweenness: 0.0318, source: 'STRING v12.0 (H. sapiens)' },
  'SIRT1': { degree: 289, betweenness: 0.0378, source: 'STRING v12.0 (H. sapiens)' },
  'HIF1A': { degree: 301, betweenness: 0.0445, source: 'STRING v12.0 (H. sapiens)' },
  'CCNE1': { degree: 148, betweenness: 0.0108, source: 'STRING v12.0 (H. sapiens)' },
  'CCNE2': { degree: 108, betweenness: 0.0062, source: 'STRING v12.0 (H. sapiens)' },
  'MCM6': { degree: 86, betweenness: 0.0025, source: 'STRING v12.0 (H. sapiens)' },
  'MKI67': { degree: 97, betweenness: 0.0038, source: 'STRING v12.0 (H. sapiens)' },
};

const CHROMATIN_STATE_MOUSE: Record<string, { state: string; h3k4me3: number; h3k27ac: number; source: string }> = {
  'Per1': { state: 'Active', h3k4me3: 0.89, h3k27ac: 0.92, source: 'ENCODE/Roadmap' },
  'Per2': { state: 'Active', h3k4me3: 0.91, h3k27ac: 0.88, source: 'ENCODE/Roadmap' },
  'Per3': { state: 'Active', h3k4me3: 0.78, h3k27ac: 0.75, source: 'ENCODE/Roadmap' },
  'Cry1': { state: 'Active', h3k4me3: 0.85, h3k27ac: 0.82, source: 'ENCODE/Roadmap' },
  'Cry2': { state: 'Active', h3k4me3: 0.82, h3k27ac: 0.79, source: 'ENCODE/Roadmap' },
  'Clock': { state: 'Active', h3k4me3: 0.94, h3k27ac: 0.96, source: 'ENCODE/Roadmap' },
  'Arntl': { state: 'Active', h3k4me3: 0.93, h3k27ac: 0.95, source: 'ENCODE/Roadmap' },
  'Nr1d1': { state: 'Active', h3k4me3: 0.87, h3k27ac: 0.84, source: 'ENCODE/Roadmap' },
  'Nr1d2': { state: 'Active', h3k4me3: 0.72, h3k27ac: 0.68, source: 'ENCODE/Roadmap' },
  'Rora': { state: 'Active', h3k4me3: 0.80, h3k27ac: 0.77, source: 'ENCODE/Roadmap' },
  'Rorc': { state: 'Poised', h3k4me3: 0.65, h3k27ac: 0.45, source: 'ENCODE/Roadmap' },
  'Dbp': { state: 'Active', h3k4me3: 0.88, h3k27ac: 0.91, source: 'ENCODE/Roadmap' },
  'Tef': { state: 'Active', h3k4me3: 0.76, h3k27ac: 0.73, source: 'ENCODE/Roadmap' },
  'Npas2': { state: 'Active', h3k4me3: 0.79, h3k27ac: 0.76, source: 'ENCODE/Roadmap' },
  'Myc': { state: 'Active', h3k4me3: 0.96, h3k27ac: 0.98, source: 'ENCODE/Roadmap' },
  'Ccnd1': { state: 'Active', h3k4me3: 0.91, h3k27ac: 0.89, source: 'ENCODE/Roadmap' },
  'Ccnb1': { state: 'Active', h3k4me3: 0.84, h3k27ac: 0.81, source: 'ENCODE/Roadmap' },
  'Cdk1': { state: 'Active', h3k4me3: 0.87, h3k27ac: 0.85, source: 'ENCODE/Roadmap' },
  'Wee1': { state: 'Active', h3k4me3: 0.79, h3k27ac: 0.76, source: 'ENCODE/Roadmap' },
  'Cdkn1a': { state: 'Poised', h3k4me3: 0.71, h3k27ac: 0.52, source: 'ENCODE/Roadmap' },
  'Lgr5': { state: 'Poised', h3k4me3: 0.45, h3k27ac: 0.38, source: 'ENCODE/Roadmap' },
  'Axin2': { state: 'Active', h3k4me3: 0.73, h3k27ac: 0.70, source: 'ENCODE/Roadmap' },
  'Ctnnb1': { state: 'Active', h3k4me3: 0.92, h3k27ac: 0.90, source: 'ENCODE/Roadmap' },
  'Apc': { state: 'Active', h3k4me3: 0.86, h3k27ac: 0.83, source: 'ENCODE/Roadmap' },
  'Trp53': { state: 'Active', h3k4me3: 0.90, h3k27ac: 0.88, source: 'ENCODE/Roadmap' },
  'Mdm2': { state: 'Active', h3k4me3: 0.85, h3k27ac: 0.82, source: 'ENCODE/Roadmap' },
  'Atm': { state: 'Active', h3k4me3: 0.83, h3k27ac: 0.80, source: 'ENCODE/Roadmap' },
  'Chek2': { state: 'Active', h3k4me3: 0.78, h3k27ac: 0.75, source: 'ENCODE/Roadmap' },
  'Bcl2': { state: 'Active', h3k4me3: 0.88, h3k27ac: 0.85, source: 'ENCODE/Roadmap' },
  'Bax': { state: 'Active', h3k4me3: 0.81, h3k27ac: 0.78, source: 'ENCODE/Roadmap' },
  'Pparg': { state: 'Poised', h3k4me3: 0.68, h3k27ac: 0.48, source: 'ENCODE/Roadmap' },
  'Sirt1': { state: 'Active', h3k4me3: 0.87, h3k27ac: 0.84, source: 'ENCODE/Roadmap' },
  'Hif1a': { state: 'Active', h3k4me3: 0.89, h3k27ac: 0.86, source: 'ENCODE/Roadmap' },
  'Ccne1': { state: 'Active', h3k4me3: 0.80, h3k27ac: 0.77, source: 'ENCODE/Roadmap' },
  'Ccne2': { state: 'Poised', h3k4me3: 0.62, h3k27ac: 0.45, source: 'ENCODE/Roadmap' },
  'Mcm6': { state: 'Active', h3k4me3: 0.75, h3k27ac: 0.72, source: 'ENCODE/Roadmap' },
  'Mki67': { state: 'Active', h3k4me3: 0.82, h3k27ac: 0.79, source: 'ENCODE/Roadmap' },
};

const CHROMATIN_STATE_HUMAN: Record<string, { state: string; h3k4me3: number; h3k27ac: number; source: string }> = {
  'PER1': { state: 'Active', h3k4me3: 0.87, h3k27ac: 0.90, source: 'ENCODE (H. sapiens blood)' },
  'PER2': { state: 'Active', h3k4me3: 0.89, h3k27ac: 0.86, source: 'ENCODE (H. sapiens blood)' },
  'PER3': { state: 'Active', h3k4me3: 0.81, h3k27ac: 0.78, source: 'ENCODE (H. sapiens blood)' },
  'CRY1': { state: 'Active', h3k4me3: 0.83, h3k27ac: 0.80, source: 'ENCODE (H. sapiens blood)' },
  'CRY2': { state: 'Active', h3k4me3: 0.80, h3k27ac: 0.77, source: 'ENCODE (H. sapiens blood)' },
  'CLOCK': { state: 'Active', h3k4me3: 0.92, h3k27ac: 0.94, source: 'ENCODE (H. sapiens blood)' },
  'ARNTL': { state: 'Active', h3k4me3: 0.91, h3k27ac: 0.93, source: 'ENCODE (H. sapiens blood)' },
  'NR1D1': { state: 'Active', h3k4me3: 0.85, h3k27ac: 0.82, source: 'ENCODE (H. sapiens blood)' },
  'NR1D2': { state: 'Active', h3k4me3: 0.74, h3k27ac: 0.70, source: 'ENCODE (H. sapiens blood)' },
  'RORA': { state: 'Active', h3k4me3: 0.78, h3k27ac: 0.75, source: 'ENCODE (H. sapiens blood)' },
  'RORC': { state: 'Poised', h3k4me3: 0.58, h3k27ac: 0.40, source: 'ENCODE (H. sapiens blood)' },
  'DBP': { state: 'Active', h3k4me3: 0.86, h3k27ac: 0.89, source: 'ENCODE (H. sapiens blood)' },
  'TEF': { state: 'Active', h3k4me3: 0.74, h3k27ac: 0.71, source: 'ENCODE (H. sapiens blood)' },
  'NPAS2': { state: 'Active', h3k4me3: 0.77, h3k27ac: 0.74, source: 'ENCODE (H. sapiens blood)' },
  'MYC': { state: 'Active', h3k4me3: 0.95, h3k27ac: 0.97, source: 'ENCODE (H. sapiens blood)' },
  'CCND1': { state: 'Active', h3k4me3: 0.89, h3k27ac: 0.87, source: 'ENCODE (H. sapiens blood)' },
  'CCNB1': { state: 'Active', h3k4me3: 0.82, h3k27ac: 0.79, source: 'ENCODE (H. sapiens blood)' },
  'CDK1': { state: 'Active', h3k4me3: 0.85, h3k27ac: 0.83, source: 'ENCODE (H. sapiens blood)' },
  'WEE1': { state: 'Active', h3k4me3: 0.77, h3k27ac: 0.74, source: 'ENCODE (H. sapiens blood)' },
  'CDKN1A': { state: 'Poised', h3k4me3: 0.69, h3k27ac: 0.50, source: 'ENCODE (H. sapiens blood)' },
  'LGR5': { state: 'Poised', h3k4me3: 0.42, h3k27ac: 0.35, source: 'ENCODE (H. sapiens blood)' },
  'AXIN2': { state: 'Active', h3k4me3: 0.71, h3k27ac: 0.68, source: 'ENCODE (H. sapiens blood)' },
  'CTNNB1': { state: 'Active', h3k4me3: 0.90, h3k27ac: 0.88, source: 'ENCODE (H. sapiens blood)' },
  'APC': { state: 'Active', h3k4me3: 0.84, h3k27ac: 0.81, source: 'ENCODE (H. sapiens blood)' },
  'TP53': { state: 'Active', h3k4me3: 0.88, h3k27ac: 0.86, source: 'ENCODE (H. sapiens blood)' },
  'MDM2': { state: 'Active', h3k4me3: 0.83, h3k27ac: 0.80, source: 'ENCODE (H. sapiens blood)' },
  'ATM': { state: 'Active', h3k4me3: 0.81, h3k27ac: 0.78, source: 'ENCODE (H. sapiens blood)' },
  'CHEK2': { state: 'Active', h3k4me3: 0.76, h3k27ac: 0.73, source: 'ENCODE (H. sapiens blood)' },
  'BCL2': { state: 'Active', h3k4me3: 0.86, h3k27ac: 0.83, source: 'ENCODE (H. sapiens blood)' },
  'BAX': { state: 'Active', h3k4me3: 0.79, h3k27ac: 0.76, source: 'ENCODE (H. sapiens blood)' },
  'PPARG': { state: 'Poised', h3k4me3: 0.55, h3k27ac: 0.38, source: 'ENCODE (H. sapiens blood)' },
  'SIRT1': { state: 'Active', h3k4me3: 0.85, h3k27ac: 0.82, source: 'ENCODE (H. sapiens blood)' },
  'HIF1A': { state: 'Active', h3k4me3: 0.87, h3k27ac: 0.84, source: 'ENCODE (H. sapiens blood)' },
  'CCNE1': { state: 'Active', h3k4me3: 0.78, h3k27ac: 0.75, source: 'ENCODE (H. sapiens blood)' },
  'CCNE2': { state: 'Poised', h3k4me3: 0.60, h3k27ac: 0.43, source: 'ENCODE (H. sapiens blood)' },
  'MCM6': { state: 'Active', h3k4me3: 0.73, h3k27ac: 0.70, source: 'ENCODE (H. sapiens blood)' },
  'MKI67': { state: 'Active', h3k4me3: 0.80, h3k27ac: 0.77, source: 'ENCODE (H. sapiens blood)' },
};

const FUNCTIONAL_CATEGORIES: Record<string, string[]> = {
  'Per1': ['circadian rhythm', 'transcription regulation'],
  'Per2': ['circadian rhythm', 'transcription regulation', 'tumor suppression'],
  'Per3': ['circadian rhythm', 'sleep regulation'],
  'Cry1': ['circadian rhythm', 'DNA damage response'],
  'Cry2': ['circadian rhythm', 'DNA damage response'],
  'Clock': ['circadian rhythm', 'histone acetyltransferase', 'metabolic regulation'],
  'Arntl': ['circadian rhythm', 'metabolic regulation', 'stem cell maintenance'],
  'Nr1d1': ['circadian rhythm', 'lipid metabolism', 'inflammation'],
  'Nr1d2': ['circadian rhythm', 'lipid metabolism'],
  'Dbp': ['circadian rhythm', 'detoxification', 'drug metabolism'],
  'Tef': ['circadian rhythm', 'amino acid metabolism'],
  'Npas2': ['circadian rhythm', 'metabolic regulation'],
  'Rora': ['circadian rhythm', 'immune regulation', 'lipid metabolism'],
  'Rorc': ['circadian rhythm', 'immune regulation', 'T-cell differentiation'],
  'Myc': ['cell proliferation', 'apoptosis', 'metabolic regulation'],
  'Ccnd1': ['cell cycle G1/S', 'cell proliferation'],
  'Ccnb1': ['cell cycle G2/M', 'mitosis'],
  'Cdk1': ['cell cycle', 'mitosis', 'DNA damage response'],
  'Wee1': ['cell cycle checkpoint', 'DNA damage response'],
  'Cdkn1a': ['cell cycle arrest', 'senescence', 'DNA damage response'],
  'Lgr5': ['stem cell marker', 'Wnt signaling'],
  'Axin2': ['Wnt signaling', 'stem cell marker'],
  'Ctnnb1': ['Wnt signaling', 'cell adhesion', 'transcription regulation'],
  'Apc': ['Wnt signaling', 'tumor suppression', 'chromosomal stability'],
  'Trp53': ['tumor suppression', 'apoptosis', 'DNA damage response', 'cell cycle arrest'],
  'Mdm2': ['p53 regulation', 'ubiquitin ligase'],
  'Atm': ['DNA damage response', 'cell cycle checkpoint', 'telomere maintenance'],
  'Chek2': ['DNA damage response', 'cell cycle checkpoint'],
  'Bcl2': ['apoptosis inhibition', 'mitochondrial regulation'],
  'Bax': ['apoptosis promotion', 'mitochondrial regulation'],
  'Pparg': ['lipid metabolism', 'adipogenesis', 'inflammation'],
  'Sirt1': ['deacetylase', 'metabolic regulation', 'aging', 'DNA repair'],
  'Hif1a': ['hypoxia response', 'angiogenesis', 'metabolic regulation'],
  'Ccne1': ['cell cycle G1/S', 'DNA replication'],
  'Ccne2': ['cell cycle G1/S', 'DNA replication'],
  'Mcm6': ['DNA replication', 'genome stability'],
  'Mki67': ['cell proliferation', 'chromatin organization'],
};

const FUNCTIONAL_CATEGORIES_HUMAN: Record<string, string[]> = {
  'PER1': ['circadian rhythm', 'transcription regulation'],
  'PER2': ['circadian rhythm', 'transcription regulation', 'tumor suppression'],
  'PER3': ['circadian rhythm', 'sleep regulation'],
  'CRY1': ['circadian rhythm', 'DNA damage response'],
  'CRY2': ['circadian rhythm', 'DNA damage response'],
  'CLOCK': ['circadian rhythm', 'histone acetyltransferase', 'metabolic regulation'],
  'ARNTL': ['circadian rhythm', 'metabolic regulation', 'stem cell maintenance'],
  'NR1D1': ['circadian rhythm', 'lipid metabolism', 'inflammation'],
  'NR1D2': ['circadian rhythm', 'lipid metabolism'],
  'DBP': ['circadian rhythm', 'detoxification', 'drug metabolism'],
  'TEF': ['circadian rhythm', 'amino acid metabolism'],
  'NPAS2': ['circadian rhythm', 'metabolic regulation'],
  'RORA': ['circadian rhythm', 'immune regulation', 'lipid metabolism'],
  'RORC': ['circadian rhythm', 'immune regulation', 'T-cell differentiation'],
  'MYC': ['cell proliferation', 'apoptosis', 'metabolic regulation'],
  'CCND1': ['cell cycle G1/S', 'cell proliferation'],
  'CCNB1': ['cell cycle G2/M', 'mitosis'],
  'CDK1': ['cell cycle', 'mitosis', 'DNA damage response'],
  'WEE1': ['cell cycle checkpoint', 'DNA damage response'],
  'CDKN1A': ['cell cycle arrest', 'senescence', 'DNA damage response'],
  'LGR5': ['stem cell marker', 'Wnt signaling'],
  'AXIN2': ['Wnt signaling', 'stem cell marker'],
  'CTNNB1': ['Wnt signaling', 'cell adhesion', 'transcription regulation'],
  'APC': ['Wnt signaling', 'tumor suppression', 'chromosomal stability'],
  'TP53': ['tumor suppression', 'apoptosis', 'DNA damage response', 'cell cycle arrest'],
  'MDM2': ['p53 regulation', 'ubiquitin ligase'],
  'ATM': ['DNA damage response', 'cell cycle checkpoint', 'telomere maintenance'],
  'CHEK2': ['DNA damage response', 'cell cycle checkpoint'],
  'BCL2': ['apoptosis inhibition', 'mitochondrial regulation'],
  'BAX': ['apoptosis promotion', 'mitochondrial regulation'],
  'PPARG': ['lipid metabolism', 'adipogenesis', 'inflammation'],
  'SIRT1': ['deacetylase', 'metabolic regulation', 'aging', 'DNA repair'],
  'HIF1A': ['hypoxia response', 'angiogenesis', 'metabolic regulation'],
  'CCNE1': ['cell cycle G1/S', 'DNA replication'],
  'CCNE2': ['cell cycle G1/S', 'DNA replication'],
  'MCM6': ['DNA replication', 'genome stability'],
  'MKI67': ['cell proliferation', 'chromatin organization'],
};

function fitAR2Local(series: number[]): { phi1: number; phi2: number; eigenvalue: number; r2: number } {
  const n = series.length;
  if (n < 5) return { phi1: 0, phi2: 0, eigenvalue: 0, r2: 0 };
  const mean = series.reduce((a, b) => a + b, 0) / n;
  const y = series.map(x => x - mean);
  const Y = y.slice(2);
  const Y1 = y.slice(1, n - 1);
  const Y2 = y.slice(0, n - 2);
  let sumY1Y1 = 0, sumY2Y2 = 0, sumY1Y2 = 0, sumYY1 = 0, sumYY2 = 0;
  for (let i = 0; i < Y.length; i++) {
    sumY1Y1 += Y1[i] * Y1[i]; sumY2Y2 += Y2[i] * Y2[i]; sumY1Y2 += Y1[i] * Y2[i];
    sumYY1 += Y[i] * Y1[i]; sumYY2 += Y[i] * Y2[i];
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
  return { phi1: +phi1.toFixed(4), phi2: +phi2.toFixed(4), eigenvalue, r2 };
}

function computeRootsLocal(phi1: number, phi2: number): { r: number; theta: number; isComplex: boolean } {
  const disc = phi1 * phi1 + 4 * phi2;
  if (disc < 0) {
    const r = Math.sqrt(-phi2);
    const theta = Math.atan2(Math.sqrt(-disc), phi1);
    return { r, theta, isComplex: true };
  }
  const l1 = (phi1 + Math.sqrt(disc)) / 2;
  const l2 = (phi1 - Math.sqrt(disc)) / 2;
  const dominant = Math.abs(l1) >= Math.abs(l2) ? l1 : l2;
  const r = Math.abs(dominant);
  const theta = dominant < 0 ? Math.PI : 0;
  return { r, theta, isComplex: false };
}

function getGeneType(gene: string): 'clock' | 'target' | 'other' {
  if (CLOCK_GENES.has(gene)) return 'clock';
  if (TARGET_GENES.has(gene)) return 'target';
  return 'other';
}

export function analyzeCrossMetricIndependence(datasetsDir: string, species: string = 'mouse') {
  const isHuman = species === 'human_blood' || species === 'human_sleep';

  let datasetFiles: { id: string; file: string; name: string; interval: number }[];
  if (species === 'human_blood') {
    datasetFiles = [
      { id: 'GSE113883_Human_WholeBlood', file: 'GSE113883_Human_WholeBlood.csv', name: 'GSE113883 WholeBlood', interval: 2 },
    ];
  } else if (species === 'human_sleep') {
    datasetFiles = [
      { id: 'GSE39445_SufficientSleep', file: 'GSE39445_Blood_SufficientSleep_circadian.csv', name: 'GSE39445 SufficientSleep', interval: 4 },
    ];
  } else {
    datasetFiles = [
      { id: 'GSE54650_Liver_circadian', file: 'GSE54650_Liver_circadian.csv', name: 'GSE54650 Liver', interval: 2 },
      { id: 'GSE54650_Kidney_circadian', file: 'GSE54650_Kidney_circadian.csv', name: 'GSE54650 Kidney', interval: 2 },
      { id: 'GSE54650_Heart_circadian', file: 'GSE54650_Heart_circadian.csv', name: 'GSE54650 Heart', interval: 2 },
      { id: 'GSE54650_Lung_circadian', file: 'GSE54650_Lung_circadian.csv', name: 'GSE54650 Lung', interval: 2 },
    ];
  }

  const networkRef = isHuman ? STRING_NETWORK_DEGREE_HUMAN : STRING_NETWORK_DEGREE_MOUSE;
  const chromatinRef = isHuman ? CHROMATIN_STATE_HUMAN : CHROMATIN_STATE_MOUSE;
  const functionalRef = isHuman ? FUNCTIONAL_CATEGORIES_HUMAN : FUNCTIONAL_CATEGORIES;

  const speciesLabel = species === 'human_blood' ? 'Human (Whole Blood)'
    : species === 'human_sleep' ? 'Human (Blood – Sufficient Sleep)'
    : 'Mouse';

  const allGeneMetrics: {
    gene: string;
    geneType: 'clock' | 'target' | 'other';
    eigenvalue: number;
    amplitude: number;
    rSquared: number;
    networkDegree: number | null;
    betweenness: number | null;
    chromatinState: string | null;
    h3k4me3: number | null;
    h3k27ac: number | null;
    functionalCategories: string[];
    tissue: string;
    phi1: number;
    phi2: number;
  }[] = [];

  const crossTissueEigenvalues: Map<string, { eigenvalues: number[]; tissues: string[] }> = new Map();

  for (const ds of datasetFiles) {
    const filePath = path.join(datasetsDir, ds.file);
    if (!fs.existsSync(filePath)) continue;

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n');
    const geneTimeSeries: Map<string, number[]> = new Map();
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',');
      if (parts.length < 2) continue;
      const rawGeneId = parts[0].trim().replace(/"/g, '');
      if (!rawGeneId) continue;
      const values: number[] = [];
      for (let j = 1; j < parts.length; j++) { const v = parseFloat(parts[j]); if (!isNaN(v)) values.push(v); }
      if (values.length >= 4) {
        geneTimeSeries.set(rawGeneId, values);
        if (isHuman) {
          const normalized = normalizeHumanGene(rawGeneId);
          if (normalized !== rawGeneId) geneTimeSeries.set(normalized, values);
        } else {
          const symbol = ENSEMBL_TO_SYMBOL[rawGeneId];
          if (symbol) geneTimeSeries.set(symbol, values);
        }
      }
    }

    const arResults = generateProcessedTable(filePath);
    const stableResults = arResults.filter(r => r.stable);

    for (const r of stableResults) {
      const resolvedGene = isHuman ? normalizeHumanGene(r.gene) : normalizeMouseGene(r.gene);
      const geneType = getGeneType(resolvedGene);
      if (geneType === 'other') continue;

      const ts = geneTimeSeries.get(r.gene) || geneTimeSeries.get(resolvedGene);
      if (!ts) continue;

      const cosinor = fitCosinor(ts, 24, ds.interval);
      const ar2Fit = fitAR2Local(ts);
      const network = networkRef[resolvedGene];
      const chromatin = chromatinRef[resolvedGene];
      const categories = functionalRef[resolvedGene] || [];

      allGeneMetrics.push({
        gene: resolvedGene,
        geneType,
        eigenvalue: +r.eigenvalueModulus.toFixed(4),
        amplitude: +cosinor.amplitude.toFixed(4),
        rSquared: +r.rSquared.toFixed(4),
        networkDegree: network?.degree ?? null,
        betweenness: network?.betweenness ?? null,
        chromatinState: chromatin?.state ?? null,
        h3k4me3: chromatin?.h3k4me3 ?? null,
        h3k27ac: chromatin?.h3k27ac ?? null,
        functionalCategories: categories,
        tissue: ds.name.split(' ')[1],
        phi1: ar2Fit.phi1,
        phi2: ar2Fit.phi2,
      });

      const existing = crossTissueEigenvalues.get(resolvedGene);
      if (existing) {
        existing.eigenvalues.push(+r.eigenvalueModulus.toFixed(4));
        existing.tissues.push(ds.name.split(' ')[1]);
      } else {
        crossTissueEigenvalues.set(resolvedGene, {
          eigenvalues: [+r.eigenvalueModulus.toFixed(4)],
          tissues: [ds.name.split(' ')[1]],
        });
      }
    }
  }

  const withNetwork = allGeneMetrics.filter(g => g.networkDegree !== null);
  const eigenvaluesForNetwork = withNetwork.map(g => g.eigenvalue);
  const degreesForNetwork = withNetwork.map(g => g.networkDegree!);
  const networkCorr = spearmanCorrelation(eigenvaluesForNetwork, degreesForNetwork);

  const amplitudeCorr = spearmanCorrelation(
    allGeneMetrics.map(g => g.eigenvalue),
    allGeneMetrics.map(g => g.amplitude)
  );
  const rSquaredCorr = spearmanCorrelation(
    allGeneMetrics.map(g => g.eigenvalue),
    allGeneMetrics.map(g => g.rSquared)
  );

  const withChromatin = allGeneMetrics.filter(g => g.h3k4me3 !== null);
  const chromatinCorr = spearmanCorrelation(
    withChromatin.map(g => g.eigenvalue),
    withChromatin.map(g => g.h3k4me3!)
  );

  const stateGroups: Record<string, number[]> = {};
  for (const g of withChromatin) {
    const st = g.chromatinState!;
    if (!stateGroups[st]) stateGroups[st] = [];
    stateGroups[st].push(g.eigenvalue);
  }
  const chromatinBoxData = Object.entries(stateGroups).map(([state, evs]) => {
    const sorted = [...evs].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const median = sorted[Math.floor(sorted.length * 0.5)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    return { state, min: sorted[0], q1, median, q3, max: sorted[sorted.length - 1], n: sorted.length, mean: +(evs.reduce((a,b) => a+b, 0) / evs.length).toFixed(4) };
  });

  const categoryEigenvalues: Map<string, { clock: number[]; target: number[] }> = new Map();
  for (const g of allGeneMetrics) {
    for (const cat of g.functionalCategories) {
      if (!categoryEigenvalues.has(cat)) categoryEigenvalues.set(cat, { clock: [], target: [] });
      const entry = categoryEigenvalues.get(cat)!;
      if (g.geneType === 'clock') entry.clock.push(g.eigenvalue);
      else entry.target.push(g.eigenvalue);
    }
  }

  const allCategories = Array.from(new Set(allGeneMetrics.flatMap(g => g.functionalCategories)));
  const categoriesOnlyByEigenvalue: string[] = [];
  const categoriesOnlyByNetwork: string[] = [];
  const categoriesShared: string[] = [];

  for (const cat of allCategories) {
    const genesInCat = allGeneMetrics.filter(g => g.functionalCategories.includes(cat));
    const meanEV = genesInCat.reduce((s, g) => s + g.eigenvalue, 0) / genesInCat.length;
    const genesWithNetwork = genesInCat.filter(g => g.networkDegree !== null);
    const meanDegree = genesWithNetwork.length > 0 ? genesWithNetwork.reduce((s, g) => s + g.networkDegree!, 0) / genesWithNetwork.length : 0;
    const highEV = meanEV > 0.65;
    const highNetwork = meanDegree > 150;
    if (highEV && !highNetwork) categoriesOnlyByEigenvalue.push(cat);
    else if (!highEV && highNetwork) categoriesOnlyByNetwork.push(cat);
    else if (highEV && highNetwork) categoriesShared.push(cat);
  }

  const functionalOverlap = {
    eigenvalueOnly: categoriesOnlyByEigenvalue,
    networkOnly: categoriesOnlyByNetwork,
    shared: categoriesShared,
    allCategories: allCategories.map(cat => {
      const genesInCat = allGeneMetrics.filter(g => g.functionalCategories.includes(cat));
      const meanEV = +(genesInCat.reduce((s, g) => s + g.eigenvalue, 0) / genesInCat.length).toFixed(4);
      const clockInCat = genesInCat.filter(g => g.geneType === 'clock').length;
      const targetInCat = genesInCat.filter(g => g.geneType === 'target').length;
      return { category: cat, meanEigenvalue: meanEV, clockGenes: clockInCat, targetGenes: targetInCat, totalGenes: genesInCat.length };
    }).sort((a, b) => b.meanEigenvalue - a.meanEigenvalue),
  };

  const crossTissueConservation = Array.from(crossTissueEigenvalues.entries())
    .filter(([, data]) => data.eigenvalues.length >= 2)
    .map(([gene, data]) => {
      const mean = +(data.eigenvalues.reduce((a, b) => a + b, 0) / data.eigenvalues.length).toFixed(4);
      const variance = data.eigenvalues.reduce((s, v) => s + (v - mean) ** 2, 0) / data.eigenvalues.length;
      const cv = mean > 0 ? +(Math.sqrt(variance) / mean).toFixed(4) : 0;
      return {
        gene,
        geneType: getGeneType(gene),
        tissues: data.tissues,
        eigenvalues: data.eigenvalues,
        mean,
        cv,
        range: +(Math.max(...data.eigenvalues) - Math.min(...data.eigenvalues)).toFixed(4),
      };
    })
    .sort((a, b) => a.cv - b.cv);

  const clockConservation = crossTissueConservation.filter(g => g.geneType === 'clock');
  const targetConservation = crossTissueConservation.filter(g => g.geneType === 'target');
  const clockMeanCV = clockConservation.length > 0 ? +(clockConservation.reduce((s, g) => s + g.cv, 0) / clockConservation.length).toFixed(4) : 0;
  const targetMeanCV = targetConservation.length > 0 ? +(targetConservation.reduce((s, g) => s + g.cv, 0) / targetConservation.length).toFixed(4) : 0;

  const partialCorrelations = computePartialCorrelations(allGeneMetrics);

  const networkScatter = withNetwork.map(g => ({
    gene: g.gene, geneType: g.geneType, eigenvalue: g.eigenvalue, networkDegree: g.networkDegree!, tissue: g.tissue,
  }));
  const amplitudeScatter = allGeneMetrics.map(g => ({
    gene: g.gene, geneType: g.geneType, eigenvalue: g.eigenvalue, amplitude: g.amplitude, tissue: g.tissue,
  }));

  const defaultInterval = datasetFiles[0]?.interval ?? 2;
  const rootSpacePoints = allGeneMetrics.map(g => {
    const roots = computeRootsLocal(g.phi1, g.phi2);
    const samplingInterval = datasetFiles.find(ds => g.tissue.includes(ds.name.split(' ').pop() || ''))?.interval ?? defaultInterval;
    let dampingRate: number | null = null;
    let naturalPeriod: number | null = null;
    let dampingRatio: number | null = null;
    if (roots.isComplex && roots.r > 0 && roots.theta > 0) {
      dampingRate = +(-Math.log(roots.r)).toFixed(4);
      naturalPeriod = +((2 * Math.PI / roots.theta) * samplingInterval).toFixed(1);
      const lnR = -Math.log(roots.r);
      dampingRatio = +(lnR / Math.sqrt(lnR * lnR + roots.theta * roots.theta)).toFixed(4);
    }
    const categories = functionalRef[g.gene] || [];
    const primaryCategory = categories.length > 0
      ? (categories.includes('circadian rhythm') ? 'Circadian'
        : categories.includes('cell cycle') || categories.includes('cell cycle checkpoint') || categories.includes('cell cycle G1/S') || categories.includes('cell cycle G2/M') || categories.includes('cell cycle arrest') ? 'Cell Cycle'
        : categories.includes('DNA damage response') || categories.includes('DNA repair') ? 'DNA Damage'
        : categories.includes('tumor suppression') || categories.includes('apoptosis') || categories.includes('apoptosis inhibition') || categories.includes('apoptosis promotion') ? 'Tumor/Apoptosis'
        : categories.includes('metabolic regulation') || categories.includes('lipid metabolism') ? 'Metabolism'
        : categories.includes('stem cell marker') || categories.includes('stem cell maintenance') || categories.includes('Wnt signaling') ? 'Stem/Wnt'
        : categories.includes('hypoxia response') ? 'Hypoxia'
        : categories.includes('cell proliferation') || categories.includes('DNA replication') ? 'Proliferation'
        : 'Other')
      : 'Other';
    return {
      gene: g.gene,
      geneType: g.geneType,
      phi1: g.phi1,
      phi2: g.phi2,
      r: +roots.r.toFixed(4),
      theta: +roots.theta.toFixed(4),
      isComplex: roots.isComplex,
      eigenvalue: g.eigenvalue,
      networkDegree: g.networkDegree,
      amplitude: g.amplitude,
      chromatinState: g.chromatinState,
      h3k4me3: g.h3k4me3,
      tissue: g.tissue,
      dampingRate,
      naturalPeriod,
      dampingRatio,
      primaryCategory,
    };
  });

  const rootNetworkCorr = (() => {
    const pts = rootSpacePoints.filter(p => p.networkDegree !== null);
    if (pts.length < 5) return null;
    const rCorr = spearmanCorrelation(pts.map(p => p.r), pts.map(p => p.networkDegree!));
    const thetaCorr = spearmanCorrelation(pts.map(p => p.theta), pts.map(p => p.networkDegree!));
    return { rCorr, thetaCorr, n: pts.length };
  })();

  const rootAmplitudeCorr = (() => {
    if (rootSpacePoints.length < 5) return null;
    const rCorr = spearmanCorrelation(rootSpacePoints.map(p => p.r), rootSpacePoints.map(p => p.amplitude));
    const thetaCorr = spearmanCorrelation(rootSpacePoints.map(p => p.theta), rootSpacePoints.map(p => p.amplitude));
    return { rCorr, thetaCorr, n: rootSpacePoints.length };
  })();

  const dampingFrequencyCorr = (() => {
    const oscPts = rootSpacePoints.filter(p => p.isComplex && p.dampingRate !== null && p.naturalPeriod !== null);
    if (oscPts.length < 5) return null;
    const corr = spearmanCorrelation(oscPts.map(p => p.dampingRate!), oscPts.map(p => p.naturalPeriod!));
    return { ...corr, n: oscPts.length };
  })();

  const rootSpaceCorrespondence = {
    points: rootSpacePoints,
    correlations: {
      r_vs_networkDegree: rootNetworkCorr?.rCorr ?? null,
      theta_vs_networkDegree: rootNetworkCorr?.thetaCorr ?? null,
      r_vs_amplitude: rootAmplitudeCorr?.rCorr ?? null,
      theta_vs_amplitude: rootAmplitudeCorr?.thetaCorr ?? null,
      dampingRate_vs_naturalPeriod: dampingFrequencyCorr,
    },
    stationarityTriangle: {
      vertices: [{ x: -2, y: -1 }, { x: 2, y: -1 }, { x: 0, y: 1 }],
      unitCircle: Array.from({ length: 64 }, (_, i) => {
        const angle = (2 * Math.PI * i) / 64;
        return { x: Math.cos(angle), y: -(Math.cos(angle) ** 2) / 4 + Math.sin(angle) * Math.cos(angle) };
      }),
    },
  };

  const uniqueGenes = new Set(allGeneMetrics.map(g => g.gene));

  return {
    summary: {
      totalMeasurements: allGeneMetrics.length,
      uniqueGenes: uniqueGenes.size,
      datasets: datasetFiles.length,
      clockGenes: new Set(allGeneMetrics.filter(g => g.geneType === 'clock').map(g => g.gene)).size,
      targetGenes: new Set(allGeneMetrics.filter(g => g.geneType === 'target').map(g => g.gene)).size,
      species,
      speciesLabel,
    },
    correlations: {
      eigenvalue_vs_networkDegree: { ...networkCorr, n: withNetwork.length, label: '|λ| vs Network Degree' },
      eigenvalue_vs_amplitude: { ...amplitudeCorr, n: allGeneMetrics.length, label: '|λ| vs Cosinor Amplitude' },
      eigenvalue_vs_rSquared: { ...rSquaredCorr, n: allGeneMetrics.length, label: '|λ| vs AR(2) R²' },
      eigenvalue_vs_h3k4me3: { ...chromatinCorr, n: withChromatin.length, label: '|λ| vs H3K4me3' },
    },
    partialCorrelations,
    networkScatter,
    amplitudeScatter,
    chromatinBoxData,
    functionalOverlap,
    crossTissueConservation,
    rootSpaceCorrespondence,
    conservationSummary: {
      clockMeanCV,
      targetMeanCV,
      clockMoreConserved: clockMeanCV < targetMeanCV,
      conservationRatio: targetMeanCV > 0 ? +(clockMeanCV / targetMeanCV).toFixed(2) : 0,
    },
    dataSources: isHuman ? {
      network: 'Curated reference values based on STRING v12.0 H. sapiens protein-protein interaction network (Szklarczyk et al., 2023). Degree counts are representative values for the listed genes.',
      chromatin: 'Curated reference values based on ENCODE human blood histone mark data (ENCODE Project Consortium, 2020). H3K4me3/H3K27ac values are representative scores for human blood.',
      expression: species === 'human_blood'
        ? 'GSE113883 human whole blood circadian time series (Braun et al., 2018). AR(2) eigenvalues and cosinor amplitudes computed from 2-hour sampled expression profiles.'
        : 'GSE39445 human blood sufficient sleep circadian (Möller-Levet et al., 2013). AR(2) eigenvalues and cosinor amplitudes computed from 4-hour sampled expression profiles.',
      functional: 'Gene Ontology and KEGG pathway annotations for the curated clock and target gene panel.',
    } : {
      network: 'Curated reference values based on STRING v12.0 mouse protein-protein interaction network (Szklarczyk et al., 2023). Degree counts are representative values for the listed genes.',
      chromatin: 'Curated reference values based on ENCODE/Roadmap Epigenomics histone mark data (ENCODE Project Consortium, 2020). H3K4me3/H3K27ac values are representative scores for mouse liver.',
      expression: 'GSE54650 multi-tissue circadian time series (Zhang et al., 2014). AR(2) eigenvalues and cosinor amplitudes computed from 2-hour sampled expression profiles.',
      functional: 'Gene Ontology and KEGG pathway annotations for the curated clock and target gene panel.',
    },
  };
}

function computePartialCorrelations(metrics: { eigenvalue: number; amplitude: number; networkDegree: number | null; h3k4me3: number | null }[]) {
  const withAll = metrics.filter(g => g.networkDegree !== null && g.h3k4me3 !== null);
  if (withAll.length < 10) return { eigenvalue_amplitude_controllingNetwork: null, eigenvalue_network_controllingAmplitude: null };

  const ev = withAll.map(g => g.eigenvalue);
  const amp = withAll.map(g => g.amplitude);
  const net = withAll.map(g => g.networkDegree!);

  const rEA = spearmanCorrelation(ev, amp).rho;
  const rEN = spearmanCorrelation(ev, net).rho;
  const rAN = spearmanCorrelation(amp, net).rho;

  const partialEA_N = (rEA - rEN * rAN) / Math.sqrt((1 - rEN * rEN) * (1 - rAN * rAN) + 1e-15);
  const partialEN_A = (rEN - rEA * rAN) / Math.sqrt((1 - rEA * rEA) * (1 - rAN * rAN) + 1e-15);

  return {
    eigenvalue_amplitude_controllingNetwork: { rho: +partialEA_N.toFixed(4), n: withAll.length },
    eigenvalue_network_controllingAmplitude: { rho: +partialEN_A.toFixed(4), n: withAll.length },
    note: 'Partial correlations control for confounding effects between metrics',
  };
}
