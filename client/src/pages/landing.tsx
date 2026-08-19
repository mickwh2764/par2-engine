import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, ArrowRight, Dna, Clock, Activity, FlaskConical, Play, FileText, ChevronDown, ExternalLink, CheckCircle2, XCircle, Search } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

const EXAMPLE_GENES = ["ARNTL", "PER2", "NR1D1", "MYC", "WEE1", "TP53"];

// ── Atlas types (subset of what gene-eigenvalue-atlas uses) ──────────────────
interface AtlasEntry {
  gene: string;
  category: string;
  categoryLabel: string;
  categoryColor: string;
  tissue: string;
  eigenvalue: number;
}
interface AtlasResponse {
  success: boolean;
  entries: AtlasEntry[];
}

const CAT_META: Record<string, { label: string; bg: string; text: string; barColor: string }> = {
  clock:        { label: 'Clock',      bg: 'bg-amber-100',   text: 'text-amber-800',   barColor: '#f59e0b' },
  target:       { label: 'Target',     bg: 'bg-red-100',     text: 'text-red-800',     barColor: '#ef4444' },
  housekeeping: { label: 'HK',         bg: 'bg-gray-100',    text: 'text-gray-700',    barColor: '#6b7280' },
  immune:       { label: 'Immune',     bg: 'bg-violet-100',  text: 'text-violet-800',  barColor: '#8b5cf6' },
  metabolic:    { label: 'Metabolic',  bg: 'bg-emerald-100', text: 'text-emerald-800', barColor: '#10b981' },
  chromatin:    { label: 'Chromatin',  bg: 'bg-pink-100',    text: 'text-pink-800',    barColor: '#ec4899' },
  signaling:    { label: 'Signaling',  bg: 'bg-blue-100',    text: 'text-blue-800',    barColor: '#3b82f6' },
  dna_repair:   { label: 'DNA Repair', bg: 'bg-teal-100',    text: 'text-teal-800',    barColor: '#14b8a6' },
  stem:         { label: 'Stem',       bg: 'bg-orange-100',  text: 'text-orange-800',  barColor: '#f97316' },
  other:        { label: 'Other',      bg: 'bg-slate-100',   text: 'text-slate-700',   barColor: '#475569' },
};

const PATHS = [
  {
    title: "Try with example data",
    desc: "See the three-tier hierarchy across 12 mouse tissues. No upload, no setup — results load instantly.",
    href: "/dashboard",
    icon: Play,
    color: "from-emerald-500 to-teal-500",
    badge: "No upload needed",
    cta: "Explore pre-loaded datasets",
  },
  {
    title: "Upload your own data",
    desc: "Drop in a CSV of gene expression time series and get eigenvalue persistence scores back in seconds.",
    href: "/discovery-engine",
    icon: Upload,
    color: "from-cyan-500 to-blue-500",
    badge: null,
    cta: "Open Discovery Engine",
  },
  {
    title: "Read the papers",
    desc: "Paper A covers the full method, 11 GEO datasets (37 time series), and 12 robustness analyses.",
    href: "/manuscript",
    icon: FileText,
    color: "from-indigo-500 to-violet-500",
    badge: null,
    cta: "View manuscripts",
  },
];

const WHAT_IT_DOES = [
  {
    icon: Clock,
    title: "Measures gene memory, not just rhythmicity",
    plain: "Tools like JTK_CYCLE and MetaCycle ask: is this gene rhythmic? This platform asks something different: how long does a gene's signal persist over time? The answer — the eigenvalue modulus |λ| — is mathematically independent of amplitude and reveals a layer of circadian biology that rhythmicity tests miss entirely.",
    accent: "emerald",
  },
  {
    icon: Dna,
    title: "Separates clock drivers from downstream targets",
    plain: "Clock genes (ARNTL, CLOCK, PER2, NR1D1) consistently score higher than the genes they regulate (WEE1, MYC, CCND1). This platform quantifies that separation across 22 datasets and 4 species — without any gene labels as input.",
    accent: "emerald",
  },
  {
    icon: Activity,
    title: "Detects disease-state collapse",
    plain: "In cancer, the persistence gap between clock genes and their targets shrinks or inverts — proliferative genes (E2F targets, cyclin-dependent kinases) acquire clock-level persistence. In APC-mutant organoids the gap directionally reverses (from +0.033 to −0.127), consistent with hierarchy collapse. The platform detects this from standard RNA-seq time series.",
    accent: "rose",
  },
  {
    icon: FlaskConical,
    title: "Works on your data, in your browser",
    plain: "Upload a CSV of gene expression time series — any organism, any tissue, any number of timepoints — and get AR(2) eigenvalue scores back within seconds. No R required, no installation, no code.",
    accent: "emerald",
  },
];

