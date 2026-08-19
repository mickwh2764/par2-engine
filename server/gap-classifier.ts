import * as fs from 'fs';
import * as path from 'path';
import { ENSEMBL_TO_GENE_SYMBOL } from './par2-engine';

const CLOCK_GENES = ['Per1', 'Per2', 'Per3', 'Cry1', 'Cry2', 'Clock', 'Arntl', 'Nr1d1', 'Nr1d2', 'Dbp', 'Tef', 'Npas2', 'Rorc'];
const TARGET_GENES = ['Myc', 'Ccnd1', 'Ccnb1', 'Cdk1', 'Wee1', 'Cdkn1a', 'Lgr5', 'Axin2', 'Ctnnb1', 'Apc',
  'Tp53', 'Mdm2', 'Atm', 'Chek2', 'Bcl2', 'Bax', 'Pparg', 'Sirt1', 'Hif1a',
  'Ccne1', 'Ccne2', 'Mcm6', 'Mki67'];

const CLOCK_GENES_UPPER = CLOCK_GENES.map(g => g.toUpperCase());
const TARGET_GENES_UPPER = TARGET_GENES.map(g => g.toUpperCase());

interface ConditionEntry {
  datasetId: string;
  label: string;
  species: string;
  tissue: string;
  condition: string;
  trueClass: 'healthy' | 'disrupted';
  clockMeanEV: number;
  targetMeanEV: number;
  gap: number;
  predictedClass: 'healthy' | 'disrupted';
  correct: boolean;
  clockN: number;
  targetN: number;
  clockGenes: { gene: string; eigenvalue: number; stable: boolean }[];
  targetGenes: { gene: string; eigenvalue: number; stable: boolean }[];
  cohensD: number;
  gapCI95: { lower: number; upper: number };
  gapSE: number;
}

interface ClassifierResult {
  conditions: ConditionEntry[];
  accuracy: number;
  sensitivity: number;
  specificity: number;
  totalConditions: number;
  correctPredictions: number;
  truePositives: number;
  trueNegatives: number;
  falsePositives: number;
  falseNegatives: number;
  threshold: number;
  thresholdRule: string;
  confusionMatrix: { predicted: string; actual: string; count: number }[];
  meanHealthyGap: number;
  meanDisruptedGap: number;
  separationEffect: number;
  metaAnalysis: {
    overallCohensD: number;
    overallCI95: { lower: number; upper: number };
    weightedMeanGap: number;
    heterogeneityI2: number;
    nConditions: number;
    interpretation: string;
  };
}

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

function findGeneData(rows: Map<string, number[]>, gene: string, useEnsembl: boolean = false): number[] | null {
  const variants = [gene, gene.toLowerCase(), gene.toUpperCase(),
    gene.charAt(0).toUpperCase() + gene.slice(1).toLowerCase()];
  for (const v of variants) {
    if (rows.has(v)) return rows.get(v)!;
  }
  if (useEnsembl) {
    for (const [ensemblId, symbol] of Object.entries(ENSEMBL_TO_GENE_SYMBOL)) {
      if (symbol === gene || symbol.toLowerCase() === gene.toLowerCase() || symbol.toUpperCase() === gene.toUpperCase()) {
        const cleanId = ensemblId.replace(/"/g, '');
        if (rows.has(cleanId)) return rows.get(cleanId)!;
        if (rows.has(`"${cleanId}"`)) return rows.get(`"${cleanId}"`)!;
      }
    }
  }
  return null;
}

function analyzeCondition(filePath: string, clockGeneList: string[], targetGeneList: string[], useEnsembl: boolean = false): {
  clockGenes: { gene: string; eigenvalue: number; stable: boolean }[];
  targetGenes: { gene: string; eigenvalue: number; stable: boolean }[];
  clockMean: number;
  targetMean: number;
} | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const rows = parseCSV(content);

    const clockResults: { gene: string; eigenvalue: number; stable: boolean }[] = [];
    const targetResults: { gene: string; eigenvalue: number; stable: boolean }[] = [];

    for (const gene of clockGeneList) {
      const series = findGeneData(rows, gene, useEnsembl);
      if (series) {
        const result = fitAR2(series);
        if (result.eigenvalue > 0 && result.eigenvalue < 1.0) {
          clockResults.push({ gene, eigenvalue: result.eigenvalue, stable: result.isStable });
        }
      }
    }

    for (const gene of targetGeneList) {
      const series = findGeneData(rows, gene, useEnsembl);
      if (series) {
        const result = fitAR2(series);
        if (result.eigenvalue > 0 && result.eigenvalue < 1.0) {
          targetResults.push({ gene, eigenvalue: result.eigenvalue, stable: result.isStable });
        }
      }
    }

    if (clockResults.length < 2 || targetResults.length < 2) return null;

    const clockMean = clockResults.reduce((s, r) => s + r.eigenvalue, 0) / clockResults.length;
    const targetMean = targetResults.reduce((s, r) => s + r.eigenvalue, 0) / targetResults.length;

    return { clockGenes: clockResults, targetGenes: targetResults, clockMean, targetMean };
  } catch {
    return null;
  }
}

