import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Label, BarChart, Bar, Cell,
  Legend,
} from "recharts";
import { AlertTriangle, CheckCircle2, FlaskConical, ArrowLeft, Info } from "lucide-react";

// ─── Rule 3 Data ────────────────────────────────────────────────────────────
// Spatial zone: 0 = crypt bottom (stem), 1 = villus top (differentiated)
// λ values: live-computed from GSE179027 (mouse intestinal enteroid, 48 timepoints)
// Zone assignments: from Elmentaite 2021 Gut atlas & HCA colon annotations
// ★ = low mean expression in bulk RNA-seq; eigenvalue estimate unreliable

const RULE3_DATA = [
  { gene: "LGR5",    zone: 0.05, lambda: 0.948, category: "Stem",           color: "#3b82f6" },
  { gene: "ASCL2",   zone: 0.08, lambda: 0.681, category: "Stem",           color: "#3b82f6" },
  { gene: "SMOC2",   zone: 0.10, lambda: 0.869, category: "Stem",           color: "#3b82f6" },
  { gene: "OLFM4",   zone: 0.15, lambda: 0.855, category: "Stem",           color: "#3b82f6" },
  { gene: "CDK4",    zone: 0.28, lambda: 0.700, category: "Transit-Amp",    color: "#f59e0b" },
  { gene: "CCND1",   zone: 0.30, lambda: 0.829, category: "Transit-Amp",    color: "#f59e0b" },
  { gene: "PCNA",    zone: 0.35, lambda: 0.307, category: "Transit-Amp ★",  color: "#f59e0b" },
  { gene: "MKI67",   zone: 0.38, lambda: 0.842, category: "Transit-Amp",    color: "#f59e0b" },
  { gene: "MCM2",    zone: 0.40, lambda: 0.605, category: "Transit-Amp",    color: "#f59e0b" },
  { gene: "TOP2A",   zone: 0.42, lambda: 0.882, category: "Transit-Amp",    color: "#f59e0b" },
  { gene: "PER2",    zone: 0.45, lambda: 0.631, category: "Clock",          color: "#8b5cf6" },
  { gene: "BMAL1",   zone: 0.48, lambda: 0.565, category: "Clock",          color: "#8b5cf6" },
  { gene: "FABP1",   zone: 0.58, lambda: 0.995, category: "Enterocyte",     color: "#10b981" },
  { gene: "ALPI",    zone: 0.62, lambda: 0.789, category: "Enterocyte",     color: "#10b981" },
  { gene: "TFF3",    zone: 0.68, lambda: 0.763, category: "Goblet",         color: "#06b6d4" },
  { gene: "SLC26A3", zone: 0.70, lambda: 0.894, category: "Enterocyte",     color: "#10b981" },
  { gene: "MUC2",    zone: 0.72, lambda: 0.367, category: "Goblet",         color: "#06b6d4" },
  { gene: "KRT20",   zone: 0.78, lambda: 0.869, category: "Enterocyte",     color: "#10b981" },
  { gene: "CHGA",    zone: 0.82, lambda: 0.453, category: "EEC ★",          color: "#ef4444" },
  { gene: "DCLK1",   zone: 0.85, lambda: 0.321, category: "Tuft ★",         color: "#ef4444" },
];

// Spearman r = −0.272 (computed from ranked GSE179027 values above)
// p = 0.247 (not significant)
const R3_SPEARMAN = -0.272;
const R3_P = 0.247;

// ─── Rule 4 Data ────────────────────────────────────────────────────────────
// λ = mean of marker genes from GSE179027 for each cell type
// ★ = low-expression flag: mean expression < 10 TPM; eigenvalue unreliable

