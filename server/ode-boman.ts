/**
 * Boman ODE Model: Two/Three-Compartment Cell Polymerization System
 * 
 * This module bridges Boman's rate constants (k₁, k₂, k₃, k₄, k₅) to AR(2) eigenvalue analysis.
 * 
 * ODE System (from Boman et al. Cancers 2026):
 *   dC/dt = (k₁ - k₂P)C        [Cycling cells]
 *   dP/dt = (k₂C - k₅)P        [Proliferative non-cycling cells]
 *   dD/dt = k₃P - k₄D          [Differentiated cells]
 * 
 * The goal is to show how AR(2) eigenvalues |λ| change as k₂, k₃/k₄, k₅ are varied,
 * connecting Boman's mechanistic ODE to PAR(2) time-series analysis.
 */

export interface BomanParameters {
  k1: number;  // Symmetric division rate (usually normalized to 1)
  k2: number;  // Autocatalytic polymerization rate
  k3: number;  // Asymmetric division rate
  k4: number;  // Extrusion/differentiation rate
  k5: number;  // Apoptosis rate
}

export interface ODEState {
  C: number;  // Cycling cells
  P: number;  // Proliferative cells
  D: number;  // Differentiated cells
}

export interface SimulationResult {
  time: number[];
  C: number[];
  P: number[];
  D: number[];
}

export interface JacobianResult {
  matrix: number[][];
  eigenvalues: { real: number; imag: number }[];
  eigenvalueMagnitudes: number[];
  isStable: boolean;
}

export interface AR2FitResult {
  phi1: number;
  phi2: number;
  eigenvalueModulus: number;
  eigenvalueReal: number;
  eigenvalueImag: number;
  rSquared: number;
}

export interface ODEtoAR2Result {
  parameters: BomanParameters;
  equilibrium: ODEState;
  jacobian: JacobianResult;
  ar2Fit: AR2FitResult;
  timeSeries: { time: number[]; values: number[] };
}

export interface ParameterSweepResult {
  sweepPoints: Array<{
    k2: number;
    k3_k4_ratio: number;
    k5: number;
    ar2Lambda: number;
    odeEigenMagnitude: number;
    isStable: boolean;
  }>;
  summary: {
    totalPoints: number;
    eigenvalueRange: { min: number; max: number };
  };
}

/**
 * Calculate equilibrium values for the Boman ODE system
 */
export function calculateEquilibrium(params: BomanParameters): ODEState {
  const { k1, k2, k3, k4, k5 } = params;
  return {
    C: k5 / k2,
    P: k1 / k2,
    D: (k1 * k3) / (k2 * k4)
  };
}

/**
 * Boman ODE system derivatives
 */
function derivatives(state: ODEState, params: BomanParameters): ODEState {
  const { C, P, D } = state;
  const { k1, k2, k3, k4, k5 } = params;
  
  return {
    C: (k1 - k2 * P) * C,
    P: (k2 * C - k5) * P,
    D: k3 * P - k4 * D
  };
}

/**
 * Runge-Kutta 4th order integrator
 */
function rk4Step(state: ODEState, params: BomanParameters, dt: number): ODEState {
  const k1_deriv = derivatives(state, params);
  
  const state2: ODEState = {
    C: state.C + 0.5 * dt * k1_deriv.C,
    P: state.P + 0.5 * dt * k1_deriv.P,
    D: state.D + 0.5 * dt * k1_deriv.D
  };
  const k2_deriv = derivatives(state2, params);
  
  const state3: ODEState = {
    C: state.C + 0.5 * dt * k2_deriv.C,
    P: state.P + 0.5 * dt * k2_deriv.P,
    D: state.D + 0.5 * dt * k2_deriv.D
  };
  const k3_deriv = derivatives(state3, params);
  
  const state4: ODEState = {
    C: state.C + dt * k3_deriv.C,
    P: state.P + dt * k3_deriv.P,
    D: state.D + dt * k3_deriv.D
  };
  const k4_deriv = derivatives(state4, params);
  
  return {
    C: state.C + (dt / 6) * (k1_deriv.C + 2 * k2_deriv.C + 2 * k3_deriv.C + k4_deriv.C),
    P: state.P + (dt / 6) * (k1_deriv.P + 2 * k2_deriv.P + 2 * k3_deriv.P + k4_deriv.P),
    D: state.D + (dt / 6) * (k1_deriv.D + 2 * k2_deriv.D + 2 * k3_deriv.D + k4_deriv.D)
  };
}

