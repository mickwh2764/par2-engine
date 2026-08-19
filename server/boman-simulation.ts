import { solveAR2Eigenvalues } from './par2-engine';

/**
 * Boman-style crypt simulation with genuine division-limit mechanics.
 *
 * Key design:
 * - TA cells progress through exactly `divisionLimit` discrete division stages (Boman's N).
 *   Each stage transition doubles the cohort (one cell → two cells).
 * - The delay structure is mechanistic, not parameterised: Fibonacci-consistent AR(2)
 *   coefficients emerge from divisionLimit=2 at biologically plausible TA apoptosis rates,
 *   rather than being forced by an artificial k3 parameter.
 * - Steady-state C/P and P/D ratios are tracked to compare against Boman's prediction
 *   that they should approach φ (≈1.618) and 1/φ (≈0.618) respectively.
 * - `taApoptosisRate` replaces k3: it is the per-stage TA cell loss rate, which governs
 *   how much of the stage-s cohort survives to advance. When transitionRate × (1 - taApoptosisRate) ≈ 1/(2φ) ≈ 0.309,
 *   the two-stage (divisionLimit=2) recursion produces a φ-ratio between successive AR(2) coefficients.
 *   With transitionRate fixed at 0.5, this occurs at taApoptosisRate ≈ 0.382 ≈ 1/φ².
 */

export interface BomanParams {
  nicheSize: number;
  maturationDelay: number;
  divisionLimit: number;       // N: TA cells divide exactly N times before differentiating (1, 2, or 3)
  asymmetricProb: number;      // probability of asymmetric stem-cell division
  apoptosisRate: number;       // stem-compartment apoptosis rate
  sheddingRate: number;        // differentiated-cell shedding rate
  transitionRate: number;      // rate at which TA cells progress through division stages (fixed 0.5)
  taApoptosisRate: number;     // per-stage TA apoptosis (replaces artificial k3)
  wntStrength: number;
  circadianGating: boolean;
  circadianAmplitude: number;
  mutationRate: number;
  condition: string;
  k1: number;                  // stem division rate
}

export interface SimulationRow {
  simulation_id: number;
  time: number;
  C_cells: number;
  P_cells: number;
  D_cells: number;
  Lgr5_like: number;
  Wnt_like: number;
  Bmal1_like: number;
  mutation_load: number;
  condition: string;
}

export interface SweepResult {
  run_id: number;
  niche_size: number;
  maturation_delay: number;
  division_limit: number;
  asymmetric_prob: number;
  apoptosis_rate: number;
  ta_apoptosis_rate: number;     // replaces k3 — biologically grounded TA loss rate
  transition_rate: number;       // rate of progression through division stages (fixed 0.5)
  phi1_C: number;
  phi2_C: number;
  lambda_modulus_C: number;
  phi1_P: number;
  phi2_P: number;
  lambda_modulus_P: number;
  phi1_D: number;
  phi2_D: number;
  lambda_modulus_D: number;
  fib_ratio_C: number;           // |phi1_C / phi2_C|; Fibonacci-consistent when ≈ φ (1.618)
  root_type_C: string;
  root_type_P: string;
  root_type_D: string;
  pattern_class: string;
  fib_distance: number;
  steady_state_C_P_ratio: number;  // Boman prediction: should approach φ under correct division rules
  steady_state_P_D_ratio: number;  // Boman prediction: should approach 1/φ under correct division rules
  phi_ratio_convergence: boolean;  // true if steady-state C/P within 20% of φ
  condition: string;
}

export interface FibRegionRow {
  phi1: number;
  phi2: number;
  region_label: string;
  distance_to_phi_family: number;
  lambda_modulus: number;
  root_type: string;
  eigenperiod: number;
  is_stable: boolean;
}

const GOLDEN_RATIO = (1 + Math.sqrt(5)) / 2;
const INV_PHI      = 1 / GOLDEN_RATIO;           // ≈ 0.6180 — the stable Fibonacci boundary
const LAMBDA_TOL   = 0.05;                        // ±0.05 band around INV_PHI for enrichment criterion

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
    const y = series[i];
    const x1 = series[i - 1];
    const x2 = series[i - 2];
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
  if (condition.includes('adenoma') || lambdaMod > 1.0) return 'adenoma-like';
  if (condition.includes('FAP')) return 'FAP-like';

  const ratio = Math.abs(phi2) > 0.01 ? Math.abs(phi1 / phi2) : 99;
  const phiDist = Math.abs(ratio - GOLDEN_RATIO);
  const lucasDist = Math.abs(ratio - 1.0);

  if (phiDist < 0.15 && lambdaMod < 1.0 && lambdaMod > 0.3) return 'Fibonacci-consistent';
  if (phiDist < 0.30 && lambdaMod < 1.0 && lambdaMod > 0.3) return 'Fibonacci-adjacent';
  if (lucasDist < 0.15 && lambdaMod < 1.0) return 'Lucas-like';

  return 'normal';
}

function computeFibDistance(phi1: number, phi2: number): number {
  if (Math.abs(phi2) < 0.01) return 99;
  return Math.abs(Math.abs(phi1 / phi2) - GOLDEN_RATIO);
}

/**
 * Run one Boman-style simulation with explicit cohort tracking.
 *
 * The TA pool is represented as an array of `divisionLimit` cohorts.
 * cohorts[s] = number of cells that have completed exactly s divisions.
 * At each timestep:
 *   - New TA cells from asymmetric stem division enter cohorts[0].
 *   - Each cohort survives with rate (1 - taApoptosisRate), then a fraction
 *     `transitionRate` advances to the next stage, doubling in the process.
 *   - Cells completing stage divisionLimit−1 → differentiated pool (×2).
 *
 * With divisionLimit=2 and transitionRate*(1−taApoptosisRate) ≈ 0.309 (achieved when
 * transitionRate=0.5 and taApoptosisRate≈0.382≈1/φ²), the two-stage contribution ratio
 * matches the golden ratio, producing Fibonacci-consistent AR(2) coefficients in P(t).
 */
export function runBomanSimulation(
  params: BomanParams,
  timeSteps: number = 200,
  replicates: number = 1,
): SimulationRow[] {
  const rows: SimulationRow[] = [];
  const d = params.divisionLimit;

  for (let rep = 0; rep < replicates; rep++) {
    let C = params.nicheSize + gaussianNoise(0, 1);

    // Initialise cohorts at approximate steady state: each successive cohort
    // is scaled by 2*transitionRate*(1-taApoptosisRate) relative to the previous.
    const progressFraction = 2 * params.transitionRate * (1 - params.taApoptosisRate);
    const cohorts: number[] = Array.from({ length: d }, (_, s) => {
      const scale = C * params.asymmetricProb * 0.12 * Math.pow(progressFraction, s);
      return clamp(scale + gaussianNoise(0, 0.3 * Math.sqrt(scale + 1)), 0, params.nicheSize * 10);
    });

    const finalStageSteadyFlow = cohorts[d - 1] * params.transitionRate * (1 - params.taApoptosisRate) * 2;
    let D = finalStageSteadyFlow / (params.sheddingRate + 1e-6) + gaussianNoise(0, 2);
    D = clamp(D, 0, params.nicheSize * 50);

    let mutationLoad =
      params.condition === 'normal' || params.condition === 'normal_no_circadian' ? 0 :
      params.condition === 'FAP-like' ? 0.3 :
      params.condition === 'adenoma-like' ? 0.6 : 0;

    let Lgr5 = 1.0 + gaussianNoise(0, 0.05);
    let Wnt = 0.9 + gaussianNoise(0, 0.05);
    let Bmal1 = 0.5;

    for (let t = 0; t < timeSteps; t++) {
      const circadianMod = params.circadianGating
        ? 1.0 + params.circadianAmplitude * Math.cos(2 * Math.PI * t / 24)
        : 1.0;

      const wntSignal = params.wntStrength * (1.0 - mutationLoad * 0.3);
      const nicheFeedback = clamp(1.0 - C / (params.nicheSize * 2), 0.1, 1.5);

      // Stem cell dynamics
      const stemDivRate = params.k1 * circadianMod * nicheFeedback * wntSignal;
      const asymRate = params.asymmetricProb * (1.0 - mutationLoad * 0.2);
      const newTA = stemDivRate * asymRate * C;
      const stemSelfRenewal = stemDivRate * (1 - asymRate) * C;

      const newC = clamp(
        C + stemSelfRenewal - params.apoptosisRate * C + gaussianNoise(0, 0.3 * Math.sqrt(C + 1)),
        1, params.nicheSize * 5,
      );

      // Cohort progression — the core Boman division-limit mechanism
      const newCohorts: number[] = new Array(d).fill(0);
      newCohorts[0] = newTA;
      let newDifferentiated = 0;

      for (let s = 0; s < d; s++) {
        const surviving = cohorts[s] * (1 - params.taApoptosisRate);
        const advancing = surviving * params.transitionRate * circadianMod;
        const staying = surviving - advancing;
        newCohorts[s] += clamp(staying + gaussianNoise(0, 0.15 * Math.sqrt(staying + 1)), 0, params.nicheSize * 20);

        if (s < d - 1) {
          // Each advancing cell divides once → 2 cells enter next stage
          newCohorts[s + 1] += 2 * advancing;
        } else {
          // Completing final division → differentiated (×2)
          newDifferentiated += 2 * advancing;
        }
      }

      const totalP = newCohorts.reduce((a, b) => a + b, 0);
      const newD = clamp(
        D + newDifferentiated - params.sheddingRate * D + gaussianNoise(0, 0.5 * Math.sqrt(D + 1)),
        0, params.nicheSize * 50,
      );

      Lgr5 = clamp(0.3 * (newC / params.nicheSize) + 0.7 * Lgr5 + gaussianNoise(0, 0.02), 0, 3);
      Wnt = clamp(wntSignal * 0.3 + 0.7 * Wnt + gaussianNoise(0, 0.02), 0, 2);
      Bmal1 = clamp(0.5 + 0.4 * Math.cos(2 * Math.PI * t / 24) + gaussianNoise(0, 0.03), 0, 1);

      if (params.mutationRate > 0 && Math.random() < params.mutationRate) {
        mutationLoad = clamp(mutationLoad + 0.01, 0, 1);
      }

      C = newC;
      for (let s = 0; s < d; s++) cohorts[s] = newCohorts[s];
      D = newD;

      rows.push({
        simulation_id: rep + 1,
        time: t,
        C_cells: Math.round(C * 100) / 100,
        P_cells: Math.round(totalP * 100) / 100,
        D_cells: Math.round(D * 100) / 100,
        Lgr5_like: Math.round(Lgr5 * 1000) / 1000,
        Wnt_like: Math.round(Wnt * 1000) / 1000,
        Bmal1_like: Math.round(Bmal1 * 1000) / 1000,
        mutation_load: Math.round(mutationLoad * 1000) / 1000,
        condition: params.condition,
      });
    }
  }

  return rows;
}

