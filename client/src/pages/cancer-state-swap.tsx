import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, FlaskConical, Dna, TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ScatterChart, Scatter, ReferenceLine, Cell,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from "recharts";

interface GeneResult {
  gene: string;
  fullName: string;
  subcategory: string;
  group: 'identity' | 'proliferation';
  mycOn: { eigenvalue: number; phi1: number; phi2: number; r2: number; complexRoots: boolean; eigenperiod: number | null } | null;
  mycOff: { eigenvalue: number; phi1: number; phi2: number; r2: number; complexRoots: boolean; eigenperiod: number | null } | null;
  delta: number | null;
}

interface ApiResponse {
  dataset: {
    geoAccession: string;
    title: string;
    description: string;
    organism: string;
    timepoints: number;
    samplingInterval: string;
    totalGenesMycOn: number;
    totalGenesMycOff: number;
  };
  geneResults: GeneResult[];
  groupStats: {
    mycOn: { identity: any; proliferation: any; background: any };
    mycOff: { identity: any; proliferation: any; background: any };
  };
  comparisons: {
    mycOn: { identityVsProlif: any; identityVsBackground: any; prolifVsBackground: any };
    mycOff: { identityVsProlif: any; identityVsBackground: any; prolifVsBackground: any };
  };
  stateSwapEffects: {
    identityShift: any;
    prolifShift: any;
    backgroundShift: any;
    differentialResponse: any;
  };
  interpretation: string[];
}

function formatP(p: number): string {
  if (p < 0.001) return "< 0.001";
  if (p < 0.01) return p.toFixed(3);
  return p.toFixed(2);
}

function DeltaIcon({ val }: { val: number | null }) {
  if (val === null) return <Minus className="w-4 h-4 text-slate-500" />;
  if (val > 0.02) return <TrendingUp className="w-4 h-4 text-green-500" />;
  if (val < -0.02) return <TrendingDown className="w-4 h-4 text-red-500" />;
  return <Minus className="w-4 h-4 text-slate-500" />;
}

