import { useState, useEffect, useRef } from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend, ReferenceLine,
  Cell, LabelList,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ─── types ────────────────────────────────────────────────────────────────────

interface ScatterPoint {
  gene: string;
  category: "Clock" | "Target" | "Other";
  eigenvalue: number;
  cosinorR2: number;
  jtkTau: number;
  cosinorRhythmic: boolean;
  jtkRhythmic: boolean;
}

interface DivergentExample {
  gene: string;
  eigenvalue: number;
  cosinorRhythmic: boolean;
  jtkRhythmic: boolean;
  type: "high_pers_not_rhythmic" | "rhythmic_low_pers";
  interpretation: string;
}

interface VennCounts {
  all3: number; ar2Only: number; cosinorOnly: number; jtkOnly: number;
  ar2Cosinor: number; ar2Jtk: number; cosinorJtk: number; none: number;
}

interface DatasetResult {
  datasetId: string;
  datasetName: string;
  species: string;
  tissue: string;
  nGenes: number;
  nTimepoints: number;
  resolutionHours: number;
  geoAccession: string;
  ar2HighPct: number;
  cosinorRhythmicPct: number;
  jtkRhythmicPct: number;
  ar2UniquePct: number;
  rhythmicLowPersPct: number;
  corrEigenvalueCosinorR2: number;
  corrEigenvalueJtkTau: number;
  corrAmplitudeTau: number;
  clockGenes: { total: number; ar2: number; cosinor: number; jtk: number; all3: number; names: string[] };
  venn: VennCounts;
  scatterData: ScatterPoint[];
  divergent: DivergentExample[];
  conclusion: string;
}

interface MethodsPaperResult {
  computedAt: string;
  datasets: DatasetResult[];
  crossDatasetSummary: {
    ar2UniqueRangeStr: string;
    rhythmicLowPersRangeStr: string;
    corrRangeStr: string;
    clockGeneConsistency: string;
    paperConclusion: string;
  };
}

// ─── palette ──────────────────────────────────────────────────────────────────

const CAT_COLOR: Record<string, string> = {
  Clock: "#f59e0b",
  Target: "#60a5fa",
  Other: "#64748b",
};

// ─── small utilities ──────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, color = "text-white",
}: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 flex flex-col gap-1"
         data-testid={`stat-card-${label.toLowerCase().replace(/\s+/g,'-')}`}>
      <div className="text-xs text-slate-400 font-medium uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

// ─── scatter panel ────────────────────────────────────────────────────────────

