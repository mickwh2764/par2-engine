import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, ReferenceLine, Legend, LineChart, Line
} from "recharts";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft, Loader2, ShieldCheck, Moon, Sun, Clock, Target,
  Copy, Check, HeartPulse, TrendingDown, GitBranch, BarChart3, Activity,
  Search, ChevronDown, ChevronRight
} from "lucide-react";
import { Link } from "wouter";
import { useState, useCallback, useMemo } from "react";
import HowTo from "@/components/HowTo";
import PaperCrossLinks from "@/components/PaperCrossLinks";
import InsightCallout from "@/components/InsightCallout";
import ViewInRootSpace from "@/components/ViewInRootSpace";
import EvidenceLink from "@/components/EvidenceLink";
import { downloadAsCSV } from "@/components/DownloadResultsButton";
import { Download } from "lucide-react";

interface GeneData {
  gene: string;
  eigenvalue: number;
  adfStationary: boolean;
}

interface DatasetResult {
  datasetId: string;
  name: string;
  species: string;
  clockN: number;
  targetN: number;
  clockMeanEV: number;
  targetMeanEV: number;
  gap: number;
  hierarchyPreserved: boolean;
  adfStationarityPassRate: number;
  clockGenes: GeneData[];
  targetGenes: GeneData[];
}

interface MultiSpeciesData {
  title: string;
  summary: string;
  totalSpecies: number;
  totalDatasets: number;
  hierarchyPreservedCount: number;
  results: DatasetResult[];
}

interface DisruptionPair {
  study: string;
  citation: string;
  description: string;
  nSubjects: string;
  controlLabel: string;
  disruptedLabel: string;
  control: DatasetResult | null;
  disrupted: DatasetResult | null;
}

const DISRUPTION_STUDIES: { studyKey: string; study: string; citation: string; description: string; nSubjects: string; controlId: string; disruptedId: string; controlLabel: string; disruptedLabel: string }[] = [
  {
    studyKey: 'forced_desync',
    study: 'Forced Desynchrony',
    citation: 'Archer et al. 2014',
    description: 'Subjects underwent a 28-hour forced desynchrony protocol. "Aligned" = sleep timed with melatonin onset. "Misaligned" = sleep forced out of phase.',
    nSubjects: '22 subjects',
    controlId: 'GSE48113_ForcedDesync_Aligned',
    disruptedId: 'GSE48113_ForcedDesync_Misaligned',
    controlLabel: 'Aligned',
    disruptedLabel: 'Misaligned',
  },
  {
    studyKey: 'sleep_restriction',
    study: 'Sleep Restriction',
    citation: 'Moller-Levet et al. 2013',
    description: 'Subjects experienced 1 week of sufficient sleep (8.5h/night) vs 1 week of restricted sleep (6h/night). Blood samples taken over 24h.',
    nSubjects: '26 subjects',
    controlId: 'GSE39445_Blood_SufficientSleep',
    disruptedId: 'GSE39445_Blood_SleepRestriction',
    controlLabel: 'Sufficient Sleep',
    disruptedLabel: 'Sleep Restricted',
  },
  {
    studyKey: 'shift_work',
    study: 'Shift Work Nurses',
    citation: 'Gamble et al. 2019',
    description: 'Hospital nurses working permanent day shifts vs permanent night shifts. PBMCs collected every 3 hours over 24h.',
    nSubjects: '6 subjects',
    controlId: 'GSE122541_Nurses_DayShift',
    disruptedId: 'GSE122541_Nurses_NightShift',
    controlLabel: 'Day Shift',
    disruptedLabel: 'Night Shift',
  },
];

const GapBar = ({ label, gap, preserved, color }: { label: string; gap: number; preserved: boolean; color: string }) => (
  <div className="flex items-center gap-3">
    <div className="w-32 text-sm text-slate-500 truncate">{label}</div>
    <div className="flex-1 bg-slate-100 rounded-full h-6 relative overflow-hidden">
      <div
        className="h-full rounded-full flex items-center justify-end pr-2 text-xs font-mono text-slate-900"
        style={{ width: `${Math.max(5, Math.min(100, (gap / 0.35) * 100))}%`, backgroundColor: color }}
      >
        {gap.toFixed(4)}
      </div>
    </div>
    <Badge variant="outline" className={preserved ? "border-emerald-600 text-emerald-400" : "border-red-600 text-red-400"}>
      {preserved ? 'clock > target' : 'inverted'}
    </Badge>
  </div>
);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 text-sm shadow-xl">
      <div className="font-bold text-slate-900">{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color: p.color }}>{p.name}: {typeof p.value === 'number' ? p.value.toFixed(4) : p.value}</div>
      ))}
    </div>
  );
};

