/**
 * Simple ML Prediction Layer
 * 
 * Tests whether PAR(2) features can predict out-of-sample expression
 * or phenotypic outcomes. Uses cross-validation for honest assessment.
 */

export interface PredictionResult {
  model: string;
  trainR2: number;
  testR2: number;
  rmse: number;
  mae: number;
  cv_folds: number;
  improveOverAR2: boolean;
  interpretation: string;
}

export interface CrossValidationResult {
  foldResults: { fold: number; trainR2: number; testR2: number }[];
  meanTrainR2: number;
  meanTestR2: number;
  stdTestR2: number;
  overfit: boolean;
  usable: boolean;
}

export interface FeatureImportance {
  feature: string;
  importance: number;
  direction: 'positive' | 'negative' | 'neutral';
}

/**
 * Simple linear regression with L2 regularization (Ridge)
 */
function ridgeRegression(
  X: number[][],
  y: number[],
  lambda: number = 0.1
): number[] {
  const n = X.length;
  const p = X[0].length;
  
  const XtX: number[][] = Array(p).fill(0).map(() => Array(p).fill(0));
  const XtY: number[] = Array(p).fill(0);
  
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < p; j++) {
      XtY[j] += X[i][j] * y[i];
      for (let k = 0; k < p; k++) {
        XtX[j][k] += X[i][j] * X[i][k];
      }
    }
  }
  
  for (let i = 0; i < p; i++) {
    XtX[i][i] += lambda;
  }
  
  return solveSystem(XtX, XtY);
}

function solveSystem(A: number[][], b: number[]): number[] {
  const n = A.length;
  const aug = A.map((row, i) => [...row, b[i]]);
  
  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(aug[k][i]) > Math.abs(aug[maxRow][i])) maxRow = k;
    }
    [aug[i], aug[maxRow]] = [aug[maxRow], aug[i]];
    
    if (Math.abs(aug[i][i]) < 1e-10) continue;
    
    for (let k = i + 1; k < n; k++) {
      const f = aug[k][i] / aug[i][i];
      for (let j = i; j <= n; j++) aug[k][j] -= f * aug[i][j];
    }
  }
  
  const x = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = aug[i][n];
    for (let j = i + 1; j < n; j++) x[i] -= aug[i][j] * x[j];
    if (Math.abs(aug[i][i]) > 1e-10) x[i] /= aug[i][i];
  }
  return x;
}

function predict(X: number[][], beta: number[]): number[] {
  return X.map(row => row.reduce((sum, x, i) => sum + x * beta[i], 0));
}

function calcR2(actual: number[], predicted: number[]): number {
  const mean = actual.reduce((a, b) => a + b, 0) / actual.length;
  const ssTot = actual.reduce((sum, y) => sum + Math.pow(y - mean, 2), 0);
  const ssRes = actual.reduce((sum, y, i) => sum + Math.pow(y - predicted[i], 2), 0);
  return ssTot > 0 ? 1 - ssRes / ssTot : 0;
}

function calcRMSE(actual: number[], predicted: number[]): number {
  const mse = actual.reduce((sum, y, i) => sum + Math.pow(y - predicted[i], 2), 0) / actual.length;
  return Math.sqrt(mse);
}

function calcMAE(actual: number[], predicted: number[]): number {
  return actual.reduce((sum, y, i) => sum + Math.abs(y - predicted[i]), 0) / actual.length;
}

/**
 * K-fold cross-validation
 */
export function crossValidate(
  X: number[][],
  y: number[],
  k: number = 5,
  lambda: number = 0.1
): CrossValidationResult {
  const n = X.length;
  const foldSize = Math.floor(n / k);
  const foldResults: { fold: number; trainR2: number; testR2: number }[] = [];
  
  const indices = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  
  for (let fold = 0; fold < k; fold++) {
    const testStart = fold * foldSize;
    const testEnd = fold === k - 1 ? n : (fold + 1) * foldSize;
    
    const testIndices = indices.slice(testStart, testEnd);
    const trainIndices = [...indices.slice(0, testStart), ...indices.slice(testEnd)];
    
    const XTrain = trainIndices.map(i => X[i]);
    const yTrain = trainIndices.map(i => y[i]);
    const XTest = testIndices.map(i => X[i]);
    const yTest = testIndices.map(i => y[i]);
    
    if (XTrain.length < 3 || XTest.length < 1) continue;
    
    const beta = ridgeRegression(XTrain, yTrain, lambda);
    const trainPred = predict(XTrain, beta);
    const testPred = predict(XTest, beta);
    
    foldResults.push({
      fold: fold + 1,
      trainR2: calcR2(yTrain, trainPred),
      testR2: calcR2(yTest, testPred)
    });
  }
  
  if (foldResults.length === 0) {
    return {
      foldResults: [],
      meanTrainR2: 0,
      meanTestR2: 0,
      stdTestR2: 0,
      overfit: true,
      usable: false
    };
  }
  
  const meanTrainR2 = foldResults.reduce((s, f) => s + f.trainR2, 0) / foldResults.length;
  const meanTestR2 = foldResults.reduce((s, f) => s + f.testR2, 0) / foldResults.length;
  const stdTestR2 = Math.sqrt(
    foldResults.reduce((s, f) => s + Math.pow(f.testR2 - meanTestR2, 2), 0) / foldResults.length
  );
  
  const overfit = meanTrainR2 - meanTestR2 > 0.2;
  const usable = meanTestR2 > 0.1 && !overfit;
  
  return { foldResults, meanTrainR2, meanTestR2, stdTestR2, overfit, usable };
}

