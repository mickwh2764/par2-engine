import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dna, Activity, Atom, Globe, Layers, Flame, MapPin, Network,
  Target, AlertTriangle, FlaskConical, GitCompare,
  Shield, Moon, Beaker, Microscope, Bug,
  BookOpen, Info, Lock, ShieldCheck, Sparkles, ChevronDown,
  Menu, Home, Upload, Search, Award, CircleDot, BarChart3, FolderOpen, Zap,
  FileText, TestTube, Brain, Clock, TrendingDown, Map, Sun, Eye,
  Download, Database, RefreshCw, History, User,
} from "lucide-react";
import { GSE11923 } from "@shared/canonical-values";

interface PaperInfo {
  label: string;
  color: string;
  bg: string;
  border: string;
  downloadUrl: string;
  direct: boolean;
}

const PAPER_ROUTES: { routes: string[]; info: PaperInfo }[] = [
  {
    routes: [
      '/dashboard', '/category-tests', '/genome-wide', '/gene-explorer',
      '/cross-context-validation', '/literature-validation', '/model-zoo',
      '/framework-benchmarks', '/method-validation', '/robustness-suite',
      '/validation-suite', '/validation-summary', '/core-evidence',
      '/manuscript-validation', '/ar2-diagnostics', '/supplementary-analyses',
      '/geo-replication', '/gse11923-checkpoint', '/cross-metric-independence',
      '/proteome-validation', '/root-space', '/persistence-landscape',
      '/convergence-map', '/temporal-correlation', '/oscillator-taxonomy',
      '/gene-protein-map', '/regulatory-discovery',
      '/cross-tissue-three-layer', '/species-comparison', '/figure2',
      '/eigenvalue-independence', '/gap-classifier', '/high-res-validation',
      '/rolling-window', '/stationarity-validation',
    ],
    info: {
      label: 'Paper A',
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/30',
      downloadUrl: '/api/download/paper-a-package',
      direct: true,
    },
  },
  {
    routes: ['/methods-benchmark'],
    info: {
      label: 'Methods',
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      downloadUrl: '/api/download/methods-paper-pdf',
      direct: true,
    },
  },
  {
    routes: [
      '/phase-gating', '/phase-portrait', '/gse157357-analysis', '/tcga-validation',
      '/phase-sensitivity', '/chronotherapy-predictor', '/cancer-browser',
      '/cancer-state-swap', '/glial-analysis', '/gbm-zman-seq',
      '/nfkb-universality', '/cofe-context',
    ],
    info: {
      label: 'Paper E',
      color: 'text-rose-400',
      bg: 'bg-rose-500/10',
      border: 'border-rose-500/30',
      downloadUrl: '/api/download/paper-e-package',
      direct: true,
    },
  },
  {
    routes: [
      '/p53-regulon', '/p53-oscillator', '/feedback-loop-threshold', '/p53-tissue-landscape',
      '/myc-on-discrepancy', '/u2os-myc-ar2',
    ],
    info: {
      label: 'Paper N',
      color: 'text-violet-400',
      bg: 'bg-violet-500/10',
      border: 'border-violet-500/30',
      downloadUrl: '/api/download/paper-n-package',
      direct: true,
    },
  },
  {
    routes: [
      '/halflife-replication', '/state-space-comparison', '/decomposition-stability',
      '/drug-durability', '/before-after',
    ],
    info: {
      label: 'Paper F',
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
      downloadUrl: '/api/download/paper-f-package',
      direct: true,
    },
  },
  {
    routes: [
      '/boman-par2-mapping', '/phi-inevitability-test', '/phi-timescale-buffering',
      '/boman-simulation', '/boman-ode', '/clock-target-phi',
      '/phi-enrichment-replication', '/fibonacci-twinning-extended',
      '/cross-species-phi', '/crypt-villus', '/abm-minimal', '/crypt-buckling',
      '/turing-deep-dive',
    ],
    info: {
      label: 'Paper G',
      color: 'text-violet-400',
      bg: 'bg-violet-500/10',
      border: 'border-violet-500/30',
      downloadUrl: '/manuscript',
      direct: false,
    },
  },
  {
    routes: [
      '/light-entrainment', '/retinal-analysis', '/wearable-analysis',
    ],
    info: {
      label: 'Paper Q',
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
      border: 'border-cyan-500/30',
      downloadUrl: '/api/download/paper-q-package',
      direct: true,
    },
  },
  {
    routes: [
      '/human-disruption', '/cell-type-persistence', '/disease-screen',
      '/health-score', '/volatile-genes', '/gene-set-tester',
      '/yeast-validation', '/bacterial-persistence', '/wearable-analysis',
    ],
    info: {
      label: 'Paper H',
      color: 'text-orange-400',
      bg: 'bg-orange-500/10',
      border: 'border-orange-500/30',
      downloadUrl: '/api/download/paper-h-package',
      direct: true,
    },
  },
];

