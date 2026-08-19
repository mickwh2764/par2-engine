import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useScrollToHash } from "@/hooks/useScrollToHash";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Activity, Zap, Heart, Bug, Shield, Beaker,
  Play, CheckCircle, XCircle, AlertTriangle, ChevronDown, ChevronUp,
  TrendingUp, BarChart3, Sigma
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Radar
} from "recharts";
import HowTo from "@/components/HowTo";
import PaperCrossLinks from "@/components/PaperCrossLinks";
import { downloadAsCSV } from "@/components/DownloadResultsButton";
import { Download } from "lucide-react";

interface ModelParameter {
  name: string;
  key: string;
  min: number;
  max: number;
  step: number;
  default: number;
  description: string;
}

interface ModelDefinition {
  id: string;
  name: string;
  description: string;
  biologicalProxy: string;
  frameworkValue: string;
  variables: string[];
  parameters: ModelParameter[];
  predictionRule: string;
}

interface SimChannel {
  variable: string;
  series: number[];
  eigenvalue: number;
  phi1: number;
  phi2: number;
  r2: number;
  confidence: string;
  confidenceScore: number;
  confidenceColor: string;
  stability: string;
  diagnosticsSummary: { triggered: number; total: number; warnings: string[] };
}

interface PredictionCheck {
  description: string;
  passed: boolean;
  detail: string;
}

interface SimResult {
  modelId: string;
  modelName: string;
  time: number[];
  channels: SimChannel[];
  predictions: PredictionCheck[];
  parameterValues: Record<string, number>;
}

const MODEL_ICONS: Record<string, React.ReactNode> = {
  'fitzhugh-nagumo': <Heart size={20} className="text-rose-400" />,
  'goodwin': <Activity size={20} className="text-emerald-400" />,
  'van-der-pol': <Zap size={20} className="text-amber-400" />,
  'tyson-novak': <Bug size={20} className="text-purple-400" />,
  'lotka-volterra': <Shield size={20} className="text-cyan-400" />,
};

const MODEL_COLORS: Record<string, string[]> = {
  'fitzhugh-nagumo': ['#f43f5e', '#fb923c'],
  'goodwin': ['#22c55e', '#3b82f6', '#a855f7'],
  'van-der-pol': ['#facc15', '#f97316'],
  'tyson-novak': ['#a855f7', '#ec4899', '#6366f1'],
  'lotka-volterra': ['#06b6d4', '#f43f5e'],
};

function confidenceBadge(confidence: string, color: string) {
  return (
    <Badge
      variant="outline"
      className="text-xs font-mono"
      style={{ borderColor: color, color }}
      data-testid="badge-confidence"
    >
      {confidence}
    </Badge>
  );
}

function stabilityBadge(stability: string) {
  const colorMap: Record<string, string> = {
    'Rapidly Damped': 'text-blue-400 border-blue-500/40',
    'Responsive': 'text-cyan-400 border-cyan-500/40',
    'Moderately Persistent': 'text-green-400 border-green-500/40',
    'Persistent': 'text-amber-400 border-amber-500/40',
    'Near-Critical': 'text-orange-400 border-orange-500/40',
    'Critical Zone': 'text-red-400 border-red-500/40',
    'Unstable': 'text-red-500 border-red-600/40',
  };
  return (
    <Badge variant="outline" className={`text-xs ${colorMap[stability] || 'text-slate-500 border-slate-300/40'}`} data-testid="badge-stability">
      {stability}
    </Badge>
  );
}

