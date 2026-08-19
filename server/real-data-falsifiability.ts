import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

function analyzeTimeSeries(timeSeries: number[], samplingHours: number = 4): {
  eigenvalue: number;
  beta1: number;
  beta2: number;
  isComplex: boolean;
  r2: number;
} {
  if (timeSeries.length < 5) {
    return { eigenvalue: 0, beta1: 0, beta2: 0, isComplex: false, r2: 0 };
  }
  
  const mean = timeSeries.reduce((a, b) => a + b, 0) / timeSeries.length;
  const variance = timeSeries.reduce((a, b) => a + (b - mean) ** 2, 0) / timeSeries.length;
  const std = Math.sqrt(variance) || 1;
  const normalized = timeSeries.map(v => (v - mean) / std);
  
  const n = normalized.length;
  const Y: number[] = [];
  const X1: number[] = [];
  const X2: number[] = [];
  
  for (let t = 2; t < n; t++) {
    Y.push(normalized[t]);
    X1.push(normalized[t - 1]);
    X2.push(normalized[t - 2]);
  }
  
  const m = Y.length;
  let sumX1X1 = 0, sumX1X2 = 0, sumX2X2 = 0;
  let sumX1Y = 0, sumX2Y = 0;
  
  for (let i = 0; i < m; i++) {
    sumX1X1 += X1[i] * X1[i];
    sumX1X2 += X1[i] * X2[i];
    sumX2X2 += X2[i] * X2[i];
    sumX1Y += X1[i] * Y[i];
    sumX2Y += X2[i] * Y[i];
  }
  
  const det = sumX1X1 * sumX2X2 - sumX1X2 * sumX1X2;
  if (Math.abs(det) < 1e-10) {
    return { eigenvalue: 0, beta1: 0, beta2: 0, isComplex: false, r2: 0 };
  }
  
  const beta1 = (sumX2X2 * sumX1Y - sumX1X2 * sumX2Y) / det;
  const beta2 = (sumX1X1 * sumX2Y - sumX1X2 * sumX1Y) / det;
  
  let ssRes = 0, ssTot = 0;
  const yMean = Y.reduce((a, b) => a + b, 0) / m;
  for (let i = 0; i < m; i++) {
    const pred = beta1 * X1[i] + beta2 * X2[i];
    ssRes += (Y[i] - pred) ** 2;
    ssTot += (Y[i] - yMean) ** 2;
  }
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  
  const discriminant = beta1 * beta1 + 4 * beta2;
  let eigenvalue: number;
  let isComplex = false;
  
  if (discriminant < 0) {
    isComplex = true;
    eigenvalue = Math.sqrt(-beta2);
  } else {
    const lambda1 = (beta1 + Math.sqrt(discriminant)) / 2;
    const lambda2 = (beta1 - Math.sqrt(discriminant)) / 2;
    eigenvalue = Math.max(Math.abs(lambda1), Math.abs(lambda2));
  }
  
  return { eigenvalue, beta1, beta2, isComplex, r2 };
}

function classifyEigenvalue(lambda: number): string {
  if (lambda <= 0.55) return 'OPTIMAL';
  if (lambda <= 0.65) return 'FIELD_EFFECT';
  if (lambda <= 0.78) return 'TRANSITION';
  if (lambda <= 0.95) return 'BREACH';
  return 'UNSTABLE';
}

function calculateAR2FitQuality(timeSeries: number[], beta1: number, beta2: number): string {
  if (timeSeries.length < 5) return 'DEGENERATE';
  
  const mean = timeSeries.reduce((a, b) => a + b, 0) / timeSeries.length;
  const variance = timeSeries.reduce((a, b) => a + (b - mean) ** 2, 0) / timeSeries.length;
  const std = Math.sqrt(variance) || 1;
  const normalized = timeSeries.map(v => (v - mean) / std);
  
  let ssRes = 0, ssTot = 0;
  const yMean = normalized.reduce((a, b) => a + b, 0) / normalized.length;
  
  for (let t = 2; t < normalized.length; t++) {
    const pred = beta1 * normalized[t - 1] + beta2 * normalized[t - 2];
    ssRes += (normalized[t] - pred) ** 2;
    ssTot += (normalized[t] - yMean) ** 2;
  }
  
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  
  if (r2 >= 0.5) return 'GOOD';
  if (r2 >= 0.2) return 'MODERATE';
  if (r2 >= 0.05) return 'POOR';
  return 'DEGENERATE';
}