function extractTimeSeries(rows: SimulationRow[], simId: number, field: keyof SimulationRow): number[] {
  return rows
    .filter(r => r.simulation_id === simId)
    .sort((a, b) => a.time - b.time)
    .map(r => Number(r[field]));
}

/** Compute steady-state mean of a series from the last `tail` timesteps. */
function steadyStateMean(series: number[], tail: number = 50): number {
  const slice = series.slice(Math.max(0, series.length - tail));
  return slice.length > 0 ? slice.reduce((a, b) => a + b, 0) / slice.length : 0;
}

export function runParameterSweep(): { timeseries: SimulationRow[]; sweep: SweepResult[] } {
  const allTimeseries: SimulationRow[] = [];
  const sweepResults: SweepResult[] = [];
  let runId = 0;

  // 8 conditions × 3 niche sizes × 3 maturation delays × 3 division limits × 5 taApoptosisRates = 1,080
  const conditions: Array<{ name: string; overrides: Partial<BomanParams> }> = [
    { name: 'normal',              overrides: { mutationRate: 0 } },
    { name: 'normal_no_circadian', overrides: { circadianGating: false, mutationRate: 0 } },
    { name: 'FAP-like',            overrides: { asymmetricProb: 0.3, mutationRate: 0.005 } },
    { name: 'adenoma-like',        overrides: { asymmetricProb: 0.15, k1: 0.18, mutationRate: 0.01, apoptosisRate: 0.02 } },
    { name: 'high_wnt',            overrides: { wntStrength: 1.4, mutationRate: 0 } },
    { name: 'low_wnt',             overrides: { wntStrength: 0.4, mutationRate: 0 } },
    // Conditions below now use biologically grounded taApoptosisRate overrides (not k3)
    { name: 'strong_delay_feedback', overrides: { taApoptosisRate: 0.10, apoptosisRate: 0.08, transitionRate: 0.3, mutationRate: 0 } },
    { name: 'balanced_oscillator',   overrides: { taApoptosisRate: 0.35, circadianAmplitude: 0.35, transitionRate: 0.45, mutationRate: 0 } },
  ];

  const nicheSizes      = [8, 16, 24];
  const maturationDelays = [2, 5, 8];
  // divisionLimit=1 → AR(1)-like; =2 → expected Fibonacci-consistent at taApoptosisRate≈0.382; =3 → Lucas-like
  const divisionLimits  = [1, 2, 3];
  // The golden-ratio condition: transitionRate*(1-taApoptosisRate) ≈ 0.309.
  // With transitionRate=0.5, the target is taApoptosisRate≈0.382≈1/φ². Swept around this point.
  const taApoptosisRates = [0.05, 0.15, 0.30, 0.40, 0.50];

  for (const cond of conditions) {
    for (const niche of nicheSizes) {
      for (const matDelay of maturationDelays) {
        for (const divLimit of divisionLimits) {
          for (const taApo of taApoptosisRates) {
            runId++;

            const params: BomanParams = {
              nicheSize: niche,
              maturationDelay: matDelay,
              divisionLimit: divLimit,
              asymmetricProb: 0.6,
              apoptosisRate: 0.05,
              sheddingRate: 0.12,
              transitionRate: 0.5,
              taApoptosisRate: taApo,
              wntStrength: 0.9,
              circadianGating: true,
              circadianAmplitude: 0.25,
              mutationRate: 0,
              condition: cond.name,
              k1: 0.12,
              ...cond.overrides,
            };

            const timeSteps = 200;
            const reps = 3;
            const simRows = runBomanSimulation(params, timeSteps, reps);

            if (runId <= 20) {
              allTimeseries.push(...simRows);
            }

            const phi1s: Record<string, number[]> = { C: [], P: [], D: [] };
            const phi2s: Record<string, number[]> = { C: [], P: [], D: [] };
            const ssC: number[] = [], ssP: number[] = [], ssD: number[] = [];

            for (let rep = 1; rep <= reps; rep++) {
              const cSeries = extractTimeSeries(simRows, rep, 'C_cells');
              const pSeries = extractTimeSeries(simRows, rep, 'P_cells');
              const dSeries = extractTimeSeries(simRows, rep, 'D_cells');

              phi1s.C.push(fitAR2(cSeries).phi1); phi2s.C.push(fitAR2(cSeries).phi2);
              phi1s.P.push(fitAR2(pSeries).phi1); phi2s.P.push(fitAR2(pSeries).phi2);
              phi1s.D.push(fitAR2(dSeries).phi1); phi2s.D.push(fitAR2(dSeries).phi2);

              ssC.push(steadyStateMean(cSeries));
              ssP.push(steadyStateMean(pSeries));
              ssD.push(steadyStateMean(dSeries));
            }

            const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

            const avgPhi1C = avg(phi1s.C), avgPhi2C = avg(phi2s.C);
            const avgPhi1P = avg(phi1s.P), avgPhi2P = avg(phi2s.P);
            const avgPhi1D = avg(phi1s.D), avgPhi2D = avg(phi2s.D);

            const eigC = solveAR2Eigenvalues(avgPhi1C, avgPhi2C);
            const eigP = solveAR2Eigenvalues(avgPhi1P, avgPhi2P);
            const eigD = solveAR2Eigenvalues(avgPhi1D, avgPhi2D);

            const patternClass = classifyPattern(avgPhi1C, avgPhi2C, eigC.modulus1, cond.name);

            const meanSsC = avg(ssC);
            const meanSsP = avg(ssP);
            const meanSsD = avg(ssD);

            const cpRatio = meanSsP > 0.1 ? meanSsC / meanSsP : 0;
            const pdRatio = meanSsD > 0.1 ? meanSsP / meanSsD : 0;
            const fibRatioC = Math.abs(avgPhi2C) > 0.01 ? Math.abs(avgPhi1C / avgPhi2C) : 99;

            sweepResults.push({
              run_id: runId,
              niche_size: niche,
              maturation_delay: matDelay,
              division_limit: divLimit,
              asymmetric_prob: params.asymmetricProb,
              apoptosis_rate: params.apoptosisRate,
              ta_apoptosis_rate: taApo,
              transition_rate: params.transitionRate,
              phi1_C: Math.round(avgPhi1C * 10000) / 10000,
              phi2_C: Math.round(avgPhi2C * 10000) / 10000,
              lambda_modulus_C: Math.round(eigC.modulus1 * 10000) / 10000,
              phi1_P: Math.round(avgPhi1P * 10000) / 10000,
              phi2_P: Math.round(avgPhi2P * 10000) / 10000,
              lambda_modulus_P: Math.round(eigP.modulus1 * 10000) / 10000,
              phi1_D: Math.round(avgPhi1D * 10000) / 10000,
              phi2_D: Math.round(avgPhi2D * 10000) / 10000,
              lambda_modulus_D: Math.round(eigD.modulus1 * 10000) / 10000,
              fib_ratio_C: Math.round(fibRatioC * 10000) / 10000,
              root_type_C: eigC.isComplex ? 'complex' : 'real',
              root_type_P: eigP.isComplex ? 'complex' : 'real',
              root_type_D: eigD.isComplex ? 'complex' : 'real',
              pattern_class: patternClass,
              fib_distance: Math.round(computeFibDistance(avgPhi1C, avgPhi2C) * 10000) / 10000,
              steady_state_C_P_ratio: Math.round(cpRatio * 10000) / 10000,
              steady_state_P_D_ratio: Math.round(pdRatio * 10000) / 10000,
              phi_ratio_convergence: Math.abs(cpRatio - GOLDEN_RATIO) / GOLDEN_RATIO < 0.20,
              condition: cond.name,
            });
          }
        }
      }
    }
  }

  return { timeseries: allTimeseries, sweep: sweepResults };
}

