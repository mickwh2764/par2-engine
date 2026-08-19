import * as fs from 'fs';
import * as path from 'path';
import { fitAR2WithDiagnostics, computeADF } from './edge-case-diagnostics';
import { ENSEMBL_TO_SYMBOL } from './gene-categories';

const DEFAULT_CLOCK_GENES = [
  'Per1', 'Per2', 'Per3', 'Cry1', 'Cry2', 'Clock', 'Arntl', 'Bmal1',
  'Nr1d1', 'Nr1d2', 'Rorc', 'Dbp', 'Tef', 'Npas2',
  'PER1', 'PER2', 'PER3', 'CRY1', 'CRY2', 'CLOCK', 'ARNTL', 'BMAL1',
  'NR1D1', 'NR1D2', 'RORC', 'DBP', 'TEF', 'NPAS2'
];

const DEFAULT_TARGET_GENES = [
  'Myc', 'Ccnd1', 'Ccnb1', 'Cdk1', 'Wee1', 'Cdkn1a', 'Lgr5', 'Axin2',
  'Ctnnb1', 'Apc', 'Tp53', 'Trp53', 'Mdm2', 'Atm', 'Chek2', 'Bcl2',
  'Bax', 'Pparg', 'Sirt1', 'Hif1a', 'Ccne1', 'Ccne2', 'Mcm6', 'Mki67',
  'MYC', 'CCND1', 'CCNB1', 'CDK1', 'WEE1', 'CDKN1A', 'LGR5', 'AXIN2',
  'CTNNB1', 'APC', 'TP53', 'TRP53', 'MDM2', 'ATM', 'CHEK2', 'BCL2',
  'BAX', 'PPARG', 'SIRT1', 'HIF1A', 'CCNE1', 'CCNE2', 'MCM6', 'MKI67'
];

export interface GeneResult {
  gene: string;
  geneType: 'clock' | 'target' | 'other';
  eigenvalueModulus: number;
  phi1: number;
  phi2: number;
  rSquared: number;
  ljungBoxP: number;
  ljungBoxPassed: boolean;
  confidenceScore: number;
  confidenceLevel: string;
  classification: string;
  nTimepoints: number;
  trendFlag: boolean;
  sampleSizeFlag: boolean;
  ar3OrderFlag: boolean;
  nonlinearityFlag: boolean;
  boundaryFlag: boolean;
  adfStationarityFlag: boolean;
  adfTestStatistic: number;
  stable: boolean;
}

function classifyEigenvalue(eigenvalue: number): string {
  if (eigenvalue < 0.4) return 'fast_decay';
  if (eigenvalue <= 0.8) return 'stable_band';
  if (eigenvalue < 1.0) return 'near_critical';
  return 'explosive';
}

function classifyGeneType(
  geneName: string,
  clockSet: Set<string>,
  targetSet: Set<string>
): 'clock' | 'target' | 'other' {
  const upper = geneName.toUpperCase();
  if (clockSet.has(upper)) return 'clock';
  if (targetSet.has(upper)) return 'target';
  return 'other';
}

function getDiagnosticFlag(diagnostics: { edgeCaseDiagnostics: { id: string; triggered: boolean }[] }, id: string): boolean {
  const d = diagnostics.edgeCaseDiagnostics.find(d => d.id === id);
  return d ? d.triggered : false;
}

const processedTableCache = new Map<string, GeneResult[]>();

