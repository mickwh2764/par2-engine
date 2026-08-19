import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

const ATP_PRODUCTION_GENES = {
  atp_synthase: ['Atp5a1', 'Atp5b', 'Atp5c1', 'Atp5d', 'Atp5e', 'Atp5f1', 'Atp5g1', 'Atp5g2', 'Atp5g3', 'Atp5h', 'Atp5j', 'Atp5j2', 'Atp5k', 'Atp5l', 'Atp5o'],
  complex_I: ['Ndufa1', 'Ndufa2', 'Ndufa3', 'Ndufa4', 'Ndufa5', 'Ndufa6', 'Ndufa7', 'Ndufa8', 'Ndufa9', 'Ndufa10', 'Ndufb1', 'Ndufb2', 'Ndufb3', 'Ndufb4', 'Ndufb5', 'Ndufb6', 'Ndufb7', 'Ndufb8', 'Ndufb9', 'Ndufb10', 'Ndufs1', 'Ndufs2', 'Ndufs3', 'Ndufs4', 'Ndufs5', 'Ndufs6', 'Ndufs7', 'Ndufs8', 'Ndufv1', 'Ndufv2', 'Ndufv3'],
  complex_III: ['Uqcrc1', 'Uqcrc2', 'Uqcrfs1', 'Uqcrh', 'Uqcrb', 'Uqcrq', 'Uqcr10', 'Uqcr11'],
  complex_IV: ['Cox4i1', 'Cox4i2', 'Cox5a', 'Cox5b', 'Cox6a1', 'Cox6a2', 'Cox6b1', 'Cox6b2', 'Cox6c', 'Cox7a1', 'Cox7a2', 'Cox7b', 'Cox7c', 'Cox8a', 'Cox8b', 'Cox8c'],
  complex_II: ['Sdha', 'Sdhb', 'Sdhc', 'Sdhd'],
  cytochrome_c: ['Cycs'],
  glycolysis: ['Hk1', 'Hk2', 'Hk3', 'Gpi1', 'Pfkl', 'Pfkm', 'Pfkp', 'Aldoa', 'Aldob', 'Aldoc', 'Tpi1', 'Gapdh', 'Pgk1', 'Pgam1', 'Pgam2', 'Eno1', 'Eno2', 'Eno3', 'Pkm', 'Pklr', 'Ldha', 'Ldhb', 'Ldhc']
};

const CLOCK_GENES = ['Arntl', 'Clock', 'Per1', 'Per2', 'Per3', 'Cry1', 'Cry2', 'Nr1d1', 'Nr1d2', 'Dbp', 'Tef', 'Hlf', 'Bhlhe40', 'Bhlhe41', 'Npas2', 'Rora', 'Rorc'];

const TARGET_GENES = ['Myc', 'Ccnd1', 'Lgr5', 'Axin2', 'Ctnnb1', 'Wnt3', 'Tp53', 'Cdkn1a', 'Bcl2', 'Bax', 'Vegfa', 'Hif1a', 'Mtor', 'Akt1', 'Pten', 'Rb1', 'E2f1', 'Cdk4', 'Cdk6'];

interface GeneData {
  gene: string;
  values: number[];
  mean: number;
}

interface AR2Result {
  clockGene: string;
  targetGene: string;
  eigenvalue: number;
  beta1: number;
  beta2: number;
  isStable: boolean;
  residualVariance: number;
}

function computeCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 3) return NaN;
  
  const meanX = x.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const meanY = y.slice(0, n).reduce((a, b) => a + b, 0) / n;
  
  let numerator = 0;
  let denomX = 0;
  let denomY = 0;
  
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }
  
  const denom = Math.sqrt(denomX * denomY);
  return denom > 0 ? numerator / denom : 0;
}

function loadDataset(filePath: string): Map<string, number[]> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const records = parse(content, { columns: true, skip_empty_lines: true }) as Record<string, string>[];
  
  const geneData = new Map<string, number[]>();
  
  for (const record of records) {
    const gene = record.Gene || record.gene || Object.values(record)[0];
    if (!gene) continue;
    
    const values = Object.entries(record)
      .filter(([key]) => key !== 'Gene' && key !== 'gene')
      .map(([, val]) => parseFloat(val))
      .filter(v => !isNaN(v));
    
    if (values.length > 0) {
      geneData.set(gene, values);
    }
  }
  
  return geneData;
}

