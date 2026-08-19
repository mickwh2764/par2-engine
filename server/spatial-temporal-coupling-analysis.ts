import * as fs from 'fs';
import * as path from 'path';
import { ENSEMBL_TO_SYMBOL, classifyGene } from './gene-categories';

const CLOCK_CORE = ['Bmal1', 'Clock', 'Per1', 'Per2', 'Per3', 'Cry1', 'Cry2', 'Nr1d1', 'Nr1d2', 'Dbp', 'Tef', 'Hlf', 'Rora', 'Rorc', 'Npas2'];
const TARGET_CORE = ['Wee1', 'Myc', 'Ccnd1', 'Ccnb1', 'Cdk1', 'Top2a', 'Mki67', 'Cdkn1a'];

function fitAR2(series: number[]) {
  const n = series.length;
  if (n < 5) return { phi1: 0, phi2: 0, eigenvalue: 0, r2: 0 };
  const m = series.reduce((a, b) => a + b, 0) / n;
  const y = series.map(x => x - m);
  const Y = y.slice(2), Y1 = y.slice(1, n - 1), Y2 = y.slice(0, n - 2);
  let s11 = 0, s22 = 0, s12 = 0, sy1 = 0, sy2 = 0;
  for (let i = 0; i < Y.length; i++) {
    s11 += Y1[i] * Y1[i]; s22 += Y2[i] * Y2[i]; s12 += Y1[i] * Y2[i];
    sy1 += Y[i] * Y1[i]; sy2 += Y[i] * Y2[i];
  }
  const det = s11 * s22 - s12 * s12;
  if (Math.abs(det) < 1e-15) return { phi1: 0, phi2: 0, eigenvalue: 0, r2: 0 };
  const phi1 = (sy1 * s22 - sy2 * s12) / det;
  const phi2 = (sy2 * s11 - sy1 * s12) / det;
  const disc = phi1 * phi1 + 4 * phi2;
  let eigenvalue: number;
  if (disc >= 0) {
    eigenvalue = Math.max(Math.abs((phi1 + Math.sqrt(disc)) / 2), Math.abs((phi1 - Math.sqrt(disc)) / 2));
  } else {
    eigenvalue = Math.sqrt(-phi2);
  }
  const ssRes = Y.reduce((s, yi, i) => s + (yi - phi1 * Y1[i] - phi2 * Y2[i]) ** 2, 0);
  const meanY = Y.reduce((a, b) => a + b, 0) / Y.length;
  const ssTot = Y.reduce((s, yi) => s + (yi - meanY) ** 2, 0);
  const r2 = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;
  return { phi1, phi2, eigenvalue, r2 };
}

function loadEigenvalues(filePath: string): Map<string, { eigenvalue: number; category: string; phi1: number; phi2: number }> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  const results = new Map<string, { eigenvalue: number; category: string; phi1: number; phi2: number }>();
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const rawGene = cols[0].trim().replace(/"/g, '');
    if (!rawGene) continue;
    const gene = ENSEMBL_TO_SYMBOL[rawGene] || rawGene;
    const values = cols.slice(1).map(v => parseFloat(v)).filter(v => !isNaN(v));
    if (values.length < 5) continue;
    const fit = fitAR2(values);
    if (fit.eigenvalue >= 1.5 || fit.eigenvalue <= 0) continue;
    results.set(gene, { eigenvalue: fit.eigenvalue, category: classifyGene(gene), phi1: fit.phi1, phi2: fit.phi2 });
  }
  return results;
}

function mannWhitneyU(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0) return 1;
  const combined = [...a.map(v => ({ v, g: 'a' })), ...b.map(v => ({ v, g: 'b' }))].sort((x, y) => x.v - y.v);
  let sumRankA = 0;
  for (let i = 0; i < combined.length; i++) if (combined[i].g === 'a') sumRankA += (i + 1);
  const n1 = a.length, n2 = b.length;
  const U = sumRankA - n1 * (n1 + 1) / 2;
  const mu = n1 * n2 / 2;
  const sigma = Math.sqrt(n1 * n2 * (n1 + n2 + 1) / 12);
  if (sigma === 0) return 1;
  const z = Math.abs((U - mu) / sigma);
  return Math.max(2 * (1 - normalCDF(z)), 1e-10);
}

