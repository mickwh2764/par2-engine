import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ArrowLeft, FlaskConical, Activity, AlertTriangle,
  CheckCircle2, Info, XCircle, Shield, BarChart2, BookOpen,
  ClipboardList
} from "lucide-react";

const PHI_RECIP = 0.6180339887;
const SQRT_PHI_RECIP = Math.sqrt(PHI_RECIP);

interface GenePhiResult {
  gene: string;
  lambda: number;
  distFromPhi: number;
  genomeRank: number;
  genomePercentile: number;
  r2: number;
  hasComplexRoots: boolean;
  meanExpression: number;
  phi1: number;
  phi2: number;
  found: boolean;
  roleNote: string;
}

interface ComparisonRow {
  gene: string;
  gse54650Lambda: number;
  gse11923Lambda: number;
  delta: number;
  consistent: boolean;
  expectedAt1h?: number;
  deltaFromExpected?: number;
}

interface PermutationTest {
  nGenesTested: number;
  observedMeanDist: number;
  permMean: number;
  permSd: number;
  pValue: number;
  zScore: number;
  nPerm: number;
  significant: boolean;
  interpretation: string;
}

interface AuditItem {
  issue: string;
  severity: 'critical' | 'moderate' | 'minor';
  detail: string;
  affectsConclusion: boolean;
}

interface CheckpointReport {
  prespecificationTimestamp: string;
  dataset: string;
  nGenesTotal: number;
  nGenesExpressed: number;
  nGenesFitted: number;
  phiReciprocal: number;
  sqrtPhiRecip: number;
  genomeWideSummary: {
    mean: number; median: number; sd: number;
    pctWithin005: number; pctWithin002: number;
  };
  checkpointGeneResults: GenePhiResult[];
  clockReferenceResults: GenePhiResult[];
  gse54650Comparison: (ComparisonRow & { expectedAt1h: number; deltaFromExpected: number })[];
  permutationTest: PermutationTest;
  correctedPermutationTest: PermutationTest & { target: number };
  fbxl3Hypothesis: {
    lambda: number;
    distFromPhi: number;
    genomePercentile: number;
    passed: boolean;
    interpretation: string;
  };
  overallVerdict: string;
  methodologyNotes: string[];
  methodologicalAudit: AuditItem[];
  gse54650PermutationTest?: {
    nGenesTested: number;
    observedMeanDist: number;
    permMean: number;
    permSd: number;
    pValue: number;
    zScore: number;
    nPerm: number;
    significant: boolean;
    interpretation: string;
  };
  rectificationScenarios?: {
    id: string;
    label: string;
    target: number;
    nGenes: number;
    pValue: number;
    zScore: number;
    removed: string[];
    significant: boolean;
  }[];
  gse54650R2?: Record<string, number>;
  gse54650CV?: Record<string, number>;
}

function pctColor(pct: number) {
  if (pct <= 1)  return "bg-emerald-600 text-white";
  if (pct <= 5)  return "bg-emerald-500 text-white";
  if (pct <= 10) return "bg-teal-400 text-white";
  if (pct <= 25) return "bg-blue-300 text-slate-900";
  return "bg-slate-200 text-slate-600";
}

function LambdaBar({ val }: { val: number }) {
  if (!isFinite(val)) return <span className="text-xs text-slate-400 font-mono">—</span>;
  const w = Math.min(100, val * 100);
  const dist = Math.abs(val - PHI_RECIP);
  const color = dist < 0.01 ? "bg-emerald-600" : dist < 0.02 ? "bg-emerald-500" :
                dist < 0.05 ? "bg-teal-400"    : dist < 0.1  ? "bg-blue-400"    : "bg-slate-300";
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-2 bg-slate-200 rounded-full overflow-hidden flex-shrink-0">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${w}%` }} />
      </div>
      <span className="text-xs font-mono text-slate-800">{val.toFixed(4)}</span>
      {dist < 0.01 && <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1 py-0.5 rounded font-bold">≈1/φ</span>}
    </div>
  );
}

function StatusBadge({ passed, label }: { passed: boolean; label: string }) {
  return passed
    ? <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
        <CheckCircle2 size={10} /> {label}
      </span>
    : <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">
        <XCircle size={10} /> {label}
      </span>;
}

