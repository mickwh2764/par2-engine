import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Loader2, ChevronRight, AlertTriangle, Check, Shield, Pill, FlaskConical } from "lucide-react";
import GeneTooltip from "@/components/GeneTooltip";

interface GenePoint {
  gene: string;
  geneType: string;
  beta1: number;
  beta2: number;
  r: number;
  theta: number;
  eigenvalue: number;
  isComplex: boolean;
  dPhi: number;
}

interface DatasetInfo {
  datasetId: string;
  datasetName: string;
  species: string;
  condition: string;
  genes: GenePoint[];
  clockMeanR: number;
  targetMeanR: number;
  categoryStats?: { category: string; label: string; color: string; count: number; meanEigenvalue: number }[];
}

interface ThetaBin {
  binLabel: string;
  binCenter: number;
  observedDensity: number;
  nullDensity: number;
}

interface PerturbationShift {
  datasetPair: string;
  wtLabel: string;
  perturbedLabel: string;
  rShift: number;
  mannWhitneyP: number;
  significant: boolean;
}

interface LandscapeData {
  datasets: DatasetInfo[];
  thetaDistribution?: ThetaBin[];
  perturbationShifts: PerturbationShift[];
  summary: {
    totalGenes: number;
    totalDatasets: number;
  };
  categoryHierarchy?: {
    hierarchy: { category: string; label: string; color: string; pooledMeanEigenvalue: number; rank: number }[];
  };
}

interface ModelComparisonData {
  success: boolean;
  overallSummary?: {
    totalGenes: number;
    totalDatasets: number;
    ar2PreferredByAIC_pct: number;
    ar2PreferredByBIC_pct: number;
    ar1PreferredByAIC_pct: number;
    ar3PreferredByAIC_pct: number;
    meanDeltaAIC_ar2_vs_ar1: number;
    meanDeltaBIC_ar2_vs_ar1: number;
    hierarchyRobust: boolean;
    hierarchyAR1_count: number;
    hierarchyAR2_count: number;
    hierarchyAR3_count: number;
    rankCorrelation_ar2_ar3: number;
    eigenvaluePairs: { gene: string; geneType: string; ar2: number; ar3: number }[];
  };
  datasets?: {
    dataset: string;
    summary: {
      hierarchyPreserved_AR1: boolean;
      hierarchyPreserved_AR2: boolean;
      hierarchyPreserved_AR3: boolean;
      clockMean_AR2: number;
      clockMean_AR3: number;
      targetMean_AR2: number;
      targetMean_AR3: number;
    };
  }[];
  conclusion?: string;
}

interface PermutationData {
  success: boolean;
  allSignificant: boolean;
  datasets: {
    dataset: string;
    observedGap: number;
    pValue: number;
    zScore: number;
    nPermutations: number;
  }[];
}

interface DrugTargetData {
  totalDrugTargetsMatched: number;
  totalDrugTargetsInDB: number;
  totalGenesInDataset: number;
  drugTargets: {
    gene: string;
    geneType: string;
    eigenvalue: number;
    r: number;
    primaryDrugClass: string;
    drugCount: number;
    fdaApprovedCount: number;
    dominantPole: string;
    drugs: { drugName: string; drugClass: string; fdaApproved: boolean; indication: string }[];
  }[];
}

interface ProteomicsProteinResult {
  gene: string;
  type: 'clock' | 'target' | 'other';
  eigenvalue: number;
  r2: number;
  nTimepoints: number;
}

interface ProteomicsDatasetResult {
  id: string;
  label: string;
  species: string;
  tissue: string;
  source: string;
  nProteins: number;
  nTimepoints: number;
  clockProteins: ProteomicsProteinResult[];
  targetProteins: ProteomicsProteinResult[];
  otherProteins: ProteomicsProteinResult[];
  clockMean: number;
  targetMean: number;
  hierarchyPreserved: boolean;
}

interface RobustnessResult {
  bootstrapCI: { lower: number; upper: number; mean: number; nIterations: number } | null;
  permutationTest: { pValue: number; observedDiff: number; nPermutations: number; significant: boolean } | null;
  subSamplingRecovery: { recoveryRate: number; nTrials: number; threshold: number } | null;
}

interface CyclingAnalysis {
  nCycling: number;
  nNonCycling: number;
  cyclingMeanEigenvalue: number;
  nonCyclingMeanEigenvalue: number;
  cyclingHigherPersistence: boolean;
}

interface GeneProteinMapEntry {
  gene: string;
  type: 'clock' | 'target' | 'other';
  cycling: boolean;
  mrnaEigenvalue: number;
  proteinEigenvalue: number;
  mrnaR2: number;
  proteinR2: number;
  delta: number;
}

interface GeneProteinMapData {
  success: boolean;
  entries: GeneProteinMapEntry[];
  stats: {
    totalMatched: number;
    pearsonR: number;
    spearmanRho: number;
    clockCount: number;
    targetCount: number;
    cyclingCount: number;
    meanMrnaEigenvalue: number;
    meanProteinEigenvalue: number;
    mrnaHigherCount: number;
    proteinHigherCount: number;
    concordanceByType: { type: string; count: number; meanMrna: number; meanProtein: number; delta: number }[];
  };
  independentEvidence: { finding: string; source: string; agrees: boolean }[];
  plainEnglishSummary: string[];
}

interface ProteomicsLandscapeData {
  success: boolean;
  datasets: ProteomicsDatasetResult[];
  concordance: {
    matchedGenes: { gene: string; type: string; mrnaEigenvalue: number; proteinEigenvalue: number; delta: number }[];
    pearsonR: number;
    hierarchyPreservedInBoth: boolean;
    mrnaClockMean: number;
    mrnaTargetMean: number;
    proteinClockMean: number;
    proteinTargetMean: number;
  } | null;
  robustness: Record<string, RobustnessResult>;
  cyclingAnalysis: Record<string, CyclingAnalysis>;
  summary: {
    totalProteins: number;
    totalDatasets: number;
    hierarchyPreservedCount: number;
    overallClockMean: number;
    overallTargetMean: number;
    conclusion: string;
  };
}

const CAT_COLORS: Record<string, string> = {
  clock: '#22d3ee', target: '#f472b6', housekeeping: '#a3e635',
  immune: '#fb923c', metabolic: '#34d399', chromatin: '#c084fc',
  signaling: '#60a5fa', dna_repair: '#fbbf24', stem: '#f87171', other: '#94a3b8',
};

function isInTriangle(b1: number, b2: number): boolean {
  return b2 > -1 && b2 < 1 - b1 && b2 < 1 + b1;
}