function normalCDF(z: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = z < 0 ? -1 : 1;
  z = Math.abs(z) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * z);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);
  return 0.5 * (1.0 + sign * y);
}

const avg = (a: number[]) => a.length > 0 ? a.reduce((s, v) => s + v, 0) / a.length : 0;
const stdev = (a: number[]) => { if (a.length < 2) return 0; const m = avg(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)); };
const cohensD = (a: number[], b: number[]) => { const ps = Math.sqrt(((a.length - 1) * stdev(a) ** 2 + (b.length - 1) * stdev(b) ** 2) / (a.length + b.length - 2)); return ps > 0 ? (avg(a) - avg(b)) / ps : 0; };
const pearsonR = (x: number[], y: number[]) => { const mx = avg(x), my = avg(y); let num = 0, dx2 = 0, dy2 = 0; for (let i = 0; i < x.length; i++) { num += (x[i] - mx) * (y[i] - my); dx2 += (x[i] - mx) ** 2; dy2 += (y[i] - my) ** 2; } const d = Math.sqrt(dx2 * dy2); return d > 0 ? num / d : 0; };

export interface SpatialTemporalResult {
  test1: {
    genotypes: { label: string; spatial: string; temporal: string; meanClock: number; meanTarget: number; gap: number; hierarchyPct: number; oscPct: number; totalGenes: number; clockCount: number; targetCount: number }[];
    perturbations: { label: string; allGeneShift: number; effectSize: number; pValue: number; clockShift: number; clockP: number; wtGap: number; newGap: number; wtOscPct: number; newOscPct: number }[];
    interaction: { apcEffect: number; bmalEffect: number; expectedAdditive: number; observedDouble: number; interactionTerm: number; interpretation: string; gapApcEffect: number; gapBmalEffect: number; gapExpected: number; gapObserved: number; gapInteraction: number; gapInterpretation: string };
    headToHead: { apcMean: number; bmalMean: number; effectSize: number; pValue: number };
  };
  test2: {
    tissues: { label: string; spatialComplexity: string; reason: string; meanClock: number; meanTarget: number; gap: number; hierarchyPct: number; pValue: number; significant: boolean; oscPct: number; clockCount: number; targetCount: number }[];
    correlation: { gapVsComplexity: number; oscVsComplexity: number; interpretation: string };
    groups: { high: { mean: number; std: number; n: number }; medium: { mean: number; std: number; n: number }; low: { mean: number; std: number; n: number }; highVsLowP: number };
  };
  test3: {
    sharedGenes: number;
    eigenCorrelations: { wtVsApc: number; wtVsBmal: number; apcVsBmal: number };
    shiftCorrelation: { r: number; interpretation: string };
    duallyAffected: { total: number; concordant: number; discordant: number; concordantPct: number };
    topGenes: { gene: string; category: string; apcShift: number; bmalShift: number; direction: string }[];
    categoryBreakdown: { category: string; total: number; concordant: number; discordant: number }[];
  };
}

