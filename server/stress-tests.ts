import * as fs from 'fs';
import * as path from 'path';

interface ARFitResult {
  gene: string;
  type: string;
  beta1: number;
  beta2: number;
  eigenvalue: number;
  residuals: number[];
  rSquared: number;
}

interface LjungBoxResult {
  gene: string;
  type: string;
  eigenvalue: number;
  ljungBoxStat: number;
  pValue: number;
  isWellSpecified: boolean;
}

interface ModelComparisonResult {
  gene: string;
  type: string;
  ar1: { aic: number; bic: number; eigenvalue: number };
  ar2: { aic: number; bic: number; eigenvalue: number };
  ar3: { aic: number; bic: number; eigenvalue: number };
  preferredModel: 'AR(1)' | 'AR(2)' | 'AR(3)';
  preferredByAIC: 'AR(1)' | 'AR(2)' | 'AR(3)';
  preferredByBIC: 'AR(1)' | 'AR(2)' | 'AR(3)';
}

interface SimulationResult {
  trueEigenvalue: number;
  estimatedMean: number;
  estimatedStd: number;
  bias: number;
  rmse: number;
  n: number;
  nSimulations: number;
}

interface AlternativeMetricsResult {
  gene: string;
  type: string;
  ar2Eigenvalue: number;
  ar1Autocorr: number;
  sumArCoeffs: number;
  spectralDensityPeak: number;
}

function fitAR2WithResiduals(timeSeries: number[]): { beta1: number; beta2: number; eigenvalue: number; residuals: number[]; rSquared: number } {
  const n = timeSeries.length;
  if (n < 5) {
    return { beta1: 0, beta2: 0, eigenvalue: 0, residuals: [], rSquared: 0 };
  }

  const mean = timeSeries.reduce((a, b) => a + b, 0) / n;
  const centered = timeSeries.map(v => v - mean);

  const Y: number[] = [];
  const X1: number[] = [];
  const X2: number[] = [];

  for (let t = 2; t < n; t++) {
    Y.push(centered[t]);
    X1.push(centered[t - 1]);
    X2.push(centered[t - 2]);
  }

  const m = Y.length;
  let sumX1X1 = 0, sumX1X2 = 0, sumX2X2 = 0;
  let sumX1Y = 0, sumX2Y = 0;

  for (let i = 0; i < m; i++) {
    sumX1X1 += X1[i] * X1[i];
    sumX1X2 += X1[i] * X2[i];
    sumX2X2 += X2[i] * X2[i];
    sumX1Y += X1[i] * Y[i];
    sumX2Y += X2[i] * Y[i];
  }

  const det = sumX1X1 * sumX2X2 - sumX1X2 * sumX1X2;
  if (Math.abs(det) < 1e-10) {
    return { beta1: 0, beta2: 0, eigenvalue: 0, residuals: [], rSquared: 0 };
  }

  const beta1 = (sumX2X2 * sumX1Y - sumX1X2 * sumX2Y) / det;
  const beta2 = (sumX1X1 * sumX2Y - sumX1X2 * sumX1Y) / det;

  const residuals: number[] = [];
  let ssRes = 0;
  let ssTot = 0;
  const yMean = Y.reduce((a, b) => a + b, 0) / m;

  for (let i = 0; i < m; i++) {
    const predicted = beta1 * X1[i] + beta2 * X2[i];
    const resid = Y[i] - predicted;
    residuals.push(resid);
    ssRes += resid * resid;
    ssTot += (Y[i] - yMean) * (Y[i] - yMean);
  }

  const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  const discriminant = beta1 * beta1 + 4 * beta2;
  let eigenvalue: number;

  if (discriminant >= 0) {
    const lambda1 = (beta1 + Math.sqrt(discriminant)) / 2;
    const lambda2 = (beta1 - Math.sqrt(discriminant)) / 2;
    eigenvalue = Math.max(Math.abs(lambda1), Math.abs(lambda2));
  } else {
    eigenvalue = Math.sqrt(-beta2);
  }

  return { beta1, beta2, eigenvalue, residuals, rSquared };
}