function ScatterPanel({ data }: { data: ScatterPoint[] }) {
  const categories: ("Clock" | "Target" | "Other")[] = ["Clock", "Target", "Other"];
  const grouped: Record<string, ScatterPoint[]> = { Clock: [], Target: [], Other: [] };
  data.forEach(d => grouped[d.category].push(d));

  return (
    <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-slate-200">Figure A — |λ| vs Cosinor R²</h3>
        <div className="flex gap-2">
          {categories.map(c => (
            <span key={c} className="flex items-center gap-1 text-xs text-slate-400">
              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: CAT_COLOR[c] }} />
              {c}
            </span>
          ))}
        </div>
      </div>
      <p className="text-xs text-slate-500 mb-3">
        Spearman ρ shown in stats above. Low global correlation confirms |λ| captures temporal persistence
        orthogonal to sinusoidal rhythmicity.
      </p>
      <ResponsiveContainer width="100%" height={320}>
        <ScatterChart margin={{ top: 8, right: 16, bottom: 20, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" strokeOpacity={0.5} />
          <XAxis
            dataKey="eigenvalue" type="number" name="|λ|" domain={[0, 1.05]}
            label={{ value: "AR(2) |λ| (temporal persistence)", position: "insideBottom", offset: -12, fill: "#94a3b8", fontSize: 11 }}
            tick={{ fill: "#94a3b8", fontSize: 11 }} tickCount={6}
          />
          <YAxis
            dataKey="cosinorR2" type="number" name="Cosinor R²" domain={[0, 1]}
            label={{ value: "Cosinor R²", angle: -90, position: "insideLeft", offset: 12, fill: "#94a3b8", fontSize: 11 }}
            tick={{ fill: "#94a3b8", fontSize: 11 }} tickCount={5}
          />
          <ReferenceLine x={0.5} stroke="#f59e0b" strokeDasharray="5 3" strokeOpacity={0.5} />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: "#e2e8f0" }}
            formatter={(val: number, name: string) => [val?.toFixed(3), name]}
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const d = payload[0].payload as ScatterPoint;
              return (
                <div className="bg-slate-800 border border-slate-600 rounded p-2 text-xs text-slate-200 shadow-lg">
                  <div className="font-semibold mb-1">{d.gene}</div>
                  <div>|λ| = {d.eigenvalue.toFixed(3)}</div>
                  <div>Cosinor R² = {d.cosinorR2.toFixed(3)}</div>
                  <div>JTK |τ| = {d.jtkTau.toFixed(3)}</div>
                  <div>Cosinor rhythmic: {d.cosinorRhythmic ? "✓" : "✗"}</div>
                  <div>JTK rhythmic: {d.jtkRhythmic ? "✓" : "✗"}</div>
                </div>
              );
            }}
          />
          {categories.map(cat => (
            <Scatter
              key={cat}
              name={cat}
              data={grouped[cat]}
              fill={CAT_COLOR[cat]}
              fillOpacity={cat === "Other" ? 0.35 : 0.8}
              r={cat === "Other" ? 2 : 4}
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── clock gene bar chart ─────────────────────────────────────────────────────

function ClockBar({ ds }: { ds: DatasetResult }) {
  const { total, ar2, cosinor, jtk, all3 } = ds.clockGenes;
  const barData = [
    { method: "AR(2) |λ|≥0.5",  detected: ar2,     pct: total ? Math.round(ar2/total*100) : 0, fill: "#f59e0b" },
    { method: "Cosinor q<0.05", detected: cosinor, pct: total ? Math.round(cosinor/total*100) : 0, fill: "#60a5fa" },
    { method: "JTK q<0.05",     detected: jtk,     pct: total ? Math.round(jtk/total*100) : 0, fill: "#a78bfa" },
    { method: "All 3 methods",  detected: all3,    pct: total ? Math.round(all3/total*100) : 0, fill: "#34d399" },
  ];

  return (
    <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-slate-200 mb-1">
        Figure B — Clock Gene Detection (n={total})
      </h3>
      <p className="text-xs text-slate-500 mb-3">
        % of canonical circadian clock genes detected by each method. Includes: {ds.clockGenes.names.slice(0,8).join(", ")}{ds.clockGenes.names.length > 8 ? "…" : ""}
      </p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={barData} margin={{ top: 4, right: 24, bottom: 40, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" strokeOpacity={0.5} vertical={false} />
          <XAxis dataKey="method" tick={{ fill: "#94a3b8", fontSize: 10 }} angle={-20} textAnchor="end" interval={0} />
          <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} domain={[0, 100]}
            label={{ value: "% detected", angle: -90, position: "insideLeft", fill: "#94a3b8", fontSize: 11 }} />
          <Tooltip
            contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
            formatter={(v: number, _: string, entry: any) => [
              `${entry.payload.detected}/${total} (${v}%)`, entry.payload.method,
            ]}
          />
          <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
            {barData.map((b, i) => (
              <Cell key={i} fill={b.fill} fillOpacity={0.85} />
            ))}
            <LabelList dataKey="pct" position="top" formatter={(v: number) => `${v}%`}
              style={{ fill: "#e2e8f0", fontSize: 10 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── divergent examples table ─────────────────────────────────────────────────

function DivergentTable({ examples }: { examples: DivergentExample[] }) {
  if (!examples.length) return null;

  const highlight = examples.filter(e => e.type === "high_pers_not_rhythmic");
  const lowPers   = examples.filter(e => e.type === "rhythmic_low_pers");

  const Row = ({ e }: { e: DivergentExample }) => (
    <tr className="border-b border-slate-700/50 hover:bg-slate-700/20" data-testid={`divergent-row-${e.gene}`}>
      <td className="px-3 py-2 font-mono text-xs font-semibold text-amber-300">{e.gene}</td>
      <td className="px-3 py-2 text-xs text-center">
        <span className={`font-bold ${e.eigenvalue >= 0.5 ? "text-amber-400" : "text-slate-400"}`}>
          {e.eigenvalue.toFixed(3)}
        </span>
      </td>
      <td className="px-3 py-2 text-xs text-center">{e.cosinorRhythmic ? <span className="text-emerald-400">✓</span> : <span className="text-slate-500">✗</span>}</td>
      <td className="px-3 py-2 text-xs text-center">{e.jtkRhythmic ? <span className="text-emerald-400">✓</span> : <span className="text-slate-500">✗</span>}</td>
      <td className="px-3 py-2 text-xs text-slate-300 max-w-xs">{e.interpretation}</td>
    </tr>
  );

  return (
    <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-slate-200 mb-1">Figure C — Divergent Examples</h3>
      <p className="text-xs text-slate-500 mb-3">
        Cases where AR(2) |λ| and conventional rhythmicity tests disagree — key evidence that the methods are complementary.
      </p>
      {highlight.length > 0 && (
        <>
          <p className="text-xs text-amber-400 font-medium mb-1">High persistence, not rhythmic by cosinor/JTK:</p>
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-700">
                  {["Gene", "|λ|", "Cosinor", "JTK", "Interpretation"].map(h => (
                    <th key={h} className="px-3 py-1.5 text-xs font-medium text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>{highlight.map(e => <Row key={e.gene} e={e} />)}</tbody>
            </table>
          </div>
        </>
      )}
      {lowPers.length > 0 && (
        <>
          <p className="text-xs text-blue-400 font-medium mb-1">Rhythmic (cosinor+JTK) but low persistence:</p>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-700">
                  {["Gene", "|λ|", "Cosinor", "JTK", "Interpretation"].map(h => (
                    <th key={h} className="px-3 py-1.5 text-xs font-medium text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>{lowPers.map(e => <Row key={e.gene} e={e} />)}</tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ─── venn summary ─────────────────────────────────────────────────────────────

function VennSummary({ venn, n }: { venn: VennCounts; n: number }) {
  const pct = (v: number) => `${(v / n * 100).toFixed(1)}%`;
  const rows = [
    { label: "All 3 methods",              value: venn.all3,        color: "text-emerald-400" },
    { label: "AR(2) only",                 value: venn.ar2Only,     color: "text-amber-400" },
    { label: "Cosinor only",               value: venn.cosinorOnly, color: "text-blue-400" },
    { label: "JTK only",                   value: venn.jtkOnly,     color: "text-violet-400" },
    { label: "AR(2) + Cosinor (no JTK)",   value: venn.ar2Cosinor,  color: "text-slate-300" },
    { label: "AR(2) + JTK (no Cosinor)",   value: venn.ar2Jtk,      color: "text-slate-300" },
    { label: "Cosinor + JTK (no AR(2))",   value: venn.cosinorJtk,  color: "text-slate-300" },
    { label: "None flagged",               value: venn.none,        color: "text-slate-500" },
  ];

  return (
    <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-slate-200 mb-3">Method Overlap (Venn)</h3>
      <div className="grid grid-cols-2 gap-1.5">
        {rows.map(r => (
          <div key={r.label} className="flex justify-between items-center px-3 py-1.5 bg-slate-800/60 rounded-lg" data-testid={`venn-row-${r.label.toLowerCase().replace(/\s+/g,'-')}`}>
            <span className="text-xs text-slate-400">{r.label}</span>
            <span className={`text-xs font-mono font-bold ${r.color}`}>
              {r.value.toLocaleString()} <span className="font-normal text-slate-500">({pct(r.value)})</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── dataset tab content ──────────────────────────────────────────────────────

function DatasetPanel({ ds }: { ds: DatasetResult }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="AR(2) |λ|≥0.5" value={`${ds.ar2HighPct}%`} sub={`of ${ds.nGenes.toLocaleString()} genes`} color="text-amber-400" />
        <StatCard label="Cosinor rhythmic" value={`${ds.cosinorRhythmicPct}%`} sub="BH q<0.05" color="text-blue-400" />
        <StatCard label="JTK rhythmic" value={`${ds.jtkRhythmicPct}%`} sub="BH q<0.05" color="text-violet-400" />
        <StatCard label="AR(2)-unique" value={`${ds.ar2UniquePct}%`} sub="high |λ| not rhythmic" color="text-emerald-400" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard label="ρ(|λ|, cosinor R²)" value={ds.corrEigenvalueCosinorR2.toFixed(3)} sub="Spearman correlation" color="text-slate-200" />
        <StatCard label="ρ(|λ|, JTK |τ|)" value={ds.corrEigenvalueJtkTau.toFixed(3)} sub="Spearman correlation" color="text-slate-200" />
        <StatCard label="Rhythmic, low pers." value={`${ds.rhythmicLowPersPct}%`} sub="cosinor+JTK but |λ|<0.5" color="text-slate-200" />
      </div>

      <ScatterPanel data={ds.scatterData} />

      <div className="grid md:grid-cols-2 gap-5">
        <ClockBar ds={ds} />
        <VennSummary venn={ds.venn} n={ds.nGenes} />
      </div>

      <DivergentTable examples={ds.divergent} />

      <div className="bg-slate-800/40 border border-slate-600/30 rounded-xl p-4">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Dataset Summary (paper-ready)</h3>
        <p className="text-sm text-slate-300 leading-relaxed">{ds.conclusion}</p>
      </div>
    </div>
  );
}

// ─── CSV export ───────────────────────────────────────────────────────────────

function downloadCSV(ds: DatasetResult) {
  const header = "Gene,Category,Eigenvalue,CosinorR2,JtkTau,CosinorRhythmic,JtkRhythmic";
  const rows = ds.scatterData.map(d =>
    `${d.gene},${d.category},${d.eigenvalue},${d.cosinorR2},${d.jtkTau},${d.cosinorRhythmic},${d.jtkRhythmic}`
  );
  const blob = new Blob([header + "\n" + rows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `methods_benchmark_${ds.datasetId}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function MethodsBenchmark() {
  const [result, setResult] = useState<MethodsPaperResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchBenchmark = async () => {
    try {
      const res = await fetch("/api/benchmarks/methods-paper");
      if (res.status === 202) {
        return false; // still computing
      }
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      setResult(data);
      setLoading(false);
      return true;
    } catch (e: any) {
      setError(e.message ?? "Unknown error");
      setLoading(false);
      return true;
    }
  };

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      const done = await fetchBenchmark();
      if (!done && alive) {
        pollRef.current = setInterval(async () => {
          const finished = await fetchBenchmark();
          if (finished && pollRef.current) {
            clearInterval(pollRef.current);
          }
        }, 4000);
      }
    };
    poll();
    return () => {
      alive = false;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-amber-950/20 to-slate-900 border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">Methods Paper Benchmark</Badge>
                <Badge className="bg-slate-700/50 text-slate-400 border-slate-600/30 text-xs">GEO Public Data</Badge>
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">
                AR(2) |λ| vs Cosinor vs JTK_CYCLE
              </h1>
              <p className="text-slate-400 max-w-2xl">
                Genome-wide three-way comparison on two independent public GEO datasets.
                AR(2) eigenvalue modulus captures temporal persistence — a distinct axis
                orthogonal to sinusoidal rhythmicity measured by cosinor and JTK_CYCLE.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Loading state */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4" data-testid="loading-benchmark">
            <div className="w-10 h-10 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            <div className="text-slate-400 text-sm">Running genome-wide analysis across two datasets…</div>
            <div className="text-slate-600 text-xs">AR(2) · Cosinor · JTK_CYCLE on ~35,000 genes total</div>
          </div>
        )}

        {error && (
          <div className="bg-red-900/30 border border-red-700/50 rounded-xl p-6 text-red-300" data-testid="error-benchmark">
            <p className="font-semibold">Benchmark error</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        {result && !loading && (
          <>
            {/* Cross-dataset summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
              <StatCard
                label="AR(2)-unique range"
                value={result.crossDatasetSummary.ar2UniqueRangeStr}
                sub="high |λ|, not rhythmic by cosinor/JTK"
                color="text-amber-400"
              />
              <StatCard
                label="Rhythmic, low pers."
                value={result.crossDatasetSummary.rhythmicLowPersRangeStr}
                sub="cosinor+JTK pos. but |λ|<0.5"
                color="text-blue-400"
              />
              <StatCard
                label="ρ(|λ|, cosinor R²)"
                value={result.crossDatasetSummary.corrRangeStr}
                sub="Spearman, both datasets"
                color="text-slate-200"
              />
              <StatCard
                label="Clock gene consistency"
                value={result.crossDatasetSummary.clockGeneConsistency.split(":")[0]}
                sub={result.crossDatasetSummary.clockGeneConsistency.split(":")[1]?.trim()}
                color="text-emerald-400"
              />
            </div>

            {/* Per-dataset tabs */}
            <Tabs defaultValue={result.datasets[0]?.datasetId} className="mb-8">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <TabsList className="bg-slate-800/60 border border-slate-700/50">
                  {result.datasets.map(ds => (
                    <TabsTrigger key={ds.datasetId} value={ds.datasetId}
                      className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-300 text-slate-400"
                      data-testid={`tab-dataset-${ds.datasetId}`}>
                      {ds.datasetName}
                    </TabsTrigger>
                  ))}
                  <TabsTrigger value="summary"
                    className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-300 text-slate-400"
                    data-testid="tab-dataset-summary">
                    Summary
                  </TabsTrigger>
                </TabsList>

                <div className="flex gap-2 flex-wrap">
                  {result.datasets.map(ds => (
                    <Button key={ds.datasetId} variant="outline" size="sm"
                      className="border-slate-600 text-slate-300 hover:bg-slate-700 text-xs"
                      onClick={() => downloadCSV(ds)}
                      data-testid={`btn-export-${ds.datasetId}`}>
                      Export {ds.geoAccession} CSV
                    </Button>
                  ))}
                  <Button variant="outline" size="sm"
                    className="border-amber-600/50 text-amber-400 hover:bg-amber-500/10 text-xs gap-1.5"
                    onClick={() => { window.open('/api/download/methods-paper-pdf', '_blank'); }}
                    data-testid="btn-download-methods-pdf">
                    ↓ Download Methods Paper PDF
                  </Button>
                </div>
              </div>

              {result.datasets.map(ds => (
                <TabsContent key={ds.datasetId} value={ds.datasetId}>
                  <div className="flex items-center gap-3 mb-4">
                    <div>
                      <div className="text-sm font-semibold text-slate-200">{ds.datasetName}</div>
                      <div className="text-xs text-slate-500">
                        {ds.species} · {ds.tissue} · {ds.nTimepoints} timepoints @ {ds.resolutionHours}h resolution · {ds.nGenes.toLocaleString()} genes
                      </div>
                    </div>
                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs ml-auto">
                      {ds.geoAccession}
                    </Badge>
                  </div>
                  <DatasetPanel ds={ds} />
                </TabsContent>
              ))}

              <TabsContent value="summary">
                <div className="space-y-6">
                  <Card className="bg-slate-800/40 border-slate-700/40">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base text-slate-200">Paper Conclusion</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-slate-300 leading-relaxed">
                        {result.crossDatasetSummary.paperConclusion}
                      </p>
                    </CardContent>
                  </Card>

                  <div className="grid md:grid-cols-2 gap-5">
                    {result.datasets.map(ds => (
                      <Card key={ds.datasetId} className="bg-slate-800/40 border-slate-700/40">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
                            {ds.datasetName}
                            <Badge className="text-xs bg-slate-700/50 text-slate-400 border-slate-600/30">{ds.geoAccession}</Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {[
                            ["AR(2) |λ|≥0.5", `${ds.ar2HighPct}%`, "text-amber-400"],
                            ["Cosinor rhythmic", `${ds.cosinorRhythmicPct}%`, "text-blue-400"],
                            ["JTK rhythmic", `${ds.jtkRhythmicPct}%`, "text-violet-400"],
                            ["AR(2)-unique", `${ds.ar2UniquePct}%`, "text-emerald-400"],
                            ["ρ(|λ|, cosinor R²)", ds.corrEigenvalueCosinorR2.toFixed(3), "text-slate-300"],
                            ["Clock genes (all 3)", `${ds.clockGenes.all3}/${ds.clockGenes.total}`, "text-emerald-400"],
                          ].map(([label, val, color]) => (
                            <div key={label as string} className="flex justify-between text-xs">
                              <span className="text-slate-400">{label}</span>
                              <span className={`font-mono font-bold ${color}`}>{val}</span>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <Card className="bg-slate-800/40 border-slate-700/40">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-slate-300">Methods Note</CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-slate-400 space-y-1.5">
                      <p>
                        <strong className="text-slate-300">AR(2) |λ|:</strong> Yule–Walker estimation. |λ| = modulus of the dominant eigenvalue of the companion matrix. |λ|≥0.5 threshold.
                      </p>
                      <p>
                        <strong className="text-slate-300">Cosinor:</strong> OLS fit of A + β·cos(2πt/24) + γ·sin(2πt/24). F-test p-value, BH-FDR q&lt;0.05.
                      </p>
                      <p>
                        <strong className="text-slate-300">JTK_CYCLE:</strong> Kendall τ-b nonparametric rank correlation against cosine references (periods 20, 24, 28h). Bonferroni correction within gene, BH-FDR across genes, q&lt;0.05.
                      </p>
                      <p>
                        <strong className="text-slate-300">Scatter data:</strong> All clock + target genes shown, plus random sample of 300 background genes.
                      </p>
                    </CardContent>
                  </Card>

                  <div className="flex justify-center">
                    <p className="text-xs text-slate-600">
                      Computed: {new Date(result.computedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
}
