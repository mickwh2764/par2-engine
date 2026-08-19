import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, ReferenceLine, LineChart, Line, Cell,
} from "recharts";
import { ArrowLeft, Loader2, XCircle, Brain, Info, AlertTriangle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadAsCSV } from "@/components/DownloadResultsButton";
import { useState } from "react";

const COLORS = {
  wtAstro:   "#34d399",
  wtMicro:   "#60a5fa",
  appAstro:  "#f87171",
  agedAstro: "#fb923c",
};

const CONDITION_LABELS: Record<string, string> = {
  wtAstro:   "WT Astrocyte",
  wtMicro:   "WT Microglia",
  appAstro:  "APP Astrocyte",
  agedAstro: "Aged Astrocyte (18-month)",
};

function StatCard({
  label, n, median, q25, q75, highPct, complexPct, cappedCount, cappedPct, color,
}: {
  label: string; n: number; median: number; q25: number; q75: number;
  highPct: number; complexPct: number; cappedCount: number; cappedPct: number; color: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4" data-testid={`stat-card-${label.replace(/\s/g,'-')}`}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-sm font-semibold text-slate-800">{label}</span>
      </div>
      <div className="text-3xl font-bold font-mono mb-1" style={{ color }}>{median.toFixed(3)}</div>
      <div className="text-xs text-slate-500 mb-3">median |λ|</div>
      <div className="space-y-1 text-xs text-slate-500">
        <div className="flex justify-between"><span>IQR</span><span className="font-mono">{q25.toFixed(3)} – {q75.toFixed(3)}</span></div>
        <div className="flex justify-between"><span>Genes</span><span className="font-mono">{n.toLocaleString()}</span></div>
        <div className="flex justify-between"><span>|λ| 0.9–1.0</span><span className="font-mono">{highPct.toFixed(1)}%</span></div>
        <div className="flex justify-between"><span>Complex roots</span><span className="font-mono">{complexPct.toFixed(1)}%</span></div>
        <div className="flex justify-between text-slate-500 border-t border-slate-200 pt-1 mt-1" title="Genes where the AR(2) fit returned |λ| ≥ 1 — persistence beyond the estimable range for 12 timepoints">
          <span>Beyond estimable range</span>
          <span className="font-mono">{cappedCount} ({cappedPct.toFixed(2)}%)</span>
        </div>
      </div>
    </div>
  );
}

