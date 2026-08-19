import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  ScatterChart, Scatter, Legend,
} from "recharts";
import {
  ArrowLeft, Loader2, CheckCircle2, XCircle, AlertTriangle, Clock, Beaker, Activity,
  Sun, Moon, BookOpen, FlaskConical, ArrowRightLeft, TrendingUp, Download, CircleDot,
} from "lucide-react";
import DownloadResultsButton, { downloadAsCSV } from "@/components/DownloadResultsButton";
import PaperCrossLinks from "@/components/PaperCrossLinks";
import GeneTooltip from "@/components/GeneTooltip";

interface TimeVaryingGene {
  gene: string;
  category: string;
  fullEigenvalue: number;
  dayEigenvalue: number;
  nightEigenvalue: number;
  dayNightShift: number;
  permutationP: number;
  effectSize: number;
  significantShift: boolean;
}

interface PhaseBin {
  binLabel: string;
  binRange: string;
  meanEigenvalue: number;
  nGenes: number;
  genes: string[];
}

interface KOGene {
  gene: string;
  category: string;
  wtEigenvalue: number;
  koEigenvalue: number;
  eigenvalueShift: number;
  wtRhythmicity: number;
  koRhythmicity: number;
  rhythmicityShift: number;
}

interface LitRef {
  finding: string;
  verified: boolean;
  citation: string;
  method: string;
  agreement: string;
}

interface PhaseClockNode {
  gene: string;
  peakPhase: number;
  eigenvalue: number;
  category: string;
}

interface ExtendedResponse {
  dataset: string;
  timeVaryingEigenvalues: {
    genes: TimeVaryingGene[];
    summary: {
      totalGenes: number;
      significantShifts: number;
      meanClockShift: number;
      meanTargetShift: number;
      interpretation: string;
    };
  };
  phaseEigenvalueCorrelation: {
    spearmanR: number;
    pValue: number;
    nGenes: number;
    phaseBins: PhaseBin[];
    highestPersistenceBin: string;
    interpretation: string;
  };
  phaseClockNodes: PhaseClockNode[];
  koComparison: {
    available: boolean;
    wtDataset: string;
    koDataset: string;
    perGene: KOGene[];
    summary: {
      meanClockEigenvalueWT: number;
      meanClockEigenvalueKO: number;
      meanTargetEigenvalueWT: number;
      meanTargetEigenvalueKO: number;
      clockShiftP: number;
      targetShiftP: number;
      wtCoupledGenes: number;
      koCoupledGenes: number;
      totalTestedGenes: number;
      interpretation: string;
    };
  };
  literatureCrossReferences: LitRef[];
}

const DATASETS = [
  { id: "GSE11923_Liver_1h_48h_genes.csv", label: "Mouse Liver (Hughes 2009, 1h resolution)" },
  { id: "GSE54650_Liver_circadian.csv", label: "Mouse Liver (Zhang 2014)" },
  { id: "GSE54650_Kidney_circadian.csv", label: "Mouse Kidney (Zhang 2014)" },
  { id: "GSE54650_Lung_circadian.csv", label: "Mouse Lung (Zhang 2014)" },
  { id: "GSE54650_Heart_circadian.csv", label: "Mouse Heart (Zhang 2014)" },
  { id: "GSE54650_Adrenal_circadian.csv", label: "Mouse Adrenal (Zhang 2014)" },
  { id: "GSE54650_Aorta_circadian.csv", label: "Mouse Aorta (Zhang 2014)" },
  { id: "GSE54650_Brainstem_circadian.csv", label: "Mouse Brainstem (Zhang 2014)" },
  { id: "GSE54650_Cerebellum_circadian.csv", label: "Mouse Cerebellum (Zhang 2014)" },
  { id: "GSE54650_Hypothalamus_circadian.csv", label: "Mouse Hypothalamus (Zhang 2014)" },
  { id: "GSE54650_Muscle_circadian.csv", label: "Mouse Muscle (Zhang 2014)" },
  { id: "GSE54650_Brown_Fat_circadian.csv", label: "Mouse Brown Fat (Zhang 2014)" },
  { id: "GSE54650_White_Fat_circadian.csv", label: "Mouse White Fat (Zhang 2014)" },
  { id: "GSE98965_baboon_FPKM.csv", label: "Baboon Multi-Tissue (Mure 2018)" },
  { id: "GSE70499_Liver_Bmal1WT_circadian.csv", label: "Mouse Liver BMAL1-WT (Koike 2012)" },
  { id: "GSE70499_Liver_Bmal1KO_circadian.csv", label: "Mouse Liver BMAL1-KO (Koike 2012)" },
];

function formatP(p: number): string {
  if (p < 1e-10) return p.toExponential(1);
  if (p < 0.001) return p.toExponential(2);
  return p.toFixed(4);
}

