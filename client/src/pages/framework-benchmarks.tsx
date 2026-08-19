import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useScrollToHash } from "@/hooks/useScrollToHash";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  ScatterChart, Scatter, ReferenceLine, Legend, LineChart, Line,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from "recharts";
import {
  ArrowLeft, Loader2, ShieldCheck, Target, Activity, Beaker,
  TrendingUp, BarChart3, Crosshair, Award, AlertTriangle, CheckCircle2, XCircle, Info,
  ChevronDown, ChevronUp, Microscope, Network, Clock, Dna, Search, Download
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { downloadAsCSV } from "@/components/DownloadResultsButton";
import { Link } from "wouter";
import EvidenceLink from "@/components/EvidenceLink";
import PaperCrossLinks from "@/components/PaperCrossLinks";

interface SimBenchResult {
  trueEigenvalue: number;
  estimatedMean: number;
  estimatedStd: number;
  bias: number;
  rmse: number;
  n: number;
  nSimulations: number;
}

interface ResidualResult {
  gene: string;
  type: string;
  eigenvalue: number;
  ljungBoxStat: number;
  pValue: number;
  isWellSpecified: boolean;
}

interface ModelCompResult {
  gene: string;
  type: string;
  ar1: { aic: number; bic: number; eigenvalue: number };
  ar2: { aic: number; bic: number; eigenvalue: number };
  ar3: { aic: number; bic: number; eigenvalue: number };
  preferredModel: string;
  preferredByAIC: string;
  preferredByBIC: string;
}

interface AltMetricResult {
  gene: string;
  type: string;
  ar2Eigenvalue: number;
  ar1Autocorr: number;
  sumArCoeffs: number;
  spectralDensityPeak: number;
}

interface BaselineModel {
  model: string;
  coefficients: number[];
  eigenvalueModulus: number;
  aic: number;
  bic: number;
  residualVariance: number;
  logLikelihood: number;
}

interface BaselineResult {
  dataset: string;
  condition: string;
  sampleSize: number;
  models: { par2: BaselineModel; arima: BaselineModel; ou: BaselineModel; stateSpace: BaselineModel };
  comparison: { eigenvalueDifferences: any; aicRanking: string[]; conclusion: string };
}

interface MasterBenchmark {
  name: string;
  question: string;
  status: "PASSED" | "PARTIAL" | "FAILED";
  expectedResult: string;
  actualResult: string;
  score: number;
  details: any;
}

function formatP(p: number): string {
  if (p < 1e-10) return `${p.toExponential(1)}`;
  if (p < 0.001) return p.toExponential(2);
  return p.toFixed(4);
}

function StatusBadge({ status }: { status: string }) {
  if (status === "PASSED") return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30" data-testid="badge-passed">PASSED</Badge>;
  if (status === "PARTIAL") return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30" data-testid="badge-partial">PARTIAL</Badge>;
  return <Badge className="bg-red-500/20 text-red-400 border-red-500/30" data-testid="badge-failed">FAILED</Badge>;
}

const DATA_SOURCE_META: Record<string, { label: string; color: string; tooltip: string }> = {
  turing: {
    label: 'Simulation Only',
    color: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    tooltip: 'Schnakenberg reaction-diffusion simulation. Parameters tuned to produce bifurcation at φ. Not validated against real tissue data on this page — see Turing Deep Dive for real-data test.'
  },
  fisher: {
    label: 'Theoretical Model',
    color: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
    tooltip: 'Transfer function model evaluating information throughput at different eigenvalue levels. Mathematical framework, not derived from measured signaling data.'
  },
  network: {
    label: 'Literature + Real Eigenvalues',
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    tooltip: 'STRING v12.0 interaction counts (curated from literature). Eigenvalues computed from real GSE54650 Liver dataset.'
  },
  ueda: {
    label: 'Real Dataset (GEO)',
    color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    tooltip: 'Computed from GSE157357 organoid time-series (WT vs APC-KO). Cross-condition prediction using real expression data.'
  },
};

function DataSourceBadge({ benchmarkKey }: { benchmarkKey: string }) {
  const meta = DATA_SOURCE_META[benchmarkKey];
  if (!meta) return null;
  return (
    <div className="group relative inline-block">
      <Badge className={`${meta.color} text-[10px] cursor-help`} data-testid={`badge-data-source-${benchmarkKey}`}>
        {meta.label}
      </Badge>
      <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block z-50 w-64 p-2 bg-slate-50 border border-slate-300 rounded text-[10px] text-slate-600 shadow-xl">
        {meta.tooltip}
      </div>
    </div>
  );
}

function ScoreGauge({ score, label }: { score: number; label: string }) {
  const color = score >= 80 ? "text-emerald-400" : score >= 60 ? "text-amber-400" : "text-red-400";
  const bgColor = score >= 80 ? "bg-emerald-500/10 border-emerald-500/30" : score >= 60 ? "bg-amber-500/10 border-amber-500/30" : "bg-red-500/10 border-red-500/30";
  return (
    <div className={`rounded-lg border p-4 text-center ${bgColor}`} data-testid={`gauge-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className={`text-3xl font-bold ${color}`}>{score}%</div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 text-sm shadow-xl">
      <div className="font-bold text-slate-900 mb-1">{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color: p.color || p.fill }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(4) : p.value}
        </div>
      ))}
    </div>
  );
};

function TuringDetailPanel({ details }: { details: any }) {
  if (!details) return null;
  const simulations = details.simulations || [];
  const chartData = simulations.map((s: any) => ({
    eigenvalue: s.eigenvalue,
    amplitude: s.patternAmplitude,
    turingNumber: s.turingNumber,
    wavelength: s.patternWavelength,
    classification: s.classification,
  }));

  return (
    <div id="turing-detail" className="space-y-4 mt-4 scroll-mt-20" data-testid="turing-detail-panel">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
          <div className="text-xs text-slate-500">Bifurcation Point</div>
          <div className="text-xl font-bold text-amber-400">{details.bifurcationPoint}</div>
          <div className="text-[10px] text-slate-500">Golden Ratio: 0.618</div>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
          <div className="text-xs text-slate-500">Critical Threshold</div>
          <div className="text-xl font-bold text-cyan-400">{details.criticalThreshold}</div>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
          <div className="text-xs text-slate-500">Matches Golden Ratio</div>
          <div className={`text-xl font-bold ${details.validation?.matchesGoldenRatio ? 'text-emerald-400' : 'text-red-400'}`}>
            {details.validation?.matchesGoldenRatio ? 'YES' : 'NO'}
          </div>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
          <div className="text-xs text-slate-500">Deviation from phi</div>
          <div className="text-xl font-bold text-slate-600">{(details.validation?.deviationFromPhi * 100)?.toFixed(1)}%</div>
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <h4 className="text-slate-900 font-medium mb-3 text-sm">Pattern Amplitude vs Eigenvalue</h4>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="eigenvalue" tick={{ fill: '#64748b', fontSize: 11 }} label={{ value: '|lambda|', fill: '#64748b', position: 'bottom', offset: -5 }} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} label={{ value: 'Amplitude', fill: '#64748b', angle: -90, position: 'insideLeft' }} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine x={0.618} stroke="#f59e0b" strokeDasharray="5 5" label={{ value: 'phi=0.618', fill: '#f59e0b', fontSize: 11 }} />
            <Line type="monotone" dataKey="amplitude" stroke="#60a5fa" strokeWidth={2} dot={{ fill: '#60a5fa', r: 3 }} name="Pattern Amplitude" />
            <Line type="monotone" dataKey="turingNumber" stroke="#22c55e" strokeWidth={2} dot={{ fill: '#22c55e', r: 3 }} name="Turing Number" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <h4 className="text-slate-900 font-medium mb-3 text-sm">Simulation Results by Eigenvalue</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-xs" data-testid="table-turing-detail">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left text-slate-500 pb-2 pr-3">|lambda|</th>
                <th className="text-left text-slate-500 pb-2 pr-3">Pattern Intact</th>
                <th className="text-left text-slate-500 pb-2 pr-3">Wavelength</th>
                <th className="text-left text-slate-500 pb-2 pr-3">Amplitude</th>
                <th className="text-left text-slate-500 pb-2 pr-3">Turing #</th>
                <th className="text-left text-slate-500 pb-2">Classification</th>
              </tr>
            </thead>
            <tbody>
              {simulations.map((s: any, i: number) => (
                <tr key={i} className={`border-b border-slate-800/50 ${s.eigenvalue === 0.618 ? 'bg-amber-500/10' : ''}`}>
                  <td className="py-1.5 pr-3 font-mono text-cyan-300">{s.eigenvalue}</td>
                  <td className="py-1.5 pr-3">{s.patternIntact ? <CheckCircle2 size={14} className="text-emerald-400" /> : <XCircle size={14} className="text-red-400" />}</td>
                  <td className="py-1.5 pr-3 font-mono text-slate-600">{s.patternWavelength}</td>
                  <td className="py-1.5 pr-3 font-mono text-slate-600">{s.patternAmplitude?.toFixed(4)}</td>
                  <td className="py-1.5 pr-3 font-mono text-slate-600">{s.turingNumber?.toFixed(4)}</td>
                  <td className="py-1.5">
                    <Badge className={
                      s.classification === 'stable_pattern' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                      s.classification === 'critical_transition' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                      'bg-red-500/20 text-red-400 border-red-500/30'
                    }>{s.classification?.replace('_', ' ')}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Alert className="bg-slate-50 border-slate-200">
        <AlertDescription className="text-slate-600 text-xs">
          <strong>Interpretation:</strong> {details.interpretation}
        </AlertDescription>
      </Alert>
      <Alert className="bg-orange-500/10 border-orange-500/30 mt-3">
        <AlertDescription className="text-orange-200 text-xs">
          <strong>Data source note:</strong> This benchmark uses Schnakenberg reaction-diffusion simulation with parameters tuned to produce a bifurcation at φ = 0.618. The simulation confirms the mathematical connection but is not an independent empirical test. For a real-data validation using actual tissue eigenvalues, see the Turing Deep Dive page.
        </AlertDescription>
      </Alert>
      <div className="flex items-center gap-2 pt-2 flex-wrap">
        <span className="text-xs text-slate-500">Related:</span>
        <EvidenceLink label="Deep dive: Turing patterns" to="/turing-deep-dive" />
        <EvidenceLink label="Real-data validation" to="/turing-deep-dive" hash="real-data-validation" />
        <EvidenceLink label="Root-space geometry" to="/root-space" hash="phi-enrichment" />
        <EvidenceLink label="Crypt-villus patterns" to="/crypt-villus" />
      </div>
    </div>
  );
}

function FisherDetailPanel({ details }: { details: any }) {
  if (!details) return null;
  const analyses = details.analyses || [];
  const chartData = analyses.map((a: any) => ({
    eigenvalue: a.eigenvalue,
    fisherInfo: a.fisherInformation,
    snr: a.signalToNoiseRatio,
    efficiency: a.informationEfficiency,
    capacity: a.channelCapacity,
  }));

  return (
    <div id="fisher-detail" className="space-y-4 mt-4 scroll-mt-20" data-testid="fisher-detail-panel">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
          <div className="text-xs text-slate-500">Peak Fisher Info</div>
          <div className="text-xl font-bold text-cyan-400">{details.peakFisherInfo?.fisherInformation?.toFixed(1)}</div>
          <div className="text-[10px] text-slate-500">at |lambda| = {details.peakFisherInfo?.eigenvalue}</div>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
          <div className="text-xs text-slate-500">Peak in Stable Band</div>
          <div className={`text-xl font-bold ${details.validation?.peakInStableBand ? 'text-emerald-400' : 'text-red-400'}`}>
            {details.validation?.peakInStableBand ? 'YES' : 'NO'}
          </div>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
          <div className="text-xs text-slate-500">Cancer Info Loss</div>
          <div className="text-xl font-bold text-red-400">{(details.validation?.informationLossInCancer * 100)?.toFixed(0)}%</div>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
          <div className="text-xs text-slate-500">Optimal Band</div>
          <div className="text-xl font-bold text-emerald-400">{details.optimalBand?.lower}-{details.optimalBand?.upper}</div>
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <h4 className="text-slate-900 font-medium mb-3 text-sm">Fisher Information & Efficiency vs Eigenvalue</h4>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="eigenvalue" tick={{ fill: '#64748b', fontSize: 11 }} label={{ value: '|lambda|', fill: '#64748b', position: 'bottom', offset: -5 }} />
            <YAxis yAxisId="left" tick={{ fill: '#64748b', fontSize: 11 }} label={{ value: 'Fisher Info', fill: '#64748b', angle: -90, position: 'insideLeft' }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fill: '#64748b', fontSize: 11 }} label={{ value: 'Efficiency', fill: '#64748b', angle: 90, position: 'insideRight' }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <ReferenceLine x={0.56} stroke="#f59e0b" strokeDasharray="5 5" yAxisId="left" label={{ value: 'Peak', fill: '#f59e0b', fontSize: 11 }} />
            <Line type="monotone" dataKey="fisherInfo" stroke="#60a5fa" strokeWidth={2} dot={false} name="Fisher Information" yAxisId="left" />
            <Line type="monotone" dataKey="efficiency" stroke="#22c55e" strokeWidth={2} dot={false} name="Efficiency" yAxisId="right" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <h4 className="text-slate-900 font-medium mb-3 text-sm">Signal Classification by Eigenvalue Region</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {['optimal', 'suboptimal', 'degraded', 'noisy'].map(cls => {
            const count = analyses.filter((a: any) => a.classification === cls).length;
            const colors: Record<string, string> = {
              optimal: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
              suboptimal: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
              degraded: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
              noisy: 'bg-red-500/20 text-red-400 border-red-500/30',
            };
            return (
              <div key={cls} className={`rounded-lg border p-3 text-center ${colors[cls]}`}>
                <div className="text-lg font-bold">{count}</div>
                <div className="text-xs capitalize">{cls}</div>
              </div>
            );
          })}
        </div>
      </div>

      <Alert className="bg-slate-50 border-slate-200">
        <AlertDescription className="text-slate-600 text-xs">
          <strong>Interpretation:</strong> {details.interpretation}
        </AlertDescription>
      </Alert>
      <Alert className="bg-violet-500/10 border-violet-500/30 mt-3">
        <AlertDescription className="text-violet-200 text-xs">
          <strong>Data source note:</strong> This is a mathematical transfer function model, not derived from measured signaling data. It demonstrates that intermediate eigenvalues are theoretically optimal for information transmission, but empirical validation would require measuring actual signal fidelity in biological circuits at different eigenvalue levels.
        </AlertDescription>
      </Alert>
      <div className="flex items-center gap-2 pt-2">
        <span className="text-xs text-slate-500">Related:</span>
        <EvidenceLink label="AR(2) diagnostics" to="/ar2-diagnostics" />
        <EvidenceLink label="AR(1) benchmark & controls" to="/supplementary-analyses" />
      </div>
    </div>
  );
}

function NetworkDetailPanel({ details }: { details: any }) {
  const [geneSearch, setGeneSearch] = useState("");
  if (!details) return null;
  const genes = details.geneAnalyses || [];

  const filteredGenes = genes.filter((g: any) =>
    g.gene.toLowerCase().includes(geneSearch.toLowerCase())
  );

  const chartData = filteredGenes.map((g: any) => ({
    gene: g.gene,
    eigenvalue: g.eigenvalue,
    degree: g.networkDegree,
    isHub: g.isHub,
    class: g.eigenvalueClass,
  }));

  return (
    <div id="network-detail" className="space-y-4 mt-4 scroll-mt-20" data-testid="network-detail-panel">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
          <div className="text-xs text-slate-500">Stable Genes as Hubs</div>
          <div className="text-xl font-bold text-emerald-400">{(details.validation?.stableGenesAsHubs * 100)?.toFixed(0)}%</div>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
          <div className="text-xs text-slate-500">Unstable as Hubs</div>
          <div className="text-xl font-bold text-red-400">{(details.validation?.unstableGenesAsHubs * 100)?.toFixed(0)}%</div>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
          <div className="text-xs text-slate-500">Correlation (r)</div>
          <div className="text-xl font-bold text-cyan-400">{details.validation?.correlationCoefficient?.toFixed(3)}</div>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
          <div className="text-xs text-slate-500">Genes Analyzed</div>
          <div className="text-xl font-bold text-slate-600">{genes.length}</div>
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <h4 className="text-slate-900 font-medium mb-3 text-sm">Network Degree vs Eigenvalue</h4>
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="eigenvalue" name="Eigenvalue" tick={{ fill: '#64748b', fontSize: 11 }} label={{ value: '|lambda|', fill: '#64748b', position: 'bottom', offset: -5 }} />
            <YAxis dataKey="degree" name="Network Degree" tick={{ fill: '#64748b', fontSize: 11 }} label={{ value: 'STRING Degree', fill: '#64748b', angle: -90, position: 'insideLeft' }} />
            <Tooltip content={({ active, payload }: any) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              return (
                <div className="bg-white border border-slate-200 rounded-lg p-3 text-sm shadow-xl">
                  <div className="font-bold text-slate-900">{d.gene}</div>
                  <div className="text-cyan-300">|lambda| = {d.eigenvalue?.toFixed(3)}</div>
                  <div className="text-slate-600">Degree: {d.degree}</div>
                  <div className={d.isHub ? 'text-emerald-400' : 'text-slate-500'}>{d.isHub ? 'Hub' : 'Peripheral'}</div>
                  <div className="text-slate-500 text-xs">{d.class}</div>
                </div>
              );
            }} />
            <Scatter data={chartData} fill="#60a5fa">
              {chartData.map((d: any, i: number) => (
                <Cell key={i} fill={d.isHub ? '#22c55e' : d.class === 'unstable' ? '#ef4444' : '#60a5fa'} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
        <div className="flex gap-4 justify-center mt-2 text-xs">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" /> Hub</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> Stable</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Unstable</span>
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <h4 className="text-slate-900 font-medium mb-3 text-sm">Per-Gene STRING Network Analysis</h4>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
          <Input
            placeholder="Search genes..."
            value={geneSearch}
            onChange={(e) => setGeneSearch(e.target.value)}
            className="pl-8 bg-slate-50 border-slate-200 text-slate-800 text-xs h-8"
            data-testid="input-network-gene-search"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs" data-testid="table-network-detail">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left text-slate-500 pb-2 pr-3">Gene</th>
                <th className="text-left text-slate-500 pb-2 pr-3">|lambda|</th>
                <th className="text-left text-slate-500 pb-2 pr-3">Class</th>
                <th className="text-left text-slate-500 pb-2 pr-3">Degree</th>
                <th className="text-left text-slate-500 pb-2 pr-3">Hub</th>
                <th className="text-left text-slate-500 pb-2 pr-3">Bottleneck</th>
                <th className="text-left text-slate-500 pb-2">Correlation</th>
              </tr>
            </thead>
            <tbody>
              {filteredGenes.map((g: any, i: number) => (
                <tr key={i} className="border-b border-slate-800/50">
                  <td className="py-1.5 pr-3 text-slate-900 font-medium">{g.gene}</td>
                  <td className="py-1.5 pr-3 font-mono text-cyan-300">{g.eigenvalue?.toFixed(3)}</td>
                  <td className="py-1.5 pr-3">
                    <Badge className={
                      g.eigenvalueClass === 'stable' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                      g.eigenvalueClass === 'transitional' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                      'bg-red-500/20 text-red-400 border-red-500/30'
                    }>{g.eigenvalueClass}</Badge>
                  </td>
                  <td className="py-1.5 pr-3 font-mono text-slate-600">{g.networkDegree}</td>
                  <td className="py-1.5 pr-3">{g.isHub ? <CheckCircle2 size={14} className="text-emerald-400" /> : <XCircle size={14} className="text-slate-500" />}</td>
                  <td className="py-1.5 pr-3">{g.isBottleneck ? <CheckCircle2 size={14} className="text-blue-400" /> : <XCircle size={14} className="text-slate-500" />}</td>
                  <td className="py-1.5">
                    <Badge className={
                      g.correlation === 'supports' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                      'bg-slate-700/50 text-slate-500 border-slate-300/50'
                    }>{g.correlation}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Alert className="bg-slate-50 border-slate-200">
        <AlertDescription className="text-slate-600 text-xs">
          <strong>Interpretation:</strong> {details.interpretation}
        </AlertDescription>
      </Alert>
      <Alert className="bg-blue-500/10 border-blue-500/30 mt-3">
        <AlertDescription className="text-blue-200 text-xs">
          <strong>Data source note:</strong> Network interaction counts are curated from STRING v12.0 (literature-derived, not live API calls). Eigenvalues are computed from real GSE54650 Liver time-series data. This is a hybrid test: real eigenvalues overlaid on curated network topology.
        </AlertDescription>
      </Alert>
      <div className="flex items-center gap-2 pt-2">
        <span className="text-xs text-slate-500">Related:</span>
        <EvidenceLink label="Gene-protein network map" to="/gene-protein-map" />
        <EvidenceLink label="Rule 3 & 4 validation" to="/rule-validation" />
      </div>
    </div>
  );
}

function UedaDetailPanel({ details }: { details: any }) {
  if (!details) return null;
  const phaseAnalyses = details.phaseAnalyses || [];
  const eigenAnalyses = details.eigenvalueAnalyses || [];
  const crossCondition = details.crossCondition;
  const comparison = details.comparison;

  const combinedData = phaseAnalyses.map((p: any) => {
    const e = eigenAnalyses.find((ev: any) => ev.gene === p.gene);
    return {
      gene: p.gene,
      phase: p.phase,
      amplitude: p.amplitude,
      phaseError: p.phaseError,
      eigenvalue: e?.eigenvalue ?? 0,
      stabilityScore: e?.stabilityScore ?? 0,
    };
  });

  return (
    <div id="ueda-detail" className="space-y-4 mt-4 scroll-mt-20" data-testid="ueda-detail-panel">
      {crossCondition && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
            <div className="text-xs text-slate-500">WT Mean |lambda|</div>
            <div className="text-xl font-bold text-emerald-400">{crossCondition.wtMeanEigenvalue?.toFixed(3)}</div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
            <div className="text-xs text-slate-500">APC-KO Mean |lambda|</div>
            <div className="text-xl font-bold text-red-400">{crossCondition.apckoMeanEigenvalue?.toFixed(3)}</div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
            <div className="text-xs text-slate-500">Genes Compared</div>
            <div className="text-xl font-bold text-cyan-400">{crossCondition.nGenesCompared}</div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
            <div className="text-xs text-slate-500">Real Cross-Condition</div>
            <div className={`text-xl font-bold ${crossCondition.usedRealCrossConditionData ? 'text-emerald-400' : 'text-amber-400'}`}>
              {crossCondition.usedRealCrossConditionData ? 'YES' : 'NO'}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-center">
          <div className="text-xs text-blue-300">Eigenvalue R-squared</div>
          <div className="text-2xl font-bold text-blue-400">{comparison?.eigenvalueOnlyPredictsPerturbation?.toFixed(3)}</div>
          <div className="text-[10px] text-blue-300/70">Predicts disease disruption</div>
        </div>
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3 text-center">
          <div className="text-xs text-purple-300">Phase R-squared</div>
          <div className="text-2xl font-bold text-purple-400">{comparison?.phaseOnlyPredictsPerturbation?.toFixed(3)}</div>
          <div className="text-[10px] text-purple-300/70">Phase prediction power</div>
        </div>
        <div className="bg-slate-700/30 border border-slate-300/30 rounded-lg p-3 text-center">
          <div className="text-xs text-slate-500">Combined R-squared</div>
          <div className="text-2xl font-bold text-slate-600">{comparison?.combinedPredictsPerturbation?.toFixed(3)}</div>
          <div className="text-[10px] text-slate-500">Orthogonal signals</div>
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <h4 className="text-slate-900 font-medium mb-3 text-sm">Phase vs Eigenvalue per Gene (Cross-Condition)</h4>
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="eigenvalue" name="Eigenvalue" tick={{ fill: '#64748b', fontSize: 11 }} label={{ value: '|lambda|', fill: '#64748b', position: 'bottom', offset: -5 }} />
            <YAxis dataKey="phaseError" name="Phase Error" tick={{ fill: '#64748b', fontSize: 11 }} label={{ value: 'Phase Error', fill: '#64748b', angle: -90, position: 'insideLeft' }} />
            <Tooltip content={({ active, payload }: any) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              return (
                <div className="bg-white border border-slate-200 rounded-lg p-3 text-sm shadow-xl">
                  <div className="font-bold text-slate-900">{d.gene}</div>
                  <div className="text-cyan-300">|lambda| = {d.eigenvalue?.toFixed(3)}</div>
                  <div className="text-purple-300">Phase = {d.phase?.toFixed(3)}</div>
                  <div className="text-amber-300">Amplitude = {d.amplitude?.toFixed(1)}</div>
                  <div className="text-slate-600">Phase Error = {d.phaseError?.toFixed(3)}</div>
                  <div className="text-emerald-300">Stability = {d.stabilityScore?.toFixed(3)}</div>
                </div>
              );
            }} />
            <Scatter data={combinedData} fill="#a78bfa">
              {combinedData.map((d: any, i: number) => (
                <Cell key={i} fill={d.eigenvalue > 0.7 ? '#ef4444' : d.eigenvalue > 0.5 ? '#60a5fa' : '#22c55e'} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <h4 className="text-slate-900 font-medium mb-3 text-sm">Per-Gene Phase & Eigenvalue Analysis</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-xs" data-testid="table-ueda-detail">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left text-slate-500 pb-2 pr-3">Gene</th>
                <th className="text-left text-slate-500 pb-2 pr-3">|lambda|</th>
                <th className="text-left text-slate-500 pb-2 pr-3">Phase</th>
                <th className="text-left text-slate-500 pb-2 pr-3">Amplitude</th>
                <th className="text-left text-slate-500 pb-2 pr-3">Phase Error</th>
                <th className="text-left text-slate-500 pb-2">Stability Score</th>
              </tr>
            </thead>
            <tbody>
              {combinedData.map((g: any, i: number) => (
                <tr key={i} className="border-b border-slate-800/50">
                  <td className="py-1.5 pr-3 text-slate-900 font-medium">{g.gene}</td>
                  <td className="py-1.5 pr-3 font-mono text-cyan-300">{g.eigenvalue?.toFixed(3)}</td>
                  <td className="py-1.5 pr-3 font-mono text-purple-300">{g.phase?.toFixed(3)}</td>
                  <td className="py-1.5 pr-3 font-mono text-slate-600">{g.amplitude?.toFixed(1)}</td>
                  <td className="py-1.5 pr-3 font-mono text-amber-300">{g.phaseError?.toFixed(3)}</td>
                  <td className="py-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-slate-100 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${g.stabilityScore * 100}%` }} />
                      </div>
                      <span className="font-mono text-slate-600">{g.stabilityScore?.toFixed(3)}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Alert className="bg-blue-500/10 border-blue-500/30">
        <Info className="h-4 w-4 text-blue-400" />
        <AlertDescription className="text-slate-600 text-xs">
          <strong>Cross-Condition Test (GSE157357):</strong> Compares eigenvalues between wild-type and APC-KO organoids (Stokes et al., 2021).
          Low combined R-squared ({comparison?.combinedPredictsPerturbation?.toFixed(3)}) is expected: phase and eigenvalue capture different,
          partially orthogonal biological information about circadian regulation.
        </AlertDescription>
      </Alert>

      <Alert className="bg-slate-50 border-slate-200">
        <AlertDescription className="text-slate-600 text-xs">
          <strong>Interpretation:</strong> {details.interpretation}
        </AlertDescription>
      </Alert>
      <Alert className="bg-emerald-500/10 border-emerald-500/30 mt-3">
        <AlertDescription className="text-emerald-200 text-xs">
          <strong>Data source note:</strong> This is the strongest external benchmark — it uses real time-series data from GSE157357 organoids (Stokes et al., 2021) with an independent outcome variable (APC-KO disruption measured in a different condition). The test is non-circular: WT eigenvalues predict disruption in APC-KO, not WT.
        </AlertDescription>
      </Alert>
      <div className="flex items-center gap-2 pt-2">
        <span className="text-xs text-slate-500">Related:</span>
        <EvidenceLink label="Cross-context validation" to="/cross-context-validation" hash="hierarchy-summary" />
        <EvidenceLink label="Disease screen" to="/disease-screen" />
      </div>
    </div>
  );
}

