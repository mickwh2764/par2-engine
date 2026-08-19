import * as fs from 'fs';
import * as path from 'path';
import { GENE_CATEGORIES, classifyGene, GeneCategory, CATEGORY_META, ENSEMBL_TO_SYMBOL } from './gene-categories';

interface GeneAR2 {
  gene: string;
  category: GeneCategory;
  eigenvalue: number;
  beta1: number;
  beta2: number;
  isComplex: boolean;
  r2: number;
  meanExpression: number;
  expressionCV: number;
}

interface CandidateGene {
  gene: string;
  eigenvalue: number;
  beta1: number;
  beta2: number;
  isComplex: boolean;
  r2: number;
  meanExpression: number;
  expressionCV: number;
  percentileRank: number;
  tissuesFound: number;
  tissueList: string[];
  tissueEigenvalues: { tissue: string; eigenvalue: number; isComplex: boolean; r2: number }[];
  meanCrossTissueEV: number;
  crossTissueConsistency: number;
  knownCategory: GeneCategory;
}

interface TissueResult {
  tissue: string;
  file: string;
  totalGenes: number;
  genomeMedian: number;
  genomeMean: number;
  genomeP95: number;
  genomeP99: number;
  clockMedian: number;
  nAboveP95: number;
  nAboveP95Complex: number;
  topGenes: { gene: string; eigenvalue: number; isComplex: boolean; r2: number; category: GeneCategory }[];
}

export interface DiscoveryResult {
  tissues: TissueResult[];
  candidates: CandidateGene[];
  knownClockRecovered: { gene: string; tissuesInTop: number; totalTissues: number; meanEV: number }[];
  novelCandidates: CandidateGene[];
  crossTissueReplicators: CandidateGene[];
  genomeStats: {
    totalGenesScanned: number;
    totalTissues: number;
    thresholdMethod: string;
    complexRootRequirement: string;
    crossTissueRequirement: string;
  };
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
  const mapped = ENSEMBL_TO_SYMBOL[id];
  if (mapped) return mapped.charAt(0).toUpperCase() + mapped.slice(1).toLowerCase();
  if (id.startsWith('ENSMUSG')) return id;
  return id.charAt(0).toUpperCase() + id.slice(1).toLowerCase();
}

