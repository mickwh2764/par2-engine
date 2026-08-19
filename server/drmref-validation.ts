import * as fs from 'fs';
import * as path from 'path';
import { generateProcessedTable, type GeneResult } from './processed-tables';

export interface DrmrefDrugResult {
  drug: string;
  cancerTypes: string[];
  resistanceGenesTotal: number;
  sensitivityGenesTotal: number;
  resistanceGenesMatched: number;
  sensitivityGenesMatched: number;
  resistanceMeanLambda: number;
  sensitivityMeanLambda: number;
  genomeMeanLambda: number;
  lambdaDifference: number;
  permutationP: number;
  predictionSupported: boolean;
  effectSize: number;
}

export interface DrmrefValidationResult {
  source: string;
  citation: string;
  referenceDataset: string;
  totalDrugs: number;
  drugsWithSufficientGenes: number;
  drugsSupported: number;
  drugsMarginal: number;
  drugsNotSupported: number;
  overallDirection: string;
  metaAnalysis: {
    weightedMeanDiff: number;
    drugsHigherResistance: number;
    drugsLowerResistance: number;
    binomialP: number;
  };
  cancerTypeSummary: Array<{
    cancerType: string;
    drugsCount: number;
    drugsSupported: number;
    meanDifference: number;
  }>;
  drugs: DrmrefDrugResult[];
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function stdDev(values: number[], m: number): number {
  if (values.length < 2) return 0;
  return Math.sqrt(values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1));
}

function cohensD(a: number[], b: number[]): number {
  const ma = mean(a);
  const mb = mean(b);
  const sa = stdDev(a, ma);
  const sb = stdDev(b, mb);
  const pooled = Math.sqrt(((a.length - 1) * sa ** 2 + (b.length - 1) * sb ** 2) / (a.length + b.length - 2));
  return pooled > 0 ? (ma - mb) / pooled : 0;
}

function binomialP(successes: number, trials: number, prob: number): number {
  if (trials === 0) return 1;
  let pValue = 0;
  for (let k = successes; k <= trials; k++) {
    let logBinom = 0;
    for (let i = 0; i < k; i++) logBinom += Math.log(trials - i) - Math.log(i + 1);
    pValue += Math.exp(logBinom + k * Math.log(prob) + (trials - k) * Math.log(1 - prob));
  }
  return Math.min(pValue, 1);
}

let cachedResult: DrmrefValidationResult | null = null;

