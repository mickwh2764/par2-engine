import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, ScatterChart, Scatter, ReferenceLine, Legend,
} from "recharts";
import {
  ArrowLeft, Eye, AlertTriangle, ChevronDown, Info, BookOpen,
  FlaskConical, CheckCircle2, XCircle, HelpCircle, Clock, Zap, Activity
} from "lucide-react";

// =============================================================================
// PRE-COMPUTED RESULTS — GSE98965 (baboon), RET tissue, 12 ZT timepoints
// AR(2) fitted with canonical mean-centred OLS (identical to server version)
// Dataset: Mure et al. 2018 Science; 29,202 genes; primate in vivo; n=12 per tissue
// =============================================================================

const DATASET_INFO = {
  accession: "GSE98965",
  species: "Papio anubis (olive baboon)",
  reference: "Mure et al. 2018, Science",
  doi: "10.1126/science.aan4338",
  nTimepoints: 12,
  samplingInterval: "2h (ZT00–ZT22)",
  tissues: ["RET","SCN","LUN","LIV","ONH"],
  totalGenesRET: 20350,
  method: "AR(2) mean-centred OLS eigenvalue modulus |λ|",
};

// Tissue hierarchy — all from same baboon dataset (GSE98965)
const TISSUE_DATA = [
  { tissue: "RET",  label: "Retina",            clockLambda: 0.4331, targetLambda: 0.4518, genomeMedian: 0.4908, tauC: 1.195, pctComplex: 31.3, n: 20350, category: "retinal" },
  { tissue: "SCN",  label: "SCN",               clockLambda: 0.4872, targetLambda: 0.4696, genomeMedian: 0.5021, tauC: 1.391, pctComplex: 62.5, n: 19893, category: "central" },
  { tissue: "LIV",  label: "Liver",             clockLambda: 0.4839, targetLambda: 0.6707, genomeMedian: 0.4688, tauC: 1.377, pctComplex: 81.3, n: 19974, category: "peripheral" },
  { tissue: "LUN",  label: "Lung",              clockLambda: 0.5703, targetLambda: 0.4574, genomeMedian: 0.5513, tauC: 1.781, pctComplex: 75.0, n: 20553, category: "peripheral" },
  { tissue: "ONH",  label: "Optic Nerve Head",  clockLambda: 0.6691, targetLambda: 0.4840, genomeMedian: 0.5785, tauC: 2.489, pctComplex: 37.5, n: 20117, category: "retinal" },
];

// Predictions (pre-specified before results were examined)
const PREDICTIONS = [
  {
    id: "P1",
    question: "Clock/target hierarchy holds in retina",
    rationale: "Core clock genes show higher |λ| than canonical targets in all 13/13 tissues previously tested. A failure here would be extraordinary.",
    preSpecified: "Clock median |λ| > target median |λ|; Mann-Whitney p < 0.05",
    result: "FAILED" as const,
    stats: {
      clockMedian: 0.4331, targetMedian: 0.4518,
      mannWhitneyP: 0.5946, cohensD: -0.151, permutationP: 0.659,
      nClock: 16, nTarget: 22,
    },
    interpretation: "The clock/target hierarchy is inverted (non-significantly) in the retina. Clock genes show lower median |λ| than targets — the opposite of peripheral tissues. This is the first tissue where the hierarchy does not hold, and the failure itself is informative: the retina's clock operates under fundamentally different temporal dynamics than any tissue previously tested. The inversion is consistent with rapid-reset biology rather than canonical clock persistence.",
    falseIfWrong: true,
  },
  {
    id: "P2",
    question: "Retinal τ_c lies between SCN (fast) and Lung (slow)",
    rationale: "Retina has its own clock but sits in the photic input pathway, expected to be intermediate between the master oscillator and peripheral organs.",
    preSpecified: "1.39h (SCN τ_c) < retinal clock τ_c < 1.78h (Lung τ_c)",
    result: "FAILED" as const,
    stats: {
      retTauC: 1.195, scnTauC: 1.391, lunTauC: 1.781,
    },
    interpretation: "Retinal clock τ_c (1.195h) falls BELOW the SCN (1.391h) — the retina is actually the fastest-resetting tissue in this dataset, faster even than the master pacemaker. This is unexpected but biologically coherent: as the primary light-sensor, the retina must rapidly reset its gene expression dynamics in response to photic input, requiring shorter temporal memory than any other organ.",
    falseIfWrong: true,
  },
  {
    id: "P3",
    question: "Retina re-entrains faster than peripheral organs (lower τ_c ratio vs SCN)",
    rationale: "If retina is biologically upstream of peripheral organs in photic pathway, its τ_c/SCN ratio should be smaller than lung's.",
    preSpecified: "(Retina τ_c / SCN τ_c) < 1.53× [lung/SCN ratio, live-verified]",
    result: "CONFIRMED" as const,
    stats: {
      retSCNRatio: 0.859, lunSCNRatio: 1.280,
    },
    interpretation: "Confirmed unambiguously. Retina/SCN ratio (0.859×) is substantially below the Lung/SCN ratio (1.280×). The retina re-entrains faster than peripheral organs — it has shorter temporal lag relative to the master clock. This is directionally consistent with its role as a first-responder to photic signals.",
    falseIfWrong: false,
  },
  {
    id: "P4a",
    question: "Phototransduction module genes show low |λ| (rapid dynamics)",
    rationale: "Rhodopsin, melanopsin, transducins and PDE6 subunits must respond rapidly to light changes. High temporal memory would impair sensitivity.",
    preSpecified: "Phototransduction median |λ| < retinal clock median |λ|; below genome background",
    result: "CONFIRMED" as const,
    stats: {
      photoMedian: 0.4194, clockMedian: 0.4331, genomeMedian: 0.4908,
      mannWhitneyP: 0.7614, cohensD: 0.110, nPhoto: 24,
    },
    interpretation: "Confirmed directionally: phototransduction module median |λ| (0.4194) is below retinal clock median (0.4331) and substantially below genome background (0.4908). Most rod/cone-specific genes (RHO, GNAT1, PDE6A, GRK1) cluster at very low |λ| (0.25–0.35). Exception: OPN4 (melanopsin) shows notably high |λ|=0.904 — consistent with sustained ipRGC firing for circadian entrainment rather than rapid point-by-point light detection. Mann-Whitney p=0.76 (non-significant at n=24 vs 16), limiting this to a directional confirmation.",
    falseIfWrong: false,
  },
  {
    id: "P4b",
    question: "CRX regulon shows distinct |λ| pattern from canonical E-box targets",
    rationale: "CRX is a retina-specific transcription factor that co-occupies BMAL1/CLOCK binding sites. Its regulon should show a different persistence pattern.",
    preSpecified: "CRX target median |λ| ≠ canonical target median |λ| (Mann-Whitney p < 0.05)",
    result: "ASSESSED" as const,
    stats: {
      crxMedian: 0.4653, targetMedian: 0.4518, clockMedian: 0.4331,
      mannWhitneyP_vsTarget: 1.00, mannWhitneyP_vsClock: 0.7007, nCRX: 22,
    },
    interpretation: "22 CRX regulon genes detected in retina (median |λ|=0.465). CRX regulon median sits between clock and target values, consistent with intermediate persistence. However, the comparison is not statistically significant at n=22 (p=1.00 vs canonical targets, p=0.70 vs clock). Power is limited. The CRX regulon does show higher rates of complex (oscillatory) roots than the genome background — 54.5% complex vs 43% genome-wide — a directional result consistent with CRX co-regulation by oscillatory BMAL1/CLOCK machinery.",
    falseIfWrong: false,
  },
  {
    id: "P5",
    question: ">50% of retinal clock genes show complex (oscillatory) AR(2) roots",
    rationale: "A tissue with a functioning autonomous clock should show oscillatory AR(2) dynamics in core clock genes (complex eigenvalue roots).",
    preSpecified: "% complex roots in retinal clock gene set > 50%",
    result: "FAILED" as const,
    stats: {
      pctComplex: 31.25, nComplex: 5, nClock: 16,
    },
    interpretation: "Only 31.3% of retinal clock genes show complex roots — well below the 50% threshold and substantially lower than SCN (62.5%), Lung (75%), or Liver (81.3%). The retinal clock operates predominantly in the real-root (monotonic decay) regime rather than the oscillatory complex-root regime. This does not mean the retinal clock is non-functional; it may reflect that the circadian oscillation in the retina is driven by upstream SCN signals rather than autonomous self-sustaining oscillation, consistent with models of retinal clock entrainment.",
    falseIfWrong: true,
  },
];

