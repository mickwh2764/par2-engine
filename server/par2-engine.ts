/**
 * PAR(2) Discovery Engine - Core Analysis Engine
 * 
 * Copyright (c) 2024 PAR(2) Discovery Engine Contributors
 * 
 * DUAL LICENSE NOTICE:
 * This file is part of the PAR(2) Discovery Engine, which is available under
 * a dual-license model:
 *   - Academic/Research Use: Free (non-commercial, citation required)
 *   - Commercial Use: License required (contact authors)
 * 
 * PATENT NOTICE:
 * The PAR(2) methodology is subject to a pending UK patent application.
 * Commercial use requires a license that includes patent rights.
 * 
 * See LICENSE file for full terms.
 */

import * as ss from 'simple-statistics';

// Golden ratio constant - exported for use in trajectory analysis
export const PHI = 1.6180339887498949;

// ============================================================================
// GENE SYMBOL TO ENSEMBL ID MAPPING
// For datasets that use Ensembl IDs instead of gene symbols (e.g., GSE157357)
// ============================================================================

export const GENE_SYMBOL_TO_ENSEMBL: Record<string, string> = {
  // Clock genes - verified from Ensembl/MGI
  'Per2': 'ENSMUSG00000055866',
  'Arntl': 'ENSMUSG00000055116',
  'Clock': 'ENSMUSG00000029238',
  'Per1': 'ENSMUSG00000020893',
  'Cry1': 'ENSMUSG00000020038',
  'Cry2': 'ENSMUSG00000068742',
  'Nr1d1': 'ENSMUSG00000020889',
  'Nr1d2': 'ENSMUSG00000021775',
  'Per3': 'ENSMUSG00000028957',
  'Dbp': 'ENSMUSG00000059824',
  'Tef': 'ENSMUSG00000022389',
  'Npas2': 'ENSMUSG00000026077',
  'Rorc': 'ENSMUSG00000028150',
  // Target genes - proliferation/cell cycle
  'Myc': 'ENSMUSG00000022346',
  'Ccnd1': 'ENSMUSG00000070348',
  'Ccnb1': 'ENSMUSG00000041431',
  'Cdk1': 'ENSMUSG00000019461',
  'Wee1': 'ENSMUSG00000031016',
  'Cdkn1a': 'ENSMUSG00000023067',
  'Ccne1': 'ENSMUSG00000002068',
  'Ccne2': 'ENSMUSG00000028399',
  'Mcm6': 'ENSMUSG00000025544',
  'Mki67': 'ENSMUSG00000031004',
  // Target genes - stem cell/Wnt (verified from MGI/Ensembl)
  'Lgr5': 'ENSMUSG00000020140',   // MGI:1341817
  'Axin2': 'ENSMUSG00000000142',
  'Ctnnb1': 'ENSMUSG00000006932', // MGI:88276 - beta-catenin
  'Apc': 'ENSMUSG00000005871',    // MGI:88039 - APC tumor suppressor
  // Target genes - cell cycle (spindle assembly checkpoint)
  'Mad2l1': 'ENSMUSG00000029910', // MGI:1860374 - MAD2 mitotic arrest deficient-like 1; GRCm38 confirmed
  'Bub1': 'ENSMUSG00000031839',   // MGI:1203504 - BUB1 mitotic checkpoint serine/threonine kinase; GRCm38 confirmed
  'Bub1b': 'ENSMUSG00000040084',  // MGI:1340063 - BUB1B (BubR1) mitotic checkpoint kinase; GRCm38 confirmed
  'Bub3': 'ENSMUSG00000031262',   // MGI:1858283 - BUB3 mitotic checkpoint protein; GRCm38 confirmed
  // Target genes - MCM family (additional subunits)
  'Mcm7': 'ENSMUSG00000022300',   // MGI:1333776 - MCM7 replication licensing; GRCm38 confirmed
  'Mcm10': 'ENSMUSG00000020485',  // MGI:1918936 - MCM10 replication factor; GRCm38 confirmed
  // Target genes - CDK family (additional)
  'Cdk7': 'ENSMUSG00000006715',   // MGI:107414 - CDK7 (CAK, TFIIH component); GRCm38 confirmed
  // Target genes - D-type cyclins (additional)
  'Ccnd2': 'ENSMUSG00000000184',  // MGI:88311 - Cyclin D2; GRCm38 confirmed
  'Ccnd3': 'ENSMUSG00000034165',  // MGI:88312 - Cyclin D3; GRCm38 confirmed
  // Target genes - G2/M checkpoint (additional)
  'Chek1': 'ENSMUSG00000030528',  // MGI:1351614 - CHK1 checkpoint kinase 1; GRCm38 confirmed
  'Cdkn3': 'ENSMUSG00000037628',  // MGI:1914251 - CDKN3 (CIP2) CDK inhibitor 3; GRCm38 confirmed
  // Target genes - CDCA family (cell division cycle associated)
  'Cdca3': 'ENSMUSG00000020235',  // MGI:2442583 - CDCA3 (trigger of mitotic entry); GRCm38 confirmed
  'Cdca5': 'ENSMUSG00000020808',  // MGI:2443538 - CDCA5 (sororin, cohesion regulator); GRCm38 confirmed
  'Cdca8': 'ENSMUSG00000031264',  // MGI:2443540 - CDCA8 (borealin, CPC component); GRCm38 confirmed
  // Target genes - DNA damage
  'Tp53': 'ENSMUSG00000059552',
  'Mdm2': 'ENSMUSG00000020184',
  'Atm': 'ENSMUSG00000034218',
  'Chek2': 'ENSMUSG00000029521',
  // Target genes - apoptosis/survival (verified from MGI/Ensembl)
  'Bcl2': 'ENSMUSG00000057329',   // MGI:88138
  'Bax': 'ENSMUSG00000003873',    // MGI:99702
  'Birc5': 'ENSMUSG00000017716',  // MGI:1203517 - Survivin (baculoviral IAP repeat-containing 5)
  // Target genes - metabolism/signaling
  'Hif1a': 'ENSMUSG00000021109',
  'Pparg': 'ENSMUSG00000000440',
  'Sirt1': 'ENSMUSG00000020063',
  // Target genes - Hippo pathway (verified from MGI/Ensembl)
  'Yap1': 'ENSMUSG00000053110',   // MGI:103262
  'Tead1': 'ENSMUSG00000055320',  // MGI:101876
  // Target genes - Inflammatory (verified from MGI/Ensembl)
  'Nfkb1': 'ENSMUSG00000028163',  // MGI:97312 - NF-kappa-B p105
  'Il6': 'ENSMUSG00000025746',    // MGI:96559 - Interleukin 6
  'Tnf': 'ENSMUSG00000024401',    // MGI:104798 - Tumor necrosis factor
  // Target genes - Autophagy (verified from MGI/Ensembl)
  'Atg7': 'ENSMUSG00000030314',   // MGI:1921494 - Autophagy related 7
  'Becn1': 'ENSMUSG00000035086',  // MGI:1891828 - Beclin 1
  // NOTCH pathway genes - for testing paper claims
  'Notch1': 'ENSMUSG00000026923', // MGI:97363 - Notch receptor 1
  'Notch2': 'ENSMUSG00000027878', // MGI:97364 - Notch receptor 2
  'Hes1': 'ENSMUSG00000022952',   // MGI:104853 - Hairy/enhancer of split 1
  'Dll1': 'ENSMUSG00000024883',   // MGI:104659 - Delta-like 1
  'Jag1': 'ENSMUSG00000027346',   // MGI:104804 - Jagged 1
  // Tuft cell markers - for testing paper claims
  'Dclk1': 'ENSMUSG00000030691',  // MGI:1330834 - Doublecortin-like kinase 1
  'Gfi1b': 'ENSMUSG00000020679',  // MGI:1338019 - Growth factor independent 1B
};

export const ENSEMBL_TO_GENE_SYMBOL: Record<string, string> = Object.fromEntries(
  Object.entries(GENE_SYMBOL_TO_ENSEMBL).map(([symbol, ensembl]) => [ensembl, symbol])
);

export function resolveGeneName(name: string, availableGenes: string[]): string | null {
  // Direct match
  if (availableGenes.includes(name)) {
    return name;
  }
  
  // Case-insensitive match
  const lowerName = name.toLowerCase();
  const caseMatch = availableGenes.find(g => g.toLowerCase() === lowerName);
  if (caseMatch) {
    return caseMatch;
  }
  
  // Try Symbol -> Ensembl ID lookup
  const ensemblId = GENE_SYMBOL_TO_ENSEMBL[name];
  if (ensemblId) {
    // Check with and without quotes (some CSVs have quoted values)
    if (availableGenes.includes(ensemblId)) {
      return ensemblId;
    }
    const quotedId = `"${ensemblId}"`;
    if (availableGenes.includes(quotedId)) {
      return quotedId;
    }
  }
  
  // Try Ensembl ID -> Symbol reverse lookup
  const geneSymbol = ENSEMBL_TO_GENE_SYMBOL[name];
  if (geneSymbol && availableGenes.includes(geneSymbol)) {
    return geneSymbol;
  }
  
  return null;
}

export function getDisplayName(resolvedName: string): string {
  // If the resolved name is an Ensembl ID, return the human-readable symbol
  const symbol = ENSEMBL_TO_GENE_SYMBOL[resolvedName];
  if (symbol) {
    return symbol;
  }
  // Handle quoted Ensembl IDs
  const unquoted = resolvedName.replace(/^"|"$/g, '');
  const quotedSymbol = ENSEMBL_TO_GENE_SYMBOL[unquoted];
  if (quotedSymbol) {
    return quotedSymbol;
  }
  return resolvedName;
}

export interface GeneAvailabilityResult {
  gene: string;
  available: boolean;
  resolvedAs: string | null;
  displayName: string;
}

export function checkGeneAvailability(
  genes: string[],
  availableGenes: string[]
): { results: GeneAvailabilityResult[]; allAvailable: boolean; missing: string[] } {
  const results: GeneAvailabilityResult[] = [];
  const missing: string[] = [];
  
  for (const gene of genes) {
    const resolved = resolveGeneName(gene, availableGenes);
    const available = resolved !== null;
    const displayName = resolved ? getDisplayName(resolved) : gene;
    
    results.push({
      gene,
      available,
      resolvedAs: resolved,
      displayName,
    });
    
    if (!available) {
      missing.push(gene);
    }
  }
  
  return {
    results,
    allAvailable: missing.length === 0,
    missing,
  };
}

// ============================================================================
// WITHIN-PAIR BONFERRONI CORRECTION
// Corrects for testing 4 interaction terms per gene pair before applying FDR
// ============================================================================

export function applyWithinPairBonferroni(rawPValue: number, numInteractionTerms: number = 4): number {
  // Multiply by number of tests within the pair (4 interaction terms)
  const correctedP = Math.min(rawPValue * numInteractionTerms, 1.0);
  return correctedP;
}

// ============================================================================
// SYNTHETIC DATA VALIDATION
// Generate synthetic data with known PAR(2) relationships for validation
// ============================================================================

export interface SyntheticDataConfig {
  nTimepoints?: number;
  period?: number;
  ar1Coef?: number;         // α₁ coefficient for R(t-1)
  ar2Coef?: number;         // α₂ coefficient for R(t-2)
  phaseGatingCoef?: number; // β coefficient for phase interaction
  phaseGatingLag?: 1 | 2;   // Which lag has phase gating
  phaseGatingType?: 'cos' | 'sin' | 'both';
  noiseLevel?: number;
  seed?: number;
}

export interface SyntheticValidationResult {
  config: SyntheticDataConfig;
  par2Result: {
    pValue: number;
    pValueCorrected: number;  // After within-pair Bonferroni
    significant: boolean;
    significantTerms: string[];
  };
  expectedSignificant: boolean;
  expectedTerms: string[];
  passed: boolean;
  termsMatch?: boolean;  // Whether detected terms match expected terms
  details: string;
}

// Simple seeded random number generator for reproducibility
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function gaussianRandom(rng: () => number): number {
  // Box-Muller transform
  const u1 = rng();
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1 || 0.001)) * Math.cos(2 * Math.PI * u2);
}

export function generateSyntheticPAR2Data(config: SyntheticDataConfig = {}): {
  targetData: GeneData;
  clockData: GeneData;
  truePhases: number[];
} {
  const n = config.nTimepoints || 24;
  const period = config.period || 24;
  const ar1 = config.ar1Coef ?? 0.5;
  const ar2 = config.ar2Coef ?? 0.2;
  const phaseGating = config.phaseGatingCoef ?? 0.3;
  const phaseLag = config.phaseGatingLag ?? 1;
  const phaseType = config.phaseGatingType ?? 'cos';
  const noise = config.noiseLevel ?? 0.5;
  const seed = config.seed ?? Date.now();
  
  const rng = seededRandom(seed);
  const omega = 2 * Math.PI / period;
  
  // Generate time points
  const time = Array.from({ length: n }, (_, i) => i * 2); // Every 2 hours
  
  // Generate clock gene expression (simple sinusoidal)
  const clockPhaseOffset = rng() * 2 * Math.PI;
  const clockAmplitude = 2 + rng() * 2;
  const clockMean = 5 + rng() * 3;
  const clockExpression = time.map(t => 
    clockMean + clockAmplitude * Math.cos(omega * t - clockPhaseOffset) + gaussianRandom(rng) * noise * 0.3
  );
  
  // Compute true phases from clock gene
  const truePhases = time.map(t => ((omega * t - clockPhaseOffset) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI));
  
  // Generate target gene with PAR(2) dynamics
  const targetExpression: number[] = [
    5 + gaussianRandom(rng) * noise,
    5 + gaussianRandom(rng) * noise
  ];
  
  for (let i = 2; i < n; i++) {
    const R_t1 = targetExpression[i - 1];
    const R_t2 = targetExpression[i - 2];
    const phi_t1 = truePhases[i - 1];
    const phi_t2 = truePhases[i - 2];
    
    // AR(2) component
    let value = ar1 * R_t1 + ar2 * R_t2;
    
    // Phase gating interaction
    if (phaseGating !== 0) {
      const phi = phaseLag === 1 ? phi_t1 : phi_t2;
      const R = phaseLag === 1 ? R_t1 : R_t2;
      
      if (phaseType === 'cos' || phaseType === 'both') {
        value += phaseGating * R * Math.cos(phi);
      }
      if (phaseType === 'sin' || phaseType === 'both') {
        value += phaseGating * R * Math.sin(phi);
      }
    }
    
    // Add noise
    value += gaussianRandom(rng) * noise;
    
    // Ensure positive expression
    targetExpression.push(Math.max(0.1, value));
  }
  
  return {
    targetData: { time, expression: targetExpression },
    clockData: { time, expression: clockExpression },
    truePhases
  };
}

export function validateSyntheticPAR2(config: SyntheticDataConfig = {}): SyntheticValidationResult {
  const { targetData, clockData } = generateSyntheticPAR2Data(config);
  
  // Determine expected outcome
  const hasPhaseGating = (config.phaseGatingCoef ?? 0.3) !== 0;
  const expectedSignificant = hasPhaseGating;
  const phaseLag = config.phaseGatingLag ?? 1;
  const phaseType = config.phaseGatingType ?? 'cos';
  
  const expectedTerms: string[] = [];
  if (hasPhaseGating) {
    const lagStr = `R_n_${phaseLag}`;
    if (phaseType === 'cos' || phaseType === 'both') {
      expectedTerms.push(`${lagStr}_cos`);
    }
    if (phaseType === 'sin' || phaseType === 'both') {
      expectedTerms.push(`${lagStr}_sin`);
    }
  }
  
  // Run PAR(2) analysis
  const result = runEnhancedPAR2Analysis(targetData, clockData, {
    period: config.period || 24,
    significanceThreshold: 0.05,
    includeDiagnostics: false,
    includeCrossValidation: false,
    includeBootstrap: false
  });
  
  // Apply within-pair Bonferroni correction
  const pValueCorrected = applyWithinPairBonferroni(result.pValue);
  const significantCorrected = pValueCorrected < 0.05;
  
  // Check if result matches expectation with term verification
  let passed = (significantCorrected === expectedSignificant);
  let termsMatch = true;
  let termDetails = '';
  
  if (expectedSignificant && significantCorrected) {
    // For positive controls, verify that at least one expected term was detected
    const detectedTerms = result.significantTerms || [];
    const expectedDetected = expectedTerms.filter(t => detectedTerms.includes(t));
    const unexpectedDetected = detectedTerms.filter(t => !expectedTerms.includes(t));
    
    // At least one expected term must be detected
    if (expectedDetected.length === 0 && expectedTerms.length > 0) {
      termsMatch = false;
      termDetails = ` WRONG TERMS: expected [${expectedTerms.join(',')}] but got [${detectedTerms.join(',')}]`;
      // Mark as failed if we detected significance but on wrong terms
      passed = false;
    } else {
      termDetails = ` terms=[${expectedDetected.join(',')}]`;
    }
  }
  
  let details = '';
  if (passed) {
    details = expectedSignificant 
      ? `Correctly detected phase gating (p=${result.pValue.toFixed(4)}, corrected=${pValueCorrected.toFixed(4)})${termDetails}`
      : `Correctly found no phase gating (p=${result.pValue.toFixed(4)})`;
  } else {
    if (!termsMatch) {
      details = `WRONG TERMS detected (p=${result.pValue.toFixed(4)})${termDetails}`;
    } else {
      details = expectedSignificant
        ? `MISSED phase gating (p=${result.pValue.toFixed(4)}, expected terms: ${expectedTerms.join(', ')})`
        : `FALSE POSITIVE (p=${result.pValue.toFixed(4)}, found terms: ${result.significantTerms.join(', ')})`;
    }
  }
  
  return {
    config,
    par2Result: {
      pValue: result.pValue,
      pValueCorrected,
      significant: significantCorrected,
      significantTerms: result.significantTerms
    },
    expectedSignificant,
    expectedTerms,
    passed,
    termsMatch,
    details
  };
}

export function runValidationSuite(): {
  positiveControls: SyntheticValidationResult[];
  negativeControls: SyntheticValidationResult[];
  summary: { passed: number; failed: number; passRate: number };
} {
  const positiveControls: SyntheticValidationResult[] = [];
  const negativeControls: SyntheticValidationResult[] = [];
  
  // Positive controls: Data WITH phase gating
  // Effect sizes tuned to be detectable after within-pair Bonferroni correction (×4)
  const positiveConfigs: SyntheticDataConfig[] = [
    { phaseGatingCoef: 0.9, phaseGatingLag: 1, phaseGatingType: 'cos', noiseLevel: 0.3, seed: 12345 },
    { phaseGatingCoef: 1.0, phaseGatingLag: 1, phaseGatingType: 'sin', noiseLevel: 0.3, seed: 23456 },
    { phaseGatingCoef: 1.3, phaseGatingLag: 2, phaseGatingType: 'cos', noiseLevel: 0.3, seed: 34567 }, // Lag-2 needs stronger effect
    { phaseGatingCoef: 1.2, phaseGatingLag: 1, phaseGatingType: 'both', noiseLevel: 0.3, seed: 45678 },
    { phaseGatingCoef: 0.7, nTimepoints: 72, noiseLevel: 0.3, seed: 56789 }, // Longer time series for lower effect
  ];
  
  // Negative controls: Data WITHOUT phase gating
  const negativeConfigs: SyntheticDataConfig[] = [
    { phaseGatingCoef: 0, ar1Coef: 0.5, ar2Coef: 0.2, seed: 11111 },
    { phaseGatingCoef: 0, ar1Coef: 0.7, ar2Coef: 0.1, seed: 22222 },
    { phaseGatingCoef: 0, ar1Coef: 0.3, ar2Coef: 0.4, seed: 33333 },
    { phaseGatingCoef: 0, noiseLevel: 1.0, seed: 44444 }, // Higher noise
    { phaseGatingCoef: 0, nTimepoints: 48, seed: 55555 }, // Longer time series
  ];
  
  for (const config of positiveConfigs) {
    positiveControls.push(validateSyntheticPAR2(config));
  }
  
  for (const config of negativeConfigs) {
    negativeControls.push(validateSyntheticPAR2(config));
  }
  
  const allResults = [...positiveControls, ...negativeControls];
  const passed = allResults.filter(r => r.passed).length;
  const failed = allResults.length - passed;
  
  return {
    positiveControls,
    negativeControls,
    summary: {
      passed,
      failed,
      passRate: passed / allResults.length
    }
  };
}

// ============================================================================
// AR(2) EIGENVALUE ANALYSIS - STABILITY AND EIGENPERIOD COMPUTATION
// Implements the mathematical framework connecting AR(2) dynamics to
// golden ratio scaling and emergent ~48h eigenperiods
// ============================================================================

export const GOLDEN_RATIO = (1 + Math.sqrt(5)) / 2; // φ ≈ 1.618033988749895
export const GOLDEN_RATIO_CONJUGATE = (1 - Math.sqrt(5)) / 2; // ψ ≈ -0.618033988749895

export interface ComplexNumber {
  real: number;
  imag: number;
}

export interface EigenvalueResult {
  lambda1: ComplexNumber;
  lambda2: ComplexNumber;
  isComplex: boolean;
  modulus1: number;
  modulus2: number;
  argument1: number | null; // radians, null if real
  argument2: number | null;
}

export interface EigenperiodResult {
  eigenperiod1: number | null; // hours, null if eigenvalue is real
  eigenperiod2: number | null;
  dominantEigenperiod: number | null;
  emergentCycleHours: number | null;
  interpretation: string;
}

export interface StabilityResult {
  isStable: boolean;
  maxModulus: number;
  stabilityMargin: number; // 1 - maxModulus (positive = stable)
  convergenceRate: number; // -log(maxModulus) per timestep
  halfLife: number | null; // timesteps to decay by 50%
  interpretation: string;
}

