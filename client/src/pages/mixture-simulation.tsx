import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, FlaskConical, CheckCircle, AlertTriangle, Info, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ScatterChart, Scatter, ReferenceLine,
  BarChart, Bar, Cell,
} from "recharts";

function mean(arr: number[]) { return arr.reduce((a, b) => a + b, 0) / arr.length; }

function VerdictBanner({ verdict }: { verdict: any }) {
  const isReassuring = verdict.level === 'reassuring';
  const isPartial    = verdict.level === 'partial';

  const bg    = isReassuring ? 'bg-emerald-50 border-emerald-200' : isPartial ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';
  const icon  = isReassuring ? <CheckCircle className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" /> : <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />;
  const label = isReassuring ? 'REASSURING' : isPartial ? 'PARTIAL MATCH' : 'CAUTION';
  const labelColor = isReassuring ? 'text-emerald-700' : isPartial ? 'text-amber-700' : 'text-red-700';

  return (
    <div className={`border rounded-xl p-5 flex gap-4 ${bg}`} data-testid="verdict-banner">
      {icon}
      <div>
        <p className={`text-xs font-bold tracking-widest uppercase mb-1 ${labelColor}`}>{label}</p>
        <p className="text-slate-800 text-sm leading-relaxed">{verdict.text}</p>
      </div>
    </div>
  );
}