// ── Real-data benchmark results from par2_realdata_benchmark.py ──────────────
// GSE54650 validated pairs (Matsuo 2003, Abenza 2023, Matsuura 2016)
const REAL_PAIRS = [
  {
    pair: "Cry1→Wee1", tissue: "Liver", ref: "Matsuo 2003",
    cc_r: -0.886, cc_p: 0.000001, cc_sig: true,  cc_lag_h: 6,
    cos_rhythmic_C: true, cos_rhythmic_T: true, cos_dphi_h: 6.6, cos_detected: false,
    par2_F: 5.00, par2_p: 0.0178, par2_sig: true,  par2_dr2: 0.131,
    null_pctile_cc: 100, null_pctile_par2: 96.6,
    note: "",
  },
  {
    pair: "Nr1d1→Wee1", tissue: "Liver", ref: "Matsuo 2003",
    cc_r: -0.814, cc_p: 0.0029, cc_sig: true,  cc_lag_h: 18,
    cos_rhythmic_C: true, cos_rhythmic_T: true, cos_dphi_h: 6.3, cos_detected: false,
    par2_F: 3.07, par2_p: 0.069, par2_sig: false, par2_dr2: 0.103,
    null_pctile_cc: 97.4, null_pctile_par2: 89.6,
    note: "p = 0.069 (borderline; top 10th percentile of null)",
  },
  {
    pair: "Clock→Tead1", tissue: "Heart", ref: "Abenza 2023",
    cc_r: -0.933, cc_p: 0.000000076, cc_sig: true,  cc_lag_h: 10,
    cos_rhythmic_C: true, cos_rhythmic_T: true, cos_dphi_h: 2.5, cos_detected: true,
    par2_F: 2.06, par2_p: 0.159, par2_sig: false, par2_dr2: 0.072,
    null_pctile_cc: 100, null_pctile_par2: 79.8,
    note: "Coupling may run Tead1→Clock (Abenza 2023); directionality unresolved",
  },
  {
    pair: "Cry1→Tead1", tissue: "Heart", ref: "Abenza 2023",
    cc_r: -0.869, cc_p: 0.000159, cc_sig: true,  cc_lag_h: 16,
    cos_rhythmic_C: true, cos_rhythmic_T: true, cos_dphi_h: 4.1, cos_detected: true,
    par2_F: 4.02, par2_p: 0.034, par2_sig: true,  par2_dr2: 0.107,
    null_pctile_cc: 99.6, null_pctile_par2: 95.2,
    note: "",
  },
  {
    pair: "Arntl→Cdk1", tissue: "Cerebellum", ref: "Matsuura 2016",
    cc_r: -0.555, cc_p: 0.793, cc_sig: false, cc_lag_h: 24,
    cos_rhythmic_C: true, cos_rhythmic_T: false, cos_dphi_h: 11.2, cos_detected: false,
    par2_F: 0.32, par2_p: 0.810, par2_sig: false, par2_dr2: 0.045,
    null_pctile_cc: 44.6, null_pctile_par2: 22.2,
    note: "Cdk1 not rhythmic in bulk cerebellum; Matsuura coupling is stem-cell-compartment intercellular, not bulk tissue",
  },
];
const REAL_FPR = [
  { method: "Cross-correlation", fpr: 0.107, fill: "#c0392b" },
  { method: "PAR(2) F-test",     fpr: 0.062, fill: "#27ae60" },
];

