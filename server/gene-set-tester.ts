import * as path from 'path';
import { generateProcessedTable, GeneResult } from './processed-tables';

export interface GeneSetTestResult {
  datasetId: string;
  datasetName: string;
  queryGenes: string[];
  matchedGenes: { gene: string; eigenvalue: number; phi1: number; phi2: number; r2: number; geneType: string }[];
  unmatchedGenes: string[];
  setMeanEigenvalue: number;
  setMedianEigenvalue: number;
  genomeMeanEigenvalue: number;
  genomeMedianEigenvalue: number;
  permutationPValue: number;
  nPermutations: number;
  effectSize: number;
  direction: 'higher' | 'lower' | 'similar';
  interpretation: string;
  histogram: { bin: number; genomeCount: number; setCount: number }[];
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function stdDev(values: number[], m: number): number {
  if (values.length < 2) return 0;
  const sumSq = values.reduce((s, v) => s + (v - m) ** 2, 0);
  return Math.sqrt(sumSq / (values.length - 1));
}

export function testGeneSet(
  datasetPath: string,
  queryGenes: string[],
  options?: { nPermutations?: number }
): GeneSetTestResult {
  const nPermutations = options?.nPermutations ?? 10000;
  const resolvedPath = path.resolve(datasetPath);
  const datasetName = path.basename(datasetPath, path.extname(datasetPath));
  const datasetId = datasetName.replace(/[^a-zA-Z0-9_-]/g, '_');

  const allResults = generateProcessedTable(resolvedPath);

  const geneMap = new Map<string, GeneResult>();
  for (const r of allResults) {
    geneMap.set(r.gene.toUpperCase(), r);
    geneMap.set(r.gene, r);
  }

  const matchedGenes: GeneSetTestResult['matchedGenes'] = [];
  const unmatchedGenes: string[] = [];
  const matchedSet = new Set<string>();

  for (const qg of queryGenes) {
    const found = geneMap.get(qg) || geneMap.get(qg.toUpperCase());
    if (found && !matchedSet.has(found.gene.toUpperCase())) {
      matchedSet.add(found.gene.toUpperCase());
      matchedGenes.push({
        gene: found.gene,
        eigenvalue: found.eigenvalueModulus,
        phi1: found.phi1,
        phi2: found.phi2,
        r2: found.rSquared,
        geneType: found.geneType,
      });
    } else if (!found) {
      unmatchedGenes.push(qg);
    }
  }

  const allEigenvalues = allResults.map(r => r.eigenvalueModulus);
  const setEigenvalues = matchedGenes.map(g => g.eigenvalue);

  const setMeanEigenvalue = mean(setEigenvalues);
  const setMedianEigenvalue = median(setEigenvalues);
  const genomeMeanEigenvalue = mean(allEigenvalues);
  const genomeMedianEigenvalue = median(allEigenvalues);

  const setStd = stdDev(setEigenvalues, setMeanEigenvalue);
  const genomeStd = stdDev(allEigenvalues, genomeMeanEigenvalue);
  const n1 = setEigenvalues.length;
  const n2 = allEigenvalues.length;
  const pooledStdDev = n1 > 1 && n2 > 1
    ? Math.sqrt(((n1 - 1) * setStd ** 2 + (n2 - 1) * genomeStd ** 2) / (n1 + n2 - 2))
    : genomeStd;
  const effectSize = pooledStdDev > 0 ? (setMeanEigenvalue - genomeMeanEigenvalue) / pooledStdDev : 0;

  let permutationPValue = 1;
  const isHigher = setMeanEigenvalue >= genomeMeanEigenvalue;

  if (n1 > 0 && n2 > 0) {
    let countExtreme = 0;
    for (let p = 0; p < nPermutations; p++) {
      let sum = 0;
      for (let i = 0; i < n1; i++) {
        sum += allEigenvalues[Math.floor(Math.random() * n2)];
      }
      const randomMean = sum / n1;
      if (isHigher) {
        if (randomMean >= setMeanEigenvalue) countExtreme++;
      } else {
        if (randomMean <= setMeanEigenvalue) countExtreme++;
      }
    }
    permutationPValue = (countExtreme + 1) / (nPermutations + 1);
  }

  let direction: 'higher' | 'lower' | 'similar';
  if (Math.abs(effectSize) < 0.2) {
    direction = 'similar';
  } else if (effectSize > 0) {
    direction = 'higher';
  } else {
    direction = 'lower';
  }

  const numBins = 20;
  const binMax = 1.1;
  const binWidth = binMax / numBins;
  const histogram: GeneSetTestResult['histogram'] = [];
  for (let b = 0; b < numBins; b++) {
    const binStart = b * binWidth;
    const binEnd = binStart + binWidth;
    const binCenter = parseFloat((binStart + binWidth / 2).toFixed(4));
    let genomeCount = 0;
    let setCount = 0;
    for (const ev of allEigenvalues) {
      if (ev >= binStart && (b === numBins - 1 ? ev <= binEnd : ev < binEnd)) {
        genomeCount++;
      }
    }
    for (const ev of setEigenvalues) {
      if (ev >= binStart && (b === numBins - 1 ? ev <= binEnd : ev < binEnd)) {
        setCount++;
      }
    }
    histogram.push({ bin: binCenter, genomeCount, setCount });
  }

  const pStr = permutationPValue < 0.001 ? '< 0.001' : permutationPValue.toFixed(3);
  const sigStr = permutationPValue < 0.05 ? 'significantly' : 'not significantly';
  const dirStr = direction === 'higher' ? 'higher' : direction === 'lower' ? 'lower' : 'similar to';
  const interpretation = `The ${n1}-gene query set has a mean AR(2) eigenvalue of ${setMeanEigenvalue.toFixed(4)} ` +
    `compared to the genome-wide mean of ${genomeMeanEigenvalue.toFixed(4)} ` +
    `(Cohen's d = ${effectSize.toFixed(3)}, permutation p = ${pStr}). ` +
    `The gene set eigenvalues are ${sigStr} ${dirStr} the genomic background. ` +
    `${n1} of ${queryGenes.length} query genes were matched; ${unmatchedGenes.length} were not found in the dataset.`;

  return {
    datasetId,
    datasetName,
    queryGenes,
    matchedGenes,
    unmatchedGenes,
    setMeanEigenvalue,
    setMedianEigenvalue,
    genomeMeanEigenvalue,
    genomeMedianEigenvalue,
    permutationPValue,
    nPermutations,
    effectSize,
    direction,
    interpretation,
    histogram,
  };
}