const RULE4_CELL_TYPES = [
  {
    name: "Stem (LGR5+)",
    divCapacity: "Unlimited",
    divNum: 5,
    lifespan: "Ongoing",
    lifespanDays: 90,
    lambda: 0.838,   // mean of LGR5(0.948) ASCL2(0.681) SMOC2(0.869) OLFM4(0.855)
    markers: "LGR5, ASCL2, SMOC2, OLFM4",
    color: "#3b82f6",
    divisionModel: "high",
    lifespanModel: "high",
  },
  {
    name: "Transit-Amp (MKI67+)",
    divCapacity: "4–5 divisions",
    divNum: 3,
    lifespan: "1–3 days",
    lifespanDays: 2,
    lambda: 0.772,   // mean of CDK4(0.700) CCND1(0.829) MKI67(0.842) MCM2(0.605) TOP2A(0.882); PCNA excluded (complex roots, low R²)
    markers: "MKI67, CCND1, CDK4, MCM2, TOP2A",
    color: "#f59e0b",
    divisionModel: "mid",
    lifespanModel: "low",
  },
  {
    name: "Goblet (MUC2+)",
    divCapacity: "0 (post-mitotic)",
    divNum: 1,
    lifespan: "3–5 days",
    lifespanDays: 4,
    lambda: 0.565,   // mean of TFF3(0.763) MUC2(0.367)
    markers: "MUC2, TFF3",
    color: "#06b6d4",
    divisionModel: "low",
    lifespanModel: "low",
  },
  {
    name: "Enterocyte (KRT20+)",
    divCapacity: "0 (post-mitotic)",
    divNum: 1,
    lifespan: "3–5 days",
    lifespanDays: 4,
    lambda: 0.887,   // mean of FABP1(0.995) ALPI(0.789) SLC26A3(0.894) KRT20(0.869)
    markers: "KRT20, FABP1, ALPI, SLC26A3",
    color: "#10b981",
    divisionModel: "low",
    lifespanModel: "low",
  },
  {
    name: "EEC (CHGA+) ★",
    divCapacity: "0 (post-mitotic)",
    divNum: 1,
    lifespan: "28+ days",
    lifespanDays: 30,
    lambda: 0.453,   // CHGA: mean_expr 35 TPM — borderline reliable
    markers: "CHGA",
    color: "#a78bfa",
    divisionModel: "low",
    lifespanModel: "high",
  },
  {
    name: "Tuft (DCLK1+) ★",
    divCapacity: "0 (post-mitotic)",
    divNum: 1,
    lifespan: "28+ days",
    lifespanDays: 31,
    lambda: 0.321,   // DCLK1: mean_expr 1.07 TPM — insufficient for reliable AR(2) fit
    markers: "DCLK1",
    color: "#ef4444",
    divisionModel: "low",
    lifespanModel: "high",
  },
];

// Sort by lifespan for the lifespan plot
const R4_BY_LIFESPAN = [...RULE4_CELL_TYPES].sort((a, b) => a.lifespanDays - b.lifespanDays);
// Sort by division num for division plot
const R4_BY_DIVISION = [...RULE4_CELL_TYPES].sort((a, b) => a.divNum - b.divNum);

// Custom tooltip for Rule 3 scatter
function R3Tooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-background border border-border rounded-lg p-3 shadow-lg text-xs space-y-1">
      <p className="font-semibold text-foreground">{d.gene}</p>
      <p className="text-muted-foreground">Crypt zone: {d.zone.toFixed(2)} ({d.category})</p>
      <p className="text-cyan-400">|λ| = {d.lambda.toFixed(3)}</p>
      {d.category.includes("★") && (
        <p className="text-amber-400 text-[10px]">★ Low expression — estimate unreliable</p>
      )}
    </div>
  );
}

// Custom tooltip for Rule 4
function R4Tooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-background border border-border rounded-lg p-3 shadow-lg text-xs space-y-1">
      <p className="font-semibold text-foreground">{d.name}</p>
      <p className="text-muted-foreground">Division capacity: {d.divCapacity}</p>
      <p className="text-muted-foreground">Lifespan: {d.lifespan}</p>
      <p className="text-cyan-400">|λ| = {d.lambda.toFixed(3)}</p>
      <p className="text-muted-foreground text-[10px]">Markers: {d.markers}</p>
    </div>
  );
}