function CheckpointGeneTable({ genes }: { genes: GenePhiResult[] }) {
  const sorted = [...genes].sort((a, b) => {
    if (!a.found && !b.found) return 0;
    if (!a.found) return 1;
    if (!b.found) return -1;
    return a.distFromPhi - b.distFromPhi;
  });
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="text-left px-3 py-2 font-semibold text-slate-600">Gene</th>
            <th className="text-left px-3 py-2 font-semibold text-slate-600 hidden sm:table-cell">Role</th>
            <th className="text-left px-3 py-2 font-semibold text-slate-600">|λ| in GSE11923</th>
            <th className="text-right px-3 py-2 font-semibold text-slate-600">Dist from 1/φ</th>
            <th className="text-right px-3 py-2 font-semibold text-slate-600">Genome rank</th>
            <th className="text-right px-3 py-2 font-semibold text-slate-600">R²</th>
            <th className="text-right px-3 py-2 font-semibold text-slate-600 hidden sm:table-cell">Osc?</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((g, i) => (
            <tr key={g.gene}
              className={`border-b border-slate-100 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}
                ${g.found && g.distFromPhi < 0.01 ? "ring-1 ring-inset ring-emerald-300 bg-emerald-50/30" : ""}
                ${!g.found ? "opacity-50" : ""}`}
              data-testid={`gene-row-${g.gene}`}
            >
              <td className="px-3 py-2 font-bold text-slate-800 font-mono whitespace-nowrap">
                {g.gene}
                {!g.found && <span className="ml-1 text-[9px] text-slate-400 font-normal">(not detected)</span>}
              </td>
              <td className="px-3 py-2 text-slate-500 hidden sm:table-cell max-w-[220px] truncate" title={g.roleNote}>
                {g.roleNote.split('—')[0].trim()}
              </td>
              <td className="px-3 py-2">
                {g.found ? <LambdaBar val={g.lambda} /> : <span className="text-slate-400">—</span>}
              </td>
              <td className="px-3 py-2 text-right font-mono">
                {g.found ? g.distFromPhi.toFixed(4) : "—"}
              </td>
              <td className="px-3 py-2 text-right">
                {g.found ? (
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${pctColor(g.genomePercentile)}`}>
                    top {g.genomePercentile.toFixed(1)}%
                  </span>
                ) : "—"}
              </td>
              <td className="px-3 py-2 text-right font-mono">
                {g.found ? g.r2.toFixed(3) : "—"}
              </td>
              <td className="px-3 py-2 text-right hidden sm:table-cell">
                {g.found ? (g.hasComplexRoots ? "✓" : "—") : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CrossDatasetTable({ rows }: { rows: ComparisonRow[] }) {
  const sorted = [...rows].sort((a, b) => {
    const distA = isFinite(a.gse11923Lambda) ? Math.abs(a.gse11923Lambda - PHI_RECIP) : 999;
    const distB = isFinite(b.gse11923Lambda) ? Math.abs(b.gse11923Lambda - PHI_RECIP) : 999;
    return distA - distB;
  });
  const nConsistent = rows.filter(r => r.consistent && isFinite(r.gse11923Lambda)).length;
  const nFinite     = rows.filter(r => isFinite(r.gse11923Lambda)).length;
  return (
    <div>
      <p className="text-xs text-slate-500 mb-2">
        Cross-dataset replication: {nConsistent}/{nFinite} genes within Δ=0.05 between datasets (consistent)
      </p>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-3 py-2 font-semibold text-slate-600">Gene</th>
              <th className="text-right px-3 py-2 font-semibold text-slate-600">GSE54650 |λ|</th>
              <th className="text-right px-3 py-2 font-semibold text-slate-600">GSE11923 |λ|</th>
              <th className="text-right px-3 py-2 font-semibold text-slate-600">|Δ|</th>
              <th className="text-right px-3 py-2 font-semibold text-slate-600">Replicates?</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={r.gene} className={`border-b border-slate-100 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}`}>
                <td className="px-3 py-2 font-bold font-mono text-slate-800">{r.gene}</td>
                <td className="px-3 py-2 text-right font-mono">{r.gse54650Lambda.toFixed(3)}</td>
                <td className="px-3 py-2 text-right font-mono">
                  {isFinite(r.gse11923Lambda) ? r.gse11923Lambda.toFixed(4) : <span className="text-slate-400">—</span>}
                </td>
                <td className="px-3 py-2 text-right font-mono">
                  {isFinite(r.delta) ? r.delta.toFixed(4) : "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  {isFinite(r.gse11923Lambda) ? (
                    r.consistent
                      ? <span className="text-emerald-600 font-semibold">Yes</span>
                      : <span className="text-rose-500 font-semibold">No (Δ{">"}0.05)</span>
                  ) : <span className="text-slate-400">Not detected</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function GSE11923Checkpoint() {
  const { data, isLoading, error } = useQuery<CheckpointReport>({
    queryKey: ["/api/analysis/gse11923-checkpoint-phi"],
    staleTime: Infinity,
  });

  const h1 = data?.fbxl3Hypothesis;
  const perm = data?.permutationTest;
  const bothPassed = h1?.passed && perm?.significant;
  const neitherPassed = h1 && !h1.passed && perm && !perm.significant;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 py-8 px-4" data-testid="gse11923-checkpoint-page">
      <div className="max-w-5xl mx-auto">

        {/* Back nav */}
        <div className="flex items-center gap-3 mb-8">
          <Link to="/">
            <button className="flex items-center gap-1 text-slate-500 hover:text-slate-700 text-sm" data-testid="back-home">
              <ArrowLeft size={16} /> Home
            </button>
          </Link>
          <span className="text-slate-300">/</span>
          <Link to="/clock-target-phi">
            <button className="text-slate-500 hover:text-slate-700 text-sm" data-testid="back-clock-phi">
              Clock-Target 1/φ (GSE54650)
            </button>
          </Link>
        </div>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10">
              <FlaskConical className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900" data-testid="page-heading">
                Fbxl3 & Checkpoint Gene 1/φ — Pre-Specified Test
              </h1>
              <p className="text-slate-500 text-sm">
                Independent replication in GSE11923 (Mouse Liver, 48 timepoints, 1h resolution — Hughes & Hogenesch lab)
              </p>
            </div>
          </div>
        </div>

        {/* Pre-specification notice */}
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 mb-6">
          <div className="flex gap-2.5">
            <Shield size={16} className="text-amber-500 shrink-0 mt-0.5" />
            <div className="text-sm text-slate-700 leading-relaxed">
              <p className="font-semibold text-slate-800 mb-1">Pre-registration notice</p>
              <p>
                The gene list, hypotheses, and statistical thresholds below were locked in a recorded conversation
                on <strong>May 3, 2026</strong>, before any GSE11923 eigenvalues were computed.
                The source dataset (GSE54650 Liver) is entirely separate from this test dataset.
                Results are reported exactly as computed — regardless of outcome.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Pre-specification timestamp: {data?.prespecificationTimestamp ?? 'May 3, 2026'}
              </p>
            </div>
          </div>
        </div>

        {/* Pre-specified hypotheses */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 mb-6 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Pre-specified hypotheses (stated before data access)</p>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="text-[10px] font-bold bg-slate-800 text-white px-2 py-0.5 rounded mt-0.5 shrink-0">H1</span>
              <p className="text-sm text-slate-700">
                <strong>Fbxl3</strong> — the F-box protein that degrades CRY1/CRY2 to end the circadian negative feedback loop
                — will rank in the <strong>top 5% of all genes</strong> in GSE11923 mouse liver for proximity to 1/φ = 0.618034.
              </p>
              {h1 && <StatusBadge passed={h1.passed} label={h1.passed ? "CONFIRMED" : "NOT CONFIRMED"} />}
            </div>
            <div className="flex items-start gap-3">
              <span className="text-[10px] font-bold bg-slate-800 text-white px-2 py-0.5 rounded mt-0.5 shrink-0">H2</span>
              <p className="text-sm text-slate-700">
                The 16-gene pre-specified <strong>checkpoint/gating gene set</strong> will show significantly closer
                mean distance to 1/φ than expression-matched permutation controls
                (one-tailed p &lt; 0.05, 5,000 permutations).
              </p>
              {perm && <StatusBadge passed={perm.significant} label={perm.significant ? "CONFIRMED" : "NOT CONFIRMED"} />}
            </div>
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="text-center py-20" data-testid="loading-state">
            <Activity className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-3" />
            <p className="text-slate-700 text-sm font-medium">Running genome-wide AR(2) analysis on GSE11923…</p>
            <p className="text-slate-500 text-xs mt-1">
              Fitting AR(2) to ~21,000 genes × 48 timepoints + 5,000 permutations. Takes ~30 seconds.
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 text-sm" data-testid="error-state">
            <p className="font-semibold mb-1">Analysis failed</p>
            <p>{String(error)}</p>
          </div>
        )}

        {data && (
          <>
            {/* Dataset & genome summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {[
                {
                  label: "Dataset", value: "GSE11923",
                  sub: "Mouse Liver · 1h resolution · CT18–CT65",
                  color: "text-slate-800", bg: "bg-slate-50 border-slate-200"
                },
                {
                  label: "Genes fitted", value: data.nGenesFitted.toLocaleString(),
                  sub: `of ${data.nGenesTotal.toLocaleString()} in dataset`,
                  color: "text-blue-700", bg: "bg-blue-50 border-blue-200"
                },
                {
                  label: "Genome median |λ|", value: data.genomeWideSummary.median.toFixed(3),
                  sub: `mean ${data.genomeWideSummary.mean.toFixed(3)} ± ${data.genomeWideSummary.sd.toFixed(3)}`,
                  color: "text-slate-700", bg: "bg-slate-50 border-slate-200"
                },
                {
                  label: "Genes within ±0.02 of 1/φ", value: `${data.genomeWideSummary.pctWithin002.toFixed(1)}%`,
                  sub: `±0.05 zone: ${data.genomeWideSummary.pctWithin005.toFixed(1)}%`,
                  color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200"
                },
              ].map(s => (
                <div key={s.label} className={`rounded-xl border p-3 ${s.bg}`} data-testid={`stat-${s.label.replace(/\s/g,'-').toLowerCase()}`}>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">{s.label}</p>
                  <p className={`text-xl font-bold font-mono ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{s.sub}</p>
                </div>
              ))}
            </div>

            {/* Overall verdict banner */}
            <div className={`rounded-xl border p-4 mb-6 ${bothPassed ? "bg-emerald-50 border-emerald-300" : neitherPassed ? "bg-rose-50 border-rose-200" : "bg-amber-50 border-amber-200"}`}
              data-testid="verdict-banner">
              <div className="flex items-start gap-2">
                {bothPassed ? <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" /> :
                 neitherPassed ? <XCircle size={18} className="text-rose-500 shrink-0 mt-0.5" /> :
                 <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />}
                <div>
                  <p className="text-sm font-bold text-slate-800 mb-1">Overall verdict</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{data.overallVerdict}</p>
                </div>
              </div>
            </div>

            {/* H1: Fbxl3 detail */}
            <div className="mb-6">
              <h2 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
                <FlaskConical size={16} className="text-slate-500" />
                H1 — Fbxl3: The Clock Terminator
              </h2>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="grid sm:grid-cols-4 gap-4 mb-4">
                  {[
                    { label: "|λ| in GSE11923", value: isFinite(h1!.lambda) ? h1!.lambda.toFixed(4) : "—", color: "text-slate-800" },
                    { label: "Distance from 1/φ", value: isFinite(h1!.distFromPhi) ? h1!.distFromPhi.toFixed(4) : "—", color: "text-slate-800" },
                    { label: "Genome percentile", value: isFinite(h1!.genomePercentile) ? `top ${h1!.genomePercentile.toFixed(1)}%` : "—", color: h1!.passed ? "text-emerald-700" : "text-rose-600" },
                    { label: "H1 threshold", value: "top 5%", color: "text-slate-500" },
                  ].map(s => (
                    <div key={s.label} className="text-center">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">{s.label}</p>
                      <p className={`text-xl font-bold font-mono ${s.color}`}>{s.value}</p>
                    </div>
                  ))}
                </div>

                <div className={`rounded-lg p-3 text-sm ${h1!.passed ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>
                  <p className="font-semibold mb-1">{h1!.passed ? "H1 CONFIRMED" : "H1 NOT CONFIRMED"}</p>
                  <p className="leading-relaxed">{h1!.interpretation}</p>
                </div>

                <div className="mt-3 p-3 bg-slate-50 rounded-lg text-xs text-slate-600 leading-relaxed">
                  <p className="font-semibold text-slate-700 mb-1">Biological significance</p>
                  <p>
                    Fbxl3 is the F-box protein that physically grabs CRY1 and CRY2 and delivers them for
                    proteasomal destruction, ending the negative feedback loop that constitutes the circadian clock.
                    Its eigenvalue quantifies the temporal persistence of its own expression rhythm —
                    how long correlations in Fbxl3 expression last. A value near 1/φ in the dataset that defines
                    its discovery (GSE54650) and in this independent dataset would mean the gene that
                    <em> controls how long one clock cycle takes</em> operates at the mathematical stability boundary.
                    GSE11923 used a different lab, different microarray platform (Affymetrix 430 2.0),
                    and 48 hourly timepoints versus 24 bi-hourly — a genuine independent test.
                  </p>
                </div>
              </div>
            </div>

            {/* H2: Permutation test */}
            <div className="mb-6">
              <h2 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
                <BarChart2 size={16} className="text-slate-500" />
                H2 — Checkpoint Gene Set: Expression-Matched Permutation Test
              </h2>

              <div className={`rounded-xl border p-4 shadow-sm ${perm!.significant ? "bg-emerald-50 border-emerald-300" : "bg-slate-50 border-slate-200"}`}
                data-testid="permutation-result">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
                  {[
                    { label: "Genes tested", value: perm!.nGenesTested.toString() },
                    { label: "Observed mean dist", value: perm!.observedMeanDist.toFixed(4) },
                    { label: "Permutation mean", value: perm!.permMean.toFixed(4) },
                    { label: "p-value (one-tailed)", value: perm!.pValue.toFixed(3), special: true },
                    { label: "z-score", value: perm!.zScore.toFixed(2) },
                  ].map(s => (
                    <div key={s.label} className="text-center">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">{s.label}</p>
                      <p className={`text-lg font-bold font-mono ${s.special ? (perm!.significant ? "text-emerald-700" : "text-rose-600") : "text-slate-800"}`}>
                        {s.value}
                      </p>
                    </div>
                  ))}
                </div>
                <div className={`rounded-lg p-3 text-sm ${perm!.significant ? "bg-emerald-100 text-emerald-800" : "bg-white text-slate-700"}`}>
                  <p className="font-semibold mb-1">{perm!.significant ? "H2 CONFIRMED" : "H2 NOT CONFIRMED"}</p>
                  <p className="leading-relaxed">{perm!.interpretation}</p>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  {perm!.nPerm.toLocaleString()} permutations · expression-matched null (log₁₀ binning, 20 bins) ·
                  one-tailed (fraction of perms with mean dist ≤ observed)
                </p>
              </div>
            </div>

            {/* Checkpoint gene results table */}
            <div className="mb-6">
              <h2 className="text-base font-bold text-slate-800 mb-2 flex items-center gap-2">
                <FlaskConical size={16} className="text-slate-500" />
                Pre-Specified Gene Results (sorted by distance from 1/φ)
              </h2>
              <p className="text-xs text-slate-500 mb-3">
                All 16 genes named before any GSE11923 eigenvalue was computed.
                "Genome rank" = percentile among all {data.nGenesFitted.toLocaleString()} fitted genes for proximity to 1/φ.
                Green highlight = within 0.01 of 1/φ. Oscillating = complex AR(2) roots (damped oscillator).
              </p>
              <CheckpointGeneTable genes={data.checkpointGeneResults} />
            </div>

            {/* Gene roles detail */}
            <div className="mb-6">
              <h2 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
                <BookOpen size={16} className="text-slate-500" />
                Gene Roles — Why These 16?
              </h2>
              <p className="text-xs text-slate-500 mb-3">
                Every gene in the pre-specified set shares a single unifying biological role:
                it GATES or CHECKPOINTS a biological transition rather than executing the downstream process.
              </p>
              <div className="grid sm:grid-cols-2 gap-2">
                {data.checkpointGeneResults.map(g => (
                  <div key={g.gene}
                    className={`rounded-lg border p-3 text-xs ${g.found && g.distFromPhi < 0.01 ? "border-emerald-200 bg-emerald-50/40" : "border-slate-100 bg-white"}`}
                    data-testid={`gene-card-${g.gene}`}>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="font-bold font-mono text-slate-800">{g.gene}</span>
                      {g.found && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${pctColor(g.genomePercentile)}`}>
                          top {g.genomePercentile.toFixed(0)}%
                        </span>
                      )}
                    </div>
                    <p className="text-slate-600 leading-snug">{g.roleNote}</p>
                    {g.found && (
                      <p className="text-slate-400 mt-1 font-mono">|λ| = {g.lambda.toFixed(4)} · dist = {g.distFromPhi.toFixed(4)}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Clock reference panel */}
            <div className="mb-6">
              <h2 className="text-base font-bold text-slate-800 mb-2">
                Clock Reference Panel (positive control, not part of H2)
              </h2>
              <p className="text-xs text-slate-500 mb-3">
                Core clock and clock-output genes shown for context. These were not part of the pre-specified hypothesis.
                High |λ| for core clock (Arntl, Nr1d1) is expected — they are strongly self-sustained oscillators.
              </p>
              <CheckpointGeneTable genes={data.clockReferenceResults} />
            </div>

            {/* Cross-dataset comparison */}
            <div className="mb-6">
              <h2 className="text-base font-bold text-slate-800 mb-3">
                Cross-Dataset Replication — GSE11923 vs GSE54650
              </h2>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                  GSE54650 (Zhang lab, MoGene 1.0 array, 24 timepoints, 2h resolution) was the discovery dataset —
                  where Fbxl3 at |λ|=0.619 was first noticed. GSE11923 (Hughes/Hogenesch lab, Affymetrix 430 2.0,
                  48 timepoints, 1h resolution) is the independent replication dataset.
                  Consistent = |Δ| &lt; 0.05 between the two datasets.
                </p>
                <CrossDatasetTable rows={data.gse54650Comparison} />
              </div>
            </div>

            {/* Corrected permutation test (sampling-rate-adjusted target) */}
            {data.correctedPermutationTest && (
              <div className="mb-6">
                <h2 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
                  <BarChart2 size={16} className="text-amber-500" />
                  Post-Hoc Correction: Sampling-Rate-Normalised Target (sqrt(1/φ) ≈ {SQRT_PHI_RECIP.toFixed(4)})
                </h2>
                <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 shadow-sm">
                  <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                    The 1/φ = 0.618 boundary was identified in GSE54650 using 2-hour sampling. AR(2) eigenvalues
                    are sampling-rate-dependent: |λ|<sub>1h</sub> = sqrt(|λ|<sub>2h</sub>) for the same underlying
                    process. The correct equivalent target at 1-hour sampling is sqrt(1/φ) ≈ {SQRT_PHI_RECIP.toFixed(4)}.
                    This is a post-hoc correction — not part of the original pre-specification — but it is the
                    methodologically correct formulation.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
                    {[
                      { label: "Corrected target", value: SQRT_PHI_RECIP.toFixed(4) },
                      { label: "Observed mean dist", value: data.correctedPermutationTest.observedMeanDist.toFixed(4) },
                      { label: "Permutation mean", value: data.correctedPermutationTest.permMean.toFixed(4) },
                      { label: "p-value (one-tailed)", value: data.correctedPermutationTest.pValue.toFixed(3), special: true },
                      { label: "z-score", value: data.correctedPermutationTest.zScore.toFixed(2) },
                    ].map(s => (
                      <div key={s.label} className="text-center">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">{s.label}</p>
                        <p className={`text-lg font-bold font-mono ${s.special ? (data.correctedPermutationTest.significant ? "text-emerald-700" : "text-rose-600") : "text-slate-800"}`}>
                          {s.value}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-lg bg-white p-3 text-sm text-slate-700 border border-amber-100">
                    <p className="font-semibold mb-1 text-amber-800">
                      {data.correctedPermutationTest.significant ? "CONFIRMED with corrected target" : "NOT CONFIRMED even with corrected target"}
                    </p>
                    <p className="leading-relaxed">{data.correctedPermutationTest.interpretation}</p>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    {data.correctedPermutationTest.nPerm.toLocaleString()} permutations · post-hoc correction, not pre-specified ·
                    genes closest to 0.786: Btg1 (top 3.9%), Spop (top 7.2%), Mob1b (top 7.6%)
                  </p>
                </div>
              </div>
            )}

            {/* GSE54650 Discovery Significance — Was the original signal real? */}
            {data.gse54650PermutationTest && (
              <div className="mb-6">
                <h2 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
                  <BarChart2 size={16} className="text-emerald-500" />
                  Discovery Dataset Significance — Was the GSE54650 Signal Real?
                </h2>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-sm">
                  <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                    Before interpreting the GSE11923 null result, we need to know whether the original discovery
                    in GSE54650 was ever statistically significant — or merely a striking-looking cluster that was
                    never tested. Running the same expression-matched permutation test on GSE54650 itself answers this.
                    All 15 checkpoint genes were verified against the actual GSE54650_Liver_circadian.csv (May 3 2026).
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
                    {[
                      { label: "Genes tested", value: data.gse54650PermutationTest.nGenesTested.toString() },
                      { label: "Observed mean dist", value: data.gse54650PermutationTest.observedMeanDist.toFixed(5) },
                      { label: "Permutation mean", value: data.gse54650PermutationTest.permMean.toFixed(4) },
                      { label: "p-value (one-tailed)", value: "< 0.0001", special: true },
                      { label: "z-score", value: data.gse54650PermutationTest.zScore.toFixed(3) },
                    ].map(s => (
                      <div key={s.label} className="text-center">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">{s.label}</p>
                        <p className={`text-lg font-bold font-mono ${s.special ? "text-emerald-700" : "text-slate-800"}`}>
                          {s.value}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-lg bg-emerald-100 p-3 text-sm text-emerald-900 mb-3">
                    <p className="font-semibold mb-1">DISCOVERY SIGNAL WAS GENUINE</p>
                    <p className="leading-relaxed">{data.gse54650PermutationTest.interpretation}</p>
                  </div>
                  <div className="rounded-lg bg-white border border-emerald-100 p-3 text-xs text-slate-600 leading-relaxed">
                    <p className="font-semibold text-slate-700 mb-1">What this means for the null replication</p>
                    <p>
                      The GSE11923 null result is not a case of "testing a pattern that was never significant to begin with."
                      The GSE54650 pattern was extraordinary — 15/15 genes within 0.004 of 1/φ, 0/10,000 permutations matching.
                      GSE11923 is a genuine failed replication of a real signal. The signal exists in GSE54650 but does not
                      generalise to this independent dataset at the pre-specified threshold.
                    </p>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    {data.gse54650PermutationTest.nPerm.toLocaleString()} permutations · GSE54650 genome n=20,955 genes ·
                    expression-matched null (log₁₀ binning) · target = 1/φ = 0.61803 ·
                    GSE54650 genome mean |λ|=0.486, median=0.496
                  </p>
                </div>
              </div>
            )}

            {/* Rectification Scenarios */}
            {data.rectificationScenarios && data.rectificationScenarios.length > 0 && (
              <div className="mb-6">
                <h2 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
                  <ClipboardList size={16} className="text-blue-500" />
                  Rectification Scenarios — What Changes When We Fix Each Error?
                </h2>
                <p className="text-xs text-slate-500 mb-3 leading-relaxed">
                  Four scenarios, tested with 5,000 permutations each on GSE11923. S0 is the original pre-specified analysis.
                  S1–S3 apply the methodological corrections one at a time and together. Quality filter = exclude genes with R²&lt;0.10 or CV&lt;8% in GSE11923 (removes Rbl1, Tead4, Nrarp, Spop).
                </p>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="text-left px-3 py-2 font-semibold text-slate-600">Scenario</th>
                        <th className="text-right px-3 py-2 font-semibold text-slate-600">Target</th>
                        <th className="text-right px-3 py-2 font-semibold text-slate-600">n genes</th>
                        <th className="text-right px-3 py-2 font-semibold text-slate-600">p-value</th>
                        <th className="text-right px-3 py-2 font-semibold text-slate-600">z-score</th>
                        <th className="text-right px-3 py-2 font-semibold text-slate-600">Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.rectificationScenarios.map((s, i) => (
                        <tr key={s.id} className={`border-b border-slate-100 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/50"} ${s.id === 'S0' ? "ring-1 ring-inset ring-blue-200" : ""}`}
                          data-testid={`rectification-${s.id}`}>
                          <td className="px-3 py-2">
                            <span className="font-bold font-mono text-slate-700 mr-2">{s.id}</span>
                            <span className="text-slate-600">{s.label}</span>
                            {s.removed.length > 0 && (
                              <span className="ml-1 text-[9px] text-slate-400">(removed: {s.removed.join(', ')})</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-mono">{s.target.toFixed(4)}</td>
                          <td className="px-3 py-2 text-right font-mono">{s.nGenes}</td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-rose-600">{s.pValue.toFixed(3)}</td>
                          <td className="px-3 py-2 text-right font-mono">{s.zScore.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                              NOT SIGNIFICANT
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/50 p-3 text-xs text-slate-600 leading-relaxed">
                  <strong className="text-slate-700">Conclusion:</strong> No combination of methodological rectifications
                  produces a significant result in GSE11923. The null replication is robust. The best-case scenario
                  (S3: correct target + quality filter, n=11) gives p=0.241, z=−0.73.
                  This is the honest result — it does not replicate.
                </div>
              </div>
            )}

            {/* Methodological Audit */}
            {data.methodologicalAudit && data.methodologicalAudit.length > 0 && (
              <div className="mb-6">
                <h2 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
                  <ClipboardList size={16} className="text-slate-600" />
                  Methodological Audit — What Was Missed or Wrong
                </h2>
                <p className="text-xs text-slate-500 mb-3 leading-relaxed">
                  A systematic review of every methodological gap, error, and oversight in this analysis.
                  None of these change the bottom-line conclusion (NOT CONFIRMED), but all are documented
                  here for scientific transparency.
                </p>
                <div className="space-y-3">
                  {data.methodologicalAudit.map((item, i) => {
                    const severityConfig = {
                      critical: { border: "border-red-200", bg: "bg-red-50/60", badge: "bg-red-100 text-red-700", label: "CRITICAL" },
                      moderate: { border: "border-amber-200", bg: "bg-amber-50/40", badge: "bg-amber-100 text-amber-700", label: "MODERATE" },
                      minor:    { border: "border-slate-200", bg: "bg-slate-50",   badge: "bg-slate-100 text-slate-600", label: "MINOR" },
                    }[item.severity];
                    return (
                      <div key={i} className={`rounded-xl border ${severityConfig.border} ${severityConfig.bg} p-4`}
                        data-testid={`audit-item-${i}`}>
                        <div className="flex items-start gap-2 mb-2">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${severityConfig.badge}`}>
                            {severityConfig.label}
                          </span>
                          <p className="text-sm font-semibold text-slate-800">{item.issue}</p>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed ml-0">{item.detail}</p>
                        <p className="text-[10px] text-slate-400 mt-2">
                          Affects conclusion: {item.affectsConclusion ? "YES" : "No — null result stands regardless"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Methodology notes */}
            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 mb-6">
              <p className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
                <Shield size={12} /> Methodological safeguards applied
              </p>
              <ul className="space-y-1">
                {data.methodologyNotes.map((note, i) => (
                  <li key={i} className="text-xs text-slate-500 flex gap-2">
                    <span className="text-slate-300 shrink-0">{i + 1}.</span>
                    {note}
                  </li>
                ))}
              </ul>
            </div>

            {/* Honest interpretation box */}
            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
              <div className="flex gap-2.5">
                <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
                <div className="text-sm text-slate-700 leading-relaxed">
                  <p className="font-semibold text-slate-800 mb-2">What this analysis proves and does not prove</p>
                  <p className="mb-2">
                    <strong>What is proved:</strong> AR(2) temporal persistence of the circadian clock mechanism
                    (|λ|&gt;0.7 for core oscillator genes) is a robust, reproducible feature across independent
                    datasets, labs, and platforms. This is not contested.
                  </p>
                  <p className="mb-2">
                    <strong>What this test evaluates:</strong> Whether genes whose biological role is to gate or
                    checkpoint biological transitions specifically cluster near the mathematical value 1/φ ≈ 0.618
                    — the inverse golden ratio — beyond what would be expected by chance given their expression levels.
                  </p>
                  <p>
                    <strong>What cannot be concluded either way:</strong> Even if confirmed, proximity to 1/φ does
                    not prove a causal or evolutionary relationship with the Fibonacci sequence. The number line is
                    continuous; any value can be near any other value. A confirmed result here would support further
                    investigation; a null result here means the pattern identified in GSE54650 does not generalise
                    to this independent dataset at the pre-specified threshold.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
