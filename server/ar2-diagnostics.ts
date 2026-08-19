import * as fs from 'fs';
import * as path from 'path';

const CLOCK_GENES = new Set([
  'PER1','PER2','PER3','CRY1','CRY2','CLOCK','ARNTL','BMAL1',
  'NR1D1','NR1D2','RORC','DBP','TEF','NPAS2','CIPC','BHLHE40','BHLHE41',
  'RORA','RORB','RORC','CSNK1D','CSNK1E','FBXL3','FBXW11','NFIL3'
]);

const TARGET_GENES = new Set([
  'CCND1','MYC','MCM6','WEE1','CDK1','CCNB1','CCNE1','CCNE2',
  'LGR5','MKI67','AXIN2','TP53','CDKN1A','BCL2','BAX','CHEK2',
  'CDK2','CDK4','CDK6','CCNA2','E2F1','RB1','PCNA','TOP2A',
  'BRCA1','RAD51','CDC25A','CDC25B','PLK1','AURKA','AURKB',
  'BUB1','MAD2L1','CENPE','KIF11','TERT','DKK1','WNT3','WNT5A',
  'CTNNB1','APC','GSK3B','NOTCH1','HES1','DLL1','JAG1'
]);

const TISSUES = [
  'Adrenal','Aorta','Brainstem','Brown_Fat','Cerebellum',
  'Heart','Hypothalamus','Kidney','Liver','Lung','Muscle','White_Fat'
];

interface GeneAR2Full {
  gene: string;
  category: 'clock' | 'target' | 'background';
  phi1: number;
  phi2: number;
  eigenvalue: number;
  rootType: 'complex' | 'real';
  isStationary: boolean;
  isExplosive: boolean;
  durbinWatson: number;
  ljungBoxQ: number;
  r2: number;
  residualMean: number;
  residualSD: number;
}

function fitAR2Full(series: number[]): GeneAR2Full | null {
  const n = series.length;
  if (n < 5) return null;

  const m = series.reduce((a, b) => a + b, 0) / n;
  const y = series.map(x => x - m);

  const Y = y.slice(2);
  const Y1 = y.slice(1, n - 1);
  const Y2 = y.slice(0, n - 2);

  let s11 = 0, s22 = 0, s12 = 0, sy1 = 0, sy2 = 0;
  for (let i = 0; i < Y.length; i++) {
    s11 += Y1[i] * Y1[i];
    s22 += Y2[i] * Y2[i];
    s12 += Y1[i] * Y2[i];
    sy1 += Y[i] * Y1[i];
    sy2 += Y[i] * Y2[i];
  }

  const det = s11 * s22 - s12 * s12;
  if (Math.abs(det) < 1e-15) return null;

  const phi1 = (sy1 * s22 - sy2 * s12) / det;
  const phi2 = (sy2 * s11 - sy1 * s12) / det;

  const disc = phi1 * phi1 + 4 * phi2;
  let eigenvalue: number;
  let rootType: 'complex' | 'real';

  if (disc >= 0) {
    eigenvalue = Math.max(
      Math.abs((phi1 + Math.sqrt(disc)) / 2),
      Math.abs((phi1 - Math.sqrt(disc)) / 2)
    );
    rootType = 'real';
  } else {
    eigenvalue = Math.sqrt(-phi2);
    rootType = 'complex';
  }

  if (isNaN(eigenvalue)) return null;

  const isStationary = (phi1 + phi2 < 1) && (phi2 - phi1 < 1) && (phi2 > -1);
  const isExplosive = eigenvalue > 1.0;

  const residuals: number[] = [];
  for (let i = 0; i < Y.length; i++) {
    residuals.push(Y[i] - phi1 * Y1[i] - phi2 * Y2[i]);
  }

  let ssRes = 0, ssTot = 0;
  const yMean = Y.reduce((a, b) => a + b, 0) / Y.length;
  for (let i = 0; i < Y.length; i++) {
    ssRes += residuals[i] * residuals[i];
    ssTot += (Y[i] - yMean) * (Y[i] - yMean);
  }
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  let dwNum = 0, dwDen = 0;
  for (let i = 1; i < residuals.length; i++) {
    dwNum += (residuals[i] - residuals[i - 1]) ** 2;
  }
  for (let i = 0; i < residuals.length; i++) {
    dwDen += residuals[i] * residuals[i];
  }
  const durbinWatson = dwDen > 0 ? dwNum / dwDen : 2.0;

  const resMean = residuals.reduce((a, b) => a + b, 0) / residuals.length;
  let resVar = 0;
  for (const r of residuals) resVar += (r - resMean) ** 2;
  resVar /= residuals.length;
  const resSD = Math.sqrt(resVar);

  let ljungBoxQ = 0;
  const maxLag = Math.min(5, Math.floor(residuals.length / 4));
  for (let lag = 1; lag <= maxLag; lag++) {
    let num = 0, den = 0;
    for (let i = lag; i < residuals.length; i++) {
      num += (residuals[i] - resMean) * (residuals[i - lag] - resMean);
    }
    for (let i = 0; i < residuals.length; i++) {
      den += (residuals[i] - resMean) ** 2;
    }
    const rk = den > 0 ? num / den : 0;
    ljungBoxQ += (rk * rk) / (residuals.length - lag);
  }
  ljungBoxQ *= residuals.length * (residuals.length + 2);

  return {
    gene: '',
    category: 'background',
    phi1, phi2, eigenvalue, rootType,
    isStationary, isExplosive,
    durbinWatson, ljungBoxQ, r2,
    residualMean: resMean, residualSD: resSD
  };
}