const COMPARISONS = [
  { feature: "Measures temporal persistence (|λ|)", us: true, jtk: false, metacycle: false },
  { feature: "Works without gene labels as input", us: true, jtk: false, metacycle: false },
  { feature: "Detects hierarchy collapse in disease", us: true, jtk: false, metacycle: false },
  { feature: "Live browser-based analysis", us: true, jtk: false, metacycle: false },
  { feature: "Validated across 4 species", us: true, jtk: true, metacycle: true },
  { feature: "Detects rhythmic genes (p-value)", us: false, jtk: true, metacycle: true },
];

export default function Landing() {
  const [howOpen, setHowOpen] = useState(true);
  const [geneQuery, setGeneQuery] = useState("");
  const [searchedGene, setSearchedGene] = useState<string | null>(null);

  const { data: atlasData, isLoading: atlasLoading, isError: atlasError, refetch: atlasRefetch } = useQuery<AtlasResponse>({
    queryKey: ["/api/gene-eigenvalue-atlas"],
    staleTime: 60 * 60 * 1000, // 1 h — same as atlas page
    enabled: !!searchedGene,   // only fetch after the user submits a search
    retry: false,              // surface errors immediately; user can re-submit to retry
  });

  const handleGeneSearch = (gene?: string) => {
    const q = (gene ?? geneQuery).trim().toUpperCase();
    if (!q) return;
    if (gene) setGeneQuery(gene);
    setSearchedGene(q);
    // If the previous request errored, trigger a fresh fetch so a retry is possible
    if (atlasError) atlasRefetch();
  };

  // Compute result card data only when a successful response is available
  // geneResult === undefined  → no search yet (searchedGene is null)
  // geneResult === "loading"  → query in flight
  // geneResult === "error"    → query failed
  // geneResult === null       → successful response, gene not in panel
  // geneResult === object     → found
  const geneResult = !searchedGene
    ? undefined
    : atlasLoading
    ? "loading" as const
    : atlasError
    ? "error" as const
    : atlasData?.entries
    ? (() => {
        const entries = atlasData.entries.filter(e => e.gene.toUpperCase() === searchedGene);
        if (!entries.length) return null;
        const meanLambda = entries.reduce((s, e) => s + e.eigenvalue, 0) / entries.length;
        const cat = entries[0].category;
        const meta = CAT_META[cat] ?? CAT_META.other;
        const tissues = entries.map(e => e.tissue);
        return { gene: entries[0].gene, meanLambda, cat, meta, tissues, entries };
      })()
    : undefined; // data not yet arrived (shouldn't normally reach here)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-10">

        {/* ── HERO ── */}
        <section className="text-center space-y-5" data-testid="landing-hero">

          {/* Audience badge */}
          <div className="flex flex-wrap justify-center gap-2 text-xs" data-testid="audience-badges">
            <span className="px-3 py-1 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200 font-medium">Circadian biologists</span>
            <span className="px-3 py-1 rounded-full bg-pink-50 text-pink-700 border border-pink-200 font-medium">Cancer researchers</span>
            <span className="px-3 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-200 font-medium">Computational biologists</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold leading-tight text-slate-900">
            PAR(2) Discovery Engine
          </h1>
          <p className="text-sm text-slate-500 -mt-3">AR(2) autoregressive modelling · circadian time-series gene expression</p>

          <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Why do clock genes stay stable across tissues and species while the genes they
            regulate don't? And why does that gap <strong>collapse in cancer, shift-work
            disruption, and neurodegeneration</strong>?
          </p>
          <p className="text-base text-slate-500 max-w-2xl mx-auto leading-relaxed -mt-2">
            This platform answers both questions from standard gene expression time series —
            no biological labels required, no installation, no code.
            Validated across 22 datasets and 4 species.
          </p>

          {/* Three-tier chart — the core finding */}
          <div className="mx-auto max-w-lg pt-1" data-testid="hero-persistence-chart">
            <svg viewBox="0 0 480 185" className="w-full" aria-label="Three-tier eigenvalue hierarchy: clock genes highest, target genes intermediate, background lowest">
              {[0.2, 0.4, 0.6, 0.8].map(v => (
                <line key={v} x1={112 + v * 310} y1="8" x2={112 + v * 310} y2="134" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3 2" />
              ))}
              <rect x="112" y="8" width={0.647 * 310} height="33" rx="4" fill="#22d3ee" opacity="0.9" />
              <text x="104" y="29" textAnchor="end" fontSize="11" fontWeight="600" fill="#0891b2">Clock</text>
              <text x={112 + 0.647 * 310 + 7} y="29" fontSize="12" fontWeight="700" fill="#0891b2">0.65</text>
              <text x={112 + 0.588 * 310} y="52" textAnchor="middle" fontSize="8.5" fill="#94a3b8">← gap = 0.12 →</text>
              <rect x="112" y="58" width={0.530 * 310} height="33" rx="4" fill="#f472b6" opacity="0.9" />
              <text x="104" y="79" textAnchor="end" fontSize="11" fontWeight="600" fill="#be185d">Target</text>
              <text x={112 + 0.530 * 310 + 7} y="79" fontSize="12" fontWeight="700" fill="#be185d">0.53</text>
              <text x={112 + 0.513 * 310} y="102" textAnchor="middle" fontSize="8.5" fill="#94a3b8">← gap = 0.03 →</text>
              <rect x="112" y="108" width={0.496 * 310} height="33" rx="4" fill="#94a3b8" opacity="0.75" />
              <text x="104" y="129" textAnchor="end" fontSize="11" fontWeight="600" fill="#64748b">Genome</text>
              <text x={112 + 0.496 * 310 + 7} y="129" fontSize="12" fontWeight="700" fill="#64748b">0.50</text>
              <line x1="112" y1="148" x2="422" y2="148" stroke="#cbd5e1" strokeWidth="1" />
              {[0, 0.2, 0.4, 0.6, 0.8].map(v => (
                <g key={v}>
                  <line x1={112 + v * 310} y1="148" x2={112 + v * 310} y2="154" stroke="#94a3b8" strokeWidth="1" />
                  <text x={112 + v * 310} y="165" textAnchor="middle" fontSize="9" fill="#94a3b8">{v.toFixed(1)}</text>
                </g>
              ))}
              <text x="267" y="181" textAnchor="middle" fontSize="9.5" fill="#94a3b8">Persistence  |λ|  — population-level lower bounds (bulk RNA); true per-cell values higher</text>
            </svg>
          </div>

          {/* |λ| plain-English definition — shown immediately below the chart */}
          <div className="mx-auto max-w-xl rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 text-left">
            <span className="font-semibold text-slate-800">What is |λ|?</span>{" "}
            It's a number from 0 to 1 called the <em>persistence score</em>. It measures how well a gene's current expression level predicts its next measurement — in other words, how self-sustaining the signal is over time. Clock genes score high (~0.65) because they maintain their own rhythm. Genes they regulate score lower (~0.53) because their expression depends on upstream input rather than self-sustaining feedback.{" "}
            <Link href="/getting-started"><span className="text-cyan-600 hover:underline cursor-pointer font-medium">New here? 5-minute guide →</span></Link>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap justify-center gap-8 pt-0 text-sm" data-testid="landing-stats">
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-700">22</div>
              <div className="text-slate-500 text-xs">Datasets validated</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-cyan-700">4</div>
              <div className="text-slate-500 text-xs">Species</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-700">11</div>
              <div className="text-slate-500 text-xs">Robustness checks</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-700">~21k</div>
              <div className="text-slate-500 text-xs">Genes scanned</div>
            </div>
          </div>

          {/* Primary CTAs */}
          <div className="flex flex-wrap justify-center gap-3 pt-1">
            <Link href="/dashboard">
              <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 gap-2 text-base text-white shadow-md shadow-emerald-200 px-7" data-testid="landing-example-btn">
                <Play className="w-5 h-5" />
                See a live result
              </Button>
            </Link>
            <Link href="/discovery-engine">
              <Button size="lg" variant="outline" className="border-cyan-500/60 text-cyan-700 hover:bg-cyan-50 hover:border-cyan-500 gap-2 text-base px-7" data-testid="landing-upload-btn">
                <Upload className="w-5 h-5" />
                Upload your data
              </Button>
            </Link>
            <Link href="/manuscript">
              <Button size="lg" variant="ghost" className="text-slate-500 hover:text-slate-700 hover:bg-slate-100 gap-2 text-base" data-testid="landing-papers-btn">
                <FileText className="w-4 h-4" />
                Read the papers
              </Button>
            </Link>
          </div>

          {/* In-press announcement */}
          <div className="flex justify-center pt-1">
            <Link href="/manuscript">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-purple-300 bg-purple-50 text-purple-700 text-xs font-medium cursor-pointer hover:bg-purple-100 transition-colors">
                <CheckCircle2 className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                Paper G published · <em>The Fibonacci Quarterly</em> · doi:10.1080/00150517.2026.2716122
                <ArrowRight className="w-3 h-3 text-purple-400" />
              </span>
            </Link>
          </div>

          {/* Preprint links — key credibility signal for academic visitors */}
          <div className="flex flex-wrap justify-center gap-4 pt-1 text-xs" data-testid="preprint-links">
            <a
              href="https://doi.org/10.21203/rs.3.rs-9283100/v1"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-slate-500 hover:text-indigo-600 transition-colors"
              data-testid="preprint-paper-a"
            >
              <ExternalLink className="w-3 h-3" />
              Preprint: Paper A — Research Square
            </a>
            <span className="text-slate-300">·</span>
            <a
              href="https://doi.org/10.21203/rs.3.rs-9214347/v1"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-slate-500 hover:text-indigo-600 transition-colors"
              data-testid="preprint-paper-e"
            >
              <ExternalLink className="w-3 h-3" />
              Preprint: Paper E — Research Square
            </a>
            <span className="text-slate-300">·</span>
            <a
              href="https://doi.org/10.21203/rs.3.rs-9385465/v1"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-slate-500 hover:text-indigo-600 transition-colors"
              data-testid="preprint-paper-f"
            >
              <ExternalLink className="w-3 h-3" />
              Preprint: Paper F — Research Square
            </a>
            <span className="text-slate-300">·</span>
            <Link href="/manuscript">
              <span className="flex items-center gap-1 text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer">
                <FileText className="w-3 h-3" />
                All papers →
              </span>
            </Link>
          </div>
        </section>

        {/* ── GENE SEARCH ── */}
        <section className="rounded-xl border border-cyan-200 bg-gradient-to-br from-cyan-50/70 to-white p-6 space-y-4" data-testid="landing-gene-search">
          <div>
            <h2 className="text-base font-semibold text-slate-800 mb-1">Look up any gene</h2>
            <p className="text-sm text-slate-500">Search the Gene Eigenvalue Atlas — |λ| persistence scores across mouse and human datasets, instantly.</p>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={geneQuery}
                onChange={e => setGeneQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleGeneSearch()}
                placeholder="e.g. ARNTL, PER2, MYC…"
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent"
                data-testid="landing-gene-input"
              />
            </div>
            <Button onClick={() => handleGeneSearch()} className="bg-cyan-600 hover:bg-cyan-700 text-white gap-1.5 shrink-0" data-testid="landing-gene-search-btn">
              <Search className="w-4 h-4" /> Search
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400">Try:</span>
            {EXAMPLE_GENES.map(g => (
              <button
                key={g}
                onClick={() => handleGeneSearch(g)}
                className="px-2.5 py-1 rounded-full bg-white border border-slate-200 text-xs font-mono text-cyan-700 hover:border-cyan-400 hover:bg-cyan-50 transition-colors"
                data-testid={`landing-gene-chip-${g}`}
              >
                {g}
              </button>
            ))}
            <Link href="/gene-eigenvalue-atlas">
              <span className="text-xs text-slate-400 hover:text-cyan-600 transition-colors cursor-pointer ml-1">Browse all →</span>
            </Link>
          </div>

          {/* ── Inline result card ── */}
          {searchedGene && (
            <div data-testid="landing-gene-result">
              {geneResult === "loading" ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 flex items-center gap-3 text-sm text-slate-500" data-testid="landing-gene-loading">
                  <svg className="animate-spin h-4 w-4 text-cyan-500 flex-shrink-0" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Looking up <span className="font-mono font-medium text-slate-700">{searchedGene}</span>…
                </div>
              ) : geneResult === "error" ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-center justify-between gap-3 text-sm text-red-700" data-testid="landing-gene-error">
                  <span>Could not load atlas data — please try again in a moment.</span>
                  <button
                    onClick={() => atlasRefetch()}
                    className="shrink-0 px-3 py-1 rounded-md bg-red-100 hover:bg-red-200 text-red-700 font-medium text-xs transition-colors"
                    data-testid="landing-gene-retry-btn"
                  >
                    Retry
                  </button>
                </div>
              ) : geneResult ? (
                <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3" data-testid="landing-gene-result-card">
                  {/* Header row */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-slate-900 font-mono">{geneResult.gene}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${geneResult.meta.bg} ${geneResult.meta.text}`}>
                        {geneResult.meta.label}
                      </span>
                    </div>
                    <Link href={`/gene-eigenvalue-atlas?q=${encodeURIComponent(geneResult.gene)}`}>
                      <span className="text-xs text-cyan-600 hover:text-cyan-800 hover:underline cursor-pointer font-medium flex items-center gap-1" data-testid="landing-gene-result-atlas-link">
                        See full atlas <ArrowRight className="w-3 h-3" />
                      </span>
                    </Link>
                  </div>

                  {/* Mean |λ| bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Mean |λ| across {geneResult.tissues.length} tissue{geneResult.tissues.length !== 1 ? 's' : ''}</span>
                      <span className="font-mono font-semibold text-slate-800">{geneResult.meanLambda.toFixed(3)}</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, geneResult.meanLambda * 100)}%`,
                          backgroundColor: geneResult.meta.barColor,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>0.0</span><span>0.5</span><span>1.0</span>
                    </div>
                  </div>

                  {/* Tissue list */}
                  <div className="flex flex-wrap gap-1">
                    {geneResult.entries
                      .slice()
                      .sort((a, b) => b.eigenvalue - a.eigenvalue)
                      .map(e => (
                        <span
                          key={e.tissue}
                          className="px-2 py-0.5 rounded-full bg-slate-50 border border-slate-200 text-[11px] text-slate-600 font-mono"
                          title={`|λ| = ${e.eigenvalue.toFixed(3)}`}
                        >
                          {e.tissue} {e.eigenvalue.toFixed(3)}
                        </span>
                      ))}
                  </div>
                </div>
              ) : geneResult === null ? (
                /* null = successful response, gene genuinely not in panel */
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500" data-testid="landing-gene-not-found">
                  <span className="font-medium text-slate-700">"{searchedGene}"</span> not found in panel —{" "}
                  try{" "}
                  {["ARNTL", "PER2", "MYC"].map((g, i) => (
                    <span key={g}>
                      {i > 0 && ", "}
                      <button
                        onClick={() => handleGeneSearch(g)}
                        className="font-mono text-cyan-600 hover:underline"
                      >
                        {g}
                      </button>
                    </span>
                  ))}
                </div>
              ) : null /* undefined = data not yet arrived; shouldn't normally reach */}
            </div>
          )}
        </section>

        {/* ── THREE PATHS ── */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 rounded-xl" data-testid="landing-paths">
          {PATHS.map((p) => (
            <Link key={p.href} href={p.href}>
              <Card className="bg-white border-slate-200 hover:border-slate-400 hover:shadow-md transition-all cursor-pointer h-full group" data-testid={`landing-path-${p.href.slice(1)}`}>
                <CardContent className="p-5 space-y-3 flex flex-col h-full">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${p.color} flex items-center justify-center`}>
                      <p.icon className="w-4 h-4 text-white" />
                    </div>
                    {p.badge && (
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">
                        {p.badge}
                      </Badge>
                    )}
                  </div>
                  <h3 className="text-base font-semibold text-slate-800">{p.title}</h3>
                  <p className="text-sm text-slate-500 flex-1">{p.desc}</p>
                  <div className="flex items-center gap-1 text-sm text-slate-500 group-hover:text-slate-800 transition-colors">
                    {p.cta} <ArrowRight className="w-4 h-4" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </section>

        {/* ── HOW IT WORKS (collapsible) ── */}
        <section className="rounded-xl border border-slate-100 bg-slate-50/60 overflow-hidden" data-testid="landing-how-it-works">
          <button
            className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50 transition-colors"
            onClick={() => setHowOpen(!howOpen)}
            data-testid="how-it-works-toggle"
          >
            <h2 className="text-base font-semibold text-slate-800">How it works</h2>
            <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${howOpen ? 'rotate-180' : ''}`} />
          </button>
          {howOpen && (
            <div className="px-5 pb-5 space-y-4 border-t border-slate-100">
              <div className="space-y-4 text-slate-700 leading-relaxed pt-4">
                <div className="flex gap-4 items-start">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold">1</div>
                  <p className="text-sm"><strong>Fit a simple model.</strong> For each gene, we ask: how well does its expression at time <em>t</em> predict time <em>t+1</em> and <em>t+2</em>? This is a standard AR(2) autoregressive model — two coefficients, one equation.</p>
                </div>
                <div className="flex gap-4 items-start">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold">2</div>
                  <p className="text-sm"><strong>Extract the eigenvalue.</strong> From those two coefficients, we calculate an eigenvalue modulus |λ| — a single number between 0 and 1 measuring how persistent the gene's signal is over time.</p>
                </div>
                <div className="flex gap-4 items-start">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold">3</div>
                  <p className="text-sm"><strong>Compare across genes.</strong> Clock genes consistently score higher than the targets they regulate. This separation appears robustly across species and healthy tissues — and collapses in disease models. No biological labels needed as input.</p>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ── WHAT IT DOES ── */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="landing-what-it-does">
          {WHAT_IT_DOES.map((item) => {
            const isRose = item.accent === "rose";
            return (
              <div
                key={item.title}
                className={`rounded-xl border p-5 space-y-2 ${
                  isRose
                    ? "border-rose-200 bg-rose-50/40"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isRose ? "bg-rose-100" : "bg-emerald-50"}`}>
                    <item.icon className={`w-4 h-4 ${isRose ? "text-rose-600" : "text-emerald-600"}`} />
                  </div>
                  <h3 className={`font-semibold text-sm ${isRose ? "text-rose-900" : "text-slate-800"}`}>{item.title}</h3>
                </div>
                <p className={`text-sm leading-relaxed ${isRose ? "text-rose-800/80" : "text-slate-600"}`}>{item.plain}</p>
              </div>
            );
          })}
        </section>

        {/* ── COMPARISON TABLE ── */}
        <section className="rounded-xl border border-slate-200 bg-white overflow-hidden" data-testid="landing-comparison">
          <div className="p-5 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-800">How this differs from existing tools</h2>
            <p className="text-xs text-slate-400 mt-1">JTK_CYCLE and MetaCycle are the standard — they detect rhythmicity. This platform measures something orthogonal.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left p-3 text-slate-600 font-medium w-1/2">Capability</th>
                  <th className="text-center p-3 text-slate-600 font-medium">PAR(2)</th>
                  <th className="text-center p-3 text-slate-600 font-medium">JTK_CYCLE</th>
                  <th className="text-center p-3 text-slate-600 font-medium">MetaCycle</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISONS.map((row, i) => (
                  <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="p-3 text-slate-700">{row.feature}</td>
                    <td className="p-3 text-center">
                      {row.us
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                        : <XCircle className="w-4 h-4 text-slate-300 mx-auto" />}
                    </td>
                    <td className="p-3 text-center">
                      {row.jtk
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                        : <XCircle className="w-4 h-4 text-slate-300 mx-auto" />}
                    </td>
                    <td className="p-3 text-center">
                      {row.metacycle
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                        : <XCircle className="w-4 h-4 text-slate-300 mx-auto" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 bg-slate-50 border-t border-slate-100">
            <p className="text-xs text-slate-400">PAR(2) and JTK_CYCLE/MetaCycle are complementary, not competing. Use rhythmicity tools to find rhythmic genes; use this platform to quantify their temporal dynamics and hierarchy.</p>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <div className="space-y-3 text-center pb-4" data-testid="landing-footer">
          <div className="flex justify-center gap-4 text-sm text-slate-400" data-testid="landing-footer-links">
            <Link href="/about">
              <span className="hover:text-slate-600 transition-colors cursor-pointer">About</span>
            </Link>
            <span>·</span>
            <Link href="/getting-started">
              <span className="hover:text-slate-600 transition-colors cursor-pointer">Getting Started</span>
            </Link>
            <span>·</span>
            <Link href="/manuscript">
              <span className="hover:text-slate-600 transition-colors cursor-pointer">Papers</span>
            </Link>
            <span>·</span>
            <Link href="/ar2-diagnostics">
              <span className="hover:text-slate-600 transition-colors cursor-pointer">Validation</span>
            </Link>
          </div>
          <p className="text-xs text-slate-400 max-w-xl mx-auto" data-testid="validation-banner">
            Pre-print platform. AR(2) computations are mathematically reproducible.
            Biological interpretations are hypotheses under peer review, not established findings.
          </p>
        </div>

      </div>
    </div>
  );
}
