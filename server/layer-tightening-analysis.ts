import * as fs from 'fs';
import * as path from 'path';

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
      genes.push(parts[0].replace(/"/g, '').trim());
      data.push(parts.slice(1).map(v => parseFloat(v.replace(/"/g, '')) || 0));
    }
    return { genes, data };
  } catch (e) { return null; }
}

function findGene(genes: string[], target: string): number {
  const upper = target.toUpperCase();
  for (let i = 0; i < genes.length; i++) {
    if (genes[i].toUpperCase().replace(/"/g, '') === upper) return i;
  }
  return -1;
}

function fitAR1(ts: number[]): { eigenvalue: number; residuals: number[] } {
  const n = ts.length;
  const mean = ts.reduce((a, b) => a + b, 0) / n;
  const c = ts.map(v => v - mean);
  let sxy = 0, sxx = 0;
  for (let t = 1; t < n; t++) { sxy += c[t]*c[t-1]; sxx += c[t-1]*c[t-1]; }
  const b1 = sxx > 0 ? sxy/sxx : 0;
  const residuals: number[] = [];
  for (let t = 1; t < n; t++) residuals.push(c[t] - b1*c[t-1]);
  return { eigenvalue: Math.abs(b1), residuals };
}

function fitAR2(ts: number[]): { eigenvalue: number; beta1: number; beta2: number; residuals: number[] } {
  const n = ts.length;
  const mean = ts.reduce((a, b) => a + b, 0) / n;
  const c = ts.map(v => v - mean);
  const Y: number[] = [], X1: number[] = [], X2: number[] = [];
  for (let t = 2; t < n; t++) { Y.push(c[t]); X1.push(c[t-1]); X2.push(c[t-2]); }
  const m = Y.length;
  let s11=0,s12=0,s1y=0,s22=0,s2y=0;
  for (let i = 0; i < m; i++) { s11+=X1[i]*X1[i]; s12+=X1[i]*X2[i]; s1y+=X1[i]*Y[i]; s22+=X2[i]*X2[i]; s2y+=X2[i]*Y[i]; }
  const det = s11*s22-s12*s12;
  if (Math.abs(det) < 1e-10) return { eigenvalue: 0, beta1: 0, beta2: 0, residuals: [] };
  const beta1 = (s22*s1y-s12*s2y)/det;
  const beta2 = (s11*s2y-s12*s1y)/det;
  const disc = beta1*beta1+4*beta2;
  let eigenvalue: number;
  if (disc >= 0) { const l1=(beta1+Math.sqrt(disc))/2; const l2=(beta1-Math.sqrt(disc))/2; eigenvalue=Math.max(Math.abs(l1),Math.abs(l2)); }
  else eigenvalue = Math.sqrt(-beta2);
  const residuals: number[] = [];
  for (let i = 0; i < m; i++) residuals.push(Y[i]-beta1*X1[i]-beta2*X2[i]);
  return { eigenvalue, beta1, beta2, residuals };
}

function fitAR3(ts: number[]): { eigenvalue: number; residuals: number[] } {
  const n = ts.length;
  if (n < 6) return { eigenvalue: 0, residuals: [] };
  const mean = ts.reduce((a, b) => a + b, 0) / n;
  const c = ts.map(v => v - mean);
  const Y: number[] = [], X: number[][] = [];
  for (let t = 3; t < n; t++) { Y.push(c[t]); X.push([c[t-1],c[t-2],c[t-3]]); }
  const m = Y.length;
  const XtX = [[0,0,0],[0,0,0],[0,0,0]];
  const XtY = [0,0,0];
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < 3; j++) { XtY[j]+=X[i][j]*Y[i]; for (let k = 0; k < 3; k++) XtX[j][k]+=X[i][j]*X[i][k]; }
  }
  const det3 = (m: number[][]) => m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1])-m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0])+m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]);
  const det = det3(XtX);
  if (Math.abs(det) < 1e-10) return { eigenvalue: 0, residuals: [] };
  const replace = (mat: number[][], col: number, vec: number[]) => mat.map((row, i) => row.map((val, j) => j===col?vec[i]:val));
  const b1 = det3(replace(XtX,0,XtY))/det;
  const b2 = det3(replace(XtX,1,XtY))/det;
  const b3 = det3(replace(XtX,2,XtY))/det;
  const residuals: number[] = [];
  for (let i = 0; i < m; i++) residuals.push(Y[i]-b1*X[i][0]-b2*X[i][1]-b3*X[i][2]);
  const poly = (x: number) => x*x*x-b1*x*x-b2*x-b3;
  const dpoly = (x: number) => 3*x*x-2*b1*x-b2;
  let lambda = 1.0;
  for (let iter = 0; iter < 20; iter++) { const d = dpoly(lambda); if (Math.abs(d)<1e-10) break; lambda -= poly(lambda)/d; }
  return { eigenvalue: Math.abs(lambda), residuals };
}

