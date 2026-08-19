import * as fs from 'fs';
import * as path from 'path';

interface GeneResult {
  gene: string;
  eigenvalue: number;
  beta1: number;
  beta2: number;
  r2: number;
}

function computeAR2(timeSeries: number[]): { eigenvalue: number; beta1: number; beta2: number; r2: number } | null {
  const n = timeSeries.length;
  if (n < 5) return null;

  const mean = timeSeries.reduce((a, b) => a + b, 0) / n;
  const centered = timeSeries.map(v => v - mean);

  const Y: number[] = [];
  const X1: number[] = [];
  const X2: number[] = [];

  for (let t = 2; t < n; t++) {
    Y.push(centered[t]);
    X1.push(centered[t - 1]);
    X2.push(centered[t - 2]);
  }

  const m = Y.length;
  if (m < 3) return null;

  let s11 = 0, s12 = 0, s1y = 0, s22 = 0, s2y = 0;
  for (let i = 0; i < m; i++) {
    s11 += X1[i] * X1[i];
    s12 += X1[i] * X2[i];
    s1y += X1[i] * Y[i];
    s22 += X2[i] * X2[i];
    s2y += X2[i] * Y[i];
  }

  const det = s11 * s22 - s12 * s12;
  if (Math.abs(det) < 1e-10) return null;

  const beta1 = (s22 * s1y - s12 * s2y) / det;
  const beta2 = (s11 * s2y - s12 * s1y) / det;

  const disc = beta1 * beta1 + 4 * beta2;
  let eigenvalue: number;
  if (disc >= 0) {
    const l1 = (beta1 + Math.sqrt(disc)) / 2;
    const l2 = (beta1 - Math.sqrt(disc)) / 2;
    eigenvalue = Math.max(Math.abs(l1), Math.abs(l2));
  } else {
    eigenvalue = Math.sqrt(-beta2);
  }

  let ssRes = 0, ssTot = 0;
  const yMean = Y.reduce((a, b) => a + b, 0) / m;
  for (let i = 0; i < m; i++) {
    const pred = beta1 * X1[i] + beta2 * X2[i];
    ssRes += (Y[i] - pred) ** 2;
    ssTot += (Y[i] - yMean) ** 2;
  }
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  return { eigenvalue, beta1, beta2, r2 };
}

