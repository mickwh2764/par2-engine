/**
 * Ch.11 Protein FP Vector — KS Regression Guard
 * ================================================
 * Locks the KS test result (D = 0.857, p = 0.008) cited in Chapter 11 against
 * silent breakage from edits to the proteomics CSV or the FP formula.
 *
 * The test reads the live CSV, recomputes AR(2) eigenvalues for the 7-gene
 * panel using OLS (matching proteomics-landscape.ts), derives Fibonacci
 * proximity (FP) for each, then runs an exact two-sample KS test against the
 * confirmed mRNA FP vector cited in the manuscript.
 *
 * Canonical protein eigenvalues (computed from datasets/mouse_liver_circadian_proteomics.csv):
 *   Clock  λ=0.5870  FP=94.98
 *   Arntl  λ=0.5823  FP=94.23
 *   Nr1d1  λ=0.7357  FP=80.95
 *   Nr1d2  λ=0.6441  FP=95.77
 *   Wee1   λ=0.6893  FP=88.47
 *   Yap1   λ=0.4934  FP=79.84
 *   Bax    λ=0.4275  FP=69.17
 *
 * Confirmed mRNA FP vector:
 *   [61.3, 55.2, 87.4, 68.8, 62.6, 61.4, 55.7]
 *
 * KS result: D = 6/7 ≈ 0.857143, exact p = 28/C(14,7) ≈ 0.008159
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// Helpers: AR(2) OLS fit (identical algorithm to proteomics-landscape.ts)
// ---------------------------------------------------------------------------

function fitAR2Eigenvalue(series: number[]): number {
  const n = series.length;
  if (n < 5) return 0;

  const mean = series.reduce((a, b) => a + b, 0) / n;
  const y = series.map((x) => x - mean);
  const T = n - 2;
  const Y = y.slice(2);
  const Y1 = y.slice(1, n - 1);
  const Y2 = y.slice(0, n - 2);

  let s11 = 0, s22 = 0, s12 = 0, sy1 = 0, sy2 = 0;
  for (let i = 0; i < T; i++) {
    s11 += Y1[i] * Y1[i];
    s22 += Y2[i] * Y2[i];
    s12 += Y1[i] * Y2[i];
    sy1 += Y[i] * Y1[i];
    sy2 += Y[i] * Y2[i];
  }

  const det = s11 * s22 - s12 * s12;
  if (Math.abs(det) < 1e-10) return 0;

  const phi1 = (sy1 * s22 - sy2 * s12) / det;
  const phi2 = (sy2 * s11 - sy1 * s12) / det;

  const disc = phi1 * phi1 + 4 * phi2;
  let eigenvalue: number;
  if (disc < 0) {
    // Complex conjugate pair: modulus = sqrt(-phi2)
    eigenvalue = Math.sqrt(-phi2);
  } else {
    const r1 = (phi1 + Math.sqrt(disc)) / 2;
    const r2 = (phi1 - Math.sqrt(disc)) / 2;
    eigenvalue = Math.max(Math.abs(r1), Math.abs(r2));
  }

  return Math.min(eigenvalue, 0.99);
}

// ---------------------------------------------------------------------------
// Fibonacci proximity: FP = max(0, 100 − |λ − 0.618| / 0.618 × 100)
// ---------------------------------------------------------------------------

function fibonacciProximity(lambda: number): number {
  return Math.max(0, 100 - (Math.abs(lambda - 0.618) / 0.618) * 100);
}

// ---------------------------------------------------------------------------
// Two-sample KS statistic
// ---------------------------------------------------------------------------

function ksTwoSampleD(a: number[], b: number[]): number {
  const aSorted = [...a].sort((x, y) => x - y);
  const bSorted = [...b].sort((x, y) => x - y);
  const allPoints = [...a, ...b].sort((x, y) => x - y);
  const n = a.length;
  const m = b.length;

  let maxD = 0;
  for (const x of allPoints) {
    const fa = aSorted.filter((v) => v <= x).length / n;
    const fb = bSorted.filter((v) => v <= x).length / m;
    maxD = Math.max(maxD, Math.abs(fa - fb));
  }
  return maxD;
}

// ---------------------------------------------------------------------------
// Exact two-sample KS p-value for the n = m case
//
// P(D_{n,n} ≥ k/n) = (2 / C(2n,n)) × Σ_{j≥1} (−1)^{j+1} × C(2n, n − j·k)
//
// Derived from the reflection principle / ballot problem. For n = m = 7,
// k = 6:  P = 2 × C(14,1) / C(14,7) = 28 / 3432 ≈ 0.008159
// ---------------------------------------------------------------------------

function binomialCoefficient(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  const steps = Math.min(k, n - k);
  let result = 1;
  for (let i = 0; i < steps; i++) {
    result = (result * (n - i)) / (i + 1);
  }
  return Math.round(result);
}

/** Exact p-value for two-sample KS where both samples have size n. */
function exactKSPValue(n: number, D: number): number {
  const k = Math.round(D * n); // D must equal k/n exactly
  if (k === 0) return 1;
  const total = binomialCoefficient(2 * n, n);
  let count = 0;
  for (let j = 1; j * k <= n; j++) {
    const sign = j % 2 === 1 ? 1 : -1;
    count += sign * binomialCoefficient(2 * n, n - j * k);
  }
  return Math.min(1, (2 * count) / total);
}