function ljungBox(residuals: number[], lags: number = 5): { stat: number; pValue: number; pass: boolean } {
  const n = residuals.length;
  if (n < lags + 2) return { stat: 0, pValue: 1, pass: true };
  let Q = 0;
  for (let k = 1; k <= lags; k++) {
    let num = 0, den = 0;
    for (let t = k; t < n; t++) num += residuals[t]*residuals[t-k];
    for (let t = 0; t < n; t++) den += residuals[t]*residuals[t];
    const rho = den > 0 ? num/den : 0;
    Q += (rho*rho)/(n-k);
  }
  Q *= n*(n+2);
  // chi-squared approximation for p-value (lags df)
  // Using Wilson-Hilferty approximation
  const df = lags;
  const z = Math.pow(Q/df, 1/3) - (1 - 2/(9*df));
  const denom = Math.sqrt(2/(9*df));
  const zScore = z/denom;
  const pValue = 1 - 0.5*(1+erf(zScore/Math.sqrt(2)));
  return { stat: Q, pValue: Math.max(0, Math.min(1, pValue)), pass: pValue > 0.05 };
}

function erf(x: number): number {
  const a1=0.254829592, a2=-0.284496736, a3=1.421413741, a4=-1.453152027, a5=1.061405429, p=0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const t = 1/(1+p*x);
  const y = 1-((((a5*t+a4)*t+a3)*t+a2)*t+a1)*t*Math.exp(-x*x);
  return sign*y;
}

const CLOCK = ['Per1','Per2','Cry1','Cry2','Clock','Arntl','Nr1d1','Nr1d2'];
const TARGET = ['Myc','Ccnd1','Wee1','Cdk1','Ccnb1','Lgr5','Axin2','Cdkn1a'];
const P53 = ['Tp53','Mdm2','Chek2','Cdkn1a','Bax','Bcl2','Atm','Gadd45a'];
const ALL_GENES = [...new Set([...CLOCK, ...TARGET, ...P53])];

const dataset = loadCSVDataset('GSE54650_Liver_circadian.csv');
if (!dataset) { console.log('Failed to load dataset'); process.exit(1); }

console.log('='  .repeat(80));
console.log('LAYER 1: AR(1) vs AR(2) vs AR(3) COMPREHENSIVE COMPARISON');
console.log('Dataset: GSE54650 Liver (24 timepoints)');
console.log('Ljung-Box: lags=5, α=0.05');
console.log('='.repeat(80));

console.log('\n### Per-Gene Model Comparison\n');
console.log('| Gene | Type | AR(1) |λ| | AR(1) LB | AR(2) |λ| | AR(2) LB | AR(3) |λ| | AR(3) LB |');
console.log('|------|------|---------|---------|---------|---------|---------|---------|');

interface GeneModelComparison {
  gene: string;
  type: string;
  ar1: { eigenvalue: number; lbPass: boolean; lbP: number };
  ar2: { eigenvalue: number; lbPass: boolean; lbP: number };
  ar3: { eigenvalue: number; lbPass: boolean; lbP: number };
}

const comparisons: GeneModelComparison[] = [];

for (const gene of [...CLOCK, ...TARGET]) {
  const idx = findGene(dataset.genes, gene);
  if (idx < 0) continue;
  const ts = dataset.data[idx];
  const type = CLOCK.includes(gene) ? 'CLOCK' : 'TARGET';
  
  const ar1 = fitAR1(ts);
  const ar2 = fitAR2(ts);
  const ar3 = fitAR3(ts);
  
  const lb1 = ljungBox(ar1.residuals, 5);
  const lb2 = ljungBox(ar2.residuals, 5);
  const lb3 = ljungBox(ar3.residuals, 5);
  
  comparisons.push({
    gene, type,
    ar1: { eigenvalue: ar1.eigenvalue, lbPass: lb1.pass, lbP: lb1.pValue },
    ar2: { eigenvalue: ar2.eigenvalue, lbPass: lb2.pass, lbP: lb2.pValue },
    ar3: { eigenvalue: ar3.eigenvalue, lbPass: lb3.pass, lbP: lb3.pValue },
  });
  
  const lb1Str = lb1.pass ? `✓ p=${lb1.pValue.toFixed(2)}` : `✗ p=${lb1.pValue.toFixed(2)}`;
  const lb2Str = lb2.pass ? `✓ p=${lb2.pValue.toFixed(2)}` : `✗ p=${lb2.pValue.toFixed(2)}`;
  const lb3Str = lb3.pass ? `✓ p=${lb3.pValue.toFixed(2)}` : `✗ p=${lb3.pValue.toFixed(2)}`;
  
  console.log(`| ${gene.padEnd(6)} | ${type.padEnd(6)} | ${ar1.eigenvalue.toFixed(3)} | ${lb1Str.padEnd(10)} | ${ar2.eigenvalue.toFixed(3)} | ${lb2Str.padEnd(10)} | ${ar3.eigenvalue.toFixed(3)} | ${lb3Str.padEnd(10)} |`);
}

