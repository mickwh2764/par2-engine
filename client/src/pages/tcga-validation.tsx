import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Cell
} from "recharts";
import {
  ArrowLeft, Loader2, CheckCircle2, XCircle, AlertTriangle,
  FlaskConical, Info, ExternalLink, TrendingUp, TrendingDown, Minus, Download
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { downloadAsCSV } from "@/components/DownloadResultsButton";

function DirectionIcon({ direction }: { direction: string }) {
  if (direction === 'up') return <TrendingUp size={12} className="text-red-400 inline" />;
  if (direction === 'down') return <TrendingDown size={12} className="text-emerald-400 inline" />;
  return <Minus size={12} className="text-slate-500 inline" />;
}

function StatBox({ label, value, unit, highlight, testId }: {
  label: string; value: string | number; unit?: string; highlight?: boolean; testId: string;
}) {
  return (
    <div className={`rounded-lg p-3 border ${highlight ? 'bg-blue-500/10 border-blue-500/30' : 'bg-slate-50 border-slate-200'}`} data-testid={testId}>
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className={`text-lg font-bold font-mono ${highlight ? 'text-blue-300' : 'text-slate-800'}`}>{value}</div>
      {unit && <div className="text-[10px] text-slate-500">{unit}</div>}
    </div>
  );
}

export default function TCGAValidation() {
  const [filter, setFilter] = useState<'all' | 'clock' | 'target'>('all');
  const [showNote, setShowNote] = useState(false);

  const { data, isLoading, error } = useQuery<any>({
    queryKey: ['/api/tcga-colorectal-validation'],
    staleTime: Infinity,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex items-center justify-center" data-testid="loading-state">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400 mx-auto mb-4" />
          <p className="text-slate-500">Loading TCGA colorectal cancer validation...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex items-center justify-center" data-testid="error-state">
        <div className="text-center text-red-400">
          <XCircle className="w-8 h-8 mx-auto mb-2" />
          <p>Failed to load TCGA validation data</p>
        </div>
      </div>
    );
  }

  const genes = (data.genes || []).filter((g: any) =>
    filter === 'all' || g.type === filter
  );

  const clockGenes = (data.genes || []).filter((g: any) => g.type === 'clock');
  const targetGenes = (data.genes || []).filter((g: any) => g.type === 'target');

  const barData = (data.genes || []).map((g: any) => ({
    gene: g.gene,
    log2FC: g.log2FC,
    type: g.type,
    fill: g.type === 'clock' ? (g.log2FC < 0 ? '#34d399' : '#f87171') : (g.log2FC > 0 ? '#f87171' : '#34d399'),
  }));

  const scatterData = (data.genes || []).map((g: any) => ({
    gene: g.gene,
    type: g.type,
    x: g.lambdaChange,
    y: g.log2FC,
    concordant: g.concordant,
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 text-slate-100" data-testid="tcga-validation-page">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/ar2-diagnostics">
            <button className="flex items-center gap-1 text-slate-500 hover:text-slate-800 text-sm" data-testid="back-link">
              <ArrowLeft size={16} /> AR(2) Diagnostics
            </button>
          </Link>
        </div>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <FlaskConical className="text-red-400" size={28} />
            <h1 className="text-2xl font-bold text-slate-100" data-testid="page-title">
              TCGA Colorectal Cancer Validation
            </h1>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto text-slate-600 border-slate-300 text-xs"
              onClick={() => downloadAsCSV(
                (data.genes || []).map((g: any) => ({
                  gene: g.gene,
                  type: g.type,
                  log2FC_TCGA_tumor_vs_normal: g.log2FC,
                  lambda_change_organoid: g.lambdaChange,
                  concordant: g.concordant,
                })),
                'TCGA_colorectal_validation.csv'
              )}
              data-testid="button-download-tcga-csv"
            >
              <Download size={13} className="mr-1" /> Download CSV
            </Button>
          </div>
          <p className="text-slate-500 text-sm max-w-3xl">
            Cross-validation between AR(2) eigenvalue trajectories in GSE157357 intestinal organoids (ApcKO vs WT)
            and RNA-seq expression fold-changes in TCGA-COAD colorectal adenocarcinoma (n={data.conditionSummary?.nTumors} tumors
            vs n={data.conditionSummary?.nNormals} normals). Tests whether organoid eigenvalue changes predict the direction
            of expression change in human colorectal tumors.
          </p>
          <button
            onClick={() => setShowNote(!showNote)}
            className="mt-2 flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300"
            data-testid="btn-toggle-note"
          >
            <Info size={12} /> {showNote ? 'Hide' : 'Show'} methodological note
          </button>
          {showNote && (
            <div className="mt-3 bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 text-xs text-slate-600 leading-relaxed whitespace-pre-line" data-testid="methodological-note">
              {data.methodologicalNote}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatBox label="Concordance Rate" value={`${Math.round((data.concordanceSummary?.concordanceRate || 0) * 100)}%`} unit={`${data.concordanceSummary?.concordant}/${data.concordanceSummary?.totalGenes} genes`} highlight testId="stat-concordance-rate" />
          <StatBox label="Clock Genes Tested" value={data.concordanceSummary?.clockGenes || 0} unit={`${data.concordanceSummary?.concordantClock}/7 concordant (corrected)`} testId="stat-clock-genes" />
          <StatBox label="Target Genes Tested" value={data.concordanceSummary?.targetGenes || 0} unit={`${data.concordanceSummary?.concordantTarget}/8 concordant (p=0.035, post-hoc exploratory)`} testId="stat-target-genes" />
          <StatBox label="Primary Mechanism" value="ApcKO-like" unit="target gene elevation drives gap collapse" testId="stat-mechanism" />
        </div>

        <Card className="bg-white border-slate-200 mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-slate-100 text-base flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-400" />
              Corrected Finding: Overall 10/15 Concordance (p=0.151, Not Significant — Primary Result); Post-hoc Target Sub-analysis 7/8 (p=0.035, Nominal/Exploratory/Non-confirmatory); Clock 3/7 (p=0.774, NS)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                <div className="text-xs font-semibold text-emerald-300 mb-2">Clock Genes ({clockGenes.length})</div>
                <div className="text-xs text-slate-500 mb-1">Mean log₂FC in TCGA: <span className="text-emerald-400 font-mono">{data.conditionSummary?.clockGenesMean_log2FC?.toFixed(2)}</span></div>
                <div className="text-xs text-slate-500">Direction: ↓ downregulated in tumors — 3/7 concordant (p=0.774, not significant)</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 border border-emerald-200">
                <div className="text-xs font-semibold text-emerald-400 mb-2">Target Genes ({targetGenes.length}) — post-hoc sub-analysis (non-confirmatory)</div>
                <div className="text-xs text-slate-500 mb-1">Mean log₂FC in TCGA: <span className="text-emerald-400 font-mono">+{data.conditionSummary?.targetGenesMean_log2FC?.toFixed(2)}</span></div>
                <div className="text-xs text-slate-500">Direction: ↑ upregulated in tumors — 7/8 concordant (p=0.035; nominal, unadjusted, post-hoc exploratory — not confirmatory)</div>
              </div>
            </div>
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
              <div className="text-xs font-semibold text-blue-300 mb-1">Mechanism Conclusion</div>
              <p className="text-xs text-slate-600">{data.mechanismInterpretation?.keyConclusion}</p>
              <div className="mt-2 space-y-1">
                <p className="text-xs text-slate-500">• {data.mechanismInterpretation?.wee1Finding}</p>
                <p className="text-xs text-slate-500">• {data.mechanismInterpretation?.lgr5Finding}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-slate-100 text-base">TCGA Expression Fold-Changes (Tumor vs Normal, log₂FC)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64" data-testid="chart-log2fc">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="gene" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: '11px' }}
                    formatter={(val: any) => [`${val > 0 ? '+' : ''}${Number(val).toFixed(2)}`, 'log₂FC (TCGA tumor vs normal)']}
                  />
                  <ReferenceLine y={0} stroke="#64748b" />
                  <Bar dataKey="log2FC" radius={[3, 3, 0, 0]}>
                    {barData.map((entry: any, index: number) => (
                      <Cell
                        key={index}
                        fill={entry.log2FC < 0 ? '#34d399' : '#f87171'}
                        opacity={0.8}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex gap-4 justify-center mt-2">
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <div className="w-3 h-3 rounded bg-red-400/80" /> Upregulated in tumor
              </div>
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <div className="w-3 h-3 rounded bg-emerald-400/80" /> Downregulated in tumor
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-slate-100 text-base">Concordance Table: Organoid Eigenvalues vs TCGA Expression</CardTitle>
              <div className="flex gap-2">
                {(['all', 'clock', 'target'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-2 py-1 text-xs rounded ${filter === f ? 'bg-blue-600 text-slate-900' : 'bg-slate-200 text-slate-600 hover:bg-slate-600'}`}
                    data-testid={`filter-${f}`}
                  >
                    {f === 'all' ? 'All' : f === 'clock' ? 'Clock' : 'Target'}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs" data-testid="concordance-table">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-200">
                    <th className="text-left py-1.5 px-2">Gene</th>
                    <th className="text-center py-1.5 px-2">Type</th>
                    <th className="text-right py-1.5 px-2">WT |λ|</th>
                    <th className="text-right py-1.5 px-2">ApcKO |λ|</th>
                    <th className="text-right py-1.5 px-2">Δ|λ|</th>
                    <th className="text-right py-1.5 px-2">TCGA log₂FC</th>
                    <th className="text-center py-1.5 px-2">Sig.</th>
                    <th className="text-center py-1.5 px-2">Concordant</th>
                    <th className="text-left py-1.5 px-2 max-w-xs">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {genes.map((g: any, i: number) => (
                    <tr key={i} className="border-b border-slate-200 text-slate-600 hover:bg-slate-50">
                      <td className="py-1.5 px-2 font-mono font-semibold">{g.gene}</td>
                      <td className="py-1.5 px-2 text-center">
                        <Badge className={`text-[10px] ${g.type === 'clock' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' : 'bg-purple-500/20 text-purple-300 border-purple-500/30'}`}>
                          {g.type}
                        </Badge>
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono">{g.organoidWTLambda.toFixed(3)}</td>
                      <td className="py-1.5 px-2 text-right font-mono">{g.organoidApcKOLambda.toFixed(3)}</td>
                      <td className={`py-1.5 px-2 text-right font-mono ${g.lambdaChange > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {g.lambdaChange > 0 ? '+' : ''}{g.lambdaChange.toFixed(3)}
                      </td>
                      <td className={`py-1.5 px-2 text-right font-mono ${g.log2FC > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {g.log2FC > 0 ? '+' : ''}{g.log2FC.toFixed(2)}
                      </td>
                      <td className="py-1.5 px-2 text-center">
                        {g.significant
                          ? <CheckCircle2 size={12} className="text-emerald-400 inline" />
                          : <Minus size={12} className="text-slate-500 inline" />}
                      </td>
                      <td className="py-1.5 px-2 text-center">
                        {g.concordant
                          ? <CheckCircle2 size={13} className="text-emerald-400 inline" />
                          : <XCircle size={13} className="text-red-400 inline" />}
                      </td>
                      <td className="py-1.5 px-2 text-slate-500 text-[10px] max-w-xs">{g.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-slate-100 text-base">Hierarchy Gap: Organoid vs Expected Human CRC</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200" data-testid="stat-wt-clock">
                <div className="text-xs text-slate-500">WT clock median |λ|</div>
                <div className="text-xl font-bold font-mono text-blue-300">{data.clockMedian_WT?.toFixed(3)}</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200" data-testid="stat-wt-target">
                <div className="text-xs text-slate-500">WT target median |λ|</div>
                <div className="text-xl font-bold font-mono text-slate-600">{data.targetMedian_WT?.toFixed(3)}</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200" data-testid="stat-apcko-clock">
                <div className="text-xs text-slate-500">ApcKO clock median |λ|</div>
                <div className="text-xl font-bold font-mono text-amber-400">{data.clockMedian_ApcKO?.toFixed(3)}</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200" data-testid="stat-apcko-target">
                <div className="text-xs text-slate-500">ApcKO target median |λ|</div>
                <div className="text-xl font-bold font-mono text-red-400">{data.targetMedian_ApcKO?.toFixed(3)}</div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-center" data-testid="stat-gap-wt">
                <div className="text-xs text-slate-500 mb-1">WT hierarchy gap</div>
                <div className="text-2xl font-bold font-mono text-emerald-400">+{data.hierarchyGap_WT?.toFixed(3)}</div>
                <div className="text-[10px] text-slate-500">(clock − target)</div>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-center" data-testid="stat-gap-apcko">
                <div className="text-xs text-slate-500 mb-1">ApcKO gap (human CRC model)</div>
                <div className="text-2xl font-bold font-mono text-amber-400">{data.hierarchyGap_ApcKO?.toFixed(3)}</div>
                <div className="text-[10px] text-slate-500">(clock − target)</div>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-3">
              The ApcKO organoid profile (which matches human CRC's dominant APC mutation, ~75% of cases) predicts that
              human colorectal tumors have a collapsed or near-zero hierarchy gap. TCGA expression patterns — with elevated
              target genes and suppressed clock genes — are consistent with this prediction, though direct eigenvalue
              computation from cross-sectional TCGA data is not possible.
            </p>
          </CardContent>
        </Card>

        {/* COFE independent confirmation */}
        <Card className="bg-white border-slate-200 mb-6" data-testid="cofe-confirmation-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-slate-100 text-base flex items-center gap-2">
              <ExternalLink size={15} className="text-teal-400" />
              Independent confirmation: COFE (Gupta et al. 2024)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500 mb-3 leading-relaxed">
              COFE (Cyclic Ordering with Feature Extraction) is an independent unsupervised method that reconstructs
              circadian rhythms directly from unlabelled TCGA tumour biopsies. Applied to 11 human adenocarcinomas, it
              identified four clock genes as specifically phase-delayed in cancer — genes whose timing is disrupted even
              though their oscillation is retained. All four are direct BMAL1/CLOCK E-box targets and all four are also
              notable in the PAR(2) analysis above. The convergence is independent: different methods, different data types,
              different biological quantities.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs" data-testid="cofe-ebox-table">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="text-left py-1.5 px-2">Gene</th>
                    <th className="text-left py-1.5 px-2">COFE finding (cancer)</th>
                    <th className="text-left py-1.5 px-2">PAR(2) platform finding</th>
                    <th className="text-left py-1.5 px-2">Convergence</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { gene: "NR1D2", cofe: "Phase-delayed in 11/11 ACs", par2: "High |λ| — clock-layer persistence", convergence: "Both flag disruption in this E-box/RRE gene" },
                    { gene: "TEF",   cofe: "Phase-delayed — specifically mistimed", par2: "6 Floquet proximity cases in monodromy table", convergence: "Independently notable as a dynamic E-box target" },
                    { gene: "BHLHE40", cofe: "Phase-delayed; one of 4 mistimed genes", par2: "In 14-gene E-box set (p=0.041 mouse, p=0.029 enteroid)", convergence: "E-box disruption confirmed by both routes" },
                    { gene: "PER2",  cofe: "Phase-delayed; only E-box/D-box in the group", par2: "High |λ| in healthy circadian datasets", convergence: "Dynamically active but temporally displaced in cancer" },
                  ].map((r, i) => (
                    <tr key={i} className="border-b border-slate-100 text-slate-600 hover:bg-slate-50" data-testid={`cofe-row-${r.gene}`}>
                      <td className="py-1.5 px-2 font-mono font-semibold text-slate-800">{r.gene}</td>
                      <td className="py-1.5 px-2 text-teal-600">{r.cofe}</td>
                      <td className="py-1.5 px-2 text-orange-600">{r.par2}</td>
                      <td className="py-1.5 px-2 text-slate-500 italic">{r.convergence}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex items-start gap-2 text-xs text-slate-500">
              <Info size={11} className="mt-0.5 flex-shrink-0 text-slate-400" />
              <span>
                Gupta et al. (2024) bioRxiv doi:10.1101/2024.03.13.584582 ·{' '}
                <a href="/convergence-map" className="text-teal-500 hover:text-teal-400 underline">Convergence Map</a>
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-slate-100 text-base">Data Sources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(data.dataSources || []).map((s: any, i: number) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <Info size={12} className="text-slate-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-slate-600 font-medium">{s.label}: </span>
                    <span className="text-slate-500">{s.reference}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
