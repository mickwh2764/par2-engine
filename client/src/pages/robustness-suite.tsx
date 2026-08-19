import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, ReferenceLine, ScatterChart, Scatter, ErrorBar,
  Cell
} from "recharts";
import {
  ArrowLeft, Loader2, Shield, ShieldCheck, TrendingDown, Layers,
  FlaskConical, Target, BarChart3, GitBranch, Shuffle, Minus, Crosshair, Gauge,
  Network, Dna, ShieldAlert, AlertCircle, Activity, TrendingUp, Zap,
  ChevronDown, ChevronUp, Clock, Globe
} from "lucide-react";
import HowTo from "@/components/HowTo";
import PaperCrossLinks from "@/components/PaperCrossLinks";
import GeneTooltip from "@/components/GeneTooltip";
import { downloadAsCSV } from "@/components/DownloadResultsButton";
import { Download } from "lucide-react";

type Tab = 'subsampling' | 'bootstrap' | 'first-diff' | 'detrend' | 'permutation' | 'loto' | 'population-cv' | 'model-order' | 'multi-cat-permutation' | 'multi-cat-bootstrap' | 'multi-cat-detrend' | 'multi-cat-loto' | 'stationarity' | 'null-survey' | 'cross-species';

function TabButton({ active, onClick, icon, label, testId }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string; testId: string;
}) {
  return (
    <button
      data-testid={testId}
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        active ? 'bg-blue-600 text-slate-900' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800'
      }`}
    >
      {icon}{label}
    </button>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-20" data-testid="loading-state">
      <Loader2 className="w-6 h-6 animate-spin text-blue-400 mr-3" />
      <span className="text-slate-500">{label}</span>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="text-red-400 py-10 text-center" data-testid="error-state">
      {message}
    </div>
  );
}

function SubsamplingTab() {
  const [iterations, setIterations] = useState(50);
  const [appliedIter, setAppliedIter] = useState(50);

  const { data, isLoading, error } = useQuery<any>({
    queryKey: ['/api/validation/robustness-suite/subsampling', appliedIter],
    queryFn: () => fetch(`/api/validation/robustness-suite/subsampling?iterations=${appliedIter}`).then(r => r.json()),
    staleTime: 10 * 60 * 1000,
  });

  if (isLoading) return <LoadingState label="Running sub-sampling analysis on 48-timepoint dataset..." />;
  if (error || !data) return <ErrorState message="Failed to load sub-sampling analysis" />;

  const summaryData = data.summary?.map((s: any) => ({
    name: `N=${s.n}`,
    n: s.n,
    errorPct: (s.meanAbsError * 100).toFixed(1),
    within10: (s.within10pctRate * 100).toFixed(0),
    hierarchy: (s.hierarchyPreserved * 100).toFixed(0),
  })) || [];

  const geneData = data.genes?.map((g: any) => {
    const entry: any = { gene: g.gene, type: g.geneType, full: g.fullEigenvalue };
    g.subsampleResults?.forEach((s: any) => {
      entry[`n${s.n}_mean`] = s.meanEigenvalue;
      entry[`n${s.n}_std`] = s.stdEigenvalue;
    });
    return entry;
  }) || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" className="gap-2 border-slate-300 text-slate-600 hover:bg-slate-100" data-testid="button-download-subsampling" onClick={() => downloadAsCSV(geneData, "PAR2_Robustness_Subsampling.csv")}>
          <Download className="h-4 w-4" /> Download Results (CSV)
        </Button>
      </div>
      <Card className="bg-slate-50 border-slate-200" data-testid="card-subsample-params">
        <CardContent className="p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-sm text-slate-600">Iterations per sample size:</span>
            <div className="flex items-center gap-2">
              {[25, 50, 100, 200].map(n => (
                <Button
                  key={n}
                  size="sm"
                  variant={iterations === n ? 'default' : 'outline'}
                  onClick={() => setIterations(n)}
                  className={`text-xs h-7 px-3 ${iterations === n ? 'bg-blue-600' : 'border-slate-300'}`}
                  data-testid={`button-iter-${n}`}
                >
                  {n}
                </Button>
              ))}
            </div>
            <Button
              size="sm"
              disabled={iterations === appliedIter}
              onClick={() => setAppliedIter(iterations)}
              className="bg-cyan-600 hover:bg-cyan-700 text-slate-900 text-xs h-7"
              data-testid="button-apply-subsample"
            >
              Apply
            </Button>
            {appliedIter !== 50 && (
              <Badge variant="outline" className="border-amber-600 text-amber-400 text-xs">Custom: {appliedIter} iterations</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-50 border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg text-slate-900 flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-blue-400" />
            Sub-sampling Eigenvalue Recovery
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-500 text-sm mb-4">
            The full 48-timepoint GSE11923 dataset is randomly sub-sampled to smaller sizes (24, 12, 8, 6 timepoints) 
            and AR(2) is refit {data.nIterations || appliedIter} times per size. This reveals how eigenvalue accuracy degrades with fewer timepoints.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {summaryData.map((s: any) => (
              <div key={s.name} className="bg-slate-100 rounded-lg p-3 text-center border border-slate-200">
                <div className="text-xs text-slate-500 mb-1">{s.name}</div>
                <div className="text-xl font-bold text-slate-900" data-testid={`text-within10-n${s.n}`}>{s.within10}%</div>
                <div className="text-xs text-slate-500">within ±10%</div>
                <div className="text-xs text-emerald-400 mt-1" data-testid={`text-hierarchy-n${s.n}`}>
                  Hierarchy: {s.hierarchy}%
                </div>
              </div>
            ))}
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summaryData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} label={{ value: '% within ±10%', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }} />
                <Bar dataKey="within10" name="Within ±10% of true eigenvalue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-50 border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg text-slate-900">Per-Gene Recovery Detail</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-subsampling-genes">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-3 text-slate-500">Gene</th>
                  <th className="text-left py-2 px-3 text-slate-500">Type</th>
                  <th className="text-right py-2 px-3 text-slate-500">Full |λ|</th>
                  {data.subsampleSizes?.map((n: number) => (
                    <th key={n} className="text-right py-2 px-3 text-slate-500">N={n} (mean±std)</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {geneData.map((g: any) => (
                  <tr key={g.gene} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="py-2 px-3 text-slate-900 font-mono text-xs"><GeneTooltip gene={g.gene}>{g.gene}</GeneTooltip></td>
                    <td className="py-2 px-3">
                      <Badge className={g.type === 'clock' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'}>
                        {g.type}
                      </Badge>
                    </td>
                    <td className="py-2 px-3 text-right text-slate-900 font-mono text-xs">{g.full?.toFixed(4)}</td>
                    {data.subsampleSizes?.map((n: number) => (
                      <td key={n} className="py-2 px-3 text-right text-slate-600 font-mono text-xs">
                        {g[`n${n}_mean`]?.toFixed(4)} ± {g[`n${n}_std`]?.toFixed(4)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-blue-900/20 border-blue-700/30">
        <CardContent className="py-4">
          <p className="text-sm text-blue-300" data-testid="text-subsampling-conclusion">
            <strong>Conclusion:</strong> {data.conclusion}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function BootstrapTab() {
  const [dataset, setDataset] = useState('liver');
  const [nBootstrap, setNBootstrap] = useState(200);
  const [appliedBoot, setAppliedBoot] = useState(200);

  const { data, isLoading, error } = useQuery<any>({
    queryKey: ['/api/validation/robustness-suite/bootstrap-ci', dataset, appliedBoot],
    queryFn: () => fetch(`/api/validation/robustness-suite/bootstrap-ci?dataset=${dataset}&nBootstrap=${appliedBoot}`).then(r => r.json()),
    staleTime: 10 * 60 * 1000,
  });

  if (isLoading) return <LoadingState label="Computing bootstrap confidence intervals..." />;
  if (error || !data) return <ErrorState message="Failed to load bootstrap CI analysis" />;

  const ciChartData = data.genes?.map((g: any) => ({
    gene: g.gene,
    type: g.geneType,
    eigenvalue: g.pointEstimate,
    lower: g.ci95Lower,
    upper: g.ci95Upper,
    ciWidth: g.ciWidth,
    reliable: g.reliable,
    errorY: [g.pointEstimate - g.ci95Lower, g.ci95Upper - g.pointEstimate],
  })).sort((a: any, b: any) => b.eigenvalue - a.eigenvalue) || [];

  const datasets = ['liver', 'liver48', 'kidney', 'heart', 'lung', 'adrenal', 'muscle', 'cerebellum', 'brainstem', 'hypothalamus', 'brown_fat', 'white_fat', 'human_blood'];

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" className="gap-2 border-slate-300 text-slate-600 hover:bg-slate-100" data-testid="button-download-bootstrap" onClick={() => downloadAsCSV(ciChartData.map((d: any) => ({ gene: d.gene, type: d.type, eigenvalue: d.eigenvalue, lower: d.lower, upper: d.upper, ciWidth: d.ciWidth, reliable: d.reliable })), "PAR2_Robustness_BootstrapCI.csv")}>
          <Download className="h-4 w-4" /> Download Results (CSV)
        </Button>
      </div>
      <Card className="bg-slate-50 border-slate-200" data-testid="card-bootstrap-params">
        <CardContent className="p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-sm text-slate-600">Bootstrap iterations:</span>
            <div className="flex items-center gap-2">
              {[100, 200, 500, 1000].map(n => (
                <Button
                  key={n}
                  size="sm"
                  variant={nBootstrap === n ? 'default' : 'outline'}
                  onClick={() => setNBootstrap(n)}
                  className={`text-xs h-7 px-3 ${nBootstrap === n ? 'bg-emerald-600' : 'border-slate-300'}`}
                  data-testid={`button-boot-${n}`}
                >
                  {n}
                </Button>
              ))}
            </div>
            <Button
              size="sm"
              disabled={nBootstrap === appliedBoot}
              onClick={() => setAppliedBoot(nBootstrap)}
              className="bg-cyan-600 hover:bg-cyan-700 text-slate-900 text-xs h-7"
              data-testid="button-apply-bootstrap"
            >
              Apply
            </Button>
            {appliedBoot !== 200 && (
              <Badge variant="outline" className="border-amber-600 text-amber-400 text-xs">Custom: {appliedBoot} bootstraps</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-50 border-slate-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg text-slate-900 flex items-center gap-2">
              <Target className="w-5 h-5 text-emerald-400" />
              Per-Gene Bootstrap Confidence Intervals
            </CardTitle>
            <div className="flex gap-2">
              {datasets.map(d => (
                <Button
                  key={d}
                  data-testid={`button-dataset-${d}`}
                  size="sm"
                  variant={dataset === d ? 'default' : 'outline'}
                  onClick={() => setDataset(d)}
                  className="text-xs"
                >
                  {d === 'liver48' ? 'Liver 48h' : d.charAt(0).toUpperCase() + d.slice(1)}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-slate-500 text-sm mb-4">
            Block bootstrap ({data.nBootstrap || appliedBoot} iterations) on AR(2) residuals produces 95% confidence intervals 
            for each gene's eigenvalue. Genes with CI width &gt; 0.15 are flagged as low-confidence.
          </p>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-slate-100 rounded-lg p-3 text-center border border-slate-200">
              <div className="text-xs text-slate-500 mb-1">Clock Genes</div>
              <div className="text-lg font-bold text-blue-400" data-testid="text-clock-mean-eigenvalue">
                |λ| = {data.clockSummary?.meanEigenvalue?.toFixed(4)}
              </div>
              <div className="text-xs text-slate-500">mean CI width: {data.clockSummary?.meanCiWidth?.toFixed(3)}</div>
              <div className="text-xs text-emerald-400">{(data.clockSummary?.reliableRate * 100)?.toFixed(0)}% reliable</div>
            </div>
            <div className="bg-slate-100 rounded-lg p-3 text-center border border-slate-200">
              <div className="text-xs text-slate-500 mb-1">Target Genes</div>
              <div className="text-lg font-bold text-amber-400" data-testid="text-target-mean-eigenvalue">
                |λ| = {data.targetSummary?.meanEigenvalue?.toFixed(4)}
              </div>
              <div className="text-xs text-slate-500">mean CI width: {data.targetSummary?.meanCiWidth?.toFixed(3)}</div>
              <div className="text-xs text-emerald-400">{(data.targetSummary?.reliableRate * 100)?.toFixed(0)}% reliable</div>
            </div>
            <div className="bg-slate-100 rounded-lg p-3 text-center border border-slate-200">
              <div className="text-xs text-slate-500 mb-1">Gap (Clock - Target)</div>
              <div className="text-lg font-bold text-slate-900" data-testid="text-gap-estimate">
                {data.gapEstimate?.pointEstimate?.toFixed(4)}
              </div>
              <div className="text-xs text-slate-500">
                95% CI: [{data.gapEstimate?.ci95Lower?.toFixed(4)}, {data.gapEstimate?.ci95Upper?.toFixed(4)}]
              </div>
            </div>
          </div>

          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ciChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis type="number" stroke="#64748b" fontSize={11} domain={[0, 'auto']} label={{ value: 'Eigenvalue |λ|', position: 'bottom', fill: '#64748b', fontSize: 11 }} />
                <YAxis dataKey="gene" type="category" stroke="#64748b" fontSize={10} width={60} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                  formatter={(val: any, name: string, props: any) => {
                    if (name === 'eigenvalue') {
                      const item = props.payload;
                      return [`${val.toFixed(4)} [${item.lower?.toFixed(4)}, ${item.upper?.toFixed(4)}]`, '|λ| [95% CI]'];
                    }
                    return [val, name];
                  }}
                />
                <Bar dataKey="eigenvalue" name="eigenvalue" radius={[0, 4, 4, 0]}>
                  {ciChartData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.type === 'clock' ? '#3b82f6' : '#f59e0b'} fillOpacity={entry.reliable ? 0.8 : 0.4} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-50 border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg text-slate-900">Confidence Interval Detail</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-bootstrap-genes">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-3 text-slate-500">Gene</th>
                  <th className="text-left py-2 px-3 text-slate-500">Type</th>
                  <th className="text-right py-2 px-3 text-slate-500">|λ|</th>
                  <th className="text-right py-2 px-3 text-slate-500">95% CI</th>
                  <th className="text-right py-2 px-3 text-slate-500">CI Width</th>
                  <th className="text-right py-2 px-3 text-slate-500">R²</th>
                  <th className="text-center py-2 px-3 text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.genes?.sort((a: any, b: any) => b.pointEstimate - a.pointEstimate).map((g: any) => (
                  <tr key={g.gene} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="py-2 px-3 text-slate-900 font-mono text-xs"><GeneTooltip gene={g.gene}>{g.gene}</GeneTooltip></td>
                    <td className="py-2 px-3">
                      <Badge className={g.geneType === 'clock' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'}>
                        {g.geneType}
                      </Badge>
                    </td>
                    <td className="py-2 px-3 text-right text-slate-900 font-mono text-xs">{g.pointEstimate?.toFixed(4)}</td>
                    <td className="py-2 px-3 text-right text-slate-600 font-mono text-xs">
                      [{g.ci95Lower?.toFixed(4)}, {g.ci95Upper?.toFixed(4)}]
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-xs" style={{ color: g.reliable ? '#34d399' : '#fbbf24' }}>
                      {g.ciWidth?.toFixed(4)}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-600 font-mono text-xs">{g.r2?.toFixed(4)}</td>
                    <td className="py-2 px-3 text-center">
                      <Badge className={g.reliable ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'}>
                        {g.reliable ? 'Reliable' : 'Wide CI'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-emerald-900/20 border-emerald-700/30">
        <CardContent className="py-4">
          <p className="text-sm text-emerald-300" data-testid="text-bootstrap-conclusion">
            <strong>Conclusion:</strong> {data.conclusion}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function FirstDiffTab() {
  const { data, isLoading, error } = useQuery<any>({
    queryKey: ['/api/validation/robustness-suite/first-difference'],
    staleTime: 10 * 60 * 1000,
  });

  if (isLoading) return <LoadingState label="Running first-difference comparison across 12 tissues..." />;
  if (error || !data) return <ErrorState message="Failed to load first-difference analysis" />;

  const chartData = data.datasets?.map((ds: any) => ({
    tissue: ds.dataset,
    rawGap: ds.rawGap,
    diffGap: ds.diffGap,
    rawPreserved: ds.hierarchyPreservedRaw,
    diffPreserved: ds.hierarchyPreservedDiff,
  })) || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" className="gap-2 border-slate-300 text-slate-600 hover:bg-slate-100" data-testid="button-download-first-diff" onClick={() => downloadAsCSV(chartData, "PAR2_Robustness_FirstDifference.csv")}>
          <Download className="h-4 w-4" /> Download Results (CSV)
        </Button>
      </div>
      <Card className="bg-slate-50 border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg text-slate-900 flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-purple-400" />
            First-Difference Stationarity Defence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-500 text-sm mb-4">
            Each gene's time series is first-differenced (y[t] - y[t-1]) before AR(2) fitting, which removes trends 
            and makes non-stationary series stationary. If the clock &gt; target hierarchy holds in both raw and 
            differenced data, non-stationarity is not driving the result.
          </p>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-slate-100 rounded-lg p-4 text-center border border-slate-200">
              <div className="text-sm text-slate-500 mb-1">Raw Data</div>
              <div className="text-2xl font-bold text-blue-400" data-testid="text-raw-preserved">
                {data.datasets?.filter((d: any) => d.hierarchyPreservedRaw).length}/{data.totalDatasets}
              </div>
              <div className="text-xs text-slate-500">tissues preserve hierarchy</div>
            </div>
            <div className="bg-slate-100 rounded-lg p-4 text-center border border-slate-200">
              <div className="text-sm text-slate-500 mb-1">First-Differenced</div>
              <div className="text-2xl font-bold text-purple-400" data-testid="text-diff-preserved">
                {data.hierarchyPreservedCount}/{data.totalDatasets}
              </div>
              <div className="text-xs text-slate-500">tissues preserve hierarchy</div>
            </div>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="tissue" stroke="#64748b" fontSize={10} angle={-30} textAnchor="end" height={60} />
                <YAxis stroke="#64748b" fontSize={11} label={{ value: 'Gap (Clock - Target)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }} />
                <Legend />
                <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" />
                <Bar dataKey="rawGap" name="Raw Gap" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="diffGap" name="Differenced Gap" fill="#a855f7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-50 border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg text-slate-900">Per-Tissue Detail</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-first-diff-tissues">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-3 text-slate-500">Tissue</th>
                  <th className="text-right py-2 px-3 text-slate-500">Raw Clock</th>
                  <th className="text-right py-2 px-3 text-slate-500">Raw Target</th>
                  <th className="text-right py-2 px-3 text-slate-500">Raw Gap</th>
                  <th className="text-right py-2 px-3 text-slate-500">Diff Clock</th>
                  <th className="text-right py-2 px-3 text-slate-500">Diff Target</th>
                  <th className="text-right py-2 px-3 text-slate-500">Diff Gap</th>
                  <th className="text-center py-2 px-3 text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.datasets?.map((ds: any) => (
                  <tr key={ds.dataset} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="py-2 px-3 text-slate-900 text-xs">{ds.dataset}</td>
                    <td className="py-2 px-3 text-right text-blue-300 font-mono text-xs">{ds.rawClockMean?.toFixed(4)}</td>
                    <td className="py-2 px-3 text-right text-amber-300 font-mono text-xs">{ds.rawTargetMean?.toFixed(4)}</td>
                    <td className="py-2 px-3 text-right text-slate-900 font-mono text-xs">{ds.rawGap?.toFixed(4)}</td>
                    <td className="py-2 px-3 text-right text-purple-300 font-mono text-xs">{ds.diffClockMean?.toFixed(4)}</td>
                    <td className="py-2 px-3 text-right text-purple-300 font-mono text-xs">{ds.diffTargetMean?.toFixed(4)}</td>
                    <td className="py-2 px-3 text-right text-slate-900 font-mono text-xs">{ds.diffGap?.toFixed(4)}</td>
                    <td className="py-2 px-3 text-center">
                      <Badge className={ds.hierarchyPreservedDiff
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : 'bg-red-500/20 text-red-400 border-red-500/30'}>
                        {ds.hierarchyPreservedDiff ? 'Preserved' : 'Reversed'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-purple-900/20 border-purple-700/30">
        <CardContent className="py-4">
          <p className="text-sm text-purple-300" data-testid="text-firstdiff-conclusion">
            <strong>Conclusion:</strong> {data.conclusion}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function PopulationCVTab() {
  const { data, isLoading, error } = useQuery<any>({
    queryKey: ['/api/validation/robustness-suite/population-cv'],
    staleTime: 10 * 60 * 1000,
  });

  if (isLoading) return <LoadingState label="Running population-level cross-validation stability analysis..." />;
  if (error || !data) return <ErrorState message="Failed to load population CV analysis" />;

  const foldChartData = data.datasets?.flatMap((ds: any) =>
    ds.folds?.map((f: any) => ({
      label: `${ds.dataset} F${f.foldIndex + 1}`,
      dataset: ds.dataset,
      fold: f.foldIndex + 1,
      clockMean: f.clockMeanEigenvalue,
      targetMean: f.targetMeanEigenvalue,
      gap: f.gap,
      preserved: f.hierarchyPreserved,
    })) || []
  ) || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" className="gap-2 border-slate-300 text-slate-600 hover:bg-slate-100" data-testid="button-download-population-cv" onClick={() => downloadAsCSV(foldChartData, "PAR2_Robustness_PopulationCV.csv")}>
          <Download className="h-4 w-4" /> Download Results (CSV)
        </Button>
      </div>
      <Card className="bg-slate-50 border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg text-slate-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-cyan-400" />
            Population-Level CV Stability
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-500 text-sm mb-4">
            Even though individual gene-pair predictions have a 45.2% win rate, the <em>population-level</em> statistics 
            (mean eigenvalue for clock vs target genes) may be stable across cross-validation folds. This analysis 
            uses 5-fold CV: for each fold, one segment of timepoints is held out, AR(2) is refit on the remaining data, 
            and the clock &gt; target hierarchy is checked.
          </p>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-slate-100 rounded-lg p-4 text-center border border-slate-200">
              <div className="text-sm text-slate-500 mb-1">Hierarchy Preserved</div>
              <div className="text-2xl font-bold text-emerald-400" data-testid="text-cv-hierarchy-rate">
                {(data.overallHierarchyRate * 100)?.toFixed(0)}%
              </div>
              <div className="text-xs text-slate-500">of all folds</div>
            </div>
            <div className="bg-slate-100 rounded-lg p-4 text-center border border-slate-200">
              <div className="text-sm text-slate-500 mb-1">Mean Gap</div>
              <div className="text-2xl font-bold text-slate-900" data-testid="text-cv-mean-gap">
                {data.overallGapMean?.toFixed(4)}
              </div>
              <div className="text-xs text-slate-500">± {data.overallGapStd?.toFixed(4)}</div>
            </div>
            <div className="bg-slate-100 rounded-lg p-4 text-center border border-slate-200">
              <div className="text-sm text-slate-500 mb-1">Datasets Tested</div>
              <div className="text-2xl font-bold text-blue-400" data-testid="text-cv-datasets">
                {data.datasets?.length}
              </div>
              <div className="text-xs text-slate-500">with 5-fold CV each</div>
            </div>
          </div>

          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={foldChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="label" stroke="#64748b" fontSize={9} angle={-45} textAnchor="end" height={70} />
                <YAxis stroke="#64748b" fontSize={11} label={{ value: 'Mean |λ|', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }} />
                <Legend />
                <Bar dataKey="clockMean" name="Clock Mean |λ|" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="targetMean" name="Target Mean |λ|" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-50 border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg text-slate-900">Per-Dataset Fold Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.datasets?.map((ds: any) => (
              <div key={ds.dataset} className="bg-slate-100 rounded-lg p-4 border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-900 font-medium">{ds.dataset}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">{ds.totalTimepoints} timepoints, {ds.clockGeneCount} clock / {ds.targetGeneCount} target</span>
                    <Badge className={ds.hierarchyPreservedRate === 1
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'}>
                      {(ds.hierarchyPreservedRate * 100).toFixed(0)}% preserved
                    </Badge>
                  </div>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {ds.folds?.map((f: any) => (
                    <div key={f.foldIndex} className={`text-center p-2 rounded text-xs ${f.hierarchyPreserved ? 'bg-emerald-900/30 border border-emerald-700/30' : 'bg-red-900/30 border border-red-700/30'}`}>
                      <div className="text-slate-500">Fold {f.foldIndex + 1}</div>
                      <div className="text-slate-900 font-mono">gap={f.gap?.toFixed(3)}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-cyan-900/20 border-cyan-700/30">
        <CardContent className="py-4">
          <p className="text-sm text-cyan-300" data-testid="text-cv-conclusion">
            <strong>Conclusion:</strong> {data.conclusion}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function DetrendTab() {
  const { data, isLoading, error } = useQuery<any>({
    queryKey: ['/api/validation/robustness-suite/detrend'],
    staleTime: 10 * 60 * 1000,
  });

  if (isLoading) return <LoadingState label="Running linear detrending analysis across 12 tissues..." />;
  if (error || !data) return <ErrorState message="Failed to load detrend analysis" />;

  const chartData = data.datasets?.map((ds: any) => ({
    tissue: ds.dataset,
    rawGap: ds.rawGap,
    detrendedGap: ds.detrendedGap,
  })) || [];

  const comp = data.comparisonWithDifferencing;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" className="gap-2 border-slate-300 text-slate-600 hover:bg-slate-100" data-testid="button-download-detrend" onClick={() => downloadAsCSV(chartData, "PAR2_Robustness_Detrend.csv")}>
          <Download className="h-4 w-4" /> Download Results (CSV)
        </Button>
      </div>
      <Card className="bg-slate-50 border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg text-slate-900 flex items-center gap-2">
            <Minus className="w-5 h-5 text-teal-400" />
            Linear Detrending vs First-Differencing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-500 text-sm mb-4">
            First-differencing (y[t] - y[t-1]) is aggressive: it removes trends but also destroys oscillatory autocorrelation. 
            Linear detrending removes only the linear trend component, preserving the oscillatory structure that AR(2) is designed to capture. 
            If the hierarchy survives detrending but not differencing, the gap is driven by genuine oscillatory persistence, not linear drift.
          </p>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-slate-100 rounded-lg p-4 text-center border border-slate-200">
              <div className="text-sm text-slate-500 mb-1">Raw Data</div>
              <div className="text-2xl font-bold text-blue-400" data-testid="text-detrend-raw">
                {data.datasets?.filter((d: any) => d.hierarchyPreservedRaw).length}/{data.totalDatasets}
              </div>
              <div className="text-xs text-slate-500">tissues preserve hierarchy</div>
            </div>
            <div className="bg-slate-100 rounded-lg p-4 text-center border border-slate-200">
              <div className="text-sm text-slate-500 mb-1">Detrended</div>
              <div className="text-2xl font-bold text-teal-400" data-testid="text-detrend-preserved">
                {data.hierarchyPreservedCount}/{data.totalDatasets}
              </div>
              <div className="text-xs text-slate-500">tissues preserve hierarchy</div>
            </div>
            <div className="bg-slate-100 rounded-lg p-4 text-center border border-slate-200">
              <div className="text-sm text-slate-500 mb-1">First-Differenced</div>
              <div className="text-2xl font-bold text-purple-400" data-testid="text-detrend-diff-compare">
                {comp?.differencingPreserved}/{comp?.total}
              </div>
              <div className="text-xs text-slate-500">tissues preserve hierarchy</div>
            </div>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="tissue" stroke="#64748b" fontSize={10} angle={-30} textAnchor="end" height={60} />
                <YAxis stroke="#64748b" fontSize={11} label={{ value: 'Gap (Clock - Target)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }} />
                <Legend />
                <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" />
                <Bar dataKey="rawGap" name="Raw Gap" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="detrendedGap" name="Detrended Gap" fill="#14b8a6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-50 border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg text-slate-900">Per-Tissue Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-detrend-tissues">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-3 text-slate-500">Tissue</th>
                  <th className="text-right py-2 px-3 text-slate-500">Raw Gap</th>
                  <th className="text-right py-2 px-3 text-slate-500">Detrended Gap</th>
                  <th className="text-right py-2 px-3 text-slate-500">Change</th>
                  <th className="text-center py-2 px-3 text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.datasets?.map((ds: any) => {
                  const change = ds.detrendedGap - ds.rawGap;
                  return (
                    <tr key={ds.dataset} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="py-2 px-3 text-slate-900 text-xs">{ds.dataset}</td>
                      <td className="py-2 px-3 text-right text-blue-300 font-mono text-xs">{ds.rawGap?.toFixed(4)}</td>
                      <td className="py-2 px-3 text-right text-teal-300 font-mono text-xs">{ds.detrendedGap?.toFixed(4)}</td>
                      <td className={`py-2 px-3 text-right font-mono text-xs ${change >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {change >= 0 ? '+' : ''}{change?.toFixed(4)}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <Badge className={ds.hierarchyPreservedDetrended
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          : 'bg-red-500/20 text-red-400 border-red-500/30'}>
                          {ds.hierarchyPreservedDetrended ? 'Preserved' : 'Reversed'}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-teal-900/20 border-teal-700/30">
        <CardContent className="py-4">
          <p className="text-sm text-teal-300" data-testid="text-detrend-conclusion">
            <strong>Conclusion:</strong> {data.conclusion}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function PermutationTab() {
  const { data, isLoading, error } = useQuery<any>({
    queryKey: ['/api/validation/robustness-suite/permutation-test'],
    staleTime: 10 * 60 * 1000,
  });

  if (isLoading) return <LoadingState label="Running 10,000-permutation label-shuffle test..." />;
  if (error || !data) return <ErrorState message="Failed to load permutation test" />;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" className="gap-2 border-slate-300 text-slate-600 hover:bg-slate-100" data-testid="button-download-permutation" onClick={() => downloadAsCSV(data.datasets?.map((d: any) => ({ dataset: d.dataset, observedGap: d.observedGap, pValue: d.pValue, significant: d.pValue < 0.05 })) || [], "PAR2_Robustness_Permutation.csv")}>
          <Download className="h-4 w-4" /> Download Results (CSV)
        </Button>
      </div>
      <Card className="bg-slate-50 border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg text-slate-900 flex items-center gap-2">
            <Shuffle className="w-5 h-5 text-rose-400" />
            Gap Permutation Test
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-500 text-sm mb-4">
            The clock/target labels are randomly shuffled 10,000 times. For each permutation, the gap (mean clock |λ| - mean target |λ|) 
            is recomputed. If the observed gap falls in the extreme tail of this null distribution, the hierarchy cannot be explained 
            by random gene selection — it reflects a genuine biological difference.
          </p>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-slate-100 rounded-lg p-4 text-center border border-slate-200">
              <div className="text-sm text-slate-500 mb-1">Datasets Significant (p &lt; 0.05)</div>
              <div className="text-2xl font-bold text-emerald-400" data-testid="text-perm-significant">
                {data.datasets?.filter((d: any) => d.pValue < 0.05).length}/{data.datasets?.length}
              </div>
            </div>
            <div className="bg-slate-100 rounded-lg p-4 text-center border border-slate-200">
              <div className="text-sm text-slate-500 mb-1">All p &lt; 0.001?</div>
              <div className="text-2xl font-bold" data-testid="text-perm-all-sig">
                {data.allSignificant ? (
                  <span className="text-emerald-400">Yes</span>
                ) : (
                  <span className="text-amber-400">No</span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {data.datasets?.map((ds: any) => (
        <Card key={ds.dataset} className="bg-slate-50 border-slate-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base text-slate-900">{ds.dataset}</CardTitle>
              <div className="flex items-center gap-3">
                <Badge className={ds.pValue < 0.001
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : ds.pValue < 0.05
                    ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                    : 'bg-red-500/20 text-red-400 border-red-500/30'}>
                  p {ds.pValue < 0.001 ? '< 0.001' : `= ${ds.pValue.toFixed(4)}`}
                </Badge>
                <span className="text-xs text-slate-500">z = {ds.zScore?.toFixed(2)}</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-3 mb-4 text-center text-xs">
              <div className="bg-slate-100 rounded p-2 border border-slate-200">
                <div className="text-slate-500">Observed Gap</div>
                <div className="text-slate-900 font-mono font-bold">{ds.observedGap?.toFixed(4)}</div>
              </div>
              <div className="bg-slate-100 rounded p-2 border border-slate-200">
                <div className="text-slate-500">Null Mean</div>
                <div className="text-slate-600 font-mono">{ds.nullMean?.toFixed(4)}</div>
              </div>
              <div className="bg-slate-100 rounded p-2 border border-slate-200">
                <div className="text-slate-500">Null Std</div>
                <div className="text-slate-600 font-mono">{ds.nullStd?.toFixed(4)}</div>
              </div>
              <div className="bg-slate-100 rounded p-2 border border-slate-200">
                <div className="text-slate-500">Genes</div>
                <div className="text-slate-600 font-mono">{ds.clockGeneCount}c / {ds.targetGeneCount}t</div>
              </div>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ds.nullDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="binCenter" stroke="#64748b" fontSize={9} tickFormatter={(v: number) => v.toFixed(2)} />
                  <YAxis stroke="#64748b" fontSize={10} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                    formatter={(val: any) => [val, 'Count']}
                    labelFormatter={(v: any) => `Gap ≈ ${Number(v).toFixed(3)}`}
                  />
                  <Bar dataKey="count" fill="#94a3b8" radius={[2, 2, 0, 0]} />
                  <ReferenceLine x={ds.observedGap} stroke="#ef4444" strokeWidth={2} label={{ value: 'Observed', position: 'top', fill: '#ef4444', fontSize: 11 }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      ))}

      <Card className="bg-rose-900/20 border-rose-700/30">
        <CardContent className="py-4">
          <p className="text-sm text-rose-300" data-testid="text-permutation-conclusion">
            <strong>Conclusion:</strong> {data.conclusion}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function LOTOTab() {
  const { data, isLoading, error } = useQuery<any>({
    queryKey: ['/api/validation/robustness-suite/loto'],
    staleTime: 10 * 60 * 1000,
  });

  if (isLoading) return <LoadingState label="Running leave-one-tissue-out analysis across 12 mouse tissues..." />;
  if (error || !data) return <ErrorState message="Failed to load leave-one-tissue-out analysis" />;

  const chartData = data.tissues?.map((t: any) => ({
    tissue: t.heldOutTissue,
    heldOutGap: Number(t.heldOutGap?.toFixed(4)),
    trainGap: Number(t.trainGap?.toFixed(4)),
    correct: t.predictionCorrect,
  })) || [];

  const barColors = chartData.map((d: any) => d.correct ? '#10b981' : '#ef4444');

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" className="gap-2 border-slate-300 text-slate-600 hover:bg-slate-100" data-testid="button-download-loto" onClick={() => downloadAsCSV(chartData, "PAR2_Robustness_LOTO.csv")}>
          <Download className="h-4 w-4" /> Download Results (CSV)
        </Button>
      </div>
      <Card className="bg-slate-50 border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg text-slate-900 flex items-center gap-2">
            <Crosshair className="w-5 h-5 text-cyan-400" />
            Leave-One-Tissue-Out Cross-Validation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-500 text-sm mb-4">
            For each of the 12 mouse tissues (GSE54650), that tissue is held out and the clock &gt; target hierarchy 
            is computed from the remaining 11. The held-out tissue is then checked: does it independently show the 
            same pattern the training set predicts? This tests whether the hierarchy is driven by any single tissue 
            or is a genuinely cross-tissue phenomenon.
          </p>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-slate-100 rounded-lg p-4 text-center border border-slate-200">
              <div className="text-sm text-slate-500 mb-1">Predictions Correct</div>
              <div className="text-2xl font-bold text-emerald-400" data-testid="text-loto-correct">
                {data.predictionsCorrect}/{data.totalTissues}
              </div>
            </div>
            <div className="bg-slate-100 rounded-lg p-4 text-center border border-slate-200">
              <div className="text-sm text-slate-500 mb-1">Held-Out Hierarchy Rate</div>
              <div className="text-2xl font-bold text-cyan-400" data-testid="text-loto-heldout-rate">
                {(data.heldOutHierarchyRate * 100).toFixed(0)}%
              </div>
            </div>
            <div className="bg-slate-100 rounded-lg p-4 text-center border border-slate-200">
              <div className="text-sm text-slate-500 mb-1">Training Hierarchy Rate</div>
              <div className="text-2xl font-bold text-blue-400" data-testid="text-loto-train-rate">
                {(data.trainHierarchyRate * 100).toFixed(0)}%
              </div>
            </div>
          </div>

          <h4 className="text-sm font-medium text-slate-900 mb-3">Eigenvalue Gap by Tissue (Held-Out vs Training)</h4>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis type="number" stroke="#64748b" fontSize={10} tickFormatter={(v: number) => v.toFixed(3)} />
                <YAxis type="category" dataKey="tissue" stroke="#64748b" fontSize={11} width={100} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                  formatter={(val: any, name: string) => [Number(val).toFixed(4), name === 'heldOutGap' ? 'Held-Out Gap' : 'Training Gap']}
                />
                <Legend />
                <Bar dataKey="heldOutGap" name="Held-Out Gap" radius={[0, 4, 4, 0]}>
                  {chartData.map((entry: any, index: number) => (
                    <Cell key={index} fill={barColors[index]} />
                  ))}
                </Bar>
                <Bar dataKey="trainGap" name="Training Gap (11 tissues)" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                <ReferenceLine x={0} stroke="#ef4444" strokeDasharray="3 3" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-50 border-slate-200">
        <CardHeader>
          <CardTitle className="text-base text-slate-900">Per-Tissue Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-3 text-slate-500 font-medium">Held-Out Tissue</th>
                  <th className="text-center py-2 px-3 text-slate-500 font-medium">Clock |λ|</th>
                  <th className="text-center py-2 px-3 text-slate-500 font-medium">Target |λ|</th>
                  <th className="text-center py-2 px-3 text-slate-500 font-medium">Gap</th>
                  <th className="text-center py-2 px-3 text-slate-500 font-medium">Train Gap</th>
                  <th className="text-center py-2 px-3 text-slate-500 font-medium">Prediction</th>
                </tr>
              </thead>
              <tbody>
                {data.tissues?.map((t: any) => (
                  <tr key={t.heldOutTissue} className="border-b border-slate-200">
                    <td className="py-2 px-3 text-slate-900 font-medium">{t.heldOutTissue}</td>
                    <td className="py-2 px-3 text-center text-blue-300 font-mono text-xs">{t.heldOutClockMean?.toFixed(4)}</td>
                    <td className="py-2 px-3 text-center text-amber-300 font-mono text-xs">{t.heldOutTargetMean?.toFixed(4)}</td>
                    <td className={`py-2 px-3 text-center font-mono text-xs ${t.heldOutGap > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {t.heldOutGap > 0 ? '+' : ''}{t.heldOutGap?.toFixed(4)}
                    </td>
                    <td className="py-2 px-3 text-center text-blue-400 font-mono text-xs">{t.trainGap?.toFixed(4)}</td>
                    <td className="py-2 px-3 text-center">
                      <Badge className={t.predictionCorrect
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : 'bg-red-500/20 text-red-400 border-red-500/30'}>
                        {t.predictionCorrect ? 'CORRECT' : 'MISS'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-cyan-900/20 border-cyan-700/30">
        <CardContent className="py-4">
          <p className="text-sm text-cyan-300" data-testid="text-loto-conclusion">
            <strong>Conclusion:</strong> {data.conclusion}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function ModelOrderTab() {
  const { data, isLoading, error } = useQuery<any>({
    queryKey: ['/api/validation/robustness-suite/model-order'],
    staleTime: 10 * 60 * 1000,
  });

  if (isLoading) return <LoadingState label="Running model order sensitivity analysis across datasets..." />;
  if (error || !data) return <ErrorState message="Failed to load model order sensitivity analysis" />;

  const gapChartData = data.datasets?.map((ds: any) => ({
    dataset: ds.dataset,
    ar1Gap: ds.orders?.find((o: any) => o.order === 1)?.gap,
    ar2Gap: ds.orders?.find((o: any) => o.order === 2)?.gap,
    ar3Gap: ds.orders?.find((o: any) => o.order === 3)?.gap,
    ar4Gap: ds.orders?.find((o: any) => o.order === 4)?.gap,
  })) || [];

  const orderSummary = data.orderSummary || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" className="gap-2 border-slate-300 text-slate-600 hover:bg-slate-100" data-testid="button-download-model-order" onClick={() => downloadAsCSV(gapChartData, "PAR2_Robustness_ModelOrder.csv")}>
          <Download className="h-4 w-4" /> Download Results (CSV)
        </Button>
      </div>
      <Card className="bg-slate-50 border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg text-slate-900 flex items-center gap-2">
            <Gauge className="w-5 h-5 text-orange-400" />
            Eigenvalue Gap by AR Order Across Datasets
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-500 text-sm mb-4">
            AR(p) models are fit for p=1,2,3,4 across {data.datasets?.length || 0} datasets.
            The bar chart shows the eigenvalue gap (clock mean |λ| − target mean |λ|) for each order.
            A positive gap indicates the clock &gt; target hierarchy is preserved.
          </p>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={gapChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="dataset" stroke="#64748b" fontSize={10} angle={-30} textAnchor="end" height={60} />
                <YAxis stroke="#64748b" fontSize={11} label={{ value: 'Eigenvalue Gap', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }} />
                <Legend />
                <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" />
                <Bar dataKey="ar1Gap" name="AR(1)" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="ar2Gap" name="AR(2)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="ar3Gap" name="AR(3)" fill="#a855f7" radius={[4, 4, 0, 0]} />
                <Bar dataKey="ar4Gap" name="AR(4)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-50 border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg text-slate-900">Per-Order Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-model-order-summary">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-3 text-slate-500">Order</th>
                  <th className="text-right py-2 px-3 text-slate-500">Hierarchy Preserved</th>
                  <th className="text-right py-2 px-3 text-slate-500">Preservation Rate</th>
                  <th className="text-right py-2 px-3 text-slate-500">Mean R²</th>
                  <th className="text-right py-2 px-3 text-slate-500">Mean Gap</th>
                </tr>
              </thead>
              <tbody>
                {orderSummary.map((o: any) => (
                  <tr key={o.order} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="py-2 px-3 text-slate-900 font-medium">
                      <Badge className={o.order === 2 ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-slate-500/20 text-slate-500 border-slate-300/30'}>
                        AR({o.order})
                      </Badge>
                    </td>
                    <td className="py-2 px-3 text-right text-slate-900 font-mono text-xs">
                      {o.hierarchyPreservedCount}/{o.totalDatasets}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-xs" style={{ color: o.preservationRate >= 0.8 ? '#34d399' : o.preservationRate >= 0.5 ? '#fbbf24' : '#f87171' }}>
                      {(o.preservationRate * 100).toFixed(0)}%
                    </td>
                    <td className="py-2 px-3 text-right text-slate-600 font-mono text-xs">{o.meanR2?.toFixed(4)}</td>
                    <td className="py-2 px-3 text-right text-slate-600 font-mono text-xs">{o.meanGap?.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-50 border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg text-slate-900">Per-Dataset Detail</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-model-order-detail">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-3 text-slate-500">Dataset</th>
                  <th className="text-left py-2 px-3 text-slate-500">Order</th>
                  <th className="text-right py-2 px-3 text-slate-500">Clock |λ|</th>
                  <th className="text-right py-2 px-3 text-slate-500">Target |λ|</th>
                  <th className="text-right py-2 px-3 text-slate-500">Gap</th>
                  <th className="text-right py-2 px-3 text-slate-500">R²</th>
                  <th className="text-center py-2 px-3 text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.datasets?.flatMap((ds: any) =>
                  ds.orders?.map((o: any) => (
                    <tr key={`${ds.dataset}-${o.order}`} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="py-2 px-3 text-slate-900 text-xs">{ds.dataset}</td>
                      <td className="py-2 px-3">
                        <Badge className={o.order === 2 ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-slate-500/20 text-slate-500 border-slate-300/30'}>
                          AR({o.order})
                        </Badge>
                      </td>
                      <td className="py-2 px-3 text-right text-blue-300 font-mono text-xs">{o.clockMean?.toFixed(4)}</td>
                      <td className="py-2 px-3 text-right text-amber-300 font-mono text-xs">{o.targetMean?.toFixed(4)}</td>
                      <td className="py-2 px-3 text-right text-slate-900 font-mono text-xs">{o.gap?.toFixed(4)}</td>
                      <td className="py-2 px-3 text-right text-slate-600 font-mono text-xs">{o.r2?.toFixed(4)}</td>
                      <td className="py-2 px-3 text-center">
                        <Badge className={o.hierarchyPreserved
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          : 'bg-red-500/20 text-red-400 border-red-500/30'}>
                          {o.hierarchyPreserved ? 'Preserved' : 'Reversed'}
                        </Badge>
                      </td>
                    </tr>
                  )) || []
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-orange-900/20 border-orange-700/30">
        <CardContent className="py-4">
          <p className="text-sm text-orange-300" data-testid="text-model-order-conclusion">
            <strong>Conclusion:</strong> {data.conclusion}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function MultiCatPermutationTab() {
  const { data, isLoading, error } = useQuery<any>({
    queryKey: ['/api/validation/robustness-suite/multi-category-permutation'],
    staleTime: 10 * 60 * 1000,
  });

  if (isLoading) return <LoadingState label="Running multi-category permutation test..." />;
  if (error || !data) return <ErrorState message="Failed to load multi-category permutation analysis" />;

  const categories = data.categoryMeans?.sort((a: any, b: any) => b.meanEigenvalue - a.meanEigenvalue) || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" className="gap-2 border-slate-300 text-slate-600 hover:bg-slate-100" data-testid="button-download-multi-cat-perm" onClick={() => downloadAsCSV(categories.map((c: any) => ({ category: c.category, meanEigenvalue: c.meanEigenvalue, n: c.n })), "PAR2_Robustness_MultiCatPermutation.csv")}>
          <Download className="h-4 w-4" /> Download Results (CSV)
        </Button>
      </div>
      <Card className="bg-slate-50 border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg text-slate-900 flex items-center gap-2">
            <Network className="w-5 h-5 text-violet-400" />
            Multi-Category Permutation Test
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-500 text-sm mb-4">
            A Kruskal-Wallis H test across all gene categories, with permutation-based p-value to assess whether
            the eigenvalue hierarchy across multiple categories could arise by chance.
          </p>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-slate-100 rounded-lg p-4 text-center border border-slate-200">
              <div className="text-xs text-slate-500 mb-1">KW H Statistic</div>
              <div className="text-2xl font-bold text-violet-400" data-testid="text-multi-cat-kw-h">
                {data.observedH?.toFixed(2)}
              </div>
            </div>
            <div className="bg-slate-100 rounded-lg p-4 text-center border border-slate-200">
              <div className="text-xs text-slate-500 mb-1">Permutation p-value</div>
              <div className="text-2xl font-bold text-slate-900" data-testid="text-multi-cat-perm-pvalue">
                {data.permutationPValue < 0.001 ? '<0.001' : data.permutationPValue?.toFixed(4)}
              </div>
              <Badge className={data.permutationPValue < 0.05
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 mt-1'
                : 'bg-red-500/20 text-red-400 border-red-500/30 mt-1'}>
                {data.permutationPValue < 0.05 ? 'Pass' : 'Fail'}
              </Badge>
            </div>
            <div className="bg-slate-100 rounded-lg p-4 text-center border border-slate-200">
              <div className="text-xs text-slate-500 mb-1">Total Genes</div>
              <div className="text-2xl font-bold text-slate-600" data-testid="text-multi-cat-total-genes">
                {data.totalGenes}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-50 border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg text-slate-900">Category Hierarchy Ranking</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-multi-cat-permutation-ranking">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-3 text-slate-500">Rank</th>
                  <th className="text-left py-2 px-3 text-slate-500">Category</th>
                  <th className="text-right py-2 px-3 text-slate-500">Mean |λ|</th>
                  <th className="text-right py-2 px-3 text-slate-500">Gene Count</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat: any, idx: number) => (
                  <tr key={cat.category} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="py-2 px-3 text-slate-900 font-medium">{idx + 1}</td>
                    <td className="py-2 px-3 text-slate-900 text-xs">
                      <Badge className={idx === 0 ? 'bg-violet-500/20 text-violet-400 border-violet-500/30' : 'bg-slate-500/20 text-slate-500 border-slate-300/30'}>
                        {cat.category}
                      </Badge>
                    </td>
                    <td className="py-2 px-3 text-right text-slate-900 font-mono text-xs" data-testid={`text-multi-cat-perm-eigenvalue-${idx}`}>
                      {cat.meanEigenvalue?.toFixed(4)}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-600 font-mono text-xs">{cat.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-violet-900/20 border-violet-700/30">
        <CardContent className="py-4">
          <p className="text-sm text-violet-300" data-testid="text-multi-cat-permutation-conclusion">
            <strong>Conclusion:</strong> {data.conclusion}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function MultiCatBootstrapTab() {
  const { data, isLoading, error } = useQuery<any>({
    queryKey: ['/api/validation/robustness-suite/multi-category-bootstrap'],
    staleTime: 10 * 60 * 1000,
  });

  if (isLoading) return <LoadingState label="Computing multi-category bootstrap confidence intervals..." />;
  if (error || !data) return <ErrorState message="Failed to load multi-category bootstrap analysis" />;

  const categories = data.categories || [];
  const chartData = categories.map((cat: any) => ({
    category: cat.category,
    eigenvalue: cat.pointEstimate,
    lower: cat.ci95Lower,
    upper: cat.ci95Upper,
    ciWidth: cat.ciWidth,
    errorY: [cat.pointEstimate - cat.ci95Lower, cat.ci95Upper - cat.pointEstimate],
  })).sort((a: any, b: any) => b.eigenvalue - a.eigenvalue);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" className="gap-2 border-slate-300 text-slate-600 hover:bg-slate-100" data-testid="button-download-multi-cat-bootstrap" onClick={() => downloadAsCSV(chartData.map((d: any) => ({ category: d.category, eigenvalue: d.eigenvalue, lower: d.lower, upper: d.upper, ciWidth: d.ciWidth })), "PAR2_Robustness_MultiCatBootstrap.csv")}>
          <Download className="h-4 w-4" /> Download Results (CSV)
        </Button>
      </div>
      <Card className="bg-slate-50 border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg text-slate-900 flex items-center gap-2">
            <Dna className="w-5 h-5 text-teal-400" />
            Multi-Category Bootstrap CIs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-500 text-sm mb-4">
            Bootstrap resampling applied to multi-category eigenvalue estimates, producing 95% confidence intervals
            for each category's mean eigenvalue and assessing rank stability.
          </p>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-slate-100 rounded-lg p-4 text-center border border-slate-200">
              <div className="text-xs text-slate-500 mb-1">Rank Stability</div>
              <div className="text-2xl font-bold text-teal-400" data-testid="text-multi-cat-bootstrap-rank-stability">
                {(data.rankOrderStability * 100)?.toFixed(1)}%
              </div>
            </div>
            <div className="bg-slate-100 rounded-lg p-4 text-center border border-slate-200">
              <div className="text-xs text-slate-500 mb-1">Top Category Stable</div>
              <div className="text-2xl font-bold text-slate-900" data-testid="text-multi-cat-bootstrap-top-stable">
                <Badge className={data.topCategoryStable
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : 'bg-red-500/20 text-red-400 border-red-500/30'}>
                  {data.topCategoryStable ? 'Yes' : 'No'}
                </Badge>
              </div>
            </div>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis type="number" stroke="#64748b" fontSize={11} domain={[0, 'auto']} label={{ value: 'Mean Eigenvalue |λ|', position: 'bottom', fill: '#64748b', fontSize: 11 }} />
                <YAxis dataKey="category" type="category" stroke="#64748b" fontSize={10} width={80} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                  formatter={(val: any, name: string, props: any) => {
                    if (name === 'eigenvalue') {
                      const item = props.payload;
                      return [`${val.toFixed(4)} [${item.lower?.toFixed(4)}, ${item.upper?.toFixed(4)}]`, '|λ| [95% CI]'];
                    }
                    return [val, name];
                  }}
                />
                <Bar dataKey="eigenvalue" name="eigenvalue" fill="#14b8a6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-50 border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg text-slate-900">Category CI Detail</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-multi-cat-bootstrap-categories">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-3 text-slate-500">Category</th>
                  <th className="text-right py-2 px-3 text-slate-500">Point Estimate</th>
                  <th className="text-right py-2 px-3 text-slate-500">95% CI</th>
                  <th className="text-right py-2 px-3 text-slate-500">CI Width</th>
                </tr>
              </thead>
              <tbody>
                {categories.sort((a: any, b: any) => b.pointEstimate - a.pointEstimate).map((cat: any) => (
                  <tr key={cat.category} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="py-2 px-3 text-slate-900 text-xs">
                      <Badge className="bg-teal-500/20 text-teal-400 border-teal-500/30">
                        {cat.category}
                      </Badge>
                    </td>
                    <td className="py-2 px-3 text-right text-slate-900 font-mono text-xs">{cat.pointEstimate?.toFixed(4)}</td>
                    <td className="py-2 px-3 text-right text-slate-600 font-mono text-xs">
                      [{cat.ci95Lower?.toFixed(4)}, {cat.ci95Upper?.toFixed(4)}]
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-xs" style={{ color: cat.ciWidth < 0.15 ? '#34d399' : '#fbbf24' }}>
                      {cat.ciWidth?.toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-teal-900/20 border-teal-700/30">
        <CardContent className="py-4">
          <p className="text-sm text-teal-300" data-testid="text-multi-cat-bootstrap-conclusion">
            <strong>Conclusion:</strong> {data.conclusion}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function MultiCatDetrendTab() {
  const { data, isLoading, error } = useQuery<any>({
    queryKey: ['/api/validation/robustness-suite/multi-category-detrend'],
    staleTime: 10 * 60 * 1000,
  });

  if (isLoading) return <LoadingState label="Running multi-category detrending analysis..." />;
  if (error || !data) return <ErrorState message="Failed to load multi-category detrend analysis" />;

  const datasets = data.datasets || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" className="gap-2 border-slate-300 text-slate-600 hover:bg-slate-100" data-testid="button-download-multi-cat-detrend" onClick={() => downloadAsCSV(datasets.flatMap((ds: any) => ds.categories?.map((c: any) => ({ dataset: ds.dataset, category: c.category, rawMean: c.rawMean, detrendedMean: c.detrendedMean })) || []), "PAR2_Robustness_MultiCatDetrend.csv")}>
          <Download className="h-4 w-4" /> Download Results (CSV)
        </Button>
      </div>
      <Card className="bg-slate-50 border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg text-slate-900 flex items-center gap-2">
            <Minus className="w-5 h-5 text-pink-400" />
            Multi-Category Detrending Defence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-500 text-sm mb-4">
            Linear detrending is applied per gene across multiple categories. The rank correlation between
            raw and detrended category hierarchies is computed to verify that the ordering is not driven by linear trends.
          </p>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-slate-100 rounded-lg p-4 text-center border border-slate-200">
              <div className="text-xs text-slate-500 mb-1">Overall Rank Correlation (ρ)</div>
              <div className="text-2xl font-bold text-pink-400" data-testid="text-multi-cat-detrend-rho">
                {data.overallRankCorrelation?.toFixed(4)}
              </div>
            </div>
            <div className="bg-slate-100 rounded-lg p-4 text-center border border-slate-200">
              <div className="text-xs text-slate-500 mb-1">Top Category Preserved</div>
              <div className="text-2xl font-bold text-slate-900" data-testid="text-multi-cat-detrend-top-preserved">
                {data.datasets?.filter((d: any) => d.topCategoryPreserved).length}/{data.datasets?.length}
              </div>
              <div className="text-xs text-slate-500">datasets</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-50 border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg text-slate-900">Per-Dataset Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-multi-cat-detrend-datasets">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-3 text-slate-500">Dataset</th>
                  <th className="text-right py-2 px-3 text-slate-500">Rank Correlation (ρ)</th>
                  <th className="text-center py-2 px-3 text-slate-500">Top Category Preserved</th>
                </tr>
              </thead>
              <tbody>
                {datasets.map((ds: any) => (
                  <tr key={ds.dataset} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="py-2 px-3 text-slate-900 text-xs">{ds.dataset}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs" style={{ color: ds.rankCorrelation >= 0.8 ? '#34d399' : ds.rankCorrelation >= 0.5 ? '#fbbf24' : '#f87171' }}>
                      {ds.rankCorrelation?.toFixed(4)}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <Badge className={ds.topCategoryPreserved
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : 'bg-red-500/20 text-red-400 border-red-500/30'}>
                        {ds.topCategoryPreserved ? 'Preserved' : 'Changed'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-pink-900/20 border-pink-700/30">
        <CardContent className="py-4">
          <p className="text-sm text-pink-300" data-testid="text-multi-cat-detrend-conclusion">
            <strong>Conclusion:</strong> {data.conclusion}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function MultiCatLOTOTab() {
  const { data, isLoading, error } = useQuery<any>({
    queryKey: ['/api/validation/robustness-suite/multi-category-loto'],
    staleTime: 10 * 60 * 1000,
  });

  if (isLoading) return <LoadingState label="Running multi-category leave-one-tissue-out analysis..." />;
  if (error || !data) return <ErrorState message="Failed to load multi-category LOTO analysis" />;

  const tissues = data.tissues || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" className="gap-2 border-slate-300 text-slate-600 hover:bg-slate-100" data-testid="button-download-multi-cat-loto" onClick={() => downloadAsCSV(tissues.map((t: any) => ({ tissue: t.heldOutTissue, rankCorrelation: t.rankCorrelation, topCategoryMatch: t.topCategoryMatch })), "PAR2_Robustness_MultiCatLOTO.csv")}>
          <Download className="h-4 w-4" /> Download Results (CSV)
        </Button>
      </div>
      <Card className="bg-slate-50 border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg text-slate-900 flex items-center gap-2">
            <Crosshair className="w-5 h-5 text-amber-400" />
            Multi-Category Leave-One-Tissue-Out
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-500 text-sm mb-4">
            Each tissue is held out in turn. The multi-category hierarchy is computed from the training tissues
            and compared against the held-out tissue to assess cross-tissue generalization of category rankings.
          </p>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-slate-100 rounded-lg p-4 text-center border border-slate-200">
              <div className="text-xs text-slate-500 mb-1">Mean Rank Correlation</div>
              <div className="text-2xl font-bold text-amber-400" data-testid="text-multi-cat-loto-mean-rho">
                {data.meanRankCorrelation?.toFixed(4)}
              </div>
            </div>
            <div className="bg-slate-100 rounded-lg p-4 text-center border border-slate-200">
              <div className="text-xs text-slate-500 mb-1">Top Category Match Rate</div>
              <div className="text-2xl font-bold text-slate-900" data-testid="text-multi-cat-loto-match-rate">
                {data.tissues?.filter((t: any) => t.topCategoryMatch).length}/{data.tissues?.length}
              </div>
              <div className="text-xs text-slate-500">tissues</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-50 border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg text-slate-900">Per-Tissue Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-multi-cat-loto-tissues">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-3 text-slate-500">Held-Out Tissue</th>
                  <th className="text-left py-2 px-3 text-slate-500">Train Top Category</th>
                  <th className="text-left py-2 px-3 text-slate-500">Held-Out Top Category</th>
                  <th className="text-right py-2 px-3 text-slate-500">Rank Correlation</th>
                  <th className="text-center py-2 px-3 text-slate-500">Top Match</th>
                </tr>
              </thead>
              <tbody>
                {tissues.map((t: any) => (
                  <tr key={t.heldOutTissue} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="py-2 px-3 text-slate-900 text-xs">{t.heldOutTissue}</td>
                    <td className="py-2 px-3 text-xs">
                      <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                        {t.trainRankOrder?.[0]}
                      </Badge>
                    </td>
                    <td className="py-2 px-3 text-xs">
                      <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                        {t.heldOutRankOrder?.[0]}
                      </Badge>
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-xs" style={{ color: t.rankCorrelation >= 0.8 ? '#34d399' : t.rankCorrelation >= 0.5 ? '#fbbf24' : '#f87171' }}>
                      {t.rankCorrelation?.toFixed(4)}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <Badge className={t.topCategoryMatch
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : 'bg-red-500/20 text-red-400 border-red-500/30'}>
                        {t.topCategoryMatch ? 'Match' : 'Mismatch'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-amber-900/20 border-amber-700/30">
        <CardContent className="py-4">
          <p className="text-sm text-amber-300" data-testid="text-multi-cat-loto-conclusion">
            <strong>Conclusion:</strong> {data.conclusion}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

interface RWGapWindow {
  windowIdx: number;
  clockMean: number;
  targetMean: number;
  gap: number;
}

interface RWGeneWindowAnalysis {
  gene: string;
  geneType: 'clock' | 'target';
  meanEigenvalue: number;
  maxDrift: number;
  coefficientOfVariation: number;
  isStable: boolean;
}

interface RWDatasetResult {
  datasetId: string;
  datasetName: string;
  species: string;
  totalTimepoints: number;
  windowSize: number;
  stepSize: number;
  nWindows: number;
  clockGenes: RWGeneWindowAnalysis[];
  targetGenes: RWGeneWindowAnalysis[];
  clockMeanDrift: number;
  targetMeanDrift: number;
  clockMeanCV: number;
  targetMeanCV: number;
  clockStableCount: number;
  targetStableCount: number;
  gapStability: {
    windowGaps: RWGapWindow[];
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
  datasets: RWDatasetResult[];
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

const rwVerdictColor = (v: string) =>
  v === 'STABLE' ? 'text-emerald-400' : v === 'MARGINAL' ? 'text-amber-400' : 'text-red-400';
const rwVerdictBg = (v: string) =>
  v === 'STABLE' ? 'bg-emerald-900/30 border-emerald-700/50' : v === 'MARGINAL' ? 'bg-amber-900/30 border-amber-700/50' : 'bg-red-900/30 border-red-700/50';

function StationarityTab() {
  const [windowFraction, setWindowFraction] = useState(0.5);
  const [stepFraction, setStepFraction] = useState(0.25);
  const [appliedWindow, setAppliedWindow] = useState(0.5);
  const [appliedStep, setAppliedStep] = useState(0.25);

  const { data: stationarity, isLoading: loadingStat, error: errorStat } = useQuery({
    queryKey: ["/api/validation/stationarity-predictive"],
    queryFn: async () => {
      const res = await fetch("/api/validation/stationarity-predictive");
      if (!res.ok) throw new Error("Failed to load stationarity validation");
      return res.json();
    },
    staleTime: 3600000,
  });

  const { data: perturbation, isLoading: loadingPert, error: errorPert } = useQuery({
    queryKey: ["/api/validation/perturbation-prediction"],
    queryFn: async () => {
      const res = await fetch("/api/validation/perturbation-prediction");
      if (!res.ok) throw new Error("Failed to load perturbation validation");
      return res.json();
    },
    staleTime: 3600000,
  });

  const { data: rollingWindow, isLoading: loadingRW, error: errorRW, refetch: refetchRW } = useQuery<RollingWindowData>({
    queryKey: ["/api/validation/rolling-window", appliedWindow, appliedStep],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (appliedWindow !== 0.5) params.set('windowFraction', appliedWindow.toString());
      if (appliedStep !== 0.25) params.set('stepFraction', appliedStep.toString());
      const qs = params.toString();
      const res = await fetch(`/api/validation/rolling-window${qs ? `?${qs}` : ''}`);
      if (!res.ok) throw new Error("Failed to load rolling window analysis");
      return res.json();
    },
    staleTime: 1800000,
  });

  const handleApplyParams = useCallback(() => {
    setAppliedWindow(windowFraction);
    setAppliedStep(stepFraction);
  }, [windowFraction, stepFraction]);

  const isDefaultParams = windowFraction === 0.5 && stepFraction === 0.25;

  const [expandedDataset, setExpandedDataset] = useState<string | null>(null);
  const [expandedPerturbation, setExpandedPerturbation] = useState<string | null>(null);
  const [expandedRWDataset, setExpandedRWDataset] = useState<string | null>(null);

  const isLoading = loadingStat || loadingPert || loadingRW;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mx-auto" />
          <p className="text-slate-500 text-lg" data-testid="status-loading">Running stationarity and predictive validation...</p>
          <p className="text-slate-500 text-sm">This may take 30-60 seconds (computing KPSS, ADF, and rolling-origin forecasts)</p>
        </div>
      </div>
    );
  }

  if (errorStat || errorPert || errorRW) {
    return (
      <div className="py-10">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <p className="text-red-400 text-center" data-testid="status-error">Error loading validation data</p>
      </div>
    );
  }

  const verdictColor = (v: string) => {
    if (v === 'ROBUST' || v === 'PREDICTIONS CONFIRMED') return 'text-emerald-400';
    if (v === 'MODERATE' || v === 'PARTIALLY CONFIRMED') return 'text-amber-400';
    return 'text-red-400';
  };

  const verdictBg = (v: string) => {
    if (v === 'ROBUST' || v === 'PREDICTIONS CONFIRMED') return 'bg-emerald-500/20 border-emerald-500/40';
    if (v === 'MODERATE' || v === 'PARTIALLY CONFIRMED') return 'bg-amber-500/20 border-amber-500/40';
    return 'bg-red-500/20 border-red-500/40';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" className="gap-2 border-slate-300 text-slate-600 hover:bg-slate-100" data-testid="button-download-stationarity" onClick={() => {
          const csvData: Record<string, any>[] = [];
          stationarity?.datasets?.forEach((ds: any) => ds.genes?.forEach((g: any) => csvData.push({ dataset: ds.dataset, gene: g.gene, geneType: g.geneType, adfStat: g.adfStat, adfPValue: g.adfPValue, isStationary: g.isStationary })));
          downloadAsCSV(csvData.length > 0 ? csvData : [{ note: 'Loading data...' }], "PAR2_Robustness_Stationarity.csv");
        }}>
          <Download className="h-4 w-4" /> Download Results (CSV)
        </Button>
      </div>
      {stationarity?.overallSummary && (
        <div className={`border rounded-xl p-6 ${verdictBg(stationarity.overallSummary.overallVerdict)}`} data-testid="card-stationarity-verdict">
          <div className="flex items-center gap-3 mb-3">
            {stationarity.overallSummary.overallVerdict === 'ROBUST' ? (
              <ShieldCheck className="w-8 h-8 text-emerald-400" />
            ) : (
              <ShieldAlert className="w-8 h-8 text-amber-400" />
            )}
            <div>
              <h2 className={`text-2xl font-bold ${verdictColor(stationarity.overallSummary.overallVerdict)}`} data-testid="text-stationarity-verdict">
                Stationarity: {stationarity.overallSummary.overallVerdict}
              </h2>
              <p className="text-slate-600 text-sm">{stationarity.overallSummary.totalDatasets} datasets, {stationarity.overallSummary.totalGenes} gene-series analyzed</p>
            </div>
          </div>
          <p className="text-slate-600" data-testid="text-stationarity-interpretation">{stationarity.overallSummary.interpretation}</p>
        </div>
      )}

      {stationarity?.overallSummary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="bg-slate-50 border-slate-200">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-cyan-400" data-testid="text-adf-rate">{(stationarity.overallSummary.meanADFPassRate * 100).toFixed(0)}%</p>
              <p className="text-xs text-slate-500">ADF Pass Rate</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-50 border-slate-200">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-purple-400" data-testid="text-kpss-rate">{(stationarity.overallSummary.meanKPSSPassRate * 100).toFixed(0)}%</p>
              <p className="text-xs text-slate-500">KPSS Pass Rate</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-50 border-slate-200">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-emerald-400" data-testid="text-dual-rate">{(stationarity.overallSummary.meanDualStationaryRate * 100).toFixed(0)}%</p>
              <p className="text-xs text-slate-500">Dual Stationary</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-50 border-slate-200">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-amber-400" data-testid="text-hierarchy-count">{stationarity.overallSummary.hierarchyPreservedCount}/{stationarity.overallSummary.totalDatasets}</p>
              <p className="text-xs text-slate-500">Hierarchy Preserved</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-50 border-slate-200">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-rose-400" data-testid="text-ar2-winrate">{(stationarity.overallSummary.meanAR2WinRate * 100).toFixed(0)}%</p>
              <p className="text-xs text-slate-500">AR(2) Win Rate</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="bg-slate-50 border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-900">
            <Activity className="w-5 h-5 text-cyan-400" />
            Two-Track Analysis: All Genes vs Stationary-Only
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stationarity?.datasets && (
            <div className="space-y-3">
              {stationarity.datasets.map((ds: any) => (
                <div key={ds.datasetId} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                    onClick={() => setExpandedDataset(expandedDataset === ds.datasetId ? null : ds.datasetId)}
                    data-testid={`button-expand-${ds.datasetId}`}
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={ds.twoTrack.hierarchyPreserved ? 'border-emerald-500 text-emerald-400' : 'border-amber-500 text-amber-400'}>
                        {ds.twoTrack.hierarchyPreserved ? 'PRESERVED' : 'CHECK'}
                      </Badge>
                      <span className="text-slate-900 font-medium">{ds.datasetName}</span>
                      <span className="text-slate-500 text-sm">{ds.species}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-slate-500 text-sm">ADF: {(ds.adfPassRate * 100).toFixed(0)}% | KPSS: {(ds.kpssPassRate * 100).toFixed(0)}% | Dual: {(ds.dualStationaryRate * 100).toFixed(0)}%</span>
                      {expandedDataset === ds.datasetId ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                    </div>
                  </button>
                  {expandedDataset === ds.datasetId && (
                    <div className="px-4 pb-4 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-slate-50 rounded-lg p-4 border border-slate-300">
                          <h4 className="text-sm font-medium text-slate-600 mb-2">All Genes</h4>
                          <div className="space-y-1 text-sm">
                            <div><span className="text-slate-500">Clock |l|:</span> <span className="text-cyan-400">{ds.twoTrack.allGenes.meanClockEigenvalue.toFixed(4)}</span> <span className="text-slate-500">(n={ds.twoTrack.allGenes.nClock})</span></div>
                            <div><span className="text-slate-500">Target |l|:</span> <span className="text-rose-400">{ds.twoTrack.allGenes.meanTargetEigenvalue.toFixed(4)}</span> <span className="text-slate-500">(n={ds.twoTrack.allGenes.nTarget})</span></div>
                            <div><span className="text-slate-500">Gap:</span> <span className="text-slate-900 font-medium">{ds.twoTrack.allGenes.gap.toFixed(4)}</span></div>
                            <div><span className="text-slate-500">Effect size:</span> <span className="text-slate-900">{ds.twoTrack.allGenes.effectSize.toFixed(3)}</span></div>
                            <div><span className="text-slate-500">Wilcoxon p:</span> <span className={ds.twoTrack.allGenes.wilcoxonP < 0.05 ? 'text-emerald-400' : 'text-amber-400'}>{ds.twoTrack.allGenes.wilcoxonP < 0.001 ? '<0.001' : ds.twoTrack.allGenes.wilcoxonP.toFixed(4)}</span></div>
                          </div>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-4 border border-purple-600/30">
                          <h4 className="text-sm font-medium text-purple-300 mb-2">KPSS-Stationary Only</h4>
                          <div className="space-y-1 text-sm">
                            <div><span className="text-slate-500">Clock |l|:</span> <span className="text-cyan-400">{ds.twoTrack.kpssOnly?.meanClockEigenvalue?.toFixed(4) || 'N/A'}</span> <span className="text-slate-500">(n={ds.twoTrack.kpssOnly?.nClock || 0})</span></div>
                            <div><span className="text-slate-500">Target |l|:</span> <span className="text-rose-400">{ds.twoTrack.kpssOnly?.meanTargetEigenvalue?.toFixed(4) || 'N/A'}</span> <span className="text-slate-500">(n={ds.twoTrack.kpssOnly?.nTarget || 0})</span></div>
                            <div><span className="text-slate-500">Gap:</span> <span className="text-slate-900 font-medium">{ds.twoTrack.kpssOnly?.gap?.toFixed(4) || 'N/A'}</span></div>
                            <div><span className="text-slate-500">Effect size:</span> <span className="text-slate-900">{ds.twoTrack.kpssOnly?.effectSize?.toFixed(3) || 'N/A'}</span></div>
                            <div><span className="text-slate-500">Preserved:</span> <span className={ds.twoTrack.kpssHierarchyPreserved ? 'text-emerald-400' : 'text-amber-400'}>{ds.twoTrack.kpssHierarchyPreserved ? 'Yes' : 'No'}</span></div>
                          </div>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-4 border border-emerald-600/30">
                          <h4 className="text-sm font-medium text-emerald-300 mb-2">Dual ADF+KPSS</h4>
                          <div className="space-y-1 text-sm">
                            <div><span className="text-slate-500">Clock |l|:</span> <span className="text-cyan-400">{ds.twoTrack.stationaryOnly.meanClockEigenvalue.toFixed(4)}</span> <span className="text-slate-500">(n={ds.twoTrack.stationaryOnly.nClock})</span></div>
                            <div><span className="text-slate-500">Target |l|:</span> <span className="text-rose-400">{ds.twoTrack.stationaryOnly.meanTargetEigenvalue.toFixed(4)}</span> <span className="text-slate-500">(n={ds.twoTrack.stationaryOnly.nTarget})</span></div>
                            <div><span className="text-slate-500">Gap:</span> <span className="text-slate-900 font-medium">{ds.twoTrack.stationaryOnly.gap.toFixed(4)}</span></div>
                            <div><span className="text-slate-500">Effect size:</span> <span className="text-slate-900">{ds.twoTrack.stationaryOnly.effectSize.toFixed(3)}</span></div>
                            <div><span className="text-slate-500">Preserved:</span> <span className={ds.twoTrack.hierarchyPreserved ? 'text-emerald-400' : 'text-amber-400'}>{ds.twoTrack.hierarchyPreserved ? 'Yes' : 'No'}</span></div>
                          </div>
                        </div>
                      </div>
                      <p className="text-slate-500 text-sm" data-testid={`text-twotrack-${ds.datasetId}`}>{ds.twoTrack.interpretation}</p>
                      <div className="bg-slate-50 rounded-lg p-4 border border-slate-300">
                        <h4 className="text-sm font-medium text-slate-600 mb-2 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-rose-400" /> Forecasting Benchmark</h4>
                        <p className="text-slate-500 text-sm">{ds.forecasting.interpretation}</p>
                        <div className="grid grid-cols-3 gap-4 mt-2 text-sm">
                          <div><span className="text-slate-500">AR(2) MAE:</span> <span className="text-cyan-400">{ds.forecasting.meanAR2MAE.toFixed(4)}</span></div>
                          <div><span className="text-slate-500">AR(1) MAE:</span> <span className="text-slate-600">{ds.forecasting.meanAR1MAE.toFixed(4)}</span></div>
                          <div><span className="text-slate-500">Naive MAE:</span> <span className="text-slate-600">{ds.forecasting.meanNaiveMAE.toFixed(4)}</span></div>
                        </div>
                      </div>
                      {ds.geneResults && ds.geneResults.length > 0 && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-slate-500 border-b border-slate-200">
                                <th className="text-left py-2 px-2">Gene</th>
                                <th className="text-left py-2 px-2">Type</th>
                                <th className="text-right py-2 px-2">|l|</th>
                                <th className="text-right py-2 px-2">R2</th>
                                <th className="text-center py-2 px-2">ADF</th>
                                <th className="text-center py-2 px-2">KPSS</th>
                                <th className="text-center py-2 px-2">Verdict</th>
                                <th className="text-right py-2 px-2">MASE</th>
                              </tr>
                            </thead>
                            <tbody>
                              {ds.geneResults.map((g: any) => (
                                <tr key={g.gene} className="border-b border-slate-200 hover:bg-slate-50">
                                  <td className="py-1.5 px-2 text-slate-900 font-mono"><GeneTooltip gene={g.gene}>{g.gene}</GeneTooltip></td>
                                  <td className="py-1.5 px-2">
                                    <Badge variant="outline" className={g.type === 'clock' ? 'border-cyan-500 text-cyan-400 text-xs' : 'border-rose-500 text-rose-400 text-xs'}>
                                      {g.type}
                                    </Badge>
                                  </td>
                                  <td className="py-1.5 px-2 text-right font-mono">{g.eigenvalue.toFixed(4)}</td>
                                  <td className="py-1.5 px-2 text-right font-mono text-slate-500">{g.r2.toFixed(3)}</td>
                                  <td className="py-1.5 px-2 text-center">
                                    {g.adfStationary ? <span className="text-emerald-400">Pass</span> : <span className="text-amber-400">Fail</span>}
                                  </td>
                                  <td className="py-1.5 px-2 text-center">
                                    {g.kpssStationary ? <span className="text-emerald-400">Pass</span> : <span className="text-amber-400">Fail</span>}
                                  </td>
                                  <td className="py-1.5 px-2 text-center">
                                    <Badge variant="outline" className={
                                      g.dualVerdict === 'stationary' ? 'border-emerald-500 text-emerald-400 text-xs' :
                                      g.dualVerdict === 'non_stationary' ? 'border-red-500 text-red-400 text-xs' :
                                      'border-amber-500 text-amber-400 text-xs'
                                    }>{g.dualVerdict}</Badge>
                                  </td>
                                  <td className="py-1.5 px-2 text-right font-mono text-slate-500">{isFinite(g.mase) ? g.mase.toFixed(3) : 'N/A'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {stationarity?.datasets && stationarity.datasets.length > 0 && (
        <Card className="bg-slate-50 border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-900">
              <TrendingUp className="w-5 h-5 text-rose-400" />
              Forecasting Comparison: AR(2) vs AR(1) vs Naive
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stationarity.datasets.map((ds: any) => ({
                  name: ds.datasetId.replace(/_/g, ' '),
                  'AR(2)': ds.forecasting.meanAR2MAE,
                  'AR(1)': ds.forecasting.meanAR1MAE,
                  'Naive': ds.forecasting.meanNaiveMAE,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} angle={-20} textAnchor="end" height={60} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 12 }} label={{ value: 'MAE', angle: -90, position: 'insideLeft', fill: '#64748b' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }} />
                  <Legend />
                  <Bar dataKey="AR(2)" fill="#22d3ee" />
                  <Bar dataKey="AR(1)" fill="#a78bfa" />
                  <Bar dataKey="Naive" fill="#94a3b8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-slate-50 border-slate-200" data-testid="card-rolling-window-params">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-slate-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-cyan-400" />
            Rolling Window Parameters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Window Size</span>
                <span className="text-cyan-400 font-mono" data-testid="text-window-fraction">{Math.round(windowFraction * 100)}% of series</span>
              </div>
              <Slider
                value={[windowFraction]}
                onValueChange={([v]) => setWindowFraction(v)}
                min={0.2}
                max={0.8}
                step={0.05}
                className="w-full"
                data-testid="slider-window-fraction"
              />
              <p className="text-xs text-slate-500">Fraction of time series used per window (20%-80%)</p>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Step Size</span>
                <span className="text-cyan-400 font-mono" data-testid="text-step-fraction">{Math.round(stepFraction * 100)}% overlap</span>
              </div>
              <Slider
                value={[stepFraction]}
                onValueChange={([v]) => setStepFraction(v)}
                min={0.1}
                max={0.5}
                step={0.05}
                className="w-full"
                data-testid="slider-step-fraction"
              />
              <p className="text-xs text-slate-500">Step between windows as fraction of remaining series (10%-50%)</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleApplyParams}
              disabled={appliedWindow === windowFraction && appliedStep === stepFraction}
              size="sm"
              className="bg-cyan-600 hover:bg-cyan-700 text-slate-900"
              data-testid="button-apply-rw-params"
            >
              {loadingRW ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Recalculating...</> : 'Apply & Recalculate'}
            </Button>
            {!isDefaultParams && (
              <Button
                variant="outline"
                size="sm"
                className="border-slate-300 text-slate-600 hover:bg-slate-100"
                onClick={() => { setWindowFraction(0.5); setStepFraction(0.25); setAppliedWindow(0.5); setAppliedStep(0.25); }}
                data-testid="button-reset-rw-params"
              >
                Reset to Defaults
              </Button>
            )}
            {appliedWindow !== 0.5 || appliedStep !== 0.25 ? (
              <Badge variant="outline" className="border-amber-600 text-amber-400">Custom Parameters</Badge>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {rollingWindow?.summary && (
        <>
          <div className={`border rounded-xl p-6 ${rwVerdictBg(rollingWindow.summary.stableCount === rollingWindow.summary.totalDatasets ? 'STABLE' : rollingWindow.summary.unstableCount > 0 ? 'UNSTABLE' : 'MARGINAL')}`} data-testid="card-rolling-window-verdict">
            <div className="flex items-center gap-3 mb-3">
              <Clock className="w-8 h-8 text-cyan-400" />
              <div>
                <h2 className="text-2xl font-bold text-slate-900" data-testid="text-rolling-window-verdict">
                  Rolling Window Stability
                </h2>
                <p className="text-slate-600 text-sm">{rollingWindow.summary.totalDatasets} datasets analyzed across multiple time windows</p>
              </div>
            </div>
            <p className="text-slate-600" data-testid="text-rolling-window-overall">{rollingWindow.summary.overallVerdict}</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card className="bg-slate-50 border-slate-200">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-slate-900" data-testid="text-rw-total">{rollingWindow.summary.totalDatasets}</p>
                <p className="text-xs text-slate-500">Datasets Tested</p>
              </CardContent>
            </Card>
            <Card className="bg-slate-50 border-slate-200">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-emerald-400" data-testid="text-rw-stable">{rollingWindow.summary.stableCount}</p>
                <p className="text-xs text-slate-500">Stable</p>
              </CardContent>
            </Card>
            <Card className="bg-slate-50 border-slate-200">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-amber-400" data-testid="text-rw-marginal">{rollingWindow.summary.marginalCount}</p>
                <p className="text-xs text-slate-500">Marginal</p>
              </CardContent>
            </Card>
            <Card className="bg-slate-50 border-slate-200">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-red-400" data-testid="text-rw-unstable">{rollingWindow.summary.unstableCount}</p>
                <p className="text-xs text-slate-500">Unstable</p>
              </CardContent>
            </Card>
            <Card className="bg-slate-50 border-slate-200">
              <CardContent className="p-4 text-center">
                {rollingWindow.summary.gapPreservedInAllWindows
                  ? <ShieldCheck className="w-6 h-6 text-emerald-400 mx-auto" />
                  : <ShieldAlert className="w-6 h-6 text-amber-400 mx-auto" />}
                <p className="text-xs text-slate-500 mt-1">Gap Preserved</p>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-slate-50 border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-900">
                <Clock className="w-5 h-5 text-cyan-400" />
                Per-Dataset Rolling Window Results
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {rollingWindow.datasets.map((ds) => {
                const isExpanded = expandedRWDataset === ds.datasetId;
                const allGenes = [...ds.clockGenes, ...ds.targetGenes];
                const gapChartData = ds.gapStability.windowGaps.map(g => ({
                  window: `W${g.windowIdx + 1}`,
                  clockMean: g.clockMean,
                  targetMean: g.targetMean,
                  gap: g.gap,
                }));
                return (
                  <div key={ds.datasetId} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                    <button
                      className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                      onClick={() => setExpandedRWDataset(isExpanded ? null : ds.datasetId)}
                      data-testid={`button-expand-rw-${ds.datasetId}`}
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className={`${rwVerdictColor(ds.verdict)} border-current`}>
                          {ds.verdict}
                        </Badge>
                        <span className="text-slate-900 font-medium">{ds.datasetName}</span>
                        <span className="text-slate-500 text-sm">{ds.species}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-slate-500 text-sm">
                          {ds.nWindows} windows | Clock CV: {(ds.clockMeanCV * 100).toFixed(1)}% | Target CV: {(ds.targetMeanCV * 100).toFixed(1)}%
                        </span>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-4">
                        <p className="text-slate-500 text-sm">{ds.verdictExplanation}</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="bg-slate-50 rounded p-3 text-center">
                            <p className="text-lg font-bold text-cyan-400">{ds.clockStableCount}/{ds.clockGenes.length}</p>
                            <p className="text-xs text-slate-500">Clock Stable</p>
                          </div>
                          <div className="bg-slate-50 rounded p-3 text-center">
                            <p className="text-lg font-bold text-purple-400">{ds.targetStableCount}/{ds.targetGenes.length}</p>
                            <p className="text-xs text-slate-500">Target Stable</p>
                          </div>
                          <div className="bg-slate-50 rounded p-3 text-center">
                            <p className={`text-lg font-bold font-mono ${ds.clockMeanCV < 0.15 ? 'text-emerald-400' : 'text-amber-400'}`}>
                              {(ds.clockMeanCV * 100).toFixed(1)}%
                            </p>
                            <p className="text-xs text-slate-500">Clock Mean CV</p>
                          </div>
                          <div className="bg-slate-50 rounded p-3 text-center">
                            <p className={`text-lg font-bold font-mono ${ds.targetMeanCV < 0.15 ? 'text-emerald-400' : 'text-amber-400'}`}>
                              {(ds.targetMeanCV * 100).toFixed(1)}%
                            </p>
                            <p className="text-xs text-slate-500">Target Mean CV</p>
                          </div>
                        </div>

                        {gapChartData.length > 1 && (
                          <div>
                            <p className="text-sm text-slate-500 mb-2 flex items-center gap-1">
                              <Activity size={14} />
                              Gearbox Gap Stability Across Windows
                              {ds.gapStability.hierarchyPreservedInAllWindows
                                ? <Badge className="bg-emerald-900/30 text-emerald-300 text-xs ml-2">Hierarchy preserved</Badge>
                                : <Badge className="bg-red-900/30 text-red-300 text-xs ml-2">Hierarchy broken</Badge>}
                            </p>
                            <div className="h-48">
                              <ResponsiveContainer width="100%" height="100%">
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
                            </div>
                            <div className="flex justify-center gap-6 text-xs text-slate-500 mt-1">
                              <span>Gap Mean: <span className="text-slate-900 font-mono">{ds.gapStability.gapMean.toFixed(4)}</span></span>
                              <span>Gap Std: <span className="text-slate-900 font-mono">{ds.gapStability.gapStd.toFixed(4)}</span></span>
                              <span>Gap CV: <span className={`font-mono ${ds.gapStability.gapCV < 0.3 ? 'text-emerald-400' : 'text-amber-400'}`}>{(ds.gapStability.gapCV * 100).toFixed(1)}%</span></span>
                            </div>
                          </div>
                        )}

                        {ds.chowTest && (
                          <div className="bg-slate-50 rounded-lg p-3">
                            <p className="text-xs text-slate-500 mb-1">Chow Structural Break Test</p>
                            <div className="flex gap-4 text-sm">
                              <span className="text-slate-500">F: <span className="text-slate-900 font-mono">{ds.chowTest.fStatistic}</span></span>
                              <span className="text-slate-500">p: <span className="text-slate-900 font-mono">{ds.chowTest.pApprox}</span></span>
                              <Badge className={ds.chowTest.significantBreak ? 'bg-red-900/30 text-red-300' : 'bg-emerald-900/30 text-emerald-300'}>
                                {ds.chowTest.significantBreak ? 'Break Detected' : 'No Break'}
                              </Badge>
                            </div>
                          </div>
                        )}

                        <div className="space-y-1 max-h-[300px] overflow-y-auto">
                          <p className="text-sm text-slate-500 mb-1">Per-Gene Details ({allGenes.length} genes)</p>
                          {allGenes.map((g, i) => (
                            <div key={i} className="flex items-center justify-between text-xs bg-slate-50 px-3 py-1.5 rounded">
                              <div className="flex items-center gap-2">
                                {g.geneType === 'clock' ? <Clock size={10} className="text-cyan-400" /> : <Target size={10} className="text-violet-400" />}
                                <span className="text-slate-600 font-mono"><GeneTooltip gene={g.gene}>{g.gene}</GeneTooltip></span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-slate-500">|λ̄| = <span className="text-slate-900">{g.meanEigenvalue.toFixed(4)}</span></span>
                                <span className="text-slate-500">drift = <span className={g.maxDrift < 0.15 ? 'text-emerald-400' : 'text-amber-400'}>{g.maxDrift.toFixed(4)}</span></span>
                                <span className="text-slate-500">CV = <span className={g.coefficientOfVariation < 0.15 ? 'text-emerald-400' : 'text-amber-400'}>{(g.coefficientOfVariation * 100).toFixed(1)}%</span></span>
                                {g.isStable
                                  ? <ShieldCheck size={12} className="text-emerald-400" />
                                  : <ShieldAlert size={12} className="text-amber-400" />}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </>
      )}

      {loadingRW && (
        <Card className="bg-slate-50 border-slate-200">
          <CardContent className="p-8 text-center">
            <Loader2 className="w-6 h-6 text-cyan-400 animate-spin mx-auto mb-2" />
            <p className="text-slate-500 text-sm">Loading rolling window stability analysis...</p>
          </CardContent>
        </Card>
      )}

      {perturbation?.overallSummary && (
        <>
          <div className={`border rounded-xl p-6 ${verdictBg(perturbation.overallSummary.overallVerdict)}`} data-testid="card-perturbation-verdict">
            <div className="flex items-center gap-3 mb-3">
              <FlaskConical className="w-8 h-8 text-purple-400" />
              <div>
                <h2 className={`text-2xl font-bold ${verdictColor(perturbation.overallSummary.overallVerdict)}`} data-testid="text-perturbation-verdict">
                  Perturbation Validation: {perturbation.overallSummary.overallVerdict}
                </h2>
                <p className="text-slate-600 text-sm">{perturbation.overallSummary.totalComparisons} paired experiments, {perturbation.overallSummary.totalPairedGenes} paired gene comparisons</p>
              </div>
            </div>
            <p className="text-slate-600" data-testid="text-perturbation-interpretation">{perturbation.overallSummary.interpretation}</p>
          </div>

          <Card className="bg-slate-50 border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-900">
                <Zap className="w-5 h-5 text-purple-400" />
                Perturbation Experiments: Predicted vs Observed Eigenvalue Shifts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {perturbation.comparisons?.map((comp: any) => (
                <div key={comp.id} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                    onClick={() => setExpandedPerturbation(expandedPerturbation === comp.id ? null : comp.id)}
                    data-testid={`button-expand-pert-${comp.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={comp.summary.overallConcordance >= 0.6 ? 'border-emerald-500 text-emerald-400' : comp.summary.overallConcordance >= 0.4 ? 'border-amber-500 text-amber-400' : 'border-red-500 text-red-400'}>
                        {(comp.summary.overallConcordance * 100).toFixed(0)}%
                      </Badge>
                      <span className="text-slate-900 font-medium">{comp.name}</span>
                      <span className="text-slate-500 text-sm">{comp.perturbationType}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 text-sm">p={comp.summary.signTestP < 0.001 ? '<0.001' : comp.summary.signTestP.toFixed(3)}</span>
                      {expandedPerturbation === comp.id ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                    </div>
                  </button>
                  {expandedPerturbation === comp.id && (
                    <div className="px-4 pb-4 space-y-4">
                      <p className="text-slate-500 text-sm"><strong className="text-slate-600">Expected:</strong> {comp.expectedDirection}</p>
                      <p className="text-slate-600 text-sm" data-testid={`text-pert-interp-${comp.id}`}>{comp.summary.interpretation}</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-slate-50 rounded p-3 text-center">
                          <p className="text-lg font-bold text-cyan-400">{comp.summary.controlGap.toFixed(4)}</p>
                          <p className="text-xs text-slate-500">Control Gap</p>
                        </div>
                        <div className="bg-slate-50 rounded p-3 text-center">
                          <p className="text-lg font-bold text-purple-400">{comp.summary.perturbedGap.toFixed(4)}</p>
                          <p className="text-xs text-slate-500">Perturbed Gap</p>
                        </div>
                        <div className="bg-slate-50 rounded p-3 text-center">
                          <p className={`text-lg font-bold ${comp.summary.gapChange < 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{comp.summary.gapChange > 0 ? '+' : ''}{comp.summary.gapChange.toFixed(4)}</p>
                          <p className="text-xs text-slate-500">Gap Change ({comp.summary.gapChangeDirection})</p>
                        </div>
                        <div className="bg-slate-50 rounded p-3 text-center">
                          <p className="text-lg font-bold text-slate-900">{comp.summary.nPairedGenes}</p>
                          <p className="text-xs text-slate-500">Paired Genes</p>
                        </div>
                      </div>
                      {comp.pairedComparisons && comp.pairedComparisons.length > 0 && (
                        <div>
                          <div className="h-48">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={comp.pairedComparisons.map((p: any) => ({
                                gene: p.gene,
                                shift: p.shift,
                                correct: p.directionCorrect
                              }))}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis dataKey="gene" tick={{ fill: '#64748b', fontSize: 10 }} />
                                <YAxis tick={{ fill: '#64748b', fontSize: 12 }} label={{ value: 'Eigenvalue Shift', angle: -90, position: 'insideLeft', fill: '#64748b' }} />
                                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }} />
                                <ReferenceLine y={0} stroke="#475569" />
                                <Bar dataKey="shift">
                                  {comp.pairedComparisons.map((p: any, idx: number) => (
                                    <Cell key={idx} fill={p.directionCorrect ? '#22c55e' : '#ef4444'} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">Green = shift in predicted direction, Red = opposite direction</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}

      <Card className="bg-slate-50 border-slate-200">
        <CardHeader>
          <CardTitle className="text-slate-900 text-lg">Methodology</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-slate-500">
          {stationarity?.methodology && (
            <div className="space-y-3">
              <div>
                <h4 className="text-slate-600 font-medium mb-1">Augmented Dickey-Fuller (ADF) Test</h4>
                <p>{stationarity.methodology.adfDescription}</p>
              </div>
              <div>
                <h4 className="text-slate-600 font-medium mb-1">Kwiatkowski-Phillips-Schmidt-Shin (KPSS) Test</h4>
                <p>{stationarity.methodology.kpssDescription}</p>
              </div>
              <div>
                <h4 className="text-slate-600 font-medium mb-1">Dual Verdict Logic</h4>
                <p>{stationarity.methodology.dualVerdictLogic}</p>
              </div>
              <div>
                <h4 className="text-slate-600 font-medium mb-1">One-Step-Ahead Forecasting</h4>
                <p>{stationarity.methodology.forecastingMethod}</p>
              </div>
              <div>
                <h4 className="text-slate-600 font-medium mb-1">Two-Track Robustness Analysis</h4>
                <p>{stationarity.methodology.twoTrackLogic}</p>
              </div>
            </div>
          )}
          {rollingWindow && (
            <div className="space-y-3 border-t border-slate-200 pt-4 mt-4">
              <div>
                <h4 className="text-slate-600 font-medium mb-1">Rolling Window Stability</h4>
                <p>AR(2) models are re-fit across overlapping sub-windows (50% of total timepoints, ~5 windows per dataset). Eigenvalue stability is measured by coefficient of variation (CV &lt; 15%) and max drift (&lt; 0.15). Chow structural break tests detect regime changes at the midpoint.</p>
              </div>
              <div>
                <h4 className="text-slate-600 font-medium mb-1">Gap Stability</h4>
                <p>The clock–target eigenvalue hierarchy is verified in every window. If the gap (clock |λ| &gt; target |λ|) is preserved across all windows, the biological signal is robust against temporal sub-sampling.</p>
              </div>
            </div>
          )}
          {perturbation?.methodology && (
            <div className="space-y-3 border-t border-slate-200 pt-4 mt-4">
              <div>
                <h4 className="text-slate-600 font-medium mb-1">Perturbation Validation Approach</h4>
                <p>{perturbation.methodology.approach}</p>
              </div>
              <div>
                <h4 className="text-slate-600 font-medium mb-1">Expected Perturbation Directions</h4>
                <p>{perturbation.methodology.expectedDirections}</p>
              </div>
              <div>
                <h4 className="text-slate-600 font-medium mb-1">Statistical Test</h4>
                <p>{perturbation.methodology.statisticalTest}</p>
              </div>
              <div>
                <h4 className="text-slate-600 font-medium mb-1">Limitations</h4>
                <p>{perturbation.methodology.limitations}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface NullSurveyData {
  nPermutations: number;
  nullSignificantRate: number;
  nullMeanPValue: number;
  nullMedianPValue: number;
  realSignificantCount: number;
  realMeanPValue: number;
  exceedsNull: boolean;
  enrichmentRatio: number;
  interpretation: string;
  note?: string;
}

function NullSurveyTab() {
  const { data: runs } = useQuery<any[]>({
    queryKey: ['/api/analyses'],
    queryFn: () => fetch('/api/analyses').then(r => r.json()),
    staleTime: 10 * 60 * 1000,
  });

  const latestRunId = runs?.filter((r: any) => r.status === 'completed')
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]?.id;

  const { data, isLoading, error } = useQuery<NullSurveyData>({
    queryKey: ['/api/analyses/null-survey', latestRunId],
    queryFn: () => fetch(`/api/analyses/${latestRunId}/null-survey`).then(r => {
      if (!r.ok) throw new Error('Failed to fetch null survey');
      return r.json();
    }),
    enabled: !!latestRunId,
    staleTime: 10 * 60 * 1000,
  });

  if (!runs) return <LoadingState label="Loading analysis runs..." />;
  if (!latestRunId) {
    return (
      <div className="text-center py-20" data-testid="null-survey-no-data">
        <Shuffle className="w-10 h-10 text-slate-500 mx-auto mb-3" />
        <p className="text-slate-500 text-sm">Run an analysis on the Home page first to see null survey results.</p>
      </div>
    );
  }
  if (isLoading) return <LoadingState label="Computing null survey permutation analysis..." />;
  if (error || !data) return <ErrorState message="Failed to load null survey analysis" />;

  const chartData = [
    { name: 'Real Significant', rate: data.realSignificantCount, fill: data.exceedsNull ? '#22c55e' : '#f59e0b' },
    { name: 'Null Expected', rate: data.nullSignificantRate, fill: '#64748b' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" className="gap-2 border-slate-300 text-slate-600 hover:bg-slate-100" data-testid="button-download-null-survey" onClick={() => downloadAsCSV([{ enrichmentRatio: data.enrichmentRatio, realSignificantCount: data.realSignificantCount, nullSignificantRate: data.nullSignificantRate, nPermutations: data.nPermutations, exceedsNull: data.exceedsNull }], "PAR2_Robustness_NullSurvey.csv")}>
          <Download className="h-4 w-4" /> Download Results (CSV)
        </Button>
      </div>
      <Card className="bg-slate-50 border-slate-200" data-testid="card-null-survey-summary">
        <CardHeader>
          <CardTitle className="text-lg text-slate-900 flex items-center gap-2">
            <Shuffle className="w-5 h-5 text-purple-400" />
            Null Survey — Label Permutation Test
            <Badge className={data.exceedsNull ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 ml-2' : 'bg-amber-500/20 text-amber-400 border-amber-500/30 ml-2'} data-testid="badge-null-survey-result">
              {data.exceedsNull ? 'PASS' : 'WARNING'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-500 text-sm mb-6">
            Clock/target labels were randomly shuffled {data.nPermutations?.toLocaleString() || '5,000'} times. 
            For each permutation, the number of significant pairs (p&lt;0.05) was counted. 
            The enrichment ratio quantifies how far real results exceed null expectation.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-slate-100 rounded-lg p-4 text-center border border-slate-200">
              <div className="text-xs text-slate-500 mb-1">Enrichment Ratio</div>
              <div className={`text-3xl font-bold ${data.exceedsNull ? 'text-emerald-400' : 'text-amber-400'}`} data-testid="text-enrichment-ratio">
                {data.enrichmentRatio?.toFixed(2)}×
              </div>
              <div className="text-xs text-slate-500">real / null</div>
            </div>
            <div className="bg-slate-100 rounded-lg p-4 text-center border border-slate-200">
              <div className="text-xs text-slate-500 mb-1">Real Significant</div>
              <div className="text-2xl font-bold text-slate-900" data-testid="text-real-significant">
                {data.realSignificantCount}
              </div>
              <div className="text-xs text-slate-500">pairs (p&lt;0.05)</div>
            </div>
            <div className="bg-slate-100 rounded-lg p-4 text-center border border-slate-200">
              <div className="text-xs text-slate-500 mb-1">Null Significant Rate</div>
              <div className="text-2xl font-bold text-slate-600" data-testid="text-null-rate">
                {(data.nullSignificantRate * 100)?.toFixed(1)}%
              </div>
              <div className="text-xs text-slate-500">expected by chance</div>
            </div>
            <div className="bg-slate-100 rounded-lg p-4 text-center border border-slate-200">
              <div className="text-xs text-slate-500 mb-1">Real Mean p-value</div>
              <div className="text-2xl font-bold text-slate-900" data-testid="text-real-mean-p">
                {data.realMeanPValue?.toFixed(4)}
              </div>
              <div className="text-xs text-slate-500">vs null {data.nullMeanPValue?.toFixed(4)}</div>
            </div>
          </div>

          <div className="h-64 mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} label={{ value: 'Count / Rate', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }} />
                <Bar dataKey="rate" name="Significant" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className={data.exceedsNull ? 'bg-emerald-900/20 border-emerald-700/30' : 'bg-amber-900/20 border-amber-700/30'}>
        <CardContent className="py-4">
          <p className={`text-sm ${data.exceedsNull ? 'text-emerald-300' : 'text-amber-300'}`} data-testid="text-null-survey-interpretation">
            <strong>Interpretation:</strong> {data.interpretation}
          </p>
          {data.note && (
            <p className="text-sm text-slate-500 mt-2" data-testid="text-null-survey-note">
              <strong>Note:</strong> {data.note}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CrossSpeciesTab() {
  const { data, isLoading, error } = useQuery<any>({
    queryKey: ['/api/validation/robustness-suite/cross-species'],
    queryFn: () => fetch('/api/validation/robustness-suite/cross-species').then(r => r.json()),
    staleTime: 10 * 60 * 1000,
  });

  if (isLoading) return <LoadingState label="Running cross-species replication (baboon GSE98965 vs mouse GSE54650)..." />;
  if (error || !data) return <ErrorState message="Failed to load cross-species replication" />;

  const mouseData = (data.mouseTissues || []).map((t: any) => ({
    tissue: t.tissue.replace('Mouse ', ''),
    clockMean: +t.clockMean.toFixed(4),
    targetMean: +t.targetMean.toFixed(4),
    gap: +t.gap.toFixed(4),
    preserved: t.hierarchyPreserved,
    clockN: t.clockCount,
    targetN: t.targetCount,
  }));

  const baboonData = (data.baboonTissues || []).map((t: any) => ({
    tissue: t.tissue.replace('Baboon ', ''),
    clockMean: +t.clockMean.toFixed(4),
    targetMean: +t.targetMean.toFixed(4),
    gap: +t.gap.toFixed(4),
    preserved: t.hierarchyPreserved,
    clockN: t.clockCount,
    targetN: t.targetCount,
  }));

  const matched = (data.matchedComparisons || []).map((m: any) => ({
    tissue: m.tissue,
    mouseGap: +m.mouseGap.toFixed(4),
    baboonGap: +m.baboonGap.toFixed(4),
    diff: +m.gapDifference.toFixed(4),
    mouseCI: m.mouseCI,
    baboonCI: m.baboonCI,
    both: m.bothSignificant,
  }));

  const mousePreserved = mouseData.filter((t: any) => t.preserved).length;
  const baboonPreserved = baboonData.filter((t: any) => t.preserved).length;
  const bothSig = matched.filter((m: any) => m.both).length;

  return (
    <div className="space-y-6" data-testid="cross-species-tab">
      <Card className="bg-slate-50 border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2" data-testid="text-cross-species-title">
            <Globe className="w-5 h-5 text-cyan-400" />
            Cross-Species Replication: Mouse vs Baboon
          </CardTitle>
          <p className="text-sm text-slate-500 mt-1">
            Tests whether the clock &gt; target eigenvalue hierarchy discovered in mouse (GSE54650, Zhang 2014) 
            independently replicates in baboon (GSE98965, Mure 2018) — a different species, lab, and experimental design.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-slate-100 rounded-lg p-4 text-center" data-testid="stat-mouse-hierarchy">
              <div className="text-2xl font-bold text-blue-400">{mousePreserved}/{mouseData.length}</div>
              <div className="text-xs text-slate-500 mt-1">Mouse tissues preserved</div>
            </div>
            <div className="bg-slate-100 rounded-lg p-4 text-center" data-testid="stat-baboon-hierarchy">
              <div className="text-2xl font-bold text-amber-400">{baboonPreserved}/{baboonData.length}</div>
              <div className="text-xs text-slate-500 mt-1">Baboon tissues preserved</div>
            </div>
            <div className="bg-slate-100 rounded-lg p-4 text-center" data-testid="stat-both-significant">
              <div className="text-2xl font-bold text-emerald-400">{bothSig}/{matched.length}</div>
              <div className="text-xs text-slate-500 mt-1">Both significant (bootstrap)</div>
            </div>
          </div>

          {data.baboonTimepointsPerTissue && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-6 text-sm text-amber-300" data-testid="text-baboon-note">
              Baboon data: {data.baboonTimepointsPerTissue} timepoints per tissue (2h sampling, ZT00-ZT22), 
              {data.totalBaboonGenes} clock/target genes detected. This is an independent dataset from a different species, 
              lab (Mure et al. 2018, Salk Institute), and experimental protocol.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-slate-50 border-slate-200">
          <CardHeader>
            <CardTitle className="text-base text-blue-400" data-testid="text-mouse-title">Mouse (GSE54650)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280} minWidth={1} minHeight={1}>
              <BarChart data={mouseData} margin={{ top: 5, right: 20, bottom: 40, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="tissue" tick={{ fill: "#64748b", fontSize: 10 }} angle={-30} textAnchor="end" height={50} />
                <YAxis tick={{ fill: "#64748b", fontSize: 11 }} domain={[0, 'auto']} />
                <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px", fontSize: "12px" }} />
                <Bar dataKey="clockMean" fill="#3b82f6" name="Clock mean |λ|" radius={[3, 3, 0, 0]} />
                <Bar dataKey="targetMean" fill="#ef4444" name="Target mean |λ|" radius={[3, 3, 0, 0]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-slate-50 border-slate-200">
          <CardHeader>
            <CardTitle className="text-base text-amber-400" data-testid="text-baboon-title">Baboon (GSE98965)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280} minWidth={1} minHeight={1}>
              <BarChart data={baboonData} margin={{ top: 5, right: 20, bottom: 40, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="tissue" tick={{ fill: "#64748b", fontSize: 10 }} angle={-30} textAnchor="end" height={50} />
                <YAxis tick={{ fill: "#64748b", fontSize: 11 }} domain={[0, 'auto']} />
                <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px", fontSize: "12px" }} />
                <Bar dataKey="clockMean" fill="#f59e0b" name="Clock mean |λ|" radius={[3, 3, 0, 0]} />
                <Bar dataKey="targetMean" fill="#ef4444" name="Target mean |λ|" radius={[3, 3, 0, 0]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {matched.length > 0 && (
        <Card className="bg-slate-50 border-slate-200">
          <CardHeader>
            <CardTitle className="text-base" data-testid="text-matched-title">Matched Tissue Comparison (Bootstrap 95% CI)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-matched-comparison">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 text-xs">
                    <th className="py-2 px-3 text-left">Tissue</th>
                    <th className="py-2 px-3 text-right">Mouse Gap</th>
                    <th className="py-2 px-3 text-right">Mouse 95% CI</th>
                    <th className="py-2 px-3 text-right">Baboon Gap</th>
                    <th className="py-2 px-3 text-right">Baboon 95% CI</th>
                    <th className="py-2 px-3 text-center">Both Significant</th>
                  </tr>
                </thead>
                <tbody>
                  {matched.map((m: any) => (
                    <tr key={m.tissue} className="border-b border-slate-800">
                      <td className="py-2 px-3 text-slate-600">{m.tissue}</td>
                      <td className={`py-2 px-3 text-right font-mono ${m.mouseGap > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {m.mouseGap > 0 ? '+' : ''}{m.mouseGap}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-slate-500 text-xs">
                        [{m.mouseCI[0].toFixed(4)}, {m.mouseCI[1].toFixed(4)}]
                      </td>
                      <td className={`py-2 px-3 text-right font-mono ${m.baboonGap > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {m.baboonGap > 0 ? '+' : ''}{m.baboonGap}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-slate-500 text-xs">
                        [{m.baboonCI[0].toFixed(4)}, {m.baboonCI[1].toFixed(4)}]
                      </td>
                      <td className="py-2 px-3 text-center">
                        {m.both ? (
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Yes</Badge>
                        ) : (
                          <Badge className="bg-slate-200 text-slate-500 border-slate-300">No</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-slate-50 border-slate-200">
        <CardContent className="py-4">
          <h3 className="text-slate-900 font-medium mb-2">Per-Gene Detail</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {(data.baboonTissues || []).map((t: any) => (
              <div key={t.tissue} className="bg-slate-100 rounded-lg p-3">
                <h4 className="text-amber-400 text-sm font-medium mb-2">{t.tissue}</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500">Clock genes:</span>
                    {t.clockGenes.map((g: any) => (
                      <div key={g.gene} className="flex justify-between text-blue-300">
                        <span><GeneTooltip gene={g.gene}>{g.gene}</GeneTooltip></span>
                        <span className="font-mono">{g.eigenvalue.toFixed(4)}</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <span className="text-slate-500">Target genes:</span>
                    {t.targetGenes.map((g: any) => (
                      <div key={g.gene} className="flex justify-between text-red-300">
                        <span><GeneTooltip gene={g.gene}>{g.gene}</GeneTooltip></span>
                        <span className="font-mono">{g.eigenvalue.toFixed(4)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-50 border-slate-200">
        <CardContent className="py-4">
          <p className="text-slate-600 text-sm" data-testid="text-cross-species-conclusion">{data.overallConclusion}</p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function RobustnessSuite() {
  const [activeTab, setActiveTab] = useState<Tab>('subsampling');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 text-slate-900">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-700" data-testid="button-back-home">
              <ArrowLeft className="w-4 h-4 mr-1" /> Home
            </Button>
          </Link>
        </div>

        <div className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3 mb-2" data-testid="text-page-title">
                <Shield className="w-8 h-8 text-blue-400" />
                Robustness Suite
              </h1>
              <p className="text-slate-500 max-w-3xl">
                Seven analyses that directly address the main methodological critiques of AR(2) eigenvalue modeling: 
                sample-size sensitivity, estimation uncertainty, non-stationarity dependence, detrending vs differencing, 
                label-shuffle significance testing, leave-one-tissue-out cross-validation, and individual-vs-population prediction stability. 
                All computations use seed=42 for reproducibility.
              </p>
              <div className="rounded-lg bg-slate-100 border border-slate-200 p-4 mt-3">
                <p className="text-sm text-slate-600 leading-relaxed">
                  <strong className="text-slate-900">What you can do:</strong> Each tab runs a different statistical test on the AR(2) results: bootstrap confidence intervals, permutation tests, sub-sampling recovery, and more. Passing these tests means the eigenvalue estimates are reliable, not artifacts. Each tab has its own download button for the specific test results.
                </p>
              </div>
            </div>
          </div>
        </div>

        <PaperCrossLinks currentPage="/robustness-suite" />

        <HowTo
          title="Robustness Suite"
          summary="A comprehensive robustness testing framework that validates AR(2) results through sub-sampling recovery, bootstrap confidence intervals, permutation tests, and population-level coefficient of variation analysis. Ensures results are reproducible and not driven by outliers."
          steps={[
            { label: "Run tests", detail: "The suite automatically executes multiple robustness checks on the core datasets." },
            { label: "Review each test", detail: "Each panel reports a specific robustness metric with pass/fail criteria and visualization." },
            { label: "Check overall score", detail: "The summary shows what fraction of robustness tests pass, indicating overall reliability." }
          ]}
        />

        <div className="flex flex-wrap gap-2 mb-8">
          <TabButton
            active={activeTab === 'subsampling'}
            onClick={() => setActiveTab('subsampling')}
            icon={<TrendingDown className="w-4 h-4" />}
            label="Sub-sampling Recovery"
            testId="tab-subsampling"
          />
          <TabButton
            active={activeTab === 'bootstrap'}
            onClick={() => setActiveTab('bootstrap')}
            icon={<Target className="w-4 h-4" />}
            label="Bootstrap CIs"
            testId="tab-bootstrap"
          />
          <TabButton
            active={activeTab === 'first-diff'}
            onClick={() => setActiveTab('first-diff')}
            icon={<GitBranch className="w-4 h-4" />}
            label="First-Difference"
            testId="tab-first-diff"
          />
          <TabButton
            active={activeTab === 'detrend'}
            onClick={() => setActiveTab('detrend')}
            icon={<Minus className="w-4 h-4" />}
            label="Detrending Defence"
            testId="tab-detrend"
          />
          <TabButton
            active={activeTab === 'permutation'}
            onClick={() => setActiveTab('permutation')}
            icon={<Shuffle className="w-4 h-4" />}
            label="Permutation Test"
            testId="tab-permutation"
          />
          <TabButton
            active={activeTab === 'loto'}
            onClick={() => setActiveTab('loto')}
            icon={<Crosshair className="w-4 h-4" />}
            label="Leave-One-Tissue-Out"
            testId="tab-loto"
          />
          <TabButton
            active={activeTab === 'population-cv'}
            onClick={() => setActiveTab('population-cv')}
            icon={<Layers className="w-4 h-4" />}
            label="Population CV"
            testId="tab-population-cv"
          />
          <TabButton
            active={activeTab === 'model-order'}
            onClick={() => setActiveTab('model-order')}
            icon={<Gauge className="w-4 h-4" />}
            label="Model Order"
            testId="tab-model-order"
          />
          <TabButton
            active={activeTab === 'stationarity'}
            onClick={() => setActiveTab('stationarity')}
            icon={<Activity className="w-4 h-4" />}
            label="Stationarity & Stability"
            testId="tab-stationarity"
          />
          <TabButton
            active={activeTab === 'null-survey'}
            onClick={() => setActiveTab('null-survey')}
            icon={<Shuffle className="w-4 h-4" />}
            label="Null Survey"
            testId="tab-null-survey"
          />
          <div className="w-full mt-2 mb-1">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider" data-testid="text-multi-category-header">Multi-Category</span>
          </div>
          <TabButton
            active={activeTab === 'multi-cat-permutation'}
            onClick={() => setActiveTab('multi-cat-permutation')}
            icon={<Network className="w-4 h-4" />}
            label="MC Permutation"
            testId="tab-multi-cat-permutation"
          />
          <TabButton
            active={activeTab === 'multi-cat-bootstrap'}
            onClick={() => setActiveTab('multi-cat-bootstrap')}
            icon={<Dna className="w-4 h-4" />}
            label="MC Bootstrap"
            testId="tab-multi-cat-bootstrap"
          />
          <TabButton
            active={activeTab === 'multi-cat-detrend'}
            onClick={() => setActiveTab('multi-cat-detrend')}
            icon={<Minus className="w-4 h-4" />}
            label="MC Detrend"
            testId="tab-multi-cat-detrend"
          />
          <TabButton
            active={activeTab === 'multi-cat-loto'}
            onClick={() => setActiveTab('multi-cat-loto')}
            icon={<Crosshair className="w-4 h-4" />}
            label="MC LOTO"
            testId="tab-multi-cat-loto"
          />
          <div className="w-full mt-2 mb-1">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider" data-testid="text-cross-species-header">Cross-Species</span>
          </div>
          <TabButton
            active={activeTab === 'cross-species'}
            onClick={() => setActiveTab('cross-species')}
            icon={<Globe className="w-4 h-4" />}
            label="Baboon Replication"
            testId="tab-cross-species"
          />
        </div>

        {activeTab === 'subsampling' && <SubsamplingTab />}
        {activeTab === 'bootstrap' && <BootstrapTab />}
        {activeTab === 'first-diff' && <FirstDiffTab />}
        {activeTab === 'detrend' && <DetrendTab />}
        {activeTab === 'permutation' && <PermutationTab />}
        {activeTab === 'loto' && <LOTOTab />}
        {activeTab === 'population-cv' && <PopulationCVTab />}
        {activeTab === 'model-order' && <ModelOrderTab />}
        {activeTab === 'stationarity' && <StationarityTab />}
        {activeTab === 'multi-cat-permutation' && <MultiCatPermutationTab />}
        {activeTab === 'multi-cat-bootstrap' && <MultiCatBootstrapTab />}
        {activeTab === 'multi-cat-detrend' && <MultiCatDetrendTab />}
        {activeTab === 'multi-cat-loto' && <MultiCatLOTOTab />}
        {activeTab === 'null-survey' && <NullSurveyTab />}
        {activeTab === 'cross-species' && <CrossSpeciesTab />}

        <Card className="bg-slate-50 border-slate-200 mt-8">
          <CardContent className="py-4">
            <h3 className="text-slate-900 font-medium mb-2">Methodology</h3>
            <p className="text-slate-500 text-sm mb-2">
              <strong>Sub-sampling Recovery:</strong> The 48-timepoint GSE11923 dataset serves as ground truth. 
              Random sub-samples (N=24, 12, 8, 6) are drawn 50 times each, AR(2) refit, and eigenvalue error measured 
              against the full-series estimate. This quantifies the sample-size boundary for reliable eigenvalue recovery.
            </p>
            <p className="text-slate-500 text-sm mb-2">
              <strong>Bootstrap CIs:</strong> Block bootstrap (block size = sqrt(N)) resamples AR(2) residuals, 
              reconstructs synthetic time series using the fitted AR(2) coefficients, and refits to produce 
              a distribution of eigenvalue estimates. The 2.5th and 97.5th percentiles define the 95% CI.
            </p>
            <p className="text-slate-500 text-sm mb-2">
              <strong>First-Difference:</strong> Applying y[t] - y[t-1] removes linear trends and makes 
              most non-stationary series stationary. If the clock &gt; target hierarchy persists after differencing, 
              the pattern is not an artifact of trend-driven non-stationarity.
            </p>
            <p className="text-slate-500 text-sm mb-2">
              <strong>Linear Detrending:</strong> Removes only the linear trend (slope + intercept) from each gene's 
              time series, preserving oscillatory autocorrelation structure. Compared to first-differencing (which 
              over-corrects by destroying the signal AR(2) measures), detrending shows whether the hierarchy is 
              driven by linear drift vs genuine oscillatory persistence.
            </p>
            <p className="text-slate-500 text-sm mb-2">
              <strong>Permutation Test:</strong> Clock/target labels are randomly shuffled 10,000 times (seed=42). 
              For each permutation, the gap (mean clock |λ| - mean target |λ|) is recomputed. The one-sided 
              p-value is the fraction of null gaps ≥ the observed gap (with +1 continuity correction). 
              This tests whether the hierarchy could arise from random gene selection.
            </p>
            <p className="text-slate-500 text-sm">
              <strong>Leave-One-Tissue-Out:</strong> Each of the 12 mouse tissues (GSE54650) is held out in turn.
              AR(2) eigenvalues are computed for the remaining 11 tissues to establish the clock &gt; target hierarchy.
              The held-out tissue is then independently tested for the same pattern. If prediction accuracy is high,
              the hierarchy is a cross-tissue phenomenon not driven by any single tissue.
            </p>
            <p className="text-slate-500 text-sm mb-2">
              <strong>Population CV:</strong> 5-fold cross-validation where each fold holds out 20% of timepoints. 
              AR(2) is refit on the remaining 80%, and population-level means (clock vs target) are compared. 
              Even if individual predictions are noisy, stable population means confirm the hierarchy is a robust 
              aggregate pattern.
            </p>
            <p className="text-slate-500 text-sm mb-2">
              <strong>Model Order Sensitivity:</strong> AR(p) models are fit for p=1,2,3,4 across multiple datasets.
              AR(2) is the recommended order: it captures oscillatory dynamics (complex roots) that AR(1) cannot represent,
              while AR(3-4) provide negligible R² improvement and risk overfitting with typical circadian time series lengths.
            </p>
            <p className="text-slate-500 text-sm mb-2">
              <strong>MC Permutation:</strong> A Kruskal-Wallis H test is applied across all gene categories 
              (not just clock vs target), with category labels permuted to generate a null distribution. 
              The permutation p-value quantifies whether the multi-category eigenvalue hierarchy could arise by chance.
            </p>
            <p className="text-slate-500 text-sm mb-2">
              <strong>MC Bootstrap:</strong> Bootstrap resampling of per-category eigenvalue estimates produces 
              95% confidence intervals for each category's mean eigenvalue. Rank stability is assessed by checking 
              how often the bootstrap replicates preserve the original category ordering.
            </p>
            <p className="text-slate-500 text-sm mb-2">
              <strong>MC Detrend:</strong> Linear detrending is applied per gene before multi-category AR(2) fitting. 
              The Spearman rank correlation between raw and detrended category hierarchies is computed to verify 
              that the ordering is not driven by linear trends in the underlying time series.
            </p>
            <p className="text-slate-500 text-sm mb-2">
              <strong>MC LOTO:</strong> Multi-category leave-one-tissue-out cross-validation. Each tissue is held out, 
              the category hierarchy is computed from the remaining training tissues, and the held-out tissue's hierarchy 
              is compared via rank correlation. High agreement indicates the multi-category ranking generalizes across tissues.
            </p>
            <p className="text-slate-500 text-sm mb-2">
              <strong>Null Survey:</strong> Labels (clock vs target) are randomly shuffled 5,000 times. 
              For each permutation, the number of significant pairs (p&lt;0.05) is counted. The enrichment 
              ratio (real significant / mean null significant) quantifies how far real results exceed the 
              null expectation. A ratio &gt;&gt;1 confirms the observed hierarchy is not a statistical artifact.
            </p>
            <p className="text-slate-500 text-sm mb-2">
              <strong>Cross-Species (Baboon):</strong> The GSE98965 baboon atlas (Mure et al. 2018, Salk Institute) 
              provides 12 timepoints (ZT00-ZT22, 2h intervals) across 64+ tissues. AR(2) eigenvalues are computed 
              for matched clock and target genes in baboon, and the clock &gt; target hierarchy is tested tissue-by-tissue. 
              Bootstrap 95% CIs quantify gap significance in both species. This is the strongest form of external 
              validation: a completely independent dataset from a different species, lab, and experimental design.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
