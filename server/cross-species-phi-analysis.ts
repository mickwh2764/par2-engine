import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

const PHI = 1.6180339887498949;
const INV_PHI = 1 / PHI;

export interface GenePhiResult {
  gene: string;
  species: string;
  tissue: string;
  beta1: number;
  beta2: number;
  ratio: number | null;
  distToPhiAbs: number | null;
  fibSimilarity: number;
  isFibLike: boolean;
  eigenvalue: number;
  nPoints: number;
  category: 'clock' | 'background';
}

export interface SpeciesResult {
  species: string;
  tissue: string;
  dataset: string;
  clockGenes: GenePhiResult[];
  backgroundGenes: GenePhiResult[];
  clockMeanRatio: number | null;
  clockMeanFibSim: number;
  clockFibLikeCount: number;
  clockFibLikePct: number;
  nullFibLikeRate: number;
  enrichmentRatio: number;
  pValue: number;
}

export interface CrossSpeciesPhiResult {
  species: SpeciesResult[];
  sharedGenes: SharedGeneResult[];
  nullFibRate: number;
  summary: string;
}

export interface SharedGeneResult {
  humanName: string;
  ratios: { species: string; gene: string; ratio: number | null; fibSim: number; isFibLike: boolean }[];
  allNearPhi: boolean;
  meanRatio: number | null;
  consistency: 'high' | 'moderate' | 'low';
}

function fitAR2(raw: number[]): { beta1: number; beta2: number; eigenvalue: number } | null {
  if (raw.length < 5) return null;
  const mean = raw.reduce((a, b) => a + b, 0) / raw.length;
  const y = raw.map(v => v - mean);

  let s11 = 0, s12 = 0, s22 = 0, sy1 = 0, sy2 = 0;
  for (let t = 2; t < y.length; t++) {
    s11 += y[t - 1] * y[t - 1];
    s12 += y[t - 1] * y[t - 2];
    s22 += y[t - 2] * y[t - 2];
    sy1 += y[t] * y[t - 1];
    sy2 += y[t] * y[t - 2];
  }

  const det = s11 * s22 - s12 * s12;
  if (Math.abs(det) < 1e-15) return null;

  const beta1 = (sy1 * s22 - sy2 * s12) / det;
  const beta2 = (sy2 * s11 - sy1 * s12) / det;

  const disc = beta1 * beta1 + 4 * beta2;
  let eigenvalue: number;
  if (disc >= 0) {
    eigenvalue = Math.max(
      Math.abs((beta1 + Math.sqrt(disc)) / 2),
      Math.abs((beta1 - Math.sqrt(disc)) / 2)
    );
  } else {
    eigenvalue = Math.sqrt(-beta2);
  }

  if (!isFinite(eigenvalue) || eigenvalue > 2) return null;
  eigenvalue = Math.min(eigenvalue, 1.0);

  return { beta1, beta2, eigenvalue };
}

function computePhiMetrics(beta1: number, beta2: number): {
  ratio: number | null;
  distToPhiAbs: number | null;
  fibSimilarity: number;
  isFibLike: boolean;
} {
  if (Math.abs(beta2) < 1e-10) {
    return { ratio: null, distToPhiAbs: null, fibSimilarity: 0, isFibLike: false };
  }
  const ratio = Math.abs(beta1 / beta2);
  const distToPhiAbs = Math.abs(ratio - PHI);
  const fibSimilarity = Math.max(0, 1 - distToPhiAbs / PHI);
  const isFibLike = distToPhiAbs < PHI * 0.10;
  return { ratio, distToPhiAbs, fibSimilarity, isFibLike };
}

function isStableAR2(b1: number, b2: number): boolean {
  return Math.abs(b2) < 1 && b1 + b2 < 1 && b2 - b1 < 1;
}

function runNullSurvey(n = 50000): number {
  const threshold = PHI * 0.10;
  let hits = 0;
  let stable = 0;
  for (let i = 0; i < n; i++) {
    const b1 = (Math.random() * 4) - 2;
    const b2 = (Math.random() * 2) - 1;
    if (!isStableAR2(b1, b2)) continue;
    stable++;
    const ratio = Math.abs(b2) > 1e-10 ? Math.abs(b1 / b2) : 0;
    if (Math.abs(ratio - PHI) < threshold) hits++;
  }
  return stable > 0 ? hits / stable : 0.04;
}