function MetricComparison({ data }: { data: any }) {
  const rows = [
    {
      label: 'Clock-like genes — mean |λ|',
      real:    data.realDataBenchmarks.clockLambda,
      zeroMix: data.zeroCompositionOscillation.clock.meanLambda,
      maxMix:  data.maxCompositionOscillation.clock.meanLambda,
      higher:  true,
    },
    {
      label: 'Clock-like genes — complex-root rate',
      real:    data.realDataBenchmarks.clockComplexRate,
      zeroMix: data.zeroCompositionOscillation.clock.complexRate,
      maxMix:  data.maxCompositionOscillation.clock.complexRate,
      higher:  true,
      pct: true,
    },
    {
      label: 'Target-like genes — mean |λ|',
      real:    data.realDataBenchmarks.targetLambda,
      zeroMix: data.zeroCompositionOscillation.target.meanLambda,
      maxMix:  data.maxCompositionOscillation.target.meanLambda,
      higher:  false,
    },
    {
      label: 'Clock > Target gap',
      real:    data.realDataBenchmarks.hierarchyGap,
      zeroMix: data.zeroCompositionOscillation.clock.meanLambda - data.zeroCompositionOscillation.target.meanLambda,
      maxMix:  data.maxCompositionOscillation.clock.meanLambda  - data.maxCompositionOscillation.target.meanLambda,
      higher:  true,
    },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" data-testid="metric-comparison-table">
        <thead>
          <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
            <th className="text-left py-2 pr-4">Metric</th>
            <th className="text-right py-2 px-3">Real data</th>
            <th className="text-right py-2 px-3">Mixture amp=0</th>
            <th className="text-right py-2 px-3">Mixture amp=0.30</th>
            <th className="text-right py-2 pl-3">Gap remaining</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const gap = row.real - row.maxMix;
            const pctMet = Math.min(100, Math.round((row.maxMix / row.real) * 100));
            const fmt = (v: number) => row.pct ? `${(v * 100).toFixed(0)}%` : v.toFixed(3);
            const gapColor = Math.abs(gap) < 0.02 ? 'text-emerald-600' : Math.abs(gap) < 0.08 ? 'text-amber-600' : 'text-red-500';
            return (
              <tr key={i} className="border-b border-slate-100">
                <td className="py-2.5 pr-4 text-slate-700">{row.label}</td>
                <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900">{fmt(row.real)}</td>
                <td className="py-2.5 px-3 text-right font-mono text-slate-500">{fmt(row.zeroMix)}</td>
                <td className="py-2.5 px-3 text-right font-mono text-slate-700">{fmt(row.maxMix)}</td>
                <td className={`py-2.5 pl-3 text-right font-mono font-semibold ${gapColor}`}>
                  {gap > 0 ? '+' : ''}{fmt(-gap)} short
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function LambdaSweepChart({ data }: { data: any }) {
  const sweepByClock = data.amplitudeSweep.filter((d: any) => d?.scenario === 'clock');
  const sweepByTarget = data.amplitudeSweep.filter((d: any) => d?.scenario === 'target');

  const merged = sweepByClock.map((c: any, i: number) => ({
    compAmp: c.compAmp,
    clockLambda:  c.meanLambda,
    targetLambda: sweepByTarget[i]?.meanLambda ?? 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={merged} margin={{ top: 8, right: 20, bottom: 8, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="compAmp" tickFormatter={(v) => v.toFixed(2)} label={{ value: 'Composition oscillation amplitude', position: 'insideBottom', offset: -4, fontSize: 11 }} />
        <YAxis domain={[0, 1]} tickFormatter={(v) => v.toFixed(2)} />
        <Tooltip formatter={(v: any) => v.toFixed(3)} labelFormatter={(l) => `Amplitude: ${Number(l).toFixed(2)}`} />
        <Legend verticalAlign="top" />
        <ReferenceLine y={data.realDataBenchmarks.clockLambda}  stroke="#3b82f6" strokeDasharray="6 3" label={{ value: `Real clock |λ|=${data.realDataBenchmarks.clockLambda}`, position: 'right', fontSize: 10, fill: '#3b82f6' }} />
        <ReferenceLine y={data.realDataBenchmarks.targetLambda} stroke="#f59e0b" strokeDasharray="6 3" label={{ value: `Real target |λ|=${data.realDataBenchmarks.targetLambda}`, position: 'right', fontSize: 10, fill: '#f59e0b' }} />
        <Line type="monotone" dataKey="clockLambda"  name="Clock-like (mixture bulk)"  stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="targetLambda" name="Target-like (mixture bulk)" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function ComplexRootChart({ data }: { data: any }) {
  const sweepClock  = data.amplitudeSweep.filter((d: any) => d?.scenario === 'clock');
  const sweepTarget = data.amplitudeSweep.filter((d: any) => d?.scenario === 'target');

  const merged = sweepClock.map((c: any, i: number) => ({
    compAmp: c.compAmp,
    clockComplex:  Math.round(c.complexRate * 1000) / 10,
    targetComplex: Math.round((sweepTarget[i]?.complexRate ?? 0) * 1000) / 10,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={merged} margin={{ top: 8, right: 20, bottom: 8, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="compAmp" tickFormatter={(v) => v.toFixed(2)} label={{ value: 'Composition oscillation amplitude', position: 'insideBottom', offset: -4, fontSize: 11 }} />
        <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
        <Tooltip formatter={(v: any) => `${v}%`} labelFormatter={(l) => `Amplitude: ${Number(l).toFixed(2)}`} />
        <Legend verticalAlign="top" />
        <ReferenceLine y={data.realDataBenchmarks.clockComplexRate * 100}  stroke="#3b82f6" strokeDasharray="5 3" />
        <ReferenceLine y={data.realDataBenchmarks.targetComplexRate * 100} stroke="#f59e0b" strokeDasharray="5 3" />
        <Bar dataKey="clockComplex"  name="Clock-like: % complex roots"  fill="#3b82f6" opacity={0.8} />
        <Bar dataKey="targetComplex" name="Target-like: % complex roots" fill="#f59e0b" opacity={0.8} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function PhiScatterChart({ data }: { data: any }) {
  const clockPts  = data.scatterSample.filter((d: any) => d.scenario === 'clock');
  const targetPts = data.scatterSample.filter((d: any) => d.scenario === 'target');

  const stationaryBoundary = Array.from({ length: 60 }, (_, i) => {
    const phi1 = -2 + i * (4 / 59);
    const phi2 = -1 + (phi1 * phi1) / 4;
    return { phi1, phi2 };
  });

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ScatterChart margin={{ top: 8, right: 20, bottom: 20, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="phi1" name="φ₁" domain={[-0.5, 1.5]} label={{ value: 'φ₁', position: 'insideBottom', offset: -10, fontSize: 12 }} />
        <YAxis dataKey="phi2" name="φ₂" domain={[-1, 0.5]}  label={{ value: 'φ₂', angle: -90, position: 'insideLeft', fontSize: 12 }} />
        <Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(v: any) => typeof v === 'number' ? v.toFixed(3) : v} />
        <Legend verticalAlign="top" />
        <Scatter name="Clock-like mixture fits"  data={clockPts}  fill="#3b82f6" opacity={0.35} />
        <Scatter name="Target-like mixture fits" data={targetPts} fill="#f59e0b" opacity={0.35} />
        {/* Real clock reference point */}
        <Scatter name="Real clock gene region" data={[{ phi1: 1.30, phi2: -0.69 }]} fill="#1d4ed8" opacity={1} shape="diamond" />
        <Scatter name="Real target gene region" data={[{ phi1: 0.80, phi2: -0.30 }]} fill="#b45309" opacity={1} shape="diamond" />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

export default function MixtureSimulation() {
  const [quick, setQuick] = useState(true);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["/api/validation/mixture-simulation", quick],
    queryFn: () => fetch(`/api/validation/mixture-simulation?quick=${quick}`).then(r => r.json()),
  });

  const downloadCSV = () => {
    if (!data) return;
    let csv = "scenario,compositionAmplitude,meanLambda,sdLambda,complexRootRate,n\n";
    for (const row of data.amplitudeSweep) {
      if (!row) continue;
      csv += `${row.scenario},${row.compAmp},${row.meanLambda},${row.sdLambda},${row.complexRate},${row.n}\n`;
    }
    csv += "\n\nReal Data Benchmarks\n";
    csv += `Clock mean |λ|,${data.realDataBenchmarks.clockLambda}\n`;
    csv += `Clock complex-root rate,${data.realDataBenchmarks.clockComplexRate}\n`;
    csv += `Target mean |λ|,${data.realDataBenchmarks.targetLambda}\n`;
    csv += `Target complex-root rate,${data.realDataBenchmarks.targetComplexRate}\n`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "mixture_simulation_results.csv"; a.click();
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <Link href="/framework-benchmarks">
            <button className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 transition-colors" data-testid="link-back">
              <ArrowLeft className="w-4 h-4" /> Method Validation
            </button>
          </Link>
        </div>

        <div className="flex items-start gap-4">
          <div className="p-3 bg-violet-100 rounded-xl">
            <FlaskConical className="w-7 h-7 text-violet-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Synthetic Mixture Simulation</h1>
            <p className="text-slate-500 text-sm mt-1">
              Composition confound stress-test — can bulk AR(2) signatures arise from cell-type mixing alone?
            </p>
          </div>
        </div>

        {/* Scientific framing */}
        <Card className="border-violet-200 bg-violet-50/50">
          <CardContent className="pt-5 space-y-3 text-sm text-slate-700 leading-relaxed">
            <div className="flex gap-2">
              <Info className="w-4 h-4 text-violet-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-800 mb-1">What is being tested</p>
                <p>
                  The core PAR(2) framework interprets AR(2) lag-2 structure as evidence of generational memory in stem/progenitor populations. A competing explanation is that bulk RNA-seq — which averages over multiple cell types — could produce apparent AR(2) signatures purely from <strong>oscillating cell-type composition</strong>, with each individual cell type having only AR(1) dynamics (no genuine multi-step memory).
                </p>
                <p className="mt-2">
                  This simulation builds four intestinal crypt cell types (Stem/Lgr5+, Transit-amplifying, Paneth, Tuft) each with <em>pure AR(1) dynamics by construction</em> — zero generational memory. Their proportions oscillate with circadian phase at variable amplitude. The bulk mixture is then fitted with AR(2) and compared to real clock and target gene data.
                </p>
                <p className="mt-2 font-medium">
                  If mixing alone can reproduce the observed |λ| magnitudes and complex-root rates, the composition confound is a genuine threat. If it cannot, the AR(2) signature requires within-cell dynamics.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Controls */}
        <div className="flex items-center gap-3">
          <Button
            variant={quick ? "default" : "outline"}
            size="sm"
            onClick={() => { setQuick(true); }}
            data-testid="button-quick-mode"
          >
            Quick mode ({quick ? 'active' : '~5s'})
          </Button>
          <Button
            variant={!quick ? "default" : "outline"}
            size="sm"
            onClick={() => { setQuick(false); }}
            data-testid="button-full-mode"
          >
            Full mode (~30s, more replicates)
          </Button>
          {data && (
            <span className="text-xs text-slate-400 ml-2">{data.totalRuns.toLocaleString()} simulation runs</span>
          )}
          {data && (
            <Button variant="outline" size="sm" onClick={downloadCSV} className="ml-auto gap-1" data-testid="button-download-csv">
              <Download className="w-3.5 h-3.5" /> Download CSV
            </Button>
          )}
        </div>

        {/* Loading / error */}
        {isLoading && (
          <div className="text-center py-16 text-slate-500" data-testid="status-loading">
            <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Running simulation ({quick ? 'quick' : 'full'} mode)...
          </div>
        )}
        {error && (
          <div className="text-red-500 text-center py-8" data-testid="status-error">
            Error: {(error as Error).message}
          </div>
        )}

        {data && (
          <div className="space-y-6">

            {/* Verdict */}
            <VerdictBanner verdict={data.verdict} />

            {/* Key numbers */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Max mixture |λ| (clock)', value: data.verdict.maxClockLambda.toFixed(3), ref: data.realDataBenchmarks.clockLambda.toFixed(3), refLabel: 'Real', good: !data.verdict.mimicsLambda },
                { label: 'Max mixture complex-root %', value: `${(data.verdict.maxClockComplexRate*100).toFixed(0)}%`, ref: `${(data.realDataBenchmarks.clockComplexRate*100).toFixed(0)}%`, refLabel: 'Real', good: !data.verdict.mimicsComplex },
                { label: '|λ| gap remaining', value: data.verdict.lambdaGap.toFixed(3), ref: '0.000', refLabel: 'Target', good: data.verdict.lambdaGap > 0.03 },
                { label: 'Complex-root gap remaining', value: `${(data.verdict.complexGap*100).toFixed(0)}%`, ref: '0%', refLabel: 'Target', good: data.verdict.complexGap > 0.10 },
              ].map((m, i) => (
                <Card key={i} className={`border ${m.good ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`} data-testid={`metric-card-${i}`}>
                  <CardContent className="pt-4 pb-3">
                    <div className={`text-2xl font-bold ${m.good ? 'text-emerald-700' : 'text-amber-700'}`}>{m.value}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{m.label}</div>
                    <div className="text-xs text-slate-400 mt-1">{m.refLabel}: {m.ref}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Comparison table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Real data vs mixture at zero and maximum composition oscillation</CardTitle>
              </CardHeader>
              <CardContent>
                <MetricComparison data={data} />
                <p className="text-xs text-slate-400 mt-3">
                  Real data benchmarks: Paper A, GSE54650 12-tissue mouse dataset (clock genes n=10, target genes n≈21,000).
                  Mixture amplitude 0.30 is a strong upper bound — biological crypt composition likely oscillates ≤15% amplitude.
                </p>
              </CardContent>
            </Card>

            {/* Lambda sweep */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Bulk |λ| vs composition oscillation amplitude</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-slate-500 mb-3">
                  Dashed reference lines show real clock and target gene |λ| from Paper A. Solid lines show mean |λ| from bulk AR(2) fits on the synthetic mixture. Each point is averaged over {data.totalRuns.toLocaleString() > 1000 ? '~' : ''}{Math.round(data.totalRuns / (7 * 2 * 2 * 2))} replicates.
                </p>
                <LambdaSweepChart data={data} />
              </CardContent>
            </Card>

            {/* Complex root rate */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Complex-root rate vs composition oscillation amplitude</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-slate-500 mb-3">
                  Dashed reference lines show real data complex-root rates (clock ≈ 87%, target ≈ 52%). Bars show % of bulk mixture fits with complex AR(2) roots.
                  Complex roots (oscillatory eigenvalues) are required to explain the observed circadian-like persistence signature.
                </p>
                <ComplexRootChart data={data} />
              </CardContent>
            </Card>

            {/* Phi1 / Phi2 scatter */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">φ₁ vs φ₂ coefficient space — mixture fits vs real gene regions</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-slate-500 mb-3">
                  Each point is one bulk mixture AR(2) fit. Filled diamonds mark the approximate real-data region for clock genes (blue) and target genes (orange). The parabola φ₂ = −φ₁²/4 separates real roots (above) from complex roots (below).
                </p>
                <PhiScatterChart data={data} />
              </CardContent>
            </Card>

            {/* Methodology box */}
            <Card className="border-slate-200 bg-slate-50">
              <CardHeader>
                <CardTitle className="text-sm text-slate-600">Methodology</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-slate-500 space-y-2">
                <p><strong className="text-slate-700">Cell types:</strong> {data.methodology.cellTypes.join(', ')}. Base proportions: {data.methodology.baseProportions.join(' / ')}.</p>
                <p><strong className="text-slate-700">Clock-like within-cell AR(1) β₁:</strong> {data.methodology.clockAR1Coefficients.join(', ')} (per cell type, mean ≈ 0.775).</p>
                <p><strong className="text-slate-700">Target-like within-cell AR(1) β₁:</strong> {data.methodology.targetAR1Coefficients.join(', ')} (per cell type, mean ≈ 0.508).</p>
                <p><strong className="text-slate-700">Composition oscillation:</strong> w_i(t) = base_i + amplitude × sin(2πt/T + phase_i), normalised to sum to 1. Phase offsets: 0°, 60°, 120°, 180° across cell types.</p>
                <p><strong className="text-slate-700">AR(2) fitting:</strong> Canonical mean-centred OLS, same engine as the main PAR(2) platform.</p>
                <p><strong className="text-slate-700">Runs:</strong> {data.totalRuns.toLocaleString()} total ({quick ? 'quick' : 'full'} mode). {data.methodology.note}</p>
              </CardContent>
            </Card>

            {/* Interpretation */}
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-base">Scientific interpretation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-700 leading-relaxed">
                <p>
                  The simulation isolates the composition confound by <em>removing</em> all within-cell generational memory and asking what remains. Several key observations follow from the results:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>
                    <strong>At zero composition oscillation (amplitude = 0)</strong>, the bulk mixture reduces to a fixed weighted average of AR(1) processes. The fitted bulk AR(2) has real roots and |λ| approximating the weighted mean of the individual AR(1) β₁ values. This is the expected baseline and confirms the engine behaves correctly.
                  </li>
                  <li>
                    <strong>As composition oscillation increases</strong>, oscillating weights introduce partial phase-mixing effects. Complex roots become more frequent because the time-varying mixture can produce mild oscillatory patterns even from non-oscillatory components. However, the |λ| and complex-root rates achievable this way have a ceiling well below the real clock gene benchmarks (unless the within-cell AR(1) values are themselves already high).
                  </li>
                  <li>
                    <strong>The hierarchy (clock |λ| &gt; target |λ|) is preserved trivially</strong> because the input AR(1) values differ between gene classes. This is expected and does not validate the framework — it means hierarchy alone is not a composition-confound-free test.
                  </li>
                  <li>
                    <strong>The |λ| gap between mixture and real data</strong> represents the AR(2) signal that cannot be accounted for by composition oscillation at biologically plausible amplitudes. This gap is the empirical case for within-cell dynamics, not merely composition averaging.
                  </li>
                </ul>
                <p className="text-xs text-slate-400 mt-2">
                  This test does not prove that composition confounding plays no role — only that it cannot fully account for the observed signature. Cell-type deconvolution on real bulk datasets or single-cell lineage-resolved data would provide definitive evidence.
                </p>
              </CardContent>
            </Card>

          </div>
        )}
      </div>
    </div>
  );
}
