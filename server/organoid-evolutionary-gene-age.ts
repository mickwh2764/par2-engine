import fs from "fs";
import path from "path";
import { PHYLOSTRATA_LOOKUP, TIER_META, TIER_ORDER } from "./evolutionary-gene-age";

// ─── Ensembl → mouse gene symbol mapping ────────────────────────────────────
// Manually confirmed against GSE157357 organoid feature list.
// Only genes confirmed present in the dataset are included.
export const ENSEMBL_SYMBOL_MAP: Record<string, string> = {
  // ── PS7 Vertebrate Clock ──────────────────────────────────────────────────
  'ENSMUSG00000055116': 'Arntl',
  'ENSMUSG00000029238': 'Clock',
  'ENSMUSG00000020038': 'Per1',
  'ENSMUSG00000055866': 'Per2',
  'ENSMUSG00000028957': 'Per3',
  'ENSMUSG00000068742': 'Cry1',
  'ENSMUSG00000068457': 'Cry2',
  'ENSMUSG00000021775': 'Nr1d1',
  'ENSMUSG00000044986': 'Nr1d2',
  'ENSMUSG00000032238': 'Rora',
  'ENSMUSG00000058740': 'Rorc',
  'ENSMUSG00000022433': 'Csnk1d',
  'ENSMUSG00000022471': 'Csnk1e',
  'ENSMUSG00000028847': 'Timeless',
  'ENSMUSG00000024431': 'Fbxl3',
  'ENSMUSG00000030554': 'Dbp',
  'ENSMUSG00000042489': 'Tef',
  // ── PS4 Metazoan — cell cycle ─────────────────────────────────────────────
  'ENSMUSG00000019942': 'Cdk1',
  'ENSMUSG00000064373': 'Cdk2',
  'ENSMUSG00000028212': 'Cdk4',
  'ENSMUSG00000028551': 'Cdk6',
  'ENSMUSG00000044201': 'Ccnb1',
  'ENSMUSG00000038379': 'Ccnb2',
  'ENSMUSG00000027490': 'Ccna2',
  'ENSMUSG00000006398': 'Ccna1',
  'ENSMUSG00000024474': 'Ccne1',
  'ENSMUSG00000020897': 'Cdc20',
  'ENSMUSG00000022033': 'Cdc25a',
  'ENSMUSG00000002633': 'Cdc25c',
  'ENSMUSG00000017716': 'Aurka',
  'ENSMUSG00000026970': 'Aurkb',
  'ENSMUSG00000027379': 'Aurkc',
  'ENSMUSG00000005410': 'Plk1',
  'ENSMUSG00000016559': 'Plk3',
  'ENSMUSG00000026490': 'E2f1',
  'ENSMUSG00000027371': 'E2f2',
  'ENSMUSG00000016477': 'E2f3',
  'ENSMUSG00000025075': 'E2f4',
  'ENSMUSG00000027699': 'Rb1',
  'ENSMUSG00000003031': 'Cdkn1b',
  'ENSMUSG00000044303': 'Cdkn2a',
  // PS4 — apoptosis
  'ENSMUSG00000031628': 'Casp3',
  'ENSMUSG00000024217': 'Casp8',
  'ENSMUSG00000025921': 'Casp9',
  'ENSMUSG00000024085': 'Casp1',
  'ENSMUSG00000032532': 'Casp2',
  'ENSMUSG00000030086': 'Bcl2',
  'ENSMUSG00000057329': 'Bcl2l1',
  'ENSMUSG00000003873': 'Bak1',
  'ENSMUSG00000025496': 'Bad',
  'ENSMUSG00000020808': 'Bid',
  // PS4 — p53 pathway
  'ENSMUSG00000059552': 'Tp53',
  'ENSMUSG00000041147': 'Brca2',
  'ENSMUSG00000027947': 'Brca1',
  // PS4 — signalling
  'ENSMUSG00000002413': 'Ctnnb1',
  'ENSMUSG00000004655': 'Cdh1',
  // PS2 eukaryotic — MCM / DNA replication
  'ENSMUSG00000025479': 'Mcm3',
  'ENSMUSG00000003360': 'Mcm5',
  'ENSMUSG00000031627': 'Pcna',
  'ENSMUSG00000028156': 'Mcm2',
  // ── PS1 Universal — ribosomal large subunit ───────────────────────────────
  'ENSMUSG00000060036': 'Rpl3',
  'ENSMUSG00000032383': 'Rpl5',
  'ENSMUSG00000036980': 'Rpl7',
  'ENSMUSG00000063550': 'Rpl8',
  'ENSMUSG00000024121': 'Rpl10',
  'ENSMUSG00000029614': 'Rpl10a',
  'ENSMUSG00000061878': 'Rpl11',
  'ENSMUSG00000055491': 'Rpl12',
  'ENSMUSG00000033845': 'Rpl13',
  'ENSMUSG00000006360': 'Rpl13a',
  'ENSMUSG00000001750': 'Rpl15',
  'ENSMUSG00000024537': 'Rpl18',
  'ENSMUSG00000019054': 'Rpl19',
  'ENSMUSG00000022361': 'Rpl22',
  'ENSMUSG00000060600': 'Rpl23',
  'ENSMUSG00000021585': 'Rpl23a',
  'ENSMUSG00000069662': 'Rpl24',
  'ENSMUSG00000060708': 'Rpl26',
  'ENSMUSG00000023236': 'Rpl29',
  'ENSMUSG00000040714': 'Rpl30',
  'ENSMUSG00000029636': 'Rpl31',
  'ENSMUSG00000042406': 'Rpl35',
  'ENSMUSG00000026675': 'Rpl37',
  'ENSMUSG00000047281': 'Rpl37a',
  'ENSMUSG00000048756': 'Rpl39',
  'ENSMUSG00000019842': 'Rpl40',
  'ENSMUSG00000050379': 'Rplp0',
  'ENSMUSG00000003813': 'Rplp2',
  // PS1 — ribosomal small subunit
  'ENSMUSG00000063354': 'Rps2',
  'ENSMUSG00000035202': 'Rps5',
  'ENSMUSG00000062354': 'Rps6',
  'ENSMUSG00000039621': 'Rps12',
  'ENSMUSG00000040521': 'Rps15a',
  'ENSMUSG00000026880': 'Rps16',
  'ENSMUSG00000032518': 'Rps19',
  'ENSMUSG00000040952': 'Rps20',
  'ENSMUSG00000036820': 'Rps21',
  'ENSMUSG00000049775': 'Rps27',
  'ENSMUSG00000039191': 'Rps29',
  // PS1 — glycolytic
  'ENSMUSG00000057666': 'Gapdh',
  'ENSMUSG00000029445': 'Eno1',
  'ENSMUSG00000020641': 'Eno2',
  'ENSMUSG00000006386': 'Pgk1',
  'ENSMUSG00000032294': 'Pkm',
  'ENSMUSG00000030695': 'Pfkl',
  'ENSMUSG00000033065': 'Pfkm',
  'ENSMUSG00000012443': 'Pfkp',
  'ENSMUSG00000037972': 'Hk2',
  'ENSMUSG00000025020': 'Gpi1',
  'ENSMUSG00000032348': 'Ldha',
  'ENSMUSG00000021598': 'Ldhb',
  'ENSMUSG00000030532': 'Aldoa',
  'ENSMUSG00000028656': 'Aldob',
  'ENSMUSG00000028654': 'Aldoc',
  // PS1 — TCA cycle
  'ENSMUSG00000022322': 'Cs',
  'ENSMUSG00000025950': 'Idh1',
  'ENSMUSG00000019179': 'Mdh2',
  'ENSMUSG00000021577': 'Sdha',
  'ENSMUSG00000009863': 'Sdhd',
  'ENSMUSG00000026072': 'Fh1',
  // ── PS2 Eukaryotic ────────────────────────────────────────────────────────
  'ENSMUSG00000037742': 'Actb',
  'ENSMUSG00000037408': 'Eef1a2',
  'ENSMUSG00000048538': 'Eif4a1',
  'ENSMUSG00000057594': 'Eif4e',
  'ENSMUSG00000021336': 'Eif4g1',
  // Proteasome
  'ENSMUSG00000001785': 'Psma1',
  'ENSMUSG00000036632': 'Psma5',
  'ENSMUSG00000004264': 'Psma6',
  'ENSMUSG00000027248': 'Psma7',
  'ENSMUSG00000002102': 'Psmb1',
  'ENSMUSG00000028943': 'Psmb2',
  'ENSMUSG00000020826': 'Psmc1',
  'ENSMUSG00000021024': 'Psmc4',
  'ENSMUSG00000028228': 'Psmc5',
  // Cytoskeleton
  'ENSMUSG00000028047': 'Tuba1a',
  'ENSMUSG00000026825': 'Tuba4a',
  'ENSMUSG00000040659': 'Tubb2b',
  'ENSMUSG00000021948': 'Tubb3',
  'ENSMUSG00000062070': 'Tubb4b',
  'ENSMUSG00000021285': 'Tubb5',
  // Chaperones
  'ENSMUSG00000026864': 'Hspa5',
  'ENSMUSG00000015656': 'Hspa8',
  'ENSMUSG00000050063': 'Hsp90ab1',
  'ENSMUSG00000024014': 'Hsp90b1',
  // Ubiquitin
  'ENSMUSG00000019505': 'Ubb',
  'ENSMUSG00000029580': 'Ubc',
  // ── PS8 Vertebrate Other ─────────────────────────────────────────────────
  'ENSMUSG00000024401': 'Il6',
  'ENSMUSG00000030751': 'Tnf',
  'ENSMUSG00000003380': 'Il10',
};

