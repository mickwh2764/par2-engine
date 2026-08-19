import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useScrollToHash } from "@/hooks/useScrollToHash";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  ScatterChart, Scatter, ZAxis, Cell, Legend, LineChart, Line, ReferenceLine
} from "recharts";
import { Download, Dna, Activity, TrendingUp, AlertTriangle, CheckCircle2, Info, ShieldAlert, ArrowLeft, Layers, CheckCircle, XCircle, BarChart3, Loader2 } from "lucide-react";
import { Link } from "wouter";
import HowTo from "@/components/HowTo";
import PaperCrossLinks from "@/components/PaperCrossLinks";
import GeneTooltip from "@/components/GeneTooltip";

const ORGANISM_COLORS: Record<string, string> = {
  'mouse': '#22d3ee',
  'human': '#a855f7',
  'plant': '#4ade80',
  'unknown': '#6b7280'
};

const ORGANISM_LABELS: Record<string, string> = {
  'mouse': 'Mouse (Mus musculus)',
  'human': 'Human (Homo sapiens)',
  'plant': 'Arabidopsis thaliana',
  'unknown': 'Other/Unknown'
};

const LAYER_COLORS = {
  identity: '#ef4444',
  clock: '#f59e0b',
  proliferation: '#3b82f6',
};

interface SpeciesResult {
  organism: string;
  datasetCount: number;
  datasets: string[];
  totalPairs: number;
  significantPairs: number;
  significanceRate: number;
  eigenvalueStats: {
    mean: number;
    std: number;
    min: number;
    max: number;
    inStabilityBand: number;
    inBandPercent: number;
  };
  topPairs: Array<{
    clock: string;
    target: string;
    eigenvalue: number;
    pValue: number;
    dataset: string;
  }>;
  stabilityFiltered?: {
    stableCount: number;
    unstableCount: number;
    stablePercent: number;
    stableMeanEigenvalue: number;
    unstablePairs: Array<{
      clock: string;
      target: string;
      eigenvalue: number;
      dataset: string;
    }>;
  };
}

interface CrossSpeciesData {
  summary: {
    organismsAnalyzed: number;
    totalDatasets: number;
    totalPairs: number;
    globalMeanEigenvalue: number;
    conservationEvidence: string;
    stabilityNote?: string;
  };
  speciesResults: SpeciesResult[];
  methodology: {
    description: string;
    stabilityBand: string;
    interpretation: string;
  };
}

interface PiG0Data {
  summary: {
    totalDatasets: number;
    normalDatasets: number;
    mutantDatasets: number;
    normalMeanEigenvalue: number;
    mutantMeanEigenvalue: number;
    deltaLambda: number;
    normalPredictedPiG0: number;
    mutantPredictedPiG0: number;
    pathogenicDriftDetected: boolean;
  };
  datasetMappings: Array<{
    dataset: string;
    organism: string;
    meanEigenvalue: number;
    predictedPiG0: number;
    eigenvalueDistribution: { low: number; stable: number; high: number };
    condition: 'normal' | 'mutant' | 'unknown';
  }>;
  methodology: {
    description: string;
    formula: string;
    interpretation: string;
    biologicalBasis: string;
  };
  conditionComparison: {
    normal: { meanEigenvalue: number; predictedPiG0: number; interpretation: string };
    mutant: { meanEigenvalue: number; predictedPiG0: number; interpretation: string };
  };
}

interface GeneEigenvalue {
  gene: string;
  eigenvalue: number;
  phi1: number;
  phi2: number;
  r2: number;
  layer: 'identity' | 'clock' | 'proliferation';
}

interface TissueResult {
  tissue: string;
  identityLabel: string;
  nTimepoints: number;
  identityMean: number;
  clockMean: number;
  prolifMean: number;
  identityClockGap: number;
  clockProlifGap: number;
  identityProlifGap: number;
  hierarchyConfirmed: boolean;
  partialHierarchy: string;
  identityGenes: GeneEigenvalue[];
  clockGenes: GeneEigenvalue[];
  prolifGenes: GeneEigenvalue[];
  nIdentityFound: number;
  nClockFound: number;
  nProlifFound: number;
}

interface PermutationResult {
  tissue: string;
  observedGap: number;
  pValue: number;
  zScore: number;
  nPermutations: number;
}

interface TissueAnalysisData {
  tissues: TissueResult[];
  summary: {
    nTissues: number;
    nConfirmed: number;
    nPartial: number;
    nFailed: number;
    meanIdentityClockGap: number;
    meanClockProlifGap: number;
    overallVerdict: string;
  };
  permutationTests: PermutationResult[];
  bootstrapCI: {
    identityClockGap: { lower: number; upper: number; mean: number };
    clockProlifGap: { lower: number; upper: number; mean: number };
  };
}

interface CrossContextComparison {
  targetGene: string;
  clockGene: string;
  healthySignificant: number;
  healthyTotal: number;
  healthyRate: number;
  cancerSignificant: number;
  cancerTotal: number;
  cancerRate: number;
  pattern: 'LOST_IN_CANCER' | 'GAINED_IN_CANCER' | 'STABLE' | 'VARIABLE';
  rateDifference: number;
}

interface CrossContextData {
  summary: {
    healthyDatasetsAnalyzed: number;
    cancerDatasetsAnalyzed: number;
    totalPairsCompared: number;
    patternsFound: {
      lostInCancer: number;
      gainedInCancer: number;
      stable: number;
      variable: number;
    };
  };
  keyFindings: {
    lostInCancer: CrossContextComparison[];
    gainedInCancer: CrossContextComparison[];
  };
  allComparisons: CrossContextComparison[];
}

type SpeciesSubTab = 'overview' | 'full-results' | 'eigenvalues' | 'pi-g0' | 'methodology';

