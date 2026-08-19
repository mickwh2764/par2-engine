import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Cell, LabelList, ScatterChart, Scatter, ZAxis, Legend,
  ReferenceLine as RefLine,
} from "recharts";
import {
  ArrowLeft, Loader2, AlertCircle, Shield, TrendingDown, TrendingUp,
  Minus, Activity, Info, ChevronDown, ChevronUp, Layers, Download,
} from "lucide-react";
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

interface SweepRow {
  datasetId: string;
  datasetName: string;
  setMedian: number;
  genomeMedian: number;
  gap: number;
  pValue: number;
  direction: "higher" | "lower" | "similar";
  effectSize: number;
  categoryMeans: Record<string, number>;
  matched: number;
  total: number;
}

const P53_REGULON: Record<string, { label: string; shortLabel: string; color: string; bg: string; border: string; genes: string[]; note: string }> = {
  family: {
    label: "p53 Family",
    shortLabel: "p53 Fam",
    color: "text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/30",
    genes: ["TP53", "TP63", "TP73"],
    note: "The three family members: canonical p53 and its structural analogues p63 and p73",
  },
  cellCycle: {
    label: "Cell Cycle Arrest",
    shortLabel: "Cell Cyc",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    genes: ["CDKN1A", "GADD45A", "GADD45B", "BTG2", "RRM2B", "SESN1"],
    note: "Direct p53 transcriptional targets that halt cell cycle progression after DNA damage",
  },
  proApoptotic: {
    label: "Pro-Apoptotic Targets",
    shortLabel: "Apoptotic",
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    genes: ["BBC3", "PMAIP1", "BAX", "FAS", "TNFRSF10A", "TNFRSF10B", "APAF1", "PERP", "CASP6"],
    note: "Executioner genes p53 transcribes to commit the cell to apoptosis. BBC3=PUMA, PMAIP1=NOXA",
  },
  survival: {
    label: "Survival Genes",
    shortLabel: "Survival",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    genes: ["BCL2", "BCL2L1", "MCL1", "BIRC5", "XIAP"],
    note: "Anti-apoptotic genes that oppose p53-driven cell death. BCL2L1=Bcl-xL, BIRC5=Survivin",
  },
  feedback: {
    label: "MDM2 Feedback",
    shortLabel: "MDM2",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/30",
    genes: ["MDM2", "MDM4"],
    note: "Negative regulators of p53 — MDM2 is itself a direct p53 target, forming the core feedback loop",
  },
  dnaRepair: {
    label: "DNA Repair",
    shortLabel: "DNA Rep",
    color: "text-sky-400",
    bg: "bg-sky-500/10",
    border: "border-sky-500/30",
    genes: ["DDB2", "XPC", "POLK", "GADD45A"],
    note: "p53-induced repair genes activated before the cell commits to apoptosis. Note: GADD45A also appears in Cell Cycle Arrest due to its dual role; it is counted once across the 34-gene unique regulon total.",
  },
  metabolic: {
    label: "Metabolic / Senescence",
    shortLabel: "Metabolic",
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/30",
    genes: ["TIGAR", "SESN2", "GLS2", "DRAM1", "SERPINE1", "PML"],
    note: "p53 targets regulating metabolism, autophagy, and senescence. TIGAR reduces ROS. DRAM1 induces autophagy",
  },
};

const ALL_P53_GENES = Object.values(P53_REGULON).flatMap(g => g.genes);
const CAT_KEYS = Object.keys(P53_REGULON);

const FOCUSED_DATASETS = [
  { id: "GSE48113_Human_Blood_Circadian",  label: "Blood Circadian" },
  { id: "GSE39445_Blood_SufficientSleep",  label: "Sufficient Sleep" },
  { id: "GSE39445_Blood_SleepRestriction", label: "Sleep Restricted" },
  { id: "GSE122541_Nurses_DayShift",       label: "Nurses Day Shift" },
  { id: "GSE122541_Nurses_NightShift",     label: "Nurses Night Shift" },
  { id: "GSE48113_ForcedDesync_Misaligned", label: "Forced Desync" },
];
const FOCAL_GENES = [
  "BAX","BBC3","PMAIP1","FAS","APAF1","CASP6","PERP","TNFRSF10B",
  "BCL2","BCL2L1","MCL1","BIRC5","XIAP","MDM2","MDM4","TP53",
];
const FA_PRO = ["BAX","BBC3","PMAIP1","FAS","APAF1","CASP6","PERP","TNFRSF10B"];
const FA_SUR = ["BCL2","BCL2L1","MCL1","BIRC5","XIAP"];
const FA_MDM = ["MDM2","MDM4"];

function fgv(r: GeneSetTestResult, gene: string): number | null {
  const m = r.matchedGenes.find(g => g.gene.toLowerCase() === gene.toLowerCase());
  return m ? m.eigenvalue : null;
}
function fgmed(r: GeneSetTestResult, genes: string[]): number | null {
  const vals = genes.map(g => fgv(r, g)).filter((v): v is number => v !== null).sort((a, b) => a - b);
  return vals.length ? vals[Math.floor(vals.length / 2)] : null;
}

function eigenvalueColor(v: number): string {
  if (v >= 0.7) return "#22d3ee";
  if (v >= 0.55) return "#60a5fa";
  if (v >= 0.4) return "#a78bfa";
  return "#f87171";
}

function heatColor(v: number): string {
  const clamped = Math.max(0.2, Math.min(0.85, v));
  if (clamped <= 0.5) {
    const t = (clamped - 0.2) / 0.3;
    const r = Math.round(252 + (241 - 252) * t);
    const g = Math.round(165 + (245 - 165) * t);
    const b = Math.round(165 + (249 - 165) * t);
    return `rgb(${r},${g},${b})`;
  }
  const t = (clamped - 0.5) / 0.35;
  const r = Math.round(241 + (103 - 241) * t);
  const g = Math.round(245 + (232 - 245) * t);
  const b = Math.round(249 + (232 - 249) * t);
  return `rgb(${r},${g},${b})`;
}

function heatTextColor(v: number): string {
  return v < 0.38 || v > 0.72 ? "#1e293b" : "#475569";
}

function computeCategoryMeans(matchedGenes: MatchedGene[]): Record<string, number> {
  const geneMap: Record<string, number> = {};
  for (const g of matchedGenes) geneMap[g.gene.toUpperCase()] = g.eigenvalue;
  const means: Record<string, number> = {};
  for (const [key, cat] of Object.entries(P53_REGULON)) {
    const vals = cat.genes.map(g => geneMap[g.toUpperCase()]).filter(v => v !== undefined) as number[];
    means[key] = vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : NaN;
  }
  return means;
}

function DirectionIcon({ direction }: { direction: "higher" | "lower" | "similar" }) {
  if (direction === "higher") return <TrendingUp size={16} className="text-red-400" />;
  if (direction === "lower") return <TrendingDown size={16} className="text-blue-400" />;
  return <Minus size={16} className="text-slate-400" />;
}

function pLabel(p: number): string {
  if (p < 0.001) return "p < 0.001";
  if (p < 0.01) return `p = ${p.toFixed(3)}`;
  return `p = ${p.toFixed(3)}`;
}

function pSig(p: number): string {
  if (p < 0.001) return "***";
  if (p < 0.01) return "**";
  if (p < 0.05) return "*";
  return "ns";
}

function sigColor(p: number): string {
  if (p < 0.001) return "text-violet-600";
  if (p < 0.01) return "text-blue-500";
  if (p < 0.05) return "text-amber-500";
  return "text-slate-400";
}

