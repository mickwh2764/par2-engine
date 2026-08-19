import { Link } from "wouter";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Cell
} from "recharts";
import { ArrowLeft, CheckCircle2, AlertTriangle, Info, Minus } from "lucide-react";

const PHI = (1 + Math.sqrt(5)) / 2;
const PHI_RECIP = 1 / PHI;
const BAND_LO = PHI_RECIP - 0.05;
const BAND_HI = PHI_RECIP + 0.05;
const N_BINS = 20;

type Condition = {
  label: string;
  color: string;
  textColor: string;
  borderColor: string;
  timescaleStatus: string;
  genes: { gene: string; lambda: number; role: "clock" | "target" }[];
};

const CONDITIONS: Condition[] = [
  {
    label: "WT",
    color: "bg-blue-900/30",
    textColor: "text-blue-300",
    borderColor: "border-blue-600/40",
    timescaleStatus: "Both timescales intact: circadian (24h) + renewal (3–5d)",
    genes: [
      { gene: "Cry1",    lambda: 0.814, role: "clock" },
      { gene: "Arntl",   lambda: 0.810, role: "clock" },
      { gene: "Dbp",     lambda: 0.782, role: "clock" },
      { gene: "Nr1d1",   lambda: 0.743, role: "clock" },
      { gene: "Cdk1",    lambda: 0.757, role: "target" },
      { gene: "Myc",     lambda: 0.743, role: "target" },
      { gene: "Wee1",    lambda: 0.655, role: "target" },
      { gene: "Axin2",   lambda: 0.637, role: "target" },
      { gene: "Mki67",   lambda: 0.528, role: "target" },
      { gene: "Cdkn1a",  lambda: 0.531, role: "target" },
      { gene: "Clock",   lambda: 0.475, role: "clock" },
      { gene: "Per2",    lambda: 0.487, role: "clock" },
      { gene: "Lgr5",    lambda: 0.474, role: "target" },
      { gene: "Per1",    lambda: 0.240, role: "clock" },
      { gene: "Ccnb1",   lambda: 0.206, role: "target" },
    ],
  },
  {
    label: "BmalKO",
    color: "bg-red-900/30",
    textColor: "text-red-300",
    borderColor: "border-red-600/40",
    timescaleStatus: "Circadian timescale REMOVED (BMAL1 absent — TTFL collapsed)",
    genes: [
      { gene: "Arntl",   lambda: 0.439, role: "clock" },
      { gene: "Per2",    lambda: 0.445, role: "clock" },
      { gene: "Cry1",    lambda: 0.458, role: "clock" },
      { gene: "Nr1d1",   lambda: 0.483, role: "clock" },
      { gene: "Wee1",    lambda: 0.782, role: "target" },
      { gene: "Lgr5",    lambda: 0.833, role: "target" },
      { gene: "Myc",     lambda: 0.423, role: "target" },
      { gene: "Cdk1",    lambda: 0.509, role: "target" },
      { gene: "Mki67",   lambda: 0.400, role: "target" },
      { gene: "Cdkn1a",  lambda: 0.547, role: "target" },
      { gene: "Ccnb1",   lambda: 0.960, role: "target" },
    ],
  },
  {
    label: "ApcKO",
    color: "bg-emerald-900/30",
    textColor: "text-emerald-300",
    borderColor: "border-emerald-600/40",
    timescaleStatus: "Renewal programme HYPERACTIVATED (APC lost — constitutive Wnt/β-catenin)",
    genes: [
      { gene: "Arntl",   lambda: 0.880, role: "clock" },
      { gene: "Per2",    lambda: 0.528, role: "clock" },
      { gene: "Cry1",    lambda: 0.376, role: "clock" },
      { gene: "Nr1d1",   lambda: 0.539, role: "clock" },
      { gene: "Per1",    lambda: 0.915, role: "clock" },
      { gene: "Dbp",     lambda: 1.000, role: "clock" },
      { gene: "Clock",   lambda: 0.413, role: "clock" },
      { gene: "Wee1",    lambda: 0.877, role: "target" },
      { gene: "Lgr5",    lambda: 0.928, role: "target" },
      { gene: "Myc",     lambda: 0.705, role: "target" },
      { gene: "Cdk1",    lambda: 0.973, role: "target" },
      { gene: "Mki67",   lambda: 0.622, role: "target" },
      { gene: "Cdkn1a",  lambda: 0.929, role: "target" },
      { gene: "Ccnb1",   lambda: 1.000, role: "target" },
      { gene: "Axin2",   lambda: 0.937, role: "target" },
    ],
  },
  {
    label: "DblKO",
    color: "bg-purple-900/30",
    textColor: "text-purple-300",
    borderColor: "border-purple-600/40",
    timescaleStatus: "Both perturbations combined (APC + BMAL1 absent)",
    genes: [
      { gene: "Arntl",   lambda: 0.617, role: "clock" },
      { gene: "Per2",    lambda: 0.833, role: "clock" },
      { gene: "Cry1",    lambda: 0.331, role: "clock" },
      { gene: "Nr1d1",   lambda: 0.443, role: "clock" },
      { gene: "Wee1",    lambda: 0.335, role: "target" },
      { gene: "Lgr5",    lambda: 0.941, role: "target" },
      { gene: "Myc",     lambda: 0.439, role: "target" },
      { gene: "Cdk1",    lambda: 0.450, role: "target" },
      { gene: "Mki67",   lambda: 0.292, role: "target" },
      { gene: "Cdkn1a",  lambda: 0.824, role: "target" },
      { gene: "Ccnb1",   lambda: 0.339, role: "target" },
    ],
  },
];

