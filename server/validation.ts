export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface DataQualityMetrics {
  totalDataPoints: number;
  validDataPoints: number;
  nullCount: number;
  nanCount: number;
  infiniteCount: number;
  negativeCount: number;
  zeroCount: number;
  duplicateTimepoints: number;
  unsortedTimepoints: boolean;
  dataQualityScore: number;
}

export function validateGeneData(
  time: number[],
  expression: number[],
  geneName: string = 'unknown'
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!time || !Array.isArray(time)) {
    errors.push(`[${geneName}] Time array is missing or not an array`);
    return { valid: false, errors, warnings };
  }

  if (!expression || !Array.isArray(expression)) {
    errors.push(`[${geneName}] Expression array is missing or not an array`);
    return { valid: false, errors, warnings };
  }

  if (time.length === 0) {
    errors.push(`[${geneName}] Time array is empty`);
    return { valid: false, errors, warnings };
  }

  if (expression.length === 0) {
    errors.push(`[${geneName}] Expression array is empty`);
    return { valid: false, errors, warnings };
  }

  if (time.length !== expression.length) {
    errors.push(`[${geneName}] Time array (${time.length}) and expression array (${expression.length}) have different lengths`);
    return { valid: false, errors, warnings };
  }

  const minDataPoints = 6;
  if (time.length < minDataPoints) {
    errors.push(`[${geneName}] Insufficient data points (${time.length}). Minimum required: ${minDataPoints}`);
  }

  const nullTimeCount = time.filter(t => t === null || t === undefined).length;
  const nullExprCount = expression.filter(e => e === null || e === undefined).length;
  
  if (nullTimeCount > 0) {
    errors.push(`[${geneName}] Time array contains ${nullTimeCount} null/undefined values`);
  }
  
  if (nullExprCount > 0) {
    errors.push(`[${geneName}] Expression array contains ${nullExprCount} null/undefined values`);
  }

  const nanTimeCount = time.filter(t => typeof t === 'number' && isNaN(t)).length;
  const nanExprCount = expression.filter(e => typeof e === 'number' && isNaN(e)).length;
  
  if (nanTimeCount > 0) {
    errors.push(`[${geneName}] Time array contains ${nanTimeCount} NaN values`);
  }
  
  if (nanExprCount > 0) {
    errors.push(`[${geneName}] Expression array contains ${nanExprCount} NaN values`);
  }

  const infTimeCount = time.filter(t => typeof t === 'number' && !isFinite(t) && !isNaN(t)).length;
  const infExprCount = expression.filter(e => typeof e === 'number' && !isFinite(e) && !isNaN(e)).length;
  
  if (infTimeCount > 0) {
    errors.push(`[${geneName}] Time array contains ${infTimeCount} infinite values`);
  }
  
  if (infExprCount > 0) {
    errors.push(`[${geneName}] Expression array contains ${infExprCount} infinite values`);
  }

  const sortedTime = [...time].sort((a, b) => a - b);
  const isUnsorted = time.some((t, i) => t !== sortedTime[i]);
  if (isUnsorted) {
    warnings.push(`[${geneName}] Time array is not sorted in ascending order`);
  }

  const uniqueTimepoints = new Set(time);
  if (uniqueTimepoints.size < time.length) {
    const duplicateCount = time.length - uniqueTimepoints.size;
    warnings.push(`[${geneName}] Time array contains ${duplicateCount} duplicate timepoints`);
  }

  const negativeExprCount = expression.filter(e => typeof e === 'number' && e < 0).length;
  if (negativeExprCount > 0) {
    warnings.push(`[${geneName}] Expression array contains ${negativeExprCount} negative values (unusual for gene expression)`);
  }

  const zeroExprCount = expression.filter(e => e === 0).length;
  const zeroPercentage = (zeroExprCount / expression.length) * 100;
  if (zeroPercentage > 50) {
    warnings.push(`[${geneName}] Expression array has ${zeroPercentage.toFixed(1)}% zero values (may indicate low expression or measurement issues)`);
  }

  const validExpressions = expression.filter(e => typeof e === 'number' && isFinite(e));
  if (validExpressions.length > 0) {
    const variance = calculateVariance(validExpressions);
    if (variance === 0) {
      warnings.push(`[${geneName}] Expression has zero variance (constant value) - cannot detect rhythmicity`);
    } else if (variance < 0.001) {
      warnings.push(`[${geneName}] Expression has very low variance (${variance.toExponential(2)}) - may not be rhythmic`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

export function validateGenePairData(
  targetTime: number[],
  targetExpression: number[],
  clockTime: number[],
  clockExpression: number[],
  targetName: string,
  clockName: string
): ValidationResult {
  const targetValidation = validateGeneData(targetTime, targetExpression, targetName);
  const clockValidation = validateGeneData(clockTime, clockExpression, clockName);
  
  const errors = [...targetValidation.errors, ...clockValidation.errors];
  const warnings = [...targetValidation.warnings, ...clockValidation.warnings];
  
  if (targetTime.length !== clockTime.length) {
    errors.push(`Time arrays have different lengths: ${targetName} (${targetTime.length}) vs ${clockName} (${clockTime.length})`);
  } else {
    const timeMismatch = targetTime.some((t, i) => t !== clockTime[i]);
    if (timeMismatch) {
      warnings.push(`Time arrays have mismatched values between ${targetName} and ${clockName}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

export function calculateDataQualityMetrics(
  time: number[],
  expression: number[]
): DataQualityMetrics {
  const totalDataPoints = expression.length;
  
  let nullCount = 0;
  let nanCount = 0;
  let infiniteCount = 0;
  let negativeCount = 0;
  let zeroCount = 0;
  let validDataPoints = 0;
  
  for (const val of expression) {
    if (val === null || val === undefined) {
      nullCount++;
    } else if (typeof val === 'number' && isNaN(val)) {
      nanCount++;
    } else if (typeof val === 'number' && !isFinite(val)) {
      infiniteCount++;
    } else {
      validDataPoints++;
      if (val < 0) negativeCount++;
      if (val === 0) zeroCount++;
    }
  }
  
  const uniqueTimepoints = new Set(time);
  const duplicateTimepoints = time.length - uniqueTimepoints.size;
  
  const sortedTime = [...time].sort((a, b) => a - b);
  const unsortedTimepoints = time.some((t, i) => t !== sortedTime[i]);
  
  let dataQualityScore = 100;
  
  if (nullCount > 0) dataQualityScore -= (nullCount / totalDataPoints) * 30;
  if (nanCount > 0) dataQualityScore -= (nanCount / totalDataPoints) * 30;
  if (infiniteCount > 0) dataQualityScore -= (infiniteCount / totalDataPoints) * 20;
  if (duplicateTimepoints > 0) dataQualityScore -= (duplicateTimepoints / totalDataPoints) * 10;
  if (unsortedTimepoints) dataQualityScore -= 5;
  if (validDataPoints < 12) dataQualityScore -= (12 - validDataPoints) * 3;
  
  dataQualityScore = Math.max(0, Math.min(100, dataQualityScore));
  
  return {
    totalDataPoints,
    validDataPoints,
    nullCount,
    nanCount,
    infiniteCount,
    negativeCount,
    zeroCount,
    duplicateTimepoints,
    unsortedTimepoints,
    dataQualityScore: Math.round(dataQualityScore)
  };
}

export function cleanGeneData(
  time: number[],
  expression: number[]
): { time: number[]; expression: number[]; removedIndices: number[]; replicatesAveraged: number } {
  const cleanTime: number[] = [];
  const cleanExpression: number[] = [];
  const removedIndices: number[] = [];

  for (let i = 0; i < time.length; i++) {
    const t = time[i];
    const e = expression[i];

    if (
      t !== null && t !== undefined &&
      e !== null && e !== undefined &&
      typeof t === 'number' && isFinite(t) &&
      typeof e === 'number' && isFinite(e)
    ) {
      cleanTime.push(t);
      cleanExpression.push(e);
    } else {
      removedIndices.push(i);
    }
  }

  // Group by timepoint and average biological replicates
  const grouped = new Map<number, number[]>();
  for (let i = 0; i < cleanTime.length; i++) {
    const t = cleanTime[i];
    if (!grouped.has(t)) grouped.set(t, []);
    grouped.get(t)!.push(cleanExpression[i]);
  }

  const sortedTimepoints = Array.from(grouped.keys()).sort((a, b) => a - b);

  const avgTime: number[] = [];
  const avgExpression: number[] = [];
  let replicatesAveraged = 0;

  for (const t of sortedTimepoints) {
    const vals = grouped.get(t)!;
    avgTime.push(t);
    avgExpression.push(vals.reduce((a, b) => a + b, 0) / vals.length);
    if (vals.length > 1) replicatesAveraged += vals.length - 1;
  }

  return {
    time: avgTime,
    expression: avgExpression,
    removedIndices,
    replicatesAveraged
  };
}

function calculateVariance(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return values.reduce((sum, val) => sum + (val - mean) ** 2, 0) / (values.length - 1);
}

export function validateCSVData(
  headers: string[],
  rows: any[],
  requiredGenes: string[] = []
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!headers || headers.length === 0) {
    errors.push('CSV has no headers');
    return { valid: false, errors, warnings };
  }
  
  if (!rows || rows.length === 0) {
    errors.push('CSV has no data rows');
    return { valid: false, errors, warnings };
  }
  
  const hasTimeColumn = headers.some(h => 
    /^(time|ct|zt|t|hour|hours|timepoint)$/i.test(h.trim())
  );
  
  if (!hasTimeColumn) {
    errors.push('No time column found. Expected column named: time, CT, ZT, T, hour, hours, or timepoint');
  }
  
  const geneColumns = headers.filter(h => 
    !/^(time|ct|zt|t|hour|hours|timepoint)$/i.test(h.trim())
  );
  
  if (geneColumns.length === 0) {
    errors.push('No gene expression columns found');
  }
  
  for (const gene of requiredGenes) {
    const found = headers.some(h => h.toLowerCase() === gene.toLowerCase());
    if (!found) {
      warnings.push(`Required gene '${gene}' not found in dataset`);
    }
  }
  
  if (rows.length < 6) {
    errors.push(`Insufficient timepoints: ${rows.length}. Minimum required: 6`);
  }
  
  if (rows.length < 12) {
    warnings.push(`Low number of timepoints (${rows.length}). Recommend 12+ for robust analysis`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}
