import { solveEigenvalues } from "../code/ar2_model";

export interface BomanParams {
  nicheSize: number;
  maturationDelay: number;
  divisionLimit: number;
  asymmetricProb: number;
  apoptosisRate: number;
  sheddingRate: number;
  wntStrength: number;
  circadianGating: boolean;
  circadianAmplitude: number;
  mutationRate: number;
  condition: string;
  k1: number;
  k2: number;
  k3: number;
  k4: number;
  k5: number;
}

const GOLDEN_RATIO = (1 + Math.sqrt(5)) / 2;

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function gaussianNoise(mean: number, std: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return mean + std * Math.sqrt(-2 * Math.log(u1 || 1e-10)) * Math.cos(2 * Math.PI * u2);
}

function fitAR2(series: number[]): { phi1: number; phi2: number; r2: number } {
  if (series.length < 5) return { phi1: 0, phi2: 0, r2: 0 };
  const n = series.length - 2;
  let sumY = 0, sumX1 = 0, sumX2 = 0;
  let sumX1X1 = 0, sumX2X2 = 0, sumX1X2 = 0;
  let sumYX1 = 0, sumYX2 = 0, sumYY = 0;
  for (let i = 2; i < series.length; i++) {
    const y = series[i], x1 = series[i - 1], x2 = series[i - 2];
    sumY += y; sumX1 += x1; sumX2 += x2;
    sumX1X1 += x1 * x1; sumX2X2 += x2 * x2; sumX1X2 += x1 * x2;
    sumYX1 += y * x1; sumYX2 += y * x2; sumYY += y * y;
  }
  const meanY = sumY / n;
  const sYX1 = sumYX1 - n * meanY * (sumX1 / n);
  const sYX2 = sumYX2 - n * meanY * (sumX2 / n);
  const sX1X1 = sumX1X1 - n * (sumX1 / n) * (sumX1 / n);
  const sX2X2 = sumX2X2 - n * (sumX2 / n) * (sumX2 / n);
  const sX1X2 = sumX1X2 - n * (sumX1 / n) * (sumX2 / n);
  const sYY = sumYY - n * meanY * meanY;
  const det = sX1X1 * sX2X2 - sX1X2 * sX1X2;
  if (Math.abs(det) < 1e-12) return { phi1: 0, phi2: 0, r2: 0 };
  const phi1 = (sX2X2 * sYX1 - sX1X2 * sYX2) / det;
  const phi2 = (sX1X1 * sYX2 - sX1X2 * sYX1) / det;
  const ssRes = sYY - phi1 * sYX1 - phi2 * sYX2;
  const r2 = sYY > 0 ? 1 - ssRes / sYY : 0;
  return { phi1, phi2, r2: Math.max(0, Math.min(1, r2)) };
}

function classifyPattern(phi1: number, phi2: number, lambdaMod: number, condition: string): string {
  const ratio = Math.abs(phi2) > 0.01 ? Math.abs(phi1 / phi2) : 99;
  const phiDist = Math.abs(ratio - GOLDEN_RATIO);
  const lucasDist = Math.abs(ratio - 1.0);
  if (condition.includes("adenoma") || lambdaMod > 1.0) return "adenoma-like";
  if (condition.includes("FAP")) return "FAP-like";
  if (phiDist < 0.15 && lambdaMod < 1.0 && lambdaMod > 0.3) return "Fibonacci-consistent";
  if (phiDist < 0.30 && lambdaMod < 1.0 && lambdaMod > 0.3) return "Fibonacci-adjacent";
  if (lucasDist < 0.15 && lambdaMod < 1.0) return "Lucas-like";
  return "normal";
}

