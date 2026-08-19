import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useScrollToHash } from "@/hooks/useScrollToHash";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getDatasetCaveat } from "@/lib/datasetCaveats";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  ReferenceLine, Legend
} from "recharts";
import {
  ArrowLeft, Loader2, Globe, CheckCircle2, TrendingUp, Download,
  BarChart3, Target, Dna, Shield, AlertTriangle,
  Layers
} from "lucide-react";
import { Link } from "wouter";
import HowTo from "@/components/HowTo";
import PaperCrossLinks from "@/components/PaperCrossLinks";
import InsightCallout from "@/components/InsightCallout";
import ViewInRootSpace from "@/components/ViewInRootSpace";
import GeneTooltip from "@/components/GeneTooltip";

interface StabilityFiltered {
  totalGenesRetained: number;
  totalGenesExcluded: number;
  percentRetained: number;
  filteredMeanClock: number;
  filteredMeanTarget: number;
  filteredGap: number;
  filteredHierarchyPreserved: boolean;
  filteredClockPercentile: number;
  filteredTargetPercentile: number;
  clockGenesRetained: number;
  clockGenesExcluded: number;
  targetGenesRetained: number;
  targetGenesExcluded: number;
  filteredWilcoxonClockVsGenome: { U: number; z: number; p: number; nA: number; nB: number } | null;
  filteredPermutationP: number;
  unstableGenes: { gene: string; geneType: string; eigenvalue: number }[];
}


interface GenomeWideResult {
  dataset: string;
  datasetId: string;
  description: string;
  totalGenesAnalyzed: number;
  genomeWideDistribution: {
    mean: number;
    median: number;
    q25: number;
    q75: number;
    q90: number;
    q95: number;
    q99: number;
    min: number;
    max: number;
  };
  clockGenes: {
    n: number;
    meanEigenvalue: number;
    meanPercentile: number;
    genes: { gene: string; eigenvalue: number; percentile: number; confidence: string; adfStationary: boolean }[];
  };
  targetGenes: {
    n: number;
    meanEigenvalue: number;
    meanPercentile: number;
    genes: { gene: string; eigenvalue: number; percentile: number; confidence: string; adfStationary: boolean }[];
  };
  gearboxResult: {
    gap: number;
    hierarchyPreserved: boolean;
    clockAboveMedian: string;
    clockAbove75thPercentile: string;
    clockAbove90thPercentile: string;
    interpretation: string;
  };
  statisticalTests: {
    wilcoxonClockVsGenome: { U: number; z: number; p: number; nA: number; nB: number };
    wilcoxonClockVsTarget: { U: number; z: number; p: number; nA: number; nB: number } | null;
    permutationTest: {
      observedGap: number;
      nPermutations: number;
      pValue: number;
      significant: boolean;
      interpretation: string;
    };
  };
  histogram: { binStart: number; binEnd: number; count: number; clockCount: number; targetCount: number }[];
  stabilityFiltered?: StabilityFiltered;
  downloadUrl: string;
}



const DATASET_GROUPS = [
  {
    label: 'Mouse Tissues - Hughes Atlas (GSE54650, ~21K genes each)',
    datasets: [
      { id: 'GSE54650_Liver_circadian', label: 'Liver' },
      { id: 'GSE54650_Heart_circadian', label: 'Heart' },
      { id: 'GSE54650_Kidney_circadian', label: 'Kidney' },
      { id: 'GSE54650_Lung_circadian', label: 'Lung' },
      { id: 'GSE54650_Cerebellum_circadian', label: 'Cerebellum' },
      { id: 'GSE54650_Hypothalamus_circadian', label: 'Hypothalamus' },
      { id: 'GSE54650_Brainstem_circadian', label: 'Brainstem' },
      { id: 'GSE54650_Muscle_circadian', label: 'Muscle' },
      { id: 'GSE54650_Adrenal_circadian', label: 'Adrenal' },
      { id: 'GSE54650_Aorta_circadian', label: 'Aorta' },
      { id: 'GSE54650_Brown_Fat_circadian', label: 'Brown Fat' },
      { id: 'GSE54650_White_Fat_circadian', label: 'White Fat' },
    ]
  },
  {
    label: 'Cancer & Disease Models',
    datasets: [
      { id: 'GSE221103_Neuroblastoma_MYC_ON', label: 'Neuroblastoma MYC-ON (~60K genes)' },
      { id: 'GSE221103_Neuroblastoma_MYC_OFF', label: 'Neuroblastoma MYC-OFF (~60K genes)' },
      { id: 'GSE157357_Organoid_WT-WT', label: 'Organoid WT - Healthy (~16K genes)' },
      { id: 'GSE157357_Organoid_ApcKO-WT', label: 'Organoid APC-Mutant - Cancer (~16K genes)' },
      { id: 'GSE157357_Organoid_WT-BmalKO', label: 'Organoid BMAL-KO - Clock KO (~16K genes)' },
      { id: 'GSE157357_Organoid_ApcKO-BmalKO', label: 'Organoid Double KO (~15K genes)' },
    ]
  },
  {
    label: 'Other Mouse Datasets',
    datasets: [
      { id: 'GSE11923_Liver_1h_48h_genes', label: 'Mouse Liver - Hughes 2009, 1h sampling (~22K genes)' },
    ]
  },
  {
    label: 'Human',
    datasets: [
      { id: 'GSE113883_Human_WholeBlood', label: 'Whole Blood - Braun 2018, constant routine (~58K probes)' },
      { id: 'GSE48113_Human_Blood_Circadian', label: 'Blood - Archer 2014' },
    ]
  },
  {
    label: 'Other Species',
    datasets: [
      { id: 'GSE98965_baboon_FPKM', label: 'Baboon Multi-tissue - Mure 2018 (~29K genes)' },
      { id: 'GSE242964_arabidopsis_circadian_averaged', label: 'Arabidopsis - Redmond 2024' },
    ]
  }
];

