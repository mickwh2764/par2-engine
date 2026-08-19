/**
 * Age Correction Module for PAR(2) Eigenvalue Analysis
 * 
 * VALIDATION STATUS: UNCALIBRATED - RESEARCH USE ONLY
 * 
 * These parameters are derived from circadian amplitude literature, not direct
 * eigenvalue measurements. The eigenvalue (temporal persistence) may track 
 * differently than amplitude (oscillation strength).
 * 
 * Literature sources for drift estimates:
 * - Brain/SCN: Chen et al. 2015 (PNAS) - HIGH confidence
 * - Adrenal: Ahmad et al. 2023 (PMC9929559) - MEDIUM confidence  
 * - Colon: Valero-Alcaide et al. 2020 (MDPI IJMS) - HYPOTHETICAL (see note)
 * - Blood: Hood & Amir 2017 (JCI) - MEDIUM confidence
 * - Other tissues: Extrapolated from amplitude decline literature
 * 
 * COLON PARADOX NOTE: Valero-Alcaide 2020 found that human colonic molecular 
 * clock (BMAL1, PER1, CLOCK) actually INCREASES in amplitude beyond age 74,
 * suggesting "compensatory hyper-rhythmicity". This is modeled as NEGATIVE 
 * eigenvalue drift (baseline decreases with age, widening the stable-to-instability gap).
 */

export type ValidationConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'HYPOTHETICAL';

export interface AgeCorrection {
  originalEigenvalue: number;
  correctedEigenvalue: number;
  ageDriftFactor: number;
  ageGroup: 'YOUNG' | 'MIDDLE' | 'SENIOR' | 'ELDERLY';
  tissueType: string;
  correctionApplied: number;
  interpretation: string;
  validationStatus: 'UNCALIBRATED';
  confidenceLevel: ValidationConfidence;
  literatureSource: string;
}

export interface AgeCorrectedBaseline {
  tissue: string;
  baselineEigenvalue: number;
  stableBandLower: number;
  stableBandUpper: number;
  warningThreshold: number;
  criticalThreshold: number;
  ageSpecificNotes: string[];
  validationStatus: 'UNCALIBRATED';
}

export interface TissueAgeParameters {
  tissue: string;
  baseEigenvalue: number;
  driftPerDecade: number;
  stableBandWidth: number;
  maxAgeDrift: number;
  senescenceOnsetAge: number;
  confidenceLevel: ValidationConfidence;
  literatureSource: string;
  notes?: string;
}

const TISSUE_AGE_PARAMETERS: Record<string, TissueAgeParameters> = {
  'colon': {
    tissue: 'Colon',
    baseEigenvalue: 0.537,  // Real target gene baseline from Jan 2026 audit
    driftPerDecade: -0.005,
    stableBandWidth: 0.25,  // Updated: real data std dev is 0.232
    maxAgeDrift: 0.04,
    senescenceOnsetAge: 74,
    confidenceLevel: 'HYPOTHETICAL',
    literatureSource: 'Real data audit (33 datasets), Valero-Alcaide et al. 2020',
    notes: 'COLON PARADOX: Amplitude INCREASES with age (compensatory hyper-rhythmicity). Negative drift = eigenvalue may decrease slightly.'
  },
  'liver': {
    tissue: 'Liver',
    baseEigenvalue: 0.717,  // Real data from Jan 2026 audit
    driftPerDecade: 0.015,
    stableBandWidth: 0.22,
    maxAgeDrift: 0.10,
    senescenceOnsetAge: 60,
    confidenceLevel: 'LOW',
    literatureSource: 'Real data audit (33 datasets)'
  },
  'adrenal': {
    tissue: 'Adrenal',
    baseEigenvalue: 0.55,
    driftPerDecade: 0.025,
    stableBandWidth: 0.18,
    maxAgeDrift: 0.15,
    senescenceOnsetAge: 50,
    confidenceLevel: 'MEDIUM',
    literatureSource: 'Ahmad et al. 2023 (PMC9929559)',
    notes: 'Significant loss of rhythmic genes with age in mouse adrenal'
  },
  'kidney': {
    tissue: 'Kidney',
    baseEigenvalue: 0.889,  // Real data from Jan 2026 audit (kidney has highest mean)
    driftPerDecade: 0.015,
    stableBandWidth: 0.20,
    maxAgeDrift: 0.11,
    senescenceOnsetAge: 55,
    confidenceLevel: 'LOW',
    literatureSource: 'Real data audit (33 datasets)'
  },
  'heart': {
    tissue: 'Heart',
    baseEigenvalue: 0.53,
    driftPerDecade: 0.012,
    stableBandWidth: 0.16,
    maxAgeDrift: 0.08,
    senescenceOnsetAge: 65,
    confidenceLevel: 'LOW',
    literatureSource: 'Extrapolated from general amplitude decline literature'
  },
  'brain': {
    tissue: 'Brain/SCN',
    baseEigenvalue: 0.58,
    driftPerDecade: 0.040,
    stableBandWidth: 0.15,
    maxAgeDrift: 0.20,
    senescenceOnsetAge: 45,
    confidenceLevel: 'HIGH',
    literatureSource: 'Chen et al. 2015 (PNAS)',
    notes: 'PER1/PER2 rhythms flattened and phase-advanced 4-6h in adults >60y. CRY1 becomes arrhythmic. 588 genes lose rhythmicity.'
  },
  'muscle': {
    tissue: 'Muscle',
    baseEigenvalue: 0.51,
    driftPerDecade: 0.018,
    stableBandWidth: 0.20,
    maxAgeDrift: 0.13,
    senescenceOnsetAge: 50,
    confidenceLevel: 'LOW',
    literatureSource: 'Extrapolated from general amplitude decline literature'
  },
  'blood': {
    tissue: 'Blood (Peripheral)',
    baseEigenvalue: 0.45,
    driftPerDecade: 0.015,
    stableBandWidth: 0.25,
    maxAgeDrift: 0.10,
    senescenceOnsetAge: 70,
    confidenceLevel: 'MEDIUM',
    literatureSource: 'Hood & Amir 2017 (JCI); Plasma lipidome ~4% per decade',
    notes: 'BMAL1 expression negatively correlates with age in women. Blood accessible for clinical validation.'
  },
  'intestine': {
    tissue: 'Small Intestine',
    baseEigenvalue: 0.54,
    driftPerDecade: 0.018,
    stableBandWidth: 0.18,
    maxAgeDrift: 0.13,
    senescenceOnsetAge: 55,
    confidenceLevel: 'LOW',
    literatureSource: 'Extrapolated from general amplitude decline literature'
  },
  'default': {
    tissue: 'Generic Tissue',
    baseEigenvalue: 0.537,  // Real target gene baseline from Jan 2026 audit
    driftPerDecade: 0.015,
    stableBandWidth: 0.25,  // Updated: real data std dev is 0.232
    maxAgeDrift: 0.12,
    senescenceOnsetAge: 55,
    confidenceLevel: 'LOW',
    literatureSource: 'Real data audit (33 datasets)'
  }
};