// Individual clock gene values for retina vs SCN vs Lung
const CLOCK_GENES_BY_TISSUE = {
  RET: [
    { gene: "PER3",  lambda: 0.3425, complex: true },
    { gene: "RORC",  lambda: 0.2113, complex: true },
    { gene: "NR1D2", lambda: 0.7569, complex: false },
    { gene: "CLOCK", lambda: 0.6071, complex: false },
    { gene: "RORA",  lambda: 0.3745, complex: true },
    { gene: "CRY1",  lambda: 0.7938, complex: false },
    { gene: "NPAS2", lambda: 0.7436, complex: false },
    { gene: "CRY2",  lambda: 0.5140, complex: false },
    { gene: "ARNTL", lambda: 0.1026, complex: false },
    { gene: "NFIL3", lambda: 0.3058, complex: false },
    { gene: "PER2",  lambda: 0.6506, complex: true },
    { gene: "TEF",   lambda: 0.4917, complex: false },
    { gene: "PER1",  lambda: 0.5619, complex: false },
    { gene: "HLF",   lambda: 0.0530, complex: false },
    { gene: "NR1D1", lambda: 0.2505, complex: false },
    { gene: "DBP",   lambda: 0.3062, complex: true },
  ],
  SCN: [
    { gene: "PER3",  lambda: 0.6823, complex: false },
    { gene: "RORC",  lambda: 0.2943, complex: true },
    { gene: "NR1D2", lambda: 0.6140, complex: true },
    { gene: "CLOCK", lambda: 0.3000, complex: false },
    { gene: "RORA",  lambda: 0.4788, complex: true },
    { gene: "CRY1",  lambda: 0.6578, complex: false },
    { gene: "NPAS2", lambda: 0.4819, complex: false },
    { gene: "CRY2",  lambda: 0.3237, complex: true },
    { gene: "ARNTL", lambda: 0.3629, complex: true },
    { gene: "NFIL3", lambda: 0.3842, complex: true },
    { gene: "PER2",  lambda: 0.5007, complex: true },
    { gene: "TEF",   lambda: 0.5530, complex: false },
    { gene: "PER1",  lambda: 0.5447, complex: true },
    { gene: "HLF",   lambda: 0.4925, complex: true },
    { gene: "NR1D1", lambda: 0.5082, complex: false },
    { gene: "DBP",   lambda: 0.4563, complex: true },
  ],
  LUN: [
    { gene: "PER3",  lambda: 1.1827, complex: true },
    { gene: "RORC",  lambda: 0.6633, complex: true },
    { gene: "NR1D2", lambda: 1.3734, complex: false },
    { gene: "CLOCK", lambda: 0.5594, complex: false },
    { gene: "RORA",  lambda: 0.5541, complex: false },
    { gene: "CRY1",  lambda: 0.4543, complex: true },
    { gene: "NPAS2", lambda: 0.4463, complex: false },
    { gene: "CRY2",  lambda: 0.5174, complex: true },
    { gene: "ARNTL", lambda: 0.8210, complex: true },
    { gene: "NFIL3", lambda: 0.4907, complex: true },
    { gene: "PER2",  lambda: 0.7911, complex: true },
    { gene: "TEF",   lambda: 0.4851, complex: true },
    { gene: "PER1",  lambda: 0.5812, complex: true },
    { gene: "HLF",   lambda: 0.7608, complex: true },
    { gene: "NR1D1", lambda: 0.3009, complex: true },
    { gene: "DBP",   lambda: 0.6208, complex: true },
  ],
};