export function generateProcessedTable(
  datasetPath: string,
  options?: { clockGenes?: string[]; targetGenes?: string[]; tissuePrefix?: string }
): GeneResult[] {
  const cacheKey = datasetPath + '|' + (options?.clockGenes?.join(',') ?? '') + '|' + (options?.targetGenes?.join(',') ?? '') + '|' + (options?.tissuePrefix ?? '');
  const cached = processedTableCache.get(cacheKey);
  if (cached) return cached;

  const clockGenes = options?.clockGenes || DEFAULT_CLOCK_GENES;
  const targetGenes = options?.targetGenes || DEFAULT_TARGET_GENES;
  const tissuePrefix = options?.tissuePrefix ?? null;

  const clockSet = new Set(clockGenes.map(g => g.toUpperCase()));
  const targetSet = new Set(targetGenes.map(g => g.toUpperCase()));

  const content = fs.readFileSync(datasetPath, 'utf-8');
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];

  // Parse header once to determine:
  //   - geneNameCol: column index that holds the gene name/symbol to classify against
  //   - colIndices: which data columns to use (all, or tissue-filtered subset)
  const headerParts = lines[0].split(',');

  // Auto-detect a "Symbol" column — some multi-tissue files (e.g. baboon GSE98965)
  // carry EnsemblID in col 0 and human-readable Symbol in col 1.  When present,
  // use col 1 as the gene name so core clock genes (PER1, CRY1, …) are recognised.
  let geneNameCol = 0;
  if (headerParts.length > 1 && headerParts[1].trim().toLowerCase() === 'symbol') {
    geneNameCol = 1;
  }

  // Build column index filter when a tissuePrefix is given.
  // A column matches if its header starts with "<PREFIX>." (e.g. "LIV.ZT00").
  let colIndices: number[] | null = null;
  if (tissuePrefix) {
    const prefix = tissuePrefix.toUpperCase() + '.';
    colIndices = [];
    for (let j = 0; j < headerParts.length; j++) {
      if (headerParts[j].trim().toUpperCase().startsWith(prefix)) colIndices.push(j);
    }
  }

  const results: GeneResult[] = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts.length < 2) continue;

    const rawGene = parts[geneNameCol]?.trim().replace(/"/g, '') ?? '';
    if (!rawGene) continue;
    // If we're still on an Ensembl ID (geneNameCol=0 path), try the symbol map.
    const gene = (geneNameCol === 0 ? (ENSEMBL_TO_SYMBOL[rawGene] || rawGene) : rawGene);

    const values: number[] = [];
    // Default: all columns except the identifier column(s) at the start.
    const dataStart = geneNameCol + 1;
    const indices = colIndices ?? Array.from({ length: parts.length - dataStart }, (_, k) => k + dataStart);
    for (const j of indices) {
      if (j >= parts.length) continue;
      const v = parseFloat(parts[j]);
      if (!isNaN(v)) values.push(v);
    }

    if (values.length < 5) continue;

    const result = fitAR2WithDiagnostics(values);
    if (result === null) continue;

    const { phi1, phi2, eigenvalue, r2, ljungBoxPassed, ljungBoxPValue, diagnostics } = result;

    const adfResult = computeADF(values);

    results.push({
      gene,
      geneType: classifyGeneType(gene, clockSet, targetSet),
      eigenvalueModulus: eigenvalue,
      phi1,
      phi2,
      rSquared: r2,
      ljungBoxP: ljungBoxPValue,
      ljungBoxPassed,
      confidenceScore: diagnostics.confidenceScore,
      confidenceLevel: diagnostics.overallConfidence,
      classification: classifyEigenvalue(eigenvalue),
      nTimepoints: values.length,
      trendFlag: getDiagnosticFlag(diagnostics, 'trend_detection'),
      sampleSizeFlag: getDiagnosticFlag(diagnostics, 'sample_size_confidence'),
      ar3OrderFlag: getDiagnosticFlag(diagnostics, 'model_order_check'),
      nonlinearityFlag: getDiagnosticFlag(diagnostics, 'nonlinearity_test'),
      boundaryFlag: getDiagnosticFlag(diagnostics, 'boundary_proximity'),
      adfStationarityFlag: !adfResult.stationary,
      adfTestStatistic: adfResult.testStatistic,
      stable: eigenvalue < 1.0
    });
  }

  processedTableCache.set(cacheKey, results);
  return results;
}

