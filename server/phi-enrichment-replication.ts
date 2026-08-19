import * as fs from 'fs';
import { parse } from 'csv-parse/sync';

const PHI = (1 + Math.sqrt(5)) / 2;
const PHI_RECIPROCAL = 1 / PHI; // 0.61803...

// Full tissue names and intestinal classification for GSE98965 (Mure et al. 2018)
const BABOON_TISSUE_LABELS: Record<string, { name: string; isIntestinal: boolean; system: string }> = {
  ADC: { name: 'Adrenal cortex',           isIntestinal: false, system: 'Endocrine' },
  ADM: { name: 'Adrenal medulla',          isIntestinal: false, system: 'Endocrine' },
  AMY: { name: 'Amygdala',                 isIntestinal: false, system: 'Brain' },
  ANT: { name: 'Anterior hypothalamus',    isIntestinal: false, system: 'Brain' },
  AOR: { name: 'Aorta',                    isIntestinal: false, system: 'Cardiovascular' },
  ARC: { name: 'Arcuate nucleus',          isIntestinal: false, system: 'Brain' },
  ASC: { name: 'Ascending colon',          isIntestinal: true,  system: 'Intestinal' },
  AXL: { name: 'Axillary lymph node',      isIntestinal: false, system: 'Immune' },
  BLA: { name: 'Basolateral amygdala',     isIntestinal: false, system: 'Brain' },
  BOM: { name: 'Bone marrow',              isIntestinal: false, system: 'Immune' },
  CEC: { name: 'Cecum',                    isIntestinal: true,  system: 'Intestinal' },
  CER: { name: 'Cerebellum',               isIntestinal: false, system: 'Brain' },
  DEC: { name: 'Descending colon',         isIntestinal: true,  system: 'Intestinal' },
  DMH: { name: 'Dorsomedial hypothalamus', isIntestinal: false, system: 'Brain' },
  DUO: { name: 'Duodenum',                 isIntestinal: true,  system: 'Intestinal' },
  HAB: { name: 'Habenula',                 isIntestinal: false, system: 'Brain' },
  HEA: { name: 'Heart',                    isIntestinal: false, system: 'Cardiovascular' },
  HIP: { name: 'Hippocampus',              isIntestinal: false, system: 'Brain' },
  ILE: { name: 'Ileum',                    isIntestinal: true,  system: 'Intestinal' },
  KIC: { name: 'Kidney cortex',            isIntestinal: false, system: 'Renal' },
  KIM: { name: 'Kidney medulla',           isIntestinal: false, system: 'Renal' },
  LGP: { name: 'Lateral globus pallidus',  isIntestinal: false, system: 'Brain' },
  LH:  { name: 'Lateral hypothalamus',     isIntestinal: false, system: 'Brain' },
  LIV: { name: 'Liver',                    isIntestinal: false, system: 'Metabolic' },
  LUN: { name: 'Lung',                     isIntestinal: false, system: 'Respiratory' },
  MEL: { name: 'Mesenteric lymph node',    isIntestinal: false, system: 'Immune' },
  MGP: { name: 'Medial globus pallidus',   isIntestinal: false, system: 'Brain' },
  MMB: { name: 'Mammillary body',          isIntestinal: false, system: 'Brain' },
  MUA: { name: 'Axillary muscle',          isIntestinal: false, system: 'Muscle' },
  MUG: { name: 'Gluteal muscle',           isIntestinal: false, system: 'Muscle' },
  OES: { name: 'Oesophagus',               isIntestinal: true,  system: 'Intestinal' },
  OLB: { name: 'Olfactory bulb',           isIntestinal: false, system: 'Brain' },
  OMF: { name: 'Omental fat',              isIntestinal: false, system: 'Adipose' },
  ONH: { name: 'Optic nerve head',         isIntestinal: false, system: 'Visual' },
  PAN: { name: 'Pancreas',                 isIntestinal: false, system: 'Endocrine' },
  PIN: { name: 'Pineal gland',             isIntestinal: false, system: 'Endocrine' },
  PIT: { name: 'Pituitary',                isIntestinal: false, system: 'Endocrine' },
  PON: { name: 'Pons',                     isIntestinal: false, system: 'Brain' },
  PRA: { name: 'Prefrontal cortex A',      isIntestinal: false, system: 'Brain' },
  PRC: { name: 'Prefrontal cortex C',      isIntestinal: false, system: 'Brain' },
  PRO: { name: 'Prostate',                 isIntestinal: false, system: 'Reproductive' },
  PUT: { name: 'Putamen',                  isIntestinal: false, system: 'Brain' },
  PVN: { name: 'Paraventricular nucleus',  isIntestinal: false, system: 'Brain' },
  RET: { name: 'Retina',                   isIntestinal: false, system: 'Visual' },
  SCN: { name: 'Suprachiasmatic nucleus',  isIntestinal: false, system: 'Brain' },
  SMM: { name: 'Small intestinal mucosa',  isIntestinal: true,  system: 'Intestinal' },
  SON: { name: 'Supraoptic nucleus',       isIntestinal: false, system: 'Brain' },
  SPL: { name: 'Spleen',                   isIntestinal: false, system: 'Immune' },
  STF: { name: 'Striatum',                 isIntestinal: false, system: 'Brain' },
  SUN: { name: 'Subthalamic nucleus',      isIntestinal: false, system: 'Brain' },
  TES: { name: 'Testis',                   isIntestinal: false, system: 'Reproductive' },
  THA: { name: 'Thalamus',                 isIntestinal: false, system: 'Brain' },
  THR: { name: 'Thyroid',                  isIntestinal: false, system: 'Endocrine' },
  VIC: { name: 'Visceral fat',             isIntestinal: false, system: 'Adipose' },
  VMH: { name: 'Ventromedial hypothalamus',isIntestinal: false, system: 'Brain' },
  WAM: { name: 'White adipose mesenteric', isIntestinal: false, system: 'Adipose' },
  WAP: { name: 'White adipose perirenal',  isIntestinal: false, system: 'Adipose' },
  WAR: { name: 'White adipose retroperitoneal', isIntestinal: false, system: 'Adipose' },
  WAS: { name: 'White adipose subcutaneous', isIntestinal: false, system: 'Adipose' },
  WAT: { name: 'White adipose tissue',     isIntestinal: false, system: 'Adipose' },
};

const DIRECT_CLOCK_TARGETS = [
  'Dbp','Tef','Hlf','Nfil3',
  'Rora','Rorb','Rorc',
  'Bhlhe40','Bhlhe41',
  'Ciart','Wee1','Nampt','Cdkn1a','Ccrn4l',
];

const CORE_CLOCK_GENES = [
  'Arntl','Clock','Npas2','Per1','Per2','Per3','Cry1','Cry2','Nr1d1','Nr1d2',
];

