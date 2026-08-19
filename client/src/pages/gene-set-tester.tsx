import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  ArrowLeft, FlaskConical, Beaker, Loader2, AlertCircle,
  ChevronDown, ChevronUp, ArrowUpRight, ArrowDownRight, Minus, Zap, Download,
} from "lucide-react";
import HowTo from "@/components/HowTo";
import InsightCallout from "@/components/InsightCallout";
import DownloadResultsButton, { downloadAsCSV } from "@/components/DownloadResultsButton";
import GeneTooltip from "@/components/GeneTooltip";

interface MatchedGene {
  gene: string;
  eigenvalue: number;
  phi1: number;
  phi2: number;
  r2: number;
  geneType: string;
}

interface GeneSetTestResult {
  datasetId: string;
  datasetName: string;
  queryGenes: string[];
  matchedGenes: MatchedGene[];
  unmatchedGenes: string[];
  setMeanEigenvalue: number;
  setMedianEigenvalue: number;
  genomeMeanEigenvalue: number;
  genomeMedianEigenvalue: number;
  permutationPValue: number;
  nPermutations: number;
  effectSize: number;
  direction: "higher" | "lower" | "similar";
  interpretation: string;
  histogram: { bin: number; genomeCount: number; setCount: number }[];
}

type SortKey = "gene" | "eigenvalue" | "r2" | "phi1" | "phi2" | "geneType";
type SortDir = "asc" | "desc";

const PRESET_GENE_SETS: Record<string, { label: string; color: string; genes: string[] }> = {
  clock: {
    label: "Core Clock Genes",
    color: "border-cyan-600/50 text-cyan-400 hover:bg-cyan-900/30",
    genes: ["ARNTL", "CLOCK", "PER1", "PER2", "PER3", "CRY1", "CRY2", "NR1D1", "NR1D2", "RORA", "RORB", "RORC", "NPAS2", "BMAL1", "DBP", "TEF", "HLF", "NFIL3", "CSNK1D", "CSNK1E"],
  },
  oncogenes: {
    label: "Oncogenes",
    color: "border-red-600/50 text-red-400 hover:bg-red-900/30",
    genes: ["MYC", "KRAS", "HRAS", "NRAS", "BRAF", "PIK3CA", "AKT1", "EGFR", "ERBB2", "ABL1", "SRC", "RAF1", "CCND1", "CDK4", "CDK6", "MDM2", "JUN", "FOS", "MET", "RET"],
  },
  tumorSuppressors: {
    label: "Tumor Suppressors",
    color: "border-blue-600/50 text-blue-400 hover:bg-blue-900/30",
    genes: ["TP53", "RB1", "BRCA1", "BRCA2", "APC", "PTEN", "VHL", "WT1", "NF1", "NF2", "CDKN2A", "CDKN1A", "SMAD4", "STK11", "TSC1", "TSC2", "MLH1", "MSH2", "ATM", "CHEK2"],
  },
  housekeeping: {
    label: "Housekeeping",
    color: "border-slate-300/50 text-slate-600 hover:bg-slate-100",
    genes: ["GAPDH", "ACTB", "TUBB", "RPL13A", "RPS18", "B2M", "HPRT1", "UBC", "YWHAZ", "SDHA", "TBP", "HMBS", "PPIA", "GUSB", "TFRC", "PGK1", "RPLP0", "RPL19", "EEF1A1", "HSP90AB1"],
  },
  cellCycle: {
    label: "Cell Cycle",
    color: "border-purple-600/50 text-purple-400 hover:bg-purple-900/30",
    genes: ["CDK1", "CDK2", "CCNA2", "CCNB1", "CCNE1", "CDC20", "CDC25A", "CDC25C", "PLK1", "AURKA", "AURKB", "BUB1", "MAD2L1", "PCNA", "MCM2", "MCM6", "E2F1", "RB1", "CDKN1A", "CDKN1B"],
  },
  apoptosis: {
    label: "Apoptosis",
    color: "border-amber-600/50 text-amber-400 hover:bg-amber-900/30",
    genes: ["BCL2", "BAX", "BAK1", "BID", "BAD", "BCL2L1", "MCL1", "CASP3", "CASP8", "CASP9", "CYCS", "APAF1", "XIAP", "BIRC5", "FAS", "FASLG", "TNFRSF10A", "TNFRSF10B", "DIABLO", "PARP1"],
  },
};

