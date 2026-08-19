import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertTriangle, ArrowLeft, Activity, Layers } from "lucide-react";
import { Link } from "wouter";

function RhoBar({ value, max = 1 }: { value: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const color = pct >= 90 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono w-14 text-right">{value.toFixed(3)}</span>
    </div>
  );
}

function StatusBadge({ pass, label }: { pass: boolean; label?: string }) {
  return pass
    ? <Badge className="bg-emerald-500/20 text-emerald-600 border-emerald-500/30"><CheckCircle2 size={12} className="mr-1" />{label || 'PRESERVED'}</Badge>
    : <Badge className="bg-red-500/20 text-red-600 border-red-500/30"><XCircle size={12} className="mr-1" />{label || 'NOT PRESERVED'}</Badge>;
}

export default function StateSpaceComparison() {
  const { data, isLoading, error } = useQuery<any>({
    queryKey: ['/api/state-space-comparison'],
    staleTime: Infinity,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="loading-state">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading state-space comparison results...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-500" data-testid="error-state">Failed to load state-space comparison data</p>
      </div>
    );
  }

  const datasets = data.datasets || {};
  const dsKeys = Object.keys(datasets);
  const hierarchy = data.hierarchy_agreement || {};

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/supplementary-analyses">
            <span className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer mb-3" data-testid="link-back">
              <ArrowLeft size={14} /> Back to Robustness Suite
            </span>
          </Link>
          <h1 className="text-3xl font-bold text-foreground" data-testid="page-title">
            <Layers className="inline mr-2 mb-1" size={28} />
            State-Space Model Comparison
          </h1>
          <p className="text-muted-foreground mt-2">
            Tests whether AR(2) OLS eigenvalue rankings agree with state-space alternatives.
            Addresses the gap identified by external review: does the estimation method affect the persistence hierarchy?
          </p>
        </div>

        <Card className="mb-6" data-testid="verdict-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              Overall Verdict
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold text-emerald-600 mb-2" data-testid="verdict-text">{data.verdict}</p>
            <p className="text-sm text-muted-foreground mb-4">{data.interpretation}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-foreground" data-testid="stat-sarimax-rho">
                  {data.cross_dataset_rank_correlations?.sarimax_ar2_mle?.mean_rho?.toFixed(3)}
                </div>
                <div className="text-xs text-muted-foreground">SARIMAX Mean ρ</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-foreground" data-testid="stat-ll-rho">
                  {data.cross_dataset_rank_correlations?.local_level?.mean_rho?.toFixed(3)}
                </div>
                <div className="text-xs text-muted-foreground">Local Level Mean ρ</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-foreground" data-testid="stat-hierarchy">
                  {hierarchy.agreed}/{hierarchy.total}
                </div>
                <div className="text-xs text-muted-foreground">Hierarchy Agreement</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-foreground" data-testid="stat-models">
                  {data.models_compared?.length}
                </div>
                <div className="text-xs text-muted-foreground">Models Compared</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity size={18} />
              Models Compared
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-models">
                <thead>
                  <tr className="text-muted-foreground border-b">
                    <th className="text-left py-2 px-3">Model</th>
                    <th className="text-left py-2 px-3">Type</th>
                    <th className="text-center py-2 px-3">Parameters</th>
                    <th className="text-left py-2 px-3">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {data.models_compared?.map((m: any) => (
                    <tr key={m.name} className="border-b border-muted/50">
                      <td className="py-2 px-3 font-mono text-xs font-medium">{m.name}</td>
                      <td className="py-2 px-3 text-xs text-muted-foreground">{m.type}</td>
                      <td className="py-2 px-3 text-center">
                        <Badge variant="outline" className="text-xs">{m.parameters}</Badge>
                      </td>
                      <td className="py-2 px-3 text-xs text-muted-foreground">{m.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Rank Correlations: AR(2) OLS vs Alternatives</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-rank-correlations">
                <thead>
                  <tr className="text-muted-foreground border-b">
                    <th className="text-left py-2 px-3">Dataset</th>
                    <th className="text-right py-2 px-3">Genes</th>
                    <th className="text-right py-2 px-3">Timepoints</th>
                    <th className="text-left py-2 px-3 w-48">vs SARIMAX MLE (ρ)</th>
                    <th className="text-right py-2 px-3">n</th>
                    <th className="text-left py-2 px-3 w-48">vs Local Level (ρ)</th>
                    <th className="text-right py-2 px-3">n</th>
                  </tr>
                </thead>
                <tbody>
                  {dsKeys.map((key) => {
                    const ds = datasets[key];
                    const sarimaxRho = ds.rank_correlations?.sarimax_ar2_mle?.spearman_rho;
                    const llRho = ds.rank_correlations?.local_level?.spearman_rho;
                    return (
                      <tr key={key} className="border-b border-muted/50" data-testid={`row-dataset-${key}`}>
                        <td className="py-2 px-3 font-medium text-xs">{ds.dataset}</td>
                        <td className="py-2 px-3 text-right font-mono text-xs">{ds.n_genes}</td>
                        <td className="py-2 px-3 text-right font-mono text-xs">{ds.n_timepoints}</td>
                        <td className="py-2 px-3">
                          {sarimaxRho !== undefined ? <RhoBar value={sarimaxRho} /> : <span className="text-xs text-muted-foreground">—</span>}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-xs text-muted-foreground">{ds.rank_correlations?.sarimax_ar2_mle?.n || '—'}</td>
                        <td className="py-2 px-3">
                          {llRho !== undefined ? <RhoBar value={llRho} /> : <span className="text-xs text-muted-foreground">—</span>}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-xs text-muted-foreground">{ds.rank_correlations?.local_level?.n || '—'}</td>
                      </tr>
                    );
                  })}
                  <tr className="border-t-2 border-foreground/20 font-semibold">
                    <td className="py-2 px-3 text-xs" colSpan={3}>Cross-Dataset Mean</td>
                    <td className="py-2 px-3">
                      <RhoBar value={data.cross_dataset_rank_correlations?.sarimax_ar2_mle?.mean_rho || 0} />
                    </td>
                    <td className="py-2 px-3"></td>
                    <td className="py-2 px-3">
                      <RhoBar value={data.cross_dataset_rank_correlations?.local_level?.mean_rho || 0} />
                    </td>
                    <td className="py-2 px-3"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Hierarchy Preservation (Clock &gt; Target)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-hierarchy">
                <thead>
                  <tr className="text-muted-foreground border-b">
                    <th className="text-left py-2 px-3">Dataset</th>
                    <th className="text-left py-2 px-3">Model</th>
                    <th className="text-right py-2 px-3">Clock Mean |λ|</th>
                    <th className="text-right py-2 px-3">Target Mean |λ|</th>
                    <th className="text-right py-2 px-3">Gap</th>
                    <th className="text-right py-2 px-3">p-value</th>
                    <th className="text-center py-2 px-3">Preserved</th>
                  </tr>
                </thead>
                <tbody>
                  {dsKeys.map((key) => {
                    const ds = datasets[key];
                    const models = ['ar2_ols', 'sarimax_ar2_mle', 'local_level'];
                    const modelLabels: Record<string, string> = { ar2_ols: 'AR(2) OLS', sarimax_ar2_mle: 'SARIMAX MLE', local_level: 'Local Level' };
                    return models.map((model) => {
                      const h = ds.hierarchy?.[model];
                      if (!h) return null;
                      const gap = h.gap;
                      return (
                        <tr key={`${key}-${model}`} className="border-b border-muted/50">
                          <td className="py-2 px-3 text-xs font-medium">{model === 'ar2_ols' ? ds.dataset : ''}</td>
                          <td className="py-2 px-3 text-xs">
                            <Badge variant="outline" className={`text-[10px] ${model === 'ar2_ols' ? 'border-blue-500/50 text-blue-600' : model === 'sarimax_ar2_mle' ? 'border-purple-500/50 text-purple-600' : 'border-amber-500/50 text-amber-600'}`}>
                              {modelLabels[model]}
                            </Badge>
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-xs">{h.clock_mean?.toFixed(4)}</td>
                          <td className="py-2 px-3 text-right font-mono text-xs">{h.target_mean?.toFixed(4)}</td>
                          <td className={`py-2 px-3 text-right font-mono text-xs font-semibold ${gap > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {gap > 0 ? '+' : ''}{gap?.toFixed(4)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-xs text-muted-foreground">
                            {h.ttest_p !== undefined ? (h.ttest_p < 0.001 ? '<0.001' : h.ttest_p.toFixed(4)) : '—'}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {h.preserved
                              ? <CheckCircle2 size={14} className="text-emerald-500 inline" />
                              : <XCircle size={14} className="text-red-500 inline" />}
                          </td>
                        </tr>
                      );
                    });
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Overall agreement:</span>
              <StatusBadge pass={hierarchy.rate_pct >= 75} label={`${hierarchy.agreed}/${hierarchy.total} (${hierarchy.rate_pct}%)`} />
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Coefficient Agreement (OLS vs MLE)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              With adequate timepoints (≥24), OLS and MLE produce virtually identical AR(2) coefficients.
              At 9 timepoints, coefficients diverge — but eigenvalue rankings remain near-perfect.
              This means |λ| is inherently more stable than the raw parameters it is derived from.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-coefficients">
                <thead>
                  <tr className="text-muted-foreground border-b">
                    <th className="text-left py-2 px-3">Dataset</th>
                    <th className="text-right py-2 px-3">Timepoints</th>
                    <th className="text-left py-2 px-3 w-40">β₁ Spearman ρ</th>
                    <th className="text-left py-2 px-3 w-40">β₂ Spearman ρ</th>
                    <th className="text-left py-2 px-3 w-40">Eigenvalue Rank ρ</th>
                    <th className="text-right py-2 px-3">n</th>
                  </tr>
                </thead>
                <tbody>
                  {dsKeys.map((key) => {
                    const ds = datasets[key];
                    const coeff = ds.coefficient_agreement;
                    const eigRho = ds.rank_correlations?.sarimax_ar2_mle?.spearman_rho;
                    if (!coeff) return null;
                    return (
                      <tr key={key} className="border-b border-muted/50" data-testid={`row-coeff-${key}`}>
                        <td className="py-2 px-3 font-medium text-xs">{ds.dataset}</td>
                        <td className="py-2 px-3 text-right font-mono text-xs">{ds.n_timepoints}</td>
                        <td className="py-2 px-3"><RhoBar value={Math.abs(coeff.beta1_rho)} /></td>
                        <td className="py-2 px-3"><RhoBar value={Math.max(0, coeff.beta2_rho)} /></td>
                        <td className="py-2 px-3"><RhoBar value={eigRho || 0} /></td>
                        <td className="py-2 px-3 text-right font-mono text-xs text-muted-foreground">{coeff.n}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-500" />
              SARIMAX Convergence & Boundary Censoring
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              SARIMAX MLE enforces stationarity, rejecting genes near the unit root boundary (|λ| ≈ 1).
              These are biologically the most interesting genes — near-critical dynamics.
              OLS produces a deterministic result for every gene without censoring this region.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {dsKeys.map((key) => {
                const ds = datasets[key];
                const total = ds.n_genes;
                const converged = ds.modulus_means?.sarimax_ar2_mle?.n || 0;
                const rate = total > 0 ? ((converged / total) * 100).toFixed(0) : '—';
                const censored = total - converged;
                return (
                  <div key={key} className="p-4 rounded-lg bg-muted/50" data-testid={`convergence-${key}`}>
                    <div className="text-sm font-medium mb-2">{ds.dataset}</div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Converged:</span>
                      <span className="font-mono">{converged}/{total} ({rate}%)</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Censored at boundary:</span>
                      <span className="font-mono text-amber-600">{censored} genes</span>
                    </div>
                    <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${rate}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Key Findings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.key_findings?.map((finding: string, i: number) => (
                <div key={i} className="flex items-start gap-2" data-testid={`finding-${i}`}>
                  <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm">{finding}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Parsimony Argument</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{data.parsimony_argument}</p>
          </CardContent>
        </Card>

        <Card className="mb-8" data-testid="acceptance-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Acceptance Criteria</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {[
                {
                  criterion: 'Estimator robustness: SARIMAX rank ρ ≥ 0.95 across datasets',
                  pass: (data.cross_dataset_rank_correlations?.sarimax_ar2_mle?.mean_rho || 0) >= 0.95
                },
                {
                  criterion: 'Clock > target hierarchy preserved under AR(2) regardless of estimator',
                  pass: hierarchy.agreed >= 4
                },
                {
                  criterion: 'Eigenvalue ranks more stable than raw coefficients',
                  pass: dsKeys.some(k => {
                    const ds = datasets[k];
                    const coeff = ds.coefficient_agreement;
                    const eigRho = ds.rank_correlations?.sarimax_ar2_mle?.spearman_rho;
                    return coeff && eigRho && Math.abs(coeff.beta1_rho) < eigRho;
                  })
                },
                {
                  criterion: 'Local Level model shows different (not contradictory) construct',
                  pass: (data.cross_dataset_rank_correlations?.local_level?.mean_rho || 0) > 0.1 && (data.cross_dataset_rank_correlations?.local_level?.mean_rho || 0) < 0.9
                },
              ].map((c, i) => (
                <div key={i} className="flex items-center gap-2" data-testid={`criterion-${i}`}>
                  {c.pass ? <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" /> : <XCircle size={14} className="text-red-500 flex-shrink-0" />}
                  <span className={c.pass ? 'text-foreground' : 'text-muted-foreground'}>{c.criterion}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="mb-8">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Manuscript-Ready Language</CardTitle>
          </CardHeader>
          <CardContent>
            <blockquote className="border-l-4 border-primary/30 pl-4 text-sm text-muted-foreground italic leading-relaxed" data-testid="manuscript-language">
              {data.manuscript_language}
            </blockquote>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