// Pre-specified Arabidopsis clock output gene set
// Functional analogues to the mammalian E-box target set.
// Selected before analysis from literature (Harmer 2000, Covington 2008, Nagel 2015):
// direct clock-regulated output genes that are NOT core clock components.
// Stored identifiers match GSE242964 dataset column headers.
const ARABIDOPSIS_OUTPUT_GENES: { id: string; display: string; role: string }[] = [
  { id: 'AT1G02970.1', display: 'AtWEE1',    role: 'Cell cycle kinase — direct WEE1 ortholog' },
  { id: 'AT2G21660.1', display: 'GRP7',       role: 'Evening-phased RNA processing output (CCR2)' },
  { id: 'AT2G39730.1', display: 'RCA',        role: 'Rubisco activase — morning metabolic output' },
  { id: 'AT1G20620.1', display: 'CAT3',       role: 'Catalase 3 — antioxidant metabolic output' },
  { id: 'AT5G13930.1', display: 'CHS',        role: 'Chalcone synthase — flavonoid metabolic output' },
  { id: 'AT3G54180.1', display: 'CDKB1;1',   role: 'Plant cyclin-dependent kinase B — cell cycle' },
  { id: 'AT4G32280.1', display: 'IAA29',      role: 'Auxin-responsive signalling output' },
  { id: 'AT2G46970.1', display: 'PIL1',       role: 'Shade avoidance phytochrome output' },
  { id: 'CAB1',        display: 'CAB1/LHCB', role: 'Light harvesting complex — photosynthetic output' },
  { id: 'FT',          display: 'FT',         role: 'Flowering locus T — photoperiod pathway output' },
];

// TAIR base-ID lookup for datasets where probe IDs are bare locus codes (AT1G02970 not AT1G02970.1)
// Used for GSE37278 (AGRONOMICS tiling array) and GSE19271 (ATH1 GPL198)
const ARABIDOPSIS_OUTPUT_GENES_TAIR: { tair: string; display: string; role: string }[] = [
  { tair: 'AT1G02970', display: 'AtWEE1',    role: 'Cell cycle kinase — direct WEE1 ortholog' },
  { tair: 'AT2G21660', display: 'GRP7',       role: 'Evening-phased RNA processing output (CCR2)' },
  { tair: 'AT2G39730', display: 'RCA',        role: 'Rubisco activase — morning metabolic output' },
  { tair: 'AT1G20620', display: 'CAT3',       role: 'Catalase 3 — antioxidant metabolic output' },
  { tair: 'AT5G13930', display: 'CHS',        role: 'Chalcone synthase — flavonoid metabolic output' },
  { tair: 'AT3G54180', display: 'CDKB1;1',   role: 'Plant cyclin-dependent kinase B — cell cycle' },
  { tair: 'AT4G32280', display: 'IAA29',      role: 'Auxin-responsive signalling output' },
  { tair: 'AT2G46970', display: 'PIL1',       role: 'Shade avoidance phytochrome output' },
  { tair: 'AT1G29930', display: 'CAB1/LHCB', role: 'Light harvesting complex — photosynthetic output' },
  { tair: 'AT1G65480', display: 'FT',         role: 'Flowering locus T — photoperiod pathway output' },
];

// Arabidopsis core clock genes (analogous to mammalian PER/CRY/CLOCK/BMAL1 set)
const ARABIDOPSIS_CORE_CLOCK: { id: string; display: string }[] = [
  { id: 'CCA1',        display: 'CCA1'  },
  { id: 'LHY',         display: 'LHY'   },
  { id: 'TOC1',        display: 'TOC1'  },
  { id: 'PRR9',        display: 'PRR9'  },
  { id: 'PRR7',        display: 'PRR7'  },
  { id: 'PRR5',        display: 'PRR5'  },
  { id: 'GI',          display: 'GI'    },
  { id: 'ELF3',        display: 'ELF3'  },
  { id: 'AT2G40080.1', display: 'ELF4'  },
  { id: 'AT3G46640.1', display: 'LUX'   },
];

function invertMatrix2x2(a: number, b: number, c: number, d: number): [number,number,number,number] | null {
  const det = a * d - b * c;
  if (Math.abs(det) < 1e-12) return null;
  return [d/det, -b/det, -c/det, a/det];
}

function fitAR2(values: number[]): { lambda: number; r2: number; hasComplexRoots: boolean } | null {
  const n = values.length;
  if (n < 6) return null;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const z = values.map(v => v - mean);
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
  const predictions = z.slice(2).map((_, i) => phi1*z[i+1] + phi2*z[i]);
  const ssRes = predictions.reduce((acc, p, i) => acc + (z[i+2]-p)**2, 0);
  const ssTot = z.slice(2).reduce((acc, v) => acc + v**2, 0);
  const r2 = ssTot > 0 ? 1 - ssRes/ssTot : 0;
  return { lambda, r2, hasComplexRoots };
}

function median(arr: number[]): number {
  if (arr.length === 0) return NaN;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m-1]+s[m])/2 : s[m];
}

// log-sum-exp for numerical stability
function logAddExp(a: number, b: number): number {
  if (!isFinite(a)) return b;
  if (!isFinite(b)) return a;
  const mx = Math.max(a, b);
  return mx + Math.log(Math.exp(a - mx) + Math.exp(b - mx));
}

// Exact survival function for chi-squared with even df=2k via Poisson CDF
// P(chi2(2k) > x) = e^(-x/2) * sum_{j=0}^{k-1} (x/2)^j / j!
function chi2SurvivalEvenDF(chi2stat: number, k: number): number {
  if (chi2stat <= 0 || k <= 0) return 1;
  const x = chi2stat / 2;
  let logSum = -Infinity;
  let logTerm = -x; // j=0: log(e^{-x} * x^0 / 0!) = -x
  let logX = Math.log(x);
  for (let j = 0; j < k; j++) {
    logSum = logAddExp(logSum, logTerm);
    logTerm += logX - Math.log(j + 1);
  }
  return Math.min(1, Math.exp(logSum));
}

// Fisher's method: combine independent p-values
// chi2 = -2 * sum(ln(p_i)), df = 2k  =>  p_combined = P(chi2(2k) > chi2_stat)
function fisherCombinedPValue(pValues: number[]): { p: number; chi2: number; k: number } {
  const safe = pValues.map(p => Math.max(1e-10, Math.min(1 - 1e-10, p)));
  const chi2 = -2 * safe.reduce((s, p) => s + Math.log(p), 0);
  const k = safe.length;
  return { p: chi2SurvivalEvenDF(chi2, k), chi2, k };
}