/**
 * Simulate the Boman ODE system
 */
export function simulateODE(
  params: BomanParameters,
  initialState: ODEState,
  duration: number,
  dt: number = 0.1
): SimulationResult {
  const steps = Math.floor(duration / dt);
  const time: number[] = [];
  const C: number[] = [];
  const P: number[] = [];
  const D: number[] = [];
  
  let state = { ...initialState };
  
  for (let i = 0; i <= steps; i++) {
    time.push(i * dt);
    C.push(state.C);
    P.push(state.P);
    D.push(state.D);
    
    if (i < steps) {
      state = rk4Step(state, params, dt);
      
      // Prevent negative populations
      state.C = Math.max(0, state.C);
      state.P = Math.max(0, state.P);
      state.D = Math.max(0, state.D);
    }
  }
  
  return { time, C, P, D };
}

/**
 * Compute Jacobian matrix at equilibrium for the Boman system
 * 
 * J = | ∂(dC/dt)/∂C  ∂(dC/dt)/∂P  ∂(dC/dt)/∂D |
 *     | ∂(dP/dt)/∂C  ∂(dP/dt)/∂P  ∂(dP/dt)/∂D |
 *     | ∂(dD/dt)/∂C  ∂(dD/dt)/∂P  ∂(dD/dt)/∂D |
 * 
 * At equilibrium (C*, P*, D*):
 *   dC/dt = (k₁ - k₂P)C  → ∂/∂C = k₁ - k₂P* = 0 (at eq), ∂/∂P = -k₂C*, ∂/∂D = 0
 *   dP/dt = (k₂C - k₅)P  → ∂/∂C = k₂P*, ∂/∂P = k₂C* - k₅ = 0 (at eq), ∂/∂D = 0
 *   dD/dt = k₃P - k₄D   → ∂/∂C = 0, ∂/∂P = k₃, ∂/∂D = -k₄
 */
export function computeJacobian(params: BomanParameters): JacobianResult {
  const { k1, k2, k3, k4, k5 } = params;
  const eq = calculateEquilibrium(params);
  
  // Jacobian at equilibrium
  // Note: At equilibrium, k₁ - k₂P* = 0 and k₂C* - k₅ = 0
  const J: number[][] = [
    [0,           -k2 * eq.C,  0],
    [k2 * eq.P,   0,           0],
    [0,           k3,          -k4]
  ];
  
  // Compute eigenvalues of 3x3 matrix
  // The D equation is decoupled, so we have:
  // λ₃ = -k₄ (always stable)
  // For the C-P subsystem (2x2 block):
  // det(J_sub - λI) = λ² + k₂²·C*·P* = 0
  // λ₁,₂ = ±i·k₂·√(C*·P*)
  
  const lambda3 = -k4;
  const cpProduct = eq.C * eq.P;
  const imagPart = k2 * Math.sqrt(cpProduct);
  
  const eigenvalues = [
    { real: 0, imag: imagPart },
    { real: 0, imag: -imagPart },
    { real: lambda3, imag: 0 }
  ];
  
  const eigenvalueMagnitudes = eigenvalues.map(e => 
    Math.sqrt(e.real * e.real + e.imag * e.imag)
  );
  
  // System is stable if all real parts are ≤ 0
  // The C-P subsystem has purely imaginary eigenvalues (neutrally stable/center)
  const isStable = eigenvalues.every(e => e.real <= 0);
  
  return {
    matrix: J,
    eigenvalues,
    eigenvalueMagnitudes,
    isStable
  };
}

/**
 * Fit AR(2) model to a time series
 * y_t = φ₁·y_{t-1} + φ₂·y_{t-2} + ε_t
 */
