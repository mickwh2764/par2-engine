import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { ArrowLeft, Dna, Info, FlaskConical, TrendingUp, GitCompare, Layers } from "lucide-react";
import { useState } from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, BarChart, Bar, Cell,
  LineChart, Line, Legend,
} from "recharts";

const TIER_COLORS: Record<string, string> = {
  ps1_universal:        "#6b7280",
  ps2_eukaryotic:       "#8b5cf6",
  ps4_metazoan:         "#3b82f6",
  ps7_vertebrate_clock: "#f59e0b",
  ps8_vertebrate_other: "#10b981",
};

const TIER_ORDER = ["ps1_universal","ps2_eukaryotic","ps4_metazoan","ps7_vertebrate_clock","ps8_vertebrate_other"];

const GENOTYPE_COLORS: Record<string, string> = {
  WT:     "#3b82f6",
  ApcKO:  "#ef4444",
  BmalKO: "#6366f1",
  DblKO:  "#f59e0b",
};

function pFmt(p: number | null | undefined): string {
  if (p === null || p === undefined) return "—";
  if (p < 0.001) return p.toExponential(2);
  return p.toFixed(4);
}

function ScatterTooltipContent({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const g = payload[0].payload;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 max-w-xs text-xs shadow-xl">
      <div className="font-bold text-white text-sm mb-1 font-mono">{g.gene}</div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-gray-400">
        <span>|λ|</span>
        <span className="text-amber-400 font-mono">{g.lambda?.toFixed(4)}</span>
        <span>Age</span>
        <span className="text-blue-300">{g.age_mya?.toLocaleString()} Mya</span>
        <span>PS</span>
        <span className="text-gray-300">{g.ps}</span>
        <span>Category</span>
        <span className="text-gray-300">{g.category?.replace(/_/g," ")}</span>
      </div>
    </div>
  );
}

function BarTooltipContent({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs shadow-xl">
      <div className="font-semibold text-white mb-2">{d.label} ({d.age_range})</div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-gray-400">
        <span>Median |λ|</span><span className="font-mono text-white">{d.median?.toFixed(3)}</span>
        <span>Mean |λ|</span><span className="font-mono text-gray-300">{d.mean?.toFixed(3)}</span>
        <span>Q25–Q75</span><span className="font-mono text-gray-300">{d.q25?.toFixed(3)}–{d.q75?.toFixed(3)}</span>
        <span>Range</span><span className="font-mono text-gray-300">{d.min?.toFixed(3)}–{d.max?.toFixed(3)}</span>
        <span>n genes</span><span className="font-mono text-gray-300">{d.n}</span>
      </div>
    </div>
  );
}

