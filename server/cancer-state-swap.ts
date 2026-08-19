import * as fs from 'fs';
import * as path from 'path';

const CELL_IDENTITY_MARKERS: Record<string, { symbol: string; fullName: string; category: string }> = {
  'GFAP': { symbol: 'GFAP', fullName: 'Glial fibrillary acidic protein', category: 'Astrocyte' },
  'VIM': { symbol: 'VIM', fullName: 'Vimentin', category: 'Mesenchymal/Astrocyte' },
  'NES': { symbol: 'NES', fullName: 'Nestin', category: 'Neural Stem' },
  'S100B': { symbol: 'S100B', fullName: 'S100 calcium-binding protein B', category: 'Astrocyte/Schwann' },
  'AQP4': { symbol: 'AQP4', fullName: 'Aquaporin 4', category: 'Astrocyte' },
  'SOX9': { symbol: 'SOX9', fullName: 'SRY-box transcription factor 9', category: 'Astrocyte/Progenitor' },
  'ALDH1L1': { symbol: 'ALDH1L1', fullName: '10-formyltetrahydrofolate dehydrogenase', category: 'Astrocyte' },
  'OLIG2': { symbol: 'OLIG2', fullName: 'Oligodendrocyte transcription factor 2', category: 'Oligodendrocyte' },
  'MBP': { symbol: 'MBP', fullName: 'Myelin basic protein', category: 'Oligodendrocyte' },
  'SYN1': { symbol: 'SYN1', fullName: 'Synapsin I', category: 'Neuron' },
  'RBFOX3': { symbol: 'RBFOX3', fullName: 'NeuN / RNA-binding Fox-1 homolog 3', category: 'Neuron' },
  'MAP2': { symbol: 'MAP2', fullName: 'Microtubule-associated protein 2', category: 'Neuron' },
  'TUBB3': { symbol: 'TUBB3', fullName: 'Tubulin beta-3 chain', category: 'Neuron' },
};

const PROLIFERATION_MARKERS: Record<string, { symbol: string; fullName: string; category: string }> = {
  'CCNB1': { symbol: 'CCNB1', fullName: 'Cyclin B1', category: 'G2/M Cyclins' },
  'CCND1': { symbol: 'CCND1', fullName: 'Cyclin D1', category: 'G1 Cyclins' },
  'CCNE1': { symbol: 'CCNE1', fullName: 'Cyclin E1', category: 'G1/S Cyclins' },
  'MKI67': { symbol: 'MKI67', fullName: 'Ki-67', category: 'Proliferation Index' },
  'PCNA': { symbol: 'PCNA', fullName: 'Proliferating cell nuclear antigen', category: 'DNA Replication' },
  'TOP2A': { symbol: 'TOP2A', fullName: 'DNA topoisomerase II alpha', category: 'DNA Replication' },
  'CDK1': { symbol: 'CDK1', fullName: 'Cyclin-dependent kinase 1', category: 'CDKs' },
  'CDK2': { symbol: 'CDK2', fullName: 'Cyclin-dependent kinase 2', category: 'CDKs' },
  'CDK4': { symbol: 'CDK4', fullName: 'Cyclin-dependent kinase 4', category: 'CDKs' },
  'AURKA': { symbol: 'AURKA', fullName: 'Aurora kinase A', category: 'Mitotic Kinases' },
  'BUB1': { symbol: 'BUB1', fullName: 'Mitotic checkpoint serine/threonine kinase', category: 'Spindle Checkpoint' },
  'PLK1': { symbol: 'PLK1', fullName: 'Polo-like kinase 1', category: 'Mitotic Kinases' },
  'FOXM1': { symbol: 'FOXM1', fullName: 'Forkhead box M1', category: 'Proliferation TF' },
  'MCM2': { symbol: 'MCM2', fullName: 'Minichromosome maintenance 2', category: 'DNA Replication' },
  'MCM6': { symbol: 'MCM6', fullName: 'Minichromosome maintenance 6', category: 'DNA Replication' },
  'E2F1': { symbol: 'E2F1', fullName: 'E2F transcription factor 1', category: 'Cell Cycle TF' },
  'CDC20': { symbol: 'CDC20', fullName: 'Cell division cycle 20', category: 'APC/C Activator' },
  'BIRC5': { symbol: 'BIRC5', fullName: 'Survivin', category: 'Anti-Apoptotic' },
};

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

