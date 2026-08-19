import { useState, useEffect } from "react";
import { Link } from "wouter";
import { ArrowLeft, Map, Info } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell, Legend,
} from "recharts";

type GeneEntry = { lambda: number; root: string; period: string };
type TissueRecord = { tissue: string; median: number; nGenes: number; genes: Record<string, GeneEntry> };

const TISSUE_DATA: TissueRecord[] = [
  { tissue:"Adrenal",      median:0.4167, nGenes:20955, genes:{ "Mdm2":{lambda:0.1906,root:"real",period:"N/A"}, "Bax":{lambda:0.1958,root:"real",period:"N/A"}, "Gadd45a":{lambda:0.4404,root:"real",period:"N/A"}, "Gadd45g":{lambda:0.2808,root:"complex",period:"4.6h"}, "Pmaip1":{lambda:0.5464,root:"complex",period:"3.2h"}, "Fas":{lambda:0.5647,root:"complex",period:"4.0h"}, "Bbc3":{lambda:0.3842,root:"real",period:"N/A"}, "Btg2":{lambda:0.5604,root:"real",period:"N/A"}, "Birc5":{lambda:0.4687,root:"complex",period:"3.8h"}, "Per2":{lambda:0.6307,root:"real",period:"N/A"}, "Dbp":{lambda:0.8133,root:"complex",period:"9.9h"}, "Nr1d1":{lambda:0.8068,root:"complex",period:"10.2h"}, "Arntl":{lambda:0.8408,root:"complex",period:"10.7h"}, "Cry1":{lambda:0.5769,root:"real",period:"N/A"} }},
  { tissue:"Aorta",        median:0.4189, nGenes:20955, genes:{ "Mdm2":{lambda:0.4215,root:"real",period:"N/A"}, "Bax":{lambda:0.5139,root:"complex",period:"4.9h"}, "Gadd45a":{lambda:0.4239,root:"complex",period:"4.5h"}, "Gadd45g":{lambda:0.3331,root:"real",period:"N/A"}, "Pmaip1":{lambda:0.2503,root:"complex",period:"2.8h"}, "Fas":{lambda:0.3125,root:"real",period:"N/A"}, "Bbc3":{lambda:0.5170,root:"complex",period:"3.3h"}, "Btg2":{lambda:0.6322,root:"complex",period:"4.1h"}, "Birc5":{lambda:0.4595,root:"complex",period:"4.1h"}, "Per2":{lambda:0.8153,root:"complex",period:"10.0h"}, "Dbp":{lambda:0.8031,root:"complex",period:"10.0h"}, "Nr1d1":{lambda:0.8493,root:"complex",period:"10.4h"}, "Arntl":{lambda:0.7826,root:"complex",period:"10.9h"}, "Cry1":{lambda:0.6657,root:"complex",period:"8.4h"} }},
  { tissue:"Brainstem",    median:0.4402, nGenes:20955, genes:{ "Mdm2":{lambda:0.6511,root:"real",period:"N/A"}, "Bax":{lambda:0.1355,root:"complex",period:"7.3h"}, "Gadd45a":{lambda:0.5083,root:"complex",period:"4.1h"}, "Gadd45g":{lambda:0.5746,root:"complex",period:"5.2h"}, "Pmaip1":{lambda:0.3944,root:"complex",period:"4.1h"}, "Fas":{lambda:0.4116,root:"complex",period:"3.6h"}, "Bbc3":{lambda:0.5591,root:"real",period:"N/A"}, "Btg2":{lambda:0.2792,root:"real",period:"N/A"}, "Birc5":{lambda:0.2040,root:"complex",period:"4.0h"}, "Per2":{lambda:0.6271,root:"complex",period:"11.4h"}, "Dbp":{lambda:0.8280,root:"complex",period:"10.5h"}, "Nr1d1":{lambda:0.7930,root:"complex",period:"10.2h"}, "Arntl":{lambda:0.5550,root:"complex",period:"13.9h"}, "Cry1":{lambda:0.2484,root:"complex",period:"42.0h"} }},
  { tissue:"Brown_Fat",    median:0.4226, nGenes:20955, genes:{ "Mdm2":{lambda:0.2030,root:"complex",period:"3.5h"}, "Bax":{lambda:0.1819,root:"complex",period:"2.6h"}, "Gadd45a":{lambda:0.2515,root:"complex",period:"5.9h"}, "Gadd45g":{lambda:0.5624,root:"real",period:"N/A"}, "Pmaip1":{lambda:0.4664,root:"real",period:"N/A"}, "Fas":{lambda:0.3750,root:"real",period:"N/A"}, "Bbc3":{lambda:0.2074,root:"complex",period:"3.0h"}, "Btg2":{lambda:0.3400,root:"complex",period:"5.6h"}, "Birc5":{lambda:0.3214,root:"real",period:"N/A"}, "Per2":{lambda:0.7941,root:"complex",period:"9.9h"}, "Dbp":{lambda:0.8723,root:"complex",period:"10.8h"}, "Nr1d1":{lambda:0.8493,root:"complex",period:"10.4h"}, "Arntl":{lambda:0.7179,root:"complex",period:"11.6h"}, "Cry1":{lambda:0.6263,root:"real",period:"N/A"} }},
  { tissue:"Cerebellum",  median:0.4404, nGenes:20955, genes:{ "Mdm2":{lambda:0.3941,root:"real",period:"N/A"}, "Bax":{lambda:0.5357,root:"real",period:"N/A"}, "Gadd45a":{lambda:0.4208,root:"complex",period:"2.8h"}, "Gadd45g":{lambda:0.3786,root:"complex",period:"7.1h"}, "Pmaip1":{lambda:0.4268,root:"complex",period:"3.3h"}, "Fas":{lambda:0.6521,root:"real",period:"N/A"}, "Bbc3":{lambda:0.3040,root:"complex",period:"4.1h"}, "Btg2":{lambda:0.3800,root:"complex",period:"4.8h"}, "Birc5":{lambda:0.4296,root:"complex",period:"3.8h"}, "Per2":{lambda:0.6185,root:"complex",period:"10.6h"}, "Dbp":{lambda:0.5652,root:"complex",period:"13.3h"}, "Nr1d1":{lambda:0.4713,root:"real",period:"N/A"}, "Arntl":{lambda:0.6424,root:"complex",period:"12.6h"}, "Cry1":{lambda:0.6458,root:"real",period:"N/A"} }},
  { tissue:"Heart",        median:0.4377, nGenes:20955, genes:{ "Mdm2":{lambda:0.4241,root:"complex",period:"4.9h"}, "Bax":{lambda:0.2680,root:"real",period:"N/A"}, "Gadd45a":{lambda:0.7360,root:"real",period:"N/A"}, "Gadd45g":{lambda:0.7200,root:"complex",period:"6.8h"}, "Pmaip1":{lambda:0.3702,root:"complex",period:"5.6h"}, "Fas":{lambda:0.4020,root:"complex",period:"4.1h"}, "Bbc3":{lambda:0.3024,root:"complex",period:"4.7h"}, "Btg2":{lambda:0.5068,root:"complex",period:"4.1h"}, "Birc5":{lambda:0.4160,root:"real",period:"N/A"}, "Per2":{lambda:0.7796,root:"complex",period:"10.5h"}, "Dbp":{lambda:0.8524,root:"complex",period:"10.1h"}, "Nr1d1":{lambda:0.8402,root:"complex",period:"9.7h"}, "Arntl":{lambda:0.7262,root:"complex",period:"11.3h"}, "Cry1":{lambda:0.5848,root:"complex",period:"9.4h"} }},
  { tissue:"Hypothalamus", median:0.4003, nGenes:20955, genes:{ "Mdm2":{lambda:0.4712,root:"real",period:"N/A"}, "Bax":{lambda:0.4335,root:"real",period:"N/A"}, "Gadd45a":{lambda:0.2803,root:"complex",period:"3.8h"}, "Gadd45g":{lambda:0.0820,root:"complex",period:"4.4h"}, "Pmaip1":{lambda:0.5651,root:"real",period:"N/A"}, "Fas":{lambda:0.2927,root:"complex",period:"3.6h"}, "Bbc3":{lambda:0.4657,root:"complex",period:"5.1h"}, "Btg2":{lambda:0.3711,root:"complex",period:"4.0h"}, "Birc5":{lambda:0.4214,root:"complex",period:"3.8h"}, "Per2":{lambda:0.5373,root:"complex",period:"11.8h"}, "Dbp":{lambda:0.5127,root:"complex",period:"12.7h"}, "Nr1d1":{lambda:0.6323,root:"real",period:"N/A"}, "Arntl":{lambda:0.6823,root:"complex",period:"9.2h"}, "Cry1":{lambda:0.4597,root:"complex",period:"5.0h"} }},
  { tissue:"Kidney",       median:0.4610, nGenes:20955, genes:{ "Mdm2":{lambda:0.4635,root:"real",period:"N/A"}, "Bax":{lambda:0.6733,root:"real",period:"N/A"}, "Gadd45a":{lambda:0.4803,root:"real",period:"N/A"}, "Gadd45g":{lambda:0.4971,root:"real",period:"N/A"}, "Pmaip1":{lambda:0.5510,root:"real",period:"N/A"}, "Fas":{lambda:0.5794,root:"real",period:"N/A"}, "Bbc3":{lambda:0.4268,root:"real",period:"N/A"}, "Btg2":{lambda:0.3233,root:"complex",period:"2.5h"}, "Birc5":{lambda:0.5997,root:"complex",period:"5.3h"}, "Per2":{lambda:0.8357,root:"complex",period:"10.8h"}, "Dbp":{lambda:0.8922,root:"complex",period:"10.2h"}, "Nr1d1":{lambda:0.8823,root:"complex",period:"10.2h"}, "Arntl":{lambda:0.8986,root:"complex",period:"10.7h"}, "Cry1":{lambda:0.8050,root:"complex",period:"11.3h"} }},
  { tissue:"Liver",        median:0.4963, nGenes:20955, genes:{ "Mdm2":{lambda:0.7228,root:"real",period:"N/A"}, "Bax":{lambda:0.3916,root:"real",period:"N/A"}, "Gadd45a":{lambda:0.2097,root:"real",period:"N/A"}, "Gadd45g":{lambda:0.3253,root:"complex",period:"3.4h"}, "Pmaip1":{lambda:0.5439,root:"real",period:"N/A"}, "Fas":{lambda:0.4690,root:"complex",period:"9.6h"}, "Bbc3":{lambda:0.5104,root:"real",period:"N/A"}, "Btg2":{lambda:0.1169,root:"complex",period:"4.4h"}, "Birc5":{lambda:0.5597,root:"complex",period:"4.9h"}, "Per2":{lambda:0.6360,root:"complex",period:"12.8h"}, "Dbp":{lambda:0.7917,root:"complex",period:"9.4h"}, "Nr1d1":{lambda:0.8112,root:"complex",period:"8.5h"}, "Arntl":{lambda:0.7671,root:"complex",period:"10.7h"}, "Cry1":{lambda:0.7595,root:"complex",period:"9.8h"} }},
  { tissue:"Lung",         median:0.4907, nGenes:20955, genes:{ "Mdm2":{lambda:0.4626,root:"real",period:"N/A"}, "Bax":{lambda:0.5336,root:"real",period:"N/A"}, "Gadd45a":{lambda:0.5758,root:"real",period:"N/A"}, "Gadd45g":{lambda:0.5015,root:"complex",period:"4.4h"}, "Pmaip1":{lambda:0.1873,root:"complex",period:"6.4h"}, "Fas":{lambda:0.5495,root:"real",period:"N/A"}, "Bbc3":{lambda:0.4738,root:"complex",period:"3.6h"}, "Btg2":{lambda:0.4634,root:"complex",period:"5.0h"}, "Birc5":{lambda:0.8218,root:"real",period:"N/A"}, "Per2":{lambda:0.8880,root:"complex",period:"10.9h"}, "Dbp":{lambda:0.8938,root:"complex",period:"10.1h"}, "Nr1d1":{lambda:0.8736,root:"complex",period:"10.4h"}, "Arntl":{lambda:0.8234,root:"complex",period:"10.8h"}, "Cry1":{lambda:0.8478,root:"complex",period:"8.6h"} }},
  { tissue:"Muscle",       median:0.4537, nGenes:20955, genes:{ "Mdm2":{lambda:0.4656,root:"real",period:"N/A"}, "Bax":{lambda:0.5935,root:"real",period:"N/A"}, "Gadd45a":{lambda:0.3342,root:"complex",period:"8.5h"}, "Gadd45g":{lambda:0.4591,root:"complex",period:"9.5h"}, "Pmaip1":{lambda:0.5045,root:"complex",period:"3.7h"}, "Fas":{lambda:0.5287,root:"real",period:"N/A"}, "Bbc3":{lambda:0.4572,root:"complex",period:"4.1h"}, "Btg2":{lambda:0.6260,root:"complex",period:"4.5h"}, "Birc5":{lambda:0.6187,root:"real",period:"N/A"}, "Per2":{lambda:0.7790,root:"complex",period:"10.0h"}, "Dbp":{lambda:0.7276,root:"complex",period:"10.2h"}, "Nr1d1":{lambda:0.7793,root:"complex",period:"9.2h"}, "Arntl":{lambda:0.7085,root:"complex",period:"10.8h"}, "Cry1":{lambda:0.3808,root:"complex",period:"17.6h"} }},
  { tissue:"White_Fat",    median:0.4153, nGenes:20955, genes:{ "Mdm2":{lambda:0.3292,root:"complex",period:"4.4h"}, "Bax":{lambda:0.5297,root:"complex",period:"4.6h"}, "Gadd45a":{lambda:0.2095,root:"complex",period:"5.7h"}, "Gadd45g":{lambda:0.3905,root:"complex",period:"5.6h"}, "Pmaip1":{lambda:0.6896,root:"real",period:"N/A"}, "Fas":{lambda:0.6541,root:"real",period:"N/A"}, "Bbc3":{lambda:0.5273,root:"real",period:"N/A"}, "Btg2":{lambda:0.7140,root:"real",period:"N/A"}, "Birc5":{lambda:0.4923,root:"complex",period:"4.1h"}, "Per2":{lambda:0.5906,root:"complex",period:"11.6h"}, "Dbp":{lambda:0.6882,root:"complex",period:"10.5h"}, "Nr1d1":{lambda:0.7994,root:"complex",period:"10.6h"}, "Arntl":{lambda:0.8851,root:"complex",period:"11.4h"}, "Cry1":{lambda:0.6775,root:"complex",period:"9.5h"} }},
];