function getPaperForRoute(location: string): PaperInfo | null {
  const entry = PAPER_ROUTES.find(p => p.routes.includes(location));
  return entry ? entry.info : null;
}

const NAV_GROUPS = [
  {
    label: "Evidence",
    color: "from-blue-600 to-indigo-600",
    items: [
      { label: "The Claim", href: "#claim", icon: Target, color: "text-slate-400", isSection: true, desc: "" },
      { href: "/dashboard", icon: BarChart3, color: "text-blue-400", label: "Dashboard", desc: "PAR(2) claim across 22 datasets" },
      { href: "/genome-wide", icon: Globe, color: "text-blue-400", label: "Genome-Wide Scan", desc: "Every gene's persistence score" },
      { label: "Does It Replicate?", href: "#replication", icon: Target, color: "text-slate-400", isSection: true, desc: "" },
      { href: "/cross-context-validation", icon: Layers, color: "text-rose-400", label: "Cross-Context Validation", desc: "4 species · 12 tissues · 36 series" },
      { href: "/literature-validation", icon: BookOpen, color: "text-emerald-400", label: "Literature Validation", desc: `${GSE11923.literatureConcordance.genesTestedN} known genes — ${GSE11923.literatureConcordance.percentRecovery}% match` },
      { href: "/model-zoo", icon: Beaker, color: "text-orange-400", label: "Model Zoo", desc: "6 ODE models + Floquet analysis" },
      { href: "/framework-benchmarks", icon: Award, color: "text-amber-400", label: "Framework Benchmarks", desc: "vs JTK_CYCLE, cosinor, RAIN" },
      { label: "Is It Robust?", href: "#robustness", icon: Target, color: "text-slate-400", isSection: true, desc: "" },
      { href: "/ar2-diagnostics", icon: ShieldCheck, color: "text-emerald-400", label: "AR(2) Fit Diagnostics", desc: "Category-wise quality audit (Table S8)" },
      { href: "/supplementary-analyses", icon: ShieldCheck, color: "text-lime-400", label: "AR(1) Benchmark & Controls", desc: "AR(1) vs AR(2) + coupling controls (Table S9)" },
      { href: "/core-evidence", icon: ShieldCheck, color: "text-sky-400", label: "Core Evidence", desc: "4-panel skeptic primer" },
      { href: "/persistence-landscape", icon: Layers, color: "text-violet-400", label: "Persistence Landscape", desc: "AR(2) coefficient space — gene clusters near Fibonacci boundary" },
      { label: "Try It Yourself", href: "#try", icon: Target, color: "text-slate-400", isSection: true, desc: "" },
      { href: "/discovery-engine", icon: Activity, color: "text-purple-400", label: "Discovery Engine", desc: "Upload & analyze your own data" },
    ],
  },
  {
    label: "Papers E\u2013U",
    color: "from-violet-600 to-purple-600",
    items: [
      { label: "E: Phase-Gating", href: "#paper-e", icon: Target, color: "text-slate-400", isSection: true, desc: "" },
      { href: "/phase-gating", icon: Sparkles, color: "text-fuchsia-400", label: "Phase-Gating Analysis", desc: "28,138 clock-target pairs" },
      { href: "/phase-portrait", icon: CircleDot, color: "text-violet-400", label: "Phase Portrait Explorer", desc: "24h cycle across tissues" },
      { href: "/gse157357-analysis", icon: TestTube, color: "text-purple-400", label: "GSE157357 Organoid Explorer", desc: "4-condition pairwise · double-mutant paradox" },
      { href: "/tcga-validation", icon: Dna, color: "text-red-400", label: "TCGA Colorectal Validation", desc: "10/15 concordance · ApcKO-like mechanism" },
      { label: "F: Half-Life Independence", href: "#paper-f", icon: Target, color: "text-slate-400", isSection: true, desc: "" },
      { href: "/halflife-replication", icon: Microscope, color: "text-cyan-400", label: "Half-Life Replication", desc: "ρ = 0.012 across 23k genes" },
      { label: "G: Time-Domain Fibonacci Analogue — reply to Boman (Fibonacci Quarterly, 2026)", href: "#paper-g", icon: Target, color: "text-slate-400", isSection: true, desc: "" },
      { href: "/boman-par2-mapping", icon: Target, color: "text-amber-400", label: "Boman Rules → PAR(2) Parameters", desc: "Algebraic bridge q²=1−q · 5-rule mapping · divergence angle ↔ ω" },
      { href: "/phi-inevitability-test", icon: FlaskConical, color: "text-rose-400", label: "Candidate 1: Is φ-Proximity Inevitable?", desc: "Monte Carlo null test — 10k random AR(2) processes vs biological enrichment" },
      { href: "/phi-timescale-buffering", icon: FlaskConical, color: "text-violet-400", label: "Candidate 3: Is φ a Timescale Buffer?", desc: "WT vs BmalKO vs ApcKO vs DblKO — does removing a timescale reduce φ-proximity?" },
      { href: "/boman-simulation", icon: Beaker, color: "text-orange-400", label: "Boman Simulation", desc: "3-compartment crypt model with AR(2) fitting" },
      { href: "/boman-ode", icon: Beaker, color: "text-emerald-400", label: "ODE \u2192 AR(2) Validation", desc: "Boman crypt ODE Jacobian at Fibonacci fixed point" },
      { href: "/clock-target-phi", icon: Atom, color: "text-yellow-400", label: "Clock-Target 1/\u03c6 Enrichment", desc: "Core clock |\u03bb| near Boman\u2019s q · p=0.041 · 12 tissues" },
      { href: "/phi-enrichment-replication", icon: GitCompare, color: "text-yellow-400", label: "1/\u03c6 Enrichment Replication", desc: "4-dataset mammalian · plant extension · Arabidopsis" },
      { href: "/fibonacci-twinning-extended", icon: Sparkles, color: "text-amber-400", label: "Fibonacci Twinning \u2014 5 Arguments", desc: "Algebraic identity · Floquet monodromy · 252 gene-tissue combos" },
      { href: "/cross-species-phi", icon: Globe, color: "text-teal-400", label: "Cross-Species \u03c6 Prediction", desc: "Eigenvalue \u03c6 prediction across species" },
      { href: "/crypt-villus", icon: Layers, color: "text-orange-400", label: "Crypt-Villus Analysis", desc: "Gut spatial dynamics" },
      { href: "/turing-deep-dive", icon: Microscope, color: "text-amber-400", label: "Turing Pattern Analysis", desc: "AR(2) |λ| mapped to reaction-diffusion stability — φ as bifurcation boundary" },
      { label: "Q: Central-Peripheral Clock Hierarchy", href: "#paper-q", icon: Target, color: "text-slate-400", isSection: true, desc: "" },
      { href: "/light-entrainment", icon: Sun, color: "text-yellow-400", label: "Light Entrainment Hierarchy", desc: "12-tissue gradient · SCN 0.469 \u2192 Lung 0.797 · 3.33\u00d7 lag ratio" },
      { href: "/retinal-analysis", icon: Eye, color: "text-cyan-400", label: "Retinal Circadian Analysis", desc: "GSE98965 baboon retina · phototransduction · OPN4 post-hoc" },
      { label: "U: Spaceflight Colon (draft)", href: "#paper-u", icon: Target, color: "text-slate-400", isSection: true, desc: "" },
      { href: "/paper-u", icon: FileText, color: "text-sky-400", label: "Paper U — targeting npj Microgravity", desc: "IFN-\u03b3 suppression · G2M disinhibition · PAR bZIP depletion \u00b7 reversed by re-entrainment" },
      { label: "G2: Fibonacci Twinning (submitted)", href: "#paper-g2", icon: Target, color: "text-slate-400", isSection: true, desc: "" },
      { href: "/fibonacci-twinning-extended", icon: Sparkles, color: "text-purple-400", label: "Fibonacci Twinning — 6 Arguments", desc: "Algebraic identity · Hurwitz · Floquet · tissue-specificity · p-number band" },
      { href: "/api/view/paper-pdf?id=paper-g2", icon: Download, color: "text-purple-300", label: "Download Paper G2 PDF", desc: "paper_g2_submission.pdf — August 2026 submission", isExternalDownload: true },
    ],
  },
  {
    label: "Tools",
    color: "from-teal-600 to-emerald-600",
    items: [
      { label: "Gene Analysis", href: "#gene-analysis", icon: Target, color: "text-slate-400", isSection: true, desc: "" },
      { href: "/gene-eigenvalue-atlas", icon: Database, color: "text-violet-400", label: "Gene Eigenvalue Atlas", desc: "|\u03bb| · phase · genome %ile · disease \u0394\u03bb \u2014 every gene \u00d7 tissue" },
      { href: "/gene-explorer", icon: Dna, color: "text-pink-400", label: "Gene Explorer", desc: "Search any gene\u2019s dynamics in depth" },
      { label: "Geometry & Structure", href: "#geometry", icon: Target, color: "text-slate-400", isSection: true, desc: "" },
      { href: "/root-space", icon: Atom, color: "text-violet-400", label: "Root-Space Geometry", desc: "Damping-period decomposition" },
      { href: "/oscillator-taxonomy", icon: Zap, color: "text-yellow-400", label: "Oscillator Taxonomy", desc: "Biological oscillator classification" },
      { href: "/temporal-correlation", icon: Clock, color: "text-cyan-400", label: "Temporal Correlation Length", desc: "\u03c4\u1d04: clock 4.7h vs target 2.4h · 13/13 tissues" },
      { href: "/par2-orrery.html", icon: Globe, color: "text-amber-400", label: "Coupling Orrery", desc: "Live orbital re-entrainment · \u03c4\u1d04 per tissue · jet-lag simulator" },
      { label: "Coupling & Independence", href: "#coupling", icon: Target, color: "text-slate-400", isSection: true, desc: "" },
      { href: "/genome-wide-coupling", icon: Dna, color: "text-cyan-400", label: "Genome-Wide Coupling", desc: "BMAL1 coupling scan (~21k genes)" },
      { href: "/cross-metric-independence", icon: GitCompare, color: "text-cyan-400", label: "Cross-Metric Independence", desc: "|\u03bb| vs centrality, chromatin, etc." },
      { href: "/rule-validation", icon: FlaskConical, color: "text-amber-400", label: "Rule 3 & 4 Validation", desc: "Spatial zone vs |\u03bb|, division count vs |\u03bb|" },
      { href: "/convergence-map", icon: Network, color: "text-sky-400", label: "Convergence Map", desc: "Cross-disciplinary research links" },
      { label: "Applications", href: "#applications", icon: Target, color: "text-slate-400", isSection: true, desc: "" },
      { href: "/chronotherapy-predictor", icon: Clock, color: "text-orange-400", label: "Chronotherapy Predictor", desc: "AR(2)-derived optimal dosing windows" },
      { href: "/disease-screen", icon: AlertTriangle, color: "text-yellow-400", label: "Disease Screen", desc: "Eigenvalue shifts across disease states" },
      { href: "/gene-protein-map", icon: MapPin, color: "text-emerald-400", label: "Gene-Protein Map", desc: "mRNA vs protein persistence comparison" },
    ],
  },
  {
    label: "Applications",
    color: "",
    items: [
      { label: "Disease & Cancer", href: "#disease", icon: Target, color: "text-slate-400", isSection: true, desc: "" },
      { href: "/glial-analysis", icon: Brain, color: "text-blue-400", label: "Glial Circadian Analysis", desc: "GSE261698 · Astrocyte vs Microglia · Alzheimer\u2019s" },
      { href: "/mnd-als", icon: Zap, color: "text-red-400", label: "MND/ALS Motor Neuron Analysis", desc: "ALS-RBPs mean |\u03bb|=0.812 · pre-loaded vulnerability" },
      { href: "/gbm-zman-seq", icon: FlaskConical, color: "text-orange-400", label: "GBM Immune Clock \u2014 Zman-seq", desc: "GSE232040 · NK clock suppression · non-circadian true-negative" },
      { href: "/p53-regulon", icon: Shield, color: "text-violet-400", label: "p53 Regulon Persistence", desc: "Apoptotic vs survival arm eigenvalue profiling" },
      { href: "/p53-oscillator", icon: FlaskConical, color: "text-fuchsia-400", label: "p53\u2013MDM2 Oscillator", desc: "Feedback loop \u2192 complex roots · GOF \u2192 real roots" },
      { href: "/feedback-loop-threshold", icon: TrendingDown, color: "text-red-400", label: "Feedback Loop Threshold", desc: "MDM2 amplification gradient \u2014 where the oscillator breaks" },
      { href: "/nfkb-universality", icon: Zap, color: "text-yellow-400", label: "NF-\u03baB Universality Test", desc: "Does AR(2) detect non-circadian oscillators? LPS/Amit2009" },
      { href: "/cancer-state-swap", icon: GitCompare, color: "text-purple-400", label: "Cancer State-Swap", desc: "Identity vs Proliferation markers" },
      { href: "/myc-on-discrepancy", icon: GitCompare, color: "text-teal-400", label: "MYC-ON Discrepancy Resolved", desc: "Why MYC-ON shows higher |\u03bb| \u2014 tug-of-war equilibrium" },
      { href: "/u2os-myc-ar2", icon: FlaskConical, color: "text-violet-400", label: "U2OS MYC-ER AR(2)", desc: "60k genes · 4 robustness layers · p=0.021" },
      { href: "/p53-tissue-landscape", icon: Map, color: "text-emerald-400", label: "p53 Tissue Landscape", desc: "p53 target |\u03bb| across 12 tissues \u2014 healthy baseline" },
      { label: "Specialized Tests", href: "#specialized", icon: Target, color: "text-slate-400", isSection: true, desc: "" },
      { href: "/evolutionary-gene-age", icon: History, color: "text-amber-400", label: "Evolutionary Gene Age", desc: "|\u03bb| vs gene evolutionary age (Mya) \u2014 older genes show higher persistence" },
      { href: "/mixture-simulation", icon: FlaskConical, color: "text-violet-400", label: "Composition Confound Test", desc: "Can cell-type mixing alone produce AR(2) signatures?" },
      { href: "/volatile-genes", icon: Flame, color: "text-amber-400", label: "Most Volatile Genes", desc: "Cross-dataset variance ranking" },
      { href: "/gene-set-tester", icon: FlaskConical, color: "text-fuchsia-400", label: "Gene Set Tester", desc: "Permutation test for custom gene lists" },
      { href: "/regulatory-discovery", icon: Zap, color: "text-yellow-400", label: "Regulatory Discovery", desc: "Pathway-agnostic oscillator scan" },
      { href: "/yeast-validation", icon: Bug, color: "text-lime-400", label: "Yeast Validation", desc: "Metabolic cycle validation" },
      { href: "/human-disruption", icon: Moon, color: "text-indigo-400", label: "Human Disruption", desc: "Sleep & circadian disruption" },
      { href: "/phase-sensitivity", icon: Activity, color: "text-rose-400", label: "Phase Estimation Sensitivity", desc: "Phase detection robustness analysis" },
      { href: "/state-space-comparison", icon: GitCompare, color: "text-cyan-400", label: "State-Space Comparison", desc: "VAR vs AR model comparison" },
      { href: "/before-after", icon: GitCompare, color: "text-cyan-400", label: "Before/After Comparison", desc: "Paired condition comparisons" },
      { href: "/proteome-validation", icon: Microscope, color: "text-cyan-400", label: "Proteome Validation", desc: "Protein-level dynamics" },
      { href: "/reports", icon: FolderOpen, color: "text-cyan-400", label: "Saved Reports", desc: "Load & analyze saved results" },
      { href: "/geo-replication", icon: Database, color: "text-sky-400", label: "GEO Independent Replication", desc: "Public GEO datasets \u2014 independent validation studies" },
      { href: "/gse11923-checkpoint", icon: RefreshCw, color: "text-teal-400", label: "GSE11923 Checkpoint", desc: "48h hourly liver series · stability checkpoint analysis" },
    ],
  },
  {
    label: "Info",
    color: "",
    items: [
      { href: "/benchmark", icon: GitCompare, color: "text-emerald-400", label: "Benchmark vs JTK_Cycle", desc: "AR(2) vs JTK_Cycle vs Cosinor — mouse liver · root-type analysis" },
      { href: "/assessment-package", icon: Download, color: "text-primary", label: "AI Assessment Package", desc: "Download everything in one ZIP to upload to an AI model" },
      { href: "/book", icon: BookOpen, color: "text-amber-400", label: "Read the Book", desc: "Persistence \u2014 full research monograph · PDF & Word download" },
      { href: "/manuscript", icon: FileText, color: "text-indigo-400", label: "Manuscripts", desc: "Downloadable paper packages (A, E, F, G, G2, N, Q, U)" },
      { href: "/paper-a-download", icon: Download, color: "text-cyan-400", label: "Download Paper A", desc: "v2.5 \u2014 CI submission package with July 2026 revisions" },
      { href: "/figure-gallery", icon: FolderOpen, color: "text-violet-400", label: "Figures Gallery", desc: "All paper figures \u2014 view & download" },
      { href: "/getting-started", icon: BookOpen, color: "text-emerald-400", label: "Getting Started", desc: "How to use this platform" },
      { href: "/about", icon: Info, color: "text-slate-400", label: "About", desc: "Background and methodology" },
      { href: "/profile", icon: User, color: "text-violet-400", label: "Researcher Profile", desc: "Michael Whiteside — publications, bio, reproducibility statement" },
    ],
  },
];