export function runDrmrefValidation(): DrmrefValidationResult {
  if (cachedResult) return cachedResult;

  const drmrefPath = path.resolve('datasets/drmref_resistance_genes.json');
  if (!fs.existsSync(drmrefPath)) {
    throw new Error('DRMref data file not found');
  }
  const drmref = JSON.parse(fs.readFileSync(drmrefPath, 'utf-8'));

  const datasetPath = path.resolve('datasets/GSE11923_Liver_1h_48h_genes.csv');
  const allResults = generateProcessedTable(datasetPath);

  const geneMap = new Map<string, GeneResult>();
  for (const r of allResults) {
    geneMap.set(r.gene.toUpperCase(), r);
  }

  const allEigenvalues = allResults
    .filter(r => r.eigenvalueModulus < 1.5)
    .map(r => r.eigenvalueModulus);
  const genomeMean = mean(allEigenvalues);

  const drugResults: DrmrefDrugResult[] = [];

  for (const drugData of drmref.drugs) {
    const resistanceMatched: GeneResult[] = [];
    for (const g of drugData.resistanceGenes) {
      const found = geneMap.get(g.gene.toUpperCase());
      if (found && found.eigenvalueModulus < 1.5) resistanceMatched.push(found);
    }

    const sensitivityMatched: GeneResult[] = [];
    for (const g of drugData.sensitivityGenes) {
      const found = geneMap.get(g.gene.toUpperCase());
      if (found && found.eigenvalueModulus < 1.5) sensitivityMatched.push(found);
    }

    if (resistanceMatched.length < 5 || sensitivityMatched.length < 5) continue;

    const rEigenvalues = resistanceMatched.map(r => r.eigenvalueModulus);
    const sEigenvalues = sensitivityMatched.map(r => r.eigenvalueModulus);
    const rMean = mean(rEigenvalues);
    const sMean = mean(sEigenvalues);
    const observedDiff = rMean - sMean;

    const combined = [...rEigenvalues, ...sEigenvalues];
    const nR = rEigenvalues.length;
    let countExtreme = 0;
    const nPerm = 2000;

    for (let p = 0; p < nPerm; p++) {
      for (let i = combined.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [combined[i], combined[j]] = [combined[j], combined[i]];
      }
      const shuffRMean = mean(combined.slice(0, nR));
      const shuffSMean = mean(combined.slice(nR));
      if (Math.abs(shuffRMean - shuffSMean) >= Math.abs(observedDiff)) countExtreme++;
    }

    const permP = (countExtreme + 1) / (nPerm + 1);
    const d = cohensD(rEigenvalues, sEigenvalues);

    drugResults.push({
      drug: drugData.drug,
      cancerTypes: drugData.cancerTypes,
      resistanceGenesTotal: drugData.resistanceGenes.length,
      sensitivityGenesTotal: drugData.sensitivityGenes.length,
      resistanceGenesMatched: resistanceMatched.length,
      sensitivityGenesMatched: sensitivityMatched.length,
      resistanceMeanLambda: parseFloat(rMean.toFixed(4)),
      sensitivityMeanLambda: parseFloat(sMean.toFixed(4)),
      genomeMeanLambda: parseFloat(genomeMean.toFixed(4)),
      lambdaDifference: parseFloat(observedDiff.toFixed(4)),
      permutationP: parseFloat(permP.toFixed(4)),
      predictionSupported: observedDiff > 0 && permP < 0.05,
      effectSize: parseFloat(d.toFixed(3)),
    });
  }

  drugResults.sort((a, b) => b.lambdaDifference - a.lambdaDifference);

  const drugsHigher = drugResults.filter(d => d.lambdaDifference > 0).length;
  const drugsLower = drugResults.filter(d => d.lambdaDifference <= 0).length;
  const drugsSupported = drugResults.filter(d => d.predictionSupported).length;
  const drugsMarginal = drugResults.filter(d => d.lambdaDifference > 0 && d.permutationP >= 0.05).length;
  const drugsNotSupported = drugResults.filter(d => d.lambdaDifference <= 0).length;

  const totalMatched = drugResults.reduce((s, d) => s + d.resistanceGenesMatched + d.sensitivityGenesMatched, 0);
  const weightedSum = drugResults.reduce((s, d) => {
    const w = d.resistanceGenesMatched + d.sensitivityGenesMatched;
    return s + d.lambdaDifference * w;
  }, 0);
  const weightedMeanDiff = totalMatched > 0 ? weightedSum / totalMatched : 0;

  const bP = binomialP(drugsHigher, drugResults.length, 0.5);

  const cancerMap = new Map<string, { drugs: DrmrefDrugResult[] }>();
  for (const dr of drugResults) {
    for (const ct of dr.cancerTypes) {
      if (!cancerMap.has(ct)) cancerMap.set(ct, { drugs: [] });
      cancerMap.get(ct)!.drugs.push(dr);
    }
  }
  const cancerTypeSummary = Array.from(cancerMap.entries()).map(([ct, data]) => ({
    cancerType: ct,
    drugsCount: data.drugs.length,
    drugsSupported: data.drugs.filter(d => d.predictionSupported).length,
    meanDifference: parseFloat(mean(data.drugs.map(d => d.lambdaDifference)).toFixed(4)),
  })).sort((a, b) => b.meanDifference - a.meanDifference);

  const overallDirection = drugsHigher > drugsLower
    ? `${drugsHigher}/${drugResults.length} drugs show higher persistence in resistance genes`
    : `${drugsLower}/${drugResults.length} drugs show lower persistence in resistance genes`;

  cachedResult = {
    source: "DRMref (Liu et al., Nucleic Acids Research, 2024)",
    citation: "Liu X et al. DRMref: comprehensive reference map of drug resistance mechanisms in human cancer. NAR 2024;52(D1):D1253-D1264",
    referenceDataset: "GSE11923 (Mouse Liver, 48 timepoints, 1h resolution)",
    totalDrugs: drmref.drugs.length,
    drugsWithSufficientGenes: drugResults.length,
    drugsSupported,
    drugsMarginal,
    drugsNotSupported,
    overallDirection,
    metaAnalysis: {
      weightedMeanDiff: parseFloat(weightedMeanDiff.toFixed(4)),
      drugsHigherResistance: drugsHigher,
      drugsLowerResistance: drugsLower,
      binomialP: parseFloat(bP.toFixed(4)),
    },
    cancerTypeSummary,
    drugs: drugResults,
  };

  return cachedResult;
}
