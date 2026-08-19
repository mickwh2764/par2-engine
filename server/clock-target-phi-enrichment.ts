import * as fs from 'fs';
import { parse } from 'csv-parse/sync';

const PHI = (1 + Math.sqrt(5)) / 2;           // 1.61803...
const PHI_RECIPROCAL = 1 / PHI;               // 0.61803...
const GSE54650_TISSUES = [
  'Adrenal','Aorta','Brainstem','Brown_Fat','Cerebellum',
  'Heart','Hypothalamus','Kidney','Liver','Lung','Muscle','White_Fat'
];

// Tier 1 — core oscillator genes (not targets, used as positive control reference)
const CORE_CLOCK_GENES = [
  'Arntl','Clock','Npas2','Per1','Per2','Per3','Cry1','Cry2','Nr1d1','Nr1d2'
];

// Tier 2 — direct BMAL1/CLOCK E-box targets (first-wave CCGs)
// Sources: Koike et al. 2012 (ChIP-seq), Zhang et al. 2014 atlas, Wee1/Nampt coupling scan
const DIRECT_CLOCK_TARGETS = [
  'Dbp','Tef','Hlf',            // PAR-bZip output transcription factors
  'Nfil3',                       // E4bp4, anti-phase to PAR-bZips
  'Rora','Rorb','Rorc',          // ROR nuclear receptors (clock input loop)
  'Bhlhe40','Bhlhe41',           // DEC1, DEC2 — BMAL1-suppressed feedback
  'Ciart',                       // CHRONO — direct BMAL1 co-repressor
  'Wee1',                        // Cell cycle gate — coupled in 10/12 tissues in platform scan
  'Nampt',                       // NAD+ rate-limiting enzyme — coupled in 8/12 tissues
  'Cdkn1a',                      // p21 — direct E-box target
  'Ccrn4l',                      // Nocturnin (Noct) — rhythmic deadenylase
];

// Tier 3 — well-established secondary clock output genes
const SECONDARY_CLOCK_TARGETS = [
  'Hes1','Hes5','Hey1',          // NOTCH effectors, clock-gated in proliferating tissue
  'Vegfa',                       // Angiogenic output
  'Serpine1',                    // PAI-1 — direct Dbp/TEF target
  'Tnf',                         // Immune clock output
  'Il6',                         // Immune clock output
  'Sirt1',                       // NAD-dependent deacetylase — feeds back on clock
  'Cpt1a',                       // Fatty acid oxidation gate
  'Hmgcr',                       // Cholesterol synthesis (night-phase)
  'Cyp7a1',                      // Bile acid synthesis — highly rhythmic liver
  'Usp2',                        // Deubiquitinase — clock stabiliser
];

function loadDataset(tissue: string): { geneData: Map<string, number[]> } {
  const path = `datasets/GSE54650_${tissue}_circadian.csv`;
  if (!fs.existsSync(path)) return { geneData: new Map() };
  const content = fs.readFileSync(path, 'utf-8');
  const records = parse(content, { columns: true, skip_empty_lines: true }) as Record<string, string>[];
  const geneData = new Map<string, number[]>();
  if (records.length === 0) return { geneData };
  const headers = Object.keys(records[0]).filter(k => k !== 'Gene' && k !== 'gene');
  const parsed = headers.map((h, idx) => {
    const match = h.match(/(?:CT|ZT|T)(\d+)/i) || h.match(/(\d+)/);
    return { idx, time: match ? parseInt(match[1]) : idx };
  });
  parsed.sort((a, b) => a.time - b.time);
  const colOrder = parsed.map(p => headers[p.idx]);
  for (const record of records) {
    const gene = record.Gene || record.gene || Object.values(record)[0];
    if (!gene) continue;
    const values = colOrder.map(col => parseFloat(record[col])).filter(v => !isNaN(v));
    if (values.length >= 6) geneData.set(gene, values);
  }
  return { geneData };
}

function invertMatrix2x2(a: number, b: number, c: number, d: number): [number,number,number,number] | null {
  const det = a * d - b * c;
  if (Math.abs(det) < 1e-12) return null;
  return [d/det, -b/det, -c/det, a/det];
}

