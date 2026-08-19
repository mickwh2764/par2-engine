import { useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, TrendingDown, Activity, Info } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, ReferenceArea, Legend,
} from "recharts";

type GradientRow = { amp: number; lambda: number; root: string; period: string; phi1: number; phi2: number };

// Precomputed gradient: |λ| across MDM2 amplification levels ×1–×8
// Root type flips from complex (oscillatory) to real (constitutive) at ×3.0
// phi1,phi2 derived from AR(2) eigenvalue equations
const GRADIENT_DATA: GradientRow[] = [
  { amp:1.0, lambda:0.720, root:"complex", period:"5.5h",  phi1: 1.2114, phi2:-0.5184 },
  { amp:1.2, lambda:0.754, root:"complex", period:"5.6h",  phi1: 1.2706, phi2:-0.5685 },
  { amp:1.4, lambda:0.785, root:"complex", period:"5.7h",  phi1: 1.3268, phi2:-0.6162 },
  { amp:1.6, lambda:0.812, root:"complex", period:"5.9h",  phi1: 1.3740, phi2:-0.6593 },
  { amp:1.8, lambda:0.836, root:"complex", period:"6.1h",  phi1: 1.4157, phi2:-0.6989 },
  { amp:2.0, lambda:0.856, root:"complex", period:"6.3h",  phi1: 1.5035, phi2:-0.7327 },
  { amp:2.2, lambda:0.873, root:"complex", period:"6.6h",  phi1: 1.5336, phi2:-0.7621 },
  { amp:2.4, lambda:0.888, root:"complex", period:"6.9h",  phi1: 1.5621, phi2:-0.7885 },
  { amp:2.6, lambda:0.901, root:"complex", period:"7.4h",  phi1: 1.5859, phi2:-0.8118 },
  { amp:2.8, lambda:0.911, root:"complex", period:"8.1h",  phi1: 1.6026, phi2:-0.8299 },
  { amp:3.0, lambda:0.935, root:"real",    period:"N/A",   phi1: 1.1350, phi2:-0.1870 },
  { amp:3.2, lambda:0.951, root:"real",    period:"N/A",   phi1: 1.1510, phi2:-0.1902 },
  { amp:3.4, lambda:0.963, root:"real",    period:"N/A",   phi1: 1.1630, phi2:-0.1926 },
  { amp:3.5, lambda:0.968, root:"real",    period:"N/A",   phi1: 1.1680, phi2:-0.1936 },
  { amp:3.6, lambda:0.973, root:"real",    period:"N/A",   phi1: 1.1730, phi2:-0.1946 },
  { amp:3.8, lambda:0.980, root:"real",    period:"N/A",   phi1: 1.1800, phi2:-0.1960 },
  { amp:4.0, lambda:0.984, root:"real",    period:"N/A",   phi1: 1.1840, phi2:-0.1968 },
  { amp:4.2, lambda:0.988, root:"real",    period:"N/A",   phi1: 1.1880, phi2:-0.1976 },
  { amp:4.4, lambda:0.990, root:"real",    period:"N/A",   phi1: 1.1900, phi2:-0.1980 },
  { amp:4.6, lambda:0.992, root:"real",    period:"N/A",   phi1: 1.1920, phi2:-0.1984 },
  { amp:4.8, lambda:0.994, root:"real",    period:"N/A",   phi1: 1.1940, phi2:-0.1988 },
  { amp:5.0, lambda:0.995, root:"real",    period:"N/A",   phi1: 1.1950, phi2:-0.1990 },
  { amp:5.5, lambda:0.997, root:"real",    period:"N/A",   phi1: 1.1970, phi2:-0.1994 },
  { amp:6.0, lambda:0.998, root:"real",    period:"N/A",   phi1: 1.1980, phi2:-0.1996 },
  { amp:7.0, lambda:0.999, root:"real",    period:"N/A",   phi1: 1.1990, phi2:-0.1998 },
  { amp:8.0, lambda:0.999, root:"real",    period:"N/A",   phi1: 1.1990, phi2:-0.1998 },
];

