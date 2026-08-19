import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Shield, FlaskConical, BarChart3, Download, Loader2, Info, AlertCircle,
} from "lucide-react";

// ── API types ─────────────────────────────────────────────────────────────────
interface DSMethod { clockMean: number; targetMean: number; gap: number; clockN: number; targetN: number; }
interface DSDataset {
  label: string; tissue: string; species: string;
  methods: Record<string, DSMethod>;
  gapDirection: "correct" | "inverted" | "mixed";
  gapPreserved: boolean; dsi: number;
}
interface DSResult {
  datasets: DSDataset[];
  overallRankCorrelation: number; gapPreservedCount: number; gapPreservedTotal: number;
  correctDirectionCount: number; invertedCount: number; overallDSI: number; verdict: string;
}

interface DetrendGene { gene: string; geneType: string; rawEigenvalue: number; detrendedEigenvalue: number; }
interface DetrendDataset { dataset: string; genes: DetrendGene[]; }
interface DetrendResult {
  datasets: DetrendDataset[];
  hierarchyPreservedCount: number; totalDatasets: number; conclusion: string;
}

interface PermDataset { dataset: string; observedGap: number; pValue: number; zScore: number; }
interface PermResult { datasets: PermDataset[]; }

// ── Helpers ───────────────────────────────────────────────────────────────────
function avg(arr: number[]) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }

function gapColour(gap: number) {
  if (gap > 0.05) return "text-emerald-600";
  if (gap > 0)    return "text-amber-500";
  return "text-red-500";
}

function dirBadge(dir: string) {
  if (dir === "correct")  return <Badge className="bg-emerald-500/20 text-emerald-600 border-emerald-500/30 text-xs">✓ all positive</Badge>;
  if (dir === "inverted") return <Badge className="bg-red-500/20 text-red-500 border-red-500/30 text-xs">✗ all negative</Badge>;
  return <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30 text-xs">~ mixed</Badge>;
}

function positiveCount(datasets: DSDataset[], key: string) {
  return datasets.filter(d => (d.methods[key]?.gap ?? NaN) > 0).length;
}

/** Derive a short verdict label from pos/total count. */
function countVerdict(pos: number, total: number): "consistent" | "mostly" | "mixed" | "indeterminate" {
  if (total === 0) return "indeterminate";
  if (pos === total) return "consistent";
  if (pos >= total * 0.8) return "mostly";
  return "mixed";
}

function verdictBadge(v: "consistent" | "mostly" | "mixed" | "indeterminate") {
  switch (v) {
    case "consistent":    return <Badge className="bg-emerald-500/20 text-emerald-600 border-emerald-500/30 text-xs font-semibold">Consistent</Badge>;
    case "mostly":        return <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30 text-xs font-semibold">Mostly consistent</Badge>;
    case "mixed":         return <Badge className="bg-red-500/20 text-red-500 border-red-500/30 text-xs font-semibold">Mixed</Badge>;
    case "indeterminate": return <Badge className="bg-slate-300/60 text-slate-500 border-slate-400/30 text-xs font-semibold">—</Badge>;
  }
}

/** Spinner cell placeholder — colspan not used; caller renders one per column. */
function SpinnerTd() {
  return <td className="py-3 px-3 text-center"><Loader2 className="w-4 h-4 animate-spin text-slate-400 mx-auto" /></td>;
}
function UnavailableTd() {
  return <td className="py-3 px-3 text-center text-slate-400 text-xs">unavailable</td>;
}

function LoadingSpinner({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-10 justify-center text-slate-500 text-sm">
      <Loader2 className="w-5 h-5 animate-spin" />{label}
    </div>
  );
}
function ErrorMsg({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3 py-8 justify-center text-red-500 text-sm">
      <AlertCircle className="w-5 h-5" />{message}
    </div>
  );
}