const REFERENCE_AGE = 30;

function getAgeGroup(age: number): 'YOUNG' | 'MIDDLE' | 'SENIOR' | 'ELDERLY' {
  if (age < 35) return 'YOUNG';
  if (age < 55) return 'MIDDLE';
  if (age < 70) return 'SENIOR';
  return 'ELDERLY';
}

function calculateAgeDrift(
  age: number,
  params: TissueAgeParameters
): number {
  const decadesFromReference = (age - REFERENCE_AGE) / 10;
  
  let baseDrift = decadesFromReference * params.driftPerDecade;
  
  if (age > params.senescenceOnsetAge) {
    const senescenceYears = age - params.senescenceOnsetAge;
    const accelerationFactor = 1 + (senescenceYears / 30) * 0.5;
    baseDrift *= accelerationFactor;
  }
  
  // Symmetric clamping: handles both positive drift (most tissues) 
  // and negative drift (colon - compensatory hyper-rhythmicity)
  return Math.max(-params.maxAgeDrift, Math.min(baseDrift, params.maxAgeDrift));
}

export function correctEigenvalueForAge(
  eigenvalue: number,
  age: number,
  tissueType: string = 'default'
): AgeCorrection {
  const tissueKey = tissueType.toLowerCase().replace(/[^a-z]/g, '');
  const params = TISSUE_AGE_PARAMETERS[tissueKey] || TISSUE_AGE_PARAMETERS['default'];
  
  const ageDrift = calculateAgeDrift(age, params);
  const correctedEigenvalue = eigenvalue - ageDrift;
  
  const ageGroup = getAgeGroup(age);
  
  let interpretation: string;
  const ageAdjustedThreshold = params.baseEigenvalue + params.stableBandWidth / 2 + ageDrift;
  
  if (eigenvalue < params.baseEigenvalue + params.stableBandWidth / 2) {
    interpretation = 'HEALTHY: Eigenvalue within stable band for this age';
  } else if (eigenvalue < ageAdjustedThreshold) {
    interpretation = 'AGE-NORMAL: Elevated eigenvalue consistent with biological aging';
  } else if (eigenvalue < 0.85) {
    interpretation = 'MONITOR: Eigenvalue elevated beyond age-expected drift';
  } else {
    interpretation = 'ALERT: Significant instability detected, warrants clinical review';
  }
  
  return {
    originalEigenvalue: eigenvalue,
    correctedEigenvalue,
    ageDriftFactor: ageDrift,
    ageGroup,
    tissueType: params.tissue,
    correctionApplied: eigenvalue - correctedEigenvalue,
    interpretation,
    validationStatus: 'UNCALIBRATED' as const,
    confidenceLevel: params.confidenceLevel,
    literatureSource: params.literatureSource
  };
}