export function generateFibonacciRegion(): FibRegionRow[] {
  const rows: FibRegionRow[] = [];

  for (let phi1 = -0.5; phi1 <= 1.5; phi1 += 0.02) {
    for (let phi2 = -1.0; phi2 <= 0.5; phi2 += 0.02) {
      const eig = solveAR2Eigenvalues(phi1, phi2);
      const lambdaMod = eig.modulus1;
      const isStable = lambdaMod < 1.0;
      const ratio = Math.abs(phi2) > 0.01 ? Math.abs(phi1 / phi2) : 99;
      const fibDist = Math.abs(ratio - GOLDEN_RATIO);

      let eigenperiod = 0;
      if (eig.isComplex && eig.lambda1) {
        const angle = Math.atan2(eig.lambda1.imag, eig.lambda1.real);
        if (Math.abs(angle) > 0.01) {
          eigenperiod = Math.round((2 * Math.PI / Math.abs(angle)) * 100) / 100;
        }
      }

      let label = 'outside';
      if (!isStable) {
        label = 'unstable';
      } else if (fibDist < 0.05) {
        label = 'fib_core';
      } else if (fibDist < 0.15) {
        label = 'fib_consistent';
      } else if (fibDist < 0.30) {
        label = 'fib_adjacent';
      } else {
        label = 'non_fibonacci';
      }

      if (fibDist < 0.35 || (isStable && Math.random() < 0.05)) {
        rows.push({
          phi1: Math.round(phi1 * 100) / 100,
          phi2: Math.round(phi2 * 100) / 100,
          region_label: label,
          distance_to_phi_family: Math.round(fibDist * 10000) / 10000,
          lambda_modulus: Math.round(lambdaMod * 10000) / 10000,
          root_type: eig.isComplex ? 'complex' : 'real',
          eigenperiod,
          is_stable: isStable,
        });
      }
    }
  }

  return rows;
}

export function generateAllFiles(): {
  timeseriesCSV: string;
  sweepCSV: string;
  fibRegionCSV: string;
  coefficientSpaceCSV: string;
} {
  console.log('[boman-sim] Starting parameter sweep (genuine cohort-based Boman mechanics)...');
  const { timeseries, sweep } = runParameterSweep();

  console.log('[boman-sim] Generating Fibonacci region reference grid...');
  const fibRegion = generateFibonacciRegion();

  const tsHeader = 'simulation_id,time,C_cells,P_cells,D_cells,Lgr5_like,Wnt_like,Bmal1_like,mutation_load,condition';
  const timeseriesCSV = [
    tsHeader,
    ...timeseries.map(r =>
      `${r.simulation_id},${r.time},${r.C_cells},${r.P_cells},${r.D_cells},${r.Lgr5_like},${r.Wnt_like},${r.Bmal1_like},${r.mutation_load},${r.condition}`
    ),
  ].join('\n');

  const swHeader = [
    'run_id','niche_size','maturation_delay','division_limit','asymmetric_prob','apoptosis_rate',
    'ta_apoptosis_rate','transition_rate',
    'phi1_C','phi2_C','lambda_modulus_C',
    'phi1_P','phi2_P','lambda_modulus_P',
    'phi1_D','phi2_D','lambda_modulus_D',
    'fib_ratio_C','root_type_C','root_type_P','root_type_D',
    'pattern_class','fib_distance',
    'steady_state_C_P_ratio','steady_state_P_D_ratio','phi_ratio_convergence',
    'condition',
  ].join(',');
  const sweepCSV = [
    swHeader,
    ...sweep.map(r =>
      [
        r.run_id, r.niche_size, r.maturation_delay, r.division_limit,
        r.asymmetric_prob, r.apoptosis_rate, r.ta_apoptosis_rate, r.transition_rate,
        r.phi1_C, r.phi2_C, r.lambda_modulus_C,
        r.phi1_P, r.phi2_P, r.lambda_modulus_P,
        r.phi1_D, r.phi2_D, r.lambda_modulus_D,
        r.fib_ratio_C, r.root_type_C, r.root_type_P, r.root_type_D,
        r.pattern_class, r.fib_distance,
        r.steady_state_C_P_ratio, r.steady_state_P_D_ratio, r.phi_ratio_convergence,
        r.condition,
      ].join(',')
    ),
  ].join('\n');

  const frHeader = 'phi1,phi2,region_label,distance_to_phi_family,lambda_modulus,root_type,eigenperiod,is_stable';
  const fibRegionCSV = [
    frHeader,
    ...fibRegion.map(r =>
      `${r.phi1},${r.phi2},${r.region_label},${r.distance_to_phi_family},${r.lambda_modulus},${r.root_type},${r.eigenperiod},${r.is_stable}`
    ),
  ].join('\n');

  const csHeader = 'gene,dataset,phi1,phi2,root1_real,root1_imag,root2_real,root2_imag,lambda_modulus,root_type,category,fib_distance,pattern_class,fib_ratio,phi_ratio_convergence';
  const csRows: string[] = [];

  for (const result of sweep.slice(0, 100)) {
    const eigC = solveAR2Eigenvalues(result.phi1_C, result.phi2_C);
    const eigP = solveAR2Eigenvalues(result.phi1_P, result.phi2_P);
    const eigD = solveAR2Eigenvalues(result.phi1_D, result.phi2_D);

    const tag = `sim_run_${result.run_id}_divlim${result.division_limit}_taApo${result.ta_apoptosis_rate}_${result.condition}`;

    csRows.push([
      'Stem_Cell_Pool', tag,
      result.phi1_C, result.phi2_C,
      eigC.lambda1.real.toFixed(4), eigC.lambda1.imag.toFixed(4),
      eigC.lambda2.real.toFixed(4), eigC.lambda2.imag.toFixed(4),
      result.lambda_modulus_C, result.root_type_C, 'Stem',
      result.fib_distance, result.pattern_class, result.fib_ratio_C, result.phi_ratio_convergence,
    ].join(','));

    const fibRatioP = computeFibDistance(result.phi1_P, result.phi2_P);
    csRows.push([
      'Proliferating_Pool', tag,
      result.phi1_P, result.phi2_P,
      eigP.lambda1.real.toFixed(4), eigP.lambda1.imag.toFixed(4),
      eigP.lambda2.real.toFixed(4), eigP.lambda2.imag.toFixed(4),
      result.lambda_modulus_P, result.root_type_P, 'Proliferating',
      fibRatioP.toFixed(4),
      classifyPattern(result.phi1_P, result.phi2_P, result.lambda_modulus_P, result.condition),
      Math.abs(result.phi2_P) > 0.01 ? (Math.abs(result.phi1_P / result.phi2_P)).toFixed(4) : '99',
      result.phi_ratio_convergence,
    ].join(','));

    const fibRatioD = computeFibDistance(result.phi1_D, result.phi2_D);
    csRows.push([
      'Differentiated_Pool', tag,
      result.phi1_D, result.phi2_D,
      eigD.lambda1.real.toFixed(4), eigD.lambda1.imag.toFixed(4),
      eigD.lambda2.real.toFixed(4), eigD.lambda2.imag.toFixed(4),
      result.lambda_modulus_D, result.root_type_D, 'Differentiated',
      fibRatioD.toFixed(4),
      classifyPattern(result.phi1_D, result.phi2_D, result.lambda_modulus_D, result.condition),
      Math.abs(result.phi2_D) > 0.01 ? (Math.abs(result.phi1_D / result.phi2_D)).toFixed(4) : '99',
      result.phi_ratio_convergence,
    ].join(','));
  }

  const coefficientSpaceCSV = [csHeader, ...csRows].join('\n');

  console.log(`[boman-sim] Done: ${timeseries.length} timeseries rows, ${sweep.length} sweep rows, ${fibRegion.length} Fibonacci-region points, ${csRows.length} coefficient-space entries`);

  return { timeseriesCSV, sweepCSV, fibRegionCSV, coefficientSpaceCSV };
}

// ─── Enrichment Analysis ──────────────────────────────────────────────────────

export interface StratumResult {
  label: string;
  total_runs: number;
  fib_consistent: number;
  observed_rate: number;
  null_fraction: number;
  fold_enrichment: number;
  p_value: number;
  significant: boolean;
}

export interface EnrichmentResult {
  null_fraction: number;
  null_pct: string;
  by_division_limit: StratumResult[];
  division_limit2_by_ta_rate: StratumResult[];
  key_finding: string;
  interpretation: string;
}

/**
 * Compute |λ| (eigenvalue modulus) from AR(2) coefficients.
 * For complex roots (discriminant < 0): |λ| = sqrt(−φ₂).
 * For real roots: |λ| = max absolute root value.
 */
