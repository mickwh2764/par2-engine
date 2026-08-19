/**
 * Truth Audit: Systematic AR(2) Eigenvalue Analysis
 * 
 * This script calculates REAL eigenvalue distributions across all datasets
 * to replace fabricated constants with actual measurements.
 */

import * as fs from 'fs';
import * as path from 'path';

const CLOCK_GENES = ['Per1', 'Per2', 'Per3', 'Cry1', 'Cry2', 'Clock', 'Arntl', 'Nr1d1', 'Nr1d2', 'Dbp', 'Tef', 'Npas2', 'Rorc'];
const TARGET_GENES = ['Myc', 'Ccnd1', 'Ccnb1', 'Cdk1', 'Wee1', 'Cdkn1a', 'Lgr5', 'Axin2', 'Ctnnb1', 'Apc', 'Tp53', 'Mdm2', 'Atm', 'Chek2', 'Bcl2', 'Bax', 'Pparg', 'Sirt1', 'Hif1a', 'Ccne1', 'Ccne2', 'Mcm6', 'Mki67'];

interface AR2Result {
  gene: string;
  phi1: number;
  phi2: number;
  eigenvalue: number;
  isComplex: boolean;
  isStable: boolean;
}

interface DatasetAudit {
  datasetId: string;
  tissue: string;
  condition: string;
  clockGenes: AR2Result[];
  targetGenes: AR2Result[];
  clockMean: number;
  targetMean: number;
  gearboxGap: number;
}

function fitAR2(series: number[]): { phi1: number; phi2: number; eigenvalue: number; isComplex: boolean; isStable: boolean } {
  const n = series.length;
  if (n < 5) return { phi1: 0, phi2: 0, eigenvalue: 0, isComplex: false, isStable: true };
  
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
  if (Math.abs(denom) < 1e-10) return { phi1: 0, phi2: 0, eigenvalue: 0, isComplex: false, isStable: true };
  
  const phi1 = (sumYY1 * sumY2Y2 - sumYY2 * sumY1Y2) / denom;
  const phi2 = (sumYY2 * sumY1Y1 - sumYY1 * sumY1Y2) / denom;
  
  const discriminant = phi1 * phi1 + 4 * phi2;
  const isComplex = discriminant < 0;
  
  let eigenvalue: number;
  if (isComplex) {
    eigenvalue = Math.sqrt(-phi2);
  } else {
    const r1 = (phi1 + Math.sqrt(discriminant)) / 2;
    const r2 = (phi1 - Math.sqrt(discriminant)) / 2;
    eigenvalue = Math.max(Math.abs(r1), Math.abs(r2));
  }
  
  const isStable = eigenvalue < 1 && (1 - phi2 > 0) && (1 + phi1 - phi2 > 0) && (1 - phi1 - phi2 > 0);
  
  return { phi1, phi2, eigenvalue, isComplex, isStable };
}

function parseCSV(content: string): { headers: string[]; rows: Map<string, number[]> } {
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const rows = new Map<string, number[]>();
  
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const geneName = cols[0].trim().replace(/"/g, '');
    const values = cols.slice(1).map(v => parseFloat(v)).filter(v => !isNaN(v));
    if (values.length >= 5) {
      rows.set(geneName, values);
    }
  }
  
  return { headers, rows };
}

