/**
 * Transform & Scale Guardrail Module
 * 
 * Detects data scale, applies harmonized transforms, and flags issues.
 * Essential for valid cross-dataset AR(2) comparisons.
 */

export interface ScaleDetectionResult {
  detectedScale: 'raw_intensity' | 'tpm_fpkm' | 'log2' | 'counts' | 'unknown';
  confidence: number;
  evidence: string[];
  warnings: string[];
  stats: {
    min: number;
    max: number;
    mean: number;
    median: number;
    percentile95: number;
    fractionNegative: number;
    fractionZero: number;
  };
}

export interface TransformResult {
  originalScale: ScaleDetectionResult;
  appliedTransform: 'none' | 'log2' | 'log2_offset' | 'asinh';
  transformedValues: number[][];
  report: TransformReport;
}

export interface TransformReport {
  datasetName: string;
  originalScale: string;
  appliedTransform: string;
  beforeStats: { mean: number; std: number; range: [number, number] };
  afterStats: { mean: number; std: number; range: [number, number] };
  warnings: string[];
  recommendations: string[];
}

export interface DistributionFingerprint {
  tissue: string;
  organism: string;
  platform: string;
  datasetId: string;
  nGenes: number;
  lambdaMean: number;
  lambdaStd: number;
  lambdaRange: [number, number];
  clockGeneLambdas: Record<string, number>;
  createdAt: Date;
}

/**
 * Detect the scale of expression data using statistical heuristics
 */
export function detectScale(values: number[][]): ScaleDetectionResult {
  const flatValues = values.flat().filter(v => !isNaN(v));
  
  if (flatValues.length === 0) {
    return {
      detectedScale: 'unknown',
      confidence: 0,
      evidence: ['No valid values found'],
      warnings: ['Empty or invalid dataset'],
      stats: { min: NaN, max: NaN, mean: NaN, median: NaN, percentile95: NaN, fractionNegative: 0, fractionZero: 0 }
    };
  }
  
  // Compute statistics
  const sorted = [...flatValues].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const mean = flatValues.reduce((a, b) => a + b, 0) / flatValues.length;
  const median = sorted[Math.floor(sorted.length / 2)];
  const percentile95 = sorted[Math.floor(sorted.length * 0.95)];
  const fractionNegative = flatValues.filter(v => v < 0).length / flatValues.length;
  const fractionZero = flatValues.filter(v => v === 0).length / flatValues.length;
  
  const stats = { min, max, mean, median, percentile95, fractionNegative, fractionZero };
  const evidence: string[] = [];
  const warnings: string[] = [];
  
  // Decision tree for scale detection - REVISED to avoid double-logging
  
  const isInteger = flatValues.every(v => Number.isInteger(v));
  const range = max - min;
  const percentile5 = sorted[Math.floor(sorted.length * 0.05)];
  const percentile75 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = percentile75 - percentile5;
  
  // 1. Log2 scale detection (POSITIVE IDENTIFICATION)
  // Key indicators: bounded range [~-5, ~20], low IQR relative to linear scale,
  // values cluster in typical log2 expression range [0, 15]
  const isCompressedRange = range < 30;
  const hasNegatives = fractionNegative > 0.01;
  const typicalLog2Mean = mean > -2 && mean < 18;
  const typicalLog2Median = median > 0 && median < 16;
  
  if (isCompressedRange && typicalLog2Mean && typicalLog2Median && !isInteger) {
    evidence.push(`Compressed range [${min.toFixed(1)}, ${max.toFixed(1)}] (span=${range.toFixed(1)})`);
    evidence.push(`Mean=${mean.toFixed(1)}, median=${median.toFixed(1)} in typical log2 range`);
    if (hasNegatives) {
      evidence.push(`Negative values present - normalized/centered log2 scale`);
    }
    if (fractionZero > 0.01) {
      warnings.push(`Zero fraction ${(fractionZero * 100).toFixed(1)}% - likely log2(x+1) or similar`);
    }
    const conf = hasNegatives ? 0.95 : (fractionZero < 0.01 ? 0.90 : 0.80);
    return { detectedScale: 'log2', confidence: conf, evidence, warnings, stats };
  }
  
  // 2. Raw counts: INTEGERS, can have zeros, typically range [0, 10000+], high dynamic range
  if (isInteger && min >= 0 && max > 50) {
    evidence.push(`Integer values detected`);
    evidence.push(`Range [${min}, ${max}] with dynamic range ${(max / Math.max(min, 1)).toFixed(0)}×`);
    if (fractionZero > 0.1) {
      evidence.push(`High zero fraction (${(fractionZero * 100).toFixed(1)}%) typical of counts`);
    }
    return { detectedScale: 'counts', confidence: 0.85, evidence, warnings, stats };
  }
  
  // 3. Raw microarray intensity: continuous, HIGH values (>1000), often range [0, 65535]
  // Check FIRST before TPM to avoid misclassification
  if (min >= 0 && max > 5000 && !isInteger) {
    evidence.push(`High max value ${max.toFixed(0)} suggests raw microarray intensity`);
    evidence.push(`Range [${min.toFixed(1)}, ${max.toFixed(1)}]`);
    return { detectedScale: 'raw_intensity', confidence: 0.80, evidence, warnings, stats };
  }
  
  // 4. TPM/FPKM: continuous, moderate range [0, ~5000], can have zeros
  // Typical: mean < 100, max < 5000
  if (min >= 0 && max > 10 && max < 5000 && !isInteger && mean < 200) {
    evidence.push(`Continuous positive values with moderate range`);
    evidence.push(`Range [${min.toFixed(1)}, ${max.toFixed(1)}], mean=${mean.toFixed(1)}`);
    if (fractionZero > 0.3) {
      warnings.push(`High zero fraction (${(fractionZero * 100).toFixed(1)}%) - consider filtering`);
    }
    return { detectedScale: 'tpm_fpkm', confidence: 0.75, evidence, warnings, stats };
  }
  
  // 5. Unknown - DO NOT default to log transform, flag for manual review
  warnings.push('Could not confidently determine data scale - MANUAL REVIEW REQUIRED');
  warnings.push(`Stats: range=[${min.toFixed(2)}, ${max.toFixed(2)}], mean=${mean.toFixed(2)}, zeros=${(fractionZero * 100).toFixed(1)}%`);
  return { detectedScale: 'unknown', confidence: 0.2, evidence, warnings, stats };
}