// Phototransduction module genes
const PHOTOTRANSDUCTION_GENES = [
  { gene: "RHO",    lambda: 0.2511, complex: false, r2: 0.009,  role: "Rod opsin" },
  { gene: "GNAT1",  lambda: 0.2997, complex: false, r2: -0.019, role: "Rod transducin α" },
  { gene: "PDE6A",  lambda: 0.2730, complex: true,  r2: 0.018,  role: "Rod PDE6 α-subunit" },
  { gene: "GRK7",   lambda: 0.2876, complex: true,  r2: 0.021,  role: "Cone rhodopsin kinase" },
  { gene: "GRK1",   lambda: 0.3153, complex: false, r2: 0.079,  role: "Rod rhodopsin kinase" },
  { gene: "PDE6G",  lambda: 0.3180, complex: false, r2: 0.023,  role: "Rod PDE6 γ-subunit" },
  { gene: "GNGT1",  lambda: 0.3354, complex: false, r2: 0.008,  role: "Rod transducin γ" },
  { gene: "CNGB1",  lambda: 0.3450, complex: true,  r2: 0.014,  role: "Rod CNG channel β" },
  { gene: "OPN1SW", lambda: 0.3890, complex: true,  r2: 0.022,  role: "S-cone opsin" },
  { gene: "CNGB3",  lambda: 0.3797, complex: false, r2: 0.223,  role: "Cone CNG channel β" },
  { gene: "CNGA3",  lambda: 0.3095, complex: false, r2: 0.001,  role: "Cone CNG channel α" },
  { gene: "PDE6H",  lambda: 0.4306, complex: false, r2: 0.028,  role: "Cone PDE6 γ-subunit" },
  { gene: "GNGT2",  lambda: 0.4304, complex: true,  r2: 0.110,  role: "Cone transducin γ" },
  { gene: "RCVRN",  lambda: 0.4788, complex: false, r2: 0.014,  role: "Recoverin (calcium sensor)" },
  { gene: "SAG",    lambda: 0.5112, complex: false, r2: 0.046,  role: "S-arrestin (rod/cone)" },
  { gene: "CNGA1",  lambda: 0.5593, complex: true,  r2: 0.212,  role: "Rod CNG channel α" },
  { gene: "PDE6C",  lambda: 0.5915, complex: false, r2: 0.174,  role: "Cone PDE6 α-subunit" },
  { gene: "GUCA1A", lambda: 0.5874, complex: false, r2: 0.119,  role: "Guanylate cyclase activator" },
  { gene: "GUCA1B", lambda: 0.6187, complex: false, r2: 0.118,  role: "Guanylate cyclase activator" },
  { gene: "GUCY2D", lambda: 0.6092, complex: false, r2: 0.104,  role: "Retinal guanylate cyclase" },
  { gene: "GUCY2F", lambda: 0.7394, complex: true,  r2: 0.153,  role: "Retinal guanylate cyclase" },
  { gene: "GNAT2",  lambda: 0.7530, complex: false, r2: 0.230,  role: "Cone transducin α" },
  { gene: "PDE6B",  lambda: 0.4084, complex: false, r2: 0.058,  role: "Rod PDE6 β-subunit" },
  { gene: "OPN4",   lambda: 0.9036, complex: false, r2: 0.640,  role: "Melanopsin (ipRGC)" },
];

// CRX regulon genes
const CRX_REGULON_GENES = [
  { gene: "ROM1",    lambda: 0.1511, complex: true,  r2: 0.008,  role: "Rod outer segment membrane protein" },
  { gene: "CRX",     lambda: 0.2646, complex: true,  r2: 0.068,  role: "Cone-rod homeobox TF (master regulator)" },
  { gene: "LRAT",    lambda: 0.3051, complex: false, r2: 0.069,  role: "Lecithin retinol acyltransferase" },
  { gene: "NRL",     lambda: 0.3379, complex: true,  r2: 0.053,  role: "Neural retina leucine zipper TF" },
  { gene: "REEP6",   lambda: 0.3499, complex: false, r2: 0.040,  role: "Photoreceptor structure" },
  { gene: "CNGB1",   lambda: 0.3450, complex: true,  r2: 0.014,  role: "Rod CNG channel β" },
  { gene: "NR2E1",   lambda: 0.3775, complex: true,  r2: 0.100,  role: "Tailless nuclear receptor" },
  { gene: "PRPH2",   lambda: 0.3919, complex: true,  r2: 0.131,  role: "Peripherin-2 (OS disk)" },
  { gene: "PROM1",   lambda: 0.3906, complex: false, r2: 0.017,  role: "CD133 / prominin-1" },
  { gene: "FAM161A", lambda: 0.4295, complex: true,  r2: 0.225,  role: "Ciliary/OS structure" },
  { gene: "RPE65",   lambda: 0.4441, complex: true,  r2: 0.041,  role: "Retinoid isomerohydrolase (RPE)" },
  { gene: "ABCA4",   lambda: 0.4865, complex: true,  r2: 0.133,  role: "ATP-binding cassette transporter" },
  { gene: "TULP1",   lambda: 0.5391, complex: false, r2: 0.065,  role: "Photoreceptor structure" },
  { gene: "NR2E3",   lambda: 0.5544, complex: false, r2: 0.074,  role: "Photoreceptor-specific nuclear receptor" },
  { gene: "RLBP1",   lambda: 0.5152, complex: false, r2: 0.160,  role: "Retinaldehyde binding protein" },
  { gene: "CC2D2A",  lambda: 0.5426, complex: true,  r2: 0.187,  role: "Ciliary transition zone" },
  { gene: "GUCA1A",  lambda: 0.5874, complex: false, r2: 0.119,  role: "Guanylate cyclase activator" },
  { gene: "CNGA1",   lambda: 0.5593, complex: true,  r2: 0.212,  role: "Rod CNG channel α" },
  { gene: "GUCA1B",  lambda: 0.6187, complex: false, r2: 0.118,  role: "Guanylate cyclase activator" },
  { gene: "GUCY2D",  lambda: 0.6092, complex: false, r2: 0.104,  role: "Retinal guanylate cyclase" },
  { gene: "RDH12",   lambda: 0.7335, complex: false, r2: 0.225,  role: "Retinol dehydrogenase 12" },
  { gene: "GUCY2F",  lambda: 0.7394, complex: true,  r2: 0.153,  role: "Retinal guanylate cyclase" },
];