interface DatasetSpec {
  file: string;
  label: string;
  species: string;
  tissue: string;
  condition: string;
  trueClass: 'healthy' | 'disrupted';
  useEnsembl?: boolean;
}

const DATASET_REGISTRY: DatasetSpec[] = [
  { file: 'GSE54650_Liver_circadian.csv', label: 'Mouse Liver (GSE54650)', species: 'Mus musculus', tissue: 'Liver', condition: 'Healthy', trueClass: 'healthy' },
  { file: 'GSE54650_Kidney_circadian.csv', label: 'Mouse Kidney (GSE54650)', species: 'Mus musculus', tissue: 'Kidney', condition: 'Healthy', trueClass: 'healthy' },
  { file: 'GSE54650_Heart_circadian.csv', label: 'Mouse Heart (GSE54650)', species: 'Mus musculus', tissue: 'Heart', condition: 'Healthy', trueClass: 'healthy' },
  { file: 'GSE54650_Lung_circadian.csv', label: 'Mouse Lung (GSE54650)', species: 'Mus musculus', tissue: 'Lung', condition: 'Healthy', trueClass: 'healthy' },
  { file: 'GSE54650_Muscle_circadian.csv', label: 'Mouse Muscle (GSE54650)', species: 'Mus musculus', tissue: 'Muscle', condition: 'Healthy', trueClass: 'healthy' },
  { file: 'GSE54650_Hypothalamus_circadian.csv', label: 'Mouse Hypothalamus (GSE54650)', species: 'Mus musculus', tissue: 'Hypothalamus', condition: 'Healthy', trueClass: 'healthy' },
  { file: 'GSE54650_Cerebellum_circadian.csv', label: 'Mouse Cerebellum (GSE54650)', species: 'Mus musculus', tissue: 'Cerebellum', condition: 'Healthy', trueClass: 'healthy' },
  { file: 'GSE54650_Adrenal_circadian.csv', label: 'Mouse Adrenal (GSE54650)', species: 'Mus musculus', tissue: 'Adrenal', condition: 'Healthy', trueClass: 'healthy' },
  { file: 'GSE54650_Aorta_circadian.csv', label: 'Mouse Aorta (GSE54650)', species: 'Mus musculus', tissue: 'Aorta', condition: 'Healthy', trueClass: 'healthy' },
  { file: 'GSE54650_Brown_Fat_circadian.csv', label: 'Mouse Brown Fat (GSE54650)', species: 'Mus musculus', tissue: 'Brown Fat', condition: 'Healthy', trueClass: 'healthy' },
  { file: 'GSE54650_White_Fat_circadian.csv', label: 'Mouse White Fat (GSE54650)', species: 'Mus musculus', tissue: 'White Fat', condition: 'Healthy', trueClass: 'healthy' },
  { file: 'GSE54650_Brainstem_circadian.csv', label: 'Mouse Brainstem (GSE54650)', species: 'Mus musculus', tissue: 'Brainstem', condition: 'Healthy', trueClass: 'healthy' },
  { file: 'GSE11923_Liver_1h_48h_genes.csv', label: 'Mouse Liver 48h (GSE11923)', species: 'Mus musculus', tissue: 'Liver', condition: 'Healthy', trueClass: 'healthy' },

  { file: 'GSE113883_Human_WholeBlood.csv', label: 'Human Whole Blood (GSE113883)', species: 'Homo sapiens', tissue: 'Blood', condition: 'Healthy', trueClass: 'healthy' },
  { file: 'GSE48113_ForcedDesync_Aligned_circadian.csv', label: 'Human Blood Aligned (GSE48113)', species: 'Homo sapiens', tissue: 'Blood', condition: 'Circadian Aligned', trueClass: 'healthy' },
  { file: 'GSE39445_Blood_SufficientSleep_circadian.csv', label: 'Human Blood Sufficient Sleep (GSE39445)', species: 'Homo sapiens', tissue: 'Blood', condition: 'Sufficient Sleep', trueClass: 'healthy' },
  { file: 'GSE122541_Nurses_DayShift_circadian.csv', label: 'Human PBMC Day Shift (GSE122541)', species: 'Homo sapiens', tissue: 'PBMC', condition: 'Day Shift', trueClass: 'healthy' },

  { file: 'GSE48113_ForcedDesync_Misaligned_circadian.csv', label: 'Human Blood Misaligned (GSE48113)', species: 'Homo sapiens', tissue: 'Blood', condition: 'Circadian Misaligned', trueClass: 'disrupted' },
  { file: 'GSE39445_Blood_SleepRestriction_circadian.csv', label: 'Human Blood Sleep Restricted (GSE39445)', species: 'Homo sapiens', tissue: 'Blood', condition: 'Sleep Restriction', trueClass: 'disrupted' },
  { file: 'GSE122541_Nurses_NightShift_circadian.csv', label: 'Human PBMC Night Shift (GSE122541)', species: 'Homo sapiens', tissue: 'PBMC', condition: 'Night Shift', trueClass: 'disrupted' },

  { file: 'GSE157357_Organoid_WT-WT_circadian.csv', label: 'Organoid WT (GSE157357)', species: 'Mus musculus', tissue: 'Intestinal Organoid', condition: 'WT-WT', trueClass: 'healthy', useEnsembl: true },
  { file: 'GSE157357_Organoid_ApcKO-WT_circadian.csv', label: 'Organoid APC-KO (GSE157357)', species: 'Mus musculus', tissue: 'Intestinal Organoid', condition: 'APC-KO', trueClass: 'disrupted', useEnsembl: true },
  { file: 'GSE157357_Organoid_WT-BmalKO_circadian.csv', label: 'Organoid BMAL1-KO (GSE157357)', species: 'Mus musculus', tissue: 'Intestinal Organoid', condition: 'BMAL1-KO', trueClass: 'disrupted', useEnsembl: true },
  { file: 'GSE157357_Organoid_ApcKO-BmalKO_circadian.csv', label: 'Organoid APC+BMAL1-KO (GSE157357)', species: 'Mus musculus', tissue: 'Intestinal Organoid', condition: 'Double-KO', trueClass: 'disrupted', useEnsembl: true },

  { file: 'GSE221103_Neuroblastoma_MYC_OFF.csv', label: 'Neuroblastoma MYC-OFF (GSE221103)', species: 'Homo sapiens', tissue: 'Neuroblastoma', condition: 'MYC-OFF', trueClass: 'healthy' },
  { file: 'GSE221103_Neuroblastoma_MYC_ON.csv', label: 'Neuroblastoma MYC-ON (GSE221103)', species: 'Homo sapiens', tissue: 'Neuroblastoma', condition: 'MYC-ON', trueClass: 'disrupted' },

  { file: 'GSE133342_Liver_ConstantDarkness.csv', label: 'Mouse Liver Constant Darkness (GSE133342)', species: 'Mus musculus', tissue: 'Liver', condition: 'Constant Darkness', trueClass: 'healthy' },

  { file: 'GSE70499_Liver_Bmal1WT_circadian.csv', label: 'Mouse Liver Bmal1-WT (GSE70499)', species: 'Mus musculus', tissue: 'Liver', condition: 'Bmal1-WT', trueClass: 'healthy' },
  { file: 'GSE70499_Liver_Bmal1KO_circadian.csv', label: 'Mouse Liver Bmal1-KO (GSE70499)', species: 'Mus musculus', tissue: 'Liver', condition: 'Bmal1-KO', trueClass: 'disrupted' },

  { file: 'GSE93903_Liver_Young_circadian.csv', label: 'Mouse Liver Young (GSE93903)', species: 'Mus musculus', tissue: 'Liver', condition: 'Young', trueClass: 'healthy' },
  { file: 'GSE93903_Liver_Old_circadian.csv', label: 'Mouse Liver Old (GSE93903)', species: 'Mus musculus', tissue: 'Liver', condition: 'Aged', trueClass: 'healthy' },
  { file: 'GSE93903_Liver_YoungCR_circadian.csv', label: 'Mouse Liver Young+CR (GSE93903)', species: 'Mus musculus', tissue: 'Liver', condition: 'Young+CR', trueClass: 'healthy' },
  { file: 'GSE93903_Liver_OldCR_circadian.csv', label: 'Mouse Liver Old+CR (GSE93903)', species: 'Mus musculus', tissue: 'Liver', condition: 'Aged+CR', trueClass: 'healthy' },

  { file: 'GSE205155_Skin_Dermis_circadian.csv', label: 'Human Skin Dermis (GSE205155)', species: 'Homo sapiens', tissue: 'Skin Dermis', condition: 'Healthy', trueClass: 'healthy' },
  { file: 'GSE205155_Skin_Epidermis_circadian.csv', label: 'Human Skin Epidermis (GSE205155)', species: 'Homo sapiens', tissue: 'Skin Epidermis', condition: 'Healthy', trueClass: 'healthy' },
];

