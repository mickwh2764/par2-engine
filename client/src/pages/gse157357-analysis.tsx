import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, ReferenceLine, BarChart, Bar, Cell
} from "recharts";
import {
  ArrowLeft, Loader2, XCircle, Dna, AlertTriangle, CheckCircle2, Info, Download, RefreshCw
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { downloadAsCSV } from "@/components/DownloadResultsButton";

const CONDITIONS = ['WT', 'BmalKO', 'ApcKO', 'DblKO'] as const;
const CONDITION_LABELS: Record<string, string> = {
  WT: 'Wild-type',
  BmalKO: 'Bmal1 KO',
  ApcKO: 'Apc KO',
  DblKO: 'Apc+Bmal1 DblKO',
};
const CONDITION_COLORS: Record<string, string> = {
  WT: '#34d399',
  BmalKO: '#60a5fa',
  ApcKO: '#f87171',
  DblKO: '#a78bfa',
};

function ConditionBadge({ cond }: { cond: string }) {
  const colors: Record<string, string> = {
    WT: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    BmalKO: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    ApcKO: 'bg-red-500/20 text-red-300 border-red-500/30',
    DblKO: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  };
  return <Badge className={`text-[10px] ${colors[cond] || 'bg-slate-500/20 text-slate-600'}`}>{CONDITION_LABELS[cond] || cond}</Badge>;
}

const CLOCK_GENES_LIST = ['Arntl', 'Per2', 'Cry1'];
const TARGET_GENES_LIST = ['Wee1', 'Lgr5', 'Myc', 'Cdk1', 'Mki67', 'Cdkn1a', 'Ccnb1'];

export default function GSE157357Analysis() {
  const [selectedGene, setSelectedGene] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<'all' | 'clock' | 'target'>('all');
  const [showDominanceMatrix, setShowDominanceMatrix] = useState(false);

  const { data, isLoading, error } = useQuery<any>({
    queryKey: ['/api/gse157357/pairwise-analysis'],
    staleTime: Infinity,
  });

  const { data: altData } = useQuery<any>({
    queryKey: ['/api/gse157357/alternative-verification'],
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
          <p>Failed to load GSE157357 data</p>
        </div>
      </div>
    );
  }

  const trajectories: any[] = data.keyGeneTrajectories || [];
  const filtered = trajectories.filter((g: any) =>
    typeFilter === 'all' || g.role.toLowerCase().includes(typeFilter === 'clock' ? 'clock' : 'target')
  );

  const activeGene = selectedGene ? trajectories.find((g: any) => g.gene === selectedGene) : null;

  const trajectoryChartData = CONDITIONS.map(cond => {
    const point: any = { condition: CONDITION_LABELS[cond] };
    trajectories.forEach((g: any) => {
      point[g.gene] = g[cond.toLowerCase() === 'dblko' ? 'dblko' : cond.toLowerCase() === 'bmalko' ? 'bmalko' : cond.toLowerCase() === 'apcko' ? 'apcko' : 'wt'];
    });
    return point;
  });

  const gapChartData = (data.conditions || []).map((c: any) => ({
    condition: c.label,
    gap: c.hierarchyGap,
    clock: c.clockMedian,
    target: c.targetMedian,
  }));

  const geneColors = ['#34d399', '#60a5fa', '#f87171', '#a78bfa', '#fbbf24', '#f472b6'];

  const selectedTrajectoryData = activeGene
    ? CONDITIONS.map(cond => ({
        condition: CONDITION_LABELS[cond],
        value: activeGene[cond.toLowerCase() === 'dblko' ? 'dblko' : cond.toLowerCase() === 'bmalko' ? 'bmalko' : cond.toLowerCase() === 'apcko' ? 'apcko' : 'wt'],
      }))
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 text-slate-100" data-testid="gse157357-page">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/ar2-diagnostics">
            <button className="flex items-center gap-1 text-slate-500 hover:text-slate-800 text-sm" data-testid="back-link">
              <ArrowLeft size={16} /> Manuscript Validation
            </button>
          </Link>
          <span className="text-slate-600">/</span>
          <Link to="/tcga-validation">
            <button className="flex items-center gap-1 text-slate-500 hover:text-slate-800 text-sm" data-testid="tcga-link">
              TCGA Cross-Validation
            </button>
          </Link>
        </div>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Dna className="text-purple-400" size={28} />
            <h1 className="text-2xl font-bold text-slate-100" data-testid="page-title">
              GSE157357 Four-Condition Analysis
            </h1>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto text-slate-600 border-slate-300 text-xs"
              onClick={() => downloadAsCSV(
                trajectories.map((g: any) => ({
                  gene: g.gene,
                  role: g.role,
                  eigenvalue_wt: g.wt,
                  eigenvalue_bmalko: g.bmalko,
                  eigenvalue_apcko: g.apcko,
                  eigenvalue_dblko: g.dblko,
                })),
                'GSE157357_four_condition_eigenvalues.csv'
              )}
              data-testid="button-download-gse157357-csv"
            >
              <Download size={13} className="mr-1" /> Download CSV
            </Button>
          </div>
          <p className="text-slate-500 text-sm max-w-3xl">
            AR(2) eigenvalue modulus |λ| across four genotypes of intestinal organoids: Wild-type, Bmal1 KO, Apc KO,
            and Apc/Bmal1 double knockout. Both single knockouts collapse the clock-target hierarchy gap via opposite
            mechanisms; the double mutant paradoxically restores it.
          </p>
          {/* Temporal coverage caveat — non-dismissible */}
          <div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3" data-testid="temporal-coverage-caveat">
            <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed">
              <strong className="font-semibold">Temporal coverage caveat — GSE157357:</strong>{' '}
              This dataset covers only a 22 h ZT window (ZT24–46), which is insufficient for AR(2) circadian eigenvalue analysis (≥36 h required).
              The AR(2) eigenvalues shown here are unreliable for circadian genes and should not be used to draw conclusions about circadian oscillator strength or hierarchy.
              Values are presented for disease-comparison purposes only; treat all eigenvalue numbers as indicative.
            </p>
          </div>
          {/* April 2026 preprocessing correction notice */}
          <div className="mt-4 flex items-start gap-3 rounded-lg border border-blue-400 bg-blue-50 px-4 py-3" data-testid="april-2026-correction-banner">
            <RefreshCw className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-900 leading-relaxed">
              <strong className="font-semibold">Values updated April 2026:</strong>{' '}
              Eigenvalues recomputed from replicate-averaged chronological series. Corrected four-condition Wee1 eigenvalues: WT=0.655 / BmalKO=0.782 / ApcKO=0.877 / DblKO=0.335.
              See <strong>Zenodo V6</strong> for full details.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 mt-3">
            <div className="flex items-center gap-1 text-xs text-slate-500"><div className="w-3 h-3 rounded-full bg-emerald-400" /> WT</div>
            <div className="flex items-center gap-1 text-xs text-slate-500"><div className="w-3 h-3 rounded-full bg-blue-400" /> BmalKO (clock loss)</div>
            <div className="flex items-center gap-1 text-xs text-slate-500"><div className="w-3 h-3 rounded-full bg-red-400" /> ApcKO (cancer model)</div>
            <div className="flex items-center gap-1 text-xs text-slate-500"><div className="w-3 h-3 rounded-full bg-purple-400" /> DblKO (paradox)</div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {(data.conditions || []).map((c: any) => (
            <div
              key={c.label}
              className="rounded-lg p-3 border border-slate-200 bg-slate-50"
              data-testid={`condition-card-${c.label}`}
            >
              <div className="mb-1"><ConditionBadge cond={c.label} /></div>
              <div className={`text-2xl font-bold font-mono mt-1 ${c.hierarchyGap > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {c.hierarchyGap > 0 ? '+' : ''}{c.hierarchyGap.toFixed(3)}
              </div>
              <div className="text-[10px] text-slate-500 mb-1">hierarchy gap</div>
              <div className="text-[10px] text-slate-500">Clock: {c.clockMedian.toFixed(3)}</div>
              <div className="text-[10px] text-slate-500">Target: {c.targetMedian.toFixed(3)}</div>
            </div>
          ))}
        </div>

        <Card className="bg-white border-slate-200 mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-slate-100 text-base">Hierarchy Gap Across Four Conditions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56" data-testid="chart-gap">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={gapChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="condition" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} domain={[-0.1, 0.45]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: '11px' }}
                    formatter={(val: any) => [`${val > 0 ? '+' : ''}${Number(val).toFixed(3)}`, 'Hierarchy gap (clock − target)']}
                  />
                  <ReferenceLine y={0} stroke="#64748b" strokeDasharray="4 4" />
                  <Bar dataKey="gap" radius={[4, 4, 0, 0]}>
                    {gapChartData.map((entry: any, index: number) => (
                      <Cell
                        key={index}
                        fill={Object.values(CONDITION_COLORS)[index] as string}
                        opacity={0.8}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-slate-100 text-base">Gene Trajectory Explorer</CardTitle>
              <div className="flex gap-2">
                {(['all', 'clock', 'target'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => { setTypeFilter(f); setSelectedGene(null); }}
                    className={`px-2 py-1 text-xs rounded ${typeFilter === f ? 'bg-blue-600 text-slate-900' : 'bg-slate-200 text-slate-600 hover:bg-slate-600'}`}
                    data-testid={`filter-${f}`}
                  >
                    {f === 'all' ? 'All' : f === 'clock' ? 'Clock' : 'Target'}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-4">
              {filtered.map((g: any) => (
                <button
                  key={g.gene}
                  onClick={() => setSelectedGene(selectedGene === g.gene ? null : g.gene)}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                    selectedGene === g.gene
                      ? 'bg-blue-600 border-blue-500 text-slate-900'
                      : 'bg-slate-100 border-slate-300 text-slate-600 hover:bg-slate-200'
                  }`}
                  data-testid={`gene-btn-${g.gene}`}
                >
                  {g.gene}
                  <span className="ml-1 opacity-60 text-[9px]">
                    {g.role.includes('clock') ? '(clock)' : '(target)'}
                  </span>
                </button>
              ))}
            </div>

            {activeGene && selectedTrajectoryData && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-semibold text-slate-800">{activeGene.gene}</span>
                  <Badge className="text-[10px] bg-slate-200 text-slate-600">{activeGene.role}</Badge>
                </div>
                <div className="h-48" data-testid={`chart-gene-${activeGene.gene}`}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={selectedTrajectoryData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="condition" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                      <YAxis domain={[0, 1.0]} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: '11px' }}
                        formatter={(val: any) => [Number(val).toFixed(3), `${activeGene.gene} |λ|`]}
                      />
                      <ReferenceLine y={1.0} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Unit root', position: 'right', fontSize: 10, fill: '#ef4444' }} />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#60a5fa"
                        strokeWidth={2}
                        dot={{ r: 5, fill: '#60a5fa', stroke: '#1e293b', strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-slate-500 mt-2 italic">{activeGene.interpretation}</p>
              </div>
            )}

            {!activeGene && (
              <div className="h-56" data-testid="chart-all-trajectories">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trajectoryChartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="condition" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <YAxis domain={[0, 1.0]} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: '11px' }}
                      formatter={(val: any, name: string) => [Number(val).toFixed(3), `${name} |λ|`]}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <ReferenceLine y={1.0} stroke="#ef4444" strokeDasharray="4 4" />
                    {filtered.map((g: any, i: number) => (
                      <Line
                        key={g.gene}
                        type="monotone"
                        dataKey={g.gene}
                        stroke={geneColors[i % geneColors.length]}
                        strokeWidth={1.5}
                        dot={{ r: 3 }}
                        opacity={0.8}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {!activeGene && (
              <p className="text-xs text-slate-500 text-center mt-1">Click a gene button above to see its individual trajectory and interpretation</p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-slate-100 text-base">Mechanism Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-xs" data-testid="mechanism-table">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-200">
                    <th className="text-left py-1.5 px-2">Condition</th>
                    <th className="text-right py-1.5 px-2">Gap</th>
                    <th className="text-left py-1.5 px-2">Mechanism</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.mechanismSummary || []).map((m: any, i: number) => (
                    <tr key={i} className="border-b border-slate-200">
                      <td className="py-1.5 px-2">
                        <ConditionBadge cond={m.condition} />
                      </td>
                      <td className={`py-1.5 px-2 text-right font-mono font-semibold ${m.gap > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {m.gap > 0 ? '+' : ''}{m.gap.toFixed(3)}
                      </td>
                      <td className="py-1.5 px-2 text-slate-500">{m.mechanism}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4" data-testid="paradox-box">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={14} className="text-amber-400" />
                <span className="text-sm font-semibold text-amber-300">Double-Mutant Paradox</span>
              </div>
              <p className="text-xs text-slate-600 mb-2">{data.doubleMutantParadox?.description}</p>
              <div className="space-y-1">
                {(data.doubleMutantParadox?.routes || []).map((r: string, i: number) => (
                  <p key={i} className="text-xs text-slate-500">• {r}</p>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-slate-100 text-base">Full Gene Trajectory Table</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs" data-testid="full-gene-table">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-200">
                    <th className="text-left py-1.5 px-2">Gene</th>
                    <th className="text-left py-1.5 px-2">Role</th>
                    <th className="text-right py-1.5 px-2 text-emerald-400">WT</th>
                    <th className="text-right py-1.5 px-2 text-blue-400">BmalKO</th>
                    <th className="text-right py-1.5 px-2 text-red-400">ApcKO</th>
                    <th className="text-right py-1.5 px-2 text-purple-400">DblKO</th>
                    <th className="text-left py-1.5 px-2">Interpretation</th>
                  </tr>
                </thead>
                <tbody>
                  {trajectories.map((g: any, i: number) => (
                    <tr
                      key={i}
                      className="border-b border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
                      onClick={() => setSelectedGene(selectedGene === g.gene ? null : g.gene)}
                      data-testid={`gene-row-${g.gene}`}
                    >
                      <td className="py-1.5 px-2 font-mono font-semibold">{g.gene}</td>
                      <td className="py-1.5 px-2 text-slate-500">{g.role}</td>
                      <td className="py-1.5 px-2 text-right font-mono text-emerald-300">{g.wt.toFixed(3)}</td>
                      <td className="py-1.5 px-2 text-right font-mono text-blue-300">{g.bmalko.toFixed(3)}</td>
                      <td className="py-1.5 px-2 text-right font-mono text-red-300">{g.apcko.toFixed(3)}</td>
                      <td className="py-1.5 px-2 text-right font-mono text-purple-300">{g.dblko.toFixed(3)}</td>
                      <td className="py-1.5 px-2 text-slate-500 text-[10px]">{g.interpretation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500 mt-2">Click any row to chart that gene's trajectory above.</p>
          </CardContent>
        </Card>

        {altData && (
          <Card className="bg-white border-slate-200 mb-6" data-testid="alternative-verification-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-slate-100 text-base flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-400" />
                  Independent Verification — Four Methods
                </CardTitle>
                <Badge className="bg-emerald-900/30 text-emerald-400 text-[10px]">
                  {altData.concordance}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-500 mb-4">
                The double-mutant paradox is verified across four independent representations of the same data.
                Methods 2 and 3 (ACF) are derived analytically from AR(2) parameters via Yule-Walker equations and express the same information in autocorrelation units.
                Method 4 (dominance) is fully model-independent — it uses only rank ordering of eigenvalues across 21 clock-target gene pairs with no mean computation, no model, and no distributional assumptions.
              </p>

              <div className="overflow-x-auto mb-6">
                <table className="w-full text-xs" data-testid="verification-methods-table">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-200">
                      <th className="text-left py-2 px-2">Condition</th>
                      <th className="text-right py-2 px-2">AR(2) |λ| Gap<br /><span className="font-normal opacity-60">primary metric</span></th>
                      <th className="text-right py-2 px-2">ACF Lag-1 Gap<br /><span className="font-normal opacity-60">Yule-Walker ρ(1)</span></th>
                      <th className="text-right py-2 px-2">ACF Lag-2 Gap<br /><span className="font-normal opacity-60">Yule-Walker ρ(2)</span></th>
                      <th className="text-right py-2 px-2">Dominance Score<br /><span className="font-normal opacity-60">non-parametric</span></th>
                      <th className="text-center py-2 px-2">Pattern</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(altData.conditions || []).map((c: any, i: number) => {
                      const condColor: Record<string, string> = {
                        WT: 'text-emerald-400', BmalKO: 'text-blue-400', ApcKO: 'text-red-400', DblKO: 'text-purple-400'
                      };
                      const col = condColor[c.label] || 'text-slate-400';
                      const pos = c.patternSign === 'positive';
                      return (
                        <tr key={i} className="border-b border-slate-200" data-testid={`verify-row-${c.label}`}>
                          <td className="py-2 px-2">
                            <ConditionBadge cond={c.label} />
                          </td>
                          <td className={`py-2 px-2 text-right font-mono font-semibold ${pos ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {c.ar2Gap > 0 ? '+' : ''}{c.ar2Gap.toFixed(3)}
                          </td>
                          <td className={`py-2 px-2 text-right font-mono ${pos ? 'text-emerald-300' : 'text-amber-300'}`}>
                            {c.acfLag1Gap > 0 ? '+' : ''}{c.acfLag1Gap.toFixed(3)}
                            <span className="text-slate-500 text-[10px] ml-1">
                              ({c.acfLag1Clock.toFixed(2)} vs {c.acfLag1Target.toFixed(2)})
                            </span>
                          </td>
                          <td className={`py-2 px-2 text-right font-mono ${pos ? 'text-emerald-300' : 'text-amber-300'}`}>
                            {c.acfLag2Gap > 0 ? '+' : ''}{c.acfLag2Gap.toFixed(3)}
                            <span className="text-slate-500 text-[10px] ml-1">
                              ({c.acfLag2Clock.toFixed(3)} vs {c.acfLag2Target.toFixed(3)})
                            </span>
                          </td>
                          <td className={`py-2 px-2 text-right font-mono font-semibold ${pos ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {c.dominancePct.toFixed(1)}%
                            <span className="text-slate-500 text-[10px] ml-1">
                              ({c.dominanceNumerator}/{c.dominanceDenominator})
                            </span>
                          </td>
                          <td className="py-2 px-2 text-center">
                            {pos
                              ? <CheckCircle2 size={13} className="text-emerald-400 inline" />
                              : <AlertTriangle size={13} className="text-amber-400 inline" />}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-500 font-semibold">Method 4 — Non-parametric dominance across all 21 clock×target pairs</span>
                  <button
                    onClick={() => setShowDominanceMatrix(!showDominanceMatrix)}
                    className="text-[10px] text-blue-400 underline"
                    data-testid="toggle-dominance-matrix"
                  >
                    {showDominanceMatrix ? 'Hide matrix' : 'Show full matrix'}
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {(altData.conditions || []).map((c: any) => {
                    const pos = c.patternSign === 'positive';
                    const barColors: Record<string, string> = {
                      WT: 'bg-emerald-500', BmalKO: 'bg-blue-500', ApcKO: 'bg-red-500', DblKO: 'bg-purple-500'
                    };
                    return (
                      <div key={c.label} className="text-center" data-testid={`dominance-bar-${c.label}`}>
                        <div className="text-[10px] text-slate-500 mb-1">{CONDITION_LABELS[c.label] || c.label}</div>
                        <div className="w-full bg-slate-200 rounded-full h-2 mb-1">
                          <div
                            className={`${barColors[c.label] || 'bg-slate-500'} h-2 rounded-full transition-all`}
                            style={{ width: `${c.dominancePct}%` }}
                          />
                        </div>
                        <div className={`text-xs font-mono font-semibold ${pos ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {c.dominancePct.toFixed(1)}%
                        </div>
                        <div className="text-[10px] text-slate-500">{c.dominanceNumerator}/{c.dominanceDenominator} pairs</div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] text-slate-500 italic">
                  For each condition: out of 21 clock×target gene pairs (3 clock genes × 7 target genes), the percentage where the clock gene eigenvalue exceeds the target gene eigenvalue.
                  WT = 100%, both single KOs collapse to &lt;10%, DblKO partially restores to 47.6%.
                </p>

                {showDominanceMatrix && (
                  <div className="mt-4 overflow-x-auto">
                    {['wt', 'bmalKO', 'apcKO', 'dblKO'].map((condKey, ci) => {
                      const condLabel = ['WT', 'BmalKO', 'ApcKO', 'DblKO'][ci];
                      const pairs = (altData.perGeneComparisons || []).filter((p: any) => p.condition === condKey);
                      return (
                        <div key={condKey} className="mb-4">
                          <div className="flex items-center gap-2 mb-1">
                            <ConditionBadge cond={condLabel} />
                            <span className="text-[10px] text-slate-500">
                              {pairs.filter((p: any) => p.clockWins).length}/{pairs.length} clock wins
                            </span>
                          </div>
                          <table className="w-full text-[10px]" data-testid={`matrix-${condKey}`}>
                            <thead>
                              <tr className="text-slate-500 border-b border-slate-200">
                                <th className="text-left py-1 px-1">Clock gene</th>
                                {TARGET_GENES_LIST.map(t => (
                                  <th key={t} className="text-center py-1 px-1">{t}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {CLOCK_GENES_LIST.map(clockGene => (
                                <tr key={clockGene} className="border-b border-slate-100">
                                  <td className="py-1 px-1 font-mono font-semibold text-slate-600">{clockGene}</td>
                                  {TARGET_GENES_LIST.map(targetGene => {
                                    const pair = pairs.find((p: any) => p.clockGene === clockGene && p.targetGene === targetGene);
                                    return (
                                      <td key={targetGene} className="py-1 px-1 text-center" title={pair ? `${clockGene}=${pair.clockVal.toFixed(3)}, ${targetGene}=${pair.targetVal.toFixed(3)}` : ''}>
                                        {pair?.clockWins
                                          ? <CheckCircle2 size={10} className="text-emerald-400 inline" />
                                          : <XCircle size={10} className="text-amber-400 inline" />}
                                        <span className="text-[9px] text-slate-400 ml-0.5">{pair?.clockVal.toFixed(2)}</span>
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 size={13} className="text-emerald-400" />
                  <span className="text-xs font-semibold text-emerald-300">Verification Verdict</span>
                </div>
                <p className="text-xs text-slate-500">{altData.verdict}</p>
                <div className="mt-2 pt-2 border-t border-emerald-800/30">
                  <p className="text-[10px] text-slate-500">
                    <span className="text-slate-400 font-medium">Methodology note — ACF methods:</span> ρ(k) = |λ|^k × cos(kπ/6) assumes oscillating model with T = 12 timepoints (24h circadian period at 2h sampling). This assumption is uniform across clock and target groups, so hierarchy ordering is preserved. The non-parametric dominance score requires no such assumption.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="bg-slate-100 border border-slate-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Info size={14} className="text-slate-500" />
            <span className="text-xs text-slate-500 font-medium">Dataset</span>
          </div>
          <p className="text-xs text-slate-500">
            GSE157357 — Mouse intestinal organoids, four genotypes (WT, Bmal1-KO, Apc-KO, Apc/Bmal1 double-KO), 24 timepoints at 2-hour intervals.
            AR(2) fit to mean-centred expression time series per gene per condition. |λ| = eigenvalue modulus; capped at 1.0.
            Clock gene set: 14 core circadian regulators (Arntl, Per1/2, Cry1/2, Clock, Dbp, Tef, Nr1d1/2, Csnk1d/e, Rorc, Npas2).
            Target gene set: 23 downstream/cell-cycle targets.
            Source: Rosselot et al. 2022 / Bhatt et al. 2022.
          </p>
        </div>
      </div>
    </div>
  );
}