function binomialPValue(observed: number, total: number, nullRate: number): number {
  if (total === 0 || nullRate <= 0) return 1;
  const expected = total * nullRate;
  const variance = total * nullRate * (1 - nullRate);
  if (variance <= 0) return 1;
  const z = (observed - expected) / Math.sqrt(variance);
  return 1 - normalCDF(z);
}

function normalCDF(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const p = 1 - (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * z * z) * poly;
  return z >= 0 ? p : 1 - p;
}

function processGenes(
  geneMap: Record<string, number[]>,
  clockList: string[],
  backgroundList: string[],
  species: string,
  tissue: string,
  dataset: string
): { clock: GenePhiResult[]; background: GenePhiResult[] } {
  const processGene = (gene: string, category: 'clock' | 'background'): GenePhiResult | null => {
    const values = geneMap[gene];
    if (!values || values.length < 5) return null;
    const fit = fitAR2(values);
    if (!fit) return null;
    const metrics = computePhiMetrics(fit.beta1, fit.beta2);
    return {
      gene,
      species,
      tissue,
      beta1: fit.beta1,
      beta2: fit.beta2,
      ratio: metrics.ratio,
      distToPhiAbs: metrics.distToPhiAbs,
      fibSimilarity: metrics.fibSimilarity,
      isFibLike: metrics.isFibLike,
      eigenvalue: fit.eigenvalue,
      nPoints: values.length,
      category,
    };
  };

  const clock = clockList.map(g => processGene(g, 'clock')).filter(Boolean) as GenePhiResult[];
  const background = backgroundList.map(g => processGene(g, 'background')).filter(Boolean) as GenePhiResult[];
  return { clock, background };
}

function loadMouseLiver(): Record<string, number[]> {
  const fp = path.join(process.cwd(), 'datasets', 'GSE54650_Liver_circadian.csv');
  if (!fs.existsSync(fp)) return {};
  const rows = parse(fs.readFileSync(fp, 'utf-8'), { columns: true, skip_empty_lines: true }) as Record<string, string>[];
  const map: Record<string, number[]> = {};
  for (const row of rows) {
    const gene = row['Gene'] || row['gene'] || row['GeneSymbol'];
    if (!gene) continue;
    const vals = Object.entries(row)
      .filter(([k]) => k !== 'Gene' && k !== 'gene' && k !== 'GeneSymbol')
      .map(([, v]) => parseFloat(v as string))
      .filter(v => isFinite(v));
    if (vals.length >= 5) map[gene] = vals;
  }
  return map;
}

function loadHumanBlood(): Record<string, number[]> {
  const fp = path.join(process.cwd(), 'datasets', 'GSE113883_Human_WholeBlood.csv');
  if (!fs.existsSync(fp)) return {};
  const rows = parse(fs.readFileSync(fp, 'utf-8'), { columns: true, skip_empty_lines: true }) as Record<string, string>[];
  const map: Record<string, number[]> = {};
  for (const row of rows) {
    const gene = row['gene_id'] || row['Gene'] || row['gene'];
    if (!gene) continue;
    const vals = Object.entries(row)
      .filter(([k]) => k !== 'gene_id' && k !== 'Gene' && k !== 'gene')
      .map(([, v]) => parseFloat(v as string))
      .filter(v => isFinite(v));
    if (vals.length >= 5) map[gene] = vals;
  }
  return map;
}

function loadBaboonLiver(): Record<string, number[]> {
  const fp = path.join(process.cwd(), 'datasets', 'GSE98965_baboon_FPKM.csv');
  if (!fs.existsSync(fp)) return {};
  const rows = parse(fs.readFileSync(fp, 'utf-8'), { columns: true, skip_empty_lines: true }) as Record<string, string>[];
  const liverPrefix = 'LIV';
  const map: Record<string, number[]> = {};
  for (const row of rows) {
    const gene = row['Symbol'] || row['EnsemblID'];
    if (!gene || gene.startsWith('ENSPANG')) continue;
    const vals = Object.entries(row)
      .filter(([k]) => k.startsWith(liverPrefix + '.'))
      .map(([, v]) => parseFloat(v as string))
      .filter(v => isFinite(v));
    if (vals.length >= 5) map[gene] = vals;
  }
  return map;
}

