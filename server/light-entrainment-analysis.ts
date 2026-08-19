/**
 * Light Entrainment / Central-Peripheral Clock Hierarchy — Paper Q backend
 *
 * LIVE computation from GSE54650 (12 mouse tissues, 16 clock genes each).
 * Falls back to embedded values if CSV files are missing.
 *
 * Live pipeline:
 *   1. Read each of 12 GSE54650 tissue CSVs (Gene × CT18…CT64, 24 timepoints)
 *   2. Fit AR(2) to each of 16 core clock genes per tissue
 *   3. Mean |λ| across found clock genes = tissue-level clock persistence
 *   4. Exact permutation test: C(11, 3) = 165 CNS label assignments
 *   5. Bootstrap 95% CI
 *
 * Baboon (GSE98965) and GSE11923 liver per-gene data stay pre-computed
 * (require ortholog mapping / separate sampling-rate handling).
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { CLOCK_GENES_16, CLOCK_GENES_BABOON_16 } from '../shared/clock-genes-16';
import { FALLBACK_TISSUE as _FALLBACK_TISSUE } from '../shared/fallback-tissue';

const DATA_DIR = path.join(process.cwd(), 'datasets');

const TISSUE_MAP: Array<{
  file: string; abbr: string; tissue: string;
  layer: 'peripheral' | 'neuroendocrine' | 'central';
}> = [
  { file: 'GSE54650_Lung_circadian.csv',        abbr: 'Lun',  tissue: 'Lung',           layer: 'peripheral' },
  { file: 'GSE54650_Kidney_circadian.csv',      abbr: 'Kid',  tissue: 'Kidney',          layer: 'peripheral' },
  { file: 'GSE54650_Heart_circadian.csv',       abbr: 'Hrt',  tissue: 'Heart',           layer: 'peripheral' },
  { file: 'GSE54650_Adrenal_circadian.csv',     abbr: 'Adr',  tissue: 'Adrenal Gland',   layer: 'neuroendocrine' },
  { file: 'GSE54650_White_Fat_circadian.csv',   abbr: 'WFat', tissue: 'White Adipose',   layer: 'peripheral' },
  { file: 'GSE54650_Brown_Fat_circadian.csv',   abbr: 'BFat', tissue: 'Brown Adipose',   layer: 'peripheral' },
  { file: 'GSE54650_Aorta_circadian.csv',       abbr: 'Aor',  tissue: 'Aorta',           layer: 'peripheral' },
  { file: 'GSE54650_Liver_circadian.csv',       abbr: 'Liv',  tissue: 'Liver',           layer: 'peripheral' },
  { file: 'GSE54650_Muscle_circadian.csv',      abbr: 'Mus',  tissue: 'Skeletal Muscle', layer: 'peripheral' },
  { file: 'GSE54650_Brainstem_circadian.csv',   abbr: 'Bstm', tissue: 'Brainstem',       layer: 'central' },
  { file: 'GSE54650_Cerebellum_circadian.csv',  abbr: 'Cer',  tissue: 'Cerebellum',      layer: 'central' },
  { file: 'GSE54650_Hypothalamus_circadian.csv',abbr: 'Hyp',  tissue: 'Hypothalamus',    layer: 'central' },
];

// ── AR(2) engine (self-contained) ─────────────────────────────────────────────

function fitAR2(values: number[]): {
  phi1: number; phi2: number; lambda: number; isComplex: boolean; r2: number;
} | null {
  const n = values.length;
  if (n < 5) return null;
  const mean_ = values.reduce((a, b) => a + b, 0) / n;
  const z = values.map(v => v - mean_);
  const y: number[] = [], X: number[][] = [];
  for (let t = 2; t < n; t++) { y.push(z[t]); X.push([z[t-1], z[t-2]]); }
  const XtX = [[0,0],[0,0]], Xty = [0,0];
  for (let i = 0; i < y.length; i++) {
    XtX[0][0] += X[i][0]**2; XtX[0][1] += X[i][0]*X[i][1];
    XtX[1][0] += X[i][0]*X[i][1]; XtX[1][1] += X[i][1]**2;
    Xty[0] += X[i][0]*y[i]; Xty[1] += X[i][1]*y[i];
  }
  const det = XtX[0][0]*XtX[1][1] - XtX[0][1]*XtX[1][0];
  if (Math.abs(det) < 1e-12) return null;
  const phi1 = (XtX[1][1]*Xty[0] - XtX[0][1]*Xty[1]) / det;
  const phi2 = (XtX[0][0]*Xty[1] - XtX[1][0]*Xty[0]) / det;
  if (!isFinite(phi1) || !isFinite(phi2) || Math.abs(phi1) > 10 || Math.abs(phi2) > 10) return null;
  const disc = phi1**2 + 4*phi2;
  let lambda: number, isComplex: boolean;
  if (disc >= 0) {
    lambda = Math.max(Math.abs((phi1+Math.sqrt(disc))/2), Math.abs((phi1-Math.sqrt(disc))/2));
    isComplex = false;
  } else {
    lambda = Math.sqrt(-phi2); isComplex = true;
  }
  if (lambda >= 1 || phi2 <= -1 || (phi1+phi2) >= 1 || (phi2-phi1) >= 1) return null;
  const yMean = y.reduce((a,b)=>a+b,0)/y.length;
  const sst = y.reduce((s,v)=>s+(v-yMean)**2, 0);
  const preds = X.map(row => phi1*row[0] + phi2*row[1]);
  const sse = y.reduce((s,v,i)=>s+(v-preds[i])**2, 0);
  const r2 = sst > 1e-12 ? 1 - sse/sst : 0;
  return { phi1, phi2, lambda, isComplex, r2 };
}

// ── Load one GSE54650 tissue CSV → AR(2) per clock gene ───────────────────────

interface GeneAR2 { gene: string; lambda: number; r2: number; isComplex: boolean; }

function loadTissueCSV(filename: string): Map<string, GeneAR2> | null {
  const csvPath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(csvPath)) return null;
  try {
    const records = parse(fs.readFileSync(csvPath, 'utf-8'), {
      columns: true, skip_empty_lines: true,
    }) as Record<string, string>[];
    const cols = Object.keys(records[0]).filter(k => k !== 'Gene');
    const geneMap = new Map<string, GeneAR2>();
    for (const row of records) {
      const gene = row['Gene']?.trim();
      if (!gene) continue;
      const vals = cols.map(c => parseFloat(row[c])).filter(v => isFinite(v));
      const fit = fitAR2(vals);
      if (fit) geneMap.set(gene.toLowerCase(), { gene, ...fit });
    }
    return geneMap;
  } catch { return null; }
}

// ── τ_c = −2/ln(|λ|)  (2h sampling interval) ──────────────────────────────────

function tauC(lam: number): number {
  if (lam <= 0 || lam >= 1) return NaN;
  return -2 / Math.log(lam);
}

function mean(arr: number[]): number {
  return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TissueLambda {
  tissue: string; abbr: string; meanLam: number; n: number;
  layer: 'peripheral' | 'neuroendocrine' | 'central';
  tauC: number; reentHours: number;
}

export interface GeneLambda {
  gene: string; lam: number; r2: number; rtype: 'complex' | 'real';
}

export interface BaboonPoint { tissue: string; baboon: number; mouse: number; }
export interface PreSpecifiedItem {
  prediction: string; result: string; passed: boolean; note: string;
}

export interface LightEntrainmentResult {
  source: 'live' | 'pre-computed';
  computedAt: string;
  tissueData: TissueLambda[];
  geneData: Record<string, GeneLambda[]>;
  gse11923Liver: GeneLambda[];
  baboon: BaboonPoint[];
  summary: {
    hypLambda: number; lunLambda: number; tauRatio: number;
    hypTauC: number; lunTauC: number;
    peripheralMean: number; centralMean: number; gap: number;
  };
  permutation: {
    observedGap: number; pValue: number; n: number;
    nExceeding: number; description: string;
  };
  bootstrap: {
    peripheralMeanCI95: [number, number];
    centralMeanCI95: [number, number];
    gapCI95: [number, number];
    n: number;
  };
  baboonValidation: {
    scnMouseLambda: number; scnBaboonLambda: number; absoluteDiff: number;
    cnsPeripheralGapP: number; lunTauC: number; scnTauC: number;
    tauRatio: number; predictionsPassed: number; predictionsTotal: number;
  };
  preSpecified: PreSpecifiedItem[];
}

// ── Permutation test: exact C(11,3)=165 label enumeration ─────────────────────

function runPermutationTest(tissues: TissueLambda[]): {
  observedGap: number; pValue: number; n: number; nExceeding: number;
} {
  const periph = tissues.filter(t => t.layer === 'peripheral').map(t => t.meanLam);
  const central = tissues.filter(t => t.layer === 'central').map(t => t.meanLam);
  const all = tissues.filter(t => t.layer !== 'neuroendocrine').map(t => t.meanLam);
  const observed = mean(periph) - mean(central);
  const n = all.length; const k = 3;
  let nExceeding = 0, total = 0;
  for (let i = 0; i < n; i++) for (let j = i+1; j < n; j++) for (let l = j+1; l < n; l++) {
    total++;
    const cMean = (all[i]+all[j]+all[l])/3;
    const rest = all.filter((_,idx)=>idx!==i&&idx!==j&&idx!==l);
    if (mean(rest)-cMean >= observed) nExceeding++;
  }
  return { observedGap: Math.round(observed*4)/4, pValue: Math.round(nExceeding/total*1000)/1000, n: total, nExceeding };
}

function bootstrapGroupCI(values: number[], nBoot=5000): [number,number] {
  let seed=123;
  const lcg=()=>{seed=(seed*1664525+1013904223)&0xffffffff;return(seed>>>0)/4294967296;};
  const boots: number[]=[];
  for(let b=0;b<nBoot;b++){let s=0;for(let i=0;i<values.length;i++)s+=values[Math.floor(lcg()*values.length)];boots.push(s/values.length);}
  boots.sort((a,b)=>a-b);
  return [Math.round(boots[Math.floor(0.025*nBoot)]*1000)/1000, Math.round(boots[Math.floor(0.975*nBoot)]*1000)/1000];
}

// ── Embedded fallback (pre-computed from GSE54650, May 2026) ───────────────────
// Imported from shared/fallback-tissue.ts so the vitest guard in
// client/src/__tests__/fallback-tissue-table1.test.ts can import the same
// constant and assert agreement with Paper Q Table 1 to 3 decimal places.

const FALLBACK_TISSUE = _FALLBACK_TISSUE;

// ── Per-gene data for 4 key tissues (hardcoded — for display only) ─────────────

const GENE_DATA: Record<string, GeneLambda[]> = {
  Hyp: [
    { gene:'Per3',     lam:0.7754, r2:0.488, rtype:'real' },
    { gene:'Bmal1',    lam:0.6823, r2:0.502, rtype:'complex' },
    { gene:'Rev-erbα', lam:0.6323, r2:0.325, rtype:'real' },
    { gene:'Rev-erbβ', lam:0.6034, r2:0.434, rtype:'real' },
    { gene:'Per2',     lam:0.5373, r2:0.524, rtype:'complex' },
    { gene:'Dbp',      lam:0.5127, r2:0.490, rtype:'complex' },
    { gene:'Clock',    lam:0.4989, r2:-0.053,rtype:'real' },
    { gene:'Cry1',     lam:0.4597, r2:0.048, rtype:'complex' },
    { gene:'Per1',     lam:0.3725, r2:0.360, rtype:'complex' },
    { gene:'Cry2',     lam:0.2633, r2:0.109, rtype:'real' },
  ],
  Adr: [
    { gene:'Npas2',    lam:0.9042, r2:0.915, rtype:'complex' },
    { gene:'Rev-erbβ', lam:0.8775, r2:0.857, rtype:'complex' },
    { gene:'Bmal1',    lam:0.8408, r2:0.813, rtype:'complex' },
    { gene:'Dbp',      lam:0.8133, r2:0.774, rtype:'complex' },
    { gene:'Rev-erbα', lam:0.8068, r2:0.777, rtype:'complex' },
    { gene:'Tef',      lam:0.7950, r2:0.781, rtype:'complex' },
    { gene:'Per3',     lam:0.7859, r2:0.773, rtype:'complex' },
    { gene:'Per2',     lam:0.6307, r2:0.390, rtype:'real' },
    { gene:'Cry1',     lam:0.5769, r2:0.560, rtype:'real' },
    { gene:'Per1',     lam:0.5766, r2:0.232, rtype:'real' },
  ],
  Liv: [
    { gene:'Rev-erbβ', lam:0.8564, r2:0.822, rtype:'complex' },
    { gene:'Rev-erbα', lam:0.8112, r2:0.714, rtype:'complex' },
    { gene:'Clock',    lam:0.8104, r2:0.785, rtype:'complex' },
    { gene:'Dbp',      lam:0.7917, r2:0.730, rtype:'complex' },
    { gene:'Bmal1',    lam:0.7671, r2:0.749, rtype:'complex' },
    { gene:'Cry1',     lam:0.7595, r2:0.767, rtype:'complex' },
    { gene:'Tef',      lam:0.6573, r2:0.628, rtype:'complex' },
    { gene:'Per2',     lam:0.6360, r2:0.688, rtype:'complex' },
    { gene:'Per1',     lam:0.5738, r2:0.466, rtype:'complex' },
    { gene:'Cry2',     lam:0.5832, r2:0.038, rtype:'real' },
  ],
  Lun: [
    { gene:'Per3',     lam:0.9360, r2:0.932, rtype:'complex' },
    { gene:'Tef',      lam:0.9296, r2:0.921, rtype:'complex' },
    { gene:'Rorγ',     lam:0.9151, r2:0.899, rtype:'complex' },
    { gene:'Dbp',      lam:0.8938, r2:0.860, rtype:'complex' },
    { gene:'Per2',     lam:0.8880, r2:0.874, rtype:'complex' },
    { gene:'Rev-erbα', lam:0.8736, r2:0.846, rtype:'complex' },
    { gene:'Rev-erbβ', lam:0.8704, r2:0.865, rtype:'complex' },
    { gene:'Cry1',     lam:0.8478, r2:0.800, rtype:'complex' },
    { gene:'Bmal1',    lam:0.8234, r2:0.833, rtype:'complex' },
    { gene:'Per1',     lam:0.5214, r2:0.443, rtype:'complex' },
  ],
};

const GSE11923_LIVER: GeneLambda[] = [
  { gene:'Cry1',     lam:0.8955, r2:0.787, rtype:'real' },
  { gene:'Bmal1',    lam:0.8946, r2:0.800, rtype:'real' },
  { gene:'Rorγ',     lam:0.8703, r2:0.754, rtype:'real' },
  { gene:'Per2',     lam:0.8680, r2:0.576, rtype:'real' },
  { gene:'Rorβ',     lam:0.8584, r2:0.370, rtype:'real' },
  { gene:'Clock',    lam:0.8573, r2:0.754, rtype:'real' },
  { gene:'Hlf',      lam:0.8212, r2:0.491, rtype:'real' },
  { gene:'Rev-erbβ', lam:0.8111, r2:0.825, rtype:'real' },
  { gene:'Dbp',      lam:0.7708, r2:0.709, rtype:'real' },
  { gene:'Tef',      lam:0.7345, r2:0.743, rtype:'real' },
  { gene:'Npas2',    lam:0.7218, r2:0.514, rtype:'real' },
  { gene:'Per3',     lam:0.7177, r2:0.309, rtype:'real' },
  { gene:'Per1',     lam:0.7031, r2:0.399, rtype:'real' },
  { gene:'Cry2',     lam:0.6802, r2:0.425, rtype:'real' },
  { gene:'Rev-erbα', lam:0.5399, r2:0.720, rtype:'complex' },
  { gene:'Rorα',     lam:0.4160, r2:0.130, rtype:'complex' },
];

// Baboon tissue-level mean |λ| values are pre-computed from GSE98965 raw FPKM
// using exactly the 16 baboon clock gene orthologues listed in CLOCK_GENES_BABOON_16
// (shared/clock-genes-16.ts).  Any change to that constant must be accompanied
// by re-running the baboon AR(2) pipeline and updating the values below.
//
// Baboon SCN confirmed 0.4708 from raw FPKM (all 16 genes stable).
// Baboon Lung live-verified 0.6106 from raw FPKM (14 genes; PER3 and NR1D2
// excluded — unstable λ≥1 in this tissue).
// τ_c ratio = tauC(0.6106)/tauC(0.4708) = 4.06/2.66 = 1.53×.
// The previously hardcoded Lung value of 0.6940 (ratio 2.06×) did not reproduce
// from GSE98965 raw FPKM and has been corrected to the live-verified value.

// Compile-time guard: baboon set must be the same size as the mouse set.
// This will cause a TypeScript error if either list is edited without the other.
const _baboonSizeGuard: 16 = CLOCK_GENES_BABOON_16.length as 16;
void _baboonSizeGuard; // suppress unused-variable warning

const BABOON: BaboonPoint[] = [
  { tissue:'SCN / Hypothalamus', baboon:0.4708, mouse:0.4691 },
  { tissue:'Cerebellum',         baboon:0.5263, mouse:0.5501 },
  { tissue:'Adrenal (cortex)',   baboon:0.5819, mouse:0.6821 },
  { tissue:'Heart',              baboon:0.5712, mouse:0.6978 },
  { tissue:'Kidney (medulla)',   baboon:0.6074, mouse:0.7377 },
  { tissue:'Muscle (arm)',       baboon:0.6079, mouse:0.6219 },
  { tissue:'Liver',              baboon:0.5002, mouse:0.6413 },
  { tissue:'Lung',               baboon:0.6106, mouse:0.7966 }, // live-verified from GSE98965 raw FPKM, n=14 stable genes
];

function buildPreSpecified(tissues: TissueLambda[]): PreSpecifiedItem[] {
  const hyp = tissues.find(t => t.abbr === 'Hyp')!;
  const lun = tissues.find(t => t.abbr === 'Lun')!;
  const periph = tissues.filter(t => t.layer === 'peripheral');
  const central = tissues.filter(t => t.layer === 'central');
  const pMean = mean(periph.map(t=>t.meanLam));
  const cMean = mean(central.map(t=>t.meanLam));
  const hypIsLowest = tissues.every(t => t.meanLam >= hyp.meanLam);
  const tauRatio = lun.tauC / hyp.tauC;
  return [
    {
      prediction: 'Hypothalamus (SCN proxy) has lowest mean |λ| of all 12 tissues',
      result: `Hyp |λ| = ${hyp.meanLam.toFixed(4)} — ${hypIsLowest ? 'confirmed lowest' : 'NOT lowest'}`,
      passed: hypIsLowest,
      note: 'Pre-specified: SCN must reset quickly to entrain. Low |λ| = short temporal memory = rapid oscillator.',
    },
    {
      prediction: 'Peripheral tissues show higher mean |λ| than central CNS tissues',
      result: `CNS mean = ${cMean.toFixed(3)}, Peripheral mean = ${pMean.toFixed(3)}; permutation computed live`,
      passed: pMean > cMean,
      note: 'Pre-specified: peripheral tissues integrate light signals over longer timescales.',
    },
    {
      prediction: 'Baboon SCN |λ| replicates mouse hypothalamus |λ| (~0.47)',
      result: `Baboon SCN |λ| = 0.4708 vs mouse Hyp |λ| = ${hyp.meanLam.toFixed(4)} — diff = ${Math.abs(0.4708-hyp.meanLam).toFixed(4)}`,
      passed: Math.abs(0.4708 - hyp.meanLam) < 0.02,
      note: 'Pre-specified replication: ~30 million years of evolution, absolute difference < 0.02.',
    },
    {
      prediction: 'Lung re-entrainment lag ratio (Lung τ_c / Hyp τ_c) ≥ 2×',
      result: `Ratio = ${tauRatio.toFixed(2)}× (mouse); baboon Lung/SCN ratio = 1.53× (live-verified, 14 stable genes)`,
      passed: tauRatio >= 2.0,
      note: 'Pre-specified: provides quantitative basis for the well-documented 2–14 day peripheral lag during jet lag.',
    },
  ];
}

// ── Main computation ───────────────────────────────────────────────────────────

let _cache: LightEntrainmentResult | null = null;

export function computeLightEntrainment(force = false): LightEntrainmentResult {
  if (_cache && !force) return _cache;

  // ── Try to load live data from GSE54650 CSVs ────────────────────────────────
  const liveTissues: TissueLambda[] = [];
  let liveCount = 0;

  for (const tm of TISSUE_MAP) {
    const geneMap = loadTissueCSV(tm.file);
    if (geneMap) {
      const lambdas: number[] = [];
      for (const g of CLOCK_GENES_16) {
        const r = geneMap.get(g.toLowerCase());
        if (r) lambdas.push(r.lambda);
      }
      if (lambdas.length >= 8) {
        const ml = mean(lambdas);
        const tc = tauC(ml);
        liveTissues.push({
          tissue: tm.tissue, abbr: tm.abbr, meanLam: ml, n: lambdas.length,
          layer: tm.layer,
          tauC: Math.round(tc * 100) / 100,
          reentHours: Math.round(tc * 10) / 10,
        });
        liveCount++;
      }
    }
  }

  const isLive = liveCount === TISSUE_MAP.length;

  // Fall back to embedded values for any missing tissues
  let tissueData: TissueLambda[];
  if (liveCount === TISSUE_MAP.length) {
    tissueData = liveTissues.sort((a, b) => b.meanLam - a.meanLam);
  } else {
    // Partial or full fallback
    tissueData = FALLBACK_TISSUE.map(r => {
      const tc = tauC(r.meanLam);
      return { ...r, tauC: Math.round(tc*100)/100, reentHours: Math.round(tc*10)/10 };
    });
  }

  const hyp = tissueData.find(t => t.abbr === 'Hyp')!;
  const lun = tissueData.find(t => t.abbr === 'Lun')!;
  const tauRatio = Math.round((lun.tauC / hyp.tauC) * 100) / 100;

  const periph = tissueData.filter(t => t.layer === 'peripheral');
  const central = tissueData.filter(t => t.layer === 'central');
  const peripheralMean = mean(periph.map(t=>t.meanLam));
  const centralMean   = mean(central.map(t=>t.meanLam));
  const gap = peripheralMean - centralMean;

  const perm = runPermutationTest(tissueData);
  const periphCI = bootstrapGroupCI(periph.map(t=>t.meanLam));
  const centCI   = bootstrapGroupCI(central.map(t=>t.meanLam));

  // Gap bootstrap
  let seed = 999;
  const lcg = () => { seed=(seed*1664525+1013904223)&0xffffffff; return(seed>>>0)/4294967296; };
  const pLams = periph.map(t=>t.meanLam), cLams = central.map(t=>t.meanLam);
  const gapSamples: number[] = [];
  for (let b=0; b<5000; b++) {
    let ps=0, cs=0;
    for(let i=0;i<pLams.length;i++) ps+=pLams[Math.floor(lcg()*pLams.length)];
    for(let i=0;i<cLams.length;i++) cs+=cLams[Math.floor(lcg()*cLams.length)];
    gapSamples.push(ps/pLams.length - cs/cLams.length);
  }
  gapSamples.sort((a,b)=>a-b);
  const gapCI: [number,number] = [
    Math.round(gapSamples[Math.floor(0.025*5000)]*1000)/1000,
    Math.round(gapSamples[Math.floor(0.975*5000)]*1000)/1000,
  ];

  const baboonSCN  = BABOON.find(b => b.tissue.includes('SCN'))!;
  const baboonLung = BABOON.find(b => b.tissue === 'Lung')!;
  const babLunTauC = tauC(baboonLung.baboon);
  const babScnTauC = tauC(baboonSCN.baboon);
  const preSpecified = buildPreSpecified(tissueData);

  _cache = {
    source: isLive ? 'live' : 'pre-computed',
    computedAt: new Date().toISOString(),
    tissueData,
    geneData: GENE_DATA,
    gse11923Liver: GSE11923_LIVER,
    baboon: BABOON,
    summary: {
      hypLambda:      Math.round(hyp.meanLam*10000)/10000,
      lunLambda:      Math.round(lun.meanLam*10000)/10000,
      tauRatio,
      hypTauC:        Math.round(hyp.tauC*100)/100,
      lunTauC:        Math.round(lun.tauC*100)/100,
      peripheralMean: Math.round(peripheralMean*4)/4,
      centralMean:    Math.round(centralMean*4)/4,
      gap:            Math.round(gap*4)/4,
    },
    permutation: {
      observedGap:  perm.observedGap,
      pValue:       perm.pValue,
      n:            perm.n,
      nExceeding:   perm.nExceeding,
      description:  `Exact enumeration: ${perm.nExceeding}/${perm.n} assignments show gap ≥ observed (CNS<Peripheral)`,
    },
    bootstrap: {
      peripheralMeanCI95: periphCI,
      centralMeanCI95:    centCI,
      gapCI95:            gapCI,
      n: 5000,
    },
    baboonValidation: {
      scnMouseLambda:    Math.round(hyp.meanLam*10000)/10000,
      scnBaboonLambda:   baboonSCN.baboon,
      absoluteDiff:      Math.round(Math.abs(baboonSCN.baboon-hyp.meanLam)*10000)/10000,
      cnsPeripheralGapP: perm.pValue,
      lunTauC:           Math.round(babLunTauC*100)/100,
      scnTauC:           Math.round(babScnTauC*100)/100,
      tauRatio:          Math.round((babLunTauC/babScnTauC)*100)/100,
      predictionsPassed: preSpecified.filter(p=>p.passed).length,
      predictionsTotal:  preSpecified.length,
    },
    preSpecified,
  };

  return _cache;
}

export function clearLightEntrainmentCache(): void { _cache = null; }
