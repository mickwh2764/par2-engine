import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, Search, GitCompare, Network, Activity, Layers, Dna, TrendingUp, BarChart3, Info, X, Plus
} from "lucide-react";
import PaperCrossLinks from "@/components/PaperCrossLinks";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, Cell, ComposedChart, Line, ReferenceLine, ReferenceArea, Label,
} from "recharts";
import { useLoadedReport } from "@/hooks/useLoadedReport";
import LoadedReportBanner from "@/components/LoadedReportBanner";
import GeneTooltip from "@/components/GeneTooltip";

interface CorrelationResult {
  rho: number;
  pValue: number;
  n: number;
  label: string;
}

interface NetworkScatterPoint {
  gene: string;
  geneType: 'clock' | 'target';
  eigenvalue: number;
  networkDegree: number;
  tissue: string;
}

interface AmplitudeScatterPoint {
  gene: string;
  geneType: 'clock' | 'target';
  eigenvalue: number;
  amplitude: number;
  tissue: string;
}

interface ChromatinBoxData {
  state: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  n: number;
  mean: number;
}

interface FunctionalCategory {
  category: string;
  meanEigenvalue: number;
  clockGenes: number;
  targetGenes: number;
  totalGenes: number;
}

interface ConservationEntry {
  gene: string;
  geneType: 'clock' | 'target';
  tissues: string[];
  eigenvalues: number[];
  mean: number;
  cv: number;
  range: number;
}

interface RootSpacePoint {
  gene: string;
  geneType: 'clock' | 'target';
  phi1: number;
  phi2: number;
  r: number;
  theta: number;
  isComplex: boolean;
  eigenvalue: number;
  networkDegree: number | null;
  amplitude: number;
  chromatinState: string | null;
  h3k4me3: number | null;
  tissue: string;
  dampingRate: number | null;
  naturalPeriod: number | null;
  dampingRatio: number | null;
  primaryCategory?: string;
}

interface CrossMetricData {
  summary: {
    totalMeasurements: number;
    uniqueGenes: number;
    datasets: number;
    clockGenes: number;
    targetGenes: number;
    species?: string;
    speciesLabel?: string;
  };
  correlations: {
    eigenvalue_vs_networkDegree: CorrelationResult;
    eigenvalue_vs_amplitude: CorrelationResult;
    eigenvalue_vs_rSquared: CorrelationResult;
    eigenvalue_vs_h3k4me3: CorrelationResult;
  };
  partialCorrelations: {
    eigenvalue_amplitude_controllingNetwork: { rho: number; n: number } | null;
    eigenvalue_network_controllingAmplitude: { rho: number; n: number } | null;
    note: string;
  };
  networkScatter: NetworkScatterPoint[];
  amplitudeScatter: AmplitudeScatterPoint[];
  chromatinBoxData: ChromatinBoxData[];
  functionalOverlap: {
    eigenvalueOnly: string[];
    networkOnly: string[];
    shared: string[];
    allCategories: FunctionalCategory[];
  };
  crossTissueConservation: ConservationEntry[];
  rootSpaceCorrespondence: {
    points: RootSpacePoint[];
    correlations: {
      r_vs_networkDegree: { rho: number; pValue: number } | null;
      theta_vs_networkDegree: { rho: number; pValue: number } | null;
      r_vs_amplitude: { rho: number; pValue: number } | null;
      theta_vs_amplitude: { rho: number; pValue: number } | null;
      dampingRate_vs_naturalPeriod: { rho: number; pValue: number; n: number } | null;
    };
    stationarityTriangle: {
      vertices: { x: number; y: number }[];
      unitCircle: { x: number; y: number }[];
    };
  };
  conservationSummary: {
    clockMeanCV: number;
    targetMeanCV: number;
    clockMoreConserved: boolean;
    conservationRatio: number;
  };
  dataSources: Record<string, string>;
}

function formatP(p: number): string {
  if (p < 0.001) return `< 0.001`;
  return `= ${p.toFixed(3)}`;
}

function strengthLabel(rho: number): { label: string; color: string } {
  const abs = Math.abs(rho);
  if (abs >= 0.7) return { label: "Strong", color: "text-red-400" };
  if (abs >= 0.4) return { label: "Moderate", color: "text-amber-400" };
  if (abs >= 0.2) return { label: "Weak", color: "text-blue-400" };
  return { label: "Negligible", color: "text-slate-500" };
}

const CustomScatterTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 text-sm shadow-xl" data-testid="scatter-tooltip">
      <div className="font-bold text-slate-900"><GeneTooltip gene={d.gene}>{d.gene}</GeneTooltip></div>
      <div className="text-slate-500 capitalize">{d.geneType} gene {d.tissue ? `• ${d.tissue}` : ''}</div>
      <div className="mt-1 space-y-0.5">
        <div className="text-blue-300">|λ| = {d.eigenvalue?.toFixed(4)}</div>
        {d.networkDegree !== undefined && <div className="text-emerald-300">Network Degree = {d.networkDegree}</div>}
        {d.amplitude !== undefined && <div className="text-amber-300">Amplitude = {d.amplitude?.toFixed(4)}</div>}
      </div>
    </div>
  );
};

const SPECIES_OPTIONS = [
  { value: 'mouse', label: 'Mouse (GSE54650 Multi-Tissue)', description: '4 tissues, 2h sampling' },
  { value: 'human_blood', label: 'Human Whole Blood (GSE113883)', description: '2h sampling, 15 timepoints' },
  { value: 'human_sleep', label: 'Human Blood – Sufficient Sleep (GSE39445)', description: '4h sampling, 10 timepoints' },
] as const;