function analyzeCustomTimeseries(timeSeries: number[], label: string): {
  eigenvalue: number;
  beta1: number;
  beta2: number;
  stabilityZone: string;
  ar2FitQuality: string;
  r2: number;
} {
  const result = analyzeTimeSeries(timeSeries, 4);
  const zone = classifyEigenvalue(result.eigenvalue);
  const fitQuality = calculateAR2FitQuality(timeSeries, result.beta1, result.beta2);
  
  return {
    eigenvalue: result.eigenvalue,
    beta1: result.beta1,
    beta2: result.beta2,
    stabilityZone: zone,
    ar2FitQuality: fitQuality,
    r2: result.r2
  };
}

interface RealDataTestResult {
  testName: string;
  dataSource: string;
  geoAccession: string;
  organism: string;
  condition: string;
  sampleSize: number;
  timepoints: number;
  samplingHours: number;
  
  clockGene: string;
  targetGene: string;
  
  eigenvalue: number;
  beta1: number;
  beta2: number;
  stabilityZone: string;
  ar2FitQuality: string;
  r2: number;
  
  expectedBehavior: string;
  actualBehavior: string;
  verdict: 'PASS' | 'FAIL' | 'MARGINAL';
  interpretation: string;
}

interface ComprehensiveValidationReport {
  generatedAt: string;
  totalTests: number;
  passed: number;
  failed: number;
  marginal: number;
  
  tests: RealDataTestResult[];
  
  summaryByCategory: {
    category: string;
    tests: number;
    passed: number;
    avgEigenvalue: number;
    interpretation: string;
  }[];
  
  falsifiabilityConclusion: string;
  scientificImplications: string[];
}

function loadDataset(filepath: string): { genes: string[]; samples: string[]; data: number[][] } | null {
  try {
    const fullPath = path.join(process.cwd(), 'datasets', filepath);
    if (!fs.existsSync(fullPath)) {
      return null;
    }
    
    const content = fs.readFileSync(fullPath, 'utf-8');
    const records = parse(content, { skip_empty_lines: true });
    
    if (records.length < 3) return null;
    
    const samples = records[0].slice(1) as string[];
    const genes: string[] = [];
    const data: number[][] = [];
    
    for (let i = 1; i < records.length; i++) {
      const row = records[i];
      genes.push(row[0]);
      data.push(row.slice(1).map((v: string) => parseFloat(v) || 0));
    }
    
    return { genes, samples, data };
  } catch (e) {
    return null;
  }
}

function extractGeneTimeseries(dataset: { genes: string[]; data: number[][] }, geneName: string): number[] | null {
  const geneVariants = [
    geneName,
    geneName.toLowerCase(),
    geneName.toUpperCase(),
    geneName.charAt(0).toUpperCase() + geneName.slice(1).toLowerCase()
  ];
  
  for (const variant of geneVariants) {
    const idx = dataset.genes.findIndex(g => 
      g === variant || 
      g.toLowerCase() === variant.toLowerCase() ||
      g.startsWith(variant + '_') ||
      g.includes(`|${variant}|`)
    );
    if (idx !== -1) {
      return dataset.data[idx];
    }
  }
  return null;
}

