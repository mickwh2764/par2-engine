import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  BarChart, Bar, ReferenceLine,
} from "recharts";
import {
  ArrowLeft, Loader2, Search, Dna, TrendingUp, AlertTriangle, Download,
} from "lucide-react";
import PaperCrossLinks from "@/components/PaperCrossLinks";
import GeneTooltip from "@/components/GeneTooltip";

interface GeneCoupling {
  gene: string;
  deltaAIC: number;
  deltaBIC: number;
  deltaR2: number;
  couplingCoefficient: number;
  couplingPValue: number;
  fStatistic: number;
  fPValue: number;
  fdrQ: number;
  significant: boolean;
}

interface VolcanoPoint {
  gene: string;
  deltaAIC: number;
  negLogFDR: number;
  fdrQ: number;
  significant: boolean;
  couplingCoefficient: number;
}

interface PathwayResult {
  pathway: string;
  genesInPathway: number;
  coupledInPathway: number;
  totalCoupled: number;
  totalGenes: number;
  foldEnrichment: number;
  pValue: number;
  fdrQ: number;
  coupledGenes: string[];
}

interface AnalysisResponse {
  dataset: string;
  totalGenesAnalyzed: number;
  totalSignificant: number;
  fdrThreshold: number;
  clockPredictor: string;
  topCoupledGenes: GeneCoupling[];
  volcanoData: VolcanoPoint[];
  pathwayEnrichment: PathwayResult[];
  summary: {
    percentCoupled: number;
    meanDeltaAIC: number;
    medianDeltaAIC: number;
    topPathways: string[];
    knownClockGenesCoupled: string[];
    novelFindings: string[];
  };
  interpretation: string;
}

const DATASETS = [
  { id: "GSE11923_Liver_1h_48h_genes.csv", label: "Mouse Liver (Hughes 2009, 1h resolution)" },
  { id: "GSE54650_Liver_circadian.csv", label: "Mouse Liver (Zhang 2014)" },
  { id: "GSE54650_Kidney_circadian.csv", label: "Mouse Kidney (Zhang 2014)" },
  { id: "GSE54650_Lung_circadian.csv", label: "Mouse Lung (Zhang 2014)" },
  { id: "GSE54650_Heart_circadian.csv", label: "Mouse Heart (Zhang 2014)" },
  { id: "GSE54650_Adrenal_circadian.csv", label: "Mouse Adrenal (Zhang 2014)" },
  { id: "GSE54650_Hypothalamus_circadian.csv", label: "Mouse Hypothalamus (Zhang 2014)" },
  { id: "GSE54650_Muscle_circadian.csv", label: "Mouse Muscle (Zhang 2014)" },
  { id: "GSE54650_Brown_Fat_circadian.csv", label: "Mouse Brown Fat (Zhang 2014)" },
  { id: "GSE54650_White_Fat_circadian.csv", label: "Mouse White Fat (Zhang 2014)" },
  { id: "GSE54650_Aorta_circadian.csv", label: "Mouse Aorta (Zhang 2014)" },
  { id: "GSE54650_Brainstem_circadian.csv", label: "Mouse Brainstem (Zhang 2014)" },
  { id: "GSE54650_Cerebellum_circadian.csv", label: "Mouse Cerebellum (Zhang 2014)" },
];

const CLOCK_PREDICTORS = [
  { id: "Arntl", label: "BMAL1 (Arntl)" },
  { id: "Clock", label: "CLOCK" },
  { id: "Per2", label: "PER2" },
  { id: "Nr1d1", label: "REV-ERBα (Nr1d1)" },
  { id: "Cry1", label: "CRY1" },
  { id: "Dbp", label: "DBP" },
];

function formatP(p: number): string {
  if (p < 1e-10) return p.toExponential(1);
  if (p < 0.001) return p.toExponential(2);
  return p.toFixed(4);
}