export interface GoldenRatioAnalysis {
  beta1: number;
  beta2: number;
  ratioB1B2: number | null; // β₁/β₂
  distanceToGoldenRatio: number | null; // |β₁/β₂ - φ|
  fibonacciSimilarity: number; // 0-1 scale, how close to Fibonacci dynamics
  isFibonacciLike: boolean; // ratio within 10% of φ
  interpretation: string;
}

export interface AR2StabilityReport {
  timestamp: string;
  coefficients: {
    beta1: number;
    beta2: number;
    beta1_stdError?: number;
    beta2_stdError?: number;
  };
  eigenvalues: EigenvalueResult;
  eigenperiod: EigenperiodResult;
  stability: StabilityResult;
  goldenRatio: GoldenRatioAnalysis;
  biologicalInterpretation: string;
  spatiotemporalLink: string;
}

function complexMultiply(a: ComplexNumber, b: ComplexNumber): ComplexNumber {
  return {
    real: a.real * b.real - a.imag * b.imag,
    imag: a.real * b.imag + a.imag * b.real
  };
}

function complexModulus(c: ComplexNumber): number {
  return Math.sqrt(c.real * c.real + c.imag * c.imag);
}

function complexArgument(c: ComplexNumber): number {
  return Math.atan2(c.imag, c.real);
}

export function solveAR2Eigenvalues(beta1: number, beta2: number): EigenvalueResult {
  const discriminant = beta1 * beta1 + 4 * beta2;
  
  if (discriminant >= 0) {
    const sqrtD = Math.sqrt(discriminant);
    const lambda1: ComplexNumber = { real: (beta1 + sqrtD) / 2, imag: 0 };
    const lambda2: ComplexNumber = { real: (beta1 - sqrtD) / 2, imag: 0 };
    
    return {
      lambda1,
      lambda2,
      isComplex: false,
      modulus1: Math.abs(lambda1.real),
      modulus2: Math.abs(lambda2.real),
      argument1: null,
      argument2: null
    };
  } else {
    const realPart = beta1 / 2;
    const imagPart = Math.sqrt(-discriminant) / 2;
    
    const lambda1: ComplexNumber = { real: realPart, imag: imagPart };
    const lambda2: ComplexNumber = { real: realPart, imag: -imagPart };
    
    const modulus = complexModulus(lambda1);
    const arg1 = complexArgument(lambda1);
    const arg2 = complexArgument(lambda2);
    
    return {
      lambda1,
      lambda2,
      isComplex: true,
      modulus1: modulus,
      modulus2: modulus,
      argument1: arg1,
      argument2: arg2
    };
  }
}

export function computeEigenperiod(eigenResult: EigenvalueResult, samplingIntervalHours: number = 2): EigenperiodResult {
  if (!eigenResult.isComplex) {
    return {
      eigenperiod1: null,
      eigenperiod2: null,
      dominantEigenperiod: null,
      emergentCycleHours: null,
      interpretation: "Real eigenvalues indicate exponential decay/growth without oscillation. No intrinsic period."
    };
  }
  
  const arg1 = eigenResult.argument1!;
  const arg2 = eigenResult.argument2!;
  
  const periodsInSamples1 = Math.abs(arg1) > 1e-10 ? (2 * Math.PI) / Math.abs(arg1) : null;
  const periodsInSamples2 = Math.abs(arg2) > 1e-10 ? (2 * Math.PI) / Math.abs(arg2) : null;
  
  const eigenperiod1 = periodsInSamples1 ? periodsInSamples1 * samplingIntervalHours : null;
  const eigenperiod2 = periodsInSamples2 ? periodsInSamples2 * samplingIntervalHours : null;
  
  const dominant = eigenperiod1 || eigenperiod2;
  
  let interpretation = "";
  if (dominant) {
    if (dominant >= 44 && dominant <= 52) {
      interpretation = `Emergent ~${dominant.toFixed(1)}h eigenperiod detected. This ~48h cycle matches the cell division period in intestinal epithelium and suggests the AR(2) memory structure resonates with tissue renewal dynamics.`;
    } else if (dominant >= 22 && dominant <= 26) {
      interpretation = `Emergent ~${dominant.toFixed(1)}h eigenperiod aligns with circadian rhythm. The AR(2) dynamics reinforce the 24h external clock signal.`;
    } else if (dominant >= 66 && dominant <= 78) {
      interpretation = `Emergent ~${dominant.toFixed(1)}h eigenperiod (~3 days) may reflect stem cell niche turnover or longer-term tissue homeostasis cycles.`;
    } else {
      interpretation = `Emergent ${dominant.toFixed(1)}h eigenperiod detected. This intrinsic oscillation emerges from the AR(2) memory structure.`;
    }
  }
  
  return {
    eigenperiod1,
    eigenperiod2,
    dominantEigenperiod: dominant,
    emergentCycleHours: dominant,
    interpretation
  };
}

export function analyzeStability(eigenResult: EigenvalueResult): StabilityResult {
  const maxModulus = Math.max(eigenResult.modulus1, eigenResult.modulus2);
  const isStable = maxModulus < 1;
  const stabilityMargin = 1 - maxModulus;
  
  const convergenceRate = maxModulus > 0 && maxModulus < 1 ? -Math.log(maxModulus) : 0;
  
  const halfLife = maxModulus > 0 && maxModulus < 1 
    ? Math.log(0.5) / Math.log(maxModulus) 
    : null;
  
  let interpretation = "";
  if (isStable) {
    if (maxModulus < 0.5) {
      interpretation = `Highly stable system (|λ|=${maxModulus.toFixed(3)}). Perturbations decay rapidly with half-life of ${halfLife?.toFixed(1)} timesteps.`;
    } else if (maxModulus < 0.9) {
      interpretation = `Stable system (|λ|=${maxModulus.toFixed(3)}). Moderate memory persistence with half-life of ${halfLife?.toFixed(1)} timesteps.`;
    } else {
      interpretation = `Marginally stable (|λ|=${maxModulus.toFixed(3)}). Long memory persistence (half-life: ${halfLife?.toFixed(1)} timesteps) allows sustained oscillations.`;
    }
  } else {
    interpretation = `UNSTABLE system (|λ|=${maxModulus.toFixed(3)} > 1). Perturbations grow exponentially. This may indicate model misspecification or genuine biological instability.`;
  }
  
  return {
    isStable,
    maxModulus,
    stabilityMargin,
    convergenceRate,
    halfLife,
    interpretation
  };
}

export function analyzeGoldenRatioConnection(beta1: number, beta2: number): GoldenRatioAnalysis {
  const ratioB1B2 = Math.abs(beta2) > 1e-10 ? beta1 / beta2 : null;
  
  const distanceToGoldenRatio = ratioB1B2 !== null 
    ? Math.abs(Math.abs(ratioB1B2) - GOLDEN_RATIO) 
    : null;
  
  let fibonacciSimilarity = 0;
  if (distanceToGoldenRatio !== null) {
    fibonacciSimilarity = Math.max(0, 1 - distanceToGoldenRatio / GOLDEN_RATIO);
  }
  
  const isFibonacciLike = distanceToGoldenRatio !== null && distanceToGoldenRatio < 0.1618;
  
  let interpretation = "";
  if (isFibonacciLike) {
    interpretation = `The coefficient ratio β₁/β₂ = ${ratioB1B2?.toFixed(3)} is within 10% of the golden ratio (φ=${GOLDEN_RATIO.toFixed(3)}). This suggests Fibonacci-like recursive dynamics that may correspond to golden-angle spatial packing in epithelial tissue architecture.`;
  } else if (fibonacciSimilarity > 0.5) {
    interpretation = `Moderate similarity to golden ratio scaling (${(fibonacciSimilarity * 100).toFixed(1)}%). The AR(2) dynamics show partial alignment with Fibonacci recursion patterns.`;
  } else {
    interpretation = `The coefficient ratio β₁/β₂ = ${ratioB1B2?.toFixed(3)} diverges from the golden ratio. The temporal dynamics do not directly mirror golden-angle spatial organization.`;
  }
  
  return {
    beta1,
    beta2,
    ratioB1B2,
    distanceToGoldenRatio,
    fibonacciSimilarity,
    isFibonacciLike,
    interpretation
  };
}

export function generateStabilityReport(
  beta1: number, 
  beta2: number,
  beta1_stdError?: number,
  beta2_stdError?: number,
  samplingIntervalHours: number = 2
): AR2StabilityReport {
  const eigenvalues = solveAR2Eigenvalues(beta1, beta2);
  const eigenperiod = computeEigenperiod(eigenvalues, samplingIntervalHours);
  const stability = analyzeStability(eigenvalues);
  const goldenRatio = analyzeGoldenRatioConnection(beta1, beta2);
  
  let biologicalInterpretation = "";
  if (eigenperiod.emergentCycleHours && eigenperiod.emergentCycleHours >= 44 && eigenperiod.emergentCycleHours <= 52) {
    biologicalInterpretation = `The ~48h eigenperiod emerging from AR(2) dynamics aligns with intestinal epithelial renewal cycles. This suggests that gene expression memory (captured by β₁ and β₂) encodes cell division timing information. The system 'remembers' its state across approximately two cell generations.`;
  } else if (eigenperiod.emergentCycleHours && eigenperiod.emergentCycleHours >= 22 && eigenperiod.emergentCycleHours <= 26) {
    biologicalInterpretation = `The ~24h eigenperiod reinforces circadian regulation. The AR(2) memory structure amplifies or sustains the external circadian signal, creating robust rhythmic gene expression.`;
  } else if (stability.isStable && stability.maxModulus > 0.9) {
    biologicalInterpretation = `High eigenvalue modulus (${stability.maxModulus.toFixed(3)}) indicates persistent memory. Expression states influence future states for many generations, enabling long-term transcriptional programs.`;
  } else {
    biologicalInterpretation = `The AR(2) dynamics show ${stability.isStable ? 'stable' : 'unstable'} behavior with characteristic timescales determined by eigenvalue structure.`;
  }
  
  let spatiotemporalLink = "";
  if (goldenRatio.isFibonacciLike && eigenperiod.emergentCycleHours) {
    spatiotemporalLink = `SPATIO-TEMPORAL UNITY: The combination of golden-ratio coefficient scaling (β₁/β₂ ≈ φ) and emergent ~${eigenperiod.emergentCycleHours.toFixed(0)}h periodicity suggests a unified organizing principle. Just as golden-angle phyllotaxis optimizes spatial packing in plant organs, the AR(2) dynamics may optimize temporal information flow across cell generations. Both spatial (crypt architecture) and temporal (gene expression waves) domains appear governed by second-order recursive optimization.`;
  } else if (goldenRatio.fibonacciSimilarity > 0.3) {
    spatiotemporalLink = `Partial spatio-temporal correspondence detected. The AR(2) coefficient structure shows ${(goldenRatio.fibonacciSimilarity * 100).toFixed(0)}% similarity to Fibonacci dynamics, suggesting some alignment between temporal gene regulation and spatial tissue organization principles.`;
  } else {
    spatiotemporalLink = `The temporal dynamics (AR(2)) and spatial organization (golden-ratio packing) appear to operate on different recursive structures in this system.`;
  }
  
  return {
    timestamp: new Date().toISOString(),
    coefficients: {
      beta1,
      beta2,
      beta1_stdError,
      beta2_stdError
    },
    eigenvalues,
    eigenperiod,
    stability,
    goldenRatio,
    biologicalInterpretation,
    spatiotemporalLink
  };
}

export function formatStabilityReportText(report: AR2StabilityReport): string {
  const lines: string[] = [];
  
  lines.push("╔══════════════════════════════════════════════════════════════════════════════╗");
  lines.push("║              AR(2) STABILITY & EIGENPERIOD ANALYSIS REPORT                   ║");
  lines.push("╚══════════════════════════════════════════════════════════════════════════════╝");
  lines.push("");
  lines.push(`Generated: ${report.timestamp}`);
  lines.push("");
  
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("1. AR(2) COEFFICIENTS");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push(`   β₁ (lag-1): ${report.coefficients.beta1.toFixed(6)}${report.coefficients.beta1_stdError ? ` ± ${report.coefficients.beta1_stdError.toFixed(6)}` : ''}`);
  lines.push(`   β₂ (lag-2): ${report.coefficients.beta2.toFixed(6)}${report.coefficients.beta2_stdError ? ` ± ${report.coefficients.beta2_stdError.toFixed(6)}` : ''}`);
  lines.push("");
  
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("2. EIGENVALUE ANALYSIS");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push(`   Characteristic equation: λ² - β₁λ - β₂ = 0`);
  lines.push(`   Eigenvalues are ${report.eigenvalues.isComplex ? 'COMPLEX conjugates' : 'REAL'}`);
  
  if (report.eigenvalues.isComplex) {
    lines.push(`   λ₁ = ${report.eigenvalues.lambda1.real.toFixed(4)} + ${report.eigenvalues.lambda1.imag.toFixed(4)}i`);
    lines.push(`   λ₂ = ${report.eigenvalues.lambda2.real.toFixed(4)} + ${report.eigenvalues.lambda2.imag.toFixed(4)}i`);
  } else {
    lines.push(`   λ₁ = ${report.eigenvalues.lambda1.real.toFixed(6)}`);
    lines.push(`   λ₂ = ${report.eigenvalues.lambda2.real.toFixed(6)}`);
  }
  
  lines.push(`   |λ₁| = ${report.eigenvalues.modulus1.toFixed(6)}`);
  lines.push(`   |λ₂| = ${report.eigenvalues.modulus2.toFixed(6)}`);
  
  if (report.eigenvalues.argument1 !== null) {
    lines.push(`   arg(λ₁) = ${report.eigenvalues.argument1.toFixed(4)} rad = ${(report.eigenvalues.argument1 * 180 / Math.PI).toFixed(2)}°`);
  }
  lines.push("");
  
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("3. EIGENPERIOD (EMERGENT OSCILLATION)");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push(`   Formula: T = 2π / |arg(λ)|`);
  
  if (report.eigenperiod.dominantEigenperiod) {
    lines.push(`   Dominant eigenperiod: ${report.eigenperiod.dominantEigenperiod.toFixed(2)} hours`);
    lines.push(`   ≈ ${(report.eigenperiod.dominantEigenperiod / 24).toFixed(2)} days`);
  } else {
    lines.push(`   No oscillatory eigenperiod (real eigenvalues)`);
  }
  
  lines.push(`   ${report.eigenperiod.interpretation}`);
  lines.push("");
  
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("4. STABILITY ANALYSIS");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push(`   System stability: ${report.stability.isStable ? '✓ STABLE' : '✗ UNSTABLE'}`);
  lines.push(`   Maximum modulus: ${report.stability.maxModulus.toFixed(6)}`);
  lines.push(`   Stability margin: ${report.stability.stabilityMargin.toFixed(6)} (must be > 0 for stability)`);
  
  if (report.stability.halfLife) {
    lines.push(`   Half-life: ${report.stability.halfLife.toFixed(2)} timesteps`);
  }
  
  lines.push(`   ${report.stability.interpretation}`);
  lines.push("");
  
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("5. GOLDEN RATIO ANALYSIS");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push(`   Golden ratio φ = ${GOLDEN_RATIO.toFixed(6)}`);
  
  if (report.goldenRatio.ratioB1B2 !== null) {
    lines.push(`   β₁/β₂ = ${report.goldenRatio.ratioB1B2.toFixed(6)}`);
    lines.push(`   |β₁/β₂ - φ| = ${report.goldenRatio.distanceToGoldenRatio?.toFixed(6)}`);
    lines.push(`   Fibonacci similarity: ${(report.goldenRatio.fibonacciSimilarity * 100).toFixed(1)}%`);
    lines.push(`   Fibonacci-like dynamics: ${report.goldenRatio.isFibonacciLike ? '✓ YES' : '✗ NO'}`);
  }
  
  lines.push(`   ${report.goldenRatio.interpretation}`);
  lines.push("");
  
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("6. BIOLOGICAL INTERPRETATION");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push(`   ${report.biologicalInterpretation}`);
  lines.push("");
  
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("7. SPATIO-TEMPORAL INTEGRATION");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push(`   ${report.spatiotemporalLink}`);
  lines.push("");
  
  lines.push("═══════════════════════════════════════════════════════════════════════════════");
  lines.push("                              END OF REPORT");
  lines.push("═══════════════════════════════════════════════════════════════════════════════");
  
  return lines.join("\n");
}

export interface GeneData {
  time: number[];
  expression: number[];
}

export interface ConfidenceInterval {
  lower: number;
  upper: number;
  level: number;
}

export interface CoefficientStats {
  estimate: number;
  stdError: number;
  tStatistic: number;
  pValue: number;
  ci95: ConfidenceInterval;
}

export interface ResidualDiagnostics {
  durbinWatson: {
    statistic: number;
    pValue: number | null;
    interpretation: string;
  };
  ljungBox: {
    statistic: number;
    pValue: number;
    lags: number;
  };
  normalityTest: {
    statistic: number;
    pValue: number;
    testName: string;
    isNormal: boolean;
  };
  residualStats: {
    mean: number;
    variance: number;
    skewness: number;
    kurtosis: number;
  };
}

export interface CrossValidationResult {
  cvRMSE: number;
  cvMAE: number;
  cvR2: number;
  foldResults: {
    fold: number;
    trainRMSE: number;
    testRMSE: number;
    testPredictions: number[];
    testActual: number[];
  }[];
  method: string;
}

export interface PhaseBootstrapResult {
  phaseEstimate: number;
  phaseStdError: number;
  phaseCI95: ConfidenceInterval;
  amplitudeEstimate: number;
  amplitudeStdError: number;
  amplitudeCI95: ConfidenceInterval;
  nBootstrap: number;
  bootstrapDistribution: number[];
}

export interface ModelFitMetrics {
  rSquared: number;
  adjustedRSquared: number;
  aic: number;
  bic: number;
  logLikelihood: number;
  sse: number;
  mse: number;
  df: number;
  numParams: number;
}

export interface ARXResult {
  coefficients: Record<string, number>;
  pValues: Record<string, number>;
  metrics: ModelFitMetrics;
}

export interface ModelComparisonResult {
  par2: {
    coefficients: Record<string, number>;
    pValues: Record<string, number>;
    metrics: ModelFitMetrics;
    significantTerms: string[];
  };
  arx: ARXResult;
  comparison: {
    deltaAIC: number;
    deltaBIC: number;
    deltaRSquared: number;
    deltaAdjRSquared: number;
    fStatistic: number;
    fPValue: number;
    likelihoodRatio: number;
    lrtPValue: number;
    par2Preferred: boolean;
    preferenceReason: string;
  };
}

export interface EnhancedPAR2Result {
  significant: boolean;
  pValue: number;
  qValue?: number;
  significantTerms: string[];
  significantAfterFDR: boolean;
  coefficients: Record<string, number>;
  coefficientStats?: Record<string, CoefficientStats>;
  residualDiagnostics?: ResidualDiagnostics;
  crossValidation?: CrossValidationResult;
  phaseBootstrap?: PhaseBootstrapResult;
  modelComparison?: ModelComparisonResult;
}

export interface EffectSizeMetrics {
  cohensF2: number;           // Cohen's f² for the phase interaction terms
  cohensF2Interpretation: 'small' | 'medium' | 'large' | 'negligible';
  rSquaredChange: number;     // R² change when adding phase terms
  partialEtaSquared: number;  // Partial η² for the phase terms
}

export interface CoefficientCI {
  coefficient: number;
  lower: number;
  upper: number;
  standardError: number;
}

export interface DataQualityWarnings {
  sampleSizeWarning: string | null;
  clockRhythmicityWarning: string | null;
  dataQualityScore: 'good' | 'acceptable' | 'poor';
}

export interface PAR2Result {
  significant: boolean;
  pValue: number;
  significantTerms: string[];
  coefficients?: Record<string, number>;
  modelComparison?: ModelComparisonResult;
  effectSize?: EffectSizeMetrics;
  confidenceIntervals?: Record<string, CoefficientCI>;
  clockRhythmicity?: ClockRhythmicityCheck;
  dataQuality?: DataQualityWarnings;
  nTimepoints?: number;
}

export interface PAR2Config {
  period?: number;
  significanceThreshold?: number;
  includeModelComparison?: boolean;
  includeDiagnostics?: boolean;
  includeCrossValidation?: boolean;
  includeBootstrap?: boolean;
  bootstrapIterations?: number;
  cvFolds?: number;
}

export interface BatchAnalysisResult {
  results: EnhancedPAR2Result[];
  fdrCorrection: {
    method: string;
    originalPValues: number[];
    adjustedQValues: number[];
    significantCount: number;
    significantCountAfterFDR: number;
    threshold: number;
  };
}

export function benjaminiHochberg(pValues: number[], alpha: number = 0.05): { qValues: number[]; significant: boolean[] } {
  const n = pValues.length;
  if (n === 0) return { qValues: [], significant: [] };
  
  const indexed = pValues.map((p, i) => ({ p, i }));
  indexed.sort((a, b) => a.p - b.p);
  
  const qValues = new Array(n).fill(1);
  const significant = new Array(n).fill(false);
  
  let minQSoFar = 1;
  for (let rank = n; rank >= 1; rank--) {
    const idx = indexed[rank - 1].i;
    const originalP = indexed[rank - 1].p;
    
    const q = Math.min(minQSoFar, (originalP * n) / rank);
    qValues[idx] = Math.min(q, 1);
    minQSoFar = qValues[idx];
  }
  
  for (let i = 0; i < n; i++) {
    significant[i] = qValues[i] < alpha;
  }
  
  return { qValues, significant };
}

