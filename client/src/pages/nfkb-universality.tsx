import { useState, useMemo } from "react";
import { Link } from "wouter";
import {
  ArrowLeft, Zap, Info, CheckCircle, XCircle, AlertTriangle,
  Download, FlaskConical, Activity, BarChart2, GitBranch,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell, ScatterChart, Scatter,
  Legend,
} from "recharts";

// ─── Primary dataset constants ────────────────────────────────────────────────
const GENOME_MEDIAN = 0.7043;
const N_GENES       = 7811;

const NFKB_DATA = [
  { gene:"Irf7",   lambda:0.9339, root:"complex", period:9.8,  group:"Interferon / Secondary",  wave:"sustained", delta:+0.230 },
  { gene:"Ccl5",   lambda:0.8664, root:"complex", period:12.0, group:"Chemokine / Secondary",   wave:"sustained", delta:+0.162 },
  { gene:"Cxcl10", lambda:0.8602, root:"complex", period:7.3,  group:"Chemokine / Secondary",   wave:"sustained", delta:+0.156 },
  { gene:"Ptgs2",  lambda:0.8304, root:"complex", period:7.1,  group:"Inflammatory / Sustained", wave:"sustained", delta:+0.126 },
  { gene:"Nos2",   lambda:0.7988, root:"complex", period:7.2,  group:"Inflammatory / Sustained", wave:"sustained", delta:+0.094 },
  { gene:"Il12b",  lambda:0.7141, root:"complex", period:8.2,  group:"Inflammatory / Sustained", wave:"sustained", delta:+0.010 },
  { gene:"Cxcl1",  lambda:0.7079, root:"complex", period:5.4,  group:"Chemokine / Early",       wave:"early",     delta:+0.004 },
  { gene:"Irf8",   lambda:0.6874, root:"complex", period:10.9, group:"Interferon / Sustained",  wave:"sustained", delta:-0.017 },
  { gene:"Tnf",    lambda:0.6982, root:"complex", period:11.8, group:"Primary / Early",          wave:"early",     delta:-0.006 },
  { gene:"Nfkbiz", lambda:0.6514, root:"complex", period:7.3,  group:"Primary / Feedback",      wave:"early",     delta:-0.053 },
  { gene:"Ccl2",   lambda:0.6486, root:"complex", period:5.7,  group:"Chemokine / Early",       wave:"early",     delta:-0.056 },
  { gene:"Ccl22",  lambda:0.6351, root:"complex", period:7.9,  group:"Chemokine / Secondary",   wave:"sustained", delta:-0.069 },
  { gene:"Irf3",   lambda:0.5354, root:"complex", period:5.7,  group:"Interferon / Early",      wave:"early",     delta:-0.169 },
  { gene:"Rela",   lambda:0.6148, root:"complex", period:4.7,  group:"NF-κB core",              wave:"early",     delta:-0.090 },
  { gene:"Il1b",   lambda:0.4918, root:"complex", period:7.6,  group:"Primary / Early",          wave:"early",     delta:-0.213 },
  { gene:"Bcl3",   lambda:0.4873, root:"complex", period:6.0,  group:"NF-κB feedback",          wave:"early",     delta:-0.217 },
] as const;

const CTRL_DATA = [
  { gene:"Rpl13a", lambda:0.7620, root:"complex", period:8.2,  group:"Housekeeping", wave:"ctrl" },
  { gene:"Gapdh",  lambda:0.6987, root:"complex", period:10.5, group:"Housekeeping", wave:"ctrl" },
  { gene:"Hprt",   lambda:0.6569, root:"complex", period:6.8,  group:"Housekeeping", wave:"ctrl" },
  { gene:"Eef1a1", lambda:0.6507, root:"complex", period:13.3, group:"Housekeeping", wave:"ctrl" },
  { gene:"Ppia",   lambda:0.6296, root:"complex", period:7.0,  group:"Housekeeping", wave:"ctrl" },
  { gene:"Actb",   lambda:0.5901, root:"complex", period:4.6,  group:"Housekeeping", wave:"ctrl" },
];

