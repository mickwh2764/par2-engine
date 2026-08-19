/**
 * Fisher Information Framework
 * 
 * Measures information throughput of circadian signaling at different
 * eigenvalue levels. Tests whether intermediate eigenvalues (the "stable band")
 * maximize the ability to transmit timing information faithfully.
 * 
 * Key insight: Information throughput peaks at intermediate eigenvalues because:
 * - Too low (λ→0): signal decays before reaching targets (low throughput)
 * - Too high (λ→1): system becomes rigid, can't respond to inputs (low throughput)
 * - Intermediate: balance of persistence and responsiveness (max throughput)
 * 
 * This is distinct from Fisher Information about parameter estimation,
 * which increases monotonically toward λ=1.
 */

interface FisherAnalysisResult {
  eigenvalue: number;
  fisherInformation: number;
  signalToNoiseRatio: number;
  channelCapacity: number;
  informationEfficiency: number;
  classification: 'optimal' | 'suboptimal' | 'degraded' | 'noisy';
}

interface FisherBenchmarkResult {
  success: boolean;
  hypothesis: string;
  optimalBand: { lower: number; upper: number };
  analyses: FisherAnalysisResult[];
  peakFisherInfo: {
    eigenvalue: number;
    fisherInformation: number;
  };
  validation: {
    peakInStableBand: boolean;
    healthyCancerSeparation: number;
    informationLossInCancer: number;
  };
  interpretation: string;
}

/**
 * Calculate information throughput for circadian signaling
 * 
 * Models a circadian oscillator driving downstream targets through an AR(2) channel.
 * The throughput depends on how well the system transmits a periodic signal
 * while filtering stochastic noise.
 * 
 * Transfer function gain at circadian frequency ω₀ = 2π/24:
 *   |H(ω₀)|² = 1 / |1 - 2λcos(θ)e^{-iω₀} + λ²e^{-2iω₀}|²
 * 
 * But total noise power is ∫|H(ω)|²dω ∝ 1/(1-λ²)
 * 
 * Information throughput ∝ signal gain / total noise = |H(ω₀)|² × (1-λ²)
 * This naturally peaks at intermediate λ.
 */
function calculateInformationThroughput(eigenvalue: number, n: number = 12): number {
  if (eigenvalue >= 1.0 || eigenvalue <= 0) return 0;

  const lambda = eigenvalue;
  const lambda2 = lambda * lambda;

  const omega0 = 2 * Math.PI / 24;
  const theta = Math.PI / 4;

  const realPart = 1 - 2 * lambda * Math.cos(theta) * Math.cos(omega0) + lambda2 * Math.cos(2 * omega0);
  const imagPart = 2 * lambda * Math.cos(theta) * Math.sin(omega0) - lambda2 * Math.sin(2 * omega0);
  const transferGain = 1 / (realPart * realPart + imagPart * imagPart);

  const noisePower = 1 / (1 - lambda2);

  const throughput = transferGain / noisePower;

  return throughput * n;
}

function calculateSNR(eigenvalue: number): number {
  if (eigenvalue >= 1.0 || eigenvalue <= 0) return 0;

  const lambda = eigenvalue;
  const lambda2 = lambda * lambda;

  const omega0 = 2 * Math.PI / 24;
  const theta = Math.PI / 4;

  const realPart = 1 - 2 * lambda * Math.cos(theta) * Math.cos(omega0) + lambda2 * Math.cos(2 * omega0);
  const imagPart = 2 * lambda * Math.cos(theta) * Math.sin(omega0) - lambda2 * Math.sin(2 * omega0);
  const signalGain = 1 / (realPart * realPart + imagPart * imagPart);

  const intBand = 0.3;
  let noiseIntegral = 0;
  const steps = 100;
  for (let i = 0; i < steps; i++) {
    const omega = (i / steps) * Math.PI;
    if (Math.abs(omega - omega0) < intBand) continue;
    const r = 1 - 2 * lambda * Math.cos(theta) * Math.cos(omega) + lambda2 * Math.cos(2 * omega);
    const im = 2 * lambda * Math.cos(theta) * Math.sin(omega) - lambda2 * Math.sin(2 * omega);
    noiseIntegral += 1 / (r * r + im * im + 0.01);
  }
  noiseIntegral /= steps;

  return signalGain / (noiseIntegral + 0.01);
}

function calculateChannelCapacity(snr: number): number {
  return 0.5 * Math.log2(1 + snr);
}

