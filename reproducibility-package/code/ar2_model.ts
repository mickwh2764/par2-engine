export interface AR2Result {
  beta1: number;
  beta2: number;
  eigenvalue: number;
  isComplex: boolean;
  r2: number;
}

export function fitAR2(series: number[]): AR2Result | null {
  const n = series.length;
  if (n < 5) return null;

  const mean = series.reduce((a, b) => a + b, 0) / n;
  const y = series.map(x => x - mean);

  let s11 = 0, s22 = 0, s12 = 0, sy1 = 0, sy2 = 0;
  for (let t = 2; t < n; t++) {
    s11 += y[t - 1] * y[t - 1];
    s22 += y[t - 2] * y[t - 2];
    s12 += y[t - 1] * y[t - 2];
    sy1 += y[t] * y[t - 1];
    sy2 += y[t] * y[t - 2];
  }

  const det = s11 * s22 - s12 * s12;
  if (Math.abs(det) < 1e-10) return null;

  const beta1 = (s22 * sy1 - s12 * sy2) / det;
  const beta2 = (s11 * sy2 - s12 * sy1) / det;

  const { eigenvalue, isComplex } = solveEigenvalues(beta1, beta2);

  const Y = y.slice(2);
  const pred: number[] = [];
  for (let i = 2; i < n; i++) pred.push(beta1 * y[i - 1] + beta2 * y[i - 2]);
  const ssRes = Y.reduce((s, v, i) => s + Math.pow(v - pred[i], 2), 0);
  const yMean = Y.reduce((a, b) => a + b, 0) / Y.length;
  const ssTot = Y.reduce((s, v) => s + Math.pow(v - yMean, 2), 0);
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  return { beta1, beta2, eigenvalue, isComplex, r2 };
}

export function solveEigenvalues(beta1: number, beta2: number): { eigenvalue: number; isComplex: boolean } {
  const disc = beta1 * beta1 + 4 * beta2;
  if (disc < 0) {
    return { eigenvalue: Math.sqrt(-beta2), isComplex: true };
  }
  const r1 = (beta1 + Math.sqrt(disc)) / 2;
  const r2 = (beta1 - Math.sqrt(disc)) / 2;
  return { eigenvalue: Math.max(Math.abs(r1), Math.abs(r2)), isComplex: false };
}