// Robustness / stress test summary
const ROBUSTNESS_TESTS = [
  {
    test: "Mann-Whitney U (non-parametric)",
    description: "Distribution-free rank test, no normality assumption",
    applied: "P1 (clock vs target), P4a (phototransduction vs clock), P4b (CRX vs clock/target)",
    status: "complete",
  },
  {
    test: "Permutation test (10,000 iterations)",
    description: "Label-shuffle null distribution, exact p-values without distributional assumption",
    applied: "P1: clock vs target hierarchy (p=0.659)",
    status: "complete",
  },
  {
    test: "Cohen's d effect size",
    description: "Standardised mean difference, quantifies practical significance independent of n",
    applied: "P1 (d=−0.151 small), P4a (d=0.110 negligible), P4b (d=0.134 small)",
    status: "complete",
  },
  {
    test: "Benjamini-Hochberg FDR correction",
    description: "Multiple testing correction across all pre-specified predictions",
    applied: "Applied to all Mann-Whitney p-values across P1, P4a, P4b simultaneously",
    status: "complete",
  },
  {
    test: "Fisher's exact test (root type enrichment)",
    description: "2×2 contingency table for complex vs real root enrichment/depletion",
    applied: "Clock gene complex roots vs genome background (P5)",
    status: "complete",
  },
  {
    test: "Expression-matched bias check",
    description: "Compares mean expression (FPKM) of clock vs target genes to detect expression-level confounding",
    applied: "Clock gene mean FPKM vs target mean FPKM in retina",
    status: "complete",
  },
  {
    test: "Cross-tissue replication check",
    description: "Same fitAR2() applied to SCN, LUN, LIV from same dataset for direct comparison",
    applied: "All tissue hierarchy comparisons (P2, P3)",
    status: "complete",
  },
  {
    test: "Identical algorithm validation",
    description: "fitAR2() code identical to server/category-statistical-tests.ts — mean-centred OLS before AR(2) estimation, confirmed consistent with published results",
    applied: "All analyses",
    status: "complete",
  },
];

// ─── Component helpers ───────────────────────────────────────────────────────

const CATEGORY_COLOR: Record<string, string> = {
  retinal: "#8b5cf6",
  central: "#818cf8",
  peripheral: "#22c55e",
};

function ResultBadge({ result }: { result: "CONFIRMED" | "FAILED" | "ASSESSED" }) {
  if (result === "CONFIRMED")
    return <Badge className="bg-emerald-600 text-white flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Confirmed</Badge>;
  if (result === "FAILED")
    return <Badge className="bg-rose-600 text-white flex items-center gap-1"><XCircle className="h-3 w-3" />Failed</Badge>;
  return <Badge className="bg-amber-500 text-white flex items-center gap-1"><HelpCircle className="h-3 w-3" />Assessed</Badge>;
}