export default function GenomeWide() {
  useScrollToHash();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenomeWideResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDataset, setSelectedDataset] = useState('GSE54650_Liver_circadian');

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/validation/genome-wide?dataset=${selectedDataset}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setResult(data);
    } catch (e: any) {
      setError(e.message || "Failed to run genome-wide analysis");
    } finally {
      setLoading(false);
    }
  };

  const formatP = (p: number | string) => {
    const num = typeof p === 'string' ? parseFloat(p) : p;
    if (num < 0.001) return "<0.001";
    if (num < 0.01) return num.toFixed(4);
    return num.toFixed(3);
  };

  return (
    <div id="screen-results" className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 p-4 md:p-8 scroll-mt-20" data-testid="genome-wide-page">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="link-back-home">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
              <Globe className="h-6 w-6 text-blue-400" />
              Genome-Wide AR(2) Validation
            </h1>
            <p className="text-sm text-muted-foreground">
              Demonstrates that the gearbox hierarchy emerges from genome-wide analysis without curated panel selection
            </p>
            <div className="rounded-lg bg-slate-100 border border-slate-200 p-4 mt-3">
              <p className="text-sm text-slate-600 leading-relaxed">
                <strong className="text-slate-900">What you can do:</strong> Runs AR(2) on every gene in a dataset — not just clock and target genes — to see if the hierarchy pattern emerges naturally across the whole genome. Download the genome-wide report to see eigenvalue distributions for all analyzed genes.
              </p>
            </div>
          </div>
        </div>

        <PaperCrossLinks currentPage="/genome-wide" />

        <HowTo
          title="Genome-Wide AR(2) Validation"
          summary="Runs AR(2) analysis on all genes in a dataset to demonstrate that the clock-target hierarchy emerges naturally from genome-wide data, not just pre-selected genes. Shows where clock and target genes fall within the full eigenvalue distribution."
          steps={[
            { label: "Select a dataset", detail: "Pick a dataset to run genome-wide AR(2) fitting across all available genes." },
            { label: "View the distribution", detail: "The histogram shows the full eigenvalue distribution with clock and target genes highlighted." },
            { label: "Check percentiles", detail: "Clock genes should cluster toward higher eigenvalues compared to the genome-wide background." }
          ]}
        />

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Dna className="h-5 w-5" />
              Run Genome-Wide Analysis
            </CardTitle>
            <CardDescription>
              Analyze all genes in a dataset to show clock genes naturally rank higher in eigenvalue persistence.
              This tests whether clock genes naturally rank higher across the full genome.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3">
              <Select value={selectedDataset} onValueChange={setSelectedDataset}>
                <SelectTrigger className="w-full sm:w-[500px]" data-testid="select-dataset">
                  <SelectValue placeholder="Select dataset" />
                </SelectTrigger>
                <SelectContent className="max-h-[400px]">
                  {DATASET_GROUPS.map(group => (
                    <SelectGroup key={group.label}>
                      <SelectLabel className="text-xs font-semibold text-muted-foreground">{group.label}</SelectLabel>
                      {group.datasets.map(d => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.label}{getDatasetCaveat(d.id) ? " ⚠" : ""}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={runAnalysis} disabled={loading} data-testid="button-run-analysis">
                {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analyzing ~20K genes...</> : "Run Genome-Wide Analysis"}
              </Button>
            </div>
            {getDatasetCaveat(selectedDataset) && (
              <div
                className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 mt-3"
                data-testid="banner-dataset-caveat"
                role="alert"
              >
                <span className="mt-0.5 shrink-0 text-base leading-none">⚠</span>
                <span><strong>Short time-window caution:</strong> {getDatasetCaveat(selectedDataset)}</span>
              </div>
            )}
            {loading && (
              <p className="text-sm text-muted-foreground mt-3">
                Processing all genes with AR(2) + diagnostics. This may take 1-2 minutes on the first run (cached after).
              </p>
            )}
            {error && <p className="text-sm text-red-400 mt-3" data-testid="text-error">{error}</p>}
          </CardContent>
        </Card>

        {result && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-3xl font-bold text-blue-400" data-testid="text-total-genes">{result.totalGenesAnalyzed.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Genes Analyzed</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-3xl font-bold text-emerald-400" data-testid="text-clock-percentile">{result.clockGenes.meanPercentile}th</p>
                  <p className="text-sm text-muted-foreground">Clock Mean Percentile</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-3xl font-bold text-amber-400" data-testid="text-target-percentile">{result.targetGenes.meanPercentile}th</p>
                  <p className="text-sm text-muted-foreground">Target Mean Percentile</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-3xl font-bold" data-testid="text-permutation-p">
                    {result.statisticalTests.permutationTest.significant
                      ? <span className="text-emerald-400">p={formatP(result.statisticalTests.permutationTest.pValue)}</span>
                      : <span className="text-red-400">p={formatP(result.statisticalTests.permutationTest.pValue)}</span>
                    }
                  </p>
                  <p className="text-sm text-muted-foreground">Permutation Test</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Genome-Wide Eigenvalue Distribution
                </CardTitle>
                <CardDescription>
                  Distribution of AR(2) eigenvalue |lambda| across all {result.totalGenesAnalyzed.toLocaleString()} genes.
                  Clock genes (blue) and target genes (orange) are highlighted.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={result.histogram.map(h => ({
                    bin: `${h.binStart.toFixed(2)}`,
                    total: h.count,
                    clock: h.clockCount,
                    target: h.targetCount,
                    other: h.count - h.clockCount - h.targetCount
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="bin" label={{ value: "Eigenvalue |lambda|", position: "insideBottom", offset: -5 }} tick={{ fontSize: 11 }} />
                    <YAxis label={{ value: "Gene Count", angle: -90, position: "insideLeft" }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="other" stackId="a" fill="#d1d5db" name="Other genes" />
                    <Bar dataKey="clock" stackId="a" fill="#3b82f6" name="Clock genes" />
                    <Bar dataKey="target" stackId="a" fill="#f59e0b" name="Target genes" />
                    <ReferenceLine x={result.histogram.findIndex(h =>
                      result.genomeWideDistribution.median >= h.binStart && result.genomeWideDistribution.median < h.binEnd
                    ).toString()} stroke="#ef4444" strokeDasharray="5 5" label="Median" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Target className="h-5 w-5 text-blue-400" />
                    Clock Genes — Genome-Wide Ranking
                  </CardTitle>
                  <CardDescription>
                    {result.gearboxResult.clockAbove90thPercentile} clock genes above 90th percentile.
                    Mean percentile: {result.clockGenes.meanPercentile}th.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {result.clockGenes.genes.map(g => (
                      <div key={g.gene} className="flex items-center justify-between p-2 bg-blue-500/10 rounded text-sm" data-testid={`clock-gene-${g.gene}`}>
                        <GeneTooltip gene={g.gene}><span className="font-mono font-medium">{g.gene}</span></GeneTooltip>
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground">|lambda|={g.eigenvalue}</span>
                          <Badge variant={g.percentile >= 90 ? "default" : g.percentile >= 75 ? "secondary" : "outline"}>
                            {g.percentile}th %ile
                          </Badge>
                          {g.adfStationary && <Badge variant="outline" className="text-xs text-emerald-400 border-emerald-500/30">ADF pass</Badge>}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Target className="h-5 w-5 text-amber-400" />
                    Target Genes — Genome-Wide Ranking
                  </CardTitle>
                  <CardDescription>
                    Mean percentile: {result.targetGenes.meanPercentile}th.
                    Gap from clock: {result.gearboxResult.gap.toFixed(4)}.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {result.targetGenes.genes.map(g => (
                      <div key={g.gene} className="flex items-center justify-between p-2 bg-amber-500/10 rounded text-sm" data-testid={`target-gene-${g.gene}`}>
                        <GeneTooltip gene={g.gene}><span className="font-mono font-medium">{g.gene}</span></GeneTooltip>
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground">|lambda|={g.eigenvalue}</span>
                          <Badge variant={g.percentile >= 90 ? "default" : g.percentile >= 75 ? "secondary" : "outline"}>
                            {g.percentile}th %ile
                          </Badge>
                          {g.adfStationary && <Badge variant="outline" className="text-xs text-emerald-400 border-emerald-500/30">ADF pass</Badge>}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Statistical Tests
                </CardTitle>
                <CardDescription>Formal tests confirming the gearbox hierarchy is not a panel selection artifact</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <h4 className="font-semibold text-sm mb-2">Wilcoxon Rank-Sum (Clock vs Non-Clock)</h4>
                    <p className="text-sm" data-testid="text-wilcoxon-genome">
                      z = {result.statisticalTests.wilcoxonClockVsGenome.z}, p = {formatP(result.statisticalTests.wilcoxonClockVsGenome.p)}
                    </p>
                    <Badge className="mt-2" variant={parseFloat(String(result.statisticalTests.wilcoxonClockVsGenome.p)) < 0.05 ? "default" : "destructive"}>
                      {parseFloat(String(result.statisticalTests.wilcoxonClockVsGenome.p)) < 0.05 ? "Significant" : "Not significant"}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">Clock genes rank significantly higher than random genes</p>
                  </div>

                  {result.statisticalTests.wilcoxonClockVsTarget && (
                    <div className="p-4 bg-slate-50 rounded-lg">
                      <h4 className="font-semibold text-sm mb-2">Wilcoxon Rank-Sum (Clock vs Target)</h4>
                      <p className="text-sm" data-testid="text-wilcoxon-target">
                        z = {result.statisticalTests.wilcoxonClockVsTarget.z}, p = {formatP(result.statisticalTests.wilcoxonClockVsTarget.p)}
                      </p>
                      <Badge className="mt-2" variant={parseFloat(String(result.statisticalTests.wilcoxonClockVsTarget.p)) < 0.05 ? "default" : "destructive"}>
                        {parseFloat(String(result.statisticalTests.wilcoxonClockVsTarget.p)) < 0.05 ? "Significant" : "Not significant"}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">Clock genes have higher persistence than target genes</p>
                    </div>
                  )}

                  <div className="p-4 bg-slate-50 rounded-lg">
                    <h4 className="font-semibold text-sm mb-2">Permutation Test ({result.statisticalTests.permutationTest.nPermutations.toLocaleString()} permutations)</h4>
                    <p className="text-sm" data-testid="text-permutation-result">
                      Observed gap = {result.statisticalTests.permutationTest.observedGap}, p = {formatP(result.statisticalTests.permutationTest.pValue)}
                    </p>
                    <Badge className="mt-2" variant={result.statisticalTests.permutationTest.significant ? "default" : "destructive"}>
                      {result.statisticalTests.permutationTest.significant ? "Significant" : "Not significant"}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">{result.statisticalTests.permutationTest.interpretation}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  Conclusion
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                  <p className="text-sm font-medium text-emerald-300 mb-2" data-testid="text-conclusion">
                    {result.gearboxResult.interpretation}
                  </p>
                  <ul className="text-sm text-emerald-400 space-y-1 list-disc list-inside">
                    <li>{result.totalGenesAnalyzed.toLocaleString()} genes analyzed genome-wide</li>
                    <li>Clock genes at {result.clockGenes.meanPercentile}th percentile (vs target at {result.targetGenes.meanPercentile}th)</li>
                    <li>{result.gearboxResult.clockAboveMedian} clock genes above genome median</li>
                    <li>{result.gearboxResult.clockAbove90thPercentile} clock genes above 90th percentile</li>
                    <li>Wilcoxon rank-sum: p={formatP(result.statisticalTests.wilcoxonClockVsGenome.p)} (clock vs non-clock)</li>
                    <li>Permutation test: p={formatP(result.statisticalTests.permutationTest.pValue)} ({result.statisticalTests.permutationTest.nPermutations.toLocaleString()} permutations)</li>
                  </ul>
                </div>
                <div className="mt-4">
                  <a href={result.downloadUrl} data-testid="link-download-report">
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" /> Download Genome-Wide Report (CSV)
                    </Button>
                  </a>
                </div>
              </CardContent>
            </Card>

            {result.stabilityFiltered && (
              <Card className="border-2 border-purple-500/30" data-testid="card-stability-filter">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Shield className="h-5 w-5 text-purple-400" />
                    Stability Filter: |lambda| {'<'} 1.0 Only
                  </CardTitle>
                  <CardDescription>
                    Excludes non-stationary AR(2) fits to ensure eigenvalue comparisons are meaningful.
                    {result.stabilityFiltered.percentRetained}% of genes retained.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div className="p-3 bg-purple-500/10 rounded-lg text-center">
                      <p className="text-2xl font-bold text-purple-400" data-testid="text-stable-retained">
                        {result.stabilityFiltered.totalGenesRetained.toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">Stable Genes ({result.stabilityFiltered.percentRetained}%)</p>
                    </div>
                    <div className="p-3 bg-purple-500/10 rounded-lg text-center">
                      <p className="text-2xl font-bold text-purple-400" data-testid="text-stable-clock">
                        {result.stabilityFiltered.filteredMeanClock.toFixed(4)}
                      </p>
                      <p className="text-xs text-muted-foreground">Clock Mean |lambda| ({result.stabilityFiltered.clockGenesRetained}/{result.stabilityFiltered.clockGenesRetained + result.stabilityFiltered.clockGenesExcluded} retained)</p>
                    </div>
                    <div className="p-3 bg-purple-500/10 rounded-lg text-center">
                      <p className="text-2xl font-bold text-purple-400" data-testid="text-stable-target">
                        {result.stabilityFiltered.filteredMeanTarget.toFixed(4)}
                      </p>
                      <p className="text-xs text-muted-foreground">Target Mean |lambda| ({result.stabilityFiltered.targetGenesRetained}/{result.stabilityFiltered.targetGenesRetained + result.stabilityFiltered.targetGenesExcluded} retained)</p>
                    </div>
                    <div className="p-3 bg-purple-500/10 rounded-lg text-center">
                      <p className="text-2xl font-bold" data-testid="text-stable-gap">
                        <span className={result.stabilityFiltered.filteredHierarchyPreserved ? "text-emerald-400" : "text-red-400"}>
                          {result.stabilityFiltered.filteredGap.toFixed(4)}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">Filtered Gap</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <h4 className="font-semibold text-sm mb-1">Hierarchy Status (filtered)</h4>
                      <Badge variant={result.stabilityFiltered.filteredHierarchyPreserved ? "default" : "destructive"} data-testid="badge-stable-hierarchy">
                        {result.stabilityFiltered.filteredHierarchyPreserved ? "Preserved" : "Not Preserved"}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        Filtered percentiles: Clock {result.stabilityFiltered.filteredClockPercentile}th vs Target {result.stabilityFiltered.filteredTargetPercentile}th
                      </p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <h4 className="font-semibold text-sm mb-1">Filtered Statistical Tests</h4>
                      {result.stabilityFiltered.filteredWilcoxonClockVsGenome && (
                        <p className="text-sm" data-testid="text-stable-wilcoxon">
                          Wilcoxon p={formatP(result.stabilityFiltered.filteredWilcoxonClockVsGenome.p)}, Permutation p={formatP(result.stabilityFiltered.filteredPermutationP)}
                        </p>
                      )}
                    </div>
                  </div>

                  {result.stabilityFiltered.unstableGenes.length > 0 && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                      <h4 className="font-semibold text-sm mb-2 flex items-center gap-1">
                        <AlertTriangle className="h-4 w-4 text-amber-400" />
                        Unstable Clock/Target Genes Excluded (|lambda| {'>='} 1.0)
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {result.stabilityFiltered.unstableGenes.map(g => (
                          <Badge key={g.gene} variant="outline" className="text-amber-400 border-amber-500/30" data-testid={`badge-unstable-${g.gene}`}>
                            <GeneTooltip gene={g.gene}>{g.gene}</GeneTooltip> ({g.geneType}) |lambda|={g.eigenvalue}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}


        <InsightCallout variant="info">
          Running AR(2) on all ~20,000 genes (not just curated clock/target sets) reveals that the persistence hierarchy is not an artifact of gene selection. The clock-target gap emerges naturally from the full genome distribution.
        </InsightCallout>

        <div className="my-4">
          <ViewInRootSpace />
        </div>

      </div>
    </div>
  );
}