function lambdaModulus(phi1: number, phi2: number): number {
  const disc = phi1 * phi1 + 4 * phi2;
  if (disc < 0) {
    return Math.sqrt(-phi2);
  }
  const sqrtDisc = Math.sqrt(disc);
  return Math.max(Math.abs((phi1 + sqrtDisc) / 2), Math.abs((phi1 - sqrtDisc) / 2));
}

/**
 * Compute what fraction of the stable AR(2) triangle is Fibonacci-consistent
 * by pure geometry (no simulation). Grid resolution: 0.01 step.
 *
 * Stable AR(2) triangle: φ₂ > -1, φ₁ + φ₂ < 1, φ₂ - φ₁ < 1.
 * Fibonacci-consistent: |λ| within LAMBDA_TOL of 1/φ ≈ 0.618 (stable Fibonacci boundary).
 */
function computeGeometricNull(): { nullFraction: number; stableCount: number; fibCount: number } {
  const step = 0.01;
  let stableCount = 0;
  let fibCount = 0;

  for (let phi1 = -2.0; phi1 <= 2.0; phi1 += step) {
    for (let phi2 = -1.0; phi2 <= 1.0; phi2 += step) {
      if (phi2 > -1 && phi1 + phi2 < 1 && phi2 - phi1 < 1) {
        stableCount++;
        const lm = lambdaModulus(phi1, phi2);
        if (Math.abs(lm - INV_PHI) < LAMBDA_TOL) fibCount++;
      }
    }
  }

  return { nullFraction: fibCount / stableCount, stableCount, fibCount };
}

/** Normal approximation Q-function: P(Z > z). Used for binomial enrichment p-values. */
function normalSurvival(z: number): number {
  if (z > 8) return 0;
  if (z < -8) return 1;
  const absZ = Math.abs(z);
  const t = 1 / (1 + 0.2316419 * absZ);
  const d = 0.3989422820 * Math.exp(-absZ * absZ / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.7814779 + t * (-1.8212560 + t * 1.3302744))));
  return z >= 0 ? p : 1 - p;
}

/** One-tailed binomial p-value (observed > null) using normal approximation with continuity correction. */
function binomialPValue(k: number, n: number, p0: number): number {
  if (n === 0) return 1;
  const mean = n * p0;
  const std = Math.sqrt(n * p0 * (1 - p0));
  if (std < 0.001) return k > mean ? 0.001 : 1;
  const z = (k - 0.5 - mean) / std;
  return normalSurvival(z);
}

/**
 * Focused enrichment sweep: 270 runs at 80 timesteps × 2 replicates.
 * Tests 3 divisionLimits × 5 taApoptosisRates × 3 nicheSizes × 3 matDelays × 2 conditions.
 * Much faster than the full 1,080-run sweep.
 */
export function runEnrichmentAnalysis(): EnrichmentResult {
  console.log('[boman-enrichment] Computing geometric null...');
  const { nullFraction, stableCount, fibCount } = computeGeometricNull();

  console.log(`[boman-enrichment] Null: ${fibCount}/${stableCount} = ${(nullFraction * 100).toFixed(2)}% of stable triangle is Fibonacci-consistent`);

  const conditions: Array<{ name: string; overrides: Partial<BomanParams> }> = [
    { name: 'normal',            overrides: { mutationRate: 0 } },
    { name: 'balanced_oscillator', overrides: { taApoptosisRate: 0.35, circadianAmplitude: 0.35, transitionRate: 0.45, mutationRate: 0 } },
  ];

  const divisionLimits  = [1, 2, 3];
  const taRates         = [0.05, 0.15, 0.30, 0.40, 0.50];
  const nicheSizes      = [8, 16, 24];
  const matDelays       = [2, 5, 8];

  // Collect (divisionLimit, taRate) → list of {isFibConsistent}
  const byDivLimit: Record<number, { fib: number; total: number }> = { 1: { fib: 0, total: 0 }, 2: { fib: 0, total: 0 }, 3: { fib: 0, total: 0 } };
  const byDivLimit2TaRate: Record<number, { fib: number; total: number }> = {};
  for (const ta of taRates) byDivLimit2TaRate[ta] = { fib: 0, total: 0 };

  const timeSteps = 80;
  const reps = 2;

  for (const cond of conditions) {
    for (const niche of nicheSizes) {
      for (const matDelay of matDelays) {
        for (const divLimit of divisionLimits) {
          for (const taApo of taRates) {
            const params: BomanParams = {
              nicheSize: niche,
              maturationDelay: matDelay,
              divisionLimit: divLimit,
              asymmetricProb: 0.6,
              apoptosisRate: 0.05,
              sheddingRate: 0.12,
              transitionRate: 0.5,
              taApoptosisRate: taApo,
              wntStrength: 0.9,
              circadianGating: true,
              circadianAmplitude: 0.25,
              mutationRate: 0,
              condition: cond.name,
              k1: 0.12,
              ...cond.overrides,
            };

            const simRows = runBomanSimulation(params, timeSteps, reps);

            const phi1s: number[] = [], phi2s: number[] = [];
            for (let rep = 1; rep <= reps; rep++) {
              const pSeries = extractTimeSeries(simRows, rep, 'P_cells');
              const fit = fitAR2(pSeries);
              phi1s.push(fit.phi1);
              phi2s.push(fit.phi2);
            }
            const avgPhi1 = phi1s.reduce((a, b) => a + b, 0) / reps;
            const avgPhi2 = phi2s.reduce((a, b) => a + b, 0) / reps;

            const lm = lambdaModulus(avgPhi1, avgPhi2);
            const isStable = lm < 1.0;
            const isFib = Math.abs(lm - INV_PHI) < LAMBDA_TOL;
            const fibAndStable = isFib && isStable;

            byDivLimit[divLimit].total++;
            if (fibAndStable) byDivLimit[divLimit].fib++;

            if (divLimit === 2) {
              byDivLimit2TaRate[taApo].total++;
              if (fibAndStable) byDivLimit2TaRate[taApo].fib++;
            }
          }
        }
      }
    }
  }

  const makeStratum = (label: string, counts: { fib: number; total: number }): StratumResult => {
    const observed = counts.total > 0 ? counts.fib / counts.total : 0;
    const fold = nullFraction > 0 ? observed / nullFraction : 0;
    const pVal = binomialPValue(counts.fib, counts.total, nullFraction);
    return {
      label,
      total_runs: counts.total,
      fib_consistent: counts.fib,
      observed_rate: Math.round(observed * 10000) / 100,   // percent, 2dp
      null_fraction: Math.round(nullFraction * 10000) / 100,
      fold_enrichment: Math.round(fold * 100) / 100,
      p_value: Math.round(pVal * 10000) / 10000,
      significant: pVal < 0.05,
    };
  };

  const byDivLimitResults: StratumResult[] = divisionLimits.map(d =>
    makeStratum(`division_limit=${d}`, byDivLimit[d])
  );

  const byTaRateResults: StratumResult[] = taRates.map(ta =>
    makeStratum(`ta_apoptosis_rate=${ta}`, byDivLimit2TaRate[ta])
  );

  // Identify key finding
  const dl2 = byDivLimit[2];
  const dl1 = byDivLimit[1];
  const dl3 = byDivLimit[3];
  const dl2Rate = dl2.total > 0 ? dl2.fib / dl2.total : 0;
  const dl1Rate = dl1.total > 0 ? dl1.fib / dl1.total : 0;
  const dl3Rate = dl3.total > 0 ? dl3.fib / dl3.total : 0;
  const dl2Fold = nullFraction > 0 ? dl2Rate / nullFraction : 0;
  const dl2P = binomialPValue(dl2.fib, dl2.total, nullFraction);

  // Find peak taRate for divisionLimit=2
  let peakTa = 0.40, peakFib = 0;
  for (const ta of taRates) {
    if (byDivLimit2TaRate[ta].fib > peakFib) {
      peakFib = byDivLimit2TaRate[ta].fib;
      peakTa = ta;
    }
  }

  const keyFinding = dl2Fold > 1.5 && dl2P < 0.05
    ? `division_limit=2 is ${dl2Fold.toFixed(1)}× enriched for |λ| ≈ 1/φ ≈ 0.618 outcomes vs geometric null (p=${dl2P.toFixed(4)}). Peak enrichment at ta_apoptosis_rate=${peakTa}, consistent with the predicted golden-ratio condition (1−ta)×0.5≈0.309 → ta≈0.382.`
    : dl2Fold > 1.0
    ? `division_limit=2 shows ${dl2Fold.toFixed(1)}× enrichment for |λ| ≈ 1/φ vs geometric null (p=${dl2P.toFixed(4)}) — trend in expected direction but not yet significant at this sample size.`
    : `No clear enrichment for division_limit=2 over geometric null for |λ| ≈ 1/φ. The Fibonacci-consistent eigenvalue regime may require tighter parameter tuning or is sensitive to stochastic noise at these simulation lengths.`;

  const interpretation = `Geometric null: ${(nullFraction * 100).toFixed(1)}% of the stable AR(2) triangle has |λ| within 0.05 of 1/φ ≈ 0.618 by pure area. ` +
    `Observed rates — divisionLimit=1: ${(dl1Rate * 100).toFixed(1)}%, divisionLimit=2: ${(dl2Rate * 100).toFixed(1)}%, divisionLimit=3: ${(dl3Rate * 100).toFixed(1)}%. ` +
    (dl2Fold > 1.0 ? `The two-stage division rule preferentially produces eigenvalue moduli near the stable Fibonacci boundary (1/φ) compared to random chance.` :
     `Results are consistent with the null at current simulation fidelity.`);

  console.log(`[boman-enrichment] Key finding: ${keyFinding}`);

  return {
    null_fraction: Math.round(nullFraction * 10000) / 100,
    null_pct: `${(nullFraction * 100).toFixed(2)}%`,
    by_division_limit: byDivLimitResults,
    division_limit2_by_ta_rate: byTaRateResults,
    key_finding: keyFinding,
    interpretation,
  };
}