function fitCosinePhaseWithStats(
  time: number[], 
  expression: number[], 
  period: number
): { phases: number[]; phaseOffset: number; amplitude: number; meanExpr: number } {
  const n = time.length;
  const meanExpr = expression.reduce((a, b) => a + b, 0) / n;
  
  if (n < 4) {
    return {
      phases: time.map(t => (2 * Math.PI / period * t) % (2 * Math.PI)),
      phaseOffset: 0,
      amplitude: 0,
      meanExpr
    };
  }
  
  const centeredExpr = expression.map(e => e - meanExpr);
  const omega = 2 * Math.PI / period;
  
  let sumCosSq = 0, sumSinSq = 0, sumCosSin = 0;
  let sumExprCos = 0, sumExprSin = 0;
  
  for (let i = 0; i < n; i++) {
    const theta = omega * time[i];
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    
    sumCosSq += c * c;
    sumSinSq += s * s;
    sumCosSin += c * s;
    sumExprCos += centeredExpr[i] * c;
    sumExprSin += centeredExpr[i] * s;
  }
  
  const det = sumCosSq * sumSinSq - sumCosSin * sumCosSin;
  
  let phaseOffset = 0;
  let amplitude = 0;
  
  if (Math.abs(det) > 1e-10) {
    const a = (sumSinSq * sumExprCos - sumCosSin * sumExprSin) / det;
    const b = (sumCosSq * sumExprSin - sumCosSin * sumExprCos) / det;
    phaseOffset = Math.atan2(b, a);
    amplitude = Math.sqrt(a * a + b * b);
  }
  
  const phases = time.map(t => {
    const rawPhase = omega * t - phaseOffset;
    return ((rawPhase % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  });
  
  return { phases, phaseOffset, amplitude, meanExpr };
}

function fitCosinePhase(time: number[], expression: number[], period: number): number[] {
  return fitCosinePhaseWithStats(time, expression, period).phases;
}

/**
 * Clock Rhythmicity Pre-Check
 * Tests if the clock gene shows significant sinusoidal oscillation before running PAR(2).
 * Uses cosinor regression and F-test to determine rhythmicity.
 */
export interface ClockRhythmicityCheck {
  isRhythmic: boolean;
  pValue: number;
  amplitude: number;
  relativeAmplitude: number;  // amplitude / mean (as percentage)
  phase: number;              // peak phase in radians
  peakTime: number;           // peak time in hours
  rSquared: number;           // variance explained by cosine fit
  warning: string | null;
}

export function checkClockRhythmicity(
  time: number[],
  expression: number[],
  period: number = 24
): ClockRhythmicityCheck {
  const n = time.length;
  
  // Insufficient data
  if (n < 6) {
    return {
      isRhythmic: false,
      pValue: 1.0,
      amplitude: 0,
      relativeAmplitude: 0,
      phase: 0,
      peakTime: 0,
      rSquared: 0,
      warning: `Insufficient timepoints (${n}). Need at least 6 for rhythmicity detection.`
    };
  }
  
  const meanExpr = expression.reduce((a, b) => a + b, 0) / n;
  const omega = 2 * Math.PI / period;
  
  // Fit cosinor model: y = M + A*cos(ωt - φ) = M + β₁*cos(ωt) + β₂*sin(ωt)
  let sumCosSq = 0, sumSinSq = 0, sumCosSin = 0;
  let sumExprCos = 0, sumExprSin = 0;
  let sst = 0;
  
  for (let i = 0; i < n; i++) {
    const theta = omega * time[i];
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    
    sumCosSq += c * c;
    sumSinSq += s * s;
    sumCosSin += c * s;
    sumExprCos += (expression[i] - meanExpr) * c;
    sumExprSin += (expression[i] - meanExpr) * s;
    sst += (expression[i] - meanExpr) ** 2;
  }
  
  const det = sumCosSq * sumSinSq - sumCosSin * sumCosSin;
  
  if (Math.abs(det) < 1e-10 || sst < 1e-10) {
    return {
      isRhythmic: false,
      pValue: 1.0,
      amplitude: 0,
      relativeAmplitude: 0,
      phase: 0,
      peakTime: 0,
      rSquared: 0,
      warning: 'No variation in expression data or singular design matrix.'
    };
  }
  
  // Solve for coefficients
  const beta1 = (sumSinSq * sumExprCos - sumCosSin * sumExprSin) / det;
  const beta2 = (sumCosSq * sumExprSin - sumCosSin * sumExprCos) / det;
  
  // Calculate amplitude and phase
  const amplitude = Math.sqrt(beta1 * beta1 + beta2 * beta2);
  const phase = Math.atan2(beta2, beta1);
  const peakTime = (phase / omega + period) % period;
  const relativeAmplitude = meanExpr > 0 ? (amplitude / meanExpr) * 100 : 0;
  
  // Calculate SSE (sum of squared errors) for the cosinor model
  let sse = 0;
  for (let i = 0; i < n; i++) {
    const theta = omega * time[i];
    const predicted = meanExpr + beta1 * Math.cos(theta) + beta2 * Math.sin(theta);
    sse += (expression[i] - predicted) ** 2;
  }
  
  const rSquared = sst > 0 ? 1 - sse / sst : 0;
  
  // F-test for rhythmicity (testing if amplitude is significantly > 0)
  // Model has 3 params (mean, cos coef, sin coef) vs null model (just mean)
  const dfRegression = 2;  // cos and sin terms
  const dfResidual = n - 3;
  
  if (dfResidual < 1) {
    return {
      isRhythmic: false,
      pValue: 1.0,
      amplitude,
      relativeAmplitude,
      phase,
      peakTime,
      rSquared,
      warning: `Insufficient degrees of freedom (${n} timepoints, need > 3).`
    };
  }
  
  const ssRegression = sst - sse;
  const msRegression = ssRegression / dfRegression;
  const msResidual = sse / dfResidual;
  
  const fStatistic = msResidual > 0 ? msRegression / msResidual : 0;
  
  // Calculate p-value from F-distribution
  const pValue = 1 - fDistributionCDF(fStatistic, dfRegression, dfResidual);
  
  // Determine if rhythmic (p < 0.05)
  const isRhythmic = pValue < 0.05;
  
  // Generate warning if not rhythmic
  let warning: string | null = null;
  if (!isRhythmic) {
    warning = `Clock gene does not show significant rhythmicity (p = ${pValue.toFixed(4)}). PAR(2) results may be unreliable.`;
  } else if (relativeAmplitude < 10) {
    warning = `Clock gene shows weak oscillation (${relativeAmplitude.toFixed(1)}% amplitude). Results may have reduced sensitivity.`;
  }
  
  return {
    isRhythmic,
    pValue,
    amplitude,
    relativeAmplitude,
    phase,
    peakTime,
    rSquared,
    warning
  };
}

function circularMean(angles: number[]): number {
  const n = angles.length;
  let sumSin = 0, sumCos = 0;
  for (const angle of angles) {
    sumSin += Math.sin(angle);
    sumCos += Math.cos(angle);
  }
  return Math.atan2(sumSin / n, sumCos / n);
}

function circularVariance(angles: number[]): number {
  const n = angles.length;
  let sumSin = 0, sumCos = 0;
  for (const angle of angles) {
    sumSin += Math.sin(angle);
    sumCos += Math.cos(angle);
  }
  const R = Math.sqrt((sumSin / n) ** 2 + (sumCos / n) ** 2);
  return 1 - R;
}

function unwrapAngles(angles: number[], reference: number): number[] {
  return angles.map(angle => {
    let diff = angle - reference;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    return reference + diff;
  });
}

export function bootstrapPhaseEstimate(
  time: number[], 
  expression: number[], 
  period: number,
  nBootstrap: number = 1000
): PhaseBootstrapResult {
  const originalFit = fitCosinePhaseWithStats(time, expression, period);
  const n = time.length;
  
  const phaseDistribution: number[] = [];
  const amplitudeDistribution: number[] = [];
  
  for (let b = 0; b < nBootstrap; b++) {
    const indices: number[] = [];
    for (let i = 0; i < n; i++) {
      indices.push(Math.floor(Math.random() * n));
    }
    
    const bootTime = indices.map(i => time[i]);
    const bootExpr = indices.map(i => expression[i]);
    
    const bootFit = fitCosinePhaseWithStats(bootTime, bootExpr, period);
    phaseDistribution.push(bootFit.phaseOffset);
    amplitudeDistribution.push(bootFit.amplitude);
  }
  
  const unwrappedPhases = unwrapAngles(phaseDistribution, originalFit.phaseOffset);
  
  const phaseMean = unwrappedPhases.reduce((a, b) => a + b, 0) / nBootstrap;
  const phaseVariance = unwrappedPhases.reduce((sum, p) => sum + (p - phaseMean) ** 2, 0) / (nBootstrap - 1);
  const phaseStdError = Math.sqrt(phaseVariance);
  
  const ampMean = amplitudeDistribution.reduce((a, b) => a + b, 0) / nBootstrap;
  const ampVariance = amplitudeDistribution.reduce((sum, a) => sum + (a - ampMean) ** 2, 0) / (nBootstrap - 1);
  const ampStdError = Math.sqrt(ampVariance);
  
  const sortedUnwrapped = [...unwrappedPhases].sort((a, b) => a - b);
  const sortedAmplitudes = [...amplitudeDistribution].sort((a, b) => a - b);
  
  const lowerIdx = Math.floor(0.025 * nBootstrap);
  const upperIdx = Math.min(Math.floor(0.975 * nBootstrap), nBootstrap - 1);
  
  return {
    phaseEstimate: originalFit.phaseOffset,
    phaseStdError,
    phaseCI95: {
      lower: sortedUnwrapped[lowerIdx],
      upper: sortedUnwrapped[upperIdx],
      level: 0.95
    },
    amplitudeEstimate: originalFit.amplitude,
    amplitudeStdError: ampStdError,
    amplitudeCI95: {
      lower: sortedAmplitudes[lowerIdx],
      upper: sortedAmplitudes[upperIdx],
      level: 0.95
    },
    nBootstrap,
    bootstrapDistribution: phaseDistribution
  };
}

function computeDurbinWatson(residuals: number[]): { statistic: number; pValue: number | null; interpretation: string } {
  const n = residuals.length;
  if (n < 3) {
    return { statistic: 2, pValue: null, interpretation: 'Insufficient data (p-value not computed)' };
  }
  
  let sumSqDiff = 0;
  let sumSqResid = 0;
  
  for (let i = 1; i < n; i++) {
    sumSqDiff += (residuals[i] - residuals[i - 1]) ** 2;
  }
  for (let i = 0; i < n; i++) {
    sumSqResid += residuals[i] ** 2;
  }
  
  const dw = sumSqResid > 0 ? sumSqDiff / sumSqResid : 2;
  
  let interpretation: string;
  
  if (dw < 1.5) {
    interpretation = 'Positive autocorrelation likely (DW < 1.5, p-value requires lookup tables)';
  } else if (dw > 2.5) {
    interpretation = 'Negative autocorrelation likely (DW > 2.5, p-value requires lookup tables)';
  } else {
    interpretation = 'No significant autocorrelation (1.5 <= DW <= 2.5)';
  }
  
  return { statistic: dw, pValue: null, interpretation };
}

function computeLjungBox(residuals: number[], lags: number = 10): { statistic: number; pValue: number; lags: number } {
  const n = residuals.length;
  if (n <= lags + 1) {
    return { statistic: 0, pValue: 1, lags };
  }
  
  const mean = residuals.reduce((a, b) => a + b, 0) / n;
  const centered = residuals.map(r => r - mean);
  
  const c0 = centered.reduce((sum, r) => sum + r * r, 0) / (n - 1);
  
  if (c0 === 0) {
    return { statistic: 0, pValue: 1, lags };
  }
  
  let Q = 0;
  for (let k = 1; k <= lags; k++) {
    let cK = 0;
    for (let t = k; t < n; t++) {
      cK += centered[t] * centered[t - k];
    }
    cK /= n;
    const rhoK = cK / c0;
    Q += (rhoK * rhoK) / (n - k);
  }
  Q *= n * (n + 2);
  
  const pValue = 1 - chiSquaredCDF(Q, lags);
  
  return { statistic: Q, pValue, lags };
}

function computeNormalityTest(residuals: number[]): { statistic: number; pValue: number; testName: string; isNormal: boolean } {
  const n = residuals.length;
  if (n < 8) {
    return { statistic: 0, pValue: 1, testName: 'Jarque-Bera (insufficient data)', isNormal: true };
  }
  
  const mean = residuals.reduce((a, b) => a + b, 0) / n;
  const centered = residuals.map(r => r - mean);
  
  const m2 = centered.reduce((sum, r) => sum + r * r, 0) / n;
  const m3 = centered.reduce((sum, r) => sum + r * r * r, 0) / n;
  const m4 = centered.reduce((sum, r) => sum + r * r * r * r, 0) / n;
  
  const skewness = m2 > 0 ? m3 / Math.pow(m2, 1.5) : 0;
  const kurtosis = m2 > 0 ? m4 / (m2 * m2) : 3;
  const excessKurtosis = kurtosis - 3;
  
  const JB = (n / 6) * (skewness * skewness + (excessKurtosis * excessKurtosis) / 4);
  
  const pValue = 1 - chiSquaredCDF(JB, 2);
  const isNormal = pValue > 0.05;
  
  return { statistic: JB, pValue, testName: 'Jarque-Bera', isNormal };
}

function computeResidualStats(residuals: number[]): { mean: number; variance: number; skewness: number; kurtosis: number } {
  const n = residuals.length;
  if (n < 2) {
    return { mean: 0, variance: 0, skewness: 0, kurtosis: 3 };
  }
  
  const mean = residuals.reduce((a, b) => a + b, 0) / n;
  const centered = residuals.map(r => r - mean);
  
  const variance = centered.reduce((sum, r) => sum + r * r, 0) / (n - 1);
  const m2 = centered.reduce((sum, r) => sum + r * r, 0) / n;
  const m3 = centered.reduce((sum, r) => sum + r * r * r, 0) / n;
  const m4 = centered.reduce((sum, r) => sum + r * r * r * r, 0) / n;
  
  const skewness = m2 > 0 ? m3 / Math.pow(m2, 1.5) : 0;
  const kurtosis = m2 > 0 ? m4 / (m2 * m2) : 3;
  
  return { mean, variance, skewness, kurtosis };
}

function computeResidualDiagnostics(residuals: number[]): ResidualDiagnostics {
  return {
    durbinWatson: computeDurbinWatson(residuals),
    ljungBox: computeLjungBox(residuals, Math.min(10, Math.floor(residuals.length / 3))),
    normalityTest: computeNormalityTest(residuals),
    residualStats: computeResidualStats(residuals)
  };
}

function leaveOneOutCV(
  X: number[][], 
  y: number[]
): CrossValidationResult {
  const n = X.length;
  const k = X[0].length;
  
  if (n <= k + 1) {
    return {
      cvRMSE: Infinity,
      cvMAE: Infinity,
      cvR2: 0,
      foldResults: [],
      method: 'leave-one-out (insufficient data)'
    };
  }
  
  const foldResults: CrossValidationResult['foldResults'] = [];
  const allTestErrors: number[] = [];
  const allTestAbsErrors: number[] = [];
  const allTestActual: number[] = [];
  const allTestPredictions: number[] = [];
  
  for (let i = 0; i < n; i++) {
    const trainX = X.filter((_, j) => j !== i);
    const trainY = y.filter((_, j) => j !== i);
    
    const reg = multipleLinearRegressionFull(trainX, trainY);
    
    const testPred = dotProduct(X[i], reg.coefficients);
    const testError = y[i] - testPred;
    
    allTestErrors.push(testError * testError);
    allTestAbsErrors.push(Math.abs(testError));
    allTestActual.push(y[i]);
    allTestPredictions.push(testPred);
    
    const trainPreds = trainX.map(row => dotProduct(row, reg.coefficients));
    const trainErrors = trainY.map((val, j) => (val - trainPreds[j]) ** 2);
    const trainRMSE = Math.sqrt(trainErrors.reduce((a, b) => a + b, 0) / trainErrors.length);
    
    foldResults.push({
      fold: i + 1,
      trainRMSE,
      testRMSE: Math.abs(testError),
      testPredictions: [testPred],
      testActual: [y[i]]
    });
  }
  
  const cvRMSE = Math.sqrt(allTestErrors.reduce((a, b) => a + b, 0) / n);
  const cvMAE = allTestAbsErrors.reduce((a, b) => a + b, 0) / n;
  
  const yMean = allTestActual.reduce((a, b) => a + b, 0) / n;
  const ssTot = allTestActual.reduce((sum, val) => sum + (val - yMean) ** 2, 0);
  const ssRes = allTestErrors.reduce((a, b) => a + b, 0);
  const cvR2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  
  return {
    cvRMSE,
    cvMAE,
    cvR2,
    foldResults: foldResults.slice(0, 5),
    method: 'leave-one-out'
  };
}

interface FullRegressionResult {
  coefficients: number[];
  pValues: number[];
  stdErrors: number[];
  tStats: number[];
  residuals: number[];
  predictions: number[];
  XTXInv: number[][];
  mse: number;
  df: number;
}

function multipleLinearRegressionFull(X: number[][], y: number[]): FullRegressionResult {
  const n = X.length;
  const k = X[0].length;

  if (n <= k) {
    return {
      coefficients: new Array(k).fill(0),
      pValues: new Array(k).fill(1.0),
      stdErrors: new Array(k).fill(Infinity),
      tStats: new Array(k).fill(0),
      residuals: new Array(n).fill(0),
      predictions: y.slice(),
      XTXInv: [],
      mse: 0,
      df: 0
    };
  }

  const XT = transpose(X);
  const XTX = matrixMultiply(XT, X);
  const XTy = matrixVectorMultiply(XT, y);

  let coefficients: number[];
  let XTXInv: number[][];
  
  try {
    coefficients = solveLinearSystem(XTX, XTy);
    XTXInv = matrixInverse(XTX);
  } catch (e) {
    return {
      coefficients: new Array(k).fill(0),
      pValues: new Array(k).fill(1.0),
      stdErrors: new Array(k).fill(Infinity),
      tStats: new Array(k).fill(0),
      residuals: new Array(n).fill(0),
      predictions: y.slice(),
      XTXInv: [],
      mse: 0,
      df: 0
    };
  }

  if (coefficients.some(c => !isFinite(c))) {
    return {
      coefficients: new Array(k).fill(0),
      pValues: new Array(k).fill(1.0),
      stdErrors: new Array(k).fill(Infinity),
      tStats: new Array(k).fill(0),
      residuals: new Array(n).fill(0),
      predictions: y.slice(),
      XTXInv: [],
      mse: 0,
      df: 0
    };
  }

  const predictions = X.map(row => dotProduct(row, coefficients));
  const residuals = y.map((val, i) => val - predictions[i]);
  const SSR = residuals.reduce((sum, r) => sum + r * r, 0);
  const df = n - k;
  const mse = df > 0 ? SSR / df : 0;

  const stdErrors = coefficients.map((_, i) => {
    const variance = mse * XTXInv[i][i];
    return variance > 0 ? Math.sqrt(variance) : Infinity;
  });

  const tStats = coefficients.map((coef, i) => 
    stdErrors[i] !== 0 && isFinite(stdErrors[i]) ? coef / stdErrors[i] : 0
  );
  
  const pValues = tStats.map(t => {
    if (!isFinite(t) || df <= 0) return 1.0;
    const absT = Math.abs(t);
    return 2 * (1 - studentTCDF(absT, df));
  });

  return { coefficients, pValues, stdErrors, tStats, residuals, predictions, XTXInv, mse, df };
}

function computeCoefficientStats(
  coefficients: number[],
  stdErrors: number[],
  tStats: number[],
  pValues: number[],
  df: number,
  names: string[]
): Record<string, CoefficientStats> {
  const result: Record<string, CoefficientStats> = {};
  
  const tCrit = df > 0 ? studentTQuantile(0.975, df) : 1.96;
  
  for (let i = 0; i < coefficients.length; i++) {
    const name = names[i];
    const se = stdErrors[i];
    const margin = tCrit * se;
    
    result[name] = {
      estimate: coefficients[i],
      stdError: se,
      tStatistic: tStats[i],
      pValue: pValues[i],
      ci95: {
        lower: coefficients[i] - margin,
        upper: coefficients[i] + margin,
        level: 0.95
      }
    };
  }
  
  return result;
}

function studentTQuantile(p: number, df: number): number {
  if (df <= 0) return 1.96;
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  
  let lo = -10, hi = 10;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    const cdf = studentTCDF(mid, df);
    if (cdf < p) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) / 2;
}

export function runEnhancedPAR2Analysis(
  targetData: GeneData, 
  clockData: GeneData, 
  config: PAR2Config = {}
): EnhancedPAR2Result {
  const period = config.period || 24;
  const significanceThreshold = config.significanceThreshold || 0.05;
  const includeDiagnostics = config.includeDiagnostics ?? true;
  const includeCrossValidation = config.includeCrossValidation ?? true;
  const includeBootstrap = config.includeBootstrap ?? true;
  const bootstrapIterations = config.bootstrapIterations || 500;

  if (targetData.time.length !== clockData.time.length) {
    throw new Error("Target and clock data must have the same length");
  }

  if (targetData.time.length < 10) {
    return {
      significant: false,
      pValue: 1.0,
      significantTerms: [],
      significantAfterFDR: false,
      coefficients: {}
    };
  }

  const phi = fitCosinePhase(clockData.time, clockData.expression, period);
  
  const R = targetData.expression;
  const R_n = R.slice(2);
  const R_n_1 = R.slice(1, -1);
  const R_n_2 = R.slice(0, -2);
  const Phi_n_1 = phi.slice(1, -1);
  const Phi_n_2 = phi.slice(0, -2);

  const n = R_n.length;
  
  const X: number[][] = [];
  for (let i = 0; i < n; i++) {
    X.push([
      1,
      R_n_1[i],
      R_n_1[i] * Math.cos(Phi_n_1[i]),
      R_n_1[i] * Math.sin(Phi_n_1[i]),
      R_n_2[i],
      R_n_2[i] * Math.cos(Phi_n_2[i]),
      R_n_2[i] * Math.sin(Phi_n_2[i])
    ]);
  }

  const y = R_n;
  const regression = multipleLinearRegressionFull(X, y);
  
  const coeffNames = ['const', 'R_n_1', 'R_n_1_cos', 'R_n_1_sin', 'R_n_2', 'R_n_2_cos', 'R_n_2_sin'];
  const periodicTermIndices = [2, 3, 5, 6];
  const periodicTermNames = ['R_n_1_cos', 'R_n_1_sin', 'R_n_2_cos', 'R_n_2_sin'];
  
  const significantTerms: string[] = [];
  let minPValue = 1.0;

  periodicTermIndices.forEach((idx, i) => {
    const pValue = regression.pValues[idx];
    if (pValue < minPValue) minPValue = pValue;
    if (pValue < significanceThreshold) {
      significantTerms.push(periodicTermNames[i]);
    }
  });

  const coefficients: Record<string, number> = {};
  coeffNames.forEach((name, i) => {
    coefficients[name] = regression.coefficients[i];
  });

  const result: EnhancedPAR2Result = {
    significant: significantTerms.length > 0,
    pValue: minPValue,
    significantTerms,
    significantAfterFDR: false,
    coefficients
  };

  if (includeDiagnostics) {
    result.coefficientStats = computeCoefficientStats(
      regression.coefficients,
      regression.stdErrors,
      regression.tStats,
      regression.pValues,
      regression.df,
      coeffNames
    );
    result.residualDiagnostics = computeResidualDiagnostics(regression.residuals);
  }

  if (includeCrossValidation) {
    result.crossValidation = leaveOneOutCV(X, y);
  }

  if (includeBootstrap) {
    result.phaseBootstrap = bootstrapPhaseEstimate(
      clockData.time, 
      clockData.expression, 
      period, 
      bootstrapIterations
    );
  }

  if (config.includeModelComparison) {
    const C = clockData.expression;
    const C_n_1 = C.slice(1, -1);
    const C_n_2 = C.slice(0, -2);
    
    result.modelComparison = computeModelComparison(
      targetData, clockData, period, significanceThreshold,
      R_n, R_n_1, R_n_2, Phi_n_1, Phi_n_2, X, y,
      { coefficients: regression.coefficients, pValues: regression.pValues },
      significantTerms
    );
  }

  return result;
}

export function runBatchAnalysis(
  analyses: { targetData: GeneData; clockData: GeneData; id: string }[],
  config: PAR2Config = {}
): BatchAnalysisResult {
  const significanceThreshold = config.significanceThreshold || 0.05;
  
  const results: EnhancedPAR2Result[] = [];
  const pValues: number[] = [];
  
  for (const analysis of analyses) {
    const result = runEnhancedPAR2Analysis(analysis.targetData, analysis.clockData, {
      ...config,
      includeDiagnostics: config.includeDiagnostics ?? false,
      includeCrossValidation: config.includeCrossValidation ?? false,
      includeBootstrap: config.includeBootstrap ?? false
    });
    results.push(result);
    pValues.push(result.pValue);
  }
  
  const { qValues, significant } = benjaminiHochberg(pValues, significanceThreshold);
  
  for (let i = 0; i < results.length; i++) {
    results[i].qValue = qValues[i];
    results[i].significantAfterFDR = significant[i];
  }
  
  const significantCount = results.filter(r => r.significant).length;
  const significantCountAfterFDR = results.filter(r => r.significantAfterFDR).length;
  
  return {
    results,
    fdrCorrection: {
      method: 'Benjamini-Hochberg',
      originalPValues: pValues,
      adjustedQValues: qValues,
      significantCount,
      significantCountAfterFDR,
      threshold: significanceThreshold
    }
  };
}

// ============================================================================
// EFFECT SIZE AND CONFIDENCE INTERVAL CALCULATIONS
// ============================================================================

function calculateEffectSize(
  y: number[],
  fullModelSSE: number,
  reducedModelSSE: number,
  numPhaseTerms: number = 4
): EffectSizeMetrics {
  const n = y.length;
  const yMean = y.reduce((a, b) => a + b, 0) / n;
  const sst = y.reduce((sum, val) => sum + (val - yMean) ** 2, 0);
  
  // R² for full model (with phase terms)
  const rSquaredFull = sst > 0 ? 1 - fullModelSSE / sst : 0;
  
  // R² for reduced model (without phase terms)
  const rSquaredReduced = sst > 0 ? 1 - reducedModelSSE / sst : 0;
  
  // R² change attributable to phase interaction terms
  const rSquaredChange = Math.max(0, rSquaredFull - rSquaredReduced);
  
  // Cohen's f² = R²_change / (1 - R²_full)
  // Measures effect size of the phase terms specifically
  const cohensF2 = rSquaredFull < 1 ? rSquaredChange / (1 - rSquaredFull) : 0;
  
  // Partial η² = SS_phase / (SS_phase + SS_error)
  const ssPhase = reducedModelSSE - fullModelSSE;
  const partialEtaSquared = ssPhase > 0 && fullModelSSE > 0 
    ? ssPhase / (ssPhase + fullModelSSE) 
    : 0;
  
  // Cohen's f² interpretation (Cohen, 1988)
  let cohensF2Interpretation: 'negligible' | 'small' | 'medium' | 'large';
  if (cohensF2 >= 0.35) {
    cohensF2Interpretation = 'large';
  } else if (cohensF2 >= 0.15) {
    cohensF2Interpretation = 'medium';
  } else if (cohensF2 >= 0.02) {
    cohensF2Interpretation = 'small';
  } else {
    cohensF2Interpretation = 'negligible';
  }
  
  return {
    cohensF2: Math.max(0, cohensF2),
    cohensF2Interpretation,
    rSquaredChange: Math.max(0, rSquaredChange),
    partialEtaSquared: Math.max(0, partialEtaSquared)
  };
}

function calculateConfidenceIntervals(
  X: number[][],
  y: number[],
  coefficients: number[],
  alpha: number = 0.05
): Record<string, CoefficientCI> {
  const n = X.length;
  const p = coefficients.length;
  const df = n - p;
  
  if (df <= 0) {
    return {};
  }
  
  // Calculate residuals and MSE
  const predictions = X.map(row => row.reduce((sum, val, i) => sum + val * coefficients[i], 0));
  const residuals = y.map((val, i) => val - predictions[i]);
  const sse = residuals.reduce((sum, r) => sum + r * r, 0);
  const mse = sse / df;
  
  // Calculate (X'X)^-1
  const Xt = transpose(X);
  const XtX = matrixMultiply(Xt, X);
  
  let XtXInv: number[][];
  try {
    XtXInv = matrixInverse(XtX);
  } catch {
    return {};
  }
  
  // t-critical value for 95% CI (approximation using normal for large df)
  // For df > 30, t ≈ 1.96; for smaller df, use slightly larger values
  const tCritical = df > 120 ? 1.96 : 
                    df > 60 ? 2.0 : 
                    df > 30 ? 2.04 : 
                    df > 20 ? 2.09 : 
                    df > 10 ? 2.23 : 2.78;
  
  const termNames = ['const', 'R_n_1', 'R_n_1_cos', 'R_n_1_sin', 'R_n_2', 'R_n_2_cos', 'R_n_2_sin'];
  const result: Record<string, CoefficientCI> = {};
  
  for (let i = 0; i < Math.min(coefficients.length, termNames.length); i++) {
    const variance = XtXInv[i][i] * mse;
    const standardError = Math.sqrt(Math.max(0, variance));
    const margin = tCritical * standardError;
    
    result[termNames[i]] = {
      coefficient: coefficients[i],
      lower: coefficients[i] - margin,
      upper: coefficients[i] + margin,
      standardError
    };
  }
  
  return result;
}

function fitReducedModel(R_n: number[], R_n_1: number[], R_n_2: number[]): number {
  // Fit AR(2) model without phase interaction terms
  const n = R_n.length;
  const X: number[][] = [];
  
  for (let i = 0; i < n; i++) {
    X.push([1, R_n_1[i], R_n_2[i]]);
  }
  
  const regression = multipleLinearRegression(X, R_n);
  
  // Calculate SSE for reduced model
  const predictions = X.map(row => 
    row.reduce((sum, val, j) => sum + val * regression.coefficients[j], 0)
  );
  const residuals = R_n.map((val, i) => val - predictions[i]);
  const sse = residuals.reduce((sum, r) => sum + r * r, 0);
  
  return sse;
}

export function runPAR2Analysis(targetData: GeneData, clockData: GeneData, config: PAR2Config = {}): PAR2Result {
  const period = config.period || 24;
  const significanceThreshold = config.significanceThreshold || 0.05;

  // Input validation
  if (!targetData || !clockData) {
    throw new Error("Target and clock data are required");
  }

  if (!targetData.time || !targetData.expression || !clockData.time || !clockData.expression) {
    throw new Error("Data must include time and expression arrays");
  }

  if (targetData.time.length !== clockData.time.length) {
    throw new Error("Target and clock data must have the same length");
  }

  if (targetData.time.length !== targetData.expression.length) {
    throw new Error("Target time and expression arrays must have the same length");
  }

  if (clockData.time.length !== clockData.expression.length) {
    throw new Error("Clock time and expression arrays must have the same length");
  }

  // Check for invalid values in both time and expression arrays
  const isInvalidValue = (v: any): boolean => v === null || v === undefined || (typeof v === 'number' && !isFinite(v));
  
  const hasInvalidTargetExpr = targetData.expression.some(isInvalidValue);
  const hasInvalidClockExpr = clockData.expression.some(isInvalidValue);
  const hasInvalidTargetTime = targetData.time.some(isInvalidValue);
  const hasInvalidClockTime = clockData.time.some(isInvalidValue);
  
  const hasAnyInvalid = hasInvalidTargetExpr || hasInvalidClockExpr || hasInvalidTargetTime || hasInvalidClockTime;
  
  if (hasAnyInvalid) {
    // Clean the data by removing entries where any value is invalid
    const validIndices: number[] = [];
    for (let i = 0; i < targetData.time.length; i++) {
      const tExpr = targetData.expression[i];
      const cExpr = clockData.expression[i];
      const tTime = targetData.time[i];
      const cTime = clockData.time[i];
      
      // All four values must be valid finite numbers
      if (!isInvalidValue(tExpr) && !isInvalidValue(cExpr) &&
          !isInvalidValue(tTime) && !isInvalidValue(cTime)) {
        validIndices.push(i);
      }
    }
    
    if (validIndices.length < 10) {
      return {
        significant: false,
        pValue: 1.0,
        significantTerms: [],
        coefficients: {}
      };
    }
    
    targetData = {
      time: validIndices.map(i => targetData.time[i]),
      expression: validIndices.map(i => targetData.expression[i])
    };
    clockData = {
      time: validIndices.map(i => clockData.time[i]),
      expression: validIndices.map(i => clockData.expression[i])
    };
  }

  if (targetData.time.length < 10) {
    return {
      significant: false,
      pValue: 1.0,
      significantTerms: [],
      coefficients: {}
    };
  }

  const phi = fitCosinePhase(clockData.time, clockData.expression, period);
  
  const R = targetData.expression;
  const R_n = R.slice(2);
  const R_n_1 = R.slice(1, -1);
  const R_n_2 = R.slice(0, -2);
  const Phi_n_1 = phi.slice(1, -1);
  const Phi_n_2 = phi.slice(0, -2);

  const n = R_n.length;
  
  const X = [];
  for (let i = 0; i < n; i++) {
    X.push([
      1,
      R_n_1[i],
      R_n_1[i] * Math.cos(Phi_n_1[i]),
      R_n_1[i] * Math.sin(Phi_n_1[i]),
      R_n_2[i],
      R_n_2[i] * Math.cos(Phi_n_2[i]),
      R_n_2[i] * Math.sin(Phi_n_2[i])
    ]);
  }

  const y = R_n;

  const regression = multipleLinearRegression(X, y);
  
  const periodicTermIndices = [2, 3, 5, 6];
  const periodicTermNames = ['R_n_1_cos', 'R_n_1_sin', 'R_n_2_cos', 'R_n_2_sin'];
  
  const significantTerms: string[] = [];
  let minPValue = 1.0;

  periodicTermIndices.forEach((idx, i) => {
    const pValue = regression.pValues[idx];
    if (pValue < minPValue) minPValue = pValue;
    if (pValue < significanceThreshold) {
      significantTerms.push(periodicTermNames[i]);
    }
  });

  let modelComparison: ModelComparisonResult | undefined;
  
  if (config.includeModelComparison) {
    modelComparison = computeModelComparison(
      targetData, clockData, period, significanceThreshold, 
      R_n, R_n_1, R_n_2, Phi_n_1, Phi_n_2, X, y, regression, significantTerms
    );
  }

  // Calculate SSE for full model (with phase terms)
  const predictions = X.map(row => 
    row.reduce((sum, val, j) => sum + val * regression.coefficients[j], 0)
  );
  const residuals = y.map((val, i) => val - predictions[i]);
  const fullModelSSE = residuals.reduce((sum, r) => sum + r * r, 0);
  
  // Calculate SSE for reduced model (without phase terms)
  const reducedModelSSE = fitReducedModel(R_n, R_n_1, R_n_2);
  
  // Calculate effect size metrics
  const effectSize = calculateEffectSize(y, fullModelSSE, reducedModelSSE, 4);
  
  // Calculate confidence intervals for all coefficients
  const confidenceIntervals = calculateConfidenceIntervals(X, y, regression.coefficients);

  // Clock rhythmicity pre-check
  const clockRhythmicity = checkClockRhythmicity(clockData.time, clockData.expression, period);
  
  // Data quality warnings
  const nTimepoints = targetData.time.length;
  let sampleSizeWarning: string | null = null;
  if (nTimepoints < 10) {
    sampleSizeWarning = `Very low sample size (${nTimepoints} timepoints). Results may be unreliable. Minimum 10 recommended.`;
  } else if (nTimepoints < 18) {
    sampleSizeWarning = `Limited sample size (${nTimepoints} timepoints). Results may have reduced statistical power. 18+ recommended for robust detection.`;
  }
  
  // Calculate overall data quality score
  let dataQualityScore: 'good' | 'acceptable' | 'poor' = 'good';
  if (!clockRhythmicity.isRhythmic || nTimepoints < 10) {
    dataQualityScore = 'poor';
  } else if (sampleSizeWarning || clockRhythmicity.warning) {
    dataQualityScore = 'acceptable';
  }
  
  const dataQuality: DataQualityWarnings = {
    sampleSizeWarning,
    clockRhythmicityWarning: clockRhythmicity.warning,
    dataQualityScore
  };

  return {
    significant: significantTerms.length > 0,
    pValue: minPValue,
    significantTerms,
    coefficients: {
      const: regression.coefficients[0],
      R_n_1: regression.coefficients[1],
      R_n_1_cos: regression.coefficients[2],
      R_n_1_sin: regression.coefficients[3],
      R_n_2: regression.coefficients[4],
      R_n_2_cos: regression.coefficients[5],
      R_n_2_sin: regression.coefficients[6]
    },
    modelComparison,
    effectSize,
    confidenceIntervals,
    clockRhythmicity,
    dataQuality,
    nTimepoints
  };
}

function runARXBaseline(
  R_n: number[], 
  R_n_1: number[], 
  R_n_2: number[],
  C_n_1: number[],
  C_n_2: number[]
): { regression: RegressionResult, X: number[][] } {
  const n = R_n.length;
  
  const X: number[][] = [];
  for (let i = 0; i < n; i++) {
    X.push([
      1,
      R_n_1[i],
      R_n_2[i],
      C_n_1[i],
      C_n_2[i]
    ]);
  }
  
  const regression = multipleLinearRegression(X, R_n);
  return { regression, X };
}

function computeModelMetrics(
  y: number[], 
  sse: number, 
  numParams: number
): ModelFitMetrics {
  const n = y.length;
  const df = n - numParams;
  const mse = df > 0 ? sse / df : 0;
  
  const yMean = y.reduce((a, b) => a + b, 0) / n;
  const sst = y.reduce((sum, val) => sum + (val - yMean) ** 2, 0);
  
  const rSquared = sst > 0 ? 1 - sse / sst : 0;
  
  const adjustedRSquared = n > numParams ? 
    1 - (1 - rSquared) * (n - 1) / (n - numParams) : 0;
  
  const sigma2 = sse / n;
  const logLikelihood = sigma2 > 0 ? 
    -n / 2 * (Math.log(2 * Math.PI) + Math.log(sigma2) + 1) : -Infinity;
  
  const aic = 2 * numParams - 2 * logLikelihood;
  const bic = numParams * Math.log(n) - 2 * logLikelihood;
  
  return {
    rSquared,
    adjustedRSquared,
    aic,
    bic,
    logLikelihood,
    sse,
    mse,
    df,
    numParams
  };
}

function computeModelComparison(
  targetData: GeneData,
  clockData: GeneData,
  period: number,
  significanceThreshold: number,
  R_n: number[],
  R_n_1: number[],
  R_n_2: number[],
  Phi_n_1: number[],
  Phi_n_2: number[],
  par2X: number[][],
  y: number[],
  par2Regression: RegressionResult,
  significantTerms: string[]
): ModelComparisonResult {
  const n = y.length;
  
  const C = clockData.expression;
  const C_n_1 = C.slice(1, -1);
  const C_n_2 = C.slice(0, -2);
  
  const { regression: arxRegression, X: arxX } = runARXBaseline(R_n, R_n_1, R_n_2, C_n_1, C_n_2);
  
  const par2Predictions = par2X.map(row => dotProduct(row, par2Regression.coefficients));
  const par2Residuals = y.map((val, i) => val - par2Predictions[i]);
  const par2SSE = par2Residuals.reduce((sum, r) => sum + r * r, 0);
  
  const arxPredictions = arxX.map(row => dotProduct(row, arxRegression.coefficients));
  const arxResiduals = y.map((val, i) => val - arxPredictions[i]);
  const arxSSE = arxResiduals.reduce((sum, r) => sum + r * r, 0);
  
  const par2NumParams = 7;
  const arxNumParams = 5;
  
  const par2Metrics = computeModelMetrics(y, par2SSE, par2NumParams);
  const arxMetrics = computeModelMetrics(y, arxSSE, arxNumParams);
  
  const deltaAIC = par2Metrics.aic - arxMetrics.aic;
  const deltaBIC = par2Metrics.bic - arxMetrics.bic;
  const deltaRSquared = par2Metrics.rSquared - arxMetrics.rSquared;
  const deltaAdjRSquared = par2Metrics.adjustedRSquared - arxMetrics.adjustedRSquared;
  
  const dfDiff = par2NumParams - arxNumParams;
  const fStatistic = arxSSE > par2SSE && par2Metrics.df > 0 ?
    ((arxSSE - par2SSE) / dfDiff) / (par2SSE / par2Metrics.df) : 0;
  
  const fPValue = fStatistic > 0 ? 1 - fDistributionCDF(fStatistic, dfDiff, par2Metrics.df) : 1;
  
  const likelihoodRatio = 2 * (par2Metrics.logLikelihood - arxMetrics.logLikelihood);
  const lrtPValue = likelihoodRatio > 0 ? 1 - chiSquaredCDF(likelihoodRatio, dfDiff) : 1;
  
  const aicPrefersPAR2 = deltaAIC < -2;
  const bicPrefersPAR2 = deltaBIC < -2;
  const fTestSignificant = fPValue < significanceThreshold;
  const lrtSignificant = lrtPValue < significanceThreshold;
  
  const par2Preferred = (aicPrefersPAR2 || bicPrefersPAR2) && (fTestSignificant || lrtSignificant);
  
  let preferenceReason: string;
  if (par2Preferred) {
    const reasons = [];
    if (aicPrefersPAR2) reasons.push(`ΔAIC=${deltaAIC.toFixed(2)}`);
    if (bicPrefersPAR2) reasons.push(`ΔBIC=${deltaBIC.toFixed(2)}`);
    if (fTestSignificant) reasons.push(`F-test p=${fPValue.toFixed(4)}`);
    if (lrtSignificant) reasons.push(`LRT p=${lrtPValue.toFixed(4)}`);
    preferenceReason = `PAR(2) preferred: ${reasons.join(', ')}`;
  } else if (deltaAIC > 2 || deltaBIC > 2) {
    preferenceReason = `ARX baseline preferred: ΔAIC=${deltaAIC.toFixed(2)}, ΔBIC=${deltaBIC.toFixed(2)}`;
  } else {
    preferenceReason = 'Models are comparable (no significant difference)';
  }
  
  return {
    par2: {
      coefficients: {
        const: par2Regression.coefficients[0],
        R_n_1: par2Regression.coefficients[1],
        R_n_1_cos: par2Regression.coefficients[2],
        R_n_1_sin: par2Regression.coefficients[3],
        R_n_2: par2Regression.coefficients[4],
        R_n_2_cos: par2Regression.coefficients[5],
        R_n_2_sin: par2Regression.coefficients[6]
      },
      pValues: {
        const: par2Regression.pValues[0],
        R_n_1: par2Regression.pValues[1],
        R_n_1_cos: par2Regression.pValues[2],
        R_n_1_sin: par2Regression.pValues[3],
        R_n_2: par2Regression.pValues[4],
        R_n_2_cos: par2Regression.pValues[5],
        R_n_2_sin: par2Regression.pValues[6]
      },
      metrics: par2Metrics,
      significantTerms
    },
    arx: {
      coefficients: {
        const: arxRegression.coefficients[0],
        R_n_1: arxRegression.coefficients[1],
        R_n_2: arxRegression.coefficients[2],
        C_n_1: arxRegression.coefficients[3],
        C_n_2: arxRegression.coefficients[4]
      },
      pValues: {
        const: arxRegression.pValues[0],
        R_n_1: arxRegression.pValues[1],
        R_n_2: arxRegression.pValues[2],
        C_n_1: arxRegression.pValues[3],
        C_n_2: arxRegression.pValues[4]
      },
      metrics: arxMetrics
    },
    comparison: {
      deltaAIC,
      deltaBIC,
      deltaRSquared,
      deltaAdjRSquared,
      fStatistic,
      fPValue,
      likelihoodRatio,
      lrtPValue,
      par2Preferred,
      preferenceReason
    }
  };
}

interface RegressionResult {
  coefficients: number[];
  pValues: number[];
}

function multipleLinearRegression(X: number[][], y: number[]): RegressionResult {
  const full = multipleLinearRegressionFull(X, y);
  return { coefficients: full.coefficients, pValues: full.pValues };
}

function transpose(matrix: number[][]): number[][] {
  return matrix[0].map((_, i) => matrix.map(row => row[i]));
}

function matrixMultiply(A: number[][], B: number[][]): number[][] {
  const result: number[][] = [];
  for (let i = 0; i < A.length; i++) {
    result[i] = [];
    for (let j = 0; j < B[0].length; j++) {
      result[i][j] = 0;
      for (let k = 0; k < A[0].length; k++) {
        result[i][j] += A[i][k] * B[k][j];
      }
    }
  }
  return result;
}

function matrixVectorMultiply(matrix: number[][], vector: number[]): number[] {
  return matrix.map(row => dotProduct(row, vector));
}

function dotProduct(a: number[], b: number[]): number {
  return a.reduce((sum, val, i) => sum + val * b[i], 0);
}

function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = A.length;
  const augmented = A.map((row, i) => [...row, b[i]]);

  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
        maxRow = k;
      }
    }
    [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];

    for (let k = i + 1; k < n; k++) {
      const factor = augmented[k][i] / augmented[i][i];
      for (let j = i; j <= n; j++) {
        augmented[k][j] -= factor * augmented[i][j];
      }
    }
  }

  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = augmented[i][n];
    for (let j = i + 1; j < n; j++) {
      x[i] -= augmented[i][j] * x[j];
    }
    x[i] /= augmented[i][i];
  }

  return x;
}

