import * as fs from 'fs';
import * as path from 'path';
import { GENE_CATEGORIES, CATEGORY_META, classifyGene, GeneCategory, ALL_CATEGORIES, ENSEMBL_TO_SYMBOL } from './gene-categories';

interface GeneResult {
  gene: string;
  category: GeneCategory;
  eigenvalue: number;
  beta1: number;
  beta2: number;
  isComplex: boolean;
  r2: number;
}

interface CategoryTestResult {
  category: GeneCategory;
  label: string;
  color: string;
  n: number;
  nBackground: number;
  medianLambda: number;
  meanLambda: number;
  stdLambda: number;
  backgroundMedianLambda: number;
  backgroundMeanLambda: number;
  mannWhitneyU: number;
  mannWhitneyP: number;
  mannWhitneyPAdjusted: number;
  cohensD: number;
  rankBiserialR: number;
  pctComplexRoots: number;
  backgroundPctComplexRoots: number;
  fisherOddsRatio: number;
  fisherP: number;
  fisherPAdjusted: number;
  fisherContingency: { a: number; b: number; c: number; d: number };
  direction: 'lower' | 'higher' | 'similar';
  significant: boolean;
  complexEnriched: boolean;
}

interface PairwiseComparison {
  categoryA: string;
  categoryB: string;
  nA: number;
  nB: number;
  medianA: number;
  medianB: number;
  mannWhitneyP: number;
  cohensD: number;
}

export interface CategoryStatisticalResult {
  dataset: string;
  totalGenes: number;
  categorizedGenes: number;
  categoryAssignment: string;
  categories: CategoryTestResult[];
  pairwiseComparisons: PairwiseComparison[];
  summaryTable: string;
  methodology: string;
}

function fitAR2(series: number[]): { beta1: number; beta2: number; eigenvalue: number; isComplex: boolean; r2: number } | null {
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
  const isComplex = disc < 0;
  let eigenvalue: number;
  if (isComplex) {
    eigenvalue = Math.sqrt(-beta2);
  } else {
    const r1 = (beta1 + Math.sqrt(disc)) / 2;
    const r2a = (beta1 - Math.sqrt(disc)) / 2;
    eigenvalue = Math.max(Math.abs(r1), Math.abs(r2a));
  }

  const Y = y.slice(2);
  const pred: number[] = [];
  for (let i = 2; i < n; i++) pred.push(beta1 * y[i - 1] + beta2 * y[i - 2]);
  const ssRes = Y.reduce((s, v, i) => s + Math.pow(v - pred[i], 2), 0);
  const yMean = Y.reduce((a, b) => a + b, 0) / Y.length;
  const ssTot = Y.reduce((s, v) => s + Math.pow(v - yMean, 2), 0);
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  return { beta1, beta2, eigenvalue, isComplex, r2 };
}

function mannWhitneyUTest(a: number[], b: number[]): { U: number; z: number; p: number; rankBiserial: number } {
  if (a.length < 2 || b.length < 2) return { U: 0, z: 0, p: 1, rankBiserial: 0 };

  const combined: { value: number; group: 'a' | 'b' }[] = [
    ...a.map(v => ({ value: v, group: 'a' as const })),
    ...b.map(v => ({ value: v, group: 'b' as const })),
  ];
  combined.sort((x, y) => x.value - y.value);

  const ranks: number[] = new Array(combined.length);
  let i = 0;
  while (i < combined.length) {
    let j = i;
    while (j < combined.length && combined[j].value === combined[i].value) j++;
    const avgRank = (i + 1 + j) / 2;
    for (let k = i; k < j; k++) ranks[k] = avgRank;
    i = j;
  }

  let rankSumA = 0;
  for (let k = 0; k < combined.length; k++) {
    if (combined[k].group === 'a') rankSumA += ranks[k];
  }

  const nA = a.length;
  const nB = b.length;
  const U = rankSumA - (nA * (nA + 1)) / 2;
  const meanU = (nA * nB) / 2;
  const stdU = Math.sqrt((nA * nB * (nA + nB + 1)) / 12);

  const z = stdU > 0 ? (U - meanU) / stdU : 0;
  const p = 2 * (1 - normalCDF(Math.abs(z)));
  const rankBiserial = (2 * U) / (nA * nB) - 1;

  return { U, z, p, rankBiserial };
}