function ParameterSlider({ param, value, onChange }: { param: ModelParameter; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col gap-1" data-testid={`param-${param.key}`}>
      <div className="flex justify-between items-center">
        <label className="text-xs text-slate-600 font-medium">{param.name}</label>
        <span className="text-xs font-mono text-emerald-400">{value.toFixed(param.step < 0.1 ? 2 : 1)}</span>
      </div>
      <input
        type="range"
        min={param.min}
        max={param.max}
        step={param.step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
        data-testid={`slider-${param.key}`}
      />
      <div className="flex justify-between text-[10px] text-slate-500">
        <span>{param.min}</span>
        <span>{param.max}</span>
      </div>
    </div>
  );
}

function TimeSeriesChart({ result, colors }: { result: SimResult; colors: string[] }) {
  const chartData = result.time.map((t, i) => {
    const point: Record<string, number> = { time: parseFloat(t.toFixed(2)) };
    result.channels.forEach((ch, ci) => {
      if (ch.series[i] !== undefined) point[ch.variable] = parseFloat(ch.series[i].toFixed(4));
    });
    return point;
  });

  const step = Math.max(1, Math.floor(chartData.length / 300));
  const downsampled = chartData.filter((_, i) => i % step === 0);

  return (
    <div className="h-64" data-testid="chart-timeseries">
      <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
        <LineChart data={downsampled}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10 }} label={{ value: 'Time', position: 'insideBottom', offset: -5, fill: '#64748b', fontSize: 11 }} />
          <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
            labelStyle={{ color: '#334155' }}
          />
          <Legend wrapperStyle={{ fontSize: '11px' }} />
          {result.channels.map((ch, i) => (
            <Line
              key={ch.variable}
              type="monotone"
              dataKey={ch.variable}
              stroke={colors[i % colors.length]}
              dot={false}
              strokeWidth={1.5}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function EigenvalueRing({ channels, colors }: { channels: SimChannel[]; colors: string[] }) {
  const ringData = channels.map((ch, i) => ({
    subject: ch.variable.split(' ')[0],
    eigenvalue: ch.eigenvalue,
    fill: colors[i % colors.length]
  }));

  return (
    <div className="h-48" data-testid="chart-eigenvalue-ring">
      <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
        <RadarChart data={ringData}>
          <PolarGrid stroke="#475569" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 10 }} />
          <PolarRadiusAxis domain={[0, 1.2]} tick={{ fill: '#64748b', fontSize: 9 }} />
          <Radar dataKey="eigenvalue" stroke="#22c55e" fill="#22c55e" fillOpacity={0.2} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

function PredictionCard({ prediction, index }: { prediction: PredictionCheck; index: number }) {
  return (
    <div
      className={`rounded-lg p-3 border ${prediction.passed ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}
      data-testid={`prediction-${index}`}
    >
      <div className="flex items-center gap-2 mb-1">
        {prediction.passed
          ? <CheckCircle size={14} className="text-emerald-400" />
          : <XCircle size={14} className="text-red-400" />
        }
        <span className={`text-xs font-medium ${prediction.passed ? 'text-emerald-300' : 'text-red-300'}`}>
          {prediction.description}
        </span>
      </div>
      <p className="text-[11px] text-slate-500 ml-5">{prediction.detail}</p>
    </div>
  );
}

function ModelPanel({ model }: { model: ModelDefinition }) {
  const [params, setParams] = useState<Record<string, number>>(() => {
    const defaults: Record<string, number> = {};
    model.parameters.forEach(p => { defaults[p.key] = p.default; });
    return defaults;
  });
  const [expanded, setExpanded] = useState(false);

  const simulation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/model-zoo/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId: model.id, parameters: params })
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<SimResult>;
    }
  });

  const colors = MODEL_COLORS[model.id] || ['#22c55e', '#3b82f6'];
  const icon = MODEL_ICONS[model.id];

  const resetParams = () => {
    const defaults: Record<string, number> = {};
    model.parameters.forEach(p => { defaults[p.key] = p.default; });
    setParams(defaults);
  };

  return (
    <Card className="bg-slate-50 border-slate-200" data-testid={`model-card-${model.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {icon}
            <div>
              <CardTitle className="text-lg text-slate-900">{model.name}</CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">{model.biologicalProxy}</p>
            </div>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-slate-500 hover:text-slate-700 transition-colors"
            data-testid={`toggle-${model.id}`}
          >
            {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
        </div>
        <p className="text-sm text-slate-600 mt-2">{model.description}</p>
        <div className="mt-2 bg-slate-50 rounded p-2 border border-slate-200">
          <p className="text-xs text-slate-500"><span className="text-emerald-400 font-medium">Framework Value:</span> {model.frameworkValue}</p>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 space-y-4">
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-slate-900">Parameters</h4>
              <button onClick={resetParams} className="text-xs text-slate-500 hover:text-slate-700" data-testid={`reset-params-${model.id}`}>Reset Defaults</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {model.parameters.map(p => (
                <ParameterSlider
                  key={p.key}
                  param={p}
                  value={params[p.key]}
                  onChange={(v) => setParams(prev => ({ ...prev, [p.key]: v }))}
                />
              ))}
            </div>
          </div>

          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <p className="text-xs text-amber-300"><TrendingUp size={12} className="inline mr-1" /><span className="font-medium">Prediction Rule:</span> <span className="text-slate-600">{model.predictionRule}</span></p>
          </div>

          <Button
            onClick={() => simulation.mutate()}
            disabled={simulation.isPending}
            className="w-full bg-emerald-600 hover:bg-emerald-700"
            data-testid={`btn-simulate-${model.id}`}
          >
            {simulation.isPending ? (
              <><Activity size={14} className="mr-2 animate-spin" /> Simulating...</>
            ) : (
              <><Play size={14} className="mr-2" /> Run Simulation</>
            )}
          </Button>

          {simulation.isError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <p className="text-xs text-red-400">Simulation failed: {(simulation.error as Error).message}</p>
            </div>
          )}

          {simulation.data && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-slate-900 mb-2 flex items-center gap-2">
                  <BarChart3 size={14} className="text-emerald-400" /> Time Series Output
                </h4>
                <TimeSeriesChart result={simulation.data} colors={colors} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-slate-900 mb-2">AR(2) Eigenvalue Analysis</h4>
                  <div className="space-y-2">
                    {simulation.data.channels.map((ch, i) => (
                      <div key={ch.variable} className="bg-slate-100 rounded-lg p-3 border border-slate-200" data-testid={`channel-result-${i}`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-medium" style={{ color: colors[i % colors.length] }}>{ch.variable}</span>
                          <div className="flex gap-1.5">
                            {stabilityBadge(ch.stability)}
                            {confidenceBadge(ch.confidence, ch.confidenceColor)}
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-center">
                          <div>
                            <p className="text-[10px] text-slate-500">|λ|</p>
                            <p className="text-sm font-mono text-slate-900">{ch.eigenvalue.toFixed(4)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-500">φ₁</p>
                            <p className="text-sm font-mono text-slate-600">{ch.phi1.toFixed(4)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-500">φ₂</p>
                            <p className="text-sm font-mono text-slate-600">{ch.phi2.toFixed(4)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-500">R²</p>
                            <p className="text-sm font-mono text-slate-600">{ch.r2.toFixed(4)}</p>
                          </div>
                        </div>
                        {ch.diagnosticsSummary.triggered > 0 && (
                          <div className="mt-2 flex items-center gap-1">
                            <AlertTriangle size={10} className="text-amber-400" />
                            <span className="text-[10px] text-amber-400">{ch.diagnosticsSummary.triggered}/{ch.diagnosticsSummary.total} diagnostics triggered: {ch.diagnosticsSummary.warnings.join(', ')}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-slate-900 mb-2">Eigenvalue Ring</h4>
                  <div className="bg-slate-100 rounded-lg p-2 border border-slate-200">
                    <EigenvalueRing channels={simulation.data.channels} colors={colors} />
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-slate-900 mb-2 flex items-center gap-2">
                  <Beaker size={14} className="text-cyan-400" /> Prediction Validation
                </h4>
                <div className="space-y-2">
                  {simulation.data.predictions.map((pred, i) => (
                    <PredictionCard key={i} prediction={pred} index={i} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

interface RoundTripVarResult {
  variable: string;
  eigenvalue: number;
  phi1: number;
  phi2: number;
  r2: number;
  stability: string;
  isPhysicallyPlausible: boolean;
  note: string;
  period_estimated: number | null;
  phi1_predicted: number | null;
  phi1_error: number | null;
  phi1_match: boolean | null;
}

interface RoundTripModel {
  modelName: string;
  variables: string[];
  results: RoundTripVarResult[];
  overallPlausible: boolean;
}

interface RoundTripResponse {
  results: RoundTripModel[];
  summary: { totalModels: number; passed: number; passRate: number; verdict: string };
}

interface FloquetMultiplier {
  index: number;
  re: number;
  im: number;
  modulus: number;
  isTrivial: boolean;
  label: string;
}

interface FloquetAR2Row {
  variable: string;
  ar2Lambda: number;
  floquetModulus: number;
  gap: number;
  gapPct: number;
}

interface FloquetResult {
  supported: boolean;
  unsupportedReason?: string;
  modelId: string;
  modelName: string;
  period: number | null;
  periodUnit: string;
  floquetMultipliers: FloquetMultiplier[];
  ar2Comparison: FloquetAR2Row[];
  interpretation: string;
}

function RoundTripPanel({ data }: { data: RoundTripResponse }) {
  return (
    <Card id="round-trip" className="bg-white border-slate-200 scroll-mt-20 transition-all duration-500" data-testid="card-roundtrip-validation">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <Shield size={20} className="text-cyan-400" />
          <CardTitle className="text-lg text-slate-900">ODE-to-AR(2) Round-Trip Validation</CardTitle>
          <Badge
            variant="outline"
            className={`ml-auto text-xs font-mono ${data.summary.verdict === 'ALL_PASS' ? 'text-emerald-400 border-emerald-500/40' : 'text-amber-400 border-amber-500/40'}`}
            data-testid="badge-roundtrip-verdict"
          >
            {data.summary.passed}/{data.summary.totalModels} PASS ({data.summary.passRate}%)
          </Badge>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Independent validation: each ODE model is simulated via RK4, sampled, AR(2)-fitted, and eigenvalues checked against physically plausible ranges.
          These are plausibility checks confirming the AR(2) pipeline correctly recovers dynamical signatures.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="overflow-x-auto">
          <table className="w-full text-xs" data-testid="table-roundtrip">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-2 px-2 text-left text-slate-500 font-medium">Model</th>
                <th className="py-2 px-2 text-left text-slate-500 font-medium">Variable</th>
                <th className="py-2 px-2 text-center text-slate-500 font-medium">|λ|</th>
                <th className="py-2 px-2 text-center text-slate-500 font-medium">R²</th>
                <th className="py-2 px-2 text-center text-slate-500 font-medium">Period</th>
                <th className="py-2 px-2 text-center text-slate-500 font-medium">φ₁ pred.</th>
                <th className="py-2 px-2 text-center text-slate-500 font-medium">φ₁ fit</th>
                <th className="py-2 px-2 text-center text-slate-500 font-medium">Match</th>
                <th className="py-2 px-2 text-center text-slate-500 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.results.flatMap(model =>
                model.results.map((r, ri) => {
                  const matchColor = r.phi1_match === true
                    ? 'text-emerald-400'
                    : r.phi1_match === false
                    ? 'text-amber-400'
                    : 'text-slate-500';
                  return (
                    <tr key={`${model.modelName}-${ri}`} className="border-b border-slate-200 hover:bg-slate-50" data-testid={`row-roundtrip-${model.modelName.replace(/[^a-zA-Z0-9]/g, '-')}-${ri}`}>
                      <td className="py-1.5 px-2 text-slate-900 font-medium">{ri === 0 ? model.modelName : ''}</td>
                      <td className="py-1.5 px-2 text-slate-600">{r.variable}</td>
                      <td className="py-1.5 px-2 text-center font-mono text-cyan-300" data-testid={`text-eigenvalue-${model.modelName.replace(/[^a-zA-Z0-9]/g, '-')}-${ri}`}>{r.eigenvalue.toFixed(4)}</td>
                      <td className="py-1.5 px-2 text-center font-mono text-slate-600" data-testid={`text-r2-${model.modelName.replace(/[^a-zA-Z0-9]/g, '-')}-${ri}`}>{r.r2.toFixed(3)}</td>
                      <td className="py-1.5 px-2 text-center font-mono text-slate-500">
                        {r.period_estimated != null ? r.period_estimated.toFixed(1) : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="py-1.5 px-2 text-center font-mono text-amber-300">
                        {r.phi1_predicted != null ? r.phi1_predicted.toFixed(4) : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="py-1.5 px-2 text-center font-mono text-slate-800">
                        {r.phi1.toFixed(4)}
                      </td>
                      <td className={`py-1.5 px-2 text-center font-mono text-xs ${matchColor}`}>
                        {r.phi1_match === true && '✓'}
                        {r.phi1_match === false && `Δ${r.phi1_error?.toFixed(3)}`}
                        {r.phi1_match === null && <span className="text-slate-600">—</span>}
                      </td>
                      <td className="py-1.5 px-2 text-center" data-testid={`status-roundtrip-${model.modelName.replace(/[^a-zA-Z0-9]/g, '-')}-${ri}`}>
                        {r.isPhysicallyPlausible
                          ? <CheckCircle size={14} className="text-emerald-400 inline" />
                          : <XCircle size={14} className="text-red-400 inline" />
                        }
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          <strong className="text-slate-500">Period</strong> — measured from simulated trace (ODE time units).
          <strong className="text-slate-500 ml-2">φ₁ pred.</strong> — theoretical prediction: 2cos(2π·Δt/T).
          <strong className="text-slate-500 ml-2">φ₁ fit</strong> — AR(2) regression result.
          <strong className="text-slate-500 ml-2">Match</strong> — ✓ if |predicted − fitted| &lt; 0.1; — if series not oscillatory (fixed point, arrested, or damped).
        </p>
      </CardContent>
    </Card>
  );
}

const FLOQUET_SUPPORTED_MODELS = [
  { id: 'goodwin', label: 'Goodwin Oscillator (3×3)' },
  { id: 'van-der-pol', label: 'van der Pol (2×2)' },
  { id: 'fitzhugh-nagumo', label: 'FitzHugh-Nagumo (2×2)' },
  { id: 'lotka-volterra', label: 'Lotka-Volterra (2×2)' },
];

function FloquetPanel() {
  const [selectedModel, setSelectedModel] = useState('goodwin');
  const [result, setResult] = useState<FloquetResult | null>(null);

  const floquetMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/model-zoo/floquet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId: selectedModel, parameters: {} }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<FloquetResult>;
    },
    onSuccess: (data) => setResult(data),
  });

  const nonTrivial = result?.floquetMultipliers.filter(m => !m.isTrivial) ?? [];
  const dominant = nonTrivial.reduce(
    (best, m) => (m.modulus > (best?.modulus ?? -1) ? m : best),
    null as FloquetMultiplier | null
  );

  return (
    <Card id="floquet" className="bg-white border-slate-200 scroll-mt-20" data-testid="card-floquet">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Sigma size={20} className="text-violet-400" />
          <CardTitle className="text-lg text-slate-900">Floquet Stability Analysis</CardTitle>
          <Badge variant="outline" className="text-xs font-mono text-violet-400 border-violet-500/40 ml-auto">
            New
          </Badge>
        </div>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          Computes the monodromy matrix by integrating the variational equations around one full period of the
          limit cycle. Floquet multipliers (eigenvalues of the monodromy matrix) measure <em>transverse orbital
          stability</em> — how quickly perturbations off the orbit decay back. AR(2) |λ| measures longitudinal
          autocorrelation along the orbit. These are complementary stability descriptors, not duplicates.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <label className="text-xs text-slate-500 font-medium">Model</label>
            <select
              value={selectedModel}
              onChange={e => { setSelectedModel(e.target.value); setResult(null); }}
              className="text-xs bg-white border border-slate-300 rounded-md px-2 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-violet-400"
              data-testid="select-floquet-model"
            >
              {FLOQUET_SUPPORTED_MODELS.map(m => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>
          <Button
            onClick={() => floquetMutation.mutate()}
            disabled={floquetMutation.isPending}
            className="bg-violet-600 hover:bg-violet-700 text-white text-xs h-8 px-4"
            data-testid="btn-run-floquet"
          >
            {floquetMutation.isPending
              ? <><Activity size={12} className="mr-1.5 animate-spin" />Computing…</>
              : <><Play size={12} className="mr-1.5" />Run Floquet Analysis</>}
          </Button>
        </div>

        {floquetMutation.isError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            <p className="text-xs text-red-400">Error: {(floquetMutation.error as Error).message}</p>
          </div>
        )}

        {result && !result.supported && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
            <p className="text-xs text-amber-400">{result.unsupportedReason}</p>
          </div>
        )}

        {result && result.supported && result.period === null && (
          <div className="bg-slate-100 border border-slate-200 rounded-lg p-3">
            <p className="text-xs text-slate-500">{result.interpretation}</p>
          </div>
        )}

        {result && result.supported && result.period !== null && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-slate-100 rounded-lg p-3 border border-slate-200 text-center">
                <p className="text-[10px] text-slate-500 mb-0.5">Detected Period</p>
                <p className="text-lg font-mono text-slate-900">{result.period.toFixed(2)}</p>
                <p className="text-[10px] text-slate-400">{result.periodUnit}</p>
              </div>
              <div className="bg-violet-50 rounded-lg p-3 border border-violet-200 text-center">
                <p className="text-[10px] text-violet-500 mb-0.5">Dominant Floquet |μ|</p>
                <p className="text-lg font-mono text-violet-700">
                  {dominant ? dominant.modulus.toFixed(4) : '—'}
                </p>
                <p className="text-[10px] text-violet-400">orbital contraction</p>
              </div>
              <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200 text-center">
                <p className="text-[10px] text-emerald-600 mb-0.5">Avg AR(2) |λ|</p>
                <p className="text-lg font-mono text-emerald-700">
                  {result.ar2Comparison.length > 0
                    ? (result.ar2Comparison.reduce((a, b) => a + b.ar2Lambda, 0) / result.ar2Comparison.length).toFixed(4)
                    : '—'}
                </p>
                <p className="text-[10px] text-emerald-500">autocorrelation persistence</p>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-medium text-slate-600 mb-2">Monodromy Matrix Eigenvalues</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs" data-testid="table-floquet-multipliers">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="py-1.5 px-2 text-left text-slate-500 font-medium">Multiplier</th>
                      <th className="py-1.5 px-2 text-center text-slate-500 font-medium">Re</th>
                      <th className="py-1.5 px-2 text-center text-slate-500 font-medium">Im</th>
                      <th className="py-1.5 px-2 text-center text-slate-500 font-medium">|μ|</th>
                      <th className="py-1.5 px-2 text-center text-slate-500 font-medium">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.floquetMultipliers.map((m, i) => (
                      <tr key={i} className="border-b border-slate-100 hover:bg-slate-50"
                        data-testid={`row-floquet-${i}`}>
                        <td className="py-1.5 px-2 font-mono text-slate-700">{m.label}</td>
                        <td className="py-1.5 px-2 text-center font-mono text-slate-600">{m.re.toFixed(5)}</td>
                        <td className="py-1.5 px-2 text-center font-mono text-slate-500">
                          {m.im !== 0 ? (m.im > 0 ? '+' : '') + m.im.toFixed(5) + 'i' : '0'}
                        </td>
                        <td className={`py-1.5 px-2 text-center font-mono font-medium
                          ${m.isTrivial ? 'text-slate-400' : m.modulus < 0.5 ? 'text-violet-600' : 'text-violet-400'}`}>
                          {m.modulus.toFixed(5)}
                        </td>
                        <td className="py-1.5 px-2 text-center">
                          {m.isTrivial
                            ? <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-300">trivial</Badge>
                            : <Badge variant="outline" className="text-[10px] text-violet-500 border-violet-400/40">orbital</Badge>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-medium text-slate-600 mb-2">AR(2) |λ| vs Floquet |μ| — Per-Variable</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs" data-testid="table-floquet-comparison">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="py-1.5 px-2 text-left text-slate-500 font-medium">Variable</th>
                      <th className="py-1.5 px-2 text-center text-slate-500 font-medium">AR(2) |λ|</th>
                      <th className="py-1.5 px-2 text-center text-slate-500 font-medium">Floquet |μ|</th>
                      <th className="py-1.5 px-2 text-center text-slate-500 font-medium">Gap</th>
                      <th className="py-1.5 px-2 text-center text-slate-500 font-medium">Gap %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.ar2Comparison.map((row, i) => (
                      <tr key={i} className="border-b border-slate-100 hover:bg-slate-50"
                        data-testid={`row-comparison-${i}`}>
                        <td className="py-1.5 px-2 text-slate-700">{row.variable}</td>
                        <td className="py-1.5 px-2 text-center font-mono text-emerald-600">{row.ar2Lambda.toFixed(5)}</td>
                        <td className="py-1.5 px-2 text-center font-mono text-violet-600">{row.floquetModulus.toFixed(5)}</td>
                        <td className={`py-1.5 px-2 text-center font-mono font-medium
                          ${row.gap > 0.3 ? 'text-orange-500' : row.gap > 0.1 ? 'text-amber-500' : 'text-slate-500'}`}>
                          +{row.gap.toFixed(5)}
                        </td>
                        <td className={`py-1.5 px-2 text-center font-mono
                          ${row.gapPct > 30 ? 'text-orange-500' : row.gapPct > 10 ? 'text-amber-500' : 'text-slate-500'}`}>
                          {row.gapPct.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-slate-100 border border-slate-200 rounded-lg p-3">
              <p className="text-xs text-slate-600 leading-relaxed">{result.interpretation}</p>
            </div>

            <div className="bg-violet-50 border border-violet-200 rounded-lg p-3 space-y-1">
              <p className="text-[11px] font-medium text-violet-700">What the gap means</p>
              <p className="text-[11px] text-violet-600 leading-relaxed">
                AR(2) |λ| ≈ 1 because the signal is a <em>sustained</em> oscillation — the AR(2) process sees
                high autocorrelation between consecutive samples on the orbit. Floquet |μ| measures how quickly
                a perturbation that <em>displaces</em> the system off the orbit returns. These are orthogonal
                geometric directions: along-orbit (AR(2)) vs across-orbit (Floquet). The gap is a structural
                property of nonlinear limit cycles, not a flaw in AR(2).
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ModelZoo() {
  useScrollToHash();
  const { data: models, isLoading, error } = useQuery<ModelDefinition[]>({
    queryKey: ['/api/model-zoo/models'],
  });

  const { data: roundTrip } = useQuery<RoundTripResponse>({
    queryKey: ['/api/model-zoo/ode-roundtrip-validation'],
  });

  const allPassed = models ? true : false;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 text-slate-900">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-700" data-testid="link-back">
              <ArrowLeft size={16} className="mr-1" /> Home
            </Button>
          </Link>
        </div>

        <HowTo
          title="ODE Model Zoo"
          summary="Validates AR(2) eigenvalue predictions against six canonical ODE (Ordinary Differential Equation) models from biology, including the Leloup-Goldbeter circadian oscillator (T≈24h, |λ|=0.9999). Each model generates synthetic time-series data, which is then fit with AR(2) to verify that the eigenvalue recovery matches the known analytical solution."
          steps={[
            { label: "Select a model", detail: "Choose from six ODE systems — each represents a different biological oscillation pattern." },
            { label: "Compare predicted vs. recovered", detail: "The analytical eigenvalue from the ODE should match the AR(2)-recovered value closely." },
            { label: "Check R²", detail: "High R² indicates the AR(2) model faithfully captures the ODE dynamics." }
          ]}
        />

        <div className="text-center space-y-2" data-testid="page-header">
          <div className="flex items-center justify-center gap-3">
            <Beaker size={28} className="text-emerald-400" />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent" data-testid="text-title">
              ODE Model Zoo
            </h1>
          </div>
          <p className="text-slate-500 text-sm max-w-2xl mx-auto" data-testid="text-subtitle">
            Validate AR(2) eigenvalue predictions against canonical ODE models from biology.
            Each model simulates a fundamental biological process, and the PAR(2) engine analyzes the output
            to confirm that eigenvalues reflect real control-system dynamics — not statistical artifacts.
          </p>
          <div className="rounded-lg bg-slate-100 border border-slate-200 p-4 mt-3">
            <p className="text-sm text-slate-600 leading-relaxed">
              <strong className="text-slate-900">What you can do:</strong> Each model's output is analyzed by the AR(2) engine and its eigenvalue is compared to the known ODE stability eigenvalue. A pass means AR(2) correctly captures the system's dynamics. Download results as validation evidence for your methods section.
            </p>
          </div>
          {roundTrip && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-slate-300 text-slate-600 hover:bg-slate-100 mt-3"
              data-testid="button-download-results"
              onClick={() => {
                const csvData = roundTrip.results.flatMap(m =>
                  m.results.map(r => ({
                    modelName: m.modelName,
                    variable: r.variable,
                    eigenvalue: r.eigenvalue,
                    phi1: r.phi1,
                    phi2: r.phi2,
                    r2: r.r2,
                    stability: r.stability,
                    isPhysicallyPlausible: r.isPhysicallyPlausible,
                    note: r.note,
                  }))
                );
                downloadAsCSV(csvData, "PAR2_ModelZoo_Results.csv");
              }}
            >
              <Download className="h-4 w-4" />
              Download Results (CSV)
            </Button>
          )}
        </div>

        <div className="flex justify-center">
          <Link href="/boman-ode">
            <Button variant="outline" size="sm" className="gap-2 border-emerald-700/50 text-emerald-400 hover:bg-emerald-900/20 text-xs" data-testid="link-boman-ode">
              <Beaker size={13} />
              Related: Boman-Ryan ODE → AR(2) Validation — disease trajectory from real patient data
            </Button>
          </Link>
        </div>

        <PaperCrossLinks currentPage="/model-zoo" />

        <Card className="bg-white border-slate-200">
          <CardContent className="py-4">
            <div className="overflow-x-auto">
              <table className="w-full text-xs" data-testid="table-model-summary">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="py-2 px-3 text-left text-slate-500 font-medium">ODE Model</th>
                    <th className="py-2 px-3 text-left text-slate-500 font-medium">Biological Proxy</th>
                    <th className="py-2 px-3 text-left text-slate-500 font-medium">Value to Framework</th>
                  </tr>
                </thead>
                <tbody>
                  {(models || []).map(m => (
                    <tr key={m.id} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          {MODEL_ICONS[m.id]}
                          <span className="text-slate-900 font-medium">{m.name}</span>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-slate-600">{m.biologicalProxy}</td>
                      <td className="py-2 px-3 text-slate-500">{m.frameworkValue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {roundTrip && <RoundTripPanel data={roundTrip} />}

        <FloquetPanel />

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Activity size={24} className="text-emerald-400 animate-spin mr-2" />
            <span className="text-slate-500">Loading models...</span>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-center">
            <p className="text-red-400">Failed to load models: {(error as Error).message}</p>
          </div>
        )}

        {models && (
          <div className="space-y-4" data-testid="model-list">
            {models.map(model => (
              <ModelPanel key={model.id} model={model} />
            ))}
          </div>
        )}

        <div className="mt-8 rounded-xl border border-slate-200 bg-slate-100 p-5 space-y-3" data-testid="model-zoo-see-also">
          <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wider">Related analyses</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <a href="/boman-ode" className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-colors group">
              <span className="text-emerald-400 mt-0.5">→</span>
              <div>
                <div className="text-sm font-medium text-slate-800 group-hover:text-emerald-300 transition-colors">ODE → AR(2) Validation</div>
                <div className="text-xs text-slate-500 mt-0.5">Published crypt equations → eigenvalue trajectory · Boman et al. parameters</div>
              </div>
            </a>
            <a href="/framework-benchmarks" className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 hover:border-amber-500/50 hover:bg-amber-500/5 transition-colors group">
              <span className="text-amber-400 mt-0.5">→</span>
              <div>
                <div className="text-sm font-medium text-slate-800 group-hover:text-amber-300 transition-colors">Framework Benchmarks</div>
                <div className="text-xs text-slate-500 mt-0.5">AR(2) vs JTK_CYCLE, cosinor, RAIN — side-by-side comparison</div>
              </div>
            </a>
            <a href="/boman-simulation" className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 hover:border-orange-500/50 hover:bg-orange-500/5 transition-colors group">
              <span className="text-orange-400 mt-0.5">→</span>
              <div>
                <div className="text-sm font-medium text-slate-800 group-hover:text-orange-300 transition-colors">Boman Simulation</div>
                <div className="text-xs text-slate-500 mt-0.5">3-compartment crypt model · 810+ parameter sweeps · AR(2) classification</div>
              </div>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