/**
 * Build PAR(2) features from time series
 */
export function buildPAR2Features(
  clockTimeSeries: number[],
  targetTimeSeries: number[],
  phase: number
): number[] {
  const clockMean = clockTimeSeries.reduce((a, b) => a + b, 0) / clockTimeSeries.length;
  const targetMean = targetTimeSeries.reduce((a, b) => a + b, 0) / targetTimeSeries.length;
  
  const clockVar = clockTimeSeries.reduce((s, x) => s + Math.pow(x - clockMean, 2), 0) / clockTimeSeries.length;
  const targetVar = targetTimeSeries.reduce((s, x) => s + Math.pow(x - targetMean, 2), 0) / targetTimeSeries.length;
  
  let covariance = 0;
  for (let i = 0; i < Math.min(clockTimeSeries.length, targetTimeSeries.length); i++) {
    covariance += (clockTimeSeries[i] - clockMean) * (targetTimeSeries[i] - targetMean);
  }
  covariance /= Math.min(clockTimeSeries.length, targetTimeSeries.length);
  
  const correlation = Math.sqrt(clockVar * targetVar) > 0 
    ? covariance / Math.sqrt(clockVar * targetVar) 
    : 0;
  
  return [
    1,
    clockMean,
    targetMean,
    Math.sqrt(clockVar),
    Math.sqrt(targetVar),
    correlation,
    Math.cos(2 * Math.PI * phase / 24),
    Math.sin(2 * Math.PI * phase / 24)
  ];
}

/**
 * Compare PAR(2)-based prediction vs simple AR(2)
 */
export function comparePredictionModels(
  samples: Array<{
    clockValues: number[];
    targetValues: number[];
    phase: number;
    outcome: number;
  }>
): PredictionResult[] {
  if (samples.length < 10) {
    return [{
      model: 'Insufficient data',
      trainR2: 0,
      testR2: 0,
      rmse: 0,
      mae: 0,
      cv_folds: 0,
      improveOverAR2: false,
      interpretation: 'Need at least 10 samples for cross-validation'
    }];
  }
  
  const XPAR2 = samples.map(s => buildPAR2Features(s.clockValues, s.targetValues, s.phase));
  const XAR2 = samples.map(s => [1, s.targetValues[s.targetValues.length - 1], s.targetValues[s.targetValues.length - 2] || 0]);
  const y = samples.map(s => s.outcome);
  
  const par2CV = crossValidate(XPAR2, y, 5);
  const ar2CV = crossValidate(XAR2, y, 5);
  
  const improveOverAR2 = par2CV.meanTestR2 > ar2CV.meanTestR2 + 0.05;
  
  return [
    {
      model: 'PAR(2) Full Features',
      trainR2: par2CV.meanTrainR2,
      testR2: par2CV.meanTestR2,
      rmse: 0,
      mae: 0,
      cv_folds: 5,
      improveOverAR2,
      interpretation: par2CV.usable
        ? `PAR(2) explains ${(par2CV.meanTestR2 * 100).toFixed(1)}% of out-of-sample variance`
        : 'PAR(2) model does not generalize well (overfitting or insufficient signal)'
    },
    {
      model: 'Simple AR(2) Baseline',
      trainR2: ar2CV.meanTrainR2,
      testR2: ar2CV.meanTestR2,
      rmse: 0,
      mae: 0,
      cv_folds: 5,
      improveOverAR2: false,
      interpretation: `Baseline AR(2) explains ${(ar2CV.meanTestR2 * 100).toFixed(1)}% of out-of-sample variance`
    }
  ];
}

/**
 * Feature importance analysis
 */
export function analyzeFeatureImportance(
  X: number[][],
  y: number[],
  featureNames: string[]
): FeatureImportance[] {
  const beta = ridgeRegression(X, y, 0.1);
  
  const stds = featureNames.map((_, j) => {
    const col = X.map(row => row[j]);
    const mean = col.reduce((a, b) => a + b, 0) / col.length;
    return Math.sqrt(col.reduce((s, x) => s + Math.pow(x - mean, 2), 0) / col.length);
  });
  
  const importance = beta.map((b, i) => Math.abs(b) * (stds[i] || 1));
  const maxImp = Math.max(...importance);
  
  return featureNames.map((name, i) => ({
    feature: name,
    importance: maxImp > 0 ? importance[i] / maxImp : 0,
    direction: beta[i] > 0.01 ? 'positive' : beta[i] < -0.01 ? 'negative' : 'neutral'
  }));
}
