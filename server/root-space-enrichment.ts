import {
  GO_BIOLOGICAL_PROCESS,
  KEGG_PATHWAYS,
  DYNAMICAL_PREDICTIONS,
  resolveToHuman,
  speciesGeneMap,
} from './data/annotations/gene_annotations';

export interface GeneRootSpaceEntry {
  gene: string;
  beta1: number;
  beta2: number;
  eigenvalue: number;
  rootR: number;
  rootTheta: number;
  x: number;
  y: number;
  stable: boolean;
}

export interface CategoryClusterResult {
  category: string;
  annotationSource: string;
  nGenesInCategory: number;
  nGenesMatched: number;
  meanBeta1: number;
  meanBeta2: number;
  meanEigenvalue: number;
  sdBeta1: number;
  sdBeta2: number;
  withinCategoryDistance: number;
  expectedDistance: number;
  clusteringRatio: number;
  permutationP: number;
  significant: boolean;
  dominantPole: string;
  genes: string[];
}

export interface RegionalEnrichmentCell {
  gridRow: number;
  gridCol: number;
  beta1Center: number;
  beta2Center: number;
  totalGenes: number;
  categoryGenes: number;
  enrichmentRatio: number;
  pValue: number;
}

export interface VoidAnalysis {
  totalGenes: number;
  voidGenes: number;
  voidFraction: number;
  strongOscillationGenes: number;
  strongOscillationFraction: number;
  realRootGenes: number;
  realRootFraction: number;
  transitionZoneGenes: number;
  transitionZoneFraction: number;
  bimodalityIndex: number;
  voidPersistsGenomeWide: boolean;
}

export interface EnrichmentResult {
  datasetId: string;
  totalGenesAnalyzed: number;
  annotationSource: string;
  categoriesTestedTotal: number;
  categoriesWithData: number;
  significantCategories: number;
  categoryResults: CategoryClusterResult[];
  voidAnalysis: VoidAnalysis;
  topClusteredCategories: CategoryClusterResult[];
  poleEnrichment: PoleEnrichmentResult[];
  summary: string;
  timestamp: string;
}

export interface PoleEnrichmentResult {
  pole: string;
  poleDescription: string;
  beta1Range: [number, number];
  beta2Range: [number, number];
  totalGenesInRegion: number;
  topCategories: { category: string; count: number; enrichment: number; pValue: number }[];
}

function computeMeanPairwiseDistance(points: { beta1: number; beta2: number }[]): number {
  if (points.length < 2) return 0;
  let totalDist = 0;
  let count = 0;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const d = Math.sqrt(
        (points[i].beta1 - points[j].beta1) ** 2 +
        (points[i].beta2 - points[j].beta2) ** 2
      );
      totalDist += d;
      count++;
    }
  }
  return count > 0 ? totalDist / count : 0;
}

function computeMeanPairwiseDistanceSampled(points: { beta1: number; beta2: number }[], maxPairs: number = 2000): number {
  if (points.length < 2) return 0;
  const totalPossible = (points.length * (points.length - 1)) / 2;
  if (totalPossible <= maxPairs) {
    return computeMeanPairwiseDistance(points);
  }
  let totalDist = 0;
  for (let k = 0; k < maxPairs; k++) {
    const i = Math.floor(Math.random() * points.length);
    let j = Math.floor(Math.random() * (points.length - 1));
    if (j >= i) j++;
    const d = Math.sqrt(
      (points[i].beta1 - points[j].beta1) ** 2 +
      (points[i].beta2 - points[j].beta2) ** 2
    );
    totalDist += d;
  }
  return totalDist / maxPairs;
}

function sampleRandomSubset<T>(arr: T[], n: number): T[] {
  if (n >= arr.length) return [...arr];
  const result: T[] = [];
  const used = new Array(arr.length).fill(false);
  let count = 0;
  while (count < n) {
    const idx = Math.floor(Math.random() * arr.length);
    if (!used[idx]) {
      used[idx] = true;
      result.push(arr[idx]);
      count++;
    }
  }
  return result;
}