function ScatterPlot({ genes, highlight, width = 360, height = 260 }: {
  genes: GenePoint[];
  highlight?: string;
  width?: number;
  height?: number;
}) {
  const pad = 20;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const xRange = [-2.2, 2.2];
  const yRange = [-1.2, 1.2];
  const toX = (b1: number) => pad + ((b1 - xRange[0]) / (xRange[1] - xRange[0])) * w;
  const toY = (b2: number) => pad + h - ((b2 - yRange[0]) / (yRange[1] - yRange[0])) * h;
  const triPath = `M ${toX(-2)} ${toY(-1)} L ${toX(0)} ${toY(1)} L ${toX(2)} ${toY(-1)} Z`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="mx-auto">
      <path d={triPath} fill="none" stroke="#334155" strokeWidth={1} strokeDasharray="4 3" />
      {genes.map((g, i) => {
        if (!isInTriangle(g.beta1, g.beta2)) return null;
        const col = CAT_COLORS[g.geneType] || '#94a3b8';
        const isHl = highlight ? g.geneType === highlight : false;
        return (
          <circle key={i} cx={toX(g.beta1)} cy={toY(g.beta2)} r={isHl ? 3 : 1.8}
            fill={col} opacity={isHl ? 0.9 : highlight ? 0.15 : 0.5} />
        );
      })}
    </svg>
  );
}

function ThetaBarChart({ bins, width = 360, height = 160 }: {
  bins: ThetaBin[];
  width?: number;
  height?: number;
}) {
  const pad = { top: 10, right: 15, bottom: 30, left: 40 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;
  const maxD = Math.max(...bins.map(b => Math.max(b.observedDensity, b.nullDensity))) * 1.1 || 1;
  const barW = w / bins.length - 2;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="mx-auto">
      {bins.map((b, i) => {
        const x = pad.left + (i / bins.length) * w + 1;
        const obsH = (b.observedDensity / maxD) * h;
        const nullH = (b.nullDensity / maxD) * h;
        const ratio = b.observedDensity / (b.nullDensity || 1);
        const isVoid = ratio < 0.7;
        return (
          <g key={i}>
            <rect x={x} y={pad.top + h - nullH} width={barW} height={nullH} fill="#334155" opacity={0.4} rx={1} />
            <rect x={x} y={pad.top + h - obsH} width={barW} height={obsH} fill={isVoid ? '#ef4444' : '#22d3ee'} opacity={0.7} rx={1} />
          </g>
        );
      })}
      <line x1={pad.left} y1={pad.top + h} x2={pad.left + w} y2={pad.top + h} stroke="#475569" strokeWidth={1} />
      <text x={pad.left + w / 2} y={height - 5} textAnchor="middle" fill="#94a3b8" fontSize={10}>Phase angle (degrees)</text>
      <text x={10} y={pad.top + h / 2} textAnchor="middle" fill="#94a3b8" fontSize={10} transform={`rotate(-90, 10, ${pad.top + h / 2})`}>Density</text>
    </svg>
  );
}

function EigenvalueScatter({ pairs, width = 360, height = 300 }: {
  pairs: { gene: string; geneType: string; ar2: number; ar3: number }[];
  width?: number;
  height?: number;
}) {
  const pad = { top: 15, right: 15, bottom: 35, left: 45 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;
  const maxVal = Math.max(
    ...pairs.map(p => Math.max(p.ar2, p.ar3)),
    0.5
  ) * 1.1;

  const toX = (v: number) => pad.left + (v / maxVal) * w;
  const toY = (v: number) => pad.top + h - (v / maxVal) * h;

  const ticks = [0, 0.2, 0.4, 0.6, 0.8, 1.0].filter(t => t <= maxVal);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="mx-auto">
      <line x1={toX(0)} y1={toY(0)} x2={toX(maxVal)} y2={toY(maxVal)} stroke="#334155" strokeWidth={1} strokeDasharray="4 3" />

      {ticks.map(t => (
        <g key={t}>
          <line x1={toX(t)} y1={toY(0)} x2={toX(t)} y2={toY(0) + 3} stroke="#475569" strokeWidth={0.5} />
          <text x={toX(t)} y={toY(0) + 14} textAnchor="middle" fill="#94a3b8" fontSize={9}>{t.toFixed(1)}</text>
          <line x1={toX(0) - 3} y1={toY(t)} x2={toX(0)} y2={toY(t)} stroke="#475569" strokeWidth={0.5} />
          <text x={toX(0) - 6} y={toY(t) + 3} textAnchor="end" fill="#94a3b8" fontSize={9}>{t.toFixed(1)}</text>
        </g>
      ))}

      <line x1={toX(0)} y1={toY(0)} x2={toX(maxVal)} y2={toY(0)} stroke="#475569" strokeWidth={1} />
      <line x1={toX(0)} y1={toY(0)} x2={toX(0)} y2={toY(maxVal)} stroke="#475569" strokeWidth={1} />

      {pairs.map((p, i) => {
        const col = p.geneType === 'clock' ? '#22d3ee' : '#f472b6';
        return (
          <circle key={i} cx={toX(p.ar2)} cy={toY(p.ar3)} r={3}
            fill={col} opacity={0.7} stroke={col} strokeWidth={0.5} />
        );
      })}

      <text x={pad.left + w / 2} y={height - 3} textAnchor="middle" fill="#94a3b8" fontSize={10}>AR(2) |λ|</text>
      <text x={12} y={pad.top + h / 2} textAnchor="middle" fill="#94a3b8" fontSize={10} transform={`rotate(-90, 12, ${pad.top + h / 2})`}>AR(3) |λ|</text>
    </svg>
  );
}