function parseGenes(input: string): string[] {
  const tokens = input.split(/[\n,\s\t]+/).map((s) => s.trim().toUpperCase()).filter(Boolean);
  return Array.from(new Set(tokens));
}

export default function GeneSetTester() {
  const [datasetId, setDatasetId] = useState("");
  const [geneInput, setGeneInput] = useState("");
  const [unmatchedOpen, setUnmatchedOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("eigenvalue");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const parsedGenes = useMemo(() => parseGenes(geneInput), [geneInput]);

  const datasetsQuery = useQuery<{ id: string; name: string }[]>({
    queryKey: ["available-datasets"],
    queryFn: async () => {
      const res = await fetch("/api/processed-tables/available");
      if (!res.ok) throw new Error("Failed to load datasets");
      return res.json();
    },
  });

  const mutation = useMutation<GeneSetTestResult, Error, { datasetId: string; genes: string[] }>({
    mutationFn: async (params) => {
      const res = await fetch("/api/analysis/gene-set-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const result = mutation.data;

  const sortedGenes = useMemo(() => {
    if (!result) return [];
    return [...result.matchedGenes].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
  }, [result, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const handleSubmit = () => {
    if (!datasetId || parsedGenes.length === 0) return;
    mutation.mutate({ datasetId, genes: parsedGenes });
  };

  const directionConfig = {
    higher: { label: "Higher Persistence", icon: ArrowUpRight, color: "text-red-400", bg: "bg-red-500/20 border-red-500/30" },
    lower: { label: "Lower Persistence", icon: ArrowDownRight, color: "text-blue-400", bg: "bg-blue-500/20 border-blue-500/30" },
    similar: { label: "Similar to Background", icon: Minus, color: "text-slate-500", bg: "bg-slate-500/20 border-slate-300/30" },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 text-slate-900">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/">
            <Button variant="outline" size="sm" className="gap-2 border-slate-200 text-slate-600 hover:bg-slate-100" data-testid="link-back-home">
              <ArrowLeft size={14} />
              Home
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent flex items-center gap-2" data-testid="text-page-title">
              <FlaskConical size={24} className="text-cyan-400" />
              Gene Set Hypothesis Tester
            </h1>
            <p className="text-sm text-slate-500 mt-1">Test whether a custom gene set has significantly different AR(2) eigenvalues</p>
            <div className="rounded-lg bg-slate-100 border border-slate-200 p-4 mt-3">
              <p className="text-sm text-slate-600 leading-relaxed">
                <strong className="text-slate-900">What you can do:</strong> Enter a list of gene names and run a permutation test (5,000 permutations) to see if your gene set has significantly different persistence compared to random genes. Results include Cohen's d effect size and p-value. Download the matched results for your analysis.
              </p>
            </div>
          </div>
          <Badge variant="outline" className="border-cyan-600/50 text-cyan-400">
            <Beaker size={12} className="mr-1" /> Hypothesis Test
          </Badge>
          {result && (
            <DownloadResultsButton
              data={result.matchedGenes.map(g => ({
                gene: g.gene,
                eigenvalue: g.eigenvalue,
                phi1: g.phi1,
                phi2: g.phi2,
                r2: g.r2,
                geneType: g.geneType,
              }))}
              filename="PAR2_GeneSetTest_Results.csv"
            />
          )}
        </div>

        <HowTo
          title="Gene Set Hypothesis Tester"
          summary="Paste a list of gene symbols from your experiment. The engine tests whether your genes have systematically different temporal persistence compared to the full genome."
          steps={[
            { label: "Select a dataset", detail: "Choose one of the pre-processed genome-wide datasets from the dropdown." },
            { label: "Paste your genes", detail: "Enter gene symbols separated by newlines, commas, spaces, or tabs." },
            { label: "Run the test", detail: "The engine compares your gene set's eigenvalue distribution against the genome background using permutation testing." },
            { label: "Interpret results", detail: "Review p-value, effect size, and the histogram to see if your genes differ from background." },
          ]}
        />

        <Card className="bg-white border-slate-200 mb-6" data-testid="card-input-form">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Beaker size={18} className="text-cyan-400" />
              Configure Gene Set Test
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-600 mb-1.5 block">Dataset</label>
              <Select value={datasetId} onValueChange={setDatasetId} data-testid="select-dataset">
                <SelectTrigger className="bg-slate-100 border-slate-200 text-slate-900" data-testid="select-dataset-trigger">
                  <SelectValue placeholder="Select a dataset..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-100 border-slate-200">
                  {datasetsQuery.data?.map((ds) => (
                    <SelectItem key={ds.id} value={ds.id} data-testid={`select-dataset-item-${ds.id}`}>
                      {ds.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-600 mb-1.5 block">Gene Symbols</label>
              <Textarea
                rows={8}
                value={geneInput}
                onChange={(e) => setGeneInput(e.target.value)}
                placeholder={"Paste gene symbols, one per line or comma-separated\n\nExample:\nMYC\nCCND1\nTP53\nBCL2\nCDK1"}
                className="bg-slate-100 border-slate-200 text-slate-900 font-mono text-sm"
                data-testid="textarea-genes"
              />
              <p className="text-xs text-slate-500 mt-1.5" data-testid="text-parsed-count">
                {parsedGenes.length > 0
                  ? `${parsedGenes.length} unique gene${parsedGenes.length !== 1 ? "s" : ""} parsed`
                  : "No genes entered"}
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-600 mb-1.5 block flex items-center gap-1.5">
                <Zap size={14} className="text-amber-400" />
                Quick-Load Preset Gene Sets
              </label>
              <div className="flex flex-wrap gap-2" data-testid="preset-gene-sets">
                {Object.entries(PRESET_GENE_SETS).map(([key, preset]) => (
                  <Button
                    key={key}
                    variant="outline"
                    size="sm"
                    className={`text-xs ${preset.color}`}
                    onClick={() => setGeneInput(preset.genes.join("\n"))}
                    data-testid={`button-preset-${key}`}
                  >
                    {preset.label} ({preset.genes.length})
                  </Button>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-1">Click a preset to populate the gene list, or type your own above</p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                onClick={handleSubmit}
                disabled={!datasetId || parsedGenes.length === 0 || mutation.isPending}
                className="gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-slate-900 px-6"
                data-testid="button-submit"
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Beaker size={16} />
                    Test Gene Set
                  </>
                )}
              </Button>
            </div>

            {mutation.isError && (
              <div className="flex items-center gap-2 text-red-400 text-sm mt-2" data-testid="text-error">
                <AlertCircle size={14} />
                {mutation.error?.message || "An error occurred"}
              </div>
            )}
          </CardContent>
        </Card>

        {result && (
          <div className="space-y-6" data-testid="results-section">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="summary-cards">
              <Card className="bg-white border-slate-200">
                <CardContent className="pt-4 pb-3 px-4">
                  <p className="text-xs text-slate-500 mb-1">Matched / Unmatched</p>
                  <p className="text-2xl font-bold text-slate-900" data-testid="text-matched-count">
                    {result.matchedGenes.length}
                    <span className="text-sm text-slate-500 font-normal ml-1">/ {result.unmatchedGenes.length}</span>
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-white border-slate-200">
                <CardContent className="pt-4 pb-3 px-4">
                  <p className="text-xs text-slate-500 mb-1">Set Mean vs Genome Mean</p>
                  <p className="text-2xl font-bold text-slate-900" data-testid="text-mean-comparison">
                    {result.setMeanEigenvalue.toFixed(3)}
                    <span className="text-sm text-slate-500 font-normal ml-1">vs {result.genomeMeanEigenvalue.toFixed(3)}</span>
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-white border-slate-200">
                <CardContent className="pt-4 pb-3 px-4">
                  <p className="text-xs text-slate-500 mb-1">Permutation P-value</p>
                  <p className={`text-2xl font-bold ${result.permutationPValue < 0.05 ? "text-green-400" : "text-slate-600"}`} data-testid="text-pvalue">
                    {result.permutationPValue < 0.001 ? "<0.001" : result.permutationPValue.toFixed(3)}
                  </p>
                  <p className="text-[10px] text-slate-500">{result.nPermutations.toLocaleString()} permutations</p>
                </CardContent>
              </Card>

              <Card className="bg-white border-slate-200">
                <CardContent className="pt-4 pb-3 px-4">
                  <p className="text-xs text-slate-500 mb-1">Effect Size (Cohen's d)</p>
                  <p className="text-2xl font-bold text-slate-900" data-testid="text-effect-size">
                    {result.effectSize.toFixed(3)}
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="flex justify-center">
              {(() => {
                const cfg = directionConfig[result.direction];
                const Icon = cfg.icon;
                return (
                  <Badge className={`text-lg px-6 py-2 ${cfg.bg} ${cfg.color}`} data-testid="badge-direction">
                    <Icon size={18} className="mr-2" />
                    {cfg.label}
                  </Badge>
                );
              })()}
            </div>

            <Card className="bg-slate-50 border-slate-200" data-testid="card-null-baseline">
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-xs text-slate-500 font-semibold mb-2">Null Baseline: What Random Gene Sets Produce</p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  When {result.matchedGenes.length} genes are drawn at random from this genome, the expected mean |λ| is approximately {result.genomeMeanEigenvalue.toFixed(3)} ± ~0.02 (based on {result.nPermutations.toLocaleString()} permutations). A significant p-value means your gene set deviates from this null — but small gene sets ({"<"}20 genes) can produce significant results by chance more often than expected. Effect size (Cohen's d) is more informative than p-value for small sets.
                </p>
                {result.matchedGenes.length < 20 && (
                  <p className="text-xs text-amber-400 mt-2">
                    Your set has {result.matchedGenes.length} matched genes — interpret statistical significance with extra caution at this sample size.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200" data-testid="card-histogram">
              <CardHeader>
                <CardTitle className="text-sm text-slate-600">Eigenvalue Distribution: Genome vs Gene Set</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300} minWidth={1} minHeight={1}>
                  <BarChart data={result.histogram} margin={{ top: 10, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis
                      dataKey="bin"
                      tick={{ fill: "#64748b", fontSize: 11 }}
                      label={{ value: "Eigenvalue Bin", position: "bottom", fill: "#64748b", fontSize: 12 }}
                      tickFormatter={(v: number) => v.toFixed(2)}
                    />
                    <YAxis tick={{ fill: "#64748b", fontSize: 11 }} label={{ value: "Count", angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px", fontSize: "12px" }}
                      labelFormatter={(v: number) => `Bin: ${Number(v).toFixed(3)}`}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px", color: "#94a3b8" }} />
                    <Bar dataKey="genomeCount" name="Genome" fill="#94a3b8" opacity={0.7} />
                    <Bar dataKey="setCount" name="Gene Set" fill="#22d3ee" opacity={0.9} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200" data-testid="card-matched-genes">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm text-slate-600">
                    Matched Genes ({result.matchedGenes.length})
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-slate-600 border-slate-300 text-xs"
                    onClick={() => downloadAsCSV(
                      result.matchedGenes.map(g => ({
                        dataset: result.datasetName,
                        gene: g.gene,
                        gene_type: g.geneType,
                        eigenvalue: g.eigenvalue,
                        phi1: g.phi1,
                        phi2: g.phi2,
                        r2: g.r2,
                        set_mean_eigenvalue: result.setMeanEigenvalue,
                        genome_mean_eigenvalue: result.genomeMeanEigenvalue,
                        permutation_p_value: result.permutationPValue,
                        effect_size_cohens_d: result.effectSize,
                        direction: result.direction,
                      })),
                      `gene_set_results_${result.datasetId}.csv`
                    )}
                    data-testid="button-download-gene-set-csv"
                  >
                    <Download size={13} className="mr-1" /> Download CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="table-matched-genes">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        {(
                          [
                            ["gene", "Gene"],
                            ["eigenvalue", "Eigenvalue"],
                            ["r2", "R\u00B2"],
                            ["phi1", "\u03C61"],
                            ["phi2", "\u03C62"],
                            ["geneType", "Type"],
                          ] as [SortKey, string][]
                        ).map(([key, label]) => (
                          <th
                            key={key}
                            className="py-2 px-3 text-left cursor-pointer hover:text-slate-700 select-none"
                            onClick={() => handleSort(key)}
                            data-testid={`th-sort-${key}`}
                          >
                            {label}
                            {sortKey === key && (
                              <span className="ml-1 text-cyan-400">{sortDir === "asc" ? "\u25B2" : "\u25BC"}</span>
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedGenes.map((g) => (
                        <tr key={g.gene} className="border-b border-slate-200 hover:bg-slate-50" data-testid={`row-gene-${g.gene}`}>
                          <td className="py-2 px-3 font-mono font-medium text-cyan-300"><GeneTooltip gene={g.gene}>{g.gene}</GeneTooltip></td>
                          <td className="py-2 px-3">{g.eigenvalue.toFixed(4)}</td>
                          <td className="py-2 px-3">{g.r2.toFixed(3)}</td>
                          <td className="py-2 px-3">{g.phi1.toFixed(4)}</td>
                          <td className="py-2 px-3">{g.phi2.toFixed(4)}</td>
                          <td className="py-2 px-3">
                            <Badge variant="outline" className="text-xs border-slate-300 text-slate-600">{g.geneType}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {result.unmatchedGenes.length > 0 && (
              <Card className="bg-white border-slate-200" data-testid="card-unmatched-genes">
                <CardContent className="pt-4">
                  <button
                    onClick={() => setUnmatchedOpen(!unmatchedOpen)}
                    className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 cursor-pointer w-full"
                    data-testid="button-toggle-unmatched"
                  >
                    {unmatchedOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    <span>Unmatched Genes ({result.unmatchedGenes.length})</span>
                  </button>
                  {unmatchedOpen && (
                    <div className="mt-3 flex flex-wrap gap-2" data-testid="list-unmatched-genes">
                      {result.unmatchedGenes.map((g) => (
                        <Badge key={g} variant="outline" className="text-xs border-slate-300 text-slate-500 font-mono" data-testid={`badge-unmatched-${g}`}>
                          {g}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card className="bg-white border-slate-200" data-testid="card-interpretation">
              <CardContent className="pt-4">
                <p className="text-sm text-slate-600 leading-relaxed" data-testid="text-interpretation">
                  {result.interpretation}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="mt-6">
          <InsightCallout title="How Permutation Testing Works">
            This test uses permutation analysis — randomly sampling gene sets of the same size from the genome to determine if your genes' eigenvalue profile is unusual. A p-value &lt; 0.05 suggests your gene set has systematically different temporal dynamics.
          </InsightCallout>
        </div>
      </div>
    </div>
  );
}
