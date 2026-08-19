import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, ReferenceLine, Legend
} from "recharts";
import {
  ArrowLeft, Loader2, ShieldCheck, ShieldAlert, AlertCircle,
  Activity, TrendingUp, Clock, Target, ChevronDown, ChevronUp, Copy, Check, Search
} from "lucide-react";
import { Link } from "wouter";
import { useState, useCallback } from "react";
import { downloadAsCSV } from "@/components/DownloadResultsButton";
import PaperCrossLinks from "@/components/PaperCrossLinks";
import { Download } from "lucide-react";
import GeneTooltip from "@/components/GeneTooltip";

interface WindowResult {
  windowStart: number;
  windowEnd: number;
  eigenvalue: number;
  r2: number;
}

interface GeneWindowAnalysis {
  gene: string;
  geneType: 'clock' | 'target';
  totalTimepoints: number;
  nWindows: number;
  fullSeriesEigenvalue: number;
  windows: WindowResult[];
  meanEigenvalue: number;
  stdEigenvalue: number;
  maxDrift: number;
  coefficientOfVariation: number;
  isStable: boolean;
}

interface GapWindow {
  windowIdx: number;
  clockMean: number;
  targetMean: number;
  gap: number;
}

interface DatasetResult {
  datasetId: string;
  datasetName: string;
  species: string;
  totalTimepoints: number;
  windowSize: number;
  stepSize: number;
  nWindows: number;
  clockGenes: GeneWindowAnalysis[];
  targetGenes: GeneWindowAnalysis[];
  clockMeanDrift: number;
  targetMeanDrift: number;
  clockMeanCV: number;
  targetMeanCV: number;
  clockStableCount: number;
  targetStableCount: number;
  gapStability: {
    windowGaps: GapWindow[];
    gapMean: number;
    gapStd: number;
    gapCV: number;
    hierarchyPreservedInAllWindows: boolean;
  };
  chowTest: { fStatistic: number; breakpoint: number; significantBreak: boolean; pApprox: number } | null;
  verdict: 'STABLE' | 'MARGINAL' | 'UNSTABLE';
  verdictExplanation: string;
}

interface RollingWindowData {
  datasets: DatasetResult[];
  summary: {
    totalDatasets: number;
    stableCount: number;
    marginalCount: number;
    unstableCount: number;
    overallVerdict: string;
    meanClockCV: number;
    meanTargetCV: number;
    gapPreservedInAllWindows: boolean;
  };
}

const verdictColor = (v: string) =>
  v === 'STABLE' ? 'text-emerald-400' : v === 'MARGINAL' ? 'text-amber-400' : 'text-red-400';
const verdictBg = (v: string) =>
  v === 'STABLE' ? 'bg-emerald-900/30 border-emerald-700/50' : v === 'MARGINAL' ? 'bg-amber-900/30 border-amber-700/50' : 'bg-red-900/30 border-red-700/50';

