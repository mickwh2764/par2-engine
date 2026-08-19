import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Label
} from "recharts";
import {
  ArrowLeft, ExternalLink, Info, GitMerge, Layers, FlaskConical,
  ArrowRight, CheckCircle2, AlertCircle
} from "lucide-react";

const COMPARISON_ROWS = [
  {
    dimension:   "What it measures",
    cofe:        "Amplitude and phase (peak time) of oscillation",
    par2:        "Temporal persistence — how long the system remembers past values (|λ|)",
  },
  {
    dimension:   "Data requirement",
    cofe:        "Many cross-sectional samples, no time labels needed (≥250 per group)",
    par2:        "Time-series data with known time labels (smaller N, e.g. 6–12 timepoints)",
  },
  {
    dimension:   "What 'high score' means",
    cofe:        "Gene oscillates with large amplitude and detectable phase",
    par2:        "Gene's expression today is strongly predicted by its expression yesterday",
  },
  {
    dimension:   "Can a gene score high on both?",
    cofe:        "Yes — independently",
    par2:        "Yes — but the two scores are uncorrelated; neither implies the other",
  },
  {
    dimension:   "Can a gene score high on one but low on the other?",
    cofe:        "Clock core genes have high |λ| even when their oscillation amplitude is small in bulk tumour data",
    par2:        "A gene can have a large sinusoidal swing but low |λ| if memory decays quickly",
  },
  {
    dimension:   "Cancer application",
    cofe:        "Reconstructs the tumour clock from unlabelled TCGA biopsies; identifies rhythmic genes and proteins across 11 adenocarcinomas",
    par2:        "Detects eigenvalue hierarchy inversion in APC-KO organoids; concordant with TCGA-COAD expression fold-changes",
  },
  {
    dimension:   "Method family",
    cofe:        "Sparse cyclic PCA + cosinor regression",
    par2:        "AR(2) autoregressive modelling + eigenvalue decomposition",
  },
  {
    dimension:   "Open source",
    cofe:        "Yes — github.com/bharathananth/COFE (Python)",
    par2:        "Yes — par2-circadian v1.1.5 (pip install)",
  },
];

const E_BOX_GENES = [
  {
    gene: "NR1D2",
    cofePhase: "Phase-delayed in 11/11 adenocarcinomas (one of four mistimed E-box targets)",
    cofeAmplitude: "Reduced amplitude in most cancers; clock signal retained but shifted",
    par2: "High |λ| in healthy tissue datasets — clock-layer persistence signature",
    overlap: "Both methods independently flag disruption in this E-box/RRE-element gene in cancer",
    badge: "E-box / RRE",
    badgeColor: "bg-violet-500/20 text-violet-300 border-violet-500/30",
  },
  {
    gene: "TEF",
    cofePhase: "Phase-delayed — one of the four specifically mistimed clock output genes in cancer",
    cofeAmplitude: "Detectable oscillation retained; classified as rhythmic in most ACs",
    par2: "Appears in Floquet monodromy analysis (6 transient Fibonacci proximity cases)",
    overlap: "PAR(2) Floquet analysis and COFE phase mapping both pick up TEF as a dynamically notable E-box target",
    badge: "E-box (PAR bZip)",
    badgeColor: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  },
  {
    gene: "BHLHE40",
    cofePhase: "Phase-delayed — among the four E-box targets identified by COFE as specifically mistimed in cancer",
    cofeAmplitude: "Rhythmic in multiple ACs; amplitude diminished relative to healthy tissue clock genes",
    par2: "Present in platform 14-gene E-box set (p=0.041, mouse GSE54650; p=0.029, human enteroid); Floquet table 3 cases",
    overlap: "Independently identified as a disrupted E-box target by COFE (phase) and PAR(2) (persistence enrichment)",
    badge: "E-box",
    badgeColor: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  },
  {
    gene: "PER2",
    cofePhase: "Phase-delayed — the only core E-box/D-box gene in the group of four specifically mistimed clock genes",
    cofeAmplitude: "Clock signal preserved but mistimed; co-delayed with the E-box output arm",
    par2: "High |λ| across healthy circadian datasets; one of the signature clock-persistence genes on the platform",
    overlap: "COFE's phase delay and PAR(2)'s elevated |λ| together describe a gene that is still dynamically active but temporally displaced",
    badge: "E-box / D-box",
    badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  },
];

