import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, ReferenceArea, BarChart, Bar, Cell, ScatterChart, Scatter, ZAxis,
  AreaChart, Area, Legend
} from "recharts";
import {
  ArrowLeft, Loader2, Microscope, Dna, Activity, Waves,
  ChevronDown, ChevronUp, Zap, Target, BookOpen
} from "lucide-react";
import { Link } from "wouter";
import EvidenceLink from "@/components/EvidenceLink";
import InsightCallout from "@/components/InsightCallout";
import { useScrollToHash } from "@/hooks/useScrollToHash";

const REGIME_COLORS: Record<string, string> = {
  'Deep Turing-stable': '#22c55e',
  'Target gene band': '#3b82f6',
  'Clock gene / near-bifurcation': '#8b5cf6',
  'Transition zone': '#f59e0b',
  'Pattern collapse': '#ef4444',
};

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 shadow-xl text-xs">
      <div className="text-slate-900 font-medium mb-1">|λ| = {label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(4) : p.value}
        </div>
      ))}
    </div>
  );
}

function SpatialPatternViz({ snapshot }: { snapshot: any }) {
  const maxVal = Math.max(...snapshot.concentrations);
  const minVal = Math.min(...snapshot.concentrations);
  const range = maxVal - minVal || 1;

  return (
    <div className="space-y-2">
      <div className="text-xs text-slate-500 font-medium">{snapshot.label}</div>
      <div className="flex gap-[1px] h-16 items-end rounded overflow-hidden bg-white">
        {snapshot.concentrations.map((c: number, i: number) => {
          const norm = (c - minVal) / range;
          const hue = norm > 0.6 ? 200 + (1 - norm) * 160 : 200 - norm * 200;
          return (
            <div
              key={i}
              className="flex-1"
              style={{
                height: `${Math.max(5, norm * 100)}%`,
                backgroundColor: `hsl(${hue}, 70%, ${40 + norm * 30}%)`,
              }}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-slate-500">
        <span>Position 0</span>
        <Badge className={
          snapshot.classification === 'stable_pattern' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
          snapshot.classification === 'critical_transition' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
          snapshot.classification === 'pattern_collapse' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
          'bg-red-500/20 text-red-400 border-red-500/30'
        }>{snapshot.classification?.replace(/_/g, ' ')}</Badge>
        <span>Position {snapshot.concentrations.length - 1}</span>
      </div>
    </div>
  );
}

function ExpandableSection({ title, icon: Icon, children, defaultOpen = false, id }: {
  title: string; icon: any; children: React.ReactNode; defaultOpen?: boolean; id?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="bg-white border-slate-800/60" id={id} data-testid={`section-${id || title.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setOpen(!open)}
        data-testid={`toggle-${id || title.toLowerCase().replace(/\s+/g, '-')}`}
      >
        <CardTitle className="text-lg text-slate-900 flex items-center gap-2">
          <Icon className="w-5 h-5 text-amber-400" />
          {title}
          {open ? <ChevronUp className="w-4 h-4 ml-auto text-slate-500" /> : <ChevronDown className="w-4 h-4 ml-auto text-slate-500" />}
        </CardTitle>
      </CardHeader>
      {open && <CardContent>{children}</CardContent>}
    </Card>
  );
}

export default function TuringDeepDive() {
  useScrollToHash();

  const { data, isLoading, error } = useQuery<any>({
    queryKey: ["/api/analysis/turing-deep-dive"],
    queryFn: async () => {
      const res = await fetch("/api/analysis/turing-deep-dive");
      if (!res.ok) throw new Error("Failed to fetch Turing deep dive");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 text-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
        <span className="ml-3 text-slate-500">Running Turing simulations...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 p-8">
        <Alert className="bg-red-900/30 border-red-500/50">
          <AlertDescription>Failed to load Turing deep dive analysis.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const { benchmark, bifurcationDiagram, spatialSnapshots, biologicalMappings, dispersionRelation, goldenRatioExplanation, reactionDiffusionExplanation, realDataValidation } = data;

  const dispersionByEv = [0.40, 0.537, 0.618, 0.689, 0.85].map(ev => ({
    eigenvalue: ev,
    data: dispersionRelation.filter((d: any) => Math.abs(d.eigenvalue - ev) < 0.001)
  }));

  const dispColors: Record<number, string> = {
    0.40: '#22c55e', 0.537: '#3b82f6', 0.618: '#f59e0b', 0.689: '#8b5cf6', 0.85: '#ef4444'
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 text-slate-900" data-testid="page-turing-deep-dive">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <div className="flex items-center gap-4">
          <Link href="/framework-benchmarks">
            <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-700" data-testid="link-back">
              <ArrowLeft className="w-4 h-4 mr-2" /> Framework Benchmarks
            </Button>
          </Link>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold flex items-center gap-3" data-testid="heading-title">
            <Microscope className="w-8 h-8 text-amber-400" />
            Turing Pattern Analysis
          </h1>
          <p className="text-slate-500 text-lg max-w-3xl">
            How AR(2) eigenvalue |λ| connects to Turing's morphogenesis theory — and why the golden ratio marks the boundary between pattern stability and collapse.
          </p>
        </div>

        <Alert className="bg-slate-50 border-slate-300/40" data-testid="status-methodology-note">
          <AlertDescription className="text-slate-600 text-sm">
            This page contains both <strong className="text-amber-400">mathematical simulations</strong> (sections 1–6) and a <strong className="text-emerald-400">real-data validation</strong> (section 7) using actual tissue eigenvalues from this platform. The simulations illustrate the theoretical connection; the real-data section tests whether the hypothesis holds in practice. Scroll to <a href="#real-data-validation" className="text-blue-400 underline">Real-Data Validation</a> for the empirical test.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center">
            <div className="text-xs text-slate-500 mb-1">Bifurcation Point</div>
            <div className="text-2xl font-bold text-amber-400" data-testid="text-bifurcation">{benchmark.bifurcationPoint.toFixed(3)}</div>
            <div className="text-[10px] text-slate-500 mt-1">Golden Ratio: 0.618</div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center">
            <div className="text-xs text-slate-500 mb-1">Deviation from φ</div>
            <div className="text-2xl font-bold text-cyan-400" data-testid="text-deviation">{(benchmark.validation.deviationFromPhi * 100).toFixed(2)}%</div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center">
            <div className="text-xs text-slate-500 mb-1">Matches φ</div>
            <div className={`text-2xl font-bold ${benchmark.validation.matchesGoldenRatio ? 'text-emerald-400' : 'text-red-400'}`} data-testid="text-matches">
              {benchmark.validation.matchesGoldenRatio ? 'YES' : 'NO'}
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center">
            <div className="text-xs text-slate-500 mb-1">Simulations Run</div>
            <div className="text-2xl font-bold text-slate-600" data-testid="text-simulations">{benchmark.simulations.length}</div>
          </div>
        </div>

        {/* Section 1: What are Turing Patterns? */}
        <ExpandableSection title="What Are Turing Patterns?" icon={BookOpen} defaultOpen={true} id="what-are-turing-patterns">
          <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
            <p>
              In 1952, Alan Turing proposed that simple chemical reactions combined with diffusion could spontaneously create spatial patterns — stripes, spots, and waves — from initially uniform conditions. This "reaction-diffusion" mechanism explains how biological structures like animal coat patterns, fingerprints, and intestinal crypt spacing emerge.
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-slate-100 border border-slate-200/40 rounded-lg p-4">
                <h4 className="text-slate-900 font-medium mb-2 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" /> Activator-Inhibitor System
                </h4>
                <p className="text-xs text-slate-500">{reactionDiffusionExplanation.activatorInhibitor}</p>
              </div>
              <div className="bg-slate-100 border border-slate-200/40 rounded-lg p-4">
                <h4 className="text-slate-900 font-medium mb-2 flex items-center gap-2">
                  <Target className="w-4 h-4 text-blue-400" /> Turing Instability Condition
                </h4>
                <p className="text-xs text-slate-500">{reactionDiffusionExplanation.turingCondition}</p>
              </div>
              <div className="bg-slate-100 border border-slate-200/40 rounded-lg p-4">
                <h4 className="text-slate-900 font-medium mb-2 flex items-center gap-2">
                  <Waves className="w-4 h-4 text-cyan-400" /> Pattern Selection
                </h4>
                <p className="text-xs text-slate-500">{reactionDiffusionExplanation.patternSelection}</p>
              </div>
              <div className="bg-slate-100 border border-slate-200/40 rounded-lg p-4">
                <h4 className="text-slate-900 font-medium mb-2 flex items-center gap-2">
                  <Dna className="w-4 h-4 text-purple-400" /> Connection to AR(2)
                </h4>
                <p className="text-xs text-slate-500">{reactionDiffusionExplanation.connectionToAR2}</p>
              </div>
            </div>
          </div>
        </ExpandableSection>

        {/* Section 2: Bifurcation Diagram */}
        <ExpandableSection title="Bifurcation Diagram: Where Patterns Collapse" icon={Activity} defaultOpen={true} id="bifurcation-diagram">
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              The bifurcation diagram shows how pattern amplitude changes as |λ| increases. At the golden ratio (φ ≈ 0.618), patterns undergo a critical transition — the mathematical signature of Turing instability.
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4" data-testid="chart-bifurcation">
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={bifurcationDiagram}>
                  <defs>
                    <linearGradient id="amplGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  {/* Regime background bands with names — rendered first so they sit behind the data */}
                  <ReferenceArea x1={0.30} x2={0.50} fill="#22c55e" fillOpacity={0.10}
                    label={{ value: 'Deep stable', position: 'insideTop', fill: '#22c55e', fontSize: 9, fontWeight: 600 }} />
                  <ReferenceArea x1={0.50} x2={0.618} fill="#3b82f6" fillOpacity={0.10}
                    label={{ value: 'Target gene band', position: 'insideTop', fill: '#3b82f6', fontSize: 9, fontWeight: 600 }} />
                  <ReferenceArea x1={0.618} x2={0.75} fill="#8b5cf6" fillOpacity={0.10}
                    label={{ value: 'Clock gene band', position: 'insideTop', fill: '#8b5cf6', fontSize: 9, fontWeight: 600 }} />
                  <ReferenceArea x1={0.75} x2={0.80} fill="#f59e0b" fillOpacity={0.12}
                    label={{ value: 'Trans.', position: 'insideTop', fill: '#f59e0b', fontSize: 8, fontWeight: 600 }} />
                  <ReferenceArea x1={0.80} x2={0.95} fill="#ef4444" fillOpacity={0.10}
                    label={{ value: 'Pattern collapse', position: 'insideTop', fill: '#ef4444', fontSize: 9, fontWeight: 600 }} />
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis
                    dataKey="eigenvalue"
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    label={{ value: 'Eigenvalue |λ|', fill: '#64748b', position: 'bottom', offset: -5 }}
                  />
                  <YAxis
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    label={{ value: 'Pattern Amplitude', fill: '#64748b', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  {/* Boundary lines — no text labels, bands carry the names */}
                  <ReferenceLine x={0.50}  stroke="#22c55e" strokeWidth={1} strokeDasharray="3 3" />
                  <ReferenceLine x={0.618} stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5"
                    label={{ value: 'φ = 0.618', fill: '#f59e0b', fontSize: 11, fontWeight: 'bold', position: 'insideBottomRight' }} />
                  <ReferenceLine x={0.75}  stroke="#8b5cf6" strokeWidth={1} strokeDasharray="3 3" />
                  <ReferenceLine x={0.80}  stroke="#ef4444" strokeWidth={1} strokeDasharray="3 3" />
                  <Area type="monotone" dataKey="amplitude" stroke="#60a5fa" strokeWidth={2}
                    fill="url(#amplGrad)" name="Pattern Amplitude" />
                  <Line type="monotone" dataKey="turingNumber" stroke="#22c55e" strokeWidth={2}
                    dot={{ fill: '#22c55e', r: 3 }} name="Turing Number" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="flex flex-wrap gap-2">
              {bifurcationDiagram.map((d: any) => (
                <div key={d.eigenvalue} className="text-[10px] px-2 py-1 rounded-full border" style={{
                  borderColor: REGIME_COLORS[d.regime] || '#64748b',
                  color: REGIME_COLORS[d.regime] || '#94a3b8',
                  backgroundColor: `${REGIME_COLORS[d.regime] || '#64748b'}15`
                }}>
                  {d.eigenvalue.toFixed(3)}: {d.regime}
                </div>
              ))}
            </div>
          </div>
        </ExpandableSection>

        {/* Section 3: Spatial Pattern Snapshots */}
        <ExpandableSection title="Spatial Pattern Snapshots" icon={Waves} defaultOpen={true} id="spatial-snapshots">
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Each panel shows the activator concentration across a 1D tissue strip after running the Turing simulation. Well-defined peaks and valleys represent intact spatial patterns (like crypt-villus structures). As |λ| increases past φ, patterns flatten and disappear.
            </p>
            <div className="grid gap-4">
              {spatialSnapshots.map((snap: any) => (
                <SpatialPatternViz key={snap.eigenvalue} snapshot={snap} />
              ))}
            </div>
            <InsightCallout variant="info" title="Reading the snapshots">
              Strong peaks-and-valleys (like at |λ|=0.40 and 0.537) indicate stable spatial patterns — analogous to well-formed intestinal crypts.
              At the golden ratio (φ), patterns are at maximum sensitivity. By |λ|=0.85, the tissue has lost its spatial organization entirely.
            </InsightCallout>
          </div>
        </ExpandableSection>

        {/* Section 4: Dispersion Relation */}
        <ExpandableSection title="Dispersion Relation: Which Wavelengths Grow?" icon={Activity} id="dispersion-relation">
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              The dispersion relation σ(k) shows the growth rate of spatial perturbations at each wavenumber k. When σ(k) &gt; 0 for some k, those wavelengths are unstable and Turing patterns form. The peak of σ(k) determines the pattern spacing. As |λ| increases past φ, the unstable band shrinks until all modes become stable (no patterns).
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4" data-testid="chart-dispersion">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis
                    dataKey="wavenumber"
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    label={{ value: 'Wavenumber k', fill: '#64748b', position: 'bottom', offset: -5 }}
                    type="number"
                    domain={[0, 3]}
                    allowDuplicatedCategory={false}
                  />
                  <YAxis
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    label={{ value: 'Growth rate σ(k)', fill: '#64748b', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={0} stroke="#64748b" strokeDasharray="3 3" />
                  <Legend />
                  {dispersionByEv.map(({ eigenvalue, data: dData }) => (
                    <Line
                      key={eigenvalue}
                      data={dData}
                      type="monotone"
                      dataKey="growthRate"
                      stroke={dispColors[eigenvalue]}
                      strokeWidth={eigenvalue === 0.618 ? 3 : 1.5}
                      dot={false}
                      name={`|λ|=${eigenvalue}`}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <InsightCallout variant="info" title="What the dispersion curves mean">
              Curves that rise above the zero line (σ &gt; 0) indicate eigenvalues where spatial patterns can form. The further above zero, the faster patterns emerge. Notice how the curves at |λ|=0.40 and 0.537 have strong positive peaks, while |λ|=0.85 stays mostly below zero — pattern formation is suppressed.
            </InsightCallout>
          </div>
        </ExpandableSection>

        {/* Section 5: Why the Golden Ratio? */}
        <ExpandableSection title="Why the Golden Ratio?" icon={Microscope} defaultOpen={true} id="golden-ratio">
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/20 rounded-lg p-5">
              <h4 className="text-amber-400 font-semibold mb-3 text-base">The Mathematical Basis</h4>
              <p className="text-sm text-slate-600 leading-relaxed">{goldenRatioExplanation.mathematicalBasis}</p>
            </div>
            <div className="bg-gradient-to-r from-blue-500/10 to-transparent border border-blue-500/20 rounded-lg p-5">
              <h4 className="text-blue-400 font-semibold mb-3 text-base">The Biological Interpretation</h4>
              <p className="text-sm text-slate-600 leading-relaxed">{goldenRatioExplanation.biologicalInterpretation}</p>
            </div>
            <div className="bg-slate-100 border border-slate-200/40 rounded-lg p-4">
              <h4 className="text-slate-900 font-medium mb-3 text-sm">Convergence Evidence</h4>
              <ul className="space-y-2">
                {goldenRatioExplanation.convergenceEvidence.map((ev: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                    <span className="text-emerald-400 mt-0.5">✓</span>
                    {ev}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-500">See also:</span>
              <EvidenceLink label="Root-space φ-enrichment" to="/root-space" hash="phi-enrichment" />
              <EvidenceLink label="Fibonacci analysis" to="/root-space" hash="fibonacci" />
              <EvidenceLink label="Cross-species hierarchy" to="/cross-context-validation" hash="hierarchy-summary" />
            </div>
          </div>
        </ExpandableSection>

        {/* Section 6: Biological Regime Map */}
        <ExpandableSection title="Biological Regime Map" icon={Dna} defaultOpen={true} id="regime-map">
          <div className="space-y-4">
            <Alert className="bg-amber-500/10 border-amber-500/30" data-testid="alert-exploratory">
              <AlertDescription className="text-amber-700 text-sm">
                <strong>Exploratory / hypothesis-generating.</strong> The regime labels and biological interpretations below are derived from the mathematical simulation above — which was itself parameterised to bifurcate at φ. These mappings are <em>not</em> independently validated clinical findings. They represent a theoretical framework for future experimental testing, not established biology.
              </AlertDescription>
            </Alert>
            <p className="text-sm text-slate-500">
              The eigenvalue spectrum maps to proposed biological states based on the Turing analogy. Each regime represents a hypothesised relationship between temporal gene dynamics and spatial tissue architecture — to be tested against spatial transcriptomics and perturbation data.
            </p>
            <div className="space-y-3">
              {biologicalMappings.map((m: any) => (
                <div key={m.regime} className="bg-slate-100 border rounded-lg p-4" style={{ borderColor: `${m.color}40` }}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: m.color }} />
                    <h4 className="text-slate-900 font-medium">{m.regime}</h4>
                    <Badge className="text-[10px]" style={{ backgroundColor: `${m.color}20`, color: m.color, borderColor: `${m.color}40` }}>
                      {m.eigenvalueRange}
                    </Badge>
                  </div>
                  <div className="grid md:grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="text-slate-500 mb-1">Tissue State</div>
                      <div className="text-slate-600">{m.tissueState}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 mb-1">Example Genes</div>
                      <div className="text-slate-600">{m.examples.join(', ')}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 mb-1">Crypt Architecture</div>
                      <div className="text-slate-600">{m.cryptArchitecture}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 mb-1">Clinical Relevance</div>
                      <div className="text-slate-600">{m.clinicalRelevance}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 flex-wrap mt-2">
              <span className="text-xs text-slate-500">Related evidence:</span>
              <EvidenceLink label="Disease screen" to="/disease-screen" />
              <EvidenceLink label="Rule 3 & 4 validation" to="/rule-validation" />
              <EvidenceLink label="Crypt-villus patterns" to="/crypt-villus" />
              <EvidenceLink label="Chronotherapy predictor" to="/chronotherapy-predictor" />
            </div>
          </div>
        </ExpandableSection>

        {/* Section 7: Simulation Results Table */}
        <ExpandableSection title="Full Simulation Results" icon={Activity} id="simulation-results">
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-xs" data-testid="table-turing-simulations">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left text-slate-500 pb-2 pr-4">|λ|</th>
                    <th className="text-left text-slate-500 pb-2 pr-4">Regime</th>
                    <th className="text-left text-slate-500 pb-2 pr-4">Amplitude</th>
                    <th className="text-left text-slate-500 pb-2 pr-4">Turing #</th>
                    <th className="text-left text-slate-500 pb-2 pr-4">Wavelength</th>
                    <th className="text-left text-slate-500 pb-2">Classification</th>
                  </tr>
                </thead>
                <tbody>
                  {bifurcationDiagram.map((d: any) => (
                    <tr key={d.eigenvalue} className={`border-b border-slate-800/50 ${d.eigenvalue === 0.618 ? 'bg-amber-500/10' : ''}`}>
                      <td className="py-2 pr-4 font-mono text-cyan-300 font-semibold">{d.eigenvalue.toFixed(3)}</td>
                      <td className="py-2 pr-4">
                        <span className="text-xs" style={{ color: REGIME_COLORS[d.regime] || '#94a3b8' }}>{d.regime}</span>
                      </td>
                      <td className="py-2 pr-4 font-mono text-slate-600">{d.amplitude.toFixed(4)}</td>
                      <td className="py-2 pr-4 font-mono text-slate-600">{d.turingNumber.toFixed(4)}</td>
                      <td className="py-2 pr-4 font-mono text-slate-600">{d.wavelength ?? '—'}</td>
                      <td className="py-2">
                        <Badge className={
                          d.classification === 'stable_pattern' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                          d.classification === 'critical_transition' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                          d.classification === 'pattern_collapse' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
                          'bg-red-500/20 text-red-400 border-red-500/30'
                        }>{d.classification?.replace(/_/g, ' ')}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </ExpandableSection>

        {/* Section: Real Data Validation */}
        {realDataValidation && (
          <ExpandableSection title="Real-Data Validation" icon={Dna} defaultOpen={true} id="real-data-validation">
            <div className="space-y-5">
              <Alert className="bg-amber-500/10 border-amber-500/30">
                <AlertDescription className="text-amber-200 text-sm">
                  <strong>Important context:</strong> Everything above this section is based on mathematical simulation, not real biological data. The simulation was designed to produce a bifurcation at φ = 0.618, so its agreement with the golden ratio is not independent evidence. Below, we test the hypothesis against actual gene expression data from the platform.
                </AlertDescription>
              </Alert>

              {/* Tissue Architecture Test */}
              <div className="bg-slate-100 border border-slate-200/40 rounded-lg p-5" data-testid="tissue-architecture-test">
                <h4 className="text-slate-900 font-semibold mb-3">Test 1: Tissue Spatial Architecture vs Eigenvalues</h4>
                <p className="text-sm text-slate-500 mb-4">
                  If eigenvalue |λ| maps to Turing pattern stability, tissues with strong spatial architecture (kidney nephrons, liver lobules, cerebellar layers) should have systematically different eigenvalue profiles than tissues without pronounced spatial patterns (adipose tissue, muscle fibers).
                </p>

                <div className="grid md:grid-cols-2 gap-3 mb-4">
                  <div className="bg-white border border-emerald-500/20 rounded-lg p-3">
                    <div className="text-xs text-emerald-400 mb-1">Spatially Patterned Tissues</div>
                    <div className="text-lg font-bold text-slate-900" data-testid="text-patterned-mean">
                      Mean |λ| = {realDataValidation.tissueArchitectureTest.patternedMean.toFixed(4)}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {realDataValidation.tissueArchitectureTest.tissues.filter((t: any) => t.hasSpatialPatterns).map((t: any) => t.tissue).join(', ')}
                    </div>
                  </div>
                  <div className="bg-white border border-slate-300/20 rounded-lg p-3">
                    <div className="text-xs text-slate-500 mb-1">Non-Patterned Tissues</div>
                    <div className="text-lg font-bold text-slate-900" data-testid="text-nonpatterned-mean">
                      Mean |λ| = {realDataValidation.tissueArchitectureTest.nonPatternedMean.toFixed(4)}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {realDataValidation.tissueArchitectureTest.tissues.filter((t: any) => !t.hasSpatialPatterns).map((t: any) => t.tissue).join(', ')}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-white rounded-lg p-3 text-center">
                    <div className="text-[10px] text-slate-500">Mann-Whitney p</div>
                    <div className={`text-lg font-bold font-mono ${realDataValidation.tissueArchitectureTest.mannWhitneyP < 0.05 ? 'text-emerald-400' : 'text-slate-500'}`} data-testid="text-mw-pvalue">
                      {realDataValidation.tissueArchitectureTest.mannWhitneyP.toFixed(4)}
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-3 text-center">
                    <div className="text-[10px] text-slate-500">Effect Size (Cohen's d)</div>
                    <div className="text-lg font-bold font-mono text-slate-600" data-testid="text-effect-size">
                      {realDataValidation.tissueArchitectureTest.effectSize.toFixed(3)}
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-3 text-center">
                    <div className="text-[10px] text-slate-500">Result</div>
                    <Badge className={
                      realDataValidation.tissueArchitectureTest.testResult.includes('SUPPORTS') ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                      realDataValidation.tissueArchitectureTest.testResult.includes('CONTRADICTS') ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                      'bg-amber-500/20 text-amber-400 border-amber-500/30'
                    } data-testid="text-test-result">{realDataValidation.tissueArchitectureTest.testResult}</Badge>
                  </div>
                </div>

                {/* Tissue detail table */}
                <div className="overflow-x-auto mb-4">
                  <table className="w-full text-xs" data-testid="table-tissue-architecture">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left text-slate-500 pb-2 pr-3">Tissue</th>
                        <th className="text-left text-slate-500 pb-2 pr-3">Spatial Patterns?</th>
                        <th className="text-left text-slate-500 pb-2 pr-3">Identity |λ|</th>
                        <th className="text-left text-slate-500 pb-2 pr-3">Clock |λ|</th>
                        <th className="text-left text-slate-500 pb-2 pr-3">Prolif |λ|</th>
                        <th className="text-left text-slate-500 pb-2 pr-3">Overall Mean</th>
                        <th className="text-left text-slate-500 pb-2">Fraction &gt; φ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {realDataValidation.tissueArchitectureTest.tissues.map((t: any) => (
                        <tr key={t.tissue} className={`border-b border-slate-800/50 ${t.hasSpatialPatterns ? 'bg-emerald-500/5' : ''}`}>
                          <td className="py-1.5 pr-3 text-slate-900 font-medium">{t.tissue}</td>
                          <td className="py-1.5 pr-3">
                            {t.hasSpatialPatterns
                              ? <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">Yes</Badge>
                              : <Badge className="bg-slate-600/20 text-slate-500 border-slate-300/30 text-[10px]">No</Badge>
                            }
                          </td>
                          <td className="py-1.5 pr-3 font-mono text-slate-600">{t.identityMean.toFixed(4)}</td>
                          <td className="py-1.5 pr-3 font-mono text-slate-600">{t.clockMean.toFixed(4)}</td>
                          <td className="py-1.5 pr-3 font-mono text-slate-600">{t.prolifMean.toFixed(4)}</td>
                          <td className={`py-1.5 pr-3 font-mono font-semibold ${t.overallMean > (benchmark.bifurcationPoint ?? 0.618) ? 'text-amber-400' : 'text-cyan-400'}`}>
                            {t.overallMean.toFixed(4)}
                          </td>
                          <td className="py-1.5 font-mono text-slate-600">{(t.fractionAbovePhi * 100).toFixed(0)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p className="text-sm text-slate-600 mb-3">{realDataValidation.tissueArchitectureTest.interpretation}</p>

                <Alert className="bg-slate-50 border-slate-200">
                  <AlertDescription className="text-slate-500 text-xs">
                    <strong className="text-slate-600">Caveat:</strong> {realDataValidation.tissueArchitectureTest.caveat}
                  </AlertDescription>
                </Alert>
              </div>

              {/* Organoid Disruption Test */}
              <div className="bg-slate-100 border border-slate-200/40 rounded-lg p-5" data-testid="organoid-disruption-test">
                <h4 className="text-slate-900 font-semibold mb-3">Test 2: APC-Mutant Organoid Architecture Disruption</h4>
                <p className="text-sm text-slate-500 mb-3">{realDataValidation.organoidDisruptionTest.description}</p>
                <div className="bg-white border border-blue-500/20 rounded-lg p-4 mb-3">
                  <div className="text-xs text-blue-400 font-semibold mb-2">Prediction (testable on this platform)</div>
                  <p className="text-sm text-slate-600">{realDataValidation.organoidDisruptionTest.prediction}</p>
                </div>
                <div className="bg-white border border-slate-300/20 rounded-lg p-4">
                  <div className="text-xs text-slate-500 font-semibold mb-2">How to test this yourself</div>
                  <p className="text-sm text-slate-500">{realDataValidation.organoidDisruptionTest.howToTest}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap mt-3">
                  <EvidenceLink label="Disease screen: WT vs APC-KO" to="/disease-screen" />
                  <EvidenceLink label="Root-space shifts" to="/root-space" hash="perturbation-shifts" />
                </div>
              </div>

              {/* Overall Verdict */}
              <div className={`border rounded-lg p-5 ${
                realDataValidation.overallVerdict.status === 'supported' ? 'bg-emerald-500/10 border-emerald-500/30' :
                realDataValidation.overallVerdict.status === 'contradicted' ? 'bg-red-500/10 border-red-500/30' :
                'bg-amber-500/10 border-amber-500/30'
              }`} data-testid="overall-verdict">
                <h4 className={`font-semibold mb-2 ${
                  realDataValidation.overallVerdict.status === 'supported' ? 'text-emerald-400' :
                  realDataValidation.overallVerdict.status === 'contradicted' ? 'text-red-400' :
                  'text-amber-400'
                }`}>
                  Overall Verdict: {realDataValidation.overallVerdict.status.toUpperCase()}
                </h4>
                <p className="text-sm text-slate-600 mb-4">{realDataValidation.overallVerdict.summary}</p>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-slate-500 font-semibold mb-2">Limitations</div>
                    <ul className="space-y-1">
                      {realDataValidation.overallVerdict.limitations.map((l: string, i: number) => (
                        <li key={i} className="text-xs text-slate-500 flex items-start gap-2">
                          <span className="text-red-400 mt-0.5 shrink-0">!</span> {l}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-semibold mb-2">Next Steps for Validation</div>
                    <ul className="space-y-1">
                      {realDataValidation.overallVerdict.nextSteps.map((s: string, i: number) => (
                        <li key={i} className="text-xs text-slate-500 flex items-start gap-2">
                          <span className="text-blue-400 mt-0.5 shrink-0">→</span> {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </ExpandableSection>
        )}

        {/* Bottom evidence links */}
        <Card className="bg-slate-50 border-slate-800/40" data-testid="section-cross-references">
          <CardContent className="pt-6">
            <h3 className="text-slate-900 font-medium mb-3">Cross-References</h3>
            <div className="flex items-center gap-2 flex-wrap">
              <EvidenceLink label="Framework benchmarks" to="/framework-benchmarks" hash="turing-detail" />
              <EvidenceLink label="Root-space geometry" to="/root-space" hash="perturbation-shifts" />
              <EvidenceLink label="Model zoo validation" to="/model-zoo" hash="round-trip" />
              <EvidenceLink label="Convergence map" to="/convergence-map" />
              <EvidenceLink label="AR(1) benchmark & controls" to="/supplementary-analyses" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
