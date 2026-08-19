import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, FlaskConical, TrendingUp, BookOpen, CheckCircle, XCircle } from "lucide-react";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
  ResponsiveContainer, LineChart, Line,
} from "recharts";
import type { TooltipProps } from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AR2Result {
  state: string;
  compartment: string;
  phi1: number;
  phi2: number;
  lambda_modulus: number;
  r_squared: number;
  root_type: string;
  is_stable: boolean;
  oscillation_period: number;
  mean_value: number;
  color: string;
}

interface TrajectoryPoint {
  time: number;
  C: number;
  P: number;
  D: number;
  PD_ratio: number;
  state: string;
}

interface ParamRow {
  state: string;
  k1: number; k2: number; k3: number; k4: number; k5: number;
  C_eq: number; P_eq: number; D_eq: number;
  oscillation_period_theory: number;
  color: string;
}

interface OdeResult {
  parameterTable: ParamRow[];
  ar2Results: AR2Result[];
  trajectories: TrajectoryPoint[];
  interpretation: string;
  key_finding: string;
  source_note: string;
}

interface IntegrityResult {
  passed: boolean;
  phi1_expected: number;
  phi1_actual: number;
  phi1_error: number;
  phi2_expected: number;
  phi2_actual: number;
  phi2_error: number;
  r2_actual: number;
  lambda_modulus: number;
  message: string;
}

interface JacobianFibResult {
  fibonacci_fixed_point: {
    condition: string; k1: number; k2: number; k3: number; k4: number; k5: number;
    C_star: number; P_star: number; D_star: number; cp_ratio: number;
    phi: number; cp_equals_phi: boolean;
  };
  jacobian: {
    J_CP: number[][]; J_CP_symbolic: string; char_poly_symbolic: string;
    char_poly_coeff: number; eigenvalue_real: number; eigenvalue_imag: number;
    eigenvalue_modulus: number; eigenvalue_symbolic: string; type: string;
    oscillation_frequency_omega: number; oscillation_period: number;
  };
  fibonacci_polynomial: { expression: string; roots: number[]; root_moduli: number[] };
  numerical_ar2: {
    phi1: number; phi2: number; lambda_modulus: number;
    theoretical_phi1: number; theoretical_phi2: number; theoretical_lambda: number;
    delta_t: number; series_length: number;
  };
  comparison: {
    jacobian_char_poly: string; fibonacci_poly: string; are_same_polynomial: boolean;
    jacobian_eigenvalue_modulus: number; fibonacci_small_root_modulus: number;
    ar2_lambda_neutral_oscillator: number; ar2_lambda_circadian_data: number;
    conclusion: string;
  };
}

const STATE_COLORS: Record<string, string> = {
  'Normal':  '#10b981',
  'FAP':     '#f59e0b',
  'Adenoma': '#ef4444',
};

// ─── Module-level chart sub-components ───────────────────────────────────────

function ScatterDot(props: { cx?: number; cy?: number; payload?: AR2Result }) {
  const { cx = 0, cy = 0, payload } = props;
  if (!payload) return null;
  const col = payload.color;
  const size = 11;
  const cpt = payload.compartment;
  if (cpt === 'Stem (C)')
    return <circle cx={cx} cy={cy} r={size/2} fill={col} stroke="#fff" strokeWidth={1} opacity={0.9} />;
  if (cpt === 'Proliferating (P)')
    return <polygon points={`${cx},${cy-size/2} ${cx-size/2},${cy+size/2} ${cx+size/2},${cy+size/2}`} fill={col} stroke="#fff" strokeWidth={1} opacity={0.95} />;
  return <rect x={cx-size/2} y={cy-size/2} width={size} height={size} fill={col} stroke="#fff" strokeWidth={1} opacity={0.9} />;
}

function ScatterTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload as AR2Result;
  return (
    <div className="bg-background border border-border rounded p-2 text-xs space-y-1 shadow-lg max-w-60">
      <p className="font-bold" style={{ color: d.color }}>{d.state}</p>
      <p className="text-muted-foreground">{d.compartment}</p>
      <p>φ₁ = {d.phi1.toFixed(4)}, φ₂ = {d.phi2.toFixed(4)}</p>
      <p>|λ| = {d.lambda_modulus.toFixed(4)}</p>
      {d.oscillation_period > 0 && <p>Period: {d.oscillation_period.toFixed(2)} time units</p>}
    </div>
  );
}

// ─── Time series chart ────────────────────────────────────────────────────────

function TimeSeriesPanel({ trajectories }: { trajectories: TrajectoryPoint[] }) {
  const states = ['Normal', 'FAP', 'Adenoma'];
  const byState = (s: string) => trajectories.filter(t => t.state === s);
  const panels: Array<{ key: keyof TrajectoryPoint; label: string; plain: string }> = [
    { key: 'C', label: 'Cycling stem cells C(t)', plain: 'Actively dividing cells' },
    { key: 'P', label: 'Proliferating (non-cycling) P(t)', plain: 'Non-dividing growing cells' },
    { key: 'D', label: 'Differentiated D(t)', plain: 'Mature, finished cells' },
    { key: 'PD_ratio', label: 'P/D renewal ratio', plain: 'Balance of growing vs mature cells' },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {panels.map(({ key, label, plain }) => (
        <div key={key}>
          <p className="text-xs font-semibold text-foreground">{plain}</p>
          <p className="text-xs text-muted-foreground mb-1 font-mono">{label}</p>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
              <XAxis dataKey="time" type="number" domain={['dataMin', 'dataMax']} tick={{ fill: '#64748b', fontSize: 9 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 9 }} width={40} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', fontSize: '10px', padding: '4px 8px' }} labelFormatter={(v) => `t=${Number(v).toFixed(1)}`} formatter={(v: number) => v.toFixed(4)} />
              {states.map(s => (
                <Line key={s} data={byState(s)} dataKey={key as string} stroke={STATE_COLORS[s]} dot={false} strokeWidth={1.5} name={s} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ))}
      <div className="col-span-1 md:col-span-2 flex items-center gap-6 justify-center flex-wrap">
        {states.map(s => (
          <span key={s} className="flex items-center gap-1.5 text-xs" style={{ color: STATE_COLORS[s] }}>
            <span className="inline-block w-6 h-0.5 rounded" style={{ background: STATE_COLORS[s] }} />
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Coefficient scatter ──────────────────────────────────────────────────────

function CoeffScatter({ results }: { results: AR2Result[] }) {
  const byState = (state: string) =>
    results.filter(r => r.state === state && r.compartment !== 'P/D ratio')
           .map(r => ({ ...r, x: r.phi1, y: r.phi2 }));
  return (
    <ResponsiveContainer width="100%" height={420}>
      <ScatterChart margin={{ top: 20, right: 40, bottom: 45, left: 50 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
        <XAxis
          type="number" dataKey="x" domain={[1.5, 2.05]} name="φ₁"
          label={{ value: 'φ₁ — encodes oscillation speed (higher = slower)', position: 'insideBottom', offset: -28, fill: '#94a3b8', fontSize: 10 }}
          tick={{ fill: '#94a3b8', fontSize: 11 }}
        />
        <YAxis
          type="number" dataKey="y" domain={[-1.05, -0.85]} name="φ₂"
          label={{ value: 'φ₂ ≈ −1 (oscillatory signature)', angle: -90, position: 'insideLeft', offset: 8, fill: '#94a3b8', fontSize: 10 }}
          tick={{ fill: '#94a3b8', fontSize: 11 }}
        />
        <Tooltip content={ScatterTooltip} />
        <ReferenceLine y={-1} stroke="#64748b" strokeDasharray="4 2" strokeWidth={1.5} label={{ value: 'φ₂ = −1', position: 'right', fill: '#64748b', fontSize: 9 }} />
        <ReferenceLine x={2.0} stroke="#ef4444" strokeDasharray="3 3" strokeWidth={1} opacity={0.4} label={{ value: 'instability boundary', position: 'top', fill: '#ef4444', fontSize: 9 }} />
        {['Normal', 'FAP', 'Adenoma'].map(state => (
          <Scatter key={state} name={state} data={byState(state)} shape={<ScatterDot />} fill={STATE_COLORS[state]} />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  );
}

// ─── AR(2) results table ──────────────────────────────────────────────────────

function AR2Table({ results }: { results: AR2Result[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-xs">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left p-2 text-muted-foreground">State</th>
            <th className="text-left p-2 text-muted-foreground">Cell type</th>
            <th className="text-right p-2 text-muted-foreground">φ₁</th>
            <th className="text-right p-2 text-muted-foreground">φ₂</th>
            <th className="text-right p-2 text-muted-foreground">|λ|</th>
            <th className="text-right p-2 text-muted-foreground">Fit (R²)</th>
            <th className="text-right p-2 text-muted-foreground">Period (t)</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r, i) => (
            <tr key={i} className={`border-t border-border ${i % 4 === 0 && i > 0 ? 'border-t-2 border-t-muted' : ''}`}>
              <td className="p-2 font-semibold" style={{ color: r.color }}>{r.state}</td>
              <td className="p-2 text-muted-foreground">{r.compartment}</td>
              <td className="p-2 text-right font-mono">{r.phi1.toFixed(4)}</td>
              <td className="p-2 text-right font-mono">{r.phi2.toFixed(4)}</td>
              <td className="p-2 text-right font-mono text-muted-foreground">{r.lambda_modulus.toFixed(4)}</td>
              <td className="p-2 text-right text-muted-foreground">{r.r_squared.toFixed(3)}</td>
              <td className="p-2 text-right text-muted-foreground">{r.oscillation_period > 0 ? r.oscillation_period.toFixed(2) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


// ─── Integrity badge ──────────────────────────────────────────────────────────

function IntegrityBadge({ data }: { data: IntegrityResult }) {
  return (
    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${data.passed ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-red-500/40 bg-red-500/5'}`} data-testid="integrity-badge">
      {data.passed
        ? <CheckCircle size={14} className="text-emerald-400 shrink-0 mt-0.5" />
        : <XCircle    size={14} className="text-red-400 shrink-0 mt-0.5" />}
      <div className="space-y-0.5">
        <p className={`font-semibold ${data.passed ? 'text-emerald-400' : 'text-red-400'}`}>
          AR(2) engine {data.passed ? 'PASS' : 'FAIL'}
        </p>
        <p className="text-muted-foreground">
          Self-test: pure cosine (period 10) fitted to AR(2). Coefficient error {data.phi1_error.toExponential(1)}. R² = {data.r2_actual.toFixed(6)}.
        </p>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BomanODE() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OdeResult | null>(null);
  const [integrity, setIntegrity] = useState<IntegrityResult | null>(null);
  const [error, setError] = useState("");
  const [jacFib, setJacFib] = useState<JacobianFibResult | null>(null);
  const [jacFibLoading, setJacFibLoading] = useState(false);
  const [jacFibError, setJacFibError] = useState("");

  const run = async () => {
    setLoading(true);
    setError("");
    try {
      const [res, iRes] = await Promise.all([
        fetch("/api/boman-ode/validate"),
        fetch("/api/ar2-integrity-check"),
      ]);
      if (!res.ok) throw new Error(await res.text());
      const [main, integ] = await Promise.all([res.json(), iRes.json()]);
      setResult(main);
      if (!iRes.ok) return;
      setIntegrity(integ);
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
  };

  const runJacobianFib = async () => {
    setJacFibLoading(true);
    setJacFibError("");
    try {
      const res = await fetch("/api/boman-ode/jacobian-fibonacci");
      if (!res.ok) throw new Error(await res.text());
      setJacFib(await res.json());
    } catch (e) {
      setJacFibError(String(e));
    }
    setJacFibLoading(false);
  };

  useEffect(() => { run(); }, []);

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/boman-simulation">
            <Button variant="ghost" size="sm" className="gap-1" data-testid="link-ode-back">
              <ArrowLeft size={14} /> Boman Simulation
            </Button>
          </Link>
          <Link href="/model-zoo">
            <Button variant="ghost" size="sm" className="gap-1 text-emerald-400 hover:text-emerald-300" data-testid="link-model-zoo">
              <FlaskConical size={14} /> ODE Model Zoo
            </Button>
          </Link>
          <h1 className="text-2xl font-bold" data-testid="text-ode-title">
            Colon Crypt Model → AR(2) Validation
          </h1>
        </div>

        {/* Plain-English introduction */}
        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardContent className="pt-5 space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <BookOpen size={16} className="text-blue-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-blue-400 mb-1">What this page does — in plain English</p>
                <p className="text-muted-foreground leading-relaxed">
                  A published biology paper (Boman et al. 2026, <span className="italic">Cancers</span>) built a mathematical model of how cells inside a colon crypt — the tiny pockets lining your gut — grow and die. The model tracks three groups: <strong className="text-foreground">C</strong> (stem cells that actively divide), <strong className="text-foreground">P</strong> (cells that have stopped dividing but are still growing), and <strong className="text-foreground">D</strong> (fully mature cells heading toward extrusion). The model uses real measurements from patients with normal colons, FAP (a precancerous genetic condition), and adenoma (early cancer).
                </p>
                <p className="text-muted-foreground leading-relaxed mt-2">
                  We run that model forward in time, watch the three cell counts fluctuate, and then ask: <strong className="text-foreground">can our AR(2) summary statistic describe those fluctuations?</strong> If AR(2) captures a genuine biological signal, the three disease states should land in distinct regions of AR(2) coefficient space — separated by their differing oscillation speeds.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Model equations (compact) */}
        <Card className="border-violet-500/20 bg-violet-500/5">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm font-semibold text-violet-400 mb-2">The published model equations (Boman et al. 2026, Equations 6–8)</p>
            <div className="font-mono text-xs space-y-1 text-foreground bg-muted/40 rounded p-3 mb-2">
              <p>dC/dt = (k₁ − k₂·P) · C    — stem cells grow, slowed down when P is large</p>
              <p>dP/dt = (k₂·C − k₅) · P    — non-cycling cells expand when C is large</p>
              <p>dD/dt = k₃·P − k₄·D        — mature cells produced by P, lost by extrusion</p>
            </div>
            <p className="text-xs text-muted-foreground">
              The C–P pair behaves like a predator–prey system: they chase each other in a stable loop (never exploding, never dying out). The paper calls this a "neutrally stable equilibrium" — the cells oscillate forever around a fixed point. Each disease state has a different oscillation speed determined by how quickly cells die (k₅): cancer slows cell death, which slows the whole renewal cycle.
            </p>
          </CardContent>
        </Card>

        {loading && (
          <div className="flex items-center justify-center gap-3 py-16">
            <Loader2 size={24} className="animate-spin text-violet-400" />
            <span className="text-muted-foreground">Running the crypt model and fitting AR(2)...</span>
          </div>
        )}
        {error && <p className="text-red-500 text-sm" data-testid="text-ode-error">{error}</p>}

        {result && (
          <>
            {/* Parameter table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FlaskConical size={16} /> Rate constants — derived from real patient data (Table 1, Boman et al.)
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Each row is fitted to Ki67 staining measurements from actual tissue samples. k₁ = 1 sets the time scale.
                  A faster k₅ (apoptosis rate) means faster turnover and a shorter oscillation period.
                </p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-2 text-muted-foreground">Tissue state</th>
                        <th className="text-right p-2 text-muted-foreground">k₂ (polymerisation)</th>
                        <th className="text-right p-2 text-muted-foreground">k₅ (cell death)</th>
                        <th className="text-right p-2 text-muted-foreground">Stem C%</th>
                        <th className="text-right p-2 text-muted-foreground">Proliferating P%</th>
                        <th className="text-right p-2 text-muted-foreground">Differentiated D%</th>
                        <th className="text-right p-2 text-muted-foreground">Cycle length (theory)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.parameterTable.map((r, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="p-2 font-semibold" style={{ color: r.color }}>{r.state}</td>
                          <td className="p-2 text-right font-mono text-muted-foreground">{r.k2.toFixed(3)}</td>
                          <td className="p-2 text-right font-mono text-muted-foreground">{r.k5.toFixed(3)}</td>
                          <td className="p-2 text-right text-muted-foreground">{(r.C_eq * 100).toFixed(0)}%</td>
                          <td className="p-2 text-right text-muted-foreground">{(r.P_eq * 100).toFixed(0)}%</td>
                          <td className="p-2 text-right text-muted-foreground">{(r.D_eq * 100).toFixed(0)}%</td>
                          <td className="p-2 text-right text-muted-foreground">{r.oscillation_period_theory.toFixed(1)} time units</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Time series */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp size={16} /> Cell counts over time — the model oscillates, just as the paper predicts
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  The three cell populations rise and fall in a steady loop (started 30% away from the resting point to make the waves visible). Normal tissue cycles fastest; adenoma cycles slowest. This is a direct consequence of slower cell death in cancer.
                </p>
              </CardHeader>
              <CardContent>
                <TimeSeriesPanel trajectories={result.trajectories} />
              </CardContent>
            </Card>

            {/* Scatter — key result */}
            <Card className="border-amber-500/30">
              <CardHeader>
                <CardTitle className="text-base text-amber-400">
                  ◆ Where each disease state sits in AR(2) space
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Each AR(2) fit is summarised by two numbers, φ₁ and φ₂. All three disease states line up along the bottom of the chart (φ₂ ≈ −1 means "the data is oscillating"). They differ along the horizontal axis: φ₁ captures how fast the oscillation is — a higher φ₁ means a slower cycle. The red dashed line at φ₁ = 2.0 marks the instability boundary; all three states sit well within stable territory. The key result is the disease-state separation: normal, FAP, and adenoma occupy distinct positions driven by their different renewal rates and oscillation frequencies.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Shapes: ● Stem cells, ▲ Proliferating cells, ■ Differentiated cells.
                </p>
              </CardHeader>
              <CardContent>
                <CoeffScatter results={result.ar2Results} />
                <div className="flex items-center gap-6 justify-center mt-2 flex-wrap">
                  {['Normal', 'FAP', 'Adenoma'].map(s => (
                    <span key={s} className="flex items-center gap-1.5 text-xs" style={{ color: STATE_COLORS[s] }}>
                      <span className="inline-block w-3 h-3 rounded-full" style={{ background: STATE_COLORS[s] }} />
                      {s}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Numeric results table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Numeric results — all states and cell types</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  R² close to 1.0 means AR(2) fits the oscillating time series well. Each row shows the fitted AR(2) coefficients, eigenvalue modulus, and oscillation period for a given disease state and cell compartment.
                </p>
              </CardHeader>
              <CardContent>
                <AR2Table results={result.ar2Results} />
              </CardContent>
            </Card>

            {/* Key finding */}
            <Card className="border-emerald-500/30 bg-emerald-500/5">
              <CardContent className="pt-5 space-y-3">
                <p className="font-semibold text-emerald-400">What this tells us</p>
                <p className="text-sm text-foreground leading-relaxed" data-testid="text-key-finding">
                  {result.key_finding}
                </p>
                <div className="border-t border-emerald-500/20 pt-3 space-y-2">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <strong className="text-foreground">Why does this matter?</strong> The Boman ODE model — fitted to real patient tissue measurements — produces AR(2) coefficients that cleanly separate the three disease states along the φ₁ axis. This separation arises directly from biology: cancer slows cell death (k₅), which lengthens the renewal cycle, which raises φ₁. AR(2) encodes that frequency difference as a single coefficient. The eigenvalue modulus |λ| ≈ 0.618 (the platform's primary claim) comes from a different calculation — |λ| = √|φ₂| — and is robust across datasets and species. These are complementary but distinct findings.
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <strong className="text-foreground">Data source:</strong> {result.source_note}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Jacobian — Fibonacci fixed point analytical test */}
            <Card className="border-violet-500/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-violet-400 text-base">
                  <TrendingUp size={16} />
                  Analytical Test: Jacobian at the Fibonacci Fixed Point
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  The definitive question: at the parameter values where C*/P* = φ (the spatial Fibonacci fixed point), what does the Jacobian's characteristic polynomial look like — and does it match the Fibonacci polynomial x² − x − 1 = 0?
                </p>
              </CardHeader>
              <CardContent>
                {!jacFib && (
                  <Button onClick={runJacobianFib} disabled={jacFibLoading} variant="outline" className="w-full" data-testid="button-run-jacobian-fib">
                    {jacFibLoading
                      ? <><Loader2 size={14} className="animate-spin mr-2" />Computing analytical result...</>
                      : <>Run Jacobian → Fibonacci polynomial comparison</>}
                  </Button>
                )}
                {jacFibError && <p className="text-sm text-red-500 mt-2">{jacFibError}</p>}
                {jacFib && (
                  <div className="space-y-5 text-sm" data-testid="jacobian-fib-results">

                    {/* Step 1: Fibonacci fixed point */}
                    <div className="p-3 rounded-lg bg-muted/30 border border-border space-y-1.5">
                      <p className="font-semibold text-violet-400 text-xs uppercase tracking-wide">Step 1 — Fibonacci fixed point: {jacFib.fibonacci_fixed_point.condition}</p>
                      <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs font-mono">
                        <span className="text-muted-foreground">k₁ = {jacFib.fibonacci_fixed_point.k1}, k₂ = {jacFib.fibonacci_fixed_point.k2}, k₅ = {jacFib.fibonacci_fixed_point.k5}</span>
                        <span className="text-muted-foreground">C* = {jacFib.fibonacci_fixed_point.C_star}, P* = {jacFib.fibonacci_fixed_point.P_star}</span>
                        <span className={jacFib.fibonacci_fixed_point.cp_equals_phi ? 'text-emerald-400 font-bold' : 'text-foreground'}>
                          C*/P* = {jacFib.fibonacci_fixed_point.cp_ratio} {jacFib.fibonacci_fixed_point.cp_equals_phi ? '= φ ✓' : '≠ φ'}
                        </span>
                        <span className="text-muted-foreground">φ = {jacFib.fibonacci_fixed_point.phi}</span>
                      </div>
                    </div>

                    {/* Step 2: Jacobian */}
                    <div className="p-3 rounded-lg bg-muted/30 border border-border space-y-2">
                      <p className="font-semibold text-violet-400 text-xs uppercase tracking-wide">Step 2 — Jacobian C-P block at equilibrium</p>
                      <p className="text-xs text-muted-foreground">Substituting C* = k₅/k₂ and P* = k₁/k₂ into the partial derivatives — the diagonal terms vanish (equilibrium condition), leaving:</p>
                      <div className="font-mono text-xs bg-background/60 rounded p-2 space-y-1">
                        <p>J_CP = {jacFib.jacobian.J_CP_symbolic}</p>
                        <p>det(J_CP − λI) = <span className="text-amber-300 font-bold">{jacFib.jacobian.char_poly_symbolic}</span></p>
                        <p>Eigenvalues: λ = <span className="text-amber-300 font-bold">{jacFib.jacobian.eigenvalue_symbolic}</span> = ±{jacFib.jacobian.eigenvalue_imag}i</p>
                        <p className="text-violet-300">|λ| = √φ ≈ {jacFib.jacobian.eigenvalue_modulus} — NOT 1/φ</p>
                        <p className="text-muted-foreground">Type: <span className="text-amber-400">{jacFib.jacobian.type}</span></p>
                        <p className="text-muted-foreground">Oscillation period: {jacFib.jacobian.oscillation_period.toFixed(2)} time-units (ω = √φ ≈ {jacFib.jacobian.oscillation_frequency_omega})</p>
                      </div>
                    </div>

                    {/* Step 3: Fibonacci polynomial comparison */}
                    <div className="p-3 rounded-lg bg-muted/30 border border-border space-y-2">
                      <p className="font-semibold text-violet-400 text-xs uppercase tracking-wide">Step 3 — Polynomial comparison</p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="text-left p-2 text-muted-foreground">Polynomial</th>
                              <th className="text-left p-2 text-muted-foreground">Expression</th>
                              <th className="text-left p-2 text-muted-foreground">Roots</th>
                              <th className="text-left p-2 text-muted-foreground">Root moduli</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-t border-border">
                              <td className="p-2 font-semibold text-violet-300">Jacobian (at φ fixed pt)</td>
                              <td className="p-2 font-mono">{jacFib.comparison.jacobian_char_poly}</td>
                              <td className="p-2 font-mono">±i√φ (purely imaginary)</td>
                              <td className="p-2 font-mono">{jacFib.comparison.jacobian_eigenvalue_modulus} (= √φ)</td>
                            </tr>
                            <tr className="border-t border-border">
                              <td className="p-2 font-semibold text-amber-300">Fibonacci polynomial</td>
                              <td className="p-2 font-mono">{jacFib.comparison.fibonacci_poly}</td>
                              <td className="p-2 font-mono">{jacFib.fibonacci_polynomial.roots[0]}, {jacFib.fibonacci_polynomial.roots[1]}</td>
                              <td className="p-2 font-mono">{jacFib.fibonacci_polynomial.root_moduli[0]}, {jacFib.fibonacci_polynomial.root_moduli[1]}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      <div className="flex items-center gap-2 text-xs mt-1">
                        <XCircle size={13} className="text-red-400 flex-shrink-0" />
                        <span className="text-red-400 font-semibold">These are different polynomials.</span>
                        <span className="text-muted-foreground">The Jacobian at the Fibonacci fixed point is NOT the Fibonacci polynomial.</span>
                      </div>
                    </div>

                    {/* Step 4: Numerical AR(2) of perturbation recovery */}
                    <div className="p-3 rounded-lg bg-muted/30 border border-border space-y-2">
                      <p className="font-semibold text-violet-400 text-xs uppercase tracking-wide">Step 4 — Numerical confirmation: AR(2) of perturbation recovery</p>
                      <p className="text-xs text-muted-foreground">20% perturbation to equilibrium. ODE integrated 120 time-units, sampled every Δt = {jacFib.numerical_ar2.delta_t}. {jacFib.numerical_ar2.series_length} data points. Theory: φ₁ = 2cos(√φ·Δt) = {jacFib.numerical_ar2.theoretical_phi1}, φ₂ = {jacFib.numerical_ar2.theoretical_phi2}, |λ| = {jacFib.numerical_ar2.theoretical_lambda} (neutral oscillator).</p>
                      <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                        {[
                          { label: 'φ₁ (theory)', val: jacFib.numerical_ar2.theoretical_phi1, actual: jacFib.numerical_ar2.phi1, color: 'text-blue-300' },
                          { label: 'φ₂ (theory)', val: jacFib.numerical_ar2.theoretical_phi2, actual: jacFib.numerical_ar2.phi2, color: 'text-blue-300' },
                          { label: '|λ| (theory)', val: jacFib.numerical_ar2.theoretical_lambda, actual: jacFib.numerical_ar2.lambda_modulus, color: jacFib.comparison.ar2_lambda_circadian_data && Math.abs(jacFib.numerical_ar2.lambda_modulus - 1) < 0.05 ? 'text-emerald-400' : 'text-amber-400' },
                        ].map((r, i) => (
                          <div key={i} className="p-2 rounded bg-background/60 border border-border">
                            <p className="text-muted-foreground text-[10px]">{r.label}</p>
                            <p className={`font-bold ${r.color}`}>{r.val}</p>
                            <p className="text-[10px] text-muted-foreground">actual: {typeof r.actual === 'number' ? r.actual.toFixed(4) : r.actual}</p>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 text-xs mt-1">
                        {Math.abs(jacFib.numerical_ar2.lambda_modulus - 1) < 0.1
                          ? <CheckCircle size={13} className="text-emerald-400 flex-shrink-0" />
                          : <XCircle size={13} className="text-amber-400 flex-shrink-0" />}
                        <span>Numerical |λ| = <span className="font-mono font-bold text-foreground">{jacFib.numerical_ar2.lambda_modulus}</span> — {Math.abs(jacFib.numerical_ar2.lambda_modulus - 1) < 0.1 ? 'confirms neutral oscillation (|λ| ≈ 1), NOT 1/φ ≈ 0.618' : `distance from 1: ${Math.abs(jacFib.numerical_ar2.lambda_modulus - 1).toFixed(4)}`}</span>
                      </div>
                    </div>

                    {/* Conclusion */}
                    <div className="p-4 rounded-lg border border-violet-500/30 bg-violet-500/5 space-y-2">
                      <p className="font-semibold text-violet-400 text-sm">Conclusion — What the Jacobian test shows</p>
                      <p className="text-xs text-foreground leading-relaxed">{jacFib.comparison.conclusion}</p>
                      <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
                        {[
                          { label: 'Spatial Fibonacci structure', val: 'C*/P* = φ at k₅=φ·k₁', status: 'confirmed', color: 'text-emerald-400' },
                          { label: 'Jacobian characteristic polynomial', val: jacFib.comparison.jacobian_char_poly, status: 'λ²+φ≠Fibonacci poly', color: 'text-red-400' },
                          { label: '|λ| at Fibonacci fixed point', val: `${jacFib.comparison.ar2_lambda_neutral_oscillator} (neutral oscillation)`, status: 'NOT 1/φ', color: 'text-amber-400' },
                          { label: '|λ| in real circadian data', val: `≈ ${jacFib.comparison.ar2_lambda_circadian_data} (empirical)`, status: 'separate observation', color: 'text-blue-400' },
                        ].map((r, i) => (
                          <div key={i} className="p-2 rounded bg-muted/40 border border-border">
                            <p className="text-muted-foreground text-[10px] uppercase tracking-wide">{r.label}</p>
                            <p className="font-mono font-semibold text-foreground text-[11px]">{r.val}</p>
                            <p className={`text-[10px] font-semibold ${r.color}`}>{r.status}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button variant="ghost" size="sm" onClick={runJacobianFib} disabled={jacFibLoading} className="text-muted-foreground text-xs" data-testid="button-rerun-jacobian-fib">
                        {jacFibLoading ? <Loader2 size={12} className="animate-spin mr-1" /> : null}Re-run
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Engine integrity self-test */}
            {integrity && (
              <div data-testid="section-integrity">
                <p className="text-xs text-muted-foreground mb-1.5 font-semibold uppercase tracking-wide">Engine self-test</p>
                <IntegrityBadge data={integrity} />
                <p className="text-xs text-muted-foreground mt-1.5">
                  A pure cosine with period 10 samples produces exact AR(2) coefficients — this test verifies the core fitting engine is working correctly before trusting any result on this page.
                </p>
              </div>
            )}

            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={run} disabled={loading} className="text-muted-foreground text-xs" data-testid="button-ode-rerun">
                {loading ? <Loader2 size={12} className="animate-spin mr-1" /> : null}
                Re-run analysis
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