const SCATTER_DATA_CLOCK = [
  { gene: "BMAL1",  lambda: 0.81, amplitude: 0.82 },
  { gene: "CLOCK",  lambda: 0.78, amplitude: 0.74 },
  { gene: "CRY1",   lambda: 0.76, amplitude: 0.70 },
  { gene: "PER2",   lambda: 0.74, amplitude: 0.58 },
  { gene: "NR1D1",  lambda: 0.73, amplitude: 0.72 },
];
const SCATTER_DATA_TARGET = [
  { gene: "BHLHE40", lambda: 0.70, amplitude: 0.38 },
  { gene: "TEF",     lambda: 0.68, amplitude: 0.42 },
  { gene: "NR1D2",   lambda: 0.66, amplitude: 0.30 },
  { gene: "WEE1",    lambda: 0.65, amplitude: 0.44 },
  { gene: "DBP",     lambda: 0.63, amplitude: 0.50 },
  { gene: "HLF",     lambda: 0.60, amplitude: 0.40 },
];
const SCATTER_DATA_BG = [
  { gene: "GAPDH",  lambda: 0.22, amplitude: 0.12 },
  { gene: "ACTB",   lambda: 0.18, amplitude: 0.10 },
  { gene: "MYC",    lambda: 0.35, amplitude: 0.20 },
  { gene: "TP53",   lambda: 0.28, amplitude: 0.18 },
  { gene: "CDK4",   lambda: 0.31, amplitude: 0.24 },
  { gene: "EGFR",   lambda: 0.40, amplitude: 0.32 },
  { gene: "KRAS",   lambda: 0.25, amplitude: 0.15 },
  { gene: "VEGFA",  lambda: 0.44, amplitude: 0.28 },
];

function QuadrantLabel({ x, y, text, sub }: { x: number; y: number; text: string; sub: string }) {
  return (
    <g>
      <text x={x} y={y} fontSize={10} fill="#475569" fontWeight="600" textAnchor="middle">{text}</text>
      <text x={x} y={y + 13} fontSize={8.5} fill="#334155" textAnchor="middle">{sub}</text>
    </g>
  );
}

const CustomDot = (props: any) => {
  const { cx, cy, payload, fill } = props;
  return (
    <g>
      <circle cx={cx} cy={cy} r={5} fill={fill} fillOpacity={0.85} stroke="rgba(0,0,0,0.3)" strokeWidth={0.8} />
      <text x={cx + 7} y={cy + 4} fontSize={8} fill="#94a3b8">{payload.gene}</text>
    </g>
  );
};

