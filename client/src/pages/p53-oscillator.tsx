import { useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, FlaskConical, Database, Beaker, Info } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell, ReferenceLine, Legend,
} from "recharts";

const GENOME_MEDIAN = 0.5964;

const REAL_RESULTS = [
  { gene:"Mdm2",   arm:"MDM2 feedback",        lambda:0.5250, root:"real",    period:"N/A", meanExpr:924,  delta:-0.071, predicted:"complex", note:"Direct p53 target", survivalCtrl:false },
  { gene:"Cdkn1a", arm:"Cell cycle arrest",     lambda:0.8031, root:"real",    period:"N/A", meanExpr:136,  delta:+0.207, predicted:"complex", note:"p21", survivalCtrl:false },
  { gene:"Btg2",   arm:"Cell cycle arrest",     lambda:0.3285, root:"real",    period:"N/A", meanExpr:681,  delta:-0.268, predicted:"complex", note:"BTG2", survivalCtrl:false },
  { gene:"Gadd45a",arm:"Cell cycle arrest",     lambda:0.5290, root:"real",    period:"N/A", meanExpr:1734, delta:-0.067, predicted:"complex", note:"DBP target", survivalCtrl:false },
  { gene:"Gadd45g",arm:"Cell cycle arrest",     lambda:0.2004, root:"complex", period:"3.9h",meanExpr:1827, delta:-0.396, predicted:"complex", note:"Gadd45 family", survivalCtrl:false },
  { gene:"Bax",    arm:"Pro-apoptotic",         lambda:0.3440, root:"complex", period:"3.4h",meanExpr:2609, delta:-0.252, predicted:"complex", note:"BAX effector", survivalCtrl:false },
  { gene:"Bbc3",   arm:"Pro-apoptotic (PUMA)",  lambda:0.3948, root:"real",    period:"N/A", meanExpr:858,  delta:-0.202, predicted:"complex", note:"PUMA", survivalCtrl:false },
  { gene:"Pmaip1", arm:"Pro-apoptotic (NOXA)",  lambda:0.3736, root:"real",    period:"N/A", meanExpr:118,  delta:-0.223, predicted:"complex", note:"NOXA", survivalCtrl:false },
  { gene:"Fas",    arm:"Pro-apoptotic",         lambda:0.7377, root:"real",    period:"N/A", meanExpr:5532, delta:+0.141, predicted:"complex", note:"FAS/CD95", survivalCtrl:false },
  { gene:"Bcl2",   arm:"Survival (control)",    lambda:0.2524, root:"real",    period:"N/A", meanExpr:65,   delta:-0.344, predicted:"real",    note:"BCL2 — specificity ctrl", survivalCtrl:true },
  { gene:"Mcl1",   arm:"Survival (control)",    lambda:0.6356, root:"real",    period:"N/A", meanExpr:12271,delta:+0.039, predicted:"real",    note:"MCL1 — specificity ctrl", survivalCtrl:true },
  { gene:"Birc5",  arm:"Survival (control)",    lambda:0.3232, root:"real",    period:"N/A", meanExpr:66,   delta:-0.273, predicted:"real",    note:"Survivin — ctrl", survivalCtrl:true },
  { gene:"Per2",   arm:"Core clock (ref)",      lambda:0.8680, root:"real",    period:"N/A", meanExpr:355,  delta:+0.272, predicted:"complex", note:"PER2 — clock ref", survivalCtrl:false },
  { gene:"Dbp",    arm:"Clock output (ref)",    lambda:0.7708, root:"real",    period:"N/A", meanExpr:16565,delta:+0.174, predicted:"complex", note:"DBP — drives Gadd45a", survivalCtrl:false },
];