function RealDataBenchmarkPanel() {
  const [showTable, setShowTable] = useState(false);
  const n = REAL_PAIRS.length;
  const n_cc   = REAL_PAIRS.filter(p => p.cc_sig).length;
  const n_cos  = REAL_PAIRS.filter(p => p.cos_detected).length;
  const n_par2 = REAL_PAIRS.filter(p => p.par2_sig).length;

  return (
    <Card className="bg-white border border-emerald-200" data-testid="real-data-benchmark-panel">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-700 border border-emerald-400/30 font-semibold">Real Dataset (GEO)</span>
          <span className="text-[10px] text-slate-400">Paper E · Section 4.3 · GSE54650 · 1,500 null pairs</span>
        </div>
        <CardTitle className="text-sm font-semibold text-slate-800">
          Real-Data Verification — Validated Clock-Target Pairs from GSE54650
        </CardTitle>
        <CardDescription className="text-xs text-slate-500 mt-0.5">
          5 pairs with independent experimental support (ChIP-seq / genetic perturbation) · 500 null pairs per tissue · α = 0.05
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">

        {/* Detection summary */}
        <div className="grid grid-cols-3 gap-3" data-testid="real-detection-summary">
          {[
            { method: "Cross-correlation", detected: n_cc, total: n, color: "red",   note: "10.7% null FPR" },
            { method: "Cosinor phase-diff", detected: n_cos, total: n, color: "blue", note: "threshold-sensitive" },
            { method: "PAR(2) F-test",      detected: n_par2, total: n, color: "green", note: "6.2% null FPR" },
          ].map(s => (
            <div key={s.method} className={`rounded-lg border p-3 text-center ${s.color === 'green' ? 'bg-emerald-50 border-emerald-200' : s.color === 'red' ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
              <div className="text-[10px] font-semibold text-slate-600 mb-1">{s.method}</div>
              <div className={`text-xl font-bold ${s.color === 'green' ? 'text-emerald-700' : s.color === 'red' ? 'text-red-700' : 'text-blue-700'}`}>{s.detected}/{s.total}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">{s.note}</div>
            </div>
          ))}
        </div>

        {/* Per-pair table */}
        <div>
          <div className="text-xs font-semibold text-slate-700 mb-2">Per-pair results</div>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-[10px] border-collapse" data-testid="real-pairs-table">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <th className="px-2 py-1.5 text-left">Pair (Tissue)</th>
                  <th className="px-2 py-1.5 text-left">Evidence</th>
                  <th className="px-2 py-1.5 text-center text-red-600">CC</th>
                  <th className="px-2 py-1.5 text-center text-blue-600">Cosinor</th>
                  <th className="px-2 py-1.5 text-center text-emerald-600">PAR(2)</th>
                  <th className="px-2 py-1.5 text-right">PAR(2) p</th>
                  <th className="px-2 py-1.5 text-right">PAR(2) null%ile</th>
                </tr>
              </thead>
              <tbody>
                {REAL_PAIRS.map((row, i) => (
                  <tr key={i} className={`border-b border-slate-100 ${i === REAL_PAIRS.length - 1 ? 'bg-slate-50/60' : ''}`} data-testid={`real-pair-row-${i}`}>
                    <td className="px-2 py-1.5 font-medium text-slate-800">
                      <span className="font-mono">{row.pair}</span>
                      <span className="text-slate-400 ml-1">({row.tissue})</span>
                    </td>
                    <td className="px-2 py-1.5 text-slate-500">{row.ref}</td>
                    <td className="px-2 py-1.5 text-center">
                      {row.cc_sig
                        ? <span className="text-emerald-600 font-bold">✓</span>
                        : <span className="text-red-400">✗</span>}
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      {row.cos_detected
                        ? <span className="text-emerald-600 font-bold">✓</span>
                        : <span className="text-red-400 text-[9px]">
                            {!row.cos_rhythmic_T ? "T not rhythmic" : `Δφ=${row.cos_dphi_h.toFixed(1)}h`}
                          </span>}
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      {row.par2_sig
                        ? <span className="text-emerald-600 font-bold">✓</span>
                        : row.par2_p < 0.10
                          ? <span className="text-amber-600 text-[9px]">border ({row.par2_p.toFixed(3)})</span>
                          : <span className="text-red-400">✗</span>}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-slate-600">{row.par2_p.toFixed(3)}</td>
                    <td className="px-2 py-1.5 text-right text-slate-500">top {(100 - row.null_pctile_par2).toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FPR chart */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-semibold text-slate-700 mb-1">Null false positive rates (1,500 random pairs)</div>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={REAL_FPR} margin={{ top: 5, right: 15, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="method" tick={{ fontSize: 9 }} />
                <YAxis domain={[0, 0.20]} tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} tick={{ fontSize: 9 }} />
                <Tooltip formatter={(v: number) => `${(v * 100).toFixed(1)}%`} />
                <ReferenceLine y={0.05} stroke="#94a3b8" strokeDasharray="4 3" label={{ value: "α = 0.05", fontSize: 9, fill: "#94a3b8", position: "right" }} />
                <Bar dataKey="fpr" name="FPR" radius={[3, 3, 0, 0]}>
                  {REAL_FPR.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} fillOpacity={0.75} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-col justify-center space-y-2 text-[11px] text-slate-600 leading-relaxed">
            <p><strong className="text-slate-800">Why CC detects more pairs:</strong> The five validated pairs were identified in the literature precisely because they show clear phase alignment. That is the regime where cross-correlation works well. CC wins here by construction.</p>
            <p><strong className="text-slate-800">Why PAR(2)'s lower FPR matters:</strong> At genome-wide scale (20,000+ genes), PAR(2)'s 6.2% FPR vs CC's 10.7% means roughly 900 fewer false positives per 10,000 pairs tested.</p>
            <p><strong className="text-slate-800">What this doesn't test:</strong> PAR(2)'s unique detection capability — phase-concentrated coupling without phase alignment — has no known validated examples in the literature yet. That remains a simulation-verified theoretical prediction.</p>
          </div>
        </div>

        <button
          className="text-[10px] text-slate-400 hover:text-slate-600 underline"
          onClick={() => setShowTable(t => !t)}
          data-testid="real-toggle-detail"
        >
          {showTable ? "Hide" : "Show"} cosinor failure details
        </button>
        {showTable && (
          <div className="rounded-lg border border-amber-100 bg-amber-50/50 p-3 text-[10px] text-slate-600 space-y-1">
            <div className="font-semibold text-slate-700 mb-1.5">Why cosinor missed the Wee1 pairs</div>
            <p>Cry1→Wee1: Δφ = 6.6 h. Both genes rhythmic. The ±6 h tolerance is one design choice; at ±7 h cosinor would detect this pair. The threshold is arbitrary.</p>
            <p>Nr1d1→Wee1: Δφ = 6.3 h. Same issue. Marginally outside tolerance.</p>
            <div className="font-semibold text-slate-700 mt-2 mb-1">Why Arntl→Cdk1 was excluded from the headline count</div>
            <p>Cdk1 is not rhythmic in bulk cerebellum (GSE54650). The Matsuura 2016 paper documents intercellular clock-cell-cycle coupling in stem cell compartments — not bulk tissue correlation. This is an ill-specified benchmark pair for a bulk-tissue method. No method detects it.</p>
            <div className="font-semibold text-slate-700 mt-2 mb-1">Note on Tead1 directionality</div>
            <p>Abenza et al. 2023 established that YAP/TEAD acts upstream of the clock in heart tissue. The statistical coupling PAR(2) and CC detect may run Tead1→Clock rather than Clock→Tead1. Both methods are blind to coupling direction.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Hardcoded simulation results from par2_benchmark_simulation.py ───────────
const SIM_DATA = [
  { ratio: 0.00, beta0: 0.600, beta2: 0.000, cc: 1.000, cosinor: 1.000, par2: 1.000, rhythmic: 1.000 },
  { ratio: 0.10, beta0: 0.597, beta2: 0.060, cc: 1.000, cosinor: 0.999, par2: 1.000, rhythmic: 0.999 },
  { ratio: 0.20, beta0: 0.588, beta2: 0.120, cc: 1.000, cosinor: 1.000, par2: 1.000, rhythmic: 1.000 },
  { ratio: 0.30, beta0: 0.572, beta2: 0.180, cc: 1.000, cosinor: 0.999, par2: 1.000, rhythmic: 0.999 },
  { ratio: 0.40, beta0: 0.550, beta2: 0.240, cc: 1.000, cosinor: 0.997, par2: 1.000, rhythmic: 0.997 },
  { ratio: 0.50, beta0: 0.520, beta2: 0.300, cc: 1.000, cosinor: 0.994, par2: 1.000, rhythmic: 0.994 },
  { ratio: 0.60, beta0: 0.480, beta2: 0.360, cc: 1.000, cosinor: 0.966, par2: 1.000, rhythmic: 0.966 },
  { ratio: 0.70, beta0: 0.428, beta2: 0.420, cc: 1.000, cosinor: 0.918, par2: 0.999, rhythmic: 0.918 },
  { ratio: 0.80, beta0: 0.360, beta2: 0.480, cc: 0.996, cosinor: 0.755, par2: 0.998, rhythmic: 0.755 },
  { ratio: 0.90, beta0: 0.262, beta2: 0.540, cc: 0.851, cosinor: 0.436, par2: 0.993, rhythmic: 0.437 },
  { ratio: 1.00, beta0: 0.000, beta2: 0.600, cc: 0.085, cosinor: 0.017, par2: 0.985, rhythmic: 0.048 },
];
const SIM_FPR = [
  { method: "Cross-correlation", fpr: 0.190, fill: "#c0392b" },
  { method: "Cosinor phase-diff", fpr: 0.090, fill: "#2980b9" },
  { method: "PAR(2) F-test",      fpr: 0.074, fill: "#27ae60" },
];

function PhaseConcentrationSimPanel() {
  const [showTable, setShowTable] = useState(false);
  return (
    <Card className="bg-white border border-violet-200" data-testid="sim-panel-phase-concentration">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-orange-500/20 text-orange-600 border border-orange-400/30 font-semibold">Simulation Only</span>
              <span className="text-[10px] text-slate-400">Paper E · Supplementary Figure S5</span>
            </div>
            <CardTitle className="text-sm font-semibold text-slate-800">
              Phase-Concentration Simulation — PAR(2) vs Cross-Correlation vs Cosinor Phase-Difference
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 mt-0.5">
              1,000 replicates · 48 timepoints · fixed total coupling energy √(β₀² + β₂²) = 0.60 · α = 0.05
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">

        {/* Key finding strip */}
        <div className="grid grid-cols-3 gap-3" data-testid="sim-key-findings">
          {[
            { label: "Phase-uniform (r = 0)", cc: "100%", cos: "100%", par: "100%", note: "All methods equivalent", color: "slate" },
            { label: "Mid-range (r = 0.90)", cc: "85.1%", cos: "43.6%", par: "99.3%", note: "Methods diverge", color: "amber" },
            { label: "Sin-concentrated (r = 1)", cc: "8.5%", cos: "1.7%", par: "98.5%", note: "PAR(2) only", color: "red" },
          ].map(s => (
            <div key={s.label} className={`rounded-lg border p-3 text-center ${s.color === 'red' ? 'bg-red-50 border-red-200' : s.color === 'amber' ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`} data-testid={`sim-finding-${s.label.replace(/\s+/g, '-')}`}>
              <div className="text-[10px] font-semibold text-slate-600 mb-1.5">{s.label}</div>
              <div className="flex justify-center gap-2 text-[11px] font-mono">
                <span className="text-red-600">CC: {s.cc}</span>
                <span className="text-blue-600">Cos: {s.cos}</span>
                <span className="text-emerald-600 font-bold">PAR: {s.par}</span>
              </div>
              <div className={`text-[10px] mt-1.5 ${s.color === 'red' ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>{s.note}</div>
            </div>
          ))}
        </div>

        {/* Power curve chart */}
        <div>
          <div className="text-xs font-semibold text-slate-700 mb-1">(A) Detection power vs. phase-concentration ratio</div>
          <div className="text-[10px] text-slate-500 mb-2">
            β₂ / √(β₀² + β₂²) = 0 → constant coupling throughout the cycle; = 1 → coupling maximal at ZT6, inverted at ZT18 (sin-concentrated)
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={SIM_DATA} margin={{ top: 5, right: 20, bottom: 25, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="ratio"
                type="number"
                domain={[0, 1]}
                tickFormatter={(v: number) => v.toFixed(1)}
                label={{ value: "Phase-concentration ratio  β₂ / √(β₀² + β₂²)", position: "bottom", fontSize: 10, offset: 10 }}
              />
              <YAxis domain={[0, 1.05]} tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} tick={{ fontSize: 10 }} />
              <Tooltip
                formatter={(v: number, name: string) => [`${(v * 100).toFixed(1)}%`, name]}
                labelFormatter={(l: number) => `ratio = ${Number(l).toFixed(2)}`}
              />
              <Legend verticalAlign="top" iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine y={0.05} stroke="#94a3b8" strokeDasharray="4 3" label={{ value: "α = 0.05", position: "right", fontSize: 9, fill: "#94a3b8" }} />
              <Line type="monotone" dataKey="cc"      name="Cross-correlation (Bonferroni)"      stroke="#c0392b" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="cosinor" name="Cosinor phase-diff (±6 h, rhythmic)" stroke="#2980b9" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="par2"    name="PAR(2) F-test (β₀, β₁, β₂)"         stroke="#27ae60" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Rhythmicity and FPR side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-semibold text-slate-700 mb-1">(B) Fraction of targets passing 24 h rhythmicity test</div>
            <div className="text-[10px] text-slate-500 mb-2">
              Cosinor phase-diff requires the target to be independently rhythmic. At r = 1, only 4.8% pass — the target oscillates at 12 h, not 24 h.
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={SIM_DATA} margin={{ top: 5, right: 15, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="ratio" type="number" domain={[0, 1]} tickFormatter={(v: number) => v.toFixed(1)} tick={{ fontSize: 9 }} label={{ value: "Phase-concentration ratio", position: "bottom", fontSize: 9, offset: 8 }} />
                <YAxis domain={[0, 1.05]} tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} tick={{ fontSize: 9 }} />
                <Tooltip formatter={(v: number) => `${(v * 100).toFixed(1)}%`} labelFormatter={(l: number) => `ratio = ${Number(l).toFixed(2)}`} />
                <ReferenceLine y={0.05} stroke="#94a3b8" strokeDasharray="4 3" />
                <Line type="monotone" dataKey="rhythmic" name="Target rhythmic (24 h)" stroke="#8e44ad" strokeWidth={2} dot={{ r: 2.5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-700 mb-1">False positive rates under complete null (β = 0)</div>
            <div className="text-[10px] text-slate-500 mb-2">
              Nominal α = 0.05. Cross-correlation FPR is inflated (19%) due to searching 13 lags. PAR(2) closest to nominal.
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={SIM_FPR} margin={{ top: 5, right: 15, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="method" tick={{ fontSize: 9 }} />
                <YAxis domain={[0, 0.25]} tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} tick={{ fontSize: 9 }} />
                <Tooltip formatter={(v: number) => `${(v * 100).toFixed(1)}%`} />
                <ReferenceLine y={0.05} stroke="#94a3b8" strokeDasharray="4 3" label={{ value: "nominal α", fontSize: 9, fill: "#94a3b8" }} />
                <Bar dataKey="fpr" name="False positive rate" radius={[3, 3, 0, 0]}>
                  {SIM_FPR.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} fillOpacity={0.75} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Mechanism note */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-600 leading-relaxed space-y-1.5">
          <p><strong className="text-slate-800">Why cross-correlation fails at r = 1:</strong> The sin-concentrated coupling term β₂·sin(θ) integrates to near zero over a complete circadian cycle. The time-averaged covariance between the clock and target collapses regardless of how large β₂ is, leaving cross-correlation with nothing to detect. The PAR(2) F-test directly tests the conditional relationship — it doesn't time-average.</p>
          <p><strong className="text-slate-800">Why cosinor phase-difference also fails:</strong> β₂·sin(θ) drives the target at <em>twice</em> the circadian frequency (12 h period). At r = 1, only 4.8% of targets pass a 24 h rhythmicity screen. Phase-difference scoring requires the target to be independently rhythmic at the clock's frequency — so the method is undefined for the very cases PAR(2) is designed to find.</p>
          <p><strong className="text-slate-800">This is a mathematical result, not a tuned simulation:</strong> The coupling parameters are declared before running. The outcome is a direct consequence of the conditional vs. marginal distinction in the model structure. See Section 4.3 of Paper E for the formal proof.</p>
        </div>

        {/* Raw data toggle */}
        <button
          className="text-[10px] text-slate-400 hover:text-slate-600 underline"
          onClick={() => setShowTable(t => !t)}
          data-testid="sim-toggle-table"
        >
          {showTable ? "Hide" : "Show"} raw simulation data table
        </button>
        {showTable && (
          <div className="overflow-x-auto">
            <table className="w-full text-[10px] font-mono border-collapse" data-testid="sim-raw-table">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="px-2 py-1 text-right">ratio</th>
                  <th className="px-2 py-1 text-right">β₀</th>
                  <th className="px-2 py-1 text-right">β₂</th>
                  <th className="px-2 py-1 text-right text-red-600">CC power</th>
                  <th className="px-2 py-1 text-right text-blue-600">Cosinor power</th>
                  <th className="px-2 py-1 text-right text-emerald-600">PAR(2) power</th>
                  <th className="px-2 py-1 text-right text-purple-600">% rhythmic</th>
                </tr>
              </thead>
              <tbody>
                {SIM_DATA.map((row, i) => (
                  <tr key={i} className={`border-b border-slate-100 ${row.ratio === 1 ? 'bg-red-50 font-bold' : row.ratio === 0 ? 'bg-green-50' : ''}`}>
                    <td className="px-2 py-0.5 text-right">{row.ratio.toFixed(2)}</td>
                    <td className="px-2 py-0.5 text-right">{row.beta0.toFixed(3)}</td>
                    <td className="px-2 py-0.5 text-right">{row.beta2.toFixed(3)}</td>
                    <td className="px-2 py-0.5 text-right text-red-600">{(row.cc * 100).toFixed(1)}%</td>
                    <td className="px-2 py-0.5 text-right text-blue-600">{(row.cosinor * 100).toFixed(1)}%</td>
                    <td className="px-2 py-0.5 text-right text-emerald-600">{(row.par2 * 100).toFixed(1)}%</td>
                    <td className="px-2 py-0.5 text-right text-purple-600">{(row.rhythmic * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function FrameworkBenchmarks() {
  useScrollToHash();
  const [activeTab, setActiveTab] = useState("overview");
  const [expandedBenchmark, setExpandedBenchmark] = useState<string | null>(null);
  const [residualGeneSearch, setResidualGeneSearch] = useState("");
  const [modelCompGeneSearch, setModelCompGeneSearch] = useState("");

  const { data: simData, isLoading: simLoading } = useQuery<{ results: SimBenchResult[] }>({
    queryKey: ['/api/validation/simulation-benchmark'],
    queryFn: () => fetch('/api/validation/simulation-benchmark?n=100').then(r => r.json()),
  });

  const { data: residualData, isLoading: residualLoading } = useQuery<{ results: ResidualResult[]; summary: any }>({
    queryKey: ['/api/validation/residual-diagnostics'],
  });

  const { data: modelCompData, isLoading: modelCompLoading } = useQuery<{ results: ModelCompResult[]; summary: any }>({
    queryKey: ['/api/validation/model-comparison'],
  });

  const { data: altMetrics, isLoading: altLoading } = useQuery<{ results: AltMetricResult[]; summary: any }>({
    queryKey: ['/api/validation/alternative-metrics'],
  });

  const { data: baselineData, isLoading: baselineLoading } = useQuery<{ syntheticResults: BaselineResult[]; summary: any }>({
    queryKey: ['/api/validation/baseline-comparison'],
  });

  const { data: couplingROC, isLoading: couplingROCLoading } = useQuery<any>({
    queryKey: ['/api/benchmarks/coupling-roc'],
    staleTime: Infinity,
  });

  const { data: auditorData, isLoading: auditorLoading } = useQuery<{
    overallScore: number;
    benchmarksPassed: number;
    totalBenchmarks: number;
    benchmarks: { turing: MasterBenchmark; fisher: MasterBenchmark; network: MasterBenchmark; ueda: MasterBenchmark };
    conclusion: string;
  }>({
    queryKey: ['/api/benchmarks/master-auditor'],
  });

  const isLoading = simLoading || residualLoading || modelCompLoading || altLoading || baselineLoading || auditorLoading;

  const wellSpecRate = residualData?.summary
    ? Math.round(residualData.summary.wellSpecifiedRate * 100)
    : null;

  const simByN = simData?.results
    ? Object.entries(
        simData.results.reduce((acc, r) => {
          if (!acc[r.n]) acc[r.n] = [];
          acc[r.n].push(r);
          return acc;
        }, {} as Record<number, SimBenchResult[]>)
      ).map(([n, results]) => ({
        n: parseInt(n),
        meanBias: results.reduce((s, r) => s + Math.abs(r.bias), 0) / results.length,
        meanRMSE: results.reduce((s, r) => s + r.rmse, 0) / results.length,
        count: results.length,
      })).sort((a, b) => a.n - b.n)
    : [];

  const altMetricsComparison = altMetrics?.results ? (() => {
    const clock = altMetrics.results.filter(r => r.type === 'CLOCK');
    const target = altMetrics.results.filter(r => r.type === 'TARGET');
    const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

    const ar2ClockMean = mean(clock.map(r => r.ar2Eigenvalue));
    const ar2TargetMean = mean(target.map(r => r.ar2Eigenvalue));
    const ar1ClockMean = mean(clock.map(r => r.ar1Autocorr));
    const ar1TargetMean = mean(target.map(r => r.ar1Autocorr));
    const sumClockMean = mean(clock.map(r => r.sumArCoeffs));
    const sumTargetMean = mean(target.map(r => r.sumArCoeffs));

    return {
      ar2Gap: ar2ClockMean - ar2TargetMean,
      ar1Gap: ar1ClockMean - ar1TargetMean,
      sumGap: sumClockMean - sumTargetMean,
      ar2ClockMean,
      ar2TargetMean,
      ar1ClockMean,
      ar1TargetMean,
      chartData: [
        { metric: 'AR(2) |λ|', clockMean: ar2ClockMean, targetMean: ar2TargetMean, gap: ar2ClockMean - ar2TargetMean },
        { metric: 'AR(1) ρ', clockMean: ar1ClockMean, targetMean: ar1TargetMean, gap: ar1ClockMean - ar1TargetMean },
        { metric: 'Σ AR coeff', clockMean: sumClockMean, targetMean: sumTargetMean, gap: sumClockMean - sumTargetMean },
      ],
    };
  })() : null;

  const radarData = auditorData ? [
    { subject: 'Turing', score: auditorData.benchmarks.turing.score, fullMark: 100 },
    { subject: 'Fisher Info', score: auditorData.benchmarks.fisher.score, fullMark: 100 },
    { subject: 'STRING Network', score: auditorData.benchmarks.network.score, fullMark: 100 },
    { subject: 'Ueda Timetable', score: auditorData.benchmarks.ueda.score, fullMark: 100 },
  ] : [];

  const bestSimRMSE = simByN.length > 0 ? simByN[simByN.length - 1]?.meanRMSE : null;
  const overviewScores = {
    accuracy: bestSimRMSE !== null ? Math.round(Math.max(0, (1 - bestSimRMSE) * 100)) : null,
    modelSpec: wellSpecRate,
    externalVal: auditorData?.overallScore ?? null,
  };

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8 bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-start gap-3 mb-2">
          <Link href="/" data-testid="link-back">
            <div className="text-slate-500 hover:text-slate-700 cursor-pointer transition-colors mt-1">
              <ArrowLeft size={20} />
            </div>
          </Link>
          <div className="flex-1">
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2" data-testid="text-page-title">
                <Award className="text-amber-400" size={24} />
                Framework Benchmarks & Accuracy Report
              </h1>
              {modelCompData && (
                <button
                  className="shrink-0 flex items-center gap-1.5 text-xs text-slate-500 border border-slate-300 rounded px-2.5 py-1.5 hover:bg-slate-100"
                  onClick={() => {
                    const fmt = (v: number) =>
                      !isFinite(v) || isNaN(v) ? "" : parseFloat(v.toFixed(4));
                    downloadAsCSV(
                      (modelCompData.results || []).map((r: ModelCompResult) => ({
                        gene: r.gene,
                        type: r.type,
                        ar1_aic: fmt(r.ar1.aic),
                        ar1_bic: fmt(r.ar1.bic),
                        ar1_eigenvalue: fmt(r.ar1.eigenvalue),
                        ar2_aic: fmt(r.ar2.aic),
                        ar2_bic: fmt(r.ar2.bic),
                        ar2_eigenvalue: fmt(r.ar2.eigenvalue),
                        ar3_aic: fmt(r.ar3.aic),
                        ar3_bic: fmt(r.ar3.bic),
                        ar3_eigenvalue: fmt(r.ar3.eigenvalue),
                        preferred_by_aic: r.preferredByAIC,
                        preferred_by_bic: r.preferredByBIC,
                      })),
                      'framework_benchmarks_model_comparison.csv'
                    );
                  }}
                  data-testid="button-download-benchmarks-csv"
                >
                  <Download size={13} /> Download Model Comparison CSV
                </button>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Accuracy, model fit, and reliability metrics — how PAR(2) eigenvalue estimates perform
            </p>
            <div className="rounded-lg bg-slate-100 border border-slate-200 p-4 mt-3">
              <p className="text-sm text-slate-600 leading-relaxed">
                <strong className="text-slate-900">What you can do:</strong> Compares AR(2) against standard time-series methods (ARIMA, OU, State-Space) using accuracy, model fit, FDR controls, and simulation benchmarks. Includes external validation against Turing, Fisher, STRING, and Ueda databases. Use these results to justify your choice of AR(2) in publications.
              </p>
            </div>
          </div>
        </div>

        <PaperCrossLinks currentPage="/framework-benchmarks" />

        <Alert className="bg-blue-500/10 border-blue-500/30">
          <Info className="h-4 w-4 text-blue-400" />
          <AlertDescription className="text-slate-600 text-sm">
            This page presents benchmark results for PAR(2) eigenvalue analysis. Each section is labeled with its data source:
            <span className="inline-block ml-1 px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Real Dataset (GEO)</span>,
            <span className="inline-block ml-1 px-1.5 py-0.5 rounded text-[10px] bg-blue-500/20 text-blue-400 border border-blue-500/30">Literature + Real Eigenvalues</span>,
            <span className="inline-block ml-1 px-1.5 py-0.5 rounded text-[10px] bg-violet-500/20 text-violet-400 border border-violet-500/30">Theoretical Model</span>, or
            <span className="inline-block ml-1 px-1.5 py-0.5 rounded text-[10px] bg-orange-500/20 text-orange-400 border border-orange-500/30">Simulation Only</span>.
            Hover over each badge for details. Strongest evidence comes from real-data benchmarks (Ueda cross-condition test).
          </AlertDescription>
        </Alert>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-primary mr-3" size={24} />
            <span className="text-slate-500">Running benchmark suite...</span>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-slate-50 border border-slate-200 flex-wrap h-auto gap-1 p-1">
              <TabsTrigger value="overview" className="text-xs" data-testid="tab-overview">Overview</TabsTrigger>
              <TabsTrigger value="accuracy" className="text-xs" data-testid="tab-accuracy">Accuracy & Bias</TabsTrigger>
              <TabsTrigger value="model-fit" className="text-xs" data-testid="tab-model-fit">Model Fit Quality</TabsTrigger>
              <TabsTrigger value="method-comparison" className="text-xs" data-testid="tab-method-comparison">vs Other Methods</TabsTrigger>
              <TabsTrigger value="external" className="text-xs" data-testid="tab-external">External Benchmarks</TabsTrigger>
              <TabsTrigger value="fdr" className="text-xs" data-testid="tab-fdr">Reliability & Controls</TabsTrigger>
              <TabsTrigger value="coupling-roc" className="text-xs font-semibold text-amber-600 data-[state=active]:bg-amber-50 data-[state=active]:text-amber-700" data-testid="tab-coupling-roc">Coupling ROC/PR ★</TabsTrigger>
            </TabsList>

            {/* OVERVIEW TAB */}
            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {overviewScores.accuracy !== null && (
                  <ScoreGauge score={overviewScores.accuracy} label={`Recovery Score (n=24, RMSE=${bestSimRMSE?.toFixed(3) ?? '?'})`} />
                )}
                {overviewScores.modelSpec !== null && (
                  <ScoreGauge score={overviewScores.modelSpec} label="Model Specification (Ljung-Box)" />
                )}
                {overviewScores.externalVal !== null && (
                  <ScoreGauge score={overviewScores.externalVal} label="External Validation" />
                )}
              </div>

              <Card className="bg-white border-slate-200">
                <CardHeader>
                  <CardTitle className="text-slate-900 text-lg">How PAR(2) Compares to Lab Standards</CardTitle>
                  <CardDescription className="text-slate-500">
                    Key metrics vs what would be expected from established tools
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ComparisonRow
                      metric="Eigenvalue Recovery Accuracy"
                      par2Value={simByN.length > 0 ? `RMSE = ${simByN[simByN.length - 1]?.meanRMSE.toFixed(3)} (n=24)` : "Loading..."}
                      expected="RMSE < 0.15 for n≥24"
                      pass={simByN.length > 0 && simByN[simByN.length - 1]?.meanRMSE < 0.15}
                      note="Simulation benchmark: known eigenvalues recovered"
                    />
                    <ComparisonRow
                      metric="Model Specification Rate"
                      par2Value={wellSpecRate !== null ? `${wellSpecRate}% genes pass` : "Loading..."}
                      expected="≥60% well-specified (Ljung-Box p > 0.05)"
                      pass={wellSpecRate !== null && wellSpecRate >= 60}
                      note="AR(2) residuals tested for white noise"
                    />
                    <ComparisonRow
                      metric="Clock vs Target Separation"
                      par2Value={altMetricsComparison ? `Gap = ${altMetricsComparison.ar2Gap.toFixed(3)}` : "Loading..."}
                      expected="Positive clock > target gap"
                      pass={altMetricsComparison !== null && altMetricsComparison.ar2Gap > 0}
                      note="Core biological prediction: clock genes more persistent"
                    />
                    <ComparisonRow
                      metric="External Benchmark Score"
                      par2Value={auditorData ? `${auditorData.overallScore}/100 (${auditorData.benchmarksPassed}/${auditorData.totalBenchmarks} passed)` : "Loading..."}
                      expected="≥50/100 on independent tests"
                      pass={!!auditorData && auditorData.overallScore >= 50}
                      note="Turing, Fisher, STRING, Ueda benchmarks"
                    />
                  </div>

                  <Alert className="bg-slate-50 border-slate-200 mt-4">
                    <AlertDescription className="text-slate-500 text-xs">
                      <strong className="text-slate-600">Context:</strong> PAR(2) measures a different quantity than rhythm detection tools (JTK_CYCLE, RAIN, COSINOR).
                      Those tools answer "is this gene rhythmic?" (binary), while PAR(2) measures "how persistent is this gene's dynamics?" (continuous |λ|).
                      Direct accuracy comparison requires care — they complement rather than compete.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>

              {altMetricsComparison && (
                <Card className="bg-white border-slate-200">
                  <CardHeader>
                    <CardTitle className="text-slate-900 text-lg">Metric Separation Power</CardTitle>
                    <CardDescription className="text-slate-500">
                      Which metric best separates clock genes from target genes?
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={altMetricsComparison.chartData} barGap={8}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="metric" tick={{ fill: '#64748b', fontSize: 12 }} />
                        <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Bar dataKey="clockMean" name="Clock genes (mean)" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="targetMean" name="Target genes (mean)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="grid grid-cols-3 gap-3 mt-4">
                      {altMetricsComparison.chartData.map(d => (
                        <div key={d.metric} className={`text-center p-2 rounded border ${d.gap > 0.1 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-50 border-slate-200'}`}>
                          <div className="text-xs text-slate-500">{d.metric}</div>
                          <div className={`text-lg font-bold ${d.gap > 0.1 ? 'text-emerald-400' : 'text-slate-600'}`}>
                            {d.gap > 0 ? '+' : ''}{d.gap.toFixed(3)}
                          </div>
                          <div className="text-[10px] text-slate-500">clock − target gap</div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* ACCURACY TAB */}
            <TabsContent value="accuracy" className="space-y-6">
              <Card className="bg-white border-slate-200">
                <CardHeader>
                  <CardTitle className="text-slate-900 text-lg flex items-center gap-2">
                    <Crosshair className="text-cyan-400" size={18} />
                    Eigenvalue Recovery: Bias & RMSE by Sample Size
                  </CardTitle>
                  <CardDescription className="text-slate-500">
                    Simulated AR(2) series with known eigenvalues — how accurately can we recover the true value?
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {simByN.length > 0 && (
                    <>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={simByN} barGap={4}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                          <XAxis dataKey="n" tick={{ fill: '#64748b', fontSize: 12 }} label={{ value: 'Timepoints', fill: '#64748b', position: 'bottom', offset: -5 }} />
                          <YAxis tick={{ fill: '#64748b', fontSize: 11 }} label={{ value: 'Error', fill: '#64748b', angle: -90, position: 'insideLeft' }} />
                          <Tooltip content={<CustomTooltip />} />
                          <Legend />
                          <Bar dataKey="meanBias" name="Mean |Bias|" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="meanRMSE" name="Mean RMSE" fill="#ef4444" radius={[4, 4, 0, 0]} />
                          <ReferenceLine y={0.15} stroke="#22c55e" strokeDasharray="5 5" label={{ value: 'Target', fill: '#22c55e', fontSize: 11 }} />
                        </BarChart>
                      </ResponsiveContainer>
                      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                        {simByN.map(d => (
                          <div key={d.n} className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center" data-testid={`accuracy-n${d.n}`}>
                            <div className="text-xs text-slate-500">n = {d.n} timepoints</div>
                            <div className={`text-lg font-bold ${d.meanRMSE < 0.15 ? 'text-emerald-400' : d.meanRMSE < 0.25 ? 'text-amber-400' : 'text-red-400'}`}>
                              RMSE {d.meanRMSE.toFixed(3)}
                            </div>
                            <div className="text-xs text-slate-500">Bias: {d.meanBias.toFixed(3)}</div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  <Alert className="bg-slate-50 border-slate-200 mt-4">
                    <AlertDescription className="text-slate-500 text-xs">
                      <strong className="text-slate-600">Expected standard:</strong> With 24 timepoints (typical circadian experiment), RMSE should be below 0.15.
                      With only 6 timepoints, higher error is expected — this matches theoretical predictions for short AR(2) series.
                      Lab benchmarks like JTK_CYCLE also show degraded performance at n &lt; 12.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>

              {simData?.results && (
                <Card className="bg-white border-slate-200">
                  <CardHeader>
                    <CardTitle className="text-slate-900 text-lg">Detailed Recovery by True Eigenvalue</CardTitle>
                    <CardDescription className="text-slate-500">
                      Accuracy varies by both sample size and the true underlying eigenvalue
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm" data-testid="table-sim-detail">
                        <thead>
                          <tr className="border-b border-slate-200">
                            <th className="text-left text-slate-500 pb-2 pr-4">True |λ|</th>
                            <th className="text-left text-slate-500 pb-2 pr-4">N</th>
                            <th className="text-left text-slate-500 pb-2 pr-4">Recovered</th>
                            <th className="text-left text-slate-500 pb-2 pr-4">Bias</th>
                            <th className="text-left text-slate-500 pb-2 pr-4">RMSE</th>
                            <th className="text-left text-slate-500 pb-2">Grade</th>
                          </tr>
                        </thead>
                        <tbody>
                          {simData.results.map((r, i) => {
                            const grade = r.rmse < 0.10 ? 'A' : r.rmse < 0.15 ? 'B' : r.rmse < 0.25 ? 'C' : r.rmse < 0.4 ? 'D' : 'F';
                            const gradeColor = grade === 'A' ? 'text-emerald-400' : grade === 'B' ? 'text-green-400' : grade === 'C' ? 'text-amber-400' : grade === 'D' ? 'text-orange-400' : 'text-red-400';
                            return (
                              <tr key={i} className="border-b border-slate-800/50">
                                <td className="py-2 pr-4 text-cyan-300 font-mono">{r.trueEigenvalue}</td>
                                <td className="py-2 pr-4 text-slate-600">{r.n}</td>
                                <td className="py-2 pr-4 text-slate-900 font-mono">{r.estimatedMean.toFixed(3)} ± {r.estimatedStd.toFixed(3)}</td>
                                <td className={`py-2 pr-4 font-mono ${Math.abs(r.bias) < 0.05 ? 'text-emerald-400' : Math.abs(r.bias) < 0.15 ? 'text-amber-400' : 'text-red-400'}`}>
                                  {r.bias > 0 ? '+' : ''}{r.bias.toFixed(3)}
                                </td>
                                <td className="py-2 pr-4 font-mono text-slate-600">{r.rmse.toFixed(3)}</td>
                                <td className={`py-2 font-bold ${gradeColor}`}>{grade}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* MODEL FIT TAB */}
            <TabsContent value="model-fit" className="space-y-6">
              {residualData && (
                <Card className="bg-white border-slate-200">
                  <CardHeader>
                    <CardTitle className="text-slate-900 text-lg flex items-center gap-2">
                      <Activity className="text-purple-400" size={18} />
                      Ljung-Box Residual Diagnostics
                    </CardTitle>
                    <CardDescription className="text-slate-500">
                      Are AR(2) residuals white noise? If yes, the model is well-specified.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 mb-4">
                      <ScoreGauge score={wellSpecRate ?? 0} label="Well-Specified" />
                      <div className="flex-1 text-sm text-slate-500">
                        <p><strong className="text-slate-600">{residualData.summary.wellSpecified}/{residualData.results.length}</strong> genes have white-noise residuals (Ljung-Box p &gt; 0.05)</p>
                        <p className="mt-1 text-xs">
                          For comparison, standard COSINOR typically achieves 50-70% specification rate on the same data.
                          A rate above 60% indicates the AR(2) model captures the data's autocorrelation structure well.
                        </p>
                      </div>
                    </div>

                    <div className="relative mb-3">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                      <Input
                        placeholder="Search genes..."
                        value={residualGeneSearch}
                        onChange={(e) => setResidualGeneSearch(e.target.value)}
                        className="pl-8 bg-slate-50 border-slate-200 text-slate-800 text-xs h-8"
                        data-testid="input-residual-gene-search"
                      />
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm" data-testid="table-residual">
                        <thead>
                          <tr className="border-b border-slate-200">
                            <th className="text-left text-slate-500 pb-2 pr-3">Gene</th>
                            <th className="text-left text-slate-500 pb-2 pr-3">Type</th>
                            <th className="text-left text-slate-500 pb-2 pr-3">|λ|</th>
                            <th className="text-left text-slate-500 pb-2 pr-3">LB Stat</th>
                            <th className="text-left text-slate-500 pb-2 pr-3">p-value</th>
                            <th className="text-left text-slate-500 pb-2">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {residualData.results.filter(r => r.gene.toLowerCase().includes(residualGeneSearch.toLowerCase())).map((r, i) => (
                            <tr key={i} className="border-b border-slate-800/50">
                              <td className="py-2 pr-3 text-slate-900 font-medium">{r.gene}</td>
                              <td className="py-2 pr-3">
                                <Badge className={r.type === 'CLOCK' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'}>
                                  {r.type}
                                </Badge>
                              </td>
                              <td className="py-2 pr-3 font-mono text-cyan-300">{r.eigenvalue.toFixed(3)}</td>
                              <td className="py-2 pr-3 font-mono text-slate-600">{r.ljungBoxStat.toFixed(2)}</td>
                              <td className="py-2 pr-3 font-mono text-slate-600">{formatP(r.pValue)}</td>
                              <td className="py-2">
                                {r.isWellSpecified
                                  ? <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 size={14} /> Pass</span>
                                  : <span className="text-red-400 flex items-center gap-1"><XCircle size={14} /> Fail</span>
                                }
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {modelCompData && (
                <Card className="bg-white border-slate-200">
                  <CardHeader>
                    <CardTitle className="text-slate-900 text-lg flex items-center gap-2">
                      <BarChart3 className="text-teal-400" size={18} />
                      AR(1) vs AR(2) vs AR(3) Model Selection
                    </CardTitle>
                    <CardDescription className="text-slate-500">
                      AIC/BIC information criteria — which model order is truly preferred?
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-blue-400">{modelCompData.summary.ar1Preferred}</div>
                        <div className="text-xs text-slate-500">AR(1) preferred</div>
                      </div>
                      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-emerald-400">{modelCompData.summary.ar2Preferred}</div>
                        <div className="text-xs text-slate-500">AR(2) preferred</div>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-purple-400">{modelCompData.summary.ar3Preferred}</div>
                        <div className="text-xs text-slate-500">AR(3) preferred</div>
                      </div>
                    </div>

                    <Alert className="bg-slate-50 border-slate-200">
                      <AlertDescription className="text-slate-500 text-xs">
                        <strong className="text-slate-600">Methodology:</strong> All models are compared on the same effective data window (n − 3 observations) using BIC, which penalizes extra parameters more heavily than AIC for small samples.{' '}
                        <strong className="text-slate-600">Pattern:</strong> AR(1) tends to be preferred for target genes (simpler decay dynamics), while AR(2) and AR(3) are selected for clock genes with stronger oscillatory behavior.{' '}
                        AR(2) is the minimum model order that captures complex eigenvalues (oscillatory dynamics) — even when BIC selects AR(1), the AR(2) eigenvalue modulus |λ| remains the key persistence metric because it uniquely decomposes oscillatory vs. monotonic memory.
                      </AlertDescription>
                    </Alert>

                    <div className="relative my-4">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                      <Input
                        placeholder="Search genes..."
                        value={modelCompGeneSearch}
                        onChange={(e) => setModelCompGeneSearch(e.target.value)}
                        className="pl-8 bg-slate-50 border-slate-200 text-slate-800 text-xs h-8"
                        data-testid="input-model-comp-gene-search"
                      />
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm" data-testid="table-model-comp">
                        <thead>
                          <tr className="border-b border-slate-200">
                            <th className="text-left text-slate-500 pb-2 pr-3">Gene</th>
                            <th className="text-left text-slate-500 pb-2 pr-3">Type</th>
                            <th className="text-left text-slate-500 pb-2 pr-3">AR(1) AIC</th>
                            <th className="text-left text-slate-500 pb-2 pr-3">AR(2) AIC</th>
                            <th className="text-left text-slate-500 pb-2 pr-3">AR(3) AIC</th>
                            <th className="text-left text-slate-500 pb-2">Preferred</th>
                          </tr>
                        </thead>
                        <tbody>
                          {modelCompData.results.filter(r => r.gene.toLowerCase().includes(modelCompGeneSearch.toLowerCase())).map((r, i) => (
                            <tr key={i} className="border-b border-slate-800/50">
                              <td className="py-2 pr-3 text-slate-900 font-medium">{r.gene}</td>
                              <td className="py-2 pr-3">
                                <Badge className={r.type === 'CLOCK' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'}>
                                  {r.type}
                                </Badge>
                              </td>
                              <td className={`py-2 pr-3 font-mono ${r.preferredModel === 'AR(1)' ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>{r.ar1.aic.toFixed(1)}</td>
                              <td className={`py-2 pr-3 font-mono ${r.preferredModel === 'AR(2)' ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>{r.ar2.aic.toFixed(1)}</td>
                              <td className={`py-2 pr-3 font-mono ${r.preferredModel === 'AR(3)' ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>{r.ar3.aic.toFixed(1)}</td>
                              <td className="py-2">
                                <Badge className={r.preferredModel === 'AR(2)' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-slate-700/50 text-slate-600 border-slate-300/50'}>
                                  {r.preferredModel}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* METHOD COMPARISON TAB */}
            <TabsContent value="method-comparison" className="space-y-6">
              {baselineData && (
                <Card className="bg-white border-slate-200">
                  <CardHeader>
                    <CardTitle className="text-slate-900 text-lg flex items-center gap-2">
                      <Target className="text-rose-400" size={18} />
                      PAR(2) vs Standard Time-Series Methods
                    </CardTitle>
                    <CardDescription className="text-slate-500">
                      Head-to-head comparison against ARIMA(2,0,0), Ornstein-Uhlenbeck, and State-Space AR(2)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {baselineData.syntheticResults?.map((result, idx) => (
                      <div key={idx} className="mb-6 last:mb-0">
                        <h4 className="text-slate-900 font-medium mb-3 flex items-center gap-2">
                          <Badge className={result.condition === 'healthy' ? 'bg-emerald-500/20 text-emerald-400' : result.condition === 'precancer' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}>
                            {result.condition === 'healthy' ? 'Low |λ|' : result.condition === 'precancer' ? 'Mid |λ|' : 'High |λ|'}
                          </Badge>
                          {result.dataset} (n={result.sampleSize})
                        </h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm" data-testid={`table-baseline-${idx}`}>
                            <thead>
                              <tr className="border-b border-slate-200">
                                <th className="text-left text-slate-500 pb-2 pr-3">Model</th>
                                <th className="text-left text-slate-500 pb-2 pr-3">|λ|</th>
                                <th className="text-left text-slate-500 pb-2 pr-3">AIC</th>
                                <th className="text-left text-slate-500 pb-2 pr-3">BIC</th>
                                <th className="text-left text-slate-500 pb-2">Residual Var</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(result.models).map(([key, m]) => (
                                <tr key={key} className={`border-b border-slate-800/50 ${key === 'par2' ? 'bg-primary/5' : ''}`}>
                                  <td className={`py-2 pr-3 font-medium ${key === 'par2' ? 'text-primary' : 'text-slate-600'}`}>{m.model}</td>
                                  <td className="py-2 pr-3 font-mono text-cyan-300">{m.eigenvalueModulus.toFixed(3)}</td>
                                  <td className="py-2 pr-3 font-mono text-slate-600">{m.aic.toFixed(1)}</td>
                                  <td className="py-2 pr-3 font-mono text-slate-600">{m.bic.toFixed(1)}</td>
                                  <td className="py-2 font-mono text-slate-600">{m.residualVariance.toFixed(4)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="mt-2 text-xs text-slate-500 italic">{result.comparison.conclusion}</div>
                        <div className="mt-1 text-xs text-slate-500">AIC ranking: {result.comparison.aicRanking.join(' > ')}</div>
                      </div>
                    ))}

                    <Alert className="bg-slate-50 border-slate-200 mt-4">
                      <AlertDescription className="text-slate-500 text-xs">
                        <strong className="text-slate-600">Key insight:</strong> ARIMA may sometimes achieve marginally better AIC on synthetic data because it uses an intercept term.
                        However, PAR(2)'s eigenvalue |λ| provides <em>circadian-specific interpretation</em> (persistence hierarchy) that general ARIMA cannot.
                        The Ornstein-Uhlenbeck model consistently underperforms because it is first-order and cannot capture oscillatory dynamics.
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
              )}

              <Card className="bg-white border-slate-200">
                <CardHeader>
                  <CardTitle className="text-slate-900 text-lg flex items-center gap-2">
                    <Beaker className="text-violet-400" size={18} />
                    PAR(2) vs Established Circadian Tools (Feature Comparison)
                  </CardTitle>
                  <CardDescription className="text-slate-500">
                    Conceptual comparison of what each tool measures — these are design features, not head-to-head empirical results
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" data-testid="table-tools-comparison">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left text-slate-500 pb-2 pr-3">Feature</th>
                          <th className="text-left text-slate-500 pb-2 pr-3">PAR(2)</th>
                          <th className="text-left text-slate-500 pb-2 pr-3">JTK_CYCLE</th>
                          <th className="text-left text-slate-500 pb-2 pr-3">RAIN</th>
                          <th className="text-left text-slate-500 pb-2">COSINOR</th>
                        </tr>
                      </thead>
                      <tbody className="text-slate-600">
                        <tr className="border-b border-slate-800/50">
                          <td className="py-2 pr-3 font-medium text-slate-800">What it measures</td>
                          <td className="py-2 pr-3 text-primary">Dynamic persistence (|λ|)</td>
                          <td className="py-2 pr-3">Rhythmicity (binary)</td>
                          <td className="py-2 pr-3">Asymmetric rhythm</td>
                          <td className="py-2 pr-3">Cosine fit quality</td>
                        </tr>
                        <tr className="border-b border-slate-800/50">
                          <td className="py-2 pr-3 font-medium text-slate-800">Output type</td>
                          <td className="py-2 pr-3 text-primary">Continuous (0-1)</td>
                          <td className="py-2 pr-3">p-value + period</td>
                          <td className="py-2 pr-3">p-value + shape</td>
                          <td className="py-2 pr-3">Amplitude + R²</td>
                        </tr>
                        <tr className="border-b border-slate-800/50">
                          <td className="py-2 pr-3 font-medium text-slate-800">Min timepoints</td>
                          <td className="py-2 pr-3">5 (degraded), 12+ ideal</td>
                          <td className="py-2 pr-3">12+ (2 cycles)</td>
                          <td className="py-2 pr-3">12+ (2 cycles)</td>
                          <td className="py-2 pr-3">6+ (1 cycle)</td>
                        </tr>
                        <tr className="border-b border-slate-800/50">
                          <td className="py-2 pr-3 font-medium text-slate-800">FDR control</td>
                          <td className="py-2 pr-3">BH correction on AR coefficients; permutation tests</td>
                          <td className="py-2 pr-3">BH on rank-based p</td>
                          <td className="py-2 pr-3">BH on umbrella p</td>
                          <td className="py-2 pr-3">F-test p-value</td>
                        </tr>
                        <tr className="border-b border-slate-800/50">
                          <td className="py-2 pr-3 font-medium text-slate-800">Handles asymmetry</td>
                          <td className="py-2 pr-3">Via root-space geometry</td>
                          <td className="py-2 pr-3">No (symmetric)</td>
                          <td className="py-2 pr-3 text-emerald-400">Yes (core feature)</td>
                          <td className="py-2 pr-3">No (cosine only)</td>
                        </tr>
                        <tr className="border-b border-slate-800/50">
                          <td className="py-2 pr-3 font-medium text-slate-800">Captures memory</td>
                          <td className="py-2 pr-3 text-emerald-400">Yes (multi-generation)</td>
                          <td className="py-2 pr-3">No</td>
                          <td className="py-2 pr-3">No</td>
                          <td className="py-2 pr-3">No</td>
                        </tr>
                        <tr className="border-b border-slate-800/50">
                          <td className="py-2 pr-3 font-medium text-slate-800">Unique advantage</td>
                          <td className="py-2 pr-3 text-primary">Clock &gt; target hierarchy</td>
                          <td className="py-2 pr-3">Non-parametric robustness</td>
                          <td className="py-2 pr-3">Asymmetric waveforms</td>
                          <td className="py-2 pr-3">Phase estimation</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <Alert className="bg-amber-500/10 border-amber-500/30">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                    <AlertDescription className="text-slate-600 text-xs">
                      <strong>Important:</strong> PAR(2) is not a replacement for JTK_CYCLE or RAIN — it measures a fundamentally different quantity (persistence, not rhythmicity).
                      A gene can be rhythmic (JTK p &lt; 0.05) but have low persistence (low |λ|), or vice versa.
                      The tools are complementary: JTK/RAIN asks "is it oscillating?" while PAR(2) asks "how long do perturbations last?"
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </TabsContent>

            {/* EXTERNAL BENCHMARKS TAB */}
            <TabsContent value="external" className="space-y-6">
              {auditorData && (
                <>
                  <Card className="bg-white border-slate-200">
                    <CardHeader>
                      <CardTitle className="text-slate-900 text-lg flex items-center gap-2">
                        <ShieldCheck className="text-emerald-400" size={18} />
                        Master Auditor: External Benchmark Suite
                      </CardTitle>
                      <CardDescription className="text-slate-500">
                        Four benchmarks testing PAR(2) predictions against physics and biology principles.
                        Uses representative eigenvalue data from PAR(2) analyses (not exhaustive genome-wide runs).
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <ResponsiveContainer width="100%" height={300}>
                            <RadarChart data={radarData}>
                              <PolarGrid stroke="#334155" />
                              <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 12 }} />
                              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} />
                              <Radar name="Score" dataKey="score" stroke="#22c55e" fill="#22c55e" fillOpacity={0.15} />
                            </RadarChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="flex flex-col justify-center">
                          <div className="text-center mb-4">
                            <div className={`text-5xl font-bold ${auditorData.overallScore >= 70 ? 'text-emerald-400' : auditorData.overallScore >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                              {auditorData.overallScore}/100
                            </div>
                            <div className="text-slate-500 text-sm mt-1">Overall Score</div>
                            <div className="text-slate-500 text-xs mt-1">
                              {auditorData.benchmarksPassed}/{auditorData.totalBenchmarks} benchmarks passed
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="space-y-4">
                    {Object.entries(auditorData.benchmarks).map(([key, bench]) => {
                      const isExpanded = expandedBenchmark === key;
                      const icons: Record<string, any> = { turing: Microscope, fisher: Activity, network: Network, ueda: Dna };
                      const IconComp = icons[key] || Info;
                      const colors: Record<string, string> = { turing: 'text-amber-400', fisher: 'text-purple-400', network: 'text-blue-400', ueda: 'text-teal-400' };

                      return (
                        <Card key={key} className="bg-white border-slate-200">
                          <div
                            className="cursor-pointer"
                            onClick={() => setExpandedBenchmark(isExpanded ? null : key)}
                            data-testid={`benchmark-toggle-${key}`}
                          >
                            <CardHeader className="pb-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <IconComp className={colors[key]} size={18} />
                                  <CardTitle className="text-slate-900 text-sm">{bench.name}</CardTitle>
                                </div>
                                <div className="flex items-center gap-2">
                                  <StatusBadge status={bench.status} />
                                  {isExpanded ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
                                </div>
                              </div>
                              <CardDescription className="text-slate-500 text-xs">{bench.question}</CardDescription>
                              <div className="mt-1"><DataSourceBadge benchmarkKey={key} /></div>
                            </CardHeader>
                            <CardContent className="text-sm space-y-2">
                              <div className="flex justify-between">
                                <span className="text-slate-500">Expected:</span>
                                <span className="text-slate-600 text-xs text-right max-w-[60%]">{bench.expectedResult}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-500">Actual:</span>
                                <span className="text-slate-900 text-xs text-right max-w-[60%]">{bench.actualResult}</span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-2 mt-2">
                                <div
                                  className={`h-2 rounded-full ${bench.score >= 80 ? 'bg-emerald-500' : bench.score >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                                  style={{ width: `${bench.score}%` }}
                                />
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-blue-400 hover:text-blue-300">
                                  {isExpanded ? 'Hide full results' : 'Click to show full results'}
                                </span>
                                <span className="text-xs text-slate-500">{bench.score}%</span>
                              </div>
                            </CardContent>
                          </div>
                          {isExpanded && (
                            <CardContent className="pt-0 border-t border-slate-200">
                              {key === 'turing' && <TuringDetailPanel details={bench.details} />}
                              {key === 'fisher' && <FisherDetailPanel details={bench.details} />}
                              {key === 'network' && <NetworkDetailPanel details={bench.details} />}
                              {key === 'ueda' && <UedaDetailPanel details={bench.details} />}
                            </CardContent>
                          )}
                        </Card>
                      );
                    })}
                  </div>

                  {auditorData.conclusion && (
                    <Alert className="bg-slate-50 border-slate-200">
                      <AlertDescription className="text-slate-600 text-sm">
                        <strong>Conclusion:</strong> {auditorData.conclusion}
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              )}
            </TabsContent>

            {/* FDR & RELIABILITY TAB */}
            <TabsContent value="fdr" className="space-y-6">
              <Card className="bg-white border-slate-200">
                <CardHeader>
                  <CardTitle className="text-slate-900 text-lg flex items-center gap-2">
                    <TrendingUp className="text-cyan-400" size={18} />
                    Statistical Controls & FDR Approach
                  </CardTitle>
                  <CardDescription className="text-slate-500">
                    Methods used by PAR(2) to control false positives — described from the implementation, not from a dedicated FDR calibration endpoint
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                      <h4 className="text-slate-900 font-medium mb-2">Benjamini-Hochberg Correction</h4>
                      <p className="text-slate-500 text-sm mb-2">Applied to all genome-wide AR(2) coefficient significance tests. Controls FDR at q &lt; 0.05.</p>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="text-emerald-400" size={16} />
                        <span className="text-emerald-400 text-sm">Implemented across all analysis endpoints</span>
                      </div>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                      <h4 className="text-slate-900 font-medium mb-2">Permutation Testing</h4>
                      <p className="text-slate-500 text-sm mb-2">5,000-permutation null distributions for enrichment tests (root-space, drug targets, gene sets).</p>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="text-emerald-400" size={16} />
                        <span className="text-emerald-400 text-sm">Non-parametric p-values avoid distributional assumptions</span>
                      </div>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                      <h4 className="text-slate-900 font-medium mb-2">Bootstrap Confidence Intervals</h4>
                      <p className="text-slate-500 text-sm mb-2">1,000 bootstrap resamples for eigenvalue estimates. Reports 95% CIs for per-gene |λ| values.</p>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="text-emerald-400" size={16} />
                        <span className="text-emerald-400 text-sm">Quantifies estimation uncertainty</span>
                      </div>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                      <h4 className="text-slate-900 font-medium mb-2">Edge-Case Diagnostics</h4>
                      <p className="text-slate-500 text-sm mb-2">Six automatic flags: trend detection, sample size, model order, nonlinearity, boundary proximity, ADF stationarity.</p>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="text-emerald-400" size={16} />
                        <span className="text-emerald-400 text-sm">Flags unreliable results before interpretation</span>
                      </div>
                    </div>
                  </div>

                  <Card className="bg-slate-50 border-slate-200">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-slate-900 text-sm">FDR Comparison vs Lab Standards</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <table className="w-full text-sm" data-testid="table-fdr-comparison">
                        <thead>
                          <tr className="border-b border-slate-200">
                            <th className="text-left text-slate-500 pb-2 pr-3">FDR Method</th>
                            <th className="text-left text-slate-500 pb-2 pr-3">PAR(2)</th>
                            <th className="text-left text-slate-500 pb-2 pr-3">JTK_CYCLE</th>
                            <th className="text-left text-slate-500 pb-2 pr-3">RAIN</th>
                            <th className="text-left text-slate-500 pb-2">DESeq2 (RNA-seq)</th>
                          </tr>
                        </thead>
                        <tbody className="text-slate-600">
                          <tr className="border-b border-slate-800/50">
                            <td className="py-2 pr-3 text-slate-800">Multiple testing</td>
                            <td className="py-2 pr-3 text-emerald-400">BH q &lt; 0.05</td>
                            <td className="py-2 pr-3">BH q &lt; 0.05</td>
                            <td className="py-2 pr-3">BH q &lt; 0.05</td>
                            <td className="py-2 pr-3">BH + IHW</td>
                          </tr>
                          <tr className="border-b border-slate-800/50">
                            <td className="py-2 pr-3 text-slate-800">Permutation test</td>
                            <td className="py-2 pr-3 text-emerald-400">5,000 perms</td>
                            <td className="py-2 pr-3">Approx. (Γ-dist)</td>
                            <td className="py-2 pr-3">Parametric</td>
                            <td className="py-2 pr-3">Wald/LRT</td>
                          </tr>
                          <tr className="border-b border-slate-800/50">
                            <td className="py-2 pr-3 text-slate-800">Bootstrap CI</td>
                            <td className="py-2 pr-3 text-emerald-400">1,000 resamples</td>
                            <td className="py-2 pr-3">Not standard</td>
                            <td className="py-2 pr-3">Not standard</td>
                            <td className="py-2 pr-3">Shrinkage-based</td>
                          </tr>
                          <tr className="border-b border-slate-800/50">
                            <td className="py-2 pr-3 text-slate-800">Diagnostic flags</td>
                            <td className="py-2 pr-3 text-emerald-400">6 edge-case checks</td>
                            <td className="py-2 pr-3">Period check</td>
                            <td className="py-2 pr-3">Asymmetry flag</td>
                            <td className="py-2 pr-3">Cook's distance</td>
                          </tr>
                          <tr className="border-b border-slate-800/50">
                            <td className="py-2 pr-3 text-slate-800">Null model</td>
                            <td className="py-2 pr-3 text-emerald-400">Circular shift + white noise</td>
                            <td className="py-2 pr-3">Rank permutation</td>
                            <td className="py-2 pr-3">Random resampling</td>
                            <td className="py-2 pr-3">Negative binomial</td>
                          </tr>
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>

                  <Alert className="bg-slate-50 border-slate-200">
                    <Info className="h-4 w-4 text-blue-400" />
                    <AlertDescription className="text-slate-600 text-sm">
                      PAR(2) uses standard statistical controls (BH correction, permutation tests, bootstrap CIs) consistent with practices in circadian analysis tools.
                      The addition of edge-case diagnostics provides reliability screening not found in most rhythm detection pipelines.
                      Note: the FDR comparison table above describes implemented methods — empirical FDR calibration curves are available via the Robustness Suite.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>

              <Card className="bg-white border-slate-200">
                <CardHeader>
                  <CardTitle className="text-slate-900 text-lg">Reliability Summary</CardTitle>
                  <CardDescription className="text-slate-500">
                    Strengths, limitations, and honest assessment
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-emerald-400 font-medium mb-2 flex items-center gap-1"><CheckCircle2 size={14} /> Strengths</h4>
                      <ul className="text-sm text-slate-600 space-y-1.5">
                        <li>Continuous persistence metric (not binary)</li>
                        <li>Clock &gt; target hierarchy reproduced across species</li>
                        <li>Cross-validated with ODE models (Model Zoo)</li>
                        <li>6 edge-case diagnostic flags per gene</li>
                        <li>Bootstrap + permutation FDR controls</li>
                        <li>Genome-wide scalable</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-amber-400 font-medium mb-2 flex items-center gap-1"><AlertTriangle size={14} /> Known Limitations</h4>
                      <ul className="text-sm text-slate-600 space-y-1.5">
                        <li>Requires ≥12 timepoints for reliable estimation</li>
                        <li>BIC often selects AR(1) for target genes (simpler dynamics)</li>
                        <li>Assumes approximate stationarity (trends degrade accuracy)</li>
                        <li>Not designed for rhythm detection (use JTK/RAIN for that)</li>
                        <li>Short series (n=6) have RMSE &gt; 0.3</li>
                        <li>Conceptual tool comparison — not empirical head-to-head benchmarks</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* COUPLING ROC TAB */}
            <TabsContent value="coupling-roc" className="space-y-6" data-testid="tab-content-coupling-roc">
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800 leading-relaxed">
                <strong>What this answers:</strong> Does PAR(2) coupling score (ΔAIC from coupled vs uncoupled AR(2)) actually separate
                experimentally validated clock–target pairs from phase-aligned non-causal pairs better than simpler methods?
                This is the core benchmark Paper E needs to defend resubmission. Dataset: GSE54650 Mouse Liver (24 timepoints).
                Gold standard: 15 positive pairs (ChIP/perturbation evidence), 15 negative pairs (phase-aligned, no known causal link).
              </div>

              {/* ── Simulation: Structural Non-Equivalence ── */}
              <PhaseConcentrationSimPanel />

              {/* ── Real-data: Validated pairs from GSE54650 ── */}
              <RealDataBenchmarkPanel />

              {couplingROCLoading ? (
                <div className="flex items-center gap-2 py-10 justify-center text-slate-500">
                  <Loader2 className="animate-spin" size={20} />
                  <span>Computing ROC analysis — fitting {'{'}15+15{'}'} pairs against liver dataset...</span>
                </div>
              ) : !couplingROC ? (
                <div className="text-red-400 text-sm py-4">Failed to load coupling ROC data.</div>
              ) : (
                <div className="space-y-6">

                  {/* AUC summary cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {(couplingROC.methods || []).map((m: any) => {
                      const isPar2 = m.key === 'par2';
                      return (
                        <div key={m.key} className={`rounded-xl border p-4 text-center ${isPar2 ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-200'}`} data-testid={`auc-card-${m.key}`}>
                          <div className={`text-2xl font-bold font-mono ${isPar2 ? 'text-amber-600' : 'text-slate-600'}`}>{m.auc.toFixed(3)}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">AUC</div>
                          <div className="text-[10px] text-slate-400 font-mono mt-1">[{m.aucCI.lower.toFixed(2)}–{m.aucCI.upper.toFixed(2)}]</div>
                          <div className={`text-xs font-semibold mt-2 ${isPar2 ? 'text-amber-700' : 'text-slate-600'}`}>{m.name.replace(' (ΔAICc)', '')}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">PR-AUC: {m.prAuc.toFixed(3)}</div>
                          {isPar2 && <div className="mt-1 text-[10px] font-bold text-amber-600">★ PAR(2)</div>}
                        </div>
                      );
                    })}
                  </div>

                  {/* ROC curves */}
                  <Card className="bg-white border border-slate-200">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold text-slate-800">ROC Curves — Separating known clock–target pairs from non-causal controls</CardTitle>
                      <CardDescription className="text-xs text-slate-500">Higher = better. Diagonal = random classifier (AUC 0.5). Values in parentheses = 95% bootstrap CI (n=2,000 resamples).</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={320}>
                        <LineChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis type="number" dataKey="fpr" domain={[0, 1]} label={{ value: 'False Positive Rate', position: 'bottom', fontSize: 11 }} tickFormatter={(v: number) => v.toFixed(1)} />
                          <YAxis type="number" dataKey="tpr" domain={[0, 1]} label={{ value: 'True Positive Rate', angle: -90, position: 'insideLeft', fontSize: 11 }} />
                          <Tooltip
                            formatter={(v: number) => v.toFixed(3)}
                            labelFormatter={(l: number) => `FPR: ${Number(l).toFixed(3)}`}
                          />
                          <Legend verticalAlign="top" />
                          {/* Diagonal reference */}
                          <Line data={[{fpr:0,tpr:0},{fpr:1,tpr:1}]} type="linear" dataKey="tpr" name="Random (AUC=0.50)" stroke="#cbd5e1" strokeDasharray="4 4" dot={false} strokeWidth={1} />
                          {(couplingROC.methods || []).map((m: any, idx: number) => {
                            const colors = ['#d97706','#6366f1','#10b981','#f43f5e'];
                            const widths = [2.5, 1.5, 1.5, 1.5];
                            return (
                              <Line
                                key={m.key}
                                data={m.rocCurve}
                                type="monotone"
                                dataKey="tpr"
                                name={`${m.name} (AUC=${m.auc.toFixed(3)})`}
                                stroke={colors[idx]}
                                strokeWidth={widths[idx]}
                                dot={false}
                              />
                            );
                          })}
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* PR curves */}
                  <Card className="bg-white border border-slate-200">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold text-slate-800">Precision–Recall Curves</CardTitle>
                      <CardDescription className="text-xs text-slate-500">Baseline (random) PR-AUC = {(couplingROC.nPositiveUsed / (couplingROC.nPositiveUsed + couplingROC.nNegativeUsed)).toFixed(3)} (prevalence). Values above baseline indicate genuine discrimination.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={280}>
                        <LineChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis type="number" dataKey="recall" domain={[0, 1]} label={{ value: 'Recall', position: 'bottom', fontSize: 11 }} tickFormatter={(v: number) => v.toFixed(1)} />
                          <YAxis type="number" dataKey="precision" domain={[0, 1]} label={{ value: 'Precision', angle: -90, position: 'insideLeft', fontSize: 11 }} />
                          <Tooltip formatter={(v: number) => v.toFixed(3)} />
                          <Legend verticalAlign="top" />
                          {(couplingROC.methods || []).map((m: any, idx: number) => {
                            const colors = ['#d97706','#6366f1','#10b981','#f43f5e'];
                            const widths = [2.5, 1.5, 1.5, 1.5];
                            return (
                              <Line
                                key={m.key}
                                data={m.prCurve}
                                type="monotone"
                                dataKey="precision"
                                name={`${m.name} (PR-AUC=${m.prAuc.toFixed(3)})`}
                                stroke={colors[idx]}
                                strokeWidth={widths[idx]}
                                dot={false}
                              />
                            );
                          })}
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* Gold-standard pair table */}
                  <Card className="bg-white border border-slate-200">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold text-slate-800">Gold-Standard Pair Scores</CardTitle>
                      <CardDescription className="text-xs text-slate-500">
                        Dataset: {couplingROC.dataset} · {couplingROC.nPositiveUsed}/{couplingROC.nPositive} positive pairs found · {couplingROC.nNegativeUsed}/{couplingROC.nNegative} negative pairs found
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-slate-100 bg-slate-50">
                              <th className="text-left px-3 py-2 text-slate-600 font-semibold">Predictor</th>
                              <th className="text-left px-3 py-2 text-slate-600 font-semibold">Target</th>
                              <th className="text-left px-3 py-2 text-slate-600 font-semibold">Label</th>
                              <th className="text-right px-3 py-2 text-amber-600 font-semibold">PAR(2) ΔAIC</th>
                              <th className="text-right px-3 py-2 text-indigo-600 font-semibold">Phase Diff (rad)</th>
                              <th className="text-right px-3 py-2 text-emerald-600 font-semibold">XCorr Peak</th>
                              <th className="text-right px-3 py-2 text-rose-600 font-semibold">|Pearson r|</th>
                              <th className="text-left px-3 py-2 text-slate-500 font-semibold">Evidence / Reason</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(couplingROC.pairScores || []).filter((p: any) => p.predictorFound && p.targetFound).map((p: any, i: number) => (
                              <tr key={i} className={`border-b border-slate-50 ${p.label === 1 ? 'bg-amber-50/40' : 'bg-slate-50/40'}`} data-testid={`pair-row-${p.predictor}-${p.target}`}>
                                <td className="px-3 py-1.5 font-mono font-semibold text-slate-800">{p.predictor}</td>
                                <td className="px-3 py-1.5 font-mono text-slate-700">{p.target}</td>
                                <td className="px-3 py-1.5">
                                  {p.label === 1
                                    ? <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-bold">POS</span>
                                    : <span className="px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded text-[10px]">NEG</span>
                                  }
                                </td>
                                <td className={`px-3 py-1.5 font-mono text-right ${p.par2DeltaAIC < -2 ? 'text-amber-600 font-semibold' : 'text-slate-500'}`}>
                                  {p.par2DeltaAIC.toFixed(2)}
                                </td>
                                <td className="px-3 py-1.5 font-mono text-right text-slate-600">{p.phaseDiffRad.toFixed(3)}</td>
                                <td className="px-3 py-1.5 font-mono text-right text-slate-600">{p.xcorrPeak.toFixed(3)}</td>
                                <td className="px-3 py-1.5 font-mono text-right text-slate-600">{p.pearsonAbs.toFixed(3)}</td>
                                <td className="px-3 py-1.5 text-slate-500 max-w-xs truncate" title={p.note}>{p.note}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Interpretation */}
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 leading-relaxed space-y-2">
                    <p><strong className="text-slate-800">How to read these results:</strong> A ΔAIC below −2 means that including the predictor gene as an exogenous lag-1 input improves model fit by more than 2 AIC units — a standard threshold for meaningful improvement. Positive pairs should cluster at low (negative) ΔAIC values; negative pairs should not. The ROC and PR curves quantify how well each method separates the two classes. AUC = 0.5 is chance; AUC = 1.0 is perfect classification.</p>
                    <p><strong className="text-slate-800">Why this matters for Paper E:</strong> PLOS ONE desk-rejected the paper without asking whether the coupling metric adds value over simpler phase-alignment. This table and these curves are the direct answer. If PAR(2) ΔAIC AUC substantially exceeds phase-correlation and cross-correlation AUC on this gold-standard pair set, the claim that PAR(2) detects biologically real coupling is defensible at any methods-oriented journal.</p>
                    <p><strong className="text-slate-800">Negative pair construction:</strong> Negatives are liver-abundant, diurnally expressed metabolic genes paired with the same targets as positives. They are hard negatives — phase-aligned by design — so the test is conservative. A method that merely detects rhythmicity would score them similarly to positives. PAR(2) coupling additionally tests whether the lagged dynamics of the predictor actually improve prediction of the target's future state.</p>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}

        <div className="mt-8 rounded-xl border border-slate-200 bg-slate-100 p-5 space-y-3" data-testid="framework-benchmarks-see-also">
          <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wider">Related analyses</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <a href="/ar2-diagnostics" className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 hover:border-sky-500/50 hover:bg-sky-500/5 transition-colors group">
              <span className="text-sky-400 mt-0.5">→</span>
              <div>
                <div className="text-sm font-medium text-slate-800 group-hover:text-sky-300 transition-colors">AR(2) Fit Diagnostics</div>
                <div className="text-xs text-slate-500 mt-0.5">Monte Carlo bias & RMSE across 150 scenarios · Tables S6 & S7</div>
              </div>
            </a>
            <a href="/supplementary-analyses" className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 hover:border-blue-500/50 hover:bg-blue-500/5 transition-colors group">
              <span className="text-blue-400 mt-0.5">→</span>
              <div>
                <div className="text-sm font-medium text-slate-800 group-hover:text-blue-300 transition-colors">AR(1) Benchmark & Controls</div>
                <div className="text-xs text-slate-500 mt-0.5">12 statistical stress tests on the AR(2) eigenvalue hierarchy</div>
              </div>
            </a>
            <a href="/model-zoo" className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 hover:border-orange-500/50 hover:bg-orange-500/5 transition-colors group">
              <span className="text-orange-400 mt-0.5">→</span>
              <div>
                <div className="text-sm font-medium text-slate-800 group-hover:text-orange-300 transition-colors">Model Zoo</div>
                <div className="text-xs text-slate-500 mt-0.5">Ground-truth ODE validation — AR(2) tested against 5 canonical models</div>
              </div>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function ComparisonRow({ metric, par2Value, expected, pass, note }: {
  metric: string;
  par2Value: string;
  expected: string;
  pass: boolean;
  note: string;
}) {
  return (
    <div className={`p-3 rounded-lg border ${pass ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-amber-500/5 border-amber-500/20'}`} data-testid={`comparison-${metric.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-slate-900 font-medium text-sm">{metric}</span>
        {pass
          ? <CheckCircle2 className="text-emerald-400" size={16} />
          : <AlertTriangle className="text-amber-400" size={16} />
        }
      </div>
      <div className="text-sm">
        <div className="text-slate-600">Result: <span className={pass ? 'text-emerald-400' : 'text-amber-400'}>{par2Value}</span></div>
        <div className="text-slate-500 text-xs">Expected: {expected}</div>
      </div>
      <div className="text-[10px] text-slate-500 mt-1 italic">{note}</div>
    </div>
  );
}