function analyzeDataset(filePath: string, datasetId: string): DatasetAudit | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const { rows } = parseCSV(content);
    
    const clockResults: AR2Result[] = [];
    const targetResults: AR2Result[] = [];
    
    for (const gene of CLOCK_GENES) {
      const variants = [gene, gene.toLowerCase(), gene.toUpperCase()];
      for (const variant of variants) {
        if (rows.has(variant)) {
          const series = rows.get(variant)!;
          const result = fitAR2(series);
          if (result.eigenvalue > 0 && result.eigenvalue < 2) {
            clockResults.push({ gene, ...result });
          }
          break;
        }
      }
    }
    
    for (const gene of TARGET_GENES) {
      const variants = [gene, gene.toLowerCase(), gene.toUpperCase()];
      for (const variant of variants) {
        if (rows.has(variant)) {
          const series = rows.get(variant)!;
          const result = fitAR2(series);
          if (result.eigenvalue > 0 && result.eigenvalue < 2) {
            targetResults.push({ gene, ...result });
          }
          break;
        }
      }
    }
    
    const clockEigenvalues = clockResults.map(r => r.eigenvalue);
    const targetEigenvalues = targetResults.map(r => r.eigenvalue);
    
    const clockMean = clockEigenvalues.length > 0 
      ? clockEigenvalues.reduce((a, b) => a + b, 0) / clockEigenvalues.length 
      : NaN;
    const targetMean = targetEigenvalues.length > 0 
      ? targetEigenvalues.reduce((a, b) => a + b, 0) / targetEigenvalues.length 
      : NaN;
    
    let tissue = 'Unknown';
    let condition = 'Unknown';
    
    if (datasetId.includes('Liver')) tissue = 'Liver';
    else if (datasetId.includes('Kidney')) tissue = 'Kidney';
    else if (datasetId.includes('Heart')) tissue = 'Heart';
    else if (datasetId.includes('Blood')) tissue = 'Blood';
    else if (datasetId.includes('Organoid')) tissue = 'Organoid';
    else if (datasetId.includes('Neuroblastoma')) tissue = 'Neuroblastoma';
    else if (datasetId.includes('Lung')) tissue = 'Lung';
    else if (datasetId.includes('Arabidopsis')) tissue = 'Plant';
    
    if (datasetId.includes('WT') || datasetId.includes('Healthy') || datasetId.includes('Young')) {
      condition = 'Healthy/WT';
    } else if (datasetId.includes('MYC_ON') || datasetId.includes('ApcKO') || datasetId.includes('Mut')) {
      condition = 'Disease/Mutant';
    } else if (datasetId.includes('MYC_OFF') || datasetId.includes('BmalKO')) {
      condition = 'KO/Control';
    }
    
    return {
      datasetId,
      tissue,
      condition,
      clockGenes: clockResults,
      targetGenes: targetResults,
      clockMean,
      targetMean,
      gearboxGap: clockMean - targetMean
    };
  } catch (error) {
    return null;
  }
}