// Locus ID → gene symbol map for all Arabidopsis clock genes.
// Used to load from GSE19271/GSE37278 (regular 4-hour intervals, 12 timepoints) which is
// preferred over GSE242964 for AR(2) because GSE242964 has irregular timepoints
// (CT00, CT01, CT04, CT08, CT12, CT16, CT20) that violate the equal-spacing assumption.
// Sources: TAIR 10; core 12 confirmed by Nakamichi lab & Hicks et al.; RVE/LNK/ABF1 by Qin et al. 2025.
const ARAB_LOCUS_TO_SYMBOL: Record<string, string> = {
  // Core clock genes
  'AT2G46830': 'CCA1', 'AT2G46830.1': 'CCA1',
  'AT1G01060': 'LHY',  'AT1G01060.1': 'LHY',
  'AT5G61380': 'TOC1', 'AT5G61380.1': 'TOC1',
  'AT2G46790': 'PRR9', 'AT2G46790.1': 'PRR9',
  'AT5G02810': 'PRR7', 'AT5G02810.1': 'PRR7',
  'AT5G24470': 'PRR5', 'AT5G24470.1': 'PRR5',
  'AT1G32060': 'PRR3', 'AT1G32060.1': 'PRR3',
  'AT1G22770': 'GI',   'AT1G22770.1': 'GI',
  'AT2G25930': 'ELF3', 'AT2G25930.1': 'ELF3',
  'AT2G40080': 'ELF4', 'AT2G40080.1': 'ELF4',
  'AT3G46640': 'LUX',  'AT3G46640.1': 'LUX',
  'AT5G57360': 'ZTL',  'AT5G57360.1': 'ZTL',
  // RVE (REVEILLE) morning MYB TFs — Qin et al. 2025
  'AT5G02840': 'RVE4', 'AT5G02840.1': 'RVE4',
  'AT5G52660': 'RVE6', 'AT5G52660.1': 'RVE6',
  'AT3G09600': 'RVE8', 'AT3G09600.1': 'RVE8',
  // LNK evening scaffolds — Qin et al. 2025
  'AT5G64170': 'LNK1', 'AT5G64170.1': 'LNK1',
  'AT3G54500': 'LNK2', 'AT3G54500.1': 'LNK2',
  // ABF1 candidate regulator — Qin et al. 2025
  'AT1G49720': 'ABF1', 'AT1G49720.1': 'ABF1',
};

/** Helper: load one CSV file, mapping locus IDs to gene symbols. Returns {} if file missing. */
function loadLocusIdCsv(filename: string): Record<string, number[]> {
  const fp = path.join(process.cwd(), 'datasets', filename);
  if (!fs.existsSync(fp)) return {};
  const rows = parse(fs.readFileSync(fp, 'utf-8'), { columns: true, skip_empty_lines: true }) as Record<string, string>[];
  const result: Record<string, number[]> = {};
  for (const row of rows) {
    const rawId = row['Gene'] || row['gene'] || row['gene_id'] || Object.values(row)[0] as string;
    const symbol = ARAB_LOCUS_TO_SYMBOL[rawId] ?? rawId; // keep symbol if already mapped, else raw ID
    const vals = Object.entries(row)
      .filter(([k]) => !/^Gene$/i.test(k) && k !== 'gene_id' && k !== 'ID')
      .map(([, v]) => parseFloat(v as string))
      .filter(v => isFinite(v));
    if ([...new Set(vals)].length >= 3 && vals.length >= 5) result[symbol] = vals;
  }
  return result;
}