/**
 * Full 1,080-run enrichment sweep.
 * 8 conditions × 3 niche sizes × 3 maturation delays × 3 division limits × 5 taApoptosisRates.
 * 200 timesteps × 3 replicates per run — same parameters as runParameterSweep().
 * Criterion: |λ| within LAMBDA_TOL of INV_PHI (0.618).
 */
export function runFullEnrichmentAnalysis(): EnrichmentResult {
  console.log('[boman-full-enrichment] Computing geometric null...');
  const { nullFraction, stableCount, fibCount } = computeGeometricNull();
  console.log(`[boman-full-enrichment] Null: ${fibCount}/${stableCount} = ${(nullFraction * 100).toFixed(2)}%`);

  const conditions: Array<{ name: string; overrides: Partial<BomanParams> }> = [
    { name: 'normal',              overrides: { mutationRate: 0 } },
    { name: 'normal_no_circadian', overrides: { circadianGating: false, mutationRate: 0 } },
    { name: 'FAP-like',            overrides: { asymmetricProb: 0.3, mutationRate: 0.005 } },
    { name: 'adenoma-like',        overrides: { asymmetricProb: 0.15, k1: 0.18, mutationRate: 0.01, apoptosisRate: 0.02 } },
    { name: 'high_wnt',            overrides: { wntStrength: 1.4, mutationRate: 0 } },
    { name: 'low_wnt',             overrides: { wntStrength: 0.4, mutationRate: 0 } },
    { name: 'strong_delay_feedback', overrides: { taApoptosisRate: 0.10, apoptosisRate: 0.08, transitionRate: 0.3, mutationRate: 0 } },
    { name: 'balanced_oscillator',   overrides: { taApoptosisRate: 0.35, circadianAmplitude: 0.35, transitionRate: 0.45, mutationRate: 0 } },
  ];

  const divisionLimits  = [1, 2, 3];
  const taRates         = [0.05, 0.15, 0.30, 0.40, 0.50];
  const nicheSizes      = [8, 16, 24];
  const matDelays       = [2, 5, 8];
  const timeSteps       = 200;
  const reps            = 3;

  const byDivLimit: Record<number, { fib: number; total: number }> = { 1: { fib: 0, total: 0 }, 2: { fib: 0, total: 0 }, 3: { fib: 0, total: 0 } };
  const byDivLimit2TaRate: Record<number, { fib: number; total: number }> = {};
  for (const ta of taRates) byDivLimit2TaRate[ta] = { fib: 0, total: 0 };

  let runCount = 0;
  for (const cond of conditions) {
    for (const niche of nicheSizes) {
      for (const matDelay of matDelays) {
        for (const divLimit of divisionLimits) {
          for (const taApo of taRates) {
            runCount++;
            if (runCount % 100 === 0) console.log(`[boman-full-enrichment] Run ${runCount}/1080...`);

            const params: BomanParams = {
              nicheSize: niche,
              maturationDelay: matDelay,
              divisionLimit: divLimit,
              asymmetricProb: 0.6,
              apoptosisRate: 0.05,
              sheddingRate: 0.12,
              transitionRate: 0.5,
              taApoptosisRate: taApo,
              wntStrength: 0.9,
              circadianGating: true,
              circadianAmplitude: 0.25,
              mutationRate: 0,
              condition: cond.name,
              k1: 0.12,
              ...cond.overrides,
            };

            const simRows = runBomanSimulation(params, timeSteps, reps);

            const phi1s: number[] = [], phi2s: number[] = [];
            for (let rep = 1; rep <= reps; rep++) {
              const pSeries = extractTimeSeries(simRows, rep, 'P_cells');
              const fit = fitAR2(pSeries);
              phi1s.push(fit.phi1);
              phi2s.push(fit.phi2);
            }
            const avgPhi1 = phi1s.reduce((a, b) => a + b, 0) / reps;
            const avgPhi2 = phi2s.reduce((a, b) => a + b, 0) / reps;

            const lm = lambdaModulus(avgPhi1, avgPhi2);
            const isStable = lm < 1.0;
            const isFib = Math.abs(lm - INV_PHI) < LAMBDA_TOL;
            const fibAndStable = isFib && isStable;

            byDivLimit[divLimit].total++;
            if (fibAndStable) byDivLimit[divLimit].fib++;

            if (divLimit === 2) {
              byDivLimit2TaRate[taApo].total++;
              if (fibAndStable) byDivLimit2TaRate[taApo].fib++;
            }
          }
        }
      }
    }
  }

  const makeStratum = (label: string, counts: { fib: number; total: number }): StratumResult => {
    const observed = counts.total > 0 ? counts.fib / counts.total : 0;
    const fold = nullFraction > 0 ? observed / nullFraction : 0;
    const pVal = binomialPValue(counts.fib, counts.total, nullFraction);
    return {
      label,
      total_runs: counts.total,
      fib_consistent: counts.fib,
      observed_rate: Math.round(observed * 10000) / 100,
      null_fraction: Math.round(nullFraction * 10000) / 100,
      fold_enrichment: Math.round(fold * 100) / 100,
      p_value: Math.round(pVal * 10000) / 10000,
      significant: pVal < 0.05,
    };
  };

  const byDivLimitResults = divisionLimits.map(d => makeStratum(`division_limit=${d}`, byDivLimit[d]));
  const byTaRateResults   = taRates.map(ta => makeStratum(`ta_apoptosis_rate=${ta}`, byDivLimit2TaRate[ta]));

  const dl2 = byDivLimit[2]; const dl1 = byDivLimit[1]; const dl3 = byDivLimit[3];
  const dl2Rate = dl2.total > 0 ? dl2.fib / dl2.total : 0;
  const dl1Rate = dl1.total > 0 ? dl1.fib / dl1.total : 0;
  const dl3Rate = dl3.total > 0 ? dl3.fib / dl3.total : 0;
  const dl2Fold = nullFraction > 0 ? dl2Rate / nullFraction : 0;
  const dl2P    = binomialPValue(dl2.fib, dl2.total, nullFraction);

  let peakTa = 0.40, peakFib = 0;
  for (const ta of taRates) {
    if (byDivLimit2TaRate[ta].fib > peakFib) { peakFib = byDivLimit2TaRate[ta].fib; peakTa = ta; }
  }

  const keyFinding = dl2Fold > 1.5 && dl2P < 0.05
    ? `division_limit=2 is ${dl2Fold.toFixed(1)}× enriched for |λ| ≈ 1/φ ≈ 0.618 outcomes vs geometric null (p=${dl2P.toFixed(4)}). Peak enrichment at ta_apoptosis_rate=${peakTa}, consistent with the predicted golden-ratio condition (1−ta)×0.5≈0.309 → ta≈0.382.`
    : dl2Fold > 1.0
    ? `division_limit=2 shows ${dl2Fold.toFixed(1)}× enrichment for |λ| ≈ 1/φ vs geometric null (p=${dl2P.toFixed(4)}) — trend in expected direction across all 1,080 runs.`
    : `No clear enrichment for division_limit=2 over geometric null for |λ| ≈ 1/φ across the full 1,080-run sweep.`;

  const interpretation = `Full 1,080-run sweep. Geometric null: ${(nullFraction * 100).toFixed(1)}% of the stable AR(2) triangle has |λ| within 0.05 of 1/φ ≈ 0.618. ` +
    `Observed rates — divisionLimit=1: ${(dl1Rate * 100).toFixed(1)}%, divisionLimit=2: ${(dl2Rate * 100).toFixed(1)}%, divisionLimit=3: ${(dl3Rate * 100).toFixed(1)}%. ` +
    (dl2Fold > 1.0 ? `The two-stage division rule preferentially produces eigenvalue moduli near the stable Fibonacci boundary (1/φ).` :
     `Results are consistent with the null across the full sweep.`);

  console.log(`[boman-full-enrichment] Complete. ${runCount} runs. Key finding: ${keyFinding}`);

  return {
    null_fraction: Math.round(nullFraction * 10000) / 100,
    null_pct: `${(nullFraction * 100).toFixed(2)}%`,
    by_division_limit: byDivLimitResults,
    division_limit2_by_ta_rate: byTaRateResults,
    key_finding: keyFinding,
    interpretation,
  };
}