function parseCSV(filePath: string): Map<string, number[]> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  const genes = new Map<string, number[]>();

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    const gene = parts[0].trim().replace(/"/g, '');
    const values = parts.slice(1).map(Number).filter(v => !isNaN(v));
    if (values.length >= 5 && !values.every(v => v === 0)) {
      genes.set(gene, values);
    }
  }
  return genes;
}

function classifyGene(gene: string): 'clock' | 'target' | 'background' {
  const upper = gene.toUpperCase();
  if (CLOCK_GENES.has(upper)) return 'clock';
  if (TARGET_GENES.has(upper)) return 'target';
  return 'background';
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function sd(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1));
}

interface StabilityBins {
  stableCount: number;          // |λ| < 0.97
  nearCriticalCount: number;    // 0.97 ≤ |λ| ≤ 1.03
  unstableCount: number;        // |λ| > 1.03
  stablePct: number;
  nearCriticalPct: number;
  unstablePct: number;
  stableMedianLambda: number;
  nearCriticalMedianLambda: number;
  unstableMedianLambda: number;
}

interface CategoryDiagnostics {
  category: string;
  totalGenes: number;
  genesWithValidFit: number;
  explosiveCount: number;
  explosivePct: number;
  nonStationaryCount: number;
  nonStationaryPct: number;
  medianLambda_allIncluded: number;
  medianLambda_stableOnly: number;
  medianLambda_cappedAt1: number;
  meanLambda_allIncluded: number;
  meanLambda_stableOnly: number;
  meanLambda_cappedAt1: number;
  meanR2: number;
  medianR2: number;
  meanDurbinWatson: number;
  medianDurbinWatson: number;
  meanLjungBoxQ: number;
  pctDWbelow1_5: number;
  pctDWabove2_5: number;
  pctR2above0_3: number;
  complexRootPct: number;
  stabilityBins: StabilityBins;
}