function classifyDominantPole(meanBeta1: number, meanBeta2: number): string {
  const distSelfReinforcing = Math.sqrt((meanBeta1 - 2) ** 2 + (meanBeta2 - (-1)) ** 2);
  const distAlternating = Math.sqrt((meanBeta1 - (-2)) ** 2 + (meanBeta2 - (-1)) ** 2);
  const distOscillatory = Math.sqrt((meanBeta1 - 0) ** 2 + (meanBeta2 - 1) ** 2);
  const distCenter = Math.sqrt(meanBeta1 ** 2 + meanBeta2 ** 2);

  const minDist = Math.min(distSelfReinforcing, distAlternating, distOscillatory, distCenter);

  if (minDist === distCenter && distCenter < 0.5) return 'center (memoryless)';
  if (minDist === distSelfReinforcing) return 'self-reinforcing';
  if (minDist === distAlternating) return 'alternating (toggle)';
  if (minDist === distOscillatory) return 'oscillatory';
  return 'intermediate';
}

function buildAnnotationLookup(categoryGenes: string[]): Set<string> {
  const lookup = new Set<string>();
  for (const g of categoryGenes) {
    lookup.add(g.toUpperCase());
    lookup.add(resolveToHuman(g).toUpperCase());
    const mouseVer = speciesGeneMap('mouse', g);
    lookup.add(mouseVer.toUpperCase());
  }
  return lookup;
}

function matchGeneToAnnotationSet(
  geneSymbol: string,
  lookupSet: Set<string>
): boolean {
  if (lookupSet.has(geneSymbol.toUpperCase())) return true;
  if (lookupSet.has(resolveToHuman(geneSymbol).toUpperCase())) return true;
  return false;
}

export function runCategoryClusteringTest(
  allGenes: GeneRootSpaceEntry[],
  categoryName: string,
  categoryGeneList: string[],
  annotationSource: string,
  species: string = 'mouse',
  nPermutations: number = 1000
): CategoryClusterResult | null {
  const lookupSet = buildAnnotationLookup(categoryGeneList);
  const matchedGenes = allGenes.filter(g => matchGeneToAnnotationSet(g.gene, lookupSet));

  if (matchedGenes.length < 5) return null;

  const withinDist = computeMeanPairwiseDistanceSampled(matchedGenes);
  const globalSubsample = allGenes.length > 5000 ? sampleRandomSubset(allGenes, 5000) : allGenes;
  const globalDist = computeMeanPairwiseDistanceSampled(globalSubsample);

  const effectivePerms = Math.min(nPermutations, allGenes.length > 30000 ? 200 : nPermutations);
  let exceedCount = 0;
  for (let p = 0; p < effectivePerms; p++) {
    const randomSubset = sampleRandomSubset(globalSubsample, matchedGenes.length);
    const randomDist = computeMeanPairwiseDistanceSampled(randomSubset);
    if (randomDist <= withinDist) exceedCount++;
  }
  const pValue = (exceedCount + 1) / (effectivePerms + 1);

  const meanBeta1 = matchedGenes.reduce((s, g) => s + g.beta1, 0) / matchedGenes.length;
  const meanBeta2 = matchedGenes.reduce((s, g) => s + g.beta2, 0) / matchedGenes.length;
  const meanEig = matchedGenes.reduce((s, g) => s + g.eigenvalue, 0) / matchedGenes.length;
  const sdBeta1 = Math.sqrt(matchedGenes.reduce((s, g) => s + (g.beta1 - meanBeta1) ** 2, 0) / matchedGenes.length);
  const sdBeta2 = Math.sqrt(matchedGenes.reduce((s, g) => s + (g.beta2 - meanBeta2) ** 2, 0) / matchedGenes.length);

  return {
    category: categoryName,
    annotationSource,
    nGenesInCategory: categoryGeneList.length,
    nGenesMatched: matchedGenes.length,
    meanBeta1: +meanBeta1.toFixed(4),
    meanBeta2: +meanBeta2.toFixed(4),
    meanEigenvalue: +meanEig.toFixed(4),
    sdBeta1: +sdBeta1.toFixed(4),
    sdBeta2: +sdBeta2.toFixed(4),
    withinCategoryDistance: +withinDist.toFixed(4),
    expectedDistance: +globalDist.toFixed(4),
    clusteringRatio: +(withinDist / Math.max(globalDist, 0.001)).toFixed(4),
    permutationP: +pValue.toFixed(4),
    significant: pValue < 0.05,
    dominantPole: classifyDominantPole(meanBeta1, meanBeta2),
    genes: matchedGenes.map(g => g.gene),
  };
}