export default function CrossContextValidation() {
  useScrollToHash();
  const [speciesSubTab, setSpeciesSubTab] = useState<SpeciesSubTab>('overview');
  const [selectedTissue, setSelectedTissue] = useState<string | null>(null);

  const { data: crossSpeciesData, isLoading: loadingCrossSpecies } = useQuery<CrossSpeciesData>({
    queryKey: ["/api/analyses/cross-species-comparison"],
    queryFn: async () => {
      const response = await fetch("/api/analyses/cross-species-comparison");
      if (!response.ok) throw new Error("Failed to fetch cross-species data");
      return response.json();
    }
  });

  const { data: piG0Data, isLoading: loadingPiG0 } = useQuery<PiG0Data>({
    queryKey: ["/api/analyses/pi-g0-mapping"],
    queryFn: async () => {
      const response = await fetch("/api/analyses/pi-g0-mapping");
      if (!response.ok) throw new Error("Failed to fetch π_G₀ mapping");
      return response.json();
    }
  });

  const { data: tissueData, isLoading: loadingTissue, error: tissueError } = useQuery<TissueAnalysisData>({
    queryKey: ['/api/analysis/cross-tissue-three-layer'],
  });

  const { data: crossContextData, isLoading: loadingCrossContext, error: crossContextError } = useQuery<CrossContextData>({
    queryKey: ["/api/analyses/cross-context-comparison"],
    queryFn: async () => {
      const response = await fetch("/api/analyses/cross-context-comparison");
      if (!response.ok) throw new Error("Failed to fetch cross-context comparison data");
      return response.json();
    }
  });

  const handleDownloadAudit = async (format: 'csv' | 'json') => {
    try {
      const response = await fetch(`/api/download/stability-audit-report?format=${format}`);
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `PAR2_Stability_Audit_${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download error:', error);
      alert('Download failed. Please try again.');
    }
  };

  const eigenvalueChartData = crossSpeciesData?.speciesResults.map(s => ({
    organism: ORGANISM_LABELS[s.organism] || s.organism,
    mean: s.eigenvalueStats.mean,
    min: s.eigenvalueStats.min,
    max: s.eigenvalueStats.max,
    std: s.eigenvalueStats.std,
    inBand: s.eigenvalueStats.inBandPercent,
    color: ORGANISM_COLORS[s.organism] || ORGANISM_COLORS.unknown
  })) || [];

  const scatterData = crossSpeciesData?.speciesResults.flatMap(s =>
    s.topPairs.map(p => ({
      x: p.eigenvalue,
      y: -Math.log10(p.pValue),
      organism: s.organism,
      clock: p.clock,
      target: p.target,
      color: ORGANISM_COLORS[s.organism] || ORGANISM_COLORS.unknown
    }))
  ) || [];

  const piG0ChartData = piG0Data?.datasetMappings.map(d => ({
    dataset: d.dataset.replace(/GSE\d+_/, '').replace(/_circadian\.csv$/, '').replace(/_/g, ' ').substring(0, 20),
    eigenvalue: d.meanEigenvalue,
    piG0: d.predictedPiG0,
    condition: d.condition,
    organism: d.organism
  })) || [];

  const tissueBarData = tissueData?.tissues.map(t => ({
    tissue: t.tissue,
    Identity: parseFloat(t.identityMean.toFixed(4)),
    Clock: parseFloat(t.clockMean.toFixed(4)),
    Proliferation: parseFloat(t.prolifMean.toFixed(4)),
    confirmed: t.hierarchyConfirmed,
  })) || [];

  const tissueGapData = tissueData?.tissues.map(t => ({
    tissue: t.tissue,
    'Identity–Clock Gap': parseFloat(t.identityClockGap.toFixed(4)),
    'Clock–Prolif Gap': parseFloat(t.clockProlifGap.toFixed(4)),
  })) || [];

  const tissueDetail = selectedTissue ? tissueData?.tissues.find(t => t.tissue === selectedTissue) : null;

  const speciesSubTabButtons: { value: SpeciesSubTab; label: string }[] = [
    { value: 'overview', label: 'Overview' },
    { value: 'full-results', label: 'Full Results' },
    { value: 'eigenvalues', label: 'Eigenvalue Distribution' },
    { value: 'pi-g0', label: 'π_G₀ Mapping' },
    { value: 'methodology', label: 'Methodology' },
  ];

  return (
    <div className="min-h-screen bg-background p-6" data-testid="cross-context-validation-page">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Dna className="h-8 w-8 text-cyan-400" />
              Cross-Context Validation
            </h1>
            <p className="text-muted-foreground mt-1">
              Validating eigenvalue hierarchies across species and tissues
            </p>
            <div className="rounded-lg bg-slate-100 border border-slate-200 p-4 mt-3">
              <p className="text-sm text-slate-600 leading-relaxed">
                <strong className="text-slate-900">What you can do:</strong> Combines cross-species and cross-tissue comparisons with statistical tests (permutation and bootstrap). If the hierarchy holds across multiple contexts, it validates AR(2) persistence as a universal biological signal. Download audit reports in CSV or JSON format.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/">Back to Home</Link>
          </Button>
        </div>

        <PaperCrossLinks currentPage="/cross-context-validation" />

        <Tabs defaultValue="species" className="space-y-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="species">Multi-Species</TabsTrigger>
            <TabsTrigger value="tissue">Three-Layer Tissue</TabsTrigger>
            <TabsTrigger value="cross-context">WT vs Cancer</TabsTrigger>
          </TabsList>

          <TabsContent value="species" className="space-y-6">
            <div id="hierarchy-summary" className="flex items-center justify-between scroll-mt-20 transition-all duration-500">
              <div>
                <h2 className="text-2xl font-bold text-foreground flex items-center gap-3">
                  <Dna className="h-6 w-6 text-cyan-400" />
                  Cross-Species Eigenvalue Comparison
                </h2>
                <p className="text-muted-foreground mt-1">
                  Conservation of circadian temporal dynamics across organisms
                </p>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleDownloadAudit('csv')}
                  data-testid="download-csv"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download CSV
                </Button>
                <Button 
                  variant="default" 
                  size="sm" 
                  onClick={() => handleDownloadAudit('json')}
                  data-testid="download-json"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download JSON
                </Button>
              </div>
            </div>

            <HowTo
              title="Multi-Species Comparison"
              summary="Validates the Gearbox Hypothesis across species by comparing clock vs. target eigenvalue hierarchies in mouse, human, baboon, and Arabidopsis datasets. Cross-species conservation of the hierarchy supports the biological universality of the AR(2) framework."
              steps={[
                { label: "Compare species", detail: "Each panel shows a species with its clock and target mean eigenvalues and whether the hierarchy is preserved." },
                { label: "Check orthology", detail: "Orthologous gene mappings link genes across species so the comparison is biologically meaningful." },
                { label: "Look for conservation", detail: "If clock > target holds across species, the temporal hierarchy is likely a conserved biological feature." }
              ]}
            />

            <div
              className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3"
              data-testid="edge-case-diagnostics-banner"
            >
              <ShieldAlert className="h-5 w-5 mt-0.5 text-amber-400 shrink-0" data-testid="icon-edge-case-diagnostics" />
              <p className="text-sm text-muted-foreground" data-testid="text-edge-case-diagnostics">
                <span className="font-semibold text-amber-400">Edge-case diagnostics enabled:</span>{" "}
                All AR(2) results now include automatic checks for trend detection, sample-size confidence, AR(3) order verification, nonlinearity screening, and boundary proximity assessment.
              </p>
            </div>

            <div
              className="flex items-start gap-3 rounded-lg border border-blue-500/30 bg-blue-500/5 px-4 py-3"
              data-testid="curated-gene-set-note"
            >
              <Info className="h-5 w-5 mt-0.5 text-blue-400 shrink-0" />
              <p className="text-sm text-muted-foreground" data-testid="text-curated-gene-set-note">
                <span className="font-semibold text-blue-400">Curated gene set:</span>{" "}
                These cross-species eigenvalues are computed from a pre-selected list of known clock and target genes (~10-20 per species). Because these genes were chosen for their known circadian roles, similarity across species is expected and does not by itself prove conservation. For unbiased evidence, see the <a href="/genome-wide" className="text-cyan-400 underline hover:text-cyan-300">Genome-Wide Analysis</a> page, which runs AR(2) on all ~21,000 genes without pre-selection.
              </p>
            </div>

            {loadingCrossSpecies || loadingPiG0 ? (
              <Card className="border-border/50">
                <CardContent className="py-12">
                  <div className="flex items-center justify-center">
                    <Activity className="h-8 w-8 animate-spin text-cyan-400" />
                    <span className="ml-3 text-muted-foreground">Loading cross-species analysis...</span>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="flex flex-wrap gap-2 border-b border-border pb-2">
                  {speciesSubTabButtons.map(btn => (
                    <Button
                      key={btn.value}
                      variant={speciesSubTab === btn.value ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setSpeciesSubTab(btn.value)}
                    >
                      {btn.label}
                    </Button>
                  ))}
                </div>

                {speciesSubTab === 'overview' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <Card className="border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-transparent">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium text-muted-foreground">Organisms Analyzed</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-3xl font-bold text-cyan-400">
                            {crossSpeciesData?.summary.organismsAnalyzed || 0}
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="border-purple-500/30 bg-gradient-to-br from-purple-500/10 to-transparent">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium text-muted-foreground">Total Datasets</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-3xl font-bold text-purple-400">
                            {crossSpeciesData?.summary.totalDatasets || 0}
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="border-green-500/30 bg-gradient-to-br from-green-500/10 to-transparent">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium text-muted-foreground">Global Mean |λ|</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-3xl font-bold text-green-400">
                            {crossSpeciesData?.summary.globalMeanEigenvalue || 0}
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-transparent">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium text-muted-foreground">Conservation</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-lg font-medium text-amber-400">
                            {crossSpeciesData?.summary.conservationEvidence?.includes('Strong') ? (
                              <span className="flex items-center gap-2">
                                <CheckCircle2 className="h-5 w-5" />
                                Conserved
                              </span>
                            ) : (
                              <span className="flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5" />
                                Variable
                              </span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {crossSpeciesData?.speciesResults.map(species => (
                        <Card key={species.organism} className="border-border/50">
                          <CardHeader>
                            <CardTitle className="flex items-center gap-3">
                              <div 
                                className="w-4 h-4 rounded-full" 
                                style={{ backgroundColor: ORGANISM_COLORS[species.organism] }}
                              />
                              {ORGANISM_LABELS[species.organism] || species.organism}
                            </CardTitle>
                            <CardDescription>
                              {species.datasetCount} datasets | {species.totalPairs} gene pairs analyzed
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="grid grid-cols-3 gap-4 text-center">
                              <div>
                                <div className="text-2xl font-bold text-cyan-400">
                                  {species.eigenvalueStats.mean}
                                </div>
                                <div className="text-xs text-muted-foreground">Mean |λ|</div>
                              </div>
                              <div>
                                <div className="text-2xl font-bold text-green-400">
                                  {species.eigenvalueStats.inBandPercent}%
                                </div>
                                <div className="text-xs text-muted-foreground">In Stability Band</div>
                              </div>
                              <div>
                                <div className="text-2xl font-bold text-purple-400">
                                  {species.significanceRate}%
                                </div>
                                <div className="text-xs text-muted-foreground">Significant Pairs</div>
                              </div>
                            </div>

                            {species.stabilityFiltered && (
                              <div className="flex items-center justify-between px-3 py-2 rounded bg-muted/20 border border-border/50" data-testid={`stability-filter-${species.organism}`}>
                                <div className="flex items-center gap-2">
                                  <CheckCircle2 className={`h-4 w-4 ${species.stabilityFiltered.stablePercent >= 90 ? 'text-green-400' : species.stabilityFiltered.stablePercent >= 70 ? 'text-amber-400' : 'text-red-400'}`} />
                                  <span className="text-sm font-medium">Stable Fits:</span>
                                  <span className={`text-sm font-bold ${species.stabilityFiltered.stablePercent >= 90 ? 'text-green-400' : species.stabilityFiltered.stablePercent >= 70 ? 'text-amber-400' : 'text-red-400'}`} data-testid={`stable-percent-${species.organism}`}>
                                    {species.stabilityFiltered.stablePercent}%
                                  </span>
                                </div>
                                {species.stabilityFiltered.unstableCount > 0 && (
                                  <div className="flex items-center gap-1.5" data-testid={`unstable-warning-${species.organism}`}>
                                    <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                                    <span className="text-xs text-amber-400">{species.stabilityFiltered.unstableCount} unstable</span>
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="space-y-2">
                              <div className="text-sm font-medium text-muted-foreground">Top Significant Pairs</div>
                              <div className="space-y-1">
                                {species.topPairs.slice(0, 5).map((pair, i) => (
                                  <div key={i} className="flex items-center justify-between text-sm bg-muted/30 px-3 py-1.5 rounded">
                                    <span className="font-mono">
                                      <GeneTooltip gene={pair.clock}>{pair.clock}</GeneTooltip> → <GeneTooltip gene={pair.target}>{pair.target}</GeneTooltip>
                                    </span>
                                    <div className="flex items-center gap-3">
                                      <Badge variant="outline" className="font-mono">
                                        |λ|={pair.eigenvalue}
                                      </Badge>
                                      <span className="text-muted-foreground">
                                        p={pair.pValue.toExponential(2)}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {speciesSubTab === 'full-results' && (
                  <div className="space-y-6">
                    <Card className="border-border/50">
                      <CardHeader>
                        <CardTitle>Complete Cross-Species Results</CardTitle>
                        <CardDescription>
                          All {crossSpeciesData?.summary.totalPairs || 0} gene pairs across {crossSpeciesData?.summary.totalDatasets || 0} datasets
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                          <div className="p-4 bg-cyan-500/10 rounded-lg border border-cyan-500/30">
                            <div className="text-3xl font-bold text-cyan-400">{crossSpeciesData?.summary.organismsAnalyzed || 0}</div>
                            <div className="text-sm text-muted-foreground">Organisms</div>
                          </div>
                          <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/30">
                            <div className="text-3xl font-bold text-purple-400">{crossSpeciesData?.summary.totalDatasets || 0}</div>
                            <div className="text-sm text-muted-foreground">Datasets</div>
                          </div>
                          <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/30">
                            <div className="text-3xl font-bold text-green-400">{crossSpeciesData?.summary.totalPairs || 0}</div>
                            <div className="text-sm text-muted-foreground">Total Pairs</div>
                          </div>
                          <div className="p-4 bg-amber-500/10 rounded-lg border border-amber-500/30">
                            <div className="text-3xl font-bold text-amber-400">{crossSpeciesData?.summary.globalMeanEigenvalue || 0}</div>
                            <div className="text-sm text-muted-foreground">Global Mean |λ|</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {crossSpeciesData?.speciesResults.map(species => (
                      <Card key={species.organism} className="border-border/50">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-3">
                            <div 
                              className="w-4 h-4 rounded-full" 
                              style={{ backgroundColor: ORGANISM_COLORS[species.organism] }}
                            />
                            {ORGANISM_LABELS[species.organism] || species.organism}
                            <Badge variant="outline" className="ml-2">{species.datasetCount} datasets</Badge>
                            <Badge variant="outline">{species.totalPairs} pairs</Badge>
                          </CardTitle>
                          <CardDescription>
                            Mean |λ| = {species.eigenvalueStats.mean} ± {species.eigenvalueStats.std} | Range: [{species.eigenvalueStats.min}, {species.eigenvalueStats.max}] | {species.eigenvalueStats.inBandPercent}% in stability band (0.40-0.80)
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="mb-4">
                            <h4 className="font-semibold mb-2">Datasets Analyzed:</h4>
                            <div className="flex flex-wrap gap-2">
                              {species.datasets.map((ds, i) => (
                                <Badge key={i} variant="secondary" className="text-xs font-mono">
                                  {ds.replace(/_circadian\.csv$/, '').replace(/^GSE\d+_/, '')}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          
                          <h4 className="font-semibold mb-2">All Significant Gene Pairs ({species.topPairs.length}):</h4>
                          <div className="max-h-[400px] overflow-y-auto">
                            <table className="w-full text-sm">
                              <thead className="sticky top-0 bg-background">
                                <tr className="border-b border-border">
                                  <th className="text-left py-2 px-2">Clock Gene</th>
                                  <th className="text-left py-2 px-2">Target Gene</th>
                                  <th className="text-right py-2 px-2">|λ|</th>
                                  <th className="text-right py-2 px-2">p-value</th>
                                  <th className="text-left py-2 px-2">Dataset</th>
                                  <th className="text-center py-2 px-2">Stability Band</th>
                                  <th className="text-center py-2 px-2">Stable</th>
                                </tr>
                              </thead>
                              <tbody>
                                {species.topPairs.map((pair, i) => (
                                  <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                                    <td className="py-2 px-2 font-mono text-cyan-400"><GeneTooltip gene={pair.clock}>{pair.clock}</GeneTooltip></td>
                                    <td className="py-2 px-2 font-mono text-purple-400"><GeneTooltip gene={pair.target}>{pair.target}</GeneTooltip></td>
                                    <td className="py-2 px-2 text-right font-mono">
                                      <span className={pair.eigenvalue >= 0.40 && pair.eigenvalue <= 0.80 ? 'text-green-400' : 'text-muted-foreground'}>
                                        {pair.eigenvalue.toFixed(3)}
                                      </span>
                                    </td>
                                    <td className="py-2 px-2 text-right font-mono text-muted-foreground">
                                      {pair.pValue.toExponential(2)}
                                    </td>
                                    <td className="py-2 px-2 text-xs text-muted-foreground">
                                      {pair.dataset.replace(/_circadian\.csv$/, '').replace(/^GSE\d+_/, '').substring(0, 25)}
                                    </td>
                                    <td className="py-2 px-2 text-center">
                                      {pair.eigenvalue >= 0.40 && pair.eigenvalue <= 0.80 ? (
                                        <Badge variant="default" className="bg-green-600 text-xs">In Band</Badge>
                                      ) : (
                                        <Badge variant="secondary" className="text-xs">Outside</Badge>
                                      )}
                                    </td>
                                    <td className="py-2 px-2 text-center" data-testid={`stable-indicator-${species.organism}-${i}`}>
                                      {pair.eigenvalue < 1.0 ? (
                                        <Badge variant="default" className="bg-green-600 text-xs inline-flex items-center gap-1">
                                          <CheckCircle2 className="h-3 w-3" />
                                          Stable
                                        </Badge>
                                      ) : (
                                        <Badge variant="destructive" className="text-xs inline-flex items-center gap-1">
                                          <AlertTriangle className="h-3 w-3" />
                                          Unstable
                                        </Badge>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {speciesSubTab === 'eigenvalues' && (
                  <div className="space-y-6">
                    <Card className="border-border/50">
                      <CardHeader>
                        <CardTitle>Eigenvalue Distribution by Organism</CardTitle>
                        <CardDescription>
                          Mean |λ| with range across all datasets per organism
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={eigenvalueChartData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                            <XAxis 
                              type="number" 
                              domain={[0, 1]} 
                              stroke="hsl(var(--muted-foreground))"
                              tick={{ fill: 'hsl(var(--foreground))' }}
                              label={{ value: 'Eigenvalue Modulus |λ|', position: 'insideBottom', offset: -5, fill: 'hsl(var(--foreground))' }}
                            />
                            <YAxis 
                              type="category" 
                              dataKey="organism" 
                              width={150}
                              stroke="hsl(var(--muted-foreground))"
                              tick={{ fill: 'hsl(var(--foreground))' }}
                            />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: 'hsl(var(--card))', 
                                borderColor: 'hsl(var(--border))',
                                color: 'hsl(var(--foreground))'
                              }}
                              formatter={(value: number, name: string) => [value.toFixed(3), name]}
                            />
                            <Bar dataKey="mean" name="Mean |λ|" radius={[0, 4, 4, 0]}>
                              {eigenvalueChartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    <Card className="border-border/50">
                      <CardHeader>
                        <CardTitle>Volcano Plot: Eigenvalue vs Significance</CardTitle>
                        <CardDescription>
                          Significant gene pairs colored by organism (higher = more significant)
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <ScatterChart>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                            <XAxis 
                              type="number" 
                              dataKey="x" 
                              name="Eigenvalue" 
                              domain={[0, 1]}
                              stroke="hsl(var(--muted-foreground))"
                              tick={{ fill: 'hsl(var(--foreground))' }}
                              label={{ value: 'Eigenvalue Modulus |λ|', position: 'insideBottom', offset: -5, fill: 'hsl(var(--foreground))' }}
                            />
                            <YAxis 
                              type="number" 
                              dataKey="y" 
                              name="-log10(p)" 
                              stroke="hsl(var(--muted-foreground))"
                              tick={{ fill: 'hsl(var(--foreground))' }}
                              label={{ value: '-log₁₀(p-value)', angle: -90, position: 'insideLeft', fill: 'hsl(var(--foreground))' }}
                            />
                            <ZAxis range={[50, 150]} />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: 'hsl(var(--card))', 
                                borderColor: 'hsl(var(--border))',
                                color: 'hsl(var(--foreground))'
                              }}
                              formatter={(value: number, name: string) => {
                                if (name === 'Eigenvalue') return [value.toFixed(3), '|λ|'];
                                if (name === '-log10(p)') return [value.toFixed(2), '-log₁₀(p)'];
                                return [value, name];
                              }}
                              labelFormatter={(label) => ''}
                            />
                            <Legend wrapperStyle={{ color: 'hsl(var(--foreground))' }} />
                            {Object.entries(ORGANISM_COLORS).map(([organism, color]) => (
                              <Scatter 
                                key={organism}
                                name={ORGANISM_LABELS[organism] || organism}
                                data={scatterData.filter(d => d.organism === organism)}
                                fill={color}
                              />
                            ))}
                          </ScatterChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {speciesSubTab === 'pi-g0' && (
                  <div className="space-y-6">
                    {piG0Data?.summary.pathogenicDriftDetected && (
                      <Card className="border-red-500/50 bg-gradient-to-br from-red-500/10 to-transparent">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-red-400">
                            <AlertTriangle className="h-5 w-5" />
                            Pathogenic Drift Detected
                          </CardTitle>
                          <CardDescription>
                            Mutant tissues show Δλ = {piG0Data.summary.deltaLambda} (threshold: 0.1)
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="text-center p-4 bg-green-500/10 rounded-lg">
                              <div className="text-sm text-muted-foreground">Normal Tissue</div>
                              <div className="text-2xl font-bold text-green-400">
                                |λ| = {piG0Data.summary.normalMeanEigenvalue}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                π_G₀ ≈ {piG0Data.summary.normalPredictedPiG0}
                              </div>
                            </div>
                            <div className="text-center p-4 bg-red-500/10 rounded-lg">
                              <div className="text-sm text-muted-foreground">Mutant Tissue</div>
                              <div className="text-2xl font-bold text-red-400">
                                |λ| = {piG0Data.summary.mutantMeanEigenvalue}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                π_G₀ ≈ {piG0Data.summary.mutantPredictedPiG0}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    <Card className="border-border/50">
                      <CardHeader>
                        <CardTitle>π_G₀ ↔ |λ| Mapping</CardTitle>
                        <CardDescription>
                          Predicted cell-cycle G₀ latency probability from eigenvalue modulus
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <ScatterChart>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                            <XAxis 
                              type="number" 
                              dataKey="eigenvalue" 
                              name="Eigenvalue" 
                              domain={[0, 1]}
                              stroke="hsl(var(--muted-foreground))"
                              tick={{ fill: 'hsl(var(--foreground))' }}
                              label={{ value: 'Eigenvalue Modulus |λ|', position: 'insideBottom', offset: -5, fill: 'hsl(var(--foreground))' }}
                            />
                            <YAxis 
                              type="number" 
                              dataKey="piG0" 
                              name="π_G₀" 
                              domain={[0, 0.5]}
                              stroke="hsl(var(--muted-foreground))"
                              tick={{ fill: 'hsl(var(--foreground))' }}
                              label={{ value: 'Predicted π_G₀', angle: -90, position: 'insideLeft', fill: 'hsl(var(--foreground))' }}
                            />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: 'hsl(var(--card))', 
                                borderColor: 'hsl(var(--border))',
                                color: 'hsl(var(--foreground))'
                              }}
                              formatter={(value: number) => value.toFixed(3)}
                            />
                            <Legend wrapperStyle={{ color: 'hsl(var(--foreground))' }} />
                            <Scatter 
                              name="Normal" 
                              data={piG0ChartData.filter(d => d.condition === 'normal')}
                              fill="#4ade80"
                            />
                            <Scatter 
                              name="Mutant" 
                              data={piG0ChartData.filter(d => d.condition === 'mutant')}
                              fill="#f87171"
                            />
                            <Scatter 
                              name="Unknown" 
                              data={piG0ChartData.filter(d => d.condition === 'unknown')}
                              fill="#6b7280"
                            />
                          </ScatterChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    <Card className="border-border/50">
                      <CardHeader>
                        <CardTitle>Dataset Details</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-border">
                                <th className="text-left py-2 px-3">Dataset</th>
                                <th className="text-left py-2 px-3">Organism</th>
                                <th className="text-left py-2 px-3">Condition</th>
                                <th className="text-right py-2 px-3">Mean |λ|</th>
                                <th className="text-right py-2 px-3">Predicted π_G₀</th>
                              </tr>
                            </thead>
                            <tbody>
                              {piG0Data?.datasetMappings.slice(0, 20).map((d, i) => (
                                <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                                  <td className="py-2 px-3 font-mono text-xs">
                                    {d.dataset.substring(0, 40)}...
                                  </td>
                                  <td className="py-2 px-3">
                                    <Badge variant="outline" style={{ borderColor: ORGANISM_COLORS[d.organism] }}>
                                      {d.organism}
                                    </Badge>
                                  </td>
                                  <td className="py-2 px-3">
                                    <Badge 
                                      variant={d.condition === 'mutant' ? 'destructive' : d.condition === 'normal' ? 'default' : 'secondary'}
                                    >
                                      {d.condition}
                                    </Badge>
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono">{d.meanEigenvalue}</td>
                                  <td className="py-2 px-3 text-right font-mono">{d.predictedPiG0}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {speciesSubTab === 'methodology' && (
                  <div className="space-y-6">
                    <Card className="border-cyan-500/30">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Info className="h-5 w-5 text-cyan-400" />
                          Cross-Species Comparison Methodology
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="prose prose-invert max-w-none">
                          <p className="text-muted-foreground">
                            {crossSpeciesData?.methodology.description}
                          </p>
                          <div className="grid grid-cols-2 gap-4 mt-4">
                            <div className="p-4 bg-muted/30 rounded-lg">
                              <div className="font-semibold text-cyan-400">Stability Band</div>
                              <div className="text-sm text-muted-foreground mt-1">
                                {crossSpeciesData?.methodology.stabilityBand}
                              </div>
                            </div>
                            <div className="p-4 bg-muted/30 rounded-lg">
                              <div className="font-semibold text-purple-400">Interpretation</div>
                              <div className="text-sm text-muted-foreground mt-1">
                                {crossSpeciesData?.methodology.interpretation}
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-purple-500/30">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <TrendingUp className="h-5 w-5 text-purple-400" />
                          π_G₀ ↔ |λ| Mapping Formula
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="p-6 bg-muted/30 rounded-lg text-center">
                          <div className="text-2xl font-mono text-cyan-400">
                            π_G₀ = |λ|² / (1 + |λ|²)
                          </div>
                          <div className="text-sm text-muted-foreground mt-2">
                            {piG0Data?.methodology.formula}
                          </div>
                        </div>
                        <div className="prose prose-invert max-w-none">
                          <p className="text-muted-foreground">
                            <strong>Description:</strong> {piG0Data?.methodology.description}
                          </p>
                          <p className="text-muted-foreground">
                            <strong>Biological Basis:</strong> {piG0Data?.methodology.biologicalBasis}
                          </p>
                          <p className="text-muted-foreground">
                            <strong>Interpretation:</strong> {piG0Data?.methodology.interpretation}
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-amber-500/30">
                      <CardHeader>
                        <CardTitle>Stability Audit Report</CardTitle>
                        <CardDescription>
                          Download complete audit trail with timestamps for all PAR(2) analyses
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex gap-4">
                          <Button onClick={() => handleDownloadAudit('csv')} variant="outline">
                            <Download className="h-4 w-4 mr-2" />
                            Download CSV Report
                          </Button>
                          <Button onClick={() => handleDownloadAudit('json')} variant="outline">
                            <Download className="h-4 w-4 mr-2" />
                            Download JSON Report
                          </Button>
                        </div>
                        <p className="text-sm text-muted-foreground mt-4">
                          The Stability Audit Report includes: analysis timestamps, dataset names, organism classification,
                          clock-target gene pairs, p-values, significance flags, eigenvalue modulus values, and stability band classification.
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="tissue" className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <Layers className="h-8 w-8 text-red-400" />
                <h2 className="text-2xl font-bold" data-testid="text-page-title">Cross-Tissue Three-Layer Validation</h2>
                <Badge className="bg-red-500/20 text-red-300 border-red-500/30">8 Tissues</Badge>
              </div>
            </div>
            <p className="text-muted-foreground max-w-4xl">
              Testing whether cell-identity markers sit above clock genes, which sit above proliferation genes,
              independently in each tissue using tissue-specific identity marker panels from GSE54650 (Zhang et al. 2014).
            </p>

            <HowTo
              title="Cross-Tissue Three-Layer Validation"
              summary="Tests the Identity > Clock > Proliferation three-layer temporal hierarchy across 8 different tissues using the GSE54650 dataset. Permutation tests and bootstrap confidence intervals validate that the hierarchy is consistent and not tissue-specific."
              steps={[
                { label: "Browse tissues", detail: "Each panel shows one tissue with its Identity, Clock, and Proliferation mean eigenvalues." },
                { label: "Check the hierarchy", detail: "In each tissue, Identity markers should have the highest eigenvalue, followed by Clock, then Proliferation." },
                { label: "Review statistics", detail: "Permutation p-values and bootstrap CIs quantify whether each layer separation is statistically significant." }
              ]}
            />

            {loadingTissue ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center space-y-4">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto" />
                  <p className="text-muted-foreground">Running AR(2) across 8 tissues with tissue-specific identity markers...</p>
                </div>
              </div>
            ) : tissueError || !tissueData ? (
              <Card className="max-w-md mx-auto">
                <CardContent className="p-6 text-center">
                  <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
                  <p className="text-red-400">Analysis failed: {(tissueError as Error)?.message || 'Unknown error'}</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="bg-emerald-500/10 border-emerald-500/30">
                    <CardContent className="p-4 text-center">
                      <p className="text-3xl font-bold text-emerald-400" data-testid="text-confirmed">{tissueData.summary.nConfirmed}/{tissueData.summary.nTissues}</p>
                      <p className="text-sm text-muted-foreground">Full Hierarchy</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-amber-500/10 border-amber-500/30">
                    <CardContent className="p-4 text-center">
                      <p className="text-3xl font-bold text-amber-400" data-testid="text-partial">{tissueData.summary.nPartial}</p>
                      <p className="text-sm text-muted-foreground">Partial (I&gt;C only)</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-red-500/10 border-red-500/30">
                    <CardContent className="p-4 text-center">
                      <p className="text-3xl font-bold text-red-400" data-testid="text-ic-gap">{tissueData.summary.meanIdentityClockGap.toFixed(3)}</p>
                      <p className="text-sm text-muted-foreground">Mean I–C Gap</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-blue-500/10 border-blue-500/30">
                    <CardContent className="p-4 text-center">
                      <p className="text-3xl font-bold text-blue-400" data-testid="text-cp-gap">{tissueData.summary.meanClockProlifGap.toFixed(3)}</p>
                      <p className="text-sm text-muted-foreground">Mean C–P Gap</p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-red-400" />
                      Three-Layer Eigenvalue Means by Tissue
                    </CardTitle>
                    <CardDescription>
                      Red = tissue-specific identity markers, Amber = clock genes, Blue = proliferation genes.
                      Full hierarchy requires red above amber above blue.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={tissueBarData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis dataKey="tissue" tick={{ fill: '#6b7280', fontSize: 12 }} />
                        <YAxis tick={{ fill: '#6b7280' }} label={{ value: 'Mean |λ|', angle: -90, position: 'insideLeft', fill: '#6b7280' }} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                          labelStyle={{ color: '#334155' }}
                        />
                        <Legend />
                        <Bar dataKey="Identity" fill={LAYER_COLORS.identity} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Clock" fill={LAYER_COLORS.clock} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Proliferation" fill={LAYER_COLORS.proliferation} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Gap Analysis: Identity–Clock vs Clock–Proliferation</CardTitle>
                    <CardDescription>Both gaps should be positive for full three-layer hierarchy. Bootstrap 95% CIs shown below.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={tissueGapData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis dataKey="tissue" tick={{ fill: '#6b7280', fontSize: 12 }} />
                        <YAxis tick={{ fill: '#6b7280' }} label={{ value: 'Gap (Δ|λ|)', angle: -90, position: 'insideLeft', fill: '#6b7280' }} />
                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }} labelStyle={{ color: '#334155' }} />
                        <Legend />
                        <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
                        <Bar dataKey="Identity–Clock Gap" fill="#ef4444" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Clock–Prolif Gap" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>

                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                        <p className="text-sm font-semibold text-red-300">Identity–Clock Gap (Bootstrap 95% CI)</p>
                        <p className="text-xl font-bold text-slate-900 mt-1">
                          [{tissueData.bootstrapCI.identityClockGap.lower.toFixed(3)}, {tissueData.bootstrapCI.identityClockGap.upper.toFixed(3)}]
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Mean: {tissueData.bootstrapCI.identityClockGap.mean.toFixed(3)} —
                          {tissueData.bootstrapCI.identityClockGap.lower > 0 ? ' CI excludes zero ✓' : ' CI includes zero ⚠'}
                        </p>
                      </div>
                      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                        <p className="text-sm font-semibold text-blue-300">Clock–Proliferation Gap (Bootstrap 95% CI)</p>
                        <p className="text-xl font-bold text-slate-900 mt-1">
                          [{tissueData.bootstrapCI.clockProlifGap.lower.toFixed(3)}, {tissueData.bootstrapCI.clockProlifGap.upper.toFixed(3)}]
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Mean: {tissueData.bootstrapCI.clockProlifGap.mean.toFixed(3)} —
                          {tissueData.bootstrapCI.clockProlifGap.lower > 0 ? ' CI excludes zero ✓' : ' CI includes zero ⚠'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Per-Tissue Results</CardTitle>
                    <CardDescription>Click a tissue to see individual gene eigenvalues</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm" data-testid="table-tissue-results">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-2 px-3">Tissue</th>
                            <th className="text-left py-2 px-3">Identity Label</th>
                            <th className="text-right py-2 px-3">Identity |λ|</th>
                            <th className="text-right py-2 px-3">Clock |λ|</th>
                            <th className="text-right py-2 px-3">Prolif |λ|</th>
                            <th className="text-right py-2 px-3">I–C Gap</th>
                            <th className="text-right py-2 px-3">C–P Gap</th>
                            <th className="text-center py-2 px-3">Status</th>
                            <th className="text-right py-2 px-3">Genes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tissueData.tissues.map(t => (
                            <tr
                              key={t.tissue}
                              className={`border-b border-border/50 cursor-pointer hover:bg-muted/30 ${selectedTissue === t.tissue ? 'bg-muted/50' : ''}`}
                              onClick={() => setSelectedTissue(selectedTissue === t.tissue ? null : t.tissue)}
                              data-testid={`row-tissue-${t.tissue.toLowerCase().replace(/\s/g, '-')}`}
                            >
                              <td className="py-2 px-3 font-medium">{t.tissue}</td>
                              <td className="py-2 px-3 text-muted-foreground text-xs">{t.identityLabel}</td>
                              <td className="py-2 px-3 text-right font-mono text-red-400">{t.identityMean.toFixed(4)}</td>
                              <td className="py-2 px-3 text-right font-mono text-amber-400">{t.clockMean.toFixed(4)}</td>
                              <td className="py-2 px-3 text-right font-mono text-blue-400">{t.prolifMean.toFixed(4)}</td>
                              <td className={`py-2 px-3 text-right font-mono ${t.identityClockGap > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {t.identityClockGap > 0 ? '+' : ''}{t.identityClockGap.toFixed(4)}
                              </td>
                              <td className={`py-2 px-3 text-right font-mono ${t.clockProlifGap > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {t.clockProlifGap > 0 ? '+' : ''}{t.clockProlifGap.toFixed(4)}
                              </td>
                              <td className="py-2 px-3 text-center">
                                {t.hierarchyConfirmed ? (
                                  <CheckCircle className="h-4 w-4 text-emerald-400 inline" />
                                ) : t.identityClockGap > 0 ? (
                                  <AlertTriangle className="h-4 w-4 text-amber-400 inline" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-red-400 inline" />
                                )}
                              </td>
                              <td className="py-2 px-3 text-right text-xs text-muted-foreground">
                                {t.nIdentityFound}+{t.nClockFound}+{t.nProlifFound}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {tissueDetail && (
                  <Card className="border-red-500/30">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Layers className="h-5 w-5 text-red-400" />
                        {tissueDetail.tissue} — Gene-Level Detail
                      </CardTitle>
                      <CardDescription>{tissueDetail.identityLabel} markers vs clock vs proliferation ({tissueDetail.nTimepoints} timepoints)</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <h4 className="font-semibold text-red-400 text-sm">{tissueDetail.identityLabel} ({tissueDetail.nIdentityFound} genes)</h4>
                          {tissueDetail.identityGenes.map(g => (
                            <div key={g.gene} className="flex justify-between text-xs bg-red-500/5 rounded px-2 py-1">
                              <span className="text-red-300"><GeneTooltip gene={g.gene}>{g.gene}</GeneTooltip></span>
                              <span className="font-mono">{g.eigenvalue.toFixed(4)}</span>
                            </div>
                          ))}
                          <div className="text-xs text-muted-foreground pt-1">Mean: {tissueDetail.identityMean.toFixed(4)}</div>
                        </div>
                        <div className="space-y-2">
                          <h4 className="font-semibold text-amber-400 text-sm">Clock Genes ({tissueDetail.nClockFound} genes)</h4>
                          {tissueDetail.clockGenes.map(g => (
                            <div key={g.gene} className="flex justify-between text-xs bg-amber-500/5 rounded px-2 py-1">
                              <span className="text-amber-300"><GeneTooltip gene={g.gene}>{g.gene}</GeneTooltip></span>
                              <span className="font-mono">{g.eigenvalue.toFixed(4)}</span>
                            </div>
                          ))}
                          <div className="text-xs text-muted-foreground pt-1">Mean: {tissueDetail.clockMean.toFixed(4)}</div>
                        </div>
                        <div className="space-y-2">
                          <h4 className="font-semibold text-blue-400 text-sm">Proliferation ({tissueDetail.nProlifFound} genes)</h4>
                          {tissueDetail.prolifGenes.map(g => (
                            <div key={g.gene} className="flex justify-between text-xs bg-blue-500/5 rounded px-2 py-1">
                              <span className="text-blue-300"><GeneTooltip gene={g.gene}>{g.gene}</GeneTooltip></span>
                              <span className="font-mono">{g.eigenvalue.toFixed(4)}</span>
                            </div>
                          ))}
                          <div className="text-xs text-muted-foreground pt-1">Mean: {tissueDetail.prolifMean.toFixed(4)}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle>Permutation Tests (Identity–Clock Gap)</CardTitle>
                    <CardDescription>
                      10,000 label shuffles per tissue (seed=42). Tests whether identity markers being above clock genes could arise by chance.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm" data-testid="table-permutation">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-2 px-3">Tissue</th>
                            <th className="text-right py-2 px-3">Observed Gap</th>
                            <th className="text-right py-2 px-3">p-value</th>
                            <th className="text-right py-2 px-3">z-score</th>
                            <th className="text-center py-2 px-3">Significant?</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tissueData.permutationTests.map(p => (
                            <tr key={p.tissue} className="border-b border-border/50">
                              <td className="py-2 px-3 font-medium">{p.tissue}</td>
                              <td className="py-2 px-3 text-right font-mono">{p.observedGap.toFixed(4)}</td>
                              <td className="py-2 px-3 text-right font-mono">{p.pValue < 0.001 ? '<0.001' : p.pValue.toFixed(3)}</td>
                              <td className="py-2 px-3 text-right font-mono">{p.zScore.toFixed(2)}</td>
                              <td className="py-2 px-3 text-center">
                                {p.pValue < 0.05 ? (
                                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">p&lt;0.05</Badge>
                                ) : (
                                  <Badge className="bg-slate-500/20 text-slate-600 border-slate-300/30">n.s.</Badge>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                <Card className={tissueData.summary.nConfirmed >= tissueData.summary.nTissues * 0.75 ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5'}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {tissueData.summary.nConfirmed >= tissueData.summary.nTissues * 0.75 ? (
                        <CheckCircle className="h-5 w-5 text-emerald-400" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-amber-400" />
                      )}
                      Overall Verdict
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-lg" data-testid="text-verdict">{tissueData.summary.overallVerdict}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="font-semibold text-muted-foreground">Identity–Clock Gap (cross-tissue bootstrap 95% CI)</p>
                        <p className="font-mono">
                          [{tissueData.bootstrapCI.identityClockGap.lower.toFixed(4)}, {tissueData.bootstrapCI.identityClockGap.upper.toFixed(4)}]
                          {tissueData.bootstrapCI.identityClockGap.lower > 0 ? ' — excludes zero ✓' : ' — includes zero ⚠'}
                        </p>
                      </div>
                      <div>
                        <p className="font-semibold text-muted-foreground">Clock–Proliferation Gap (cross-tissue bootstrap 95% CI)</p>
                        <p className="font-mono">
                          [{tissueData.bootstrapCI.clockProlifGap.lower.toFixed(4)}, {tissueData.bootstrapCI.clockProlifGap.upper.toFixed(4)}]
                          {tissueData.bootstrapCI.clockProlifGap.lower > 0 ? ' — excludes zero ✓' : ' — includes zero ⚠'}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Tissue-specific identity markers: hepatocyte (liver), nephron/podocyte (kidney), cardiomyocyte (heart),
                      pulmonary epithelial (lung), myocyte (muscle), neural (cerebellum), brown adipocyte (brown fat),
                      white adipocyte (white fat). All from GSE54650 (Zhang et al. 2014, 24 timepoints per tissue).
                    </p>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="cross-context" className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-3">
                <Activity className="h-6 w-6 text-orange-400" />
                WT vs Cancer/Mutant Comparison
              </h2>
              <p className="text-muted-foreground mt-1">
                Cross-context comparison of gating relationships between healthy and cancer/mutant datasets
              </p>
            </div>

            {loadingCrossContext ? (
              <Card className="border-border/50">
                <CardContent className="py-12">
                  <div className="flex items-center justify-center" data-testid="cross-context-loading">
                    <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
                    <span className="ml-3 text-muted-foreground">Loading cross-context comparison...</span>
                  </div>
                </CardContent>
              </Card>
            ) : crossContextError ? (
              <Card className="border-red-500/30">
                <CardContent className="py-12 text-center">
                  <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
                  <p className="text-red-400" data-testid="cross-context-error">
                    Failed to load comparison data: {(crossContextError as Error)?.message || 'Unknown error'}
                  </p>
                </CardContent>
              </Card>
            ) : !crossContextData || !crossContextData.allComparisons || crossContextData.allComparisons.length === 0 ? (
              <Card className="border-border/50">
                <CardContent className="py-12 text-center">
                  <Info className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground" data-testid="cross-context-empty">
                    No cross-context comparison data available. Run analyses across healthy and cancer/mutant datasets to see comparison results.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card className="border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-transparent">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Healthy Datasets</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-cyan-400" data-testid="text-healthy-datasets">
                        {crossContextData.summary.healthyDatasetsAnalyzed}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-purple-500/30 bg-gradient-to-br from-purple-500/10 to-transparent">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Cancer/Mutant Datasets</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-purple-400" data-testid="text-cancer-datasets">
                        {crossContextData.summary.cancerDatasetsAnalyzed}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-green-500/30 bg-gradient-to-br from-green-500/10 to-transparent">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Total Pairs Compared</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-green-400" data-testid="text-total-pairs">
                        {crossContextData.summary.totalPairsCompared}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-transparent">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Patterns Found</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-1" data-testid="text-patterns-found">
                        <Badge variant="outline" className="text-red-400 border-red-500/30">
                          Lost: {crossContextData.summary.patternsFound.lostInCancer}
                        </Badge>
                        <Badge variant="outline" className="text-green-400 border-green-500/30">
                          Gained: {crossContextData.summary.patternsFound.gainedInCancer}
                        </Badge>
                        <Badge variant="outline" className="text-muted-foreground border-border/50">
                          Stable: {crossContextData.summary.patternsFound.stable}
                        </Badge>
                        <Badge variant="outline" className="text-amber-400 border-amber-500/30">
                          Variable: {crossContextData.summary.patternsFound.variable}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {crossContextData.keyFindings.lostInCancer.length > 0 && (
                  <Card className="border-red-500/30 bg-red-500/5">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-red-400">
                        <AlertTriangle className="h-5 w-5" />
                        Lost in Cancer
                      </CardTitle>
                      <CardDescription>
                        Gating relationships that are significant in healthy tissue but break down in cancer/mutant contexts
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2" data-testid="list-lost-in-cancer">
                        {crossContextData.keyFindings.lostInCancer.map((item, i) => (
                          <div key={i} className="flex items-center justify-between bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3" data-testid={`card-lost-${i}`}>
                            <div className="flex items-center gap-3">
                              <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                              <span className="font-mono text-sm">
                                <GeneTooltip gene={item.clockGene}>{item.clockGene}</GeneTooltip> → <GeneTooltip gene={item.targetGene}>{item.targetGene}</GeneTooltip>
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                              <div className="text-right">
                                <span className="text-green-400 font-mono">{(item.healthyRate * 100).toFixed(0)}%</span>
                                <span className="text-muted-foreground mx-1">→</span>
                                <span className="text-red-400 font-mono">{(item.cancerRate * 100).toFixed(0)}%</span>
                              </div>
                              <Badge variant="outline" className="text-red-400 border-red-500/30 font-mono">
                                Δ{(item.rateDifference * 100).toFixed(0)}%
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {crossContextData.keyFindings.gainedInCancer.length > 0 && (
                  <Card className="border-green-500/30 bg-green-500/5">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-green-400">
                        <TrendingUp className="h-5 w-5" />
                        Gained in Cancer
                      </CardTitle>
                      <CardDescription>
                        New gating relationships that emerge in cancer/mutant contexts but are absent in healthy tissue
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2" data-testid="list-gained-in-cancer">
                        {crossContextData.keyFindings.gainedInCancer.map((item, i) => (
                          <div key={i} className="flex items-center justify-between bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-3" data-testid={`card-gained-${i}`}>
                            <div className="flex items-center gap-3">
                              <CheckCircle className="h-4 w-4 text-green-400 shrink-0" />
                              <span className="font-mono text-sm">
                                <GeneTooltip gene={item.clockGene}>{item.clockGene}</GeneTooltip> → <GeneTooltip gene={item.targetGene}>{item.targetGene}</GeneTooltip>
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                              <div className="text-right">
                                <span className="text-muted-foreground font-mono">{(item.healthyRate * 100).toFixed(0)}%</span>
                                <span className="text-muted-foreground mx-1">→</span>
                                <span className="text-green-400 font-mono">{(item.cancerRate * 100).toFixed(0)}%</span>
                              </div>
                              <Badge variant="outline" className="text-green-400 border-green-500/30 font-mono">
                                +{(item.rateDifference * 100).toFixed(0)}%
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card className="border-border/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-cyan-400" />
                      All Comparisons
                    </CardTitle>
                    <CardDescription>
                      Complete list of {crossContextData.allComparisons.length} gene pairs compared across healthy and cancer/mutant contexts
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm" data-testid="table-cross-context">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-2 px-3">Clock Gene</th>
                            <th className="text-left py-2 px-3">Target Gene</th>
                            <th className="text-right py-2 px-3">Healthy Rate</th>
                            <th className="text-right py-2 px-3">Cancer Rate</th>
                            <th className="text-right py-2 px-3">Difference</th>
                            <th className="text-center py-2 px-3">Pattern</th>
                          </tr>
                        </thead>
                        <tbody>
                          {crossContextData.allComparisons.map((comp, i) => (
                            <tr key={i} className="border-b border-border/50 hover:bg-muted/30" data-testid={`row-comparison-${i}`}>
                              <td className="py-2 px-3 font-mono"><GeneTooltip gene={comp.clockGene}>{comp.clockGene}</GeneTooltip></td>
                              <td className="py-2 px-3 font-mono"><GeneTooltip gene={comp.targetGene}>{comp.targetGene}</GeneTooltip></td>
                              <td className="py-2 px-3 text-right font-mono">
                                {(comp.healthyRate * 100).toFixed(0)}%
                                <span className="text-muted-foreground ml-1 text-xs">({comp.healthySignificant}/{comp.healthyTotal})</span>
                              </td>
                              <td className="py-2 px-3 text-right font-mono">
                                {(comp.cancerRate * 100).toFixed(0)}%
                                <span className="text-muted-foreground ml-1 text-xs">({comp.cancerSignificant}/{comp.cancerTotal})</span>
                              </td>
                              <td className={`py-2 px-3 text-right font-mono ${comp.rateDifference > 0 ? 'text-green-400' : comp.rateDifference < 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
                                {comp.rateDifference > 0 ? '+' : ''}{(comp.rateDifference * 100).toFixed(0)}%
                              </td>
                              <td className="py-2 px-3 text-center">
                                <Badge
                                  variant="outline"
                                  className={
                                    comp.pattern === 'LOST_IN_CANCER' ? 'text-red-400 border-red-500/30' :
                                    comp.pattern === 'GAINED_IN_CANCER' ? 'text-green-400 border-green-500/30' :
                                    comp.pattern === 'STABLE' ? 'text-cyan-400 border-cyan-500/30' :
                                    'text-amber-400 border-amber-500/30'
                                  }
                                >
                                  {comp.pattern === 'LOST_IN_CANCER' ? 'Lost' :
                                   comp.pattern === 'GAINED_IN_CANCER' ? 'Gained' :
                                   comp.pattern === 'STABLE' ? 'Stable' : 'Variable'}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
