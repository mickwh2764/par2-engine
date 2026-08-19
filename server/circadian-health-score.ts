import * as fs from 'fs';
import * as path from 'path';
import { fitAR2WithDiagnostics } from './edge-case-diagnostics';
import { solveAR2Eigenvalues } from './par2-engine';

export interface DatasetInfo {
  id: string;
  name: string;
  file: string;
  species: string;
}

export interface HealthScore {
  datasetId: string;
  datasetName: string;
  species: string;
  meanClockEigenvalue: number;
  meanTargetEigenvalue: number;
  gearboxGap: number;
  hierarchyPreserved: boolean;
  clockCount: number;
  targetCount: number;
  hierarchyRate: number;
  meanR2Clock: number;
  healthScore: number;
  grade: string;
  interpretation: string;
}

const healthScoreCache = new Map<string, HealthScore>();

const CLOCK_GENES_UPPER = new Set([
  'PER1', 'PER2', 'PER3', 'CRY1', 'CRY2', 'CLOCK', 'ARNTL', 'BMAL1',
  'NR1D1', 'NR1D2', 'RORA', 'RORC', 'DBP', 'TEF', 'HLF', 'NFIL3', 'NPAS2'
]);

const TARGET_GENES_UPPER = new Set([
  'MYC', 'CCND1', 'CCNB1', 'CDK1', 'WEE1', 'CDKN1A', 'LGR5', 'AXIN2',
  'CTNNB1', 'APC', 'TP53', 'TRP53', 'MDM2', 'ATM', 'CHEK2', 'BCL2',
  'BAX', 'PPARG', 'SIRT1', 'HIF1A', 'CCNE1', 'CCNE2', 'MCM6', 'MKI67'
]);

const ENSEMBL_MAP: Record<string, string> = {
  'ENSMUSG00000020893': 'PER1', 'ENSMUSG00000055866': 'PER2', 'ENSMUSG00000028957': 'PER3',
  'ENSMUSG00000020038': 'CRY1', 'ENSMUSG00000068742': 'CRY2',
  'ENSMUSG00000029238': 'CLOCK', 'ENSMUSG00000055116': 'ARNTL',
  'ENSMUSG00000020889': 'NR1D1', 'ENSMUSG00000021775': 'NR1D2',
  'ENSMUSG00000028150': 'RORC', 'ENSMUSG00000059824': 'DBP',
  'ENSMUSG00000022389': 'TEF', 'ENSMUSG00000026077': 'NPAS2',
  'ENSMUSG00000022346': 'MYC', 'ENSMUSG00000070348': 'CCND1',
  'ENSMUSG00000041431': 'CCNB1', 'ENSMUSG00000019942': 'CDK1',
  'ENSMUSG00000031016': 'WEE1', 'ENSMUSG00000023067': 'CDKN1A',
  'ENSMUSG00000020140': 'LGR5', 'ENSMUSG00000000142': 'AXIN2',
  'ENSMUSG00000006932': 'CTNNB1', 'ENSMUSG00000005871': 'APC',
  'ENSMUSG00000059552': 'TRP53', 'ENSMUSG00000020184': 'MDM2',
  'ENSMUSG00000034218': 'ATM', 'ENSMUSG00000029521': 'CHEK2',
  'ENSMUSG00000057329': 'BCL2', 'ENSMUSG00000003873': 'BAX',
  'ENSMUSG00000000440': 'PPARG', 'ENSMUSG00000020063': 'SIRT1',
  'ENSMUSG00000021109': 'HIF1A',
  'ENSMUSG00000002068': 'CCNE1', 'ENSMUSG00000028399': 'CCNE2',
  'ENSMUSG00000025544': 'MCM6', 'ENSMUSG00000031004': 'MKI67',
};

function clamp(min: number, max: number, value: number): number {
  return Math.min(max, Math.max(min, value));
}

function assignGrade(score: number): string {
  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  if (score >= 20) return 'D';
  return 'F';
}

function generateInterpretation(grade: string, hierarchyPreserved: boolean, _gearboxGap: number): string {
  switch (grade) {
    case 'A':
      return 'Strong circadian hierarchy: clock genes clearly dominate targets with robust oscillatory signatures.';
    case 'B':
      return 'Good circadian hierarchy: clock-target separation is evident with moderate oscillatory strength.';
    case 'C':
      return 'Partial circadian hierarchy: some clock-target separation exists but the gearbox structure is weakened.';
    case 'D':
      return hierarchyPreserved
        ? 'Weak circadian hierarchy: minimal clock-target separation detected.'
        : 'Disrupted circadian hierarchy: target eigenvalues exceed clock eigenvalues.';
    case 'F':
      return 'No detectable circadian hierarchy: clock-target gearbox structure is absent or inverted.';
    default:
      return 'Unable to assess circadian hierarchy.';
  }
}