function fitAR1(timeSeries: number[]): { beta1: number; eigenvalue: number; aic: number; bic: number; residuals: number[] } {
  const n = timeSeries.length;
  if (n < 3) {
    return { beta1: 0, eigenvalue: 0, aic: Infinity, bic: Infinity, residuals: [] };
  }

  const mean = timeSeries.reduce((a, b) => a + b, 0) / n;
  const centered = timeSeries.map(v => v - mean);

  let sumXY = 0, sumXX = 0;
  const residuals: number[] = [];

  for (let t = 1; t < n; t++) {
    sumXY += centered[t] * centered[t - 1];
    sumXX += centered[t - 1] * centered[t - 1];
  }

  const beta1 = sumXX > 0 ? sumXY / sumXX : 0;

  let ssRes = 0;
  for (let t = 1; t < n; t++) {
    const resid = centered[t] - beta1 * centered[t - 1];
    residuals.push(resid);
    ssRes += resid * resid;
  }

  const m = n - 1;
  const sigma2 = ssRes / m;
  const logL = -0.5 * m * (Math.log(2 * Math.PI * sigma2) + 1);
  const k = 2; // beta1 + sigma2
  const aic = -2 * logL + 2 * k;
  const bic = -2 * logL + k * Math.log(m);

  return { beta1, eigenvalue: Math.abs(beta1), aic, bic, residuals };
}

function fitAR2Full(timeSeries: number[]): { beta1: number; beta2: number; eigenvalue: number; aic: number; bic: number; residuals: number[] } {
  const result = fitAR2WithResiduals(timeSeries);
  const m = result.residuals.length;
  
  if (m < 1) {
    return { ...result, aic: Infinity, bic: Infinity };
  }

  const ssRes = result.residuals.reduce((a, r) => a + r * r, 0);
  const sigma2 = ssRes / m;
  const logL = -0.5 * m * (Math.log(2 * Math.PI * sigma2) + 1);
  const k = 3; // beta1 + beta2 + sigma2
  const aic = -2 * logL + 2 * k;
  const bic = -2 * logL + k * Math.log(m);

  return { ...result, aic, bic };
}

function fitAR3(timeSeries: number[]): { beta1: number; beta2: number; beta3: number; eigenvalue: number; aic: number; bic: number; residuals: number[] } {
  const n = timeSeries.length;
  if (n < 6) {
    return { beta1: 0, beta2: 0, beta3: 0, eigenvalue: 0, aic: Infinity, bic: Infinity, residuals: [] };
  }

  const mean = timeSeries.reduce((a, b) => a + b, 0) / n;
  const centered = timeSeries.map(v => v - mean);

  const Y: number[] = [];
  const X: number[][] = [];

  for (let t = 3; t < n; t++) {
    Y.push(centered[t]);
    X.push([centered[t - 1], centered[t - 2], centered[t - 3]]);
  }

  const m = Y.length;
  
  // Solve normal equations: X'X * beta = X'Y
  const XtX = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const XtY = [0, 0, 0];

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < 3; j++) {
      XtY[j] += X[i][j] * Y[i];
      for (let k = 0; k < 3; k++) {
        XtX[j][k] += X[i][j] * X[i][k];
      }
    }
  }

  // Solve 3x3 system using Cramer's rule (simplified)
  const det3 = (m: number[][]) => 
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);

  const det = det3(XtX);
  if (Math.abs(det) < 1e-10) {
    return { beta1: 0, beta2: 0, beta3: 0, eigenvalue: 0, aic: Infinity, bic: Infinity, residuals: [] };
  }

  const replace = (mat: number[][], col: number, vec: number[]) => {
    return mat.map((row, i) => row.map((val, j) => j === col ? vec[i] : val));
  };

  const beta1 = det3(replace(XtX, 0, XtY)) / det;
  const beta2 = det3(replace(XtX, 1, XtY)) / det;
  const beta3 = det3(replace(XtX, 2, XtY)) / det;

  const residuals: number[] = [];
  let ssRes = 0;

  for (let i = 0; i < m; i++) {
    const pred = beta1 * X[i][0] + beta2 * X[i][1] + beta3 * X[i][2];
    const resid = Y[i] - pred;
    residuals.push(resid);
    ssRes += resid * resid;
  }

  const sigma2 = ssRes / m;
  const logL = -0.5 * m * (Math.log(2 * Math.PI * sigma2) + 1);
  const k = 4; // beta1 + beta2 + beta3 + sigma2
  const aic = -2 * logL + 2 * k;
  const bic = -2 * logL + k * Math.log(m);

  // Eigenvalue from characteristic polynomial: λ³ - β₁λ² - β₂λ - β₃ = 0
  // Use numerical root finding (Newton-Raphson for largest root)
  const poly = (x: number) => x * x * x - beta1 * x * x - beta2 * x - beta3;
  const dpoly = (x: number) => 3 * x * x - 2 * beta1 * x - beta2;
  
  let lambda = 1.0;
  for (let iter = 0; iter < 20; iter++) {
    const d = dpoly(lambda);
    if (Math.abs(d) < 1e-10) break;
    lambda = lambda - poly(lambda) / d;
  }
  
  const eigenvalue = Math.abs(lambda);

  return { beta1, beta2, beta3, eigenvalue, aic, bic, residuals };
}