function loadSingleDataset(path: string): Map<string, number[]> {
  if (!fs.existsSync(path)) return new Map();
  const content = fs.readFileSync(path, 'utf-8');
  const records = parse(content, { columns: true, skip_empty_lines: true }) as Record<string, string>[];
  const geneData = new Map<string, number[]>();
  if (records.length === 0) return geneData;
  const headers = Object.keys(records[0]).filter(k => k !== 'Gene' && k !== 'gene' && k !== '' && k !== 'GeneID');
  const parsed = headers.map((h, idx) => {
    const match = h.match(/(?:CT|ZT|T|tp)(\d+)/i) || h.match(/^(\d+)$/);
    return { idx, time: match ? parseInt(match[1]) : idx };
  });
  parsed.sort((a, b) => a.time - b.time);
  const colOrder = parsed.map(p => headers[p.idx]);
  for (const record of records) {
    const gene = record.Gene || record.gene || record.GeneID || Object.values(record)[0];
    if (!gene || gene === 'Gene') continue;
    const values = colOrder.map(col => parseFloat(record[col])).filter(v => !isNaN(v) && isFinite(v));
    if (values.length >= 6) geneData.set(gene, values);
  }
  return geneData;
}

function runPermutationTest(
  targetLambdas: number[],
  expressionBins: Map<number, number[]>,
  targetBins: number[],
  nPerm = 5000
): { observedMeanDist: number; pValue: number; zScore: number; nullMean: number; nullSd: number } {
  const observedMeanDist = targetLambdas.reduce((a,v) => a + Math.abs(v - PHI_RECIPROCAL), 0) / targetLambdas.length;
  const permDists: number[] = [];
  for (let p = 0; p < nPerm; p++) {
    const sampled = targetBins.map(bin => {
      const pool = expressionBins.get(bin);
      return pool && pool.length > 0 ? pool[Math.floor(Math.random()*pool.length)] : 0.5;
    });
    permDists.push(sampled.reduce((a,v) => a + Math.abs(v - PHI_RECIPROCAL), 0) / sampled.length);
  }
  const pValue = permDists.filter(d => d <= observedMeanDist).length / nPerm;
  const nullMean = permDists.reduce((a,b) => a+b, 0) / permDists.length;
  const nullSd = Math.sqrt(permDists.reduce((a,v) => a+(v-nullMean)**2, 0) / permDists.length);
  const zScore = nullSd > 0 ? (observedMeanDist - nullMean) / nullSd : 0;
  return { observedMeanDist, pValue, zScore, nullMean, nullSd };
}

function lookupGene(geneData: Map<string, number[]>, name: string): number[] | undefined {
  // Try exact, then Title-case, then UPPER, then lower
  return geneData.get(name)
    || geneData.get(name.charAt(0).toUpperCase() + name.slice(1).toLowerCase())
    || geneData.get(name.toUpperCase())
    || geneData.get(name.toLowerCase());
}

// Load an Arabidopsis GSE242964 day file.
// Columns: Gene, CT00_R1, CT00_R2, CT00_R3, CT01_R1, ... CT20_R3
// We average the R1/R2/R3 replicates at each CT timepoint to produce
// a single time series per gene (7 timepoints: 0, 1, 4, 8, 12, 16, 20).
function loadArabidopsisDay(filePath: string): Map<string, number[]> {
  const result = new Map<string, number[]>();
  if (!fs.existsSync(filePath)) return result;
  const content = fs.readFileSync(filePath, 'utf-8');
  const records = parse(content, { columns: true, skip_empty_lines: true }) as Record<string, string>[];
  if (records.length === 0) return result;

  const allCols = Object.keys(records[0]);
  // Identify CT timepoints (distinct integers) and their replicate columns
  const ctGroups = new Map<number, string[]>();
  for (const col of allCols) {
    const m = col.match(/^CT(\d+)_R\d+$/i);
    if (!m) continue;
    const ct = parseInt(m[1], 10);
    if (!ctGroups.has(ct)) ctGroups.set(ct, []);
    ctGroups.get(ct)!.push(col);
  }
  const sortedCTs = [...ctGroups.keys()].sort((a, b) => a - b);
  if (sortedCTs.length < 6) return result; // need at least 6 timepoints for AR(2)

  for (const record of records) {
    const gene = (record['Gene'] || record['gene'] || record['ID'] || '').trim();
    if (!gene || gene === 'Gene') continue;
    const timeSeries: number[] = [];
    for (const ct of sortedCTs) {
      const repCols = ctGroups.get(ct)!;
      const vals = repCols.map(c => parseFloat(record[c])).filter(v => isFinite(v) && !isNaN(v));
      if (vals.length === 0) { timeSeries.push(NaN); continue; }
      timeSeries.push(vals.reduce((a, b) => a + b, 0) / vals.length);
    }
    const clean = timeSeries.filter(v => isFinite(v));
    if (clean.length >= 6) result.set(gene, timeSeries.map(v => isFinite(v) ? v : 0));
  }
  return result;
}

// Baboon cross-tissue mean |λ| per gene (keyed by UPPERCASE gene symbol)
interface BaboonGeneSummary {
  meanLambda: number;
  meanExpr: number;
  nTissues: number;
  hasComplexRoots: boolean;
  meanR2: number;
}

function loadBaboonCrossTissue(path: string): Map<string, BaboonGeneSummary> {
  const result = new Map<string, BaboonGeneSummary>();
  if (!fs.existsSync(path)) return result;

  const content = fs.readFileSync(path, 'utf-8');
  const records = parse(content, { columns: true, skip_empty_lines: true }) as Record<string, string>[];
  if (records.length === 0) return result;

  const allCols = Object.keys(records[0]);
  const idCol = allCols[0];    // EnsemblID
  const symCol = allCols[1];   // Symbol

  // Group data columns by tissue prefix (e.g. "ADC" from "ADC.ZT00")
  const tissueGroups = new Map<string, string[]>();
  for (const col of allCols.slice(2)) {
    const dotIdx = col.indexOf('.');
    if (dotIdx < 0) continue;
    const tissue = col.substring(0, dotIdx);
    if (!tissueGroups.has(tissue)) tissueGroups.set(tissue, []);
    tissueGroups.get(tissue)!.push(col);
  }

  // Sort each tissue's columns by ZT number
  for (const [tissue, cols] of tissueGroups.entries()) {
    cols.sort((a, b) => {
      const ma = a.match(/ZT(\d+)/i);
      const mb = b.match(/ZT(\d+)/i);
      return (ma ? parseInt(ma[1]) : 0) - (mb ? parseInt(mb[1]) : 0);
    });
    tissueGroups.set(tissue, cols);
  }

  for (const record of records) {
    const geneSymbol = (record[symCol] || '').trim().toUpperCase();
    if (!geneSymbol || geneSymbol.startsWith('ENSPANG')) continue;

    const perTissueLambdas: number[] = [];
    const perTissueR2: number[] = [];
    const perTissueExpr: number[] = [];
    const complexFlags: boolean[] = [];

    for (const [, cols] of tissueGroups.entries()) {
      const vals = cols.map(c => parseFloat(record[c])).filter(v => isFinite(v) && !isNaN(v));
      if (vals.length < 6) continue;
      const fit = fitAR2(vals);
      if (!fit) continue;
      perTissueLambdas.push(fit.lambda);
      perTissueR2.push(fit.r2);
      complexFlags.push(fit.hasComplexRoots);
      const meanVal = vals.reduce((a, b) => a + b, 0) / vals.length;
      perTissueExpr.push(meanVal);
    }

    if (perTissueLambdas.length === 0) continue;

    const meanLambda = perTissueLambdas.reduce((a, b) => a + b, 0) / perTissueLambdas.length;
    const meanExpr = perTissueExpr.reduce((a, b) => a + b, 0) / perTissueExpr.length;
    const meanR2 = perTissueR2.reduce((a, b) => a + b, 0) / perTissueR2.length;
    const nComplex = complexFlags.filter(Boolean).length;
    const hasComplexRoots = nComplex > perTissueLambdas.length / 2;

    result.set(geneSymbol, { meanLambda, meanExpr, nTissues: perTissueLambdas.length, hasComplexRoots, meanR2 });
  }

  return result;
}