export function runDiagnosticsAnalysis() {
  const startTime = Date.now();
  const allTissueResults: Record<string, CategoryDiagnostics[]> = {};
  const aggregated: Record<string, GeneAR2Full[]> = {
    clock: [], target: [], background: []
  };

  for (const tissue of TISSUES) {
    const filePath = path.join('datasets', `GSE54650_${tissue}_circadian.csv`);
    if (!fs.existsSync(filePath)) continue;

    const genes = parseCSV(filePath);
    const tissueGenes: Record<string, GeneAR2Full[]> = {
      clock: [], target: [], background: []
    };

    for (const [gene, values] of Array.from(genes)) {
      const result = fitAR2Full(values);
      if (!result) continue;
      const cat = classifyGene(gene);
      result.gene = gene;
      result.category = cat;
      tissueGenes[cat].push(result);
      aggregated[cat].push(result);
    }

    allTissueResults[tissue] = ['clock', 'target', 'background'].map(cat => {
      const results = tissueGenes[cat];
      return computeCategoryDiagnostics(cat, results);
    });
  }

  const grandSummary = ['clock', 'target', 'background'].map(cat => {
    return computeCategoryDiagnostics(cat, aggregated[cat]);
  });

  const sensitivityTest = runSensitivityAnalysis(aggregated);

  return {
    perTissue: allTissueResults,
    grandSummary,
    sensitivityTest,
    tissueCount: Object.keys(allTissueResults).length,
    totalFits: aggregated.clock.length + aggregated.target.length + aggregated.background.length,
    computationTimeMs: Date.now() - startTime
  };
}

function emptyBins(): StabilityBins {
  return { stableCount: 0, nearCriticalCount: 0, unstableCount: 0, stablePct: 0, nearCriticalPct: 0, unstablePct: 0, stableMedianLambda: 0, nearCriticalMedianLambda: 0, unstableMedianLambda: 0 };
}

function computeStabilityBins(results: GeneAR2Full[]): StabilityBins {
  const total = results.length;
  if (total === 0) return emptyBins();
  const stableGenes = results.filter(r => r.eigenvalue < 0.97);
  const nearCriticalGenes = results.filter(r => r.eigenvalue >= 0.97 && r.eigenvalue <= 1.03);
  const unstableGenes = results.filter(r => r.eigenvalue > 1.03);
  return {
    stableCount: stableGenes.length,
    nearCriticalCount: nearCriticalGenes.length,
    unstableCount: unstableGenes.length,
    stablePct: (stableGenes.length / total) * 100,
    nearCriticalPct: (nearCriticalGenes.length / total) * 100,
    unstablePct: (unstableGenes.length / total) * 100,
    stableMedianLambda: median(stableGenes.map(r => r.eigenvalue)),
    nearCriticalMedianLambda: median(nearCriticalGenes.map(r => r.eigenvalue)),
    unstableMedianLambda: median(unstableGenes.map(r => r.eigenvalue)),
  };
}

function computeCategoryDiagnostics(cat: string, results: GeneAR2Full[]): CategoryDiagnostics {
  const total = results.length;
  if (total === 0) {
    return {
      category: cat, totalGenes: 0, genesWithValidFit: 0,
      explosiveCount: 0, explosivePct: 0, nonStationaryCount: 0, nonStationaryPct: 0,
      medianLambda_allIncluded: 0, medianLambda_stableOnly: 0, medianLambda_cappedAt1: 0,
      meanLambda_allIncluded: 0, meanLambda_stableOnly: 0, meanLambda_cappedAt1: 0,
      meanR2: 0, medianR2: 0, meanDurbinWatson: 0, medianDurbinWatson: 0,
      meanLjungBoxQ: 0, pctDWbelow1_5: 0, pctDWabove2_5: 0, pctR2above0_3: 0,
      complexRootPct: 0, stabilityBins: emptyBins()
    };
  }

  const explosive = results.filter(r => r.isExplosive);
  const nonStationary = results.filter(r => !r.isStationary);
  const stable = results.filter(r => r.isStationary && !r.isExplosive);

  const allLambdas = results.map(r => r.eigenvalue);
  const stableLambdas = stable.map(r => r.eigenvalue);
  const cappedLambdas = results.map(r => Math.min(r.eigenvalue, 1.0));
  const stabilityBins = computeStabilityBins(results);

  const allR2 = results.map(r => r.r2);
  const allDW = results.map(r => r.durbinWatson);
  const allLBQ = results.map(r => r.ljungBoxQ);

  return {
    category: cat,
    totalGenes: total,
    genesWithValidFit: stable.length,
    explosiveCount: explosive.length,
    explosivePct: (explosive.length / total) * 100,
    nonStationaryCount: nonStationary.length,
    nonStationaryPct: (nonStationary.length / total) * 100,
    medianLambda_allIncluded: median(allLambdas),
    medianLambda_stableOnly: median(stableLambdas),
    medianLambda_cappedAt1: median(cappedLambdas),
    meanLambda_allIncluded: mean(allLambdas),
    meanLambda_stableOnly: mean(stableLambdas),
    meanLambda_cappedAt1: mean(cappedLambdas),
    meanR2: mean(allR2),
    medianR2: median(allR2),
    meanDurbinWatson: mean(allDW),
    medianDurbinWatson: median(allDW),
    meanLjungBoxQ: mean(allLBQ),
    pctDWbelow1_5: (allDW.filter(d => d < 1.5).length / total) * 100,
    pctDWabove2_5: (allDW.filter(d => d > 2.5).length / total) * 100,
    pctR2above0_3: (allR2.filter(r => r > 0.3).length / total) * 100,
    complexRootPct: (results.filter(r => r.rootType === 'complex').length / total) * 100,
    stabilityBins
  };
}