function ljungBoxTest(residuals: number[], lags: number = 5): { statistic: number; pValue: number } {
  const n = residuals.length;
  if (n < lags + 2) {
    return { statistic: 0, pValue: 1 };
  }

  let Q = 0;
  for (let k = 1; k <= lags; k++) {
    let sumNum = 0;
    let sumDen = 0;
    
    for (let t = k; t < n; t++) {
      sumNum += residuals[t] * residuals[t - k];
    }
    for (let t = 0; t < n; t++) {
      sumDen += residuals[t] * residuals[t];
    }
    
    const rho_k = sumDen > 0 ? sumNum / sumDen : 0;
    Q += (rho_k * rho_k) / (n - k);
  }
  
  Q = n * (n + 2) * Q;

  // Chi-squared p-value approximation (df = lags - p, where p = AR order = 2)
  const df = Math.max(1, lags - 2);
  // Simple chi-squared approximation
  const pValue = 1 - chiSquaredCDF(Q, df);

  return { statistic: Q, pValue };
}

function chiSquaredCDF(x: number, df: number): number {
  // Approximation using normal distribution for df > 30
  if (df > 30) {
    const z = Math.pow(x / df, 1/3) - (1 - 2 / (9 * df));
    const stdz = z / Math.sqrt(2 / (9 * df));
    return 0.5 * (1 + erf(stdz / Math.sqrt(2)));
  }
  
  // Regularized incomplete gamma function approximation
  const k = df / 2;
  const t = x / 2;
  
  // Series expansion for lower incomplete gamma
  let sum = 0;
  let term = 1 / k;
  sum = term;
  
  for (let n = 1; n < 100; n++) {
    term *= t / (k + n);
    sum += term;
    if (Math.abs(term) < 1e-10) break;
  }
  
  return sum * Math.exp(-t + k * Math.log(t) - logGamma(k));
}

function erf(x: number): number {
  const t = 1 / (1 + 0.5 * Math.abs(x));
  const tau = t * Math.exp(-x * x - 1.26551223 +
    t * (1.00002368 +
    t * (0.37409196 +
    t * (0.09678418 +
    t * (-0.18628806 +
    t * (0.27886807 +
    t * (-1.13520398 +
    t * (1.48851587 +
    t * (-0.82215223 +
    t * 0.17087277)))))))));
  return x >= 0 ? 1 - tau : tau - 1;
}

function logGamma(x: number): number {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091,
             -1.231739572450155, 0.001208650973866179, -5.395239384953e-6];
  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) {
    ser += c[j] / ++y;
  }
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}

function simulateAR2(n: number, beta1: number, beta2: number, noiseStd: number = 1): number[] {
  const series: number[] = [0, 0];
  
  for (let t = 2; t < n; t++) {
    const noise = gaussianRandom() * noiseStd;
    const value = beta1 * series[t - 1] + beta2 * series[t - 2] + noise;
    series.push(value);
  }
  
  return series;
}

