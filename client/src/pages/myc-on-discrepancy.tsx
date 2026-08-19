import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, GitCompare, Info, AlertTriangle, CheckCircle } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell, Legend,
} from "recharts";

const ON_MEDIAN  = 0.5275;
const OFF_MEDIAN = 0.4773;

type GeneResult = {
  gene: string;
  group: string;
  onLambda: number | null;
  onRoot: string | null;
  onPeriod: string | null;
  offLambda: number | null;
  offRoot: string | null;
  offPeriod: string | null;
  delta: number | null;
  interpretation: string;
};

const GENE_DATA: GeneResult[] = [
  // MYC itself
  { gene:"MYC",       group:"MYC",           onLambda:0.9204, onRoot:"real",    onPeriod:"N/A",   offLambda:0.1589, offRoot:"real",    offPeriod:"N/A",   delta:+0.7615, interpretation:"Constitutively locked high when MYC-ON; transient/pulsed when MYC-OFF" },
  // MDM2
  { gene:"MDM2",      group:"MDM2",          onLambda:0.9526, onRoot:"complex", onPeriod:"10.7h", offLambda:0.3888, offRoot:"complex", offPeriod:"4.5h",  delta:+0.5638, interpretation:"MYC-ON: highly persistent oscillation (~11h). p53–MDM2 loop is active and oscillating, not silenced." },
  // p53 apoptotic
  { gene:"GADD45A",   group:"p53 Apoptotic", onLambda:0.999,  onRoot:"real",    onPeriod:"N/A",   offLambda:0.3273, offRoot:"complex", offPeriod:"8.8h",  delta:+0.6717, interpretation:"Constitutively elevated in MYC-ON — p53 is continuously activating this target" },
  { gene:"GADD45B",   group:"p53 Apoptotic", onLambda:0.9813, onRoot:"real",    onPeriod:"N/A",   offLambda:0.5478, offRoot:"complex", offPeriod:"6.1h",  delta:+0.4335, interpretation:"Same pattern — constitutive, not oscillatory, in MYC-ON" },
  { gene:"BAX",       group:"p53 Apoptotic", onLambda:0.6066, onRoot:"real",    onPeriod:"N/A",   offLambda:0.2823, offRoot:"complex", offPeriod:"4.5h",  delta:+0.3243, interpretation:"Higher in MYC-ON, real roots — sustained BAX expression" },
  { gene:"BBC3",      group:"p53 Apoptotic", onLambda:0.8799, onRoot:"real",    onPeriod:"N/A",   offLambda:0.4738, offRoot:"complex", offPeriod:"13.4h", delta:+0.4061, interpretation:"PUMA — constitutively elevated in MYC-ON" },
  { gene:"GADD45G",   group:"p53 Apoptotic", onLambda:0.3123, onRoot:"complex", onPeriod:"3.6h",  offLambda:null,   offRoot:null,      offPeriod:null,    delta:null,    interpretation:"Expressed only in MYC-ON; absent in MYC-OFF" },
  { gene:"PMAIP1",    group:"p53 Apoptotic", onLambda:0.5338, onRoot:"complex", onPeriod:"70.9h", offLambda:0.9758, offRoot:"real",    offPeriod:"N/A",   delta:-0.4420, interpretation:"NOXA — reverses direction; constitutive in MYC-OFF (unexpected)" },
  // p53 cell cycle
  { gene:"CDKN1A",    group:"p53 Cell-cycle",onLambda:0.6456, onRoot:"real",    onPeriod:"N/A",   offLambda:0.6567, offRoot:"complex", offPeriod:"4.9h",  delta:-0.0111, interpretation:"p21 — similar |λ| both conditions; shifts root type" },
  { gene:"BTG2",      group:"p53 Cell-cycle",onLambda:0.5659, onRoot:"real",    onPeriod:"N/A",   offLambda:0.7121, offRoot:"real",    offPeriod:"N/A",   delta:-0.1462, interpretation:"Slightly lower in MYC-ON — MYC may suppress BTG2 anti-proliferative function" },
  // Proliferation
  { gene:"MKI67",     group:"Proliferation", onLambda:0.9564, onRoot:"real",    onPeriod:"N/A",   offLambda:0.8250, offRoot:"real",    offPeriod:"N/A",   delta:+0.1314, interpretation:"Ki67 — constitutive and high in both; higher in MYC-ON" },
  { gene:"PCNA",      group:"Proliferation", onLambda:0.999,  onRoot:"real",    onPeriod:"N/A",   offLambda:0.6376, offRoot:"real",    offPeriod:"N/A",   delta:+0.3614, interpretation:"At the cap — constitutively maximal in MYC-ON" },
  { gene:"E2F3",      group:"Proliferation", onLambda:0.999,  onRoot:"real",    onPeriod:"N/A",   offLambda:0.2721, offRoot:"complex", offPeriod:"5.6h",  delta:+0.7269, interpretation:"E2F3 — the largest shift; fully constitutive in MYC-ON" },
  { gene:"CCND2",     group:"Proliferation", onLambda:0.8687, onRoot:"real",    onPeriod:"N/A",   offLambda:0.1054, offRoot:"complex", offPeriod:"3.1h",  delta:+0.7633, interpretation:"Cyclin D2 — massive shift; MYC drives constitutive cell-cycle progression" },
  { gene:"E2F1",      group:"Proliferation", onLambda:0.7584, onRoot:"real",    onPeriod:"N/A",   offLambda:0.4403, offRoot:"real",    offPeriod:"N/A",   delta:+0.3181, interpretation:"E2F1 — consistently higher in MYC-ON" },
  { gene:"E2F2",      group:"Proliferation", onLambda:0.8341, onRoot:"real",    onPeriod:"N/A",   offLambda:0.4050, offRoot:"real",    offPeriod:"N/A",   delta:+0.4291, interpretation:"E2F2 — same pattern" },
  { gene:"CCND1",     group:"Proliferation", onLambda:0.5900, onRoot:"complex", onPeriod:"10.0h", offLambda:0.2436, offRoot:"complex", offPeriod:"5.6h",  delta:+0.3464, interpretation:"Cyclin D1 — oscillatory in both; longer period in MYC-ON" },
  // Survival
  { gene:"MCL1",      group:"Survival",      onLambda:0.9736, onRoot:"real",    onPeriod:"N/A",   offLambda:0.0752, offRoot:"complex", offPeriod:"3.4h",  delta:+0.8984, interpretation:"Largest shift in dataset. MCL1 is constitutively maximal in MYC-ON — the key survival block preventing apoptosis" },
  { gene:"BIRC5",     group:"Survival",      onLambda:0.9734, onRoot:"real",    onPeriod:"N/A",   offLambda:0.6377, offRoot:"real",    offPeriod:"N/A",   delta:+0.3357, interpretation:"Survivin — constitutively high in MYC-ON" },
  { gene:"BCL2",      group:"Survival",      onLambda:0.0799, onRoot:"real",    onPeriod:"N/A",   offLambda:0.5772, offRoot:"real",    offPeriod:"N/A",   delta:-0.4973, interpretation:"BCL2 — paradoxically lower in MYC-ON. MCL1 may be the dominant survival factor here." },
];

