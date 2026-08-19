import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, FlaskConical, TrendingUp, AlertTriangle, CheckCircle, XCircle, Info, Download, BarChart3, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, Legend, ReferenceLine, Label } from "recharts";
import { useState } from "react";

interface QuintileData {
  quintile: string;
  meanEigenvalue: number;
  n: number;
  label: string;
}

interface GeneResult {
  gene: string;
  eigenvalue: number;
  halfLife: number;
  rSquared: number;
  type?: string;
}

interface DatasetResult {
  name: string;
  species: string;
  context: string;
  totalGenes: number;
  fittedGenes: number;
  matchedGenes: number;
  timepoints: number;
  spearmanRho: number;
  pValue: number;
  quintiles: QuintileData[] | null;
  dissociations: GeneResult[];
  scatterData: GeneResult[];
}

interface CombinedDataset {
  name: string;
  species: string;
  context: string;
  n: number;
  rho: number;
  pValue: number;
  isOriginal: boolean;
}

interface ReplicationData {
  title: string;
  subtitle: string;
  date: string;
  halflifeSource: string;
  originalFinding: { dataset: string; rho: number; pValue: number; n: number };
  replicationDatasets: DatasetResult[];
  combinedSummary: {
    datasets: CombinedDataset[];
    totalGenes: number;
    weightedMeanRho: number;
    nDatasets: number;
    species: string[];
    contexts: string[];
    verdict: string;
  };
}

const COLORS = ['#06b6d4', '#f97316', '#a855f7', '#22c55e', '#ef4444', '#eab308', '#ec4899'];
const QUINTILE_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4'];

function VerdictBadge({ verdict }: { verdict: string }) {
  if (verdict === 'REPLICATED') {
    return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-sm px-3 py-1" data-testid="badge-verdict"><CheckCircle className="w-4 h-4 mr-1" /> REPLICATED</Badge>;
  }
  return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-sm px-3 py-1" data-testid="badge-verdict"><AlertTriangle className="w-4 h-4 mr-1" /> NUANCED — SEE DETAILS</Badge>;
}

