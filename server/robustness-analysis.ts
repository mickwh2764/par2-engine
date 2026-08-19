import * as fs from 'fs';
import * as path from 'path';

interface AR2Result {
  gene: string;
  eigenvalue: number;
  beta1: number;
  beta2: number;
  r2: number;
}

interface RobustnessResult {
  gene: string;
  type: 'CLOCK' | 'TARGET';
  fullEigenvalue: number;
  subsampledEigenvalue: number;
  bootstrapMean: number;
  bootstrapStd: number;
  bootstrapCI95Low: number;
  bootstrapCI95High: number;
  cosinorAmplitude: number;
  cosinorPhase: number;
  cosinorR2: number;
}

function computeAR2(timeSeries: number[]): { eigenvalue: number; beta1: number; beta2: number; r2: number } {
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
    return { eigenvalue: 0, beta1: 0, beta2: 0, r2: 0 };
  }
  
  const beta1 = (sumX2X2 * sumYX1 - sumX1X2 * sumYX2) / det;
  const beta2 = (sumX1X1 * sumYX2 - sumX1X2 * sumYX1) / det;
  
  const discriminant = beta1 * beta1 + 4 * beta2;
  let eigenvalue: number;
  
  if (discriminant >= 0) {
    const lambda1 = (beta1 + Math.sqrt(discriminant)) / 2;
    const lambda2 = (beta1 - Math.sqrt(discriminant)) / 2;
    eigenvalue = Math.max(Math.abs(lambda1), Math.abs(lambda2));
  } else {
    eigenvalue = Math.sqrt(-beta2);
  }
  
  // Calculate R²
  const predictions: number[] = [];
  for (let i = 2; i < centered.length; i++) {
    predictions.push(beta1 * centered[i - 1] + beta2 * centered[i - 2]);
  }
  
  const ssRes = Y.reduce((sum, y, i) => sum + Math.pow(y - predictions[i], 2), 0);
  const yMean = Y.reduce((a, b) => a + b, 0) / Y.length;
  const ssTot = Y.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0);
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  
  return { eigenvalue, beta1, beta2, r2 };
}

function cosinorFit(timeSeries: number[], period: number = 24): { amplitude: number; phase: number; r2: number } {
  const n = timeSeries.length;
  const times = Array.from({ length: n }, (_, i) => i * 2); // Assuming 2-hour sampling
  
  const omega = 2 * Math.PI / period;
  
  // Design matrix: [1, cos(ωt), sin(ωt)]
  const X: number[][] = times.map(t => [1, Math.cos(omega * t), Math.sin(omega * t)]);
  const Y = timeSeries;
  
  // Solve via normal equations: (X'X)^-1 X'Y
  const XtX = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0]
  ];
  const XtY = [0, 0, 0];
  
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < 3; j++) {
      XtY[j] += X[i][j] * Y[i];
      for (let k = 0; k < 3; k++) {
        XtX[j][k] += X[i][j] * X[i][k];
      }
    }
  }
  
  // 3x3 matrix inverse (simplified)
  const det = XtX[0][0] * (XtX[1][1] * XtX[2][2] - XtX[1][2] * XtX[2][1])
            - XtX[0][1] * (XtX[1][0] * XtX[2][2] - XtX[1][2] * XtX[2][0])
            + XtX[0][2] * (XtX[1][0] * XtX[2][1] - XtX[1][1] * XtX[2][0]);
  
  if (Math.abs(det) < 1e-10) {
    return { amplitude: 0, phase: 0, r2: 0 };
  }
  
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
  
  const beta = [
    inv[0][0] * XtY[0] + inv[0][1] * XtY[1] + inv[0][2] * XtY[2],
    inv[1][0] * XtY[0] + inv[1][1] * XtY[1] + inv[1][2] * XtY[2],
    inv[2][0] * XtY[0] + inv[2][1] * XtY[1] + inv[2][2] * XtY[2]
  ];
  
  const amplitude = Math.sqrt(beta[1] * beta[1] + beta[2] * beta[2]);
  const phase = Math.atan2(-beta[2], beta[1]) * 12 / Math.PI; // Convert to hours
  
  // Calculate R²
  const predictions = times.map((t, i) => beta[0] + beta[1] * Math.cos(omega * t) + beta[2] * Math.sin(omega * t));
  const ssRes = Y.reduce((sum, y, i) => sum + Math.pow(y - predictions[i], 2), 0);
  const yMean = Y.reduce((a, b) => a + b, 0) / n;
  const ssTot = Y.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0);
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  
  return { amplitude, phase: phase < 0 ? phase + 24 : phase, r2 };
}