function loadCSVDataset(filepath: string): { genes: string[]; data: number[][] } | null {
  try {
    const fullPath = path.join(process.cwd(), 'datasets', filepath);
    if (!fs.existsSync(fullPath)) return null;
    const content = fs.readFileSync(fullPath, 'utf-8');
    const lines = content.trim().split('\n');
    if (lines.length < 3) return null;

    const genes: string[] = [];
    const data: number[][] = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',');
      const geneName = parts[0].replace(/"/g, '').trim();
      const values = parts.slice(1).map(v => parseFloat(v.replace(/"/g, '')) || 0);
      if (values.some(v => v > 0)) {
        genes.push(geneName);
        data.push(values);
      }
    }
    return { genes, data };
  } catch (e) {
    return null;
  }
}

function findGene(genes: string[], target: string): number {
  const upper = target.toUpperCase();
  for (let i = 0; i < genes.length; i++) {
    const g = genes[i].toUpperCase().replace(/"/g, '');
    if (g === upper || g.includes(upper) || g.endsWith('_' + upper)) return i;
  }
  return -1;
}

function analyzeGenePanel(dataset: { genes: string[]; data: number[][] }, geneList: string[]): GeneResult[] {
  const results: GeneResult[] = [];
  for (const gene of geneList) {
    const idx = findGene(dataset.genes, gene);
    if (idx >= 0) {
      const ar2 = computeAR2(dataset.data[idx]);
      if (ar2 && isFinite(ar2.eigenvalue)) {
        results.push({ gene, ...ar2 });
      }
    }
  }
  return results;
}

const CLOCK_GENES = ['Per1', 'Per2', 'Per3', 'Cry1', 'Cry2', 'Clock', 'Arntl', 'Nr1d1', 'Nr1d2', 'Dbp', 'Tef', 'Npas2', 'Rorc'];
const TARGET_GENES = ['Myc', 'Ccnd1', 'Ccnb1', 'Cdk1', 'Wee1', 'Cdkn1a', 'Lgr5', 'Axin2', 'Ctnnb1', 'Apc', 'Tp53', 'Mdm2', 'Atm', 'Chek2', 'Bcl2', 'Bax', 'Pparg', 'Sirt1', 'Hif1a', 'Ccne1', 'Ccne2', 'Mcm6', 'Mki67'];
const P53_PATHWAY = ['Tp53', 'Mdm2', 'Chek2', 'Cdkn1a', 'Bax', 'Bcl2', 'Atm', 'Gadd45a'];

interface DatasetConfig {
  name: string;
  file: string;
  condition: 'healthy' | 'cancer' | 'aging' | 'clock_ko';
}

const DATASETS: DatasetConfig[] = [
  { name: 'Liver (Healthy)', file: 'GSE54650_Liver_circadian.csv', condition: 'healthy' },
  { name: 'Heart (Healthy)', file: 'GSE54650_Heart_circadian.csv', condition: 'healthy' },
  { name: 'Kidney (Healthy)', file: 'GSE54650_Kidney_circadian.csv', condition: 'healthy' },
  { name: 'Lung (Healthy)', file: 'GSE54650_Lung_circadian.csv', condition: 'healthy' },
  { name: 'Muscle (Healthy)', file: 'GSE54650_Muscle_circadian.csv', condition: 'healthy' },
  { name: 'Adrenal (Healthy)', file: 'GSE54650_Adrenal_circadian.csv', condition: 'healthy' },
  { name: 'Hypothalamus (Healthy)', file: 'GSE54650_Hypothalamus_circadian.csv', condition: 'healthy' },
  { name: 'MYC-ON Neuroblastoma', file: 'GSE221103_Neuroblastoma_MYC_ON.csv', condition: 'cancer' },
  { name: 'MYC-OFF Neuroblastoma', file: 'GSE221103_Neuroblastoma_MYC_OFF.csv', condition: 'healthy' },
  { name: 'WT-WT Organoid', file: 'GSE157357_Organoid_WT-WT_circadian.csv', condition: 'healthy' },
  { name: 'ApcKO-WT Organoid', file: 'GSE157357_Organoid_ApcKO-WT_circadian.csv', condition: 'cancer' },
  { name: 'WT-BmalKO Organoid', file: 'GSE157357_Organoid_WT-BmalKO_circadian.csv', condition: 'clock_ko' },
];

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function std(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / (arr.length - 1));
}

function cv(arr: number[]): number {
  const m = mean(arr);
  if (m === 0) return 0;
  return std(arr) / Math.abs(m);
}

console.log('='.repeat(80));
console.log('DESYNCHRONY INDEX & p53-PER2 COUPLING ANALYSIS');
console.log('='.repeat(80));

console.log('\n' + '='.repeat(80));
console.log('PART 1: DESYNCHRONY INDEX');
console.log('Clock gene eigenvalue spread as a measure of internal clock coherence');
console.log('='.repeat(80));

interface DesynchronyResult {
  name: string;
  condition: string;
  clockEigenvalues: { gene: string; value: number }[];
  clockMean: number;
  clockStd: number;
  clockCV: number;
  clockRange: number;
  clockMin: number;
  clockMax: number;
  nClockGenes: number;
  desynchronyIndex: number;
}

const desynchronyResults: DesynchronyResult[] = [];

for (const ds of DATASETS) {
  const data = loadCSVDataset(ds.file);
  if (!data) continue;

  const clockResults = analyzeGenePanel(data, CLOCK_GENES);
  if (clockResults.length < 3) continue;

  const eigenvalues = clockResults.map(r => r.eigenvalue);
  const clockMean = mean(eigenvalues);
  const clockStd_ = std(eigenvalues);
  const clockCV_ = cv(eigenvalues);
  const clockRange = Math.max(...eigenvalues) - Math.min(...eigenvalues);

  const desynchronyIndex = clockCV_ * clockRange;

  desynchronyResults.push({
    name: ds.name,
    condition: ds.condition,
    clockEigenvalues: clockResults.map(r => ({ gene: r.gene, value: r.eigenvalue })),
    clockMean,
    clockStd: clockStd_,
    clockCV: clockCV_,
    clockRange,
    clockMin: Math.min(...eigenvalues),
    clockMax: Math.max(...eigenvalues),
    nClockGenes: clockResults.length,
    desynchronyIndex,
  });
}

console.log('\n| Condition | Clock Mean |λ| | Std Dev | CV | Range | Desync Index | n |');
console.log('|-----------|-----------|---------|------|-------|--------------|---|');

for (const r of desynchronyResults) {
  console.log(`| ${r.name.padEnd(28)} | ${r.clockMean.toFixed(3).padStart(5)} | ${r.clockStd.toFixed(3).padStart(5)} | ${r.clockCV.toFixed(2).padStart(4)} | ${r.clockRange.toFixed(3).padStart(5)} | ${r.desynchronyIndex.toFixed(3).padStart(6)} | ${r.nClockGenes} |`);
}

const healthyDesync = desynchronyResults.filter(r => r.condition === 'healthy').map(r => r.desynchronyIndex);
const cancerDesync = desynchronyResults.filter(r => r.condition === 'cancer').map(r => r.desynchronyIndex);

console.log('\n--- Summary ---');
console.log(`Healthy mean desynchrony: ${mean(healthyDesync).toFixed(3)} (n=${healthyDesync.length})`);
console.log(`Cancer mean desynchrony:  ${mean(cancerDesync).toFixed(3)} (n=${cancerDesync.length})`);
if (cancerDesync.length > 0 && healthyDesync.length > 0) {
  const ratio = mean(cancerDesync) / mean(healthyDesync);
  console.log(`Cancer/Healthy ratio:     ${ratio.toFixed(2)}x`);
  console.log(`Interpretation: ${ratio > 1.2 ? 'Cancer shows HIGHER desynchrony (clock genes less coherent)' : ratio < 0.8 ? 'Cancer shows LOWER desynchrony (clock genes more coherent - unexpected)' : 'Similar desynchrony levels'}`);
}

console.log('\n--- Individual Clock Gene Eigenvalues ---');
for (const r of desynchronyResults) {
  const geneStr = r.clockEigenvalues.map(g => `${g.gene}=${g.value.toFixed(3)}`).join(', ');
  console.log(`${r.name}: ${geneStr}`);
}

console.log('\n' + '='.repeat(80));
console.log('PART 2: p53-PER2 BIDIRECTIONAL COUPLING ANALYSIS');
console.log('Do DNA damage response genes track with clock or target eigenvalues?');
console.log('='.repeat(80));

interface P53Result {
  name: string;
  condition: string;
  clockMean: number;
  targetMean: number;
  p53Genes: { gene: string; eigenvalue: number }[];
  p53Mean: number;
  p53CloserTo: 'clock' | 'target' | 'between';
  per2Eigenvalue: number | null;
  tp53Eigenvalue: number | null;
  per2Tp53Gap: number | null;
}

const p53Results: P53Result[] = [];

for (const ds of DATASETS) {
  const data = loadCSVDataset(ds.file);
  if (!data) continue;

  const clockResults = analyzeGenePanel(data, CLOCK_GENES);
  const targetResults = analyzeGenePanel(data, TARGET_GENES);
  const p53PathwayResults = analyzeGenePanel(data, P53_PATHWAY);

  if (clockResults.length < 3 || targetResults.length < 2) continue;

  const clockMean_ = mean(clockResults.map(r => r.eigenvalue));
  const targetMean_ = mean(targetResults.map(r => r.eigenvalue));
  const p53Mean_ = p53PathwayResults.length > 0 ? mean(p53PathwayResults.map(r => r.eigenvalue)) : NaN;

  let closerTo: 'clock' | 'target' | 'between' = 'between';
  if (!isNaN(p53Mean_)) {
    const distToClock = Math.abs(p53Mean_ - clockMean_);
    const distToTarget = Math.abs(p53Mean_ - targetMean_);
    if (distToClock < distToTarget * 0.7) closerTo = 'clock';
    else if (distToTarget < distToClock * 0.7) closerTo = 'target';
  }

  const per2 = clockResults.find(r => r.gene === 'Per2');
  const tp53 = p53PathwayResults.find(r => r.gene === 'Tp53');

  p53Results.push({
    name: ds.name,
    condition: ds.condition,
    clockMean: clockMean_,
    targetMean: targetMean_,
    p53Genes: p53PathwayResults.map(r => ({ gene: r.gene, eigenvalue: r.eigenvalue })),
    p53Mean: p53Mean_,
    p53CloserTo: closerTo,
    per2Eigenvalue: per2 ? per2.eigenvalue : null,
    tp53Eigenvalue: tp53 ? tp53.eigenvalue : null,
    per2Tp53Gap: (per2 && tp53) ? per2.eigenvalue - tp53.eigenvalue : null,
  });
}

console.log('\n| Condition | Clock |λ| | Target |λ| | p53 Path |λ| | p53 Closer To | Per2 | Tp53 | Gap |');
console.log('|-----------|---------|-----------|------------|---------------|------|------|-----|');

for (const r of p53Results) {
  const p53Str = isNaN(r.p53Mean) ? 'N/A' : r.p53Mean.toFixed(3);
  const per2Str = r.per2Eigenvalue !== null ? r.per2Eigenvalue.toFixed(3) : 'N/A';
  const tp53Str = r.tp53Eigenvalue !== null ? r.tp53Eigenvalue.toFixed(3) : 'N/A';
  const gapStr = r.per2Tp53Gap !== null ? (r.per2Tp53Gap >= 0 ? '+' : '') + r.per2Tp53Gap.toFixed(3) : 'N/A';
  console.log(`| ${r.name.padEnd(28)} | ${r.clockMean.toFixed(3)} | ${r.targetMean.toFixed(3).padStart(5)} | ${p53Str.padStart(5)} | ${r.p53CloserTo.padEnd(7)} | ${per2Str} | ${tp53Str} | ${gapStr} |`);
}

console.log('\n--- p53 Pathway Gene Details ---');
for (const r of p53Results) {
  if (r.p53Genes.length > 0) {
    const geneStr = r.p53Genes.map(g => `${g.gene}=${g.eigenvalue.toFixed(3)}`).join(', ');
    console.log(`${r.name}: ${geneStr}`);
  }
}

const healthyP53 = p53Results.filter(r => r.condition === 'healthy' && !isNaN(r.p53Mean));
const cancerP53 = p53Results.filter(r => r.condition === 'cancer' && !isNaN(r.p53Mean));

console.log('\n--- Summary ---');
if (healthyP53.length > 0) {
  console.log(`Healthy: p53 pathway mean |λ| = ${mean(healthyP53.map(r => r.p53Mean)).toFixed(3)}`);
  console.log(`  Clock mean = ${mean(healthyP53.map(r => r.clockMean)).toFixed(3)}, Target mean = ${mean(healthyP53.map(r => r.targetMean)).toFixed(3)}`);
  const closerCounts = { clock: 0, target: 0, between: 0 };
  healthyP53.forEach(r => closerCounts[r.p53CloserTo]++);
  console.log(`  p53 closer to: clock=${closerCounts.clock}, target=${closerCounts.target}, between=${closerCounts.between}`);
}
if (cancerP53.length > 0) {
  console.log(`Cancer: p53 pathway mean |λ| = ${mean(cancerP53.map(r => r.p53Mean)).toFixed(3)}`);
  console.log(`  Clock mean = ${mean(cancerP53.map(r => r.clockMean)).toFixed(3)}, Target mean = ${mean(cancerP53.map(r => r.targetMean)).toFixed(3)}`);
  const closerCounts = { clock: 0, target: 0, between: 0 };
  cancerP53.forEach(r => closerCounts[r.p53CloserTo]++);
  console.log(`  p53 closer to: clock=${closerCounts.clock}, target=${closerCounts.target}, between=${closerCounts.between}`);
}

const per2Tp53Gaps = p53Results.filter(r => r.per2Tp53Gap !== null);
if (per2Tp53Gaps.length > 0) {
  console.log(`\n--- PER2-TP53 Coupling ---`);
  const healthyGaps = per2Tp53Gaps.filter(r => r.condition === 'healthy');
  const cancerGaps = per2Tp53Gaps.filter(r => r.condition === 'cancer');
  if (healthyGaps.length > 0) {
    console.log(`Healthy Per2-Tp53 gap: ${mean(healthyGaps.map(r => r.per2Tp53Gap!)).toFixed(3)} (Per2 ${mean(healthyGaps.map(r => r.per2Tp53Gap!)) > 0 ? '>' : '<'} Tp53)`);
  }
  if (cancerGaps.length > 0) {
    console.log(`Cancer Per2-Tp53 gap:  ${mean(cancerGaps.map(r => r.per2Tp53Gap!)).toFixed(3)} (Per2 ${mean(cancerGaps.map(r => r.per2Tp53Gap!)) > 0 ? '>' : '<'} Tp53)`);
  }
}

console.log('\n' + '='.repeat(80));
console.log('ANALYSIS COMPLETE');
console.log('='.repeat(80));