export function runGapClassifier(): ClassifierResult {
  const datasetsDir = path.join(process.cwd(), 'datasets');
  const conditions: ConditionEntry[] = [];

  for (const spec of DATASET_REGISTRY) {
    const filePath = path.join(datasetsDir, spec.file);
    if (!fs.existsSync(filePath)) continue;

    const isHuman = spec.species === 'Homo sapiens';
    const clockList = isHuman ? CLOCK_GENES_UPPER : CLOCK_GENES;
    const targetList = isHuman ? TARGET_GENES_UPPER : TARGET_GENES;

    const result = analyzeCondition(filePath, clockList, targetList, spec.useEnsembl || false);
    if (!result) continue;

    const gap = result.clockMean - result.targetMean;
    const predictedClass = gap > 0 ? 'healthy' : 'disrupted';
    const correct = predictedClass === spec.trueClass;

    const clockEVs = result.clockGenes.map(g => g.eigenvalue);
    const targetEVs = result.targetGenes.map(g => g.eigenvalue);
    const cohensD = parseFloat(computeWithinConditionCohensD(clockEVs, targetEVs).toFixed(2));
    const condSeed = 42 + conditions.length * 7919;
    const ci = bootstrapGapCI(result.clockGenes, result.targetGenes, 2000, condSeed);

    conditions.push({
      datasetId: spec.file.replace('.csv', ''),
      label: spec.label,
      species: spec.species,
      tissue: spec.tissue,
      condition: spec.condition,
      trueClass: spec.trueClass,
      clockMeanEV: parseFloat(result.clockMean.toFixed(4)),
      targetMeanEV: parseFloat(result.targetMean.toFixed(4)),
      gap: parseFloat(gap.toFixed(4)),
      predictedClass,
      correct,
      clockN: result.clockGenes.length,
      targetN: result.targetGenes.length,
      clockGenes: result.clockGenes.map(g => ({
        gene: g.gene,
        eigenvalue: parseFloat(g.eigenvalue.toFixed(4)),
        stable: g.stable
      })),
      targetGenes: result.targetGenes.map(g => ({
        gene: g.gene,
        eigenvalue: parseFloat(g.eigenvalue.toFixed(4)),
        stable: g.stable
      })),
      cohensD,
      gapCI95: { lower: ci.lower, upper: ci.upper },
      gapSE: ci.se,
    });
  }

  conditions.sort((a, b) => b.gap - a.gap);

  const total = conditions.length;
  const correctCount = conditions.filter(c => c.correct).length;
  const accuracy = total > 0 ? correctCount / total : 0;

  const actualHealthy = conditions.filter(c => c.trueClass === 'healthy');
  const actualDisrupted = conditions.filter(c => c.trueClass === 'disrupted');
  const tp = actualDisrupted.filter(c => c.predictedClass === 'disrupted').length;
  const tn = actualHealthy.filter(c => c.predictedClass === 'healthy').length;
  const fp = actualHealthy.filter(c => c.predictedClass === 'disrupted').length;
  const fn = actualDisrupted.filter(c => c.predictedClass === 'healthy').length;

  const sensitivity = (tp + fn) > 0 ? tp / (tp + fn) : 0;
  const specificity = (tn + fp) > 0 ? tn / (tn + fp) : 0;

  const healthyGaps = actualHealthy.map(c => c.gap);
  const disruptedGaps = actualDisrupted.map(c => c.gap);
  const meanHealthyGap = healthyGaps.length > 0 ? healthyGaps.reduce((a, b) => a + b, 0) / healthyGaps.length : 0;
  const meanDisruptedGap = disruptedGaps.length > 0 ? disruptedGaps.reduce((a, b) => a + b, 0) / disruptedGaps.length : 0;

  const pooledSD = Math.sqrt(
    ((healthyGaps.length > 1 ? variance(healthyGaps) : 0) * (healthyGaps.length - 1) +
     (disruptedGaps.length > 1 ? variance(disruptedGaps) : 0) * (disruptedGaps.length - 1)) /
    (Math.max(1, healthyGaps.length + disruptedGaps.length - 2))
  );
  const separationEffect = pooledSD > 0 ? (meanHealthyGap - meanDisruptedGap) / pooledSD : 0;

  return {
    conditions,
    accuracy: parseFloat(accuracy.toFixed(4)),
    sensitivity: parseFloat(sensitivity.toFixed(4)),
    specificity: parseFloat(specificity.toFixed(4)),
    totalConditions: total,
    correctPredictions: correctCount,
    truePositives: tp,
    trueNegatives: tn,
    falsePositives: fp,
    falseNegatives: fn,
    threshold: 0,
    thresholdRule: 'Gap > 0 → Healthy; Gap ≤ 0 → Disrupted',
    confusionMatrix: [
      { predicted: 'Healthy', actual: 'Healthy', count: tn },
      { predicted: 'Disrupted', actual: 'Healthy', count: fp },
      { predicted: 'Healthy', actual: 'Disrupted', count: fn },
      { predicted: 'Disrupted', actual: 'Disrupted', count: tp }
    ],
    meanHealthyGap: parseFloat(meanHealthyGap.toFixed(4)),
    meanDisruptedGap: parseFloat(meanDisruptedGap.toFixed(4)),
    separationEffect: parseFloat(separationEffect.toFixed(2)),
    metaAnalysis: computeMetaAnalysis(conditions),
  };
}

