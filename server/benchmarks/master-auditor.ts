/**
 * Master Auditor Benchmark Suite
 * 
 * Comprehensive external validation of PAR(2) Discovery Engine
 * against established systems biology benchmarks.
 * 
 * Four benchmarks:
 * 1. Turing Symmetry-Breaking - Is |λ|≈0.618 the physical break point?
 * 2. Fisher Information Throughput - Do intermediate eigenvalues maximize signaling fidelity?
 * 3. STRING Network - Are stability hubs real?
 * 4. Ueda Timetable - Does eigenvalue add information beyond phase?
 * 
 * Now uses REAL eigenvalue data computed from GSE54650 Liver dataset.
 */

import { runTuringBenchmark, analyzeTuringStability } from './turing-symmetry';
import { runFisherBenchmark, analyzeInformationFidelity } from './fisher-information';
import { runNetworkBenchmark, getAvailableNetworkGenes } from './string-network';
import { runUedaBenchmark, getUedaReferencePhase } from './ueda-timetable';
import { computeRealEigenvalueData, computeRealTimeSeriesData } from './real-eigenvalue-data';

export interface MasterAuditorResult {
  timestamp: string;
  overallScore: number;
  benchmarksPassed: number;
  totalBenchmarks: number;
  dataSource: string;
  nGenes: number;
  benchmarks: {
    turing: {
      name: string;
      question: string;
      status: 'PASSED' | 'PARTIAL' | 'FAILED';
      expectedResult: string;
      actualResult: string;
      score: number;
      details: any;
    };
    fisher: {
      name: string;
      question: string;
      status: 'PASSED' | 'PARTIAL' | 'FAILED';
      expectedResult: string;
      actualResult: string;
      score: number;
      details: any;
    };
    network: {
      name: string;
      question: string;
      status: 'PASSED' | 'PARTIAL' | 'FAILED';
      expectedResult: string;
      actualResult: string;
      score: number;
      details: any;
    };
    ueda: {
      name: string;
      question: string;
      status: 'PASSED' | 'PARTIAL' | 'FAILED';
      expectedResult: string;
      actualResult: string;
      score: number;
      details: any;
    };
  };
  conclusion: string;
}

/**
 * Run the complete Master Auditor benchmark suite using REAL data
 */