function fitAR2(series: number[]): { phi1: number; phi2: number; eigenvalue: number; r2: number; hasComplexRoots: boolean; eigenperiod: number | null } | null {
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
  let hasComplexRoots = false;
  let eigenperiod: number | null = null;

  if (disc >= 0) {
    eigenvalue = Math.max(
      Math.abs((phi1 + Math.sqrt(disc)) / 2),
      Math.abs((phi1 - Math.sqrt(disc)) / 2)
    );
  } else {
    eigenvalue = Math.sqrt(-phi2);
    hasComplexRoots = true;
    const theta = Math.atan2(Math.sqrt(-disc) / 2, phi1 / 2);
    if (Math.abs(theta) > 1e-10) {
      eigenperiod = (2 * Math.PI * 4) / Math.abs(theta);
    }
  }

  if (isNaN(eigenvalue)) return null;
  eigenvalue = Math.min(eigenvalue, 1.0);

  let ssRes = 0, ssTot = 0;
  const yMean = Y.reduce((a, b) => a + b, 0) / Y.length;
  for (let i = 0; i < Y.length; i++) {
    const pred = phi1 * Y1[i] + phi2 * Y2[i];
    ssRes += (Y[i] - pred) ** 2;
    ssTot += (Y[i] - yMean) ** 2;
  }
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  return { phi1, phi2, eigenvalue, r2, hasComplexRoots, eigenperiod };
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

function stddev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
}

function cohenD(a: number[], b: number[]): number {
  const pooledVar = ((a.length - 1) * stddev(a) ** 2 + (b.length - 1) * stddev(b) ** 2) / (a.length + b.length - 2);
  return pooledVar > 0 ? (mean(a) - mean(b)) / Math.sqrt(pooledVar) : 0;
}

function wilcoxonP(a: number[], b: number[]): number {
  const combined = [
    ...a.map(v => ({ v, group: 0 })),
    ...b.map(v => ({ v, group: 1 }))
  ].sort((x, y) => x.v - y.v);

  for (let i = 0; i < combined.length; i++) {
    (combined[i] as any).rank = i + 1;
  }

  let ties = 0;
  let i = 0;
  while (i < combined.length) {
    let j = i;
    while (j < combined.length && combined[j].v === combined[i].v) j++;
    if (j > i + 1) {
      const avgRank = (i + 1 + j) / 2;
      for (let k = i; k < j; k++) (combined[k] as any).rank = avgRank;
      ties++;
    }
    i = j;
  }

  const n1 = a.length, n2 = b.length;
  const U1 = combined.filter(c => c.group === 0).reduce((s, c) => s + (c as any).rank, 0) - n1 * (n1 + 1) / 2;
  const mu = n1 * n2 / 2;
  const sigma = Math.sqrt(n1 * n2 * (n1 + n2 + 1) / 12);
  if (sigma === 0) return 1;
  const z = (U1 - mu) / sigma;
  return 2 * (1 - normalCDF(Math.abs(z)));
}

