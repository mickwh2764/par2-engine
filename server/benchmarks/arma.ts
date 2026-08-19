/**
 * ARMA Model Comparison Implementation (Simplified)
 * 
 * Implements ARMA(p,q) model fitting with AIC/BIC model selection
 * to validate the choice of AR(2) in the PAR(2) framework.
 * 
 * NOTE: This is a SIMPLIFIED implementation using conditional least squares
 * (Yule-Walker for AR, two-stage for ARMA). For exact MLE-based ARMA fitting,
 * use dedicated statistical packages (e.g., R's arima() or Python's statsmodels).
 * 
 * This implementation is sufficient for demonstrating that AR(2) is often
 * the preferred model for circadian time series, validating the PAR(2) choice.
 */

export interface ARMAResult {
  gene: string;
  bestModel: string;
  ar: number[];
  ma: number[];
  aic: number;
  bic: number;
  logLikelihood: number;
  residualVariance: number;
  modelComparison: ModelComparison[];
}

export interface ModelComparison {
  model: string;
  p: number;
  q: number;
  aic: number;
  bic: number;
  deltaAIC: number;
  isSelected: boolean;
}

export interface ARMAConfig {
  maxP?: number;
  maxQ?: number;
  criterion?: 'aic' | 'bic';
}

function mean(data: number[]): number {
  return data.reduce((a, b) => a + b, 0) / data.length;
}

function variance(data: number[]): number {
  const m = mean(data);
  return data.reduce((sum, x) => sum + (x - m) ** 2, 0) / (data.length - 1);
}

function demean(data: number[]): number[] {
  const m = mean(data);
  return data.map(x => x - m);
}

function fitAR(data: number[], p: number): { coeffs: number[]; sigma2: number; logLik: number } {
  const y = demean(data);
  const n = y.length;
  
  if (n <= p + 1) {
    return { coeffs: Array(p).fill(0), sigma2: variance(data), logLik: -Infinity };
  }
  
  const X: number[][] = [];
  const Y: number[] = [];
  
  for (let t = p; t < n; t++) {
    const row: number[] = [];
    for (let i = 1; i <= p; i++) {
      row.push(y[t - i]);
    }
    X.push(row);
    Y.push(y[t]);
  }
  
  const coeffs = solveOLS(X, Y);
  
  let ssr = 0;
  for (let i = 0; i < Y.length; i++) {
    let pred = 0;
    for (let j = 0; j < p; j++) {
      pred += coeffs[j] * X[i][j];
    }
    ssr += (Y[i] - pred) ** 2;
  }
  
  const sigma2 = ssr / (Y.length - p);
  const logLik = -0.5 * Y.length * (Math.log(2 * Math.PI) + Math.log(sigma2) + 1);
  
  return { coeffs, sigma2, logLik };
}

function fitARMA(data: number[], p: number, q: number): { ar: number[]; ma: number[]; sigma2: number; logLik: number } {
  if (q === 0) {
    const arResult = fitAR(data, p);
    return { ar: arResult.coeffs, ma: [], sigma2: arResult.sigma2, logLik: arResult.logLik };
  }
  
  const y = demean(data);
  const n = y.length;
  
  const arResult = fitAR(data, p);
  const arCoeffs = arResult.coeffs;
  
  const residuals: number[] = Array(n).fill(0);
  for (let t = p; t < n; t++) {
    let pred = 0;
    for (let i = 0; i < p; i++) {
      pred += arCoeffs[i] * y[t - i - 1];
    }
    residuals[t] = y[t] - pred;
  }
  
  const maResult = fitAR(residuals.slice(q), q);
  const maCoeffs = maResult.coeffs;
  
  let ssr = 0;
  let count = 0;
  for (let t = Math.max(p, q); t < n; t++) {
    let pred = 0;
    for (let i = 0; i < p && t - i - 1 >= 0; i++) {
      pred += arCoeffs[i] * y[t - i - 1];
    }
    for (let j = 0; j < q && t - j - 1 >= 0; j++) {
      pred += maCoeffs[j] * residuals[t - j - 1];
    }
    ssr += (y[t] - pred) ** 2;
    count++;
  }
  
  const sigma2 = count > 0 ? ssr / count : variance(data);
  const logLik = count > 0 ? -0.5 * count * (Math.log(2 * Math.PI) + Math.log(sigma2) + 1) : -Infinity;
  
  return { ar: arCoeffs, ma: maCoeffs, sigma2, logLik };
}

function solveOLS(X: number[][], Y: number[]): number[] {
  const n = X.length;
  const p = X[0]?.length || 0;
  
  if (n === 0 || p === 0) return [];
  
  const XtX: number[][] = Array(p).fill(null).map(() => Array(p).fill(0));
  const XtY: number[] = Array(p).fill(0);
  
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < p; j++) {
      XtY[j] += X[i][j] * Y[i];
      for (let k = 0; k < p; k++) {
        XtX[j][k] += X[i][j] * X[i][k];
      }
    }
  }
  
  for (let i = 0; i < p; i++) {
    XtX[i][i] += 1e-8;
  }
  
  return solveLinearSystem(XtX, XtY);
}