export function runBomanSimulation(params: BomanParams, timeSteps: number = 200): { C: number[]; P: number[]; D: number[] } {
  let C = params.nicheSize + gaussianNoise(0, 1);
  let P = params.nicheSize * 1.5 + gaussianNoise(0, 2);
  let D = params.nicheSize * 4 + gaussianNoise(0, 3);
  let mutationLoad = params.condition === "FAP-like" ? 0.3 : params.condition === "adenoma-like" ? 0.6 : 0;
  const Cprev = [C, C], Pprev = [P, P];
  const cSeries: number[] = [], pSeries: number[] = [], dSeries: number[] = [];

  for (let t = 0; t < timeSteps; t++) {
    const circadianMod = params.circadianGating ? 1.0 + params.circadianAmplitude * Math.cos(2 * Math.PI * t / 24) : 1.0;
    const nicheFeedback = 1.0 - C / (params.nicheSize * 2);
    const divisionRate = params.k1 * circadianMod * clamp(nicheFeedback, 0.1, 1.5);
    const asymRate = params.asymmetricProb * (1.0 - mutationLoad * 0.2);
    const newStem = divisionRate * (1 - asymRate) * C;
    const newTA = divisionRate * asymRate * C;
    const maturationFactor = Math.exp(-params.maturationDelay / 10);
    const taDivision = params.k2 * P * maturationFactor * circadianMod;
    const prevC = Cprev.length >= 2 ? Cprev[Cprev.length - 2] : C;
    const prevP = Pprev.length >= 2 ? Pprev[Pprev.length - 2] : P;
    const delayStrength = params.k3 * (1.0 + params.maturationDelay * 0.2);
    const newC = C * (1.0 - params.apoptosisRate) + newStem - delayStrength * prevC - 0.3 * (C / params.nicheSize) * C + gaussianNoise(0, 0.3 * Math.sqrt(C + 1));
    const newP = P * (1.0 - params.k4) + newTA + params.k3 * prevC * maturationFactor - taDivision - delayStrength * 0.8 * prevP - 0.2 * (P / (params.nicheSize * 1.5)) * P + gaussianNoise(0, 0.4 * Math.sqrt(P + 1));
    const newD = D * (1.0 - params.sheddingRate) + taDivision - params.k5 * D + gaussianNoise(0, 0.5 * Math.sqrt(D + 1));
    C = clamp(newC, 1, params.nicheSize * 5);
    P = clamp(newP, 0, params.nicheSize * 10);
    D = clamp(newD, 0, params.nicheSize * 20);
    Cprev.push(C); if (Cprev.length > 5) Cprev.shift();
    Pprev.push(P); if (Pprev.length > 5) Pprev.shift();
    cSeries.push(C); pSeries.push(P); dSeries.push(D);
  }
  return { C: cSeries, P: pSeries, D: dSeries };
}

export function runParameterSweep(): Array<{
  condition: string; k3: number; nicheSize: number;
  phi1: number; phi2: number; lambdaMod: number;
  rootType: string; patternClass: string;
}> {
  const results: any[] = [];
  const conditions = [
    { name: "normal", overrides: {} },
    { name: "FAP-like", overrides: { asymmetricProb: 0.3 } },
    { name: "adenoma-like", overrides: { asymmetricProb: 0.15, k1: 0.18, apoptosisRate: 0.02 } },
    { name: "strong_delay_feedback", overrides: { k1: 0.10, k3: 0.50, k4: 0.12, apoptosisRate: 0.08 } },
    { name: "balanced_oscillator", overrides: { k1: 0.08, k3: 0.40, k4: 0.15, apoptosisRate: 0.10, circadianAmplitude: 0.35 } },
  ];
  const k3Values = [0.05, 0.15, 0.30, 0.45, 0.60];
  const nicheSizes = [8, 16, 24];

  for (const cond of conditions) {
    for (const niche of nicheSizes) {
      for (const k3 of k3Values) {
        const params: BomanParams = {
          nicheSize: niche, maturationDelay: 5, divisionLimit: 5, asymmetricProb: 0.6,
          apoptosisRate: 0.05, sheddingRate: 0.12, wntStrength: 0.9,
          circadianGating: true, circadianAmplitude: 0.25, mutationRate: 0,
          condition: cond.name, k1: 0.12, k2: 0.15, k3, k4: 0.08, k5: 0.04,
          ...cond.overrides,
        };
        const { C } = runBomanSimulation(params);
        const fit = fitAR2(C);
        const { eigenvalue, isComplex } = solveEigenvalues(fit.phi1, fit.phi2);
        const pattern = classifyPattern(fit.phi1, fit.phi2, eigenvalue, cond.name);
        results.push({
          condition: cond.name, k3, nicheSize: niche,
          phi1: fit.phi1, phi2: fit.phi2, lambdaMod: eigenvalue,
          rootType: isComplex ? "complex" : "real", patternClass: pattern,
        });
      }
    }
  }
  return results;
}