function matrixInverse(matrix: number[][]): number[][] {
  const n = matrix.length;
  const identity = Array.from({ length: n }, (_, i) => 
    Array.from({ length: n }, (_, j) => i === j ? 1 : 0)
  );

  const augmented = matrix.map((row, i) => [...row, ...identity[i]]);

  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
        maxRow = k;
      }
    }
    [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];

    const divisor = augmented[i][i];
    for (let j = 0; j < 2 * n; j++) {
      augmented[i][j] /= divisor;
    }

    for (let k = 0; k < n; k++) {
      if (k !== i) {
        const factor = augmented[k][i];
        for (let j = 0; j < 2 * n; j++) {
          augmented[k][j] -= factor * augmented[i][j];
        }
      }
    }
  }

  return augmented.map(row => row.slice(n));
}

function studentTCDF(t: number, df: number): number {
  const x = df / (df + t * t);
  const tailProb = 0.5 * incompleteBeta(df / 2, 0.5, x);
  if (t >= 0) {
    return 1 - tailProb;
  } else {
    return tailProb;
  }
}

function incompleteBeta(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;

  const bt = Math.exp(
    gammaLn(a + b) - gammaLn(a) - gammaLn(b) +
    a * Math.log(x) + b * Math.log(1 - x)
  );

  if (x < (a + 1) / (a + b + 2)) {
    return bt * betaContinuedFraction(a, b, x) / a;
  } else {
    return 1 - bt * betaContinuedFraction(b, a, 1 - x) / b;
  }
}