function lookupBaboon(data: Map<string, BaboonGeneSummary>, name: string): BaboonGeneSummary | undefined {
  return data.get(name.toUpperCase()) || data.get(name);
}

// GSE157357 uses Ensembl IDs — curated mapping for the 14 target genes + 10 core clock genes
const GSE157357_ENSMUSG_MAP: Record<string, string> = {
  // 14 direct BMAL1/CLOCK target genes
  'ENSMUSG00000029238': 'Dbp',
  'ENSMUSG00000020038': 'Tef',
  'ENSMUSG00000021775': 'Nfil3',
  'ENSMUSG00000036580': 'Rora',
  'ENSMUSG00000036438': 'Rorb',
  'ENSMUSG00000040269': 'Rorc',
  'ENSMUSG00000056770': 'Bhlhe40',
  'ENSMUSG00000026413': 'Ciart',
  'ENSMUSG00000053754': 'Wee1',
  'ENSMUSG00000011960': 'Nampt',
  'ENSMUSG00000023067': 'Cdkn1a',
  'ENSMUSG00000024190': 'Ccrn4l',
  // Core clock genes
  'ENSMUSG00000055116': 'Arntl',
  'ENSMUSG00000020893': 'Clock',
  'ENSMUSG00000023153': 'Npas2',
  'ENSMUSG00000055866': 'Per1',
  'ENSMUSG00000028957': 'Per2',
  'ENSMUSG00000031099': 'Nr1d1',
  'ENSMUSG00000068742': 'Cry2',
};

function loadGSE157357(path: string): Map<string, number[]> {
  if (!fs.existsSync(path)) return new Map();
  const content = fs.readFileSync(path, 'utf-8');

  // Parse line-by-line to avoid csv-parse duplicate-column mangling
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return new Map();

  // First line is the header; split by comma respecting quotes
  const splitCsv = (line: string) =>
    line.split(',').map(v => v.replace(/^"|"$/g, '').trim());

  const headerCols = splitCsv(lines[0]);
  const idColIdx = headerCols.indexOf('target_id');
  if (idColIdx === -1) return new Map(); // unexpected format

  // Collect numeric timepoint indices (all columns that parse as numbers)
  const timeCols: { idx: number; time: number }[] = [];
  for (let i = 0; i < headerCols.length; i++) {
    if (i === idColIdx) continue;
    const t = parseInt(headerCols[i], 10);
    if (!isNaN(t)) timeCols.push({ idx: i, time: t });
  }
  // Sort by timepoint so AR(2) sees data in temporal order
  timeCols.sort((a, b) => a.time - b.time);

  const geneData = new Map<string, number[]>();
  for (let li = 1; li < lines.length; li++) {
    const cols = splitCsv(lines[li]);
    if (cols.length <= idColIdx) continue;
    const rawId = cols[idColIdx];
    if (!rawId || rawId === 'target_id') continue;
    // Translate known Ensembl IDs; keep Ensembl ID for background genes
    const symbol = GSE157357_ENSMUSG_MAP[rawId] || rawId;
    const values: number[] = [];
    for (const { idx } of timeCols) {
      const v = parseFloat(cols[idx]);
      if (!isNaN(v) && isFinite(v)) values.push(v);
    }
    if (values.length >= 6) geneData.set(symbol, values);
  }
  return geneData;
}

export interface BaboonTissueResult {
  tissue: string;
  tissueLabel: string;
  isIntestinal: boolean;
  system: string;
  nGenes: number;
  genesFound: number;
  targetLambdas: { gene: string; lambda: number; distFromPhi: number; r2: number }[];
  pValue: number;
  zScore: number;
  observedMeanDist: number;
  nullMean: number;
  nullSd: number;
  significant: boolean;
}

export interface DatasetEnrichmentResult {
  datasetId: string;
  datasetLabel: string;
  species: string;
  tissue: string;
  nGenes: number;
  nTimepoints: number;
  directTargets: {
    gene: string;
    lambda: number;
    distFromPhi: number;
    hasComplexRoots: boolean;
    r2: number;
  }[];
  coreClockGenes: {
    gene: string;
    lambda: number;
    distFromPhi: number;
    hasComplexRoots: boolean;
    r2: number;
  }[];
  permutationTest: {
    pValue: number;
    zScore: number;
    observedMeanDist: number;
    nullMean: number;
    nullSd: number;
    nPerm: number;
    significant: boolean;
  };
  genesFound: number;
  genesSearched: number;
  genomeMedianLambda: number;
  genomeMeanLambda: number;
  perTissueResults?: BaboonTissueResult[];
  fisherCombinedP?: number;
  fisherChi2?: number;
  nTissuesSig?: number;
  nTissuesTested?: number;
}

