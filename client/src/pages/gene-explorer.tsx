import { useQuery, useQueries } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, Cell
} from "recharts";
import { Search, Plus, X, Loader2, ArrowLeft, ArrowRight, BarChart3, GitCompare, Sparkles, TrendingUp, Download } from "lucide-react";
import { downloadAsCSV } from "@/components/DownloadResultsButton";
import { Link } from "wouter";
import HowTo from "@/components/HowTo";
import GeneTooltip from "@/components/GeneTooltip";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { getDatasetCaveat } from "@/lib/datasetCaveats";

/**
 * Every numeric cell on this page comes from an analysis API, and a single
 * missing field used to take the whole page down via the error boundary.
 */
function fixed(value: number | null | undefined, digits = 4): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "—";
}

const SPECIES_COLORS: Record<string, string> = {
  "Mus musculus": "#3b82f6",
  "Homo sapiens": "#10b981",
  "Papio anubis": "#f59e0b",
  "Arabidopsis": "#84cc16",
};

const COMPARISON_COLORS = ["#3b82f6", "#f59e0b", "#10b981", "#f472b6", "#a78bfa"];

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

interface CrossDatasetResult {
  gene: string;
  geneCategory: string;
  results: {
    datasetId: string;
    datasetName: string;
    species: string;
    eigenvalue: number;
    beta1: number;
    beta2: number;
    r2: number;
    confidence: string;
    geneCategory: string;
    stable: boolean;
  }[];
  summary: {
    meanEigenvalue: number | null;
    minEigenvalue: number | null;
    maxEigenvalue: number | null;
    datasetsFound: number;
    totalDatasetsScanned: number;
  };
}

interface FibonacciEnrichmentResult {
  dataset: { id: string; name: string; species: string };
  totalGenes: number;
  fibonacciNearestCount: number;
  fibonacciNearest: { gene: string; eigenvalue: number; dPhi: number; geneCategory: string }[];
  enrichmentResults: {
    category: string;
    observedCount: number;
    totalInDataset: number;
    expectedCount: number;
    foldEnrichment: number | string;
    pValue: number;
  }[];
  functionalAnnotation: {
    gene: string;
    eigenvalue: number;
    dPhi: number;
    categories: string[];
  }[];
}

