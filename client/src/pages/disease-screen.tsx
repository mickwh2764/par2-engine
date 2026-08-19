import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine
} from "recharts";
import {
  ArrowLeft, ArrowRight, Loader2, TrendingUp, TrendingDown, Search, Filter, Dna, Activity, AlertTriangle, BarChart3,
  Shield, CheckCircle2, XCircle, ChevronDown, ChevronUp, GitBranch
} from "lucide-react";
import { Link } from "wouter";
import HowTo from "@/components/HowTo";
import PaperCrossLinks from "@/components/PaperCrossLinks";
import InsightCallout from "@/components/InsightCallout";
import ExportReport from "@/components/ExportReport";
import DownloadResultsButton from "@/components/DownloadResultsButton";
import GeneTooltip from "@/components/GeneTooltip";

interface DiseasePair {
  id: number;
  healthyId: string;
  diseaseId: string;
  label: string;
  category: string;
  healthyName: string;
  diseaseName: string;
}

interface ShiftEntry {
  gene: string;
  geneType: string;
  geneCategory: string;
  healthyEigenvalue: number;
  diseaseEigenvalue: number;
  shift: number;
  absShift: number;
  fractionalShift: number;
  healthyBeta1: number;
  healthyBeta2: number;
  diseaseBeta1: number;
  diseaseBeta2: number;
  healthyR2: number;
  diseaseR2: number;
  healthyConfidence: string;
  diseaseConfidence: string;
  healthyStable: boolean;
  diseaseStable: boolean;
  regimeChange: string;
  phiCrossing: boolean;
  healthyPeriodSamples: number | null;
  diseasePeriodSamples: number | null;
}

interface ScreenResult {
  pair: { label: string; category: string; healthyName: string; diseaseName: string; healthyId: string; diseaseId: string };
  summary: {
    totalHealthyGenes: number;
    totalDiseaseGenes: number;
    sharedGenes: number;
    filteredGenes: number;
    genesUp: number;
    genesDown: number;
    meanShift: number;
    meanAbsShift: number;
    regimeChanges: number;
    regimeChangePercent: number;
    filters: { minR2: number; onlyStable: boolean };
  };
  shifts: ShiftEntry[];
  totalShifts: number;
  categoryStats: { category: string; count: number; meanShift: number; meanAbsShift: number }[];
  shiftDistribution: { center: number; count: number }[];
  highlights: ShiftEntry[];
}

interface ConsensusData {
  genes: string[];
  pairs: { index: number; label: string; category: string }[];
  entries: { gene: string; pairIndex: number; pairLabel: string; pairCategory: string; shift: number; direction: string }[];
}

interface RobustnessData {
  pairIndex: number;
  pairLabel: string;
  pairCategory: string;
  sharedGeneCount: number;
  categoryPermutations: Array<{
    category: string;
    nGenes: number;
    observedMeanShift: number;
    pValue: number;
    zScore: number;
    nullHistogram: Array<{ binMin: number; binMax: number; count: number }>;
  }>;
  globalTest: { testStatistic: number; pValue: number; significant: boolean };
  bootstrapShifts: Array<{
    gene: string;
    category: string;
    pointEstimate: number;
    ci95Lower: number;
    ci95Upper: number;
    ciWidth: number;
    excludesZero: boolean;
  }>;
  fdr: {
    totalGenesTested: number;
    significantAt005: number;
    significantAt010: number;
    significantAt020: number;
    highlightQValues: Array<{ gene: string; pValue: number; qValue: number; significant005: boolean }>;
  };
  diagnosticsSummary: {
    healthyCounts: Record<string, number>;
    diseaseCounts: Record<string, number>;
    confidenceDropped: Array<{ gene: string; healthyConfidence: string; diseaseConfidence: string }>;
    highlightDiagnostics: Array<{ gene: string; healthyConfidence: string; diseaseConfidence: string }>;
  };
  conclusion: string;
}

type SortField = "gene" | "geneCategory" | "healthyEigenvalue" | "diseaseEigenvalue" | "shift" | "fractionalShift" | "healthyR2" | "diseaseR2" | "regimeChange" | "healthyPeriodSamples";
type SortDir = "asc" | "desc";

const R2_OPTIONS = [0, 0.05, 0.1, 0.2];

const CATEGORY_COLORS: Record<string, string> = {
  Cancer: "bg-red-900/50 text-red-300 border-red-700",
  "Clock Disruption": "bg-blue-900/50 text-blue-300 border-blue-700",
  "Circadian Disruption": "bg-purple-900/50 text-purple-300 border-purple-700",
  Aging: "bg-amber-900/50 text-amber-300 border-amber-700",
};

const CAT_FILL: Record<string, string> = {
  clock: '#3b82f6', target: '#f59e0b', housekeeping: '#6b7280',
  immune: '#10b981', metabolic: '#8b5cf6', signaling: '#06b6d4',
  stem: '#ec4899', other: '#94a3b8',
};

function geneTypeBadge(geneType: string) {
  if (geneType === "clock") return <Badge className="bg-blue-900/50 text-blue-300 border-blue-700">clock</Badge>;
  if (geneType === "target") return <Badge className="bg-amber-900/50 text-amber-300 border-amber-700">target</Badge>;
  return <Badge variant="outline" className="text-slate-500 border-slate-300">{geneType}</Badge>;
}

function categoryBadge(cat: string) {
  const cls = CATEGORY_COLORS[cat] || "text-slate-500 border-slate-300";
  return <Badge className={cls}>{cat}</Badge>;
}

// ── Root-space trajectory (existing) ─────────────────────────────────────────
function TrajectoryMap({ highlights }: { highlights: ShiftEntry[] }) {
  const svgX = (b1: number) => 50 + (b1 + 2) * (500 / 4);
  const svgY = (b2: number) => 380 - (b2 + 1) * (350 / 2);
  const [hoveredGene, setHoveredGene] = useState<ShiftEntry | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const parabolaPoints = useMemo(() => {
    const pts: string[] = [];
    for (let b1 = -2; b1 <= 2; b1 += 0.05) {
      const b2 = b1 * b1 / 4;
      if (b2 <= 1) pts.push(`${svgX(b1)},${svgY(b2)}`);
    }
    return pts.join(" ");
  }, []);

  const trianglePoints = `${svgX(-2)},${svgY(-1)} ${svgX(0)},${svgY(1)} ${svgX(2)},${svgY(-1)}`;

  return (
    <div className="relative">
      <svg viewBox="0 0 600 400" className="w-full" style={{ maxHeight: 400 }} data-testid="trajectory-map-svg">
        <rect width="600" height="400" fill="#0f172a" />
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
          </marker>
        </defs>
        <polygon points={trianglePoints} fill="none" stroke="#475569" strokeWidth="1.5" strokeDasharray="6 3" />
        <polyline points={parabolaPoints} fill="none" stroke="#eab308" strokeWidth="1" strokeDasharray="4 3" opacity="0.6" />
        <line x1={svgX(-2)} y1={svgY(0)} x2={svgX(2)} y2={svgY(0)} stroke="#334155" strokeWidth="0.5" />
        <line x1={svgX(0)} y1={svgY(-1)} x2={svgX(0)} y2={svgY(1)} stroke="#334155" strokeWidth="0.5" />
        <text x={svgX(2) + 5} y={svgY(0) + 4} fill="#94a3b8" fontSize="11">β₁</text>
        <text x={svgX(0) + 5} y={svgY(1) - 5} fill="#94a3b8" fontSize="11">β₂</text>
        {highlights.map((h, idx) => {
          const hx = svgX(h.healthyBeta1);
          const hy = svgY(h.healthyBeta2);
          const dx = svgX(h.diseaseBeta1);
          const dy = svgY(h.diseaseBeta2);
          return (
            <g key={idx}
              onMouseEnter={(e) => {
                setHoveredGene(h);
                const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                setTooltipPos({ x: (hx + dx) / 2 * rect.width / 600, y: Math.min(hy, dy) * rect.height / 400 - 10 });
              }}
              onMouseLeave={() => setHoveredGene(null)}
              className="cursor-pointer"
              data-testid={`trajectory-gene-${idx}`}>
              <line x1={hx} y1={hy} x2={dx} y2={dy} stroke="#64748b" strokeWidth="1.5" markerEnd="url(#arrowhead)" opacity="0.7" />
              <circle cx={hx} cy={hy} r={3} fill="#22c55e" />
              <circle cx={dx} cy={dy} r={3} fill="#ef4444" />
            </g>
          );
        })}
        <g transform="translate(460, 20)">
          <rect width="130" height="70" rx="4" fill="#1e293b" stroke="#475569" strokeWidth="0.5" />
          <circle cx={15} cy={18} r={4} fill="#22c55e" />
          <text x={25} y={22} fill="#94a3b8" fontSize="10">Healthy</text>
          <circle cx={15} cy={38} r={4} fill="#ef4444" />
          <text x={25} y={42} fill="#94a3b8" fontSize="10">Disease</text>
          <line x1={10} y1={58} x2={30} y2={58} stroke="#64748b" strokeWidth="1.5" markerEnd="url(#arrowhead)" />
          <text x={38} y={62} fill="#94a3b8" fontSize="10">Trajectory</text>
        </g>
      </svg>
      {hoveredGene && (
        <div className="absolute pointer-events-none bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm shadow-xl z-10"
          style={{ left: tooltipPos.x, top: tooltipPos.y, transform: "translate(-50%, -100%)" }}
          data-testid="trajectory-tooltip">
          <div className="font-bold text-slate-900">{hoveredGene.gene}</div>
          <div className="text-emerald-400">Healthy |λ|: {Math.abs(hoveredGene.healthyEigenvalue).toFixed(4)}</div>
          <div className="text-red-400">Disease |λ|: {Math.abs(hoveredGene.diseaseEigenvalue).toFixed(4)}</div>
          <div className="text-cyan-400">Shift: {hoveredGene.shift > 0 ? "+" : ""}{hoveredGene.shift.toFixed(4)}</div>
          {hoveredGene.phiCrossing && <div className="text-amber-400">⚠ Crossed φ boundary</div>}
        </div>
      )}
    </div>
  );
}