function gaussianRandom(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function computeAR1Autocorrelation(timeSeries: number[]): number {
  const n = timeSeries.length;
  if (n < 2) return 0;
  
  const mean = timeSeries.reduce((a, b) => a + b, 0) / n;
  const centered = timeSeries.map(v => v - mean);
  
  let sumXY = 0, sumXX = 0;
  for (let t = 1; t < n; t++) {
    sumXY += centered[t] * centered[t - 1];
    sumXX += centered[t - 1] * centered[t - 1];
  }
  
  return sumXX > 0 ? sumXY / sumXX : 0;
}

function parseGeneTimeSeries(dataFile: string): Map<string, number[]> {
  const geneData = new Map<string, number[]>();
  const filePath = path.join(process.cwd(), dataFile);
  
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return geneData;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  
  // Check if genes are in rows (Gene column first) or columns
  const headers = lines[0].split(',');
  const isGenesInRows = headers[0].toLowerCase() === 'gene' || headers[0].toLowerCase() === 'geneid';
  
  if (isGenesInRows) {
    // Genes are row labels, timepoints are columns
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      const geneName = values[0].trim();
      const timeSeries: number[] = [];
      
      for (let j = 1; j < values.length; j++) {
        const val = parseFloat(values[j]);
        if (!isNaN(val)) timeSeries.push(val);
      }
      
      if (timeSeries.length >= 4) {
        geneData.set(geneName.toLowerCase(), timeSeries);
      }
    }
  } else {
    // Genes are column headers, timepoints are rows
    for (let col = 0; col < headers.length; col++) {
      const geneName = headers[col].trim();
      const timeSeries: number[] = [];
      
      for (let row = 1; row < lines.length; row++) {
        const values = lines[row].split(',');
        const val = parseFloat(values[col]);
        if (!isNaN(val)) timeSeries.push(val);
      }
      
      if (timeSeries.length >= 4) {
        geneData.set(geneName.toLowerCase(), timeSeries);
      }
    }
  }
  
  return geneData;
}

export function runResidualDiagnostics(dataFile: string = 'datasets/GSE54650_Liver_circadian.csv'): LjungBoxResult[] {
  const results: LjungBoxResult[] = [];
  const geneData = parseGeneTimeSeries(dataFile);
  
  if (geneData.size === 0) {
    console.error(`No gene data found in ${dataFile}`);
    return results;
  }

  const clockGenes = ['per1', 'per2', 'cry1', 'cry2', 'clock', 'arntl', 'nr1d1', 'nr1d2', 'bmal1'];
  const targetGenes = ['myc', 'ccnd1', 'lgr5', 'axin2', 'wee1', 'cdkn1a', 'ccnb1', 'cdk1'];
  const allGenes = [...clockGenes, ...targetGenes];

  for (const gene of allGenes) {
    const timeSeries = geneData.get(gene);
    if (!timeSeries || timeSeries.length < 6) continue;

    const fit = fitAR2WithResiduals(timeSeries);
    const lbTest = ljungBoxTest(fit.residuals, 5);
    
    results.push({
      gene: gene.charAt(0).toUpperCase() + gene.slice(1),
      type: clockGenes.includes(gene) ? 'CLOCK' : 'TARGET',
      eigenvalue: fit.eigenvalue,
      ljungBoxStat: lbTest.statistic,
      pValue: lbTest.pValue,
      isWellSpecified: lbTest.pValue > 0.05
    });
  }

  return results;
}