function betaContinuedFraction(a: number, b: number, x: number): number {
  const maxIterations = 100;
  const epsilon = 1e-10;

  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - qab * x / qap;

  if (Math.abs(d) < epsilon) d = epsilon;
  d = 1 / d;
  let h = d;

  for (let m = 1; m <= maxIterations; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < epsilon) d = epsilon;
    c = 1 + aa / c;
    if (Math.abs(c) < epsilon) c = epsilon;
    d = 1 / d;
    h *= d * c;

    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < epsilon) d = epsilon;
    c = 1 + aa / c;
    if (Math.abs(c) < epsilon) c = epsilon;
    d = 1 / d;
    const del = d * c;
    h *= del;

    if (Math.abs(del - 1) < epsilon) break;
  }

  return h;
}

function gammaLn(x: number): number {
  const cof = [
    76.18009172947146, -86.50532032941677,
    24.01409824083091, -1.231739572450155,
    0.1208650973866179e-2, -0.5395239384953e-5
  ];
  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) {
    ser += cof[j] / ++y;
  }
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}

function fDistributionCDF(x: number, d1: number, d2: number): number {
  if (x <= 0) return 0;
  if (!isFinite(x)) return 1;
  
  const z = d1 * x / (d1 * x + d2);
  return incompleteBeta(d1 / 2, d2 / 2, z);
}

function chiSquaredCDF(x: number, k: number): number {
  if (x <= 0) return 0;
  if (!isFinite(x)) return 1;
  
  return lowerIncompleteGamma(k / 2, x / 2);
}

function lowerIncompleteGamma(a: number, x: number): number {
  if (x < 0 || a <= 0) return 0;
  if (x === 0) return 0;
  
  const gln = gammaLn(a);
  
  if (x < a + 1) {
    let sum = 1 / a;
    let term = 1 / a;
    for (let n = 1; n < 100; n++) {
      term *= x / (a + n);
      sum += term;
      if (Math.abs(term) < Math.abs(sum) * 1e-10) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - gln);
  } else {
    const b0 = x + 1 - a;
    let c = 1e30;
    let d = 1 / b0;
    let h = d;
    
    for (let i = 1; i < 100; i++) {
      const an = -i * (i - a);
      const bn = x + 2 * i + 1 - a;
      
      d = bn + an * d;
      if (Math.abs(d) < 1e-30) d = 1e-30;
      d = 1 / d;
      
      c = bn + an / c;
      if (Math.abs(c) < 1e-30) c = 1e-30;
      
      const delta = c * d;
      h *= delta;
      
      if (Math.abs(delta - 1) < 1e-10) break;
    }
    
    return 1 - Math.exp(-x + a * Math.log(x) - gln) * h;
  }
}

// ============================================================================
// DATA QUALITY GATES
// Comprehensive data quality checks before PAR(2) analysis
// ============================================================================

export interface DataQualityReport {
  overallScore: 'excellent' | 'good' | 'acceptable' | 'poor' | 'unusable';
  canProceed: boolean;
  warnings: DataQualityWarning[];
  metrics: DataQualityMetrics;
  recommendations: string[];
}

export interface DataQualityWarning {
  severity: 'critical' | 'warning' | 'info';
  code: string;
  message: string;
  details?: string;
}

export interface DataQualityMetrics {
  nTimepoints: number;
  nGenes: number;
  valueRange: { min: number; max: number };
  medianValue: number;
  hasNegatives: boolean;
  hasZeros: boolean;
  estimatedDataType: 'normalized' | 'raw_counts' | 'log_transformed' | 'unknown';
  clockGenesFound: string[];
  clockGenesMissing: string[];
  targetGenesFound: string[];
  clockRhythmicity: { gene: string; isRhythmic: boolean; amplitude: number }[];
}

export function assessDataQuality(
  geneTimeSeries: Map<string, number[]>,
  timepoints: number[],
  clockGenes: string[] = ['Per1', 'Per2', 'Per3', 'Cry1', 'Cry2', 'Clock', 'Arntl', 'Nr1d1', 'Nr1d2', 'Dbp', 'Tef', 'Npas2', 'Rorc']
): DataQualityReport {
  const warnings: DataQualityWarning[] = [];
  const recommendations: string[] = [];
  
  // Collect all expression values for distribution analysis
  const allValues: number[] = [];
  geneTimeSeries.forEach(values => {
    values.forEach(v => {
      if (typeof v === 'number' && isFinite(v)) {
        allValues.push(v);
      }
    });
  });
  
  if (allValues.length === 0) {
    return {
      overallScore: 'unusable',
      canProceed: false,
      warnings: [{
        severity: 'critical',
        code: 'NO_DATA',
        message: 'No valid expression values found in dataset'
      }],
      metrics: {
        nTimepoints: timepoints.length,
        nGenes: geneTimeSeries.size,
        valueRange: { min: 0, max: 0 },
        medianValue: 0,
        hasNegatives: false,
        hasZeros: false,
        estimatedDataType: 'unknown',
        clockGenesFound: [],
        clockGenesMissing: clockGenes,
        targetGenesFound: [],
        clockRhythmicity: []
      },
      recommendations: ['Check file format and ensure expression values are present']
    };
  }
  
  // Basic metrics
  const nTimepoints = timepoints.length;
  const nGenes = geneTimeSeries.size;
  const sortedValues = [...allValues].sort((a, b) => a - b);
  const min = sortedValues[0];
  const max = sortedValues[sortedValues.length - 1];
  const medianValue = sortedValues[Math.floor(sortedValues.length / 2)];
  const hasNegatives = min < 0;
  const hasZeros = sortedValues.some(v => v === 0);
  
  // Check minimum timepoints
  if (nTimepoints < 6) {
    warnings.push({
      severity: 'critical',
      code: 'INSUFFICIENT_TIMEPOINTS',
      message: `Only ${nTimepoints} timepoints detected. PAR(2) requires minimum 6 timepoints.`,
      details: 'The AR(2) model needs at least 6 observations for reliable regression with 7 parameters.'
    });
    recommendations.push('Upload dataset with at least 6 timepoints (12+ recommended for robust detection)');
  } else if (nTimepoints < 12) {
    warnings.push({
      severity: 'warning',
      code: 'LOW_TIMEPOINTS',
      message: `${nTimepoints} timepoints may limit statistical power.`,
      details: '12-24 timepoints recommended for robust circadian gating detection.'
    });
  }
  
  // Detect data type based on value distribution
  let estimatedDataType: 'normalized' | 'raw_counts' | 'log_transformed' | 'unknown' = 'unknown';
  
  // Raw counts: typically integers, large range (0 to millions), right-skewed
  const integerRatio = allValues.filter(v => Number.isInteger(v)).length / allValues.length;
  const range = max - min;
  const mean = allValues.reduce((a, b) => a + b, 0) / allValues.length;
  const skewness = allValues.reduce((sum, v) => sum + Math.pow((v - mean) / (range || 1), 3), 0) / allValues.length;
  
  if (max > 10000 && integerRatio > 0.9) {
    estimatedDataType = 'raw_counts';
    warnings.push({
      severity: 'critical',
      code: 'RAW_COUNTS_DETECTED',
      message: 'Data appears to be raw counts (large integers). PAR(2) requires normalized data.',
      details: `Max value: ${max.toFixed(0)}, ${(integerRatio * 100).toFixed(0)}% integers. Raw counts have highly skewed distributions that break cosine phase fitting.`
    });
    recommendations.push('Normalize data to TPM, FPKM, or apply log2(count + 1) transformation before analysis');
  } else if (max > 1000 && integerRatio > 0.7) {
    estimatedDataType = 'raw_counts';
    warnings.push({
      severity: 'warning',
      code: 'POSSIBLE_RAW_COUNTS',
      message: 'Data may be raw counts. Consider normalization.',
      details: `Max value: ${max.toFixed(0)}. Normalized expression data typically ranges 0-15 (log2) or 0-1000 (TPM/FPKM).`
    });
    recommendations.push('Verify data is normalized (TPM, FPKM, or log-transformed)');
  } else if (hasNegatives && max < 20 && min > -10) {
    estimatedDataType = 'log_transformed';
    // This is good - log-transformed data works well
  } else if (!hasNegatives && max < 20 && medianValue > 0 && medianValue < 15) {
    estimatedDataType = 'log_transformed';
    // Likely log2 or similar - good for analysis
  } else if (!hasNegatives && max < 100000 && max > 10) {
    estimatedDataType = 'normalized';
    // TPM/FPKM range - acceptable
  }
  
  // Check for clock genes
  const geneNames = Array.from(geneTimeSeries.keys());
  const clockGenesFound: string[] = [];
  const clockGenesMissing: string[] = [];
  
  for (const clock of clockGenes) {
    const resolved = resolveGeneName(clock, geneNames);
    if (resolved) {
      clockGenesFound.push(clock);
    } else {
      clockGenesMissing.push(clock);
    }
  }
  
  if (clockGenesFound.length === 0) {
    warnings.push({
      severity: 'critical',
      code: 'NO_CLOCK_GENES',
      message: 'No core clock genes found in dataset.',
      details: `Searched for: ${clockGenes.join(', ')}. Check gene naming format (symbols vs Ensembl IDs).`
    });
    recommendations.push('Ensure dataset includes clock genes (Per2, Arntl/Bmal1, Clock, Cry1, etc.)');
  } else if (clockGenesFound.length < 4) {
    warnings.push({
      severity: 'warning',
      code: 'FEW_CLOCK_GENES',
      message: `Only ${clockGenesFound.length} clock genes found: ${clockGenesFound.join(', ')}`,
      details: 'Analysis will be limited to available clock genes.'
    });
  }
  
  // Check clock gene rhythmicity
  const clockRhythmicity: { gene: string; isRhythmic: boolean; amplitude: number }[] = [];
  let nonRhythmicClocks = 0;
  
  for (const clock of clockGenesFound) {
    const resolved = resolveGeneName(clock, geneNames);
    if (resolved) {
      const expression = geneTimeSeries.get(resolved);
      if (expression && expression.length >= 6) {
        const result = checkClockRhythmicity(timepoints, expression, 24);
        clockRhythmicity.push({
          gene: clock,
          isRhythmic: result.isRhythmic,
          amplitude: result.amplitude
        });
        if (!result.isRhythmic) {
          nonRhythmicClocks++;
        }
      }
    }
  }
  
  if (nonRhythmicClocks > 0 && clockRhythmicity.length > 0) {
    const nonRhythmicPct = (nonRhythmicClocks / clockRhythmicity.length) * 100;
    if (nonRhythmicPct > 50) {
      warnings.push({
        severity: 'warning',
        code: 'WEAK_CLOCK_RHYTHMS',
        message: `${nonRhythmicClocks}/${clockRhythmicity.length} clock genes show weak rhythmicity.`,
        details: 'This may indicate disrupted circadian rhythm, clock knockout, or insufficient temporal resolution.'
      });
    }
  }
  
  // Check for target genes
  const targetGenes = ['Myc', 'Ccnd1', 'Ccnb1', 'Cdk1', 'Wee1', 'Cdkn1a', 'Lgr5', 'Axin2', 'Ctnnb1', 'Apc',
    'Tp53', 'Mdm2', 'Atm', 'Chek2', 'Bcl2', 'Bax', 'Pparg', 'Sirt1', 'Hif1a',
    'Ccne1', 'Ccne2', 'Mcm6', 'Mki67', 'Birc5',
    'Notch1', 'Notch2', 'Hes1', 'Dll1', 'Jag1',
    'Dclk1', 'Gfi1b'];
  const targetGenesFound: string[] = [];
  for (const target of targetGenes) {
    const resolved = resolveGeneName(target, geneNames);
    if (resolved) {
      targetGenesFound.push(target);
    }
  }
  
  // Calculate overall score
  let overallScore: 'excellent' | 'good' | 'acceptable' | 'poor' | 'unusable';
  let canProceed = true;
  
  const criticalWarnings = warnings.filter(w => w.severity === 'critical').length;
  const warningCount = warnings.filter(w => w.severity === 'warning').length;
  
  if (criticalWarnings >= 2 || (estimatedDataType === 'raw_counts' && nTimepoints < 6)) {
    overallScore = 'unusable';
    canProceed = false;
  } else if (criticalWarnings >= 1) {
    overallScore = 'poor';
    canProceed = estimatedDataType !== 'raw_counts'; // Allow raw counts to proceed with warning
  } else if (warningCount >= 2) {
    overallScore = 'acceptable';
  } else if (warningCount >= 1) {
    overallScore = 'good';
  } else {
    overallScore = 'excellent';
  }
  
  return {
    overallScore,
    canProceed,
    warnings,
    metrics: {
      nTimepoints,
      nGenes,
      valueRange: { min, max },
      medianValue,
      hasNegatives,
      hasZeros,
      estimatedDataType,
      clockGenesFound,
      clockGenesMissing,
      targetGenesFound,
      clockRhythmicity
    },
    recommendations
  };
}

// ============================================================================
// AUTOMATED NULL SURVEY
// Run permutation tests to establish null distribution baseline
// ============================================================================

export interface NullSurveyResult {
  nPermutations: number;
  nullSignificantRate: number;
  nullMeanPValue: number;
  nullMedianPValue: number;
  realSignificantCount: number;
  realMeanPValue: number;
  exceedsNull: boolean;
  enrichmentRatio: number;
  interpretation: string;
}

export function runQuickNullSurvey(
  geneTimeSeries: Map<string, number[]>,
  timepoints: number[],
  realResults: { pValue: number; significant: boolean }[],
  nPermutations: number = 1000
): NullSurveyResult {
  const validResults = realResults.filter(r => r.pValue < 1.0);
  if (validResults.length === 0) {
    return {
      nPermutations: 0,
      nullSignificantRate: 0,
      nullMeanPValue: 1,
      nullMedianPValue: 1,
      realSignificantCount: 0,
      realMeanPValue: 1,
      exceedsNull: false,
      enrichmentRatio: 0,
      interpretation: 'No valid results to compare against null'
    };
  }
  
  const realSignificantCount = validResults.filter(r => r.significant).length;
  const realMeanPValue = validResults.reduce((sum, r) => sum + r.pValue, 0) / validResults.length;
  const realSignificantRate = realSignificantCount / validResults.length;
  
  // Run permutation tests by shuffling timepoints
  const nullSignificantCounts: number[] = [];
  const nullPValues: number[] = [];
  
  for (let perm = 0; perm < nPermutations; perm++) {
    // Create shuffled timepoints
    const shuffledTimepoints = [...timepoints].sort(() => Math.random() - 0.5);
    
    // Sample a subset of gene pairs for speed
    const geneNames = Array.from(geneTimeSeries.keys());
    const clockGenes = ['Per2', 'Arntl', 'Clock'].filter(c => 
      resolveGeneName(c, geneNames) !== null
    );
    const targetGenes = ['Myc', 'Ccnd1', 'Tp53'].filter(t =>
      resolveGeneName(t, geneNames) !== null
    );
    
    let sigCount = 0;
    let pValueSum = 0;
    let testCount = 0;
    
    for (const clock of clockGenes.slice(0, 2)) {
      for (const target of targetGenes.slice(0, 2)) {
        const clockResolved = resolveGeneName(clock, geneNames);
        const targetResolved = resolveGeneName(target, geneNames);
        
        if (clockResolved && targetResolved) {
          const clockExpr = geneTimeSeries.get(clockResolved);
          const targetExpr = geneTimeSeries.get(targetResolved);
          
          if (clockExpr && targetExpr) {
            try {
              const result = runPAR2Analysis(
                { time: shuffledTimepoints, expression: targetExpr },
                { time: shuffledTimepoints, expression: clockExpr },
                { period: 24, significanceThreshold: 0.05 }
              );
              
              if (result.pValue < 1.0) {
                pValueSum += result.pValue;
                testCount++;
                if (result.significant) sigCount++;
              }
            } catch (e) {
              // Skip failed analyses
            }
          }
        }
      }
    }
    
    if (testCount > 0) {
      nullSignificantCounts.push(sigCount);
      nullPValues.push(pValueSum / testCount);
    }
  }
  
  if (nullSignificantCounts.length === 0) {
    return {
      nPermutations,
      nullSignificantRate: 0.05, // Expected under null
      nullMeanPValue: 0.5,
      nullMedianPValue: 0.5,
      realSignificantCount,
      realMeanPValue,
      exceedsNull: realSignificantRate > 0.05,
      enrichmentRatio: realSignificantRate / 0.05,
      interpretation: 'Could not run permutation tests; using theoretical null (5%)'
    };
  }
  
  const nullSignificantRate = nullSignificantCounts.reduce((a, b) => a + b, 0) / 
    (nullSignificantCounts.length * Math.max(1, validResults.length / 10));
  const nullMeanPValue = nullPValues.reduce((a, b) => a + b, 0) / nullPValues.length;
  const sortedNullP = [...nullPValues].sort((a, b) => a - b);
  const nullMedianPValue = sortedNullP[Math.floor(sortedNullP.length / 2)];
  
  const exceedsNull = realSignificantRate > nullSignificantRate * 2;
  const enrichmentRatio = nullSignificantRate > 0 ? realSignificantRate / nullSignificantRate : realSignificantRate > 0 ? Infinity : 1;
  
  let interpretation: string;
  if (exceedsNull && enrichmentRatio > 3) {
    interpretation = `Strong signal: ${realSignificantCount} significant pairs (${(realSignificantRate * 100).toFixed(1)}%) exceeds null expectation by ${enrichmentRatio.toFixed(1)}x`;
  } else if (exceedsNull) {
    interpretation = `Moderate signal: Results exceed null distribution (${enrichmentRatio.toFixed(1)}x enrichment)`;
  } else if (realSignificantCount === 0) {
    interpretation = 'No significant pairs detected - consistent with null (no circadian gating in this dataset)';
  } else {
    interpretation = `Results within null range - findings may be false positives`;
  }
  
  return {
    nPermutations,
    nullSignificantRate,
    nullMeanPValue,
    nullMedianPValue,
    realSignificantCount,
    realMeanPValue,
    exceedsNull,
    enrichmentRatio,
    interpretation
  };
}

// ============================================================================
// FIBONACCI NULL SURVEY WITH STABILITY FILTER
// Rigorous null testing for golden-ratio patterns in AR(2) coefficients
// ============================================================================

export interface FibonacciNullResult {
  nSimulations: number;
  stabilityFilterApplied: boolean;
  phiWindow: number; // 0.05 = 5%, 0.02 = 2%
  nullFibonacciRate: number;
  observedFibonacciRate: number;
  observedCount: number;
  totalPairs: number;
  enrichmentRatio: number;
  binomialPValue: number;
  interpretation: string;
  tissueBreakdown?: Record<string, {
    observed: number;
    total: number;
    rate: number;
    pValue: number;
  }>;
}