// ─── Fibonacci Connection Test ────────────────────────────────────────────────

export interface CalibrationPoint {
  ta: number;
  beta: number;                  // β = 2*(1-ta)*transitionRate — progression factor
  beta_near_inv_phi: boolean;    // β within 0.03 of 1/φ
  mean_cp: number;               // mean steady-state C/P ratio (no circadian)
  cp_near_phi: boolean;          // C/P within 20% of φ
}

export interface ProbeResult {
  division_limit: number;
  mean_lambda: number;
  sd_lambda: number;
  mean_phi1: number;
  mean_phi2: number;
  near_inv_phi: boolean;         // mean |λ| within 0.05 of 1/φ
  distance_from_inv_phi: number;
  mean_cp: number;
}

export interface FibConnectionResult {
  /* Part A */
  calibration: CalibrationPoint[];
  fibonacci_ta: number;           // ta at which β = 1/φ
  fibonacci_beta: number;         // β at fibonacci_ta (≈ 0.618)
  /* Part B */
  circadian_probe: ProbeResult[];
  /* Part C */
  pulse_recovery: ProbeResult[];
  /* Summary */
  key_finding: string;
  interpretation: string;
  inv_phi: number;
  phi: number;
}

/**
 * Three-stage experiment to test whether the Fibonacci algebraic structure (C(1,1)=M)
 * produces |λ| ≈ 1/φ in the temporal dynamics of the Boman stochastic simulation.
 *
 * Stage A — Calibration: scan ta to find where β = 2*(1-ta)*tr = 1/φ ≈ 0.618.
 *   This is the Fibonacci parameter condition. Shows whether the simulation ever
 *   reaches C/P ≈ φ in steady state.
 *
 * Stage B — Circadian probe: at ta=0.382, run dl=1,2,3 WITH circadian gating.
 *   Circadian acts as the natural perturbation. Fit AR(2) to P_cells and measure |λ|.
 *   Prediction: dl=2 should show |λ| closest to 1/φ because β=1/φ is embedded
 *   in the two-stage progression factor.
 *
 * Stage C — Pulse recovery: at ta=0.382, run dl=1,2,3 to steady state without
 *   circadian, then apply a 50% pulse to P cohorts, then measure AR(2) of recovery.
 *   This isolates the NATURAL eigenvalue of each system (should be α=0.309 for all).
 *   The contrast with Stage B reveals whether the circadian forcing is required
 *   to convert the spatial Fibonacci structure into the temporal 1/φ signal.
 */
export function runFibonacciConnectionTest(): FibConnectionResult {
  const TR   = 0.5;    // transition rate (fixed throughout)
  const REPS = 12;     // replicates per condition
  const NICHE = 16;
  const FIB_TA = 0.382; // target: β = 2*(1-0.382)*0.5 = 0.618 ≈ 1/φ

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const sd = (arr: number[]) => {
    const m = avg(arr);
    return Math.sqrt(avg(arr.map(x => (x - m) ** 2)));
  };

  const baseParams = (overrides: Partial<BomanParams>): BomanParams => ({
    nicheSize: NICHE,
    maturationDelay: 5,
    divisionLimit: 2,
    asymmetricProb: 0.6,
    apoptosisRate: 0.05,
    sheddingRate: 0.12,
    transitionRate: TR,
    taApoptosisRate: FIB_TA,
    wntStrength: 0.9,
    circadianGating: true,
    circadianAmplitude: 0.25,
    mutationRate: 0,
    condition: 'normal',
    k1: 0.12,
    ...overrides,
  });

  // ── Part A: Calibration scan ─────────────────────────────────────────────
  console.log('[fib-connection] Part A: calibration scan...');
  const taValues = [0.05, 0.10, 0.15, 0.20, 0.25, 0.30, 0.35, 0.382, 0.40, 0.45, 0.50, 0.55, 0.60, 0.65, 0.70, 0.75];

  const calibration: CalibrationPoint[] = taValues.map(ta => {
    const beta = 2 * (1 - ta) * TR;  // = 1 - ta, since TR=0.5
    const rows = runBomanSimulation(baseParams({ taApoptosisRate: ta, circadianGating: false }), 300, 5);
    const cpRatios: number[] = [];
    for (let rep = 1; rep <= 5; rep++) {
      const cSeries = extractTimeSeries(rows, rep, 'C_cells');
      const pSeries = extractTimeSeries(rows, rep, 'P_cells');
      const ssC = steadyStateMean(cSeries);
      const ssP = steadyStateMean(pSeries);
      if (ssP > 0.05) cpRatios.push(ssC / ssP);
    }
    const meanCp = avg(cpRatios);
    return {
      ta: Math.round(ta * 1000) / 1000,
      beta: Math.round(beta * 10000) / 10000,
      beta_near_inv_phi: Math.abs(beta - INV_PHI) < 0.03,
      mean_cp: Math.round(meanCp * 100) / 100,
      cp_near_phi: meanCp > 0 && Math.abs(meanCp - GOLDEN_RATIO) / GOLDEN_RATIO < 0.20,
    };
  });

  const fibTa    = FIB_TA;
  const fibBeta  = 2 * (1 - FIB_TA) * TR;  // ≈ 0.618 = 1/φ

  // ── Part B: Circadian probe at ta=0.382 ──────────────────────────────────
  console.log('[fib-connection] Part B: circadian probe...');
  const circadianProbe: ProbeResult[] = [1, 2, 3].map(dl => {
    const lambdas: number[] = [], phi1s: number[] = [], phi2s: number[] = [], cps: number[] = [];
    for (let r = 0; r < REPS; r++) {
      const rows = runBomanSimulation(baseParams({ divisionLimit: dl, circadianGating: true }), 500, 1);
      const pSeries = extractTimeSeries(rows, 1, 'P_cells');
      const cSeries = extractTimeSeries(rows, 1, 'C_cells');
      // Skip first 200 steps (transient), fit AR(2) to last 300
      const fit = fitAR2(pSeries.slice(200));
      const lm  = lambdaModulus(fit.phi1, fit.phi2);
      lambdas.push(lm);
      phi1s.push(fit.phi1);
      phi2s.push(fit.phi2);
      const ssC = steadyStateMean(cSeries);
      const ssP = steadyStateMean(pSeries);
      if (ssP > 0.05) cps.push(ssC / ssP);
    }
    const ml = avg(lambdas);
    return {
      division_limit: dl,
      mean_lambda: Math.round(ml * 10000) / 10000,
      sd_lambda:   Math.round(sd(lambdas) * 10000) / 10000,
      mean_phi1:   Math.round(avg(phi1s) * 10000) / 10000,
      mean_phi2:   Math.round(avg(phi2s) * 10000) / 10000,
      near_inv_phi: Math.abs(ml - INV_PHI) < LAMBDA_TOL,
      distance_from_inv_phi: Math.round(Math.abs(ml - INV_PHI) * 10000) / 10000,
      mean_cp: Math.round(avg(cps) * 100) / 100,
    };
  });

  // ── Part C: Pulse recovery at ta=0.382 ───────────────────────────────────
  // Custom loop: run 300 steps no-circadian → pulse cohorts 50% up → 200 steps no-circadian
  console.log('[fib-connection] Part C: pulse recovery...');

  function runPulseRecovery(dl: number): number[] {
    // Returns P_cells recovery series (200 timesteps post-pulse), single rep
    let C = NICHE + gaussianNoise(0, 1);
    const cohorts: number[] = Array.from({ length: dl }, (_, s) =>
      clamp(C * 0.6 * 0.12 * Math.pow(2 * TR * (1 - FIB_TA), s) + gaussianNoise(0, 0.3), 0, NICHE * 10)
    );
    let D = clamp(cohorts[dl - 1] * TR * (1 - FIB_TA) * 2 / 0.12, 0, NICHE * 50);

    // Phase 1: run 300 steps, no circadian, reach steady state
    for (let t = 0; t < 300; t++) {
      const wntSignal    = 0.9;
      const nicheFeedback = clamp(1.0 - C / (NICHE * 2), 0.1, 1.5);
      const stemDivRate  = 0.12 * nicheFeedback * wntSignal;
      const asymRate     = 0.6;
      const newTA        = stemDivRate * asymRate * C;
      const stemSelf     = stemDivRate * (1 - asymRate) * C;

      C = clamp(C + stemSelf - 0.05 * C + gaussianNoise(0, 0.3 * Math.sqrt(C + 1)), 1, NICHE * 5);

      const newCohorts: number[] = new Array(dl).fill(0);
      newCohorts[0] = newTA;
      for (let s = 0; s < dl; s++) {
        const surviving = cohorts[s] * (1 - FIB_TA);
        const advancing = surviving * TR;
        const staying   = surviving - advancing;
        newCohorts[s] += clamp(staying + gaussianNoise(0, 0.15 * Math.sqrt(staying + 1)), 0, NICHE * 20);
        if (s < dl - 1) newCohorts[s + 1] += 2 * advancing;
        else            D = clamp(D + 2 * advancing - 0.12 * D + gaussianNoise(0, 0.5 * Math.sqrt(D + 1)), 0, NICHE * 50);
      }
      for (let s = 0; s < dl; s++) cohorts[s] = newCohorts[s];
    }

    // Phase 2: pulse — add 50% to all cohorts
    for (let s = 0; s < dl; s++) cohorts[s] *= 1.50;

    // Phase 3: recovery — 200 steps, no circadian, record P_cells
    const recovery: number[] = [];
    for (let t = 0; t < 200; t++) {
      const nicheFeedback = clamp(1.0 - C / (NICHE * 2), 0.1, 1.5);
      const stemDivRate  = 0.12 * nicheFeedback * 0.9;
      const newTA        = stemDivRate * 0.6 * C;
      const stemSelf     = stemDivRate * 0.4 * C;
      C = clamp(C + stemSelf - 0.05 * C + gaussianNoise(0, 0.3 * Math.sqrt(C + 1)), 1, NICHE * 5);

      const newCohorts: number[] = new Array(dl).fill(0);
      newCohorts[0] = newTA;
      for (let s = 0; s < dl; s++) {
        const surviving = cohorts[s] * (1 - FIB_TA);
        const advancing = surviving * TR;
        const staying   = surviving - advancing;
        newCohorts[s] += clamp(staying + gaussianNoise(0, 0.15 * Math.sqrt(staying + 1)), 0, NICHE * 20);
        if (s < dl - 1) newCohorts[s + 1] += 2 * advancing;
        else            D = clamp(D + 2 * advancing - 0.12 * D + gaussianNoise(0, 0.5 * Math.sqrt(D + 1)), 0, NICHE * 50);
      }
      for (let s = 0; s < dl; s++) cohorts[s] = newCohorts[s];
      recovery.push(newCohorts.reduce((a, b) => a + b, 0));
    }
    return recovery;
  }

  const pulseRecovery: ProbeResult[] = [1, 2, 3].map(dl => {
    const lambdas: number[] = [], phi1s: number[] = [], phi2s: number[] = [];
    for (let r = 0; r < REPS; r++) {
      const series = runPulseRecovery(dl);
      const fit = fitAR2(series);
      const lm  = lambdaModulus(fit.phi1, fit.phi2);
      lambdas.push(lm);
      phi1s.push(fit.phi1);
      phi2s.push(fit.phi2);
    }
    const ml = avg(lambdas);
    return {
      division_limit: dl,
      mean_lambda: Math.round(ml * 10000) / 10000,
      sd_lambda:   Math.round(sd(lambdas) * 10000) / 10000,
      mean_phi1:   Math.round(avg(phi1s) * 10000) / 10000,
      mean_phi2:   Math.round(avg(phi2s) * 10000) / 10000,
      near_inv_phi: Math.abs(ml - INV_PHI) < LAMBDA_TOL,
      distance_from_inv_phi: Math.round(Math.abs(ml - INV_PHI) * 10000) / 10000,
      mean_cp: 0,
    };
  });

  // ── Summary ──────────────────────────────────────────────────────────────
  const dl2circ = circadianProbe.find(r => r.division_limit === 2)!;
  const dl1circ = circadianProbe.find(r => r.division_limit === 1)!;
  const dl3circ = circadianProbe.find(r => r.division_limit === 3)!;
  const dl2pulse = pulseRecovery.find(r => r.division_limit === 2)!;

  const dl2isClosest = dl2circ.distance_from_inv_phi < dl1circ.distance_from_inv_phi
                    && dl2circ.distance_from_inv_phi < dl3circ.distance_from_inv_phi;

  const keyFinding = dl2isClosest && dl2circ.near_inv_phi
    ? `Connection confirmed: division_limit=2 produces |λ| = ${dl2circ.mean_lambda} (±${dl2circ.sd_lambda}), the closest of all three division limits to 1/φ ≈ 0.618 in the circadian probe. The pulse recovery gives |λ| = ${dl2pulse.mean_lambda} — showing the circadian forcing is required to convert the Fibonacci spatial structure into the 1/φ temporal signal.`
    : dl2isClosest
    ? `division_limit=2 produces |λ| = ${dl2circ.mean_lambda} — closest to 1/φ ≈ 0.618 among all three division limits in the circadian probe (though outside the ±0.05 band). The pulse recovery gives |λ| = ${dl2pulse.mean_lambda}. Directional support for the space-time Fibonacci connection.`
    : `No clear preference for division_limit=2 in the circadian probe. division_limit=2: |λ| = ${dl2circ.mean_lambda} vs 1/φ ≈ 0.618. Pulse recovery: |λ| = ${dl2pulse.mean_lambda}. The Fibonacci connection is not recovered under these stochastic simulation parameters.`;

  const interpretation =
    `At ta = ${FIB_TA}, β = 2*(1-${FIB_TA})*${TR} = ${fibBeta.toFixed(4)} ≈ 1/φ. ` +
    `This is the Fibonacci progression factor — the fraction of first-stage TA cells that advance to the second stage equals 1/φ. ` +
    `Circadian probe (Stage B): |λ| with circadian forcing for dl=1: ${dl1circ.mean_lambda}, dl=2: ${dl2circ.mean_lambda}, dl=3: ${dl3circ.mean_lambda}. ` +
    `Pulse recovery (Stage C): |λ| without forcing for dl=2: ${dl2pulse.mean_lambda}. ` +
    `The contrast between Stage B and Stage C reveals whether the circadian clock is required to express the Fibonacci temporal signature.`;

  console.log(`[fib-connection] Complete. Key: ${keyFinding}`);

  return {
    calibration,
    fibonacci_ta: fibTa,
    fibonacci_beta: Math.round(fibBeta * 10000) / 10000,
    circadian_probe: circadianProbe,
    pulse_recovery: pulseRecovery,
    key_finding: keyFinding,
    interpretation,
    inv_phi: Math.round(INV_PHI * 10000) / 10000,
    phi: Math.round(GOLDEN_RATIO * 10000) / 10000,
  };
}

