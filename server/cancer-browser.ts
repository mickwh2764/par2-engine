/**
 * Cancer Cohort Browser Module
 * 
 * Compare eigenvalue distributions across tumor types vs matched normals.
 * All eigenvalues are computed LIVE from actual CSV datasets using AR(2) fitting.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface CancerCohort {
  name: string;
  geoId: string;
  tumorType: string;
  organism: string;
  nSamples: number;
  hasMatchedNormal: boolean;
  timepoints?: number;
  clockEigenvalues: { gene: string; value: number }[];
  targetEigenvalues: { gene: string; value: number }[];
  gearboxGap: number;
  gearboxIntact: boolean;
  source: 'live-computed';
  computedAt: string;
  insufficientData?: boolean;
  warning?: string;
}

export interface CancerComparisonResult {
  cohorts: CancerCohort[];
  summary: {
    totalCohorts: number;
    gearboxIntactCount: number;
    gearboxDisruptedCount: number;
    meanHealthyGap: number;
    meanCancerGap: number;
    consistentDisruption: boolean;
  };
  byTumorType: Record<string, { healthy: number; cancer: number; n: number }>;
  computedAt: string;
}

const ENSEMBL_TO_SYMBOL: Record<string, string> = {
  'ENSMUSG00000020893': 'Per1',
  'ENSMUSG00000055866': 'Per2',
  'ENSMUSG00000020038': 'Cry1',
  'ENSMUSG00000068742': 'Cry2',
  'ENSMUSG00000029238': 'Clock',
  'ENSMUSG00000055116': 'Arntl',
  'ENSMUSG00000020889': 'Nr1d1',
  'ENSMUSG00000021775': 'Nr1d2',
  'ENSMUSG00000059824': 'Dbp',
  'ENSMUSG00000022389': 'Tef',
  'ENSMUSG00000026077': 'Npas2',
  'ENSMUSG00000028957': 'Per3',
  'ENSMUSG00000028150': 'Rorc',
  'ENSMUSG00000022346': 'Myc',
  'ENSMUSG00000070348': 'Ccnd1',
  'ENSMUSG00000041431': 'Ccnb1',
  'ENSMUSG00000019461': 'Cdk1',
  'ENSMUSG00000031016': 'Wee1',
  'ENSMUSG00000023067': 'Cdkn1a',
  'ENSMUSG00000020140': 'Lgr5',
  'ENSMUSG00000000142': 'Axin2',
  'ENSMUSG00000006932': 'Ctnnb1',
  'ENSMUSG00000005871': 'Apc',
  'ENSMUSG00000002068': 'Ccne1',
  'ENSMUSG00000028399': 'Ccne2',
  'ENSMUSG00000025544': 'Mcm6',
  'ENSMUSG00000031004': 'Mki67',
};

const SYMBOL_TO_ENSEMBL: Record<string, string> = Object.fromEntries(
  Object.entries(ENSEMBL_TO_SYMBOL).map(([e, s]) => [s, e])
);

export { ENSEMBL_TO_SYMBOL as GENE_SYMBOL_TO_ENSEMBL_BROWSER };

const CLOCK_GENES_MOUSE = ['Per1', 'Per2', 'Cry1', 'Cry2', 'Clock', 'Arntl', 'Nr1d1', 'Nr1d2', 'Dbp', 'Tef', 'Npas2'];
const TARGET_GENES_MOUSE = ['Myc', 'Ccnd1', 'Ccnb1', 'Cdk1', 'Wee1', 'Cdkn1a', 'Lgr5', 'Axin2'];
const CLOCK_GENES_HUMAN = CLOCK_GENES_MOUSE.map(g => g.toUpperCase());
const TARGET_GENES_HUMAN = TARGET_GENES_MOUSE.map(g => g.toUpperCase());

interface CohortRegistryEntry {
  file: string;
  name: string;
  geoId: string;
  tumorType: string;
  organism: string;
  nSamples: number;
  hasMatchedNormal: boolean;
  timepoints: number;
  useEnsembl: boolean;
}

const COHORT_REGISTRY: CohortRegistryEntry[] = [
  {
    file: 'GSE157357_Organoid_WT-WT_circadian.csv',
    name: 'Healthy Intestinal Organoids',
    geoId: 'GSE157357',
    tumorType: 'Normal',
    organism: 'Mus musculus',
    nSamples: 22,
    hasMatchedNormal: false,
    timepoints: 22,
    useEnsembl: true,
  },
  {
    file: 'GSE157357_Organoid_ApcKO-WT_circadian.csv',
    name: 'APC-mutant Organoids',
    geoId: 'GSE157357',
    tumorType: 'Colorectal',
    organism: 'Mus musculus',
    nSamples: 22,
    hasMatchedNormal: true,
    timepoints: 22,
    useEnsembl: true,
  },
  {
    file: 'GSE157357_Organoid_WT-BmalKO_circadian.csv',
    name: 'BMAL1-KO Organoids',
    geoId: 'GSE157357',
    tumorType: 'Clock Disruption',
    organism: 'Mus musculus',
    nSamples: 22,
    hasMatchedNormal: true,
    timepoints: 22,
    useEnsembl: true,
  },
  {
    file: 'GSE157357_Organoid_ApcKO-BmalKO_circadian.csv',
    name: 'Double-Mutant Organoids',
    geoId: 'GSE157357',
    tumorType: 'Colorectal',
    organism: 'Mus musculus',
    nSamples: 22,
    hasMatchedNormal: true,
    timepoints: 22,
    useEnsembl: true,
  },
  {
    file: 'GSE221103_Neuroblastoma_MYC_ON.csv',
    name: 'MYC-ON Neuroblastoma',
    geoId: 'GSE221103',
    tumorType: 'Neuroblastoma',
    organism: 'Homo sapiens',
    nSamples: 14,
    hasMatchedNormal: true,
    timepoints: 14,
    useEnsembl: false,
  },
  {
    file: 'GSE221103_Neuroblastoma_MYC_OFF.csv',
    name: 'MYC-OFF Neuroblastoma',
    geoId: 'GSE221103',
    tumorType: 'Normal/Control',
    organism: 'Homo sapiens',
    nSamples: 14,
    hasMatchedNormal: false,
    timepoints: 14,
    useEnsembl: false,
  },
  {
    file: 'GSE93903_Liver_Young_circadian.csv',
    name: 'Young Liver',
    geoId: 'GSE93903',
    tumorType: 'Normal',
    organism: 'Mus musculus',
    nSamples: 6,
    hasMatchedNormal: false,
    timepoints: 6,
    useEnsembl: false,
  },
  {
    file: 'GSE93903_Liver_Old_circadian.csv',
    name: 'Old Liver',
    geoId: 'GSE93903',
    tumorType: 'Aging',
    organism: 'Mus musculus',
    nSamples: 6,
    hasMatchedNormal: true,
    timepoints: 6,
    useEnsembl: false,
  },
  {
    file: 'GSE93903_Liver_YoungCR_circadian.csv',
    name: 'Young+CR Liver',
    geoId: 'GSE93903',
    tumorType: 'Normal',
    organism: 'Mus musculus',
    nSamples: 6,
    hasMatchedNormal: false,
    timepoints: 6,
    useEnsembl: false,
  },
  {
    file: 'GSE93903_Liver_OldCR_circadian.csv',
    name: 'Old+CR Liver',
    geoId: 'GSE93903',
    tumorType: 'Aging',
    organism: 'Mus musculus',
    nSamples: 6,
    hasMatchedNormal: true,
    timepoints: 6,
    useEnsembl: false,
  },
  {
    file: 'GSE70499_Liver_Bmal1WT_circadian.csv',
    name: 'Bmal1-WT Liver',
    geoId: 'GSE70499',
    tumorType: 'Normal',
    organism: 'Mus musculus',
    nSamples: 6,
    hasMatchedNormal: false,
    timepoints: 6,
    useEnsembl: false,
  },
  {
    file: 'GSE70499_Liver_Bmal1KO_circadian.csv',
    name: 'Bmal1-KO Liver',
    geoId: 'GSE70499',
    tumorType: 'Clock Disruption',
    organism: 'Mus musculus',
    nSamples: 6,
    hasMatchedNormal: true,
    timepoints: 6,
    useEnsembl: false,
  },
  {
    file: 'GSE113883_Human_WholeBlood.csv',
    name: 'Human Whole Blood',
    geoId: 'GSE113883',
    tumorType: 'Normal',
    organism: 'Homo sapiens',
    nSamples: 15,
    hasMatchedNormal: false,
    timepoints: 15,
    useEnsembl: false,
  },
  {
    file: 'GSE245295_aging_pancreas.csv',
    name: 'Aging Pancreas',
    geoId: 'GSE245295',
    tumorType: 'Aging',
    organism: 'Mus musculus',
    nSamples: 12,
    hasMatchedNormal: false,
    timepoints: 12,
    useEnsembl: false,
  },
];

function fitAR2(series: number[]): { phi1: number; phi2: number; eigenvalue: number; isStable: boolean } {
  const n = series.length;
  if (n < 5) return { phi1: 0, phi2: 0, eigenvalue: 0, isStable: true };

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

  const denom = sumY1Y1 * sumY2Y2 - sumY1Y2 * sumY1Y2;
  if (Math.abs(denom) < 1e-10) return { phi1: 0, phi2: 0, eigenvalue: 0, isStable: true };

  const phi1 = (sumYY1 * sumY2Y2 - sumYY2 * sumY1Y2) / denom;
  const phi2 = (sumYY2 * sumY1Y1 - sumYY1 * sumY1Y2) / denom;

  const discriminant = phi1 * phi1 + 4 * phi2;
  let eigenvalue: number;
  if (discriminant < 0) {
    eigenvalue = Math.sqrt(-phi2);
  } else {
    const r1 = (phi1 + Math.sqrt(discriminant)) / 2;
    const r2 = (phi1 - Math.sqrt(discriminant)) / 2;
    eigenvalue = Math.max(Math.abs(r1), Math.abs(r2));
  }

  const isStable = eigenvalue < 1.0;
  return { phi1, phi2, eigenvalue, isStable };
}

function parseCSV(content: string): Map<string, number[]> {
  const lines = content.trim().split('\n');
  const rows = new Map<string, number[]>();

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const geneName = cols[0].trim().replace(/"/g, '');
    const values = cols.slice(1).map(v => parseFloat(v)).filter(v => !isNaN(v));
    if (values.length >= 5) {
      rows.set(geneName, values);
    }
  }

  return rows;
}

function findGeneData(rows: Map<string, number[]>, gene: string, useEnsembl: boolean): number[] | null {
  const variants = [gene, gene.toLowerCase(), gene.toUpperCase(),
    gene.charAt(0).toUpperCase() + gene.slice(1).toLowerCase()];
  for (const v of variants) {
    if (rows.has(v)) return rows.get(v)!;
  }
  if (useEnsembl) {
    const ensemblId = SYMBOL_TO_ENSEMBL[gene];
    if (ensemblId) {
      if (rows.has(ensemblId)) return rows.get(ensemblId)!;
      if (rows.has(`"${ensemblId}"`)) return rows.get(`"${ensemblId}"`)!;
    }
    for (const [eid, symbol] of Object.entries(ENSEMBL_TO_SYMBOL)) {
      if (symbol === gene || symbol.toLowerCase() === gene.toLowerCase() || symbol.toUpperCase() === gene.toUpperCase()) {
        if (rows.has(eid)) return rows.get(eid)!;
      }
    }
  }
  return null;
}

function computeCohortEigenvalues(entry: CohortRegistryEntry): CancerCohort | null {
  const fullPath = path.join(process.cwd(), 'datasets', entry.file);
  if (!fs.existsSync(fullPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(fullPath, 'utf-8');
    const rows = parseCSV(content);

    const isHuman = entry.organism === 'Homo sapiens';
    const clockGeneList = isHuman ? CLOCK_GENES_HUMAN : CLOCK_GENES_MOUSE;
    const targetGeneList = isHuman ? TARGET_GENES_HUMAN : TARGET_GENES_MOUSE;

    const clockEigenvalues: { gene: string; value: number }[] = [];
    const targetEigenvalues: { gene: string; value: number }[] = [];

    for (const gene of clockGeneList) {
      const series = findGeneData(rows, gene, entry.useEnsembl);
      if (series) {
        const result = fitAR2(series);
        if (result.eigenvalue > 0 && result.eigenvalue < 1.0) {
          clockEigenvalues.push({
            gene,
            value: parseFloat(result.eigenvalue.toFixed(4)),
          });
        }
      }
    }

    for (const gene of targetGeneList) {
      const series = findGeneData(rows, gene, entry.useEnsembl);
      if (series) {
        const result = fitAR2(series);
        if (result.eigenvalue > 0 && result.eigenvalue < 1.0) {
          targetEigenvalues.push({
            gene,
            value: parseFloat(result.eigenvalue.toFixed(4)),
          });
        }
      }
    }

    if (clockEigenvalues.length < 2 || targetEigenvalues.length < 1) {
      const meanClock = clockEigenvalues.length > 0 ? clockEigenvalues.reduce((s, e) => s + e.value, 0) / clockEigenvalues.length : 0;
      const meanTarget = targetEigenvalues.length > 0 ? targetEigenvalues.reduce((s, e) => s + e.value, 0) / targetEigenvalues.length : 0;
      return {
        name: entry.name,
        geoId: entry.geoId,
        tumorType: entry.tumorType,
        organism: entry.organism,
        nSamples: entry.nSamples,
        hasMatchedNormal: entry.hasMatchedNormal,
        timepoints: entry.timepoints,
        clockEigenvalues,
        targetEigenvalues,
        gearboxGap: parseFloat((meanClock - meanTarget).toFixed(4)),
        gearboxIntact: false,
        source: 'live-computed' as const,
        computedAt: new Date().toISOString(),
        insufficientData: true,
        warning: `Insufficient genes: ${clockEigenvalues.length} clock, ${targetEigenvalues.length} target (need ≥2 clock, ≥1 target)`,
      };
    }

    const meanClock = clockEigenvalues.reduce((s, e) => s + e.value, 0) / clockEigenvalues.length;
    const meanTarget = targetEigenvalues.reduce((s, e) => s + e.value, 0) / targetEigenvalues.length;
    const gearboxGap = parseFloat((meanClock - meanTarget).toFixed(4));
    const gearboxIntact = gearboxGap > 0;

    return {
      name: entry.name,
      geoId: entry.geoId,
      tumorType: entry.tumorType,
      organism: entry.organism,
      nSamples: entry.nSamples,
      hasMatchedNormal: entry.hasMatchedNormal,
      timepoints: entry.timepoints,
      clockEigenvalues,
      targetEigenvalues,
      gearboxGap,
      gearboxIntact,
      source: 'live-computed',
      computedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

const cohortCache = new Map<string, { cohorts: CancerCohort[]; computedAt: string }>();
const CACHE_KEY = 'all_cohorts';

export function getAllCohorts(): CancerCohort[] {
  const cached = cohortCache.get(CACHE_KEY);
  if (cached) {
    return cached.cohorts;
  }

  const cohorts: CancerCohort[] = [];
  for (const entry of COHORT_REGISTRY) {
    const cohort = computeCohortEigenvalues(entry);
    if (cohort) {
      cohorts.push(cohort);
    }
  }

  const computedAt = new Date().toISOString();
  cohortCache.set(CACHE_KEY, { cohorts, computedAt });
  return cohorts;
}

export function getCohortsByType(tumorType: string): CancerCohort[] {
  return getAllCohorts().filter(c =>
    c.tumorType.toLowerCase() === tumorType.toLowerCase()
  );
}

export function compareCancerVsNormal(): CancerComparisonResult {
  const allCohorts = getAllCohorts();

  const normalTypes = ['Normal', 'Normal/Control'];
  const normalCohorts = allCohorts.filter(c => normalTypes.includes(c.tumorType));
  const cancerCohorts = allCohorts.filter(c => !normalTypes.includes(c.tumorType) && c.tumorType !== 'Aging');

  const meanHealthyGap = normalCohorts.length > 0
    ? normalCohorts.reduce((sum, c) => sum + c.gearboxGap, 0) / normalCohorts.length
    : 0;

  const meanCancerGap = cancerCohorts.length > 0
    ? cancerCohorts.reduce((sum, c) => sum + c.gearboxGap, 0) / cancerCohorts.length
    : 0;

  const gearboxIntactCount = allCohorts.filter(c => c.gearboxIntact).length;
  const gearboxDisruptedCount = allCohorts.filter(c => !c.gearboxIntact).length;

  const byTumorType: Record<string, { healthy: number; cancer: number; n: number }> = {};
  for (const cohort of allCohorts) {
    const type = cohort.tumorType;
    if (!byTumorType[type]) {
      byTumorType[type] = { healthy: 0, cancer: 0, n: 0 };
    }
    if (cohort.gearboxIntact) {
      byTumorType[type].healthy++;
    } else {
      byTumorType[type].cancer++;
    }
    byTumorType[type].n++;
  }

  const consistentDisruption = cancerCohorts.every(c => !c.gearboxIntact);

  const computedAt = cohortCache.get(CACHE_KEY)?.computedAt || new Date().toISOString();

  return {
    cohorts: allCohorts,
    summary: {
      totalCohorts: allCohorts.length,
      gearboxIntactCount,
      gearboxDisruptedCount,
      meanHealthyGap,
      meanCancerGap,
      consistentDisruption
    },
    byTumorType,
    computedAt,
  };
}

export function getTumorTypeStats(tumorType: string): {
  cohorts: CancerCohort[];
  meanClockEigenvalue: number;
  meanTargetEigenvalue: number;
  gearboxPattern: string;
} | null {
  const cohorts = getCohortsByType(tumorType);
  if (cohorts.length === 0) return null;

  const allClockValues = cohorts.flatMap(c => c.clockEigenvalues.map(e => e.value));
  const allTargetValues = cohorts.flatMap(c => c.targetEigenvalues.map(e => e.value));

  const meanClockEigenvalue = allClockValues.reduce((a, b) => a + b, 0) / allClockValues.length;
  const meanTargetEigenvalue = allTargetValues.reduce((a, b) => a + b, 0) / allTargetValues.length;

  const gap = meanClockEigenvalue - meanTargetEigenvalue;
  let gearboxPattern: string;
  if (gap > 0.1) {
    gearboxPattern = 'Intact: Clock > Target';
  } else if (gap < -0.1) {
    gearboxPattern = 'Disrupted: Target > Clock';
  } else {
    gearboxPattern = 'Converged: Clock ≈ Target';
  }

  return { cohorts, meanClockEigenvalue, meanTargetEigenvalue, gearboxPattern };
}