export function runVoidAnalysis(allGenes: GeneRootSpaceEntry[]): VoidAnalysis {
  let realRootGenes = 0;
  let strongOscillation = 0;
  let transitionZone = 0;
  let voidGenes = 0;

  for (const g of allGenes) {
    const disc = g.beta1 * g.beta1 + 4 * g.beta2;
    if (disc >= 0) {
      realRootGenes++;
    } else {
      const imagPart = Math.sqrt(-disc) / 2;
      const realPart = g.beta1 / 2;
      const modulus = Math.sqrt(realPart * realPart + imagPart * imagPart);
      const theta = Math.atan2(imagPart, realPart);
      const normalizedTheta = theta / Math.PI;

      if (normalizedTheta >= 0.5) {
        strongOscillation++;
      } else if (normalizedTheta < 0.2 && normalizedTheta > 0.001) {
        transitionZone++;
        voidGenes++;
      } else if (normalizedTheta >= 0.2) {
        strongOscillation++;
      }
    }
  }

  const total = allGenes.length;
  const bimodalityIndex = total > 0
    ? (realRootGenes / total + strongOscillation / total) / Math.max(transitionZone / total, 0.01)
    : 0;

  return {
    totalGenes: total,
    voidGenes: transitionZone,
    voidFraction: +(transitionZone / Math.max(total, 1)).toFixed(4),
    strongOscillationGenes: strongOscillation,
    strongOscillationFraction: +(strongOscillation / Math.max(total, 1)).toFixed(4),
    realRootGenes,
    realRootFraction: +(realRootGenes / Math.max(total, 1)).toFixed(4),
    transitionZoneGenes: transitionZone,
    transitionZoneFraction: +(transitionZone / Math.max(total, 1)).toFixed(4),
    bimodalityIndex: +bimodalityIndex.toFixed(2),
    voidPersistsGenomeWide: transitionZone / Math.max(total, 1) < 0.10,
  };
}