function bootstrapAR2(timeSeries: number[], nBootstrap: number = 100): { mean: number; std: number; ci95Low: number; ci95High: number } {
  const eigenvalues: number[] = [];
  const n = timeSeries.length;
  
  for (let b = 0; b < nBootstrap; b++) {
    // Block bootstrap (blocks of 3 to preserve autocorrelation)
    const blockSize = 3;
    const nBlocks = Math.ceil(n / blockSize);
    const resampledIndices: number[] = [];
    
    for (let i = 0; i < nBlocks; i++) {
      const startIdx = Math.floor(Math.random() * (n - blockSize + 1));
      for (let j = 0; j < blockSize && resampledIndices.length < n; j++) {
        resampledIndices.push(startIdx + j);
      }
    }
    
    const resampled = resampledIndices.slice(0, n).map(i => timeSeries[i]);
    const result = computeAR2(resampled);
    if (result.eigenvalue > 0 && result.eigenvalue < 2) {
      eigenvalues.push(result.eigenvalue);
    }
  }
  
  if (eigenvalues.length < 10) {
    return { mean: 0, std: 0, ci95Low: 0, ci95High: 0 };
  }
  
  eigenvalues.sort((a, b) => a - b);
  const mean = eigenvalues.reduce((a, b) => a + b, 0) / eigenvalues.length;
  const variance = eigenvalues.reduce((sum, e) => sum + Math.pow(e - mean, 2), 0) / eigenvalues.length;
  const std = Math.sqrt(variance);
  
  const ci95Low = eigenvalues[Math.floor(eigenvalues.length * 0.025)];
  const ci95High = eigenvalues[Math.floor(eigenvalues.length * 0.975)];
  
  return { mean, std, ci95Low, ci95High };
}

function subsampleAR2(timeSeries: number[]): number {
  // Drop every other timepoint (simulating 4h instead of 2h sampling)
  const subsampled = timeSeries.filter((_, i) => i % 2 === 0);
  if (subsampled.length < 6) return 0;
  return computeAR2(subsampled).eigenvalue;
}