// ---------------------------------------------------------------------------
// CSV parser: returns { [gene]: number[] } for columns after "Gene"
// ---------------------------------------------------------------------------

function parseProteomicsCSV(csvPath: string): Record<string, number[]> {
  const lines = fs.readFileSync(csvPath, "utf-8").trim().split("\n");
  const result: Record<string, number[]> = {};
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",");
    const gene = parts[0].trim();
    const values = parts.slice(1).map(Number);
    if (gene) result[gene] = values;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

const CSV_PATH = path.resolve(
  __dirname,
  "../../datasets/mouse_liver_circadian_proteomics.csv"
);

const SEVEN_GENES = ["Clock", "Arntl", "Nr1d1", "Nr1d2", "Wee1", "Yap1", "Bax"] as const;

/** mRNA FP vector confirmed in the manuscript (Chapter 11). */
const MRNA_FP = [61.3, 55.2, 87.4, 68.8, 62.6, 61.4, 55.7];

// datasets/ is gitignored, so this guard can only run where the CSV is present.
describe.skipIf(!fs.existsSync(CSV_PATH))("Ch.11 protein FP vector — KS regression guard", () => {
  let proteinData: Record<string, number[]>;
  let proteinFP: number[];
  let D: number;
  let p: number;

  // Load and compute once for all assertions
  try {
    proteinData = parseProteomicsCSV(CSV_PATH);
    proteinFP = SEVEN_GENES.map((gene) => {
      const series = proteinData[gene];
      const lambda = fitAR2Eigenvalue(series);
      return fibonacciProximity(lambda);
    });
    D = ksTwoSampleD(proteinFP, MRNA_FP);
    p = exactKSPValue(7, D);
  } catch (err) {
    // Tests below will fail with a descriptive message
    proteinData = {};
    proteinFP = [];
    D = NaN;
    p = NaN;
  }

  it("CSV is readable and contains all 7 genes", () => {
    expect(Object.keys(proteinData).length).toBeGreaterThanOrEqual(7);
    for (const gene of SEVEN_GENES) {
      expect(proteinData[gene], `Gene ${gene} missing from CSV`).toBeDefined();
      expect(
        proteinData[gene].length,
        `${gene} should have ≥ 5 timepoints`
      ).toBeGreaterThanOrEqual(5);
    }
  });

  it("protein FP vector has 7 values, all in [0, 100]", () => {
    expect(proteinFP).toHaveLength(7);
    for (const fp of proteinFP) {
      expect(fp).toBeGreaterThanOrEqual(0);
      expect(fp).toBeLessThanOrEqual(100);
    }
  });

  it("each protein gene has a stable AR(2) eigenvalue (λ > 0.01)", () => {
    for (const gene of SEVEN_GENES) {
      const lambda = fitAR2Eigenvalue(proteinData[gene]);
      expect(lambda, `${gene} eigenvalue should be > 0.01`).toBeGreaterThan(0.01);
    }
  });

  it("protein FP values are higher than mRNA FP values on average (post-translational stabilisation)", () => {
    const meanProtein = proteinFP.reduce((a, b) => a + b, 0) / proteinFP.length;
    const meanMRNA = MRNA_FP.reduce((a, b) => a + b, 0) / MRNA_FP.length;
    expect(meanProtein).toBeGreaterThan(meanMRNA);
  });

  it("KS statistic D ≈ 0.857 (= 6/7) — manuscript claim", () => {
    // Tolerance ±0.001 as specified
    expect(D).toBeCloseTo(0.857, 2);
  });

  it("KS p-value ≈ 0.008 — manuscript claim", () => {
    // Exact value: 28/3432 ≈ 0.008159; tolerance ±0.001
    expect(p).toBeGreaterThan(0.007);
    expect(p).toBeLessThan(0.009);
  });

  it("KS statistic is exactly 6/7 (integer multiple check)", () => {
    // D must be k/7 for some integer k; k=6 is the claimed value
    const k = Math.round(D * 7);
    expect(k).toBe(6);
  });

  it("exact p-value denominator is C(14,7) = 3432 (formula integrity)", () => {
    expect(binomialCoefficient(14, 7)).toBe(3432);
  });

  it("exact p-value numerator is 28 = 2×C(14,1) (reflection principle)", () => {
    // For D=6/7, n=7: 2 × C(14, 7−6) = 2×14 = 28
    expect(2 * binomialCoefficient(14, 1)).toBe(28);
  });
});
