import { useQuery } from "@tanstack/react-query";
import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from "recharts";
import { Flame, ArrowLeft, Loader2, Search, ChevronDown, ChevronUp, ArrowUpDown } from "lucide-react";
import { Link } from "wouter";
import HowTo from "@/components/HowTo";
import InsightCallout from "@/components/InsightCallout";
import ViewInRootSpace from "@/components/ViewInRootSpace";
import EvidenceLink from "@/components/EvidenceLink";
import DownloadResultsButton, { downloadAsCSV } from "@/components/DownloadResultsButton";
import GeneTooltip from "@/components/GeneTooltip";

interface VolatileGene {
  gene: string;
  geneType: "clock" | "target" | "other";
  datasetsFound: number;
  eigenvalues: { datasetId: string; datasetName: string; eigenvalue: number; r2: number }[];
  meanEigenvalue: number;
  eigenvalueRange: number;
  eigenvalueStdDev: number;
  volatilityScore: number;
  interpretation: string;
}

interface VolatileGenesResponse {
  topVolatile: VolatileGene[];
  totalGenesAcross: number;
  totalDatasetsUsed: number;
  clockVolatility: number;
  targetVolatility: number;
  otherVolatility: number;
}

const TYPE_BADGE: Record<string, { bg: string; text: string; border: string }> = {
  clock: { bg: "bg-blue-900/50", text: "text-blue-300", border: "border-blue-700" },
  target: { bg: "bg-amber-900/50", text: "text-amber-300", border: "border-amber-700" },
  other: { bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-300" },
};

type SortKey = "volatilityScore" | "meanEigenvalue" | "eigenvalueRange" | "eigenvalueStdDev" | "datasetsFound";

function MiniSparkline({ eigenvalues }: { eigenvalues: VolatileGene["eigenvalues"] }) {
  if (!eigenvalues || eigenvalues.length === 0) return null;
  const vals = eigenvalues.map((e) => e.eigenvalue);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const w = 80;
  const h = 20;
  const pad = 2;
  const points = vals.map((v, i) => ({
    x: pad + (i / Math.max(vals.length - 1, 1)) * (w - 2 * pad),
    y: pad + (1 - (v - min) / range) * (h - 2 * pad),
  }));
  const lineD = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="inline-block" data-testid="sparkline">
      <path d={lineD} fill="none" stroke="#64748b" strokeWidth="1" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={1.5} fill="#3b82f6" />
      ))}
    </svg>
  );
}

