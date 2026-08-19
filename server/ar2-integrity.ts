/**
 * AR(2) engine integrity self-test.
 *
 * Generates a pure cosine with period 10 samples — the one case where
 * the theoretical AR(2) coefficients are known exactly:
 *
 *   x_t = cos(2π·t/10)
 *   ⟹  φ₁ = 2cos(2π/10) = 2cos(36°) = (1+√5)/2 = φ  ≈ 1.6180
 *       φ₂ = −1
 *       |λ| = 1.0000 (neutrally stable)
 *       R²  = 1.0000 (perfect fit)
 *
 * This is not a contrived test: it is the mathematical statement that
 * a time series with Fibonacci-like temporal structure produces AR(2)
 * coefficients at the golden ratio. If this test fails, every |λ|
 * result on the platform is suspect.
 */

export interface IntegrityResult {
  passed: boolean;
  phi1_expected: number;
  phi1_actual: number;
  phi1_error: number;
  phi2_expected: number;
  phi2_actual: number;
  phi2_error: number;
  r2_actual: number;
  lambda_modulus: number;
  tolerance: number;
  message: string;
}

function fitAR2(raw: number[]): { phi1: number; phi2: number; r2: number } {
  const mean = raw.reduce((a, b) => a + b, 0) / raw.length;
  const series = raw.map(x => x - mean);
  let sX1X1 = 0, sX2X2 = 0, sX1X2 = 0, sYX1 = 0, sYX2 = 0, sYY = 0;
  for (let i = 2; i < series.length; i++) {
    const y = series[i], x1 = series[i - 1], x2 = series[i - 2];
    sX1X1 += x1 * x1; sX2X2 += x2 * x2; sX1X2 += x1 * x2;
    sYX1  += y * x1;  sYX2  += y * x2;  sYY   += y * y;
  }
  const det = sX1X1 * sX2X2 - sX1X2 * sX1X2;
  if (Math.abs(det) < 1e-14) return { phi1: 0, phi2: 0, r2: 0 };
  const phi1 = (sX2X2 * sYX1 - sX1X2 * sYX2) / det;
  const phi2 = (sX1X1 * sYX2 - sX1X2 * sYX1) / det;
  const ssRes = sYY - phi1 * sYX1 - phi2 * sYX2;
  const r2 = sYY > 0 ? Math.max(0, Math.min(1, 1 - ssRes / sYY)) : 0;
  return { phi1, phi2, r2 };
}

export function runIntegrityCheck(): IntegrityResult {
  const GOLDEN_RATIO = (1 + Math.sqrt(5)) / 2;
  const PERIOD = 10;
  const N = 500;  // many samples for numerical precision
  const TOLERANCE = 1e-4;

  // Generate x_t = cos(2πt/10)
  const series: number[] = [];
  for (let t = 0; t < N; t++) {
    series.push(Math.cos((2 * Math.PI * t) / PERIOD));
  }

  const { phi1, phi2, r2 } = fitAR2(series);

  // Eigenvalue modulus: roots of z² − φ₁z − φ₂ = 0
  // Discriminant: φ₁² + 4φ₂ (expect negative → complex)
  const disc = phi1 * phi1 + 4 * phi2;
  let modulus: number;
  if (disc < 0) {
    const re = phi1 / 2;
    const im = Math.sqrt(-disc) / 2;
    modulus = Math.sqrt(re * re + im * im);
  } else {
    const r1 = (phi1 + Math.sqrt(disc)) / 2;
    const r2val = (phi1 - Math.sqrt(disc)) / 2;
    modulus = Math.max(Math.abs(r1), Math.abs(r2val));
  }

  const phi1_error = Math.abs(phi1 - GOLDEN_RATIO);
  const phi2_error = Math.abs(phi2 - (-1));
  const passed = phi1_error < TOLERANCE && phi2_error < TOLERANCE && r2 > 0.9999;

  return {
    passed,
    phi1_expected: GOLDEN_RATIO,
    phi1_actual: phi1,
    phi1_error,
    phi2_expected: -1,
    phi2_actual: phi2,
    phi2_error,
    r2_actual: r2,
    lambda_modulus: modulus,
    tolerance: TOLERANCE,
    message: passed
      ? `AR(2) engine PASS: fitted φ₁=${phi1.toFixed(6)} (expected ${GOLDEN_RATIO.toFixed(6)}), φ₂=${phi2.toFixed(6)} (expected −1), R²=${r2.toFixed(6)}, |λ|=${modulus.toFixed(6)}.`
      : `AR(2) engine FAIL: φ₁ error=${phi1_error.toFixed(6)}, φ₂ error=${phi2_error.toFixed(6)} — exceeds tolerance ${TOLERANCE}. Engine output cannot be trusted.`,
  };
}