function computeAR2(targetValues: number[], clockValues: number[]): AR2Result | null {
  const n = Math.min(targetValues.length, clockValues.length);
  if (n < 6) return null;
  
  const Y = targetValues.slice(2, n);
  const Y1 = targetValues.slice(1, n - 1);
  const Y2 = targetValues.slice(0, n - 2);
  const C = clockValues.slice(2, n);
  
  const nObs = Y.length;
  if (nObs < 4) return null;
  
  const meanY = Y.reduce((a, b) => a + b, 0) / nObs;
  const meanY1 = Y1.reduce((a, b) => a + b, 0) / nObs;
  const meanY2 = Y2.reduce((a, b) => a + b, 0) / nObs;
  const meanC = C.reduce((a, b) => a + b, 0) / nObs;
  
  let sumY1Y1 = 0, sumY2Y2 = 0, sumCC = 0;
  let sumY1Y2 = 0, sumY1C = 0, sumY2C = 0;
  let sumYY1 = 0, sumYY2 = 0, sumYC = 0;
  
  for (let i = 0; i < nObs; i++) {
    const y = Y[i] - meanY;
    const y1 = Y1[i] - meanY1;
    const y2 = Y2[i] - meanY2;
    const c = C[i] - meanC;
    
    sumY1Y1 += y1 * y1;
    sumY2Y2 += y2 * y2;
    sumCC += c * c;
    sumY1Y2 += y1 * y2;
    sumY1C += y1 * c;
    sumY2C += y2 * c;
    sumYY1 += y * y1;
    sumYY2 += y * y2;
    sumYC += y * c;
  }
  
  const XtX = [
    [sumY1Y1, sumY1Y2, sumY1C],
    [sumY1Y2, sumY2Y2, sumY2C],
    [sumY1C, sumY2C, sumCC]
  ];
  const XtY = [sumYY1, sumYY2, sumYC];
  
  const det = XtX[0][0] * (XtX[1][1] * XtX[2][2] - XtX[1][2] * XtX[2][1])
            - XtX[0][1] * (XtX[1][0] * XtX[2][2] - XtX[1][2] * XtX[2][0])
            + XtX[0][2] * (XtX[1][0] * XtX[2][1] - XtX[1][1] * XtX[2][0]);
  
  if (Math.abs(det) < 1e-10) return null;
  
  const inv = [
    [(XtX[1][1] * XtX[2][2] - XtX[1][2] * XtX[2][1]) / det,
     (XtX[0][2] * XtX[2][1] - XtX[0][1] * XtX[2][2]) / det,
     (XtX[0][1] * XtX[1][2] - XtX[0][2] * XtX[1][1]) / det],
    [(XtX[1][2] * XtX[2][0] - XtX[1][0] * XtX[2][2]) / det,
     (XtX[0][0] * XtX[2][2] - XtX[0][2] * XtX[2][0]) / det,
     (XtX[0][2] * XtX[1][0] - XtX[0][0] * XtX[1][2]) / det],
    [(XtX[1][0] * XtX[2][1] - XtX[1][1] * XtX[2][0]) / det,
     (XtX[0][1] * XtX[2][0] - XtX[0][0] * XtX[2][1]) / det,
     (XtX[0][0] * XtX[1][1] - XtX[0][1] * XtX[1][0]) / det]
  ];
  
  const beta1 = inv[0][0] * XtY[0] + inv[0][1] * XtY[1] + inv[0][2] * XtY[2];
  const beta2 = inv[1][0] * XtY[0] + inv[1][1] * XtY[1] + inv[1][2] * XtY[2];
  
  const discriminant = beta1 * beta1 + 4 * beta2;
  let eigenvalue: number;
  
  if (discriminant < 0) {
    eigenvalue = Math.sqrt(-beta2);
  } else {
    const lambda1 = (beta1 + Math.sqrt(discriminant)) / 2;
    const lambda2 = (beta1 - Math.sqrt(discriminant)) / 2;
    eigenvalue = Math.max(Math.abs(lambda1), Math.abs(lambda2));
  }
  
  let rss = 0;
  for (let i = 0; i < nObs; i++) {
    const predicted = meanY + beta1 * (Y1[i] - meanY1) + beta2 * (Y2[i] - meanY2);
    rss += (Y[i] - predicted) ** 2;
  }
  const residualVariance = rss / (nObs - 3);
  
  return {
    clockGene: '',
    targetGene: '',
    eigenvalue,
    beta1,
    beta2,
    isStable: eigenvalue < 1.0 && eigenvalue > 0,
    residualVariance
  };
}

export interface SymmetryDebtResult {
  clockGene: string;
  targetGene: string;
  eigenvalue: number;
  atpScore: number;
  inStableBand: boolean;
  beta1: number;
  beta2: number;
}