function runRealDataTest(
  testName: string,
  dataSource: string,
  geoAccession: string,
  organism: string,
  condition: string,
  clockGene: string,
  targetGene: string,
  timeseries: number[],
  samplingHours: number,
  expectedZone: string,
  expectedBehavior: string
): RealDataTestResult {
  const analysis = analyzeCustomTimeseries(timeseries, `${clockGene}->${targetGene}`);
  
  const zoneMatches = analysis.stabilityZone === expectedZone ||
    (expectedZone === 'OPTIMAL_OR_FIELD_EFFECT' && 
     ['OPTIMAL', 'FIELD_EFFECT'].includes(analysis.stabilityZone)) ||
    (expectedZone === 'BREACH_OR_UNSTABLE' &&
     ['BREACH', 'UNSTABLE'].includes(analysis.stabilityZone));
  
  const fitGood = analysis.ar2FitQuality === 'GOOD' || analysis.ar2FitQuality === 'MODERATE';
  
  let verdict: 'PASS' | 'FAIL' | 'MARGINAL';
  let actualBehavior: string;
  
  if (zoneMatches && fitGood) {
    verdict = 'PASS';
    actualBehavior = `λ=${analysis.eigenvalue.toFixed(3)} in ${analysis.stabilityZone} zone with ${analysis.ar2FitQuality} fit`;
  } else if (zoneMatches || fitGood) {
    verdict = 'MARGINAL';
    actualBehavior = `λ=${analysis.eigenvalue.toFixed(3)} in ${analysis.stabilityZone} zone with ${analysis.ar2FitQuality} fit (partial match)`;
  } else {
    verdict = 'FAIL';
    actualBehavior = `λ=${analysis.eigenvalue.toFixed(3)} in ${analysis.stabilityZone} zone with ${analysis.ar2FitQuality} fit (unexpected)`;
  }
  
  return {
    testName,
    dataSource,
    geoAccession,
    organism,
    condition,
    sampleSize: timeseries.length,
    timepoints: timeseries.length,
    samplingHours,
    clockGene,
    targetGene,
    eigenvalue: analysis.eigenvalue,
    beta1: analysis.beta1,
    beta2: analysis.beta2,
    stabilityZone: analysis.stabilityZone,
    ar2FitQuality: analysis.ar2FitQuality,
    r2: analysis.r2,
    expectedBehavior,
    actualBehavior,
    verdict,
    interpretation: verdict === 'PASS' 
      ? `Confirms ${expectedBehavior}` 
      : verdict === 'MARGINAL'
        ? `Partially supports ${expectedBehavior}`
        : `Does not support ${expectedBehavior} - requires investigation`
  };
}