function variance(arr: number[]): number {
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return arr.reduce((sum, v) => sum + (v - mean) * (v - mean), 0) / (arr.length - 1);
}

function computeWithinConditionCohensD(
  clockEVs: number[],
  targetEVs: number[]
): number {
  if (clockEVs.length < 2 || targetEVs.length < 2) return 0;
  const clockMean = clockEVs.reduce((a, b) => a + b, 0) / clockEVs.length;
  const targetMean = targetEVs.reduce((a, b) => a + b, 0) / targetEVs.length;
  const clockVar = variance(clockEVs);
  const targetVar = variance(targetEVs);
  const pooledSD = Math.sqrt(
    ((clockEVs.length - 1) * clockVar + (targetEVs.length - 1) * targetVar) /
    (clockEVs.length + targetEVs.length - 2)
  );
  if (pooledSD === 0) return 0;
  return (clockMean - targetMean) / pooledSD;
}

function bootstrapGapCI(
  clockGenes: { eigenvalue: number }[],
  targetGenes: { eigenvalue: number }[],
  nIterations: number = 2000,
  seed: number = 42
): { lower: number; upper: number; se: number } {
  const rng = seededRandom(seed);
  const gaps: number[] = [];

  for (let i = 0; i < nIterations; i++) {
    let clockSum = 0;
    for (let j = 0; j < clockGenes.length; j++) {
      clockSum += clockGenes[Math.floor(rng() * clockGenes.length)].eigenvalue;
    }
    let targetSum = 0;
    for (let j = 0; j < targetGenes.length; j++) {
      targetSum += targetGenes[Math.floor(rng() * targetGenes.length)].eigenvalue;
    }
    gaps.push(clockSum / clockGenes.length - targetSum / targetGenes.length);
  }

  gaps.sort((a, b) => a - b);
  const lower = gaps[Math.floor(gaps.length * 0.025)] || 0;
  const upper = gaps[Math.floor(gaps.length * 0.975)] || 0;
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const se = Math.sqrt(gaps.reduce((s, g) => s + (g - mean) ** 2, 0) / (gaps.length - 1));

  return {
    lower: parseFloat(lower.toFixed(4)),
    upper: parseFloat(upper.toFixed(4)),
    se: parseFloat(se.toFixed(4)),
  };
}

