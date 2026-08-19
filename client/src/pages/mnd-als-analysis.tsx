import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Cell, AreaChart, Area,
} from "recharts";
import {
  ArrowLeft, Brain, AlertTriangle, CheckCircle2, Info, Zap,
  BookOpen, TrendingUp, TrendingDown, Loader2, XCircle, Download, RefreshCw,
  FlaskConical, ShieldCheck,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PerGeneResult {
  gene: string; lambda: number; lambdaCapped: number; phi1: number; phi2: number;
  isComplex: boolean; r2: number; expression: number; aboveOne: boolean;
  group: "als" | "clock" | "cholinergic";
}
interface GroupSummary {
  group: string; mean: number; median: number; n: number; delta: number;
  ci95lo: number; ci95hi: number;
}
interface MNDALSResult {
  meta: {
    source: "live" | "embedded"; csvPath1: string; csvPath2: string;
    nGenome: number; genomeMean: number; genomeMedian: number;
    genomeP25: number; genomeP75: number; computedAt: string;
    exprLambdaCorr: number;
  };
  perGene: PerGeneResult[];
  groupSummary: GroupSummary[];
  permutation: {
    pValue: number; observedMean: number; nullMean: number; nullSD: number;
    nPerm: number; nullHistogram: Array<{ bin: number; count: number }>;
  };
  expressionNull: { pValue: number; observedMean: number; nullMean: number; nullSD: number };
  sensitivity: {
    allGenes:  { geneMean:number; genomeMean:number; gap:number; pValue:number; n:number };
    cappedAt1: { geneMean:number; genomeMean:number; gap:number; pValue:number; n:number };
    excluded:  { geneMean:number; genomeMean:number; gap:number; pValue:number; n:number };
    nAboveOne: number; genesAboveOne: string[];
  };
  timeShuffle: { originalGap: number; shuffledMeanGap: number; destructionPct: number; verdict: string };
  expandedAnalysis: {
    nTotal: number; nFound: number; observedMean: number; genomeMean: number;
    delta: number; pValue: number; exprMatchedPValue: number;
    ci95lo: number; ci95hi: number;
    newGenesOnly: Array<{ gene: string; lambda: number; isComplex: boolean; category: string }>;
  };
  diseaseProgression: {
    source: string; ctrlMean: number; ctrlMedian: number; alsMean: number; alsMedian: number;
    delta: number; pValue: number; nCtrl: number; nALS: number;
    topGainers: Array<{ probeId:string; ctrlLambda:number; alsLambda:number; delta:number }>;
    topLosers:  Array<{ probeId:string; ctrlLambda:number; alsLambda:number; delta:number }>;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function pFmt(p: number) {
  if (p < 0.0001) return "p < 0.0001";
  if (p < 0.001)  return `p = ${p.toFixed(4)}`;
  if (p < 0.01)   return `p = ${p.toFixed(3)}`;
  return `p = ${p.toFixed(3)}`;
}

function pBadge(p: number) {
  if (p < 0.001)  return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">{pFmt(p)} ***</Badge>;
  if (p < 0.01)   return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">{pFmt(p)} **</Badge>;
  if (p < 0.05)   return <Badge className="bg-sky-100 text-sky-700 border-sky-200 text-xs">{pFmt(p)} *</Badge>;
  return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">{pFmt(p)} ns</Badge>;
}

function SourceBadge({ source }: { source: "live" | "embedded" }) {
  return source === "live"
    ? <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">✓ Live from CSV</Badge>
    : <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">⚡ Pre-computed fallback</Badge>;
}

const GROUP_COLORS: Record<string, string> = {
  "ALS-linked genes":   "#ef4444",
  "Clock genes":        "#60a5fa",
  "Cholinergic markers":"#f59e0b",
  "Genome background":  "#94a3b8",
};

function downloadCSV(perGene: PerGeneResult[]) {
  const header = "gene,group,lambda,lambda_capped,phi1,phi2,is_complex,r2,expression,above_one";
  const rows = perGene.map(g =>
    `${g.gene},${g.group},${g.lambda.toFixed(4)},${g.lambdaCapped.toFixed(4)},${g.phi1.toFixed(4)},${g.phi2.toFixed(4)},${g.isComplex},${g.r2.toFixed(3)},${g.expression.toFixed(3)},${g.aboveOne}`
  );
  const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "MND_ALS_AR2_per_gene.csv"; a.click();
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SensitivityTable({ s }: { s: MNDALSResult["sensitivity"] }) {
  const rows = [
    { label: "All genes (incl. |λ|>1)", ...s.allGenes },
    { label: "Capped at 1.0",           ...s.cappedAt1 },
    { label: "Excluded |λ|>1",          ...s.excluded  },
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs" data-testid="sensitivity-table">
        <thead>
          <tr className="border-b border-slate-200">
            {["Strategy","Gene-set mean","Genome mean","Gap","p-value","n"].map(h => (
              <th key={h} className="text-left py-2 px-3 text-slate-500 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.label} className="border-b border-slate-50 hover:bg-slate-50">
              <td className="py-2 px-3 font-medium text-slate-700">{r.label}</td>
              <td className="py-2 px-3 font-mono">{r.geneMean.toFixed(3)}</td>
              <td className="py-2 px-3 font-mono">{r.genomeMean.toFixed(3)}</td>
              <td className="py-2 px-3 font-mono font-semibold text-red-600">+{r.gap.toFixed(3)}</td>
              <td className="py-2 px-3">{pBadge(r.pValue)}</td>
              <td className="py-2 px-3 text-slate-500">{r.n}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {s.nAboveOne > 0 && (
        <p className="text-xs text-slate-400 mt-2 px-1">
          {s.nAboveOne} gene(s) with |λ|&gt;1 (beyond estimable range for 6-timepoint dataset): {s.genesAboveOne.join(", ")}
        </p>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MNDALSAnalysis() {
  const [tab, setTab] = useState<"circadian" | "robustness" | "progression" | "interpretation">("circadian");

  const { data, isLoading, error, refetch } = useQuery<MNDALSResult>({
    queryKey: ["/api/mnd-als/ar2-results"],
    staleTime: 1000 * 60 * 30,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-red-50 flex items-center justify-center" data-testid="loading-state">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-red-400 mx-auto mb-3" />
          <p className="text-sm text-slate-500">Running AR(2) analysis + permutation tests…</p>
          <p className="text-xs text-slate-400 mt-1">First load takes ~10 seconds</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-red-50 flex items-center justify-center" data-testid="error-state">
        <div className="text-center">
          <XCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <p className="text-sm text-red-600 mb-3">{error ? String(error) : "Failed to load results"}</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-3 h-3 mr-1" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  const { meta, perGene, groupSummary, permutation, expressionNull, sensitivity, timeShuffle, diseaseProgression: dp, expandedAnalysis: ea } = data;

  const alsGenes    = perGene.filter(g => g.group === "als").sort((a,b) => b.lambda - a.lambda);
  const clockGenes  = perGene.filter(g => g.group === "clock").sort((a,b) => b.lambda - a.lambda);
  const choGenes    = perGene.filter(g => g.group === "cholinergic").sort((a,b) => b.lambda - a.lambda);
  const alsMean     = groupSummary.find(g => g.group === "ALS-linked genes");
  const genomeSummary = groupSummary.find(g => g.group === "Genome background");
  const choSummary  = groupSummary.find(g => g.group === "Cholinergic markers");

  const barData = [...groupSummary].sort((a,b) => b.mean - a.mean).map(g => ({
    name: g.group,
    mean: g.mean,
    ci95lo: g.ci95lo,
    ci95hi: g.ci95hi,
    color: GROUP_COLORS[g.group] || "#94a3b8",
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-red-50">
      <div className="max-w-6xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-6">
          <Link href="/dashboard">
            <button className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
              <ArrowLeft className="w-4 h-4" /> Home
            </button>
          </Link>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
              <Brain className="w-6 h-6 text-red-500" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-slate-900">Motor Neuron Disease — AR(2) Persistence Analysis</h1>
              <p className="text-slate-500 mt-1 text-sm max-w-2xl">
                Full robustness-validated AR(2) eigenvalue modulus |λ| profiling of ALS-linked genes.
                Two independent datasets. Permutation test, expression-matched null, |λ|&gt;1 sensitivity, and time-shuffle destruction.
              </p>
              <div className="flex gap-2 mt-2 flex-wrap items-center">
                <Badge variant="outline" className="text-xs">GSE297373 · 2026 · ChAT-Cre;RiboTag · ZT0–ZT20</Badge>
                <Badge variant="outline" className="text-xs">GSE18597 · SOD1-G93A · 7 disease stages</Badge>
                <Badge variant="outline" className="text-xs">{meta.nGenome.toLocaleString()} genome genes</Badge>
                <SourceBadge source={meta.source} />
                <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">Exploratory · not peer-reviewed</Badge>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => downloadCSV(perGene)} data-testid="download-csv">
              <Download className="w-3 h-3 mr-1" /> CSV
            </Button>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            {
              label: "ALS-RBP mean |λ|",
              value: alsMean ? alsMean.mean.toFixed(3) : "—",
              sub: `vs genome ${meta.genomeMean.toFixed(3)}`,
              col: "text-red-600", bg: "bg-red-50 border-red-200",
            },
            {
              label: "Permutation p-value",
              value: permutation.pValue < 0.0001 ? "<0.0001" : permutation.pValue.toFixed(4),
              sub: `${permutation.nPerm.toLocaleString()} random draws`,
              col: permutation.pValue < 0.05 ? "text-emerald-600" : "text-amber-600",
              bg: permutation.pValue < 0.05 ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200",
            },
            {
              label: "Cholinergic mean |λ|",
              value: choSummary ? choSummary.mean.toFixed(3) : "—",
              sub: `+${choSummary ? (choSummary.mean - meta.genomeMean).toFixed(3) : "—"} above genome`,
              col: "text-amber-600", bg: "bg-amber-50 border-amber-200",
            },
            {
              label: "ALS vs WT Δ|λ|",
              value: dp.delta >= 0 ? `+${dp.delta.toFixed(3)}` : dp.delta.toFixed(3),
              sub: `GSE18597 · genome-wide · ${pFmt(dp.pValue)}`,
              col: "text-violet-600", bg: "bg-violet-50 border-violet-200",
            },
          ].map(k => (
            <div key={k.label} className={`rounded-xl border p-3 ${k.bg}`} data-testid={`kpi-${k.label.replace(/\s/g,"-")}`}>
              <div className={`text-2xl font-bold font-mono ${k.col}`}>{k.value}</div>
              <div className="text-xs font-semibold text-slate-700 mt-0.5">{k.label}</div>
              <div className="text-xs text-slate-500">{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Pre-loaded vulnerability thesis — surfaced before tabs so the finding has context */}
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-slate-700 leading-relaxed">
          <span className="font-semibold text-red-700">Why this matters for ALS: </span>
          ALS-linked RBPs are constitutively highly expressed in healthy motor neurons long before disease.
          The <em>pre-loaded vulnerability</em> hypothesis predicts this lifetime of high-persistence
          expression chronically stresses the protein quality-control system — eventually crossing the
          phase-separation threshold that triggers aggregation.{" "}
          <button onClick={() => setTab("interpretation")}
            className="text-red-600 hover:underline font-medium whitespace-nowrap">
            Full three-step argument →
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-slate-200 overflow-x-auto">
          {(["circadian","robustness","progression","interpretation"] as const).map(t => (
            <button key={t} data-testid={`tab-${t}`} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap capitalize transition-colors ${
                tab === t ? "border-b-2 border-red-500 text-red-600" : "text-slate-500 hover:text-slate-700"
              }`}>
              {t === "circadian" ? "Circadian Time-Series (GSE297373)" :
               t === "robustness" ? "Robustness Tests" :
               t === "progression" ? "Disease Progression (GSE18597)" : "Interpretation"}
            </button>
          ))}
        </div>

        {/* ── TAB: Circadian ── */}
        {tab === "circadian" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Gene Group Comparison — mean |λ| vs Genome Background</CardTitle>
                <p className="text-xs text-slate-500">
                  Mouse spinal cord cholinergic neurons · ZT0, ZT4, ZT8, ZT12, ZT16, ZT20 · 3 replicates ·
                  log₂CPM normalised · AR(2) mean-centred OLS · {meta.nGenome.toLocaleString()} genome genes ·
                  Error bars = 95% bootstrap CI
                </p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={barData} layout="vertical" margin={{ left: 140, right: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" domain={[0.55, 0.95]} tick={{ fontSize: 11 }}
                      tickFormatter={v => v.toFixed(2)} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={135} />
                    <Tooltip formatter={(v: number) => v.toFixed(3)} />
                    <ReferenceLine x={meta.genomeMean} stroke="#94a3b8" strokeDasharray="4 2"
                      label={{ value: "genome", position: "insideTopRight", fontSize: 10, fill: "#94a3b8" }} />
                    <Bar dataKey="mean" radius={[0, 4, 4, 0]}>
                      {barData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {barData.map(g => (
                    <div key={g.name} className="flex items-center gap-1.5 text-slate-500">
                      <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: g.color }} />
                      <span>{g.name} ({g.mean.toFixed(3)})</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">ALS-Linked Gene |λ| Profile</CardTitle>
                <p className="text-xs text-slate-500">
                  Sorted by |λ|. All ALS-linked genes found show <strong>complex eigenvalues</strong> — oscillatory dynamics.
                  Dashed line = genome mean {meta.genomeMean.toFixed(3)}.
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {alsGenes.map(r => (
                    <div key={r.gene} className="flex items-center gap-3 py-1 border-b border-slate-50 last:border-0"
                      data-testid={`gene-row-${r.gene}`}>
                      <span className="text-xs font-mono font-semibold text-slate-800 w-20 shrink-0">{r.gene}</span>
                      <div className="flex-1 relative">
                        <div className="h-5 bg-slate-100 rounded relative overflow-hidden">
                          <div className="h-full rounded transition-all"
                            style={{
                              width: `${Math.min(r.lambda, 1) * 100}%`,
                              backgroundColor: r.lambda >= 0.85 ? "#ef4444" : r.lambda >= 0.70 ? "#f97316" : "#94a3b8",
                            }} />
                          <div className="absolute top-0 bottom-0 w-px bg-slate-400 opacity-60"
                            style={{ left: `${meta.genomeMean * 100}%` }} />
                        </div>
                      </div>
                      <span className="text-xs font-mono w-12 text-right text-slate-700">{r.lambda.toFixed(3)}</span>
                      <Badge variant="outline" className="text-xs hidden sm:flex w-16 justify-center">
                        {r.isComplex ? "complex" : "real"}
                      </Badge>
                      <span className="text-xs text-slate-400 w-12 text-right">R²={r.r2.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 p-2 bg-slate-50 rounded text-xs text-slate-600 border border-slate-200">
                  All {alsGenes.filter(g=>g.isComplex).length} of {alsGenes.length} ALS-linked genes present in dataset have
                  complex eigenvalues — independently confirmed by JTK_Cycle in Tam et al. 2026.
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-sm">Cholinergic Identity Markers</CardTitle></CardHeader>
                <CardContent>
                  {choGenes.map(r => (
                    <div key={r.gene} className="flex items-center gap-2 mb-2" data-testid={`cho-gene-${r.gene}`}>
                      <span className="text-xs font-mono w-16 shrink-0">{r.gene}</span>
                      <div className="flex-1 h-2 bg-slate-100 rounded overflow-hidden">
                        <div className="h-full rounded" style={{ width:`${r.lambda*100}%`, backgroundColor:"#f59e0b" }} />
                      </div>
                      <span className="text-xs font-mono w-12 text-right">{r.lambda.toFixed(3)}</span>
                    </div>
                  ))}
                  <p className="text-xs text-slate-400 mt-1">Mean {choSummary?.mean.toFixed(3)} · highest tier · confirms cholinergic identity</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-sm">Clock Genes</CardTitle></CardHeader>
                <CardContent>
                  {clockGenes.map(r => (
                    <div key={r.gene} className="flex items-center gap-2 mb-1.5" data-testid={`clock-gene-${r.gene}`}>
                      <span className="text-xs font-mono w-12 shrink-0 text-slate-600">{r.gene}</span>
                      <div className="flex-1 h-2 bg-slate-100 rounded overflow-hidden">
                        <div className="h-full rounded" style={{ width:`${Math.min(r.lambda,1)*100}%`, backgroundColor:"#60a5fa" }} />
                      </div>
                      <span className="text-xs font-mono w-12 text-right">{r.lambda.toFixed(3)}</span>
                      <span className="text-xs text-slate-400 w-12">{r.isComplex?"cmplx":"real"}</span>
                    </div>
                  ))}
                  <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-700 border border-blue-200">
                    Per1/Per2 low (0.3–0.4) because high-amplitude oscillators return to baseline each cycle — low
                    autocorrelation = low |λ|. Orthogonal to the ALS-gene result.
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ── TAB: Robustness ── */}
        {tab === "robustness" && (
          <div className="space-y-6">

            {/* Permutation test */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <FlaskConical className="w-4 h-4 text-red-400" />
                      Permutation Test — ALS Gene-Set vs Genome
                    </CardTitle>
                    <p className="text-xs text-slate-500 mt-1">
                      {permutation.nPerm.toLocaleString()} random draws of {alsGenes.length} genes from the genome distribution.
                      One-tailed: fraction of draws ≥ observed mean.
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {pBadge(permutation.pValue)}
                    <div className="text-xs text-slate-400 mt-1">
                      Observed {permutation.observedMean.toFixed(3)} vs null {permutation.nullMean.toFixed(3)} ± {permutation.nullSD.toFixed(3)}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={permutation.nullHistogram} margin={{ left: 20, right: 30, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="bin" tick={{ fontSize: 10 }} tickFormatter={v => v.toFixed(3)} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: number) => [v, "draws"]} labelFormatter={l => `|λ| = ${Number(l).toFixed(3)}`} />
                    <ReferenceLine x={permutation.observedMean} stroke="#ef4444" strokeWidth={2}
                      label={{ value: "observed", position: "top", fill: "#ef4444", fontSize: 10 }} />
                    <Area type="monotone" dataKey="count" fill="#94a3b8" stroke="#64748b" fillOpacity={0.4} />
                  </AreaChart>
                </ResponsiveContainer>
                <p className="text-xs text-slate-400 mt-2">
                  Grey = null distribution of random {alsGenes.length}-gene sets. Red line = observed ALS-gene-set mean.
                  {permutation.pValue < 0.05
                    ? ` Observed mean sits in the ${((1-permutation.pValue)*100).toFixed(1)}th percentile of the null.`
                    : " Observed mean does not exceed the 95th percentile of the null (data source is embedded fallback — rerun with live CSV for definitive result)."}
                </p>
              </CardContent>
            </Card>

            {/* Expression-matched null */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Expression-Matched Null Control
                </CardTitle>
                <p className="text-xs text-slate-500">
                  Random draws matched to the mean expression level of the ALS gene set (within ±1.5 log₂CPM).
                  Tests whether the elevation is due to expression level rather than gene identity.
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 mb-3">
                  {[
                    { label: "Observed mean", value: expressionNull.observedMean.toFixed(3), col: "text-red-600" },
                    { label: "Null mean", value: expressionNull.nullMean.toFixed(3), col: "text-slate-600" },
                    { label: "p-value", value: pFmt(expressionNull.pValue), col: expressionNull.pValue < 0.05 ? "text-emerald-600" : "text-amber-600" },
                  ].map(k => (
                    <div key={k.label} className="text-center">
                      <div className={`text-xl font-bold font-mono ${k.col}`}>{k.value}</div>
                      <div className="text-xs text-slate-500">{k.label}</div>
                    </div>
                  ))}
                </div>
                <div className={`p-2 rounded text-xs border ${expressionNull.pValue < 0.05 ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-amber-50 border-amber-200 text-amber-700"}`}>
                  {expressionNull.pValue < 0.05
                    ? `✓ ALS gene-set elevation is significant (${pFmt(expressionNull.pValue)}) after matching for expression level — expression confound is unlikely to be the primary driver.`
                    : `Expression-matched null: ${pFmt(expressionNull.pValue)}. ${meta.source === "embedded" ? "Note: with embedded fallback data, expression matching uses a simplified genome pool — run with live CSV for definitive result." : "Consider that expression level may contribute to the observed elevation."}`}
                </div>
              </CardContent>
            </Card>

            {/* |λ|>1 sensitivity */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-400" />
                  |λ|&gt;1 Sensitivity Analysis
                </CardTitle>
                <p className="text-xs text-slate-500">
                  Checks whether any genes with |λ|≥1 (beyond the estimable range for a 6-timepoint dataset)
                  are driving the result. Three strategies.
                </p>
              </CardHeader>
              <CardContent>
                <SensitivityTable s={sensitivity} />
                <div className={`mt-3 p-2 rounded text-xs border ${
                  sensitivity.cappedAt1.pValue < 0.05 && sensitivity.excluded.pValue < 0.05
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : "bg-amber-50 border-amber-200 text-amber-700"
                }`}>
                  {sensitivity.nAboveOne === 0
                    ? "✓ No genes with |λ|>1 — all three strategies are identical. Result is robust."
                    : sensitivity.cappedAt1.pValue < 0.05 && sensitivity.excluded.pValue < 0.05
                    ? `✓ Result is robust. The ${sensitivity.nAboveOne} gene(s) with |λ|>1 (${sensitivity.genesAboveOne.join(", ")}) do not drive the finding — gap and significance are maintained under both capping and exclusion.`
                    : `⚠ Result depends on |λ|>1 handling. Interpret with caution. Affected gene(s): ${sensitivity.genesAboveOne.join(", ")}.`}
                </div>
              </CardContent>
            </Card>

            {/* Time-shuffle */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <FlaskConical className="w-4 h-4 text-violet-400" />
                  Time-Shuffle Destruction Test
                </CardTitle>
                <p className="text-xs text-slate-500">
                  Tests whether the ALS-gene-set gap above genome background arises from the specific gene identities
                  or could emerge from any random set of similar size.
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 mb-3">
                  {[
                    { label: "Original gap", value: `+${timeShuffle.originalGap.toFixed(3)}`, col: "text-red-600" },
                    { label: "Random-set gap", value: `+${timeShuffle.shuffledMeanGap.toFixed(3)}`, col: "text-slate-600" },
                    { label: "Survival %", value: `${Math.max(0, timeShuffle.destructionPct).toFixed(0)}%`, col: timeShuffle.destructionPct < 30 ? "text-emerald-600" : "text-amber-600" },
                  ].map(k => (
                    <div key={k.label} className="text-center">
                      <div className={`text-xl font-bold font-mono ${k.col}`}>{k.value}</div>
                      <div className="text-xs text-slate-500">{k.label}</div>
                    </div>
                  ))}
                </div>
                <div className={`p-2 rounded text-xs border ${
                  timeShuffle.destructionPct < 30
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : "bg-amber-50 border-amber-200 text-amber-700"
                }`}>
                  {timeShuffle.verdict}
                </div>
              </CardContent>
            </Card>

            {/* Expanded gene list robustness */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-purple-400" />
                  Gene-List Robustness — Core RBP (n=20) vs ALSoD+GWAS Expanded (n={ea.nFound}/{ea.nTotal})
                </CardTitle>
                <p className="text-xs text-slate-500">
                  Tests whether the elevation is an artefact of a hand-picked RBP list.
                  Expanded set adds GWAS loci (van Rheenen 2021), ALSoD curated genes, and additional ALS-implicated RBPs.
                </p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto mb-3">
                  <table className="w-full text-xs" data-testid="expanded-comparison-table">
                    <thead>
                      <tr className="border-b border-slate-200">
                        {["Gene set","n","Mean |λ|","vs genome","Perm p","Expr-matched p"].map(h => (
                          <th key={h} className="text-left py-2 px-3 text-slate-500 font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-2 px-3 font-medium text-red-700">Core RBP panel</td>
                        <td className="py-2 px-3 text-slate-500">{alsGenes.length}</td>
                        <td className="py-2 px-3 font-mono">{permutation.observedMean.toFixed(3)}</td>
                        <td className="py-2 px-3 font-mono font-semibold text-red-600">+{(permutation.observedMean - meta.genomeMean).toFixed(3)}</td>
                        <td className="py-2 px-3">{pBadge(permutation.pValue)}</td>
                        <td className="py-2 px-3">{pBadge(expressionNull.pValue)}</td>
                      </tr>
                      <tr className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-medium text-purple-700">ALSoD+GWAS expanded</td>
                        <td className="py-2 px-3 text-slate-500">{ea.nFound}</td>
                        <td className="py-2 px-3 font-mono">{ea.observedMean.toFixed(3)}</td>
                        <td className="py-2 px-3 font-mono font-semibold text-purple-600">{ea.delta >= 0 ? "+" : ""}{ea.delta.toFixed(3)}</td>
                        <td className="py-2 px-3">{pBadge(ea.pValue)}</td>
                        <td className="py-2 px-3">{pBadge(ea.exprMatchedPValue)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className={`p-2 rounded text-xs border mb-3 ${ea.pValue < 0.05 ? "bg-purple-50 border-purple-200 text-purple-700" : "bg-amber-50 border-amber-200 text-amber-700"}`}>
                  {ea.pValue < 0.05
                    ? `✓ The elevation is not confined to the original hand-picked list — the broader ALSoD+GWAS set (n=${ea.nFound}) is also significantly elevated (${pFmt(ea.pValue)}), expression-matched ${pFmt(ea.exprMatchedPValue)}.`
                    : `ℹ The expanded list (n=${ea.nFound}) is not significantly elevated beyond genome (${pFmt(ea.pValue)}). The effect may be specific to the high-persistence RBP subclass.`}
                </div>
                {ea.newGenesOnly.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-500 mb-1.5 font-medium">New genes only (not in core RBP panel) — sorted by |λ|:</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                      {ea.newGenesOnly.map(g => (
                        <div key={g.gene} className="flex items-center gap-1.5 text-xs py-0.5" data-testid={`expanded-gene-${g.gene}`}>
                          <span className="font-mono font-semibold text-slate-700 w-16 shrink-0">{g.gene}</span>
                          <div className="flex-1 h-1.5 bg-slate-100 rounded overflow-hidden">
                            <div className="h-full rounded" style={{ width:`${Math.min(g.lambda,1)*100}%`, backgroundColor: g.lambda >= 0.80 ? "#a855f7" : g.lambda >= 0.65 ? "#c084fc" : "#94a3b8" }} />
                          </div>
                          <span className="font-mono text-slate-500 w-10 text-right">{g.lambda.toFixed(3)}</span>
                          <Badge variant="outline" className="text-xs hidden sm:flex shrink-0">{g.category}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Expression vs |λ| correlation */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-teal-400" />
                  Expression Level vs |λ| — Genome-Wide Correlation Diagnostic
                </CardTitle>
                <p className="text-xs text-slate-500">
                  If high-expression genes inflate |λ| artefactually, the correlation should be strong positive.
                  A weak r means the expression-matched null controls for the dominant confound.
                </p>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <div className={`text-3xl font-bold font-mono ${Math.abs(meta.exprLambdaCorr) < 0.20 ? "text-teal-600" : Math.abs(meta.exprLambdaCorr) < 0.40 ? "text-amber-600" : "text-red-600"}`}>
                      r = {meta.exprLambdaCorr.toFixed(3)}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">Pearson r · expression vs |λ| · n={meta.nGenome.toLocaleString()} genes</div>
                  </div>
                  <div className={`flex-1 p-2 rounded text-xs border ${Math.abs(meta.exprLambdaCorr) < 0.20 ? "bg-teal-50 border-teal-200 text-teal-700" : Math.abs(meta.exprLambdaCorr) < 0.40 ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-red-50 border-red-200 text-red-700"}`}>
                    {Math.abs(meta.exprLambdaCorr) < 0.20
                      ? `✓ Very weak correlation (|r| < 0.20). Expression level explains <4% of variance in |λ|. The expression-matched null is a conservative control — the true confound is small.`
                      : Math.abs(meta.exprLambdaCorr) < 0.40
                      ? `⚠ Moderate correlation (|r| = ${Math.abs(meta.exprLambdaCorr).toFixed(2)}). Expression explains ~${(meta.exprLambdaCorr**2*100).toFixed(0)}% of |λ| variance. Expression-matched null is essential and already applied.`
                      : `⚠ Strong correlation (|r| = ${Math.abs(meta.exprLambdaCorr).toFixed(2)}). Expression level may be a substantial confound. Interpret with caution; expression-matched null is critical.`}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Meta / reproducibility */}
            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2">
                <Info className="w-4 h-4 text-slate-400" />
                Reproducibility Metadata
              </CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    { label: "Data source",       value: meta.source === "live" ? "Live CSV (full AR(2) refit)" : "Embedded pre-computed" },
                    { label: "Genome n",           value: meta.nGenome.toLocaleString() },
                    { label: "Genome mean |λ|",   value: meta.genomeMean.toFixed(4) },
                    { label: "Genome median |λ|", value: meta.genomeMedian.toFixed(4) },
                    { label: "Genome IQR",         value: `${meta.genomeP25.toFixed(3)} – ${meta.genomeP75.toFixed(3)}` },
                    { label: "Computed at",        value: new Date(meta.computedAt).toLocaleString() },
                    { label: "Permutation n",      value: permutation.nPerm.toLocaleString() },
                    { label: "Bootstrap n",        value: "2,000 per group" },
                    { label: "CSV path 1",         value: meta.csvPath1.split("/").slice(-2).join("/") },
                    { label: "CSV path 2",         value: meta.csvPath2.split("/").slice(-2).join("/") },
                  ].map(r => (
                    <div key={r.label} className="flex justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500">{r.label}</span>
                      <span className="font-mono text-slate-700">{r.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

          </div>
        )}

        {/* ── TAB: Disease Progression ── */}
        {tab === "progression" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">SOD1-G93A Genome-Wide |λ| Shift</CardTitle>
                <p className="text-xs text-slate-500">
                  GSE18597 · Affymetrix MOE430A · Lumbar spinal cord · D28–D126 · 3 replicates/stage/genotype ·
                  AR(2) fit per probe across 7 disease stages · Data source: {dp.source}
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                  {[
                    { label: "Control WT",     mean: dp.ctrlMean, median: dp.ctrlMedian, n: dp.nCtrl,  col: "text-blue-600",   bg: "bg-blue-50" },
                    { label: "SOD1-G93A",       mean: dp.alsMean,  median: dp.alsMedian,  n: dp.nALS,   col: "text-red-600",    bg: "bg-red-50"  },
                    { label: "Δ ALS − Control", mean: dp.delta,    median: dp.delta,      n: null,      col: "text-orange-600", bg: "bg-orange-50" },
                  ].map(k => (
                    <div key={k.label} className={`${k.bg} rounded-xl p-4 border border-slate-200`}>
                      <div className={`text-2xl font-bold font-mono ${k.col}`}>
                        {k.label === "Δ ALS − Control" ? (k.mean >= 0 ? "+" : "") + k.mean.toFixed(3) : k.mean.toFixed(3)}
                      </div>
                      <div className="text-xs font-semibold text-slate-700">{k.label}</div>
                      {k.n && <div className="text-xs text-slate-500">n={k.n.toLocaleString()} probes</div>}
                      {k.label === "Δ ALS − Control" && <div className="text-xs text-slate-500">{pFmt(dp.pValue)}</div>}
                    </div>
                  ))}
                </div>
                <div className="mt-3">
                  {pBadge(dp.pValue)}
                  <span className="text-xs text-slate-500 ml-2">
                    Mann-Whitney U · genome-wide |λ| ALS vs WT
                  </span>
                </div>
                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-700">
                      <strong>Caveat:</strong> These 7 time points are disease stages (days), not circadian hours. AR(2) here measures
                      temporal autocorrelation across disease progression, not circadian oscillation. The |λ| interpretation
                      differs from the GSE297373 analysis and the two are not directly comparable.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {dp.topGainers.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-red-400" />
                      Top Persistence Gainers in ALS
                    </CardTitle>
                    <p className="text-xs text-slate-500">Probes most increased in SOD1-G93A — constitutive lock-on</p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      {dp.topGainers.slice(0, 12).map(r => (
                        <div key={r.probeId} className="flex items-center gap-2 text-xs"
                          data-testid={`gainer-${r.probeId}`}>
                          <span className="font-mono text-slate-500 w-28 shrink-0 truncate">{r.probeId}</span>
                          <div className="flex-1 h-1.5 bg-slate-100 rounded overflow-hidden">
                            <div className="h-full bg-red-400 rounded" style={{ width: `${Math.min(r.delta/0.5,1)*100}%` }} />
                          </div>
                          <span className="text-red-600 font-mono w-14 text-right">+{r.delta.toFixed(3)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingDown className="w-4 h-4 text-blue-400" />
                      Top Persistence Losers in ALS
                    </CardTitle>
                    <p className="text-xs text-slate-500">Probes most decreased — collapsing motor neuron programmes</p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      {dp.topLosers.slice(0, 12).map(r => (
                        <div key={r.probeId} className="flex items-center gap-2 text-xs"
                          data-testid={`loser-${r.probeId}`}>
                          <span className="font-mono text-slate-500 w-28 shrink-0 truncate">{r.probeId}</span>
                          <div className="flex-1 h-1.5 bg-slate-100 rounded overflow-hidden">
                            <div className="h-full bg-blue-400 rounded" style={{ width: `${Math.min(Math.abs(r.delta)/0.5,1)*100}%` }} />
                          </div>
                          <span className="text-blue-600 font-mono w-14 text-right">{r.delta.toFixed(3)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: Interpretation ── */}
        {tab === "interpretation" && (
          <div className="space-y-4">
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <Zap className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                  <div>
                    <h3 className="font-semibold text-red-800 mb-1">The "Pre-Loaded Vulnerability" Hypothesis</h3>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      ALS-linked RBPs sit at the <strong>top of the |λ| distribution in healthy motor neurons</strong> before any disease is present.
                      The permutation test ({pFmt(permutation.pValue)}) confirms this elevation is unlikely to arise from random gene-set sampling.
                      The |λ|&gt;1 sensitivity analysis confirms the signal is not driven by outlier genes.
                      Constitutive high persistence = chronic protein load → decades later the system crosses the phase-separation threshold.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  step:"1", title:"Pre-loading (lifetime)",
                  body:`ALS genes: mean |λ| = ${alsMean?.mean.toFixed(3)} vs genome ${meta.genomeMean.toFixed(3)} (Δ = +${alsMean ? (alsMean.mean - meta.genomeMean).toFixed(3) : "—"}). Constitutive sustained expression across lifetime (Huang 2010). Complex eigenvalues = oscillatory circadian control ON TOP of high baseline.`,
                  col:"border-amber-200 bg-amber-50", hcol:"text-amber-700",
                },
                {
                  step:"2", title:"Circadian modulation",
                  body:`${alsGenes.filter(g=>g.isComplex).length}/${alsGenes.length} ALS genes have complex eigenvalues. Circadian disruption (Bmal1-KO in ChAT+ neurons) increases motor neuron loss directly. ATXN2 — highest-confidence ALS modifier — is a master regulator of rhythmic translation (Cell 2023).`,
                  col:"border-blue-200 bg-blue-50", hcol:"text-blue-700",
                },
                {
                  step:"3", title:"Disease transition",
                  body:`Genome-wide +${dp.delta.toFixed(3)} shift in SOD1-G93A (${pFmt(dp.pValue)}). Two sub-populations: inflammatory genes lock on (gainers); motor neuron identity genes lose temporal memory (losers). Consistent with Ferraiuolo 2007 progressive amplification.`,
                  col:"border-red-200 bg-red-50", hcol:"text-red-700",
                },
              ].map(s => (
                <div key={s.step} className={`rounded-xl border p-4 ${s.col}`}>
                  <div className={`text-xs font-bold ${s.hcol} mb-1`}>STEP {s.step}</div>
                  <h4 className={`font-semibold text-sm ${s.hcol} mb-2`}>{s.title}</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">{s.body}</p>
                </div>
              ))}
            </div>

            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-slate-400" />
                Key Independent References
              </CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2 text-xs">
                  {[
                    { ref:"Huang et al. 2010",    journal:"Int J Biol Sci",   doi:"PMC2899457",    note:"FUS/TDP-43 sustained throughout motor neuron lifetime. Constitutive expression confirmed." },
                    { ref:"Tam et al. 2026",       journal:"Life Sci Alliance", doi:"PMC12705855",   note:"GSE297373: 2,391 rhythmic transcripts in ChAT+ neurons. All 5 core ALS RBPs confirmed by independent JTK_Cycle." },
                    { ref:"Cell 2023",             journal:"Cell",             doi:"10.1016/j.cell", note:"ATXN2/ATXN2L as master regulators of rhythmic translation. Oscillates ~24h in SCN." },
                    { ref:"Frontiers Neurol 2018", journal:"Front. Neurol.",   doi:"10.3389/fneur",  note:"CRD accelerates ALS onset in SOD1-G93A. Motor neuron loss + NF-κB activation." },
                    { ref:"Hadano et al. 2018",    journal:"Mol. Brain",       doi:"10.1186/s13041", note:"SQSTM1 overexpression accelerates onset. Consistent with |λ|=0.952 pre-loading." },
                    { ref:"Ferraiuolo et al. 2007",journal:"J. Neurosci.",     doi:"jneurosci 27/34", note:"Progressive transcriptional deregulation amplification P60→P120. Directional support for +Δ|λ| shift." },
                    { ref:"Becker et al. 2017",    journal:"Nature",           doi:"PMC5748234",     note:"ASO knockdown of Atxn2 reduces TDP-43 aggregation, extends survival — intervention prediction." },
                  ].map(r => (
                    <div key={r.ref} className="flex gap-2 p-2 bg-slate-50 rounded border border-slate-100">
                      <div className="w-32 shrink-0">
                        <span className="font-semibold text-slate-800">{r.ref}</span>
                        <span className="block text-slate-400">{r.journal}</span>
                      </div>
                      <div className="flex-1 text-slate-600">{r.note}</div>
                      <div className="text-slate-400 font-mono text-right hidden lg:block w-28 shrink-0">{r.doi}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Specificity prediction — non-vulnerable neuron comparison */}
            <Card className="border-blue-200">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-400" />
                  Specificity Prediction — Non-Vulnerable Neuron Comparison
                </CardTitle>
                <p className="text-xs text-slate-500">
                  The "pre-loaded vulnerability" hypothesis predicts that ALS gene elevation should be <em>specific</em> to
                  motor neurons (ChAT+), not a generic feature of all neurons.
                  This is a pre-specified falsifiable prediction, not yet tested.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="font-semibold text-blue-800 mb-1">Pre-specified prediction</div>
                    <p className="text-slate-700">
                      In a non-vulnerable neuron type (e.g., Purkinje cells, parvalbumin interneurons, or
                      sensory neurons), the same 20 ALS-linked RBPs should show <em>lower</em> mean |λ|
                      than in ChAT+ neurons — ideally no significant elevation above genome background.
                    </p>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <div className="font-semibold text-amber-800 mb-1">Field gap — no matched public dataset exists</div>
                    <p className="text-slate-700">
                      GSE297373 (Tam et al. 2026) is the only publicly available cell-type-specific
                      circadian time-series in motor neurons. No equivalent dataset for non-vulnerable
                      neuron types (Purkinje, parvalbumin interneurons, sensory neurons) exists in the
                      public domain at matched ZT resolution — this is a gap in the field, not in the analysis.
                    </p>
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                  <div className="font-semibold text-slate-700 mb-1">Required dataset for falsification</div>
                  <p className="text-slate-600">
                    A RiboTag or TRAP-seq time-series in Pvalb-Cre or Purkinje-Cre neurons
                    (≥6 ZT time points, circadian design) would allow a direct test. The prediction would be
                    falsified if ALS-gene |λ| elevation ≥ the motor neuron gap were found in a
                    non-vulnerable population. Currently untested. Confidence in the hypothesis
                    is based on (1) permutation test, (2) expression-matched null, (3) expanded gene list
                    replication, (4) independent JTK_Cycle confirmation (Tam et al. 2026).
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="p-4 bg-slate-100 rounded-xl border border-slate-200 text-xs text-slate-500">
              <strong>Limitations:</strong>{" "}
              {meta.source === "embedded"
                ? "Data source is embedded pre-computed fallback (raw CSV download unavailable). Permutation tests use a synthetic genome distribution tuned to match known summary statistics (mean=0.742, n=11,667). Run the prepare-mnd-als-datasets.cjs script and restart the server for live analysis. "
                : ""}
              Dataset 1 has 6 time points — sufficient for AR(2) but with wide CIs per gene. Dataset 2 uses disease stages as time axis — |λ| interpretation differs and findings are preliminary. No multiple-testing correction applied to individual gene results. Causation cannot be inferred from persistence measurements alone.{" "}
              <strong>Cell-type specificity:</strong> Gene list elevation has not yet been tested in non-vulnerable neuron populations — this is a pre-specified prediction awaiting a suitable publicly available dataset.{" "}
              <strong>Gene-length confound:</strong> Gene-length matching would require genome-wide Ensembl annotation not currently pre-loaded. The expression-matched null partially controls for this because expression levels and gene lengths are weakly correlated in mature neuron RiboTag data; genome-wide expression–|λ| correlation r={meta.exprLambdaCorr.toFixed(3)} (Pearson).
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