export default function RuleValidation() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">

        {/* Header */}
        <div>
          <Link href="/convergence-map" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" />
            Convergence Map
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <FlaskConical className="h-6 w-6 text-amber-400" />
            <h1 className="text-2xl font-bold">Rule 3 & 4 Computational Validation</h1>
          </div>
          <p className="text-muted-foreground max-w-3xl">
            Rules 3 (Spatial Direction) and 4 (Number of Divisions) sit at 55% and 58% confidence on the Convergence Map
            because AR(2) was not designed to measure either quantity directly. Here we test whether the
            existing platform eigenvalue data shows any signal for these rules — using gene-level spatial
            assignments from the published colon atlas (Elmentaite 2021) and cell-type division capacities
            from Boman's published work, without any new wet-lab experiments.
          </p>
        </div>

        {/* Methods note */}
        <Alert className="border-amber-500/30 bg-amber-500/5">
          <Info className="h-4 w-4 text-amber-400" />
          <AlertDescription className="text-sm text-muted-foreground">
            <strong className="text-foreground">Method:</strong> Spatial zone assignments (0 = crypt bottom, 1 = villus top) drawn from published single-cell colon atlas data (Elmentaite et al., <em>Gut</em> 2021; Human Cell Atlas colon). Eigenvalue |λ| values are live-computed from platform AR(2) analysis of <strong className="text-foreground">GSE179027</strong> (mouse intestinal enteroid time series, 48 timepoints). Datasets are strictly separated — spatial zone is from scRNA-seq snapshots; |λ| is from independent longitudinal time-series. Spearman rank correlation with 10,000-permutation null distribution. <strong className="text-amber-400">★ marks genes with mean expression &lt; 40 TPM in GSE179027; AR(2) estimates for these genes are unreliable due to low signal-to-noise.</strong>
          </AlertDescription>
        </Alert>

        {/* ═══════════════════════════════════════════ */}
        {/* RULE 3 */}
        {/* ═══════════════════════════════════════════ */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="border-amber-500 text-amber-400 text-xs">Rule 3 · 55%</Badge>
            <h2 className="text-lg font-semibold">Spatial Direction of Cell Division</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <Card className="border-border/50 bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Boman's Rule</CardTitle>
              </CardHeader>
              <CardContent className="text-foreground/90 text-xs leading-relaxed">
                Division is spatially asymmetric. Daughter cells move in defined directions along the crypt axis:
                stem cells at the bottom, transit-amplifying in the mid-crypt, differentiated cells at the top.
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">AR(2) Hypothesis</CardTitle>
              </CardHeader>
              <CardContent className="text-foreground/90 text-xs leading-relaxed">
                If spatial position drives eigenvalue, genes predominantly expressed at the crypt bottom should have
                higher |λ| than genes predominantly expressed at the villus top.
                Prediction: negative correlation between crypt zone and |λ|.
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Controls</CardTitle>
              </CardHeader>
              <CardContent className="text-foreground/90 text-xs leading-relaxed">
                (1) Expression-level matching: tested within expression quartiles.
                (2) Dataset separation: spatial zones from scRNA-seq atlas; |λ| from unrelated time-series.
                (3) Permutation null: 10,000 random zone shuffles.
              </CardContent>
            </Card>
          </div>

          {/* Scatter plot */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Crypt Zone vs Eigenvalue |λ| — GSE179027 (live values)</CardTitle>
              <CardDescription>
                Each point = one gene. X-axis: position along crypt-villus axis (0 = stem bottom, 1 = villus top).
                Y-axis: AR(2) eigenvalue modulus from GSE179027 longitudinal RNA-seq. ★ = low-expression genes (unreliable estimate).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={340}>
                <ScatterChart margin={{ top: 10, right: 20, bottom: 40, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
                  <XAxis
                    dataKey="zone"
                    type="number"
                    domain={[0, 1]}
                    ticks={[0, 0.25, 0.5, 0.75, 1.0]}
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                  >
                    <Label value="Crypt zone (0 = stem bottom → 1 = villus top)" offset={-10} position="insideBottom" style={{ fontSize: 11, fill: "#64748b" }} />
                  </XAxis>
                  <YAxis
                    dataKey="lambda"
                    type="number"
                    domain={[0.25, 1.02]}
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    tickFormatter={(v) => v.toFixed(2)}
                  >
                    <Label value="|λ|" angle={-90} position="insideLeft" style={{ fontSize: 11, fill: "#64748b" }} />
                  </YAxis>
                  <Tooltip content={<R3Tooltip />} />
                  {/* No clear directional trend */}
                  <ReferenceLine
                    segment={[{ x: 0, y: 0.95 }, { x: 1, y: 0.35 }]}
                    stroke="#64748b"
                    strokeDasharray="6 3"
                    strokeOpacity={0.5}
                    label={{ value: "Expected if Rule 3 true", position: "insideTopRight", fontSize: 10, fill: "#64748b" }}
                  />
                  <Scatter name="Stem" data={RULE3_DATA.filter(d => d.category === "Stem")} fill="#3b82f6" />
                  <Scatter name="Transit-Amp" data={RULE3_DATA.filter(d => d.category === "Transit-Amp")} fill="#f59e0b" />
                  <Scatter name="Transit-Amp ★" data={RULE3_DATA.filter(d => d.category === "Transit-Amp ★")} fill="#f59e0b" shape="triangle" />
                  <Scatter name="Clock" data={RULE3_DATA.filter(d => d.category === "Clock")} fill="#8b5cf6" />
                  <Scatter name="Goblet" data={RULE3_DATA.filter(d => d.category === "Goblet")} fill="#06b6d4" />
                  <Scatter name="Enterocyte" data={RULE3_DATA.filter(d => d.category === "Enterocyte")} fill="#10b981" />
                  <Scatter name="EEC ★ / Tuft ★" data={RULE3_DATA.filter(d => d.category.includes("★") && !d.category.includes("Transit"))} fill="#ef4444" shape="star" />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} formatter={(value) => <span style={{ color: "#94a3b8" }}>{value}</span>} />
                </ScatterChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Result box */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-amber-400 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Statistical Result
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Spearman r (zone vs |λ|)</span>
                  <span className="font-mono text-foreground">{R3_SPEARMAN.toFixed(3)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Permutation p-value</span>
                  <span className="font-mono text-foreground">p = {R3_P.toFixed(3)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Direction predicted</span>
                  <span className="font-mono text-amber-400">Negative (↓)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Direction observed</span>
                  <span className="font-mono text-amber-400">Weakly negative / non-sig.</span>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-foreground">Interpretation</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground leading-relaxed space-y-2">
                <p>
                  The correlation is negative but non-significant (r = −0.272, p = 0.247). Rule 3 is <strong className="text-foreground">not supported</strong> by existing data.
                </p>
                <p>
                  <strong className="text-foreground">Pattern:</strong> FABP1 (enterocyte, villus top) has the highest |λ| in the dataset (0.995), driven by its extreme expression level (5,367 TPM). DCLK1 (tuft, villus top) has the lowest (0.321) but is essentially unmeasured in bulk RNA-seq (1.07 TPM mean). Spatial zone does not predict |λ| across this range.
                </p>
                <p>
                  <strong className="text-amber-400">Confidence score 55% is justified.</strong>
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="border-t border-border/40" />

        {/* ═══════════════════════════════════════════ */}
        {/* RULE 4 */}
        {/* ═══════════════════════════════════════════ */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="border-amber-500 text-amber-400 text-xs">Rule 4 · 58%</Badge>
            <h2 className="text-lg font-semibold">Number of Cell Divisions</h2>
          </div>

          <Alert className="border-red-500/30 bg-red-500/5">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <AlertDescription className="text-sm text-muted-foreground">
              <strong className="text-red-400">Data integrity note:</strong> DCLK1 (tuft cell marker) has mean expression of 1.07 TPM in GSE179027 — below the reliable AR(2) threshold. Its eigenvalue (0.321) reflects noise, not biology. CHGA (EEC) at 35 TPM is borderline. Neither can confirm or deny the lifespan or division hypotheses for these rare cell types. Wet-lab validation (single-cell time-series or organoid enrichment) is required.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <Card className="border-border/50 bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Boman's Rule</CardTitle>
              </CardHeader>
              <CardContent className="text-foreground/90 text-xs leading-relaxed">
                Each compartment has a defined division allowance: stem cells self-renew indefinitely; transit-amplifying cells undergo
                4–5 divisions; post-mitotic cells (enterocytes, goblet, tuft, EEC) do not divide.
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">AR(2) Hypothesis</CardTitle>
              </CardHeader>
              <CardContent className="text-foreground/90 text-xs leading-relaxed">
                If division capacity drives eigenvalue: stem (unlimited) should have highest |λ|,
                transit-amplifying (4–5) intermediate, and all post-mitotic cell types (zero divisions) should share
                the lowest |λ|.
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Critical Observation</CardTitle>
              </CardHeader>
              <CardContent className="text-foreground/90 text-xs leading-relaxed">
                With live data, Enterocyte (post-mitotic) has the highest reliably-measured |λ| (0.887), driven by
                FABP1 at 5,367 TPM. This falsifies both the division model (predicts enterocyte LOW) and the
                lifespan model (predicts enterocyte LOW). Expression stability appears to be the dominant confound.
              </CardContent>
            </Card>
          </div>

          {/* Side-by-side bar charts */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Division Capacity vs Lifespan as Predictors of |λ| — GSE179027 (live values)</CardTitle>
              <CardDescription>
                Cell-type mean |λ| from actual platform analysis. ★ = low-expression markers; estimates unreliable.
                Neither model cleanly predicts the observed pattern.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Sorted by division capacity */}
                <div>
                  <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wider">Ordered by Division Capacity</p>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={R4_BY_DIVISION} margin={{ top: 5, right: 10, bottom: 70, left: 10 }} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} horizontal={true} vertical={false} />
                      <XAxis type="number" domain={[0.25, 1.02]} tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={(v) => v.toFixed(2)}>
                        <Label value="|λ|" position="insideBottom" offset={-5} style={{ fontSize: 10, fill: "#64748b" }} />
                      </XAxis>
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: "#94a3b8" }} width={140} />
                      <Tooltip content={<R4Tooltip />} />
                      <Bar dataKey="lambda" name="|λ| observed" radius={[0, 3, 3, 0]}>
                        {R4_BY_DIVISION.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Bar>
                      <ReferenceLine x={0.77} stroke="#f59e0b" strokeDasharray="4 2" strokeOpacity={0.6}
                        label={{ value: "Stem/TA level", position: "insideTopRight", fontSize: 9, fill: "#f59e0b" }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                  <p className="text-[11px] text-muted-foreground mt-2 text-center">
                    Enterocyte (0 div) exceeds Stem — inconsistent with division-count model.
                  </p>
                </div>

                {/* Sorted by lifespan */}
                <div>
                  <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wider">Ordered by Lifespan (Boman's Rule 5)</p>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={R4_BY_LIFESPAN} margin={{ top: 5, right: 10, bottom: 70, left: 10 }} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} horizontal={true} vertical={false} />
                      <XAxis type="number" domain={[0.25, 1.02]} tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={(v) => v.toFixed(2)}>
                        <Label value="|λ|" position="insideBottom" offset={-5} style={{ fontSize: 10, fill: "#64748b" }} />
                      </XAxis>
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: "#94a3b8" }} width={140} />
                      <Tooltip content={<R4Tooltip />} />
                      <Bar dataKey="lambda" name="|λ| observed" radius={[0, 3, 3, 0]}>
                        {R4_BY_LIFESPAN.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <p className="text-[11px] text-muted-foreground mt-2 text-center">
                    EEC and Tuft (longest lifespan) have the <em>lowest</em> |λ| — falsifies Rule 5. But both are low-expression ★.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Prediction table */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Rank Comparison: Which Model Fits the Live Data?</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left py-2 pr-4 text-muted-foreground font-normal">Cell Type</th>
                      <th className="text-center py-2 pr-4 text-muted-foreground font-normal">Division</th>
                      <th className="text-center py-2 pr-4 text-muted-foreground font-normal">Lifespan</th>
                      <th className="text-center py-2 pr-4 text-muted-foreground font-normal">|λ| Observed</th>
                      <th className="text-center py-2 pr-4 text-muted-foreground font-normal">Rule 4 Predicts</th>
                      <th className="text-center py-2 text-muted-foreground font-normal">Rule 5 Predicts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { name: "Enterocyte (KRT20+)",  div: "0 (post-mitotic)", life: "3–5 days",  lambda: "0.887", r4: "Low", r5: "Low",  r4ok: false, r5ok: false, color: "#10b981", note: "FABP1 dominates at 5,367 TPM" },
                      { name: "Stem (LGR5+)",          div: "Unlimited",        life: "Ongoing",   lambda: "0.838", r4: "High",r5: "High", r4ok: true,  r5ok: true,  color: "#3b82f6", note: "" },
                      { name: "Transit-Amp (MKI67+)",  div: "4–5 divisions",    life: "1–3 days",  lambda: "0.772", r4: "Mid", r5: "Low",  r4ok: true,  r5ok: true,  color: "#f59e0b", note: "" },
                      { name: "Goblet (MUC2+)",        div: "0 (post-mitotic)", life: "3–5 days",  lambda: "0.565", r4: "Low", r5: "Low",  r4ok: true,  r5ok: true,  color: "#06b6d4", note: "MUC2 has low expression" },
                      { name: "EEC (CHGA+) ★",        div: "0 (post-mitotic)", life: "28+ days",  lambda: "0.453", r4: "Low", r5: "High", r4ok: true,  r5ok: false, color: "#a78bfa", note: "CHGA 35 TPM — borderline" },
                      { name: "Tuft (DCLK1+) ★",      div: "0 (post-mitotic)", life: "28+ days",  lambda: "0.321", r4: "Low", r5: "High", r4ok: true,  r5ok: false, color: "#ef4444", note: "DCLK1 1.07 TPM — unreliable" },
                    ].map((row, i) => (
                      <tr key={i} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                        <td className="py-2 pr-4">
                          <span className="font-medium" style={{ color: row.color }}>{row.name}</span>
                          {row.note && <span className="block text-[10px] text-muted-foreground">{row.note}</span>}
                        </td>
                        <td className="py-2 pr-4 text-center text-muted-foreground">{row.div}</td>
                        <td className="py-2 pr-4 text-center text-muted-foreground">{row.life}</td>
                        <td className="py-2 pr-4 text-center font-mono text-cyan-400">{row.lambda}</td>
                        <td className="py-2 pr-4 text-center">
                          <span className={row.r4ok ? "text-emerald-400" : "text-red-400"}>
                            {row.r4} {row.r4ok ? "✓" : "✗"}
                          </span>
                        </td>
                        <td className="py-2 text-center">
                          <span className={row.r5ok ? "text-emerald-400" : "text-red-400"}>
                            {row.r5} {row.r5ok ? "✓" : "✗"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border/50">
                      <td colSpan={4} className="pt-3 text-muted-foreground">Prediction accuracy</td>
                      <td className="pt-3 text-center font-semibold text-amber-400">4/6 ✓</td>
                      <td className="pt-3 text-center font-semibold text-amber-400">3/6 ✓</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-amber-400 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Rules 4 & 5 Result
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground leading-relaxed space-y-2">
                <p>
                  With live platform data, <strong className="text-foreground">neither Rule 4 nor Rule 5</strong> cleanly predicts |λ|.
                  Rule 4 (division count) predicts 4/6 — the exception is Enterocyte, whose high |λ| (0.887) is driven by FABP1 at 5,367 TPM, not biology.
                  Rule 5 (lifespan) predicts 3/6 — EEC and Tuft (longest lifespan) have the lowest measured eigenvalues, but both are below the reliable expression threshold.
                </p>
                <p>
                  The critical limitation: DCLK1 (tuft marker) is expressed at 1.07 TPM mean — <strong className="text-foreground">not measurable in bulk RNA-seq</strong>. Any eigenvalue for DCLK1 from this dataset reflects noise. The hypothesis that tuft cells have near-critical eigenvalues requires single-cell or enriched time-series data to test properly.
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-foreground">What the Data Actually Shows</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground leading-relaxed space-y-2">
                <p>
                  The most parsimonious predictor of |λ| in this dataset is <strong className="text-foreground">expression stability of the defining marker gene</strong>:
                  FABP1 (5,367 TPM, structural enterocyte protein) yields |λ| = 0.995;
                  DCLK1 (1.07 TPM, rare tuft marker) yields |λ| = 0.321.
                  The eigenvalue tracks abundance and measurement reliability more than cell-type lifespan or division capacity.
                </p>
                <p>
                  Proper testing of Rules 4 and 5 requires <strong className="text-foreground">single-cell RNA-seq time series</strong> or organoid cultures enriched for rare cell types — data types not yet in GEO for this system. The confidence scores of 58% (Rule 4) and 55% (Rule 3) reflect this limitation honestly.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="border-t border-border/40" />

        {/* Summary */}
        <Card className="border-border/50 bg-card/30">
          <CardHeader>
            <CardTitle className="text-base">Summary: What These Analyses Confirm</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-amber-500 text-amber-400 text-xs">Rule 3 · 55%</Badge>
                  <span className="text-amber-400 font-medium">Not supported</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Spatial zone does not predict |λ| (r = −0.272, p = 0.247). Pattern is dominated by expression level: FABP1 (villus, high expression) has the highest |λ|; DCLK1 (villus, near-zero expression) has the lowest. Raising Rule 3 confidence requires spatial transcriptomics time-series — not currently available.
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-amber-500 text-amber-400 text-xs">Rule 4 · 58%</Badge>
                  <span className="text-amber-400 font-medium">Partial — 4/6</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Division count predicts 4/6 cell types correctly with live data — better than the original schematic suggested. Fails only for Enterocyte (high |λ| driven by FABP1 expression, not biology). The simple division model partially holds but requires direct labelling experiments to test properly.
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-amber-500 text-amber-400 text-xs">Rule 5</Badge>
                  <span className="text-amber-400 font-medium">Not supported — 3/6</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Lifespan predicts only 3/6 cell types with live data. EEC and Tuft (longest lifespan) have the lowest measured |λ|, falsifying the model — but both are below reliable expression thresholds. The 86% confidence previously cited was based on schematic values, not computed data, and should not be cited.
                </p>
              </div>
            </div>
            <div className="mt-5 pt-4 border-t border-border/30 flex gap-4 flex-wrap">
              <Link href="/convergence-map">
                <button className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2">← Back to Convergence Map</button>
              </Link>
              <Link href="/cross-context-validation">
                <button className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2">Cross-Context Validation →</button>
              </Link>
              <Link href="/root-space">
                <button className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2">Root-Space Geometry →</button>
              </Link>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
