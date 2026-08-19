import * as fs from 'fs';
import * as path from 'path';
import { DRUG_TARGET_DATABASE } from './data/annotations/drug_targets';
import { generateProcessedTable, type GeneResult } from './processed-tables';

function mulberry32(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface GeneWithExpression {
  gene: string;
  eigenvalue: number;
  meanExpression: number;
  variance: number;
  r2: number;
  beta1: number;
  beta2: number;
  stable: boolean;
  isDrugTarget: boolean;
  drugClass?: string;
}

function computeMeanAndVariance(filePath: string, geneName: string): { mean: number; variance: number } | null {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const rawGene = cols[0].trim().replace(/"/g, '');
    if (rawGene.toUpperCase() === geneName.toUpperCase() || rawGene === geneName) {
      const values = cols.slice(1).map(v => parseFloat(v)).filter(v => !isNaN(v));
      if (values.length < 3) return null;
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
      return { mean, variance };
    }
  }
  return null;
}

export interface NullControlGeneResult {
  gene: string;
  eigenvalue: number;
  meanExpression: number;
  variance: number;
  isDrugTarget: boolean;
  drugClass?: string;
}

export interface PermutationNullResult {
  observedMeanEigenvalue: number;
  nullDistribution: number[];
  empiricalP: number;
  nPermutations: number;
  nDrugTargets: number;
  nMatchedGenes: number;
  nullMean: number;
  nullSD: number;
  zScore: number;
  significant: boolean;
}

export interface DrugClassNullResult {
  drugClass: string;
  nGenes: number;
  observedMeanEigenvalue: number;
  empiricalP: number;
  zScore: number;
  significant: boolean;
}

export interface ExpressionMatchedNullResult {
  dataset: string;
  datasetId: string;
  totalGenesAnalyzed: number;
  drugTargetsMatched: number;
  backgroundGenesAvailable: number;
  matchingTolerance: { expression: number; variance: number };
  overallTest: PermutationNullResult;
  perDrugClass: DrugClassNullResult[];
  scatterData: NullControlGeneResult[];
  conclusion: string;
  timestamp: string;
}

function findMatchedGenes(
  target: GeneWithExpression,
  allGenes: GeneWithExpression[],
  expressionTol: number,
  varianceTol: number
): GeneWithExpression[] {
  return allGenes.filter(g => {
    if (g.gene === target.gene) return false;
    if (g.isDrugTarget) return false;
    const exprMatch = Math.abs(g.meanExpression - target.meanExpression) / (Math.abs(target.meanExpression) + 1e-6) <= expressionTol;
    const varMatch = Math.abs(g.variance - target.variance) / (Math.abs(target.variance) + 1e-6) <= varianceTol;
    return exprMatch && varMatch;
  });
}

export function runExpressionMatchedNull(
  datasetId: string = 'GSE54650_Liver',
  nPermutations: number = 10000,
  seed: number = 42
): ExpressionMatchedNullResult {
  const datasetMap: Record<string, { file: string; label: string }> = {
    'GSE54650_Liver': { file: 'GSE54650_Liver_circadian.csv', label: 'GSE54650 Liver' },
    'GSE11923_Liver48h': { file: 'GSE11923_Liver_1h_48h_genes.csv', label: 'GSE11923 Liver 48h' },
    'GSE54650_Kidney': { file: 'GSE54650_Kidney_circadian.csv', label: 'GSE54650 Kidney' },
    'GSE54650_Heart': { file: 'GSE54650_Heart_circadian.csv', label: 'GSE54650 Heart' },
    'GSE157357_WT': { file: 'GSE157357_Organoid_WT-WT_circadian.csv', label: 'GSE157357 Organoid WT' },
    'GSE113883_Blood': { file: 'GSE113883_Human_WholeBlood.csv', label: 'GSE113883 Human Blood' },
  };

  const dsConfig = datasetMap[datasetId] || datasetMap['GSE54650_Liver'];
  const filePath = path.join(process.cwd(), 'datasets', dsConfig.file);
  if (!fs.existsSync(filePath)) throw new Error(`Dataset not found: ${dsConfig.file}`);

  const arResults = generateProcessedTable(filePath);
  const stableResults = arResults.filter(r => r.stable);

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  const expressionMap = new Map<string, { mean: number; variance: number }>();

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const rawGene = cols[0].trim().replace(/"/g, '');
    if (!rawGene) continue;
    const values = cols.slice(1).map(v => parseFloat(v)).filter(v => !isNaN(v));
    if (values.length < 3) continue;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
    expressionMap.set(rawGene.toUpperCase(), { mean, variance });
  }

  const drugTargetGenes = new Set(DRUG_TARGET_DATABASE.map(d => d.gene.toUpperCase()));
  const drugTargetClassMap = new Map<string, string>();
  for (const d of DRUG_TARGET_DATABASE) {
    if (!drugTargetClassMap.has(d.gene.toUpperCase())) {
      drugTargetClassMap.set(d.gene.toUpperCase(), d.drugClass);
    }
  }

  const allGenes: GeneWithExpression[] = [];
  for (const r of stableResults) {
    const geneUpper = r.gene.toUpperCase();
    const expr = expressionMap.get(geneUpper);
    if (!expr) continue;
    const isDrugTarget = drugTargetGenes.has(geneUpper);
    allGenes.push({
      gene: r.gene,
      eigenvalue: r.eigenvalueModulus,
      meanExpression: expr.mean,
      variance: expr.variance,
      r2: r.rSquared,
      beta1: r.phi1,
      beta2: r.phi2,
      stable: r.stable,
      isDrugTarget,
      drugClass: isDrugTarget ? drugTargetClassMap.get(geneUpper) : undefined,
    });
  }

  const drugTargets = allGenes.filter(g => g.isDrugTarget);
  const nonDrugTargets = allGenes.filter(g => !g.isDrugTarget);

  if (drugTargets.length < 3) {
    return {
      dataset: dsConfig.label,
      datasetId,
      totalGenesAnalyzed: allGenes.length,
      drugTargetsMatched: drugTargets.length,
      backgroundGenesAvailable: nonDrugTargets.length,
      matchingTolerance: { expression: 0.1, variance: 0.2 },
      overallTest: {
        observedMeanEigenvalue: 0, nullDistribution: [], empiricalP: 1,
        nPermutations: 0, nDrugTargets: drugTargets.length, nMatchedGenes: 0,
        nullMean: 0, nullSD: 0, zScore: 0, significant: false,
      },
      perDrugClass: [],
      scatterData: [],
      conclusion: 'Insufficient drug targets found in this dataset for expression-matched null testing.',
      timestamp: new Date().toISOString(),
    };
  }

  const rng = mulberry32(seed);
  const expressionTol = 0.10;
  const varianceTol = 0.20;

  const observedMean = drugTargets.reduce((s, g) => s + g.eigenvalue, 0) / drugTargets.length;

  const nullDistribution: number[] = [];
  for (let p = 0; p < nPermutations; p++) {
    let nullSum = 0;
    let nullCount = 0;
    for (const dt of drugTargets) {
      const matched = findMatchedGenes(dt, allGenes, expressionTol, varianceTol);
      if (matched.length > 0) {
        const pick = matched[Math.floor(rng() * matched.length)];
        nullSum += pick.eigenvalue;
        nullCount++;
      } else {
        const pick = nonDrugTargets[Math.floor(rng() * nonDrugTargets.length)];
        nullSum += pick.eigenvalue;
        nullCount++;
      }
    }
    if (nullCount > 0) {
      nullDistribution.push(nullSum / nullCount);
    }
  }

  const nullMean = nullDistribution.length > 0 ? nullDistribution.reduce((a, b) => a + b, 0) / nullDistribution.length : 0;
  const nullSD = nullDistribution.length > 0
    ? Math.sqrt(nullDistribution.reduce((a, b) => a + (b - nullMean) ** 2, 0) / nullDistribution.length)
    : 1;
  const zScore = nullSD > 0 ? (observedMean - nullMean) / nullSD : 0;
  const exceedCount = nullDistribution.filter(v => v >= observedMean).length;
  const empiricalP = nullDistribution.length > 0 ? (exceedCount + 1) / (nullDistribution.length + 1) : 1;

  const drugClasses: Record<string, GeneWithExpression[]> = {};
  for (const dt of drugTargets) {
    const cls = dt.drugClass || 'other';
    if (!drugClasses[cls]) drugClasses[cls] = [];
    drugClasses[cls].push(dt);
  }

  const perDrugClass: DrugClassNullResult[] = [];
  for (const cls of Object.keys(drugClasses)) {
    const genes = drugClasses[cls];
    if (genes.length < 2) continue;
    const classMean = genes.reduce((s: number, g: GeneWithExpression) => s + g.eigenvalue, 0) / genes.length;
    const classNullDist: number[] = [];
    for (let p = 0; p < Math.min(nPermutations, 5000); p++) {
      let ns = 0;
      for (let i = 0; i < genes.length; i++) {
        const pick = nonDrugTargets[Math.floor(rng() * nonDrugTargets.length)];
        ns += pick.eigenvalue;
      }
      classNullDist.push(ns / genes.length);
    }
    const cNullMean = classNullDist.length > 0 ? classNullDist.reduce((a, b) => a + b, 0) / classNullDist.length : 0;
    const cNullSD = classNullDist.length > 0
      ? Math.sqrt(classNullDist.reduce((a, b) => a + (b - cNullMean) ** 2, 0) / classNullDist.length)
      : 1;
    const cZ = cNullSD > 0 ? (classMean - cNullMean) / cNullSD : 0;
    const cExceed = classNullDist.filter(v => v >= classMean).length;
    const cP = classNullDist.length > 0 ? (cExceed + 1) / (classNullDist.length + 1) : 1;

    perDrugClass.push({
      drugClass: cls,
      nGenes: genes.length,
      observedMeanEigenvalue: +classMean.toFixed(4),
      empiricalP: +cP.toFixed(4),
      zScore: +cZ.toFixed(2),
      significant: cP < 0.05,
    });
  }
  perDrugClass.sort((a, b) => a.empiricalP - b.empiricalP);

  const scatterData: NullControlGeneResult[] = allGenes.slice(0, 500).map(g => ({
    gene: g.gene,
    eigenvalue: +g.eigenvalue.toFixed(4),
    meanExpression: +g.meanExpression.toFixed(2),
    variance: +g.variance.toFixed(2),
    isDrugTarget: g.isDrugTarget,
    drugClass: g.drugClass,
  }));

  const sigClasses = perDrugClass.filter(c => c.significant).length;
  let conclusion = '';
  if (empiricalP < 0.05) {
    conclusion = `Drug target genes show significantly different AR(2) persistence compared to expression-matched random gene sets (observed mean |λ| = ${observedMean.toFixed(3)}, null mean = ${nullMean.toFixed(3)}, p = ${empiricalP.toFixed(4)}, z = ${zScore.toFixed(2)}). `;
  } else {
    conclusion = `Drug target root-space positioning is NOT significantly different from expression-matched null (observed mean |λ| = ${observedMean.toFixed(3)}, null mean = ${nullMean.toFixed(3)}, p = ${empiricalP.toFixed(4)}). This suggests that persistence differences may partly reflect expression-level confounding. `;
  }
  conclusion += `${sigClasses}/${perDrugClass.length} drug classes show significant enrichment after expression matching. `;
  conclusion += `Test used ${nPermutations.toLocaleString()} permutations with expression tolerance ±${(expressionTol * 100).toFixed(0)}% and variance tolerance ±${(varianceTol * 100).toFixed(0)}%.`;

  return {
    dataset: dsConfig.label,
    datasetId,
    totalGenesAnalyzed: allGenes.length,
    drugTargetsMatched: drugTargets.length,
    backgroundGenesAvailable: nonDrugTargets.length,
    matchingTolerance: { expression: expressionTol, variance: varianceTol },
    overallTest: {
      observedMeanEigenvalue: +observedMean.toFixed(4),
      nullDistribution: nullDistribution.slice(0, 100).map(v => +v.toFixed(4)),
      empiricalP: +empiricalP.toFixed(4),
      nPermutations,
      nDrugTargets: drugTargets.length,
      nMatchedGenes: nonDrugTargets.length,
      nullMean: +nullMean.toFixed(4),
      nullSD: +nullSD.toFixed(4),
      zScore: +zScore.toFixed(2),
      significant: empiricalP < 0.05,
    },
    perDrugClass,
    scatterData,
    conclusion,
    timestamp: new Date().toISOString(),
  };
}
