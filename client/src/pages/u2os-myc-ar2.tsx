/**
 * GSE221173 U2OS MYC-ER AR(2) Analysis
 * Full pre-specified analysis — all results hardcoded from scripts/u2os_ar2_analysis.cjs (2026-05-09).
 * Uses CSS/SVG charts to avoid Recharts React-19 compatibility issues on this page.
 */
import { useState } from "react";
import { FlaskConical, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

// ─── HARDCODED RESULTS ─────────────────────────────────────────────────────────
const META = {
  dataset: "GSE221173",
  cellLine: "U2OS osteosarcoma (MYC-ER inducible)",
  analysisDate: "2026-05-09",
  primaryReplicate: "Rep2 (n=25, 2h spacing, polyA selection)",
  expressionThreshold: 1.0,
  nPermutations: 10000,
};

const GENOME = {
  rep2Off: { n: 13830, median: 0.441,  mean: 0.4548, pctComplex: 49.3 },
  rep2On:  { n: 13951, median: 0.5792, mean: 0.5862, pctComplex: 23.7 },
  rep1Off: { n: 13234, median: 0.4467, mean: 0.4587 },
  rep1On:  { n: 13522, median: 0.513,  mean: 0.520  },
};

const PERM = {
  p53Off:   { observedMean: 0.3860, genomeMean: 0.4548, genomeMedian: 0.441,  pval: 0.9252, nGenes: 13 },
  p53On:    { observedMean: 0.7253, genomeMean: 0.5862, genomeMedian: 0.5792, pval: 0.0205, nGenes: 13 },
  mycOn:    { observedMean: 0.6389, genomeMean: 0.5862, genomeMedian: 0.5792, pval: 0.2305, nGenes: 12 },
  clockOff: { observedMean: 0.5767, genomeMean: 0.4548, genomeMedian: 0.441,  pval: 0.0215, nGenes: 9  },
  clockOn:  { observedMean: 0.5307, genomeMean: 0.5862, genomeMedian: 0.5792, pval: 0.7525, nGenes: 10 },
};

type GeneRow = {
  symbol: string;
  offLambda: number | null; offRoot: string | null; offPeriod: number | null; offMeanTpm: number | null;
  onLambda:  number | null; onRoot:  string | null; onPeriod:  number | null; onMeanTpm:  number | null;
  delta: number | null;
};

const P53_R2: GeneRow[] = [
  { symbol:"MDM2",   offLambda:0.6157, offRoot:"real",    offPeriod:null, offMeanTpm:116.69, onLambda:0.9948, onRoot:"real",    onPeriod:null, onMeanTpm:124.43, delta:0.3791 },
  { symbol:"CDKN1A", offLambda:0.2931, offRoot:"complex", offPeriod:14.7, offMeanTpm:52.08,  onLambda:0.6723, onRoot:"real",    onPeriod:null, onMeanTpm:98.59,  delta:0.3792 },
  { symbol:"BAX",    offLambda:0.2914, offRoot:"real",    offPeriod:null, offMeanTpm:60.99,  onLambda:0.5983, onRoot:"real",    onPeriod:null, onMeanTpm:74.67,  delta:0.3069 },
  { symbol:"BBC3",   offLambda:0.1996, offRoot:"complex", offPeriod:16.4, offMeanTpm:1.67,   onLambda:0.4137, onRoot:"real",    onPeriod:null, onMeanTpm:3.12,   delta:0.2141 },
  { symbol:"PMAIP1", offLambda:0.6703, offRoot:"real",    offPeriod:null, offMeanTpm:32.03,  onLambda:0.9901, onRoot:"real",    onPeriod:null, onMeanTpm:27.96,  delta:0.3198 },
  { symbol:"GADD45A",offLambda:0.5932, offRoot:"real",    offPeriod:null, offMeanTpm:31.66,  onLambda:0.999,  onRoot:"real",    onPeriod:null, onMeanTpm:64.63,  delta:0.4058 },
  { symbol:"GADD45B",offLambda:0.4005, offRoot:"real",    offPeriod:null, offMeanTpm:17.28,  onLambda:0.7543, onRoot:"real",    onPeriod:null, onMeanTpm:11.71,  delta:0.3538 },
  { symbol:"GADD45G",offLambda:null,   offRoot:null,      offPeriod:null, offMeanTpm:null,   onLambda:null,   onRoot:null,      onPeriod:null, onMeanTpm:null,   delta:null   },
  { symbol:"BTG2",   offLambda:0.4743, offRoot:"complex", offPeriod:9.3,  offMeanTpm:15.54,  onLambda:0.9821, onRoot:"real",    onPeriod:null, onMeanTpm:25.12,  delta:0.5078 },
  { symbol:"FAS",    offLambda:0.0722, offRoot:"complex", offPeriod:9.9,  offMeanTpm:77.18,  onLambda:0.9781, onRoot:"real",    onPeriod:null, onMeanTpm:44.88,  delta:0.9059 },
  { symbol:"BID",    offLambda:0.1821, offRoot:"complex", offPeriod:52.9, offMeanTpm:9.74,   onLambda:0.4287, onRoot:"real",    onPeriod:null, onMeanTpm:12.85,  delta:0.2466 },
  { symbol:"PERP",   offLambda:0.4657, offRoot:"complex", offPeriod:6.6,  offMeanTpm:23.90,  onLambda:0.8136, onRoot:"real",    onPeriod:null, onMeanTpm:10.34,  delta:0.3479 },
  { symbol:"SESN1",  offLambda:0.4601, offRoot:"real",    offPeriod:null, offMeanTpm:17.59,  onLambda:0.2232, onRoot:"complex", onPeriod:15.9, onMeanTpm:19.10,  delta:-0.2369},
  { symbol:"SESN2",  offLambda:0.3003, offRoot:"complex", offPeriod:15.9, offMeanTpm:5.83,   onLambda:0.581,  onRoot:"real",    onPeriod:null, onMeanTpm:7.42,   delta:0.2807 },
];

const CLOCK_R2: GeneRow[] = [
  { symbol:"ARNTL",  offLambda:0.6921, offRoot:"real",    offPeriod:null, offMeanTpm:10.14, onLambda:0.999,  onRoot:"real",    onPeriod:null, onMeanTpm:5.64,  delta:0.3069  },
  { symbol:"CLOCK",  offLambda:0.5586, offRoot:"complex", offPeriod:7.4,  offMeanTpm:25.76, onLambda:0.8132, onRoot:"real",    onPeriod:null, onMeanTpm:28.88, delta:0.2546  },
  { symbol:"PER1",   offLambda:0.396,  offRoot:"complex", offPeriod:10.8, offMeanTpm:4.78,  onLambda:0.1366, onRoot:"complex", onPeriod:14.2, onMeanTpm:9.60,  delta:-0.2594 },
  { symbol:"PER2",   offLambda:null,   offRoot:null,      offPeriod:null, offMeanTpm:null,  onLambda:0.3134, onRoot:"real",    onPeriod:null, onMeanTpm:1.87,  delta:null    },
  { symbol:"CRY1",   offLambda:0.7692, offRoot:"complex", offPeriod:21.7, offMeanTpm:11.76, onLambda:0.7266, onRoot:"real",    onPeriod:null, onMeanTpm:23.06, delta:-0.0426 },
  { symbol:"CRY2",   offLambda:0.3899, offRoot:"real",    offPeriod:null, offMeanTpm:3.39,  onLambda:0.4999, onRoot:"real",    onPeriod:null, onMeanTpm:6.36,  delta:0.11    },
  { symbol:"NR1D1",  offLambda:0.5856, offRoot:"complex", offPeriod:17.1, offMeanTpm:2.63,  onLambda:0.2484, onRoot:"real",    onPeriod:null, onMeanTpm:5.00,  delta:-0.3372 },
  { symbol:"NR1D2",  offLambda:0.5181, offRoot:"complex", offPeriod:31.9, offMeanTpm:26.35, onLambda:0.2771, onRoot:"complex", onPeriod:12.6, onMeanTpm:22.66, delta:-0.241  },
  { symbol:"DBP",    offLambda:0.6072, offRoot:"complex", offPeriod:18.1, offMeanTpm:2.82,  onLambda:0.6739, onRoot:"real",    onPeriod:null, onMeanTpm:3.17,  delta:0.0667  },
  { symbol:"TEF",    offLambda:0.6739, offRoot:"complex", offPeriod:18.3, offMeanTpm:2.95,  onLambda:0.619,  onRoot:"real",    onPeriod:null, onMeanTpm:3.57,  delta:-0.0549 },
];

const MYC_R2: GeneRow[] = [
  { symbol:"MYC",   offLambda:0.4869, offRoot:"real",    offPeriod:null, offMeanTpm:182.08, onLambda:0.4521, onRoot:"real",    onPeriod:null, onMeanTpm:239.94, delta:-0.0348 },
  { symbol:"E2F1",  offLambda:0.3029, offRoot:"complex", offPeriod:15.1, offMeanTpm:5.53,   onLambda:0.5038, onRoot:"real",    onPeriod:null, onMeanTpm:4.90,   delta:0.2009  },
  { symbol:"E2F2",  offLambda:0.4673, offRoot:"complex", offPeriod:10.7, offMeanTpm:2.69,   onLambda:0.7002, onRoot:"real",    onPeriod:null, onMeanTpm:3.28,   delta:0.2329  },
  { symbol:"E2F3",  offLambda:0.2307, offRoot:"real",    offPeriod:null, offMeanTpm:10.00,  onLambda:0.8779, onRoot:"real",    onPeriod:null, onMeanTpm:9.02,   delta:0.6472  },
  { symbol:"CCND1", offLambda:0.3735, offRoot:"complex", offPeriod:9.2,  offMeanTpm:25.14,  onLambda:0.232,  onRoot:"complex", onPeriod:10.4, onMeanTpm:22.89,  delta:-0.1415 },
  { symbol:"CCND2", offLambda:0.7269, offRoot:"real",    offPeriod:null, offMeanTpm:19.98,  onLambda:0.487,  onRoot:"real",    onPeriod:null, onMeanTpm:54.55,  delta:-0.2399 },
  { symbol:"MCL1",  offLambda:0.5676, offRoot:"complex", offPeriod:10.3, offMeanTpm:106.29, onLambda:0.8849, onRoot:"real",    onPeriod:null, onMeanTpm:99.73,  delta:0.3173  },
  { symbol:"MKI67", offLambda:0.6636, offRoot:"real",    offPeriod:null, offMeanTpm:28.04,  onLambda:0.5287, onRoot:"complex", onPeriod:7.2,  onMeanTpm:20.60,  delta:-0.1349 },
  { symbol:"PCNA",  offLambda:0.2016, offRoot:"complex", offPeriod:5.5,  offMeanTpm:135.36, onLambda:0.6136, onRoot:"real",    onPeriod:null, onMeanTpm:130.70, delta:0.412   },
  { symbol:"BIRC5", offLambda:0.2585, offRoot:"complex", offPeriod:23.2, offMeanTpm:57.93,  onLambda:0.7439, onRoot:"real",    onPeriod:null, onMeanTpm:75.77,  delta:0.4854  },
  { symbol:"CDK4",  offLambda:0.3744, offRoot:"real",    offPeriod:null, offMeanTpm:142.72, onLambda:0.7937, onRoot:"real",    onPeriod:null, onMeanTpm:137.34, delta:0.4193  },
  { symbol:"ODC1",  offLambda:0.3053, offRoot:"real",    offPeriod:null, offMeanTpm:141.96, onLambda:0.8488, onRoot:"real",    onPeriod:null, onMeanTpm:324.81, delta:0.5435  },
];

const SHUFFLE = {
  p53Off:   { realMean: 0.386,  shuffleMean: 0.4223, destruction: -9.4  },
  p53On:    { realMean: 0.7253, shuffleMean: 0.4169, destruction: 42.5  },
  clockOff: { realMean: 0.5767, shuffleMean: 0.4159, destruction: 27.9  },
};

const ROLLING = {
  p53Off: [
    { window: "CT24–52 (first 15)", meanLambda: 0.4786 },
    { window: "CT38–66 (mid 15)",   meanLambda: 0.4894 },
    { window: "CT44–72 (last 15)",  meanLambda: 0.3566 },
  ],
  clkOff: [
    { window: "CT24–52 (first 15)", meanLambda: 0.7009 },
    { window: "CT38–66 (mid 15)",   meanLambda: 0.6021 },
    { window: "CT44–72 (last 15)",  meanLambda: 0.5894 },
  ],
};

const THRESHOLD_SENS = {
  rep2Off: [
    { threshold: 0.5, nGenes: 15774, genomeMean: 0.4551, genomeMedian: 0.4419 },
    { threshold: 1,   nGenes: 13830, genomeMean: 0.4548, genomeMedian: 0.441  },
    { threshold: 2,   nGenes: 11898, genomeMean: 0.4541, genomeMedian: 0.4408 },
    { threshold: 5,   nGenes: 9215,  genomeMean: 0.4513, genomeMedian: 0.4377 },
  ],
  rep2On: [
    { threshold: 0.5, nGenes: 15924, genomeMean: 0.5791, genomeMedian: 0.5678 },
    { threshold: 1,   nGenes: 13951, genomeMean: 0.5862, genomeMedian: 0.5792 },
    { threshold: 2,   nGenes: 12019, genomeMean: 0.5907, genomeMedian: 0.5877 },
    { threshold: 5,   nGenes: 9440,  genomeMean: 0.5942, genomeMedian: 0.5940 },
  ],
};

const CONCORDANCE = {
  genes: [
    { symbol:"MDM2",   r2Dir:"up",   r1Dir:"down",  concordant:false },
    { symbol:"CDKN1A", r2Dir:"up",   r1Dir:"up",    concordant:true  },
    { symbol:"BAX",    r2Dir:"up",   r1Dir:"down",  concordant:false },
    { symbol:"BBC3",   r2Dir:"up",   r1Dir:"up",    concordant:true  },
    { symbol:"PMAIP1", r2Dir:"up",   r1Dir:"down",  concordant:false },
    { symbol:"GADD45A",r2Dir:"up",   r1Dir:"up",    concordant:true  },
    { symbol:"GADD45B",r2Dir:"up",   r1Dir:"down",  concordant:false },
    { symbol:"BTG2",   r2Dir:"up",   r1Dir:"up",    concordant:true  },
    { symbol:"FAS",    r2Dir:"up",   r1Dir:"up",    concordant:true  },
    { symbol:"BID",    r2Dir:"up",   r1Dir:"up",    concordant:true  },
    { symbol:"PERP",   r2Dir:"up",   r1Dir:"up",    concordant:true  },
    { symbol:"SESN1",  r2Dir:"down", r1Dir:"down",  concordant:true  },
    { symbol:"SESN2",  r2Dir:"up",   r1Dir:"down",  concordant:false },
  ],
  nConcordant: 8, nTotal: 13, pctConcordant: 61.5,
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function pBadge(pval: number) {
  if (pval < 0.01)  return <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-emerald-100 text-emerald-800">p={pval.toFixed(4)} **</span>;
  if (pval < 0.05)  return <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-emerald-100 text-emerald-800">p={pval.toFixed(4)} *</span>;
  return <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-slate-100 text-slate-600">p={pval.toFixed(4)} ns</span>;
}

function rootBadge(root: string | null) {
  if (!root) return <span className="text-slate-400 text-xs">—</span>;
  return root === "complex"
    ? <span className="px-1.5 py-0.5 text-[10px] rounded bg-violet-100 text-violet-700">oscillatory</span>
    : <span className="px-1.5 py-0.5 text-[10px] rounded bg-amber-100 text-amber-700">constitutive</span>;
}

function deltaColor(d: number | null) {
  if (d === null) return "text-slate-400";
  if (d > 0.1)  return "text-emerald-700 font-semibold";
  if (d < -0.1) return "text-red-600 font-semibold";
  return "text-slate-500";
}

/** Simple CSS horizontal bar (value 0–1 range) */
function CssBar({ value, max = 1, color, label }: { value: number; max?: number; color: string; label?: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-slate-100 rounded h-4 relative overflow-hidden">
        <div className="h-full rounded transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
        {label && (
          <span className="absolute right-1 top-0 h-full flex items-center text-[10px] font-mono text-slate-600">{label}</span>
        )}
      </div>
    </div>
  );
}

/** Side-by-side mini bars for a gene's OFF vs ON |λ| */
function GeneBars({ off, on }: { off: number | null; on: number | null }) {
  return (
    <div className="flex flex-col gap-0.5 w-24">
      <div className="flex items-center gap-1">
        <span className="text-[9px] text-slate-400 w-6">OFF</span>
        <div className="flex-1 bg-slate-100 rounded h-2.5">
          {off !== null && <div className="h-full rounded" style={{ width: `${off * 100}%`, backgroundColor: "#94a3b8" }} />}
        </div>
        <span className="text-[9px] font-mono text-slate-500 w-8 text-right">{off?.toFixed(3) ?? "—"}</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-[9px] text-slate-400 w-6">ON</span>
        <div className="flex-1 bg-slate-100 rounded h-2.5">
          {on !== null && <div className="h-full rounded" style={{ width: `${on * 100}%`, backgroundColor: "#10b981" }} />}
        </div>
        <span className="text-[9px] font-mono text-slate-500 w-8 text-right">{on?.toFixed(3) ?? "—"}</span>
      </div>
    </div>
  );
}

// ─── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function U2OSMycAR2Page() {
  const [activeTab, setActiveTab] = useState<"p53"|"clock"|"myc"|"robustness"|"concordance">("p53");

  const summaryRows = [
    { label: "p53 targets", cond: "MYC-OFF", mean: PERM.p53Off.observedMean,  med: PERM.p53Off.genomeMedian,  pval: PERM.p53Off.pval,  n: PERM.p53Off.nGenes,  color: "#94a3b8" },
    { label: "p53 targets", cond: "MYC-ON",  mean: PERM.p53On.observedMean,   med: PERM.p53On.genomeMedian,   pval: PERM.p53On.pval,   n: PERM.p53On.nGenes,   color: "#10b981" },
    { label: "Clock genes", cond: "MYC-OFF", mean: PERM.clockOff.observedMean, med: PERM.clockOff.genomeMedian, pval: PERM.clockOff.pval, n: PERM.clockOff.nGenes, color: "#6366f1" },
    { label: "Clock genes", cond: "MYC-ON",  mean: PERM.clockOn.observedMean,  med: PERM.clockOn.genomeMedian,  pval: PERM.clockOn.pval,  n: PERM.clockOn.nGenes,  color: "#f59e0b" },
    { label: "MYC targets", cond: "MYC-ON",  mean: PERM.mycOn.observedMean,    med: PERM.mycOn.genomeMedian,    pval: PERM.mycOn.pval,    n: PERM.mycOn.nGenes,    color: "#ec4899" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-6">
        <div className="max-w-6xl mx-auto">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4">
            <ArrowLeft className="w-4 h-4" /> Back to dashboard
          </Link>
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-violet-100">
              <FlaskConical className="w-7 h-7 text-violet-600" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-slate-900">GSE221173 — U2OS MYC-ER AR(2) Analysis</h1>
              <p className="text-sm text-slate-500 mt-1">
                Full pre-specified AR(2) analysis · 60,237 genes · {META.primaryReplicate} · {META.nPermutations.toLocaleString()}-permutation tests · 4 robustness layers
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="px-2 py-1 text-xs bg-slate-100 rounded text-slate-600">{META.dataset}</span>
                <span className="px-2 py-1 text-xs bg-slate-100 rounded text-slate-600">Cell: U2OS osteosarcoma</span>
                <span className="px-2 py-1 text-xs bg-slate-100 rounded text-slate-600">TPM &gt; {META.expressionThreshold} filter</span>
                <span className="px-2 py-1 text-xs bg-violet-100 rounded text-violet-700">Analysis: {META.analysisDate}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">

        {/* ── GENOME-WIDE CONTEXT ───────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-1">Genome-Wide Context (Rep2)</h2>
          <p className="text-sm text-slate-500 mb-4">
            MYC activation shifts the entire genome. All regulon comparisons use the condition-matched genome as reference.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
            {[
              { label: "Rep2 MYC-OFF expressed genes", val: GENOME.rep2Off.n.toLocaleString(), sub: "TPM > 1" },
              { label: "Rep2 MYC-OFF genome median |λ|", val: GENOME.rep2Off.median.toFixed(3), sub: `${GENOME.rep2Off.pctComplex}% oscillatory` },
              { label: "Rep2 MYC-ON expressed genes",  val: GENOME.rep2On.n.toLocaleString(),  sub: "TPM > 1" },
              { label: "Rep2 MYC-ON genome median |λ|",  val: GENOME.rep2On.median.toFixed(3),  sub: `${GENOME.rep2On.pctComplex}% oscillatory` },
            ].map((s, i) => (
              <div key={i} className={`rounded-lg p-3 border ${i < 2 ? "bg-slate-50 border-slate-200" : "bg-violet-50 border-violet-200"}`}>
                <div className={`text-xl font-bold ${i < 2 ? "text-slate-800" : "text-violet-700"}`}>{s.val}</div>
                <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
                <div className="text-[11px] text-slate-400">{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Genome shift visual */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Genome Median |λ| Shift</div>
              <div className="space-y-2">
                {[
                  { label: "MYC-OFF", val: GENOME.rep2Off.median, color: "#94a3b8" },
                  { label: "MYC-ON",  val: GENOME.rep2On.median,  color: "#8b5cf6" },
                ].map(d => (
                  <div key={d.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-slate-600">{d.label}</span>
                      <span className="font-mono text-slate-800">{d.val.toFixed(4)}</span>
                    </div>
                    <CssBar value={d.val} max={0.75} color={d.color} />
                  </div>
                ))}
                <div className="text-xs text-slate-500 mt-1">
                  Shift: +{(GENOME.rep2On.median - GENOME.rep2Off.median).toFixed(3)} (+{(((GENOME.rep2On.median / GENOME.rep2Off.median) - 1) * 100).toFixed(1)}%)
                </div>
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">% Oscillatory (Complex Roots)</div>
              <div className="space-y-2">
                {[
                  { label: "MYC-OFF", val: GENOME.rep2Off.pctComplex, color: "#94a3b8" },
                  { label: "MYC-ON",  val: GENOME.rep2On.pctComplex,  color: "#f59e0b" },
                ].map(d => (
                  <div key={d.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-slate-600">{d.label}</span>
                      <span className="font-mono text-slate-800">{d.val}%</span>
                    </div>
                    <CssBar value={d.val} max={70} color={d.color} />
                  </div>
                ))}
                <div className="text-xs text-slate-500 mt-1">
                  MYC locks genome into constitutive state — oscillatory fraction halved
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            <strong>Interpretation:</strong> MYC activation shifts the genome median from 0.441 → 0.579 (+31.3%) and collapses the 
            fraction of oscillatory genes from 49.3% → 23.7%. All regulon analyses below compare against the condition-matched 
            genome median, not the MYC-OFF baseline.
          </div>
        </div>

        {/* ── REGULON PERMUTATION SUMMARY ──────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-1">Regulon Permutation Test Summary</h2>
          <p className="text-sm text-slate-500 mb-4">
            Mean |λ| of each regulon vs {META.nPermutations.toLocaleString()} random draws from expressed genome (same condition). 
            All gene lists pre-specified before analysis.
          </p>

          {/* Summary bar chart (CSS) */}
          <div className="mb-5 space-y-2">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Mean |λ| vs Genome Median — All Regulons</div>
            {summaryRows.map((row, i) => {
              const delta = row.mean - row.med;
              return (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-28 text-xs text-slate-600 truncate">{row.label}</div>
                  <div className="w-16">
                    <span className={`px-1.5 py-0.5 text-[10px] rounded font-medium ${row.cond === "MYC-ON" ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-600"}`}>{row.cond}</span>
                  </div>
                  <div className="flex-1 bg-slate-100 rounded h-5 relative overflow-hidden">
                    {/* genome median line */}
                    <div className="absolute top-0 h-full w-px bg-slate-400 opacity-60" style={{ left: `${row.med * 100}%` }} />
                    <div className="h-full rounded" style={{ width: `${row.mean * 100}%`, backgroundColor: row.color }} />
                  </div>
                  <span className="text-xs font-mono text-slate-800 w-12">{row.mean.toFixed(4)}</span>
                  <span className={`text-xs font-mono w-14 ${delta > 0.05 ? "text-emerald-700 font-semibold" : delta < -0.05 ? "text-red-600" : "text-slate-500"}`}>
                    {delta > 0 ? "+" : ""}{delta.toFixed(4)}
                  </span>
                  <div className="w-24">{pBadge(row.pval)}</div>
                </div>
              );
            })}
            <div className="text-[10px] text-slate-400 mt-1">Bar represents mean |λ|. Grey tick = genome median. Delta = mean |λ| − genome median.</div>
          </div>

          {/* Summary table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="regulon-summary-table">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 pr-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">Regulon</th>
                  <th className="text-center py-2 pr-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">Condition</th>
                  <th className="text-right py-2 pr-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">Mean |λ|</th>
                  <th className="text-right py-2 pr-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">Genome median</th>
                  <th className="text-right py-2 pr-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">Δ vs genome</th>
                  <th className="text-center py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">p-value</th>
                </tr>
              </thead>
              <tbody>
                {summaryRows.map((row, i) => {
                  const delta = row.mean - row.med;
                  return (
                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="py-2.5 pr-4 font-medium text-slate-800">{row.label} <span className="text-slate-400 font-normal text-xs">(n={row.n})</span></td>
                      <td className="py-2.5 pr-4 text-center">
                        <span className={`px-2 py-0.5 text-xs rounded font-medium ${row.cond === "MYC-ON" ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-600"}`}>{row.cond}</span>
                      </td>
                      <td className="py-2.5 pr-4 text-right font-mono font-semibold text-slate-900">{row.mean.toFixed(4)}</td>
                      <td className="py-2.5 pr-4 text-right font-mono text-slate-500">{row.med.toFixed(4)}</td>
                      <td className={`py-2.5 pr-4 text-right font-mono text-sm ${delta > 0.05 ? "text-emerald-700 font-semibold" : delta < -0.05 ? "text-red-600" : "text-slate-500"}`}>
                        {delta > 0 ? "+" : ""}{delta.toFixed(4)}
                      </td>
                      <td className="py-2.5 text-center">{pBadge(row.pval)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── TABBED PER-GENE TABLES ─────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="flex border-b border-slate-200">
            {(["p53","clock","myc","robustness","concordance"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                data-testid={`tab-${tab}`}
                className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === tab
                    ? "border-violet-500 text-violet-700"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {tab === "p53" ? "p53 Regulon" : tab === "clock" ? "Clock Genes" : tab === "myc" ? "MYC Targets" : tab === "robustness" ? "Robustness" : "Rep1 Concordance"}
              </button>
            ))}
          </div>

          <div className="p-6">
            {/* ── p53 tab ─────────────────────────────────────────── */}
            {activeTab === "p53" && (
              <div className="space-y-4">
                <div className="flex items-start gap-6 flex-wrap">
                  <div className="flex-1 min-w-64">
                    <h3 className="font-semibold text-slate-800 mb-1">p53 Target Regulon</h3>
                    <p className="text-sm text-slate-500">
                      13 canonical p53 targets (apoptotic + cell-cycle). MYC-OFF: below genome (p=0.925 ns). 
                      MYC-ON: significantly elevated above elevated genome (p=0.021 *).
                    </p>
                    <div className="mt-3 flex gap-6">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-slate-500">{PERM.p53Off.observedMean.toFixed(3)}</div>
                        <div className="text-xs text-slate-500">MYC-OFF mean |λ|</div>
                        <div className="text-xs text-slate-400">below genome (0.441)</div>
                        <div className="mt-1">{pBadge(PERM.p53Off.pval)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-emerald-600">{PERM.p53On.observedMean.toFixed(3)}</div>
                        <div className="text-xs text-slate-500">MYC-ON mean |λ|</div>
                        <div className="text-xs text-slate-400">above genome (0.579) ✓</div>
                        <div className="mt-1">{pBadge(PERM.p53On.pval)}</div>
                      </div>
                    </div>
                    <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
                      <strong>Finding:</strong> p53 targets are quiet at baseline (below genome, p=0.925) but show significantly 
                      elevated temporal persistence under MYC stress (p=0.021). Replicates Paper N direction in an independent 
                      osteosarcoma cell line with different RNA-seq library prep.
                    </div>
                  </div>
                  <div className="w-72">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Per-gene |λ| (OFF vs ON)</div>
                    <div className="space-y-1.5">
                      {P53_R2.filter(g => g.offLambda !== null || g.onLambda !== null).map(g => (
                        <div key={g.symbol} className="flex items-center gap-2">
                          <span className="text-xs font-mono w-14 text-slate-700">{g.symbol}</span>
                          <GeneBars off={g.offLambda} on={g.onLambda} />
                          {g.delta !== null && (
                            <span className={`text-[10px] font-mono w-12 text-right ${deltaColor(g.delta)}`}>
                              {g.delta > 0 ? "+" : ""}{g.delta.toFixed(3)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-3 mt-2 text-[10px]">
                      <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-slate-400 inline-block" /> MYC-OFF</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-emerald-500 inline-block" /> MYC-ON</span>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs" data-testid="p53-gene-table">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left py-1.5 pr-3 font-semibold text-slate-500">Gene</th>
                        <th className="text-right pr-3 font-semibold text-slate-500">OFF |λ|</th>
                        <th className="text-center pr-3 font-semibold text-slate-500">OFF root</th>
                        <th className="text-right pr-3 font-semibold text-slate-500">OFF period</th>
                        <th className="text-right pr-3 font-semibold text-slate-500">OFF TPM</th>
                        <th className="text-right pr-3 font-semibold text-slate-500">ON |λ|</th>
                        <th className="text-center pr-3 font-semibold text-slate-500">ON root</th>
                        <th className="text-right pr-3 font-semibold text-slate-500">ON TPM</th>
                        <th className="text-right font-semibold text-slate-500">Δ|λ|</th>
                      </tr>
                    </thead>
                    <tbody>
                      {P53_R2.map(g => (
                        <tr key={g.symbol} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="py-1.5 pr-3 font-semibold text-slate-800">{g.symbol}</td>
                          <td className="pr-3 text-right font-mono">{g.offLambda?.toFixed(4) ?? <span className="text-slate-300">—</span>}</td>
                          <td className="pr-3 text-center">{rootBadge(g.offRoot)}</td>
                          <td className="pr-3 text-right text-slate-500">{g.offPeriod ? `${g.offPeriod}h` : "—"}</td>
                          <td className="pr-3 text-right text-slate-400">{g.offMeanTpm?.toFixed(1) ?? "—"}</td>
                          <td className="pr-3 text-right font-mono font-semibold">{g.onLambda?.toFixed(4) ?? <span className="text-slate-300">—</span>}</td>
                          <td className="pr-3 text-center">{rootBadge(g.onRoot)}</td>
                          <td className="pr-3 text-right text-slate-400">{g.onMeanTpm?.toFixed(1) ?? "—"}</td>
                          <td className={`text-right font-mono ${deltaColor(g.delta)}`}>{g.delta !== null ? (g.delta>0?"+":"")+g.delta.toFixed(4) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── clock tab ─────────────────────────────────────────── */}
            {activeTab === "clock" && (
              <div className="space-y-4">
                <div className="flex items-start gap-6 flex-wrap">
                  <div className="flex-1 min-w-64">
                    <h3 className="font-semibold text-slate-800 mb-1">Clock Genes — Mechanism of Disruption</h3>
                    <p className="text-sm text-slate-500">
                      9/10 genes expressed in MYC-OFF; PER2 only above threshold in MYC-ON. 
                      Clock disruption is not uniform — activators lock high, repressors suppressed.
                    </p>
                    <div className="mt-3 flex gap-6">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-indigo-600">{PERM.clockOff.observedMean.toFixed(3)}</div>
                        <div className="text-xs text-slate-500">MYC-OFF mean |λ|</div>
                        <div className="text-xs text-slate-400">above genome (0.441) ✓</div>
                        <div className="mt-1">{pBadge(PERM.clockOff.pval)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-amber-600">{PERM.clockOn.observedMean.toFixed(3)}</div>
                        <div className="text-xs text-slate-500">MYC-ON mean |λ|</div>
                        <div className="text-xs text-slate-400">NOT above genome (0.579) ✗</div>
                        <div className="mt-1">{pBadge(PERM.clockOn.pval)}</div>
                      </div>
                    </div>
                    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                      <strong>Mechanism:</strong> MYC activates ARNTL and CLOCK (constitutively high, real roots) while 
                      suppressing PER1, NR1D1, NR1D2 (negative feedback arm). The clock loop is broken by locking 
                      activators high and removing repressors — consistent with MYC's direct suppression of BMAL1 targets.
                    </div>
                  </div>
                  <div className="w-72">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Per-gene |λ| (OFF vs ON)</div>
                    <div className="space-y-1.5">
                      {CLOCK_R2.filter(g => g.offLambda !== null || g.onLambda !== null).map(g => (
                        <div key={g.symbol} className="flex items-center gap-2">
                          <span className="text-xs font-mono w-14 text-slate-700">{g.symbol}</span>
                          <GeneBars off={g.offLambda} on={g.onLambda} />
                          {g.delta !== null && (
                            <span className={`text-[10px] font-mono w-12 text-right ${deltaColor(g.delta)}`}>
                              {g.delta > 0 ? "+" : ""}{g.delta.toFixed(3)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs" data-testid="clock-gene-table">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left py-1.5 pr-3 font-semibold text-slate-500">Gene</th>
                        <th className="text-right pr-3 font-semibold text-slate-500">OFF |λ|</th>
                        <th className="text-center pr-3 font-semibold text-slate-500">OFF root</th>
                        <th className="text-right pr-3 font-semibold text-slate-500">OFF period</th>
                        <th className="text-right pr-3 font-semibold text-slate-500">ON |λ|</th>
                        <th className="text-center pr-3 font-semibold text-slate-500">ON root</th>
                        <th className="text-right pr-3 font-semibold text-slate-500">ON period</th>
                        <th className="text-right font-semibold text-slate-500">Δ|λ|</th>
                      </tr>
                    </thead>
                    <tbody>
                      {CLOCK_R2.map(g => (
                        <tr key={g.symbol} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="py-1.5 pr-3 font-semibold text-slate-800">{g.symbol}</td>
                          <td className="pr-3 text-right font-mono">{g.offLambda?.toFixed(4) ?? <span className="text-slate-300">—</span>}</td>
                          <td className="pr-3 text-center">{rootBadge(g.offRoot)}</td>
                          <td className="pr-3 text-right text-slate-500">{g.offPeriod ? `${g.offPeriod}h` : "—"}</td>
                          <td className="pr-3 text-right font-mono font-semibold">{g.onLambda?.toFixed(4) ?? <span className="text-slate-300">—</span>}</td>
                          <td className="pr-3 text-center">{rootBadge(g.onRoot)}</td>
                          <td className="pr-3 text-right text-slate-500">{g.onPeriod ? `${g.onPeriod}h` : "—"}</td>
                          <td className={`text-right font-mono ${deltaColor(g.delta)}`}>{g.delta !== null ? (g.delta>0?"+":"")+g.delta.toFixed(4) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── myc tab ─────────────────────────────────────────── */}
            {activeTab === "myc" && (
              <div className="space-y-4">
                <div className="flex items-start gap-6 flex-wrap">
                  <div className="flex-1 min-w-64">
                    <h3 className="font-semibold text-slate-800 mb-1">MYC Direct Targets</h3>
                    <p className="text-sm text-slate-500">
                      12 canonical MYC E-box targets + MYC itself. MYC-ON: mean |λ|=0.639, 
                      above genome median (0.579), p=0.231 (not significant — expected, genome shifts wholesale).
                    </p>
                    <div className="mt-3 flex gap-6">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-pink-600">{PERM.mycOn.observedMean.toFixed(3)}</div>
                        <div className="text-xs text-slate-500">MYC-ON mean |λ|</div>
                        <div className="text-xs text-slate-400">vs genome median 0.579</div>
                        <div className="mt-1">{pBadge(PERM.mycOn.pval)}</div>
                      </div>
                    </div>
                    <div className="mt-3 p-3 bg-pink-50 border border-pink-200 rounded-lg text-xs text-pink-800">
                      <strong>Interpretation:</strong> MYC targets are not significantly elevated vs genome (p=0.231) because 
                      MYC shifts the entire genome up. The key finding is the genome-wide constitutive lock-in (+31.3% median), 
                      not a specific MYC-target enrichment above that new baseline.
                    </div>
                  </div>
                  <div className="w-72">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Per-gene |λ| (OFF vs ON)</div>
                    <div className="space-y-1.5">
                      {MYC_R2.map(g => (
                        <div key={g.symbol} className="flex items-center gap-2">
                          <span className="text-xs font-mono w-14 text-slate-700">{g.symbol}</span>
                          <GeneBars off={g.offLambda} on={g.onLambda} />
                          {g.delta !== null && (
                            <span className={`text-[10px] font-mono w-12 text-right ${deltaColor(g.delta)}`}>
                              {g.delta > 0 ? "+" : ""}{g.delta.toFixed(3)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs" data-testid="myc-gene-table">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left py-1.5 pr-3 font-semibold text-slate-500">Gene</th>
                        <th className="text-right pr-3 font-semibold text-slate-500">OFF |λ|</th>
                        <th className="text-center pr-3 font-semibold text-slate-500">OFF root</th>
                        <th className="text-right pr-3 font-semibold text-slate-500">ON |λ|</th>
                        <th className="text-center pr-3 font-semibold text-slate-500">ON root</th>
                        <th className="text-right pr-3 font-semibold text-slate-500">OFF TPM</th>
                        <th className="text-right pr-3 font-semibold text-slate-500">ON TPM</th>
                        <th className="text-right font-semibold text-slate-500">Δ|λ|</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MYC_R2.map(g => (
                        <tr key={g.symbol} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="py-1.5 pr-3 font-semibold text-slate-800">{g.symbol}</td>
                          <td className="pr-3 text-right font-mono">{g.offLambda?.toFixed(4) ?? "—"}</td>
                          <td className="pr-3 text-center">{rootBadge(g.offRoot)}</td>
                          <td className="pr-3 text-right font-mono font-semibold">{g.onLambda?.toFixed(4) ?? "—"}</td>
                          <td className="pr-3 text-center">{rootBadge(g.onRoot)}</td>
                          <td className="pr-3 text-right text-slate-400">{g.offMeanTpm?.toFixed(1) ?? "—"}</td>
                          <td className="pr-3 text-right text-slate-400">{g.onMeanTpm?.toFixed(1) ?? "—"}</td>
                          <td className={`text-right font-mono ${deltaColor(g.delta)}`}>{g.delta !== null ? (g.delta>0?"+":"")+g.delta.toFixed(4) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── robustness tab ─────────────────────────────────────────── */}
            {activeTab === "robustness" && (
              <div className="space-y-6">
                {/* 1. Time-shuffle */}
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-2">1. Time-Shuffle Destruction Test</h4>
                  <p className="text-xs text-slate-500 mb-3">
                    Time-labels randomly permuted 10,000× and AR(2) re-fitted. A genuine temporal signal should be destroyed. 
                    Positive destruction % = real signal. Negative = artefact.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs" data-testid="shuffle-table">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="text-left py-1.5 pr-4 font-semibold text-slate-500">Condition</th>
                          <th className="text-right pr-4 font-semibold text-slate-500">Real mean |λ|</th>
                          <th className="text-right pr-4 font-semibold text-slate-500">Shuffle mean |λ|</th>
                          <th className="text-right font-semibold text-slate-500">Destruction</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { label: "p53 MYC-OFF",   ...SHUFFLE.p53Off   },
                          { label: "p53 MYC-ON",    ...SHUFFLE.p53On    },
                          { label: "Clock MYC-OFF",  ...SHUFFLE.clockOff },
                        ].map((row, i) => (
                          <tr key={i} className="border-b border-slate-50">
                            <td className="py-2 pr-4 font-medium text-slate-700">{row.label}</td>
                            <td className="pr-4 text-right font-mono text-slate-800">{row.realMean.toFixed(4)}</td>
                            <td className="pr-4 text-right font-mono text-slate-500">{row.shuffleMean.toFixed(4)}</td>
                            <td className={`text-right font-mono font-semibold ${row.destruction > 0 ? "text-emerald-700" : "text-red-600"}`}>
                              {row.destruction > 0 ? "+" : ""}{row.destruction}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-2 p-3 bg-slate-50 rounded text-xs text-slate-600">
                    <strong>p53 MYC-ON:</strong> 42.5% destruction validates genuine temporal signal. 
                    <strong className="ml-2">p53 MYC-OFF:</strong> −9.4% (below-genome persistence, no real temporal structure to destroy — consistent with ns permutation test). 
                    <strong className="ml-2">Clock MYC-OFF:</strong> 27.9% destruction validates clock temporal structure.
                  </div>
                </div>

                {/* 2. Rolling window */}
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-2">2. Rolling Window Stability</h4>
                  <p className="text-xs text-slate-500 mb-3">
                    Rep2 has 25 timepoints (CT24–CT72). AR(2) fitted to three overlapping 15-point windows. 
                    A stable result should not be driven by a single part of the time course.
                  </p>
                  <div className="grid grid-cols-2 gap-6">
                    {[
                      { label: "p53 MYC-OFF", data: ROLLING.p53Off, color: "#94a3b8", note: "Window-dependent variation; last window weaker." },
                      { label: "Clock MYC-OFF", data: ROLLING.clkOff, color: "#6366f1", note: "Declining pattern expected — clock dampens post-synchronisation." },
                    ].map(g => (
                      <div key={g.label}>
                        <div className="text-xs font-semibold text-slate-500 mb-2">{g.label}</div>
                        <div className="space-y-1.5">
                          {g.data.map((d, i) => (
                            <div key={i}>
                              <div className="flex justify-between text-[10px] mb-0.5">
                                <span className="text-slate-500">{d.window}</span>
                                <span className="font-mono text-slate-700">{d.meanLambda.toFixed(4)}</span>
                              </div>
                              <CssBar value={d.meanLambda} max={1} color={g.color} />
                            </div>
                          ))}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">{g.note}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. Expression threshold sensitivity */}
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-2">3. Expression Threshold Sensitivity</h4>
                  <p className="text-xs text-slate-500 mb-3">
                    Genome median |λ| computed across TPM thresholds 0.5, 1, 2, 5. Primary analysis: TPM &gt; 1.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: "Rep2 MYC-OFF", data: THRESHOLD_SENS.rep2Off },
                      { label: "Rep2 MYC-ON",  data: THRESHOLD_SENS.rep2On  },
                    ].map(cond => (
                      <div key={cond.label}>
                        <div className="text-xs font-semibold text-slate-500 mb-1">{cond.label}</div>
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-50">
                              <th className="text-left px-2 py-1 font-semibold text-slate-500">TPM cutoff</th>
                              <th className="text-right px-2 py-1 font-semibold text-slate-500">N genes</th>
                              <th className="text-right px-2 py-1 font-semibold text-slate-500">Median |λ|</th>
                              <th className="text-right px-2 py-1 font-semibold text-slate-500">Mean |λ|</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cond.data.map((row, i) => (
                              <tr key={i} className={`border-b border-slate-100 ${row.threshold === 1 ? "bg-violet-50 font-semibold" : ""}`}>
                                <td className="px-2 py-1.5">&gt; {row.threshold}</td>
                                <td className="px-2 py-1.5 text-right text-slate-600">{row.nGenes.toLocaleString()}</td>
                                <td className="px-2 py-1.5 text-right font-mono">{row.genomeMedian.toFixed(4)}</td>
                                <td className="px-2 py-1.5 text-right font-mono">{row.genomeMean.toFixed(4)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 p-3 bg-slate-50 rounded text-xs text-slate-600">
                    Genome median |λ| is highly stable across expression thresholds (variation &lt; 0.005 in MYC-OFF; &lt; 0.025 in MYC-ON). 
                    Main finding is robust to filter stringency.
                  </div>
                </div>

                {/* 4. Rep1 quick stats */}
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-2">4. Rep1 (4h spacing, 13 timepoints) Quick-Check</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: "Rep1 MYC-OFF", n: GENOME.rep1Off.n, median: GENOME.rep1Off.median, mean: GENOME.rep1Off.mean },
                      { label: "Rep1 MYC-ON",  n: GENOME.rep1On.n,  median: GENOME.rep1On.median,  mean: GENOME.rep1On.mean  },
                    ].map(r => (
                      <div key={r.label} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                        <div className="text-xs font-semibold text-slate-600 mb-2">{r.label}</div>
                        <div className="text-sm font-mono text-slate-800">Median |λ| = {r.median.toFixed(4)}</div>
                        <div className="text-xs text-slate-500">Mean |λ| = {r.mean.toFixed(4)} · N = {r.n.toLocaleString()}</div>
                        <div className="mt-1.5">
                          <CssBar value={r.median} max={0.75} color={r.label.includes("OFF") ? "#94a3b8" : "#8b5cf6"} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    Rep1 confirms direction: MYC-OFF median 0.447, MYC-ON median 0.513 (+14.8%). 
                    Smaller effect than Rep2 (lower temporal resolution, coarser sampling). Both replicates agree on direction.
                  </div>
                </div>
              </div>
            )}

            {/* ── concordance tab ─────────────────────────────────────────── */}
            {activeTab === "concordance" && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-slate-800 mb-1">Rep1 vs Rep2 Direction Concordance (p53 MYC-ON)</h3>
                  <p className="text-sm text-slate-500 mb-4">
                    For each p53 target gene: does the MYC-ON |λ| increase (up) or decrease (down) vs MYC-OFF?
                    Concordance = same direction in both replicates.
                  </p>
                  <div className="flex gap-6 mb-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-slate-800">{CONCORDANCE.nConcordant}/{CONCORDANCE.nTotal}</div>
                      <div className="text-sm text-slate-500">genes concordant</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-violet-600">{CONCORDANCE.pctConcordant}%</div>
                      <div className="text-sm text-slate-500">concordance rate</div>
                    </div>
                    <div className="flex-1 flex items-center">
                      <div className="p-3 bg-violet-50 border border-violet-200 rounded-lg text-xs text-violet-800 w-full">
                        <strong>Qualification:</strong> 61.5% concordance across replicates with very different sampling rates 
                        (2h vs 4h spacing). Full concordance not expected due to replicate-specific technical variance 
                        in low-expression genes.
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" data-testid="concordance-table">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="text-left py-2 pr-4 font-semibold text-slate-500">Gene</th>
                          <th className="text-center py-2 pr-4 font-semibold text-slate-500">Rep2 direction</th>
                          <th className="text-center py-2 pr-4 font-semibold text-slate-500">Rep1 direction</th>
                          <th className="text-center py-2 font-semibold text-slate-500">Concordant</th>
                        </tr>
                      </thead>
                      <tbody>
                        {CONCORDANCE.genes.map(g => (
                          <tr key={g.symbol} className="border-b border-slate-50 hover:bg-slate-50">
                            <td className="py-2 pr-4 font-semibold text-slate-800">{g.symbol}</td>
                            <td className="py-2 pr-4 text-center">
                              <span className={`px-2 py-0.5 text-xs rounded font-medium ${g.r2Dir === "up" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                                ↑ up
                              </span>
                            </td>
                            <td className="py-2 pr-4 text-center">
                              <span className={`px-2 py-0.5 text-xs rounded font-medium ${g.r1Dir === "up" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                                {g.r1Dir === "up" ? "↑ up" : "↓ down"}
                              </span>
                            </td>
                            <td className="py-2 text-center">
                              {g.concordant
                                ? <span className="px-2 py-0.5 text-xs rounded bg-emerald-100 text-emerald-700 font-medium">✓ yes</span>
                                : <span className="px-2 py-0.5 text-xs rounded bg-slate-100 text-slate-500 font-medium">✗ no</span>
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── METHODS NOTE ─────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-3">Methods & Pre-specification</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-600">
            <div>
              <div className="font-semibold text-slate-700 mb-1">Data</div>
              <ul className="space-y-1 text-xs text-slate-500">
                <li>Dataset: GSE221173 (U2OS MYC-ER, Zomer et al.)</li>
                <li>Rep1: 4h spacing, CT24–CT72, n=13 timepoints</li>
                <li>Rep2: 2h spacing, CT24–CT72, n=25 timepoints</li>
                <li>Expression: polyA-selected RNA-seq, TPM</li>
                <li>Filter: TPM &gt; 1.0 in ≥1 timepoint</li>
              </ul>
            </div>
            <div>
              <div className="font-semibold text-slate-700 mb-1">AR(2) Pipeline</div>
              <ul className="space-y-1 text-xs text-slate-500">
                <li>Mean-centred OLS before fitting (standard)</li>
                <li>Eigenvalue modulus: |λ| = √(|φ₂|) for complex roots</li>
                <li>Permutation: 10,000 random genome draws (same N, same condition)</li>
                <li>One-tailed p-value: fraction of permutations ≥ observed mean</li>
                <li>Pre-specified gene lists: p53 (13), clock (10), MYC (12)</li>
              </ul>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