// Summary by model order
console.log('\n### Summary: Clock-Target Gap by Model Order\n');

const clockComps = comparisons.filter(c => c.type === 'CLOCK');
const targetComps = comparisons.filter(c => c.type === 'TARGET');

const mean = (arr: number[]) => arr.length > 0 ? arr.reduce((a,b) => a+b, 0)/arr.length : 0;

for (const order of ['ar1', 'ar2', 'ar3'] as const) {
  const clockMean = mean(clockComps.map(c => c[order].eigenvalue));
  const targetMean = mean(targetComps.map(c => c[order].eigenvalue));
  const gap = clockMean - targetMean;
  const clockLBPass = clockComps.filter(c => c[order].lbPass).length;
  const targetLBPass = targetComps.filter(c => c[order].lbPass).length;
  const totalLBPass = clockLBPass + targetLBPass;
  const total = clockComps.length + targetComps.length;
  
  console.log(`${order.toUpperCase()}: Clock=${clockMean.toFixed(3)}, Target=${targetMean.toFixed(3)}, Gap=+${gap.toFixed(3)}, LB pass=${totalLBPass}/${total} (${(100*totalLBPass/total).toFixed(0)}%)`);
}

// Which genes failed Ljung-Box for AR(2)?
console.log('\n### Ljung-Box Failures (AR(2), lags=5, α=0.05)\n');
const failures = comparisons.filter(c => !c.ar2.lbPass);
if (failures.length === 0) {
  console.log('No genes failed Ljung-Box test for AR(2).');
} else {
  for (const f of failures) {
    console.log(`- ${f.gene} (${f.type}): p=${f.ar2.lbP.toFixed(4)} — residuals show remaining autocorrelation`);
  }
}

// Does AR(3) improve residual whiteness over AR(2)?
console.log('\n### AR(3) vs AR(2) Residual Improvement\n');
const ar2Fails = comparisons.filter(c => !c.ar2.lbPass);
const ar3FixesAr2 = ar2Fails.filter(c => c.ar3.lbPass);
console.log(`Genes failing AR(2) LB: ${ar2Fails.length}`);
console.log(`Of those, fixed by AR(3): ${ar3FixesAr2.length}`);
console.log(`AR(3) systematic improvement: ${ar3FixesAr2.length === ar2Fails.length ? 'YES' : 'PARTIAL/NO'}`);

// ============================================================
// LAYER 3: Correlations between dimensions
// ============================================================
console.log('\n' + '='.repeat(80));
console.log('LAYER 3: CORRELATIONS BETWEEN DIMENSIONS');
console.log('Testing independence of mean eigenvalue, desynchrony, and p53 axis');
console.log('='.repeat(80));

interface ConditionMetrics {
  name: string;
  condition: string;
  clockMean: number;
  targetMean: number;
  gap: number;
  desyncCV: number;
  p53Mean: number;
}

const DATASETS = [
  { name: 'Liver', file: 'GSE54650_Liver_circadian.csv', condition: 'healthy' },
  { name: 'Heart', file: 'GSE54650_Heart_circadian.csv', condition: 'healthy' },
  { name: 'Kidney', file: 'GSE54650_Kidney_circadian.csv', condition: 'healthy' },
  { name: 'Lung', file: 'GSE54650_Lung_circadian.csv', condition: 'healthy' },
  { name: 'Muscle', file: 'GSE54650_Muscle_circadian.csv', condition: 'healthy' },
  { name: 'Adrenal', file: 'GSE54650_Adrenal_circadian.csv', condition: 'healthy' },
  { name: 'Hypothalamus', file: 'GSE54650_Hypothalamus_circadian.csv', condition: 'healthy' },
  { name: 'MYC-ON', file: 'GSE221103_Neuroblastoma_MYC_ON.csv', condition: 'cancer' },
  { name: 'MYC-OFF', file: 'GSE221103_Neuroblastoma_MYC_OFF.csv', condition: 'healthy' },
];