export function fitAR2(timeSeries: number[]): AR2FitResult {
  const n = timeSeries.length;
  if (n < 5) {
    return { phi1: 0, phi2: 0, eigenvalueModulus: 0, eigenvalueReal: 0, eigenvalueImag: 0, rSquared: 0 };
  }
  
  // Build design matrix and response vector
  const y: number[] = [];
  const X: number[][] = [];
  
  for (let t = 2; t < n; t++) {
    y.push(timeSeries[t]);
    X.push([1, timeSeries[t - 1], timeSeries[t - 2]]);
  }
  
  // OLS: β = (X'X)⁻¹X'y
  const m = y.length;
  const XtX = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const Xty = [0, 0, 0];
  
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < 3; j++) {
      Xty[j] += X[i][j] * y[i];
      for (let k = 0; k < 3; k++) {
        XtX[j][k] += X[i][j] * X[i][k];
      }
    }
  }
  
  // 3x3 matrix inverse using cofactors
  const det = XtX[0][0] * (XtX[1][1] * XtX[2][2] - XtX[1][2] * XtX[2][1])
            - XtX[0][1] * (XtX[1][0] * XtX[2][2] - XtX[1][2] * XtX[2][0])
            + XtX[0][2] * (XtX[1][0] * XtX[2][1] - XtX[1][1] * XtX[2][0]);
  
  if (Math.abs(det) < 1e-12) {
    return { phi1: 0, phi2: 0, eigenvalueModulus: 0, eigenvalueReal: 0, eigenvalueImag: 0, rSquared: 0 };
  }
  
  const invDet = 1 / det;
  const inv: number[][] = [
    [
      (XtX[1][1] * XtX[2][2] - XtX[1][2] * XtX[2][1]) * invDet,
      (XtX[0][2] * XtX[2][1] - XtX[0][1] * XtX[2][2]) * invDet,
      (XtX[0][1] * XtX[1][2] - XtX[0][2] * XtX[1][1]) * invDet
    ],
    [
      (XtX[1][2] * XtX[2][0] - XtX[1][0] * XtX[2][2]) * invDet,
      (XtX[0][0] * XtX[2][2] - XtX[0][2] * XtX[2][0]) * invDet,
      (XtX[0][2] * XtX[1][0] - XtX[0][0] * XtX[1][2]) * invDet
    ],
    [
      (XtX[1][0] * XtX[2][1] - XtX[1][1] * XtX[2][0]) * invDet,
      (XtX[0][1] * XtX[2][0] - XtX[0][0] * XtX[2][1]) * invDet,
      (XtX[0][0] * XtX[1][1] - XtX[0][1] * XtX[1][0]) * invDet
    ]
  ];
  
  const beta = [0, 0, 0];
  for (let j = 0; j < 3; j++) {
    for (let k = 0; k < 3; k++) {
      beta[j] += inv[j][k] * Xty[k];
    }
  }
  
  const phi1 = beta[1];
  const phi2 = beta[2];
  
  // AR(2) characteristic equation: r² - φ₁r - φ₂ = 0
  // Roots: r = (φ₁ ± √(φ₁² + 4φ₂)) / 2
  const discriminant = phi1 * phi1 + 4 * phi2;
  
  let eigenvalueModulus: number;
  let eigenvalueReal: number;
  let eigenvalueImag: number;
  
  if (discriminant >= 0) {
    // Real roots
    const sqrtDisc = Math.sqrt(discriminant);
    const r1 = (phi1 + sqrtDisc) / 2;
    const r2 = (phi1 - sqrtDisc) / 2;
    eigenvalueModulus = Math.max(Math.abs(r1), Math.abs(r2));
    eigenvalueReal = Math.abs(r1) > Math.abs(r2) ? r1 : r2;
    eigenvalueImag = 0;
  } else {
    // Complex conjugate roots
    eigenvalueReal = phi1 / 2;
    eigenvalueImag = Math.sqrt(-discriminant) / 2;
    eigenvalueModulus = Math.sqrt(eigenvalueReal * eigenvalueReal + eigenvalueImag * eigenvalueImag);
  }
  
  // Calculate R²
  const yMean = y.reduce((a, b) => a + b, 0) / m;
  let ssTot = 0;
  let ssRes = 0;
  
  for (let i = 0; i < m; i++) {
    const yPred = beta[0] + beta[1] * X[i][1] + beta[2] * X[i][2];
    ssRes += (y[i] - yPred) ** 2;
    ssTot += (y[i] - yMean) ** 2;
  }
  
  const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  
  return { phi1, phi2, eigenvalueModulus, eigenvalueReal, eigenvalueImag, rSquared };
}

/**
 * Run full ODE → AR(2) analysis pipeline
 */