function generateFullResultsText(data: RollingWindowData): string {
  const { summary, datasets } = data;
  const lines: string[] = [];

  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('  ROLLING WINDOW STABILITY ANALYSIS — FULL RESULTS');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('');
  lines.push('SUMMARY');
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push(`  Datasets analyzed:    ${summary.totalDatasets}`);
  lines.push(`  Stable:               ${summary.stableCount}`);
  lines.push(`  Marginal:             ${summary.marginalCount}`);
  lines.push(`  Unstable:             ${summary.unstableCount}`);
  lines.push(`  Mean Clock CV:        ${(summary.meanClockCV * 100).toFixed(1)}%`);
  lines.push(`  Mean Target CV:       ${(summary.meanTargetCV * 100).toFixed(1)}%`);
  lines.push(`  Gap preserved (all):  ${summary.gapPreservedInAllWindows ? 'YES' : 'NO'}`);
  lines.push(`  Overall verdict:      ${summary.overallVerdict}`);
  lines.push('');

  for (const ds of datasets) {
    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push(`  ${ds.datasetName}`);
    lines.push(`  ${ds.species} | ${ds.totalTimepoints} timepoints | Window: ${ds.windowSize}pts, Step: ${ds.stepSize}pt | ${ds.nWindows} windows`);
    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push(`  Verdict: ${ds.verdict}`);
    lines.push(`  ${ds.verdictExplanation}`);
    lines.push('');
    lines.push(`  Clock genes stable:   ${ds.clockStableCount}/${ds.clockGenes.length}    Mean CV: ${(ds.clockMeanCV * 100).toFixed(1)}%    Mean drift: ${ds.clockMeanDrift.toFixed(4)}`);
    lines.push(`  Target genes stable:  ${ds.targetStableCount}/${ds.targetGenes.length}    Mean CV: ${(ds.targetMeanCV * 100).toFixed(1)}%    Mean drift: ${ds.targetMeanDrift.toFixed(4)}`);
    lines.push('');

    if (ds.chowTest) {
      lines.push('  Chow Structural Break Test (midpoint split)');
      lines.push(`    F-statistic:   ${ds.chowTest.fStatistic}`);
      lines.push(`    p-value:       ${ds.chowTest.pApprox}`);
      lines.push(`    Break:         ${ds.chowTest.significantBreak ? 'DETECTED (p < 0.05)' : 'None (p ≥ 0.05)'}`);
      lines.push('');
    }

    lines.push('  Gearbox Gap Stability');
    lines.push(`    Gap mean:      ${ds.gapStability.gapMean.toFixed(4)}`);
    lines.push(`    Gap std:       ${ds.gapStability.gapStd.toFixed(4)}`);
    lines.push(`    Gap CV:        ${(ds.gapStability.gapCV * 100).toFixed(1)}%`);
    lines.push(`    Hierarchy preserved in all windows: ${ds.gapStability.hierarchyPreservedInAllWindows ? 'YES' : 'NO'}`);
    lines.push('');

    if (ds.gapStability.windowGaps.length > 0) {
      lines.push('    Per-window gap:');
      for (const g of ds.gapStability.windowGaps) {
        lines.push(`      Window ${g.windowIdx + 1}:  Clock=${g.clockMean.toFixed(4)}  Target=${g.targetMean.toFixed(4)}  Gap=${g.gap.toFixed(4)}`);
      }
      lines.push('');
    }

    lines.push('  Per-Gene Details');
    lines.push('  ───────────────────────────────────────────────────────────');
    lines.push('  Gene            Type     |λ̄|      Drift    CV       Stable');
    lines.push('  ───────────────────────────────────────────────────────────');

    const allGenes = [...ds.clockGenes, ...ds.targetGenes];
    for (const g of allGenes) {
      const name = g.gene.padEnd(16);
      const type = g.geneType.padEnd(8);
      const ev = g.meanEigenvalue.toFixed(4).padStart(7);
      const drift = g.maxDrift.toFixed(4).padStart(8);
      const cv = ((g.coefficientOfVariation * 100).toFixed(1) + '%').padStart(8);
      const stable = g.isStable ? '  YES' : '  NO';
      lines.push(`  ${name}${type}${ev}${drift}${cv}${stable}`);
    }
    lines.push('');
  }

  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('  Methodology');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('  Window Size:        50% of total timepoints (min 8 for AR(2))');
  lines.push('  Step Size:          Chosen to produce ~5 overlapping windows');
  lines.push('  Stability:          CV < 15% AND max drift < 0.15');
  lines.push('  Chow Test:          Structural break at midpoint, F-distribution p-value');
  lines.push('  R² Filter:          Windows with R² < 0.1 excluded from stability metrics');
  lines.push('  Gap Stability:      Clock > Target hierarchy checked in every window');
  lines.push('');

  return lines.join('\n');
}

function FullResultsText({ data }: { data: RollingWindowData }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const text = generateFullResultsText(data);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-bold text-white">Full Results (Copyable Text)</h2>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-400 hover:text-white"
            onClick={() => setExpanded(!expanded)}
            data-testid="button-toggle-full-results"
          >
            {expanded ? <ChevronUp size={14} className="mr-1" /> : <ChevronDown size={14} className="mr-1" />}
            {expanded ? 'Collapse' : 'Expand'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-cyan-700 text-cyan-400 hover:bg-cyan-900/30"
            onClick={handleCopy}
            data-testid="button-copy-full-results"
          >
            {copied ? <Check size={14} className="mr-1" /> : <Copy size={14} className="mr-1" />}
            {copied ? 'Copied!' : 'Copy All'}
          </Button>
        </div>
      </div>
      {expanded && (
        <pre
          className="bg-slate-950 border border-slate-700 rounded-lg p-4 text-xs text-slate-300 font-mono overflow-x-auto max-h-[600px] overflow-y-auto whitespace-pre select-all"
          data-testid="text-full-results"
        >
          {text}
        </pre>
      )}
    </div>
  );
}