export async function runRobustnessAnalysis(): Promise<{
  results: RobustnessResult[];
  summary: {
    clockTargetGapFull: number;
    clockTargetGapSubsampled: number;
    clockTargetGapPreserved: boolean;
    meanBootstrapCI: number;
    cosinorClockMeanR2: number;
    cosinorTargetMeanR2: number;
    ar2VsCosinorComparison: string;
  };
}> {
  const clockGenes = ['Per1', 'Per2', 'Per3', 'Cry1', 'Cry2', 'Clock', 'Arntl', 'Nr1d1', 'Nr1d2', 'Dbp', 'Tef', 'Npas2', 'Rorc'];
  const targetGenes = ['Myc', 'Ccnd1', 'Ccnb1', 'Cdk1', 'Wee1', 'Cdkn1a', 'Lgr5', 'Axin2', 'Ctnnb1', 'Apc', 'Tp53', 'Mdm2', 'Atm', 'Chek2', 'Bcl2', 'Bax', 'Pparg', 'Sirt1', 'Hif1a', 'Ccne1', 'Ccne2', 'Mcm6', 'Mki67'];
  
  // Load GSE54650 Liver data
  const dataPath = path.join(process.cwd(), 'datasets', 'GSE54650_Liver_circadian.csv');
  if (!fs.existsSync(dataPath)) {
    throw new Error('GSE54650_Liver_circadian.csv not found');
  }
  
  const content = fs.readFileSync(dataPath, 'utf-8');
  const lines = content.trim().split('\n');
  const header = lines[0].split(',');
  
  const geneData: Map<string, number[]> = new Map();
  
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    const geneName = parts[0].replace(/"/g, '');
    const values = parts.slice(1).map(v => parseFloat(v));
    if (values.every(v => !isNaN(v))) {
      geneData.set(geneName, values);
    }
  }
  
  const results: RobustnessResult[] = [];
  
  const allGenes = [...clockGenes, ...targetGenes];
  for (const gene of allGenes) {
    const timeSeries = geneData.get(gene);
    if (!timeSeries || timeSeries.length < 6) continue;
    
    const type = clockGenes.includes(gene) ? 'CLOCK' : 'TARGET';
    
    // Full AR(2)
    const fullResult = computeAR2(timeSeries);
    
    // Subsampled AR(2)
    const subsampledEigenvalue = subsampleAR2(timeSeries);
    
    // Bootstrap
    const bootstrap = bootstrapAR2(timeSeries, 100);
    
    // Cosinor
    const cosinor = cosinorFit(timeSeries, 24);
    
    results.push({
      gene,
      type,
      fullEigenvalue: fullResult.eigenvalue,
      subsampledEigenvalue,
      bootstrapMean: bootstrap.mean,
      bootstrapStd: bootstrap.std,
      bootstrapCI95Low: bootstrap.ci95Low,
      bootstrapCI95High: bootstrap.ci95High,
      cosinorAmplitude: cosinor.amplitude,
      cosinorPhase: cosinor.phase,
      cosinorR2: cosinor.r2
    });
  }
  
  // Calculate summary statistics
  const clockResults = results.filter(r => r.type === 'CLOCK');
  const targetResults = results.filter(r => r.type === 'TARGET');
  
  const clockMeanFull = clockResults.reduce((sum, r) => sum + r.fullEigenvalue, 0) / clockResults.length;
  const targetMeanFull = targetResults.reduce((sum, r) => sum + r.fullEigenvalue, 0) / targetResults.length;
  const clockMeanSubsampled = clockResults.reduce((sum, r) => sum + r.subsampledEigenvalue, 0) / clockResults.length;
  const targetMeanSubsampled = targetResults.reduce((sum, r) => sum + r.subsampledEigenvalue, 0) / targetResults.length;
  
  const clockTargetGapFull = clockMeanFull - targetMeanFull;
  const clockTargetGapSubsampled = clockMeanSubsampled - targetMeanSubsampled;
  
  const meanBootstrapCI = results.reduce((sum, r) => sum + (r.bootstrapCI95High - r.bootstrapCI95Low), 0) / results.length;
  
  const cosinorClockMeanR2 = clockResults.reduce((sum, r) => sum + r.cosinorR2, 0) / clockResults.length;
  const cosinorTargetMeanR2 = targetResults.reduce((sum, r) => sum + r.cosinorR2, 0) / targetResults.length;
  
  // Compare AR(2) vs Cosinor: does AR(2) detect clock>target that cosinor misses?
  let ar2VsCosinorComparison = '';
  if (clockTargetGapFull > 0.1 && Math.abs(cosinorClockMeanR2 - cosinorTargetMeanR2) < 0.1) {
    ar2VsCosinorComparison = 'AR(2) detects clock-target separation that Cosinor R² does not distinguish';
  } else if (clockTargetGapFull > 0.1 && cosinorClockMeanR2 > cosinorTargetMeanR2 + 0.1) {
    ar2VsCosinorComparison = 'Both AR(2) and Cosinor detect clock-target separation (complementary)';
  } else {
    ar2VsCosinorComparison = 'AR(2) and Cosinor provide similar discrimination';
  }
  
  return {
    results,
    summary: {
      clockTargetGapFull,
      clockTargetGapSubsampled,
      clockTargetGapPreserved: Math.sign(clockTargetGapFull) === Math.sign(clockTargetGapSubsampled) && 
                               Math.abs(clockTargetGapSubsampled) > 0.05,
      meanBootstrapCI,
      cosinorClockMeanR2,
      cosinorTargetMeanR2,
      ar2VsCosinorComparison
    }
  };
}
