import * as fs from 'fs';
import * as path from 'path';
import { ENSEMBL_TO_SYMBOL, classifyGene, type GeneCategory } from './gene-categories';

const CLOCK_CORE = ['Bmal1', 'Clock', 'Per1', 'Per2', 'Per3', 'Cry1', 'Cry2', 'Nr1d1', 'Nr1d2', 'Dbp', 'Tef', 'Hlf', 'Rora', 'Rorc', 'Npas2'];
const TARGET_CORE = ['Wee1', 'Myc', 'Ccnd1', 'Ccnb1', 'Cdk1', 'Top2a', 'Mki67', 'Cdkn1a'];

function fitAR2(series: number[]): { phi1: number; phi2: number; eigenvalue: number; r2: number } {
  const n = series.length;
  if (n < 5) return { phi1: 0, phi2: 0, eigenvalue: 0, r2: 0 };
  const mean = series.reduce((a, b) => a + b, 0) / n;
  const y = series.map(x => x - mean);
  const Y = y.slice(2);
  const Y1 = y.slice(1, n - 1);
  const Y2 = y.slice(0, n - 2);
  let sumY1Y1 = 0, sumY2Y2 = 0, sumY1Y2 = 0, sumYY1 = 0, sumYY2 = 0;
  for (let i = 0; i < Y.length; i++) {
    sumY1Y1 += Y1[i] * Y1[i];
    sumY2Y2 += Y2[i] * Y2[i];
    sumY1Y2 += Y1[i] * Y2[i];
    sumYY1 += Y[i] * Y1[i];
    sumYY2 += Y[i] * Y2[i];
  }
  const det = sumY1Y1 * sumY2Y2 - sumY1Y2 * sumY1Y2;
  if (Math.abs(det) < 1e-15) return { phi1: 0, phi2: 0, eigenvalue: 0, r2: 0 };
  const phi1 = (sumYY1 * sumY2Y2 - sumYY2 * sumY1Y2) / det;
  const phi2 = (sumYY2 * sumY1Y1 - sumYY1 * sumY1Y2) / det;
  const disc = phi1 * phi1 + 4 * phi2;
  let eigenvalue: number;
  if (disc >= 0) {
    const l1 = (phi1 + Math.sqrt(disc)) / 2;
    const l2 = (phi1 - Math.sqrt(disc)) / 2;
    eigenvalue = Math.max(Math.abs(l1), Math.abs(l2));
  } else {
    eigenvalue = Math.sqrt(-phi2);
  }
  const ssRes = Y.reduce((s, yi, i) => s + (yi - phi1 * Y1[i] - phi2 * Y2[i]) ** 2, 0);
  const meanY = Y.reduce((a, b) => a + b, 0) / Y.length;
  const ssTot = Y.reduce((s, yi) => s + (yi - meanY) ** 2, 0);
  const r2 = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;
  return { phi1, phi2, eigenvalue, r2 };
}

function loadDatasetEigenvalues(filePath: string): Map<string, { eigenvalue: number; r2: number; category: string }> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  const results = new Map<string, { eigenvalue: number; r2: number; category: string }>();

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const rawGene = cols[0].trim().replace(/"/g, '');
    if (!rawGene) continue;
    const gene = ENSEMBL_TO_SYMBOL[rawGene] || rawGene;
    const values = cols.slice(1).map(v => parseFloat(v)).filter(v => !isNaN(v));
    if (values.length < 5) continue;

    const fit = fitAR2(values);
    if (fit.eigenvalue >= 1.5 || fit.eigenvalue <= 0) continue;

    const cat = classifyGene(gene);
    results.set(gene, { eigenvalue: fit.eigenvalue, r2: fit.r2, category: cat });
  }

  return results;
}

function mannWhitneyU(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0) return 1;
  const combined = [
    ...a.map(v => ({ v, group: 'a' })),
    ...b.map(v => ({ v, group: 'b' }))
  ].sort((x, y) => x.v - y.v);

  let sumRankA = 0;
  for (let i = 0; i < combined.length; i++) {
    if (combined[i].group === 'a') sumRankA += (i + 1);
  }

  const n1 = a.length;
  const n2 = b.length;
  const U = sumRankA - n1 * (n1 + 1) / 2;
  const mu = n1 * n2 / 2;
  const sigma = Math.sqrt(n1 * n2 * (n1 + n2 + 1) / 12);
  if (sigma === 0) return 1;
  const z = Math.abs((U - mu) / sigma);
  const p = 2 * (1 - normalCDF(z));
  return Math.max(p, 1e-10);
}

