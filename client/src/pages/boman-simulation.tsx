import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, FileText, Loader2, Package, Beaker, Grid3x3, Target, Dna, FlaskConical, TrendingUp, CheckCircle, AlertCircle } from "lucide-react";

interface FileInfo {
  name: string;
  size: number;
  description: string;
}

interface StratumResult {
  label: string;
  total_runs: number;
  fib_consistent: number;
  observed_rate: number;
  null_fraction: number;
  fold_enrichment: number;
  p_value: number;
  significant: boolean;
}

interface EnrichmentResult {
  null_fraction: number;
  null_pct: string;
  by_division_limit: StratumResult[];
  division_limit2_by_ta_rate: StratumResult[];
  key_finding: string;
  interpretation: string;
}

interface PhiConvergenceStratumResult {
  label: string;
  total_runs: number;
  cp_converged: number;
  pd_converged: number;
  both_converged: number;
  cp_rate: number;
  pd_rate: number;
  both_rate: number;
  cp_fold: number;
  pd_fold: number;
  both_fold: number;
  cp_p: number;
  pd_p: number;
  both_p: number;
  cp_significant: boolean;
  both_significant: boolean;
  mean_cp_ratio: number;
  mean_pd_ratio: number;
}

interface CalibrationPoint {
  ta: number;
  beta: number;
  beta_near_inv_phi: boolean;
  mean_cp: number;
  cp_near_phi: boolean;
}

interface ProbeResult {
  division_limit: number;
  mean_lambda: number;
  sd_lambda: number;
  mean_phi1: number;
  mean_phi2: number;
  near_inv_phi: boolean;
  distance_from_inv_phi: number;
  mean_cp: number;
}

interface FibConnectionResult {
  calibration: CalibrationPoint[];
  fibonacci_ta: number;
  fibonacci_beta: number;
  circadian_probe: ProbeResult[];
  pulse_recovery: ProbeResult[];
  key_finding: string;
  interpretation: string;
  inv_phi: number;
  phi: number;
}

interface PhiConvergenceResult {
  total_runs: number;
  empirical_null_cp: number;
  empirical_null_pd: number;
  empirical_null_both: number;
  null_pct_cp: string;
  null_pct_pd: string;
  null_pct_both: string;
  by_division_limit: PhiConvergenceStratumResult[];
  division_limit2_by_ta_rate: PhiConvergenceStratumResult[];
  key_finding: string;
  interpretation: string;
  phi_value: number;
  inv_phi_value: number;
}