const P53_TARGETS = ["Mdm2","Bax","Gadd45a","Gadd45g","Pmaip1","Fas","Bbc3","Btg2","Birc5"];
const CLOCK_GENES = ["Arntl","Per2","Nr1d1","Dbp","Cry1"];

function avg(vals: number[]) { return vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : 0; }

const TISSUE_DISPLAY: Record<string, string> = {
  Brown_Fat:"Brown Fat", White_Fat:"White Fat",
};

function label(t: string) { return TISSUE_DISPLAY[t] ?? t; }

const p53Color = (lambda: number, median: number) => {
  const ratio = lambda / median;
  if (lambda < 0.3) return "#bfdbfe";
  if (ratio < 0.85) return "#93c5fd";
  if (ratio < 1.05) return "#fde68a";
  if (ratio < 1.2) return "#fca5a5";
  return "#ef4444";
};

export default function P53TissueLandscape() {
  const [selectedGene, setSelectedGene] = useState("Mdm2");
  const [view, setView] = useState<"gene" | "tissue">("gene");
  // Defer heavy Recharts renders until after initial paint so Googlebot sees content quickly
  const [chartsReady, setChartsReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setChartsReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const geneAcrossTissues = TISSUE_DATA.map(td => ({
    tissue: label(td.tissue),
    lambda: td.genes[selectedGene]?.lambda ?? null,
    root: td.genes[selectedGene]?.root ?? "—",
    period: td.genes[selectedGene]?.period ?? "—",
    median: td.median,
    aboveMedian: td.genes[selectedGene] ? td.genes[selectedGene].lambda > td.median : false,
  })).filter(d => d.lambda !== null) as { tissue:string; lambda:number; root:string; period:string; median:number; aboveMedian:boolean }[];

  const tissueForRadar = TISSUE_DATA.map(td => {
    const entry: Record<string,number|string> = { tissue: label(td.tissue) };
    const p53avg = avg(P53_TARGETS.map(g=>td.genes[g]?.lambda??0));
    const clockAvg = avg(CLOCK_GENES.map(g=>td.genes[g]?.lambda??0));
    entry["p53 targets"] = +p53avg.toFixed(3);
    entry["Clock genes"] = +clockAvg.toFixed(3);
    entry["Genome median"] = td.median;
    return entry;
  });

  const overviewData = TISSUE_DATA.map(td => ({
    tissue: label(td.tissue),
    median: td.median,
    p53avg: +avg(P53_TARGETS.map(g=>td.genes[g]?.lambda??0)).toFixed(3),
    clockAvg: +avg(CLOCK_GENES.map(g=>td.genes[g]?.lambda??0)).toFixed(3),
    mdm2: td.genes["Mdm2"]?.lambda ?? 0,
  }));

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <Link href="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm mb-6 transition-colors">
          <ArrowLeft size={16} /> Back to dashboard
        </Link>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Map className="text-emerald-500" size={28} />
            <h1 className="text-3xl font-bold text-slate-900">p53 Across 12 Tissues</h1>
          </div>
          <p className="text-slate-600 text-lg">
            What is the baseline |λ| of p53 target genes in healthy mouse tissues? And does it vary systematically across organs?
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium">GSE54650</span>
            <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-sm">12 mouse tissues · circadian time course</span>
            <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-sm">~21,000 genes per tissue</span>
            <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-sm">Healthy tissue baseline</span>
          </div>
        </div>

        {/* Key insight boxes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="text-2xl font-bold text-slate-900 mb-1">Real roots</div>
            <div className="text-sm text-slate-600">Mdm2 shows real AR(2) roots in 9/12 tissues — constitutive expression even in healthy tissue</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="text-2xl font-bold text-slate-900 mb-1">Near median</div>
            <div className="text-sm text-slate-600">p53 target average |λ| clusters near the genome median across tissues (6/12 below, 6/12 slightly above) — consistent with low, variable basal p53 activity</div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="text-2xl font-bold text-amber-700 mb-1">Liver Mdm2</div>
            <div className="text-sm text-amber-700">Liver has the highest Mdm2 |λ| (0.723) — consistent with liver's high metabolic activity and p53 engagement</div>
          </div>
        </div>

        {/* Overview: p53 avg vs clock avg vs genome median */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6 shadow-sm">
          <h2 className="font-semibold text-slate-800 mb-1">p53 targets vs clock genes vs genome — all 12 tissues</h2>
          <p className="text-slate-500 text-sm mb-4">In all 12 tissues, clock gene |λ| substantially exceeds p53 target |λ|. p53 target averages cluster near the genome median (6 tissues slightly below, 6 slightly above — max deviation ±0.09) — consistent with low, variable basal p53 activity rather than constitutive circadian driving.</p>
          {chartsReady ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={overviewData} margin={{ left: 10, right: 10, top: 10, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="tissue" tick={{ fontSize: 11, fill: "#64748b" }} angle={-35} textAnchor="end" interval={0} />
                <YAxis domain={[0, 1]} tick={{ fontSize: 11, fill: "#64748b" }} />
                <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v: number) => v.toFixed(3)} />
                <Legend />
                <ReferenceLine y={0.5} stroke="#94a3b8" strokeDasharray="2 2" />
                <Bar isAnimationActive={false} dataKey="clockAvg" name="Clock genes avg" fill="#2563eb" opacity={0.8} />
                <Bar isAnimationActive={false} dataKey="p53avg" name="p53 targets avg" fill="#dc2626" opacity={0.8} />
                <Bar isAnimationActive={false} dataKey="median" name="Genome median" fill="#e2e8f0" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-slate-400 text-sm">Loading chart…</div>
          )}
        </div>

        {/* Gene explorer */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800">Single gene across all 12 tissues</h2>
            <div className="flex flex-wrap gap-2">
              {P53_TARGETS.map(g => (
                <button key={g} onClick={() => setSelectedGene(g)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${selectedGene === g ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"}`}>
                  {g}
                </button>
              ))}
            </div>
          </div>
          {chartsReady ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={geneAcrossTissues} margin={{ left: 10, right: 10, top: 10, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="tissue" tick={{ fontSize: 11, fill: "#64748b" }} angle={-35} textAnchor="end" interval={0} />
                <YAxis domain={[0, 1]} tick={{ fontSize: 11, fill: "#64748b" }} label={{ value: "|λ|", angle: -90, position:"insideLeft", offset:10, style:{fontSize:11,fill:"#64748b"} }} />
                <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v: number) => v.toFixed(4)} />
                <ReferenceLine y={geneAcrossTissues[0]?.median ?? 0.45} stroke="#f59e0b" strokeDasharray="3 2"
                  label={{ value: "Tissue median", position: "right", style:{fontSize:10,fill:"#d97706"} }} />
                <Bar isAnimationActive={false} dataKey="lambda" name={`${selectedGene} |λ|`} radius={[3,3,0,0]}>
                  {geneAcrossTissues.map(d => (
                    <Cell key={d.tissue} fill={d.root === "complex" ? "#2563eb" : "#94a3b8"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[260px] flex items-center justify-center text-slate-400 text-sm">Loading chart…</div>
          )}
          <div className="flex items-center gap-6 mt-2 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-600 inline-block" /> Complex roots (oscillatory)</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-slate-400 inline-block" /> Real roots (constitutive)</span>
          </div>
        </div>

        {/* Heat grid */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6 shadow-sm overflow-x-auto">
          <h2 className="font-semibold text-slate-800 mb-4">p53 target |λ| heatmap — all 12 tissues</h2>
          <table className="text-xs min-w-full">
            <thead>
              <tr>
                <th className="text-left py-1.5 px-2 text-slate-500 font-medium w-28">Gene</th>
                {TISSUE_DATA.map(td => (
                  <th key={td.tissue} className="py-1.5 px-1 text-slate-500 font-medium text-center min-w-16">{label(td.tissue)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {P53_TARGETS.map(gene => (
                <tr key={gene} className="border-t border-slate-100">
                  <td className="py-1.5 px-2 font-mono font-semibold text-slate-800">{gene}</td>
                  {TISSUE_DATA.map(td => {
                    const g = td.genes[gene];
                    if (!g) return <td key={td.tissue} className="py-1.5 px-1 text-center text-slate-300">—</td>;
                    return (
                      <td key={td.tissue} className="py-1.5 px-1 text-center">
                        <div className="rounded px-1 py-0.5 font-mono font-medium"
                          style={{ backgroundColor: p53Color(g.lambda, td.median), color:"#1e293b" }}
                          title={`${g.root} ${g.period}`}>
                          {g.lambda.toFixed(2)}
                          {g.root === "complex" ? "~" : ""}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="border-t-2 border-slate-300">
                <td className="py-1.5 px-2 text-slate-500 font-medium">Median</td>
                {TISSUE_DATA.map(td => (
                  <td key={td.tissue} className="py-1.5 px-1 text-center font-mono text-slate-500">{td.median}</td>
                ))}
              </tr>
            </tbody>
          </table>
          <div className="flex items-center gap-3 mt-3 text-xs text-slate-500">
            <span>Colour scale: </span>
            <span style={{backgroundColor:"#bfdbfe",padding:"1px 6px",borderRadius:3}}>very low</span>
            <span style={{backgroundColor:"#93c5fd",padding:"1px 6px",borderRadius:3}}>low</span>
            <span style={{backgroundColor:"#fde68a",padding:"1px 6px",borderRadius:3}}>≈median</span>
            <span style={{backgroundColor:"#fca5a5",padding:"1px 6px",borderRadius:3}}>above</span>
            <span style={{backgroundColor:"#ef4444",color:"white",padding:"1px 6px",borderRadius:3}}>high</span>
            <span className="ml-2">~ = complex roots (oscillatory)</span>
          </div>
        </div>

        {/* Interpretation */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6 shadow-sm">
          <div className="flex items-start gap-3">
            <Info size={18} className="text-blue-500 mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold text-slate-800 mb-2">What the healthy tissue baseline tells us</div>
              <p className="text-slate-600 text-sm leading-relaxed mb-2">
                In healthy mouse tissue, p53 target gene |λ| clusters near the genome median across all 12 tissues (6 slightly below, 6 slightly above; max deviation ±0.09). This is consistent with
                p53 being a stress-response system operating at low basal activity, not a constitutively active transcription factor.
                Mdm2 specifically shows real roots (constitutive expression) in 9/12 tissues, suggesting that the
                MDM2 negative feedback arm is "always on" in healthy tissue — primed to suppress p53 the moment it appears.
              </p>
              <p className="text-slate-600 text-sm leading-relaxed">
                Liver has the highest Mdm2 |λ| (0.723), which is notable: the liver is among the most metabolically active
                organs, with known diurnal p53 activity linked to DNA damage from reactive oxygen species. The clock genes
                in all 12 tissues consistently show much higher |λ| (~0.7–0.9) than p53 targets — confirming that circadian
                oscillations are the dominant source of temporal persistence in healthy tissue, while p53 targets are
                largely quiescent.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-800">
          <strong>Limitations:</strong> (1) This is resting healthy mouse tissue — p53 targets are expected to be quiet.
          Adding a DNA-damage time course in any of these 12 tissues would show whether |λ| increases upon p53 activation.
          (2) Mouse tissue; human equivalents may differ in baseline p53 activity.
          (3) Gadd45a and Gadd45g are also clock-responsive (DBP→Gadd45a); their variation may partly reflect
          circadian, not p53, inputs.
        </div>
      </div>
    </div>
  );
}