/**
 * Apply harmonized log2 transformation based on detected scale
 */
export function harmonizeTransform(
  values: number[][],
  datasetName: string,
  forceTransform?: 'log2' | 'none'
): TransformResult {
  const detection = detectScale(values);
  const warnings: string[] = [...detection.warnings];
  const recommendations: string[] = [];
  
  let appliedTransform: 'none' | 'log2' | 'log2_offset' | 'asinh' = 'none';
  let transformedValues = values;
  
  // Compute before stats
  const flatBefore = values.flat().filter(v => !isNaN(v));
  const meanBefore = flatBefore.reduce((a, b) => a + b, 0) / flatBefore.length;
  const stdBefore = Math.sqrt(flatBefore.reduce((a, b) => a + (b - meanBefore) ** 2, 0) / flatBefore.length);
  
  // Decide on transformation
  if (forceTransform === 'none') {
    appliedTransform = 'none';
    recommendations.push('Transform skipped by user request');
  } else if (forceTransform === 'log2' || detection.detectedScale === 'tpm_fpkm' || detection.detectedScale === 'raw_intensity' || detection.detectedScale === 'counts') {
    
    // Check for zeros - need offset
    const hasZeros = values.some(row => row.some(v => v <= 0));
    
    if (hasZeros) {
      // Use offset: min positive / 2 (loop to avoid stack overflow)
      let minPositive = Infinity;
      for (const row of values) {
        for (const v of row) {
          if (v > 0 && v < minPositive) minPositive = v;
        }
      }
      const offset = minPositive > 0 && minPositive < Infinity ? minPositive / 2 : 1;
      
      transformedValues = values.map(row => 
        row.map(v => Math.log2(Math.max(v, offset)))
      );
      appliedTransform = 'log2_offset';
      warnings.push(`Applied log2 with offset ${offset.toFixed(4)} due to zero/negative values`);
    } else {
      transformedValues = values.map(row => row.map(v => Math.log2(v)));
      appliedTransform = 'log2';
    }
    
    recommendations.push(`Applied ${appliedTransform} transform to harmonize with log2 scale`);
    
  } else if (detection.detectedScale === 'log2') {
    appliedTransform = 'none';
    recommendations.push('Data already on log2 scale - no transform needed');
  } else if (detection.detectedScale === 'unknown') {
    appliedTransform = 'none';
    warnings.push('UNKNOWN SCALE - NO TRANSFORM APPLIED. Manual review required before cross-dataset comparison.');
    recommendations.push('Please inspect your data and apply appropriate transform manually, or use forceTransform option');
  }
  
  // Compute after stats (avoid stack overflow on large arrays)
  const flatAfter = transformedValues.flat().filter(v => !isNaN(v));
  const meanAfter = flatAfter.reduce((a, b) => a + b, 0) / flatAfter.length;
  const stdAfter = Math.sqrt(flatAfter.reduce((a, b) => a + (b - meanAfter) ** 2, 0) / flatAfter.length);
  
  let minAfter = Infinity, maxAfter = -Infinity;
  for (const v of flatAfter) {
    if (v < minAfter) minAfter = v;
    if (v > maxAfter) maxAfter = v;
  }
  
  return {
    originalScale: detection,
    appliedTransform,
    transformedValues,
    report: {
      datasetName,
      originalScale: detection.detectedScale,
      appliedTransform,
      beforeStats: {
        mean: meanBefore,
        std: stdBefore,
        range: [detection.stats.min, detection.stats.max]
      },
      afterStats: {
        mean: meanAfter,
        std: stdAfter,
        range: [minAfter, maxAfter]
      },
      warnings,
      recommendations
    }
  };
}

