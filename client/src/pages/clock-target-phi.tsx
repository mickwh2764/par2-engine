import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, FlaskConical, Activity, BarChart2, AlertTriangle, CheckCircle2, Info } from "lucide-react";

const PHI_RECIP = 0.6180339887;

interface GeneResult {
  gene: string;
  tier: string;
  meanLambda: number;
  medianLambda: number;
  distanceFromPhiReciprocal: number;
  meanR2: number;
  complexFraction: number;
  nTissues: number;
  tissueResults: { tissue: string; lambda: number; r2: number; hasComplexRoots: boolean }[];
}

interface PhiReport {
  phiReciprocal: number;
  coreClockResults: GeneResult[];
  directTargetResults: GeneResult[];
  secondaryTargetResults: GeneResult[];
  permutationTest: {
    directTargets: { observedMeanDist: number; pValue: number; zScore: number; nPerm: number; interpretation: string };
    allTargets: { observedMeanDist: number; pValue: number; zScore: number; nPerm: number; interpretation: string };
  };
  summaryStats: {
    coreClock: { meanLambda: number; medianDistFromPhi: number; n: number };
    directTargets: { meanLambda: number; medianDistFromPhi: number; n: number };
    secondary: { meanLambda: number; medianDistFromPhi: number; n: number };
    genesWithin005ofPhi: string[];
    genesWithin002ofPhi: string[];
  };
  genomeWideLambdas: { mean: number; median: number; sd: number; n: number };
  interpretation: string;
  timestamp: string;
}

function lambdaBar(val: number) {
  const w = Math.min(100, val * 100);
  const dist = Math.abs(val - PHI_RECIP);
  const color = dist < 0.02 ? "bg-emerald-500" : dist < 0.05 ? "bg-teal-400" : dist < 0.1 ? "bg-blue-400" : "bg-slate-400";
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${w}%` }} />
      </div>
      <span className="text-xs font-mono text-slate-700">{val.toFixed(3)}</span>
      {dist < 0.02 && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-semibold">≈1/φ</span>}
    </div>
  );
}

function GeneTable({ genes, label }: { genes: GeneResult[]; label: string }) {
  const sorted = [...genes].sort((a, b) => a.distanceFromPhiReciprocal - b.distanceFromPhiReciprocal);
  return (
    <div className="mb-6">
      <h3 className="text-sm font-semibold text-slate-700 mb-2">{label} ({genes.length} genes found across 12 tissues)</h3>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-3 py-2 font-semibold text-slate-600">Gene</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-600">Mean |λ| (12 tissues)</th>
              <th className="text-right px-3 py-2 font-semibold text-slate-600">Dist from 1/φ</th>
              <th className="text-right px-3 py-2 font-semibold text-slate-600">Complex %</th>
              <th className="text-right px-3 py-2 font-semibold text-slate-600">Mean R²</th>
              <th className="text-right px-3 py-2 font-semibold text-slate-600">Tissues</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((g, i) => (
              <tr key={g.gene} className={`border-b border-slate-100 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/50"} ${g.distanceFromPhiReciprocal < 0.02 ? "ring-1 ring-inset ring-emerald-200" : ""}`}>
                <td className="px-3 py-2 font-semibold text-slate-800 font-mono">{g.gene}</td>
                <td className="px-3 py-2">{lambdaBar(g.meanLambda)}</td>
                <td className="px-3 py-2 text-right font-mono">{g.distanceFromPhiReciprocal.toFixed(3)}</td>
                <td className="px-3 py-2 text-right">{(g.complexFraction * 100).toFixed(0)}%</td>
                <td className="px-3 py-2 text-right">{g.meanR2.toFixed(2)}</td>
                <td className="px-3 py-2 text-right text-slate-500">{g.nTissues}/12</td>
              </tr>
            ))}
            {genes.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-4 text-center text-slate-500">No genes found in dataset</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PermResult({ test, label }: { test: PhiReport["permutationTest"]["directTargets"]; label: string }) {
  const sig = test.pValue < 0.05;
  const trend = test.pValue < 0.10;
  const icon = sig ? <CheckCircle2 size={16} className="text-emerald-600" /> :
               trend ? <Info size={16} className="text-amber-500" /> :
               <AlertTriangle size={16} className="text-slate-500" />;
  const bg = sig ? "bg-emerald-50 border-emerald-200" : trend ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-200";
  return (
    <div className={`rounded-xl border p-4 ${bg}`} data-testid={`perm-result-${label.replace(/\s/g,'-')}`}>
      <div className="flex items-start gap-2 mb-2">
        {icon}
        <div>
          <p className="text-sm font-semibold text-slate-800">{label}</p>
          <p className="text-xs text-slate-500 mt-0.5">{test.nPerm.toLocaleString()} permutations — expression-matched null</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="text-center">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Observed mean dist</p>
          <p className="text-lg font-bold font-mono text-slate-800">{test.observedMeanDist.toFixed(3)}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">p-value</p>
          <p className={`text-lg font-bold font-mono ${sig ? "text-emerald-700" : trend ? "text-amber-600" : "text-slate-500"}`}>{test.pValue.toFixed(3)}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">z-score</p>
          <p className="text-lg font-bold font-mono text-slate-800">{test.zScore.toFixed(2)}</p>
        </div>
      </div>
      <p className="text-xs text-slate-600 leading-relaxed">{test.interpretation}</p>
    </div>
  );
}