export function runTruthAudit(): {
  datasets: DatasetAudit[];
  summary: {
    totalDatasets: number;
    datasetsWithData: number;
    overallClockMean: number;
    overallClockStd: number;
    overallClockRange: { min: number; max: number };
    overallTargetMean: number;
    overallTargetStd: number;
    overallTargetRange: { min: number; max: number };
    gearboxGapMean: number;
    gearboxValidated: boolean;
  };
  byTissue: Map<string, { clockMean: number; targetMean: number; n: number }>;
  byCondition: Map<string, { clockMean: number; targetMean: number; n: number }>;
} {
  const datasetsDir = path.join(process.cwd(), 'datasets');
  const files = fs.readdirSync(datasetsDir).filter(f => f.endsWith('.csv'));
  
  const audits: DatasetAudit[] = [];
  const allClockEigenvalues: number[] = [];
  const allTargetEigenvalues: number[] = [];
  
  for (const file of files) {
    const datasetId = file.replace('.csv', '');
    const audit = analyzeDataset(path.join(datasetsDir, file), datasetId);
    if (audit && (audit.clockGenes.length > 0 || audit.targetGenes.length > 0)) {
      audits.push(audit);
      audit.clockGenes.forEach(r => allClockEigenvalues.push(r.eigenvalue));
      audit.targetGenes.forEach(r => allTargetEigenvalues.push(r.eigenvalue));
    }
  }
  
  const mean = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : NaN;
  const std = (arr: number[]) => {
    if (arr.length < 2) return NaN;
    const m = mean(arr);
    return Math.sqrt(arr.reduce((sum, x) => sum + (x - m) ** 2, 0) / (arr.length - 1));
  };
  
  const byTissue = new Map<string, { clockMean: number; targetMean: number; n: number }>();
  const byCondition = new Map<string, { clockMean: number; targetMean: number; n: number }>();
  
  for (const audit of audits) {
    if (!isNaN(audit.clockMean) || !isNaN(audit.targetMean)) {
      const tissueKey = audit.tissue;
      const condKey = audit.condition;
      
      if (!byTissue.has(tissueKey)) {
        byTissue.set(tissueKey, { clockMean: 0, targetMean: 0, n: 0 });
      }
      if (!byCondition.has(condKey)) {
        byCondition.set(condKey, { clockMean: 0, targetMean: 0, n: 0 });
      }
      
      const tissueData = byTissue.get(tissueKey)!;
      const condData = byCondition.get(condKey)!;
      
      if (!isNaN(audit.clockMean)) {
        tissueData.clockMean = (tissueData.clockMean * tissueData.n + audit.clockMean) / (tissueData.n + 1);
        condData.clockMean = (condData.clockMean * condData.n + audit.clockMean) / (condData.n + 1);
      }
      if (!isNaN(audit.targetMean)) {
        tissueData.targetMean = (tissueData.targetMean * tissueData.n + audit.targetMean) / (tissueData.n + 1);
        condData.targetMean = (condData.targetMean * condData.n + audit.targetMean) / (condData.n + 1);
      }
      tissueData.n++;
      condData.n++;
    }
  }
  
  const overallClockMean = mean(allClockEigenvalues);
  const overallTargetMean = mean(allTargetEigenvalues);
  const gearboxGapMean = overallClockMean - overallTargetMean;
  
  return {
    datasets: audits,
    summary: {
      totalDatasets: files.length,
      datasetsWithData: audits.length,
      overallClockMean,
      overallClockStd: std(allClockEigenvalues),
      overallClockRange: { 
        min: allClockEigenvalues.length > 0 ? Math.min(...allClockEigenvalues) : NaN,
        max: allClockEigenvalues.length > 0 ? Math.max(...allClockEigenvalues) : NaN
      },
      overallTargetMean,
      overallTargetStd: std(allTargetEigenvalues),
      overallTargetRange: {
        min: allTargetEigenvalues.length > 0 ? Math.min(...allTargetEigenvalues) : NaN,
        max: allTargetEigenvalues.length > 0 ? Math.max(...allTargetEigenvalues) : NaN
      },
      gearboxGapMean,
      gearboxValidated: gearboxGapMean > 0.1
    },
    byTissue,
    byCondition
  };
}

const result = runTruthAudit();
  console.log('\n========== TRUTH AUDIT RESULTS ==========\n');
  console.log(`Datasets analyzed: ${result.summary.datasetsWithData} / ${result.summary.totalDatasets}`);
  console.log('\n--- CLOCK GENES ---');
  console.log(`Mean eigenvalue: ${result.summary.overallClockMean.toFixed(3)}`);
  console.log(`Std deviation: ${result.summary.overallClockStd.toFixed(3)}`);
  console.log(`Range: ${result.summary.overallClockRange.min.toFixed(3)} - ${result.summary.overallClockRange.max.toFixed(3)}`);
  console.log('\n--- TARGET GENES ---');
  console.log(`Mean eigenvalue: ${result.summary.overallTargetMean.toFixed(3)}`);
  console.log(`Std deviation: ${result.summary.overallTargetStd.toFixed(3)}`);
  console.log(`Range: ${result.summary.overallTargetRange.min.toFixed(3)} - ${result.summary.overallTargetRange.max.toFixed(3)}`);
  console.log('\n--- GEARBOX VALIDATION ---');
  console.log(`Gap (Clock - Target): ${result.summary.gearboxGapMean.toFixed(3)}`);
  console.log(`Gearbox pattern validated: ${result.summary.gearboxValidated ? 'YES' : 'NO'}`);
  console.log('\n--- BY TISSUE ---');
  result.byTissue.forEach((data, tissue) => {
    console.log(`${tissue}: Clock=${data.clockMean.toFixed(3)}, Target=${data.targetMean.toFixed(3)}, n=${data.n}`);
  });
  console.log('\n--- BY CONDITION ---');
  result.byCondition.forEach((data, cond) => {
    console.log(`${cond}: Clock=${data.clockMean.toFixed(3)}, Target=${data.targetMean.toFixed(3)}, n=${data.n}`);
  });