export function runModelComparison(dataFile: string = 'datasets/GSE54650_Liver_circadian.csv'): ModelComparisonResult[] {
  const results: ModelComparisonResult[] = [];
  const geneData = parseGeneTimeSeries(dataFile);
  
  if (geneData.size === 0) {
    console.error(`No gene data found in ${dataFile}`);
    return results;
  }

  const clockGenes = ['per1', 'per2', 'cry1', 'cry2', 'clock', 'arntl', 'nr1d1', 'nr1d2', 'bmal1'];
  const targetGenes = ['myc', 'ccnd1', 'lgr5', 'axin2', 'wee1', 'cdkn1a', 'ccnb1', 'cdk1'];
  const allGenes = [...clockGenes, ...targetGenes];

  for (const gene of allGenes) {
    const timeSeries = geneData.get(gene);
    if (!timeSeries || timeSeries.length < 6) continue;

    const maxOrder = 3;
    const trimmed = timeSeries.slice(maxOrder - 1);
    const ar1Trimmed = fitAR1(trimmed);
    const ar2Full = fitAR2Full(timeSeries);
    const ar3Full = fitAR3(timeSeries);

    const n = timeSeries.length;
    const T = n - maxOrder;
    const recomputeIC = (ssRes: number, nParams: number) => {
      const sigma2 = ssRes / T;
      const logL = -0.5 * T * (Math.log(2 * Math.PI * sigma2) + 1);
      const k = nParams + 1;
      const aic = -2 * logL + 2 * k;
      const bic = -2 * logL + k * Math.log(T);
      return { aic, bic };
    };

    const ar1SSRes = ar1Trimmed.residuals.reduce((a, r) => a + r * r, 0);
    const ar2SSRes = ar2Full.residuals.slice(maxOrder - 2).reduce((a, r) => a + r * r, 0);
    const ar3SSRes = ar3Full.residuals.reduce((a, r) => a + r * r, 0);

    const ar1IC = recomputeIC(ar1SSRes, 1);
    const ar2IC = recomputeIC(ar2SSRes, 2);
    const ar3IC = recomputeIC(ar3SSRes, 3);

    const aicMin = Math.min(ar1IC.aic, ar2IC.aic, ar3IC.aic);
    const bicMin = Math.min(ar1IC.bic, ar2IC.bic, ar3IC.bic);

    const preferredByAIC = ar1IC.aic === aicMin ? 'AR(1)' : ar2IC.aic === aicMin ? 'AR(2)' : 'AR(3)';
    const preferredByBIC = ar1IC.bic === bicMin ? 'AR(1)' : ar2IC.bic === bicMin ? 'AR(2)' : 'AR(3)';
    
    results.push({
      gene: gene.charAt(0).toUpperCase() + gene.slice(1),
      type: clockGenes.includes(gene) ? 'CLOCK' : 'TARGET',
      ar1: { aic: ar1IC.aic, bic: ar1IC.bic, eigenvalue: ar1Trimmed.eigenvalue },
      ar2: { aic: ar2IC.aic, bic: ar2IC.bic, eigenvalue: ar2Full.eigenvalue },
      ar3: { aic: ar3IC.aic, bic: ar3IC.bic, eigenvalue: ar3Full.eigenvalue },
      preferredModel: preferredByBIC,
      preferredByAIC,
      preferredByBIC
    });
  }

  return results;
}

export function runSimulationBenchmark(nSimulations: number = 100): SimulationResult[] {
  const results: SimulationResult[] = [];
  const timepoints = [6, 10, 12, 24];
  const trueEigenvalues = [0.5, 0.7, 0.9];

  for (const n of timepoints) {
    for (const trueEig of trueEigenvalues) {
      // Generate AR(2) parameters with specified eigenvalue
      // For complex conjugate pair: λ = r * e^(±iθ), r = |λ|
      // β₁ = 2r*cos(θ), β₂ = -r²
      const theta = Math.PI / 4; // 45 degrees for complex roots
      const beta1 = 2 * trueEig * Math.cos(theta);
      const beta2 = -trueEig * trueEig;

      const estimates: number[] = [];
      
      for (let sim = 0; sim < nSimulations; sim++) {
        const series = simulateAR2(n, beta1, beta2, 1);
        const fit = fitAR2WithResiduals(series);
        estimates.push(fit.eigenvalue);
      }

      const mean = estimates.reduce((a, b) => a + b, 0) / nSimulations;
      const variance = estimates.reduce((a, e) => a + (e - mean) ** 2, 0) / nSimulations;
      const std = Math.sqrt(variance);
      const bias = mean - trueEig;
      const rmse = Math.sqrt(estimates.reduce((a, e) => a + (e - trueEig) ** 2, 0) / nSimulations);

      results.push({
        trueEigenvalue: trueEig,
        estimatedMean: mean,
        estimatedStd: std,
        bias,
        rmse,
        n,
        nSimulations
      });
    }
  }

  return results;
}