function NavDropdown({ group }: { group: typeof NAV_GROUPS[0] }) {
  const [location] = useLocation();
  const isActive = group.items.some(item => location === item.href);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant={group.color ? "default" : "outline"}
          className={`h-8 gap-1.5 text-xs ${group.color ? `bg-gradient-to-r ${group.color} hover:opacity-90 text-white font-medium shadow-sm` : ""} ${isActive ? "ring-2 ring-primary/50" : ""}`}
          data-testid={`nav-${group.label.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
        >
          {group.label}
          <ChevronDown size={11} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 max-h-[70vh] overflow-y-auto">
        <DropdownMenuLabel className="text-xs text-primary">{group.label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {group.items.map((item, itemIdx) => {
          const itemKey = `${item.href}-${itemIdx}`;
          if ((item as any).isSection) {
            return (
              <div key={itemKey} className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                {item.label}
              </div>
            );
          }
          if ((item as any).locked) {
            return (
              <DropdownMenuItem
                key={itemKey}
                disabled
                className="gap-3 py-2 opacity-40 cursor-not-allowed select-none"
                data-testid={`nav-link-${item.href.slice(1)}`}
              >
                <item.icon size={15} className="shrink-0 text-muted-foreground" />
                <div className="flex-1">
                  <div className="font-medium text-sm text-muted-foreground">{item.label}</div>
                  <div className="text-[11px] text-muted-foreground">{item.desc}</div>
                </div>
                <Lock size={11} className="shrink-0 text-muted-foreground" />
              </DropdownMenuItem>
            );
          }
          if ((item as any).isExternalDownload) {
            return (
              <a key={itemKey} href={item.href} target="_blank" rel="noopener noreferrer">
                <DropdownMenuItem className="gap-3 cursor-pointer py-2" data-testid={`nav-link-${item.href.replace(/\//g, '-').replace(/^-/, '')}`}>
                  <item.icon size={15} className={`shrink-0 ${item.color}`} />
                  <div>
                    <div className="font-medium text-sm">{item.label}</div>
                    <div className="text-[11px] text-muted-foreground">{item.desc}</div>
                  </div>
                </DropdownMenuItem>
              </a>
            );
          }
          return (
            <Link key={itemKey} href={item.href}>
              <DropdownMenuItem
                className={`gap-3 cursor-pointer py-2 ${location === item.href ? "bg-primary/10" : ""}`}
                data-testid={`nav-link-${item.href.slice(1)}`}
              >
                <item.icon size={15} className={`shrink-0 ${item.color}`} />
                <div>
                  <div className="font-medium text-sm">{item.label}</div>
                  <div className="text-[11px] text-muted-foreground">{item.desc}</div>
                </div>
              </DropdownMenuItem>
            </Link>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MobileSidebarContent({ onClose }: { onClose: () => void }) {
  const [location] = useLocation();

  return (
    <ScrollArea className="h-full">
      <div className="py-4 space-y-6">
        <Link href="/" onClick={onClose}>
          <div className={`flex items-center gap-3 px-4 py-2 rounded-lg cursor-pointer transition-colors ${location === "/" ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}>
            <Home size={16} />
            <span className="font-medium text-sm">Home</span>
          </div>
        </Link>
        {NAV_GROUPS.map(group => (
          <div key={group.label}>
            <div className="px-4 mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</span>
            </div>
            <div className="space-y-0.5">
              {group.items.map((item, itemIdx) => {
                const itemKey = `${item.href}-${itemIdx}`;
                if ((item as any).isSection) {
                  return (
                    <div key={itemKey} className="px-4 pt-2 pb-1">
                      <span className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wide">{item.label}</span>
                    </div>
                  );
                }
                if ((item as any).locked) {
                  return (
                    <div key={itemKey} className="flex items-center gap-3 px-4 py-2 rounded-lg opacity-35 cursor-not-allowed select-none">
                      <item.icon size={15} className="shrink-0 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">{item.label}</span>
                      <Lock size={11} className="ml-auto shrink-0 text-muted-foreground" />
                    </div>
                  );
                }
                if ((item as any).isExternalDownload) {
                  return (
                    <a key={itemKey} href={item.href} target="_blank" rel="noopener noreferrer" onClick={onClose}>
                      <div className="flex items-center gap-3 px-4 py-2 rounded-lg cursor-pointer transition-colors hover:bg-muted">
                        <item.icon size={15} className={`shrink-0 ${item.color}`} />
                        <span className="text-sm">{item.label}</span>
                      </div>
                    </a>
                  );
                }
                if (item.href.endsWith('.html') || (item as any).isStaticPage) {
                  return (
                    <a key={itemKey} href={item.href} onClick={onClose}>
                      <div className="flex items-center gap-3 px-4 py-2 rounded-lg cursor-pointer transition-colors hover:bg-muted">
                        <item.icon size={15} className={`shrink-0 ${item.color}`} />
                        <span className="text-sm">{item.label}</span>
                        {item.desc && <span className="ml-auto text-[10px] text-muted-foreground hidden xl:block max-w-[140px] truncate">{item.desc}</span>}
                      </div>
                    </a>
                  );
                }
                return (
                  <Link key={itemKey} href={item.href} onClick={onClose}>
                    <div className={`flex items-center gap-3 px-4 py-2 rounded-lg cursor-pointer transition-colors ${location === item.href ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}>
                      <item.icon size={15} className={`shrink-0 ${item.color}`} />
                      <span className="text-sm">{item.label}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

export default function AppNavbar() {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (location.startsWith("/shared/")) return null;

  const currentPaper = getPaperForRoute(location);

  return (
    <nav className="border-b border-border/50 bg-background/95 backdrop-blur-xl sticky top-0 z-50" data-testid="app-navbar">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-12">
          <div className="flex items-center gap-4">
            <Link href="/">
              <div className="flex items-center gap-2.5 cursor-pointer group" data-testid="nav-logo">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center text-primary group-hover:border-primary/40 transition-colors">
                  <Dna size={17} />
                </div>
                <div className="hidden sm:block">
                  <div className="font-semibold text-sm tracking-tight leading-tight">PAR(2) Discovery</div>
                  <div className="text-[10px] text-muted-foreground leading-tight">Circadian Dynamics</div>
                </div>
              </div>
            </Link>

            <div className="hidden md:flex items-center gap-1.5 ml-2">
              {NAV_GROUPS.map(group => (
                <NavDropdown key={group.label} group={group} />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/getting-started">
              <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs hidden lg:flex text-muted-foreground" data-testid="nav-getting-started">
                <BookOpen size={13} />
                Getting Started
              </Button>
            </Link>
            <Link href="/discovery-engine">
              <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs hidden sm:flex border-cyan-500/60 text-cyan-700 hover:bg-cyan-50 hover:border-cyan-500" data-testid="nav-upload">
                <Upload size={13} />
                Upload Data
              </Button>
            </Link>
            <Link href="/gene-eigenvalue-atlas">
              <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs hidden sm:flex" data-testid="nav-search">
                <Search size={13} />
                Search Genes
              </Button>
            </Link>

            {currentPaper && (
              currentPaper.direct ? (
                <a
                  href={currentPaper.downloadUrl}
                  download
                  data-testid={`nav-paper-badge-${currentPaper.label.replace(/\s+/g, '-').toLowerCase()}`}
                  className={`hidden sm:flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium border transition-colors cursor-pointer hover:opacity-80 ${currentPaper.color} ${currentPaper.bg} ${currentPaper.border}`}
                >
                  <Download size={12} />
                  {currentPaper.label}
                </a>
              ) : (
                <Link href={currentPaper.downloadUrl}>
                  <div
                    data-testid={`nav-paper-badge-${currentPaper.label.replace(/\s+/g, '-').toLowerCase()}`}
                    className={`hidden sm:flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium border transition-colors cursor-pointer hover:opacity-80 ${currentPaper.color} ${currentPaper.bg} ${currentPaper.border}`}
                  >
                    <Download size={12} />
                    {currentPaper.label}
                  </div>
                </Link>
              )
            )}

            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 md:hidden" data-testid="nav-mobile-menu">
                  <Menu size={18} />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <SheetHeader className="px-4 pt-4 pb-2 border-b border-border/50">
                  <SheetTitle className="flex items-center gap-2 text-sm">
                    <Dna size={16} className="text-primary" />
                    PAR(2) Discovery Engine
                  </SheetTitle>
                </SheetHeader>
                <MobileSidebarContent onClose={() => setMobileOpen(false)} />
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
}