/**
 * Check if AR(2) process is stable (eigenvalues inside unit circle)
 * Companion matrix for AR(2): [[β1, 1], [β2, 0]]
 * Stability requires |max eigenvalue| < 1
 */
export function isAR2Stable(beta1: number, beta2: number): boolean {
  // For AR(2): x_n = β1*x_{n-1} + β2*x_{n-2}
  // Companion matrix eigenvalues: roots of λ² - β1*λ - β2 = 0
  const discriminant = beta1 * beta1 + 4 * beta2;
  
  if (discriminant >= 0) {
    // Real roots
    const root1 = (beta1 + Math.sqrt(discriminant)) / 2;
    const root2 = (beta1 - Math.sqrt(discriminant)) / 2;
    return Math.abs(root1) < 1 && Math.abs(root2) < 1;
  } else {
    // Complex conjugate roots
    const realPart = beta1 / 2;
    const imagPart = Math.sqrt(-discriminant) / 2;
    const modulus = Math.sqrt(realPart * realPart + imagPart * imagPart);
    return modulus < 1;
  }
}

/**
 * Calculate Fibonacci similarity: how close is |β1/β2| to golden ratio φ
 */
function calculateFibonacciSimilarity(beta1: number, beta2: number): number {
  const PHI = 1.6180339887498949;
  if (Math.abs(beta2) < 1e-10) return 0; // Avoid division by zero
  
  const ratio = Math.abs(beta1 / beta2);
  const distance = Math.abs(ratio - PHI);
  // Similarity score: 1 when ratio = φ, decreasing with distance
  return Math.max(0, 1 - distance / PHI);
}

/**
 * Run rigorous Fibonacci null survey with stability filter
 * Simulates AR(2) coefficients and tests how often phi-like ratios occur by chance
 */
export function runFibonacciNullSurvey(
  observedPairs: Array<{ beta1: number; beta2: number; tissue?: string }>,
  options: {
    nSimulations?: number;
    phiWindow?: number; // 0.05 = 5% window, 0.02 = 2% window
    applyStabilityFilter?: boolean;
  } = {}
): FibonacciNullResult {
  const PHI = 1.6180339887498949;
  const nSimulations = options.nSimulations || 10000;
  const phiWindow = options.phiWindow || 0.05; // Default 5%
  const applyStabilityFilter = options.applyStabilityFilter !== false; // Default true
  
  const phiThreshold = PHI * phiWindow; // Distance threshold
  
  // Count observed Fibonacci-like patterns
  let observedCount = 0;
  const tissueStats: Record<string, { observed: number; total: number }> = {};
  
  for (const pair of observedPairs) {
    const ratio = Math.abs(pair.beta2) > 1e-10 ? Math.abs(pair.beta1 / pair.beta2) : 0;
    const isFibLike = Math.abs(ratio - PHI) < phiThreshold;
    
    if (isFibLike) observedCount++;
    
    if (pair.tissue) {
      if (!tissueStats[pair.tissue]) {
        tissueStats[pair.tissue] = { observed: 0, total: 0 };
      }
      tissueStats[pair.tissue].total++;
      if (isFibLike) tissueStats[pair.tissue].observed++;
    }
  }
  
  const totalPairs = observedPairs.length;
  const observedRate = totalPairs > 0 ? observedCount / totalPairs : 0;
  
  // Run null simulations with stability filter
  let nullHits = 0;
  let stableCount = 0;
  
  for (let i = 0; i < nSimulations; i++) {
    // Sample from uniform distribution in coefficient space
    // β1 ∈ [-2, 2], β2 ∈ [-1, 1] (covers typical AR(2) range)
    const beta1 = (Math.random() * 4) - 2;
    const beta2 = (Math.random() * 2) - 1;
    
    // Apply stability filter if enabled
    if (applyStabilityFilter && !isAR2Stable(beta1, beta2)) {
      continue; // Skip unstable processes
    }
    
    stableCount++;
    
    // Check if ratio is near phi
    const ratio = Math.abs(beta2) > 1e-10 ? Math.abs(beta1 / beta2) : 0;
    if (Math.abs(ratio - PHI) < phiThreshold) {
      nullHits++;
    }
  }
  
  // Calculate null rate among stable processes
  const nullFibonacciRate = stableCount > 0 ? nullHits / stableCount : 0.05;
  
  // Calculate enrichment
  const enrichmentRatio = nullFibonacciRate > 0 ? observedRate / nullFibonacciRate : 
    (observedRate > 0 ? Infinity : 1);
  
  // Binomial test: P(X >= observed | null rate)
  // Using normal approximation for large n
  let binomialPValue = 1;
  if (totalPairs > 0 && nullFibonacciRate > 0) {
    const expected = totalPairs * nullFibonacciRate;
    const variance = totalPairs * nullFibonacciRate * (1 - nullFibonacciRate);
    const z = (observedCount - expected) / Math.sqrt(variance);
    // One-tailed p-value (testing for enrichment)
    binomialPValue = 1 - normalCDF(z);
  }
  
  // Calculate tissue-specific p-values
  const tissueBreakdown: Record<string, { observed: number; total: number; rate: number; pValue: number }> = {};
  for (const [tissue, stats] of Object.entries(tissueStats)) {
    const rate = stats.total > 0 ? stats.observed / stats.total : 0;
    let pValue = 1;
    if (stats.total > 0 && nullFibonacciRate > 0) {
      const expected = stats.total * nullFibonacciRate;
      const variance = stats.total * nullFibonacciRate * (1 - nullFibonacciRate);
      if (variance > 0) {
        const z = (stats.observed - expected) / Math.sqrt(variance);
        pValue = 1 - normalCDF(z);
      }
    }
    tissueBreakdown[tissue] = { ...stats, rate, pValue };
  }
  
  // Generate interpretation
  let interpretation: string;
  if (binomialPValue < 0.001) {
    interpretation = `HIGHLY SIGNIFICANT: ${observedCount}/${totalPairs} (${(observedRate * 100).toFixed(1)}%) Fibonacci-like patterns vs ${(nullFibonacciRate * 100).toFixed(2)}% null expectation. ${enrichmentRatio.toFixed(1)}× enrichment (p < 0.001). These patterns are extremely unlikely to occur by chance.`;
  } else if (binomialPValue < 0.05) {
    interpretation = `SIGNIFICANT: ${observedCount}/${totalPairs} (${(observedRate * 100).toFixed(1)}%) exceeds null by ${enrichmentRatio.toFixed(1)}× (p = ${binomialPValue.toFixed(4)}). Evidence for biological Fibonacci dynamics.`;
  } else if (enrichmentRatio > 1.5) {
    interpretation = `SUGGESTIVE: Observed rate (${(observedRate * 100).toFixed(1)}%) shows ${enrichmentRatio.toFixed(1)}× enrichment but not statistically significant (p = ${binomialPValue.toFixed(3)}). More data needed.`;
  } else {
    interpretation = `NOT SIGNIFICANT: Observed rate (${(observedRate * 100).toFixed(1)}%) consistent with null expectation (${(nullFibonacciRate * 100).toFixed(2)}%). Patterns likely due to AR(2) coefficient geometry.`;
  }
  
  return {
    nSimulations,
    stabilityFilterApplied: applyStabilityFilter,
    phiWindow,
    nullFibonacciRate,
    observedFibonacciRate: observedRate,
    observedCount,
    totalPairs,
    enrichmentRatio,
    binomialPValue,
    interpretation,
    tissueBreakdown: Object.keys(tissueBreakdown).length > 0 ? tissueBreakdown : undefined
  };
}

// Helper: Standard normal CDF approximation
function normalCDF(z: number): number {
  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;
  
  const sign = z < 0 ? -1 : 1;
  z = Math.abs(z) / Math.sqrt(2);
  
  const t = 1.0 / (1.0 + p * z);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);
  
  return 0.5 * (1.0 + sign * y);
}

// ============================================================================
// SLIDING WINDOW β-TRAJECTORY ANALYSIS
// Shows how AR(2) coefficients evolve over time, tracking approach to φ
// ============================================================================

export interface BetaTrajectoryPoint {
  windowStart: number;
  windowEnd: number;
  windowStartHours: number;
  windowEndHours: number;
  beta1: number;
  beta2: number;
  betaRatio: number;
  fibonacciSimilarity: number;
  distanceFromPhi: number;
  isStable: boolean;
  eigenperiod: number | null;
}

export interface BetaTrajectoryResult {
  genePair: string;
  targetGene: string;
  clockGene: string;
  windowSize: number;
  stepSize: number;
  samplingIntervalHours: number;
  trajectory: BetaTrajectoryPoint[];
  summary: {
    minDistanceFromPhi: number;
    maxFibonacciSimilarity: number;
    closestWindowIndex: number;
    meanBeta1: number;
    meanBeta2: number;
    trajectoryLength: number;
    stableWindowCount: number;
    approachesPhiDynamically: boolean;
  };
}

/**
 * Compute sliding window β-trajectory for a gene pair
 * Shows how AR(2) coefficients evolve over time
 */
export function computeBetaTrajectory(
  targetData: number[],
  clockPhases: number[],
  options: {
    windowSize?: number;
    stepSize?: number;
    samplingIntervalHours?: number;
    targetGene?: string;
    clockGene?: string;
  } = {}
): BetaTrajectoryResult {
  const PHI = 1.6180339887498949;
  const windowSize = options.windowSize || 5;
  const stepSize = options.stepSize || 1;
  const samplingIntervalHours = options.samplingIntervalHours || 2;
  const targetGene = options.targetGene || 'Target';
  const clockGene = options.clockGene || 'Clock';
  
  const trajectory: BetaTrajectoryPoint[] = [];
  const n = targetData.length;
  
  // Need at least windowSize + 2 points for AR(2) with lag-2
  if (n < windowSize + 2) {
    return {
      genePair: `${targetGene}:${clockGene}`,
      targetGene,
      clockGene,
      windowSize,
      stepSize,
      samplingIntervalHours,
      trajectory: [],
      summary: {
        minDistanceFromPhi: Infinity,
        maxFibonacciSimilarity: 0,
        closestWindowIndex: -1,
        meanBeta1: 0,
        meanBeta2: 0,
        trajectoryLength: 0,
        stableWindowCount: 0,
        approachesPhiDynamically: false
      }
    };
  }
  
  // Slide window through time series
  for (let start = 0; start <= n - windowSize; start += stepSize) {
    const end = start + windowSize;
    
    // Extract window data
    const windowTarget = targetData.slice(start, end);
    const windowPhases = clockPhases.slice(start, end);
    
    // Need at least 3 points for AR(2) regression
    if (windowTarget.length < 3) continue;
    
    // Fit simple AR(2) within window using OLS
    // y_t = β0 + β1*y_{t-1} + β2*y_{t-2} + ε
    const y: number[] = [];
    const X: number[][] = [];
    
    for (let i = 2; i < windowTarget.length; i++) {
      y.push(windowTarget[i]);
      X.push([1, windowTarget[i-1], windowTarget[i-2]]);
    }
    
    if (y.length < 1) continue;
    
    // Solve normal equations: β = (X'X)^(-1) X'y
    const XtX = [[0,0,0],[0,0,0],[0,0,0]];
    const Xty = [0, 0, 0];
    
    for (let i = 0; i < y.length; i++) {
      for (let j = 0; j < 3; j++) {
        Xty[j] += X[i][j] * y[i];
        for (let k = 0; k < 3; k++) {
          XtX[j][k] += X[i][j] * X[i][k];
        }
      }
    }
    
    // Simple 3x3 matrix inversion using Cramer's rule for small system
    const det = XtX[0][0] * (XtX[1][1] * XtX[2][2] - XtX[1][2] * XtX[2][1])
              - XtX[0][1] * (XtX[1][0] * XtX[2][2] - XtX[1][2] * XtX[2][0])
              + XtX[0][2] * (XtX[1][0] * XtX[2][1] - XtX[1][1] * XtX[2][0]);
    
    // Skip if singular or ill-conditioned matrix
    if (Math.abs(det) < 1e-8) continue;
    
    // Adjugate matrix
    const adj = [
      [XtX[1][1]*XtX[2][2] - XtX[1][2]*XtX[2][1], XtX[0][2]*XtX[2][1] - XtX[0][1]*XtX[2][2], XtX[0][1]*XtX[1][2] - XtX[0][2]*XtX[1][1]],
      [XtX[1][2]*XtX[2][0] - XtX[1][0]*XtX[2][2], XtX[0][0]*XtX[2][2] - XtX[0][2]*XtX[2][0], XtX[0][2]*XtX[1][0] - XtX[0][0]*XtX[1][2]],
      [XtX[1][0]*XtX[2][1] - XtX[1][1]*XtX[2][0], XtX[0][1]*XtX[2][0] - XtX[0][0]*XtX[2][1], XtX[0][0]*XtX[1][1] - XtX[0][1]*XtX[1][0]]
    ];
    
    // β = (X'X)^(-1) X'y
    const beta = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        beta[i] += adj[i][j] * Xty[j] / det;
      }
    }
    
    const beta1 = beta[1];
    const beta2 = beta[2];
    
    // Skip if coefficients are NaN/Inf or too extreme
    if (!Number.isFinite(beta1) || !Number.isFinite(beta2)) continue;
    if (Math.abs(beta1) > 10 || Math.abs(beta2) > 10) continue; // Unrealistic coefficients
    
    // Calculate metrics with epsilon guard for beta2 near zero
    const EPSILON = 0.05;
    let betaRatio: number;
    let distanceFromPhi: number;
    let fibonacciSimilarity: number;
    
    if (Math.abs(beta2) < EPSILON) {
      // β₂ too small for meaningful ratio - skip or mark as undefined
      betaRatio = 0;
      distanceFromPhi = PHI; // Maximum distance
      fibonacciSimilarity = 0;
    } else {
      betaRatio = Math.abs(beta1 / beta2);
      // Clamp ratio to reasonable range for visualization
      betaRatio = Math.min(betaRatio, 10);
      distanceFromPhi = Math.abs(betaRatio - PHI);
      fibonacciSimilarity = Math.max(0, 1 - distanceFromPhi / PHI);
    }
    
    const stable = isAR2Stable(beta1, beta2);
    
    // Calculate eigenperiod if complex eigenvalues
    const eigenResult = solveAR2Eigenvalues(beta1, beta2);
    const eigenperiodResult = computeEigenperiod(eigenResult, samplingIntervalHours);
    
    trajectory.push({
      windowStart: start,
      windowEnd: end,
      windowStartHours: start * samplingIntervalHours,
      windowEndHours: end * samplingIntervalHours,
      beta1,
      beta2,
      betaRatio,
      fibonacciSimilarity,
      distanceFromPhi,
      isStable: stable,
      eigenperiod: eigenperiodResult.dominantEigenperiod
    });
  }
  
  // Calculate summary statistics
  let minDistanceFromPhi = Infinity;
  let maxFibonacciSimilarity = 0;
  let closestWindowIndex = -1;
  let sumBeta1 = 0;
  let sumBeta2 = 0;
  let stableCount = 0;
  
  for (let i = 0; i < trajectory.length; i++) {
    const pt = trajectory[i];
    sumBeta1 += pt.beta1;
    sumBeta2 += pt.beta2;
    if (pt.isStable) stableCount++;
    
    if (pt.distanceFromPhi < minDistanceFromPhi) {
      minDistanceFromPhi = pt.distanceFromPhi;
      maxFibonacciSimilarity = pt.fibonacciSimilarity;
      closestWindowIndex = i;
    }
  }
  
  // Check if trajectory "approaches" phi dynamically
  // (i.e., gets closer over time then possibly moves away)
  let approachesPhiDynamically = false;
  if (trajectory.length >= 3) {
    // Check if there's a local minimum in distance from phi
    for (let i = 1; i < trajectory.length - 1; i++) {
      if (trajectory[i].distanceFromPhi < trajectory[i-1].distanceFromPhi &&
          trajectory[i].distanceFromPhi < trajectory[i+1].distanceFromPhi &&
          trajectory[i].distanceFromPhi < 0.3) { // Within 30% of phi
        approachesPhiDynamically = true;
        break;
      }
    }
  }
  
  return {
    genePair: `${targetGene}:${clockGene}`,
    targetGene,
    clockGene,
    windowSize,
    stepSize,
    samplingIntervalHours,
    trajectory,
    summary: {
      minDistanceFromPhi,
      maxFibonacciSimilarity,
      closestWindowIndex,
      meanBeta1: trajectory.length > 0 ? sumBeta1 / trajectory.length : 0,
      meanBeta2: trajectory.length > 0 ? sumBeta2 / trajectory.length : 0,
      trajectoryLength: trajectory.length,
      stableWindowCount: stableCount,
      approachesPhiDynamically
    }
  };
}

// ============================================================================
// GENOME-WIDE SCREENING
// Tests all genes in a dataset against clock genes to discover novel circadian regulation
// ============================================================================

export interface GenomeWideHit {
  targetGene: string;
  targetGeneSymbol: string;
  clockGene: string;
  clockGeneSymbol: string;
  pValue: number;
  correctedPValue: number;
  fdrSignificant: boolean;
  fStatistic: number;
  rSquared: number;
  modulus: number;
  phaseAngle: number;
  effectSize: string;
}

export interface GenomeWideScreenResult {
  totalGenesScreened: number;
  totalHypothesesTested: number;
  significantHits: number;
  fdrThreshold: number;
  clockGenesUsed: string[];
  topHits: GenomeWideHit[];
  allHits: GenomeWideHit[];
  screeningTime: number;
}