function loadArabidopsis(): Record<string, number[]> {
  // Load order: prefer regular 4-hour interval datasets (12 timepoints each) over
  // GSE242964 which has irregular timepoints (CT00, CT01, CT04, CT08, CT12, CT16, CT20)
  // that violate AR(2) equal-spacing assumption.
  //
  // GSE19271 (Huang et al. 2012): WT Col-0 LL, ZT49–ZT93, 4h intervals, 12 points
  //   → has CCA1, LHY, TOC1, PRR7, PRR5, PRR3, GI, ELF3, ELF4, LUX, ZTL, RVE4/6/8, LNK1/2, ABF1
  //   → MISSING PRR9 (AT2G46790)
  // GSE37278 (Mockler/Kay lab): WT LL, ZT72–ZT116, 4h intervals, 12 points
  //   → has all clock genes incl. PRR9; used to fill PRR9 and any gaps from GSE19271
  // GSE242964 (Redmond et al. 2024): shoots, CT-header with replicates
  //   → fallback only for genes not found in the above (unlikely needed now)

  const map: Record<string, number[]> = {};

  // Layer 1: GSE19271 — best oscillation amplitude for morning-peaking genes
  const gse19271 = loadLocusIdCsv('GSE19271_Arabidopsis_WT_ConstantLight.csv');
  Object.assign(map, gse19271);

  // Layer 2: GSE37278 — fills PRR9 and any remaining gaps
  const gse37278 = loadLocusIdCsv('GSE37278_Arabidopsis_WT_ConstantLight.csv');
  for (const [sym, vals] of Object.entries(gse37278)) {
    if (!map[sym]) map[sym] = vals;
  }

  // Layer 3: GSE242964 — irregular spacing fallback (replicate-averaged)
  // Only used for any gene symbol that still isn't loaded from locus-ID datasets.
  const gse242964Candidates = [
    'GSE242964_Arabidopsis_DayA_CT-header.csv',
    'GSE242964_arabidopsis_circadian_averaged.csv',
    'GSE242964_arabidopsis_circadian.csv',
  ];
  let fp242 = '';
  for (const c of gse242964Candidates) {
    const p = path.join(process.cwd(), 'datasets', c);
    if (fs.existsSync(p)) { fp242 = p; break; }
  }
  if (fp242) {
    const rows = parse(fs.readFileSync(fp242, 'utf-8'), { columns: true, skip_empty_lines: true }) as Record<string, string>[];
    const colKeys = rows.length > 0 ? Object.keys(rows[0]).filter(k => !/^Gene$/i.test(k) && k !== 'gene_id' && k !== 'ID') : [];
    const hasReplicates = colKeys.some(k => /_R\d+$/.test(k));
    for (const row of rows) {
      const gene = row['Gene'] || row['gene'] || row['gene_id'] || row['ID'];
      if (!gene || map[gene]) continue; // already loaded from regular-interval dataset
      let series: number[];
      if (hasReplicates) {
        const groups: Record<string, number[]> = {};
        for (const [k, v] of Object.entries(row)) {
          if (/^Gene$/i.test(k) || k === 'gene_id' || k === 'ID') continue;
          const baseKey = k.replace(/_R\d+$/, '');
          const val = parseFloat(v as string);
          if (isFinite(val)) { if (!groups[baseKey]) groups[baseKey] = []; groups[baseKey].push(val); }
        }
        const sorted = Object.entries(groups)
          .map(([tp, vals]) => ({ tpNum: parseFloat(tp.replace(/[A-Za-z]+/, '')) || 0, avg: vals.reduce((a, b) => a + b, 0) / vals.length }))
          .sort((a, b) => a.tpNum - b.tpNum);
        series = sorted.map(x => x.avg);
      } else {
        series = Object.entries(row)
          .filter(([k]) => !/^Gene$/i.test(k) && k !== 'gene_id' && k !== 'ID')
          .map(([, v]) => parseFloat(v as string)).filter(v => isFinite(v));
      }
      if ([...new Set(series)].length >= 3 && series.length >= 5) map[gene] = series;
    }
  }

  // Tertiary: Qin et al. 2025 snRNA-seq pseudo-bulk mesophyll S0 (13 timepoints, 4h intervals)
  // File created when GEO data is downloaded; used if present.
  const qin2025 = path.join(process.cwd(), 'datasets', 'GSE_Qin2025_Arabidopsis_snRNAseq_pseudobulk_S0.csv');
  if (fs.existsSync(qin2025)) {
    const qrows = parse(fs.readFileSync(qin2025, 'utf-8'), { columns: true, skip_empty_lines: true }) as Record<string, string>[];
    for (const row of qrows) {
      const gene = row['Gene'] || row['gene'];
      if (!gene) continue;
      // Prefer snRNA-seq over bulk for genes that are present in both
      const vals = Object.entries(row)
        .filter(([k]) => !/^Gene$/i.test(k) && k !== 'gene')
        .map(([, v]) => parseFloat(v as string))
        .filter(v => isFinite(v));
      const uniqueVals = [...new Set(vals)];
      if (uniqueVals.length >= 3 && vals.length >= 5) map[gene] = vals;
    }
  }

  return map;
}