// ─── Genotype file map ───────────────────────────────────────────────────────
export const GENOTYPE_FILES: Record<string, { file: string; label: string; shortLabel: string; color: string }> = {
  WT:     { file: 'GSE157357_Organoid_WT-WT_circadian.csv',       label: 'Wild-Type (WT)',          shortLabel: 'WT',     color: '#3b82f6' },
  ApcKO:  { file: 'GSE157357_Organoid_ApcKO-WT_circadian.csv',    label: 'ApcKO (cancer mutation)', shortLabel: 'ApcKO',  color: '#ef4444' },
  BmalKO: { file: 'GSE157357_Organoid_WT-BmalKO_circadian.csv',   label: 'BmalKO (clock disrupted)',shortLabel: 'BmalKO', color: '#6366f1' },
  DblKO:  { file: 'GSE157357_Organoid_ApcKO-BmalKO_circadian.csv',label: 'DblKO (ApcKO + BmalKO)', shortLabel: 'DblKO',  color: '#f59e0b' },
};

// ─── AR(2) fitting ────────────────────────────────────────────────────────────
function fitAR2(ts: number[]): number | null {
  const n = ts.length;
  if (n < 4) return null;
  const mean = ts.reduce((a, b) => a + b, 0) / n;
  const y = ts.map(v => v - mean);
  let c0 = 0, c1 = 0, c2 = 0;
  for (let i = 0; i < n; i++) c0 += y[i] * y[i];
  for (let i = 1; i < n; i++) c1 += y[i] * y[i - 1];
  for (let i = 2; i < n; i++) c2 += y[i] * y[i - 2];
  c0 /= n; c1 /= n; c2 /= n;
  if (Math.abs(c0) < 1e-12) return null;
  const r1 = c1 / c0, r2 = c2 / c0;
  const denom = 1 - r1 * r1;
  if (Math.abs(denom) < 1e-10) return null;
  const phi2 = (r2 - r1 * r1) / denom;
  const phi1 = r1 * (1 - phi2);
  // Eigenvalue modulus
  const disc = phi1 * phi1 + 4 * phi2;
  let lambda: number;
  if (disc >= 0) {
    lambda = Math.max(Math.abs((phi1 + Math.sqrt(disc)) / 2), Math.abs((phi1 - Math.sqrt(disc)) / 2));
  } else {
    lambda = Math.sqrt(-phi2);
  }
  if (!isFinite(lambda) || lambda > 1.5 || lambda < 0) return null;
  return +lambda.toFixed(4);
}