export function CrossMetricIndependenceImpl() {
  const [geneInput, setGeneInput] = useState("");
  const [selectedGenes, setSelectedGenes] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("network");
  const [rootSpaceColorBy, setRootSpaceColorBy] = useState<'geneType' | 'networkDegree' | 'amplitude' | 'chromatin' | 'dynamicalMode'>('geneType');
  const [showBoundary, setShowBoundary] = useState(true);
  const [dampingColorBy, setDampingColorBy] = useState<'geneType' | 'function'>('geneType');
  const [species, setSpecies] = useState('mouse');
  const [showCrossSpecies, setShowCrossSpecies] = useState(false);
  const [scanDataset, setScanDataset] = useState('GSE54650_Liver_circadian');
  const [scanSort, setScanSort] = useState<'dampingRate' | 'naturalPeriod' | 'eigenvalue'>('dampingRate');
  const { report, hasReport, geneSet } = useLoadedReport();
  const SCAN_DATASETS = useMemo(() => [
    { value: 'GSE54650_Liver_circadian', label: 'Mouse Liver' },
    { value: 'GSE54650_Kidney_circadian', label: 'Mouse Kidney' },
    { value: 'GSE54650_Heart_circadian', label: 'Mouse Heart' },
    { value: 'GSE54650_Lung_circadian', label: 'Mouse Lung' },
    { value: 'GSE113883_Human_WholeBlood', label: 'Human Blood' },
    { value: 'GSE39445_Blood_SufficientSleep', label: 'Human Sleep' },
  ], []);

  useEffect(() => {
    setSelectedGenes([]);
    setGeneInput("");
  }, [species]);

  const { data, isLoading, error } = useQuery<CrossMetricData>({
    queryKey: ['/api/validation/cross-metric-independence', species],
    queryFn: async () => {
      const res = await fetch(`/api/validation/cross-metric-independence?species=${species}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const crossSpeciesStaleTime = 5 * 60 * 1000;
  const { data: mouseData, isLoading: mouseLoading, error: mouseError } = useQuery<CrossMetricData>({
    queryKey: ['/api/validation/cross-metric-independence', 'mouse'],
    queryFn: async () => {
      const res = await fetch('/api/validation/cross-metric-independence?species=mouse');
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    enabled: showCrossSpecies,
    staleTime: crossSpeciesStaleTime,
  });
  const { data: humanBloodData, isLoading: humanBloodLoading, error: humanBloodError } = useQuery<CrossMetricData>({
    queryKey: ['/api/validation/cross-metric-independence', 'human_blood'],
    queryFn: async () => {
      const res = await fetch('/api/validation/cross-metric-independence?species=human_blood');
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    enabled: showCrossSpecies,
    staleTime: crossSpeciesStaleTime,
  });
  const { data: humanSleepData, isLoading: humanSleepLoading, error: humanSleepError } = useQuery<CrossMetricData>({
    queryKey: ['/api/validation/cross-metric-independence', 'human_sleep'],
    queryFn: async () => {
      const res = await fetch('/api/validation/cross-metric-independence?species=human_sleep');
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    enabled: showCrossSpecies,
    staleTime: crossSpeciesStaleTime,
  });
  const crossSpeciesLoading = mouseLoading || humanBloodLoading || humanSleepLoading;
  const crossSpeciesError = mouseError || humanBloodError || humanSleepError;

  const { data: scanData, isLoading: scanLoading } = useQuery<any>({
    queryKey: ['/api/validation/resonance-scan', scanDataset],
    queryFn: async () => {
      const res = await fetch(`/api/validation/resonance-scan?dataset=${scanDataset}`);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });

  const sortedResonance = useMemo(() => {
    if (!scanData?.resonanceZone?.genes) return [];
    return scanData.resonanceZone.genes.slice().sort((a: any, b: any) =>
      scanSort === 'dampingRate' ? a.dampingRate - b.dampingRate
      : scanSort === 'naturalPeriod' ? Math.abs(a.naturalPeriod - 24) - Math.abs(b.naturalPeriod - 24)
      : b.eigenvalue - a.eigenvalue
    );
  }, [scanData, scanSort]);

  const boundaryLine = useMemo(() => {
    const points: { phi1: number; phi2: number }[] = [];
    for (let phi1 = -1.5; phi1 <= 2.0; phi1 += 0.02) {
      const phi2 = -(phi1 * phi1) / 4;
      if (phi2 >= -1 && phi2 <= 0.5) {
        points.push({ phi1: +phi1.toFixed(3), phi2: +phi2.toFixed(3) });
      }
    }
    return points;
  }, []);

  const dynamicalModeStats = useMemo(() => {
    if (!data?.rootSpaceCorrespondence) return null;
    const pts = data.rootSpaceCorrespondence.points;
    const oscillatory = pts.filter(p => p.isComplex);
    const overdamped = pts.filter(p => !p.isComplex);
    const oscClock = oscillatory.filter(p => p.geneType === 'clock').length;
    const oscTarget = oscillatory.filter(p => p.geneType === 'target').length;
    const odClock = overdamped.filter(p => p.geneType === 'clock').length;
    const odTarget = overdamped.filter(p => p.geneType === 'target').length;
    const totalClock = oscClock + odClock;
    const totalTarget = oscTarget + odTarget;
    return {
      oscillatory: oscillatory.length,
      overdamped: overdamped.length,
      oscClock, oscTarget, odClock, odTarget,
      oscPct: ((oscillatory.length / pts.length) * 100).toFixed(1),
      odPct: ((overdamped.length / pts.length) * 100).toFixed(1),
      clockOscPct: totalClock > 0 ? ((oscClock / totalClock) * 100).toFixed(0) : '0',
      targetOscPct: totalTarget > 0 ? ((oscTarget / totalTarget) * 100).toFixed(0) : '0',
    };
  }, [data]);

  const dampingChartData = useMemo(() => {
    if (!data?.rootSpaceCorrespondence) return null;
    const CATEGORY_COLORS: Record<string, string> = {
      'Circadian': '#f97316', 'Cell Cycle': '#3b82f6', 'DNA Damage': '#ef4444',
      'Tumor/Apoptosis': '#a855f7', 'Metabolism': '#22c55e', 'Stem/Wnt': '#06b6d4',
      'Hypoxia': '#f43f5e', 'Proliferation': '#eab308', 'Other': '#6b7280',
    };
    const oscPoints = data.rootSpaceCorrespondence.points.filter(
      (p: any) => p.isComplex && p.dampingRate !== null && p.naturalPeriod !== null
    );
    const clockOsc = oscPoints.filter((p: any) => p.geneType === 'clock');
    const targetOsc = oscPoints.filter((p: any) => p.geneType === 'target');
    const dfCorr = data.rootSpaceCorrespondence.correlations.dampingRate_vs_naturalPeriod;
    const clockDamping = clockOsc.length > 0 ? (clockOsc.reduce((s: number, p: any) => s + p.dampingRate, 0) / clockOsc.length) : 0;
    const targetDamping = targetOsc.length > 0 ? (targetOsc.reduce((s: number, p: any) => s + p.dampingRate, 0) / targetOsc.length) : 0;
    const clockPeriod = clockOsc.length > 0 ? (clockOsc.reduce((s: number, p: any) => s + p.naturalPeriod, 0) / clockOsc.length) : 0;
    const targetPeriod = targetOsc.length > 0 ? (targetOsc.reduce((s: number, p: any) => s + p.naturalPeriod, 0) / targetOsc.length) : 0;
    const categorizedPoints = oscPoints.reduce((acc: Record<string, any[]>, p: any) => {
      const cat = p.primaryCategory || 'Other';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(p);
      return acc;
    }, {} as Record<string, any[]>);
    const resonanceGenes = oscPoints.filter((p: any) => p.naturalPeriod >= 20 && p.naturalPeriod <= 28 && p.dampingRate < 0.5);
    return { oscPoints, clockOsc, targetOsc, dfCorr, clockDamping, targetDamping, clockPeriod, targetPeriod, categorizedPoints, resonanceGenes, CATEGORY_COLORS };
  }, [data]);

  const availableGenes = useMemo(() => {
    if (!data) return [];
    const genes = new Set(data.networkScatter.map(g => g.gene));
    data.amplitudeScatter.forEach(g => genes.add(g.gene));
    data.crossTissueConservation.forEach(g => genes.add(g.gene));
    return Array.from(genes).sort();
  }, [data]);

  const suggestions = useMemo(() => {
    if (!geneInput || geneInput.length < 1) return [];
    const lower = geneInput.toLowerCase();
    return availableGenes.filter(g => g.toLowerCase().includes(lower) && !selectedGenes.includes(g)).slice(0, 8);
  }, [geneInput, availableGenes, selectedGenes]);

  const addGene = (gene: string) => {
    if (!selectedGenes.includes(gene)) {
      setSelectedGenes(prev => [...prev, gene]);
    }
    setGeneInput("");
  };

  const removeGene = (gene: string) => {
    setSelectedGenes(prev => prev.filter(g => g !== gene));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && suggestions.length > 0) {
      addGene(suggestions[0]);
    }
  };

  const highlightedSet = useMemo(() => new Set(selectedGenes), [selectedGenes]);
  const hasHighlights = selectedGenes.length > 0;

  const selectedGeneProfiles = useMemo(() => {
    if (!data || selectedGenes.length === 0) return [];
    return selectedGenes.map(gene => {
      const network = data.networkScatter.find(g => g.gene === gene);
      const amplitude = data.amplitudeScatter.find(g => g.gene === gene);
      const conservation = data.crossTissueConservation.find(g => g.gene === gene);
      const category = data.functionalOverlap.allCategories.find(c =>
        data.amplitudeScatter.filter(a => a.gene === gene).length > 0
      );
      const geneType = network?.geneType || amplitude?.geneType || 'target';
      const allAmplitudes = data.amplitudeScatter.filter(a => a.gene === gene);
      const meanAmplitude = allAmplitudes.length > 0 ? allAmplitudes.reduce((s, a) => s + a.amplitude, 0) / allAmplitudes.length : null;
      const meanEigenvalue = allAmplitudes.length > 0 ? allAmplitudes.reduce((s, a) => s + a.eigenvalue, 0) / allAmplitudes.length : null;

      return {
        gene,
        geneType,
        eigenvalue: meanEigenvalue,
        networkDegree: network?.networkDegree ?? null,
        amplitude: meanAmplitude,
        cv: conservation?.cv ?? null,
        tissues: conservation?.tissues ?? [],
        tissueEigenvalues: conservation?.eigenvalues ?? [],
      };
    });
  }, [data, selectedGenes]);

  const filteredConservation = useMemo(() => {
    if (!data) return [];
    return data.crossTissueConservation;
  }, [data]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full mx-auto" />
          <p className="text-slate-500">Computing cross-metric independence analysis...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex items-center justify-center">
        <Card className="bg-red-950/30 border-red-800/50 max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-red-400">Failed to load analysis data</p>
            <p className="text-gray-500 text-sm mt-2">{String(error)}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const corrCards = [
    { key: 'eigenvalue_vs_networkDegree' as const, icon: Network, iconClass: 'text-emerald-400' },
    { key: 'eigenvalue_vs_amplitude' as const, icon: Activity, iconClass: 'text-amber-400' },
    { key: 'eigenvalue_vs_rSquared' as const, icon: TrendingUp, iconClass: 'text-blue-400' },
    { key: 'eigenvalue_vs_h3k4me3' as const, icon: Layers, iconClass: 'text-purple-400' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 text-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-700" data-testid="link-back">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Home
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent" data-testid="text-page-title">
                Cross-Metric Independence
              </h1>
              <p className="text-slate-500 mt-1">
                Quantifying what |λ| captures that other metrics miss
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-cyan-400 border-cyan-800" data-testid="badge-genes">
              {data.summary.uniqueGenes} genes
            </Badge>
            <Badge variant="outline" className="text-emerald-400 border-emerald-800" data-testid="badge-datasets">
              {data.summary.datasets} {species === 'mouse' ? 'tissues' : 'dataset'}
            </Badge>
            {data.summary.speciesLabel && (
              <Badge variant="outline" className="text-violet-400 border-violet-800" data-testid="badge-species">
                {data.summary.speciesLabel}
              </Badge>
            )}
          </div>
        </div>

        {hasReport && report && (
          <LoadedReportBanner
            title={report.title}
            summary={report.summary}
            geneCount={report.geneCount}
            sourcePage={report.sourcePage}
          />
        )}

        <PaperCrossLinks currentPage="/cross-metric-independence" />

        <div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-sm font-medium text-slate-900">Species / Dataset:</span>
            <div className="flex flex-wrap gap-2" data-testid="species-selector">
              {SPECIES_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { setSpecies(opt.value); setSelectedGenes([]); }}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    species === opt.value
                      ? 'bg-cyan-600/30 text-cyan-300 border border-cyan-500/50'
                      : 'bg-slate-50 text-slate-500 border border-slate-200 hover:border-slate-300 hover:text-slate-600'
                  }`}
                  data-testid={`btn-species-${opt.value}`}
                >
                  {opt.label}
                  <span className="ml-1 text-gray-500">({opt.description})</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center mt-2">
            <button
              onClick={() => setShowCrossSpecies(v => !v)}
              className={`text-xs font-medium px-3 py-1 rounded-md transition-all ${
                showCrossSpecies
                  ? 'bg-violet-600/30 text-violet-300 border border-violet-500/50'
                  : 'bg-slate-50 text-gray-500 border border-slate-200 hover:text-slate-600'
              }`}
              data-testid="btn-cross-species-toggle"
            >
              {showCrossSpecies ? 'Hide' : 'Show'} Cross-Species Summary
            </button>
          </div>
        </div>

        {showCrossSpecies && mouseData && humanBloodData && humanSleepData && (() => {
          const datasets = [
            { label: 'Mouse (Multi-Tissue)', data: mouseData, key: 'mouse' },
            { label: 'Human Blood (GSE113883)', data: humanBloodData, key: 'human_blood' },
            { label: 'Human Sleep (GSE39445)', data: humanSleepData, key: 'human_sleep' },
          ];
          const getOscPct = (d: CrossMetricData) => {
            const pts = d.rootSpaceCorrespondence?.points || [];
            if (!pts.length) return 0;
            return +((pts.filter(p => p.isComplex).length / pts.length) * 100).toFixed(1);
          };
          return (
            <Card className="bg-white border-violet-800/50" data-testid="card-cross-species">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-violet-300 flex items-center gap-2">
                  <GitCompare className="w-4 h-4" />
                  Cross-Species Comparison Summary
                </CardTitle>
                <CardDescription className="text-gray-500 text-xs">
                  Key metrics across all three datasets — testing whether AR(2) patterns hold universally
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs" data-testid="table-cross-species">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left text-slate-500 py-2 pr-4 font-medium">Metric</th>
                        {datasets.map(d => (
                          <th key={d.key} className="text-center text-slate-500 py-2 px-3 font-medium">{d.label}</th>
                        ))}
                        <th className="text-center text-slate-500 py-2 pl-3 font-medium">Conserved?</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/50">
                      <tr>
                        <td className="py-2.5 pr-4 text-slate-600 font-medium">Genes analyzed</td>
                        {datasets.map(d => (
                          <td key={d.key} className="py-2.5 px-3 text-center text-slate-900 font-mono">{d.data.summary.uniqueGenes}</td>
                        ))}
                        <td className="py-2.5 pl-3 text-center text-gray-500">—</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 pr-4 text-slate-600 font-medium">|λ| vs Network Degree (ρ)</td>
                        {datasets.map(d => {
                          const rho = d.data.correlations.eigenvalue_vs_networkDegree.rho;
                          const s = strengthLabel(rho);
                          return (
                            <td key={d.key} className="py-2.5 px-3 text-center">
                              <span className={`font-mono ${s.color}`}>{rho.toFixed(3)}</span>
                              <span className="text-gray-600 ml-1">({s.label})</span>
                            </td>
                          );
                        })}
                        <td className="py-2.5 pl-3 text-center">
                          {datasets.every(d => Math.abs(d.data.correlations.eigenvalue_vs_networkDegree.rho) < 0.5)
                            ? <Badge className="bg-emerald-900/50 text-emerald-400 text-[10px]">Yes — partial independence</Badge>
                            : <Badge className="bg-amber-900/50 text-amber-400 text-[10px]">Mixed</Badge>}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 pr-4 text-slate-600 font-medium">|λ| vs Amplitude (ρ)</td>
                        {datasets.map(d => {
                          const rho = d.data.correlations.eigenvalue_vs_amplitude.rho;
                          const s = strengthLabel(rho);
                          return (
                            <td key={d.key} className="py-2.5 px-3 text-center">
                              <span className={`font-mono ${s.color}`}>{rho.toFixed(3)}</span>
                              <span className="text-gray-600 ml-1">({s.label})</span>
                            </td>
                          );
                        })}
                        <td className="py-2.5 pl-3 text-center">
                          {datasets.every(d => Math.abs(d.data.correlations.eigenvalue_vs_amplitude.rho) < 0.7)
                            ? <Badge className="bg-emerald-900/50 text-emerald-400 text-[10px]">Yes — not redundant</Badge>
                            : <Badge className="bg-amber-900/50 text-amber-400 text-[10px]">Check overlap</Badge>}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 pr-4 text-slate-600 font-medium">Oscillatory genes (%)</td>
                        {datasets.map(d => {
                          const pct = getOscPct(d.data);
                          return (
                            <td key={d.key} className="py-2.5 px-3 text-center font-mono text-rose-400">{pct}%</td>
                          );
                        })}
                        <td className="py-2.5 pl-3 text-center">
                          <Badge className="bg-cyan-900/50 text-cyan-400 text-[10px]">Species-specific</Badge>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 pr-4 text-slate-600 font-medium">Clock &gt; Target hierarchy</td>
                        {datasets.map(d => {
                          const conserved = d.data.conservationSummary?.clockMoreConserved;
                          return (
                            <td key={d.key} className="py-2.5 px-3 text-center">
                              {conserved
                                ? <span className="text-emerald-400 font-medium">Preserved</span>
                                : <span className="text-amber-400 font-medium">Not clear</span>}
                            </td>
                          );
                        })}
                        <td className="py-2.5 pl-3 text-center">
                          {datasets.every(d => d.data.conservationSummary?.clockMoreConserved)
                            ? <Badge className="bg-emerald-900/50 text-emerald-400 text-[10px]">Universal</Badge>
                            : <Badge className="bg-amber-900/50 text-amber-400 text-[10px]">Partial</Badge>}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 p-2 bg-slate-100/40 rounded text-[11px] text-gray-500 leading-relaxed">
                  <strong className="text-slate-500">Interpretation:</strong> If |λ| is a genuinely independent metric, we expect weak-to-moderate correlations with network degree and amplitude across all species. If the oscillatory fraction or clock &gt; target hierarchy changes across species, it reflects genuine biological differences in how circadian dynamics manifest — not a failure of the method.
                </div>

                <div className="mt-4">
                  <div className="text-xs text-violet-300 font-medium mb-3 flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-violet-500" />
                    Cross-Species Damping Landscape
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                    {datasets.map(ds => {
                      const pts = ds.data.rootSpaceCorrespondence?.points || [];
                      const osc = pts.filter((p: any) => p.isComplex && p.dampingRate != null && p.naturalPeriod != null);
                      const clockPts = osc.filter((p: any) => p.geneType === 'clock');
                      const targetPts = osc.filter((p: any) => p.geneType === 'target');
                      const resonance = osc.filter((p: any) => p.naturalPeriod >= 20 && p.naturalPeriod <= 28 && p.dampingRate < 0.5);
                      const meanDamping = osc.length > 0 ? osc.reduce((s: number, p: any) => s + p.dampingRate, 0) / osc.length : 0;
                      const meanPeriod = osc.length > 0 ? osc.reduce((s: number, p: any) => s + p.naturalPeriod, 0) / osc.length : 0;
                      return (
                        <div key={ds.key} className="bg-slate-100/30 rounded-lg p-2" data-testid={`cross-species-damping-${ds.key}`}>
                          <div className="text-[10px] text-slate-500 font-medium mb-1">{ds.label}</div>
                          <div className="h-[220px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <ScatterChart margin={{ top: 5, right: 10, bottom: 25, left: 35 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                <XAxis type="number" dataKey="dampingRate" domain={[0, 'auto']} stroke="#4b5563" tick={{ fill: '#6b7280', fontSize: 8 }} label={{ value: 'Damping', position: 'bottom', offset: 10, fill: '#6b7280', fontSize: 8 }} />
                                <YAxis type="number" dataKey="naturalPeriod" domain={[0, 'auto']} stroke="#4b5563" tick={{ fill: '#6b7280', fontSize: 8 }} label={{ value: 'Period (h)', angle: -90, position: 'insideLeft', offset: -20, fill: '#6b7280', fontSize: 8 }} />
                                <ReferenceArea x1={0} x2={0.5} y1={20} y2={28} fill="#22c55e" fillOpacity={0.08} stroke="#22c55e" strokeOpacity={0.2} strokeDasharray="4 4" />
                                <ReferenceLine y={24} stroke="#facc15" strokeDasharray="6 3" strokeOpacity={0.4} />
                                <Tooltip content={({ payload }: any) => {
                                  if (!payload?.[0]) return null;
                                  const d = payload[0].payload;
                                  return (
                                    <div className="bg-white border border-slate-200 rounded p-1.5 text-[10px] shadow-lg">
                                      <div className="font-medium text-slate-900"><GeneTooltip gene={d.gene}>{d.gene}</GeneTooltip></div>
                                      <div className="text-slate-500">ζ={d.dampingRate?.toFixed(3)}, T={d.naturalPeriod?.toFixed(1)}h</div>
                                    </div>
                                  );
                                }} />
                                <Scatter name="Clock" data={clockPts} fill="#f97316" fillOpacity={0.7} />
                                <Scatter name="Target" data={targetPts} fill="#6366f1" fillOpacity={0.7} />
                              </ScatterChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="text-[10px] text-gray-500 mt-1 space-y-0.5">
                            <div>{osc.length} oscillatory · Mean ζ={meanDamping.toFixed(3)}, T={meanPeriod.toFixed(1)}h</div>
                            <div className="text-emerald-500">{resonance.length} in resonance zone</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-2 p-2 bg-slate-100/40 rounded text-[10px] text-gray-500 leading-relaxed">
                    <strong className="text-slate-500">Damping landscape:</strong> Each panel shows oscillatory genes in damping rate vs natural period space. The green zone marks the circadian resonance region (20–28h period, low damping). Consistent clustering patterns across species confirm that AR(2) dynamics reflect conserved biology, not dataset-specific artifacts.
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {showCrossSpecies && !(mouseData && humanBloodData && humanSleepData) && (
          <Card className="bg-white border-violet-800/50">
            <CardContent className="py-6 flex items-center justify-center gap-3">
              {crossSpeciesError ? (
                <span className="text-red-400 text-sm">Failed to load cross-species data. Try toggling the panel.</span>
              ) : (
                <>
                  <div className="animate-spin w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full" />
                  <span className="text-slate-500 text-sm">Loading cross-species data...</span>
                </>
              )}
            </CardContent>
          </Card>
        )}

        <div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            <strong className="text-slate-900">What you can do:</strong> Select one or more genes to compare their eigenvalue |λ|, network centrality, cosinor amplitude, and chromatin state side by side. Selected genes are highlighted across all scatter plots so you can see where they fall relative to the full distribution. Spearman correlations and partial correlations quantify the independent information content of each metric. Cross-tissue conservation compares eigenvalue coefficient of variation across tissues for clock vs target genes.
          </p>
        </div>

        <Card className="bg-white border-gray-800">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-2">
              <Plus className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-medium text-slate-900">Select genes to compare across all metrics</span>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                value={geneInput}
                onChange={e => setGeneInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={species === 'mouse' ? "Type a gene name (e.g. Per2, Myc, Wee1)..." : "Type a gene name (e.g. PER2, CRY1, TP53)..."}
                className="pl-10 bg-white border-slate-200 text-slate-800"
                data-testid="input-gene-search"
              />
              {suggestions.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto" data-testid="gene-suggestions">
                  {suggestions.map(gene => (
                    <button
                      key={gene}
                      onClick={() => addGene(gene)}
                      className="w-full text-left px-4 py-2 hover:bg-slate-100 text-sm text-slate-800 flex items-center justify-between"
                      data-testid={`suggestion-${gene}`}
                    >
                      <span>{gene}</span>
                      <Badge variant="outline" className={`text-xs ${availableGenes.includes(gene) && data?.networkScatter.find(g => g.gene === gene)?.geneType === 'clock' ? 'text-blue-400 border-blue-800' : 'text-amber-400 border-amber-800'}`}>
                        {data?.networkScatter.find(g => g.gene === gene)?.geneType || data?.amplitudeScatter.find(g => g.gene === gene)?.geneType || ''}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selectedGenes.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {selectedGenes.map(gene => (
                  <Badge
                    key={gene}
                    className="bg-cyan-950/50 text-cyan-300 border-cyan-700 cursor-pointer hover:bg-cyan-900/50 pr-1"
                    data-testid={`selected-gene-${gene}`}
                    onClick={() => removeGene(gene)}
                  >
                    {gene}
                    <X className="w-3 h-3 ml-1" />
                  </Badge>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-gray-500 hover:text-slate-600 h-6"
                  onClick={() => setSelectedGenes([])}
                  data-testid="button-clear-genes"
                >
                  Clear all
                </Button>
              </div>
            )}
            {selectedGenes.length === 0 && (
              <p className="text-xs text-gray-500 mt-2">
                Add genes to highlight them across all scatter plots and see their metric profiles side by side. Try comparing a clock gene (Per2) against a target gene (Myc).
              </p>
            )}
          </CardContent>
        </Card>

        {selectedGeneProfiles.length > 0 && (
          <Card className="bg-white border-cyan-800/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <GitCompare className="w-5 h-5 text-cyan-400" />
                Gene Metric Profiles
              </CardTitle>
              <CardDescription>
                Side-by-side comparison of all metrics for your selected genes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="table-gene-profiles">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left py-2 px-3 text-slate-500 font-medium">Gene</th>
                      <th className="text-left py-2 px-3 text-slate-500 font-medium">Type</th>
                      <th className="text-right py-2 px-3 text-slate-500 font-medium">|λ| (mean)</th>
                      <th className="text-right py-2 px-3 text-slate-500 font-medium">Network Degree</th>
                      <th className="text-right py-2 px-3 text-slate-500 font-medium">Amplitude</th>
                      <th className="text-right py-2 px-3 text-slate-500 font-medium">Cross-Tissue CV</th>
                      <th className="text-left py-2 px-3 text-slate-500 font-medium">Tissues</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedGeneProfiles.map(p => (
                      <tr key={p.gene} className="border-b border-gray-800/50 hover:bg-cyan-950/10">
                        <td className="py-2 px-3 font-bold text-cyan-300"><GeneTooltip gene={p.gene}>{p.gene}</GeneTooltip></td>
                        <td className="py-2 px-3">
                          <Badge variant="outline" className={p.geneType === 'clock' ? 'text-blue-400 border-blue-800' : 'text-amber-400 border-amber-800'}>
                            {p.geneType}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-cyan-400">{p.eigenvalue?.toFixed(4) ?? '—'}</td>
                        <td className="py-2 px-3 text-right font-mono text-emerald-400">{p.networkDegree ?? '—'}</td>
                        <td className="py-2 px-3 text-right font-mono text-amber-400">{p.amplitude?.toFixed(4) ?? '—'}</td>
                        <td className="py-2 px-3 text-right font-mono text-slate-600">{p.cv?.toFixed(4) ?? '—'}</td>
                        <td className="py-2 px-3 text-slate-500 text-xs">{p.tissues.length > 0 ? p.tissues.join(', ') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {selectedGeneProfiles.length >= 2 && (
                <div className="mt-4 rounded-lg bg-slate-50 border border-slate-200 p-3">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-cyan-500 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-slate-500">
                      {(() => {
                        const clockProfiles = selectedGeneProfiles.filter(p => p.geneType === 'clock' && p.eigenvalue !== null);
                        const targetProfiles = selectedGeneProfiles.filter(p => p.geneType === 'target' && p.eigenvalue !== null);
                        if (clockProfiles.length > 0 && targetProfiles.length > 0) {
                          const clockMeanEV = clockProfiles.reduce((s, p) => s + p.eigenvalue!, 0) / clockProfiles.length;
                          const targetMeanEV = targetProfiles.reduce((s, p) => s + p.eigenvalue!, 0) / targetProfiles.length;
                          const clockMeanNet = clockProfiles.filter(p => p.networkDegree !== null);
                          const targetMeanNet = targetProfiles.filter(p => p.networkDegree !== null);
                          const clockNetAvg = clockMeanNet.length > 0 ? clockMeanNet.reduce((s, p) => s + p.networkDegree!, 0) / clockMeanNet.length : 0;
                          const targetNetAvg = targetMeanNet.length > 0 ? targetMeanNet.reduce((s, p) => s + p.networkDegree!, 0) / targetMeanNet.length : 0;
                          return `Selected clock genes have mean |λ| = ${clockMeanEV.toFixed(3)} vs target genes mean |λ| = ${targetMeanEV.toFixed(3)}. Network degree: clock mean = ${Math.round(clockNetAvg)} vs target mean = ${Math.round(targetNetAvg)}. ${clockMeanEV > targetMeanEV && targetNetAvg > clockNetAvg ? 'This illustrates partial independence: higher persistence does not require higher network connectivity.' : 'Compare where these genes fall on the scatter plots below.'}`;
                        }
                        return 'Add both clock and target genes to compare their metric profiles.';
                      })()}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {corrCards.map(({ key, icon: Icon, iconClass }) => {
            const corr = data.correlations[key];
            const strength = strengthLabel(corr.rho);
            return (
              <Card key={key} className="bg-white border-gray-800" data-testid={`card-corr-${key}`}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={`w-4 h-4 ${iconClass}`} />
                    <span className="text-xs text-slate-500">{corr.label}</span>
                  </div>
                  <div className={`text-2xl font-bold ${strength.color}`}>
                    ρ = {corr.rho.toFixed(3)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {strength.label} • p {formatP(corr.pValue)} • n={corr.n}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {data.partialCorrelations.eigenvalue_amplitude_controllingNetwork && (
          <Card className="bg-white border-gray-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <GitCompare className="w-5 h-5 text-cyan-400" />
                Partial Correlation Matrix
              </CardTitle>
              <CardDescription>
                Correlations after controlling for confounding variables
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
                  <div className="text-sm text-slate-500 mb-1">|λ| vs Amplitude, controlling for Network Degree</div>
                  <div className={`text-xl font-bold ${strengthLabel(data.partialCorrelations.eigenvalue_amplitude_controllingNetwork.rho).color}`}>
                    ρ_partial = {data.partialCorrelations.eigenvalue_amplitude_controllingNetwork.rho.toFixed(3)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    n = {data.partialCorrelations.eigenvalue_amplitude_controllingNetwork.n}
                  </div>
                </div>
                {data.partialCorrelations.eigenvalue_network_controllingAmplitude && (
                  <div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
                    <div className="text-sm text-slate-500 mb-1">|λ| vs Network Degree, controlling for Amplitude</div>
                    <div className={`text-xl font-bold ${strengthLabel(data.partialCorrelations.eigenvalue_network_controllingAmplitude.rho).color}`}>
                      ρ_partial = {data.partialCorrelations.eigenvalue_network_controllingAmplitude.rho.toFixed(3)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      n = {data.partialCorrelations.eigenvalue_network_controllingAmplitude.n}
                    </div>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-3 italic">{data.partialCorrelations.note}</p>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white">
            <TabsTrigger value="network" data-testid="tab-network">Network Centrality</TabsTrigger>
            <TabsTrigger value="amplitude" data-testid="tab-amplitude">Cosinor Amplitude</TabsTrigger>
            <TabsTrigger value="chromatin" data-testid="tab-chromatin">Chromatin State</TabsTrigger>
            <TabsTrigger value="functional" data-testid="tab-functional">Functional Categories</TabsTrigger>
            <TabsTrigger value="conservation" data-testid="tab-conservation">Cross-Tissue Conservation</TabsTrigger>
            <TabsTrigger value="rootspace" data-testid="tab-rootspace">Root-Space Mapping</TabsTrigger>
          </TabsList>

          <TabsContent value="network" className="space-y-4 mt-4">
            <Card className="bg-white border-gray-800">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Network className="w-5 h-5 text-emerald-400" />
                  |λ| vs STRING Network Degree
                </CardTitle>
                <CardDescription>
                  Does temporal persistence correlate with protein-protein interaction connectivity?
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[450px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 10, right: 30, bottom: 40, left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis
                        dataKey="eigenvalue"
                        type="number"
                        name="|λ|"
                        domain={[0, 1]}
                        label={{ value: "Eigenvalue Modulus |λ|", position: "bottom", offset: 20, fill: "#64748b" }}
                        tick={{ fill: '#64748b' }}
                      />
                      <YAxis
                        dataKey="networkDegree"
                        type="number"
                        name="Network Degree"
                        label={{ value: "STRING Network Degree", angle: -90, position: "insideLeft", offset: -5, fill: "#64748b" }}
                        tick={{ fill: '#64748b' }}
                      />
                      <Tooltip content={<CustomScatterTooltip />} />
                      <Legend />
                      <Scatter
                        name="Clock genes"
                        data={data.networkScatter.filter(g => g.geneType === 'clock' && !highlightedSet.has(g.gene))}
                        fill="#3b82f6"
                        fillOpacity={hasHighlights ? 0.2 : 0.7}
                        r={hasHighlights ? 4 : 6}
                      />
                      <Scatter
                        name="Target genes"
                        data={data.networkScatter.filter(g => g.geneType === 'target' && !highlightedSet.has(g.gene))}
                        fill="#f59e0b"
                        fillOpacity={hasHighlights ? 0.2 : 0.7}
                        r={hasHighlights ? 4 : 6}
                      />
                      {hasHighlights && (
                        <Scatter
                          name="Selected genes"
                          data={data.networkScatter.filter(g => highlightedSet.has(g.gene))}
                          fill="#06b6d4"
                          fillOpacity={1}
                          r={10}
                          shape={(props: any) => {
                            const { cx, cy, payload } = props;
                            return (
                              <g>
                                <circle cx={cx} cy={cy} r={10} fill="#06b6d4" stroke="#fff" strokeWidth={2} />
                                <text x={cx} y={cy - 14} textAnchor="middle" fill="#e2e8f0" fontSize={11} fontWeight="bold">
                                  {payload.gene}
                                </text>
                              </g>
                            );
                          }}
                        />
                      )}
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 rounded-lg bg-slate-50 border border-slate-200 p-3">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-gray-500">
                      Network degree values are curated reference values based on STRING v12.0 mouse protein-protein interaction network (Szklarczyk et al., 2023). Target genes like Trp53, Ctnnb1, and Myc have high network degree but lower |λ| than clock genes, illustrating that network centrality and temporal persistence measure different gene properties.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="amplitude" className="space-y-4 mt-4">
            <Card className="bg-white border-gray-800">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="w-5 h-5 text-amber-400" />
                  |λ| vs Cosinor Amplitude
                </CardTitle>
                <CardDescription>
                  Does oscillation strength predict temporal persistence?
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[450px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 10, right: 30, bottom: 40, left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis
                        dataKey="eigenvalue"
                        type="number"
                        name="|λ|"
                        domain={[0, 1]}
                        label={{ value: "Eigenvalue Modulus |λ|", position: "bottom", offset: 20, fill: "#64748b" }}
                        tick={{ fill: '#64748b' }}
                      />
                      <YAxis
                        dataKey="amplitude"
                        type="number"
                        name="Amplitude"
                        label={{ value: "Cosinor Amplitude", angle: -90, position: "insideLeft", offset: -5, fill: "#64748b" }}
                        tick={{ fill: '#64748b' }}
                      />
                      <Tooltip content={<CustomScatterTooltip />} />
                      <Legend />
                      <Scatter
                        name="Clock genes"
                        data={data.amplitudeScatter.filter(g => g.geneType === 'clock' && !highlightedSet.has(g.gene))}
                        fill="#3b82f6"
                        fillOpacity={hasHighlights ? 0.2 : 0.7}
                        r={hasHighlights ? 4 : 6}
                      />
                      <Scatter
                        name="Target genes"
                        data={data.amplitudeScatter.filter(g => g.geneType === 'target' && !highlightedSet.has(g.gene))}
                        fill="#f59e0b"
                        fillOpacity={hasHighlights ? 0.2 : 0.7}
                        r={hasHighlights ? 4 : 6}
                      />
                      {hasHighlights && (
                        <Scatter
                          name="Selected genes"
                          data={data.amplitudeScatter.filter(g => highlightedSet.has(g.gene))}
                          fill="#06b6d4"
                          fillOpacity={1}
                          r={10}
                          shape={(props: any) => {
                            const { cx, cy, payload } = props;
                            return (
                              <g>
                                <circle cx={cx} cy={cy} r={10} fill="#06b6d4" stroke="#fff" strokeWidth={2} />
                                <text x={cx} y={cy - 14} textAnchor="middle" fill="#e2e8f0" fontSize={11} fontWeight="bold">
                                  {payload.gene}
                                </text>
                              </g>
                            );
                          }}
                        />
                      )}
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 rounded-lg bg-slate-50 border border-slate-200 p-3">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-gray-500">
                      Cosinor amplitude measures oscillation strength (peak-to-trough) while |λ| measures temporal persistence (memory). A gene can have strong oscillation but weak persistence (noisy rhythm) or vice versa (stable trajectory without dramatic swings).
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="chromatin" className="space-y-4 mt-4">
            <Card className="bg-white border-gray-800">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Layers className="w-5 h-5 text-purple-400" />
                  |λ| by Chromatin State
                </CardTitle>
                <CardDescription>
                  Eigenvalue distribution grouped by chromatin accessibility (ENCODE/Roadmap)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.chromatinBoxData} margin={{ top: 10, right: 30, bottom: 20, left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="state" tick={{ fill: '#64748b' }} />
                      <YAxis
                        label={{ value: "Mean |λ|", angle: -90, position: "insideLeft", fill: "#64748b" }}
                        tick={{ fill: '#64748b' }}
                        domain={[0, 1]}
                      />
                      <Tooltip
                        formatter={(value: number) => value.toFixed(4)}
                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                        labelStyle={{ color: '#e2e8f0' }}
                        itemStyle={{ color: '#94a3b8' }}
                      />
                      <Bar dataKey="mean" name="Mean |λ|" radius={[4, 4, 0, 0]}>
                        {data.chromatinBoxData.map((entry, idx) => (
                          <Cell
                            key={idx}
                            fill={entry.state === 'Active' ? '#8b5cf6' : entry.state === 'Poised' ? '#6366f1' : '#4f46e5'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                  {data.chromatinBoxData.map(box => (
                    <div key={box.state} className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                      <div className="text-sm font-medium text-slate-900">{box.state}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        Mean: {box.mean.toFixed(4)} | Median: {box.median.toFixed(4)}
                      </div>
                      <div className="text-xs text-gray-500">
                        Range: {box.min.toFixed(3)}–{box.max.toFixed(3)} | n={box.n}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-lg bg-slate-50 border border-slate-200 p-3">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-gray-500">
                      Chromatin state values are curated reference scores based on ENCODE/Roadmap Epigenomics data for mouse liver. H3K4me3 (active promoters) and H3K27ac (active enhancers) marks reflect transcriptional accessibility. Correlation between |λ| and chromatin marks tests whether persistence is explained by epigenetic state.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="functional" className="space-y-4 mt-4">
            <Card className="bg-white border-gray-800">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-cyan-400" />
                  Unique Predictive Power
                </CardTitle>
                <CardDescription>
                  Which functional categories are identified by |λ| alone, network centrality alone, or both?
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="rounded-lg bg-cyan-950/20 border border-cyan-800/30 p-4">
                    <div className="text-sm font-medium text-cyan-400 mb-2">|λ| Only (high persistence, low network)</div>
                    <div className="space-y-1">
                      {data.functionalOverlap.eigenvalueOnly.length > 0 ? (
                        data.functionalOverlap.eigenvalueOnly.map(cat => (
                          <Badge key={cat} variant="outline" className="mr-1 mb-1 text-cyan-300 border-cyan-700 text-xs" data-testid={`badge-ev-only-${cat}`}>
                            {cat}
                          </Badge>
                        ))
                      ) : (
                        <p className="text-xs text-gray-500">No categories exclusive to high |λ|</p>
                      )}
                    </div>
                  </div>
                  <div className="rounded-lg bg-purple-950/20 border border-purple-800/30 p-4">
                    <div className="text-sm font-medium text-purple-400 mb-2">Shared (high persistence + high network)</div>
                    <div className="space-y-1">
                      {data.functionalOverlap.shared.length > 0 ? (
                        data.functionalOverlap.shared.map(cat => (
                          <Badge key={cat} variant="outline" className="mr-1 mb-1 text-purple-300 border-purple-700 text-xs" data-testid={`badge-shared-${cat}`}>
                            {cat}
                          </Badge>
                        ))
                      ) : (
                        <p className="text-xs text-gray-500">No shared categories</p>
                      )}
                    </div>
                  </div>
                  <div className="rounded-lg bg-amber-950/20 border border-amber-800/30 p-4">
                    <div className="text-sm font-medium text-amber-400 mb-2">Network Only (high network, low persistence)</div>
                    <div className="space-y-1">
                      {data.functionalOverlap.networkOnly.length > 0 ? (
                        data.functionalOverlap.networkOnly.map(cat => (
                          <Badge key={cat} variant="outline" className="mr-1 mb-1 text-amber-300 border-amber-700 text-xs" data-testid={`badge-net-only-${cat}`}>
                            {cat}
                          </Badge>
                        ))
                      ) : (
                        <p className="text-xs text-gray-500">No categories exclusive to high network degree</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.functionalOverlap.allCategories.slice(0, 20)}
                      layout="vertical"
                      margin={{ top: 5, right: 30, bottom: 5, left: 140 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis
                        type="number"
                        domain={[0, 1]}
                        tick={{ fill: '#64748b', fontSize: 11 }}
                        label={{ value: "Mean |λ|", position: "bottom", offset: -5, fill: "#64748b" }}
                      />
                      <YAxis
                        dataKey="category"
                        type="category"
                        width={135}
                        tick={{ fill: '#64748b', fontSize: 11 }}
                      />
                      <Tooltip
                        formatter={(value: number) => value.toFixed(4)}
                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                        labelStyle={{ color: '#e2e8f0' }}
                      />
                      <Bar dataKey="meanEigenvalue" name="Mean |λ|" radius={[0, 4, 4, 0]}>
                        {data.functionalOverlap.allCategories.slice(0, 20).map((entry, idx) => (
                          <Cell
                            key={idx}
                            fill={entry.clockGenes > entry.targetGenes ? '#3b82f6' : entry.targetGenes > entry.clockGenes ? '#f59e0b' : '#8b5cf6'}
                            fillOpacity={0.8}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex gap-4 mt-2 text-xs text-gray-500 justify-center">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500 inline-block" /> Clock-dominated</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500 inline-block" /> Target-dominated</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-purple-500 inline-block" /> Mixed</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="conservation" className="space-y-4 mt-4">
            <Card className="bg-white border-gray-800">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Dna className="w-5 h-5 text-rose-400" />
                  Cross-Tissue |λ| Conservation
                </CardTitle>
                <CardDescription>
                  Is the eigenvalue signature more conserved across tissues for clock genes than target genes?
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="rounded-lg bg-blue-950/20 border border-blue-800/30 p-4 text-center">
                    <div className="text-xs text-slate-500 mb-1">Clock Gene Mean CV</div>
                    <div className="text-2xl font-bold text-blue-400" data-testid="text-clock-cv">
                      {data.conservationSummary.clockMeanCV.toFixed(3)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-amber-950/20 border border-amber-800/30 p-4 text-center">
                    <div className="text-xs text-slate-500 mb-1">Target Gene Mean CV</div>
                    <div className="text-2xl font-bold text-amber-400" data-testid="text-target-cv">
                      {data.conservationSummary.targetMeanCV.toFixed(3)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 text-center">
                    <div className="text-xs text-slate-500 mb-1">Clock More Conserved?</div>
                    <div className={`text-2xl font-bold ${data.conservationSummary.clockMoreConserved ? 'text-emerald-400' : 'text-red-400'}`} data-testid="text-conserved">
                      {data.conservationSummary.clockMoreConserved ? 'Yes' : 'No'}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      CV ratio: {data.conservationSummary.conservationRatio}
                    </div>
                  </div>
                </div>

                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={filteredConservation}
                      margin={{ top: 10, right: 30, bottom: 40, left: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis
                        dataKey="gene"
                        tick={{ fill: '#64748b', fontSize: 10 }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                      />
                      <YAxis
                        yAxisId="left"
                        label={{ value: "Mean |λ|", angle: -90, position: "insideLeft", fill: "#64748b" }}
                        tick={{ fill: '#64748b' }}
                        domain={[0, 1]}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        label={{ value: "CV", angle: 90, position: "insideRight", fill: "#64748b" }}
                        tick={{ fill: '#64748b' }}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                        labelStyle={{ color: '#e2e8f0' }}
                      />
                      <Legend />
                      <Bar yAxisId="left" dataKey="mean" name="Mean |λ|" radius={[2, 2, 0, 0]}>
                        {filteredConservation.map((entry, idx) => (
                          <Cell
                            key={idx}
                            fill={highlightedSet.has(entry.gene) ? '#06b6d4' : entry.geneType === 'clock' ? '#3b82f6' : '#f59e0b'}
                            fillOpacity={hasHighlights ? (highlightedSet.has(entry.gene) ? 1 : 0.25) : 0.7}
                            stroke={highlightedSet.has(entry.gene) ? '#fff' : 'none'}
                            strokeWidth={highlightedSet.has(entry.gene) ? 2 : 0}
                          />
                        ))}
                      </Bar>
                      <Line yAxisId="right" type="monotone" dataKey="cv" name="CV (variability)" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444', r: 3 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm" data-testid="table-conservation">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className="text-left py-2 px-3 text-slate-500 font-medium">Gene</th>
                        <th className="text-left py-2 px-3 text-slate-500 font-medium">Type</th>
                        <th className="text-left py-2 px-3 text-slate-500 font-medium">Tissues</th>
                        <th className="text-right py-2 px-3 text-slate-500 font-medium">Mean |λ|</th>
                        <th className="text-right py-2 px-3 text-slate-500 font-medium">CV</th>
                        <th className="text-right py-2 px-3 text-slate-500 font-medium">Range</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredConservation.map(g => (
                        <tr key={g.gene} className={`border-b border-gray-800/50 ${highlightedSet.has(g.gene) ? 'bg-cyan-950/30 ring-1 ring-cyan-700/50' : 'hover:bg-slate-100/30'}`}>
                          <td className={`py-2 px-3 font-medium ${highlightedSet.has(g.gene) ? 'text-cyan-300' : 'text-slate-900'}`}><GeneTooltip gene={g.gene}>{g.gene}</GeneTooltip></td>
                          <td className="py-2 px-3">
                            <Badge variant="outline" className={g.geneType === 'clock' ? 'text-blue-400 border-blue-800' : 'text-amber-400 border-amber-800'}>
                              {g.geneType}
                            </Badge>
                          </td>
                          <td className="py-2 px-3 text-slate-500 text-xs">{g.tissues.join(', ')}</td>
                          <td className="py-2 px-3 text-right font-mono text-cyan-400">{g.mean.toFixed(4)}</td>
                          <td className="py-2 px-3 text-right font-mono text-slate-600">{g.cv.toFixed(4)}</td>
                          <td className="py-2 px-3 text-right font-mono text-slate-500">{g.range.toFixed(4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rootspace" className="space-y-4 mt-4">
            <Card className="bg-white border-gray-800">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <GitCompare className="w-5 h-5 text-cyan-400" />
                  Root-Space Position vs External Metrics
                </CardTitle>
                <CardDescription>
                  Do genes that cluster together in AR(2) root space also cluster by network degree, amplitude, or chromatin state?
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-cyan-500 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-slate-500">
                      Each dot is a gene plotted by its AR(2) coefficients (φ₁, φ₂). The position in this space determines the gene's dynamical behavior — this is the same coordinate system used in the Root-Space Geometry and Waddington Landscape pages. Use the color selector to overlay different external metrics and see whether root-space position predicts network connectivity, oscillation amplitude, or chromatin accessibility.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 flex-wrap">
                  <span className="text-sm text-slate-500">Color by:</span>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { value: 'geneType' as const, label: 'Gene Type', bg: 'bg-blue-600', ring: 'ring-blue-400' },
                      { value: 'dynamicalMode' as const, label: 'Dynamical Mode', bg: 'bg-rose-600', ring: 'ring-rose-400' },
                      { value: 'networkDegree' as const, label: 'Network Degree', bg: 'bg-emerald-600', ring: 'ring-emerald-400' },
                      { value: 'amplitude' as const, label: 'Amplitude', bg: 'bg-amber-600', ring: 'ring-amber-400' },
                      { value: 'chromatin' as const, label: 'Chromatin', bg: 'bg-purple-600', ring: 'ring-purple-400' },
                    ].map(opt => (
                      <Button
                        key={opt.value}
                        variant={rootSpaceColorBy === opt.value ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setRootSpaceColorBy(opt.value)}
                        className={rootSpaceColorBy === opt.value
                          ? `${opt.bg} text-slate-900 ring-2 ${opt.ring} font-semibold`
                          : 'border-slate-200 text-slate-500 hover:text-slate-700 hover:border-gray-500'}
                        data-testid={`btn-color-${opt.value}`}
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                  <label className="flex items-center gap-2 text-sm text-slate-500 cursor-pointer ml-2">
                    <input
                      type="checkbox"
                      checked={showBoundary}
                      onChange={(e) => setShowBoundary(e.target.checked)}
                      className="rounded border-slate-300 bg-slate-100 text-amber-500 focus:ring-amber-500"
                      data-testid="toggle-boundary"
                    />
                    Show boundary
                  </label>
                </div>

                {data.rootSpaceCorrespondence && (
                  <>
                    <div className="h-[500px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{ top: 20, right: 30, bottom: 40, left: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                          <XAxis
                            dataKey="phi1"
                            type="number"
                            name="φ₁"
                            domain={[-1.5, 2]}
                            label={{ value: "φ₁ (AR(2) coefficient 1)", position: "bottom", offset: 20, fill: "#64748b" }}
                            tick={{ fill: '#64748b' }}
                          />
                          <YAxis
                            dataKey="phi2"
                            type="number"
                            name="φ₂"
                            domain={[-1, 0.5]}
                            label={{ value: "φ₂ (AR(2) coefficient 2)", angle: -90, position: "insideLeft", offset: -5, fill: "#64748b" }}
                            tick={{ fill: '#64748b' }}
                          />
                          <Tooltip
                            content={({ active, payload }: any) => {
                              if (!active || !payload?.length) return null;
                              const d = payload[0].payload;
                              return (
                                <div className="bg-white border border-slate-200 rounded-lg p-3 text-sm shadow-xl">
                                  <div className="font-bold text-slate-900"><GeneTooltip gene={d.gene}>{d.gene}</GeneTooltip></div>
                                  <div className="text-slate-500 capitalize">{d.geneType} gene - {d.tissue}</div>
                                  <div className={`text-xs font-medium mt-1 ${d.isComplex ? 'text-rose-400' : 'text-sky-400'}`}>
                                    {d.isComplex ? 'Oscillatory (complex roots)' : 'Overdamped (real roots)'}
                                  </div>
                                  <div className="mt-1 space-y-0.5">
                                    <div className="text-cyan-300">φ₁ = {d.phi1}, φ₂ = {d.phi2}</div>
                                    <div className="text-blue-300">|λ| = {d.eigenvalue?.toFixed(4)}</div>
                                    {d.networkDegree !== null && <div className="text-emerald-300">Network = {d.networkDegree}</div>}
                                    <div className="text-amber-300">Amplitude = {d.amplitude?.toFixed(4)}</div>
                                    {d.chromatinState && <div className="text-purple-300">Chromatin: {d.chromatinState}</div>}
                                  </div>
                                </div>
                              );
                            }}
                          />
                          <Legend />
                          {rootSpaceColorBy === 'geneType' && (
                            <>
                              <Scatter
                                name="Clock genes"
                                data={data.rootSpaceCorrespondence.points.filter(p => p.geneType === 'clock' && !highlightedSet.has(p.gene))}
                                fill="#3b82f6"
                                fillOpacity={hasHighlights ? 0.2 : 0.7}
                                r={hasHighlights ? 4 : 6}
                              />
                              <Scatter
                                name="Target genes"
                                data={data.rootSpaceCorrespondence.points.filter(p => p.geneType === 'target' && !highlightedSet.has(p.gene))}
                                fill="#f59e0b"
                                fillOpacity={hasHighlights ? 0.2 : 0.7}
                                r={hasHighlights ? 4 : 6}
                              />
                            </>
                          )}
                          {rootSpaceColorBy === 'networkDegree' && (
                            <>
                              <Scatter
                                name="Low degree (<100)"
                                data={data.rootSpaceCorrespondence.points.filter(p => (p.networkDegree ?? 0) < 100 && !highlightedSet.has(p.gene))}
                                fill="#22c55e"
                                fillOpacity={hasHighlights ? 0.2 : 0.6}
                                r={hasHighlights ? 4 : 6}
                              />
                              <Scatter
                                name="Mid degree (100-200)"
                                data={data.rootSpaceCorrespondence.points.filter(p => (p.networkDegree ?? 0) >= 100 && (p.networkDegree ?? 0) < 200 && !highlightedSet.has(p.gene))}
                                fill="#eab308"
                                fillOpacity={hasHighlights ? 0.2 : 0.6}
                                r={hasHighlights ? 4 : 6}
                              />
                              <Scatter
                                name="High degree (200+)"
                                data={data.rootSpaceCorrespondence.points.filter(p => (p.networkDegree ?? 0) >= 200 && !highlightedSet.has(p.gene))}
                                fill="#ef4444"
                                fillOpacity={hasHighlights ? 0.2 : 0.6}
                                r={hasHighlights ? 4 : 6}
                              />
                            </>
                          )}
                          {rootSpaceColorBy === 'amplitude' && (
                            <>
                              <Scatter
                                name="Low amplitude (<20)"
                                data={data.rootSpaceCorrespondence.points.filter(p => p.amplitude < 20 && !highlightedSet.has(p.gene))}
                                fill="#64748b"
                                fillOpacity={hasHighlights ? 0.2 : 0.7}
                                r={hasHighlights ? 4 : 6}
                              />
                              <Scatter
                                name="Mid amplitude (20-100)"
                                data={data.rootSpaceCorrespondence.points.filter(p => p.amplitude >= 20 && p.amplitude < 100 && !highlightedSet.has(p.gene))}
                                fill="#f59e0b"
                                fillOpacity={hasHighlights ? 0.2 : 0.7}
                                r={hasHighlights ? 4 : 6}
                              />
                              <Scatter
                                name="High amplitude (100+)"
                                data={data.rootSpaceCorrespondence.points.filter(p => p.amplitude >= 100 && !highlightedSet.has(p.gene))}
                                fill="#dc2626"
                                fillOpacity={hasHighlights ? 0.2 : 0.7}
                                r={hasHighlights ? 4 : 6}
                              />
                            </>
                          )}
                          {rootSpaceColorBy === 'chromatin' && (
                            <>
                              <Scatter
                                name="Active"
                                data={data.rootSpaceCorrespondence.points.filter(p => p.chromatinState === 'Active' && !highlightedSet.has(p.gene))}
                                fill="#a855f7"
                                fillOpacity={hasHighlights ? 0.2 : 0.6}
                                r={hasHighlights ? 4 : 6}
                              />
                              <Scatter
                                name="Poised"
                                data={data.rootSpaceCorrespondence.points.filter(p => p.chromatinState === 'Poised' && !highlightedSet.has(p.gene))}
                                fill="#06b6d4"
                                fillOpacity={hasHighlights ? 0.2 : 0.6}
                                r={hasHighlights ? 4 : 6}
                              />
                            </>
                          )}
                          {rootSpaceColorBy === 'dynamicalMode' && (
                            <>
                              <Scatter
                                name="Oscillatory (complex roots)"
                                data={data.rootSpaceCorrespondence.points.filter(p => p.isComplex && !highlightedSet.has(p.gene))}
                                fill="#f43f5e"
                                fillOpacity={hasHighlights ? 0.2 : 0.7}
                                r={hasHighlights ? 4 : 6}
                              />
                              <Scatter
                                name="Overdamped (real roots)"
                                data={data.rootSpaceCorrespondence.points.filter(p => !p.isComplex && !highlightedSet.has(p.gene))}
                                fill="#38bdf8"
                                fillOpacity={hasHighlights ? 0.2 : 0.7}
                                r={hasHighlights ? 4 : 6}
                              />
                            </>
                          )}
                          {showBoundary && (
                            <Scatter
                              name="Discriminant boundary (φ₂ = -φ₁²/4)"
                              data={boundaryLine}
                              fill="none"
                              line={{ stroke: '#fbbf24', strokeWidth: 2, strokeDasharray: '6 3' }}
                              lineType="joint"
                              r={0}
                              legendType="line"
                            />
                          )}
                          {hasHighlights && (
                            <Scatter
                              name="Selected genes"
                              data={data.rootSpaceCorrespondence.points.filter(p => highlightedSet.has(p.gene))}
                              fill="#06b6d4"
                              fillOpacity={1}
                              r={10}
                              shape={(props: any) => {
                                const { cx, cy, payload } = props;
                                return (
                                  <g>
                                    <circle cx={cx} cy={cy} r={10} fill="#06b6d4" stroke="#fff" strokeWidth={2} />
                                    <text x={cx} y={cy - 14} textAnchor="middle" fill="#e2e8f0" fontSize={11} fontWeight="bold">
                                      {payload.gene}
                                    </text>
                                  </g>
                                );
                              }}
                            />
                          )}
                        </ScatterChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card className="bg-white border-gray-800">
                        <CardContent className="pt-4 pb-4">
                          <div className="text-sm font-medium text-slate-900 mb-3">Root-Space Position vs External Metrics</div>
                          <div className="space-y-2 text-xs">
                            {data.rootSpaceCorrespondence.correlations.r_vs_networkDegree && (
                              <div className="flex justify-between items-center">
                                <span className="text-slate-500">|r| (radius) vs Network Degree</span>
                                <span className={`font-mono ${strengthLabel(data.rootSpaceCorrespondence.correlations.r_vs_networkDegree.rho).color}`}>
                                  ρ = {data.rootSpaceCorrespondence.correlations.r_vs_networkDegree.rho.toFixed(3)}
                                </span>
                              </div>
                            )}
                            {data.rootSpaceCorrespondence.correlations.theta_vs_networkDegree && (
                              <div className="flex justify-between items-center">
                                <span className="text-slate-500">θ (angle) vs Network Degree</span>
                                <span className={`font-mono ${strengthLabel(data.rootSpaceCorrespondence.correlations.theta_vs_networkDegree.rho).color}`}>
                                  ρ = {data.rootSpaceCorrespondence.correlations.theta_vs_networkDegree.rho.toFixed(3)}
                                </span>
                              </div>
                            )}
                            {data.rootSpaceCorrespondence.correlations.r_vs_amplitude && (
                              <div className="flex justify-between items-center">
                                <span className="text-slate-500">|r| (radius) vs Amplitude</span>
                                <span className={`font-mono ${strengthLabel(data.rootSpaceCorrespondence.correlations.r_vs_amplitude.rho).color}`}>
                                  ρ = {data.rootSpaceCorrespondence.correlations.r_vs_amplitude.rho.toFixed(3)}
                                </span>
                              </div>
                            )}
                            {data.rootSpaceCorrespondence.correlations.theta_vs_amplitude && (
                              <div className="flex justify-between items-center">
                                <span className="text-slate-500">θ (angle) vs Amplitude</span>
                                <span className={`font-mono ${strengthLabel(data.rootSpaceCorrespondence.correlations.theta_vs_amplitude.rho).color}`}>
                                  ρ = {data.rootSpaceCorrespondence.correlations.theta_vs_amplitude.rho.toFixed(3)}
                                </span>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="bg-white border-gray-800">
                        <CardContent className="pt-4 pb-4">
                          <div className="text-sm font-medium text-slate-900 mb-3">What This Tells Us</div>
                          <div className="text-xs text-slate-500 space-y-2">
                            <p>
                              If genes with high network degree clustered in one region of root space and low-degree genes in another, it would mean root-space position is redundant with network topology. Instead, the scatter shows that genes of different network connectivity are <strong className="text-slate-900">distributed across root space</strong> — meaning the landscape captures something structurally different.
                            </p>
                            <p>
                              The same logic applies to amplitude and chromatin: root-space position is not predictable from these established metrics, confirming the landscape reflects an independent biological property — temporal persistence dynamics.
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {dampingChartData && (<>
                      <Card className="bg-white border-gray-800" data-testid="card-damping-frequency">
                        <CardContent className="pt-4 pb-4">
                          <div className="text-sm font-medium text-slate-900 mb-3 flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-violet-500" />
                            Damping Rate vs Natural Period (Oscillatory Genes Only)
                          </div>
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div className="h-[420px]">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-[10px] text-gray-500">Color by:</span>
                                <button
                                  onClick={() => setDampingColorBy('geneType')}
                                  className={`text-[10px] px-2 py-0.5 rounded ${dampingColorBy === 'geneType' ? 'bg-cyan-900/50 text-cyan-300 border border-cyan-700/50' : 'text-gray-500 hover:text-slate-600'}`}
                                  data-testid="btn-damping-color-genetype"
                                >Gene Type</button>
                                <button
                                  onClick={() => setDampingColorBy('function')}
                                  className={`text-[10px] px-2 py-0.5 rounded ${dampingColorBy === 'function' ? 'bg-cyan-900/50 text-cyan-300 border border-cyan-700/50' : 'text-gray-500 hover:text-slate-600'}`}
                                  data-testid="btn-damping-color-function"
                                >Function</button>
                              </div>
                              <ResponsiveContainer width="100%" height="90%">
                                <ScatterChart margin={{ top: 10, right: 20, bottom: 40, left: 50 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                  <XAxis
                                    type="number" dataKey="dampingRate" name="Damping Rate"
                                    domain={[0, 'auto']}
                                    label={{ value: 'Damping Rate (-ln r)', position: 'bottom', offset: 20, fill: '#6b7280', fontSize: 11 }}
                                    stroke="#4b5563" tick={{ fill: '#6b7280', fontSize: 10 }}
                                  />
                                  <YAxis
                                    type="number" dataKey="naturalPeriod" name="Natural Period"
                                    domain={[0, 'auto']}
                                    label={{ value: 'Natural Period (hours)', angle: -90, position: 'insideLeft', offset: -35, fill: '#6b7280', fontSize: 11 }}
                                    stroke="#4b5563" tick={{ fill: '#6b7280', fontSize: 10 }}
                                  />
                                  <ReferenceArea x1={0} x2={0.5} y1={20} y2={28} fill="#22c55e" fillOpacity={0.08} stroke="#22c55e" strokeOpacity={0.2} strokeDasharray="4 4" />
                                  <ReferenceLine y={24} stroke="#facc15" strokeDasharray="6 3" strokeOpacity={0.5} label={{ value: '24h', position: 'right', fill: '#ca8a04', fontSize: 9 }} />
                                  <Tooltip
                                    content={({ payload }: any) => {
                                      if (!payload?.[0]) return null;
                                      const d = payload[0].payload;
                                      return (
                                        <div className="bg-white border border-slate-200 rounded p-2 text-xs shadow-lg">
                                          <div className="font-medium text-slate-900"><GeneTooltip gene={d.gene}>{d.gene}</GeneTooltip></div>
                                          <div className="text-slate-500">{d.tissue} · {d.geneType} · {d.primaryCategory || 'Other'}</div>
                                          <div className="mt-1 space-y-0.5">
                                            <div>Damping rate: <span className="text-violet-400">{d.dampingRate?.toFixed(3)}</span></div>
                                            <div>Natural period: <span className="text-cyan-400">{d.naturalPeriod?.toFixed(1)}h</span></div>
                                            <div>Damping ratio: <span className="text-amber-400">{d.dampingRatio?.toFixed(3)}</span></div>
                                            <div>|λ|: <span className="text-emerald-400">{d.eigenvalue?.toFixed(3)}</span></div>
                                          </div>
                                        </div>
                                      );
                                    }}
                                  />
                                  {dampingColorBy === 'geneType' && (
                                    <Scatter name="Clock" data={dampingChartData.clockOsc} fill="#f97316" fillOpacity={0.7} />
                                  )}
                                  {dampingColorBy === 'geneType' && (
                                    <Scatter name="Target" data={dampingChartData.targetOsc} fill="#6366f1" fillOpacity={0.7} />
                                  )}
                                  {dampingColorBy === 'function' && Object.entries(dampingChartData.categorizedPoints).sort(([a], [b]) => a.localeCompare(b)).map(([cat, pts]) => (
                                    <Scatter key={cat} name={cat} data={pts} fill={dampingChartData.CATEGORY_COLORS[cat] || '#6b7280'} fillOpacity={0.8} />
                                  ))}
                                  <Legend
                                    verticalAlign="top" align="right" iconSize={8}
                                    wrapperStyle={{ fontSize: '10px', color: '#6b7280' }}
                                  />
                                </ScatterChart>
                              </ResponsiveContainer>
                            </div>
                            <div className="space-y-3">
                              <div className="bg-slate-50 rounded-lg p-3">
                                <div className="text-xs text-slate-500 mb-2 font-medium">Mean Values (Oscillatory Genes)</div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <div className="text-orange-400 font-semibold text-sm">Clock ({dampingChartData.clockOsc.length})</div>
                                    <div className="text-xs text-gray-500 mt-1">
                                      Damping: <span className="text-violet-400 font-mono">{dampingChartData.clockDamping.toFixed(3)}</span>
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      Period: <span className="text-cyan-400 font-mono">{dampingChartData.clockPeriod.toFixed(1)}h</span>
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-indigo-400 font-semibold text-sm">Target ({dampingChartData.targetOsc.length})</div>
                                    <div className="text-xs text-gray-500 mt-1">
                                      Damping: <span className="text-violet-400 font-mono">{dampingChartData.targetDamping.toFixed(3)}</span>
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      Period: <span className="text-cyan-400 font-mono">{dampingChartData.targetPeriod.toFixed(1)}h</span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {dampingChartData.resonanceGenes.length > 0 && (
                                <div className="bg-emerald-900/20 border border-emerald-800/30 rounded-lg p-3">
                                  <div className="text-xs text-emerald-400 mb-1 font-medium">Resonance Zone (20–28h, low damping)</div>
                                  <div className="text-[11px] text-slate-500">
                                    {dampingChartData.resonanceGenes.length} gene measurements near circadian frequency with slow decay:
                                  </div>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {Array.from(new Set(dampingChartData.resonanceGenes.map((g: any) => g.gene))).sort().map((gene: string) => {
                                      const g = dampingChartData.resonanceGenes.find((p: any) => p.gene === gene);
                                      return (
                                        <span key={gene} className={`text-[10px] px-1.5 py-0.5 rounded ${g?.geneType === 'clock' ? 'bg-orange-900/30 text-orange-300' : 'bg-indigo-900/30 text-indigo-300'}`}>
                                          {gene}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}


                              {dampingChartData.dfCorr && (
                                <div className="bg-slate-50 rounded-lg p-3">
                                  <div className="text-xs text-slate-500 mb-1 font-medium">Damping–Period Correlation</div>
                                  <div className="text-xs text-gray-500">
                                    ρ = <span className={`font-mono ${strengthLabel(dampingChartData.dfCorr.rho).color}`}>{dampingChartData.dfCorr.rho.toFixed(3)}</span>
                                    {' '}(p = {dampingChartData.dfCorr.pValue < 0.001 ? dampingChartData.dfCorr.pValue.toExponential(1) : dampingChartData.dfCorr.pValue.toFixed(3)}, n = {dampingChartData.dfCorr.n})
                                  </div>
                                  <div className="text-xs text-gray-600 mt-1">
                                    {Math.abs(dampingChartData.dfCorr.rho) < 0.3
                                      ? 'Weak correlation — damping and frequency are largely independent dimensions.'
                                      : Math.abs(dampingChartData.dfCorr.rho) < 0.6
                                      ? 'Moderate correlation — some coupling between damping and frequency.'
                                      : 'Strong correlation — damping and frequency are linked.'}
                                  </div>
                                </div>
                              )}
                              <div className="text-xs text-slate-500 space-y-2">
                                <p>
                                  For oscillatory genes, the AR(2) complex roots decompose into two independent parameters:
                                  <strong className="text-violet-400"> damping rate</strong> (-ln r, how fast oscillations decay) and
                                  <strong className="text-cyan-400"> natural period</strong> (2π/θ × Δt, the oscillation cycle length in hours).
                                </p>
                                <p>
                                  The <strong className="text-emerald-400">green resonance zone</strong> highlights genes near the 24h circadian frequency with slow damping — these are biologically primed to respond to circadian signals. The <strong className="text-amber-400">yellow dashed line</strong> marks exactly 24 hours. Use the color toggle to switch between gene type and functional category views.
                                </p>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="bg-emerald-950/30 border-emerald-800/50" data-testid="card-resonance-scan">
                            <CardContent className="pt-4 pb-4">
                              <div className="text-sm font-medium text-slate-900 mb-3 flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                                Genome-Wide Resonance Zone Scan
                                <Badge className="bg-emerald-900/50 text-emerald-400 text-[10px] ml-2">All Genes</Badge>
                              </div>
                              <div className="text-xs text-gray-500 mb-3">
                                Runs AR(2) on every gene in the dataset, then identifies which ones land in the circadian resonance zone (20–28h natural period, low damping &lt; 0.5). These genes are biologically tuned to sustain ~24h oscillations.
                              </div>
                              <div className="flex flex-wrap gap-1 mb-4">
                                {SCAN_DATASETS.map(d => (
                                  <button
                                    key={d.value}
                                    onClick={() => setScanDataset(d.value)}
                                    className={`text-[10px] px-2 py-1 rounded transition-colors ${scanDataset === d.value ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-700/50' : 'text-gray-500 hover:text-slate-600 border border-transparent'}`}
                                    data-testid={`btn-scan-${d.value}`}
                                  >{d.label}</button>
                                ))}
                              </div>

                              {scanLoading && (
                                <div className="flex items-center justify-center py-8 gap-3">
                                  <div className="animate-spin w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full" />
                                  <span className="text-slate-500 text-sm">Scanning all genes (~20K)...</span>
                                </div>
                              )}

                              {scanData && (
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div className="bg-slate-50 rounded-lg p-3 text-center">
                                      <div className="text-slate-900 font-semibold text-lg">{scanData.totalGenes?.toLocaleString()}</div>
                                      <div className="text-gray-500 text-[10px]">Total genes</div>
                                    </div>
                                    <div className="bg-slate-50 rounded-lg p-3 text-center">
                                      <div className="text-rose-400 font-semibold text-lg">{scanData.oscillatoryGenes?.toLocaleString()}</div>
                                      <div className="text-gray-500 text-[10px]">Oscillatory</div>
                                    </div>
                                    <div className="bg-emerald-900/30 rounded-lg p-3 text-center border border-emerald-800/30">
                                      <div className="text-emerald-400 font-semibold text-lg">{scanData.resonanceZone?.count}</div>
                                      <div className="text-gray-500 text-[10px]">In resonance zone</div>
                                    </div>
                                    <div className="bg-slate-50 rounded-lg p-3 text-center">
                                      <div className="text-amber-400 font-semibold text-lg">{scanData.stats?.resonancePct}%</div>
                                      <div className="text-gray-500 text-[10px]">Of oscillatory genes</div>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    <div className="h-[350px]">
                                      <div className="text-[10px] text-slate-500 mb-1">All oscillatory genes — resonance zone highlighted</div>
                                      <ResponsiveContainer width="100%" height="95%">
                                        <ScatterChart margin={{ top: 5, right: 15, bottom: 35, left: 45 }}>
                                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                          <XAxis type="number" dataKey="dampingRate" domain={[0, 'auto']} stroke="#4b5563" tick={{ fill: '#6b7280', fontSize: 9 }} label={{ value: 'Damping Rate', position: 'bottom', offset: 18, fill: '#6b7280', fontSize: 10 }} />
                                          <YAxis type="number" dataKey="naturalPeriod" domain={[0, 'auto']} stroke="#4b5563" tick={{ fill: '#6b7280', fontSize: 9 }} label={{ value: 'Natural Period (h)', angle: -90, position: 'insideLeft', offset: -30, fill: '#6b7280', fontSize: 10 }} />
                                          <ReferenceArea x1={0} x2={0.5} y1={20} y2={28} fill="#22c55e" fillOpacity={0.12} stroke="#22c55e" strokeOpacity={0.3} strokeDasharray="4 4" />
                                          <ReferenceLine y={24} stroke="#facc15" strokeDasharray="6 3" strokeOpacity={0.5} label={{ value: '24h', position: 'right', fill: '#ca8a04', fontSize: 9 }} />
                                          <Tooltip content={({ payload }: any) => {
                                            if (!payload?.[0]) return null;
                                            const d = payload[0].payload;
                                            return (
                                              <div className="bg-white border border-slate-200 rounded p-2 text-xs shadow-lg">
                                                <div className="font-medium text-slate-900"><GeneTooltip gene={d.gene}>{d.gene}</GeneTooltip></div>
                                                <div className="text-slate-500">{d.geneType} · {d.classification}</div>
                                                <div className="mt-1 space-y-0.5">
                                                  <div>Damping: <span className="text-violet-400">{d.dampingRate?.toFixed(3)}</span></div>
                                                  <div>Period: <span className="text-cyan-400">{d.naturalPeriod?.toFixed(1)}h</span></div>
                                                  <div>|λ|: <span className="text-emerald-400">{d.eigenvalue?.toFixed(3)}</span></div>
                                                </div>
                                              </div>
                                            );
                                          }} />
                                          <Scatter name="Background" data={scanData.allOscillatory?.filter((p: any) => !(p.naturalPeriod >= 20 && p.naturalPeriod <= 28 && p.dampingRate < 0.5))} fill="#374151" fillOpacity={0.3} />
                                          <Scatter name="Resonance zone" data={scanData.resonanceZone?.genes} fill="#22c55e" fillOpacity={0.8} />
                                          <Legend verticalAlign="top" align="right" iconSize={8} wrapperStyle={{ fontSize: '10px', color: '#6b7280' }} />
                                        </ScatterChart>
                                      </ResponsiveContainer>
                                    </div>

                                    <div>
                                      <div className="flex items-center gap-2 mb-2">
                                        <div className="text-[10px] text-slate-500">Sort by:</div>
                                        {(['dampingRate', 'naturalPeriod', 'eigenvalue'] as const).map(s => (
                                          <button key={s} onClick={() => setScanSort(s)} className={`text-[10px] px-2 py-0.5 rounded ${scanSort === s ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-700/50' : 'text-gray-500 hover:text-slate-600'}`} data-testid={`btn-sort-${s}`}>
                                            {s === 'dampingRate' ? 'Lowest damping' : s === 'naturalPeriod' ? 'Nearest 24h' : 'Highest |λ|'}
                                          </button>
                                        ))}
                                      </div>
                                      <div className="max-h-[310px] overflow-y-auto border border-gray-800 rounded-lg">
                                        <table className="w-full text-[10px]" data-testid="table-resonance-genes">
                                          <thead className="sticky top-0 bg-white">
                                            <tr className="border-b border-slate-200">
                                              <th className="text-left text-slate-500 py-1.5 px-2 font-medium">Gene</th>
                                              <th className="text-center text-slate-500 py-1.5 px-2 font-medium">Type</th>
                                              <th className="text-right text-slate-500 py-1.5 px-2 font-medium">Period</th>
                                              <th className="text-right text-slate-500 py-1.5 px-2 font-medium">Damping</th>
                                              <th className="text-right text-slate-500 py-1.5 px-2 font-medium">|λ|</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-gray-800/50">
                                            {sortedResonance.slice(0, 100).map((g: any, i: number) => (
                                              <tr key={`${g.gene}-${i}`} className="hover:bg-slate-100/30">
                                                <td className="py-1 px-2 text-slate-900 font-medium"><GeneTooltip gene={g.gene}>{g.gene}</GeneTooltip></td>
                                                <td className="py-1 px-2 text-center">
                                                  <span className={`px-1 py-0.5 rounded text-[9px] ${g.geneType === 'clock' ? 'bg-orange-900/30 text-orange-300' : g.geneType === 'target' ? 'bg-indigo-900/30 text-indigo-300' : 'bg-slate-200/50 text-slate-500'}`}>{g.geneType}</span>
                                                </td>
                                                <td className="py-1 px-2 text-right text-cyan-400 font-mono">{g.naturalPeriod}h</td>
                                                <td className="py-1 px-2 text-right text-violet-400 font-mono">{g.dampingRate?.toFixed(3)}</td>
                                                <td className="py-1 px-2 text-right text-emerald-400 font-mono">{g.eigenvalue?.toFixed(3)}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                      {sortedResonance.length > 100 && (
                                        <div className="text-[10px] text-gray-600 mt-1 text-center">Showing first 100 of {sortedResonance.length} genes</div>
                                      )}
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-3 gap-2 text-[10px]">
                                    <div className="bg-orange-900/20 rounded p-2 text-center">
                                      <div className="text-orange-400 font-semibold">{scanData.stats?.clockInResonance || 0}</div>
                                      <div className="text-gray-500">Clock genes</div>
                                    </div>
                                    <div className="bg-indigo-900/20 rounded p-2 text-center">
                                      <div className="text-indigo-400 font-semibold">{scanData.stats?.targetInResonance || 0}</div>
                                      <div className="text-gray-500">Target genes</div>
                                    </div>
                                    <div className="bg-slate-50 rounded p-2 text-center">
                                      <div className="text-slate-600 font-semibold">{scanData.stats?.otherInResonance || 0}</div>
                                      <div className="text-gray-500">Novel / other</div>
                                    </div>
                                  </div>

                                  <div className="p-2 bg-slate-100/40 rounded text-[10px] text-gray-500 leading-relaxed">
                                    <strong className="text-slate-500">What this tells you:</strong> Out of {scanData.totalGenes?.toLocaleString()} genes, {scanData.resonanceZone?.count} ({scanData.stats?.resonancePct}% of oscillatory) have natural periods near 24 hours AND slow damping. These genes sustain circadian-frequency oscillations — they don't just oscillate, they oscillate at the right speed for day/night biology. The "novel / other" genes are ones not in the curated clock/target panel, making them potential new discoveries.
                                  </div>
                                </div>
                              )}
                            </CardContent>
                      </Card>

                      <Card className="bg-white border-gray-800" data-testid="card-dynamical-mode">
                        <CardContent className="pt-4 pb-4">
                          <div className="text-sm font-medium text-slate-900 mb-3 flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-rose-500" />
                            Oscillatory vs Overdamped Classification
                          </div>
                          {(() => { const dms = dynamicalModeStats!; return (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between bg-slate-50 rounded-lg p-3">
                                <div>
                                  <div className="text-rose-400 font-semibold text-lg">{dms.oscillatory}</div>
                                  <div className="text-slate-500 text-xs">Oscillatory ({dms.oscPct}%)</div>
                                </div>
                                <div className="text-xs text-gray-500 text-right">
                                  <div>{dms.oscClock} clock, {dms.oscTarget} target</div>
                                  <div className="text-gray-600 mt-0.5">Complex conjugate roots</div>
                                </div>
                              </div>
                              <div className="flex items-center justify-between bg-slate-50 rounded-lg p-3">
                                <div>
                                  <div className="text-sky-400 font-semibold text-lg">{dms.overdamped}</div>
                                  <div className="text-slate-500 text-xs">Overdamped ({dms.odPct}%)</div>
                                </div>
                                <div className="text-xs text-gray-500 text-right">
                                  <div>{dms.odClock} clock, {dms.odTarget} target</div>
                                  <div className="text-gray-600 mt-0.5">Real roots</div>
                                </div>
                              </div>
                            </div>
                            <div className="text-xs text-slate-500 space-y-2">
                              <p>
                                The dashed yellow parabola (φ₂ = -φ₁²/4) is the <strong className="text-amber-400">discriminant boundary</strong> from the AR(2) characteristic equation. It separates two fundamentally different types of temporal dynamics:
                              </p>
                              <p>
                                <strong className="text-rose-400">Above the boundary</strong> — oscillatory dynamics (complex conjugate roots). Expression overshoots and rings before settling.
                              </p>
                              <p>
                                <strong className="text-sky-400">Below the boundary</strong> — overdamped dynamics (real roots). Expression decays smoothly back to baseline without ringing.
                              </p>
                              <p className="bg-slate-100/60 rounded p-2 border border-slate-200">
                                In this dataset: <strong className="text-rose-400">{dms.clockOscPct}% of clock gene measurements</strong> are oscillatory vs <strong className="text-sky-400">{dms.targetOscPct}% of target gene measurements</strong>. The discriminant boundary naturally separates clock from target behavior — clock genes overwhelmingly sit in the oscillatory region while target genes spread across both.
                              </p>
                            </div>
                          </div>
                          ); })()}
                        </CardContent>
                      </Card>
                    </>)}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Card className="bg-white border-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-slate-500">Data Sources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-500">
              {Object.entries(data.dataSources).map(([key, value]) => (
                <div key={key} className="flex gap-2">
                  <span className="text-slate-500 capitalize font-medium">{key}:</span>
                  <span>{value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