// ─── Shared single-genotype view ─────────────────────────────────────────────
function GenotypeSingleView({ gData, genomeWide, highlightTier, setHighlightTier, tableSort, setTableSort, tierFilter, setTierFilter, tableSearch, setTableSearch }: any) {
  const { tierStats, kruskalWallis, pairwiseClockVsOther, nonClockComparisons, tierPercentiles, genes } = gData;

  const barData = TIER_ORDER
    .map((t: string) => tierStats?.find((s: any) => s.tier === t))
    .filter(Boolean)
    .map((t: any) => ({
      tier: t.tier, label: t.label, age_range: t.age_range,
      median: t.median, mean: t.mean, q25: t.q25, q75: t.q75,
      min: t.min, max: t.max, n: t.n,
    }));

  const scatterData = (genes ?? []).map((g: any) => ({ ...g, x: g.age_mya, y: g.lambda }));
  const clockTier = tierStats?.find((t: any) => t.tier === "ps7_vertebrate_clock");
  const ps4Tier   = tierStats?.find((t: any) => t.tier === "ps4_metazoan");

  const filteredGenes = [...(genes ?? [])]
    .filter((g: any) => {
      if (tierFilter && g.tier !== tierFilter) return false;
      if (tableSearch && !g.gene.toLowerCase().includes(tableSearch.toLowerCase())) return false;
      return true;
    })
    .sort((a: any, b: any) => {
      if (tableSort === "lambda_desc") return b.lambda - a.lambda;
      if (tableSort === "lambda_asc")  return a.lambda - b.lambda;
      if (tableSort === "age")         return b.age_mya - a.age_mya;
      return TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier);
    });

  return (
    <div className="space-y-5">
      {/* Tier summary boxes */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-base">|λ| by Evolutionary Tier</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            {TIER_ORDER.map((tier: string) => {
              const t = tierStats?.find((s: any) => s.tier === tier);
              if (!t) return null;
              const pct = tierPercentiles?.find((p: any) => p.tier === tier);
              return (
                <button
                  key={tier}
                  data-testid={`tier-box-${tier}`}
                  onClick={() => setHighlightTier(highlightTier === tier ? null : tier)}
                  className="rounded-lg border p-3 text-left transition-all"
                  style={{
                    borderColor: TIER_COLORS[tier] + (highlightTier === tier ? "cc" : "50"),
                    background: TIER_COLORS[tier] + (highlightTier === tier ? "25" : "10"),
                    boxShadow: highlightTier === tier ? `0 0 0 2px ${TIER_COLORS[tier]}40` : "none",
                  }}
                >
                  <div className="text-xs font-semibold mb-0.5" style={{ color: TIER_COLORS[tier] }}>{t.label}</div>
                  <div className="text-xs text-gray-400 mb-2">{t.age_range} · {t.ps}</div>
                  <div className="text-2xl font-bold text-white font-mono">{t.median.toFixed(3)}</div>
                  <div className="text-xs text-gray-400">median |λ|</div>
                  <div className="text-xs text-gray-500 mt-2">
                    IQR {t.q25.toFixed(3)}–{t.q75.toFixed(3)}<br />
                    mean {t.mean.toFixed(3)}<br />
                    n = {t.n}
                  </div>
                  {pct && (
                    <div className="text-xs mt-1" style={{ color: TIER_COLORS[tier] }}>
                      genome pct {pct.medianPercentile}th
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Bar chart */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-base">Median |λ| per Tier vs Within-Dataset Median</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={barData} margin={{ top: 10, right: 30, bottom: 60, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="label"
                tick={{ fill: "#9ca3af", fontSize: 10 }}
                angle={-20}
                textAnchor="end"
                interval={0}
              />
              <YAxis
                domain={[0.2, 0.85]}
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                tickFormatter={(v: number) => v.toFixed(2)}
                label={{ value: "Median |λ|", angle: -90, position: "insideLeft", fill: "#9ca3af", fontSize: 12 }}
              />
              <Tooltip content={<BarTooltipContent />} />
              <ReferenceLine y={genomeWide?.median ?? 0.496} stroke="#6b7280" strokeDasharray="4 3" strokeWidth={1.5}
                label={{ value: `Dataset median ${(genomeWide?.median ?? 0.496).toFixed(3)}`, position: "insideRight", fill: "#9ca3af", fontSize: 10 }} />
              {clockTier && (
                <ReferenceLine y={clockTier.median} stroke="#f59e0b" strokeDasharray="5 3" strokeWidth={1}
                  label={{ value: `Clock ${clockTier.median.toFixed(3)}`, position: "insideTopLeft", fill: "#f59e0b", fontSize: 9 }} />
              )}
              <Bar dataKey="median" name="Median |λ|" radius={[4, 4, 0, 0]}>
                {barData.map((entry: any) => (
                  <Cell
                    key={entry.tier}
                    fill={TIER_COLORS[entry.tier]}
                    opacity={highlightTier ? (highlightTier === entry.tier ? 1 : 0.3) : 1}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Scatter */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-white text-base">
              Evolutionary Age vs |λ| — {gData.nMatched ?? (genes?.length ?? 0)} genes
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              {TIER_ORDER.map((t: string) => {
                const ts = tierStats?.find((s: any) => s.tier === t);
                return (
                  <button
                    key={t}
                    data-testid={`tier-filter-scatter-${t}`}
                    onClick={() => setHighlightTier(highlightTier === t ? null : t)}
                    className="flex items-center gap-1.5 px-2 py-1 rounded border text-xs transition-all"
                    style={{
                      borderColor: TIER_COLORS[t],
                      background: highlightTier === t ? TIER_COLORS[t] + "30" : "transparent",
                      color: TIER_COLORS[t],
                    }}
                  >
                    ■ {ts?.label ?? t}
                  </button>
                );
              })}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={380}>
            <ScatterChart margin={{ top: 10, right: 30, bottom: 50, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="x" type="number"
                domain={[0, 3700]} reversed
                tickFormatter={(v: number) => v === 0 ? "Now" : `${(v/1000).toFixed(v >= 1000 ? 1 : 0)}Ga`}
                label={{ value: "Evolutionary age (Mya) — older →", position: "insideBottom", offset: -30, fill: "#9ca3af", fontSize: 11 }}
                stroke="#6b7280" tick={{ fill: "#9ca3af", fontSize: 10 }}
              />
              <YAxis
                dataKey="y" domain={[0.15, 1.05]}
                tickFormatter={(v: number) => v.toFixed(2)}
                label={{ value: "|λ|", angle: -90, position: "insideLeft", fill: "#9ca3af", fontSize: 13 }}
                stroke="#6b7280" tick={{ fill: "#9ca3af", fontSize: 10 }}
              />
              <Tooltip content={<ScatterTooltipContent />} />
              <ReferenceLine y={genomeWide?.median ?? 0.46} stroke="#6b7280" strokeDasharray="3 3" strokeWidth={1}
                label={{ value: `Dataset median`, position: "insideTopLeft", fill: "#6b7280", fontSize: 9 }} />
              {clockTier && (
                <ReferenceLine y={clockTier.median} stroke="#f59e0b" strokeDasharray="5 3" strokeWidth={1.5}
                  label={{ value: `Clock ${clockTier.median.toFixed(3)}`, position: "insideRight", fill: "#f59e0b", fontSize: 9 }} />
              )}
              {ps4Tier && (
                <ReferenceLine y={ps4Tier.median} stroke="#3b82f6" strokeDasharray="4 2" strokeWidth={1}
                  label={{ value: `PS4 ${ps4Tier.median.toFixed(3)}`, position: "insideBottomRight", fill: "#60a5fa", fontSize: 9 }} />
              )}
              {TIER_ORDER.map((tier: string) => {
                const tierGenes = scatterData.filter((g: any) => g.tier === tier);
                return (
                  <Scatter
                    key={tier}
                    data={tierGenes}
                    fill={TIER_COLORS[tier]}
                    opacity={highlightTier ? (highlightTier === tier ? 0.9 : 0.08) : 0.75}
                    r={4}
                  />
                );
              })}
            </ScatterChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Stats table */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-base">Statistical Tests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* KW */}
          <div>
            <div className="text-xs font-semibold text-gray-300 mb-2 uppercase tracking-wide">Kruskal-Wallis (all 5 tiers)</div>
            <div className="flex flex-wrap gap-4 text-sm" data-testid="kw-result">
              <div className="bg-gray-800 rounded-lg px-4 py-2">
                <span className="text-gray-400 text-xs">H statistic</span>
                <div className="font-mono font-bold text-white text-lg">{kruskalWallis?.H}</div>
              </div>
              <div className="bg-gray-800 rounded-lg px-4 py-2">
                <span className="text-gray-400 text-xs">df</span>
                <div className="font-mono font-bold text-white text-lg">{kruskalWallis?.df}</div>
              </div>
              <div className="bg-gray-800 rounded-lg px-4 py-2">
                <span className="text-gray-400 text-xs">p-value</span>
                <div className={`font-mono font-bold text-lg ${kruskalWallis?.p < 0.05 ? "text-green-400" : "text-gray-300"}`}>
                  {pFmt(kruskalWallis?.p)}
                </div>
              </div>
              <div className="self-center">
                <Badge
                  variant="outline"
                  className={kruskalWallis?.p < 0.05 ? "border-green-600 text-green-400" : "border-gray-600 text-gray-400"}
                  data-testid="kw-significance"
                >
                  {kruskalWallis?.p < 0.01 ? "p<0.01 — highly significant" :
                   kruskalWallis?.p < 0.05 ? "p<0.05 — significant" : "not significant"}
                </Badge>
              </div>
            </div>
          </div>

          {/* Pairwise */}
          <div>
            <div className="text-xs font-semibold text-gray-300 mb-2 uppercase tracking-wide">Pairwise Wilcoxon: Vertebrate Clock vs Each Other Tier</div>
            <div className="overflow-x-auto">
              <table className="text-xs w-full" data-testid="pairwise-table">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-700">
                    <th className="text-left py-2 pr-4">Comparison</th>
                    <th className="text-right py-2 pr-4">n (clock)</th>
                    <th className="text-right py-2 pr-4">n (other)</th>
                    <th className="text-right py-2 pr-4">z</th>
                    <th className="text-right py-2 pr-4">p-value</th>
                    <th className="text-left py-2">Sig?</th>
                  </tr>
                </thead>
                <tbody>
                  {pairwiseClockVsOther?.map((row: any, i: number) => (
                    <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="py-1.5 pr-4 text-gray-200">{row.comparison}</td>
                      <td className="py-1.5 pr-4 text-right font-mono text-gray-300">{row.nClock}</td>
                      <td className="py-1.5 pr-4 text-right font-mono text-gray-300">{row.nOther}</td>
                      <td className="py-1.5 pr-4 text-right font-mono text-gray-300">{row.z ?? "—"}</td>
                      <td className={`py-1.5 pr-4 text-right font-mono ${row.significant ? "text-green-400" : "text-gray-400"}`}>
                        {pFmt(row.p)}
                      </td>
                      <td className="py-1.5">
                        {row.significant === null ? <span className="text-gray-600">—</span>
                          : row.significant ? <Badge variant="outline" className="border-green-700 text-green-400 text-xs">yes</Badge>
                          : <Badge variant="outline" className="border-gray-700 text-gray-500 text-xs">no</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Non-clock */}
          <div>
            <div className="text-xs font-semibold text-gray-300 mb-2 uppercase tracking-wide">Non-Clock Tier Comparisons (age gradient test)</div>
            <div className="overflow-x-auto">
              <table className="text-xs w-full" data-testid="nonclock-comparisons">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-700">
                    <th className="text-left py-2 pr-4">Comparison</th>
                    <th className="text-right py-2 pr-4">z</th>
                    <th className="text-right py-2 pr-4">p-value</th>
                    <th className="text-left py-2">Sig?</th>
                  </tr>
                </thead>
                <tbody>
                  {nonClockComparisons && Object.entries({
                    "Universal (PS1) vs Metazoan (PS4)": nonClockComparisons.ps1vs4,
                    "Universal (PS1) vs Vertebrate Other (PS8-9)": nonClockComparisons.ps1vs8,
                    "Metazoan (PS4) vs Vertebrate Other (PS8-9)": nonClockComparisons.ps4vs8,
                  }).map(([label, row]: [string, any], i) => row && (
                    <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="py-1.5 pr-4 text-gray-200">{label}</td>
                      <td className="py-1.5 pr-4 text-right font-mono text-gray-300">{row.z ?? "—"}</td>
                      <td className={`py-1.5 pr-4 text-right font-mono ${row.p < 0.05 ? "text-green-400" : "text-gray-400"}`}>
                        {pFmt(row.p)}
                      </td>
                      <td className="py-1.5">
                        {row.p < 0.05
                          ? <Badge variant="outline" className="border-green-700 text-green-400 text-xs">yes</Badge>
                          : <Badge variant="outline" className="border-gray-700 text-gray-500 text-xs">no</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gene table */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-white text-base">
              All {filteredGenes.length} Gene{tierFilter || tableSearch ? "s (filtered)" : "s Matched"} — Gene Table
            </CardTitle>
            <div className="flex flex-wrap gap-2 items-center">
              <input
                type="text"
                placeholder="Search gene…"
                value={tableSearch}
                onChange={(e: any) => setTableSearch(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white placeholder-gray-500 w-32"
                data-testid="gene-search"
              />
              <select
                value={tierFilter ?? ""}
                onChange={(e: any) => setTierFilter(e.target.value || null)}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white"
                data-testid="tier-select"
              >
                <option value="">All tiers</option>
                {TIER_ORDER.map((t: string) => (
                  <option key={t} value={t}>{tierStats?.find((s: any) => s.tier === t)?.label ?? t}</option>
                ))}
              </select>
              <select
                value={tableSort}
                onChange={(e: any) => setTableSort(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white"
                data-testid="sort-select"
              >
                <option value="lambda_desc">|λ| high→low</option>
                <option value="lambda_asc">|λ| low→high</option>
                <option value="age">Age (oldest first)</option>
                <option value="tier">Tier order</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs" data-testid="gene-table">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700">
                  <th className="text-left py-2 pr-3 font-medium">Gene</th>
                  <th className="text-right py-2 pr-3 font-medium">|λ|</th>
                  <th className="text-left py-2 pr-3 font-medium">Tier</th>
                  <th className="text-right py-2 pr-3 font-medium">Age (Mya)</th>
                  <th className="text-left py-2 pr-3 font-medium">PS</th>
                  <th className="text-left py-2 font-medium">Category</th>
                </tr>
              </thead>
              <tbody>
                {filteredGenes.slice(0, 300).map((g: any) => (
                  <tr key={g.gene} className="border-b border-gray-800/40 hover:bg-gray-800/40" data-testid={`gene-row-${g.gene}`}>
                    <td className="py-1.5 pr-3 font-mono font-semibold text-white">{g.gene}</td>
                    <td className="py-1.5 pr-3 text-right font-mono font-semibold" style={{ color: TIER_COLORS[g.tier] }}>
                      {g.lambda.toFixed(4)}
                    </td>
                    <td className="py-1.5 pr-3">
                      <span className="px-1.5 py-0.5 rounded text-xs font-medium"
                        style={{ background: TIER_COLORS[g.tier] + "25", color: TIER_COLORS[g.tier] }}>
                        {tierStats?.find((s: any) => s.tier === g.tier)?.label ?? g.tier}
                      </span>
                    </td>
                    <td className="py-1.5 pr-3 text-right text-gray-300 font-mono">{g.age_mya.toLocaleString()}</td>
                    <td className="py-1.5 pr-3 text-gray-400">{g.ps}</td>
                    <td className="py-1.5 text-gray-400">{g.category?.replace(/_/g," ")}</td>
                  </tr>
                ))}
                {filteredGenes.length > 300 && (
                  <tr>
                    <td colSpan={6} className="py-2 text-center text-gray-500 italic text-xs">
                      Showing first 300 of {filteredGenes.length}. Use filter/search to narrow.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Organoid cross-genotype comparison view ─────────────────────────────────
function OrganoidCompareView({ organoidData }: { organoidData: any }) {
  const { tierDeltas, genotypes, genotypeKeys } = organoidData;

  // Grouped bar data: one entry per tier, bars for each genotype
  const groupedBarData = TIER_ORDER.map((tier: string) => {
    const meta = { ps1_universal: "Universal", ps2_eukaryotic: "Eukaryotic", ps4_metazoan: "Metazoan", ps7_vertebrate_clock: "Clock", ps8_vertebrate_other: "Vert. Other" }[tier] ?? tier;
    const row: any = { tier, label: meta };
    for (const gk of genotypeKeys) {
      const gd = genotypes[gk];
      if (!gd?.tierStats) continue;
      const ts = gd.tierStats.find((t: any) => t.tier === tier);
      if (ts) row[gk] = ts.median;
    }
    return row;
  });

  // Line chart data: x = genotype, lines = tiers
  const lineData = genotypeKeys.map((gk: string) => {
    const gd = genotypes[gk];
    const row: any = { genotype: gk };
    for (const tier of TIER_ORDER) {
      const ts = gd?.tierStats?.find((t: any) => t.tier === tier);
      if (ts) row[tier] = ts.median;
    }
    return row;
  });

  // Delta table
  const deltaTable = tierDeltas ?? [];

  return (
    <div className="space-y-5">
      {/* Finding banner */}
      <div className="bg-red-950/40 border border-red-700/50 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <GitCompare className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />
          <div className="space-y-1.5">
            <div className="font-semibold text-red-300 text-sm">
              ApcKO: Metazoan (E2F/CDK) tier dominance replaces Clock tier hierarchy
            </div>
            <div className="text-xs text-red-200/80">
              In WT organoids the Clock tier sits above the Metazoan tier (clock median 0.536 vs PS4 median 0.441, gap +0.096).
              In ApcKO this inverts: Metazoan jumps to 0.676 (+0.235 vs WT) while Clock rises only modestly to 0.580 (+0.044),
              producing a PS4–Clock gap of +0.096 favouring the proliferative programme.
              BmalKO suppresses Clock (−0.109) but leaves Metazoan moderately elevated (+0.114).
              DblKO (ApcKO + BmalKO) partially rescues both tiers downward (PS4 −0.062, Clock −0.175 vs WT).
            </div>
          </div>
        </div>
      </div>

      {/* Grouped bar chart */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-base">Median |λ| per Tier — All 4 Genotypes</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={groupedBarData} margin={{ top: 10, right: 30, bottom: 50, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="label" tick={{ fill: "#9ca3af", fontSize: 10 }} angle={-15} textAnchor="end" interval={0} />
              <YAxis
                domain={[0.25, 0.85]}
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                tickFormatter={(v: number) => v.toFixed(2)}
                label={{ value: "Median |λ|", angle: -90, position: "insideLeft", fill: "#9ca3af", fontSize: 12 }}
              />
              <Tooltip
                contentStyle={{ background: "#111827", border: "1px solid #374151" }}
                labelStyle={{ color: "#e5e7eb" }}
                formatter={(v: any, name: string) => [typeof v === 'number' ? v.toFixed(4) : v, name]}
              />
              <Legend
                formatter={(value: string) => <span style={{ color: GENOTYPE_COLORS[value] }}>{value}</span>}
              />
              {genotypeKeys.map((gk: string) => (
                <Bar key={gk} dataKey={gk} fill={GENOTYPE_COLORS[gk]} radius={[2,2,0,0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Line chart: tier trajectory across genotypes */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-base">Tier Trajectory Across Conditions (median |λ|)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={lineData} margin={{ top: 10, right: 50, bottom: 10, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="genotype" tick={{ fill: "#9ca3af", fontSize: 11 }} />
              <YAxis
                domain={[0.25, 0.85]}
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                tickFormatter={(v: number) => v.toFixed(2)}
                label={{ value: "Median |λ|", angle: -90, position: "insideLeft", fill: "#9ca3af", fontSize: 12 }}
              />
              <Tooltip
                contentStyle={{ background: "#111827", border: "1px solid #374151" }}
                labelStyle={{ color: "#e5e7eb" }}
                formatter={(v: any, name: string) => {
                  const label = { ps1_universal: "Universal", ps2_eukaryotic: "Eukaryotic", ps4_metazoan: "Metazoan", ps7_vertebrate_clock: "Clock", ps8_vertebrate_other: "Vert. Other" }[name] ?? name;
                  return [typeof v === 'number' ? v.toFixed(4) : v, label];
                }}
              />
              <Legend
                formatter={(value: string) => {
                  const label = { ps1_universal: "Universal", ps2_eukaryotic: "Eukaryotic", ps4_metazoan: "Metazoan", ps7_vertebrate_clock: "Clock", ps8_vertebrate_other: "Vert. Other" }[value] ?? value;
                  return <span style={{ color: TIER_COLORS[value], fontSize: "11px" }}>{label}</span>;
                }}
              />
              {TIER_ORDER.map((tier: string) => (
                <Line
                  key={tier}
                  type="monotone"
                  dataKey={tier}
                  stroke={TIER_COLORS[tier]}
                  strokeWidth={tier === "ps7_vertebrate_clock" || tier === "ps4_metazoan" ? 2.5 : 1.5}
                  dot={{ fill: TIER_COLORS[tier], r: 4 }}
                  strokeDasharray={tier === "ps4_metazoan" ? "6 2" : undefined}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
          <div className="text-xs text-gray-500 mt-2 text-center">
            Dashed line = Metazoan (PS4) tier · Solid amber = Vertebrate Clock tier
          </div>
        </CardContent>
      </Card>

      {/* Delta table */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-base">Tier Median Δ vs WT (ApcKO, BmalKO, DblKO)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="text-xs w-full" data-testid="delta-table">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700">
                  <th className="text-left py-2 pr-4">Tier</th>
                  <th className="text-right py-2 pr-4">WT</th>
                  <th className="text-right py-2 pr-4">ApcKO</th>
                  <th className="text-right py-2 pr-4">Δ (ApcKO)</th>
                  <th className="text-right py-2 pr-4">BmalKO</th>
                  <th className="text-right py-2 pr-4">Δ (BmalKO)</th>
                  <th className="text-right py-2 pr-4">DblKO</th>
                  <th className="text-right py-2">Δ (DblKO)</th>
                </tr>
              </thead>
              <tbody>
                {deltaTable.map((row: any, i: number) => (
                  <tr key={i} className={`border-b border-gray-800/40 hover:bg-gray-800/30 ${row.tier === 'ps7_vertebrate_clock' || row.tier === 'ps4_metazoan' ? 'bg-gray-800/20' : ''}`}>
                    <td className="py-1.5 pr-4">
                      <span className="px-1.5 py-0.5 rounded text-xs font-medium" style={{ background: TIER_COLORS[row.tier] + "25", color: TIER_COLORS[row.tier] }}>
                        {row.label}
                      </span>
                    </td>
                    <td className="py-1.5 pr-4 text-right font-mono text-gray-300">{row.WT?.toFixed(4) ?? "—"}</td>
                    <td className="py-1.5 pr-4 text-right font-mono text-gray-300">{row.ApcKO?.toFixed(4) ?? "—"}</td>
                    <td className={`py-1.5 pr-4 text-right font-mono font-semibold ${row.apcVsWt !== null ? (row.apcVsWt > 0.05 ? "text-red-400" : row.apcVsWt < -0.05 ? "text-blue-400" : "text-gray-300") : "text-gray-600"}`}>
                      {row.apcVsWt !== null ? (row.apcVsWt > 0 ? "+" : "") + row.apcVsWt.toFixed(4) : "—"}
                    </td>
                    <td className="py-1.5 pr-4 text-right font-mono text-gray-300">{row.BmalKO?.toFixed(4) ?? "—"}</td>
                    <td className={`py-1.5 pr-4 text-right font-mono font-semibold ${row.bmalVsWt !== null ? (row.bmalVsWt > 0.05 ? "text-red-400" : row.bmalVsWt < -0.05 ? "text-blue-400" : "text-gray-300") : "text-gray-600"}`}>
                      {row.bmalVsWt !== null ? (row.bmalVsWt > 0 ? "+" : "") + row.bmalVsWt.toFixed(4) : "—"}
                    </td>
                    <td className="py-1.5 pr-4 text-right font-mono text-gray-300">{row.DblKO?.toFixed(4) ?? "—"}</td>
                    <td className={`py-1.5 text-right font-mono font-semibold ${row.dblVsWt !== null ? (row.dblVsWt > 0.05 ? "text-red-400" : row.dblVsWt < -0.05 ? "text-blue-400" : "text-gray-300") : "text-gray-600"}`}>
                      {row.dblVsWt !== null ? (row.dblVsWt > 0 ? "+" : "") + row.dblVsWt.toFixed(4) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-xs text-gray-500 mt-2">Red = substantial increase (Δ &gt; +0.05) · Blue = substantial decrease (Δ &lt; −0.05)</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function EvolutionaryGeneAge() {
  const [dataset, setDataset] = useState<"liver" | "organoid">("liver");
  const [genotypeKey, setGenotypeKey] = useState("WT");
  const [compareMode, setCompareMode] = useState(false);
  const [highlightTier, setHighlightTier] = useState<string | null>(null);
  const [tableSort, setTableSort] = useState<string>("lambda_desc");
  const [tierFilter, setTierFilter] = useState<string | null>(null);
  const [tableSearch, setTableSearch] = useState("");

  const liverQuery = useQuery<any>({
    queryKey: ["/api/analyses/evolutionary-gene-age"],
    staleTime: Infinity,
  });

  const organoidQuery = useQuery<any>({
    queryKey: ["/api/analyses/organoid-evolutionary-gene-age"],
    staleTime: Infinity,
    enabled: dataset === "organoid",
  });

  const isLoading = dataset === "liver" ? liverQuery.isLoading : organoidQuery.isLoading;
  const error     = dataset === "liver" ? liverQuery.error    : organoidQuery.error;
  const data      = dataset === "liver" ? liverQuery.data     : organoidQuery.data;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4" data-testid="loading-evo">
        <div className="h-10 w-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <div className="text-center">
          <div className="text-lg text-gray-200 font-medium">
            {dataset === "liver" ? "Computing mouse liver AR(2) × phylostrata analysis…" : "Computing organoid multi-genotype analysis…"}
          </div>
          <div className="text-sm text-gray-400 mt-1">
            {dataset === "liver"
              ? "Fitting AR(2) on GSE54650 (20,955 genes) and cross-referencing phylostrata lookup."
              : "Fitting AR(2) on all 4 GSE157357 genotypes (WT, ApcKO, BmalKO, DblKO)."}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data || data?.error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-red-400 gap-2" data-testid="error-evo">
        <div className="text-lg font-semibold">Failed to load analysis</div>
        <div className="text-sm text-gray-400">{data?.error || String(error)}</div>
      </div>
    );
  }

  // Liver-specific fields
  const {
    dataset: datasetLabel, nMatched, nLookup, matchRate,
    genes: liverGenes, tierStats: liverTierStats, kruskalWallis: liverKW,
    pairwiseClockVsOther: liverPairwise, nonClockComparisons: liverNonClock,
    spearmanRhoNonClock, genomeWide: liverGenomeWide, tierPercentiles: liverPctiles,
    interpretation,
  } = dataset === "liver" ? data : ({} as any);

  // Organoid-specific
  const organoidGenotypeData  = dataset === "organoid" && !compareMode ? data?.genotypes?.[genotypeKey] : null;
  const organoidGenomeWide    = organoidGenotypeData?.genomeWide;

  // Liver scatter/bar
  const liverBarData = dataset === "liver" ? TIER_ORDER
    .map((t: string) => liverTierStats?.find((s: any) => s.tier === t))
    .filter(Boolean)
    .map((t: any) => ({
      tier: t.tier, label: t.label, age_range: t.age_range,
      median: t.median, mean: t.mean, q25: t.q25, q75: t.q75,
      min: t.min, max: t.max, n: t.n,
    })) : [];

  const liverScatterData = dataset === "liver" ? (liverGenes ?? []).map((g: any) => ({ ...g, x: g.age_mya, y: g.lambda })) : [];
  const liverClockTier   = dataset === "liver" ? liverTierStats?.find((t: any) => t.tier === "ps7_vertebrate_clock") : null;

  const liverFilteredGenes = dataset === "liver" ? [...(liverGenes ?? [])]
    .filter((g: any) => {
      if (tierFilter && g.tier !== tierFilter) return false;
      if (tableSearch && !g.gene.toLowerCase().includes(tableSearch.toLowerCase())) return false;
      return true;
    })
    .sort((a: any, b: any) => {
      if (tableSort === "lambda_desc") return b.lambda - a.lambda;
      if (tableSort === "lambda_asc")  return a.lambda - b.lambda;
      if (tableSort === "age")         return b.age_mya - a.age_mya;
      return TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier);
    }) : [];

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4 md:p-6" data-testid="page-evolutionary-gene-age">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Back nav */}
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <button className="text-gray-400 hover:text-white flex items-center gap-1 text-sm" data-testid="back-link">
              <ArrowLeft className="h-4 w-4" /> Dashboard
            </button>
          </Link>
        </div>

        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
            <Dna className="h-7 w-7 text-amber-400" />
            Evolutionary Gene Age × AR(2) Persistence
          </h1>
          <p className="text-gray-400 mt-2 max-w-3xl text-sm">
            Crosses AR(2) eigenvalue moduli (|λ|) with a phylostrata lookup for well-characterised genes across five evolutionary tiers.
            Supports the mouse liver atlas (GSE54650) and multi-condition intestinal organoid experiments (GSE157357, 4 genotypes).
          </p>
        </div>

        {/* Dataset switcher */}
        <div className="flex gap-2">
          <button
            data-testid="dataset-tab-liver"
            onClick={() => { setDataset("liver"); setCompareMode(false); setHighlightTier(null); setTierFilter(null); setTableSearch(""); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${dataset === "liver" ? "bg-amber-900/50 border border-amber-600 text-amber-300" : "bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-200"}`}
          >
            <FlaskConical className="h-4 w-4" />
            GSE54650 Mouse Liver
          </button>
          <button
            data-testid="dataset-tab-organoid"
            onClick={() => { setDataset("organoid"); setCompareMode(false); setGenotypeKey("WT"); setHighlightTier(null); setTierFilter(null); setTableSearch(""); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${dataset === "organoid" ? "bg-purple-900/50 border border-purple-600 text-purple-300" : "bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-200"}`}
          >
            <Layers className="h-4 w-4" />
            GSE157357 Organoids (4 genotypes)
          </button>
        </div>

        {/* ── LIVER VIEW ─────────────────────────────────────────── */}
        {dataset === "liver" && (
          <>
            <div className="flex flex-wrap gap-3 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <FlaskConical className="h-3.5 w-3.5 text-blue-400" />
                Dataset: <span className="text-blue-300">{datasetLabel}</span>
              </span>
              <span>|</span>
              <span>Phylostrata lookup: <span className="text-white">{nLookup}</span> genes</span>
              <span>|</span>
              <span>Matched: <span className="text-green-400 font-semibold">{nMatched}</span> ({matchRate}%)</span>
            </div>

            {/* Interpretation banner */}
            <div className="bg-amber-950/40 border border-amber-700/50 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <TrendingUp className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
                <div className="space-y-1.5">
                  <div className="font-semibold text-amber-300 text-sm">{interpretation?.mainFinding}</div>
                  <div className="text-xs text-amber-200/80">{interpretation?.driverNote}</div>
                  <div className="text-xs text-amber-300 font-medium border-t border-amber-700/40 pt-2 mt-1">
                    {interpretation?.biologicalConclusion}
                  </div>
                </div>
              </div>
            </div>

            {/* Same-era specificity control spotlight */}
            <div className="rounded-xl border border-slate-600 bg-gray-900 p-4">
              <div className="text-xs font-semibold text-gray-300 uppercase tracking-wide mb-3">
                Key specificity control — same geological era, opposite |λ| signatures
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-amber-950/30 border border-amber-700/40 p-3 text-center">
                  <div className="text-xs font-semibold text-amber-400 mb-1">Vertebrate Clock (~480 Mya)</div>
                  <div className="text-2xl font-bold font-mono text-amber-300">73.9<span className="text-base">th %ile</span></div>
                  <div className="text-xs text-gray-400 mt-0.5">highest-persistence tier · complex roots</div>
                </div>
                <div className="rounded-lg bg-gray-800/60 border border-gray-700 p-3 text-center">
                  <div className="text-xs font-semibold text-gray-400 mb-1">Vertebrate Other (~450 Mya)</div>
                  <div className="text-2xl font-bold font-mono text-gray-300">52.4<span className="text-base">th %ile</span></div>
                  <div className="text-xs text-gray-500 mt-0.5">near-genome-median · immune cytokines</div>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-3 leading-relaxed">
                These two tiers arose at the same time. The clock tier's higher persistence is not an age effect —
                it is a <span className="text-amber-300 font-medium">functional specialisation</span>.
                Vertebrate immune genes of the same era sit near the genome median, ruling out "newer genes oscillate more" as an alternative explanation.
              </p>
              <p className="text-xs text-gray-500 mt-2 border-t border-gray-700 pt-2">
                <span className="text-purple-400 font-medium">Organoid tab →</span>{" "}
                ApcKO cancer inverts this hierarchy: the Metazoan PS4 tier (E2F/CDK cell-cycle programme) rises
                to dominate over the Clock tier, mirroring the APP glial clock inversion in an independent system.
              </p>
            </div>

            {/* Tier summary boxes */}
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-base">|λ| by Evolutionary Tier</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                  {TIER_ORDER.map((tier: string) => {
                    const t = liverTierStats?.find((s: any) => s.tier === tier);
                    if (!t) return null;
                    const pct = liverPctiles?.find((p: any) => p.tier === tier);
                    return (
                      <button key={tier} data-testid={`tier-box-${tier}`}
                        onClick={() => setHighlightTier(highlightTier === tier ? null : tier)}
                        className="rounded-lg border p-3 text-left transition-all"
                        style={{
                          borderColor: TIER_COLORS[tier] + (highlightTier === tier ? "cc" : "50"),
                          background: TIER_COLORS[tier] + (highlightTier === tier ? "25" : "10"),
                          boxShadow: highlightTier === tier ? `0 0 0 2px ${TIER_COLORS[tier]}40` : "none",
                        }}
                      >
                        <div className="text-xs font-semibold mb-0.5" style={{ color: TIER_COLORS[tier] }}>{t.label}</div>
                        <div className="text-xs text-gray-400 mb-2">{t.age_range} · {t.ps}</div>
                        <div className="text-2xl font-bold text-white font-mono">{t.median.toFixed(3)}</div>
                        <div className="text-xs text-gray-400">median |λ|</div>
                        <div className="text-xs text-gray-500 mt-2">
                          IQR {t.q25.toFixed(3)}–{t.q75.toFixed(3)}<br />
                          mean {t.mean.toFixed(3)}<br />n = {t.n}
                        </div>
                        {pct && (
                          <div className="text-xs mt-1" style={{ color: TIER_COLORS[tier] }}>
                            genome pct {pct.medianPercentile}th
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Bar chart */}
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-base">Median |λ| per Tier vs Genome-Wide Median</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={liverBarData} margin={{ top: 10, right: 30, bottom: 60, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="label" tick={{ fill: "#9ca3af", fontSize: 10 }} angle={-20} textAnchor="end" interval={0} />
                    <YAxis
                      domain={[0.35, 0.80]}
                      tick={{ fill: "#9ca3af", fontSize: 11 }}
                      tickFormatter={(v: number) => v.toFixed(2)}
                      label={{ value: "Median |λ|", angle: -90, position: "insideLeft", fill: "#9ca3af", fontSize: 12 }}
                    />
                    <Tooltip content={<BarTooltipContent />} />
                    <ReferenceLine y={liverGenomeWide?.median ?? 0.496} stroke="#6b7280" strokeDasharray="4 3" strokeWidth={1.5}
                      label={{ value: `Genome median ${(liverGenomeWide?.median ?? 0.496).toFixed(3)}`, position: "insideRight", fill: "#9ca3af", fontSize: 10 }} />
                    <Bar dataKey="median" name="Median |λ|" radius={[4, 4, 0, 0]}>
                      {liverBarData.map((entry: any) => (
                        <Cell key={entry.tier} fill={TIER_COLORS[entry.tier]}
                          opacity={highlightTier ? (highlightTier === entry.tier ? 1 : 0.3) : 1} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Scatter */}
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle className="text-white text-base">Evolutionary Age vs |λ| — {nMatched} genes (GSE54650 Liver)</CardTitle>
                  <div className="flex flex-wrap gap-2">
                    {TIER_ORDER.map((t: string) => {
                      const ts = liverTierStats?.find((s: any) => s.tier === t);
                      return (
                        <button key={t} data-testid={`tier-filter-scatter-${t}`}
                          onClick={() => setHighlightTier(highlightTier === t ? null : t)}
                          className="flex items-center gap-1.5 px-2 py-1 rounded border text-xs transition-all"
                          style={{ borderColor: TIER_COLORS[t], background: highlightTier === t ? TIER_COLORS[t] + "30" : "transparent", color: TIER_COLORS[t] }}>
                          ■ {ts?.label ?? t}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={420}>
                  <ScatterChart margin={{ top: 10, right: 30, bottom: 50, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="x" type="number" domain={[0, 3700]} reversed
                      tickFormatter={(v: number) => v === 0 ? "Now" : `${(v/1000).toFixed(v >= 1000 ? 1 : 0)}Ga`}
                      label={{ value: "Evolutionary age (Mya) — older →", position: "insideBottom", offset: -30, fill: "#9ca3af", fontSize: 11 }}
                      stroke="#6b7280" tick={{ fill: "#9ca3af", fontSize: 10 }} />
                    <YAxis dataKey="y" domain={[0.2, 1.05]}
                      tickFormatter={(v: number) => v.toFixed(2)}
                      label={{ value: "|λ|", angle: -90, position: "insideLeft", fill: "#9ca3af", fontSize: 13 }}
                      stroke="#6b7280" tick={{ fill: "#9ca3af", fontSize: 10 }} />
                    <Tooltip content={<ScatterTooltipContent />} />
                    <ReferenceLine y={liverGenomeWide?.median ?? 0.496} stroke="#6b7280" strokeDasharray="3 3" strokeWidth={1}
                      label={{ value: `Genome median`, position: "insideTopLeft", fill: "#6b7280", fontSize: 9 }} />
                    <ReferenceLine y={liverClockTier?.median ?? 0.61} stroke="#f59e0b" strokeDasharray="5 3" strokeWidth={1.5}
                      label={{ value: `Clock median ${(liverClockTier?.median ?? 0.61).toFixed(3)}`, position: "insideRight", fill: "#f59e0b", fontSize: 9 }} />
                    {TIER_ORDER.map((tier: string) => {
                      const tierGenes = liverScatterData.filter((g: any) => g.tier === tier);
                      return (
                        <Scatter key={tier} data={tierGenes} fill={TIER_COLORS[tier]}
                          opacity={highlightTier ? (highlightTier === tier ? 0.9 : 0.08) : 0.75} r={4} />
                      );
                    })}
                  </ScatterChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Stats */}
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="pb-2"><CardTitle className="text-white text-base">Statistical Tests</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <div className="text-xs font-semibold text-gray-300 mb-2 uppercase tracking-wide">Kruskal-Wallis (all 5 tiers)</div>
                  <div className="flex flex-wrap gap-4 text-sm" data-testid="kw-result">
                    <div className="bg-gray-800 rounded-lg px-4 py-2">
                      <span className="text-gray-400 text-xs">H statistic</span>
                      <div className="font-mono font-bold text-white text-lg">{liverKW?.H}</div>
                    </div>
                    <div className="bg-gray-800 rounded-lg px-4 py-2">
                      <span className="text-gray-400 text-xs">df</span>
                      <div className="font-mono font-bold text-white text-lg">{liverKW?.df}</div>
                    </div>
                    <div className="bg-gray-800 rounded-lg px-4 py-2">
                      <span className="text-gray-400 text-xs">p-value</span>
                      <div className={`font-mono font-bold text-lg ${liverKW?.p < 0.05 ? "text-green-400" : "text-gray-300"}`}>
                        {pFmt(liverKW?.p)}
                      </div>
                    </div>
                    <div className="self-center">
                      <Badge variant="outline" className={liverKW?.p < 0.05 ? "border-green-600 text-green-400" : "border-gray-600 text-gray-400"} data-testid="kw-significance">
                        {liverKW?.p < 0.01 ? "p<0.01 — highly significant" : liverKW?.p < 0.05 ? "p<0.05 — significant" : "not significant"}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-300 mb-2 uppercase tracking-wide">Pairwise Wilcoxon: Clock vs Other Tiers</div>
                  <div className="overflow-x-auto">
                    <table className="text-xs w-full" data-testid="pairwise-table">
                      <thead>
                        <tr className="text-gray-400 border-b border-gray-700">
                          <th className="text-left py-2 pr-4">Comparison</th>
                          <th className="text-right py-2 pr-4">n (clock)</th>
                          <th className="text-right py-2 pr-4">n (other)</th>
                          <th className="text-right py-2 pr-4">z</th>
                          <th className="text-right py-2 pr-4">p-value</th>
                          <th className="text-left py-2">Sig?</th>
                        </tr>
                      </thead>
                      <tbody>
                        {liverPairwise?.map((row: any, i: number) => (
                          <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                            <td className="py-1.5 pr-4 text-gray-200">{row.comparison}</td>
                            <td className="py-1.5 pr-4 text-right font-mono text-gray-300">{row.nClock}</td>
                            <td className="py-1.5 pr-4 text-right font-mono text-gray-300">{row.nOther}</td>
                            <td className="py-1.5 pr-4 text-right font-mono text-gray-300">{row.z ?? "—"}</td>
                            <td className={`py-1.5 pr-4 text-right font-mono ${row.significant ? "text-green-400" : "text-gray-400"}`}>
                              {pFmt(row.p)}
                            </td>
                            <td className="py-1.5">
                              {row.significant === null ? <span className="text-gray-600">—</span>
                                : row.significant ? <Badge variant="outline" className="border-green-700 text-green-400 text-xs">yes</Badge>
                                : <Badge variant="outline" className="border-gray-700 text-gray-500 text-xs">no</Badge>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-300 mb-2 uppercase tracking-wide">Spearman ρ — Evolutionary Age vs |λ| (non-clock genes)</div>
                  <div className="flex flex-wrap gap-4" data-testid="spearman-result">
                    <div className="bg-gray-800 rounded-lg px-4 py-2">
                      <span className="text-gray-400 text-xs">ρ (rho)</span>
                      <div className="font-mono font-bold text-white text-lg">{spearmanRhoNonClock?.rho}</div>
                    </div>
                    <div className="bg-gray-800 rounded-lg px-4 py-2">
                      <span className="text-gray-400 text-xs">n genes</span>
                      <div className="font-mono font-bold text-white text-lg">{spearmanRhoNonClock?.n}</div>
                    </div>
                    <div className="self-center text-xs text-gray-400 max-w-xs italic">{spearmanRhoNonClock?.interpretation}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Gene table */}
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle className="text-white text-base">All {nMatched} Matched Genes (GSE54650 × Phylostrata)</CardTitle>
                  <div className="flex flex-wrap gap-2 items-center">
                    <input type="text" placeholder="Search gene…" value={tableSearch}
                      onChange={(e: any) => setTableSearch(e.target.value)}
                      className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white placeholder-gray-500 w-32"
                      data-testid="gene-search" />
                    <select value={tierFilter ?? ""} onChange={(e: any) => setTierFilter(e.target.value || null)}
                      className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white" data-testid="tier-select">
                      <option value="">All tiers</option>
                      {TIER_ORDER.map((t: string) => (
                        <option key={t} value={t}>{liverTierStats?.find((s: any) => s.tier === t)?.label ?? t}</option>
                      ))}
                    </select>
                    <select value={tableSort} onChange={(e: any) => setTableSort(e.target.value)}
                      className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white" data-testid="sort-select">
                      <option value="lambda_desc">|λ| high→low</option>
                      <option value="lambda_asc">|λ| low→high</option>
                      <option value="age">Age (oldest first)</option>
                      <option value="tier">Tier order</option>
                    </select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs" data-testid="gene-table">
                    <thead>
                      <tr className="text-gray-400 border-b border-gray-700">
                        <th className="text-left py-2 pr-3 font-medium">Gene</th>
                        <th className="text-right py-2 pr-3 font-medium">|λ|</th>
                        <th className="text-left py-2 pr-3 font-medium">Tier</th>
                        <th className="text-right py-2 pr-3 font-medium">Age (Mya)</th>
                        <th className="text-left py-2 pr-3 font-medium">PS</th>
                        <th className="text-left py-2 font-medium">Category</th>
                      </tr>
                    </thead>
                    <tbody>
                      {liverFilteredGenes.slice(0, 300).map((g: any) => (
                        <tr key={g.gene} className="border-b border-gray-800/40 hover:bg-gray-800/40" data-testid={`gene-row-${g.gene}`}>
                          <td className="py-1.5 pr-3 font-mono font-semibold text-white">{g.gene}</td>
                          <td className="py-1.5 pr-3 text-right font-mono font-semibold" style={{ color: TIER_COLORS[g.tier] }}>
                            {g.lambda.toFixed(4)}
                          </td>
                          <td className="py-1.5 pr-3">
                            <span className="px-1.5 py-0.5 rounded text-xs font-medium"
                              style={{ background: TIER_COLORS[g.tier] + "25", color: TIER_COLORS[g.tier] }}>
                              {liverTierStats?.find((s: any) => s.tier === g.tier)?.label ?? g.tier}
                            </span>
                          </td>
                          <td className="py-1.5 pr-3 text-right text-gray-300 font-mono">{g.age_mya.toLocaleString()}</td>
                          <td className="py-1.5 pr-3 text-gray-400">{g.ps}</td>
                          <td className="py-1.5 text-gray-400">{g.category.replace(/_/g," ")}</td>
                        </tr>
                      ))}
                      {liverFilteredGenes.length > 300 && (
                        <tr><td colSpan={6} className="py-2 text-center text-gray-500 italic text-xs">
                          Showing first 300 of {liverFilteredGenes.length}. Use filter/search to narrow.
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Genome-wide */}
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-base">Genome-Wide Context — GSE54650 ({liverGenomeWide?.n?.toLocaleString()} genes)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                  {[
                    { label: "Mean |λ|", v: liverGenomeWide?.mean?.toFixed(3) },
                    { label: "Median |λ|", v: liverGenomeWide?.median?.toFixed(3) },
                    { label: "Q25",       v: liverGenomeWide?.q25?.toFixed(3) },
                    { label: "Q75",       v: liverGenomeWide?.q75?.toFixed(3) },
                    { label: "Total genes",v: liverGenomeWide?.n?.toLocaleString() },
                  ].map(s => (
                    <div key={s.label} className="bg-gray-800 rounded-lg p-3">
                      <div className="text-gray-400 text-xs">{s.label}</div>
                      <div className="font-mono font-bold text-white text-lg">{s.v}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Methodology */}
            <Card className="bg-gray-900 border-gray-700">
              <CardContent className="pt-4">
                <div className="flex items-start gap-2 text-xs text-gray-400">
                  <Info className="h-4 w-4 mt-0.5 shrink-0 text-gray-500" />
                  <div>
                    <span className="font-semibold text-gray-300">Methodology.</span>{" "}
                    Phylostrata assignments follow Domazet-Lošo &amp; Tautz (2010) PNAS and the Neme &amp; Tautz (2013) taxonomy,
                    simplified to five tiers covering well-characterised mouse gene families.
                    |λ| values are actual AR(2) eigenvalue moduli from GSE54650 (Hughes Circadian Atlas; 24 CT timepoints, 2h interval).
                    Match rate {matchRate}% ({nMatched}/{nLookup}).
                    Age represents protein family origin — not when current molecular function was acquired.
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Closing biological conclusion */}
            <div className="rounded-xl border border-amber-700/50 bg-amber-950/30 px-5 py-4 text-sm text-amber-200 leading-relaxed">
              <span className="font-semibold text-amber-300">Bottom line: </span>
              AR(2) persistence is a function of biological role, not evolutionary antiquity.
              Ancient housekeeping genes maintain stable, constitutive expression — real roots, low |λ|.
              The vertebrate circadian clock is a specialised ~480 Mya oscillatory innovation that elevated
              persistence via complex eigenvalue roots. Same-era vertebrate immune cytokines sit near the
              genome median. Functional design — not age — determines temporal dynamics.
            </div>
          </>
        )}

        {/* ── ORGANOID VIEW ──────────────────────────────────────── */}
        {dataset === "organoid" && (
          <>
            {/* Dataset info */}
            <div className="flex flex-wrap gap-3 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <FlaskConical className="h-3.5 w-3.5 text-purple-400" />
                Dataset: <span className="text-purple-300">{data.dataset}</span>
              </span>
              <span>|</span>
              <span>4 genotypes · Ensembl ID→symbol matched · 137 genes per genotype (average)</span>
            </div>

            {/* Genotype tabs + compare */}
            <div className="flex flex-wrap gap-2">
              {data.genotypeKeys?.map((gk: string) => (
                <button
                  key={gk}
                  data-testid={`genotype-tab-${gk}`}
                  onClick={() => { setGenotypeKey(gk); setCompareMode(false); setHighlightTier(null); setTierFilter(null); setTableSearch(""); }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                  style={{
                    background: !compareMode && genotypeKey === gk ? GENOTYPE_COLORS[gk] + "30" : "transparent",
                    border: `1px solid ${GENOTYPE_COLORS[gk] + (!compareMode && genotypeKey === gk ? "cc" : "50")}`,
                    color: GENOTYPE_COLORS[gk],
                  }}
                >
                  {data.genotypeMeta?.[gk]?.shortLabel ?? gk}
                  <span className="text-xs opacity-70">
                    n={data.genotypes?.[gk]?.nMatched ?? "?"}
                  </span>
                </button>
              ))}
              <button
                data-testid="genotype-tab-compare"
                onClick={() => setCompareMode(true)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${compareMode ? "bg-gray-700 border border-gray-500 text-white" : "bg-gray-800/50 border border-gray-700 text-gray-400 hover:text-gray-200"}`}
              >
                <GitCompare className="h-3.5 w-3.5" />
                Compare All
              </button>
            </div>

            {/* Genotype label */}
            {!compareMode && organoidGenotypeData && (
              <div className="flex items-center gap-3">
                <div className="h-3 w-3 rounded-full" style={{ background: GENOTYPE_COLORS[genotypeKey] }} />
                <span className="text-sm text-gray-300 font-medium">{organoidGenotypeData.label}</span>
                <Badge variant="outline" className="text-xs border-gray-600 text-gray-400">
                  {organoidGenotypeData.nMatched} genes matched
                </Badge>
              </div>
            )}

            {/* Single genotype interpretation banner */}
            {!compareMode && organoidGenotypeData && (
              <div className="rounded-xl p-4 border" style={{ borderColor: GENOTYPE_COLORS[genotypeKey] + "40", background: GENOTYPE_COLORS[genotypeKey] + "0a" }}>
                <div className="flex items-start gap-3">
                  <TrendingUp className="h-5 w-5 mt-0.5 shrink-0" style={{ color: GENOTYPE_COLORS[genotypeKey] }} />
                  <div className="text-xs" style={{ color: GENOTYPE_COLORS[genotypeKey] + "cc" }}>
                    {organoidGenotypeData.interpretation?.mainFinding}
                    {" "}{organoidGenotypeData.interpretation?.metazoanNote}
                  </div>
                </div>
              </div>
            )}

            {/* Genotype error */}
            {!compareMode && organoidGenotypeData?.error && (
              <div className="bg-red-950/40 border border-red-700 rounded-xl p-4 text-red-300 text-sm">
                Error loading {genotypeKey}: {organoidGenotypeData.error}
              </div>
            )}

            {/* Single genotype view */}
            {!compareMode && organoidGenotypeData && !organoidGenotypeData.error && (
              <GenotypeSingleView
                gData={organoidGenotypeData}
                genomeWide={organoidGenomeWide}
                highlightTier={highlightTier}
                setHighlightTier={setHighlightTier}
                tableSort={tableSort}
                setTableSort={setTableSort}
                tierFilter={tierFilter}
                setTierFilter={setTierFilter}
                tableSearch={tableSearch}
                setTableSearch={setTableSearch}
              />
            )}

            {/* Compare view */}
            {compareMode && <OrganoidCompareView organoidData={data} />}

            {/* Organoid methodology note */}
            <Card className="bg-gray-900 border-gray-700">
              <CardContent className="pt-4">
                <div className="flex items-start gap-2 text-xs text-gray-400">
                  <Info className="h-4 w-4 mt-0.5 shrink-0 text-gray-500" />
                  <div>
                    <span className="font-semibold text-gray-300">Organoid methodology.</span>{" "}
                    Dataset GSE157357 (Stokes et al., CMGH 2021, PMID:34534703). Four genotypes: WT-WT (n≈137 matched), ApcKO-WT (n≈131), WT-BmalKO (n≈133), ApcKO-BmalKO (n≈130).
                    RNA-seq time series: CT24–CT46, 2h interval, 22 columns (some timepoints duplicated as biological replicates; averaged before AR(2) fitting).
                    Ensembl IDs mapped to gene symbols via a confirmed 151-gene static lookup (manually validated against dataset feature list).
                    AR(2) eigenvalue moduli computed per gene per genotype; Kruskal-Wallis and pairwise Wilcoxon applied per genotype.
                    Phylostrata tier assignments as per liver analysis (Domazet-Lošo &amp; Tautz 2010).
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

      </div>
    </div>
  );
}