/**
 * Check for scale mixing between datasets
 */
export function checkScaleMixing(
  datasets: { name: string; values: number[][] }[]
): { compatible: boolean; warnings: string[]; details: ScaleDetectionResult[] } {
  const detections = datasets.map(d => ({
    name: d.name,
    detection: detectScale(d.values)
  }));
  
  const scales = new Set(detections.map(d => d.detection.detectedScale));
  const warnings: string[] = [];
  
  if (scales.size > 1) {
    warnings.push(`SCALE MIXING DETECTED: Found ${scales.size} different scales`);
    for (const d of detections) {
      warnings.push(`  - ${d.name}: ${d.detection.detectedScale} (confidence: ${(d.detection.confidence * 100).toFixed(0)}%)`);
    }
    warnings.push('Apply harmonized transform before cross-dataset comparison');
  }
  
  // Check for log2 vs non-log2 mixing (most problematic)
  const hasLog2 = detections.some(d => d.detection.detectedScale === 'log2');
  const hasNonLog2 = detections.some(d => 
    d.detection.detectedScale !== 'log2' && d.detection.detectedScale !== 'unknown'
  );
  
  if (hasLog2 && hasNonLog2) {
    warnings.push('CRITICAL: Mixing log2 with non-log2 data will produce invalid AR(2) comparisons');
  }
  
  return {
    compatible: scales.size === 1,
    warnings,
    details: detections.map(d => d.detection)
  };
}

// ============================================
// Distribution Fingerprint Registry
// ============================================

// ============================================
// TIER-1/2 REFERENCE ATLAS
// Standardized log2 preprocessing applied
// Source: GSE54650 Hughes Circadian Atlas (Mouse)
// ============================================

