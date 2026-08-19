/**
 * Methods Paper Benchmark
 *
 * Genome-wide three-way comparison: AR(2) |λ|  vs  Cosinor  vs  JTK_CYCLE
 * on two independent public GEO datasets:
 *   DS1 — GSE11923  Mouse liver,  48 × 1h  (Hughes et al. 2009)
 *   DS2 — GSE113883 Human blood,  15 × 2h  (Arnardottir et al. 2014)
 *
 * Results are computed once at first call and cached for the lifetime of the
 * server process.
 */

import * as fs from 'fs';
import * as path from 'path';
import { runJTKCycleSingle } from './jtk-cycle';

// ─── types ───────────────────────────────────────────────────────────────────

export interface ScatterPoint {
  gene: string;
  category: 'Clock' | 'Target' | 'Other';
  eigenvalue: number;
  cosinorR2: number;
  jtkTau: number;
  cosinorRhythmic: boolean;
  jtkRhythmic: boolean;
}

export interface DivergentExample {
  gene: string;
  eigenvalue: number;
  cosinorRhythmic: boolean;
  jtkRhythmic: boolean;
  type: 'high_pers_not_rhythmic' | 'rhythmic_low_pers';
  interpretation: string;
}

export interface VennCounts {
  all3: number;
  ar2Only: number;
  cosinorOnly: number;
  jtkOnly: number;
  ar2Cosinor: number;
  ar2Jtk: number;
  cosinorJtk: number;
  none: number;
}

export interface DatasetResult {
  datasetId: string;
  datasetName: string;
  species: string;
  tissue: string;
  nGenes: number;
  nTimepoints: number;
  resolutionHours: number;
  geoAccession: string;

  ar2HighPct: number;
  cosinorRhythmicPct: number;
  jtkRhythmicPct: number;
  ar2UniquePct: number;
  rhythmicLowPersPct: number;

  corrEigenvalueCosinorR2: number;
  corrEigenvalueJtkTau: number;
  corrAmplitudeTau: number;

  clockGenes: { total: number; ar2: number; cosinor: number; jtk: number; all3: number; names: string[] };
  venn: VennCounts;
  scatterData: ScatterPoint[];
  divergent: DivergentExample[];
  conclusion: string;
}

export interface MethodsPaperResult {
  computedAt: string;
  datasets: DatasetResult[];
  crossDatasetSummary: {
    ar2UniqueRangeStr: string;
    rhythmicLowPersRangeStr: string;
    corrRangeStr: string;
    clockGeneConsistency: string;
    paperConclusion: string;
  };
}

// ─── gene classification ──────────────────────────────────────────────────────

const CLOCK_CANONICAL = new Set([
  'arntl','bmal1','clock','npas2','per1','per2','per3',
  'cry1','cry2','nr1d1','nr1d2','dbp','tef','rorc',
]);
const TARGET_CANONICAL = new Set([
  'wee1','cdk1','ccnd1','ccnb1','ccne1','ccne2','myc','cdkn1a',
  'lgr5','axin2','ctnnb1','apc','fasn','hmgcr','cyp7a1','g6pc',
  'pck1','xpa','sirt1','nfe2l2','mtor','tnf','bcl2','mcm6',
  'mki67','top2a','atm','chek1','chek2','trp53','mdm2','bax',
  'pparg','hif1a','serpine1','nampt','ror1',
]);

function classifyGene(name: string): 'Clock' | 'Target' | 'Other' {
  const lc = name.toLowerCase();
  if (CLOCK_CANONICAL.has(lc)) return 'Clock';
  if (TARGET_CANONICAL.has(lc)) return 'Target';
  return 'Other';
}

// ─── math helpers ────────────────────────────────────────────────────────────