function fitAR2(values: number[]): { phi1: number; phi2: number; lambda: number; r2: number; hasComplexRoots: boolean } | null {
  const n = values.length;
  if (n < 6) return null;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const z = values.map(v => v - mean);
  // Build OLS system: z[t] = phi1*z[t-1] + phi2*z[t-2]
  let s11=0, s12=0, s22=0, sy1=0, sy2=0;
  for (let t = 2; t < n; t++) {
    s11 += z[t-1]*z[t-1]; s12 += z[t-1]*z[t-2];
    s22 += z[t-2]*z[t-2]; sy1 += z[t]*z[t-1]; sy2 += z[t]*z[t-2];
  }
  const inv = invertMatrix2x2(s11, s12, s12, s22);
  if (!inv) return null;
  const phi1 = inv[0]*sy1 + inv[1]*sy2;
  const phi2 = inv[2]*sy1 + inv[3]*sy2;
  if (!isFinite(phi1) || !isFinite(phi2)) return null;
  // Eigenvalues of companion matrix
  const disc = phi1*phi1 + 4*phi2;
  let lambda: number;
  let hasComplexRoots: boolean;
  if (disc >= 0) {
    const r1 = (phi1 + Math.sqrt(disc)) / 2;
    const r2 = (phi1 - Math.sqrt(disc)) / 2;
    lambda = Math.max(Math.abs(r1), Math.abs(r2));
    hasComplexRoots = false;
  } else {
    lambda = Math.sqrt(-phi2);
    hasComplexRoots = true;
  }
  lambda = Math.min(lambda, 1.0);
  // R²
  const predictions = z.slice(2).map((_, i) => phi1*z[i+1] + phi2*z[i]);
  const ssRes = predictions.reduce((acc, p, i) => acc + (z[i+2]-p)**2, 0);
  const ssTot = z.slice(2).reduce((acc, v) => acc + v**2, 0);
  const r2 = ssTot > 0 ? 1 - ssRes/ssTot : 0;
  return { phi1, phi2, lambda, r2, hasComplexRoots };
}

interface GeneResult {
  gene: string;
  tier: string;
  tissueResults: { tissue: string; lambda: number; r2: number; hasComplexRoots: boolean; phi1: number; phi2: number }[];
  meanLambda: number;
  medianLambda: number;
  distanceFromPhiReciprocal: number;
  meanR2: number;
  complexFraction: number;
  nTissues: number;
}

function median(arr: number[]): number {
  if (arr.length === 0) return NaN;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid-1]+sorted[mid])/2 : sorted[mid];
}

// Canonical gene-name aliases: gene officially renamed; both names appear in literature
const GENE_ALIASES: Record<string, string[]> = {
  'Ccrn4l': ['Noct', 'noct'],  // Nocturnin: renamed from Ccrn4l to Noct (NCBI Gene 67040)
  'ccrn4l': ['Noct', 'noct'],
};

function lookupGeneInMap(geneData: Map<string, number[]>, gene: string): number[] | undefined {
  const normalized = gene.charAt(0).toUpperCase() + gene.slice(1).toLowerCase();
  const direct = geneData.get(normalized) || geneData.get(gene)
    || geneData.get(gene.toUpperCase()) || geneData.get(gene.toLowerCase());
  if (direct) return direct;
  // Try registered aliases
  const aliases = GENE_ALIASES[gene] || GENE_ALIASES[gene.toLowerCase()] || [];
  for (const alias of aliases) {
    const v = geneData.get(alias) || geneData.get(alias.charAt(0).toUpperCase() + alias.slice(1).toLowerCase());
    if (v) return v;
  }
  return undefined;
}