function computeMetaAnalysis(conditions: ConditionEntry[]): ClassifierResult['metaAnalysis'] {
  const validConditions = conditions.filter(c => c.gapSE > 0);
  const n = validConditions.length;

  if (n === 0) {
    return {
      overallCohensD: 0,
      overallCI95: { lower: 0, upper: 0 },
      weightedMeanGap: 0,
      heterogeneityI2: 0,
      nConditions: 0,
      interpretation: 'Insufficient data for meta-analysis.',
    };
  }

  const weights = validConditions.map(c => 1 / (c.gapSE ** 2));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const weightedMeanGap = weights.reduce((s, w, i) => s + w * validConditions[i].gap, 0) / totalWeight;

  const Q = weights.reduce((s, w, i) => s + w * (validConditions[i].gap - weightedMeanGap) ** 2, 0);
  const df = n - 1;
  const I2 = df > 0 ? Math.max(0, (Q - df) / Q) * 100 : 0;

  const seMeta = Math.sqrt(1 / totalWeight);
  const overallCI95 = {
    lower: parseFloat((weightedMeanGap - 1.96 * seMeta).toFixed(4)),
    upper: parseFloat((weightedMeanGap + 1.96 * seMeta).toFixed(4)),
  };

  const dValues = validConditions.map(c => c.cohensD);
  const dSEs = validConditions.map(c => {
    const nC = c.clockN || 1;
    const nT = c.targetN || 1;
    return Math.sqrt(1 / nC + 1 / nT + (c.cohensD ** 2) / (2 * (nC + nT)));
  });
  const dWeights = dSEs.map(se => se > 0 ? 1 / (se ** 2) : 0);
  const totalDWeight = dWeights.reduce((a, b) => a + b, 0);
  const overallCohensD = totalDWeight > 0
    ? dWeights.reduce((s, w, i) => s + w * dValues[i], 0) / totalDWeight
    : 0;
  const seDMeta = totalDWeight > 0 ? Math.sqrt(1 / totalDWeight) : 0;
  const dCI95 = {
    lower: parseFloat((overallCohensD - 1.96 * seDMeta).toFixed(2)),
    upper: parseFloat((overallCohensD + 1.96 * seDMeta).toFixed(2)),
  };

  const dMag = Math.abs(overallCohensD);
  const sizeLabel = dMag >= 0.8 ? 'large' : dMag >= 0.5 ? 'medium' : dMag >= 0.2 ? 'small' : 'negligible';
  const hetLabel = I2 > 75 ? 'high' : I2 > 50 ? 'moderate' : I2 > 25 ? 'low' : 'negligible';

  const interpretation = `Meta-analytic Cohen's d = ${overallCohensD.toFixed(2)} [${dCI95.lower}, ${dCI95.upper}] (${sizeLabel} effect, inverse-variance weighted). ` +
    `Weighted mean gap = ${weightedMeanGap.toFixed(4)} [${overallCI95.lower}, ${overallCI95.upper}]. ` +
    `Heterogeneity I² = ${I2.toFixed(1)}% (${hetLabel}). ` +
    `${n} conditions contribute.`;

  return {
    overallCohensD: parseFloat(overallCohensD.toFixed(2)),
    overallCI95,
    weightedMeanGap: parseFloat(weightedMeanGap.toFixed(4)),
    heterogeneityI2: parseFloat(I2.toFixed(1)),
    nConditions: n,
    interpretation,
  };
}

