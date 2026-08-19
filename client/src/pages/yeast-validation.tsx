import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, ScatterChart, Scatter, ZAxis, ReferenceLine
} from "recharts";
import {
  ArrowLeft, Loader2, CheckCircle2, XCircle, Dna, FlaskConical, Activity, Beaker, Download
} from "lucide-react";
import { Link } from "wouter";
import EvidenceLink from "@/components/EvidenceLink";
import { downloadAsCSV } from "@/components/DownloadResultsButton";

const CATEGORY_COLORS: Record<string, string> = {
  core_oscillator: '#f59e0b',
  metabolic_target: '#3b82f6',
  cell_cycle_target: '#ef4444',
  ribosomal_target: '#8b5cf6',
  other: '#6b7280',
};

const CATEGORY_LABELS: Record<string, string> = {
  core_oscillator: 'Core Oscillator TFs',
  metabolic_target: 'Metabolic Enzymes',
  cell_cycle_target: 'Cell Cycle',
  ribosomal_target: 'Ribosomal',
  other: 'Other',
};

export default function YeastValidation() {
  const [activeTab, setActiveTab] = useState<'overview' | 'hierarchy' | 'phases' | 'stability'>('overview');

  const { data, isLoading, error } = useQuery<any>({
    queryKey: ['/api/analysis/yeast-metabolic-cycle'],
    staleTime: Infinity,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen" data-testid="loading-yeast">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        <span className="ml-3 text-lg">Running AR(2) on yeast metabolic cycle...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen text-red-400" data-testid="error-yeast">
        <XCircle className="h-6 w-6 mr-2" />
        Failed to load yeast analysis
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview & Hierarchy', icon: FlaskConical },
    { id: 'hierarchy', label: 'Cross-System Comparison', icon: Dna },
    { id: 'phases', label: 'Phase Analysis', icon: Activity },
    { id: 'stability', label: 'Rolling Stability', icon: Beaker },
  ] as const;

  const ht = data.hierarchyTest;
  const principlePreserved = data.crossSystemComparison.principlePreserved;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/95">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="button-back-home">
              <ArrowLeft className="h-4 w-4 mr-1" /> Home
            </Button>
          </Link>
        </div>

        <div className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-3xl font-bold mb-2" data-testid="text-page-title">
              Cross-Kingdom Validation: Yeast Metabolic Cycle
            </h1>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 text-xs"
              onClick={() => downloadAsCSV(
                (data.categoryStats || []).map((c: any) => ({
                  category: c.category,
                  n_genes: c.count,
                  mean_eigenvalue: c.meanEigenvalue,
                  mean_r2: c.meanR2,
                  complex_pct: c.complexPct,
                })),
                'yeast_metabolic_cycle_AR2_category_stats.csv'
              )}
              data-testid="button-download-yeast-csv"
            >
              <Download size={13} className="mr-1" /> Download CSV
            </Button>
          </div>
          <p className="text-muted-foreground max-w-3xl">
            Testing whether the AR(2) eigenvalue hierarchy (core oscillator &gt; downstream targets) is a 
            universal property of biological oscillator networks — not just mammalian circadian clocks.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <Badge variant="outline" data-testid="badge-dataset">{data.dataset.name}</Badge>
            <Badge variant="outline">{data.dataset.organism}</Badge>
            <Badge variant="outline">{data.dataset.oscillatorType}</Badge>
            <Badge variant="outline">{data.dataset.timepoints} timepoints</Badge>
            <Badge variant="outline">{data.dataset.totalGenes.toLocaleString()} genes</Badge>
            {principlePreserved ? (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30" data-testid="badge-result">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Hierarchy Preserved
              </Badge>
            ) : (
              <Badge className="bg-red-500/20 text-red-400 border-red-500/30" data-testid="badge-result">
                <XCircle className="h-3 w-3 mr-1" /> Hierarchy Not Found
              </Badge>
            )}
          </div>
        </div>

        <div className="flex gap-1 mb-6 bg-muted/30 p-1 rounded-lg w-fit flex-wrap" data-testid="tab-bar">
          {tabs.map(tab => (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab(tab.id)}
              data-testid={`tab-${tab.id}`}
            >
              <tab.icon className="h-4 w-4 mr-1" />
              {tab.label}
            </Button>
          ))}
        </div>

        {activeTab === 'overview' && <OverviewTab data={data} ht={ht} />}
        {activeTab === 'hierarchy' && <CrossSystemTab data={data} />}
        {activeTab === 'phases' && <PhaseTab data={data} />}
        {activeTab === 'stability' && <StabilityTab data={data} />}
      </div>
    </div>
  );
}

