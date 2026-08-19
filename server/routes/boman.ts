import type { Express, Request, Response } from "express";
import { logger } from "../logger";
import { storage } from "../storage";
import fs from "fs";
import path from "path";
import { checkPasswordRateLimit, recordFailedAttempt, clearAttempts } from "./analytics";
import {
  runDrmrefValidation
} from "../drmref-validation";
import { runDiagnosticsAnalysis } from "../ar2-diagnostics";
import { runAR1Benchmark } from "../ar1-benchmark";
import { runRhythmMatchedCoupling } from "../rhythm-matched-coupling";
import { runCancerStateSwapAnalysis } from "../cancer-state-swap";
import { runBloodAnalysis, runOrganoidAnalysis } from "../drug-durability-live";
import { runMinimalABM } from "../abm-minimal-crypt";
import {
  detectScale,
  harmonizeTransform,
  checkScaleMixing,
  compareToRegistry,
  getReferenceFingerprints,
  getReferenceAtlas,
  matchDatasetFingerprint,
} from "../scaleGuardrail";

export function registerBomanRoutes(app: Express, upload: any): void {
  app.get("/api/boman-simulation/generate", async (req, res) => {
    try {
      const { generateAllFiles } = await import('../boman-simulation');
      const files = generateAllFiles();
      res.json({
        files: [
          { name: 'boman_simulation_timeseries.csv', size: files.timeseriesCSV.length, description: 'Boman-rule crypt simulation time series (first 20 parameter combos × 3 replicates × 200 timesteps; all normal condition; simulation_id = replicate 1–3)' },
          { name: 'boman_parameter_sweep.csv', size: files.sweepCSV.length, description: 'Parameter sweep with AR(2) fits across 1,080 parameter combinations (8 conditions × 3 niche sizes × 3 maturation delays × 3 division limits × 5 TA apoptosis rates)' },
          { name: 'fibonacci_consistent_region.csv', size: files.fibRegionCSV.length, description: 'Fibonacci-consistent region in (φ₁,φ₂) coefficient space' },
          { name: 'ar2_coefficient_space.csv', size: files.coefficientSpaceCSV.length, description: 'Per-compartment AR(2) coefficients with eigenvalue decomposition' },
        ]
      });
    } catch (error) {
      logger.error('Boman simulation generation error', { error: String(error) });
      res.status(500).json({ error: 'Simulation failed', details: String(error) });
    }
  });

  app.get("/api/boman-simulation/download/:fileType", async (req, res) => {
    try {
      const { generateAllFiles } = await import('../boman-simulation');
      const files = generateAllFiles();
      const fileType = req.params.fileType;

      let csv: string;
      let filename: string;

      switch (fileType) {
        case 'timeseries':
          csv = files.timeseriesCSV;
          filename = 'boman_simulation_timeseries.csv';
          break;
        case 'sweep':
          csv = files.sweepCSV;
          filename = 'boman_parameter_sweep.csv';
          break;
        case 'fibonacci-region':
          csv = files.fibRegionCSV;
          filename = 'fibonacci_consistent_region.csv';
          break;
        case 'coefficient-space':
          csv = files.coefficientSpaceCSV;
          filename = 'ar2_coefficient_space.csv';
          break;
        case 'all':
          const archiver = (await import('archiver')).default;
          const archive = archiver('zip', { zlib: { level: 9 } });
          res.setHeader('Content-Type', 'application/zip');
          res.setHeader('Content-Disposition', 'attachment; filename="boman_ar2_simulation_package.zip"');
          archive.pipe(res);
          archive.append(files.timeseriesCSV, { name: 'boman_simulation_timeseries.csv' });
          archive.append(files.sweepCSV, { name: 'boman_parameter_sweep.csv' });
          archive.append(files.fibRegionCSV, { name: 'fibonacci_consistent_region.csv' });
          archive.append(files.coefficientSpaceCSV, { name: 'ar2_coefficient_space.csv' });

          const readme = `# Boman-Style Crypt Simulation → AR(2) Bridge Files
Generated: ${new Date().toISOString()}

## File Descriptions

### 1. boman_simulation_timeseries.csv
Synthetic time-series from a Boman-rule crypt simulation.
- Columns: simulation_id, time, C_cells (stem), P_cells (proliferating), D_cells (differentiated), Lgr5_like, Wnt_like, Bmal1_like, mutation_load, condition
- First 20 parameter combinations × 3 replicates × 200 timesteps = 12,000 rows (all normal condition)
- Note: simulation_id encodes replicate number (1–3), not run number; all rows are from the normal condition
- To view disease/signaling conditions, use boman_parameter_sweep.csv

### 2. boman_parameter_sweep.csv
Parameter sweep across 1,080 combinations with AR(2) fitted to each.
- 8 conditions × 3 niche sizes × 3 maturation delays × 3 division limits (1/2/3) × 5 TA apoptosis rates = 1,080 rows
- Columns: run_id, niche_size, maturation_delay, division_limit, asymmetric_prob, apoptosis_rate, ta_apoptosis_rate, transition_rate, phi1_C, phi2_C, lambda_modulus_C, ..., fib_ratio_C, pattern_class, fib_distance, steady_state_C_P_ratio, steady_state_P_D_ratio, phi_ratio_convergence, condition
- AR(2) fits for all 3 compartments (C=stem, P=proliferating, D=differentiated); each fit is averaged across 3 replicates
- fib_ratio_C = |phi1_C/phi2_C|; Fibonacci-consistent when ≈ φ (1.618). Achieved at ta_apoptosis_rate ≈ 0.382 ≈ 1/φ² with division_limit=2
- steady_state_C_P_ratio and steady_state_P_D_ratio: compare to Boman's prediction that cell ratios approach φ and 1/φ at steady state
- Conditions: normal, normal_no_circadian, FAP-like, adenoma-like, high_wnt, low_wnt, strong_delay_feedback, balanced_oscillator
- Pattern classification: normal, Fibonacci-consistent, Fibonacci-adjacent, Lucas-like, FAP-like, adenoma-like

### 3. fibonacci_consistent_region.csv
Parameterized definition of the "Fibonacci-consistent region" in (φ₁,φ₂) space.
- Columns: phi1, phi2, region_label, distance_to_phi_family, lambda_modulus, root_type, eigenperiod, is_stable
- Region labels: fib_core (|ratio−φ|<0.05), fib_consistent (<0.15), fib_adjacent (<0.30)
- Covers the stable triangle where |λ|<1

### 4. ar2_coefficient_space.csv
Per-compartment AR(2) coefficients with full eigenvalue decomposition (first 100 parameter sweep runs only).
- Columns: gene (compartment name: Stem_Cell_Pool / Proliferating_Pool / Differentiated_Pool), dataset (sim_run_N_condition), phi1, phi2, root1_real, root1_imag, root2_real, root2_imag, lambda_modulus, root_type, category, fib_distance, pattern_class
- 300 rows: 100 runs × 3 compartments
- Note: all data are simulation-derived; the "gene" column holds compartment labels, not real gene names. No empirical dataset is included in this package.

## Simulation Model
The Boman-style crypt model implements genuine Boman division-limit mechanics:
- Stem cell niche with size-dependent feedback (carrying capacity)
- Asymmetric vs symmetric division with configurable probability
- TA pool tracked as an array of discrete division-stage cohorts (Boman's N)
  - Each stage transition doubles the cohort (one cell → two cells upon division)
  - Cells completing stage N → differentiated pool (×2 each)
  - No artificial k3 parameter: the delay structure is mechanistic, not tuned
- Differentiated cell compartment with shedding/extrusion
- Optional circadian gating (BMAL1-like 24h modulation of division rate)
- Wnt signaling strength affecting niche regulation
- Stochastic noise (Gaussian) on all compartments
- Mutation accumulation for disease conditions

## Key Parameters (v2 — cohort-based)
- k1: Stem cell division rate
- division_limit: Boman's N — TA cells divide exactly N times before differentiating (1, 2, or 3)
- ta_apoptosis_rate: per-stage TA cell apoptosis (biologically grounded; replaces artificial k3)
- transition_rate: rate TA cells advance through division stages (fixed 0.5)
- asymmetric_prob: probability of asymmetric stem-cell division
- apoptosis_rate: stem-compartment apoptosis rate

## Fibonacci Connection (mechanistically derived)
The "Fibonacci-consistent region" is defined by |φ₁/φ₂| ≈ φ (golden ratio ≈ 1.618).
With division_limit=2 and transition_rate=0.5, the golden-ratio condition arises when:
  transition_rate × (1 − ta_apoptosis_rate) ≈ 1/(2φ) ≈ 0.309
which gives ta_apoptosis_rate ≈ 0.382 ≈ 1/φ².
This is a biologically testable prediction: at this specific TA loss rate, the two-stage
division structure produces Fibonacci-consistent AR(2) coefficients. It is an exploratory
conjecture, not a theorem — the empirical emergence in the sweep is the demonstration.

## Citation
Generated by PAR(2) Discovery Engine Boman Simulation Module.
For use with: "Fibonacci-like temporal dynamics in intestinal crypt renewal"
`;
          archive.append(readme, { name: 'README.md' });
          await archive.finalize();
          return;
        default:
          return res.status(400).json({ error: 'Invalid file type. Use: timeseries, sweep, fibonacci-region, coefficient-space, or all' });
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (error) {
      logger.error('Boman simulation download error', { error: String(error) });
      res.status(500).json({ error: 'Download failed', details: String(error) });
    }
  });

  app.get("/api/boman-ode/validate", async (req, res) => {
    try {
      const { runOdeValidation } = await import('../boman-ode-validation');
      const result = runOdeValidation();
      res.json(result);
    } catch (error) {
      logger.error('Boman ODE validation error', { error: String(error) });
      res.status(500).json({ error: 'ODE validation failed', details: String(error) });
    }
  });

  app.get("/api/boman-ode/sampling-sensitivity", async (req, res) => {
    try {
      const { runSamplingRateSensitivity } = await import('../boman-ode-validation');
      const result = runSamplingRateSensitivity();
      res.json(result);
    } catch (error) {
      logger.error('Boman ODE sampling sensitivity error', { error: String(error) });
      res.status(500).json({ error: 'Sampling sensitivity analysis failed', details: String(error) });
    }
  });

  app.get("/api/boman-ode/jacobian-fibonacci", async (req, res) => {
    try {
      const PHI = (1 + Math.sqrt(5)) / 2;   // ≈ 1.6180
      const INV_PHI = 1 / PHI;              // ≈ 0.6180
      const SQRT_PHI = Math.sqrt(PHI);      // ≈ 1.2720  — the imaginary part of J eigenvalues
      const k1 = 1.0;
      const k2 = 5.882;                     // Normal crypt value (k2 = k1/P*)
      const k4 = 1.0;
      const k3 = 3.882;

      // ── Fibonacci fixed point: C*/P* = φ requires k5 = φ·k1 ─────────────────
      const k5_fib = PHI * k1;             // ≈ 1.6180
      const C_star = k5_fib / k2;          // ≈ 0.2752
      const P_star = k1 / k2;              // ≈ 0.1700
      const D_star = (k1 * k3) / (k2 * k4);
      const cp_ratio = C_star / P_star;    // = k5/k1 = φ exactly

      // ── Jacobian at equilibrium (C-P block, D decoupled) ─────────────────────
      // J_CP = [[0, -k5], [k1, 0]]  (substituting C*=k5/k2, P*=k1/k2)
      const J_CP = [[0, -k5_fib], [k1, 0]];
      // Characteristic polynomial of J_CP: λ² + k1·k5_fib = λ² + φ = 0
      // Eigenvalues: λ = ±i√φ  (PURELY IMAGINARY)
      const jac_char_coeff = k1 * k5_fib; // = φ; polynomial is λ² + φ = 0
      const jac_eigenvalue_real = 0;
      const jac_eigenvalue_imag = SQRT_PHI; // ±i√φ
      const jac_eigenvalue_modulus = SQRT_PHI; // |±i√φ| = √φ ≈ 1.272 (NOT 1/φ)

      // ── Run ODE perturbation recovery numerically ────────────────────────────
      // Perturb 20% above equilibrium, integrate for 120 time-units, sample every 0.5
      const dt = 0.01;
      const T = 120;
      const steps = Math.floor(T / dt);
      let C = C_star * 1.20;
      let P = P_star * 0.80;
      let D = D_star;
      const seriesP: number[] = [];
      const sampleEvery = Math.round(0.5 / dt);
      for (let i = 0; i <= steps; i++) {
        if (i % sampleEvery === 0) seriesP.push(P);
        const dC = (k1 - k2 * P) * C;
        const dP = (k2 * C - k5_fib) * P;
        const dD = k3 * P - k4 * D;
        C += dC * dt;
        P += dP * dt;
        D += dD * dt;
        if (C < 1e-9) C = 1e-9;
        if (P < 1e-9) P = 1e-9;
        if (D < 0) D = 0;
      }

      // AR(2) fit of the recovery trajectory
      const n = seriesP.length;
      const y: number[] = [], X: number[][] = [];
      for (let t = 2; t < n; t++) {
        y.push(seriesP[t]);
        X.push([1, seriesP[t-1], seriesP[t-2]]);
      }
      const m = y.length;
      const XtX = [[0,0,0],[0,0,0],[0,0,0]];
      const Xty = [0,0,0];
      for (let i = 0; i < m; i++) {
        for (let j = 0; j < 3; j++) {
          Xty[j] += X[i][j] * y[i];
          for (let k = 0; k < 3; k++) XtX[j][k] += X[i][j] * X[i][k];
        }
      }
      const det = XtX[0][0]*(XtX[1][1]*XtX[2][2]-XtX[1][2]*XtX[2][1])
                - XtX[0][1]*(XtX[1][0]*XtX[2][2]-XtX[1][2]*XtX[2][0])
                + XtX[0][2]*(XtX[1][0]*XtX[2][1]-XtX[1][1]*XtX[2][0]);
      const invDet = Math.abs(det) < 1e-12 ? 0 : 1/det;
      const inv = [
        [(XtX[1][1]*XtX[2][2]-XtX[1][2]*XtX[2][1])*invDet,(XtX[0][2]*XtX[2][1]-XtX[0][1]*XtX[2][2])*invDet,(XtX[0][1]*XtX[1][2]-XtX[0][2]*XtX[1][1])*invDet],
        [(XtX[1][2]*XtX[2][0]-XtX[1][0]*XtX[2][2])*invDet,(XtX[0][0]*XtX[2][2]-XtX[0][2]*XtX[2][0])*invDet,(XtX[0][2]*XtX[1][0]-XtX[0][0]*XtX[1][2])*invDet],
        [(XtX[1][0]*XtX[2][1]-XtX[1][1]*XtX[2][0])*invDet,(XtX[0][1]*XtX[2][0]-XtX[0][0]*XtX[2][1])*invDet,(XtX[0][0]*XtX[1][1]-XtX[0][1]*XtX[1][0])*invDet],
      ];
      let phi1 = 0, phi2 = 0;
      for (let k = 0; k < 3; k++) { phi1 += inv[1][k]*Xty[k]; phi2 += inv[2][k]*Xty[k]; }
      const disc = phi1*phi1 + 4*phi2;
      let ar2_lambda: number, ar2_phi2 = phi2;
      if (disc >= 0) {
        const sq = Math.sqrt(disc);
        ar2_lambda = Math.max(Math.abs((phi1+sq)/2), Math.abs((phi1-sq)/2));
      } else {
        ar2_lambda = Math.sqrt(phi1*phi1/4 - phi2);
      }

      // Sampling interval 0.5 → theory: φ₁ = 2cos(√φ · 0.5)
      const deltaT = 0.5;
      const theoretical_phi1 = 2 * Math.cos(SQRT_PHI * deltaT);
      const theoretical_phi2 = -1;
      const theoretical_ar2_lambda = 1.0; // neutral oscillator → |λ| = 1

      // Oscillation period
      const period = (2 * Math.PI) / SQRT_PHI; // ≈ 4.94 time-units

      res.json({
        // Fibonacci fixed point
        fibonacci_fixed_point: {
          condition: "k₅ = φ·k₁",
          k1, k2, k3, k4, k5: parseFloat(k5_fib.toFixed(4)),
          C_star: parseFloat(C_star.toFixed(4)),
          P_star: parseFloat(P_star.toFixed(4)),
          D_star: parseFloat(D_star.toFixed(4)),
          cp_ratio: parseFloat(cp_ratio.toFixed(4)),
          phi: parseFloat(PHI.toFixed(4)),
          cp_equals_phi: Math.abs(cp_ratio - PHI) < 0.001,
        },
        // Jacobian
        jacobian: {
          J_CP: J_CP.map(r => r.map(v => parseFloat(v.toFixed(4)))),
          J_CP_symbolic: "[[0, −φ], [1, 0]]",
          char_poly_symbolic: "λ² + φ = 0",
          char_poly_coeff: parseFloat(jac_char_coeff.toFixed(4)),
          eigenvalue_real: jac_eigenvalue_real,
          eigenvalue_imag: parseFloat(jac_eigenvalue_imag.toFixed(4)),
          eigenvalue_modulus: parseFloat(jac_eigenvalue_modulus.toFixed(4)),
          eigenvalue_symbolic: "±i√φ",
          type: "purely imaginary — neutral (conservative) oscillation",
          oscillation_frequency_omega: parseFloat(SQRT_PHI.toFixed(4)),
          oscillation_period: parseFloat(period.toFixed(4)),
        },
        // Fibonacci polynomial for comparison
        fibonacci_polynomial: {
          expression: "x² − x − 1 = 0",
          roots: [parseFloat(PHI.toFixed(4)), parseFloat((-INV_PHI).toFixed(4))],
          root_moduli: [parseFloat(PHI.toFixed(4)), parseFloat(INV_PHI.toFixed(4))],
        },
        // AR(2) of the numerical recovery
        numerical_ar2: {
          phi1: parseFloat(phi1.toFixed(4)),
          phi2: parseFloat(phi2.toFixed(4)),
          lambda_modulus: parseFloat(ar2_lambda.toFixed(4)),
          theoretical_phi1: parseFloat(theoretical_phi1.toFixed(4)),
          theoretical_phi2,
          theoretical_lambda: theoretical_ar2_lambda,
          delta_t: deltaT,
          series_length: seriesP.length,
        },
        // Comparison
        comparison: {
          jacobian_char_poly: "λ² + φ = 0",
          fibonacci_poly: "x² − x − 1 = 0",
          are_same_polynomial: false,
          jacobian_eigenvalue_modulus: parseFloat(SQRT_PHI.toFixed(4)),
          fibonacci_small_root_modulus: parseFloat(INV_PHI.toFixed(4)),
          ar2_lambda_neutral_oscillator: 1.0,
          ar2_lambda_circadian_data: parseFloat(INV_PHI.toFixed(4)),
          conclusion: "The Boman ODE at the Fibonacci fixed point is a conservative oscillator. Its Jacobian characteristic polynomial (λ²+φ=0) is NOT the Fibonacci polynomial (x²−x−1=0). The purely imaginary eigenvalues (±i√φ) give neutral oscillation: |λ|_AR2 = 1, not 1/φ. The spatial Fibonacci structure (C*/P*→φ) and the temporal AR(2) signature (|λ|≈1/φ in real circadian data) do not arise from the same polynomial in the Boman ODE. The space-time connection, if real, requires a mechanism that introduces genuine damping — not present in the conservative Boman equilibrium.",
        },
      });
    } catch (error) {
      logger.error('Jacobian Fibonacci analysis error', { error: String(error) });
      res.status(500).json({ error: 'Jacobian Fibonacci analysis failed', details: String(error) });
    }
  });

  app.get("/api/ar2-integrity-check", async (req, res) => {
    try {
      const { runIntegrityCheck } = await import('../ar2-integrity');
      const result = runIntegrityCheck();
      res.json(result);
    } catch (error) {
      logger.error('AR(2) integrity check error', { error: String(error) });
      res.status(500).json({ error: 'Integrity check failed', details: String(error) });
    }
  });

  app.get("/api/clock-target-phi-enrichment", async (req, res) => {
    try {
      const { runPhiEnrichmentAnalysis } = await import('../clock-target-phi-enrichment');
      const result = await runPhiEnrichmentAnalysis();
      res.json(result);
    } catch (error) {
      logger.error('Clock target phi enrichment error', { error: String(error) });
      res.status(500).json({ error: 'Phi enrichment analysis failed', details: String(error) });
    }
  });

  app.get("/api/floquet-analysis", async (req, res) => {
    try {
      const { runFloquetAnalysis } = await import('../floquet-analysis');
      const result = runFloquetAnalysis();
      res.json(result);
    } catch (error) {
      logger.error('Floquet analysis error', { error: String(error) });
      res.status(500).json({ error: 'Floquet analysis failed', details: String(error) });
    }
  });

  app.get("/api/phi-enrichment-replication", async (req, res) => {
    try {
      const { runReplicationAnalysis } = await import('../phi-enrichment-replication');
      const results = await runReplicationAnalysis();
      res.json(results);
    } catch (error) {
      logger.error('Phi enrichment replication error', { error: String(error) });
      res.status(500).json({ error: 'Replication analysis failed', details: String(error) });
    }
  });

  app.get("/api/boman-simulation/enrichment", async (req, res) => {
    try {
      const { runEnrichmentAnalysis } = await import('../boman-simulation');
      const result = runEnrichmentAnalysis();
      res.json(result);
    } catch (error) {
      logger.error('Boman enrichment analysis error', { error: String(error) });
      res.status(500).json({ error: 'Enrichment analysis failed', details: String(error) });
    }
  });

  app.get("/api/boman-simulation/enrichment/full", async (req, res) => {
    try {
      const { runFullEnrichmentAnalysis } = await import('../boman-simulation');
      const result = runFullEnrichmentAnalysis();
      res.json(result);
    } catch (error) {
      logger.error('Boman full enrichment analysis error', { error: String(error) });
      res.status(500).json({ error: 'Full enrichment analysis failed', details: String(error) });
    }
  });

  app.get("/api/boman-simulation/phi-convergence", async (req, res) => {
    try {
      const { runPhiRatioConvergenceTest } = await import('../boman-simulation');
      const result = runPhiRatioConvergenceTest();
      res.json(result);
    } catch (error) {
      logger.error('Boman phi-ratio convergence test error', { error: String(error) });
      res.status(500).json({ error: 'Phi-ratio convergence test failed', details: String(error) });
    }
  });

  app.get("/api/boman-simulation/fibonacci-connection", async (req, res) => {
    try {
      const { runFibonacciConnectionTest } = await import('../boman-simulation');
      const result = runFibonacciConnectionTest();
      res.json(result);
    } catch (error) {
      logger.error('Boman Fibonacci connection test error', { error: String(error) });
      res.status(500).json({ error: 'Fibonacci connection test failed', details: String(error) });
    }
  });

  app.get("/api/drug-durability/drmref-validation", async (req, res) => {
    try {
      const result = runDrmrefValidation();
      res.json(result);
    } catch (error) {
      logger.error('DRMref validation error', { error: String(error) });
      res.status(500).json({ error: "DRMref validation failed", details: String(error) });
    }
  });

  let diagnosticsCache: any = null;
  app.get("/api/ar2-diagnostics", (req, res) => {
    try {
      if (!diagnosticsCache) {
        diagnosticsCache = runDiagnosticsAnalysis();
      }
      res.json(diagnosticsCache);
    } catch (error) {
      logger.error('AR2 diagnostics error', { error: String(error) });
      res.status(500).json({ error: "AR2 diagnostics failed", details: String(error) });
    }
  });

  let ar1BenchmarkCache: any = null;
  app.get("/api/cross-species-phi", async (req, res) => {
    try {
      const { runCrossSpeciesPhiAnalysis } = await import('../cross-species-phi-analysis');
      const result = runCrossSpeciesPhiAnalysis();
      res.json(result);
    } catch (error) {
      logger.error('Cross-species phi analysis error', { error: String(error) });
      res.status(500).json({ error: "Analysis failed", details: String(error) });
    }
  });

  /**
   * GET /api/arabidopsis/cell-type-eigenvalues
   * Bulk vs snRNA-seq cell-type-specific AR(2) eigenvalue comparison.
   * Returns bulk values from GSE242964/GSE19271 immediately.
   * Per-cluster snRNA-seq values populated once Qin et al. 2025 data is downloaded
   * (place CSVs as datasets/GSE_Qin2025_Arabidopsis_snRNAseq_pseudobulk_{S0...}.csv).
   * Ref: Qin et al. 2025, Nat Commun 16:4171 (DOI: 10.1038/s41467-025-59424-8)
   */
  app.get("/api/arabidopsis/cell-type-eigenvalues", async (req, res) => {
    try {
      const { runBulkVsSnRNAComparison } = await import('../cross-species-phi-analysis');
      const result = runBulkVsSnRNAComparison();
      res.json(result);
    } catch (error) {
      logger.error('Arabidopsis bulk vs snRNA-seq comparison error', { error: String(error) });
      res.status(500).json({ error: "Analysis failed", details: String(error) });
    }
  });

  app.get("/api/ar1-benchmark", (req, res) => {
    try {
      if (!ar1BenchmarkCache) {
        ar1BenchmarkCache = runAR1Benchmark();
      }
      res.json(ar1BenchmarkCache);
    } catch (error) {
      logger.error('AR1 benchmark error', { error: String(error) });
      res.status(500).json({ error: "AR1 benchmark failed", details: String(error) });
    }
  });

  let rhythmCouplingCache: any = null;
  app.get("/api/rhythm-matched-coupling", (req, res) => {
    try {
      if (!rhythmCouplingCache) {
        rhythmCouplingCache = runRhythmMatchedCoupling();
      }
      res.json(rhythmCouplingCache);
    } catch (error) {
      logger.error('Rhythm-matched coupling error', { error: String(error) });
      res.status(500).json({ error: "Rhythm-matched coupling failed", details: String(error) });
    }
  });

  app.get("/api/cancer-state-swap", (req, res) => {
    try {
      const result = runCancerStateSwapAnalysis();
      res.json(result);
    } catch (error) {
      logger.error('Cancer state-swap analysis error', { error: String(error) });
      res.status(500).json({ error: "Cancer state-swap analysis failed", details: String(error) });
    }
  });

  app.get("/api/drug-durability/live/blood", (req, res) => {
    try {
      const result = runBloodAnalysis();
      res.json(result);
    } catch (error) {
      logger.error('Live blood analysis error', { error: String(error) });
      res.status(500).json({ error: "Live blood analysis failed", details: String(error) });
    }
  });

  app.get("/api/drug-durability/live/organoid", (req, res) => {
    try {
      const result = runOrganoidAnalysis();
      res.json(result);
    } catch (error) {
      logger.error('Live organoid analysis error', { error: String(error) });
      res.status(500).json({ error: "Live organoid analysis failed", details: String(error) });
    }
  });

  app.post("/api/drug-durability/verify", (req, res) => {
    if (!checkPasswordRateLimit(req, res)) return;
    const { password } = req.body;
    const expectedPassword = process.env.DOWNLOAD_PROTECT_PASSWORD;
    if (!expectedPassword || password !== expectedPassword) {
      return recordFailedAttempt(req, res);
    }
    clearAttempts(req);
    res.json({ success: true });
  });

  app.post("/api/bacterial-persistence/verify", (req, res) => {
    if (!checkPasswordRateLimit(req, res)) return;
    const { password } = req.body;
    const expectedPassword = process.env.DOWNLOAD_PROTECT_PASSWORD;
    if (!expectedPassword || password !== expectedPassword) {
      return recordFailedAttempt(req, res);
    }
    clearAttempts(req);
    res.json({ success: true });
  });

  app.post("/api/verify-admin", (req, res) => {
    if (!checkPasswordRateLimit(req, res)) return;
    const { password } = req.body;
    const expectedPassword = process.env.DOWNLOAD_PROTECT_PASSWORD;
    if (!expectedPassword) {
      return res.json({ valid: false, error: "Admin access not configured" });
    }
    const valid = password === expectedPassword;
    if (!valid) {
      return recordFailedAttempt(req, res);
    }
    clearAttempts(req);
    res.json({ valid });
  });

  app.get("/api/abm-minimal/run", (req, res) => {
    try {
      const result = runMinimalABM();
      res.json(result);
    } catch (error) {
      logger.error('ABM simulation error', { error: String(error) });
      res.status(500).json({ error: "ABM simulation failed", details: String(error) });
    }
  });

  // Validation statistics - 360,000 stress test and negative control results
  app.get("/api/validation/summary", (req, res) => {
    try {
      const stressTestPath = path.join(process.cwd(), 'SIMULATION_STRESS_TEST_REPRODUCIBLE.json');
      const negativeControlPath = path.join(process.cwd(), 'NEGATIVE_CONTROL_REPRODUCIBLE.json');
      
      let stressTest = null;
      let negativeControl = null;
      
      if (fs.existsSync(stressTestPath)) {
        const raw = JSON.parse(fs.readFileSync(stressTestPath, 'utf-8'));
        stressTest = {
          timestamp: raw.timestamp,
          totalSimulations: raw.reproducibility.numSeeds * raw.reproducibility.simulationsPerSeed,
          numSeeds: raw.reproducibility.numSeeds,
          simulationsPerSeed: raw.reproducibility.simulationsPerSeed,
          defaultSeed: raw.reproducibility.defaultSeed,
          fdr: {
            mean: raw.summaryStats.combinedFDR.mean,
            std: raw.summaryStats.combinedFDR.std,
            ci95: raw.summaryStats.combinedFDR.ci95,
            range: [raw.summaryStats.combinedFDR.min, raw.summaryStats.combinedFDR.max]
          },
          power: {
            mean: raw.summaryStats.power.mean,
            std: raw.summaryStats.power.std
          },
          stability: {
            mean: raw.summaryStats.ar2PhiStability.mean,
            std: raw.summaryStats.ar2PhiStability.std
          }
        };
      }
      
      if (fs.existsSync(negativeControlPath)) {
        const raw = JSON.parse(fs.readFileSync(negativeControlPath, 'utf-8'));
        negativeControl = {
          timestamp: raw.timestamp,
          dataSource: raw.dataSource,
          numSeeds: raw.reproducibility.numSeeds,
          tissuesAnalyzed: raw.reproducibility.tissuesAnalyzed,
          defaultSeed: raw.reproducibility.defaultSeed,
          phiRate: {
            mean: raw.summaryStats.phiRateStable.mean,
            std: raw.summaryStats.phiRateStable.std,
            ci95: raw.summaryStats.phiRateStable.ci95
          },
          enrichment: {
            originalPanel: raw.comparison.originalEnrichment,
            controlPanel: raw.comparison.controlEnrichment,
            foldDifference: raw.comparison.foldDifference
          },
          controlPassed: raw.controlPassed
        };
      }
      
      res.json({
        available: !!(stressTest || negativeControl),
        stressTest,
        negativeControl,
        interpretation: {
          stressTest: stressTest ? 
            `FDR ${stressTest.fdr.mean.toFixed(1)}% ± ${stressTest.fdr.std.toFixed(1)}% across ${stressTest.totalSimulations.toLocaleString()} simulations (${stressTest.numSeeds} seeds × ${stressTest.simulationsPerSeed.toLocaleString()} runs). 95% CI: [${stressTest.fdr.ci95[0].toFixed(1)}%, ${stressTest.fdr.ci95[1].toFixed(1)}%].` :
            null,
          negativeControl: negativeControl ?
            `Random gene panel φ-rate: ${negativeControl.phiRate.mean.toFixed(1)}% ± ${negativeControl.phiRate.std.toFixed(1)}% vs curated panel enrichment of ${negativeControl.enrichment.originalPanel}× (${negativeControl.enrichment.foldDifference.toFixed(0)}× specificity).` :
            null
        }
      });
    } catch (error) {
      console.error("Error loading validation summary:", error);
      res.status(500).json({ error: "Failed to load validation summary" });
    }
  });

  // ============================================
  // SCALE GUARDRAIL API ENDPOINTS
  // ============================================

  // Get reference fingerprints for tissue comparison
  app.get("/api/guardrail/fingerprints", (req, res) => {
    try {
      const fingerprints = getReferenceFingerprints();
      res.json({
        count: fingerprints.length,
        fingerprints: fingerprints.map(fp => ({
          tissue: fp.tissue,
          organism: fp.organism,
          platform: fp.platform,
          datasetId: fp.datasetId,
          nGenes: fp.nGenes,
          lambdaMean: fp.lambdaMean,
          lambdaStd: fp.lambdaStd,
          lambdaRange: fp.lambdaRange
        }))
      });
    } catch (error) {
      logger.error("Error fetching fingerprints", { error: String(error) });
      res.status(500).json({ error: "Failed to fetch fingerprints" });
    }
  });

  // Detect scale of uploaded data
  app.post("/api/guardrail/detect-scale", upload.single('file'), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const content = req.file.buffer.toString('utf-8');
      const lines = content.trim().split('\n');
      const values: number[][] = lines.slice(1).map(line => 
        line.split(',').slice(1).map(v => parseFloat(v)).filter(v => !isNaN(v))
      );

      const detection = detectScale(values);
      
      res.json({
        fileName: req.file.originalname,
        detection: {
          scale: detection.detectedScale,
          confidence: detection.confidence,
          evidence: detection.evidence,
          warnings: detection.warnings,
          stats: detection.stats
        },
        recommendation: detection.detectedScale === 'log2' 
          ? 'Data appears to be log2-transformed. No additional transform needed.'
          : `Data appears to be ${detection.detectedScale}. Apply log2 transform for valid AR(2) comparison.`
      });
    } catch (error) {
      logger.error("Error detecting scale", { error: String(error) });
      res.status(500).json({ error: "Failed to detect scale" });
    }
  });

  // Apply harmonized transform and get report
  app.post("/api/guardrail/harmonize", upload.single('file'), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const content = req.file.buffer.toString('utf-8');
      const lines = content.trim().split('\n');
      const values: number[][] = lines.slice(1).map(line => 
        line.split(',').slice(1).map(v => parseFloat(v)).filter(v => !isNaN(v))
      );

      const forceTransform = req.body.forceTransform as 'log2' | 'none' | undefined;
      const result = harmonizeTransform(values, req.file.originalname, forceTransform);
      
      res.json({
        fileName: req.file.originalname,
        report: result.report,
        transformApplied: result.appliedTransform !== 'none'
      });
    } catch (error) {
      logger.error("Error harmonizing data", { error: String(error) });
      res.status(500).json({ error: "Failed to harmonize data" });
    }
  });

  // Compare λ distribution to reference fingerprints
  app.post("/api/guardrail/compare-fingerprint", (req, res) => {
    try {
      const { lambdaValues, tissue } = req.body;
      
      if (!lambdaValues || typeof lambdaValues !== 'object') {
        return res.status(400).json({ error: "lambdaValues object required" });
      }

      const comparison = compareToRegistry(lambdaValues, tissue);
      
      res.json({
        inputMean: Object.values(lambdaValues as Record<string, number>)
          .filter((v): v is number => !isNaN(v))
          .reduce((a, b) => a + b, 0) / Object.values(lambdaValues).length,
        closestMatch: comparison.closestMatch ? {
          tissue: comparison.closestMatch.tissue,
          organism: comparison.closestMatch.organism,
          datasetId: comparison.closestMatch.datasetId,
          lambdaMean: comparison.closestMatch.lambdaMean
        } : null,
        similarity: comparison.similarity,
        interpretation: comparison.similarity > 0.7 
          ? `Strong match to ${comparison.closestMatch?.tissue} reference (${(comparison.similarity * 100).toFixed(0)}% similarity)`
          : comparison.similarity > 0.5
            ? `Moderate match to ${comparison.closestMatch?.tissue} reference (${(comparison.similarity * 100).toFixed(0)}% similarity)`
            : `Weak match - may represent novel tissue/condition`,
        allComparisons: comparison.allComparisons.map(c => ({
          tissue: c.fingerprint.tissue,
          organism: c.fingerprint.organism,
          datasetId: c.fingerprint.datasetId,
          ksStatistic: c.ksStatistic,
          meanDiff: c.meanDiff
        }))
      });
    } catch (error) {
      logger.error("Error comparing fingerprint", { error: String(error) });
      res.status(500).json({ error: "Failed to compare fingerprint" });
    }
  });

  // Check for scale mixing between multiple datasets
  app.post("/api/guardrail/check-mixing", upload.array('files', 10), (req, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      
      if (!files || files.length < 2) {
        return res.status(400).json({ error: "At least 2 files required for mixing check" });
      }

      const datasets = files.map(file => {
        const content = file.buffer.toString('utf-8');
        const lines = content.trim().split('\n');
        const values: number[][] = lines.slice(1).map(line => 
          line.split(',').slice(1).map(v => parseFloat(v)).filter(v => !isNaN(v))
        );
        return { name: file.originalname, values };
      });

      const result = checkScaleMixing(datasets);
      
      res.json({
        compatible: result.compatible,
        warnings: result.warnings,
        datasets: result.details.map((d, i) => ({
          name: datasets[i].name,
          scale: d.detectedScale,
          confidence: d.confidence
        })),
        recommendation: result.compatible 
          ? 'All datasets on same scale - safe for cross-dataset comparison'
          : 'SCALE MIXING DETECTED - Apply harmonized transforms before comparison'
      });
    } catch (error) {
      logger.error("Error checking scale mixing", { error: String(error) });
      res.status(500).json({ error: "Failed to check scale mixing" });
    }
  });

  // Get reference atlas with tier classification
  app.get("/api/guardrail/atlas", (req, res) => {
    try {
      const tier = req.query.tier as 'tier1' | 'tier2' | 'all' | undefined;
      const atlas = getReferenceAtlas(tier);
      
      res.json({
        tier1: {
          tissues: atlas.tier1.map(fp => fp.tissue),
          count: atlas.tier1.length,
          fingerprints: atlas.tier1.map(fp => ({
            tissue: fp.tissue,
            lambdaMean: fp.lambdaMean,
            lambdaStd: fp.lambdaStd,
            lambdaRange: fp.lambdaRange,
            clockGeneLambdas: fp.clockGeneLambdas
          }))
        },
        tier2: {
          tissues: atlas.tier2.map(fp => fp.tissue),
          count: atlas.tier2.length,
          fingerprints: atlas.tier2.map(fp => ({
            tissue: fp.tissue,
            lambdaMean: fp.lambdaMean,
            lambdaStd: fp.lambdaStd,
            lambdaRange: fp.lambdaRange,
            clockGeneLambdas: fp.clockGeneLambdas
          }))
        },
        summary: atlas.summary,
        methodology: {
          preprocessing: 'Standardized log2 transformation',
          source: 'GSE54650 Hughes Circadian Atlas (Mouse)',
          platform: 'Affymetrix RNA-seq normalized to log2',
          clockGenes: ['Per1', 'Per2', 'Per3', 'Arntl', 'Clock', 'Cry1', 'Cry2', 'Nr1d1', 'Nr1d2', 'Rorc', 'Dbp', 'Tef', 'Npas2']
        }
      });
    } catch (error) {
      logger.error("Error fetching reference atlas", { error: String(error) });
      res.status(500).json({ error: "Failed to fetch reference atlas" });
    }
  });

  // Match dataset fingerprint to reference atlas
  app.post("/api/guardrail/match-fingerprint", (req, res) => {
    try {
      const { lambdaValues, datasetName } = req.body;
      
      if (!lambdaValues || typeof lambdaValues !== 'object') {
        return res.status(400).json({ error: "lambdaValues object required with gene:lambda pairs" });
      }

      const result = matchDatasetFingerprint(lambdaValues, datasetName || 'unknown');
      
      res.json({
        datasetName: datasetName || 'unknown',
        bestMatch: result.bestMatch,
        allMatches: result.allMatches.slice(0, 6),
        qualityFlags: result.qualityFlags,
        recommendation: result.recommendation,
        visualization: {
          inputMean: Object.values(lambdaValues as Record<string, number>)
            .filter((v): v is number => !isNaN(v))
            .reduce((a, b) => a + b, 0) / Object.values(lambdaValues).filter(v => !isNaN(v as number)).length,
          referenceRange: {
            // Real data from Jan 2026 audit (33 datasets)
            liver: 0.717,  // Liver mean from audit
            kidney: 0.889,  // Kidney mean from audit
            heart: 0.689,  // Heart mean from audit
            lung: 0.782,  // Lung mean from audit
            muscle: 0.70,  // Approximate
            adrenal: 0.75   // Approximate
          }
        }
      });
    } catch (error) {
      logger.error("Error matching fingerprint", { error: String(error) });
      res.status(500).json({ error: "Failed to match fingerprint" });
    }
  });
  
  // Get all analysis runs
}
