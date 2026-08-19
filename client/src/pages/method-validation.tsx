import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import {
  BarChart, Bar, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell, LineChart, Line
} from "recharts";

function MonteCarloSection() {
  const [quick, setQuick] = useState(true);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["/api/benchmarks/monte-carlo-simulation", quick],
    queryFn: () => fetch(`/api/benchmarks/monte-carlo-simulation?quick=${quick}`).then(r => r.json()),
  });

  if (isLoading) return <div className="text-center py-8" data-testid="status-mc-loading">Running Monte Carlo simulation ({quick ? 'quick' : 'full'} mode)...</div>;
  if (error) return <div className="text-red-500" data-testid="status-mc-error">Error: {(error as Error).message}</div>;
  if (!data) return null;

  const { summary, recoveryResults, misspecificationResults, powerAnalysis } = data;

  const biasHeatmapData = recoveryResults
    .filter((r: any) => r.trueModulus > 0.3 && r.trueModulus < 0.9)
    .map((r: any) => ({
      label: `N=${r.sampleSize}, σ=${r.noiseLevel}`,
      sampleSize: r.sampleSize,
      noise: r.noiseLevel,
      bias: r.bias,
      rmse: r.rmse,
      coverage: r.coverageRate,
      recovery10: r.recoveryWithin10pct,
      scenario: r.scenario,
    }));

  const bySampleSize = recoveryResults.reduce((acc: any, r: any) => {
    const key = r.sampleSize;
    if (!acc[key]) acc[key] = { sampleSize: key, biases: [], rmses: [], coverages: [] };
    acc[key].biases.push(Math.abs(r.bias));
    acc[key].rmses.push(r.rmse);
    acc[key].coverages.push(r.coverageRate);
    return acc;
  }, {});

  const sampleSizeSummary = Object.values(bySampleSize).map((v: any) => ({
    sampleSize: v.sampleSize,
    meanBias: (v.biases.reduce((a: number, b: number) => a + b, 0) / v.biases.length),
    meanRMSE: (v.rmses.reduce((a: number, b: number) => a + b, 0) / v.rmses.length),
    meanCoverage: (v.coverages.reduce((a: number, b: number) => a + b, 0) / v.coverages.length),
  }));

  const downloadCSV = () => {
    let csv = "Scenario,TrueModulus,RootType,SampleSize,NoiseLevel,Replicates,MeanEstimated,MedianEstimated,Bias,RMSE,MAE,SD,CI95Lower,CI95Upper,CoverageRate,RecoveryWithin5pct,RecoveryWithin10pct\n";
    for (const r of recoveryResults) {
      csv += `"${r.scenario}",${r.trueModulus},${r.rootType},${r.sampleSize},${r.noiseLevel},${r.nReplicates},${r.meanEstimated},${r.medianEstimated},${r.bias},${r.rmse},${r.mae},${r.sd},${r.ci95Lower},${r.ci95Upper},${r.coverageRate},${r.recoveryWithin5pct},${r.recoveryWithin10pct}\n`;
    }
    csv += "\n\nMisspecification Results\n";
    csv += "Scenario,Description,TrueProcess,Replicates,SampleSize,NoiseLevel,MeanEstimatedModulus,BiasVsReference,HierarchyPreserved\n";
    for (const r of misspecificationResults) {
      csv += `"${r.scenario}","${r.description}","${r.trueProcess}",${r.nReplicates},${r.sampleSize},${r.noiseLevel},${r.meanEstimatedModulus},${r.biasVsReference},${r.hierarchyPreserved}\n`;
    }
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Supplementary_Table_S6_Monte_Carlo.csv";
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" data-testid="text-mc-title">Monte Carlo Simulation Study</h2>
          <p className="text-gray-600">
            {summary.totalScenarios} scenarios × {summary.totalReplicates.toLocaleString()} total replicates
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={quick ? "default" : "outline"}
            onClick={() => { setQuick(true); refetch(); }}
            data-testid="button-mc-quick"
          >
            Quick (200/rep)
          </Button>
          <Button
            variant={!quick ? "default" : "outline"}
            onClick={() => { setQuick(false); refetch(); }}
            data-testid="button-mc-full"
          >
            Full (1000/rep)
          </Button>
          <Button onClick={downloadCSV} variant="outline" data-testid="button-download-s6">
            ⬇ Download S6
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Overall Bias</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-mc-overall-bias">
              {summary.overallMedianBias != null ? summary.overallMedianBias.toFixed(3) : 'N/A'}
            </div>
            <div className="text-xs text-gray-500">median |bias| across all scenarios</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Best Recovery</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-mc-best-recovery">
              {recoveryResults.length > 0
                ? (Math.max(...recoveryResults.map((r: any) => r.recoveryWithin10pct)) * 100).toFixed(0) + '%'
                : 'N/A'}
            </div>
            <div className="text-xs text-gray-500">max recovery within 10% of true |λ|</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Min Sample Size</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-mc-min-n">
              {summary.minSampleForReliable != null ? `N=${summary.minSampleForReliable}` : 'N/A'}
            </div>
            <div className="text-xs text-gray-500">for reliable estimation (RMSE &lt; 0.05)</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Robustness</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-sm" data-testid="text-mc-robustness">
              {summary.maxNoiseForReliable != null ? `σ≤${summary.maxNoiseForReliable}` : 'N/A'}
            </div>
            <div className="text-xs text-gray-500">max noise level with reliable recovery</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Recovery Accuracy by Sample Size</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={sampleSizeSummary}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="sampleSize" label={{ value: "Sample Size (N)", position: "insideBottom", offset: -5 }} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="meanBias" name="Mean |Bias|" fill="#ef4444" />
              <Bar dataKey="meanRMSE" name="Mean RMSE" fill="#3b82f6" />
              <Bar dataKey="meanCoverage" name="Mean Coverage" fill="#22c55e" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Bias vs Noise Level (by Scenario)</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" dataKey="noise" name="Noise σ" domain={[0, 1.1]} tickCount={6} label={{ value: "Noise Level (σ)", position: "insideBottom", offset: -5 }} />
              <YAxis type="number" dataKey="bias" name="Bias" label={{ value: "Bias", angle: -90, position: "insideLeft" }} />
              <Tooltip />
              <Scatter data={biasHeatmapData} fill="#8884d8">
                {biasHeatmapData.map((entry: any, i: number) => (
                  <Cell key={i} fill={entry.bias > 0.1 ? '#ef4444' : entry.bias > 0.05 ? '#f59e0b' : '#22c55e'} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {misspecificationResults.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Model Misspecification Robustness</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm" data-testid="table-misspecification">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Scenario</th>
                    <th className="text-left p-2">True Process</th>
                    <th className="text-right p-2">Mean |λ|</th>
                    <th className="text-right p-2">Bias</th>
                    <th className="text-center p-2">Hierarchy OK?</th>
                  </tr>
                </thead>
                <tbody>
                  {misspecificationResults.map((r: any, i: number) => (
                    <tr key={i} className="border-b">
                      <td className="p-2">{r.scenario}</td>
                      <td className="p-2 text-gray-600">{r.trueProcess}</td>
                      <td className="p-2 text-right">{r.meanEstimatedModulus.toFixed(4)}</td>
                      <td className="p-2 text-right">{r.biasVsReference.toFixed(4)}</td>
                      <td className="p-2 text-center">{r.hierarchyPreserved ? '✓' : '✗'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function HeadToHeadSection() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/benchmarks/head-to-head"],
    queryFn: () => fetch("/api/benchmarks/head-to-head").then(r => r.json()),
  });

  if (isLoading) return <div className="text-center py-8" data-testid="status-h2h-loading">Running head-to-head comparison on 20,955 genes...</div>;
  if (error) return <div className="text-red-500" data-testid="status-h2h-error">Error: {(error as Error).message}</div>;
  if (!data) return null;

  const { summary, geneResults } = data;

  const vennData = [
    { name: 'All three', count: summary.venn.all3, fill: '#22c55e' },
    { name: 'AR(2) only', count: summary.venn.ar2Only, fill: '#3b82f6' },
    { name: 'AR(2)+JTK', count: summary.venn.ar2_jtk, fill: '#8b5cf6' },
    { name: 'AR(2)+Cosinor', count: summary.venn.ar2_cosinor, fill: '#06b6d4' },
    { name: 'Cosinor+JTK', count: summary.venn.cosinor_jtk, fill: '#f59e0b' },
    { name: 'JTK only', count: summary.venn.jtkOnly, fill: '#ef4444' },
    { name: 'Cosinor only', count: summary.venn.cosinorOnly, fill: '#ec4899' },
    { name: 'None', count: summary.venn.none, fill: '#9ca3af' },
  ];

  const clockGenes = geneResults
    .filter((r: any) => r.category === 'Clock')
    .sort((a: any, b: any) => b.ar2_eigenvalue - a.ar2_eigenvalue);
  const targetGenes = geneResults
    .filter((r: any) => r.category === 'Target')
    .sort((a: any, b: any) => b.ar2_eigenvalue - a.ar2_eigenvalue);

  const scatterData = geneResults
    .filter((_: any, i: number) => i % 20 === 0 || geneResults[i].category !== 'Other')
    .map((r: any) => ({
      eigenvalue: r.ar2_eigenvalue,
      cosinorR2: r.cosinor_r2,
      amplitude: r.cosinor_amplitude,
      jtkTau: Math.abs(r.jtk_tau),
      gene: r.gene,
      category: r.category,
    }));

  const downloadCSV = () => {
    let csv = "Gene,Category,AR2_Eigenvalue,AR2_R2,AR2_RootType,Cosinor_Amplitude,Cosinor_Phase,Cosinor_qValue,Cosinor_R2,Cosinor_Rhythmic,JTK_Tau,JTK_qValue,JTK_Period,JTK_Rhythmic,Agreement\n";
    for (const r of geneResults) {
      csv += `${r.gene},${r.category},${r.ar2_eigenvalue},${r.ar2_r2},${r.ar2_rootType},${r.cosinor_amplitude},${r.cosinor_phase},${r.cosinor_pValue},${r.cosinor_r2},${r.cosinor_rhythmic},${r.jtk_tau},${r.jtk_pValue},${r.jtk_period || 24},${r.jtk_rhythmic},"${r.agreement}"\n`;
    }
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Supplementary_Table_S7_Method_Comparison.csv";
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" data-testid="text-h2h-title">Head-to-Head Method Comparison</h2>
          <p className="text-gray-600">
            AR(2) |λ| vs Cosinor vs JTK_CYCLE on {summary.totalGenes.toLocaleString()} genes (GSE54650 Liver)
          </p>
        </div>
        <Button onClick={downloadCSV} variant="outline" data-testid="button-download-s7">
          ⬇ Download S7
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Cosinor Rhythmic</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-cosinor-count">{summary.cosinor_rhythmic.toLocaleString()}</div>
            <div className="text-gray-500">{summary.cosinor_rhythmicPct}% of genes</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">JTK Rhythmic</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-jtk-count">{summary.jtk_rhythmic.toLocaleString()}</div>
            <div className="text-gray-500">{summary.jtk_rhythmicPct}% of genes</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">AR(2) Stable Band</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-ar2-count">{summary.ar2_inStableBand.toLocaleString()}</div>
            <div className="text-gray-500">{summary.ar2_inStableBandPct}% of genes (|λ| ∈ [0.4, 0.8])</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Detection Overlap (Venn Diagram Counts)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={vennData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={120} />
                <Tooltip />
                <Bar dataKey="count">
                  {vennData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Cross-Method Correlations (Spearman ρ)</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4 pt-4">
              {Object.entries(summary.correlations).map(([key, val]: [string, any]) => (
                <div key={key}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{key.replace(/_/g, ' ')}</span>
                    <span className="font-mono font-bold">ρ = {val.toFixed(3)}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="h-3 rounded-full"
                      style={{
                        width: `${Math.abs(val) * 100}%`,
                        backgroundColor: Math.abs(val) > 0.5 ? '#22c55e' : Math.abs(val) > 0.3 ? '#f59e0b' : '#3b82f6'
                      }}
                    />
                  </div>
                </div>
              ))}
              <p className="text-xs text-gray-500 mt-2">
                Low ρ between |λ| and cosinor/JTK confirms AR(2) captures independent information (temporal persistence vs rhythmicity).
                High ρ between amplitude and τ is expected — both measure oscillation strength.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>|λ| vs Cosinor R² (subsampled for performance)</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="eigenvalue" name="|λ|" label={{ value: "AR(2) |λ|", position: "insideBottom", offset: -5 }} domain={[0, 1.2]} />
              <YAxis dataKey="cosinorR2" name="Cosinor R²" label={{ value: "Cosinor R²", angle: -90, position: "insideLeft" }} domain={[0, 1]} />
              <Tooltip content={({ payload }) => {
                if (!payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="bg-white border p-2 text-xs shadow-lg">
                    <div className="font-bold">{d.gene} ({d.category})</div>
                    <div>|λ| = {d.eigenvalue?.toFixed(3)}</div>
                    <div>Cosinor R² = {d.cosinorR2?.toFixed(3)}</div>
                  </div>
                );
              }} />
              <Scatter data={scatterData.filter((d: any) => d.category === 'Other')} fill="#9ca3af" fillOpacity={0.3} />
              <Scatter data={scatterData.filter((d: any) => d.category === 'Target')} fill="#f59e0b" />
              <Scatter data={scatterData.filter((d: any) => d.category === 'Clock')} fill="#ef4444" />
            </ScatterChart>
          </ResponsiveContainer>
          <div className="flex gap-4 text-sm mt-2 justify-center">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Clock</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-500 inline-block" /> Target</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-gray-400 inline-block" /> Other</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Clock Gene Agreement</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm" data-testid="table-clock-genes">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-2">Gene</th>
                  <th className="text-right p-2">|λ|</th>
                  <th className="text-right p-2">Root</th>
                  <th className="text-right p-2">Cosinor Amp</th>
                  <th className="text-right p-2">Cosinor p</th>
                  <th className="text-right p-2">JTK |τ|</th>
                  <th className="text-right p-2">JTK q</th>
                  <th className="text-right p-2">JTK T</th>
                  <th className="text-left p-2">Agreement</th>
                </tr>
              </thead>
              <tbody>
                {clockGenes.map((r: any) => (
                  <tr key={r.gene} className="border-b">
                    <td className="p-2 font-mono font-bold">{r.gene}</td>
                    <td className="p-2 text-right font-mono">{r.ar2_eigenvalue.toFixed(3)}</td>
                    <td className="p-2 text-right">{r.ar2_rootType}</td>
                    <td className="p-2 text-right font-mono">{r.cosinor_amplitude.toFixed(2)}</td>
                    <td className="p-2 text-right font-mono">{r.cosinor_pValue < 0.001 ? '<0.001' : r.cosinor_pValue.toFixed(3)}</td>
                    <td className="p-2 text-right font-mono">{Math.abs(r.jtk_tau).toFixed(3)}</td>
                    <td className="p-2 text-right font-mono">{r.jtk_pValue < 0.001 ? '<0.001' : r.jtk_pValue.toFixed(3)}</td>
                    <td className="p-2 text-right font-mono">{r.jtk_period || 24}h</td>
                    <td className="p-2">{r.agreement}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-gray-600 mt-3">
            {summary.clockGeneAgreement.all3_detected}/{summary.clockGeneAgreement.total} clock genes detected by all three methods.
          </p>
        </CardContent>
      </Card>

      {summary.divergentExamples?.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Divergent Examples</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {summary.divergentExamples.map((d: any, i: number) => (
                <div key={i} className="p-3 bg-gray-50 rounded-lg">
                  <div className="font-bold">{d.gene} — |λ| = {d.ar2_eigenvalue.toFixed(3)}</div>
                  <div className="text-sm text-gray-600">
                    Cosinor: {d.cosinor_rhythmic ? 'Rhythmic' : 'Not rhythmic'} | JTK: {d.jtk_rhythmic ? 'Rhythmic' : 'Not rhythmic'}
                  </div>
                  <div className="text-sm mt-1">{d.interpretation}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Category-Level Summary</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-sm text-gray-500">Clock Genes</div>
              <div className="text-xl font-bold text-red-600">{summary.ar2_clockMedian.toFixed(3)}</div>
              <div className="text-xs text-slate-500">median |λ|</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Target Genes</div>
              <div className="text-xl font-bold text-yellow-600">{summary.ar2_targetMedian.toFixed(3)}</div>
              <div className="text-xs text-slate-500">median |λ|</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Other Genes</div>
              <div className="text-xl font-bold text-gray-600">{summary.ar2_otherMedian.toFixed(3)}</div>
              <div className="text-xs text-slate-500">median |λ|</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-bold text-blue-800 mb-2">Key Finding</h3>
        <p className="text-sm text-blue-700">{summary.conclusion}</p>
      </div>
    </div>
  );
}

export default function MethodValidation() {
  const [tab, setTab] = useState<'h2h' | 'mc'>('h2h');

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Method Validation Suite</h1>
        <p className="text-gray-600 mt-2">
          Comprehensive validation of AR(2) |λ| through Monte Carlo simulation and head-to-head comparison with established circadian methods.
          These results form the basis of Supplementary Tables S6 and S7 for Paper A.
        </p>
      </div>

      <div className="flex gap-2 mb-6">
        <Button
          variant={tab === 'h2h' ? 'default' : 'outline'}
          onClick={() => setTab('h2h')}
          data-testid="button-tab-h2h"
        >
          Head-to-Head Comparison
        </Button>
        <Button
          variant={tab === 'mc' ? 'default' : 'outline'}
          onClick={() => setTab('mc')}
          data-testid="button-tab-mc"
        >
          Monte Carlo Simulation
        </Button>
      </div>

      {tab === 'h2h' ? <HeadToHeadSection /> : <MonteCarloSection />}
    </div>
  );
}
