import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertTriangle, Shield, Beaker, ArrowLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadAsCSV } from "@/components/DownloadResultsButton";
import { Link } from "wouter";
import { useState } from "react";

function StatusBadge({ pass, gapDirection }: { pass: boolean; gapDirection?: string }) {
  if (pass && gapDirection === 'inverted') {
    return <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30"><AlertTriangle size={12} className="mr-1" />INVERTED</Badge>;
  }
  return pass
    ? <Badge className="bg-emerald-500/20 text-emerald-600 border-emerald-500/30"><CheckCircle2 size={12} className="mr-1" />PASS</Badge>
    : <Badge className="bg-red-500/20 text-red-600 border-red-500/30"><XCircle size={12} className="mr-1" />FAIL</Badge>;
}

function DSIBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value * 100));
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono w-12 text-right">{value.toFixed(3)}</span>
    </div>
  );
}

export default function DecompositionStability() {
  const { data, isLoading, error } = useQuery<any>({
    queryKey: ['/api/decomposition-stability'],
    staleTime: Infinity,
  });

  const [expandedDataset, setExpandedDataset] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="loading-state">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Running decomposition stability analysis across {'>'}10 datasets and 6 methods...</p>
          <p className="text-xs text-muted-foreground mt-1">This may take 30-60 seconds on first load</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-500" data-testid="error-state">Failed to load decomposition stability analysis</p>
      </div>
    );
  }

  const verdictColor = data.verdict?.startsWith('STRONG') ? 'text-emerald-600' : data.verdict?.startsWith('MODERATE') ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/robustness-suite">
            <span className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer mb-3">
              <ArrowLeft size={14} /> Back to Robustness Suite
            </span>
          </Link>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground" data-testid="page-title">
                <Shield className="inline mr-2 mb-1" size={28} />
                Decomposition Stability Analysis
              </h1>
              <p className="text-muted-foreground mt-2">
                Tests whether the clock {'>'} target eigenvalue hierarchy survives under 6 different global driver removal methods.
                This is the single most important robustness check — if the hierarchy depends on how you preprocess the data, it could be an artifact.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 text-xs"
              onClick={() => {
                const rows: any[] = [];
                (data.datasets || []).forEach((ds: any) => {
                  (data.methods || []).forEach((m: any) => {
                    const mr = ds.methods?.[m.key];
                    if (!mr) return;
                    rows.push({
                      dataset: ds.label,
                      tissue: ds.tissue,
                      n_genes: ds.nGenes,
                      n_timepoints: ds.nTimepoints,
                      method: m.name,
                      clock_mean_lambda: mr.clockMean,
                      target_mean_lambda: mr.targetMean,
                      gap: mr.gap,
                      clock_n: mr.clockN,
                      target_n: mr.targetN,
                      hierarchy_preserved: mr.gap > 0,
                      dataset_dsi: ds.dsi,
                      dataset_gap_preserved: ds.gapPreserved,
                    });
                  });
                });
                downloadAsCSV(rows, 'decomposition_stability_results.csv');
              }}
              data-testid="button-download-decomp-csv"
            >
              <Download size={13} className="mr-1" /> Download CSV
            </Button>
          </div>
        </div>

        <Card className="mb-6" data-testid="verdict-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              Overall Verdict
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-lg font-semibold ${verdictColor} mb-4`} data-testid="verdict-text">{data.verdict}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-foreground" data-testid="stat-dsi">{data.overallDSI?.toFixed(3)}</div>
                <div className="text-xs text-muted-foreground">Decomposition Stability Index</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-foreground" data-testid="stat-rank-corr">{data.overallRankCorrelation?.toFixed(3)}</div>
                <div className="text-xs text-muted-foreground">Mean Rank Correlation</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-foreground" data-testid="stat-gap-preserved">{data.correctDirectionCount ?? data.gapPreservedCount}/{data.gapPreservedTotal}</div>
                <div className="text-xs text-muted-foreground">Clock &gt; Target Direction</div>
                {data.invertedCount > 0 && <div className="text-xs text-amber-600">{data.invertedCount} inverted</div>}
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-foreground">{data.methods?.length}</div>
                <div className="text-xs text-muted-foreground">Methods Tested</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Mathematical Specification</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div>
                <span className="font-semibold text-foreground">Global Driver Definition:</span>
                <p className="text-muted-foreground font-mono text-xs mt-1">{data.specification?.globalDriverDefinition}</p>
              </div>
              <div>
                <span className="font-semibold text-foreground">Removal Equation:</span>
                <p className="text-muted-foreground font-mono text-xs mt-1">{data.specification?.removalEquation}</p>
              </div>
              <div>
                <span className="font-semibold text-foreground">Pseudocode:</span>
                <div className="bg-muted/50 rounded p-3 mt-1">
                  {data.specification?.pseudocode?.map((line: string, i: number) => (
                    <div key={i} className="font-mono text-xs text-muted-foreground">{line}</div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Methods Compared</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-methods">
                <thead>
                  <tr className="text-muted-foreground border-b">
                    <th className="text-left py-2 px-3">Method</th>
                    <th className="text-left py-2 px-3">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {data.methods?.map((m: any) => (
                    <tr key={m.key} className="border-b border-muted/50">
                      <td className="py-2 px-3 font-mono text-xs font-medium">{m.name}</td>
                      <td className="py-2 px-3 text-xs text-muted-foreground">{m.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <h2 className="text-xl font-bold mb-4 text-foreground">Dataset Results</h2>

        <div className="space-y-4 mb-8">
          {data.datasets?.map((ds: any) => (
            <Card key={ds.dataset} data-testid={`dataset-${ds.tissue}`}>
              <CardHeader className="pb-2 cursor-pointer" onClick={() => setExpandedDataset(expandedDataset === ds.dataset ? null : ds.dataset)}>
                <CardTitle className="text-base flex items-center justify-between">
                  <span>{ds.label} <span className="text-xs text-muted-foreground ml-2">({ds.nGenes.toLocaleString()} genes, {ds.nTimepoints} timepoints)</span></span>
                  <div className="flex items-center gap-3">
                    <StatusBadge pass={ds.gapPreserved} gapDirection={ds.gapDirection} />
                    <DSIBar value={ds.dsi} />
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto mb-4">
                  <table className="w-full text-xs" data-testid={`table-gaps-${ds.tissue}`}>
                    <thead>
                      <tr className="text-muted-foreground border-b">
                        <th className="text-left py-1.5 px-2">Method</th>
                        <th className="text-right py-1.5 px-2">Clock Mean |λ|</th>
                        <th className="text-right py-1.5 px-2">Target Mean |λ|</th>
                        <th className="text-right py-1.5 px-2">Gap</th>
                        <th className="text-right py-1.5 px-2">Clock N</th>
                        <th className="text-right py-1.5 px-2">Target N</th>
                        <th className="text-center py-1.5 px-2">Hierarchy</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.methods?.map((m: any) => {
                        const mr = ds.methods?.[m.key];
                        if (!mr) return null;
                        const positive = mr.gap > 0;
                        return (
                          <tr key={m.key} className="border-b border-muted/30">
                            <td className="py-1.5 px-2 font-mono">{m.name}</td>
                            <td className="py-1.5 px-2 text-right font-mono">{mr.clockMean.toFixed(4)}</td>
                            <td className="py-1.5 px-2 text-right font-mono">{mr.targetMean.toFixed(4)}</td>
                            <td className={`py-1.5 px-2 text-right font-mono font-semibold ${positive ? 'text-emerald-600' : 'text-red-600'}`}>{mr.gap > 0 ? '+' : ''}{mr.gap.toFixed(4)}</td>
                            <td className="py-1.5 px-2 text-right font-mono">{mr.clockN}</td>
                            <td className="py-1.5 px-2 text-right font-mono">{mr.targetN}</td>
                            <td className="py-1.5 px-2 text-center">
                              {positive ? <CheckCircle2 size={12} className="text-emerald-500 inline" /> : <XCircle size={12} className="text-red-500 inline" />}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>Gap CV: <span className="font-mono font-semibold">{ds.gapCV?.toFixed(4)}</span></span>
                  <span>DSI: <span className="font-mono font-semibold">{ds.dsi?.toFixed(3)}</span></span>
                  <span>Gap direction: <span className={
                    ds.gapDirection === 'correct' ? 'text-emerald-600 font-semibold' :
                    ds.gapDirection === 'inverted' ? 'text-amber-600 font-semibold' :
                    'text-red-600 font-semibold'
                  }>{
                    ds.gapDirection === 'correct' ? 'Clock > Target (✓)' :
                    ds.gapDirection === 'inverted' ? 'Target > Clock (inverted)' :
                    'Mixed'
                  }</span></span>
                  <span>Consistent across methods: <span className={ds.gapPreserved ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'}>{ds.gapPreserved ? 'Yes' : 'No'}</span></span>
                </div>
                {ds.gapDirection === 'inverted' && (
                  <div className="mt-3 p-3 rounded-md bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-400">
                    <strong>Inverted hierarchy note:</strong> The 23-gene target panel is more temporally persistent than the 13 clock genes in this dataset across all preprocessing methods. This reflects the specific gene set comparison used here — several target-panel genes (WEE1, HIF1A, SIRT1, BCL2, ATM, TP53) have high intrinsic persistence in this biological context. The published gap for this dataset (+0.333, p=0.0003) is measured by comparing clock genes against the <em>genome-wide background</em> of all genes, not against this curated target panel, so there is no contradiction with the reported results.
                  </div>
                )}

                {expandedDataset === ds.dataset && (
                  <div className="mt-4 pt-4 border-t border-muted/50">
                    <h4 className="text-sm font-semibold mb-2 text-foreground">Rank Correlations Between Methods</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-muted-foreground border-b">
                            <th className="text-left py-1 px-2">Method 1</th>
                            <th className="text-left py-1 px-2">Method 2</th>
                            <th className="text-right py-1 px-2">Spearman ρ</th>
                            <th className="text-center py-1 px-2">≥ 0.85</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ds.rankCorrelations?.map((rc: any, i: number) => (
                            <tr key={i} className="border-b border-muted/30">
                              <td className="py-1 px-2 font-mono">{rc.method1}</td>
                              <td className="py-1 px-2 font-mono">{rc.method2}</td>
                              <td className="py-1 px-2 text-right font-mono">{rc.rho.toFixed(4)}</td>
                              <td className="py-1 px-2 text-center">
                                {rc.rho >= 0.85 ? <CheckCircle2 size={12} className="text-emerald-500 inline" /> : <AlertTriangle size={12} className="text-amber-500 inline" />}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {ds.geneResults?.length > 0 && (
                      <div className="mt-4">
                        <h4 className="text-sm font-semibold mb-2 text-foreground">Per-Gene Eigenvalues Across Methods</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-muted-foreground border-b">
                                <th className="text-left py-1 px-2">Gene</th>
                                <th className="text-left py-1 px-2">Category</th>
                                {data.methods?.map((m: any) => (
                                  <th key={m.key} className="text-right py-1 px-2">{m.key}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {ds.geneResults?.slice(0, 30).map((g: any) => (
                                <tr key={g.gene} className="border-b border-muted/30">
                                  <td className="py-1 px-2 font-mono font-medium">{g.gene}</td>
                                  <td className="py-1 px-2">
                                    <Badge variant="outline" className={`text-[10px] ${g.category === 'clock' ? 'border-amber-500/50 text-amber-600' : 'border-red-500/50 text-red-600'}`}>
                                      {g.category}
                                    </Badge>
                                  </td>
                                  {data.methods?.map((m: any) => (
                                    <td key={m.key} className="py-1 px-2 text-right font-mono">
                                      {g.eigenvalues?.[m.key]?.toFixed(4) || '—'}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <h2 className="text-xl font-bold mb-4 text-foreground flex items-center gap-2">
          <Beaker size={20} />
          Simulation Benchmarks
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Synthetic datasets with known structure test whether decomposition recovers true hierarchy and avoids introducing false structure.
        </p>

        <div className="space-y-4 mb-8">
          {data.simulations?.map((sim: any, i: number) => (
            <Card key={i} data-testid={`sim-${i}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>{sim.scenario}</span>
                  <div className="flex gap-2">
                    <StatusBadge pass={sim.structureRecovered} />
                    {sim.falseInflation && <Badge className="bg-red-500/20 text-red-600 border-red-500/30"><AlertTriangle size={12} className="mr-1" />FALSE INFLATION</Badge>}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">{sim.description}</p>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="text-center p-2 rounded bg-muted/50">
                    <div className="font-mono text-sm font-bold">{sim.trueClockMean?.toFixed(4)}</div>
                    <div className="text-[10px] text-muted-foreground">True Clock Mean</div>
                  </div>
                  <div className="text-center p-2 rounded bg-muted/50">
                    <div className="font-mono text-sm font-bold">{sim.truetargetMean?.toFixed(4)}</div>
                    <div className="text-[10px] text-muted-foreground">True Target Mean</div>
                  </div>
                  <div className="text-center p-2 rounded bg-muted/50">
                    <div className={`font-mono text-sm font-bold ${sim.trueGap > 0 ? 'text-emerald-600' : sim.trueGap < -0.01 ? 'text-red-600' : 'text-muted-foreground'}`}>
                      {sim.trueGap > 0 ? '+' : ''}{sim.trueGap?.toFixed(4)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">True Gap</div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-muted-foreground border-b">
                        <th className="text-left py-1 px-2">Method</th>
                        <th className="text-right py-1 px-2">Recovered Gap</th>
                        <th className="text-right py-1 px-2">Rank ρ (true vs recovered)</th>
                        <th className="text-center py-1 px-2">Correct Sign</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.methods?.map((m: any) => {
                        const gap = sim.recoveredGaps?.[m.key];
                        const rho = sim.recoveredRankCorrelations?.[m.key];
                        const correctSign = gap !== undefined && sim.trueGap !== undefined
                          ? (Math.abs(sim.trueGap) < 0.01 ? Math.abs(gap) < 0.15 : Math.sign(gap) === Math.sign(sim.trueGap))
                          : false;
                        return (
                          <tr key={m.key} className="border-b border-muted/30">
                            <td className="py-1 px-2 font-mono">{m.name}</td>
                            <td className={`py-1 px-2 text-right font-mono ${gap > 0 ? 'text-emerald-600' : gap < -0.01 ? 'text-red-600' : ''}`}>
                              {gap !== undefined ? (gap > 0 ? '+' : '') + gap.toFixed(4) : '—'}
                            </td>
                            <td className="py-1 px-2 text-right font-mono">{rho !== undefined ? rho.toFixed(4) : '—'}</td>
                            <td className="py-1 px-2 text-center">
                              {correctSign ? <CheckCircle2 size={12} className="text-emerald-500 inline" /> : <XCircle size={12} className="text-red-500 inline" />}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mb-8">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Acceptance Criteria</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {[
                { criterion: 'Hierarchy rank correlation ≥ 0.85 across decomposition variants', pass: data.overallRankCorrelation >= 0.85 },
                { criterion: `Clock > target gap direction correct in all datasets (${data.invertedCount > 0 ? `${data.invertedCount} inverted — see dataset notes` : 'all correct'})`, pass: (data.correctDirectionCount ?? data.gapPreservedCount) === data.gapPreservedTotal },
                { criterion: 'No false hierarchy inflation under null simulations', pass: data.simulations?.every((s: any) => !s.falseInflation) },
                { criterion: 'True structure recovered after driver removal in simulations', pass: data.simulations?.filter((s: any) => s.structureRecovered).length >= 3 },
              ].map((c, i) => (
                <div key={i} className="flex items-center gap-2" data-testid={`criterion-${i}`}>
                  {c.pass ? <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" /> : <XCircle size={14} className="text-red-500 flex-shrink-0" />}
                  <span className={c.pass ? 'text-foreground' : 'text-muted-foreground'}>{c.criterion}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