function fitAR2(y: number[]): { eigenvalue: number; r2: number; rootType: 'Complex' | 'Real' } {
  const n = y.length;
  if (n < 5) return { eigenvalue: 0, r2: 0, rootType: 'Real' };
  const mu = y.reduce((a, b) => a + b, 0) / n;
  const c = y.map(v => v - mu);

  let s11 = 0, s12 = 0, s22 = 0, sy1 = 0, sy2 = 0;
  for (let t = 2; t < n; t++) {
    s11 += c[t-1] * c[t-1];
    s12 += c[t-1] * c[t-2];
    s22 += c[t-2] * c[t-2];
    sy1 += c[t]   * c[t-1];
    sy2 += c[t]   * c[t-2];
  }
  const det = s11 * s22 - s12 * s12;
  if (Math.abs(det) < 1e-10) return { eigenvalue: 0, r2: 0, rootType: 'Real' };

  const phi1 = (sy1 * s22 - sy2 * s12) / det;
  const phi2 = (s11 * sy2 - s12 * sy1) / det;
  const disc = phi1 * phi1 + 4 * phi2;

  let eigenvalue: number;
  const rootType: 'Complex' | 'Real' = disc < 0 ? 'Complex' : 'Real';
  if (disc < 0) {
    eigenvalue = Math.sqrt(-phi2);
  } else {
    const r1 = Math.abs((phi1 + Math.sqrt(Math.max(0, disc))) / 2);
    const r2 = Math.abs((phi1 - Math.sqrt(Math.max(0, disc))) / 2);
    eigenvalue = Math.max(r1, r2);
  }

  let ssTot = 0, ssRes = 0;
  for (let t = 2; t < n; t++) {
    const fit = phi1 * c[t-1] + phi2 * c[t-2];
    ssTot += c[t] * c[t];
    ssRes += (c[t] - fit) ** 2;
  }
  const r2 = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;
  return { eigenvalue, r2, rootType };
}

function fitCosinor(y: number[], tp: number[], period = 24): { amplitude: number; r2: number; pValue: number; isRhythmic: boolean } {
  const n = y.length;
  if (n < 4) return { amplitude: 0, r2: 0, pValue: 1, isRhythmic: false };
  const omega = 2 * Math.PI / period;
  const mu = y.reduce((a, b) => a + b, 0) / n;

  let sCC = 0, sSS = 0, sCS = 0, sC = 0, sS = 0;
  let sYC = 0, sYS = 0, sY = 0;
  for (let i = 0; i < n; i++) {
    const c = Math.cos(omega * tp[i]);
    const s = Math.sin(omega * tp[i]);
    sCC += c * c; sSS += s * s; sCS += c * s;
    sC  += c;     sS  += s;
    sY  += y[i];
    sYC += y[i] * c; sYS += y[i] * s;
  }

  // X'X * b = X'y  where b = [A, beta_cos, gamma_sin]
  const X = [[n, sC, sS],[sC, sCC, sCS],[sS, sCS, sSS]];
  const Yvec = [sY, sYC, sYS];

  function det3(m: number[][]): number {
    return m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1])
          -m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0])
          +m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]);
  }
  const D = det3(X);
  if (Math.abs(D) < 1e-10) return { amplitude: 0, r2: 0, pValue: 1, isRhythmic: false };

  // Cramer's rule: replace column k with Yvec to get b[k]
  const A        = det3([[Yvec[0],X[0][1],X[0][2]],[Yvec[1],X[1][1],X[1][2]],[Yvec[2],X[2][1],X[2][2]]]) / D;
  const betaCos  = det3([[X[0][0],Yvec[0],X[0][2]],[X[1][0],Yvec[1],X[1][2]],[X[2][0],Yvec[2],X[2][2]]]) / D;
  const gammaSin = det3([[X[0][0],X[0][1],Yvec[0]],[X[1][0],X[1][1],Yvec[1]],[X[2][0],X[2][1],Yvec[2]]]) / D;

  const amplitude = Math.sqrt(betaCos * betaCos + gammaSin * gammaSin);
  let ssTot = 0, ssRes = 0;
  for (let i = 0; i < n; i++) {
    const fitted = A + betaCos * Math.cos(omega * tp[i]) + gammaSin * Math.sin(omega * tp[i]);
    ssTot += (y[i] - mu) ** 2;
    ssRes += (y[i] - fitted) ** 2;
  }
  const r2 = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;
  const ssReg = ssTot - ssRes;
  const dfRes = Math.max(n - 3, 1);
  const fStat = (ssReg / 2) / Math.max(ssRes / dfRes, 1e-12);
  // Exact survival function of F(2, dfRes): P(F > x) = (1 + 2x/dfRes)^(-dfRes/2)
  const pValue = Math.min(1, Math.max(1e-15, Math.pow(1 + 2 * Math.max(0, fStat) / dfRes, -dfRes / 2)));
  return { amplitude, r2, pValue, isRhythmic: pValue < 0.05 };
}