function normalizeGeneName(name: string): string {
  return name.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function analyzeOneTissue(filePath: string, tissueName: string): { tissueResult: TissueResult; allGenes: GeneAR2[] } {
  const rows = parseCSV(filePath);
  const allGenes: GeneAR2[] = [];

  for (const [rawGene, values] of rows) {
    const gene = resolveGeneName(rawGene);
    const ar2 = fitAR2(values);
    if (!ar2 || ar2.eigenvalue > 2.0) continue;
    const meanExpr = values.reduce((a, b) => a + b, 0) / values.length;
    const std = Math.sqrt(values.reduce((s, v) => s + (v - meanExpr) ** 2, 0) / values.length);
    const cv = meanExpr > 0 ? std / meanExpr : 0;
    const category = classifyGene(gene);
    allGenes.push({
      gene,
      category,
      eigenvalue: ar2.eigenvalue,
      beta1: ar2.beta1,
      beta2: ar2.beta2,
      isComplex: ar2.isComplex,
      r2: ar2.r2,
      meanExpression: meanExpr,
      expressionCV: cv,
    });
  }

  const evs = allGenes.map(g => g.eigenvalue);
  const p95 = percentile(evs, 95);
  const p99 = percentile(evs, 99);
  const med = percentile(evs, 50);
  const mean = evs.reduce((a, b) => a + b, 0) / evs.length;

  const clockGenes = allGenes.filter(g => g.category === 'clock');
  const clockMed = clockGenes.length > 0 ? percentile(clockGenes.map(g => g.eigenvalue), 50) : 0;

  const aboveP95 = allGenes.filter(g => g.eigenvalue >= p95);
  const aboveP95Complex = aboveP95.filter(g => g.isComplex);

  const topN = 100;
  const topGenes = [...allGenes]
    .sort((a, b) => b.eigenvalue - a.eigenvalue)
    .slice(0, topN)
    .map(g => ({ gene: g.gene, eigenvalue: g.eigenvalue, isComplex: g.isComplex, r2: g.r2, category: g.category }));

  return {
    tissueResult: {
      tissue: tissueName,
      file: filePath,
      totalGenes: allGenes.length,
      genomeMedian: +med.toFixed(4),
      genomeMean: +mean.toFixed(4),
      genomeP95: +p95.toFixed(4),
      genomeP99: +p99.toFixed(4),
      clockMedian: +clockMed.toFixed(4),
      nAboveP95: aboveP95.length,
      nAboveP95Complex: aboveP95Complex.length,
      topGenes,
    },
    allGenes,
  };
}

export function runRegulatoryCoreScan(): DiscoveryResult {
  const TISSUE_FILES: { name: string; file: string }[] = [
    { name: 'Liver', file: 'datasets/GSE54650_Liver_circadian.csv' },
    { name: 'Kidney', file: 'datasets/GSE54650_Kidney_circadian.csv' },
    { name: 'Heart', file: 'datasets/GSE54650_Heart_circadian.csv' },
    { name: 'Lung', file: 'datasets/GSE54650_Lung_circadian.csv' },
    { name: 'Muscle', file: 'datasets/GSE54650_Muscle_circadian.csv' },
    { name: 'Cerebellum', file: 'datasets/GSE54650_Cerebellum_circadian.csv' },
    { name: 'Brainstem', file: 'datasets/GSE54650_Brainstem_circadian.csv' },
    { name: 'Hypothalamus', file: 'datasets/GSE54650_Hypothalamus_circadian.csv' },
    { name: 'Adrenal', file: 'datasets/GSE54650_Adrenal_circadian.csv' },
    { name: 'Aorta', file: 'datasets/GSE54650_Aorta_circadian.csv' },
    { name: 'Brown Fat', file: 'datasets/GSE54650_Brown_Fat_circadian.csv' },
    { name: 'White Fat', file: 'datasets/GSE54650_White_Fat_circadian.csv' },
  ];

  const tissueResults: TissueResult[] = [];
  const allTissueGenes: Map<string, { tissue: string; gene: GeneAR2; percentileRank: number }[]> = new Map();

  for (const tf of TISSUE_FILES) {
    if (!fs.existsSync(tf.file)) continue;

    const { tissueResult, allGenes } = analyzeOneTissue(tf.file, tf.name);
    tissueResults.push(tissueResult);

    const evsSorted = allGenes.map(g => g.eigenvalue).sort((a, b) => a - b);
    for (const gene of allGenes) {
      const rank = evsSorted.filter(e => e <= gene.eigenvalue).length / evsSorted.length * 100;
      const key = normalizeGeneName(gene.gene);
      const list = allTissueGenes.get(key) || [];
      list.push({ tissue: tf.name, gene, percentileRank: rank });
      allTissueGenes.set(key, list);
    }
  }

  const nTissues = tissueResults.length;
  const MIN_TISSUES_FOR_CANDIDATE = Math.max(2, Math.floor(nTissues / 3));
  const PERCENTILE_THRESHOLD = 95;

  const candidates: CandidateGene[] = [];
  const clockGeneNames = new Set([...GENE_CATEGORIES.clock].map(g => normalizeGeneName(g)));

  for (const [normName, entries] of allTissueGenes) {
    const highEntries = entries.filter(e => e.percentileRank >= PERCENTILE_THRESHOLD && e.gene.isComplex);

    if (highEntries.length < MIN_TISSUES_FOR_CANDIDATE) continue;

    const bestEntry = highEntries.reduce((a, b) => a.gene.eigenvalue > b.gene.eigenvalue ? a : b);
    const evs = highEntries.map(e => e.gene.eigenvalue);
    const meanEV = evs.reduce((a, b) => a + b, 0) / evs.length;
    const stdEV = evs.length > 1 ? Math.sqrt(evs.reduce((s, v) => s + (v - meanEV) ** 2, 0) / (evs.length - 1)) : 0;
    const consistency = meanEV > 0 ? 1 - stdEV / meanEV : 0;

    candidates.push({
      gene: bestEntry.gene.gene,
      eigenvalue: +bestEntry.gene.eigenvalue.toFixed(4),
      beta1: +bestEntry.gene.beta1.toFixed(4),
      beta2: +bestEntry.gene.beta2.toFixed(4),
      isComplex: bestEntry.gene.isComplex,
      r2: +bestEntry.gene.r2.toFixed(4),
      meanExpression: +bestEntry.gene.meanExpression.toFixed(2),
      expressionCV: +bestEntry.gene.expressionCV.toFixed(4),
      percentileRank: +bestEntry.percentileRank.toFixed(1),
      tissuesFound: highEntries.length,
      tissueList: highEntries.map(e => e.tissue),
      tissueEigenvalues: highEntries.map(e => ({
        tissue: e.tissue,
        eigenvalue: +e.gene.eigenvalue.toFixed(4),
        isComplex: e.gene.isComplex,
        r2: +e.gene.r2.toFixed(4),
      })),
      meanCrossTissueEV: +meanEV.toFixed(4),
      crossTissueConsistency: +consistency.toFixed(4),
      knownCategory: bestEntry.gene.category,
    });
  }

  candidates.sort((a, b) => {
    if (b.tissuesFound !== a.tissuesFound) return b.tissuesFound - a.tissuesFound;
    return b.meanCrossTissueEV - a.meanCrossTissueEV;
  });

  const knownClockRecovered = candidates
    .filter(c => c.knownCategory === 'clock')
    .map(c => ({
      gene: c.gene,
      tissuesInTop: c.tissuesFound,
      totalTissues: nTissues,
      meanEV: c.meanCrossTissueEV,
    }));

  const novelCandidates = candidates.filter(c => c.knownCategory === 'other');

  const crossTissueReplicators = candidates.filter(c =>
    c.knownCategory === 'other' && c.tissuesFound >= Math.max(3, Math.floor(nTissues / 2))
  );

  const methodology = [
    'Regulatory Core Discovery — Pathway-Agnostic Gene Identification',
    '',
    'PROTOCOL:',
    `1. Run AR(2) on entire genome (~21,000 genes) across ${nTissues} independent tissues (GSE54650 Hughes Atlas)`,
    '2. For each tissue, compute genome-wide |λ| percentile ranks',
    `3. Identify genes in the TOP ${100 - PERCENTILE_THRESHOLD}% by |λ| AND with complex-conjugate roots (oscillatory dynamics)`,
    `4. Require replication: gene must appear in top ${100 - PERCENTILE_THRESHOLD}% + complex roots in ≥${MIN_TISSUES_FOR_CANDIDATE} tissues`,
    '5. Separate known clock genes (positive controls) from novel candidates',
    '',
    'KEY PARAMETERS:',
    `  - Percentile threshold: ${PERCENTILE_THRESHOLD}th percentile (top ${100 - PERCENTILE_THRESHOLD}%)`,
    '  - Root type requirement: complex-conjugate (oscillatory, disc < 0)',
    `  - Cross-tissue replication: ≥${MIN_TISSUES_FOR_CANDIDATE} of ${nTissues} tissues`,
    `  - Strong replicators: ≥${Math.max(3, Math.floor(nTissues / 2))} of ${nTissues} tissues`,
    '',
    'INTERPRETATION:',
    '  - Known clock genes recovered = positive control (validates the method)',
    '  - Novel genes in the clock-like zone across multiple tissues = candidate regulatory cores',
    '  - These are genes with persistent, oscillatory dynamics that replicate independently',
    '  - They are NOT proven regulators — they are statistically flagged candidates requiring wet-lab validation',
    '',
    'LIMITATIONS:',
    '  - All data are bulk tissue microarray — cell-type composition shifts could mimic dynamics',
    '  - 12-timepoint series yield noisy individual estimates; cross-tissue replication mitigates this',
    '  - High |λ| + complex roots does not prove the gene drives oscillation — it could be a downstream readout',
    '  - No causal inference: correlation between dynamics and regulatory function is assumed, not tested',
  ].join('\n');

  return {
    tissues: tissueResults,
    candidates,
    knownClockRecovered,
    novelCandidates,
    crossTissueReplicators,
    genomeStats: {
      totalGenesScanned: tissueResults.reduce((s, t) => s + t.totalGenes, 0),
      totalTissues: nTissues,
      thresholdMethod: `Top ${100 - PERCENTILE_THRESHOLD}% by |λ| per tissue`,
      complexRootRequirement: 'Discriminant β₁² + 4β₂ < 0 (oscillatory dynamics)',
      crossTissueRequirement: `≥${MIN_TISSUES_FOR_CANDIDATE} of ${nTissues} tissues`,
    },
    methodology,
  };
}
