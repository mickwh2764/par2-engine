import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { APP_VERSION } from "@/lib/version";
import { Link } from "wouter";
import { trackEvent } from "@/lib/analytics";
import EvidenceLink from "@/components/EvidenceLink";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, Cell, ScatterChart, Scatter, ZAxis
} from "recharts";
import { 
  Activity, Dna, Clock, Zap, ArrowRight, FileText, 
  CheckCircle2, XCircle, FlaskConical, Upload, Play, Loader2, Search,
  Download, Settings, UploadCloud, FileUp, X, AlertCircle,
  FileDown, BarChart3, GitCompare, BookOpen, CheckSquare, Square,
  HelpCircle, ChevronRight, ChevronDown, ChevronUp, Image, FileImage, TrendingUp, AlertTriangle,
  ExternalLink, BarChart2, Sparkles, Shield, ShieldCheck, Target, Printer, Lock, Info, GitBranch, Package,
  Beaker, Globe, Atom, Layers, Moon, Heart, Flame, Microscope, Mountain, Pill, Bug, Network, MapPin
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { exportChartAsImage, exportChartAsSVG, RESOLUTION_PRESETS, printAnalysisResults } from "@/lib/export-chart";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import ForceGraph2D from "react-force-graph-2d";
import { PhaseHeatmap } from "@/components/PhaseHeatmap";
import {
  GENE_COLORS, CLOCK_COLORS, TARGET_COLORS,
  type ConfidenceInterval, type ClockRhythmicityCheck, type DataQualityWarnings,
  type Hypothesis, type AnalysisRun, type Config, type DatasetInfo, type EmbeddedDataset,
  type ProteomicsRun, type ProteomicsResult, type ConcordanceResult,
  type CrossTissuePair, type GatingCentrality, type CrossTissueConsensusData,
  type MethodComparisonData, type EigenvaluePoint, type CoefficientPoint,
  type NetworkNode, type NetworkLink,
} from "./dashboard/types";
import { UnitCircleDiagram } from "./dashboard/UnitCircleDiagram";
import { StabilityTriangleDiagram } from "./dashboard/StabilityTriangleDiagram";
import { ChartExportButton } from "./dashboard/ChartExportButton";
import { StatCard, ResultCard } from "./dashboard/StatCard";

function MethodComparisonCard({ 
  runId, 
  hypothesisId,
  clockGene,
  targetGene
}: { 
  runId?: string; 
  hypothesisId?: string;
  clockGene?: string;
  targetGene?: string;
}) {
  const [comparison, setComparison] = useState<MethodComparisonData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!runId || !hypothesisId) {
      setComparison(null);
      return;
    }

    const fetchComparison = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/analyses/${runId}/hypothesis/${hypothesisId}/method-comparison`);
        if (!response.ok) {
          throw new Error('Failed to fetch comparison');
        }
        const data = await response.json();
        setComparison(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchComparison();
  }, [runId, hypothesisId]);

  if (!runId || !hypothesisId) {
    return null;
  }

  const confidenceLevelColors: Record<string, string> = {
    HIGH: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    MEDIUM: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    LOW: 'text-red-400 bg-red-500/10 border-red-500/30'
  };

  return (
    <Card className="border-cyan-500/30 bg-cyan-500/5" data-testid="method-comparison-card">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BarChart3 size={16} className="text-cyan-400" />
            <div>
              <p className="text-xs text-cyan-400 uppercase tracking-wider font-semibold">
                Method Comparison: PAR(2) vs Cosinor
              </p>
              <p className="text-xs text-muted-foreground">
                {clockGene} → {targetGene}
              </p>
            </div>
          </div>
          {comparison?.confidence && (
            <Badge 
              variant="outline" 
              className={`text-xs ${confidenceLevelColors[comparison.confidence.level]}`}
            >
              {comparison.confidence.level} CONFIDENCE
            </Badge>
          )}
        </div>

        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 size={14} className="animate-spin" />
            <span className="text-sm">Loading comparison...</span>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-400">Error: {error}</p>
        )}

        {!isLoading && !error && comparison && !comparison.available && (
          <p className="text-sm text-muted-foreground">{comparison.message || 'Comparison not available'}</p>
        )}

        {!isLoading && !error && comparison?.available && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-2 bg-secondary/30 rounded">
                <p className="text-xs text-muted-foreground uppercase mb-1">PAR(2) Phase-Gating</p>
                <ul className="text-xs space-y-1">
                  <li>
                    p-value: <span className="font-mono font-semibold">{comparison.par2?.pValue?.toExponential(2) ?? 'N/A'}</span>
                    {comparison.par2?.fdr != null && (
                      <span className="text-muted-foreground"> (FDR {comparison.par2.fdr.toExponential(2)})</span>
                    )}
                  </li>
                  <li>
                    Effect size: <span className="font-mono font-semibold">{comparison.par2?.effectSize?.toFixed(3) ?? 'N/A'}</span>
                  </li>
                  <li>
                    R² change: <span className="font-mono font-semibold">{comparison.par2?.rSquaredChange != null ? (comparison.par2.rSquaredChange * 100).toFixed(2) + '%' : 'N/A'}</span>
                  </li>
                  <li>
                    Result: <span className={`font-semibold ${comparison.par2?.isSignificant ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                      {comparison.par2?.isSignificant ? 'Significant gating' : 'No significant gating'}
                    </span>
                  </li>
                </ul>
              </div>
              <div className="p-2 bg-secondary/30 rounded">
                <p className="text-xs text-muted-foreground uppercase mb-1">Cosinor Rhythmicity (24h)</p>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="text-left font-normal"></th>
                      <th className="text-right font-normal">Amp</th>
                      <th className="text-right font-normal">Peak</th>
                      <th className="text-right font-normal">R²</th>
                      <th className="text-right font-normal">p</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="text-left">{clockGene}</td>
                      <td className="text-right font-mono">{comparison.cosinor?.clock?.amplitude?.toFixed(1) ?? '-'}%</td>
                      <td className="text-right font-mono">{comparison.cosinor?.clock?.phase?.toFixed(1) ?? '-'}h</td>
                      <td className="text-right font-mono">{comparison.cosinor?.clock?.r2 != null ? (comparison.cosinor.clock.r2 * 100).toFixed(0) : '-'}%</td>
                      <td className="text-right font-mono">{comparison.cosinor?.clock?.pValue?.toExponential(1) ?? '-'}</td>
                    </tr>
                    <tr>
                      <td className="text-left">{targetGene}</td>
                      <td className="text-right font-mono">{comparison.cosinor?.target?.amplitude?.toFixed(1) ?? '-'}%</td>
                      <td className="text-right font-mono">{comparison.cosinor?.target?.phase?.toFixed(1) ?? '-'}h</td>
                      <td className="text-right font-mono">{comparison.cosinor?.target?.r2 != null ? (comparison.cosinor.target.r2 * 100).toFixed(0) : '-'}%</td>
                      <td className="text-right font-mono">{comparison.cosinor?.target?.pValue?.toExponential(1) ?? '-'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {comparison.confidence && (
              <div className={`p-3 rounded border ${confidenceLevelColors[comparison.confidence.level]}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm">{comparison.confidence.label}</span>
                  {comparison.confidence.par2Specific && (
                    <Badge variant="outline" className="text-xs text-cyan-400 border-cyan-400/50">
                      PAR(2)-specific
                    </Badge>
                  )}
                </div>
                <p className="text-sm">{comparison.confidence.explanation}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}



function EmbeddedDatasetSelector({ 
  onLoadDataset, 
  uploadedFiles 
}: { 
  onLoadDataset: (id: string, filename: string) => void;
  uploadedFiles: File[];
}) {
  const { data: datasets = [], isLoading } = useQuery<EmbeddedDataset[]>({
    queryKey: ["/api/datasets/embedded"],
    queryFn: async () => {
      const response = await fetch("/api/datasets/embedded");
      if (!response.ok) throw new Error("Failed to fetch embedded datasets");
      return response.json();
    }
  });

  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [dsSearch, setDsSearch] = useState("");

  const handleLoad = async (dataset: EmbeddedDataset) => {
    setLoadingId(dataset.id);
    await onLoadDataset(dataset.id, dataset.filename);
    setLoadingId(null);
  };

  if (isLoading) {
    return (
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading embedded datasets...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (datasets.length === 0) return null;

  const groupedByStudy = datasets.reduce((acc, d) => {
    if (!acc[d.study]) acc[d.study] = [];
    acc[d.study].push(d);
    return acc;
  }, {} as Record<string, EmbeddedDataset[]>);

  const studyLabels: Record<string, string> = {
    'GSE54650':       'Hughes Circadian Atlas',
    'GSE157357':      'Karpowicz Intestinal Organoids',
    'GSE221103':      'Human Neuroblastoma MYC ON/OFF',
    'GSE17739':       'Kidney Segments',
    'GSE59396':       'Lung Inflammation',
    'Jóhönnuson 2025':'Human Plasma Proteome',
    'Wang 2018':      'Mouse Liver Proteome',
    'CGM Combined':   'Blood Glucose CGM',
    'Zhao 2023':      'T2DM Blood Glucose',
    // Newly catalogued datasets
    'GSE70499':       'BMAL1 KO vs WT Liver',
    'GSE11923':       'Mouse Liver High-Resolution',
    'GSE113883':      'Human Whole Blood (TimeSignature)',
    'GSE98965':       'Baboon Circadian Atlas',
    'GSE108539':      'Human Skeletal Muscle Circadian',
    'GSE161566':      'Human Intestinal Enteroid',
    'GSE179027':      'Mouse Intestinal Enteroid',
    'GSE19271':       'Arabidopsis thaliana (Covington)',
    'GSE37278':       'Arabidopsis thaliana (Michael)',
    'GSE232040':      'GBM Zman-seq',
    'GSE24416':       'P. falciparum IDC',
    'GSE25585':       'Mouse Macrophage Circadian',
    'GSE3830':        'Drosophila LD→DD',
    'GSE6491':        'Drosophila (Claridge-Chang)',
    'GSE56931':       'Sleep Deprivation Study',
    'Arbeitman 2002': 'Drosophila Development',
    'Amit 2009':      'Dendritic Cell LPS Response',
    'GSE48113':       'Forced Desynchrony (Archer)',
    'GSE39445':       'Sleep Restriction (Möller-Levet)',
    'GSE122541':      'Nurses Day/Night Shift',
    'GSE201207':      'Kidney Aging Study',
    'GSE3431':        'Yeast Metabolic Cycle',
  };

  const studyMeta: Record<string, string> = {
    'GSE54650':        'Mouse · 24 timepoints · 2h interval',
    'GSE157357':       'Mouse · 22 timepoints · 2h interval · 4 genotypes',
    'GSE221103':       'Human · 6 timepoints · MYC ON / MYC OFF',
    'GSE17739':        'Mouse · kidney cortex segments · 24h',
    'GSE59396':        'Mouse · lung inflammation time course',
    'Jóhönnuson 2025': 'Human · plasma proteome · 24h rhythms',
    'Wang 2018':       'Mouse · liver proteome · 24h',
    'CGM Combined':    'Human · continuous glucose monitoring',
    'Zhao 2023':       'Human · T2DM blood glucose · CGM',
    'GSE70499':        'Mouse · liver · Bmal1 WT vs KO · 12 timepoints',
    'GSE11923':        'Mouse · liver · 1h interval · 48h',
    'GSE113883':       'Human · whole blood · multi-subject',
    'GSE98965':        'Baboon · multi-tissue · diurnal (Mure 2018)',
    'GSE108539':       'Human · skeletal muscle · circadian',
    'GSE161566':       'Human · intestinal enteroid · 24 timepoints',
    'GSE179027':       'Mouse · intestinal enteroid · 24 timepoints',
    'GSE19271':        'Arabidopsis · WT · constant light',
    'GSE37278':        'Arabidopsis · WT · constant light',
    'GSE232040':       'Human · GBM · single-cell temporal profiling',
    'GSE24416':        'P. falciparum · intraerythrocytic development',
    'GSE25585':        'Mouse · peritoneal macrophage · circadian',
    'GSE3830':         'Drosophila · whole fly · LD→DD transition',
    'GSE6491':         'Drosophila · whole fly · WT vs arrhythmic',
    'GSE56931':        'Human · blood · pre-sleep-deprivation baseline',
    'Arbeitman 2002':  'Drosophila · full development · 66 timepoints',
    'Amit 2009':       'Mouse · dendritic cell · LPS 0–6h',
    'GSE48113':        'Human · blood · forced desynchrony protocol',
    'GSE39445':        'Human · leukocyte · sleep restriction vs sufficient',
    'GSE122541':       'Human · PBMC · day vs night-shift nurses',
    'GSE201207':       'Mouse · kidney · young animals',
    'GSE3431':         'S. cerevisiae · metabolic oscillation cycle',
  };

  const searchLower = dsSearch.toLowerCase();
  let totalVisible = 0;

  return (
    <Card className="border-emerald-500/40 bg-gradient-to-br from-emerald-500/10 to-transparent ring-2 ring-emerald-500/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Dna size={16} className="text-emerald-400" />
            <span className="text-emerald-400">Click a Dataset to Run Analysis</span>
            <Badge className="bg-emerald-500 text-slate-900 text-[10px] ml-2">START HERE</Badge>
          </CardTitle>
          <div className="relative w-44 flex-shrink-0">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Filter datasets…"
              value={dsSearch}
              onChange={e => setDsSearch(e.target.value)}
              className="h-7 pl-7 text-xs"
            />
          </div>
        </div>
        <CardDescription className="text-xs">
          {dsSearch ? `Matching "${dsSearch}" — ` : ""}
          {datasets.length} datasets across {Object.keys(groupedByStudy).length} studies.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(groupedByStudy).map(([study, studyDatasets]) => {
          const studyLabel = studyLabels[study] || study;
          const meta = studyMeta[study] || "";
          const countLabel = studyDatasets.length === 1 ? 'condition' :
                            study === 'GSE54650' ? 'tissues' : 'conditions';

          const filtered = dsSearch
            ? studyDatasets.filter(d =>
                d.tissue.toLowerCase().includes(searchLower) ||
                (d.condition ?? "").toLowerCase().includes(searchLower) ||
                study.toLowerCase().includes(searchLower) ||
                studyLabel.toLowerCase().includes(searchLower)
              )
            : studyDatasets;

          if (filtered.length === 0) return null;
          totalVisible += filtered.length;

          return (
            <div key={study}>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mb-2">
                <span className="text-xs font-semibold text-foreground">{studyLabel}</span>
                <span className="text-[10px] font-mono text-muted-foreground">{study}</span>
                {meta && <span className="text-[10px] text-muted-foreground/70">· {meta}</span>}
                <span className="text-[10px] text-muted-foreground ml-auto">{filtered.length} {countLabel}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {filtered.map(dataset => {
                  const isLoaded = uploadedFiles.some(f => f.name === dataset.filename);
                  const isCurrentlyLoading = loadingId === dataset.id;

                  return (
                    <Button
                      key={dataset.id}
                      variant={isLoaded ? "default" : "outline"}
                      size="sm"
                      className={`text-xs h-auto py-2 px-3 flex flex-col items-start gap-0.5 w-full overflow-hidden ${
                        isLoaded ? 'bg-primary/20 border-primary text-primary' : ''
                      }`}
                      onClick={() => !isLoaded && handleLoad(dataset)}
                      disabled={isLoaded || isCurrentlyLoading}
                      data-testid={`button-load-${dataset.id}`}
                    >
                      <span className="flex items-center gap-1.5 font-medium w-full min-w-0">
                        <span className="flex-shrink-0">
                          {isCurrentlyLoading ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : isLoaded ? (
                            <CheckCircle2 size={12} />
                          ) : (
                            <Activity size={12} />
                          )}
                        </span>
                        <span className="truncate">{dataset.tissue}</span>
                      </span>
                      {dataset.condition && (
                        <span className="text-[10px] text-muted-foreground truncate w-full leading-tight">
                          {dataset.condition}
                        </span>
                      )}
                    </Button>
                  );
                })}
              </div>
            </div>
          );
        })}
        {dsSearch && totalVisible === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No datasets match "{dsSearch}"
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// Batch Analysis Progress Component
function BatchAnalysisProgress({ 
  progress, 
  onRunAll 
}: { 
  progress: {
    status: 'idle' | 'running' | 'completed' | 'failed';
    currentTissue: string;
    completedTissues: number;
    totalTissues: number;
    results?: Array<{ tissue: string; significantCount: number; totalPairs: number }>;
  };
  onRunAll: () => void;
}) {
  const isRunning = progress.status === 'running';
  const isCompleted = progress.status === 'completed';
  const { data: organoidApiData } = useQuery<any>({
    queryKey: ['/api/analyses/organoids'],
    staleTime: Infinity,
    enabled: isCompleted,
  });
  const progressPercent = progress.totalTissues > 0 
    ? (progress.completedTissues / progress.totalTissues) * 100 
    : 0;

  const totalSignificant = progress.results?.reduce((sum, r) => sum + r.significantCount, 0) || 0;
  const totalTests = progress.results?.reduce((sum, r) => sum + r.totalPairs, 0) || 0;

  return (
    <Card className="border-amber-500/40 bg-gradient-to-br from-amber-500/10 to-transparent ring-2 ring-amber-500/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2 text-amber-400">
          <Zap size={16} className="animate-pulse" />
          Cross-Tissue Batch Analysis
          <Badge className="bg-amber-500 text-slate-900 text-[10px] ml-2 animate-pulse">RUN ALL</Badge>
        </CardTitle>
        <CardDescription className="text-xs">
          Analyze all 12 GSE54650 tissues at once with 152 gene pairs each
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {progress.status === 'idle' && (
          <Button 
            onClick={onRunAll}
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500"
            data-testid="button-run-all-tissues"
          >
            <Play size={16} className="mr-2" />
            Run All 12 Tissues (1,824 tests)
          </Button>
        )}

        {isRunning && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Analyzing: <span className="text-emerald-400 font-medium">{progress.currentTissue}</span>
              </span>
              <span className="text-emerald-400">
                {progress.completedTissues}/{progress.totalTissues}
              </span>
            </div>
            <Progress value={progressPercent} className="h-2" />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 size={12} className="animate-spin" />
              Processing tissues sequentially...
            </div>
          </div>
        )}

        {isCompleted && progress.results && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-emerald-400">
              <CheckCircle2 size={16} />
              Completed! {totalSignificant} significant findings across {progress.totalTissues} tissues
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {progress.results.map((result) => (
                <div 
                  key={result.tissue}
                  className={`p-2 rounded-lg text-xs ${
                    result.significantCount > 0 
                      ? 'bg-emerald-500/20 border border-emerald-500/30' 
                      : 'bg-slate-50 border border-slate-200'
                  }`}
                >
                  <div className="font-medium">{result.tissue}</div>
                  <div className={result.significantCount > 0 ? 'text-emerald-400' : 'text-muted-foreground'}>
                    {result.significantCount}/{result.totalPairs} significant
                  </div>
                </div>
              ))}
            </div>
            {/* EXPORT RESULTS - USER-FRIENDLY DOWNLOAD */}
            <div className="p-4 mb-4 rounded-lg border-2 border-cyan-500/50 bg-cyan-500/10">
              <div className="flex items-center gap-2 mb-2">
                <Download size={18} className="text-cyan-400" />
                <span className="text-sm font-bold text-cyan-400">Export Your Results</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Download your analysis results as a spreadsheet for further analysis or sharing.
              </p>
              <Button 
                variant="default" 
                size="lg" 
                className="w-full bg-cyan-600 hover:bg-cyan-700 text-slate-900 font-semibold"
                data-testid="button-export-results"
                onClick={() => {
                  const a = document.createElement('a');
                  a.href = '/api/download/supplementary-data';
                  a.download = `PAR2_Analysis_Results_${new Date().toISOString().split('T')[0]}.csv`;
                  a.click();
                }}
              >
                <Download size={16} className="mr-2" />
                Export Results (CSV)
              </Button>
            </div>
            
            <div className="flex flex-col gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                data-testid="button-download-summary-report"
                onClick={() => {
                  const a = document.createElement('a');
                  a.href = '/api/download/cross-tissue-report';
                  a.download = `PAR2_Summary_Report_${new Date().toISOString().split('T')[0]}.md`;
                  a.click();
                }}
              >
                <Download size={14} className="mr-2" />
                Summary Report
              </Button>
            </div>
            
            {/* Organoid Comparison Section */}
            <div className="mt-4 pt-4 border-t border-purple-500/20">
              <div className="flex items-center gap-2 mb-2">
                <FlaskConical size={14} className="text-purple-400" />
                <span className="text-sm font-medium text-purple-400">Compare with Organoids (GSE157357)</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Compare your tissue findings with intestinal organoid data - see which gating relationships are conserved
              </p>
              {organoidApiData?.temporalCoverageCaveat && (
                <div
                  className="flex items-start gap-2 rounded-md border border-amber-400/60 bg-amber-50/80 px-3 py-2 mb-3"
                  data-testid="organoid-temporal-caveat-banner"
                >
                  <AlertTriangle size={13} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-800 leading-snug">
                    <strong className="font-semibold">⚠ Temporal coverage caveat:</strong>{' '}
                    {organoidApiData.temporalCoverageCaveat}
                  </p>
                </div>
              )}
              <div className="flex flex-col gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full border-purple-500/50 hover:bg-purple-500/10"
                  data-testid="button-view-organoid-results"
                  onClick={() => {
                    window.open('/api/analyses/organoids', '_blank');
                  }}
                >
                  <FlaskConical size={14} className="mr-2" />
                  View Organoid Results
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full border-purple-500/50 hover:bg-purple-500/10"
                  data-testid="button-download-tissue-organoid-comparison"
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = '/api/download/tissue-vs-organoid-report';
                    a.download = `PAR2_Tissue_vs_Organoid_Comparison_${new Date().toISOString().split('T')[0]}.md`;
                    a.click();
                  }}
                >
                  <GitCompare size={14} className="mr-2" />
                  Download Comparison Report
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Organoid Batch Analysis Progress Component
function OrganoidBatchProgress({ 
  progress, 
  onRunAll 
}: { 
  progress: {
    status: 'idle' | 'running' | 'completed' | 'failed';
    currentCondition: string;
    completedConditions: number;
    totalConditions: number;
    results?: Array<{ condition: string; significantCount: number; totalPairs: number }>;
  };
  onRunAll: () => void;
}) {
  const isRunning = progress.status === 'running';
  const isCompleted = progress.status === 'completed';
  const progressPercent = progress.totalConditions > 0 
    ? (progress.completedConditions / progress.totalConditions) * 100 
    : 0;

  const totalSignificant = progress.results?.reduce((sum, r) => sum + r.significantCount, 0) || 0;
  const totalTests = progress.results?.reduce((sum, r) => sum + r.totalPairs, 0) || 0;

  const { data: organoidApiData } = useQuery<any>({
    queryKey: ['/api/analyses/organoids'],
    staleTime: Infinity,
  });

  return (
    <Card className="border-purple-500/30 bg-gradient-to-br from-purple-500/10 to-transparent">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2 text-purple-400">
          <FlaskConical size={16} />
          Organoid Batch Analysis
        </CardTitle>
        <CardDescription className="text-xs">
          Analyze all 4 GSE157357 organoid conditions (WT, BMAL1-KO, APC-KO, Double-KO)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Temporal coverage caveat — shown always so users see it before running or reading results */}
        {organoidApiData?.temporalCoverageCaveat && (
          <div
            className="flex items-start gap-2 rounded-md border border-amber-400/60 bg-amber-50/80 px-3 py-2"
            data-testid="organoid-batch-temporal-caveat-banner"
          >
            <AlertTriangle size={13} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-800 leading-snug">
              <strong className="font-semibold">⚠ Temporal coverage caveat (GSE157357):</strong>{' '}
              {organoidApiData.temporalCoverageCaveat}
            </p>
          </div>
        )}

        {progress.status === 'idle' && (
          <Button 
            onClick={onRunAll}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500"
            data-testid="button-run-all-organoids"
          >
            <Play size={16} className="mr-2" />
            Run All 4 Conditions (~600 tests)
          </Button>
        )}

        {isRunning && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Analyzing: <span className="text-purple-400 font-medium">{progress.currentCondition}</span>
              </span>
              <span className="text-purple-400">
                {progress.completedConditions}/{progress.totalConditions}
              </span>
            </div>
            <Progress value={progressPercent} className="h-2" />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 size={12} className="animate-spin" />
              Processing organoid conditions...
            </div>
          </div>
        )}

        {isCompleted && progress.results && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-purple-400">
              <CheckCircle2 size={16} />
              Completed! {totalSignificant} significant findings across {progress.totalConditions} conditions
            </div>
            <div className="grid grid-cols-2 gap-2">
              {progress.results.map((result) => (
                <div 
                  key={result.condition}
                  className={`p-2 rounded-lg text-xs ${
                    result.significantCount > 0 
                      ? 'bg-purple-500/20 border border-purple-500/30' 
                      : 'bg-slate-50 border border-slate-200'
                  }`}
                >
                  <div className="font-medium">{result.condition}</div>
                  <div className={result.significantCount > 0 ? 'text-purple-400' : 'text-muted-foreground'}>
                    {result.significantCount}/{result.totalPairs} significant
                  </div>
                </div>
              ))}
            </div>
            <div className="text-xs text-muted-foreground bg-purple-500/10 p-2 rounded-lg">
              <strong>Key insight:</strong> Compare APC-KO/WT (high gating) vs APC-KO/BMAL1-KO (low gating) - BMAL1 is essential for clock control of cancer genes. <EvidenceLink label="See cross-condition analysis" to="/framework-benchmarks" hash="ueda-detail" variant="inline" /> <EvidenceLink label="Root-space shifts" to="/root-space" hash="perturbation-shifts" variant="inline" /> <EvidenceLink label="Core evidence" to="/core-evidence" variant="inline" />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const EMBEDDED_DATASETS = [
  { id: "GSE54650_Kidney_circadian.csv", name: "Kidney (GSE54650)" },
  { id: "GSE54650_Liver_circadian.csv", name: "Liver (GSE54650)" },
  { id: "GSE54650_Heart_circadian.csv", name: "Heart (GSE54650)" },
  { id: "GSE54650_Lung_circadian.csv", name: "Lung (GSE54650)" },
  { id: "GSE54650_Muscle_circadian.csv", name: "Muscle (GSE54650)" },
  { id: "GSE54650_Adrenal_circadian.csv", name: "Adrenal (GSE54650)" },
  { id: "GSE54650_Brown_Fat_circadian.csv", name: "Brown Fat (GSE54650)" },
  { id: "GSE54650_White_Fat_circadian.csv", name: "White Fat (GSE54650)" },
  { id: "GSE157357_APC-Mut_BMAL-WT_quant-norm_filtered_CT-header.csv.gz", name: "APC-Mut/BMAL-WT Organoid" },
  { id: "GSE157357_APC-WT_BMAL-WT_quant-norm_filtered_CT-header.csv.gz", name: "Wild-Type Organoid" },
  { id: "GSE221103_Neuroblastoma_MYC_ON.csv", name: "Neuroblastoma MYC-ON (Cancer)" },
  { id: "GSE221103_Neuroblastoma_MYC_OFF.csv", name: "Neuroblastoma MYC-OFF (Control)" },
];

// Genome-Wide Screening Component
function GenomeWideScreenPanel({ 
  onRunScreen,
  selectedDataset,
  onSelectDataset,
  result,
  isLoading
}: { 
  onRunScreen: (datasetName: string) => void;
  selectedDataset: string;
  onSelectDataset: (datasetId: string) => void;
  result: {
    totalGenesScreened: number;
    totalHypothesesTested: number;
    significantHits: number;
    clockGenesUsed: string[];
    topHits: Array<{
      targetGeneSymbol: string;
      clockGeneSymbol: string;
      correctedPValue: number;
      fdrSignificant: boolean;
      effectSize: string;
    }>;
    screeningTime: number;
  } | null;
  isLoading: boolean;
}) {
  return (
    <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-transparent">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2 text-amber-400">
          <Dna size={16} />
          Genome-Wide PAR(2) Screening
        </CardTitle>
        <CardDescription className="text-xs">
          Test all genes (~15,000+) against 13 clock genes to identify potential circadian regulation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!result && !isLoading && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Screens entire transcriptome for clock-gated genes. Tests up to 120,000+ hypotheses with FDR correction.
            </p>
            <select 
              value={selectedDataset}
              onChange={(e) => onSelectDataset(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-100 border border-amber-500/30 rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              data-testid="select-genome-dataset"
            >
              <option value="">Select a dataset...</option>
              {EMBEDDED_DATASETS.map(ds => (
                <option key={ds.id} value={ds.id}>{ds.name}</option>
              ))}
            </select>
            <Button 
              onClick={() => onRunScreen(selectedDataset)}
              disabled={!selectedDataset}
              className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500"
              data-testid="button-run-genome-wide-screen"
            >
              <Dna size={16} className="mr-2" />
              Run Genome-Wide Screen
            </Button>
          </div>
        )}

        {isLoading && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 size={12} className="animate-spin" />
              Screening genome-wide... This may take 1-2 minutes
            </div>
            <Progress value={50} className="h-2 animate-pulse" />
          </div>
        )}

        {result && !isLoading && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-amber-400">
              <CheckCircle2 size={16} />
              Screened {result.totalGenesScreened.toLocaleString()} genes in {(result.screeningTime / 1000).toFixed(1)}s
            </div>
            
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-amber-500/20 rounded-lg p-2">
                <div className="text-lg font-bold text-amber-400">{result.totalGenesScreened.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Genes</div>
              </div>
              <div className="bg-amber-500/20 rounded-lg p-2">
                <div className="text-lg font-bold text-amber-400">{result.totalHypothesesTested.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Tests</div>
              </div>
              <div className="bg-green-500/20 rounded-lg p-2">
                <div className="text-lg font-bold text-green-400">{result.significantHits}</div>
                <div className="text-xs text-muted-foreground">FDR Sig.</div>
              </div>
            </div>
            
            {result.topHits.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-amber-400">Top Hits (FDR &lt; 0.05):</div>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {result.topHits.slice(0, 10).map((hit, i) => (
                    <div key={i} className="text-xs bg-slate-50 rounded px-2 py-1 flex justify-between">
                      <span>{hit.clockGeneSymbol} → {hit.targetGeneSymbol}</span>
                      <span className={hit.fdrSignificant ? 'text-green-400' : 'text-muted-foreground'}>
                        FDR={hit.correctedPValue.toExponential(2)}
                      </span>
                    </div>
                  ))}
                </div>
                {result.topHits.length > 10 && (
                  <p className="text-xs text-muted-foreground text-center">
                    + {result.topHits.length - 10} more hits...
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface NetworkGraphProps {
  hypotheses: Hypothesis[];
  onNodeClick?: (node: NetworkNode) => void;
  height?: number;
}

function NetworkGraphPanel({ hypotheses, onNodeClick, height = 500 }: NetworkGraphProps) {
  const graphRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);
  const [showOnlySignificant, setShowOnlySignificant] = useState(true);
  const [containerWidth, setContainerWidth] = useState(600);

  const significantCount = hypotheses.filter(h => h.significant).length;
  const hasSignificant = significantCount > 0;

  useEffect(() => {
    if (containerRef.current) {
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setContainerWidth(entry.contentRect.width);
        }
      });
      resizeObserver.observe(containerRef.current);
      return () => resizeObserver.disconnect();
    }
  }, []);

  const graphData = useMemo(() => {
    const shouldShowSignificantOnly = showOnlySignificant && hasSignificant;
    const filteredHypotheses = shouldShowSignificantOnly 
      ? hypotheses.filter(h => h.significant)
      : hypotheses;

    if (filteredHypotheses.length === 0) {
      return { nodes: [], links: [] };
    }

    const nodeMap = new Map<string, NetworkNode>();
    const links: NetworkLink[] = [];

    filteredHypotheses.forEach(h => {
      const clockId = `clock_${h.clockGene}`;
      const targetId = `target_${h.targetGene}`;

      if (!nodeMap.has(clockId)) {
        nodeMap.set(clockId, {
          id: clockId,
          name: h.clockGene,
          type: 'clock',
          color: CLOCK_COLORS[h.clockGene] || '#60a5fa',
          connections: 0
        });
      }

      if (!nodeMap.has(targetId)) {
        nodeMap.set(targetId, {
          id: targetId,
          name: h.targetGene,
          type: 'target',
          color: TARGET_COLORS[h.targetGene] || '#94a3b8',
          connections: 0
        });
      }

      nodeMap.get(clockId)!.connections++;
      nodeMap.get(targetId)!.connections++;

      links.push({
        source: clockId,
        target: targetId,
        pValue: h.pValue || 1,
        fdrSignificant: h.significant,
        effectSize: h.description || ''
      });
    });

    return {
      nodes: Array.from(nodeMap.values()),
      links
    };
  }, [hypotheses, showOnlySignificant, hasSignificant]);

  const handleNodeClick = useCallback((node: any) => {
    setSelectedNode(node);
    if (onNodeClick) onNodeClick(node);
    
    if (graphRef.current) {
      graphRef.current.centerAt(node.x, node.y, 500);
      graphRef.current.zoom(2, 500);
    }
  }, [onNodeClick]);

  const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const label = node.name;
    const fontSize = node.type === 'clock' ? 10 / globalScale : 7 / globalScale;
    const nodeSize = node.type === 'clock' ? 6 : 3 + Math.min(node.connections, 4);
    
    ctx.beginPath();
    ctx.arc(node.x, node.y, nodeSize, 0, 2 * Math.PI);
    ctx.fillStyle = node.color;
    ctx.fill();
    
    if (node.type === 'clock') {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5 / globalScale;
      ctx.stroke();
    }
    
    ctx.font = `${node.type === 'clock' ? 'bold ' : ''}${fontSize}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, node.x, node.y + nodeSize + fontSize);
  }, []);

  const linkCanvasObject = useCallback((link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const start = link.source;
    const end = link.target;
    
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.strokeStyle = link.fdrSignificant ? 'rgba(34, 197, 94, 0.6)' : 'rgba(148, 163, 184, 0.3)';
    ctx.lineWidth = link.fdrSignificant ? 2 / globalScale : 0.5 / globalScale;
    ctx.stroke();
  }, []);

  if (hypotheses.length === 0) {
    return (
      <Card className="border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-transparent">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-cyan-400">
            <Dna size={16} />
            Gene Regulation Network
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <Dna size={32} className="mb-2 opacity-50" />
            <p className="text-sm">Run an analysis to visualize the network</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const clockGenes = Array.from(new Set(hypotheses.map(h => h.clockGene)));
  const targetGenes = Array.from(new Set(hypotheses.filter(h => showOnlySignificant ? h.significant : true).map(h => h.targetGene)));

  return (
    <Card className="border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-transparent">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-cyan-400">
              <Dna size={16} />
              Gene Regulation Network
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              {graphData.nodes.length} genes, {graphData.links.length} connections
              {showOnlySignificant && ` (${significantCount} significant)`}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <Checkbox 
                checked={showOnlySignificant}
                onCheckedChange={(checked) => setShowOnlySignificant(!!checked)}
              />
              <span className="text-muted-foreground">Significant only</span>
            </label>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-cyan-400 border-2 border-white" />
            <span className="text-muted-foreground">Clock genes ({clockGenes.length})</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-slate-400" />
            <span className="text-muted-foreground">Target genes ({targetGenes.length})</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-green-500" />
            <span className="text-muted-foreground">Significant</span>
          </div>
        </div>

        <div 
          ref={containerRef}
          className="bg-white rounded-lg border border-slate-200 overflow-hidden"
          style={{ height }}
        >
          {graphData.nodes.length > 0 && (
            <ForceGraph2D
              ref={graphRef}
              graphData={graphData}
              width={containerWidth}
              height={height}
              nodeCanvasObject={nodeCanvasObject}
              linkCanvasObject={linkCanvasObject}
              onNodeClick={handleNodeClick}
              nodeRelSize={6}
              linkDirectionalParticles={2}
              linkDirectionalParticleSpeed={0.005}
              d3VelocityDecay={0.3}
              cooldownTime={3000}
              backgroundColor="transparent"
            />
          )}
        </div>

        {selectedNode && (
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: selectedNode.color }}
              />
              <span className="font-medium">{selectedNode.name}</span>
              <Badge variant="outline" className="text-xs">
                {selectedNode.type === 'clock' ? 'Clock Gene' : 'Target Gene'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedNode.connections} connection{selectedNode.connections !== 1 ? 's' : ''} 
              {selectedNode.type === 'clock' 
                ? ' to target genes' 
                : ' from clock genes'}
            </p>
          </div>
        )}

        <div className="text-xs text-muted-foreground bg-cyan-500/10 p-2 rounded-lg">
          <strong>Tip:</strong> Click and drag nodes to rearrange. Scroll to zoom. Click a node to see details.
        </div>
      </CardContent>
    </Card>
  );
}

function ProteomicsPanel({ runs }: { runs: AnalysisRun[] }) {
  const [proteomicsFile, setProteomicsFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedTranscriptomicsRun, setSelectedTranscriptomicsRun] = useState<string | null>(null);
  const [selectedProteomicsRun, setSelectedProteomicsRun] = useState<string | null>(null);
  const [concordanceData, setConcordanceData] = useState<{
    concordances: ConcordanceResult[];
    summary: { totalPairs: number; bothSignificant: number; mrnaOnly: number; proteinOnly: number; neither: number; concordanceRate?: number };
  } | null>(null);
  const queryClient = useQueryClient();

  const { data: proteomicsRuns = [], isLoading: isLoadingProteomics } = useQuery<ProteomicsRun[]>({
    queryKey: ["/api/proteomics"],
    queryFn: async () => {
      const response = await fetch("/api/proteomics");
      if (!response.ok) throw new Error("Failed to fetch proteomics runs");
      return response.json();
    }
  });

  const { data: proteomicsResults, isLoading: isLoadingResults } = useQuery<{
    run: ProteomicsRun;
    results: ProteomicsResult[];
  }>({
    queryKey: ["/api/proteomics", selectedProteomicsRun],
    queryFn: async () => {
      const response = await fetch(`/api/proteomics/${selectedProteomicsRun}`);
      if (!response.ok) throw new Error("Failed to fetch proteomics results");
      return response.json();
    },
    enabled: !!selectedProteomicsRun
  });

  const handleProteomicsUpload = async () => {
    if (!proteomicsFile) return;
    
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', proteomicsFile);
      formData.append('name', `Proteomics - ${proteomicsFile.name}`);
      formData.append('dataType', 'protein');
      if (selectedTranscriptomicsRun) {
        formData.append('linkedTranscriptomicsRunId', selectedTranscriptomicsRun);
      }

      const response = await fetch('/api/proteomics/upload', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) throw new Error('Upload failed');
      
      const result = await response.json();
      setSelectedProteomicsRun(result.run.id);
      setProteomicsFile(null);
      queryClient.invalidateQueries({ queryKey: ["/api/proteomics"] });
    } catch (error) {
      console.error('Proteomics upload failed:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const runConcordanceAnalysis = async () => {
    if (!selectedTranscriptomicsRun || !selectedProteomicsRun) return;
    
    try {
      const response = await fetch('/api/concordance/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcriptomicsRunId: selectedTranscriptomicsRun,
          proteomicsRunId: selectedProteomicsRun
        })
      });

      if (!response.ok) throw new Error('Concordance analysis failed');
      
      const data = await response.json();
      setConcordanceData({
        concordances: data.concordances,
        summary: data.summary
      });
    } catch (error) {
      console.error('Concordance analysis failed:', error);
    }
  };

  const significantProteomics = proteomicsResults?.results.filter(r => r.significant) || [];

  return (
    <div className="space-y-6">
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Dna size={18} />
            Multi-Omics Analysis: mRNA vs Protein
            <Badge variant="outline" className="text-amber-500 border-amber-500/50 text-xs ml-2">Experimental</Badge>
          </CardTitle>
          <CardDescription>
            Upload proteomics data to compare with transcriptomic findings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm">
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-amber-400 mb-1">Protein Dynamics Caveat</p>
                <p className="text-muted-foreground text-xs">
                  AR(2) eigenvalue profiling shows different behavior at the protein level: proteins have longer half-lives, 
                  resulting in higher |λ| values (mean ~0.86 vs ~0.54 for mRNA) and very low stability band occupancy (~3.6% vs ~25-30%).
                  The core PAR(2) model is validated at the <strong>transcriptome level</strong>. Proteomics results should be interpreted with caution.
                </p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <Upload size={14} />
                Upload Proteomics Data
              </h4>
              <div className="border-2 border-dashed border-border/50 rounded-lg p-4 hover:border-primary/50 transition-colors">
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setProteomicsFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                  data-testid="input-proteomics-file"
                />
                {proteomicsFile && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Selected: {proteomicsFile.name}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Link to mRNA Analysis (optional)</Label>
                <select
                  value={selectedTranscriptomicsRun || ''}
                  onChange={(e) => setSelectedTranscriptomicsRun(e.target.value || null)}
                  className="w-full p-2 rounded-md bg-secondary/50 border border-border/50 text-sm"
                  data-testid="select-transcriptomics-run"
                >
                  <option value="">Select mRNA analysis run...</option>
                  {runs.filter(r => r.status === 'completed').map(run => (
                    <option key={run.id} value={run.id}>{run.name}</option>
                  ))}
                </select>
              </div>

              <Button
                onClick={handleProteomicsUpload}
                disabled={!proteomicsFile || isUploading}
                className="w-full gap-2"
                data-testid="button-upload-proteomics"
              >
                {isUploading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Play size={14} />
                    Analyze Proteomics
                  </>
                )}
              </Button>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <FlaskConical size={14} />
                Proteomics Runs
              </h4>
              {isLoadingProteomics ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 size={14} className="animate-spin" />
                  Loading...
                </div>
              ) : proteomicsRuns.length === 0 ? (
                <p className="text-sm text-muted-foreground">No proteomics analyses yet</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {proteomicsRuns.map(run => (
                    <button
                      key={run.id}
                      onClick={() => setSelectedProteomicsRun(run.id)}
                      className={`w-full text-left p-3 rounded-lg transition-colors ${
                        selectedProteomicsRun === run.id 
                          ? 'bg-primary/10 border border-primary/30' 
                          : 'bg-secondary/30 hover:bg-secondary/50'
                      }`}
                      data-testid={`button-proteomics-run-${run.id}`}
                    >
                      <div className="font-medium text-sm truncate">{run.name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                        <span>{new Date(run.createdAt).toLocaleDateString()}</span>
                        <Badge variant={run.status === "completed" ? "default" : "secondary"} className="text-[10px]">
                          {run.status}
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {proteomicsResults && proteomicsResults.run.status === 'completed' && (
            <div className="border-t pt-4">
              <h4 className="font-medium text-sm mb-3">
                Proteomics Results: {significantProteomics.length} significant out of {proteomicsResults.results.length} pairs
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                {proteomicsResults.results.filter(r => r.significant).slice(0, 12).map(result => (
                  <div 
                    key={result.id}
                    className="p-2 rounded-lg bg-green-500/10 border border-green-500/30"
                  >
                    <div className="font-mono text-sm">
                      {result.clockGeneSymbol} → {result.targetGeneSymbol}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      p = {result.pValue?.toFixed(4)} | f² = {result.effectSizeCohensF2?.toFixed(3) || 'N/A'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitCompare size={18} />
            mRNA vs Protein Concordance
          </CardTitle>
          <CardDescription>
            Compare PAR(2) results between transcriptomic and proteomic levels
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">mRNA Analysis Run</Label>
              <select
                value={selectedTranscriptomicsRun || ''}
                onChange={(e) => setSelectedTranscriptomicsRun(e.target.value || null)}
                className="w-full p-2 rounded-md bg-secondary/50 border border-border/50 text-sm mt-1"
                data-testid="select-mrna-run"
              >
                <option value="">Select mRNA analysis...</option>
                {runs.filter(r => r.status === 'completed').map(run => (
                  <option key={run.id} value={run.id}>{run.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Proteomics Run</Label>
              <select
                value={selectedProteomicsRun || ''}
                onChange={(e) => setSelectedProteomicsRun(e.target.value || null)}
                className="w-full p-2 rounded-md bg-secondary/50 border border-border/50 text-sm mt-1"
                data-testid="select-protein-run"
              >
                <option value="">Select proteomics analysis...</option>
                {proteomicsRuns.filter(r => r.status === 'completed').map(run => (
                  <option key={run.id} value={run.id}>{run.name}</option>
                ))}
              </select>
            </div>
          </div>

          <Button
            onClick={runConcordanceAnalysis}
            disabled={!selectedTranscriptomicsRun || !selectedProteomicsRun}
            className="gap-2"
            data-testid="button-run-concordance"
          >
            <GitCompare size={14} />
            Run Concordance Analysis
          </Button>

          {concordanceData && (
            <div className="space-y-4 border-t pt-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="border-border/50">
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold text-green-400">{concordanceData.summary.bothSignificant}</p>
                    <p className="text-xs text-muted-foreground">Both Significant</p>
                  </CardContent>
                </Card>
                <Card className="border-border/50">
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold text-blue-400">{concordanceData.summary.mrnaOnly}</p>
                    <p className="text-xs text-muted-foreground">mRNA Only</p>
                  </CardContent>
                </Card>
                <Card className="border-border/50">
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold text-purple-400">{concordanceData.summary.proteinOnly}</p>
                    <p className="text-xs text-muted-foreground">Protein Only</p>
                  </CardContent>
                </Card>
                <Card className="border-border/50">
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold text-muted-foreground">{concordanceData.summary.neither}</p>
                    <p className="text-xs text-muted-foreground">Neither</p>
                  </CardContent>
                </Card>
              </div>

              <div className="bg-primary/10 p-3 rounded-lg">
                <p className="text-sm">
                  <strong>Concordance Rate:</strong> {concordanceData.summary.concordanceRate?.toFixed(1)}% of significant findings validated at both levels
                </p>
              </div>

              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Gene Pair</th>
                      <th className="text-center p-2">mRNA</th>
                      <th className="text-center p-2">Protein</th>
                      <th className="text-center p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {concordanceData.concordances.filter(c => c.concordanceStatus !== 'neither').slice(0, 20).map((c, i) => (
                      <tr key={i} className="border-b border-border/30">
                        <td className="p-2 font-mono text-xs">{c.clockGene}→{c.targetGene}</td>
                        <td className="text-center p-2">
                          {c.mrnaSignificant ? (
                            <Badge className="bg-blue-500/20 text-blue-400 text-[10px]">p={c.mrnaPValue?.toFixed(3)}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">NS</span>
                          )}
                        </td>
                        <td className="text-center p-2">
                          {c.proteinSignificant ? (
                            <Badge className="bg-purple-500/20 text-purple-400 text-[10px]">p={c.proteinPValue?.toFixed(3)}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">NS</span>
                          )}
                        </td>
                        <td className="text-center p-2">
                          <Badge className={
                            c.concordanceStatus === 'both_significant' ? 'bg-green-500/20 text-green-400' :
                            c.concordanceStatus === 'mrna_only' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-purple-500/20 text-purple-400'
                          }>
                            {c.concordanceStatus === 'both_significant' ? 'Validated' :
                             c.concordanceStatus === 'mrna_only' ? 'mRNA Only' : 'Protein Only'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function Dashboard() {
  const { toast } = useToast();
  const [showQuickStart, setShowQuickStart] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [datasetInfos, setDatasetInfos] = useState<Map<string, DatasetInfo>>(new Map());
  const [isDragging, setIsDragging] = useState(false);
  const [selectedPairs, setSelectedPairs] = useState<Array<{ target: string; clock: string }>>([]);
  const [period, setPeriod] = useState(24);
  const [significanceThreshold, setSignificanceThreshold] = useState(0.05);
  const [analysisName, setAnalysisName] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showExports, setShowExports] = useState(false);
  const [comparisonRuns, setComparisonRuns] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("results");
  const [selectedResult, setSelectedResult] = useState<Hypothesis | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [fdrTier, setFdrTier] = useState<'all' | 'tier1' | 'tier2' | 'tier3'>('all');
  const [batchJobId, setBatchJobId] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<{
    status: 'idle' | 'running' | 'completed' | 'failed';
    currentTissue: string;
    completedTissues: number;
    totalTissues: number;
    results?: Array<{ tissue: string; significantCount: number; totalPairs: number }>;
  }>({ status: 'idle', currentTissue: '', completedTissues: 0, totalTissues: 0 });
  const [organoidBatchJobId, setOrganoidBatchJobId] = useState<string | null>(null);
  const [organoidBatchProgress, setOrganoidBatchProgress] = useState<{
    status: 'idle' | 'running' | 'completed' | 'failed';
    currentCondition: string;
    completedConditions: number;
    totalConditions: number;
    results?: Array<{ condition: string; significantCount: number; totalPairs: number }>;
  }>({ status: 'idle', currentCondition: '', completedConditions: 0, totalConditions: 0 });
  
  const [genomeWideResult, setGenomeWideResult] = useState<{
    totalGenesScreened: number;
    totalHypothesesTested: number;
    significantHits: number;
    clockGenesUsed: string[];
    topHits: Array<{
      targetGeneSymbol: string;
      clockGeneSymbol: string;
      correctedPValue: number;
      fdrSignificant: boolean;
      effectSize: string;
    }>;
    screeningTime: number;
  } | null>(null);
  const [genomeWideLoading, setGenomeWideLoading] = useState(false);
  const [selectedGenomeDataset, setSelectedGenomeDataset] = useState<string>("");
  
  
  const [dataQualityReport, setDataQualityReport] = useState<{
    filename: string;
    overallScore: 'excellent' | 'good' | 'acceptable' | 'poor' | 'unusable';
    canProceed: boolean;
    warnings: Array<{ severity: string; code: string; message: string; details?: string }>;
    recommendations: string[];
    metrics: {
      nTimepoints: number;
      nGenes: number;
      estimatedDataType: string;
      clockGenesFound: string[];
      targetGenesFound: string[];
    };
  } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const expressionChartRef = useRef<HTMLDivElement>(null);
  const comparisonChartRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: allHypotheses = [] } = useQuery<Array<Hypothesis & { datasetName: string }>>({
    queryKey: ["/api/analyses/all-hypotheses", comparisonRuns],
    queryFn: async () => {
      if (comparisonRuns.length === 0) return [];
      const results = await Promise.all(
        comparisonRuns.map(async (runId) => {
          const response = await fetch(`/api/analyses/${runId}`);
          if (!response.ok) return [];
          const data = await response.json();
          return (data.hypotheses || []).map((h: Hypothesis) => ({
            ...h,
            datasetName: data.run?.datasetName || 'Unknown'
          }));
        })
      );
      return results.flat();
    },
    enabled: comparisonRuns.length > 0
  });

  const toggleComparisonRun = (runId: string) => {
    setComparisonRuns(prev => 
      prev.includes(runId) 
        ? prev.filter(id => id !== runId)
        : [...prev, runId]
    );
  };

  const generatePublicationReport = () => {
    const hypotheses = analysisData?.hypotheses || [];
    const run = analysisData?.run;
    if (!run || hypotheses.length === 0) return;

    const significant = hypotheses.filter((h: Hypothesis) => h.significant);
    const nonSignificant = hypotheses.filter((h: Hypothesis) => !h.significant);

    const report = `
# PAR(2) Circadian Gating Analysis Report

## Study Information
- **Dataset**: ${run.datasetName}
- **Analysis Date**: ${new Date(run.createdAt).toLocaleDateString()}
- **Circadian Period**: ${period} hours
- **Significance Threshold**: α = ${significanceThreshold}

## Summary Statistics
- **Total Hypotheses Tested**: ${hypotheses.length}
- **Significant Discoveries**: ${significant.length} (${((significant.length / hypotheses.length) * 100).toFixed(1)}%)
- **Non-Significant**: ${nonSignificant.length}

## Significant Findings

${significant.length > 0 ? significant.map((h: Hypothesis, i: number) => `
### ${i + 1}. ${h.clockGene} → ${h.targetGene}
- **P-value**: ${h.pValue.toFixed(6)}
- **Significant Terms**: ${h.significantTerms?.join(', ') || 'N/A'}
- **Interpretation**: ${h.description}
`).join('\n') : 'No significant circadian gating relationships detected.'}

## Non-Significant Results

| Clock Gene | Target Gene | P-value |
|------------|-------------|---------|
${nonSignificant.map((h: Hypothesis) => `| ${h.clockGene} | ${h.targetGene} | ${h.pValue.toFixed(4)} |`).join('\n')}

## Methods

The PAR(2) (Phase-Amplitude-Relationship with 2 lags) model tests whether the phase of a circadian clock gene significantly modulates the expression dynamics of target genes. The model includes:

- Autoregressive terms: R(n-1), R(n-2)
- Phase interaction terms: R(n-1)×cos(φ), R(n-1)×sin(φ), R(n-2)×cos(φ), R(n-2)×sin(φ)

Significance was determined using t-statistics for phase interaction coefficients with α = ${significanceThreshold}.

## References

1. Janich P, et al. (2021). The Circadian Clock Gene, Bmal1, Regulates Intestinal Stem Cell Signaling. Cell Mol Gastroenterol Hepatol.
2. Gaucher J, et al. (2018). MYC Disrupts the Circadian Clock and Metabolism in Cancer Cells. Cell Metabolism.

---
*Generated by PAR(2) Discovery Engine*
`;

    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PAR2_Report_${run.datasetName.replace(/\.[^/.]+$/, '')}_${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const printResultsToPDF = (download: boolean = false) => {
    const hypotheses = analysisData?.hypotheses || [];
    const run = analysisData?.run;
    if (!run || hypotheses.length === 0) {
      toast({ title: "No results to print", description: "Run an analysis first to generate results.", variant: "destructive" });
      return;
    }

    const significant = hypotheses.filter((h: Hypothesis) => h.significant);
    const nonSignificant = hypotheses.filter((h: Hypothesis) => !h.significant);

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <title>PAR(2) Analysis Report - ${run.datasetName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
      line-height: 1.6; 
      color: #1a1a2e; 
      padding: 40px;
      max-width: 800px;
      margin: 0 auto;
    }
    h1 { 
      color: #0f172a; 
      border-bottom: 3px solid #3b82f6; 
      padding-bottom: 10px; 
      margin-bottom: 20px;
      font-size: 24px;
    }
    h2 { 
      color: #1e40af; 
      margin-top: 30px; 
      margin-bottom: 15px;
      font-size: 18px;
      border-left: 4px solid #3b82f6;
      padding-left: 12px;
    }
    h3 { 
      color: #334155; 
      margin-top: 20px; 
      margin-bottom: 10px;
      font-size: 14px;
    }
    .header-info { 
      background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); 
      padding: 20px; 
      border-radius: 8px; 
      margin-bottom: 25px;
      border: 1px solid #cbd5e1;
    }
    .header-info p { margin: 5px 0; font-size: 13px; }
    .header-info strong { color: #475569; }
    .summary-box { 
      display: flex; 
      gap: 20px; 
      margin: 20px 0;
    }
    .stat-card { 
      flex: 1; 
      padding: 15px; 
      border-radius: 8px; 
      text-align: center;
    }
    .stat-card.total { background: #f1f5f9; border: 1px solid #cbd5e1; }
    .stat-card.significant { background: #dcfce7; border: 1px solid #86efac; }
    .stat-card.nonsig { background: #fef3c7; border: 1px solid #fcd34d; }
    .stat-card .number { font-size: 28px; font-weight: bold; }
    .stat-card .label { font-size: 11px; color: #64748b; text-transform: uppercase; }
    .stat-card.significant .number { color: #16a34a; }
    .stat-card.nonsig .number { color: #d97706; }
    table { 
      width: 100%; 
      border-collapse: collapse; 
      margin: 15px 0;
      font-size: 12px;
    }
    th, td { 
      padding: 10px 12px; 
      text-align: left; 
      border: 1px solid #e2e8f0;
    }
    th { 
      background: #1e293b; 
      color: white;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 0.5px;
    }
    tr:nth-child(even) { background: #f8fafc; }
    tr:hover { background: #f1f5f9; }
    .significant-row { background: #dcfce7 !important; }
    .significant-row:hover { background: #bbf7d0 !important; }
    .badge { 
      display: inline-block; 
      padding: 2px 8px; 
      border-radius: 12px; 
      font-size: 10px; 
      font-weight: 600;
    }
    .badge-sig { background: #16a34a; color: white; }
    .badge-nonsig { background: #94a3b8; color: white; }
    .finding-card {
      background: #f0fdf4;
      border: 1px solid #86efac;
      border-left: 4px solid #16a34a;
      padding: 15px;
      margin: 10px 0;
      border-radius: 6px;
    }
    .finding-card h4 { color: #15803d; margin-bottom: 8px; font-size: 14px; }
    .finding-card p { font-size: 12px; color: #475569; }
    .methods { 
      background: #f8fafc; 
      padding: 20px; 
      border-radius: 8px;
      margin-top: 30px;
      border: 1px solid #e2e8f0;
      font-size: 12px;
    }
    .footer { 
      margin-top: 40px; 
      padding-top: 20px; 
      border-top: 1px solid #e2e8f0; 
      font-size: 11px; 
      color: #64748b;
      text-align: center;
    }
    @media print {
      body { padding: 20px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <h1>PAR(2) Circadian Gating Analysis Report</h1>
  
  <div class="header-info">
    <p><strong>Dataset:</strong> ${run.datasetName}</p>
    <p><strong>Analysis Date:</strong> ${new Date(run.createdAt).toLocaleDateString()}</p>
    <p><strong>Circadian Period:</strong> ${period} hours</p>
    <p><strong>Significance Threshold:</strong> α = ${significanceThreshold}</p>
  </div>

  <h2>Summary Statistics</h2>
  <div class="summary-box">
    <div class="stat-card total">
      <div class="number">${hypotheses.length}</div>
      <div class="label">Total Tests</div>
    </div>
    <div class="stat-card significant">
      <div class="number">${significant.length}</div>
      <div class="label">Significant</div>
    </div>
    <div class="stat-card nonsig">
      <div class="number">${nonSignificant.length}</div>
      <div class="label">Non-Significant</div>
    </div>
  </div>

  ${significant.length > 0 ? `
  <h2>Significant Findings</h2>
  ${significant.map((h: Hypothesis, i: number) => `
  <div class="finding-card">
    <h4>${i + 1}. ${h.clockGene} → ${h.targetGene}</h4>
    <p><strong>P-value:</strong> ${h.pValue.toExponential(4)} | <strong>Significant Terms:</strong> ${h.significantTerms?.join(', ') || 'N/A'}</p>
    <p>${h.description}</p>
  </div>
  `).join('')}
  ` : '<p>No significant circadian gating relationships detected.</p>'}

  <h2>All Results</h2>
  <table>
    <thead>
      <tr>
        <th>Clock Gene</th>
        <th>Target Gene</th>
        <th>P-value</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${hypotheses.map((h: Hypothesis) => `
      <tr class="${h.significant ? 'significant-row' : ''}">
        <td>${h.clockGene}</td>
        <td>${h.targetGene}</td>
        <td>${h.pValue.toExponential(4)}</td>
        <td><span class="badge ${h.significant ? 'badge-sig' : 'badge-nonsig'}">${h.significant ? 'Significant' : 'NS'}</span></td>
      </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="methods">
    <h2>Methods</h2>
    <p>The PAR(2) (Phase-Amplitude-Relationship with 2 lags) model tests whether the phase of a circadian clock gene significantly modulates the expression dynamics of target genes. The model includes:</p>
    <ul style="margin: 10px 0 10px 20px;">
      <li>Autoregressive terms: R(n-1), R(n-2)</li>
      <li>Phase interaction terms: R(n-1)×cos(φ), R(n-1)×sin(φ), R(n-2)×cos(φ), R(n-2)×sin(φ)</li>
    </ul>
    <p>Significance was determined using F-statistics for phase interaction coefficients with α = ${significanceThreshold}.</p>
  </div>

  <div class="footer">
    Generated by PAR(2) Discovery Engine v${APP_VERSION} | ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}
  </div>

  ${!download ? `<script>window.onload = function() { window.print(); }</script>` : ''}
</body>
</html>
    `;

    if (download) {
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `PAR2_Report_${run.datasetName.replace(/\.[^/.]+$/, '')}_${new Date().toISOString().split('T')[0]}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Report downloaded", description: "Open the HTML file in a browser and use Print → Save as PDF" });
    } else {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast({ title: "Popup blocked", description: "Please allow popups to print results.", variant: "destructive" });
        return;
      }
      printWindow.document.write(htmlContent);
      printWindow.document.close();
    }
  };

  const downloadResultsAsPDF = async () => {
    const hypotheses = analysisData?.hypotheses || [];
    const run = analysisData?.run;
    if (!run || hypotheses.length === 0) {
      toast({ title: "No results to export", description: "Run an analysis first to generate results.", variant: "destructive" });
      return;
    }

    try {
      toast({ title: "Generating PDF...", description: "Please wait while we create your report." });
      
      const significant = hypotheses.filter((h: Hypothesis) => h.significant);
      const meanEigenvalue = hypotheses.reduce((acc: number, h: Hypothesis) => {
        const eig = (h as any).eigenvalueModulus;
        return acc + (eig || 0);
      }, 0) / hypotheses.length;

      await printAnalysisResults({
        runName: run.name,
        datasetName: run.datasetName,
        hypotheses: hypotheses.map((h: Hypothesis) => ({
          clockGene: h.clockGene,
          targetGene: h.targetGene,
          pValue: h.pValue,
          qValue: (h as any).qValue || null,
          significant: h.significant,
          eigenvalueModulus: (h as any).eigenvalueModulus || null
        })),
        summary: {
          totalPairs: hypotheses.length,
          significantPairs: significant.length,
          meanEigenvalue: meanEigenvalue || undefined
        }
      }, {
        filename: `PAR2_${run.datasetName.replace(/\.[^/.]+$/, '')}_${new Date().toISOString().split('T')[0]}`
      });

      toast({ title: "PDF downloaded", description: "Your analysis report has been saved." });
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({ title: "PDF generation failed", description: "Please try the Print option instead.", variant: "destructive" });
    }
  };

  const getComparisonChartData = () => {
    if (allHypotheses.length === 0) return [];
    
    const geneGroups = new Map<string, Array<{ dataset: string; pValue: number; significant: boolean }>>();
    
    allHypotheses.forEach(h => {
      const key = `${h.clockGene}→${h.targetGene}`;
      if (!geneGroups.has(key)) {
        geneGroups.set(key, []);
      }
      geneGroups.get(key)!.push({
        dataset: h.datasetName.replace('GSE157357_', '').replace(/\.[^/.]+$/, '').slice(0, 20),
        pValue: h.pValue,
        significant: h.significant
      });
    });

    return Array.from(geneGroups.entries()).map(([pair, data]) => ({
      pair,
      ...Object.fromEntries(data.map(d => [d.dataset, -Math.log10(d.pValue || 1)]))
    }));
  };

  const { data: config } = useQuery<Config>({
    queryKey: ["/api/config"],
    queryFn: async () => {
      const response = await fetch("/api/config");
      if (!response.ok) throw new Error("Failed to fetch config");
      const data = await response.json();
      setSelectedPairs(data.pairs);
      return data;
    }
  });

  const { data: runs = [] } = useQuery<AnalysisRun[]>({
    queryKey: ["/api/analyses"],
    queryFn: async () => {
      const response = await fetch("/api/analyses");
      if (!response.ok) throw new Error("Failed to fetch analyses");
      return response.json();
    },
    refetchInterval: 3000,
  });

  const latestRun = runs[0];

  const { data: analysisData } = useQuery({
    queryKey: ["/api/analyses", selectedRunId || latestRun?.id],
    queryFn: async () => {
      const id = selectedRunId || latestRun?.id;
      if (!id) return null;
      const response = await fetch(`/api/analyses/${id}`);
      if (!response.ok) throw new Error("Failed to fetch analysis");
      return response.json();
    },
    enabled: !!(selectedRunId || latestRun?.id),
    refetchInterval: (query) => {
      const data = query.state.data as { run?: { status: string } } | undefined;
      return data?.run?.status === "running" ? 2000 : false;
    },
  });

  const { data: phaseHeatmapData, isLoading: isLoadingPhaseHeatmap } = useQuery({
    queryKey: ["/api/analyses/phase-heatmap", selectedRunId || latestRun?.id],
    queryFn: async () => {
      const id = selectedRunId || latestRun?.id;
      if (!id) return null;
      const response = await fetch(`/api/analyses/${id}/phase-heatmap`);
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!(selectedRunId || latestRun?.id) && !!(analysisData?.hypotheses?.length > 0),
    staleTime: 60000,
  });

  const { data: crossTissueData, isLoading: isLoadingCrossTissue } = useQuery<CrossTissueConsensusData>({
    queryKey: ["/api/analyses/cross-tissue-consensus"],
    queryFn: async () => {
      const response = await fetch("/api/analyses/cross-tissue-consensus");
      if (!response.ok) throw new Error("Failed to fetch cross-tissue consensus");
      return response.json();
    },
    staleTime: 60000,
  });
  
  
  interface PhaseVulnerabilityData {
    dataset: string;
    sirt1Profile: {
      mean: number;
      amplitude: number;
      peakPhase: number;
      troughPhase: number;
    };
    goldenHour: {
      phase: number;
      duration: number;
      sirt1Nadir: number;
      peakingTargets: string[];
      interpretation: string;
    };
    vulnerabilityRanking: Array<{
      gene: string;
      peakPhase: number;
      sirt1PhaseAtPeak: string;
      vulnerabilityScore: number;
    }>;
    summary: {
      sirt1TroughWindow: string;
      sirt1NadirPercent: string;
      mostVulnerableGenes: string[];
    };
  }
  
  const { data: phaseVulnerabilityData, isLoading: isLoadingPhaseVuln } = useQuery<PhaseVulnerabilityData>({
    queryKey: ["/api/phase-vulnerability/analyze"],
    queryFn: async () => {
      const response = await fetch("/api/phase-vulnerability/analyze");
      if (!response.ok) throw new Error("Failed to fetch phase vulnerability");
      return response.json();
    },
    staleTime: 300000,
  });
  
  interface TrajectoryAnalysisData {
    metadata: {
      generatedAt: string;
      goldenRatio: number;
      dataType: string;
      note: string;
      methodology: {
        name: string;
        description: string;
      };
      empiricalValidation: string;
    };
    summary: {
      totalDatasetsAnalyzed: number;
      datasetsWithTrajectoryData: number;
      totalGenePairs: number;
      pairsApproachingPhi: number;
      averagePhiSimilarity: number;
    };
    datasets: any[];
  }
  
  const { data: trajectoryData, isLoading: isLoadingTrajectory } = useQuery<TrajectoryAnalysisData>({
    queryKey: ["/api/export-trajectory-analysis"],
    queryFn: async () => {
      const response = await fetch("/api/export-trajectory-analysis");
      if (!response.ok) throw new Error("Failed to fetch trajectory analysis");
      return response.json();
    },
    staleTime: 60000,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/datasets/preview", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Failed to preview dataset");
      const previewData = await response.json() as DatasetInfo;
      
      const qualityFormData = new FormData();
      qualityFormData.append("file", file);
      
      const qualityResponse = await fetch("/api/datasets/quality-check", {
        method: "POST",
        body: qualityFormData,
      });
      
      let qualityData = null;
      if (qualityResponse.ok) {
        qualityData = await qualityResponse.json();
      }
      
      return { file, data: previewData, quality: qualityData };
    },
    onSuccess: ({ file, data, quality }) => {
      setDatasetInfos(prev => new Map(prev).set(file.name, data));
      if (quality) {
        setDataQualityReport(quality);
        if (quality.warnings?.length > 0) {
          const criticalWarnings = quality.warnings.filter((w: { severity: string }) => w.severity === 'critical');
          if (criticalWarnings.length > 0) {
            toast({
              title: "Data Quality Warning",
              description: criticalWarnings[0].message,
              variant: "destructive",
            });
          }
        }
      }
    },
  });

  const runAnalysisMutation = useMutation({
    mutationFn: async () => {
      if (uploadedFiles.length === 0) {
        throw new Error("No files uploaded");
      }
      trackEvent('analysis_run');
      
      const results = [];
      for (const file of uploadedFiles) {
        const formData = new FormData();
        formData.append("name", analysisName ? `${analysisName} - ${file.name}` : `Analysis ${file.name} ${new Date().toLocaleString()}`);
        formData.append("datasetName", file.name);
        formData.append("period", period.toString());
        formData.append("threshold", significanceThreshold.toString());
        formData.append("pairs", JSON.stringify(selectedPairs));
        formData.append("dataset", file);

        const response = await fetch("/api/analyses/run", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) throw new Error(`Failed to start analysis for ${file.name}`);
        results.push(await response.json());
      }
      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ["/api/analyses"] });
      if (results.length > 0) {
        setSelectedRunId(results[0].run.id);
      }
    },
  });

  // Batch analysis mutation - runs all 12 GSE54650 tissues
  const batchAnalysisMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/analyses/batch/all-tissues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period, threshold: significanceThreshold }),
      });
      if (!response.ok) throw new Error("Failed to start batch analysis");
      return response.json();
    },
    onSuccess: (data) => {
      setBatchJobId(data.batchId);
      setBatchProgress({
        status: 'running',
        currentTissue: '',
        completedTissues: 0,
        totalTissues: 12,
      });
      // Start polling for progress
      pollBatchProgress(data.batchId);
    },
  });

  const pollBatchProgress = async (jobId: string) => {
    const poll = async () => {
      try {
        const response = await fetch(`/api/analyses/batch/${jobId}`);
        if (!response.ok) return;
        const job = await response.json();
        
        setBatchProgress({
          status: job.status,
          currentTissue: job.currentTissue,
          completedTissues: job.completedTissues,
          totalTissues: job.totalTissues,
          results: job.results,
        });
        
        if (job.status === 'running') {
          setTimeout(poll, 1000);
        } else if (job.status === 'completed') {
          queryClient.invalidateQueries({ queryKey: ["/api/analyses"] });
        }
      } catch (error) {
        console.error("Error polling batch progress:", error);
      }
    };
    poll();
  };

  // Organoid batch analysis mutation - runs all 4 GSE157357 conditions
  const organoidBatchMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/analyses/batch/all-organoids", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period, threshold: significanceThreshold }),
      });
      if (!response.ok) throw new Error("Failed to start organoid batch analysis");
      return response.json();
    },
    onSuccess: (data) => {
      setOrganoidBatchJobId(data.batchId);
      setOrganoidBatchProgress({
        status: 'running',
        currentCondition: '',
        completedConditions: 0,
        totalConditions: 4,
      });
      pollOrganoidBatchProgress(data.batchId);
    },
  });

  const pollOrganoidBatchProgress = async (jobId: string) => {
    const poll = async () => {
      try {
        const response = await fetch(`/api/analyses/batch/${jobId}`);
        if (!response.ok) return;
        const job = await response.json();
        
        setOrganoidBatchProgress({
          status: job.status,
          currentCondition: job.currentTissue,
          completedConditions: job.completedTissues,
          totalConditions: job.totalTissues,
          results: job.results?.map((r: any) => ({ condition: r.tissue, significantCount: r.significantCount, totalPairs: r.totalPairs })),
        });
        
        if (job.status === 'running') {
          setTimeout(poll, 1000);
        } else if (job.status === 'completed') {
          queryClient.invalidateQueries({ queryKey: ["/api/analyses"] });
          // Auto-select the first completed run to show results in network view
          if (job.results && job.results.length > 0 && job.results[0].runId) {
            setSelectedRunId(job.results[0].runId);
          }
        }
      } catch (error) {
        console.error("Error polling organoid batch progress:", error);
      }
    };
    poll();
  };

  // Genome-wide screening handler
  const runGenomeWideScreen = async (datasetName: string) => {
    setGenomeWideLoading(true);
    setGenomeWideResult(null);
    
    try {
      const formData = new FormData();
      formData.append('datasetName', datasetName);
      formData.append('fdrThreshold', '0.05');
      formData.append('maxResults', '500');
      
      const response = await fetch('/api/analyses/genome-wide-screen', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('Failed to run genome-wide screen');
      }
      
      const result = await response.json();
      setGenomeWideResult(result);
      
      toast({
        title: "Genome-Wide Screen Complete",
        description: `Screened ${result.totalGenesScreened.toLocaleString()} genes, found ${result.significantHits} significant hits`,
      });
    } catch (error) {
      console.error('Genome-wide screen error:', error);
      toast({
        title: "Error",
        description: "Failed to run genome-wide screen",
        variant: "destructive",
      });
    } finally {
      setGenomeWideLoading(false);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(
      file => file.name.endsWith('.csv') || file.name.endsWith('.gz') || file.name.endsWith('.tsv') || file.name.endsWith('.txt')
    );
    if (files.length > 0) {
      setUploadedFiles(prev => [...prev, ...files.filter(f => !prev.some(p => p.name === f.name))]);
      files.forEach(file => {
        uploadMutation.mutate(file);
        trackEvent('file_upload');
      });
    }
  }, [uploadMutation]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setUploadedFiles(prev => [...prev, ...files.filter(f => !prev.some(p => p.name === f.name))]);
      files.forEach(file => {
        uploadMutation.mutate(file);
        trackEvent('file_upload');
      });
    }
  }, [uploadMutation]);

  const removeFile = useCallback((fileName: string) => {
    setUploadedFiles(prev => prev.filter(f => f.name !== fileName));
    setDatasetInfos(prev => {
      const next = new Map(prev);
      next.delete(fileName);
      return next;
    });
  }, []);

  const togglePair = (target: string, clock: string) => {
    setSelectedPairs(prev => {
      const exists = prev.some(p => p.target === target && p.clock === clock);
      if (exists) {
        return prev.filter(p => !(p.target === target && p.clock === clock));
      }
      return [...prev, { target, clock }];
    });
  };

  const clearUpload = () => {
    setUploadedFiles([]);
    setDatasetInfos(new Map());
    setDataQualityReport(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const startNewAnalysis = () => {
    setSelectedRunId(null);
    setUploadedFiles([]);
    setDatasetInfos(new Map());
    setDataQualityReport(null);
    setSelectedPairs([]);
    setAnalysisName("");
    setSelectedResult(null);
    setActiveTab("results");
    setBatchJobId(null);
    setBatchProgress({ status: 'idle', currentTissue: '', completedTissues: 0, totalTissues: 0 });
    setOrganoidBatchJobId(null);
    setOrganoidBatchProgress({ status: 'idle', currentCondition: '', completedConditions: 0, totalConditions: 0 });
    setGenomeWideResult(null);
    setSelectedGenomeDataset("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    toast({
      title: "Ready for new analysis",
      description: "All previous data cleared. Upload a dataset or select an embedded one to begin.",
    });
  };

  const handleLoadEmbeddedDataset = async (datasetId: string, filename: string) => {
    try {
      const response = await fetch(`/api/datasets/embedded/${datasetId}`);
      if (!response.ok) throw new Error("Failed to load dataset");
      const data = await response.json() as DatasetInfo;
      
      const blob = await fetch(`/api/datasets/embedded/${datasetId}/raw`)
        .then(r => r.ok ? r.blob() : null)
        .catch(() => null);
      
      if (blob) {
        const file = new File([blob], filename, { type: 'text/csv' });
        setUploadedFiles(prev => [...prev.filter(f => f.name !== filename), file]);
      } else {
        const dummyFile = new File([''], filename, { type: 'text/csv' });
        setUploadedFiles(prev => [...prev.filter(f => f.name !== filename), dummyFile]);
      }
      setDatasetInfos(prev => new Map(prev).set(filename, data));
      setSelectedGenomeDataset(datasetId);
    } catch (error) {
      console.error("Error loading embedded dataset:", error);
    }
  };

  const downloadResults = () => {
    if (!analysisData?.hypotheses) return;
    
    const csvContent = [
      ["Target Gene", "Target Role", "Clock Gene", "Clock Role", "Significant", "P-Value", "Terms", "Description"].join(","),
      ...analysisData.hypotheses.map((h: Hypothesis) => [
        h.targetGene,
        h.targetRole,
        h.clockGene,
        h.clockRole,
        h.significant ? "Yes" : "No",
        h.pValue?.toFixed(6) || "N/A",
        `"${(h.significantTerms || []).join("; ")}"`,
        `"${h.description}"`
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `par2-analysis-${analysisData.run?.id || "results"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const currentRun = analysisData?.run || latestRun;
  const hypotheses: Hypothesis[] = analysisData?.hypotheses || [];
  const artifactWarnings: { targetGene: string; warning: string; clockCount: number; sharedF2: number }[] = analysisData?.artifactWarnings || [];
  const isRunning = currentRun?.status === "running";
  const significantCount = hypotheses.filter(h => h.significant).length;

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/20">
      <header className="border-b border-border/50 bg-background/95 backdrop-blur-xl sticky top-12 z-40">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-2 min-h-[3rem]">
            <div className="flex items-center gap-3" data-testid="dashboard-header">
              <h1 className="font-semibold text-sm tracking-tight">Dashboard</h1>
              {uploadedFiles.length > 0 && (
                <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-lg bg-primary/10 border border-primary/20 text-xs text-primary">
                  <FileText size={14} />
                  <span className="max-w-28 truncate font-medium">
                    {uploadedFiles.length === 1 ? uploadedFiles[0].name : `${uploadedFiles.length} files`}
                  </span>
                  <button onClick={clearUpload} className="hover:text-primary/70 ml-1">
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <Button 
                variant="ghost"
                size="sm" 
                className="h-8 w-8 p-0"
                onClick={() => setShowQuickStart(true)}
                data-testid="button-quick-start"
                title="Quick Start Guide"
              >
                <BookOpen size={15} />
              </Button>
              <Button 
                variant="ghost"
                size="sm" 
                className="h-8 w-8 p-0"
                onClick={startNewAnalysis}
                data-testid="button-new-analysis"
                title="New Analysis"
              >
                <FileUp size={15} />
              </Button>
              <Button 
                variant="ghost"
                size="sm" 
                className="h-8 w-8 p-0"
                onClick={() => setShowHelp(true)}
                data-testid="button-help"
                title="Help"
              >
                <HelpCircle size={15} />
              </Button>
              <Button 
                variant="ghost"
                size="sm" 
                className="h-8 w-8 p-0"
                onClick={() => setShowSettings(true)}
                data-testid="button-settings"
                title="Settings"
              >
                <Settings size={15} />
              </Button>

              <div className="h-5 w-px bg-border/60 mx-1" />

              <Button 
                size="sm" 
                className="h-8 px-3 gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-sm"
                onClick={() => runAnalysisMutation.mutate()}
                disabled={isRunning || runAnalysisMutation.isPending}
                data-testid="button-run-analysis"
                id="analysis-section"
              >
                {isRunning || runAnalysisMutation.isPending ? (
                  <Loader2 className="animate-spin" size={15} />
                ) : (
                  <Play size={15} />
                )}
                <span className="hidden sm:inline">{isRunning ? "Running..." : "Run Analysis"}</span>
              </Button>
            </div>
          </div>
        </div>
        {isRunning && (
          <Progress value={66} className="h-0.5 rounded-none bg-transparent [&>div]:bg-primary/80" />
        )}
      </header>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Quick-access strip — always visible */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="quick-access-strip">
          {([
            { href: "/convergence-map",  icon: Mountain,     color: "text-cyan-400",   label: "Convergence Map",  desc: "Cross-dataset evidence" },
            { href: "/discovery-engine", icon: Upload,       color: "text-purple-400", label: "Upload Your Data", desc: "Instant eigenvalue analysis" },
            { href: "/gene-explorer",    icon: Dna,          color: "text-pink-400",   label: "Search a Gene",    desc: "38 pre-loaded datasets" },
            { href: "/ar2-diagnostics",  icon: CheckCircle2, color: "text-green-400",  label: "See the Evidence", desc: "Diagnostics & validation" },
          ] as const).map(({ href, icon: Icon, color, label, desc }) => (
            <Link key={href} href={href}>
              <Card className="bg-card border-border/50 hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer group h-full">
                <CardContent className="p-3 flex items-center gap-2.5">
                  <Icon className={`${color} group-hover:scale-110 transition-transform flex-shrink-0`} size={16} />
                  <div className="min-w-0">
                    <div className="font-semibold text-xs text-foreground leading-tight">{label}</div>
                    <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{desc}</div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Welcome intro — first-time visitors only */}
        {!currentRun && !latestRun && (
          <div className="rounded-xl border border-border/50 bg-gradient-to-br from-slate-50 via-white to-slate-50 p-6" data-testid="welcome-hero">
            <h2 className="text-xl font-bold bg-gradient-to-r from-emerald-400 via-cyan-400 to-violet-400 bg-clip-text text-transparent mb-2">
              Welcome to the PAR(2) Discovery Engine
            </h2>
            <p className="text-sm text-muted-foreground mb-2">
              Quantify how strongly the circadian clock controls gene expression — from "Is there a rhythm?" to "How persistent is that rhythm?" using eigenvalue profiling.
            </p>
            <p className="text-sm text-muted-foreground border-l-2 border-emerald-500/50 pl-3">
              <strong className="text-foreground">Main finding:</strong> Clock genes show consistently higher temporal persistence (median |λ| = 0.65) than their downstream targets (median |λ| = 0.53) across 4 species and 22 datasets. Select a dataset below to see this for yourself.
            </p>
          </div>
        )}

        {/* Settings Dialog */}
        <Dialog open={showSettings} onOpenChange={setShowSettings}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Settings size={18} />
                Analysis Parameters
              </DialogTitle>
              <DialogDescription>
                Configure the parameters for your analysis run.
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-6 py-4">
              <div className="space-y-2">
                <Label htmlFor="analysis-name">Analysis Name</Label>
                <Input 
                  id="analysis-name"
                  placeholder="e.g., Healthy Baseline Discovery"
                  value={analysisName}
                  onChange={(e) => setAnalysisName(e.target.value)}
                  data-testid="input-analysis-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Circadian Period: {period}h</Label>
                <Slider 
                  value={[period]} 
                  onValueChange={([v]) => setPeriod(v)}
                  min={12}
                  max={36}
                  step={1}
                  className="mt-2"
                  data-testid="slider-period"
                />
              </div>
              <div className="space-y-2">
                <Label>Significance Threshold: {significanceThreshold}</Label>
                <Slider 
                  value={[significanceThreshold * 100]} 
                  onValueChange={([v]) => setSignificanceThreshold(v / 100)}
                  min={1}
                  max={10}
                  step={0.5}
                  className="mt-2"
                  data-testid="slider-threshold"
                />
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Embedded Datasets Selector */}
        <EmbeddedDatasetSelector 
          onLoadDataset={handleLoadEmbeddedDataset}
          uploadedFiles={uploadedFiles}
        />

        {/* Scientific Disclaimer — moved below dataset selector, starts collapsed */}
        <Collapsible>
          <div className="flex items-center gap-3 px-4 py-2 rounded-lg border border-amber-500/20 bg-amber-500/5" data-testid="disclaimer-banner">
            <AlertTriangle className="text-amber-400/60 flex-shrink-0" size={14} />
            <p className="text-xs text-muted-foreground flex-1">
              <span className="font-medium text-amber-400/90">Hypothesis-generating tool</span> — findings require external validation (JTK_CYCLE, MetaCycle, RAIN).
            </p>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="text-xs text-amber-400/60 hover:text-amber-400 gap-1 flex-shrink-0 h-6 px-2" data-testid="button-disclaimer-details">
                <Info size={12} />
                Details
              </Button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent>
            <div className="mt-1.5 px-4 py-3 rounded-lg border border-amber-500/20 bg-amber-500/5 text-xs text-muted-foreground space-y-1.5">
              <p><strong>Assumptions:</strong> Evenly spaced time points, sinusoidal clock oscillation, stationary dynamics, 10+ timepoints.</p>
              <p><strong>Stress-tested:</strong> ~2% FDR across 36,000 simulations. Cross-tissue consensus (3+ tissues) reduces FDR by 87%.</p>
              <p className="text-amber-400/80">R scripts for cross-validation tools are available from the Help tab on the Getting Started page.</p>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* File Upload Zone — compact */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border border-dashed rounded-lg px-4 py-3 flex items-center gap-3 transition-all cursor-pointer ${
            isDragging
              ? 'border-primary bg-primary/10'
              : 'border-border/50 hover:border-primary/50 hover:bg-primary/5'
          }`}
          onClick={() => fileInputRef.current?.click()}
          data-testid="dropzone-upload"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.gz,.tsv,.txt"
            onChange={handleFileSelect}
            className="hidden"
            multiple
            data-testid="input-file"
          />
          <UploadCloud size={18} className={isDragging ? 'text-primary' : 'text-muted-foreground'} />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium">
              {uploadedFiles.length > 0
                ? `${uploadedFiles.length} file(s) loaded — drop more or click to add`
                : 'Upload your own CSV / TSV / GZ file'}
            </span>
            <span className="text-xs text-muted-foreground ml-2">or drag and drop</span>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
            <FileUp size={13} />
            Browse
          </Button>
        </div>

        {/* Uploaded Files List */}
        {uploadedFiles.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Uploaded Files ({uploadedFiles.length})</Label>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={clearUpload}
                className="gap-2 text-destructive hover:text-destructive"
                data-testid="button-clear-all-files"
              >
                <X size={14} />
                Clear All
              </Button>
            </div>
            <div className="grid gap-2">
              {uploadedFiles.map((file, idx) => {
                const info = datasetInfos.get(file.name);
                return (
                  <div 
                    key={file.name}
                    className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20"
                    data-testid={`file-item-${idx}`}
                  >
                    <div className="flex items-center gap-3">
                      <FileText size={16} className="text-primary" />
                      <div>
                        <p className="text-sm font-mono truncate max-w-[200px] sm:max-w-[400px]">{file.name}</p>
                        {info && (
                          <p className="text-xs text-muted-foreground">
                            {info.geneCount} genes × {info.rowCount} samples
                          </p>
                        )}
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); removeFile(file.name); }}
                      data-testid={`button-remove-file-${idx}`}
                    >
                      <X size={14} />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Data Quality Report */}
        {dataQualityReport && uploadedFiles.length > 0 && (
          <Card className={`border-2 ${
            dataQualityReport.overallScore === 'excellent' ? 'border-emerald-500/50 bg-emerald-500/5' :
            dataQualityReport.overallScore === 'good' ? 'border-blue-500/50 bg-blue-500/5' :
            dataQualityReport.overallScore === 'acceptable' ? 'border-yellow-500/50 bg-yellow-500/5' :
            dataQualityReport.overallScore === 'poor' ? 'border-orange-500/50 bg-orange-500/5' :
            'border-red-500/50 bg-red-500/10'
          }`} data-testid="card-data-quality">
            <CardContent className="p-4 space-y-3">
              {/* FIT REJECTED - Prominent Warning for Unusable Data */}
              {!dataQualityReport.canProceed && (
                <div className="p-4 rounded-lg bg-red-500/20 border-2 border-red-500/50 mb-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-10 w-10 rounded-full bg-red-500/30 flex items-center justify-center">
                      <XCircle className="h-6 w-6 text-red-400" />
                    </div>
                    <div>
                      <div className="text-lg font-bold text-red-400">FIT REJECTED</div>
                      <div className="text-sm text-red-300">Data too noisy for AR(2) stability analysis</div>
                    </div>
                  </div>
                  <p className="text-sm text-red-200 mt-2">
                    The PAR(2) engine only produces results when the math is certain. This "Honest Failure" ensures you can trust when the engine gives a "Green Light."
                  </p>
                </div>
              )}
              
              {/* Low Quality Warning */}
              {dataQualityReport.canProceed && dataQualityReport.overallScore === 'poor' && (
                <div className="p-4 rounded-lg bg-orange-500/20 border-2 border-orange-500/50 mb-4">
                  <div className="flex items-center gap-3 mb-2">
                    <AlertTriangle className="h-6 w-6 text-orange-400" />
                    <div>
                      <div className="text-lg font-bold text-orange-400">LOW QUALITY WARNING</div>
                      <div className="text-sm text-orange-300">Results may have reduced statistical power</div>
                    </div>
                  </div>
                  <p className="text-sm text-orange-200">
                    Analysis can proceed but findings should be interpreted with caution. Consider the recommendations below.
                  </p>
                </div>
              )}
              
              {/* PASS - Green Light for High Quality Data */}
              {dataQualityReport.canProceed && (dataQualityReport.overallScore === 'excellent' || dataQualityReport.overallScore === 'good') && (
                <div className="p-4 rounded-lg bg-emerald-500/20 border-2 border-emerald-500/50 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-emerald-500/30 flex items-center justify-center">
                      <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                    </div>
                    <div>
                      <div className="text-lg font-bold text-emerald-400">DATA QUALITY PASS</div>
                      <div className="text-sm text-emerald-300">Ready for rigorous PAR(2) stability analysis</div>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {dataQualityReport.overallScore === 'excellent' && <CheckCircle2 className="h-5 w-5 text-emerald-400" />}
                  {dataQualityReport.overallScore === 'good' && <CheckCircle2 className="h-5 w-5 text-blue-400" />}
                  {dataQualityReport.overallScore === 'acceptable' && <AlertTriangle className="h-5 w-5 text-yellow-400" />}
                  {dataQualityReport.overallScore === 'poor' && <AlertTriangle className="h-5 w-5 text-orange-400" />}
                  {dataQualityReport.overallScore === 'unusable' && <XCircle className="h-5 w-5 text-red-400" />}
                  <span className="font-semibold">
                    Quality Score: {dataQualityReport.overallScore.charAt(0).toUpperCase() + dataQualityReport.overallScore.slice(1)}
                  </span>
                </div>
                <Badge variant="outline" className="text-xs">
                  {dataQualityReport.metrics.estimatedDataType.replace('_', ' ')}
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground">
                <div className="p-2 bg-secondary/30 rounded text-center">
                  <div className="font-bold text-base text-foreground">{dataQualityReport.metrics.nTimepoints}</div>
                  <div>timepoints</div>
                </div>
                <div className="p-2 bg-secondary/30 rounded text-center">
                  <div className="font-bold text-base text-foreground">{dataQualityReport.metrics.nGenes.toLocaleString()}</div>
                  <div>genes</div>
                </div>
                <div className="p-2 bg-secondary/30 rounded text-center">
                  <div className="font-bold text-base text-foreground">{dataQualityReport.metrics.clockGenesFound.length}/8</div>
                  <div>clock genes</div>
                </div>
                <div className="p-2 bg-secondary/30 rounded text-center">
                  <div className="font-bold text-base text-foreground">{dataQualityReport.metrics.targetGenesFound.length}</div>
                  <div>target genes</div>
                </div>
              </div>
              
              {dataQualityReport.warnings.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Quality Issues Detected:</div>
                  {dataQualityReport.warnings.map((warning, idx) => (
                    <div 
                      key={idx} 
                      className={`p-3 rounded-lg text-sm flex items-start gap-2 ${
                        warning.severity === 'critical' ? 'bg-red-500/10 border border-red-500/30 text-red-300' :
                        warning.severity === 'warning' ? 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-300' :
                        'bg-blue-500/10 border border-blue-500/30 text-blue-300'
                      }`}
                    >
                      {warning.severity === 'critical' && <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />}
                      {warning.severity === 'warning' && <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />}
                      {warning.severity === 'info' && <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />}
                      <div>
                        <div className="font-medium">{warning.message}</div>
                        {warning.details && (
                          <div className="text-xs opacity-75 mt-1">{warning.details}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {dataQualityReport.recommendations.length > 0 && (
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                  <div className="text-xs font-medium text-blue-400 uppercase tracking-wider mb-1">Recommendations:</div>
                  <div className="text-sm text-blue-200">
                    {dataQualityReport.recommendations.join(' • ')}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}


        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Gene Pair Selection */}
          <div className="space-y-6">
             <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground">
                    Select Gene Pairs to Test
                  </CardTitle>
                  <CardDescription>Choose which hypotheses to analyze</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2 mb-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-2"
                      onClick={() => {
                        const allPairs: Array<{ target: string; clock: string }> = [];
                        config?.candidates.forEach(target => {
                          config?.clocks.forEach(clock => {
                            allPairs.push({ target: target.name, clock: clock.name });
                          });
                        });
                        setSelectedPairs(allPairs);
                      }}
                      data-testid="button-select-all-pairs"
                    >
                      <CheckSquare size={14} />
                      Select All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-2"
                      onClick={() => setSelectedPairs([])}
                      data-testid="button-clear-all-pairs"
                    >
                      <Square size={14} />
                      Clear All
                    </Button>
                  </div>
                  <div className="h-[360px] overflow-y-auto pr-4">
                    <div className="space-y-6">
                      {/* Group candidates by category */}
                      {Array.from(new Set(config?.candidates.map(c => c.category || 'Other'))).map(category => (
                        <div key={category} className="space-y-3">
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-primary/70 border-b border-primary/20 pb-1">
                            {category}
                          </h4>
                          {config?.candidates.filter(c => (c.category || 'Other') === category).map(target => (
                            <div key={target.name} className="space-y-2">
                              <div className="flex items-center gap-2">
                                <span 
                                  className="w-3 h-3 rounded-full flex-shrink-0" 
                                  style={{ backgroundColor: TARGET_COLORS[target.name] || '#888' }}
                                />
                                <Badge variant="outline" className="font-mono text-xs" style={{ color: TARGET_COLORS[target.name], borderColor: `${TARGET_COLORS[target.name]}40`, backgroundColor: `${TARGET_COLORS[target.name]}10` }}>
                                  {target.name}
                                </Badge>
                                <span className="text-[10px] text-muted-foreground">{target.role}</span>
                              </div>
                              <div className="pl-4 grid grid-cols-2 gap-1">
                                {config?.clocks.map(clock => {
                                  const isSelected = selectedPairs.some(
                                    p => p.target === target.name && p.clock === clock.name
                                  );
                                  return (
                                    <label
                                      key={`${target.name}-${clock.name}`}
                                      className={`flex items-center gap-2 p-1.5 rounded cursor-pointer transition-colors text-xs ${
                                        isSelected ? 'bg-primary/10 border border-primary/30' : 'hover:bg-secondary/50'
                                      }`}
                                      data-testid={`checkbox-pair-${target.name}-${clock.name}`}
                                    >
                                      <Checkbox
                                        checked={isSelected}
                                        onCheckedChange={() => togglePair(target.name, clock.name)}
                                        className="h-3 w-3"
                                      />
                                      <span 
                                        className="w-2 h-2 rounded-full flex-shrink-0" 
                                        style={{ backgroundColor: CLOCK_COLORS[clock.name] || '#888' }}
                                      />
                                      <span className="font-mono text-[10px]" style={{ color: CLOCK_COLORS[clock.name] }}>{clock.name}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
             </Card>

             {/* Previous Runs */}
             {runs.length > 0 && (
               <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground">
                      Previous Analyses
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 max-h-48 overflow-y-auto">
                    {runs.slice(0, 5).map(run => (
                      <button
                        key={run.id}
                        onClick={() => setSelectedRunId(run.id)}
                        className={`w-full text-left p-3 rounded-lg transition-colors ${
                          (selectedRunId || latestRun?.id) === run.id 
                            ? 'bg-primary/10 border border-primary/30' 
                            : 'bg-secondary/30 hover:bg-secondary/50'
                        }`}
                        data-testid={`button-run-${run.id}`}
                      >
                        <div className="font-medium text-sm truncate">{run.name}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                          <span>{new Date(run.createdAt).toLocaleDateString()}</span>
                          <Badge variant={run.status === "completed" ? "default" : "secondary"} className="text-[10px]">
                            {run.status}
                          </Badge>
                        </div>
                      </button>
                    ))}
                  </CardContent>
               </Card>
             )}
          </div>

          {/* Middle & Right: Analysis Results */}
          <div className="lg:col-span-2 space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
                <TabsList className="bg-secondary/50 flex-wrap h-auto gap-0.5 p-1">
                  <TabsTrigger value="results" className="text-xs px-3 py-1.5 h-8" data-testid="tab-results">Results</TabsTrigger>
                  <TabsTrigger value="network" className="text-xs px-3 py-1.5 h-8" data-testid="tab-network">Network</TabsTrigger>
                  <TabsTrigger value="visualization" className="text-xs px-3 py-1.5 h-8" data-testid="tab-visualization">Charts</TabsTrigger>
                  <TabsTrigger value="highconfidence" className="text-xs px-3 py-1.5 h-8" data-testid="tab-highconfidence">Top Hits</TabsTrigger>
                  <TabsTrigger value="compare" className="text-xs px-3 py-1.5 h-8" data-testid="tab-compare">Compare</TabsTrigger>
                  <TabsTrigger value="advanced" className="text-xs px-3 py-1.5 h-8 text-orange-400" data-testid="tab-advanced">Settings</TabsTrigger>
                </TabsList>
                <div className="flex-shrink-0">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
                        <FileDown size={13} />
                        Export
                        <ChevronDown size={12} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuLabel className="text-xs text-muted-foreground">Downloads</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <a href="/api/download/full-analysis-report" download className="flex items-center gap-2 cursor-pointer text-xs" data-testid="button-full-report">
                          <FileDown size={13} className="text-emerald-500" />
                          Full Analysis Report
                        </a>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <a href="/api/download/explosive-dynamics-report" download className="flex items-center gap-2 cursor-pointer text-xs" data-testid="button-explosive-report">
                          <FileDown size={13} className="text-red-500" />
                          Dynamics Report
                        </a>
                      </DropdownMenuItem>
                      {hypotheses.length > 0 && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuLabel className="text-xs text-muted-foreground">Results</DropdownMenuLabel>
                          <DropdownMenuItem onClick={generatePublicationReport} className="flex items-center gap-2 cursor-pointer text-xs" data-testid="button-publication">
                            <BookOpen size={13} />
                            Export Report
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => printResultsToPDF(false)} className="flex items-center gap-2 cursor-pointer text-xs" data-testid="button-print">
                            <Printer size={13} />
                            Print
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={downloadResultsAsPDF} className="flex items-center gap-2 cursor-pointer text-xs" data-testid="button-pdf">
                            <FileDown size={13} className="text-purple-500" />
                            Save as PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={downloadResults} className="flex items-center gap-2 cursor-pointer text-xs" data-testid="button-download">
                            <Download size={13} />
                            Download CSV
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <TabsContent value="results" className="space-y-4 min-h-[400px]">
                 <AnimatePresence mode="wait">
                   {isRunning && hypotheses.length === 0 ? (
                      <motion.div 
                        key="running"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="flex flex-col items-center justify-center h-[400px] border border-dashed border-border/50 rounded-xl"
                        data-testid="status-running"
                      >
                        <Activity className="text-primary animate-pulse mb-4" size={48} />
                        <p className="font-mono text-muted-foreground">Running PAR(2) Regression Models...</p>
                        <p className="text-sm text-muted-foreground mt-2">Analyzing {selectedPairs.length} gene pairs</p>
                      </motion.div>
                   ) : hypotheses.length > 0 ? (
                      <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                        {/* Eigenperiod Summary - hypothesis-generating, lead with within-system comparisons */}
                        <Card className="border-cyan-500/50 bg-gradient-to-r from-cyan-500/10 to-blue-500/10">
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div className="h-10 w-10 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                                <Activity size={20} className="text-cyan-400" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-semibold text-cyan-400">Eigenperiod Structure Analysis</h3>
                                  <Badge className="bg-cyan-500/20 text-cyan-300 text-[10px]">HYPOTHESIS-GENERATING</Badge>
                                </div>
                                <p className="text-sm text-muted-foreground mb-2">
                                  AR(2) coefficients yield emergent eigenperiods. The strongest evidence comes from <strong>within-system comparisons</strong> (e.g., GSE157357 organoid genotypes sharing species, tissue, and platform):
                                </p>
                                <div className="grid grid-cols-2 gap-4 text-xs">
                                  <div className="bg-emerald-500/10 rounded p-2 border border-emerald-500/30">
                                    <span className="text-emerald-400 font-semibold">Within-System (Organoids):</span>
                                    <span className="text-foreground ml-2">WT vs APC/BMAL1 mutants</span>
                                  </div>
                                  <div className="bg-amber-500/10 rounded p-2 border border-amber-500/30">
                                    <span className="text-amber-400 font-semibold">Cross-System (Caution):</span>
                                    <span className="text-foreground ml-2">Species/context confounded</span>
                                  </div>
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">
                                  Cross-system comparisons (e.g., mouse tissue in vivo vs human cell line in vitro) confound species, tissue type, and experimental context. These are <strong>hypothesis-generating</strong>, not confirmatory. Individual gene pairs below are candidates for focused follow-up.
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Artifact Warnings */}
                        {artifactWarnings.length > 0 && (
                          <Card className="border-amber-500/50 bg-gradient-to-r from-amber-500/10 to-orange-500/10">
                            <CardContent className="p-4">
                              <div className="flex items-start gap-3">
                                <AlertTriangle size={20} className="text-amber-400 flex-shrink-0 mt-0.5" />
                                <div className="flex-1">
                                  <h3 className="font-semibold text-amber-400 mb-1">Uniform Effect Size Warning</h3>
                                  {artifactWarnings.map((w, i) => (
                                    <p key={i} className="text-xs text-muted-foreground mb-1" data-testid={`artifact-warning-${w.targetGene}`}>
                                      {w.warning}
                                    </p>
                                  ))}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )}
                        
                        {/* FDR Tier Filter */}
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-4 p-3 bg-muted/30 rounded-lg border border-border/50">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Confidence Filter:</span>
                            <div className="flex flex-wrap gap-1">
                              <Button
                                size="sm"
                                variant={fdrTier === 'all' ? 'default' : 'outline'}
                                onClick={() => setFdrTier('all')}
                                className="h-7 px-2 text-xs whitespace-nowrap"
                                data-testid="filter-tier-all"
                              >
                                All
                              </Button>
                              <Button
                                size="sm"
                                variant={fdrTier === 'tier1' ? 'default' : 'outline'}
                                onClick={() => setFdrTier('tier1')}
                                className={`h-7 px-2 text-xs whitespace-nowrap ${fdrTier === 'tier1' ? 'bg-emerald-600 hover:bg-emerald-700' : 'border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10'}`}
                                data-testid="filter-tier-1"
                              >
                                Tier 1 (q≤0.05)
                              </Button>
                              <Button
                                size="sm"
                                variant={fdrTier === 'tier2' ? 'default' : 'outline'}
                                onClick={() => setFdrTier('tier2')}
                                className={`h-7 px-2 text-xs whitespace-nowrap ${fdrTier === 'tier2' ? 'bg-amber-600 hover:bg-amber-700' : 'border-amber-500/50 text-amber-400 hover:bg-amber-500/10'}`}
                                data-testid="filter-tier-2"
                              >
                                Tier 2 (q≤0.10)
                              </Button>
                              <Button
                                size="sm"
                                variant={fdrTier === 'tier3' ? 'default' : 'outline'}
                                onClick={() => setFdrTier('tier3')}
                                className={`h-7 px-2 text-xs whitespace-nowrap ${fdrTier === 'tier3' ? 'bg-slate-600 hover:bg-slate-200' : 'border-slate-300/50 text-slate-500 hover:bg-slate-500/10'}`}
                                data-testid="filter-tier-3"
                              >
                                Tier 3 (q≤0.50)
                              </Button>
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {(() => {
                              const t1 = hypotheses.filter(h => h.significant && (h.qValue ?? h.fdrAdjustedPValue ?? 1) <= 0.05).length;
                              const t2 = hypotheses.filter(h => h.significant && (h.qValue ?? h.fdrAdjustedPValue ?? 1) > 0.05 && (h.qValue ?? h.fdrAdjustedPValue ?? 1) <= 0.10).length;
                              const t3 = hypotheses.filter(h => h.significant && (h.qValue ?? h.fdrAdjustedPValue ?? 1) > 0.10).length;
                              return (
                                <span className="flex gap-3">
                                  <span className="text-emerald-400">{t1} high-conf</span>
                                  <span className="text-amber-400">{t2} moderate</span>
                                  <span className="text-slate-500">{t3} exploratory</span>
                                </span>
                              );
                            })()}
                          </div>
                        </div>

                        {/* Candidate Findings - Collapsible */}
                        {(() => {
                          const allSignificant = hypotheses.filter(h => h.significant);
                          const significantResults = allSignificant.filter(h => {
                            const q = h.qValue ?? h.fdrAdjustedPValue ?? 1;
                            if (fdrTier === 'tier1') return q <= 0.05;
                            if (fdrTier === 'tier2') return q <= 0.10;
                            if (fdrTier === 'tier3') return q <= 0.50;
                            return true; // 'all'
                          });
                          const nonSignificantResults = hypotheses.filter(h => !h.significant);
                          return (
                            <>
                              {significantResults.length > 0 && (
                                <Collapsible defaultOpen={true} className="border border-amber-500/30 rounded-lg bg-amber-500/5">
                                  <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-amber-500/10 transition-colors rounded-lg group" data-testid="trigger-significant-results">
                                    <div className="flex items-center gap-3">
                                      <div className="h-8 w-8 rounded-full bg-amber-500/20 flex items-center justify-center">
                                        <AlertTriangle size={16} className="text-amber-400" />
                                      </div>
                                      <div className="text-left">
                                        <h3 className="font-semibold text-amber-400">
                                          {fdrTier === 'tier1' ? 'High-Confidence Pairs (q≤0.05)' : 
                                           fdrTier === 'tier2' ? 'Moderate-Confidence Pairs (q≤0.10)' :
                                           fdrTier === 'tier3' ? 'Exploratory Pairs (q≤0.50)' : 'Candidate Gene Pairs'}
                                        </h3>
                                        <p className="text-xs text-muted-foreground">
                                          {significantResults.length} pair{significantResults.length !== 1 ? 's' : ''} 
                                          {fdrTier === 'tier1' ? ' · ≤5% false discovery rate' :
                                           fdrTier === 'tier2' ? ' · ≤10% false discovery rate' :
                                           fdrTier === 'tier3' ? ' · ≤50% false discovery rate' :
                                           ` · Showing all ${allSignificant.length} flagged`}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline" className="bg-emerald-500/10 border-emerald-500/30 text-emerald-300 text-[10px]">
                                        Check "Confident" tab for 3+ tissue validation
                                      </Badge>
                                      <ChevronDown size={20} className="text-amber-400 transition-transform group-data-[state=open]:rotate-180" />
                                    </div>
                                  </CollapsibleTrigger>
                                  <CollapsibleContent className="px-4 pb-4">
                                    <p className="text-xs text-muted-foreground mb-3 pt-2 border-t border-amber-500/20">
                                      <strong>STRONG</strong> = q&lt;0.01 + large effect · <strong>CANDIDATE</strong> = q&lt;0.05 + effect · <strong>WEAK</strong> = q&lt;0.10 · <strong>EXPLORE</strong> = hypothesis-generating. Cross-tissue consensus (see "Confident" tab) reduces FDR to 2.1%.
                                    </p>
                                    <div className="space-y-2">
                                      {significantResults.map((result, idx) => (
                                        <ResultCard 
                                          key={result.id} 
                                          result={result} 
                                          index={idx} 
                                          onClick={() => setSelectedResult(result)}
                                        />
                                      ))}
                                    </div>
                                  </CollapsibleContent>
                                </Collapsible>
                              )}
                              
                              {nonSignificantResults.length > 0 && (
                                <Collapsible defaultOpen={significantResults.length === 0} className="border border-border/30 rounded-lg bg-muted/5">
                                  <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-muted/10 transition-colors rounded-lg group" data-testid="trigger-nonsignificant-results">
                                    <div className="flex items-center gap-3">
                                      <div className="h-8 w-8 rounded-full bg-muted/20 flex items-center justify-center">
                                        <XCircle size={16} className="text-muted-foreground" />
                                      </div>
                                      <div className="text-left">
                                        <h3 className="font-medium text-muted-foreground">No Significant Gating</h3>
                                        <p className="text-xs text-muted-foreground">{nonSignificantResults.length} gene pair{nonSignificantResults.length !== 1 ? 's' : ''} tested</p>
                                      </div>
                                    </div>
                                    <ChevronDown size={20} className="text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                                  </CollapsibleTrigger>
                                  <CollapsibleContent className="px-4 pb-4">
                                    <div className="space-y-2 pt-2">
                                      {nonSignificantResults.map((result, idx) => (
                                        <ResultCard 
                                          key={result.id} 
                                          result={result} 
                                          index={idx + significantResults.length} 
                                          onClick={() => setSelectedResult(result)}
                                        />
                                      ))}
                                    </div>
                                  </CollapsibleContent>
                                </Collapsible>
                              )}
                            </>
                          );
                        })()}
                        
                        {/* Phase-Sorted Heatmap with Enrichr Integration */}
                        <PhaseHeatmap 
                          data={phaseHeatmapData} 
                          isLoading={isLoadingPhaseHeatmap}
                        />
                      </motion.div>
                   ) : (
                      <motion.div 
                        key="empty"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="flex flex-col items-center justify-center h-[400px] border border-dashed border-border/50 rounded-xl"
                        data-testid="status-empty"
                      >
                        <FlaskConical className="text-muted-foreground mb-4" size={48} />
                        <p className="font-mono text-muted-foreground">
                          {uploadedFiles.length > 0 
                            ? `Click 'Run Analysis' to analyze ${uploadedFiles.length} file(s)` 
                            : "Upload your data and click 'Run Analysis'"
                          }
                        </p>
                        {uploadedFiles.length === 0 && (
                          <p className="text-sm text-muted-foreground mt-2 flex items-center gap-2">
                            <AlertCircle size={14} />
                            Without data, analysis uses simulated expression values
                          </p>
                        )}
                      </motion.div>
                   )}
                 </AnimatePresence>
              </TabsContent>

              <TabsContent value="network" className="space-y-4">
                <NetworkGraphPanel 
                  hypotheses={hypotheses}
                  height={500}
                />
              </TabsContent>

              <TabsContent value="visualization">
                <Card className="h-[500px] border-border/50">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Expression Time-Series</CardTitle>
                      <CardDescription>
                        {datasetInfos.size > 0 
                          ? `Showing first 3 genes from ${Array.from(datasetInfos.values())[0]?.fileName || 'dataset'}`
                          : "Upload data to visualize real expression profiles"
                        }
                      </CardDescription>
                    </div>
                    <ChartExportButton 
                      chartRef={expressionChartRef} 
                      filename="expression_timeseries"
                      data-testid="button-export-expression-chart"
                    />
                  </CardHeader>
                  <CardContent className="h-[400px]" ref={expressionChartRef}>
                    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                      <LineChart data={datasetInfos.size > 0 ? Array.from(datasetInfos.values())[0]?.previewData : generateMockPhaseData()}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                        <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} label={{ value: 'Time (hours)', position: 'insideBottom', offset: -5 }} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} label={{ value: 'Expression', angle: -90, position: 'insideLeft' }} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
                          labelStyle={{ color: '#334155' }}
                          itemStyle={{ color: '#475569' }}
                        />
                        <Legend />
                        {datasetInfos.size > 0 && Array.from(datasetInfos.values())[0]?.previewData ? (
                          Object.keys(Array.from(datasetInfos.values())[0]?.previewData?.[0] || {}).filter(k => k !== 'time').slice(0, 4).map((gene, i) => {
                            const color = GENE_COLORS[i % GENE_COLORS.length];
                            return (
                              <Line 
                                key={gene} 
                                type="monotone" 
                                dataKey={gene} 
                                name={gene.length > 15 ? gene.slice(0, 15) + "..." : gene}
                                stroke={color} 
                                strokeWidth={2} 
                                dot={{ fill: color, strokeWidth: 0, r: 4 }}
                                activeDot={{ r: 6, fill: color, stroke: 'white', strokeWidth: 2 }}
                              />
                            );
                          })
                        ) : (
                          <>
                            <Line type="monotone" dataKey="Per2" name="Per2 (Clock)" stroke={CLOCK_COLORS['Per2']} strokeWidth={2} dot={{ fill: CLOCK_COLORS['Per2'], strokeWidth: 0, r: 4 }} activeDot={{ r: 6, fill: CLOCK_COLORS['Per2'], stroke: 'white', strokeWidth: 2 }} />
                            <Line type="monotone" dataKey="Myc" name="Myc (Target)" stroke={TARGET_COLORS['Myc']} strokeWidth={2} strokeDasharray="5 5" dot={{ fill: TARGET_COLORS['Myc'], strokeWidth: 0, r: 4 }} activeDot={{ r: 6, fill: TARGET_COLORS['Myc'], stroke: 'white', strokeWidth: 2 }} />
                          </>
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Beta Trajectory Visualization */}
                <Card className="mt-6 border-amber-500/30 bg-gradient-to-r from-amber-500/5 to-orange-500/5">
                  <CardHeader className="flex flex-row items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp size={18} className="text-amber-400" />
                        β-Trajectory: Dynamic Approach to φ
                        <span className="px-2 py-0.5 rounded-full bg-slate-600/50 text-slate-600 text-xs font-medium">ILLUSTRATIVE DEMO</span>
                      </CardTitle>
                      <CardDescription>
                        Conceptual illustration showing how AR(2) coefficients could evolve toward the mid-stability band. Data points are synthetic — see Root-Space page for real gene positions.
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-amber-500/50 text-amber-300 hover:bg-amber-500/20"
                      onClick={() => {
                        window.location.href = '/api/export-trajectory-analysis';
                      }}
                      data-testid="button-download-trajectory-analysis"
                    >
                      <Download size={14} className="mr-1" />
                      Export Analysis
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Trajectory in β-space */}
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                          <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 40 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                            <XAxis 
                              type="number" 
                              dataKey="beta1" 
                              name="β₁" 
                              domain={[-0.5, 2.5]}
                              stroke="hsl(var(--muted-foreground))" 
                              fontSize={11}
                              label={{ value: 'β₁ (lag-1 coefficient)', position: 'bottom', offset: 20 }}
                            />
                            <YAxis 
                              type="number" 
                              dataKey="beta2" 
                              name="β₂" 
                              domain={[-1.5, 0.5]}
                              stroke="hsl(var(--muted-foreground))" 
                              fontSize={11}
                              label={{ value: 'β₂ (lag-2)', angle: -90, position: 'left', offset: 10 }}
                            />
                            <ZAxis type="number" dataKey="bandProximity" range={[50, 200]} name="Band proximity" />
                            <Tooltip 
                              contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
                              labelStyle={{ color: '#334155' }}
                              itemStyle={{ color: '#475569' }}
                              formatter={(value: number, name: string) => {
                                if (name === 'bandProximity') return [`${(value * 100).toFixed(1)}%`, 'Band proximity'];
                                return [typeof value === 'number' ? value.toFixed(3) : value, name];
                              }}
                            />
                            {/* Mid-band reference line */}
                            <Scatter 
                              name="Mid-band reference" 
                              data={[
                                { beta1: 0, beta2: 0 },
                                { beta1: 1.618, beta2: -1 },
                                { beta1: 2.427, beta2: -1.5 }
                              ]} 
                              fill="#fbbf24"
                              line={{ stroke: '#fbbf24', strokeWidth: 2, strokeDasharray: '5 5' }}
                              shape="circle"
                            />
                            <Scatter 
                              name="Synthetic demo trajectory" 
                              data={[
                                { beta1: 0.5, beta2: -0.3, bandProximity: 0.2 },
                                { beta1: 0.8, beta2: -0.5, bandProximity: 0.4 },
                                { beta1: 1.1, beta2: -0.7, bandProximity: 0.6 },
                                { beta1: 1.4, beta2: -0.85, bandProximity: 0.8 },
                                { beta1: 1.55, beta2: -0.95, bandProximity: 0.92 },
                                { beta1: 1.62, beta2: -1.0, bandProximity: 0.99 }
                              ]} 
                              fill="#10b981"
                              line={{ stroke: '#10b981', strokeWidth: 2 }}
                            />
                          </ScatterChart>
                        </ResponsiveContainer>
                      </div>
                      
                      {/* Fibonacci similarity over time (synthetic illustration) */}
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                          <LineChart 
                            data={[
                              { time: 0, similarity: 0.2, ratio: 1.67 },
                              { time: 2, similarity: 0.35, ratio: 1.6 },
                              { time: 4, similarity: 0.5, ratio: 1.55 },
                              { time: 6, similarity: 0.65, ratio: 1.58 },
                              { time: 8, similarity: 0.75, ratio: 1.61 },
                              { time: 10, similarity: 0.82, ratio: 1.615 },
                              { time: 12, similarity: 0.88, ratio: 1.617 },
                              { time: 14, similarity: 0.92, ratio: 1.6175 },
                              { time: 16, similarity: 0.95, ratio: 1.618 },
                              { time: 18, similarity: 0.97, ratio: 1.6181 },
                              { time: 20, similarity: 0.98, ratio: 1.61803 },
                              { time: 22, similarity: 0.99, ratio: 1.618034 }
                            ]}
                            margin={{ top: 20, right: 30, bottom: 40, left: 40 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                            <XAxis 
                              dataKey="time" 
                              stroke="hsl(var(--muted-foreground))" 
                              fontSize={11}
                              label={{ value: 'Time (hours)', position: 'bottom', offset: 20 }}
                            />
                            <YAxis 
                              yAxisId="left"
                              stroke="hsl(var(--muted-foreground))" 
                              fontSize={11}
                              domain={[0, 1]}
                              label={{ value: 'Band proximity', angle: -90, position: 'left', offset: 10 }}
                            />
                            <YAxis 
                              yAxisId="right"
                              orientation="right"
                              stroke="#fbbf24" 
                              fontSize={11}
                              domain={[1.5, 1.7]}
                              label={{ value: '|β₁/β₂|', angle: 90, position: 'right', offset: 10 }}
                            />
                            <Tooltip 
                              contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
                              labelStyle={{ color: '#334155' }}
                              itemStyle={{ color: '#475569' }}
                              formatter={(value: number, name: string) => {
                                if (name === 'similarity') return [`${(value * 100).toFixed(1)}%`, 'Band proximity'];
                                return [value.toFixed(4), '|β₁/β₂| ratio'];
                              }}
                            />
                            <Legend />
                            {/* Mid-band reference line */}
                            <Line 
                              yAxisId="right"
                              type="monotone" 
                              dataKey={() => 1.618} 
                              name="Mid-band ref" 
                              stroke="#fbbf24" 
                              strokeDasharray="5 5"
                              dot={false}
                            />
                            <Line 
                              yAxisId="right"
                              type="monotone" 
                              dataKey="ratio" 
                              name="|β₁/β₂|" 
                              stroke="#22d3ee" 
                              strokeWidth={2}
                              dot={{ fill: '#22d3ee', r: 3 }}
                            />
                            <Line 
                              yAxisId="left"
                              type="monotone" 
                              dataKey="similarity" 
                              name="similarity" 
                              stroke="#10b981" 
                              strokeWidth={2}
                              dot={{ fill: '#10b981', r: 3 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    
                    <div className="mt-6 space-y-4">
                      <Collapsible>
                        <CollapsibleTrigger className="flex items-center gap-2 text-amber-300 hover:text-amber-200 transition-colors">
                          <BookOpen size={16} />
                          <span className="font-medium">What is β-Trajectory Analysis?</span>
                          <ChevronDown size={14} className="ml-1" />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-3 space-y-4 text-sm text-muted-foreground">
                          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                            <h4 className="text-cyan-300 font-semibold mb-2">The Science Behind β-Trajectory</h4>
                            <p className="mb-3">
                              <strong className="text-foreground">β-Trajectory analysis</strong> uses a sliding window approach to track how 
                              autoregressive (AR2) coefficients evolve over time in gene expression data. When we fit the model:
                            </p>
                            <div className="bg-slate-50 p-3 rounded font-mono text-xs text-center mb-3 border border-slate-300">
                              y(t) = β₁ · y(t-1) + β₂ · y(t-2) + ε
                            </div>
                            <p className="mb-2">
                              The ratio <span className="text-amber-300 font-mono">|β₁/β₂|</span> reveals the underlying dynamics. 
                              When eigenvalue modulus |λ| falls within the <span className="text-amber-300 font-semibold">stable band (0.40-0.80)</span>, 
                              the system exhibits <strong className="text-foreground">characteristic circadian regulation persistence</strong>.
                            </p>
                          </div>
                          
                          <div className="p-4 bg-emerald-500/10 rounded-lg border border-emerald-500/30">
                            <h4 className="text-emerald-300 font-semibold mb-2">Why This Matters for Circadian Research</h4>
                            <ul className="space-y-2 list-disc list-inside">
                              <li><strong className="text-foreground">Phase-Amplitude Gating:</strong> Clock genes may "gate" cancer-related gene expression by modulating their temporal dynamics toward or away from critical attractors.</li>
                              <li><strong className="text-foreground">Stability Validation:</strong> Only trajectories with eigenvalues inside the unit circle (|λ| &lt; 1) represent stable, biologically meaningful dynamics.</li>
                              <li><strong className="text-foreground">φ-Proximity (Exploratory):</strong> Gene-pair proximity to φ was tested but genome-wide enrichment is not statistically significant at the individual gene level (p = 0.154). Pair-level counts can inflate apparent enrichment due to combinatorial effects. This observation remains hypothesis-generating only. <span className="text-slate-500 text-xs">[Pair-counting caveat: gene-pair metrics overestimate enrichment vs. unique gene counts]</span></li>
                            </ul>
                          </div>
                          
                          <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/30">
                            <h4 className="text-purple-300 font-semibold mb-2">How to Interpret the Charts</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <p className="text-purple-200 font-medium text-xs mb-1">β-Space Scatter (Left)</p>
                                <p className="text-xs">Points show (β₁, β₂) at each time window. The reference line marks the mid-stability region. Trajectories moving toward this line indicate approach to the empirical clustering zone (~0.5-0.7).</p>
                              </div>
                              <div>
                                <p className="text-purple-200 font-medium text-xs mb-1">Ratio Convergence (Right)</p>
                                <p className="text-xs">The cyan line tracks |β₁/β₂| over time. When it approaches the reference line, the gene pair enters the mid-stability region (~0.5-0.7 band).</p>
                              </div>
                            </div>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                      
                      <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/30">
                        <div className="flex items-start gap-2">
                          <Sparkles size={16} className="text-amber-400 mt-0.5 flex-shrink-0" />
                          <div className="text-sm">
                            <span className="text-amber-300 font-medium">Stability Dynamics:</span>
                            <span className="text-muted-foreground ml-1">
                              This visualization illustrates how AR(2) eigenvalue modulus |λ| changes over time. 
                              Gene pairs that cluster within the mid-stability band (~0.5-0.7) exhibit 
                              target-intrinsic dynamics that may be condition-dependent.
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Comprehensive Research Findings */}
                      <div className="p-5 bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-xl border border-cyan-500/40 shadow-lg">
                        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-200">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-cyan-500/30 to-purple-500/30 flex items-center justify-center">
                            <FileText size={20} className="text-cyan-400" />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">
                              PAR(2) β-Trajectory Analysis: Complete Findings
                            </h3>
                            <p className="text-xs text-muted-foreground">AR(2) Eigenvalue Stability Profiling</p>
                            <div className="flex items-center gap-1.5 mt-1" data-testid="note-edge-case-diagnostics-trajectory">
                              <Shield size={10} className="text-slate-500" />
                              <span className="text-[10px] text-slate-500">Edge case diagnostics screening applied</span>
                            </div>
                          </div>
                        </div>
                        
                        {isLoadingTrajectory ? (
                          <div className="text-muted-foreground text-sm flex items-center gap-2">
                            <Loader2 size={16} className="animate-spin" />
                            Loading comprehensive analysis...
                          </div>
                        ) : trajectoryData ? (
                          <div className="space-y-5">
                            {/* Executive Summary */}
                            <div className="p-4 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 rounded-lg border border-emerald-500/30">
                              <h4 className="text-emerald-300 font-semibold mb-2 flex items-center gap-2">
                                <CheckCircle2 size={16} />
                                Executive Summary
                              </h4>
                              <p className="text-sm text-muted-foreground leading-relaxed">
                                This analysis profiled <strong className="text-foreground">AR(2) eigenvalue stability</strong> across 
                                clock-target gene pairs. Using PAR(2) regression with eigenvalue tracking, 
                                we characterized temporal dynamics by eigenvalue modulus |λ|, identifying natural clustering 
                                into discrete stability regimes (~0.5 and ~0.7 bands) that may reflect target-intrinsic dynamics.
                              </p>
                            </div>
                            
                            {/* Key Metrics */}
                            <div>
                              <h4 className="text-cyan-300 font-semibold mb-3 flex items-center gap-2">
                                <BarChart3 size={16} />
                                Analysis Scope
                              </h4>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="bg-slate-50 p-3 rounded-lg text-center border border-slate-200">
                                  <div className="text-2xl font-bold text-cyan-400">{trajectoryData.summary.totalDatasetsAnalyzed}</div>
                                  <div className="text-xs text-muted-foreground">Datasets</div>
                                  <div className="text-[10px] text-slate-500 mt-1">Mouse tissues, organoids, human cells</div>
                                </div>
                                <div className="bg-slate-50 p-3 rounded-lg text-center border border-slate-200">
                                  <div className="text-2xl font-bold text-emerald-400">{trajectoryData.summary.totalGenePairs}</div>
                                  <div className="text-xs text-muted-foreground">Gene Pairs Tested</div>
                                  <div className="text-[10px] text-slate-500 mt-1">Clock × target combinations</div>
                                </div>
                                <div className="bg-slate-50 p-3 rounded-lg text-center border border-slate-200">
                                  <div className="text-2xl font-bold text-amber-400">{trajectoryData.summary.pairsApproachingPhi}</div>
                                  <div className="text-xs text-muted-foreground">Approaching φ</div>
                                  <div className="text-[10px] text-slate-500 mt-1">φ-similarity {">"} 0.8</div>
                                </div>
                                <div className="bg-slate-50 p-3 rounded-lg text-center border border-slate-200">
                                  <div className="text-2xl font-bold text-purple-400">{(trajectoryData.summary.averagePhiSimilarity * 100).toFixed(1)}%</div>
                                  <div className="text-xs text-muted-foreground">Mean φ Similarity</div>
                                  <div className="text-[10px] text-slate-500 mt-1">Band proximity (0.40-0.80)</div>
                                </div>
                              </div>
                            </div>
                            
                            {/* Principal Findings */}
                            <div>
                              <h4 className="text-amber-300 font-semibold mb-3 flex items-center gap-2">
                                <Sparkles size={16} />
                                Principal Findings
                              </h4>
                              <div className="space-y-3">
                                <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/30">
                                  <p className="text-sm font-medium text-amber-300 mb-1">1. Eigenvalue Clustering Pattern</p>
                                  <p className="text-xs text-muted-foreground">
                                    <strong className="text-foreground">{((trajectoryData.summary.pairsApproachingPhi / Math.max(trajectoryData.summary.totalGenePairs, 1)) * 100).toFixed(0)}%</strong> of 
                                    clock-target gene pairs exhibit eigenvalue modulus |λ| within the mid-stability band.
                                    This clustering reflects target-intrinsic dynamics that may be condition-dependent.
                                    APC-knockout cancer shows elevated z-score (z=4.4) while wild-type does not (z=-0.6), but this uses pair-counting which inflates significance. Treat as exploratory.
                                  </p>
                                </div>
                                
                                <div className="p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/30">
                                  <p className="text-sm font-medium text-emerald-300 mb-1">2. Condition-Specific Pattern (Exploratory)</p>
                                  <p className="text-xs text-muted-foreground">
                                    Validation across 31 datasets shows <strong className="text-foreground">3/15 exceed null expectations</strong>.
                                    APC-knockout (z=4.4) vs. wild-type (z=-0.6) suggests a condition-specific pattern, but genome-wide gene-level φ-enrichment is not significant (p = 0.154). Pair-counting methodology inflates apparent enrichment.
                                  </p>
                                </div>
                                
                                <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/30">
                                  <p className="text-sm font-medium text-purple-300 mb-1">3. Stability-Assessed Dynamics</p>
                                  <p className="text-xs text-muted-foreground">
                                    All reported trajectories satisfy AR(2) stability criteria (eigenvalues inside unit circle), 
                                    ensuring biologically plausible dynamics. Unstable or explosive trajectories are excluded, 
                                    focusing analysis on sustained regulatory relationships.
                                  </p>
                                </div>
                              </div>
                            </div>
                            
                            {/* Interpretation */}
                            <div className="p-4 bg-slate-100 rounded-lg border border-slate-300">
                              <h4 className="text-slate-800 font-semibold mb-2 flex items-center gap-2">
                                <BookOpen size={16} />
                                Scientific Interpretation
                              </h4>
                              <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                                The clustering of eigenvalue modulus |λ| into discrete bands (~0.5, ~0.7) reflects 
                                <strong className="text-foreground">target-intrinsic temporal persistence</strong>—how long expression 
                                changes persist before dampening. Clock pairing contributes only in a subset of cases.
                              </p>
                              <p className="text-xs text-muted-foreground leading-relaxed">
                                <strong className="text-foreground">Key insight:</strong> Disease/oncogenic states (APC loss, MYC activation) 
                                reproducibly shift cell-cycle targets upward in |λ|, while clock genes often show dampening. 
                                This suggests a <em>condition-specific attractor</em> rather than universal healthy baseline. <EvidenceLink label="See root-space shifts" to="/root-space" hash="perturbation-shifts" variant="inline" /> <EvidenceLink label="Disease screen" to="/disease-screen" variant="inline" />
                              </p>
                            </div>
                            
                            {/* Methodology Note */}
                            <div className="flex items-start gap-2 text-xs text-muted-foreground">
                              <AlertCircle size={14} className="text-slate-500 mt-0.5 flex-shrink-0" />
                              <div>
                                <span className="text-slate-500">Methodology:</span> {trajectoryData.metadata.dataType}. 
                                Generated {new Date(trajectoryData.metadata.generatedAt).toLocaleString()}. 
                                Cross-study validation recommended before biomarker claims.
                              </div>
                            </div>
                            
                          </div>
                        ) : (
                          <div className="text-amber-300 text-sm p-4 bg-amber-500/10 rounded-lg border border-amber-500/30">
                            <AlertTriangle size={16} className="inline mr-2" />
                            No trajectory data available. Run PAR(2) analyses on circadian datasets to generate findings.
                          </div>
                        )}
                      </div>
                      
                      <div className="p-3 bg-slate-100 rounded-lg border border-slate-300 text-xs text-muted-foreground">
                        <strong className="text-slate-600">Note:</strong> Charts above are illustrative demos. 
                        The findings panel shows actual results from your PAR(2) analyses. 
                        Cross-study validation recommended—APC-knockout shows enrichment while wild-type does not.
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="highconfidence">
                <div className="space-y-6">
                  {isLoadingCrossTissue ? (
                    <div className="flex items-center justify-center h-[400px]">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                  ) : crossTissueData?.summary?.totalTissuesAnalyzed ? (
                    <>
                      <Card className="border-emerald-500/50 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                              <CheckCircle2 size={20} className="text-emerald-400" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold text-emerald-300">Cross-Tissue Consensus Approach</h3>
                                <Badge className="bg-emerald-500/20 text-emerald-300 text-[10px]">STRESS-TEST SUPPORTED</Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">
                                Cross-tissue null survey (1,000 permutations × 12 tissues, time-shuffle null) validates consensus approach. Note: tissues are from the same cohort (GSE54650) and share variance structure; block permutation tests quantify this dependence.
                              </p>
                              <div className="grid grid-cols-3 gap-2 mt-3">
                                <div className="bg-red-500/10 rounded p-2 border border-red-500/30 text-center">
                                  <div className="text-red-400 font-bold text-lg">16.2%</div>
                                  <div className="text-[10px] text-muted-foreground">Single-tissue FDR</div>
                                </div>
                                <div className="bg-emerald-500/10 rounded p-2 border border-emerald-500/30 text-center">
                                  <div className="text-emerald-400 font-bold text-lg">2.1%</div>
                                  <div className="text-[10px] text-muted-foreground">3+ Tissue FDR</div>
                                </div>
                                <div className="bg-cyan-500/10 rounded p-2 border border-cyan-500/30 text-center">
                                  <div className="text-cyan-400 font-bold text-lg">87%</div>
                                  <div className="text-[10px] text-muted-foreground">FDR Reduction</div>
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 mt-3">
                                <Badge variant="outline" className="bg-cyan-500/10 border-cyan-500/30">
                                  {crossTissueData.summary.totalTissuesAnalyzed} Tissues
                                </Badge>
                                <Badge variant="outline" className="bg-emerald-500/10 border-emerald-500/30">
                                  {crossTissueData.summary.highConfidenceCount} High Confidence
                                </Badge>
                                <Badge variant="outline" className="bg-purple-500/10 border-purple-500/30">
                                  {crossTissueData.summary.criticalNodeCount} Critical Nodes
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card className="border-border/50">
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <Activity size={18} className="text-cyan-400" />
                              Critical Network Nodes
                            </CardTitle>
                            <CardDescription>
                              Target genes regulated by 4+ clock genes (high connectivity)
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3 max-h-[350px] overflow-y-auto">
                              {crossTissueData.gatingCentrality.filter(g => g.isCriticalNode).map((node, i) => (
                                <div 
                                  key={node.targetGene}
                                  className="p-3 rounded-lg bg-secondary/30 border border-border/30"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="text-lg font-mono" style={{ color: TARGET_COLORS[node.targetGene] || '#22d3ee' }}>
                                        {node.targetGene}
                                      </span>
                                      <Badge variant="outline" className="bg-emerald-500/10 border-emerald-500/30 text-xs">
                                        {node.significantClockGenes}/{node.totalClockGenes} clocks
                                      </Badge>
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                      f²={node.meanEffectSize.toFixed(2)}
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {node.clockGeneList.map(clock => (
                                      <Badge 
                                        key={clock} 
                                        variant="outline" 
                                        className="text-[10px] px-1.5 py-0"
                                        style={{ borderColor: CLOCK_COLORS[clock] || '#60a5fa', color: CLOCK_COLORS[clock] || '#60a5fa' }}
                                      >
                                        {clock}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              ))}
                              {crossTissueData.gatingCentrality.filter(g => g.isCriticalNode).length === 0 && (
                                <div className="text-center text-muted-foreground py-8">
                                  No critical nodes found yet. Run more tissue analyses.
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="border-border/50">
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <CheckCircle2 size={18} className="text-emerald-400" />
                              High Confidence Pairs
                            </CardTitle>
                            <CardDescription>
                              Gene pairs significant in 3+ tissues with strong effects
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2 max-h-[350px] overflow-y-auto">
                              {crossTissueData.highConfidencePairs.slice(0, 15).map((pair, i) => (
                                <div 
                                  key={`${pair.targetGene}-${pair.clockGene}`}
                                  className={`p-2 rounded-lg border ${
                                    pair.confidenceTier === 'HIGH' 
                                      ? 'bg-emerald-500/10 border-emerald-500/30' 
                                      : 'bg-yellow-500/10 border-yellow-500/30'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span style={{ color: CLOCK_COLORS[pair.clockGene] || '#a855f7' }} className="font-mono text-sm">
                                        {pair.clockGene}
                                      </span>
                                      <ArrowRight size={12} className="text-muted-foreground" />
                                      <span style={{ color: TARGET_COLORS[pair.targetGene] || '#22d3ee' }} className="font-mono text-sm">
                                        {pair.targetGene}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Badge 
                                        variant="outline" 
                                        className={`text-[10px] ${
                                          pair.confidenceTier === 'HIGH' 
                                            ? 'bg-emerald-500/20 border-emerald-500/40' 
                                            : 'bg-yellow-500/20 border-yellow-500/40'
                                        }`}
                                      >
                                        {pair.confidenceTier}
                                      </Badge>
                                      <span className="text-xs text-muted-foreground">
                                        {pair.tissuesSignificant}/{pair.tissuesAnalyzed}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                              {crossTissueData.highConfidencePairs.length === 0 && (
                                <div className="text-center text-muted-foreground py-8">
                                  No high confidence pairs found yet.
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      <Card className="border-border/50">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <BarChart2 size={18} />
                            Confidence Tier Distribution
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="h-[200px]">
                            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                              <BarChart data={[
                                { tier: 'HIGH', count: crossTissueData.summary.tierBreakdown.HIGH, fill: '#10b981' },
                                { tier: 'MEDIUM', count: crossTissueData.summary.tierBreakdown.MEDIUM, fill: '#eab308' },
                                { tier: 'LOW', count: crossTissueData.summary.tierBreakdown.LOW, fill: '#f97316' },
                                { tier: 'EXPLORATORY', count: crossTissueData.summary.tierBreakdown.EXPLORATORY, fill: '#6b7280' },
                              ]}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                                <XAxis dataKey="tier" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                                <Tooltip 
                                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
                                  labelStyle={{ color: '#334155' }}
                                  itemStyle={{ color: '#475569' }}
                                  formatter={(value) => [`${value} pairs`, 'Count']}
                                />
                                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                  {[
                                    { tier: 'HIGH', fill: '#10b981' },
                                    { tier: 'MEDIUM', fill: '#eab308' },
                                    { tier: 'LOW', fill: '#f97316' },
                                    { tier: 'EXPLORATORY', fill: '#6b7280' },
                                  ].map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="mt-4 space-y-2">
                            <div className="grid grid-cols-4 gap-2 text-center">
                              <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/30">
                                <div className="text-emerald-400 font-semibold text-sm">HIGH</div>
                                <div className="text-[10px] text-muted-foreground">3+ tissues • 2.1% FDR</div>
                              </div>
                              <div className="p-2 rounded bg-yellow-500/10 border border-yellow-500/30">
                                <div className="text-yellow-400 font-semibold text-sm">MEDIUM</div>
                                <div className="text-[10px] text-muted-foreground">2+ tissues • ~12% FDR</div>
                              </div>
                              <div className="p-2 rounded bg-orange-500/10 border border-orange-500/30">
                                <div className="text-orange-400 font-semibold text-sm">LOW</div>
                                <div className="text-[10px] text-muted-foreground">1 tissue, f²≥0.15</div>
                              </div>
                              <div className="p-2 rounded bg-gray-500/10 border border-gray-500/30">
                                <div className="text-slate-500 font-semibold text-sm">EXPLORATORY</div>
                                <div className="text-[10px] text-muted-foreground">1 tissue • ~16% FDR</div>
                              </div>
                            </div>
                            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                              <div className="flex items-start gap-2">
                                <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                                <p className="text-xs text-muted-foreground">
                                  <strong className="text-emerald-300">Time-shuffle null test:</strong> Cross-tissue consensus reduces FDR by 87% (16.2% → 2.1%). 
                                  HIGH confidence pairs have strong empirical evidence for true biological effects.
                                </p>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-[400px] border border-dashed border-border/50 rounded-xl">
                      <FlaskConical className="text-muted-foreground mb-4" size={48} />
                      <p className="font-mono text-muted-foreground">No cross-tissue analysis data available</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Run analyses on GSE54650 tissue datasets to see consensus results
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="compare">
                <div className="space-y-6">
                  <Card className="border-border/50">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <GitCompare size={18} />
                        Cross-Condition Comparison
                      </CardTitle>
                      <CardDescription>
                        Select multiple analysis runs to compare results across conditions
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {(() => {
                        const mouseRuns = runs.filter(r => r.name.startsWith('Batch Analysis')).sort((a, b) => a.name.localeCompare(b.name));
                        const humanRuns = runs.filter(r => !r.name.startsWith('Batch Analysis') && !r.name.includes('Nurses')).sort((a, b) => a.name.localeCompare(b.name));
                        const RunCheckbox = ({ run }: { run: typeof runs[0] }) => (
                          <label
                            key={run.id}
                            className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors text-xs ${
                              comparisonRuns.includes(run.id)
                                ? 'bg-primary/10 border border-primary/30'
                                : 'bg-secondary/30 hover:bg-secondary/50 border border-transparent'
                            }`}
                          >
                            <Checkbox
                              checked={comparisonRuns.includes(run.id)}
                              onCheckedChange={() => toggleComparisonRun(run.id)}
                            />
                            <span className="truncate" title={run.name}>{run.name.replace('Batch Analysis - ', '')}</span>
                          </label>
                        );
                        return (
                          <div className="space-y-4 mb-6">
                            {mouseRuns.length > 0 && (
                              <div>
                                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">Mouse Tissues (GSE54650)</p>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                  {mouseRuns.map(run => <RunCheckbox key={run.id} run={run} />)}
                                </div>
                              </div>
                            )}
                            {humanRuns.length > 0 && (
                              <div>
                                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">Human Datasets</p>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                  {humanRuns.map(run => <RunCheckbox key={run.id} run={run} />)}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {comparisonRuns.length >= 2 && (
                        <div className="space-y-6">
                          <div className="h-[450px]">
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="text-sm font-medium">P-value Comparison (-log10 scale)</h4>
                              <ChartExportButton 
                                chartRef={comparisonChartRef} 
                                filename="pvalue_comparison"
                                data-testid="button-export-comparison-chart"
                              />
                            </div>
                            <div ref={comparisonChartRef} className="h-[400px]">
                            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                              <BarChart 
                                data={getComparisonChartData()} 
                                layout="vertical"
                                margin={{ left: 100, right: 20 }}
                              >
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                                <YAxis dataKey="pair" type="category" stroke="hsl(var(--muted-foreground))" fontSize={10} width={100} />
                                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }} labelStyle={{ color: '#334155' }} itemStyle={{ color: '#475569' }} />
                                <Legend />
                                {Array.from(new Set(allHypotheses.map(h => 
                                  h.datasetName.replace('GSE157357_', '').replace(/\.[^/.]+$/, '').slice(0, 20)
                                ))).slice(0, 5).map((dataset, i) => {
                                  const brightColors = ['#22d3ee', '#a78bfa', '#4ade80', '#fb923c', '#f472b6'];
                                  return (
                                    <Bar 
                                      key={dataset} 
                                      dataKey={dataset} 
                                      fill={brightColors[i % 5]}
                                      name={dataset}
                                    />
                                  );
                                })}
                                {/* Significance threshold line */}
                              </BarChart>
                            </ResponsiveContainer>
                            </div>
                          </div>

                          <div className="border-t pt-4">
                            <h4 className="text-sm font-medium mb-4">Significance Summary Table</h4>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b">
                                    <th className="text-left p-2 font-medium">Gene Pair</th>
                                    {Array.from(new Set(allHypotheses.map(h => 
                                      h.datasetName.replace('GSE157357_', '').replace(/\.[^/.]+$/, '').slice(0, 15)
                                    ))).slice(0, 5).map(dataset => (
                                      <th key={dataset} className="text-center p-2 font-medium text-xs">{dataset}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {Array.from(new Set(allHypotheses.map(h => `${h.clockGene}→${h.targetGene}`))).map(pair => (
                                    <tr key={pair} className="border-b border-border/30">
                                      <td className="p-2 font-mono text-xs">{pair}</td>
                                      {Array.from(new Set(allHypotheses.map(h => 
                                        h.datasetName.replace('GSE157357_', '').replace(/\.[^/.]+$/, '').slice(0, 15)
                                      ))).slice(0, 5).map(dataset => {
                                        const match = allHypotheses.find(h => 
                                          `${h.clockGene}→${h.targetGene}` === pair && 
                                          h.datasetName.includes(dataset.replace('...', ''))
                                        );
                                        return (
                                          <td key={dataset} className="text-center p-2">
                                            {match ? (
                                              match.significant ? (
                                                <Badge className="bg-green-500/20 text-green-400 text-[10px]">
                                                  {match.pValue.toFixed(3)}
                                                </Badge>
                                              ) : (
                                                <span className="text-muted-foreground text-xs">{match.pValue.toFixed(2)}</span>
                                              )
                                            ) : (
                                              <span className="text-muted-foreground/50">-</span>
                                            )}
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      )}

                      {comparisonRuns.length < 2 && (
                        <div className="flex flex-col items-center justify-center h-[300px] border border-dashed border-border/50 rounded-xl">
                          <BarChart3 className="text-muted-foreground mb-4" size={48} />
                          <p className="text-muted-foreground text-center">
                            Select at least 2 analysis runs above to compare results
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="advanced" className="space-y-4">
                <div className="text-center p-4 border-b border-border/50 mb-4">
                  <h3 className="text-lg font-semibold text-orange-400">Advanced Analyses</h3>
                  <p className="text-sm text-muted-foreground">Exploratory analyses and hypothesis-generating features</p>
                </div>
                
                {/* Phase Vulnerability / Golden Hour Panel */}
                {phaseVulnerabilityData ? (
                  <Card data-testid="card-phase-vulnerability" className="border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-orange-500/5">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Clock size={18} className="text-amber-400" />
                          <span data-testid="text-golden-hour-title" className="font-semibold text-amber-400">Golden Hour Intervention Window</span>
                          <Badge data-testid="badge-hypothesis" className="bg-amber-500/20 text-amber-300 text-[10px]">
                            HYPOTHESIS
                          </Badge>
                        </div>
                        <span data-testid="text-sirt1-window" className="text-xs text-muted-foreground">
                          SIRT1 trough: {phaseVulnerabilityData.summary.sirt1TroughWindow}
                        </span>
                      </div>
                      <div className="mb-3 p-2 rounded bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 leading-relaxed">
                        These timing predictions are derived from gene expression phase data (GSE54650, mouse liver) and have not been validated pharmacologically or in clinical settings. Drug timing decisions require independent clinical trial evidence.
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
                          <div data-testid="metric-golden-hour-window" className="text-xl font-bold text-amber-400">
                            CT{phaseVulnerabilityData.goldenHour.phase}-{phaseVulnerabilityData.goldenHour.phase + phaseVulnerabilityData.goldenHour.duration}
                          </div>
                          <div className="text-xs text-muted-foreground">Intervention Window</div>
                        </div>
                        <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 text-center">
                          <div data-testid="metric-sirt1-nadir" className="text-xl font-bold text-orange-400">
                            {(phaseVulnerabilityData.goldenHour.sirt1Nadir * 100).toFixed(1)}%
                          </div>
                          <div className="text-xs text-muted-foreground">SIRT1 Level (of mean)</div>
                        </div>
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-center">
                          <div data-testid="metric-vulnerable-genes" className="text-xl font-bold text-red-400">
                            {phaseVulnerabilityData.goldenHour.peakingTargets.length > 0 
                              ? phaseVulnerabilityData.goldenHour.peakingTargets.join(', ')
                              : 'None'}
                          </div>
                          <div className="text-xs text-muted-foreground">Peaking Targets</div>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground bg-muted/30 rounded p-2">
                        <strong>Interpretation:</strong> {phaseVulnerabilityData.goldenHour.interpretation}
                      </div>
                      
                      {/* Vulnerability Ranking */}
                      <div className="mt-4">
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">Top Vulnerable Genes (by SIRT1 phase alignment)</h4>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                          {phaseVulnerabilityData.vulnerabilityRanking.slice(0, 5).map((gene, idx) => (
                            <div key={idx} className="text-center p-2 rounded bg-orange-500/10 border border-orange-500/20">
                              <div className="text-sm font-semibold text-orange-300">{gene.gene}</div>
                              <div className="text-[10px] text-muted-foreground">Peak CT{gene.peakPhase.toFixed(0)}</div>
                              <div className="text-[10px] text-muted-foreground">{gene.sirt1PhaseAtPeak}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Lgr5 / GSE179028 cross-reference */}
                      {phaseVulnerabilityData.vulnerabilityRanking.some(g => g.gene === 'Lgr5') && (
                        <div className="mt-3 p-2 rounded bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 flex items-start gap-2">
                          <span className="mt-0.5 shrink-0">📌</span>
                          <span>
                            <strong>Lgr5 cross-species validation available.</strong> Mouse intestinal enteroid data (GSE179027, 12,409 genes, 24 timepoints) and human enteroid data (GSE161566) independently replicate Lgr5 phase gating.{' '}
                            <a href="/dashboard" className="underline text-blue-400 hover:text-blue-300" onClick={() => window.location.href='/dashboard'}>Load GSE179027</a> via the dataset selector to replicate this result in a non-liver tissue.
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border-muted">
                    <CardContent className="p-8 text-center">
                      <Loader2 className="animate-spin mx-auto mb-2 text-muted-foreground" size={24} />
                      <p className="text-sm text-muted-foreground">Loading Phase Vulnerability analysis...</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
        
      </main>

      {/* Detail Dialog for Significant Findings */}
      <Dialog open={!!selectedResult} onOpenChange={(open) => !open && setSelectedResult(null)}>
        <DialogContent className="max-w-2xl bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <CheckCircle2 className="text-primary" size={24} />
              <span>Circadian Gating Discovery</span>
            </DialogTitle>
            <DialogDescription>
              Significant phase-dependent regulation detected
            </DialogDescription>
          </DialogHeader>
          
          {selectedResult && (
            <div className="space-y-6 mt-4">
              {/* Gene Pair */}
              <div className="flex items-center justify-center gap-4 p-4 bg-secondary/30 rounded-lg">
                <div className="text-center">
                  <span 
                    className="inline-block w-4 h-4 rounded-full mb-2" 
                    style={{ backgroundColor: CLOCK_COLORS[selectedResult.clockGene] || '#22d3ee' }}
                  />
                  <Badge variant="outline" className="font-mono text-lg px-4 py-2" style={{ color: CLOCK_COLORS[selectedResult.clockGene], borderColor: CLOCK_COLORS[selectedResult.clockGene] }}>
                    {selectedResult.clockGene}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">{selectedResult.clockRole}</p>
                </div>
                <ArrowRight className="text-primary" size={32} />
                <div className="text-center">
                  <span 
                    className="inline-block w-4 h-4 rounded-full mb-2" 
                    style={{ backgroundColor: TARGET_COLORS[selectedResult.targetGene] || '#f472b6' }}
                  />
                  <Badge variant="outline" className="font-mono text-lg px-4 py-2" style={{ color: TARGET_COLORS[selectedResult.targetGene], borderColor: TARGET_COLORS[selectedResult.targetGene] }}>
                    {selectedResult.targetGene}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">{selectedResult.targetRole}</p>
                </div>
              </div>

              {/* Statistics */}
              <div className="grid grid-cols-2 gap-4">
                <Card className="border-border/50">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">P-Value</p>
                    <p className="text-2xl font-mono font-bold text-primary mt-1">
                      {selectedResult.pValue?.toFixed(6) || 'N/A'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedResult.pValue < 0.01 ? 'Highly significant' : 'Significant'} (α = 0.05)
                    </p>
                  </CardContent>
                </Card>
                <Card className={`border-border/50 ${
                  selectedResult.effectSizeInterpretation === 'large' ? 'border-emerald-500/30 bg-emerald-500/5' :
                  selectedResult.effectSizeInterpretation === 'medium' ? 'border-amber-500/30 bg-amber-500/5' :
                  ''
                }`}>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Effect Size (Cohen's f²)</p>
                    <p className={`text-2xl font-mono font-bold mt-1 ${
                      selectedResult.effectSizeInterpretation === 'large' ? 'text-emerald-400' :
                      selectedResult.effectSizeInterpretation === 'medium' ? 'text-amber-400' :
                      'text-primary'
                    }`}>
                      {selectedResult.effectSizeCohensF2?.toFixed(4) || 'N/A'}
                    </p>
                    <p className="text-xs mt-1">
                      <Badge 
                        variant="outline" 
                        className={`${
                          selectedResult.effectSizeInterpretation === 'large' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-400/30' :
                          selectedResult.effectSizeInterpretation === 'medium' ? 'bg-amber-500/20 text-amber-400 border-amber-400/30' :
                          selectedResult.effectSizeInterpretation === 'small' ? 'bg-blue-500/20 text-blue-400 border-blue-400/30' :
                          'bg-muted text-muted-foreground'
                        }`}
                      >
                        {selectedResult.effectSizeInterpretation || 'Not calculated'}
                      </Badge>
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Data Quality Indicators */}
              {(selectedResult.dataQuality || selectedResult.clockRhythmicity || selectedResult.nTimepoints) && (
                <Card className={`${
                  selectedResult.dataQuality?.dataQualityScore === 'poor' ? 'border-red-500/50 bg-red-500/5' :
                  selectedResult.dataQuality?.dataQualityScore === 'acceptable' ? 'border-amber-500/50 bg-amber-500/5' :
                  selectedResult.dataQuality?.dataQualityScore === 'good' ? 'border-emerald-500/50 bg-emerald-500/5' :
                  'border-border/50 bg-secondary/20'
                }`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs uppercase tracking-wider font-semibold flex items-center gap-2">
                        {selectedResult.dataQuality?.dataQualityScore === 'poor' ? (
                          <><AlertTriangle size={14} className="text-red-400" /> Data Quality: Poor</>
                        ) : selectedResult.dataQuality?.dataQualityScore === 'acceptable' ? (
                          <><AlertTriangle size={14} className="text-amber-400" /> Data Quality: Acceptable</>
                        ) : selectedResult.dataQuality?.dataQualityScore === 'good' ? (
                          <><CheckCircle2 size={14} className="text-emerald-400" /> Data Quality: Good</>
                        ) : (
                          <><Activity size={14} className="text-muted-foreground" /> Data Quality: Unknown</>
                        )}
                      </p>
                      {selectedResult.nTimepoints && (
                        <Badge variant="outline" className="font-mono text-xs">
                          {selectedResult.nTimepoints} timepoints
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      {/* Clock Rhythmicity */}
                      <div className="p-2 bg-secondary/30 rounded">
                        <p className="font-semibold mb-1">Clock Gene Rhythmicity</p>
                        {selectedResult.clockRhythmicity && typeof selectedResult.clockRhythmicity.isRhythmic === 'boolean' ? (
                          <>
                            <div className="flex items-center gap-2 mb-1">
                              {selectedResult.clockRhythmicity.isRhythmic ? (
                                <><CheckCircle2 size={12} className="text-emerald-400" /> <span className="text-emerald-400">Rhythmic</span></>
                              ) : (
                                <><XCircle size={12} className="text-red-400" /> <span className="text-red-400">Not Rhythmic</span></>
                              )}
                              <span className="text-muted-foreground">
                                (p = {selectedResult.clockRhythmicity.pValue?.toFixed(4) ?? 'N/A'})
                              </span>
                            </div>
                            <p className="text-muted-foreground">
                              Amplitude: {selectedResult.clockRhythmicity.relativeAmplitude?.toFixed(1) ?? 'N/A'}% | 
                              Peak: CT{selectedResult.clockRhythmicity.peakTime?.toFixed(1) ?? 'N/A'}
                            </p>
                          </>
                        ) : (
                          <span className="text-muted-foreground">Not available (legacy result)</span>
                        )}
                      </div>
                      {/* Sample Size */}
                      <div className="p-2 bg-secondary/30 rounded">
                        <p className="font-semibold mb-1">Sample Size Assessment</p>
                        {selectedResult.dataQuality?.sampleSizeWarning ? (
                          <p className="text-amber-400">{selectedResult.dataQuality.sampleSizeWarning}</p>
                        ) : (
                          <p className="text-emerald-400">Adequate sample size for analysis</p>
                        )}
                      </div>
                    </div>
                    {/* Warnings */}
                    {(selectedResult.dataQuality?.clockRhythmicityWarning || selectedResult.dataQuality?.sampleSizeWarning) && (
                      <div className="mt-3 p-2 bg-amber-500/10 border border-amber-500/30 rounded text-xs text-amber-400">
                        <strong>Warning:</strong> {selectedResult.dataQuality?.clockRhythmicityWarning || selectedResult.dataQuality?.sampleSizeWarning}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Method Comparison: PAR(2) vs Cosinor */}
              <MethodComparisonCard 
                runId={selectedRunId || latestRun?.id} 
                hypothesisId={selectedResult?.id}
                clockGene={selectedResult?.clockGene}
                targetGene={selectedResult?.targetGene}
              />

              {/* Effect Size Details */}
              <div className="grid grid-cols-2 gap-4">
                <Card className="border-border/50">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">R² Change</p>
                    <p className="text-xl font-mono font-bold mt-1">
                      {selectedResult.rSquaredChange != null ? (selectedResult.rSquaredChange * 100).toFixed(2) + '%' : 'N/A'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Variance explained by phase interactions
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-border/50">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Significant Terms</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {selectedResult.significantTerms?.length > 0 ? (
                        selectedResult.significantTerms.map(term => (
                          <Badge key={term} variant="secondary" className="font-mono text-xs">
                            {term}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground">N/A</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Confidence Intervals */}
              {selectedResult.confidenceIntervals && selectedResult.confidenceIntervals.length > 0 && (
                <Card className="border-border/50">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">95% Confidence Intervals</p>
                    <div className="space-y-2">
                      {selectedResult.confidenceIntervals.map((ci: ConfidenceInterval) => (
                        <div key={ci.term} className="flex items-center justify-between p-2 bg-secondary/30 rounded">
                          <span className="font-mono text-sm">{ci.term}</span>
                          <div className="text-right">
                            <span className="font-mono text-sm text-primary">{ci.coefficient.toFixed(4)}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              [{ci.lower.toFixed(4)}, {ci.upper.toFixed(4)}]
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Interpretation */}
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-4">
                  <p className="text-xs text-primary uppercase tracking-wider mb-2">Biological Interpretation</p>
                  <p className="text-foreground">
                    {selectedResult.description || `The expression of ${selectedResult.targetGene} shows phase-dependent dynamics with ${selectedResult.clockGene}. This temporal association is compatible with circadian regulation but should be validated with independent methods.`}
                  </p>
                </CardContent>
              </Card>

              {/* PAR(2) Model Details */}
              <div className="text-xs text-muted-foreground space-y-2 p-4 bg-secondary/20 rounded-lg">
                <p className="font-semibold text-foreground">PAR(2) Model Details:</p>
                <p>R(n) = β₀ + β₁R(n-1) + β₂R(n-1)cos(φ) + β₃R(n-1)sin(φ) + β₄R(n-2) + β₅R(n-2)cos(φ) + β₆R(n-2)sin(φ)</p>
                <p className="mt-2">
                  The phase interaction terms (cos(φ) and sin(φ)) test whether the clock gene phase significantly influences target gene dynamics. Significant terms indicate circadian gating.
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Help Dialog */}
      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle size={20} className="text-primary" />
              PAR(2) Discovery Engine - Complete Guide
            </DialogTitle>
            <DialogDescription>
              Circadian clock-target dynamics analysis for cancer biology research
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[75vh] pr-4">
            <div className="space-y-6">
              
              {/* CROSS-TISSUE CONSENSUS BANNER */}
              <Card className="border-emerald-500/50 bg-gradient-to-r from-emerald-500/10 to-green-500/5">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 size={18} className="text-emerald-400" />
                    <span className="font-semibold text-emerald-400 text-lg">Cross-Tissue Consensus Approach</span>
                    <Badge className="bg-emerald-500/20 text-emerald-300 text-[10px]">STRESS-TEST SUPPORTED</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    We ran 1,000 permutations × 3 null models × 12 tissues to validate the statistical methodology. Tissues share a common cohort (GSE54650); block permutation controls for shared variance.
                  </p>
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div className="p-2 bg-red-500/10 rounded border border-red-500/30 text-center">
                      <div className="text-red-400 font-bold">16.2%</div>
                      <div className="text-[10px] text-muted-foreground">Single-tissue FDR</div>
                    </div>
                    <div className="p-2 bg-yellow-500/10 rounded border border-yellow-500/30 text-center">
                      <div className="text-yellow-400 font-bold">87%</div>
                      <div className="text-[10px] text-muted-foreground">Reduction</div>
                    </div>
                    <div className="p-2 bg-emerald-500/10 rounded border border-emerald-500/30 text-center">
                      <div className="text-emerald-400 font-bold">2.1%</div>
                      <div className="text-[10px] text-muted-foreground">3+ tissue FDR</div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p><strong className="text-emerald-400">HIGH confidence</strong> (3+ tissues): ~2% false positive rate - strong evidence</p>
                    <p><strong className="text-yellow-400">MEDIUM confidence</strong> (2 tissues): ~12% false positive rate - moderate evidence</p>
                    <p><strong className="text-slate-500">EXPLORATORY</strong> (1 tissue): ~16% false positive rate - hypothesis-generating</p>
                  </div>
                </CardContent>
              </Card>

              {/* What is this app? */}
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Dna size={18} className="text-primary" />
                    <span className="font-semibold text-primary text-lg">What Does This App Do?</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    This tool characterizes temporal dynamics between <strong>circadian clock genes</strong> (like Per2, Arntl/BMAL1, Clock) and 
                    <strong>cancer-related genes</strong> (like Myc, Ccnd1, Tp53) using AR(2) eigenvalue profiling.
                  </p>
                  <p className="text-sm text-muted-foreground mb-3">
                    <strong>Why it matters:</strong> Circadian disruption (shift work, jet lag) is linked to increased cancer risk. 
                    Understanding which cancer genes are under circadian control could lead to better treatment timing (chronotherapy).
                  </p>
                  <p className="text-sm text-primary">
                    The PAR(2) model statistically tests: "Does the phase of the clock gene influence when the target gene is expressed?"
                  </p>
                </CardContent>
              </Card>

              {/* Available Datasets */}
              <Card className="border-green-500/30 bg-green-500/5">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 size={18} className="text-green-400" />
                    <span className="font-semibold text-green-400 text-lg">21 Pre-loaded Datasets (No Download Needed!)</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="font-semibold text-foreground mb-2">Hughes Circadian Atlas (GSE54650) - 12 Mouse Tissues:</p>
                      <ul className="text-xs text-muted-foreground list-disc ml-4 space-y-1">
                        <li>Liver, Heart, Kidney, Lung, Muscle</li>
                        <li>White Fat, Brown Fat, Adrenal, Aorta</li>
                        <li>Brainstem, Cerebellum, Hypothalamus</li>
                        <li>~21,000 genes × 24 timepoints each</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground mb-2">Intestinal Organoids (GSE157357) - 4 Conditions:</p>
                      <ul className="text-xs text-muted-foreground list-disc ml-4 space-y-1">
                        <li>WT-WT (Wild-type control)</li>
                        <li>WT-BmalKO (BMAL1 knockout)</li>
                        <li>ApcKO-WT (Cancer model)</li>
                        <li>ApcKO-BmalKO (Cancer + clock disruption)</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground mb-2">Human Neuroblastoma (GSE221103) - 2 Conditions:</p>
                      <ul className="text-xs text-muted-foreground list-disc ml-4 space-y-1">
                        <li>MYC-ON (N-MYC oncogene active)</li>
                        <li>MYC-OFF (N-MYC inactive control)</li>
                        <li>~60,000 genes × 14 timepoints</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground mb-2">Other Models:</p>
                      <ul className="text-xs text-muted-foreground list-disc ml-4 space-y-1">
                        <li>Mouse Kidney DCT/CCD segments (GSE17739)</li>
                        <li>Mouse Lung Basal (GSE59396)</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Quick vs Full Analysis */}
              <Card className="border-yellow-500/30 bg-yellow-500/5">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Activity size={18} className="text-yellow-400" />
                    <span className="font-semibold text-yellow-400 text-lg">Quick (9 pairs) vs Full (299 pairs) Analysis</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="p-3 bg-secondary/30 rounded-lg">
                      <p className="font-semibold text-foreground mb-2">Quick Analysis (Default):</p>
                      <ul className="text-xs text-muted-foreground list-disc ml-4 space-y-1">
                        <li>Tests 9 gene pairs (3 targets × 3 clocks)</li>
                        <li>Targets: Myc, Ccnd1, Lgr5</li>
                        <li>Clocks: Per2, Arntl, Clock</li>
                        <li>Fast (~5 seconds)</li>
                        <li>Good for initial exploration</li>
                      </ul>
                    </div>
                    <div className="p-3 bg-primary/10 rounded-lg border border-primary/30">
                      <p className="font-semibold text-primary mb-2">Full Analysis (Recommended):</p>
                      <ul className="text-xs text-muted-foreground list-disc ml-4 space-y-1">
                        <li>Tests 299 gene pairs (23 targets × 13 clocks)</li>
                        <li>Includes: Cell cycle, Wnt, DNA damage, apoptosis, metabolism, proliferation genes</li>
                        <li>All 13 core clock genes</li>
                        <li>Takes ~30-60 seconds</li>
                        <li><strong>Much more likely to find significant results!</strong></li>
                      </ul>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    <strong>Tip:</strong> Toggle "Use all 299 pairs" in Settings, or click "Run Full Analysis" button on embedded datasets.
                  </p>
                </CardContent>
              </Card>

              {/* Step-by-step Instructions */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <ChevronRight size={18} className="text-primary" />
                  Step-by-Step Instructions
                </h3>

                {/* Step 1 */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm">1</div>
                    <h4 className="font-semibold">Load a Dataset</h4>
                  </div>
                  <div className="ml-9 text-sm text-muted-foreground">
                    <p>Click any tissue button in "Pre-loaded Circadian Datasets" section, OR upload your own CSV file.</p>
                    <p className="text-xs mt-1">CSV format: First column = gene names, subsequent columns = expression values at each timepoint.</p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm">2</div>
                    <h4 className="font-semibold">Choose Analysis Scope</h4>
                  </div>
                  <div className="ml-9 text-sm text-muted-foreground">
                    <p><strong>Quick:</strong> Click "Run Analysis" for 9 default pairs</p>
                    <p><strong>Full:</strong> Click "Run Full Analysis" for all 152 pairs (recommended for discovery)</p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm">3</div>
                    <h4 className="font-semibold">Interpret Results</h4>
                  </div>
                  <div className="ml-9 text-sm text-muted-foreground">
                    <p><strong>Green cards:</strong> Significant circadian gating (p {"<"} 0.05 after Bonferroni correction)</p>
                    <p><strong>Gray cards:</strong> No significant gating detected</p>
                    <p>Click any result card to see detailed phase plots and model information.</p>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm">4</div>
                    <h4 className="font-semibold">Compare Across Conditions</h4>
                  </div>
                  <div className="ml-9 text-sm text-muted-foreground">
                    <p>Use the "Compare" tab to see how gating changes between tissues or conditions.</p>
                    <p className="text-xs mt-1">Example: Compare MYC-ON vs MYC-OFF to see how oncogene activation changes circadian control.</p>
                  </div>
                </div>

                {/* Step 5 */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm">5</div>
                    <h4 className="font-semibold">Export for Publication</h4>
                  </div>
                  <div className="ml-9 text-sm text-muted-foreground">
                    <ul className="list-disc ml-4 space-y-1">
                      <li><strong>CSV:</strong> Raw data for your own analysis</li>
                      <li><strong>Report:</strong> Summary of significant findings</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Understanding the Statistics */}
              <Card className="border-purple-500/30 bg-purple-500/5">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp size={18} className="text-purple-400" />
                    <span className="font-semibold text-purple-400 text-lg">Understanding the PAR(2) Model</span>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-3">
                    <p>The PAR(2) (Phase-Amplitude-Relationship, order 2) model tests whether a clock gene's circadian phase influences a target gene's expression:</p>
                    <div className="p-2 bg-secondary/30 rounded font-mono text-xs overflow-x-auto">
                      R(n) = β₀ + β₁R(n-1) + β₂R(n-1)cos(φ) + β₃R(n-1)sin(φ) + β₄R(n-2) + β₅R(n-2)cos(φ) + β₆R(n-2)sin(φ)
                    </div>
                    <ul className="list-disc ml-4 space-y-1 text-xs">
                      <li><strong>R(n):</strong> Target gene expression at timepoint n</li>
                      <li><strong>R(n-1), R(n-2):</strong> Lagged expression (memory effects)</li>
                      <li><strong>cos(φ), sin(φ):</strong> Clock gene phase at each timepoint</li>
                      <li><strong>Phase interaction terms:</strong> R_n_1_cos, R_n_1_sin, R_n_2_cos, R_n_2_sin</li>
                    </ul>
                    <p className="text-xs">
                      <strong>Significance:</strong> If any phase interaction term is significant (F-test, Bonferroni corrected p {"<"} 0.05), 
                      the clock gene "gates" the target gene - meaning timing matters for regulation.
                    </p>
                    
                    {/* Methodology Limitations */}
                    <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                      <p className="font-semibold text-amber-400 text-xs mb-2">⚠️ Methodology Notes</p>
                      <ul className="text-xs space-y-1">
                        <li><strong>Status:</strong> Exploratory regression approach (not peer-reviewed as a standalone method)</li>
                        <li><strong>Comparison:</strong> Unlike JTK_CYCLE/MetaCycle, PAR(2) tests phase-dependent modulation, not rhythmicity</li>
                        <li><strong>Multiple testing:</strong> Within-pair Bonferroni (×4) + across-pair FDR correction applied</li>
                        <li><strong>Best practice:</strong> Use JTK_CYCLE first to confirm clock gene rhythmicity, then interpret PAR(2)</li>
                      </ul>
                    </div>
                    
                    {/* TVAR Consideration Note */}
                    <div className="mt-3 p-3 bg-slate-500/10 border border-slate-300/30 rounded-lg">
                      <p className="font-semibold text-slate-600 text-xs mb-2">📊 Why Stationary AR(2) vs Time-Varying AR (TVAR)?</p>
                      <ul className="text-xs space-y-1 text-slate-500">
                        <li><strong>Data length constraint:</strong> Most datasets have 12-24 timepoints; TVAR requires many more for reliable time-varying coefficient estimation</li>
                        <li><strong>Cross-dataset comparability:</strong> Stationary AR(2) produces simple, comparable summaries (λ, ρ bands) across species and conditions; TVAR produces functions of time</li>
                        <li><strong>Overfitting risk:</strong> Short, noisy omics series can cause TVAR to fit technical drift as "dynamic coefficients"</li>
                        <li><strong>Current validation:</strong> Stationary AR(2) + decomposition already passes strong falsifiers with stable λ/ρ distributions</li>
                        <li><strong>TVAR use case:</strong> May be worth exploring on longest series (48+ points) for pre-specified gene sets, but as exploratory analysis only</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Gene Categories */}
              <Card className="border-cyan-500/30 bg-cyan-500/5">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Dna size={18} className="text-cyan-400" />
                    <span className="font-semibold text-cyan-400 text-lg">Genes Tested (299 Pairs)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                    <div>
                      <p className="font-semibold text-foreground mb-2">23 Target Genes:</p>
                      <ul className="list-disc ml-4 space-y-1">
                        <li><strong>Cell Cycle:</strong> Myc, Ccnd1, Ccnb1, Cdk1, Wee1, Cdkn1a</li>
                        <li><strong>Wnt/Stem:</strong> Lgr5, Axin2, Ctnnb1, Apc</li>
                        <li><strong>DNA Damage:</strong> Tp53, Mdm2, Atm, Chek2</li>
                        <li><strong>Apoptosis:</strong> Bcl2, Bax</li>
                        <li><strong>Metabolism:</strong> Pparg, Sirt1, Hif1a</li>
                        <li><strong>Proliferation:</strong> Ccne1, Ccne2, Mcm6, Mki67</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground mb-2">13 Clock Genes:</p>
                      <ul className="list-disc ml-4 space-y-1">
                        <li><strong>Positive arm:</strong> Arntl (BMAL1), Clock, Npas2</li>
                        <li><strong>Negative arm:</strong> Per1, Per2, Per3, Cry1, Cry2</li>
                        <li><strong>Auxiliary:</strong> Nr1d1 (REV-ERBα), Nr1d2</li>
                        <li><strong>Output:</strong> Dbp, Tef, Rorc</li>
                      </ul>
                      <p className="mt-3 font-semibold text-foreground">Why 13 clocks?</p>
                      <p>Different clock genes peak at different times, so they may gate different target genes.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Multi-Omics */}
              <Card className="border-orange-500/30 bg-orange-500/5">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <GitCompare size={18} className="text-orange-400" />
                    <span className="font-semibold text-orange-400 text-lg">Multi-Omics Validation (Advanced)</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    The "Multi-Omics" tab allows you to upload <strong>proteomics data</strong> and compare with mRNA results:
                  </p>
                  <ul className="text-xs text-muted-foreground list-disc ml-4 space-y-1">
                    <li><strong>Concordance analysis:</strong> Do findings hold at the protein level?</li>
                    <li><strong>Both significant:</strong> Strong evidence for circadian gating</li>
                    <li><strong>mRNA only:</strong> Post-transcriptional regulation may buffer clock effects</li>
                    <li><strong>Protein only:</strong> Possible translational regulation</li>
                  </ul>
                </CardContent>
              </Card>

              {/* Troubleshooting */}
              <Card className="border-red-500/30 bg-red-500/5">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle size={18} className="text-red-400" />
                    <span className="font-semibold text-red-400 text-lg">Troubleshooting</span>
                  </div>
                  <ul className="text-sm text-muted-foreground space-y-2">
                    <li><strong>No significant results?</strong> Try the full 152-pair analysis - the default 9 pairs may not include the right genes for your tissue.</li>
                    <li><strong>Analysis seems slow?</strong> Large datasets (60K+ genes like neuroblastoma) take longer to process.</li>
                    <li><strong>Gene not found?</strong> Check gene naming: mouse uses sentence case (Myc), human uses uppercase (MYC).</li>
                    <li><strong>Few timepoints?</strong> Datasets with only 6 timepoints have less statistical power than 24-timepoint datasets.</li>
                  </ul>
                </CardContent>
              </Card>

              {/* External Verification Tools */}
              <Card className="border-emerald-500/30 bg-emerald-500/5">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 size={18} className="text-emerald-400" />
                    <span className="font-semibold text-emerald-400 text-lg">External Verification Tools</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Use these independent tools to cross-validate PAR(2) findings:
                  </p>
                  
                  <div className="space-y-4">
                    {/* JTK_CYCLE */}
                    <div className="p-3 bg-secondary/30 rounded-lg">
                      <p className="font-semibold text-foreground text-sm mb-1">1. JTK_CYCLE (R package)</p>
                      <p className="text-xs text-muted-foreground mb-2">
                        <strong>What it tests:</strong> Is this gene rhythmic at all? Does it cycle with ~24h period?
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <strong>Benefits:</strong> Gold-standard algorithm, non-parametric, provides period/phase/amplitude. 
                        Use to confirm clock genes are rhythmic before interpreting PAR(2) results.
                      </p>
                      <p className="text-xs text-emerald-400 mt-1">
                        Link: <a href="https://openwetware.org/wiki/HughesLab:JTK_Cycle" target="_blank" rel="noopener" className="underline">openwetware.org/wiki/HughesLab:JTK_Cycle</a>
                      </p>
                    </div>
                    
                    {/* MetaCycle */}
                    <div className="p-3 bg-secondary/30 rounded-lg">
                      <p className="font-semibold text-foreground text-sm mb-1">2. MetaCycle (R package)</p>
                      <p className="text-xs text-muted-foreground mb-2">
                        <strong>What it tests:</strong> Combines JTK_CYCLE + Lomb-Scargle + ARSER for consensus rhythmicity detection.
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <strong>Benefits:</strong> If all 3 methods agree = high confidence. Reduces false positives from any single algorithm.
                      </p>
                      <p className="text-xs text-emerald-400 mt-1">
                        Link: <a href="https://cran.r-project.org/package=MetaCycle" target="_blank" rel="noopener" className="underline">CRAN MetaCycle</a>
                      </p>
                    </div>
                    
                    {/* CircaCompare */}
                    <div className="p-3 bg-secondary/30 rounded-lg">
                      <p className="font-semibold text-foreground text-sm mb-1">3. CircaCompare (R package)</p>
                      <p className="text-xs text-muted-foreground mb-2">
                        <strong>What it tests:</strong> Are rhythm parameters (amplitude, phase, baseline) different between two conditions?
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <strong>Benefits:</strong> After PAR(2) finds gating in one condition, test if gating is LOST in disease state.
                        Perfect for MYC-ON vs MYC-OFF, WT vs ApcKO comparisons.
                      </p>
                      <p className="text-xs text-emerald-400 mt-1">
                        Link: <a href="https://cran.r-project.org/package=circacompare" target="_blank" rel="noopener" className="underline">CRAN circacompare</a>
                      </p>
                    </div>
                    
                    {/* RAIN */}
                    <div className="p-3 bg-secondary/30 rounded-lg">
                      <p className="font-semibold text-foreground text-sm mb-1">4. RAIN (R/Bioconductor)</p>
                      <p className="text-xs text-muted-foreground mb-2">
                        <strong>What it tests:</strong> Rhythmicity for complex, non-sinusoidal waveforms (asymmetric, bimodal).
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <strong>Benefits:</strong> No waveform assumption. Good for metabolism genes that rise fast/fall slow.
                      </p>
                      <p className="text-xs text-emerald-400 mt-1">
                        Link: <a href="https://bioconductor.org/packages/rain/" target="_blank" rel="noopener" className="underline">Bioconductor RAIN</a>
                      </p>
                    </div>
                    
                    {/* Databases */}
                    <div className="p-3 bg-primary/10 rounded-lg border border-primary/30">
                      <p className="font-semibold text-foreground text-sm mb-1">5. Reference Databases</p>
                      <p className="text-xs text-muted-foreground mb-2">
                        Cross-reference findings against published circadian data:
                      </p>
                      <ul className="text-xs text-muted-foreground list-disc ml-4 space-y-1">
                        <li><strong>CircaDB:</strong> Mammalian circadian expression database - <a href="http://circadb.hogeneschlab.org/" target="_blank" rel="noopener" className="text-primary underline">circadb.hogeneschlab.org</a></li>
                        <li><strong>CircaKB (2025):</strong> 226 transcriptome datasets, 12 models - <a href="https://academic.oup.com/nar/article/53/D1/D67/7779352" target="_blank" rel="noopener" className="text-primary underline">Oxford Academic</a></li>
                        <li><strong>RhythmicDB:</strong> 87 datasets, 19 species - <a href="https://www.frontiersin.org/articles/10.3389/fgene.2022.882044" target="_blank" rel="noopener" className="text-primary underline">Frontiers</a></li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Verification Workflow */}
              <Card className="border-blue-500/30 bg-blue-500/5">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <ArrowRight size={18} className="text-blue-400" />
                    <span className="font-semibold text-blue-400 text-lg">Recommended Verification Workflow</span>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="h-6 w-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">1</div>
                      <div>
                        <p className="font-semibold text-foreground">Run JTK_CYCLE or MetaCycle</p>
                        <p className="text-xs">Confirm clock genes (Per2, Arntl, Cry1) show expected ~24h rhythms in your dataset</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="h-6 w-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">2</div>
                      <div>
                        <p className="font-semibold text-foreground">Run PAR(2) Analysis (this app)</p>
                        <p className="text-xs">Find phase-gating interactions between clock and target genes</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="h-6 w-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">3</div>
                      <div>
                        <p className="font-semibold text-foreground">Check CircaDB/CircaKB</p>
                        <p className="text-xs">Verify target genes are listed as rhythmic in matching tissues (biological plausibility)</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="h-6 w-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">4</div>
                      <div>
                        <p className="font-semibold text-foreground">Use CircaCompare</p>
                        <p className="text-xs">Test if gating differs between conditions (MYC-ON vs MYC-OFF, WT vs knockout)</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="h-6 w-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">5</div>
                      <div>
                        <p className="font-semibold text-foreground">Concordance Analysis (Multi-Omics tab)</p>
                        <p className="text-xs">If proteomics data available, validate findings at protein level for highest confidence</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 p-2 bg-blue-500/10 rounded text-xs text-blue-300 border border-blue-500/30">
                    <strong>Pro tip:</strong> Findings significant in PAR(2) + confirmed rhythmic in JTK_CYCLE + present in CircaDB = publication-ready evidence
                  </div>
                </CardContent>
              </Card>

              {/* Method Comparison Table */}
              <Card className="border-violet-500/30 bg-violet-500/5">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <BarChart2 size={18} className="text-violet-400" />
                    <span className="font-semibold text-violet-400 text-lg">Method Comparison: What Each Tool Detects</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left p-2 font-semibold">Method</th>
                          <th className="text-left p-2 font-semibold">Question Answered</th>
                          <th className="text-left p-2 font-semibold">Statistical Basis</th>
                          <th className="text-left p-2 font-semibold">Peer-Reviewed?</th>
                        </tr>
                      </thead>
                      <tbody className="text-muted-foreground">
                        <tr className="border-b border-border/50">
                          <td className="p-2"><strong className="text-amber-400">PAR(2)</strong></td>
                          <td className="p-2">Does clock phase modulate target expression?</td>
                          <td className="p-2">Autoregressive + phase interaction terms</td>
                          <td className="p-2"><span className="text-amber-400">Exploratory</span></td>
                        </tr>
                        <tr className="border-b border-border/50">
                          <td className="p-2"><strong className="text-emerald-400">JTK_CYCLE</strong></td>
                          <td className="p-2">Is this gene rhythmic (24h period)?</td>
                          <td className="p-2">Non-parametric (Jonckheere-Terpstra)</td>
                          <td className="p-2"><span className="text-emerald-400">Yes (Hughes 2009)</span></td>
                        </tr>
                        <tr className="border-b border-border/50">
                          <td className="p-2"><strong className="text-emerald-400">MetaCycle</strong></td>
                          <td className="p-2">Consensus rhythmicity across methods?</td>
                          <td className="p-2">Meta-analysis (JTK+LS+ARSER)</td>
                          <td className="p-2"><span className="text-emerald-400">Yes (Wu 2016)</span></td>
                        </tr>
                        <tr className="border-b border-border/50">
                          <td className="p-2"><strong className="text-emerald-400">RAIN</strong></td>
                          <td className="p-2">Rhythmic (non-sinusoidal ok)?</td>
                          <td className="p-2">Umbrella test (robust)</td>
                          <td className="p-2"><span className="text-emerald-400">Yes (Thaben 2014)</span></td>
                        </tr>
                        <tr>
                          <td className="p-2"><strong className="text-emerald-400">CircaCompare</strong></td>
                          <td className="p-2">Do rhythm parameters differ between groups?</td>
                          <td className="p-2">Cosinor regression + F-test</td>
                          <td className="p-2"><span className="text-emerald-400">Yes (Parsons 2020)</span></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <p className="text-xs text-amber-400">
                      <strong>Key insight:</strong> PAR(2) and JTK_CYCLE answer <em>different</em> questions. 
                      A gene can be rhythmic (JTK positive) without phase-gating (PAR(2) negative), or vice versa. 
                      Use both together for comprehensive circadian analysis. <EvidenceLink label="See AR(2) diagnostics" to="/ar2-diagnostics" variant="inline" /> <EvidenceLink label="Framework benchmarks" to="/framework-benchmarks" hash="fisher-detail" variant="inline" />
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* COMPREHENSIVE DOWNLOADS SECTION */}
              <Card className="border-orange-500/30 bg-orange-500/5">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Download size={18} className="text-orange-400" />
                    <span className="font-semibold text-orange-400 text-lg">Downloads</span>
                  </div>
                  
                  {/* Public Downloads - No password */}
                  <div className="mb-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Public Research Data</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-auto py-2 flex-col gap-1 border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10 overflow-hidden"
                        onClick={() => {
                          const a = document.createElement('a');
                          a.href = '/api/download/cross-tissue-report';
                          a.download = 'PAR2_Cross_Tissue_Report.md';
                          a.click();
                        }}
                        data-testid="help-download-cross-tissue"
                      >
                        <FileText size={16} className="flex-shrink-0" />
                        <span className="text-[11px] truncate w-full text-center">Cross-Tissue Report</span>
                        <span className="text-[9px] text-muted-foreground truncate w-full text-center">56 HIGH confidence pairs</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-auto py-2 flex-col gap-1 border-blue-500/50 text-blue-400 hover:bg-blue-500/10 overflow-hidden"
                        onClick={() => {
                          const a = document.createElement('a');
                          a.href = '/api/download/supplementary-data';
                          a.download = 'PAR2_Supplementary_Data.csv';
                          a.click();
                        }}
                        data-testid="help-download-supplementary"
                      >
                        <BarChart3 size={16} className="flex-shrink-0" />
                        <span className="text-[11px] truncate w-full text-center">Supplementary Data</span>
                        <span className="text-[9px] text-muted-foreground truncate w-full text-center">All results (CSV)</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-auto py-2 flex-col gap-1 border-pink-500/50 text-pink-400 hover:bg-pink-500/10 overflow-hidden"
                        onClick={() => {
                          const a = document.createElement('a');
                          a.href = '/api/download/null-survey';
                          a.download = 'PAR2_Null_Survey_Report.txt';
                          a.click();
                        }}
                        data-testid="help-download-null-survey"
                      >
                        <Activity size={16} className="flex-shrink-0" />
                        <span className="text-[11px] truncate w-full text-center">Null Survey Report</span>
                        <span className="text-[9px] text-muted-foreground truncate w-full text-center">Validation results</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-auto py-2 flex-col gap-1 border-teal-500/50 text-teal-400 hover:bg-teal-500/10 overflow-hidden"
                        onClick={() => {
                          const a = document.createElement('a');
                          a.href = '/api/download/eigenvalue-survey';
                          a.download = 'PAR2_Eigenvalue_Survey.json';
                          a.click();
                        }}
                        data-testid="help-download-eigenvalue"
                      >
                        <TrendingUp size={16} className="flex-shrink-0" />
                        <span className="text-[11px] truncate w-full text-center">Eigenvalue Survey</span>
                        <span className="text-[9px] text-muted-foreground truncate w-full text-center">Stability analysis</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-auto py-2 flex-col gap-1 border-red-500/50 text-red-400 hover:bg-red-500/10 overflow-hidden"
                        onClick={() => {
                          const a = document.createElement('a');
                          a.href = '/api/download/human-blood-report';
                          a.download = 'GSE48113_Human_Blood_PAR2_Report.txt';
                          a.click();
                        }}
                        data-testid="help-download-human-blood"
                      >
                        <Dna size={16} className="flex-shrink-0" />
                        <span className="text-[11px] truncate w-full text-center">Human Blood Report</span>
                        <span className="text-[9px] text-muted-foreground truncate w-full text-center">GSE48113 (287 samples)</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-auto py-2 flex-col gap-1 border-orange-500/50 text-orange-400 hover:bg-orange-500/10 overflow-hidden"
                        onClick={() => {
                          const a = document.createElement('a');
                          a.href = '/api/download/supplementary-tables';
                          a.download = 'PAR2_Supplementary_Tables.zip';
                          a.click();
                        }}
                        data-testid="help-download-all-tables"
                      >
                        <FileDown size={16} className="flex-shrink-0" />
                        <span className="text-[11px] truncate w-full text-center">All Tables (ZIP)</span>
                        <span className="text-[9px] text-muted-foreground truncate w-full text-center">Data export</span>
                      </Button>
                    </div>
                  </div>
                  
                  {/* External Links */}
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">External Resources</p>
                    <div className="flex flex-wrap gap-2">
                      <a 
                        href="https://openwetware.org/wiki/HughesLab:JTK_Cycle" 
                        target="_blank" 
                        rel="noopener"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                      >
                        <ExternalLink size={12} />
                        JTK_CYCLE
                      </a>
                      <a 
                        href="https://cran.r-project.org/package=MetaCycle" 
                        target="_blank" 
                        rel="noopener"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                      >
                        <ExternalLink size={12} />
                        MetaCycle
                      </a>
                      <a 
                        href="https://bioconductor.org/packages/rain/" 
                        target="_blank" 
                        rel="noopener"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                      >
                        <ExternalLink size={12} />
                        RAIN
                      </a>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Scientific Context */}
              <div className="mt-4 p-4 bg-secondary/20 rounded-lg border border-border/50">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <BookOpen size={16} className="text-muted-foreground" />
                  Scientific Background
                </h3>
                <p className="text-xs text-muted-foreground">
                  The circadian clock is a 24-hour internal timer that regulates gene expression throughout the body. 
                  Disruption of circadian rhythms is associated with increased cancer risk. This tool characterizes 
                  the temporal dynamics of clock-target gene pairs using AR(2) eigenvalue profiling—|λ| reflects 
                  how long expression changes persist. The PAR(2) model detects phase-dependent associations that 
                  standard correlation analysis would miss.
                </p>
                <p className="text-xs text-amber-400/80 mt-2">
                  <strong>Note:</strong> Cross-tissue consensus (3+ tissues) dramatically reduces false positives. Single-tissue 
                  findings should be validated with peer-reviewed tools (JTK_CYCLE, MetaCycle, RAIN) before publication.
                </p>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Quick Start Guide Dialog - Simple, Beginner-Friendly */}
      <Dialog open={showQuickStart} onOpenChange={setShowQuickStart}>
        <DialogContent className="max-w-2xl" data-testid="dialog-quick-start">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <span className="text-3xl">🚀</span>
              Quick Start Guide
            </DialogTitle>
            <DialogDescription className="text-base">
              Get results in 3 easy steps - no setup required!
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* What This Tool Does - One Sentence */}
            <div className="p-4 bg-primary/10 rounded-lg border border-primary/30">
              <p className="text-lg font-medium text-primary">
                ✨ This app finds genes controlled by your body's internal clock
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Useful for understanding cancer timing and treatment scheduling
              </p>
            </div>

            {/* Step 1 */}
            <div className="flex gap-4 items-start" data-testid="text-guide-step-1">
              <div className="h-12 w-12 rounded-full bg-emerald-500 text-slate-900 flex items-center justify-center font-bold text-xl shrink-0">
                1
              </div>
              <div>
                <h3 className="font-bold text-lg">Pick a Dataset</h3>
                <p className="text-muted-foreground">
                  Scroll down and click any <strong className="text-emerald-400">green tissue button</strong> (like "Liver" or "Heart")
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  💡 Or upload your own CSV file with gene expression data
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-4 items-start" data-testid="text-guide-step-2">
              <div className="h-12 w-12 rounded-full bg-blue-500 text-slate-900 flex items-center justify-center font-bold text-xl shrink-0">
                2
              </div>
              <div>
                <h3 className="font-bold text-lg">Click "Run Analysis"</h3>
                <p className="text-muted-foreground">
                  Hit the <strong className="text-primary">blue Run Analysis button</strong> in the top right
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  💡 For more thorough results, use "Run Full Analysis" (tests 152 gene pairs instead of 9)
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-4 items-start" data-testid="text-guide-step-3">
              <div className="h-12 w-12 rounded-full bg-purple-500 text-slate-900 flex items-center justify-center font-bold text-xl shrink-0">
                3
              </div>
              <div>
                <h3 className="font-bold text-lg">Read Your Results</h3>
                <p className="text-muted-foreground">
                  <span className="text-amber-400 font-semibold">🟢 Green = Significant finding</span> (clock controls this gene)<br/>
                  <span className="text-slate-500">⚪ Gray = No relationship found</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  💡 Click any result card to see detailed charts and explanations
                </p>
              </div>
            </div>

            {/* Two Levels Explained */}
            <div className="p-4 bg-secondary/30 rounded-lg">
              <h4 className="font-bold mb-2 flex items-center gap-2">
                <span className="text-xl">📊</span>
                Two Levels of Analysis (Advanced)
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 bg-blue-500/10 rounded border border-blue-500/30">
                  <p className="font-semibold text-blue-400">mRNA Level</p>
                  <p className="text-xs text-muted-foreground">
                    Main analysis - tests gene transcription
                  </p>
                </div>
                <div className="p-3 bg-purple-500/10 rounded border border-purple-500/30">
                  <p className="font-semibold text-purple-400">Protein Level</p>
                  <p className="text-xs text-muted-foreground">
                    Multi-Omics tab - validates with protein data
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                If both levels show significance = strongest evidence!
              </p>
            </div>

            {/* Common Questions */}
            <div className="text-sm space-y-2">
              <p className="font-semibold">❓ Common Questions:</p>
              <ul className="space-y-1 text-muted-foreground">
                <li>• <strong>No results?</strong> Try "Run Full Analysis" - tests more gene pairs</li>
                <li>• <strong>Want to start over?</strong> Click "New Analysis" button</li>
                <li>• <strong>Need detailed help?</strong> Click "Help" for the full guide</li>
              </ul>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={() => { setShowQuickStart(false); setShowHelp(true); }}
              data-testid="button-full-guide"
            >
              Full Guide
            </Button>
            <Button 
              onClick={() => setShowQuickStart(false)}
              data-testid="button-got-it"
            >
              Got it! Let's go 🎯
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}

function generateMockPhaseData() {
  return Array.from({ length: 25 }, (_, i) => {
    const t = i;
    return { 
      time: t, 
      Per2: Math.cos(2 * Math.PI * t / 24) * 0.8 + 1, 
      Myc: Math.cos(2 * Math.PI * t / 24 + 1.5) * 0.6 + 1.2 + (Math.random() * 0.2)
    };
  });
}