export default function BomanSimulation() {
  const [generating, setGenerating] = useState(false);
  const [files, setFiles] = useState<FileInfo[] | null>(null);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);
  const [runningEnrichment, setRunningEnrichment] = useState(false);
  const [enrichment, setEnrichment] = useState<EnrichmentResult | null>(null);
  const [enrichmentError, setEnrichmentError] = useState("");
  const [runningFullEnrichment, setRunningFullEnrichment] = useState(false);
  const [fullEnrichment, setFullEnrichment] = useState<EnrichmentResult | null>(null);
  const [fullEnrichmentError, setFullEnrichmentError] = useState("");
  const [runningPhiConv, setRunningPhiConv] = useState(false);
  const [phiConv, setPhiConv] = useState<PhiConvergenceResult | null>(null);
  const [phiConvError, setPhiConvError] = useState("");
  const [runningFibConn, setRunningFibConn] = useState(false);
  const [fibConn, setFibConn] = useState<FibConnectionResult | null>(null);
  const [fibConnError, setFibConnError] = useState("");

  const generate = async () => {
    setGenerating(true);
    setError("");
    try {
      const res = await fetch("/api/boman-simulation/generate");
      if (!res.ok) throw new Error("Generation failed");
      const data = await res.json();
      setFiles(data.files);
    } catch (err) {
      setError(String(err));
    }
    setGenerating(false);
  };

  const runEnrichment = async () => {
    setRunningEnrichment(true);
    setEnrichmentError("");
    try {
      const res = await fetch("/api/boman-simulation/enrichment");
      if (!res.ok) throw new Error("Enrichment analysis failed");
      const data = await res.json();
      setEnrichment(data);
    } catch (err) {
      setEnrichmentError(String(err));
    }
    setRunningEnrichment(false);
  };

  const runFullEnrichment = async () => {
    setRunningFullEnrichment(true);
    setFullEnrichmentError("");
    try {
      const res = await fetch("/api/boman-simulation/enrichment/full");
      if (!res.ok) throw new Error("Full enrichment analysis failed");
      const data = await res.json();
      setFullEnrichment(data);
    } catch (err) {
      setFullEnrichmentError(String(err));
    }
    setRunningFullEnrichment(false);
  };

  const runPhiConvergence = async () => {
    setRunningPhiConv(true);
    setPhiConvError("");
    try {
      const res = await fetch("/api/boman-simulation/phi-convergence");
      if (!res.ok) throw new Error("Phi-ratio convergence test failed");
      const data = await res.json();
      setPhiConv(data);
    } catch (err) {
      setPhiConvError(String(err));
    }
    setRunningPhiConv(false);
  };

  const runFibConnection = async () => {
    setRunningFibConn(true);
    setFibConnError("");
    try {
      const res = await fetch("/api/boman-simulation/fibonacci-connection");
      if (!res.ok) throw new Error("Fibonacci connection test failed");
      const data = await res.json();
      setFibConn(data);
    } catch (err) {
      setFibConnError(String(err));
    }
    setRunningFibConn(false);
  };

  const downloadFile = async (fileType: string, filename: string) => {
    setDownloading(fileType);
    try {
      const res = await fetch(`/api/boman-simulation/download/${fileType}`);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(String(err));
    }
    setDownloading(null);
  };

  const fileConfigs = [
    { type: "timeseries", icon: Beaker, color: "text-emerald-400", borderColor: "border-emerald-500/30", bgColor: "bg-emerald-500/5" },
    { type: "sweep", icon: Grid3x3, color: "text-blue-400", borderColor: "border-blue-500/30", bgColor: "bg-blue-500/5" },
    { type: "fibonacci-region", icon: Target, color: "text-amber-400", borderColor: "border-amber-500/30", bgColor: "bg-amber-500/5" },
    { type: "coefficient-space", icon: Dna, color: "text-purple-400", borderColor: "border-purple-500/30", bgColor: "bg-purple-500/5" },
  ];

  const pLabel = (p: number) => {
    if (p < 0.001) return "p < 0.001";
    if (p < 0.01) return `p = ${p.toFixed(3)}`;
    return `p = ${p.toFixed(3)}`;
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-1" data-testid="link-boman-back">
              <ArrowLeft size={14} /> Back
            </Button>
          </Link>
          <h1 className="text-2xl font-bold" data-testid="text-boman-title">Boman-Style Crypt Simulation</h1>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2" data-testid="text-boman-subtitle">
              <Package size={20} />
              Spatial–Temporal Bridge Files
            </CardTitle>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Generates 4 machine-readable files that link Boman-style intestinal crypt division rules to AR(2) temporal coefficients.
              The simulation models stem cell niche dynamics with configurable parameters (niche size, maturation delay, division limit,
              Wnt signaling, circadian gating) across 1,080 parameter combinations and 8 biological conditions.
              This is an exploratory synthetic modelling exercise — all data are simulation-derived; no empirical dataset is included.
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/50 text-sm text-muted-foreground space-y-2">
                <p><strong className="text-foreground">Model (v2 — cohort-based):</strong> TA cells are tracked as an array of discrete division-stage cohorts (Boman's N). Each stage transition doubles the cohort (one cell → two cells). Cells completing stage N differentiate. No artificial recursion parameter: the delay structure is mechanistic.</p>
                <p><strong className="text-foreground">Fibonacci-consistent condition:</strong> With division_limit=2 and transition_rate=0.5, the golden-ratio condition arises when ta_apoptosis_rate ≈ 0.382 ≈ 1/φ² — making the stage-2 cohort contribution exactly 1/φ times the stage-1 contribution. This is an exploratory conjecture demonstrated by the sweep, not a theorem.</p>
                <p><strong className="text-foreground">New outputs:</strong> fib_ratio_C (|φ₁/φ₂| for stem compartment), steady_state_C_P_ratio and steady_state_P_D_ratio (vs Boman's prediction of φ and 1/φ), phi_ratio_convergence flag.</p>
                <p><strong className="text-foreground">Conditions (8):</strong> normal, normal (no circadian), FAP-like, adenoma-like, high Wnt, low Wnt, strong delay feedback, balanced oscillator.</p>
              </div>

              {!files && (
                <Button
                  onClick={generate}
                  disabled={generating}
                  className="w-full"
                  size="lg"
                  data-testid="button-generate-simulation"
                >
                  {generating ? (
                    <>
                      <Loader2 size={16} className="animate-spin mr-2" />
                      Running 1,080 simulations...
                    </>
                  ) : (
                    <>
                      <Beaker size={16} className="mr-2" />
                      Generate Simulation Files
                    </>
                  )}
                </Button>
              )}

              {error && <p className="text-sm text-red-500" data-testid="text-boman-error">{error}</p>}

              {files && (
                <div className="space-y-3">
                  <p className="text-sm text-emerald-400 font-medium" data-testid="text-generation-complete">Generation complete. Download individual files or the full package:</p>

                  {files.map((file, i) => {
                    const config = fileConfigs[i];
                    const Icon = config?.icon || FileText;
                    return (
                      <Card key={file.name} className={`${config?.borderColor || ''} ${config?.bgColor || ''}`}>
                        <CardContent className="pt-4 pb-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3">
                              <Icon size={20} className={`${config?.color || 'text-foreground'} mt-0.5 shrink-0`} />
                              <div>
                                <p className="font-mono text-sm font-bold" data-testid={`text-file-name-${i}`}>{file.name}</p>
                                <p className="text-xs text-muted-foreground mt-1">{file.description}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{(file.size / 1024).toFixed(0)} KB</p>
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const types = ['timeseries', 'sweep', 'fibonacci-region', 'coefficient-space'];
                                downloadFile(types[i], file.name);
                              }}
                              disabled={downloading !== null}
                              data-testid={`button-download-${i}`}
                            >
                              {downloading === ['timeseries', 'sweep', 'fibonacci-region', 'coefficient-space'][i] ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <Download size={14} />
                              )}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}

                  <Button
                    onClick={() => downloadFile('all', 'boman_ar2_simulation_package.zip')}
                    disabled={downloading !== null}
                    className="w-full mt-4"
                    variant="default"
                    size="lg"
                    data-testid="button-download-all"
                  >
                    {downloading === 'all' ? (
                      <>
                        <Loader2 size={16} className="animate-spin mr-2" />
                        Packaging...
                      </>
                    ) : (
                      <>
                        <Package size={16} className="mr-2" />
                        Download All (ZIP with README)
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Enrichment Analysis */}
        <Card className="mb-8 border-violet-500/30 bg-violet-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-violet-400">
              <TrendingUp size={20} />
              Null Model Enrichment Test
            </CardTitle>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Tests whether division_limit=2 produces eigenvalue moduli |λ| near 1/φ ≈ 0.618 (the stable Fibonacci boundary) more often than chance.
              The geometric null is computed analytically from the stable AR(2) triangle area — no simulation required.
              A 270-run focused sweep (80 timesteps, 2 replicates) is then compared against this baseline with a one-tailed binomial test.
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {!enrichment && (
                <Button
                  onClick={runEnrichment}
                  disabled={runningEnrichment}
                  className="w-full"
                  variant="outline"
                  size="lg"
                  data-testid="button-run-enrichment"
                >
                  {runningEnrichment ? (
                    <>
                      <Loader2 size={16} className="animate-spin mr-2" />
                      Running enrichment analysis (~15s)...
                    </>
                  ) : (
                    <>
                      <FlaskConical size={16} className="mr-2" />
                      Run Enrichment Test
                    </>
                  )}
                </Button>
              )}

              {enrichmentError && <p className="text-sm text-red-500" data-testid="text-enrichment-error">{enrichmentError}</p>}

              {enrichment && (
                <div className="space-y-5" data-testid="enrichment-results">
                  {/* Geometric null */}
                  <div className="p-3 rounded-lg bg-muted/50 text-sm">
                    <p className="font-semibold text-foreground mb-1">Geometric Null Baseline</p>
                    <p className="text-muted-foreground">
                      <span className="font-mono text-foreground">{enrichment.null_pct}</span> of the stable AR(2) triangle has eigenvalue modulus |λ| within 0.05 of 1/φ ≈ 0.618 (the stable Fibonacci boundary) by pure area.
                      Any observed rate significantly above this represents enrichment beyond geometric chance.
                    </p>
                  </div>

                  {/* By divisionLimit */}
                  <div>
                    <p className="text-sm font-semibold text-foreground mb-2">Enrichment by Division Limit</p>
                    <div className="overflow-x-auto rounded-lg border border-border">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left p-2 text-muted-foreground">Stratum</th>
                            <th className="text-right p-2 text-muted-foreground">Runs</th>
                            <th className="text-right p-2 text-muted-foreground">Fib-consistent</th>
                            <th className="text-right p-2 text-muted-foreground">Observed %</th>
                            <th className="text-right p-2 text-muted-foreground">Null %</th>
                            <th className="text-right p-2 text-muted-foreground">Fold enrichment</th>
                            <th className="text-right p-2 text-muted-foreground">P-value</th>
                            <th className="text-center p-2 text-muted-foreground">Sig.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {enrichment.by_division_limit.map((row, i) => (
                            <tr key={i} className={`border-t border-border ${row.label.includes('=2') ? 'bg-violet-500/10' : ''}`}>
                              <td className="p-2 font-mono font-semibold" data-testid={`enrichment-label-${i}`}>{row.label}</td>
                              <td className="p-2 text-right text-muted-foreground">{row.total_runs}</td>
                              <td className="p-2 text-right text-muted-foreground">{row.fib_consistent}</td>
                              <td className="p-2 text-right font-semibold text-foreground">{row.observed_rate.toFixed(1)}%</td>
                              <td className="p-2 text-right text-muted-foreground">{row.null_fraction.toFixed(1)}%</td>
                              <td className={`p-2 text-right font-semibold ${row.fold_enrichment >= 2 ? 'text-violet-400' : row.fold_enrichment >= 1.2 ? 'text-amber-400' : 'text-muted-foreground'}`}>
                                {row.fold_enrichment.toFixed(2)}×
                              </td>
                              <td className="p-2 text-right text-muted-foreground">{pLabel(row.p_value)}</td>
                              <td className="p-2 text-center">
                                {row.significant
                                  ? <CheckCircle size={14} className="text-emerald-400 inline" />
                                  : <AlertCircle size={14} className="text-muted-foreground inline" />}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Highlighted row = division_limit=2 (the Fibonacci regime predicted by Boman's division rules).</p>
                  </div>

                  {/* By taApoptosisRate for divisionLimit=2 */}
                  <div>
                    <p className="text-sm font-semibold text-foreground mb-2">division_limit=2 — Enrichment by TA Apoptosis Rate</p>
                    <div className="overflow-x-auto rounded-lg border border-border">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left p-2 text-muted-foreground">ta_apoptosis_rate</th>
                            <th className="text-right p-2 text-muted-foreground">Runs</th>
                            <th className="text-right p-2 text-muted-foreground">Fib-consistent</th>
                            <th className="text-right p-2 text-muted-foreground">Observed %</th>
                            <th className="text-right p-2 text-muted-foreground">Fold enrichment</th>
                            <th className="text-right p-2 text-muted-foreground">P-value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {enrichment.division_limit2_by_ta_rate.map((row, i) => {
                            const isGolden = row.label.includes('0.4');
                            return (
                              <tr key={i} className={`border-t border-border ${isGolden ? 'bg-amber-500/10' : ''}`}>
                                <td className="p-2 font-mono">
                                  {row.label.replace('ta_apoptosis_rate=', '')}
                                  {isGolden && <span className="ml-2 text-amber-400 text-xs">≈ 1/φ²</span>}
                                </td>
                                <td className="p-2 text-right text-muted-foreground">{row.total_runs}</td>
                                <td className="p-2 text-right text-muted-foreground">{row.fib_consistent}</td>
                                <td className="p-2 text-right font-semibold text-foreground">{row.observed_rate.toFixed(1)}%</td>
                                <td className={`p-2 text-right font-semibold ${row.fold_enrichment >= 2 ? 'text-amber-400' : 'text-muted-foreground'}`}>
                                  {row.fold_enrichment.toFixed(2)}×
                                </td>
                                <td className="p-2 text-right text-muted-foreground">{pLabel(row.p_value)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Theoretically motivated rate: ta_apoptosis_rate ≈ 0.40 (≈ 1/φ² ≈ 0.382) — the value at which the two-stage recursion produces Fibonacci-ratio dynamics. Highlighted in amber.</p>
                  </div>

                  {/* Key finding */}
                  <div className="p-4 rounded-lg border border-violet-500/30 bg-violet-500/5 text-sm space-y-2">
                    <p className="font-semibold text-violet-400">Key Finding</p>
                    <p className="text-foreground leading-relaxed" data-testid="text-key-finding">{enrichment.key_finding}</p>
                    <p className="text-muted-foreground text-xs leading-relaxed">{enrichment.interpretation}</p>
                    <p className="text-muted-foreground text-xs mt-2 border-t border-violet-500/20 pt-2">
                      <strong>Caveat:</strong> This is a 270-run focused sweep at 80 timesteps. Results should be interpreted as directional evidence, not a definitive statistical claim. The full 1,080-run sweep provides more precise estimates per stratum.
                    </p>
                  </div>

                  <Button
                    onClick={runEnrichment}
                    disabled={runningEnrichment}
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    data-testid="button-rerun-enrichment"
                  >
                    {runningEnrichment ? <Loader2 size={12} className="animate-spin mr-1" /> : null}
                    Re-run analysis
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Full 1,080-run sweep */}
        <Card className="mb-8 border-violet-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-violet-400">
              <TrendingUp size={20} />
              Full 1,080-Run Sweep
            </CardTitle>
            <p className="text-sm text-muted-foreground leading-relaxed">
              8 conditions × 3 niche sizes × 3 maturation delays × 3 division limits × 5 taApoptosisRates.
              200 timesteps × 3 replicates per run. Same criterion as above: |λ| within 0.05 of 1/φ ≈ 0.618.
              <span className="text-amber-400 font-medium"> Takes approximately 3–4 minutes to complete.</span>
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {!fullEnrichment && (
                <Button
                  onClick={runFullEnrichment}
                  disabled={runningFullEnrichment}
                  className="w-full"
                  variant="outline"
                  size="lg"
                  data-testid="button-run-full-enrichment"
                >
                  {runningFullEnrichment ? (
                    <>
                      <Loader2 size={16} className="animate-spin mr-2" />
                      Running full sweep (~3–4 min)...
                    </>
                  ) : (
                    <>
                      <FlaskConical size={16} className="mr-2" />
                      Run Full 1,080-Run Sweep
                    </>
                  )}
                </Button>
              )}
              {fullEnrichmentError && <p className="text-sm text-red-500" data-testid="text-full-enrichment-error">{fullEnrichmentError}</p>}
              {fullEnrichment && (
                <div className="space-y-5" data-testid="full-enrichment-results">
                  <div className="p-3 rounded-lg bg-muted/50 text-sm">
                    <p className="font-semibold text-foreground mb-1">Geometric Null Baseline</p>
                    <p className="text-muted-foreground">
                      <span className="font-mono text-foreground">{fullEnrichment.null_pct}</span> of the stable AR(2) triangle has |λ| within 0.05 of 1/φ ≈ 0.618 by pure area.
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-foreground mb-2">Enrichment by Division Limit</p>
                    <div className="overflow-x-auto rounded-lg border border-border">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left p-2 text-muted-foreground">Stratum</th>
                            <th className="text-right p-2 text-muted-foreground">Runs</th>
                            <th className="text-right p-2 text-muted-foreground">|λ|≈1/φ</th>
                            <th className="text-right p-2 text-muted-foreground">Observed %</th>
                            <th className="text-right p-2 text-muted-foreground">Null %</th>
                            <th className="text-right p-2 text-muted-foreground">Fold</th>
                            <th className="text-right p-2 text-muted-foreground">P-value</th>
                            <th className="text-center p-2 text-muted-foreground">Sig.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fullEnrichment.by_division_limit.map((r, i) => {
                            const isDL2 = r.label === 'division_limit=2';
                            return (
                              <tr key={i} className={`border-t border-border ${isDL2 ? 'bg-amber-500/10 font-semibold' : ''}`} data-testid={`full-row-${r.label}`}>
                                <td className="p-2 font-mono text-foreground">{r.label} {isDL2 && <span className="text-amber-400 text-[10px] ml-1">★ predicted</span>}</td>
                                <td className="p-2 text-right font-mono">{r.total_runs}</td>
                                <td className="p-2 text-right font-mono">{r.fib_consistent}</td>
                                <td className="p-2 text-right font-mono">{r.observed_rate.toFixed(1)}%</td>
                                <td className="p-2 text-right font-mono text-muted-foreground">{r.null_fraction.toFixed(1)}%</td>
                                <td className={`p-2 text-right font-mono ${r.fold_enrichment >= 1.5 ? 'text-emerald-400' : r.fold_enrichment < 0.8 ? 'text-red-400' : 'text-foreground'}`}>{r.fold_enrichment.toFixed(2)}×</td>
                                <td className="p-2 text-right font-mono text-muted-foreground">{pLabel(r.p_value)}</td>
                                <td className="p-2 text-center">{r.significant ? <CheckCircle size={13} className="text-emerald-400 mx-auto" /> : <AlertCircle size={13} className="text-muted-foreground mx-auto" />}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-foreground mb-2">division_limit=2 — by TA Apoptosis Rate</p>
                    <div className="overflow-x-auto rounded-lg border border-border">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left p-2 text-muted-foreground">ta_apoptosis_rate</th>
                            <th className="text-right p-2 text-muted-foreground">Runs</th>
                            <th className="text-right p-2 text-muted-foreground">|λ|≈1/φ</th>
                            <th className="text-right p-2 text-muted-foreground">Observed %</th>
                            <th className="text-right p-2 text-muted-foreground">Fold</th>
                            <th className="text-right p-2 text-muted-foreground">P-value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fullEnrichment.division_limit2_by_ta_rate.map((r, i) => {
                            const isPeak = r.label === 'ta_apoptosis_rate=0.4';
                            return (
                              <tr key={i} className={`border-t border-border ${isPeak ? 'bg-amber-500/10' : ''}`} data-testid={`full-ta-row-${i}`}>
                                <td className="p-2 font-mono text-foreground">{r.label}{isPeak && <span className="text-amber-400 ml-1 text-[10px]">≈ 1/φ²</span>}</td>
                                <td className="p-2 text-right font-mono">{r.total_runs}</td>
                                <td className="p-2 text-right font-mono">{r.fib_consistent}</td>
                                <td className="p-2 text-right font-mono">{r.observed_rate.toFixed(1)}%</td>
                                <td className={`p-2 text-right font-mono ${r.fold_enrichment >= 1.5 ? 'text-emerald-400' : r.fold_enrichment < 0.8 ? 'text-red-400' : 'text-foreground'}`}>{r.fold_enrichment.toFixed(2)}×</td>
                                <td className="p-2 text-right font-mono text-muted-foreground">{pLabel(r.p_value)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Theoretically motivated rate: ta_apoptosis_rate ≈ 0.40 (≈ 1/φ² ≈ 0.382). Highlighted in amber.</p>
                  </div>

                  <div className="p-4 rounded-lg border border-violet-500/30 bg-violet-500/5 text-sm space-y-2">
                    <p className="font-semibold text-violet-400">Key Finding — Full Sweep</p>
                    <p className="text-foreground">{fullEnrichment.key_finding}</p>
                    <p className="text-xs text-muted-foreground">{fullEnrichment.interpretation}</p>
                  </div>

                  <div className="flex justify-end">
                    <Button variant="ghost" size="sm" onClick={runFullEnrichment} disabled={runningFullEnrichment} className="text-muted-foreground text-xs" data-testid="button-rerun-full-enrichment">
                      {runningFullEnrichment ? <Loader2 size={12} className="animate-spin mr-1" /> : null}
                      Re-run full sweep
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Phi-Ratio Convergence Test — direct test of C(1,1)=M prediction */}
        <Card className="mb-8 border-emerald-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-400">
              <Target size={20} />
              C/P → φ Convergence Test — Direct Test of C(1,1) = M
            </CardTitle>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The C(1,1) = M algebraic proof predicts steady-state <span className="font-mono text-foreground">C/P → φ ≈ 1.618</span> and <span className="font-mono text-foreground">P/D → 1/φ ≈ 0.618</span>.
              This test asks whether division_limit=2 at ta≈0.382 produces these ratios more reliably than 1- or 3-stage models.
              Null = empirical overall convergence rate across all 1,080 runs (not a geometric argument).
              <span className="text-amber-400 font-medium"> Same 1,080-run sweep as above (~3–4 min).</span>
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {!phiConv && (
                <Button
                  onClick={runPhiConvergence}
                  disabled={runningPhiConv}
                  className="w-full"
                  variant="outline"
                  size="lg"
                  data-testid="button-run-phi-convergence"
                >
                  {runningPhiConv ? (
                    <><Loader2 size={16} className="animate-spin mr-2" />Running C/P convergence test (~3–4 min)...</>
                  ) : (
                    <><Target size={16} className="mr-2" />Run C/P → φ Convergence Test</>
                  )}
                </Button>
              )}
              {phiConvError && <p className="text-sm text-red-500" data-testid="text-phi-conv-error">{phiConvError}</p>}
              {phiConv && (
                <div className="space-y-5" data-testid="phi-conv-results">
                  {/* Empirical null baselines */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "C/P ≈ φ null rate", val: phiConv.null_pct_cp, desc: "across all 1,080 runs" },
                      { label: "P/D ≈ 1/φ null rate", val: phiConv.null_pct_pd, desc: "across all 1,080 runs" },
                      { label: "Both simultaneously", val: phiConv.null_pct_both, desc: "empirical null" },
                    ].map((item, i) => (
                      <div key={i} className="p-3 rounded-lg bg-muted/50 text-center">
                        <p className="text-xs text-muted-foreground">{item.label}</p>
                        <p className="font-mono text-lg font-bold text-foreground">{item.val}</p>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                    ))}
                  </div>

                  {/* By division limit — C/P column */}
                  <div>
                    <p className="text-sm font-semibold text-foreground mb-2">C/P → φ Convergence by Division Limit</p>
                    <div className="overflow-x-auto rounded-lg border border-border">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left p-2 text-muted-foreground">Stratum</th>
                            <th className="text-right p-2 text-muted-foreground">Runs</th>
                            <th className="text-right p-2 text-muted-foreground">C/P≈φ</th>
                            <th className="text-right p-2 text-muted-foreground">C/P%</th>
                            <th className="text-right p-2 text-muted-foreground">P/D%</th>
                            <th className="text-right p-2 text-muted-foreground">Both%</th>
                            <th className="text-right p-2 text-muted-foreground">C/P fold</th>
                            <th className="text-right p-2 text-muted-foreground">C/P p</th>
                            <th className="text-right p-2 text-muted-foreground">Mean C/P</th>
                            <th className="text-center p-2 text-muted-foreground">Sig.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {phiConv.by_division_limit.map((r, i) => {
                            const isDL2 = r.label === 'division_limit=2';
                            return (
                              <tr key={i} className={`border-t border-border ${isDL2 ? 'bg-emerald-500/10 font-semibold' : ''}`} data-testid={`phi-row-${r.label}`}>
                                <td className="p-2 font-mono text-foreground">{r.label} {isDL2 && <span className="text-emerald-400 text-[10px] ml-1">★ predicted</span>}</td>
                                <td className="p-2 text-right font-mono">{r.total_runs}</td>
                                <td className="p-2 text-right font-mono">{r.cp_converged}</td>
                                <td className="p-2 text-right font-mono">{r.cp_rate.toFixed(1)}%</td>
                                <td className="p-2 text-right font-mono text-muted-foreground">{r.pd_rate.toFixed(1)}%</td>
                                <td className="p-2 text-right font-mono text-muted-foreground">{r.both_rate.toFixed(1)}%</td>
                                <td className={`p-2 text-right font-mono ${r.cp_fold >= 1.3 ? 'text-emerald-400' : r.cp_fold < 0.8 ? 'text-red-400' : 'text-foreground'}`}>{r.cp_fold.toFixed(2)}×</td>
                                <td className="p-2 text-right font-mono text-muted-foreground">{pLabel(r.cp_p)}</td>
                                <td className={`p-2 text-right font-mono ${Math.abs(r.mean_cp_ratio - phiConv.phi_value) < 0.15 * phiConv.phi_value ? 'text-emerald-400' : 'text-foreground'}`}>{r.mean_cp_ratio.toFixed(3)}</td>
                                <td className="p-2 text-center">{r.cp_significant ? <CheckCircle size={13} className="text-emerald-400 mx-auto" /> : <AlertCircle size={13} className="text-muted-foreground mx-auto" />}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">φ = {phiConv.phi_value}, 1/φ = {phiConv.inv_phi_value}. Mean C/P highlighted green when within 15% of φ. Null = empirical overall rate across all runs.</p>
                  </div>

                  {/* division_limit=2 by TA rate */}
                  <div>
                    <p className="text-sm font-semibold text-foreground mb-2">division_limit=2 — C/P → φ by TA Apoptosis Rate</p>
                    <div className="overflow-x-auto rounded-lg border border-border">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left p-2 text-muted-foreground">ta_apoptosis_rate</th>
                            <th className="text-right p-2 text-muted-foreground">Runs</th>
                            <th className="text-right p-2 text-muted-foreground">C/P≈φ</th>
                            <th className="text-right p-2 text-muted-foreground">C/P%</th>
                            <th className="text-right p-2 text-muted-foreground">Both%</th>
                            <th className="text-right p-2 text-muted-foreground">C/P fold</th>
                            <th className="text-right p-2 text-muted-foreground">C/P p</th>
                            <th className="text-right p-2 text-muted-foreground">Mean C/P</th>
                          </tr>
                        </thead>
                        <tbody>
                          {phiConv.division_limit2_by_ta_rate.map((r, i) => {
                            const isPred = r.label === 'ta_apoptosis_rate=0.4';
                            return (
                              <tr key={i} className={`border-t border-border ${isPred ? 'bg-emerald-500/10' : ''}`} data-testid={`phi-ta-row-${i}`}>
                                <td className="p-2 font-mono text-foreground">{r.label}{isPred && <span className="text-emerald-400 ml-1 text-[10px]">≈ 1/φ²</span>}</td>
                                <td className="p-2 text-right font-mono">{r.total_runs}</td>
                                <td className="p-2 text-right font-mono">{r.cp_converged}</td>
                                <td className="p-2 text-right font-mono">{r.cp_rate.toFixed(1)}%</td>
                                <td className="p-2 text-right font-mono text-muted-foreground">{r.both_rate.toFixed(1)}%</td>
                                <td className={`p-2 text-right font-mono ${r.cp_fold >= 1.3 ? 'text-emerald-400' : r.cp_fold < 0.8 ? 'text-red-400' : 'text-foreground'}`}>{r.cp_fold.toFixed(2)}×</td>
                                <td className="p-2 text-right font-mono text-muted-foreground">{pLabel(r.cp_p)}</td>
                                <td className={`p-2 text-right font-mono ${Math.abs(r.mean_cp_ratio - phiConv.phi_value) < 0.15 * phiConv.phi_value ? 'text-emerald-400' : 'text-foreground'}`}>{r.mean_cp_ratio.toFixed(3)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">The golden-ratio condition predicts peak convergence at ta≈0.382 (tested at 0.40). Highlighted in green.</p>
                  </div>

                  {/* Key finding */}
                  <div className="p-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 text-sm space-y-2">
                    <p className="font-semibold text-emerald-400">Key Finding — C/P → φ Convergence Test</p>
                    <p className="text-foreground">{phiConv.key_finding}</p>
                    <p className="text-xs text-muted-foreground">{phiConv.interpretation}</p>
                  </div>

                  <div className="flex justify-end">
                    <Button variant="ghost" size="sm" onClick={runPhiConvergence} disabled={runningPhiConv} className="text-muted-foreground text-xs" data-testid="button-rerun-phi-convergence">
                      {runningPhiConv ? <Loader2 size={12} className="animate-spin mr-1" /> : null}
                      Re-run convergence test
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Fibonacci Connection Test — the targeted 3-stage experiment */}
        <Card className="mb-8 border-blue-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-400">
              <Dna size={20} />
              Space–Time Fibonacci Connection — 3-Stage Experiment
            </CardTitle>
            <p className="text-sm text-muted-foreground leading-relaxed space-y-1">
              The Fibonacci polynomial has two eigenvalues: <span className="font-mono text-foreground">φ</span> (governs steady-state spatial ratios) and <span className="font-mono text-foreground">1/φ</span> (governs temporal decay back to that state). 
              This experiment directly tests whether a system that is <em>spatially</em> Fibonacci-structured also shows <span className="font-mono text-foreground">|λ| ≈ 1/φ</span> in its <em>temporal</em> dynamics when probed by the circadian clock — and whether the circadian forcing is required for that signal to appear.
              <br /><span className="text-amber-400 font-medium">Three stages, ~2–3 min total. 12 replicates per condition.</span>
            </p>
            <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
              {[
                { label: "Stage A", desc: "Calibration scan — confirm β = 1/φ at ta=0.382", color: "text-blue-300" },
                { label: "Stage B", desc: "Circadian probe — dl=1,2,3 with clock, measure |λ|", color: "text-violet-300" },
                { label: "Stage C", desc: "Pulse recovery — same parameters, no clock, compare |λ|", color: "text-amber-300" },
              ].map((s, i) => (
                <div key={i} className="p-2 rounded bg-muted/40 border border-border">
                  <p className={`font-semibold ${s.color}`}>{s.label}</p>
                  <p className="text-muted-foreground leading-tight">{s.desc}</p>
                </div>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {!fibConn && (
                <Button onClick={runFibConnection} disabled={runningFibConn} className="w-full" variant="outline" size="lg" data-testid="button-run-fib-connection">
                  {runningFibConn
                    ? <><Loader2 size={16} className="animate-spin mr-2" />Running 3-stage experiment (~2–3 min)...</>
                    : <><Dna size={16} className="mr-2" />Run Space–Time Fibonacci Connection Test</>}
                </Button>
              )}
              {fibConnError && <p className="text-sm text-red-500" data-testid="text-fib-conn-error">{fibConnError}</p>}
              {fibConn && (
                <div className="space-y-6" data-testid="fib-conn-results">

                  {/* Stage A: Calibration */}
                  <div>
                    <p className="text-sm font-semibold text-blue-400 mb-1">Stage A — Calibration: β = 2×(1−ta)×tr vs ta_apoptosis_rate</p>
                    <p className="text-xs text-muted-foreground mb-2">
                      At ta = {fibConn.fibonacci_ta}, β = {fibConn.fibonacci_beta} ≈ 1/φ ≈ {fibConn.inv_phi}. This is the Fibonacci progression factor — the fraction of first-stage TA cells advancing to the second stage equals 1/φ. Cells highlighted where β is within 0.03 of 1/φ.
                    </p>
                    <div className="overflow-x-auto rounded-lg border border-border">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left p-2 text-muted-foreground">ta</th>
                            <th className="text-right p-2 text-muted-foreground">β = 2(1−ta)×0.5</th>
                            <th className="text-right p-2 text-muted-foreground">β near 1/φ?</th>
                            <th className="text-right p-2 text-muted-foreground">Mean C/P</th>
                            <th className="text-right p-2 text-muted-foreground">C/P near φ?</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fibConn.calibration.map((row, i) => (
                            <tr key={i} className={`border-t border-border ${row.beta_near_inv_phi ? 'bg-blue-500/15 font-semibold' : ''}`} data-testid={`cal-row-${i}`}>
                              <td className="p-2 font-mono text-foreground">{row.ta}{row.beta_near_inv_phi && <span className="text-blue-400 ml-1 text-[10px]">★ Fibonacci</span>}</td>
                              <td className={`p-2 text-right font-mono ${Math.abs(row.beta - fibConn.inv_phi) < 0.05 ? 'text-blue-400 font-bold' : 'text-foreground'}`}>{row.beta}</td>
                              <td className="p-2 text-right">{row.beta_near_inv_phi ? <CheckCircle size={12} className="text-blue-400 ml-auto" /> : <span className="text-muted-foreground">—</span>}</td>
                              <td className={`p-2 text-right font-mono ${row.cp_near_phi ? 'text-emerald-400 font-semibold' : 'text-foreground'}`}>{row.mean_cp}</td>
                              <td className="p-2 text-right">{row.cp_near_phi ? <CheckCircle size={12} className="text-emerald-400 ml-auto" /> : <span className="text-muted-foreground text-xs">{row.mean_cp > 0 ? `${((row.mean_cp - fibConn.phi) / fibConn.phi * 100).toFixed(0)}% off` : '—'}</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Stage B: Circadian probe */}
                  <div>
                    <p className="text-sm font-semibold text-violet-400 mb-1">Stage B — Circadian Probe: |λ| at ta=0.382, circadian ON</p>
                    <p className="text-xs text-muted-foreground mb-2">
                      Circadian clock acts as the natural perturbation. 12 replicates × 500 timesteps, AR(2) fit to last 300 steps. Prediction: division_limit=2 should show |λ| closest to 1/φ ≈ {fibConn.inv_phi}.
                    </p>
                    <div className="overflow-x-auto rounded-lg border border-border">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left p-2 text-muted-foreground">division_limit</th>
                            <th className="text-right p-2 text-muted-foreground">Mean |λ|</th>
                            <th className="text-right p-2 text-muted-foreground">±SD</th>
                            <th className="text-right p-2 text-muted-foreground">φ₁</th>
                            <th className="text-right p-2 text-muted-foreground">φ₂</th>
                            <th className="text-right p-2 text-muted-foreground">|dist from 1/φ|</th>
                            <th className="text-center p-2 text-muted-foreground">Within ±0.05?</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fibConn.circadian_probe.map((r, i) => {
                            const isDL2 = r.division_limit === 2;
                            const isClosest = fibConn.circadian_probe.every(other => other.division_limit === r.division_limit || r.distance_from_inv_phi <= other.distance_from_inv_phi);
                            return (
                              <tr key={i} className={`border-t border-border ${isDL2 ? 'bg-violet-500/10 font-semibold' : ''}`} data-testid={`circ-probe-${r.division_limit}`}>
                                <td className="p-2 font-mono text-foreground">
                                  dl={r.division_limit} {isDL2 && <span className="text-violet-400 text-[10px] ml-1">★ predicted</span>}
                                  {isClosest && !isDL2 && <span className="text-amber-400 text-[10px] ml-1">closest</span>}
                                </td>
                                <td className={`p-2 text-right font-mono font-bold ${r.near_inv_phi ? 'text-emerald-400' : Math.abs(r.mean_lambda - fibConn.inv_phi) < 0.10 ? 'text-yellow-400' : 'text-foreground'}`}>{r.mean_lambda}</td>
                                <td className="p-2 text-right font-mono text-muted-foreground">±{r.sd_lambda}</td>
                                <td className="p-2 text-right font-mono text-muted-foreground">{r.mean_phi1}</td>
                                <td className="p-2 text-right font-mono text-muted-foreground">{r.mean_phi2}</td>
                                <td className={`p-2 text-right font-mono ${r.distance_from_inv_phi < 0.05 ? 'text-emerald-400' : r.distance_from_inv_phi < 0.10 ? 'text-yellow-400' : 'text-foreground'}`}>{r.distance_from_inv_phi}</td>
                                <td className="p-2 text-center">{r.near_inv_phi ? <CheckCircle size={13} className="text-emerald-400 mx-auto" /> : <AlertCircle size={13} className="text-muted-foreground mx-auto" />}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Stage C: Pulse recovery */}
                  <div>
                    <p className="text-sm font-semibold text-amber-400 mb-1">Stage C — Pulse Recovery: natural eigenvalue, circadian OFF</p>
                    <p className="text-xs text-muted-foreground mb-2">
                      System runs to steady state (300 steps, no clock), receives a 50% pulse to P cohorts, then recovers for 200 steps (no clock). AR(2) of recovery gives the NATURAL eigenvalue. Theory predicts α = (1−0.382)×0.5 = 0.309 for all division limits — showing the circadian forcing is required to produce any 1/φ signature.
                    </p>
                    <div className="overflow-x-auto rounded-lg border border-border">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left p-2 text-muted-foreground">division_limit</th>
                            <th className="text-right p-2 text-muted-foreground">Mean |λ| (no clock)</th>
                            <th className="text-right p-2 text-muted-foreground">±SD</th>
                            <th className="text-right p-2 text-muted-foreground">φ₁</th>
                            <th className="text-right p-2 text-muted-foreground">φ₂</th>
                            <th className="text-right p-2 text-muted-foreground">Near α=0.309?</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fibConn.pulse_recovery.map((r, i) => (
                            <tr key={i} className={`border-t border-border ${r.division_limit === 2 ? 'bg-amber-500/10 font-semibold' : ''}`} data-testid={`pulse-${r.division_limit}`}>
                              <td className="p-2 font-mono text-foreground">dl={r.division_limit}</td>
                              <td className="p-2 text-right font-mono font-bold text-foreground">{r.mean_lambda}</td>
                              <td className="p-2 text-right font-mono text-muted-foreground">±{r.sd_lambda}</td>
                              <td className="p-2 text-right font-mono text-muted-foreground">{r.mean_phi1}</td>
                              <td className="p-2 text-right font-mono text-muted-foreground">{r.mean_phi2}</td>
                              <td className="p-2 text-right">
                                {Math.abs(r.mean_lambda - 0.309) < 0.05 ? <CheckCircle size={12} className="text-amber-400 ml-auto" /> : <span className="font-mono text-muted-foreground">{r.mean_lambda > 0.309 ? '+' : ''}{((r.mean_lambda - 0.309) * 100).toFixed(1)}%</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">If Stage B and Stage C give different |λ|, the circadian forcing is converting the spatial Fibonacci structure into a temporal signal. If they match, the forcing makes no difference.</p>
                  </div>

                  {/* Key finding */}
                  <div className="p-4 rounded-lg border border-blue-500/30 bg-blue-500/5 text-sm space-y-2">
                    <p className="font-semibold text-blue-400">Key Finding — Space–Time Connection</p>
                    <p className="text-foreground">{fibConn.key_finding}</p>
                    <p className="text-xs text-muted-foreground">{fibConn.interpretation}</p>
                  </div>

                  <div className="flex justify-end">
                    <Button variant="ghost" size="sm" onClick={runFibConnection} disabled={runningFibConn} className="text-muted-foreground text-xs" data-testid="button-rerun-fib-connection">
                      {runningFibConn ? <Loader2 size={12} className="animate-spin mr-1" /> : null}
                      Re-run experiment
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="mb-8 border-amber-500/30 bg-amber-500/5">
          <CardContent className="pt-5 text-sm text-muted-foreground space-y-2">
            <p className="font-semibold text-amber-400">File Descriptions</p>
            <div className="space-y-3">
              <div>
                <p className="font-semibold text-foreground">1. boman_simulation_timeseries.csv</p>
                <p>Raw time-series from the first 20 parameter combinations under the normal condition (12,000 rows: 200 timesteps × 3 replicates × 20 runs). Columns: simulation_id, time, C_cells, P_cells, D_cells, Lgr5_like, Wnt_like, Bmal1_like, mutation_load, condition. Note: simulation_id encodes replicate number (1–3), not run number; all rows are normal condition. Use boman_parameter_sweep.csv for disease/signaling conditions.</p>
              </div>
              <div>
                <p className="font-semibold text-foreground">2. boman_parameter_sweep.csv</p>
                <p>1,080 parameter combinations (3 niche sizes × 3 maturation delays × 3 division limits × 5 TA apoptosis rates × 8 conditions). Each row contains AR(2) coefficients (φ₁, φ₂) averaged across 3 replicates for all 3 compartments, plus fib_ratio_C, steady-state cell ratios, and phi_ratio_convergence flag. Pattern classes: normal, Fibonacci-consistent, Fibonacci-adjacent, Lucas-like, FAP-like, adenoma-like.</p>
              </div>
              <div>
                <p className="font-semibold text-foreground">3. fibonacci_consistent_region.csv</p>
                <p>Reference grid of (φ₁, φ₂) values with region labels: fib_core (|ratio−φ| {"<"} 0.05), fib_consistent ({"<"} 0.15), fib_adjacent ({"<"} 0.30), non_fibonacci, unstable. Includes eigenvalue modulus, root type, eigenperiod, and stability flag. This is a heuristic classification based on a chosen threshold — not a natural law. Small threshold changes materially affect class boundaries.</p>
              </div>
              <div>
                <p className="font-semibold text-foreground">4. ar2_coefficient_space.csv</p>
                <p>Per-compartment eigenvalue decomposition for the first 100 parameter sweep runs (300 rows: 100 runs × 3 compartments). Columns: gene (compartment label: Stem_Cell_Pool / Proliferating_Pool / Differentiated_Pool), dataset (sim_run_N_divlimN_taApoN_condition), φ₁, φ₂, root₁, root₂, |λ|, root type, category, Fibonacci distance, pattern class, fib_ratio, phi_ratio_convergence. All data are simulation-derived — no empirical gene data is included.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
