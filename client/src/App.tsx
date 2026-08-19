import { Switch, Route, Redirect, Link } from "wouter";
import { APP_VERSION } from "@/lib/version";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "@/components/ErrorBoundary";
import AppNavbar from "@/components/AppNavbar";
import GeneSearchPalette from "@/components/GeneSearchPalette";

import { lazy, Suspense, useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { trackPageView } from "./lib/analytics";

const Landing = lazy(() => import("@/pages/landing"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const GettingStarted = lazy(() => import("@/pages/getting-started"));
const ManuscriptDownload = lazy(() => import("@/pages/manuscript-download"));
const PaperADownload = lazy(() => import("@/pages/paper-a-download"));
const AssessmentPackage = lazy(() => import("@/pages/assessment-package"));
const Book = lazy(() => import("@/pages/book"));
const DiscoveryEngine = lazy(() => import("@/pages/discovery-engine"));
const ModelZoo = lazy(() => import("@/pages/model-zoo"));
const GenomeWide = lazy(() => import("@/pages/genome-wide"));
const SharedAnalysis = lazy(() => import("@/pages/shared-analysis"));
const RootSpace = lazy(() => import("@/pages/root-space"));
const About = lazy(() => import("@/pages/about"));
const Profile = lazy(() => import("@/pages/profile"));
const HumanDisruption = lazy(() => import("@/pages/human-disruption"));
const CrossContextValidation = lazy(() => import("@/pages/cross-context-validation"));
const GeneExplorer = lazy(() => import("@/pages/gene-explorer"));
const DiseaseScreen = lazy(() => import("@/pages/disease-screen"));
const VolatileGenes = lazy(() => import("@/pages/volatile-genes"));
const GeneSetTester = lazy(() => import("@/pages/gene-set-tester"));
const BeforeAfter = lazy(() => import("@/pages/before-after"));
const CryptVillus = lazy(() => import("@/pages/crypt-villus"));
const YeastValidation = lazy(() => import("@/pages/yeast-validation"));
const AR2Diagnostics = lazy(() => import("@/pages/ar2-diagnostics"));
const SupplementaryAnalyses = lazy(() => import("@/pages/supplementary-analyses"));
const Reconciliation = lazy(() => import("@/pages/reconciliation"));
const CancerStateSwap = lazy(() => import("@/pages/cancer-state-swap"));
const ConvergenceMap = lazy(() => import("@/pages/convergence-map"));
const GeneProteinMap = lazy(() => import("@/pages/gene-protein-map"));
const FrameworkBenchmarks = lazy(() => import("@/pages/framework-benchmarks"));
const PhaseGating = lazy(() => import("@/pages/phase-gating"));
const PhasePortrait = lazy(() => import("@/pages/phase-portrait"));
const GenomeWideCoupling = lazy(() => import("@/pages/genome-wide-coupling"));
const LiteratureValidation = lazy(() => import("@/pages/literature-validation"));
const CrossMetricIndependence = lazy(() => import("@/pages/cross-metric-independence"));
const ProteomeValidation = lazy(() => import("@/pages/proteome-validation"));
const ReportLibrary = lazy(() => import("@/pages/report-library"));
const HalfLifeReplication = lazy(() => import("@/pages/halflife-replication"));
const StateSpaceComparison = lazy(() => import("@/pages/state-space-comparison"));
const RegulatoryDiscovery = lazy(() => import("@/pages/regulatory-discovery"));
const OscillatorTaxonomy = lazy(() => import("@/pages/oscillator-taxonomy"));
const BomanSimulation = lazy(() => import("@/pages/boman-simulation"));
const BomanODE = lazy(() => import("@/pages/boman-ode"));
const ClockTargetPhi = lazy(() => import("@/pages/clock-target-phi"));
const PhiEnrichmentReplication = lazy(() => import("@/pages/phi-enrichment-replication"));
const MethodValidation = lazy(() => import("@/pages/method-validation"));
const CrossSpeciesPhi = lazy(() => import("@/pages/cross-species-phi"));
const TemporalCorrelation = lazy(() => import("@/pages/temporal-correlation"));
const FibonacciTwinningExtended = lazy(() => import("@/pages/fibonacci-twinning-extended"));
const BomanPAR2Mapping = lazy(() => import("@/pages/boman-par2-mapping"));
const PhiInevitabilityTest = lazy(() => import("@/pages/phi-inevitability-test"));
const PhiTimescaleBuffering = lazy(() => import("@/pages/phi-timescale-buffering"));
const GSE157357Analysis = lazy(() => import("@/pages/gse157357-analysis"));
const GlialAnalysis = lazy(() => import("@/pages/glial-analysis"));
const GBMZmanSeq = lazy(() => import("@/pages/gbm-zman-seq"));
const TCGAValidation = lazy(() => import("@/pages/tcga-validation"));
const PhaseSensitivity = lazy(() => import("@/pages/phase-sensitivity"));
const CoreEvidence = lazy(() => import("@/pages/core-evidence"));
const ChronotherapyPredictor = lazy(() => import("@/pages/chronotherapy-predictor"));
const P53Regulon = lazy(() => import("@/pages/p53-regulon"));
const GEOReplication = lazy(() => import("@/pages/geo-replication"));
const GSE11923Checkpoint = lazy(() => import("@/pages/gse11923-checkpoint"));
const P53Oscillator = lazy(() => import("@/pages/p53-oscillator"));
const FeedbackLoopThreshold = lazy(() => import("@/pages/feedback-loop-threshold"));
const NfkbUniversality = lazy(() => import("@/pages/nfkb-universality"));
const P53TissueLandscape = lazy(() => import("@/pages/p53-tissue-landscape"));
const MycOnDiscrepancy = lazy(() => import("@/pages/myc-on-discrepancy"));
const U2OSMycAR2 = lazy(() => import("@/pages/u2os-myc-ar2"));
const LightEntrainment = lazy(() => import("@/pages/light-entrainment"));
const RetinalAnalysis = lazy(() => import("@/pages/retinal-analysis"));
const MixtureSimulation = lazy(() => import("@/pages/mixture-simulation"));
const EvolutionaryGeneAge = lazy(() => import("@/pages/evolutionary-gene-age"));
const FiguresGallery = lazy(() => import("@/pages/figures-gallery"));
const MNDALSAnalysis = lazy(() => import("@/pages/mnd-als-analysis"));
const RuleValidation = lazy(() => import("@/pages/rule-validation"));
const GeneEigenvalueAtlas = lazy(() => import("@/pages/gene-eigenvalue-atlas"));
const PaperU = lazy(() => import("@/pages/paper-u"));
const MethodBenchmark = lazy(() => import("@/pages/benchmark"));
const Analytics = lazy(() => import("@/pages/analytics"));
const TuringDeepDive = lazy(() => import("@/pages/turing-deep-dive"));
const PersistenceLandscape = lazy(() => import("@/pages/persistence-landscape"));
const DrugDurability = lazy(() => import("@/pages/drug-durability"));

const NotFound = lazy(() => import("@/pages/not-found"));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    </div>
  );
}

function usePageTracking() {
  const [location] = useLocation();
  useEffect(() => {
    trackPageView(location);
  }, [location]);
}

function Router() {
  usePageTracking();
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/about" component={About} />
        <Route path="/profile" component={Profile} />
        <Route path="/getting-started" component={GettingStarted} />
        <Route path="/manuscript" component={ManuscriptDownload} />
        <Route path="/paper-a-download" component={PaperADownload} />
        <Route path="/assessment-package" component={AssessmentPackage} />
        <Route path="/book" component={Book} />
        <Route path="/discovery-engine" component={DiscoveryEngine} />
        <Route path="/model-zoo" component={ModelZoo} />
        <Route path="/genome-wide" component={GenomeWide} />
        <Route path="/root-space" component={RootSpace} />
        <Route path="/human-disruption" component={HumanDisruption} />
        <Route path="/cross-context-validation" component={CrossContextValidation} />
        <Route path="/gene-explorer" component={GeneExplorer} />
        <Route path="/disease-screen" component={DiseaseScreen} />
        <Route path="/volatile-genes" component={VolatileGenes} />
        <Route path="/gene-set-tester" component={GeneSetTester} />
        <Route path="/before-after" component={BeforeAfter} />
        <Route path="/crypt-villus" component={CryptVillus} />
        <Route path="/yeast-validation" component={YeastValidation} />
        <Route path="/ar2-diagnostics" component={AR2Diagnostics} />
        <Route path="/supplementary-analyses" component={SupplementaryAnalyses} />
        <Route path="/reconciliation" component={Reconciliation} />
        <Route path="/cancer-state-swap" component={CancerStateSwap} />
        <Route path="/convergence-map" component={ConvergenceMap} />
        <Route path="/gene-protein-map" component={GeneProteinMap} />
        <Route path="/framework-benchmarks" component={FrameworkBenchmarks} />
        <Route path="/phase-gating" component={PhaseGating} />
        <Route path="/phase-portrait" component={PhasePortrait} />
        <Route path="/genome-wide-coupling" component={GenomeWideCoupling} />
        <Route path="/literature-validation" component={LiteratureValidation} />
        <Route path="/cross-metric-independence" component={CrossMetricIndependence} />
        <Route path="/proteome-validation" component={ProteomeValidation} />
        <Route path="/reports" component={ReportLibrary} />
        <Route path="/halflife-replication" component={HalfLifeReplication} />
        <Route path="/state-space-comparison" component={StateSpaceComparison} />
        <Route path="/regulatory-discovery" component={RegulatoryDiscovery} />
        <Route path="/oscillator-taxonomy" component={OscillatorTaxonomy} />
        <Route path="/boman-simulation" component={BomanSimulation} />
        <Route path="/boman-ode" component={BomanODE} />
        <Route path="/clock-target-phi" component={ClockTargetPhi} />
        <Route path="/phi-enrichment-replication" component={PhiEnrichmentReplication} />
        <Route path="/method-validation" component={MethodValidation} />
        <Route path="/cross-species-phi" component={CrossSpeciesPhi} />
        <Route path="/temporal-correlation" component={TemporalCorrelation} />
        <Route path="/fibonacci-twinning-extended" component={FibonacciTwinningExtended} />
        <Route path="/boman-par2-mapping" component={BomanPAR2Mapping} />
        <Route path="/phi-inevitability-test" component={PhiInevitabilityTest} />
        <Route path="/phi-timescale-buffering" component={PhiTimescaleBuffering} />
        <Route path="/gse157357-analysis" component={GSE157357Analysis} />
        <Route path="/glial-analysis" component={GlialAnalysis} />
        <Route path="/gbm-zman-seq" component={GBMZmanSeq} />
        <Route path="/tcga-validation" component={TCGAValidation} />
        <Route path="/phase-sensitivity" component={PhaseSensitivity} />
        <Route path="/core-evidence" component={CoreEvidence} />
        <Route path="/chronotherapy-predictor" component={ChronotherapyPredictor} />
        <Route path="/p53-regulon" component={P53Regulon} />
        <Route path="/geo-replication" component={GEOReplication} />
        <Route path="/gse11923-checkpoint" component={GSE11923Checkpoint} />
        <Route path="/p53-oscillator" component={P53Oscillator} />
        <Route path="/feedback-loop-threshold" component={FeedbackLoopThreshold} />
        <Route path="/nfkb-universality" component={NfkbUniversality} />
        <Route path="/p53-tissue-landscape" component={P53TissueLandscape} />
        <Route path="/myc-on-discrepancy" component={MycOnDiscrepancy} />
        <Route path="/u2os-myc-ar2" component={U2OSMycAR2} />
        <Route path="/light-entrainment" component={LightEntrainment} />
        <Route path="/retinal-analysis" component={RetinalAnalysis} />
        <Route path="/mixture-simulation" component={MixtureSimulation} />
        <Route path="/evolutionary-gene-age" component={EvolutionaryGeneAge} />
        <Route path="/figure-gallery" component={FiguresGallery} />
        <Route path="/mnd-als" component={MNDALSAnalysis} />
        <Route path="/paper-g-original">{() => { window.location.replace("/manuscript"); return null; }}</Route>
        <Route path="/paper-g-revision">{() => { window.location.replace("/manuscript"); return null; }}</Route>
        <Route path="/paper-u" component={PaperU} />
        <Route path="/rule-validation" component={RuleValidation} />
        <Route path="/gene-eigenvalue-atlas" component={GeneEigenvalueAtlas} />

        <Route path="/shared/:id" component={SharedAnalysis} />

        {/* Legacy redirects — preserved for bookmarks and external links */}
        <Route path="/cancer-browser">{() => <Redirect to="/disease-screen" />}</Route>
        <Route path="/validation-suite">{() => <Redirect to="/ar2-diagnostics" />}</Route>
        <Route path="/validation-summary">{() => <Redirect to="/convergence-map" />}</Route>
        <Route path="/cell-type-persistence">{() => <Redirect to="/rule-validation" />}</Route>
        <Route path="/analytics">{() => <Analytics />}</Route>
        <Route path="/robustness-suite">{() => <Redirect to="/supplementary-analyses" />}</Route>
        <Route path="/health-score">{() => <Redirect to="/chronotherapy-predictor" />}</Route>
        <Route path="/drug-durability" component={DrugDurability} />
        <Route path="/bacterial-persistence">{() => <Redirect to="/yeast-validation" />}</Route>
        <Route path="/persistence-landscape" component={PersistenceLandscape} />
        <Route path="/manuscript-validation">{() => <Redirect to="/ar2-diagnostics" />}</Route>
        <Route path="/methods-benchmark">{() => <Redirect to="/framework-benchmarks" />}</Route>
        <Route path="/decomposition-stability">{() => <Redirect to="/ar2-diagnostics" />}</Route>
        <Route path="/category-tests">{() => <Redirect to="/ar2-diagnostics" />}</Route>
        <Route path="/cofe-context">{() => <Redirect to="/convergence-map" />}</Route>
        <Route path="/wearable-analysis">{() => <Redirect to="/chronotherapy-predictor" />}</Route>
        <Route path="/disease-phase-diagram">{() => <Redirect to="/disease-screen" />}</Route>
        <Route path="/abm-minimal">{() => <Redirect to="/boman-simulation" />}</Route>
        <Route path="/species-comparison">{() => <Redirect to="/cross-context-validation" />}</Route>
        <Route path="/cross-tissue-three-layer">{() => <Redirect to="/cross-context-validation" />}</Route>
        <Route path="/stationarity-validation">{() => <Redirect to="/supplementary-analyses" />}</Route>
        <Route path="/rolling-window">{() => <Redirect to="/supplementary-analyses" />}</Route>
        <Route path="/eigenvalue-independence">{() => <Redirect to="/ar2-diagnostics" />}</Route>
        <Route path="/figure2">{() => <Redirect to="/dashboard" />}</Route>
        <Route path="/granger">{() => <Redirect to="/dashboard" />}</Route>
        <Route path="/gap-classifier">{() => <Redirect to="/dashboard" />}</Route>
        <Route path="/high-res-validation">{() => <Redirect to="/dashboard" />}</Route>
        <Route path="/crypt-buckling">{() => <Redirect to="/dashboard" />}</Route>
        <Route path="/skin-stress-tests">{() => <Redirect to="/genome-wide" />}</Route>
        <Route path="/method-validation">{() => <Redirect to="/framework-benchmarks" />}</Route>
        <Route path="/turing-deep-dive" component={TuringDeepDive} />
        <Route path="/benchmark" component={MethodBenchmark} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

const SUBMISSION_TIMESTAMP = "July 2026";
const VERSION = APP_VERSION;


function SubmissionFooter() {
  const [modalOpen, setModalOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [pwError, setPwError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const openModal = (e: React.MouseEvent) => {
    e.preventDefault();
    setPw("");
    setPwError("");
    setModalOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleSubmit = () => {
    if (!pw.trim()) { setPwError("Enter password"); return; }
    sessionStorage.setItem("admin_pw", pw);
    setModalOpen(false);
    setPw("");
    window.location.href = "/analytics";
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit();
    if (e.key === "Escape") setModalOpen(false);
  };

  return (
    <>
      <footer className="border-t border-border/50 bg-background/95 backdrop-blur-xl mt-auto" data-testid="submission-footer">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">Locked</span>
              </div>
              <span className="text-[11px] text-muted-foreground">
                Michael Whiteside · <a href="https://orcid.org/0009-0000-0643-5791" target="_blank" rel="noopener noreferrer" className="underline text-foreground/70 hover:text-foreground font-mono">ORCID</a>
              </span>
              <span className="text-[11px] text-muted-foreground">·</span>
              <a href="https://x.com/Michael_PAR2" target="_blank" rel="noopener noreferrer" className="text-[11px] text-muted-foreground hover:text-foreground transition-colors" aria-label="X (Twitter)">
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current inline-block" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
              <span className="text-[11px] text-muted-foreground">·</span>
              <a href="https://polyformproject.org/licenses/noncommercial/1.0.0" target="_blank" rel="noopener noreferrer" className="text-[11px] underline text-muted-foreground hover:text-foreground">
                PolyForm NC 1.0.0
              </a>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={openModal}
                className="text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors cursor-pointer"
                data-testid="button-admin-open"
              >
                Admin
              </button>
              <span className="text-[11px] text-muted-foreground font-mono" data-testid="text-submission-timestamp">
                v{VERSION} · {SUBMISSION_TIMESTAMP}
              </span>
            </div>
          </div>
        </div>
      </footer>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}
          data-testid="modal-admin"
        >
          <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <span className="font-semibold text-foreground text-sm">Admin Access</span>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                data-testid="button-admin-close"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-muted-foreground">Enter the admin password to view usage analytics and backend data.</p>
            <input
              ref={inputRef}
              type="password"
              placeholder="Admin password"
              value={pw}
              onChange={(e) => { setPw(e.target.value); setPwError(""); }}
              onKeyDown={handleKeyDown}
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted/40 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              data-testid="input-admin-password"
            />
            {pwError && <p className="text-xs text-red-400" data-testid="text-admin-error">{pwError}</p>}
            <button
              onClick={handleSubmit}
              className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
              data-testid="button-admin-submit"
            >
              Open Analytics
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <div className="flex flex-col min-h-screen">
            <AppNavbar />
            <div className="flex-1">
              <Router />
            </div>
            <SubmissionFooter />
            <GeneSearchPalette />
          </div>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