function normalCDF(z: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = z < 0 ? -1 : 1;
  z = Math.abs(z) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * z);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);
  return 0.5 * (1.0 + sign * y);
}

function mean(arr: number[]): number {
  return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function std(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
}

function cohensD(a: number[], b: number[]): number {
  const pooledStd = Math.sqrt(((a.length - 1) * std(a) ** 2 + (b.length - 1) * std(b) ** 2) / (a.length + b.length - 2));
  return pooledStd > 0 ? (mean(a) - mean(b)) / pooledStd : 0;
}

async function main() {
  console.log("=".repeat(90));
  console.log("SPATIAL-TEMPORAL COUPLING ANALYSIS");
  console.log("Three tests for how spatial and temporal organization connect in the AR(2) framework");
  console.log("=".repeat(90));

  // =========================================================================
  // TEST 1: Perturbation-Induced Spatial-Temporal Coupling
  // ApcKO = spatial disruption, BmalKO = temporal disruption
  // =========================================================================
  console.log("\n" + "█".repeat(90));
  console.log("TEST 1: PERTURBATION-INDUCED SPATIAL-TEMPORAL COUPLING");
  console.log("ApcKO disrupts spatial organization (crypt-villus axis collapses)");
  console.log("BmalKO disrupts temporal organization (circadian clock abolished)");
  console.log("If spatial and temporal are coupled, disrupting one should affect the other's eigenvalue signature");
  console.log("█".repeat(90));

  const organoidFiles = [
    { file: 'datasets/GSE157357_Organoid_WT-WT_circadian.csv', label: 'WT (healthy)', spatial: 'intact', temporal: 'intact' },
    { file: 'datasets/GSE157357_Organoid_ApcKO-WT_circadian.csv', label: 'ApcKO (spatial KO)', spatial: 'disrupted', temporal: 'intact' },
    { file: 'datasets/GSE157357_Organoid_WT-BmalKO_circadian.csv', label: 'BmalKO (temporal KO)', spatial: 'intact', temporal: 'disrupted' },
    { file: 'datasets/GSE157357_Organoid_ApcKO-BmalKO_circadian.csv', label: 'Double KO', spatial: 'disrupted', temporal: 'disrupted' },
  ];

  const organoidResults: { label: string; spatial: string; temporal: string;
    clockEig: number[]; targetEig: number[]; allEig: number[];
    meanClock: number; meanTarget: number; gap: number; hierarchyRate: number;
    complexFraction: number; meanR2: number;
  }[] = [];

  for (const ds of organoidFiles) {
    const fp = path.join(process.cwd(), ds.file);
    if (!fs.existsSync(fp)) continue;

    const eigenMap = loadDatasetEigenvalues(fp);
    const clockEig: number[] = [];
    const targetEig: number[] = [];
    const allEig: number[] = [];
    let complexCount = 0;
    let totalR2 = 0;

    const content = fs.readFileSync(fp, 'utf-8');
    const lines = content.trim().split('\n');
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      const rawGene = cols[0].trim().replace(/"/g, '');
      const gene = ENSEMBL_TO_SYMBOL[rawGene] || rawGene;
      const values = cols.slice(1).map(v => parseFloat(v)).filter(v => !isNaN(v));
      if (values.length < 5) continue;
      const fit = fitAR2(values);
      if (fit.eigenvalue >= 1.5 || fit.eigenvalue <= 0) continue;
      const disc = fit.phi1 * fit.phi1 + 4 * fit.phi2;
      if (disc < 0) complexCount++;
      totalR2 += fit.r2;

      allEig.push(fit.eigenvalue);

      const isClockUpper = gene.charAt(0).toUpperCase() + gene.slice(1).toLowerCase();
      const isClockExact = CLOCK_CORE.some(c => c.toLowerCase() === gene.toLowerCase());
      const isTargetExact = TARGET_CORE.some(t => t.toLowerCase() === gene.toLowerCase());

      if (isClockExact) clockEig.push(fit.eigenvalue);
      if (isTargetExact) targetEig.push(fit.eigenvalue);
    }

    const mc = mean(clockEig);
    const mt = mean(targetEig);
    const hierarchyRate = clockEig.length > 0 && targetEig.length > 0
      ? clockEig.filter(c => targetEig.some(t => c > t)).length / clockEig.length
      : 0;

    organoidResults.push({
      label: ds.label,
      spatial: ds.spatial,
      temporal: ds.temporal,
      clockEig, targetEig, allEig,
      meanClock: mc,
      meanTarget: mt,
      gap: mc - mt,
      hierarchyRate,
      complexFraction: allEig.length > 0 ? complexCount / allEig.length : 0,
      meanR2: allEig.length > 0 ? totalR2 / allEig.length : 0,
    });
  }

  console.log("\n  EIGENVALUE SUMMARY BY GENOTYPE:");
  console.log("  " + "─".repeat(86));
  console.log(`  ${'Genotype'.padEnd(25)} ${'Spatial'.padEnd(12)} ${'Temporal'.padEnd(12)} ${'Clock |λ|'.padStart(10)} ${'Target |λ|'.padStart(11)} ${'Gap'.padStart(8)} ${'Hier%'.padStart(7)} ${'Osc%'.padStart(7)}`);
  console.log("  " + "─".repeat(86));

  for (const r of organoidResults) {
    console.log(
      `  ${r.label.padEnd(25)} ${r.spatial.padEnd(12)} ${r.temporal.padEnd(12)} ${r.meanClock.toFixed(4).padStart(10)} ${r.meanTarget.toFixed(4).padStart(11)} ${r.gap.toFixed(4).padStart(8)} ${(r.hierarchyRate * 100).toFixed(0).padStart(6)}% ${(r.complexFraction * 100).toFixed(0).padStart(6)}%`
    );
  }

  const wt = organoidResults.find(r => r.label.includes('WT (healthy)'));
  const apcKO = organoidResults.find(r => r.label.includes('ApcKO'));
  const bmalKO = organoidResults.find(r => r.label.includes('BmalKO (temporal'));
  const dblKO = organoidResults.find(r => r.label.includes('Double'));

  console.log("\n  PERTURBATION EFFECTS ON EIGENVALUE DISTRIBUTION:");
  console.log("  " + "─".repeat(70));

  if (wt && apcKO) {
    const pAll = mannWhitneyU(wt.allEig, apcKO.allEig);
    const pClock = wt.clockEig.length > 2 && apcKO.clockEig.length > 2 ? mannWhitneyU(wt.clockEig, apcKO.clockEig) : NaN;
    const dAll = cohensD(wt.allEig, apcKO.allEig);
    console.log(`  ApcKO (spatial disruption) vs WT:`);
    console.log(`    All genes:   mean shift ${(mean(apcKO.allEig) - mean(wt.allEig)).toFixed(4)}, d=${dAll.toFixed(3)}, p=${pAll.toExponential(2)}`);
    console.log(`    Clock genes: ${isNaN(pClock) ? 'too few genes' : `shift ${(mean(apcKO.clockEig) - mean(wt.clockEig)).toFixed(4)}, p=${pClock.toExponential(2)}`}`);
    console.log(`    Gap change:  WT=${wt.gap.toFixed(4)} → ApcKO=${apcKO.gap.toFixed(4)} (${apcKO.gap > wt.gap ? 'WIDENED' : 'NARROWED'})`);
    console.log(`    Osc. change: WT=${(wt.complexFraction * 100).toFixed(1)}% → ApcKO=${(apcKO.complexFraction * 100).toFixed(1)}%`);
  }

  if (wt && bmalKO) {
    const pAll = mannWhitneyU(wt.allEig, bmalKO.allEig);
    const pClock = wt.clockEig.length > 2 && bmalKO.clockEig.length > 2 ? mannWhitneyU(wt.clockEig, bmalKO.clockEig) : NaN;
    const dAll = cohensD(wt.allEig, bmalKO.allEig);
    console.log(`\n  BmalKO (temporal disruption) vs WT:`);
    console.log(`    All genes:   mean shift ${(mean(bmalKO.allEig) - mean(wt.allEig)).toFixed(4)}, d=${dAll.toFixed(3)}, p=${pAll.toExponential(2)}`);
    console.log(`    Clock genes: ${isNaN(pClock) ? 'too few genes' : `shift ${(mean(bmalKO.clockEig) - mean(wt.clockEig)).toFixed(4)}, p=${pClock.toExponential(2)}`}`);
    console.log(`    Gap change:  WT=${wt.gap.toFixed(4)} → BmalKO=${bmalKO.gap.toFixed(4)} (${bmalKO.gap > wt.gap ? 'WIDENED' : 'NARROWED'})`);
    console.log(`    Osc. change: WT=${(wt.complexFraction * 100).toFixed(1)}% → BmalKO=${(bmalKO.complexFraction * 100).toFixed(1)}%`);
  }

  if (wt && dblKO) {
    const pAll = mannWhitneyU(wt.allEig, dblKO.allEig);
    const dAll = cohensD(wt.allEig, dblKO.allEig);
    console.log(`\n  Double KO (spatial + temporal) vs WT:`);
    console.log(`    All genes:   mean shift ${(mean(dblKO.allEig) - mean(wt.allEig)).toFixed(4)}, d=${dAll.toFixed(3)}, p=${pAll.toExponential(2)}`);
    console.log(`    Gap change:  WT=${wt.gap.toFixed(4)} → DblKO=${dblKO.gap.toFixed(4)} (${dblKO.gap > wt.gap ? 'WIDENED' : 'NARROWED'})`);
    console.log(`    Osc. change: WT=${(wt.complexFraction * 100).toFixed(1)}% → DblKO=${(dblKO.complexFraction * 100).toFixed(1)}%`);
  }

  if (apcKO && bmalKO) {
    const pApcBmal = mannWhitneyU(apcKO.allEig, bmalKO.allEig);
    const dApcBmal = cohensD(apcKO.allEig, bmalKO.allEig);
    console.log(`\n  ApcKO vs BmalKO (spatial vs temporal disruption, head-to-head):`);
    console.log(`    Mean eigenvalue: ApcKO=${mean(apcKO.allEig).toFixed(4)} vs BmalKO=${mean(bmalKO.allEig).toFixed(4)}`);
    console.log(`    d=${dApcBmal.toFixed(3)}, p=${pApcBmal.toExponential(2)}`);
    console.log(`    Gap: ApcKO=${apcKO.gap.toFixed(4)} vs BmalKO=${bmalKO.gap.toFixed(4)}`);
  }

  // Interaction test: is double KO = additive or synergistic?
  if (wt && apcKO && bmalKO && dblKO) {
    const apcEffect = mean(apcKO.allEig) - mean(wt.allEig);
    const bmalEffect = mean(bmalKO.allEig) - mean(wt.allEig);
    const expectedAdditive = mean(wt.allEig) + apcEffect + bmalEffect;
    const observedDouble = mean(dblKO.allEig);
    const interaction = observedDouble - expectedAdditive;

    console.log(`\n  INTERACTION ANALYSIS (is double KO additive or synergistic?):`);
    console.log(`    ApcKO effect on mean |λ|: ${apcEffect >= 0 ? '+' : ''}${apcEffect.toFixed(4)}`);
    console.log(`    BmalKO effect on mean |λ|: ${bmalEffect >= 0 ? '+' : ''}${bmalEffect.toFixed(4)}`);
    console.log(`    Expected additive double KO: ${expectedAdditive.toFixed(4)}`);
    console.log(`    Observed double KO:          ${observedDouble.toFixed(4)}`);
    console.log(`    Interaction term:            ${interaction >= 0 ? '+' : ''}${interaction.toFixed(4)}`);
    console.log(`    Interpretation: ${Math.abs(interaction) < 0.01 ? 'ADDITIVE (spatial & temporal act independently)' : interaction > 0 ? 'SYNERGISTIC (coupling: disrupting both is worse than sum of parts)' : 'ANTAGONISTIC (partial rescue: disrupting both partially compensates)'}`);

    const gapApcEffect = apcKO.gap - wt.gap;
    const gapBmalEffect = bmalKO.gap - wt.gap;
    const gapExpected = wt.gap + gapApcEffect + gapBmalEffect;
    const gapObserved = dblKO.gap;
    const gapInteraction = gapObserved - gapExpected;

    console.log(`\n    GAP interaction:`);
    console.log(`    ApcKO gap effect: ${gapApcEffect >= 0 ? '+' : ''}${gapApcEffect.toFixed(4)}`);
    console.log(`    BmalKO gap effect: ${gapBmalEffect >= 0 ? '+' : ''}${gapBmalEffect.toFixed(4)}`);
    console.log(`    Expected additive gap: ${gapExpected.toFixed(4)}`);
    console.log(`    Observed double KO gap: ${gapObserved.toFixed(4)}`);
    console.log(`    Gap interaction: ${gapInteraction >= 0 ? '+' : ''}${gapInteraction.toFixed(4)} → ${Math.abs(gapInteraction) < 0.005 ? 'ADDITIVE' : gapInteraction > 0 ? 'SYNERGISTIC' : 'ANTAGONISTIC'}`);
  }

  // =========================================================================
  // TEST 2: Cross-Tissue Eigenvalue Hierarchy vs Spatial Complexity
  // =========================================================================
  console.log("\n\n" + "█".repeat(90));
  console.log("TEST 2: CROSS-TISSUE EIGENVALUE HIERARCHY vs SPATIAL COMPLEXITY");
  console.log("Tissues with complex spatial architecture may show different hierarchy strengths");
  console.log("█".repeat(90));

  const tissueFiles = [
    { file: 'datasets/GSE54650_Liver_circadian.csv', label: 'Liver', spatialComplexity: 'high', reason: 'Lobular zonation (portal-central axis), hepatocyte gradients' },
    { file: 'datasets/GSE54650_Kidney_circadian.csv', label: 'Kidney', spatialComplexity: 'high', reason: 'Nephron architecture (cortex-medulla, tubule segments)' },
    { file: 'datasets/GSE54650_Heart_circadian.csv', label: 'Heart', spatialComplexity: 'medium', reason: 'Layered wall (endo/myo/epicardium), conduction system' },
    { file: 'datasets/GSE54650_Lung_circadian.csv', label: 'Lung', spatialComplexity: 'high', reason: 'Branching airways, alveolar architecture' },
    { file: 'datasets/GSE54650_Cerebellum_circadian.csv', label: 'Cerebellum', spatialComplexity: 'high', reason: 'Layered cortex (molecular, Purkinje, granular layers)' },
    { file: 'datasets/GSE54650_Hypothalamus_circadian.csv', label: 'Hypothalamus', spatialComplexity: 'high', reason: 'Distinct nuclei (SCN, PVN, etc.)' },
    { file: 'datasets/GSE54650_Brainstem_circadian.csv', label: 'Brainstem', spatialComplexity: 'medium', reason: 'Nuclei organization' },
    { file: 'datasets/GSE54650_Muscle_circadian.csv', label: 'Muscle', spatialComplexity: 'low', reason: 'Relatively homogeneous fiber bundles' },
    { file: 'datasets/GSE54650_Adrenal_circadian.csv', label: 'Adrenal', spatialComplexity: 'high', reason: 'Cortex zones (glomerulosa, fasciculata, reticularis) + medulla' },
    { file: 'datasets/GSE54650_Aorta_circadian.csv', label: 'Aorta', spatialComplexity: 'medium', reason: 'Layered wall (intima, media, adventitia)' },
    { file: 'datasets/GSE54650_Brown_Fat_circadian.csv', label: 'Brown Fat', spatialComplexity: 'low', reason: 'Relatively homogeneous adipocytes' },
    { file: 'datasets/GSE54650_White_Fat_circadian.csv', label: 'White Fat', spatialComplexity: 'low', reason: 'Relatively homogeneous adipocytes' },
  ];

  const tissueResults: { label: string; spatialComplexity: string; reason: string;
    meanClock: number; meanTarget: number; gap: number; hierarchyRate: number;
    clockCount: number; targetCount: number; totalGenes: number;
    complexFraction: number; pClockVsTarget: number;
  }[] = [];

  for (const t of tissueFiles) {
    const fp = path.join(process.cwd(), t.file);
    if (!fs.existsSync(fp)) {
      console.log(`  SKIPPED: ${t.label} (file not found)`);
      continue;
    }

    const content = fs.readFileSync(fp, 'utf-8');
    const lines = content.trim().split('\n');
    const clockEig: number[] = [];
    const targetEig: number[] = [];
    let complexCount = 0;
    let totalCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      const rawGene = cols[0].trim().replace(/"/g, '');
      if (!rawGene) continue;
      const gene = ENSEMBL_TO_SYMBOL[rawGene] || rawGene;
      const values = cols.slice(1).map(v => parseFloat(v)).filter(v => !isNaN(v));
      if (values.length < 5) continue;
      const fit = fitAR2(values);
      if (fit.eigenvalue >= 1.5 || fit.eigenvalue <= 0) continue;
      totalCount++;
      const disc = fit.phi1 * fit.phi1 + 4 * fit.phi2;
      if (disc < 0) complexCount++;
      const cat = classifyGene(gene);
      if (cat === 'clock') clockEig.push(fit.eigenvalue);
      else if (cat === 'target') targetEig.push(fit.eigenvalue);
    }

    const mc = mean(clockEig);
    const mt = mean(targetEig);
    const p = clockEig.length > 2 && targetEig.length > 2 ? mannWhitneyU(clockEig, targetEig) : 1;

    let hierarchyRate = 0;
    if (clockEig.length > 0 && targetEig.length > 0) {
      let wins = 0, total = 0;
      for (const c of clockEig) {
        for (const tg of targetEig) {
          total++;
          if (c > tg) wins++;
        }
      }
      hierarchyRate = total > 0 ? wins / total : 0;
    }

    tissueResults.push({
      label: t.label,
      spatialComplexity: t.spatialComplexity,
      reason: t.reason,
      meanClock: mc,
      meanTarget: mt,
      gap: mc - mt,
      hierarchyRate,
      clockCount: clockEig.length,
      targetCount: targetEig.length,
      totalGenes: totalCount,
      complexFraction: totalCount > 0 ? complexCount / totalCount : 0,
      pClockVsTarget: p,
    });
  }

  tissueResults.sort((a, b) => b.gap - a.gap);

  console.log("\n  TISSUE HIERARCHY RANKED BY GEARBOX GAP:");
  console.log("  " + "─".repeat(100));
  console.log(`  ${'Tissue'.padEnd(15)} ${'Spatial'.padEnd(10)} ${'Clock |λ|'.padStart(10)} ${'Target |λ|'.padStart(11)} ${'Gap'.padStart(8)} ${'Hier%'.padStart(7)} ${'p-value'.padStart(12)} ${'Osc%'.padStart(7)} ${'#Clock'.padStart(7)} ${'#Target'.padStart(8)}`);
  console.log("  " + "─".repeat(100));

  for (const r of tissueResults) {
    const sig = r.pClockVsTarget < 0.05 ? '*' : ' ';
    console.log(
      `  ${r.label.padEnd(15)} ${r.spatialComplexity.padEnd(10)} ${r.meanClock.toFixed(4).padStart(10)} ${r.meanTarget.toFixed(4).padStart(11)} ${r.gap.toFixed(4).padStart(8)} ${(r.hierarchyRate * 100).toFixed(0).padStart(6)}% ${r.pClockVsTarget.toExponential(2).padStart(11)}${sig} ${(r.complexFraction * 100).toFixed(0).padStart(6)}% ${r.clockCount.toString().padStart(7)} ${r.targetCount.toString().padStart(8)}`
    );
  }

  // Correlate spatial complexity with hierarchy metrics
  const complexityScore: Record<string, number> = { 'high': 3, 'medium': 2, 'low': 1 };
  const complexScores = tissueResults.map(r => complexityScore[r.spatialComplexity]);
  const gaps = tissueResults.map(r => r.gap);
  const oscFracs = tissueResults.map(r => r.complexFraction);

  function pearsonR(x: number[], y: number[]): number {
    const n = x.length;
    const mx = mean(x), my = mean(y);
    let num = 0, dx2 = 0, dy2 = 0;
    for (let i = 0; i < n; i++) {
      num += (x[i] - mx) * (y[i] - my);
      dx2 += (x[i] - mx) ** 2;
      dy2 += (y[i] - my) ** 2;
    }
    const den = Math.sqrt(dx2 * dy2);
    return den > 0 ? num / den : 0;
  }

  const rGapComplexity = pearsonR(complexScores, gaps);
  const rOscComplexity = pearsonR(complexScores, oscFracs);

  console.log(`\n  SPATIAL COMPLEXITY CORRELATION:`);
  console.log(`    Complexity vs Gearbox Gap:       r = ${rGapComplexity.toFixed(3)}`);
  console.log(`    Complexity vs Oscillatory Frac:   r = ${rOscComplexity.toFixed(3)}`);
  console.log(`    Interpretation: ${Math.abs(rGapComplexity) > 0.5 ? 'SUBSTANTIAL correlation — spatially complex tissues show ' + (rGapComplexity > 0 ? 'stronger' : 'weaker') + ' hierarchy' : Math.abs(rGapComplexity) > 0.3 ? 'MODERATE correlation' : 'WEAK/NO correlation — hierarchy strength appears independent of spatial complexity'}`);

  // Group comparison
  const highGaps = tissueResults.filter(r => r.spatialComplexity === 'high').map(r => r.gap);
  const lowGaps = tissueResults.filter(r => r.spatialComplexity === 'low').map(r => r.gap);
  const medGaps = tissueResults.filter(r => r.spatialComplexity === 'medium').map(r => r.gap);

  console.log(`\n  GROUP MEANS:`);
  console.log(`    High spatial complexity:  gap = ${mean(highGaps).toFixed(4)} ± ${std(highGaps).toFixed(4)} (n=${highGaps.length})`);
  console.log(`    Medium spatial complexity: gap = ${mean(medGaps).toFixed(4)} ± ${std(medGaps).toFixed(4)} (n=${medGaps.length})`);
  console.log(`    Low spatial complexity:   gap = ${mean(lowGaps).toFixed(4)} ± ${std(lowGaps).toFixed(4)} (n=${lowGaps.length})`);
  if (highGaps.length > 2 && lowGaps.length > 2) {
    const pHL = mannWhitneyU(highGaps, lowGaps);
    console.log(`    High vs Low p-value: ${pHL.toFixed(4)}`);
  }

  // =========================================================================
  // TEST 3: Per-Gene Spatial vs Temporal Eigenvalue Correlation
  // Using paired datasets: same genes, different disruption axes
  // =========================================================================
  console.log("\n\n" + "█".repeat(90));
  console.log("TEST 3: PER-GENE EIGENVALUE CORRELATION ACROSS CONDITIONS");
  console.log("If spatial and temporal are coupled at the gene level,");
  console.log("a gene's eigenvalue under spatial disruption should predict its response to temporal disruption");
  console.log("█".repeat(90));

  if (wt && apcKO && bmalKO) {
    const wtFp = path.join(process.cwd(), 'datasets/GSE157357_Organoid_WT-WT_circadian.csv');
    const apcFp = path.join(process.cwd(), 'datasets/GSE157357_Organoid_ApcKO-WT_circadian.csv');
    const bmalFp = path.join(process.cwd(), 'datasets/GSE157357_Organoid_WT-BmalKO_circadian.csv');
    const dblFp = path.join(process.cwd(), 'datasets/GSE157357_Organoid_ApcKO-BmalKO_circadian.csv');

    const wtMap = loadDatasetEigenvalues(wtFp);
    const apcMap = loadDatasetEigenvalues(apcFp);
    const bmalMap = loadDatasetEigenvalues(bmalFp);
    const dblMap = loadDatasetEigenvalues(dblFp);

    const sharedGenes = Array.from(wtMap.keys()).filter(g => apcMap.has(g) && bmalMap.has(g) && dblMap.has(g));

    const wtVals: number[] = [];
    const apcShifts: number[] = [];
    const bmalShifts: number[] = [];
    const dblShifts: number[] = [];
    const apcVals: number[] = [];
    const bmalVals: number[] = [];

    for (const gene of sharedGenes) {
      const wv = wtMap.get(gene)!.eigenvalue;
      const av = apcMap.get(gene)!.eigenvalue;
      const bv = bmalMap.get(gene)!.eigenvalue;
      const dv = dblMap.get(gene)!.eigenvalue;
      wtVals.push(wv);
      apcShifts.push(av - wv);
      bmalShifts.push(bv - wv);
      dblShifts.push(dv - wv);
      apcVals.push(av);
      bmalVals.push(bv);
    }

    console.log(`\n  Shared genes across all 4 conditions: ${sharedGenes.length}`);

    const rApcBmalShift = pearsonR(apcShifts, bmalShifts);
    const rApcBmalLevel = pearsonR(apcVals, bmalVals);
    const rWtApc = pearsonR(wtVals, apcVals.map((_, i) => apcVals[i]));
    const rWtBmal = pearsonR(wtVals, bmalVals);

    console.log(`\n  EIGENVALUE CORRELATIONS:`);
    console.log(`    WT eigenvalue vs ApcKO eigenvalue (same gene):  r = ${rWtApc.toFixed(3)}`);
    console.log(`    WT eigenvalue vs BmalKO eigenvalue (same gene): r = ${rWtBmal.toFixed(3)}`);
    console.log(`    ApcKO eigenvalue vs BmalKO eigenvalue:          r = ${rApcBmalLevel.toFixed(3)}`);
    console.log(`\n  SHIFT CORRELATIONS (change from WT):`);
    console.log(`    ApcKO shift vs BmalKO shift (same gene):        r = ${rApcBmalShift.toFixed(3)}`);
    console.log(`    Interpretation: ${Math.abs(rApcBmalShift) > 0.5 ? 'STRONG coupling — genes that change under spatial disruption also change under temporal disruption' : Math.abs(rApcBmalShift) > 0.3 ? 'MODERATE coupling' : Math.abs(rApcBmalShift) > 0.15 ? 'WEAK coupling' : 'NO coupling — spatial and temporal disruptions affect different genes'}`);

    // Top genes most affected by both
    interface GeneShiftPair { gene: string; apcShift: number; bmalShift: number; category: string; }
    const pairShifts: GeneShiftPair[] = sharedGenes.map((g, i) => ({
      gene: g,
      apcShift: apcShifts[i],
      bmalShift: bmalShifts[i],
      category: wtMap.get(g)!.category,
    }));

    const bothAffected = pairShifts
      .filter(p => Math.abs(p.apcShift) > 0.05 && Math.abs(p.bmalShift) > 0.05)
      .sort((a, b) => (Math.abs(b.apcShift) + Math.abs(b.bmalShift)) - (Math.abs(a.apcShift) + Math.abs(a.bmalShift)));

    const concordant = bothAffected.filter(p => Math.sign(p.apcShift) === Math.sign(p.bmalShift));
    const discordant = bothAffected.filter(p => Math.sign(p.apcShift) !== Math.sign(p.bmalShift));

    console.log(`\n  GENES AFFECTED BY BOTH DISRUPTIONS (|shift| > 0.05):`);
    console.log(`    Total: ${bothAffected.length}/${sharedGenes.length} genes`);
    console.log(`    Concordant (same direction): ${concordant.length} (${(concordant.length / Math.max(bothAffected.length, 1) * 100).toFixed(0)}%)`);
    console.log(`    Discordant (opposite):       ${discordant.length} (${(discordant.length / Math.max(bothAffected.length, 1) * 100).toFixed(0)}%)`);

    if (bothAffected.length > 0) {
      console.log(`\n  TOP 15 DUALLY-AFFECTED GENES:`);
      console.log(`  ${'Gene'.padEnd(15)} ${'Category'.padEnd(12)} ${'ApcKO Δ|λ|'.padStart(12)} ${'BmalKO Δ|λ|'.padStart(13)} ${'Direction'.padStart(12)}`);
      console.log("  " + "─".repeat(65));
      for (const p of bothAffected.slice(0, 15)) {
        const dir = Math.sign(p.apcShift) === Math.sign(p.bmalShift) ? 'CONCORDANT' : 'DISCORDANT';
        console.log(`  ${p.gene.padEnd(15)} ${p.category.padEnd(12)} ${(p.apcShift >= 0 ? '+' : '') + p.apcShift.toFixed(4)} ${(p.bmalShift >= 0 ? '+' : '') + p.bmalShift.toFixed(4)} ${dir.padStart(12)}`);
      }
    }

    // Category breakdown of dually-affected genes
    const catCounts: Record<string, { concordant: number; discordant: number; total: number }> = {};
    for (const p of bothAffected) {
      if (!catCounts[p.category]) catCounts[p.category] = { concordant: 0, discordant: 0, total: 0 };
      catCounts[p.category].total++;
      if (Math.sign(p.apcShift) === Math.sign(p.bmalShift)) catCounts[p.category].concordant++;
      else catCounts[p.category].discordant++;
    }

    console.log(`\n  CATEGORY BREAKDOWN OF DUALLY-AFFECTED GENES:`);
    for (const [cat, counts] of Object.entries(catCounts).sort((a, b) => b[1].total - a[1].total)) {
      console.log(`    ${cat.padEnd(15)} ${counts.total} genes (${counts.concordant} concordant, ${counts.discordant} discordant)`);
    }
  }

  // =========================================================================
  // OVERALL SYNTHESIS
  // =========================================================================
  console.log("\n\n" + "=".repeat(90));
  console.log("SYNTHESIS: HOW SPATIAL AND TEMPORAL CONNECT IN THE AR(2) FRAMEWORK");
  console.log("=".repeat(90));

  console.log(`
  EVIDENCE SUMMARY:

  Test 1 (Perturbation coupling):
  - Compares eigenvalue distributions across spatial (ApcKO) vs temporal (BmalKO) disruptions
  - Interaction analysis tests whether double KO is additive or synergistic
  - Synergistic = spatial-temporal coupling exists at system level

  Test 2 (Cross-tissue hierarchy):
  - Tests whether tissue spatial complexity predicts circadian hierarchy strength
  - If correlated: spatial architecture influences temporal dynamics
  - If uncorrelated: hierarchy is a cell-autonomous property, independent of tissue structure

  Test 3 (Per-gene correlation):
  - Tests whether individual genes respond similarly to spatial vs temporal disruption
  - High shift correlation = genes are jointly regulated by spatial and temporal programs
  - Low correlation = spatial and temporal are independent axes of gene regulation

  THE REAL CONNECTION: If spatial and temporal are coupled in the AR(2) framework,
  it should manifest in the EIGENVALUE MAGNITUDES (radial axis), not in the
  ANGULAR POSITIONS. The eigenvalue |λ| measures how persistent a gene's expression
  is over time — and that persistence could be influenced by where the gene sits
  in tissue architecture (spatial position → local signaling → expression dynamics).
  `);

  console.log("=".repeat(90));
  console.log("ANALYSIS COMPLETE");
  console.log("=".repeat(90));
}

main().catch(console.error);