export function runAlternativeMetricsComparison(dataFile: string = 'datasets/GSE54650_Liver_circadian.csv'): AlternativeMetricsResult[] {
  const results: AlternativeMetricsResult[] = [];
  const geneData = parseGeneTimeSeries(dataFile);
  
  if (geneData.size === 0) {
    console.error(`No gene data found in ${dataFile}`);
    return results;
  }

  const clockGenes = ['per1', 'per2', 'cry1', 'cry2', 'clock', 'arntl', 'nr1d1', 'nr1d2', 'bmal1'];
  const targetGenes = ['myc', 'ccnd1', 'lgr5', 'axin2', 'wee1', 'cdkn1a', 'ccnb1', 'cdk1'];
  const allGenes = [...clockGenes, ...targetGenes];

  for (const gene of allGenes) {
    const timeSeries = geneData.get(gene);
    if (!timeSeries || timeSeries.length < 4) continue;

    const ar2Fit = fitAR2WithResiduals(timeSeries);
    const ar1Autocorr = computeAR1Autocorrelation(timeSeries);
    const sumArCoeffs = ar2Fit.beta1 + ar2Fit.beta2;

    // Simple spectral density peak estimate (at frequency 0)
    const spectralDensityPeak = 1 / ((1 - ar2Fit.beta1 - ar2Fit.beta2) ** 2);

    results.push({
      gene: gene.charAt(0).toUpperCase() + gene.slice(1),
      type: clockGenes.includes(gene) ? 'CLOCK' : 'TARGET',
      ar2Eigenvalue: ar2Fit.eigenvalue,
      ar1Autocorr: Math.abs(ar1Autocorr),
      sumArCoeffs,
      spectralDensityPeak: Math.min(spectralDensityPeak, 100)
    });
  }

  return results;
}

export interface StressTestSummary {
  residualDiagnostics: {
    results: LjungBoxResult[];
    summary: {
      totalGenes: number;
      wellSpecified: number;
      misSpecified: number;
      wellSpecifiedRate: number;
      clockWellSpecified: number;
      targetWellSpecified: number;
    };
  };
  modelComparison: {
    results: ModelComparisonResult[];
    summary: {
      ar1Preferred: number;
      ar2Preferred: number;
      ar3Preferred: number;
      ar2Rate: number;
      clockAR2Rate: number;
      targetAR2Rate: number;
    };
  };
  simulationBenchmark: {
    results: SimulationResult[];
    summary: {
      byTimepoints: { n: number; avgBias: number; avgRMSE: number }[];
      byEigenvalue: { lambda: number; avgBias: number; avgRMSE: number }[];
    };
  };
  alternativeMetrics: {
    results: AlternativeMetricsResult[];
    summary: {
      ar2ClockMean: number;
      ar2TargetMean: number;
      ar1ClockMean: number;
      ar1TargetMean: number;
      sumCoeffsClockMean: number;
      sumCoeffsTargetMean: number;
      ar2Gap: number;
      ar1Gap: number;
      sumCoeffsGap: number;
      conclusionsRobust: boolean;
    };
  };
}