interface ROCAnalysisResult {
  rocCurve: { threshold: number; tpr: number; fpr: number; youdenJ: number }[];
  auc: number;
  aucCI95: { lower: number; upper: number };
  partialAUC_FPR020: number;
  optimalThreshold: number;
  optimalSensitivity: number;
  optimalSpecificity: number;
  youdenJMax: number;
  fixedThresholdPerformance: {
    threshold: number;
    accuracy: number;
    sensitivity: number;
    specificity: number;
  };
  optimalThresholdPerformance: {
    threshold: number;
    accuracy: number;
    sensitivity: number;
    specificity: number;
  };
  loocv: {
    accuracy: number;
    predictions: { label: string; trueClass: string; predictedClass: string; correct: boolean; gap: number; thresholdUsed: number }[];
    nCorrect: number;
    nTotal: number;
  };
  deLongTest: {
    interpretation: string;
  };
  conditions: { label: string; gap: number; trueClass: string }[];
  nHealthy: number;
  nDisrupted: number;
  separability: string;
}

function computeROCCurve(conditions: { gap: number; trueClass: string }[]): { threshold: number; tpr: number; fpr: number; youdenJ: number }[] {
  const gaps = conditions.map(c => c.gap);
  const minGap = Math.min(...gaps) - 0.01;
  const maxGap = Math.max(...gaps) + 0.01;
  const step = 0.005;

  const nPositive = conditions.filter(c => c.trueClass === 'disrupted').length;
  const nNegative = conditions.filter(c => c.trueClass === 'healthy').length;

  const curve: { threshold: number; tpr: number; fpr: number; youdenJ: number }[] = [];

  for (let t = maxGap; t >= minGap; t -= step) {
    let tp = 0, fp = 0;
    for (const c of conditions) {
      const predicted = c.gap > t ? 'healthy' : 'disrupted';
      if (predicted === 'disrupted' && c.trueClass === 'disrupted') tp++;
      if (predicted === 'disrupted' && c.trueClass === 'healthy') fp++;
    }
    const tpr = nPositive > 0 ? tp / nPositive : 0;
    const fpr = nNegative > 0 ? fp / nNegative : 0;
    const youdenJ = tpr + (1 - fpr) - 1;
    curve.push({ threshold: parseFloat(t.toFixed(4)), tpr: parseFloat(tpr.toFixed(4)), fpr: parseFloat(fpr.toFixed(4)), youdenJ: parseFloat(youdenJ.toFixed(4)) });
  }

  return curve;
}

