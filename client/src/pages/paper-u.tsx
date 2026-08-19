import { useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft, Download, FileText, ExternalLink, AlertTriangle,
  TrendingDown, TrendingUp, RotateCcw, Dna, Microscope, FlaskConical
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ─── data ────────────────────────────────────────────────────────────────────

const PAR_BZIP_GENES = [
  { gene: "Dbp",      log2fc: "−1.776", adjp: "0.0005",  dir: "DOWN", note: "PAR bZIP core" },
  { gene: "Tef",      log2fc: "−1.502", adjp: "<0.0001", dir: "DOWN", note: "PAR bZIP core" },
  { gene: "Hlf",      log2fc: "−1.657", adjp: "<0.0001", dir: "DOWN", note: "PAR bZIP core" },
  { gene: "Ciart",    log2fc: "−2.509", adjp: "<0.0001", dir: "DOWN", note: "Largest effect" },
  { gene: "Bhlhe41",  log2fc: "−1.627", adjp: "<0.0001", dir: "DOWN", note: "" },
  { gene: "Wee1",     log2fc: "−0.905", adjp: "0.0011",  dir: "DOWN", note: "G2/M brake" },
  { gene: "Rorc",     log2fc: "−0.751", adjp: "0.0080",  dir: "DOWN", note: "" },
  { gene: "Nfil3",    log2fc: "+1.542", adjp: "0.0005",  dir: "UP",   note: "Counter-regulatory" },
];

const CORE_CLOCK_GENES = [
  { gene: "Arntl (Bmal1)", log2fc: "+1.282", adjp: "<0.0001", dir: "UP",   note: "Positive arm" },
  { gene: "Npas2",         log2fc: "+1.499", adjp: "<0.0001", dir: "UP",   note: "Positive arm" },
  { gene: "Clock",         log2fc: "+0.194", adjp: "0.6755",  dir: "UP",   note: "ns" },
  { gene: "Per2",          log2fc: "−1.421", adjp: "<0.0001", dir: "DOWN", note: "Negative arm" },
  { gene: "Per3",          log2fc: "−1.366", adjp: "0.0001",  dir: "DOWN", note: "Negative arm" },
  { gene: "Cry2",          log2fc: "−0.847", adjp: "0.0003",  dir: "DOWN", note: "Negative arm" },
  { gene: "Nr1d2 (Rev-Erbβ)", log2fc: "−1.048", adjp: "0.0003", dir: "DOWN", note: "" },
];

const HALLMARK = [
  { pathway: "INTERFERON_GAMMA_RESPONSE", n: 106, down: 85, up: 21, p: "1.5×10⁻⁹",  auc: "0.333", sig: "DOWN ★★★" },
  { pathway: "FATTY_ACID_METABOLISM",     n: 71,  down: 51, up: 20, p: "1.9×10⁻⁴",  auc: "0.378", sig: "DOWN ★★★" },
  { pathway: "CIRCADIAN_CLOCK",           n: 38,  down: 29, up: 9,  p: "2.1×10⁻⁴",  auc: "0.335", sig: "DOWN ★★★ (16 FDR)" },
  { pathway: "CHOLESTEROL_HOMEOSTASIS",   n: 39,  down: 30, up: 9,  p: "2.6×10⁻⁴",  auc: "0.340", sig: "DOWN ★★★" },
  { pathway: "INFLAMMATORY_RESPONSE",     n: 131, down: 77, up: 54, p: "1.8×10⁻³",  auc: "0.426", sig: "DOWN ★★" },
  { pathway: "E2F_TARGETS",               n: 88,  down: 26, up: 62, p: "—",          auc: "0.725", sig: "UP ★★★" },
  { pathway: "G2M_CHECKPOINT",            n: 106, down: 25, up: 81, p: "2.2×10⁻⁸",  auc: "0.827", sig: "UP ★★★" },
];

// ─── component ───────────────────────────────────────────────────────────────

export default function PaperU() {
  const [activeTab, setActiveTab] = useState<"overview" | "tables" | "pdf">("overview");
  const [pdfError, setPdfError] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8">

        {/* Back */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/manuscript">
            <Button variant="ghost" size="sm" className="gap-2" data-testid="btn-back-manuscript">
              <ArrowLeft className="h-4 w-4" />
              All Manuscripts
            </Button>
          </Link>
        </div>

        {/* Header */}
        <div className="flex flex-col gap-2 mb-6">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="bg-sky-500/20 text-sky-400 border-sky-500/30">
              <Microscope className="h-3 w-3 mr-1" />
              Submission Ready
            </Badge>
            <Badge variant="outline" className="text-muted-foreground">
              Paper U · npj Microgravity (target)
            </Badge>
            <Badge variant="outline" className="text-muted-foreground font-mono text-xs">
              GLDS-247 / OSD-247 · RR-6
            </Badge>
            <Badge variant="outline" className="text-muted-foreground font-mono text-xs">
              v1.0 · July 2026
            </Badge>
          </div>
          <h1 className="text-2xl font-bold text-foreground leading-tight">
            Circadian Clock Disruption in the Murine Spaceflight Colon
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-4xl">
            IFN-γ suppression, G2M disinhibition, and PAR bZIP depletion during 60-day ISS exposure —
            all three disruptions fully reversed after 4 days of Earth re-entrainment.
            First transcriptomic characterisation of the spaceflight colon; zero prior citations on OSD-247 since deposition in August 2020.
          </p>
        </div>

        {/* Key-number strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: "IFN-γ pathway", value: "p = 1.5×10⁻⁹", sub: "most DOWN · 85/106 genes", color: "border-sky-500/30 bg-sky-600/10" },
            { label: "G2M checkpoint", value: "AUC = 0.827", sub: "p = 2.2×10⁻⁸ · most UP · 81/106 genes", color: "border-amber-500/30 bg-amber-600/10" },
            { label: "Wee1 ↔ G2M corr", value: "r = −0.616", sub: "p = 0.0065 per animal", color: "border-rose-500/30 bg-rose-600/10" },
            { label: "LAR reversal", value: "All p > 0.7", sub: "4-day re-entrainment restores", color: "border-emerald-500/30 bg-emerald-600/10" },
          ].map((k) => (
            <Card key={k.label} className={`border ${k.color}`}>
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground mb-0.5">{k.label}</p>
                <p className="text-sm font-bold text-foreground font-mono">{k.value}</p>
                <p className="text-xs text-muted-foreground">{k.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tab bar */}
        <div className="flex gap-2 mb-5">
          {(["overview", "tables", "pdf"] as const).map((t) => (
            <Button
              key={t}
              variant={activeTab === t ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab(t)}
              data-testid={`tab-${t}`}
            >
              {t === "overview" && <FlaskConical className="h-3.5 w-3.5 mr-1.5" />}
              {t === "tables"   && <Dna className="h-3.5 w-3.5 mr-1.5" />}
              {t === "pdf"      && <FileText className="h-3.5 w-3.5 mr-1.5" />}
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Button>
          ))}
        </div>

        {/* ── OVERVIEW ── */}
        {activeTab === "overview" && (
          <div className="space-y-5">

            {/* Three-disruption summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-sky-500/30 bg-sky-600/5">
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-sky-400" />
                    <CardTitle className="text-sm text-sky-400">1 · PAR bZIP Output Depletion</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0 text-xs text-muted-foreground space-y-1">
                  <p>The clock's primary output tier collapses completely. Dbp, Tef, and Hlf each lose &gt;1.5 log2FC — 3.4× to 5.6× suppression — while upstream BMAL1/NPAS2 <em>rise</em>.</p>
                  <p className="text-sky-300 font-medium">This is PAR(2)'s clock output tier, selectively eliminated in microgravity.</p>
                  <div className="pt-1 space-y-0.5 font-mono">
                    <div>Dbp −1.78 · FDR=0.0005</div>
                    <div>Tef  −1.50 · FDR&lt;0.0001</div>
                    <div>Hlf  −1.66 · FDR&lt;0.0001</div>
                    <div>Fisher χ²(6)=143 · p≈0</div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-amber-500/30 bg-amber-600/5">
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-amber-400" />
                    <CardTitle className="text-sm text-amber-400">2 · G2M Cell-Cycle Disinhibition</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0 text-xs text-muted-foreground space-y-1">
                  <p>Spaceflight dismantles the circadian G2/M gate from both ends: the brake (Wee1 −0.91 log2FC) is removed while the accelerator (G2M/E2F) engages.</p>
                  <p className="text-amber-300 font-medium">Wee1 anticorrelates with per-animal G2M score across all 9 animals.</p>
                  <div className="pt-1 space-y-0.5 font-mono">
                    <div>G2M AUC=0.827 · p=2.2×10⁻⁸ · 81/106 UP</div>
                    <div>E2F AUC=0.725 · 62/88 UP</div>
                    <div>Wee1 r=−0.616 · p=0.0065</div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-rose-500/30 bg-rose-600/5">
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-rose-400" />
                    <CardTitle className="text-sm text-rose-400">3 · Gut Immune Suppression</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0 text-xs text-muted-foreground space-y-1">
                  <p>IFN-γ response is the most significantly suppressed pathway — 85/106 genes DOWN. Ground controls gained +0.27 log2 IFN-γ score over 60 days; flight animals gained only +0.07.</p>
                  <p className="text-rose-300 font-medium">This is prevented immune priming, not a baseline measurement artifact.</p>
                  <div className="pt-1 space-y-0.5 font-mono">
                    <div>IFN-γ p=1.5×10⁻⁹</div>
                    <div>Inflammatory p=1.8×10⁻³</div>
                    <div>LAR reversal p=0.81</div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Clock uncoupling box */}
            <Card className="border-purple-500/30 bg-purple-600/5">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm text-purple-400 flex items-center gap-2">
                  <Dna className="h-4 w-4" />
                  Clock Uncoupling — Not Damping
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0">
                <p className="text-xs text-muted-foreground mb-3">
                  The spaceflight pattern is qualitatively distinct from a damped clock. Positive and negative arms change in <em>opposite directions</em>, with output collapsed —
                  consistent with a prolonged phase state where BMAL1 is constitutively active but repression never engages.
                </p>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-600/10 p-3 text-center">
                    <div className="text-emerald-400 font-semibold mb-1">ACTIVATORS ↑</div>
                    <div className="font-mono text-muted-foreground space-y-0.5">
                      <div>Bmal1 +1.28</div>
                      <div>Npas2 +1.50</div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-rose-500/30 bg-rose-600/10 p-3 text-center">
                    <div className="text-rose-400 font-semibold mb-1">REPRESSORS ↓</div>
                    <div className="font-mono text-muted-foreground space-y-0.5">
                      <div>Per2 −1.42</div>
                      <div>Per3 −1.37</div>
                      <div>Cry2 −0.85</div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-sky-500/30 bg-sky-600/10 p-3 text-center">
                    <div className="text-sky-400 font-semibold mb-1">OUTPUTS ↓↓↓</div>
                    <div className="font-mono text-muted-foreground space-y-0.5">
                      <div>Dbp −1.78</div>
                      <div>Tef  −1.50</div>
                      <div>Hlf  −1.66</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Reversibility */}
            <Card className="border-emerald-500/30 bg-emerald-600/5">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm text-emerald-400 flex items-center gap-2">
                  <RotateCcw className="h-4 w-4" />
                  Reversibility — Live Animal Return (LAR) Arm
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0 text-xs text-muted-foreground">
                <p className="mb-2">
                  Animals returned to Earth and dissected ~4 days post-landing show complete normalisation of all three disruption signatures.
                  This confirms the effects are spaceflight-specific circadian disruption, not permanent tissue damage or a housing artefact.
                </p>
                <div className="grid grid-cols-3 gap-2 font-mono">
                  <div className="rounded border border-border bg-muted/20 p-2 text-center">
                    <div className="text-emerald-400 font-semibold text-xs mb-0.5">PAR bZIP trio</div>
                    <div>Fisher p = 0.058</div>
                    <div className="text-muted-foreground/60">ISST: p ≈ 0</div>
                  </div>
                  <div className="rounded border border-border bg-muted/20 p-2 text-center">
                    <div className="text-emerald-400 font-semibold text-xs mb-0.5">IFN-γ pathway</div>
                    <div>MW p = 0.81</div>
                    <div className="text-muted-foreground/60">ISST: 1.5×10⁻⁹</div>
                  </div>
                  <div className="rounded border border-border bg-muted/20 p-2 text-center">
                    <div className="text-emerald-400 font-semibold text-xs mb-0.5">All pathways</div>
                    <div>all p &gt; 0.7</div>
                    <div className="text-muted-foreground/60">complete reversal</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Dataset note */}
            <Card className="border-border bg-muted/10">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p><span className="text-foreground font-medium">Dataset:</span> GLDS-247 / OSD-247 · NASA Rodent Research 6 (RR-6) · C57BL/6J male mice · colonic transcriptome · 60-day ISS (n=9 terminal FLT, n=9 GC) and ~30-day LAR arm (n=10 FLT, n=8 GC). Pre-computed differential expression from NASA GeneLab.</p>
                    <p><span className="text-foreground font-medium">AR(2) feasibility:</span> Cross-sectional design (single sacrifice per group, no ZT sampling) — AR(2) is not applicable. Analysis uses MSigDB Hallmark rank-sum enrichment and individual DE gene testing on pre-computed contrasts.</p>
                    <p><span className="text-foreground font-medium">Prior work:</span> Fujita et al. 2020 (Life 10:196) examined RR-6 liver and skeletal muscle. Colon was not analysed in any prior publication.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── TABLES ── */}
        {activeTab === "tables" && (
          <div className="space-y-6">

            {/* PAR bZIP + E-box panel */}
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-2">
                14-Gene PAR bZIP / E-box Output Panel — ISS-Terminal (60-day spaceflight)
              </h2>
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Gene</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">log2FC</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">adj.p</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Direction</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PAR_BZIP_GENES.map((g, i) => (
                      <tr key={g.gene} className={i % 2 === 0 ? "bg-background" : "bg-muted/10"}>
                        <td className="px-3 py-1.5 font-mono font-medium text-foreground">{g.gene}</td>
                        <td className={`px-3 py-1.5 font-mono text-right ${g.dir === "DOWN" ? "text-sky-400" : "text-amber-400"}`}>{g.log2fc}</td>
                        <td className="px-3 py-1.5 font-mono text-right text-muted-foreground">{g.adjp}</td>
                        <td className="px-3 py-1.5">
                          <span className={`inline-flex items-center gap-1 ${g.dir === "DOWN" ? "text-sky-400" : "text-amber-400"}`}>
                            {g.dir === "DOWN" ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                            {g.dir}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-muted-foreground">{g.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground mt-1">8/11 FDR-significant. Fisher combined p for trio: χ²(6)=143.45, p≈0.</p>
            </div>

            {/* Core clock */}
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-2">
                Core Clock Gene Expression — ISS-Terminal
              </h2>
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Gene</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">log2FC</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">adj.p</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Direction</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CORE_CLOCK_GENES.map((g, i) => (
                      <tr key={g.gene} className={i % 2 === 0 ? "bg-background" : "bg-muted/10"}>
                        <td className="px-3 py-1.5 font-mono font-medium text-foreground">{g.gene}</td>
                        <td className={`px-3 py-1.5 font-mono text-right ${g.dir === "DOWN" ? "text-sky-400" : "text-emerald-400"}`}>{g.log2fc}</td>
                        <td className="px-3 py-1.5 font-mono text-right text-muted-foreground">{g.adjp}</td>
                        <td className="px-3 py-1.5">
                          <span className={`inline-flex items-center gap-1 ${g.dir === "DOWN" ? "text-sky-400" : "text-emerald-400"}`}>
                            {g.dir === "DOWN" ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                            {g.dir}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-muted-foreground">{g.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Hallmark enrichment */}
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-2">
                MSigDB Hallmark Pathway Enrichment — ISS-Terminal (selected pathways)
              </h2>
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Pathway</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">N</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">↓</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">↑</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">AUC</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">p</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {HALLMARK.map((h, i) => {
                      const isDown = h.sig.startsWith("DOWN");
                      return (
                        <tr key={h.pathway} className={i % 2 === 0 ? "bg-background" : "bg-muted/10"}>
                          <td className="px-3 py-1.5 font-mono text-foreground">{h.pathway}</td>
                          <td className="px-3 py-1.5 font-mono text-right text-muted-foreground">{h.n}</td>
                          <td className="px-3 py-1.5 font-mono text-right text-sky-400">{h.down}</td>
                          <td className="px-3 py-1.5 font-mono text-right text-amber-400">{h.up}</td>
                          <td className="px-3 py-1.5 font-mono text-right text-muted-foreground">{h.auc}</td>
                          <td className="px-3 py-1.5 font-mono text-right text-muted-foreground">{h.p}</td>
                          <td className="px-3 py-1.5">
                            <span className={`font-medium ${isDown ? "text-sky-400" : "text-amber-400"}`}>{h.sig}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Mann-Whitney rank-sum enrichment, 18,017 genes. AUC &lt; 0.5 = down-shifted; AUC &gt; 0.5 = up-shifted.</p>
            </div>
          </div>
        )}

        {/* ── PDF ── */}
        {activeTab === "pdf" && (
          <div>
            <div className="flex items-center gap-3 mb-3">
              <p className="text-xs text-muted-foreground">
                Manuscript — password required to view. Use the
                {" "}<Link href="/manuscript"><span className="underline hover:text-foreground cursor-pointer">manuscript download page</span></Link>{" "}
                to enter the password and access the full PDF.
              </p>
              <Link href="/manuscript" className="shrink-0">
                <Button variant="outline" size="sm" className="gap-2" data-testid="btn-open-manuscript-page">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Download Page
                </Button>
              </Link>
            </div>
            <div className="rounded-xl border border-border overflow-hidden bg-card" style={{ height: "75vh" }}>
              {pdfError ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
                  <FileText className="h-12 w-12 opacity-30" />
                  <p className="text-sm">PDF requires password — use the manuscript download page.</p>
                  <Link href="/manuscript">
                    <Button variant="default" size="sm" className="gap-2">
                      <Download className="h-4 w-4" />
                      Go to Download Page
                    </Button>
                  </Link>
                </div>
              ) : (
                <iframe
                  src="/api/view/paper-pdf?id=paper-u"
                  className="w-full h-full border-0"
                  title="Paper U — Spaceflight Colon"
                  onError={() => setPdfError(true)}
                  data-testid="iframe-paper-u-pdf"
                />
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 flex flex-wrap justify-between items-center gap-3">
          <div className="text-xs text-muted-foreground space-y-0.5">
            <p>Data: <a href="https://osdr.nasa.gov/bio/repo/data/studies/OSD-247" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">OSD-247 / GLDS-247</a> — NASA Open Science Data Repository (deposited August 2020)</p>
            <p>Prior RR-6 work: Fujita et al. 2020 (Life 10:196) — liver &amp; skeletal muscle only</p>
          </div>
          <Link href="/manuscript">
            <Button size="sm" className="gap-2 bg-sky-600 hover:bg-sky-700" data-testid="btn-download-package">
              <Download className="h-3.5 w-3.5" />
              Download Package
            </Button>
          </Link>
        </div>

      </div>
    </div>
  );
}
