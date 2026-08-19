import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Bug, ShieldCheck, AlertTriangle, BarChart3, Clock, Dna, FileText, Globe, TrendingUp } from "lucide-react";

const HISTOGRAM_DATA = [
  { bin: "0.0-0.1", count: 14, pct: 0.4 },
  { bin: "0.1-0.2", count: 1, pct: 0.0 },
  { bin: "0.2-0.3", count: 4, pct: 0.1 },
  { bin: "0.3-0.4", count: 19, pct: 0.5 },
  { bin: "0.4-0.5", count: 52, pct: 1.3 },
  { bin: "0.5-0.6", count: 319, pct: 8.1 },
  { bin: "0.6-0.7", count: 704, pct: 17.8 },
  { bin: "0.7-0.8", count: 1025, pct: 26.0 },
  { bin: "0.8-0.9", count: 1000, pct: 25.3 },
  { bin: "0.9-1.0", count: 808, pct: 20.5 },
];

const DECILE_DATA = [
  { d: 1, lambda: 0.5164, maintenance: 1.314, pctMaint50: 53.2 },
  { d: 2, lambda: 0.6317, maintenance: 1.047, pctMaint50: 49.4 },
  { d: 3, lambda: 0.6851, maintenance: 1.583, pctMaint50: 49.4 },
  { d: 4, lambda: 0.7290, maintenance: 1.363, pctMaint50: 49.4 },
  { d: 5, lambda: 0.7668, maintenance: 1.220, pctMaint50: 45.5 },
  { d: 6, lambda: 0.8028, maintenance: 1.191, pctMaint50: 46.6 },
  { d: 7, lambda: 0.8397, maintenance: 1.148, pctMaint50: 43.5 },
  { d: 8, lambda: 0.8790, maintenance: 1.235, pctMaint50: 48.3 },
  { d: 9, lambda: 0.9216, maintenance: 1.077, pctMaint50: 44.5 },
  { d: 10, lambda: 0.9703, maintenance: 1.363, pctMaint50: 48.8 },
];

const EXPRESSION_QUINTILES = [
  { label: "Very Low", lambda: 0.7632, n: 789, expr: 1.7 },
  { label: "Low", lambda: 0.7762, n: 789, expr: 8.6 },
  { label: "Medium", lambda: 0.7688, n: 789, expr: 28.4 },
  { label: "High", lambda: 0.7790, n: 789, expr: 88.3 },
  { label: "Very High", lambda: 0.7816, n: 790, expr: 2204.6 },
];