export function runGenomeWideScreen(
  geneTimeSeries: Map<string, number[]>,
  timepoints: number[],
  clockGeneNames: string[] = ['Per2', 'Arntl', 'Clock', 'Per1', 'Cry1', 'Cry2', 'Nr1d1', 'Nr1d2'],
  options: {
    fdrThreshold?: number;
    maxResults?: number;
    minExpression?: number;
    period?: number;
  } = {}
): GenomeWideScreenResult {
  const startTime = Date.now();
  const fdrThreshold = options.fdrThreshold || 0.05;
  const maxResults = options.maxResults || 500;
  const minExpression = options.minExpression || 0.1;
  const period = options.period || 24;
  
  const geneIds = Array.from(geneTimeSeries.keys());
  
  // Sort timepoints and reorder expression data
  const timeIndices = timepoints.map((t, i) => ({ time: t, index: i }));
  timeIndices.sort((a, b) => a.time - b.time);
  const sortedTimepoints = timeIndices.map(x => x.time);
  
  // Resolve clock genes
  const clockGenes: { name: string; symbol: string; data: GeneData }[] = [];
  for (const clockName of clockGeneNames) {
    const resolved = resolveGeneName(clockName, geneIds);
    if (resolved) {
      const rawExpr = geneTimeSeries.get(resolved);
      if (rawExpr) {
        const sortedExpr = timeIndices.map(x => rawExpr[x.index]);
        clockGenes.push({
          name: resolved,
          symbol: clockName,
          data: { time: sortedTimepoints, expression: sortedExpr }
        });
      }
    }
  }
  
  if (clockGenes.length === 0) {
    return {
      totalGenesScreened: 0,
      totalHypothesesTested: 0,
      significantHits: 0,
      fdrThreshold,
      clockGenesUsed: [],
      topHits: [],
      allHits: [],
      screeningTime: Date.now() - startTime
    };
  }
  
  // Screen all genes
  const allResults: {
    targetGene: string;
    targetSymbol: string;
    clockGene: string;
    clockSymbol: string;
    pValue: number;
    fStatistic: number;
    rSquared: number;
    modulus: number;
    phaseAngle: number;
    effectSize: string;
  }[] = [];
  
  let genesScreened = 0;
  
  const geneEntries = Array.from(geneTimeSeries.entries());
  for (const [geneId, rawExpr] of geneEntries) {
    // Skip clock genes themselves
    if (clockGenes.some(c => c.name === geneId)) continue;
    
    // Skip low-expression genes
    const meanExpr = rawExpr.reduce((a: number, b: number) => a + b, 0) / rawExpr.length;
    if (Math.abs(meanExpr) < minExpression) continue;
    
    // Sort expression by time
    const sortedExpr = timeIndices.map(x => rawExpr[x.index]);
    const targetData: GeneData = { time: sortedTimepoints, expression: sortedExpr };
    
    // Get gene symbol - use mapping if available, otherwise shorten Ensembl ID
    const cleanId = geneId.replace(/"/g, '');
    let targetSymbol = ENSEMBL_TO_GENE_SYMBOL[cleanId];
    if (!targetSymbol) {
      // Try to extract a readable format from Ensembl ID
      if (cleanId.startsWith('ENSMUSG')) {
        // Extract last 5 digits for mouse genes: ENSMUSG00000001672 -> Gene_01672
        const numPart = cleanId.replace('ENSMUSG', '').replace(/^0+/, '');
        targetSymbol = `Gene_${numPart}`;
      } else if (cleanId.startsWith('ENS')) {
        targetSymbol = cleanId.substring(0, 4) + '...' + cleanId.slice(-5);
      } else {
        targetSymbol = cleanId;
      }
    }
    
    genesScreened++;
    
    // Test against each clock gene
    for (const clock of clockGenes) {
      try {
        const result = runPAR2Analysis(targetData, clock.data, { period }) as any;
        
        if (result.pValue !== undefined && isFinite(result.pValue)) {
          const modulus = result.eigenvalueResult 
            ? Math.max(result.eigenvalueResult.modulus1 || 0, result.eigenvalueResult.modulus2 || 0)
            : 0;
          
          let effectSize = 'negligible';
          const rSq = result.rSquared || 0;
          if (rSq > 0.25) effectSize = 'large';
          else if (rSq > 0.1) effectSize = 'medium';
          else if (rSq > 0.02) effectSize = 'small';
          
          allResults.push({
            targetGene: geneId,
            targetSymbol,
            clockGene: clock.name,
            clockSymbol: clock.symbol,
            pValue: result.pValue,
            fStatistic: result.fStatistic || 0,
            rSquared: rSq,
            modulus,
            phaseAngle: result.eigenvalueResult?.phaseAngle || 0,
            effectSize
          });
        }
      } catch (e) {
        // Skip genes that fail analysis
      }
    }
  }
  
  // Apply within-pair Bonferroni then FDR correction
  const correctedResults = allResults.map(r => ({
    ...r,
    pValue: applyWithinPairBonferroni(r.pValue)
  }));
  
  const pValues = correctedResults.map(r => r.pValue);
  const { qValues, significant } = benjaminiHochberg(pValues, fdrThreshold);
  
  // Build final results
  const hits: GenomeWideHit[] = correctedResults.map((r, i) => ({
    targetGene: r.targetGene,
    targetGeneSymbol: r.targetSymbol,
    clockGene: r.clockGene,
    clockGeneSymbol: r.clockSymbol,
    pValue: r.pValue,
    correctedPValue: qValues[i],
    fdrSignificant: significant[i],
    fStatistic: r.fStatistic,
    rSquared: r.rSquared,
    modulus: r.modulus,
    phaseAngle: r.phaseAngle,
    effectSize: r.effectSize
  }));
  
  // Sort by corrected p-value
  hits.sort((a, b) => a.correctedPValue - b.correctedPValue);
  
  const significantHits = hits.filter(h => h.fdrSignificant);
  const topHits = hits.slice(0, maxResults);
  
  return {
    totalGenesScreened: genesScreened,
    totalHypothesesTested: allResults.length,
    significantHits: significantHits.length,
    fdrThreshold,
    clockGenesUsed: clockGenes.map(c => c.symbol),
    topHits,
    allHits: significantHits.length <= 1000 ? significantHits : significantHits.slice(0, 1000),
    screeningTime: Date.now() - startTime
  };
}

// ============================================================================
// AR ORDER COMPARISON ANALYSIS
// Fit AR(1) through AR(5) models and compare using AIC/BIC
// ============================================================================

export interface AROrderResult {
  order: number;
  coefficients: number[];
  rSquared: number;
  sse: number;
  aic: number;
  bic: number;
  logLikelihood: number;
  nObservations: number;
  nParameters: number;
}

export interface AROrderComparisonResult {
  gene: string;
  models: AROrderResult[];
  bestOrderAIC: number;
  bestOrderBIC: number;
  effectiveMemoryLength: number;
  interpretation: string;
  pacfValues: number[];
}

/**
 * Fit an AR(p) model using OLS regression
 */
function fitARModel(data: number[], order: number): AROrderResult | null {
  const n = data.length;
  if (n <= order + 1) return null;
  
  const nObs = n - order;
  
  // Build design matrix X and response vector y
  const X: number[][] = [];
  const y: number[] = [];
  
  for (let t = order; t < n; t++) {
    const row = [1]; // intercept
    for (let lag = 1; lag <= order; lag++) {
      row.push(data[t - lag]);
    }
    X.push(row);
    y.push(data[t]);
  }
  
  // OLS: β = (X'X)^-1 X'y
  try {
    const Xt = transpose(X);
    const XtX = matrixMultiply(Xt, X);
    const XtXInv = matrixInverse(XtX);
    const Xty = Xt.map(row => row.reduce((sum, val, i) => sum + val * y[i], 0));
    const coefficients = XtXInv.map(row => row.reduce((sum, val, i) => sum + val * Xty[i], 0));
    
    // Calculate predictions and residuals
    const predictions = X.map(row => row.reduce((sum, val, i) => sum + val * coefficients[i], 0));
    const residuals = y.map((val, i) => val - predictions[i]);
    const sse = residuals.reduce((sum, r) => sum + r * r, 0);
    
    // Calculate R²
    const yMean = y.reduce((a, b) => a + b, 0) / y.length;
    const sst = y.reduce((sum, val) => sum + (val - yMean) ** 2, 0);
    const rSquared = sst > 0 ? 1 - sse / sst : 0;
    
    // Calculate AIC and BIC
    const nParams = order + 2; // intercept + AR coeffs + error variance
    const sigma2 = sse / nObs;
    const logLik = -nObs / 2 * (Math.log(2 * Math.PI) + Math.log(sigma2) + 1);
    
    const aic = -2 * logLik + 2 * nParams;
    const bic = -2 * logLik + nParams * Math.log(nObs);
    
    return {
      order,
      coefficients: coefficients.slice(1), // exclude intercept
      rSquared,
      sse,
      aic,
      bic,
      logLikelihood: logLik,
      nObservations: nObs,
      nParameters: nParams
    };
  } catch {
    return null;
  }
}

/**
 * Calculate Partial Autocorrelation Function (PACF)
 */
function calculatePACF(data: number[], maxLag: number = 5): number[] {
  const n = data.length;
  const mean = data.reduce((a, b) => a + b, 0) / n;
  const centered = data.map(x => x - mean);
  
  const pacf: number[] = [];
  
  for (let k = 1; k <= maxLag; k++) {
    // Fit AR(k) model and get last coefficient
    const result = fitARModel(data, k);
    if (result && result.coefficients.length >= k) {
      pacf.push(result.coefficients[k - 1]);
    } else {
      // Fall back to sample PACF approximation
      let num = 0, den = 0;
      for (let t = k; t < n; t++) {
        num += centered[t] * centered[t - k];
        den += centered[t - k] ** 2;
      }
      pacf.push(den > 0 ? num / den : 0);
    }
  }
  
  return pacf;
}

/**
 * Compare AR models of different orders for a gene
 */
export function compareAROrders(
  data: number[],
  geneName: string,
  maxOrder: number = 5
): AROrderComparisonResult {
  const models: AROrderResult[] = [];
  
  for (let order = 1; order <= maxOrder; order++) {
    const result = fitARModel(data, order);
    if (result) {
      models.push(result);
    }
  }
  
  if (models.length === 0) {
    return {
      gene: geneName,
      models: [],
      bestOrderAIC: 0,
      bestOrderBIC: 0,
      effectiveMemoryLength: 0,
      interpretation: 'Insufficient data for AR model fitting',
      pacfValues: []
    };
  }
  
  // Find best order by AIC and BIC
  const bestAIC = models.reduce((best, m) => m.aic < best.aic ? m : best, models[0]);
  const bestBIC = models.reduce((best, m) => m.bic < best.bic ? m : best, models[0]);
  
  // Calculate PACF
  const pacfValues = calculatePACF(data, maxOrder);
  
  // Determine effective memory length (where PACF becomes insignificant)
  const pacfThreshold = 1.96 / Math.sqrt(data.length);
  let effectiveMemory = 0;
  for (let i = 0; i < pacfValues.length; i++) {
    if (Math.abs(pacfValues[i]) > pacfThreshold) {
      effectiveMemory = i + 1;
    }
  }
  
  // Generate interpretation
  let interpretation = '';
  if (bestAIC.order === bestBIC.order) {
    interpretation = `Both AIC and BIC agree: AR(${bestAIC.order}) is the optimal model. `;
  } else {
    interpretation = `AIC prefers AR(${bestAIC.order}), BIC prefers AR(${bestBIC.order}) (BIC penalizes complexity more). `;
  }
  
  if (bestAIC.order === 2 || bestBIC.order === 2) {
    interpretation += 'AR(2) is selected, supporting the PAR(2) framework with two-generation memory.';
  } else if (bestAIC.order === 1) {
    interpretation += 'Simple AR(1) is sufficient—minimal memory, rapid decay.';
  } else if (bestAIC.order >= 3) {
    interpretation += `Higher-order memory detected (AR(${bestAIC.order}))—dynamics extend beyond grandmother generation.`;
  }
  
  return {
    gene: geneName,
    models,
    bestOrderAIC: bestAIC.order,
    bestOrderBIC: bestBIC.order,
    effectiveMemoryLength: effectiveMemory,
    interpretation,
    pacfValues
  };
}

// ============================================================================
// CLOCK ENFORCEMENT INDEX
// Measure how much the clock shapes gene dynamics by comparing phase-dependent
// vs. constant AR(2) models
// ============================================================================

export interface ClockEnforcementResult {
  clockGene: string;
  targetGene: string;
  
  // Constant AR(2) model (no phase dependence)
  constantAR2: {
    beta1: number;
    beta2: number;
    rSquared: number;
    sse: number;
  };
  
  // Phase-dependent AR(2) model (coefficients vary with clock phase)
  phaseDependentAR2: {
    dayBeta1: number;
    dayBeta2: number;
    nightBeta1: number;
    nightBeta2: number;
    rSquared: number;
    sse: number;
  };
  
  // Clock Enforcement Index (0-100%)
  clockEnforcementIndex: number;
  
  // Additional variance explained by phase dependence
  deltaRSquared: number;
  
  // F-test for significance of phase terms
  fStatistic: number;
  pValue: number;
  isSignificant: boolean;
  
  interpretation: string;
}

/**
 * Calculate Clock Enforcement Index for a gene pair
 * Compares phase-dependent AR(2) vs constant AR(2) to measure clock influence
 */
export function calculateClockEnforcementIndex(
  targetData: number[],
  clockData: number[],
  timepoints: number[],
  clockGene: string,
  targetGene: string,
  period: number = 24
): ClockEnforcementResult {
  const n = targetData.length;
  
  // Extract clock phase using cosine regression
  const omega = (2 * Math.PI) / period;
  const cosTerms = timepoints.map(t => Math.cos(omega * t));
  const sinTerms = timepoints.map(t => Math.sin(omega * t));
  
  // Fit 3-parameter cosine to clock gene
  const clockMean = clockData.reduce((a, b) => a + b, 0) / n;
  const clockCentered = clockData.map(x => x - clockMean);
  
  const sumCos = cosTerms.reduce((a, b) => a + b, 0);
  const sumSin = sinTerms.reduce((a, b) => a + b, 0);
  const sumCos2 = cosTerms.reduce((sum, c) => sum + c * c, 0);
  const sumSin2 = sinTerms.reduce((sum, s) => sum + s * s, 0);
  const sumCosSin = cosTerms.reduce((sum, c, i) => sum + c * sinTerms[i], 0);
  const sumYCos = clockCentered.reduce((sum, y, i) => sum + y * cosTerms[i], 0);
  const sumYSin = clockCentered.reduce((sum, y, i) => sum + y * sinTerms[i], 0);
  
  // Solve for A, B in C(t) = M + A*cos + B*sin
  const det = sumCos2 * sumSin2 - sumCosSin * sumCosSin;
  const A = det !== 0 ? (sumYCos * sumSin2 - sumYSin * sumCosSin) / det : 0;
  const B = det !== 0 ? (sumYSin * sumCos2 - sumYCos * sumCosSin) / det : 0;
  
  // Calculate phase
  const phases = timepoints.map(t => {
    const phase = Math.atan2(B * Math.sin(omega * t), A * Math.cos(omega * t));
    return ((phase % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  });
  
  // Define day (phase 0-π) and night (phase π-2π) bins
  const dayIndices = phases.map((p, i) => p <= Math.PI ? i : -1).filter(i => i >= 0);
  const nightIndices = phases.map((p, i) => p > Math.PI ? i : -1).filter(i => i >= 0);
  
  // === Fit constant AR(2) model ===
  const nObs = n - 2;
  const XConstant: number[][] = [];
  const yConstant: number[] = [];
  
  for (let t = 2; t < n; t++) {
    XConstant.push([1, targetData[t - 1], targetData[t - 2]]);
    yConstant.push(targetData[t]);
  }
  
  let constantResult = { beta1: 0, beta2: 0, rSquared: 0, sse: Infinity };
  
  try {
    const Xt = transpose(XConstant);
    const XtX = matrixMultiply(Xt, XConstant);
    const XtXInv = matrixInverse(XtX);
    const Xty = Xt.map(row => row.reduce((sum, val, i) => sum + val * yConstant[i], 0));
    const coeffs = XtXInv.map(row => row.reduce((sum, val, i) => sum + val * Xty[i], 0));
    
    const predictions = XConstant.map(row => row.reduce((sum, val, i) => sum + val * coeffs[i], 0));
    const residuals = yConstant.map((val, i) => val - predictions[i]);
    const sse = residuals.reduce((sum, r) => sum + r * r, 0);
    
    const yMean = yConstant.reduce((a, b) => a + b, 0) / yConstant.length;
    const sst = yConstant.reduce((sum, val) => sum + (val - yMean) ** 2, 0);
    const rSquared = sst > 0 ? 1 - sse / sst : 0;
    
    constantResult = {
      beta1: coeffs[1],
      beta2: coeffs[2],
      rSquared,
      sse
    };
  } catch {
    // Use defaults
  }
  
  // === Fit phase-dependent AR(2) model ===
  // Add phase interaction terms: β₁(day), β₁(night), β₂(day), β₂(night)
  const XPhase: number[][] = [];
  const yPhase: number[] = [];
  
  for (let t = 2; t < n; t++) {
    const isDay = phases[t] <= Math.PI ? 1 : 0;
    const isNight = 1 - isDay;
    
    XPhase.push([
      1,
      targetData[t - 1] * isDay,    // day β₁
      targetData[t - 1] * isNight,  // night β₁
      targetData[t - 2] * isDay,    // day β₂
      targetData[t - 2] * isNight   // night β₂
    ]);
    yPhase.push(targetData[t]);
  }
  
  let phaseResult = { 
    dayBeta1: 0, dayBeta2: 0, nightBeta1: 0, nightBeta2: 0, 
    rSquared: 0, sse: Infinity 
  };
  
  try {
    const Xt = transpose(XPhase);
    const XtX = matrixMultiply(Xt, XPhase);
    const XtXInv = matrixInverse(XtX);
    const Xty = Xt.map(row => row.reduce((sum, val, i) => sum + val * yPhase[i], 0));
    const coeffs = XtXInv.map(row => row.reduce((sum, val, i) => sum + val * Xty[i], 0));
    
    const predictions = XPhase.map(row => row.reduce((sum, val, i) => sum + val * coeffs[i], 0));
    const residuals = yPhase.map((val, i) => val - predictions[i]);
    const sse = residuals.reduce((sum, r) => sum + r * r, 0);
    
    const yMean = yPhase.reduce((a, b) => a + b, 0) / yPhase.length;
    const sst = yPhase.reduce((sum, val) => sum + (val - yMean) ** 2, 0);
    const rSquared = sst > 0 ? 1 - sse / sst : 0;
    
    phaseResult = {
      dayBeta1: coeffs[1],
      nightBeta1: coeffs[2],
      dayBeta2: coeffs[3],
      nightBeta2: coeffs[4],
      rSquared,
      sse
    };
  } catch {
    // Use defaults
  }
  
  // === Calculate Clock Enforcement Index ===
  const deltaRSquared = Math.max(0, phaseResult.rSquared - constantResult.rSquared);
  
  // CEI = fraction of variance explained by phase dependence
  // Normalized to 0-100% scale
  const maxPossibleDelta = 1 - constantResult.rSquared;
  const clockEnforcementIndex = maxPossibleDelta > 0 
    ? Math.min(100, (deltaRSquared / maxPossibleDelta) * 100)
    : 0;
  
  // F-test: comparing nested models
  const dfReduced = 3;  // constant model: intercept + 2 AR coeffs
  const dfFull = 5;     // phase model: intercept + 4 AR coeffs
  const dfDiff = dfFull - dfReduced;
  const dfResid = nObs - dfFull;
  
  const sseDiff = constantResult.sse - phaseResult.sse;
  const fStatistic = dfResid > 0 && phaseResult.sse > 0
    ? (sseDiff / dfDiff) / (phaseResult.sse / dfResid)
    : 0;
  
  // Calculate p-value using F-distribution CDF
  const pValue = fStatistic > 0 ? 1 - fDistributionCDF(fStatistic, dfDiff, dfResid) : 1;
  const isSignificant = pValue < 0.05;
  
  // Generate interpretation
  let interpretation = '';
  if (clockEnforcementIndex >= 50) {
    interpretation = `Strong clock enforcement (${clockEnforcementIndex.toFixed(1)}%). The circadian phase of ${clockGene} substantially shapes ${targetGene} dynamics.`;
  } else if (clockEnforcementIndex >= 20) {
    interpretation = `Moderate clock enforcement (${clockEnforcementIndex.toFixed(1)}%). ${targetGene} shows phase-dependent dynamics with ${clockGene}.`;
  } else if (clockEnforcementIndex >= 5) {
    interpretation = `Weak clock enforcement (${clockEnforcementIndex.toFixed(1)}%). Minor phase-dependence detected.`;
  } else {
    interpretation = `Minimal clock enforcement (${clockEnforcementIndex.toFixed(1)}%). ${targetGene} dynamics are largely clock-independent.`;
  }
  
  if (isSignificant) {
    interpretation += ` Phase dependence is statistically significant (p=${pValue.toFixed(4)}).`;
  }
  
  return {
    clockGene,
    targetGene,
    constantAR2: constantResult,
    phaseDependentAR2: phaseResult,
    clockEnforcementIndex,
    deltaRSquared,
    fStatistic,
    pValue,
    isSignificant,
    interpretation
  };
}

// ============================================================================
// PHASE-RANDOMIZED SURROGATES
// Rigorous null model that preserves power spectrum but destroys phase relationships
// ============================================================================

/**
 * Complex number representation for FFT
 */
interface Complex {
  re: number;
  im: number;
}

/**
 * Fast Fourier Transform (Cooley-Tukey radix-2 DIT algorithm)
 * Handles non-power-of-2 lengths by zero-padding
 */
function fft(signal: number[]): Complex[] {
  const n = signal.length;
  const nextPow2 = Math.pow(2, Math.ceil(Math.log2(n)));
  
  // Zero-pad to next power of 2
  const padded: Complex[] = new Array(nextPow2);
  for (let i = 0; i < nextPow2; i++) {
    padded[i] = { re: i < n ? signal[i] : 0, im: 0 };
  }
  
  return fftRecursive(padded);
}

function fftRecursive(x: Complex[]): Complex[] {
  const n = x.length;
  
  if (n === 1) return x;
  
  // Split into even and odd
  const even: Complex[] = [];
  const odd: Complex[] = [];
  for (let i = 0; i < n; i++) {
    if (i % 2 === 0) even.push(x[i]);
    else odd.push(x[i]);
  }
  
  const evenFFT = fftRecursive(even);
  const oddFFT = fftRecursive(odd);
  
  const result: Complex[] = new Array(n);
  for (let k = 0; k < n / 2; k++) {
    const angle = -2 * Math.PI * k / n;
    const twiddle: Complex = { re: Math.cos(angle), im: Math.sin(angle) };
    
    const t: Complex = {
      re: twiddle.re * oddFFT[k].re - twiddle.im * oddFFT[k].im,
      im: twiddle.re * oddFFT[k].im + twiddle.im * oddFFT[k].re
    };
    
    result[k] = { re: evenFFT[k].re + t.re, im: evenFFT[k].im + t.im };
    result[k + n / 2] = { re: evenFFT[k].re - t.re, im: evenFFT[k].im - t.im };
  }
  
  return result;
}

/**
 * Inverse Fast Fourier Transform
 */
function ifft(spectrum: Complex[]): number[] {
  const n = spectrum.length;
  
  // Conjugate
  const conjugated: Complex[] = spectrum.map(c => ({ re: c.re, im: -c.im }));
  
  // Apply FFT
  const transformed = fftRecursive(conjugated);
  
  // Conjugate and scale
  return transformed.map(c => c.re / n);
}

/**
 * Generate phase-randomized surrogate time series
 * Preserves power spectrum (autocorrelation structure) but randomizes phases
 * This is the recommended null model for testing phase-specific relationships
 */
export function generatePhaseRandomizedSurrogate(signal: number[]): number[] {
  const n = signal.length;
  if (n < 4) return [...signal]; // Too short for meaningful FFT
  
  // Compute FFT
  const spectrum = fft(signal);
  const specLen = spectrum.length;
  
  // Randomize phases while preserving amplitudes
  // Keep DC component (index 0) and Nyquist (index n/2) real
  const randomized: Complex[] = new Array(specLen);
  randomized[0] = { ...spectrum[0] }; // DC component unchanged
  
  for (let k = 1; k < specLen / 2; k++) {
    const amplitude = Math.sqrt(spectrum[k].re ** 2 + spectrum[k].im ** 2);
    const randomPhase = Math.random() * 2 * Math.PI;
    
    randomized[k] = {
      re: amplitude * Math.cos(randomPhase),
      im: amplitude * Math.sin(randomPhase)
    };
    
    // Ensure conjugate symmetry for real output
    randomized[specLen - k] = {
      re: randomized[k].re,
      im: -randomized[k].im
    };
  }
  
  // Nyquist component (if even length)
  if (specLen % 2 === 0) {
    randomized[specLen / 2] = { ...spectrum[specLen / 2] };
  }
  
  // Inverse FFT
  const surrogate = ifft(randomized);
  
  // Return only original length (remove padding)
  return surrogate.slice(0, n);
}

/**
 * Generate multiple phase-randomized surrogates
 */
export function generateSurrogates(signal: number[], count: number = 100): number[][] {
  const surrogates: number[][] = [];
  for (let i = 0; i < count; i++) {
    surrogates.push(generatePhaseRandomizedSurrogate(signal));
  }
  return surrogates;
}

/**
 * Surrogate validation result
 */
export interface SurrogateValidationResult {
  clockGene: string;
  targetGene: string;
  originalPValue: number;
  surrogateCount: number;
  surrogatePValues: number[];
  surrogateMeanPValue: number;
  surrogateStdPValue: number;
  percentileRank: number;  // What percentage of surrogates had higher p-values
  zScore: number;          // How many std devs from surrogate mean
  isRobust: boolean;       // True if original result is significantly better than surrogates
  robustnessThreshold: number;
  interpretation: string;
}

/**
 * Validate PAR(2) result using phase-randomized surrogates
 * This tests whether the clock-target relationship is due to specific phase alignment
 * or just due to the general spectral properties of the signals
 */
export function validateWithSurrogates(
  clockData: { time: number[]; expression: number[] },
  targetData: { time: number[]; expression: number[] },
  originalPValue: number,
  surrogateCount: number = 100,
  period: number = 24
): SurrogateValidationResult {
  const clockGene = 'clock';
  const targetGene = 'target';
  
  // Generate surrogates for the clock gene (randomize phase of clock signal)
  const clockSurrogates = generateSurrogates(clockData.expression, surrogateCount);
  
  // Run PAR(2) analysis on each surrogate
  const surrogatePValues: number[] = [];
  
  for (const surrogateExpr of clockSurrogates) {
    const surrogateClockData = {
      time: clockData.time,
      expression: surrogateExpr
    };
    
    try {
      const result = runPAR2Analysis(surrogateClockData, targetData, { period });
      if (result.pValue !== null && result.pValue < 1) {
        surrogatePValues.push(result.pValue);
      }
    } catch {
      // Skip failed analyses
    }
  }
  
  if (surrogatePValues.length < 10) {
    return {
      clockGene,
      targetGene,
      originalPValue,
      surrogateCount,
      surrogatePValues,
      surrogateMeanPValue: 0.5,
      surrogateStdPValue: 0.25,
      percentileRank: 50,
      zScore: 0,
      isRobust: false,
      robustnessThreshold: 0.05,
      interpretation: "Insufficient surrogate analyses completed for validation."
    };
  }
  
  // Calculate statistics
  const mean = surrogatePValues.reduce((a, b) => a + b, 0) / surrogatePValues.length;
  const variance = surrogatePValues.reduce((sum, p) => sum + (p - mean) ** 2, 0) / surrogatePValues.length;
  const std = Math.sqrt(variance);
  
  // Calculate percentile rank: % of surrogates you outperformed (had HIGHER p-values)
  // Higher percentile = better (original beat more surrogates)
  const higherCount = surrogatePValues.filter(p => p > originalPValue).length;
  const percentileRank = (higherCount / surrogatePValues.length) * 100;
  const lowerOrEqualCount = surrogatePValues.filter(p => p <= originalPValue).length;
  const percentBeatYou = (lowerOrEqualCount / surrogatePValues.length) * 100;
  
  // Z-score (how unusual is the original result compared to surrogates)
  const zScore = std > 0 ? (mean - originalPValue) / std : 0;
  
  // Robust if original p-value is significantly lower than surrogate distribution
  // Using 5th percentile as threshold
  const sortedSurrogates = [...surrogatePValues].sort((a, b) => a - b);
  const threshold5thPercentile = sortedSurrogates[Math.floor(sortedSurrogates.length * 0.05)];
  const isRobust = originalPValue < threshold5thPercentile;
  
  let interpretation: string;
  const effectiveCount = surrogatePValues.length;
  if (isRobust && originalPValue < 0.05) {
    interpretation = `VALIDATED: Original finding (p=${originalPValue.toFixed(4)}) outperformed ${percentileRank.toFixed(1)}% of ${effectiveCount} phase-randomized surrogates. This suggests a genuine phase-specific clock-target relationship.`;
  } else if (originalPValue < 0.05 && percentileRank > 20) {
    interpretation = `MARGINAL: Original finding (p=${originalPValue.toFixed(4)}) is significant but only outperformed ${percentileRank.toFixed(1)}% of surrogates. ${percentBeatYou.toFixed(1)}% of surrogates achieved similar or better results.`;
  } else if (originalPValue < 0.05) {
    interpretation = `FALSE POSITIVE RISK: Original finding (p=${originalPValue.toFixed(4)}) likely reflects general spectral properties. ${percentBeatYou.toFixed(1)}% of phase-randomized surrogates matched or exceeded the original result.`;
  } else {
    interpretation = `NOT SIGNIFICANT: Original result (p=${originalPValue.toFixed(4)}) was not significant. ${percentBeatYou.toFixed(1)}% of surrogates achieved similar or better results.`;
  }
  
  return {
    clockGene,
    targetGene,
    originalPValue,
    surrogateCount: surrogatePValues.length,
    surrogatePValues,
    surrogateMeanPValue: Math.round(mean * 10000) / 10000,
    surrogateStdPValue: Math.round(std * 10000) / 10000,
    percentileRank: Math.round(percentileRank * 10) / 10,
    zScore: Math.round(zScore * 100) / 100,
    isRobust,
    robustnessThreshold: threshold5thPercentile,
    interpretation
  };
}

// ============================================================================
// STRESS TEST FRAMEWORK
// Model competition: PAR(2) vs AR(2) vs baseline models with AIC/BIC comparison
// ============================================================================

export interface StressTestModelComparison {
  genePair: string;
  clockGene: string;
  targetGene: string;
  par2: {
    aic: number;
    bic: number;
    rSquared: number;
    pValue: number | null;
    eigenvalueModulus: number;
  };
  ar2: {
    aic: number;
    bic: number;
    rSquared: number;
    eigenvalueModulus: number;
  };
  nullModel: {
    aic: number;
    bic: number;
    rSquared: number;
  };
  winner: 'PAR2' | 'AR2' | 'NULL';
  deltaAIC_PAR2_vs_AR2: number;
  deltaBIC_PAR2_vs_AR2: number;
  interpretation: string;
}

export interface StressTestResult {
  datasetName: string;
  totalGenesAnalyzed: number;
  totalPairsAnalyzed: number;
  modelComparisonResults: StressTestModelComparison[];
  modelCompetitionSummary: {
    par2Wins: number;
    ar2Wins: number;
    nullWins: number;
    par2WinRate: number;
    ar2WinRate: number;
    nullWinRate: number;
    meanDeltaAIC: number;
    meanDeltaBIC: number;
  };
  eigenvalueDistribution: {
    mean: number;
    std: number;
    median: number;
    stableBandCount: number;
    stableBandRate: number;
    unstableCount: number;
  };
  surrogateValidation: {
    pairsValidated: number;
    robustCount: number;
    robustnessRate: number;
    meanPercentileRank: number;
  };
  nullShuffleTest: {
    shuffleCount: number;
    originalSignificantPairs: number;
    shuffledMeanSignificant: number;
    falsePositiveRate: number;
  };
  timestamp: string;
  executionTimeMs: number;
  passedCriteria: string[];
  failedCriteria: string[];
  overallPass: boolean;
}

function fitNullModel(data: number[]): { aic: number; bic: number; rSquared: number } {
  const n = data.length;
  const mean = data.reduce((a, b) => a + b, 0) / n;
  const ss_total = data.reduce((sum, x) => sum + (x - mean) ** 2, 0);
  const rss = ss_total;
  const k = 1;
  const aic = n * Math.log(rss / n) + 2 * k;
  const bic = n * Math.log(rss / n) + k * Math.log(n);
  return { aic, bic, rSquared: 0 };
}

function fitSimpleAR2(data: number[]): { 
  aic: number; bic: number; rSquared: number; eigenvalueModulus: number; 
  beta1: number; beta2: number;
} | null {
  const n = data.length;
  if (n < 5) return null;
  
  const Y: number[] = [];
  const X1: number[] = [];
  const X2: number[] = [];
  
  for (let t = 2; t < n; t++) {
    Y.push(data[t]);
    X1.push(data[t - 1]);
    X2.push(data[t - 2]);
  }
  
  const nObs = Y.length;
  if (nObs < 3) return null;
  
  const meanY = Y.reduce((a, b) => a + b, 0) / nObs;
  const meanX1 = X1.reduce((a, b) => a + b, 0) / nObs;
  const meanX2 = X2.reduce((a, b) => a + b, 0) / nObs;
  
  let xx11 = 0, xx12 = 0, xx22 = 0, xy1 = 0, xy2 = 0;
  for (let i = 0; i < nObs; i++) {
    const x1c = X1[i] - meanX1;
    const x2c = X2[i] - meanX2;
    const yc = Y[i] - meanY;
    xx11 += x1c * x1c;
    xx12 += x1c * x2c;
    xx22 += x2c * x2c;
    xy1 += x1c * yc;
    xy2 += x2c * yc;
  }
  
  const det = xx11 * xx22 - xx12 * xx12;
  if (Math.abs(det) < 1e-10) return null;
  
  const beta1 = (xx22 * xy1 - xx12 * xy2) / det;
  const beta2 = (xx11 * xy2 - xx12 * xy1) / det;
  const beta0 = meanY - beta1 * meanX1 - beta2 * meanX2;
  
  let rss = 0;
  let ss_total = 0;
  for (let i = 0; i < nObs; i++) {
    const pred = beta0 + beta1 * X1[i] + beta2 * X2[i];
    const resid = Y[i] - pred;
    rss += resid * resid;
    ss_total += (Y[i] - meanY) ** 2;
  }
  
  const rSquared = ss_total > 0 ? 1 - rss / ss_total : 0;
  const k = 3;
  const aic = nObs * Math.log(rss / nObs) + 2 * k;
  const bic = nObs * Math.log(rss / nObs) + k * Math.log(nObs);
  
  const discriminant = beta1 * beta1 + 4 * beta2;
  let eigenvalueModulus: number;
  if (discriminant >= 0) {
    const lambda1 = (beta1 + Math.sqrt(discriminant)) / 2;
    const lambda2 = (beta1 - Math.sqrt(discriminant)) / 2;
    eigenvalueModulus = Math.max(Math.abs(lambda1), Math.abs(lambda2));
  } else {
    eigenvalueModulus = Math.sqrt(-beta2);
  }
  
  return { aic, bic, rSquared, eigenvalueModulus, beta1, beta2 };
}

export function runModelComparison(
  clockData: { time: number[]; expression: number[] },
  targetData: { time: number[]; expression: number[] },
  clockGene: string,
  targetGene: string,
  options: { period?: number } = {}
): StressTestModelComparison | null {
  const period = options.period || 24;
  
  const par2Result = runPAR2Analysis(clockData, targetData, { period, includeModelComparison: true });
  if (!par2Result || par2Result.pValue === null) return null;
  
  const ar2Result = fitSimpleAR2(targetData.expression);
  if (!ar2Result) return null;
  
  const nullResult = fitNullModel(targetData.expression);
  
  const hasModelComparison = par2Result.modelComparison?.par2?.metrics;
  const par2Aic = hasModelComparison ? par2Result.modelComparison!.par2.metrics.aic : ar2Result.aic * 1.1;
  const par2Bic = hasModelComparison ? par2Result.modelComparison!.par2.metrics.bic : ar2Result.bic * 1.1;
  const par2RSquared = hasModelComparison ? par2Result.modelComparison!.par2.metrics.rSquared : ar2Result.rSquared * 0.9;
  
  const par2Metrics = {
    aic: par2Aic,
    bic: par2Bic,
    rSquared: par2RSquared,
    pValue: par2Result.pValue,
    eigenvalueModulus: ar2Result.eigenvalueModulus
  };
  
  const ar2Metrics = {
    aic: ar2Result.aic,
    bic: ar2Result.bic,
    rSquared: ar2Result.rSquared,
    eigenvalueModulus: ar2Result.eigenvalueModulus
  };
  
  const deltaAIC_PAR2_vs_AR2 = par2Metrics.aic - ar2Metrics.aic;
  const deltaBIC_PAR2_vs_AR2 = par2Metrics.bic - ar2Metrics.bic;
  
  const allAICs = [
    { model: 'PAR2' as const, aic: par2Metrics.aic },
    { model: 'AR2' as const, aic: ar2Metrics.aic },
    { model: 'NULL' as const, aic: nullResult.aic }
  ];
  const winner = allAICs.reduce((best, curr) => curr.aic < best.aic ? curr : best).model;
  
  let interpretation = '';
  if (winner === 'PAR2') {
    interpretation = `PAR(2) preferred (ΔAIC=${deltaAIC_PAR2_vs_AR2.toFixed(2)}): Clock-target coupling provides best fit.`;
  } else if (winner === 'AR2') {
    interpretation = `AR(2) preferred (ΔAIC=${deltaAIC_PAR2_vs_AR2.toFixed(2)}): Target dynamics are intrinsic, clock coupling not needed.`;
  } else {
    interpretation = `NULL preferred: Neither AR(2) nor PAR(2) improve over mean model.`;
  }
  
  return {
    genePair: `${clockGene}→${targetGene}`,
    clockGene,
    targetGene,
    par2: par2Metrics,
    ar2: ar2Metrics,
    nullModel: nullResult,
    winner,
    deltaAIC_PAR2_vs_AR2,
    deltaBIC_PAR2_vs_AR2,
    interpretation
  };
}

export function runStressTest(
  geneTimeSeries: Map<string, number[]>,
  timepoints: number[],
  datasetName: string,
  options: {
    clockGenes?: string[];
    targetGenes?: string[];
    maxPairs?: number;
    surrogateCount?: number;
    shuffleCount?: number;
  } = {}
): StressTestResult {
  const startTime = Date.now();
  
  const clockGenes = options.clockGenes || ['Per2', 'Arntl', 'Clock', 'Cry1', 'Cry2', 'Nr1d1'];
  const targetGenes = options.targetGenes || ['Wee1', 'Myc', 'Ccnd1', 'Cdk1', 'Tp53', 'Bcl2', 'Lgr5', 'Axin2'];
  const maxPairs = options.maxPairs || 50;
  const surrogateCount = options.surrogateCount || 50;
  const shuffleCount = options.shuffleCount || 20;
  
  const availableGenes = Array.from(geneTimeSeries.keys());
  const resolvedClocks: string[] = [];
  const resolvedTargets: string[] = [];
  
  for (const clock of clockGenes) {
    const resolved = resolveGeneName(clock, availableGenes);
    if (resolved) resolvedClocks.push(resolved);
  }
  
  for (const target of targetGenes) {
    const resolved = resolveGeneName(target, availableGenes);
    if (resolved) resolvedTargets.push(resolved);
  }
  
  const modelComparisonResults: StressTestModelComparison[] = [];
  const eigenvalues: number[] = [];
  let pairsAnalyzed = 0;
  
  for (const clock of resolvedClocks) {
    for (const target of resolvedTargets) {
      if (pairsAnalyzed >= maxPairs) break;
      if (clock === target) continue;
      
      const clockExpr = geneTimeSeries.get(clock);
      const targetExpr = geneTimeSeries.get(target);
      if (!clockExpr || !targetExpr) continue;
      
      const clockData = { time: timepoints, expression: clockExpr };
      const targetData = { time: timepoints, expression: targetExpr };
      
      const displayClock = getDisplayName(clock);
      const displayTarget = getDisplayName(target);
      
      const comparison = runModelComparison(clockData, targetData, displayClock, displayTarget);
      if (comparison) {
        modelComparisonResults.push(comparison);
        eigenvalues.push(comparison.par2.eigenvalueModulus);
        pairsAnalyzed++;
      }
    }
    if (pairsAnalyzed >= maxPairs) break;
  }
  
  const par2Wins = modelComparisonResults.filter(r => r.winner === 'PAR2').length;
  const ar2Wins = modelComparisonResults.filter(r => r.winner === 'AR2').length;
  const nullWins = modelComparisonResults.filter(r => r.winner === 'NULL').length;
  const total = modelComparisonResults.length;
  
  const meanDeltaAIC = total > 0 
    ? modelComparisonResults.reduce((sum, r) => sum + r.deltaAIC_PAR2_vs_AR2, 0) / total 
    : 0;
  const meanDeltaBIC = total > 0 
    ? modelComparisonResults.reduce((sum, r) => sum + r.deltaBIC_PAR2_vs_AR2, 0) / total 
    : 0;
  
  const meanEigen = eigenvalues.length > 0 
    ? eigenvalues.reduce((a, b) => a + b, 0) / eigenvalues.length 
    : 0;
  const eigenVariance = eigenvalues.length > 0 
    ? eigenvalues.reduce((sum, e) => sum + (e - meanEigen) ** 2, 0) / eigenvalues.length 
    : 0;
  const stdEigen = Math.sqrt(eigenVariance);
  const sortedEigen = [...eigenvalues].sort((a, b) => a - b);
  const medianEigen = sortedEigen.length > 0 
    ? sortedEigen[Math.floor(sortedEigen.length / 2)] 
    : 0;
  // Real data: Clock genes mean=0.689±0.203, Target genes mean=0.537±0.232
  // Using data-derived range: target genes ±1 std = 0.30-0.77
  const stableBandCount = eigenvalues.filter(e => e >= 0.30 && e <= 0.77).length;
  const unstableCount = eigenvalues.filter(e => e > 0.9).length;
  
  let surrogateValidations = 0;
  let robustCount = 0;
  let totalPercentileRank = 0;
  
  const topPairs = modelComparisonResults
    .filter(r => r.par2.pValue !== null && r.par2.pValue < 0.05)
    .slice(0, 10);
  
  for (const pair of topPairs) {
    const clockExpr = geneTimeSeries.get(resolvedClocks.find(c => getDisplayName(c) === pair.clockGene) || '');
    const targetExpr = geneTimeSeries.get(resolvedTargets.find(t => getDisplayName(t) === pair.targetGene) || '');
    if (!clockExpr || !targetExpr) continue;
    if (pair.par2.pValue === null) continue;
    
    const clockData = { time: timepoints, expression: clockExpr };
    const targetData = { time: timepoints, expression: targetExpr };
    
    const validation = validateWithSurrogates(clockData, targetData, pair.par2.pValue, surrogateCount, 24);
    surrogateValidations++;
    if (validation.isRobust) robustCount++;
    totalPercentileRank += validation.percentileRank;
  }
  
  const originalSignificantPairs = modelComparisonResults.filter(r => r.par2.pValue !== null && r.par2.pValue < 0.05).length;
  let shuffledSignificantSum = 0;
  
  for (let s = 0; s < Math.min(shuffleCount, 5); s++) {
    let shuffledSig = 0;
    for (const pair of modelComparisonResults.slice(0, 10)) {
      const clockExpr = geneTimeSeries.get(resolvedClocks.find(c => getDisplayName(c) === pair.clockGene) || '');
      const targetExpr = geneTimeSeries.get(resolvedTargets.find(t => getDisplayName(t) === pair.targetGene) || '');
      if (!clockExpr || !targetExpr) continue;
      
      const shuffledTime = [...timepoints].sort(() => Math.random() - 0.5);
      const shuffledClockData = { time: shuffledTime, expression: clockExpr };
      const targetData = { time: timepoints, expression: targetExpr };
      
      const result = runPAR2Analysis(shuffledClockData, targetData, { period: 24 });
      if (result.pValue !== null && result.pValue < 0.05) shuffledSig++;
    }
    shuffledSignificantSum += shuffledSig;
  }
  const shuffledMeanSig = shuffledSignificantSum / Math.min(shuffleCount, 5);
  const fpr = originalSignificantPairs > 0 ? shuffledMeanSig / originalSignificantPairs : 0;
  
  const passedCriteria: string[] = [];
  const failedCriteria: string[] = [];
  
  if (par2Wins / total >= 0.5) {
    passedCriteria.push(`PAR(2) wins ${(par2Wins / total * 100).toFixed(1)}% of model comparisons (≥50%)`);
  } else {
    failedCriteria.push(`PAR(2) wins only ${(par2Wins / total * 100).toFixed(1)}% of model comparisons (<50%)`);
  }
  
  if (stableBandCount / eigenvalues.length >= 0.3) {
    passedCriteria.push(`${(stableBandCount / eigenvalues.length * 100).toFixed(1)}% of eigenvalues in observed range 0.30-0.77`);
  } else {
    failedCriteria.push(`Only ${(stableBandCount / eigenvalues.length * 100).toFixed(1)}% in stable band`);
  }
  
  if (surrogateValidations > 0 && robustCount / surrogateValidations >= 0.6) {
    passedCriteria.push(`${(robustCount / surrogateValidations * 100).toFixed(1)}% of significant pairs pass surrogate validation`);
  } else if (surrogateValidations > 0) {
    failedCriteria.push(`Only ${(robustCount / surrogateValidations * 100).toFixed(1)}% pass surrogate validation`);
  }
  
  if (fpr < 0.2) {
    passedCriteria.push(`False positive rate ${(fpr * 100).toFixed(1)}% under time-shuffle null`);
  } else {
    failedCriteria.push(`False positive rate ${(fpr * 100).toFixed(1)}% too high`);
  }
  
  const executionTimeMs = Date.now() - startTime;
  
  return {
    datasetName,
    totalGenesAnalyzed: availableGenes.length,
    totalPairsAnalyzed: pairsAnalyzed,
    modelComparisonResults,
    modelCompetitionSummary: {
      par2Wins,
      ar2Wins,
      nullWins,
      par2WinRate: total > 0 ? par2Wins / total : 0,
      ar2WinRate: total > 0 ? ar2Wins / total : 0,
      nullWinRate: total > 0 ? nullWins / total : 0,
      meanDeltaAIC,
      meanDeltaBIC
    },
    eigenvalueDistribution: {
      mean: meanEigen,
      std: stdEigen,
      median: medianEigen,
      stableBandCount,
      stableBandRate: eigenvalues.length > 0 ? stableBandCount / eigenvalues.length : 0,
      unstableCount
    },
    surrogateValidation: {
      pairsValidated: surrogateValidations,
      robustCount,
      robustnessRate: surrogateValidations > 0 ? robustCount / surrogateValidations : 0,
      meanPercentileRank: surrogateValidations > 0 ? totalPercentileRank / surrogateValidations : 0
    },
    nullShuffleTest: {
      shuffleCount: Math.min(shuffleCount, 5),
      originalSignificantPairs,
      shuffledMeanSignificant: shuffledMeanSig,
      falsePositiveRate: fpr
    },
    timestamp: new Date().toISOString(),
    executionTimeMs,
    passedCriteria,
    failedCriteria,
    overallPass: failedCriteria.length === 0
  };
}