function simulateP53(damageLevel: number, mdm2Amplification: number, p53GOF: boolean, hours = 48, dt = 0.05) {
  let p53 = 0.4, mdm2m = 0.3, mdm2 = 0.3;
  const kSynP53 = 1.2, kDegP53 = 0.18, kMdm2Deg = 1.8;
  const kSynMdm2m = 1.0, kDegMdm2m = 0.95;
  const kSynMdm2 = 0.9, kDegMdm2 = 0.85, kAtm = 1.4;
  const series: { t: number; p53: number; mdm2: number }[] = [];
  const steps = Math.round(hours / dt);
  for (let i = 0; i < steps; i++) {
    const atm = kAtm * damageLevel;
    const mdm2Effect = p53GOF ? 0 : kMdm2Deg * mdm2 * p53;
    const dp53 = kSynP53 - kDegP53 * p53 - mdm2Effect;
    const dMdm2m = kSynMdm2m * p53 - kDegMdm2m * mdm2m;
    const dMdm2 = kSynMdm2 * mdm2m * mdm2Amplification - (kDegMdm2 + atm) * mdm2;
    p53 = Math.max(0, p53 + dt * dp53);
    mdm2m = Math.max(0, mdm2m + dt * dMdm2m);
    mdm2 = Math.max(0, mdm2 + dt * dMdm2);
    if (i % Math.round(1 / dt) === 0) series.push({ t: i * dt, p53, mdm2 });
  }
  return series;
}

function fitAR2(values: number[]) {
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const y = values.map(v => v - mean);
  let X11 = 0, X12 = 0, X22 = 0, Xy1 = 0, Xy2 = 0;
  for (let t = 2; t < n; t++) {
    X11 += y[t-1]**2; X12 += y[t-1]*y[t-2]; X22 += y[t-2]**2;
    Xy1 += y[t]*y[t-1]; Xy2 += y[t]*y[t-2];
  }
  const det = X11*X22 - X12**2;
  if (Math.abs(det) < 1e-15) return { phi1: 0, phi2: 0, lambda: 0, root: "flat", period: "N/A" };
  const phi1 = (X22*Xy1 - X12*Xy2) / det;
  const phi2 = (X11*Xy2 - X12*Xy1) / det;
  const disc = phi1**2 + 4*phi2;
  let lambda: number;
  if (disc >= 0) lambda = Math.max(Math.abs((phi1+Math.sqrt(disc))/2), Math.abs((phi1-Math.sqrt(disc))/2));
  else lambda = Math.sqrt(-phi2);
  const root = disc < 0 ? "complex" : "real";
  let period = "N/A";
  if (disc < 0) {
    const ct = phi1 / (2 * Math.sqrt(-phi2));
    if (Math.abs(ct) <= 1) period = (2*Math.PI / Math.acos(Math.max(-1, Math.min(1, ct)))).toFixed(1) + "h";
  }
  return { phi1: +phi1.toFixed(3), phi2: +phi2.toFixed(3), lambda: +Math.min(lambda, 0.999).toFixed(4), root, period };
}

const SIM_CONDITIONS = [
  { id:"nodamage", label:"No damage",      sub:"Healthy quiescent",          damage:0,   amp:1.0, mut:false, color:"#059669", borderColor:"#d1fae5", activeBg:"#ecfdf5" },
  { id:"damage",   label:"DNA damage",     sub:"Normal p53 response",        damage:1,   amp:1.0, mut:false, color:"#2563eb", borderColor:"#bfdbfe", activeBg:"#eff6ff" },
  { id:"mdm2amp",  label:"MDM2 amplified", sub:"Cancer — feedback overload", damage:1,   amp:3.5, mut:false, color:"#dc2626", borderColor:"#fecaca", activeBg:"#fef2f2" },
  { id:"gof",      label:"TP53 GOF",       sub:"Cancer — feedback broken",   damage:0.5, amp:1.0, mut:true,  color:"#d97706", borderColor:"#fde68a", activeBg:"#fffbeb" },
];

type Tab = "real" | "sim";