function runSensitivityAnalysis(aggregated: Record<string, GeneAR2Full[]>) {
  // Note: all clock (n≈276) and target (n≈528) gene fits are stationary with |λ|≤1,
  // so filters based purely on stationarity/explosive are no-ops for those categories.
  // The methods below are chosen to genuinely vary clock and target gene counts,
  // giving a meaningful sensitivity test across different analytical choices.
  const methods = [
    {
      name: 'Baseline: all genes, no exclusions',
      filter: (_r: GeneAR2Full) => true,
      transform: (v: number) => v
    },
    {
      name: 'Moderate quality: R² > 0.1',
      filter: (r: GeneAR2Full) => r.r2 > 0.1,
      transform: (v: number) => v
    },
    {
      name: 'Strict quality: R² > 0.3 AND DW ∈ [1.0, 3.0]',
      filter: (r: GeneAR2Full) => r.r2 > 0.3 && r.durbinWatson >= 1.0 && r.durbinWatson <= 3.0,
      transform: (v: number) => v
    },
    {
      name: 'Very strict: R² > 0.5 AND DW ∈ [1.2, 2.8]',
      filter: (r: GeneAR2Full) => r.r2 > 0.5 && r.durbinWatson >= 1.2 && r.durbinWatson <= 2.8,
      transform: (v: number) => v
    },
    {
      name: 'Complex roots only (oscillatory dynamics)',
      filter: (r: GeneAR2Full) => r.rootType === 'complex',
      transform: (v: number) => v
    },
    {
      name: 'Real roots only (damped / non-oscillatory dynamics)',
      filter: (r: GeneAR2Full) => r.rootType === 'real',
      transform: (v: number) => v
    },
    {
      name: 'High persistence only: |λ| > 0.3',
      filter: (r: GeneAR2Full) => r.eigenvalue > 0.3,
      transform: (v: number) => v
    }
  ];

  return methods.map(method => {
    const catResults: Record<string, { median: number; mean: number; n: number }> = {};
    for (const cat of ['clock', 'target', 'background']) {
      const filtered = aggregated[cat].filter(method.filter);
      const lambdas = filtered.map(r => method.transform(r.eigenvalue));
      catResults[cat] = {
        median: median(lambdas),
        mean: mean(lambdas),
        n: lambdas.length
      };
    }

    const clockMedian = catResults.clock.median;
    const targetMedian = catResults.target.median;
    const backgroundMedian = catResults.background.median;
    const hierarchyPreserved = clockMedian > targetMedian && targetMedian > backgroundMedian;

    return {
      method: method.name,
      clock: catResults.clock,
      target: catResults.target,
      background: catResults.background,
      hierarchyPreserved,
      clockTargetGap: clockMedian - targetMedian,
      targetBackgroundGap: targetMedian - backgroundMedian,
      clockBackgroundGap: clockMedian - backgroundMedian
    };
  });
}