// ── Healthy vs Disease |λ| scatter plot ──────────────────────────────────────
function EigenvalueScatterPlot({ shifts, highlights }: { shifts: ShiftEntry[]; highlights: ShiftEntry[] }) {
  const [hovered, setHovered] = useState<ShiftEntry | null>(null);
  const [tipPos, setTipPos] = useState({ x: 0, y: 0 });

  const PAD = { t: 30, r: 30, b: 50, l: 58 };
  const W = 520, H = 420;
  const IW = W - PAD.l - PAD.r;
  const IH = H - PAD.t - PAD.b;
  const PHI = 0.618;

  const sx = (v: number) => PAD.l + Math.min(1, Math.max(0, v)) * IW;
  const sy = (v: number) => PAD.t + (1 - Math.min(1, Math.max(0, v))) * IH;

  const hiSet = new Set(highlights.map(h => h.gene.toUpperCase()));
  const bgPts = shifts.filter(s => !hiSet.has(s.gene.toUpperCase())).slice(0, 500);
  const ticks = [0.0, 0.2, 0.4, 0.6, 0.8, 1.0];

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 420 }}>
        <rect width={W} height={H} fill="#f8fafc" />
        {ticks.map(v => (
          <g key={v}>
            <line x1={sx(v)} y1={PAD.t} x2={sx(v)} y2={PAD.t + IH} stroke="#e2e8f0" strokeWidth="1" />
            <line x1={PAD.l} y1={sy(v)} x2={PAD.l + IW} y2={sy(v)} stroke="#e2e8f0" strokeWidth="1" />
          </g>
        ))}
        {/* Identity diagonal */}
        <line x1={sx(0)} y1={sy(0)} x2={sx(1)} y2={sy(1)} stroke="#94a3b8" strokeWidth="1" strokeDasharray="5 3" opacity="0.5" />
        {/* φ = 0.618 reference lines */}
        <line x1={sx(PHI)} y1={PAD.t} x2={sx(PHI)} y2={PAD.t + IH} stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.75" />
        <line x1={PAD.l} y1={sy(PHI)} x2={PAD.l + IW} y2={sy(PHI)} stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.75" />
        <text x={sx(PHI) + 3} y={PAD.t + 11} fill="#f59e0b" fontSize="10">φ</text>
        <text x={PAD.l + 3} y={sy(PHI) - 4} fill="#f59e0b" fontSize="10">φ</text>
        {/* Background gene cloud */}
        {bgPts.map((s, i) => (
          <circle key={i}
            cx={sx(Math.abs(s.healthyEigenvalue))} cy={sy(Math.abs(s.diseaseEigenvalue))}
            r={2.2} fill={CAT_FILL[s.geneCategory] || '#94a3b8'} opacity={0.28} />
        ))}
        {/* Highlighted genes */}
        {highlights.map((h, i) => {
          const cx = sx(Math.abs(h.healthyEigenvalue));
          const cy = sy(Math.abs(h.diseaseEigenvalue));
          const col = CAT_FILL[h.geneType] || CAT_FILL[h.geneCategory] || '#94a3b8';
          return (
            <g key={i} className="cursor-pointer"
              onMouseEnter={(e) => {
                setHovered(h);
                const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                setTipPos({ x: cx / W * r.width, y: cy / H * r.height });
              }}
              onMouseLeave={() => setHovered(null)}>
              <circle cx={cx} cy={cy} r={5.5} fill={col} stroke="#fff" strokeWidth="1.5" />
              <text x={cx + 8} y={cy + 4} fill="#1e293b" fontSize="9.5" fontWeight="600">{h.gene}</text>
            </g>
          );
        })}
        {/* Axes */}
        <line x1={PAD.l} y1={PAD.t + IH} x2={PAD.l + IW} y2={PAD.t + IH} stroke="#64748b" />
        <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t + IH} stroke="#64748b" />
        {ticks.map(v => (
          <g key={v}>
            <text x={sx(v)} y={PAD.t + IH + 16} fill="#64748b" fontSize="10" textAnchor="middle">{v.toFixed(1)}</text>
            <text x={PAD.l - 7} y={sy(v) + 4} fill="#64748b" fontSize="10" textAnchor="end">{v.toFixed(1)}</text>
          </g>
        ))}
        <text x={PAD.l + IW / 2} y={H - 4} fill="#64748b" fontSize="11" textAnchor="middle">Healthy |λ|</text>
        <text x={13} y={PAD.t + IH / 2} fill="#64748b" fontSize="11" textAnchor="middle"
          transform={`rotate(-90, 13, ${PAD.t + IH / 2})`}>Disease |λ|</text>
        <text x={sx(0.06)} y={sy(0.91)} fill="#ef4444" fontSize="9" opacity="0.65">↑ persistence in disease</text>
        <text x={sx(0.72)} y={sy(0.06)} fill="#10b981" fontSize="9" opacity="0.65">↓ persistence in disease</text>
      </svg>
      {hovered && (
        <div className="absolute pointer-events-none bg-white border border-slate-200 rounded-lg p-3 text-sm shadow-xl z-10"
          style={{ left: tipPos.x, top: tipPos.y, transform: 'translate(-50%,-115%)' }}>
          <div className="font-bold text-slate-900">{hovered.gene}</div>
          <div className="text-slate-600">Healthy |λ|: <span className="font-mono text-emerald-600">{Math.abs(hovered.healthyEigenvalue).toFixed(4)}</span></div>
          <div className="text-slate-600">Disease |λ|: <span className="font-mono text-red-500">{Math.abs(hovered.diseaseEigenvalue).toFixed(4)}</span></div>
          <div className="text-slate-600">Shift: <span className={`font-mono font-semibold ${hovered.shift > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
            {hovered.shift > 0 ? '+' : ''}{hovered.shift.toFixed(4)}
          </span></div>
          {hovered.phiCrossing && <div className="text-amber-600 text-xs mt-1 font-semibold">⚠ Crossed φ = 0.618 boundary</div>}
        </div>
      )}
    </div>
  );
}

// ── Cross-pair consensus heatmap ─────────────────────────────────────────────
function CrossPairConsensus({ data }: { data: ConsensusData }) {
  const byGene = useMemo(() => {
    const m: Record<string, Record<number, { shift: number; direction: string }>> = {};
    for (const e of data.entries) {
      if (!m[e.gene]) m[e.gene] = {};
      m[e.gene][e.pairIndex] = { shift: e.shift, direction: e.direction };
    }
    return m;
  }, [data]);

  const geneRows = useMemo(() => {
    return data.genes.map(gene => {
      const entries = data.entries.filter(e => e.gene === gene);
      const upCount = entries.filter(e => e.direction === 'up').length;
      const downCount = entries.filter(e => e.direction === 'down').length;
      const dominant = upCount > downCount ? 'up' : downCount > upCount ? 'down' : 'mixed';
      return { gene, upCount, downCount, total: entries.length, dominant };
    }).sort((a, b) => Math.max(b.upCount, b.downCount) - Math.max(a.upCount, a.downCount));
  }, [data]);

  const PAIR_CAT_COLORS: Record<string, string> = {
    Cancer: '#ef4444', 'Clock Disruption': '#3b82f6',
    Aging: '#f59e0b', 'Circadian Disruption': '#8b5cf6',
  };

  return (
    <div className="overflow-x-auto">
      <p className="text-xs text-muted-foreground mb-3">
        Each cell shows the Δ|λ| for that gene in that comparison pair.
        <span className="text-emerald-600 font-medium"> Green</span> = persistence increased in disease;
        <span className="text-red-500 font-medium"> Red</span> = decreased.
        Colour intensity scales with shift magnitude. "—" = gene not shared in that pair.
      </p>
      <table className="text-xs border-collapse min-w-full">
        <thead>
          <tr>
            <th className="text-left p-2 pb-3 text-slate-500 font-medium sticky left-0 bg-white z-10 min-w-16">Gene</th>
            {data.pairs.map(p => (
              <th key={p.index} className="p-1 pb-3 text-center font-medium" style={{ minWidth: 68 }}>
                <div className="text-[9px] leading-tight" style={{ color: PAIR_CAT_COLORS[p.category] || '#64748b' }}>
                  {p.label.length > 20 ? p.label.slice(0, 18) + '…' : p.label}
                </div>
              </th>
            ))}
            <th className="p-2 pb-3 text-slate-500 font-medium text-center whitespace-nowrap">Consensus</th>
          </tr>
        </thead>
        <tbody>
          {geneRows.map(({ gene, upCount, downCount, total, dominant }) => (
            <tr key={gene} className="border-t border-slate-100">
              <td className="p-2 font-mono font-semibold text-slate-800 sticky left-0 bg-white z-10">{gene}</td>
              {data.pairs.map(p => {
                const cell = byGene[gene]?.[p.index];
                if (!cell) return <td key={p.index} className="p-1 text-center text-slate-300 font-mono">—</td>;
                const intensity = Math.min(1, Math.abs(cell.shift) / 0.15);
                const bg = cell.direction === 'up'
                  ? `rgba(16,185,129,${0.12 + intensity * 0.68})`
                  : cell.direction === 'down'
                    ? `rgba(239,68,68,${0.12 + intensity * 0.68})`
                    : 'rgba(148,163,184,0.2)';
                return (
                  <td key={p.index} className="p-1 text-center font-mono" style={{ background: bg }}>
                    <span className={cell.direction === 'up' ? 'text-emerald-700 font-semibold' : cell.direction === 'down' ? 'text-red-600 font-semibold' : 'text-slate-400'}>
                      {cell.shift > 0 ? '+' : ''}{cell.shift.toFixed(3)}
                    </span>
                  </td>
                );
              })}
              <td className="p-2 text-center whitespace-nowrap">
                {dominant === 'up' ? (
                  <span className="text-emerald-600 font-semibold">{upCount}/{total} ↑</span>
                ) : dominant === 'down' ? (
                  <span className="text-red-500 font-semibold">{downCount}/{total} ↓</span>
                ) : (
                  <span className="text-slate-400">{upCount}↑ {downCount}↓</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm shadow-xl">
      <div className="font-bold text-slate-900">{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color: p.color }}>{p.name}: {typeof p.value === "number" ? p.value.toFixed(4) : p.value}</div>
      ))}
    </div>
  );
};

export default function DiseaseScreen() {
  const [selectedPair, setSelectedPair] = useState(0);
  const [minR2, setMinR2] = useState(0);
  const [onlyStable, setOnlyStable] = useState(false);
  const [geneSearch, setGeneSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("shift");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [robustnessOpen, setRobustnessOpen] = useState(true);

  const { data: pairs, isLoading: pairsLoading } = useQuery<DiseasePair[]>({
    queryKey: ["/api/analysis/disease-screen/pairs"],
  });

  const { data: screenData, isLoading: screenLoading } = useQuery<ScreenResult>({
    queryKey: [`/api/analysis/disease-screen/${selectedPair}?minR2=${minR2}&onlyStable=${onlyStable}&topN=100&gene=${geneSearch}`],
    enabled: !!pairs,
  });

  const { data: robustnessData, isLoading: robustnessLoading } = useQuery<RobustnessData>({
    queryKey: ['/api/analysis/disease-screen', selectedPair, 'robustness'],
    queryFn: async () => {
      const res = await fetch(`/api/analysis/disease-screen/${selectedPair}/robustness?nPermutations=1000&nBootstrap=500`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: !!screenData,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const { data: consensusData, isLoading: consensusLoading } = useQuery<ConsensusData>({
    queryKey: ['/api/analysis/disease-screen/consensus'],
    queryFn: async () => {
      const res = await fetch('/api/analysis/disease-screen/consensus');
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: robustnessOpen && !!screenData,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const sortedBootstrapShifts = useMemo(() => {
    if (!robustnessData?.bootstrapShifts) return [];
    return [...robustnessData.bootstrapShifts].sort((a, b) => Math.abs(b.pointEstimate) - Math.abs(a.pointEstimate));
  }, [robustnessData?.bootstrapShifts]);

  const groupedPairs = useMemo(() => {
    if (!pairs) return {};
    const groups: Record<string, DiseasePair[]> = {};
    pairs.forEach((p) => {
      if (!groups[p.category]) groups[p.category] = [];
      groups[p.category].push(p);
    });
    return groups;
  }, [pairs]);

  const sortedShifts = useMemo(() => {
    if (!screenData?.shifts) return [];
    return [...screenData.shifts].sort((a, b) => {
      let aVal: any = a[sortField as keyof ShiftEntry];
      let bVal: any = b[sortField as keyof ShiftEntry];
      if (sortField === "regimeChange") {
        aVal = a.regimeChange !== 'stable' ? 1 : 0;
        bVal = b.regimeChange !== 'stable' ? 1 : 0;
      }
      if (typeof aVal === "string") return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      if (aVal == null) return sortDir === "asc" ? 1 : -1;
      if (bVal == null) return sortDir === "asc" ? -1 : 1;
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    });
  }, [screenData?.shifts, sortField, sortDir]);

  // Genes that crossed the φ = 0.618 boundary between healthy and disease
  const phiCrossingGenes = useMemo(() => {
    if (!screenData?.shifts) return [];
    return screenData.shifts.filter(s => s.phiCrossing).sort((a, b) => b.absShift - a.absShift);
  }, [screenData?.shifts]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  if (pairsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex items-center justify-center" data-testid="loading-screen">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 p-4 md:p-8" data-testid="disease-screen-page">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="sm" data-testid="link-back-home">
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
                <Dna className="h-6 w-6 text-cyan-400" />
                Genome-Wide Disease Screen
              </h1>
              <p className="text-sm text-muted-foreground">
                Differential persistence analysis across matched disease/healthy pairs — comparing temporal dynamics of every gene
              </p>
              <div className="rounded-lg bg-slate-100 border border-slate-200 p-4 mt-3">
                <p className="text-sm text-slate-600 leading-relaxed">
                  <strong className="text-slate-900">What you can do:</strong> Compare AR(2) eigenvalue distributions between healthy and disease-condition datasets. Statistical tests show whether distributions differ significantly. φ-crossings identify genes that changed dynamical domain. The consensus heatmap shows which findings replicate across all 10 comparison pairs.
                </p>
              </div>
            </div>
          </div>
          <PaperCrossLinks currentPage="/disease-screen" />
          <DownloadResultsButton
            data={screenData?.shifts?.map(s => ({
              gene: s.gene,
              geneType: s.geneType,
              geneCategory: s.geneCategory,
              healthyEigenvalue: s.healthyEigenvalue,
              diseaseEigenvalue: s.diseaseEigenvalue,
              shift: s.shift,
              fractionalShift: s.fractionalShift,
              absShift: s.absShift,
              healthyR2: s.healthyR2,
              diseaseR2: s.diseaseR2,
              regimeChange: s.regimeChange,
              phiCrossing: s.phiCrossing,
              healthyPeriodSamples: s.healthyPeriodSamples,
              diseasePeriodSamples: s.diseasePeriodSamples,
            }))}
            filename="PAR2_DiseaseScreen_Results.csv"
          />
          {screenData && (
            <ExportReport
              title={`Disease Screen: ${screenData.pair.healthyName} vs ${screenData.pair.diseaseName}`}
              subtitle="Genome-wide AR(2) eigenvalue shift analysis"
              sections={[
                { heading: 'Summary', content: { type: 'stats', items: [
                  { label: 'Shared Genes', value: screenData.summary.sharedGenes },
                  { label: 'Persistence ↑', value: screenData.summary.genesUp },
                  { label: 'Persistence ↓', value: screenData.summary.genesDown },
                  { label: 'Mean |Shift|', value: screenData.summary.meanAbsShift.toFixed(4) },
                  { label: 'φ-Crossings', value: phiCrossingGenes.length },
                ]}},
                { heading: 'Key Genes', content: { type: 'table',
                  headers: ['Gene', 'Type', 'Healthy |λ|', 'Disease |λ|', 'Shift', 'Frac.Δ', 'φ Cross'],
                  rows: screenData.highlights.map(h => [
                    h.gene, h.geneType,
                    Math.abs(h.healthyEigenvalue).toFixed(4),
                    Math.abs(h.diseaseEigenvalue).toFixed(4),
                    h.shift.toFixed(4),
                    h.fractionalShift != null ? (h.fractionalShift * 100).toFixed(1) + '%' : '—',
                    h.phiCrossing ? 'Yes' : 'No',
                  ]) }},
              ]}
            />
          )}
        </div>

        <HowTo
          title="Genome-Wide Disease Screen"
          summary="Compares AR(2) eigenvalue signatures between matched healthy and disease conditions across 10 disease pairs. Identifies genes with the largest eigenvalue shifts and tests whether the clock-target hierarchy is preserved or disrupted in disease."
          steps={[
            { label: "Select a disease pair", detail: "Choose from 10 matched healthy/disease comparisons." },
            { label: "Read the scatter plot", detail: "Points above the diagonal gained persistence in disease; below lost it. Amber φ lines mark the clock/target boundary." },
            { label: "Check φ-crossings", detail: "Genes that crossed φ=0.618 changed dynamical domain — from target-like to clock-like or vice versa." },
            { label: "Inspect the consensus heatmap", detail: "See which findings replicate across all 10 independent pairs — those are the strongest results." },
          ]}
        />

        {/* Pair selector */}
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5 text-cyan-400" />
              Disease / Healthy Pairs
            </CardTitle>
            <CardDescription>Select a matched pair to compare eigenvalue persistence shifts across all shared genes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(groupedPairs).map(([category, catPairs]) => (
                <div key={category}>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{category}</div>
                  <div className="flex flex-wrap gap-2">
                    {catPairs.map((p) => (
                      <Button
                        key={p.id}
                        variant={selectedPair === p.id ? "default" : "outline"}
                        size="sm"
                        className={selectedPair === p.id ? "bg-cyan-700 hover:bg-cyan-600" : "border-slate-300 hover:bg-slate-100"}
                        onClick={() => setSelectedPair(p.id)}
                        data-testid={`button-pair-${p.id}`}
                      >
                        {p.label}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card className="border-slate-200">
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">R² threshold:</span>
                <div className="flex gap-1">
                  {R2_OPTIONS.map((val) => (
                    <Button
                      key={val}
                      variant={minR2 === val ? "default" : "outline"}
                      size="sm"
                      className={`h-7 px-2 text-xs ${minR2 === val ? "bg-cyan-700 hover:bg-cyan-600" : "border-slate-300"}`}
                      onClick={() => setMinR2(val)}
                      data-testid={`button-r2-${val}`}
                    >
                      {val}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Stable only:</span>
                <Switch checked={onlyStable} onCheckedChange={setOnlyStable} data-testid="switch-stable-only" />
                <span className="text-xs text-amber-500 ml-1" title="When off, genes with |λ| ≥ 1.0 (explosive AR(2) fits) are included and flagged ⚠">
                  ⚠ values ≥1.0 are explosive fits
                </span>
              </div>
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search gene..."
                  value={geneSearch}
                  onChange={(e) => setGeneSearch(e.target.value)}
                  className="pl-9 bg-slate-100 border-slate-200"
                  data-testid="input-gene-search"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {screenLoading && (
          <div className="flex items-center justify-center py-12" data-testid="loading-data">
            <Loader2 className="w-6 h-6 animate-spin text-cyan-400 mr-2" />
            <span className="text-muted-foreground">Analyzing genome-wide shifts...</span>
          </div>
        )}

        {screenData && !screenLoading && (
          <>
            {/* ── Summary stats ── */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3" data-testid="summary-stats">
              <Card className="border-slate-200">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-slate-900" data-testid="stat-shared-genes">{screenData.summary.sharedGenes.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">Shared Genes</div>
                </CardContent>
              </Card>
              <Card className="border-slate-200">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-emerald-400 flex items-center justify-center gap-1" data-testid="stat-genes-up">
                    <TrendingUp className="h-5 w-5" /> {screenData.summary.genesUp.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground">Persistence ↑</div>
                </CardContent>
              </Card>
              <Card className="border-slate-200">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-red-400 flex items-center justify-center gap-1" data-testid="stat-genes-down">
                    <TrendingDown className="h-5 w-5" /> {screenData.summary.genesDown.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground">Persistence ↓</div>
                </CardContent>
              </Card>
              <Card className="border-slate-200">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-cyan-400" data-testid="stat-mean-shift">{screenData.summary.meanAbsShift.toFixed(4)}</div>
                  <div className="text-xs text-muted-foreground">Mean |Shift|</div>
                </CardContent>
              </Card>
              <Card className="border-slate-200">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-amber-400" data-testid="stat-regime-changes">{phiCrossingGenes.length}</div>
                  <div className="text-xs text-muted-foreground">φ-Crossings</div>
                </CardContent>
              </Card>
            </div>

            {/* ── Scatter plot ── */}
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-cyan-400" />
                  Healthy vs Disease |λ| — Eigenvalue Shift Map
                </CardTitle>
                <CardDescription>
                  Each dot is one gene. Points above the dashed diagonal gained temporal persistence in disease; below lost it.
                  Amber φ=0.618 lines mark the empirical clock/target boundary — genes crossing these lines changed dynamical domain.
                  Hover named genes for details.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <EigenvalueScatterPlot shifts={screenData.shifts} highlights={screenData.highlights} />
                <div className="flex flex-wrap gap-4 text-xs justify-center pt-1">
                  {Object.entries(CAT_FILL).map(([cat, col]) => (
                    <span key={cat} className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full inline-block" style={{ background: col }} />
                      {cat}
                    </span>
                  ))}
                </div>
                <InsightCallout title="How to read this">
                  Named dots are key clock, cancer, and growth markers. The unlabelled cloud is the full genome.
                  A cluster above the diagonal and above the horizontal φ line means disease drove those genes into the "clock domain" —
                  high temporal autonomy consistent with decoupling from entrainment signals.
                </InsightCallout>
              </CardContent>
            </Card>

            {/* ── Key Genes table ── */}
            {screenData.highlights.length > 0 && (
              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-400" />
                    Key Genes — Clock, Cancer & Growth Markers
                  </CardTitle>
                  <CardDescription>
                    Known clock, cancer, and growth genes between {screenData.pair.healthyName} and {screenData.pair.diseaseName}.
                    <strong className="text-slate-700"> Frac.Δ</strong> = shift / baseline |λ| (contextualises magnitude).
                    <strong className="text-slate-700"> Period</strong> = implied oscillation period in timepoints for complex-root genes
                    (divide by sampling interval — typically 2 h for circadian data — to get hours).
                    Amber rows = φ-crossings.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" data-testid="table-highlights">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left p-3 text-slate-500">Gene</th>
                          <th className="text-left p-3 text-slate-500">Type</th>
                          <th className="text-center p-3 text-slate-500">Healthy |λ|</th>
                          <th className="text-center p-3 text-slate-500">Disease |λ|</th>
                          <th className="text-center p-3 text-slate-500">Shift</th>
                          <th className="text-center p-3 text-slate-500">Frac.Δ</th>
                          <th className="text-center p-3 text-slate-500">Period (H→D)</th>
                          <th className="text-center p-3 text-slate-500">R² Δ</th>
                          <th className="text-center p-3 text-slate-500">φ Cross</th>
                        </tr>
                      </thead>
                      <tbody>
                        {screenData.highlights.map((h, idx) => (
                          <tr key={idx} className={`border-b border-slate-200 hover:bg-slate-50 ${h.phiCrossing ? 'bg-amber-50' : ''}`} data-testid={`row-highlight-${idx}`}>
                            <td className="p-3 font-mono font-medium"><GeneTooltip gene={h.gene}>{h.gene}</GeneTooltip></td>
                            <td className="p-3">{geneTypeBadge(h.geneType)}</td>
                            <td className="p-3 text-center font-mono">
                              <span className={!h.healthyStable ? "text-amber-500 font-semibold" : ""} title={!h.healthyStable ? "explosive fit" : undefined}>
                                {Math.abs(h.healthyEigenvalue).toFixed(4)}{!h.healthyStable && " ⚠"}
                              </span>
                            </td>
                            <td className="p-3 text-center font-mono">
                              <span className={!h.diseaseStable ? "text-amber-500 font-semibold" : ""} title={!h.diseaseStable ? "explosive fit" : undefined}>
                                {Math.abs(h.diseaseEigenvalue).toFixed(4)}{!h.diseaseStable && " ⚠"}
                              </span>
                            </td>
                            <td className="p-3 text-center font-mono">
                              <span className={h.shift > 0 ? "text-emerald-400" : "text-red-400"}>
                                {h.shift > 0 ? "+" : ""}{h.shift.toFixed(4)}
                              </span>
                            </td>
                            <td className="p-3 text-center font-mono text-xs">
                              {h.fractionalShift != null ? (
                                <span className={h.fractionalShift > 0 ? "text-emerald-500" : "text-red-400"}>
                                  {h.fractionalShift > 0 ? "+" : ""}{(h.fractionalShift * 100).toFixed(1)}%
                                </span>
                              ) : <span className="text-slate-400">—</span>}
                            </td>
                            <td className="p-3 text-center font-mono text-xs text-muted-foreground">
                              {h.healthyPeriodSamples != null || h.diseasePeriodSamples != null
                                ? `${h.healthyPeriodSamples != null ? h.healthyPeriodSamples + 'tp' : '—'}→${h.diseasePeriodSamples != null ? h.diseasePeriodSamples + 'tp' : '—'}`
                                : <span className="text-slate-300 text-xs">real roots</span>}
                            </td>
                            <td className="p-3 text-center font-mono text-muted-foreground">
                              {(h.diseaseR2 - h.healthyR2).toFixed(3)}
                            </td>
                            <td className="p-3 text-center">
                              {h.phiCrossing ? (
                                <Badge className="bg-amber-900/50 text-amber-300 border-amber-700">φ crossed</Badge>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── Root-space trajectory ── */}
            {screenData.highlights.length > 0 && (
              <Card className="border-slate-200" data-testid="card-trajectory">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <GitBranch className="h-5 w-5 text-cyan-400" />
                    Root-Space Disease Trajectory
                  </CardTitle>
                  <CardDescription>
                    AR(2) stationarity triangle showing healthy → disease trajectories for key genes
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <TrajectoryMap highlights={screenData.highlights} />
                  <InsightCallout title="What This Means">
                    Arrows show how each gene's dynamical position shifts between healthy and disease states. Long arrows indicate large changes in temporal dynamics. Genes crossing the parabola boundary (dashed yellow curve) undergo a regime change — switching between oscillatory and non-oscillatory behavior.
                  </InsightCallout>
                  <div className="pt-2">
                    <Link href="/root-space">
                      <Button variant="ghost" size="sm" className="text-cyan-400 hover:text-cyan-300" data-testid="link-trajectory-rootspace">
                        <ArrowRight className="h-4 w-4 mr-1" /> Explore full Root-Space
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── φ-Boundary Crossings ── */}
            {phiCrossingGenes.length > 0 && (
              <Card className="border-amber-200 bg-amber-50/30">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    φ-Boundary Crossings — Genes That Changed Dynamical Domain
                  </CardTitle>
                  <CardDescription>
                    These {phiCrossingGenes.length} genes crossed |λ| = 0.618 (φ) between conditions, moving from the target-gene domain (&lt; φ) to the
                    clock-gene domain (&gt; φ) or vice versa. A crossing is not just a magnitude change — it is a domain switch.
                    Genes moving <em>up</em> into the clock domain are becoming more temporally autonomous in disease;
                    genes moving <em>down</em> are losing circadian self-sustaining character.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-amber-200">
                          <th className="text-left p-3 text-amber-700">Gene</th>
                          <th className="text-left p-3 text-amber-700">Type</th>
                          <th className="text-center p-3 text-amber-700">Healthy |λ|</th>
                          <th className="text-center p-3 text-amber-700">Disease |λ|</th>
                          <th className="text-center p-3 text-amber-700">Shift</th>
                          <th className="text-center p-3 text-amber-700">Domain change</th>
                        </tr>
                      </thead>
                      <tbody>
                        {phiCrossingGenes.slice(0, 20).map((g, idx) => {
                          const crossDir = g.healthyEigenvalue < 0.618
                            ? 'target → clock domain ↑'
                            : 'clock → target domain ↓';
                          const isUp = g.healthyEigenvalue < 0.618;
                          return (
                            <tr key={idx} className="border-b border-amber-100 hover:bg-amber-50">
                              <td className="p-3 font-mono font-semibold"><GeneTooltip gene={g.gene}>{g.gene}</GeneTooltip></td>
                              <td className="p-3">{geneTypeBadge(g.geneType)}</td>
                              <td className="p-3 text-center font-mono">{Math.abs(g.healthyEigenvalue).toFixed(4)}</td>
                              <td className="p-3 text-center font-mono">{Math.abs(g.diseaseEigenvalue).toFixed(4)}</td>
                              <td className="p-3 text-center font-mono">
                                <span className={g.shift > 0 ? "text-emerald-500 font-semibold" : "text-red-500 font-semibold"}>
                                  {g.shift > 0 ? "+" : ""}{g.shift.toFixed(4)}
                                </span>
                              </td>
                              <td className="p-3 text-center">
                                <span className={`text-xs font-medium ${isUp ? 'text-red-600' : 'text-emerald-600'}`}>{crossDir}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {phiCrossingGenes.length > 20 && (
                      <p className="text-xs text-muted-foreground mt-2 pl-3">Showing top 20 of {phiCrossingGenes.length} φ-crossing genes</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── Shift Distribution ── */}
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-cyan-400" />
                  Shift Distribution
                </CardTitle>
                <CardDescription>Distribution of eigenvalue persistence shifts across all shared genes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                    <BarChart data={screenData.shiftDistribution} margin={{ top: 5, right: 20, bottom: 25, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="center" stroke="#64748b" tick={{ fontSize: 11 }}
                        label={{ value: "Shift (Disease − Healthy)", position: "insideBottom", offset: -15, fill: "#64748b", fontSize: 12 }} />
                      <YAxis stroke="#64748b" label={{ value: "Gene Count", angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 12 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <ReferenceLine x={0} stroke="#ef4444" strokeDasharray="3 3" />
                      <Bar dataKey="count" name="Genes" radius={[2, 2, 0, 0]}>
                        {screenData.shiftDistribution.map((entry, idx) => (
                          <Cell key={idx} fill={entry.center < 0 ? "#f87171" : "#34d399"} opacity={0.8} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex gap-4 justify-center text-xs mt-2">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-400 inline-block" /> Decreased persistence</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-400 inline-block" /> Increased persistence</span>
                </div>
              </CardContent>
            </Card>

            {/* ── Category Impact ── */}
            {screenData.categoryStats.length > 0 && (
              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Activity className="h-5 w-5 text-purple-400" />
                    Category Impact
                  </CardTitle>
                  <CardDescription>Mean eigenvalue shift by gene category</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                      <BarChart data={screenData.categoryStats} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 100 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis type="number" stroke="#64748b" />
                        <YAxis type="category" dataKey="category" stroke="#64748b" tick={{ fontSize: 11 }} width={90} />
                        <Tooltip content={<CustomTooltip />} />
                        <ReferenceLine x={0} stroke="#64748b" strokeDasharray="3 3" />
                        <Bar dataKey="meanShift" name="Mean Shift" radius={[0, 4, 4, 0]}>
                          {screenData.categoryStats.map((entry, idx) => (
                            <Cell key={idx} fill={entry.meanShift >= 0 ? "#34d399" : "#f87171"} opacity={0.8} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── Full Genome Rankings ── */}
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Dna className="h-5 w-5 text-cyan-400" />
                  Full Genome-Wide Rankings
                </CardTitle>
                <CardDescription>
                  Showing {screenData.shifts.length} of {screenData.totalShifts.toLocaleString()} genes — click headers to sort.
                  <strong className="text-slate-700"> Frac.Δ</strong> = shift/baseline |λ|.
                  <strong className="text-slate-700"> Period</strong> = implied oscillation period in timepoints (complex-root genes only).
                  Amber rows = φ-crossings.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="table-rankings">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left p-3 text-slate-500 cursor-pointer hover:text-slate-700" onClick={() => toggleSort("gene")} data-testid="sort-gene">
                          Gene {sortField === "gene" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                        </th>
                        <th className="text-left p-3 text-slate-500 cursor-pointer hover:text-slate-700" onClick={() => toggleSort("geneCategory")} data-testid="sort-category">
                          Category {sortField === "geneCategory" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                        </th>
                        <th className="text-center p-3 text-slate-500 cursor-pointer hover:text-slate-700" onClick={() => toggleSort("healthyEigenvalue")} data-testid="sort-healthy-ev">
                          Healthy |λ| {sortField === "healthyEigenvalue" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                        </th>
                        <th className="text-center p-3 text-slate-500 cursor-pointer hover:text-slate-700" onClick={() => toggleSort("diseaseEigenvalue")} data-testid="sort-disease-ev">
                          Disease |λ| {sortField === "diseaseEigenvalue" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                        </th>
                        <th className="text-center p-3 text-slate-500 cursor-pointer hover:text-slate-700" onClick={() => toggleSort("shift")} data-testid="sort-shift">
                          Shift {sortField === "shift" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                        </th>
                        <th className="text-center p-3 text-slate-500 cursor-pointer hover:text-slate-700" onClick={() => toggleSort("fractionalShift")} data-testid="sort-frac-shift">
                          Frac.Δ {sortField === "fractionalShift" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                        </th>
                        <th className="text-center p-3 text-slate-500 cursor-pointer hover:text-slate-700" onClick={() => toggleSort("healthyPeriodSamples")} data-testid="sort-period">
                          Period {sortField === "healthyPeriodSamples" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                        </th>
                        <th className="text-center p-3 text-slate-500 cursor-pointer hover:text-slate-700" onClick={() => toggleSort("healthyR2")} data-testid="sort-r2-healthy">
                          R²(H) {sortField === "healthyR2" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                        </th>
                        <th className="text-center p-3 text-slate-500 cursor-pointer hover:text-slate-700" onClick={() => toggleSort("diseaseR2")} data-testid="sort-r2-disease">
                          R²(D) {sortField === "diseaseR2" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                        </th>
                        <th className="text-center p-3 text-slate-500 cursor-pointer hover:text-slate-700" onClick={() => toggleSort("regimeChange")} data-testid="sort-regime">
                          φ Cross {sortField === "regimeChange" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedShifts.map((s, idx) => (
                        <tr key={idx} className={`border-b border-slate-200 hover:bg-slate-50 ${s.phiCrossing ? 'bg-amber-50/50' : ''}`} data-testid={`row-ranking-${idx}`}>
                          <td className="p-3 font-mono font-medium"><GeneTooltip gene={s.gene}>{s.gene}</GeneTooltip></td>
                          <td className="p-3">{categoryBadge(s.geneCategory)}</td>
                          <td className="p-3 text-center font-mono">
                            <span className={!s.healthyStable ? "text-amber-500 font-semibold" : ""}>
                              {Math.abs(s.healthyEigenvalue).toFixed(4)}{!s.healthyStable && " ⚠"}
                            </span>
                          </td>
                          <td className="p-3 text-center font-mono">
                            <span className={!s.diseaseStable ? "text-amber-500 font-semibold" : ""}>
                              {Math.abs(s.diseaseEigenvalue).toFixed(4)}{!s.diseaseStable && " ⚠"}
                            </span>
                          </td>
                          <td className="p-3 text-center font-mono">
                            <span className={s.shift > 0 ? "text-emerald-400" : "text-red-400"}>
                              {s.shift > 0 ? "+" : ""}{s.shift.toFixed(4)}
                            </span>
                          </td>
                          <td className="p-3 text-center font-mono text-xs">
                            {s.fractionalShift != null ? (
                              <span className={s.fractionalShift > 0 ? "text-emerald-500" : "text-red-400"}>
                                {s.fractionalShift > 0 ? "+" : ""}{(s.fractionalShift * 100).toFixed(1)}%
                              </span>
                            ) : <span className="text-slate-400">—</span>}
                          </td>
                          <td className="p-3 text-center font-mono text-xs text-muted-foreground">
                            {s.healthyPeriodSamples != null ? `${s.healthyPeriodSamples}tp` : '—'}
                          </td>
                          <td className="p-3 text-center font-mono text-muted-foreground">{s.healthyR2.toFixed(3)}</td>
                          <td className="p-3 text-center font-mono text-muted-foreground">{s.diseaseR2.toFixed(3)}</td>
                          <td className="p-3 text-center">
                            {s.phiCrossing ? (
                              <Badge className="bg-amber-900/50 text-amber-300 border-amber-700">φ✕</Badge>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* ── Statistical Robustness Suite ── */}
            <div data-testid="robustness-section">
              <div
                className="flex items-center justify-between cursor-pointer p-4 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100"
                onClick={() => setRobustnessOpen(!robustnessOpen)}
                data-testid="button-toggle-robustness"
              >
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-cyan-400" />
                  <h2 className="text-lg font-bold">Statistical Robustness Suite</h2>
                </div>
                {robustnessOpen ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
              </div>

              {robustnessOpen && (
                <div className="space-y-4 mt-4">
                  {robustnessLoading && (
                    <div className="flex items-center justify-center py-12" data-testid="loading-robustness">
                      <Loader2 className="w-6 h-6 animate-spin text-cyan-400 mr-2" />
                      <span className="text-muted-foreground">Running 1,000 permutation tests and 500 bootstrap iterations...</span>
                    </div>
                  )}

                  {robustnessData && !robustnessLoading && (
                    <>
                      {/* Permutation tests — z-score bar chart */}
                      <Card className="border-slate-200" data-testid="card-permutation-tests">
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <BarChart3 className="h-5 w-5 text-purple-400" />
                            Category Permutation Tests — z-Scores
                          </CardTitle>
                          <CardDescription>
                            z-score of observed mean shift vs 1,000-permutation null per gene category ({robustnessData.sharedGeneCount} shared genes).
                            Bar direction = direction of shift. * p&lt;0.05, ** p&lt;0.01, *** p&lt;0.001. Faded bars: not significant.
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                              <BarChart
                                data={robustnessData.categoryPermutations.map(cp => ({
                                  ...cp,
                                  label: `${cp.category} (n=${cp.nGenes})`,
                                  signedZ: cp.observedMeanShift >= 0 ? Math.abs(cp.zScore) : -Math.abs(cp.zScore),
                                }))}
                                layout="vertical"
                                margin={{ top: 5, right: 130, bottom: 20, left: 130 }}
                              >
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis type="number" stroke="#64748b"
                                  label={{ value: 'z-score', position: 'insideBottom', offset: -8, fill: '#64748b', fontSize: 11 }} />
                                <YAxis type="category" dataKey="label" stroke="#64748b" tick={{ fontSize: 11 }} width={120} />
                                <Tooltip content={<CustomTooltip />} />
                                <ReferenceLine x={0} stroke="#64748b" strokeDasharray="3 3" />
                                <ReferenceLine x={1.96} stroke="#f59e0b" strokeDasharray="2 2" opacity={0.5}
                                  label={{ value: 'p=0.05', fill: '#f59e0b', fontSize: 9, position: 'top' }} />
                                <ReferenceLine x={-1.96} stroke="#f59e0b" strokeDasharray="2 2" opacity={0.5} />
                                <Bar dataKey="signedZ" name="z-score" radius={[0, 4, 4, 0]}
                                  label={{ position: "right", fill: "#64748b", fontSize: 10,
                                    formatter: (_: any, __: any, index: number) => {
                                      const cp = robustnessData.categoryPermutations[index];
                                      return cp?.pValue < 0.001 ? "***" : cp?.pValue < 0.01 ? "**" : cp?.pValue < 0.05 ? "*" : "";
                                    }
                                  }}>
                                  {robustnessData.categoryPermutations.map((cp, idx) => (
                                    <Cell key={idx} fill={cp.observedMeanShift >= 0 ? "#34d399" : "#f87171"} opacity={cp.pValue < 0.05 ? 0.9 : 0.35} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            z = (observed mean shift − null mean) / null SD across 1,000 label-shuffle permutations. Faded: p ≥ 0.05. Solid: p &lt; 0.05.
                          </p>
                          <div className="mt-3 flex items-center gap-2 text-sm" data-testid="text-global-test">
                            {robustnessData.globalTest.significant ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-400" />
                            )}
                            <span className="text-muted-foreground">
                              Kruskal-Wallis omnibus: H={robustnessData.globalTest.testStatistic.toFixed(2)}, p={robustnessData.globalTest.pValue < 0.001 ? robustnessData.globalTest.pValue.toExponential(2) : robustnessData.globalTest.pValue.toFixed(4)}
                            </span>
                            <Badge className={robustnessData.globalTest.significant ? "bg-emerald-900/50 text-emerald-300 border-emerald-700" : "bg-red-900/50 text-red-300 border-red-700"}>
                              {robustnessData.globalTest.significant ? "Significant — shifts differ by category" : "Not Significant"}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Bootstrap CIs — with explicit uncertainty labelling */}
                      <Card className="border-slate-200" data-testid="card-bootstrap-ci">
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Activity className="h-5 w-5 text-cyan-400" />
                            Bootstrap Confidence Intervals
                          </CardTitle>
                          <CardDescription>
                            500 block-bootstrap iterations per highlighted gene (block size = 3, preserving autocorrelation).
                            CIs that <span className="text-amber-600 font-medium">include zero are inconclusive</span> — the point estimate exists
                            but the time series is too short or noisy to confirm the shift direction.
                            <span className="block mt-1 text-slate-500" style={{fontSize:'0.7rem'}}>Robustness always uses the full unfiltered gene set for this pair — not affected by the R² or stability filter above.</span>
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm" data-testid="table-bootstrap">
                              <thead>
                                <tr className="border-b border-slate-200">
                                  <th className="text-left p-3 text-slate-500">Gene</th>
                                  <th className="text-left p-3 text-slate-500">Category</th>
                                  <th className="text-center p-3 text-slate-500">Point Est.</th>
                                  <th className="text-center p-3 text-slate-500">95% CI</th>
                                  <th className="text-center p-3 text-slate-500">CI Width</th>
                                  <th className="text-center p-3 text-slate-500">Verdict</th>
                                </tr>
                              </thead>
                              <tbody>
                                {sortedBootstrapShifts.map((bs, idx) => (
                                  <tr key={idx} className={`border-b border-slate-200 hover:bg-slate-50 ${!bs.excludesZero ? 'bg-amber-50/30' : ''}`} data-testid={`row-bootstrap-${idx}`}>
                                    <td className="p-3 font-mono font-medium"><GeneTooltip gene={bs.gene}>{bs.gene}</GeneTooltip></td>
                                    <td className="p-3">{categoryBadge(bs.category)}</td>
                                    <td className="p-3 text-center font-mono">
                                      <span className={bs.pointEstimate > 0 ? "text-emerald-400" : "text-red-400"}>
                                        {bs.pointEstimate > 0 ? "+" : ""}{bs.pointEstimate.toFixed(4)}
                                      </span>
                                    </td>
                                    <td className="p-3 text-center font-mono text-muted-foreground">
                                      [{bs.ci95Lower.toFixed(4)}, {bs.ci95Upper.toFixed(4)}]
                                    </td>
                                    <td className="p-3 text-center font-mono text-muted-foreground">{bs.ciWidth.toFixed(4)}</td>
                                    <td className="p-3 text-center">
                                      {bs.excludesZero ? (
                                        <div className="flex items-center justify-center gap-1">
                                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                          <span className="text-xs text-emerald-600 font-medium">robust</span>
                                        </div>
                                      ) : (
                                        <div className="flex items-center justify-center gap-1">
                                          <XCircle className="w-4 h-4 text-amber-400" />
                                          <span className="text-xs text-amber-600 font-medium">includes zero — inconclusive</span>
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <p className="text-xs text-muted-foreground mt-3">
                            <span className="text-amber-600 font-medium">Inconclusive rows (amber background)</span> should not be cited as directional evidence.
                            Wide CIs typically indicate a short time series (&lt;24 timepoints) relative to the block size.
                          </p>
                        </CardContent>
                      </Card>

                      {/* FDR */}
                      <Card className="border-slate-200" data-testid="card-fdr">
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Filter className="h-5 w-5 text-amber-400" />
                            FDR-Corrected Significance
                          </CardTitle>
                          <CardDescription>Benjamini-Hochberg correction across {robustnessData.fdr.totalGenesTested} tested genes</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-3 gap-3 mb-4" data-testid="fdr-summary-stats">
                            <div className="border border-slate-200 rounded-lg p-3 text-center">
                              <div className="text-2xl font-bold text-emerald-400" data-testid="stat-fdr-005">{robustnessData.fdr.significantAt005}</div>
                              <div className="text-xs text-muted-foreground">Sig at FDR 0.05</div>
                            </div>
                            <div className="border border-slate-200 rounded-lg p-3 text-center">
                              <div className="text-2xl font-bold text-amber-400" data-testid="stat-fdr-010">{robustnessData.fdr.significantAt010}</div>
                              <div className="text-xs text-muted-foreground">Sig at FDR 0.10</div>
                            </div>
                            <div className="border border-slate-200 rounded-lg p-3 text-center">
                              <div className="text-2xl font-bold text-cyan-400" data-testid="stat-fdr-020">{robustnessData.fdr.significantAt020}</div>
                              <div className="text-xs text-muted-foreground">Sig at FDR 0.20</div>
                            </div>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm" data-testid="table-fdr">
                              <thead>
                                <tr className="border-b border-slate-200">
                                  <th className="text-left p-3 text-slate-500">Gene</th>
                                  <th className="text-center p-3 text-slate-500">Raw p-value</th>
                                  <th className="text-center p-3 text-slate-500">q-value (FDR)</th>
                                  <th className="text-center p-3 text-slate-500">Significance</th>
                                </tr>
                              </thead>
                              <tbody>
                                {robustnessData.fdr.highlightQValues.map((fq, idx) => (
                                  <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50" data-testid={`row-fdr-${idx}`}>
                                    <td className="p-3 font-mono font-medium"><GeneTooltip gene={fq.gene}>{fq.gene}</GeneTooltip></td>
                                    <td className="p-3 text-center font-mono text-muted-foreground">
                                      {fq.pValue < 0.001 ? fq.pValue.toExponential(2) : fq.pValue.toFixed(4)}
                                    </td>
                                    <td className="p-3 text-center font-mono">
                                      <span className={fq.qValue < 0.05 ? "text-emerald-400" : fq.qValue < 0.20 ? "text-amber-400" : "text-slate-500"}>
                                        {fq.qValue < 0.001 ? fq.qValue.toExponential(2) : fq.qValue.toFixed(4)}
                                      </span>
                                    </td>
                                    <td className="p-3 text-center">
                                      {fq.significant005 ? (
                                        <Badge className="bg-emerald-900/50 text-emerald-300 border-emerald-700">FDR &lt; 0.05</Badge>
                                      ) : fq.qValue < 0.20 ? (
                                        <Badge className="bg-amber-900/50 text-amber-300 border-amber-700">FDR &lt; 0.20</Badge>
                                      ) : (
                                        <Badge variant="outline" className="text-slate-500 border-slate-300">NS</Badge>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Diagnostics */}
                      <Card className="border-slate-200" data-testid="card-diagnostics">
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-amber-400" />
                            Diagnostic Quality Assurance
                          </CardTitle>
                          <CardDescription>Confidence level distributions and quality degradation under disease</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div className="border border-slate-200 rounded-lg p-4" data-testid="block-healthy-confidence">
                              <h4 className="text-sm font-semibold text-emerald-400 mb-3">Healthy Condition</h4>
                              <div className="space-y-2">
                                {Object.entries(robustnessData.diagnosticsSummary.healthyCounts).map(([level, count]) => (
                                  <div key={level} className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">{level}</span>
                                    <div className="flex items-center gap-2">
                                      <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full rounded-full bg-emerald-500"
                                          style={{ width: `${Math.min(100, (count / Math.max(1, robustnessData.sharedGeneCount)) * 100)}%` }} />
                                      </div>
                                      <span className="text-sm font-mono w-8 text-right">{count}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="border border-slate-200 rounded-lg p-4" data-testid="block-disease-confidence">
                              <h4 className="text-sm font-semibold text-red-400 mb-3">Disease Condition</h4>
                              <div className="space-y-2">
                                {Object.entries(robustnessData.diagnosticsSummary.diseaseCounts).map(([level, count]) => (
                                  <div key={level} className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">{level}</span>
                                    <div className="flex items-center gap-2">
                                      <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full rounded-full bg-red-500"
                                          style={{ width: `${Math.min(100, (count / Math.max(1, robustnessData.sharedGeneCount)) * 100)}%` }} />
                                      </div>
                                      <span className="text-sm font-mono w-8 text-right">{count}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="text-sm text-muted-foreground mb-3" data-testid="text-confidence-drops">
                            Confidence drops: <span className="text-amber-400 font-medium">{robustnessData.diagnosticsSummary.confidenceDropped.length}</span> genes dropped from High to Low/Unreliable in disease
                          </div>
                          {robustnessData.diagnosticsSummary.highlightDiagnostics.length > 0 && (
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm" data-testid="table-diagnostics">
                                <thead>
                                  <tr className="border-b border-slate-200">
                                    <th className="text-left p-3 text-slate-500">Gene</th>
                                    <th className="text-center p-3 text-slate-500">Healthy Confidence</th>
                                    <th className="text-center p-3 text-slate-500">Disease Confidence</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {robustnessData.diagnosticsSummary.highlightDiagnostics.map((d, idx) => (
                                    <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50" data-testid={`row-diagnostic-${idx}`}>
                                      <td className="p-3 font-mono font-medium"><GeneTooltip gene={d.gene}>{d.gene}</GeneTooltip></td>
                                      <td className="p-3 text-center">
                                        <Badge className="bg-emerald-900/50 text-emerald-300 border-emerald-700">{d.healthyConfidence}</Badge>
                                      </td>
                                      <td className="p-3 text-center">
                                        <Badge className={
                                          d.diseaseConfidence === "High" ? "bg-emerald-900/50 text-emerald-300 border-emerald-700" :
                                          d.diseaseConfidence === "Moderate" ? "bg-amber-900/50 text-amber-300 border-amber-700" :
                                          "bg-red-900/50 text-red-300 border-red-700"
                                        }>{d.diseaseConfidence}</Badge>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground mt-3">
                            Genes dropping from High to Low/Unreliable confidence in disease may have genuinely disrupted temporal dynamics, or may simply have fewer usable timepoints in the disease dataset.
                          </p>
                        </CardContent>
                      </Card>

                      <div className="border border-slate-200 rounded-lg p-4 bg-slate-50" data-testid="text-robustness-conclusion">
                        <p className="text-sm text-muted-foreground italic">{robustnessData.conclusion}</p>
                      </div>
                    </>
                  )}

                  {/* Cross-pair consensus heatmap */}
                  <Card className="border-slate-200">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-emerald-500" />
                        Cross-Pair Consensus — Key Genes Across All 10 Comparisons
                      </CardTitle>
                      <CardDescription>
                        Δ|λ| shift for each highlighted gene across every available comparison pair.
                        Findings consistent across multiple independent datasets are stronger evidence than single-pair results.
                        Sorted by consistency (most replicated first).
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {consensusLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-5 h-5 animate-spin text-cyan-400 mr-2" />
                          <span className="text-muted-foreground text-sm">Loading all 10 pairs — first load may take ~30 s…</span>
                        </div>
                      ) : consensusData ? (
                        <CrossPairConsensus data={consensusData} />
                      ) : (
                        <p className="text-sm text-muted-foreground">Waiting for screen data to load…</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>

            {/* ── Methodology ── */}
            <Card className="border-slate-200 bg-white">
              <CardContent className="p-6">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Methodology</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  The genome-wide disease screen compares AR(2) eigenvalue persistence between matched healthy and disease conditions.
                  For each shared gene a second-order autoregressive model is fitted independently to both conditions, extracting the
                  dominant eigenvalue |λ| as a measure of temporal persistence. The shift (disease − healthy) quantifies dynamical change.
                  The <strong>fractional shift</strong> (Δ|λ| / healthy |λ|) contextualises that shift relative to baseline.
                  When the AR(2) characteristic roots are complex, the argument encodes an implied <strong>oscillation period</strong>
                  (shown in timepoints; divide by sampling interval — typically 2 h for circadian data — to obtain hours).
                  A <strong>φ-crossing</strong> occurs when a gene transitions across |λ| = 0.618, moving between the empirically observed
                  clock-gene and target-gene domains. Permutation tests shuffle gene-category labels (not the shifts) to test whether
                  each functional class is specifically affected; <strong>z-scores</strong> are reported against those null distributions.
                  The <strong>cross-pair consensus heatmap</strong> aggregates results across all 10 comparisons to identify findings that
                  replicate independently. Bootstrap confidence intervals use block resampling (block size = 3) to preserve temporal autocorrelation;
                  CIs including zero are explicitly marked inconclusive.
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