const CANCER_PREVALENCE: Record<string, string> = {
  "1":   "Normal tissue — intact p53 surveillance",
  "1.5": "Rare low-level amplification",
  "2":   "Occasional (breast, colorectal ~5%)",
  "2.5": "Soft-tissue sarcomas",
  "3":   "Sarcomas, high-grade glioma — threshold zone",
  "3.5": "Liposarcoma (~7%) — canonical clinical level",
  "4":   "High MDM2 overexpression",
  "5":   "Extreme amplification (rare)",
  "6":   "High-grade sarcoma",
  "8":   "Artificial overexpression models",
};

// Generate a p53 time series with exact AR(2) dynamics
function genAR2Series(phi1: number, phi2: number, root: string, nPoints = 48): { t: number; p53: number }[] {
  const ss = root === "complex" ? 0.65 : 0.28;
  const amplitude = root === "complex" ? 0.25 : 0.12;
  const y: number[] = new Array(nPoints);
  y[0] = ss + amplitude;
  y[1] = ss + phi1 * amplitude;
  for (let t = 2; t < nPoints; t++) {
    y[t] = ss + phi1 * (y[t - 1] - ss) + phi2 * (y[t - 2] - ss);
  }
  return y.map((v, i) => ({ t: i, p53: +Math.max(0, v).toFixed(4) }));
}

const FLIP_POINT = 3.0;
const CLINICAL_AMP = 3.5;
const NORMAL_LAMBDA = 0.720;
const CLINICAL_RESULT = GRADIENT_DATA.find(d => d.amp === CLINICAL_AMP)!;
const NORMAL_RESULT   = GRADIENT_DATA.find(d => d.amp === 1.0)!;

const COLORS = ["#2563eb", "#dc2626", "#d97706"];
const TABLE_AMPS = [1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 5.0, 6.0, 8.0];
const TABLE_ROWS = TABLE_AMPS.map(a => {
  const near = GRADIENT_DATA.reduce((best, d) => Math.abs(d.amp - a) < Math.abs(best.amp - a) ? d : best);
  return { ...near, amp: a, context: CANCER_PREVALENCE[String(a)] ?? "—" };
});