function normalCDF(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

function permutationTest(identity: number[], prolif: number[], nPerms: number = 10000): number {
  const observedDiff = mean(identity) - mean(prolif);
  const combined = [...identity, ...prolif];
  const n1 = identity.length;
  let count = 0;
  for (let p = 0; p < nPerms; p++) {
    for (let i = combined.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [combined[i], combined[j]] = [combined[j], combined[i]];
    }
    const permDiff = mean(combined.slice(0, n1)) - mean(combined.slice(n1));
    if (Math.abs(permDiff) >= Math.abs(observedDiff)) count++;
  }
  return count / nPerms;
}

interface GeneResult {
  gene: string;
  fullName: string;
  subcategory: string;
  group: 'identity' | 'proliferation';
  mycOn: { eigenvalue: number; phi1: number; phi2: number; r2: number; complexRoots: boolean; eigenperiod: number | null } | null;
  mycOff: { eigenvalue: number; phi1: number; phi2: number; r2: number; complexRoots: boolean; eigenperiod: number | null } | null;
  delta: number | null;
}

let cachedResult: any = null;

export function runCancerStateSwapAnalysis(): any {
  if (cachedResult) return cachedResult;

  const mycOnPath = path.join(process.cwd(), 'datasets', 'GSE221103_Neuroblastoma_MYC_ON.csv');
  const mycOffPath = path.join(process.cwd(), 'datasets', 'GSE221103_Neuroblastoma_MYC_OFF.csv');

  if (!fs.existsSync(mycOnPath) || !fs.existsSync(mycOffPath)) {
    throw new Error('GSE221103 Neuroblastoma datasets not found');
  }

  const mycOnData = parseCSV(mycOnPath);
  const mycOffData = parseCSV(mycOffPath);

  const geneResults: GeneResult[] = [];

  for (const [gene, info] of Object.entries(CELL_IDENTITY_MARKERS)) {
    const onSeries = mycOnData.get(gene);
    const offSeries = mycOffData.get(gene);
    const onFit = onSeries ? fitAR2(onSeries) : null;
    const offFit = offSeries ? fitAR2(offSeries) : null;

    geneResults.push({
      gene,
      fullName: info.fullName,
      subcategory: info.category,
      group: 'identity',
      mycOn: onFit ? { eigenvalue: onFit.eigenvalue, phi1: onFit.phi1, phi2: onFit.phi2, r2: onFit.r2, complexRoots: onFit.hasComplexRoots, eigenperiod: onFit.eigenperiod } : null,
      mycOff: offFit ? { eigenvalue: offFit.eigenvalue, phi1: offFit.phi1, phi2: offFit.phi2, r2: offFit.r2, complexRoots: offFit.hasComplexRoots, eigenperiod: offFit.eigenperiod } : null,
      delta: onFit && offFit ? onFit.eigenvalue - offFit.eigenvalue : null,
    });
  }

  for (const [gene, info] of Object.entries(PROLIFERATION_MARKERS)) {
    const onSeries = mycOnData.get(gene);
    const offSeries = mycOffData.get(gene);
    const onFit = onSeries ? fitAR2(onSeries) : null;
    const offFit = offSeries ? fitAR2(offSeries) : null;

    geneResults.push({
      gene,
      fullName: info.fullName,
      subcategory: info.category,
      group: 'proliferation',
      mycOn: onFit ? { eigenvalue: onFit.eigenvalue, phi1: onFit.phi1, phi2: onFit.phi2, r2: onFit.r2, complexRoots: onFit.hasComplexRoots, eigenperiod: onFit.eigenperiod } : null,
      mycOff: offFit ? { eigenvalue: offFit.eigenvalue, phi1: offFit.phi1, phi2: offFit.phi2, r2: offFit.r2, complexRoots: offFit.hasComplexRoots, eigenperiod: offFit.eigenperiod } : null,
      delta: onFit && offFit ? onFit.eigenvalue - offFit.eigenvalue : null,
    });
  }

  const identityOn = geneResults.filter(g => g.group === 'identity' && g.mycOn).map(g => g.mycOn!.eigenvalue);
  const identityOff = geneResults.filter(g => g.group === 'identity' && g.mycOff).map(g => g.mycOff!.eigenvalue);
  const prolifOn = geneResults.filter(g => g.group === 'proliferation' && g.mycOn).map(g => g.mycOn!.eigenvalue);
  const prolifOff = geneResults.filter(g => g.group === 'proliferation' && g.mycOff).map(g => g.mycOff!.eigenvalue);

  const allGenesOn = [...Array.from(mycOnData.entries())].map(([g, s]) => {
    const fit = fitAR2(s);
    return fit ? fit.eigenvalue : null;
  }).filter((v): v is number => v !== null);

  const allGenesOff = [...Array.from(mycOffData.entries())].map(([g, s]) => {
    const fit = fitAR2(s);
    return fit ? fit.eigenvalue : null;
  }).filter((v): v is number => v !== null);

  const backgroundOnMedian = median(allGenesOn);
  const backgroundOffMedian = median(allGenesOff);

  const groupStats = {
    mycOn: {
      identity: { n: identityOn.length, median: median(identityOn), mean: mean(identityOn), sd: stddev(identityOn) },
      proliferation: { n: prolifOn.length, median: median(prolifOn), mean: mean(prolifOn), sd: stddev(prolifOn) },
      background: { n: allGenesOn.length, median: backgroundOnMedian, mean: mean(allGenesOn), sd: stddev(allGenesOn) },
    },
    mycOff: {
      identity: { n: identityOff.length, median: median(identityOff), mean: mean(identityOff), sd: stddev(identityOff) },
      proliferation: { n: prolifOff.length, median: median(prolifOff), mean: mean(prolifOff), sd: stddev(prolifOff) },
      background: { n: allGenesOff.length, median: backgroundOffMedian, mean: mean(allGenesOff), sd: stddev(allGenesOff) },
    },
  };

  const comparisons = {
    mycOn: {
      identityVsProlif: {
        cohenD: cohenD(identityOn, prolifOn),
        wilcoxonP: wilcoxonP(identityOn, prolifOn),
        permutationP: permutationTest(identityOn, prolifOn),
        medianDiff: median(identityOn) - median(prolifOn),
      },
      identityVsBackground: {
        cohenD: cohenD(identityOn, allGenesOn),
        wilcoxonP: wilcoxonP(identityOn, allGenesOn),
      },
      prolifVsBackground: {
        cohenD: cohenD(prolifOn, allGenesOn),
        wilcoxonP: wilcoxonP(prolifOn, allGenesOn),
      },
    },
    mycOff: {
      identityVsProlif: {
        cohenD: cohenD(identityOff, prolifOff),
        wilcoxonP: wilcoxonP(identityOff, prolifOff),
        permutationP: permutationTest(identityOff, prolifOff),
        medianDiff: median(identityOff) - median(prolifOff),
      },
      identityVsBackground: {
        cohenD: cohenD(identityOff, allGenesOff),
        wilcoxonP: wilcoxonP(identityOff, allGenesOff),
      },
      prolifVsBackground: {
        cohenD: cohenD(prolifOff, allGenesOff),
        wilcoxonP: wilcoxonP(prolifOff, allGenesOff),
      },
    },
  };

  const stateSwapEffects = {
    identityShift: {
      medianDelta: median(identityOn) - median(identityOff),
      meanDelta: mean(identityOn) - mean(identityOff),
      cohenD: cohenD(identityOn, identityOff),
      wilcoxonP: wilcoxonP(identityOn, identityOff),
    },
    prolifShift: {
      medianDelta: median(prolifOn) - median(prolifOff),
      meanDelta: mean(prolifOn) - mean(prolifOff),
      cohenD: cohenD(prolifOn, prolifOff),
      wilcoxonP: wilcoxonP(prolifOn, prolifOff),
    },
    backgroundShift: {
      medianDelta: backgroundOnMedian - backgroundOffMedian,
      meanDelta: mean(allGenesOn) - mean(allGenesOff),
    },
    differentialResponse: {
      identityVsProlif_deltaCohenD:
        cohenD(
          geneResults.filter(g => g.group === 'identity' && g.delta !== null).map(g => g.delta!),
          geneResults.filter(g => g.group === 'proliferation' && g.delta !== null).map(g => g.delta!)
        ),
    },
  };

  cachedResult = {
    dataset: {
      geoAccession: 'GSE221103',
      title: 'Neuroblastoma MYC ON/OFF State Swap',
      description: 'MYCN-amplified neuroblastoma cells with inducible MYC switch. MYC-ON = proliferative/cancer state, MYC-OFF = differentiated/quiescent state.',
      organism: 'Homo sapiens',
      timepoints: 14,
      samplingInterval: '4h',
      totalGenesMycOn: mycOnData.size,
      totalGenesMycOff: mycOffData.size,
    },
    geneResults,
    groupStats,
    comparisons,
    stateSwapEffects,
    interpretation: buildInterpretation(groupStats, comparisons, stateSwapEffects),
  };

  return cachedResult;
}

function buildInterpretation(stats: any, comp: any, swap: any): string[] {
  const lines: string[] = [];

  const onGap = comp.mycOn.identityVsProlif.medianDiff;
  const offGap = comp.mycOff.identityVsProlif.medianDiff;

  lines.push(`MYC-ON (cancer state): Cell identity markers show median |λ| = ${stats.mycOn.identity.median.toFixed(3)} vs proliferation markers median |λ| = ${stats.mycOn.proliferation.median.toFixed(3)} (Δ = ${onGap > 0 ? '+' : ''}${onGap.toFixed(3)}, Cohen's d = ${comp.mycOn.identityVsProlif.cohenD.toFixed(3)}).`);
  lines.push(`MYC-OFF (differentiated state): Cell identity markers show median |λ| = ${stats.mycOff.identity.median.toFixed(3)} vs proliferation markers median |λ| = ${stats.mycOff.proliferation.median.toFixed(3)} (Δ = ${offGap > 0 ? '+' : ''}${offGap.toFixed(3)}, Cohen's d = ${comp.mycOff.identityVsProlif.cohenD.toFixed(3)}).`);

  if (swap.identityShift.medianDelta > 0) {
    lines.push(`State swap effect: Cell identity markers gain +${swap.identityShift.medianDelta.toFixed(3)} median |λ| when MYC is ON, suggesting cancer state increases temporal persistence of identity genes.`);
  } else {
    lines.push(`State swap effect: Cell identity markers lose ${swap.identityShift.medianDelta.toFixed(3)} median |λ| when MYC is ON, suggesting cancer state decreases temporal persistence of identity genes.`);
  }

  if (swap.prolifShift.medianDelta > 0) {
    lines.push(`Proliferation markers gain +${swap.prolifShift.medianDelta.toFixed(3)} median |λ| when MYC is ON, consistent with increased proliferative drive sustaining expression memory.`);
  } else {
    lines.push(`Proliferation markers show ${swap.prolifShift.medianDelta.toFixed(3)} median |λ| change when MYC switches ON.`);
  }

  return lines;
}