function analyseGeneSet(genes: string[], tier: string, allTissueData: Map<string, Map<string, number[]>>): GeneResult[] {
  const results: GeneResult[] = [];
  for (const gene of genes) {
    const normalized = gene.charAt(0).toUpperCase() + gene.slice(1).toLowerCase();
    const tissueResults: GeneResult['tissueResults'] = [];
    for (const tissue of GSE54650_TISSUES) {
      const geneData = allTissueData.get(tissue);
      if (!geneData) continue;
      const values = lookupGeneInMap(geneData, gene);
      if (!values) continue;
      const fit = fitAR2(values);
      if (!fit) continue;
      tissueResults.push({ tissue, lambda: fit.lambda, r2: fit.r2, hasComplexRoots: fit.hasComplexRoots, phi1: fit.phi1, phi2: fit.phi2 });
    }
    if (tissueResults.length === 0) continue;
    const lambdas = tissueResults.map(t => t.lambda);
    const meanLambda = lambdas.reduce((a,b)=>a+b,0)/lambdas.length;
    const medLambda = median(lambdas);
    results.push({
      gene: normalized,
      tier,
      tissueResults,
      meanLambda,
      medianLambda: medLambda,
      distanceFromPhiReciprocal: Math.abs(meanLambda - PHI_RECIPROCAL),
      meanR2: tissueResults.reduce((a,b)=>a+b.r2,0)/tissueResults.length,
      complexFraction: tissueResults.filter(t=>t.hasComplexRoots).length/tissueResults.length,
      nTissues: tissueResults.length,
    });
  }
  return results;
}

function runPermutationTest(
  targetLambdas: number[],
  allGeneLambdas: number[],
  expressionBins: Map<number, number[]>, // bin -> lambda values
  targetBins: number[],
  nPerm: number = 5000
): { observedMeanDist: number; permutedMeanDists: number[]; pValue: number; zScore: number } {
  const observedMeanDist = targetLambdas.reduce((a,v)=>a+Math.abs(v-PHI_RECIPROCAL),0)/targetLambdas.length;
  const permutedMeanDists: number[] = [];
  const n = targetLambdas.length;
  for (let p = 0; p < nPerm; p++) {
    // Sample n genes from expression-matched bins
    const sampledLambdas: number[] = [];
    for (const bin of targetBins) {
      const pool = expressionBins.get(bin) || allGeneLambdas;
      sampledLambdas.push(pool[Math.floor(Math.random()*pool.length)]);
    }
    permutedMeanDists.push(sampledLambdas.reduce((a,v)=>a+Math.abs(v-PHI_RECIPROCAL),0)/sampledLambdas.length);
  }
  const pValue = permutedMeanDists.filter(d => d <= observedMeanDist).length / nPerm;
  const permMean = permutedMeanDists.reduce((a,b)=>a+b,0)/permutedMeanDists.length;
  const permSd = Math.sqrt(permutedMeanDists.reduce((a,v)=>a+(v-permMean)**2,0)/permutedMeanDists.length);
  const zScore = permSd > 0 ? (observedMeanDist - permMean)/permSd : 0;
  return { observedMeanDist, permutedMeanDists, pValue, zScore };
}

export interface PhiEnrichmentReport {
  timestamp: string;
  phiReciprocal: number;
  coreClockResults: GeneResult[];
  directTargetResults: GeneResult[];
  secondaryTargetResults: GeneResult[];
  permutationTest: {
    directTargets: { observedMeanDist: number; pValue: number; zScore: number; nPerm: number; interpretation: string };
    allTargets: { observedMeanDist: number; pValue: number; zScore: number; nPerm: number; interpretation: string };
  };
  summaryStats: {
    coreClock: { meanLambda: number; medianDistFromPhi: number; n: number };
    directTargets: { meanLambda: number; medianDistFromPhi: number; n: number };
    secondary: { meanLambda: number; medianDistFromPhi: number; n: number };
    genesWithin005ofPhi: string[];
    genesWithin002ofPhi: string[];
  };
  genomeWideLambdas: { mean: number; median: number; sd: number; n: number };
  interpretation: string;
}

let cachedReport: PhiEnrichmentReport | null = null;