const DATASETS: { id: string; label: string; path: string; species: string; tissue: string }[] = [
  {
    id: 'gse70499_wt',
    label: 'GSE70499 — Mouse Liver (Bmal1-WT)',
    path: 'datasets/GSE70499_Liver_Bmal1WT_circadian.csv',
    species: 'Mouse',
    tissue: 'Liver',
  },
  {
    id: 'gse179027',
    label: 'GSE179027 — Mouse Intestinal Enteroid',
    path: 'datasets/GSE179027_MouseEnteroid_circadian.csv',
    species: 'Mouse',
    tissue: 'Intestinal Crypt (Enteroid)',
  },
  {
    id: 'gse161566',
    label: 'GSE161566 — Human Intestinal Enteroid',
    path: 'datasets/GSE161566_HumanEnteroid_circadian.csv',
    species: 'Human',
    tissue: 'Intestinal Crypt (Enteroid)',
  },
  {
    id: 'gse98965',
    label: 'GSE98965 — Baboon Multi-Tissue Atlas',
    path: 'datasets/GSE98965_baboon_FPKM.csv',
    species: 'Baboon',
    tissue: 'Multi-tissue atlas',
  },
  {
    id: 'gse157357_wt',
    label: 'GSE157357 — Mouse Organoid (WT)',
    path: 'datasets/GSE157357_Organoid_WT-WT_circadian.csv',
    species: 'Mouse',
    tissue: 'Intestinal Organoid (WT)',
  },
  {
    id: 'gse157357_bmalko',
    label: 'GSE157357 — Mouse Organoid (BMAL1-KO)',
    path: 'datasets/GSE157357_Organoid_WT-BmalKO_circadian.csv',
    species: 'Mouse',
    tissue: 'Intestinal Organoid (BMAL1-KO)',
  },
  {
    id: 'gse242964_dayA',
    label: 'GSE242964 — Arabidopsis Shoot (Day A)',
    path: 'datasets/GSE242964_Arabidopsis_DayA_CT-header.csv',
    species: 'Arabidopsis',
    tissue: 'Shoot (Biological Replicate A)',
  },
  {
    id: 'gse242964_dayB',
    label: 'GSE242964 — Arabidopsis Shoot (Day B)',
    path: 'datasets/GSE242964_Arabidopsis_DayB_CT-header.csv',
    species: 'Arabidopsis',
    tissue: 'Shoot (Biological Replicate B)',
  },
  {
    id: 'gse242964_dayC',
    label: 'GSE242964 — Arabidopsis Shoot (Day C)',
    path: 'datasets/GSE242964_Arabidopsis_DayC_CT-header.csv',
    species: 'Arabidopsis',
    tissue: 'Shoot (Biological Replicate C)',
  },
  {
    id: 'gse37278_wt',
    label: 'GSE37278 — Arabidopsis WT (Constant Light, 12 timepoints)',
    path: 'datasets/GSE37278_Arabidopsis_WT_ConstantLight.csv',
    species: 'Arabidopsis',
    tissue: 'Whole seedling, WT Col-0, ZT72–116 (4h intervals, LL)',
  },
  {
    id: 'gse19271_wt',
    label: 'GSE19271 — Arabidopsis WT (Constant Light, 12 timepoints)',
    path: 'datasets/GSE19271_Arabidopsis_WT_ConstantLight.csv',
    species: 'Arabidopsis',
    tissue: 'Whole seedling, WT Col-0, ZT49–93 (4h intervals, LL)',
  },
];

const cache = new Map<string, DatasetEnrichmentResult>();