// ─── Phi-Ratio Convergence Test ───────────────────────────────────────────────

export interface PhiConvergenceStratumResult {
  label: string;
  total_runs: number;
  cp_converged: number;       // C/P within 20% of φ
  pd_converged: number;       // P/D within 20% of 1/φ
  both_converged: number;     // Both simultaneously
  cp_rate: number;
  pd_rate: number;
  both_rate: number;
  cp_fold: number;
  pd_fold: number;
  both_fold: number;
  cp_p: number;
  pd_p: number;
  both_p: number;
  cp_significant: boolean;
  both_significant: boolean;
  mean_cp_ratio: number;
  mean_pd_ratio: number;
}

export interface PhiConvergenceResult {
  total_runs: number;
  empirical_null_cp: number;   // overall C/P convergence rate (null for stratified tests)
  empirical_null_pd: number;
  empirical_null_both: number;
  null_pct_cp: string;
  null_pct_pd: string;
  null_pct_both: string;
  by_division_limit: PhiConvergenceStratumResult[];
  division_limit2_by_ta_rate: PhiConvergenceStratumResult[];
  key_finding: string;
  interpretation: string;
  phi_value: number;
  inv_phi_value: number;
}

/**
 * Direct test of the Boman/Fibonacci algebraic prediction (C(1,1) = M).
 *
 * The C(1,1) = M proof implies steady-state C/P → φ ≈ 1.618 and P/D → 1/φ ≈ 0.618.
 * This function asks: does division_limit=2 at ta≈0.382 produce this convergence
 * more reliably than other configurations?
 *
 * Null baseline = empirical overall convergence rate across all 1,080 runs.
 * Criterion: |C/P − φ| / φ < 0.20 (C/P convergence), |P/D − 1/φ| / (1/φ) < 0.20 (P/D).
 */