export function getAgeCorrectedBaseline(
  age: number,
  tissueType: string = 'default'
): AgeCorrectedBaseline {
  const tissueKey = tissueType.toLowerCase().replace(/[^a-z]/g, '');
  const params = TISSUE_AGE_PARAMETERS[tissueKey] || TISSUE_AGE_PARAMETERS['default'];
  
  const ageDrift = calculateAgeDrift(age, params);
  const adjustedBase = params.baseEigenvalue + ageDrift;
  
  const notes: string[] = [];
  const ageGroup = getAgeGroup(age);
  
  notes.push(`Reference age: ${REFERENCE_AGE} years (baseline eigenvalue: ${params.baseEigenvalue})`);
  notes.push(`Age adjustment: +${(ageDrift * 100).toFixed(1)}% for ${age} years`);
  
  if (age > params.senescenceOnsetAge) {
    notes.push(`Senescence acceleration active (onset at ${params.senescenceOnsetAge} for ${params.tissue})`);
  }
  
  if (ageGroup === 'ELDERLY') {
    notes.push('IMPORTANT: Elderly patients may show higher baseline variation - consider individual calibration');
  }
  
  return {
    tissue: params.tissue,
    baselineEigenvalue: adjustedBase,
    stableBandLower: adjustedBase - params.stableBandWidth / 2,
    stableBandUpper: adjustedBase + params.stableBandWidth / 2,
    warningThreshold: adjustedBase + params.stableBandWidth * 0.75,
    criticalThreshold: Math.min(0.90, adjustedBase + params.stableBandWidth),
    ageSpecificNotes: notes,
    validationStatus: 'UNCALIBRATED' as const
  };
}

export function batchAgeCorrectionAnalysis(
  eigenvalues: { gene: string; eigenvalue: number }[],
  age: number,
  tissueType: string = 'default'
): {
  corrections: Map<string, AgeCorrection>;
  summary: {
    totalGenes: number;
    healthyCount: number;
    ageNormalCount: number;
    monitorCount: number;
    alertCount: number;
    meanOriginalEigenvalue: number;
    meanCorrectedEigenvalue: number;
    ageGroup: string;
    overallAssessment: string;
  };
} {
  const corrections = new Map<string, AgeCorrection>();
  let healthy = 0, ageNormal = 0, monitor = 0, alert = 0;
  let sumOriginal = 0, sumCorrected = 0;
  
  for (const { gene, eigenvalue } of eigenvalues) {
    const correction = correctEigenvalueForAge(eigenvalue, age, tissueType);
    corrections.set(gene, correction);
    
    sumOriginal += eigenvalue;
    sumCorrected += correction.correctedEigenvalue;
    
    if (correction.interpretation.startsWith('HEALTHY')) healthy++;
    else if (correction.interpretation.startsWith('AGE-NORMAL')) ageNormal++;
    else if (correction.interpretation.startsWith('MONITOR')) monitor++;
    else alert++;
  }
  
  const n = eigenvalues.length;
  const ageGroup = getAgeGroup(age);
  
  let overallAssessment: string;
  if (alert > 0) {
    overallAssessment = `REQUIRES ATTENTION: ${alert} gene(s) show significant instability beyond age expectations`;
  } else if (monitor > n * 0.2) {
    overallAssessment = 'BORDERLINE: Multiple genes elevated beyond age-normal range - recommend follow-up';
  } else if (ageNormal > n * 0.5) {
    overallAssessment = 'AGE-APPROPRIATE: Elevated eigenvalues consistent with biological aging';
  } else {
    overallAssessment = 'HEALTHY: Eigenvalue profile within expected range for age';
  }
  
  return {
    corrections,
    summary: {
      totalGenes: n,
      healthyCount: healthy,
      ageNormalCount: ageNormal,
      monitorCount: monitor,
      alertCount: alert,
      meanOriginalEigenvalue: n > 0 ? sumOriginal / n : 0,
      meanCorrectedEigenvalue: n > 0 ? sumCorrected / n : 0,
      ageGroup,
      overallAssessment
    }
  };
}

export function getTissueAgeParameters(): Record<string, TissueAgeParameters> {
  return { ...TISSUE_AGE_PARAMETERS };
}

export function generateAgeComparisonTable(
  eigenvalue: number,
  tissueType: string = 'colon'
): {
  ages: number[];
  comparisons: {
    age: number;
    ageGroup: string;
    baseline: number;
    stableBandUpper: number;
    inputStatus: string;
    driftFromYoung: number;
  }[];
} {
  const ages = [25, 35, 45, 55, 65, 75, 85];
  const comparisons = ages.map(age => {
    const baseline = getAgeCorrectedBaseline(age, tissueType);
    const correction = correctEigenvalueForAge(eigenvalue, age, tissueType);
    const youngBaseline = getAgeCorrectedBaseline(25, tissueType);
    
    return {
      age,
      ageGroup: correction.ageGroup,
      baseline: baseline.baselineEigenvalue,
      stableBandUpper: baseline.stableBandUpper,
      inputStatus: correction.interpretation.split(':')[0],
      driftFromYoung: baseline.baselineEigenvalue - youngBaseline.baselineEigenvalue
    };
  });
  
  return { ages, comparisons };
}