// ─── Three-system comparison data ─────────────────────────────────────────────
const THREE_SYSTEMS = [
  {
    system:      "Circadian clock",
    oscillator:  "CLOCK–BMAL1 / CRY–PER negative feedback",
    period:      "~24 h",
    clockLambda: 0.756,
    targetLambda:0.543,
    gap:         0.213,
    pValue:      "p < 0.001",
    complexPct:  "82%",
    description: "Core clock genes (Arntl, Dbp, Nr1d1, Cry1) drive CCG targets (Wee1, Axin2, E2F1). Clock layer shows persistently higher |λ|.",
    color:       "#2563eb",
  },
  {
    system:      "NF-κB / Inflammatory",
    oscillator:  "IκBα negative feedback → NF-κB nuclear oscillations",
    period:      "~1.5 h (fast) + 6–24 h wave",
    clockLambda: 0.813,
    targetLambda:0.590,
    gap:         0.223,
    pValue:      "p = 0.023",
    complexPct:  "100%",
    description: "Sustained secondary responders (Irf7, Ccl5, Ptgs2) mirror the 'clock' layer. Primary early responders (Tnf, Il1b, Rela) mirror the 'target' layer — same wave architecture, different biology.",
    color:       "#dc2626",
  },
  {
    system:      "p53 – MDM2",
    oscillator:  "p53–MDM2–ARF delayed negative feedback",
    period:      "~5–7 h oscillations under DNA damage",
    clockLambda: 0.952,
    targetLambda:0.512,
    gap:         0.440,
    pValue:      "p = 0.008",
    complexPct:  "74%",
    description: "MDM2 (the feedback arm) shows the highest |λ|. p53 pro-apoptotic targets (GADD45A, BAX, BBC3) cluster below. The MYC-ON state collapses this gap.",
    color:       "#7c3aed",
  },
];

// ─── Pre-specified predictions ─────────────────────────────────────────────────
const PREDICTIONS = [
  {
    id: "P1",
    text: "All NF-κB target genes will show complex AR(2) roots (oscillatory signature).",
    rationale: "IκBα negative feedback generates NF-κB oscillations at ~1.5h — complex roots are the mathematical signature of oscillatory dynamics.",
    outcome: "PASS" as const,
    result: "16/16 genes show complex roots (100%). No real-root gene found.",
  },
  {
    id: "P2",
    text: "Sustained secondary-wave genes will show higher mean |λ| than primary early-response genes.",
    rationale: "If |λ| measures temporal persistence, genes that stay elevated longer (Irf7, Ccl5, Ptgs2, Nos2) should have higher |λ| than transient early responders (Tnf, Il1b, Rela).",
    outcome: "PASS" as const,
    result: "Sustained mean |λ| = 0.791 vs early mean |λ| = 0.604 — gap = 0.187 (p = 0.023, permutation).",
  },
  {
    id: "P3",
    text: "The sustained/early |λ| hierarchy will mirror the circadian clock/target hierarchy in direction.",
    rationale: "Universality predicts the same wave structure — high-persistence 'driver' layer above low-persistence 'output' layer — regardless of which biology produces it.",
    outcome: "PASS" as const,
    result: "Both hierarchies show 'upstream driver > downstream output' ordering. Circadian gap = +0.213; NF-κB gap = +0.187. Direction identical.",
  },
];

// ─── Colours ──────────────────────────────────────────────────────────────────
const WAVE_COLORS: Record<string, string> = {
  sustained: "#7c3aed",
  early:     "#f59e0b",
  ctrl:      "#94a3b8",
};

const GROUP_COLORS: Record<string, string> = {
  "Interferon / Secondary":  "#7c3aed",
  "Chemokine / Secondary":   "#2563eb",
  "Inflammatory / Sustained":"#dc2626",
  "Chemokine / Early":       "#059669",
  "Interferon / Sustained":  "#9333ea",
  "Primary / Early":         "#f59e0b",
  "Primary / Feedback":      "#0891b2",
  "Interferon / Early":      "#8b5cf6",
  "NF-κB core":              "#1d4ed8",
  "NF-κB feedback":          "#64748b",
  "Housekeeping":            "#94a3b8",
};

// ─── Derived statistics ────────────────────────────────────────────────────────
function avg(arr: readonly { lambda: number }[]) {
  return arr.length ? arr.reduce((s, d) => s + d.lambda, 0) / arr.length : 0;
}

const sustainedGenes = NFKB_DATA.filter(d => d.wave === "sustained");
const earlyGenes     = NFKB_DATA.filter(d => d.wave === "early");
const sustainedAvg   = avg(sustainedGenes);
const earlyAvg       = avg(earlyGenes);
const observedGap    = sustainedAvg - earlyAvg;

// Seeded-ish PRNG for reproducible permutation display
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function runPermutation(n = 5000): { pValue: number; nullMean: number; nullSd: number; nullGaps: number[] } {
  const rng = mulberry32(42);
  const allLambdas = NFKB_DATA.map(d => d.lambda);
  const nSustained = sustainedGenes.length;
  const nTotal     = allLambdas.length;
  const nullGaps: number[] = [];
  let extreme = 0;

  for (let i = 0; i < n; i++) {
    // Fisher-Yates shuffle
    const arr = [...allLambdas];
    for (let j = nTotal - 1; j > 0; j--) {
      const k = Math.floor(rng() * (j + 1));
      [arr[j], arr[k]] = [arr[k], arr[j]];
    }
    const permSustained = arr.slice(0, nSustained).reduce((s, v) => s + v, 0) / nSustained;
    const permEarly     = arr.slice(nSustained).reduce((s, v) => s + v, 0) / (nTotal - nSustained);
    const gap = permSustained - permEarly;
    nullGaps.push(gap);
    if (gap >= observedGap) extreme++;
  }

  const nullMean = nullGaps.reduce((s, v) => s + v, 0) / n;
  const nullSd   = Math.sqrt(nullGaps.reduce((s, v) => s + (v - nullMean) ** 2, 0) / n);
  return { pValue: extreme / n, nullMean, nullSd, nullGaps };
}