function StatBox({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-lg font-bold font-mono ${highlight ? "text-emerald-400" : "text-slate-900"}`}>{value}</div>
      {sub && <div className="text-[10px] text-slate-500">{sub}</div>}
    </div>
  );
}

function LiteratureCard({ ref: litRef }: { ref: LitRef }) {
  return (
    <div className={`border rounded-lg p-4 ${litRef.verified ? "bg-emerald-500/5 border-emerald-500/30" : "bg-amber-500/5 border-amber-500/30"}`} data-testid={`card-lit-${litRef.citation.slice(0, 20)}`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 shrink-0 ${litRef.verified ? "text-emerald-400" : "text-amber-400"}`}>
          {litRef.verified ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
        </div>
        <div className="space-y-2 min-w-0">
          <div>
            <p className="text-sm font-medium text-slate-900">{litRef.finding}</p>
            <p className="text-xs text-slate-500 mt-1">{litRef.agreement}</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline" className="border-slate-300 text-slate-600 text-[10px]">
              <BookOpen className="h-3 w-3 mr-1" />
              {litRef.citation}
            </Badge>
            <Badge variant="outline" className="border-slate-300 text-slate-500 text-[10px]">
              {litRef.method}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}

function phaseToAngle(phase: number): number {
  return ((phase / 24) * 360 - 90) * (Math.PI / 180);
}

function polarToXY(phase: number, radius: number, cx: number, cy: number): [number, number] {
  const angle = phaseToAngle(phase);
  return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
}

const CATEGORY_COLORS: Record<string, string> = {
  clock: '#facc15',
  target: '#22d3ee',
  other: '#64748b',
};

function PhaseClockDiagram({ nodes, selectedGene, onSelectGene }: {
  nodes: PhaseClockNode[];
  selectedGene: string | null;
  onSelectGene: (g: string | null) => void;
}) {
  const size = 500;
  const cx = size / 2;
  const cy = size / 2;
  const clockRadius = 200;
  const geneRadius = 165;

  const clockNodes = nodes.filter(n => n.category === 'clock');
  const targetNodes = nodes.filter(n => n.category === 'target');
  const topOther = nodes
    .filter(n => n.category === 'other')
    .sort((a, b) => b.eigenvalue - a.eigenvalue)
    .slice(0, 30);
  const visibleNodes = [...clockNodes, ...targetNodes, ...topOther];

  const genePositions = useMemo(() => {
    const positions = new Map<string, [number, number]>();
    const phaseGroups: Record<number, PhaseClockNode[]> = {};
    for (const g of visibleNodes) {
      const roundedPhase = Math.round(g.peakPhase * 2) / 2;
      if (!phaseGroups[roundedPhase]) phaseGroups[roundedPhase] = [];
      phaseGroups[roundedPhase].push(g);
    }
    for (const phaseKey of Object.keys(phaseGroups)) {
      const phase = Number(phaseKey);
      const group = phaseGroups[phase];
      if (group.length === 1) {
        positions.set(group[0].gene, polarToXY(phase, geneRadius, cx, cy));
      } else {
        const spread = Math.min(0.8, group.length * 0.25);
        group.forEach((g, i) => {
          const offset = (i - (group.length - 1) / 2) * spread;
          const r = geneRadius + (i % 2 === 0 ? -10 : 10);
          positions.set(g.gene, polarToXY(phase + offset, r, cx, cy));
        });
      }
    }
    return positions;
  }, [visibleNodes, cx, cy]);

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const selectedNode = selectedGene ? visibleNodes.find(n => n.gene === selectedGene) : null;

  return (
    <div className="flex flex-col items-center">
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full" style={{ maxHeight: '500px' }} data-testid="svg-phase-clock">
        <defs>
          <radialGradient id="pgClockBg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#0f172a" />
          </radialGradient>
          <filter id="pgGlow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <circle cx={cx} cy={cy} r={clockRadius + 25} fill="url(#pgClockBg)" stroke="#334155" strokeWidth="1" />
        <circle cx={cx} cy={cy} r={clockRadius} fill="none" stroke="#475569" strokeWidth="1" opacity="0.5" />
        <circle cx={cx} cy={cy} r={geneRadius} fill="none" stroke="#334155" strokeWidth="1" strokeDasharray="4 4" opacity="0.3" />

        <path d={`M ${cx} ${cy - clockRadius + 5} L ${cx} ${cy + clockRadius - 5}`} stroke="#334155" strokeWidth="0.5" opacity="0.3" />
        <path d={`M ${cx - clockRadius + 5} ${cy} L ${cx + clockRadius - 5} ${cy}`} stroke="#334155" strokeWidth="0.5" opacity="0.3" />

        <rect x={cx - clockRadius - 15} y={cy - clockRadius - 15} width={clockRadius + 15} height={clockRadius + 15} fill="#facc15" opacity="0.03" rx="4" />
        <rect x={cx} y={cy - clockRadius - 15} width={clockRadius + 15} height={clockRadius + 15} fill="#facc15" opacity="0.02" rx="4" />
        <rect x={cx} y={cy} width={clockRadius + 15} height={clockRadius + 15} fill="#3b82f6" opacity="0.03" rx="4" />
        <rect x={cx - clockRadius - 15} y={cy} width={clockRadius + 15} height={clockRadius + 15} fill="#3b82f6" opacity="0.02" rx="4" />

        {hours.map(h => {
          const [tx, ty] = polarToXY(h, clockRadius + 15, cx, cy);
          const [lx1, ly1] = polarToXY(h, clockRadius - 3, cx, cy);
          const [lx2, ly2] = polarToXY(h, clockRadius + 3, cx, cy);
          const isMajor = h % 6 === 0;
          return (
            <g key={`hour-${h}`}>
              <line x1={lx1} y1={ly1} x2={lx2} y2={ly2} stroke={isMajor ? "#94a3b8" : "#475569"} strokeWidth={isMajor ? 1.5 : 0.5} />
              {(h % 3 === 0) && (
                <text x={tx} y={ty} textAnchor="middle" dominantBaseline="central" fill={isMajor ? "#e2e8f0" : "#94a3b8"} fontSize={isMajor ? 12 : 9} fontWeight={isMajor ? 600 : 400}>
                  CT{h}
                </text>
              )}
            </g>
          );
        })}

        <text x={cx} y={cy - clockRadius - 22} textAnchor="middle" fill="#facc15" fontSize="9" opacity="0.7" fontWeight="500">DAWN</text>
        <text x={cx + clockRadius + 22} y={cy} textAnchor="middle" fill="#f59e0b" fontSize="9" opacity="0.7" fontWeight="500">NOON</text>
        <text x={cx} y={cy + clockRadius + 26} textAnchor="middle" fill="#3b82f6" fontSize="9" opacity="0.7" fontWeight="500">DUSK</text>
        <text x={cx - clockRadius - 22} y={cy} textAnchor="middle" fill="#6366f1" fontSize="9" opacity="0.7" fontWeight="500">MIDNIGHT</text>

        {visibleNodes.map(node => {
          const pos = genePositions.get(node.gene);
          if (!pos) return null;
          const [gx, gy] = pos;
          const isSelected = selectedGene === node.gene;
          const isDimmed = selectedGene !== null && !isSelected;
          const baseRadius = Math.max(5, Math.min(14, 4 + node.eigenvalue * 12));
          const r = isSelected ? baseRadius + 3 : baseRadius;
          const color = CATEGORY_COLORS[node.category] || CATEGORY_COLORS.other;

          return (
            <g key={node.gene} onClick={() => onSelectGene(isSelected ? null : node.gene)} style={{ cursor: 'pointer' }} data-testid={`node-clock-${node.gene}`}>
              {isSelected && <circle cx={gx} cy={gy} r={r + 4} fill="none" stroke="#ffffff" strokeWidth="2" opacity="0.6" />}
              <circle cx={gx} cy={gy} r={r} fill={color} opacity={isDimmed ? 0.2 : 0.85} filter={isSelected ? "url(#pgGlow)" : undefined} />
              <circle cx={gx} cy={gy} r={r} fill="none" stroke={isSelected ? "#ffffff" : color} strokeWidth={isSelected ? 2 : 1} opacity={isDimmed ? 0.2 : 0.9} />
              <text x={gx} y={gy - r - 4} textAnchor="middle" fill={isDimmed ? "#475569" : "#e2e8f0"} fontSize={isSelected ? 10 : node.category !== 'other' ? 8 : 7} fontWeight={isSelected ? 700 : node.category !== 'other' ? 500 : 400} style={{ pointerEvents: 'none' }}>
                {node.gene}
              </text>
            </g>
          );
        })}

        <text x={cx} y={cy - 6} textAnchor="middle" fill="#94a3b8" fontSize="10" fontWeight="500">24h Clock</text>
        <text x={cx} y={cy + 8} textAnchor="middle" fill="#475569" fontSize="8">Phase Diagram</text>
      </svg>

      {selectedNode && (
        <div className="mt-4 bg-slate-50 border border-slate-200 rounded-lg p-4 w-full max-w-md" data-testid="panel-clock-gene-detail">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[selectedNode.category] || CATEGORY_COLORS.other }} />
            <span className="font-mono font-bold text-slate-900"><GeneTooltip gene={selectedNode.gene}>{selectedNode.gene}</GeneTooltip></span>
            <Badge variant="outline" className="text-[10px] border-slate-300 text-slate-600 capitalize">{selectedNode.category}</Badge>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-xs text-slate-500">Peak Phase</span>
              <div className="font-mono text-slate-900">CT{selectedNode.peakPhase.toFixed(1)}</div>
            </div>
            <div>
              <span className="text-xs text-slate-500">|λ| Eigenvalue</span>
              <div className="font-mono text-slate-900">{selectedNode.eigenvalue.toFixed(4)}</div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <span>Clock ({clockNodes.length})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-cyan-400" />
          <span>Target ({targetNodes.length})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-slate-500" />
          <span>Top Other ({topOther.length})</span>
        </div>
        <span className="text-slate-500">Node size = |λ|</span>
      </div>
    </div>
  );
}

export default function PhaseGating() {
  const [dataset, setDataset] = useState(DATASETS[0].id);
  const [selectedClockGene, setSelectedClockGene] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<ExtendedResponse>({
    queryKey: ["/api/phase-gating/extended", dataset],
    queryFn: async () => {
      const res = await fetch(`/api/phase-gating/extended?dataset=${encodeURIComponent(dataset)}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const verifiedRefs = data?.literatureCrossReferences.filter(r => r.verified) || [];
  const unverifiedRefs = data?.literatureCrossReferences.filter(r => !r.verified) || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 text-slate-900">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/">
            <Button variant="outline" size="sm" className="gap-2 border-slate-200 text-slate-600 hover:bg-slate-100" data-testid="link-back-home">
              <ArrowLeft size={14} />
              Home
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent flex items-center gap-2" data-testid="text-page-title">
              <Clock size={24} className="text-cyan-400" />
              Phase-Gating Analysis
            </h1>
            <p className="text-sm text-slate-500 mt-1">Time-varying AR(2) dynamics, phase-eigenvalue structure, and knockout validation</p>
            <div className="rounded-lg bg-slate-100 border border-slate-200 p-4 mt-3">
              <p className="text-sm text-slate-600 leading-relaxed">
                <strong className="text-slate-900">What you can do:</strong> Phase gating examines how eigenvalues change across different phases of the circadian cycle. This reveals whether persistence is constant or varies with time of day. Download results to analyze phase-dependent dynamics.
              </p>
            </div>
          </div>
          <Badge variant="outline" className="border-amber-600/50 text-amber-400 max-w-xs text-center" data-testid="badge-hypothesis">
            <Beaker size={12} className="mr-1 shrink-0" />
            <span className="text-[10px] leading-tight">Statistical analyses cross-referenced against independent published literature</span>
          </Badge>
          {data && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-slate-300 text-slate-600 hover:bg-slate-100"
              data-testid="button-download-results"
              onClick={() => {
                const csvData = data.timeVaryingEigenvalues.genes.map(g => ({
                  gene: g.gene,
                  category: g.category,
                  fullEigenvalue: g.fullEigenvalue,
                  dayEigenvalue: g.dayEigenvalue,
                  nightEigenvalue: g.nightEigenvalue,
                  dayNightShift: g.dayNightShift,
                  permutationP: g.permutationP,
                  effectSize: g.effectSize,
                  significantShift: g.significantShift,
                }));
                downloadAsCSV(csvData, "PAR2_PhaseGating_Results.csv");
              }}
            >
              <Download className="h-4 w-4" />
              Download Results (CSV)
            </Button>
          )}
        </div>

        <PaperCrossLinks currentPage="/phase-gating" />

        <Card className="bg-white border-slate-200 mb-6" data-testid="card-dataset-selector">
          <CardContent className="pt-4">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-slate-600 whitespace-nowrap">Dataset</label>
              <Select value={dataset} onValueChange={setDataset}>
                <SelectTrigger className="bg-slate-100 border-slate-200 text-slate-900 max-w-lg" data-testid="select-dataset-trigger">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-100 border-slate-200">
                  {DATASETS.map(ds => (
                    <SelectItem key={ds.id} value={ds.id} data-testid={`select-dataset-item-${ds.id}`}>
                      {ds.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20" data-testid="loading-state">
            <Loader2 className="h-10 w-10 animate-spin text-cyan-400 mb-4" />
            <p className="text-slate-500 text-lg">Running extended phase-gating analysis...</p>
            <p className="text-slate-500 text-sm mt-1">Computing time-varying eigenvalues, genome-wide correlations, and KO comparison</p>
          </div>
        )}

        {error && (
          <Card className="bg-red-500/10 border-red-500/30 mb-6" data-testid="error-state">
            <CardContent className="pt-4">
              <p className="text-red-400 text-sm">{(error as Error).message}</p>
            </CardContent>
          </Card>
        )}

        {data && !isLoading && (
          <Tabs defaultValue="time-varying" className="space-y-6">
            <TabsList className="bg-slate-50 border border-slate-200 p-1">
              <TabsTrigger value="time-varying" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-slate-900 gap-2" data-testid="tab-time-varying">
                <Sun size={14} />
                Day vs Night Dynamics
              </TabsTrigger>
              <TabsTrigger value="phase-correlation" className="data-[state=active]:bg-purple-600 data-[state=active]:text-slate-900 gap-2" data-testid="tab-phase-correlation">
                <TrendingUp size={14} />
                Phase-Eigenvalue Map
              </TabsTrigger>
              <TabsTrigger value="phase-clock" className="data-[state=active]:bg-amber-600 data-[state=active]:text-slate-900 gap-2" data-testid="tab-phase-clock">
                <CircleDot size={14} />
                24h Clock Diagram
              </TabsTrigger>
              <TabsTrigger value="ko-comparison" className="data-[state=active]:bg-red-600 data-[state=active]:text-slate-900 gap-2" data-testid="tab-ko-comparison">
                <FlaskConical size={14} />
                KO Validation
              </TabsTrigger>
              <TabsTrigger value="literature" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-slate-900 gap-2" data-testid="tab-literature">
                <BookOpen size={14} />
                Literature ({verifiedRefs.length} Verified)
              </TabsTrigger>
            </TabsList>

            <TabsContent value="time-varying" className="space-y-6">
              <Card className="bg-white border-slate-200" data-testid="card-time-varying">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-cyan-500/20">
                      <ArrowRightLeft className="h-5 w-5 text-cyan-400" />
                    </div>
                    <div>
                      <CardTitle className="text-slate-900">Time-Varying AR(2) Eigenvalues: Day vs Night</CardTitle>
                      <CardDescription className="text-slate-500">
                        Do gene dynamics genuinely shift between circadian day (CT0-12) and night (CT12-24) phases?
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatBox label="Genes Tested" value={String(data.timeVaryingEigenvalues.summary.totalGenes)} />
                    <StatBox
                      label="Significant Shifts"
                      value={`${data.timeVaryingEigenvalues.summary.significantShifts}/${data.timeVaryingEigenvalues.summary.totalGenes}`}
                      highlight={data.timeVaryingEigenvalues.summary.significantShifts > 0}
                    />
                    <StatBox
                      label="Mean Clock Shift"
                      value={data.timeVaryingEigenvalues.summary.meanClockShift.toFixed(3)}
                      sub="Day - Night |λ|"
                    />
                    <StatBox
                      label="Mean Target Shift"
                      value={data.timeVaryingEigenvalues.summary.meanTargetShift.toFixed(3)}
                      sub="Day - Night |λ|"
                    />
                  </div>

                  <div className="h-80" data-testid="chart-day-night">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={data.timeVaryingEigenvalues.genes.map(g => ({
                          gene: g.gene,
                          day: g.dayEigenvalue,
                          night: g.nightEigenvalue,
                          category: g.category,
                        }))}
                        margin={{ top: 5, right: 30, left: 20, bottom: 60 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis
                          dataKey="gene"
                          tick={{ fill: '#64748b', fontSize: 10 }}
                          angle={-45}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis
                          tick={{ fill: '#64748b', fontSize: 11 }}
                          label={{ value: '|λ| Eigenvalue', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 12 }}
                        />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                          labelStyle={{ color: '#334155' }}
                          formatter={(value: number, name: string) => [value.toFixed(4), name === 'day' ? 'Day (CT0-12)' : 'Night (CT12-24)']}
                        />
                        <Legend
                          wrapperStyle={{ paddingTop: '10px' }}
                          formatter={(value: string) => value === 'day' ? 'Day (CT0-12)' : 'Night (CT12-24)'}
                        />
                        <Bar dataKey="day" fill="#facc15" name="day" />
                        <Bar dataKey="night" fill="#3b82f6" name="night" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" data-testid="table-time-varying">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="py-2 px-3 text-left">Gene</th>
                          <th className="py-2 px-3 text-left">Type</th>
                          <th className="py-2 px-3 text-right">Full |λ|</th>
                          <th className="py-2 px-3 text-right">Day |λ|</th>
                          <th className="py-2 px-3 text-right">Night |λ|</th>
                          <th className="py-2 px-3 text-right">Δ (Day-Night)</th>
                          <th className="py-2 px-3 text-right">Perm. P</th>
                          <th className="py-2 px-3 text-center">Sig.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.timeVaryingEigenvalues.genes.map(g => (
                          <tr key={g.gene} className="border-b border-slate-200 hover:bg-slate-50" data-testid={`row-tv-${g.gene}`}>
                            <td className={`py-2 px-3 font-mono font-medium ${g.category === 'clock' ? 'text-amber-300' : 'text-cyan-300'}`}><GeneTooltip gene={g.gene}>{g.gene}</GeneTooltip></td>
                            <td className="py-2 px-3 text-slate-500 text-xs capitalize">{g.category}</td>
                            <td className="py-2 px-3 text-right font-mono text-slate-900">{g.fullEigenvalue.toFixed(4)}</td>
                            <td className="py-2 px-3 text-right font-mono text-yellow-300">{g.dayEigenvalue.toFixed(4)}</td>
                            <td className="py-2 px-3 text-right font-mono text-blue-300">{g.nightEigenvalue.toFixed(4)}</td>
                            <td className={`py-2 px-3 text-right font-mono ${Math.abs(g.dayNightShift) > 0.05 ? 'text-emerald-400' : 'text-slate-500'}`}>
                              {g.dayNightShift > 0 ? '+' : ''}{g.dayNightShift.toFixed(4)}
                            </td>
                            <td className={`py-2 px-3 text-right font-mono ${g.permutationP < 0.05 ? 'text-emerald-400' : 'text-slate-500'}`}>
                              {formatP(g.permutationP)}
                            </td>
                            <td className="py-2 px-3 text-center">
                              {g.significantShift ? <CheckCircle2 className="h-4 w-4 text-emerald-400 mx-auto" /> : <XCircle className="h-4 w-4 text-slate-500 mx-auto" />}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                    <p className="text-xs text-slate-500 leading-relaxed" data-testid="text-interpretation-tv">
                      {data.timeVaryingEigenvalues.summary.interpretation}
                    </p>
                  </div>

                  <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <BookOpen className="h-4 w-4 text-blue-400" />
                      <span className="text-sm font-medium text-blue-400">Independent Literature Verification</span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Day-night differences in liver gene expression were independently established by Storch et al. (2002, Nature 417:78-83) using Affymetrix microarrays, showing ~10% of transcripts oscillate with dramatic day-night phase differences.
                      Panda et al. (2002, Cell 109:307-320) confirmed this using serial analysis of gene expression (SAGE) in SCN and liver. These studies used entirely different methods from AR(2) modeling.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="phase-correlation" className="space-y-6">
              <Card className="bg-white border-slate-200" data-testid="card-phase-correlation">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/20">
                      <TrendingUp className="h-5 w-5 text-purple-400" />
                    </div>
                    <div>
                      <CardTitle className="text-slate-900">Phase-Eigenvalue Correlation</CardTitle>
                      <CardDescription className="text-slate-500">
                        Does a gene's peak expression time predict its AR(2) persistence? Genome-wide analysis across {data.phaseEigenvalueCorrelation.nGenes.toLocaleString()} oscillating genes.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatBox label="Spearman r" value={data.phaseEigenvalueCorrelation.spearmanR.toFixed(4)} />
                    <StatBox
                      label="P-value"
                      value={formatP(data.phaseEigenvalueCorrelation.pValue)}
                      highlight={data.phaseEigenvalueCorrelation.pValue < 0.05}
                    />
                    <StatBox label="Genes Analyzed" value={data.phaseEigenvalueCorrelation.nGenes.toLocaleString()} sub="Cosinor R² > 0.1" />
                    <StatBox
                      label="Highest Persistence"
                      value={data.phaseEigenvalueCorrelation.highestPersistenceBin}
                      sub="Phase bin"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-sm text-slate-600 font-medium mb-3">Mean |λ| by Phase Bin</h4>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={data.phaseEigenvalueCorrelation.phaseBins.map(b => ({
                              name: b.binLabel,
                              eigenvalue: b.meanEigenvalue,
                              genes: b.nGenes,
                            }))}
                            margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} />
                            <YAxis
                              tick={{ fill: '#64748b', fontSize: 11 }}
                              label={{ value: 'Mean |λ|', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 12 }}
                            />
                            <Tooltip
                              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                              formatter={(value: number, name: string) => [value.toFixed(4), 'Mean |λ|']}
                              labelFormatter={(label: string) => `Phase: ${label}`}
                            />
                            <Bar dataKey="eigenvalue" name="Mean |λ|">
                              {data.phaseEigenvalueCorrelation.phaseBins.map((b, i) => (
                                <Cell
                                  key={i}
                                  fill={b.binLabel === data.phaseEigenvalueCorrelation.highestPersistenceBin ? '#22d3ee' : '#64748b'}
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-sm text-slate-600 font-medium">Phase Bin Details</h4>
                      {data.phaseEigenvalueCorrelation.phaseBins.map((bin, i) => (
                        <div key={i} className={`border rounded-lg p-3 ${bin.binLabel === data.phaseEigenvalueCorrelation.highestPersistenceBin ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-slate-50 border-slate-200'}`} data-testid={`card-bin-${bin.binLabel}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-slate-900">{bin.binLabel}</span>
                            <span className="text-xs text-slate-500">{bin.binRange}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-500">{bin.nGenes} genes</span>
                            <span className="font-mono text-sm text-slate-900">|λ| = {bin.meanEigenvalue.toFixed(4)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                    <p className="text-xs text-slate-500 leading-relaxed" data-testid="text-interpretation-pc">
                      {data.phaseEigenvalueCorrelation.interpretation}
                    </p>
                  </div>

                  <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <BookOpen className="h-4 w-4 text-blue-400" />
                      <span className="text-sm font-medium text-blue-400">Independent Literature Context</span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Phase-dependent gene regulation was characterized by Panda et al. (2002, Cell 109:307-320) showing output genes cluster at specific circadian phases, with genes at dawn/dusk transitions showing distinct regulation patterns.
                      Ueda et al. (2002, Nature 418:534-539) mapped phase-specific transcription factor binding, showing that genes peaking at different phases are driven by different regulatory elements.
                      Neither study used autoregressive models.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="phase-clock" className="space-y-6">
              <Card className="bg-white border-slate-200" data-testid="card-phase-clock">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/20">
                      <CircleDot className="h-5 w-5 text-amber-400" />
                    </div>
                    <div>
                      <CardTitle className="text-slate-900">24-Hour Phase Clock Diagram</CardTitle>
                      <CardDescription className="text-slate-500">
                        Genes positioned by peak expression phase on a 24h circadian clock. Node size reflects |λ| eigenvalue persistence. Click any gene for details.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {data.phaseClockNodes && data.phaseClockNodes.length > 0 ? (
                    <PhaseClockDiagram
                      nodes={data.phaseClockNodes}
                      selectedGene={selectedClockGene}
                      onSelectGene={setSelectedClockGene}
                    />
                  ) : (
                    <div className="text-center py-8 text-slate-500">
                      <CircleDot className="h-12 w-12 mx-auto mb-3 opacity-40" />
                      <p className="text-sm">No oscillating genes detected (cosinor R² &gt; 0.1 filter). Try a different dataset.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="ko-comparison" className="space-y-6">
              <Card className="bg-white border-slate-200" data-testid="card-ko-comparison">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-red-500/20">
                      <FlaskConical className="h-5 w-5 text-red-400" />
                    </div>
                    <div>
                      <CardTitle className="text-slate-900">BMAL1-KO vs Wild-Type Comparison</CardTitle>
                      <CardDescription className="text-slate-500">
                        {data.koComparison.available
                          ? `Does removing the master clock gene abolish AR(2) dynamics? Comparing ${data.koComparison.wtDataset} vs ${data.koComparison.koDataset}`
                          : 'KO comparison datasets not available for this selection'}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {!data.koComparison.available ? (
                    <div className="text-center py-8 text-slate-500" data-testid="text-ko-unavailable">
                      <FlaskConical className="h-12 w-12 mx-auto mb-3 opacity-40" />
                      <p className="text-sm">No paired KO dataset available. Select a BMAL1-WT or BMAL1-KO dataset to enable this comparison.</p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatBox
                          label="Clock Eigenvalue (WT)"
                          value={data.koComparison.summary.meanClockEigenvalueWT.toFixed(4)}
                        />
                        <StatBox
                          label="Clock Eigenvalue (KO)"
                          value={data.koComparison.summary.meanClockEigenvalueKO.toFixed(4)}
                        />
                        <StatBox
                          label="Target Eigenvalue (WT)"
                          value={data.koComparison.summary.meanTargetEigenvalueWT.toFixed(4)}
                        />
                        <StatBox
                          label="Target Eigenvalue (KO)"
                          value={data.koComparison.summary.meanTargetEigenvalueKO.toFixed(4)}
                        />
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatBox
                          label="Clock Shift P-value"
                          value={formatP(data.koComparison.summary.clockShiftP)}
                          highlight={data.koComparison.summary.clockShiftP < 0.05}
                        />
                        <StatBox
                          label="Target Shift P-value"
                          value={formatP(data.koComparison.summary.targetShiftP)}
                          highlight={data.koComparison.summary.targetShiftP < 0.05}
                        />
                        <StatBox
                          label="Coupled Genes (WT)"
                          value={`${data.koComparison.summary.wtCoupledGenes}/${data.koComparison.summary.totalTestedGenes}`}
                          sub="Significant coupling"
                        />
                        <StatBox
                          label="Coupled Genes (KO)"
                          value={`${data.koComparison.summary.koCoupledGenes}/${data.koComparison.summary.totalTestedGenes}`}
                          sub="Significant coupling"
                          highlight={data.koComparison.summary.koCoupledGenes < data.koComparison.summary.wtCoupledGenes}
                        />
                      </div>

                      <div className="h-72" data-testid="chart-ko-comparison">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={data.koComparison.perGene.map(g => ({
                              gene: g.gene,
                              wt: g.wtEigenvalue,
                              ko: g.koEigenvalue,
                              category: g.category,
                            }))}
                            margin={{ top: 5, right: 30, left: 20, bottom: 60 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis
                              dataKey="gene"
                              tick={{ fill: '#64748b', fontSize: 10 }}
                              angle={-45}
                              textAnchor="end"
                              height={60}
                            />
                            <YAxis
                              tick={{ fill: '#64748b', fontSize: 11 }}
                              label={{ value: '|λ| Eigenvalue', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 12 }}
                            />
                            <Tooltip
                              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                              formatter={(value: number, name: string) => [value.toFixed(4), name === 'wt' ? 'Wild-Type' : 'BMAL1-KO']}
                            />
                            <Legend formatter={(value: string) => value === 'wt' ? 'Wild-Type (WT)' : 'BMAL1-KO'} />
                            <Bar dataKey="wt" fill="#22c55e" name="wt" />
                            <Bar dataKey="ko" fill="#ef4444" name="ko" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-sm" data-testid="table-ko-comparison">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-500">
                              <th className="py-2 px-3 text-left">Gene</th>
                              <th className="py-2 px-3 text-left">Type</th>
                              <th className="py-2 px-3 text-right">WT |λ|</th>
                              <th className="py-2 px-3 text-right">KO |λ|</th>
                              <th className="py-2 px-3 text-right">Δ|λ|</th>
                              <th className="py-2 px-3 text-right">WT R² (rhythm)</th>
                              <th className="py-2 px-3 text-right">KO R² (rhythm)</th>
                              <th className="py-2 px-3 text-right">ΔR²</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.koComparison.perGene.map(g => (
                              <tr key={g.gene} className="border-b border-slate-200 hover:bg-slate-50" data-testid={`row-ko-${g.gene}`}>
                                <td className={`py-2 px-3 font-mono font-medium ${g.category === 'clock' ? 'text-amber-300' : 'text-cyan-300'}`}><GeneTooltip gene={g.gene}>{g.gene}</GeneTooltip></td>
                                <td className="py-2 px-3 text-slate-500 text-xs capitalize">{g.category}</td>
                                <td className="py-2 px-3 text-right font-mono text-emerald-300">{g.wtEigenvalue.toFixed(4)}</td>
                                <td className="py-2 px-3 text-right font-mono text-red-300">{g.koEigenvalue.toFixed(4)}</td>
                                <td className={`py-2 px-3 text-right font-mono ${g.eigenvalueShift < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                  {g.eigenvalueShift > 0 ? '+' : ''}{g.eigenvalueShift.toFixed(4)}
                                </td>
                                <td className="py-2 px-3 text-right font-mono text-slate-600">{g.wtRhythmicity.toFixed(3)}</td>
                                <td className="py-2 px-3 text-right font-mono text-slate-600">{g.koRhythmicity.toFixed(3)}</td>
                                <td className={`py-2 px-3 text-right font-mono ${g.rhythmicityShift < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                                  {g.rhythmicityShift > 0 ? '+' : ''}{g.rhythmicityShift.toFixed(3)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                        <p className="text-xs text-slate-500 leading-relaxed" data-testid="text-interpretation-ko">
                          {data.koComparison.summary.interpretation}
                        </p>
                      </div>

                      <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <BookOpen className="h-4 w-4 text-blue-400" />
                          <span className="text-sm font-medium text-blue-400">Independent Literature Verification</span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          BMAL1 knockout effects on circadian gene expression were independently established by:
                          (1) Bunger et al. (2000, Cell 103:1009-1017) showing BMAL1-null mice are arrhythmic in constant darkness.
                          (2) Kondratov et al. (2006, Genes Dev 20:1868-1873) demonstrating BMAL1-KO mice exhibit premature aging.
                          (3) Koike et al. (2012, Science 338:349-354) performing the ChIP-seq study from which this dataset originates, showing BMAL1 drives genome-wide rhythmic transcription.
                          These are orthogonal experimental methods (behavioral assays, histology, ChIP-seq) that independently confirm BMAL1 is essential for circadian gene regulation.
                        </p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="literature" className="space-y-6">
              <Card className="bg-white border-slate-200" data-testid="card-literature">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/20">
                      <BookOpen className="h-5 w-5 text-emerald-400" />
                    </div>
                    <div>
                      <CardTitle className="text-slate-900">Literature Cross-References</CardTitle>
                      <CardDescription className="text-slate-500">
                        Findings from this analysis cross-referenced against published studies using entirely different methods.
                        Verification means an independent lab confirmed the same biological pattern using orthogonal techniques.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {verifiedRefs.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium text-emerald-400 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        Independently Verified ({verifiedRefs.length})
                      </h3>
                      <p className="text-xs text-slate-500 mb-2">
                        These findings were confirmed by other research groups using different experimental methods (microarrays, knockouts, reporters, ChIP-seq).
                        "Verified" means the biological pattern matches, not that the AR(2) method itself has been independently validated.
                      </p>
                      {verifiedRefs.map((r, i) => (
                        <LiteratureCard key={i} ref={r} />
                      ))}
                    </div>
                  )}

                  {unverifiedRefs.length > 0 && (
                    <div className="space-y-3 mt-6">
                      <h3 className="text-sm font-medium text-amber-400 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Unverified or Partially Supported ({unverifiedRefs.length})
                      </h3>
                      <p className="text-xs text-slate-500 mb-2">
                        These findings have not been independently confirmed by published literature using orthogonal methods.
                        They should be treated as hypotheses requiring experimental validation.
                      </p>
                      {unverifiedRefs.map((r, i) => (
                        <LiteratureCard key={i} ref={r} />
                      ))}
                    </div>
                  )}

                  <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4" data-testid="card-lit-caveats">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4 text-amber-400" />
                      <span className="text-sm font-medium text-amber-400">Interpretation Limitations</span>
                    </div>
                    <ul className="space-y-1.5 text-xs text-slate-500">
                      <li className="flex items-start gap-2"><span className="text-slate-500 mt-0.5">1.</span>Statistical significance in AR(2) modeling does not constitute biological confirmation.</li>
                      <li className="flex items-start gap-2"><span className="text-slate-500 mt-0.5">2.</span>Literature verification means the biological pattern was found by others, not that AR(2) is the right model for it.</li>
                      <li className="flex items-start gap-2"><span className="text-slate-500 mt-0.5">3.</span>Most analyses here use a single dataset per condition. Multi-dataset replication is needed.</li>
                      <li className="flex items-start gap-2"><span className="text-slate-500 mt-0.5">4.</span>mRNA expression levels do not directly reflect protein activity, post-translational modifications, or functional output.</li>
                      <li className="flex items-start gap-2"><span className="text-slate-500 mt-0.5">5.</span>Correlation between phase and eigenvalue does not imply causation.</li>
                      <li className="flex items-start gap-2"><span className="text-slate-500 mt-0.5">6.</span>KO comparison uses datasets from different experimental conditions, which may introduce confounds beyond BMAL1 loss.</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