function DatasetCard({ ds }: { ds: DatasetResult }) {
  const [expanded, setExpanded] = useState(false);
  const [geneSearch, setGeneSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<'all' | 'clock' | 'target'>('all');
  const [stableOnly, setStableOnly] = useState(false);

  const gapChartData = ds.gapStability.windowGaps.map(g => ({
    window: `W${g.windowIdx + 1}`,
    clockMean: g.clockMean,
    targetMean: g.targetMean,
    gap: g.gap,
  }));

  const allGenes = [...ds.clockGenes, ...ds.targetGenes];
  const filteredGenes = allGenes.filter(g => {
    if (geneSearch && !g.gene.toLowerCase().includes(geneSearch.toLowerCase())) return false;
    if (typeFilter !== 'all' && g.geneType !== typeFilter) return false;
    if (stableOnly && !g.isStable) return false;
    return true;
  });
  const isFiltered = geneSearch || typeFilter !== 'all' || stableOnly;
  const geneBarData = filteredGenes.map(g => ({
    gene: g.gene,
    meanEV: g.meanEigenvalue,
    maxDrift: g.maxDrift,
    cv: g.coefficientOfVariation,
    color: g.geneType === 'clock' ? '#22d3ee' : '#a78bfa',
    stable: g.isStable,
  }));

  return (
    <Card className={`border ${verdictBg(ds.verdict)}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-white text-lg" data-testid={`text-dataset-name-${ds.datasetId}`}>{ds.datasetName}</CardTitle>
            <CardDescription className="text-slate-400">
              {ds.species} | {ds.totalTimepoints} timepoints | Window: {ds.windowSize}pts, Step: {ds.stepSize}pt | {ds.nWindows} windows
            </CardDescription>
          </div>
          <Badge className={`${verdictBg(ds.verdict)} ${verdictColor(ds.verdict)} text-sm`} data-testid={`badge-verdict-${ds.datasetId}`}>
            {ds.verdict}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-slate-300 mb-4">{ds.verdictExplanation}</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-slate-800/50 rounded-lg p-3 text-center">
            <p className="text-xs text-slate-400">Clock Genes</p>
            <p className="text-lg font-bold text-cyan-400">{ds.clockStableCount}/{ds.clockGenes.length}</p>
            <p className="text-xs text-slate-400">stable</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3 text-center">
            <p className="text-xs text-slate-400">Target Genes</p>
            <p className="text-lg font-bold text-violet-400">{ds.targetStableCount}/{ds.targetGenes.length}</p>
            <p className="text-xs text-slate-400">stable</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3 text-center">
            <p className="text-xs text-slate-400">Clock Mean CV</p>
            <p className={`text-lg font-bold font-mono ${ds.clockMeanCV < 0.15 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {(ds.clockMeanCV * 100).toFixed(1)}%
            </p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3 text-center">
            <p className="text-xs text-slate-400">Target Mean CV</p>
            <p className={`text-lg font-bold font-mono ${ds.targetMeanCV < 0.15 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {(ds.targetMeanCV * 100).toFixed(1)}%
            </p>
          </div>
        </div>

        {gapChartData.length > 1 && (
          <div className="mb-4">
            <p className="text-sm text-slate-400 mb-2 flex items-center gap-1">
              <Activity size={14} />
              Gearbox Gap Stability Across Windows
              {ds.gapStability.hierarchyPreservedInAllWindows
                ? <Badge className="bg-emerald-900/30 text-emerald-300 text-xs ml-2">Hierarchy preserved in all windows</Badge>
                : <Badge className="bg-red-900/30 text-red-300 text-xs ml-2">Hierarchy broken in some windows</Badge>}
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={gapChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="window" tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="clockMean" name="Clock |λ|" fill="#22d3ee" radius={[4, 4, 0, 0]} />
                <Bar dataKey="targetMean" name="Target |λ|" fill="#a78bfa" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-6 text-xs text-slate-400 mt-1">
              <span>Gap Mean: <span className="text-white font-mono">{ds.gapStability.gapMean.toFixed(4)}</span></span>
              <span>Gap Std: <span className="text-white font-mono">{ds.gapStability.gapStd.toFixed(4)}</span></span>
              <span>Gap CV: <span className={`font-mono ${ds.gapStability.gapCV < 0.3 ? 'text-emerald-400' : 'text-amber-400'}`}>{(ds.gapStability.gapCV * 100).toFixed(1)}%</span></span>
            </div>
          </div>
        )}

        {ds.chowTest && (
          <div className="bg-slate-800/50 rounded-lg p-3 mb-4">
            <p className="text-xs text-slate-400 mb-1">Chow Structural Break Test (midpoint split)</p>
            <div className="flex gap-4 text-sm">
              <span className="text-slate-400">F-statistic: <span className="text-white font-mono">{ds.chowTest.fStatistic}</span></span>
              <span className="text-slate-400">p-approx: <span className="text-white font-mono">{ds.chowTest.pApprox}</span></span>
              <Badge className={ds.chowTest.significantBreak ? 'bg-red-900/30 text-red-300' : 'bg-emerald-900/30 text-emerald-300'}>
                {ds.chowTest.significantBreak ? 'Structural Break Detected' : 'No Structural Break'}
              </Badge>
            </div>
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="text-slate-400 hover:text-white w-full"
          onClick={() => setExpanded(!expanded)}
          data-testid={`button-expand-${ds.datasetId}`}
        >
          {expanded ? <ChevronUp size={14} className="mr-1" /> : <ChevronDown size={14} className="mr-1" />}
          {expanded ? 'Hide' : 'Show'} Per-Gene Details ({allGenes.length} genes)
        </Button>

        {expanded && (
          <div className="mt-3">
            <div className="flex flex-wrap items-center gap-3 mb-3 bg-slate-800/30 rounded-lg p-3">
              <div className="relative flex-1 min-w-[180px]">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  data-testid="input-gene-search"
                  placeholder="Search genes..."
                  value={geneSearch}
                  onChange={(e) => setGeneSearch(e.target.value)}
                  className="pl-8 h-8 bg-slate-900/50 border-slate-700 text-slate-300 text-sm placeholder:text-slate-500"
                />
              </div>
              <div className="flex items-center gap-1">
                <Button
                  data-testid="button-filter-all"
                  variant={typeFilter === 'all' ? 'default' : 'ghost'}
                  size="sm"
                  className={typeFilter === 'all' ? 'bg-slate-600 text-white h-8' : 'text-slate-400 hover:text-white h-8'}
                  onClick={() => setTypeFilter('all')}
                >
                  All
                </Button>
                <Button
                  data-testid="button-filter-clock"
                  variant={typeFilter === 'clock' ? 'default' : 'ghost'}
                  size="sm"
                  className={typeFilter === 'clock' ? 'bg-cyan-800 text-cyan-200 h-8' : 'text-slate-400 hover:text-white h-8'}
                  onClick={() => setTypeFilter('clock')}
                >
                  <Clock size={12} className="mr-1" />
                  Clock
                </Button>
                <Button
                  data-testid="button-filter-target"
                  variant={typeFilter === 'target' ? 'default' : 'ghost'}
                  size="sm"
                  className={typeFilter === 'target' ? 'bg-violet-800 text-violet-200 h-8' : 'text-slate-400 hover:text-white h-8'}
                  onClick={() => setTypeFilter('target')}
                >
                  <Target size={12} className="mr-1" />
                  Target
                </Button>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input
                  data-testid="checkbox-stable-only"
                  type="checkbox"
                  checked={stableOnly}
                  onChange={(e) => setStableOnly(e.target.checked)}
                  className="rounded border-slate-600 bg-slate-900/50 text-emerald-500 focus:ring-emerald-500"
                />
                <ShieldCheck size={12} className="text-emerald-400" />
                Stable only
              </label>
              {isFiltered && (
                <span className="text-xs text-slate-400">
                  Showing <span className="text-white font-mono">{filteredGenes.length}</span> of <span className="text-white font-mono">{allGenes.length}</span> genes
                </span>
              )}
            </div>

            <ResponsiveContainer width="100%" height={Math.max(200, filteredGenes.length * 28)}>
              <BarChart data={geneBarData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} domain={[0, 'auto']} />
                <YAxis type="category" dataKey="gene" tick={{ fill: '#64748b', fontSize: 10 }} width={80} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }}
                  formatter={(value: number, name: string) => [
                    name === 'maxDrift' ? value.toFixed(4) : (value * 100).toFixed(1) + '%',
                    name === 'maxDrift' ? 'Max Drift (Δ|λ|)' : 'CV'
                  ]}
                />
                <Bar dataKey="maxDrift" name="Max Drift" radius={[0, 4, 4, 0]}>
                  {geneBarData.map((entry, index) => (
                    <Cell key={index} fill={entry.stable ? '#22c55e' : '#f59e0b'} opacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            <div className="mt-3 space-y-1 max-h-[300px] overflow-y-auto">
              {filteredGenes.map((g, i) => (
                <div key={i} className="flex items-center justify-between text-xs bg-slate-800/30 px-3 py-1.5 rounded">
                  <div className="flex items-center gap-2">
                    {g.geneType === 'clock' ? <Clock size={10} className="text-cyan-400" /> : <Target size={10} className="text-violet-400" />}
                    <span className="text-slate-300 font-mono"><GeneTooltip gene={g.gene}>{g.gene}</GeneTooltip></span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400">|λ̄| = <span className="text-white">{g.meanEigenvalue.toFixed(4)}</span></span>
                    <span className="text-slate-400">drift = <span className={g.maxDrift < 0.15 ? 'text-emerald-400' : 'text-amber-400'}>{g.maxDrift.toFixed(4)}</span></span>
                    <span className="text-slate-400">CV = <span className={g.coefficientOfVariation < 0.15 ? 'text-emerald-400' : 'text-amber-400'}>{(g.coefficientOfVariation * 100).toFixed(1)}%</span></span>
                    {g.isStable
                      ? <ShieldCheck size={12} className="text-emerald-400" />
                      : <ShieldAlert size={12} className="text-amber-400" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function RollingWindow() {
  const { data, isLoading, error } = useQuery<RollingWindowData>({
    queryKey: ['/api/validation/rolling-window'],
    staleTime: 1000 * 60 * 30,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-400 mx-auto mb-3" />
          <p className="text-slate-400">Running rolling window stability analysis...</p>
          <p className="text-xs text-slate-400 mt-1">Fitting AR(2) across multiple time windows per gene</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-6">
        <div className="max-w-2xl mx-auto mt-20">
          <Alert className="bg-red-900/30 border-red-700/50">
            <AlertCircle className="h-4 w-4 text-red-400" />
            <AlertTitle className="text-red-300">Analysis Failed</AlertTitle>
            <AlertDescription className="text-red-200/70">
              {(error as Error)?.message || 'Failed to run rolling window analysis.'}
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const { summary, datasets } = data;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white" data-testid="link-back-home">
              <ArrowLeft size={16} className="mr-1" />
              Home
            </Button>
          </Link>
        </div>

        <div className="mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2" data-testid="text-page-title">
                Rolling Window Stability Analysis
              </h1>
              <p className="text-slate-400 max-w-3xl">
                Tests whether AR(2) eigenvalue signatures remain stable across sub-windows of each time series.
                If |lambda| drifts significantly between windows, the parameters are non-stationary and the eigenvalue may be a statistical artifact.
                Stable parameters confirm genuine biological signal.
              </p>
              <div className="rounded-lg bg-slate-800/40 border border-slate-700/50 p-4 mt-3">
                <p className="text-sm text-slate-300 leading-relaxed">
                  <strong className="text-white">What you can do:</strong> This analysis tests whether eigenvalue estimates are stable across different sub-windows of the time series. Consistent values across windows mean the AR(2) signature is robust, not an artifact of a specific time segment. Download the window-level data to report stability metrics.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-slate-600 text-slate-300 hover:bg-slate-800 shrink-0"
              data-testid="button-download-results"
              onClick={() => {
                const csvData = datasets.flatMap(ds =>
                  [...ds.clockGenes, ...ds.targetGenes].map(g => ({
                    dataset: ds.datasetName,
                    gene: g.gene,
                    geneType: g.geneType,
                    meanEigenvalue: g.meanEigenvalue,
                    maxDrift: g.maxDrift,
                    coefficientOfVariation: g.coefficientOfVariation,
                    isStable: g.isStable,
                    verdict: ds.verdict,
                  }))
                );
                downloadAsCSV(csvData, "PAR2_RollingWindow_Results.csv");
              }}
            >
              <Download className="h-4 w-4" />
              Download Results (CSV)
            </Button>
          </div>
        </div>

        <PaperCrossLinks currentPage="/rolling-window" />

        <Card className={`mb-6 ${summary.stableCount === summary.totalDatasets ? 'bg-emerald-900/20 border-emerald-700/50' : 'bg-amber-900/20 border-amber-700/50'}`}>
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              {summary.stableCount === summary.totalDatasets
                ? <ShieldCheck size={20} className="text-emerald-400" />
                : <TrendingUp size={20} className="text-amber-400" />}
              Overall Verdict
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-200 mb-4" data-testid="text-overall-verdict">{summary.overallVerdict}</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-white">{summary.totalDatasets}</p>
                <p className="text-xs text-slate-400">Datasets Tested</p>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-emerald-400">{summary.stableCount}</p>
                <p className="text-xs text-slate-400">Stable</p>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-amber-400">{summary.marginalCount}</p>
                <p className="text-xs text-slate-400">Marginal</p>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-red-400">{summary.unstableCount}</p>
                <p className="text-xs text-slate-400">Unstable</p>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-white">
                  {summary.gapPreservedInAllWindows
                    ? <ShieldCheck size={24} className="text-emerald-400 mx-auto" />
                    : <ShieldAlert size={24} className="text-amber-400 mx-auto" />}
                </p>
                <p className="text-xs text-slate-400">Gap Preserved</p>
              </div>
            </div>
            <div className="flex gap-6 mt-3 text-xs text-slate-400">
              <span>Mean Clock CV: <span className={`font-mono ${summary.meanClockCV < 0.15 ? 'text-emerald-400' : 'text-amber-400'}`}>{(summary.meanClockCV * 100).toFixed(1)}%</span></span>
              <span>Mean Target CV: <span className={`font-mono ${summary.meanTargetCV < 0.15 ? 'text-emerald-400' : 'text-amber-400'}`}>{(summary.meanTargetCV * 100).toFixed(1)}%</span></span>
            </div>
          </CardContent>
        </Card>

        <div className="mb-4">
          <h2 className="text-xl font-bold text-white mb-1">Per-Dataset Results</h2>
          <p className="text-sm text-slate-400">Each dataset is split into overlapping half-width windows. AR(2) is re-fit in each window independently.</p>
        </div>

        <div className="space-y-4">
          {datasets.map((ds) => (
            <DatasetCard key={ds.datasetId} ds={ds} />
          ))}
        </div>

        <FullResultsText data={data} />

        <div className="mt-8 bg-slate-900/80 border border-slate-700 rounded-lg p-6">
          <h3 className="text-white font-bold mb-3">Methodology</h3>
          <div className="text-sm text-slate-400 space-y-2">
            <p><span className="text-slate-300">Window Size:</span> 50% of total timepoints (minimum 8 points for AR(2) fitting)</p>
            <p><span className="text-slate-300">Step Size:</span> Chosen to produce ~5 overlapping windows per dataset</p>
            <p><span className="text-slate-300">Stability Criterion:</span> A gene is "stable" if its coefficient of variation (CV) of |lambda| across windows is less than 15% AND maximum drift less than 0.15</p>
            <p><span className="text-slate-300">Chow Test:</span> Tests for structural break at the midpoint of the time series by comparing pooled vs split AR(2) fits</p>
            <p><span className="text-slate-300">Gap Stability:</span> The Clock vs Target eigenvalue gap is computed independently in each window to verify the Gearbox Hypothesis holds across all temporal segments</p>
            <p className="text-slate-400 mt-3 italic">
              This analysis directly addresses the Non-Stationarity critique: if AR(2) coefficients drift across windows,
              the eigenvalue modulus is a statistical average rather than a biological state. Stable parameters across all windows
              confirm that |lambda| represents genuine temporal persistence.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}