export interface SymmetryDebtAnalysis {
  correlationCoefficient: number;
  pValue: number;
  interpretation: string;
  hypothesis: string;
  results: SymmetryDebtResult[];
  atpGeneStats: {
    genesFound: number;
    genesMissing: number;
    meanExpression: number;
    categories: { [key: string]: { found: number; total: number } };
  };
  stableBandStats: {
    inBand: number;
    outsideBand: number;
    meanEigenInBand: number;
    meanEigenOutsideBand: number;
    meanAtpInBand: number;
    meanAtpOutsideBand: number;
  };
}

export function runSymmetryDebtAnalysis(datasetPath: string): SymmetryDebtAnalysis {
  const geneData = loadDataset(datasetPath);
  
  const allAtpGenes = Object.values(ATP_PRODUCTION_GENES).flat();
  const atpGenesFound: string[] = [];
  const atpGenesMissing: string[] = [];
  
  for (const gene of allAtpGenes) {
    if (geneData.has(gene)) {
      atpGenesFound.push(gene);
    } else {
      atpGenesMissing.push(gene);
    }
  }
  
  const categoryStats: { [key: string]: { found: number; total: number } } = {};
  for (const [category, genes] of Object.entries(ATP_PRODUCTION_GENES)) {
    const found = genes.filter(g => geneData.has(g)).length;
    categoryStats[category] = { found, total: genes.length };
  }
  
  let totalAtpExpression = 0;
  let atpCount = 0;
  for (const gene of atpGenesFound) {
    const values = geneData.get(gene)!;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    totalAtpExpression += mean;
    atpCount++;
  }
  const meanAtpExpression = atpCount > 0 ? totalAtpExpression / atpCount : 0;
  
  const results: SymmetryDebtResult[] = [];
  
  for (const clockGene of CLOCK_GENES) {
    if (!geneData.has(clockGene)) continue;
    const clockValues = geneData.get(clockGene)!;
    
    for (const targetGene of TARGET_GENES) {
      if (!geneData.has(targetGene)) continue;
      const targetValues = geneData.get(targetGene)!;
      
      const ar2 = computeAR2(targetValues, clockValues);
      if (!ar2 || !isFinite(ar2.eigenvalue) || isNaN(ar2.eigenvalue)) continue;
      
      let atpScore = 0;
      let atpN = 0;
      for (const atpGene of atpGenesFound) {
        const atpValues = geneData.get(atpGene)!;
        const corr = computeCorrelation(targetValues, atpValues);
        if (!isNaN(corr)) {
          atpScore += Math.abs(corr);
          atpN++;
        }
      }
      atpScore = atpN > 0 ? atpScore / atpN : 0;
      
      // Updated: Real data range from Jan 2026 audit (Target=0.537, Clock=0.689)
      const inStableBand = ar2.eigenvalue >= 0.40 && ar2.eigenvalue <= 0.80;
      
      results.push({
        clockGene,
        targetGene,
        eigenvalue: ar2.eigenvalue,
        atpScore,
        inStableBand,
        beta1: ar2.beta1,
        beta2: ar2.beta2
      });
    }
  }
  
  const eigenvalues = results.map(r => r.eigenvalue);
  const atpScores = results.map(r => r.atpScore);
  
  let correlation = 0;
  let pValue = 1;
  
  if (eigenvalues.length >= 3) {
    const meanEigen = eigenvalues.reduce((a, b) => a + b, 0) / eigenvalues.length;
    const meanAtp = atpScores.reduce((a, b) => a + b, 0) / atpScores.length;
    
    let numerator = 0;
    let denomEigen = 0;
    let denomAtp = 0;
    
    for (let i = 0; i < eigenvalues.length; i++) {
      const dEigen = eigenvalues[i] - meanEigen;
      const dAtp = atpScores[i] - meanAtp;
      numerator += dEigen * dAtp;
      denomEigen += dEigen * dEigen;
      denomAtp += dAtp * dAtp;
    }
    
    const denom = Math.sqrt(denomEigen * denomAtp);
    if (denom > 0) {
      correlation = numerator / denom;
      
      const n = eigenvalues.length;
      if (n > 2 && Math.abs(correlation) < 1) {
        const t = correlation * Math.sqrt((n - 2) / (1 - correlation * correlation));
        const absT = Math.abs(t);
        pValue = 2 * (1 - 0.5 * (1 + Math.tanh(absT * 0.7978845608)));
      }
    }
  }
  
  const inBand = results.filter(r => r.inStableBand);
  const outsideBand = results.filter(r => !r.inStableBand);
  
  const meanEigenInBand = inBand.length > 0 
    ? inBand.reduce((a, r) => a + r.eigenvalue, 0) / inBand.length : 0;
  const meanEigenOutsideBand = outsideBand.length > 0 
    ? outsideBand.reduce((a, r) => a + r.eigenvalue, 0) / outsideBand.length : 0;
  const meanAtpInBand = inBand.length > 0 
    ? inBand.reduce((a, r) => a + r.atpScore, 0) / inBand.length : 0;
  const meanAtpOutsideBand = outsideBand.length > 0 
    ? outsideBand.reduce((a, r) => a + r.atpScore, 0) / outsideBand.length : 0;
  
  let interpretation: string;
  if (correlation < -0.15 && pValue < 0.05) {
    interpretation = 'SYMMETRY DEBT SUPPORTED: Higher stability (lower |λ|) correlates with higher ATP-target coupling. Maintaining circadian stability appears to require metabolic coordination.';
  } else if (correlation > 0.15 && pValue < 0.05) {
    interpretation = 'METABOLIC STRESS HYPOTHESIS: Higher |λ| (less stable, drifting toward instability) correlates with stronger ATP-target coupling. This suggests UNSTABLE pairs are under metabolic stress, while STABLE pairs run "cheaply" without intensive ATP coordination. The Symmetry Debt hypothesis is NOT supported - stability appears to be the low-energy state.';
  } else if (pValue < 0.05) {
    interpretation = `WEAK CORRELATION: Statistically significant (p=${pValue.toFixed(4)}) but effect size small (r=${correlation.toFixed(3)}). Biological significance uncertain.`;
  } else {
    interpretation = 'NO SIGNIFICANT RELATIONSHIP: Eigenvalue stability does not significantly correlate with ATP-target coupling in this dataset.';
  }
  
  return {
    correlationCoefficient: correlation,
    pValue,
    interpretation,
    hypothesis: 'Symmetry Debt Theory: Maintaining eigenvalue stability near target gene baseline (|λ|≈0.537, from Jan 2026 audit) requires energy expenditure (ATP). As cells age or become stressed, they accumulate "symmetry debt" - the metabolic cost of keeping the circadian clock stable.',
    results,
    atpGeneStats: {
      genesFound: atpGenesFound.length,
      genesMissing: atpGenesMissing.length,
      meanExpression: meanAtpExpression,
      categories: categoryStats
    },
    stableBandStats: {
      inBand: inBand.length,
      outsideBand: outsideBand.length,
      meanEigenInBand,
      meanEigenOutsideBand,
      meanAtpInBand,
      meanAtpOutsideBand
    }
  };
}