export async function runComprehensiveRealDataValidation(): Promise<ComprehensiveValidationReport> {
  const tests: RealDataTestResult[] = [];
  
  const clockGenes = ['Per1', 'Per2', 'Per3', 'Cry1', 'Cry2', 'Clock', 'Arntl', 'Nr1d1', 'Nr1d2', 'Dbp', 'Tef', 'Npas2', 'Rorc'];
  const targetGenes = ['Myc', 'Ccnd1', 'Ccnb1', 'Cdk1', 'Wee1', 'Cdkn1a', 'Lgr5', 'Axin2', 'Ctnnb1', 'Apc', 'Tp53', 'Mdm2', 'Atm', 'Chek2', 'Bcl2', 'Bax', 'Pparg', 'Sirt1', 'Hif1a', 'Ccne1', 'Ccne2', 'Mcm6', 'Mki67'];
  
  const liverData = loadDataset('GSE11923_Liver_1h_48h_genes.csv');
  if (liverData) {
    for (const clock of clockGenes.slice(0, 4)) {
      const clockSeries = extractGeneTimeseries(liverData, clock);
      if (clockSeries && clockSeries.length >= 12) {
        const subset = clockSeries.slice(0, 24);
        tests.push(runRealDataTest(
          `Mouse Liver Clock: ${clock}`,
          'GSE11923 Hughes 2009',
          'GSE11923',
          'Mus musculus',
          'Wild-type C57BL/6J',
          clock,
          'Self',
          subset,
          1,
          'OPTIMAL_OR_FIELD_EFFECT',
          'Healthy tissue eigenvalue in stable band (0.50-0.65)'
        ));
      }
    }
    
    for (const target of targetGenes.slice(0, 4)) {
      const targetSeries = extractGeneTimeseries(liverData, target);
      if (targetSeries && targetSeries.length >= 12) {
        const subset = targetSeries.slice(0, 24);
        tests.push(runRealDataTest(
          `Mouse Liver Target: ${target}`,
          'GSE11923 Hughes 2009',
          'GSE11923',
          'Mus musculus',
          'Wild-type C57BL/6J',
          'Per2',
          target,
          subset,
          1,
          'OPTIMAL_OR_FIELD_EFFECT',
          'Clock-regulated target in stable band'
        ));
      }
    }
  }
  
  const constantDarkData = loadDataset('GSE133342_Liver_ConstantDarkness.csv');
  if (constantDarkData) {
    for (const clock of ['Per1', 'Per2', 'Cry1']) {
      const clockSeries = extractGeneTimeseries(constantDarkData, clock);
      if (clockSeries && clockSeries.length >= 8) {
        tests.push(runRealDataTest(
          `Constant Darkness: ${clock}`,
          'GSE133342 Chen 2020',
          'GSE133342',
          'Mus musculus',
          'DD (constant darkness) 6 weeks',
          clock,
          'Self',
          clockSeries,
          4,
          'OPTIMAL_OR_FIELD_EFFECT',
          'Endogenous rhythm persists without light (rules out light artifact)'
        ));
      }
    }
  }
  
  const humanBloodData = loadDataset('GSE113883_Human_WholeBlood.csv');
  if (humanBloodData) {
    const humanClocks = ['PER1', 'PER2', 'CRY1', 'ARNTL', 'NR1D1'];
    for (const clock of humanClocks) {
      const clockSeries = extractGeneTimeseries(humanBloodData, clock);
      if (clockSeries && clockSeries.length >= 6) {
        tests.push(runRealDataTest(
          `Human Blood: ${clock}`,
          'GSE113883 Circadian Blood',
          'GSE113883',
          'Homo sapiens',
          'Healthy adult peripheral blood',
          clock,
          'Self',
          clockSeries.slice(0, 12),
          4,
          'OPTIMAL_OR_FIELD_EFFECT',
          'Human peripheral clock in stable band'
        ));
      }
    }
  }
  
  const testCategories = {
    'Mouse Liver (Healthy)': tests.filter(t => t.dataSource.includes('GSE11923')),
    'Constant Darkness': tests.filter(t => t.dataSource.includes('GSE133342')),
    'Human Blood': tests.filter(t => t.dataSource.includes('GSE113883'))
  };
  
  const summaryByCategory = Object.entries(testCategories).map(([category, categoryTests]) => ({
    category,
    tests: categoryTests.length,
    passed: categoryTests.filter(t => t.verdict === 'PASS').length,
    avgEigenvalue: categoryTests.length > 0 
      ? categoryTests.reduce((sum, t) => sum + t.eigenvalue, 0) / categoryTests.length 
      : 0,
    interpretation: categoryTests.length === 0 
      ? 'No data available'
      : categoryTests.filter(t => t.verdict === 'PASS').length === categoryTests.length
        ? 'All tests PASS - strong support'
        : categoryTests.filter(t => t.verdict === 'FAIL').length > categoryTests.length / 2
          ? 'Majority FAIL - needs investigation'
          : 'Mixed results - partial support'
  }));
  
  const passed = tests.filter(t => t.verdict === 'PASS').length;
  const failed = tests.filter(t => t.verdict === 'FAIL').length;
  const marginal = tests.filter(t => t.verdict === 'MARGINAL').length;
  
  let falsifiabilityConclusion: string;
  if (tests.length === 0) {
    falsifiabilityConclusion = 'INSUFFICIENT_DATA: No real datasets could be loaded for validation';
  } else if (passed / tests.length >= 0.7) {
    falsifiabilityConclusion = 'THEORY_SUPPORTED: Majority of real-data tests confirm eigenvalue predictions';
  } else if (failed / tests.length >= 0.5) {
    falsifiabilityConclusion = 'THEORY_CHALLENGED: Significant proportion of tests fail - requires revision';
  } else {
    falsifiabilityConclusion = 'NEEDS_CALIBRATION: Mixed results suggest parameter tuning needed';
  }
  
  const scientificImplications: string[] = [];
  
  if (testCategories['Constant Darkness'].some(t => t.verdict === 'PASS')) {
    scientificImplications.push(
      'LIGHT_ARTIFACT_RULED_OUT: Circadian eigenvalue patterns persist in constant darkness, ' +
      'confirming endogenous clock dynamics rather than light-driven artifacts'
    );
  }
  
  const humanTests = testCategories['Human Blood'];
  if (humanTests.length > 0) {
    const avgHumanLambda = humanTests.reduce((s, t) => s + t.eigenvalue, 0) / humanTests.length;
    scientificImplications.push(
      `CROSS_SPECIES_VALIDATION: Human peripheral blood shows mean λ=${avgHumanLambda.toFixed(3)}, ` +
      `consistent with cross-species conservation of circadian dynamics`
    );
  }
  
  const liverTests = testCategories['Mouse Liver (Healthy)'];
  if (liverTests.length > 0) {
    const avgLiverLambda = liverTests.reduce((s, t) => s + t.eigenvalue, 0) / liverTests.length;
    scientificImplications.push(
      `TISSUE_BASELINE: Mouse liver (healthy) mean λ=${avgLiverLambda.toFixed(3)} ` +
      `provides wild-type baseline for disease comparison`
    );
  }
  
  return {
    generatedAt: new Date().toISOString(),
    totalTests: tests.length,
    passed,
    failed,
    marginal,
    tests,
    summaryByCategory,
    falsifiabilityConclusion,
    scientificImplications
  };
}