// ─── Parse organoid CSV ───────────────────────────────────────────────────────
// Returns Map<ensemblId, averagedTimeSeries>
function parseOrganoidCSV(filePath: string): Map<string, number[]> {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').filter(l => l.trim());
  const header = lines[0].split(',').map(s => s.replace(/"/g, '').trim());

  // Parse timepoint columns (skip target_id at index 0)
  // Timepoints may be repeated (replicates) — collect indices per timepoint
  const tpIndices: Record<number, number[]> = {};
  for (let i = 1; i < header.length; i++) {
    const tp = parseInt(header[i]);
    if (!isNaN(tp)) {
      if (!tpIndices[tp]) tpIndices[tp] = [];
      tpIndices[tp].push(i);
    }
  }
  const sortedTps = Object.keys(tpIndices).map(Number).sort((a, b) => a - b);

  const result = new Map<string, number[]>();
  for (let li = 1; li < lines.length; li++) {
    const cols = lines[li].split(',').map(s => s.replace(/"/g, '').trim());
    const ensId = cols[0];
    if (!ensId.startsWith('ENSMUSG')) continue;

    const ts: number[] = [];
    for (const tp of sortedTps) {
      const vals = tpIndices[tp].map(idx => parseFloat(cols[idx])).filter(v => isFinite(v));
      if (vals.length === 0) { ts.push(0); continue; }
      ts.push(vals.reduce((a, b) => a + b, 0) / vals.length);
    }
    if (ts.some(v => v > 0)) {
      result.set(ensId, ts);
    }
  }
  return result;
}

// ─── Statistics (copied from evolutionary-gene-age.ts) ───────────────────────
function normalCDF(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327;
  const p = d * Math.exp(-x * x / 2) * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}

function wilcoxon(a: number[], b: number[]): { z: number; p: number } {
  const combined = [
    ...a.map(v => ({ v, g: 'A' })),
    ...b.map(v => ({ v, g: 'B' })),
  ].sort((x, y) => x.v - y.v);
  const n = combined.length;
  for (let i = 0; i < n; ) {
    let j = i;
    while (j < n && combined[j].v === combined[i].v) j++;
    const avgRank = (i + 1 + j) / 2;
    for (let k = i; k < j; k++) (combined[k] as any).rank = avgRank;
    i = j;
  }
  const nA = a.length, nB = b.length;
  const rankSumA = combined.filter(c => c.g === 'A').reduce((s, c) => s + (c as any).rank, 0);
  const U = rankSumA - nA * (nA + 1) / 2;
  const muU = nA * nB / 2;
  const sigmaU = Math.sqrt(nA * nB * (nA + nB + 1) / 12);
  const z = sigmaU > 0 ? (U - muU) / sigmaU : 0;
  const p = Math.min(1, 2 * normalCDF(-Math.abs(z)));
  return { z: +z.toFixed(3), p: +p.toFixed(4) };
}

function kruskalWallis(groups: number[][]): { H: number; df: number; p: number } {
  const all = groups.flatMap((g, i) => g.map(v => ({ v, g: i }))).sort((a, b) => a.v - b.v);
  const N = all.length;
  for (let i = 0; i < N; ) {
    let j = i;
    while (j < N && all[j].v === all[i].v) j++;
    const r = (i + 1 + j) / 2;
    for (let k = i; k < j; k++) (all[k] as any).rank = r;
    i = j;
  }
  const H = (12 / (N * (N + 1))) *
    groups.reduce((s, g, i) => {
      const rankSum = all.filter(x => x.g === i).reduce((rs, x) => rs + (x as any).rank, 0);
      return s + rankSum * rankSum / g.length;
    }, 0) - 3 * (N + 1);
  const df = groups.length - 1;
  const k = 1 - 2 / (9 * df);
  const s = Math.sqrt(2 / (9 * df));
  const z = s > 0 ? ((H / df) ** (1 / 3) - k) / s : 0;
  const p = Math.min(1, normalCDF(-z));
  return { H: +H.toFixed(2), df, p: +p.toFixed(6) };
}

function quantile(arr: number[], q: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * q;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return +(lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)).toFixed(4);
}

// ─── Per-genotype analysis ────────────────────────────────────────────────────
function analyseGenotype(genotypeKey: string): any {
  const gInfo = GENOTYPE_FILES[genotypeKey];
  const filePath = path.join(process.cwd(), 'datasets', gInfo.file);
  if (!fs.existsSync(filePath)) throw new Error(`Missing: ${gInfo.file}`);

  const tsMap = parseOrganoidCSV(filePath);

  // Match Ensembl IDs → gene symbols → phylostrata lookup
  type MatchedGene = { gene: string; ensId: string; tier: string; ps: string; age_mya: number; category: string; lambda: number };
  const matched: MatchedGene[] = [];

  for (const [ensId, ts] of tsMap) {
    const sym = ENSEMBL_SYMBOL_MAP[ensId];
    if (!sym) continue;
    const psEntry = PHYLOSTRATA_LOOKUP[sym];
    if (!psEntry) continue;
    const lambda = fitAR2(ts);
    if (lambda === null) continue;
    matched.push({ gene: sym, ensId, tier: psEntry.tier, ps: psEntry.ps, age_mya: psEntry.age_mya, category: psEntry.category, lambda });
  }

  // Group by tier
  const byTier: Record<string, number[]> = {};
  for (const t of TIER_ORDER) byTier[t] = [];
  for (const g of matched) byTier[g.tier].push(g.lambda);

  // Tier stats
  const tierStats = TIER_ORDER.map(tier => {
    const vals = byTier[tier];
    if (vals.length === 0) return null;
    const sorted = [...vals].sort((a, b) => a - b);
    return {
      tier,
      ...TIER_META[tier as keyof typeof TIER_META],
      n: vals.length,
      mean: +(vals.reduce((a, b) => a + b) / vals.length).toFixed(4),
      median: quantile(vals, 0.5),
      q25: quantile(vals, 0.25),
      q75: quantile(vals, 0.75),
      min: +sorted[0].toFixed(4),
      max: +sorted[sorted.length - 1].toFixed(4),
    };
  }).filter(Boolean);

  // Kruskal-Wallis
  const groups = TIER_ORDER.map(t => byTier[t]).filter(g => g.length > 0);
  const kw = kruskalWallis(groups);

  // Pairwise: clock vs each other tier
  const clockVals = byTier['ps7_vertebrate_clock'];
  const pairwiseClockVsOther = TIER_ORDER
    .filter(t => t !== 'ps7_vertebrate_clock')
    .map(t => {
      const other = byTier[t];
      if (clockVals.length < 3 || other.length < 3) return { comparison: `Clock vs ${TIER_META[t as keyof typeof TIER_META].label}`, tier: t, nClock: clockVals.length, nOther: other.length, z: null, p: null, significant: null };
      const wx = wilcoxon(clockVals, other);
      return { comparison: `Clock vs ${TIER_META[t as keyof typeof TIER_META].label}`, tier: t, nClock: clockVals.length, nOther: other.length, z: wx.z, p: wx.p, significant: wx.p < 0.05 };
    });

  // Non-clock tier comparisons (age gradient test)
  const wx14 = (byTier['ps1_universal'].length >= 3 && byTier['ps4_metazoan'].length >= 3) ? wilcoxon(byTier['ps1_universal'], byTier['ps4_metazoan']) : null;
  const wx18 = (byTier['ps1_universal'].length >= 3 && byTier['ps8_vertebrate_other'].length >= 3) ? wilcoxon(byTier['ps1_universal'], byTier['ps8_vertebrate_other']) : null;
  const wx48 = (byTier['ps4_metazoan'].length >= 3 && byTier['ps8_vertebrate_other'].length >= 3) ? wilcoxon(byTier['ps4_metazoan'], byTier['ps8_vertebrate_other']) : null;

  // Genome-wide (all matched genes)
  const allLambdas = matched.map(g => g.lambda);
  const genomeWide = {
    n: allLambdas.length,
    mean: +(allLambdas.reduce((a, b) => a + b, 0) / allLambdas.length).toFixed(4),
    median: quantile(allLambdas, 0.5),
    q25: quantile(allLambdas, 0.25),
    q75: quantile(allLambdas, 0.75),
  };

  // Tier percentiles (where does each tier sit in the overall distribution)
  const sortedAll = [...allLambdas].sort((a, b) => a - b);
  const tierPercentiles = TIER_ORDER.map(tier => {
    const med = tierStats.find(t => t?.tier === tier)?.median;
    if (med === undefined) return null;
    const pct = Math.round((sortedAll.filter(v => v <= med).length / sortedAll.length) * 100);
    return { tier, medianPercentile: pct };
  }).filter(Boolean);

  return {
    genotype: genotypeKey,
    label: gInfo.label,
    shortLabel: gInfo.shortLabel,
    color: gInfo.color,
    nMatched: matched.length,
    genes: matched,
    tierStats,
    kruskalWallis: kw,
    pairwiseClockVsOther,
    nonClockComparisons: { ps1vs4: wx14, ps1vs8: wx18, ps4vs8: wx48 },
    genomeWide,
    tierPercentiles,
    interpretation: {
      mainFinding: kw.p < 0.05
        ? `KW H=${kw.H} (df=${kw.df}), p=${kw.p}: tier distributions differ significantly (p<0.05). Clock tier median=${tierStats.find(t => t?.tier === 'ps7_vertebrate_clock')?.median ?? '—'}.`
        : `KW H=${kw.H} (df=${kw.df}), p=${kw.p}: no significant difference across tiers. Clock tier median=${tierStats.find(t => t?.tier === 'ps7_vertebrate_clock')?.median ?? '—'}.`,
      metazoanNote: `Metazoan (PS4) tier n=${byTier['ps4_metazoan'].length}, median=${quantile(byTier['ps4_metazoan'], 0.5)}. In ApcKO this tier includes the high-|λ| E2F/CDK programme.`,
    },
  };
}

// ─── Cache ────────────────────────────────────────────────────────────────────
let cache: Record<string, any> | null = null;

export function computeOrganoidEvolutionaryAnalysis() {
  if (cache) return cache;

  const results: Record<string, any> = {};
  for (const gKey of Object.keys(GENOTYPE_FILES)) {
    try {
      results[gKey] = analyseGenotype(gKey);
    } catch (e) {
      results[gKey] = { error: String(e), genotype: gKey, label: GENOTYPE_FILES[gKey].label };
    }
  }

  // Cross-genotype delta table: for each tier, how does median change across genotypes?
  const tierDeltas = TIER_ORDER.map(tier => {
    const meta = TIER_META[tier as keyof typeof TIER_META];
    const wtMed   = results['WT']?.tierStats?.find((t: any) => t.tier === tier)?.median ?? null;
    const apcMed  = results['ApcKO']?.tierStats?.find((t: any) => t.tier === tier)?.median ?? null;
    const bmalMed = results['BmalKO']?.tierStats?.find((t: any) => t.tier === tier)?.median ?? null;
    const dblMed  = results['DblKO']?.tierStats?.find((t: any) => t.tier === tier)?.median ?? null;
    return {
      tier,
      label: meta.label,
      color: meta.color,
      WT: wtMed,
      ApcKO: apcMed,
      BmalKO: bmalMed,
      DblKO: dblMed,
      apcVsWt:  wtMed !== null && apcMed  !== null ? +(apcMed  - wtMed).toFixed(4) : null,
      bmalVsWt: wtMed !== null && bmalMed !== null ? +(bmalMed - wtMed).toFixed(4) : null,
      dblVsWt:  wtMed !== null && dblMed  !== null ? +(dblMed  - wtMed).toFixed(4) : null,
    };
  });

  cache = {
    dataset: 'GSE157357 (Stokes et al., 2021, intestinal organoids)',
    genotypes: results,
    tierDeltas,
    genotypeKeys: Object.keys(GENOTYPE_FILES),
    genotypeMeta: GENOTYPE_FILES,
  };
  return cache;
}