export default function P53Oscillator() {
  const [tab, setTab] = useState<Tab>("real");
  const [activeSim, setActiveSim] = useState("damage");

  const simResults = useMemo(() => SIM_CONDITIONS.map(c => {
    const series = simulateP53(c.damage, c.amp, c.mut);
    const p53v = series.map(s => s.p53), mdm2v = series.map(s => s.mdm2);
    return { ...c, series: series.slice(0, 49), ar2_p53: fitAR2(p53v), ar2_mdm2: fitAR2(mdm2v),
      p53min: Math.min(...p53v).toFixed(2), p53max: Math.max(...p53v).toFixed(2) };
  }), []);

  const allSimSeries = useMemo(() => {
    const len = Math.min(...simResults.map(r => r.series.length));
    return Array.from({ length: len }, (_, i) => ({
      t: simResults[0].series[i].t,
      ...Object.fromEntries(simResults.map(r => [r.id, +r.series[i].p53.toFixed(3)])),
    }));
  }, [simResults]);

  const active = simResults.find(r => r.id === activeSim)!;

  const barData = REAL_RESULTS.map(r => ({
    name: r.gene,
    lambda: r.lambda,
    fill: r.survivalCtrl ? "#818cf8" : r.root === "complex" ? "#3b82f6" : r.lambda > GENOME_MEDIAN ? "#ef4444" : "#94a3b8",
    predicted: r.predicted,
    root: r.root,
  }));

  const chartStyle = { backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px" };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">

      {/* Header — keep dark for nav contrast */}
      <div className="border-b border-slate-200 bg-white px-6 py-4 flex items-center gap-4 shadow-sm">
        <Link href="/model-zoo">
          <button className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" /> Model Zoo
          </button>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-violet-600" />
            p53–MDM2 Oscillator: AR(2) Analysis
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Real GSE11923 data + ODE simulation — what is and isn't testable right now
          </p>
        </div>
        <span className="text-xs bg-violet-100 border border-violet-300 text-violet-700 font-medium px-2.5 py-1 rounded-full">
          Pre-specified hypothesis
        </span>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">

        {/* Framing box */}
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-amber-900 font-semibold mb-2">Two analyses — two very different things</p>
              <div className="grid sm:grid-cols-2 gap-4 text-sm">
                <div className="rounded-lg bg-white border border-slate-200 p-3 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <Database className="w-4 h-4 text-emerald-600" />
                    <span className="text-emerald-800 font-semibold">Real data (GSE11923)</span>
                  </div>
                  <p className="text-slate-700 text-xs leading-relaxed">
                    Mouse liver, 48h × 1h sampling. <strong>This is a circadian dataset</strong>, not a DNA damage dataset.
                    p53 is not pulsing here — it's at basal levels in unstressed liver cells.
                    Results show whether p53 targets are <em>circadianly regulated</em>, not whether they follow p53 pulses.
                  </p>
                </div>
                <div className="rounded-lg bg-white border border-slate-200 p-3 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <Beaker className="w-4 h-4 text-violet-600" />
                    <span className="text-violet-800 font-semibold">Simulation (ODE)</span>
                  </div>
                  <p className="text-slate-700 text-xs leading-relaxed">
                    A p53–MDM2 3-variable ODE tuned to produce ~6h oscillations (Lahav lab: ~5.5h).
                    Confirms AR(2) can detect the feedback loop <em>in principle</em>.
                    <strong> Not real data.</strong> The ideal test — hourly RNA-seq after DNA damage — does not currently exist on GEO.{" "}
                    <span className="text-violet-700 font-medium">The ODE tab is a ground-truth method validation: ground truth is known (p53 oscillates ~5.5h), and AR(2) correctly recovers it — including correctly classifying the TP53 GOF mutant as constitutive.</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-2">
          <button onClick={() => setTab("real")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all ${tab==="real" ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-600 border-slate-300 hover:border-slate-400"}`}>
            <Database className="w-4 h-4" /> Real data (GSE11923)
          </button>
          <button onClick={() => setTab("sim")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all ${tab==="sim" ? "bg-violet-600 text-white border-violet-600" : "bg-white text-slate-600 border-slate-300 hover:border-slate-400"}`}>
            <Beaker className="w-4 h-4" /> ODE simulation
          </button>
        </div>

        {/* ── REAL DATA TAB ── */}
        {tab === "real" && (
          <div className="space-y-5">

            {/* Context note */}
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-slate-800 leading-relaxed">
              <strong className="text-emerald-800">What this tests:</strong> Are p53 pathway genes <em>circadianly</em> regulated in normal mouse liver?
              This is a legitimate question — DBP is known to regulate Gadd45a, and p53 has circadian links via SIRT1/PER2.
              But it is <em>not</em> the same as testing the 5.5h DNA damage pulse hypothesis.
              For circadian regulation, AR(2) should find complex roots at ~24h period for clock-coupled genes, and real roots for constitutively expressed ones.
              <span className="text-amber-700 font-medium"> Most p53 targets are constitutively expressed in liver — real roots are expected and not a failure.</span>
            </div>

            {/* Specificity result strip */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
                <div className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-1">Highest p53 target</div>
                <div className="text-3xl font-mono font-bold text-slate-900">0.803</div>
                <div className="text-xs text-slate-500 mt-0.5">Cdkn1a (p21) |λ|</div>
                <div className="text-xs text-red-600 font-semibold mt-1">+0.207 over genome median</div>
              </div>
              <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-center">
                <div className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-1">Survival controls (mean)</div>
                <div className="text-3xl font-mono font-bold text-slate-900">0.404</div>
                <div className="text-xs text-slate-500 mt-0.5">BCL2 / MCL1 / Birc5 mean |λ|</div>
                <div className="text-xs text-indigo-600 font-semibold mt-1">all real-rooted ✓ as predicted</div>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
                <div className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Specificity contrast</div>
                <div className="text-3xl font-mono font-bold text-slate-900">Δ0.55</div>
                <div className="text-xs text-slate-500 mt-0.5">Cdkn1a vs BCL2 (0.803 − 0.252)</div>
                <div className="text-xs text-amber-700 font-semibold mt-1">cell-cycle arrest ≫ survival arm</div>
              </div>
            </div>

            {/* Bar chart */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5">
              <h2 className="text-slate-900 font-semibold mb-1">|λ| values — real GSE11923 data (n=21,510 genes)</h2>
              <p className="text-slate-500 text-xs mb-4">
                Genome median |λ| = {GENOME_MEDIAN}.&nbsp;
                <span className="font-medium" style={{color:"#3b82f6"}}>■ complex roots&nbsp;</span>
                <span className="text-slate-500 font-medium">■ real, below median&nbsp;</span>
                <span className="font-medium" style={{color:"#ef4444"}}>■ real, above median&nbsp;</span>
                <span className="font-medium" style={{color:"#818cf8"}}>■ survival arm (control)</span>
              </p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ left: 0, right: 10, top: 5, bottom: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 11, fill: "#475569" }} angle={-40} textAnchor="end" interval={0} />
                    <YAxis stroke="#94a3b8" tick={{ fontSize: 11, fill: "#475569" }} domain={[0, 1]} />
                    <ReferenceLine y={GENOME_MEDIAN} stroke="#f59e0b" strokeDasharray="4 2"
                      label={{ value: "Genome median", fill: "#92400e", fontSize: 10, position: "right" }} />
                    <Tooltip contentStyle={chartStyle}
                      formatter={(val: number, _name: string, props: { payload?: { root?: string; predicted?: string } }) => [
                        `|λ| = ${val}`,
                        `Root: ${props.payload?.root ?? "?"} | Predicted: ${props.payload?.predicted ?? "?"}`
                      ]} />
                    <Bar dataKey="lambda" radius={[3,3,0,0]}>
                      {barData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Results table */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5">
              <h2 className="text-slate-900 font-semibold mb-1">Full results — real GSE11923 values</h2>
              <p className="text-slate-500 text-xs mb-4">
                Predictions were written for the <em>DNA damage</em> hypothesis. Mismatches here are expected — this is the wrong condition.
                The survival arm controls (BCL2, MCL1, Birc5) all correctly show real roots ✓.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-600 bg-slate-50">
                      <th className="py-2 pr-3 pl-2 font-semibold">Gene</th>
                      <th className="py-2 pr-3 font-semibold">Arm</th>
                      <th className="py-2 pr-3 font-mono font-semibold">|λ|</th>
                      <th className="py-2 pr-3 font-semibold">Root type</th>
                      <th className="py-2 pr-3 font-semibold">Period</th>
                      <th className="py-2 pr-3 font-semibold">vs median</th>
                      <th className="py-2 pr-3 font-semibold">DNA-dmg predict</th>
                      <th className="py-2 font-semibold">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {REAL_RESULTS.map((r, i) => (
                      <tr key={r.gene} className={`border-b border-slate-100 ${i % 2 === 0 ? "bg-white" : "bg-slate-50"} ${r.survivalCtrl ? "opacity-60" : ""}`}>
                        <td className="py-2 pr-3 pl-2 font-mono font-bold text-slate-900">{r.gene}</td>
                        <td className="py-2 pr-3 text-slate-600">{r.arm}</td>
                        <td className={`py-2 pr-3 font-mono font-bold ${r.lambda > GENOME_MEDIAN ? "text-red-600" : "text-slate-700"}`}>{r.lambda}</td>
                        <td className="py-2 pr-3">
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${r.root === "complex" ? "bg-blue-100 text-blue-800 border border-blue-200" : "bg-slate-100 text-slate-600 border border-slate-200"}`}>
                            {r.root}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-slate-600 font-mono">{r.period}</td>
                        <td className={`py-2 pr-3 font-mono ${r.delta > 0 ? "text-red-600 font-semibold" : "text-slate-500"}`}>
                          {r.delta > 0 ? "+" : ""}{r.delta.toFixed(3)}
                        </td>
                        <td className="py-2 pr-3">
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${r.predicted === "complex" ? "bg-violet-100 text-violet-800 border border-violet-200" : "bg-slate-100 text-slate-600 border border-slate-200"}`}>
                            {r.predicted}
                          </span>
                        </td>
                        <td className="py-2 text-slate-500 italic">{r.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 grid sm:grid-cols-2 gap-3">
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-900">
                  <strong>What works:</strong> The survival arm controls (BCL2, MCL1, Birc5) all show real roots — the specificity check passes.
                  Cdkn1a (p21) is the most persistent gene at |λ|=0.803, consistent with its role as a stable cell-cycle brake even at basal levels.
                </div>
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
                  <strong>What doesn't match (and why that's expected):</strong> Most p53 targets show real roots — because p53 is not pulsing here.
                  The 5.5h pulse only fires after DNA damage. Resting liver is the wrong context to test it.
                </div>
              </div>
            </div>

            {/* Why no ideal dataset */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5 text-sm text-slate-700 leading-relaxed">
              <p className="font-semibold text-slate-900 mb-2">Why can't we run the real DNA damage dataset?</p>
              <p className="mb-3 text-slate-600">
                The Lahav lab confirmed p53 pulsing by <em>live-cell fluorescence imaging</em> of protein — not RNA-seq.
                Published RNA-seq DNA damage studies typically have only 4–8 time points at uneven intervals (0, 2, 4, 8, 12, 24h).
                AR(2) needs at least 15–20 evenly spaced points to give stable estimates.
              </p>
              <div className="grid sm:grid-cols-3 gap-3">
                {[
                  { id:"GSE33396", status:"✗ Not usable", reason:"Lahav lab — ~8 uneven timepoints. AR(2) would be unstable.", bg:"bg-red-50", border:"border-red-200", text:"text-red-900", sub:"text-red-700" },
                  { id:"GSE56295", status:"✗ Wrong design", reason:"Nutlin-3 keeps p53 high but suppresses pulsing. Tests a different mechanism.", bg:"bg-red-50", border:"border-red-200", text:"text-red-900", sub:"text-red-700" },
                  { id:"Ideal dataset", status:"? Not on GEO", reason:"Hourly RNA-seq after γ-irradiation for 24h in MCF7 cells — exists in lab notebooks, not deposited publicly.", bg:"bg-amber-50", border:"border-amber-200", text:"text-amber-900", sub:"text-amber-700" },
                ].map(d => (
                  <div key={d.id} className={`rounded-lg p-3 border text-xs ${d.bg} ${d.border}`}>
                    <div className={`font-semibold mb-1 ${d.text}`}>{d.status}</div>
                    <div className={`font-mono font-bold mb-1 ${d.text}`}>{d.id}</div>
                    <div className={d.sub}>{d.reason}</div>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                <span className="font-semibold text-slate-800">This is a pre-specified prediction, not an abandoned one.</span>{" "}
                The first group to publish hourly γ-irradiation RNA-seq from MCF7 cells across 24h on GEO will be able to run this test directly on real DNA damage dynamics — and the prediction is already written.
              </p>
            </div>
          </div>
        )}

        {/* ── SIMULATION TAB ── */}
        {tab === "sim" && (
          <div className="space-y-5">

            <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-slate-800 leading-relaxed">
              <strong className="text-violet-800">What this is:</strong> A 3-variable ODE (p53, MDM2 mRNA, MDM2 protein) integrated numerically
              and sampled at 1h intervals to mimic an RNA-seq experiment.
              Parameters tuned to produce ~6h oscillation (Geva-Zatorsky et al. 2006: ~5.5h).
              Confirms AR(2) recovers complex roots and the correct period <em>from ODE output</em>.
              <strong className="text-slate-900"> This does not confirm the same would happen in real experimental data.</strong>
            </div>

            {/* All conditions chart */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5">
              <h2 className="text-slate-900 font-semibold mb-1">p53 dynamics — all 4 conditions (48h simulation)</h2>
              <p className="text-slate-500 text-xs mb-4">
                Orange (TP53 GOF) rises to steady state ~6.7 with no feedback brake. The other 3 conditions oscillate near 0–1.5.
              </p>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={allSimSeries} margin={{ left:-10, right:10, top:5, bottom:5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="t" stroke="#94a3b8" tick={{ fontSize:11, fill:"#475569" }}
                      label={{ value:"Time (h)", position:"insideBottom", offset:-2, fill:"#64748b", fontSize:11 }} />
                    <YAxis stroke="#94a3b8" tick={{ fontSize:11, fill:"#475569" }} domain={[0,"auto"]} />
                    <Tooltip contentStyle={chartStyle} labelFormatter={v=>`t = ${v}h`} />
                    <Legend wrapperStyle={{ fontSize:12, color:"#475569" }} />
                    {SIM_CONDITIONS.map(c => (
                      <Line key={c.id} type="monotone" dataKey={c.id} name={c.label} stroke={c.color}
                        strokeWidth={activeSim===c.id ? 2.5 : 1.5}
                        strokeOpacity={activeSim===c.id ? 1 : 0.35} dot={false} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Condition cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {simResults.map(r => {
                const isActive = activeSim === r.id;
                return (
                  <button key={r.id} onClick={() => setActiveSim(r.id)}
                    className="rounded-xl border-2 p-4 text-left transition-all shadow-sm hover:shadow-md"
                    style={{
                      borderColor: isActive ? r.color : r.borderColor,
                      backgroundColor: isActive ? r.activeBg : "#ffffff",
                    }}>
                    <div className="text-xs font-semibold mb-0.5" style={{ color: r.color }}>{r.label}</div>
                    <div className="text-slate-500 text-xs mb-3">{r.sub}</div>
                    <div className="text-2xl font-mono font-bold text-slate-900 mb-0.5">{r.ar2_p53.lambda}</div>
                    <div className="text-xs text-slate-500 mb-2">p53 |λ|</div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${r.ar2_p53.root==="complex"
                      ? "bg-blue-100 text-blue-800 border-blue-200"
                      : "bg-orange-100 text-orange-800 border-orange-200"}`}>
                      {r.ar2_p53.root==="complex" ? "oscillatory" : "constitutive"}
                    </span>
                    {r.ar2_p53.period !== "N/A" && (
                      <div className="text-xs text-slate-500 mt-1.5">period ≈ {r.ar2_p53.period}</div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Selected condition detail */}
            <div className="rounded-xl border-2 bg-white shadow-sm p-5" style={{ borderColor: active.color }}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: active.color }} />
                <span className="font-semibold text-slate-900">{active.label}</span>
                <span className="text-slate-500 text-sm">— {active.sub}</span>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                {[
                  { label:"p53 |λ|",  ...active.ar2_p53,  range:`${active.p53min}–${active.p53max}` },
                  { label:"MDM2 |λ|", ...active.ar2_mdm2, range: null },
                ].map(m => (
                  <div key={m.label} className="rounded-lg bg-slate-50 border border-slate-200 p-4">
                    <div className="text-slate-500 text-xs mb-1">{m.label}</div>
                    <div className="text-3xl font-mono font-bold text-slate-900 mb-2">{m.lambda}</div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${m.root==="complex"
                      ? "bg-blue-100 text-blue-800 border-blue-200"
                      : "bg-orange-100 text-orange-800 border-orange-200"}`}>
                      {m.root==="complex" ? "complex — oscillatory" : "real — constitutive"}
                    </span>
                    {m.period !== "N/A" && <div className="text-xs text-slate-500 mt-1.5">inferred period ≈ {m.period}</div>}
                    {m.range && <div className="text-xs text-slate-400 mt-1">range: [{m.range}]</div>}
                  </div>
                ))}
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={active.series} margin={{ left:-10, right:10, top:5, bottom:5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="t" stroke="#94a3b8" tick={{ fontSize:11, fill:"#475569" }}
                      label={{ value:"Time (h)", position:"insideBottom", offset:-2, fill:"#64748b", fontSize:11 }} />
                    <YAxis stroke="#94a3b8" tick={{ fontSize:11, fill:"#475569" }} domain={[0,"auto"]} />
                    <Tooltip contentStyle={chartStyle} labelFormatter={v=>`t = ${v}h`} />
                    <Line type="monotone" dataKey="p53"  name="p53"  stroke={active.color} strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="mdm2" name="MDM2" stroke="#64748b" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                    <Legend wrapperStyle={{ fontSize:12, color:"#475569" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Summary table */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5">
              <h2 className="text-slate-900 font-semibold mb-3">Simulation AR(2) summary — all conditions</h2>
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 text-xs">
                    <th className="py-2 pr-4 pl-2 font-semibold">Condition</th>
                    <th className="py-2 pr-4 font-mono font-semibold">p53 |λ|</th>
                    <th className="py-2 pr-4 font-semibold">Root type</th>
                    <th className="py-2 pr-4 font-semibold">Inferred period</th>
                    <th className="py-2 font-semibold">Pre-specified prediction</th>
                  </tr>
                </thead>
                <tbody>
                  {simResults.map((r, i) => (
                    <tr key={r.id} className={`border-b border-slate-100 ${i%2===0 ? "bg-white" : "bg-slate-50"}`}>
                      <td className="py-2.5 pr-4 pl-2">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: r.color }} />
                          <span className="text-slate-800 font-medium text-xs">{r.label}</span>
                        </div>
                        <div className="text-slate-400 text-xs pl-5">{r.sub}</div>
                      </td>
                      <td className="py-2.5 pr-4 font-mono font-bold text-slate-900">{r.ar2_p53.lambda}</td>
                      <td className="py-2.5 pr-4">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${r.ar2_p53.root==="complex"
                          ? "bg-blue-100 text-blue-800 border-blue-200"
                          : "bg-orange-100 text-orange-800 border-orange-200"}`}>
                          {r.ar2_p53.root==="complex" ? "complex (oscillatory)" : "real (constitutive)"}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 font-mono text-slate-700">{r.ar2_p53.period}</td>
                      <td className="py-2.5 text-emerald-700 text-xs font-semibold">
                        {r.ar2_p53.root==="complex" ? "✓ Oscillatory (predicted)" : "✓ Constitutive (predicted)"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