function OverviewTab({ data, ht }: { data: any; ht: any }) {
  const catChartData = data.categoryStats.filter((c: any) => c.count > 0).map((c: any) => ({
    name: CATEGORY_LABELS[c.category] || c.category,
    category: c.category,
    mean: parseFloat(c.meanEigenvalue.toFixed(4)),
    count: c.count,
    complexPct: c.complexPct,
    r2: parseFloat(c.meanR2.toFixed(3)),
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Core Oscillator |λ|', value: ht.coreVsAll.coreMean.toFixed(4), sub: `n=${data.categoryStats.find((c: any) => c.category === 'core_oscillator')?.count || 0}`, color: 'text-amber-400' },
          { label: 'All Targets |λ|', value: ht.coreVsAll.otherMean.toFixed(4), sub: 'metabolic + cell cycle + ribosomal + other', color: 'text-blue-400' },
          { label: 'Gap (Core − Targets)', value: ht.coreVsAll.gap.toFixed(4), sub: `p = ${ht.coreVsAll.pValue.toExponential(2)}`, color: ht.coreVsAll.gap > 0 ? 'text-emerald-400' : 'text-red-400' },
          { label: 'Hierarchy %', value: `${ht.coreVsAll.hierarchyPct}%`, sub: `Cohen's d = ${ht.coreVsAll.effectSize.toFixed(3)}`, color: ht.coreVsAll.hierarchyPct > 50 ? 'text-emerald-400' : 'text-red-400' },
        ].map((stat, i) => (
          <Card key={i} className="bg-card/50 border-border/50">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1">{stat.label}</div>
              <div className={`text-2xl font-bold font-mono ${stat.color}`} data-testid={`stat-${i}`}>{stat.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{stat.sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Mean |λ| by Gene Category</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[350px]">
            <ResponsiveContainer>
              <BarChart data={catChartData} layout="vertical" margin={{ left: 130, right: 30, top: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis type="number" domain={[0, 'auto']} tick={{ fill: '#6b7280', fontSize: 12 }} label={{ value: '|λ| eigenvalue modulus', position: 'insideBottom', offset: -5, fill: '#6b7280' }} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#4b5563', fontSize: 12 }} width={120} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333' }}
                  formatter={(value: any, _: any, props: any) => [
                    `${value} (n=${props.payload.count}, ${props.payload.complexPct}% oscillatory, R²=${props.payload.r2})`,
                    'Mean |λ|'
                  ]}
                />
                <Bar dataKey="mean" radius={[0, 4, 4, 0]}>
                  {catChartData.map((entry: any, idx: number) => (
                    <Cell key={idx} fill={CATEGORY_COLORS[entry.category] || '#6b7280'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Pairwise Hierarchy Tests</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-hierarchy-tests">
              <thead>
                <tr className="border-b border-border/50 text-muted-foreground">
                  <th className="text-left py-2 px-3">Comparison</th>
                  <th className="text-right py-2 px-3">Core Mean</th>
                  <th className="text-right py-2 px-3">Target Mean</th>
                  <th className="text-right py-2 px-3">Gap</th>
                  <th className="text-right py-2 px-3">Cohen's d</th>
                  <th className="text-right py-2 px-3">p-value</th>
                  <th className="text-right py-2 px-3">Hierarchy %</th>
                  <th className="text-center py-2 px-3">Sig?</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Core vs Metabolic', d: ht.coreVsMetabolic },
                  { label: 'Core vs Cell Cycle', d: ht.coreVsCellCycle },
                  { label: 'Core vs Ribosomal', d: ht.coreVsRibosomal },
                  { label: 'Core vs All Others', d: ht.coreVsAll },
                ].map((row, i) => (
                  <tr key={i} className="border-b border-border/30 hover:bg-muted/20">
                    <td className="py-2 px-3 font-medium">{row.label}</td>
                    <td className="py-2 px-3 text-right font-mono text-amber-400">{row.d.coreMean.toFixed(4)}</td>
                    <td className="py-2 px-3 text-right font-mono text-blue-400">{(row.d.targetMean ?? row.d.otherMean).toFixed(4)}</td>
                    <td className={`py-2 px-3 text-right font-mono ${row.d.gap > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{row.d.gap > 0 ? '+' : ''}{row.d.gap.toFixed(4)}</td>
                    <td className="py-2 px-3 text-right font-mono">{row.d.effectSize.toFixed(3)}</td>
                    <td className="py-2 px-3 text-right font-mono">{row.d.pValue.toExponential(2)}</td>
                    <td className="py-2 px-3 text-right font-mono">{row.d.hierarchyPct}%</td>
                    <td className="py-2 px-3 text-center">
                      {row.d.pValue < 0.05 && row.d.gap > 0 ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 inline" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-400 inline" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Genome-Wide Eigenvalue Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer>
              <BarChart data={data.genomeWideDistribution.bins} margin={{ left: 20, right: 20, top: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="range" tick={{ fill: '#6b7280', fontSize: 11 }} label={{ value: '|λ| range', position: 'insideBottom', offset: -10, fill: '#6b7280' }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} label={{ value: 'Gene count', angle: -90, position: 'insideLeft', fill: '#6b7280' }} />
                <Tooltip contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333' }} formatter={(v: any, name: string) => [v, name === 'count' ? 'Genes' : name]} />
                <Bar dataKey="count" fill="#4b5563" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Top Core Oscillator Genes by |λ|</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-top-core-genes">
              <thead>
                <tr className="border-b border-border/50 text-muted-foreground">
                  <th className="text-left py-2 px-3">Gene</th>
                  <th className="text-right py-2 px-3">|λ|</th>
                  <th className="text-right py-2 px-3">φ₁</th>
                  <th className="text-right py-2 px-3">φ₂</th>
                  <th className="text-right py-2 px-3">R²</th>
                  <th className="text-center py-2 px-3">Oscillatory</th>
                </tr>
              </thead>
              <tbody>
                {data.categoryStats.find((c: any) => c.category === 'core_oscillator')?.genes.slice(0, 15).map((g: any, i: number) => (
                  <tr key={i} className="border-b border-border/30 hover:bg-muted/20">
                    <td className="py-2 px-3 font-mono font-medium text-amber-400">{g.gene}</td>
                    <td className="py-2 px-3 text-right font-mono">{g.eigenvalue.toFixed(4)}</td>
                    <td className="py-2 px-3 text-right font-mono text-muted-foreground">{g.phi1.toFixed(4)}</td>
                    <td className="py-2 px-3 text-right font-mono text-muted-foreground">{g.phi2.toFixed(4)}</td>
                    <td className="py-2 px-3 text-right font-mono">{g.r2.toFixed(3)}</td>
                    <td className="py-2 px-3 text-center">{g.isComplex ? '~' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CrossSystemTab({ data }: { data: any }) {
  const cs = data.crossSystemComparison;
  const comparisonData = [
    { system: 'Yeast Metabolic (~5h)', gap: parseFloat(cs.yeastCoreVsTarget.gap.toFixed(4)), hierarchy: cs.yeastCoreVsTarget.hierarchyPct, pValue: cs.yeastCoreVsTarget.pValue, color: '#f59e0b' },
    { system: 'Mouse Circadian (~24h)', gap: cs.mammalianClockVsTarget.gap, hierarchy: cs.mammalianClockVsTarget.hierarchyPct, pValue: cs.mammalianClockVsTarget.pValue, color: '#3b82f6' },
  ];

  return (
    <div className="space-y-6">
      <Card className={`border-2 ${cs.principlePreserved ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            {cs.principlePreserved ? (
              <CheckCircle2 className="h-6 w-6 text-emerald-400 mt-1 flex-shrink-0" />
            ) : (
              <XCircle className="h-6 w-6 text-red-400 mt-1 flex-shrink-0" />
            )}
            <div>
              <h3 className="text-lg font-semibold mb-2" data-testid="text-cross-system-verdict">
                {cs.principlePreserved ? 'Cross-Kingdom Hierarchy Preserved' : 'Hierarchy Pattern Differs'}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{cs.interpretation}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {comparisonData.map((sys, i) => (
          <Card key={i} className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-lg" style={{ color: sys.color }}>{sys.system}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Core → Target Gap</span>
                <span className={`font-mono font-bold text-lg ${sys.gap > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{sys.gap > 0 ? '+' : ''}{sys.gap.toFixed(4)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Hierarchy Win %</span>
                <span className="font-mono font-bold text-lg">{sys.hierarchy}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">p-value</span>
                <span className="font-mono text-sm">{sys.pValue.toExponential(2)}</span>
              </div>
              <div className="w-full bg-muted/30 rounded-full h-3 mt-2">
                <div className="h-3 rounded-full" style={{ width: `${sys.hierarchy}%`, backgroundColor: sys.color, opacity: 0.8 }} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Side-by-Side Gap Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer>
              <BarChart data={comparisonData} margin={{ left: 60, right: 30, top: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="system" tick={{ fill: '#4b5563', fontSize: 12 }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} label={{ value: 'Core − Target Gap', angle: -90, position: 'insideLeft', fill: '#6b7280' }} />
                <Tooltip contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333' }} />
                <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
                <Bar dataKey="gap" radius={[4, 4, 0, 0]}>
                  {comparisonData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {cs.sensitivityAnalysis && (
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Sensitivity Analysis: Eigenvalue Filtering</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              To rule out that the negative result is an artifact of eigenvalue filtering ({cs.sensitivityAnalysis.filterCriteria}), 
              we compare results with and without the filter:
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-sensitivity">
                <thead>
                  <tr className="border-b border-border/50 text-muted-foreground">
                    <th className="text-left py-2 px-3">Condition</th>
                    <th className="text-right py-2 px-3">Core n</th>
                    <th className="text-right py-2 px-3">Target n</th>
                    <th className="text-right py-2 px-3">Gap</th>
                    <th className="text-right py-2 px-3">p-value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/30">
                    <td className="py-2 px-3">Filtered (standard)</td>
                    <td className="py-2 px-3 text-right font-mono">{cs.sensitivityAnalysis.filtered.coreN}</td>
                    <td className="py-2 px-3 text-right font-mono">{cs.sensitivityAnalysis.filtered.targetN}</td>
                    <td className="py-2 px-3 text-right font-mono">{cs.sensitivityAnalysis.filtered.gap.toFixed(4)}</td>
                    <td className="py-2 px-3 text-right font-mono">{cs.sensitivityAnalysis.filtered.pValue.toExponential(2)}</td>
                  </tr>
                  <tr className="border-b border-border/30">
                    <td className="py-2 px-3">Unfiltered (all genes)</td>
                    <td className="py-2 px-3 text-right font-mono">{cs.sensitivityAnalysis.unfiltered.coreN}</td>
                    <td className="py-2 px-3 text-right font-mono">{cs.sensitivityAnalysis.unfiltered.targetN}</td>
                    <td className="py-2 px-3 text-right font-mono">{cs.sensitivityAnalysis.unfiltered.gap.toFixed(4)}</td>
                    <td className="py-2 px-3 text-right font-mono">{cs.sensitivityAnalysis.unfiltered.pValue.toExponential(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              {cs.sensitivityAnalysis.filteredOut} genes filtered out. {cs.sensitivityAnalysis.conclusion}
            </p>
            <div className="flex items-center gap-2 flex-wrap mt-2">
              <EvidenceLink label="AR(1) benchmark & controls" to="/supplementary-analyses" />
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">What This Tells Us</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-3">
          <p>The yeast metabolic cycle and the mammalian circadian clock are fundamentally different systems:</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Different organisms', detail: 'Yeast (unicellular fungus) vs Mouse (multicellular mammal) — ~1 billion years of evolutionary divergence' },
              { label: 'Different mechanisms', detail: 'Metabolic oscillator (redox state, oxygen cycling) vs Transcription-translation feedback loop (CLOCK/BMAL1)' },
              { label: 'Different timescales', detail: '~5 hour metabolic cycle vs ~24 hour circadian cycle — 5× different period length' },
            ].map((item, i) => (
              <div key={i} className="p-3 bg-muted/20 rounded-lg">
                <div className="font-semibold text-foreground mb-1">{item.label}</div>
                <div className="text-xs">{item.detail}</div>
              </div>
            ))}
          </div>
          {cs.principlePreserved ? (
            <p className="mt-4">
              The hierarchy is preserved across kingdoms, suggesting it is a 
              <strong className="text-foreground"> universal mathematical property of biological oscillator networks</strong>.
            </p>
          ) : (
            <div className="mt-4 space-y-2">
              <p>
                The hierarchy is <strong className="text-foreground">NOT preserved</strong> in the yeast metabolic cycle. 
                This is actually an informative negative result — it tells us the eigenvalue hierarchy is 
                <strong className="text-foreground"> specific to transcription-translation feedback loop (TTFL) oscillators</strong>, 
                not a universal property of all biological oscillators.
              </p>
              <p>
                The mammalian circadian clock has dedicated "clock genes" (BMAL1, CLOCK, PERs, CRYs) whose expression 
                dynamics are fundamentally different from downstream targets — they are the oscillator. In yeast, 
                the metabolic cycle is driven by shared metabolic state (redox cycling, oxygen levels), and the 
                transcription factors respond to that state rather than generating it. This explains why yeast 
                "core" TFs don't show higher persistence than their targets.
              </p>
              <p>
                <strong className="text-foreground">This strengthens the mammalian circadian finding</strong> by showing 
                the hierarchy is not a trivial artifact of any oscillatory system — it requires the specific architecture 
                of a dedicated TTFL.
              </p>
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap mt-2">
            <EvidenceLink label="Cross-context validation" to="/cross-context-validation" hash="hierarchy-summary" />
            <EvidenceLink label="Model zoo validation" to="/model-zoo" hash="round-trip" />
          </div>
          {cs.mammalianClockVsTarget.source && (
            <p className="text-xs text-muted-foreground/70 mt-2">
              Mammalian reference: {cs.mammalianClockVsTarget.source}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PhaseTab({ data }: { data: any }) {
  const phaseColors: Record<string, string> = { OX: '#f59e0b', RB: '#3b82f6', RC: '#8b5cf6' };

  const phaseChartData = data.phaseAnalysis.map((p: any) => ({
    phase: p.phase,
    meanEig: parseFloat(p.meanEigenvalue.toFixed(4)),
    genes: p.genes,
    color: phaseColors[p.phase] || '#6b7280',
  }));

  return (
    <div className="space-y-6">
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">YMC Phase-Specific Eigenvalue Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            The yeast metabolic cycle has three phases: OX (oxidative — respiration), 
            RB (reductive-building — DNA replication, growth), and RC (reductive-charging — stress response, fermentation).
            Each phase has characteristic genes. Do their AR(2) eigenvalues differ?
          </p>
          <div className="h-[300px]">
            <ResponsiveContainer>
              <BarChart data={phaseChartData} margin={{ left: 60, right: 30, top: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="phase" tick={{ fill: '#4b5563', fontSize: 14 }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} label={{ value: 'Mean |λ|', angle: -90, position: 'insideLeft', fill: '#6b7280' }} />
                <Tooltip contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333' }} formatter={(v: any, _: any, props: any) => [`${v} (n=${props.payload.genes})`, 'Mean |λ|']} />
                <Bar dataKey="meanEig" radius={[4, 4, 0, 0]}>
                  {phaseChartData.map((entry: any, idx: number) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {data.phaseAnalysis.map((phase: any, pi: number) => (
        <Card key={pi} className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="text-lg" style={{ color: phaseColors[phase.phase] }}>
              {phase.phase} Phase — {phase.description}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-3 text-sm text-muted-foreground">
              <span>Genes found: {phase.genes}</span>
              <span>Mean |λ|: <span className="font-mono text-foreground">{phase.meanEigenvalue.toFixed(4)}</span></span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid={`table-phase-${phase.phase}`}>
                <thead>
                  <tr className="border-b border-border/50 text-muted-foreground">
                    <th className="text-left py-2 px-3">Gene</th>
                    <th className="text-right py-2 px-3">|λ|</th>
                    <th className="text-left py-2 px-3">Category</th>
                  </tr>
                </thead>
                <tbody>
                  {phase.topGenes.map((g: any, i: number) => (
                    <tr key={i} className="border-b border-border/30 hover:bg-muted/20">
                      <td className="py-1.5 px-3 font-mono font-medium" style={{ color: CATEGORY_COLORS[g.category] || '#6b7280' }}>{g.gene}</td>
                      <td className="py-1.5 px-3 text-right font-mono">{g.eigenvalue.toFixed(4)}</td>
                      <td className="py-1.5 px-3 text-muted-foreground">{CATEGORY_LABELS[g.category] || g.category}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function StabilityTab({ data }: { data: any }) {
  const rw = data.rollingWindowStability;
  const windowData = rw.windows.map((w: any, i: number) => ({
    label: `T${w.start}-T${w.end}`,
    core: parseFloat(w.coreEig.toFixed(4)),
    target: parseFloat(w.targetEig.toFixed(4)),
    gap: parseFloat(w.gap.toFixed(4)),
    hierarchy: w.hierarchyPct,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Window Size</div>
            <div className="text-2xl font-bold font-mono">{rw.windowSize} timepoints</div>
            <div className="text-xs text-muted-foreground mt-1">~1 metabolic cycle per window</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Gap CV</div>
            <div className={`text-2xl font-bold font-mono ${rw.gapCV < 0.5 ? 'text-emerald-400' : rw.gapCV < 1.0 ? 'text-amber-400' : 'text-red-400'}`}>
              {(rw.gapCV * 100).toFixed(1)}%
            </div>
            <div className="text-xs text-muted-foreground mt-1">{rw.stable ? 'Stable across windows' : 'Variable across windows'}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Stability</div>
            <div className="flex items-center gap-2">
              {rw.stable ? (
                <><CheckCircle2 className="h-6 w-6 text-emerald-400" /><span className="text-lg font-semibold text-emerald-400">Stable</span></>
              ) : (
                <><XCircle className="h-6 w-6 text-amber-400" /><span className="text-lg font-semibold text-amber-400">Variable</span></>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Rolling Window: Core vs Target |λ|</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[350px]">
            <ResponsiveContainer>
              <LineChart data={windowData} margin={{ left: 60, right: 30, top: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 11 }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} label={{ value: 'Mean |λ|', angle: -90, position: 'insideLeft', fill: '#6b7280' }} />
                <Tooltip contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333' }} />
                <Line type="monotone" dataKey="core" stroke="#f59e0b" strokeWidth={2} name="Core Oscillator" dot={{ r: 4 }} />
                <Line type="monotone" dataKey="target" stroke="#3b82f6" strokeWidth={2} name="Targets" dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Gap & Hierarchy % per Window</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-rolling-windows">
              <thead>
                <tr className="border-b border-border/50 text-muted-foreground">
                  <th className="text-left py-2 px-3">Window</th>
                  <th className="text-right py-2 px-3">Core |λ|</th>
                  <th className="text-right py-2 px-3">Target |λ|</th>
                  <th className="text-right py-2 px-3">Gap</th>
                  <th className="text-right py-2 px-3">Hierarchy %</th>
                </tr>
              </thead>
              <tbody>
                {windowData.map((w: any, i: number) => (
                  <tr key={i} className="border-b border-border/30 hover:bg-muted/20">
                    <td className="py-2 px-3 font-mono">{w.label}</td>
                    <td className="py-2 px-3 text-right font-mono text-amber-400">{w.core}</td>
                    <td className="py-2 px-3 text-right font-mono text-blue-400">{w.target}</td>
                    <td className={`py-2 px-3 text-right font-mono ${w.gap > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{w.gap > 0 ? '+' : ''}{w.gap}</td>
                    <td className="py-2 px-3 text-right font-mono">{w.hierarchy}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
