import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ABMStatistics {
  welch: { t: number; p: number };
  cohensD: number;
  bootstrapRatioCI: { lower: number; upper: number; mean: number };
  meanDifferenceCI: { lower: number; upper: number; mean: number };
}

interface ABMResult {
  wtData: {
    generationMutations: number[];
    meanMutationsPerGen: number[];
    totalMutations: number;
  };
  koData: {
    generationMutations: number[];
    meanMutationsPerGen: number[];
    totalMutations: number;
  };
  summary: {
    wtReduction: number;
    protectionFactor: number;
  };
  statistics: ABMStatistics;
  interpretation: string;
}

export default function ABMDemo() {
  const [data, setData] = useState<ABMResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/abm-minimal/run");
        if (!res.ok) throw new Error("ABM simulation failed");
        const result = await res.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse">
            <div className="h-12 bg-slate-200 rounded w-48 mb-4" />
            <div className="h-6 bg-slate-200 rounded w-96 mb-8" />
            <div className="space-y-4">
              <div className="h-40 bg-slate-200 rounded" />
              <div className="h-96 bg-slate-200 rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 p-6">
        <div className="max-w-6xl mx-auto">
          <Card className="border-red-500/50 bg-red-500/5">
            <CardHeader>
              <CardTitle>Error</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-red-400">{error || "Failed to run ABM simulation"}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const generations = Array.from({ length: data.wtData.generationMutations.length }, (_, i) => i + 1);
  const chartData = generations.map(gen => ({
    gen,
    "WT (gated)": data.wtData.generationMutations[gen - 1],
    "KO (flat)": data.koData.generationMutations[gen - 1],
  }));

  const cumulativeData = generations.map(gen => ({
    gen,
    "WT (gated)": data.wtData.meanMutationsPerGen[gen - 1] || 0,
    "KO (flat)": data.koData.meanMutationsPerGen[gen - 1] || 0,
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2" data-testid="abm-title">
            Minimal ABM: Crypt Temporal Dynamics
          </h1>
          <p className="text-slate-500">
            Agent-based simulation with statistical validation (50 replicates × 10 generations)
          </p>
        </div>

        {/* Key Findings */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-emerald-950 to-slate-900 border-emerald-500/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-emerald-400">WT (Gated)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-2xl font-bold text-emerald-300">{data.wtData.totalMutations.toFixed(1)}</div>
              <p className="text-xs text-emerald-400/60">mean mutations</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-950 to-slate-900 border-red-500/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-red-400">KO (Flat)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-2xl font-bold text-red-300">{data.koData.totalMutations.toFixed(1)}</div>
              <p className="text-xs text-red-400/60">mean mutations</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-cyan-950 to-slate-900 border-cyan-500/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-cyan-400">Protection Factor</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-2xl font-bold text-cyan-300">
                {data.summary.protectionFactor.toFixed(2)}×
              </div>
              <p className="text-xs text-cyan-400/60">[{data.statistics.bootstrapRatioCI.lower.toFixed(2)}–{data.statistics.bootstrapRatioCI.upper.toFixed(2)}]</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-950 to-slate-900 border-purple-500/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-purple-400">Effect Size</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-2xl font-bold text-purple-300">
                {data.statistics.cohensD.toFixed(2)}
              </div>
              <p className="text-xs text-purple-400/60">Cohen's d</p>
            </CardContent>
          </Card>
        </div>

        {/* Statistical Test Results */}
        <Card className="bg-white border-amber-500/30">
          <CardHeader>
            <CardTitle className="text-lg text-amber-400">Statistical Significance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-slate-600">Welch's t-test</h4>
                <p className="text-xs text-slate-500">
                  t = {data.statistics.welch.t.toFixed(2)}, p {data.statistics.welch.p < 0.001 ? '< 0.001***' : `= ${data.statistics.welch.p.toFixed(3)}`}
                </p>
                <p className="text-xs text-slate-500">
                  {data.statistics.welch.p < 0.05 ? '✓ Statistically significant' : '✗ Not significant'}
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-slate-600">Effect Size (Cohen's d)</h4>
                <p className="text-xs text-slate-500">
                  {data.statistics.cohensD.toFixed(2)} ({data.statistics.cohensD < 0.2 ? 'trivial' : data.statistics.cohensD < 0.5 ? 'small' : data.statistics.cohensD < 0.8 ? 'medium' : 'large'})
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-slate-600">Mean Difference (KO − WT)</h4>
                <p className="text-xs text-slate-500">
                  {data.statistics.meanDifferenceCI.mean.toFixed(1)} mutations [95% CI: {data.statistics.meanDifferenceCI.lower.toFixed(1)}–{data.statistics.meanDifferenceCI.upper.toFixed(1)}]
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-slate-600">Bootstrap CI (KO/WT Ratio)</h4>
                <p className="text-xs text-slate-500">
                  95% CI: [{data.statistics.bootstrapRatioCI.lower.toFixed(2)}–{data.statistics.bootstrapRatioCI.upper.toFixed(2)}]
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Mutations per Generation */}
        <Card className="bg-white border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg text-slate-900">Mutations per Generation</CardTitle>
            <CardDescription>Single run showing stochastic accumulation</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="gen" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #475569" }} labelStyle={{ color: "#f1f5f9" }} />
                <Legend />
                <Bar dataKey="WT (gated)" fill="#10b981" />
                <Bar dataKey="KO (flat)" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Cumulative Mean */}
        <Card className="bg-white border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg text-slate-900">Cumulative Mean Mutations</CardTitle>
            <CardDescription>Running average trend</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={cumulativeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="gen" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #475569" }} labelStyle={{ color: "#f1f5f9" }} />
                <Legend />
                <Line type="monotone" dataKey="WT (gated)" stroke="#10b981" strokeWidth={2} dot={{ fill: "#10b981", r: 4 }} />
                <Line type="monotone" dataKey="KO (flat)" stroke="#ef4444" strokeWidth={2} dot={{ fill: "#ef4444", r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Interpretation */}
        <Card className="bg-white border-amber-500/30">
          <CardHeader>
            <CardTitle className="text-lg text-amber-400">Interpretation</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600 whitespace-pre-wrap font-mono text-sm leading-relaxed">
              {data.interpretation}
            </p>
          </CardContent>
        </Card>

        {/* Model Details */}
        <Card className="bg-white border-slate-200">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-slate-500">Simulation Parameters</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-500 space-y-1">
            <p>• Replicates: 50 independent simulation runs</p>
            <p>• Cell cycle: 24±12 hours (Poisson-distributed stochastic divisions)</p>
            <p>• BMAL1 repair window: Peak at ZT18 (phase 0.75), gaussian decay</p>
            <p>• WT mutation risk: 1% baseline × (1 - 80% × repair factor)</p>
            <p>• KO mutation risk: 1% baseline (constant, no temporal gating)</p>
            <p>• Crypt size: 16 ISCs, capacity ~100 cells</p>
            <p>• Duration: 10 generations × 60 hours/gen = 600 hours</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