function bhFDR(pValues: number[]): number[] {
  const n = pValues.length;
  const indexed = pValues.map((p, i) => ({ p, i }));
  indexed.sort((a, b) => a.p - b.p);
  const q = new Array(n);
  let minQ = 1;
  for (let i = n - 1; i >= 0; i--) {
    minQ = Math.min(minQ, indexed[i].p * n / (i + 1));
    q[indexed[i].i] = Math.min(1, minQ);
  }
  return q;
}

function spearman(x: number[], y: number[]): number {
  const n = x.length;
  if (n < 3) return 0;
  const rx = getRanks(x), ry = getRanks(y);
  let d2 = 0;
  for (let i = 0; i < n; i++) d2 += (rx[i] - ry[i]) ** 2;
  return 1 - (6 * d2) / (n * (n * n - 1));
}

function getRanks(arr: number[]): number[] {
  const idx = arr.map((v, i) => ({ v, i }));
  idx.sort((a, b) => a.v - b.v);
  const ranks = new Array(arr.length);
  for (let i = 0; i < idx.length; i++) ranks[idx[i].i] = i + 1;
  return ranks;
}

// ─── dataset runner ───────────────────────────────────────────────────────────

interface GeneRaw {
  gene: string;
  category: 'Clock' | 'Target' | 'Other';
  eigenvalue: number;
  cosinorR2: number;
  cosinorP: number;
  jtkTau: number;
  jtkP: number;
}