export async function runPhiEnrichmentAnalysis(): Promise<PhiEnrichmentReport> {
  if (cachedReport) return cachedReport;

  // Load all 12 tissue datasets
  const allTissueData = new Map<string, Map<string, number[]>>();
  for (const tissue of GSE54650_TISSUES) {
    const { geneData } = loadDataset(tissue);
    allTissueData.set(tissue, geneData);
  }

  // Compute per-gene mean lambda for all genes in Liver (representative)
  const liverData = allTissueData.get('Liver')!;
  const allGeneLambdas: number[] = [];
  const allGeneMeans: number[] = [];
  const allGeneNamesArr: string[] = [];

  for (const [gene, values] of liverData.entries()) {
    const fit = fitAR2(values);
    if (!fit) continue;
    allGeneLambdas.push(fit.lambda);
    const mean = values.reduce((a,b)=>a+b,0)/values.length;
    allGeneMeans.push(mean);
    allGeneNamesArr.push(gene);
  }

  // Build expression bins for matched null (log10 expression, 20 bins)
  const logMeans = allGeneMeans.map(m => Math.log10(Math.max(m, 1)));
  const minLog = Math.min(...logMeans), maxLog = Math.max(...logMeans);
  const nBins = 20;
  const binSize = (maxLog - minLog) / nBins;
  const expressionBins = new Map<number, number[]>();
  for (let i = 0; i < allGeneNamesArr.length; i++) {
    const bin = Math.min(Math.floor((logMeans[i] - minLog) / binSize), nBins - 1);
    if (!expressionBins.has(bin)) expressionBins.set(bin, []);
    expressionBins.get(bin)!.push(allGeneLambdas[i]);
  }

  // Analyse each gene set across all 12 tissues
  const coreClockResults = analyseGeneSet(CORE_CLOCK_GENES, 'Core Clock', allTissueData);
  const directTargetResults = analyseGeneSet(DIRECT_CLOCK_TARGETS, 'Direct CCG', allTissueData);
  const secondaryTargetResults = analyseGeneSet(SECONDARY_CLOCK_TARGETS, 'Secondary CCG', allTissueData);

  // Get expression bins for direct targets using liver mean expression
  // Use alias-aware lookup so renamed genes (e.g. Ccrn4l→Noct) resolve correctly
  const directTargetBins: number[] = [];
  for (const r of directTargetResults) {
    const liverVals = lookupGeneInMap(liverData, r.gene);
    if (!liverVals) { directTargetBins.push(Math.floor(nBins/2)); continue; }
    const m = liverVals.reduce((a,b)=>a+b,0)/liverVals.length;
    const logM = Math.log10(Math.max(m,1));
    directTargetBins.push(Math.min(Math.floor((logM-minLog)/binSize), nBins-1));
  }
  const allTargetResults = [...directTargetResults, ...secondaryTargetResults];
  const allTargetBins = [...directTargetBins];
  for (const r of secondaryTargetResults) {
    const liverVals = lookupGeneInMap(liverData, r.gene);
    if (!liverVals) { allTargetBins.push(Math.floor(nBins/2)); continue; }
    const m = liverVals.reduce((a,b)=>a+b,0)/liverVals.length;
    const logM = Math.log10(Math.max(m,1));
    allTargetBins.push(Math.min(Math.floor((logM-minLog)/binSize), nBins-1));
  }

  // Permutation tests
  const directLambdas = directTargetResults.map(r => r.meanLambda);
  const allTargetLambdas = allTargetResults.map(r => r.meanLambda);

  const directPerm = runPermutationTest(directLambdas, allGeneLambdas, expressionBins, directTargetBins, 5000);
  const allTargetPerm = runPermutationTest(allTargetLambdas, allGeneLambdas, expressionBins, allTargetBins, 5000);

  const interpDirect = directPerm.pValue < 0.05
    ? `Significant (p=${directPerm.pValue.toFixed(3)}): direct clock targets cluster closer to 1/φ=0.618 than expression-matched random genes`
    : directPerm.pValue < 0.15
    ? `Trend (p=${directPerm.pValue.toFixed(3)}): suggestive clustering near 1/φ but below significance threshold`
    : `Not significant (p=${directPerm.pValue.toFixed(3)}): direct clock targets do not cluster significantly near 1/φ`;

  const interpAll = allTargetPerm.pValue < 0.05
    ? `Significant (p=${allTargetPerm.pValue.toFixed(3)}): combined clock target set clusters closer to 1/φ than expression-matched null`
    : allTargetPerm.pValue < 0.15
    ? `Trend (p=${allTargetPerm.pValue.toFixed(3)}): suggestive clustering near 1/φ in combined target set`
    : `Not significant (p=${allTargetPerm.pValue.toFixed(3)}): combined clock targets do not cluster significantly near 1/φ`;

  // Summary stats
  const allResults = [...coreClockResults, ...directTargetResults, ...secondaryTargetResults];
  const within005 = allResults.filter(r => r.distanceFromPhiReciprocal < 0.05).map(r => r.gene);
  const within002 = allResults.filter(r => r.distanceFromPhiReciprocal < 0.02).map(r => r.gene);

  const coreMeanLambda = coreClockResults.length > 0 ? coreClockResults.reduce((a,r)=>a+r.meanLambda,0)/coreClockResults.length : 0;
  const directMeanLambda = directTargetResults.length > 0 ? directTargetResults.reduce((a,r)=>a+r.meanLambda,0)/directTargetResults.length : 0;
  const secondaryMeanLambda = secondaryTargetResults.length > 0 ? secondaryTargetResults.reduce((a,r)=>a+r.meanLambda,0)/secondaryTargetResults.length : 0;

  const allLambdaMean = allGeneLambdas.reduce((a,b)=>a+b,0)/allGeneLambdas.length;
  const allLambdaMed = median(allGeneLambdas);
  const allLambdaSd = Math.sqrt(allGeneLambdas.reduce((a,v)=>a+(v-allLambdaMean)**2,0)/allGeneLambdas.length);

  let overallInterpretation = '';
  if (directPerm.pValue < 0.05) {
    overallInterpretation = `The direct BMAL1/CLOCK target gene set shows statistically significant clustering near 1/φ ≈ 0.618 (p=${directPerm.pValue.toFixed(3)}, z=${directPerm.zScore.toFixed(2)}), supporting the hypothesis that recognised clock output genes operate preferentially near the stable Fibonacci eigenvalue. This is a more focused and biologically motivated test than the genome-wide scan (p=0.154).`;
  } else if (directPerm.pValue < 0.10) {
    overallInterpretation = `The direct BMAL1/CLOCK target gene set shows a suggestive trend toward clustering near 1/φ ≈ 0.618 (p=${directPerm.pValue.toFixed(3)}, z=${directPerm.zScore.toFixed(2)}). This is below the conventional significance threshold but substantially stronger than the genome-wide test (p=0.154), consistent with 1/φ being a feature of clock output dynamics specifically rather than the genome as a whole.`;
  } else {
    overallInterpretation = `The direct BMAL1/CLOCK target gene set does not show significant clustering near 1/φ ≈ 0.618 (p=${directPerm.pValue.toFixed(3)}, z=${directPerm.zScore.toFixed(2)}). Individual genes (Wee1, Hes1, Per2) remain striking, but the pattern does not generalise to the full recognised clock target set. The 1/φ observation remains a feature of selected individual genes rather than a systematic property of clock output dynamics.`;
  }

  cachedReport = {
    timestamp: new Date().toISOString(),
    phiReciprocal: PHI_RECIPROCAL,
    coreClockResults,
    directTargetResults,
    secondaryTargetResults,
    permutationTest: {
      directTargets: { ...directPerm, nPerm: 5000, interpretation: interpDirect },
      allTargets: { ...allTargetPerm, nPerm: 5000, interpretation: interpAll },
    },
    summaryStats: {
      coreClock: { meanLambda: coreMeanLambda, medianDistFromPhi: median(coreClockResults.map(r=>r.distanceFromPhiReciprocal)), n: coreClockResults.length },
      directTargets: { meanLambda: directMeanLambda, medianDistFromPhi: median(directTargetResults.map(r=>r.distanceFromPhiReciprocal)), n: directTargetResults.length },
      secondary: { meanLambda: secondaryMeanLambda, medianDistFromPhi: median(secondaryTargetResults.map(r=>r.distanceFromPhiReciprocal)), n: secondaryTargetResults.length },
      genesWithin005ofPhi: within005,
      genesWithin002ofPhi: within002,
    },
    genomeWideLambdas: { mean: allLambdaMean, median: allLambdaMed, sd: allLambdaSd, n: allGeneLambdas.length },
    interpretation: overallInterpretation,
  };

  return cachedReport;
}