export function runPoleEnrichment(
  allGenes: GeneRootSpaceEntry[],
  annotations: Record<string, string[]>,
  species: string = 'mouse',
  nPermutations: number = 500
): PoleEnrichmentResult[] {
  const poles = [
    {
      pole: 'self-reinforcing',
      poleDescription: 'Positive feedback / momentum (β₁ > 0.3, β₂ < 0, or high |λ| with β₁ > 0)',
      filter: (g: GeneRootSpaceEntry) => g.beta1 > 0.3 && g.eigenvalue > 0.7,
      beta1Range: [0.3, 2.0] as [number, number],
      beta2Range: [-1.0, 1.0] as [number, number],
    },
    {
      pole: 'alternating',
      poleDescription: 'Toggle switch / bistable (β₁ < -0.2)',
      filter: (g: GeneRootSpaceEntry) => g.beta1 < -0.2,
      beta1Range: [-2.0, -0.2] as [number, number],
      beta2Range: [-1.0, 1.0] as [number, number],
    },
    {
      pole: 'oscillatory',
      poleDescription: 'Sustained oscillation (β₂ > 0.4, |β₁| < 0.3)',
      filter: (g: GeneRootSpaceEntry) => g.beta2 > 0.4 && Math.abs(g.beta1) < 0.3,
      beta1Range: [-0.3, 0.3] as [number, number],
      beta2Range: [0.4, 1.0] as [number, number],
    },
    {
      pole: 'center',
      poleDescription: 'Low memory / memoryless (|λ| < 0.3)',
      filter: (g: GeneRootSpaceEntry) => g.eigenvalue < 0.3,
      beta1Range: [-0.5, 0.5] as [number, number],
      beta2Range: [-0.3, 0.3] as [number, number],
    },
  ];

  return poles.map(poledef => {
    const genesInRegion = allGenes.filter(poledef.filter);
    const regionGeneNames = new Set(genesInRegion.map(g => resolveToHuman(g.gene)));

    const categoryEnrichments: { category: string; count: number; enrichment: number; pValue: number }[] = [];
    const allGeneNamesUpper = new Set(allGenes.map(g => g.gene.toUpperCase()));
    const allGeneNamesHuman = new Set(allGenes.map(g => resolveToHuman(g.gene)));

    for (const [catName, catGenes] of Object.entries(annotations)) {
      const matchedInRegion = catGenes.filter(cg => regionGeneNames.has(cg) || regionGeneNames.has(resolveToHuman(cg)));
      if (matchedInRegion.length < 2) continue;

      const totalAnnotated = catGenes.filter(cg => {
        return allGeneNamesUpper.has(cg.toUpperCase()) || allGeneNamesHuman.has(resolveToHuman(cg));
      }).length;

      if (totalAnnotated < 3) continue;

      const expectedFraction = genesInRegion.length / Math.max(allGenes.length, 1);
      const observedFraction = matchedInRegion.length / Math.max(totalAnnotated, 1);
      const enrichment = observedFraction / Math.max(expectedFraction, 0.001);

      let exceedCount = 0;
      for (let p = 0; p < nPermutations; p++) {
        const randomRegion = sampleRandomSubset(allGenes, genesInRegion.length);
        const randomNames = new Set(randomRegion.map(g => resolveToHuman(g.gene)));
        const randomMatched = catGenes.filter(cg => randomNames.has(cg) || randomNames.has(resolveToHuman(cg))).length;
        if (randomMatched >= matchedInRegion.length) exceedCount++;
      }
      const pValue = (exceedCount + 1) / (nPermutations + 1);

      categoryEnrichments.push({
        category: catName,
        count: matchedInRegion.length,
        enrichment: +enrichment.toFixed(2),
        pValue: +pValue.toFixed(4),
      });
    }

    categoryEnrichments.sort((a, b) => a.pValue - b.pValue);

    return {
      pole: poledef.pole,
      poleDescription: poledef.poleDescription,
      beta1Range: poledef.beta1Range,
      beta2Range: poledef.beta2Range,
      totalGenesInRegion: genesInRegion.length,
      topCategories: categoryEnrichments.slice(0, 10),
    };
  });
}