/**
 * Load Qin et al. 2025 snRNA-seq pseudo-bulk data when available.
 * Returns per-cluster maps: { S0: { CCA1: [...], LHY: [...] }, S1: { ... }, ... }
 * Falls back to empty object if files are not yet downloaded.
 */
export function loadQin2025SnRNAseq(): Record<string, Record<string, number[]>> {
  const clusters = ['S0', 'S1', 'S2', 'S7', 'S3', 'S5']; // shoot mesophyll + epidermis
  const result: Record<string, Record<string, number[]>> = {};
  for (const cluster of clusters) {
    const fp = path.join(process.cwd(), 'datasets', `GSE_Qin2025_Arabidopsis_snRNAseq_pseudobulk_${cluster}.csv`);
    if (!fs.existsSync(fp)) continue;
    const rows = parse(fs.readFileSync(fp, 'utf-8'), { columns: true, skip_empty_lines: true }) as Record<string, string>[];
    const clusterMap: Record<string, number[]> = {};
    for (const row of rows) {
      const gene = row['Gene'] || row['gene'];
      if (!gene) continue;
      const vals = Object.entries(row)
        .filter(([k]) => !/^Gene$/i.test(k) && k !== 'gene')
        .map(([, v]) => parseFloat(v as string))
        .filter(v => isFinite(v));
      if ([...new Set(vals)].length >= 3 && vals.length >= 5) clusterMap[gene] = vals;
    }
    if (Object.keys(clusterMap).length > 0) result[cluster] = clusterMap;
  }
  return result;
}