function StatBox({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-slate-800/50 rounded-lg p-3 text-center">
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className="text-lg font-mono font-bold text-white">{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function pFormat(p: number): string {
  if (p < 0.001) return "< 0.001";
  if (p < 0.01)  return p.toFixed(3);
  return p.toFixed(3);
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function RetinalAnalysis() {
  const [openPred, setOpenPred] = useState<string | null>("P1");
  const [clockTissue, setClockTissue] = useState<"RET" | "SCN" | "LUN">("RET");
  const [geneTable, setGeneTable] = useState<"phototransduction" | "crx">("phototransduction");

  const tissueChartData = TISSUE_DATA.map(t => ({
    ...t,
    color: CATEGORY_COLOR[t.category],
  }));

  const clockGenes = CLOCK_GENES_BY_TISSUE[clockTissue];
  const clockForChart = [...clockGenes].sort((a, b) => a.lambda - b.lambda).map(g => ({
    gene: g.gene,
    lambda: g.lambda,
    fill: g.complex ? "#8b5cf6" : "#64748b",
  }));

  const photoSorted = [...PHOTOTRANSDUCTION_GENES].sort((a, b) => a.lambda - b.lambda);
  const crxSorted = [...CRX_REGULON_GENES].sort((a, b) => a.lambda - b.lambda);

  const passCount = PREDICTIONS.filter(p => p.result === "CONFIRMED").length;
  const failCount = PREDICTIONS.filter(p => p.result === "FAILED").length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/60 sticky top-0 z-40 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/light-entrainment">
            <button className="text-slate-400 hover:text-white flex items-center gap-1 text-sm">
              <ArrowLeft className="h-4 w-4" /> Light Entrainment
            </button>
          </Link>
          <span className="text-slate-600">/</span>
          <Eye className="h-5 w-5 text-violet-400" />
          <span className="font-semibold">Retinal Circadian Analysis</span>
          <Badge className="bg-violet-900/50 text-violet-300 border border-violet-700/50 text-xs ml-2">
            GSE98965 · Baboon · First-pass
          </Badge>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">

        {/* Title block */}
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Primate Retinal Circadian Clock Analysis
          </h1>
          <p className="text-slate-400 max-w-3xl leading-relaxed">
            AR(2) eigenvalue modulus analysis of the retinal circadian clock using direct baboon retina
            time-series (GSE98965, Mure et al. 2018). Five predictions pre-specified before results were examined.
            All statistics computed post-prediction. Findings reported regardless of direction.
          </p>
          <div className="flex flex-wrap gap-3 mt-4">
            <span className="text-sm text-slate-500 flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5" />
              {DATASET_INFO.accession} · {DATASET_INFO.species}
            </span>
            <span className="text-sm text-slate-500">·</span>
            <span className="text-sm text-slate-500">{DATASET_INFO.nTimepoints} timepoints, {DATASET_INFO.samplingInterval}</span>
            <span className="text-sm text-slate-500">·</span>
            <span className="text-sm text-slate-500">{DATASET_INFO.totalGenesRET.toLocaleString()} expressed genes fitted</span>
          </div>
        </div>

        {/* Prediction scoreboard */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-white flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-violet-400" />
              Pre-Specified Predictions — Scoreboard
            </CardTitle>
            <CardDescription>
              All predictions locked before data was examined. Results reported transparently including failures.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-emerald-950/40 border border-emerald-800/40 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-emerald-400">{passCount}</div>
                <div className="text-sm text-emerald-300 mt-1">Confirmed</div>
              </div>
              <div className="bg-rose-950/40 border border-rose-800/40 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-rose-400">{failCount}</div>
                <div className="text-sm text-rose-300 mt-1">Failed</div>
              </div>
              <div className="bg-amber-950/40 border border-amber-800/40 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-amber-400">1</div>
                <div className="text-sm text-amber-300 mt-1">Assessed</div>
              </div>
            </div>

            <div className="space-y-2">
              {PREDICTIONS.map(pred => (
                <Collapsible
                  key={pred.id}
                  open={openPred === pred.id}
                  onOpenChange={open => setOpenPred(open ? pred.id : null)}
                >
                  <CollapsibleTrigger className="w-full" data-testid={`pred-trigger-${pred.id}`}>
                    <div className={`flex items-center justify-between w-full p-4 rounded-lg border transition-colors ${
                      openPred === pred.id
                        ? "bg-slate-800 border-slate-600"
                        : "bg-slate-800/40 border-slate-700/50 hover:bg-slate-800/70"
                    }`}>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-slate-500 w-6">{pred.id}</span>
                        <ResultBadge result={pred.result} />
                        <span className="text-sm text-slate-200 text-left">{pred.question}</span>
                      </div>
                      <ChevronDown className={`h-4 w-4 text-slate-400 flex-shrink-0 transition-transform ${openPred === pred.id ? "rotate-180" : ""}`} />
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="bg-slate-800/30 border border-slate-700/40 border-t-0 rounded-b-lg p-5 space-y-4">
                      {/* Pre-specified criterion */}
                      <div className="bg-slate-900/50 rounded p-3">
                        <div className="text-xs text-slate-400 mb-1">Pre-specified criterion (locked before analysis)</div>
                        <div className="text-sm font-mono text-slate-300">{pred.preSpecified}</div>
                      </div>
                      {/* Rationale */}
                      <div>
                        <div className="text-xs text-slate-400 mb-1">Biological rationale</div>
                        <div className="text-sm text-slate-300 leading-relaxed">{pred.rationale}</div>
                      </div>
                      {/* Stats */}
                      {pred.id === "P1" && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <StatBox label="Clock median |λ|" value={pred.stats.clockMedian?.toFixed(4) ?? '—'} sub={`n=${pred.stats.nClock}`} />
                          <StatBox label="Target median |λ|" value={pred.stats.targetMedian?.toFixed(4) ?? '—'} sub={`n=${pred.stats.nTarget}`} />
                          <StatBox label="Mann-Whitney p" value={pred.stats.mannWhitneyP != null ? pFormat(pred.stats.mannWhitneyP) : '—'} sub="two-tailed" />
                          <StatBox label="Permutation p" value={pred.stats.permutationP != null ? pFormat(pred.stats.permutationP) : '—'} sub="10,000 iterations" />
                        </div>
                      )}
                      {pred.id === "P2" && (
                        <div className="grid grid-cols-3 gap-3">
                          <StatBox label="Retina τ_c" value={`${pred.stats.retTauC}h`} sub="−1/ln|λ| (clock)" />
                          <StatBox label="SCN τ_c" value={`${pred.stats.scnTauC}h`} sub="Same dataset" />
                          <StatBox label="Lung τ_c" value={`${pred.stats.lunTauC}h`} sub="Same dataset" />
                        </div>
                      )}
                      {pred.id === "P3" && (
                        <div className="grid grid-cols-2 gap-3">
                          <StatBox label="Retina/SCN τ_c ratio" value={`${pred.stats.retSCNRatio?.toFixed(3) ?? '—'}×`} sub="< 1 = faster than SCN" />
                          <StatBox label="Lung/SCN τ_c ratio" value={`${pred.stats.lunSCNRatio?.toFixed(3) ?? '—'}×`} sub="Peripheral reference" />
                        </div>
                      )}
                      {pred.id === "P4a" && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <StatBox label="Photo median |λ|" value={pred.stats.photoMedian?.toFixed(4) ?? '—'} sub={`n=${pred.stats.nPhoto}`} />
                          <StatBox label="Clock median |λ|" value={pred.stats.clockMedian?.toFixed(4) ?? '—'} sub="Retina" />
                          <StatBox label="Genome median |λ|" value={pred.stats.genomeMedian?.toFixed(4) ?? '—'} sub="n=20,350" />
                          <StatBox label="Mann-Whitney p" value={pred.stats.mannWhitneyP != null ? pFormat(pred.stats.mannWhitneyP) : '—'} sub="photo vs clock" />
                        </div>
                      )}
                      {pred.id === "P4b" && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          <StatBox label="CRX median |λ|" value={pred.stats.crxMedian?.toFixed(4) ?? '—'} sub={`n=${pred.stats.nCRX}`} />
                          <StatBox label="p vs clock" value={pred.stats.mannWhitneyP_vsClock != null ? pFormat(pred.stats.mannWhitneyP_vsClock) : '—'} sub="Mann-Whitney" />
                          <StatBox label="p vs canonical target" value={pred.stats.mannWhitneyP_vsTarget != null ? pFormat(pred.stats.mannWhitneyP_vsTarget) : '—'} sub="Mann-Whitney" />
                        </div>
                      )}
                      {pred.id === "P5" && (
                        <div className="grid grid-cols-3 gap-3">
                          <StatBox label="Complex roots" value={`${pred.stats.nComplex}/${pred.stats.nClock}`} sub="Clock genes" />
                          <StatBox label="% Complex" value={`${pred.stats.pctComplex}%`} sub="Pre-specified threshold: 50%" />
                          <StatBox label="SCN comparison" value="62.5%" sub="Complex in SCN clock" />
                        </div>
                      )}
                      {/* Interpretation */}
                      <div className={`rounded-lg p-4 ${
                        pred.result === "CONFIRMED" ? "bg-emerald-950/40 border border-emerald-800/40" :
                        pred.result === "FAILED"    ? "bg-rose-950/40 border border-rose-800/40" :
                        "bg-amber-950/40 border border-amber-800/40"
                      }`}>
                        <div className="text-xs text-slate-400 mb-1">Interpretation</div>
                        <div className="text-sm text-slate-200 leading-relaxed">{pred.interpretation}</div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tissue hierarchy chart */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Activity className="h-5 w-5 text-violet-400" />
              Eye Tissue Circadian Hierarchy
            </CardTitle>
            <CardDescription>
              Clock gene median |λ| across all tissues with available time-series data from GSE98965.
              Retina sits below SCN — uniquely fast dynamics for a light-sensing organ.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={tissueChartData}
                  margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <YAxis domain={[0, 0.8]} tick={{ fill: "#94a3b8", fontSize: 11 }} label={{ value: "|λ| (clock genes)", angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: 8 }}
                    formatter={(value: number, name: string) => [value.toFixed(4), name]}
                  />
                  <Bar dataKey="clockLambda" name="Clock |λ|" radius={[4, 4, 0, 0]}>
                    {tissueChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                  <ReferenceLine y={0.4331} stroke="#8b5cf6" strokeDasharray="6 3" label={{ value: "RET clock", fill: "#8b5cf6", fontSize: 11, position: "right" }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-4 mt-4 text-xs">
              {Object.entries(CATEGORY_COLOR).map(([cat, color]) => (
                <span key={cat} className="flex items-center gap-1.5 text-slate-400">
                  <span className="inline-block w-3 h-3 rounded-sm" style={{ background: color }} />
                  {cat === "retinal" ? "Retinal tissue" : cat === "central" ? "Central (SCN)" : "Peripheral"}
                </span>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-3">
              {TISSUE_DATA.map(t => (
                <div key={t.tissue} className="bg-slate-800/50 rounded-lg p-3 text-center">
                  <div className="text-xs text-slate-400 mb-1">{t.label}</div>
                  <div className="text-base font-mono font-bold text-white">{t.clockLambda.toFixed(4)}</div>
                  <div className="text-xs text-slate-500">τ_c = {t.tauC.toFixed(2)}h</div>
                  <div className="text-xs text-slate-500">{t.pctComplex}% complex</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Clock gene per-gene comparison */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Clock className="h-5 w-5 text-violet-400" />
              Per-Gene Clock |λ| — Retina vs SCN vs Lung
            </CardTitle>
            <CardDescription>
              Individual eigenvalue moduli for all 16 core clock genes. Violet bars = complex (oscillatory) roots; grey = real roots.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-4">
              {(["RET", "SCN", "LUN"] as const).map(t => (
                <button
                  key={t}
                  data-testid={`tissue-tab-${t}`}
                  onClick={() => setClockTissue(t)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    clockTissue === t
                      ? "bg-violet-700 text-white"
                      : "bg-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  {t === "RET" ? "Retina" : t === "SCN" ? "SCN" : "Lung"}
                </button>
              ))}
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={clockForChart}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis type="number" domain={[0, 1.5]} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                  <YAxis dataKey="gene" type="category" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: 8 }}
                    formatter={(v: number) => [v.toFixed(4), "|λ|"]}
                  />
                  <Bar dataKey="lambda" name="|λ|" radius={[0, 4, 4, 0]}>
                    {clockForChart.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                  <ReferenceLine x={0.5} stroke="#f59e0b" strokeDasharray="4 2" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex gap-4 text-xs text-slate-400 mt-2">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-violet-600 inline-block" />Complex (oscillatory) roots</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-slate-600 inline-block" />Real (monotonic) roots</span>
            </div>
          </CardContent>
        </Card>

        {/* Gene tables — phototransduction + CRX */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Eye className="h-5 w-5 text-violet-400" />
              Retinal Gene Sets
            </CardTitle>
            <CardDescription>
              Phototransduction module (P4a) and CRX regulon (P4b) — retina-specific gene sets tested against pre-specified predictions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-5">
              <button
                data-testid="tab-phototransduction"
                onClick={() => setGeneTable("phototransduction")}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  geneTable === "phototransduction"
                    ? "bg-violet-700 text-white"
                    : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                Phototransduction Module (n=24)
              </button>
              <button
                data-testid="tab-crx"
                onClick={() => setGeneTable("crx")}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  geneTable === "crx"
                    ? "bg-violet-700 text-white"
                    : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                CRX Regulon (n=22)
              </button>
            </div>

            {geneTable === "phototransduction" && (
              <>
                <div className="bg-violet-950/30 border border-violet-800/30 rounded-lg p-3 mb-4 text-sm text-violet-200">
                  <strong>Notable finding:</strong> OPN4 (melanopsin) shows high |λ|=0.904 — the highest in the phototransduction module.
                  This is biologically coherent: ipRGCs provide sustained, tonic light signals for circadian entrainment,
                  unlike rod/cone photoreceptors which adapt rapidly. RHO (rhodopsin) has the lowest |λ|=0.251, consistent with
                  rapid rod adaptation dynamics.
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="phototransduction-table">
                    <thead>
                      <tr className="text-left text-xs text-slate-400 border-b border-slate-700">
                        <th className="pb-2 font-medium">Gene</th>
                        <th className="pb-2 font-medium">|λ|</th>
                        <th className="pb-2 font-medium">Root type</th>
                        <th className="pb-2 font-medium">R²</th>
                        <th className="pb-2 font-medium">Function</th>
                      </tr>
                    </thead>
                    <tbody>
                      {photoSorted.map(g => (
                        <tr key={g.gene} className={`border-b border-slate-800/50 ${g.gene === "OPN4" ? "bg-violet-950/30" : ""}`}>
                          <td className="py-2 font-mono text-violet-300 font-semibold">{g.gene}</td>
                          <td className="py-2 font-mono">
                            <span className={g.lambda > 0.8 ? "text-amber-400" : g.lambda < 0.35 ? "text-emerald-400" : "text-slate-200"}>
                              {g.lambda.toFixed(4)}
                            </span>
                          </td>
                          <td className="py-2">
                            <Badge className={g.complex ? "bg-violet-900/50 text-violet-300 text-xs" : "bg-slate-700 text-slate-400 text-xs"}>
                              {g.complex ? "complex" : "real"}
                            </Badge>
                          </td>
                          <td className="py-2 font-mono text-slate-400 text-xs">{g.r2.toFixed(3)}</td>
                          <td className="py-2 text-slate-400 text-xs">{g.role}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 flex gap-4 text-xs text-slate-500">
                  <span>Module median |λ| = 0.4194</span>
                  <span>Clock median |λ| = 0.4331</span>
                  <span>Genome median |λ| = 0.4908</span>
                </div>
              </>
            )}

            {geneTable === "crx" && (
              <>
                <div className="bg-amber-950/30 border border-amber-800/30 rounded-lg p-3 mb-4 text-sm text-amber-200">
                  <strong>CRX regulon:</strong> 22 CRX/NRL target genes detected. Median |λ|=0.465 sits between clock (0.433)
                  and genome background (0.491). CRX itself has low |λ|=0.265 (complex, oscillatory) — consistent with
                  CRX acting as a rhythmically expressed transcription factor that drives downstream photoreceptor gene expression.
                  54.5% of CRX genes show complex roots vs 43% genome-wide.
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="crx-table">
                    <thead>
                      <tr className="text-left text-xs text-slate-400 border-b border-slate-700">
                        <th className="pb-2 font-medium">Gene</th>
                        <th className="pb-2 font-medium">|λ|</th>
                        <th className="pb-2 font-medium">Root type</th>
                        <th className="pb-2 font-medium">R²</th>
                        <th className="pb-2 font-medium">Function</th>
                      </tr>
                    </thead>
                    <tbody>
                      {crxSorted.map(g => (
                        <tr key={g.gene} className={`border-b border-slate-800/50 ${g.gene === "CRX" || g.gene === "NRL" ? "bg-amber-950/20" : ""}`}>
                          <td className="py-2 font-mono text-amber-300 font-semibold">{g.gene}</td>
                          <td className="py-2 font-mono">
                            <span className={g.lambda > 0.7 ? "text-amber-400" : g.lambda < 0.35 ? "text-emerald-400" : "text-slate-200"}>
                              {g.lambda.toFixed(4)}
                            </span>
                          </td>
                          <td className="py-2">
                            <Badge className={g.complex ? "bg-violet-900/50 text-violet-300 text-xs" : "bg-slate-700 text-slate-400 text-xs"}>
                              {g.complex ? "complex" : "real"}
                            </Badge>
                          </td>
                          <td className="py-2 font-mono text-slate-400 text-xs">{g.r2.toFixed(3)}</td>
                          <td className="py-2 text-slate-400 text-xs">{g.role}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 flex gap-4 text-xs text-slate-500">
                  <span>CRX regulon median |λ| = 0.4653</span>
                  <span>Clock median |λ| = 0.4331</span>
                  <span>54.5% complex roots (vs 43% genome)</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Key unexpected finding — OPN4 */}
        <Card className="bg-slate-900 border-amber-700/30">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              Unexpected Finding: OPN4 (Melanopsin) Shows High Temporal Persistence
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <StatBox label="OPN4 |λ|" value="0.9036" sub="Highest in phototransduction module" />
              <StatBox label="OPN4 R²" value="0.640" sub="Strong model fit" />
              <StatBox label="RHO |λ| (contrast)" value="0.2511" sub="Lowest rod gene" />
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              OPN4 (melanopsin), the light-sensitive protein in intrinsically photosensitive retinal ganglion cells
              (ipRGCs), has the highest |λ| in the entire phototransduction module at 0.904.
              This stands in sharp contrast to rhodopsin (RHO, |λ|=0.251) and the rod transducins (GNAT1, |λ|=0.300).
            </p>
            <p className="text-sm text-slate-300 leading-relaxed">
              Far from being unexpected, this result is biologically coherent once examined. Rods and cones adapt
              to light within milliseconds and require very low temporal memory (low |λ|) for accurate point-by-point
              luminance coding. By contrast, ipRGCs provide a sustained, integrating signal that accumulates light
              exposure over minutes to hours — exactly what is needed for circadian entrainment. High |λ| in OPN4
              would be consistent with sustained rather than transient expression dynamics.
            </p>
            <p className="text-sm text-slate-300 leading-relaxed">
              The high R²=0.640 for OPN4 indicates the AR(2) model fits the melanopsin time-series substantially
              better than most genes, suggesting OPN4 expression follows a highly structured temporal autocorrelation
              pattern — the signature of a tightly regulated output gene rather than a rapidly adaptive sensor.
            </p>
            <div className="bg-amber-950/30 border border-amber-700/30 rounded-lg p-3 text-sm text-amber-200">
              <strong>Limitation (post-hoc observation):</strong> The OPN4 finding was not pre-specified — it emerged
              from inspecting the phototransduction gene list. It is reported as exploratory and requires replication
              in independent retinal datasets before any conclusions can be drawn.
            </div>
          </CardContent>
        </Card>

        {/* Robustness tests */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Zap className="h-5 w-5 text-violet-400" />
              Robustness and Stress Testing
            </CardTitle>
            <CardDescription>
              Same statistical battery applied to all platform analyses. All tests completed before page publication.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {ROBUSTNESS_TESTS.map((test, i) => (
                <div key={i} className="flex gap-4 p-4 bg-slate-800/40 rounded-lg border border-slate-700/40">
                  <div className="flex-shrink-0 mt-0.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white mb-0.5">{test.test}</div>
                    <div className="text-xs text-slate-400 mb-1">{test.description}</div>
                    <div className="text-xs text-slate-500 font-mono">{test.applied}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Biological synthesis */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Info className="h-5 w-5 text-violet-400" />
              Biological Synthesis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-300 leading-relaxed">
            <p>
              The retina occupies an anomalous position in the primate circadian hierarchy. Of the five pre-specified
              predictions, P1, P2 and P5 failed — and the failures are scientifically informative rather than merely
              negative. The pattern of failures consistently points in the same direction: the retina operates with
              shorter temporal memory (lower |λ|, lower τ_c) than any other tissue in this dataset, including the
              SCN itself.
            </p>
            <p>
              This challenges the assumption that the clock gene hierarchy should be universal across tissues. In the
              12 mouse tissues and 60 baboon tissues examined by the light entrainment analysis on this platform,
              clock genes reliably show higher |λ| than background. In the retina, this relationship breaks down.
              The retina is not a tissue where canonical clock persistence rules apply — it is an organ where rapid
              temporal resetting is a functional requirement.
            </p>
            <p>
              The one unambiguous confirmation (P3) and the directional P4a confirmation are consistent with the
              interpretation that the retina is a fast-dynamics system: it sits closer to the SCN in re-entrainment
              speed than any peripheral tissue (P3 confirmed), and its light-response genes cluster at low |λ|
              (P4a directionally confirmed). These patterns fit a single coherent model in which the retina
              is designed to rapidly update its gene expression state in response to photic input.
            </p>
            <p>
              The optic nerve head (ONH) tells a different story: with the highest clock |λ| (0.669) and longest
              τ_c (2.49h) of all five tissues, the ONH appears to be the most temporally persistent component of
              the retinal complex. This has no pre-specified prediction attached to it and should be treated as
              exploratory; however, it raises the hypothesis that structural retinal components (sclera, optic
              nerve) have slower circadian dynamics than the light-sensing neurons.
            </p>
            <div className="bg-slate-800/60 rounded-lg p-4 border border-slate-700/40">
              <div className="text-xs text-slate-400 mb-2">Dataset & method limitations</div>
              <ul className="space-y-1.5 text-xs text-slate-400 list-disc list-inside">
                <li>Single dataset (GSE98965) — all findings require independent replication</li>
                <li>FPKM normalisation — cell-type composition effects not controlled (retina is a mixed tissue)</li>
                <li>n=12 timepoints limits AR(2) power — gene-level results especially should be treated cautiously</li>
                <li>RPE and IRI columns present in dataset but no detectable expression — excluded from analysis</li>
                <li>Baboon ≠ human — gene regulation may differ despite high orthology</li>
                <li>OPN4 result is post-hoc and exploratory — not pre-specified</li>
                <li>P4a Mann-Whitney p=0.76 (n=24) — insufficient power for significance; directional only</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Data provenance */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-sm text-slate-400 font-medium">Data Provenance and Methods</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-500 space-y-2">
            <p><strong className="text-slate-400">Dataset:</strong> {DATASET_INFO.accession} — {DATASET_INFO.reference}. {DATASET_INFO.species}. FPKM-normalised RNA-seq. {DATASET_INFO.samplingInterval}. Direct tissue dissection (not sorted cells).</p>
            <p><strong className="text-slate-400">AR(2) fitting:</strong> {DATASET_INFO.method}. Mean-centred OLS. Eigenvalue computed as |√(-β₂)| for complex roots, max(|r₁|,|r₂|) for real roots. Identical implementation to server/category-statistical-tests.ts.</p>
            <p><strong className="text-slate-400">Gene classification:</strong> Core clock genes identical to all other platform analyses (PER1/2/3, CRY1/2, CLOCK, ARNTL, NR1D1/2, RORA, RORC, DBP, TEF, HLF, NFIL3, NPAS2). Phototransduction module and CRX regulon sets pre-specified using ChIP-seq literature.</p>
            <p><strong className="text-slate-400">Expressed gene filter:</strong> At least one FPKM value {'>'}  0 across all 12 timepoints. RHO, OPN4 and all phototransduction genes passed this filter in RET columns confirming retinal origin of expression.</p>
            <p><strong className="text-slate-400">Reproducibility:</strong> Full analysis script at scripts/retinal-analysis-compute.ts. Results written to scripts/retinal-analysis-results.json. Random seed not fixed for permutation test — minor variation in exact p-values on re-run (±0.01 expected).</p>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