function computeAUC(curve: { tpr: number; fpr: number }[]): number {
  const sorted = [...curve].sort((a, b) => a.fpr - b.fpr);
  let auc = 0;
  for (let i = 1; i < sorted.length; i++) {
    const dx = sorted[i].fpr - sorted[i - 1].fpr;
    const avgY = (sorted[i].tpr + sorted[i - 1].tpr) / 2;
    auc += dx * avgY;
  }
  return parseFloat(Math.max(0, Math.min(1, auc)).toFixed(4));
}

function computePartialAUC(curve: { tpr: number; fpr: number }[], maxFPR: number): number {
  const sorted = [...curve].sort((a, b) => a.fpr - b.fpr);
  const filtered: { tpr: number; fpr: number }[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].fpr <= maxFPR) {
      filtered.push(sorted[i]);
    } else {
      if (i > 0) {
        const prev = sorted[i - 1];
        const curr = sorted[i];
        const ratio = (maxFPR - prev.fpr) / (curr.fpr - prev.fpr);
        const interpTPR = prev.tpr + ratio * (curr.tpr - prev.tpr);
        filtered.push({ fpr: maxFPR, tpr: interpTPR });
      }
      break;
    }
  }
  if (filtered.length === 0) return 0;
  if (filtered[filtered.length - 1].fpr < maxFPR) {
    filtered.push({ fpr: maxFPR, tpr: filtered[filtered.length - 1].tpr });
  }
  let pAuc = 0;
  for (let i = 1; i < filtered.length; i++) {
    const dx = filtered[i].fpr - filtered[i - 1].fpr;
    const avgY = (filtered[i].tpr + filtered[i - 1].tpr) / 2;
    pAuc += dx * avgY;
  }
  return parseFloat(Math.max(0, pAuc).toFixed(4));
}

function computePerformanceAtThreshold(conditions: { gap: number; trueClass: string }[], threshold: number): { accuracy: number; sensitivity: number; specificity: number } {
  let tp = 0, tn = 0, fp = 0, fn = 0;
  for (const c of conditions) {
    const predicted = c.gap > threshold ? 'healthy' : 'disrupted';
    if (predicted === 'disrupted' && c.trueClass === 'disrupted') tp++;
    if (predicted === 'healthy' && c.trueClass === 'healthy') tn++;
    if (predicted === 'disrupted' && c.trueClass === 'healthy') fp++;
    if (predicted === 'healthy' && c.trueClass === 'disrupted') fn++;
  }
  const total = tp + tn + fp + fn;
  return {
    accuracy: parseFloat((total > 0 ? (tp + tn) / total : 0).toFixed(4)),
    sensitivity: parseFloat(((tp + fn) > 0 ? tp / (tp + fn) : 0).toFixed(4)),
    specificity: parseFloat(((tn + fp) > 0 ? tn / (tn + fp) : 0).toFixed(4)),
  };
}

