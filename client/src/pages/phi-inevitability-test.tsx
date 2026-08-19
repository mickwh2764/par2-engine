import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Cell
} from "recharts";
import { ArrowLeft, RefreshCw, FlaskConical, CheckCircle2, AlertTriangle, Info } from "lucide-react";

const PHI = (1 + Math.sqrt(5)) / 2;
const PHI_RECIP = 1 / PHI;
const BAND_HALF = 0.05;
const BAND_LO = PHI_RECIP - BAND_HALF;
const BAND_HI = PHI_RECIP + BAND_HALF;
const N_SAMPLES = 10000;
const N_BINS = 40;

const BIO_GENES: { gene: string; lambda: number; role: "clock" | "target" }[] = [
  { gene: "Cry1",   lambda: 0.814, role: "clock" },
  { gene: "Arntl",  lambda: 0.810, role: "clock" },
  { gene: "Dbp",    lambda: 0.782, role: "clock" },
  { gene: "Nr1d1",  lambda: 0.743, role: "clock" },
  { gene: "Cdk1",   lambda: 0.757, role: "target" },
  { gene: "Myc",    lambda: 0.743, role: "target" },
  { gene: "Wee1",   lambda: 0.655, role: "target" },
  { gene: "Axin2",  lambda: 0.637, role: "target" },
  { gene: "Mki67",  lambda: 0.528, role: "target" },
  { gene: "Cdkn1a", lambda: 0.531, role: "target" },
  { gene: "Clock",  lambda: 0.475, role: "clock" },
  { gene: "Per2",   lambda: 0.487, role: "clock" },
  { gene: "Lgr5",   lambda: 0.474, role: "target" },
  { gene: "Per1",   lambda: 0.240, role: "clock" },
  { gene: "Ccnb1",  lambda: 0.206, role: "target" },
];

function isStationary(phi1: number, phi2: number): boolean {
  return phi2 + phi1 < 1 && phi2 - phi1 < 1 && phi2 > -1;
}

function computeModulus(phi1: number, phi2: number): number {
  const disc = phi1 * phi1 + 4 * phi2;
  if (disc >= 0) {
    const r1 = (phi1 + Math.sqrt(disc)) / 2;
    const r2 = (phi1 - Math.sqrt(disc)) / 2;
    return Math.max(Math.abs(r1), Math.abs(r2));
  } else {
    return Math.sqrt(-phi2);
  }
}

function binomialPMF(n: number, k: number, p: number): number {
  if (k < 0 || k > n) return 0;
  let logC = 0;
  for (let i = 0; i < k; i++) logC += Math.log(n - i) - Math.log(i + 1);
  return Math.exp(logC + k * Math.log(p) + (n - k) * Math.log(1 - p));
}

function binomialPValue(n: number, k: number, p: number): number {
  let pval = 0;
  for (let i = k; i <= n; i++) pval += binomialPMF(n, i, p);
  return Math.min(1, pval);
}

interface SimResult {
  bins: { midpoint: number; count: number; inBand: boolean }[];
  nullRate: number;
  accepted: number;
}

function runMonteCarlo(): SimResult {
  const binSize = 1 / N_BINS;
  const bins = Array.from({ length: N_BINS }, (_, i) => ({
    midpoint: (i + 0.5) * binSize,
    count: 0,
    inBand: (i + 0.5) * binSize >= BAND_LO && (i + 0.5) * binSize <= BAND_HI,
  }));

  let accepted = 0;
  let inBand = 0;
  let attempts = 0;
  while (accepted < N_SAMPLES && attempts < N_SAMPLES * 20) {
    attempts++;
    const phi1 = (Math.random() - 0.5) * 4;
    const phi2 = (Math.random() - 0.5) * 2;
    if (!isStationary(phi1, phi2)) continue;
    const lam = computeModulus(phi1, phi2);
    if (lam < 0 || lam > 1) continue;
    const bi = Math.min(Math.floor(lam * N_BINS), N_BINS - 1);
    bins[bi].count++;
    accepted++;
    if (lam >= BAND_LO && lam <= BAND_HI) inBand++;
  }

  return { bins, nullRate: inBand / accepted, accepted };
}