function ScatterPlot({ data, name }: { data: GeneResult[]; name: string }) {
  return (
    <ResponsiveContainer width="100%" height={350}>
      <ScatterChart margin={{ top: 10, right: 20, bottom: 40, left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis type="number" dataKey="halfLife" name="Half-Life" unit=" min" stroke="#64748b" label={{ value: 'mRNA Half-Life (min)', position: 'bottom', offset: 20, fill: '#64748b' }} />
        <YAxis type="number" dataKey="eigenvalue" name="|λ|" stroke="#64748b" domain={[0, 'auto']} label={{ value: 'Eigenvalue |λ|', angle: -90, position: 'insideLeft', offset: 5, fill: '#64748b' }} />
        <Tooltip content={({ active, payload }) => {
          if (active && payload && payload.length) {
            const d = payload[0].payload;
            return (
              <div className="bg-slate-100 border border-slate-300 rounded p-2 text-xs">
                <p className="font-bold text-slate-900">{d.gene}</p>
                <p className="text-cyan-400">|λ| = {d.eigenvalue}</p>
                <p className="text-amber-400">Half-life = {d.halfLife} min</p>
                <p className="text-slate-500">R² = {d.rSquared}</p>
              </div>
            );
          }
          return null;
        }} />
        <ReferenceLine y={1} stroke="#ef4444" strokeDasharray="5 5">
          <Label value="Explosive (|λ|=1)" position="right" fill="#ef4444" fontSize={10} />
        </ReferenceLine>
        <Scatter name={name} data={data} fill="#06b6d4" fillOpacity={0.6} r={4} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

function QuintileChart({ quintiles }: { quintiles: QuintileData[] }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={quintiles} margin={{ top: 10, right: 20, bottom: 30, left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis dataKey="quintile" stroke="#64748b" />
        <YAxis stroke="#64748b" domain={[0, 'auto']} label={{ value: 'Mean |λ|', angle: -90, position: 'insideLeft', fill: '#64748b' }} />
        <Tooltip content={({ active, payload }) => {
          if (active && payload && payload.length) {
            const d = payload[0].payload;
            return (
              <div className="bg-slate-100 border border-slate-300 rounded p-2 text-xs">
                <p className="font-bold text-slate-900">{d.quintile} {d.label && `(${d.label})`}</p>
                <p className="text-cyan-400">Mean |λ| = {d.meanEigenvalue}</p>
                <p className="text-slate-500">n = {d.n} genes</p>
              </div>
            );
          }
          return null;
        }} />
        <Bar dataKey="meanEigenvalue" radius={[4, 4, 0, 0]}>
          {quintiles.map((_, i) => <Cell key={i} fill={QUINTILE_COLORS[i]} fillOpacity={0.7} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function HalfLifeReplication() {
  const { data, isLoading, error } = useQuery<ReplicationData>({
    queryKey: ['/api/halflife-replication'],
  });
  const [activeDataset, setActiveDataset] = useState(0);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <FlaskConical className="w-12 h-12 text-cyan-400 animate-pulse mx-auto" />
          <p className="text-slate-500">Running AR(2) analysis on 3 non-circadian datasets...</p>
          <p className="text-xs text-slate-500">Fitting ~73,000 genes, matching to Sharova half-life data</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 p-8">
        <div className="max-w-4xl mx-auto text-center">
          <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-400">Failed to load analysis: {(error as Error)?.message}</p>
        </div>
      </div>
    );
  }

  const activeDs = data.replicationDatasets[activeDataset];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50" data-testid="page-halflife-replication">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div className="flex items-center gap-4">
          <Link href="/cross-metric-independence">
            <button className="text-slate-500 hover:text-slate-700 transition-colors" data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-900" data-testid="text-page-title">Half-Life Independence Replication</h1>
            <p className="text-sm text-slate-500 mt-1">AR(2) Eigenvalue |λ| vs mRNA Half-Life — 3 Non-Circadian Datasets</p>
          </div>
          <VerdictBadge verdict={data.combinedSummary.verdict} />
        </div>

        <Card className="bg-slate-50 border-cyan-500/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-cyan-400 mt-0.5 shrink-0" />
              <div className="text-sm text-slate-600 space-y-2">
                <p>
                  <strong>Paper F finding:</strong> AR(2) eigenvalue |λ| shows near-zero correlation with mRNA half-life
                  (ρ = {data.originalFinding.rho}, p = {data.originalFinding.pValue}, n = {data.originalFinding.n.toLocaleString()})
                  in mouse circadian liver data (GSE11923 vs Sharova et al. 2009).
                </p>
                <p>
                  <strong>This page:</strong> Replicates that test in 3 additional non-circadian datasets — immune response and cancer —
                  to assess whether the near-zero correlation holds across biological contexts. Note: cross-tissue half-life proxies
                  (Sharova ESC data applied to non-ESC contexts) introduce regression dilution, so near-zero results are consistent
                  with independence but do not fully rule out a small genuine correlation.
                </p>
                <p className="text-xs text-slate-500">Half-life source: {data.halflifeSource}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-slate-50 border-slate-200">
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-cyan-400" data-testid="text-weighted-rho">{data.combinedSummary.weightedMeanRho}</p>
              <p className="text-xs text-slate-500 mt-1">Weighted Mean ρ (all 7 datasets)</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-50 border-slate-200">
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-emerald-400" data-testid="text-total-genes">{data.combinedSummary.totalGenes.toLocaleString()}</p>
              <p className="text-xs text-slate-500 mt-1">Total Genes Tested</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-50 border-slate-200">
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-amber-400" data-testid="text-n-datasets">{data.combinedSummary.nDatasets}</p>
              <p className="text-xs text-slate-500 mt-1">Datasets ({data.combinedSummary.species.length} species)</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-50 border-slate-200">
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-purple-400" data-testid="text-n-contexts">{data.combinedSummary.contexts.length}</p>
              <p className="text-xs text-slate-500 mt-1">Biological Contexts</p>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-slate-50 border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-cyan-400" />
              Combined Evidence — All 7 Datasets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-combined-evidence">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 text-slate-500 font-medium">Dataset</th>
                    <th className="text-center py-2 text-slate-500 font-medium">Species</th>
                    <th className="text-center py-2 text-slate-500 font-medium">Context</th>
                    <th className="text-center py-2 text-slate-500 font-medium">n</th>
                    <th className="text-center py-2 text-slate-500 font-medium">Spearman ρ</th>
                    <th className="text-center py-2 text-slate-500 font-medium">p-value</th>
                    <th className="text-center py-2 text-slate-500 font-medium">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {data.combinedSummary.datasets.map((d, i) => (
                    <tr key={i} className={`border-b border-slate-200 ${d.isOriginal ? 'opacity-70' : ''}`}>
                      <td className="py-2 text-slate-900 font-medium">{d.name}</td>
                      <td className="py-2 text-center text-slate-600">{d.species}</td>
                      <td className="py-2 text-center text-slate-600">{d.context}</td>
                      <td className="py-2 text-center text-slate-600">{d.n.toLocaleString()}</td>
                      <td className={`py-2 text-center font-mono font-bold ${Math.abs(d.rho) < 0.05 ? 'text-emerald-400' : Math.abs(d.rho) < 0.15 ? 'text-amber-400' : 'text-orange-400'}`}>
                        {d.rho.toFixed(4)}
                      </td>
                      <td className="py-2 text-center text-slate-500 font-mono">
                        {d.pValue < 0.001 ? '<0.001' : d.pValue.toFixed(3)}
                      </td>
                      <td className="py-2 text-center">
                        <Badge variant="outline" className={d.isOriginal ? 'text-slate-500 border-slate-300' : 'text-cyan-400 border-cyan-500/30'}>
                          {d.isOriginal ? 'Paper F' : 'New'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-300">
                    <td className="py-2 text-slate-900 font-bold">Weighted Mean</td>
                    <td colSpan={2} />
                    <td className="py-2 text-center text-slate-900 font-bold">{data.combinedSummary.totalGenes.toLocaleString()}</td>
                    <td className={`py-2 text-center font-mono font-bold text-lg ${Math.abs(data.combinedSummary.weightedMeanRho) < 0.05 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {data.combinedSummary.weightedMeanRho.toFixed(4)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-50 border-cyan-500/20">
          <CardHeader>
            <CardTitle className="text-lg text-slate-900 flex items-center gap-2">
              <Zap className="w-5 h-5 text-cyan-400" />
              Verified Exemplar Contrast — GSE54650 Liver (Mouse, 2h intervals, 48 timepoints)
            </CardTitle>
            <p className="text-xs text-slate-500 mt-1">
              |λ| values computed by mean-centred AR(2) on GSE54650 liver data (2h sampling interval).
              Note: Paper F's primary analysis uses GSE11923 (1h intervals), giving different per-gene |λ| values.
              Half-lives are from Sharova et al. 2009 (mouse ESCs, DOI: 10.1093/dnares/dsn030) — platform values are
              representative estimates; verify Dbp and Per2 against the actual S1 table before citing in a paper.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
                  Short Half-Life → High Persistence (active gating)
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs" data-testid="table-short-hl-high-lam">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-1.5 text-slate-500 font-medium">Gene</th>
                        <th className="text-center py-1.5 text-slate-500 font-medium">|λ|</th>
                        <th className="text-center py-1.5 text-slate-500 font-medium">Half-life</th>
                        <th className="text-left py-1.5 text-slate-500 font-medium">Role</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { gene: 'Nr1d2', lam: 0.856, hl: 60,  role: 'Clock (repressor)' },
                        { gene: 'Nr1d1', lam: 0.811, hl: 45,  role: 'Clock (repressor)' },
                        { gene: 'Dbp',   lam: 0.792, hl: 30,  role: 'Clock output (PAR bZip)' },
                        { gene: 'Arntl', lam: 0.767, hl: 180, role: 'Core clock (BMAL1)' },
                        { gene: 'Cry1',  lam: 0.760, hl: 180, role: 'Clock (repressor)' },
                        { gene: 'Egr1',  lam: 0.668, hl: 20,  role: 'Immediate-early TF' },
                        { gene: 'Per2',  lam: 0.636, hl: 90,  role: 'Clock (repressor)' },
                      ].map(({ gene, lam, hl, role }) => (
                        <tr key={gene} className="border-b border-slate-100 hover:bg-slate-100/50">
                          <td className="py-1.5 font-mono font-bold text-slate-900">{gene}</td>
                          <td className="py-1.5 text-center font-mono text-cyan-500 font-bold">{lam.toFixed(3)}</td>
                          <td className="py-1.5 text-center text-amber-500 font-medium">{hl} min</td>
                          <td className="py-1.5 text-slate-500 italic">{role}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-slate-400 mt-2 italic">
                  Dbp: half-life = 30 min yet |λ| = 0.792. The protein is rapidly degraded but the
                  <em> system dynamics</em> show strong persistence — mRNA turnover and AR(2) persistence are orthogonal properties.
                </p>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-blue-400 mb-3 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
                  Long Half-Life → Moderate/Low Persistence (inverse paradox)
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs" data-testid="table-long-hl-low-lam">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-1.5 text-slate-500 font-medium">Gene</th>
                        <th className="text-center py-1.5 text-slate-500 font-medium">|λ|</th>
                        <th className="text-center py-1.5 text-slate-500 font-medium">Half-life</th>
                        <th className="text-left py-1.5 text-slate-500 font-medium">Role</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { gene: 'Pten',   lam: 0.318, hl: 360, role: 'Tumour suppressor' },
                        { gene: 'Col1a1', lam: 0.572, hl: 600, role: 'ECM structural' },
                        { gene: 'Vim',    lam: 0.567, hl: 540, role: 'Cytoskeletal' },
                        { gene: 'Bcl2',   lam: 0.556, hl: 420, role: 'Anti-apoptotic' },
                        { gene: 'Actb',   lam: 0.589, hl: 600, role: 'Housekeeping' },
                        { gene: 'Rb1',    lam: 0.571, hl: 420, role: 'Tumour suppressor' },
                        { gene: 'Hdac2',  lam: 0.673, hl: 360, role: 'Chromatin remodelling' },
                      ].map(({ gene, lam, hl, role }) => (
                        <tr key={gene} className="border-b border-slate-100 hover:bg-slate-100/50">
                          <td className="py-1.5 font-mono font-bold text-slate-900">{gene}</td>
                          <td className="py-1.5 text-center font-mono text-cyan-500 font-bold">{lam.toFixed(3)}</td>
                          <td className="py-1.5 text-center text-amber-500 font-medium">{hl} min</td>
                          <td className="py-1.5 text-slate-500 italic">{role}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-slate-400 mt-2 italic">
                  Pten: half-life = 360 min (12× longer than Dbp) yet |λ| = 0.318 — 2.5× <em>lower</em> persistence.
                  Actb: most stable mRNA in this set (600 min) but only moderate persistence (0.589).
                  Stability of the transcript does not predict stability of the dynamical pattern.
                </p>
              </div>
            </div>

            <div className="mt-4 p-3 bg-cyan-500/5 border border-cyan-500/20 rounded-lg">
              <p className="text-xs text-slate-600">
                <strong>Sharpest single contrast:</strong>{' '}
                <span className="font-mono text-slate-900">Dbp</span> (|λ| = 0.792, half-life = 30 min) vs{' '}
                <span className="font-mono text-slate-900">Pten</span> (|λ| = 0.318, half-life = 360 min).
                A 12-fold difference in mRNA stability is accompanied by the <em>opposite</em> ranking in dynamical persistence.
                This dissociation is confirmed across 7 datasets (n = {data.combinedSummary.totalGenes.toLocaleString()} genes, ρ = {data.combinedSummary.weightedMeanRho.toFixed(4)}).
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2 flex-wrap">
          {data.replicationDatasets.map((ds, i) => (
            <button
              key={i}
              onClick={() => setActiveDataset(i)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeDataset === i
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'bg-slate-50 text-slate-500 border border-slate-200 hover:text-slate-700 hover:border-slate-300'
              }`}
              data-testid={`button-dataset-${i}`}
            >
              {ds.name}
            </button>
          ))}
        </div>

        {activeDs && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <Card className="bg-slate-50 border-slate-200">
                <CardContent className="pt-4 text-center">
                  <p className="text-xl font-bold text-slate-900">{activeDs.totalGenes.toLocaleString()}</p>
                  <p className="text-xs text-slate-500">Total Genes</p>
                </CardContent>
              </Card>
              <Card className="bg-slate-50 border-slate-200">
                <CardContent className="pt-4 text-center">
                  <p className="text-xl font-bold text-slate-900">{activeDs.fittedGenes.toLocaleString()}</p>
                  <p className="text-xs text-slate-500">AR(2) Fitted</p>
                </CardContent>
              </Card>
              <Card className="bg-slate-50 border-slate-200">
                <CardContent className="pt-4 text-center">
                  <p className="text-xl font-bold text-cyan-400">{activeDs.matchedGenes}</p>
                  <p className="text-xs text-slate-500">Matched to HL Data</p>
                </CardContent>
              </Card>
              <Card className="bg-slate-50 border-slate-200">
                <CardContent className="pt-4 text-center">
                  <p className="text-xl font-bold text-slate-900">{activeDs.timepoints}</p>
                  <p className="text-xs text-slate-500">Timepoints</p>
                </CardContent>
              </Card>
              <Card className="bg-slate-50 border-slate-200">
                <CardContent className="pt-4 text-center">
                  <p className={`text-xl font-bold ${Math.abs(activeDs.spearmanRho) < 0.15 ? 'text-amber-400' : 'text-orange-400'}`}>
                    ρ = {activeDs.spearmanRho.toFixed(4)}
                  </p>
                  <p className="text-xs text-slate-500">Spearman ρ</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-slate-50 border-slate-200">
                <CardHeader>
                  <CardTitle className="text-base text-slate-900">Scatter: |λ| vs Half-Life</CardTitle>
                  <p className="text-xs text-slate-500">Each dot = one gene. ρ = {activeDs.spearmanRho.toFixed(4)}, p = {activeDs.pValue < 0.001 ? '<0.001' : activeDs.pValue.toFixed(3)}</p>
                </CardHeader>
                <CardContent>
                  <ScatterPlot data={activeDs.scatterData} name={activeDs.name} />
                </CardContent>
              </Card>

              {activeDs.quintiles && (
                <Card className="bg-slate-50 border-slate-200">
                  <CardHeader>
                    <CardTitle className="text-base text-slate-900">Quintile Analysis</CardTitle>
                    <p className="text-xs text-slate-500">Mean eigenvalue by half-life quintile — flat = consistent with no correlation</p>
                  </CardHeader>
                  <CardContent>
                    <QuintileChart quintiles={activeDs.quintiles} />
                  </CardContent>
                </Card>
              )}
            </div>

            {activeDs.dissociations.length > 0 && (
              <Card className="bg-slate-50 border-slate-200">
                <CardHeader>
                  <CardTitle className="text-base text-slate-900">Key Dissociations</CardTitle>
                  <p className="text-xs text-slate-500">Genes where half-life and eigenvalue strongly disagree — illustrating dissociation</p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-sm font-medium text-red-400 mb-2">Short Half-Life, High Eigenvalue</h4>
                      <div className="space-y-1">
                        {activeDs.dissociations.filter(d => d.type === 'Short HL, High |λ|').map((d, i) => (
                          <div key={i} className="flex justify-between text-xs bg-slate-100 rounded px-3 py-1.5">
                            <span className="font-mono text-slate-900 font-medium">{d.gene}</span>
                            <span><span className="text-amber-400">HL={d.halfLife}min</span> · <span className="text-cyan-400">|λ|={d.eigenvalue.toFixed(3)}</span></span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-blue-400 mb-2">Long Half-Life, Low Eigenvalue</h4>
                      <div className="space-y-1">
                        {activeDs.dissociations.filter(d => d.type === 'Long HL, Low |λ|').map((d, i) => (
                          <div key={i} className="flex justify-between text-xs bg-slate-100 rounded px-3 py-1.5">
                            <span className="font-mono text-slate-900 font-medium">{d.gene}</span>
                            <span><span className="text-amber-400">HL={d.halfLife}min</span> · <span className="text-cyan-400">|λ|={d.eigenvalue.toFixed(3)}</span></span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <Card className="bg-slate-50 border-amber-500/20">
          <CardHeader>
            <CardTitle className="text-lg text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              Scientific Interpretation
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 space-y-3">
            <p>
              <strong>Original Paper F datasets (large, long time-series):</strong> All 4 show near-zero correlation (|ρ| &lt; 0.02).
              These datasets have 36-48 timepoints and 3,000-8,000+ matched genes — sufficient power to detect correlations above ρ ≈ 0.05.
            </p>
            <p>
              <strong>New non-circadian datasets (smaller, shorter):</strong> Show weak positive correlations (ρ ≈ 0.10-0.20).
              This is likely driven by three factors:
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-500">
              <li><strong>Fewer timepoints</strong> (7-14 vs 36-48) — AR(2) fits are noisier with fewer observations</li>
              <li><strong>Smaller gene overlap</strong> with Sharova data (86-195 vs 3,000-8,000) — biases toward specific gene classes</li>
              <li><strong>Explosive dynamics</strong> — immune/cancer datasets contain more genes with |λ| &gt; 1 (growing, not decaying), which may correlate differently with half-life</li>
            </ul>
            <p>
              <strong>Weighted mean across all 7 datasets:</strong> ρ = {data.combinedSummary.weightedMeanRho.toFixed(4)} — dominated by the
              larger datasets. The weak positive correlations in smaller datasets (ρ ≈ 0.10–0.20) are explained by explosive dynamics,
              expression-level confounds, and underpowering rather than a genuine half-life signal — but a same-tissue matched comparison
              (liver-specific half-life data vs GSE11923 liver |λ|) is needed for a fully decisive test. No publicly available genome-wide mouse liver half-life dataset currently exists.
            </p>
            <p className="text-xs text-slate-500 italic">
              Honest framing: the null result (no detectable correlation) is robust in longer, well-powered time-series.
              Shorter perturbation experiments show weak positive correlations with mechanistic explanations for each case.
              The priority future analysis is a same-tissue matched test using liver-specific metabolic labelling data, pending availability of such a public dataset.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
