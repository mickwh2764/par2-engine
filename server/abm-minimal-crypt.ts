/**
 * Minimal Agent-Based Model: 1D Crypt Simulation
 * Tests Layer 2 (stochastic division) + Layer 3 (BMAL1 temporal gating)
 * 
 * Question: Does BMAL1 phase gating actually reduce mutation accumulation?
 */

interface CryptCell {
  id: number;
  state: 'stem' | 'TA' | 'differentiated'; // stem, transit-amplifying, differentiated
  ageHours: number;
  mutations: number;
  generationNumber: number;
  bmal1Phase: number; // 0-1, normalized to 24h cycle
}

interface SimulationState {
  cells: CryptCell[];
  timeHours: number;
  generation: number;
  wtMutationCounts: number[];
  koMutationCounts: number[];
  metadata: {
    totalWT_Mutations: number;
    totalKO_Mutations: number;
    wtGenMutations: number[]; // per generation
    koGenMutations: number[];
  };
}

const CELL_CYCLE_MEAN = 24; // hours
const CELL_CYCLE_SD = 12;
const N_GENERATIONS = 10;
const HOURS_PER_GEN = 60; // 60 hours = ~2.5 days per generation
const N_CELLS_CRYPT = 16; // typical ISC count

/**
 * Poisson-based stochastic cell division
 */
function shouldDivideSoon(ageHours: number): boolean {
  // Exponential waiting time: P(divide) ~ exp(-age / tau)
  const tau = CELL_CYCLE_MEAN;
  return Math.random() < (1 - Math.exp(-1 / (tau / 2))); // check every 2 hours
}

/**
 * BMAL1 circadian phase (0-1) as sine wave
 * Peak at ZT12 (12/24 = 0.5)
 */
function getBMAL1Phase(timeHours: number): number {
  const cyclePosition = (timeHours % 24) / 24;
  return 0.5 + 0.5 * Math.sin(2 * Math.PI * cyclePosition);
}

/**
 * Mutation risk modulated by BMAL1 phase
 * WT: LOW risk during repair window (ZT18-24), HIGH during S-phase (ZT0-12)
 * KO: constant 1% risk (no temporal gating)
 */
function getMutationRisk(bmal1Phase: number, isWT: boolean): number {
  const baseMutationRate = 0.01; // 1% per division
  
  if (isWT) {
    // bmal1Phase ranges 0-1 (ZT0 → ZT24)
    // ZT0-6 (phase 0-0.25): S-phase, HIGH risk
    // ZT12 (phase 0.5): S/G2 transition, HIGH risk
    // ZT18 (phase 0.75): Repair peak, LOW risk
    // ZT24 (phase 1.0): Repair continues, LOW risk
    
    // Use absolute distance from phase 0.75 (repair peak at ZT18)
    const distFromRepair = Math.abs(bmal1Phase - 0.75);
    const repairFactor = Math.exp(-8 * distFromRepair); // narrow gaussian around ZT18
    
    // During repair (high factor), risk is low; outside repair, risk is high
    return baseMutationRate * (1 - repairFactor * 0.8);
  } else {
    // KO: no temporal gating, constant risk
    return baseMutationRate;
  }
}

/**
 * Initialize crypt with N stem cells
 */
function initializeCrypt(timeHours: number): CryptCell[] {
  const cells: CryptCell[] = [];
  for (let i = 0; i < N_CELLS_CRYPT; i++) {
    cells.push({
      id: i,
      state: 'stem',
      ageHours: Math.random() * CELL_CYCLE_MEAN,
      mutations: 0,
      generationNumber: 0,
      bmal1Phase: getBMAL1Phase(timeHours),
    });
  }
  return cells;
}

/**
 * Simulate one time step (2 hours)
 */