function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = A.length;
  const aug: number[][] = A.map((row, i) => [...row, b[i]]);
  
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) {
        maxRow = row;
      }
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
    
    if (Math.abs(aug[col][col]) < 1e-10) continue;
    
    for (let row = col + 1; row < n; row++) {
      const factor = aug[row][col] / aug[col][col];
      for (let j = col; j <= n; j++) {
        aug[row][j] -= factor * aug[col][j];
      }
    }
  }
  
  const x: number[] = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    if (Math.abs(aug[i][i]) < 1e-10) continue;
    x[i] = aug[i][n];
    for (let j = i + 1; j < n; j++) {
      x[i] -= aug[i][j] * x[j];
    }
    x[i] /= aug[i][i];
  }
  
  return x;
}

function computeAIC(logLik: number, k: number, n: number): number {
  return -2 * logLik + 2 * k;
}

function computeBIC(logLik: number, k: number, n: number): number {
  return -2 * logLik + k * Math.log(n);
}

export function runARMAComparison(
  expression: number[],
  config: ARMAConfig = {}
): { bestModel: ModelComparison; allModels: ModelComparison[]; ar2Rank: number } {
  const { maxP = 3, maxQ = 2, criterion = 'aic' } = config;
  const n = expression.length;
  
  const models: ModelComparison[] = [];
  
  for (let p = 0; p <= maxP; p++) {
    for (let q = 0; q <= maxQ; q++) {
      if (p === 0 && q === 0) continue;
      
      try {
        const result = fitARMA(expression, p, q);
        const k = p + q + 1;
        const aic = computeAIC(result.logLik, k, n);
        const bic = computeBIC(result.logLik, k, n);
        
        models.push({
          model: `ARMA(${p},${q})`,
          p,
          q,
          aic,
          bic,
          deltaAIC: 0,
          isSelected: false
        });
      } catch (e) {
        continue;
      }
    }
  }
  
  if (models.length === 0) {
    const defaultModel: ModelComparison = {
      model: 'AR(2)',
      p: 2,
      q: 0,
      aic: 0,
      bic: 0,
      deltaAIC: 0,
      isSelected: true
    };
    return { bestModel: defaultModel, allModels: [defaultModel], ar2Rank: 1 };
  }
  
  const sortKey = criterion === 'aic' ? 'aic' : 'bic';
  models.sort((a, b) => a[sortKey] - b[sortKey]);
  
  const minIC = models[0][sortKey];
  for (const model of models) {
    model.deltaAIC = model[sortKey] - minIC;
    model.isSelected = model === models[0];
  }
  
  const ar2Model = models.find(m => m.p === 2 && m.q === 0);
  const ar2Rank = ar2Model ? models.indexOf(ar2Model) + 1 : -1;
  
  return { bestModel: models[0], allModels: models, ar2Rank };
}

export function runARMABatch(
  geneData: Map<string, number[]>,
  config: ARMAConfig = {}
): ARMAResult[] {
  const results: ARMAResult[] = [];
  
  for (const [gene, expression] of Array.from(geneData.entries())) {
    const comparison = runARMAComparison(expression, config);
    const best = comparison.bestModel;
    
    const armaFit = fitARMA(expression, best.p, best.q);
    
    results.push({
      gene,
      bestModel: best.model,
      ar: armaFit.ar,
      ma: armaFit.ma,
      aic: best.aic,
      bic: best.bic,
      logLikelihood: armaFit.logLik,
      residualVariance: armaFit.sigma2,
      modelComparison: comparison.allModels
    });
  }
  
  return results;
}

export function validateAR2Choice(
  geneData: Map<string, number[]>,
  config: ARMAConfig = {}
): { ar2PreferredCount: number; totalGenes: number; ar2PreferredPercent: number; summary: string } {
  let ar2Preferred = 0;
  let total = 0;
  
  for (const [gene, expression] of Array.from(geneData.entries())) {
    const comparison = runARMAComparison(expression, config);
    if (comparison.ar2Rank === 1) {
      ar2Preferred++;
    }
    total++;
  }
  
  const percent = total > 0 ? (ar2Preferred / total) * 100 : 0;
  
  return {
    ar2PreferredCount: ar2Preferred,
    totalGenes: total,
    ar2PreferredPercent: percent,
    summary: `AR(2) is the preferred model for ${ar2Preferred}/${total} genes (${percent.toFixed(1)}%) based on ${config.criterion?.toUpperCase() || 'AIC'}`
  };
}