function makeBins(genes: { lambda: number }[]) {
  const bins = Array.from({ length: N_BINS }, (_, i) => ({
    lo: i / N_BINS,
    mid: (i + 0.5) / N_BINS,
    count: 0,
    inBand: (i + 0.5) / N_BINS >= BAND_LO && (i + 0.5) / N_BINS <= BAND_HI,
  }));
  for (const g of genes) {
    const bi = Math.min(Math.floor(g.lambda * N_BINS), N_BINS - 1);
    bins[bi].count++;
  }
  return bins;
}

function mean(vals: number[]) {
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function sd(vals: number[]) {
  const m = mean(vals);
  return Math.sqrt(vals.reduce((a, b) => a + (b - m) ** 2, 0) / vals.length);
}

function ConditionPanel({ cond, nullRate }: { cond: Condition; nullRate: number }) {
  const bins = makeBins(cond.genes);
  const inBand = cond.genes.filter(g => g.lambda >= BAND_LO && g.lambda <= BAND_HI);
  const lambdas = cond.genes.map(g => g.lambda);
  const m = mean(lambdas);
  const s = sd(lambdas);
  const bioRate = inBand.length / cond.genes.length;
  const enrichment = bioRate / nullRate;

  return (
    <div className={`rounded-2xl border p-5 ${cond.color} ${cond.borderColor}`} data-testid={`panel-${cond.label}`}>
      <div className="flex items-start justify-between mb-1">
        <h3 className={`text-base font-bold ${cond.textColor}`}>{cond.label}</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full border font-mono ${
          inBand.length === 0 ? "bg-slate-800 border-slate-600 text-slate-400" :
          inBand.length >= 2 ? "bg-amber-900/40 border-amber-600 text-amber-300" :
          "bg-slate-800 border-slate-600 text-slate-400"
        }`}>
          {inBand.length}/{cond.genes.length} in φ band
        </span>
      </div>
      <p className="text-xs text-slate-400 mb-3 leading-snug">{cond.timescaleStatus}</p>

      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={bins} margin={{ top: 4, right: 4, bottom: 16, left: -16 }}>
          <CartesianGrid strokeDasharray="2 2" stroke="#1e293b" vertical={false} />
          <XAxis
            dataKey="mid"
            tickFormatter={(v: number) => v.toFixed(1)}
            tick={{ fontSize: 9, fill: "#64748b" }}
          />
          <YAxis tick={{ fontSize: 9, fill: "#64748b" }} />
          <ReferenceLine x={PHI_RECIP} stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="3 2" />
          <Bar dataKey="count" radius={[2, 2, 0, 0]}>
            {bins.map((b, i) => (
              <Cell key={i} fill={b.inBand ? "#f59e0b" : "#3b82f6"} fillOpacity={b.inBand ? 0.9 : 0.45} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="grid grid-cols-3 gap-2 mt-2 text-center">
        <div className="bg-slate-900/60 rounded-lg px-2 py-1.5">
          <p className="text-[10px] text-slate-500">Mean |λ|</p>
          <p className={`text-sm font-bold ${cond.textColor}`}>{m.toFixed(3)}</p>
        </div>
        <div className="bg-slate-900/60 rounded-lg px-2 py-1.5">
          <p className="text-[10px] text-slate-500">Spread (SD)</p>
          <p className={`text-sm font-bold ${cond.textColor}`}>{s.toFixed(3)}</p>
        </div>
        <div className="bg-slate-900/60 rounded-lg px-2 py-1.5">
          <p className="text-[10px] text-slate-500">φ enrichment</p>
          <p className={`text-sm font-bold ${enrichment > 1.2 ? "text-amber-400" : "text-slate-400"}`}>
            {inBand.length === 0 ? "0×" : `${enrichment.toFixed(1)}×`}
          </p>
        </div>
      </div>

      {inBand.length > 0 && (
        <p className="text-[10px] text-amber-400/80 mt-2">
          In band: {inBand.map(g => `${g.gene} (${g.lambda.toFixed(3)})`).join(", ")}
        </p>
      )}
    </div>
  );
}

export default function PhiTimescaleBuffering() {
  const NULL_RATE = 0.12;

  const summaryRows = CONDITIONS.map(c => {
    const inBand = c.genes.filter(g => g.lambda >= BAND_LO && g.lambda <= BAND_HI).length;
    const lambdas = c.genes.map(g => g.lambda);
    return {
      label: c.label,
      textColor: c.textColor,
      n: c.genes.length,
      inBand,
      pct: (inBand / c.genes.length * 100).toFixed(0),
      meanLambda: mean(lambdas).toFixed(3),
      sd: sd(lambdas).toFixed(3),
    };
  });

  const wtInBand = summaryRows[0].inBand;
  const bmalKoInBand = summaryRows[1].inBand;
  const apcKoInBand = summaryRows[2].inBand;

  const prediction_met = bmalKoInBand < wtInBand;
  const too_small = wtInBand <= 2;

  const criticalFinding = (() => {
    const wtMean = mean(CONDITIONS[0].genes.map(g => g.lambda));
    const apcMean = mean(CONDITIONS[2].genes.map(g => g.lambda));
    return apcMean > PHI_RECIP && wtMean < PHI_RECIP;
  })();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-5xl mx-auto px-4 py-8">

        <Link href="/phi-inevitability-test" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-6">
          <ArrowLeft size={14} /> Candidate 1: Is φ-Proximity Inevitable?
        </Link>

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">
            Candidate 3 Test: Is φ Acting as a Timescale Buffer?
          </h1>
          <p className="text-slate-400 max-w-3xl leading-relaxed">
            If 1/φ ≈ 0.618 buffers between the circadian (24h) and renewal (3–5 day) timescales,
            destroying either timescale should cause the eigenvalue distribution to shift away from φ.
            This test compares φ-proximity across all four GSE157357 genotypes — before and after
            removing each timescale — using corrected April 2026 eigenvalues.
          </p>
        </div>

        <div className="bg-slate-800/60 rounded-xl border border-slate-700 p-4 mb-6">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">The specific prediction</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-3">
              <p className="font-semibold text-blue-300">WT (baseline)</p>
              <p className="text-slate-400 text-xs mt-1">Both timescales intact → φ-proximity should be highest</p>
            </div>
            <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-3">
              <p className="font-semibold text-red-300">BmalKO (clock gone)</p>
              <p className="text-slate-400 text-xs mt-1">Circadian timescale removed → φ-proximity should fall</p>
            </div>
            <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-lg p-3">
              <p className="font-semibold text-emerald-300">ApcKO (Wnt hyperactive)</p>
              <p className="text-slate-400 text-xs mt-1">Renewal timescale disrupted → φ-proximity should fall</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
          {CONDITIONS.map(c => (
            <ConditionPanel key={c.label} cond={c} nullRate={NULL_RATE} />
          ))}
        </div>

        <div className="bg-slate-900 rounded-2xl border border-slate-700 p-5 mb-6">
          <h2 className="text-base font-semibold text-white mb-4">Summary Comparison</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left px-3 py-2 text-slate-400 font-medium text-xs">Condition</th>
                  <th className="text-center px-3 py-2 text-slate-400 font-medium text-xs">Genes in φ band</th>
                  <th className="text-center px-3 py-2 text-slate-400 font-medium text-xs">% in band</th>
                  <th className="text-center px-3 py-2 text-slate-400 font-medium text-xs">Mean |λ|</th>
                  <th className="text-center px-3 py-2 text-slate-400 font-medium text-xs">Spread (SD)</th>
                  <th className="text-center px-3 py-2 text-slate-400 font-medium text-xs">vs prediction</th>
                </tr>
              </thead>
              <tbody>
                {summaryRows.map((r, i) => (
                  <tr key={r.label} className="border-b border-slate-800" data-testid={`summary-row-${r.label}`}>
                    <td className={`px-3 py-2.5 font-semibold ${r.textColor}`}>{r.label}</td>
                    <td className="px-3 py-2.5 text-center font-mono">{r.inBand}/{r.n}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`font-bold ${r.inBand > 0 ? "text-amber-400" : "text-slate-500"}`}>
                        {r.pct}%
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono">{r.meanLambda}</td>
                    <td className="px-3 py-2.5 text-center font-mono">{r.sd}</td>
                    <td className="px-3 py-2.5 text-center">
                      {i === 0 ? (
                        <span className="text-xs text-blue-400">Baseline</span>
                      ) : r.inBand < wtInBand ? (
                        <span className="flex items-center justify-center gap-1 text-xs text-emerald-400">
                          <CheckCircle2 size={12} /> Predicted ↓
                        </span>
                      ) : r.inBand === wtInBand ? (
                        <span className="flex items-center justify-center gap-1 text-xs text-slate-400">
                          <Minus size={12} /> No change
                        </span>
                      ) : (
                        <span className="flex items-center justify-center gap-1 text-xs text-red-400">
                          <AlertTriangle size={12} /> Against prediction
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500 mt-3">
            Null rate (from Candidate 1 simulation): ~{(NULL_RATE * 100).toFixed(0)}% of random stable AR(2) processes land in the φ band [0.568, 0.668].
          </p>
        </div>

        <div className="bg-slate-900 rounded-2xl border border-slate-700 p-6 mb-6">
          <h2 className="text-base font-semibold text-white mb-4">Critical Finding: Where Does φ Sit Relative to the Two Groups?</h2>
          <div className="relative h-12 mb-8">
            <div className="absolute inset-x-0 top-1/2 h-px bg-slate-600" />
            <div
              className="absolute top-0 bottom-0 bg-amber-400/10 border-x border-amber-400/30"
              style={{ left: `${BAND_LO * 100}%`, right: `${(1 - BAND_HI) * 100}%` }}
            />
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-amber-400"
              style={{ left: `${PHI_RECIP * 100}%` }}
            />
            <span className="absolute text-[9px] text-amber-400 whitespace-nowrap"
              style={{ left: `${PHI_RECIP * 100}%`, top: "-16px", transform: "translateX(-50%)" }}>
              1/φ = 0.618
            </span>
            {[
              { label: "WT clock mean", val: 0.622, color: "bg-blue-400" },
              { label: "WT target mean", val: 0.566, color: "bg-emerald-400" },
              { label: "ApcKO overall", val: 0.775, color: "bg-emerald-600" },
              { label: "BmalKO overall", val: 0.571, color: "bg-red-400" },
            ].map(m => (
              <div key={m.label}
                className="absolute -translate-x-1/2 flex flex-col items-center"
                style={{ left: `${m.val * 100}%` }}>
                <div className={`w-2.5 h-2.5 rounded-full ${m.color} mt-[18px]`} />
                <span className="text-[8px] text-slate-500 whitespace-nowrap mt-0.5">{m.label}</span>
                <span className="text-[8px] text-slate-400 font-mono">{m.val.toFixed(3)}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 bg-amber-900/10 border border-amber-600/20 rounded-xl p-4 text-sm text-slate-300 leading-relaxed">
            <p className="font-semibold text-amber-300 mb-2">Key observation from the corrected data:</p>
            <p>
              In WT, the clock gene mean (0.622) sits <em>just above</em> 1/φ = 0.618, and the target gene mean (0.566) sits
              <em> below</em> it — so 1/φ <strong className="text-white">does</strong> lie between the two group means.
              The "buffering between timescales" geometric structure is preserved in the corrected data,
              though the separation is considerably tighter than originally claimed: the corrected gap between
              clock and target means is 0.056 (vs 0.347 in the old uncorrected data), and 1/φ falls only
              0.004 above the clock mean rather than neatly centred.
            </p>
            <p className="mt-2">
              In the old uncorrected data (clock mean = 0.754, target mean = 0.407), 1/φ = 0.618 sat
              well between the two groups with a wide gap. The corrected values compress that gap substantially —
              the geometry survives but is far less dramatic than initially reported.
            </p>
          </div>
        </div>

        <div className="bg-slate-900 rounded-2xl border border-slate-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Info size={16} className="text-blue-400" />
            <h2 className="text-base font-semibold text-white">Verdict on Candidate 3</h2>
          </div>

          <div className={`rounded-xl p-5 border mb-4 ${
            prediction_met && !too_small
              ? "bg-emerald-900/10 border-emerald-500/30"
              : "bg-slate-800 border-slate-600"
          }`}>
            {prediction_met ? (
              <div className="flex gap-3">
                <CheckCircle2 className="text-amber-400 shrink-0 mt-0.5" size={20} />
                <div>
                  <p className="font-semibold text-white mb-1">
                    Direction consistent with Candidate 3 — but numbers too small to conclude
                  </p>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    BmalKO (circadian timescale removed) has fewer genes in the φ band than WT
                    ({bmalKoInBand} vs {wtInBand}), consistent with the prediction that removing a timescale
                    reduces φ-proximity. ApcKO also has fewer than WT ({apcKoInBand} vs {wtInBand}).
                    The trend is in the predicted direction. However, with only 15 genes per condition
                    and at most 2 genes in the band at baseline, this is not statistically testable —
                    the differences are within sampling noise.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex gap-3">
                <AlertTriangle className="text-red-400 shrink-0 mt-0.5" size={20} />
                <div>
                  <p className="font-semibold text-white mb-1">Candidate 3 not supported by this data</p>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    The knockouts do not consistently show reduced φ-proximity compared to WT.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3 text-sm text-slate-300 leading-relaxed">
            <p>
              <strong className="text-white">The deeper issue revealed by the correction:</strong> The corrected
              data shows the clock mean (0.622) just above 1/φ and the target mean (0.566) below it —
              so 1/φ does still lie between the two groups. However, the clock–target gap has compressed
              from 0.347 (uncorrected) to 0.056 (corrected), and 1/φ sits only 0.004 above the clock mean.
              The buffering geometry is technically present but far too narrow to be geometrically compelling.
              The most honest conclusion is that Candidate 3 rested on a much wider separation than the
              corrected data supports — not that the geometry is absent, but that it is not distinctive enough
              to constitute evidence.
            </p>
            <p>
              <strong className="text-white">What this does not mean:</strong> It doesn't mean the φ
              connection is worthless. The algebraic bridge (Candidate 1's structural finding) survives
              the correction intact. And the corrected ApcKO mechanism story — target elevation dominant,
              not clock suppression — is actually clearer and more biologically interpretable without
              the φ-between-groups geometry.
            </p>
            <p>
              <strong className="text-white">Recommendation:</strong> Candidate 3 should be noted as
              "not supported by corrected analysis" in the paper. The algebraic connection (shared
              equation) remains the primary and defensible claim.
            </p>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-700 flex gap-4">
            <Link href="/phi-inevitability-test" className="text-xs text-rose-400 hover:underline">
              ← Candidate 1 test
            </Link>
            <Link href="/boman-par2-mapping" className="text-xs text-amber-400 hover:underline">
              Algebraic bridge →
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