function stepCrypt(
  cells: CryptCell[],
  timeHours: number,
  isWT: boolean,
  dt: number = 2
): CryptCell[] {
  const newCells: CryptCell[] = [];
  const maxCells = 100; // crypt capacity

  for (const cell of cells) {
    if (newCells.length >= maxCells) break; // stop when full

    const bmal1 = getBMAL1Phase(timeHours);
    cell.bmal1Phase = bmal1;
    cell.ageHours += dt;

    // Check division
    if (cell.state === 'stem' && shouldDivideSoon(cell.ageHours)) {
      // Cell divides
      const mutationRisk = getMutationRisk(bmal1, isWT);
      const newMutations = Math.random() < mutationRisk ? 1 : 0;

      // Two daughters
      const daughter1: CryptCell = {
        id: Math.random(),
        state: 'stem',
        ageHours: 0,
        mutations: cell.mutations + newMutations,
        generationNumber: cell.generationNumber + 1,
        bmal1Phase: bmal1,
      };

      const daughter2: CryptCell = {
        id: Math.random(),
        state: 'TA', // some daughters differentiate
        ageHours: 0,
        mutations: cell.mutations + newMutations,
        generationNumber: cell.generationNumber + 1,
        bmal1Phase: bmal1,
      };

      newCells.push(daughter1, daughter2);
    } else if (cell.state === 'TA') {
      // Transit-amplifying cells differentiate after 2-3 cycles
      if (cell.ageHours > 48) {
        cell.state = 'differentiated';
      }
      newCells.push(cell);
    } else {
      // Differentiated cells shed (don't add back)
      if (cell.ageHours < 96) {
        newCells.push(cell);
      }
    }
  }

  return newCells.slice(0, maxCells); // enforce capacity
}

/**
 * Statistical helper functions
 */
function welchTTest(group1: number[], group2: number[]): { t: number; p: number } {
  const n1 = group1.length;
  const n2 = group2.length;
  const mean1 = group1.reduce((a, b) => a + b) / n1;
  const mean2 = group2.reduce((a, b) => a + b) / n2;
  const var1 = group1.reduce((s, x) => s + Math.pow(x - mean1, 2)) / (n1 - 1);
  const var2 = group2.reduce((s, x) => s + Math.pow(x - mean2, 2)) / (n2 - 1);
  const t = (mean2 - mean1) / Math.sqrt(var1 / n1 + var2 / n2);
  const df = Math.pow(var1 / n1 + var2 / n2, 2) / (Math.pow(var1 / n1, 2) / (n1 - 1) + Math.pow(var2 / n2, 2) / (n2 - 1));
  // Approximate p-value using normal distribution (good for df > 30)
  const p = 2 * (1 - 0.5 * (1 + erf(Math.abs(t) / Math.sqrt(2))));
  return { t, p };
}

function cohensD(group1: number[], group2: number[]): number {
  const mean1 = group1.reduce((a, b) => a + b) / group1.length;
  const mean2 = group2.reduce((a, b) => a + b) / group2.length;
  const var1 = group1.reduce((s, x) => s + Math.pow(x - mean1, 2)) / (group1.length - 1);
  const var2 = group2.reduce((s, x) => s + Math.pow(x - mean2, 2)) / (group2.length - 1);
  const pooledSD = Math.sqrt((var1 + var2) / 2);
  return Math.abs(mean2 - mean1) / pooledSD;
}

function bootstrapCI(data: number[], ratio: boolean = false, otherData?: number[], iterations: number = 10000): { lower: number; upper: number; mean: number } {
  const bootstrapStats: number[] = [];
  const n = data.length;
  
  for (let i = 0; i < iterations; i++) {
    const sample = [];
    for (let j = 0; j < n; j++) {
      sample.push(data[Math.floor(Math.random() * n)]);
    }
    const sampleMean = sample.reduce((a, b) => a + b) / n;
    
    if (ratio && otherData) {
      const otherSample = [];
      for (let j = 0; j < otherData.length; j++) {
        otherSample.push(otherData[Math.floor(Math.random() * otherData.length)]);
      }
      const otherMean = otherSample.reduce((a, b) => a + b) / otherData.length;
      bootstrapStats.push(otherMean / sampleMean);
    } else {
      bootstrapStats.push(sampleMean);
    }
  }
  
  bootstrapStats.sort((a, b) => a - b);
  const mean = ratio && otherData 
    ? (otherData.reduce((a, b) => a + b) / otherData.length) / (data.reduce((a, b) => a + b) / data.length)
    : data.reduce((a, b) => a + b) / data.length;
  
  return {
    lower: bootstrapStats[Math.floor(iterations * 0.025)],
    upper: bootstrapStats[Math.floor(iterations * 0.975)],
    mean,
  };
}

function erf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-x * x);
  return sign * y;
}

/**
 * Run full simulation: WT vs KO over N_GENERATIONS
 */
export interface ABMResult {
  wtData: {
    generationMutations: number[];
    meanMutationsPerGen: number[];
    totalMutations: number;
  };
  koData: {
    generationMutations: number[];
    meanMutationsPerGen: number[];
    totalMutations: number;
  };
  summary: {
    wtReduction: number; // % reduction vs KO
    protectionFactor: number; // ratio KO/WT
  };
  statistics: {
    welch: { t: number; p: number };
    cohensD: number;
    bootstrapRatioCI: { lower: number; upper: number; mean: number };
    meanDifferenceCI: { lower: number; upper: number; mean: number };
  };
  interpretation: string;
}