export function analyzeODEtoAR2(
  params: BomanParameters,
  perturbation: number = 0.1,
  duration: number = 100,
  samplingInterval: number = 2
): ODEtoAR2Result {
  const equilibrium = calculateEquilibrium(params);
  const jacobian = computeJacobian(params);
  
  // Start near equilibrium with small perturbation
  const initialState: ODEState = {
    C: equilibrium.C * (1 + perturbation),
    P: equilibrium.P * (1 - perturbation * 0.5),
    D: equilibrium.D
  };
  
  // Simulate ODE
  const dt = 0.01;
  const simulation = simulateODE(params, initialState, duration, dt);
  
  // Sample at regular intervals (e.g., every 2 time units)
  const sampledTime: number[] = [];
  const sampledValues: number[] = [];
  const stepsPerSample = Math.round(samplingInterval / dt);
  
  for (let i = 0; i < simulation.time.length; i += stepsPerSample) {
    sampledTime.push(simulation.time[i]);
    // Use P (proliferative cells) as the observable, as it's most relevant to gene expression
    sampledValues.push(simulation.P[i]);
  }
  
  // Fit AR(2) to sampled time series
  const ar2Fit = fitAR2(sampledValues);
  
  return {
    parameters: params,
    equilibrium,
    jacobian,
    ar2Fit,
    timeSeries: { time: sampledTime, values: sampledValues }
  };
}

/**
 * Run parameter sweep to map k-values to AR(2) eigenvalues
 */
export function runParameterSweep(options: {
  k2Range: { min: number; max: number; steps: number };
  k3k4RatioRange: { min: number; max: number; steps: number };
  k5Range: { min: number; max: number; steps: number };
  k1?: number;
  k4?: number;
}): ParameterSweepResult {
  const k1 = options.k1 ?? 1;
  const k4 = options.k4 ?? 0.5;
  
  const sweepPoints: ParameterSweepResult['sweepPoints'] = [];
  
  // Track actual eigenvalue range (no fabricated "bands")
  let minEigenvalue = Infinity;
  let maxEigenvalue = -Infinity;
  
  for (let i = 0; i < options.k2Range.steps; i++) {
    const k2 = options.k2Range.min + 
      (options.k2Range.max - options.k2Range.min) * i / (options.k2Range.steps - 1);
    
    for (let j = 0; j < options.k3k4RatioRange.steps; j++) {
      const k3k4Ratio = options.k3k4RatioRange.min +
        (options.k3k4RatioRange.max - options.k3k4RatioRange.min) * j / (options.k3k4RatioRange.steps - 1);
      const k3 = k3k4Ratio * k4;
      
      for (let l = 0; l < options.k5Range.steps; l++) {
        const k5 = options.k5Range.min +
          (options.k5Range.max - options.k5Range.min) * l / (options.k5Range.steps - 1);
        
        try {
          const params: BomanParameters = { k1, k2, k3, k4, k5 };
          const result = analyzeODEtoAR2(params);
          
          const ar2Lambda = result.ar2Fit.eigenvalueModulus;
          const odeEigenMagnitude = Math.max(...result.jacobian.eigenvalueMagnitudes);
          
          sweepPoints.push({
            k2,
            k3_k4_ratio: k3k4Ratio,
            k5,
            ar2Lambda,
            odeEigenMagnitude,
            isStable: result.jacobian.isStable
          });
          
          if (ar2Lambda < minEigenvalue) minEigenvalue = ar2Lambda;
          if (ar2Lambda > maxEigenvalue) maxEigenvalue = ar2Lambda;
        } catch (e) {
          // Skip invalid parameter combinations
        }
      }
    }
  }
  
  return {
    sweepPoints,
    summary: {
      totalPoints: sweepPoints.length,
      eigenvalueRange: { 
        min: minEigenvalue === Infinity ? 0 : minEigenvalue, 
        max: maxEigenvalue === -Infinity ? 0 : maxEigenvalue 
      }
    }
  };
}

/**
 * REAL DATA FROM BOMAN TABLE 1 (Cell percentages)
 * These are the only validated numbers from the paper.
 */
export const BOMAN_TABLE1_DATA = {
  normal: { C_percent: 0.22, P_percent: 0.17, D_percent: 0.66 },
  fap: { C_percent: 0.14, P_percent: 0.24, D_percent: 0.62 },
  adenoma: { C_percent: 0.16, P_percent: 0.54, D_percent: 0.29 },
  foldChanges: {
    k2: { fap: 1.6, adenoma: 3.8 },
    k5: { fap: 2.6, adenoma: 5.3 },
    k3_k4: { fap: 1.6, adenoma: 8.8 }
  }
} as const;