interface GeneEigenvalue {
  gene: string;
  type: 'clock' | 'target';
  eigenvalue: number;
  r2: number;
}

function extractClockTargetEigenvalues(filePath: string): GeneEigenvalue[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];

  const results: GeneEigenvalue[] = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts.length < 2) continue;

    const rawGene = parts[0].trim().replace(/"/g, '');
    if (!rawGene) continue;

    const mapped = ENSEMBL_MAP[rawGene];
    const upper = mapped || rawGene.toUpperCase();

    let type: 'clock' | 'target' | null = null;
    if (CLOCK_GENES_UPPER.has(upper)) type = 'clock';
    else if (TARGET_GENES_UPPER.has(upper)) type = 'target';

    if (!type) continue;

    const values: number[] = [];
    for (let j = 1; j < parts.length; j++) {
      const v = parseFloat(parts[j]);
      if (!isNaN(v)) values.push(v);
    }

    if (values.length < 5) continue;

    try {
      const fit = fitAR2WithDiagnostics(values);
      if (!fit) continue;
      const eig = solveAR2Eigenvalues(fit.phi1, fit.phi2);
      const mod = Math.max(eig.modulus1, eig.modulus2);

      results.push({
        gene: mapped || rawGene,
        type,
        eigenvalue: mod,
        r2: fit.r2,
      });
    } catch {
      continue;
    }
  }

  return results;
}

export function computeSingleHealthScore(datasetPath: string, datasetName: string): HealthScore | null {
  if (!fs.existsSync(datasetPath)) return null;

  let geneResults: GeneEigenvalue[];
  try {
    geneResults = extractClockTargetEigenvalues(datasetPath);
  } catch {
    return null;
  }

  const clockGenes = geneResults.filter(r => r.type === 'clock');
  const targetGenes = geneResults.filter(r => r.type === 'target');

  const clockCount = clockGenes.length;
  const targetCount = targetGenes.length;

  const meanClockEigenvalue = clockCount > 0
    ? clockGenes.reduce((s, r) => s + r.eigenvalue, 0) / clockCount
    : 0;
  const meanTargetEigenvalue = targetCount > 0
    ? targetGenes.reduce((s, r) => s + r.eigenvalue, 0) / targetCount
    : 0;

  const gearboxGap = meanClockEigenvalue - meanTargetEigenvalue;
  const hierarchyPreserved = meanClockEigenvalue > meanTargetEigenvalue;

  const hierarchyRate = clockCount > 0 && targetCount > 0
    ? clockGenes.filter(c => c.eigenvalue > meanTargetEigenvalue).length / clockCount
    : 0;

  const meanR2Clock = clockCount > 0
    ? clockGenes.reduce((s, r) => s + r.r2, 0) / clockCount
    : 0;

  const rawScore =
    (gearboxGap > 0 ? 40 : 0) +
    (gearboxGap * 200) +
    (hierarchyRate * 30) +
    (meanR2Clock > 0.1 ? 15 : meanR2Clock * 150) +
    (clockCount >= 4 ? 15 : clockCount * 3.75);

  const healthScore = clamp(0, 100, Math.round(rawScore));
  const grade = assignGrade(healthScore);
  const interpretation = generateInterpretation(grade, hierarchyPreserved, gearboxGap);

  return {
    datasetId: '',
    datasetName,
    species: '',
    meanClockEigenvalue: +meanClockEigenvalue.toFixed(6),
    meanTargetEigenvalue: +meanTargetEigenvalue.toFixed(6),
    gearboxGap: +gearboxGap.toFixed(6),
    hierarchyPreserved,
    clockCount,
    targetCount,
    hierarchyRate: +hierarchyRate.toFixed(4),
    meanR2Clock: +meanR2Clock.toFixed(4),
    healthScore,
    grade,
    interpretation,
  };
}

export function computeHealthScores(datasets: DatasetInfo[]): HealthScore[] {
  const scores: HealthScore[] = [];

  for (const dataset of datasets) {
    if (healthScoreCache.has(dataset.id)) {
      scores.push(healthScoreCache.get(dataset.id)!);
      continue;
    }

    const resolvedPath = path.join(process.cwd(), 'datasets', dataset.file);

    if (!fs.existsSync(resolvedPath)) {
      continue;
    }

    const result = computeSingleHealthScore(resolvedPath, dataset.name);
    if (!result) continue;

    result.datasetId = dataset.id;
    result.species = dataset.species;

    healthScoreCache.set(dataset.id, result);
    scores.push(result);
  }

  return scores;
}