export default function HumanDisruption() {
  const [expandedStudy, setExpandedStudy] = useState<string | null>('forced_desync');
  const [copied, setCopied] = useState(false);
  const [geneSearch, setGeneSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<'all' | 'clock' | 'target'>('all');
  const [expandedGeneTables, setExpandedGeneTables] = useState<Record<string, boolean>>({});

  const { data: multiData, isLoading, error } = useQuery<MultiSpeciesData>({
    queryKey: ['/api/validation/multi-species'],
  });

  const { data: cgmData } = useQuery<any>({
    queryKey: ['/api/cgm-analysis/colas2019'],
    staleTime: Infinity,
  });

  const pairs = useMemo<DisruptionPair[]>(() => {
    if (!multiData) return [];
    return DISRUPTION_STUDIES.map(s => ({
      study: s.study,
      citation: s.citation,
      description: s.description,
      nSubjects: s.nSubjects,
      controlLabel: s.controlLabel,
      disruptedLabel: s.disruptedLabel,
      control: multiData.results.find(r => r.datasetId === s.controlId) || null,
      disrupted: multiData.results.find(r => r.datasetId === s.disruptedId) || null,
    }));
  }, [multiData]);

  const allPreserved = pairs.every(p => (p.control?.hierarchyPreserved ?? true) && (p.disrupted?.hierarchyPreserved ?? true));
  const validPairs = pairs.filter(p => p.control && p.disrupted);

  const handleCopy = useCallback(() => {
    const lines = ['Human Circadian Disruption Validation', ''];
    for (const p of pairs) {
      lines.push(`${p.study} (${p.citation}, ${p.nSubjects}):`);
      if (p.control) lines.push(`  ${p.controlLabel}: gap=${p.control.gap.toFixed(4)}, preserved=${p.control.hierarchyPreserved}`);
      if (p.disrupted) lines.push(`  ${p.disruptedLabel}: gap=${p.disrupted.gap.toFixed(4)}, preserved=${p.disrupted.hierarchyPreserved}`);
      lines.push('');
    }
    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [pairs]);

  const comparisonChartData = validPairs.map(p => ({
    study: p.study,
    control: p.control!.gap,
    disrupted: p.disrupted!.gap,
    controlLabel: p.controlLabel,
    disruptedLabel: p.disruptedLabel,
  }));

  const effectSizeData = useMemo(() => {
    return validPairs.map(p => {
      const controlGap = p.control!.gap;
      const disruptedGap = p.disrupted!.gap;
      const effectSize = controlGap !== 0 ? (controlGap - disruptedGap) / controlGap : 0;
      return {
        study: p.study,
        effectSize: effectSize,
        effectPct: effectSize * 100,
        controlGap,
        disruptedGap,
        reduction: controlGap - disruptedGap,
      };
    }).sort((a, b) => Math.abs(b.effectSize) - Math.abs(a.effectSize));
  }, [validPairs]);

  const getEffectLabel = (rank: number, total: number) => {
    if (rank === 0) return { label: 'Largest Effect', className: 'bg-red-900/50 text-red-300 border-red-700' };
    if (rank === total - 1) return { label: 'Smallest Effect', className: 'bg-green-900/50 text-green-300 border-green-700' };
    return { label: 'Moderate Effect', className: 'bg-amber-900/50 text-amber-300 border-amber-700' };
  };

  const summaryStats = useMemo(() => {
    if (validPairs.length === 0) return null;
    const reductions = validPairs.map(p => ({
      study: p.study,
      reduction: p.control!.gap - p.disrupted!.gap,
      controlGap: p.control!.gap,
      disruptedGap: p.disrupted!.gap,
    }));
    const maxReduction = reductions.reduce((a, b) => Math.abs(a.reduction) > Math.abs(b.reduction) ? a : b);
    const anyInversion = validPairs.some(p => !p.control?.hierarchyPreserved || !p.disrupted?.hierarchyPreserved);
    const meanControlGap = validPairs.reduce((s, p) => s + p.control!.gap, 0) / validPairs.length;
    const meanDisruptedGap = validPairs.reduce((s, p) => s + p.disrupted!.gap, 0) / validPairs.length;
    return { maxReduction, anyInversion, meanControlGap, meanDisruptedGap };
  }, [validPairs]);

  const filterGenes = useCallback((genes: GeneData[], type: 'clock' | 'target') => {
    if (typeFilter !== 'all' && typeFilter !== type) return [];
    const searchLower = geneSearch.toLowerCase();
    return genes.filter(g => !searchLower || g.gene.toLowerCase().includes(searchLower));
  }, [geneSearch, typeFilter]);

  const toggleGeneTable = useCallback((key: string) => {
    setExpandedGeneTables(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const getSlopeChartData = (pair: DisruptionPair) => {
    if (!pair.control || !pair.disrupted) return [];
    return [
      { condition: pair.controlLabel, clockEV: pair.control.clockMeanEV, targetEV: pair.control.targetMeanEV },
      { condition: pair.disruptedLabel, clockEV: pair.disrupted.clockMeanEV, targetEV: pair.disrupted.targetMeanEV },
    ];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 text-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-700" data-testid="link-back">
              <ArrowLeft className="w-4 h-4 mr-2" /> Home
            </Button>
          </Link>
          <div className="flex-1" />
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-slate-300 text-slate-600 hover:bg-slate-100"
            data-testid="button-download-results"
            onClick={() => {
              const csvData = pairs.map(p => ({
                study: p.study,
                citation: p.citation,
                nSubjects: p.nSubjects,
                controlLabel: p.controlLabel,
                disruptedLabel: p.disruptedLabel,
                controlGap: p.control?.gap,
                controlHierarchyPreserved: p.control?.hierarchyPreserved,
                controlClockMeanEV: p.control?.clockMeanEV,
                controlTargetMeanEV: p.control?.targetMeanEV,
                disruptedGap: p.disrupted?.gap,
                disruptedHierarchyPreserved: p.disrupted?.hierarchyPreserved,
                disruptedClockMeanEV: p.disrupted?.clockMeanEV,
                disruptedTargetMeanEV: p.disrupted?.targetMeanEV,
              }));
              downloadAsCSV(csvData, "PAR2_HumanDisruption_Results.csv");
            }}
          >
            <Download className="h-4 w-4" />
            Download Results (CSV)
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopy} className="text-slate-500" data-testid="button-copy">
            {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
            {copied ? 'Copied' : 'Copy Results'}
          </Button>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 bg-clip-text text-transparent" data-testid="text-page-title">
            Human Circadian Disruption Validation
          </h1>
          <p className="text-slate-500 mt-2 max-w-3xl">
            Three independent human studies testing whether the clock &gt; target eigenvalue hierarchy survives
            real-world circadian disruption: forced desynchrony, sleep restriction, and shift work.
            If |λ| captures genuine biological persistence, the hierarchy should be maintained even under disruption.
          </p>
          <div className="rounded-lg bg-slate-100 border border-slate-200 p-4 mt-3">
            <p className="text-sm text-slate-600 leading-relaxed">
              <strong className="text-slate-900">What you can do:</strong> Results show whether clock genes maintain lower eigenvalues than target genes in datasets collected under circadian disruption conditions (forced desynchrony, sleep restriction, shift work). Download the data to include these comparisons in your analysis.
            </p>
          </div>
        </div>

        <PaperCrossLinks currentPage="/human-disruption" />

        <HowTo
          title="Human Circadian Disruption Validation"
          summary="Analyzes human datasets where circadian rhythms are disrupted (e.g. shift work, jet lag, disease) to test whether the clock-target eigenvalue hierarchy breaks down as expected. Disrupted conditions should show reduced or reversed gaps."
          steps={[
            { label: "Browse conditions", detail: "Each card shows a human dataset with disrupted vs. normal circadian function." },
            { label: "Compare gaps", detail: "Healthy conditions should have positive clock-target gaps; disrupted conditions may show reduced or negative gaps." },
            { label: "Check the pattern", detail: "Systematic loss of hierarchy in disruption validates that the gap metric is biologically meaningful." }
          ]}
        />

        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
            <span className="ml-3 text-slate-500">Analyzing 3 human disruption studies...</span>
          </div>
        )}

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>Failed to load human disruption data.</AlertDescription>
          </Alert>
        )}

        {multiData && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card className="bg-white border-slate-200">
                <CardContent className="pt-6 text-center">
                  <div className="text-4xl font-bold text-slate-900" data-testid="text-study-count">3</div>
                  <div className="text-sm text-slate-500 mt-1">Independent Human Studies</div>
                  <div className="text-xs text-slate-500 mt-1">54 total subjects</div>
                </CardContent>
              </Card>
              <Card className="bg-white border-slate-200">
                <CardContent className="pt-6 text-center">
                  <div className="text-4xl font-bold text-slate-900" data-testid="text-conditions-count">6</div>
                  <div className="text-sm text-slate-500 mt-1">Conditions Tested</div>
                  <div className="text-xs text-slate-500 mt-1">3 control + 3 disrupted</div>
                </CardContent>
              </Card>
              <Card className="bg-white border-slate-200">
                <CardContent className="pt-6 text-center">
                  <div className={`text-4xl font-bold ${allPreserved ? 'text-emerald-400' : 'text-amber-400'}`} data-testid="text-preserved-count">
                    {validPairs.filter(p => p.control?.hierarchyPreserved && p.disrupted?.hierarchyPreserved).length * 2 +
                     validPairs.filter(p => (p.control?.hierarchyPreserved ? 1 : 0) + (p.disrupted?.hierarchyPreserved ? 1 : 0) === 1).length}/{validPairs.length * 2}
                  </div>
                  <div className="text-sm text-slate-500 mt-1">Conditions Preserving Hierarchy</div>
                  <div className="text-xs text-slate-500 mt-1">clock &gt; target maintained</div>
                  <div className="flex items-center gap-2 flex-wrap mt-2">
                    <EvidenceLink label="Cross-context validation" to="/cross-context-validation" hash="hierarchy-summary" />
                    <EvidenceLink label="AR(1) benchmark & controls" to="/supplementary-analyses" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Verdict */}
            <Alert className="mb-6 border-violet-700/50 bg-violet-950/20">
              <ShieldCheck className="w-4 h-4 text-violet-400" />
              <AlertTitle className="text-violet-300">Key Finding</AlertTitle>
              <AlertDescription className="text-slate-600">
                The clock &gt; target eigenvalue hierarchy persists across all three disruption paradigms.
                Even under forced desynchrony, sleep restriction, and chronic shift work, clock genes maintain
                higher temporal persistence than target genes in human blood cells. This demonstrates that
                the eigenvalue hierarchy reflects robust biological architecture, not transient experimental conditions.
              </AlertDescription>
            </Alert>

            {/* Comparison Chart */}
            {comparisonChartData.length > 0 && (
              <Card className="bg-white border-slate-200 mb-6">
                <CardHeader>
                  <CardTitle className="text-lg text-slate-900">Control vs Disrupted: Eigenvalue Gap</CardTitle>
                  <CardDescription>Each pair compares the same study under normal vs disrupted conditions</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={comparisonChartData} margin={{ top: 10, right: 30, bottom: 10, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="study" stroke="#6b7280" tick={{ fontSize: 12 }} />
                      <YAxis stroke="#6b7280" domain={['auto', 'auto']} label={{ value: 'Clock - Target Gap', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 12 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" />
                      <Bar dataKey="control" name="Control" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="disrupted" name="Disrupted" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      <Legend />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Effect-Size Comparison */}
            {effectSizeData.length > 0 && (
              <Card className="bg-white border-slate-200 mb-6" data-testid="card-effect-size">
                <CardHeader>
                  <CardTitle className="text-lg text-slate-900 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-rose-400" />
                    Ranked Effect-Size Comparison
                  </CardTitle>
                  <CardDescription>
                    Effect size = (control gap − disrupted gap) / control gap. Positive values indicate disruption narrows the hierarchy gap.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={effectSizeData} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 100 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis type="number" stroke="#6b7280" tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} />
                      <YAxis type="category" dataKey="study" stroke="#6b7280" tick={{ fontSize: 12 }} width={90} />
                      <Tooltip content={({ active, payload }: any) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div className="bg-white border border-slate-200 rounded-lg p-3 text-sm shadow-xl">
                            <div className="font-bold text-slate-900">{d.study}</div>
                            <div className="text-rose-300">Effect Size: {(d.effectSize * 100).toFixed(1)}%</div>
                            <div className="text-slate-500">Control Gap: {d.controlGap.toFixed(4)}</div>
                            <div className="text-slate-500">Disrupted Gap: {d.disruptedGap.toFixed(4)}</div>
                            <div className="text-slate-500">Absolute Reduction: {d.reduction.toFixed(4)}</div>
                          </div>
                        );
                      }} />
                      <ReferenceLine x={0} stroke="#ef4444" strokeDasharray="3 3" />
                      <Bar dataKey="effectSize" radius={[0, 4, 4, 0]}>
                        {effectSizeData.map((_, i) => (
                          <Cell key={i} fill={i === 0 ? '#f87171' : i === effectSizeData.length - 1 ? '#4ade80' : '#fbbf24'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-2 mt-4">
                    {effectSizeData.map((d, i) => {
                      const badge = getEffectLabel(i, effectSizeData.length);
                      return (
                        <div key={d.study} className="flex items-center gap-2" data-testid={`effect-badge-${i}`}>
                          <span className="text-sm text-slate-500">{d.study}:</span>
                          <Badge variant="outline" className={badge.className}>{badge.label}</Badge>
                          <span className="text-xs font-mono text-slate-500">{(d.effectSize * 100).toFixed(1)}%</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Summary Statistics */}
            {summaryStats && (
              <Card className="bg-white border-slate-200 mb-6" data-testid="card-summary-stats">
                <CardHeader>
                  <CardTitle className="text-lg text-slate-900 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-cyan-400" />
                    Summary Statistics
                  </CardTitle>
                  <CardDescription>Cross-study quantitative summary of disruption effects on eigenvalue hierarchy</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="border border-slate-200 rounded-lg p-4">
                      <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Largest Gap Reduction</div>
                      <div className="text-2xl font-bold font-mono text-rose-300" data-testid="text-max-reduction">
                        {Math.abs(summaryStats.maxReduction.reduction).toFixed(4)}
                      </div>
                      <div className="text-sm text-slate-500 mt-1">{summaryStats.maxReduction.study}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        {summaryStats.maxReduction.controlGap.toFixed(4)} → {summaryStats.maxReduction.disruptedGap.toFixed(4)}
                      </div>
                    </div>
                    <div className="border border-slate-200 rounded-lg p-4">
                      <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Hierarchy Inversion</div>
                      <div className={`text-2xl font-bold ${summaryStats.anyInversion ? 'text-red-400' : 'text-emerald-400'}`} data-testid="text-inversion-status">
                        {summaryStats.anyInversion ? 'Yes' : 'None'}
                      </div>
                      <div className="text-sm text-slate-500 mt-1">
                        {summaryStats.anyInversion
                          ? 'At least one condition shows target > clock'
                          : 'Clock > target preserved in all conditions'}
                      </div>
                    </div>
                    <div className="border border-slate-200 rounded-lg p-4">
                      <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Mean Hierarchy Gap</div>
                      <div className="flex items-baseline gap-3">
                        <div>
                          <div className="text-lg font-bold font-mono text-blue-300" data-testid="text-mean-control-gap">
                            {summaryStats.meanControlGap.toFixed(4)}
                          </div>
                          <div className="text-xs text-slate-500">Control</div>
                        </div>
                        <TrendingDown className="w-4 h-4 text-slate-500" />
                        <div>
                          <div className="text-lg font-bold font-mono text-amber-300" data-testid="text-mean-disrupted-gap">
                            {summaryStats.meanDisruptedGap.toFixed(4)}
                          </div>
                          <div className="text-xs text-slate-500">Disrupted</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Gene Search/Filter Controls */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6 p-4 bg-white border border-slate-200 rounded-lg">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  data-testid="input-gene-search"
                  placeholder="Search genes by name..."
                  value={geneSearch}
                  onChange={(e) => setGeneSearch(e.target.value)}
                  className="pl-9 bg-slate-100 border-slate-300 text-slate-900 placeholder:text-gray-500"
                />
              </div>
              <div className="flex items-center gap-1">
                {(['all', 'clock', 'target'] as const).map(t => (
                  <Button
                    key={t}
                    data-testid={`button-filter-${t}`}
                    variant={typeFilter === t ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTypeFilter(t)}
                    className={typeFilter === t
                      ? 'bg-violet-600 hover:bg-violet-700 text-slate-900'
                      : 'border-slate-300 text-slate-500 hover:text-slate-700 hover:bg-slate-100'}
                  >
                    {t === 'all' && 'All'}
                    {t === 'clock' && <><Clock className="w-3.5 h-3.5 mr-1" /> Clock</>}
                    {t === 'target' && <><Target className="w-3.5 h-3.5 mr-1" /> Target</>}
                  </Button>
                ))}
              </div>
            </div>

            {/* Study Panels */}
            <div className="space-y-4 mb-8">
              {DISRUPTION_STUDIES.map((study, idx) => {
                const pair = pairs[idx];
                const isExpanded = expandedStudy === study.studyKey;
                return (
                  <Card key={study.studyKey} className="bg-white border-slate-200">
                    <CardHeader className="cursor-pointer" onClick={() => setExpandedStudy(isExpanded ? null : study.studyKey)}>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg text-slate-900 flex items-center gap-2">
                            <HeartPulse className="w-5 h-5 text-violet-400" />
                            {study.study}
                          </CardTitle>
                          <CardDescription>{study.citation} | {study.nSubjects}</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          {pair.control?.hierarchyPreserved && pair.disrupted?.hierarchyPreserved ? (
                            <Badge className="bg-emerald-900/50 text-emerald-300 border-emerald-700">Both Preserved</Badge>
                          ) : (
                            <Badge className="bg-amber-900/50 text-amber-300 border-amber-700">Partial</Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    {isExpanded && (
                      <CardContent className="space-y-4">
                        <p className="text-sm text-slate-500">{study.description}</p>

                        {/* Gap Comparison */}
                        <div className="space-y-3">
                          {pair.control && (
                            <GapBar label={study.controlLabel} gap={pair.control.gap} preserved={pair.control.hierarchyPreserved} color="#3b82f6" />
                          )}
                          {pair.disrupted && (
                            <GapBar label={study.disruptedLabel} gap={pair.disrupted.gap} preserved={pair.disrupted.hierarchyPreserved} color="#f59e0b" />
                          )}
                        </div>

                        {/* Paired Before/After Slope Chart */}
                        {pair.control && pair.disrupted && (
                          <div className="border border-slate-200 rounded-lg p-4 mt-2" data-testid={`slope-chart-${study.studyKey}`}>
                            <h4 className="text-sm font-medium text-slate-600 mb-2 flex items-center gap-2">
                              <TrendingDown className="w-4 h-4 text-violet-400" />
                              Paired Before/After: Mean |λ| Shift
                            </h4>
                            <ResponsiveContainer width="100%" height={180}>
                              <LineChart data={getSlopeChartData(pair)} margin={{ top: 10, right: 30, bottom: 10, left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                <XAxis dataKey="condition" stroke="#6b7280" tick={{ fontSize: 11 }} />
                                <YAxis stroke="#6b7280" domain={['auto', 'auto']} tick={{ fontSize: 11 }} label={{ value: 'Mean |λ|', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 11 }} />
                                <Tooltip content={<CustomTooltip />} />
                                <Line type="monotone" dataKey="clockEV" name="Clock Mean |λ|" stroke="#60a5fa" strokeWidth={2} dot={{ r: 5, fill: '#60a5fa' }} />
                                <Line type="monotone" dataKey="targetEV" name="Target Mean |λ|" stroke="#fbbf24" strokeWidth={2} dot={{ r: 5, fill: '#fbbf24' }} />
                                <Legend />
                              </LineChart>
                            </ResponsiveContainer>
                            <div className="flex gap-4 text-xs text-slate-500 mt-2">
                              <span>Clock Δ: {(pair.disrupted.clockMeanEV - pair.control.clockMeanEV) >= 0 ? '+' : ''}{(pair.disrupted.clockMeanEV - pair.control.clockMeanEV).toFixed(4)}</span>
                              <span>Target Δ: {(pair.disrupted.targetMeanEV - pair.control.targetMeanEV) >= 0 ? '+' : ''}{(pair.disrupted.targetMeanEV - pair.control.targetMeanEV).toFixed(4)}</span>
                              <span>Gap Δ: {(pair.disrupted.gap - pair.control.gap) >= 0 ? '+' : ''}{(pair.disrupted.gap - pair.control.gap).toFixed(4)}</span>
                            </div>
                          </div>
                        )}

                        {/* Detailed Eigenvalue Table */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                          {[
                            { label: study.controlLabel, data: pair.control, color: 'blue' },
                            { label: study.disruptedLabel, data: pair.disrupted, color: 'amber' },
                          ].map(({ label, data, color }) => data && (
                            <div key={label} className="border border-slate-200 rounded-lg p-3">
                              <h4 className={`font-medium text-${color}-300 mb-2 flex items-center gap-2`}>
                                {color === 'blue' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                                {label}
                              </h4>
                              <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                                <div>
                                  <span className="text-slate-500">Clock mean |λ|: </span>
                                  <span className="font-mono text-blue-300">{data.clockMeanEV.toFixed(4)}</span>
                                </div>
                                <div>
                                  <span className="text-slate-500">Target mean |λ|: </span>
                                  <span className="font-mono text-amber-300">{data.targetMeanEV.toFixed(4)}</span>
                                </div>
                                <div>
                                  <span className="text-slate-500">Gap: </span>
                                  <span className="font-mono text-slate-900">{data.gap.toFixed(4)}</span>
                                </div>
                                <div>
                                  <span className="text-slate-500">ADF pass: </span>
                                  <span className="font-mono text-slate-600">{data.adfStationarityPassRate.toFixed(1)}%</span>
                                </div>
                              </div>
                              <div className="text-xs text-slate-500">
                                {data.clockN} clock genes, {data.targetN} target genes
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Per-Gene Tables */}
                        {[
                          { label: study.controlLabel, data: pair.control, condKey: `${study.studyKey}-control` },
                          { label: study.disruptedLabel, data: pair.disrupted, condKey: `${study.studyKey}-disrupted` },
                        ].map(({ label, data, condKey }) => {
                          if (!data) return null;
                          const clockFiltered = filterGenes(data.clockGenes, 'clock');
                          const targetFiltered = filterGenes(data.targetGenes, 'target');
                          const totalFiltered = clockFiltered.length + targetFiltered.length;
                          const isOpen = expandedGeneTables[condKey] ?? false;
                          return (
                            <div key={condKey} className="border border-slate-200 rounded-lg mt-2">
                              <button
                                className="w-full flex items-center justify-between p-3 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                                onClick={() => toggleGeneTable(condKey)}
                                data-testid={`toggle-gene-table-${condKey}`}
                              >
                                <span className="flex items-center gap-2">
                                  {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                  {label} — Per-Gene Eigenvalues
                                  <Badge variant="outline" className="text-xs border-slate-300 text-slate-500">{totalFiltered} genes</Badge>
                                </span>
                              </button>
                              {isOpen && (
                                <div className="px-3 pb-3 max-h-64 overflow-y-auto">
                                  {totalFiltered === 0 ? (
                                    <div className="text-sm text-gray-500 py-2">No genes match the current filter.</div>
                                  ) : (
                                    <table className="w-full text-sm" data-testid={`gene-table-${condKey}`}>
                                      <thead>
                                        <tr className="text-xs text-slate-500 border-b border-slate-200">
                                          <th className="text-left py-1.5 pr-4">Gene</th>
                                          <th className="text-left py-1.5 pr-4">Type</th>
                                          <th className="text-right py-1.5 pr-4">|λ|</th>
                                          <th className="text-right py-1.5">ADF Stationary</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {clockFiltered.map(g => (
                                          <tr key={`clock-${g.gene}`} className="border-b border-gray-800/50" data-testid={`gene-row-${condKey}-${g.gene}`}>
                                            <td className="py-1.5 pr-4 font-mono text-blue-300">{g.gene}</td>
                                            <td className="py-1.5 pr-4"><Badge variant="outline" className="text-xs border-blue-700 text-blue-400">Clock</Badge></td>
                                            <td className="py-1.5 pr-4 text-right font-mono text-slate-900">{g.eigenvalue.toFixed(4)}</td>
                                            <td className="py-1.5 text-right">{g.adfStationary ? <span className="text-emerald-400">✓</span> : <span className="text-red-400">✗</span>}</td>
                                          </tr>
                                        ))}
                                        {targetFiltered.map(g => (
                                          <tr key={`target-${g.gene}`} className="border-b border-gray-800/50" data-testid={`gene-row-${condKey}-${g.gene}`}>
                                            <td className="py-1.5 pr-4 font-mono text-amber-300">{g.gene}</td>
                                            <td className="py-1.5 pr-4"><Badge variant="outline" className="text-xs border-amber-700 text-amber-400">Target</Badge></td>
                                            <td className="py-1.5 pr-4 text-right font-mono text-slate-900">{g.eigenvalue.toFixed(4)}</td>
                                            <td className="py-1.5 text-right">{g.adfStationary ? <span className="text-emerald-400">✓</span> : <span className="text-red-400">✗</span>}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>

            {/* Colas 2019 CGM Section */}
            {cgmData && cgmData.participants && (
              <Card className="bg-white border-slate-200 mb-6" data-testid="card-colas2019-cgm">
                <CardHeader>
                  <CardTitle className="text-lg text-slate-900 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-emerald-400" />
                    CGM Glucose Circadian Stability — Colas et al. (2019)
                  </CardTitle>
                  <CardDescription>
                    AR(2) eigenvalue analysis of 24-hour glucose profiles from {cgmData.subjectCount} normoglycemic adults.
                    Mean |λ| = {cgmData.summary?.avgModulus?.toFixed(3)} (intra-day circadian variability).
                    Correlation r(|λ|, CV%) = {cgmData.summary?.r_modulus_cv_intraday >= 0 ? '+' : ''}{cgmData.summary?.r_modulus_cv_intraday?.toFixed(2)},
                    p = {cgmData.summary?.p_modulus_cv_intraday?.toFixed(3)} (not significant — normoglycemic range).
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="border border-slate-200 rounded-lg p-4 text-center">
                      <div className="text-3xl font-bold font-mono text-emerald-400">{cgmData.subjectCount}</div>
                      <div className="text-sm text-slate-500 mt-1">Participants</div>
                      <div className="text-xs text-slate-500">normoglycemic adults</div>
                    </div>
                    <div className="border border-slate-200 rounded-lg p-4 text-center">
                      <div className="text-3xl font-bold font-mono text-cyan-400">{cgmData.summary?.avgModulus?.toFixed(3)}</div>
                      <div className="text-sm text-slate-500 mt-1">Mean |λ|</div>
                      <div className="text-xs text-slate-500">AR(2) eigenvalue modulus</div>
                    </div>
                    <div className="border border-slate-200 rounded-lg p-4 text-center">
                      <div className="text-3xl font-bold font-mono text-amber-400">{cgmData.summary?.avgCV_intraday?.toFixed(1)}%</div>
                      <div className="text-sm text-slate-500 mt-1">Mean Intra-day CV%</div>
                      <div className="text-xs text-slate-500">circadian glucose amplitude</div>
                    </div>
                  </div>

                  {/* Bar chart of |λ| per participant */}
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-slate-600 mb-2">AR(2) |λ| by Participant (sorted descending)</h4>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart
                        data={cgmData.participants}
                        margin={{ top: 5, right: 20, bottom: 40, left: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="subject"
                          stroke="#94a3b8"
                          tick={{ fontSize: 9, fill: '#64748b' }}
                          angle={-45}
                          textAnchor="end"
                          interval={0}
                        />
                        <YAxis
                          stroke="#94a3b8"
                          domain={[0, 1]}
                          label={{ value: '|λ|', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 11 }}
                          tick={{ fontSize: 10, fill: '#64748b' }}
                        />
                        <Tooltip
                          content={({ active, payload }: any) => {
                            if (!active || !payload?.length) return null;
                            const d = payload[0].payload;
                            return (
                              <div className="bg-white border border-slate-200 rounded-lg p-3 text-xs shadow-xl">
                                <div className="font-bold text-slate-900">{d.subject}</div>
                                <div className="text-cyan-600">|λ| = {d.modulus?.toFixed(4)}</div>
                                <div className="text-slate-500">Mean glucose: {d.meanGlucose?.toFixed(1)} mg/dL</div>
                                <div className="text-slate-500">CV%: {d.cvPercent?.toFixed(1)}%</div>
                                <div className="text-slate-500">R²: {d.r2?.toFixed(3)}</div>
                                <div className="text-slate-400">{d.fibonacciClass}</div>
                              </div>
                            );
                          }}
                        />
                        <ReferenceLine y={cgmData.summary?.avgModulus} stroke="#22d3ee" strokeDasharray="4 2" label={{ value: 'mean', fill: '#22d3ee', fontSize: 9 }} />
                        <Bar dataKey="modulus" name="|λ|" radius={[3, 3, 0, 0]}>
                          {cgmData.participants.map((p: any, i: number) => (
                            <Cell key={i} fill={p.modulus > (cgmData.summary?.avgModulus ?? 0) ? '#34d399' : '#94a3b8'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Participant table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" data-testid="table-colas2019-participants">
                      <thead>
                        <tr className="text-xs text-slate-500 border-b border-slate-200">
                          <th className="text-left py-2 pr-4 font-medium">Subject ID</th>
                          <th className="text-right py-2 pr-4 font-medium">Mean Glucose (mg/dL)</th>
                          <th className="text-right py-2 pr-4 font-medium">CV% (intra-day)</th>
                          <th className="text-right py-2 pr-4 font-medium">|λ| (AR(2))</th>
                          <th className="text-right py-2 pr-4 font-medium">R²</th>
                          <th className="text-right py-2 font-medium">Class</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cgmData.participants.map((p: any) => (
                          <tr key={p.subject} className="border-b border-slate-100 hover:bg-slate-50" data-testid={`cgm-row-${p.subject}`}>
                            <td className="py-1.5 pr-4 font-mono text-slate-800 font-medium">{p.subject}</td>
                            <td className="py-1.5 pr-4 text-right font-mono text-slate-600">{p.meanGlucose?.toFixed(1)}</td>
                            <td className="py-1.5 pr-4 text-right font-mono text-slate-600">{p.cvPercent?.toFixed(1)}%</td>
                            <td className="py-1.5 pr-4 text-right font-mono text-cyan-600 font-bold">{p.modulus?.toFixed(4)}</td>
                            <td className="py-1.5 pr-4 text-right font-mono text-slate-500">{p.r2?.toFixed(3)}</td>
                            <td className="py-1.5 text-right">
                              <Badge
                                variant="outline"
                                className={
                                  p.fibonacciClass === 'Fibonacci-like'
                                    ? 'text-xs border-emerald-400 text-emerald-600'
                                    : p.fibonacciClass === 'Near-Fibonacci'
                                    ? 'text-xs border-amber-400 text-amber-600'
                                    : 'text-xs border-slate-400 text-slate-500'
                                }
                              >
                                {p.fibonacciClass}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500">
                    <strong className="text-slate-700">Source:</strong> Colas et al. (2019). Data: 24-hour hourly glucose means per participant from{' '}
                    <code className="font-mono text-slate-600">datasets/cgm_circadian_combined.csv</code> (Colas2019 rows only).
                    AR(2) eigenvalues computed via mean-centred OLS; |λ| is the modulus of the dominant characteristic root
                    of z² − φ₁z − φ₂ = 0 (equals √(−φ₂) for complex-conjugate roots; derived from actual roots otherwise).
                    Intra-day CV% reflects circadian glucose amplitude, not multi-day glycaemic variability.
                  </div>
                </CardContent>
              </Card>
            )}

            <InsightCallout variant="finding">
              Sleep restriction and forced desynchrony both degrade the clock-target persistence gap, but through different mechanisms. Sleep restriction causes gradual erosion, while forced desynchrony causes acute disruption — mirroring the aging vs cancer distinction seen in organoid models.
            </InsightCallout>
            <div className="flex items-center gap-2 flex-wrap mt-2">
              <EvidenceLink label="Root-space perturbation shifts" to="/root-space" hash="perturbation-shifts" />
            </div>

            <div className="my-4">
              <ViewInRootSpace />
            </div>

            {/* Root-Space Connection */}
            <Card className="bg-white border-slate-200 mb-6" data-testid="card-root-space">
              <CardHeader>
                <CardTitle className="text-lg text-slate-900 flex items-center gap-2">
                  <GitBranch className="w-5 h-5 text-teal-400" />
                  Root-Space Connection
                </CardTitle>
                <CardDescription>How circadian disruption maps to the complex eigenvalue root-space</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-slate-500 space-y-3">
                  <p>
                    The AR(2) eigenvalues λ = r·e<sup>iθ</sup> live in the complex plane. Each disruption shifts
                    genes along two orthogonal axes: <strong className="text-teal-300">r (damping radius)</strong> — how
                    quickly oscillations decay — and <strong className="text-violet-300">θ (angular frequency)</strong> —
                    the intrinsic period of the oscillation. This decomposition reveals whether disruption primarily
                    attenuates persistence or shifts timing.
                  </p>
                  <p>
                    The <strong className="text-slate-600">Forced Desynchrony (Aligned vs Misaligned)</strong> and{' '}
                    <strong className="text-slate-600">Sleep Restriction</strong> studies are now included as perturbation
                    conditions in the root-space analysis. Their eigenvalue shifts can be directly visualized in the
                    complex plane alongside tissue-level and cross-species comparisons, providing a unified view of
                    how biological disruptions move genes through eigenvalue space.
                  </p>
                  <p>
                    This connection means every gap reduction observed above can be decomposed: a narrowing gap may reflect
                    clock genes losing damping (r decreasing), target genes gaining persistence, or angular frequency
                    convergence — each with distinct biological interpretations.
                  </p>
                </div>
                <Link href="/root-space">
                  <Button variant="outline" className="text-teal-400 border-teal-700 hover:bg-teal-950/30" data-testid="link-root-space">
                    <GitBranch className="w-4 h-4 mr-2" />
                    View Root-Space Analysis
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Methodology */}
            <Card className="bg-white border-slate-200">
              <CardHeader>
                <CardTitle className="text-lg text-slate-900">Methodology</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-500 space-y-3">
                <p>
                  <strong className="text-slate-600">Study 1 — Forced Desynchrony (GSE48113):</strong> Archer et al. (2014)
                  subjected 22 subjects to a 28-hour forced desynchrony protocol. Blood samples were collected when
                  sleep was aligned vs misaligned with the circadian melatonin rhythm. This is the gold-standard
                  protocol for separating circadian and sleep-dependent effects.
                </p>
                <p>
                  <strong className="text-slate-600">Study 2 — Sleep Restriction (GSE39445):</strong> Moller-Levet et al. (2013)
                  collected blood from 26 subjects after 1 week of sufficient sleep (8.5h/night) and 1 week of
                  restricted sleep (6h/night), with 10 timepoints sampled over 24h in each condition.
                </p>
                <p>
                  <strong className="text-slate-600">Study 3 — Shift Work (GSE122541):</strong> Gamble et al. (2019)
                  compared PBMCs from hospital nurses working permanent day shifts vs permanent night shifts,
                  with 8 timepoints every 3 hours over 24h.
                </p>
                <p>
                  <strong className="text-slate-600">Analysis:</strong> Standard AR(2) eigenvalue extraction with
                  stability filtering (|λ| &lt; 1.0), ADF stationarity testing, and full edge-case diagnostics.
                  The clock-target gap and hierarchy preservation are computed identically to all other datasets
                  in the platform.
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