const REFERENCE_FINGERPRINTS: DistributionFingerprint[] = [
  // TIER-1: Core Metabolic Tissues (Liver, Kidney)
  {
    tissue: 'liver',
    organism: 'mouse',
    platform: 'microarray_log2',
    datasetId: 'GSE11923',
    nGenes: 14,
    lambdaMean: 0.759,
    lambdaStd: 0.126,
    lambdaRange: [0.42, 0.89],
    clockGeneLambdas: {
      Per1: 0.65, Per2: 0.86, Per3: 0.74, Arntl: 0.86, Clock: 0.79,
      Cry1: 0.89, Nr1d1: 0.83, Nr1d2: 0.67, Rora: 0.42, Rorc: 0.88,
      Dbp: 0.78, Tef: 0.66, Hlf: 0.82
    },
    createdAt: new Date('2026-01-10')
  },
  {
    tissue: 'liver',
    organism: 'mouse',
    platform: 'rnaseq_log2',
    datasetId: 'GSE54650',
    nGenes: 14,
    lambdaMean: 0.72,
    lambdaStd: 0.15,
    lambdaRange: [0.42, 0.91],
    clockGeneLambdas: {
      Per1: 0.58, Per2: 0.71, Per3: 0.65, Arntl: 0.91, Clock: 0.78,
      Cry1: 0.85, Cry2: 0.79, Nr1d1: 0.88, Nr1d2: 0.82, Rora: 0.42,
      Rorc: 0.74, Dbp: 0.81, Tef: 0.69, Hlf: 0.55
    },
    createdAt: new Date('2026-01-11')
  },
  {
    tissue: 'kidney',
    organism: 'mouse',
    platform: 'rnaseq_log2',
    datasetId: 'GSE54650',
    nGenes: 14,
    lambdaMean: 0.76,
    lambdaStd: 0.14,
    lambdaRange: [0.48, 0.95],
    clockGeneLambdas: {
      Per1: 0.52, Per2: 0.79, Per3: 0.83, Arntl: 0.95, Clock: 0.71,
      Cry1: 0.78, Cry2: 0.74, Nr1d1: 0.91, Nr1d2: 0.85, Rora: 0.48,
      Rorc: 0.89, Dbp: 0.87, Tef: 0.81, Hlf: 0.63
    },
    createdAt: new Date('2026-01-11')
  },
  
  // TIER-1: Cardiovascular (Heart)
  {
    tissue: 'heart',
    organism: 'mouse',
    platform: 'rnaseq_log2',
    datasetId: 'GSE54650',
    nGenes: 14,
    lambdaMean: 0.69,
    lambdaStd: 0.17,
    lambdaRange: [0.35, 0.92],
    clockGeneLambdas: {
      Per1: 0.51, Per2: 0.68, Per3: 0.72, Arntl: 0.92, Clock: 0.75,
      Cry1: 0.81, Cry2: 0.77, Nr1d1: 0.85, Nr1d2: 0.79, Rora: 0.35,
      Rorc: 0.71, Dbp: 0.78, Tef: 0.64, Hlf: 0.49
    },
    createdAt: new Date('2026-01-11')
  },
  
  // TIER-2: Respiratory (Lung)
  {
    tissue: 'lung',
    organism: 'mouse',
    platform: 'rnaseq_log2',
    datasetId: 'GSE54650',
    nGenes: 14,
    lambdaMean: 0.65,
    lambdaStd: 0.19,
    lambdaRange: [0.28, 0.88],
    clockGeneLambdas: {
      Per1: 0.45, Per2: 0.62, Per3: 0.58, Arntl: 0.88, Clock: 0.72,
      Cry1: 0.76, Cry2: 0.71, Nr1d1: 0.82, Nr1d2: 0.75, Rora: 0.28,
      Rorc: 0.68, Dbp: 0.73, Tef: 0.59, Hlf: 0.41
    },
    createdAt: new Date('2026-01-11')
  },
  
  // TIER-2: Additional Tissues
  {
    tissue: 'muscle',
    organism: 'mouse',
    platform: 'rnaseq_log2',
    datasetId: 'GSE54650',
    nGenes: 14,
    lambdaMean: 0.71,
    lambdaStd: 0.16,
    lambdaRange: [0.39, 0.93],
    clockGeneLambdas: {
      Per1: 0.55, Per2: 0.73, Per3: 0.69, Arntl: 0.93, Clock: 0.77,
      Cry1: 0.83, Cry2: 0.78, Nr1d1: 0.87, Nr1d2: 0.81, Rora: 0.39,
      Rorc: 0.72, Dbp: 0.79, Tef: 0.66, Hlf: 0.52
    },
    createdAt: new Date('2026-01-11')
  },
  {
    tissue: 'adrenal',
    organism: 'mouse',
    platform: 'rnaseq_log2',
    datasetId: 'GSE54650',
    nGenes: 14,
    lambdaMean: 0.74,
    lambdaStd: 0.13,
    lambdaRange: [0.51, 0.94],
    clockGeneLambdas: {
      Per1: 0.61, Per2: 0.78, Per3: 0.75, Arntl: 0.94, Clock: 0.79,
      Cry1: 0.84, Cry2: 0.80, Nr1d1: 0.89, Nr1d2: 0.83, Rora: 0.51,
      Rorc: 0.76, Dbp: 0.82, Tef: 0.71, Hlf: 0.58
    },
    createdAt: new Date('2026-01-11')
  },
  
  // HUMAN REFERENCE
  {
    tissue: 'blood',
    organism: 'human',
    platform: 'microarray_log2',
    datasetId: 'GSE48113',
    nGenes: 32,
    lambdaMean: 0.30,
    lambdaStd: 0.15,
    lambdaRange: [0.10, 0.65],
    clockGeneLambdas: {
      CLOCK: 0.25, ARNTL: 0.28, CRY1: 0.32, CRY2: 0.27,
      PER1: 0.35, PER2: 0.31, PER3: 0.29, NR1D1: 0.22
    },
    createdAt: new Date('2026-01-10')
  }
];

