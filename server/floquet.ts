import { fitAR2WithDiagnostics } from './edge-case-diagnostics';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FloquetMultiplier {
  index: number;
  re: number;
  im: number;
  modulus: number;
  isTrivial: boolean;
  label: string;
}

export interface FloquetAR2Row {
  variable: string;
  ar2Lambda: number;
  floquetModulus: number;
  gap: number;
  gapPct: number;
}

export interface FloquetResult {
  supported: boolean;
  unsupportedReason?: string;
  modelId: string;
  modelName: string;
  period: number | null;
  periodUnit: string;
  floquetMultipliers: FloquetMultiplier[];
  ar2Comparison: FloquetAR2Row[];
  interpretation: string;
}

// ─── RK4 core ─────────────────────────────────────────────────────────────────

function rk4Step(
  f: (s: number[]) => number[],
  state: number[],
  dt: number
): number[] {
  const k1 = f(state);
  const s2 = state.map((s, i) => s + 0.5 * dt * k1[i]);
  const k2 = f(s2);
  const s3 = state.map((s, i) => s + 0.5 * dt * k2[i]);
  const k3 = f(s3);
  const s4 = state.map((s, i) => s + dt * k3[i]);
  const k4 = f(s4);
  return state.map((s, i) => s + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
}

// ─── ODE functions ────────────────────────────────────────────────────────────

function goodwinODE(state: number[], p: Record<string, number>): number[] {
  const [X, Y, Z] = state;
  const { k1, k2, k3, k4, k5, k6, n: hillN, K } = p;
  const Kn = Math.pow(K, hillN);
  const Zn = Math.pow(Z, hillN);
  const repression = Kn / (Kn + Zn);
  return [k1 * repression - k4 * X, k2 * X - k5 * Y, k3 * Y - k6 * Z];
}

function vanDerPolODE(state: number[], p: Record<string, number>): number[] {
  const [x, y] = state;
  const { mu } = p;
  return [y, mu * (1 - x * x) * y - x];
}

function fitzhughODE(state: number[], p: Record<string, number>): number[] {
  const [v, w] = state;
  const { a, b, tau, I_ext } = p;
  return [v - (v * v * v) / 3 - w + I_ext, (v + a - b * w) / tau];
}

function lotkaVolterraODE(state: number[], p: Record<string, number>): number[] {
  const [prey, predator] = state;
  const { alpha, beta, delta, gamma } = p;
  return [alpha * prey - beta * prey * predator, delta * prey * predator - gamma * predator];
}


// ─── Period detection ─────────────────────────────────────────────────────────
// Uses positive-going zero-crossing with linear interpolation across all state
// variables, then picks whichever variable gives the most consistent intervals
// (lowest coefficient of variation). This is far more accurate than peak
// detection for spiky signals like the Goodwin mRNA variable at high n.

function detectPeriod(allSeries: number[][], times: number[]): number | null {
  if (times.length < 20) return null;

  let bestPeriod: number | null = null;
  let bestCV = Infinity;

  for (const series of allSeries) {
    const mean = series.reduce((a, b) => a + b, 0) / series.length;
    const centered = series.map(v => v - mean);

    const crossTimes: number[] = [];
    for (let i = 0; i < centered.length - 1; i++) {
      if (centered[i] <= 0 && centered[i + 1] > 0) {
        const frac = -centered[i] / (centered[i + 1] - centered[i]);
        crossTimes.push(times[i] + frac * (times[i + 1] - times[i]));
      }
    }

    if (crossTimes.length < 3) continue;

    const intervals: number[] = [];
    for (let i = 1; i < crossTimes.length; i++) {
      intervals.push(crossTimes[i] - crossTimes[i - 1]);
    }

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((a, b) => a + (b - avgInterval) ** 2, 0) / intervals.length;
    const cv = Math.sqrt(variance) / avgInterval;

    if (cv < bestCV && avgInterval > 0) {
      bestCV = cv;
      bestPeriod = avgInterval;
    }
  }

  return bestPeriod;
}

// ─── Eigenvalue solvers ───────────────────────────────────────────────────────

interface Complex { re: number; im: number }

function modulus(c: Complex): number {
  return Math.sqrt(c.re * c.re + c.im * c.im);
}

function eigenvalues2x2(M: number[]): Complex[] {
  const tr = M[0] + M[3];
  const det = M[0] * M[3] - M[1] * M[2];
  const disc = tr * tr - 4 * det;
  if (disc >= 0) {
    const sq = Math.sqrt(disc);
    return [{ re: (tr + sq) / 2, im: 0 }, { re: (tr - sq) / 2, im: 0 }];
  }
  const sq = Math.sqrt(-disc);
  return [{ re: tr / 2, im: sq / 2 }, { re: tr / 2, im: -sq / 2 }];
}

function eigenvalues3x3(M: number[]): Complex[] {
  const tr = M[0] + M[4] + M[8];

  const m00 = M[4] * M[8] - M[5] * M[7];
  const m11 = M[0] * M[8] - M[2] * M[6];
  const m22 = M[0] * M[4] - M[1] * M[3];
  const sumMinors = m00 + m11 + m22;

  const det =
    M[0] * (M[4] * M[8] - M[5] * M[7]) -
    M[1] * (M[3] * M[8] - M[5] * M[6]) +
    M[2] * (M[3] * M[7] - M[4] * M[6]);

  const shift = tr / 3;
  const A = sumMinors - tr * tr / 3;
  const B = -2 * tr * tr * tr / 27 + tr * sumMinors / 3 - det;

  const Delta = -4 * A * A * A - 27 * B * B;
  const EPS = 1e-10;

  if (Delta > EPS) {
    const m = 2 * Math.sqrt(-A / 3);
    const cosArg = Math.max(-1, Math.min(1, -4 * B / (m * m * m)));
    const theta = Math.acos(cosArg) / 3;
    return [
      { re: m * Math.cos(theta) + shift, im: 0 },
      { re: m * Math.cos(theta - 2 * Math.PI / 3) + shift, im: 0 },
      { re: m * Math.cos(theta + 2 * Math.PI / 3) + shift, im: 0 },
    ];
  }

  if (Math.abs(Delta) <= EPS) {
    if (Math.abs(A) < EPS) {
      return [{ re: shift, im: 0 }, { re: shift, im: 0 }, { re: shift, im: 0 }];
    }
    const t1 = 3 * B / A;
    const t2 = -3 * B / (2 * A);
    return [{ re: t1 + shift, im: 0 }, { re: t2 + shift, im: 0 }, { re: t2 + shift, im: 0 }];
  }

  const disc2 = B * B / 4 + A * A * A / 27;
  const sqrtDisc = Math.sqrt(Math.abs(disc2));
  const u = Math.cbrt(-B / 2 + sqrtDisc);
  const v = Math.cbrt(-B / 2 - sqrtDisc);
  const realRoot = u + v + shift;
  const complexRe = -(u + v) / 2 + shift;
  const complexIm = (u - v) * Math.sqrt(3) / 2;
  return [
    { re: realRoot, im: 0 },
    { re: complexRe, im: complexIm },
    { re: complexRe, im: -complexIm },
  ];
}

// ─── Model config lookup ──────────────────────────────────────────────────────

interface ModelConfig {
  name: string;
  n: number;
  initialState: number[];
  defaultParams: Record<string, number>;
  ode: (s: number[], p: Record<string, number>) => number[];
  variables: string[];
  tMax: number;
  dt: number;
  burnIn: number;
}

function getModelConfig(modelId: string): ModelConfig | null {
  switch (modelId) {
    case 'goodwin':
      return {
        name: 'Goodwin Oscillator',
        n: 3,
        initialState: [1.0, 1.0, 1.0],
        defaultParams: { k1: 2, k2: 1.5, k3: 1.5, k4: 0.5, k5: 0.5, k6: 0.5, n: 10, K: 1.0 },
        ode: goodwinODE,
        variables: ['mRNA (X)', 'Protein (Y)', 'Inhibitor (Z)'],
        tMax: 300,
        dt: 0.005,
        burnIn: 50,
      };
    case 'van-der-pol':
      return {
        name: 'van der Pol Oscillator',
        n: 2,
        initialState: [0.5, 0.0],
        defaultParams: { mu: 1.0 },
        ode: vanDerPolODE,
        variables: ['Position (x)', 'Velocity (y)'],
        tMax: 200,
        dt: 0.005,
        burnIn: 40,
      };
    case 'fitzhugh-nagumo':
      return {
        name: 'FitzHugh-Nagumo',
        n: 2,
        initialState: [-1.0, -0.5],
        defaultParams: { a: 0.7, b: 0.8, tau: 12.5, I_ext: 0.5 },
        ode: fitzhughODE,
        variables: ['Membrane Potential (v)', 'Recovery Variable (w)'],
        tMax: 500,
        dt: 0.01,
        burnIn: 100,
      };
    case 'lotka-volterra':
      return {
        name: 'Lotka-Volterra',
        n: 2,
        initialState: [10, 5],
        defaultParams: { alpha: 1.1, beta: 0.4, delta: 0.1, gamma: 0.4 },
        ode: lotkaVolterraODE,
        variables: ['Cancer Cells (Prey)', 'Immune Cells (Predator)'],
        tMax: 200,
        dt: 0.005,
        burnIn: 20,
      };
    default:
      return null;
  }
}

// ─── Main computation ─────────────────────────────────────────────────────────

export function computeFloquetAnalysis(
  modelId: string,
  paramOverrides: Record<string, number>
): FloquetResult {
  const cfg = getModelConfig(modelId);

  if (!cfg) {
    return {
      supported: false,
      unsupportedReason: 'Floquet analysis is not implemented for this model (Tyson-Novak uses ultrasensitive switches that make numerical Jacobian evaluation unreliable).',
      modelId,
      modelName: 'Unknown',
      period: null,
      periodUnit: 'au',
      floquetMultipliers: [],
      ar2Comparison: [],
      interpretation: '',
    };
  }

  const params = { ...cfg.defaultParams, ...paramOverrides };
  const { n, ode: odeF } = cfg;

  // ── Phase 1: simulate to steady-state ──────────────────────────────────────
  let state = [...cfg.initialState];
  const dt = cfg.dt;
  const tMax = cfg.tMax;
  const burnIn = cfg.burnIn;

  const times: number[] = [];
  const series: number[][] = Array.from({ length: n }, () => []);
  let t = 0;
  let nextSample = 0;
  const sampleInterval = dt * 10;

  while (t <= tMax) {
    if (t >= nextSample - dt / 4) {
      times.push(t);
      for (let v = 0; v < n; v++) series[v].push(state[v]);
      nextSample += sampleInterval;
    }
    state = rk4Step((s) => odeF(s, params), state, dt);
    for (let v = 0; v < n; v++) {
      if (!isFinite(state[v])) state[v] = 0;
    }
    t += dt;
  }

  const burnIdx = times.findIndex(t => t >= burnIn);
  const startIdx = burnIdx >= 0 ? burnIdx : 0;
  const postBurnTimes = times.slice(startIdx);
  const postBurnSeries = series.map(s => s.slice(startIdx));

  // ── Phase 2: detect period ─────────────────────────────────────────────────
  const period = detectPeriod(postBurnSeries, postBurnTimes);

  if (!period || period < dt * 5) {
    return {
      supported: true,
      modelId,
      modelName: cfg.name,
      period: null,
      periodUnit: 'au',
      floquetMultipliers: [],
      ar2Comparison: [],
      interpretation: 'No sustained oscillation detected at these parameters — period could not be estimated. Floquet analysis requires a limit cycle.',
    };
  }

  // ── Phase 3: numerical monodromy matrix via flow-map differentiation ──────
  // M_ij ≈ (Φ(T; x₀ + ε·eⱼ) - Φ(T; x₀)) / ε
  // No Jacobian required — this is a direct finite-difference approximation
  // of the derivative of the period-T flow map at the base trajectory.
  // We use the final point of the burn-in trajectory as x₀ (well on the
  // limit cycle after many periods).

  const startState = postBurnSeries.map(s => s[s.length - 1]);

  const nSteps = Math.max(2000, Math.ceil(period / (dt * 0.5)));
  const dtFine = period / nSteps;
  const EPS_FD = 1e-6;

  function integrateOnePeriod(x0: number[]): number[] {
    let s = [...x0];
    for (let step = 0; step < nSteps; step++) {
      s = rk4Step((st) => odeF(st, params), s, dtFine);
      for (let i = 0; i < n; i++) if (!isFinite(s[i])) s[i] = 0;
    }
    return s;
  }

  const base = integrateOnePeriod(startState);
  const monodromy = new Array(n * n).fill(0);

  for (let j = 0; j < n; j++) {
    const perturbed = [...startState];
    perturbed[j] += EPS_FD;
    const pert = integrateOnePeriod(perturbed);
    for (let i = 0; i < n; i++) {
      monodromy[i * n + j] = (pert[i] - base[i]) / EPS_FD;
    }
  }

  // ── Phase 4: eigenvalues of monodromy matrix ──────────────────────────────
  let rawEigenvalues: Complex[];
  if (n === 2) {
    rawEigenvalues = eigenvalues2x2(monodromy);
  } else {
    rawEigenvalues = eigenvalues3x3(monodromy);
  }

  // Sort by modulus descending, mark the trivial one (closest to 1.0)
  const withMod = rawEigenvalues.map(e => ({ ...e, mod: modulus(e) }));
  withMod.sort((a, b) => b.mod - a.mod);

  // For autonomous systems one multiplier should be ≈ 1.0
  let trivialIdx = 0;
  let minDist = Infinity;
  for (let i = 0; i < withMod.length; i++) {
    const d = Math.abs(withMod[i].mod - 1.0);
    if (d < minDist) { minDist = d; trivialIdx = i; }
  }

  const floquetMultipliers: FloquetMultiplier[] = withMod.map((e, i) => ({
    index: i,
    re: parseFloat(e.re.toFixed(6)),
    im: parseFloat(e.im.toFixed(6)),
    modulus: parseFloat(e.mod.toFixed(6)),
    isTrivial: i === trivialIdx,
    label: i === trivialIdx ? 'Trivial (along orbit)' : `Non-trivial μ${i + 1}`,
  }));

  // ── Phase 5: AR(2) fits ───────────────────────────────────────────────────
  const nonTrivialMods = floquetMultipliers
    .filter(m => !m.isTrivial)
    .map(m => m.modulus);
  const dominantFloquetMod = nonTrivialMods.length > 0
    ? Math.max(...nonTrivialMods)
    : null;

  const ar2Comparison: FloquetAR2Row[] = cfg.variables.map((varName, idx) => {
    const ser = postBurnSeries[idx];
    const ar2 = fitAR2WithDiagnostics(ser);
    const lambda = ar2 ? ar2.eigenvalue : 0;
    const fm = dominantFloquetMod ?? 0;
    return {
      variable: varName,
      ar2Lambda: parseFloat(lambda.toFixed(5)),
      floquetModulus: parseFloat(fm.toFixed(5)),
      gap: parseFloat((lambda - fm).toFixed(5)),
      gapPct: parseFloat(((lambda - fm) / Math.max(lambda, 1e-6) * 100).toFixed(1)),
    };
  });

  // ── Phase 6: interpretation ───────────────────────────────────────────────
  const avgAR2 = ar2Comparison.reduce((a, b) => a + b.ar2Lambda, 0) / ar2Comparison.length;
  const avgGap = ar2Comparison.reduce((a, b) => a + b.gap, 0) / ar2Comparison.length;

  let interpretation: string;
  if (dominantFloquetMod === null) {
    interpretation = 'Could not compute dominant Floquet multiplier.';
  } else if (avgGap > 0.3) {
    interpretation = `Large gap (avg ${avgGap.toFixed(3)}): AR(2) |λ| ≈ ${avgAR2.toFixed(3)} captures longitudinal autocorrelation in the sustained oscillation; Floquet |μ| ≈ ${dominantFloquetMod.toFixed(3)} captures transverse orbital contraction. These measure complementary stability properties — the gap is expected and interpretable, not a failure of either method.`;
  } else if (avgGap > 0.1) {
    interpretation = `Moderate gap (avg ${avgGap.toFixed(3)}): AR(2) |λ| ≈ ${avgAR2.toFixed(3)} is somewhat above Floquet |μ| ≈ ${dominantFloquetMod.toFixed(3)}. Both capture real dynamical structure but at different stability scales.`;
  } else {
    interpretation = `Small gap (avg ${avgGap.toFixed(3)}): AR(2) |λ| ≈ ${avgAR2.toFixed(3)} and Floquet |μ| ≈ ${dominantFloquetMod.toFixed(3)} are closer than expected. This may indicate that at these parameters, the orbital contraction timescale aligns with the autocorrelation decay timescale.`;
  }

  return {
    supported: true,
    modelId,
    modelName: cfg.name,
    period: parseFloat(period.toFixed(3)),
    periodUnit: 'au',
    floquetMultipliers,
    ar2Comparison,
    interpretation,
  };
}