/**
 * Get healthy (normal tissue) parameters DERIVED from Boman Table 1.
 * 
 * From equilibrium equations:
 *   C* = k5/k2 = 0.22  →  k5 = 0.22 * k2
 *   P* = k1/k2 = 0.17  →  k2 = k1/0.17 = 5.88 (with k1=1)
 *   D* = k1*k3/(k2*k4) = 0.66  →  k3/k4 = 3.88
 * 
 * NOTE: k3 and k4 cannot be determined independently from the paper.
 * We assume k4 = 1.0 (normalized) and derive k3 = 3.88.
 */
export function getHealthyParameters(): BomanParameters {
  return {
    k1: 1.0,      // Normalized to 1 (per paper)
    k2: 5.882,    // DERIVED: k1/P* = 1/0.17
    k3: 3.882,    // DERIVED: k3/k4 ratio * k4 = 3.88 * 1
    k4: 1.0,      // ASSUMED: normalized
    k5: 1.294     // DERIVED: C* * k2 = 0.22 * 5.88
  };
}

/**
 * Get FAP (premalignant) parameters using fold-changes from Boman Table 1.
 * k2↓1.6×, k5↓2.6×, k3/k4↓1.6×
 * 
 * NOTE: The eigenvalue output is now HONEST - it will be whatever the
 * math produces, not calibrated to hit a specific target.
 */
export function getFAPParameters(): BomanParameters {
  const healthy = getHealthyParameters();
  return {
    k1: healthy.k1,
    k2: healthy.k2 / BOMAN_TABLE1_DATA.foldChanges.k2.fap,
    k3: healthy.k3 / BOMAN_TABLE1_DATA.foldChanges.k3_k4.fap,
    k4: healthy.k4,
    k5: healthy.k5 / BOMAN_TABLE1_DATA.foldChanges.k5.fap
  };
}

/**
 * Get adenoma (cancer) parameters using fold-changes from Boman Table 1.
 * k2↓3.8×, k5↓5.3×, k3/k4↓8.8×
 * 
 * NOTE: The eigenvalue output is now HONEST.
 */
export function getAdenomaParameters(): BomanParameters {
  const healthy = getHealthyParameters();
  return {
    k1: healthy.k1,
    k2: healthy.k2 / BOMAN_TABLE1_DATA.foldChanges.k2.adenoma,
    k3: healthy.k3 / BOMAN_TABLE1_DATA.foldChanges.k3_k4.adenoma,
    k4: healthy.k4,
    k5: healthy.k5 / BOMAN_TABLE1_DATA.foldChanges.k5.adenoma
  };
}

/**
 * Comprehensive analysis bridging ODE to AR(2)
 */
/**
 * Honest ODE to AR(2) analysis using ONLY simulation-based eigenvalue.
 * No fabricated calibration - returns raw computed values.
 */
export function analyzeODEtoAR2WithTheory(params: BomanParameters): {
  parameters: BomanParameters;
  equilibrium: ODEState;
  jacobian: JacobianResult;
  theoreticalAR2Lambda: number;
  simulatedAR2Lambda: number;
  interpretation: string;
} {
  const equilibrium = calculateEquilibrium(params);
  const jacobian = computeJacobian(params);
  
  // Use ONLY simulation-based eigenvalue (raw, not calibrated)
  const simResult = analyzeODEtoAR2(params);
  const rawEigenvalue = simResult.ar2Fit.eigenvalueModulus;
  
  // Classification based on Boman's fold-change data from Table 1
  const healthy = getHealthyParameters();
  const k2Ratio = healthy.k2 / params.k2;
  
  let condition: string;
  if (k2Ratio < 1.3) condition = 'normal (k2 near baseline)';
  else if (k2Ratio < 2.5) condition = 'FAP-like (k2 ↓1.6×)';
  else condition = 'adenoma-like (k2 ↓3.8×)';
  
  // Honest interpretation - no claims about eigenvalue bands
  const interpretation = `k₂=${params.k2.toFixed(3)} (${k2Ratio.toFixed(1)}× from Boman Table 1). ` +
    `Raw simulated |λ|=${rawEigenvalue.toFixed(3)}. Condition: ${condition}. ` +
    `NOTE: No validated "healthy eigenvalue" exists - this is exploratory analysis.`;
  
  return {
    parameters: params,
    equilibrium,
    jacobian,
    theoreticalAR2Lambda: rawEigenvalue,  // Now both use raw simulation
    simulatedAR2Lambda: rawEigenvalue,
    interpretation
  };
}