export default function P53Regulon() {
  const [datasetId, setDatasetId] = useState("");
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [sweepResults, setSweepResults] = useState<SweepRow[]>([]);
  const [sweepProgress, setSweepProgress] = useState<{ done: number; total: number } | null>(null);
  const [sweepRunning, setSweepRunning] = useState(false);
  const [sweepError, setSweepError] = useState<string | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{ row: string; col: string; value: number } | null>(null);
  const [focusedResults, setFocusedResults] = useState<GeneSetTestResult[]>([]);
  const [focusedRunning, setFocusedRunning] = useState(false);

  const datasetsQuery = useQuery<{ id: string; name: string }[]>({
    queryKey: ["available-datasets"],
    queryFn: async () => {
      const res = await fetch("/api/processed-tables/available");
      if (!res.ok) throw new Error("Failed to load datasets");
      return res.json();
    },
  });

  const sensitivityQuery = useQuery<any>({
    queryKey: ['/api/p53/sensitivity'],
    staleTime: Infinity,
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

  const geneMap = useMemo(() => {
    if (!result) return {};
    const m: Record<string, MatchedGene> = {};
    for (const g of result.matchedGenes) m[g.gene.toUpperCase()] = g;
    return m;
  }, [result]);

  const categoryStats = useMemo(() => {
    if (!result) return {};
    const stats: Record<string, { matched: MatchedGene[]; unmatched: string[]; mean: number }> = {};
    for (const [key, cat] of Object.entries(P53_REGULON)) {
      const matched: MatchedGene[] = [];
      const unmatched: string[] = [];
      for (const gene of cat.genes) {
        const found = geneMap[gene.toUpperCase()];
        if (found) matched.push(found);
        else unmatched.push(gene);
      }
      const mean = matched.length > 0 ? matched.reduce((s, g) => s + g.eigenvalue, 0) / matched.length : 0;
      stats[key] = { matched, unmatched, mean };
    }
    return stats;
  }, [geneMap, result]);

  const categoryBarData = useMemo(() => {
    if (!result) return [];
    return Object.entries(categoryStats).map(([key, stat]) => ({
      name: P53_REGULON[key].label.replace(" Targets", "").replace(" / Senescence", ""),
      mean: parseFloat(stat.mean.toFixed(4)),
      count: stat.matched.length,
    })).filter(d => d.count > 0);
  }, [categoryStats, result]);

  const sweepSorted = useMemo(() => {
    return [...sweepResults].sort((a, b) => b.setMedian - a.setMedian);
  }, [sweepResults]);

  const handleRun = () => {
    if (!datasetId) return;
    mutation.mutate({ datasetId, genes: ALL_P53_GENES });
  };

  const runGeneSetTest = useCallback(async (dsId: string): Promise<GeneSetTestResult> => {
    const res = await fetch("/api/analysis/gene-set-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ datasetId: dsId, genes: ALL_P53_GENES }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }, []);

  const handleSweep = useCallback(async () => {
    const datasets = datasetsQuery.data ?? [];
    if (datasets.length === 0) return;
    setSweepRunning(true);
    setSweepError(null);
    setSweepResults([]);
    setSweepProgress({ done: 0, total: datasets.length });

    const rows: SweepRow[] = [];
    const batchSize = 6;

    for (let i = 0; i < datasets.length; i += batchSize) {
      const batch = datasets.slice(i, i + batchSize);
      const settled = await Promise.allSettled(batch.map(ds => runGeneSetTest(ds.id)));
      for (let j = 0; j < batch.length; j++) {
        const s = settled[j];
        if (s.status === "fulfilled") {
          const r = s.value;
          rows.push({
            datasetId: r.datasetId,
            datasetName: r.datasetName,
            setMedian: r.setMedianEigenvalue,
            genomeMedian: r.genomeMedianEigenvalue,
            gap: r.setMedianEigenvalue - r.genomeMedianEigenvalue,
            pValue: r.permutationPValue,
            direction: r.direction,
            effectSize: r.effectSize,
            categoryMeans: computeCategoryMeans(r.matchedGenes),
            matched: r.matchedGenes.length,
            total: ALL_P53_GENES.length,
          });
        }
      }
      setSweepProgress({ done: Math.min(i + batchSize, datasets.length), total: datasets.length });
    }

    setSweepResults(rows);
    setSweepRunning(false);
  }, [datasetsQuery.data, runGeneSetTest]);

  const autoSwept = useRef(false);
  useEffect(() => {
    if (autoSwept.current) return;
    if (!datasetsQuery.data?.length) return;
    autoSwept.current = true;
    handleSweep();
  }, [datasetsQuery.data, handleSweep]);

  const runFocusedAnalysis = useCallback(async () => {
    setFocusedRunning(true);
    setFocusedResults([]);
    const settled = await Promise.allSettled(
      FOCUSED_DATASETS.map(ds =>
        fetch("/api/analysis/gene-set-test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ datasetId: ds.id, genes: FOCAL_GENES }),
        }).then(r => r.json() as Promise<GeneSetTestResult>)
      )
    );
    const res: GeneSetTestResult[] = settled
      .map(s => (s.status === "fulfilled" ? s.value : null))
      .filter((v): v is GeneSetTestResult => v !== null);
    setFocusedResults(res);
    setFocusedRunning(false);
  }, []);

  const autoFocused = useRef(false);
  useEffect(() => {
    if (autoFocused.current) return;
    autoFocused.current = true;
    runFocusedAnalysis();
  }, [runFocusedAnalysis]);

  const handleExportSweep = useCallback(() => {
    if (sweepSorted.length === 0) return;
    const catLabels = CAT_KEYS.map(k => P53_REGULON[k].shortLabel);
    const header = ["Dataset", "p53 Median |λ|", "Genome Median |λ|", "Gap", "p-value", "Direction", "Effect Size (d)", "Matched Genes", ...catLabels].join(",");
    const rows = sweepSorted.map(r => [
      `"${r.datasetName}"`,
      r.setMedian.toFixed(4),
      r.genomeMedian.toFixed(4),
      r.gap.toFixed(4),
      r.pValue.toFixed(4),
      r.direction,
      r.effectSize.toFixed(4),
      `${r.matched}/${r.total}`,
      ...CAT_KEYS.map(k => isNaN(r.categoryMeans[k]) ? "" : r.categoryMeans[k].toFixed(4)),
    ].join(","));
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "p53_regulon_sweep.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [sweepSorted]);

  const handleExportFocused = useCallback(() => {
    if (focusedResults.length === 0) return;
    const ntps = [7, 10, 10, 8];
    const catMap: Record<string, string> = {
      BAX:"Pro-apoptotic", BBC3:"Pro-apoptotic", PMAIP1:"Pro-apoptotic", FAS:"Pro-apoptotic",
      APAF1:"Pro-apoptotic", CASP6:"Pro-apoptotic", PERP:"Pro-apoptotic", TNFRSF10B:"Pro-apoptotic",
      BCL2:"Survival", BCL2L1:"Survival", MCL1:"Survival", BIRC5:"Survival", XIAP:"Survival",
      MDM2:"MDM2 group", MDM4:"MDM2 group", TP53:"TP53",
    };
    const dsHeaders = FOCUSED_DATASETS.map((d, i) => `"${d.label} (N=${ntps[i]})"`).join(",");
    const geneHeader = `Gene,Category,${dsHeaders}`;
    const geneRows = FOCAL_GENES.map(gene =>
      [gene, catMap[gene] ?? "", ...focusedResults.map(r => { const v = fgv(r, gene); return v !== null ? v.toFixed(4) : "absent"; })].join(",")
    );
    const groupHeader = `Group,Category,${dsHeaders}`;
    const groupRows = [
      ["Pro-apoptotic median", "", ...focusedResults.map(r => { const v = fgmed(r, FA_PRO); return v !== null ? v.toFixed(4) : ""; })].join(","),
      ["Survival median",      "", ...focusedResults.map(r => { const v = fgmed(r, FA_SUR); return v !== null ? v.toFixed(4) : ""; })].join(","),
      ["MDM2 group median",    "", ...focusedResults.map(r => { const v = fgmed(r, FA_MDM); return v !== null ? v.toFixed(4) : ""; })].join(","),
      ["TP53 individual",      "", ...focusedResults.map(r => { const v = fgv(r, "TP53");   return v !== null ? v.toFixed(4) : "absent"; })].join(","),
      ["Genome median",        "", ...focusedResults.map(r => r.genomeMedianEigenvalue.toFixed(4))].join(","),
    ];
    const baxV  = focusedResults.map(r => fgv(r, "BAX"));
    const bcl2V = focusedResults.map(r => fgv(r, "BCL2"));
    const bbc3V = focusedResults.map(r => fgv(r, "BBC3"));
    const pmaV  = focusedResults.map(r => fgv(r, "PMAIP1"));
    const mcl1V = focusedResults.map(r => fgv(r, "MCL1"));
    const paVals  = focusedResults.map(r => fgmed(r, FA_PRO));
    const surVals = focusedResults.map(r => fgmed(r, FA_SUR));
    const compHeader = `Comparison,Predicted direction,${FOCUSED_DATASETS.map(d => `"${d.label}"`).join(",")}`;
    const compRows = [
      ["BAX vs BCL2", "BAX < BCL2",
        ...focusedResults.map((_, i) => baxV[i] !== null && bcl2V[i] !== null && baxV[i]! < bcl2V[i]! ? "PASS" : "FAIL"),
      ].join(","),
      ["BBC3 & PMAIP1 vs MCL1", "Both < MCL1",
        ...focusedResults.map((_, i) => bbc3V[i] !== null && pmaV[i] !== null && mcl1V[i] !== null && bbc3V[i]! < mcl1V[i]! && pmaV[i]! < mcl1V[i]! ? "PASS" : "FAIL"),
      ].join(","),
      ["Pro-apoptotic vs Survival", "Pro-apoptotic median < Survival median",
        ...focusedResults.map((_, i) => paVals[i] !== null && surVals[i] !== null && paVals[i]! < surVals[i]! ? "PASS" : "FAIL"),
      ].join(","),
    ];
    const csv = [
      "# PAR(2) Discovery Engine — p53 Regulon Focused Analysis",
      "# 4 clean human circadian blood datasets",
      "# WARNING: Blood Circadian (N=7) and Nurses Day Shift (N=8) are below recommended minimum T>=16 (Paper A Figure S6)",
      "# Individual-gene estimates from these datasets have mean bias >0.15 (Paper A Monte Carlo Table S6)",
      "# Group-level medians are more reliable than individual-gene values at these sample sizes",
      "",
      "# Per-gene eigenvalues",
      geneHeader, ...geneRows,
      "",
      "# Group medians",
      groupHeader, ...groupRows,
      "",
      "# Three pre-specified comparisons",
      compHeader, ...compRows,
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "p53_regulon_focused_analysis.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [focusedResults]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 text-slate-900">
      <div className="max-w-6xl mx-auto px-4 py-6">

        <div className="flex items-start gap-3 mb-6">
          <Link href="/">
            <Button variant="outline" size="sm" className="gap-2 border-slate-200 text-slate-600 hover:bg-slate-100 mt-1" data-testid="link-back-home">
              <ArrowLeft size={14} />
              Home
            </Button>
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Shield size={22} className="text-violet-500" />
              <h1 className="text-2xl font-bold text-slate-900" data-testid="text-page-title">
                p53 Regulon Persistence Analysis
              </h1>
            </div>
            <p className="text-sm text-slate-500">
              AR(2) eigenvalue |λ| profiling of canonical p53 transcriptional targets — cell cycle, apoptosis, survival, DNA repair, and metabolic arms
            </p>
          </div>
          <Badge variant="outline" className="border-violet-500/50 text-violet-600 mt-1">
            Exploratory
          </Badge>
        </div>

        <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 mb-6">
          <div className="flex gap-2 mb-2">
            <Info size={15} className="text-slate-400 mt-0.5 shrink-0" />
            <p className="text-sm text-slate-600 leading-relaxed">
              <strong className="text-slate-800">What this tests:</strong> p53 is a pulse-driven transcription factor — it is induced acutely by DNA damage, not rhythmically by the circadian clock.
              If AR(2) eigenvalue |λ| captures oscillatory persistence faithfully, p53 targets should sit{" "}
              <em>below</em> the clock gene median (|λ| ≈ 0.65) and potentially below the genome background.
              The split between pro-apoptotic and survival targets tests whether the method can resolve
              the life–death balance within a single regulon.
            </p>
          </div>
          <p className="text-xs text-slate-400 ml-5">
            Gene list: {ALL_P53_GENES.length} canonical direct p53 targets across 7 functional categories. Sources: Fischer 2017 (Nat Rev Cancer), Kenzelmann Broz & Bhatt 2013, Verfaillie 2016 (ChIP-seq).
          </p>
        </div>

        {/* ── Figure 1 — Pre-specified summary across blood datasets ─── */}
        {(() => {
          const FIG1_DATASETS = [
            {
              label: "Blood Circadian\n(N=7)", shortLabel: "Blood Circadian",
              n: 7, lowN: true, disrupted: false,
              ProAp: 0.330, Survival: 0.399, MDM2: 0.340, TP53: 0.140, Genome: 0.286,
              mdm2Note: "median(MDM2=0.400, MDM4=0.279)",
            },
            {
              label: "Sufficient Sleep\n(N=10)", shortLabel: "Sufficient Sleep",
              n: 10, lowN: false, disrupted: false,
              ProAp: 0.701, Survival: 0.815, MDM2: 0.873, TP53: 0.166, Genome: 0.619,
              mdm2Note: "from original figure",
            },
            {
              label: "Sleep Restricted\n(N=10)", shortLabel: "Sleep Restricted",
              n: 10, lowN: false, disrupted: true,
              ProAp: 0.679, Survival: 0.630, MDM2: 0.840, TP53: 0.596, Genome: 0.626,
              mdm2Note: "MDM2 only (MDM4 unconfirmed)",
            },
            {
              label: "Nurses Day Shift\n(N=8)", shortLabel: "Nurses Day Shift",
              n: 8, lowN: true, disrupted: false,
              ProAp: 0.834, Survival: 0.561, MDM2: 0.903, TP53: 0.904, Genome: 0.644,
              mdm2Note: "from original figure",
            },
            {
              label: "Nurses Night Shift\n(N=8)", shortLabel: "Nurses Night Shift",
              n: 8, lowN: true, disrupted: true,
              ProAp: 0.636, Survival: 0.572, MDM2: 0.055, TP53: 0.480, Genome: 0.614,
              mdm2Note: "MDM2 only; MDM4 unconfirmed",
            },
            {
              label: "Forced Desync\n(N=7)", shortLabel: "Forced Desync",
              n: 7, lowN: true, disrupted: true,
              ProAp: 0.509, Survival: 0.685, MDM2: 0.889, TP53: 0.640, Genome: 0.595,
              mdm2Note: "median(MDM2=0.964, MDM4=0.814)",
            },
          ];

          const fig1ChartData = FIG1_DATASETS.map(d => ({
            name: d.shortLabel,
            n: d.n,
            disrupted: d.disrupted,
            lowN: d.lowN,
            ProAp:    d.ProAp,
            Survival: d.Survival,
            MDM2:     d.MDM2,
            TP53:     d.TP53,
            Genome:   d.Genome ?? undefined,
          }));

          const FIG_COLORS = {
            ProAp:    "#4DB6AC",
            Survival: "#F4845F",
            MDM2:     "#7986CB",
            TP53:     "#BA8DBB",
            Genome:   "#9CCC65",
          };

          const CustomLabel = (props: any) => {
            const { x, y, width, value } = props;
            if (value === undefined || value === null) return null;
            return (
              <text
                x={x + width / 2}
                y={y - 3}
                textAnchor="middle"
                fontSize={8.5}
                fill="#334155"
                fontFamily="monospace"
              >
                {Number(value).toFixed(3)}
              </text>
            );
          };

          const CustomXAxisTick = (props: any) => {
            const { x, y, payload, index } = props;
            const d = FIG1_DATASETS[index];
            const lines = payload.value.split("\n");
            return (
              <g transform={`translate(${x},${y})`}>
                {lines.map((line: string, i: number) => (
                  <text
                    key={i}
                    x={0}
                    y={0}
                    dy={i === 0 ? 12 : 24}
                    textAnchor="middle"
                    fontSize={9}
                    fill={d?.disrupted ? "#ef4444" : "#64748b"}
                    fontWeight={i === 0 ? 600 : 400}
                  >
                    {line}
                  </text>
                ))}
                {d?.lowN && (
                  <text x={0} y={0} dy={36} textAnchor="middle" fontSize={8} fill="#f59e0b">
                    ⚠ low N
                  </text>
                )}
              </g>
            );
          };

          return (
            <Card className="mb-5 border-violet-200 bg-white shadow-sm" data-testid="card-figure1">
              <CardHeader className="pb-2 pt-4 px-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-violet-500 mb-1">Figure 1 — Paper N</p>
                    <CardTitle className="text-base text-slate-900 leading-snug">
                      p53 Regulon Persistence in Human Blood Circadian Datasets
                    </CardTitle>
                    <p className="text-xs text-slate-500 mt-0.5">
                      AR(2) Eigenvalue |λ| — PAR(2) Discovery Engine · All values from manuscript text unless noted
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-3 pb-4">
                {/* Legend */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3 px-2">
                  {([ ["ProAp","Pro-apoptotic median"], ["Survival","Survival median"],
                       ["MDM2","MDM2 group median"], ["TP53","TP53 (individual)"],
                       ["Genome","Genome median"] ] as [keyof typeof FIG_COLORS, string][]).map(([key, label]) => (
                    <div key={key} className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm" style={{ background: FIG_COLORS[key] }} />
                      <span className="text-[10px] text-slate-600">{label}</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-[2px] border-t-2 border-dashed border-cyan-400" />
                    <span className="text-[10px] text-slate-600">Clock gene median ≈ 0.65</span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <div style={{ minWidth: 680 }}>
                    <ResponsiveContainer width="100%" height={310}>
                      <BarChart
                        data={fig1ChartData}
                        barCategoryGap="18%"
                        barGap={1}
                        margin={{ top: 22, right: 16, left: 8, bottom: 52 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis
                          dataKey="name"
                          tick={<CustomXAxisTick />}
                          interval={0}
                          height={58}
                          tickLine={false}
                        />
                        <YAxis
                          domain={[0, 1.02]}
                          tick={{ fontSize: 10, fill: "#94a3b8" }}
                          tickFormatter={v => v.toFixed(1)}
                          label={{ value: "Median Temporal Persistence |λ|", angle: -90, position: "insideLeft", offset: 14, fontSize: 10, fill: "#94a3b8" }}
                        />
                        <Tooltip
                          formatter={(v: number, name: string) => [v !== null && v !== undefined ? v.toFixed(3) : "n/a", name]}
                          contentStyle={{ fontSize: 11, borderRadius: 8, borderColor: "#e2e8f0" }}
                        />
                        <ReferenceLine
                          y={0.65}
                          stroke="#22d3ee"
                          strokeDasharray="5 3"
                          label={{ value: "Clock ≈ 0.65", fontSize: 9, fill: "#22d3ee", position: "right" }}
                        />
                        <Bar dataKey="ProAp"    name="Pro-apoptotic median" fill={FIG_COLORS.ProAp}    radius={[3,3,0,0]} maxBarSize={14}>
                          <LabelList content={<CustomLabel />} />
                        </Bar>
                        <Bar dataKey="Survival" name="Survival median"      fill={FIG_COLORS.Survival} radius={[3,3,0,0]} maxBarSize={14}>
                          <LabelList content={<CustomLabel />} />
                        </Bar>
                        <Bar dataKey="MDM2"     name="MDM2 group median"    fill={FIG_COLORS.MDM2}     radius={[3,3,0,0]} maxBarSize={14}>
                          <LabelList content={<CustomLabel />} />
                        </Bar>
                        <Bar dataKey="TP53"     name="TP53 (individual)"    fill={FIG_COLORS.TP53}     radius={[3,3,0,0]} maxBarSize={14}>
                          <LabelList content={<CustomLabel />} />
                        </Bar>
                        <Bar dataKey="Genome"   name="Genome median"        fill={FIG_COLORS.Genome}   radius={[3,3,0,0]} maxBarSize={14}>
                          <LabelList content={<CustomLabel />} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Data source table */}
                <div className="mt-3 rounded-lg border border-slate-100 overflow-x-auto">
                  <table className="w-full text-[10px]" data-testid="table-fig1-sources">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="px-3 py-1.5 text-left text-slate-500 font-medium">Dataset</th>
                        <th className="px-2 py-1.5 text-right text-[#4DB6AC] font-mono">Pro-ap</th>
                        <th className="px-2 py-1.5 text-right text-[#F4845F] font-mono">Survival</th>
                        <th className="px-2 py-1.5 text-right text-[#7986CB] font-mono">MDM2 grp</th>
                        <th className="px-2 py-1.5 text-right text-[#BA8DBB] font-mono">TP53</th>
                        <th className="px-2 py-1.5 text-right text-[#9CCC65] font-mono">Genome</th>
                        <th className="px-2 py-1.5 text-left text-slate-400">Pro &lt; Sur?</th>
                      </tr>
                    </thead>
                    <tbody>
                      {FIG1_DATASETS.map((d, i) => {
                        const ordering = d.ProAp < d.Survival;
                        return (
                          <tr key={i} className={`border-t border-slate-100 ${d.disrupted ? "bg-red-50/40" : ""}`}>
                            <td className="px-3 py-1.5 text-slate-700 font-medium whitespace-nowrap">
                              {d.shortLabel}
                              {d.disrupted && <span className="ml-1 text-red-400 text-[9px]">⚡ disrupted</span>}
                              {d.lowN && <span className="ml-1 text-amber-400 text-[9px]">⚠ low N</span>}
                            </td>
                            <td className="px-2 py-1.5 text-right font-mono text-slate-800">{d.ProAp.toFixed(3)}</td>
                            <td className="px-2 py-1.5 text-right font-mono text-slate-800">{d.Survival.toFixed(3)}</td>
                            <td className="px-2 py-1.5 text-right font-mono text-slate-500">
                              {d.MDM2.toFixed(3)}
                              <span className="ml-1 text-[8px] text-slate-300" title={d.mdm2Note}>ⓘ</span>
                            </td>
                            <td className="px-2 py-1.5 text-right font-mono text-slate-800">{d.TP53.toFixed(3)}</td>
                            <td className="px-2 py-1.5 text-right font-mono text-slate-500">{d.Genome !== null ? d.Genome!.toFixed(3) : "—"}</td>
                            <td className="px-2 py-1.5 text-center">
                              {ordering
                                ? <span className="text-emerald-600 font-bold">✓ holds</span>
                                : <span className="text-red-500 font-bold">✗ reversed</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mt-2 px-1 space-y-0.5">
                  <p className="text-[10px] text-slate-400">
                    ⚠ Blood Circadian (N=7), Nurses Day/Night Shift (N=8), Forced Desync (N=7) are below recommended T≥16. Group-level medians are more reliable than individual-gene values at these sample sizes.
                  </p>
                  <p className="text-[10px] text-slate-400">
                    MDM2 group median for Blood Circadian = median(MDM2=0.400, MDM4=0.279) = 0.340 — corrected from 0.400 in the original Apr 2026 figure.
                    Nurses Day Shift Survival corrected from 0.825 (original figure) → 0.561 (live PAR(2) computation).
                    Nurses Night Shift and Forced Desync genome medians now from live computation (0.614, 0.595).
                    Sufficient Sleep MDM2 and Nurses Day Shift Pro-ap/MDM2/Genome remain from the original figure; Nurses Night Shift and Forced Desync MDM2 are manuscript-confirmed.
                  </p>
                  <p className="text-[10px] text-slate-400">
                    ⚡ Disrupted = Sleep Restricted (Möller-Levet 2013), Nurses Night Shift (Resuehr/Gamble 2019), Forced Desynchrony (Archer 2014). Red dataset labels = disruption condition.
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* ── Cross-Tissue & Cross-Species Validation ─────────────────── */}
        {(() => {
          // CORRECTED April 2026: all survival medians now use the full 5-gene group
          // (Bcl2/BCL2, Bcl2l1/BCL2L1, Mcl1/MCL1, Birc5/BIRC5, Xiap/XIAP).
          // Previous version omitted Birc5 and Xiap, producing incorrect survival medians
          // and wrong directionality for several datasets.
          const MULTI_DS = [
            // Mouse tissues — T≥24 (2-hour or 1-hour resolution)
            { label:"Mouse Liver\n(GSE11923)", short:"Liver-48", species:"mouse", tissue:"Liver/1h", T:48, ProAp:0.477, Sur:0.323, MDM2:0.379, TP53:0.589, Genome:0.596, note:"GSE11923, T=48, 1h resolution. REVERSED at 1h AR(2) timescale — Birc5 and Bcl2 drop substantially at 1h vs 2h lag (sampling-rate sensitivity; see manuscript §3.7.2)" },
            { label:"Mouse Liver\n(GSE54650)", short:"Liver-24a", species:"mouse", tissue:"Liver", T:24, ProAp:0.462, Sur:0.556, MDM2:0.654, TP53:0.715, Genome:0.496, note:"GSE54650 multi-tissue atlas, T=24, 2h resolution. HOLDS (corrected: full 5-gene survival group)" },
            { label:"Mouse Heart", short:"Heart", species:"mouse", tissue:"Heart", T:24, ProAp:0.443, Sur:0.416, MDM2:0.457, TP53:0.760, Genome:0.438, note:"GSE54650, T=24" },
            { label:"Mouse Kidney", short:"Kidney", species:"mouse", tissue:"Kidney", T:24, ProAp:0.575, Sur:0.537, MDM2:0.449, TP53:0.585, Genome:0.461, note:"GSE54650, T=24" },
            { label:"Mouse Lung", short:"Lung", species:"mouse", tissue:"Lung", T:24, ProAp:0.542, Sur:0.506, MDM2:0.385, TP53:0.386, Genome:0.491, note:"GSE54650, T=24" },
            { label:"Mouse Muscle", short:"Muscle", species:"mouse", tissue:"Muscle", T:24, ProAp:0.530, Sur:0.515, MDM2:0.466, TP53:0.742, Genome:0.454, note:"GSE54650, T=24" },
            { label:"Mouse Brainstem", short:"Brainstem", species:"mouse", tissue:"Brainstem", T:24, ProAp:0.486, Sur:0.473, MDM2:0.369, TP53:0.310, Genome:0.440, note:"GSE54650, T=24. Gap = −0.013 (flat/indeterminate — within AR(2) estimation noise at N=24)" },
            { label:"Mouse Liver\nBMAL1-WT", short:"Liver-WT", species:"mouse", tissue:"Liver/WT", T:24, ProAp:0.458, Sur:0.574, MDM2:0.610, TP53:0.702, Genome:0.488, note:"GSE70499, clock-intact (Bmal1+/+) liver, T=24. HOLDS with gap +0.116 — independent replication of GSE54650 liver" },
            { label:"Mouse Liver\nBMAL1-KO", short:"Liver-KO", species:"mouse", tissue:"Liver/KO", T:24, ProAp:0.427, Sur:0.477, MDM2:0.482, TP53:0.211, Genome:0.425, note:"GSE70499, clock-disrupted (Bmal1−/−) liver, T=24. HOLDS but gap narrows 57% (WT +0.116 → KO +0.050). Trp53 drops 70% (0.702→0.211)" },
            // Human blood — T=15 (excluded from primary analysis — Braun 2018 constant routine = sleep deprivation, CR ≠ resting baseline)
            { label:"Human Blood\n(GSE113883)", short:"Blood", species:"human", tissue:"Whole Blood", T:15, ProAp:0.695, Sur:0.513, MDM2:0.925, TP53:0.894, Genome:0.558, note:"GSE113883 — Braun et al. 2018 PNAS (TimeSignature, Northwestern). T=15. REVERSED (corrected: full 5-gene survival group Sur=0.513, not 0.942). MCL1=1.039 and APAF1=1.260 above unit circle. TP53=0.894 and MDM2=0.925 mechanistically explained by 28-hour constant routine = acute total sleep deprivation (wakefulness → ROS → DDR → ATM/CHK2 → TP53 stabilisation; Carroll et al. 2016). Reversal consistent with sleep-disruption pattern. Excluded from primary cross-validation: CR ≠ resting baseline. Post-hoc exclusion — grounds disclosed." },
          ];

          const scatterData = MULTI_DS.map(d => ({
            x: d.ProAp,
            y: d.Sur,
            label: d.short,
            species: d.species,
            tissue: d.tissue,
            T: d.T,
            holds: d.Sur > d.ProAp,
          }));

          const TISSUE_COLORS: Record<string,string> = {
            "Liver":   "#6366f1",
            "Liver/WT":"#818cf8",
            "Liver/KO":"#c7d2fe",
            "Heart":   "#ef4444",
            "Kidney":  "#f97316",
            "Lung":    "#22c55e",
            "Muscle":  "#eab308",
            "Brainstem":"#a855f7",
            "Whole Blood":"#4DB6AC",
          };

          const CustomScatterTooltip = ({ active, payload }: any) => {
            if (!active || !payload?.length) return null;
            const d = payload[0]?.payload;
            if (!d) return null;
            return (
              <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg text-xs">
                <p className="font-bold text-slate-800">{d.tissue} (T={d.T})</p>
                <p>Pro-apoptotic: <span className="font-mono">{d.x.toFixed(3)}</span></p>
                <p>Survival: <span className="font-mono">{d.y.toFixed(3)}</span></p>
                <p>Pro &lt; Sur: <span className={d.holds ? "text-emerald-600 font-bold" : "text-red-500 font-bold"}>{d.holds ? "✓ HOLDS" : "✗ REVERSED"}</span></p>
                <p className="text-slate-400 mt-1">{d.species}</p>
              </div>
            );
          };

          const CustomScatterDot = (props: any) => {
            const { cx, cy, payload } = props;
            const col = TISSUE_COLORS[payload.tissue] ?? "#94a3b8";
            const isHuman = payload.species === "human";
            return (
              <g>
                <circle cx={cx} cy={cy} r={isHuman ? 9 : 7}
                  fill={col} fillOpacity={0.85}
                  stroke={payload.holds ? "#22c55e" : "#ef4444"}
                  strokeWidth={2} />
                {isHuman && <circle cx={cx} cy={cy} r={12} fill="none" stroke={col} strokeWidth={1} strokeDasharray="3 2" />}
                <text x={cx} y={cy - 12} textAnchor="middle" fontSize={8} fill={col} fontWeight={600}>{payload.label}</text>
              </g>
            );
          };

          const orderedIds = ["pro_ap","survival","mdm2","tp53"];
          const nHolds = MULTI_DS.filter(d => d.Sur > d.ProAp).length;

          return (
            <Card className="mb-5 border-indigo-200 bg-white shadow-sm" data-testid="card-multitissue">
              <CardHeader className="pb-2 pt-4 px-5">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-500 mb-1">Extended Validation</p>
                  <CardTitle className="text-base text-slate-900 leading-snug">
                    Cross-Tissue & Cross-Species p53 Regulon — 10 Datasets (Corrected April 2026)
                  </CardTitle>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Mouse liver T=24 (×2): HOLDS · Mouse heart/lung/kidney/muscle T=24: REVERSED · Mouse liver T=48 1h: REVERSED (sampling-rate effect) · BMAL1-KO: gap narrows 57% · GSE113883 T=15: constant routine/sleep-deprived (excluded from resting baseline)
                  </p>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4">

                {/* Scatter plot: pro-ap vs survival */}
                <p className="text-xs font-medium text-slate-600 mb-1">Pro-apoptotic vs Survival median |λ| — each point is one dataset</p>
                <p className="text-[10px] text-slate-400 mb-2">
                  Points <em>above</em> the diagonal (y&gt;x) = ordering holds (survival &gt; pro-ap, as expected in healthy human blood).
                  Points <em>below</em> = reversed (pro-ap more persistent). Green ring = HOLDS · Red ring = REVERSED.
                </p>
                <div className="overflow-x-auto">
                  <div style={{ minWidth: 480 }}>
                    <ResponsiveContainer width="100%" height={300}>
                      <ScatterChart margin={{ top: 20, right: 30, bottom: 30, left: 30 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis type="number" dataKey="x" domain={[0.1, 1.0]} name="Pro-ap median |λ|"
                          tick={{ fontSize: 10, fill: "#94a3b8" }}
                          label={{ value: "Pro-apoptotic median |λ|", position: "insideBottom", offset: -12, fontSize: 10, fill: "#94a3b8" }} />
                        <YAxis type="number" dataKey="y" domain={[0.1, 1.0]} name="Survival median |λ|"
                          tick={{ fontSize: 10, fill: "#94a3b8" }}
                          label={{ value: "Survival median |λ|", angle: -90, position: "insideLeft", offset: 14, fontSize: 10, fill: "#94a3b8" }} />
                        <ZAxis range={[60,60]} />
                        <Tooltip content={<CustomScatterTooltip />} />
                        {/* Diagonal y=x line */}
                        <ReferenceLine segment={[{x:0.1,y:0.1},{x:1.0,y:1.0}]}
                          stroke="#94a3b8" strokeDasharray="4 3"
                          label={{ value: "y = x", position: "insideTopRight", fontSize: 9, fill: "#94a3b8" }} />
                        <Scatter data={scatterData} shape={<CustomScatterDot />} />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Colour legend */}
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 mb-4 px-1">
                  {Object.entries(TISSUE_COLORS).map(([tissue, col]) => (
                    <div key={tissue} className="flex items-center gap-1">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: col }} />
                      <span className="text-[10px] text-slate-500">{tissue}</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-1 ml-2 border-l border-slate-200 pl-2">
                    <div className="w-2.5 h-2.5 rounded-full border-2 border-emerald-500 bg-transparent" />
                    <span className="text-[10px] text-slate-500">HOLDS</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-full border-2 border-red-500 bg-transparent" />
                    <span className="text-[10px] text-slate-500">REVERSED</span>
                  </div>
                </div>

                {/* Results table */}
                <div className="rounded-lg border border-slate-100 overflow-x-auto mb-4">
                  <table className="w-full text-[10px]" data-testid="table-multitissue-results">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="px-3 py-1.5 text-left text-slate-500 font-medium">Dataset</th>
                        <th className="px-2 py-1.5 text-center text-slate-400">T</th>
                        <th className="px-2 py-1.5 text-right text-[#4DB6AC] font-mono">Pro-ap</th>
                        <th className="px-2 py-1.5 text-right text-[#F4845F] font-mono">Survival</th>
                        <th className="px-2 py-1.5 text-right text-[#7986CB] font-mono">MDM2 grp</th>
                        <th className="px-2 py-1.5 text-right text-[#BA8DBB] font-mono">TP53</th>
                        <th className="px-2 py-1.5 text-right text-[#9CCC65] font-mono">Genome</th>
                        <th className="px-2 py-1.5 text-center text-slate-400">Pro&lt;Sur?</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MULTI_DS.map((d, i) => {
                        const holds = d.Sur > d.ProAp;
                        const isHuman = d.species === "human";
                        return (
                          <tr key={i} className={`border-t border-slate-100 ${isHuman ? "bg-teal-50/40" : ""}`}>
                            <td className="px-3 py-1.5 text-slate-700 font-medium whitespace-nowrap">
                              <span className={`inline-block w-2 h-2 rounded-full mr-1.5`}
                                style={{ background: TISSUE_COLORS[d.tissue] ?? "#94a3b8" }} />
                              {d.label.replace("\n"," ")}
                              {isHuman && <span className="ml-1 text-[8px] text-teal-600 border border-teal-300 rounded px-0.5">human</span>}
                              {d.T < 16 && <span className="ml-1 text-amber-400 text-[9px]">⚠ T&lt;16</span>}
                            </td>
                            <td className="px-2 py-1.5 text-center font-mono text-slate-500">{d.T}</td>
                            <td className="px-2 py-1.5 text-right font-mono text-slate-800">{d.ProAp.toFixed(3)}</td>
                            <td className="px-2 py-1.5 text-right font-mono text-slate-800">{d.Sur.toFixed(3)}</td>
                            <td className="px-2 py-1.5 text-right font-mono text-slate-600">{d.MDM2.toFixed(3)}</td>
                            <td className="px-2 py-1.5 text-right font-mono text-slate-600">{d.TP53.toFixed(3)}</td>
                            <td className="px-2 py-1.5 text-right font-mono text-slate-500">{d.Genome.toFixed(3)}</td>
                            <td className="px-2 py-1.5 text-center">
                              {holds
                                ? <span className="text-emerald-600 font-bold">✓</span>
                                : <span className="text-red-500 font-bold">✗</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="border-t border-slate-200 bg-slate-50">
                      <tr>
                        <td colSpan={7} className="px-3 py-1.5 text-slate-500 font-medium text-[10px]">
                          Score: ordering HOLDS in {nHolds}/{MULTI_DS.length} datasets ({Math.round(nHolds/MULTI_DS.length*100)}%)
                        </td>
                        <td className="px-2 py-1.5 text-center text-slate-600 font-bold text-[10px]">{nHolds}/{MULTI_DS.length}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Key findings */}
                <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-3 space-y-2">
                  <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-wide">Key Findings — Corrected April 2026 (full 5-gene survival group)</p>
                  <div className="space-y-1.5 text-[11px] text-slate-700">
                    <p><span className="font-semibold text-emerald-700">1. Mouse liver confirms HOLDS at 2-hour resolution (×2 independent datasets).</span> GSE54650 (gap +0.094) and GSE70499-WT (gap +0.116) both show pro-ap &lt; survival in liver — matching human blood (Sufficient Sleep gap +0.114). Liver is the peripheral tissue with the strongest clock-driven p53 apoptotic surveillance programme. Heart, kidney, lung, and muscle are all reversed.</p>
                    <p><span className="font-semibold text-indigo-600">2. BMAL1 deletion narrows the gap by 57% (but does not flip the ordering).</span> WT liver gap = +0.116; KO liver gap = +0.050. Both are HOLDS directionally, but the degree of separation between survival and pro-apoptotic branches is substantially reduced when the circadian clock is abolished. The clock amplifies — but does not create — the functional asymmetry. Trp53 drops 70% (0.702 → 0.211) in the same experiment.</p>
                    <p><span className="font-semibold text-red-600">3. Non-liver mouse tissues are mostly reversed.</span> Heart (−0.027), kidney (−0.038), lung (−0.036), muscle (−0.015) all show pro-ap ≥ survival. These tissues lack the dominant p53-dependent apoptotic surveillance that characterises liver and human blood. Brainstem is flat (−0.013, indeterminate).</p>
                    <p><span className="font-semibold text-amber-600">4. Sampling rate matters (GSE11923, T=48, 1h).</span> Mouse liver at 1-hour AR(2) resolution is REVERSED (gap −0.154), while the same tissue type is HOLDS at 2-hour resolution. Birc5 and Bcl2 eigenvalues drop substantially at 1h lag vs 2h lag — a resolution-dependent feature of these survival genes, not a biological contradiction.</p>
                    <p><span className="font-semibold text-rose-600">5. GSE113883 (Braun et al. 2018 PNAS, 28-hour constant routine) — excluded from resting-baseline cross-validation.</span> Cohort: 11 healthy adults, Rosemary Braun lab (Northwestern). Protocol: constant routine = 28 hours of total acute sleep deprivation. Corrected survival median = 0.513 (not 0.942 — prior analysis omitted BCL2L1, BIRC5, XIAP). REVERSED with MCL1 = 1.039 and APAF1 = 1.260 above unit circle. TP53 = 0.894 and MDM2 = 0.925 are mechanistically explained by prolonged wakefulness → mitochondrial ROS → 8-OHdG DNA lesions → ATM/CHK1/CHK2 → MDM2 degradation → TP53 stabilisation (Carroll et al. 2016, Brain Behav Immun). The reversal is consistent with the sleep-disruption → reversal pattern in this paper. Excluded because CR ≠ resting baseline; post-hoc exclusion — grounds disclosed.</p>
                  </div>
                </div>

                <p className="text-[10px] text-slate-400 mt-2">
                  All AR(2) eigenvalue |λ| estimates computed directly from raw CSV files using the PAR(2) engine (OLS, mean-centred). Full 5-gene survival group used throughout: Bcl2/BCL2, Bcl2l1/BCL2L1, Mcl1/MCL1, Birc5/BIRC5, Xiap/XIAP. Corrected April 2026 — previous version omitted Birc5 and Xiap, producing incorrect survival medians and wrong directionality for GSE54650 Liver, GSE70499 WT, and GSE113883. BMAL1-KO = circadian clock disruption by Bmal1 deletion; WT = clock-intact control.
                </p>
              </CardContent>
            </Card>
          );
        })()}

        {/* Single dataset card */}
        <Card className="mb-4 border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-slate-800">Single Dataset Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <Select value={datasetId} onValueChange={setDatasetId} data-testid="select-dataset">
                <SelectTrigger className="w-72 border-slate-200">
                  <SelectValue placeholder="Select a dataset…" />
                </SelectTrigger>
                <SelectContent>
                  {datasetsQuery.data?.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                  {datasetsQuery.isLoading && (
                    <SelectItem value="__loading" disabled>Loading datasets…</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <Button
                onClick={handleRun}
                disabled={!datasetId || mutation.isPending}
                className="bg-violet-600 hover:bg-violet-700 text-white gap-2"
                data-testid="button-run-analysis"
              >
                {mutation.isPending ? (
                  <><Loader2 size={14} className="animate-spin" /> Running…</>
                ) : (
                  <><Activity size={14} /> Run p53 Regulon Analysis</>
                )}
              </Button>
              {result && (
                <span className="text-xs text-slate-400">
                  {result.matchedGenes.length}/{ALL_P53_GENES.length} genes matched in {result.datasetName}
                </span>
              )}
            </div>
            {mutation.isError && (
              <div className="flex items-center gap-2 mt-3 text-red-500 text-sm">
                <AlertCircle size={14} />
                {mutation.error.message}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cross-dataset sweep card */}
        <Card className="mb-6 border-slate-200 border-l-4 border-l-violet-400">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base text-slate-800 flex items-center gap-2">
                  <Layers size={16} className="text-violet-500" />
                  Cross-Dataset Sweep
                </CardTitle>
                <p className="text-xs text-slate-500 mt-1">
                  Runs p53 regulon analysis across all {datasetsQuery.data?.length ?? "…"} embedded datasets and renders a functional category heatmap
                </p>
              </div>
              {sweepResults.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportSweep}
                  className="gap-2 border-slate-200 text-slate-600 hover:bg-slate-50"
                  data-testid="button-export-sweep"
                >
                  <Download size={13} />
                  Export CSV
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Button
                onClick={handleSweep}
                disabled={sweepRunning || !datasetsQuery.data?.length}
                className="bg-violet-600 hover:bg-violet-700 text-white gap-2"
                data-testid="button-run-sweep"
              >
                {sweepRunning ? (
                  <><Loader2 size={14} className="animate-spin" /> Sweeping…</>
                ) : (
                  <><Layers size={14} /> Run Sweep Across All Datasets</>
                )}
              </Button>
              {sweepProgress && (
                <div className="flex items-center gap-3 flex-1">
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-violet-500 rounded-full transition-all duration-300"
                      style={{ width: `${(sweepProgress.done / sweepProgress.total) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-500 whitespace-nowrap">
                    {sweepProgress.done} / {sweepProgress.total} datasets
                    {!sweepRunning && sweepProgress.done === sweepProgress.total && (
                      <span className="text-violet-600 ml-1">— complete</span>
                    )}
                  </span>
                </div>
              )}
            </div>
            {sweepError && (
              <div className="flex items-center gap-2 mt-3 text-red-500 text-sm">
                <AlertCircle size={14} />
                {sweepError}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sweep results */}
        {sweepSorted.length > 0 && (
          <>
            {/* Heatmap */}
            <Card className="mb-6 border-slate-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-700">
                  Functional Category Heatmap — Mean |λ| per Category per Dataset
                </CardTitle>
                <p className="text-xs text-slate-400 mt-0.5">
                  Datasets sorted by overall p53 regulon median |λ| (highest → lowest). Colour scale: warm = low persistence, cool = high persistence. Hover a cell for value.
                </p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <div className="min-w-max">
                    {/* Column headers */}
                    <div className="flex mb-1">
                      <div className="w-48 shrink-0" />
                      {CAT_KEYS.map(k => (
                        <div key={k} className="w-20 text-center text-xs text-slate-500 font-medium px-1 leading-tight" style={{ fontSize: "10px" }}>
                          {P53_REGULON[k].shortLabel}
                        </div>
                      ))}
                      <div className="w-20 text-center text-xs text-slate-500 font-medium" style={{ fontSize: "10px" }}>Overall</div>
                      <div className="w-14 text-center text-xs text-slate-500 font-medium" style={{ fontSize: "10px" }}>Sig</div>
                    </div>

                    {/* Rows */}
                    {sweepSorted.map((row) => (
                      <div key={row.datasetId} className="flex items-center mb-0.5 group" data-testid={`row-sweep-${row.datasetId}`}>
                        <div
                          className="w-48 shrink-0 text-xs text-slate-600 pr-2 truncate group-hover:text-slate-900 transition-colors"
                          title={row.datasetName}
                          style={{ fontSize: "11px" }}
                        >
                          {row.datasetName}
                        </div>

                        {CAT_KEYS.map(k => {
                          const v = row.categoryMeans[k];
                          const isHovered = hoveredCell?.row === row.datasetId && hoveredCell?.col === k;
                          return (
                            <div
                              key={k}
                              className="w-20 h-7 flex items-center justify-center text-xs font-mono cursor-default border border-white/60 transition-all"
                              style={{
                                backgroundColor: isNaN(v) ? "#f1f5f9" : heatColor(v),
                                color: isNaN(v) ? "#cbd5e1" : heatTextColor(v),
                                fontSize: "10px",
                                outline: isHovered ? "2px solid #7c3aed" : "none",
                              }}
                              onMouseEnter={() => !isNaN(v) && setHoveredCell({ row: row.datasetId, col: k, value: v })}
                              onMouseLeave={() => setHoveredCell(null)}
                              data-testid={`cell-heatmap-${row.datasetId}-${k}`}
                            >
                              {isNaN(v) ? "—" : v.toFixed(2)}
                            </div>
                          );
                        })}

                        {/* Overall median cell */}
                        <div
                          className="w-20 h-7 flex items-center justify-center text-xs font-mono font-semibold border border-white/60"
                          style={{
                            backgroundColor: heatColor(row.setMedian),
                            color: heatTextColor(row.setMedian),
                            fontSize: "10px",
                          }}
                        >
                          {row.setMedian.toFixed(3)}
                        </div>

                        {/* Significance */}
                        <div className={`w-14 text-center text-xs font-bold ${sigColor(row.pValue)}`} style={{ fontSize: "11px" }}>
                          {pSig(row.pValue)}
                        </div>
                      </div>
                    ))}

                    {/* Hover tooltip */}
                    {hoveredCell && (
                      <div className="mt-2 text-xs text-slate-500">
                        <strong className="text-slate-700">{P53_REGULON[hoveredCell.col].label}</strong> in{" "}
                        <strong className="text-slate-700">
                          {sweepResults.find(r => r.datasetId === hoveredCell.row)?.datasetName}
                        </strong>{" "}
                        — mean |λ| = <strong className="text-violet-600">{hoveredCell.value.toFixed(4)}</strong>
                      </div>
                    )}

                    {/* Legend */}
                    <div className="mt-4 flex items-center gap-3">
                      <span className="text-xs text-slate-400">|λ| scale:</span>
                      <div className="flex items-center gap-0">
                        {[0.25, 0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60, 0.65, 0.70, 0.75, 0.80].map(v => (
                          <div key={v} className="w-7 h-3" style={{ backgroundColor: heatColor(v) }} title={v.toFixed(2)} />
                        ))}
                      </div>
                      <span className="text-xs text-slate-400">0.25 → 0.80+</span>
                      <span className="text-xs text-slate-400 ml-4">Significance: *** p&lt;0.001 · ** p&lt;0.01 · * p&lt;0.05 · ns</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Summary table */}
            <Card className="mb-6 border-slate-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-700">Sweep Summary Table</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-2 px-2 text-slate-500 font-medium">Dataset</th>
                        <th className="text-right py-2 px-2 text-slate-500 font-medium">p53 Median</th>
                        <th className="text-right py-2 px-2 text-slate-500 font-medium">Genome BG</th>
                        <th className="text-right py-2 px-2 text-slate-500 font-medium">Gap</th>
                        <th className="text-center py-2 px-2 text-slate-500 font-medium">Direction</th>
                        <th className="text-right py-2 px-2 text-slate-500 font-medium">p-value</th>
                        <th className="text-right py-2 px-2 text-slate-500 font-medium">Cohen's d</th>
                        <th className="text-right py-2 px-2 text-slate-500 font-medium">Matched</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sweepSorted.map((row) => (
                        <tr key={row.datasetId} className="border-b border-slate-100 hover:bg-slate-50" data-testid={`row-table-${row.datasetId}`}>
                          <td className="py-1.5 px-2 text-slate-700 max-w-xs truncate" title={row.datasetName}>{row.datasetName}</td>
                          <td className="py-1.5 px-2 text-right font-mono font-semibold" style={{ color: eigenvalueColor(row.setMedian) }}>
                            {row.setMedian.toFixed(3)}
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono text-slate-500">{row.genomeMedian.toFixed(3)}</td>
                          <td className={`py-1.5 px-2 text-right font-mono font-semibold ${row.gap > 0 ? "text-red-500" : row.gap < 0 ? "text-blue-500" : "text-slate-400"}`}>
                            {row.gap > 0 ? "+" : ""}{row.gap.toFixed(3)}
                          </td>
                          <td className="py-1.5 px-2">
                            <div className="flex justify-center">
                              <DirectionIcon direction={row.direction} />
                            </div>
                          </td>
                          <td className={`py-1.5 px-2 text-right font-mono ${sigColor(row.pValue)}`}>{pLabel(row.pValue)}</td>
                          <td className="py-1.5 px-2 text-right font-mono text-slate-600">{row.effectSize.toFixed(3)}</td>
                          <td className="py-1.5 px-2 text-right text-slate-400">{row.matched}/{row.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-slate-400 mt-3">
                  {sweepSorted.filter(r => r.pValue < 0.05).length} of {sweepSorted.length} datasets show a significant p53 regulon departure from genome background (p &lt; 0.05).{" "}
                  {sweepSorted.filter(r => r.direction === "lower" && r.pValue < 0.05).length} significantly lower · {sweepSorted.filter(r => r.direction === "higher" && r.pValue < 0.05).length} significantly higher.
                </p>
              </CardContent>
            </Card>
          </>
        )}

        {/* Single dataset results */}
        {result && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <Card className="border-slate-200">
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs text-slate-500 mb-1">Regulon median |λ|</p>
                  <p className="text-2xl font-bold text-slate-900" data-testid="text-set-median">
                    {result.setMedianEigenvalue.toFixed(3)}
                  </p>
                  <p className="text-xs text-slate-400">vs genome {result.genomeMedianEigenvalue.toFixed(3)}</p>
                </CardContent>
              </Card>
              <Card className="border-slate-200">
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs text-slate-500 mb-1">Direction</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <DirectionIcon direction={result.direction} />
                    <span className="text-sm font-semibold capitalize text-slate-800" data-testid="text-direction">
                      {result.direction === "higher" ? "Higher than background" : result.direction === "lower" ? "Lower than background" : "Similar to background"}
                    </span>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-slate-200">
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs text-slate-500 mb-1">Permutation p-value</p>
                  <p className="text-lg font-bold text-slate-900" data-testid="text-pvalue">
                    {pLabel(result.permutationPValue)}
                  </p>
                  <p className="text-xs text-slate-400">{result.nPermutations.toLocaleString()} permutations</p>
                </CardContent>
              </Card>
              <Card className="border-slate-200">
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs text-slate-500 mb-1">Effect size (Cohen's d)</p>
                  <p className="text-2xl font-bold text-slate-900" data-testid="text-effect-size">
                    {result.effectSize.toFixed(3)}
                  </p>
                  <p className="text-xs text-slate-400">
                    {Math.abs(result.effectSize) > 0.5 ? "Large" : Math.abs(result.effectSize) > 0.2 ? "Medium" : "Small"}
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card className="mb-6 border-slate-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-700">Interpretation</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600 leading-relaxed" data-testid="text-interpretation">
                  {result.interpretation}
                </p>
              </CardContent>
            </Card>

            {result.histogram && result.histogram.length > 0 && (
              <Card className="mb-6 border-slate-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-700">Eigenvalue Distribution — Regulon vs Genome</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={result.histogram} barGap={0}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="bin"
                          tickFormatter={(v) => v.toFixed(2)}
                          tick={{ fontSize: 10, fill: "#94a3b8" }}
                          label={{ value: "|λ|", position: "insideBottomRight", offset: -4, fontSize: 11, fill: "#94a3b8" }}
                        />
                        <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} />
                        <Tooltip
                          formatter={(value: number, name: string) => [value, name === "genomeCount" ? "Genome" : "p53 Regulon"]}
                          labelFormatter={(l) => `|λ| ≈ ${Number(l).toFixed(2)}`}
                        />
                        <Bar dataKey="genomeCount" fill="#e2e8f0" name="genomeCount" />
                        <Bar dataKey="setCount" fill="#8b5cf6" name="setCount" />
                        <ReferenceLine x={0.65} stroke="#22d3ee" strokeDasharray="4 2" label={{ value: "Clock 0.65", fontSize: 9, fill: "#22d3ee" }} />
                        <ReferenceLine x={result.setMedianEigenvalue} stroke="#8b5cf6" strokeDasharray="4 2" label={{ value: "Regulon", fontSize: 9, fill: "#8b5cf6" }} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-xs text-slate-400 mt-2 text-center">
                    Grey = full genome distribution · Purple = p53 regulon genes · Cyan dashed = clock gene median (0.65)
                  </p>
                </CardContent>
              </Card>
            )}

            {categoryBarData.length > 0 && (
              <Card className="mb-6 border-slate-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-700">Mean |λ| by Functional Category</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={categoryBarData} layout="vertical" margin={{ left: 100, right: 30 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                        <XAxis type="number" domain={[0, 1]} tick={{ fontSize: 10, fill: "#94a3b8" }} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} width={100} />
                        <Tooltip formatter={(v: number) => [v.toFixed(3), "Mean |λ|"]} />
                        <ReferenceLine x={result.genomeMedianEigenvalue} stroke="#94a3b8" strokeDasharray="4 2" label={{ value: "Background", fontSize: 9, fill: "#94a3b8" }} />
                        <ReferenceLine x={0.65} stroke="#22d3ee" strokeDasharray="4 2" />
                        <Bar dataKey="mean" radius={[0, 3, 3, 0]}>
                          {categoryBarData.map((entry, i) => (
                            <Cell key={i} fill={
                              entry.name.includes("Survival") ? "#34d399" :
                              entry.name.includes("Pro-Apoptotic") || entry.name.includes("Apoptotic") ? "#f87171" :
                              entry.name.includes("MDM2") ? "#22d3ee" :
                              entry.name.includes("p53 Family") || entry.name.includes("p53 Fam") ? "#a78bfa" :
                              entry.name.includes("Cell Cycle") || entry.name.includes("Cell Cyc") ? "#fbbf24" :
                              "#94a3b8"
                            } />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-xs text-slate-400 mt-2 text-center">
                    Cyan dashed = clock gene median (0.65) · Grey dashed = genome background
                  </p>
                </CardContent>
              </Card>
            )}

            <div className="space-y-3 mb-6">
              {Object.entries(P53_REGULON).map(([key, cat]) => {
                const stats = categoryStats[key];
                if (!stats || stats.matched.length === 0) return null;
                const isExpanded = expandedCategory === key;
                const sorted = [...stats.matched].sort((a, b) => b.eigenvalue - a.eigenvalue);

                return (
                  <Card key={key} className={`border ${cat.border}`} data-testid={`card-category-${key}`}>
                    <button
                      className="w-full text-left"
                      onClick={() => setExpandedCategory(isExpanded ? null : key)}
                      data-testid={`button-expand-${key}`}
                    >
                      <CardHeader className="pb-2 pt-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-semibold ${cat.color}`}>{cat.label}</span>
                            <Badge variant="outline" className={`text-xs ${cat.border} ${cat.color}`}>
                              {stats.matched.length} genes
                            </Badge>
                            {stats.matched.length > 0 && (
                              <span className="text-xs text-slate-400">
                                mean |λ| = {stats.mean.toFixed(3)}
                              </span>
                            )}
                          </div>
                          {isExpanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                        </div>
                        <p className="text-xs text-slate-500 mt-1 font-normal">{cat.note}</p>
                      </CardHeader>
                    </button>

                    {isExpanded && (
                      <CardContent className="pt-0 pb-3">
                        <div className="space-y-2">
                          {sorted.map((g) => (
                            <div key={g.gene} className="flex items-center gap-3" data-testid={`row-gene-${g.gene}`}>
                              <div className="w-24 shrink-0">
                                <GeneTooltip gene={g.gene}>
                                  <span className="text-sm font-mono font-semibold text-slate-800 hover:text-violet-600 cursor-help">
                                    {g.gene}
                                  </span>
                                </GeneTooltip>
                              </div>
                              <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${(g.eigenvalue * 100).toFixed(1)}%`,
                                    backgroundColor: eigenvalueColor(g.eigenvalue),
                                  }}
                                />
                              </div>
                              <span
                                className="text-sm font-mono w-12 text-right shrink-0"
                                style={{ color: eigenvalueColor(g.eigenvalue) }}
                                data-testid={`text-eigenvalue-${g.gene}`}
                              >
                                {g.eigenvalue.toFixed(3)}
                              </span>
                              <Badge variant="outline" className="text-xs border-slate-200 text-slate-500 shrink-0">
                                {g.geneType}
                              </Badge>
                            </div>
                          ))}
                          {stats.unmatched.length > 0 && (
                            <p className="text-xs text-slate-400 pt-1">
                              Not found in dataset: {stats.unmatched.join(", ")}
                            </p>
                          )}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>

            {result.unmatchedGenes.length > 0 && (
              <p className="text-xs text-slate-400 mb-6">
                <strong className="text-slate-500">Genes not found in this dataset ({result.unmatchedGenes.length}):</strong>{" "}
                {result.unmatchedGenes.join(", ")}
              </p>
            )}
          </>
        )}

        {/* ── Focused Analysis ── */}
        <Card className="mb-6 border-slate-200 border-l-4 border-l-emerald-400" data-testid="card-focused-analysis">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="text-base text-slate-800 flex items-center gap-2">
                  <Activity size={16} className="text-emerald-500" />
                  Focused Analysis — 6 Human Circadian Blood Datasets
                </CardTitle>
                <p className="text-xs text-slate-400 mt-0.5">
                  Three canonical exemplar comparisons (BAX vs BCL2; BBC3/PMAIP1 vs MCL1; group medians) across 2 healthy baselines, 1 day-shift reference, and 3 independent circadian disruption conditions (sleep restriction, shift work, forced desynchrony)
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExportFocused}
                  disabled={focusedResults.length === 0}
                  className="gap-1.5 border-slate-200 text-slate-600 hover:bg-slate-50"
                  data-testid="button-export-focused"
                >
                  <Download size={13} />
                  Export CSV
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={runFocusedAnalysis}
                  disabled={focusedRunning}
                  className="gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                  data-testid="button-rerun-focused"
                >
                  {focusedRunning ? <><Loader2 size={13} className="animate-spin" />Running…</> : <>Re-run</>}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {focusedRunning && focusedResults.length === 0 && (
              <div className="flex items-center gap-2 text-sm text-slate-400 py-4">
                <Loader2 size={15} className="animate-spin text-emerald-500" />
                Querying 6 datasets…
              </div>
            )}

            {focusedResults.length > 0 && (() => {
              const dsLabels = FOCUSED_DATASETS.map(d => d.label);
              const isStress = [false, false, true, false, true, true];

              const paVals  = focusedResults.map(r => fgmed(r, FA_PRO));
              const surVals = focusedResults.map(r => fgmed(r, FA_SUR));
              const mdmVals = focusedResults.map(r => fgmed(r, FA_MDM));
              const tp53V   = focusedResults.map(r => fgv(r, "TP53"));
              const genV    = focusedResults.map(r => r.genomeMedianEigenvalue);

              const baxV  = focusedResults.map(r => fgv(r, "BAX"));
              const bcl2V = focusedResults.map(r => fgv(r, "BCL2"));
              const bbc3V = focusedResults.map(r => fgv(r, "BBC3"));
              const pmaV  = focusedResults.map(r => fgv(r, "PMAIP1"));
              const mcl1V = focusedResults.map(r => fgv(r, "MCL1"));

              const c1 = focusedResults.map((_, i) => (baxV[i] !== null && bcl2V[i] !== null && baxV[i]! < bcl2V[i]!));
              const c2 = focusedResults.map((_, i) => (bbc3V[i] !== null && pmaV[i] !== null && mcl1V[i] !== null && bbc3V[i]! < mcl1V[i]! && pmaV[i]! < mcl1V[i]!));
              const c3 = focusedResults.map((_, i) => (paVals[i] !== null && surVals[i] !== null && paVals[i]! < surVals[i]!));

              const totalPass = [...c1, ...c2, ...c3].filter(Boolean).length;

              const chartData = focusedResults.map((_, i) => ({
                name: dsLabels[i],
                stress: isStress[i],
                ProApop: paVals[i] !== null ? +paVals[i]!.toFixed(3) : undefined,
                Survival: surVals[i] !== null ? +surVals[i]!.toFixed(3) : undefined,
                MDM2: mdmVals[i] !== null ? +mdmVals[i]!.toFixed(3) : undefined,
                TP53: tp53V[i] !== null ? +tp53V[i]!.toFixed(3) : undefined,
                Genome: genV[i] !== null ? +genV[i].toFixed(3) : undefined,
              }));

              const baxBcl2Data = focusedResults.map((_, i) => ({
                name: dsLabels[i],
                BAX: baxV[i] !== null ? +baxV[i]!.toFixed(3) : undefined,
                BCL2: bcl2V[i] !== null ? +bcl2V[i]!.toFixed(3) : undefined,
              }));

              return (
                <>
                  {/* Group median chart */}
                  <div className="mb-5">
                    <p className="text-xs font-medium text-slate-600 mb-2">Group median |λ| per dataset</p>
                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} barCategoryGap="20%" barGap={2}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis
                            dataKey="name"
                            tick={{ fontSize: 10, fill: "#94a3b8" }}
                          />
                          <YAxis
                            domain={[0, 1]}
                            tick={{ fontSize: 10, fill: "#94a3b8" }}
                            tickFormatter={v => v.toFixed(1)}
                            label={{ value: "|λ|", angle: -90, position: "insideLeft", offset: 10, fontSize: 11, fill: "#94a3b8" }}
                          />
                          <Tooltip
                            formatter={(v: number, name: string) => [v.toFixed(3), name]}
                            labelFormatter={l => `${l}${isStress[dsLabels.indexOf(String(l))] ? " ⚡ stress context" : ""}`}
                          />
                          <ReferenceLine y={0.65} stroke="#22d3ee" strokeDasharray="4 2" label={{ value: "Clock 0.65", fontSize: 9, fill: "#22d3ee", position: "right" }} />
                          <Bar dataKey="ProApop"  name="Pro-apoptotic" fill="#f87171" radius={[2,2,0,0]} />
                          <Bar dataKey="Survival" name="Survival"       fill="#60a5fa" radius={[2,2,0,0]} />
                          <Bar dataKey="MDM2"     name="MDM2 group"    fill="#a78bfa" radius={[2,2,0,0]} />
                          <Bar dataKey="TP53"     name="TP53"           fill="#94a3b8" radius={[2,2,0,0]} />
                          <Bar dataKey="Genome"   name="Genome median"  fill="#e2e8f0" radius={[2,2,0,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 text-center">
                      Red = pro-apoptotic · Blue = survival · Purple = MDM2 · Grey = TP53 · White = genome background · Cyan dashed = clock gene median 0.65
                    </p>
                  </div>

                  {/* BAX vs BCL2 chart */}
                  <div className="mb-5">
                    <p className="text-xs font-medium text-slate-600 mb-2">Comparison 1 — BAX vs BCL2 individual |λ| per dataset</p>
                    <div className="h-40">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={baxBcl2Data} barCategoryGap="20%" barGap={3}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                          <YAxis domain={[0, 1]} tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={v => v.toFixed(1)} />
                          <Tooltip formatter={(v: number, name: string) => [v.toFixed(3), name]} />
                          <Bar dataKey="BAX" name="BAX" fill="#f87171" radius={[2,2,0,0]}>
                            {baxBcl2Data.map((_, i) => <Cell key={i} fill={c1[i] ? "#f87171" : "#fca5a5"} />)}
                          </Bar>
                          <Bar dataKey="BCL2" name="BCL2" fill="#60a5fa" radius={[2,2,0,0]}>
                            {baxBcl2Data.map((_, i) => <Cell key={i} fill={c1[i] ? "#60a5fa" : "#bfdbfe"} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 text-center">Saturated = ordering holds (BAX &lt; BCL2) · Faded = reversed · ⚡ marks stress-context datasets</p>
                  </div>

                  {/* Comparison table */}
                  <div className="mb-5">
                    <p className="text-xs font-medium text-slate-600 mb-2">Three pre-specified comparisons — predicted direction</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse" data-testid="table-focused-comparisons">
                        <thead>
                          <tr className="border-b border-slate-200">
                            <th className="text-left py-2 pr-4 text-slate-500 font-medium w-56">Comparison</th>
                            {FOCUSED_DATASETS.map((d, i) => (
                              <th key={d.id} className="text-center py-2 px-2 text-slate-500 font-medium">
                                {d.label}
                                {isStress[i] && <span className="ml-1 text-amber-500" title="Stress context">⚡</span>}
                              </th>
                            ))}
                            <th className="text-center py-2 px-2 text-slate-500 font-medium">Score</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-slate-100">
                            <td className="py-2 pr-4 text-slate-700 font-medium">BAX &lt; BCL2</td>
                            {c1.map((pass, i) => (
                              <td key={i} className="text-center py-2 px-2">
                                <span className={pass ? "text-emerald-600 font-bold" : "text-red-400"}>
                                  {pass ? "✓" : "✗"}
                                </span>
                                <span className="block text-slate-400 text-[10px] mt-0.5">
                                  {baxV[i]?.toFixed(3)} / {bcl2V[i]?.toFixed(3)}
                                </span>
                              </td>
                            ))}
                            <td className="text-center py-2 px-2 font-semibold text-slate-700">
                              {c1.filter(Boolean).length}/6
                            </td>
                          </tr>
                          <tr className="border-b border-slate-100">
                            <td className="py-2 pr-4 text-slate-700 font-medium">BBC3 &amp; PMAIP1 &lt; MCL1</td>
                            {c2.map((pass, i) => (
                              <td key={i} className="text-center py-2 px-2">
                                <span className={pass ? "text-emerald-600 font-bold" : "text-red-400"}>
                                  {pass ? "✓" : "✗"}
                                </span>
                                <span className="block text-slate-400 text-[10px] mt-0.5">
                                  {bbc3V[i]?.toFixed(2)},{pmaV[i]?.toFixed(2)} / {mcl1V[i]?.toFixed(2)}
                                </span>
                              </td>
                            ))}
                            <td className="text-center py-2 px-2 font-semibold text-slate-700">
                              {c2.filter(Boolean).length}/6
                            </td>
                          </tr>
                          <tr>
                            <td className="py-2 pr-4 text-slate-700 font-medium">Pro-apoptotic med &lt; Survival med</td>
                            {c3.map((pass, i) => (
                              <td key={i} className="text-center py-2 px-2">
                                <span className={pass ? "text-emerald-600 font-bold" : "text-red-400"}>
                                  {pass ? "✓" : "✗"}
                                </span>
                                <span className="block text-slate-400 text-[10px] mt-0.5">
                                  {paVals[i]?.toFixed(3)} / {surVals[i]?.toFixed(3)}
                                </span>
                              </td>
                            ))}
                            <td className="text-center py-2 px-2 font-semibold text-slate-700">
                              {c3.filter(Boolean).length}/6
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* TP53 individual values */}
                  <div className="mb-5">
                    <p className="text-xs font-medium text-slate-600 mb-2">TP53 individual |λ| (human datasets only)</p>
                    <div className="flex flex-wrap gap-3">
                      {[7, 10, 10, 8, 8, 7].map((ntp, i) => {
                        const v = tp53V[i];
                        const belowMin = ntp < 16;
                        return (
                          <div key={i} className={`flex flex-col items-center border rounded-lg px-4 py-2 min-w-[110px] ${belowMin ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-200"}`}>
                            <span className="text-[10px] text-slate-400 mb-0.5">{dsLabels[i]}</span>
                            <span className={`text-[9px] font-medium mb-1 ${belowMin ? "text-amber-600" : "text-slate-400"}`}>
                              N={ntp} timepoints{belowMin ? " ⚠" : ""}
                            </span>
                            <span className="text-lg font-bold" style={{ color: v !== null ? eigenvalueColor(v) : "#cbd5e1" }}>
                              {v !== null ? v.toFixed(3) : "absent"}
                            </span>
                            <span className="text-[10px] text-slate-400 mt-0.5">genome: {genV[i].toFixed(3)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Statistical caveat */}
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 mb-4 flex gap-2">
                    <Info size={13} className="text-amber-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-amber-800 mb-1">Statistical caveat — timepoint counts below recommended minimum</p>
                      <p className="text-xs text-amber-700 leading-relaxed">
                        Paper A's Monte Carlo simulation (Table S6) sweeps sample sizes N ∈ {"{8, 12, 24, 48}"}. At N = 8, mean bias in individual-gene |λ| exceeds 0.15;
                        the recommended minimum for reliable single-gene estimates is N ≥ 16. Five of the six datasets fall below that threshold
                        (Blood Circadian N = 7, Forced Desync N = 7, Sufficient Sleep N = 10, Nurses Day Shift N = 8, Nurses Night Shift N = 8).
                        Sleep Restricted (Möller-Levet 2013, N = 10) is the best-powered blood dataset in this panel. Group-level medians (pro-apoptotic,
                        survival) are more stable than individual gene estimates because they average across 5–8 genes. Individual values —
                        particularly TP53 — should be treated as directional flags only, not precise measurements, in the small-N datasets.
                      </p>
                    </div>
                  </div>

                  {/* Consistency summary */}
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-slate-700 mb-1">Overall consistency</p>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        {totalPass}/18 individual directional tests pass in the predicted direction across all 6 datasets.
                        The two cleanest unstressed datasets (Blood Circadian, Sufficient Sleep) are the primary hypothesis test.
                        The three disruption conditions (Sleep Restricted, Nurses Night Shift, Forced Desynchrony) test whether
                        circadian stress collapses the pro-apoptotic &lt; survival ordering. Note: the anomalously high
                        Nurses Day Shift TP53 |λ| = 0.904 is of uncertain provenance — the occupational exposure
                        explanation fails because night-shift nurses in the same cohort score 0.480 despite identical
                        workplace hazards. The more defensible explanation is a sampling phase confound: day-shift blood
                        draws occur in the morning, night-shift draws in the evening, so the two groups' AR(2) fits
                        reflect different circadian phases of collection. This value is retained but not used as a clean
                        healthy baseline in the manuscript.
                        Convergence across three independent disruption paradigms (sleep loss, shift work, forced desynchrony) substantially strengthens the paper's central claim.
                      </p>
                    </div>
                    <div className="shrink-0 text-center bg-white border border-slate-200 rounded-lg px-6 py-3">
                      <div className="text-3xl font-bold text-slate-800">{totalPass}<span className="text-slate-400">/18</span></div>
                      <div className="text-[10px] text-slate-400 mt-0.5">comparisons pass</div>
                      <div className="text-xs text-emerald-600 font-semibold mt-1">
                        {c1.slice(0,2).filter(Boolean).length + c2.slice(0,2).filter(Boolean).length + c3.slice(0,2).filter(Boolean).length}/6 in unstressed
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}
          </CardContent>
        </Card>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500 leading-relaxed">
          <strong className="text-slate-700">What to look for:</strong> If AR(2) |λ| correctly identifies oscillatory persistence,
          pro-apoptotic targets (BBC3/PUMA, PMAIP1/NOXA, BAX) should show lower persistence than survival genes (BCL2, MCL1),
          because apoptotic executioners are acutely induced rather than rhythmically expressed.
          MDM2 — a direct p53 target and core feedback regulator — should sit at an intermediate value
          reflecting its dual role as a p53-induced gene with constitutive basal expression.
          TP53 itself is not a rhythmic gene; its |λ| position reflects its background oscillatory dynamics in the absence of acute stress.
          In the cross-dataset sweep, consistent lower-than-background p53 regulon persistence across tissues would support the method's
          ability to distinguish pulse-driven from rhythmically sustained programmes. All results are exploratory and dataset-dependent.
        </div>

        {/* ── U2OS INDEPENDENT REPLICATION ── */}
        <Card className="mb-6 border border-emerald-200 bg-emerald-50/20" data-testid="card-u2os-replication">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mb-1">Independent Replication — Paper N Section 3.6</p>
                <CardTitle className="text-base text-slate-900 leading-snug">
                  U2OS Osteosarcoma — c-MYC-ER System (GSE221173)
                </CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  Rep2, N=25 timepoints, 2-hour resolution · Cross-lineage, cross-MYC-isoform replication
                </p>
              </div>
              <Link href="/u2os-myc-ar2">
                <Button size="sm" variant="outline" className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 gap-1.5 shrink-0">
                  <Activity size={13} />
                  Full U2OS Analysis
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Key result banner */}
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm leading-relaxed">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                <div>
                  <div className="text-[10px] text-slate-500 mb-0.5">MYC-ON regulon mean |λ|</div>
                  <div className="text-xl font-bold text-emerald-700">0.725</div>
                  <div className="text-[10px] text-slate-400">vs genome 0.579</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 mb-0.5">Permutation p</div>
                  <div className="text-xl font-bold text-emerald-700">0.021</div>
                  <div className="text-[10px] text-emerald-600 font-semibold">significant ✓</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 mb-0.5">MYC-OFF p</div>
                  <div className="text-xl font-bold text-slate-400">0.925</div>
                  <div className="text-[10px] text-slate-400">not significant</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 mb-0.5">Oscillatory fraction</div>
                  <div className="text-xl font-bold text-amber-600">49% → 24%</div>
                  <div className="text-[10px] text-slate-400">MYC-OFF → MYC-ON</div>
                </div>
              </div>
            </div>

            {/* Clock asymmetry note */}
            <div className="rounded border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 leading-relaxed">
              <strong className="text-slate-800">Clock asymmetry under c-MYC:</strong>{" "}
              ARNTL (0.692→0.999) and CLOCK (0.559→0.813) are constitutively locked-in under MYC-ON —
              while PER1 (0.396→0.137), NR1D1 (0.586→0.248), and NR1D2 (0.518→0.277) are suppressed.
              Pattern is qualitatively identical to the N-MYCN neuroblastoma result, consistent with a shared
              MYC-driven temporal reprogramming mechanism across isoforms.
            </div>

            {/* Cross-study convergence */}
            <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500">
              <strong className="text-slate-700">Cross-study convergence (Paper N §3.6):</strong>{" "}
              GSE221103 N-MYCN neuroblastoma: p = 0.0037 · GSE221173 c-MYC osteosarcoma: p = 0.021 ·
              MYC-OFF non-significant in both (p = 0.589 and 0.925 respectively).
              Two independent cell lineages, two MYC isoforms, same directional result.
            </div>
          </CardContent>
        </Card>

        {/* ── |λ|>1 SENSITIVITY ANALYSIS ── */}
        <Card className="border border-rose-200 bg-rose-50/30" data-testid="card-sensitivity">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Shield className="text-rose-500" size={18} />
              Neuroblastoma AR(2) Analysis — Paper N (Corrected)
            </CardTitle>
            <p className="text-xs text-slate-500 mt-1">
              BCL2L1 in MYC-ON has |λ| &gt; 1 even after correction; this section also tests whether that outlier
              drives the result under three |λ| handling strategies: (1) include as fitted, (2) cap at 1.0,
              (3) exclude entirely.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Methodology correction notice */}
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 leading-relaxed" data-testid="correction-notice">
              <strong className="font-semibold">Methodology correction (April 2026):</strong> The original AR(2) fits for the GSE221103
              neuroblastoma datasets were run on <em>raw (un-centred)</em> expression values. For any gene where the mean is much larger
              than its variance, un-centred OLS forces φ₁ + φ₂ ≈ 1, artificially pushing all eigenvalues toward 1.0 and
              producing spuriously small Mann-Whitney p-values. After adding mean-centring (consistent with every other dataset in
              the platform), the corrected results are: <strong>MYC-ON p ≈ 0.004</strong> (p53 regulon elevated — survives correction)
              and <strong>MYC-OFF p = 0.589</strong> (not significant — genome-relative elevation absent in MYC-OFF condition).
            </div>

            {sensitivityQuery.isLoading ? (
              <div className="flex items-center gap-2 py-6 text-slate-500 text-sm">
                <Loader2 className="animate-spin" size={16} />
                <span>Fitting AR(2) to neuroblastoma datasets — computing all three strategies...</span>
              </div>
            ) : sensitivityQuery.error || !sensitivityQuery.data ? (
              <div className="text-red-400 text-sm py-4">
                <AlertCircle size={14} className="inline mr-1" />
                Failed to load sensitivity data. Check server logs.
              </div>
            ) : (() => {
              const s = sensitivityQuery.data;
              const isRobust = s.summary.robustnesVerdict === 'ROBUST';
              const mycOffSig = s.mycOff.allGenes.pValue < 0.05;

              return (
                <div className="space-y-5">
                  {/* Verdict banner */}
                  <div className={`rounded-lg border p-3 text-sm font-medium flex items-center gap-2 ${isRobust ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`} data-testid="sensitivity-verdict">
                    {isRobust ? <Shield size={16} className="text-emerald-500 shrink-0" /> : <Info size={16} className="text-amber-500 shrink-0" />}
                    <span>{s.summary.conclusion}</span>
                  </div>

                  {/* BCL2L1 note */}
                  <div className="rounded border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 leading-relaxed" data-testid="bcl2l1-note">
                    <strong className="text-slate-800">BCL2L1 note:</strong> {s.summary.bcl2l1Note}
                  </div>

                  {/* Per-condition comparison — MYC-ON and MYC-OFF side by side */}
                  {([
                    { cond: s.mycOn, color: 'rose' },
                    { cond: s.mycOff, color: 'sky' },
                  ] as { cond: typeof s.mycOn; color: string }[]).map(({ cond, color }) => {
                    const strategies = [
                      { key: 'allGenes', label: 'All genes (as reported)', data: cond.allGenes, bar: '#64748b' },
                      { key: 'cappedAt1', label: '|λ| capped at 1.0', data: cond.cappedAt1, bar: '#d97706' },
                      { key: 'excludedAbove1', label: '|λ|>1 excluded', data: cond.excludedAbove1, bar: '#10b981' },
                    ];
                    const chartData = strategies.map(st => ({
                      name: st.label,
                      regulon: parseFloat(st.data.regulonMedian.toFixed(4)),
                      genome: parseFloat(st.data.genomeMedian.toFixed(4)),
                      fill: st.bar,
                    }));
                    const borderCls = color === 'rose' ? 'border-rose-200' : 'border-sky-200';
                    const bgCls = color === 'rose' ? 'bg-rose-50/50' : 'bg-sky-50/50';
                    return (
                      <div key={cond.conditionName} className={`rounded-lg border ${borderCls} ${bgCls} p-4 space-y-3`} data-testid={`sensitivity-cond-${cond.conditionName}`}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-semibold text-slate-800 flex-1">{cond.label}</h4>
                          {cond.conditionName === 'MYC_OFF' && !mycOffSig && (
                            <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-300 rounded px-2 py-0.5 font-semibold">
                              NOT SIGNIFICANT — artefact corrected
                            </span>
                          )}
                          {cond.conditionName === 'MYC_ON' && cond.allGenes.pValue < 0.05 && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300 rounded px-2 py-0.5 font-semibold">
                              SIGNIFICANT (p ≈ {cond.allGenes.pValue < 0.001 ? '< 0.001' : cond.allGenes.pValue.toFixed(3)})
                            </span>
                          )}
                          {cond.nAboveOne > 0 && (
                            <span className="text-[10px] bg-rose-100 text-rose-700 border border-rose-200 rounded px-2 py-0.5 font-medium">
                              {cond.nAboveOne} gene{cond.nAboveOne > 1 ? 's' : ''} &gt;1: {cond.genesAboveOne.join(', ')}
                            </span>
                          )}
                        </div>

                        {/* Bar chart showing regulon vs genome median across strategies */}
                        <ResponsiveContainer width="100%" height={160}>
                          <BarChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                            <YAxis tickFormatter={(v: number) => v.toFixed(2)} tick={{ fontSize: 9 }} />
                            <Tooltip formatter={(v: number) => v.toFixed(4)} />
                            <Bar dataKey="regulon" name="Regulon median |λ|" fill={color === 'rose' ? '#f43f5e' : '#0ea5e9'} radius={[3,3,0,0]} />
                            <Bar dataKey="genome" name="Genome median |λ|" fill="#94a3b8" radius={[3,3,0,0]} />
                          </BarChart>
                        </ResponsiveContainer>

                        {/* Table of p-values per strategy */}
                        <table className="w-full text-xs" data-testid={`strategy-table-${cond.conditionName}`}>
                          <thead>
                            <tr className="border-b border-slate-200">
                              <th className="text-left py-1 text-slate-600 font-semibold">Strategy</th>
                              <th className="text-right py-1 text-slate-600 font-semibold">Regulon median |λ|</th>
                              <th className="text-right py-1 text-slate-600 font-semibold">Genome median |λ|</th>
                              <th className="text-right py-1 text-slate-600 font-semibold">Gap</th>
                              <th className="text-right py-1 text-slate-600 font-semibold">Mann-Whitney p</th>
                              <th className="text-right py-1 text-slate-600 font-semibold">n regulon</th>
                            </tr>
                          </thead>
                          <tbody>
                            {strategies.map(st => (
                              <tr key={st.key} className="border-b border-slate-100">
                                <td className="py-1 text-slate-700">{st.label}</td>
                                <td className="py-1 text-right font-mono text-slate-700">{st.data.regulonMedian.toFixed(4)}</td>
                                <td className="py-1 text-right font-mono text-slate-500">{st.data.genomeMedian.toFixed(4)}</td>
                                <td className={`py-1 text-right font-mono font-semibold ${st.data.gap > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                  {st.data.gap > 0 ? '+' : ''}{st.data.gap.toFixed(4)}
                                </td>
                                <td className={`py-1 text-right font-mono font-semibold ${st.data.pValue < 0.05 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                  {st.data.pValue < 0.001 ? '< 0.001' : st.data.pValue.toFixed(4)}
                                </td>
                                <td className="py-1 text-right font-mono text-slate-500">{st.data.nRegulon}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })}

                  {/* Per-gene eigenvalue table — both conditions */}
                  {([s.mycOn, s.mycOff] as typeof s.mycOn[]).map((cond: typeof s.mycOn) => (
                    <div key={cond.conditionName} className="space-y-1">
                      <h5 className="text-xs font-semibold text-slate-700">{cond.label} — Per-gene |λ| values</h5>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs" data-testid={`per-gene-table-${cond.conditionName}`}>
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50">
                              <th className="text-left px-2 py-1 text-slate-600">Gene</th>
                              <th className="text-left px-2 py-1 text-slate-600">Category</th>
                              <th className="text-right px-2 py-1 text-slate-600">|λ| (fitted)</th>
                              <th className="text-right px-2 py-1 text-slate-600">|λ| (capped)</th>
                              <th className="text-right px-2 py-1 text-slate-600">Flag</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[...cond.perGene].sort((a: any, b: any) => b.lambda - a.lambda).map((g: any) => (
                              <tr key={g.gene} className={`border-b border-slate-50 ${g.gene === 'BCL2L1' ? 'bg-rose-50' : ''} ${g.aboveOne ? 'font-semibold' : ''}`} data-testid={`gene-row-${g.gene}-${cond.conditionName}`}>
                                <td className="px-2 py-1 font-mono text-slate-800">{g.gene}</td>
                                <td className="px-2 py-1 text-slate-500">{g.category}</td>
                                <td className={`px-2 py-1 text-right font-mono ${g.aboveOne ? 'text-rose-600' : 'text-slate-700'}`}>{g.lambda.toFixed(4)}</td>
                                <td className="px-2 py-1 text-right font-mono text-slate-600">{g.lambdaCapped.toFixed(4)}</td>
                                <td className="px-2 py-1 text-right">
                                  {g.aboveOne && <span className="text-[10px] bg-rose-100 text-rose-700 border border-rose-200 rounded px-1">|λ|&gt;1</span>}
                                  {g.gene === 'BCL2L1' && <span className="text-[10px] bg-amber-100 text-amber-700 border border-amber-200 rounded px-1 ml-1">BCL2L1</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}

                  <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-500 leading-relaxed">
                    <strong className="text-slate-700">Paper N (v0.4, May 2026) reports</strong> a single
                    significant finding: <strong>MYC-ON p53 regulon temporal persistence is elevated above the genome background
                    (centred AR(2); Mann-Whitney p ≈ 0.004; robust to |λ|&gt;1 handling).</strong> The MYC-OFF result previously
                    reported as significant (p = 0.0024) was an artefact of un-centred OLS fitting; corrected p = 0.589 (not significant). BCL2L1 = {s.mycOn.perGene.find((g: any) => g.gene === 'BCL2L1')?.lambda.toFixed(3) ?? '?'} in
                    MYC-ON; this exceeds the estimable range but does not drive the MYC-ON finding under capping or exclusion.
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* ── AS CONVERGENCE NOTE — v0.4 ── */}
        <div className="rounded-lg border border-violet-200 bg-violet-50/30 p-4 mb-6" data-testid="card-as-convergence">
          <div className="flex gap-2 mb-2">
            <Info size={15} className="text-violet-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-violet-700 mb-1">
                Mechanistic convergence: post-transcriptional regulation — Paper N v0.4 (May 2026)
              </p>
              <p className="text-xs text-slate-600 leading-relaxed">
                Fuhr, Relógio et al. (2022) catalogued alternative splicing (AS) events in HCT116 colorectal cancer
                cells when ARNTL/BMAL1, NR1D1/REV-ERBα, and PER2 were individually knocked out. Members of the p53
                regulon analysed here undergo differential splicing under all three perturbations:
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2 text-[10px]">
                <div className="rounded border border-violet-200 bg-white px-2 py-1.5">
                  <div className="font-semibold text-violet-700 mb-1">ARNTL/BMAL1 KO</div>
                  <div><span className="font-mono font-bold">TNFRSF10B</span> — gains splicing events</div>
                  <div><span className="font-mono font-bold">TP53</span> — loses splicing events</div>
                  <div className="text-slate-400 mt-0.5">96 "Resisting Cell Death" events total</div>
                </div>
                <div className="rounded border border-violet-200 bg-white px-2 py-1.5">
                  <div className="font-semibold text-violet-700 mb-1">NR1D1/REV-ERBα KO</div>
                  <div><span className="font-mono font-bold">BAX</span> — differentially spliced</div>
                  <div><span className="font-mono font-bold">TP53</span> — loses splicing events</div>
                  <div className="text-slate-400 mt-0.5">143 "Resisting Cell Death" events total</div>
                </div>
                <div className="rounded border border-violet-200 bg-white px-2 py-1.5">
                  <div className="font-semibold text-violet-700 mb-1">PER2 KO</div>
                  <div><span className="font-mono font-bold">BAX</span> — differentially spliced</div>
                  <div><span className="font-mono font-bold">TNFRSF10B</span> — loses splicing events</div>
                  <div><span className="font-mono font-bold">TP53</span> — loses splicing events</div>
                  <div className="text-slate-400 mt-0.5">115 "Resisting Cell Death" events total</div>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
                Clock disruption alters p53 regulon function at two molecular levels simultaneously: the{" "}
                <em>quantity</em> of expression momentum (temporal persistence, measured by AR(2) |λ| above) and the{" "}
                <em>quality</em> of transcript output (splice isoform repertoire). Both converge on the same nodes —
                BAX, TNFRSF10B, TP53 — strengthening the biological plausibility of the AR(2) finding.
              </p>
              <p className="text-[10px] text-slate-400 mt-1.5">
                Source: Fuhr L, Relógio A et al. <em>npj Syst Biol Appl</em>. 2022;8:15. doi:10.1038/s41540-022-00225-w · PMID 35552415.
                Data: HCT116 ARNTL/NR1D1/PER2 KO supplementary tables.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
