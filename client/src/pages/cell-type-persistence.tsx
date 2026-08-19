import { useQuery } from "@tanstack/react-query";
import { useScrollToHash } from "@/hooks/useScrollToHash";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, ReferenceLine, Legend, ScatterChart, Scatter, ZAxis
} from "recharts";
import {
  ArrowLeft, Loader2, Layers, TrendingUp, ShieldCheck,
  ChevronDown, ChevronUp, Dna, Target, Clock, AlertTriangle,
  CheckCircle2, XCircle, Beaker, Activity, Search
} from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import HowTo from "@/components/HowTo";
import PaperCrossLinks from "@/components/PaperCrossLinks";
import InsightCallout from "@/components/InsightCallout";
import ViewInRootSpace from "@/components/ViewInRootSpace";
import DownloadResultsButton, { downloadAsCSV } from "@/components/DownloadResultsButton";
import GeneTooltipPopover from "@/components/GeneTooltip";

interface GeneResult {
  gene: string;
  ensemblId: string | null;
  cellType: string;
  cellTypeCategory: string;
  eigenvalue: number;
  phi1: number;
  phi2: number;
  r2: number;
  meanExpression: number;
  nTimepoints: number;
  isComplex: boolean;
}

interface CellTypeRanking {
  cellType: string;
  meanEigenvalue: number;
  meanR2: number;
  nGenes: number;
  genes: GeneResult[];
  vsClockDrift: number;
}

interface CancerDriftResult {
  gene: string;
  cellType: string;
  wtEigenvalue: number;
  cancerEigenvalue: number;
  drift: number;
  wtR2: number;
  cancerR2: number;
}

interface CellTypeDriftSummary {
  cellType: string;
  meanWtEigenvalue: number;
  meanCancerEigenvalue: number;
  meanDrift: number;
  nGenes: number;
  genes: CancerDriftResult[];
}

interface ThreeLayerHierarchy {
  layer1_identity: { label: string; meanEigenvalue: number; range: string; cellTypes: string[] };
  layer2_clock: { label: string; meanEigenvalue: number; range: string; genes: string[] };
  layer3_proliferation: { label: string; meanEigenvalue: number; range: string; genes: string[] };
  interpretation: string;
}

interface BomanFinding {
  finding: string;
  confirmed: boolean;
  quantitativeEvidence: string;
  novelInsight: string;
}

interface CellTypePersistenceData {
  dataset: string;
  datasetId: string;
  nTimepoints: number;
  nGenesTotal: number;
  nMarkersFound: number;
  nMarkersMissing: number;
  missingMarkers: string[];
  perGeneResults: GeneResult[];
  cellTypeRanking: CellTypeRanking[];
  clockBaseline: number;
  cancerComparison: {
    available: boolean;
    dataset: string;
    perGeneDrift: CancerDriftResult[];
    cellTypeDrift: CellTypeDriftSummary[];
  };
  threeLayerHierarchy: ThreeLayerHierarchy;
  bomanFindings: BomanFinding[];
}

const CELL_TYPE_COLORS: Record<string, string> = {
  'Core Clock': '#f59e0b',
  'Stem Cells': '#10b981',
  'Transit-Amplifying': '#6366f1',
  'Goblet Cells': '#ec4899',
  'Paneth-like Cells': '#8b5cf6',
  'M Cells': '#06b6d4',
  'Tuft Cells': '#ef4444',
  'Enteroendocrine': '#f97316',
  'Colonocytes': '#14b8a6',
  'Proliferation': '#64748b',
  'Tumor Suppressors': '#78716c',
  'Wnt Targets': '#a855f7',
};

const LAYER_COLORS = {
  identity: '#ef4444',
  clock: '#f59e0b',
  proliferation: '#3b82f6',
};

function CustomBarTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xl text-sm max-w-xs">
      <p className="font-bold text-slate-900">{d.cellType}</p>
      <p className="text-blue-300">Mean |λ| = {d.meanEigenvalue?.toFixed(4)}</p>
      <p className="text-slate-600">Mean R² = {d.meanR2?.toFixed(3)}</p>
      <p className="text-slate-500">vs Clock: {d.vsClockDrift > 0 ? '+' : ''}{d.vsClockDrift?.toFixed(4)}</p>
      <p className="text-slate-500">{d.nGenes} marker gene{d.nGenes > 1 ? 's' : ''}</p>
      {d.genes && (
        <div className="mt-1 text-xs text-slate-500">
          {d.genes.map((g: GeneResult) => `${g.gene}(${g.eigenvalue.toFixed(3)})`).join(', ')}
        </div>
      )}
    </div>
  );
}

function DriftTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xl text-sm">
      <p className="font-bold text-slate-900">{d.cellType}</p>
      <p className="text-green-300">WT |λ| = {d.meanWtEigenvalue?.toFixed(4)}</p>
      <p className="text-red-300">APC-KO |λ| = {d.meanCancerEigenvalue?.toFixed(4)}</p>
      <p className={d.meanDrift < 0 ? "text-red-400" : "text-green-400"}>
        Drift = {d.meanDrift > 0 ? '+' : ''}{d.meanDrift?.toFixed(4)}
      </p>
      <p className="text-slate-500">{d.nGenes} gene{d.nGenes > 1 ? 's' : ''}</p>
    </div>
  );
}

function GeneTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xl text-sm">
      <p className="font-bold text-slate-900">{d.gene}</p>
      <p className="text-slate-600">{d.cellTypeCategory}</p>
      <p className="text-blue-300">|λ| = {d.eigenvalue?.toFixed(4)}</p>
      <p className="text-slate-600">R² = {d.r2?.toFixed(3)}</p>
      <p className="text-slate-500">φ₁ = {d.phi1?.toFixed(3)}, φ₂ = {d.phi2?.toFixed(3)}</p>
    </div>
  );
}

export default function CellTypePersistence() {
  useScrollToHash();
  const [showAllGenes, setShowAllGenes] = useState(false);
  const [expandedFindings, setExpandedFindings] = useState<Set<number>>(new Set());
  const [compareType1, setCompareType1] = useState<string>("");
  const [compareType2, setCompareType2] = useState<string>("");
  const [hoveredGene, setHoveredGene] = useState<GeneResult | null>(null);
  const [geneSearch, setGeneSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const { data, isLoading, error } = useQuery<CellTypePersistenceData>({
    queryKey: ["/api/analysis/cell-type-persistence"],
    staleTime: 1000 * 60 * 30,
  });

  const toggleFinding = (idx: number) => {
    setExpandedFindings(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-blue-400" />
          <p className="text-lg text-slate-600">Running AR(2) analysis across 41 cell-type markers...</p>
          <p className="text-sm text-slate-500 mt-2">Hughes 48h + Organoid WT vs APC-KO comparison</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 p-8">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Analysis Error</AlertTitle>
          <AlertDescription>{(error as any)?.message || "Failed to load cell-type persistence data"}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const rankingData = data.cellTypeRanking.map(r => ({
    ...r,
    genes: r.genes,
  }));

  const perGeneData = data.perGeneResults.map(g => ({
    ...g,
    color: CELL_TYPE_COLORS[g.cellTypeCategory] || '#94a3b8',
  }));

  const uniqueCategories = Array.from(new Set(data.perGeneResults.map(g => g.cellTypeCategory))).sort();

  const filteredGeneData = perGeneData.filter(g => {
    const matchesSearch = geneSearch === "" || g.gene.toLowerCase().includes(geneSearch.toLowerCase());
    const matchesCategory = categoryFilter === "all" || g.cellTypeCategory === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const isFiltered = geneSearch !== "" || categoryFilter !== "all";

  const h = data.threeLayerHierarchy;

  return (
    <div id="three-layer" className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <Link href="/">
            <Button variant="ghost" className="text-slate-500 hover:text-slate-700 mb-4" data-testid="link-back-home">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <Layers className="h-8 w-8 text-red-400" />
            <h1 className="text-3xl font-bold" data-testid="text-page-title">Cell-Type Persistence Map</h1>
            <Badge className="bg-red-500/20 text-red-300 border-red-500/30">New Discovery</Badge>
            <div className="ml-auto">
              <DownloadResultsButton
                data={data.perGeneResults.map(g => ({
                  gene: g.gene,
                  ensemblId: g.ensemblId,
                  cellType: g.cellType,
                  cellTypeCategory: g.cellTypeCategory,
                  eigenvalue: g.eigenvalue,
                  phi1: g.phi1,
                  phi2: g.phi2,
                  r2: g.r2,
                  meanExpression: g.meanExpression,
                  isComplex: g.isComplex,
                }))}
                filename="PAR2_CellTypePersistence_Results.csv"
              />
            </div>
          </div>
          <div className="rounded-lg bg-slate-100 border border-slate-200 p-4 mt-3">
            <p className="text-sm text-slate-600 leading-relaxed">
              <strong className="text-slate-900">What you can do:</strong> Compares computed AR(2) eigenvalues across cell-type marker genes, from stem cell markers to differentiated cell markers. Download the cell-type eigenvalue results for your own analysis and interpretation.
            </p>
          </div>
          <p className="text-slate-500 text-lg max-w-4xl">
            AR(2) eigenvalue analysis across all colonic crypt cell-type markers from
            Nguyen, Lausten &amp; Boman (<em>Cells</em>, Sept 2025). Reveals a three-layer temporal hierarchy:
            cell identity &gt; circadian clock &gt; proliferation.
          </p>
        </div>

        <PaperCrossLinks currentPage="/cell-type-persistence" />

        <HowTo
          title="Cell-Type Persistence Map"
          summary="Analyzes AR(2) eigenvalues across cell-type marker genes to reveal temporal persistence hierarchies among different cell populations. Cell identity markers are expected to show higher persistence than functional or signaling markers."
          steps={[
            { label: "Browse cell types", detail: "Each row shows a cell-type category with its marker genes and their mean eigenvalue." },
            { label: "Compare persistence", detail: "Identity markers should cluster at higher eigenvalues than transient signaling markers." },
            { label: "Check the hierarchy", detail: "The ranking reveals which cellular identities have the strongest temporal memory." }
          ]}
        />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-white border-slate-200">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-blue-400" data-testid="text-markers-found">{data.nMarkersFound}</p>
              <p className="text-sm text-slate-500">Markers Analyzed</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-slate-200">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-amber-400" data-testid="text-clock-baseline">{data.clockBaseline.toFixed(3)}</p>
              <p className="text-sm text-slate-500">Clock Baseline |λ|</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-slate-200">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-green-400" data-testid="text-timepoints">{data.nTimepoints}</p>
              <p className="text-sm text-slate-500">Timepoints</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-slate-200">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-purple-400" data-testid="text-cell-types">{data.cellTypeRanking.length}</p>
              <p className="text-sm text-slate-500">Cell Type Categories</p>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-white border-slate-200 mb-8">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-red-400" />
              <CardTitle>Three-Layer Temporal Hierarchy</CardTitle>
            </div>
            <CardDescription className="text-slate-500">
              The Gearbox is not two layers — it's three. Cell identity sits above the clock.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4" data-testid="layer-identity">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <h3 className="font-bold text-red-300">Layer 1 — Slowest</h3>
                </div>
                <p className="text-slate-900 font-semibold">{h.layer1_identity.label}</p>
                <p className="text-2xl font-bold text-red-400 mt-1">|λ| = {h.layer1_identity.meanEigenvalue.toFixed(4)}</p>
                <p className="text-sm text-slate-500">Range: {h.layer1_identity.range}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {h.layer1_identity.cellTypes.map(ct => (
                    <Badge key={ct} className="text-xs bg-red-500/20 text-red-300 border-red-500/30">{ct}</Badge>
                  ))}
                </div>
              </div>

              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4" data-testid="layer-clock">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <h3 className="font-bold text-amber-300">Layer 2 — Middle</h3>
                </div>
                <p className="text-slate-900 font-semibold">{h.layer2_clock.label}</p>
                <p className="text-2xl font-bold text-amber-400 mt-1">|λ| = {h.layer2_clock.meanEigenvalue.toFixed(4)}</p>
                <p className="text-sm text-slate-500">Range: {h.layer2_clock.range}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {h.layer2_clock.genes.slice(0, 8).map(g => (
                    <Badge key={g} className="text-xs bg-amber-500/20 text-amber-300 border-amber-500/30">{g}</Badge>
                  ))}
                </div>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4" data-testid="layer-proliferation">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <h3 className="font-bold text-blue-300">Layer 3 — Fastest</h3>
                </div>
                <p className="text-slate-900 font-semibold">{h.layer3_proliferation.label}</p>
                <p className="text-2xl font-bold text-blue-400 mt-1">|λ| = {h.layer3_proliferation.meanEigenvalue.toFixed(4)}</p>
                <p className="text-sm text-slate-500">Range: {h.layer3_proliferation.range}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {h.layer3_proliferation.genes.slice(0, 8).map(g => (
                    <Badge key={g} className="text-xs bg-blue-500/20 text-blue-300 border-blue-500/30">{g}</Badge>
                  ))}
                </div>
              </div>
            </div>

            <Alert className="bg-slate-100 border-slate-200">
              <TrendingUp className="h-4 w-4 text-blue-400" />
              <AlertTitle className="text-slate-900">Key Insight</AlertTitle>
              <AlertDescription className="text-slate-600">{h.interpretation}</AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <div className="mb-8">
          <InsightCallout variant="finding">
            The three-layer hierarchy (Identity &gt; Clock &gt; Proliferation) reveals that cellular identity has stronger temporal memory than the circadian clock itself. This means a cell 'remembers' what type it is more persistently than it tracks time of day.
          </InsightCallout>
        </div>

        <Card className="bg-white border-slate-200 mb-8">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-400" />
              <CardTitle>Cell-Type Persistence Ranking</CardTitle>
            </div>
            <CardDescription className="text-slate-500">
              Mean AR(2) eigenvalue per cell type. Dashed line = clock gene baseline ({data.clockBaseline.toFixed(3)}).
              Data: {data.dataset} ({data.nTimepoints} timepoints, {data.nGenesTotal.toLocaleString()} genes).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[500px]" data-testid="chart-ranking">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rankingData} layout="vertical" margin={{ left: 140, right: 30, top: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
                  <XAxis
                    type="number"
                    domain={[0.5, 1.05]}
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                    label={{ value: 'Mean Eigenvalue |λ|', position: 'bottom', fill: '#6b7280', fontSize: 13 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="cellType"
                    tick={{ fill: '#d1d5db', fontSize: 12 }}
                    width={130}
                  />
                  <Tooltip content={<CustomBarTooltip />} />
                  <ReferenceLine x={data.clockBaseline} stroke="#f59e0b" strokeDasharray="5 5" strokeWidth={2}
                    label={{ value: `Clock baseline (${data.clockBaseline.toFixed(3)})`, fill: '#f59e0b', fontSize: 11, position: 'top' }}
                  />
                  <ReferenceLine x={1.0} stroke="#ef4444" strokeDasharray="3 3" strokeWidth={1}
                    label={{ value: 'Unit root', fill: '#ef4444', fontSize: 10, position: 'top' }}
                  />
                  <Bar dataKey="meanEigenvalue" radius={[0, 4, 4, 0]}>
                    {rankingData.map((entry, index) => (
                      <Cell key={index} fill={CELL_TYPE_COLORS[entry.cellType] || '#94a3b8'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
              {rankingData.map((r, i) => (
                <div key={r.cellType} className="flex items-center gap-2 text-sm" data-testid={`ranking-item-${i}`}>
                  <span className="font-bold text-slate-500 w-5">{i + 1}.</span>
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CELL_TYPE_COLORS[r.cellType] || '#94a3b8' }} />
                  <span className="text-slate-600 truncate">{r.cellType}</span>
                  <span className="text-slate-500 ml-auto">{r.meanEigenvalue.toFixed(3)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 mb-8">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Dna className="h-5 w-5 text-green-400" />
              <CardTitle>Per-Gene Eigenvalue Map</CardTitle>
              <Badge className="bg-green-500/20 text-green-300 border-green-500/30">{filteredGeneData.length} genes</Badge>
            </div>
            <CardDescription className="text-slate-500">
              Every cell-type marker from Boman's Table 1, ranked by AR(2) eigenvalue.
              Color = cell type category.
            </CardDescription>
            <div className="flex flex-col sm:flex-row gap-3 mt-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  data-testid="input-gene-search"
                  placeholder="Search gene name..."
                  value={geneSearch}
                  onChange={(e) => setGeneSearch(e.target.value)}
                  className="pl-9 bg-slate-100 border-slate-200 text-slate-900 placeholder:text-gray-500"
                />
              </div>
              <select
                data-testid="select-category-filter"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-slate-100 border border-slate-200 text-slate-900 rounded-md px-3 py-2 text-sm"
              >
                <option value="all">All Categories</option>
                {uniqueCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            {isFiltered && (
              <p className="text-sm text-slate-500 mt-2">
                Showing {filteredGeneData.length} of {perGeneData.length} genes
              </p>
            )}
          </CardHeader>
          <CardContent>
            <div className="h-[600px]" data-testid="chart-per-gene">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={showAllGenes ? filteredGeneData : filteredGeneData.slice(0, 25)}
                  layout="vertical"
                  margin={{ left: 80, right: 30, top: 10, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
                  <XAxis
                    type="number"
                    domain={[0.7, 1.05]}
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                    label={{ value: 'Eigenvalue |λ|', position: 'bottom', fill: '#6b7280' }}
                  />
                  <YAxis
                    type="category"
                    dataKey="gene"
                    tick={{ fill: '#d1d5db', fontSize: 11 }}
                    width={70}
                  />
                  <Tooltip content={<GeneTooltip />} />
                  <ReferenceLine x={data.clockBaseline} stroke="#f59e0b" strokeDasharray="5 5" strokeWidth={2} />
                  <ReferenceLine x={1.0} stroke="#ef4444" strokeDasharray="3 3" strokeWidth={1} />
                  <Bar dataKey="eigenvalue" radius={[0, 4, 4, 0]}>
                    {(showAllGenes ? filteredGeneData : filteredGeneData.slice(0, 25)).map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {filteredGeneData.length > 25 && (
              <Button
                variant="outline"
                className="mt-4 w-full border-slate-200 text-slate-600"
                onClick={() => setShowAllGenes(!showAllGenes)}
                data-testid="button-toggle-genes"
              >
                {showAllGenes ? <ChevronUp className="h-4 w-4 mr-2" /> : <ChevronDown className="h-4 w-4 mr-2" />}
                {showAllGenes ? 'Show Top 25' : `Show All ${filteredGeneData.length} Genes`}
              </Button>
            )}

            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-per-gene">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-200">
                    <th className="text-left py-2 px-3">Gene</th>
                    <th className="text-left py-2 px-3">Cell Type</th>
                    <th className="text-right py-2 px-3">|λ|</th>
                    <th className="text-right py-2 px-3">R²</th>
                    <th className="text-right py-2 px-3">φ₁</th>
                    <th className="text-right py-2 px-3">φ₂</th>
                    <th className="text-center py-2 px-3">Roots</th>
                  </tr>
                </thead>
                <tbody>
                  {(showAllGenes ? filteredGeneData : filteredGeneData.slice(0, 20)).map((g, i) => (
                    <tr key={g.gene} className="border-b border-slate-200 hover:bg-slate-100/30" data-testid={`row-gene-${i}`}>
                      <td className="py-2 px-3 font-medium text-slate-900"><GeneTooltipPopover gene={g.gene}>{g.gene}</GeneTooltipPopover></td>
                      <td className="py-2 px-3">
                        <Badge
                          className="text-xs"
                          style={{
                            backgroundColor: (CELL_TYPE_COLORS[g.cellTypeCategory] || '#94a3b8') + '30',
                            color: CELL_TYPE_COLORS[g.cellTypeCategory] || '#94a3b8',
                            borderColor: (CELL_TYPE_COLORS[g.cellTypeCategory] || '#94a3b8') + '50',
                          }}
                        >
                          {g.cellTypeCategory}
                        </Badge>
                      </td>
                      <td className={`py-2 px-3 text-right font-mono ${g.eigenvalue >= 1.0 ? 'text-red-400 font-bold' : g.eigenvalue > data.clockBaseline ? 'text-green-400' : 'text-amber-400'}`}>
                        {g.eigenvalue.toFixed(4)}
                      </td>
                      <td className={`py-2 px-3 text-right font-mono ${g.r2 < 0 ? 'text-red-400' : g.r2 > 0.5 ? 'text-green-400' : 'text-slate-500'}`}>
                        {g.r2.toFixed(3)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-slate-500">{g.phi1.toFixed(3)}</td>
                      <td className="py-2 px-3 text-right font-mono text-slate-500">{g.phi2.toFixed(3)}</td>
                      <td className="py-2 px-3 text-center">
                        <Badge className={g.isComplex ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' : 'bg-slate-200/50 text-slate-500 border-slate-300/30'}>
                          {g.isComplex ? 'oscillatory' : 'real'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 mb-8">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-cyan-400" />
              <CardTitle>Root-Space Position Map</CardTitle>
            </div>
            <CardDescription className="text-slate-500">
              Each gene plotted in the AR(2) stationarity triangle by its φ₁ and φ₂ coefficients. Color = cell type category.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center relative" data-testid="chart-root-space-mini">
              <svg viewBox="0 0 500 350" className="w-full max-w-[600px]" style={{ background: '#0f172a' }}>
                <polygon
                  points="40,330 460,330 250,40"
                  fill="none"
                  stroke="#475569"
                  strokeWidth="1.5"
                  strokeDasharray="6 4"
                />
                <line x1="40" y1="185" x2="460" y2="185" stroke="#334155" strokeWidth="0.5" strokeDasharray="3 3" />
                <line x1="250" y1="40" x2="250" y2="330" stroke="#334155" strokeWidth="0.5" strokeDasharray="3 3" />
                <text x="250" y="345" textAnchor="middle" fill="#94a3b8" fontSize="11">φ₁ (beta1)</text>
                <text x="15" y="185" textAnchor="middle" fill="#94a3b8" fontSize="11" transform="rotate(-90, 15, 185)">φ₂ (beta2)</text>
                {data.perGeneResults.map((g) => {
                  const cx = 40 + (g.phi1 + 2) * (420 / 4);
                  const cy = 330 - (g.phi2 + 1) * (290 / 2);
                  return (
                    <circle
                      key={g.gene}
                      cx={cx}
                      cy={cy}
                      r={3}
                      fill={CELL_TYPE_COLORS[g.cellTypeCategory] || '#94a3b8'}
                      opacity={0.6}
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredGene(g)}
                      onMouseLeave={() => setHoveredGene(null)}
                    />
                  );
                })}
              </svg>
              {hoveredGene && (
                <div className="absolute top-4 right-4 bg-white border border-slate-200 rounded-lg p-3 shadow-xl text-sm pointer-events-none" data-testid="tooltip-root-space">
                  <p className="font-bold text-slate-900"><GeneTooltipPopover gene={hoveredGene.gene}>{hoveredGene.gene}</GeneTooltipPopover></p>
                  <p className="text-slate-600">{hoveredGene.cellTypeCategory}</p>
                  <p className="text-blue-300">|λ| = {hoveredGene.eigenvalue.toFixed(4)}</p>
                  <p className="text-slate-500">φ₁ = {hoveredGene.phi1.toFixed(3)}, φ₂ = {hoveredGene.phi2.toFixed(3)}</p>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-3 mt-4 justify-center">
              {Object.entries(CELL_TYPE_COLORS).map(([category, color]) => (
                <div key={category} className="flex items-center gap-1.5 text-xs text-slate-600">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                  {category}
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <ViewInRootSpace />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 mb-8">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-indigo-400" />
              <CardTitle>Cell Type Comparison</CardTitle>
            </div>
            <CardDescription className="text-slate-500">
              Select two cell types to compare their persistence profiles side-by-side.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="text-sm text-slate-500 mb-1 block">Cell Type 1</label>
                <select
                  className="w-full bg-slate-100 border border-slate-200 rounded-lg p-2 text-slate-900 text-sm"
                  value={compareType1}
                  onChange={(e) => setCompareType1(e.target.value)}
                  data-testid="select-compare-type1"
                >
                  <option value="">Select cell type...</option>
                  {data.cellTypeRanking.map(ct => (
                    <option key={ct.cellType} value={ct.cellType}>{ct.cellType}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-slate-500 mb-1 block">Cell Type 2</label>
                <select
                  className="w-full bg-slate-100 border border-slate-200 rounded-lg p-2 text-slate-900 text-sm"
                  value={compareType2}
                  onChange={(e) => setCompareType2(e.target.value)}
                  data-testid="select-compare-type2"
                >
                  <option value="">Select cell type...</option>
                  {data.cellTypeRanking.map(ct => (
                    <option key={ct.cellType} value={ct.cellType}>{ct.cellType}</option>
                  ))}
                </select>
              </div>
            </div>
            {compareType1 && compareType2 && (() => {
              const ct1 = data.cellTypeRanking.find(c => c.cellType === compareType1);
              const ct2 = data.cellTypeRanking.find(c => c.cellType === compareType2);
              if (!ct1 || !ct2) return null;
              const gap = Math.abs(ct1.meanEigenvalue - ct2.meanEigenvalue);
              const higher = ct1.meanEigenvalue >= ct2.meanEigenvalue ? ct1 : ct2;
              const lower = ct1.meanEigenvalue >= ct2.meanEigenvalue ? ct2 : ct1;
              return (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {[ct1, ct2].map((ct) => (
                      <div key={ct.cellType} className="bg-slate-50 border border-slate-200 rounded-lg p-4" data-testid={`compare-panel-${ct.cellType}`}>
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CELL_TYPE_COLORS[ct.cellType] || '#94a3b8' }} />
                          <h4 className="font-bold text-slate-900">{ct.cellType}</h4>
                        </div>
                        <p className="text-2xl font-bold text-blue-400 mb-1">|λ| = {ct.meanEigenvalue.toFixed(4)}</p>
                        <p className="text-sm text-slate-500 mb-3">R² = {ct.meanR2.toFixed(3)} · {ct.nGenes} gene{ct.nGenes > 1 ? 's' : ''}</p>
                        <div className="h-[120px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={ct.genes} margin={{ left: 0, right: 5, top: 5, bottom: 5 }}>
                              <XAxis dataKey="gene" tick={{ fill: '#6b7280', fontSize: 9 }} angle={-45} textAnchor="end" height={40} />
                              <YAxis domain={[0.7, 1.05]} tick={{ fill: '#6b7280', fontSize: 10 }} width={35} />
                              <Bar dataKey="eigenvalue" fill={CELL_TYPE_COLORS[ct.cellType] || '#94a3b8'} radius={[2, 2, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="mt-2 space-y-1">
                          {ct.genes.map(g => (
                            <div key={g.gene} className="flex justify-between text-xs">
                              <span className="text-slate-600"><GeneTooltipPopover gene={g.gene}>{g.gene}</GeneTooltipPopover></span>
                              <span className="text-slate-500 font-mono">{g.eigenvalue.toFixed(4)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-4" data-testid="comparison-summary">
                    <h4 className="font-bold text-indigo-300 mb-2">Comparison Summary</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-slate-500">Higher Persistence</p>
                        <p className="text-slate-900 font-semibold">{higher.cellType}</p>
                        <p className="text-blue-300 font-mono">{higher.meanEigenvalue.toFixed(4)}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Persistence Gap</p>
                        <p className="text-slate-900 font-semibold font-mono">{gap.toFixed(4)}</p>
                        <p className="text-slate-500">{((gap / lower.meanEigenvalue) * 100).toFixed(1)}% relative difference</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Gene Count</p>
                        <p className="text-slate-900">{ct1.cellType}: {ct1.nGenes} gene{ct1.nGenes > 1 ? 's' : ''}</p>
                        <p className="text-slate-900">{ct2.cellType}: {ct2.nGenes} gene{ct2.nGenes > 1 ? 's' : ''}</p>
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}
          </CardContent>
        </Card>

        {data.cancerComparison.available && (
          <Card className="bg-white border-slate-200 mb-8">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-red-400" />
                <CardTitle>Cancer Vulnerability Map</CardTitle>
                <Badge className="bg-red-500/20 text-red-300 border-red-500/30">APC-KO</Badge>
              </div>
              <CardDescription className="text-slate-500">
                Per-cell-type eigenvalue drift under APC knockout (cancer model).
                Dataset: {data.cancerComparison.dataset}. Negative drift = destabilized by cancer.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]" data-testid="chart-cancer-drift">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.cancerComparison.cellTypeDrift}
                    layout="vertical"
                    margin={{ left: 140, right: 30, top: 10, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fill: '#6b7280', fontSize: 12 }}
                      label={{ value: 'Eigenvalue Drift (APC-KO minus WT)', position: 'bottom', fill: '#6b7280' }}
                    />
                    <YAxis
                      type="category"
                      dataKey="cellType"
                      tick={{ fill: '#d1d5db', fontSize: 12 }}
                      width={130}
                    />
                    <Tooltip content={<DriftTooltip />} />
                    <ReferenceLine x={0} stroke="#6b7280" strokeWidth={1} />
                    <Bar dataKey="meanDrift" radius={[0, 4, 4, 0]}>
                      {data.cancerComparison.cellTypeDrift.map((entry, index) => (
                        <Cell key={index} fill={entry.meanDrift < 0 ? '#ef4444' : '#10b981'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                  <h4 className="font-bold text-red-300 mb-2">Most Vulnerable to Cancer</h4>
                  {data.cancerComparison.cellTypeDrift
                    .filter(d => d.meanDrift < -0.005)
                    .slice(0, 5)
                    .map(d => (
                      <div key={d.cellType} className="flex justify-between text-sm py-1">
                        <span className="text-slate-600">{d.cellType}</span>
                        <span className="text-red-400 font-mono">{d.meanDrift.toFixed(4)}</span>
                      </div>
                    ))}
                </div>
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                  <h4 className="font-bold text-green-300 mb-2">Most Resistant to Cancer</h4>
                  {data.cancerComparison.cellTypeDrift
                    .filter(d => d.meanDrift > -0.005)
                    .sort((a, b) => b.meanDrift - a.meanDrift)
                    .slice(0, 5)
                    .map(d => (
                      <div key={d.cellType} className="flex justify-between text-sm py-1">
                        <span className="text-slate-600">{d.cellType}</span>
                        <span className="text-green-400 font-mono">{d.meanDrift > 0 ? '+' : ''}{d.meanDrift.toFixed(4)}</span>
                      </div>
                    ))}
                </div>
              </div>

              <div className="mt-6 overflow-x-auto">
                <h4 className="text-sm font-bold text-slate-600 mb-2">Per-Gene Cancer Drift</h4>
                <table className="w-full text-sm" data-testid="table-cancer-drift">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-200">
                      <th className="text-left py-2 px-3">Gene</th>
                      <th className="text-left py-2 px-3">Cell Type</th>
                      <th className="text-right py-2 px-3">WT |λ|</th>
                      <th className="text-right py-2 px-3">APC-KO |λ|</th>
                      <th className="text-right py-2 px-3">Drift</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.cancerComparison.perGeneDrift.map((g, i) => (
                      <tr key={g.gene} className="border-b border-slate-200 hover:bg-slate-100/30" data-testid={`row-drift-${i}`}>
                        <td className="py-2 px-3 font-medium text-slate-900"><GeneTooltipPopover gene={g.gene}>{g.gene}</GeneTooltipPopover></td>
                        <td className="py-2 px-3 text-slate-500">{g.cellType}</td>
                        <td className="py-2 px-3 text-right font-mono text-green-400">{g.wtEigenvalue.toFixed(4)}</td>
                        <td className="py-2 px-3 text-right font-mono text-red-400">{g.cancerEigenvalue.toFixed(4)}</td>
                        <td className={`py-2 px-3 text-right font-mono font-bold ${g.drift < 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {g.drift > 0 ? '+' : ''}{g.drift.toFixed(4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {data.cancerComparison.available && (
          <div className="mb-8">
            <InsightCallout variant="warning">
              APC knockout disrupts cell-type persistence differentially. Stem cell markers show the largest drift, consistent with cancer stem cell models where loss of tumor suppressor function destabilizes the renewal hierarchy.
            </InsightCallout>
          </div>
        )}

        <Card className="bg-white border-slate-200 mb-8">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Beaker className="h-5 w-5 text-purple-400" />
              <CardTitle>Boman et al. Findings — Validated by AR(2) Analysis</CardTitle>
            </div>
            <CardDescription className="text-slate-500">
              Mapping each finding from Nguyen, Lausten &amp; Boman (<em>Cells</em>, Sept 2025) against quantitative AR(2) evidence.
              Green = confirmed, red = extended/contradicted.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3" data-testid="boman-findings">
              {data.bomanFindings.map((finding, i) => (
                <div key={i} className="border border-slate-200 rounded-lg overflow-hidden">
                  <button
                    className="w-full flex items-start gap-3 p-4 text-left hover:bg-slate-100/30 transition-colors"
                    onClick={() => toggleFinding(i)}
                    data-testid={`button-finding-${i}`}
                  >
                    {finding.confirmed ? (
                      <CheckCircle2 className="h-5 w-5 text-green-400 mt-0.5 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-5 w-5 text-amber-400 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">{finding.finding}</p>
                      <p className="text-sm text-slate-500 mt-1 line-clamp-1">{finding.quantitativeEvidence}</p>
                    </div>
                    {expandedFindings.has(i) ? (
                      <ChevronUp className="h-4 w-4 text-slate-500 mt-1" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-500 mt-1" />
                    )}
                  </button>
                  {expandedFindings.has(i) && (
                    <div className="px-4 pb-4 pt-0 border-t border-slate-200">
                      <div className="bg-slate-50 rounded-lg p-3 mt-3">
                        <p className="text-sm font-medium text-blue-300 mb-1">Quantitative Evidence:</p>
                        <p className="text-sm text-slate-600">{finding.quantitativeEvidence}</p>
                      </div>
                      <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3 mt-3">
                        <p className="text-sm font-medium text-purple-300 mb-1">Novel AR(2) Insight:</p>
                        <p className="text-sm text-slate-600">{finding.novelInsight}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-green-400" />
              Methodology
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 space-y-3">
            <p>
              <strong className="text-slate-900">Primary dataset:</strong> {data.dataset} — {data.nTimepoints} hourly
              timepoints, {data.nGenesTotal.toLocaleString()} genes. This dataset provides the best statistical
              power for resolving eigenvalue differences between cell types.
            </p>
            <p>
              <strong className="text-slate-900">Cancer comparison:</strong> GSE157357 mouse intestinal organoids (22 timepoints).
              Wild-type vs APC-knockout comparison reveals per-cell-type vulnerability to oncogenic transformation.{' '}
              <span className="text-amber-700 font-medium">⚠ Temporal coverage caveat:</span>{' '}
              GSE157357 covers only a 22 h ZT window (ZT24–46), which is insufficient for AR(2) circadian eigenvalue analysis (≥36 h required).
              Eigenvalue comparisons between WT and ApcKO in this dataset are indicative only; do not draw conclusions about absolute eigenvalue magnitude.
            </p>
            <p>
              <strong className="text-slate-900">Cell-type markers:</strong> All markers drawn from Table 1 of
              Nguyen, Lausten &amp; Boman (<em>Cells</em>, September 2025). Includes stem (Lgr5, Ascl2, Smoc2, Olfm4, Bmi1),
              goblet (Muc2, Atoh1, Fcgbp, Clca1), Paneth-like (Lyz1, Lyz2, Reg4, Mmp7), M cell (Gp2, Pglyrp1),
              tuft (Dclk1), enteroendocrine (Syp, Chga), colonocyte (Cdx2, Vil1), plus clock and proliferation
              reference genes.
            </p>
            <p>
              <strong className="text-slate-900">AR(2) model:</strong> y(t) = φ₁·y(t-1) + φ₂·y(t-2) + ε.
              Eigenvalue |λ| = max(|λ₁|, |λ₂|) from the characteristic equation λ² − φ₁λ − φ₂ = 0.
              Values near 1.0 indicate maximal persistence (near unit root); values near 0 indicate
              rapidly decaying dynamics.
            </p>
            {data.missingMarkers.length > 0 && (
              <p>
                <strong className="text-slate-900">Missing markers ({data.nMarkersMissing}):</strong>{' '}
                {data.missingMarkers.join(', ')}. These genes were not found in the primary dataset.
              </p>
            )}
          </CardContent>
        </Card>

        <div className="text-center pb-8 space-y-3">
          <Link href="/cross-context-validation">
            <Button className="bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-slate-900 font-medium" data-testid="link-cross-tissue">
              <Layers className="h-4 w-4 mr-2" />
              Next: Cross-Context Validation (Species & Tissues)
            </Button>
          </Link>
          <div className="text-slate-500 text-sm">
            Cell-type markers from Nguyen, Lausten &amp; Boman, <em>Cells</em> (September 2025).
            AR(2) analysis: PAR(2) Discovery Engine. Dataset: NCBI GEO {data.datasetId}.
          </div>
        </div>
      </div>
    </div>
  );
}