export async function runCLI() {
  const datasetPath = process.argv[2] || 'datasets/GSE11923_Liver_1h_48h_genes.csv';
  console.log(`Running Symmetry Debt Analysis on: ${datasetPath}\n`);
  
  const result = runSymmetryDebtAnalysis(datasetPath);
  
  console.log('=== SYMMETRY DEBT ANALYSIS ===\n');
  console.log(`Hypothesis: ${result.hypothesis}\n`);
  console.log(`ATP Genes Found: ${result.atpGeneStats.genesFound}/${result.atpGeneStats.genesFound + result.atpGeneStats.genesMissing}`);
  console.log(`Mean ATP Expression: ${result.atpGeneStats.meanExpression.toFixed(2)}\n`);
  
  console.log('Category Coverage:');
  for (const [cat, stats] of Object.entries(result.atpGeneStats.categories)) {
    console.log(`  ${cat}: ${stats.found}/${stats.total}`);
  }
  
  console.log(`\nClock-Target Pairs Analyzed: ${result.results.length}`);
  console.log(`  In Target-Clock Range (0.40-0.80): ${result.stableBandStats.inBand}`);
  console.log(`  Outside Range: ${result.stableBandStats.outsideBand}`);
  
  console.log(`\nCorrelation (|λ| vs ATP): r = ${result.correlationCoefficient.toFixed(4)}`);
  console.log(`P-value: ${result.pValue.toFixed(6)}`);
  console.log(`\nInterpretation: ${result.interpretation}`);
  
  if (result.stableBandStats.inBand > 0 && result.stableBandStats.outsideBand > 0) {
    console.log(`\nStable Band Comparison:`);
    console.log(`  In-Band: mean |λ| = ${result.stableBandStats.meanEigenInBand.toFixed(3)}, mean ATP = ${result.stableBandStats.meanAtpInBand.toFixed(2)}`);
    console.log(`  Outside:  mean |λ| = ${result.stableBandStats.meanEigenOutsideBand.toFixed(3)}, mean ATP = ${result.stableBandStats.meanAtpOutsideBand.toFixed(2)}`);
  }
}

// CLI entry point - only runs when this specific file is executed directly
// To run: npx tsx server/symmetry-debt.ts [dataset_path]
// Guards against bundled CJS where require.main === module is always true
const isDirectCLI = typeof require !== 'undefined' 
  && require.main === module 
  && process.argv[1]?.includes('symmetry-debt');
if (isDirectCLI) {
  runCLI();
}