function sampleBackground(geneMap: Record<string, number[]>, clockGenes: string[], n = 80): string[] {
  const all = Object.keys(geneMap).filter(g => !clockGenes.includes(g));
  const shuffled = all.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

export function runCrossSpeciesPhiAnalysis(): CrossSpeciesPhiResult {
  const nullFibRate = runNullSurvey(50000);

  const mouseClockGenes = ['Per1','Per2','Per3','Cry1','Cry2','Arntl','Clock','Nr1d1','Nr1d2','Dbp','Rora','Rorc','Bhlhe40','Bhlhe41'];
  const humanClockGenes = ['PER1','PER2','PER3','CRY1','CRY2','ARNTL','CLOCK','NR1D1','NR1D2','DBP','RORA','RORC','BHLHE40','BHLHE41'];
  // Extended panel: original 10 (GSE242964) + RVE4/6/8 + LNK1/2 from GSE19271 (Qin et al. 2025 confirmed)
  // RVE6 note: marginally non-stationary in GSE19271 (|λ|≈1.03); included but flagged in output
  // ABF1: newly identified circadian regulator (Qin et al. 2025); included as candidate
  const arabidopsisClockGenes = [
    'CCA1','LHY','TOC1','PRR5','PRR7','PRR9','GI','ELF3','ELF4','LUX',
    'RVE4','RVE6','RVE8','LNK1','LNK2','ABF1',
  ];

  const mouseMap = loadMouseLiver();
  const humanMap = loadHumanBlood();
  const baboonMap = loadBaboonLiver();
  const arabMap = loadArabidopsis();

  const mouseBg = sampleBackground(mouseMap, mouseClockGenes);
  const humanBg = sampleBackground(humanMap, humanClockGenes);
  const baboonBg = sampleBackground(baboonMap, humanClockGenes);
  const arabBg = sampleBackground(arabMap, arabidopsisClockGenes);

  const buildSpeciesResult = (
    species: string,
    tissue: string,
    dataset: string,
    geneMap: Record<string, number[]>,
    clockList: string[],
    bgList: string[]
  ): SpeciesResult => {
    const { clock, background } = processGenes(geneMap, clockList, bgList, species, tissue, dataset);
    const validRatios = clock.filter(g => g.ratio !== null).map(g => g.ratio as number);
    const clockMeanRatio = validRatios.length > 0 ? validRatios.reduce((a, b) => a + b, 0) / validRatios.length : null;
    const clockMeanFibSim = clock.length > 0 ? clock.reduce((a, b) => a + b.fibSimilarity, 0) / clock.length : 0;
    const clockFibLikeCount = clock.filter(g => g.isFibLike).length;
    const clockFibLikePct = clock.length > 0 ? clockFibLikeCount / clock.length : 0;
    const pVal = binomialPValue(clockFibLikeCount, clock.length, nullFibRate);
    const enrichmentRatio = nullFibRate > 0 ? clockFibLikePct / nullFibRate : 1;

    return {
      species, tissue, dataset,
      clockGenes: clock,
      backgroundGenes: background,
      clockMeanRatio,
      clockMeanFibSim,
      clockFibLikeCount,
      clockFibLikePct,
      nullFibLikeRate: nullFibRate,
      enrichmentRatio,
      pValue: pVal,
    };
  };

  const speciesResults: SpeciesResult[] = [
    buildSpeciesResult('Mouse', 'Liver', 'GSE54650', mouseMap, mouseClockGenes, mouseBg),
    buildSpeciesResult('Human', 'Whole Blood', 'GSE113883', humanMap, humanClockGenes, humanBg),
    buildSpeciesResult('Baboon', 'Liver', 'GSE98965', baboonMap, humanClockGenes, baboonBg),
    buildSpeciesResult('Arabidopsis', 'Shoot', 'GSE242964', arabMap, arabidopsisClockGenes, arabBg),
  ];

  const sharedPairs: Array<{ humanName: string; mouseGene: string; humanGene: string; baboonGene: string; arabGene: string | null }> = [
    { humanName: 'ARNTL/Arntl (BMAL1)', mouseGene: 'Arntl', humanGene: 'ARNTL', baboonGene: 'ARNTL', arabGene: 'CCA1' },
    { humanName: 'PER2/Per2', mouseGene: 'Per2', humanGene: 'PER2', baboonGene: 'PER2', arabGene: 'TOC1' },
    { humanName: 'CRY1/Cry1', mouseGene: 'Cry1', humanGene: 'CRY1', baboonGene: 'CRY1', arabGene: null },
    { humanName: 'NR1D1/Nr1d1 (REV-ERBα)', mouseGene: 'Nr1d1', humanGene: 'NR1D1', baboonGene: 'NR1D1', arabGene: null },
    { humanName: 'CLOCK/Clock', mouseGene: 'Clock', humanGene: 'CLOCK', baboonGene: 'CLOCK', arabGene: null },
  ];

  const getGeneResult = (speciesResult: SpeciesResult, gene: string): GenePhiResult | null =>
    speciesResult.clockGenes.find(g => g.gene === gene) || null;

  const sharedGenes: SharedGeneResult[] = sharedPairs.map(pair => {
    const mouseRes = speciesResults.find(s => s.species === 'Mouse');
    const humanRes = speciesResults.find(s => s.species === 'Human');
    const baboonRes = speciesResults.find(s => s.species === 'Baboon');
    const arabRes = speciesResults.find(s => s.species === 'Arabidopsis');

    const entries: { species: string; gene: string; ratio: number | null; fibSim: number; isFibLike: boolean }[] = [];

    const addEntry = (res: SpeciesResult | undefined, gene: string, speciesName: string) => {
      if (!res || !gene) return;
      const r = getGeneResult(res, gene);
      if (r) entries.push({ species: speciesName, gene, ratio: r.ratio, fibSim: r.fibSimilarity, isFibLike: r.isFibLike });
    };

    addEntry(mouseRes, pair.mouseGene, 'Mouse');
    addEntry(humanRes, pair.humanGene, 'Human');
    addEntry(baboonRes, pair.baboonGene, 'Baboon');
    if (pair.arabGene) addEntry(arabRes, pair.arabGene, 'Arabidopsis');

    const validRatios = entries.filter(e => e.ratio !== null).map(e => e.ratio as number);
    const meanRatio = validRatios.length > 0 ? validRatios.reduce((a, b) => a + b, 0) / validRatios.length : null;
    const allNearPhi = entries.length >= 2 && entries.filter(e => e.isFibLike).length >= Math.ceil(entries.length * 0.5);

    const spread = validRatios.length > 1
      ? Math.max(...validRatios) - Math.min(...validRatios)
      : Infinity;

    const consistency: 'high' | 'moderate' | 'low' =
      spread < 0.3 && allNearPhi ? 'high' :
      spread < 0.8 ? 'moderate' : 'low';

    return { humanName: pair.humanName, ratios: entries, allNearPhi, meanRatio, consistency };
  });

  const significantSpecies = speciesResults.filter(s => s.pValue < 0.05).length;
  const summary = `Cross-species φ analysis: ${significantSpecies}/4 species show significant Fibonacci-like coefficient ratios in clock genes (p<0.05 vs stability-filtered null rate of ${(nullFibRate * 100).toFixed(1)}%). ${sharedGenes.filter(g => g.consistency === 'high').length} of ${sharedGenes.length} conserved gene pairs show high cross-species consistency near φ = ${PHI.toFixed(4)}.`;

  return { species: speciesResults, sharedGenes, nullFibRate, summary };
}

// ---------------------------------------------------------------------------
// Bulk vs snRNA-seq cell-type-specific eigenvalue comparison
// Ref: Qin et al. 2025, Nat Commun 16:4171
// ---------------------------------------------------------------------------

export interface BulkVsSnRNAGeneResult {
  gene: string;
  locusId: string;
  bulkDataset: string;
  bulkLambda: number | null;
  bulkBeta1: number | null;
  bulkBeta2: number | null;
  bulkRatio: number | null;
  bulkPhiSim: number | null;
  bulkNPoints: number;
  // per-cluster snRNA-seq values (populated when Qin2025 data is downloaded)
  snrnaclusters: Record<string, {
    lambda: number | null; beta1: number | null; beta2: number | null;
    ratio: number | null; phiSim: number | null; nPoints: number;
    deltaLambda: number | null; // snRNA - bulk
  }>;
  snrnaDataset: string;
  dataStatus: 'bulk_only' | 'bulk_and_snrna';
  note?: string;
}

export interface BulkVsSnRNAResult {
  genes: BulkVsSnRNAGeneResult[];
  bulkDataset: string;
  snrnaDataset: string;
  snrnaAvailable: boolean;
  snrnaClusterCount: number;
  dilutionHypothesis: string;
  methodNote: string;
}

export function runBulkVsSnRNAComparison(): BulkVsSnRNAResult {
  const CLOCK_GENE_LOCI: Record<string, string> = {
    CCA1: 'AT2G46830', LHY: 'AT1G01060', TOC1: 'AT5G61380',
    PRR9: 'AT2G46790', PRR7: 'AT5G02810', PRR5: 'AT5G24470',
    PRR3: 'AT1G32060', GI:  'AT1G22770', ELF3: 'AT2G25930',
    ELF4: 'AT2G40080', LUX: 'AT3G46640', ZTL:  'AT5G57360',
    RVE4: 'AT5G02840', RVE6: 'AT5G52660', RVE8: 'AT3G09600',
    LNK1: 'AT5G64170', LNK2: 'AT3G54500', ABF1: 'AT1G49720',
  };
  const RVE6_NOTE = 'RVE6 marginally non-stationary in bulk GSE19271 (|λ|≈1.03); snRNA-seq estimate pending';
  const ABF1_NOTE = 'ABF1: candidate circadian regulator (Qin et al. 2025); relatively flat in bulk (low amplitude)';

  // Load bulk data (GSE242964 primary + GSE19271 supplemental)
  const bulkMap = loadArabidopsis();

  // Load snRNA-seq pseudo-bulk per cluster (empty if not yet downloaded)
  const snrnaMap = loadQin2025SnRNAseq();
  const snrnaAvailable = Object.keys(snrnaMap).length > 0;
  const clusters = Object.keys(snrnaMap); // e.g. ['S0','S1','S2','S7']

  // Re-use the same fitAR2 from the existing closure
  function computeAR2(series: number[]): { lambda: number; beta1: number; beta2: number; ratio: number | null; phiSim: number | null } | null {
    if (!series || series.length < 5) return null;
    const mean = series.reduce((a, b) => a + b, 0) / series.length;
    const y = series.map(v => v - mean);
    let s11 = 0, s12 = 0, s22 = 0, sy1 = 0, sy2 = 0;
    for (let t = 2; t < y.length; t++) {
      s11 += y[t-1]*y[t-1]; s12 += y[t-1]*y[t-2]; s22 += y[t-2]*y[t-2];
      sy1 += y[t]*y[t-1];   sy2 += y[t]*y[t-2];
    }
    const det = s11*s22 - s12*s12;
    if (Math.abs(det) < 1e-15) return null;
    const beta1 = (sy1*s22 - sy2*s12) / det;
    const beta2 = (sy2*s11 - sy1*s12) / det;
    const disc = beta1*beta1 + 4*beta2;
    let lambda: number;
    if (disc >= 0) {
      lambda = Math.max(Math.abs((beta1 + Math.sqrt(disc)) / 2), Math.abs((beta1 - Math.sqrt(disc)) / 2));
    } else {
      lambda = Math.sqrt(-beta2);
    }
    if (!isFinite(lambda) || lambda > 2) return null;
    const ratio = Math.abs(beta2) > 1e-10 ? Math.abs(beta1 / beta2) : null;
    const phiSim = ratio !== null ? Math.max(0, 1 - Math.abs(ratio - PHI) / PHI) : null;
    return { lambda, beta1, beta2, ratio, phiSim };
  }

  const genes: BulkVsSnRNAGeneResult[] = Object.entries(CLOCK_GENE_LOCI).map(([gene, locusId]) => {
    const bulkSeries = bulkMap[gene];
    const bulkFit = bulkSeries ? computeAR2(bulkSeries) : null;
    // Determine which bulk dataset supplied this gene (GSE19271 is now primary for all clock genes)
    const inGSE37278Only = ['PRR9'].includes(gene); // PRR9 not in GSE19271, comes from GSE37278
    const bulkDataset = inGSE37278Only
      ? 'GSE37278 (bulk WT LL, 4h intervals)'
      : 'GSE19271 (bulk WT LL, 4h intervals)';

    type ClusterEntry = BulkVsSnRNAGeneResult['snrnaclusters'][string];
    const snrnaClusters: Record<string, ClusterEntry> = {};
    for (const cluster of clusters) {
      const clusterSeries = snrnaMap[cluster]?.[gene];
      const clusterFit = clusterSeries ? computeAR2(clusterSeries) : null;
      snrnaClusters[cluster] = {
        lambda: clusterFit?.lambda ?? null,
        beta1: clusterFit?.beta1 ?? null,
        beta2: clusterFit?.beta2 ?? null,
        ratio: clusterFit?.ratio ?? null,
        phiSim: clusterFit?.phiSim ?? null,
        nPoints: clusterSeries?.length ?? 0,
        deltaLambda: clusterFit && bulkFit ? clusterFit.lambda - bulkFit.lambda : null,
      };
    }

    const note = gene === 'RVE6' ? RVE6_NOTE : gene === 'ABF1' ? ABF1_NOTE : undefined;

    return {
      gene,
      locusId,
      bulkDataset,
      bulkLambda: bulkFit?.lambda ?? null,
      bulkBeta1: bulkFit?.beta1 ?? null,
      bulkBeta2: bulkFit?.beta2 ?? null,
      bulkRatio: bulkFit?.ratio ?? null,
      bulkPhiSim: bulkFit?.phiSim ?? null,
      bulkNPoints: bulkSeries?.length ?? 0,
      snrnaclusters: snrnaClusters,
      snrnaDataset: 'Qin et al. 2025 Nat Commun 16:4171 (snRNA-seq pseudo-bulk, mesophyll clusters S0/S1/S2/S7)',
      dataStatus: snrnaAvailable && clusters.length > 0 ? 'bulk_and_snrna' : 'bulk_only',
      note,
    };
  });

  const dilutionHypothesis = snrnaAvailable
    ? 'Dilution hypothesis testable: compare bulkLambda vs snrnaCluster S0 lambda for CCA1/LHY/TOC1. Positive delta (snRNA > bulk) supports cell-type averaging suppressing bulk persistence estimates.'
    : 'Dilution hypothesis pending: Qin et al. 2025 snRNA-seq pseudo-bulk data not yet downloaded. Download from GEO (accession TBC — check zhailab.bio.sustech.edu.cn/sc_circadian or corresponding author) and place per-cluster CSVs as datasets/GSE_Qin2025_Arabidopsis_snRNAseq_pseudobulk_{S0,S1,S2,S7,S3,S5}.csv to enable comparison.';

  return {
    genes,
    bulkDataset: 'GSE242964 (primary, shoot bulk) + GSE19271 (supplemental, WT LL)',
    snrnaDataset: 'Qin et al. 2025 Nat Commun 16:4171 (DOI: 10.1038/s41467-025-59424-8)',
    snrnaAvailable,
    snrnaClusterCount: clusters.length,
    dilutionHypothesis,
    methodNote: 'AR(2) fit on mean-centred time series; |λ| = modulus of dominant eigenvalue of characteristic polynomial; phi_sim = max(0, 1 − |ratio−φ|/φ) where ratio = |β₁/β₂| and φ = 1.6180.',
  };
}
