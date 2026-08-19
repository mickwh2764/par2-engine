import * as fs from 'fs';
import * as path from 'path';
import { solveAR2Eigenvalues, computeEigenperiod } from './par2-engine';
import { computeADF } from './edge-case-diagnostics';

function computeAR2(timeSeries: number[]): { eigenvalue: number; beta1: number; beta2: number; r2: number; eigenperiod: number } {
  const mean = timeSeries.reduce((a, b) => a + b, 0) / timeSeries.length;
  const centered = timeSeries.map(v => v - mean);

  const Y: number[] = [];
  const X1: number[] = [];
  const X2: number[] = [];

  for (let i = 2; i < centered.length; i++) {
    Y.push(centered[i]);
    X1.push(centered[i - 1]);
    X2.push(centered[i - 2]);
  }

  const sumX1X1 = X1.reduce((a, _, i) => a + X1[i] * X1[i], 0);
  const sumX2X2 = X2.reduce((a, _, i) => a + X2[i] * X2[i], 0);
  const sumX1X2 = X1.reduce((a, _, i) => a + X1[i] * X2[i], 0);
  const sumYX1 = Y.reduce((a, _, i) => a + Y[i] * X1[i], 0);
  const sumYX2 = Y.reduce((a, _, i) => a + Y[i] * X2[i], 0);

  const det = sumX1X1 * sumX2X2 - sumX1X2 * sumX1X2;
  if (Math.abs(det) < 1e-10) {
    return { eigenvalue: 0, beta1: 0, beta2: 0, r2: 0, eigenperiod: 0 };
  }

  const beta1 = (sumX2X2 * sumYX1 - sumX1X2 * sumYX2) / det;
  const beta2 = (sumX1X1 * sumYX2 - sumX1X2 * sumYX1) / det;

  const eigenResult = solveAR2Eigenvalues(beta1, beta2);
  const eigenperiodResult = computeEigenperiod(eigenResult, 2);
  const maxModulus = Math.max(eigenResult.modulus1, eigenResult.modulus2);

  const predictions: number[] = [];
  for (let i = 2; i < centered.length; i++) {
    predictions.push(beta1 * centered[i - 1] + beta2 * centered[i - 2]);
  }

  const ssRes = Y.reduce((sum, y, i) => sum + Math.pow(y - predictions[i], 2), 0);
  const yMean = Y.reduce((a, b) => a + b, 0) / Y.length;
  const ssTot = Y.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0);
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  return {
    eigenvalue: maxModulus,
    beta1,
    beta2,
    r2,
    eigenperiod: eigenperiodResult.dominantEigenperiod || 0
  };
}

const CLOCK_GENES_UPPER = ['PER1', 'PER2', 'CRY1', 'CRY2', 'CLOCK', 'ARNTL', 'NR1D1', 'NR1D2'];
const TARGET_GENES_UPPER = ['MYC', 'CCND1', 'CCNB1', 'CDK1', 'WEE1', 'CDKN1A', 'LGR5', 'AXIN2', 'CTNNB1', 'APC', 'TP53', 'MDM2', 'ATM', 'CHEK2', 'BCL2', 'BAX', 'PPARG', 'SIRT1', 'HIF1A'];

const BABOON_TISSUE_MAP: Record<string, string> = {
  'LIV': 'Liver', 'HEA': 'Heart', 'KIC': 'Kidney Cortex', 'KIM': 'Kidney Medulla',
  'LUN': 'Lung', 'CER': 'Cerebellum', 'COR': 'Cortex', 'HIP': 'Hippocampus',
  'SCN': 'SCN', 'PAN': 'Pancreas', 'ADC': 'Adrenal Cortex', 'ADM': 'Adrenal Medulla',
  'SPL': 'Spleen', 'THR': 'Thyroid', 'SKI': 'Skin', 'MUA': 'Muscle (Arm)',
  'AOR': 'Aorta', 'DUO': 'Duodenum', 'ILE': 'Ileum', 'CEC': 'Cecum',
  'ASC': 'Ascending Colon', 'DEC': 'Descending Colon', 'TES': 'Testis',
  'PIT': 'Pituitary', 'PIN': 'Pineal', 'WAT': 'White Adipose',
  'BOM': 'Bone Marrow', 'THA': 'Thalamus', 'AMY': 'Amygdala',
  'PUT': 'Putamen', 'PRO': 'Prostate', 'BLA': 'Bladder', 'OES': 'Esophagus'
};

const KEY_TISSUES = ['LIV', 'HEA', 'KIC', 'LUN', 'CER', 'HIP', 'SCN', 'PAN', 'ADC', 'SPL', 'SKI', 'AOR', 'DUO', 'WAT', 'THA'];

interface TissueResult {
  tissue: string;
  tissueCode: string;
  clockMeanEV: number;
  targetMeanEV: number;
  gap: number;
  clockGenes: { gene: string; eigenvalue: number; r2: number; adfStationary?: boolean }[];
  targetGenes: { gene: string; eigenvalue: number; r2: number; adfStationary?: boolean }[];
  hierarchyPreserved: boolean;
  clockN: number;
  targetN: number;
  adfPassRate?: number;
}

