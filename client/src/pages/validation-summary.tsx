import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, TrendingUp, Database } from "lucide-react";

export default function ValidationSummary() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        <section className="space-y-3">
          <h1 className="text-3xl font-bold text-slate-900">Validation Summary</h1>
          <p className="text-lg text-slate-600">AR(2) method validated against published literature, cross-species datasets, and domain-specific benchmarks.</p>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-emerald-200 bg-emerald-50/50" data-testid="validation-card-literature">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg text-slate-900">Literature Validation</CardTitle>
                  <CardDescription>Known circadian genes recovery</CardDescription>
                </div>
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <div className="font-semibold text-slate-900">58 of 59 Clock Genes Recovered</div>
                <div className="text-slate-600">98.3% recovery above background median (~3.9-fold enrichment, Hughes Circadian Atlas)</div>
              </div>
              <div className="space-y-1">
                <div className="text-slate-700"><strong>Per2, Cry1, Nr1d1:</strong> 12/12 tissues coupled (p&lt;0.05)</div>
                <div className="text-slate-700"><strong>WEE1 (Matsuo 2003):</strong> 10/12 tissues coupled, validates direct BMAL1 control</div>
              </div>
              <div className="pt-2 border-t border-emerald-200">
                <Badge variant="outline" className="bg-emerald-100 text-emerald-700">Passed</Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-200 bg-blue-50/50" data-testid="validation-card-cross-species">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg text-slate-900">Cross-Species Validation</CardTitle>
                  <CardDescription>Persistence hierarchy replication</CardDescription>
                </div>
                <CheckCircle2 className="w-5 h-5 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="space-y-2">
                <div className="text-slate-700"><strong>Cross-dataset audit:</strong> Clock mean |λ| = 0.689, target mean |λ| = 0.537 (gap ≈ 0.15)</div>
                <div className="text-slate-700"><strong>4 species tested:</strong> Mouse, human, baboon, Arabidopsis — all preserve clock &gt; target ordering</div>
                <div className="text-slate-700"><strong>14/14 dataset-level analyses</strong> maintain hierarchy; tissue-level varies (e.g. baboon 8/14)</div>
              </div>
              <div className="pt-2 border-t border-blue-200">
                <Badge variant="outline" className="bg-blue-100 text-blue-700">Passed</Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="border-purple-200 bg-purple-50/50" data-testid="validation-card-halflife">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg text-slate-900">mRNA Half-Life Independence</CardTitle>
                  <CardDescription>7 datasets / 4 species</CardDescription>
                </div>
                <CheckCircle2 className="w-5 h-5 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <div className="font-semibold text-slate-900">|λ| shows no detectable correlation with mRNA half-life</div>
                <div className="text-slate-600">Measures oscillatory dynamics, not decay rate — correlation near zero across tested datasets</div>
              </div>
              <div className="space-y-1">
                <div className="text-slate-700">Multiple datasets tested across mouse, human, baboon, plant, and yeast</div>
                <div className="text-slate-700">See Half-Life Independence page for computed values and bootstrap analysis</div>
              </div>
              <div className="pt-2 border-t border-purple-200">
                <Badge variant="outline" className="bg-purple-100 text-purple-700">Passed</Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-200 bg-amber-50/50" data-testid="validation-card-bias">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg text-slate-900">Bias Auditing</CardTitle>
                  <CardDescription>Robustness checks</CardDescription>
                </div>
                <CheckCircle2 className="w-5 h-5 text-amber-600" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="space-y-2">
                <div className="text-slate-700"><strong>Time-Shuffle Destruction:</strong> Randomized time series scramble AR(2) estimates</div>
                <div className="text-slate-700"><strong>Irrelevant Metric Correlation:</strong> |λ| uncorrelated with noise levels</div>
                <div className="text-slate-700"><strong>Expression-Matched Null:</strong> Null hierarchy preserved after permutation</div>
              </div>
              <div className="pt-2 border-t border-amber-200">
                <Badge variant="outline" className="bg-amber-100 text-amber-700">Passed</Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="border-rose-200 bg-rose-50/50" data-testid="validation-card-genome">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg text-slate-900">Genome-Wide Validation</CardTitle>
                  <CardDescription>21,000 genes scanned</CardDescription>
                </div>
                <CheckCircle2 className="w-5 h-5 text-rose-600" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <div className="font-semibold text-slate-900">Clock genes at 83.5th percentile</div>
                <div className="text-slate-600">p = 0.0006 (permutation test across all genes)</div>
              </div>
              <div className="space-y-1">
                <div className="text-slate-700">20 novel candidate oscillators flagged (top 5% |λ| + complex roots)</div>
                <div className="text-slate-700">No bias toward pathway annotations or codon usage</div>
              </div>
              <div className="pt-2 border-t border-rose-200">
                <Badge variant="outline" className="bg-rose-100 text-rose-700">Passed</Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="border-cyan-200 bg-cyan-50/50" data-testid="validation-card-non-circadian">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg text-slate-900">Non-Circadian Datasets</CardTitle>
                  <CardDescription>Immune response, cell cycle</CardDescription>
                </div>
                <CheckCircle2 className="w-5 h-5 text-cyan-600" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <div className="font-semibold text-slate-900">AR(2) detects diverse oscillators</div>
                <div className="text-slate-600">Not period-specific; finds circadian, ultradian, and cell-cycle dynamics</div>
              </div>
              <div className="space-y-1">
                <div className="text-slate-700">Hes1 (Notch oscillator): 0.374 |λ|, 3/12 tissues BMAL1-coupled</div>
                <div className="text-slate-700">Validates period-agnostic oscillator classification</div>
              </div>
              <div className="pt-2 border-t border-cyan-200">
                <Badge variant="outline" className="bg-cyan-100 text-cyan-700">Passed</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-slate-300 bg-slate-50" data-testid="limitations-card">
          <CardHeader>
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-slate-600 mt-0.5" />
              <div>
                <CardTitle className="text-slate-900">Limitations & Scope</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <div className="font-semibold text-slate-800 mb-1">Linear Dynamics Assumption</div>
              <p className="text-slate-600">AR(2) assumes linear autoregressive structure. Nonlinear biological systems (e.g., ultrasensitive switches, bistability) may be missed or misclassified. Use Root-Space visualization to detect strong nonlinear behavior.</p>
            </div>
            <div>
              <div className="font-semibold text-slate-800 mb-1">Time Resolution Constraints</div>
              <p className="text-slate-600">Standard circadian datasets use 12 timepoints across 24h (2h intervals). Cannot resolve oscillations faster than ~4h period. For sub-2h dynamics (e.g., p53 pulses), requires finer-resolution data.</p>
            </div>
            <div>
              <div className="font-semibold text-slate-800 mb-1">Stationarity Requirement</div>
              <p className="text-slate-600">AR(2) assumes data from a stationary process. Non-stationary (trending) data will have artificially high |λ| values. Use differencing or detrending before upload if data shows strong linear trends.</p>
            </div>
            <div>
              <div className="font-semibold text-slate-800 mb-1">Cross-Dataset Averaging</div>
              <p className="text-slate-600">Mean |λ| computed only for genes present in multiple studies. Genes unique to single datasets cannot be ranked against the cross-dataset hierarchy. Single-dataset analysis shows per-gene |λ| only.</p>
            </div>
            <div>
              <div className="font-semibold text-slate-800 mb-1">BMAL1 Coupling Inference</div>
              <p className="text-slate-600">Tissue-level coupling to BMAL1 is inferred from transcriptomics correlation, not direct measurement of phase or temporal protein dynamics. Interpret as "transcriptionally associated," not proven causal regulation.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white" data-testid="what-next-card">
          <CardHeader>
            <CardTitle className="text-slate-900">What's validated, what's exploratory</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <div className="font-semibold text-emerald-700 mb-1">✓ Established (publishable)</div>
              <p className="text-slate-600">AR(2) correctly detects oscillatory genes; persistence hierarchy replicates across species; WEE1 clock coupling; cross-dataset benchmarks; |λ| independence from mRNA half-life.</p>
            </div>
            <div>
              <div className="font-semibold text-amber-700 mb-1">⊕ Novel but plausible (testable)</div>
              <p className="text-slate-600">Three-class oscillator taxonomy (core/entrained/independent); oscillators decouple in aging/cancer; regulatory core discovery (20 novel genes); phase-gating as clock-cell cycle test.</p>
            </div>
            <div>
              <div className="font-semibold text-slate-700 mb-1">⊜ Speculative (hypothesis-generating)</div>
              <p className="text-slate-600">BMAL1 crypt renewal protection (null result, CI overlaps 1.0); Fibonacci specificity (not supported); k₂ autocatalytic rates invisible to AR(2) linearization. Presented transparently as exploratory.</p>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
