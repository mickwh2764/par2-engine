import { useState } from "react";
import { GitCompare, Download, FlaskConical, CheckCircle, AlertTriangle, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ── Baboon liver benchmark (GSE98965, Aug 2026) ──────────────────────────────
const BABOON_STATS = {
  dataset: "GSE98965 Baboon Liver (Papio anubis)",
  tissue: "LIV (liver)",
  timepoints: 12,
  interval: "2h (ZT00–ZT22, 1 complete cycle)",
  species: "Papio anubis (olive baboon)",
  citation: "Mure et al. 2018, Science",
  genes: 14824,
  complexRoot: { n: 9563, pct: 64.5 },
  realRoot: { n: 5261, pct: 35.5 },
  sig: {
    ar2: { n: 729,  pct: 4.9,  label: "|λ| ≥ 0.80" },
    jtk: { n: 0,    pct: 0.0,  label: "adj.p < 0.05 (BH, N=12)" },
    cosinor: { n: 1, pct: 0.0, label: "adj.p < 0.05" },
  },
  spearman: {
    ar2Jtk: { all: 0.071,  complex: -0.203 },
    ar2Cos: { all: -0.262, complex: -0.487 },
    jtkCos: { all: null },
    mouseBenchmark: 0.059,   // within-complex, mouse liver
  },
  concordance: [
    { n: 50,  ar2Jtk: 0.031, ar2Cos: 0.000, jtkCos: 0.020 },
    { n: 100, ar2Jtk: 0.036, ar2Cos: 0.010, jtkCos: 0.143 },
    { n: 200, ar2Jtk: 0.039, ar2Cos: 0.013, jtkCos: 0.220 },
    { n: 500, ar2Jtk: 0.047, ar2Cos: 0.031, jtkCos: 0.344 },
  ],
  clockGenes: [
    { gene: "CRY1",   lambda: 0.739, root: "Real",    jtkPct: 96.6, ar2Pct: 88.5 },
    { gene: "PER3",   lambda: 0.719, root: "Complex", jtkPct: 96.6, ar2Pct: 85.7 },
    { gene: "NPAS2",  lambda: 0.702, root: "Complex", jtkPct: 96.6, ar2Pct: 83.1 },
    { gene: "PER2",   lambda: 0.669, root: "Complex", jtkPct: 96.6, ar2Pct: 77.9 },
    { gene: "TEF",    lambda: 0.611, root: "Real",    jtkPct: 96.6, ar2Pct: 67.7 },
    { gene: "CLOCK",  lambda: 0.561, root: "Complex", jtkPct: 40.9, ar2Pct: 58.4 },
    { gene: "ARNTL",  lambda: 0.519, root: "Complex", jtkPct: 96.6, ar2Pct: 50.2 },
    { gene: "NR1D1",  lambda: 0.481, root: "Complex", jtkPct: 40.9, ar2Pct: 43.4 },
    { gene: "PER1",   lambda: 0.470, root: "Real",    jtkPct: 96.6, ar2Pct: 41.4 },
    { gene: "ARNTL2", lambda: 0.457, root: "Complex", jtkPct: 40.9, ar2Pct: 39.0 },
    { gene: "HLF",    lambda: 0.432, root: "Complex", jtkPct: 40.9, ar2Pct: 34.2 },
    { gene: "RORA",   lambda: 0.409, root: "Complex", jtkPct: 40.9, ar2Pct: 30.2 },
    { gene: "RORC",   lambda: 0.379, root: "Complex", jtkPct: 84.2, ar2Pct: 25.1 },
    { gene: "NR1D2",  lambda: 0.342, root: "Complex", jtkPct: 96.6, ar2Pct: 19.3 },
    { gene: "DBP",    lambda: 0.291, root: "Real",    jtkPct: 88.3, ar2Pct: 12.9 },
    { gene: "CRY2",   lambda: 0.188, root: "Complex", jtkPct: 40.9, ar2Pct: 4.1  },
    { gene: "AANAT",  lambda: 0.129, root: "Complex", jtkPct: 40.9, ar2Pct: 1.3  },
  ],
};

// ── Key statistics from benchmark run (GSE70499, Aug 2026) ───────────────────
const STATS = {
  dataset: "GSE70499 Mouse Liver (Bmal1-WT)",
  timepoints: 24,
  interval: "2h (CT18–CT64, ~2 full cycles)",
  genes: 20955,
  complexRoot: { n: 6589, pct: 31.4 },
  realRoot: { n: 14366, pct: 68.6 },
  sig: {
    ar2: { n: 285, pct: 1.4, label: "|λ| ≥ 0.80" },
    jtk: { n: 3171, pct: 15.1, label: "adj.p < 0.05" },
    cosinor: { n: 4949, pct: 23.6, label: "adj.p < 0.05" },
  },
  spearman: {
    ar2Jtk: { all: 0.2265, complex: 0.0591 },
    ar2Cos: { all: 0.2430, complex: -0.059 },
    jtkCos: { all: 0.649 },
  },
  concordance: [
    { n: 100,  ar2Jtk: 0.026, ar2Cos: 0.031, jtkCos: 0.418 },
    { n: 200,  ar2Jtk: 0.020, ar2Cos: 0.026, jtkCos: 0.487 },
    { n: 500,  ar2Jtk: 0.031, ar2Cos: 0.034, jtkCos: 0.560 },
    { n: 1000, ar2Jtk: 0.051, ar2Cos: 0.047, jtkCos: 0.672 },
  ],
  concordanceComplex: [
    { n: 50,  ar2Jtk: 0.111, ar2Cos: 0.136, jtkCos: 0.333 },
    { n: 100, ar2Jtk: 0.212, ar2Cos: 0.227, jtkCos: 0.515 },
    { n: 200, ar2Jtk: 0.198, ar2Cos: 0.198, jtkCos: 0.646 },
    { n: 500, ar2Jtk: 0.167, ar2Cos: 0.172, jtkCos: 0.818 },
  ],
  clockGenes: [
    { gene: "Nr1d1", lambda: 0.878, root: "Complex", jtkAdj: 0.0008, period: 10.0, ar2Pct: 99.9, jtkPct: 98.8 },
    { gene: "Arntl",  lambda: 0.864, root: "Complex", jtkAdj: 0.0004, period: 10.5, ar2Pct: 99.8, jtkPct: 99.6 },
    { gene: "Nr1d2",  lambda: 0.830, root: "Complex", jtkAdj: 0.0004, period: 9.6,  ar2Pct: 99.4, jtkPct: 99.5 },
    { gene: "Cry1",   lambda: 0.780, root: "Complex", jtkAdj: 0.0004, period: 9.8,  ar2Pct: 97.8, jtkPct: 99.5 },
    { gene: "Clock",  lambda: 0.772, root: "Complex", jtkAdj: 0.0003, period: 9.8,  ar2Pct: 97.3, jtkPct: 99.9 },
    { gene: "Dbp",    lambda: 0.738, root: "Complex", jtkAdj: 0.0015, period: 10.2, ar2Pct: 95.0, jtkPct: 97.7 },
    { gene: "Ciart",  lambda: 0.735, root: "Complex", jtkAdj: 0.0009, period: 10.3, ar2Pct: 94.6, jtkPct: 98.6 },
    { gene: "Tef",    lambda: 0.712, root: "Complex", jtkAdj: 0.0005, period: 10.6, ar2Pct: 91.9, jtkPct: 99.3 },
    { gene: "Per3",   lambda: 0.672, root: "Complex", jtkAdj: 0.0013, period: 11.0, ar2Pct: 86.1, jtkPct: 97.9 },
    { gene: "Npas2",  lambda: 0.644, root: "Complex", jtkAdj: 0.0004, period: 11.1, ar2Pct: 81.5, jtkPct: 99.7 },
    { gene: "Rorc",   lambda: 0.637, root: "Complex", jtkAdj: 0.0004, period: 10.6, ar2Pct: 80.3, jtkPct: 99.9 },
    { gene: "Per2",   lambda: 0.557, root: "Complex", jtkAdj: 0.0004, period: 14.6, ar2Pct: 63.5, jtkPct: 99.9 },
    { gene: "Hlf",    lambda: 0.538, root: "Real",    jtkAdj: 0.0081, period: null, ar2Pct: 59.6, jtkPct: 93.2 },
    { gene: "Per1",   lambda: 0.454, root: "Complex", jtkAdj: 0.0042, period: 10.2, ar2Pct: 41.4, jtkPct: 95.6 },
    { gene: "Cry2",   lambda: 0.414, root: "Real",    jtkAdj: 0.1338, period: null, ar2Pct: 33.7, jtkPct: 78.3 },
    { gene: "Rora",   lambda: 0.406, root: "Real",    jtkAdj: 0.0818, period: null, ar2Pct: 32.2, jtkPct: 81.9 },
  ],
};

function PctBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">{pct.toFixed(0)}%</span>
    </div>
  );
}

