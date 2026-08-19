import { ExternalLink, CheckCircle2, Clock, FileText, Github, Package, Database, BookOpen, User, FlaskConical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";

interface PublicationRow {
  title: string;
  venue: string;
  status: "published" | "accepted" | "under-review" | "preprint" | "in-preparation" | "exploratory";
  doi?: string;
  url?: string;
  note?: string;
}

const PUBLICATIONS: PublicationRow[] = [
  {
    title: "Time-Domain Fibonacci Analogue in Biological AR(2) Processes — A Reply to Boman",
    venue: "The Fibonacci Quarterly",
    status: "published",
    doi: "10.1080/00150517.2026.2716122",
    url: "https://doi.org/10.1080/00150517.2026.2716122",
    note: "Paper G",
  },
  {
    title: "AR(2) Eigenvalue Modulus as a Measure of Temporal Persistence in Gene Expression: Phase-Gating, Cross-Tissue Hierarchy, and Cancer Perturbation",
    venue: "Chronobiology International",
    status: "under-review",
    note: "Paper A — with editor; not yet with peer reviewers",
  },
  {
    title: "AR(2) Eigenvalue Modulus as a Measure of Temporal Persistence in Gene Expression Time Series",
    venue: "Research Square (preprint)",
    status: "preprint",
    doi: "10.21203/rs.3.rs-9283100",
    url: "https://www.researchsquare.com/article/rs-9283100/latest",
  },
  {
    title: "Phase-Gated Tissue Hierarchy and Cross-Species Replication of AR(2) Temporal Persistence",
    venue: "Research Square (preprint)",
    status: "preprint",
    doi: "10.21203/rs.3.rs-9214347",
    url: "https://www.researchsquare.com/article/rs-9214347/latest",
  },
  {
    title: "mRNA Half-Life Independence of AR(2) Eigenvalue Persistence",
    venue: "Research Square (preprint)",
    status: "preprint",
    doi: "10.21203/rs.3.rs-9385465",
    url: "https://sciety.org/articles/activity/10.21203/rs.3.rs-9385465/v1",
    note: "Also indexed on Sciety",
  },
  {
    title: "Spaceflight-Induced Circadian Disruption in the Colon: IFN-γ Suppression, G2M Disinhibition, and PAR bZIP Depletion Reversed by Re-entrainment",
    venue: "npj Microgravity (target)",
    status: "exploratory",
    note: "Paper U — draft; not yet submitted",
  },
  {
    title: "PAR(2): A Unified Autoregressive Framework for Quantifying Temporal Persistence in Circadian Gene Expression — Methods, Validation, and Phase-Gated Extensions",
    venue: "In preparation",
    status: "in-preparation",
    note: "Paper A2 — consolidated methods reference; locked draft",
  },
  {
    title: "Spatial–Temporal Fibonacci Twinning in Colonic Crypt Renewal: Six Complementary Mathematical Arguments from Phase-Gated AR(2) Dynamics",
    venue: "In preparation",
    status: "in-preparation",
    note: "Paper G2",
  },
  {
    title: "Constitutive p53 Regulon Temporal Persistence Under MYC Activation: Autoregressive Evidence Replicated Across Neuroblastoma and Osteosarcoma, with Circadian Context in Human Blood",
    venue: "In preparation",
    status: "in-preparation",
    note: "Paper N",
  },
  {
    title: "APC Loss Collapses the Circadian Clock–Cell Cycle Temporal Hierarchy in Intestinal Organoids: An AR(2) Eigenvalue Study",
    venue: "In preparation",
    status: "in-preparation",
    note: "Paper O",
  },
  {
    title: "The PAR(2) Discovery Engine — A Reproducible Methods Platform for Temporal Persistence Analysis of Gene Expression Time Series",
    venue: "GigaScience (target)",
    status: "in-preparation",
    note: "Paper M — draft v0.9",
  },
  {
    title: "Circadian Clock Inversion in Alzheimer's Disease Glia: AR(2) Eigenvalue Evidence from Cell-Type-Resolved Ribosome-Associated RNA",
    venue: "In preparation",
    status: "in-preparation",
    note: "Paper H — target: Neurobiology of Disease / Journal of Neuroinflammation",
  },
  {
    title: "The Golden Ratio as a Bifurcation Boundary Between Temporal Persistence Regimes in Mammalian Circadian Gene Networks",
    venue: "In preparation",
    status: "in-preparation",
    note: "Paper T",
  },
  {
    title: "PAR(2) Discovery Engine — open computational platform for AR(2) eigenvalue analysis",
    venue: "Zenodo / GitHub",
    status: "preprint",
    url: "https://github.com/mickwh2764/par2discovery",
    note: "Software deposit; ~2,900 views across Zenodo and platform",
  },
  {
    title: "par2-circadian — Python implementation of the PAR(2) AR(2) eigenvalue method",
    venue: "PyPI",
    status: "preprint",
    url: "https://pypi.org/project/par2-circadian/",
    note: "Open-source package; indexed on Libraries.io",
  },
  {
    title: "PAR(2) Reproducibility Archive",
    venue: "GitHub",
    status: "exploratory",
    url: "https://github.com/mickwh2764/par2-reproducibility",
    note: "Verifiable reproduction of all key results",
  },
];

const STATUS_CONFIG = {
  "published": {
    label: "Published",
    color: "bg-emerald-600/20 text-emerald-500 border-emerald-500/40",
    icon: CheckCircle2,
  },
  "accepted": {
    label: "Accepted",
    color: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
    icon: CheckCircle2,
  },
  "under-review": {
    label: "Under Review",
    color: "bg-blue-500/15 text-blue-600 border-blue-500/30",
    icon: Clock,
  },
  "preprint": {
    label: "Preprint / Deposit",
    color: "bg-amber-500/15 text-amber-600 border-amber-500/30",
    icon: FileText,
  },
  "in-preparation": {
    label: "In Preparation",
    color: "bg-violet-500/15 text-violet-600 border-violet-500/30",
    icon: FileText,
  },
  "exploratory": {
    label: "Draft / Exploratory",
    color: "bg-slate-500/15 text-slate-500 border-slate-500/30",
    icon: FlaskConical,
  },
};

const JSONLD = {
  "@context": "https://schema.org",
  "@type": "Person",
  "name": "Michael Whiteside",
  "url": "https://par2discovery.com/profile",
  "jobTitle": "Independent computational systems researcher",
  "description": "Developer of the PAR(2) eigenvalue framework — AR(2) temporal persistence analysis in biological time series. Applications in circadian biology, tissue renewal, and cancer-related dynamics.",
  "sameAs": [
    "https://orcid.org/0009-0000-0643-5791",
    "https://scholar.google.com/citations?user=hr5xiiQAAAAJ&hl=en",
    "https://github.com/mickwh2764/par2discovery",
    "https://github.com/mickwh2764/par2-reproducibility",
    "https://pypi.org/project/par2-circadian/",
    "https://x.com/Michael_PAR2",
    "https://www.researchsquare.com/article/rs-9283100/latest",
    "https://zenodo.org/search?q=michael%20whiteside%20par2"
  ],
  "knowsAbout": [
    "Circadian biology",
    "Autoregressive time series modelling",
    "Gene expression analysis",
    "Temporal persistence in biological systems",
    "Computational systems biology"
  ]
};

function StatusBadge({ status }: { status: PublicationRow["status"] }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color} whitespace-nowrap`}>
      <Icon size={10} />
      {cfg.label}
    </span>
  );
}

export default function Profile() {
  // Inject JSON-LD on mount
  useEffect(() => {
    const existing = document.getElementById("profile-jsonld");
    if (existing) existing.remove();
    const script = document.createElement("script");
    script.id = "profile-jsonld";
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(JSONLD);
    document.head.appendChild(script);
    return () => {
      const el = document.getElementById("profile-jsonld");
      if (el) el.remove();
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-12">

        {/* ── Identity ─────────────────────────────────────────────────── */}
        <header className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
              <User className="w-7 h-7 text-violet-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground tracking-tight">Michael Whiteside</h1>
              <p className="text-slate-500 mt-1">Independent computational systems researcher</p>
              <p className="text-slate-400 text-sm mt-0.5 font-mono">
                ORCID:{" "}
                <a
                  href="https://orcid.org/0009-0000-0643-5791"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-500 hover:text-emerald-400 transition-colors"
                >
                  0009-0000-0643-5791
                </a>
              </p>
            </div>
          </div>

          <p className="text-slate-600 leading-relaxed text-base border-l-2 border-violet-500/30 pl-4">
            I develop open, reproducible methods for analysing temporal persistence in biological time
            series, with applications in circadian biology, tissue renewal, and cancer-related dynamics.
            The core method — AR(2) eigenvalue modulus analysis — is implemented in the{" "}
            <Link href="/genome-wide">
              <span className="text-violet-500 hover:text-violet-400 cursor-pointer transition-colors">
                PAR(2) Discovery Engine
              </span>
            </Link>{" "}
            and the{" "}
            <a
              href="https://pypi.org/project/par2-circadian/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-500 hover:text-violet-400 transition-colors"
            >
              par2-circadian
            </a>{" "}
            Python package.
          </p>
        </header>

        {/* ── Links ────────────────────────────────────────────────────── */}
        <section className="flex flex-wrap gap-3">
          {[
            { label: "ORCID", href: "https://orcid.org/0009-0000-0643-5791", icon: ExternalLink, color: "text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/5" },
            { label: "Google Scholar", href: "https://scholar.google.com/citations?user=hr5xiiQAAAAJ&hl=en", icon: BookOpen, color: "text-blue-500 border-blue-500/30 hover:bg-blue-500/5" },
            { label: "Research Square", href: "https://www.researchsquare.com/article/rs-9283100/latest", icon: FileText, color: "text-orange-500 border-orange-500/30 hover:bg-orange-500/5" },
            { label: "PyPI", href: "https://pypi.org/project/par2-circadian/", icon: Package, color: "text-yellow-600 border-yellow-500/30 hover:bg-yellow-500/5" },
            { label: "par2discovery", href: "https://github.com/mickwh2764/par2discovery", icon: Github, color: "text-slate-600 border-slate-400/30 hover:bg-slate-500/5" },
            { label: "par2-reproducibility", href: "https://github.com/mickwh2764/par2-reproducibility", icon: Github, color: "text-slate-600 border-slate-400/30 hover:bg-slate-500/5" },
            { label: "@Michael_PAR2", href: "https://x.com/Michael_PAR2", icon: ExternalLink, color: "text-slate-500 border-slate-400/30 hover:bg-slate-500/5" },
          ].map(({ label, href, icon: Icon, color }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${color}`}
            >
              <Icon size={13} />
              {label}
            </a>
          ))}
        </section>

        {/* ── Publication status table ──────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <FileText size={18} className="text-violet-400" />
            Publications &amp; Outputs
          </h2>

          {/* Legend */}
          <div className="flex flex-wrap gap-2 pb-1">
            {(Object.entries(STATUS_CONFIG) as [PublicationRow["status"], typeof STATUS_CONFIG[keyof typeof STATUS_CONFIG]][]).map(([key, cfg]) => {
              const Icon = cfg.icon;
              return (
                <span key={key} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
                  <Icon size={10} />{cfg.label}
                </span>
              );
            })}
          </div>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
            {PUBLICATIONS.map((pub, i) => (
              <div key={i} className="flex items-start gap-4 px-5 py-4 bg-white hover:bg-slate-50/60 transition-colors">
                <div className="pt-0.5 shrink-0">
                  <StatusBadge status={pub.status} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground leading-snug">
                    {pub.url ? (
                      <a
                        href={pub.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-violet-600 transition-colors"
                      >
                        {pub.title}
                        <ExternalLink size={11} className="inline ml-1 opacity-50" />
                      </a>
                    ) : pub.title}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    <span className="font-medium">{pub.venue}</span>
                    {pub.doi && <span className="ml-2 text-slate-400 font-mono">DOI: {pub.doi}</span>}
                  </p>
                  {pub.note && (
                    <p className="text-xs text-slate-400 mt-0.5 italic">{pub.note}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-slate-500">
            Reference-manager format:{" "}
            <a
              href="/publications.bib"
              className="text-violet-500 hover:text-violet-400 transition-colors underline underline-offset-2"
            >
              publications.bib
            </a>{" "}
            — one entry per work, every DOI verified against Crossref and DataCite.
          </p>
        </section>

        {/* ── Biography ────────────────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <User size={18} className="text-violet-400" />
            Background
          </h2>
          <div className="prose prose-slate prose-sm max-w-none space-y-3 text-slate-600 leading-relaxed">
            <p>
              I began independent scientific research in 2025. My working background spans a military
              career — including frontline leadership, communications, and operations management —
              alongside a public-service role in waste operations covering frontline supervision,
              logistics, compliance, and team leadership across a wide area. My work uses public
              biological datasets from NCBI GEO, open computational methods, and transparent
              AI-assisted workflows to study temporal organisation in biology.
            </p>
            <p>
              The PAR(2) method has been validated across five species (mouse, human, baboon,{" "}
              <em>Arabidopsis</em>, yeast), twelve mouse tissues, and more than twenty independent
              datasets. Cross-species replication in baboon (GSE98965, 60 tissues) independently
              confirms the central-peripheral eigenvalue gradient — SCN |λ|&thinsp;=&thinsp;0.4708
              virtually identical to mouse hypothalamus |λ|&thinsp;=&thinsp;0.4690 across
              approximately 30 million years of mammalian evolution.
            </p>
            <p>
              Based in Scotland, UK.
            </p>
          </div>
        </section>

        {/* ── Reproducibility & AI statement ───────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Database size={18} className="text-emerald-400" />
            Reproducibility &amp; AI Use
          </h2>
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-5 space-y-3 text-sm text-slate-600 leading-relaxed">
            <p>
              <strong className="text-foreground">Data.</strong>{" "}
              All analyses use public datasets deposited at NCBI GEO. No proprietary or unpublished
              data are used. Dataset accession numbers are cited explicitly in every output.
            </p>
            <p>
              <strong className="text-foreground">Code.</strong>{" "}
              The AR(2) fitting pipeline is implemented in the open{" "}
              <a
                href="https://github.com/mickwh2764/par2discovery"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-600 hover:text-emerald-500 transition-colors"
              >
                par2discovery
              </a>{" "}
              repository and the{" "}
              <a
                href="https://pypi.org/project/par2-circadian/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-600 hover:text-emerald-500 transition-colors"
              >
                par2-circadian
              </a>{" "}
              Python package. Results on this platform are computed live from public data — the
              platform is the analysis, not a presentation of pre-computed results.
            </p>
            <p>
              <strong className="text-foreground">AI assistance.</strong>{" "}
              AI tools (primarily large language models) are used in code development, manuscript
              drafting, and literature review. All AI-assisted contributions are reviewed, corrected
              where necessary, and the author takes full responsibility for the scientific content.
              AI use is documented explicitly in manuscripts where required by journal policy.
            </p>
            <p>
              <strong className="text-foreground">Verification.</strong>{" "}
              The{" "}
              <a
                href="https://github.com/mickwh2764/par2-reproducibility"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-600 hover:text-emerald-500 transition-colors"
              >
                par2-reproducibility
              </a>{" "}
              repository contains verifiable reproductions of all key numerical results. Readers
              can independently confirm any finding reported in the manuscripts.
            </p>
          </div>
        </section>

        {/* ── Research programme ───────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <FlaskConical size={18} className="text-blue-400" />
            Research Programme
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { label: "Core method", desc: "AR(2) eigenvalue modulus |λ| as a period-agnostic measure of temporal persistence in gene expression time series.", href: "/dashboard" },
              { label: "Circadian hierarchy", desc: "Clock genes sit at higher |λ| than downstream targets across 12 tissues, 5 species, and 22+ datasets.", href: "/cross-context-validation" },
              { label: "Cancer disruption", desc: "Oncogenic perturbation (APC-KO, MYC-ON) collapses the eigenvalue hierarchy in a tissue-specific pattern.", href: "/disease-screen" },
              { label: "Fibonacci connection", desc: "Biological AR(2) processes cluster near the Fibonacci boundary |λ| = 1/φ — accepted in The Fibonacci Quarterly.", href: "/clock-target-phi" },
              { label: "Cross-species replication", desc: "60-tissue baboon atlas independently replicates the SCN-to-periphery eigenvalue gradient.", href: "/light-entrainment" },
              { label: "Open platform", desc: "Upload your own data and compute AR(2) eigenvalue profiles in real time — no account required.", href: "/discovery-engine" },
            ].map(({ label, desc, href }) => (
              <Link key={label} href={href}>
                <div className="border border-slate-200 rounded-lg p-4 hover:border-violet-300 hover:bg-violet-500/3 transition-colors cursor-pointer h-full">
                  <p className="text-sm font-semibold text-foreground">{label}</p>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <footer className="text-center text-xs text-slate-400 pt-4 border-t border-slate-100 space-y-1">
          <p>
            PAR(2) Discovery Engine — open science platform for circadian time-series analysis.
          </p>
          <p>
            For correspondence: via{" "}
            <a href="https://x.com/Michael_PAR2" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-slate-500 transition-colors">
              @Michael_PAR2
            </a>{" "}
            or through a{" "}
            <a href="https://github.com/mickwh2764/par2discovery/issues" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-slate-500 transition-colors">
              GitHub issue
            </a>.
          </p>
        </footer>

      </div>
    </div>
  );
}
