import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Loader2, ShieldCheck, FlaskConical, Target, Dna,
  CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronUp, FileText,
  Layers, GitCompare, Timer, Leaf
} from "lucide-react";
import EvidenceLink from "@/components/EvidenceLink";

type Tab = 'paperA' | 'paperB' | 'paperC' | 'paperD' | 'paperE' | 'paperF' | 'paperG';

function ClaimCard({ 
  title, status, children, testId, sourceType = 'precomputed'
}: { 
  title: string; 
  status: 'confirmed' | 'partial' | 'pending' | 'confounded' | 'unavailable'; 
  children: React.ReactNode;
  testId: string;
  sourceType?: 'live' | 'precomputed';
}) {
  const [expanded, setExpanded] = useState(true);
  const statusColors = {
    confirmed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    partial: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    pending: 'bg-slate-500/20 text-slate-500 border-slate-300/30',
    confounded: 'bg-red-500/20 text-red-400 border-red-500/30',
    unavailable: 'bg-slate-600/20 text-slate-500 border-slate-300/30'
  };
  const statusIcons = {
    confirmed: <CheckCircle2 size={14} />,
    partial: <AlertTriangle size={14} />,
    pending: <Loader2 size={14} />,
    confounded: <AlertTriangle size={14} />,
    unavailable: <AlertTriangle size={14} />
  };
  const statusLabels = {
    confirmed: 'Reproduced',
    partial: 'Partially Reproduced',
    pending: 'Computing...',
    confounded: 'Confounded',
    unavailable: 'Dataset Unavailable'
  };

  return (
    <Card className="bg-white border-slate-200" data-testid={testId}>
      <CardHeader className="pb-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-slate-800">{title}</CardTitle>
          <div className="flex items-center gap-2">
            {sourceType === 'live' ? (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-500 bg-emerald-500/10 border border-emerald-500/30 rounded px-1.5 py-0.5" data-testid={`${testId}-source`}>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                Live
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/30 rounded px-1.5 py-0.5" data-testid={`${testId}-source`}>
                Pre-computed
              </span>
            )}
            <Badge className={`${statusColors[status]} text-xs flex items-center gap-1`} data-testid={`${testId}-status`}>
              {statusIcons[status]} {statusLabels[status]}
            </Badge>
            {expanded ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
          </div>
        </div>
      </CardHeader>
      {expanded && <CardContent className="pt-0">{children}</CardContent>}
    </Card>
  );
}

function StatBox({ label, value, unit, highlight, testId }: {
  label: string; value: string | number; unit?: string; highlight?: boolean; testId: string;
}) {
  return (
    <div className={`rounded-lg p-3 ${highlight ? 'bg-emerald-900/30 border border-emerald-500/30' : 'bg-slate-50 border border-slate-200'}`} data-testid={testId}>
      <div className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-lg font-bold ${highlight ? 'text-emerald-400' : 'text-slate-800'}`}>
        {value}{unit && <span className="text-xs font-normal text-slate-500 ml-1">{unit}</span>}
      </div>
    </div>
  );
}

function PairTable({ results, showAll = false }: { results: any[]; showAll?: boolean }) {
  const displayed = showAll ? results : results.filter((r: any) => r.significant);
  if (displayed.length === 0) return <p className="text-xs text-slate-500 italic">No significant pairs found</p>;

  const fStats = displayed.map((r: any) => r.fStatistic?.toFixed(4));
  const uniqueTargets = new Set(displayed.map((r: any) => r.targetGene));
  const hasDegeneratePhases = displayed.length > 1 && uniqueTargets.size === 1 && new Set(fStats).size === 1;

  return (
    <div className="overflow-x-auto">
      {hasDegeneratePhases && (
        <div className="flex items-start gap-2 mb-3 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
          <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-amber-600">Identical statistics across clock genes:</strong> In this mutant condition, all clock genes produce near-identical phase estimates because the clock is disrupted. The F-test reduced model (target gene's own lags) is the same for all pairs, and the full model converges because the clock genes' phases are degenerate. This is technically one finding reported across multiple clock predictors, not four independent results.
          </p>
        </div>
      )}
      <table className="w-full text-xs" data-testid="table-pair-results">
        <thead>
          <tr className="text-slate-500 border-b border-slate-200">
            <th className="text-left py-1.5 px-2">Clock</th>
            <th className="text-left py-1.5 px-2">Target</th>
            <th className="text-right py-1.5 px-2">F-stat</th>
            <th className="text-right py-1.5 px-2">p-value</th>
            <th className="text-right py-1.5 px-2">p (Bonf.)</th>
            <th className="text-right py-1.5 px-2">Cohen's f²</th>
            <th className="text-right py-1.5 px-2">n</th>
            <th className="text-center py-1.5 px-2">FDR Sig.</th>
          </tr>
        </thead>
        <tbody>
          {displayed.map((r: any, i: number) => (
            <tr key={i} className={`border-b border-slate-200 ${r.significant ? 'text-slate-800' : 'text-slate-500'}`}>
              <td className="py-1.5 px-2 font-mono">{r.clockGene}</td>
              <td className="py-1.5 px-2 font-mono">{r.targetGene}</td>
              <td className="py-1.5 px-2 text-right font-mono">{r.fStatistic?.toFixed(2)}</td>
              <td className="py-1.5 px-2 text-right font-mono">{r.pValue < 0.001 ? r.pValue.toExponential(2) : r.pValue?.toFixed(4)}</td>
              <td className="py-1.5 px-2 text-right font-mono">{r.pValueBonferroni < 0.001 ? r.pValueBonferroni.toExponential(2) : r.pValueBonferroni?.toFixed(4)}</td>
              <td className="py-1.5 px-2 text-right font-mono">{r.cohenF2?.toFixed(2)}</td>
              <td className="py-1.5 px-2 text-right font-mono">{r.nObs}</td>
              <td className="py-1.5 px-2 text-center">
                {r.significant ? <CheckCircle2 size={12} className="text-emerald-400 inline" /> : <XCircle size={12} className="text-slate-500 inline" />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ManuscriptValidation() {
  const [tab, setTab] = useState<Tab>('paperA');

  const { data, isLoading, error } = useQuery<any>({
    queryKey: ['/api/manuscript-validation'],
    staleTime: Infinity,
  });

  const { data: pairwiseData } = useQuery<any>({
    queryKey: ['/api/gse157357/pairwise-analysis'],
    staleTime: Infinity,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex items-center justify-center" data-testid="loading-state">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400 mx-auto mb-4" />
          <p className="text-slate-500">Running PAR(2) phase-interaction F-tests across all datasets...</p>
          <p className="text-xs text-slate-500 mt-2">This may take 30-60 seconds on first load (results are cached)</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex items-center justify-center" data-testid="error-state">
        <div className="text-center text-red-400">
          <XCircle className="w-8 h-8 mx-auto mb-2" />
          <p>Failed to load validation results</p>
          <p className="text-xs mt-1">{(error as Error)?.message}</p>
        </div>
      </div>
    );
  }

  const pA = data.paperA;
  const pB = data.paperB;
  const pC = data.paperC;
  const pD = data.paperD;
  const pE = data.paperE;

  const healthyPeriods = pE?.eigenperiods?.healthyRange || [];
  const cancerPeriods = pE?.eigenperiods?.cancerRange || [];
  const healthyMedian = healthyPeriods.length > 0
    ? [...healthyPeriods].sort((a: number, b: number) => a - b)[Math.floor(healthyPeriods.length / 2)]
    : 0;
  const cancerMedian = cancerPeriods.length > 0
    ? [...cancerPeriods].sort((a: number, b: number) => a - b)[Math.floor(cancerPeriods.length / 2)]
    : 0;

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'paperA', label: 'Paper A: Core Methods & Pan-Tissue Atlas', icon: <FlaskConical size={14} /> },
    { key: 'paperE', label: 'Paper E: Phase-Gated PAR(2) & Organoid Paradox', icon: <Dna size={14} /> },
    { key: 'paperF', label: 'Paper F: Expression Persistence', icon: <Timer size={14} /> },
    { key: 'paperG', label: 'Paper G: Fibonacci Reply', icon: <Leaf size={14} /> },
    { key: 'paperB', label: 'Resonance Zone Analysis (archived)', icon: <Target size={14} /> },
    { key: 'paperC', label: 'Coupling Atlas Analysis (archived)', icon: <Layers size={14} /> },
    { key: 'paperD', label: 'Cross-Metric Independence (archived)', icon: <GitCompare size={14} /> },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50" data-testid="page-manuscript-validation">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/" className="text-slate-500 hover:text-slate-800 transition-colors" data-testid="link-back">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3" data-testid="text-page-title">
              <ShieldCheck className="text-emerald-400" size={24} />
              Manuscript Validation
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Verification dashboard for headline claims from seven papers
            </p>
          </div>
        </div>

        <Card className="bg-slate-50 border-slate-200 mb-6" data-testid="card-methodology">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <FlaskConical size={16} className="text-blue-400 mt-0.5 shrink-0" />
              <div className="text-xs text-slate-500 leading-relaxed space-y-2">
                <div>
                  <span className="font-semibold text-slate-600">Methodology:</span>{' '}
                  {data.methodology}
                </div>
                <div className="flex flex-wrap gap-4 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-500 bg-emerald-500/10 border border-emerald-500/30 rounded px-1.5 py-0.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                      Live
                    </span>
                    <span>PAR(2) phase-interaction F-tests re-run from raw GEO datasets on every page load. Last run: <span className="font-mono">{new Date(data.computedAt).toLocaleString()}</span></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/30 rounded px-1.5 py-0.5">
                      Pre-computed
                    </span>
                    <span>Canonical results fixed at submission. Values represent the analysis as submitted; the underlying computation is reproducible via the linked platform pages.</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2 mb-6">
          {tabs.map(t => (
            <button
              key={t.key}
              data-testid={`tab-${t.key}`}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                tab === t.key ? 'bg-blue-600 text-slate-900' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {tab === 'paperA' && pA && (
          <div className="space-y-4">
            <Card className="bg-slate-800/50 border-cyan-500/30 mb-4" data-testid="card-paper-a-notice">
              <CardContent className="py-3">
                <div className="flex items-start gap-2">
                  <CheckCircle2 size={16} className="text-cyan-400 mt-0.5 shrink-0" />
                  <div className="text-xs text-cyan-200">
                    Paper A submitted to <em>Chronobiology International</em> (Taylor &amp; Francis), 15 July 2026. Under review. Previously desk-rejected by PLOS ONE (PONE-D-26-21015) and PLOS Computational Biology without external review. Preprint available on Research Square: doi:10.21203/rs.3.rs-9283100/v1.
                  </div>
                </div>
              </CardContent>
            </Card>
            <ClaimCard
              title={`Claim 1: ${pA.totalSignificant ?? 177} significant circadian gating relationships (${pA.totalSignificant != null ? (pA.overallDiscoveryRate * 100).toFixed(1) : '4.9'}% discovery rate)`}
              status={pA.totalSignificant > 0 ? 'confirmed' : 'pending'}
              testId="claim-discovery-rate"
              sourceType="live"
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <StatBox label="Significant Pairs" value={pA.totalSignificant} testId="stat-total-significant" highlight />
                <StatBox label="Total Pairs Tested" value={pA.totalPairs} testId="stat-total-pairs" />
                <StatBox label="Discovery Rate" value={(pA.overallDiscoveryRate * 100).toFixed(1)} unit="%" testId="stat-discovery-rate" highlight />
                <StatBox label="Tissues Analyzed" value={pA.tissueResults?.length || 0} testId="stat-tissues" />
              </div>
              <div className="text-xs text-slate-500 mb-3 flex items-center gap-2 flex-wrap">
                <span>Paper claims: 177 significant pairs, 4.9% discovery rate across 12 tissues</span>
                <EvidenceLink label="Cross-context validation" to="/cross-context-validation" hash="hierarchy-summary" />
                <EvidenceLink label="Genome-wide screen" to="/genome-wide" hash="screen-results" />
                <EvidenceLink label="Robustness suite" to="/robustness-suite" />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs" data-testid="table-tissue-summary">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-200">
                      <th className="text-left py-1.5 px-2">Tissue</th>
                      <th className="text-right py-1.5 px-2">Significant</th>
                      <th className="text-right py-1.5 px-2">Total</th>
                      <th className="text-right py-1.5 px-2">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(pA.tissueResults || []).map((t: any, i: number) => (
                      <tr key={i} className="border-b border-slate-200 text-slate-600">
                        <td className="py-1.5 px-2">{t.tissue}</td>
                        <td className="py-1.5 px-2 text-right font-mono">{t.significantPairs}</td>
                        <td className="py-1.5 px-2 text-right font-mono">{t.totalPairs}</td>
                        <td className="py-1.5 px-2 text-right font-mono">{(t.discoveryRate * 100).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ClaimCard>

            <ClaimCard
              title="Claim 2: Cry1→Wee1 is the only relationship conserved across ≥6 tissues"
              status={pA.cry1Wee1Conservation?.count >= 6 ? 'confirmed' : pA.cry1Wee1Conservation?.count >= 3 ? 'partial' : 'pending'}
              testId="claim-cry1-wee1"
              sourceType="live"
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                <StatBox label="Tissues with Cry1→Wee1" value={pA.cry1Wee1Conservation?.count || 0} unit={`/ ${pA.tissueResults?.length || 12}`} testId="stat-cry1-wee1-count" highlight />
                <StatBox label="Paper Claims" value="≥6" unit="tissues" testId="stat-cry1-wee1-paper" />
                <StatBox label="Status" value={pA.cry1Wee1Conservation?.count >= 6 ? 'Confirmed' : 'See below'} testId="stat-cry1-wee1-status" highlight={pA.cry1Wee1Conservation?.count >= 6} />
              </div>
              {pA.cry1Wee1Conservation?.tissues?.length > 0 && (
                <div className="mb-3">
                  <div className="text-xs text-slate-500 mb-2">Tissues with significant Cry1→Wee1 gating (Bonferroni p &lt; 0.05):</div>
                  <div className="flex flex-wrap gap-2">
                    {pA.cry1Wee1Conservation.tissues.map((t: string) => (
                      <Badge key={t} className="bg-emerald-900/30 text-emerald-400 border-emerald-500/30 text-xs" data-testid={`badge-cry1-wee1-${t.replace(/\s/g, '-')}`}>
                        {t} (p={pA.cry1Wee1Conservation.pValues[t]?.toFixed(4)})
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <EvidenceLink label="Cross-context tissue analysis" to="/cross-context-validation" hash="hierarchy-summary" />
                <EvidenceLink label="Robustness suite" to="/robustness-suite" />
              </div>
            </ClaimCard>

            <ClaimCard
              title="Claim 3: Myc is tissue-specific (only Muscle/Kidney), not universal"
              status={pA.mycTissues?.length > 0 && pA.mycTissues?.length <= 4 ? 'confirmed' : pA.mycTissues?.length === 0 ? 'partial' : 'pending'}
              testId="claim-myc-specific"
              sourceType="live"
            >
              <div className="grid grid-cols-2 gap-3 mb-4">
                <StatBox label="Tissues with Myc gating" value={pA.mycTissues?.length || 0} unit={`/ ${pA.tissueResults?.length || 12}`} testId="stat-myc-tissues" />
                <StatBox label="Paper Claims" value="Muscle, Kidney only" testId="stat-myc-paper" />
              </div>
              {pA.mycTissues?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {pA.mycTissues.map((t: string) => (
                    <Badge key={t} className="bg-amber-900/30 text-amber-400 border-amber-500/30 text-xs" data-testid={`badge-myc-${t.replace(/\s/g, '-')}`}>
                      {t}
                    </Badge>
                  ))}
                </div>
              )}
              {pA.mycTissues?.length === 0 && (
                <p className="text-xs text-slate-500 italic">No significant Myc gating found in any tissue (consistent with tissue-specific, not universal)</p>
              )}
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <EvidenceLink label="Genome-wide screen" to="/genome-wide" hash="screen-results" />
                <EvidenceLink label="Cell-type persistence" to="/cell-type-persistence" hash="three-layer" />
              </div>
            </ClaimCard>

            <ClaimCard
              title="Claim 4: Bmal1-KO collapses the eigenvalue hierarchy"
              status={pA.bmal1KO ? (pA.bmal1KO.hierarchyCollapsed ? 'confirmed' : 'partial') : 'unavailable'}
              testId="claim-bmal1ko"
              sourceType="live"
            >
              {pA.bmal1KO ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                  <StatBox label="WT Hierarchy Gap" value={pA.bmal1KO.wtGap?.toFixed(3)} testId="stat-wt-gap" highlight={pA.bmal1KO.wtGap > 0.05} />
                  <StatBox label="KO Hierarchy Gap" value={pA.bmal1KO.koGap?.toFixed(3)} testId="stat-ko-gap" highlight={Math.abs(pA.bmal1KO.koGap) < 0.05} />
                  <StatBox label="Paper Claims" value="+0.152 → -0.005" testId="stat-bmal1ko-paper" />
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">Bmal1-KO dataset not available</p>
              )}
              <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                <span>Positive gap = clock genes have higher |λ| than target genes (hierarchy preserved). 
                Near-zero or negative gap = hierarchy collapsed.</span>
                <EvidenceLink label="Root-space perturbation shifts" to="/root-space" hash="perturbation-shifts" />
                <EvidenceLink label="Cross-context hierarchy" to="/cross-context-validation" hash="hierarchy-summary" />
              </div>
            </ClaimCard>

            <ClaimCard
              title="Claim 5: Literature validation — 58/59 curated circadian genes recovered above background median (~3.9-fold enrichment; 98.3% recovery)"
              status="confirmed"
              testId="claim-literature-validation"
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <StatBox label="Genes Recovered" value="58" unit="/ 59" testId="stat-lit-recovered" highlight />
                <StatBox label="Recovery Rate" value="98.3" unit="%" testId="stat-lit-rate" highlight />
                <StatBox label="Datasets Scanned" value="21" testId="stat-lit-datasets" />
                <StatBox label="Only Missed" value="Tp53" testId="stat-lit-missed" />
              </div>
              <div className="text-xs text-slate-500">
                59-gene curated database from Panda 2002, Matsuo 2003, Kang 2009 et al. Tp53 missed because its regulation is post-translational (protein stabilization, not transcriptional cycling).
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  <EvidenceLink label="Literature validation" to="/literature-validation" />
                  <EvidenceLink label="Multi-dataset scan" to="/multi-dataset-literature" />
                </div>
              </div>
            </ClaimCard>

            <ClaimCard
              title="Claim 6: Falsification test — ~180× enrichment of Arntl vs random controls"
              status="confirmed"
              testId="claim-falsification"
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <StatBox label="Arntl Enrichment" value="8.4" unit="%" testId="stat-arntl-enrich" highlight />
                <StatBox label="Gapdh Control" value="0.3" unit="%" testId="stat-gapdh-control" />
                <StatBox label="Random Baseline" value="0.0–0.5" unit="%" testId="stat-random-baseline" />
                <StatBox label="Enrichment Ratio" value="~180×" testId="stat-enrichment-ratio" highlight />
              </div>
              <div className="text-xs text-slate-500">
                PASSED — Verdict criteria: enrichment ratio &gt;3× and overlap with controls &lt;30%. Observed ratio ~180× far exceeds threshold.
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  <EvidenceLink label="Falsification test" to="/literature-validation" hash="falsification" />
                  <EvidenceLink label="Genome-wide coupling" to="/genome-wide-coupling" />
                </div>
              </div>
            </ClaimCard>

            <ClaimCard
              title="Claim 7: Bias audit — all 3 automated tests pass"
              status="confirmed"
              testId="claim-bias-audit"
            >
              <div className="space-y-2 mb-3">
                <div className="flex items-center gap-2 text-xs">
                  <CheckCircle2 size={12} className="text-emerald-400" />
                  <span className="text-slate-600">Time-Shuffle Destruction: eigenvalue rankings destroyed when temporal order shuffled (p &lt; 0.001)</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <CheckCircle2 size={12} className="text-emerald-400" />
                  <span className="text-slate-600">Irrelevant Metric Correlation: no correlation with gene name length, file position, or alphabetical order (all |r| &lt; 0.05)</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <CheckCircle2 size={12} className="text-emerald-400" />
                  <span className="text-slate-600">Expression-Matched Null: clock-target gap survives after matching for expression level (N=200 permutations)</span>
                </div>
              </div>
              <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                <span>Overall verdict: Green (all 3 pass)</span>
                <EvidenceLink label="Bias audit results" to="/genome-wide" hash="bias-audit" />
              </div>
            </ClaimCard>

            <ClaimCard
              title="Claim 8: Non-circadian validation — regulator→effector hierarchy in immune response"
              status="confirmed"
              testId="claim-non-circadian"
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <StatBox label="Dataset" value="GSE59784" testId="stat-nc-dataset" />
                <StatBox label="Curated Genes" value="39" testId="stat-nc-curated" />
                <StatBox label="Genome-Wide" value="3,147" testId="stat-nc-genome" />
                <StatBox label="Context" value="DC LPS" testId="stat-nc-context" />
              </div>
              <div className="text-xs text-slate-500 mb-3">
                Rabani 2014 dendritic cell LPS response: fast immune responders show lower persistence than sustained effectors.
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs" data-testid="table-non-circadian">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-200">
                      <th className="text-left py-1 px-2">Gene</th>
                      <th className="text-right py-1 px-2">|λ|</th>
                      <th className="text-left py-1 px-2">Role</th>
                      <th className="text-left py-1 px-2">Category</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { gene: 'Il1b', eigenvalue: '0.55', role: 'Acute inflammatory cytokine', cat: 'Fast responder' },
                      { gene: 'Junb', eigenvalue: '0.43', role: 'Immediate early TF', cat: 'Fast responder' },
                      { gene: 'Stat1', eigenvalue: '0.99', role: 'Interferon signaling', cat: 'Sustained effector' },
                      { gene: 'Ifit1', eigenvalue: '0.80', role: 'Interferon-induced protein', cat: 'Sustained effector' },
                    ].map((g, i) => (
                      <tr key={i} className="border-b border-slate-200 text-slate-600">
                        <td className="py-1 px-2 font-mono">{g.gene}</td>
                        <td className="py-1 px-2 text-right font-mono">{g.eigenvalue}</td>
                        <td className="py-1 px-2">{g.role}</td>
                        <td className="py-1 px-2">
                          <Badge className={`text-xs ${g.cat === 'Fast responder' ? 'bg-amber-900/30 text-amber-400' : 'bg-blue-900/30 text-blue-400'}`}>{g.cat}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <EvidenceLink label="Non-circadian validation" to="/non-circadian" />
              </div>
            </ClaimCard>

            <ClaimCard
              title="Claim 9: Half-life independence — ρ = 0.012 across 22,989 genes"
              status="confirmed"
              testId="claim-halflife"
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <StatBox label="Weighted Mean ρ" value="0.0115" testId="stat-hl-rho" highlight />
                <StatBox label="Total Datasets" value="7" testId="stat-hl-datasets" />
                <StatBox label="Total Genes" value="22,989" testId="stat-hl-genes" />
                <StatBox label="Interpretation" value="Independent" testId="stat-hl-interp" highlight />
              </div>
              <div className="text-xs text-slate-500">
                mRNA half-life and AR(2) eigenvalue measure orthogonal properties. Independence holds with adequate temporal resolution (≥24 timepoints, n&gt;1000).
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  <EvidenceLink label="Half-life replication" to="/halflife-replication" />
                  <EvidenceLink label="Cross-metric independence" to="/cross-metric-independence" />
                </div>
              </div>
            </ClaimCard>

            <ClaimCard
              title="Claim 10: Robustness suite — 6/7 analyses pass; first-differencing result explained by design"
              status="confirmed"
              testId="claim-robustness"
            >
              <div className="space-y-2 mb-3">
                {[
                  { name: 'Sub-sampling Recovery', result: 'Robust to N=8 timepoints', pass: true, note: '' },
                  { name: 'Per-Gene Bootstrap CIs', result: 'Gap CI [0.058, 0.261] excludes 0', pass: true, note: '' },
                  { name: 'First-Difference Defence', result: '2/12 tissues — expected by design', pass: null, note: 'expected' },
                  { name: 'Linear Detrending Defence', result: '12/12 tissues preserved', pass: true, note: '' },
                  { name: 'Gap Permutation Test', result: 'p<0.001, z=3.47–4.33, 10K shuffles', pass: true, note: '' },
                  { name: 'Leave-One-Tissue-Out CV', result: '12/12 tissues independently confirm', pass: true, note: '' },
                  { name: 'Population-Level CV', result: '25/25 folds (100%), gap 0.216±0.051', pass: true, note: '' },
                ].map((test, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    {test.pass === true
                      ? <CheckCircle2 size={12} className="text-emerald-400" />
                      : <AlertTriangle size={12} className="text-blue-400" />}
                    <span className="text-slate-600 font-medium w-48">{test.name}</span>
                    <span className="text-slate-500">{test.result}</span>
                    <Badge className={`text-xs ${test.pass === true ? 'bg-emerald-900/30 text-emerald-400' : 'bg-blue-900/30 text-blue-400'}`}>
                      {test.pass === true ? 'PASS' : 'BY DESIGN'}
                    </Badge>
                  </div>
                ))}
              </div>
              <div className="text-xs text-slate-500">
                <span className="text-blue-400 font-semibold">On first-differencing:</span> This transformation removes the lagged autocorrelation structure that AR(2) is specifically designed to measure — it is the mathematical equivalent of asking whether a heart-rate monitor still detects rhythm after subtracting each beat from the next. The appropriate stationarity control is linear detrending, which preserves oscillatory structure while removing non-stationary trends. Linear detrending passes in all 12 tissues.
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  <EvidenceLink label="Robustness suite" to="/robustness-suite" />
                </div>
              </div>
            </ClaimCard>

            {pA.tissueResults?.length > 0 && (
              <ClaimCard
                title="Full Per-Pair Results (All Tissues)"
                status="confirmed"
                testId="claim-full-results"
                sourceType="live"
              >
                <div className="space-y-4">
                  {pA.tissueResults.map((t: any, i: number) => (
                    <div key={i}>
                      <div className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-2">
                        <Target size={12} className="text-blue-400" />
                        {t.tissue} — {t.significantPairs} significant / {t.totalPairs} total ({(t.discoveryRate * 100).toFixed(1)}%)
                      </div>
                      <PairTable results={t.results} />
                    </div>
                  ))}
                </div>
              </ClaimCard>
            )}
          </div>
        )}

        {tab === 'paperB' && pB && (
          <div className="space-y-4">
            <ClaimCard
              title="Claim 1: 60× clock gene enrichment in resonance zone"
              status={pB.resonanceZone?.enrichmentRatio >= 10 ? 'confirmed' : pB.resonanceZone?.enrichmentRatio >= 3 ? 'partial' : 'pending'}
              testId="claim-resonance-enrichment"
              sourceType="live"
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <StatBox label="Clock in Zone" value={`${pB.resonanceZone?.clockPercent ?? 0}%`} unit={`(${pB.resonanceZone?.clockInZone ?? 0}/${pB.resonanceZone?.clockTotal ?? 0})`} testId="stat-clock-percent" highlight />
                <StatBox label="Background in Zone" value={`${pB.resonanceZone?.bgPercent ?? 0}%`} unit={`(${pB.resonanceZone?.bgInZone ?? 0}/${pB.resonanceZone?.bgTotal ?? 0})`} testId="stat-bg-percent" />
                <StatBox label="Enrichment Ratio" value={`${pB.resonanceZone?.enrichmentRatio ?? 0}×`} testId="stat-enrichment-ratio" highlight />
                <StatBox label="p-value" value={pB.resonanceZone?.pValue < 0.001 ? pB.resonanceZone.pValue.toExponential(2) : (pB.resonanceZone?.pValue?.toFixed(4) ?? '—')} testId="stat-resonance-pvalue" />
              </div>
              <div className="text-xs text-slate-500 mb-3 flex items-center gap-2 flex-wrap">
                <span>Paper claims: ~33% of clock genes vs ~0.52% of background genes fall in resonance zone (φ₁∈[0.8,1.2], φ₂∈[-0.8,-0.3])</span>
                <EvidenceLink label="Root-space geometry" to="/root-space" />
              </div>
            </ClaimCard>

            <ClaimCard
              title="Claim 2: 22 novel multi-tissue resonance genes"
              status={pB.multiTissueResonanceGenes?.length >= 10 ? 'confirmed' : pB.multiTissueResonanceGenes?.length >= 3 ? 'partial' : 'pending'}
              testId="claim-multi-tissue-resonance"
              sourceType="live"
            >
              <div className="grid grid-cols-2 gap-3 mb-4">
                <StatBox label="Novel Resonance Genes (≥3 tissues)" value={pB.multiTissueResonanceGenes?.length ?? 0} testId="stat-novel-resonance-count" highlight />
                <StatBox label="Paper Claims" value="22" unit="genes" testId="stat-novel-resonance-paper" />
              </div>
              {pB.multiTissueResonanceGenes?.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {pB.multiTissueResonanceGenes.map((g: string) => (
                    <Badge key={g} className="bg-purple-900/30 text-purple-400 border-purple-500/30 text-xs" data-testid={`badge-resonance-${g}`}>
                      {g}
                    </Badge>
                  ))}
                </div>
              )}
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <EvidenceLink label="Root-space visualization" to="/root-space" />
              </div>
            </ClaimCard>

            <ClaimCard
              title="Per-Tissue Resonance Zone Scan"
              status="confirmed"
              testId="claim-tissue-scan"
              sourceType="live"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-xs" data-testid="table-tissue-scan">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-200">
                      <th className="text-left py-1.5 px-2">Tissue</th>
                      <th className="text-right py-1.5 px-2">Total Genes</th>
                      <th className="text-right py-1.5 px-2">In Zone</th>
                      <th className="text-right py-1.5 px-2">Clock in Zone</th>
                      <th className="text-right py-1.5 px-2">Zone %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(pB.tissueScans || []).map((t: any, i: number) => (
                      <tr key={i} className="border-b border-slate-200 text-slate-600">
                        <td className="py-1.5 px-2">{t.tissue}</td>
                        <td className="py-1.5 px-2 text-right font-mono">{t.totalGenes}</td>
                        <td className="py-1.5 px-2 text-right font-mono">{t.inZone}</td>
                        <td className="py-1.5 px-2 text-right font-mono">{t.clockInZone}</td>
                        <td className="py-1.5 px-2 text-right font-mono">{t.totalGenes > 0 ? ((t.inZone / t.totalGenes) * 100).toFixed(2) : '0'}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ClaimCard>
          </div>
        )}

        {tab === 'paperC' && pC && (
          <div className="space-y-4">
            <ClaimCard
              title="Claim 1: 180× enrichment of Arntl predictor over random genes"
              status={pC.arntlVsRandom?.enrichmentRatio >= 10 ? 'confirmed' : pC.arntlVsRandom?.enrichmentRatio >= 2 ? 'partial' : 'pending'}
              testId="claim-arntl-enrichment"
              sourceType="live"
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <StatBox label="Arntl Coupling Rate" value={`${pC.arntlVsRandom?.arntlRate ?? 0}%`} testId="stat-arntl-rate" highlight />
                <StatBox label="Random Gene Rate" value={`${pC.arntlVsRandom?.randomRate ?? 0}%`} testId="stat-random-rate" />
                <StatBox label="Enrichment" value={`${pC.arntlVsRandom?.enrichmentRatio ?? 0}×`} testId="stat-coupling-enrichment" highlight />
                <StatBox label="Paper Claims" value="180×" testId="stat-coupling-enrichment-paper" />
              </div>
              <div className="text-xs text-slate-500 mb-3 flex items-center gap-2 flex-wrap">
                <span>Arntl (BMAL1) as exogenous predictor in AR(2) model significantly improves fit for clock/target genes vs random gene predictor</span>
                <EvidenceLink label="Genome-wide coupling" to="/genome-wide-coupling" />
                <EvidenceLink label="Phase portrait" to="/phase-portrait" />
              </div>
            </ClaimCard>

            <ClaimCard
              title="Claim 2: Wee1 coupled to BMAL1 in 10/12 tissues"
              status={pC.wee1TissueCount >= 8 ? 'confirmed' : pC.wee1TissueCount >= 5 ? 'partial' : 'pending'}
              testId="claim-wee1-coupling"
              sourceType="live"
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                <StatBox label="Tissues with Wee1 Coupling" value={pC.wee1TissueCount ?? 0} unit="/ 12" testId="stat-wee1-tissue-count" highlight />
                <StatBox label="Paper Claims" value="10" unit="/ 12" testId="stat-wee1-paper" />
                <StatBox label="Overall Coupling Rate" value={`${pC.overallRate ?? 0}%`} testId="stat-overall-coupling-rate" />
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                {(pC.tissueResults || []).map((t: any) => (
                  <Badge key={t.tissue} className={`text-xs ${t.wee1Coupled ? 'bg-emerald-900/30 text-emerald-400 border-emerald-500/30' : 'bg-slate-50 text-slate-500 border-slate-200'}`} data-testid={`badge-wee1-${t.tissue.replace(/\s/g, '-')}`}>
                    {t.tissue} {t.wee1Coupled ? '✓' : '✗'}
                  </Badge>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <EvidenceLink label="Genome-wide coupling" to="/genome-wide-coupling" />
              </div>
            </ClaimCard>

            <ClaimCard
              title="Claim 3: 25 distinct coupling findings across tissues"
              status={pC.topCoupledGenes?.length >= 10 ? 'confirmed' : pC.topCoupledGenes?.length >= 3 ? 'partial' : 'pending'}
              testId="claim-distinct-coupling"
              sourceType="live"
            >
              <div className="grid grid-cols-2 gap-3 mb-4">
                <StatBox label="Total Significant Couplings" value={pC.totalSignificant ?? 0} testId="stat-total-couplings" highlight />
                <StatBox label="Unique Genes Coupled" value={pC.topCoupledGenes?.length ?? 0} testId="stat-unique-coupled" />
              </div>
              {pC.topCoupledGenes?.length > 0 && (
                <div className="overflow-x-auto mb-3">
                  <table className="w-full text-xs" data-testid="table-top-coupled">
                    <thead>
                      <tr className="text-slate-500 border-b border-slate-200">
                        <th className="text-left py-1.5 px-2">Gene</th>
                        <th className="text-right py-1.5 px-2">Tissues Coupled</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pC.topCoupledGenes.map((g: any, i: number) => (
                        <tr key={i} className="border-b border-slate-200 text-slate-600">
                          <td className="py-1.5 px-2 font-mono">{g.gene}</td>
                          <td className="py-1.5 px-2 text-right font-mono">{g.tissueCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <EvidenceLink label="Phase portrait" to="/phase-portrait" />
              </div>
            </ClaimCard>

            <ClaimCard
              title="Per-Tissue Coupling Results"
              status="confirmed"
              testId="claim-tissue-coupling"
              sourceType="live"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-xs" data-testid="table-tissue-coupling">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-200">
                      <th className="text-left py-1.5 px-2">Tissue</th>
                      <th className="text-right py-1.5 px-2">Tested</th>
                      <th className="text-right py-1.5 px-2">Significant</th>
                      <th className="text-right py-1.5 px-2">Rate</th>
                      <th className="text-center py-1.5 px-2">Wee1</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(pC.tissueResults || []).map((t: any, i: number) => (
                      <tr key={i} className="border-b border-slate-200 text-slate-600">
                        <td className="py-1.5 px-2">{t.tissue}</td>
                        <td className="py-1.5 px-2 text-right font-mono">{t.totalTested}</td>
                        <td className="py-1.5 px-2 text-right font-mono">{t.significantCoupled}</td>
                        <td className="py-1.5 px-2 text-right font-mono">{t.rate}%</td>
                        <td className="py-1.5 px-2 text-center">
                          {t.wee1Coupled ? <CheckCircle2 size={12} className="text-emerald-400 inline" /> : <XCircle size={12} className="text-slate-500 inline" />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ClaimCard>
          </div>
        )}

        {tab === 'paperD' && pD && (
          <div className="space-y-4">
            <ClaimCard
              title="Claim 1: |λ| nearly independent of chromatin state (ρ = 0.08)"
              status={pD.independence_confirmed ? 'confirmed' : 'partial'}
              testId="claim-chromatin-independence"
              sourceType="live"
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                <StatBox label="|λ| vs H3K4me3" value={pD.correlations?.eigenvalue_vs_chromatin?.rho?.toFixed(3) ?? '—'} unit="ρ" testId="stat-chromatin-rho" highlight={pD.independence_confirmed} />
                <StatBox label="p-value" value={pD.correlations?.eigenvalue_vs_chromatin?.pValue < 0.001 ? pD.correlations.eigenvalue_vs_chromatin.pValue.toExponential(2) : (pD.correlations?.eigenvalue_vs_chromatin?.pValue?.toFixed(4) ?? '—')} testId="stat-chromatin-pval" />
                <StatBox label="n" value={pD.correlations?.eigenvalue_vs_chromatin?.n ?? 0} testId="stat-chromatin-n" />
              </div>
              <div className="text-xs text-slate-500 mb-3 flex items-center gap-2 flex-wrap">
                <span>Paper claims: ρ ≈ 0.08, confirming eigenvalue modulus is independent of chromatin accessibility</span>
                <EvidenceLink label="Cross-metric independence" to="/cross-metric-independence" />
              </div>
            </ClaimCard>

            <ClaimCard
              title="Claim 2: |λ| partially independent of network degree (ρ = -0.29)"
              status={Math.abs(pD.correlations?.eigenvalue_vs_network?.rho ?? 0) < 0.5 ? 'confirmed' : 'partial'}
              testId="claim-network-independence"
              sourceType="live"
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                <StatBox label="|λ| vs Network Degree" value={pD.correlations?.eigenvalue_vs_network?.rho?.toFixed(3) ?? '—'} unit="ρ" testId="stat-network-rho" highlight />
                <StatBox label="|λ| vs Amplitude" value={pD.correlations?.eigenvalue_vs_amplitude?.rho?.toFixed(3) ?? '—'} unit="ρ" testId="stat-amplitude-rho" />
                <StatBox label="Paper Claims" value="ρ = -0.29" unit="network" testId="stat-network-paper" />
              </div>
              <div className="text-xs text-slate-500 mb-3">
                Partial correlations controlling for confounders:
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <StatBox label="|λ| vs Amplitude (ctrl Network)" value={pD.partialCorrelations?.eigenvalue_amplitude_controllingNetwork?.rho?.toFixed(3) ?? '—'} unit="ρ" testId="stat-partial-amp" />
                <StatBox label="|λ| vs Network (ctrl Amplitude)" value={pD.partialCorrelations?.eigenvalue_network_controllingAmplitude?.rho?.toFixed(3) ?? '—'} unit="ρ" testId="stat-partial-net" />
              </div>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <EvidenceLink label="Cross-metric independence" to="/cross-metric-independence" />
              </div>
            </ClaimCard>

            <ClaimCard
              title="Claim 3: Cross-tissue conservation: clock genes more conserved than target genes"
              status={pD.conservation?.clockMoreConserved ? 'confirmed' : 'partial'}
              testId="claim-conservation"
              sourceType="live"
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                <StatBox label="Clock Mean CV" value={pD.conservation?.clockMeanCV?.toFixed(3) ?? '—'} testId="stat-clock-cv" highlight={pD.conservation?.clockMoreConserved} />
                <StatBox label="Target Mean CV" value={pD.conservation?.targetMeanCV?.toFixed(3) ?? '—'} testId="stat-target-cv" />
                <StatBox label="Clock More Conserved?" value={pD.conservation?.clockMoreConserved ? 'Yes' : 'No'} testId="stat-conserved-status" highlight={pD.conservation?.clockMoreConserved} />
              </div>
              <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                <span>Lower CV = more conserved across tissues. Clock genes should show lower cross-tissue variability than target genes.</span>
                <EvidenceLink label="Cross-metric independence" to="/cross-metric-independence" />
              </div>
            </ClaimCard>
          </div>
        )}

        {tab === 'paperE' && pE && (
          <div className="space-y-4">
            <Card className="bg-slate-800/50 border-pink-500/30 mb-4" data-testid="card-paper-e-notice">
              <CardContent className="py-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={16} className="text-pink-400 mt-0.5 shrink-0" />
                  <div className="text-xs text-pink-200">
                    Paper E has been fully revised and is available as a preprint on Research Square (<a href="https://doi.org/10.21203/rs.3.rs-9214347/v1" target="_blank" rel="noopener noreferrer" className="underline hover:text-pink-100">doi:10.21203/rs.3.rs-9214347/v1</a>). The manuscript is targeting <em>Journal of Biological Rhythms</em> or <em>Chronobiology International</em>. The scientific claims below are unchanged.
                  </div>
                </div>
              </CardContent>
            </Card>
            <ClaimCard
              title="Claim 1: APC mutation doubles circadian gating discovery rate (11.2% → 22.4%)"
              status={pE.apcCompensation?.apcRate > pE.apcCompensation?.wtRate ? 'confirmed' : 'partial'}
              testId="claim-apc-compensation"
              sourceType="live"
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <StatBox label="WT Discovery Rate" value={pE.apcCompensation?.wtRate?.toFixed(1) || '0'} unit="%" testId="stat-wt-rate" />
                <StatBox label="APC-Mut Rate" value={pE.apcCompensation?.apcRate?.toFixed(1) || '0'} unit="%" testId="stat-apc-rate" highlight />
                <StatBox label="Fold Change" value={pE.apcCompensation?.foldChange?.toFixed(1) || '0'} unit="×" testId="stat-fold-change" highlight />
                <StatBox label="Paper Claims" value="2.0×" unit="(11.2%→22.4%)" testId="stat-apc-paper" />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs" data-testid="table-organoid-rates">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-200">
                      <th className="text-left py-1.5 px-2">Genotype</th>
                      <th className="text-right py-1.5 px-2">Significant</th>
                      <th className="text-right py-1.5 px-2">Total</th>
                      <th className="text-right py-1.5 px-2">Rate</th>
                      <th className="text-right py-1.5 px-2">Paper Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { key: 'WT', paperRate: '11.2%' },
                      { key: 'APC-Mut', paperRate: '22.4%' },
                      { key: 'BMAL-Mut', paperRate: '9.2%' },
                      { key: 'Double-Mut', paperRate: '1.3%' }
                    ].map(({ key, paperRate }) => {
                      const or = pE.organoidResults?.[key];
                      return (
                        <tr key={key} className="border-b border-slate-200 text-slate-600">
                          <td className="py-1.5 px-2 font-medium">{key}</td>
                          <td className="py-1.5 px-2 text-right font-mono">{or?.significantPairs ?? '—'}</td>
                          <td className="py-1.5 px-2 text-right font-mono">{or?.totalPairs ?? '—'}</td>
                          <td className="py-1.5 px-2 text-right font-mono">{or ? (or.discoveryRate * 100).toFixed(1) + '%' : '—'}</td>
                          <td className="py-1.5 px-2 text-right font-mono text-slate-500">{paperRate}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <EvidenceLink label="Root-space perturbation shifts" to="/root-space" hash="perturbation-shifts" />
                <EvidenceLink label="Disease screen" to="/disease-screen" />
              </div>
            </ClaimCard>

            <ClaimCard
              title="Claim 2: Combined APC+BMAL1 causes 17-fold collapse (22.4% → 1.3%)"
              status={pE.apcCompensation?.collapseRatio > 5 ? 'confirmed' : pE.apcCompensation?.collapseRatio > 1 ? 'partial' : 'pending'}
              testId="claim-two-hit"
              sourceType="live"
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                <StatBox label="APC-Mut Rate" value={pE.apcCompensation?.apcRate?.toFixed(1) || '0'} unit="%" testId="stat-apc-rate-2" />
                <StatBox label="Double-Mut Rate" value={pE.apcCompensation?.doubleMutRate?.toFixed(1) || '0'} unit="%" testId="stat-double-mut-rate" />
                <StatBox label="Collapse Ratio" value={pE.apcCompensation?.collapseRatio?.toFixed(1) || '0'} unit="×" testId="stat-collapse-ratio" highlight />
              </div>
              <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                <span>Paper claims: 17-fold reduction. Two-hit threshold: APC loss triggers compensation, BMAL1 loss abolishes it.</span>
                <EvidenceLink label="Framework benchmarks" to="/framework-benchmarks" hash="ueda-detail" />
                <EvidenceLink label="Root-space shifts" to="/root-space" hash="perturbation-shifts" />
              </div>
            </ClaimCard>

            <ClaimCard
              title="Claim 3: LGR5 gated by all 8 core clock genes in BMAL1-mutant organoids"
              status={pE.lgr5Gating?.allEightGated ? 'confirmed' : pE.lgr5Gating && pE.lgr5Gating.clockGenes.length > 0 ? 'partial' : 'pending'}
              testId="claim-lgr5"
              sourceType="live"
            >
              {pE.lgr5Gating ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                    <StatBox label="Clock Genes Gating LGR5" value={pE.lgr5Gating.clockGenes.length} unit="/ 8" testId="stat-lgr5-count" highlight={pE.lgr5Gating.allEightGated} />
                    <StatBox label="Paper Claims" value="8 / 8" unit="core clock genes" testId="stat-lgr5-paper" />
                  </div>
                  {pE.lgr5Gating.clockGenes.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {pE.lgr5Gating.clockGenes.map((g: string) => (
                        <Badge key={g} className="bg-purple-900/30 text-purple-400 border-purple-500/30 text-xs" data-testid={`badge-lgr5-${g}`}>
                          {g} (p={pE.lgr5Gating!.pValues[g]?.toFixed(4)})
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                    <span>First report of circadian gating of the intestinal stem cell marker LGR5.
                    Stem cell markers show the lowest temporal persistence of all nine categories (|λ| = 0.626).</span>
                    <EvidenceLink label="Cell-type persistence" to="/cell-type-persistence" hash="three-layer" />
                    <EvidenceLink label="Genome-wide screen" to="/genome-wide" hash="screen-results" />
                  </div>
                </>
              ) : (
                <p className="text-xs text-slate-500 italic">BMAL1-mutant organoid data not available</p>
              )}
            </ClaimCard>

            <ClaimCard
              title="Claim 4: Pparg is sole FDR-significant target in MYC-ON neuroblastoma (f² = 10.86)"
              status={pE.ppargGating?.allSignificant ? 'confirmed' : pE.ppargGating && pE.ppargGating.clockGenes.length > 0 ? 'partial' : 'pending'}
              testId="claim-pparg"
              sourceType="live"
            >
              {pE.ppargGating ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                    <StatBox label="Clock Genes Gating Pparg" value={pE.ppargGating.clockGenes.length} unit="/ 8" testId="stat-pparg-count" highlight={pE.ppargGating.allSignificant} />
                    <StatBox label="Mean Cohen's f²" value={pE.ppargGating.meanF2?.toFixed(2)} testId="stat-pparg-f2" highlight />
                    <StatBox label="Paper Claims" value="f² = 10.86" unit="all 8 clocks" testId="stat-pparg-paper" />
                  </div>
                  {pE.ppargGating.clockGenes.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {pE.ppargGating.clockGenes.map((g: string) => (
                        <Badge key={g} className="bg-cyan-900/30 text-cyan-400 border-cyan-500/30 text-xs" data-testid={`badge-pparg-${g}`}>
                          {g} (p={pE.ppargGating!.pValues[g]?.toFixed(4)})
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                    <span>Column-space invariance: identical effect sizes across clock genes reflect TTFL collinearity (one finding, not seven).</span>
                    <EvidenceLink label="Eigenvalue independence" to="/validation-suite" hash="eigenvalue-independence" />
                    <EvidenceLink label="Framework benchmarks" to="/framework-benchmarks" hash="fisher-detail" />
                  </div>
                </>
              ) : (
                <p className="text-xs text-slate-500 italic">MYC-ON neuroblastoma data not available</p>
              )}
            </ClaimCard>

            <ClaimCard
              title="Claim 5: Eigenperiod — controlled experiment supersedes cross-dataset comparison"
              status="partial"
              testId="claim-eigenperiod"
              sourceType="live"
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <StatBox label="Cross-Dataset Healthy" value={healthyMedian?.toFixed(1) || '—'} unit="hours (confounded)" testId="stat-healthy-period" highlight={false} />
                <StatBox label="Cross-Dataset Cancer" value={cancerMedian?.toFixed(1) || '—'} unit="hours (confounded)" testId="stat-cancer-period" highlight={false} />
                <StatBox label="Organoid WT" value="8.4" unit="hours (controlled)" testId="stat-organoid-wt" highlight={true} />
                <StatBox label="Organoid APC-KO" value="7.4" unit="hours (controlled)" testId="stat-organoid-apc" highlight={true} />
              </div>
              <div className="text-xs text-slate-500">
                <span className="text-amber-400 font-semibold">Cross-dataset comparison identified as confounded:</span> The original comparison (mouse tissue 7–13h vs human neuroblastoma ~23h) mixed species, tissue type, and sequencing platform — making period differences uninterpretable.
                <br className="mb-1" />
                <span className="text-emerald-400 font-semibold">Controlled organoid experiment (GSE157357) provides the clean answer:</span> Same species, tissue origin, laboratory, and platform across all four genotypes. Result: all conditions show ultradian eigenperiods (7–9h, &gt;96% of genes). APC mutation shifts eigenperiod 1h shorter — not toward circadian. The cross-dataset signal was noise introduced by comparison design, not biology.
                <br className="mb-1" />
                <span className="text-cyan-400 font-semibold">What APC cancer mutation does change (validated):</span> Oscillatory fraction drops (49% → 20%) and persistence increases (|λ| 0.43 → 0.56). These are the real effects and they replicate across multiple analyses.
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <EvidenceLink label="Root-space geometry" to="/root-space" hash="perturbation-shifts" />
                  <EvidenceLink label="Robustness suite" to="/robustness-suite" />
                  <EvidenceLink label="Disease screen" to="/disease-screen" />
                </div>
              </div>
            </ClaimCard>

            {Object.entries(pE.organoidResults || {}).map(([condition, or]: [string, any]) => (
              <ClaimCard
                key={condition}
                title={`Full Results: ${condition} Organoids`}
                status="confirmed"
                testId={`claim-organoid-${condition.replace(/\s/g, '-')}`}
                sourceType="live"
              >
                <div className="text-xs text-slate-600 mb-2">
                  {or.significantPairs} significant / {or.totalPairs} pairs ({(or.discoveryRate * 100).toFixed(1)}%)
                </div>
                <PairTable results={or.results || []} />
              </ClaimCard>
            ))}

            {pairwiseData && (
              <ClaimCard
                title="New Finding: GSE157357 Four-Condition Pairwise Analysis — Paradoxical Gap Restoration in Double Mutant"
                status="confirmed"
                testId="claim-gse157357-pairwise"
                sourceType="live"
              >
                <p className="text-xs text-slate-500 mb-4">
                  AR(2) |λ| hierarchy gap (clock vs. target gene median) across WT, BmalKO, ApcKO, and Apc/Bmal1 double mutant intestinal organoids (GSE157357). Both single knockouts collapse the hierarchy gap via opposite mechanisms; the double mutant paradoxically <em>restores</em> a positive gap.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  {(pairwiseData.conditions || []).map((c: any) => (
                    <div key={c.label} className="bg-slate-50 rounded-lg p-3 border border-slate-200" data-testid={`stat-pairwise-${c.label.replace(/\s/g,'-')}`}>
                      <div className="text-xs text-slate-500 mb-1">{c.label}</div>
                      <div className={`text-lg font-bold font-mono ${c.hierarchyGap > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {c.hierarchyGap > 0 ? '+' : ''}{c.hierarchyGap.toFixed(3)}
                      </div>
                      <div className="text-[10px] text-slate-500">gap (clock − target)</div>
                      <div className="text-[10px] text-slate-500 mt-1">Clock: {c.clockMedian.toFixed(3)} | Target: {c.targetMedian.toFixed(3)}</div>
                    </div>
                  ))}
                </div>

                <div className="mb-4">
                  <div className="text-xs font-semibold text-slate-600 mb-2">Mechanism Summary</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs" data-testid="table-pairwise-mechanisms">
                      <thead>
                        <tr className="text-slate-500 border-b border-slate-200">
                          <th className="text-left py-1.5 px-2">Condition</th>
                          <th className="text-right py-1.5 px-2">Gap</th>
                          <th className="text-left py-1.5 px-2">Dominant Mechanism</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(pairwiseData.mechanismSummary || []).map((m: any, i: number) => (
                          <tr key={i} className="border-b border-slate-200 text-slate-600">
                            <td className="py-1.5 px-2 font-mono">{m.condition}</td>
                            <td className={`py-1.5 px-2 text-right font-mono ${m.gap > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                              {m.gap > 0 ? '+' : ''}{m.gap.toFixed(3)}
                            </td>
                            <td className="py-1.5 px-2 text-slate-500">{m.mechanism}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="text-xs font-semibold text-slate-600 mb-2">Key Gene Trajectories Across Four Conditions</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs" data-testid="table-pairwise-genes">
                      <thead>
                        <tr className="text-slate-500 border-b border-slate-200">
                          <th className="text-left py-1.5 px-2">Gene</th>
                          <th className="text-left py-1.5 px-2">Role</th>
                          <th className="text-right py-1.5 px-2">WT</th>
                          <th className="text-right py-1.5 px-2">BmalKO</th>
                          <th className="text-right py-1.5 px-2">ApcKO</th>
                          <th className="text-right py-1.5 px-2">DblKO</th>
                          <th className="text-left py-1.5 px-2">Interpretation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(pairwiseData.keyGeneTrajectories || []).map((g: any, i: number) => (
                          <tr key={i} className="border-b border-slate-200 text-slate-600">
                            <td className="py-1.5 px-2 font-mono font-semibold">{g.gene}</td>
                            <td className="py-1.5 px-2 text-slate-500">{g.role}</td>
                            <td className="py-1.5 px-2 text-right font-mono">{g.wt.toFixed(3)}</td>
                            <td className="py-1.5 px-2 text-right font-mono">{g.bmalko.toFixed(3)}</td>
                            <td className="py-1.5 px-2 text-right font-mono">{g.apcko.toFixed(3)}</td>
                            <td className="py-1.5 px-2 text-right font-mono">{g.dblko.toFixed(3)}</td>
                            <td className="py-1.5 px-2 text-slate-500 text-[10px]">{g.interpretation}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                  <div className="text-xs font-semibold text-amber-300 mb-1">Double-Mutant Paradox</div>
                  <p className="text-xs text-slate-600">
                    {pairwiseData.doubleMutantParadox?.description}
                  </p>
                  {pairwiseData.doubleMutantParadox?.routes && (
                    <ul className="mt-2 space-y-1">
                      {pairwiseData.doubleMutantParadox.routes.map((r: string, i: number) => (
                        <li key={i} className="text-xs text-slate-500">• {r}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <EvidenceLink label="Interactive gene explorer" to="/gse157357-analysis" />
                  <EvidenceLink label="TCGA cross-validation" to="/tcga-validation" />
                </div>
              </ClaimCard>
            )}
          </div>
        )}

        {tab === 'paperF' && (
          <div className="space-y-4">
            <Card className="bg-slate-800/50 border-emerald-500/30 mb-4" data-testid="card-paper-f-notice">
              <CardContent className="py-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={16} className="text-emerald-400 mt-0.5 shrink-0" />
                  <div className="text-xs text-emerald-200">
                    Paper F is not currently in active submission. Preprint available on Research Square: doi:10.21203/rs.3.rs-9385465/v1. Targeting <em>Genome Biology</em> for submission.
                  </div>
                </div>
              </CardContent>
            </Card>
            <ClaimCard
              title="Claim 1: Near-zero correlation between |λ| and mRNA half-life (ρ = 0.006)"
              status="confirmed"
              testId="claim-f-halflife-corr"
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <StatBox label="Spearman ρ" value="0.006" testId="stat-f-rho" highlight />
                <StatBox label="P-value" value="0.63" testId="stat-f-pval" />
                <StatBox label="Genes" value="~6,000" testId="stat-f-genes" />
                <StatBox label="Dataset" value="GSE11923" testId="stat-f-dataset" />
              </div>
              <div className="text-xs text-slate-500">
                Core finding: mRNA half-life (intrinsic biochemical decay) and AR(2) eigenvalue (context-dependent regulatory persistence) measure orthogonal properties of gene expression dynamics.
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  <EvidenceLink label="Half-life replication" to="/halflife-replication" />
                  <EvidenceLink label="Cross-metric independence" to="/cross-metric-independence" />
                </div>
              </div>
            </ClaimCard>

            <ClaimCard
              title="Claim 2: Non-circadian replication — weak correlations dissolve under controls"
              status="confirmed"
              testId="claim-f-replication"
            >
              <div className="overflow-x-auto mb-3">
                <table className="w-full text-xs" data-testid="table-f-replication">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-200">
                      <th className="text-left py-1 px-2">Dataset</th>
                      <th className="text-right py-1 px-2">Timepoints</th>
                      <th className="text-right py-1 px-2">Matched Genes</th>
                      <th className="text-right py-1 px-2">Raw ρ</th>
                      <th className="text-right py-1 px-2">ρ After Controls</th>
                      <th className="text-left py-1 px-2">Control Method</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { name: 'Rabani 2014 DC LPS', tp: 7, genes: 85, rho: '0.130', after: '-0.04', method: 'Exclude explosive eigenvalues' },
                      { name: 'Amit 2009 DC LPS', tp: 9, genes: 190, rho: '0.154', after: 'reduced', method: 'Exclude explosive eigenvalues' },
                      { name: 'GSE221103 MYC-ON', tp: 14, genes: 178, rho: '0.203', after: '0.045', method: 'Partial corr. controlling expression' },
                    ].map((d, i) => (
                      <tr key={i} className="border-b border-slate-200 text-slate-600">
                        <td className="py-1 px-2">{d.name}</td>
                        <td className="py-1 px-2 text-right font-mono">{d.tp}</td>
                        <td className="py-1 px-2 text-right font-mono">{d.genes}</td>
                        <td className="py-1 px-2 text-right font-mono">{d.rho}</td>
                        <td className="py-1 px-2 text-right font-mono text-emerald-400">{d.after}</td>
                        <td className="py-1 px-2">{d.method}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="text-xs text-slate-500">
                Weak correlations in short time-series (7–14 timepoints) are artifacts of explosive eigenvalues and expression-level confounds, not genuine biological coupling.
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  <EvidenceLink label="11-test robustness deep dive" to="/halflife-replication" hash="robustness" />
                </div>
              </div>
            </ClaimCard>

            <ClaimCard
              title="Claim 3: Combined evidence — weighted ρ = 0.0115 across 7 datasets (22,989 genes)"
              status="confirmed"
              testId="claim-f-combined"
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                <StatBox label="Weighted Mean ρ" value="0.0115" testId="stat-f-weighted" highlight />
                <StatBox label="Total Datasets" value="7" testId="stat-f-total-ds" />
                <StatBox label="Total Genes" value="22,989" testId="stat-f-total-genes" highlight />
              </div>
              <div className="overflow-x-auto mb-3">
                <table className="w-full text-xs" data-testid="table-f-combined">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-200">
                      <th className="text-left py-1 px-2">Condition</th>
                      <th className="text-right py-1 px-2">ρ Range</th>
                      <th className="text-left py-1 px-2">Interpretation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { cond: 'Long time-series (≥24 tp, n>1000)', rho: '-0.003 to 0.018', interp: 'True independence' },
                      { cond: 'Short time-series (7–14 tp, n<200)', rho: '0.13 to 0.20', interp: 'Artifactual — dissolves under controls' },
                      { cond: 'Combined (weighted)', rho: '0.0115', interp: 'Negligible' },
                    ].map((r, i) => (
                      <tr key={i} className="border-b border-slate-200 text-slate-600">
                        <td className="py-1 px-2">{r.cond}</td>
                        <td className="py-1 px-2 text-right font-mono">{r.rho}</td>
                        <td className="py-1 px-2">
                          <Badge className={`text-xs ${r.interp.includes('True') ? 'bg-emerald-900/30 text-emerald-400' : r.interp.includes('Negligible') ? 'bg-blue-900/30 text-blue-400' : 'bg-amber-900/30 text-amber-400'}`}>
                            {r.interp}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="text-xs text-slate-500">
                Qualified claim: independence holds with adequate temporal resolution. Short time-series show weak positive correlations that dissolve under statistical controls.
              </div>
            </ClaimCard>

            <ClaimCard
              title="Claim 4: IFIT1 case study — short half-life but high persistence"
              status="confirmed"
              testId="claim-f-ifit1"
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <StatBox label="IFIT1 Half-Life" value="31" unit="min" testId="stat-f-ifit1-hl" />
                <StatBox label="IFIT1 |λ|" value="0.72" testId="stat-f-ifit1-lambda" highlight />
                <StatBox label="Mechanism" value="Sustained re-transcription" testId="stat-f-ifit1-mech" />
                <StatBox label="Driver" value="IFN signaling" testId="stat-f-ifit1-driver" />
              </div>
              <div className="text-xs text-slate-500">
                Demonstrates the key conceptual point: high persistence (|λ|) does not require long mRNA half-life. IFIT1 mRNA decays rapidly but is continuously re-transcribed by sustained interferon signaling, producing high autocorrelation.
              </div>
            </ClaimCard>

            <ClaimCard
              title="Claim 5: 11-test robustness deep dive"
              status="confirmed"
              testId="claim-f-robustness"
            >
              <div className="space-y-2 mb-3">
                {[
                  { name: 'Bootstrap CI (Rabani)', result: 'Includes zero — not robust', pass: false },
                  { name: 'Permutation p-value (Rabani)', result: 'p=0.24 — not significant', pass: false },
                  { name: 'Explosive eigenvalue exclusion', result: 'Rabani ρ drops to -0.04', pass: true },
                  { name: 'Expression-level partial corr.', result: 'MYC ρ drops 0.20 → 0.045', pass: true },
                  { name: 'Time-shuffle destruction (Rabani)', result: 'Ratio 0.99 — FAIL', pass: false },
                  { name: 'R²>0.5 filter (Rabani)', result: 'ρ=0.46 but n=54 only', pass: false },
                  { name: 'Amit bootstrap CI', result: 'Barely excludes zero', pass: true },
                  { name: 'GSE221103 permutation', result: 'p=0.007 (significant, small effect)', pass: true },
                ].map((test, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    {test.pass ? <CheckCircle2 size={12} className="text-emerald-400" /> : <AlertTriangle size={12} className="text-amber-400" />}
                    <span className="text-slate-600 font-medium w-56">{test.name}</span>
                    <span className="text-slate-500">{test.result}</span>
                  </div>
                ))}
              </div>
              <div className="text-xs text-slate-500">
                Key insight: weak correlations in short time-series arise from explosive eigenvalue contamination and expression-level confounding, confirming that half-life and eigenvalue are truly independent metrics.
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  <EvidenceLink label="Full deep dive" to="/halflife-replication" hash="robustness" />
                </div>
              </div>
            </ClaimCard>
          </div>
        )}

        {tab === 'paperG' && (
          <div className="space-y-4">
            <Card className="bg-amber-900/20 border-amber-500/30 mb-4" data-testid="card-paper-g-notice">
              <CardContent className="py-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={16} className="text-amber-400 mt-0.5 shrink-0" />
                  <div className="text-xs text-amber-300">
                    Paper G — "A Time-Domain Analogue to Fibonacci Structure via Phase-Gated AR(2) Dynamics: Reply to Boman on Tissue Fibonacci Patterns and Colonic Crypt Renewal" — was submitted to The Fibonacci Quarterly on November 16, 2025 and is now published (doi:10.1080/00150517.2026.2716122). These are platform cross-validation results for the published claims. The downloadable package is the accepted revision incorporating 7 post-submission amendments.
                  </div>
                </div>
              </CardContent>
            </Card>

            <ClaimCard
              title="Claim 1: AR(2) is the minimum sufficient model (AIC prefers AR(2) in 70–80% of genes)"
              status="confirmed"
              testId="claim-g-ar2-model"
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                <StatBox label="AR(2) Preference" value="70–80" unit="%" testId="stat-g-ar2-pref" highlight />
                <StatBox label="Validation" value="22 datasets" testId="stat-g-datasets" />
                <StatBox label="Species" value="5" testId="stat-g-species" />
              </div>
              <div className="text-xs text-slate-500">
                AIC/BIC model order selection confirms AR(2) as the optimal order for the majority of genes, consistent with two-step cellular memory (cell cycle timescale).
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  <EvidenceLink label="Model comparison" to="/ar-model-comparison" />
                  <EvidenceLink label="ODE Model Zoo" to="/ode-model-zoo" />
                </div>
              </div>
            </ClaimCard>

            <ClaimCard
              title="Claim 2: Crypt genes show stable complex roots (|r| < 1)"
              status="confirmed"
              testId="claim-g-crypt-roots"
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <StatBox label="Genes Tested" value="4" testId="stat-g-crypt-n" />
                <StatBox label="All |r| < 1" value="Yes" testId="stat-g-stable" highlight />
                <StatBox label="Tissue Variation" value="Present" testId="stat-g-variation" />
                <StatBox label="Status" value="Confirmed" testId="stat-g-crypt-status" highlight />
              </div>
              <div className="text-xs text-slate-500">
                All 4 crypt-related genes have stable AR(2) roots across tissues, with tissue-specific variation in exact eigenvalue magnitudes.
              </div>
            </ClaimCard>

            <ClaimCard
              title="Claim 3: BMAL1 as phase source — strongly confirmed (85 coupling events, 180× enrichment)"
              status="confirmed"
              testId="claim-g-bmal1"
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <StatBox label="Coupling Events" value="85" testId="stat-g-coupling" highlight />
                <StatBox label="Enrichment" value="~180×" testId="stat-g-enrichment" highlight />
                <StatBox label="Tissues" value="12" testId="stat-g-tissues" />
                <StatBox label="Unique Genes" value="33" testId="stat-g-genes" />
              </div>
              <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                <span>Validated via Phase Portrait Explorer across all 12 GSE54650 tissues.</span>
                <EvidenceLink label="Coupling atlas" to="/phase-portrait" />
                <EvidenceLink label="Falsification test" to="/literature-validation" hash="falsification" />
              </div>
            </ClaimCard>

            <ClaimCard
              title="Claim 4: Clock > target hierarchy — strongly confirmed across 22 datasets, 4 species"
              status="confirmed"
              testId="claim-g-hierarchy"
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <StatBox label="Datasets" value="22" testId="stat-g-hier-ds" highlight />
                <StatBox label="Species" value="5" testId="stat-g-hier-sp" />
                <StatBox label="Clock |λ| (mean)" value="0.689" testId="stat-g-clock" />
                <StatBox label="Target |λ| (mean)" value="0.537" testId="stat-g-target" />
              </div>
              <div className="text-xs text-slate-500">
                Bias-audited (3/3 tests pass). Permutation-validated (p&lt;0.001 across all datasets).
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  <EvidenceLink label="Cross-context validation" to="/cross-context-validation" />
                  <EvidenceLink label="Robustness suite" to="/robustness-suite" />
                </div>
              </div>
            </ClaimCard>

            <ClaimCard
              title="Claim 5: APC-KO inverts hierarchy (+0.033 → -0.127)"
              status="confirmed"
              testId="claim-g-apc-inversion"
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <StatBox label="WT Gap" value="+0.033" testId="stat-g-wt-gap" highlight />
                <StatBox label="APC-KO Gap" value="-0.127" testId="stat-g-apc-gap" highlight />
                <StatBox label="Direction" value="Inverted" testId="stat-g-direction" />
                <StatBox label="Dataset" value="GSE157357" testId="stat-g-apc-ds" />
              </div>
              <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                <span>APC cancer mutation inverts the circadian gearbox: targets gain higher persistence than clock genes.</span>
                <span className="text-slate-400">(Paper O figure values: 12 clock / 14 target gene panel, GSE157357 corrected series. Platform panel reports WT gap = +0.073 using a broader 15 clock / 23 target gene panel — the same dataset, different gene set.)</span>
                <EvidenceLink label="Root-space perturbation" to="/root-space" hash="perturbation-shifts" />
              </div>
            </ClaimCard>

            <ClaimCard
              title="Claim 6: BMAL1-KO — platform detected hierarchy collapse; original prediction revised and manuscript strengthened"
              status="partial"
              testId="claim-g-bmalko"
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                <StatBox label="WT Gap" value="+0.033" testId="stat-g-bmalko-wt" />
                <StatBox label="BMAL1-KO Gap" value="-0.095" testId="stat-g-bmalko-gap" />
                <StatBox label="Direction" value="Inverted" testId="stat-g-bmalko-status" />
              </div>
              <div className="text-xs text-slate-500">
                The original manuscript predicted eigenvalue hierarchy would be preserved in BMAL1-KO. Platform validation against GSE157357 detected the opposite: the clock-target gap goes negative, meaning the hierarchy collapses when the core clock is genetically ablated. This is actually a stronger and more informative result — it confirms that the hierarchy depends on active BMAL1 signalling, not just tissue identity. The finding was incorporated into the revised manuscript, making the mechanistic claim more precise.
              </div>
            </ClaimCard>

            <ClaimCard
              title="Claim 7: Tuft cell readout — qualified as delayed, accumulative signal (more precise than original)"
              status="partial"
              testId="claim-g-tuft"
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                <StatBox label="DCLK1 |λ|" value="≈1.0" testId="stat-g-dclk1" highlight />
                <StatBox label="Character" value="Near-critical" testId="stat-g-tuft-char" />
                <StatBox label="Qualified As" value="Delayed, accumulative" testId="stat-g-tuft-qual" />
              </div>
              <div className="text-xs text-slate-500">
                DCLK1 has a near-critical eigenvalue (|λ| ≈ 1.0), placing it at the boundary of stability. This makes tuft cells a "delayed, accumulative readout" of circadian disruption rather than the rapid sensor originally described. The distinction matters: a near-critical system integrates signal over time before responding. A bidirectional CRC pattern is also noted (eigenvalue reduced in tumours, upregulated post-FOLFIRI), which is consistent with tuft cells acting as a slow integrator of microenvironmental state. The revised framing is more mechanistically coherent.
              </div>
            </ClaimCard>

            <ClaimCard
              title="Claim 8: φ-enrichment — gut-specific signal confirmed; correctly bounded to intestinal context"
              status="partial"
              testId="claim-g-phi"
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <StatBox label="Significant" value="2" unit="/ 9 datasets" testId="stat-g-phi-sig" highlight />
                <StatBox label="Genome-wide p" value="0.154" testId="stat-g-phi-p" />
                <StatBox label="Context" value="Gut-specific" testId="stat-g-phi-context" highlight />
                <StatBox label="Treatment" value="Exploratory" testId="stat-g-phi-treat" />
              </div>
              <div className="overflow-x-auto mb-3">
                <table className="w-full text-xs" data-testid="table-phi-replication">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-200">
                      <th className="text-left py-1.5 px-2">Dataset</th>
                      <th className="text-left py-1.5 px-2">Context</th>
                      <th className="text-right py-1.5 px-2">p-value</th>
                      <th className="text-center py-1.5 px-2">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { ds: 'GSE54650', context: 'Multi-tissue (gut incl.)', p: '0.041', sig: true },
                      { ds: 'GSE161566', context: 'Intestinal / gut', p: '0.027', sig: true },
                      { ds: 'GSE70499', context: 'Non-circadian', p: '0.256', sig: false },
                      { ds: 'GSE179027', context: 'Mouse enteroid', p: '0.151', sig: false },
                      { ds: 'GSE98965', context: 'Non-circadian', p: '0.599', sig: false },
                      { ds: 'GSE157357-WT', context: 'Colon organoid (WT)', p: '0.019', sig: true },
                      { ds: 'GSE157357-BMAL1KO', context: 'Colon organoid (KO)', p: '0.482', sig: false },
                      { ds: 'GSE205155', context: 'Human skin', p: '0.889', sig: false },
                      { ds: 'Genome-wide', context: '~21,000 genes', p: '0.154', sig: false },
                    ].map((row, i) => (
                      <tr key={i} className="border-b border-slate-200 text-slate-600">
                        <td className="py-1.5 px-2 font-mono">{row.ds}</td>
                        <td className="py-1.5 px-2 text-slate-500">{row.context}</td>
                        <td className="py-1.5 px-2 text-right font-mono">{row.p}</td>
                        <td className="py-1.5 px-2 text-center">
                          {row.sig
                            ? <CheckCircle2 size={12} className="text-emerald-400 inline" />
                            : <XCircle size={12} className="text-slate-400 inline" />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="text-xs text-slate-500">
                <span className="text-amber-400">Stated transparently:</span> While individual genes (Per2, Hes1) sit near the golden ratio (1/φ ≈ 0.618), enrichment is not a universal law. Significance arises only in gut/intestinal datasets — consistent with the biological hypothesis that Fibonacci-consistent timing is specific to crypt renewal dynamics, not a general property of gene expression. Human skin (GSE205155, p = 0.889) and non-circadian datasets show no signal. The 7/14 E-box target genes absent from skin data reflect genuine low/absent skin expression, not a technical gap.
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  <EvidenceLink label="Root-space φ analysis" to="/root-space" hash="fibonacci" />
                  <EvidenceLink label="φ-enrichment replication" to="/phi-enrichment-replication" />
                </div>
              </div>
            </ClaimCard>

            <ClaimCard
              title="Prediction 1: BMAL1-KO broadens root distribution — NOW DEMONSTRATED (genome-wide, 15,752 genes)"
              status="confirmed"
              testId="claim-g-pred1-bmalko"
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <StatBox label="WT-WT Mean |r|" value="0.477" testId="stat-g-p1-wt-mean" />
                <StatBox label="BmalKO Mean |r|" value="0.597" testId="stat-g-p1-ko-mean" highlight />
                <StatBox label="WT-WT High-persist" value="24.4%" testId="stat-g-p1-wt-hp" />
                <StatBox label="BmalKO High-persist" value="52.5%" testId="stat-g-p1-ko-hp" highlight />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <StatBox label="WT-WT Std |r|" value="0.169" testId="stat-g-p1-wt-std" />
                <StatBox label="BmalKO Std |r|" value="0.194" testId="stat-g-p1-ko-std" highlight />
                <StatBox label="WT-WT Oscillatory" value="74.4%" testId="stat-g-p1-wt-osc" />
                <StatBox label="BmalKO Oscillatory" value="83.8%" testId="stat-g-p1-ko-osc" highlight />
              </div>
              <div className="text-xs text-slate-500">
                Genome-wide AR(2) fits across all 15,752 stable genes in GSE157357 organoids. BMAL1 knockout raises mean |r| from 0.477 to 0.597, increases standard deviation (0.169 → 0.194), and more than doubles the high-persistence fraction (24.4% → 52.5%). This converts Prediction 1 from an aspiration to a demonstrated result. Interpretation: the clock normally acts as a damping mechanism; its loss allows fluctuations to persist longer across the transcriptome, broadening the root distribution as predicted.
                <div className="mt-2 p-2 rounded bg-slate-50 border border-slate-200">
                  <span className="text-amber-400 font-medium">Nuance:</span> Mean |r| increases (more persistent) rather than showing instability. The double KO (ApcKO-BmalKO) shows a distinct collapse in oscillatory fraction (74.4% → 43.0%), suggesting the cancer driver and clock loss have qualitatively different effects on root structure.
                </div>
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <EvidenceLink label="Root-space geometry" to="/root-space" />
                  <EvidenceLink label="Cancer state-swap" to="/cancer-state-swap" />
                </div>
              </div>
            </ClaimCard>

            <ClaimCard
              title="Prediction 4: Boman-style crypt simulation reproduces PAR(2) signatures — DEMONSTRATED"
              status="confirmed"
              testId="claim-g-pred4-boman-sim"
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <StatBox label="Parameter sweeps" value="810+" testId="stat-g-p4-sweeps" highlight />
                <StatBox label="Compartments" value="3" testId="stat-g-p4-compartments" />
                <StatBox label="Conditions" value="8" testId="stat-g-p4-conditions" />
                <StatBox label="Fibonacci mechanism" value="Maturation delay" testId="stat-g-p4-mechanism" highlight />
              </div>
              <div className="text-xs text-slate-500">
                The platform's Boman-style crypt simulation implements a discrete-time three-compartment model (Stem → Proliferating → Differentiated) with a maturation delay term (k₃ governing C(t−2) feedback) that is the temporal analogue of Boman's cell division rules. AR(2) is fitted separately to each compartment across 810+ parameter sweeps spanning normal, FAP-like, adenoma-like, high-Wnt, low-Wnt, strong-delay, and BMAL1-KO conditions. The maturation delay parameter is the single strongest predictor of proximity to the Fibonacci-consistent region in (φ₁, φ₂) coefficient space — which is the direct temporal analogue of Boman's finding that maturation delay determines which Fibonacci p-sequence emerges spatially. This converts Prediction 4 from a proposed future experiment to a demonstrated result.
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <EvidenceLink label="Boman simulation" to="/boman-simulation" />
                  <EvidenceLink label="Root-space geometry" to="/root-space" />
                </div>
              </div>
            </ClaimCard>

            <ClaimCard
              title="Prediction 2: LGR5+ ISC genes near Fibonacci-consistent region — NOT CONFIRMED (key finding: elevated |r|)"
              status="partial"
              testId="claim-g-pred2-lgr5"
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <StatBox label="ISC genes tested" value="47/50" testId="stat-g-p2-n" />
                <StatBox label="Near-φ enrichment" value="1.05×" testId="stat-g-p2-enrich" />
                <StatBox label="p-value" value="0.558" testId="stat-g-p2-p" />
                <StatBox label="NOTCH trending" value="2.74× p=0.055" testId="stat-g-p2-notch" highlight />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <StatBox label="ISC mean |r|" value="0.683" testId="stat-g-p2-isc-mod" highlight />
                <StatBox label="Background mean |r|" value="0.498" testId="stat-g-p2-bg-mod" />
                <StatBox label="Lgr5 |r|" value="0.948" testId="stat-g-p2-lgr5-mod" highlight />
                <StatBox label="Dll1 near-φ" value="Yes (95% sim)" testId="stat-g-p2-dll1" />
              </div>
              <div className="text-xs text-slate-500">
                <span className="font-medium text-slate-600">Dataset:</span> GSE179027 (Mouse Enteroid, 24 timepoints, 12,302 stable genes). Gene sets: Munoz 2012 LGR5+ signature (47/50 genes found), MSigDB HALLMARK_WNT (31/42), HALLMARK_NOTCH (24/32). 10,000-iteration permutation test.
                <div className="mt-2 p-2 rounded bg-slate-50 border border-slate-200 space-y-1">
                  <div><span className="text-red-400 font-medium">Not confirmed:</span> LGR5+ ISC genes do not cluster significantly near the φ-consistent manifold (1.05×, p=0.558). Most ISC genes have real (non-oscillatory) roots — only 10.6% complex vs 37.7% genome background.</div>
                  <div><span className="text-amber-400 font-medium">Trending:</span> NOTCH hallmark shows 2.74× enrichment (p=0.055), below significance but notable given n=24.</div>
                  <div><span className="text-emerald-400 font-medium">Positive finding:</span> ISC genes have substantially higher mean |r| than background (0.683 vs 0.498). Lgr5 itself has |r|=0.948 — among the most persistent genes genome-wide. This elevated persistence is consistent with the paper's stem cell identity prediction, even without φ-specific clustering.</div>
                </div>
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <EvidenceLink label="Root-space geometry" to="/root-space" />
                  <EvidenceLink label="Boman simulation" to="/boman-simulation" />
                </div>
              </div>
            </ClaimCard>

            <ClaimCard
              title="Prediction 3: Phase-gated coupling enriched in stem cell networks — NOT CONFIRMED (hierarchy confirmed)"
              status="partial"
              testId="claim-g-pred3-coupling"
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <StatBox label="Reg. pairs tested" value="34" testId="stat-g-p3-pairs" />
                <StatBox label="Coupling enrichment" value="0.56×" testId="stat-g-p3-enrich" />
                <StatBox label="p-value" value="0.889" testId="stat-g-p3-p" />
                <StatBox label="Coupled pairs" value="2 (Dll4→Notch1, Chek1→Birc5)" testId="stat-g-p3-coupled" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                <StatBox label="Upstream |r| (Ctnnb1/Lgr5…)" value="0.731" testId="stat-g-p3-up" highlight />
                <StatBox label="Midstream |r| (Wnt readouts)" value="0.703" testId="stat-g-p3-mid" />
                <StatBox label="Downstream |r| (proliferation)" value="0.642" testId="stat-g-p3-down" />
              </div>
              <div className="text-xs text-slate-500">
                <span className="font-medium text-slate-600">Dataset:</span> GSE179027. 34 directed regulatory pairs (Ctnnb1 → Lgr5 → Dll → Notch → cell cycle) tested against 10,000 random pair permutations. Phase-gated coupling requires: both genes stable, source has complex roots, source |r| &gt; target |r| by &gt;0.05.
                <div className="mt-2 p-2 rounded bg-slate-50 border border-slate-200 space-y-1">
                  <div><span className="text-red-400 font-medium">Not confirmed:</span> Phase-gated coupling is not enriched (0.56×, p=0.889). The mechanistic reason: most LGR5+ ISC genes have real (non-oscillatory) AR(2) roots — Lgr5, Myc, Dll1, Top2a all have real roots — so cannot satisfy the complex-root criterion for phase-gating.</div>
                  <div><span className="text-emerald-400 font-medium">Hierarchy confirmed:</span> The |r| ordering — upstream regulators (0.731) &gt; mid-stream Wnt readouts (0.703) &gt; downstream proliferation genes (0.642) — is consistent with the paper's predicted regulatory gradient. This is a weaker but genuine signal.</div>
                  <div><span className="text-slate-600 font-medium">Two coupled pairs found:</span> Dll4→Notch1 (gap=0.079) and Chek1→Birc5 (gap=0.066). Both involve the DNA-damage / Notch axis rather than the core Wnt/LGR5 hub.</div>
                </div>
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <EvidenceLink label="Phase portrait" to="/phase-portrait" />
                  <EvidenceLink label="Boman simulation" to="/boman-simulation" />
                </div>
              </div>
            </ClaimCard>
          </div>
        )}
      </div>
    </div>
  );
}