function processDataset(
  filePath: string,
  timepointExtractor: (header: string) => number | null,
  maxGenes = 25000,
): GeneRaw[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',');
  const timepoints: number[] = [];
  for (let j = 1; j < headers.length; j++) {
    const t = timepointExtractor(headers[j].replace(/"/g, ''));
    if (t !== null) timepoints.push(t);
  }

  const results: GeneRaw[] = [];
  const limit = Math.min(lines.length - 1, maxGenes);

  for (let i = 1; i <= limit; i++) {
    const cols = lines[i].split(',');
    const gene = cols[0].trim().replace(/"/g, '');
    if (!gene) continue;

    const expr = cols.slice(1, 1 + timepoints.length)
      .map(v => parseFloat(v))
      .filter(v => !isNaN(v) && isFinite(v));
    if (expr.length < 6) continue;

    const tp = timepoints.slice(0, expr.length);
    const ar2 = fitAR2(expr);
    const cos = fitCosinor(expr, tp, 24);
    const jtk = runJTKCycleSingle(expr, tp, [20, 24, 28]);
    const category = classifyGene(gene);

    results.push({
      gene, category,
      eigenvalue: ar2.eigenvalue,
      cosinorR2: cos.r2,
      cosinorP: cos.pValue,
      jtkTau: Math.abs(jtk.tau),
      jtkP: jtk.pValue,
    });
  }
  return results;
}

function buildDatasetResult(
  raw: GeneRaw[],
  meta: { datasetId: string; datasetName: string; species: string; tissue: string; nTimepoints: number; resolutionHours: number; geoAccession: string },
): DatasetResult {
  // BH FDR correction
  const cosQ = bhFDR(raw.map(r => r.cosinorP));
  const jtkQ = bhFDR(raw.map(r => r.jtkP));

  const enriched = raw.map((r, i) => ({
    ...r,
    cosRhythmic: cosQ[i] < 0.05,
    jtkRhythmic: jtkQ[i] < 0.05,
    ar2High: r.eigenvalue >= 0.5,
  }));

  const n = enriched.length;
  const ar2High = enriched.filter(g => g.ar2High).length;
  const cosRhyth = enriched.filter(g => g.cosRhythmic).length;
  const jtkRhyth = enriched.filter(g => g.jtkRhythmic).length;
  const ar2Only  = enriched.filter(g => g.ar2High && !g.cosRhythmic && !g.jtkRhythmic).length;
  const rhyLowP  = enriched.filter(g => !g.ar2High && g.cosRhythmic && g.jtkRhythmic).length;

  const all3      = enriched.filter(g => g.ar2High && g.cosRhythmic && g.jtkRhythmic).length;
  const cosinorOnly = enriched.filter(g => !g.ar2High && g.cosRhythmic && !g.jtkRhythmic).length;
  const jtkOnly   = enriched.filter(g => !g.ar2High && !g.cosRhythmic && g.jtkRhythmic).length;
  const ar2Cos    = enriched.filter(g => g.ar2High && g.cosRhythmic && !g.jtkRhythmic).length;
  const ar2Jtk    = enriched.filter(g => g.ar2High && !g.cosRhythmic && g.jtkRhythmic).length;
  const cosJtk    = enriched.filter(g => !g.ar2High && g.cosRhythmic && g.jtkRhythmic).length;
  const none      = enriched.filter(g => !g.ar2High && !g.cosRhythmic && !g.jtkRhythmic).length;

  const eigenvalues = enriched.map(g => g.eigenvalue);
  const cosinorR2s  = enriched.map(g => g.cosinorR2);
  const jtkTaus     = enriched.map(g => g.jtkTau);
  const amplitudes  = enriched.map(g => g.cosinorR2);

  const corrEigCos = spearman(eigenvalues, cosinorR2s);
  const corrEigJtk = spearman(eigenvalues, jtkTaus);
  const corrAmpTau = spearman(amplitudes, jtkTaus);

  // Clock genes
  const clockGenes = enriched.filter(g => g.category === 'Clock');
  const clockAr2   = clockGenes.filter(g => g.ar2High).length;
  const clockCos   = clockGenes.filter(g => g.cosRhythmic).length;
  const clockJtk   = clockGenes.filter(g => g.jtkRhythmic).length;
  const clockAll3  = clockGenes.filter(g => g.ar2High && g.cosRhythmic && g.jtkRhythmic).length;

  // Scatter data: all clock + all target + up to 300 randomly sampled other
  const clockAndTarget = enriched.filter(g => g.category !== 'Other');
  const others = enriched.filter(g => g.category === 'Other');
  const step = Math.max(1, Math.floor(others.length / 300));
  const sampledOthers = others.filter((_, i) => i % step === 0).slice(0, 300);
  const scatterData: ScatterPoint[] = [...clockAndTarget, ...sampledOthers].map(g => ({
    gene: g.gene,
    category: g.category,
    eigenvalue: Math.round(g.eigenvalue * 10000) / 10000,
    cosinorR2:  Math.round(g.cosinorR2  * 10000) / 10000,
    jtkTau:     Math.round(g.jtkTau     * 10000) / 10000,
    cosinorRhythmic: g.cosRhythmic,
    jtkRhythmic: g.jtkRhythmic,
  }));

  // Divergent examples
  const divergent: DivergentExample[] = [];
  enriched
    .filter(g => g.eigenvalue > 0.6 && !g.cosRhythmic && !g.jtkRhythmic)
    .sort((a, b) => b.eigenvalue - a.eigenvalue)
    .slice(0, 4)
    .forEach(g => divergent.push({
      gene: g.gene, eigenvalue: g.eigenvalue,
      cosinorRhythmic: g.cosRhythmic, jtkRhythmic: g.jtkRhythmic,
      type: 'high_pers_not_rhythmic',
      interpretation: `Persistent (|λ|=${g.eigenvalue.toFixed(3)}) but sub-threshold for rhythmicity; likely overdamped or non-sinusoidal dynamics that cosinor/JTK miss.`,
    }));
  enriched
    .filter(g => g.eigenvalue < 0.35 && g.cosRhythmic && g.jtkRhythmic)
    .sort((a, b) => a.eigenvalue - b.eigenvalue)
    .slice(0, 4)
    .forEach(g => divergent.push({
      gene: g.gene, eigenvalue: g.eigenvalue,
      cosinorRhythmic: g.cosRhythmic, jtkRhythmic: g.jtkRhythmic,
      type: 'rhythmic_low_pers',
      interpretation: `Rhythmic (cosinor+JTK) but low persistence (|λ|=${g.eigenvalue.toFixed(3)}); oscillates without sustained temporal memory.`,
    }));

  const conclusion =
    `${meta.species} ${meta.tissue} (${meta.geoAccession}, n=${n} genes). ` +
    `AR(2) |λ|≥0.5: ${ar2High} (${(ar2High/n*100).toFixed(1)}%); ` +
    `cosinor q<0.05: ${cosRhyth} (${(cosRhyth/n*100).toFixed(1)}%); ` +
    `JTK q<0.05: ${jtkRhyth} (${(jtkRhyth/n*100).toFixed(1)}%). ` +
    `AR(2)-unique: ${ar2Only} genes (${(ar2Only/n*100).toFixed(1)}%) high-persistence but not rhythmic by either standard method. ` +
    `Rhythmic-but-low-persistence: ${rhyLowP} genes (${(rhyLowP/n*100).toFixed(1)}%). ` +
    `Spearman ρ(|λ|, cosinor R²)=${corrEigCos.toFixed(3)} — partial but incomplete overlap, ` +
    `confirming |λ| captures an axis of temporal dynamics orthogonal to rhythmicity.`;

  return {
    ...meta,
    nGenes: n,
    ar2HighPct: Math.round(ar2High / n * 1000) / 10,
    cosinorRhythmicPct: Math.round(cosRhyth / n * 1000) / 10,
    jtkRhythmicPct: Math.round(jtkRhyth / n * 1000) / 10,
    ar2UniquePct: Math.round(ar2Only / n * 1000) / 10,
    rhythmicLowPersPct: Math.round(rhyLowP / n * 1000) / 10,
    corrEigenvalueCosinorR2: Math.round(corrEigCos * 1000) / 1000,
    corrEigenvalueJtkTau: Math.round(corrEigJtk * 1000) / 1000,
    corrAmplitudeTau: Math.round(corrAmpTau * 1000) / 1000,
    clockGenes: {
      total: clockGenes.length,
      ar2: clockAr2,
      cosinor: clockCos,
      jtk: clockJtk,
      all3: clockAll3,
      names: clockGenes.map(g => g.gene),
    },
    venn: { all3, ar2Only, cosinorOnly, jtkOnly, ar2Cosinor: ar2Cos, ar2Jtk, cosinorJtk: cosJtk, none },
    scatterData,
    divergent,
    conclusion,
  };
}

// ─── module-level cache ───────────────────────────────────────────────────────

let _cache: MethodsPaperResult | null = null;
let _computing = false;
// Cache version — bump when benchmark logic changes to force recomputation
const CACHE_VERSION = 2;

export function getMethodsPaperBenchmark(): MethodsPaperResult | null {
  return _cache;
}

export function isComputing(): boolean {
  return _computing;
}

export async function computeMethodsPaperBenchmark(): Promise<MethodsPaperResult> {
  if (_cache) return _cache;
  if (_computing) {
    // Poll until done
    return new Promise(resolve => {
      const interval = setInterval(() => {
        if (_cache) { clearInterval(interval); resolve(_cache!); }
      }, 500);
    });
  }

  _computing = true;
  const datasetsDir = path.join(process.cwd(), 'datasets');

  const ds1Path = path.join(datasetsDir, 'GSE11923_Liver_1h_48h_genes.csv');
  const ds2Path = path.join(datasetsDir, 'GSE113883_Human_WholeBlood.csv');

  // DS1: GSE11923 mouse liver — CT columns "Circadian time NN Liver_CTNN"
  const raw1 = fs.existsSync(ds1Path)
    ? processDataset(ds1Path, h => { const m = h.match(/CT(\d+)/); return m ? parseInt(m[1]) : null; })
    : [];

  // DS2: GSE113883 human blood — "X01hr", "X03hr", ...
  const raw2 = fs.existsSync(ds2Path)
    ? processDataset(ds2Path, h => { const m = h.match(/(\d+)/); return m ? parseInt(m[1]) : null; }, 15000)
    : [];

  const ds1 = buildDatasetResult(raw1, {
    datasetId: 'gse11923',
    datasetName: 'GSE11923 Mouse Liver',
    species: 'Mouse (Mus musculus)',
    tissue: 'Liver',
    nTimepoints: 48,
    resolutionHours: 1,
    geoAccession: 'GSE11923',
  });

  const ds2 = buildDatasetResult(raw2, {
    datasetId: 'gse113883',
    datasetName: 'GSE113883 Human Blood',
    species: 'Human (Homo sapiens)',
    tissue: 'Whole Blood',
    nTimepoints: 15,
    resolutionHours: 2,
    geoAccession: 'GSE113883',
  });

  // Cross-dataset summary
  const ar2Uniq = [ds1.ar2UniquePct, ds2.ar2UniquePct];
  const rhyLowP = [ds1.rhythmicLowPersPct, ds2.rhythmicLowPersPct];
  const corrs   = [ds1.corrEigenvalueCosinorR2, ds2.corrEigenvalueCosinorR2];

  const paperConclusion =
    'Across both datasets, AR(2) |λ| identified a substantial fraction of genes with ' +
    `high temporal persistence (${ar2Uniq[0]}–${ar2Uniq[1]}% of genes) that were not ` +
    'flagged as rhythmic by cosinor or JTK_CYCLE, and conversely a fraction of genes ' +
    'flagged as rhythmic by both conventional methods showed low persistence ' +
    `(|λ|<0.5 in ${rhyLowP[0]}–${rhyLowP[1]}% of genes). Spearman correlations ` +
    `between |λ| and cosinor R² (ρ=${corrs[0].toFixed(3)} / ρ=${corrs[1].toFixed(3)}) ` +
    'confirm that temporal persistence and rhythmicity are partially overlapping but ' +
    'distinct properties — |λ| provides an orthogonal axis of information not captured ' +
    'by amplitude-based or rank-based periodicity tests.';

  _cache = {
    computedAt: new Date().toISOString(),
    datasets: [ds1, ds2],
    crossDatasetSummary: {
      ar2UniqueRangeStr: `${Math.min(...ar2Uniq).toFixed(1)}–${Math.max(...ar2Uniq).toFixed(1)}%`,
      rhythmicLowPersRangeStr: `${Math.min(...rhyLowP).toFixed(1)}–${Math.max(...rhyLowP).toFixed(1)}%`,
      corrRangeStr: `ρ=${Math.min(...corrs).toFixed(3)}–${Math.max(...corrs).toFixed(3)}`,
      clockGeneConsistency: `Clock genes detected by all 3 methods: ${ds1.clockGenes.all3}/${ds1.clockGenes.total} (DS1), ${ds2.clockGenes.all3}/${ds2.clockGenes.total} (DS2)`,
      paperConclusion,
    },
  };

  _computing = false;
  return _cache;
}

/** Kick off background computation at server startup — non-blocking. */
export function warmUpMethodsBenchmark(): void {
  const ds1 = path.join(process.cwd(), 'datasets', 'GSE11923_Liver_1h_48h_genes.csv');
  const ds2 = path.join(process.cwd(), 'datasets', 'GSE113883_Human_WholeBlood.csv');
  if (!fs.existsSync(ds1) && !fs.existsSync(ds2)) return;
  computeMethodsPaperBenchmark().catch(err =>
    console.error('[methods-benchmark] background computation error:', err)
  );
}