export default function PhiInevitabilityTest() {
  const [result, setResult] = useState<SimResult | null>(null);
  const [running, setRunning] = useState(false);

  const run = useCallback(() => {
    setRunning(true);
    setTimeout(() => {
      const r = runMonteCarlo();
      setResult(r);
      setRunning(false);
    }, 50);
  }, []);

  useEffect(() => { run(); }, [run]);

  const bioInBand = BIO_GENES.filter(g => g.lambda >= BAND_LO && g.lambda <= BAND_HI);
  const pval = result ? binomialPValue(BIO_GENES.length, bioInBand.length, result.nullRate) : null;
  const enrichment = result ? (bioInBand.length / BIO_GENES.length) / result.nullRate : null;

  const verdict = pval !== null
    ? pval < 0.05
      ? "enriched"
      : "not-enriched"
    : null;

  const maxCount = result ? Math.max(...result.bins.map(b => b.count)) : 1;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-5xl mx-auto px-4 py-8">

        <Link href="/boman-par2-mapping" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-6">
          <ArrowLeft size={14} /> Boman ↔ PAR(2) Mapping
        </Link>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <FlaskConical className="text-amber-400" size={24} />
            <h1 className="text-2xl font-bold text-white">
              Candidate 1 Test: Is φ-Proximity Mathematically Inevitable?
            </h1>
          </div>
          <p className="text-slate-400 max-w-3xl leading-relaxed">
            The golden ratio (1/φ ≈ 0.618) appears in both Boman's spatial crypt model and as a boundary
            of AR(2) temporal persistence. But could it appear near 0.618 simply because <em>any</em> random
            stationary AR(2) process tends to land there? This test checks: is the biological enrichment
            near φ greater than pure mathematical chance would predict?
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Null model</p>
            <p className="text-xl font-bold text-white">{N_SAMPLES.toLocaleString()} random</p>
            <p className="text-xs text-slate-500 mt-1">stable AR(2) processes sampled uniformly from the stationarity triangle</p>
          </div>
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">φ band tested</p>
            <p className="text-xl font-bold text-amber-400">
              [{BAND_LO.toFixed(3)}, {BAND_HI.toFixed(3)}]
            </p>
            <p className="text-xs text-slate-500 mt-1">|λ − 1/φ| ≤ 0.05 (±5 percentage points around 0.618)</p>
          </div>
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Biological genes</p>
            <p className="text-xl font-bold text-white">{BIO_GENES.length} genes</p>
            <p className="text-xs text-slate-500 mt-1">GSE157357 WT corrected eigenvalues (clock + target, April 2026)</p>
          </div>
        </div>

        <div className="bg-slate-900 rounded-2xl border border-slate-700 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white">
              Null Distribution of |λ| — 10,000 Random Stable AR(2) Processes
            </h2>
            <button
              onClick={run}
              disabled={running}
              className="flex items-center gap-2 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              data-testid="button-rerun-simulation"
            >
              <RefreshCw size={12} className={running ? "animate-spin" : ""} />
              {running ? "Running…" : "Re-run"}
            </button>
          </div>

          {result ? (
            <div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={result.bins} margin={{ top: 8, right: 16, bottom: 24, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis
                    dataKey="midpoint"
                    tickFormatter={(v: number) => v.toFixed(2)}
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    label={{ value: "|λ| eigenvalue modulus", position: "insideBottom", offset: -12, fontSize: 11, fill: "#94a3b8" }}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    label={{ value: "Count", angle: -90, position: "insideLeft", fontSize: 11, fill: "#94a3b8" }}
                  />
                  <Tooltip
                    formatter={(v: number) => [v, "Null count"]}
                    labelFormatter={(l: number) => `|λ| ≈ ${Number(l).toFixed(3)}`}
                    contentStyle={{ background: "#1e293b", border: "1px solid #475569", borderRadius: 8, fontSize: 11 }}
                  />
                  <ReferenceLine x={PHI_RECIP} stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 2"
                    label={{ value: "1/φ = 0.618", position: "top", fontSize: 10, fill: "#f59e0b" }} />
                  <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                    {result.bins.map((b, i) => (
                      <Cell key={i} fill={b.inBand ? "#f59e0b" : "#3b82f6"} fillOpacity={b.inBand ? 0.85 : 0.5} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p className="text-xs text-slate-500 text-center mt-1">
                Amber bars = φ band [0.568, 0.668]. Blue bars = rest of distribution.
                Null rate in φ band: <strong className="text-amber-400">{(result.nullRate * 100).toFixed(1)}%</strong>
              </p>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-slate-500 text-sm">
              Running simulation…
            </div>
          )}
        </div>

        <div className="bg-slate-900 rounded-2xl border border-slate-700 p-6 mb-6">
          <h2 className="text-base font-semibold text-white mb-4">
            Biological Gene Eigenvalues — GSE157357 WT (Corrected April 2026)
          </h2>
          <div className="relative h-16 mb-3">
            <div className="absolute inset-x-0 top-1/2 h-px bg-slate-700" />
            <div
              className="absolute top-0 bottom-0 bg-amber-400/10 border-x border-amber-400/30"
              style={{ left: `${BAND_LO * 100}%`, right: `${(1 - BAND_HI) * 100}%` }}
            />
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-amber-400/60"
              style={{ left: `${PHI_RECIP * 100}%` }}
            />
            {BIO_GENES.map((g) => (
              <div
                key={g.gene}
                className="absolute -translate-x-1/2 flex flex-col items-center"
                style={{ left: `${g.lambda * 100}%`, top: g.role === "clock" ? "2px" : "auto", bottom: g.role === "target" ? "2px" : "auto" }}
                data-testid={`gene-dot-${g.gene}`}
              >
                <div className={`w-2.5 h-2.5 rounded-full border-2 ${
                  g.role === "clock"
                    ? "bg-blue-500 border-blue-300"
                    : "bg-emerald-500 border-emerald-300"
                } ${g.lambda >= BAND_LO && g.lambda <= BAND_HI ? "ring-2 ring-amber-400" : ""}`} />
                <span className="text-[9px] text-slate-400 mt-0.5 whitespace-nowrap">{g.gene}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-6 text-xs text-slate-400 mt-8">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> Clock genes (top row)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" /> Target genes (bottom row)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full ring-2 ring-amber-400 inline-block" /> Inside φ band
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            {BIO_GENES.map(g => (
              <div key={g.gene}
                className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs ${
                  g.lambda >= BAND_LO && g.lambda <= BAND_HI
                    ? "bg-amber-900/30 border border-amber-600/40"
                    : "bg-slate-800 border border-slate-700"
                }`}
                data-testid={`gene-row-${g.gene}`}
              >
                <span className={`font-mono font-semibold ${g.role === "clock" ? "text-blue-300" : "text-emerald-300"}`}>
                  {g.gene}
                </span>
                <span className="text-slate-300">|λ| = {g.lambda.toFixed(3)}</span>
                {g.lambda >= BAND_LO && g.lambda <= BAND_HI
                  ? <span className="text-amber-400 font-bold">✓ in band</span>
                  : <span className="text-slate-600">—</span>}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900 rounded-2xl border border-slate-700 p-6 mb-6">
          <h2 className="text-base font-semibold text-white mb-4">Statistical Result</h2>
          {result && pval !== null ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-5">
              <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 text-center">
                <p className="text-xs text-slate-400 mb-1">Null rate in band</p>
                <p className="text-2xl font-bold text-blue-400">{(result.nullRate * 100).toFixed(1)}%</p>
                <p className="text-xs text-slate-500">of random processes land near 1/φ by chance</p>
              </div>
              <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 text-center">
                <p className="text-xs text-slate-400 mb-1">Biological rate in band</p>
                <p className="text-2xl font-bold text-amber-400">
                  {bioInBand.length}/{BIO_GENES.length}
                  <span className="text-base ml-1">({(bioInBand.length / BIO_GENES.length * 100).toFixed(0)}%)</span>
                </p>
                <p className="text-xs text-slate-500">{bioInBand.map(g => g.gene).join(", ") || "none"}</p>
              </div>
              <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 text-center">
                <p className="text-xs text-slate-400 mb-1">Enrichment ratio</p>
                <p className="text-2xl font-bold text-white">{enrichment!.toFixed(2)}×</p>
                <p className="text-xs text-slate-500">observed ÷ null rate</p>
              </div>
              <div className={`rounded-xl p-4 border text-center ${
                verdict === "enriched"
                  ? "bg-red-900/20 border-red-600/40"
                  : "bg-emerald-900/20 border-emerald-600/40"
              }`}>
                <p className="text-xs text-slate-400 mb-1">Binomial p-value</p>
                <p className={`text-2xl font-bold ${verdict === "enriched" ? "text-red-400" : "text-emerald-400"}`}>
                  {pval < 0.001 ? "< 0.001" : pval.toFixed(3)}
                </p>
                <p className="text-xs text-slate-500">one-tailed vs null rate</p>
              </div>
            </div>
          ) : (
            <p className="text-slate-500 text-sm">Running simulation…</p>
          )}

          {verdict && (
            <div className={`rounded-xl p-5 border ${
              verdict === "enriched"
                ? "bg-red-900/10 border-red-500/30"
                : "bg-slate-800 border-slate-600"
            }`}>
              {verdict === "not-enriched" ? (
                <div className="flex gap-3">
                  <CheckCircle2 className="text-emerald-400 shrink-0 mt-0.5" size={20} />
                  <div>
                    <p className="font-semibold text-white mb-1">Candidate 1 supported — φ-proximity is not significantly enriched</p>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      The biological gene eigenvalues do not cluster near 1/φ more than random stable AR(2) processes would predict
                      (p = {pval!.toFixed(3)}, binomial test). This means the algebraic connection between Boman's model and
                      PAR(2) reflects a shared mathematical structure — the two-step recursive equation — rather than a specific
                      biological preference for the golden ratio as an eigenvalue target. The genes are spread across the persistence
                      spectrum; φ is a boundary case, not an attractor.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex gap-3">
                  <AlertTriangle className="text-red-400 shrink-0 mt-0.5" size={20} />
                  <div>
                    <p className="font-semibold text-white mb-1">Candidate 1 rejected — biological enrichment exceeds mathematical chance</p>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      The biological gene eigenvalues cluster near 1/φ significantly more than random stable AR(2) processes
                      (p = {pval!.toFixed(3)}, binomial test). This rules out pure mathematical inevitability as the explanation.
                      Something biological is driving persistence values toward the golden ratio — supporting Candidates 2, 3, or 4.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bg-slate-900 rounded-2xl border border-slate-700 p-6">
          <div className="flex items-center gap-2 mb-3">
            <Info size={16} className="text-blue-400" />
            <h2 className="text-base font-semibold text-white">What This Test Means</h2>
          </div>
          <div className="space-y-3 text-sm text-slate-300 leading-relaxed">
            <p>
              <strong className="text-white">The null model</strong> samples φ₁ and φ₂ uniformly from the
              stationary triangle (the region of AR(2) parameter space where all processes are stable,
              |λ| &lt; 1). Each point in that triangle represents a valid AR(2) process. The resulting
              |λ| distribution is not uniform — it reflects the geometry of the stationarity constraint.
            </p>
            <p>
              <strong className="text-white">The test question:</strong> Do the corrected GSE157357 WT
              eigenvalues fall inside the φ band more often than a randomly chosen stable AR(2) process would?
              If yes (p &lt; 0.05), the biological system has something specifically drawing it toward φ.
              If no, the connection is structurally inevitable — you'd expect to see it in any two-step recursive system.
            </p>
            <p>
              <strong className="text-white">The corrected data context:</strong> The April 2026 correction
              substantially changed these eigenvalues. The prior values (Wee1 WT = 0.093, clock mean = 0.754)
              showed more dramatic clustering patterns. The corrected eigenvalues (Wee1 WT = 0.655,
              clock mean = 0.622) are more evenly spread across the spectrum — making this test more, not less,
              important to run.
            </p>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-700 flex gap-4 flex-wrap">
            <Link href="/boman-par2-mapping" className="text-xs text-amber-400 hover:underline">
              ← Algebraic bridge
            </Link>
            <Link href="/phi-timescale-buffering" className="text-xs text-violet-400 hover:underline">
              Candidate 3: Timescale buffer test →
            </Link>
            <Link href="/phi-enrichment-replication" className="text-xs text-yellow-400 hover:underline">
              1/φ enrichment across datasets →
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