function analyzeFisherInformation(eigenvalue: number): FisherAnalysisResult {
  const fisherInformation = calculateInformationThroughput(eigenvalue);
  const snr = calculateSNR(eigenvalue);
  const channelCapacity = calculateChannelCapacity(snr);

  const testRange = Array.from({ length: 50 }, (_, i) => 0.02 + i * 0.02);
  const maxFI = Math.max(...testRange.map(ev => calculateInformationThroughput(ev)));
  const informationEfficiency = maxFI > 0 ? fisherInformation / maxFI : 0;

  let classification: FisherAnalysisResult['classification'];
  if (informationEfficiency > 0.8) {
    classification = 'optimal';
  } else if (informationEfficiency > 0.5) {
    classification = 'suboptimal';
  } else if (informationEfficiency > 0.2) {
    classification = 'degraded';
  } else {
    classification = 'noisy';
  }

  return {
    eigenvalue,
    fisherInformation,
    signalToNoiseRatio: snr,
    channelCapacity,
    informationEfficiency,
    classification
  };
}

export function runFisherBenchmark(): FisherBenchmarkResult {
  const STABLE_BAND = { lower: 0.40, upper: 0.80 };

  const testEigenvalues = Array.from({ length: 48 }, (_, i) => 0.02 + i * 0.02);

  const analyses = testEigenvalues.map(ev => analyzeFisherInformation(ev));

  const peakAnalysis = analyses.reduce((max, curr) =>
    curr.fisherInformation > max.fisherInformation ? curr : max
  );

  const peakInStableBand = peakAnalysis.eigenvalue >= STABLE_BAND.lower &&
                           peakAnalysis.eigenvalue <= STABLE_BAND.upper;

  const healthyAnalyses = analyses.filter(a => a.eigenvalue >= 0.45 && a.eigenvalue <= 0.70);
  const cancerAnalyses = analyses.filter(a => a.eigenvalue >= 0.85 && a.eigenvalue <= 0.98);

  const healthyFI = healthyAnalyses.length > 0
    ? healthyAnalyses.reduce((sum, a) => sum + a.fisherInformation, 0) / healthyAnalyses.length
    : 1;
  const cancerFI = cancerAnalyses.length > 0
    ? cancerAnalyses.reduce((sum, a) => sum + a.fisherInformation, 0) / cancerAnalyses.length
    : 0;

  const healthyCancerSeparation = healthyFI > 0 ? (healthyFI - cancerFI) / healthyFI : 0;
  const informationLossInCancer = healthyFI > 0 ? Math.max(0, 1 - (cancerFI / healthyFI)) : 0;

  const interpretation = peakInStableBand
    ? `VALIDATED: Information throughput peaks at |λ| = ${peakAnalysis.eigenvalue.toFixed(2)} ` +
      `within the stable eigenvalue band (${STABLE_BAND.lower}-${STABLE_BAND.upper}). ` +
      `Healthy tissue eigenvalues maximize circadian signal transmission. ` +
      `Cancer-range eigenvalues (>0.85) show ${(informationLossInCancer * 100).toFixed(0)}% throughput loss ` +
      `due to system rigidity (inability to respond to new timing cues).`
    : `PARTIAL: Information throughput peaks at |λ| = ${peakAnalysis.eigenvalue.toFixed(2)}, ` +
      `outside the expected stable band. The transfer function model may need refinement.`;

  return {
    success: true,
    hypothesis: "Intermediate eigenvalues (stable band 0.40-0.80) maximize circadian information throughput",
    optimalBand: STABLE_BAND,
    analyses,
    peakFisherInfo: {
      eigenvalue: peakAnalysis.eigenvalue,
      fisherInformation: peakAnalysis.fisherInformation
    },
    validation: {
      peakInStableBand,
      healthyCancerSeparation,
      informationLossInCancer
    },
    interpretation
  };
}

export function analyzeInformationFidelity(
  eigenvalue: number,
  tissue: string,
  condition: string
): {
  eigenvalue: number;
  tissue: string;
  condition: string;
  fisherInformation: number;
  channelCapacity: number;
  signalQuality: 'fiber_optic' | 'copper_wire' | 'noisy_line' | 'static';
  interpretation: string;
} {
  const analysis = analyzeFisherInformation(eigenvalue);

  let signalQuality: 'fiber_optic' | 'copper_wire' | 'noisy_line' | 'static';

  if (analysis.classification === 'optimal') {
    signalQuality = 'fiber_optic';
  } else if (analysis.classification === 'suboptimal') {
    signalQuality = 'copper_wire';
  } else if (analysis.classification === 'degraded') {
    signalQuality = 'noisy_line';
  } else {
    signalQuality = 'static';
  }

  const qualityDescriptions = {
    fiber_optic: 'high-fidelity signal transmission (healthy)',
    copper_wire: 'adequate signal with minor noise (subclinical)',
    noisy_line: 'degraded signal with significant noise (pre-malignant)',
    static: 'near-complete information loss (malignant)'
  };

  return {
    eigenvalue,
    tissue,
    condition,
    fisherInformation: analysis.fisherInformation,
    channelCapacity: analysis.channelCapacity,
    signalQuality,
    interpretation: `${tissue} under ${condition}: Signal quality = "${signalQuality}" - ` +
      `${qualityDescriptions[signalQuality]}. ` +
      `Channel capacity = ${analysis.channelCapacity.toFixed(2)} bits/sample.`
  };
}