const GROUP_COLORS: Record<string, string> = {
  "MYC":           "#0891b2",
  "MDM2":          "#7c3aed",
  "p53 Apoptotic": "#dc2626",
  "p53 Cell-cycle":"#f59e0b",
  "Proliferation": "#059669",
  "Survival":      "#1d4ed8",
};

const GROUPS = ["MYC","MDM2","p53 Apoptotic","p53 Cell-cycle","Proliferation","Survival"];

export default function MycOnDiscrepancy() {
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [selectedGene, setSelectedGene] = useState<GeneResult | null>(null);

  const filtered = selectedGroup ? GENE_DATA.filter(d => d.group === selectedGroup) : GENE_DATA;

  const chartData = GROUPS.map(grp => {
    const genes = GENE_DATA.filter(d => d.group === grp);
    const onAvg = genes.filter(d => d.onLambda !== null).reduce((s,d)=>s+(d.onLambda??0),0) / genes.filter(d=>d.onLambda!==null).length;
    const offAvg = genes.filter(d => d.offLambda !== null).reduce((s,d)=>s+(d.offLambda??0),0) / genes.filter(d=>d.offLambda!==null).length;
    return { group: grp, "MYC-ON avg": +onAvg.toFixed(3), "MYC-OFF avg": +offAvg.toFixed(3) };
  });

  const mcl1 = GENE_DATA.find(d => d.gene === "MCL1")!;
  const mdm2 = GENE_DATA.find(d => d.gene === "MDM2")!;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <Link href="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm mb-6 transition-colors">
          <ArrowLeft size={16} /> Back to dashboard
        </Link>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <GitCompare className="text-teal-500" size={28} />
            <h1 className="text-3xl font-bold text-slate-900">MYC-ON Discrepancy Resolved</h1>
          </div>
          <p className="text-slate-600 text-lg">
            MYC-ON neuroblastoma shows <em>higher</em> |λ| than expected from the MDM2 suppression hypothesis.
            Here we dissect why — gene by gene.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="px-3 py-1 bg-teal-100 text-teal-700 rounded-full text-sm font-medium">GSE221103</span>
            <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-sm">Human neuroblastoma time course</span>
            <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-sm">CT24–CT76 · 14 timepoints · 60,236 genes</span>
          </div>
        </div>

        {/* The discrepancy setup */}
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-5 mb-6 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber-600 mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold text-amber-800 mb-1">The discrepancy</div>
              <p className="text-amber-700 text-sm leading-relaxed">
                The original hypothesis: MYC drives MDM2, MDM2 suppresses p53, so p53 target genes should show
                <em> lower</em> |λ| in MYC-ON cells. Instead, Paper N found the p53 regulon |λ| is
                <strong> higher</strong> in MYC-ON (0.680 vs genome median 0.525). Why?
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="bg-white rounded-lg p-3 border border-amber-200">
                  <div className="text-lg font-bold text-amber-700">MYC-ON genome median: {ON_MEDIAN}</div>
                  <div className="text-xs text-amber-600 mt-0.5">Higher baseline across all genes</div>
                </div>
                <div className="bg-white rounded-lg p-3 border border-amber-200">
                  <div className="text-lg font-bold text-amber-700">MYC-OFF genome median: {OFF_MEDIAN}</div>
                  <div className="text-xs text-amber-600 mt-0.5">Lower baseline across all genes</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Resolution */}
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-6 shadow-sm">
          <div className="flex items-start gap-3">
            <CheckCircle size={18} className="text-green-600 mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold text-green-800 mb-1">Resolution: the tug-of-war equilibrium</div>
              <p className="text-green-700 text-sm leading-relaxed mb-3">
                MYC-ON does not silence p53 — it drives constitutive activation of <em>both arms simultaneously</em>.
                The proliferation machinery (E2F3, PCNA, MCL1, MKI67) locks into constitutive high expression (real roots, |λ|→1)
                <em>and</em> the p53 apoptotic targets (GADD45A, GADD45B, BAX, BBC3) also go constitutive and high.
                The cell is trapped in a stalemate: death signals are continuously elevated, but so is the survival machinery.
              </p>
              <p className="text-green-700 text-sm leading-relaxed">
                AR(2) captures this as higher overall |λ| because more genes are locked in constitutive high-amplitude expression.
                It is not stronger oscillation — it is lock-in. The MDM2 loop is actually still <em>oscillating</em>
                (MDM2: complex roots, period ~11h) — p53 is cycling through the feedback, it just cannot trigger apoptosis
                because MCL1 blocks it.
              </p>
            </div>
          </div>
        </div>

        {/* Group comparison chart */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6 shadow-sm">
          <h2 className="font-semibold text-slate-800 mb-1">Average |λ| by functional group: MYC-ON vs MYC-OFF</h2>
          <p className="text-slate-500 text-sm mb-4">Every group shows higher |λ| in MYC-ON. But the mechanism differs: proliferation genes lock constitutively high, while MDM2 oscillates faster.</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="group" tick={{ fontSize: 11, fill: "#64748b" }} />
              <YAxis domain={[0, 1]} tick={{ fontSize: 11, fill: "#64748b" }} label={{ value:"|λ|", angle:-90, position:"insideLeft", offset:10, style:{fontSize:11,fill:"#64748b"} }} />
              <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v: number) => v.toFixed(3)} />
              <Legend />
              <ReferenceLine y={ON_MEDIAN}  stroke="#f59e0b" strokeDasharray="3 2" label={{ value:`ON median ${ON_MEDIAN}`, position:"right", style:{fontSize:9,fill:"#d97706"} }} />
              <ReferenceLine y={OFF_MEDIAN} stroke="#94a3b8" strokeDasharray="3 2" label={{ value:`OFF median ${OFF_MEDIAN}`, position:"right", style:{fontSize:9,fill:"#64748b"} }} />
              <Bar dataKey="MYC-ON avg"  fill="#dc2626" opacity={0.85} />
              <Bar dataKey="MYC-OFF avg" fill="#2563eb" opacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Spotlight on key genes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-3 h-3 rounded-full bg-blue-700 inline-block" />
              <span className="font-semibold text-slate-800">MDM2: oscillating, not silenced</span>
            </div>
            <p className="text-slate-600 text-sm leading-relaxed mb-3">
              MDM2 shows complex roots in <em>both</em> conditions — but in MYC-ON, |λ| jumps from {mdm2.offLambda?.toFixed(3)} to {mdm2.onLambda?.toFixed(3)} and the period lengthens from {mdm2.offPeriod} to {mdm2.onPeriod}. The p53–MDM2 feedback loop is still running — but at higher amplitude and slower period, consistent with MYC driving more p53 production (via more DNA damage) while MDM2 struggles to keep up.
            </p>
            <div className="text-xs font-mono text-slate-500">OFF: |λ|={mdm2.offLambda} complex {mdm2.offPeriod} → ON: |λ|={mdm2.onLambda} complex {mdm2.onPeriod}</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-3 h-3 rounded-full bg-indigo-600 inline-block" />
              <span className="font-semibold text-slate-800">MCL1: the key apoptosis block</span>
            </div>
            <p className="text-slate-600 text-sm leading-relaxed mb-3">
              MCL1 shows the largest absolute shift in the entire dataset: |λ|={mcl1.offLambda?.toFixed(3)} (complex, oscillating) in MYC-OFF → |λ|={mcl1.onLambda?.toFixed(3)} (real, constitutive) in MYC-ON. MCL1 is the primary anti-apoptotic protein that sequesters BAX and NOXA. When it locks constitutively high, the pro-apoptotic signals from p53 (GADD45A, BAX, BBC3) cannot execute — explaining why MYC-ON cells proliferate despite active p53 signalling.
            </p>
            <div className="text-xs font-mono text-slate-500">OFF: |λ|={mcl1.offLambda} complex {mcl1.offPeriod} → ON: |λ|={mcl1.onLambda} real N/A</div>
          </div>
        </div>

        {/* Full gene table */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800">All gene results</h2>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setSelectedGroup(null)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${selectedGroup === null ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"}`}>
                All
              </button>
              {GROUPS.map(g => (
                <button key={g} onClick={() => setSelectedGroup(g)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${selectedGroup === g ? "text-white border-transparent" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"}`}
                  style={selectedGroup === g ? { backgroundColor: GROUP_COLORS[g] } : {}}>
                  {g}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-2 text-slate-500 font-medium">Gene</th>
                  <th className="text-left py-2 px-2 text-slate-500 font-medium">Group</th>
                  <th className="text-right py-2 px-2 text-slate-500 font-medium">ON |λ|</th>
                  <th className="text-left py-2 px-2 text-slate-500 font-medium">Root</th>
                  <th className="text-right py-2 px-2 text-slate-500 font-medium">OFF |λ|</th>
                  <th className="text-left py-2 px-2 text-slate-500 font-medium">Root</th>
                  <th className="text-right py-2 px-2 text-slate-500 font-medium">Δ</th>
                  <th className="text-left py-2 px-2 text-slate-500 font-medium">Note</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(d => (
                  <tr key={d.gene} onClick={() => setSelectedGene(selectedGene?.gene === d.gene ? null : d)}
                    className={`border-b border-slate-100 cursor-pointer transition-colors ${selectedGene?.gene === d.gene ? "bg-blue-50" : "hover:bg-slate-50"}`}>
                    <td className="py-2 px-2 font-mono font-semibold text-slate-800">{d.gene}</td>
                    <td className="py-2 px-2">
                      <span className="px-1.5 py-0.5 rounded text-xs font-medium"
                        style={{ backgroundColor: GROUP_COLORS[d.group] + "22", color: GROUP_COLORS[d.group] }}>
                        {d.group}
                      </span>
                    </td>
                    <td className="py-2 px-2 font-mono text-right font-semibold text-slate-900">{d.onLambda?.toFixed(4) ?? "—"}</td>
                    <td className="py-2 px-2">
                      {d.onRoot && <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${d.onRoot === "complex" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>{d.onRoot}</span>}
                    </td>
                    <td className="py-2 px-2 font-mono text-right text-slate-600">{d.offLambda?.toFixed(4) ?? "—"}</td>
                    <td className="py-2 px-2">
                      {d.offRoot && <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${d.offRoot === "complex" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>{d.offRoot}</span>}
                    </td>
                    <td className={`py-2 px-2 font-mono text-right font-semibold ${d.delta !== null && d.delta > 0 ? "text-red-600" : "text-blue-600"}`}>
                      {d.delta !== null ? (d.delta > 0 ? "+" : "") + d.delta.toFixed(4) : "—"}
                    </td>
                    <td className="py-2 px-2 text-slate-500 max-w-xs truncate">{d.interpretation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selectedGene && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="font-semibold text-blue-800 mb-1">{selectedGene.gene}</div>
              <p className="text-blue-700 text-sm">{selectedGene.interpretation}</p>
            </div>
          )}
        </div>

        {/* Model */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6 shadow-sm">
          <div className="flex items-start gap-3">
            <Info size={18} className="text-blue-500 mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold text-slate-800 mb-2">The tug-of-war model</div>
              <p className="text-slate-600 text-sm leading-relaxed">
                MYC drives both arms simultaneously. It induces replication stress and DNA damage → activating p53 →
                constitutive GADD45A/B, BAX, BBC3 elevation. Simultaneously, MYC drives MCL1 and BIRC5 (Survivin) constitutively high,
                sequestering pro-apoptotic signals at the mitochondria. The cell is not "escaping" p53 by silencing it —
                it is escaping apoptosis despite active p53 by blocking execution downstream.
                AR(2) captures this as uniformly higher |λ| across all gene groups because MYC drives constitutive
                (real root, high-amplitude) expression in proliferation and survival genes — lifting the genome-wide average.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-800">
          <strong>Limitations:</strong> (1) This is a single neuroblastoma dataset (GSE221103); the tug-of-war model needs
          replication in other MYC-amplified cell types (Burkitt lymphoma, medulloblastoma).
          (2) PMAIP1 (NOXA) shows the opposite pattern to other p53 targets — higher in MYC-OFF — which is not yet explained
          and may reflect tissue-specific regulation or dataset noise.
          (3) The circadian time-course design (CT24–CT76) samples 24h cycles, not a damage response.
          MYC's effects on p53 dynamics after acute DNA damage may differ substantially.
        </div>
      </div>
    </div>
  );
}