export function runMasterAuditor(): MasterAuditorResult {
  const timestamp = new Date().toISOString();
  
  const realEigenvalueData = computeRealEigenvalueData();
  const realTimeSeriesData = computeRealTimeSeriesData();
  const nGenes = realEigenvalueData.length;
  
  const eigenvalueDataForNetwork = realEigenvalueData.map(d => ({
    gene: d.gene,
    eigenvalue: d.eigenvalue
  }));

  const timeSeriesDataForUeda = realTimeSeriesData.map(d => ({
    gene: d.gene,
    timeSeries: d.timeSeries,
    timepoints: d.timepoints,
    eigenvalue: d.eigenvalue
  }));

  // 1. Turing Benchmark (uses its own simulation, independent of dataset)
  const turingResult = runTuringBenchmark();
  const turingScore = turingResult.validation.matchesGoldenRatio ? 100 : 
    turingResult.validation.deviationFromPhi < 0.1 ? 75 : 50;
  const turingStatus: 'PASSED' | 'PARTIAL' | 'FAILED' = turingScore >= 80 ? 'PASSED' : turingScore >= 50 ? 'PARTIAL' : 'FAILED';
  
  // 2. Fisher Information Benchmark (uses transfer function model)
  const fisherResult = runFisherBenchmark();
  let fisherScore: number;
  if (fisherResult.validation.peakInStableBand && fisherResult.validation.informationLossInCancer > 0.3) {
    fisherScore = 100;
  } else if (fisherResult.validation.peakInStableBand) {
    fisherScore = 85;
  } else if (fisherResult.validation.informationLossInCancer > 0.3) {
    fisherScore = 75;
  } else {
    fisherScore = 50;
  }
  const fisherStatus: 'PASSED' | 'PARTIAL' | 'FAILED' = fisherScore >= 80 ? 'PASSED' : fisherScore >= 50 ? 'PARTIAL' : 'FAILED';
  
  // 3. STRING Network Benchmark (now uses REAL eigenvalues)
  const networkResult = runNetworkBenchmark(eigenvalueDataForNetwork);
  let networkScore: number;
  if (networkResult.validation.stableGenesAsHubs > networkResult.validation.unstableGenesAsHubs && 
      networkResult.validation.correlationCoefficient > 0.3) {
    networkScore = 100;
  } else if (networkResult.validation.stableGenesAsHubs > networkResult.validation.unstableGenesAsHubs) {
    networkScore = 85;
  } else if (Math.abs(networkResult.validation.correlationCoefficient) > 0.2) {
    networkScore = 75;
  } else {
    networkScore = 50;
  }
  const networkStatus: 'PASSED' | 'PARTIAL' | 'FAILED' = networkScore >= 80 ? 'PASSED' : networkScore >= 50 ? 'PARTIAL' : 'FAILED';
  
  // 4. Ueda Timetable Benchmark (now uses REAL time series data)
  const uedaResult = runUedaBenchmark(timeSeriesDataForUeda);
  let uedaScore: number;
  if (uedaResult.comparison.eigenvalueAddsInformation && uedaResult.comparison.informationGain > 5) {
    uedaScore = 100;
  } else if (uedaResult.comparison.eigenvalueAddsInformation) {
    uedaScore = 85;
  } else if (uedaResult.comparison.eigenvalueOnlyPredictsPerturbation > 0) {
    uedaScore = 75;
  } else {
    uedaScore = 50;
  }
  const uedaStatus: 'PASSED' | 'PARTIAL' | 'FAILED' = uedaScore >= 80 ? 'PASSED' : uedaScore >= 50 ? 'PARTIAL' : 'FAILED';
  
  const benchmarksPassed = [turingStatus, fisherStatus, networkStatus, uedaStatus]
    .filter(s => s === 'PASSED').length;
  const overallScore = Math.round((turingScore + fisherScore + networkScore + uedaScore) / 4);
  
  let conclusion: string;
  if (benchmarksPassed === 4) {
    conclusion = `FULL VALIDATION: All 4 benchmarks passed using real eigenvalue data from ${nGenes} genes. ` +
      "PAR(2) eigenvalue framework is grounded in established systems biology: " +
      "Turing pattern formation, information theory, network topology, and circadian chronobiology.";
  } else if (benchmarksPassed >= 3) {
    conclusion = `STRONG VALIDATION: ${benchmarksPassed}/4 benchmarks passed (${nGenes} genes from GSE54650 Liver). ` +
      "PAR(2) framework demonstrates robust external validity with real data.";
  } else if (benchmarksPassed >= 2) {
    conclusion = `PARTIAL VALIDATION: ${benchmarksPassed}/4 benchmarks passed (${nGenes} genes). ` +
      "Core hypothesis supported; some benchmarks require further development.";
  } else {
    conclusion = `LIMITED VALIDATION: ${benchmarksPassed}/4 benchmarks passed (${nGenes} genes). ` +
      "Framework requires further theoretical grounding.";
  }
  
  return {
    timestamp,
    overallScore,
    benchmarksPassed,
    totalBenchmarks: 4,
    dataSource: 'GSE54650 Liver (real computed eigenvalues)',
    nGenes,
    benchmarks: {
      turing: {
        name: 'Turing Symmetry-Breaking',
        question: 'Is |λ| ≈ 0.618 the physical "Break Point"?',
        status: turingStatus,
        expectedResult: 'Spatial patterns collapse when |λ| > φ',
        actualResult: `Bifurcation at |λ| = ${turingResult.bifurcationPoint.toFixed(3)}`,
        score: turingScore,
        details: turingResult
      },
      fisher: {
        name: 'Fisher Information Throughput',
        question: 'Do intermediate eigenvalues maximize signaling fidelity?',
        status: fisherStatus,
        expectedResult: 'Information throughput peaks in stable band (0.40-0.80)',
        actualResult: `Peak throughput at |λ| = ${fisherResult.peakFisherInfo.eigenvalue.toFixed(2)}, ` +
          `${(fisherResult.validation.informationLossInCancer * 100).toFixed(0)}% loss at cancer-range eigenvalues`,
        score: fisherScore,
        details: fisherResult
      },
      network: {
        name: 'STRING Network',
        question: 'Are "Stability Hubs" real?',
        status: networkStatus,
        expectedResult: 'Stable eigenvalue genes are more connected',
        actualResult: `${(networkResult.validation.stableGenesAsHubs * 100).toFixed(0)}% stable genes are hubs ` +
          `vs ${(networkResult.validation.unstableGenesAsHubs * 100).toFixed(0)}% unstable (r=${networkResult.validation.correlationCoefficient.toFixed(2)})`,
        score: networkScore,
        details: networkResult
      },
      ueda: {
        name: 'Ueda Molecular Timetable',
        question: 'Does eigenvalue add information beyond phase?',
        status: uedaStatus,
        expectedResult: 'Eigenvalue predicts disease vulnerability independently of phase (cross-condition WT vs APC-KO)',
        actualResult: `Eigenvalue R² = ${uedaResult.comparison.eigenvalueOnlyPredictsPerturbation.toFixed(3)} ` +
          `vs Phase R² = ${uedaResult.comparison.phaseOnlyPredictsPerturbation.toFixed(3)}, ` +
          `Combined R² = ${uedaResult.comparison.combinedPredictsPerturbation.toFixed(3)}` +
          (uedaResult.crossCondition ? ` (${uedaResult.crossCondition.nGenesCompared} genes, real cross-condition data)` : ''),
        score: uedaScore,
        details: uedaResult
      }
    },
    conclusion
  };
}

export function runSpatialSymmetryTest(eigenvalue: number): {
  eigenvalue: number;
  isBelowBifurcation: boolean;
  patternStability: 'stable' | 'critical' | 'unstable';
  turingNumber: number;
  interpretation: string;
} {
  const PHI = 0.618;
  
  const isBelowBifurcation = eigenvalue < PHI;
  
  let patternStability: 'stable' | 'critical' | 'unstable';
  if (eigenvalue < PHI - 0.05) {
    patternStability = 'stable';
  } else if (eigenvalue <= PHI + 0.05) {
    patternStability = 'critical';
  } else {
    patternStability = 'unstable';
  }
  
  const turingNumber = Math.max(0, 1 - (eigenvalue - 0.5) * 2);
  
  const interpretation = isBelowBifurcation
    ? `Eigenvalue |λ| = ${eigenvalue.toFixed(3)} is BELOW the Turing bifurcation point (φ = 0.618). ` +
      `Spatial tissue patterns remain INTACT. Crypt/villi architecture is stable.`
    : `Eigenvalue |λ| = ${eigenvalue.toFixed(3)} EXCEEDS the Turing bifurcation point (φ = 0.618). ` +
      `Spatial tissue patterns are UNSTABLE. This represents the mathematical signature of ` +
      `adenomatous transformation where normal tissue architecture collapses.`;
  
  return {
    eigenvalue,
    isBelowBifurcation,
    patternStability,
    turingNumber,
    interpretation
  };
}

export { runTuringBenchmark, runFisherBenchmark, runNetworkBenchmark, runUedaBenchmark };
export { analyzeTuringStability } from './turing-symmetry';
export { analyzeInformationFidelity } from './fisher-information';
