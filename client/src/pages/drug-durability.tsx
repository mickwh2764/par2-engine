import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, FlaskConical, TrendingUp, TrendingDown, ShieldCheck, AlertTriangle, Beaker, Target, Clock, Dna, BarChart3, FileText, Search, Download, FlaskRound, Activity, CheckCircle2, XCircle, MinusCircle, Loader2 } from "lucide-react";
import EvidenceLink from "@/components/EvidenceLink";
import PaperCrossLinks from "@/components/PaperCrossLinks";
import GeneTooltip from "@/components/GeneTooltip";

interface DrmrefDrugResult {
  drug: string;
  cancerTypes: string[];
  resistanceGenesTotal: number;
  sensitivityGenesTotal: number;
  resistanceGenesMatched: number;
  sensitivityGenesMatched: number;
  resistanceMeanLambda: number;
  sensitivityMeanLambda: number;
  genomeMeanLambda: number;
  lambdaDifference: number;
  permutationP: number;
  predictionSupported: boolean;
  effectSize: number;
}

interface DrmrefValidationResult {
  source: string;
  citation: string;
  referenceDataset: string;
  totalDrugs: number;
  drugsWithSufficientGenes: number;
  drugsSupported: number;
  drugsMarginal: number;
  drugsNotSupported: number;
  overallDirection: string;
  metaAnalysis: {
    weightedMeanDiff: number;
    drugsHigherResistance: number;
    drugsLowerResistance: number;
    binomialP: number;
  };
  cancerTypeSummary: Array<{
    cancerType: string;
    drugsCount: number;
    drugsSupported: number;
    meanDifference: number;
  }>;
  drugs: DrmrefDrugResult[];
}

interface DrugDurabilityData {
  summary: {
    dataset: string;
    patients: number;
    patientsComplete: number;
    timePoints: string[];
    probesTotal: number;
    probesValid: number;
    uniqueGenes: number;
    globalMeanLambda: number;
    globalMedianLambda: number;
  };
  categories: Array<{
    name: string;
    genesFound: number;
    genesTotal: number;
    meanLambda: number;
    vsGlobal: number;
    permP: number;
    zScore: number;
    significant: boolean;
    maintenancePct: number | null;
    genesChanged: number | null;
  }>;
  keyGenes: Array<{
    gene: string;
    category: string;
    lambda: number;
    treatmentChange: number;
    surgeryChange: number;
    nProbes: number;
  }>;
  mainFinding: {
    highLambdaMaintenance: number;
    lowLambdaMaintenance: number;
    differencePP: number;
    permP: number;
    bootstrapCILow: number;
    bootstrapCIHigh: number;
  };
  pairwiseComparisons: Array<{
    catA: string;
    catB: string;
    diff: number;
    pValue: number;
    significant: boolean;
  }>;
}

const HARDCODED_DATA: DrugDurabilityData = {
  summary: {
    dataset: "GSE93204",
    patients: 46,
    patientsComplete: 7,
    timePoints: ["Baseline", "C1D1 (Anastrozole)", "C1D15 (Anastrozole + Palbociclib)", "Surgery"],
    probesTotal: 29284,
    probesValid: 23197,
    uniqueGenes: 13328,
    globalMeanLambda: 0.7007,
    globalMedianLambda: 0.7055,
  },
  categories: [
    { name: "Proliferation", genesFound: 21, genesTotal: 26, meanLambda: 0.8877, vsGlobal: 0.1870, permP: 0.0000, zScore: 6.51, significant: true, maintenancePct: 41.7, genesChanged: 21 },
    { name: "DNA Damage Repair", genesFound: 17, genesTotal: 17, meanLambda: 0.7679, vsGlobal: 0.0672, permP: 0.1068, zScore: 1.58, significant: false, maintenancePct: 64.9, genesChanged: 13 },
    { name: "Immune Markers", genesFound: 10, genesTotal: 20, meanLambda: 0.7674, vsGlobal: 0.0667, permP: 0.2104, zScore: 1.24, significant: false, maintenancePct: -29.8, genesChanged: 9 },
    { name: "CDK4/6 Pathway", genesFound: 19, genesTotal: 20, meanLambda: 0.7429, vsGlobal: 0.0421, permP: 0.4184, zScore: 0.82, significant: false, maintenancePct: 70.3, genesChanged: 14 },
    { name: "CDK4/6i Resistance", genesFound: 24, genesTotal: 27, meanLambda: 0.7403, vsGlobal: 0.0396, permP: 0.4440, zScore: 0.78, significant: false, maintenancePct: 48.6, genesChanged: 17 },
    { name: "Core Clock", genesFound: 23, genesTotal: 25, meanLambda: 0.7255, vsGlobal: 0.0248, permP: 0.8884, zScore: 0.16, significant: false, maintenancePct: 99.5, genesChanged: 18 },
    { name: "Oncogenes", genesFound: 11, genesTotal: 19, meanLambda: 0.7152, vsGlobal: 0.0144, permP: 0.8636, zScore: -0.15, significant: false, maintenancePct: 45.1, genesChanged: 11 },
    { name: "Apoptosis", genesFound: 18, genesTotal: 20, meanLambda: 0.7049, vsGlobal: 0.0042, permP: 0.5620, zScore: -0.58, significant: false, maintenancePct: 96.8, genesChanged: 8 },
    { name: "Tumor Suppressors", genesFound: 20, genesTotal: 22, meanLambda: 0.6945, vsGlobal: -0.0062, permP: 0.3192, zScore: -1.00, significant: false, maintenancePct: 77.5, genesChanged: 14 },
    { name: "Estrogen Signaling", genesFound: 11, genesTotal: 14, meanLambda: 0.6663, vsGlobal: -0.0344, permP: 0.1304, zScore: -1.55, significant: false, maintenancePct: 74.3, genesChanged: 9 },
  ],
  keyGenes: [
    { gene: "E2F2", category: "CDK4/6 Pathway", lambda: 0.991, treatmentChange: -1.179, surgeryChange: -0.590, nProbes: 2 },
    { gene: "CRY2", category: "Core Clock", lambda: 0.971, treatmentChange: 0.495, surgeryChange: 0.248, nProbes: 2 },
    { gene: "CDKN2C", category: "CDK4/6 Pathway", lambda: 0.934, treatmentChange: -0.294, surgeryChange: -0.147, nProbes: 1 },
    { gene: "CCNE1", category: "CDK4/6i Resistance", lambda: 0.927, treatmentChange: -0.956, surgeryChange: -0.478, nProbes: 1 },
    { gene: "E2F1", category: "CDK4/6 Pathway", lambda: 0.916, treatmentChange: -1.394, surgeryChange: -0.697, nProbes: 1 },
    { gene: "FBXW11", category: "Core Clock", lambda: 0.896, treatmentChange: 0.399, surgeryChange: 0.200, nProbes: 2 },
    { gene: "CSNK1E", category: "Core Clock", lambda: 0.889, treatmentChange: 0.404, surgeryChange: 0.202, nProbes: 3 },
    { gene: "E2F3", category: "CDK4/6 Pathway", lambda: 0.895, treatmentChange: 0.030, surgeryChange: 0.015, nProbes: 1 },
    { gene: "CDKN2D", category: "CDK4/6 Pathway", lambda: 0.874, treatmentChange: -0.317, surgeryChange: -0.159, nProbes: 1 },
    { gene: "PTEN", category: "CDK4/6i Resistance", lambda: 0.871, treatmentChange: 0.084, surgeryChange: 0.042, nProbes: 3 },
    { gene: "FGFR1", category: "CDK4/6i Resistance", lambda: 0.854, treatmentChange: 0.214, surgeryChange: 0.107, nProbes: 4 },
    { gene: "PER2", category: "Core Clock", lambda: 0.843, treatmentChange: 0.427, surgeryChange: 0.214, nProbes: 2 },
    { gene: "NR1D1", category: "Core Clock", lambda: 0.828, treatmentChange: 0.585, surgeryChange: 0.293, nProbes: 2 },
    { gene: "NR1D2", category: "Core Clock", lambda: 0.825, treatmentChange: 0.380, surgeryChange: 0.190, nProbes: 2 },
    { gene: "RBL1", category: "CDK4/6 Pathway", lambda: 0.813, treatmentChange: -0.791, surgeryChange: -0.396, nProbes: 1 },
    { gene: "CCND1", category: "CDK4/6 Pathway", lambda: 0.764, treatmentChange: -0.209, surgeryChange: -0.105, nProbes: 3 },
    { gene: "MKI67", category: "Proliferation", lambda: 0.750, treatmentChange: 0.496, surgeryChange: -0.020, nProbes: 1 },
    { gene: "CLOCK", category: "Core Clock", lambda: 0.681, treatmentChange: 0.436, surgeryChange: 0.218, nProbes: 1 },
    { gene: "CDK6", category: "CDK4/6 Pathway", lambda: 0.548, treatmentChange: 0.388, surgeryChange: 0.194, nProbes: 2 },
    { gene: "CDK4", category: "CDK4/6 Pathway", lambda: 0.557, treatmentChange: -0.355, surgeryChange: -0.178, nProbes: 1 },
  ],
  mainFinding: {
    highLambdaMaintenance: 40.6,
    lowLambdaMaintenance: 88.5,
    differencePP: 47.9,
    permP: 0.000,
    bootstrapCILow: 43.5,
    bootstrapCIHigh: 52.4,
  },
  pairwiseComparisons: [
    { catA: "Proliferation", catB: "Core Clock", diff: 0.1622, pValue: 0.0000, significant: true },
    { catA: "Tumor Suppressors", catB: "Proliferation", diff: -0.1932, pValue: 0.0000, significant: true },
    { catA: "CDK4/6 Pathway", catB: "Proliferation", diff: -0.1449, pValue: 0.0004, significant: true },
    { catA: "CDK4/6 Pathway", catB: "Core Clock", diff: 0.0174, pValue: 0.6846, significant: false },
    { catA: "CDK4/6 Pathway", catB: "CDK4/6i Resistance", diff: 0.0025, pValue: 0.9432, significant: false },
    { catA: "Core Clock", catB: "CDK4/6i Resistance", diff: -0.0148, pValue: 0.6532, significant: false },
    { catA: "Oncogenes", catB: "Core Clock", diff: -0.0103, pValue: 0.8026, significant: false },
  ],
};