interface ExternalValidationResult {
  dataset: string;
  species: string;
  lab: string;
  reference: string;
  nTissues: number;
  nTissuesWithHierarchy: number;
  fractionPreserved: number;
  meanGap: number;
  medianGap: number;
  tissueResults: TissueResult[];
  summary: string;
  clockGrandMean: number;
  targetGrandMean: number;
  pValue: number;
  significanceNote: string;
  adfStationarityRate?: number;
  adfNote?: string;
}

function loadBaboonData(): Map<string, Map<string, number[]>> | null {
  const filePath = path.join(process.cwd(), 'datasets', 'GSE98965_baboon_FPKM.csv');
  if (!fs.existsSync(filePath)) return null;

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  const header = lines[0].split(',');

  const tissueTimepoints: Map<string, number[]> = new Map();
  for (let i = 2; i < header.length; i++) {
    const match = header[i].match(/^([A-Z]+)\.ZT(\d+)/);
    if (match) {
      const tissue = match[1];
      if (!tissueTimepoints.has(tissue)) {
        tissueTimepoints.set(tissue, []);
      }
      tissueTimepoints.get(tissue)!.push(i);
    }
  }

  const result: Map<string, Map<string, number[]>> = new Map();

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    const symbol = parts[1];
    if (!symbol) continue;

    const tpEntries = Array.from(tissueTimepoints.entries());
  for (const [tissue, indices] of tpEntries) {
      if (!KEY_TISSUES.includes(tissue)) continue;

      const values = indices.map((idx: number) => parseFloat(parts[idx]) || 0);
      if (values.every((v: number) => v === 0)) continue;

      if (!result.has(tissue)) {
        result.set(tissue, new Map());
      }
      result.get(tissue)!.set(symbol, values);
    }
  }

  return result;
}