export function generateProcessedTableCSV(
  datasetPath: string,
  datasetName: string,
  options?: { clockGenes?: string[]; targetGenes?: string[]; tissuePrefix?: string }
): string {
  const results = generateProcessedTable(datasetPath, options);

  const clockResults = results.filter(r => r.geneType === 'clock').sort((a, b) => b.eigenvalueModulus - a.eigenvalueModulus);
  const targetResults = results.filter(r => r.geneType === 'target').sort((a, b) => b.eigenvalueModulus - a.eigenvalueModulus);
  const otherResults = results.filter(r => r.geneType === 'other').sort((a, b) => b.eigenvalueModulus - a.eigenvalueModulus);

  const sorted = [...clockResults, ...targetResults, ...otherResults];

  const meanEV = (arr: GeneResult[]) => arr.length > 0 ? arr.reduce((s, r) => s + r.eigenvalueModulus, 0) / arr.length : 0;

  const lines: string[] = [];
  lines.push(`# PAR(2) Processed Eigenvalue Table`);
  lines.push(`# Dataset: ${datasetName}`);
  lines.push(`# Generated: ${new Date().toISOString()}`);
  lines.push(`# Total genes analyzed: ${results.length}`);
  lines.push(`# Clock genes: ${clockResults.length}`);
  lines.push(`# Target genes: ${targetResults.length}`);
  lines.push(`# Other genes: ${otherResults.length}`);
  lines.push(`# Mean eigenvalue (clock): ${meanEV(clockResults).toFixed(4)}`);
  lines.push(`# Mean eigenvalue (target): ${meanEV(targetResults).toFixed(4)}`);
  lines.push(`# Mean eigenvalue (other): ${meanEV(otherResults).toFixed(4)}`);
  lines.push(`# ADF stationarity pass rate: ${(sorted.filter(r => !r.adfStationarityFlag).length / Math.max(1, sorted.length) * 100).toFixed(1)}%`);

  const stableResults = results.filter(r => r.stable);
  const stableClockResults = clockResults.filter(r => r.stable);
  const stableTargetResults = targetResults.filter(r => r.stable);
  lines.push(`# Stable genes (|lambda| < 1.0): ${stableResults.length}/${results.length} (${(stableResults.length / Math.max(1, results.length) * 100).toFixed(1)}%)`);
  lines.push(`# Stable clock genes: ${stableClockResults.length}/${clockResults.length}`);
  lines.push(`# Stable target genes: ${stableTargetResults.length}/${targetResults.length}`);
  lines.push(`# Mean eigenvalue (stable clock): ${meanEV(stableClockResults).toFixed(4)}`);
  lines.push(`# Mean eigenvalue (stable target): ${meanEV(stableTargetResults).toFixed(4)}`);
  lines.push(`# Stability-filtered gap: ${(meanEV(stableTargetResults) - meanEV(stableClockResults)).toFixed(4)}`);

  lines.push('gene,gene_type,eigenvalue_modulus,phi1,phi2,r_squared,ljung_box_p,ljung_box_passed,confidence_score,confidence_level,classification,n_timepoints,trend_flag,sample_size_flag,ar3_order_flag,nonlinearity_flag,boundary_flag,adf_stationary_flag,adf_test_statistic,stable');

  for (const r of sorted) {
    lines.push([
      r.gene,
      r.geneType,
      r.eigenvalueModulus.toFixed(6),
      r.phi1.toFixed(6),
      r.phi2.toFixed(6),
      r.rSquared.toFixed(6),
      r.ljungBoxP.toFixed(6),
      r.ljungBoxPassed ? 'true' : 'false',
      r.confidenceScore.toFixed(2),
      r.confidenceLevel,
      r.classification,
      r.nTimepoints.toString(),
      r.trendFlag ? 'true' : 'false',
      r.sampleSizeFlag ? 'true' : 'false',
      r.ar3OrderFlag ? 'true' : 'false',
      r.nonlinearityFlag ? 'true' : 'false',
      r.boundaryFlag ? 'true' : 'false',
      r.adfStationarityFlag ? 'true' : 'false',
      r.adfTestStatistic.toFixed(4),
      r.stable ? 'true' : 'false'
    ].join(','));
  }

  return lines.join('\n') + '\n';
}
