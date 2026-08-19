import { useQuery } from "@tanstack/react-query";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, FlaskConical, Info, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadAsCSV } from "@/components/DownloadResultsButton";

const SPECIES_COLORS: Record<string, string> = {
  Mouse: "#22d3ee",
  Human: "#a78bfa",
  Baboon: "#f59e0b",
  Arabidopsis: "#4ade80",
};

const CONSISTENCY_COLOR: Record<string, string> = {
  high: "#4ade80",
  moderate: "#f59e0b",
  low: "#f87171",
};

function PhiBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-slate-500 text-sm">n/a</span>;
  return (
    <span className="font-mono text-sm font-semibold text-slate-600">
      {value.toFixed(3)}
    </span>
  );
}

function SpeciesCard({ s }: { s: any }) {
  const color = SPECIES_COLORS[s.species] ?? "#94a3b8";
  const sig = s.pValue < 0.001 ? "p < 0.001" : s.pValue < 0.01 ? `p = ${s.pValue.toFixed(3)}` : s.pValue < 0.05 ? `p = ${s.pValue.toFixed(3)}` : `p = ${s.pValue.toFixed(2)} (ns)`;
  const isSig = s.pValue < 0.05;

  return (
    <Card className="bg-slate-50 border-slate-200">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base" style={{ color }}>{s.species}</CardTitle>
          <Badge variant="outline" className="text-xs border-slate-300 text-slate-500">{s.dataset} · {s.tissue}</Badge>
        </div>
        <CardDescription className="text-xs text-slate-500">
          {s.clockGenes.length} clock genes fitted · {s.backgroundGenes.length} background genes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-slate-100 rounded p-2">
            <div className="text-slate-500">Mean β₁/β₂</div>
            <div className="font-mono font-semibold text-slate-900 mt-0.5">
              {s.clockMeanRatio !== null ? s.clockMeanRatio.toFixed(3) : "—"}
            </div>
          </div>
          <div className="bg-slate-100 rounded p-2">
            <div className="text-slate-500">Near 1.618 (±10%)</div>
            <div className="font-semibold text-slate-900 mt-0.5">
              {s.clockFibLikeCount}/{s.clockGenes.length}
              <span className="text-slate-500 ml-1">({(s.clockFibLikePct * 100).toFixed(0)}%)</span>
            </div>
          </div>
          <div className="bg-slate-100 rounded p-2">
            <div className="text-slate-500">Null rate (filtered)</div>
            <div className="font-mono font-semibold text-slate-900 mt-0.5">{(s.nullFibLikeRate * 100).toFixed(1)}%</div>
          </div>
          <div className="bg-slate-100 rounded p-2">
            <div className="text-slate-500">Enrichment · {sig}</div>
            <div className={`font-semibold mt-0.5 ${isSig ? "text-amber-400" : "text-slate-500"}`}>
              {s.enrichmentRatio.toFixed(1)}×
              {isSig
                ? <CheckCircle className="inline ml-1 w-3 h-3 text-emerald-400" />
                : <AlertTriangle className="inline ml-1 w-3 h-3 text-slate-500" />}
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-xs text-slate-500 font-medium mb-1">Clock gene β₁/β₂ ratios</div>
          {s.clockGenes.length === 0 && (
            <div className="text-xs text-slate-500 italic">No clock genes found in dataset</div>
          )}
          {s.clockGenes.slice(0, 12).map((g: any) => (
            <div key={g.gene} className="flex items-center justify-between text-xs">
              <span className="font-mono w-24 text-slate-600">{g.gene}</span>
              <div className="flex-1 mx-2 bg-slate-100 rounded-full h-1.5 relative overflow-hidden">
                <div
                  className="h-full rounded-full bg-slate-600"
                  style={{ width: `${Math.min(100, (g.fibSimilarity * 100))}%` }}
                />
              </div>
              <PhiBadge value={g.ratio} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function RatioScatterPlot({ data }: { data: any[] }) {
  const points = data.flatMap((s: any) =>
    s.clockGenes.filter((g: any) => g.ratio !== null).map((g: any) => ({
      x: g.eigenvalue,
      y: g.ratio,
      gene: g.gene,
      species: g.species,
    }))
  );

  const bgPoints = data.flatMap((s: any) =>
    s.backgroundGenes.filter((g: any) => g.ratio !== null).slice(0, 15).map((g: any) => ({
      x: g.eigenvalue,
      y: g.ratio,
      gene: g.gene,
      species: g.species,
    }))
  );

  return (
    <ResponsiveContainer width="100%" height={360}>
      <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis
          dataKey="x"
          type="number"
          domain={[0, 1.05]}
          label={{ value: "|λ| eigenvalue modulus", position: "insideBottom", offset: -10, fill: "#94a3b8", fontSize: 11 }}
          tick={{ fill: "#94a3b8", fontSize: 10 }}
        />
        <YAxis
          dataKey="y"
          type="number"
          domain={[0, 6]}
          label={{ value: "|β₁/β₂| ratio", angle: -90, position: "insideLeft", fill: "#94a3b8", fontSize: 11 }}
          tick={{ fill: "#94a3b8", fontSize: 10 }}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload;
            return (
              <div className="bg-slate-100 border border-slate-200 rounded p-2 text-xs space-y-1">
                <div className="font-semibold text-slate-900">{d.gene} <span className="text-slate-500">({d.species})</span></div>
                <div className="text-slate-600">β₁/β₂ = <span className="font-mono text-amber-400">{typeof d.y === 'number' ? d.y.toFixed(3) : d.y}</span></div>
                <div className="text-slate-600">|λ| = <span className="font-mono text-cyan-400">{typeof d.x === 'number' ? d.x.toFixed(3) : d.x}</span></div>
              </div>
            );
          }}
        />
        <Scatter name="Background" data={bgPoints} fill="#475569" fillOpacity={0.35} r={3} />
        {Object.entries(SPECIES_COLORS).map(([species, color]) => (
          <Scatter
            key={species}
            name={species}
            data={points.filter(p => p.species === species)}
            fill={color}
            fillOpacity={0.85}
            r={5}
          />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  );
}

function SharedGenesTable({ genes }: { genes: any[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="text-left py-2 px-3 text-slate-500 font-medium">Gene</th>
            <th className="text-center py-2 px-2 text-cyan-400">Mouse</th>
            <th className="text-center py-2 px-2 text-violet-400">Human</th>
            <th className="text-center py-2 px-2 text-amber-400">Baboon</th>
            <th className="text-center py-2 px-2 text-green-400">Arabidopsis</th>
            <th className="text-center py-2 px-3 text-slate-500">Mean β₁/β₂</th>
            <th className="text-center py-2 px-3 text-slate-500">Consistency</th>
          </tr>
        </thead>
        <tbody>
          {genes.map((g: any) => {
            const getRatio = (sp: string) => g.ratios.find((r: any) => r.species === sp);
            return (
              <tr key={g.humanName} className="border-b border-slate-800/50 hover:bg-slate-50">
                <td className="py-2 px-3 font-mono text-slate-800">{g.humanName}</td>
                {['Mouse','Human','Baboon','Arabidopsis'].map(sp => {
                  const r = getRatio(sp);
                  if (!r) return <td key={sp} className="py-2 px-2 text-center text-slate-600">—</td>;
                  return (
                    <td key={sp} className="py-2 px-2 text-center">
                      <span className="font-mono font-semibold text-slate-500">
                        {r.ratio !== null ? r.ratio.toFixed(3) : "—"}
                      </span>
                    </td>
                  );
                })}
                <td className="py-2 px-3 text-center font-mono text-slate-800">
                  {g.meanRatio !== null ? g.meanRatio.toFixed(3) : "—"}
                </td>
                <td className="py-2 px-3 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold`}
                    style={{ backgroundColor: `${CONSISTENCY_COLOR[g.consistency]}22`, color: CONSISTENCY_COLOR[g.consistency] }}>
                    {g.consistency}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="text-xs text-slate-500 mt-2 px-3">
        Arabidopsis uses functional analogs (CCA1≈ARNTL, TOC1≈PER2).
      </div>
    </div>
  );
}

function EnrichmentBarChart({ data }: { data: any[] }) {
  const bars = data.map((s: any) => ({
    species: s.species,
    observed: parseFloat((s.clockFibLikePct * 100).toFixed(1)),
    null: parseFloat((s.nullFibLikeRate * 100).toFixed(1)),
    significant: s.pValue < 0.05,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={bars} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis dataKey="species" tick={{ fill: "#94a3b8", fontSize: 11 }} />
        <YAxis
          tick={{ fill: "#94a3b8", fontSize: 10 }}
          label={{ value: "% near 1.618", angle: -90, position: "insideLeft", fill: "#94a3b8", fontSize: 10 }}
        />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return (
              <div className="bg-slate-100 border border-slate-200 rounded p-2 text-xs space-y-1">
                <div className="font-semibold text-slate-900">{label}</div>
                <div className="text-amber-400">Clock genes: {payload.find(p => p.dataKey === 'observed')?.value}%</div>
                <div className="text-slate-500">Null (stability-filtered): {payload.find(p => p.dataKey === 'null')?.value}%</div>
              </div>
            );
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
        <Bar dataKey="observed" name="Clock genes" radius={[3, 3, 0, 0]}>
          {bars.map((b) => (
            <Cell key={b.species} fill="#64748b" />
          ))}
        </Bar>
        <Bar dataKey="null" name="Stability-filtered null" fill="#334155" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function CrossSpeciesPhi() {
  const { data, isLoading, error } = useQuery<any>({
    queryKey: ["/api/cross-species-phi"],
    staleTime: 1000 * 60 * 10,
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 pb-16">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">

        <div>
          <div className="flex items-center gap-3 mb-2">
            <FlaskConical className="w-6 h-6 text-amber-400" />
            <h1 className="text-2xl font-bold text-slate-900">Cross-Species AR(2) Coefficient Ratio Analysis</h1>
            <Badge className="bg-slate-400/20 text-slate-500 border-slate-400/40 text-xs">Negative result</Badge>
          </div>
          <p className="text-slate-500 text-sm max-w-3xl">
            We tested whether the AR(2) coefficient ratio β₁/β₂ clusters near φ = 1.618 for circadian clock genes
            across species. The ratio β₁/β₂ depends on both oscillation period and sampling interval, making it
            a sampling-rate-sensitive metric. This page presents the result against a stability-filtered null.
          </p>
          <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 flex gap-2">
            <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
            <span>
              The null model samples random AR(2) coefficients restricted to biologically stable processes only
              (|β₂| &lt; 1, β₁+β₂ &lt; 1, β₂−β₁ &lt; 1). Without this filter the false-positive rate exceeds 80%.
              "Near 1.618" is defined as |β₁/β₂ − 1.618| &lt; 0.162 (within 10% of 1.618).
            </span>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-slate-500">Fitting AR(2) across species datasets…</span>
            </div>
          </div>
        )}

        {error && (
          <Card className="bg-red-950/30 border-red-800">
            <CardContent className="pt-4 text-sm text-red-400">
              Analysis failed: {String(error)}
            </CardContent>
          </Card>
        )}

        {data && (
          <>
            <Card className="bg-slate-50 border-slate-200">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base text-amber-400">Summary</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-slate-600 border-slate-300 text-xs"
                    onClick={() => downloadAsCSV(
                      data.species.map((s: any) => ({
                        species: s.species,
                        dataset: s.dataset,
                        tissue: s.tissue,
                        clock_genes_n: s.clockGenes?.length ?? '',
                        background_genes_n: s.backgroundGenes?.length ?? '',
                        clock_fib_like_count: s.clockFibLikeCount,
                        clock_fib_like_pct: (s.clockFibLikePct * 100).toFixed(1),
                        null_fib_like_rate_pct: (s.nullFibLikeRate * 100).toFixed(1),
                        enrichment_ratio: s.enrichmentRatio,
                        p_value: s.pValue,
                        significant: s.pValue < 0.05,
                        clock_mean_ratio: s.clockMeanRatio,
                      })),
                      'cross_species_phi_enrichment.csv'
                    )}
                    data-testid="button-download-cross-species-csv"
                  >
                    <Download size={13} className="mr-1" /> Download CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600">{data.summary}</p>
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {data.species.map((s: any) => (
                    <div key={s.species} className="bg-slate-100 rounded p-2 text-center">
                      <div className="text-xs text-slate-500">{s.species}</div>
                      <div className={`font-semibold text-sm mt-1 ${s.pValue < 0.05 ? "text-amber-400" : "text-slate-500"}`}>
                        {s.enrichmentRatio.toFixed(1)}× enrichment
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {s.pValue < 0.001 ? "p < 0.001" : s.pValue < 0.05 ? `p = ${s.pValue.toFixed(3)}` : "ns"}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <Card className="bg-slate-50 border-slate-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-slate-900">Clock gene β₁/β₂ vs |λ|</CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Each dot is one clock gene in one species. Grey = background genes. Ratios are highly variable across species — no clustering.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RatioScatterPlot data={data.species} />
                  <div className="flex flex-wrap gap-3 mt-2 text-xs">
                    {Object.entries(SPECIES_COLORS).map(([sp, col]) => (
                      <span key={sp} className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: col }} />
                        {sp}
                      </span>
                    ))}
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full inline-block bg-slate-600" />
                      Background
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-50 border-slate-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-slate-900">Rate near 1.618 vs null</CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Coloured bars = observed clock genes. Dark bars = stability-filtered null expectation.
                    No species shows significant enrichment above null.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <EnrichmentBarChart data={data.species} />
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {data.species.map((s: any) => <SpeciesCard key={s.species} s={s} />)}
            </div>

            <Card className="bg-slate-50 border-slate-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-slate-900">Conserved gene pair β₁/β₂ ratios across species</CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  The key test: do the same orthologous genes sit near φ independently in each species?
                  High consistency = same gene converges on φ in ≥2 species with spread &lt; 0.3.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SharedGenesTable genes={data.sharedGenes} />
              </CardContent>
            </Card>

            <Card className="bg-red-950/20 border-red-800/50">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm text-red-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  Prediction result: Not confirmed
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-slate-500 space-y-3">
                <p>
                  The prediction stated that β₁/β₂ ≈ φ = 1.618 should hold for clock genes independently across
                  species. <strong className="text-slate-800">It does not.</strong> Ratios range from 0.27 (human ARNTL) to 14.6 (Arabidopsis CCA1),
                  with no species showing significant enrichment above the stability-filtered null. No shared
                  gene pair shows consistent cross-species proximity to φ.
                </p>
                <p>
                  The closest case observed is <strong className="text-amber-300">Nr1d1/NR1D1 (REV-ERBα)</strong> in mouse liver
                  — β₁/β₂ = 1.820, 87.5% Fibonacci similarity, 12.4% from φ, just outside the ±10% window.
                  This is worth noting but does not constitute confirmation.
                </p>
                <p>
                  This is a genuine negative result on a pre-stated prediction, and it is informative. It means one of
                  three things: (a) the Fibonacci coefficient ratio signal is context-specific to particular genes or
                  datasets, not a general property of clock gene dynamics; (b) the signal found in the original
                  analysis (e.g. Chek2 at 99.4% in a different dataset) does not generalise; or (c) the coefficient
                  ratio is too sensitive to dataset characteristics — number of timepoints, tissue type, noise level —
                  to be a robust cross-species signal. The eigenvalue modulus |λ|, by contrast, IS conserved
                  across species. That remains the more robust finding.
                </p>
                <p>
                  Arabidopsis uses functional analogs rather than true sequence orthologs — the plant clock evolved
                  independently. The wildly different ratios there (7–23) suggest no mechanistic connection at
                  the coefficient level, even if eigenvalue moduli are broadly similar.
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