export function runExternalValidation(): ExternalValidationResult {
  const baboonData = loadBaboonData();

  if (!baboonData) {
    return {
      dataset: 'GSE98965',
      species: 'Papio anubis (baboon)',
      lab: 'Mure et al. 2018 / Panda Lab (Salk Institute)',
      reference: 'Mure LS, et al. Diurnal transcriptome atlas of a primate across major neural and peripheral organs. Science. 2018;359(6381):eaao0318.',
      nTissues: 0,
      nTissuesWithHierarchy: 0,
      fractionPreserved: 0,
      meanGap: 0,
      medianGap: 0,
      tissueResults: [],
      summary: 'Dataset not available',
      clockGrandMean: 0,
      targetGrandMean: 0,
      pValue: 1,
      significanceNote: 'Dataset not loaded'
    };
  }

  const tissueResults: TissueResult[] = [];

  const entries = Array.from(baboonData.entries());
  for (const [tissueCode, geneMap] of entries) {
    const clockResults: { gene: string; eigenvalue: number; r2: number; adfStationary?: boolean }[] = [];
    const targetResults: { gene: string; eigenvalue: number; r2: number; adfStationary?: boolean }[] = [];

    for (const gene of CLOCK_GENES_UPPER) {
      const series = geneMap.get(gene);
      if (series && series.length >= 5) {
        const maxVal = Math.max(...series);
        if (maxVal > 0.1) {
          const ar2 = computeAR2(series);
          if (ar2.eigenvalue > 0 && ar2.eigenvalue < 2) {
            const adf = computeADF(series);
            clockResults.push({ gene, eigenvalue: ar2.eigenvalue, r2: ar2.r2, adfStationary: adf.stationary });
          }
        }
      }
    }

    for (const gene of TARGET_GENES_UPPER) {
      const series = geneMap.get(gene);
      if (series && series.length >= 5) {
        const maxVal = Math.max(...series);
        if (maxVal > 0.1) {
          const ar2 = computeAR2(series);
          if (ar2.eigenvalue > 0 && ar2.eigenvalue < 2) {
            const adf = computeADF(series);
            targetResults.push({ gene, eigenvalue: ar2.eigenvalue, r2: ar2.r2, adfStationary: adf.stationary });
          }
        }
      }
    }

    if (clockResults.length >= 3 && targetResults.length >= 3) {
      const clockMean = clockResults.reduce((s, r) => s + r.eigenvalue, 0) / clockResults.length;
      const targetMean = targetResults.reduce((s, r) => s + r.eigenvalue, 0) / targetResults.length;
      const gap = clockMean - targetMean;

      const allGenes = [...clockResults, ...targetResults];
      const adfPassCount = allGenes.filter(g => g.adfStationary === true).length;
      const adfPassRate = allGenes.length > 0 ? adfPassCount / allGenes.length : 0;

      tissueResults.push({
        tissue: BABOON_TISSUE_MAP[tissueCode] || tissueCode,
        tissueCode,
        clockMeanEV: clockMean,
        targetMeanEV: targetMean,
        gap,
        clockGenes: clockResults,
        targetGenes: targetResults,
        hierarchyPreserved: gap > 0,
        clockN: clockResults.length,
        targetN: targetResults.length,
        adfPassRate
      });
    }
  }

  tissueResults.sort((a, b) => b.gap - a.gap);

  const nWithHierarchy = tissueResults.filter(t => t.hierarchyPreserved).length;
  const fraction = tissueResults.length > 0 ? nWithHierarchy / tissueResults.length : 0;
  const gaps = tissueResults.map(t => t.gap);
  const meanGap = gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
  const sortedGaps = [...gaps].sort((a, b) => a - b);
  const medianGap = sortedGaps.length > 0 ? sortedGaps[Math.floor(sortedGaps.length / 2)] : 0;

  const allClockEVs = tissueResults.flatMap(t => t.clockGenes.map(g => g.eigenvalue));
  const allTargetEVs = tissueResults.flatMap(t => t.targetGenes.map(g => g.eigenvalue));
  const clockGrandMean = allClockEVs.length > 0 ? allClockEVs.reduce((a, b) => a + b, 0) / allClockEVs.length : 0;
  const targetGrandMean = allTargetEVs.length > 0 ? allTargetEVs.reduce((a, b) => a + b, 0) / allTargetEVs.length : 0;

  const pValue = mannWhitneyU(allClockEVs, allTargetEVs);

  const allAdfRates = tissueResults.map(t => t.adfPassRate ?? 0);
  const overallAdfRate = allAdfRates.length > 0 ? allAdfRates.reduce((a, b) => a + b, 0) / allAdfRates.length : 0;

  const summary = `Cross-species validation using baboon multi-tissue circadian atlas (GSE98965, Mure et al. 2018, Salk Institute). ` +
    `Analyzed ${tissueResults.length} tissues with sufficient clock (≥3) and target (≥3) gene coverage. ` +
    `Clock-target hierarchy (clock |λ| > target |λ|) preserved in ${nWithHierarchy}/${tissueResults.length} tissues (${(fraction * 100).toFixed(0)}%). ` +
    `Grand mean eigenvalues: clock = ${clockGrandMean.toFixed(3)}, target = ${targetGrandMean.toFixed(3)}, gap = ${(clockGrandMean - targetGrandMean).toFixed(3)}. ` +
    `Mann-Whitney U test (all gene-level eigenvalues pooled): p = ${pValue < 0.001 ? pValue.toExponential(2) : pValue.toFixed(4)}. ` +
    `ADF stationarity pass rate: ${(overallAdfRate * 100).toFixed(1)}% of gene series confirmed stationary.`;

  return {
    dataset: 'GSE98965',
    species: 'Papio anubis (baboon)',
    lab: 'Mure et al. 2018 / Panda Lab (Salk Institute)',
    reference: 'Mure LS, et al. Diurnal transcriptome atlas of a primate across major neural and peripheral organs. Science. 2018;359(6381):eaao0318.',
    nTissues: tissueResults.length,
    nTissuesWithHierarchy: nWithHierarchy,
    fractionPreserved: fraction,
    meanGap,
    medianGap,
    tissueResults,
    summary,
    clockGrandMean,
    targetGrandMean,
    pValue,
    significanceNote: pValue < 0.05 ? 'Significant at α=0.05' : 'Not significant at α=0.05',
    adfStationarityRate: overallAdfRate,
    adfNote: `ADF stationarity screening: ${(overallAdfRate * 100).toFixed(1)}% of analyzed gene series pass the ADF unit root test at 5% significance. Series failing ADF are flagged but retained for completeness.`
  };
}

function mannWhitneyU(x: number[], y: number[]): number {
  const nx = x.length;
  const ny = y.length;
  if (nx === 0 || ny === 0) return 1;

  const combined: { value: number; group: 'x' | 'y' }[] = [
    ...x.map(v => ({ value: v, group: 'x' as const })),
    ...y.map(v => ({ value: v, group: 'y' as const }))
  ];
  combined.sort((a, b) => a.value - b.value);

  const ranks: number[] = [];
  let i = 0;
  while (i < combined.length) {
    let j = i;
    while (j < combined.length && combined[j].value === combined[i].value) {
      j++;
    }
    const avgRank = (i + 1 + j) / 2;
    for (let k = i; k < j; k++) {
      ranks[k] = avgRank;
    }
    i = j;
  }

  let R1 = 0;
  for (let k = 0; k < combined.length; k++) {
    if (combined[k].group === 'x') {
      R1 += ranks[k];
    }
  }

  const U1 = R1 - nx * (nx + 1) / 2;
  const U = Math.min(U1, nx * ny - U1);

  const muU = nx * ny / 2;
  const sigmaU = Math.sqrt(nx * ny * (nx + ny + 1) / 12);

  if (sigmaU === 0) return 1;
  const z = Math.abs((U - muU) / sigmaU);

  const p = 2 * (1 - normalCDF(z));
  return p;
}

function normalCDF(z: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}