export function runFullStressTestSuite(): StressTestSummary {
  // 1. Residual diagnostics
  const residualResults = runResidualDiagnostics();
  const wellSpecified = residualResults.filter(r => r.isWellSpecified);
  const clockWellSpec = residualResults.filter(r => r.type === 'CLOCK' && r.isWellSpecified).length;
  const targetWellSpec = residualResults.filter(r => r.type === 'TARGET' && r.isWellSpecified).length;

  // 2. Model comparison
  const modelResults = runModelComparison();
  const ar1Preferred = modelResults.filter(r => r.preferredModel === 'AR(1)').length;
  const ar2Preferred = modelResults.filter(r => r.preferredModel === 'AR(2)').length;
  const ar3Preferred = modelResults.filter(r => r.preferredModel === 'AR(3)').length;
  const clockAR2 = modelResults.filter(r => r.type === 'CLOCK' && r.preferredModel === 'AR(2)').length;
  const targetAR2 = modelResults.filter(r => r.type === 'TARGET' && r.preferredModel === 'AR(2)').length;
  const clockTotal = modelResults.filter(r => r.type === 'CLOCK').length;
  const targetTotal = modelResults.filter(r => r.type === 'TARGET').length;

  // 3. Simulation benchmark
  const simResults = runSimulationBenchmark(100);
  
  const byTimepoints: { n: number; avgBias: number; avgRMSE: number }[] = [];
  for (const n of [6, 10, 12, 24]) {
    const nResults = simResults.filter(r => r.n === n);
    const avgBias = nResults.reduce((a, r) => a + Math.abs(r.bias), 0) / nResults.length;
    const avgRMSE = nResults.reduce((a, r) => a + r.rmse, 0) / nResults.length;
    byTimepoints.push({ n, avgBias, avgRMSE });
  }

  const byEigenvalue: { lambda: number; avgBias: number; avgRMSE: number }[] = [];
  for (const lambda of [0.5, 0.7, 0.9]) {
    const lambdaResults = simResults.filter(r => r.trueEigenvalue === lambda);
    const avgBias = lambdaResults.reduce((a, r) => a + Math.abs(r.bias), 0) / lambdaResults.length;
    const avgRMSE = lambdaResults.reduce((a, r) => a + r.rmse, 0) / lambdaResults.length;
    byEigenvalue.push({ lambda, avgBias, avgRMSE });
  }

  // 4. Alternative metrics
  const altResults = runAlternativeMetricsComparison();
  const clockAlt = altResults.filter(r => r.type === 'CLOCK');
  const targetAlt = altResults.filter(r => r.type === 'TARGET');

  const ar2ClockMean = clockAlt.reduce((a, r) => a + r.ar2Eigenvalue, 0) / clockAlt.length;
  const ar2TargetMean = targetAlt.reduce((a, r) => a + r.ar2Eigenvalue, 0) / targetAlt.length;
  const ar1ClockMean = clockAlt.reduce((a, r) => a + r.ar1Autocorr, 0) / clockAlt.length;
  const ar1TargetMean = targetAlt.reduce((a, r) => a + r.ar1Autocorr, 0) / targetAlt.length;
  const sumCoeffsClockMean = clockAlt.reduce((a, r) => a + r.sumArCoeffs, 0) / clockAlt.length;
  const sumCoeffsTargetMean = targetAlt.reduce((a, r) => a + r.sumArCoeffs, 0) / targetAlt.length;

  const ar2Gap = ar2ClockMean - ar2TargetMean;
  const ar1Gap = ar1ClockMean - ar1TargetMean;
  const sumCoeffsGap = sumCoeffsClockMean - sumCoeffsTargetMean;

  // Conclusions are robust if all metrics show clock > target
  const conclusionsRobust = ar2Gap > 0 && ar1Gap > 0 && sumCoeffsGap > 0;

  return {
    residualDiagnostics: {
      results: residualResults,
      summary: {
        totalGenes: residualResults.length,
        wellSpecified: wellSpecified.length,
        misSpecified: residualResults.length - wellSpecified.length,
        wellSpecifiedRate: wellSpecified.length / residualResults.length,
        clockWellSpecified: clockWellSpec,
        targetWellSpecified: targetWellSpec
      }
    },
    modelComparison: {
      results: modelResults,
      summary: {
        ar1Preferred,
        ar2Preferred,
        ar3Preferred,
        ar2Rate: modelResults.length > 0 ? ar2Preferred / modelResults.length : 0,
        clockAR2Rate: clockTotal > 0 ? clockAR2 / clockTotal : 0,
        targetAR2Rate: targetTotal > 0 ? targetAR2 / targetTotal : 0
      }
    },
    simulationBenchmark: {
      results: simResults,
      summary: { byTimepoints, byEigenvalue }
    },
    alternativeMetrics: {
      results: altResults,
      summary: {
        ar2ClockMean,
        ar2TargetMean,
        ar1ClockMean,
        ar1TargetMean,
        sumCoeffsClockMean,
        sumCoeffsTargetMean,
        ar2Gap,
        ar1Gap,
        sumCoeffsGap,
        conclusionsRobust
      }
    }
  };
}