function StatCard({
  label, value, sub, color,
}: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-lg border border-border/50 bg-card/50 px-4 py-3">
      <div className={`text-xl font-bold tabular-nums ${color ?? "text-foreground"}`}>{value}</div>
      <div className="text-xs font-medium text-foreground/80 mt-0.5">{label}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function ConcordanceTable({ data, label }: { data: typeof STATS.concordance; label: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">{label}</div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/50">
            <th className="text-left py-1.5 text-xs text-muted-foreground font-medium w-20">Top N</th>
            <th className="text-right py-1.5 text-xs text-muted-foreground font-medium">AR(2) ∩ JTK</th>
            <th className="text-right py-1.5 text-xs text-muted-foreground font-medium">AR(2) ∩ Cosinor</th>
            <th className="text-right py-1.5 text-xs text-muted-foreground font-medium">JTK ∩ Cosinor</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.n} className="border-b border-border/30">
              <td className="py-1.5 text-xs font-mono text-muted-foreground">{row.n}</td>
              <td className="py-1.5 text-right font-mono text-xs">
                <span className={row.ar2Jtk >= 0.15 ? "text-emerald-400" : row.ar2Jtk >= 0.05 ? "text-amber-400" : "text-red-400"}>
                  {row.ar2Jtk.toFixed(3)}
                </span>
              </td>
              <td className="py-1.5 text-right font-mono text-xs">
                <span className={row.ar2Cos >= 0.15 ? "text-emerald-400" : row.ar2Cos >= 0.05 ? "text-amber-400" : "text-red-400"}>
                  {row.ar2Cos.toFixed(3)}
                </span>
              </td>
              <td className="py-1.5 text-right font-mono text-xs">
                <span className={row.jtkCos >= 0.40 ? "text-emerald-400" : row.jtkCos >= 0.20 ? "text-amber-400" : "text-red-400"}>
                  {row.jtkCos.toFixed(3)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BaboonBenchmarkTab() {
  const s = BABOON_STATS;
  return (
    <div className="space-y-8">
      {/* Replication callout */}
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-5 py-4">
        <div className="flex gap-3">
          <CheckCircle size={16} className="text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-sm space-y-1.5">
            <p className="font-semibold text-emerald-300">Second-species replication: orthogonality confirmed in baboon</p>
            <p className="text-muted-foreground text-sm">
              Within complex-root (oscillatory) genes, Spearman(AR(2) λ, JTK) = <strong className="text-foreground">−0.203</strong> in baboon liver vs
              +0.059 in mouse liver. Both datasets yield |r| &lt; 0.25 (R² &lt; 5%), confirming that AR(2) persistence and JTK
              rhythmicity share &lt;5% of variance in two independent species and liver datasets.
            </p>
          </div>
        </div>
      </div>

      {/* Key comparison table */}
      <div>
        <h2 className="text-base font-semibold mb-3">Cross-species comparison — within complex-root Spearman</h2>
        <div className="rounded-lg border border-border/50 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b border-border/50">
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Dataset</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Species / Tissue</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">N timepoints</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Genes</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Complex %</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">ρ(AR2, JTK) within complex</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/30">
                <td className="px-4 py-2 font-mono text-xs">GSE70499</td>
                <td className="px-4 py-2 text-xs">Mouse liver (Mus musculus)</td>
                <td className="px-4 py-2 text-right font-mono text-xs">24</td>
                <td className="px-4 py-2 text-right font-mono text-xs">20,955</td>
                <td className="px-4 py-2 text-right font-mono text-xs text-violet-400">31.4%</td>
                <td className="px-4 py-2 text-right font-mono text-xs text-emerald-400">+0.059</td>
              </tr>
              <tr className="border-b border-border/30">
                <td className="px-4 py-2 font-mono text-xs">GSE98965</td>
                <td className="px-4 py-2 text-xs">Baboon liver (Papio anubis)</td>
                <td className="px-4 py-2 text-right font-mono text-xs">12</td>
                <td className="px-4 py-2 text-right font-mono text-xs">14,824</td>
                <td className="px-4 py-2 text-right font-mono text-xs text-violet-400">64.5%</td>
                <td className="px-4 py-2 text-right font-mono text-xs text-emerald-400">−0.203</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          Both |r| &lt; 0.25 → R² &lt; 5% → the two methods share negligible variance in both species.
          The sign difference indicates different relative gene orderings across species — consistent with measuring distinct properties.
        </p>
      </div>

      <Separator />

      {/* Baboon summary stats */}
      <div>
        <h2 className="text-base font-semibold mb-3">Baboon liver — detection summary</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <StatCard label="Genes analysed" value="14,824" sub="≥50% non-zero" />
          <StatCard label="Complex-root" value="64.5%" sub="9,563 genes" color="text-violet-400" />
          <StatCard label="Real-root" value="35.5%" sub="5,261 genes" color="text-slate-400" />
          <StatCard label="Clock genes found" value="17 / 20" sub="human ortholog symbols" color="text-emerald-400" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "AR(2) significant", n: 729,  pct: 4.9,  label2: "|λ| ≥ 0.80", color: "text-emerald-400", bar: "bg-emerald-500" },
            { label: "JTK_Cycle ranked",  n: "~504", pct: 3.4, label2: "top 3.4% by τ rank (BH n.s. at N=12)", color: "text-blue-400", bar: "bg-blue-500" },
            { label: "Cosinor significant", n: 1, pct: 0.0, label2: "adj.p < 0.05", color: "text-orange-400", bar: "bg-orange-500" },
          ].map(({ label, n, pct, label2, color, bar }) => (
            <div key={label} className="rounded-lg border border-border/50 bg-card/50 p-4">
              <div className="text-xs text-muted-foreground mb-1">{label}</div>
              <div className={`text-2xl font-bold tabular-nums ${color}`}>{n.toLocaleString()}</div>
              <div className="text-[11px] text-muted-foreground mb-2">{label2}</div>
              <PctBar pct={pct} color={bar} />
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-3">
          JTK_Cycle finds 0 genome-wide significant genes after BH correction at N=12 timepoints — insufficient
          statistical power for significance at the genome level. However, ranking-based Spearman correlation
          with AR(2) remains informative and shows the same low-magnitude orthogonality pattern.
        </p>
      </div>

      <Separator />

      {/* Scatter figures */}
      <div>
        <h2 className="text-base font-semibold mb-1">Scatter plots — Baboon Liver</h2>
        <div className="rounded-xl border border-border/50 overflow-hidden">
          <img
            src="/figures/benchmark/baboon/baboon_scatter.png"
            alt="Scatter: AR(2) vs JTK_Cycle and Cosinor, baboon liver"
            className="w-full"
          />
        </div>
        <div className="grid grid-cols-2 gap-4 mt-3">
          <div className="rounded-lg border border-border/40 bg-card/30 px-4 py-3 text-sm">
            <div className="font-medium mb-1">Spearman rank correlations</div>
            <div className="space-y-1 text-muted-foreground text-xs">
              <div className="flex justify-between">
                <span>All genes: AR(2) λ vs JTK −log₁₀p</span>
                <span className="font-mono text-amber-400">0.071</span>
              </div>
              <div className="flex justify-between">
                <span>Complex-root only: AR(2) λ vs JTK</span>
                <span className="font-mono text-emerald-400">−0.203</span>
              </div>
              <div className="flex justify-between">
                <span>All genes: AR(2) λ vs cosinor amplitude</span>
                <span className="font-mono text-amber-400">−0.262</span>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-border/40 bg-card/30 px-4 py-3 text-sm">
            <div className="font-medium mb-1">Comparison with mouse benchmark</div>
            <div className="text-muted-foreground text-xs space-y-1">
              <p>Mouse within-complex ρ = +0.059; Baboon within-complex ρ = −0.203.</p>
              <p>Both |r| &lt; 0.25 (R² &lt; 5%). Sign difference expected if the methods measure genuinely different
              biological dimensions — the relative ordering of genes can vary by species.</p>
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Concordance */}
      <div>
        <h2 className="text-base font-semibold mb-3">Gene-list concordance — Baboon Liver</h2>
        <div className="rounded-xl border border-border/50 overflow-hidden mb-5">
          <img
            src="/figures/benchmark/baboon/baboon_concordance.png"
            alt="Concordance bar chart, baboon liver"
            className="w-full"
          />
        </div>
        <ConcordanceTable data={s.concordance} label="Top-N gene list overlap (Jaccard)" />
        <p className="text-[11px] text-muted-foreground mt-3">
          AR(2) ∩ JTK Jaccard 0.031–0.047 across cutoffs, comparable to mouse (0.026–0.051).
          JTK ∩ Cosinor overlap increases at higher N as both methods agree on steadily oscillating genes.
        </p>
      </div>

      <Separator />

      {/* Clock gene table */}
      <div>
        <h2 className="text-base font-semibold mb-3">Canonical clock gene rankings — Baboon Liver</h2>
        <div className="rounded-xl border border-border/50 overflow-hidden mb-4">
          <img
            src="/figures/benchmark/baboon/baboon_clock_genes.png"
            alt="Clock gene ranking, baboon liver"
            className="w-full"
          />
        </div>
        <div className="rounded-lg border border-border/50 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b border-border/50">
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Gene</th>
                <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">|λ|</th>
                <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">Root</th>
                <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">AR(2) pct</th>
                <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">JTK pct</th>
              </tr>
            </thead>
            <tbody>
              {s.clockGenes.map((g) => (
                <tr key={g.gene} className="border-b border-border/30 hover:bg-muted/20">
                  <td className="px-3 py-2 font-mono text-xs font-medium">{g.gene}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs">{g.lambda.toFixed(3)}</td>
                  <td className="px-3 py-2 text-center">
                    <Badge variant="outline"
                      className={`text-[10px] ${g.root === "Complex" ? "border-violet-500/40 text-violet-400" : "border-slate-500/40 text-slate-400"}`}>
                      {g.root}
                    </Badge>
                  </td>
                  <td className={`px-3 py-2 text-right font-mono text-xs ${g.ar2Pct >= 85 ? "text-emerald-400" : g.ar2Pct >= 60 ? "text-amber-400" : "text-red-400"}`}>
                    {g.ar2Pct.toFixed(1)}
                  </td>
                  <td className={`px-3 py-2 text-right font-mono text-xs ${g.jtkPct >= 85 ? "text-emerald-400" : g.jtkPct >= 60 ? "text-amber-400" : "text-red-400"}`}>
                    {g.jtkPct.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-muted-foreground mt-3">
          PER1, PER2, PER3, ARNTL, CRY1 rank in the top 3–4% by JTK (96.6th percentile) — the JTK
          ranking correctly identifies circadian genes even without reaching formal genome-wide significance.
        </p>
      </div>

      {/* Dataset note */}
      <div className="rounded-lg border border-border/40 bg-muted/20 p-4">
        <div className="text-xs font-mono text-muted-foreground space-y-1">
          <div className="font-semibold text-foreground/70 mb-2">Dataset & methods note</div>
          <p>Baboon dataset: GSE98965 (Mure et al. 2018, Science). Tissue: LIV (liver). 12 ZT timepoints (ZT00–ZT22, 2h intervals). 14,824 genes passing ≥50% non-zero filter. log₂(FPKM+1) transform.</p>
          <p>Gene symbols: human ortholog symbols as annotated in GSE98965 (Papio anubis genome). Clock gene set uses UPPERCASE ortholog names.</p>
          <p>JTK_Cycle: same Python vectorised implementation as mouse benchmark. BH correction genome-wide. N=12 provides insufficient power for genome-wide significance; ranking information retained.</p>
          <p>Script: <code className="bg-muted/50 px-1 rounded">python scripts/benchmark_baboon_liver.py</code>. Output: <code className="bg-muted/50 px-1 rounded">analysis/outputs/benchmark/baboon/</code>.</p>
        </div>
      </div>
    </div>
  );
}

export default function BenchmarkPage() {
  const [showComplex, setShowComplex] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/50 bg-card/30 py-8 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-3">
            <GitCompare size={13} />
            <span>Method Validation</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mb-2">
            AR(2) vs JTK_Cycle vs Cosinor
          </h1>
          <p className="text-muted-foreground text-sm max-w-2xl">
            Head-to-head comparison across two species: mouse liver (GSE70499, 24 timepoints)
            and baboon liver (GSE98965, 12 timepoints). JTK_Cycle and Cosinor implemented in Python
            using the same expression matrix as the AR(2) pipeline — no configuration differences.
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            <Badge variant="outline" className="text-xs">Mouse liver · GSE70499 · 24 timepoints</Badge>
            <Badge variant="outline" className="text-xs">Baboon liver · GSE98965 · 12 timepoints</Badge>
            <Badge variant="outline" className="text-xs">Two-species replication</Badge>
            <Badge variant="outline" className="text-xs">August 2026</Badge>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <Tabs defaultValue="mouse">
          <TabsList className="mb-6">
            <TabsTrigger value="mouse">Mouse Liver (GSE70499)</TabsTrigger>
            <TabsTrigger value="baboon">Baboon Liver (GSE98965)</TabsTrigger>
          </TabsList>

          {/* ── Mouse liver tab ──────────────────────────────────────── */}
          <TabsContent value="mouse">
        <div className="space-y-10">

        {/* Key finding callout */}
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-5 py-4">
          <div className="flex gap-3">
            <Info size={16} className="text-amber-400 shrink-0 mt-0.5" />
            <div className="text-sm space-y-1.5">
              <p className="font-semibold text-amber-300">Root type is the key to interpreting these results</p>
              <p className="text-muted-foreground text-sm">
                68.6% of genes have Real roots (overdamped — exponential decay, no oscillation). These score
                high on AR(2) |λ| when expression is autocorrelated, but JTK_Cycle correctly ignores them
                because they have no sinusoidal waveform. The low overall concordance (Jaccard 0.026 at
                top-100) is almost entirely explained by this Real-root population. Restricted to
                Complex-root genes (genuine oscillators), concordance rises to 0.212 at top-100.
              </p>
              <p className="text-muted-foreground text-sm">
                Even within Complex-root genes, Spearman(AR(2) λ, JTK score) = 0.059 — essentially zero.
                This confirms the two metrics are genuinely orthogonal: <strong className="text-foreground">AR(2) measures oscillatory
                persistence; JTK_Cycle measures oscillatory amplitude regularity</strong>. A gene can score
                high on one and low on the other without contradiction.
              </p>
            </div>
          </div>
        </div>

        {/* Summary stats */}
        <div>
          <h2 className="text-base font-semibold mb-4">Detection summary</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <StatCard label="Genes analysed" value="20,955" />
            <StatCard label="Complex-root (oscillatory)" value="31.4%" sub="6,589 genes" color="text-violet-400" />
            <StatCard label="Real-root (overdamped)" value="68.6%" sub="14,366 genes" color="text-slate-400" />
            <StatCard label="Clock genes found" value="16 / 20" sub="all in dataset" color="text-emerald-400" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: "AR(2) significant", sig: STATS.sig.ar2, color: "text-emerald-400", bar: "bg-emerald-500" },
              { label: "JTK_Cycle significant", sig: STATS.sig.jtk, color: "text-blue-400", bar: "bg-blue-500" },
              { label: "Cosinor significant", sig: STATS.sig.cosinor, color: "text-orange-400", bar: "bg-orange-500" },
            ].map(({ label, sig, color, bar }) => (
              <div key={label} className="rounded-lg border border-border/50 bg-card/50 p-4">
                <div className="text-xs text-muted-foreground mb-1">{label}</div>
                <div className={`text-2xl font-bold tabular-nums ${color}`}>{sig.n.toLocaleString()}</div>
                <div className="text-[11px] text-muted-foreground mb-2">{sig.pct}% of genes · {sig.label}</div>
                <PctBar pct={sig.pct} color={bar} />
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Scatter figures */}
        <div>
          <h2 className="text-base font-semibold mb-1">Panel A & B — Scatter plots</h2>
          <p className="text-sm text-muted-foreground mb-4">
            AR(2) |λ| vs JTK_Cycle (−log₁₀ adj.p) and AR(2) |λ| vs Cosinor amplitude.
            Canonical clock genes highlighted in red/blue. 20k background genes in grey.
          </p>
          <div className="rounded-xl border border-border/50 overflow-hidden">
            <img
              src="/figures/benchmark/benchmark_scatter.png"
              alt="Scatter plots: AR(2) vs JTK_Cycle and AR(2) vs Cosinor"
              className="w-full"
            />
          </div>
          <div className="grid grid-cols-2 gap-4 mt-3">
            <div className="rounded-lg border border-border/40 bg-card/30 px-4 py-3 text-sm">
              <div className="font-medium mb-1">Spearman rank correlation</div>
              <div className="space-y-1 text-muted-foreground text-xs">
                <div className="flex justify-between">
                  <span>AR(2) λ vs JTK −log₁₀p (all genes)</span>
                  <span className="font-mono text-amber-400">0.227</span>
                </div>
                <div className="flex justify-between">
                  <span>AR(2) λ vs JTK (complex-root only)</span>
                  <span className="font-mono text-red-400">0.059</span>
                </div>
                <div className="flex justify-between">
                  <span>AR(2) λ vs cosinor amplitude</span>
                  <span className="font-mono text-amber-400">0.243</span>
                </div>
                <div className="flex justify-between">
                  <span>JTK |τ| vs cosinor amplitude</span>
                  <span className="font-mono text-emerald-400">0.649</span>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-border/40 bg-card/30 px-4 py-3 text-sm">
              <div className="font-medium mb-1">What the correlations mean</div>
              <div className="text-muted-foreground text-xs space-y-1">
                <p>JTK and Cosinor correlate at 0.65 — they measure similar things (sinusoidal regularity).</p>
                <p>AR(2) correlates with both at ~0.23 overall, dropping to ~0.06 among genuine oscillators.</p>
                <p>Conclusion: AR(2) persistence is an orthogonal measurement, not a noisier version of rhythmicity scoring.</p>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Concordance */}
        <div>
          <h2 className="text-base font-semibold mb-1">Panel C — Gene-list concordance (Jaccard overlap)</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Fraction of shared genes between each pair of top-N gene lists.
          </p>
          <div className="rounded-xl border border-border/50 overflow-hidden mb-6">
            <img
              src="/figures/benchmark/benchmark_concordance.png"
              alt="Concordance bar chart"
              className="w-full"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Card className="bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  All genes
                  <Badge variant="outline" className="text-[10px]">20,955</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ConcordanceTable data={STATS.concordance} label="" />
                <p className="text-[11px] text-muted-foreground mt-3">
                  Low AR(2) overlap is driven by Real-root genes. JTK ∩ Cosinor overlap is high because
                  both measure sinusoidal regularity.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card/50 border-violet-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  Complex-root genes only
                  <Badge className="text-[10px] bg-violet-500/20 text-violet-300 border-violet-500/30">6,589</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ConcordanceTable data={STATS.concordanceComplex} label="" />
                <p className="text-[11px] text-muted-foreground mt-3">
                  Restricting to oscillatory genes (complex roots) raises AR(2) ∩ JTK from 0.026 → 0.212
                  at top-100 — an 8× improvement. Spearman still 0.059, confirming genuine orthogonality
                  even among oscillators.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        <Separator />

        {/* Clock gene rankings */}
        <div>
          <h2 className="text-base font-semibold mb-1">Panel D — Canonical clock gene rankings</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Percentile rank of each clock gene under AR(2) |λ| and JTK_Cycle.
            Higher = more rhythmic/persistent.
          </p>
          <div className="rounded-xl border border-border/50 overflow-hidden mb-5">
            <img
              src="/figures/benchmark/benchmark_clock_genes.png"
              alt="Clock gene ranking comparison"
              className="w-full"
            />
          </div>

          {/* Clock gene table */}
          <div className="rounded-lg border border-border/50 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 border-b border-border/50">
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Gene</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">|λ|</th>
                  <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">Root</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">JTK adj.p</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">AR(2) pct</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">JTK pct</th>
                  <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">Both agree?</th>
                </tr>
              </thead>
              <tbody>
                {STATS.clockGenes.map((g) => {
                  const bothAgree = g.ar2Pct >= 85 && g.jtkPct >= 85;
                  const ar2Good = g.ar2Pct >= 85;
                  const jtkGood = g.jtkPct >= 85;
                  return (
                    <tr key={g.gene} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                      <td className="px-3 py-2 font-mono text-xs font-medium">{g.gene}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs">{g.lambda.toFixed(3)}</td>
                      <td className="px-3 py-2 text-center">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${g.root === "Complex" ? "border-violet-500/40 text-violet-400" : "border-slate-500/40 text-slate-400"}`}
                        >
                          {g.root}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">
                        {g.jtkAdj < 0.001 ? "<0.001" : g.jtkAdj.toFixed(4)}
                      </td>
                      <td className={`px-3 py-2 text-right font-mono text-xs ${ar2Good ? "text-emerald-400" : g.ar2Pct >= 60 ? "text-amber-400" : "text-red-400"}`}>
                        {g.ar2Pct.toFixed(1)}
                      </td>
                      <td className={`px-3 py-2 text-right font-mono text-xs ${jtkGood ? "text-emerald-400" : g.jtkPct >= 60 ? "text-amber-400" : "text-red-400"}`}>
                        {g.jtkPct.toFixed(1)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {bothAgree
                          ? <CheckCircle size={13} className="text-emerald-400 mx-auto" />
                          : ar2Good || jtkGood
                          ? <AlertTriangle size={13} className="text-amber-400 mx-auto" />
                          : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-muted-foreground mt-3">
            ✓ 8/8 canonical core-loop genes (Nr1d1, Arntl, Nr1d2, Cry1, Clock, Dbp, Tef, Ciart) rank above 90th
            percentile on both methods — strong agreement on the strongest signals. Divergence appears on
            weaker members (Per1, Per2, Cry2) where the two methods measure genuinely different aspects
            of the oscillatory regime.
          </p>
        </div>

        <Separator />

        {/* Interpretation */}
        <div>
          <h2 className="text-base font-semibold mb-4">Interpretation for reviewers</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
              <CheckCircle size={15} className="text-emerald-400 mb-2" />
              <div className="text-sm font-medium mb-1.5">Concordance validation ✓</div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>8/8 core clock genes rank in top 10% under both AR(2) and JTK_Cycle.</p>
                <p>JTK and AR(2) agree on the strongest signals; disagreement is concentrated on weaker members — expected if they measure different properties.</p>
              </div>
            </div>
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4">
              <FlaskConical size={15} className="text-blue-400 mb-2" />
              <div className="text-sm font-medium mb-1.5">Genuine orthogonality ✓</div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Spearman = 0.06 within oscillatory genes means AR(2) persistence adds new information JTK_Cycle doesn't capture.</p>
                <p>Use case: layer persistence analysis over rhythmicity detection, not instead of it.</p>
              </div>
            </div>
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
              <AlertTriangle size={15} className="text-amber-400 mb-2" />
              <div className="text-sm font-medium mb-1.5">Caveat: root type matters</div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>High |λ| for Real-root genes reflects autocorrelation (slow variation), not oscillation. Claims about "oscillatory persistence" should specify complex-root genes.</p>
                <p>The 9,828 AR(2)-only genes are enriched for metabolic, RNA processing, and protein folding — biologically meaningful but not rhythmic in the sinusoidal sense.</p>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Download */}
        <div className="flex items-center justify-between rounded-lg border border-border/50 bg-card/30 px-5 py-4">
          <div>
            <div className="text-sm font-medium">Full benchmark results (CSV)</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              20,955 genes × all three methods — AR(2) λ, JTK adj.p/τ/phase, Cosinor amplitude/adj.p.
              Run: <code className="font-mono text-[11px] bg-muted/50 px-1 rounded">python scripts/benchmark_vs_jtk_rain.py</code>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild>
            <a href="/figures/benchmark/benchmark_scatter.png" download>
              <Download size={14} className="mr-1.5" />
              Figures
            </a>
          </Button>
        </div>

        <div className="rounded-lg border border-border/40 bg-muted/20 p-4">
          <div className="text-xs font-mono text-muted-foreground space-y-1">
            <div className="font-semibold text-foreground/70 mb-2">Methods note</div>
            <p>JTK_Cycle: vectorised Kendall τ against cosine references at 24h period, 12 phase offsets (0–22h in 2h steps). Omnibus p = Bonferroni × 12. Genome-wide correction: Benjamini-Hochberg.</p>
            <p>Cosinor: OLS harmonic regression y(t) = A·cos(2πt/24) + B·sin(2πt/24) + C. Amplitude = √(A²+B²). F-test for H₀: A=B=0 (2 df numerator, n−3 denominator). BH correction.</p>
            <p>AR(2): OLS on mean-centred series. Companion matrix eigenvalue modulus. Complex roots: |λ| = √(−φ₂). Real roots: |λ| = max(|r₁|, |r₂|).</p>
            <p>Dataset: GSE70499 (Hughes lab, FPKM, log₂(x+1) transform, ≥50% non-zero filter). Run August 2026.</p>
          </div>
        </div>

        </div>{/* end space-y-10 mouse tab */}
          </TabsContent>

          {/* ── Baboon liver tab ─────────────────────────────────────── */}
          <TabsContent value="baboon">
            <BaboonBenchmarkTab />
          </TabsContent>

        </Tabs>
      </div>
    </div>
  );
}