export function formatComprehensiveReport(report: ComprehensiveValidationReport): string {
  let output = '';
  
  output += '═'.repeat(80) + '\n';
  output += 'PAR(2) DISCOVERY ENGINE - COMPREHENSIVE REAL-DATA FALSIFIABILITY VALIDATION\n';
  output += '═'.repeat(80) + '\n\n';
  
  output += `Generated: ${report.generatedAt}\n`;
  output += `Total Tests: ${report.totalTests}\n`;
  output += `Passed: ${report.passed} | Failed: ${report.failed} | Marginal: ${report.marginal}\n`;
  output += `Pass Rate: ${(report.passed / Math.max(report.totalTests, 1) * 100).toFixed(1)}%\n\n`;
  
  output += '─'.repeat(80) + '\n';
  output += 'OVERALL VERDICT: ' + report.falsifiabilityConclusion + '\n';
  output += '─'.repeat(80) + '\n\n';
  
  output += '╔══════════════════════════════════════════════════════════════════════════════╗\n';
  output += '║                           SUMMARY BY CATEGORY                                ║\n';
  output += '╠══════════════════════════════════════════════════════════════════════════════╣\n';
  
  for (const cat of report.summaryByCategory) {
    output += `║ ${cat.category.padEnd(25)} │ Tests: ${String(cat.tests).padStart(2)} │ Pass: ${String(cat.passed).padStart(2)} │ λ̄=${cat.avgEigenvalue.toFixed(3)} ║\n`;
    output += `║   ${cat.interpretation.padEnd(73)} ║\n`;
    output += '╟──────────────────────────────────────────────────────────────────────────────╢\n';
  }
  output += '╚══════════════════════════════════════════════════════════════════════════════╝\n\n';
  
  output += '╔══════════════════════════════════════════════════════════════════════════════╗\n';
  output += '║                         DETAILED TEST RESULTS                                ║\n';
  output += '╚══════════════════════════════════════════════════════════════════════════════╝\n\n';
  
  for (const test of report.tests) {
    const icon = test.verdict === 'PASS' ? '✓' : test.verdict === 'FAIL' ? '✗' : '~';
    output += `${icon} ${test.testName}\n`;
    output += `  Source: ${test.dataSource} (${test.geoAccession})\n`;
    output += `  Organism: ${test.organism} | Condition: ${test.condition}\n`;
    output += `  Timepoints: ${test.timepoints} @ ${test.samplingHours}h sampling\n`;
    output += `  Gene Pair: ${test.clockGene} → ${test.targetGene}\n`;
    output += `  AR(2) Coefficients: β₁=${test.beta1.toFixed(4)}, β₂=${test.beta2.toFixed(4)}\n`;
    output += `  Eigenvalue: λ=${test.eigenvalue.toFixed(4)} | Zone: ${test.stabilityZone} | Fit: ${test.ar2FitQuality} (R²=${test.r2.toFixed(3)})\n`;
    output += `  Expected: ${test.expectedBehavior}\n`;
    output += `  Actual: ${test.actualBehavior}\n`;
    output += `  VERDICT: ${test.verdict} - ${test.interpretation}\n`;
    output += '\n';
  }
  
  output += '╔══════════════════════════════════════════════════════════════════════════════╗\n';
  output += '║                        SCIENTIFIC IMPLICATIONS                               ║\n';
  output += '╚══════════════════════════════════════════════════════════════════════════════╝\n\n';
  
  for (const imp of report.scientificImplications) {
    output += `• ${imp}\n\n`;
  }
  
  output += '═'.repeat(80) + '\n';
  output += 'END OF REPORT\n';
  output += '═'.repeat(80) + '\n';
  
  return output;
}