export default function ClockTargetPhi() {
  const { data, isLoading, error } = useQuery<PhiReport>({
    queryKey: ["/api/clock-target-phi-enrichment"],
    staleTime: Infinity,
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 py-8 px-4" data-testid="clock-target-phi-page">
      <div className="max-w-5xl mx-auto">

        <div className="flex items-center gap-3 mb-8">
          <Link to="/">
            <button className="flex items-center gap-1 text-slate-500 hover:text-slate-700 text-sm" data-testid="back-home">
              <ArrowLeft size={16} /> Home
            </button>
          </Link>
        </div>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10">
              <FlaskConical className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900" data-testid="page-heading">Clock Target 1/φ Enrichment</h1>
              <p className="text-slate-500 text-sm">Focused enrichment test: do recognised clock-controlled genes cluster near |λ| = 1/φ ≈ 0.618?</p>
            </div>
          </div>
        </div>

        {/* Context card */}
        <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 mb-6">
          <div className="flex gap-2.5">
            <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
            <div className="text-sm text-slate-700 leading-relaxed">
              <p className="font-semibold text-slate-800 mb-1">Why this test?</p>
              <p>The genome-wide enrichment test (all ~21,000 genes, p = 0.154) diluted any signal by including housekeeping genes, structural proteins, and non-rhythmic transcripts. This analysis restricts to <strong>biologically motivated clock target genes</strong> — direct BMAL1/CLOCK E-box targets confirmed by ChIP-seq and BMAL1-coupling analysis — and tests whether <em>they</em> specifically cluster near <strong>1/φ ≈ 0.618</strong>, the stable Fibonacci eigenvalue. 5,000-permutation test against expression-matched null genes across all 12 GSE54650 tissues.</p>
            </div>
          </div>
        </div>

        {isLoading && (
          <div className="text-center py-20" data-testid="loading-state">
            <Activity className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-3" />
            <p className="text-slate-500 text-sm">Running AR(2) analysis across 12 tissues × 35+ genes × 5,000 permutations…</p>
            <p className="text-slate-500 text-xs mt-1">This takes 20–40 seconds on first run</p>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 text-sm" data-testid="error-state">
            Analysis failed: {String(error)}
          </div>
        )}

        {data && (
          <>
            {/* Genome-wide reference */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {[
                { label: "1/φ target", value: data.phiReciprocal.toFixed(4), sub: "stable Fibonacci eigenvalue", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
                { label: "Genome-wide median |λ|", value: data.genomeWideLambdas.median.toFixed(3), sub: `n = ${data.genomeWideLambdas.n.toLocaleString()} genes (Liver)`, color: "text-slate-700", bg: "bg-slate-50 border-slate-200" },
                { label: "Core clock mean |λ|", value: data.summaryStats.coreClock.meanLambda.toFixed(3), sub: `${data.summaryStats.coreClock.n} genes`, color: "text-purple-700", bg: "bg-purple-50 border-purple-200" },
                { label: "Direct targets mean |λ|", value: data.summaryStats.directTargets.meanLambda.toFixed(3), sub: `${data.summaryStats.directTargets.n} genes`, color: "text-teal-700", bg: "bg-teal-50 border-teal-200" },
              ].map(s => (
                <div key={s.label} className={`rounded-xl border p-3 ${s.bg}`}>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">{s.label}</p>
                  <p className={`text-xl font-bold font-mono ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{s.sub}</p>
                </div>
              ))}
            </div>

            {/* Genes close to 1/φ */}
            {data.summaryStats.genesWithin005ofPhi.length > 0 && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 mb-6">
                <p className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-600" />
                  Genes within |λ| ± 0.05 of 1/φ ≈ 0.618
                </p>
                <div className="flex flex-wrap gap-2">
                  {data.summaryStats.genesWithin005ofPhi.map(g => (
                    <span key={g} className={`px-2.5 py-1 rounded-full text-xs font-mono font-semibold ${data.summaryStats.genesWithin002ofPhi.includes(g) ? "bg-emerald-500 text-slate-900" : "bg-emerald-100 text-emerald-800"}`}>
                      {g}{data.summaryStats.genesWithin002ofPhi.includes(g) ? " ★" : ""}
                    </span>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 mt-2">★ = within ±0.02 (very close)</p>
              </div>
            )}

            {/* Permutation tests */}
            <div className="mb-6">
              <h2 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
                <BarChart2 size={16} className="text-slate-500" />
                Expression-Matched Permutation Tests
              </h2>
              <div className="grid sm:grid-cols-2 gap-3">
                <PermResult test={data.permutationTest.directTargets} label="Direct BMAL1/CLOCK targets only" />
                <PermResult test={data.permutationTest.allTargets} label="All clock target genes (direct + secondary)" />
              </div>
            </div>

            {/* Overall interpretation */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 mb-6 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Overall interpretation</p>
              <p className="text-sm text-slate-700 leading-relaxed">{data.interpretation}</p>
            </div>

            {/* Gene tables */}
            <div className="space-y-2">
              <h2 className="text-base font-bold text-slate-800 mb-3">Per-Gene Results (sorted by distance from 1/φ)</h2>
              <GeneTable genes={data.coreClockResults} label="Core clock genes (positive control reference)" />
              <GeneTable genes={data.directTargetResults} label="Direct BMAL1/CLOCK targets (primary test set)" />
              <GeneTable genes={data.secondaryTargetResults} label="Secondary clock output genes" />
            </div>

            {/* Methodology note */}
            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 mt-6 text-xs text-slate-500 leading-relaxed">
              <p className="font-semibold text-slate-600 mb-1">Methodology</p>
              <p>AR(2) fitted by OLS to demeaned expression values across each of 12 GSE54650 tissues (Zhang et al. 2014). Eigenvalue |λ| computed from companion matrix; values capped at 1.000 for short-timepoint fits. Expression-matched null: each clock target gene matched to expression bin (log₁₀ mean, 20 bins) in the Liver dataset; permutation samples the same number of genes from matched bins. 5,000 permutations. 1/φ = (√5−1)/2 ≈ 0.6180.</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