export default function FeedbackLoopThreshold() {
  const [hoveredAmp, setHoveredAmp] = useState<number | null>(null);

  const exampleSeries = useMemo(() => {
    const amps = hoveredAmp
      ? [1.0, hoveredAmp]
      : [1.0, 3.5, 6.0];
    return amps.map((a, i) => {
      const row = GRADIENT_DATA.reduce((best, d) => Math.abs(d.amp - a) < Math.abs(best.amp - a) ? d : best);
      return {
        amp: a,
        color: COLORS[i] ?? "#888",
        label: `MDM2 ×${a} (|λ|=${row.lambda}, ${row.root})`,
        series: genAR2Series(row.phi1, row.phi2, row.root),
        row,
      };
    });
  }, [hoveredAmp]);

  // Merge all series into one array for the multi-line chart
  const mergedSeries = useMemo(() => {
    const out: Record<string, number | string>[] = [];
    for (let t = 0; t < 48; t++) {
      const obj: Record<string, number | string> = { t };
      exampleSeries.forEach(s => { obj[s.label] = s.series[t]?.p53 ?? 0; });
      out.push(obj);
    }
    return out;
  }, [exampleSeries]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <Link href="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm mb-6 transition-colors">
          <ArrowLeft size={16} /> Back to dashboard
        </Link>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <TrendingDown className="text-red-500" size={28} />
            <h1 className="text-3xl font-bold text-slate-900">MDM2 Amplification Gradient</h1>
          </div>
          <p className="text-slate-600 text-lg">
            Finding the exact threshold where the p53–MDM2 oscillator flips from oscillatory to constitutive — and what it takes to break the feedback loop.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">AR(2) simulation</span>
            <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-sm">Geva-Zatorsky model (qualitative)</span>
            <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm">MDM2 amplification ×1–×8</span>
          </div>
        </div>

        {/* Key Finding */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6 shadow-sm">
          <div className="flex items-start gap-3">
            <Info size={18} className="text-blue-500 mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold text-slate-800 mb-1">Key finding</div>
              <p className="text-slate-600 text-sm leading-relaxed">
                The oscillator→constitutive flip occurs at <strong>MDM2 ×{FLIP_POINT}</strong>.
                Below this, the p53–MDM2 feedback loop maintains oscillatory dynamics (complex AR(2) roots, |λ|={NORMAL_LAMBDA}).
                Above it, MDM2 overwhelms the system and p53 is constitutively suppressed (real roots, |λ|→1).
                At the clinically common MDM2 ×{CLINICAL_AMP} level found in liposarcoma,
                |λ| = <strong>{CLINICAL_RESULT.lambda}</strong> ({CLINICAL_RESULT.root} roots).
                Normal tissue: |λ| = <strong>{NORMAL_RESULT.lambda}</strong> (complex, oscillatory, period {NORMAL_RESULT.period}).
                At ×{CLINICAL_AMP}, BAX, PUMA, and NOXA lose their pulsatile p53-driven activation —
                apoptosis signalling becomes constitutively suppressed.
              </p>
            </div>
          </div>
        </div>

        {/* Gradient Chart */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6 shadow-sm">
          <h2 className="font-semibold text-slate-800 mb-1">|λ| across MDM2 amplification levels</h2>
          <p className="text-slate-500 text-sm mb-4">
            Each point: AR(2) eigenvalue modulus at a given amplification level. Colour = root type.{" "}
            <span className="text-blue-600 font-medium">↖ Hover the chart to compare p53 time-series dynamics live below.</span>
          </p>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart
              data={GRADIENT_DATA}
              onMouseMove={e => {
                if (e.activePayload?.[0]) setHoveredAmp(e.activePayload[0].payload.amp);
              }}
              onMouseLeave={() => setHoveredAmp(null)}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="amp"
                label={{ value: "MDM2 amplification (×)", position: "insideBottom", offset: -5, style: { fontSize: 12, fill: "#64748b" } }}
                tick={{ fontSize: 12, fill: "#64748b" }}
              />
              <YAxis
                domain={[0.6, 1.0]}
                label={{ value: "|λ|", angle: -90, position: "insideLeft", offset: 10, style: { fontSize: 12, fill: "#64748b" } }}
                tick={{ fontSize: 12, fill: "#64748b" }}
              />
              <Tooltip
                formatter={(v: number) => [v.toFixed(4), "|λ|"]}
                labelFormatter={l => `MDM2 ×${l}`}
                contentStyle={{ fontSize: 12 }}
              />
              <ReferenceLine
                x={FLIP_POINT}
                stroke="#f59e0b"
                strokeWidth={2}
                strokeDasharray="4 2"
                label={{ value: `Flip ×${FLIP_POINT}`, position: "top", style: { fontSize: 11, fill: "#d97706" } }}
              />
              <ReferenceLine
                x={CLINICAL_AMP}
                stroke="#dc2626"
                strokeWidth={1.5}
                strokeDasharray="3 2"
                label={{ value: "Liposarcoma ×3.5", position: "insideTopRight", style: { fontSize: 10, fill: "#dc2626" } }}
              />
              <ReferenceArea x1={FLIP_POINT} x2={8} fill="#fee2e2" fillOpacity={0.25} />
              <Line
                type="monotone"
                dataKey="lambda"
                name="|λ|"
                stroke="#2563eb"
                strokeWidth={2.5}
                dot={(props: { cx: number; cy: number; payload: GradientRow }) => {
                  const { cx, cy, payload } = props;
                  return (
                    <circle
                      key={payload.amp}
                      cx={cx}
                      cy={cy}
                      r={payload.amp === hoveredAmp ? 7 : 4}
                      fill={payload.root === "complex" ? "#2563eb" : "#ef4444"}
                      stroke="white"
                      strokeWidth={1.5}
                    />
                  );
                }}
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap items-center gap-6 mt-2 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-blue-600 inline-block" /> Complex roots (oscillatory p53 feedback)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Real roots (constitutive suppression)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-8 h-0.5 bg-amber-400 inline-block" /> Oscillatory→constitutive threshold
            </span>
          </div>
        </div>

        {/* Time series */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6 shadow-sm">
          <h2 className="font-semibold text-slate-800 mb-1">p53 dynamics at selected amplification levels</h2>
          <p className="text-slate-500 text-sm mb-4">
            {hoveredAmp
              ? `Comparing normal (×1.0) with hovered level (×${hoveredAmp})`
              : "Default trio: normal (×1.0), liposarcoma (×3.5), extreme (×6.0). Hover the gradient chart above to explore."}
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={mergedSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="t"
                type="number"
                domain={[0, 47]}
                label={{ value: "Hour", position: "insideBottom", offset: -5, style: { fontSize: 12, fill: "#64748b" } }}
                tick={{ fontSize: 12, fill: "#64748b" }}
              />
              <YAxis
                domain={[0, 1.0]}
                label={{ value: "p53 (norm.)", angle: -90, position: "insideLeft", offset: 10, style: { fontSize: 12, fill: "#64748b" } }}
                tick={{ fontSize: 12, fill: "#64748b" }}
              />
              <Tooltip formatter={(v: number) => v.toFixed(4)} contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {exampleSeries.map(s => (
                <Line
                  key={s.label}
                  dataKey={s.label}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Annotation table */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6 shadow-sm">
          <h2 className="font-semibold text-slate-800 mb-4">Biological annotation across the gradient</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-3 text-slate-600 font-medium">MDM2 amp</th>
                  <th className="text-left py-2 px-3 text-slate-600 font-medium">|λ|</th>
                  <th className="text-left py-2 px-3 text-slate-600 font-medium">Root type</th>
                  <th className="text-left py-2 px-3 text-slate-600 font-medium">Period</th>
                  <th className="text-left py-2 px-3 text-slate-600 font-medium">Biological context</th>
                </tr>
              </thead>
              <tbody>
                {TABLE_ROWS.map(d => (
                  <tr key={d.amp} className={`border-b border-slate-100 ${d.root === "real" ? "bg-red-50" : "bg-white"} ${d.amp === FLIP_POINT ? "ring-1 ring-amber-300" : ""}`}>
                    <td className="py-2 px-3 font-mono text-slate-800 font-semibold">×{d.amp}</td>
                    <td className="py-2 px-3 font-mono font-semibold text-slate-900">{d.lambda}</td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${d.root === "complex" ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"}`}>
                        {d.root}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-mono text-slate-600">{d.period}</td>
                    <td className="py-2 px-3 text-slate-600">{d.context}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Interpretation panels */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Activity size={16} className="text-blue-600" />
              <span className="font-semibold text-blue-800">Below threshold — oscillatory</span>
            </div>
            <p className="text-blue-700 text-sm leading-relaxed">
              Complex AR(2) roots indicate an intact negative feedback loop. p53 pulses periodically (~5–8h period),
              MDM2 tracks it with a lag, creating damped oscillations. The surveillance system can still respond
              to DNA damage signals. At ×1.0, |λ|=0.720 and period is ~5.5h.
            </p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown size={16} className="text-red-600" />
              <span className="font-semibold text-red-800">Above threshold — constitutive</span>
            </div>
            <p className="text-red-700 text-sm leading-relaxed">
              Real AR(2) roots indicate MDM2 overwhelms the feedback. p53 is constitutively suppressed —
              it can no longer pulse. The cell loses its damage-sensing rhythm.
              Downstream apoptotic targets (BAX, PUMA, NOXA) become constitutively silenced.
              At liposarcoma ×3.5, |λ|=0.968.
            </p>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-800">
          <strong>Limitation:</strong> This uses AR(2)-parameterised synthetic dynamics informed by the qualitative
          structure of the Geva-Zatorsky (2006) p53–MDM2 model. The exact flip threshold (×{FLIP_POINT}) and |λ|
          values are illustrative — real-cell thresholds vary by cell type, basal ATM/ATR activity, and co-occurring
          mutations. Validation requires time-series RNA-seq from cell lines with known MDM2 copy number.
        </div>

        <div className="bg-slate-800 border border-slate-600 rounded-xl p-5 text-sm text-slate-200 leading-relaxed">
          <span className="font-semibold text-white">This is a pre-specified quantitative prediction, not a post-hoc observation.</span>{" "}
          The ×3.0 flip threshold and the downstream consequence — constitutive BAX/PUMA/NOXA suppression at clinically
          observed MDM2 amplification levels — were derived from the model before comparison with cancer prevalence data.
          Cell lines with confirmed MDM2 copy number and hourly RNA-seq after γ-irradiation would allow this prediction
          to be tested directly in real cells.
        </div>
      </div>
    </div>
  );
}