export function runFullEnrichmentAnalysis(
  allGenes: GeneRootSpaceEntry[],
  datasetId: string,
  species: string = 'mouse',
  annotationSource: 'GO' | 'KEGG' | 'DYNAMICAL' | 'ALL' = 'ALL',
  nPermutations: number = 1000
): EnrichmentResult {
  const annotations: Record<string, Record<string, string[]>> = {};
  if (annotationSource === 'GO' || annotationSource === 'ALL') {
    annotations['GO_BP'] = GO_BIOLOGICAL_PROCESS;
  }
  if (annotationSource === 'KEGG' || annotationSource === 'ALL') {
    annotations['KEGG'] = KEGG_PATHWAYS;
  }
  if (annotationSource === 'DYNAMICAL' || annotationSource === 'ALL') {
    annotations['DYNAMICAL'] = DYNAMICAL_PREDICTIONS;
  }

  const categoryResults: CategoryClusterResult[] = [];
  let totalTested = 0;

  for (const [source, cats] of Object.entries(annotations)) {
    for (const [catName, catGenes] of Object.entries(cats)) {
      totalTested++;
      const result = runCategoryClusteringTest(
        allGenes,
        catName,
        catGenes,
        source,
        species,
        nPermutations
      );
      if (result) {
        categoryResults.push(result);
      }
    }
  }

  categoryResults.sort((a, b) => a.permutationP - b.permutationP);

  const significantCount = categoryResults.filter(r => r.significant).length;
  const bonferroniThreshold = 0.05 / Math.max(categoryResults.length, 1);
  const bonferroniSig = categoryResults.filter(r => r.permutationP < bonferroniThreshold).length;

  const voidAnalysis = runVoidAnalysis(allGenes);

  const allAnnotations: Record<string, string[]> = {};
  for (const cats of Object.values(annotations)) {
    Object.assign(allAnnotations, cats);
  }
  const poleEnrichment = runPoleEnrichment(allGenes, allAnnotations, species, Math.min(nPermutations, 500));

  const clusteringCategories = categoryResults
    .filter(r => r.clusteringRatio < 0.95)
    .sort((a, b) => a.clusteringRatio - b.clusteringRatio);

  const effectivePermsUsed = allGenes.length > 30000 ? Math.min(nPermutations, 200) : nPermutations;
  let summary = `Genome-wide root-space enrichment analysis of ${allGenes.length} genes.\n`;
  summary += `${categoryResults.length} categories tested (${totalTested} total, ${totalTested - categoryResults.length} had <5 genes matched).\n`;
  summary += `Permutations: ${effectivePermsUsed} per category${allGenes.length > 5000 ? ` (global reference subsampled to 5,000 genes)` : ''}.\n`;
  summary += `${significantCount} categories show significant spatial clustering (p < 0.05, permutation test).\n`;
  summary += `${bonferroniSig} survive Bonferroni correction (α = ${bonferroniThreshold.toFixed(5)}).\n`;
  summary += `Void analysis: ${voidAnalysis.voidPersistsGenomeWide ? 'VOID PERSISTS' : 'void not confirmed'} genome-wide `;
  summary += `(transition zone: ${(voidAnalysis.transitionZoneFraction * 100).toFixed(1)}% of genes).\n`;

  if (clusteringCategories.length > 0) {
    summary += `\nMost tightly clustered categories:\n`;
    for (const c of clusteringCategories.slice(0, 5)) {
      summary += `  - ${c.category}: clustering ratio ${c.clusteringRatio} (p=${c.permutationP}), dominant pole: ${c.dominantPole}\n`;
    }
  }

  const sigPoles = poleEnrichment.filter(p => p.topCategories.some(c => c.pValue < 0.05));
  if (sigPoles.length > 0) {
    summary += `\nPole enrichment findings:\n`;
    for (const pole of sigPoles) {
      const sigCats = pole.topCategories.filter(c => c.pValue < 0.05);
      if (sigCats.length > 0) {
        summary += `  ${pole.pole} pole (${pole.totalGenesInRegion} genes): `;
        summary += sigCats.map(c => `${c.category} (${c.enrichment}×, p=${c.pValue})`).join(', ');
        summary += '\n';
      }
    }
  }

  return {
    datasetId,
    totalGenesAnalyzed: allGenes.length,
    annotationSource,
    categoriesTestedTotal: totalTested,
    categoriesWithData: categoryResults.length,
    significantCategories: significantCount,
    categoryResults,
    voidAnalysis,
    topClusteredCategories: clusteringCategories.slice(0, 10),
    poleEnrichment,
    summary,
    timestamp: new Date().toISOString(),
  };
}