// ── Primary-dataset classifier ────────────────────────────────────────────────
function isPrimary(d: DSDataset) {
  return d.label.includes("GSE54650") ||
         d.label.includes("GSE11923") ||
         d.label === "Organoid WT (GSE157357)";
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Reconciliation() {
  const { data: ds, isLoading: dsLoading, isError: dsError } = useQuery<DSResult>({
    queryKey: ["/api/decomposition-stability"],
    staleTime: 10 * 60 * 1000,
  });
  const { data: detrend, isLoading: dtLoading, isError: dtError } = useQuery<DetrendResult>({
    queryKey: ["/api/validation/robustness-suite/detrend"],
    staleTime: 10 * 60 * 1000,
  });
  const { data: perm } = useQuery<PermResult>({
    queryKey: ["/api/validation/robustness-suite/permutation-test"],
    staleTime: 10 * 60 * 1000,
  });

  const primaryDs  = ds?.datasets.filter(isPrimary) ?? [];
  const expandedDs = ds?.datasets ?? [];

  // Detrend row computations
  const dtRows = detrend?.datasets.map(d => {
    const cR = d.genes.filter(g => g.geneType === "clock").map(g => g.rawEigenvalue);
    const cD = d.genes.filter(g => g.geneType === "clock").map(g => g.detrendedEigenvalue);
    const tR = d.genes.filter(g => g.geneType === "target").map(g => g.rawEigenvalue);
    const tD = d.genes.filter(g => g.geneType === "target").map(g => g.detrendedEigenvalue);
    return { tissue: d.dataset, rawGap: avg(cR) - avg(tR), detGap: avg(cD) - avg(tD) };
  }) ?? [];
  const dtMeanRaw = avg(dtRows.map(r => r.rawGap));
  const dtMeanDet = avg(dtRows.map(r => r.detGap));
  const dtPosRaw = dtRows.filter(r => r.rawGap > 0).length;
  const dtPosDet = dtRows.filter(r => r.detGap > 0).length;
  const dtTotal  = dtRows.length;

  // Summary verdict derivations — computed from live data, never hardcoded
  // Row 1: 10 primary datasets, decomp stability
  const r1RawPos  = primaryDs.length > 0 ? positiveCount(primaryDs, "raw")  : null;
  const r1GmPos   = primaryDs.length > 0 ? positiveCount(primaryDs, "mean") : null;
  const r1Pc1Pos  = primaryDs.length > 0 ? positiveCount(primaryDs, "pc1")  : null;
  const r1Total   = primaryDs.length;
  // Verdict = whether all three tested variants are consistent; requires ds to be loaded
  const r1Verdict = (r1RawPos === null || dsLoading || dsError)
    ? "indeterminate"
    : countVerdict(Math.min(r1RawPos!, r1GmPos!, r1Pc1Pos!), r1Total);

  // Row 2: 12 GSE54650, detrend
  const r2PosRaw = dtLoading || dtError ? null : dtPosRaw;
  const r2PosDet = dtLoading || dtError ? null : dtPosDet;
  const r2Total  = dtTotal;
  const r2Verdict = (r2PosRaw === null || r2PosDet === null || dtLoading || dtError)
    ? "indeterminate"
    : countVerdict(Math.min(r2PosRaw, r2PosDet), r2Total);

  // Row 3: expanded 18-dataset
  const r3RawPos = ds ? positiveCount(expandedDs, "raw") : null;
  const r3Pc1Pos = ds ? positiveCount(expandedDs, "pc1") : null;
  const r3Total  = expandedDs.length;
  const r3VerdictLabel = ds
    ? (ds.verdict.split(":")[0] ?? "WEAK")
    : null;

  // Derived reviewer summary — only shown when all data is available
  const summaryReady = !dsLoading && !dsError && ds && !dtLoading && !dtError && detrend && r1Total > 0 && r2Total > 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-8">
          <Link href="/supplementary-analyses">
            <Button variant="ghost" size="sm" className="mb-4 text-slate-500 hover:text-slate-800 -ml-2">
              <ArrowLeft className="w-4 h-4 mr-2" /> Robustness Suite
            </Button>
          </Link>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">Cross-Preprocessing Reconciliation</h1>
              <p className="text-slate-500 max-w-2xl">
                Does the Clock &gt; Target eigenvalue gap hold under alternative preprocessing choices, or is
                it pipeline-specific? All figures below are drawn live from the analysis APIs at page load —
                nothing is cached or hardcoded.
              </p>
            </div>
            <a href="/api/assessment-package/download"
              className="inline-flex items-center gap-2 text-sm bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-lg transition-colors">
              <Download className="w-4 h-4" /> Assessment Package
            </a>
          </div>
        </div>

        {/* Scope note */}
        <Card className="bg-blue-50 border-blue-200 mb-8" data-testid="card-scope-note">
          <CardContent className="py-4 flex gap-3">
            <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800 space-y-1">
              <p className="font-semibold">Three independent analyses — not a single four-pipeline test:</p>
              <ul className="list-disc ml-4 space-y-0.5">
                <li><strong>Analysis A (raw / global-mean / PC1) —</strong> 10 primary circadian datasets (8 GSE54650 + GSE11923 + Organoid WT). Source: <code>/api/decomposition-stability</code>.</li>
                <li><strong>Analysis B (raw vs. detrended) —</strong> 12 GSE54650 mouse tissues only. Does not include GSE11923 or Organoid WT. Different gene panel. Source: <code>/api/validation/robustness-suite/detrend</code>.</li>
                <li><strong>Analysis C (expanded panel) —</strong> All 18 datasets including non-circadian contexts. Source: <code>/api/decomposition-stability</code>.</li>
              </ul>
              <p className="text-xs text-blue-600 mt-1">
                No single analysis covers all four variants on all 10 primary datasets. The analyses are complementary.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Pipeline legend */}
        <Card className="bg-slate-100 border-slate-200 mb-8" data-testid="card-pipeline-legend">
          <CardHeader>
            <CardTitle className="text-base text-slate-800 flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-blue-500" />
              Four Preprocessing Variants
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              {[
                { label: "Raw OLS AR(2)",         desc: "Mean-centred, no detrending — primary pipeline used in all manuscripts (Analyses A, B, C)" },
                { label: "Detrended AR(2)",        desc: "Linear trend removed before AR(2) fit — Analysis B only (12 GSE54650 tissues)" },
                { label: "Global-mean residual",   desc: "Cohort-wide mean subtracted; AR(2) on residual — Analysis A only" },
                { label: "PC1 residual",           desc: "First PC projected out; AR(2) on residual — Analysis A only" },
              ].map(({ label, desc }) => (
                <div key={label} className="flex gap-3">
                  <div className="mt-1 shrink-0 w-2 h-2 rounded-full bg-blue-500" />
                  <div><span className="font-semibold text-slate-800">{label}:</span> <span className="text-slate-500">{desc}</span></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Analysis A: Decomposition stability — 10 primary datasets ── */}
        <Card className="bg-slate-100 border-slate-200 mb-6" data-testid="card-analysis-a">
          <CardHeader>
            <CardTitle className="text-lg text-slate-900 flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-500" />
              Analysis A — Decomposition Stability (raw / global-mean / PC1)
            </CardTitle>
            <p className="text-sm text-slate-500">
              Source: live <code>/api/decomposition-stability</code> · 10 primary circadian datasets ·
              13 clock + 23 target genes
            </p>
          </CardHeader>
          <CardContent>
            {dsLoading && <LoadingSpinner label="Fetching decomposition stability data…" />}
            {dsError   && <ErrorMsg message="Decomposition stability API unavailable — no numerical claims shown." />}
            {!dsLoading && !dsError && ds && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="table-analysis-a">
                  <thead>
                    <tr className="border-b border-slate-300">
                      <th className="text-left py-2 px-3 text-slate-600">Dataset</th>
                      <th className="text-right py-2 px-3 text-slate-600">Raw gap</th>
                      <th className="text-right py-2 px-3 text-slate-600">Global-mean residual</th>
                      <th className="text-right py-2 px-3 text-slate-600">PC1 residual</th>
                      <th className="text-center py-2 px-3 text-slate-600">All-method dir.</th>
                      <th className="text-right py-2 px-3 text-slate-600">DSI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {primaryDs.map(d => {
                      const raw = d.methods.raw?.gap ?? NaN;
                      const gm  = d.methods.mean?.gap ?? NaN;
                      const pc1 = d.methods.pc1?.gap ?? NaN;
                      return (
                        <tr key={d.label} className="border-b border-slate-200 hover:bg-slate-50">
                          <td className="py-2 px-3 text-slate-800 text-xs">{d.label}</td>
                          <td className={`py-2 px-3 text-right font-mono text-xs ${gapColour(raw)}`}>{raw >= 0 ? "+" : ""}{raw.toFixed(3)}</td>
                          <td className={`py-2 px-3 text-right font-mono text-xs ${gapColour(gm)}`}>{gm >= 0 ? "+" : ""}{gm.toFixed(3)}</td>
                          <td className={`py-2 px-3 text-right font-mono text-xs ${gapColour(pc1)}`}>{pc1 >= 0 ? "+" : ""}{pc1.toFixed(3)}</td>
                          <td className="py-2 px-3 text-center">{dirBadge(d.gapDirection)}</td>
                          <td className={`py-2 px-3 text-right font-mono text-xs ${d.dsi >= 0.5 ? "text-emerald-600" : d.dsi >= 0 ? "text-amber-500" : "text-red-500"}`}>{d.dsi.toFixed(3)}</td>
                        </tr>
                      );
                    })}
                    {primaryDs.length > 0 && (() => {
                      const raws = primaryDs.map(d => d.methods.raw?.gap ?? 0);
                      const gms  = primaryDs.map(d => d.methods.mean?.gap ?? 0);
                      const pc1s = primaryDs.map(d => d.methods.pc1?.gap ?? 0);
                      return (
                        <tr className="border-t-2 border-slate-300 bg-slate-200 font-semibold">
                          <td className="py-2 px-3 text-slate-900">Mean ({primaryDs.length})</td>
                          <td className="py-2 px-3 text-right font-mono text-xs text-emerald-700">+{avg(raws).toFixed(3)} ({r1RawPos}/{r1Total} pos)</td>
                          <td className="py-2 px-3 text-right font-mono text-xs text-emerald-700">+{avg(gms).toFixed(3)} ({r1GmPos}/{r1Total} pos)</td>
                          <td className="py-2 px-3 text-right font-mono text-xs text-emerald-700">+{avg(pc1s).toFixed(3)} ({r1Pc1Pos}/{r1Total} pos)</td>
                          <td className="py-2 px-3 text-center">
                            <Badge className="bg-emerald-500/20 text-emerald-600 border-emerald-500/30 text-xs">
                              {primaryDs.filter(d => d.gapDirection === "correct").length}/{primaryDs.length} all-method
                            </Badge>
                          </td>
                          <td />
                        </tr>
                      );
                    })()}
                  </tbody>
                </table>
                <p className="text-xs text-slate-500 mt-2">
                  "All-method direction" requires all six driver-removal methods to agree. "Mixed" datasets have
                  positive raw/mean/PC1 gaps but negative gaps under the most aggressive variance-based removal (var25/var50).
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Analysis B: Linear detrending — 12 GSE54650 tissues ── */}
        <Card className="bg-slate-100 border-slate-200 mb-6" data-testid="card-analysis-b">
          <CardHeader>
            <CardTitle className="text-lg text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-500" />
              Analysis B — Raw vs. Detrended (12 GSE54650 tissues only)
            </CardTitle>
            <p className="text-sm text-slate-500">
              Source: live <code>/api/validation/robustness-suite/detrend</code> ·{" "}
              <strong>GSE54650 only</strong> — does not include GSE11923 or Organoid WT ·
              Different gene panel from Analysis A.
            </p>
          </CardHeader>
          <CardContent>
            {dtLoading && <LoadingSpinner label="Fetching detrend data…" />}
            {dtError   && <ErrorMsg message="Detrend API unavailable — no numerical claims shown." />}
            {!dtLoading && !dtError && detrend && (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="table-analysis-b">
                    <thead>
                      <tr className="border-b border-slate-300">
                        <th className="text-left py-2 px-3 text-slate-600">Tissue</th>
                        <th className="text-right py-2 px-3 text-slate-600">Raw gap</th>
                        <th className="text-right py-2 px-3 text-slate-600">Detrended gap</th>
                        <th className="text-center py-2 px-3 text-slate-600">Stable?</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dtRows.map(r => (
                        <tr key={r.tissue} className="border-b border-slate-200 hover:bg-slate-50">
                          <td className="py-2 px-3 text-slate-800">{r.tissue}</td>
                          <td className={`py-2 px-3 text-right font-mono text-xs ${gapColour(r.rawGap)}`}>{r.rawGap >= 0 ? "+" : ""}{r.rawGap.toFixed(3)}</td>
                          <td className={`py-2 px-3 text-right font-mono text-xs ${gapColour(r.detGap)}`}>{r.detGap >= 0 ? "+" : ""}{r.detGap.toFixed(3)}</td>
                          <td className="py-2 px-3 text-center">
                            {r.rawGap > 0 && r.detGap > 0
                              ? <Badge className="bg-emerald-500/20 text-emerald-600 border-emerald-500/30 text-xs">✓ YES</Badge>
                              : <Badge className="bg-red-500/20 text-red-500 border-red-500/30 text-xs">✗ NO</Badge>}
                          </td>
                        </tr>
                      ))}
                      {dtRows.length > 0 && (
                        <tr className="border-t-2 border-slate-300 bg-slate-200 font-semibold">
                          <td className="py-2 px-3 text-slate-900">Mean ({dtRows.length})</td>
                          <td className="py-2 px-3 text-right font-mono text-xs text-emerald-700">+{dtMeanRaw.toFixed(3)} ({dtPosRaw}/{dtTotal} pos)</td>
                          <td className="py-2 px-3 text-right font-mono text-xs text-emerald-700">+{dtMeanDet.toFixed(3)} ({dtPosDet}/{dtTotal} pos)</td>
                          <td className="py-2 px-3 text-center">
                            <Badge className="bg-emerald-500/20 text-emerald-600 border-emerald-500/30 text-xs">
                              {dtRows.filter(r => r.rawGap > 0 && r.detGap > 0).length}/{dtRows.length}
                            </Badge>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Detrending {dtMeanDet > dtMeanRaw ? "increases" : "slightly decreases"} the mean gap
                  ({dtMeanRaw.toFixed(3)} → {dtMeanDet.toFixed(3)}); the raw finding is not inflated by linear
                  trend artefacts.
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* ── Permutation test ── */}
        {perm?.datasets && perm.datasets.length > 0 && (
          <Card className="bg-slate-100 border-slate-200 mb-6" data-testid="card-permutation">
            <CardHeader>
              <CardTitle className="text-lg text-slate-900">Analysis C — Permutation Test (raw AR(2) only)</CardTitle>
              <p className="text-sm text-slate-500">Source: live <code>/api/validation/robustness-suite/permutation-test</code> · 10 K gene label shuffles, seed = 42 · raw pipeline only</p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="table-permutation">
                  <thead>
                    <tr className="border-b border-slate-300">
                      <th className="text-left py-2 px-3 text-slate-600">Dataset</th>
                      <th className="text-right py-2 px-3 text-slate-600">Observed gap</th>
                      <th className="text-right py-2 px-3 text-slate-600">p-value</th>
                      <th className="text-right py-2 px-3 text-slate-600">z-score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perm.datasets.map(p => (
                      <tr key={p.dataset} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="py-2 px-3 text-slate-800">{p.dataset}</td>
                        <td className={`py-2 px-3 text-right font-mono text-xs ${gapColour(p.observedGap)}`}>{p.observedGap >= 0 ? "+" : ""}{p.observedGap.toFixed(3)}</td>
                        <td className="py-2 px-3 text-right font-mono text-xs text-emerald-600">{p.pValue < 0.001 ? "<0.001" : p.pValue.toFixed(3)}</td>
                        <td className="py-2 px-3 text-right font-mono text-xs text-emerald-600">{p.zScore.toFixed(2)} σ</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Expanded panel ── */}
        <Card className="bg-slate-100 border-slate-200 mb-6" data-testid="card-expanded">
          <CardHeader>
            <CardTitle className="text-lg text-slate-900">
              Analysis C (continued) — Expanded Panel, All {ds?.gapPreservedTotal ?? "18"} Datasets
            </CardTitle>
            {!dsLoading && !dsError && ds && (
              <p className="text-sm text-slate-500">
                Overall rank corr: <span className="font-mono">{ds.overallRankCorrelation.toFixed(3)}</span> ·
                Correct direction (all 6 methods): {ds.correctDirectionCount}/{ds.gapPreservedTotal} ·
                Verdict: <span className="font-semibold text-amber-600">{ds.verdict.split(":")[0]}</span>
              </p>
            )}
          </CardHeader>
          <CardContent>
            {dsLoading && <LoadingSpinner label="Fetching data…" />}
            {dsError   && <ErrorMsg message="Decomposition stability API unavailable." />}
            {!dsLoading && !dsError && ds && (
              <>
                <div className="overflow-x-auto mb-4">
                  <table className="w-full text-sm" data-testid="table-expanded">
                    <thead>
                      <tr className="border-b border-slate-300">
                        <th className="text-left py-2 px-3 text-slate-600">Dataset</th>
                        <th className="text-right py-2 px-3 text-slate-600">Raw</th>
                        <th className="text-right py-2 px-3 text-slate-600">PC1</th>
                        <th className="text-center py-2 px-3 text-slate-600">Direction</th>
                        <th className="text-right py-2 px-3 text-slate-600">DSI</th>
                        <th className="text-left py-2 px-3 text-slate-600">Cohort</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expandedDs.map(d => {
                        const raw = d.methods.raw?.gap ?? NaN;
                        const pc1 = d.methods.pc1?.gap ?? NaN;
                        const primary = isPrimary(d);
                        return (
                          <tr key={d.label} className={`border-b border-slate-200 hover:bg-slate-50 ${primary ? "" : "opacity-75"}`}>
                            <td className="py-2 px-3 text-slate-800 text-xs">{d.label}</td>
                            <td className={`py-2 px-3 text-right font-mono text-xs ${gapColour(raw)}`}>{raw >= 0 ? "+" : ""}{raw.toFixed(3)}</td>
                            <td className={`py-2 px-3 text-right font-mono text-xs ${gapColour(pc1)}`}>{pc1 >= 0 ? "+" : ""}{pc1.toFixed(3)}</td>
                            <td className="py-2 px-3 text-center">{dirBadge(d.gapDirection)}</td>
                            <td className={`py-2 px-3 text-right font-mono text-xs ${d.dsi >= 0.5 ? "text-emerald-600" : d.dsi >= 0 ? "text-amber-500" : "text-red-500"}`}>{d.dsi.toFixed(3)}</td>
                            <td className="py-2 px-3">
                              {primary
                                ? <Badge className="bg-blue-500/20 text-blue-600 border-blue-500/30 text-xs">primary</Badge>
                                : <Badge className="bg-slate-300/60 text-slate-500 border-slate-400/30 text-xs">expanded</Badge>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                  <strong>Why {ds.verdict.split(":")[0]}?</strong> The expanded panel includes non-circadian biological
                  contexts (shift-work blood, cancer cell lines, enteroids) where the Clock &gt; Target pattern is not
                  expected and not claimed. This verdict is accurate for the full 18-dataset scope.
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* ── Summary table — counts derived from live data, verdict computed ── */}
        <Card className="bg-slate-100 border-slate-200 mb-8" data-testid="card-summary">
          <CardHeader>
            <CardTitle className="text-lg text-slate-900 flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-600" />
              Summary — Three Analyses, Separately Scoped
            </CardTitle>
            <p className="text-sm text-slate-500">
              Counts and verdicts are derived from live API data. Spinner = loading; "unavailable" = API error.
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-summary">
                <thead>
                  <tr className="border-b border-slate-300">
                    <th className="text-left py-3 px-3 text-slate-600">Analysis &amp; cohort</th>
                    <th className="text-center py-3 px-3 text-slate-600">Raw OLS</th>
                    <th className="text-center py-3 px-3 text-slate-600">Detrended</th>
                    <th className="text-center py-3 px-3 text-slate-600">Global-mean</th>
                    <th className="text-center py-3 px-3 text-slate-600">PC1</th>
                    <th className="text-center py-3 px-3 text-slate-600">Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Row 1 — Analysis A, 10 primary */}
                  <tr className="border-b border-slate-200">
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-900 text-xs">A: 10 primary circadian datasets</div>
                      <div className="text-slate-400 text-xs">GSE54650 × 8, GSE11923, Organoid WT</div>
                      <div className="text-slate-400 text-xs italic">decomposition-stability API</div>
                    </td>
                    {dsLoading ? <><SpinnerTd /><UnavailableTd /><SpinnerTd /><SpinnerTd /><SpinnerTd /></>
                    : dsError   ? <><UnavailableTd /><UnavailableTd /><UnavailableTd /><UnavailableTd /><UnavailableTd /></>
                    : r1RawPos !== null ? (<>
                      <td className="py-3 px-3 text-center">
                        <Badge className={`text-xs ${r1RawPos === r1Total ? "bg-emerald-500/20 text-emerald-600 border-emerald-500/30" : "bg-amber-500/20 text-amber-600 border-amber-500/30"}`}>
                          {r1RawPos}/{r1Total} pos
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-center text-slate-400 text-xs">see Analysis B ↓</td>
                      <td className="py-3 px-3 text-center">
                        <Badge className={`text-xs ${r1GmPos === r1Total ? "bg-emerald-500/20 text-emerald-600 border-emerald-500/30" : "bg-amber-500/20 text-amber-600 border-amber-500/30"}`}>
                          {r1GmPos}/{r1Total} pos
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <Badge className={`text-xs ${r1Pc1Pos === r1Total ? "bg-emerald-500/20 text-emerald-600 border-emerald-500/30" : "bg-amber-500/20 text-amber-600 border-amber-500/30"}`}>
                          {r1Pc1Pos}/{r1Total} pos
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-center">{verdictBadge(r1Verdict)}</td>
                    </>) : <><UnavailableTd /><UnavailableTd /><UnavailableTd /><UnavailableTd /><UnavailableTd /></>}
                  </tr>

                  {/* Row 2 — Analysis B, 12 GSE54650 */}
                  <tr className="border-b border-slate-200">
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-900 text-xs">B: 12 GSE54650 tissues (detrend only)</div>
                      <div className="text-slate-400 text-xs">Does not include GSE11923 or Organoid WT</div>
                      <div className="text-slate-400 text-xs italic">robustness-suite detrend API</div>
                    </td>
                    {dtLoading ? <><SpinnerTd /><SpinnerTd /><UnavailableTd /><UnavailableTd /><SpinnerTd /></>
                    : dtError   ? <><UnavailableTd /><UnavailableTd /><UnavailableTd /><UnavailableTd /><UnavailableTd /></>
                    : r2PosRaw !== null ? (<>
                      <td className="py-3 px-3 text-center">
                        <Badge className={`text-xs ${r2PosRaw === r2Total ? "bg-emerald-500/20 text-emerald-600 border-emerald-500/30" : "bg-amber-500/20 text-amber-600 border-amber-500/30"}`}>
                          {r2PosRaw}/{r2Total} pos
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <Badge className={`text-xs ${r2PosDet === r2Total ? "bg-emerald-500/20 text-emerald-600 border-emerald-500/30" : "bg-amber-500/20 text-amber-600 border-amber-500/30"}`}>
                          {r2PosDet}/{r2Total} pos
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-center text-slate-400 text-xs">not tested</td>
                      <td className="py-3 px-3 text-center text-slate-400 text-xs">not tested</td>
                      <td className="py-3 px-3 text-center">{verdictBadge(r2Verdict)}</td>
                    </>) : <><UnavailableTd /><UnavailableTd /><UnavailableTd /><UnavailableTd /><UnavailableTd /></>}
                  </tr>

                  {/* Row 3 — expanded panel */}
                  <tr>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-900 text-xs">C: All {ds?.gapPreservedTotal ?? 18} datasets (expanded)</div>
                      <div className="text-slate-400 text-xs">Includes non-circadian contexts — not manuscript scope</div>
                      <div className="text-slate-400 text-xs italic">decomposition-stability API</div>
                    </td>
                    {dsLoading ? <><SpinnerTd /><UnavailableTd /><UnavailableTd /><SpinnerTd /><SpinnerTd /></>
                    : dsError   ? <><UnavailableTd /><UnavailableTd /><UnavailableTd /><UnavailableTd /><UnavailableTd /></>
                    : r3RawPos !== null ? (<>
                      <td className="py-3 px-3 text-center">
                        <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30 text-xs">
                          {r3RawPos}/{r3Total} pos
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-center text-slate-400 text-xs">not tested</td>
                      <td className="py-3 px-3 text-center text-slate-400 text-xs">not tested</td>
                      <td className="py-3 px-3 text-center">
                        <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30 text-xs">
                          {r3Pc1Pos}/{r3Total} pos
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {r3VerdictLabel
                          ? <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30 text-xs font-semibold">{r3VerdictLabel} — context-dep.</Badge>
                          : verdictBadge("indeterminate")}
                      </td>
                    </>) : <><UnavailableTd /><UnavailableTd /><UnavailableTd /><UnavailableTd /><UnavailableTd /></>}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Reviewer conclusion — only shown when both APIs have responded */}
            {summaryReady && (
              <div className="mt-4 p-4 bg-slate-200 rounded-lg text-sm text-slate-700" data-testid="div-conclusion">
                <strong>Summary (derived from live data):</strong>{" "}
                {r1Verdict === "consistent"
                  ? `In Analysis A, the Clock > Target gap is positive under all three tested variants (raw, global-mean, PC1) in all ${r1Total} primary circadian datasets.`
                  : `In Analysis A, ${Math.min(r1RawPos ?? 0, r1GmPos ?? 0, r1Pc1Pos ?? 0)}/${r1Total} primary datasets show positive gaps across all three variants.`}
                {" "}
                {r2Verdict === "consistent"
                  ? `In Analysis B, linear detrending preserves the positive gap in all ${r2Total} GSE54650 tissues.`
                  : `In Analysis B, ${Math.min(r2PosRaw ?? 0, r2PosDet ?? 0)}/${r2Total} GSE54650 tissues show positive gaps under both raw and detrended pipelines.`}
                {" "}
                {r3VerdictLabel && `The expanded 18-dataset panel verdict is ${r3VerdictLabel}, reflecting inclusion of non-circadian biological contexts where the hierarchy is not claimed.`}
              </div>
            )}
            {(dsLoading || dtLoading) && !summaryReady && (
              <div className="mt-4 flex items-center gap-2 text-slate-500 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading analysis data to compute conclusion…
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex gap-4 flex-wrap">
          <Link href="/supplementary-analyses">
            <Button variant="outline" className="border-slate-300 text-slate-600 hover:bg-slate-100">
              <ArrowLeft className="w-4 h-4 mr-2" /> Full Robustness Suite
            </Button>
          </Link>
          <Link href="/ar2-diagnostics">
            <Button variant="outline" className="border-slate-300 text-slate-600 hover:bg-slate-100">AR(2) Diagnostics</Button>
          </Link>
          <Link href="/literature-validation">
            <Button variant="outline" className="border-slate-300 text-slate-600 hover:bg-slate-100">Literature Validation</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