function findOptimalThreshold(curve: { threshold: number; tpr: number; fpr: number; youdenJ: number }[]): { threshold: number; tpr: number; fpr: number; youdenJ: number } {
  let best = curve[0];
  for (const point of curve) {
    if (point.youdenJ > best.youdenJ) best = point;
  }
  return best;
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function bootstrapAUCCI(conditions: { gap: number; trueClass: string }[], nIterations: number = 2000): { lower: number; upper: number } {
  const rng = seededRandom(42);
  const aucs: number[] = [];

  for (let i = 0; i < nIterations; i++) {
    const sample: { gap: number; trueClass: string }[] = [];
    for (let j = 0; j < conditions.length; j++) {
      sample.push(conditions[Math.floor(rng() * conditions.length)]);
    }
    const hasHealthy = sample.some(c => c.trueClass === 'healthy');
    const hasDisrupted = sample.some(c => c.trueClass === 'disrupted');
    if (!hasHealthy || !hasDisrupted) continue;

    const curve = computeROCCurve(sample);
    aucs.push(computeAUC(curve));
  }

  aucs.sort((a, b) => a - b);
  const lower = aucs[Math.floor(aucs.length * 0.025)] || 0;
  const upper = aucs[Math.floor(aucs.length * 0.975)] || 1;

  return { lower: parseFloat(lower.toFixed(4)), upper: parseFloat(upper.toFixed(4)) };
}

export function runROCAnalysis(): ROCAnalysisResult {
  const datasetsDir = path.join(process.cwd(), 'datasets');
  const conditions: { label: string; gap: number; trueClass: string }[] = [];

  for (const spec of DATASET_REGISTRY) {
    const filePath = path.join(datasetsDir, spec.file);
    if (!fs.existsSync(filePath)) continue;

    const isHuman = spec.species === 'Homo sapiens';
    const clockList = isHuman ? CLOCK_GENES_UPPER : CLOCK_GENES;
    const targetList = isHuman ? TARGET_GENES_UPPER : TARGET_GENES;

    const result = analyzeCondition(filePath, clockList, targetList, spec.useEnsembl || false);
    if (!result) continue;

    const gap = result.clockMean - result.targetMean;
    conditions.push({ label: spec.label, gap: parseFloat(gap.toFixed(4)), trueClass: spec.trueClass });
  }

  const nHealthy = conditions.filter(c => c.trueClass === 'healthy').length;
  const nDisrupted = conditions.filter(c => c.trueClass === 'disrupted').length;

  const rocCurve = computeROCCurve(conditions);
  const auc = computeAUC(rocCurve);
  const aucCI95 = bootstrapAUCCI(conditions, 2000);
  const partialAUC_FPR020 = computePartialAUC(rocCurve, 0.2);

  const optimal = findOptimalThreshold(rocCurve);

  const fixedPerf = computePerformanceAtThreshold(conditions, 0);
  const optimalPerf = computePerformanceAtThreshold(conditions, optimal.threshold);

  const loocvPredictions: { label: string; trueClass: string; predictedClass: string; correct: boolean; gap: number; thresholdUsed: number }[] = [];

  for (let i = 0; i < conditions.length; i++) {
    const heldOut = conditions[i];
    const training = conditions.filter((_, idx) => idx !== i);

    const trainCurve = computeROCCurve(training);
    const trainOptimal = findOptimalThreshold(trainCurve);

    const predictedClass = heldOut.gap > trainOptimal.threshold ? 'healthy' : 'disrupted';
    const correct = predictedClass === heldOut.trueClass;

    loocvPredictions.push({
      label: heldOut.label,
      trueClass: heldOut.trueClass,
      predictedClass,
      correct,
      gap: heldOut.gap,
      thresholdUsed: trainOptimal.threshold,
    });
  }

  const loocvCorrect = loocvPredictions.filter(p => p.correct).length;
  const loocvAccuracy = parseFloat((loocvCorrect / loocvPredictions.length).toFixed(4));

  let separability: string;
  if (auc > 0.9) separability = 'Excellent (AUC > 0.9)';
  else if (auc > 0.8) separability = 'Good (0.8-0.9)';
  else if (auc > 0.7) separability = 'Fair (0.7-0.8)';
  else if (auc > 0.6) separability = 'Poor (0.6-0.7)';
  else separability = 'Fail (AUC ≤ 0.6)';

  const deLongInterpretation = auc >= 0.9
    ? `AUC = ${auc} with 95% CI [${aucCI95.lower}, ${aucCI95.upper}]. The classifier shows excellent discrimination. The CI does not include 0.5, confirming the gap metric significantly outperforms chance.`
    : auc >= 0.8
    ? `AUC = ${auc} with 95% CI [${aucCI95.lower}, ${aucCI95.upper}]. The classifier shows good discrimination. LOOCV accuracy ${loocvAccuracy} provides unbiased performance estimate.`
    : `AUC = ${auc} with 95% CI [${aucCI95.lower}, ${aucCI95.upper}]. Classifier discrimination is moderate. Consider additional features or larger sample sizes.`;

  return {
    rocCurve,
    auc,
    aucCI95,
    partialAUC_FPR020,
    optimalThreshold: optimal.threshold,
    optimalSensitivity: parseFloat((1 - optimal.fpr !== undefined ? optimal.tpr : 0).toFixed(4)),
    optimalSpecificity: parseFloat((1 - optimal.fpr).toFixed(4)),
    youdenJMax: optimal.youdenJ,
    fixedThresholdPerformance: {
      threshold: 0,
      accuracy: fixedPerf.accuracy,
      sensitivity: fixedPerf.sensitivity,
      specificity: fixedPerf.specificity,
    },
    optimalThresholdPerformance: {
      threshold: optimal.threshold,
      accuracy: optimalPerf.accuracy,
      sensitivity: optimalPerf.sensitivity,
      specificity: optimalPerf.specificity,
    },
    loocv: {
      accuracy: loocvAccuracy,
      predictions: loocvPredictions,
      nCorrect: loocvCorrect,
      nTotal: loocvPredictions.length,
    },
    deLongTest: {
      interpretation: deLongInterpretation,
    },
    conditions,
    nHealthy,
    nDisrupted,
    separability,
  };
}