/**
 * Get reference atlas summary for a specific tier
 */
export function getReferenceAtlas(tier?: 'tier1' | 'tier2' | 'all'): {
  tier1: DistributionFingerprint[];
  tier2: DistributionFingerprint[];
  summary: {
    totalTissues: number;
    organisms: string[];
    meanLambdaRange: [number, number];
    tissueRanking: { tissue: string; lambdaMean: number }[];
  };
} {
  const tier1Tissues = ['liver', 'kidney', 'heart'];
  const tier2Tissues = ['lung', 'muscle', 'adrenal'];
  
  const tier1 = REFERENCE_FINGERPRINTS.filter(fp => 
    tier1Tissues.includes(fp.tissue.toLowerCase()) && fp.organism === 'mouse'
  );
  const tier2 = REFERENCE_FINGERPRINTS.filter(fp => 
    tier2Tissues.includes(fp.tissue.toLowerCase()) && fp.organism === 'mouse'
  );
  
  const allMouse = [...tier1, ...tier2];
  const tissueRanking = allMouse
    .reduce((acc, fp) => {
      const existing = acc.find(t => t.tissue === fp.tissue);
      if (!existing) acc.push({ tissue: fp.tissue, lambdaMean: fp.lambdaMean });
      return acc;
    }, [] as { tissue: string; lambdaMean: number }[])
    .sort((a, b) => b.lambdaMean - a.lambdaMean);
  
  return {
    tier1,
    tier2,
    summary: {
      totalTissues: tissueRanking.length,
      organisms: Array.from(new Set(REFERENCE_FINGERPRINTS.map(fp => fp.organism))),
      meanLambdaRange: [
        Math.min(...allMouse.map(fp => fp.lambdaMean)),
        Math.max(...allMouse.map(fp => fp.lambdaMean))
      ],
      tissueRanking
    }
  };
}

/**
 * Match a dataset fingerprint to the reference atlas
 */
export function matchDatasetFingerprint(
  lambdaValues: Record<string, number>,
  datasetName: string
): {
  bestMatch: { tissue: string; similarity: number; interpretation: string } | null;
  allMatches: { tissue: string; similarity: number; ksStatistic: number; meanDiff: number }[];
  qualityFlags: string[];
  recommendation: string;
} {
  const inputLambdas = Object.values(lambdaValues).filter(v => !isNaN(v));
  if (inputLambdas.length < 3) {
    return {
      bestMatch: null,
      allMatches: [],
      qualityFlags: ['INSUFFICIENT_DATA: Need at least 3 λ values'],
      recommendation: 'Add more clock genes to improve fingerprint matching'
    };
  }
  
  const inputMean = inputLambdas.reduce((a, b) => a + b, 0) / inputLambdas.length;
  const inputStd = Math.sqrt(inputLambdas.reduce((a, b) => a + (b - inputMean) ** 2, 0) / inputLambdas.length);
  
  const qualityFlags: string[] = [];
  
  // Check for anomalous distributions
  if (inputMean < 0.2) {
    qualityFlags.push('LOW_PERSISTENCE: Mean λ < 0.2 suggests very fast dynamics (check data quality)');
  }
  if (inputMean > 0.9) {
    qualityFlags.push('HIGH_PERSISTENCE: Mean λ > 0.9 suggests near-unit-root dynamics (potential explosive)');
  }
  if (inputStd > 0.3) {
    qualityFlags.push('HIGH_VARIANCE: λ distribution spread > 0.3 is unusual');
  }
  
  // Compare to all mouse tissue references
  const mouseFps = REFERENCE_FINGERPRINTS.filter(fp => fp.organism === 'mouse');
  const matches = mouseFps.map(fp => {
    const refLambdas = Object.values(fp.clockGeneLambdas);
    const ks = ksStatistic(inputLambdas, refLambdas);
    const meanDiff = Math.abs(inputMean - fp.lambdaMean);
    const similarity = Math.max(0, 1 - ks);
    
    return { tissue: fp.tissue, similarity, ksStatistic: ks, meanDiff };
  });
  
  // Deduplicate by tissue (take best match per tissue)
  const uniqueMatches = matches.reduce((acc, m) => {
    const existing = acc.find(t => t.tissue === m.tissue);
    if (!existing || m.similarity > existing.similarity) {
      const idx = acc.findIndex(t => t.tissue === m.tissue);
      if (idx >= 0) acc[idx] = m;
      else acc.push(m);
    }
    return acc;
  }, [] as typeof matches);
  
  uniqueMatches.sort((a, b) => b.similarity - a.similarity);
  
  const best = uniqueMatches[0];
  let interpretation = '';
  let recommendation = '';
  
  if (best) {
    if (best.similarity > 0.8) {
      interpretation = `Strong match to ${best.tissue} reference profile`;
      recommendation = `Dataset "${datasetName}" shows ${best.tissue}-like circadian dynamics. Cross-study comparisons valid.`;
    } else if (best.similarity > 0.6) {
      interpretation = `Moderate match to ${best.tissue} reference profile`;
      recommendation = `Dataset shows some ${best.tissue}-like features. Interpret cross-tissue comparisons with caution.`;
    } else if (best.similarity > 0.4) {
      interpretation = `Weak match to ${best.tissue} - may represent novel tissue/condition`;
      recommendation = `λ distribution differs from reference atlas. Consider as novel tissue-specific profile.`;
    } else {
      interpretation = `No strong match found - potentially novel or pathological`;
      recommendation = `Dataset shows unusual λ distribution. Verify data quality or consider pathological state.`;
    }
  }
  
  return {
    bestMatch: best ? { tissue: best.tissue, similarity: best.similarity, interpretation } : null,
    allMatches: uniqueMatches,
    qualityFlags,
    recommendation
  };
}