function normalCDF(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1.0 + sign * y);
}

function fisherExactTest(a: number, b: number, c: number, d: number): { oddsRatio: number; p: number } {
  const n = a + b + c + d;
  const oddsRatio = (b === 0 || c === 0) ? Infinity : (a * d) / (b * c);

  const logFactorial = (x: number): number => {
    let result = 0;
    for (let i = 2; i <= x; i++) result += Math.log(i);
    return result;
  };

  const logHypergeom = (a: number, b: number, c: number, d: number): number => {
    const n = a + b + c + d;
    return logFactorial(a + b) + logFactorial(c + d) + logFactorial(a + c) + logFactorial(b + d)
      - logFactorial(a) - logFactorial(b) - logFactorial(c) - logFactorial(d) - logFactorial(n);
  };

  const observedLogP = logHypergeom(a, b, c, d);

  let pValue = 0;
  const row1 = a + b;
  const col1 = a + c;
  const minA = Math.max(0, row1 + col1 - n);
  const maxA = Math.min(row1, col1);

  for (let ai = minA; ai <= maxA; ai++) {
    const bi = row1 - ai;
    const ci = col1 - ai;
    const di = n - ai - bi - ci;
    if (bi < 0 || ci < 0 || di < 0) continue;
    const logP = logHypergeom(ai, bi, ci, di);
    if (logP <= observedLogP + 1e-10) {
      pValue += Math.exp(logP);
    }
  }

  return { oddsRatio, p: Math.min(1, pValue) };
}

function benjaminiHochberg(pValues: number[]): number[] {
  const n = pValues.length;
  const indexed = pValues.map((p, i) => ({ p, i }));
  indexed.sort((a, b) => a.p - b.p);

  const adjusted = new Array(n);
  let cumMin = 1;
  for (let rank = n; rank >= 1; rank--) {
    const idx = indexed[rank - 1].i;
    const adj = Math.min(1, indexed[rank - 1].p * n / rank);
    cumMin = Math.min(cumMin, adj);
    adjusted[idx] = cumMin;
  }
  return adjusted;
}