const metrics: ConditionMetrics[] = [];

for (const ds of DATASETS) {
  const data = loadCSVDataset(ds.file);
  if (!data) continue;
  
  const clockEVs: number[] = [];
  const targetEVs: number[] = [];
  const p53EVs: number[] = [];
  
  for (const g of CLOCK) { const idx = findGene(data.genes, g); if (idx >= 0) { const r = fitAR2(data.data[idx]); if (isFinite(r.eigenvalue)) clockEVs.push(r.eigenvalue); } }
  for (const g of TARGET) { const idx = findGene(data.genes, g); if (idx >= 0) { const r = fitAR2(data.data[idx]); if (isFinite(r.eigenvalue)) targetEVs.push(r.eigenvalue); } }
  for (const g of P53) { const idx = findGene(data.genes, g); if (idx >= 0) { const r = fitAR2(data.data[idx]); if (isFinite(r.eigenvalue)) p53EVs.push(r.eigenvalue); } }
  
  if (clockEVs.length < 3) continue;
  
  const clockMean = mean(clockEVs);
  const targetMean = mean(targetEVs);
  const std = (arr: number[]) => { const m = mean(arr); return Math.sqrt(arr.reduce((a,b)=>a+(b-m)**2,0)/(arr.length-1)); };
  const cv = clockMean > 0 ? std(clockEVs)/clockMean : 0;
  
  metrics.push({
    name: ds.name,
    condition: ds.condition,
    clockMean,
    targetMean,
    gap: clockMean - targetMean,
    desyncCV: cv,
    p53Mean: p53EVs.length > 0 ? mean(p53EVs) : NaN,
  });
}

console.log('\n| Condition | Clock Mean | Gap | Desync CV | p53 Mean |');
console.log('|-----------|-----------|------|----------|---------|');
for (const m of metrics) {
  console.log(`| ${m.name.padEnd(14)} | ${m.clockMean.toFixed(3)} | ${(m.gap>=0?'+':'')+m.gap.toFixed(3)} | ${m.desyncCV.toFixed(3)} | ${isNaN(m.p53Mean)?'N/A':m.p53Mean.toFixed(3)} |`);
}

// Pearson correlations
function pearson(x: number[], y: number[]): number {
  const n = x.length;
  const mx = mean(x), my = mean(y);
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) { num += (x[i]-mx)*(y[i]-my); dx += (x[i]-mx)**2; dy += (y[i]-my)**2; }
  return (dx > 0 && dy > 0) ? num/Math.sqrt(dx*dy) : 0;
}

const validMetrics = metrics.filter(m => !isNaN(m.p53Mean));
const gaps = validMetrics.map(m => m.gap);
const desyncs = validMetrics.map(m => m.desyncCV);
const p53s = validMetrics.map(m => m.p53Mean);
const clockMeans = validMetrics.map(m => m.clockMean);

console.log('\n### Pairwise Correlations (n=' + validMetrics.length + ' conditions)\n');
console.log(`| Pair | r | Interpretation |`);
console.log('|------|-----|----------------|');

const r_gap_desync = pearson(gaps, desyncs);
const r_gap_p53 = pearson(gaps, p53s);
const r_desync_p53 = pearson(desyncs, p53s);
const r_clock_desync = pearson(clockMeans, desyncs);

const interp = (r: number) => Math.abs(r) < 0.3 ? 'Weak → largely independent' : Math.abs(r) < 0.6 ? 'Moderate → partially related' : 'Strong → correlated';

console.log(`| Gap vs Desync CV | ${r_gap_desync.toFixed(3)} | ${interp(r_gap_desync)} |`);
console.log(`| Gap vs p53 Mean  | ${r_gap_p53.toFixed(3)} | ${interp(r_gap_p53)} |`);
console.log(`| Desync vs p53    | ${r_desync_p53.toFixed(3)} | ${interp(r_desync_p53)} |`);
console.log(`| Clock Mean vs Desync | ${r_clock_desync.toFixed(3)} | ${interp(r_clock_desync)} |`);

console.log('\n' + '='.repeat(80));
console.log('ANALYSIS COMPLETE');
console.log('='.repeat(80));