function ExpandedDetail({ gene }: { gene: VolatileGene }) {
  const chartData = gene.eigenvalues.map((ev) => ({
    name: ev.datasetName.length > 20 ? ev.datasetName.slice(0, 20) + "…" : ev.datasetName,
    eigenvalue: Number(ev.eigenvalue.toFixed(4)),
    r2: Number(ev.r2.toFixed(4)),
  }));

  return (
    <tr data-testid={`expanded-detail-${gene.gene}`}>
      <td colSpan={9} className="px-4 py-3 bg-slate-100">
        <div className="space-y-3">
          <p className="text-xs text-slate-500 italic">{gene.interpretation}</p>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ left: 10, right: 10, top: 5, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
                <YAxis tick={{ fill: "#64748b", fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #475569", borderRadius: "8px" }}
                  labelStyle={{ color: "#334155" }}
                />
                <Bar dataKey="eigenvalue" name="|λ|">
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={TYPE_BADGE[gene.geneType]?.text === "text-blue-300" ? "#3b82f6" : TYPE_BADGE[gene.geneType]?.text === "text-amber-300" ? "#f59e0b" : "#64748b"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </td>
    </tr>
  );
}

export default function VolatileGenes() {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "clock" | "target" | "other">("all");
  const [minDatasets, setMinDatasets] = useState(3);
  const [sortKey, setSortKey] = useState<SortKey>("volatilityScore");
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedGene, setExpandedGene] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<VolatileGenesResponse>({
    queryKey: ["/api/analysis/volatile-genes"],
    queryFn: async () => {
      const res = await fetch("/api/analysis/volatile-genes");
      if (!res.ok) throw new Error("Failed to fetch volatile genes data");
      return res.json();
    },
    staleTime: 1000 * 60 * 30,
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const filtered = useMemo(() => {
    if (!data?.topVolatile) return [];
    let list = [...data.topVolatile];
    if (typeFilter !== "all") list = list.filter((g) => g.geneType === typeFilter);
    if (minDatasets > 0) list = list.filter((g) => g.datasetsFound >= minDatasets);
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      list = list.filter((g) => g.gene.toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      const diff = (a[sortKey] as number) - (b[sortKey] as number);
      return sortAsc ? diff : -diff;
    });
    return list;
  }, [data, typeFilter, minDatasets, searchTerm, sortKey, sortAsc]);

  const categoryChartData = data
    ? [
        { name: "Clock", volatility: Number(data.clockVolatility?.toFixed(4) ?? 0), fill: "#3b82f6" },
        { name: "Target", volatility: Number(data.targetVolatility?.toFixed(4) ?? 0), fill: "#f59e0b" },
        { name: "Other", volatility: Number(data.otherVolatility?.toFixed(4) ?? 0), fill: "#64748b" },
      ]
    : [];

  const topGene = data?.topVolatile?.[0];

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <th
      className="px-3 py-2 text-slate-500 font-medium cursor-pointer hover:text-slate-800 select-none"
      onClick={() => handleSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown className="h-3 w-3" />
      </span>
    </th>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 text-slate-900" data-testid="page-volatile-genes">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-700" data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/20">
              <Flame className="h-6 w-6 text-orange-400" />
            </div>
            <h1 className="text-2xl font-bold" data-testid="heading-title">Most Volatile Genes</h1>
            <p className="text-sm text-slate-500 mt-1">Cross-dataset eigenvalue variance ranking</p>
            <div className="rounded-lg bg-slate-100 border border-slate-200 p-4 mt-3">
              <p className="text-sm text-slate-600 leading-relaxed">
                <strong className="text-slate-900">What you can do:</strong> These genes show the largest variation in AR(2) eigenvalue across datasets, meaning their computed persistence score differs depending on the dataset analyzed. Download the rankings to examine which genes have the most variable eigenvalue estimates.
              </p>
            </div>
          </div>
          {data?.topVolatile && (
            <DownloadResultsButton
              data={data.topVolatile.map(g => ({
                gene: g.gene,
                geneType: g.geneType,
                datasetsFound: g.datasetsFound,
                meanEigenvalue: g.meanEigenvalue,
                eigenvalueRange: g.eigenvalueRange,
                eigenvalueStdDev: g.eigenvalueStdDev,
                volatilityScore: g.volatilityScore,
                interpretation: g.interpretation,
              }))}
              filename="PAR2_VolatileGenes_Results.csv"
            />
          )}
        </div>

        <HowTo
          title="Understanding Gene Volatility"
          summary="Volatility measures how much a gene's eigenvalue (|λ|) changes across different datasets and conditions. Genes with high volatility show dramatically different temporal dynamics depending on tissue, species, or perturbation — making them candidates for studying condition-dependent circadian dynamics."
          steps={[
            { label: "Volatility Score", detail: "Combines eigenvalue range, standard deviation, and dataset coverage into a single ranking metric." },
            { label: "Filter & Sort", detail: "Use the controls to filter by gene type, minimum dataset count, or search for specific genes." },
            { label: "Expand Rows", detail: "Click any gene row to see its per-dataset eigenvalue breakdown as a bar chart." },
          ]}
        />

        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
            <span className="ml-3 text-slate-500 text-lg">Loading volatile genes analysis...</span>
          </div>
        )}

        {error && (
          <Card className="bg-red-900/20 border-red-700/50">
            <CardContent className="pt-4">
              <p className="text-red-400" data-testid="text-error">Error: {(error as Error).message}</p>
            </CardContent>
          </Card>
        )}

        {data && !isLoading && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="summary-cards">
              <Card className="bg-white border-slate-200">
                <CardContent className="pt-4">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Total Genes Analyzed</p>
                  <p className="text-2xl font-bold text-slate-900 font-mono mt-1" data-testid="text-total-genes">{data.totalGenesAcross}</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-slate-200">
                <CardContent className="pt-4">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Datasets Used</p>
                  <p className="text-2xl font-bold text-slate-900 font-mono mt-1" data-testid="text-total-datasets">{data.totalDatasetsUsed}</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-slate-200">
                <CardContent className="pt-4">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Top Volatile Gene</p>
                  <p className="text-lg font-bold text-orange-400 font-mono mt-1" data-testid="text-top-gene">
                    {topGene?.gene ?? "—"}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Score: <span className="text-slate-900 font-mono" data-testid="text-top-score">{topGene?.volatilityScore?.toFixed(4) ?? "—"}</span>
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-white border-slate-200">
                <CardContent className="pt-4">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Category Volatility</p>
                  <div className="flex items-center gap-3 mt-1 text-xs" data-testid="text-category-comparison">
                    <span className="text-blue-400">Clock: <span className="font-mono">{data.clockVolatility?.toFixed(3) ?? "—"}</span></span>
                    <span className="text-amber-400">Target: <span className="font-mono">{data.targetVolatility?.toFixed(3) ?? "—"}</span></span>
                    <span className="text-slate-500">Other: <span className="font-mono">{data.otherVolatility?.toFixed(3) ?? "—"}</span></span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-white border-slate-200">
              <CardHeader>
                <CardTitle className="text-slate-900 text-sm">Category Volatility Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[180px]" data-testid="chart-category-volatility">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryChartData} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 12 }} />
                      <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #475569", borderRadius: "8px" }}
                        labelStyle={{ color: "#334155" }}
                      />
                      <Bar dataKey="volatility" name="Mean Volatility">
                        {categoryChartData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-wrap items-center gap-3" data-testid="filter-controls">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search gene name..."
                  className="bg-slate-50 border-slate-300 text-slate-900 pl-9 w-56"
                  data-testid="input-search-gene"
                />
              </div>
              <div className="flex gap-1">
                {(["all", "clock", "target", "other"] as const).map((t) => (
                  <Button
                    key={t}
                    variant={typeFilter === t ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTypeFilter(t)}
                    className={typeFilter === t ? "" : "text-slate-500 border-slate-300 hover:text-slate-700"}
                    data-testid={`button-filter-${t}`}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Button>
                ))}
              </div>
              <select
                value={minDatasets}
                onChange={(e) => setMinDatasets(Number(e.target.value))}
                className="bg-slate-100 border border-slate-300 text-slate-900 text-sm rounded-md px-3 py-1.5"
                data-testid="select-min-datasets"
              >
                <option value={3}>≥ 3 datasets</option>
                <option value={5}>≥ 5 datasets</option>
                <option value={8}>≥ 8 datasets</option>
              </select>
              <span className="text-xs text-slate-500" data-testid="text-result-count">
                {filtered.length} gene{filtered.length !== 1 ? "s" : ""}
              </span>
            </div>

            <Card className="bg-white border-slate-200">
              <CardContent className="pt-4 overflow-x-auto">
                <table className="w-full text-sm text-left" data-testid="table-volatile-genes">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="px-3 py-2 text-slate-500 font-medium">#</th>
                      <th className="px-3 py-2 text-slate-500 font-medium">Gene</th>
                      <th className="px-3 py-2 text-slate-500 font-medium">Type</th>
                      <SortHeader label="Datasets" field="datasetsFound" />
                      <SortHeader label="Mean |λ|" field="meanEigenvalue" />
                      <SortHeader label="Range" field="eigenvalueRange" />
                      <SortHeader label="Std Dev" field="eigenvalueStdDev" />
                      <SortHeader label="Volatility" field="volatilityScore" />
                      <th className="px-3 py-2 text-slate-500 font-medium">Sparkline</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((gene, idx) => {
                      const badge = TYPE_BADGE[gene.geneType] || TYPE_BADGE.other;
                      const isExpanded = expandedGene === gene.gene;
                      return (
                        <React.Fragment key={gene.gene}>
                          <tr
                            className="border-b border-slate-200 hover:bg-slate-100 cursor-pointer transition-colors"
                            onClick={() => setExpandedGene(isExpanded ? null : gene.gene)}
                            data-testid={`row-gene-${gene.gene}`}
                          >
                            <td className="px-3 py-2 text-slate-500 font-mono text-xs">{idx + 1}</td>
                            <td className="px-3 py-2 text-slate-900 font-bold font-mono flex items-center gap-1.5">
                              <GeneTooltip gene={gene.gene}>{gene.gene}</GeneTooltip>
                              {isExpanded ? <ChevronUp className="h-3 w-3 text-slate-500" /> : <ChevronDown className="h-3 w-3 text-slate-500" />}
                            </td>
                            <td className="px-3 py-2">
                              <Badge className={`${badge.bg} ${badge.text} border ${badge.border} text-xs`} data-testid={`badge-type-${gene.gene}`}>
                                {gene.geneType}
                              </Badge>
                            </td>
                            <td className="px-3 py-2 text-slate-900 font-mono">{gene.datasetsFound}</td>
                            <td className="px-3 py-2 text-slate-900 font-mono">{gene.meanEigenvalue?.toFixed(4)}</td>
                            <td className="px-3 py-2 text-slate-900 font-mono">{gene.eigenvalueRange?.toFixed(4)}</td>
                            <td className="px-3 py-2 text-slate-900 font-mono">{gene.eigenvalueStdDev?.toFixed(4)}</td>
                            <td className="px-3 py-2 text-orange-400 font-mono font-semibold">{gene.volatilityScore?.toFixed(4)}</td>
                            <td className="px-3 py-2">
                              <MiniSparkline eigenvalues={gene.eigenvalues} />
                            </td>
                          </tr>
                          {isExpanded && <ExpandedDetail gene={gene} />}
                        </React.Fragment>
                      );
                    })}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-3 py-8 text-center text-slate-500" data-testid="text-no-results">
                          No genes match the current filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <InsightCallout variant="info" title="Interpreting Volatility">
              High-volatility genes are those whose temporal dynamics change dramatically between conditions — making them candidates for studying context-dependent circadian regulation. Clock genes with high volatility may indicate tissue-specific regulation, while target genes with high volatility suggest condition-dependent persistence.
            </InsightCallout>
            <div className="flex items-center gap-2 flex-wrap mt-2">
              <EvidenceLink label="Genome-wide screen" to="/genome-wide" hash="screen-results" />
              <EvidenceLink label="Root-space geometry" to="/root-space" hash="perturbation-shifts" />
              <EvidenceLink label="AR(1) benchmark & controls" to="/supplementary-analyses" />
            </div>

            <ViewInRootSpace className="mt-2" />
          </>
        )}
      </div>
    </div>
  );
}