export function runSpatialTemporalAnalysis(): SpatialTemporalResult {
  const organoidFiles = [
    { file: 'datasets/GSE157357_Organoid_WT-WT_circadian.csv', label: 'WT (healthy)', spatial: 'intact', temporal: 'intact' },
    { file: 'datasets/GSE157357_Organoid_ApcKO-WT_circadian.csv', label: 'ApcKO (spatial KO)', spatial: 'disrupted', temporal: 'intact' },
    { file: 'datasets/GSE157357_Organoid_WT-BmalKO_circadian.csv', label: 'BmalKO (temporal KO)', spatial: 'intact', temporal: 'disrupted' },
    { file: 'datasets/GSE157357_Organoid_ApcKO-BmalKO_circadian.csv', label: 'Double KO', spatial: 'disrupted', temporal: 'disrupted' },
  ];

  const genotypeResults: SpatialTemporalResult['test1']['genotypes'] = [];

  for (const ds of organoidFiles) {
    const fp = path.join(process.cwd(), ds.file);
    if (!fs.existsSync(fp)) continue;
    const content = fs.readFileSync(fp, 'utf-8');
    const lines = content.trim().split('\n');
    const clockEig: number[] = [], targetEig: number[] = [], allEig: number[] = [];
    let complexCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      const rawGene = cols[0].trim().replace(/"/g, '');
      if (!rawGene) continue;
      const gene = ENSEMBL_TO_SYMBOL[rawGene] || rawGene;
      const values = cols.slice(1).map(v => parseFloat(v)).filter(v => !isNaN(v));
      if (values.length < 5) continue;
      const fit = fitAR2(values);
      if (fit.eigenvalue >= 1.5 || fit.eigenvalue <= 0) continue;
      if (fit.phi1 * fit.phi1 + 4 * fit.phi2 < 0) complexCount++;
      allEig.push(fit.eigenvalue);
      if (CLOCK_CORE.some(c => c.toLowerCase() === gene.toLowerCase())) clockEig.push(fit.eigenvalue);
      if (TARGET_CORE.some(t => t.toLowerCase() === gene.toLowerCase())) targetEig.push(fit.eigenvalue);
    }

    const mc = avg(clockEig), mt = avg(targetEig);
    let hierWins = 0, hierTotal = 0;
    for (const c of clockEig) for (const t of targetEig) { hierTotal++; if (c > t) hierWins++; }

    genotypeResults.push({
      label: ds.label, spatial: ds.spatial, temporal: ds.temporal,
      meanClock: mc, meanTarget: mt, gap: mc - mt,
      hierarchyPct: hierTotal > 0 ? Math.round(hierWins / hierTotal * 100) : 0,
      oscPct: Math.round(allEig.length > 0 ? complexCount / allEig.length * 100 : 0),
      totalGenes: allEig.length, clockCount: clockEig.length, targetCount: targetEig.length,
    });
  }

  if (genotypeResults.length < 4) {
    throw new Error(`Expected 4 genotype datasets but found ${genotypeResults.length}. Check dataset files exist.`);
  }

  const wt = genotypeResults[0], apc = genotypeResults[1], bmal = genotypeResults[2], dbl = genotypeResults[3];
  const wtMap = loadEigenvalues(path.join(process.cwd(), organoidFiles[0].file));
  const apcMap = loadEigenvalues(path.join(process.cwd(), organoidFiles[1].file));
  const bmalMap = loadEigenvalues(path.join(process.cwd(), organoidFiles[2].file));
  const dblMap = loadEigenvalues(path.join(process.cwd(), organoidFiles[3].file));

  const wtAll = Array.from(wtMap.values()).map(v => v.eigenvalue);
  const apcAll = Array.from(apcMap.values()).map(v => v.eigenvalue);
  const bmalAll = Array.from(bmalMap.values()).map(v => v.eigenvalue);
  const dblAll = Array.from(dblMap.values()).map(v => v.eigenvalue);

  const filterClock = (m: Map<string, any>) => Array.from(m.entries()).filter(([g]) => CLOCK_CORE.some(c => c.toLowerCase() === g.toLowerCase())).map(([_, v]) => v.eigenvalue);
  const wtClock = filterClock(wtMap);
  const apcClock = filterClock(apcMap);
  const bmalClock = filterClock(bmalMap);
  const dblClock = filterClock(dblMap);

  const clockP = (a: number[], b: number[]) => a.length > 2 && b.length > 2 ? mannWhitneyU(a, b) : 1;

  const perturbations: SpatialTemporalResult['test1']['perturbations'] = [
    {
      label: 'ApcKO (spatial) vs WT', allGeneShift: avg(apcAll) - avg(wtAll), effectSize: cohensD(wtAll, apcAll),
      pValue: mannWhitneyU(wtAll, apcAll), clockShift: avg(apcClock) - avg(wtClock),
      clockP: clockP(wtClock, apcClock),
      wtGap: wt.gap, newGap: apc.gap, wtOscPct: wt.oscPct, newOscPct: apc.oscPct,
    },
    {
      label: 'BmalKO (temporal) vs WT', allGeneShift: avg(bmalAll) - avg(wtAll), effectSize: cohensD(wtAll, bmalAll),
      pValue: mannWhitneyU(wtAll, bmalAll), clockShift: avg(bmalClock) - avg(wtClock),
      clockP: clockP(wtClock, bmalClock),
      wtGap: wt.gap, newGap: bmal.gap, wtOscPct: wt.oscPct, newOscPct: bmal.oscPct,
    },
    {
      label: 'Double KO vs WT', allGeneShift: avg(dblAll) - avg(wtAll), effectSize: cohensD(wtAll, dblAll),
      pValue: mannWhitneyU(wtAll, dblAll), clockShift: avg(dblClock) - avg(wtClock),
      clockP: clockP(wtClock, dblClock),
      wtGap: wt.gap, newGap: dbl.gap, wtOscPct: wt.oscPct, newOscPct: dbl.oscPct,
    },
  ];

  const apcEff = avg(apcAll) - avg(wtAll), bmalEff = avg(bmalAll) - avg(wtAll);
  const expAdd = avg(wtAll) + apcEff + bmalEff, obsDb = avg(dblAll);
  const intTerm = obsDb - expAdd;
  const gapApcEff = apc.gap - wt.gap, gapBmalEff = bmal.gap - wt.gap;
  const gapExp = wt.gap + gapApcEff + gapBmalEff, gapObs = dbl.gap;
  const gapInt = gapObs - gapExp;

  const interaction = {
    apcEffect: apcEff, bmalEffect: bmalEff, expectedAdditive: expAdd, observedDouble: obsDb, interactionTerm: intTerm,
    interpretation: Math.abs(intTerm) < 0.01 ? 'ADDITIVE' : intTerm > 0 ? 'SYNERGISTIC' : 'ANTAGONISTIC',
    gapApcEffect: gapApcEff, gapBmalEffect: gapBmalEff, gapExpected: gapExp, gapObserved: gapObs, gapInteraction: gapInt,
    gapInterpretation: Math.abs(gapInt) < 0.005 ? 'ADDITIVE' : gapInt > 0 ? 'SYNERGISTIC' : 'ANTAGONISTIC',
  };

  const headToHead = { apcMean: avg(apcAll), bmalMean: avg(bmalAll), effectSize: cohensD(apcAll, bmalAll), pValue: mannWhitneyU(apcAll, bmalAll) };

  // TEST 2
  const tissueFiles = [
    { file: 'datasets/GSE54650_Liver_circadian.csv', label: 'Liver', sc: 'high', reason: 'Lobular zonation (portal-central axis)' },
    { file: 'datasets/GSE54650_Heart_circadian.csv', label: 'Heart', sc: 'medium', reason: 'Layered wall (endo/myo/epicardium)' },
    { file: 'datasets/GSE54650_Kidney_circadian.csv', label: 'Kidney', sc: 'high', reason: 'Nephron architecture (cortex-medulla)' },
    { file: 'datasets/GSE54650_Lung_circadian.csv', label: 'Lung', sc: 'high', reason: 'Branching airways, alveolar structure' },
    { file: 'datasets/GSE54650_Cerebellum_circadian.csv', label: 'Cerebellum', sc: 'high', reason: 'Layered cortex (molecular, Purkinje, granular)' },
    { file: 'datasets/GSE54650_Hypothalamus_circadian.csv', label: 'Hypothalamus', sc: 'high', reason: 'Distinct nuclei (SCN, PVN)' },
    { file: 'datasets/GSE54650_Brainstem_circadian.csv', label: 'Brainstem', sc: 'medium', reason: 'Nuclei organization' },
    { file: 'datasets/GSE54650_Muscle_circadian.csv', label: 'Muscle', sc: 'low', reason: 'Homogeneous fiber bundles' },
    { file: 'datasets/GSE54650_Adrenal_circadian.csv', label: 'Adrenal', sc: 'high', reason: 'Cortex zones + medulla' },
    { file: 'datasets/GSE54650_Aorta_circadian.csv', label: 'Aorta', sc: 'medium', reason: 'Layered wall (intima/media/adventitia)' },
    { file: 'datasets/GSE54650_Brown_Fat_circadian.csv', label: 'Brown Fat', sc: 'low', reason: 'Homogeneous adipocytes' },
    { file: 'datasets/GSE54650_White_Fat_circadian.csv', label: 'White Fat', sc: 'low', reason: 'Homogeneous adipocytes' },
  ];

  const tissueResults: SpatialTemporalResult['test2']['tissues'] = [];

  for (const t of tissueFiles) {
    const fp = path.join(process.cwd(), t.file);
    if (!fs.existsSync(fp)) continue;
    const content = fs.readFileSync(fp, 'utf-8');
    const lines = content.trim().split('\n');
    const clockEig: number[] = [], targetEig: number[] = [];
    let complexCount = 0, totalCount = 0;

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
      if (fit.phi1 * fit.phi1 + 4 * fit.phi2 < 0) complexCount++;
      const cat = classifyGene(gene);
      if (cat === 'clock') clockEig.push(fit.eigenvalue);
      else if (cat === 'target') targetEig.push(fit.eigenvalue);
    }

    const mc = avg(clockEig), mt = avg(targetEig);
    const p = clockEig.length > 2 && targetEig.length > 2 ? mannWhitneyU(clockEig, targetEig) : 1;
    let hierWins = 0, hierTotal = 0;
    for (const c of clockEig) for (const tg of targetEig) { hierTotal++; if (c > tg) hierWins++; }

    tissueResults.push({
      label: t.label, spatialComplexity: t.sc, reason: t.reason,
      meanClock: mc, meanTarget: mt, gap: mc - mt,
      hierarchyPct: hierTotal > 0 ? Math.round(hierWins / hierTotal * 100) : 0,
      pValue: p, significant: p < 0.05,
      oscPct: Math.round(totalCount > 0 ? complexCount / totalCount * 100 : 0),
      clockCount: clockEig.length, targetCount: targetEig.length,
    });
  }

  tissueResults.sort((a, b) => b.gap - a.gap);

  const csMap: Record<string, number> = { high: 3, medium: 2, low: 1 };
  const cScores = tissueResults.map(r => csMap[r.spatialComplexity]);
  const gaps = tissueResults.map(r => r.gap);
  const oscs = tissueResults.map(r => r.oscPct);
  const rGC = pearsonR(cScores, gaps);
  const rOC = pearsonR(cScores, oscs);

  const highGaps = tissueResults.filter(r => r.spatialComplexity === 'high').map(r => r.gap);
  const medGaps = tissueResults.filter(r => r.spatialComplexity === 'medium').map(r => r.gap);
  const lowGaps = tissueResults.filter(r => r.spatialComplexity === 'low').map(r => r.gap);

  const test2 = {
    tissues: tissueResults,
    correlation: {
      gapVsComplexity: rGC, oscVsComplexity: rOC,
      interpretation: Math.abs(rGC) > 0.5 ? `Substantial: spatially complex tissues show ${rGC > 0 ? 'stronger' : 'weaker'} hierarchy` : Math.abs(rGC) > 0.3 ? 'Moderate correlation' : 'Weak/no correlation — hierarchy strength appears independent of spatial complexity',
    },
    groups: {
      high: { mean: avg(highGaps), std: stdev(highGaps), n: highGaps.length },
      medium: { mean: avg(medGaps), std: stdev(medGaps), n: medGaps.length },
      low: { mean: avg(lowGaps), std: stdev(lowGaps), n: lowGaps.length },
      highVsLowP: highGaps.length > 2 && lowGaps.length > 2 ? mannWhitneyU(highGaps, lowGaps) : 1,
    },
  };

  // TEST 3
  const sharedGenes = Array.from(wtMap.keys()).filter(g => apcMap.has(g) && bmalMap.has(g) && dblMap.has(g));
  const wtV: number[] = [], apcV: number[] = [], bmalV: number[] = [];
  const apcShifts: number[] = [], bmalShifts: number[] = [];

  for (const gene of sharedGenes) {
    const wv = wtMap.get(gene)!.eigenvalue, av = apcMap.get(gene)!.eigenvalue, bv = bmalMap.get(gene)!.eigenvalue;
    wtV.push(wv); apcV.push(av); bmalV.push(bv);
    apcShifts.push(av - wv); bmalShifts.push(bv - wv);
  }

  const rShift = pearsonR(apcShifts, bmalShifts);

  const pairData = sharedGenes.map((g, i) => ({
    gene: g, category: wtMap.get(g)!.category, apcShift: apcShifts[i], bmalShift: bmalShifts[i],
  }));

  const bothAffected = pairData.filter(p => Math.abs(p.apcShift) > 0.05 && Math.abs(p.bmalShift) > 0.05)
    .sort((a, b) => (Math.abs(b.apcShift) + Math.abs(b.bmalShift)) - (Math.abs(a.apcShift) + Math.abs(a.bmalShift)));

  const concordant = bothAffected.filter(p => Math.sign(p.apcShift) === Math.sign(p.bmalShift));
  const discordant = bothAffected.filter(p => Math.sign(p.apcShift) !== Math.sign(p.bmalShift));

  const catMap: Record<string, { total: number; concordant: number; discordant: number }> = {};
  for (const p of bothAffected) {
    if (!catMap[p.category]) catMap[p.category] = { total: 0, concordant: 0, discordant: 0 };
    catMap[p.category].total++;
    if (Math.sign(p.apcShift) === Math.sign(p.bmalShift)) catMap[p.category].concordant++;
    else catMap[p.category].discordant++;
  }

  const test3 = {
    sharedGenes: sharedGenes.length,
    eigenCorrelations: { wtVsApc: pearsonR(wtV, apcV), wtVsBmal: pearsonR(wtV, bmalV), apcVsBmal: pearsonR(apcV, bmalV) },
    shiftCorrelation: {
      r: rShift,
      interpretation: Math.abs(rShift) > 0.5 ? 'Strong coupling — genes respond similarly to both disruptions' : Math.abs(rShift) > 0.3 ? 'Moderate coupling — partial shared response' : Math.abs(rShift) > 0.15 ? 'Weak coupling' : 'No coupling',
    },
    duallyAffected: {
      total: bothAffected.length, concordant: concordant.length, discordant: discordant.length,
      concordantPct: Math.round(concordant.length / Math.max(bothAffected.length, 1) * 100),
    },
    topGenes: bothAffected.slice(0, 20).map(p => ({
      gene: p.gene, category: p.category, apcShift: p.apcShift, bmalShift: p.bmalShift,
      direction: Math.sign(p.apcShift) === Math.sign(p.bmalShift) ? 'concordant' : 'discordant',
    })),
    categoryBreakdown: Object.entries(catMap).sort((a, b) => b[1].total - a[1].total).map(([cat, c]) => ({
      category: cat, total: c.total, concordant: c.concordant, discordant: c.discordant,
    })),
  };

  return {
    test1: { genotypes: genotypeResults, perturbations, interaction, headToHead },
    test2,
    test3,
  };
}