function cohensD(a: number[], b: number[]): number {
  if (a.length < 2 || b.length < 2) return 0;
  const meanA = a.reduce((s, v) => s + v, 0) / a.length;
  const meanB = b.reduce((s, v) => s + v, 0) / b.length;
  const varA = a.reduce((s, v) => s + (v - meanA) ** 2, 0) / (a.length - 1);
  const varB = b.reduce((s, v) => s + (v - meanB) ** 2, 0) / (b.length - 1);
  const pooledSD = Math.sqrt(((a.length - 1) * varA + (b.length - 1) * varB) / (a.length + b.length - 2));
  return pooledSD > 0 ? (meanA - meanB) / pooledSD : 0;
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function mean(arr: number[]): number {
  return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function std(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
}

function parseCSV(filePath: string): Map<string, number[]> {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.trim().split('\n');
  const rows = new Map<string, number[]>();
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const gene = cols[0].trim().replace(/"/g, '');
    const values = cols.slice(1).map(v => parseFloat(v)).filter(v => !isNaN(v));
    if (values.length >= 5) rows.set(gene, values);
  }
  return rows;
}

function resolveGeneName(id: string): string {
  return ENSEMBL_TO_SYMBOL[id] || id;
}

export function runCategoryStatisticalTests(datasetPath?: string): CategoryStatisticalResult {
  const dsPath = datasetPath || path.join('datasets', 'GSE54650_Liver_circadian.csv');
  const dsName = path.basename(dsPath, '.csv');

  const rows = parseCSV(dsPath);
  const allResults: GeneResult[] = [];

  for (const [rawGene, values] of Array.from(rows)) {
    const gene = resolveGeneName(rawGene);
    const ar2 = fitAR2(values);
    if (!ar2) continue;
    const category = classifyGene(gene);
    allResults.push({
      gene,
      category,
      eigenvalue: ar2.eigenvalue,
      beta1: ar2.beta1,
      beta2: ar2.beta2,
      isComplex: ar2.isComplex,
      r2: ar2.r2,
    });
  }

  const namedCategories: GeneCategory[] = ['clock', 'target', 'housekeeping', 'immune', 'metabolic', 'chromatin', 'signaling', 'dna_repair', 'stem'];

  const categoryResults: CategoryTestResult[] = [];
  const mwPValues: number[] = [];
  const fisherPValues: number[] = [];

  for (const cat of namedCategories) {
    const catGenes = allResults.filter(r => r.category === cat);
    const bgGenes = allResults.filter(r => r.category !== cat);

    if (catGenes.length < 2) {
      continue;
    }

    const catEVs = catGenes.map(r => r.eigenvalue);
    const bgEVs = bgGenes.map(r => r.eigenvalue);

    const mw = mannWhitneyUTest(catEVs, bgEVs);
    const cd = cohensD(catEVs, bgEVs);

    const catComplex = catGenes.filter(r => r.isComplex).length;
    const catReal = catGenes.length - catComplex;
    const bgComplex = bgGenes.filter(r => r.isComplex).length;
    const bgReal = bgGenes.length - bgComplex;

    const fisher = fisherExactTest(catComplex, catReal, bgComplex, bgReal);

    const medCat = median(catEVs);
    const medBg = median(bgEVs);
    const direction = medCat < medBg - 0.01 ? 'lower' : medCat > medBg + 0.01 ? 'higher' : 'similar';

    const meta = CATEGORY_META[cat];

    mwPValues.push(mw.p);
    fisherPValues.push(fisher.p);

    categoryResults.push({
      category: cat,
      label: meta.label,
      color: meta.color,
      n: catGenes.length,
      nBackground: bgGenes.length,
      medianLambda: +medCat.toFixed(4),
      meanLambda: +mean(catEVs).toFixed(4),
      stdLambda: +std(catEVs).toFixed(4),
      backgroundMedianLambda: +medBg.toFixed(4),
      backgroundMeanLambda: +mean(bgEVs).toFixed(4),
      mannWhitneyU: +mw.U.toFixed(1),
      mannWhitneyP: +mw.p.toFixed(6),
      mannWhitneyPAdjusted: 0,
      cohensD: +cd.toFixed(4),
      rankBiserialR: +mw.rankBiserial.toFixed(4),
      pctComplexRoots: +(100 * catComplex / catGenes.length).toFixed(1),
      backgroundPctComplexRoots: +(100 * bgComplex / bgGenes.length).toFixed(1),
      fisherOddsRatio: +fisher.oddsRatio.toFixed(4),
      fisherP: +fisher.p.toFixed(6),
      fisherPAdjusted: 0,
      fisherContingency: { a: catComplex, b: catReal, c: bgComplex, d: bgReal },
      direction,
      significant: false,
      complexEnriched: false,
    });
  }

  const mwAdjusted = benjaminiHochberg(mwPValues);
  const fisherAdjusted = benjaminiHochberg(fisherPValues);

  for (let i = 0; i < categoryResults.length; i++) {
    categoryResults[i].mannWhitneyPAdjusted = +mwAdjusted[i].toFixed(6);
    categoryResults[i].fisherPAdjusted = +fisherAdjusted[i].toFixed(6);
    categoryResults[i].significant = mwAdjusted[i] < 0.05;
    categoryResults[i].complexEnriched = fisherAdjusted[i] < 0.05 && categoryResults[i].fisherOddsRatio > 1;
  }

  const pairwiseComparisons: PairwiseComparison[] = [];
  const keyPairs: [GeneCategory, GeneCategory][] = [
    ['clock', 'housekeeping'],
    ['clock', 'target'],
    ['stem', 'housekeeping'],
    ['signaling', 'housekeeping'],
    ['dna_repair', 'housekeeping'],
    ['immune', 'metabolic'],
    ['clock', 'metabolic'],
  ];

  for (const [catA, catB] of keyPairs) {
    const genesA = allResults.filter(r => r.category === catA);
    const genesB = allResults.filter(r => r.category === catB);
    if (genesA.length < 2 || genesB.length < 2) continue;

    const evsA = genesA.map(r => r.eigenvalue);
    const evsB = genesB.map(r => r.eigenvalue);
    const mw = mannWhitneyUTest(evsA, evsB);
    const cd = cohensD(evsA, evsB);

    pairwiseComparisons.push({
      categoryA: CATEGORY_META[catA].label,
      categoryB: CATEGORY_META[catB].label,
      nA: genesA.length,
      nB: genesB.length,
      medianA: +median(evsA).toFixed(4),
      medianB: +median(evsB).toFixed(4),
      mannWhitneyP: +mw.p.toFixed(6),
      cohensD: +cd.toFixed(4),
    });
  }

  let summaryTable = 'Category | n | Median |λ| | BG Median | MW p | MW p(adj) | Cohen\'s d | %Complex | Fisher OR | Fisher p(adj) | Sig?\n';
  summaryTable += '---------|---|--------|-----------|------|-----------|-----------|----------|-----------|---------------|-----\n';
  for (const c of categoryResults) {
    const sig = c.significant ? '***' : (c.mannWhitneyPAdjusted < 0.1 ? '*' : '');
    const cplx = c.complexEnriched ? '↑' : '';
    summaryTable += `${c.label.padEnd(13)} | ${String(c.n).padStart(2)} | ${c.medianLambda.toFixed(3).padStart(6)} | ${c.backgroundMedianLambda.toFixed(3).padStart(9)} | ${c.mannWhitneyP.toFixed(4).padStart(6)} | ${c.mannWhitneyPAdjusted.toFixed(4).padStart(9)} | ${c.cohensD.toFixed(3).padStart(9)} | ${c.pctComplexRoots.toFixed(1).padStart(7)}% | ${c.fisherOddsRatio === Infinity ? '    Inf' : c.fisherOddsRatio.toFixed(3).padStart(9)} | ${c.fisherPAdjusted.toFixed(4).padStart(13)} | ${sig}${cplx}\n`;
  }

  const methodology = [
    'Statistical Tests for Category-Level Eigenvalue Differences',
    '',
    '1. Mann-Whitney U (Wilcoxon rank-sum) test: non-parametric comparison of |λ| distributions',
    '   - Each category tested against all other genes (background)',
    '   - Two-sided test; no normality assumption',
    '   - Effect size: Cohen\'s d and rank-biserial correlation',
    '',
    '2. Fisher\'s exact test: complex-root enrichment',
    '   - 2×2 contingency table: (in-category vs background) × (complex vs real roots)',
    '   - Complex roots: discriminant β₁² + 4β₂ < 0 (oscillatory dynamics)',
    '   - Reports odds ratio and exact p-value',
    '',
    '3. Multiple testing correction: Benjamini-Hochberg FDR',
    '   - Applied separately to Mann-Whitney and Fisher p-values',
    '   - 9 tests (one per named category)',
    '   - Significance threshold: adjusted p < 0.05',
    '',
    '4. Category assignment: each gene assigned to exactly ONE primary category',
    '   - Priority order follows GENE_CATEGORIES definition (clock > target > housekeeping > ...)',
    '   - First match wins; no gene appears in multiple categories',
    '   - Genes matching no category are assigned "other" (used as part of background)',
    '',
    '5. Pairwise comparisons: selected biologically meaningful pairs',
    '   - Clock vs Housekeeping (primary contrast)',
    '   - Clock vs Target, Stem vs Housekeeping, etc.',
  ].join('\n');

  return {
    dataset: dsName,
    totalGenes: allResults.length,
    categorizedGenes: allResults.filter(r => r.category !== 'other').length,
    categoryAssignment: 'Each gene assigned to exactly one primary category; first match wins; no overlapping assignments',
    categories: categoryResults,
    pairwiseComparisons,
    summaryTable,
    methodology,
  };
}