export function runPhiRatioConvergenceTest(): PhiConvergenceResult {
  const conditions: Array<{ name: string; overrides: Partial<BomanParams> }> = [
    { name: 'normal',              overrides: { mutationRate: 0 } },
    { name: 'normal_no_circadian', overrides: { circadianGating: false, mutationRate: 0 } },
    { name: 'FAP-like',            overrides: { asymmetricProb: 0.3, mutationRate: 0.005 } },
    { name: 'adenoma-like',        overrides: { asymmetricProb: 0.15, k1: 0.18, mutationRate: 0.01, apoptosisRate: 0.02 } },
    { name: 'high_wnt',            overrides: { wntStrength: 1.4, mutationRate: 0 } },
    { name: 'low_wnt',             overrides: { wntStrength: 0.4, mutationRate: 0 } },
    { name: 'strong_delay_feedback', overrides: { taApoptosisRate: 0.10, apoptosisRate: 0.08, transitionRate: 0.3, mutationRate: 0 } },
    { name: 'balanced_oscillator',   overrides: { taApoptosisRate: 0.35, circadianAmplitude: 0.35, transitionRate: 0.45, mutationRate: 0 } },
  ];

  const divisionLimits = [1, 2, 3];
  const taRates        = [0.05, 0.15, 0.30, 0.40, 0.50];
  const nicheSizes     = [8, 16, 24];
  const matDelays      = [2, 5, 8];
  const timeSteps      = 200;
  const reps           = 3;
  const CP_TOL         = 0.20;   // 20% of φ
  const PD_TOL         = 0.20;   // 20% of 1/φ

  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

  interface RunAccum { cp: number; pd: number; both: number; total: number; sumCp: number; sumPd: number; }
  const mkAccum = (): RunAccum => ({ cp: 0, pd: 0, both: 0, total: 0, sumCp: 0, sumPd: 0 });

  const byDiv: Record<number, RunAccum> = { 1: mkAccum(), 2: mkAccum(), 3: mkAccum() };
  const byTa:  Record<number, RunAccum> = {};
  for (const ta of taRates) byTa[ta] = mkAccum();
  const overall = mkAccum();

  let runCount = 0;
  for (const cond of conditions) {
    for (const niche of nicheSizes) {
      for (const matDelay of matDelays) {
        for (const divLimit of divisionLimits) {
          for (const taApo of taRates) {
            runCount++;
            if (runCount % 100 === 0) console.log(`[boman-phi-conv] Run ${runCount}/1080...`);

            const params: BomanParams = {
              nicheSize: niche,
              maturationDelay: matDelay,
              divisionLimit: divLimit,
              asymmetricProb: 0.6,
              apoptosisRate: 0.05,
              sheddingRate: 0.12,
              transitionRate: 0.5,
              taApoptosisRate: taApo,
              wntStrength: 0.9,
              circadianGating: true,
              circadianAmplitude: 0.25,
              mutationRate: 0,
              condition: cond.name,
              k1: 0.12,
              ...cond.overrides,
            };

            const simRows = runBomanSimulation(params, timeSteps, reps);

            const ssCs: number[] = [], ssPs: number[] = [], ssDs: number[] = [];
            for (let rep = 1; rep <= reps; rep++) {
              ssCs.push(steadyStateMean(extractTimeSeries(simRows, rep, 'C_cells')));
              ssPs.push(steadyStateMean(extractTimeSeries(simRows, rep, 'P_cells')));
              ssDs.push(steadyStateMean(extractTimeSeries(simRows, rep, 'D_cells')));
            }

            const meanC = avg(ssCs);
            const meanP = avg(ssPs);
            const meanD = avg(ssDs);

            const cpRatio = meanP > 0.1 ? meanC / meanP : 0;
            const pdRatio = meanD > 0.1 ? meanP / meanD : 0;

            const cpOk   = cpRatio > 0 && Math.abs(cpRatio - GOLDEN_RATIO) / GOLDEN_RATIO < CP_TOL;
            const pdOk   = pdRatio > 0 && Math.abs(pdRatio - INV_PHI) / INV_PHI < PD_TOL;
            const bothOk = cpOk && pdOk;

            const update = (acc: RunAccum) => {
              acc.total++;
              if (cpOk)   acc.cp++;
              if (pdOk)   acc.pd++;
              if (bothOk) acc.both++;
              acc.sumCp += cpRatio;
              acc.sumPd += pdRatio;
            };

            update(byDiv[divLimit]);
            update(overall);
            if (divLimit === 2) update(byTa[taApo]);
          }
        }
      }
    }
  }

  // Empirical null = overall rates across all 1,080 runs
  const nullCp   = overall.total > 0 ? overall.cp   / overall.total : 0;
  const nullPd   = overall.total > 0 ? overall.pd   / overall.total : 0;
  const nullBoth = overall.total > 0 ? overall.both / overall.total : 0;

  const makeStratum = (label: string, acc: RunAccum): PhiConvergenceStratumResult => {
    const n = acc.total;
    const cpRate   = n > 0 ? acc.cp   / n : 0;
    const pdRate   = n > 0 ? acc.pd   / n : 0;
    const bothRate = n > 0 ? acc.both / n : 0;
    const cpFold   = nullCp   > 0 ? cpRate   / nullCp   : 0;
    const pdFold   = nullPd   > 0 ? pdRate   / nullPd   : 0;
    const bothFold = nullBoth > 0 ? bothRate / nullBoth : 0;
    return {
      label,
      total_runs: n,
      cp_converged:   acc.cp,
      pd_converged:   acc.pd,
      both_converged: acc.both,
      cp_rate:   Math.round(cpRate   * 10000) / 100,
      pd_rate:   Math.round(pdRate   * 10000) / 100,
      both_rate: Math.round(bothRate * 10000) / 100,
      cp_fold:   Math.round(cpFold   * 100) / 100,
      pd_fold:   Math.round(pdFold   * 100) / 100,
      both_fold: Math.round(bothFold * 100) / 100,
      cp_p:   Math.round(binomialPValue(acc.cp,   n, nullCp)   * 10000) / 10000,
      pd_p:   Math.round(binomialPValue(acc.pd,   n, nullPd)   * 10000) / 10000,
      both_p: Math.round(binomialPValue(acc.both, n, nullBoth) * 10000) / 10000,
      cp_significant:   binomialPValue(acc.cp,   n, nullCp)   < 0.05,
      both_significant: binomialPValue(acc.both, n, nullBoth) < 0.05,
      mean_cp_ratio: acc.total > 0 ? Math.round((acc.sumCp / acc.total) * 1000) / 1000 : 0,
      mean_pd_ratio: acc.total > 0 ? Math.round((acc.sumPd / acc.total) * 1000) / 1000 : 0,
    };
  };

  const byDivResults = divisionLimits.map(d => makeStratum(`division_limit=${d}`, byDiv[d]));
  const byTaResults  = taRates.map(ta => makeStratum(`ta_apoptosis_rate=${ta}`, byTa[ta]));

  const dl2 = byDiv[2];
  const dl2CpRate   = dl2.total > 0 ? dl2.cp   / dl2.total : 0;
  const dl2BothRate = dl2.total > 0 ? dl2.both / dl2.total : 0;
  const dl2CpFold   = nullCp   > 0 ? dl2CpRate   / nullCp   : 0;
  const dl2BothFold = nullBoth > 0 ? dl2BothRate / nullBoth : 0;
  const dl2CpP      = binomialPValue(dl2.cp,   dl2.total, nullCp);
  const dl2BothP    = binomialPValue(dl2.both, dl2.total, nullBoth);

  const keyFinding = (dl2CpFold > 1.3 && dl2CpP < 0.05)
    ? `division_limit=2 shows ${dl2CpFold.toFixed(2)}× enrichment for C/P ≈ φ relative to the empirical null (p=${dl2CpP.toFixed(4)}). The algebraic prediction from C(1,1)=M is directly confirmed in stochastic simulation.`
    : (dl2BothFold > 1.3 && dl2BothP < 0.05)
    ? `division_limit=2 shows ${dl2BothFold.toFixed(2)}× enrichment for both C/P ≈ φ AND P/D ≈ 1/φ simultaneously (p=${dl2BothP.toFixed(4)}). The full Boman Fibonacci pair is confirmed in stochastic simulation.`
    : (dl2CpFold > 1.0)
    ? `division_limit=2 shows ${dl2CpFold.toFixed(2)}× enrichment for C/P ≈ φ vs empirical null (p=${dl2CpP.toFixed(4)}) — directional trend in the expected direction, but not significant.`
    : `No clear enrichment for C/P ≈ φ convergence at division_limit=2 vs empirical null. The Boman Fibonacci prediction is not recovered in stochastic simulation under these parameters.`;

  const interpretation = `1,080-run sweep. Empirical null rates — C/P≈φ: ${(nullCp*100).toFixed(1)}%, P/D≈1/φ: ${(nullPd*100).toFixed(1)}%, both: ${(nullBoth*100).toFixed(1)}%. ` +
    `division_limit=2: C/P rate=${dl2CpRate > 0 ? (dl2CpRate*100).toFixed(1) : 'N/A'}% (${dl2CpFold.toFixed(2)}×), both=${dl2BothRate > 0 ? (dl2BothRate*100).toFixed(1) : 'N/A'}% (${dl2BothFold.toFixed(2)}×). ` +
    `This tests the direct prediction of C(1,1)=M: the two-stage division recursion should produce steady-state C/P→φ and P/D→1/φ more reliably than 1- or 3-stage models.`;

  console.log(`[boman-phi-conv] Complete. ${runCount} runs. Key finding: ${keyFinding}`);

  return {
    total_runs: overall.total,
    empirical_null_cp:   Math.round(nullCp   * 10000) / 100,
    empirical_null_pd:   Math.round(nullPd   * 10000) / 100,
    empirical_null_both: Math.round(nullBoth * 10000) / 100,
    null_pct_cp:   `${(nullCp   * 100).toFixed(1)}%`,
    null_pct_pd:   `${(nullPd   * 100).toFixed(1)}%`,
    null_pct_both: `${(nullBoth * 100).toFixed(1)}%`,
    by_division_limit:          byDivResults,
    division_limit2_by_ta_rate: byTaResults,
    key_finding: keyFinding,
    interpretation,
    phi_value:     Math.round(GOLDEN_RATIO * 10000) / 10000,
    inv_phi_value: Math.round(INV_PHI      * 10000) / 10000,
  };
}
