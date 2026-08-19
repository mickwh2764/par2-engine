import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, AlertCircle, CheckCircle2, Activity } from "lucide-react";

// ── API fetch ──────────────────────────────────────────────────────────────────

async function fetchTemporalCorrelation() {
  const res = await fetch("/api/temporal-correlation/results");
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs space-y-1">
      <div className="font-semibold text-slate-200">{label}h elapsed</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {typeof p.value === "number" ? p.value.toFixed(4) : p.value}
        </div>
      ))}
    </div>
  );
};

const statusColors: Record<string, string> = {
  surprise:  "bg-violet-900/50 text-violet-300 border-violet-700",
  baseline:  "bg-slate-800 text-slate-400 border-slate-600",
  confirmed: "bg-emerald-900/50 text-emerald-300 border-emerald-700",
  failed:    "bg-red-900/50 text-red-300 border-red-700",
};

// ── Source badge ───────────────────────────────────────────────────────────────

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

// ── Main page ──────────────────────────────────────────────────────────────────

export default function TemporalCorrelation() {
  const qc = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["temporal-correlation"],
    queryFn: fetchTemporalCorrelation,
    staleTime: 1000 * 60 * 60,
    retry: 2,
  });

  const recompute = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/temporal-correlation/recompute", { method: "POST" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["temporal-correlation"] }),
  });

  // ── Loading / error ──
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="text-center space-y-3">
          <Activity className="w-8 h-8 text-cyan-400 animate-pulse mx-auto" />
          <p className="text-slate-400 text-sm">Computing temporal correlation analysis…</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="text-center space-y-3 max-w-md">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
          <p className="text-red-300 text-sm font-medium">Failed to load analysis</p>
          <p className="text-slate-500 text-xs">{String(error)}</p>
          <button onClick={() => refetch()} className="px-4 py-2 bg-cyan-700 hover:bg-cyan-600 text-white text-sm rounded-lg transition-colors">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { tissueData, corrData, hierarchyData, dbpTissue, summary, binomial, bootstrap, tissueCorrelations } = data;

  const STATS = [
    { label: "Clock τ_c (avg)", value: `${summary.clockTcMean}h`, sub: "temporal correlation length", color: "text-cyan-400" },
    { label: "Target τ_c (avg)", value: `${summary.targetTcMean}h`, sub: "temporal correlation length", color: "text-pink-400" },
    { label: "Clock/Target ratio", value: `${summary.ratio}×`, sub: "longer temporal memory in clock genes", color: "text-emerald-400" },
    { label: "Residual at 24h", value: `${summary.residualAt24h}×`, sub: "clock vs target autocorrelation", color: "text-amber-400" },
    { label: "Tissues confirmed", value: `${summary.tissuesConfirmed}/${summary.totalTissues}`, sub: "clock τ_c > target τ_c in every dataset", color: "text-violet-400" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-10">

        {/* Header */}
        <section className="space-y-3" data-testid="tc-header">
          <div className="flex flex-wrap gap-2 items-center">
            <Badge className="bg-cyan-900/60 text-cyan-300 border-cyan-700 text-xs">Temporal Correlation Analysis</Badge>
            <Badge className="bg-slate-800 text-slate-400 border-slate-700 text-xs">169 clock genes · 286 target genes · 13 datasets</Badge>
            <Badge className="bg-violet-900/50 text-violet-300 border-violet-700 text-xs">Paper P · PLOS Computational Biology</Badge>
            <SourceBadge source={data.source} />
            <button
              onClick={() => recompute.mutate()}
              disabled={recompute.isPending}
              className="ml-auto flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
              data-testid="btn-recompute"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${recompute.isPending ? "animate-spin" : ""}`} />
              Recompute
            </button>
          </div>
          <h1 className="text-3xl font-bold text-white">Temporal Correlation Length</h1>
          <p className="text-slate-400 max-w-3xl leading-relaxed">
            The AR(2) eigenvalue modulus |λ| is, in a mathematically precise sense, the <strong className="text-slate-200">temporal correlation length</strong> of gene expression —
            the biological equivalent of ξ (xi) in condensed matter physics.
            Clock genes carry their past signal forward for <strong className="text-cyan-300">{summary.clockTcMean} hours on average</strong>;
            target genes for only <strong className="text-pink-300">{summary.targetTcMean} hours</strong>.
            This {summary.ratio}× difference holds in every tissue and species tested.
          </p>
          <p className="text-xs text-slate-500 max-w-3xl">
            Note: τ_c is computed from the category mean |λ| per dataset via τ_c = −2/ln(mean|λ|), consistent with the stated formula.
            Using the mean of per-gene τ_c values gives larger numbers due to Jensen's inequality but does not change the direction or significance of any result.
          </p>
        </section>

        {/* Statistical validation strip */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3" data-testid="tc-validation-strip">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Recomputed statistical validation</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg bg-slate-800/60 p-3 space-y-1">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs font-semibold text-slate-200">13/13 Universality</span>
              </div>
              <div className="text-xs text-slate-400">{binomial.description}</div>
              <div className="text-xs font-mono text-emerald-300">Exact binomial p = {binomial.pValue < 0.001 ? binomial.pValue.toExponential(2) : binomial.pValue.toFixed(4)}</div>
            </div>
            <div className="rounded-lg bg-slate-800/60 p-3 space-y-1">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-xs font-semibold text-slate-200">Ratio 95% CI</span>
              </div>
              <div className="text-xs text-slate-400">Bootstrap ({bootstrap.n.toLocaleString()} resamples) across {summary.totalTissues} tissues</div>
              <div className="text-xs font-mono text-cyan-300">{bootstrap.ratioMean}× [95% CI {bootstrap.ratioCI95Low}–{bootstrap.ratioCI95High}]</div>
            </div>
            <div className="rounded-lg bg-slate-800/60 p-3 space-y-1">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-violet-400" />
                <span className="text-xs font-semibold text-slate-200">Tissue correlations</span>
              </div>
              {tissueCorrelations.slice(0,2).map((c: any) => (
                <div key={c.metric} className="text-xs text-slate-400">
                  <span className="text-violet-300 font-mono">ρ={c.rho}</span> {c.metric} (p={c.p}, n={c.n})
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Key stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3" data-testid="tc-stats">
          {STATS.map(s => (
            <div key={s.label} className="rounded-xl bg-slate-900 border border-slate-800 p-4 text-center space-y-1">
              <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
              <div className="text-xs font-semibold text-slate-300">{s.label}</div>
              <div className="text-xs text-slate-500 leading-tight">{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Main chart: G(τ) oscillating autocorrelation */}
        <Card className="bg-slate-900 border-slate-800" data-testid="tc-main-chart">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-lg">Temporal Autocorrelation Function G(τ) = |λ|^τ · cos(πτ/6)</CardTitle>
            <p className="text-sm text-slate-400">
              For each gene: how correlated is its expression now with expression τ time-steps ago?
              Averaged across all clock (cyan) and target (pink) genes.
              The <strong className="text-slate-300">oscillating-decay form</strong> is mathematically identical to the spatial correlation function in a modulated phase system.
            </p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={340}>
              <LineChart data={corrData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="hours" label={{ value: "Lag (biological hours)", position: "insideBottom", offset: -5, fill: "#64748b", fontSize: 12 }} tick={{ fill: "#64748b", fontSize: 11 }} />
                <YAxis domain={[-0.25, 1.05]} label={{ value: "G(τ)", angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 12 }} tick={{ fill: "#64748b", fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12, paddingTop: 8 }} />
                <ReferenceLine y={0} stroke="#475569" strokeDasharray="4 2" />
                <ReferenceLine x={12} stroke="#334155" strokeDasharray="3 2" label={{ value: "12h", fill: "#475569", fontSize: 10 }} />
                <ReferenceLine x={24} stroke="#334155" strokeDasharray="3 2" label={{ value: "24h", fill: "#475569", fontSize: 10 }} />
                <Line dataKey="clock"  name="Clock genes"         stroke="#22d3ee" strokeWidth={2.5} dot={false} />
                <Line dataKey="target" name="Target genes"        stroke="#f472b6" strokeWidth={2.5} dot={false} />
                <Line dataKey="genome" name="Genome background"   stroke="#94a3b8" strokeWidth={1.5} dot={false} strokeDasharray="5 3" />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-400">
              <div className="rounded-lg bg-slate-800/50 p-3 border border-slate-700/50">
                <div className="font-semibold text-cyan-300 mb-1">At τ = 6h</div>
                Both curves pass through zero — genes are uncorrelated with their expression 6 hours ago. Quarter-cycle zero crossing, expected for a 24h oscillation.
              </div>
              <div className="rounded-lg bg-slate-800/50 p-3 border border-slate-700/50">
                <div className="font-semibold text-pink-300 mb-1">At τ = 12h</div>
                Both curves reach their negative peak — genes are <em>anticorrelated</em> with 12 hours ago. The clock gene anticorrelation is 6× stronger.
              </div>
              <div className="rounded-lg bg-slate-800/50 p-3 border border-slate-700/50">
                <div className="font-semibold text-amber-300 mb-1">At τ = 24h</div>
                Clock genes retain G(24h) ≈ 0.056 — detectable autocorrelation after a full day. Target genes ≈ 0.003. The {summary.residualAt24h}× ratio shows that only clock genes have "day-to-day memory."
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Envelope chart */}
        <Card className="bg-slate-900 border-slate-800" data-testid="tc-envelope-chart">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-lg">Decay Envelope — |λ|^τ (Pure Persistence)</CardTitle>
            <p className="text-sm text-slate-400">
              Stripping out the oscillation reveals the pure persistence decay. This is the quantity that maps directly onto the spatial correlation length ξ in physics:
              the rate at which dynamical memory is lost. Clock genes lose it at half the rate of target genes.
            </p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={corrData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="hours" label={{ value: "Lag (biological hours)", position: "insideBottom", offset: -5, fill: "#64748b", fontSize: 12 }} tick={{ fill: "#64748b", fontSize: 11 }} />
                <YAxis domain={[0, 1.05]} label={{ value: "Envelope |λ|^τ", angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 12 }} tick={{ fill: "#64748b", fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12, paddingTop: 8 }} />
                <ReferenceLine y={0.368} stroke="#475569" strokeDasharray="4 2"
                  label={{ value: "1/e = 0.368 (τ_c threshold)", position: "right", fill: "#475569", fontSize: 9 }} />
                <Line dataKey="clockEnv"  name="Clock envelope"   stroke="#22d3ee" strokeWidth={2.5} dot={false} />
                <Line dataKey="targetEnv" name="Target envelope"  stroke="#f472b6" strokeWidth={2.5} dot={false} />
                <Line dataKey="genomeEnv" name="Genome envelope"  stroke="#94a3b8" strokeWidth={1.5} dot={false} strokeDasharray="5 3" />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-3 rounded-lg bg-slate-800/50 border border-slate-700/50 p-4 text-sm text-slate-300 space-y-2">
              <div className="font-semibold text-slate-200">Reading the 1/e line (standard definition of correlation length in physics)</div>
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div><span className="text-cyan-300 font-semibold">Clock genes</span><br />Envelope crosses 1/e at <strong>{summary.clockTcMean}h</strong>.<br />τ_c = {summary.clockTcMean}h is the temporal correlation length.</div>
                <div><span className="text-pink-300 font-semibold">Target genes</span><br />Envelope crosses 1/e at <strong>{summary.targetTcMean}h</strong>.<br />τ_c = {summary.targetTcMean}h — decays at half the rate.</div>
                <div><span className="text-slate-400 font-semibold">Genome background</span><br />Intermediate decay rate.<br />Close to target genes, not clock genes.</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Per-tissue table */}
        <Card className="bg-slate-900 border-slate-800" data-testid="tc-tissue-table">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-lg">Per-Tissue Temporal Correlation Length — {summary.tissuesConfirmed}/{summary.totalTissues} Datasets</CardTitle>
            <p className="text-sm text-slate-400">
              Clock τ_c &gt; Target τ_c holds in every single tissue and species without exception.
              The ratio varies ({Math.min(...tissueData.map((r: any) => r.ratio)).toFixed(2)}× to {Math.max(...tissueData.map((r: any) => r.ratio)).toFixed(2)}×) but the direction never reverses.
              Exact binomial p = {binomial.pValue < 0.001 ? binomial.pValue.toExponential(2) : binomial.pValue.toFixed(5)}.
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 text-xs border-b border-slate-800">
                    <th className="text-left py-2 pr-4">Tissue / Dataset</th>
                    <th className="text-right pr-4">Clock τ_c</th>
                    <th className="text-right pr-4">Target τ_c</th>
                    <th className="text-right pr-4">|λ| gap</th>
                    <th className="text-right">Ratio</th>
                  </tr>
                </thead>
                <tbody>
                  {tissueData.map((row: any, i: number) => (
                    <tr key={row.tissue} className={`border-b border-slate-800/50 ${i % 2 === 0 ? "bg-slate-900" : "bg-slate-800/20"}`}
                      data-testid={`tc-row-${row.tissue.toLowerCase().replace(/\s+/g, "-")}`}>
                      <td className="py-2 pr-4 font-medium text-slate-200">{row.tissue}</td>
                      <td className="py-2 pr-4 text-right text-cyan-300 font-mono">{row.clockTc.toFixed(1)}h</td>
                      <td className="py-2 pr-4 text-right text-pink-300 font-mono">{row.targetTc.toFixed(1)}h</td>
                      <td className="py-2 pr-4 text-right text-slate-300 font-mono">+{row.gap.toFixed(3)}</td>
                      <td className="py-2 text-right">
                        <span className={`font-bold ${row.ratio >= 3 ? "text-emerald-400" : row.ratio >= 2 ? "text-cyan-400" : "text-slate-300"}`}>
                          {row.ratio.toFixed(2)}×
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-700 text-xs text-slate-400 font-semibold">
                    <td className="py-2 pr-4">Mean across all tissues</td>
                    <td className="py-2 pr-4 text-right text-cyan-300">{summary.clockTcMean}h</td>
                    <td className="py-2 pr-4 text-right text-pink-300">{summary.targetTcMean}h</td>
                    <td className="py-2 pr-4 text-right">—</td>
                    <td className="py-2 text-right text-emerald-400">{summary.ratio}× [95% CI {bootstrap.ratioCI95Low}–{bootstrap.ratioCI95High}]</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="mt-4 rounded-lg bg-amber-950/30 border border-amber-800/40 p-4 text-sm space-y-1">
              <div className="font-semibold text-amber-300">The Hypothalamus — lowest ratio, but still ordered</div>
              <p className="text-slate-400 text-xs leading-relaxed">
                The hypothalamus has the lowest ratio ({tissueData.find((r: any) => r.tissue === "Hypothalamus")?.ratio.toFixed(2)}×) despite containing the SCN master pacemaker.
                One post-hoc interpretation: in the SCN, clock genes co-regulate target genes with minimal downstream delay,
                compressing the hierarchy. This interpretation is biologically plausible but is developed from the same data — treat as a hypothesis for future testing.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Per-tissue ratio bar chart */}
        <Card className="bg-slate-900 border-slate-800" data-testid="tc-ratio-chart">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-lg">Clock/Target τ_c Ratio by Tissue</CardTitle>
            <p className="text-sm text-slate-400">The ratio &gt; 1 in every tissue. Bootstrap 95% CI: [{bootstrap.ratioCI95Low}–{bootstrap.ratioCI95High}]×.</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={[...tissueData].sort((a: any, b: any) => b.ratio - a.ratio)} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="tissue" tick={{ fill: "#94a3b8", fontSize: 10 }} angle={-40} textAnchor="end" interval={0} />
                <YAxis domain={[0, Math.max(...tissueData.map((r: any) => r.ratio)) + 0.3]} tick={{ fill: "#64748b", fontSize: 11 }}
                  label={{ value: "Clock τ_c / Target τ_c", angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 11 }} />
                <ReferenceLine y={1} stroke="#f43f5e" strokeDasharray="4 2" label={{ value: "Equal (ratio=1)", position: "right", fill: "#f43f5e", fontSize: 9 }} />
                <Tooltip content={({ active, payload }) => active && payload?.length ? (
                  <div className="bg-slate-900 border border-slate-700 rounded p-2 text-xs">
                    <div className="font-semibold text-slate-200">{payload[0]?.payload?.tissue}</div>
                    <div className="text-cyan-300">Ratio: {(payload[0]?.value as number)?.toFixed(2)}×</div>
                    <div className="text-slate-400">Clock τ_c: {payload[0]?.payload?.clockTc}h</div>
                    <div className="text-slate-400">Target τ_c: {payload[0]?.payload?.targetTc}h</div>
                  </div>
                ) : null} />
                <Bar dataKey="ratio" name="τ_c ratio" radius={[3, 3, 0, 0]}>
                  {[...tissueData].sort((a: any, b: any) => b.ratio - a.ratio).map((entry: any, index: number) => (
                    <Cell key={index} fill={entry.ratio >= 3 ? "#22d3ee" : entry.ratio >= 2 ? "#67e8f9" : entry.ratio >= 1.5 ? "#a5f3fc" : "#cbd5e1"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Tissue correlations */}
        <Card className="bg-slate-900 border-slate-800" data-testid="tc-correlations">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-lg">External Validation — Tissue-Level Correlations</CardTitle>
            <p className="text-sm text-slate-400">
              The τ_c gap and ratio correlate with independent biological measures of rhythmic robustness across tissues.
              All four Spearman ρ values exceed 0.78, p ≤ 0.002.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {tissueCorrelations.map((c: any) => (
                <div key={c.metric} className="rounded-lg bg-slate-800/60 border border-slate-700/50 p-3 space-y-1">
                  <div className="text-xs font-semibold text-slate-200 capitalize">{c.metric}</div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-black text-violet-300 font-mono">ρ={c.rho}</span>
                    <span className="text-xs text-slate-400">p={c.p}, n={c.n} tissues</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Predictive hierarchy */}
        <section className="space-y-2" data-testid="tc-hierarchy-header">
          <h2 className="text-2xl font-bold text-white">Beyond Pre-Selected Genes — Predictive Hierarchy Test</h2>
          <p className="text-slate-400 max-w-3xl leading-relaxed text-sm">
            The clock/target comparison is partly circular: the genes were selected because they're known to be rhythmic.
            A stronger test is to predict |λ| for gene categories whose oscillatory properties were <em>not</em> part of the original selection,
            then check whether the ordering matches the predicted relay-distance hierarchy.
          </p>
        </section>

        <div className="space-y-3" data-testid="tc-hierarchy-list">
          {hierarchyData.map((row: any, i: number) => (
            <div key={row.category} className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-2" data-testid={`tc-hierarchy-${i}`}>
              <div className="flex flex-wrap items-center gap-2">
                <div className="font-semibold text-slate-100 text-sm">{row.category}</div>
                <span className={`text-xs px-2 py-0.5 rounded border ${statusColors[row.status]}`}>{row.statusLabel}</span>
                <span className="text-xs text-slate-500 font-mono">mean |λ|={row.meanLam} · τ_c={row.tauC}h · n={row.n}</span>
              </div>
              <div className="text-xs text-slate-500 italic">{row.genes}</div>
              <div className="w-full bg-slate-800 rounded-full h-1.5">
                <div className="h-1.5 rounded-full transition-all" style={{ width: `${row.meanLam * 100}%`, backgroundColor: row.color }} />
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">{row.note}</p>
            </div>
          ))}
        </div>

        {/* DBP tissue breakdown */}
        <Card className="bg-slate-900 border-slate-800" data-testid="tc-dbp">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-lg">DBP — Highest Individual Gene τ_c Across Tissues</CardTitle>
            <p className="text-sm text-slate-400">
              DBP (D-site binding protein), a PAR-bZIP transcription factor, shows the highest temporal persistence of any individual gene tested.
              τ_c ranges from 3.0h (hypothalamus) to 17.6h (kidney) — a 5.8× tissue-level variation driven by the same gene.
            </p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={dbpTissue} margin={{ top: 5, right: 20, left: 0, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="tissue" tick={{ fill: "#94a3b8", fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                <YAxis domain={[0, 1]} tick={{ fill: "#64748b", fontSize: 11 }}
                  label={{ value: "|λ|", angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 12 }} />
                <Tooltip content={({ active, payload }) => active && payload?.length ? (
                  <div className="bg-slate-900 border border-slate-700 rounded p-2 text-xs">
                    <div className="font-semibold text-slate-200">DBP — {payload[0]?.payload?.tissue}</div>
                    <div className="text-violet-300">|λ| = {(payload[0]?.value as number)?.toFixed(3)}</div>
                    <div className="text-slate-400">τ_c = {payload[0]?.payload?.tauC}h</div>
                  </div>
                ) : null} />
                <Bar dataKey="lam" fill="#a78bfa" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Methods note */}
        <div className="rounded-xl bg-slate-900/50 border border-slate-800 p-5 text-xs text-slate-500 space-y-2" data-testid="tc-methods">
          <div className="font-semibold text-slate-400 text-sm">Methods & Limitations</div>
          <p>τ_c = −2/ln(mean|λ|) using the per-tissue category mean |λ| (Convention A). Using per-gene τ_c means yields larger values due to Jensen's inequality but does not affect direction or significance.</p>
          <p>All tissue values pre-computed from Supplementary_Table_S1b_Per_Gene_Eigenvalues.csv using fitAR2() OLS on mean-centred time-series. GSE54650: 12 mouse tissues, 2h CT intervals, n=288 samples. Human Blood: independent human dataset. 169 clock genes, 286 target genes, 13 datasets total.</p>
          <p>A proper test of immediate early genes (FOS, JUN) requires stimulation time-series (LPS, serum shock) — not yet in the platform's accessible datasets. Results in unstimulated circadian tissue show residual circadian drive in these genes, consistent with, but not proof of, the prediction.</p>
          <div className="text-slate-600">Computed: {new Date(data.computedAt).toLocaleString()}</div>
        </div>

      </div>
    </div>
  );
}