function GeneTrackerSection() {
  const [searchInput, setSearchInput] = useState("Per1");
  const debouncedGene = useDebounce(searchInput, 300);

  const { data, isLoading, error } = useQuery<CrossDatasetResult>({
    queryKey: ["/api/analysis/gene-cross-dataset", debouncedGene],
    queryFn: async () => {
      const res = await fetch(`/api/analysis/gene-cross-dataset?gene=${encodeURIComponent(debouncedGene)}`);
      if (!res.ok) throw new Error("Failed to fetch gene data");
      return res.json();
    },
    enabled: debouncedGene.trim().length > 0,
  });

  const chartData = useMemo(() => {
    if (!data?.results) return [];
    return [...data.results]
      .filter(d => Number.isFinite(d.eigenvalue))
      .sort((a, b) => b.eigenvalue - a.eigenvalue)
      .map(d => ({
        name: d.datasetName.length > 25 ? d.datasetName.slice(0, 25) + "…" : d.datasetName,
        eigenvalue: Number(d.eigenvalue.toFixed(4)),
        species: d.species,
      }));
  }, [data]);

  return (
    <Card className="bg-white border-slate-200">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/20">
            <Search className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <CardTitle className="text-slate-900">Cross-Dataset Gene Tracker</CardTitle>
            <CardDescription className="text-slate-500">Track a single gene across all analyzed datasets</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Enter gene name (e.g. Per1, CLOCK, Bmal1)"
            className="bg-slate-50 border-slate-300 text-slate-900"
            data-testid="input-gene-tracker-search"
          />
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
            <span className="ml-2 text-slate-500">Loading gene data...</span>
          </div>
        )}

        {error && (
          <p className="text-red-400 text-sm" data-testid="text-tracker-error">
            Error loading gene data: {(error as Error).message}
          </p>
        )}

        {data && !isLoading && (
          <>
            <Card className="bg-slate-50 border-slate-200">
              <CardContent className="pt-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div>
                    <span className="text-xs text-slate-500 uppercase tracking-wider">Gene</span>
                    <p className="text-lg font-bold text-slate-900 font-mono" data-testid="text-tracker-gene-name"><GeneTooltip gene={data.gene}>{data.gene}</GeneTooltip></p>
                  </div>
                  <Badge className="bg-cyan-900/50 text-cyan-300 border-cyan-700" data-testid="badge-tracker-category">
                    {data.geneCategory}
                  </Badge>
                  <div>
                    <span className="text-xs text-slate-500">Mean |λ|</span>
                    <p className="text-slate-900 font-mono" data-testid="text-tracker-mean">{fixed(data.summary.meanEigenvalue)}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Min |λ|</span>
                    <p className="text-slate-900 font-mono" data-testid="text-tracker-min">{fixed(data.summary.minEigenvalue)}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Max |λ|</span>
                    <p className="text-slate-900 font-mono" data-testid="text-tracker-max">{fixed(data.summary.maxEigenvalue)}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Datasets</span>
                    <p className="text-slate-900 font-mono" data-testid="text-tracker-datasets-count">{data.summary.datasetsFound}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {chartData.length > 0 && (
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ left: 140, right: 20, top: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} width={130} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                      labelStyle={{ color: '#334155' }}
                      itemStyle={{ color: '#94a3b8' }}
                    />
                    {data.summary.meanEigenvalue != null && (
                      <ReferenceLine x={data.summary.meanEigenvalue} stroke="#f59e0b" strokeDasharray="5 5" label={{ value: "Mean", fill: "#f59e0b", fontSize: 11 }} />
                    )}
                    <Bar dataKey="eigenvalue" name="|λ| Eigenvalue">
                      {chartData.map((entry, index) => (
                        <Cell key={index} fill={SPECIES_COLORS[entry.species] || "#64748b"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {data.results && data.results.length > 0 && (
              <Card className="bg-slate-50 border-slate-200">
                <CardContent className="pt-4">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Root-Space Positions</p>
                  <svg viewBox="0 0 120 80" width={120} height={80} className="block" data-testid="svg-mini-rootspace">
                    <title>Root-Space Position</title>
                    <polygon points="10,70 110,70 60,10" fill="none" stroke="#475569" strokeWidth="0.5" strokeDasharray="2 2" />
                    {data.results.map((r, i) => {
                      const cx = 10 + (r.beta1 + 2) * (100 / 4);
                      const cy = 70 - (r.beta2 + 1) * (60 / 2);
                      return (
                        <circle key={i} cx={cx} cy={cy} r={3} fill={SPECIES_COLORS[r.species] || "#64748b"} opacity={0.85}>
                          <title>{`${r.datasetName}: |λ|=${fixed(r.eigenvalue)}`}</title>
                        </circle>
                      );
                    })}
                  </svg>
                </CardContent>
              </Card>
            )}

            <div className="flex gap-2 mt-2">
              <Button
                variant="outline"
                size="sm"
                className="text-slate-600 border-slate-300"
                onClick={() => downloadAsCSV(
                  data.results.map(r => ({
                    gene: data.gene,
                    category: data.geneCategory,
                    dataset_id: r.datasetId,
                    dataset_name: r.datasetName,
                    species: r.species,
                    eigenvalue: r.eigenvalue,
                    beta1: r.beta1,
                    beta2: r.beta2,
                    r2: r.r2,
                    confidence: r.confidence,
                    stable: r.stable,
                  })),
                  `gene_cross_dataset_${data.gene}.csv`
                )}
                data-testid="button-download-gene-csv"
              >
                <Download className="h-4 w-4 mr-1" /> Download CSV
              </Button>
              <Link href="/root-space">
                <Button variant="ghost" size="sm" className="text-cyan-400 hover:text-cyan-300" data-testid="link-gene-rootspace">
                  <ArrowRight className="h-4 w-4 mr-1" /> Explore in Root-Space
                </Button>
              </Link>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function GeneComparisonSection() {
  const [genes, setGenes] = useState<string[]>([]);
  const [addInput, setAddInput] = useState("");

  const addGene = useCallback(() => {
    const g = addInput.trim();
    if (g && genes.length < 5 && !genes.includes(g)) {
      setGenes(prev => [...prev, g]);
      setAddInput("");
    }
  }, [addInput, genes]);

  const removeGene = useCallback((gene: string) => {
    setGenes(prev => prev.filter(g => g !== gene));
  }, []);

  const clearAll = useCallback(() => {
    setGenes([]);
  }, []);

  return (
    <Card className="bg-white border-slate-200">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/20">
            <GitCompare className="h-5 w-5 text-purple-400" />
          </div>
          <div>
            <CardTitle className="text-slate-900">Gene Comparison Tool</CardTitle>
            <CardDescription className="text-slate-500">Compare up to 5 genes across datasets</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            value={addInput}
            onChange={(e) => setAddInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addGene()}
            placeholder="Gene name (e.g. Per2)"
            className="bg-slate-50 border-slate-300 text-slate-900 max-w-xs"
            data-testid="input-comparison-add"
          />
          <Button onClick={addGene} disabled={genes.length >= 5 || !addInput.trim()} size="sm" data-testid="button-comparison-add">
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
          {genes.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAll} className="text-red-400 hover:text-red-300" data-testid="button-comparison-clear">
              <X className="h-4 w-4 mr-1" /> Clear All
            </Button>
          )}
        </div>

        {genes.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {genes.map((gene, i) => (
              <Badge
                key={gene}
                className="text-slate-900 border"
                style={{ backgroundColor: COMPARISON_COLORS[i] + "30", borderColor: COMPARISON_COLORS[i] }}
                data-testid={`badge-comparison-gene-${gene}`}
              >
                {gene}
                <button onClick={() => removeGene(gene)} className="ml-1 hover:text-red-300" data-testid={`button-remove-gene-${gene}`}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {genes.length > 0 && <ComparisonResults genes={genes} />}
      </CardContent>
    </Card>
  );
}

function ComparisonResults({ genes }: { genes: string[] }) {
  const queries = useQueries({
    queries: genes.map(gene => ({
      queryKey: ["/api/analysis/gene-cross-dataset", gene],
      queryFn: async (): Promise<CrossDatasetResult> => {
        const res = await fetch(`/api/analysis/gene-cross-dataset?gene=${encodeURIComponent(gene)}`);
        if (!res.ok) throw new Error(`Failed to fetch ${gene}`);
        return res.json();
      },
    })),
  });

  const isLoading = queries.some(q => q.isLoading);
  const allData = queries.map(q => q.data).filter(Boolean) as CrossDatasetResult[];

  const chartData = useMemo(() => {
    if (allData.length === 0) return [];
    const datasetMap = new Map<string, Record<string, number>>();
    allData.forEach(geneData => {
      (geneData.results || []).forEach(ds => {
        const key = ds.datasetName.length > 20 ? ds.datasetName.slice(0, 20) + "…" : ds.datasetName;
        if (!datasetMap.has(key)) datasetMap.set(key, { name: key } as any);
        const entry = datasetMap.get(key)!;
        (entry as any).name = key;
        if (Number.isFinite(ds.eigenvalue)) {
          (entry as any)[geneData.gene] = Number(ds.eigenvalue.toFixed(4));
        }
      });
    });
    return Array.from(datasetMap.values());
  }, [allData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
        <span className="ml-2 text-slate-500">Loading comparison data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {chartData.length > 0 && (
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ left: 10, right: 20, top: 10, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} angle={-30} textAnchor="end" height={70} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} label={{ value: "|λ| Eigenvalue", angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 12 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                labelStyle={{ color: '#334155' }}
              />
              <Legend wrapperStyle={{ paddingTop: 10 }} />
              {allData.map((gd, i) => (
                <Bar key={gd.gene} dataKey={gd.gene} fill={COMPARISON_COLORS[i]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {allData.length > 0 && (
        <Card className="bg-slate-50 border-slate-200">
          <CardContent className="pt-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Root-Space Comparison</p>
            <div className="flex items-start gap-4">
              <svg viewBox="0 0 200 140" width={200} height={140} className="block" data-testid="svg-comparison-rootspace">
                <title>Root-Space Comparison</title>
                <polygon points="10,130 190,130 100,10" fill="none" stroke="#475569" strokeWidth="0.5" strokeDasharray="2 2" />
                {allData.map((gd, gi) => {
                  const points = (gd.results || []).map(r => ({
                    x: 10 + (r.beta1 + 2) * (180 / 4),
                    y: 130 - (r.beta2 + 1) * (120 / 2),
                  }));
                  return (
                    <g key={gd.gene}>
                      {points.length > 1 && points.map((p, pi) => pi > 0 ? (
                        <line key={`l${pi}`} x1={points[pi - 1].x} y1={points[pi - 1].y} x2={p.x} y2={p.y} stroke={COMPARISON_COLORS[gi]} strokeWidth="0.5" opacity={0.5} />
                      ) : null)}
                      {points.map((p, pi) => (
                        <circle key={pi} cx={p.x} cy={p.y} r={3} fill={COMPARISON_COLORS[gi]} opacity={0.85}>
                          <title>{`${gd.gene} - ${gd.results[pi].datasetName}: |λ|=${fixed(gd.results[pi].eigenvalue)}`}</title>
                        </circle>
                      ))}
                    </g>
                  );
                })}
              </svg>
              <div className="flex flex-col gap-1">
                {allData.map((gd, gi) => (
                  <div key={gd.gene} className="flex items-center gap-1.5 text-xs">
                    <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COMPARISON_COLORS[gi] }} />
                    <span className="text-slate-600">{gd.gene}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {allData.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left" data-testid="table-comparison-summary">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="px-3 py-2 text-slate-500 font-medium">Gene</th>
                <th className="px-3 py-2 text-slate-500 font-medium">Category</th>
                <th className="px-3 py-2 text-slate-500 font-medium">Mean |λ|</th>
                <th className="px-3 py-2 text-slate-500 font-medium">Datasets Found</th>
                <th className="px-3 py-2 text-slate-500 font-medium">Min</th>
                <th className="px-3 py-2 text-slate-500 font-medium">Max</th>
              </tr>
            </thead>
            <tbody>
              {allData.map((gd, i) => (
                <tr key={gd.gene} className="border-b border-slate-200" data-testid={`row-comparison-${gd.gene}`}>
                  <td className="px-3 py-2 text-slate-900 font-mono font-bold" style={{ color: COMPARISON_COLORS[i] }}><GeneTooltip gene={gd.gene}>{gd.gene}</GeneTooltip></td>
                  <td className="px-3 py-2">
                    <Badge className="bg-slate-100 text-slate-600 border-slate-300 text-xs">{gd.geneCategory}</Badge>
                  </td>
                  <td className="px-3 py-2 text-slate-900 font-mono">{fixed(gd.summary.meanEigenvalue)}</td>
                  <td className="px-3 py-2 text-slate-900">{gd.summary.datasetsFound}</td>
                  <td className="px-3 py-2 text-slate-900 font-mono">{fixed(gd.summary.minEigenvalue)}</td>
                  <td className="px-3 py-2 text-slate-900 font-mono">{fixed(gd.summary.maxEigenvalue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FibonacciEnrichmentSection() {
  const [selectedDataset, setSelectedDataset] = useState<string>("");
  const [sampleSize, setSampleSize] = useState<number>(200);

  const { data, isLoading, error } = useQuery<FibonacciEnrichmentResult>({
    queryKey: ["/api/analysis/fibonacci-enrichment", selectedDataset, sampleSize],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedDataset) params.set("dataset", selectedDataset);
      params.set("topN", String(sampleSize));
      const res = await fetch(`/api/analysis/fibonacci-enrichment?${params}`);
      if (!res.ok) throw new Error("Failed to fetch enrichment data");
      return res.json();
    },
  });

  const datasets = [
    { id: "", label: "Mouse Liver (Default)" },
    { id: "GSE54650_Heart_circadian", label: "Mouse Heart" },
    { id: "GSE54650_Kidney_circadian", label: "Mouse Kidney" },
    { id: "GSE11923_Liver_1h_48h_genes", label: "Mouse Liver (Hughes 2009)" },
    { id: "GSE157357_Organoid_WT-WT", label: "Organoid WT ⚠" },
    { id: "GSE113883_Human_WholeBlood", label: "Human Whole Blood" },
    { id: "GSE98965_baboon_FPKM", label: "Baboon Multi-tissue" },
  ];

  const selectedCaveat = getDatasetCaveat(selectedDataset);

  return (
    <Card className="bg-white border-slate-200">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/20">
            <Sparkles className="h-5 w-5 text-amber-400" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-slate-900 flex items-center gap-2">Fibonacci Enrichment Analysis <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-xs font-medium">EXPLORATORY — NOT SIGNIFICANT</span></CardTitle>
            <CardDescription className="text-slate-500">
              The mathematical connection is real: AR(2) and Fibonacci sequences share the same recurrence structure. However, genome-wide enrichment of biological genes near the golden-ratio locus is <strong className="text-slate-600">not statistically significant (p = 0.154)</strong>. The φ₁ ≈ 1.618 values seen in circadian datasets arise from the period-to-sampling-interval ratio — a mathematical consequence, not a biological preference. This analysis is hypothesis-generating only. See the Root-Space Geometry page for full details.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={sampleSize}
              onChange={(e) => setSampleSize(Number(e.target.value))}
              className="bg-slate-100 border border-slate-300 text-slate-900 text-sm rounded-md px-3 py-1.5"
              data-testid="select-fibonacci-sample-size"
            >
              <option value={50}>Top 50</option>
              <option value={100}>Top 100</option>
              <option value={200}>Top 200</option>
              <option value={500}>Top 500</option>
              <option value={1000}>Top 1000</option>
            </select>
            <select
              value={selectedDataset}
              onChange={(e) => setSelectedDataset(e.target.value)}
              className="bg-slate-100 border border-slate-300 text-slate-900 text-sm rounded-md px-3 py-1.5"
              data-testid="select-fibonacci-dataset"
            >
              {datasets.map(ds => (
                <option key={ds.id} value={ds.id}>{ds.label}</option>
              ))}
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {selectedCaveat && (
          <div
            className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800"
            data-testid="banner-dataset-caveat"
            role="alert"
          >
            <span className="mt-0.5 shrink-0 text-base leading-none">⚠</span>
            <span><strong>Short time-window caution:</strong> {selectedCaveat}</span>
          </div>
        )}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
            <span className="ml-2 text-slate-500">Loading enrichment analysis...</span>
          </div>
        )}

        {error && (
          <p className="text-red-400 text-sm" data-testid="text-fibonacci-error">
            Error: {(error as Error).message}
          </p>
        )}

        {data && !isLoading && (
          <>
            <div className="flex flex-wrap gap-4 text-sm">
              <div>
                <span className="text-slate-500">Dataset:</span>
                <span className="ml-2 text-slate-900 font-mono" data-testid="text-fibonacci-dataset">{data.dataset.name}</span>
              </div>
              <div>
                <span className="text-slate-500">Total Genes:</span>
                <span className="ml-2 text-slate-900 font-mono" data-testid="text-fibonacci-total">{data.totalGenes}</span>
              </div>
              <div>
                <span className="text-slate-500">Fibonacci Nearest:</span>
                <span className="ml-2 text-slate-900 font-mono" data-testid="text-fibonacci-nearest-count">{data.fibonacciNearestCount}</span>
              </div>
            </div>

            {data.enrichmentResults && data.enrichmentResults.length > 0 && (() => {
              const totalObserved = data.enrichmentResults.reduce((s, r) => s + r.observedCount, 0);
              const totalExpected = data.enrichmentResults.reduce((s, r) => s + r.expectedCount, 0);
              const anySignificant = data.enrichmentResults.some(r => r.pValue < 0.05);
              return (
              <div className="overflow-x-auto">
                <h3 className="text-sm font-semibold text-slate-600 mb-2 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-amber-400" /> Enrichment Results
                  <span className="text-xs text-slate-500 font-normal ml-2">
                    {totalObserved} categorized genes found (expected {fixed(totalExpected, 1)}) — {anySignificant ? 'significant enrichment detected' : 'no significant enrichment'}
                  </span>
                </h3>
                <table className="w-full text-sm text-left" data-testid="table-enrichment-results">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="px-3 py-2 text-slate-500 font-medium">Category</th>
                      <th className="px-3 py-2 text-slate-500 font-medium">Observed</th>
                      <th className="px-3 py-2 text-slate-500 font-medium">Expected</th>
                      <th className="px-3 py-2 text-slate-500 font-medium">Fold Enrichment</th>
                      <th className="px-3 py-2 text-slate-500 font-medium">p-value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.enrichmentResults.map((row, i) => (
                      <tr key={i} className="border-b border-slate-200" data-testid={`row-enrichment-${i}`}>
                        <td className="px-3 py-2 text-slate-900">{row.category}</td>
                        <td className="px-3 py-2 text-slate-900 font-mono">{row.observedCount}</td>
                        <td className="px-3 py-2 text-slate-600 font-mono">{fixed(row.expectedCount, 2)}</td>
                        <td className="px-3 py-2 font-mono">
                          <span className={row.pValue < 0.05 && typeof row.foldEnrichment === 'number' && row.foldEnrichment > 1.5 ? "text-emerald-400" : "text-slate-600"}>
                            {typeof row.foldEnrichment === 'number' ? fixed(row.foldEnrichment, 2) + "×" : "∞"}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono">
                          <span className={row.pValue < 0.05 ? "text-amber-400 font-bold" : "text-slate-500"}>
                            {typeof row.pValue !== 'number' ? "—" : row.pValue < 0.001 ? row.pValue.toExponential(2) : fixed(row.pValue)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              );
            })()}

            {data.functionalAnnotation && data.functionalAnnotation.length > 0 && (
              <div className="overflow-x-auto">
                <h3 className="text-sm font-semibold text-slate-600 mb-2 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-cyan-400" /> Nearest Genes to Fibonacci Position (showing top 30 of {data.fibonacciNearestCount})
                </h3>
                <div className="max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm text-left" data-testid="table-functional-annotations">
                  <thead className="sticky top-0 bg-slate-50">
                    <tr className="border-b border-slate-200">
                      <th className="px-3 py-2 text-slate-500 font-medium">#</th>
                      <th className="px-3 py-2 text-slate-500 font-medium">Gene</th>
                      <th className="px-3 py-2 text-slate-500 font-medium">|λ|</th>
                      <th className="px-3 py-2 text-slate-500 font-medium">dΦ</th>
                      <th className="px-3 py-2 text-slate-500 font-medium">Category</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.functionalAnnotation.slice(0, 30).map((row, i) => {
                      const isKnown = row.categories.some(c => c !== 'other');
                      return (
                        <tr key={i} className={`border-b border-slate-200 ${isKnown ? 'bg-amber-500/5' : ''}`} data-testid={`row-annotation-${i}`}>
                          <td className="px-3 py-2 text-slate-500 font-mono text-xs">{i + 1}</td>
                          <td className="px-3 py-2 text-slate-900 font-mono font-bold"><GeneTooltip gene={row.gene}>{row.gene}</GeneTooltip></td>
                          <td className="px-3 py-2 text-slate-900 font-mono">{fixed(row.eigenvalue)}</td>
                          <td className="px-3 py-2 text-slate-600 font-mono">{fixed(row.dPhi)}</td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-1">
                              {row.categories.map((cat, ci) => (
                                <Badge key={ci} className={`text-xs ${cat !== 'other' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>{cat}</Badge>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function GeneExplorer() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <Link href="/">
          <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-700" data-testid="button-back-home">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Home
          </Button>
        </Link>

        <Card className="bg-white border-slate-200">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <BarChart3 className="h-6 w-6 text-emerald-400" />
              </div>
              <div>
                <CardTitle className="text-2xl text-slate-900">Gene Explorer</CardTitle>
                <CardDescription className="text-slate-500">
                  Track genes across datasets, compare eigenvalue profiles, and explore Fibonacci enrichment patterns
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        <HowTo
          title="Genome-Wide Gene Explorer"
          summary="Search for any gene across all 72 datasets and see its AR(2) eigenvalue, model fit, and stability across species and conditions. Compare up to 5 genes side-by-side to discover patterns in temporal persistence."
          steps={[
            { label: "Search a gene", detail: "Type a gene name (e.g. 'PER1', 'BMAL1', 'TP53') to find it across all datasets." },
            { label: "View results", detail: "See the gene's eigenvalue, R², confidence level, and which datasets it appears in." },
            { label: "Compare genes", detail: "Add up to 5 genes to the comparison panel to visualize their eigenvalue profiles side-by-side." },
            { label: "Check cross-dataset consistency", detail: "Genes appearing in many datasets with consistent eigenvalues are more reliable." }
          ]}
        />

        <GeneTrackerSection />
        <GeneComparisonSection />
        <FibonacciEnrichmentSection />
      </div>
    </div>
  );
}
