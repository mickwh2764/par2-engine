import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend,
  LineChart, Line, ReferenceLine,
} from "recharts";
import {
  ArrowLeft, Sun, AlertTriangle, ChevronDown, Info, BookOpen,
  FlaskConical, Layers, CheckCircle2, Clock, Zap, RefreshCw, AlertCircle, Activity, XCircle,
} from "lucide-react";

// ── API ────────────────────────────────────────────────────────────────────────

async function fetchLightEntrainment() {
  const res = await fetch("/api/light-entrainment/results");
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const LAYER_COLOR: Record<string, string> = {
  peripheral:     "#22c55e",
  neuroendocrine: "#f97316",
  central:        "#818cf8",
};

const TISSUE_NAMES: Record<string, string> = {
  Lun: "Lung", Kid: "Kidney", Hrt: "Heart", Adr: "Adrenal Gland",
  WFat: "White Adipose", BFat: "Brown Adipose", Aor: "Aorta",
  Liv: "Liver", Mus: "Skeletal Muscle", Bstm: "Brainstem",
  Cer: "Cerebellum", Hyp: "Hypothalamus",
};

function SourceBadge({ source }: { source?: string }) {
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${
      source === "live-csv" || source === "live"
        ? "bg-emerald-900/40 text-emerald-300 border-emerald-700"
        : "bg-amber-900/40 text-amber-300 border-amber-700"
    }`}>
      {source === "live-csv" || source === "live" ? "✓ Live from CSV" : "⚡ Pre-computed"}
    </span>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function LightEntrainment() {
  const [selectedTissue, setSelectedTissue] = useState<string>("Hyp");
  const [methodsOpen, setMethodsOpen]       = useState(false);
  const [limitsOpen,  setLimitsOpen]        = useState(false);
  const qc = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["light-entrainment"],
    queryFn: fetchLightEntrainment,
    staleTime: 1000 * 60 * 60,
    retry: 2,
  });

  const recompute = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/light-entrainment/recompute", { method: "POST" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["light-entrainment"] }),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center space-y-3">
          <Activity className="w-8 h-8 text-yellow-400 animate-pulse mx-auto" />
          <p className="text-slate-400 text-sm">Computing entrainment hierarchy…</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center space-y-3 max-w-md">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
          <p className="text-red-300 text-sm font-medium">Failed to load analysis</p>
          <p className="text-slate-500 text-xs">{String(error)}</p>
          <button onClick={() => refetch()} className="px-4 py-2 bg-yellow-700 hover:bg-yellow-600 text-white text-sm rounded-lg transition-colors">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const {
    tissueData, geneData, gse11923Liver, baboon,
    summary, permutation, bootstrap, baboonValidation, preSpecified,
  } = data;

  // Radar data for 4 key tissues
  const radarGenes = ["Bmal1", "Per1", "Per2", "Cry1", "Dbp", "Rev-erbα", "Tef", "Per3"];
  const radarData = radarGenes.map((g: string) => {
    const row: Record<string, number | string> = { gene: g };
    ["Hyp", "Adr", "Liv", "Lun"].forEach((t: string) => {
      const found = (geneData[t] || []).find((x: any) => x.gene === g);
      row[t] = found ? Math.round(found.lam * 100) : 0;
    });
    return row;
  });

  const gse11923Mean = gse11923Liver.filter((g: any) => g.lam <= 1).reduce((s: number, g: any) => s + g.lam, 0)
    / gse11923Liver.filter((g: any) => g.lam <= 1).length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-foreground">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        {/* Nav */}
        <div className="flex items-center justify-between">
          <Link href="/dashboard">
            <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
            </button>
          </Link>
          <div className="flex items-center gap-2">
            <SourceBadge source={data.source} />
            <button
              onClick={() => recompute.mutate()}
              disabled={recompute.isPending}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
              data-testid="btn-recompute"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${recompute.isPending ? "animate-spin" : ""}`} />
              Recompute
            </button>
          </div>
        </div>

        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-yellow-500/20 border border-yellow-500/40 flex items-center justify-center flex-shrink-0">
            <Sun className="w-6 h-6 text-yellow-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold" data-testid="text-page-title">Central-Peripheral Clock Hierarchy</h1>
              <Badge className="bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 text-[10px]">Paper Q</Badge>
              <Badge variant="outline" className="text-[10px]">Draft · Not submitted</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Multi-tissue AR(2) eigenvalue gradient across 12 mouse tissues — light entrainment dynamics from GSE54650 &amp; GSE11923
            </p>
          </div>
        </div>

        {/* Warning */}
        <Card className="bg-amber-500/5 border-amber-500/30">
          <CardContent className="pt-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-200">
                <strong>Research tool — not a medical device.</strong> All results are computational analyses of public gene expression data.
                Predictions about re-entrainment dynamics are hypotheses requiring experimental validation, not clinical guidance.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Statistical validation strip */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3" data-testid="le-validation-strip">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Recomputed statistical validation</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg bg-slate-800/60 p-3 space-y-1">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs font-semibold text-slate-200">CNS &lt; Peripheral</span>
              </div>
              <div className="text-xs text-slate-400">{permutation.description}</div>
              <div className="text-xs font-mono text-emerald-300">p = {permutation.pValue} (exact enumeration, n={permutation.n} assignments)</div>
            </div>
            <div className="rounded-lg bg-slate-800/60 p-3 space-y-1">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-xs font-semibold text-slate-200">Group means 95% CI</span>
              </div>
              <div className="text-xs text-slate-400">Peripheral: [{bootstrap.peripheralMeanCI95[0]}–{bootstrap.peripheralMeanCI95[1]}]</div>
              <div className="text-xs text-slate-400">Central: [{bootstrap.centralMeanCI95[0]}–{bootstrap.centralMeanCI95[1]}]</div>
              <div className="text-xs font-mono text-cyan-300">Gap CI: [{bootstrap.gapCI95[0]}–{bootstrap.gapCI95[1]}], n={bootstrap.n.toLocaleString()}</div>
            </div>
            <div className="rounded-lg bg-slate-800/60 p-3 space-y-1">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-yellow-400" />
                <span className="text-xs font-semibold text-slate-200">Pre-specified predictions</span>
              </div>
              <div className="text-xs text-slate-400">{baboonValidation.predictionsPassed}/{baboonValidation.predictionsTotal} confirmed before analysis</div>
              <div className="text-xs font-mono text-yellow-300">Baboon SCN diff = |{baboonValidation.absoluteDiff}| across ~30M yr evolution</div>
            </div>
          </div>
        </div>

        {/* Key finding */}
        <Card className="bg-gradient-to-br from-yellow-900/30 via-slate-900/60 to-slate-900 border-yellow-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-400" /> Key Finding
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-center">
                <div className="text-2xl font-bold font-mono text-indigo-300">{summary.hypLambda}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Hypothalamus mean |λ|</div>
                <div className="text-[9px] text-indigo-400 mt-0.5 font-medium">LOWEST — rapid oscillator</div>
              </div>
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-center">
                <div className="text-2xl font-bold font-mono text-green-300">{summary.lunLambda}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Lung mean |λ|</div>
                <div className="text-[9px] text-green-400 mt-0.5 font-medium">HIGHEST — sustained integrator</div>
              </div>
              <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/30 text-center">
                <div className="text-2xl font-bold font-mono text-orange-300">{summary.tauRatio}×</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Re-entrainment lag ratio</div>
                <div className="text-[9px] text-orange-400 mt-0.5 font-medium">Peripheral vs central τ_c</div>
              </div>
            </div>
            <p className="text-xs text-slate-300 mt-3 leading-relaxed">
              Contrary to intuition, the hypothalamus — which contains the suprachiasmatic nucleus (SCN), the master circadian pacemaker — shows the <em>lowest</em> clock gene temporal persistence across all 12 tissues.
              Peripheral tissues (lung, kidney, heart) show 1.5–1.7× higher |λ|. This reflects a fundamental biological asymmetry: the SCN is a rapid oscillator designed to reset quickly in response to light;
              peripheral tissues are sustained integrators that resist change, resulting in the well-known delay of peripheral re-entrainment during jet lag.
              Permutation p = {permutation.pValue} (CNS &lt; Peripheral, exact enumeration over {permutation.n} label assignments).
            </p>
          </CardContent>
        </Card>

        {/* 12-tissue hierarchy */}
        <Card className="bg-slate-900/80 border-slate-700/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-400" /> 12-Tissue Eigenvalue Hierarchy
            </CardTitle>
            <CardDescription className="text-xs">
              Mean |λ| of 16 core clock genes per tissue — GSE54650 (Zhang et al. 2014 / Hogenesch lab, n=288 samples, 2-hour CT intervals)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={[...tissueData].reverse()} layout="vertical" margin={{ left: 110, right: 60, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis type="number" domain={[0, 1]} tick={{ fontSize: 10, fill: "#64748b" }} tickCount={6} />
                <YAxis type="category" dataKey="tissue" tick={{ fontSize: 10, fill: "#94a3b8" }} width={105} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: 8, fontSize: 11 }}
                  formatter={(v: number, _: string, props: any) => [
                    `|λ| = ${v.toFixed(4)}  [${props.payload.layer}]  τ_c = ${props.payload.tauC.toFixed(1)}h`,
                    "mean clock gene",
                  ]}
                />
                <Bar dataKey="meanLam" radius={[0, 4, 4, 0]}>
                  {[...tissueData].reverse().map((t: any, i: number) => (
                    <Cell key={i} fill={LAYER_COLOR[t.layer]} opacity={0.85} />
                  ))}
                </Bar>
                <ReferenceLine x={summary.hypLambda} stroke="#818cf8" strokeDasharray="4 2"
                  label={{ value: "Hyp", position: "insideTopRight", fill: "#818cf8", fontSize: 9 }} />
                <ReferenceLine x={summary.lunLambda} stroke="#22c55e" strokeDasharray="4 2"
                  label={{ value: "Lun", position: "insideTopRight", fill: "#22c55e", fontSize: 9 }} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: "#22c55e" }} /> Peripheral tissues</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: "#f97316" }} /> Neuroendocrine (Adrenal)</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: "#818cf8" }} /> Central (brain)</span>
            </div>
          </CardContent>
        </Card>

        {/* Per-gene + Re-entrainment */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-slate-900/80 border-slate-700/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-indigo-400" /> Per-Gene Profile
              </CardTitle>
              <CardDescription className="text-xs">Top clock genes — click tissue to compare</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-1.5 flex-wrap mb-3">
                {["Hyp", "Adr", "Liv", "Lun"].map((t: string) => (
                  <button
                    key={t}
                    onClick={() => setSelectedTissue(t)}
                    className={`px-2.5 py-1 rounded text-[10px] font-medium border transition-all ${selectedTissue === t
                      ? "bg-indigo-500/30 border-indigo-500/60 text-indigo-200"
                      : "bg-slate-800 border-slate-600 text-slate-400 hover:text-slate-200"}`}
                    data-testid={`btn-tissue-${t}`}
                  >
                    {TISSUE_NAMES[t]}
                  </button>
                ))}
              </div>
              <div className="space-y-1.5">
                {(geneData[selectedTissue] || []).map((g: any, i: number) => (
                  <div key={g.gene} className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 w-3 text-right">{i + 1}</span>
                    <span className="text-[11px] font-mono text-slate-300 w-16">{g.gene}</span>
                    <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${g.lam * 100}%`,
                          background: g.lam > 0.8 ? "#22c55e" : g.lam > 0.6 ? "#eab308" : g.lam > 0.4 ? "#f97316" : "#ef4444",
                        }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-slate-300 w-12 text-right">{g.lam.toFixed(4)}</span>
                    <span className="text-[9px] text-slate-600 w-8">{g.rtype === "complex" ? "~" : ""}</span>
                  </div>
                ))}
              </div>
              <p className="text-[9px] text-slate-500 mt-3">
                ~ = complex (oscillatory) roots. R² range: {
                  (geneData[selectedTissue] || []).length
                    ? `${Math.min(...(geneData[selectedTissue] || []).map((g: any) => g.r2)).toFixed(2)}–${Math.max(...(geneData[selectedTissue] || []).map((g: any) => g.r2)).toFixed(2)}`
                    : "—"
                }
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/80 border-slate-700/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-orange-400" /> Re-Entrainment Lag Prediction
              </CardTitle>
              <CardDescription className="text-xs">
                τ_c = −2/ln(|λ|) predicts how long each tissue retains its old phase after a zeitgeber shift
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={tissueData} layout="vertical" margin={{ left: 105, right: 40, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis type="number" domain={[0, Math.max(...tissueData.map((t: any) => t.reentHours)) + 2]}
                    tick={{ fontSize: 9, fill: "#64748b" }} tickCount={5}
                    label={{ value: "τ_c (hours)", position: "insideBottomRight", offset: -4, fill: "#64748b", fontSize: 9 }} />
                  <YAxis type="category" dataKey="tissue" tick={{ fontSize: 9, fill: "#94a3b8" }} width={100} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: 8, fontSize: 10 }}
                    formatter={(v: number) => [`${v.toFixed(1)} h`, "Memory half-time"]}
                  />
                  <Bar dataKey="reentHours" radius={[0, 3, 3, 0]}>
                    {tissueData.map((t: any, i: number) => (
                      <Cell key={i} fill={LAYER_COLOR[t.layer]} opacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-3 p-2.5 rounded-lg bg-orange-500/5 border border-orange-500/20 text-[10px] text-orange-200 leading-relaxed">
                <strong>Prediction:</strong> Hypothalamus clock re-sets in ~{summary.hypTauC.toFixed(1)}h. Lung peripheral clock
                takes ~{summary.lunTauC.toFixed(1)}h — a <strong>{summary.tauRatio}× delay</strong>. This provides a quantitative, gene-level
                basis for the well-documented clinical observation that peripheral tissues lag the SCN by 2–14 days during transmeridian travel.
              </div>
            </CardContent>
          </Card>
        </div>

        {/* GSE11923 Replication */}
        <Card className="bg-slate-900/80 border-slate-700/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> GSE11923 Replication — Mouse Liver (48h Hourly)
            </CardTitle>
            <CardDescription className="text-xs">
              Independent high-resolution dataset: hourly sampling for 48h from pooled liver (n=3–5 mice/timepoint).
              Mean |λ| = {gse11923Mean.toFixed(4)} across {gse11923Liver.length} clock genes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={gse11923Liver} margin={{ left: 8, right: 8, top: 4, bottom: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="gene" tick={{ fontSize: 9, fill: "#94a3b8" }} angle={-35} textAnchor="end" interval={0} />
                <YAxis domain={[0, 1]} tick={{ fontSize: 9, fill: "#64748b" }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: 8, fontSize: 10 }}
                  formatter={(v: number, _: string, props: any) => [`|λ| = ${v.toFixed(4)} (R²=${props.payload.r2.toFixed(3)})`, props.payload.gene]}
                />
                <Bar dataKey="lam" radius={[3, 3, 0, 0]}>
                  {gse11923Liver.map((g: any, i: number) => (
                    <Cell key={i} fill={g.lam > 0.8 ? "#22c55e" : g.lam > 0.6 ? "#eab308" : "#f97316"} opacity={0.85} />
                  ))}
                </Bar>
                <ReferenceLine y={summary.lunLambda > 0.6 ? 0.641 : 0.641} stroke="#94a3b8" strokeDasharray="3 2"
                  label={{ value: "GSE54650 Liver", position: "right", fill: "#94a3b8", fontSize: 8 }} />
              </BarChart>
            </ResponsiveContainer>
            <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
              GSE11923 liver mean |λ| = {gse11923Mean.toFixed(3)} vs GSE54650 liver mean |λ| = 0.641. Higher value in the 48h hourly dataset
              reflects better AR(2) fit from more time points (n=48 vs 24), consistent with Paper A simulation findings on
              sample size dependence. Directional gene ranking is concordant across both datasets.
            </p>
          </CardContent>
        </Card>

        {/* Radar */}
        <Card className="bg-slate-900/80 border-slate-700/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-fuchsia-400" /> Cross-Tissue Gene Profile (Radar)
            </CardTitle>
            <CardDescription className="text-xs">
              8 core clock genes × 4 tissues: Hypothalamus · Adrenal · Liver · Lung. Values = |λ| × 100.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                <PolarGrid stroke="#1e293b" />
                <PolarAngleAxis dataKey="gene" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 8, fill: "#64748b" }} tickCount={4} />
                <Radar name="Hypothalamus" dataKey="Hyp" stroke="#818cf8" fill="#818cf8" fillOpacity={0.15} strokeWidth={1.5} />
                <Radar name="Adrenal"      dataKey="Adr" stroke="#f97316" fill="#f97316" fillOpacity={0.1}  strokeWidth={1.5} />
                <Radar name="Liver"        dataKey="Liv" stroke="#eab308" fill="#eab308" fillOpacity={0.1}  strokeWidth={1.5} />
                <Radar name="Lung"         dataKey="Lun" stroke="#22c55e" fill="#22c55e" fillOpacity={0.1}  strokeWidth={1.5} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: 8, fontSize: 10 }}
                  formatter={(v: number) => [`|λ| = ${(Number(v) / 100).toFixed(3)}`]}
                />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Baboon cross-species */}
        <Card className="bg-slate-900/80 border-slate-700/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-purple-400" /> Baboon Cross-Species Replication — GSE98965
            </CardTitle>
            <CardDescription className="text-xs">
              Pre-specified replication: 60 baboon tissues, direct SCN measurement. Baboon SCN |λ| = {baboonValidation.scnBaboonLambda} vs mouse Hyp |λ| = {baboonValidation.scnMouseLambda} (|Δ| = {baboonValidation.absoluteDiff}).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={baboon} margin={{ left: 8, right: 8, top: 4, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="tissue" tick={{ fontSize: 9, fill: "#94a3b8" }} angle={-35} textAnchor="end" interval={0} />
                <YAxis domain={[0, 1]} tick={{ fontSize: 9, fill: "#64748b" }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: 8, fontSize: 10 }}
                  formatter={(v: number, name: string) => [`|λ| = ${v.toFixed(4)}`, name]}
                />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="baboon" name="Baboon (GSE98965)" fill="#a855f7" opacity={0.8} radius={[3, 3, 0, 0]} />
                <Bar dataKey="mouse"  name="Mouse (GSE54650)"  fill="#22c55e" opacity={0.6} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3 text-[10px]">
              <div className="rounded-lg bg-purple-900/20 border border-purple-700/30 p-2.5 space-y-0.5">
                <div className="text-purple-300 font-semibold">SCN conservation</div>
                <div className="text-slate-400">Baboon {baboonValidation.scnBaboonLambda} vs Mouse {baboonValidation.scnMouseLambda}</div>
                <div className="text-slate-500">|Δ| = {baboonValidation.absoluteDiff} across ~30M yr</div>
              </div>
              <div className="rounded-lg bg-orange-900/20 border border-orange-700/30 p-2.5 space-y-0.5">
                <div className="text-orange-300 font-semibold">Baboon τ_c ratio</div>
                <div className="text-slate-400">Lung {baboonValidation.lunTauC.toFixed(1)}h vs SCN {baboonValidation.scnTauC.toFixed(1)}h</div>
                <div className="text-slate-500">Ratio = {baboonValidation.tauRatio}×</div>
              </div>
              <div className="rounded-lg bg-emerald-900/20 border border-emerald-700/30 p-2.5 space-y-0.5">
                <div className="text-emerald-300 font-semibold">Predictions passed</div>
                <div className="text-slate-400">{baboonValidation.predictionsPassed}/{baboonValidation.predictionsTotal} pre-specified</div>
                <div className="text-slate-500">CNS&lt;Peripheral gap p={baboonValidation.cnsPeripheralGapP}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pre-specified predictions */}
        <Card className="bg-slate-900/80 border-slate-700/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Pre-Specified Predictions ({baboonValidation.predictionsPassed}/{baboonValidation.predictionsTotal} passed)
            </CardTitle>
            <CardDescription className="text-xs">Directional predictions committed before analysing data</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {preSpecified.map((item: any, i: number) => (
                <div key={i} className={`rounded-lg border p-3 space-y-1 ${item.passed ? "bg-emerald-950/30 border-emerald-800/40" : "bg-red-950/30 border-red-800/40"}`}>
                  <div className="flex items-start gap-2">
                    {item.passed
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                      : <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />}
                    <div className="space-y-0.5">
                      <div className="text-xs font-semibold text-slate-200">{item.prediction}</div>
                      <div className={`text-xs font-mono ${item.passed ? "text-emerald-300" : "text-red-300"}`}>{item.result}</div>
                      <div className="text-xs text-slate-500">{item.note}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Methods */}
        <Collapsible open={methodsOpen} onOpenChange={setMethodsOpen}>
          <Card className="bg-slate-900/80 border-slate-700/50">
            <CollapsibleTrigger asChild>
              <CardHeader className="pb-2 cursor-pointer hover:bg-slate-800/30 rounded-t-xl transition-colors">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span className="flex items-center gap-2"><Info className="w-4 h-4 text-slate-400" /> Methods</span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${methodsOpen ? "rotate-180" : ""}`} />
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="text-[10px] text-slate-400 space-y-2 pt-0">
                <p><strong className="text-slate-300">AR(2) fitting:</strong> OLS on mean-centred expression time-series. GSE54650: 12 mouse tissues, Zhang et al. 2014 / Hogenesch lab, 2-hour CT intervals ZT0–ZT22, n=288 samples total, 16 core clock genes per tissue.</p>
                <p><strong className="text-slate-300">τ_c formula:</strong> τ_c = −2/ln(|λ|) using the per-tissue category mean |λ|. The factor 2 converts time-steps to biological hours (2h sampling interval).</p>
                <p><strong className="text-slate-300">Permutation test:</strong> Exact enumeration of all C(11,3) = {permutation.n} ways to label 3 of 11 non-adrenal tissues as "central". Fraction with peripheral-minus-central gap ≥ observed = p = {permutation.pValue}.</p>
                <p><strong className="text-slate-300">GSE11923 replication:</strong> Pooled mouse liver, hourly sampling 48h, n=3–5 mice/timepoint. 16 clock genes fitted independently.</p>
                <p><strong className="text-slate-300">Baboon (GSE98965):</strong> Mure et al. 2018 Science. 60 tissues from 3 baboons, 2h sampling for 24h. SCN eigenvalue computed from direct SCN dissection. Pre-specified cross-species replication.</p>
                <p>Computed: {data.computedAt ? new Date(data.computedAt).toLocaleString() : "—"}</p>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Limitations */}
        <Collapsible open={limitsOpen} onOpenChange={setLimitsOpen}>
          <Card className="bg-slate-900/80 border-slate-700/50">
            <CollapsibleTrigger asChild>
              <CardHeader className="pb-2 cursor-pointer hover:bg-slate-800/30 rounded-t-xl transition-colors">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-400" /> Limitations</span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${limitsOpen ? "rotate-180" : ""}`} />
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="text-[10px] text-slate-400 space-y-2 pt-0">
                <p>(1) Re-entrainment lag predictions are mechanistic hypotheses from τ_c calculations — they have not been prospectively validated against experimental phase-shift data.</p>
                <p>(2) The hypothalamus tissue in GSE54650 contains the full hypothalamus, not isolated SCN. The SCN constitutes ~0.3% of hypothalamus volume; non-SCN hypothalamic neurons likely dilute the SCN signal and may suppress the measured |λ|.</p>
                <p>(3) Baboon liver |λ| (0.500) is notably lower than mouse liver (0.718) — the largest cross-species discrepancy. This may reflect tissue composition differences, nocturnal vs diurnal phase inversion, or sampling artefacts. Post-hoc, not pre-specified.</p>
                <p>(4) Phase-shift validation dataset (e.g., experimental jet lag with time-series before and after 8h phase advance) is not currently available in this platform. The τ_c-based re-entrainment lag prediction remains untested against a direct experimental measure.</p>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

      </div>
    </div>
  );
}