function VolcanoPlot({ data }: { data: VolcanoPoint[] }) {
  const fdrLine = -Math.log10(0.05);
  const plotData = useMemo(() => {
    return data
      .filter(d => isFinite(d.negLogFDR) && isFinite(d.deltaAIC))
      .map(d => ({
        ...d,
        negLogFDR: Math.min(d.negLogFDR, 20),
        deltaAIC: Math.max(Math.min(d.deltaAIC, 30), -10),
      }));
  }, [data]);

  return (
    <ResponsiveContainer width="100%" height={400}>
      <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis type="number" dataKey="deltaAIC" name="ΔAIC"
          label={{ value: "ΔAIC (positive = clock coupling helps)", position: "bottom", fill: "#64748b", offset: 20 }}
          stroke="#64748b" tick={{ fill: "#64748b" }} />
        <YAxis type="number" dataKey="negLogFDR" name="-log₁₀(FDR)"
          label={{ value: "-log₁₀(FDR q-value)", angle: -90, position: "insideLeft", fill: "#64748b", offset: -20 }}
          stroke="#64748b" tick={{ fill: "#64748b" }} />
        <ReferenceLine y={fdrLine} stroke="#f59e0b" strokeDasharray="5 5" label={{ value: "FDR=0.05", fill: "#f59e0b", position: "right" }} />
        <ReferenceLine x={2} stroke="#f59e0b" strokeDasharray="5 5" label={{ value: "ΔAIC=2", fill: "#f59e0b", position: "top" }} />
        <Tooltip
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              const d = payload[0].payload;
              return (
                <div className="bg-slate-100 border border-slate-300 p-2 rounded text-xs" data-testid="volcano-tooltip">
                  <div className="font-bold text-slate-900">{d.gene}</div>
                  <div className="text-slate-600">ΔAIC: {d.deltaAIC.toFixed(2)}</div>
                  <div className="text-slate-600">FDR: {formatP(d.fdrQ)}</div>
                  <div className="text-slate-600">Coupling coeff: {d.couplingCoefficient.toFixed(4)}</div>
                  <div className={d.significant ? "text-emerald-400" : "text-slate-500"}>
                    {d.significant ? "SIGNIFICANT" : "not significant"}
                  </div>
                </div>
              );
            }
            return null;
          }}
        />
        <Scatter data={plotData} isAnimationActive={false}>
          {plotData.map((entry, index) => (
            <Cell key={index} fill={entry.significant ? "#10b981" : "#475569"} opacity={entry.significant ? 0.9 : 0.3} r={entry.significant ? 5 : 2} />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}

export default function GenomeWideCoupling() {
  const [dataset, setDataset] = useState(DATASETS[0].id);
  const [clockPredictor, setClockPredictor] = useState("Arntl");
  const [geneFilter, setGeneFilter] = useState("");
  const [showAll, setShowAll] = useState(false);

  const { data, isLoading, error } = useQuery<AnalysisResponse>({
    queryKey: ["/api/genome-wide-coupling/analyze", dataset, clockPredictor],
    queryFn: async () => {
      const res = await fetch(`/api/genome-wide-coupling/analyze?dataset=${encodeURIComponent(dataset)}&clockPredictor=${encodeURIComponent(clockPredictor)}`);
      if (!res.ok) throw new Error((await res.json()).error || "Analysis failed");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const filteredGenes = useMemo(() => {
    if (!data) return [];
    const genes = showAll
      ? data.topCoupledGenes
      : data.topCoupledGenes.slice(0, 30);
    if (!geneFilter) return genes;
    return genes.filter(g => g.gene.toLowerCase().includes(geneFilter.toLowerCase()));
  }, [data, geneFilter, showAll]);

  const downloadCSV = () => {
    if (!data) return;
    const header = "Gene,DeltaAIC,DeltaBIC,DeltaR2,CouplingCoeff,FDR_Q,Significant\n";
    const rows = data.topCoupledGenes.map(g =>
      `${g.gene},${g.deltaAIC.toFixed(4)},${g.deltaBIC.toFixed(4)},${g.deltaR2.toFixed(6)},${g.couplingCoefficient.toFixed(6)},${g.fdrQ.toExponential(3)},${g.significant}`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `genome_wide_coupling_${dataset.replace('.csv', '')}_${clockPredictor}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 text-slate-900">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/">
            <Button variant="ghost" className="text-slate-500 hover:text-slate-700" data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3" data-testid="text-page-title">
              <Dna className="h-8 w-8 text-emerald-400" />
              Genome-Wide Clock Coupling Scan
            </h1>
            <p className="text-slate-500 mt-1" data-testid="text-page-description">
              Which genes across the entire genome are influenced by the circadian clock?
            </p>
            <div className="rounded-lg bg-slate-100 border border-slate-200 p-4 mt-3">
              <p className="text-sm text-slate-600 leading-relaxed">
                <strong className="text-slate-900">What you can do:</strong> Tests every gene in the dataset for statistical association with a clock predictor gene using AR(2)+exogenous models. Results are FDR-corrected to control false discoveries. Download the full scan results for further analysis.
              </p>
            </div>
          </div>
        </div>

        <PaperCrossLinks currentPage="/genome-wide-coupling" />

        <Card className="bg-white border-amber-500/30 mb-6">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-200/80">
                <strong>What this does:</strong> Tests every gene in the dataset to see if adding the clock gene as a predictor
                improves the AR(2) model. Genes where clock coupling significantly reduces AIC (with FDR correction for multiple testing)
                are candidates for circadian regulation. This is a discovery tool — statistical coupling does not prove causal regulation.
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm text-slate-500 mb-1 block">Dataset</label>
            <Select value={dataset} onValueChange={setDataset} data-testid="select-dataset">
              <SelectTrigger className="bg-slate-100 border-slate-200 text-slate-900" data-testid="select-dataset-trigger">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-100 border-slate-200" data-testid="select-dataset-content">
                {DATASETS.map(ds => (
                  <SelectItem key={ds.id} value={ds.id} data-testid={`select-dataset-${ds.id}`}>
                    {ds.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[180px]">
            <label className="text-sm text-slate-500 mb-1 block">Clock Predictor</label>
            <Select value={clockPredictor} onValueChange={setClockPredictor} data-testid="select-clock">
              <SelectTrigger className="bg-slate-100 border-slate-200 text-slate-900" data-testid="select-clock-trigger">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-100 border-slate-200" data-testid="select-clock-content">
                {CLOCK_PREDICTORS.map(cp => (
                  <SelectItem key={cp.id} value={cp.id} data-testid={`select-clock-${cp.id}`}>
                    {cp.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20" data-testid="loading-state">
            <Loader2 className="h-12 w-12 animate-spin text-emerald-400 mb-4" />
            <p className="text-slate-500 text-lg">Scanning genome-wide coupling...</p>
            <p className="text-slate-500 text-sm mt-1">This may take 30-60 seconds for large datasets</p>
          </div>
        )}

        {error && (
          <Card className="bg-red-900/30 border-red-500/50">
            <CardContent className="py-6 text-center text-red-300" data-testid="error-state">
              Analysis failed: {(error as Error).message}
            </CardContent>
          </Card>
        )}

        {data && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card className="bg-slate-50 border-slate-200">
                <CardContent className="py-4 text-center">
                  <div className="text-3xl font-bold text-slate-900" data-testid="text-total-genes">{data.totalGenesAnalyzed.toLocaleString()}</div>
                  <div className="text-sm text-slate-500">Genes Tested</div>
                </CardContent>
              </Card>
              <Card className="bg-slate-50 border-emerald-500/30">
                <CardContent className="py-4 text-center">
                  <div className="text-3xl font-bold text-emerald-400" data-testid="text-significant-genes">{data.totalSignificant}</div>
                  <div className="text-sm text-slate-500">Clock-Coupled (FDR &lt; 0.05)</div>
                </CardContent>
              </Card>
              <Card className="bg-slate-50 border-slate-200">
                <CardContent className="py-4 text-center">
                  <div className="text-3xl font-bold text-slate-900" data-testid="text-percent-coupled">{data.summary.percentCoupled.toFixed(1)}%</div>
                  <div className="text-sm text-slate-500">of Genome Coupled</div>
                </CardContent>
              </Card>
              <Card className="bg-slate-50 border-slate-200">
                <CardContent className="py-4 text-center">
                  <div className="text-3xl font-bold text-slate-900" data-testid="text-median-aic">{data.summary.medianDeltaAIC.toFixed(2)}</div>
                  <div className="text-sm text-slate-500">Median ΔAIC</div>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-slate-50 border-slate-200 mb-6">
              <CardHeader>
                <CardTitle className="text-lg text-slate-900 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-emerald-400" />
                  Volcano Plot: Clock Coupling Across the Genome
                </CardTitle>
                <CardDescription className="text-slate-500">
                  Each dot is a gene. Green = significant (FDR &lt; 0.05 and ΔAIC &gt; 2). X-axis: how much clock coupling improves prediction. Y-axis: statistical significance.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <VolcanoPlot data={data.volcanoData} />
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <Card className="bg-slate-50 border-slate-200">
                <CardHeader>
                  <CardTitle className="text-lg text-slate-900 flex items-center gap-2">
                    <Search className="h-5 w-5 text-blue-400" />
                    Pathway Enrichment
                  </CardTitle>
                  <CardDescription className="text-slate-500">
                    Are clock-coupled genes concentrated in specific biological pathways?
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {data.pathwayEnrichment.filter(p => p.coupledInPathway > 0).length === 0 ? (
                    <div className="text-slate-500 text-center py-8" data-testid="text-no-enrichment">
                      No significant pathway enrichment detected
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {data.pathwayEnrichment
                        .filter(p => p.coupledInPathway > 0)
                        .slice(0, 15)
                        .map((p, i) => (
                        <div key={i} className="flex items-center gap-3 p-2 rounded bg-white" data-testid={`pathway-${i}`}>
                          <div className="flex-1">
                            <div className="text-sm font-medium text-slate-900">{p.pathway}</div>
                            <div className="text-xs text-slate-500">
                              {p.coupledInPathway}/{p.genesInPathway} genes coupled | Fold: {p.foldEnrichment.toFixed(1)}x
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge className={p.pValue < 0.05 ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-slate-200 text-slate-500 border-slate-300"}>
                              p={formatP(p.pValue)}
                            </Badge>
                            {p.coupledGenes.length > 0 && (
                              <div className="text-xs text-slate-500 mt-1 max-w-[200px] truncate" title={p.coupledGenes.join(", ")}>
                                {p.coupledGenes.join(", ")}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-slate-50 border-slate-200">
                <CardHeader>
                  <CardTitle className="text-lg text-slate-900">Key Findings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {data.summary.knownClockGenesCoupled.length > 0 && (
                    <div data-testid="text-known-coupled">
                      <div className="text-sm font-medium text-emerald-400 mb-1">Known Clock/Cell-Cycle Genes Detected:</div>
                      <div className="flex flex-wrap gap-1">
                        {data.summary.knownClockGenesCoupled.map(g => (
                          <Badge key={g} className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs"><GeneTooltip gene={g}>{g}</GeneTooltip></Badge>
                        ))}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">These validate the scan — known circadian genes should appear coupled.</div>
                    </div>
                  )}
                  {data.summary.novelFindings.length > 0 && (
                    <div data-testid="text-novel-findings">
                      <div className="text-sm font-medium text-blue-400 mb-1">Novel Clock-Coupled Genes:</div>
                      <div className="flex flex-wrap gap-1">
                        {data.summary.novelFindings.slice(0, 20).map(g => (
                          <Badge key={g} className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs"><GeneTooltip gene={g}>{g}</GeneTooltip></Badge>
                        ))}
                        {data.summary.novelFindings.length > 20 && (
                          <Badge className="bg-slate-200 text-slate-500 text-xs">+{data.summary.novelFindings.length - 20} more</Badge>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">Genes not in predefined clock or cell-cycle gene lists that show significant coupling.</div>
                    </div>
                  )}
                  {data.summary.topPathways.length > 0 && (
                    <div data-testid="text-top-pathways">
                      <div className="text-sm font-medium text-amber-400 mb-1">Enriched Pathways (p &lt; 0.05):</div>
                      <div className="flex flex-wrap gap-1">
                        {data.summary.topPathways.map(p => (
                          <Badge key={p} className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-xs">{p}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="bg-slate-50 border-slate-200 mb-6">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg text-slate-900">
                    Top Clock-Coupled Genes ({data.totalSignificant} significant)
                  </CardTitle>
                  <div className="flex gap-2">
                    <div className="relative">
                      <Search className="h-4 w-4 absolute left-2 top-2.5 text-slate-500" />
                      <input
                        type="text"
                        value={geneFilter}
                        onChange={e => setGeneFilter(e.target.value)}
                        placeholder="Search genes..."
                        className="bg-slate-50 border border-slate-200 rounded pl-8 pr-3 py-2 text-sm text-slate-900 w-48"
                        data-testid="input-gene-search"
                      />
                    </div>
                    <Button variant="outline" size="sm" onClick={downloadCSV} className="border-slate-300 text-slate-600" data-testid="button-download-csv">
                      <Download className="h-4 w-4 mr-1" /> CSV
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="table-results">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="text-left py-2 px-3">#</th>
                        <th className="text-left py-2 px-3">Gene</th>
                        <th className="text-right py-2 px-3">ΔAIC</th>
                        <th className="text-right py-2 px-3">ΔBIC</th>
                        <th className="text-right py-2 px-3">ΔR²</th>
                        <th className="text-right py-2 px-3">Coupling Coeff</th>
                        <th className="text-right py-2 px-3">F-test p</th>
                        <th className="text-right py-2 px-3">FDR q</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredGenes.map((g, i) => (
                        <tr key={g.gene} className="border-b border-slate-800 hover:bg-slate-50" data-testid={`row-gene-${g.gene}`}>
                          <td className="py-2 px-3 text-slate-500">{i + 1}</td>
                          <td className="py-2 px-3 font-medium text-slate-900"><GeneTooltip gene={g.gene}>{g.gene}</GeneTooltip></td>
                          <td className="py-2 px-3 text-right text-emerald-400">{g.deltaAIC.toFixed(2)}</td>
                          <td className="py-2 px-3 text-right text-slate-600">{g.deltaBIC.toFixed(2)}</td>
                          <td className="py-2 px-3 text-right text-slate-600">{(g.deltaR2 * 100).toFixed(2)}%</td>
                          <td className="py-2 px-3 text-right text-slate-600">{g.couplingCoefficient.toFixed(4)}</td>
                          <td className="py-2 px-3 text-right text-slate-600">{formatP(g.fPValue)}</td>
                          <td className="py-2 px-3 text-right">
                            <span className={g.fdrQ < 0.05 ? "text-emerald-400" : "text-slate-500"}>{formatP(g.fdrQ)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {data.topCoupledGenes.length > 30 && !showAll && (
                  <div className="text-center mt-4">
                    <Button variant="outline" size="sm" onClick={() => setShowAll(true)} className="border-slate-300 text-slate-600" data-testid="button-show-all">
                      Show All {data.topCoupledGenes.length} Significant Genes
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-slate-50 border-slate-200 mb-6">
              <CardHeader>
                <CardTitle className="text-lg text-slate-900">Interpretation</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 leading-relaxed" data-testid="text-interpretation">{data.interpretation}</p>
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200">
              <CardContent className="py-4">
                <div className="text-xs text-slate-500 space-y-1">
                  <div><strong>Method:</strong> For each gene, fits AR(2) model y(t) = a₁·y(t-1) + a₂·y(t-2) + ε, then tests if adding the clock gene as an exogenous predictor y(t) = a₁·y(t-1) + a₂·y(t-2) + γ·clock(t-1) + ε significantly reduces residual variance.</div>
                  <div><strong>Significance:</strong> F-test for nested model comparison, with Benjamini-Hochberg FDR correction across all genes. Threshold: FDR q &lt; 0.05 AND ΔAIC &gt; 2.</div>
                  <div><strong>Pathway enrichment:</strong> Hypergeometric test for over-representation of coupled genes in curated gene sets.</div>
                  <div><strong>Caveat:</strong> Statistical coupling ≠ causal regulation. Clock coupling in the AR(2) model means clock gene expression is a useful predictor, not that the clock directly regulates the target.</div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