export default function COFEContext() {
  const [activeTab, setActiveTab] = useState<'comparison' | 'convergence' | 'space' | 'pipeline' | 'dataset'>('comparison');

  const tabs = [
    { id: 'comparison', label: 'Method comparison' },
    { id: 'convergence', label: 'E-box convergence' },
    { id: 'space',      label: 'Amplitude–persistence space' },
    { id: 'pipeline',   label: 'COFE→PAR(2) pipeline' },
    { id: 'dataset',    label: 'GSE205155 opportunity' },
  ] as const;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/dashboard" className="text-slate-500 hover:text-slate-300 transition-colors" data-testid="back-link">
            <ArrowLeft size={18} />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <GitMerge size={18} className="text-teal-400" />
              External Context: COFE Cross-Reference
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">
              How PAR(2) and COFE (Gupta et al. 2024) measure different, complementary aspects of circadian dynamics in cancer
            </p>
          </div>
          <a
            href="https://doi.org/10.1101/2024.03.13.584582"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-teal-400 hover:text-teal-300 transition-colors border border-teal-500/30 rounded px-2 py-1.5"
            data-testid="cofe-paper-link"
          >
            <ExternalLink size={11} />
            COFE preprint
          </a>
        </div>

        {/* Intro card */}
        <Card className="bg-slate-900/70 border-slate-700 mb-5">
          <CardContent className="pt-4 pb-3">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <div className="text-xs font-semibold text-teal-300 mb-1.5 uppercase tracking-wider">What COFE is</div>
                <p className="text-sm text-slate-300 leading-relaxed">
                  COFE (Cyclic Ordering with Feature Extraction) is an unsupervised machine learning method that reconstructs
                  circadian rhythms from tumour biopsies collected without time labels. Using sparse cyclic PCA applied to
                  TCGA RNA-seq data, it simultaneously assigns pseudo-time to samples and identifies which genes drove the
                  ordering. Gupta et al. (bioRxiv 2024) applied it to 11 human adenocarcinomas with 288–771 samples each.
                </p>
              </div>
              <div>
                <div className="text-xs font-semibold text-orange-300 mb-1.5 uppercase tracking-wider">Why it matters here</div>
                <p className="text-sm text-slate-300 leading-relaxed">
                  COFE and PAR(2) are not competing methods — they measure orthogonal properties of the same biological
                  system. COFE answers "does this gene oscillate and when does it peak?" PAR(2) answers "how strongly does
                  this gene's past constrain its future?" The two questions are statistically independent, and their
                  convergence on the same genes provides mutual validation neither method can provide alone.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1.5 mb-5" data-testid="cofe-tabs">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeTab === t.id
                  ? 'bg-teal-600/30 text-teal-300 border border-teal-500/40'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300'
              }`}
              data-testid={`tab-${t.id}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── TAB: METHOD COMPARISON ─────────────────────────────────────────── */}
        {activeTab === 'comparison' && (
          <div data-testid="tab-content-comparison">
            <Card className="bg-slate-900 border-slate-700 mb-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-slate-100 text-base flex items-center gap-2">
                  <Layers size={15} className="text-teal-400" />
                  COFE vs PAR(2): what each method actually measures
                </CardTitle>
                <p className="text-sm text-slate-400">
                  The two methods are orthogonal — high scores on one do not imply high scores on the other.
                </p>
              </CardHeader>
              <CardContent className="px-0 pb-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="comparison-table">
                    <thead>
                      <tr className="border-b border-slate-800">
                        <th className="text-left py-2 px-4 text-slate-500 font-medium w-1/5">Dimension</th>
                        <th className="text-left py-2 px-4 text-teal-400 font-semibold w-2/5">COFE</th>
                        <th className="text-left py-2 px-4 text-orange-400 font-semibold w-2/5">PAR(2)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {COMPARISON_ROWS.map((row, i) => (
                        <tr key={i} className={`border-b border-slate-800/50 ${i % 2 === 0 ? 'bg-slate-800/20' : ''}`} data-testid={`comparison-row-${i}`}>
                          <td className="py-2.5 px-4 text-slate-400 font-medium text-sm align-top">{row.dimension}</td>
                          <td className="py-2.5 px-4 text-slate-300 text-sm align-top leading-relaxed">{row.cofe}</td>
                          <td className="py-2.5 px-4 text-slate-300 text-sm align-top leading-relaxed">{row.par2}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <div className="bg-teal-950/30 border border-teal-600/30 rounded-lg p-4" data-testid="orthogonality-note">
              <div className="flex items-start gap-2">
                <Info size={14} className="text-teal-400 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-teal-300 mb-1">Why orthogonality matters</div>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    COFE (via cosinor) detects rhythmicity by testing whether a gene's expression fits a sinusoid across many
                    patients. PAR(2) detects temporal memory by testing how much of today's expression is predicted by
                    yesterday's. A clock gene can have high memory (|λ| ≈ 0.80) even in bulk tumour data where its oscillation
                    amplitude appears small — because bulk averaging dilutes phase coherence without eliminating the
                    autoregressive structure. This is why PAR(2) can rank clock genes above targets even when COFE finds "core
                    clock genes are not statistically more rhythmic than outputs" in cancer — the two statistics are not the
                    same quantity.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: E-BOX CONVERGENCE ────────────────────────────────────────── */}
        {activeTab === 'convergence' && (
          <div data-testid="tab-content-convergence">
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 mb-4 flex items-start gap-2">
              <CheckCircle2 size={14} className="text-emerald-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-slate-300 leading-relaxed">
                COFE identifies four clock genes as specifically phase-delayed in cancer — genes where the tumour clock
                preserves oscillation but has shifted timing. All four are direct BMAL1/CLOCK E-box targets. All four
                appear as notable genes in the PAR(2) platform's φ-enrichment, Floquet analysis, or 14-gene E-box set.
                The convergence is independent: different methods, different data, different biological quantities.
              </p>
            </div>
            <div className="space-y-3" data-testid="ebox-genes-list">
              {E_BOX_GENES.map((g, i) => (
                <Card key={i} className="bg-slate-900 border-slate-700" data-testid={`ebox-gene-${g.gene}`}>
                  <CardContent className="pt-3 pb-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 pt-0.5">
                        <span className="font-mono font-bold text-lg text-slate-100">{g.gene}</span>
                        <div className="mt-1">
                          <Badge className={`text-[11px] ${g.badgeColor}`}>{g.badge}</Badge>
                        </div>
                      </div>
                      <div className="flex-1 grid sm:grid-cols-3 gap-3 text-sm">
                        <div>
                          <div className="text-[11px] font-semibold text-teal-400 uppercase tracking-wider mb-1">COFE — phase</div>
                          <p className="text-slate-300 leading-relaxed">{g.cofePhase}</p>
                        </div>
                        <div>
                          <div className="text-[11px] font-semibold text-teal-400 uppercase tracking-wider mb-1">COFE — amplitude</div>
                          <p className="text-slate-300 leading-relaxed">{g.cofeAmplitude}</p>
                        </div>
                        <div>
                          <div className="text-[11px] font-semibold text-orange-400 uppercase tracking-wider mb-1">PAR(2)</div>
                          <p className="text-slate-300 leading-relaxed">{g.par2}</p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 bg-emerald-950/30 border border-emerald-600/20 rounded p-2 text-xs text-emerald-300 flex items-start gap-1.5">
                      <CheckCircle2 size={11} className="mt-0.5 flex-shrink-0" />
                      <span><span className="font-semibold">Convergence: </span>{g.overlap}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="mt-4 bg-amber-950/30 border border-amber-600/30 rounded-lg p-3 flex items-start gap-2" data-testid="coad-note">
              <AlertCircle size={13} className="text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-200/80 leading-relaxed">
                <span className="font-semibold text-amber-300">COAD note: </span>
                COFE finds a moderate country-of-origin effect on predicted tumour time labels in COAD (η² = 0.26) — stronger
                than any other cancer in the study. This is worth flagging as a confound for any future PAR(2) analysis of
                TCGA-COAD cross-sectional data. The existing APC-KO organoid eigenvalue concordance with TCGA-COAD is not
                affected (it uses fold-change direction, not time labels), but pseudo-time-based AR(2) fitting on COAD would
                need to account for this batch structure.
              </p>
            </div>
          </div>
        )}

        {/* ── TAB: AMPLITUDE–PERSISTENCE SPACE ─────────────────────────────── */}
        {activeTab === 'space' && (
          <div data-testid="tab-content-space">
            <Card className="bg-slate-900 border-slate-700 mb-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-slate-100 text-base">
                  Amplitude–Persistence space: a combined view neither method provides alone
                </CardTitle>
                <p className="text-sm text-slate-400 leading-relaxed mt-1">
                  Placing genes in a 2D space where the x-axis is PAR(2) temporal persistence (|λ|) and the y-axis is
                  COFE-derived oscillation amplitude separates four biologically distinct populations. The illustrative
                  plot below uses representative values consistent with the platform's existing eigenvalue data and
                  COFE's published amplitudes for the 11-AC dataset.
                </p>
              </CardHeader>
              <CardContent>
                <div className="bg-amber-950/20 border border-amber-600/20 rounded p-2 mb-3 flex items-start gap-1.5">
                  <Info size={12} className="text-amber-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-200/70">
                    Illustrative values — approximate positions consistent with published data. Axes are not to the same
                    scale as any single dataset. Actual values require joint computation from matched time-series + COFE data.
                  </p>
                </div>
                <div className="h-80" data-testid="amplitude-persistence-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 30, bottom: 30, left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis
                        type="number"
                        dataKey="lambda"
                        domain={[0, 1]}
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                        name="|λ| (PAR(2) persistence)"
                      >
                        <Label value="|λ|  — PAR(2) temporal persistence" offset={-10} position="insideBottom" fill="#94a3b8" fontSize={11} />
                      </XAxis>
                      <YAxis
                        type="number"
                        dataKey="amplitude"
                        domain={[0, 1]}
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                        name="Amplitude (COFE)"
                      >
                        <Label value="Oscillation amplitude (COFE)" angle={-90} position="insideLeft" fill="#94a3b8" fontSize={11} offset={10} />
                      </YAxis>
                      <Tooltip
                        cursor={{ strokeDasharray: '3 3', stroke: '#334155' }}
                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: '11px' }}
                        formatter={(v: any, name: string) => [Number(v).toFixed(2), name]}
                      />
                      <ReferenceLine x={0.55} stroke="#334155" strokeDasharray="4 2" />
                      <ReferenceLine y={0.45} stroke="#334155" strokeDasharray="4 2" />
                      <Scatter
                        name="Clock core"
                        data={SCATTER_DATA_CLOCK}
                        fill="#a78bfa"
                        shape={(props: any) => <CustomDot {...props} fill="#a78bfa" />}
                      />
                      <Scatter
                        name="Clock output / E-box targets"
                        data={SCATTER_DATA_TARGET}
                        fill="#60a5fa"
                        shape={(props: any) => <CustomDot {...props} fill="#60a5fa" />}
                      />
                      <Scatter
                        name="Background"
                        data={SCATTER_DATA_BG}
                        fill="#475569"
                        shape={(props: any) => <CustomDot {...props} fill="#475569" />}
                      />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-3 mt-1 justify-center text-xs text-slate-400">
                  <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-violet-400 inline-block" />Clock core</div>
                  <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-400 inline-block" />Clock output / E-box targets</div>
                  <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-slate-500 inline-block" />Background genes</div>
                </div>
              </CardContent>
            </Card>

            <div className="grid sm:grid-cols-2 gap-3" data-testid="quadrant-descriptions">
              {[
                {
                  title: "High |λ|, high amplitude",
                  colour: "border-violet-500/40 bg-violet-950/20",
                  titleColour: "text-violet-300",
                  desc: "Core clock genes in healthy tissue. Strong oscillation and deep temporal memory. These are the canonical AR(2) targets and the genes COFE identifies most reliably in time-labelled datasets.",
                },
                {
                  title: "Low |λ|, high amplitude",
                  colour: "border-amber-500/40 bg-amber-950/20",
                  titleColour: "text-amber-300",
                  desc: "Genes with large swings that decay quickly — 'fast oscillators'. Detectable by cosinor/COFE but invisible to PAR(2) persistence ranking. Cell-cycle checkpoint genes in some contexts.",
                },
                {
                  title: "High |λ|, low amplitude",
                  colour: "border-teal-500/40 bg-teal-950/20",
                  titleColour: "text-teal-300",
                  desc: "Most important quadrant for PAR(2)'s added value. Genes with strong autoregressive memory but small or diluted oscillation amplitude — invisible to COFE in bulk tumour data, but confidently ranked by PAR(2). E-box targets in BRCA (few rhythmic genes, but high persistence) likely populate this region.",
                },
                {
                  title: "Low |λ|, low amplitude",
                  colour: "border-slate-600/40 bg-slate-800/20",
                  titleColour: "text-slate-400",
                  desc: "Background. Neither method finds signal. Housekeeping genes (GAPDH, ACTB) and constitutively expressed tumour drivers (KRAS) are here.",
                },
              ].map((q, i) => (
                <div key={i} className={`border rounded-lg p-3 ${q.colour}`}>
                  <div className={`text-sm font-semibold mb-1.5 ${q.titleColour}`}>{q.title}</div>
                  <p className="text-xs text-slate-300 leading-relaxed">{q.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB: COFE → PAR(2) PIPELINE ──────────────────────────────────── */}
        {activeTab === 'pipeline' && (
          <div data-testid="tab-content-pipeline">
            <Card className="bg-slate-900 border-slate-700 mb-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-slate-100 text-base flex items-center gap-2">
                  <FlaskConical size={15} className="text-orange-400" />
                  A two-stage pipeline enabling PAR(2) on TCGA
                </CardTitle>
                <p className="text-sm text-slate-400 mt-1">
                  PAR(2) requires time-series data. TCGA has no time labels. COFE solves this: it assigns pseudo-time
                  to each sample, which makes AR(2) fitting feasible on any of the 11 human adenocarcinomas.
                </p>
              </CardHeader>
              <CardContent>
                {/* Pipeline flow */}
                <div className="flex flex-col sm:flex-row items-center gap-2 mb-6 overflow-x-auto pb-2" data-testid="pipeline-flow">
                  {[
                    { step: "1", title: "TCGA RNA-seq", desc: "288–771 tumour samples per cancer type, no time labels (recount3)", colour: "bg-slate-800 border-slate-600" },
                    { step: "2", title: "COFE", desc: "Sparse cyclic PCA assigns pseudo-time ZT₀–ZT₂₄ to each sample", colour: "bg-teal-900/40 border-teal-600/50" },
                    { step: "3", title: "Sort + bin", desc: "Samples ordered by pseudo-time; binned into ZT intervals (e.g. 6 × 4h bins)", colour: "bg-slate-800 border-slate-600" },
                    { step: "4", title: "AR(2) fit", desc: "par2-circadian fits AR(2) to each gene's expression across pseudo-time bins", colour: "bg-orange-900/30 border-orange-600/40" },
                    { step: "5", title: "|λ| hierarchy", desc: "Clock vs target eigenvalue gap tested across all 11 ACs simultaneously", colour: "bg-emerald-900/30 border-emerald-600/40" },
                  ].map((node, i, arr) => (
                    <div key={i} className="flex items-center gap-2 flex-shrink-0">
                      <div className={`border rounded-lg px-3 py-2.5 text-center w-40 ${node.colour}`}>
                        <div className="text-[11px] text-slate-500 mb-0.5">Step {node.step}</div>
                        <div className="text-sm font-semibold text-slate-200 mb-1">{node.title}</div>
                        <div className="text-[11px] text-slate-400 leading-snug">{node.desc}</div>
                      </div>
                      {i < arr.length - 1 && (
                        <ArrowRight size={16} className="text-slate-600 flex-shrink-0" />
                      )}
                    </div>
                  ))}
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-semibold text-slate-200 mb-2">What this would test</div>
                    <ul className="text-sm text-slate-300 space-y-1.5 leading-relaxed">
                      <li className="flex items-start gap-1.5"><CheckCircle2 size={12} className="text-emerald-400 mt-1 flex-shrink-0" />Whether the clock &gt; target eigenvalue hierarchy persists in each of the 11 cancers, or collapses as in APC-KO</li>
                      <li className="flex items-start gap-1.5"><CheckCircle2 size={12} className="text-emerald-400 mt-1 flex-shrink-0" />Whether |λ| of NR1D2, TEF, BHLHE40, PER2 is reduced relative to BMAL1/CLOCK in cancer (phase-delayed genes may also show persistence loss)</li>
                      <li className="flex items-start gap-1.5"><CheckCircle2 size={12} className="text-emerald-400 mt-1 flex-shrink-0" />Whether KIRC (the one cancer where COFE finds no cell-cycle coupling) also lacks the eigenvalue hierarchy</li>
                      <li className="flex items-start gap-1.5"><CheckCircle2 size={12} className="text-emerald-400 mt-1 flex-shrink-0" />Whether BRCA (few rhythmic genes but most rhythmic proteins) has a distinct |λ| profile from other ACs</li>
                    </ul>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-200 mb-2">Key caveats</div>
                    <ul className="text-sm text-slate-300 space-y-1.5 leading-relaxed">
                      <li className="flex items-start gap-1.5"><AlertCircle size={12} className="text-amber-400 mt-1 flex-shrink-0" />Pseudo-time from COFE represents population-level phase, not within-subject temporal dynamics — the AR(2) fit would measure population rhythm, not individual autocorrelation</li>
                      <li className="flex items-start gap-1.5"><AlertCircle size={12} className="text-amber-400 mt-1 flex-shrink-0" />COAD has a country-of-origin confound (η² = 0.26 in COFE) — would need batch correction before AR(2) fitting</li>
                      <li className="flex items-start gap-1.5"><AlertCircle size={12} className="text-amber-400 mt-1 flex-shrink-0" />Binning reduces the effective sample size per timepoint; bin width is a tuning parameter affecting AR(2) parameter estimates</li>
                    </ul>
                  </div>
                </div>

                <div className="mt-4 bg-slate-800/60 border border-slate-700 rounded p-3 text-xs text-slate-400">
                  <span className="font-semibold text-slate-300">Code resources: </span>
                  COFE Python package — <a href="https://github.com/bharathananth/COFE" target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:text-teal-300">github.com/bharathananth/COFE</a>{' · '}
                  PAR(2) Python package — <code className="text-orange-300">pip install par2-circadian</code>{' · '}
                  TCGA data via <a href="https://rna.recount.bio" target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:text-teal-300">recount3</a>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── TAB: GSE205155 OPPORTUNITY ────────────────────────────────────── */}
        {activeTab === 'dataset' && (
          <div data-testid="tab-content-dataset">
            <Card className="bg-slate-900 border-slate-700 mb-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-slate-100 text-base flex items-center gap-2">
                  <FlaskConical size={15} className="text-blue-400" />
                  GSE205155 — an unused PAR(2) validation dataset
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 gap-4 mb-4">
                  <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700">
                    <div className="text-xs font-semibold text-blue-300 mb-2 uppercase tracking-wider">Dataset details</div>
                    <div className="space-y-1.5 text-sm text-slate-300">
                      <div className="flex justify-between"><span className="text-slate-500">GEO accession</span><span className="font-mono">GSE205155</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Source</span><span>del Olmo et al. 2022 NAR Genomics</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Tissue</span><span>Human dermis + epidermis</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Resolution</span><span className="font-mono">4h over 24h</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Used by COFE for</span><span>Method benchmarking</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Used by platform</span><span className="text-amber-400">Not yet</span></div>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-orange-300 mb-2 uppercase tracking-wider">Why it is useful for PAR(2)</div>
                    <ul className="text-sm text-slate-300 space-y-2 leading-relaxed">
                      <li className="flex items-start gap-1.5">
                        <CheckCircle2 size={12} className="text-emerald-400 mt-1 flex-shrink-0" />
                        4-hour resolution provides 6 timepoints per 24h — adequate for AR(2) fitting with well-constrained φ₁/φ₂
                      </li>
                      <li className="flex items-start gap-1.5">
                        <CheckCircle2 size={12} className="text-emerald-400 mt-1 flex-shrink-0" />
                        Two tissues from the same paper (dermis and epidermis) allow within-study tissue comparison of the eigenvalue hierarchy
                      </li>
                      <li className="flex items-start gap-1.5">
                        <CheckCircle2 size={12} className="text-emerald-400 mt-1 flex-shrink-0" />
                        Human skin is independent of all datasets currently on the platform — provides fully new replication for Paper A
                      </li>
                      <li className="flex items-start gap-1.5">
                        <CheckCircle2 size={12} className="text-emerald-400 mt-1 flex-shrink-0" />
                        COFE's benchmarking on this dataset establishes it as a high-quality circadian reference — cross-validation across methods is straightforward
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-3">
                  <div className="text-sm font-semibold text-slate-200 mb-2">Predicted PAR(2) result</div>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Based on the 22-dataset hierarchy already on the platform, running PAR(2) on GSE205155 should show clock gene |λ| (BMAL1, CLOCK, CRY1/2, PER1/2) above output gene |λ| (DBP, TEF, HLF, NR1D1/2) in both dermis and epidermis, with background genes substantially lower. If the hierarchy is replicated, this constitutes a 23rd and 24th independent dataset for Paper A — two human tissues from a single high-quality study benchmarked by an independent group.
                  </p>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                    {[
                      { label: "Expected clock |λ| (median)", value: "~0.73–0.81", colour: "text-violet-300" },
                      { label: "Expected output |λ| (median)", value: "~0.60–0.70", colour: "text-blue-300" },
                      { label: "Expected background |λ| (median)", value: "~0.25–0.40", colour: "text-slate-400" },
                    ].map((s, i) => (
                      <div key={i} className="bg-slate-900 rounded p-2 border border-slate-700">
                        <div className="text-[10px] text-slate-500 mb-0.5">{s.label}</div>
                        <div className={`font-mono font-semibold text-sm ${s.colour}`}>{s.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Citation footer */}
        <div className="mt-6 bg-slate-900/60 border border-slate-800 rounded-lg p-4" data-testid="cofe-citation">
          <div className="text-xs text-slate-500 font-semibold mb-2 uppercase tracking-wider">Reference</div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Gupta M, Del Olmo M, Bhatt DL, Ananthasubramaniam B. (2024).{' '}
            <span className="text-slate-300 italic">
              Circadian transcriptome oscillations and their coupling to the cell-cycle and proteome in human cancers.
            </span>{' '}
            bioRxiv 2024.03.13.584582v2.{' '}
            <a href="https://doi.org/10.1101/2024.03.13.584582" target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:text-teal-300">
              doi:10.1101/2024.03.13.584582
            </a>
          </p>
        </div>

      </div>
    </div>
  );
}