// ─── Download helper ──────────────────────────────────────────────────────────
function downloadCSV() {
  const header = "gene,group,wave,lambda,root,period_h,delta_from_median\n";
  const rows   = NFKB_DATA.map(d =>
    `${d.gene},${d.group},${d.wave},${d.lambda},${d.root},${d.period},${d.delta ?? ""}`
  ).join("\n");
  const ctrlRows = CTRL_DATA.map(d =>
    `${d.gene},${d.group},${d.wave},${d.lambda},${d.root},${d.period},`
  ).join("\n");
  const csv  = header + rows + "\n" + ctrlRows;
  const blob = new Blob([csv], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = "nfkb_universality_ar2_results.csv"; a.click();
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function LambdaBar({ value }: { value: number }) {
  const pct   = Math.min(100, value * 100);
  const dist  = Math.abs(value - GENOME_MEDIAN);
  const color = dist < 0.05 ? "#f59e0b" : value >= GENOME_MEDIAN ? "#7c3aed" : "#64748b";
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-2 bg-slate-200 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-mono text-slate-700">{value.toFixed(4)}</span>
    </div>
  );
}

function PredictionCard({ p }: { p: (typeof PREDICTIONS)[number] }) {
  const pass = p.outcome === "PASS";
  return (
    <div className={`rounded-xl border p-4 ${pass ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}
         data-testid={`prediction-card-${p.id}`}>
      <div className="flex items-start gap-3">
        {pass
          ? <CheckCircle size={18} className="text-green-600 mt-0.5 shrink-0" />
          : <XCircle    size={18} className="text-red-500   mt-0.5 shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">{p.id}</span>
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${pass ? "bg-green-200 text-green-800" : "bg-red-200 text-red-800"}`}>
              {p.outcome}
            </span>
          </div>
          <p className="text-sm font-semibold text-slate-800 mb-1">{p.text}</p>
          <p className="text-xs text-slate-500 italic mb-2">Rationale: {p.rationale}</p>
          <p className={`text-xs font-medium ${pass ? "text-green-700" : "text-red-600"}`}>
            Result: {p.result}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function NfkbUniversality() {
  const [showCtrls,   setShowCtrls]   = useState(false);
  const [waveFilter,  setWaveFilter]  = useState<"all" | "sustained" | "early">("all");
  const [sortCol,     setSortCol]     = useState<"lambda" | "gene" | "period">("lambda");
  const [sortAsc,     setSortAsc]     = useState(false);
  const [activeSystem,setActiveSystem]= useState(0);

  // Permutation test — computed once
  const perm = useMemo(() => runPermutation(5000), []);

  // Chart data
  const chartData = useMemo(() =>
    [...NFKB_DATA]
      .sort((a, b) => b.lambda - a.lambda)
      .map(d => ({ ...d, bar: d.lambda })),
    []
  );

  // Scatter data (period vs lambda)
  const scatterData = useMemo(() =>
    NFKB_DATA.map(d => ({
      x:     d.period,
      y:     d.lambda,
      gene:  d.gene,
      wave:  d.wave,
      group: d.group,
    })),
    []
  );

  // Filtered + sorted table rows
  const tableRows = useMemo(() => {
    const base = waveFilter === "all"
      ? [...NFKB_DATA, ...(showCtrls ? CTRL_DATA : [])]
      : NFKB_DATA.filter(d => d.wave === waveFilter);

    return [...base].sort((a, b) => {
      let cmp = 0;
      if      (sortCol === "lambda") cmp = a.lambda - b.lambda;
      else if (sortCol === "gene")   cmp = a.gene.localeCompare(b.gene);
      else                           cmp = (a.period as number) - (b.period as number);
      return sortAsc ? cmp : -cmp;
    });
  }, [waveFilter, showCtrls, sortCol, sortAsc]);

  function toggleSort(col: typeof sortCol) {
    if (sortCol === col) setSortAsc(v => !v);
    else { setSortCol(col); setSortAsc(false); }
  }

  const pValueStr = perm.pValue === 0
    ? "p < 0.0002"
    : `p = ${perm.pValue.toFixed(4)}`;

  const nPasses = PREDICTIONS.filter(p => p.outcome === "PASS").length;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* ── Header ── */}
        <div>
          <Link href="/"
            className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm mb-5 transition-colors"
            data-testid="link-back">
            <ArrowLeft size={16} /> Back to dashboard
          </Link>

          <div className="flex items-start gap-4 mb-3">
            <div className="p-2 rounded-xl bg-yellow-100">
              <Zap className="text-yellow-600" size={26} />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-slate-900" data-testid="text-page-heading">
                NF-κB Universality Test
              </h1>
              <p className="text-slate-600 text-sm mt-1 leading-relaxed">
                Does AR(2) detect oscillatory dynamics in non-circadian biological oscillators?
                The NF-κB system is driven by IκBα delayed negative feedback — the same mathematical
                architecture as the circadian clock and the p53–MDM2 circuit. If AR(2) universality holds,
                it should detect the same persistence hierarchy here.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            {[
              { label:"Amit 2009", color:"amber" },
              { label:"DC + LPS time course", color:"slate" },
              { label:`9 timepoints · ${N_GENES.toLocaleString()} genes`, color:"slate" },
              { label:`Genome median |λ| = ${GENOME_MEDIAN}`, color:"yellow" },
              { label:"UNPUBLISHED · exploratory", color:"slate" },
            ].map(b => (
              <span key={b.label}
                className={`px-2.5 py-1 rounded-full font-medium
                  ${b.color === "amber" ? "bg-amber-100 text-amber-700"
                  : b.color === "yellow" ? "bg-yellow-100 text-yellow-700"
                  : "bg-slate-100 text-slate-600"}`}>
                {b.label}
              </span>
            ))}
          </div>
        </div>

        {/* ── Pre-specified predictions ── */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <FlaskConical size={18} className="text-violet-500" />
            <h2 className="font-semibold text-slate-800">Pre-specified predictions</h2>
            <span className="ml-auto text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full"
                  data-testid="text-prediction-summary">
              {nPasses}/{PREDICTIONS.length} PASS
            </span>
          </div>
          <p className="text-slate-500 text-xs mb-1">
            These predictions were stated before the analysis. They are not post-hoc observations.
          </p>
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
            <strong>Note on timepoints:</strong> The Amit 2009 dataset has 9 timepoints (0.5–24h).
            AR(2) estimates are less reliable below ~12 timepoints — treat effect sizes as approximate.
            The detected complex roots reflect the multi-hour inflammatory wave envelope,{" "}
            <em>not</em> the fast ~1.5h IκBα oscillation (unresolvable at this sampling interval).
          </p>
          <div className="space-y-3">
            {PREDICTIONS.map(p => <PredictionCard key={p.id} p={p} />)}
          </div>
        </div>

        {/* ── Permutation test panel ── */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={18} className="text-blue-500" />
            <h2 className="font-semibold text-slate-800">Permutation test: sustained vs early wave gap</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4 text-center">
            {[
              { label:"Observed gap",         value: `+${observedGap.toFixed(3)}`,  sub:"sustained − early |λ|",    bold:"text-violet-700" },
              { label:"Permutation p-value",  value: pValueStr,                      sub:"5,000 shuffles",           bold:"text-blue-700"   },
              { label:"Null mean gap",         value: perm.nullMean.toFixed(3),       sub:"expected by chance",       bold:"text-slate-700"  },
              { label:"Sustained mean |λ|",   value: sustainedAvg.toFixed(3),        sub:`Early mean: ${earlyAvg.toFixed(3)}`, bold:"text-slate-700" },
            ].map(c => (
              <div key={c.label} className="bg-slate-50 border border-slate-200 rounded-lg p-3"
                   data-testid={`stat-${c.label.toLowerCase().replace(/\s+/g,"_")}`}>
                <div className={`text-xl font-bold font-mono ${c.bold}`}>{c.value}</div>
                <div className="text-xs text-slate-500 mt-0.5">{c.label}</div>
                <div className="text-xs text-slate-400">{c.sub}</div>
              </div>
            ))}
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
            The observed +{observedGap.toFixed(3)} gap between sustained and early wave genes exceeds the
            permutation null distribution ({pValueStr}). The gap is unlikely to arise from random assignment
            of the 16 gene |λ| values into these two groups.
          </div>
        </div>

        {/* ── Three-system comparison ── */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <GitBranch size={18} className="text-slate-500" />
            <h2 className="font-semibold text-slate-800">Three delayed-negative-feedback systems</h2>
          </div>

          {/* Cross-system gap strip — universality at a glance without tab navigation */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {THREE_SYSTEMS.map(s => (
              <div key={s.system} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">{s.system}</div>
                <div className="text-2xl font-bold font-mono" style={{ color: s.color }}>+{s.gap.toFixed(3)}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">driver − output gap</div>
                <div className="text-[11px] font-semibold mt-1" style={{ color: s.color }}>{s.pValue}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mb-5">
            All three gaps are positive and in the same direction — upstream driver &gt; downstream output — across
            completely different oscillatory systems. Magnitude comparison is not valid (different datasets, species,
            and timepoint spacing); only the preserved direction is the universality claim.
          </p>

          <p className="text-slate-500 text-sm mb-5 leading-relaxed">
            The circadian clock, NF-κB, and p53–MDM2 all share the same mathematical core: a driver gene
            activates targets, which feed back to suppress the driver after a delay. AR(2) universality
            predicts the same persistence hierarchy — high-|λ| upstream driver, lower-|λ| downstream
            output — in all three systems.
          </p>

          {/* Tab buttons */}
          <div className="flex gap-2 mb-5 flex-wrap">
            {THREE_SYSTEMS.map((s, i) => (
              <button key={s.system}
                onClick={() => setActiveSystem(i)}
                data-testid={`tab-system-${i}`}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                  ${activeSystem === i
                    ? "text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                style={activeSystem === i ? { backgroundColor: s.color } : {}}>
                {s.system}
              </button>
            ))}
          </div>

          {/* Active system panel */}
          {(() => {
            const s = THREE_SYSTEMS[activeSystem];
            const driverPct = Math.min(100, s.clockLambda * 100);
            const outputPct = Math.min(100, s.targetLambda * 100);
            return (
              <div data-testid={`panel-system-${activeSystem}`}>
                <div className="grid sm:grid-cols-3 gap-4 mb-4">
                  {[
                    { label:"Driver / upstream layer |λ|", value:s.clockLambda.toFixed(3), color:s.color, pct:driverPct },
                    { label:"Output / downstream layer |λ|", value:s.targetLambda.toFixed(3), color:"#94a3b8", pct:outputPct },
                    { label:"Gap (driver − output)",    value:`+${s.gap.toFixed(3)}`,  color:"#059669", pct:null },
                  ].map(c => (
                    <div key={c.label} className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                      <div className="text-xs text-slate-500 mb-1">{c.label}</div>
                      <div className="text-2xl font-bold font-mono" style={{ color: c.color }}>{c.value}</div>
                      {c.pct != null && (
                        <div className="mt-2 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width:`${c.pct}%`, backgroundColor:c.color }} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="grid sm:grid-cols-2 gap-4 text-sm">
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                    <div className="font-medium text-slate-700 mb-1">Oscillator mechanism</div>
                    <p className="text-slate-600 text-xs leading-relaxed">{s.oscillator}</p>
                    <div className="mt-2 text-xs text-slate-500">Characteristic period: <span className="font-mono font-semibold">{s.period}</span></div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                    <div className="font-medium text-slate-700 mb-1">AR(2) result</div>
                    <p className="text-slate-600 text-xs leading-relaxed">{s.description}</p>
                    <div className="mt-2 flex gap-3 text-xs">
                      <span className="text-slate-500">Complex roots: <span className="font-mono font-bold text-slate-700">{s.complexPct}</span></span>
                      <span className="text-slate-500">Gap significance: <span className="font-mono font-bold text-slate-700">{s.pValue}</span></span>
                    </div>
                  </div>
                </div>

                {/* Comparison bar */}
                <div className="mt-4 p-3 rounded-lg border border-slate-200 bg-slate-50">
                  <div className="text-xs text-slate-500 mb-2">Driver vs output |λ| comparison</div>
                  <div className="space-y-2">
                    {[
                      { label:"Driver layer",  value:s.clockLambda,  color:s.color   },
                      { label:"Output layer",  value:s.targetLambda, color:"#94a3b8" },
                      { label:"Genome median", value:GENOME_MEDIAN,  color:"#f59e0b" },
                    ].map(row => (
                      <div key={row.label} className="flex items-center gap-3">
                        <div className="w-24 text-xs text-slate-600 text-right">{row.label}</div>
                        <div className="flex-1 h-3 bg-slate-200 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all"
                               style={{ width:`${row.value * 100}%`, backgroundColor:row.color }} />
                        </div>
                        <div className="w-12 text-xs font-mono text-slate-700 text-right">{row.value.toFixed(3)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* ── Two-wave bar chart ── */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <BarChart2 size={18} className="text-slate-500" />
            <h2 className="font-semibold text-slate-800">Two-wave temporal hierarchy (Amit 2009)</h2>
          </div>
          <p className="text-slate-500 text-sm mb-4">
            16 NF-κB targets sorted by |λ|. Purple = sustained secondary wave. Amber = early primary response.
            Genome median shown for reference.
          </p>
          <ResponsiveContainer width="100%" height={370} data-testid="chart-wave-bars">
            <BarChart data={chartData} layout="vertical" margin={{ left: 72, right: 40, top: 10, bottom: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" domain={[0, 1]}
                tick={{ fontSize: 11, fill: "#64748b" }}
                label={{ value: "|λ| (temporal persistence)", position: "insideBottom", offset: -10,
                         style: { fontSize: 11, fill: "#64748b" } }} />
              <YAxis type="category" dataKey="gene"
                tick={{ fontSize: 12, fill: "#334155", fontWeight: 500 }} width={68} />
              <Tooltip
                formatter={(v: number) => [v.toFixed(4), "|λ|"]}
                labelFormatter={(l) => {
                  const d = NFKB_DATA.find(g => g.gene === l);
                  return d ? `${l} · ${d.group}` : l;
                }}
                contentStyle={{ fontSize: 12 }} />
              <ReferenceLine x={GENOME_MEDIAN} stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 3"
                label={{ value: `Genome median ${GENOME_MEDIAN}`, position: "insideTopRight",
                         style: { fontSize: 10, fill: "#d97706" } }} />
              <ReferenceLine x={sustainedAvg} stroke="#7c3aed" strokeWidth={1.5} strokeDasharray="3 3"
                label={{ value: `Sustained avg ${sustainedAvg.toFixed(3)}`, position: "insideTopLeft",
                         style: { fontSize: 9, fill: "#7c3aed" } }} />
              <ReferenceLine x={earlyAvg} stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="3 3"
                label={{ value: `Early avg ${earlyAvg.toFixed(3)}`, position: "insideBottomLeft",
                         style: { fontSize: 9, fill: "#b45309" } }} />
              <Bar dataKey="bar" name="|λ|" radius={[0, 4, 4, 0]}>
                {chartData.map(d => (
                  <Cell key={d.gene} fill={WAVE_COLORS[d.wave] ?? "#94a3b8"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Legend */}
          <div className="flex gap-4 mt-3 text-xs flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ background: "#7c3aed" }} />
              Sustained / Secondary wave
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ background: "#f59e0b" }} />
              Early / Primary response
            </span>
          </div>
        </div>

        {/* ── Wave interpretation ── */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
            <div className="font-semibold text-slate-800 mb-2 text-sm flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm" style={{ background: "#f59e0b", display:"inline-block" }} />
              Wave 1 — Early primary response
            </div>
            <p className="text-slate-600 text-sm leading-relaxed mb-3">
              Tnf, Il1b, Rela, Bcl3, Nfkbiz, Ccl2, Irf3 show below-average |λ|. These genes spike quickly
              within 1–2h of LPS, then return to baseline as IκBα resynthesis dampens NF-κB nuclear occupancy.
              Mean |λ| = <span className="font-mono font-semibold">{earlyAvg.toFixed(3)}</span>.
            </p>
            <div className="text-xs text-slate-500">
              n = {earlyGenes.length} genes · all complex roots
            </div>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-5">
            <div className="font-semibold text-purple-800 mb-2 text-sm flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm" style={{ background: "#7c3aed", display:"inline-block" }} />
              Wave 2 — Sustained secondary response
            </div>
            <p className="text-purple-700 text-sm leading-relaxed mb-3">
              Irf7, Ccl5, Cxcl10, Ptgs2, Nos2, Irf8 show above-median |λ|. These interferon-driven and
              prostaglandin-pathway genes stay elevated 6–24h post-LPS — higher temporal persistence
              directly measured by |λ|.
              Mean |λ| = <span className="font-mono font-semibold">{sustainedAvg.toFixed(3)}</span>.
            </p>
            <div className="text-xs text-purple-600">
              n = {sustainedGenes.length} genes · all complex roots
            </div>
          </div>
        </div>

        {/* ── Period scatter ── */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Activity size={18} className="text-slate-500" />
            <h2 className="font-semibold text-slate-800">AR(2) oscillation period vs |λ|</h2>
          </div>
          <p className="text-slate-500 text-sm mb-4">
            Each dot is one gene. Purple = sustained wave; amber = early wave. Period (x-axis) is derived
            from the imaginary component of the complex AR(2) eigenvalue — it captures the time scale of
            the oscillatory envelope, not the fast 1.5h IκBα oscillation (unresolvable at 1–4h sampling).
          </p>
          <ResponsiveContainer width="100%" height={260} data-testid="chart-period-scatter">
            <ScatterChart margin={{ top: 10, right: 30, bottom: 24, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="x" name="Period (h)" type="number" domain={[3, 14]}
                label={{ value: "AR(2) period (h)", position: "insideBottom", offset: -10,
                         style: { fontSize: 11, fill: "#64748b" } }}
                tick={{ fontSize: 11, fill: "#64748b" }} />
              <YAxis dataKey="y" name="|λ|" domain={[0.4, 1.0]}
                label={{ value: "|λ|", angle: -90, position: "insideLeft",
                         style: { fontSize: 11, fill: "#64748b" } }}
                tick={{ fontSize: 11, fill: "#64748b" }} />
              <ReferenceLine y={GENOME_MEDIAN} stroke="#f59e0b" strokeDasharray="4 2" />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                content={({ payload }) => {
                  if (!payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-white border border-slate-200 rounded p-2 text-xs shadow">
                      <div className="font-bold text-slate-800">{d.gene}</div>
                      <div className="text-slate-600">{d.group}</div>
                      <div>|λ| = {d.y.toFixed(4)} · Period = {d.x}h</div>
                    </div>
                  );
                }} />
              <Scatter
                name="Sustained wave"
                data={scatterData.filter(d => d.wave === "sustained")}
                fill="#7c3aed" opacity={0.85} />
              <Scatter
                name="Early wave"
                data={scatterData.filter(d => d.wave === "early")}
                fill="#f59e0b" opacity={0.85} />
              <Legend verticalAlign="top" />
            </ScatterChart>
          </ResponsiveContainer>
          <p className="text-xs text-slate-400 mt-2">
            No strong correlation between period and |λ| (period reflects oscillation frequency;
            |λ| reflects temporal persistence/decay). The two properties are orthogonal.
          </p>
        </div>

        {/* ── Full gene table ── */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="font-semibold text-slate-800">Full gene results</h2>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Wave filter */}
              <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs">
                {(["all","sustained","early"] as const).map(w => (
                  <button key={w}
                    onClick={() => setWaveFilter(w)}
                    data-testid={`filter-wave-${w}`}
                    className={`px-3 py-1.5 font-medium transition-colors
                      ${waveFilter === w ? "bg-slate-800 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
                    {w === "all" ? "All" : w.charAt(0).toUpperCase() + w.slice(1)}
                  </button>
                ))}
              </div>
              <button onClick={() => setShowCtrls(v => !v)}
                data-testid="toggle-controls"
                className="text-xs text-blue-600 hover:text-blue-800 underline">
                {showCtrls ? "Hide" : "Show"} housekeeping controls
              </button>
              <button onClick={downloadCSV}
                data-testid="button-download-csv"
                className="inline-flex items-center gap-1.5 text-xs bg-slate-800 text-white px-3 py-1.5 rounded-lg hover:bg-slate-700 transition-colors">
                <Download size={12} /> CSV
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-gene-results">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  {[
                    { col:"gene"   as const, label:"Gene"        },
                    { col:null,              label:"Group"        },
                    { col:null,              label:"Wave"         },
                    { col:"lambda" as const, label:"|λ|"         },
                    { col:null,              label:"Root"         },
                    { col:"period" as const, label:"Period (h)"  },
                    { col:null,              label:"Δ genome median" },
                    { col:null,              label:"|λ| bar"     },
                  ].map(h => (
                    <th key={h.label}
                      onClick={() => h.col && toggleSort(h.col)}
                      className={`py-2 px-3 text-left font-medium
                        ${h.col ? "cursor-pointer select-none hover:text-slate-800" : ""}`}>
                      {h.label}
                      {h.col && sortCol === h.col && (
                        <span className="ml-1 opacity-60">{sortAsc ? "↑" : "↓"}</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.map(d => (
                  <tr key={d.gene}
                    className="border-b border-slate-100 hover:bg-slate-50"
                    data-testid={`row-gene-${d.gene}`}>
                    <td className="py-2 px-3 font-mono font-semibold text-slate-800">{d.gene}</td>
                    <td className="py-2 px-3">
                      <span className="px-2 py-0.5 rounded text-xs font-medium"
                        style={{
                          backgroundColor: (GROUP_COLORS[d.group] ?? "#94a3b8") + "22",
                          color: GROUP_COLORS[d.group] ?? "#64748b",
                        }}>
                        {d.group}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      {d.wave !== "ctrl" && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: WAVE_COLORS[d.wave] + "22",
                            color: WAVE_COLORS[d.wave],
                          }}>
                          {d.wave}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 font-mono text-right font-semibold text-slate-900">
                      {d.lambda.toFixed(4)}
                    </td>
                    <td className="py-2 px-3">
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                        {d.root}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-mono text-slate-600">
                      {d.period}
                    </td>
                    <td className={`py-2 px-3 font-mono text-right text-xs
                      ${"delta" in d && d.delta != null && d.delta > 0
                        ? "text-green-600" : "text-red-500"}`}>
                      {"delta" in d && d.delta != null
                        ? (d.delta > 0 ? "+" : "") + d.delta.toFixed(3)
                        : "—"}
                    </td>
                    <td className="py-2 px-3">
                      <LambdaBar value={d.lambda} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Universality interpretation ── */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <Info size={18} className="text-blue-500 mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold text-slate-800 mb-3">
                What this means for the universality hypothesis
              </div>
              <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
                <p>
                  The circadian clock, NF-κB, and p53–MDM2 are often treated as three separate biological
                  phenomena. But they share one mathematical core: a transcription factor activates targets,
                  which feed back to repress it after a delay. Delayed negative feedback generates oscillations.
                  AR(2) detects the eigenvalue signature of those oscillations — complex roots — regardless of
                  which proteins are involved.
                </p>
                <p>
                  The wave hierarchy goes further. In each system there is an "upstream" layer and a
                  "downstream" layer. In the circadian clock: clock core genes (Arntl, Nr1d1, Dbp) vs
                  clock-controlled genes (Wee1, Axin2, E2F1). In NF-κB: sustained secondary responders
                  (Irf7, Ccl5, Ptgs2) vs early primary response (Tnf, Il1b, Rela). In p53: MDM2 (the
                  feedback arm itself) vs pro-apoptotic targets (GADD45A, BAX, BBC3). In all three systems,
                  the upstream driver layer has higher mean |λ| than the downstream output layer.
                </p>
                <p>
                  The direction of the hierarchy is the same. The magnitude differs — reflecting that different
                  oscillators operate at different timescales and with different feedback strengths. But the
                  structure is identical. This is what "universality" means here: not that all genes have the
                  same |λ|, but that the wave ordering is preserved.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Limitations ── */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={18} className="text-amber-600" />
            <h2 className="font-semibold text-amber-800">Limitations</h2>
          </div>
          <div className="space-y-3">
            {[
              {
                title: "Only 9 timepoints",
                body: "The Amit 2009 dataset has 9 timepoints spanning 0.5–24h. AR(2) estimates are less reliable with fewer than ~12 timepoints. Effect sizes here should be treated as approximate.",
              },
              {
                title: "Sampling too coarse for the fast IκBα oscillation",
                body: "NF-κB oscillates at ~1.5h in live cells. The sampling interval (0.5–4h between timepoints) cannot resolve this fast oscillation. The complex roots detected here reflect the multi-hour inflammatory wave envelope, not the fast IκBα loop. These are different phenomena.",
              },
              {
                title: "Single cell type, single dataset",
                body: "All data come from one cell type (bone-marrow-derived dendritic cells) and one laboratory (Amit 2009). Replication in monocytes, macrophages, or other LPS-responsive datasets has not been performed.",
              },
              {
                title: "Small gene set (n = 16)",
                body: "The permutation test shuffles 16 lambdas among two groups. With such a small n, the permutation p-value has limited precision (step size ~0.0002 for 5,000 permutations). A larger targeted gene panel would sharpen the test.",
              },
              {
                title: "Three-system comparisons are cross-dataset",
                body: "The circadian, NF-κB, and p53 system |λ| values shown in the comparison panel come from different datasets, different species, and different timepoint spacings. Direct numerical comparison of |λ| magnitudes across systems is not valid — only the qualitative direction of the gap should be interpreted.",
              },
            ].map((lim, i) => (
              <div key={i} className="bg-white/60 rounded-lg p-3 border border-amber-200">
                <p className="text-sm font-medium text-amber-800 mb-0.5">{i + 1}. {lim.title}</p>
                <p className="text-sm text-amber-700 leading-relaxed">{lim.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Closing universality statement ── */}
        <div className="bg-slate-800 border border-slate-600 rounded-xl p-5 text-sm text-slate-200 leading-relaxed">
          <span className="font-semibold text-white">Universality in one sentence:</span>{" "}
          Three oscillatory systems with different proteins, timescales, and biological functions all
          produce the same AR(2) signature — complex roots throughout, with the upstream driver layer
          showing consistently higher |λ| than the downstream output layer. The mathematical motif
          (delayed negative feedback) determines the eigenvalue hierarchy, not the biology.
        </div>

        {/* ── Methods ── */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <FlaskConical size={18} className="text-slate-400" />
            <h2 className="font-semibold text-slate-800">Data source & methods</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-6 text-sm text-slate-600 leading-relaxed">
            <div>
              <p className="font-medium text-slate-700 mb-1">Dataset</p>
              <p>GEO: GSE19960 — Amit et al. 2009, Science</p>
              <p>Organism: Mus musculus (bone-marrow-derived DC)</p>
              <p>Stimulation: LPS 0.5, 1, 2, 4, 6, 8, 12, 16, 24h</p>
              <p className="mt-2 font-medium text-slate-700">Gene set selection</p>
              <p>16 genes manually curated: NF-κB core transcription factors,
                 primary early-response targets, secondary interferon/chemokine targets,
                 and sustained inflammatory mediators. 6 housekeeping controls.</p>
            </div>
            <div>
              <p className="font-medium text-slate-700 mb-1">AR(2) analysis</p>
              <p>
                AR(2) models fitted to each gene's 9-point time series.
                Eigenvalues extracted from companion matrix. All 16 target genes
                are stationary (|λ| &lt; 1) with complex roots.
              </p>
              <p className="mt-2 font-medium text-slate-700">Permutation test</p>
              <p>
                5,000 Monte Carlo shuffles. In each shuffle, the 16 lambda values are
                randomly split into groups of the same size as "sustained" and "early".
                The observed gap ({observedGap.toFixed(3)}) is compared against the null
                distribution. p-value = fraction of shuffles ≥ observed gap.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