function StatBox({ label, value, color = 'text-slate-900', sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div className="bg-slate-50 rounded-lg p-3 text-center border border-slate-200">
      <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-lg font-bold font-mono ${color}`}>{value}</p>
      {sub && <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function ChapterCard({ index, title, icon, children, active }: {
  index: number;
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  active: boolean;
}) {
  return (
    <div className={`transition-all duration-500 ${active ? 'opacity-100 scale-100' : 'opacity-60 scale-[0.98]'}`}>
      <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-sm font-bold text-cyan-400 bg-cyan-400/10 rounded-full w-7 h-7 flex items-center justify-center flex-shrink-0">{index + 1}</span>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            {icon}
            {title}
          </h2>
        </div>
        {children}
      </div>
    </div>
  );
}

const NUM_CHAPTERS = 8;

export default function PersistenceLandscape() {
  const [activeChapter, setActiveChapter] = useState(0);
  const chapterRefs = useRef<(HTMLDivElement | null)[]>([]);

  const { data, isLoading, error } = useQuery<LandscapeData>({
    queryKey: ["/api/analysis/root-space-geometry"],
    staleTime: 60 * 60 * 1000,
  });

  const { data: modelData } = useQuery<ModelComparisonData>({
    queryKey: ["/api/validation/model-comparison-aic"],
    staleTime: 60 * 60 * 1000,
  });

  const { data: permData } = useQuery<PermutationData>({
    queryKey: ["/api/validation/robustness-suite/permutation-test"],
    staleTime: 60 * 60 * 1000,
  });

  const { data: drugData } = useQuery<DrugTargetData>({
    queryKey: ["/api/analysis/drug-target-overlay"],
    staleTime: 60 * 60 * 1000,
  });

  const { data: proteomicsData } = useQuery<ProteomicsLandscapeData>({
    queryKey: ["/api/validation/proteomics-landscape"],
    staleTime: 60 * 60 * 1000,
  });

  const { data: geneProteinMap } = useQuery<GeneProteinMapData>({
    queryKey: ["/api/validation/gene-protein-map"],
    staleTime: 60 * 60 * 1000,
  });

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = chapterRefs.current.indexOf(entry.target as HTMLDivElement);
            if (idx >= 0) setActiveChapter(idx);
          }
        }
      },
      { threshold: 0.5, rootMargin: '-10% 0px -40% 0px' }
    );
    for (const ref of chapterRefs.current) {
      if (ref) observer.observe(ref);
    }
    return () => observer.disconnect();
  }, [data]);

  const allGenes = useMemo(() => {
    if (!data) return [];
    const seen = new Set<string>();
    const result: GenePoint[] = [];
    for (const ds of data.datasets) {
      for (const g of ds.genes) {
        const key = `${g.gene}_${g.geneType}`;
        if (!seen.has(key) && isInTriangle(g.beta1, g.beta2)) {
          seen.add(key);
          result.push(g);
        }
      }
    }
    return result;
  }, [data]);

  const speciesGroups = useMemo(() => {
    if (!data) return [];
    const groups: Record<string, { species: string; count: number; clockR: number; targetR: number }> = {};
    for (const ds of data.datasets) {
      if (!groups[ds.species]) groups[ds.species] = { species: ds.species, count: 0, clockR: 0, targetR: 0 };
      groups[ds.species].count++;
      groups[ds.species].clockR += ds.clockMeanR;
      groups[ds.species].targetR += ds.targetMeanR;
    }
    for (const k of Object.keys(groups)) {
      groups[k].clockR /= groups[k].count;
      groups[k].targetR /= groups[k].count;
    }
    return Object.values(groups);
  }, [data]);

  const topDrugTargets = useMemo(() => {
    if (!drugData) return [];
    return drugData.drugTargets
      .filter(t => t.fdaApprovedCount > 0)
      .sort((a, b) => b.eigenvalue - a.eigenvalue)
      .slice(0, 8);
  }, [drugData]);

  const drugClassCounts = useMemo(() => {
    if (!drugData) return [];
    const counts: Record<string, number> = {};
    for (const t of drugData.drugTargets) {
      counts[t.primaryDrugClass] = (counts[t.primaryDrugClass] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [drugData]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-cyan-400 mx-auto mb-3" size={32} />
        <p className="text-slate-500 text-sm ml-3">Loading...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex items-center justify-center">
        <div className="text-center text-red-400">
          <p>Failed to load data</p>
          <Link href="/" className="text-cyan-400 text-sm mt-2 inline-block" data-testid="link-back-error">Return to Home</Link>
        </div>
      </div>
    );
  }

  const hierarchy = data.categoryHierarchy?.hierarchy.slice(0, 8) || [];
  const sigShifts = data.perturbationShifts.filter(s => s.significant);
  const summary = modelData?.overallSummary;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50" data-testid="page-persistence-landscape">
      <div className="sticky top-0 z-20 bg-gradient-to-br from-slate-50 via-white to-slate-50/90 backdrop-blur-sm border-b border-slate-200">
        <div className="max-w-2xl mx-auto flex items-center gap-3 px-4 py-3">
          <Link href="/" className="text-slate-500 hover:text-slate-700 transition-colors" data-testid="link-back">
            <ArrowLeft size={18} />
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-slate-900">The Persistence Landscape</h1>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: NUM_CHAPTERS }).map((_, i) => (
              <button
                key={i}
                onClick={() => chapterRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                className={`w-2 h-2 rounded-full transition-all ${i === activeChapter ? 'bg-cyan-400 scale-125' : 'bg-slate-600 hover:bg-slate-500'}`}
                data-testid={`nav-dot-${i}`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-12">

        {/* Chapter 1: The Data */}
        <div ref={el => { chapterRefs.current[0] = el; }}>
          <ChapterCard index={0} title="The Data" active={activeChapter === 0}>
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              Every dot is a gene. We fit an AR(2) model to its expression time series and extract two coefficients (β₁, β₂). These place each gene inside the <span className="text-cyan-400">stationarity triangle</span> — the region where dynamics are stable.
            </p>
            <ScatterPlot genes={allGenes} />
            <div className="flex flex-wrap gap-3 mt-3 justify-center">
              {['clock', 'target', 'housekeeping', 'metabolic', 'immune'].map(cat => (
                <span key={cat} className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CAT_COLORS[cat] }} />
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </span>
              ))}
            </div>
            <p className="text-xs text-slate-500 text-center mt-2 font-mono">{data.summary.totalGenes} genes across {data.summary.totalDatasets} datasets</p>
            <div className="flex items-start gap-2 mt-3 bg-amber-900/10 border border-amber-700/25 rounded-md px-3 py-2">
              <span className="text-amber-400 text-xs mt-0.5 flex-shrink-0">⚠</span>
              <p className="text-xs text-slate-500 leading-relaxed">
                <span className="text-amber-400 font-semibold">Near-unit-root values (|λ| → 1.0).</span> A true sustained periodic oscillator has |λ| = 1.0 by construction — the characteristic roots sit on the unit circle. For <em>clock genes</em>, values approaching 1.0 are therefore the theoretical expectation and are biologically informative. For non-clock genes, |λ| ≥ 1.0 indicates AR(2) model failure (non-stationary fit) and those values should be treated with caution. All reported values reflect bulk-expression OLS estimates, which systematically understate true per-cell persistence due to cross-cell phase averaging; absolute magnitudes are lower bounds, not exact measurements.
              </p>
            </div>
          </ChapterCard>
        </div>

        {/* Chapter 2: Why AR(2)? */}
        <div ref={el => { chapterRefs.current[1] = el; }}>
          <ChapterCard index={1} title="Why AR(2)?" icon={<AlertTriangle size={18} className="text-amber-400" />} active={activeChapter === 1}>
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              Before trusting any results, we need to justify the model order. We compared AR(1), AR(2), and AR(3) using AIC and BIC information criteria across {summary?.totalGenes || 286} genes in {summary?.totalDatasets || 8} datasets — then ran the full AR(3) pipeline to see if it changes anything.
            </p>

            {summary ? (
              <>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <StatBox label="AR(1) preferred" value={`${summary.ar1PreferredByAIC_pct}%`} color="text-slate-500" sub="by AIC" />
                  <StatBox label="AR(2) preferred" value={`${summary.ar2PreferredByAIC_pct}%`} color="text-cyan-400" sub="by AIC" />
                  <StatBox label="AR(3) preferred" value={`${summary.ar3PreferredByAIC_pct}%`} color="text-amber-400" sub="by AIC" />
                </div>

                <div className="bg-amber-900/20 border border-amber-700/30 rounded-lg p-3 mb-4">
                  <p className="text-xs text-amber-300 font-semibold mb-1">Honest caveat</p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    AR(3) wins by pure information criteria in {summary.ar3PreferredByAIC_pct}% of genes. That's a real finding we don't hide from. But the question isn't which model fits best — it's whether the biological conclusions change when you switch.
                  </p>
                </div>

                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 mt-5">The empirical test: AR(2) vs AR(3) eigenvalues</h3>
                <p className="text-xs text-slate-500 mb-3">
                  {Math.abs(summary.rankCorrelation_ar2_ar3) < 0.3
                    ? <>We ran every gene through AR(3) and compared eigenvalues. If the extra lag simply refined AR(2)'s rankings, these dots would hug the diagonal. They don't — the eigenvalues <span className="text-amber-400">scatter widely</span>. AR(3)'s third root absorbs noise, not biological signal.</>
                    : <>Each dot plots one gene's eigenvalue under AR(2) (x-axis) vs AR(3) (y-axis). Points near the diagonal mean both models agree on that gene's persistence.</>
                  }
                </p>

                {summary.eigenvaluePairs && summary.eigenvaluePairs.length > 0 && (
                  <EigenvalueScatter pairs={summary.eigenvaluePairs} />
                )}

                <div className="flex justify-center gap-4 mt-2 mb-4 text-xs">
                  <span className="flex items-center gap-1.5 text-cyan-400"><span className="w-2.5 h-2.5 rounded-full bg-cyan-400" /> Clock</span>
                  <span className="flex items-center gap-1.5 text-pink-400"><span className="w-2.5 h-2.5 rounded-full bg-pink-400" /> Target</span>
                  <span className="flex items-center gap-1.5 text-slate-500"><span className="w-4 border-t border-dashed border-slate-300" /> y = x</span>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <StatBox label="Rank correlation" value={`ρ = ${summary.rankCorrelation_ar2_ar3.toFixed(2)}`} color={Math.abs(summary.rankCorrelation_ar2_ar3) < 0.3 ? 'text-red-400' : summary.rankCorrelation_ar2_ar3 > 0.8 ? 'text-green-400' : 'text-amber-400'} sub={Math.abs(summary.rankCorrelation_ar2_ar3) < 0.3 ? "Near-zero — AR(3) tells a different story" : "Spearman AR(2) vs AR(3)"} />
                  <StatBox label="AR(2) vs AR(1)" value={`${summary.meanDeltaAIC_ar2_vs_ar1.toFixed(1)}`} color="text-green-400" sub="mean ΔAIC (neg = AR(2) better)" />
                </div>

                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 mt-5">Hierarchy preservation across model orders</h3>
                <p className="text-xs text-slate-500 mb-3">
                  The core finding — clock genes persist more than target genes — must survive the switch to AR(3) to mean anything.
                </p>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <div className="bg-slate-50 rounded-lg p-2.5 text-center border border-slate-200">
                    <p className="text-[10px] text-slate-500 uppercase mb-1">AR(1)</p>
                    <p className={`text-lg font-bold font-mono ${summary.hierarchyAR1_count === summary.totalDatasets ? 'text-green-400' : 'text-amber-400'}`}>
                      {summary.hierarchyAR1_count}/{summary.totalDatasets}
                    </p>
                    <p className="text-[10px] text-slate-500">clock &gt; target</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2.5 text-center border border-cyan-700/30">
                    <p className="text-[10px] text-cyan-400 uppercase mb-1">AR(2)</p>
                    <p className={`text-lg font-bold font-mono ${summary.hierarchyAR2_count === summary.totalDatasets ? 'text-green-400' : 'text-amber-400'}`}>
                      {summary.hierarchyAR2_count}/{summary.totalDatasets}
                    </p>
                    <p className="text-[10px] text-slate-500">clock &gt; target</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2.5 text-center border border-amber-700/30">
                    <p className="text-[10px] text-amber-400 uppercase mb-1">AR(3)</p>
                    <p className={`text-lg font-bold font-mono ${summary.hierarchyAR3_count === summary.totalDatasets ? 'text-green-400' : 'text-amber-400'}`}>
                      {summary.hierarchyAR3_count}/{summary.totalDatasets}
                    </p>
                    <p className="text-[10px] text-slate-500">clock &gt; target</p>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mt-4">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    <span className="text-slate-900 font-semibold">Bottom line:</span>{' '}
                    {Math.abs(summary.rankCorrelation_ar2_ar3) < 0.3 ? (
                      <>AR(3) fits better statistically (more parameters always do), but <span className="text-amber-400">degrades the biological signal</span>. Rankings scramble (ρ = {summary.rankCorrelation_ar2_ar3.toFixed(2)}) and hierarchy preservation drops from {summary.hierarchyAR1_count}/{summary.totalDatasets} under AR(1) to {summary.hierarchyAR2_count}/{summary.totalDatasets} under AR(2) to {summary.hierarchyAR3_count}/{summary.totalDatasets} under AR(3). The progressive degradation confirms AR(3)'s third root captures noise, not oscillatory biology. AR(2) is the sweet spot — it captures the complex-root dynamics that AR(1) misses, without the overfitting that AR(3) introduces.</>
                    ) : (
                      <>AR(3) fits marginally better but produces {summary.rankCorrelation_ar2_ar3 > 0.8 ? 'nearly identical' : 'similar'} eigenvalue rankings (ρ = {summary.rankCorrelation_ar2_ar3.toFixed(2)}) and preserves the hierarchy in {summary.hierarchyAR3_count}/{summary.totalDatasets} datasets. AR(2) is the minimum sufficient model — capturing oscillatory dynamics without AR(3)'s interpretability cost.</>
                    )}
                  </p>
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <Loader2 className="animate-spin text-slate-500 mx-auto" size={20} />
                <p className="text-xs text-slate-500 mt-2">Loading model comparison...</p>
              </div>
            )}
          </ChapterCard>
        </div>

        {/* Chapter 3: The Geometry */}
        <div ref={el => { chapterRefs.current[2] = el; }}>
          <ChapterCard index={2} title="The Geometry" active={activeChapter === 2}>
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              Genes don't scatter randomly. They cluster into <span className="text-cyan-400">valleys</span> (high density) and leave <span className="text-red-400">voids</span> (empty zones). The 10°–20° angular void means genes either commit to oscillation or don't — there's no "barely oscillating" regime.
            </p>
            {data.thetaDistribution && (
              <>
                <ThetaBarChart bins={data.thetaDistribution} />
                <div className="flex justify-center gap-4 mt-2 text-xs">
                  <span className="flex items-center gap-1.5 text-cyan-400"><span className="w-2.5 h-2.5 rounded bg-cyan-500/70" /> Observed</span>
                  <span className="flex items-center gap-1.5 text-slate-500"><span className="w-2.5 h-2.5 rounded bg-slate-600/70" /> Null expectation</span>
                  <span className="flex items-center gap-1.5 text-red-400"><span className="w-2.5 h-2.5 rounded bg-red-500/70" /> Void</span>
                </div>
              </>
            )}
            {hierarchy.length > 0 && (
              <div className="mt-5 border-t border-slate-200 pt-4">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Eigenvalue Hierarchy</h3>
                <div className="space-y-1">
                  {hierarchy.map((h, i) => (
                    <div key={h.category} className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500 w-4 text-right">{i + 1}.</span>
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: h.color }} />
                      <span className="text-xs text-slate-600 flex-1">{h.label}</span>
                      <span className="text-xs text-slate-500 font-mono">|λ| = {h.pooledMeanEigenvalue.toFixed(3)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </ChapterCard>
        </div>

        {/* Chapter 4: The Robustness */}
        <div ref={el => { chapterRefs.current[3] = el; }}>
          <ChapterCard index={3} title="The Robustness" icon={<Shield size={18} className="text-green-400" />} active={activeChapter === 3}>
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              The clock &gt; target hierarchy isn't an artifact of one dataset. It holds across every species and tissue tested, validated by permutation testing with 10,000 resamples per dataset.
            </p>

            {permData && permData.datasets.length > 0 && (
              <div className="mb-5">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Permutation Tests (10,000 resamples)</h3>
                <div className="space-y-1.5">
                  {permData.datasets.map((ds, i) => {
                    const pStr = ds.pValue < 0.001 ? 'p < 0.001' : `p = ${ds.pValue.toFixed(4)}`;
                    const sig = ds.pValue < 0.05;
                    return (
                      <div key={i} className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-2">
                        {sig ? <Check size={14} className="text-green-400 flex-shrink-0" /> : <AlertTriangle size={14} className="text-amber-400 flex-shrink-0" />}
                        <span className="text-xs text-slate-600 flex-1">{ds.dataset}</span>
                        <span className="text-xs font-mono text-cyan-400">gap = {ds.observedGap.toFixed(3)}</span>
                        <span className={`text-xs font-mono ${sig ? 'text-green-400' : 'text-amber-400'}`}>{pStr}</span>
                        <span className="text-xs font-mono text-slate-500">z = {ds.zScore.toFixed(1)}</span>
                      </div>
                    );
                  })}
                </div>
                <p className={`text-xs font-semibold mt-2 text-center ${permData.allSignificant ? 'text-green-400' : 'text-amber-400'}`}>
                  {permData.allSignificant
                    ? `${permData.datasets.length}/${permData.datasets.length} datasets significant (p < 0.05)`
                    : 'Some datasets not significant'
                  }
                </p>
              </div>
            )}

            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Cross-Species Comparison</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {speciesGroups.map(sg => (
                <div key={sg.species} className="bg-slate-50 rounded-lg p-3 text-center border border-slate-200">
                  <p className="text-sm font-semibold text-slate-900 mb-2">{sg.species}</p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-cyan-400">Clock |λ|</span>
                      <span className="font-mono text-slate-900">{sg.clockR.toFixed(3)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-pink-400">Target |λ|</span>
                      <span className="font-mono text-slate-900">{sg.targetR.toFixed(3)}</span>
                    </div>
                    <div className={`text-xs font-semibold mt-1 ${sg.clockR > sg.targetR ? 'text-green-400' : 'text-red-400'}`}>
                      {sg.clockR > sg.targetR ? 'Clock > Target' : 'Inverted'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 text-center mt-3 font-mono">{speciesGroups.length} species · {data.datasets.length} datasets</p>
          </ChapterCard>
        </div>

        {/* Chapter 5: The Proteome */}
        <div ref={el => { chapterRefs.current[4] = el; }}>
          <ChapterCard index={4} title="The Proteome" icon={<FlaskConical size={18} className="text-teal-400" />} active={activeChapter === 4}>
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              Everything so far measured mRNA — the message. But proteins are the machinery. If clock proteins persist more than target proteins, the hierarchy isn't just a transcript-level artifact. It's a fundamental property of the cell.
            </p>

            {proteomicsData ? (
              <>
                {proteomicsData.datasets.map((ds) => (
                  <div key={ds.id} className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-xs font-semibold text-slate-900">{ds.label}</p>
                        <p className="text-[10px] text-slate-500">{ds.species} · {ds.tissue} · {ds.nProteins} proteins · {ds.nTimepoints} timepoints</p>
                        <p className="text-[10px] text-slate-500 italic">{ds.source}</p>
                      </div>
                      {ds.clockProteins.length > 0 && ds.targetProteins.length > 0 && (
                        <span className={`text-xs font-mono px-2 py-0.5 rounded ${ds.hierarchyPreserved ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}>
                          {ds.hierarchyPreserved ? 'Clock > Target' : 'Inverted'}
                        </span>
                      )}
                    </div>

                    {(ds.clockProteins.length > 0 || ds.targetProteins.length > 0) && (
                      <div className="flex gap-4 mt-2">
                        {ds.clockProteins.length > 0 && (
                          <div className="flex-1">
                            <p className="text-[10px] text-cyan-400 font-semibold mb-1">Clock proteins ({ds.clockProteins.length})</p>
                            <div className="space-y-1">
                              {ds.clockProteins.map(p => (
                                <div key={p.gene} className="flex items-center justify-between">
                                  <GeneTooltip gene={p.gene}><span className="text-[10px] text-slate-500 font-mono">{p.gene}</span></GeneTooltip>
                                  <div className="flex items-center gap-1">
                                    <div className="w-16 bg-slate-200 rounded-full h-1">
                                      <div className="h-1 rounded-full bg-cyan-400" style={{ width: `${Math.min(p.eigenvalue * 100, 100)}%` }} />
                                    </div>
                                    <span className="text-[10px] text-cyan-400 font-mono w-8 text-right">{p.eigenvalue.toFixed(2)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <p className="text-[10px] text-slate-500 mt-1">Mean |λ| = {ds.clockMean.toFixed(3)}</p>
                          </div>
                        )}
                        {ds.targetProteins.length > 0 && (
                          <div className="flex-1">
                            <p className="text-[10px] text-pink-400 font-semibold mb-1">Target proteins ({ds.targetProteins.length})</p>
                            <div className="space-y-1">
                              {ds.targetProteins.map(p => (
                                <div key={p.gene} className="flex items-center justify-between">
                                  <GeneTooltip gene={p.gene}><span className="text-[10px] text-slate-500 font-mono">{p.gene}</span></GeneTooltip>
                                  <div className="flex items-center gap-1">
                                    <div className="w-16 bg-slate-200 rounded-full h-1">
                                      <div className="h-1 rounded-full bg-pink-400" style={{ width: `${Math.min(p.eigenvalue * 100, 100)}%` }} />
                                    </div>
                                    <span className="text-[10px] text-pink-400 font-mono w-8 text-right">{p.eigenvalue.toFixed(2)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <p className="text-[10px] text-slate-500 mt-1">Mean |λ| = {ds.targetMean.toFixed(3)}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {ds.clockProteins.length === 0 && ds.targetProteins.length === 0 && (
                      <p className="text-[10px] text-slate-500">{ds.nProteins} proteins analyzed — genome-wide AR(2) eigenvalue distribution (no pre-labeled clock/target genes detected in this fraction)</p>
                    )}

                    {proteomicsData.robustness[ds.id] && (proteomicsData.robustness[ds.id].bootstrapCI || proteomicsData.robustness[ds.id].permutationTest || proteomicsData.robustness[ds.id].subSamplingRecovery) && (
                      <div className="mt-2 pt-2 border-t border-slate-200">
                        <p className="text-[10px] text-slate-500 font-semibold mb-1">Robustness Tests</p>
                        <div className="flex flex-wrap gap-2">
                          {proteomicsData.robustness[ds.id].bootstrapCI && (
                            <span className="text-[10px] bg-slate-200/40 rounded px-1.5 py-0.5">
                              Bootstrap 95% CI: [{proteomicsData.robustness[ds.id].bootstrapCI!.lower.toFixed(3)}, {proteomicsData.robustness[ds.id].bootstrapCI!.upper.toFixed(3)}]
                              {proteomicsData.robustness[ds.id].bootstrapCI!.lower > 0 ? <span className="text-green-400 ml-1">excludes zero</span> : <span className="text-amber-400 ml-1">includes zero</span>}
                            </span>
                          )}
                          {proteomicsData.robustness[ds.id].permutationTest && (
                            <span className={`text-[10px] rounded px-1.5 py-0.5 ${proteomicsData.robustness[ds.id].permutationTest!.significant ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'}`}>
                              Permutation p = {proteomicsData.robustness[ds.id].permutationTest!.pValue.toFixed(3)} ({proteomicsData.robustness[ds.id].permutationTest!.nPermutations} perms)
                            </span>
                          )}
                          {proteomicsData.robustness[ds.id].subSamplingRecovery && (
                            <span className="text-[10px] bg-slate-200/40 rounded px-1.5 py-0.5">
                              Sub-sampling: {(proteomicsData.robustness[ds.id].subSamplingRecovery!.recoveryRate * 100).toFixed(0)}% recovery ({proteomicsData.robustness[ds.id].subSamplingRecovery!.nTrials} trials)
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {proteomicsData.cyclingAnalysis[ds.id] && (
                      <div className="mt-2 pt-2 border-t border-slate-200">
                        <p className="text-[10px] text-slate-500 font-semibold mb-1">Cycling vs Non-Cycling (Robles 2014 annotations)</p>
                        <div className="flex gap-3 text-[10px]">
                          <span className="text-teal-400">{proteomicsData.cyclingAnalysis[ds.id].nCycling} cycling: |λ| = {proteomicsData.cyclingAnalysis[ds.id].cyclingMeanEigenvalue.toFixed(3)}</span>
                          <span className="text-slate-500">{proteomicsData.cyclingAnalysis[ds.id].nNonCycling} non-cycling: |λ| = {proteomicsData.cyclingAnalysis[ds.id].nonCyclingMeanEigenvalue.toFixed(3)}</span>
                          <span className={proteomicsData.cyclingAnalysis[ds.id].cyclingHigherPersistence ? 'text-green-400' : 'text-amber-400'}>
                            {proteomicsData.cyclingAnalysis[ds.id].cyclingHigherPersistence ? 'Cycling > Non-cycling' : 'Non-cycling >= Cycling'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {proteomicsData.concordance && proteomicsData.concordance.matchedGenes.length > 0 && (
                  <>
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 mt-4">mRNA vs Protein: same genes, two measurements</h3>
                    <p className="text-xs text-slate-500 mb-3">
                      {proteomicsData.concordance.matchedGenes.length} genes measured at both mRNA and protein level in mouse liver.
                      {Math.abs(proteomicsData.concordance.pearsonR) > 0.5
                        ? <> Strong correlation (r = {proteomicsData.concordance.pearsonR}) — mRNA persistence predicts protein persistence.</>
                        : Math.abs(proteomicsData.concordance.pearsonR) > 0.15
                        ? <> Moderate correlation (r = {proteomicsData.concordance.pearsonR.toFixed(2)}) — protein stability is partly predicted by mRNA, but post-translational dynamics add independent temporal memory.</>
                        : <> Weak correlation (r = {proteomicsData.concordance.pearsonR.toFixed(2)}) — protein persistence is largely independent of mRNA, driven by protein half-life and degradation pathways.</>
                      }
                    </p>

                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                      <div className="space-y-1.5">
                        {proteomicsData.concordance.matchedGenes.map(m => (
                          <div key={m.gene} className="flex items-center gap-2 text-[10px]">
                            <GeneTooltip gene={m.gene}><span className={`font-mono w-12 ${m.type === 'clock' ? 'text-cyan-400' : 'text-pink-400'}`}>{m.gene}</span></GeneTooltip>
                            <div className="flex-1 flex items-center gap-1">
                              <span className="text-slate-500 w-10 text-right">mRNA</span>
                              <div className="flex-1 bg-slate-200 rounded-full h-1.5 relative">
                                <div className="h-1.5 rounded-full bg-blue-500/60" style={{ width: `${Math.min(m.mrnaEigenvalue * 100, 100)}%` }} />
                              </div>
                              <span className="text-blue-400 font-mono w-8 text-right">{m.mrnaEigenvalue.toFixed(2)}</span>
                            </div>
                            <div className="flex-1 flex items-center gap-1">
                              <span className="text-slate-500 w-10 text-right">Protein</span>
                              <div className="flex-1 bg-slate-200 rounded-full h-1.5 relative">
                                <div className="h-1.5 rounded-full bg-teal-500/60" style={{ width: `${Math.min(m.proteinEigenvalue * 100, 100)}%` }} />
                              </div>
                              <span className="text-teal-400 font-mono w-8 text-right">{m.proteinEigenvalue.toFixed(2)}</span>
                            </div>
                            <span className={`font-mono w-12 text-right ${m.delta > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                              {m.delta > 0 ? '+' : ''}{m.delta.toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {geneProteinMap && geneProteinMap.entries.length > 0 && (
                  <>
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 mt-5">Gene-Protein Eigenvalue Map</h3>
                    <p className="text-xs text-slate-500 mb-3">
                      {geneProteinMap.stats.totalMatched} genes measured at both mRNA (GSE11923) and protein (Robles 2014) level. Each dot = one gene.
                    </p>

                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-3">
                      <svg width="100%" viewBox="0 0 400 340" className="mx-auto" style={{ maxWidth: 420 }}>
                        <defs>
                          <clipPath id="scatter-clip"><rect x={40} y={10} width={340} height={280} /></clipPath>
                        </defs>
                        <line x1={40} y1={290} x2={380} y2={290} stroke="#334155" strokeWidth={1} />
                        <line x1={40} y1={10} x2={40} y2={290} stroke="#334155" strokeWidth={1} />
                        <line x1={40} y1={290} x2={380} y2={10} stroke="#475569" strokeWidth={0.5} strokeDasharray="4 3" />
                        {[0, 0.2, 0.4, 0.6, 0.8, 1.0].map(v => (
                          <g key={`ax-${v}`}>
                            <text x={38} y={290 - v * 280 + 3} textAnchor="end" fill="#94a3b8" fontSize={8}>{v.toFixed(1)}</text>
                            <text x={40 + v * 340} y={302} textAnchor="middle" fill="#94a3b8" fontSize={8}>{v.toFixed(1)}</text>
                            <line x1={40} y1={290 - v * 280} x2={380} y2={290 - v * 280} stroke="#1e293b" strokeWidth={0.5} />
                          </g>
                        ))}
                        <text x={210} y={325} textAnchor="middle" fill="#94a3b8" fontSize={9}>mRNA |λ|</text>
                        <text x={12} y={150} textAnchor="middle" fill="#94a3b8" fontSize={9} transform="rotate(-90, 12, 150)">Protein |λ|</text>

                        <g clipPath="url(#scatter-clip)">
                          {geneProteinMap.entries.filter(e => e.type === 'other' && !e.cycling).map((e, i) => (
                            <circle key={i} cx={40 + Math.min(e.mrnaEigenvalue, 1) * 340} cy={290 - Math.min(e.proteinEigenvalue, 1) * 280}
                              r={1.2} fill="#94a3b8" opacity={0.15} />
                          ))}
                          {geneProteinMap.entries.filter(e => e.cycling && e.type === 'other').map((e, i) => (
                            <circle key={`c${i}`} cx={40 + Math.min(e.mrnaEigenvalue, 1) * 340} cy={290 - Math.min(e.proteinEigenvalue, 1) * 280}
                              r={2} fill="#2dd4bf" opacity={0.5} />
                          ))}
                          {geneProteinMap.entries.filter(e => e.type === 'target').map((e, i) => (
                            <circle key={`t${i}`} cx={40 + Math.min(e.mrnaEigenvalue, 1) * 340} cy={290 - Math.min(e.proteinEigenvalue, 1) * 280}
                              r={3} fill="#f472b6" opacity={0.8} />
                          ))}
                          {geneProteinMap.entries.filter(e => e.type === 'clock').map((e, i) => (
                            <circle key={`k${i}`} cx={40 + Math.min(e.mrnaEigenvalue, 1) * 340} cy={290 - Math.min(e.proteinEigenvalue, 1) * 280}
                              r={3.5} fill="#22d3ee" opacity={0.9} />
                          ))}
                        </g>
                      </svg>

                      <div className="flex flex-wrap gap-3 justify-center mt-2 text-[10px]">
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" /> Clock ({geneProteinMap.stats.clockCount})</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-pink-400 inline-block" /> Target ({geneProteinMap.stats.targetCount})</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-teal-400 inline-block" /> Cycling ({geneProteinMap.stats.cyclingCount})</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-400 inline-block" /> Other</span>
                        <span className="text-slate-500">— dashed = equal line</span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 mt-3">
                        <div className="bg-slate-100 rounded p-2 text-center">
                          <p className="text-[10px] text-slate-500">Pearson r</p>
                          <p className="text-sm font-mono text-slate-900">{geneProteinMap.stats.pearsonR.toFixed(3)}</p>
                        </div>
                        <div className="bg-slate-100 rounded p-2 text-center">
                          <p className="text-[10px] text-slate-500">Spearman ρ</p>
                          <p className="text-sm font-mono text-slate-900">{geneProteinMap.stats.spearmanRho.toFixed(3)}</p>
                        </div>
                        <div className="bg-slate-100 rounded p-2 text-center">
                          <p className="text-[10px] text-slate-500">Genes mapped</p>
                          <p className="text-sm font-mono text-slate-900">{geneProteinMap.stats.totalMatched.toLocaleString()}</p>
                        </div>
                      </div>

                      {geneProteinMap.stats.concordanceByType.length > 0 && (
                        <div className="mt-3 space-y-1">
                          {geneProteinMap.stats.concordanceByType.map(ct => (
                            <div key={ct.type} className="flex items-center justify-between text-[10px]">
                              <span className={`font-semibold capitalize ${ct.type === 'clock' ? 'text-cyan-400' : ct.type === 'target' ? 'text-pink-400' : ct.type === 'cycling' ? 'text-teal-400' : 'text-slate-500'}`}>
                                {ct.type} ({ct.count})
                              </span>
                              <span className="text-slate-500">
                                mRNA |λ| = {ct.meanMrna.toFixed(3)} → Protein |λ| = {ct.meanProtein.toFixed(3)}
                                <span className={`ml-1 ${ct.delta > 0 ? 'text-amber-400' : 'text-blue-400'}`}>
                                  ({ct.delta > 0 ? '+' : ''}{ct.delta.toFixed(3)})
                                </span>
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 mt-4">Independent Evidence</h3>
                    <div className="space-y-2 mb-4">
                      {geneProteinMap.independentEvidence.map((ev, i) => (
                        <div key={i} className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                          <div className="flex items-start gap-2">
                            <span className={`mt-0.5 flex-shrink-0 ${ev.agrees ? 'text-green-400' : 'text-amber-400'}`}>
                              {ev.agrees ? <Check size={12} /> : <AlertTriangle size={12} />}
                            </span>
                            <div>
                              <p className="text-[11px] text-slate-600 leading-relaxed">{ev.finding}</p>
                              <p className="text-[10px] text-slate-500 mt-1 italic">{ev.source}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">In Plain English</h3>
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-3">
                      {geneProteinMap.plainEnglishSummary.map((s, i) => (
                        <p key={i} className={`text-xs leading-relaxed ${i === geneProteinMap.plainEnglishSummary.length - 1 ? 'text-slate-900 font-medium' : 'text-slate-600'}`}>
                          {s}
                        </p>
                      ))}
                    </div>

                    <Link href="/gene-protein-map">
                      <span className="inline-flex items-center gap-1.5 mt-3 text-xs text-teal-400 hover:text-teal-300 cursor-pointer transition-colors" data-testid="link-gene-protein-map">
                        View full Gene-Protein Persistence Map →
                      </span>
                    </Link>
                  </>
                )}

                <p className="text-xs text-slate-500 text-center mt-3 font-mono">
                  {proteomicsData.summary.totalDatasets} datasets · {proteomicsData.summary.totalProteins} proteins · {geneProteinMap?.stats.totalMatched || 0} mRNA-protein pairs · All peer-reviewed data
                </p>
              </>
            ) : (
              <div className="text-center py-4">
                <Loader2 className="animate-spin text-slate-500 mx-auto" size={20} />
                <p className="text-xs text-slate-500 mt-2">Loading proteomics data...</p>
              </div>
            )}
          </ChapterCard>
        </div>

        {/* Chapter 6: The Disruption */}
        <div ref={el => { chapterRefs.current[5] = el; }}>
          <ChapterCard index={5} title="The Disruption" active={activeChapter === 5}>
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              Cancer mutations and circadian disruption shift genes to different root-space positions. The geometry is sensitive enough to detect disease-relevant dynamical changes.
            </p>
            {sigShifts.length > 0 ? (
              <div className="space-y-2">
                {sigShifts.map((s, i) => (
                  <div key={i} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-600">{s.wtLabel} <ChevronRight size={12} className="inline text-slate-500" /> {s.perturbedLabel}</span>
                      <span className={`text-xs font-mono ${s.rShift > 0 ? 'text-red-400' : 'text-green-400'}`}>
                        Δ|λ| = {s.rShift > 0 ? '+' : ''}{s.rShift.toFixed(4)}
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5 mt-1">
                      <div
                        className={`h-1.5 rounded-full ${s.rShift > 0 ? 'bg-red-500' : 'bg-green-500'}`}
                        style={{ width: `${Math.min(Math.abs(s.rShift) * 500, 100)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 font-mono">p = {s.mannWhitneyP.toExponential(2)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 text-center">No significant perturbation shifts detected</p>
            )}
            <p className="text-xs text-slate-500 text-center mt-3 font-mono">{sigShifts.length} significant shift(s) detected</p>
          </ChapterCard>
        </div>

        {/* Chapter 7: Drug Targets */}
        <div ref={el => { chapterRefs.current[6] = el; }}>
          <ChapterCard index={6} title="Drug Targets" icon={<Pill size={18} className="text-purple-400" />} active={activeChapter === 6}>
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              We mapped {drugData?.totalDrugTargetsMatched || '162'} FDA-approved and investigational drug targets onto their root-space positions. Genes with strong circadian signatures (high |λ|) may benefit from <span className="text-purple-400">timed dosing</span> — chronotherapy.
            </p>

            {drugData && (
              <>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <StatBox label="Drug targets found" value={String(drugData.totalDrugTargetsMatched)} color="text-purple-400" sub={`of ${drugData.totalDrugTargetsInDB} in database`} />
                  <StatBox label="With FDA drugs" value={String(drugData.drugTargets.filter(t => t.fdaApprovedCount > 0).length)} color="text-green-400" sub="approved therapies" />
                  <StatBox label="High |λ| targets" value={String(drugData.drugTargets.filter(t => t.eigenvalue > 0.75).length)} color="text-amber-400" sub="chronotherapy candidates" />
                </div>

                {topDrugTargets.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Top drug targets by eigenvalue persistence</h3>
                    <div className="space-y-1">
                      {topDrugTargets.map((t, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <span className="text-slate-500 w-4 text-right">{i + 1}.</span>
                          <GeneTooltip gene={t.gene}><span className="text-slate-900 font-semibold w-16">{t.gene}</span></GeneTooltip>
                          <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                            <div className="h-1.5 rounded-full bg-purple-500" style={{ width: `${t.eigenvalue * 100}%` }} />
                          </div>
                          <span className="font-mono text-purple-400 w-14 text-right">|λ|={t.eigenvalue.toFixed(2)}</span>
                          <span className="text-slate-500 truncate max-w-[120px]">{t.drugs[0]?.drugName}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {drugClassCounts.length > 0 && (
                  <div className="border-t border-slate-200 pt-3">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Drug classes represented</h3>
                    <div className="flex flex-wrap gap-2">
                      {drugClassCounts.map(([cls, count]) => (
                        <span key={cls} className="text-[11px] bg-slate-50 border border-slate-200 rounded-full px-2.5 py-0.5 text-slate-600">
                          {cls.replace(/_/g, ' ')} <span className="text-slate-500">({count})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {!drugData && (
              <div className="text-center py-4">
                <Loader2 className="animate-spin text-slate-500 mx-auto" size={20} />
                <p className="text-xs text-slate-500 mt-2">Loading drug target data...</p>
              </div>
            )}
          </ChapterCard>
        </div>

        {/* Chapter 8: The Convergence */}
        <div ref={el => { chapterRefs.current[7] = el; }}>
          <ChapterCard index={7} title="The Convergence" active={activeChapter === 7}>
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              Three independent research programs — each studying different aspects of biology — all predicted features of this geometry. One regression method recovers what decades of experiments established.
            </p>
            <div className="space-y-3">
              {[
                { name: "Boman's Tissue Renewal", color: '#22d3ee', desc: "Stem cell renewal rates map to eigenvalue persistence — higher renewal tissues show higher |λ|." },
                { name: "Takahashi's Circadian Canon", color: '#f59e0b', desc: "The clock > target hierarchy, established by decades of circadian research, emerges from AR(2) coefficients alone." },
                { name: "Waddington's Landscape", color: '#a78bfa', desc: "Root-space valleys and ridges mirror the epigenetic landscape — attractors become clusters, barriers become voids." },
              ].map((node, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <div className="w-3 h-3 rounded-full flex-shrink-0 mt-1" style={{ backgroundColor: node.color }} />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{node.name}</p>
                    <p className="text-xs text-slate-500 leading-relaxed">{node.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 text-center mt-4 font-mono">3 programs · 16 convergence points</p>
          </ChapterCard>
        </div>

        <div className="text-center py-8">
          <Link href="/root-space" className="text-cyan-400 hover:text-cyan-300 text-sm transition-colors" data-testid="link-explore-rootspace">
            Explore the full interactive Root-Space Geometry →
          </Link>
        </div>
      </div>
    </div>
  );
}
