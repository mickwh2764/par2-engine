interface CryptCell {
  id: number;
  state: "stem" | "TA" | "differentiated";
  ageHours: number;
  mutations: number;
  generationNumber: number;
}

const CELL_CYCLE_MEAN = 24;
const N_GENERATIONS = 10;
const HOURS_PER_GEN = 60;
const N_CELLS_CRYPT = 16;
const N_REPLICATES = 50;

function shouldDivideSoon(ageHours: number): boolean {
  const tau = CELL_CYCLE_MEAN;
  return Math.random() < (1 - Math.exp(-1 / (tau / 2)));
}

function getBMAL1Phase(timeHours: number): number {
  const cyclePosition = (timeHours % 24) / 24;
  return 0.5 + 0.5 * Math.sin(2 * Math.PI * cyclePosition);
}

function getMutationRisk(bmal1Phase: number, isWT: boolean): number {
  const baseMutationRate = 0.01;
  if (isWT) {
    const distFromRepair = Math.abs(bmal1Phase - 0.75);
    const repairFactor = Math.exp(-8 * distFromRepair);
    return baseMutationRate * (1 - repairFactor * 0.8);
  }
  return baseMutationRate;
}

function initializeCrypt(): CryptCell[] {
  const cells: CryptCell[] = [];
  for (let i = 0; i < N_CELLS_CRYPT; i++) {
    cells.push({ id: i, state: "stem", ageHours: Math.random() * CELL_CYCLE_MEAN, mutations: 0, generationNumber: 0 });
  }
  return cells;
}

function stepCrypt(cells: CryptCell[], timeHours: number, isWT: boolean): CryptCell[] {
  const newCells: CryptCell[] = [];
  const maxCells = 100;
  for (const cell of cells) {
    if (newCells.length >= maxCells) break;
    const bmal1 = getBMAL1Phase(timeHours);
    cell.ageHours += 2;
    if (cell.state === "stem" && shouldDivideSoon(cell.ageHours)) {
      const mutationRisk = getMutationRisk(bmal1, isWT);
      const newMutations = Math.random() < mutationRisk ? 1 : 0;
      newCells.push({ id: Math.random(), state: "stem", ageHours: 0, mutations: cell.mutations + newMutations, generationNumber: cell.generationNumber + 1 });
      newCells.push({ id: Math.random(), state: "TA", ageHours: 0, mutations: cell.mutations + newMutations, generationNumber: cell.generationNumber + 1 });
    } else if (cell.state === "TA") {
      if (cell.ageHours > 48) cell.state = "differentiated";
      newCells.push(cell);
    } else if (cell.ageHours < 96) {
      newCells.push(cell);
    }
  }
  return newCells.slice(0, maxCells);
}

export interface ABMResult {
  wtMean: number;
  koMean: number;
  protectionFactor: number;
  pValue: number;
  cohensD: number;
  ciLower: number;
  ciUpper: number;
}

export function runMinimalABM(): ABMResult {
  const wtAllRuns: number[] = [];
  const koAllRuns: number[] = [];

  for (let rep = 0; rep < N_REPLICATES; rep++) {
    let wtCells = initializeCrypt();
    let wtTotal = 0;
    for (let gen = 0; gen < N_GENERATIONS; gen++) {
      const start = wtCells.reduce((s, c) => s + c.mutations, 0);
      for (let t = 0; t < HOURS_PER_GEN; t += 2) wtCells = stepCrypt(wtCells, gen * HOURS_PER_GEN + t, true);
      wtTotal += wtCells.reduce((s, c) => s + c.mutations, 0) - start;
    }
    wtAllRuns.push(wtTotal);

    let koCells = initializeCrypt();
    let koTotal = 0;
    for (let gen = 0; gen < N_GENERATIONS; gen++) {
      const start = koCells.reduce((s, c) => s + c.mutations, 0);
      for (let t = 0; t < HOURS_PER_GEN; t += 2) koCells = stepCrypt(koCells, gen * HOURS_PER_GEN + t, false);
      koTotal += koCells.reduce((s, c) => s + c.mutations, 0) - start;
    }
    koAllRuns.push(koTotal);
  }

  const wtMean = wtAllRuns.reduce((a, b) => a + b) / N_REPLICATES;
  const koMean = koAllRuns.reduce((a, b) => a + b) / N_REPLICATES;
  const wtVar = wtAllRuns.reduce((s, x) => s + (x - wtMean) ** 2, 0) / (N_REPLICATES - 1);
  const koVar = koAllRuns.reduce((s, x) => s + (x - koMean) ** 2, 0) / (N_REPLICATES - 1);
  const t = (koMean - wtMean) / Math.sqrt(wtVar / N_REPLICATES + koVar / N_REPLICATES);
  const erf = (x: number) => { const a = [0.254829592, -0.284496736, 1.421413741, -1.453152027, 1.061405429]; const p = 0.3275911; const s = x < 0 ? -1 : 1; x = Math.abs(x); const tt = 1 / (1 + p * x); return s * (1 - (((((a[4] * tt + a[3]) * tt + a[2]) * tt + a[1]) * tt + a[0]) * tt) * Math.exp(-x * x)); };
  const p = 2 * (1 - 0.5 * (1 + erf(Math.abs(t) / Math.sqrt(2))));
  const pooledSD = Math.sqrt((wtVar + koVar) / 2);
  const d = Math.abs(koMean - wtMean) / pooledSD;
  const meanDiff = koMean - wtMean;
  const se = Math.sqrt(wtVar / N_REPLICATES + koVar / N_REPLICATES);

  return {
    wtMean, koMean,
    protectionFactor: koMean / wtMean,
    pValue: p,
    cohensD: d,
    ciLower: meanDiff - 1.96 * se,
    ciUpper: meanDiff + 1.96 * se,
  };
}