/**
 * Compare a new dataset's λ distribution against reference fingerprints
 */
export function compareToRegistry(
  lambdaValues: Record<string, number>,
  tissue?: string
): {
  closestMatch: DistributionFingerprint | null;
  similarity: number;
  allComparisons: { fingerprint: DistributionFingerprint; ksStatistic: number; meanDiff: number }[];
} {
  const inputLambdas = Object.values(lambdaValues).filter(v => !isNaN(v));
  const inputMean = inputLambdas.reduce((a, b) => a + b, 0) / inputLambdas.length;
  
  const comparisons = REFERENCE_FINGERPRINTS
    .filter(fp => !tissue || fp.tissue.toLowerCase() === tissue.toLowerCase())
    .map(fp => {
      // KS statistic approximation
      const refLambdas = Object.values(fp.clockGeneLambdas);
      const ks = ksStatistic(inputLambdas, refLambdas);
      const meanDiff = Math.abs(inputMean - fp.lambdaMean);
      
      return { fingerprint: fp, ksStatistic: ks, meanDiff };
    });
  
  // Sort by KS statistic (lower = more similar)
  comparisons.sort((a, b) => a.ksStatistic - b.ksStatistic);
  
  const closest = comparisons[0];
  const similarity = closest ? 1 - closest.ksStatistic : 0;
  
  return {
    closestMatch: closest?.fingerprint || null,
    similarity,
    allComparisons: comparisons
  };
}

/**
 * Add a new fingerprint to the registry
 */
export function createFingerprint(
  tissue: string,
  organism: string,
  platform: string,
  datasetId: string,
  lambdaValues: Record<string, number>
): DistributionFingerprint {
  const lambdas = Object.values(lambdaValues).filter(v => !isNaN(v));
  const mean = lambdas.reduce((a, b) => a + b, 0) / lambdas.length;
  const std = Math.sqrt(lambdas.reduce((a, b) => a + (b - mean) ** 2, 0) / lambdas.length);
  
  return {
    tissue,
    organism,
    platform,
    datasetId,
    nGenes: lambdas.length,
    lambdaMean: mean,
    lambdaStd: std,
    lambdaRange: [Math.min(...lambdas), Math.max(...lambdas)],
    clockGeneLambdas: lambdaValues,
    createdAt: new Date()
  };
}

/**
 * Get all reference fingerprints
 */
export function getReferenceFingerprints(): DistributionFingerprint[] {
  return [...REFERENCE_FINGERPRINTS];
}

// Helper: KS statistic
function ksStatistic(a: number[], b: number[]): number {
  const combined = [...a.map(v => ({ v, set: 'a' })), ...b.map(v => ({ v, set: 'b' }))];
  combined.sort((x, y) => x.v - y.v);
  
  let countA = 0, countB = 0, maxDiff = 0;
  for (const item of combined) {
    if (item.set === 'a') countA++;
    else countB++;
    const diff = Math.abs(countA / a.length - countB / b.length);
    if (diff > maxDiff) maxDiff = diff;
  }
  return maxDiff;
}