export function runMinimalABM(): ABMResult {
  const N_REPLICATES = 50; // Multiple runs for statistical robustness
  const wtAllRuns: number[] = [];
  const koAllRuns: number[] = [];

  // Run multiple replicate simulations
  for (let rep = 0; rep < N_REPLICATES; rep++) {
    const wtMutationsByGen: number[] = [];
    const koMutationsByGen: number[] = [];

    // Run WT simulation
    let wtCells = initializeCrypt(0);
    for (let gen = 0; gen < N_GENERATIONS; gen++) {
      const startMutations = wtCells.reduce((s, c) => s + c.mutations, 0);
      for (let t = 0; t < HOURS_PER_GEN; t += 2) {
        wtCells = stepCrypt(wtCells, gen * HOURS_PER_GEN + t, true, 2);
      }
      const endMutations = wtCells.reduce((s, c) => s + c.mutations, 0);
      wtMutationsByGen.push(endMutations - startMutations);
    }

    // Run KO simulation
    let koCells = initializeCrypt(0);
    for (let gen = 0; gen < N_GENERATIONS; gen++) {
      const startMutations = koCells.reduce((s, c) => s + c.mutations, 0);
      for (let t = 0; t < HOURS_PER_GEN; t += 2) {
        koCells = stepCrypt(koCells, gen * HOURS_PER_GEN + t, false, 2);
      }
      const endMutations = koCells.reduce((s, c) => s + c.mutations, 0);
      koMutationsByGen.push(endMutations - startMutations);
    }

    const wtTotal = wtMutationsByGen.reduce((a, b) => a + b, 0);
    const koTotal = koMutationsByGen.reduce((a, b) => a + b, 0);
    
    wtAllRuns.push(wtTotal);
    koAllRuns.push(koTotal);
  }

  // Calculate statistics
  const wtMean = wtAllRuns.reduce((a, b) => a + b) / N_REPLICATES;
  const koMean = koAllRuns.reduce((a, b) => a + b) / N_REPLICATES;
  
  const wtSD = Math.sqrt(wtAllRuns.reduce((s, x) => s + Math.pow(x - wtMean, 2)) / N_REPLICATES);
  const koSD = Math.sqrt(koAllRuns.reduce((s, x) => s + Math.pow(x - koMean, 2)) / N_REPLICATES);

  // Protection metrics (fixed to be correct)
  const foldIncrease = koMean / wtMean;
  const percentProtection = (1 - wtMean / koMean) * 100;
  
  // For visualization, use first replicate
  const wtMutationsByGen: number[] = [];
  const koMutationsByGen: number[] = [];
  let wtCells = initializeCrypt(0);
  for (let gen = 0; gen < N_GENERATIONS; gen++) {
    const startMutations = wtCells.reduce((s, c) => s + c.mutations, 0);
    for (let t = 0; t < HOURS_PER_GEN; t += 2) {
      wtCells = stepCrypt(wtCells, gen * HOURS_PER_GEN + t, true, 2);
    }
    const endMutations = wtCells.reduce((s, c) => s + c.mutations, 0);
    wtMutationsByGen.push(endMutations - startMutations);
  }
  
  let koCells = initializeCrypt(0);
  for (let gen = 0; gen < N_GENERATIONS; gen++) {
    const startMutations = koCells.reduce((s, c) => s + c.mutations, 0);
    for (let t = 0; t < HOURS_PER_GEN; t += 2) {
      koCells = stepCrypt(koCells, gen * HOURS_PER_GEN + t, false, 2);
    }
    const endMutations = koCells.reduce((s, c) => s + c.mutations, 0);
    koMutationsByGen.push(endMutations - startMutations);
  }

  const meanWT = wtMutationsByGen.map((_, i) => 
    wtMutationsByGen.slice(0, i + 1).reduce((a, b) => a + b) / (i + 1)
  );
  const meanKO = koMutationsByGen.map((_, i) => 
    koMutationsByGen.slice(0, i + 1).reduce((a, b) => a + b) / (i + 1)
  );

  // Calculate statistics
  const welchResult = welchTTest(wtAllRuns, koAllRuns);
  const cohensDAbs = cohensD(wtAllRuns, koAllRuns);
  const bootstrapRatio = bootstrapCI(wtAllRuns, true, koAllRuns);
  const meanDiff = koMean - wtMean;
  const meanDiffSE = Math.sqrt((wtSD * wtSD) / N_REPLICATES + (koSD * koSD) / N_REPLICATES);
  const meanDiffCI = {
    mean: meanDiff,
    lower: meanDiff - 1.96 * meanDiffSE,
    upper: meanDiff + 1.96 * meanDiffSE,
  };

  const pValueStr = welchResult.p < 0.001 ? "p < 0.001***" : 
                    welchResult.p < 0.01 ? `p = ${welchResult.p.toFixed(3)}**` :
                    welchResult.p < 0.05 ? `p = ${welchResult.p.toFixed(3)}*` :
                    `p = ${welchResult.p.toFixed(3)} (ns)`;

  return {
    wtData: {
      generationMutations: wtMutationsByGen,
      meanMutationsPerGen: meanWT,
      totalMutations: wtMean,
    },
    koData: {
      generationMutations: koMutationsByGen,
      meanMutationsPerGen: meanKO,
      totalMutations: koMean,
    },
    summary: {
      wtReduction: percentProtection,
      protectionFactor: foldIncrease,
    },
    statistics: {
      welch: welchResult,
      cohensD: cohensDAbs,
      bootstrapRatioCI: bootstrapRatio,
      meanDifferenceCI: meanDiffCI,
    },
    interpretation: `
## Statistical Summary (${N_REPLICATES} replicate simulations, ${N_GENERATIONS} generations each)

WT (with BMAL1 temporal gating):    ${wtMean.toFixed(1)} ± ${wtSD.toFixed(1)} mutations/run
KO (no temporal gating):             ${koMean.toFixed(1)} ± ${koSD.toFixed(1)} mutations/run

**Protection Factor (KO/WT)**: ${foldIncrease.toFixed(2)}× [95% CI: ${bootstrapRatio.lower.toFixed(2)}–${bootstrapRatio.upper.toFixed(2)}]
**BMAL1 Reduction**: ${percentProtection.toFixed(1)}% (WT reduces burden relative to KO)
**Mean Difference (KO − WT)**: ${meanDiff.toFixed(1)} mutations [95% CI: ${meanDiffCI.lower.toFixed(1)}–${meanDiffCI.upper.toFixed(1)}]

## Statistical Significance

**Welch's t-test**: t = ${welchResult.t.toFixed(2)}, ${pValueStr}
**Cohen's d (effect size)**: ${cohensDAbs.toFixed(2)} (${cohensDAbs < 0.2 ? 'trivial' : cohensDAbs < 0.5 ? 'small' : cohensDAbs < 0.8 ? 'medium' : 'large'})

## Interpretation

Under the current minimal ABM parameters, BMAL1-gated temporal modulation did ${welchResult.p < 0.05 ? 'produce a statistically significant reduction in mutation accumulation (p < 0.05)' : 'NOT produce a statistically significant reduction in mutation accumulation (p = ' + welchResult.p.toFixed(3) + ')'}.

${welchResult.p < 0.05 ? `
The observed ${meanDiff.toFixed(1)} mutation difference per run [95% CI: ${meanDiffCI.lower.toFixed(1)}–${meanDiffCI.upper.toFixed(1)}] suggests BMAL1 protection is detectable under these conditions, with ${cohensDAbs < 0.2 ? 'small' : cohensDAbs < 0.5 ? 'small' : 'medium'} effect size (d = ${cohensDAbs.toFixed(2)}).
` : `
The observed ${meanDiff.toFixed(1)} mutation difference per run [95% CI: ${meanDiffCI.lower.toFixed(1)}–${meanDiffCI.upper.toFixed(1)}] is indistinguishable from noise (Cohen's d = ${cohensDAbs.toFixed(2)}), suggesting that under the current model parameters (80% repair-window protection, 1% baseline mutation rate, 10 generations, 16 ISCs), BMAL1 temporal gating alone is insufficient to reliably separate mutation burdens.
`}

**Mechanistic implications**: ${welchResult.p < 0.05 ? 'This supports' : 'This does NOT support'} the hypothesis that temporal gating reduces mutation accumulation in stochastic division systems. ${welchResult.p < 0.05 ? 'The data suggest' : 'The null result suggests either:'} ${welchResult.p >= 0.05 ? `
- The temporal-gating mechanism is weaker than modeled (80% protection may be optimistic)
- Longer simulation horizons (>10 generations) are required to accumulate detectable differences
- Additional biological mechanisms (asymmetric division, selective apoptosis, clonal expansion) are needed beyond simple temporal gating
` : ''}
    `.trim(),
  };
}