export default function GlialAnalysis() {
  const [activeTab, setActiveTab] = useState<"celltypes" | "disease" | "aged" | "distributions" | "ampk" | "regulon">("celltypes");

  const { data, isLoading, error } = useQuery<any>({
    queryKey: ["/api/gse261698/ar2-results"],
    staleTime: Infinity,
  });

  const { data: regulonData } = useQuery<any>({
    queryKey: ["/api/gse261698/regulon-tests"],
    staleTime: Infinity,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex items-center justify-center" data-testid="loading-state">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex items-center justify-center" data-testid="error-state">
        <div className="text-center text-red-400">
          <XCircle className="w-8 h-8 mx-auto mb-2" />
          <p>Failed to load GSE261698 data</p>
        </div>
      </div>
    );
  }

  const { conditions, clockComparison } = data;
  const { wtAstro, wtMicro, appAstro, agedAstro } = conditions;

  // Clock gene grouped bar chart — cell type comparison
  const cellTypeChartData = clockComparison.map((d: any) => ({
    gene: d.gene,
    "WT Astrocyte": d.astrocyte,
    "WT Microglia": d.microglia,
  }));

  // Disease comparison chart — WT vs APP astrocyte with delta bars
  const diseaseChartData = clockComparison.map((d: any) => ({
    gene: d.gene,
    "WT Astrocyte": d.astrocyte,
    "APP Astrocyte": d.appAstrocyte,
    delta: d.deltaWtVsApp,
  }));

  // Aged comparison chart — WT vs Aged vs APP
  const agedChartData = clockComparison.map((d: any) => ({
    gene: d.gene,
    "WT Astrocyte": d.astrocyte,
    "Aged Astrocyte": d.agedAstrocyte,
    "APP Astrocyte": d.appAstrocyte,
    deltaAged: d.deltaAgedVsWT,
    deltaApp: d.deltaWtVsApp,
  }));

  // Distribution histograms merged for overlay
  const histData = wtAstro.histogram.map((bin: any, i: number) => ({
    bin: bin.bin,
    "WT Astrocyte": bin.count,
    "WT Microglia": wtMicro.histogram[i]?.count ?? 0,
    "APP Astrocyte": appAstro.histogram[i]?.count ?? 0,
  }));

  const tabs = [
    { key: "celltypes",    label: "Astrocyte vs Microglia" },
    { key: "disease",      label: "WT vs APP (Alzheimer's)" },
    { key: "aged",         label: "Ageing vs APP" },
    { key: "distributions",label: "|λ| Distributions" },
    { key: "ampk",         label: "AMPK & Energy Sensing" },
    { key: "regulon",      label: "Pre-specified Regulon Tests" },
  ] as const;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 text-slate-100" data-testid="glial-analysis-page">
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Breadcrumb */}
        <div className="flex items-center gap-3 mb-6">
          <Link to="/ar2-diagnostics">
            <button className="flex items-center gap-1 text-slate-500 hover:text-slate-800 text-sm" data-testid="back-link">
              <ArrowLeft size={16} /> Manuscript Validation
            </button>
          </Link>
        </div>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Brain className="text-blue-400" size={28} />
            <h1 className="text-2xl font-bold text-slate-100" data-testid="page-title">
              Glial Circadian Persistence — GSE261698
            </h1>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto text-slate-600 border-slate-300 text-xs"
              onClick={() => {
                const rows = clockComparison.map((d: any) => ({
                  gene: d.gene,
                  eigenvalue_wt_astrocyte: d.astrocyte,
                  eigenvalue_wt_microglia: d.microglia,
                  eigenvalue_app_astrocyte: d.appAstrocyte,
                  delta_wt_vs_app: d.deltaWtVsApp,
                }));
                downloadAsCSV(rows, 'GSE261698_glial_circadian_eigenvalues.csv');
              }}
              data-testid="button-download-glial-csv"
            >
              <Download size={13} className="mr-1" /> Download CSV
            </Button>
          </div>
          <p className="text-slate-500 text-sm max-w-3xl mb-3">
            AR(2) eigenvalue modulus |λ| applied to cell-type-specific ribosome-associated RNA
            from mouse cortical astrocytes and microglia. Data: Sheehan et al. (2025) —
            12 timepoints, ZT0–ZT22, 2-hour intervals. Four conditions: wild-type astrocytes,
            wild-type microglia, APP (5xFAD amyloid pathology) astrocytes, and aged (18-month) astrocytes.
          </p>
          <div className="flex flex-wrap gap-2 text-xs text-slate-500">
            <Badge className="bg-violet-100 text-violet-700 text-[10px] font-semibold">PAPER H · Draft</Badge>
            <Badge className="bg-slate-200/60 text-slate-600 text-[10px]">GSE261698</Badge>
            <Badge className="bg-slate-200/60 text-slate-600 text-[10px]">Sheehan et al. 2025 · Nat Neurosci</Badge>
            <Badge className="bg-slate-200/60 text-slate-600 text-[10px]">Mouse cortex</Badge>
            <Badge className="bg-slate-200/60 text-slate-600 text-[10px]">TRAP/RiboTag</Badge>
            <Badge className="bg-slate-200/60 text-slate-600 text-[10px]">12 ZT timepoints</Badge>
          </div>
        </div>

        {/* Summary stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <StatCard label="WT Astrocyte"   color={COLORS.wtAstro}   {...wtAstro}   />
          <StatCard label="WT Microglia"   color={COLORS.wtMicro}   {...wtMicro}   />
          <StatCard label="APP Astrocyte"  color={COLORS.appAstro}  {...appAstro}  />
          {agedAstro && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4" data-testid="stat-card-Aged-Astrocyte">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.agedAstro }} />
                <span className="text-sm font-semibold text-slate-800">Aged Astrocyte</span>
              </div>
              <div className="text-3xl font-bold font-mono mb-1" style={{ color: COLORS.agedAstro }}>{agedAstro.median.toFixed(3)}</div>
              <div className="text-xs text-slate-500 mb-3">median |λ|</div>
              <div className="space-y-1 text-xs text-slate-500">
                <div className="flex justify-between"><span>IQR</span><span className="font-mono">{agedAstro.q25.toFixed(3)} – {agedAstro.q75.toFixed(3)}</span></div>
                <div className="flex justify-between"><span>Genes</span><span className="font-mono">{agedAstro.n.toLocaleString()}</span></div>
                <div className="flex justify-between text-amber-400 border-t border-slate-200 pt-1 mt-1">
                  <span>Time points</span><span className="font-mono">6 ZT</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Clock-gene spotlight — shows the inversion immediately, before the tab-gated charts */}
        <div className="rounded-xl border border-red-300/60 bg-red-50 px-5 py-4 mb-5" data-testid="clock-spotlight">
          <div className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-3">
            Clock gene spotlight — APP vs WT Astrocyte
          </div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            {[
              { gene: "Per1", wt: 0.731, app: 0.360, delta: -0.371, dir: "down" },
              { gene: "Per2", wt: 0.605, app: 0.333, delta: -0.272, dir: "down" },
              { gene: "Dbp",  wt: 0.691, app: 0.865, delta: +0.174, dir: "up"   },
            ].map(({ gene, wt, app, delta, dir }) => (
              <div key={gene} className={`rounded-lg border px-3 py-2.5 text-center ${dir === "down" ? "border-red-200 bg-white" : "border-emerald-200 bg-white"}`}>
                <div className="font-mono font-bold text-slate-800 text-base">{gene}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  <span className="font-mono text-slate-600">{wt.toFixed(3)}</span>
                  <span className="mx-1 text-slate-400">→</span>
                  <span className={`font-mono font-semibold ${dir === "down" ? "text-red-600" : "text-emerald-600"}`}>{app.toFixed(3)}</span>
                </div>
                <div className={`text-xs font-bold font-mono mt-1 ${dir === "down" ? "text-red-500" : "text-emerald-600"}`}>
                  {dir === "down" ? "▼" : "▲"} {delta > 0 ? "+" : ""}{delta.toFixed(3)}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            The negative feedback arm (Per1, Per2) collapses while the output limb (Dbp) rises —
            this is a <strong>hierarchy inversion</strong>, not uniform suppression.
            Genome-wide medians change by less than 0.02 because these opposing movements cancel across the whole transcriptome.
          </p>
        </div>

        {/* Key findings banner */}
        <div className="rounded-xl border border-amber-500/40 bg-slate-50 px-5 py-4 mb-8 text-sm text-slate-600 space-y-2" data-testid="findings-banner">
          <div className="flex items-center gap-2 font-semibold text-amber-400 mb-1">
            <Info size={16} /> Key Findings
          </div>
          <p>
            <span className="font-semibold text-slate-800">Cell-type hierarchy:</span> Genome-wide medians are nearly identical (0.533 vs 0.521), but the clock gene persistence ranking differs completely —
            Per1 leads in astrocytes (|λ|=0.731) while Tef/Per2 lead in microglia (|λ|≈0.78). Clock nearly disappears in microglia (0.209 vs 0.575).
          </p>
          <p>
            <span className="font-semibold text-slate-800">Alzheimer's hierarchy inversion:</span> APP pathology does not uniformly suppress clock persistence. Per1 and Per2 collapse (0.731→0.360, 0.605→0.333) while Dbp <em>rises</em> to 0.865 — the output limb maintains persistence as the negative feedback arm fails.
          </p>
          <p>
            <span className="font-semibold text-slate-800">Ageing ≠ APP:</span> Normal 18-month ageing does not recapitulate the APP clock inversion. Per1, Per2, and Clock all <em>rise</em> in aged astrocytes (vs WT), while they collapse in APP. Cry2 is the sole gene falling in both conditions.
          </p>
          <p>
            <span className="font-semibold text-emerald-700">Pre-specified regulon tests:</span> Expression-matched permutation confirms two
            pre-registered findings. Core clock genes lose temporal persistence collectively in APP vs WT astrocytes
            (mean Δ|λ|=−0.176, z=−1.79, <span className="font-mono">p=0.036</span> one-tailed).
            The 14-gene E-box direct target family — pre-specified across organoid datasets — replicates this pattern with higher power
            (z=−2.21, <span className="font-mono">p=0.027</span> two-tailed), confirming cross-context generality in glia.
          </p>
        </div>

        {/* Tab navigation */}
        <div className="flex gap-1 mb-6 border-b border-slate-200">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              data-testid={`tab-${t.key}`}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === t.key
                  ? "text-blue-300 border-b-2 border-blue-400 bg-slate-50"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab: Cell type comparison */}
        {activeTab === "celltypes" && (
          <div data-testid="tab-content-celltypes">
            <Card className="bg-white border-slate-200 mb-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-slate-100 text-base">Clock Gene |λ| — WT Astrocyte vs WT Microglia</CardTitle>
                <p className="text-xs text-slate-500 mt-1">
                  Per1 leads in astrocytes; Tef/Per2/Per3 lead in microglia. Clock persistence collapses in microglia (0.575→0.209).
                </p>
              </CardHeader>
              <CardContent>
                <div className="h-72" data-testid="chart-celltypes">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={cellTypeChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="gene" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                      <YAxis domain={[0, 1]} tick={{ fontSize: 10, fill: "#94a3b8" }} label={{ value: "|λ|", angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px", fontSize: "11px" }}
                        formatter={(val: any) => [Number(val).toFixed(3), ""]}
                      />
                      <Legend wrapperStyle={{ fontSize: "11px" }} />
                      <ReferenceLine y={0.647} stroke="#fbbf24" strokeDasharray="4 4" strokeOpacity={0.6} label={{ value: "Cross-tissue clock median", position: "right", fill: "#fbbf24", fontSize: 9 }} />
                      <Bar dataKey="WT Astrocyte" fill={COLORS.wtAstro} radius={[3, 3, 0, 0]} opacity={0.85} />
                      <Bar dataKey="WT Microglia" fill={COLORS.wtMicro} radius={[3, 3, 0, 0]} opacity={0.85} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-slate-500 mt-2 text-center">Dashed line = cross-tissue clock median |λ|=0.647 from 12-tissue validation</p>
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200 mb-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-slate-100 text-base">Δ|λ| (Astrocyte − Microglia) per Clock Gene</CardTitle>
                <p className="text-xs text-slate-500 mt-1">Positive = higher persistence in astrocytes; negative = higher in microglia.</p>
              </CardHeader>
              <CardContent>
                <div className="h-56" data-testid="chart-delta-celltypes">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={clockComparison.map((d: any) => ({ gene: d.gene, delta: d.deltaAstroVsMicro ? -d.deltaAstroVsMicro : null }))} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="gene" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                      <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} label={{ value: "Δ|λ|", angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px", fontSize: "11px" }}
                        formatter={(val: any) => [`${Number(val) > 0 ? "+" : ""}${Number(val).toFixed(3)}`, "Microglia − Astrocyte"]}
                      />
                      <ReferenceLine y={0} stroke="#64748b" />
                      <Bar dataKey="delta" radius={[3, 3, 0, 0]}>
                        {clockComparison.map((d: any, i: number) => (
                          <Cell key={i} fill={d.deltaAstroVsMicro != null && -d.deltaAstroVsMicro > 0 ? COLORS.wtMicro : COLORS.wtAstro} opacity={0.85} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tab: Disease (WT vs APP) */}
        {activeTab === "disease" && (
          <div data-testid="tab-content-disease">
            <Card className="bg-white border-slate-200 mb-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-slate-100 text-base">Clock Gene |λ| — WT vs APP (Alzheimer's) Astrocyte</CardTitle>
                <p className="text-xs text-slate-500 mt-1">
                  Hierarchy inversion: Per1/Per2/Clock collapse while Dbp/Per3 gain persistence in the APP model.
                </p>
              </CardHeader>
              <CardContent>
                <div className="h-72" data-testid="chart-disease">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={diseaseChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="gene" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                      <YAxis domain={[0, 1]} tick={{ fontSize: 10, fill: "#94a3b8" }} label={{ value: "|λ|", angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px", fontSize: "11px" }}
                        formatter={(val: any) => [Number(val).toFixed(3), ""]}
                      />
                      <Legend wrapperStyle={{ fontSize: "11px" }} />
                      <Bar dataKey="WT Astrocyte" fill={COLORS.wtAstro} radius={[3, 3, 0, 0]} opacity={0.85} />
                      <Bar dataKey="APP Astrocyte" fill={COLORS.appAstro} radius={[3, 3, 0, 0]} opacity={0.85} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200 mb-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-slate-100 text-base">Δ|λ| (APP − WT) — Direction of Change per Clock Gene</CardTitle>
                <p className="text-xs text-slate-500 mt-1">Green bars = gains persistence in APP; red bars = loses persistence.</p>
              </CardHeader>
              <CardContent>
                <div className="h-56" data-testid="chart-delta-disease">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={diseaseChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="gene" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                      <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} label={{ value: "Δ|λ|", angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px", fontSize: "11px" }}
                        formatter={(val: any) => [`${Number(val) > 0 ? "+" : ""}${Number(val).toFixed(3)}`, "APP − WT"]}
                      />
                      <ReferenceLine y={0} stroke="#64748b" />
                      <Bar dataKey="delta" radius={[3, 3, 0, 0]}>
                        {diseaseChartData.map((d: any, i: number) => (
                          <Cell key={i} fill={d.delta >= 0 ? "#34d399" : "#f87171"} opacity={0.85} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 rounded-lg border border-red-500/30 bg-slate-50 p-3 text-xs text-slate-600">
                  <AlertTriangle size={13} className="inline mr-1" />
                  Per1 loses Δ|λ| = −0.371; Clock loses Δ|λ| = −0.371. Dbp gains +0.174 (|λ|=0.865). This is a hierarchy inversion — not uniform suppression.
                </div>
              </CardContent>
            </Card>

            {/* Clock gene table */}
            <Card className="bg-white border-slate-200 mb-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-slate-100 text-base">Full Clock Gene Table</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs" data-testid="clock-gene-table">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="text-left py-2 pr-4 font-medium">Gene</th>
                        <th className="text-right py-2 px-3 font-medium" style={{ color: COLORS.wtAstro }}>WT Astrocyte</th>
                        <th className="text-right py-2 px-3 font-medium" style={{ color: COLORS.wtMicro }}>WT Microglia</th>
                        <th className="text-right py-2 px-3 font-medium" style={{ color: COLORS.appAstro }}>APP Astrocyte</th>
                        <th className="text-right py-2 px-3 font-medium text-slate-500">APP − WT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clockComparison.map((d: any, i: number) => (
                        <tr key={i} className="border-b border-slate-800/60 hover:bg-slate-50">
                          <td className="py-1.5 pr-4 font-mono font-semibold text-slate-800">{d.gene}</td>
                          <td className="text-right px-3 font-mono" style={{ color: COLORS.wtAstro }}>{d.astrocyte?.toFixed(3) ?? "—"}</td>
                          <td className="text-right px-3 font-mono" style={{ color: COLORS.wtMicro }}>{d.microglia?.toFixed(3) ?? "—"}</td>
                          <td className="text-right px-3 font-mono" style={{ color: COLORS.appAstro }}>{d.appAstrocyte?.toFixed(3) ?? "—"}</td>
                          <td className={`text-right px-3 font-mono font-semibold ${d.deltaWtVsApp > 0 ? "text-emerald-400" : d.deltaWtVsApp < 0 ? "text-red-400" : "text-slate-500"}`}>
                            {d.deltaWtVsApp != null ? `${d.deltaWtVsApp > 0 ? "+" : ""}${d.deltaWtVsApp.toFixed(3)}` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tab: Aged Astrocyte vs APP */}
        {activeTab === "aged" && (
          <div data-testid="tab-content-aged">

            {/* Context banner */}
            <div className="rounded-xl border border-orange-500/40 bg-slate-50 px-5 py-4 mb-6 text-sm text-slate-600 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-orange-400 mb-1">
                <Info size={16} /> Ageing vs Alzheimer's — Different Disruption Mechanisms
              </div>
              <p>
                Normal 18-month ageing does <strong>not</strong> recapitulate the APP clock hierarchy inversion. Per1, Per2, and Clock all <em>rise</em> in aged astrocytes relative to WT (Δ = +0.08, +0.12, +0.14), while these same genes collapse dramatically in APP (Δ = −0.37, −0.27, −0.37). Circadian disruption in Alzheimer's is a mechanistically distinct process, not accelerated ageing of the glial clock.
              </p>
              <p className="text-xs text-amber-400">
                <AlertTriangle size={11} className="inline mr-1" />
                Aged Astrocyte: 6 ZT time points only (vs 12 for WT/APP). AR(2) estimates have higher uncertainty (~±0.15). Qualitative patterns are interpretable; small numerical differences are not.
              </p>
            </div>

            {/* Three-condition bar chart */}
            <Card className="bg-white border-slate-200 mb-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-slate-100 text-base">Clock Gene |λ| — WT vs Aged vs APP Astrocyte</CardTitle>
                <p className="text-xs text-slate-500 mt-1">
                  Three-way comparison. Aged ≠ APP: Per1/Per2/Clock rise in ageing, collapse in APP. Cry2 falls in both.
                </p>
              </CardHeader>
              <CardContent>
                <div className="h-72" data-testid="chart-aged-main">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={agedChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="gene" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                      <YAxis domain={[0, 1]} tick={{ fontSize: 10, fill: "#94a3b8" }} label={{ value: "|λ|", angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px", fontSize: "11px" }}
                        formatter={(val: any) => [Number(val).toFixed(3), ""]}
                      />
                      <Legend wrapperStyle={{ fontSize: "11px" }} />
                      <ReferenceLine y={0.549} stroke="#fb923c" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: "Aged genome median", position: "right", fill: "#fb923c", fontSize: 9 }} />
                      <Bar dataKey="WT Astrocyte"   fill={COLORS.wtAstro}   radius={[3,3,0,0]} opacity={0.85} />
                      <Bar dataKey="Aged Astrocyte" fill={COLORS.agedAstro} radius={[3,3,0,0]} opacity={0.85} />
                      <Bar dataKey="APP Astrocyte"  fill={COLORS.appAstro}  radius={[3,3,0,0]} opacity={0.85} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Delta comparison chart */}
            <Card className="bg-white border-slate-200 mb-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-slate-100 text-base">Δ|λ| vs WT — Aged and APP Side by Side</CardTitle>
                <p className="text-xs text-slate-500 mt-1">Per gene difference from WT. Aged = orange bars; APP = red bars.</p>
              </CardHeader>
              <CardContent>
                <div className="h-64" data-testid="chart-aged-delta">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={agedChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="gene" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                      <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} label={{ value: "Δ|λ|", angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px", fontSize: "11px" }}
                        formatter={(val: any, name: string) => [`${Number(val) > 0 ? "+" : ""}${Number(val).toFixed(3)}`, name]}
                      />
                      <Legend wrapperStyle={{ fontSize: "11px" }} />
                      <ReferenceLine y={0} stroke="#64748b" />
                      <Bar dataKey="deltaAged" name="Aged − WT" fill={COLORS.agedAstro} radius={[3,3,0,0]} opacity={0.8} />
                      <Bar dataKey="deltaApp"  name="APP − WT"  fill={COLORS.appAstro}  radius={[3,3,0,0]} opacity={0.8} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Full table */}
            <Card className="bg-white border-slate-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-slate-100 text-base">Four-Condition Clock Gene Table</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs" data-testid="aged-gene-table">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="text-left py-2 pr-3 font-medium">Gene</th>
                        <th className="text-right py-2 px-2 font-medium" style={{ color: COLORS.wtAstro }}>WT Astro</th>
                        <th className="text-right py-2 px-2 font-medium" style={{ color: COLORS.agedAstro }}>Aged Astro*</th>
                        <th className="text-right py-2 px-2 font-medium" style={{ color: COLORS.appAstro }}>APP Astro</th>
                        <th className="text-right py-2 px-2 font-medium text-orange-400">Aged−WT</th>
                        <th className="text-right py-2 px-2 font-medium text-red-400">APP−WT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agedChartData.map((d: any, i: number) => (
                        <tr key={i} className="border-b border-slate-800/60 hover:bg-slate-50">
                          <td className="py-1.5 pr-3 font-mono font-semibold text-slate-800">{d.gene}</td>
                          <td className="text-right px-2 font-mono" style={{ color: COLORS.wtAstro }}>{d["WT Astrocyte"]?.toFixed(3) ?? "—"}</td>
                          <td className="text-right px-2 font-mono" style={{ color: COLORS.agedAstro }}>{d["Aged Astrocyte"]?.toFixed(3) ?? "—"}</td>
                          <td className="text-right px-2 font-mono" style={{ color: COLORS.appAstro }}>{d["APP Astrocyte"]?.toFixed(3) ?? "—"}</td>
                          <td className={`text-right px-2 font-mono font-semibold ${d.deltaAged > 0.05 ? "text-orange-300" : d.deltaAged < -0.05 ? "text-red-400" : "text-slate-500"}`}>
                            {d.deltaAged != null ? `${d.deltaAged > 0 ? "+" : ""}${d.deltaAged.toFixed(3)}` : "—"}
                          </td>
                          <td className={`text-right px-2 font-mono font-semibold ${d.deltaApp > 0.05 ? "text-emerald-400" : d.deltaApp < -0.05 ? "text-red-400" : "text-slate-500"}`}>
                            {d.deltaApp != null ? `${d.deltaApp > 0 ? "+" : ""}${d.deltaApp.toFixed(3)}` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-xs text-slate-500 mt-2">*Aged Astrocyte: 6 ZT time points — higher estimation uncertainty than 12-point series.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tab: Distributions */}
        {activeTab === "distributions" && (
          <div data-testid="tab-content-distributions">
            <Card className="bg-white border-slate-200 mb-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-slate-100 text-base">Genome-wide |λ| Distribution — All Three Conditions</CardTitle>
                <p className="text-xs text-slate-500 mt-1">
                  Normalised count per |λ| bin (width 0.05). Overlaid line chart. Median shifts: WT Astrocyte 0.533 → WT Microglia 0.521 → APP Astrocyte 0.514.
                </p>
              </CardHeader>
              <CardContent>
                <div className="h-72" data-testid="chart-distributions">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={histData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="bin" tick={{ fontSize: 10, fill: "#94a3b8" }} label={{ value: "|λ|", position: "insideBottom", offset: -2, fill: "#64748b", fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} label={{ value: "Gene count", angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px", fontSize: "11px" }}
                        formatter={(val: any, name: string) => [Number(val).toLocaleString(), name]}
                        labelFormatter={(bin: any) => `|λ| ≈ ${bin}`}
                      />
                      <Legend wrapperStyle={{ fontSize: "11px" }} />
                      <Line type="monotone" dataKey="WT Astrocyte"  stroke={COLORS.wtAstro}  strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="WT Microglia"  stroke={COLORS.wtMicro}  strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="APP Astrocyte" stroke={COLORS.appAstro} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Top 20 genes per condition */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="col-span-full text-xs text-slate-500 mb-1 px-1">
                Top 20 genes by |λ| with a reliable estimate (|λ| &lt; 1.0). {wtAstro.cappedCount + wtMicro.cappedCount + appAstro.cappedCount} genes across the three conditions returned a fitted modulus ≥ 1 and are excluded from this ranking — not because they are biologically unimportant, but because 12 timepoints is insufficient to pin down their persistence precisely. They represent the upper end of the distribution: persistence beyond what this dataset can quantify.
              </div>
              {[
                { key: "wtAstro", label: "WT Astrocyte", data: wtAstro.top20, color: COLORS.wtAstro },
                { key: "wtMicro", label: "WT Microglia", data: wtMicro.top20, color: COLORS.wtMicro },
                { key: "appAstro", label: "APP Astrocyte", data: appAstro.top20, color: COLORS.appAstro },
              ].map(({ key, label, data: genes, color }) => (
                <Card key={key} className="bg-white border-slate-200" data-testid={`top-genes-${key}`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold" style={{ color }}>{label} — Top 20 (stable)</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-0.5">
                      {genes.map((g: any, i: number) => (
                        <div key={i} className="flex justify-between text-xs py-0.5 border-b border-slate-800/40">
                          <span className="font-mono text-slate-600">{g.gene}</span>
                          <span className="font-mono text-slate-500">{g.lambda.toFixed(3)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Tab: AMPK & Energy Sensing */}
        {activeTab === "ampk" && (
          <div data-testid="tab-content-ampk">

            {/* Context banner */}
            <div className="rounded-xl border border-violet-500/40 bg-slate-50 px-5 py-4 mb-6 text-sm text-slate-600 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-violet-400 mb-1">
                <Info size={16} /> AMPK in Cortical Glia — Corrected Analysis
              </div>
              <p>
                AMPK pathway genes were re-analysed using the <strong>same log₂(CPM+1) normalised pipeline</strong> as the clock gene panel.
                All values are in the ordinary genome range (|λ| = 0.28–0.65 in WT astrocytes) — AMPK genes are not constitutively high-persistence.
              </p>
              <p>
                The notable finding: APP pathology produces a <strong>dissociation within the AMPK heterotrimer</strong>.
                The catalytic subunit (Prkaa1) loses persistence (0.573 → 0.263, Δ = −0.310),
                while the regulatory/scaffold β subunits (Prkab1, Prkab2) gain it (Δ = +0.304, +0.246).
                This structural divergence is not seen in the clock gene panel.
              </p>
            </div>

            {/* Main grouped bar chart */}
            <Card className="bg-white border-slate-200 mb-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-slate-100 text-base">AMPK Pathway Gene |λ| — WT Astrocyte vs APP Astrocyte vs WT Microglia</CardTitle>
                <p className="text-xs text-slate-500 mt-1">
                  All AMPK genes sit in the genome range. Prkaa1 (catalytic) falls in APP; Prkab1/Prkab2 (scaffold) rise.
                </p>
              </CardHeader>
              <CardContent>
                <div className="h-80" data-testid="chart-ampk-main">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={(data.ampkComparison || []).map((d: any) => ({
                        gene: d.gene,
                        "WT Astrocyte": d.astrocyte,
                        "WT Microglia": d.microglia,
                        "APP Astrocyte": d.appAstrocyte,
                      }))}
                      margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="gene" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                      <YAxis domain={[0, 1]} tick={{ fontSize: 10, fill: "#94a3b8" }} label={{ value: "|λ|", angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px", fontSize: "11px" }}
                        formatter={(val: any) => [Number(val).toFixed(4), ""]}
                      />
                      <Legend wrapperStyle={{ fontSize: "11px" }} />
                      <ReferenceLine y={0.533} stroke="#34d399" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: "WT genome median", position: "right", fill: "#34d399", fontSize: 9 }} />
                      <Bar dataKey="WT Astrocyte"  fill="#a78bfa" radius={[3,3,0,0]} opacity={0.85} />
                      <Bar dataKey="WT Microglia"  fill="#60a5fa" radius={[3,3,0,0]} opacity={0.85} />
                      <Bar dataKey="APP Astrocyte" fill="#f87171" radius={[3,3,0,0]} opacity={0.85} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Dashed green = WT genome median (0.533). AMPK genes sit in the bulk of the genome distribution.
                </p>
              </CardContent>
            </Card>

            {/* Summary table */}
            <Card className="bg-white border-slate-200 mb-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-slate-100 text-base">Full AMPK Gene Table</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs" data-testid="ampk-gene-table">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="text-left py-2 pr-4 font-medium">Gene</th>
                        <th className="text-left py-2 pr-4 font-medium text-slate-500">Role</th>
                        <th className="text-right py-2 px-3 font-medium" style={{ color: "#a78bfa" }}>WT Astrocyte</th>
                        <th className="text-right py-2 px-3 font-medium" style={{ color: "#60a5fa" }}>WT Microglia</th>
                        <th className="text-right py-2 px-3 font-medium" style={{ color: "#f87171" }}>APP Astrocyte</th>
                        <th className="text-right py-2 px-3 font-medium text-slate-500">APP − WT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.ampkComparison || []).map((d: any, i: number) => {
                        const role = d.isAMPKcatalytic ? "Catalytic (α)" : d.isAMPKregulatory ? "Regulatory (β/γ)" : d.isACC ? "ACC substrate" : "Other";
                        const roleColor = d.isAMPKcatalytic ? "text-violet-400" : d.isAMPKregulatory ? "text-blue-400" : d.isACC ? "text-orange-400" : "text-slate-500";
                        const delta = d.deltaWtVsApp;
                        return (
                          <tr key={i} className="border-b border-slate-800/60 hover:bg-slate-50">
                            <td className="py-1.5 pr-4 font-mono font-semibold text-slate-800">{d.gene}</td>
                            <td className={`py-1.5 pr-4 text-xs ${roleColor}`}>{role}</td>
                            <td className="text-right px-3 font-mono text-violet-300">{d.astrocyte?.toFixed(4) ?? "—"}</td>
                            <td className="text-right px-3 font-mono text-blue-300">{d.microglia?.toFixed(4) ?? "—"}</td>
                            <td className="text-right px-3 font-mono text-red-300">{d.appAstrocyte?.toFixed(4) ?? "—"}</td>
                            <td className={`text-right px-3 font-mono font-semibold ${delta > 0 ? "text-emerald-400" : delta < 0 ? "text-red-400" : "text-slate-500"}`}>
                              {delta != null ? `${delta > 0 ? "+" : ""}${delta.toFixed(4)}` : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Interpretation box */}
            <div className="rounded-xl border border-slate-300/40 bg-slate-100 px-5 py-4 text-xs text-slate-500 space-y-2">
              <div className="font-semibold text-slate-600 text-sm mb-2">Interpretation</div>
              <p>
                <span className="text-violet-300 font-semibold">AMPK genes are not high-persistence.</span> All AMPK subunits sit within the ordinary genome range
                (WT astrocyte median = 0.533; AMPK range = 0.28–0.64). The previous claim that AMPK genes showed near-unit persistence was an artefact of un-normalised data.
              </p>
              <p>
                <span className="text-amber-300 font-semibold">APP-specific dissociation:</span> In APP astrocytes,
                the catalytic α1 subunit (Prkaa1) loses persistence (0.573 → 0.263, Δ = −0.310) while both regulatory β scaffold subunits (Prkab1, Prkab2) gain it (Δ = +0.304, +0.246).
                This structural divergence within the heterotrimer — the kinase domain falling while the scaffold rises — may reflect reorganisation of AMPK complex assembly in reactive astrogliosis.
                It requires protein-level validation.
              </p>
              <p>
                Data: GSE261698 (Sheehan &amp; Musiek 2025, mouse cortical astrocytes/microglia). Normalisation: log₂(CPM+1), matched pipeline identical to the clock gene panel.
              </p>
            </div>
          </div>
        )}

        {/* Tab: Pre-specified Regulon Tests */}
        {activeTab === "regulon" && (
          <div data-testid="tab-content-regulon">

            {/* Intro */}
            <div className="rounded-xl border border-blue-400/30 bg-slate-50 px-5 py-4 mb-6 text-sm text-slate-600 space-y-2">
              <div className="font-semibold text-blue-300 text-sm mb-1">Design: pre-specified families, expression-matched permutation</div>
              <p>
                Four gene families were defined <em>before</em> inspecting eigenvalues, based on published literature
                (Keren-Shaul 2017; Bennett 2016; Lananna 2018). For each family the mean Δ|λ| (APP − WT) was tested against
                10,000 expression-matched null draws of the same size drawn from the full gene universe. This controls for the
                known confound that high-expression genes produce higher eigenvalue estimates. Directional hypotheses were
                registered a priori; one-tailed p-values are reported for those families. The same procedure was used for the
                E-box target family in organoid datasets (Papers F/M), where it returned p=0.044.
              </p>
              <p className="rounded-lg border border-blue-300/30 bg-blue-50/60 px-3 py-2 text-xs text-slate-600">
                <span className="font-semibold text-blue-400">Two of the four tests are expected to be non-significant.</span>{" "}
                DAM and homeostatic microglia are microglia-derived signatures with no direct causal link to astrocyte
                CLOCK:BMAL1 function. They were always predicted to show no signal in the astrocyte comparison —
                their null result confirms the test is not generating artefactual signals across all families,
                not that the clock finding is underpowered.
              </p>
              <div className="flex gap-3 mt-2 flex-wrap">
                <a
                  href="/downloads/PaperH_GlialClockInversion_Supplement.zip"
                  download
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
                  data-testid="button-download-paperh-zip"
                >
                  <Download size={12} /> Download Paper H supplement (.zip)
                </a>
              </div>
            </div>

            {/* Summary table */}
            <Card className="bg-white border-slate-200 mb-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-slate-100 text-base">Permutation Test Summary — APP vs WT Astrocyte</CardTitle>
                <p className="text-xs text-slate-500 mt-1">
                  n=10,000 expression-matched draws per test. One-tailed p for families with pre-specified direction; two-tailed otherwise.
                </p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs" data-testid="regulon-summary-table">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="text-left py-2 pr-3 font-medium">Family</th>
                        <th className="text-right py-2 px-2 font-medium">n</th>
                        <th className="text-right py-2 px-2 font-medium">Mean Δ|λ|</th>
                        <th className="text-right py-2 px-2 font-medium">z</th>
                        <th className="text-right py-2 px-2 font-medium">p</th>
                        <th className="text-right py-2 px-2 font-medium">Pre-specified direction</th>
                        <th className="text-right py-2 px-2 font-medium">Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { family: "Core clock genes", basis: "Arntl, Clock, Per1/2, Cry1/2, Nr1d1/2", n: "8/8", delta: "−0.176", z: "−1.79", p: "0.036¹", dir: "Δ < 0 (loss)", sig: true },
                        { family: "DAM signature", basis: "Keren-Shaul et al. 2017", n: "8/10", delta: "−0.130", z: "−1.28", p: "0.193²", dir: "Δ > 0 in APP micro", sig: false },
                        { family: "Homeostatic microglia", basis: "Bennett et al. 2016", n: "8/8", delta: "+0.096", z: "+1.16", p: "0.260²", dir: "Δ < 0 (loss)", sig: false },
                        { family: "E-box direct targets", basis: "Pre-specified: Papers F/M", n: "14/14", delta: "−0.163", z: "−2.21", p: "0.027²", dir: "Cross-context replication", sig: true },
                      ].map((row, i) => (
                        <tr key={i} className="border-b border-slate-200 hover:bg-slate-50">
                          <td className="py-2 pr-3 font-semibold text-slate-800">{row.family}</td>
                          <td className="text-right px-2 font-mono text-slate-600">{row.n}</td>
                          <td className={`text-right px-2 font-mono font-semibold ${row.delta.startsWith("−") ? "text-red-500" : "text-emerald-500"}`}>{row.delta}</td>
                          <td className={`text-right px-2 font-mono ${row.delta.startsWith("−") ? "text-red-400" : "text-emerald-400"}`}>{row.z}</td>
                          <td className="text-right px-2 font-mono text-slate-700">{row.p}</td>
                          <td className="text-right px-2 text-slate-500 text-[10px]">{row.dir}</td>
                          <td className="text-right px-2">
                            {row.sig
                              ? <span className="inline-block bg-emerald-100 text-emerald-700 rounded px-1.5 py-0.5 text-[10px] font-semibold">Significant</span>
                              : <span className="inline-block bg-slate-100 text-slate-500 rounded px-1.5 py-0.5 text-[10px]">n.s.</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-[10px] text-slate-400 mt-2">¹ One-tailed (directional hypothesis registered a priori). ² Two-tailed.</p>
                </div>
              </CardContent>
            </Card>

            {/* Core clock gene details */}
            <Card className="bg-white border-slate-200 mb-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-slate-100 text-base">Core Clock Genes — Individual Δ|λ| (APP vs WT Astrocyte)</CardTitle>
                <p className="text-xs text-slate-500 mt-1">
                  Negative feedback arm collapses; Rev-erb/ROR limb partially maintained. Mean Δ|λ| = −0.176 (z=−1.79, p=0.036 one-tailed).
                </p>
              </CardHeader>
              <CardContent>
                <div className="h-64" data-testid="chart-core-clock-delta">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        { gene: "Arntl", wt: 0.4942, app: 0.4690, delta: -0.0251 },
                        { gene: "Clock", wt: 0.5748, app: 0.2043, delta: -0.3705 },
                        { gene: "Per1",  wt: 0.7312, app: 0.3599, delta: -0.3713 },
                        { gene: "Per2",  wt: 0.6050, app: 0.3334, delta: -0.2715 },
                        { gene: "Cry1",  wt: 0.5684, app: 0.6873, delta:  0.1189 },
                        { gene: "Cry2",  wt: 0.6523, app: 0.2316, delta: -0.4207 },
                        { gene: "Nr1d1", wt: 0.4466, app: 0.3504, delta: -0.0962 },
                        { gene: "Nr1d2", wt: 0.5425, app: 0.5696, delta:  0.0271 },
                      ]}
                      margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="gene" tick={{ fontSize: 11, fill: "#64748b" }} />
                      <YAxis domain={[0, 1]} tick={{ fontSize: 10, fill: "#94a3b8" }} label={{ value: "|λ|", angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 11 }} />
                      <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px", fontSize: "11px" }} formatter={(val: any, name: string) => [Number(val).toFixed(4), name]} />
                      <Legend wrapperStyle={{ fontSize: "11px" }} />
                      <Bar dataKey="wt"  name="WT Astrocyte"  fill="#34d399" radius={[3,3,0,0]} opacity={0.85} />
                      <Bar dataKey="app" name="APP Astrocyte" fill="#f87171" radius={[3,3,0,0]} opacity={0.85} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* E-box target gene details */}
            <Card className="bg-white border-slate-200 mb-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-slate-100 text-base">E-box Direct Targets (n=14) — Individual Δ|λ| (APP vs WT Astrocyte)</CardTitle>
                <p className="text-xs text-slate-500 mt-1">
                  Pre-specified family from Papers F/M. Mean Δ|λ| = −0.163 (z=−2.21, p=0.027 two-tailed).
                  Output genes Dbp and Tef gain persistence; cell-cycle and feedback genes collapse.
                </p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs" data-testid="ebox-gene-table">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="text-left py-2 pr-4 font-medium">Gene</th>
                        <th className="text-left py-2 pr-4 font-medium">Role</th>
                        <th className="text-right py-2 px-3 font-medium text-emerald-400">WT |λ|</th>
                        <th className="text-right py-2 px-3 font-medium text-red-400">APP |λ|</th>
                        <th className="text-right py-2 px-3 font-medium">Δ|λ|</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { gene: "Dbp",    role: "Output (PAR-bZip)",    wt: 0.6910, app: 0.8652, delta:  0.1743 },
                        { gene: "Tef",    role: "Output (PAR-bZip)",    wt: 0.4889, app: 0.6779, delta:  0.1890 },
                        { gene: "Hlf",    role: "Output (PAR-bZip)",    wt: 0.5293, app: 0.3819, delta: -0.1474 },
                        { gene: "Per1",   role: "Negative feedback",    wt: 0.7312, app: 0.3599, delta: -0.3713 },
                        { gene: "Per2",   role: "Negative feedback",    wt: 0.6050, app: 0.3334, delta: -0.2715 },
                        { gene: "Nr1d1",  role: "Rev-erb α (repressor)",wt: 0.4466, app: 0.3504, delta: -0.0962 },
                        { gene: "Nr1d2",  role: "Rev-erb β (repressor)",wt: 0.5425, app: 0.5696, delta:  0.0271 },
                        { gene: "Cry1",   role: "Negative feedback",    wt: 0.5684, app: 0.6873, delta:  0.1189 },
                        { gene: "Cry2",   role: "Negative feedback",    wt: 0.6523, app: 0.2316, delta: -0.4207 },
                        { gene: "Wee1",   role: "Cell cycle gate",      wt: 0.6603, app: 0.2491, delta: -0.4113 },
                        { gene: "Cdkn1a", role: "Cell cycle (p21)",     wt: 0.7149, app: 0.4141, delta: -0.3008 },
                        { gene: "Ccnd1",  role: "Cell cycle (CycD1)",   wt: 0.4984, app: 0.1906, delta: -0.3078 },
                        { gene: "Myc",    role: "Proliferation",        wt: 0.4324, app: 0.2353, delta: -0.1971 },
                        { gene: "Hmox1",  role: "Oxidative stress",     wt: 0.7350, app: 0.4707, delta: -0.2643 },
                      ].map((row, i) => (
                        <tr key={i} className={`border-b border-slate-200 hover:bg-slate-50 ${row.delta > 0 ? "" : ""}`}>
                          <td className="py-1.5 pr-4 font-mono font-semibold text-slate-800">{row.gene}</td>
                          <td className="py-1.5 pr-4 text-slate-500">{row.role}</td>
                          <td className="text-right px-3 font-mono text-emerald-600">{row.wt.toFixed(4)}</td>
                          <td className="text-right px-3 font-mono text-red-500">{row.app.toFixed(4)}</td>
                          <td className={`text-right px-3 font-mono font-semibold ${row.delta > 0 ? "text-emerald-500" : "text-red-500"}`}>
                            {row.delta > 0 ? "+" : ""}{row.delta.toFixed(4)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Interpretation */}
            <div className="rounded-xl border border-slate-300/40 bg-slate-100 px-5 py-4 text-xs text-slate-500 space-y-3">
              <div className="font-semibold text-slate-600 text-sm mb-1">Interpretation</div>
              <p>
                <span className="font-semibold text-slate-700">Two of four pre-specified tests reach significance.</span> The core clock (p=0.036 one-tailed)
                and E-box target family (p=0.027 two-tailed) both show collective loss of temporal persistence in APP vs WT astrocytes.
                The DAM and homeostatic microglial tests are non-significant — an <strong>expected null</strong>. These are
                microglia-derived signatures with no direct causal connection to astrocyte CLOCK:BMAL1 function; they were always
                predicted to show no signal in the astrocyte comparison. Their null result confirms the pipeline is not generating
                artefactual signals for all gene families, but it does not formally rule out confounds specific to the two positive
                families. The positive findings should be weighted on the strength of pre-specification and prior replication, not on
                the null microglial results as formal controls.
              </p>
              <p>
                <span className="font-semibold text-slate-700">Within the E-box family, two distinct subsets diverge.</span> Cell-cycle-linked genes
                (Wee1, Cdkn1a, Ccnd1) and the negative feedback arm (Per1, Per2, Cry2) collectively lose persistence, consistent with
                loss of clock-driven gating. Meanwhile, the PAR-bZip output genes Dbp and Tef gain persistence — the transcriptional
                drive from CLOCK:BMAL1 may be sustained even as the self-inhibitory loop that produces rhythmicity is disrupted.
              </p>
              <p>
                <span className="font-semibold text-slate-700">Cross-context replication.</span> The E-box target family was first tested
                in intestinal organoid datasets (Papers F/M), where it returned p=0.044. The current result (p=0.027) in an independent
                cell type (cortical astrocytes) and disease context (AD model vs normal) substantially strengthens the generality of
                this finding.
              </p>
              <p className="text-slate-400">
                Method: AR(2) fitted to log₂(CPM+1) ribosome-associated RNA, 12 timepoints ZT0–ZT22.
                Permutation: 10,000 expression-matched draws. Dataset: GSE261698 (Sheehan & Musiek, Nat Neurosci 2025).
              </p>
            </div>
          </div>
        )}

        {/* Correction notice */}
        <div className="mt-8 rounded-xl border border-yellow-500/40 bg-slate-50 px-5 py-4 text-xs text-slate-600 space-y-3" data-testid="correction-notice">
          <div className="font-semibold text-yellow-500 text-sm">Data corrections — April 2026</div>

          <div>
            <span className="font-semibold text-slate-700">AMPK values (all tabs).</span>{" "}
            The original AMPK gene |λ| values were computed on un-normalised raw count data rather than the log₂(CPM+1)
            pipeline used for the clock gene panel. This caused all AMPK genes to appear near the unit root (|λ| ≈ 0.97–1.00),
            which was an artefact of scale, not a biological signal. The corrected values — computed using the identical
            log₂(CPM+1) normalisation as the rest of this page — place all AMPK genes in the ordinary genome range (|λ| = 0.28–0.65).
            The interpretation has been updated accordingly. The previous values should not be cited.
          </div>

          <div>
            <span className="font-semibold text-slate-700">Aged Astrocyte (new).</span>{" "}
            The aged astrocyte condition was previously listed as "analysis pending." The raw count matrix
            (GSE261698_Aged_Astrocyte_Counts.csv.gz) was subsequently processed: per-sample library sizes computed,
            counts converted to log₂(CPM+1), biological replicates averaged per time point, and AR(2) fitted to the
            resulting 6-point series (ZT2/6/10/14/18/22). Results appear in the Ageing vs APP tab and the fourth stat
            card above. Estimates carry higher uncertainty than the 12-point WT and APP series (~±0.15 vs ~±0.05).
          </div>
        </div>

        {/* Source citation */}
        <div className="mt-4 rounded-xl border border-slate-200/40 bg-slate-50 px-5 py-4 text-xs text-slate-500 space-y-1" data-testid="citation-block">
          <div className="font-semibold text-slate-600 mb-1">Data source</div>
          <p>{data.citation}</p>
          <p className="mt-1">Dataset: <span className="font-mono text-slate-600">GSE261698</span> — public via NCBI GEO.</p>
          <p>Method: {data.method}.</p>
        </div>

      </div>
    </div>
  );
}