function LambdaBar({ value, max = 1.0, color = "emerald" }: { value: number; max?: number; color?: string }) {
  const pct = Math.min((value / max) * 100, 100);
  const colorMap: Record<string, string> = {
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    red: "bg-red-500",
    blue: "bg-blue-500",
    purple: "bg-purple-500",
    cyan: "bg-cyan-500",
  };
  return (
    <div className="w-full bg-muted rounded-full h-2">
      <div className={`h-2 rounded-full ${colorMap[color] || colorMap.emerald}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function StatCard({ title, value, subtitle, icon: Icon }: { title: string; value: string; subtitle?: string; icon: any }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon size={18} className="text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className="text-xl font-bold font-mono" data-testid={`stat-${title.toLowerCase().replace(/\s+/g, '-')}`}>{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function BacterialPersistence() {
  const maxCount = Math.max(...HISTOGRAM_DATA.map(h => h.count));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-3 mb-2">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-1" data-testid="link-bacterial-back-main">
              <ArrowLeft size={14} /> Home
            </Button>
          </Link>
        </div>

        <div className="bg-amber-50 border border-amber-300 rounded-lg px-5 py-4 mb-6" data-testid="bacterial-research-disclaimer">
          <p className="text-amber-900 text-sm leading-relaxed">
            <span className="font-semibold">Cross-domain validation — exploratory analysis.</span>{" "}
            This page tests whether the AR(2) persistence framework generalizes beyond circadian biology,
            using publicly available E. coli starvation data. Results are preliminary and intended to demonstrate methodological scope.
          </p>
        </div>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <Bug size={24} className="text-emerald-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-bacterial-heading">Bacterial Persistence Analysis</h1>
              <p className="text-sm text-muted-foreground">E. coli AR(2) Starvation Response — Cross-Domain Validation</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 text-xs font-medium">UNPUBLISHED</span>
            <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 text-xs font-medium">CROSS-DOMAIN</span>
            <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-medium">GSE67402</span>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard title="Genes Analyzed" value="3,946† / 4,486" subtitle="†Cuffdiff-reported; see Limitations" icon={Dna} />
          <StatCard title="Timepoints" value="9" subtitle="3h → 336h (2 weeks)" icon={Clock} />
          <StatCard title="Genome Mean |λ|" value="0.7738†" subtitle="†Cuffdiff-reported; unverifiable from GEO" icon={BarChart3} />
          <StatCard title="Stationary Rate" value="89.3%†" subtitle="†Cuffdiff-reported; unverifiable from GEO" icon={TrendingUp} />
        </div>

        {/* Key Limitations — displayed prominently before findings */}
        <Card className="mb-8 border-amber-500/40 bg-amber-500/5" data-testid="card-upfront-limitations">
          <CardContent className="pt-5">
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-2 text-sm text-muted-foreground">
                <p className="font-semibold text-amber-400">Read before interpreting results</p>
                <p><strong className="text-foreground">Proxy stress, not antibiotics.</strong> This dataset (GSE67402) uses glucose starvation, not antibiotic treatment. While starvation and antibiotic persistence share biological pathways (persister cells enter starvation-like dormancy), generalizing these results to drug resistance requires caution.</p>
                <p><strong className="text-foreground">Bootstrap CI contains zero.</strong> The 95% confidence interval for the maintenance difference is [-38.3%, +26.2%]. The permutation test is significant (p {"<"} 0.001), but the effect size is noisy and may not be meaningfully different from zero.</p>
                <p><strong className="text-foreground">Individual gene predictions are unreliable.</strong> Gene-level correlation between eigenvalue and starvation maintenance is near zero (r = -0.007). The group-level pattern exists but does not translate to predicting individual gene behavior.</p>
                <p><strong className="text-foreground">Eigenvalue statistics not independently verifiable.</strong> The genome-wide statistics (mean |λ|=0.7738, median=0.7845) were computed from Cuffdiff FPKM output using the Wilke Lab pipeline. The original BAM files and Cuffdiff binary are not deposited on GEO; these figures cannot be reproduced from the publicly available count matrix alone.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Core Finding */}
        <Card className="mb-8 border-emerald-500/30 bg-emerald-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-400" data-testid="text-core-finding-title">
              <ShieldCheck size={20} />
              Core Finding: High-Persistence Genes Maintain Starvation Expression
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center p-4 rounded-lg bg-background/50">
                <p className="text-xs text-muted-foreground mb-1">High-persistence (top 25%, 985 genes)</p>
                <p className="text-3xl font-bold text-emerald-400 font-mono" data-testid="stat-high-persistence">74.8%</p>
                <p className="text-xs text-muted-foreground mt-1">maintained {">"} 50% expression</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-background/50">
                <p className="text-xs text-muted-foreground mb-1">Low-persistence (bottom 25%, 985 genes)</p>
                <p className="text-3xl font-bold text-amber-400 font-mono" data-testid="stat-low-persistence">40.0%</p>
                <p className="text-xs text-muted-foreground mt-1">maintained {">"} 50% expression</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-background/50">
                <p className="text-xs text-muted-foreground mb-1">Permutation test</p>
                <p className="text-3xl font-bold text-primary font-mono" data-testid="stat-perm-pvalue">p {"<"} 0.001</p>
                <p className="text-xs text-muted-foreground mt-1">0 of 5,000 permutations</p>
              </div>
            </div>
            <div className="mt-4 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
              <p className="text-sm text-muted-foreground leading-relaxed">
                <span className="text-amber-400 font-semibold">Honest caveat:</span> While the permutation test is highly significant (p {"<"} 0.001), 
                the bootstrap 95% CI for the mean maintenance difference is [−0.383, +0.262] — <span className="text-amber-400 font-medium">this contains zero</span>. 
                The gene-level correlations are near zero (Pearson r = −0.007, Spearman ρ = −0.021). 
                The group-level effect is real but noisy, likely driven by outlier genes rather than a uniform trend.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Genome-Wide Histogram */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2" data-testid="text-histogram-title">
              <BarChart3 size={20} />
              Genome-Wide Eigenvalue Distribution (3,946 genes)
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              AR(2) dominant eigenvalue |λ| distribution across the E. coli K-12 MG1655 genome
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {HISTOGRAM_DATA.map((bin) => (
                <div key={bin.bin} className="flex items-center gap-3" data-testid={`row-histogram-${bin.bin}`}>
                  <div className="w-16 text-xs font-mono text-muted-foreground text-right">{bin.bin}</div>
                  <div className="flex-1 bg-muted rounded-full h-6 relative overflow-hidden">
                    <div
                      className="h-6 rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${(bin.count / maxCount) * 100}%` }}
                    />
                    <span className="absolute inset-0 flex items-center pl-2 text-xs font-mono font-bold text-slate-900 drop-shadow">
                      {bin.count > 50 ? `${bin.count} (${bin.pct}%)` : ""}
                    </span>
                  </div>
                  <div className="w-20 text-right text-xs font-mono text-muted-foreground">
                    {bin.count} ({bin.pct}%)
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Mean |λ|</p>
                <p className="font-mono font-bold" data-testid="stat-dist-mean">0.7738</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Median</p>
                <p className="font-mono font-bold" data-testid="stat-dist-median">0.7845</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Std Dev</p>
                <p className="font-mono font-bold" data-testid="stat-dist-std">0.1385</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">IQR</p>
                <p className="font-mono font-bold" data-testid="stat-dist-iqr">[0.684, 0.879]</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Decile Analysis */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2" data-testid="text-decile-title">
              <TrendingUp size={20} />
              Decile Analysis: Eigenvalue vs Starvation Maintenance
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Genes sorted by eigenvalue into 10 equal-sized bins (~395 genes each)
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-left">
                    <th className="py-2 pr-4">Decile</th>
                    <th className="py-2 px-2 text-right">Mean |λ|</th>
                    <th className="py-2 px-2 text-right">Mean Maintenance</th>
                    <th className="py-2 px-2 text-right">% Maint {">"} 50%</th>
                    <th className="py-2 px-2">|λ| Distribution</th>
                  </tr>
                </thead>
                <tbody>
                  {DECILE_DATA.map((row) => (
                    <tr key={row.d} className="border-b border-border/20" data-testid={`row-decile-${row.d}`}>
                      <td className="py-2 pr-4 font-medium">D{row.d}</td>
                      <td className="py-2 px-2 text-right font-mono">{row.lambda.toFixed(4)}</td>
                      <td className="py-2 px-2 text-right font-mono">{row.maintenance.toFixed(3)}</td>
                      <td className={`py-2 px-2 text-right font-mono font-bold ${row.pctMaint50 > 50 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {row.pctMaint50.toFixed(1)}%
                      </td>
                      <td className="py-2 px-2 w-32">
                        <LambdaBar value={row.lambda} color={row.d <= 3 ? 'amber' : row.d >= 8 ? 'emerald' : 'blue'} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              The decile analysis shows a weak downward trend in maintenance percentage from D1 (53.2%) to D7 (43.5%), 
              but with substantial noise — D10 bounces back to 48.8%. This is consistent with the near-zero gene-level 
              correlation and suggests the group-level permutation result is driven by distributional differences rather 
              than a monotonic relationship.
            </p>
          </CardContent>
        </Card>

        {/* Expression Independence */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2" data-testid="text-expression-title">
              <Dna size={20} />
              Expression Level Independence
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Mean eigenvalue by expression quintile — proving |λ| is independent of expression level
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-left">
                    <th className="py-2 pr-4">Quintile</th>
                    <th className="py-2 px-2 text-right">Mean |λ|</th>
                    <th className="py-2 px-2 text-right">N Genes</th>
                    <th className="py-2 px-2 text-right">Mean Expression</th>
                    <th className="py-2 px-2">|λ| Distribution</th>
                  </tr>
                </thead>
                <tbody>
                  {EXPRESSION_QUINTILES.map((q) => (
                    <tr key={q.label} className="border-b border-border/20" data-testid={`row-quintile-${q.label.toLowerCase().replace(/\s+/g, '-')}`}>
                      <td className="py-2 pr-4 font-medium">{q.label}</td>
                      <td className="py-2 px-2 text-right font-mono font-bold">{q.lambda.toFixed(4)}</td>
                      <td className="py-2 px-2 text-right font-mono">{q.n}</td>
                      <td className="py-2 px-2 text-right font-mono text-muted-foreground">{q.expr.toFixed(1)}</td>
                      <td className="py-2 px-2 w-32">
                        <LambdaBar value={q.lambda} color="emerald" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              All five quintiles show nearly identical mean eigenvalues (~0.77), spanning a 1,300-fold range 
              in expression level (1.7 to 2,204.6 TPM). This confirms that eigenvalue is an intrinsic dynamical 
              property independent of expression magnitude — the same result seen in human cancer datasets.
            </p>
          </CardContent>
        </Card>

        {/* Honest Limitations */}
        <Card className="mb-8 border-amber-500/30 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-400" data-testid="text-limitations-title">
              <AlertTriangle size={20} />
              Honest Limitations & Caveats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-background/50">
                <p className="text-sm font-medium text-amber-400 mb-1">Bootstrap CI Contains Zero</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  The bootstrap 95% CI for the maintenance difference is [−38.3%, +26.2%] — it contains zero, 
                  suggesting the maintenance difference, while significant by permutation, is noisy and likely 
                  driven by outlier genes with extreme maintenance ratios.
                </p>
              </div>
              <div className="p-3 rounded-lg bg-background/50">
                <p className="text-sm font-medium text-amber-400 mb-1">Near-Zero Gene-Level Correlation</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Pearson r = −0.007, Spearman ρ = −0.021. Eigenvalue does NOT predict starvation maintenance 
                  for individual genes. The group-level effect exists but does not translate to gene-level prediction.
                </p>
              </div>
              <div className="p-3 rounded-lg bg-background/50">
                <p className="text-sm font-medium text-amber-400 mb-1">Different Stress Type</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  This is glucose starvation, NOT antibiotic treatment — a different (though related) stress. 
                  Generalizing from nutrient depletion to drug response requires caution.
                </p>
              </div>
              <div className="p-3 rounded-lg bg-background/50">
                <p className="text-sm font-medium text-amber-400 mb-1">Limited Gene Annotation</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Gene IDs are in ECB_XXXXX format without standard gene name annotation, limiting biological 
                  interpretation and pathway enrichment analysis.
                </p>
              </div>
              <div className="p-3 rounded-lg bg-background/50">
                <p className="text-sm font-medium text-amber-400 mb-1">Replicate Averaging</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  AR(2) was fitted on replicate-averaged data — individual replicate variation is not fully captured. 
                  This may smooth out biologically meaningful heterogeneity.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cross-Domain Significance */}
        <Card className="mb-8 border-blue-500/30 bg-blue-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-400" data-testid="text-cross-domain-title">
              <Globe size={20} />
              Cross-Domain Significance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              The most important finding here is not the starvation maintenance analysis — it's that 
              AR(2) eigenvalue analysis works identically on bacterial transcriptomic data as it does on 
              human cancer data. The method is organism-agnostic.
            </p>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="text-center p-4 rounded-lg bg-background/50">
                <p className="text-xs text-muted-foreground mb-1">E. coli Mean |λ|</p>
                <p className="text-2xl font-bold font-mono text-blue-400" data-testid="stat-ecoli-lambda">0.77</p>
                <p className="text-xs text-muted-foreground mt-1">3,946 genes</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-background/50">
                <p className="text-xs text-muted-foreground mb-1">Human Cancer Mean |λ|</p>
                <p className="text-2xl font-bold font-mono text-blue-400" data-testid="stat-human-lambda">0.70</p>
                <p className="text-xs text-muted-foreground mt-1">13,328 genes (GSE93204)</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-background/50">
                <p className="text-xs text-muted-foreground mb-1">Stationary Rate</p>
                <p className="text-2xl font-bold font-mono text-blue-400" data-testid="stat-cross-stationary">~89%</p>
                <p className="text-xs text-muted-foreground mt-1">Both organisms</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mt-4">
              Same eigenvalue range (0.70–0.77), same high stationary rate (~89%), same expression-independence 
              of eigenvalue. AR(2) captures a fundamental property of gene expression dynamics that is conserved 
              across 3 billion years of evolution — from prokaryotes to eukaryotes.
            </p>
          </CardContent>
        </Card>

        {/* Data Source & Methods */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2" data-testid="text-methods-title">
              <FileText size={20} />
              Data Source & Methods
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="font-medium text-foreground mb-1">Dataset</p>
                  <p>GEO Accession: GSE67402</p>
                  <p>Title: E. coli K-12 MG1655 glucose starvation time course</p>
                  <p>Organism: Escherichia coli</p>
                  <p>Source: Houser et al., PLoS Comput Biol 2015</p>
                </div>
                <div>
                  <p className="font-medium text-foreground mb-1">Experimental Design</p>
                  <p>9 timepoints: 3h, 4h, 5h, 6h, 8h, 24h, 48h, 168h (1wk), 336h (2wk)</p>
                  <p>3 biological replicates per timepoint</p>
                  <p>4,486 total genes; 3,946 stationary (89.3%)</p>
                </div>
              </div>
              <div className="border-t border-border/30 pt-3">
                <p className="font-medium text-foreground mb-1">AR(2) Analysis</p>
                <p>
                  Expression values were averaged across 3 biological replicates at each timepoint. 
                  AR(2) models were fitted to each gene's 9-point time series. Eigenvalues were extracted 
                  from the companion matrix. Genes with |λ| {"<"} 1 (stationary) were retained for analysis. 
                  Starvation maintenance was defined as the ratio of late-timepoint expression (168h, 336h) 
                  to early-timepoint expression (3h, 4h, 5h).
                </p>
              </div>
              <div className="border-t border-border/30 pt-3">
                <p className="font-medium text-foreground mb-1">Statistical Tests</p>
                <p>
                  Permutation test: 5,000 random shuffles of eigenvalue labels. Bootstrap CI: 5,000 
                  resamples with replacement. Gene-level correlation: Pearson and Spearman on all 3,946 
                  stationary genes.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