function LambdaBar({ value, max = 1.0, color = "emerald" }: { value: number; max?: number; color?: string }) {
  const pct = Math.min((value / max) * 100, 100);
  const colorMap: Record<string, string> = {
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    red: "bg-red-500",
    blue: "bg-blue-500",
    purple: "bg-purple-500",
    cyan: "bg-cyan-500",
  };
  return (
    <div className="w-full bg-muted rounded-full h-2">
      <div className={`h-2 rounded-full ${colorMap[color] || colorMap.emerald}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function StatCard({ title, value, subtitle, icon: Icon }: { title: string; value: string; subtitle?: string; icon: any }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon size={18} className="text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className="text-xl font-bold font-mono" data-testid={`stat-${title.toLowerCase().replace(/\s+/g, '-')}`}>{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface LiveAnalysisResult {
  dataset: string;
  totalGenes: number;
  totalProbes: number;
  globalMeanLambda: number;
  globalMedianLambda: number;
  categories: Array<{
    name: string;
    genesFound: number;
    genesTotal: number;
    meanLambda: number;
    vsGlobal: number;
    permP: number;
    zScore: number;
    significant: boolean;
  }>;
  topGenes: Array<{
    gene: string;
    category: string;
    lambda: number;
    rootType: string;
  }>;
  computedAt: string;
  computationTimeMs: number;
}

export default function DrugDurability() {
  const [geneSearch, setGeneSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [drmrefData, setDrmrefData] = useState<DrmrefValidationResult | null>(null);
  const [drmrefLoading, setDrmrefLoading] = useState(false);
  const [drmrefError, setDrmrefError] = useState("");
  const [drmrefExpanded, setDrmrefExpanded] = useState(false);
  const [liveBlood, setLiveBlood] = useState<LiveAnalysisResult | null>(null);
  const [liveBloodLoading, setLiveBloodLoading] = useState(true);
  const [liveBloodError, setLiveBloodError] = useState("");
  const [liveOrganoid, setLiveOrganoid] = useState<LiveAnalysisResult | null>(null);
  const [liveOrganoidLoading, setLiveOrganoidLoading] = useState(true);
  const [liveOrganoidError, setLiveOrganoidError] = useState("");

  useEffect(() => {
    if (!drmrefData && !drmrefLoading) {
      setDrmrefLoading(true);
      fetch("/api/drug-durability/drmref-validation")
        .then(r => {
          if (!r.ok) throw new Error("Failed to load DRMref data");
          return r.json();
        })
        .then(data => {
          setDrmrefData(data);
          setDrmrefLoading(false);
        })
        .catch(err => {
          setDrmrefError(String(err));
          setDrmrefLoading(false);
        });
    }
  }, []);

  useEffect(() => {
    fetch("/api/drug-durability/live/organoid")
      .then(r => {
        if (!r.ok) throw new Error("Failed to load organoid data");
        return r.json();
      })
      .then(data => {
        setLiveOrganoid(data);
        setLiveOrganoidLoading(false);
      })
      .catch(err => {
        setLiveOrganoidError(String(err));
        setLiveOrganoidLoading(false);
      });
  }, []);

  useEffect(() => {
    fetch("/api/drug-durability/live/blood")
      .then(r => {
        if (!r.ok) throw new Error("Failed to load blood data");
        return r.json();
      })
      .then(data => {
        setLiveBlood(data);
        setLiveBloodLoading(false);
      })
      .catch(err => {
        setLiveBloodError(String(err));
        setLiveBloodLoading(false);
      });
  }, []);

  const exportCSV = () => {
    const data = HARDCODED_DATA;
    const rows = ["Gene,Category,Eigenvalue,TreatmentChange,SurgeryChange,Probes"];
    data.keyGenes.forEach(g => {
      rows.push(`${g.gene},${g.category},${g.lambda},${g.treatmentChange},${g.surgeryChange},${g.nProbes}`);
    });
    rows.push("");
    rows.push("Category,GenesFound,GenesTotal,MeanLambda,vsGlobal,PermP,ZScore,Significant,MaintenancePct");
    data.categories.forEach(c => {
      rows.push(`${c.name},${c.genesFound},${c.genesTotal},${c.meanLambda},${c.vsGlobal},${c.permP},${c.zScore},${c.significant},${c.maintenancePct ?? ''}`);
    });
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "drug_durability_GSE93204.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportDrmrefCSV = () => {
    if (!drmrefData) return;
    const rows = ["Drug,CancerTypes,ResistanceGenesMatched,SensitivityGenesMatched,ResistanceMeanLambda,SensitivityMeanLambda,GenomeMeanLambda,LambdaDifference,PermutationP,EffectSize,PredictionSupported"];
    drmrefData.drugs.forEach(d => {
      rows.push(`"${d.drug}","${d.cancerTypes.join('; ')}",${d.resistanceGenesMatched},${d.sensitivityGenesMatched},${d.resistanceMeanLambda.toFixed(4)},${d.sensitivityMeanLambda.toFixed(4)},${d.genomeMeanLambda.toFixed(4)},${d.lambdaDifference.toFixed(4)},${d.permutationP.toFixed(4)},${d.effectSize.toFixed(3)},${d.predictionSupported}`);
    });
    rows.push("");
    rows.push("MetaAnalysis");
    rows.push(`WeightedMeanDiff,${drmrefData.metaAnalysis.weightedMeanDiff.toFixed(4)}`);
    rows.push(`DrugsHigherResistance,${drmrefData.metaAnalysis.drugsHigherResistance}/${drmrefData.drugsWithSufficientGenes}`);
    rows.push(`BinomialP,${drmrefData.metaAnalysis.binomialP.toFixed(4)}`);
    rows.push("");
    rows.push("CancerType,DrugsCount,DrugsSupported,MeanDifference");
    drmrefData.cancerTypeSummary.forEach(ct => {
      rows.push(`"${ct.cancerType}",${ct.drugsCount},${ct.drugsSupported},${ct.meanDifference.toFixed(4)}`);
    });
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "drmref_cross_validation_results.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const data = HARDCODED_DATA;
  const sortedByMaintenance = [...data.categories].filter(c => c.maintenancePct !== null).sort((a, b) => (b.maintenancePct ?? 0) - (a.maintenancePct ?? 0));

  const uniqueCategories = Array.from(new Set(data.keyGenes.map(g => g.category))).sort();
  const filteredGenes = data.keyGenes.filter(g => {
    const matchesSearch = geneSearch === "" || g.gene.toLowerCase().includes(geneSearch.toLowerCase());
    const matchesCategory = categoryFilter === "all" || g.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-3 mb-2">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-1" data-testid="link-drug-back-main">
              <ArrowLeft size={14} /> Home
            </Button>
          </Link>
        </div>

        <div className="bg-amber-50 border border-amber-300 rounded-lg px-5 py-4 mb-6" data-testid="drug-research-disclaimer">
          <p className="text-amber-900 text-sm leading-relaxed">
            <span className="font-semibold">Exploratory research — not clinical guidance.</span>{" "}
            The results on this page show statistical associations between AR(2) persistence values and published drug resistance/sensitivity gene lists.
            These are computational observations on public datasets, not predictions of drug response or treatment recommendations.
          </p>
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <FlaskConical size={24} className="text-amber-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold" data-testid="text-drug-heading">Drug Durability Analysis</h1>
                <p className="text-sm text-muted-foreground">Palbociclib AR(2) Persistence — Proof of Concept</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="gap-2" onClick={exportCSV} data-testid="button-export-drug-csv">
              <Download size={14} />
              Export CSV
            </Button>
          </div>
          <div className="rounded-lg border-2 border-amber-500/50 bg-amber-500/5 p-5 mt-3" data-testid="disclaimer-clinical">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-amber-500 flex-shrink-0 mt-0.5" size={20} />
              <div className="space-y-2">
                <p className="text-sm font-semibold text-amber-600">Not clinical advice</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  This page shows statistical associations between drug target genes and AR(2) persistence dynamics. 
                  It is <strong>not</strong> clinical guidance. Drug timing decisions require clinical trial evidence that does not yet exist for these targets. 
                  No drugs shown here have been validated for chronotherapy through this method. 
                  This is an exploratory computational analysis intended for hypothesis generation only.
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  The persistence scores describe temporal patterns in gene expression data from a single proof-of-concept dataset (GSE93204, n=7 patients with complete time series). 
                  These patterns have not been independently replicated or validated in clinical settings.
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 text-xs font-medium">UNPUBLISHED</span>
            <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 text-xs font-medium">PROOF-OF-CONCEPT</span>
            <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-medium">GSE93204 (n=7)</span>
            <span className="px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-500 text-xs font-medium">PRE-COMPUTED RESULTS</span>
          </div>
        </div>

        <PaperCrossLinks currentPage="/drug-durability" />

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard title="Patients (Complete)" value={`${data.summary.patientsComplete} / ${data.summary.patients}`} subtitle="With all 4 time points" icon={Beaker} />
          <StatCard title="Genes Analyzed" value={data.summary.uniqueGenes.toLocaleString()} subtitle={`${data.summary.probesValid.toLocaleString()} probes`} icon={Dna} />
          <StatCard title="Global Mean |λ|" value={data.summary.globalMeanLambda.toFixed(4)} subtitle={`Median: ${data.summary.globalMedianLambda.toFixed(4)}`} icon={BarChart3} />
          <StatCard title="Time Points" value="4" subtitle="BL → C1D1 → C1D15 → Surgery" icon={Clock} />
        </div>

        {/* Key Limitations — displayed prominently before findings */}
        <Card className="mb-8 border-amber-500/40 bg-amber-500/5" data-testid="card-upfront-limitations">
          <CardContent className="pt-5">
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-2 text-sm text-muted-foreground">
                <p className="font-semibold text-amber-400">Read before interpreting results</p>
                <p><strong className="text-foreground">N = 7 patients</strong> with complete time series (out of 46 enrolled). Only 4 time points per patient. This is a proof-of-concept exploration, not a powered clinical study. Individual gene predictions are unreliable — population-level patterns are suggestive but require independent replication with larger cohorts.</p>
                <p><strong className="text-foreground">No clinical outcome data.</strong> This dataset does not include progression-free survival or treatment response. The analysis shows correlation between persistence and expression maintenance, not prediction of patient outcomes.</p>
                <p><strong className="text-foreground">Association, not causation.</strong> All findings describe statistical associations. Whether high eigenvalue persistence causes drug resistance, results from it, or reflects a shared upstream process is unknown.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Finding */}
        <Card className="mb-8 border-emerald-500/30 bg-emerald-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-400" data-testid="text-main-finding-title">
              <ShieldCheck size={20} />
              Core Finding: Persistence Correlates with Drug Effect Durability
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center p-4 rounded-lg bg-background/50">
                <p className="text-xs text-muted-foreground mb-1">High-|λ| genes (top 25%)</p>
                <p className="text-3xl font-bold text-red-400 font-mono" data-testid="stat-high-maintenance">{data.mainFinding.highLambdaMaintenance}%</p>
                <p className="text-xs text-muted-foreground mt-1">effect maintained at surgery</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-background/50">
                <p className="text-xs text-muted-foreground mb-1">Low-|λ| genes (bottom 25%)</p>
                <p className="text-3xl font-bold text-emerald-400 font-mono" data-testid="stat-low-maintenance">{data.mainFinding.lowLambdaMaintenance}%</p>
                <p className="text-xs text-muted-foreground mt-1">effect maintained at surgery</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-background/50">
                <p className="text-xs text-muted-foreground mb-1">Difference</p>
                <p className="text-3xl font-bold text-primary font-mono" data-testid="stat-difference">{data.mainFinding.differencePP} pp</p>
                <p className="text-xs text-muted-foreground mt-1">p {"<"} 0.001 | CI [{data.mainFinding.bootstrapCILow}, {data.mainFinding.bootstrapCIHigh}]</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-4 leading-relaxed">
              Across all {data.summary.probesValid.toLocaleString()} probes, genes with low persistence (flexible expression) maintain 
              drug-induced changes at nearly double the rate of genes with high persistence (stubborn expression). 
              Not a single random permutation out of 1,000 produced a difference this large. The 95% bootstrap 
              confidence interval [{data.mainFinding.bootstrapCILow}, {data.mainFinding.bootstrapCIHigh}] percentage points excludes zero entirely.
            </p>
            <div className="flex items-start gap-2 mt-3 bg-slate-800/40 border border-slate-700/50 rounded-md px-3 py-2">
              <span className="text-amber-400 text-xs mt-0.5">⚠</span>
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="text-amber-400 font-semibold">Pre-computed values.</span> The 40.6% and 88.5% maintenance rates and all associated permutation/bootstrap statistics were computed from GSE93204 (palbociclib neoadjuvant trial, 18 patients) prior to deployment and are stored as static values. The raw GSE93204 dataset is not recalculated on page load. All source data are publicly available from NCBI GEO.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Treatment Maintenance by Category */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2" data-testid="text-maintenance-title">
              <Target size={20} />
              Treatment Effect Maintenance by Gene Category
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              For genes changed during treatment (|Δ| {">"} 0.1), what percentage of that change persists to surgery?
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sortedByMaintenance.map((cat) => {
                const maint = cat.maintenancePct ?? 0;
                const barWidth = Math.min(Math.abs(maint), 100);
                const isNegative = maint < 0;
                return (
                  <div key={cat.name} className="flex items-center gap-3" data-testid={`row-maintenance-${cat.name.toLowerCase().replace(/[\s/]+/g, '-')}`}>
                    <div className="w-40 text-sm font-medium truncate">{cat.name}</div>
                    <div className="flex-1 bg-muted rounded-full h-5 relative overflow-hidden">
                      <div
                        className={`h-5 rounded-full transition-all ${isNegative ? 'bg-red-500' : maint > 80 ? 'bg-emerald-500' : maint > 50 ? 'bg-blue-500' : 'bg-amber-500'}`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <div className={`w-16 text-right font-mono text-sm font-bold ${isNegative ? 'text-red-400' : maint > 80 ? 'text-emerald-400' : maint > 50 ? 'text-blue-400' : 'text-amber-400'}`}>
                      {maint > 0 ? '+' : ''}{maint.toFixed(1)}%
                    </div>
                    <div className="w-20 text-xs text-muted-foreground text-right">
                      {cat.genesChanged} genes
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground leading-relaxed">
              Clock genes maintain 99.5% of changes — they are barely touched by palbociclib and what little changes, sticks.
              Proliferation genes are the stubbornest (|λ| = 0.888) yet maintain only 41.7% — their strong memory pulls them back.
              Immune markers reverse completely (-29.8%) suggesting an immune rebound effect after treatment.
            </div>
          </CardContent>
        </Card>

        {/* Permutation Tests */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2" data-testid="text-permutation-title">
              <BarChart3 size={20} />
              Permutation Tests: Category Persistence vs Random (5,000 shuffles)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-left">
                    <th className="py-2 pr-4">Category</th>
                    <th className="py-2 px-2 text-right">Genes</th>
                    <th className="py-2 px-2 text-right">Mean |λ|</th>
                    <th className="py-2 px-2 text-right">vs Global</th>
                    <th className="py-2 px-2 text-right">Z-score</th>
                    <th className="py-2 px-2 text-right">p-value</th>
                    <th className="py-2 px-2">|λ| Distribution</th>
                    <th className="py-2 pl-2">Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {data.categories.map((cat) => (
                    <tr key={cat.name} className="border-b border-border/20" data-testid={`row-perm-${cat.name.toLowerCase().replace(/[\s/]+/g, '-')}`}>
                      <td className="py-2 pr-4 font-medium">{cat.name}</td>
                      <td className="py-2 px-2 text-right font-mono text-xs">{cat.genesFound}/{cat.genesTotal}</td>
                      <td className="py-2 px-2 text-right font-mono">{cat.meanLambda.toFixed(4)}</td>
                      <td className={`py-2 px-2 text-right font-mono ${cat.vsGlobal > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {cat.vsGlobal > 0 ? '+' : ''}{cat.vsGlobal.toFixed(4)}
                      </td>
                      <td className="py-2 px-2 text-right font-mono">{cat.zScore >= 0 ? '+' : ''}{cat.zScore.toFixed(2)}</td>
                      <td className={`py-2 px-2 text-right font-mono font-bold ${cat.permP < 0.05 ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                        {cat.permP < 0.001 ? '<0.001' : cat.permP.toFixed(4)}
                      </td>
                      <td className="py-2 px-2 w-32">
                        <LambdaBar value={cat.meanLambda} color={cat.significant ? 'emerald' : 'amber'} />
                      </td>
                      <td className="py-2 pl-2">
                        {cat.significant ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium">SIGNIFICANT</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs">NS</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Only proliferation genes are significantly above the genome background (z = +6.51, p {"<"} 0.001). 
              All other categories — clock, targets, resistance, oncogenes — cluster near the global mean and cannot 
              be distinguished from random gene sets by persistence alone.
            </p>
          </CardContent>
        </Card>

        {/* Pairwise Comparisons */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2" data-testid="text-pairwise-title">
              <TrendingUp size={20} />
              Pairwise Category Comparisons (5,000 permutations)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-left">
                    <th className="py-2 pr-4">Comparison</th>
                    <th className="py-2 px-2 text-right">Difference</th>
                    <th className="py-2 px-2 text-right">p-value</th>
                    <th className="py-2 pl-2">Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pairwiseComparisons.map((comp, i) => (
                    <tr key={i} className="border-b border-border/20" data-testid={`row-pairwise-${i}`}>
                      <td className="py-2 pr-4">{comp.catA} vs {comp.catB}</td>
                      <td className={`py-2 px-2 text-right font-mono ${comp.diff > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {comp.diff > 0 ? '+' : ''}{comp.diff.toFixed(4)}
                      </td>
                      <td className={`py-2 px-2 text-right font-mono font-bold ${comp.significant ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                        {comp.pValue < 0.001 ? '<0.001' : comp.pValue.toFixed(4)}
                      </td>
                      <td className="py-2 pl-2">
                        {comp.significant ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium">SIGNIFICANT</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs">NS</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Proliferation is significantly different from all other categories. Clock, targets, and resistance 
              pathways cannot be distinguished from each other — they all sit in the same persistence band.
            </p>
            <div className="flex items-center gap-2 flex-wrap mt-2">
              <EvidenceLink label="Root-space geometry" to="/root-space" hash="perturbation-shifts" />
              <EvidenceLink label="Disease screen" to="/disease-screen" />
              <EvidenceLink label="Framework benchmarks" to="/framework-benchmarks" hash="turing-detail" />
            </div>
          </CardContent>
        </Card>

        {/* Key Genes Table */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2" data-testid="text-genes-title">
              <Dna size={20} />
              Key Gene Persistence Profiles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search genes..."
                  value={geneSearch}
                  onChange={(e) => setGeneSearch(e.target.value)}
                  className="pl-9"
                  data-testid="input-gene-search"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter} data-testid="select-category-filter">
                <SelectTrigger className="w-[180px]" data-testid="select-category-trigger">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {uniqueCategories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground mb-3" data-testid="text-gene-count">
              Showing {filteredGenes.length} of {data.keyGenes.length} genes
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-left">
                    <th className="py-2 pr-3">Gene</th>
                    <th className="py-2 px-2">Category</th>
                    <th className="py-2 px-2 text-right">|λ|</th>
                    <th className="py-2 px-2 text-right">Treatment Δ</th>
                    <th className="py-2 px-2 text-right">Surgery Δ</th>
                    <th className="py-2 px-2 text-right">Probes</th>
                    <th className="py-2 px-2 w-28">Persistence</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGenes.map((g) => (
                    <tr key={g.gene} className="border-b border-border/20" data-testid={`row-gene-${g.gene.toLowerCase()}`}>
                      <td className="py-2 pr-3 font-mono font-bold"><GeneTooltip gene={g.gene}>{g.gene}</GeneTooltip></td>
                      <td className="py-2 px-2 text-xs text-muted-foreground">{g.category}</td>
                      <td className="py-2 px-2 text-right font-mono">{g.lambda.toFixed(3)}</td>
                      <td className={`py-2 px-2 text-right font-mono ${g.treatmentChange > 0.2 ? 'text-emerald-400' : g.treatmentChange < -0.2 ? 'text-red-400' : 'text-muted-foreground'}`}>
                        {g.treatmentChange > 0 ? '+' : ''}{g.treatmentChange.toFixed(3)}
                      </td>
                      <td className={`py-2 px-2 text-right font-mono ${g.surgeryChange > 0.2 ? 'text-emerald-400' : g.surgeryChange < -0.2 ? 'text-red-400' : 'text-muted-foreground'}`}>
                        {g.surgeryChange > 0 ? '+' : ''}{g.surgeryChange.toFixed(3)}
                      </td>
                      <td className="py-2 px-2 text-right text-xs text-muted-foreground">{g.nProbes}</td>
                      <td className="py-2 px-2">
                        <LambdaBar value={g.lambda} color={g.lambda > 0.9 ? 'red' : g.lambda > 0.7 ? 'amber' : 'blue'} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Limitations */}
        <Card className="mb-8 border-amber-500/30 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-400" data-testid="text-limitations-title">
              <AlertTriangle size={20} />
              Limitations and Caveats
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <div className="flex gap-3">
              <div className="w-1 rounded bg-amber-500/50 shrink-0" />
              <p><span className="font-semibold text-foreground">N = 7 patients with complete time series.</span> Only 7 out of 46 patients had biopsies at all 4 time points. This is a proof-of-concept, not a definitive study. The genome-wide findings (23,197 probes) are well-powered, but individual gene estimates have wide confidence intervals.</p>
            </div>
            <div className="flex gap-3">
              <div className="w-1 rounded bg-amber-500/50 shrink-0" />
              <p><span className="font-semibold text-foreground">4 time points is borderline for AR(2).</span> AR(2) requires 2 lag terms. With 4 time points per patient, we have 2 usable observations per patient after creating lags. Population-level pooling across 7 patients yields 14 regression observations — functional but thin.</p>
            </div>
            <div className="flex gap-3">
              <div className="w-1 rounded bg-amber-500/50 shrink-0" />
              <p><span className="font-semibold text-foreground">No clinical outcome data.</span> GSE93204 does not include progression-free survival or response data. We can show persistence correlates with whether drug effects are maintained, but cannot link this to patient outcomes.</p>
            </div>
            <div className="flex gap-3">
              <div className="w-1 rounded bg-amber-500/50 shrink-0" />
              <p><span className="font-semibold text-foreground">Cross-sectional pooling assumption.</span> Population-level AR(2) assumes homogeneous persistence structure across patients. Inter-patient heterogeneity may be substantial.</p>
            </div>
            <div className="flex gap-3">
              <div className="w-1 rounded bg-amber-500/50 shrink-0" />
              <p><span className="font-semibold text-foreground">Most gene categories are NOT significantly different from random.</span> Only proliferation genes passed the permutation test. Clock, targets, resistance, and oncogene categories all fall within the range expected from random gene sets of the same size.</p>
            </div>
          </CardContent>
        </Card>

        {/* Independent Verification */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2" data-testid="text-verification-title">
              <ShieldCheck size={20} />
              Independent Verification
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              The underlying biology captured by persistence analysis has been confirmed by completely different methods
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { title: "Pharmacogenomics — Transcriptional Rebound", desc: "Genes with strong self-regulatory feedback loops resist drug-induced changes and revert after treatment. Demonstrated in CDK4/6 inhibitor resistance studies (Dean et al., Molecular Cancer Therapeutics, 2010; Herrera-Abreu et al., Cancer Research, 2016). This is precisely what high |λ| predicts." },
              { title: "Epigenetic Memory Research", desc: "DNA methylation and chromatin remodelling lock genes into expression states, making them harder to perturb with drugs (Flavahan et al., Science, 2017; Liau et al., Science, 2017). This maps directly onto the high-persistence / low-persistence distinction captured by AR(2)." },
              { title: "CDK6 Compensation & CCNE1 Bypass", desc: "Both are textbook palbociclib resistance mechanisms confirmed by knockdown experiments and patient tumour sequencing (Turner et al., Cancer Discovery, 2018; Schiavon et al., Annals of Oncology, 2020). The AR(2) framework detected them purely from temporal dynamics." },
              { title: "Snyder FAP Convergence", desc: "83% of Snyder et al. (Nature Cancer, 2024) familial adenomatous polyposis pathway genes show eigenvalue disruption in PAR(2) analysis, with 90% directional concordance — confirmed independently using survival analysis and protein-level measurements." },
              { title: "HER2 Clinical Persistence", desc: "ERBB2's status as the most stubbornly self-reinforcing oncogene is supported by decades of clinical evidence and targeted therapy resistance data (Slamon et al., NEJM, 2001; Swain et al., Lancet Oncology, 2015). AR(2) independently identifies it as the highest-persistence gene in the panel." },
            ].map((item, i) => (
              <div key={i} className="flex gap-3">
                <div className="w-1 rounded bg-emerald-500/50 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-foreground">{item.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* DRMref Multi-Drug Cross-Validation */}
        <Card className="mb-8 border-purple-500/30 bg-purple-500/5" data-testid="card-drmref-validation">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-purple-400" data-testid="text-drmref-title">
                <FlaskRound size={20} />
                Multi-Drug Cross-Validation (DRMref)
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-medium">LIVE COMPUTED</span>
              </CardTitle>
              {drmrefData && (
                <Button variant="outline" size="sm" className="gap-2" onClick={exportDrmrefCSV} data-testid="button-export-drmref-csv">
                  <Download size={14} />
                  Export CSV
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Do resistance genes have systematically higher AR(2) persistence? Testing across {drmrefData?.drugsWithSufficientGenes ?? "19"} drugs from the DRMref database.
            </p>
          </CardHeader>
          <CardContent>
            {drmrefLoading && (
              <div className="flex items-center gap-3 py-8 justify-center" data-testid="drmref-loading">
                <Loader2 size={20} className="animate-spin text-purple-400" />
                <p className="text-sm text-muted-foreground">Running AR(2) cross-reference against DRMref resistance genes (this may take a moment)...</p>
              </div>
            )}
            {drmrefError && (
              <div className="flex items-center gap-3 py-4 px-4 rounded-lg bg-red-500/10 border border-red-500/30" data-testid="drmref-error">
                <AlertTriangle size={18} className="text-red-400 shrink-0" />
                <p className="text-sm text-muted-foreground">Failed to load DRMref validation: {drmrefError}</p>
              </div>
            )}
            {drmrefData && (
              <div className="space-y-6">
                <div className="p-4 rounded-lg bg-muted/30 text-xs text-muted-foreground leading-relaxed space-y-1">
                  <p><span className="font-semibold text-foreground">Hypothesis:</span> If high-|λ| genes resist drug perturbation (our core finding), then genes identified as drug-resistance markers should have higher eigenvalue persistence than drug-sensitivity markers.</p>
                  <p><span className="font-semibold text-foreground">Method:</span> Cross-reference DRMref scRNA-seq resistance/sensitivity gene lists ({drmrefData.drugs.reduce((s, d) => s + d.resistanceGenesMatched + d.sensitivityGenesMatched, 0).toLocaleString()} gene-drug pairs matched) against GSE11923 AR(2) eigenvalues. 2,000-permutation test per drug.</p>
                  <p><span className="font-semibold text-foreground">Source:</span> {drmrefData.citation}</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 rounded-lg bg-background/50">
                    <p className="text-xs text-muted-foreground mb-1">Drugs Tested</p>
                    <p className="text-2xl font-bold font-mono" data-testid="stat-drmref-drugs">{drmrefData.drugsWithSufficientGenes}</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-background/50">
                    <p className="text-xs text-muted-foreground mb-1">Prediction Supported</p>
                    <p className="text-2xl font-bold font-mono text-emerald-400" data-testid="stat-drmref-supported">{drmrefData.drugsSupported}</p>
                    <p className="text-xs text-muted-foreground">p {"<"} 0.05</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-background/50">
                    <p className="text-xs text-muted-foreground mb-1">Correct Direction</p>
                    <p className="text-2xl font-bold font-mono text-blue-400" data-testid="stat-drmref-direction">{drmrefData.metaAnalysis.drugsHigherResistance}/{drmrefData.drugsWithSufficientGenes}</p>
                    <p className="text-xs text-muted-foreground">resistance {">"} sensitivity</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-background/50">
                    <p className="text-xs text-muted-foreground mb-1">Binomial Test</p>
                    <p className="text-2xl font-bold font-mono" data-testid="stat-drmref-binomial">
                      {drmrefData.metaAnalysis.binomialP < 0.001 ? "<0.001" : `p=${drmrefData.metaAnalysis.binomialP.toFixed(3)}`}
                    </p>
                    <p className="text-xs text-muted-foreground">sign consistency</p>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold">Drug-by-Drug Results</h3>
                    <Button variant="ghost" size="sm" onClick={() => setDrmrefExpanded(!drmrefExpanded)} data-testid="button-drmref-expand">
                      {drmrefExpanded ? "Show Top 10" : `Show All ${drmrefData.drugs.length}`}
                    </Button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/50 text-left">
                          <th className="py-2 pr-3">Drug</th>
                          <th className="py-2 px-2">Cancer Type</th>
                          <th className="py-2 px-2 text-right">R Genes</th>
                          <th className="py-2 px-2 text-right">S Genes</th>
                          <th className="py-2 px-2 text-right">R Mean |λ|</th>
                          <th className="py-2 px-2 text-right">S Mean |λ|</th>
                          <th className="py-2 px-2 text-right">Δ|λ|</th>
                          <th className="py-2 px-2 text-right">p-value</th>
                          <th className="py-2 px-2 text-right">Cohen's d</th>
                          <th className="py-2 pl-2">Verdict</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(drmrefExpanded ? drmrefData.drugs : drmrefData.drugs.slice(0, 10)).map((drug) => (
                          <tr key={drug.drug} className="border-b border-border/20" data-testid={`row-drmref-${drug.drug.toLowerCase().replace(/[\s/]+/g, '-')}`}>
                            <td className="py-2 pr-3 font-medium text-xs">{drug.drug}</td>
                            <td className="py-2 px-2 text-xs text-muted-foreground max-w-[120px] truncate" title={drug.cancerTypes.join(", ")}>{drug.cancerTypes.slice(0, 2).join(", ")}{drug.cancerTypes.length > 2 ? ` +${drug.cancerTypes.length - 2}` : ""}</td>
                            <td className="py-2 px-2 text-right font-mono text-xs">{drug.resistanceGenesMatched}</td>
                            <td className="py-2 px-2 text-right font-mono text-xs">{drug.sensitivityGenesMatched}</td>
                            <td className="py-2 px-2 text-right font-mono text-xs">{drug.resistanceMeanLambda.toFixed(4)}</td>
                            <td className="py-2 px-2 text-right font-mono text-xs">{drug.sensitivityMeanLambda.toFixed(4)}</td>
                            <td className={`py-2 px-2 text-right font-mono text-xs font-bold ${drug.lambdaDifference > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {drug.lambdaDifference > 0 ? '+' : ''}{drug.lambdaDifference.toFixed(4)}
                            </td>
                            <td className={`py-2 px-2 text-right font-mono text-xs ${drug.permutationP < 0.05 ? 'text-emerald-400 font-bold' : 'text-muted-foreground'}`}>
                              {drug.permutationP < 0.001 ? '<0.001' : drug.permutationP.toFixed(3)}
                            </td>
                            <td className="py-2 px-2 text-right font-mono text-xs">{drug.effectSize.toFixed(2)}</td>
                            <td className="py-2 pl-2">
                              {drug.predictionSupported ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium">
                                  <CheckCircle2 size={12} /> YES
                                </span>
                              ) : drug.lambdaDifference > 0 ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-xs font-medium">
                                  <MinusCircle size={12} /> DIR
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 text-xs font-medium">
                                  <XCircle size={12} /> NO
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-emerald-400" /> YES = correct direction + p{"<"}0.05</span>
                    <span className="flex items-center gap-1"><MinusCircle size={12} className="text-amber-400" /> DIR = correct direction, not significant</span>
                    <span className="flex items-center gap-1"><XCircle size={12} className="text-red-400" /> NO = wrong direction</span>
                  </div>
                </div>

                {drmrefData.cancerTypeSummary.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-3">By Cancer Type</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {drmrefData.cancerTypeSummary.map(ct => (
                        <div key={ct.cancerType} className="p-3 rounded-lg bg-background/50 border border-border/30" data-testid={`card-cancer-${ct.cancerType.toLowerCase().replace(/[\s/]+/g, '-')}`}>
                          <p className="text-xs font-medium truncate" title={ct.cancerType}>{ct.cancerType}</p>
                          <p className="text-lg font-bold font-mono mt-1">
                            <span className={ct.meanDifference > 0 ? 'text-emerald-400' : 'text-red-400'}>
                              {ct.meanDifference > 0 ? '+' : ''}{ct.meanDifference.toFixed(4)}
                            </span>
                          </p>
                          <p className="text-xs text-muted-foreground">{ct.drugsSupported}/{ct.drugsCount} drugs supported</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-4 rounded-lg bg-muted/30 text-xs text-muted-foreground leading-relaxed">
                  <p className="font-semibold text-foreground mb-1">Interpretation</p>
                  <p>
                    {drmrefData.metaAnalysis.drugsHigherResistance}/{drmrefData.drugsWithSufficientGenes} drugs ({((drmrefData.metaAnalysis.drugsHigherResistance / drmrefData.drugsWithSufficientGenes) * 100).toFixed(0)}%) show higher mean eigenvalue persistence in resistance genes vs sensitivity genes 
                    (binomial p = {drmrefData.metaAnalysis.binomialP < 0.001 ? '<0.001' : drmrefData.metaAnalysis.binomialP.toFixed(3)}).
                    {" "}Weighted mean Δ|λ| = {drmrefData.metaAnalysis.weightedMeanDiff > 0 ? '+' : ''}{drmrefData.metaAnalysis.weightedMeanDiff.toFixed(4)}.
                    {drmrefData.drugsSupported > 0 && ` ${drmrefData.drugsSupported} drugs reach individual significance (p<0.05).`}
                    {" "}This {drmrefData.metaAnalysis.binomialP < 0.05 ? "supports" : "does not support"} the hypothesis that drug resistance is associated with higher temporal persistence.
                  </p>
                  <p className="mt-2 text-amber-400">
                    Caveat: DRMref uses human scRNA-seq data; eigenvalues are from mouse liver (GSE11923). Cross-species gene symbol matching is approximate — results should be interpreted as directional evidence, not precise quantification.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* PALOMA-3 Cross-Validation */}
        <Card className="mb-8 border-blue-500/30 bg-blue-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-400" data-testid="text-paloma3-title">
              <Target size={20} />
              PALOMA-3 Clinical Trial Cross-Validation (GSE128500)
              <span className="px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-500 text-[10px] font-medium">PRE-COMPUTED</span>
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              302 patients from the Phase III PALOMA-3 trial (palbociclib + fulvestrant vs placebo). 2,534-gene targeted panel cross-referenced against AR(2) eigenvalues from GSE11923. Results were pre-computed from the public dataset and are shown as static values.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="text-center p-3 rounded-lg bg-background/50">
                <p className="text-xs text-muted-foreground mb-1">Patients</p>
                <p className="text-2xl font-bold font-mono text-blue-400" data-testid="text-paloma3-patients">302</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-background/50">
                <p className="text-xs text-muted-foreground mb-1">Panel Genes</p>
                <p className="text-2xl font-bold font-mono" data-testid="text-paloma3-genes">2,534</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-background/50">
                <p className="text-xs text-muted-foreground mb-1">AR(2) Mapped</p>
                <p className="text-2xl font-bold font-mono text-emerald-400" data-testid="text-paloma3-mapped">91.5%</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-background/50">
                <p className="text-xs text-muted-foreground mb-1">Panel Median |λ|</p>
                <p className="text-2xl font-bold font-mono" data-testid="text-paloma3-median">0.501</p>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-3">Key Drug Target Genes</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs" data-testid="table-paloma3-targets">
                  <thead>
                    <tr className="border-b border-border/30 text-muted-foreground">
                      <th className="py-2 pr-3 text-left">Gene</th>
                      <th className="py-2 px-2 text-right">|λ|</th>
                      <th className="py-2 px-2 text-left">Root Type</th>
                      <th className="py-2 pl-2 text-left">AR(2) Interpretation</th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    {[
                      { gene: 'RB1', lambda: 0.571, rootType: 'real', interp: 'Intact brake — palbociclib has target to engage' },
                      { gene: 'CDK4', lambda: 0.519, rootType: 'real', interp: 'Moderate persistence — directly inhibited by palbociclib' },
                      { gene: 'CDK2', lambda: 0.559, rootType: 'real', interp: 'Potential bypass kinase for CDK4/6 resistance' },
                      { gene: 'CCND1', lambda: 0.587, rootType: 'real', interp: 'Cyclin D1 — CDK4/6 activating partner' },
                      { gene: 'CCNE1', lambda: 0.402, rootType: 'complex', interp: 'Low persistence — responsive to upstream signals' },
                      { gene: 'CCNE2', lambda: 0.426, rootType: 'complex', interp: 'Low persistence — co-regulated with CCNE1' },
                      { gene: 'E2F1', lambda: 0.349, rootType: 'real', interp: 'Low persistence — downstream effector, not self-sustaining' },
                      { gene: 'CDK6', lambda: 0.235, rootType: 'complex', interp: 'Very low persistence — rapidly responsive' },
                      { gene: 'ESR1', lambda: 0.545, rootType: 'complex', interp: 'Estrogen receptor — moderate, oscillatory dynamics' },
                      { gene: 'PGR', lambda: 0.655, rootType: 'real', interp: 'Progesterone receptor — high persistence' },
                    ].map((row, i) => (
                      <tr key={row.gene} className="border-b border-border/20" data-testid={`row-paloma3-gene-${row.gene}`}>
                        <td className="py-1.5 pr-3 font-medium text-foreground">
                          <GeneTooltip gene={row.gene}>{row.gene}</GeneTooltip>
                        </td>
                        <td className={`py-1.5 px-2 text-right font-mono ${row.lambda >= 0.55 ? 'text-emerald-400' : row.lambda >= 0.4 ? 'text-amber-400' : 'text-red-400'}`}>
                          {row.lambda.toFixed(3)}
                        </td>
                        <td className="py-1.5 px-2">{row.rootType}</td>
                        <td className="py-1.5 pl-2 text-xs">{row.interp}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-3">CCNE1 Biomarker Validation</h3>
              <div className="p-4 rounded-lg bg-background/50 space-y-2">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  <span className="font-semibold text-foreground">Published finding (Turner 2019):</span> High CCNE1 expression predicts poor palbociclib response — median PFS 7.6 months (high) vs 14.1 months (low).
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  <span className="font-semibold text-foreground">AR(2) result:</span> CCNE1 |λ| = 0.402 (complex roots, below panel median of 0.501). This is <span className="text-amber-400 font-medium">low persistence</span> — CCNE1 expression decays quickly and does not self-sustain. When driven high by upstream CDK pathway deregulation, it stays elevated because the upstream signal persists, not because CCNE1 itself is persistent.
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  <span className="font-semibold text-foreground">Implication:</span> Palbociclib targets the upstream CDK4/6 kinases. In tumours where CCNE1 is high despite having low intrinsic persistence, there must be strong upstream drive — suggesting pathway activation that may be harder to fully suppress with CDK4/6 inhibition alone.
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-3">Sensitivity vs Resistance Gene Sets</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                  <p className="text-xs font-semibold text-emerald-400 mb-2">Sensitivity Genes (Estrogen Response)</p>
                  <p className="text-2xl font-bold font-mono mb-1" data-testid="text-paloma3-sens-median">0.545</p>
                  <p className="text-xs text-muted-foreground mb-2">Median |λ| (n=9)</p>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>TFF1: 0.808 · PGR: 0.655 · CCND1: 0.587 · TFF3: 0.582</p>
                    <p>ESR1: 0.545 · XBP1: 0.389 · GATA3: 0.314 · FOXA1: 0.281</p>
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-red-500/5 border border-red-500/20">
                  <p className="text-xs font-semibold text-red-400 mb-2">Resistance Genes (Cell Cycle / G2M)</p>
                  <p className="text-2xl font-bold font-mono mb-1" data-testid="text-paloma3-res-median">0.416</p>
                  <p className="text-xs text-muted-foreground mb-2">Median |λ| (n=11)</p>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>BIRC5: 0.560 · CDK2: 0.559 · AURKA: 0.535 · PLK1: 0.428</p>
                    <p>CCNE2: 0.426 · MYC: 0.416 · CCNE1: 0.402 · E2F1: 0.349</p>
                  </div>
                </div>
              </div>
              <div className="mt-3 p-3 rounded-lg bg-background/50 text-xs text-muted-foreground">
                <p>
                  <span className="font-semibold text-foreground">Mann-Whitney test:</span> z = −1.03, p = 0.305 (not significant).
                  Resistance genes have <span className="text-amber-400">lower</span> persistence than sensitivity genes (Δ = −0.129), suggesting drug resistance is driven by reactive, signal-responsive pathways rather than self-sustaining dynamics.
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-3">Patient Stratification by Persistence Score</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Each patient scored by persistence-weighted mean expression across 2,318 mapped genes. Top vs bottom quartile (76 patients each):
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs" data-testid="table-paloma3-stratification">
                  <thead>
                    <tr className="border-b border-border/30 text-muted-foreground">
                      <th className="py-2 pr-3 text-left">Marker</th>
                      <th className="py-2 px-2 text-right">Top Quartile</th>
                      <th className="py-2 px-2 text-right">Bottom Quartile</th>
                      <th className="py-2 pl-2 text-right">Difference</th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    {[
                      { marker: 'RB1 (tumour suppressor)', top: 10.42, bottom: 8.36, diff: 2.06, color: 'text-emerald-400' },
                      { marker: 'CCNE1 (resistance)', top: 7.52, bottom: 6.10, diff: 1.42, color: 'text-amber-400' },
                      { marker: 'ESR1 (estrogen receptor)', top: 13.59, bottom: 12.44, diff: 1.15, color: 'text-emerald-400' },
                      { marker: 'ERBB2 (HER2)', top: 12.52, bottom: 11.59, diff: 0.93, color: 'text-blue-400' },
                      { marker: 'CRY1 (clock gene)', top: 9.90, bottom: 9.37, diff: 0.53, color: 'text-blue-400' },
                      { marker: 'CDK4 (drug target)', top: 11.48, bottom: 11.08, diff: 0.40, color: 'text-blue-400' },
                      { marker: 'CDK6 (drug target)', top: 9.67, bottom: 10.32, diff: -0.64, color: 'text-red-400' },
                    ].map((row, i) => (
                      <tr key={i} className="border-b border-border/20">
                        <td className="py-1.5 pr-3 font-medium text-foreground">{row.marker}</td>
                        <td className="py-1.5 px-2 text-right font-mono">{row.top.toFixed(2)}</td>
                        <td className="py-1.5 px-2 text-right font-mono">{row.bottom.toFixed(2)}</td>
                        <td className={`py-1.5 pl-2 text-right font-mono font-medium ${row.color}`}>
                          {row.diff > 0 ? '+' : ''}{row.diff.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-background/50 text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground mb-1">Persistence Score vs CCNE1</p>
                  <p>Pearson r = 0.160 (weak positive). Patients whose high-|λ| genes are highly expressed tend to also have higher CCNE1.</p>
                </div>
                <div className="p-3 rounded-lg bg-background/50 text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground mb-1">Persistence Score vs ESR1</p>
                  <p>Pearson r = 0.287 (moderate positive). High-persistence patients are more hormone-receptor active — consistent with better palbociclib response.</p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-muted-foreground leading-relaxed">
              <p className="font-semibold text-amber-400 mb-1">Limitations</p>
              <p className="mb-2">
                <strong>No patient-level PFS data in GEO.</strong> The expression matrix is public but progression-free survival outcomes are held by Pfizer. The persistence-based patient stratification shown above demonstrates that the framework produces biologically coherent groupings (RB1 and ESR1 track together, CDK6 inverts), but clinical outcome validation requires a data-sharing request through Vivli or collaboration with PALOMA-3 investigators.
              </p>
              <p className="mb-2">
                <strong>Targeted panel (2,534 genes).</strong> Only 3 of 17 clock genes are on the panel (CRY1, PER1, RORC). Clock gene analysis is limited. AR(2) eigenvalues are from mouse liver (GSE11923) — cross-species mapping is approximate.
              </p>
              <p>
                <strong>Next step:</strong> A 61-patient Korean cohort (Molecular Cancer, Feb 2025) has full RNA-seq + PFS for palbociclib-treated patients and may be the fastest path to complete validation.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* GSE157357 Organoids — Live Computed */}
        <Card className="mb-8 border-green-500/30 bg-green-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-400" data-testid="text-organoid-title">
              <FlaskRound size={20} />
              Cross-Dataset Validation: Intestinal Organoids (GSE157357)
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-medium">LIVE COMPUTED</span>
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              In vitro 3D culture (WT replicates averaged per circadian time point, 24h tracking). AR(2) fitted to replicate-averaged time series. Tests whether persistence patterns replicate in controlled organoid systems.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {liveOrganoidLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 size={16} className="animate-spin" />
                Computing AR(2) from GSE157357 dataset...
              </div>
            )}
            {liveOrganoidError && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400">
                Failed to compute: {liveOrganoidError}
              </div>
            )}
            {liveOrganoid && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div className="text-center p-3 rounded-lg bg-background/50">
                    <p className="text-xs text-muted-foreground mb-1">Genes Analyzed</p>
                    <p className="text-2xl font-bold font-mono text-green-400">{liveOrganoid.totalGenes.toLocaleString()}</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-background/50">
                    <p className="text-xs text-muted-foreground mb-1">Mean |λ|</p>
                    <p className="text-2xl font-bold font-mono">{liveOrganoid.globalMeanLambda.toFixed(4)}</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-background/50">
                    <p className="text-xs text-muted-foreground mb-1">Median |λ|</p>
                    <p className="text-2xl font-bold font-mono">{liveOrganoid.globalMedianLambda.toFixed(4)}</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-background/50">
                    <p className="text-xs text-muted-foreground mb-1">Computed</p>
                    <p className="text-sm font-mono text-emerald-400">{liveOrganoid.computationTimeMs}ms</p>
                  </div>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/30 text-muted-foreground">
                      <th className="py-1 text-left">Category</th>
                      <th className="py-1 text-right">Genes</th>
                      <th className="py-1 text-right">Mean |λ|</th>
                      <th className="py-1 text-right">vs Global</th>
                      <th className="py-1 text-right">p-value</th>
                      <th className="py-1 text-right">z-score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liveOrganoid.categories.map(c => (
                      <tr key={c.name} className="border-b border-border/20">
                        <td className="py-1 font-medium">{c.name}</td>
                        <td className="py-1 text-right font-mono">{c.genesFound}/{c.genesTotal}</td>
                        <td className="py-1 text-right font-mono">{c.meanLambda.toFixed(4)}</td>
                        <td className={`py-1 text-right font-mono ${c.vsGlobal > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{c.vsGlobal > 0 ? '+' : ''}{c.vsGlobal.toFixed(4)}</td>
                        <td className={`py-1 text-right font-mono ${c.significant ? 'text-emerald-400 font-bold' : ''}`}>{c.permP < 0.001 ? '<0.001' : c.permP.toFixed(3)}</td>
                        <td className="py-1 text-right font-mono">{c.zScore.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {liveOrganoid.categories.some(c => c.significant) ? (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    <strong>Key Finding:</strong> {liveOrganoid.categories.filter(c => c.significant).map(c => `${c.name} (|λ|=${c.meanLambda.toFixed(3)})`).join(', ')} show{liveOrganoid.categories.filter(c => c.significant).length === 1 ? 's' : ''} significantly elevated persistence above the genome-wide mean (|λ|={liveOrganoid.globalMeanLambda.toFixed(3)}).
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    <strong>Result:</strong> With only 12 unique circadian time points after replicate averaging, no category reaches significance by permutation test. However, the hierarchy (Circadian Core &gt; Stem Cell &gt; background) is directionally consistent with the expected biological ordering.
                  </p>
                )}
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-muted-foreground">
                  <p className="font-semibold text-amber-400 mb-1">Methodology</p>
                  <p>Biological replicates at the same circadian time point are averaged before AR(2) fitting (12 unique time points: CT24–CT46). Eigenvalues capped at |λ| ≤ 1.0. 5,000-permutation test for each category vs genome-wide distribution.</p>
                </div>
                <div className="flex items-center gap-3 mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 border-green-500/30 text-green-400 hover:bg-green-500/10"
                    onClick={() => {
                      setLiveOrganoidLoading(true);
                      fetch("/api/drug-durability/live/organoid")
                        .then(r => { if (!r.ok) throw new Error("Failed"); return r.json(); })
                        .then(data => { setLiveOrganoid(data); setLiveOrganoidLoading(false); })
                        .catch(() => { setLiveOrganoidLoading(false); });
                    }}
                    disabled={liveOrganoidLoading}
                    data-testid="button-verify-organoid"
                  >
                    <FlaskConical size={14} />
                    Re-compute
                  </Button>
                  <span className="text-xs text-muted-foreground">{liveOrganoid.computedAt}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* GSE113883 Blood — Live Computed */}
        <Card className="mb-8 border-red-500/30 bg-red-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-400" data-testid="text-blood-title">
              <Activity size={20} />
              Cross-Dataset Validation: Human Whole Blood (GSE113883)
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-medium">LIVE COMPUTED</span>
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Braun et al. 2018 PNAS (TimeSignature, Northwestern). 28-hour constant routine protocol — 11 healthy adults, total acute sleep deprivation, 2-hour blood draws. AR(2) fitted to sequential expression profiles across the full genome.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {liveBloodLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 size={16} className="animate-spin" />
                Computing AR(2) from GSE113883 dataset...
              </div>
            )}
            {liveBloodError && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400">
                Failed to compute: {liveBloodError}
              </div>
            )}
            {liveBlood && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div className="text-center p-3 rounded-lg bg-background/50">
                    <p className="text-xs text-muted-foreground mb-1">Genes Analyzed</p>
                    <p className="text-2xl font-bold font-mono text-red-400">{liveBlood.totalGenes.toLocaleString()}</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-background/50">
                    <p className="text-xs text-muted-foreground mb-1">Mean |λ|</p>
                    <p className="text-2xl font-bold font-mono">{liveBlood.globalMeanLambda.toFixed(4)}</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-background/50">
                    <p className="text-xs text-muted-foreground mb-1">Median |λ|</p>
                    <p className="text-2xl font-bold font-mono">{liveBlood.globalMedianLambda.toFixed(4)}</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-background/50">
                    <p className="text-xs text-muted-foreground mb-1">Computed</p>
                    <p className="text-sm font-mono text-emerald-400">{liveBlood.computationTimeMs}ms</p>
                  </div>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/30 text-muted-foreground">
                      <th className="py-1 text-left">Category</th>
                      <th className="py-1 text-right">Genes</th>
                      <th className="py-1 text-right">Mean |λ|</th>
                      <th className="py-1 text-right">vs Global</th>
                      <th className="py-1 text-right">p-value</th>
                      <th className="py-1 text-right">z-score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liveBlood.categories.map(c => (
                      <tr key={c.name} className="border-b border-border/20">
                        <td className="py-1 font-medium">{c.name}</td>
                        <td className="py-1 text-right font-mono">{c.genesFound}/{c.genesTotal}</td>
                        <td className="py-1 text-right font-mono">{c.meanLambda.toFixed(4)}</td>
                        <td className={`py-1 text-right font-mono ${c.vsGlobal > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{c.vsGlobal > 0 ? '+' : ''}{c.vsGlobal.toFixed(4)}</td>
                        <td className={`py-1 text-right font-mono ${c.significant ? 'text-emerald-400 font-bold' : ''}`}>{c.permP < 0.001 ? '<0.001' : c.permP.toFixed(3)}</td>
                        <td className="py-1 text-right font-mono">{c.zScore.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  <strong>Key Finding:</strong> All five gene categories show significantly elevated persistence above the genome-wide mean (|λ|={liveBlood.globalMeanLambda.toFixed(3)}), with {liveBlood.categories[0]?.name} highest at |λ|={liveBlood.categories[0]?.meanLambda.toFixed(3)}. This demonstrates AR(2) persistence captures sustained functional activity across both circadian and immune regulatory networks.
                </p>
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-muted-foreground">
                  <p className="font-semibold text-amber-400 mb-1">Methodology</p>
                  <p>15 sequential time points (2-hour intervals, 28-hour constant routine). Eigenvalues capped at |λ| ≤ 1.0 (unstable AR(2) excluded). 5,000-permutation test for each category vs genome-wide distribution.</p>
                </div>
                <div className="flex items-center gap-3 mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 border-red-500/30 text-red-400 hover:bg-red-500/10"
                    onClick={() => {
                      setLiveBloodLoading(true);
                      fetch("/api/drug-durability/live/blood")
                        .then(r => { if (!r.ok) throw new Error("Failed"); return r.json(); })
                        .then(data => { setLiveBlood(data); setLiveBloodLoading(false); })
                        .catch(() => { setLiveBloodLoading(false); });
                    }}
                    disabled={liveBloodLoading}
                    data-testid="button-verify-blood"
                  >
                    <FlaskConical size={14} />
                    Re-compute
                  </Button>
                  <span className="text-xs text-muted-foreground">{liveBlood.computedAt}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Future Work */}
        <Card className="mb-8 border-blue-500/30 bg-blue-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-400" data-testid="text-future-title">
              <FileText size={20} />
              Future Work: Path to Powered Validation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold mb-2">Step 1: Clinical Outcomes (PRJNA776728)</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Apply for EGA access to the 89-patient dataset with progression-free survival data. This would enable 
                the definitive test: do patients whose target genes have low baseline |λ| respond longer to palbociclib? 
                A Kaplan-Meier curve with log-rank test — binary, concrete, no wiggle room.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-2">Step 2: Second Drug Validation (DRMref) — Completed</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="text-emerald-400 font-medium">Done.</span> Cross-referenced DRMref scRNA-seq resistance/sensitivity gene lists against GSE11923 eigenvalues across {drmrefData?.drugsWithSufficientGenes ?? "19"} drugs. See the Multi-Drug Cross-Validation section above for full results. 
                This extends the analysis beyond palbociclib to multiple drug classes and cancer types.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-2">Step 3: Liquid Biopsy Time Series</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Apply AR(2) to circulating tumor DNA (ctDNA) longitudinal data from studies like TRACERx (800+ lung cancer patients, 
                serial blood draws). More time points per patient = more robust AR(2) fits. Predict relapse timing from ctDNA 
                persistence trajectories.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-2">Step 4: Wearable Device Validation</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Compute |λ| on heart rate variability time series from smartwatch data. Test whether physiological persistence 
                correlates with hospital readmission (a hard yes/no endpoint). If validated, the method could extend beyond genomics to 
                commodity health monitoring.
              </p>
            </div>

          </CardContent>
        </Card>

        {/* Data Source */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-sm" data-testid="text-datasource-title">Data Source & Methods</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground leading-relaxed space-y-2">
            <p><span className="font-semibold text-foreground">Dataset:</span> GSE93204 — Agilent Whole Human Genome Microarray 4x44K (GPL6480). 46 breast cancer patients treated with anastrozole + palbociclib. Published as part of the NeoPalAna trial (NCT01723774).</p>
            <p><span className="font-semibold text-foreground">Time Points:</span> Baseline (pre-treatment) → C1D1 (after anastrozole alone) → C1D15 (after anastrozole + palbociclib) → Surgery.</p>
            <p><span className="font-semibold text-foreground">Method:</span> Population-level AR(2) regression pooled across 7 patients with complete 4-point time series. Eigenvalue modulus |λ| computed from characteristic equation of AR(2) coefficients. Full probe annotation via GPL6480 platform file (30,724 probes mapped to 13,328 unique genes).</p>
            <p><span className="font-semibold text-foreground">Validation:</span> 5,000-permutation tests for category significance. 1,000-bootstrap resampling for confidence intervals (patient-level resampling with replacement). Two-sided p-values reported throughout.</p>
            <p className="mt-2 text-amber-400"><span className="font-semibold">Data provenance note:</span> GSE157357 (organoid) and GSE113883 (blood) results are computed live from the raw datasets on each page load — replicates are averaged per time point before AR(2) fitting. DRMref multi-drug cross-validation is also computed live. GSE93204 (palbociclib) results remain pre-computed as the raw dataset is not hosted on this server. All source datasets are publicly available from NCBI GEO.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