function exportCSV(data: ApiResponse) {
  const lines = ["Gene,FullName,Group,Subcategory,MYC_ON_Eigenvalue,MYC_OFF_Eigenvalue,Delta,MYC_ON_R2,MYC_OFF_R2,MYC_ON_ComplexRoots,MYC_OFF_ComplexRoots,MYC_ON_Eigenperiod,MYC_OFF_Eigenperiod"];
  for (const g of data.geneResults) {
    lines.push([
      g.gene, `"${g.fullName}"`, g.group, `"${g.subcategory}"`,
      g.mycOn?.eigenvalue.toFixed(4) ?? "NA",
      g.mycOff?.eigenvalue.toFixed(4) ?? "NA",
      g.delta?.toFixed(4) ?? "NA",
      g.mycOn?.r2.toFixed(4) ?? "NA",
      g.mycOff?.r2.toFixed(4) ?? "NA",
      g.mycOn?.complexRoots ?? "NA",
      g.mycOff?.complexRoots ?? "NA",
      g.mycOn?.eigenperiod?.toFixed(1) ?? "NA",
      g.mycOff?.eigenperiod?.toFixed(1) ?? "NA",
    ].join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "cancer_state_swap_eigenvalues.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function CancerStateSwap() {
  const { data, isLoading, error } = useQuery<ApiResponse>({
    queryKey: ["/api/cancer-state-swap"],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <FlaskConical className="w-12 h-12 text-blue-500 animate-pulse mx-auto" />
          <p className="text-lg text-gray-600">Running AR(2) analysis on 60,000+ genes across two conditions...</p>
          <p className="text-sm text-slate-500">This may take a moment on first load</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-red-500">Error loading analysis: {String(error)}</p>
      </div>
    );
  }

  const identityGenes = data.geneResults.filter(g => g.group === 'identity');
  const prolifGenes = data.geneResults.filter(g => g.group === 'proliferation');

  const barData = data.geneResults.map(g => ({
    gene: g.gene,
    mycOn: g.mycOn?.eigenvalue ?? 0,
    mycOff: g.mycOff?.eigenvalue ?? 0,
    group: g.group,
  }));

  const identityBarData = barData.filter(g => g.group === 'identity').sort((a, b) => b.mycOn - a.mycOn);
  const prolifBarData = barData.filter(g => g.group === 'proliferation').sort((a, b) => b.mycOn - a.mycOn);

  const scatterData = data.geneResults
    .filter(g => g.mycOn && g.mycOff)
    .map(g => ({
      gene: g.gene,
      mycOn: g.mycOn!.eigenvalue,
      mycOff: g.mycOff!.eigenvalue,
      group: g.group,
    }));

  const summaryBarData = [
    { name: "Identity\n(MYC-ON)", value: data.groupStats.mycOn.identity.median, fill: "#3b82f6", condition: "MYC-ON" },
    { name: "Identity\n(MYC-OFF)", value: data.groupStats.mycOff.identity.median, fill: "#93c5fd", condition: "MYC-OFF" },
    { name: "Prolif.\n(MYC-ON)", value: data.groupStats.mycOn.proliferation.median, fill: "#ef4444", condition: "MYC-ON" },
    { name: "Prolif.\n(MYC-OFF)", value: data.groupStats.mycOff.proliferation.median, fill: "#fca5a5", condition: "MYC-OFF" },
    { name: "Background\n(MYC-ON)", value: data.groupStats.mycOn.background.median, fill: "#6b7280", condition: "MYC-ON" },
    { name: "Background\n(MYC-OFF)", value: data.groupStats.mycOff.background.median, fill: "#d1d5db", condition: "MYC-OFF" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" data-testid="link-back">
              <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" />Back</Button>
            </a>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2" data-testid="text-page-title">
                <Dna className="w-6 h-6 text-purple-600" />
                Cancer State-Swap: Identity vs Proliferation Markers
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                AR(2) |λ| comparison in {data.dataset.geoAccession} Neuroblastoma MYC ON/OFF
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => exportCSV(data)} data-testid="button-export-csv">
            <Download className="w-4 h-4 mr-1" />Export CSV
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Dataset</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><span className="text-gray-500">GEO:</span> <a href={`https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=${data.dataset.geoAccession}`} target="_blank" className="text-blue-600 underline" data-testid="link-geo">{data.dataset.geoAccession}</a></div>
              <div><span className="text-gray-500">Organism:</span> {data.dataset.organism}</div>
              <div><span className="text-gray-500">Timepoints:</span> {data.dataset.timepoints} ({data.dataset.samplingInterval} intervals)</div>
              <div><span className="text-gray-500">Design:</span> MYCN-ON (cancer) vs MYCN-OFF (differentiated)</div>
              <div className="col-span-2 md:col-span-4 text-gray-600">{data.dataset.description}</div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="pt-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Cell Identity Markers</p>
              <div className="flex items-end gap-2 mt-1">
                <span className="text-2xl font-bold text-blue-700" data-testid="text-identity-on">{data.groupStats.mycOn.identity.median.toFixed(3)}</span>
                <span className="text-sm text-slate-500">MYC-ON</span>
                <span className="text-lg text-blue-400 ml-2" data-testid="text-identity-off">{data.groupStats.mycOff.identity.median.toFixed(3)}</span>
                <span className="text-sm text-slate-500">MYC-OFF</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">n = {data.groupStats.mycOn.identity.n} genes (Astrocyte, Neuron, Oligodendrocyte)</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-red-500">
            <CardContent className="pt-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Proliferation Markers</p>
              <div className="flex items-end gap-2 mt-1">
                <span className="text-2xl font-bold text-red-700" data-testid="text-prolif-on">{data.groupStats.mycOn.proliferation.median.toFixed(3)}</span>
                <span className="text-sm text-slate-500">MYC-ON</span>
                <span className="text-lg text-red-400 ml-2" data-testid="text-prolif-off">{data.groupStats.mycOff.proliferation.median.toFixed(3)}</span>
                <span className="text-sm text-slate-500">MYC-OFF</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">n = {data.groupStats.mycOn.proliferation.n} genes (Cyclins, CDKs, Mitotic)</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-gray-500">
            <CardContent className="pt-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Genome Background</p>
              <div className="flex items-end gap-2 mt-1">
                <span className="text-2xl font-bold text-gray-700" data-testid="text-bg-on">{data.groupStats.mycOn.background.median.toFixed(3)}</span>
                <span className="text-sm text-slate-500">MYC-ON</span>
                <span className="text-lg text-slate-500 ml-2" data-testid="text-bg-off">{data.groupStats.mycOff.background.median.toFixed(3)}</span>
                <span className="text-sm text-slate-500">MYC-OFF</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">n = {data.groupStats.mycOn.background.n.toLocaleString()} total genes</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Median |λ| Summary: Identity vs Proliferation vs Background</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={summaryBarData} margin={{ top: 10, right: 30, left: 10, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
                <YAxis domain={[0, 'auto']} label={{ value: "Median |λ|", angle: -90, position: "insideLeft" }} />
                <Tooltip formatter={(value: number) => value.toFixed(4)} />
                <Bar dataKey="value" name="Median |λ|">
                  {summaryBarData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                Cell Identity Markers — Per-Gene |λ|
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={identityBarData} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 1]} label={{ value: "|λ|", position: "bottom" }} />
                  <YAxis dataKey="gene" type="category" width={70} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => v.toFixed(4)} />
                  <Legend />
                  <Bar dataKey="mycOn" name="MYC-ON (Cancer)" fill="#3b82f6" barSize={12} />
                  <Bar dataKey="mycOff" name="MYC-OFF (Differentiated)" fill="#93c5fd" barSize={12} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                Proliferation Markers — Per-Gene |λ|
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={prolifBarData} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 1]} label={{ value: "|λ|", position: "bottom" }} />
                  <YAxis dataKey="gene" type="category" width={70} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => v.toFixed(4)} />
                  <Legend />
                  <Bar dataKey="mycOn" name="MYC-ON (Cancer)" fill="#ef4444" barSize={12} />
                  <Bar dataKey="mycOff" name="MYC-OFF (Differentiated)" fill="#fca5a5" barSize={12} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">State-Swap Scatter: MYC-ON vs MYC-OFF |λ|</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <ScatterChart margin={{ top: 10, right: 30, left: 10, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" dataKey="mycOff" domain={[0, 1]} name="MYC-OFF |λ|" label={{ value: "MYC-OFF |λ| (Differentiated)", position: "bottom", offset: 10 }} />
                <YAxis type="number" dataKey="mycOn" domain={[0, 1]} name="MYC-ON |λ|" label={{ value: "MYC-ON |λ| (Cancer)", angle: -90, position: "insideLeft" }} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="bg-white border rounded p-2 text-xs shadow">
                        <p className="font-bold">{d.gene}</p>
                        <p>MYC-ON: {d.mycOn.toFixed(4)}</p>
                        <p>MYC-OFF: {d.mycOff.toFixed(4)}</p>
                        <p>Δ: {(d.mycOn - d.mycOff).toFixed(4)}</p>
                      </div>
                    );
                  }}
                />
                <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]} stroke="#999" strokeDasharray="5 5" />
                <Scatter
                  name="Cell Identity"
                  data={scatterData.filter(d => d.group === 'identity')}
                  fill="#3b82f6"
                  shape="circle"
                />
                <Scatter
                  name="Proliferation"
                  data={scatterData.filter(d => d.group === 'proliferation')}
                  fill="#ef4444"
                  shape="diamond"
                />
                <Legend />
              </ScatterChart>
            </ResponsiveContainer>
            <p className="text-xs text-gray-500 mt-2 text-center">Points above the diagonal gained |λ| in the cancer state; below lost |λ|.</p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Statistical Comparisons — MYC-ON</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm" data-testid="table-stats-on">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2">Comparison</th>
                    <th>Median Δ</th>
                    <th>Cohen's d</th>
                    <th>p-value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-2">Identity vs Prolif.</td>
                    <td>{data.comparisons.mycOn.identityVsProlif.medianDiff > 0 ? "+" : ""}{data.comparisons.mycOn.identityVsProlif.medianDiff.toFixed(3)}</td>
                    <td>{data.comparisons.mycOn.identityVsProlif.cohenD.toFixed(3)}</td>
                    <td>{formatP(data.comparisons.mycOn.identityVsProlif.permutationP)}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2">Identity vs Background</td>
                    <td>—</td>
                    <td>{data.comparisons.mycOn.identityVsBackground.cohenD.toFixed(3)}</td>
                    <td>{formatP(data.comparisons.mycOn.identityVsBackground.wilcoxonP)}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2">Prolif. vs Background</td>
                    <td>—</td>
                    <td>{data.comparisons.mycOn.prolifVsBackground.cohenD.toFixed(3)}</td>
                    <td>{formatP(data.comparisons.mycOn.prolifVsBackground.wilcoxonP)}</td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Statistical Comparisons — MYC-OFF</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm" data-testid="table-stats-off">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2">Comparison</th>
                    <th>Median Δ</th>
                    <th>Cohen's d</th>
                    <th>p-value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-2">Identity vs Prolif.</td>
                    <td>{data.comparisons.mycOff.identityVsProlif.medianDiff > 0 ? "+" : ""}{data.comparisons.mycOff.identityVsProlif.medianDiff.toFixed(3)}</td>
                    <td>{data.comparisons.mycOff.identityVsProlif.cohenD.toFixed(3)}</td>
                    <td>{formatP(data.comparisons.mycOff.identityVsProlif.permutationP)}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2">Identity vs Background</td>
                    <td>—</td>
                    <td>{data.comparisons.mycOff.identityVsBackground.cohenD.toFixed(3)}</td>
                    <td>{formatP(data.comparisons.mycOff.identityVsBackground.wilcoxonP)}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2">Prolif. vs Background</td>
                    <td>—</td>
                    <td>{data.comparisons.mycOff.prolifVsBackground.cohenD.toFixed(3)}</td>
                    <td>{formatP(data.comparisons.mycOff.prolifVsBackground.wilcoxonP)}</td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">State-Swap Effects: How MYC Activation Changes |λ|</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm font-medium text-blue-800">Identity Markers Shift</p>
                <p className="text-2xl font-bold text-blue-700 mt-1" data-testid="text-identity-shift">
                  {data.stateSwapEffects.identityShift.medianDelta > 0 ? "+" : ""}
                  {data.stateSwapEffects.identityShift.medianDelta.toFixed(4)}
                </p>
                <p className="text-xs text-blue-600">Cohen's d = {data.stateSwapEffects.identityShift.cohenD.toFixed(3)}, p = {formatP(data.stateSwapEffects.identityShift.wilcoxonP)}</p>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
                <p className="text-sm font-medium text-red-800">Proliferation Markers Shift</p>
                <p className="text-2xl font-bold text-red-700 mt-1" data-testid="text-prolif-shift">
                  {data.stateSwapEffects.prolifShift.medianDelta > 0 ? "+" : ""}
                  {data.stateSwapEffects.prolifShift.medianDelta.toFixed(4)}
                </p>
                <p className="text-xs text-red-600">Cohen's d = {data.stateSwapEffects.prolifShift.cohenD.toFixed(3)}, p = {formatP(data.stateSwapEffects.prolifShift.wilcoxonP)}</p>
              </div>
              <div className="bg-gray-100 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-800">Background Shift</p>
                <p className="text-2xl font-bold text-gray-700 mt-1" data-testid="text-bg-shift">
                  {data.stateSwapEffects.backgroundShift.medianDelta > 0 ? "+" : ""}
                  {data.stateSwapEffects.backgroundShift.medianDelta.toFixed(4)}
                </p>
                <p className="text-xs text-gray-600">Genome-wide baseline change</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Interpretation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.interpretation.map((line, i) => (
                <p key={i} className="text-sm text-gray-700">{line}</p>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Per-Gene Detail Table</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs" data-testid="table-gene-detail">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 px-1">Gene</th>
                    <th className="px-1">Group</th>
                    <th className="px-1">Subcategory</th>
                    <th className="px-1 text-right">|λ| ON</th>
                    <th className="px-1 text-right">|λ| OFF</th>
                    <th className="px-1 text-right">Δ</th>
                    <th className="px-1 text-right">R² ON</th>
                    <th className="px-1 text-right">R² OFF</th>
                    <th className="px-1 text-center">Complex</th>
                  </tr>
                </thead>
                <tbody>
                  {data.geneResults
                    .sort((a, b) => (b.mycOn?.eigenvalue ?? 0) - (a.mycOn?.eigenvalue ?? 0))
                    .map(g => (
                    <tr key={g.gene} className={`border-b hover:bg-gray-50 ${g.group === 'identity' ? 'bg-blue-50/30' : 'bg-red-50/30'}`}>
                      <td className="py-1.5 px-1 font-medium" title={g.fullName}>{g.gene}</td>
                      <td className="px-1">
                        <Badge variant={g.group === 'identity' ? 'default' : 'destructive'} className="text-[10px]">
                          {g.group === 'identity' ? 'Identity' : 'Prolif.'}
                        </Badge>
                      </td>
                      <td className="px-1 text-gray-500">{g.subcategory}</td>
                      <td className="px-1 text-right font-mono">{g.mycOn?.eigenvalue.toFixed(4) ?? "—"}</td>
                      <td className="px-1 text-right font-mono">{g.mycOff?.eigenvalue.toFixed(4) ?? "—"}</td>
                      <td className="px-1 text-right font-mono flex items-center justify-end gap-1">
                        <DeltaIcon val={g.delta} />
                        {g.delta !== null ? (g.delta > 0 ? "+" : "") + g.delta.toFixed(4) : "—"}
                      </td>
                      <td className="px-1 text-right font-mono">{g.mycOn?.r2.toFixed(3) ?? "—"}</td>
                      <td className="px-1 text-right font-mono">{g.mycOff?.r2.toFixed(3) ?? "—"}</td>
                      <td className="px-1 text-center">
                        {g.mycOn?.complexRoots && <span className="text-purple-600" title="Complex roots in MYC-ON">●</span>}
                        {g.mycOff?.complexRoots && <span className="text-purple-400 ml-0.5" title="Complex roots in MYC-OFF">○</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="pt-4">
            <p className="text-sm text-amber-800">
              <strong>Methods note:</strong> AR(2) eigenvalue modulus |λ| computed on mean-centred time series from {data.dataset.geoAccession}
              ({data.dataset.timepoints} timepoints, {data.dataset.samplingInterval} sampling).
              Cell identity markers include astrocyte (GFAP, AQP4, S100B, ALDH1L1, SOX9), neuronal (MAP2, TUBB3, RBFOX3, SYN1),
              oligodendrocyte (OLIG2, MBP), and progenitor (NES, VIM) markers.
              Proliferation markers include cyclins, CDKs, mitotic kinases, and replication factors.
              Statistical tests: Wilcoxon rank-sum, 10,000-permutation test, Cohen's d effect size.
              |λ| capped at 1.0 (stable fits only). Complex roots indicate oscillatory dynamics.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