export async function runReplicationAnalysis(): Promise<DatasetEnrichmentResult[]> {
  if (cache.size === DATASETS.length) return Array.from(cache.values());

  const results: DatasetEnrichmentResult[] = [];

  for (const ds of DATASETS) {
    if (cache.has(ds.id)) {
      results.push(cache.get(ds.id)!);
      continue;
    }

    // ── Baboon multi-tissue: per-tissue permutation + Fisher combination ─────
    if (ds.id === 'gse98965') {
      if (!fs.existsSync(ds.path)) {
        const empty: DatasetEnrichmentResult = {
          datasetId: ds.id, datasetLabel: ds.label, species: ds.species, tissue: ds.tissue,
          nGenes: 0, nTimepoints: 0, directTargets: [], coreClockGenes: [],
          permutationTest: { pValue: NaN, zScore: NaN, observedMeanDist: NaN, nullMean: NaN, nullSd: NaN, nPerm: 0, significant: false },
          genesFound: 0, genesSearched: DIRECT_CLOCK_TARGETS.length, genomeMedianLambda: NaN, genomeMeanLambda: NaN,
        };
        cache.set(ds.id, empty); results.push(empty); continue;
      }

      const rawContent = fs.readFileSync(ds.path, 'utf-8');
      const rawRecords = parse(rawContent, { columns: true, skip_empty_lines: true }) as Record<string, string>[];
      const allCols = Object.keys(rawRecords[0]);
      const idCol = allCols[0];
      const symCol = allCols[1];

      // Group data columns by tissue prefix
      const tissueGroups = new Map<string, string[]>();
      for (const col of allCols.slice(2)) {
        const dotIdx = col.indexOf('.');
        if (dotIdx < 0) continue;
        const tiss = col.substring(0, dotIdx);
        if (!tissueGroups.has(tiss)) tissueGroups.set(tiss, []);
        tissueGroups.get(tiss)!.push(col);
      }
      // Sort each tissue's columns by ZT number
      for (const [tiss, cols] of tissueGroups.entries()) {
        cols.sort((a, b) => {
          const ma = a.match(/ZT(\d+)/i); const mb = b.match(/ZT(\d+)/i);
          return (ma ? parseInt(ma[1]) : 0) - (mb ? parseInt(mb[1]) : 0);
        });
        tissueGroups.set(tiss, cols);
      }

      // Parse all genes: symbol → tissue → {lambda, expr, r2, hasComplex}
      type TissueFit = { lambda: number; expr: number; r2: number; hasComplex: boolean };
      const genePerTissue = new Map<string, Map<string, TissueFit>>();
      const TARGET_SET = new Set(DIRECT_CLOCK_TARGETS.map(g => g.toUpperCase()));

      for (const record of rawRecords) {
        const sym = (record[symCol] || '').trim().toUpperCase();
        if (!sym || sym.startsWith('ENSPANG')) continue;
        const tissMap = new Map<string, TissueFit>();
        for (const [tiss, cols] of tissueGroups.entries()) {
          const vals = cols.map(c => parseFloat(record[c])).filter(v => isFinite(v) && !isNaN(v));
          if (vals.length < 6) continue;
          const fit = fitAR2(vals);
          if (!fit) continue;
          const expr = vals.reduce((a, b) => a + b, 0) / vals.length;
          tissMap.set(tiss, { lambda: fit.lambda, expr, r2: fit.r2, hasComplex: fit.hasComplexRoots });
        }
        if (tissMap.size > 0) genePerTissue.set(sym, tissMap);
      }

      const tissues = [...tissueGroups.keys()];
      const nGenes = genePerTissue.size;
      const NPER = 2000; // permutations per tissue — enough for stable p-values

      // ── Per-tissue permutation test ──
      const perTissueResults: BaboonTissueResult[] = [];
      const eligiblePValues: number[] = [];

      for (const tiss of tissues) {
        // Collect all gene lambdas and expression in this tissue
        const tissLambdas: { sym: string; lambda: number; expr: number; r2: number }[] = [];
        for (const [sym, tissMap] of genePerTissue.entries()) {
          const f = tissMap.get(tiss);
          if (!f) continue;
          tissLambdas.push({ sym, lambda: f.lambda, expr: f.expr, r2: f.r2 });
        }
        if (tissLambdas.length < 50) continue; // too few genes to be meaningful

        // Build expression bins (exclude targets)
        const logExprs = tissLambdas.map(g => Math.log10(Math.max(g.expr, 1e-6)));
        const minLE = Math.min(...logExprs);
        const maxLE = Math.max(...logExprs);
        const nBT = 20;
        const bSz = (maxLE - minLE) / nBT || 1;
        const exprBins = new Map<number, number[]>();
        for (const g of tissLambdas) {
          if (TARGET_SET.has(g.sym)) continue;
          const bin = Math.min(Math.floor((Math.log10(Math.max(g.expr, 1e-6)) - minLE) / bSz), nBT - 1);
          if (!exprBins.has(bin)) exprBins.set(bin, []);
          exprBins.get(bin)!.push(g.lambda);
        }

        // Target gene lambdas and bins
        const targetInTiss: { gene: string; lambda: number; distFromPhi: number; r2: number; bin: number }[] = [];
        for (const gene of DIRECT_CLOCK_TARGETS) {
          const f = genePerTissue.get(gene.toUpperCase())?.get(tiss);
          if (!f) continue;
          const logE = Math.log10(Math.max(f.expr, 1e-6));
          const bin = Math.min(Math.floor((logE - minLE) / bSz), nBT - 1);
          const display = gene.charAt(0).toUpperCase() + gene.slice(1).toLowerCase();
          targetInTiss.push({ gene: display, lambda: f.lambda, distFromPhi: Math.abs(f.lambda - PHI_RECIPROCAL), r2: f.r2, bin });
        }
        if (targetInTiss.length < 3) continue; // need at least 3 targets

        const perm = runPermutationTest(
          targetInTiss.map(t => t.lambda),
          exprBins,
          targetInTiss.map(t => t.bin),
          NPER
        );

        const tissueInfo = BABOON_TISSUE_LABELS[tiss] ?? { name: tiss, isIntestinal: false, system: 'Unknown' };
        const tissResult: BaboonTissueResult = {
          tissue: tiss,
          tissueLabel: tissueInfo.name,
          isIntestinal: tissueInfo.isIntestinal,
          system: tissueInfo.system,
          nGenes: tissLambdas.length,
          genesFound: targetInTiss.length,
          targetLambdas: targetInTiss.map(t => ({ gene: t.gene, lambda: t.lambda, distFromPhi: t.distFromPhi, r2: t.r2 })),
          pValue: perm.pValue,
          zScore: perm.zScore,
          observedMeanDist: perm.observedMeanDist,
          nullMean: perm.nullMean,
          nullSd: perm.nullSd,
          significant: perm.pValue < 0.05,
        };
        perTissueResults.push(tissResult);
        eligiblePValues.push(perm.pValue);
      }

      // ── Fisher's combined p-value ──
      const fisher = eligiblePValues.length > 0
        ? fisherCombinedPValue(eligiblePValues)
        : { p: NaN, chi2: NaN, k: 0 };
      const nTissuesSig = perTissueResults.filter(t => t.significant).length;

      // ── Cross-tissue mean summary (for directTargets gene table) ──
      const baboonCrossMean = loadBaboonCrossTissue(ds.path);
      const allCTLambdas: number[] = [];
      for (const [, g] of baboonCrossMean.entries()) allCTLambdas.push(g.meanLambda);
      const genomeMedianLambda = median(allCTLambdas);
      const genomeMeanLambda = allCTLambdas.reduce((a, b) => a + b, 0) / (allCTLambdas.length || 1);

      const directTargetFits: DatasetEnrichmentResult['directTargets'] = [];
      for (const gene of DIRECT_CLOCK_TARGETS) {
        const g = lookupBaboon(baboonCrossMean, gene);
        if (!g) continue;
        const display = gene.charAt(0).toUpperCase() + gene.slice(1).toLowerCase();
        directTargetFits.push({
          gene: display,
          lambda: g.meanLambda,
          distFromPhi: Math.abs(g.meanLambda - PHI_RECIPROCAL),
          hasComplexRoots: g.hasComplexRoots,
          r2: g.meanR2,
        });
      }

      const coreClockFits: DatasetEnrichmentResult['coreClockGenes'] = [];
      for (const gene of CORE_CLOCK_GENES) {
        const g = lookupBaboon(baboonCrossMean, gene);
        if (!g) continue;
        const display = gene.charAt(0).toUpperCase() + gene.slice(1).toLowerCase();
        coreClockFits.push({
          gene: display,
          lambda: g.meanLambda,
          distFromPhi: Math.abs(g.meanLambda - PHI_RECIPROCAL),
          hasComplexRoots: g.hasComplexRoots,
          r2: g.meanR2,
        });
      }

      // Sort tissues: significant first, then by p-value
      perTissueResults.sort((a, b) => a.pValue - b.pValue);

      const dsResult: DatasetEnrichmentResult = {
        datasetId: ds.id,
        datasetLabel: ds.label,
        species: ds.species,
        tissue: ds.tissue,
        nGenes,
        nTimepoints: 60,
        directTargets: directTargetFits.sort((a, b) => a.distFromPhi - b.distFromPhi),
        coreClockGenes: coreClockFits.sort((a, b) => a.distFromPhi - b.distFromPhi),
        permutationTest: {
          pValue: fisher.p,
          zScore: NaN, // not defined for Fisher combination
          observedMeanDist: NaN,
          nullMean: NaN,
          nullSd: NaN,
          nPerm: NPER,
          significant: fisher.p < 0.05,
        },
        genesFound: directTargetFits.length,
        genesSearched: DIRECT_CLOCK_TARGETS.length,
        genomeMedianLambda,
        genomeMeanLambda,
        perTissueResults,
        fisherCombinedP: fisher.p,
        fisherChi2: fisher.chi2,
        nTissuesSig,
        nTissuesTested: eligiblePValues.length,
      };

      cache.set(ds.id, dsResult);
      results.push(dsResult);
      continue;
    }

    // ── Arabidopsis: use pre-specified output gene set ────────────────────────
    if (ds.id.startsWith('gse242964')) {
      const geneData = loadArabidopsisDay(ds.path);
      const nGenes = geneData.size;
      if (nGenes === 0) {
        const empty: DatasetEnrichmentResult = {
          datasetId: ds.id, datasetLabel: ds.label, species: ds.species, tissue: ds.tissue,
          nGenes: 0, nTimepoints: 0, directTargets: [], coreClockGenes: [],
          permutationTest: { pValue: NaN, zScore: NaN, observedMeanDist: NaN, nullMean: NaN, nullSd: NaN, nPerm: 0, significant: false },
          genesFound: 0, genesSearched: ARABIDOPSIS_OUTPUT_GENES.length,
          genomeMedianLambda: NaN, genomeMeanLambda: NaN,
        };
        cache.set(ds.id, empty);
        results.push(empty);
        continue;
      }

      // Fit AR(2) to all genes for genome-wide background and expression bins
      const allLambdas: number[] = [];
      const allMeans: number[] = [];
      for (const [, values] of geneData.entries()) {
        const fit = fitAR2(values);
        if (!fit) continue;
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        allLambdas.push(fit.lambda);
        allMeans.push(mean);
      }

      const logMeansA = allMeans.map(m => Math.log10(Math.max(m, 1e-3)));
      const minLogA = Math.min(...logMeansA);
      const maxLogA = Math.max(...logMeansA);
      const nBinsA = 20;
      const binSizeA = (maxLogA - minLogA) / nBinsA || 1;
      const expressionBinsA = new Map<number, number[]>();
      const targetIdsA = new Set(ARABIDOPSIS_OUTPUT_GENES.map(g => g.id));
      for (const [geneKey, values] of geneData.entries()) {
        const fit = fitAR2(values);
        if (!fit) continue;
        if (targetIdsA.has(geneKey)) continue; // exclude targets from background pool
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const logM = Math.log10(Math.max(mean, 1e-3));
        const bin = Math.min(Math.floor((logM - minLogA) / binSizeA), nBinsA - 1);
        if (!expressionBinsA.has(bin)) expressionBinsA.set(bin, []);
        expressionBinsA.get(bin)!.push(fit.lambda);
      }

      const genomeMedianLambda = median(allLambdas);
      const genomeMeanLambda = allLambdas.reduce((a, b) => a + b, 0) / (allLambdas.length || 1);

      // Fit pre-specified output genes
      const directTargetFitsA: DatasetEnrichmentResult['directTargets'] = [];
      const targetBinsA: number[] = [];
      for (const gene of ARABIDOPSIS_OUTPUT_GENES) {
        const values = geneData.get(gene.id);
        if (!values) continue;
        const fit = fitAR2(values);
        if (!fit) continue;
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const logM = Math.log10(Math.max(mean, 1e-3));
        const bin = Math.min(Math.floor((logM - minLogA) / binSizeA), nBinsA - 1);
        targetBinsA.push(bin);
        directTargetFitsA.push({
          gene: gene.display,
          lambda: fit.lambda,
          distFromPhi: Math.abs(fit.lambda - PHI_RECIPROCAL),
          hasComplexRoots: fit.hasComplexRoots,
          r2: fit.r2,
        });
      }

      // Fit core clock genes
      const coreClockFitsA: DatasetEnrichmentResult['coreClockGenes'] = [];
      for (const gene of ARABIDOPSIS_CORE_CLOCK) {
        const values = geneData.get(gene.id);
        if (!values) continue;
        const fit = fitAR2(values);
        if (!fit) continue;
        coreClockFitsA.push({
          gene: gene.display,
          lambda: fit.lambda,
          distFromPhi: Math.abs(fit.lambda - PHI_RECIPROCAL),
          hasComplexRoots: fit.hasComplexRoots,
          r2: fit.r2,
        });
      }

      const permResultA = directTargetFitsA.length >= 3
        ? runPermutationTest(directTargetFitsA.map(r => r.lambda), expressionBinsA, targetBinsA, 5000)
        : { observedMeanDist: NaN, pValue: NaN, zScore: NaN, nullMean: NaN, nullSd: NaN };

      const nTimepoints = geneData.size > 0 ? (geneData.values().next().value?.length ?? 7) : 7;

      const dsResult: DatasetEnrichmentResult = {
        datasetId: ds.id, datasetLabel: ds.label, species: ds.species, tissue: ds.tissue,
        nGenes, nTimepoints,
        directTargets: directTargetFitsA.sort((a, b) => a.distFromPhi - b.distFromPhi),
        coreClockGenes: coreClockFitsA.sort((a, b) => a.distFromPhi - b.distFromPhi),
        permutationTest: {
          ...permResultA, nPerm: 5000,
          significant: permResultA.pValue < 0.05,
        },
        genesFound: directTargetFitsA.length,
        genesSearched: ARABIDOPSIS_OUTPUT_GENES.length,
        genomeMedianLambda,
        genomeMeanLambda,
      };
      cache.set(ds.id, dsResult);
      results.push(dsResult);
      continue;
    }

    // ── High-quality Arabidopsis: TAIR-keyed datasets (GSE37278, GSE19271) ──────
    if (ds.id === 'gse37278_wt' || ds.id === 'gse19271_wt') {
      const geneData = loadSingleDataset(ds.path);
      const nGenes = geneData.size;
      if (nGenes === 0) {
        const empty: DatasetEnrichmentResult = {
          datasetId: ds.id, datasetLabel: ds.label, species: ds.species, tissue: ds.tissue,
          nGenes: 0, nTimepoints: 0, directTargets: [], coreClockGenes: [],
          permutationTest: { pValue: NaN, zScore: NaN, observedMeanDist: NaN, nullMean: NaN, nullSd: NaN, nPerm: 0, significant: false },
          genesFound: 0, genesSearched: ARABIDOPSIS_OUTPUT_GENES_TAIR.length,
          genomeMedianLambda: NaN, genomeMeanLambda: NaN,
        };
        cache.set(ds.id, empty); results.push(empty); continue;
      }

      const allLambdasT: number[] = [];
      const allMeansT: number[] = [];
      for (const [, values] of geneData.entries()) {
        const fit = fitAR2(values);
        if (!fit) continue;
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        allLambdasT.push(fit.lambda);
        allMeansT.push(mean);
      }

      const logMeansT = allMeansT.map(m => Math.log10(Math.max(m, 1e-3)));
      const minLogT = Math.min(...logMeansT);
      const maxLogT = Math.max(...logMeansT);
      const nBinsT = 20;
      const binSizeT = (maxLogT - minLogT) / nBinsT || 1;
      const expressionBinsT = new Map<number, number[]>();
      for (const [tairKey, values] of geneData.entries()) {
        const fit = fitAR2(values);
        if (!fit) continue;
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const logM = Math.log10(Math.max(mean, 1e-3));
        const bin = Math.min(Math.floor((logM - minLogT) / binSizeT), nBinsT - 1);
        // Exclude target genes from the background pool
        const isTarget = ARABIDOPSIS_OUTPUT_GENES_TAIR.some(g => g.tair === tairKey.toUpperCase());
        if (!isTarget) {
          if (!expressionBinsT.has(bin)) expressionBinsT.set(bin, []);
          expressionBinsT.get(bin)!.push(fit.lambda);
        }
      }

      const genomeMedianLambda = median(allLambdasT);
      const genomeMeanLambda = allLambdasT.reduce((a, b) => a + b, 0) / (allLambdasT.length || 1);

      const directTargetFitsT: DatasetEnrichmentResult['directTargets'] = [];
      const targetBinsT: number[] = [];
      for (const gene of ARABIDOPSIS_OUTPUT_GENES_TAIR) {
        const values = geneData.get(gene.tair) || geneData.get(gene.tair.toLowerCase());
        if (!values) continue;
        const fit = fitAR2(values);
        if (!fit) continue;
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const logM = Math.log10(Math.max(mean, 1e-3));
        const bin = Math.min(Math.floor((logM - minLogT) / binSizeT), nBinsT - 1);
        targetBinsT.push(bin);
        directTargetFitsT.push({
          gene: gene.display,
          lambda: fit.lambda,
          distFromPhi: Math.abs(fit.lambda - PHI_RECIPROCAL),
          hasComplexRoots: fit.hasComplexRoots,
          r2: fit.r2,
        });
      }

      const permResultT = directTargetFitsT.length >= 3
        ? runPermutationTest(directTargetFitsT.map(r => r.lambda), expressionBinsT, targetBinsT, 5000)
        : { observedMeanDist: NaN, pValue: NaN, zScore: NaN, nullMean: NaN, nullSd: NaN };

      const nTimepoints = geneData.size > 0 ? (geneData.values().next().value?.length ?? 12) : 12;

      const dsResult: DatasetEnrichmentResult = {
        datasetId: ds.id, datasetLabel: ds.label, species: ds.species, tissue: ds.tissue,
        nGenes, nTimepoints,
        directTargets: directTargetFitsT.sort((a, b) => a.distFromPhi - b.distFromPhi),
        coreClockGenes: [],
        permutationTest: {
          ...permResultT, nPerm: 5000,
          significant: permResultT.pValue < 0.05,
        },
        genesFound: directTargetFitsT.length,
        genesSearched: ARABIDOPSIS_OUTPUT_GENES_TAIR.length,
        genomeMedianLambda,
        genomeMeanLambda,
      };
      cache.set(ds.id, dsResult);
      results.push(dsResult);
      continue;
    }

    // ── Single-tissue datasets (existing pipeline) ────────────────────────────
    const geneData = ds.id.startsWith('gse157357')
      ? loadGSE157357(ds.path)
      : loadSingleDataset(ds.path);
    const nGenes = geneData.size;
    const nTimepoints = geneData.size > 0 ? (geneData.values().next().value?.length ?? 0) : 0;

    // Fit AR(2) to all genes for genome-wide background
    // Expression floor: mammalian RNA-seq data (TPM/RPKM/counts) uses floor=1
    //   (log10(1)=0); Arabidopsis microarray data uses floor=1e-3 to preserve
    //   the low-intensity range. Both are appropriate for their data types.
    //   Target exclusion from bins: 14 targets / ~17,000+ genes <0.1% effect;
    //   omitted here for simplicity — Arabidopsis paths exclude targets explicitly.
    const allLambdas: number[] = [];
    const allMeans: number[] = [];
    for (const [, values] of geneData.entries()) {
      const fit = fitAR2(values);
      if (!fit) continue;
      const mean = values.reduce((a,b) => a+b, 0) / values.length;
      allLambdas.push(fit.lambda);
      allMeans.push(mean);
    }

    // Build expression bins
    const logMeans = allMeans.map(m => Math.log10(Math.max(m, 1)));
    const minLog = Math.min(...logMeans);
    const maxLog = Math.max(...logMeans);
    const nBins = 20;
    const binSize = (maxLog - minLog) / nBins || 1;
    const expressionBins = new Map<number, number[]>();
    for (const [, values] of geneData.entries()) {
      const fit = fitAR2(values);
      if (!fit) continue;
      const mean = values.reduce((a,b) => a+b, 0) / values.length;
      const logM = Math.log10(Math.max(mean, 1));
      const bin = Math.min(Math.floor((logM - minLog) / binSize), nBins - 1);
      if (!expressionBins.has(bin)) expressionBins.set(bin, []);
      expressionBins.get(bin)!.push(fit.lambda);
    }

    const genomeMedianLambda = median(allLambdas);
    const genomeMeanLambda = allLambdas.reduce((a,b)=>a+b,0)/allLambdas.length;

    // Fit target genes
    const directTargetFits: DatasetEnrichmentResult['directTargets'] = [];
    const targetBins: number[] = [];

    for (const gene of DIRECT_CLOCK_TARGETS) {
      const values = lookupGene(geneData, gene);
      if (!values) continue;
      const fit = fitAR2(values);
      if (!fit) continue;
      const mean = values.reduce((a,b)=>a+b,0)/values.length;
      const logM = Math.log10(Math.max(mean,1));
      const bin = Math.min(Math.floor((logM-minLog)/binSize), nBins-1);
      targetBins.push(bin);
      const displayGene = gene.charAt(0).toUpperCase() + gene.slice(1).toLowerCase();
      directTargetFits.push({
        gene: displayGene,
        lambda: fit.lambda,
        distFromPhi: Math.abs(fit.lambda - PHI_RECIPROCAL),
        hasComplexRoots: fit.hasComplexRoots,
        r2: fit.r2,
      });
    }

    const coreClockFits: DatasetEnrichmentResult['coreClockGenes'] = [];
    for (const gene of CORE_CLOCK_GENES) {
      const values = lookupGene(geneData, gene);
      if (!values) continue;
      const fit = fitAR2(values);
      if (!fit) continue;
      const displayGene = gene.charAt(0).toUpperCase() + gene.slice(1).toLowerCase();
      coreClockFits.push({
        gene: displayGene,
        lambda: fit.lambda,
        distFromPhi: Math.abs(fit.lambda - PHI_RECIPROCAL),
        hasComplexRoots: fit.hasComplexRoots,
        r2: fit.r2,
      });
    }

    const permResult = directTargetFits.length >= 3
      ? runPermutationTest(directTargetFits.map(r => r.lambda), expressionBins, targetBins, 5000)
      : { observedMeanDist: NaN, pValue: NaN, zScore: NaN, nullMean: NaN, nullSd: NaN };

    const dsResult: DatasetEnrichmentResult = {
      datasetId: ds.id,
      datasetLabel: ds.label,
      species: ds.species,
      tissue: ds.tissue,
      nGenes,
      nTimepoints,
      directTargets: directTargetFits.sort((a,b) => a.distFromPhi - b.distFromPhi),
      coreClockGenes: coreClockFits.sort((a,b) => a.distFromPhi - b.distFromPhi),
      permutationTest: {
        ...permResult,
        nPerm: 5000,
        significant: permResult.pValue < 0.05,
      },
      genesFound: directTargetFits.length,
      genesSearched: DIRECT_CLOCK_TARGETS.length,
      genomeMedianLambda,
      genomeMeanLambda,
    };

    cache.set(ds.id, dsResult);
    results.push(dsResult);
  }

  return results;
}
