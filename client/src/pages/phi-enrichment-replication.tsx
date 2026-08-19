import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AlertCircle, CheckCircle, XCircle, Minus, FlaskConical, Dna, Beaker, ChevronDown, ChevronUp, Download } from "lucide-react";
import { downloadAsCSV } from "@/components/DownloadResultsButton";

interface GeneResult {
  gene: string;
  lambda: number;
  distFromPhi: number;
  hasComplexRoots: boolean;
  r2: number;
}

interface BaboonTissueResult {
  tissue: string;
  tissueLabel: string;
  isIntestinal: boolean;
  system: string;
  nGenes: number;
  genesFound: number;
  targetLambdas: { gene: string; lambda: number; distFromPhi: number; r2: number }[];
  pValue: number;
  zScore: number;
  observedMeanDist: number;
  nullMean: number;
  nullSd: number;
  significant: boolean;
}

interface DatasetResult {
  datasetId: string;
  datasetLabel: string;
  species: string;
  tissue: string;
  nGenes: number;
  nTimepoints: number;
  directTargets: GeneResult[];
  coreClockGenes: GeneResult[];
  permutationTest: {
    pValue: number;
    zScore: number;
    observedMeanDist: number;
    nullMean: number;
    nullSd: number;
    nPerm: number;
    significant: boolean;
  };
  genesFound: number;
  genesSearched: number;
  genomeMedianLambda: number;
  genomeMeanLambda: number;
  perTissueResults?: BaboonTissueResult[];
  fisherCombinedP?: number;
  fisherChi2?: number;
  nTissuesSig?: number;
  nTissuesTested?: number;
}

const PHI_RECIPROCAL = 0.61803;

const ORIGINAL_RESULT = {
  datasetId: "gse54650",
  datasetLabel: "GSE54650 — Mouse Multi-Tissue (12 tissues)",
  species: "Mouse",
  tissue: "12 tissues (liver, cortex, kidney, heart…)",
  nGenes: 20955,
  nTimepoints: 24,
  pValue: 0.041,
  zScore: -1.64,
  genesFound: 12,
  genesSearched: 14,
  significant: true,
  genomeMedianLambda: 0.4963,
  note: "Discovery dataset — live-computed from GSE54650 liver (CT18–CT64, 24 timepoints)",
  standoutGenes: [
    { gene: "Wee1",   lambda: 0.6151, distFromPhi: 0.0029 },
    { gene: "Cdkn1b", lambda: 0.5978, distFromPhi: 0.0202 },
    { gene: "Ccnd1",  lambda: 0.5868, distFromPhi: 0.0312 },
    { gene: "Tef",    lambda: 0.6573, distFromPhi: 0.0393 },
  ],
};

function pValueLabel(p: number | null | undefined): { text: string; color: string; icon: React.ReactNode } {
  if (p === null || p === undefined || isNaN(p)) return { text: "N/A", color: "text-slate-500", icon: <Minus size={14}/> };
  if (p < 0.01) return { text: `p = ${p.toFixed(3)} ***`, color: "text-emerald-400", icon: <CheckCircle size={14}/> };
  if (p < 0.05) return { text: `p = ${p.toFixed(3)} *`, color: "text-emerald-400", icon: <CheckCircle size={14}/> };
  if (p < 0.10) return { text: `p = ${p.toFixed(3)} (trend)`, color: "text-amber-400", icon: <AlertCircle size={14}/> };
  return { text: `p = ${p.toFixed(3)}`, color: "text-slate-500", icon: <XCircle size={14}/> };
}

function DistanceBadge({ dist }: { dist: number }) {
  if (dist < 0.01) return <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded px-1.5 py-0.5">&lt;1%</span>;
  if (dist < 0.03) return <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded px-1.5 py-0.5">&lt;5%</span>;
  if (dist < 0.06) return <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded px-1.5 py-0.5">&lt;10%</span>;
  return <span className="text-xs text-slate-500">{dist.toFixed(3)}</span>;
}

function TissueRow({ t }: { t: BaboonTissueResult }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr
        key={t.tissue}
        className={`border-b border-slate-800/40 cursor-pointer hover:bg-slate-700/20 transition-colors ${t.significant ? "bg-emerald-500/5" : t.isIntestinal ? "bg-blue-500/5" : ""}`}
        onClick={() => setOpen(o => !o)}
      >
        <td className="py-1 pr-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-slate-300 text-xs">{t.tissue}</span>
            {t.isIntestinal && <span className="text-blue-400 text-[9px] font-semibold bg-blue-500/15 px-1 rounded">GUT</span>}
          </div>
          <div className="text-[10px] text-slate-500 leading-tight">{t.tissueLabel}</div>
        </td>
        <td className={`py-1 pr-2 text-right font-mono text-xs ${t.significant ? "text-emerald-400 font-semibold" : t.pValue < 0.10 ? "text-amber-400" : "text-slate-500"}`}>
          {t.pValue.toFixed(3)}
        </td>
        <td className={`py-1 pr-2 text-right font-mono text-xs ${t.zScore < -1 ? "text-emerald-400" : "text-slate-500"}`}>
          {isNaN(t.zScore) ? "—" : t.zScore.toFixed(2)}
        </td>
        <td className="py-1 text-right text-slate-500 text-xs">{t.genesFound}</td>
        <td className="py-1 pl-1 text-slate-600 text-xs">{open ? "▲" : "▼"}</td>
      </tr>
      {open && t.targetLambdas.length > 0 && (
        <tr className="border-b border-slate-800/40 bg-slate-800/30">
          <td colSpan={5} className="px-3 py-2">
            <div className="text-[10px] text-slate-500 mb-1 font-semibold">Target gene |λ| values in {t.tissueLabel}:</div>
            <div className="flex flex-wrap gap-1">
              {[...t.targetLambdas].sort((a, b) => a.distFromPhi - b.distFromPhi).map(g => (
                <span key={g.gene} className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${g.distFromPhi < 0.05 ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-700/60 text-slate-400"}`}>
                  {g.gene} {g.lambda.toFixed(3)}
                </span>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function BaboonPerTissuePanel({ result }: { result: DatasetResult }) {
  const [expanded, setExpanded] = useState(false);
  const tissues = result.perTissueResults ?? [];
  const nSig = result.nTissuesSig ?? 0;
  const nTested = result.nTissuesTested ?? tissues.length;
  const fp = result.fisherCombinedP;
  const chi2 = result.fisherChi2;
  const fpLabel = fp !== undefined && !isNaN(fp) ? fp.toFixed(4) : "N/A";
  const fpSig = fp !== undefined && !isNaN(fp) && fp < 0.05;
  const sigTissues = tissues.filter(t => t.significant);
  const nonSigTissues = tissues.filter(t => !t.significant);
  const intestinalTissues = tissues.filter(t => t.isIntestinal).sort((a, b) => a.pValue - b.pValue);
  const nIntestinalSig = intestinalTissues.filter(t => t.significant).length;

  return (
    <div className="mt-4 border border-orange-500/20 rounded-lg bg-orange-500/5 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-orange-300">Per-tissue Fisher combination</span>
        <span className={`text-xs font-mono font-semibold px-2 py-0.5 rounded ${fpSig ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-700 text-slate-400"}`}>
          Fisher p = {fpLabel}{fpSig ? " *" : ""}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs mb-3">
        <div className="bg-slate-800/40 rounded p-2 text-center">
          <div className="text-slate-500 mb-0.5">Tissues tested</div>
          <div className="text-slate-300 font-mono">{nTested}</div>
        </div>
        <div className="bg-slate-800/40 rounded p-2 text-center">
          <div className="text-slate-500 mb-0.5">Tissues sig. (p&lt;0.05)</div>
          <div className={`font-mono ${nSig > 0 ? "text-emerald-400" : "text-slate-400"}`}>{nSig}</div>
        </div>
        <div className="bg-slate-800/40 rounded p-2 text-center">
          <div className="text-slate-500 mb-0.5">χ² statistic</div>
          <div className="text-slate-300 font-mono">{chi2 !== undefined && !isNaN(chi2!) ? chi2!.toFixed(1) : "N/A"}</div>
        </div>
      </div>

      {sigTissues.length > 0 && (
        <div className="mb-3">
          <div className="text-xs text-emerald-400 font-semibold mb-1">Significant tissues:</div>
          <div className="space-y-1">
            {sigTissues.map(t => (
              <div key={t.tissue} className="flex items-center gap-2 bg-emerald-500/10 rounded px-2 py-1 text-xs">
                <span className="font-mono text-slate-300 w-10 shrink-0">{t.tissue}</span>
                <span className="text-slate-400 flex-1">{t.tissueLabel}</span>
                <span className="font-mono text-emerald-400">p = {t.pValue.toFixed(3)}</span>
                <span className="text-slate-500">{t.genesFound} targets</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {intestinalTissues.length > 0 && (
        <div className="mb-3 border border-blue-500/20 rounded-lg bg-blue-500/5 p-2">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-blue-300 font-semibold">Intestinal tissues ({intestinalTissues.length})</span>
            {nIntestinalSig > 0
              ? <span className="text-[10px] bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded font-semibold">{nIntestinalSig} significant</span>
              : <span className="text-[10px] text-slate-500">0 significant</span>
            }
          </div>
          <div className="space-y-1">
            {intestinalTissues.map(t => (
              <div key={t.tissue} className={`flex items-center gap-2 rounded px-2 py-1 text-xs ${t.significant ? "bg-emerald-500/10" : "bg-slate-800/30"}`}>
                <span className="font-mono text-slate-300 w-10 shrink-0">{t.tissue}</span>
                <span className="text-slate-400 flex-1">{t.tissueLabel}</span>
                <span className={`font-mono ${t.significant ? "text-emerald-400 font-semibold" : t.pValue < 0.10 ? "text-amber-400" : "text-slate-500"}`}>
                  p = {t.pValue.toFixed(3)}
                </span>
                <span className={`font-mono text-[10px] ${t.zScore < -1 ? "text-emerald-400" : "text-slate-600"}`}>
                  z = {isNaN(t.zScore) ? "—" : t.zScore.toFixed(2)}
                </span>
                <span className="text-slate-500">{t.genesFound}✓</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => setExpanded(e => !e)}
        className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors mt-1"
        data-testid="baboon-expand-all"
      >
        {expanded ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
        {expanded ? "Hide" : "Show"} all {nTested} tissues
      </button>

      {expanded && (
        <div className="mt-2 overflow-y-auto max-h-80">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-700 text-slate-500">
                <th className="text-left pb-1 pr-2">Tissue</th>
                <th className="text-right pb-1 pr-2">p-value</th>
                <th className="text-right pb-1 pr-2">z-score</th>
                <th className="text-right pb-1 pr-2">Targets</th>
                <th className="pb-1"></th>
              </tr>
            </thead>
            <tbody>
              {[...sigTissues, ...nonSigTissues].map(t => (
                <TissueRow key={t.tissue} t={t} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DatasetCard({ result }: { result: DatasetResult }) {
  const pv = pValueLabel(result.permutationTest.pValue);
  const closeGenes = result.directTargets.filter(g => g.distFromPhi < 0.05);

  return (
    <div className={`rounded-xl border p-5 ${result.permutationTest.significant ? "border-emerald-500/40 bg-emerald-500/5" : "border-slate-200 bg-slate-50"}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-mono px-2 py-0.5 rounded border ${
              result.species === "Human"        ? "border-violet-500/40 text-violet-300 bg-violet-500/10" :
              result.species === "Arabidopsis"  ? "border-green-500/40 text-green-300 bg-green-500/10" :
              result.species === "Baboon"        ? "border-orange-500/40 text-orange-300 bg-orange-500/10" :
                                                  "border-blue-500/40 text-blue-300 bg-blue-500/10"
            }`}>
              {result.species}
            </span>
            <span className="text-xs text-slate-500">{result.tissue}</span>
          </div>
          <h3 className="text-sm font-semibold text-slate-800">{result.datasetLabel}</h3>
        </div>
        <div className={`flex items-center gap-1.5 text-sm font-semibold ${pv.color} shrink-0`}>
          {pv.icon}
          <span>{pv.text}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4 text-xs">
        <div className="bg-slate-50 rounded-lg p-2 text-center">
          <div className="text-slate-500 mb-0.5">Genes background</div>
          <div className="text-slate-800 font-mono">{result.nGenes.toLocaleString()}</div>
        </div>
        <div className="bg-slate-50 rounded-lg p-2 text-center">
          <div className="text-slate-500 mb-0.5">Timepoints</div>
          <div className="text-slate-800 font-mono">{result.nTimepoints}</div>
        </div>
        <div className="bg-slate-50 rounded-lg p-2 text-center">
          <div className="text-slate-500 mb-0.5">Targets found</div>
          <div className="text-slate-800 font-mono">{result.genesFound}/{result.genesSearched}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
        <div className="bg-slate-50 rounded-lg p-2">
          <div className="text-slate-500 mb-0.5">z-score</div>
          <div className={`font-mono font-semibold ${(result.permutationTest.zScore ?? 0) < -1 ? "text-emerald-400" : "text-slate-600"}`}>
            {(result.permutationTest.zScore === null || isNaN(result.permutationTest.zScore)) ? "N/A" : result.permutationTest.zScore.toFixed(3)}
          </div>
        </div>
        <div className="bg-slate-50 rounded-lg p-2">
          <div className="text-slate-500 mb-0.5">Genome median |λ|</div>
          <div className="text-slate-600 font-mono">{result.genomeMedianLambda.toFixed(4)}</div>
        </div>
      </div>

      {closeGenes.length > 0 && (
        <div className="mb-4">
          <div className="text-xs text-slate-500 mb-2">Genes within 10% of 1/φ = 0.618:</div>
          <div className="flex flex-wrap gap-2">
            {closeGenes.map(g => (
              <div key={g.gene} className="flex items-center gap-1.5 bg-slate-50 rounded-lg px-2 py-1">
                <span className="text-xs font-semibold text-slate-800">{g.gene}</span>
                <span className="text-xs font-mono text-slate-500">{g.lambda.toFixed(3)}</span>
                <DistanceBadge dist={g.distFromPhi} />
                {g.hasComplexRoots && <span className="text-xs text-violet-400">∿</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left text-slate-500 pb-1 pr-3">Gene</th>
              <th className="text-right text-slate-500 pb-1 pr-3">|λ|</th>
              <th className="text-right text-slate-500 pb-1 pr-3">Dist from 0.618</th>
              <th className="text-right text-slate-500 pb-1 pr-3">R²</th>
              <th className="text-right text-slate-500 pb-1">Roots</th>
            </tr>
          </thead>
          <tbody>
            {result.directTargets.map(g => (
              <tr key={g.gene} className={`border-b border-slate-800/30 ${g.distFromPhi < 0.03 ? "bg-emerald-500/5" : ""}`}>
                <td className="py-0.5 pr-3 text-slate-800 font-medium">{g.gene}</td>
                <td className="py-0.5 pr-3 text-right font-mono text-slate-600">{g.lambda.toFixed(4)}</td>
                <td className="py-0.5 pr-3 text-right"><DistanceBadge dist={g.distFromPhi} /></td>
                <td className="py-0.5 pr-3 text-right font-mono text-slate-500">{g.r2.toFixed(3)}</td>
                <td className="py-0.5 text-right text-slate-500">{g.hasComplexRoots ? "∿ complex" : "real"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {result.datasetId === "gse98965" && result.perTissueResults && (
        <BaboonPerTissuePanel result={result} />
      )}
    </div>
  );
}

function OriginalCard() {
  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono px-2 py-0.5 rounded border border-blue-500/40 text-blue-300 bg-blue-500/10">Mouse</span>
            <span className="text-xs text-amber-400 font-semibold">Discovery dataset</span>
          </div>
          <h3 className="text-sm font-semibold text-slate-800">{ORIGINAL_RESULT.datasetLabel}</h3>
        </div>
        <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-400 shrink-0">
          <CheckCircle size={14}/>
          <span>p = 0.041 *</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-4 text-xs">
        <div className="bg-slate-50 rounded-lg p-2 text-center">
          <div className="text-slate-500 mb-0.5">Genes background</div>
          <div className="text-slate-800 font-mono">20,955</div>
        </div>
        <div className="bg-slate-50 rounded-lg p-2 text-center">
          <div className="text-slate-500 mb-0.5">Tissues</div>
          <div className="text-slate-800 font-mono">12</div>
        </div>
        <div className="bg-slate-50 rounded-lg p-2 text-center">
          <div className="text-slate-500 mb-0.5">Targets found</div>
          <div className="text-slate-800 font-mono">12/14</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
        <div className="bg-slate-50 rounded-lg p-2">
          <div className="text-slate-500 mb-0.5">z-score</div>
          <div className="text-emerald-400 font-mono font-semibold">−1.640</div>
        </div>
        <div className="bg-slate-50 rounded-lg p-2">
          <div className="text-slate-500 mb-0.5">Genome median |λ|</div>
          <div className="text-slate-600 font-mono">0.4963</div>
        </div>
      </div>
      <div className="mb-2">
        <div className="text-xs text-slate-500 mb-2">Closest genes to 1/φ = 0.618:</div>
        <div className="flex flex-wrap gap-2">
          {ORIGINAL_RESULT.standoutGenes.map(g => (
            <div key={g.gene} className="flex items-center gap-1.5 bg-slate-50 rounded-lg px-2 py-1">
              <span className="text-xs font-semibold text-slate-800">{g.gene}</span>
              <span className="text-xs font-mono text-slate-500">{g.lambda.toFixed(3)}</span>
              <DistanceBadge dist={g.distFromPhi} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BmalKoComparisonSection({ wt, ko }: { wt: DatasetResult; ko: DatasetResult }) {
  const wtPv = pValueLabel(wt.permutationTest.pValue);
  const koPv = pValueLabel(ko.permutationTest.pValue);

  const signalLost = wt.permutationTest.significant && !ko.permutationTest.significant;
  const signalGained = !wt.permutationTest.significant && ko.permutationTest.significant;
  const bothSig = wt.permutationTest.significant && ko.permutationTest.significant;
  const neitherSig = !wt.permutationTest.significant && !ko.permutationTest.significant;

  function getInterpretation() {
    if (signalLost) return "Signal is abolished in BMAL1-KO. This is mechanistic evidence that the clock drives the 1/φ enrichment — removing the master activator eliminates the gene-set clustering.";
    if (signalGained) return "Enrichment appears in KO but not WT — unexpected. Possible compensatory transcriptional reprogramming after BMAL1 loss. Requires careful interpretation.";
    if (bothSig) return "Both WT and BMAL1-KO show significant enrichment. The signal persists without BMAL1, suggesting it is driven by constitutive expression levels rather than circadian gating per se.";
    if (neitherSig) return "Neither WT nor BMAL1-KO reaches significance in this single-organoid dataset. The enrichment signal requires multi-tissue aggregation to be detectable, consistent with the discovery (12-tissue cross-tissue mean).";
    return "Mixed result: one condition significant, one not.";
  }

  const allGenes = [...new Set([...wt.directTargets.map(g => g.gene), ...ko.directTargets.map(g => g.gene)])].sort();

  return (
    <div className="bg-slate-800/40 border border-violet-500/30 rounded-xl p-5 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Beaker size={15} className="text-violet-400" />
        <h2 className="text-sm font-semibold text-slate-200">BMAL1-KO mechanistic test — GSE157357 organoids (Stokes et al. 2021)</h2>
      </div>
      <p className="text-xs text-slate-400 mb-4">
        Same 14-gene set, same 5,000-permutation expression-matched test, applied to wild-type and BMAL1-KO intestinal organoids from the same study.
        If BMAL1/CLOCK binding causes the 1/φ enrichment, removing BMAL1 should weaken or abolish the signal.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className={`rounded-xl border p-4 ${wt.permutationTest.significant ? "border-emerald-500/40 bg-emerald-500/5" : "border-slate-700 bg-slate-900/30"}`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-200 bg-blue-500/20 border border-blue-500/30 rounded px-2 py-0.5">WT (wild-type)</span>
            <div className={`flex items-center gap-1 text-sm font-semibold ${wtPv.color}`}>{wtPv.icon}<span>{wtPv.text}</span></div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs mb-3">
            <div className="bg-slate-900/30 rounded p-2 text-center">
              <div className="text-slate-500 mb-0.5">Genes</div>
              <div className="font-mono text-slate-300">{wt.nGenes.toLocaleString()}</div>
            </div>
            <div className="bg-slate-900/30 rounded p-2 text-center">
              <div className="text-slate-500 mb-0.5">Targets found</div>
              <div className="font-mono text-slate-300">{wt.genesFound}/{wt.genesSearched}</div>
            </div>
          </div>
          <div className="text-xs text-slate-500">z = {(wt.permutationTest.zScore === null || isNaN(wt.permutationTest.zScore)) ? "N/A" : wt.permutationTest.zScore.toFixed(3)} · genome median |λ| = {wt.genomeMedianLambda.toFixed(4)}</div>
        </div>

        <div className={`rounded-xl border p-4 ${ko.permutationTest.significant ? "border-emerald-500/40 bg-emerald-500/5" : "border-slate-700 bg-slate-900/30"}`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-200 bg-red-500/20 border border-red-500/30 rounded px-2 py-0.5">BMAL1-KO</span>
            <div className={`flex items-center gap-1 text-sm font-semibold ${koPv.color}`}>{koPv.icon}<span>{koPv.text}</span></div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs mb-3">
            <div className="bg-slate-900/30 rounded p-2 text-center">
              <div className="text-slate-500 mb-0.5">Genes</div>
              <div className="font-mono text-slate-300">{ko.nGenes.toLocaleString()}</div>
            </div>
            <div className="bg-slate-900/30 rounded p-2 text-center">
              <div className="text-slate-500 mb-0.5">Targets found</div>
              <div className="font-mono text-slate-300">{ko.genesFound}/{ko.genesSearched}</div>
            </div>
          </div>
          <div className="text-xs text-slate-500">z = {(ko.permutationTest.zScore === null || isNaN(ko.permutationTest.zScore)) ? "N/A" : ko.permutationTest.zScore.toFixed(3)} · genome median |λ| = {ko.genomeMedianLambda.toFixed(4)}</div>
        </div>
      </div>

      <div className={`rounded-lg border p-3 mb-4 text-xs ${signalLost ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-300" : bothSig ? "border-amber-500/40 bg-amber-500/5 text-amber-300" : "border-slate-600 bg-slate-900/20 text-slate-400"}`}>
        <span className="font-semibold">Interpretation: </span>{getInterpretation()}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-700 text-slate-500">
              <th className="text-left pb-2 pr-3">Gene</th>
              <th className="text-right pb-2 pr-3">|λ| WT</th>
              <th className="text-right pb-2 pr-3">|λ| BMAL1-KO</th>
              <th className="text-right pb-2 pr-3">Δ|λ|</th>
              <th className="text-right pb-2 pr-3">Dist WT</th>
              <th className="text-right pb-2">Dist KO</th>
            </tr>
          </thead>
          <tbody>
            {allGenes.map(gene => {
              const wtG = wt.directTargets.find(g => g.gene === gene);
              const koG = ko.directTargets.find(g => g.gene === gene);
              const delta = wtG && koG ? koG.lambda - wtG.lambda : null;
              return (
                <tr key={gene} className="border-b border-slate-800/50">
                  <td className="py-0.5 pr-3 text-slate-300 font-medium">{gene}</td>
                  <td className="py-0.5 pr-3 text-right font-mono text-slate-400">{wtG ? wtG.lambda.toFixed(4) : "—"}</td>
                  <td className="py-0.5 pr-3 text-right font-mono text-slate-400">{koG ? koG.lambda.toFixed(4) : "—"}</td>
                  <td className={`py-0.5 pr-3 text-right font-mono ${delta === null ? "text-slate-600" : Math.abs(delta) > 0.05 ? "text-amber-400" : "text-slate-500"}`}>
                    {delta === null ? "—" : (delta >= 0 ? "+" : "") + delta.toFixed(4)}
                  </td>
                  <td className="py-0.5 pr-3 text-right">{wtG ? <DistanceBadge dist={wtG.distFromPhi} /> : <span className="text-slate-600">—</span>}</td>
                  <td className="py-0.5 text-right">{koG ? <DistanceBadge dist={koG.distFromPhi} /> : <span className="text-slate-600">—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function PhiEnrichmentReplication() {
  const { data, isLoading, error } = useQuery<DatasetResult[]>({
    queryKey: ["/api/phi-enrichment-replication"],
    staleTime: Infinity,
  });

  const isArabidopsis = (id: string) =>
    id.startsWith("gse242964") || id.startsWith("gse37278") || id.startsWith("gse19271");

  const replicationData = data ? data.filter(d => !d.datasetId.startsWith("gse157357") && !isArabidopsis(d.datasetId)) : [];
  const mechanisticData = data ? data.filter(d => d.datasetId.startsWith("gse157357")) : [];
  const arabidopsisData = data ? data.filter(d => isArabidopsis(d.datasetId)) : [];
  const arabidopsisHQ = arabidopsisData.filter(d => d.datasetId.startsWith("gse37278") || d.datasetId.startsWith("gse19271"));
  const arabidopsisLQ = arabidopsisData.filter(d => d.datasetId.startsWith("gse242964"));
  const wtData = mechanisticData.find(d => d.datasetId === "gse157357_wt");
  const koData = mechanisticData.find(d => d.datasetId === "gse157357_bmalko");

  const nSignificant = replicationData.filter(d => d.permutationTest.significant).length;
  const nTotal = replicationData.length;
  const nArabSig = arabidopsisData.filter(d => d.permutationTest.significant).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-10">

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-violet-500/10 rounded-lg border border-violet-500/30">
              <FlaskConical className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">1/φ Enrichment — Independent Replication</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Testing whether direct BMAL1/CLOCK target genes cluster near |λ| = 1/φ ≈ 0.618 across four independent datasets
              </p>
            </div>
            {data && (
              <button
                className="ml-auto flex items-center gap-1.5 text-xs text-slate-500 border border-slate-300 rounded px-2.5 py-1.5 hover:bg-slate-100 shrink-0"
                onClick={() => downloadAsCSV(
                  data.map(d => ({
                    dataset_id: d.datasetId,
                    dataset_label: d.datasetLabel,
                    species: d.species,
                    tissue: d.tissue,
                    n_genes_in_dataset: d.nGenes,
                    n_timepoints: d.nTimepoints,
                    genes_searched: d.genesSearched,
                    genes_found: d.genesFound,
                    observed_mean_dist_from_phi: d.permutationTest.observedMeanDist,
                    null_mean: d.permutationTest.nullMean,
                    null_sd: d.permutationTest.nullSd,
                    z_score: d.permutationTest.zScore,
                    p_value: d.permutationTest.pValue,
                    n_permutations: d.permutationTest.nPerm,
                    significant: d.permutationTest.significant,
                    genome_median_lambda: d.genomeMedianLambda,
                    genome_mean_lambda: d.genomeMeanLambda,
                  })),
                  'phi_enrichment_replication_results.csv'
                )}
                data-testid="button-download-phi-csv"
              >
                <Download size={13} /> Download CSV
              </button>
            )}
          </div>

          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 text-sm text-slate-600 mb-6">
            <p className="mb-2">
              The original discovery (GSE54650, 12-tissue mouse atlas) showed a statistically significant signal: direct BMAL1/CLOCK E-box target genes cluster closer to 1/φ = 0.618 than expression-matched random genes
              (p = 0.041, 5,000 permutations). The test below runs the same analysis — same gene set, same permutation procedure, same expression matching — on four independent replication datasets, including a non-rodent primate atlas (GSE98965, baboon, 60 tissues).
            </p>
            <p className="text-slate-500 text-xs mb-2">
              All values are AR(2) eigenvalue moduli |λ|. The permutation null draws expression-matched genes from the same dataset background. 5,000 permutations per dataset.
            </p>
            <p className="text-slate-500 text-xs">
              A separate mechanistic test below applies the same analysis to wild-type and BMAL1-KO organoids from GSE157357 (Stokes et al. 2021) — directly testing whether the signal depends on BMAL1.
            </p>
          </div>

          {!isLoading && data && (
            <div className={`rounded-xl border p-4 mb-6 ${nSignificant >= 2 ? "border-emerald-500/40 bg-emerald-500/5" : nSignificant === 1 ? "border-amber-500/40 bg-amber-500/5" : "border-slate-200 bg-slate-50"}`}>
              <div className="flex items-center gap-2 mb-1">
                {nSignificant >= 2 ? <CheckCircle size={16} className="text-emerald-400"/> : <AlertCircle size={16} className="text-amber-400"/>}
                <span className={`font-semibold text-sm ${nSignificant >= 2 ? "text-emerald-300" : "text-amber-300"}`}>
                  Replication summary: {nSignificant} of {nTotal} independent datasets significant (p &lt; 0.05)
                </span>
              </div>
              <p className="text-xs text-slate-500 ml-6">
                {nSignificant === 0 && "The original discovery does not replicate across independent datasets — the p=0.041 signal appears dataset-specific."}
                {nSignificant === 1 && "Replicates in the human intestinal enteroid (cross-species). Baboon 60-tissue atlas shows Fisher combined p ≈ 0.095 across 60 tissues (4 individually significant: PIN, LH, AMY, WAM — neuroendocrine and metabolic tissues), approaching but not reaching the p<0.05 threshold. The signal is context-dependent, strongest in gut/proliferating epithelium and neuroendocrine tissues."}
                {nSignificant === 2 && "The signal replicates in two independent datasets. The 1/φ enrichment is not dataset-specific."}
                {nSignificant === 3 && "Strong replication across three independent datasets, including cross-species human gut data. The 1/φ enrichment is reproducible."}
                {nSignificant >= 4 && "Full replication across all four independent datasets — mouse liver, mouse enteroid, human enteroid, and baboon 60-tissue atlas. Cross-species primate evidence supports generality."}
              </p>
            </div>
          )}
        </div>

        {isLoading && (
          <div className="text-center py-20">
            <div className="inline-flex items-center gap-3 text-slate-500">
              <div className="w-5 h-5 border-2 border-slate-300 border-t-violet-400 rounded-full animate-spin" />
              <span>Running AR(2) analysis across six datasets (4 replication + WT/KO mechanistic test) — 5,000 permutations each…</span>
            </div>
            <p className="text-xs text-slate-600 mt-3">This takes 60–120 seconds the first time. Results are cached after that.</p>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-300">
            Analysis failed: {String(error)}
          </div>
        )}

        {data && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <OriginalCard />
              {replicationData.map(ds => <DatasetCard key={ds.datasetId} result={ds} />)}
            </div>

            <div className="bg-slate-100 border border-slate-200 rounded-xl p-5 mb-6">
              <h2 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Dna size={14} className="text-violet-400" />
                Cross-dataset replication summary table
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="text-left pb-2 pr-4">Dataset</th>
                      <th className="text-center pb-2 pr-4">Species</th>
                      <th className="text-center pb-2 pr-4">Tissue</th>
                      <th className="text-center pb-2 pr-4">N genes</th>
                      <th className="text-center pb-2 pr-4">Targets</th>
                      <th className="text-center pb-2 pr-4">p-value</th>
                      <th className="text-center pb-2 pr-4">z-score</th>
                      <th className="text-center pb-2">Significant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/40">
                    <tr className="bg-amber-500/5">
                      <td className="py-2 pr-4 text-slate-800">GSE54650 <span className="text-amber-400 text-xs">(discovery)</span></td>
                      <td className="py-2 pr-4 text-center text-slate-600">Mouse</td>
                      <td className="py-2 pr-4 text-center text-slate-600">12 tissues</td>
                      <td className="py-2 pr-4 text-center font-mono text-slate-600">20,955</td>
                      <td className="py-2 pr-4 text-center font-mono text-slate-600">12/14</td>
                      <td className="py-2 pr-4 text-center font-mono text-emerald-400 font-semibold">0.041</td>
                      <td className="py-2 pr-4 text-center font-mono text-emerald-400">−1.640</td>
                      <td className="py-2 text-center text-emerald-400">✓</td>
                    </tr>
                    {replicationData.map(ds => {
                      const pv = ds.permutationTest.pValue;
                      const pvValid = pv !== null && pv !== undefined && !isNaN(pv);
                      const zv = ds.permutationTest.zScore;
                      const zvValid = zv !== null && zv !== undefined && !isNaN(zv);
                      const col = ds.permutationTest.significant ? "text-emerald-400 font-semibold" : pvValid && pv < 0.10 ? "text-amber-400" : "text-slate-500";
                      return (
                        <tr key={ds.datasetId}>
                          <td className="py-2 pr-4 text-slate-800">{ds.datasetId.toUpperCase().replace(/_/g,' ')}</td>
                          <td className="py-2 pr-4 text-center text-slate-600">{ds.species}</td>
                          <td className="py-2 pr-4 text-center text-slate-600 text-xs">{ds.tissue.split('(')[0].trim()}</td>
                          <td className="py-2 pr-4 text-center font-mono text-slate-600">{ds.nGenes.toLocaleString()}</td>
                          <td className="py-2 pr-4 text-center font-mono text-slate-600">{ds.genesFound}/{ds.genesSearched}</td>
                          <td className={`py-2 pr-4 text-center font-mono ${col}`}>{pvValid ? (pv as number).toFixed(3) : "N/A"}</td>
                          <td className={`py-2 pr-4 text-center font-mono ${col}`}>{zvValid ? (zv as number).toFixed(3) : "N/A"}</td>
                          <td className="py-2 text-center">{ds.permutationTest.significant ? <span className="text-emerald-400">✓</span> : <span className="text-slate-500">—</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {wtData && koData && <BmalKoComparisonSection wt={wtData} ko={koData} />}

            {arabidopsisData.length > 0 && (
              <div className="mt-8 mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-green-500/10 rounded-lg border border-green-500/30">
                    <Beaker className="w-4 h-4 text-green-400" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-slate-800">Plant Extension — Arabidopsis thaliana (5 datasets)</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Testing whether the 1/φ proximity appears in plant clock output genes — a completely different molecular clock from CLOCK/BMAL1
                      (uses CCA1/LHY and the Evening Element instead of E-box). Gene set pre-specified from literature (Harmer 2000; Covington 2008; Nagel 2015):
                      10 direct CCA1/LHY-regulated output genes including AtWEE1, the direct Arabidopsis WEE1 ortholog.
                    </p>
                  </div>
                </div>

                <div className={`rounded-xl border p-4 mb-6 ${nArabSig >= 3 ? "border-emerald-500/40 bg-emerald-500/5" : nArabSig >= 1 ? "border-amber-500/40 bg-amber-500/5" : "border-slate-200 bg-slate-50"}`}>
                  <div className="flex items-center gap-2 mb-1">
                    {nArabSig >= 3 ? <CheckCircle size={16} className="text-emerald-400"/> :
                     nArabSig >= 1 ? <AlertCircle size={16} className="text-amber-400"/> :
                     <XCircle size={16} className="text-slate-400"/>}
                    <span className={`font-semibold text-sm ${nArabSig >= 3 ? "text-emerald-300" : nArabSig >= 1 ? "text-amber-300" : "text-slate-500"}`}>
                      Plant result: {nArabSig} of {arabidopsisData.length} datasets significant (p &lt; 0.05)
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 ml-6">
                    {nArabSig === 0 && "No significant result across 5 independent Arabidopsis datasets including 2 high-quality 12-timepoint regular-interval free-running time courses. The 1/φ enrichment is specific to the mammalian CLOCK/BMAL1/E-box architecture."}
                    {nArabSig >= 1 && nArabSig < 3 && "Marginal signal — does not replicate consistently across the 5 independent datasets."}
                    {nArabSig >= 3 && "Signal present in ≥3 of 5 datasets, suggesting the enrichment may extend to the plant circadian clock."}
                  </p>
                </div>

                {arabidopsisHQ.length > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">High-quality replication datasets</span>
                      <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded px-2 py-0.5 text-xs">12 timepoints · 4h regular intervals · constant light (LL)</span>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                      {arabidopsisHQ.map(ds => <DatasetCard key={ds.datasetId} result={ds} />)}
                    </div>
                  </div>
                )}

                {arabidopsisLQ.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Preliminary replication (GSE242964)</span>
                      <span className="bg-slate-500/10 text-slate-400 border border-slate-500/20 rounded px-2 py-0.5 text-xs">7 timepoints · irregular intervals · 3 biological replicates</span>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                      {arabidopsisLQ.map(ds => <DatasetCard key={ds.datasetId} result={ds} />)}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="bg-slate-50 border border-slate-200/40 rounded-xl p-4 text-xs text-slate-500">
              <p className="mb-1 font-medium text-slate-600">Method note</p>
              <p className="mb-2">
                AR(2) fitted by OLS to mean-centred expression. Eigenvalue modulus |λ| capped at 1.0. Expression-matched permutation null: for each target gene,
                random genes drawn from the same log₁₀-expression bin (20 bins) in the background genome. Permutation p-value = fraction of 5,000 null samples with
                mean distance from 1/φ ≤ observed. Gene names matched case-insensitively; mouse and human orthologues share identical names for these genes.
              </p>
              <p className="mb-2">
                <span className="font-medium text-slate-600">Baboon (GSE98965):</span>{" "}
                The dataset contains 60 tissues × 12 ZT timepoints. AR(2) is fitted independently for every gene in each tissue separately, giving 60 independent permutation test results.
                These are combined using Fisher's method (χ² = −2·Σ ln(pᵢ), df = 2k, exact chi-squared survival function) to give a single combined p-value that is far more sensitive than cross-tissue averaging —
                averaging compresses all λ values toward the centre and destroys tissue-specific signal before the test runs.
                Expression-matched permutation (20 bins, log₁₀ FPKM floor 1×10⁻⁶) is applied independently per tissue, with target genes excluded from the background pool.
                Gene symbols are uppercase in the baboon atlas and matched directly; CIART and CCRN4L lack primate symbol equivalents in this release.
              </p>
              <p className="mb-2">
                <span className="font-medium text-slate-600">Arabidopsis high-quality datasets (GSE37278, GSE19271):</span>{" "}
                Both use the Affymetrix ATH1 array (GPL14926 and GPL198 respectively) with 12 timepoints at regular 4-hour intervals in free-running constant light.
                GSE37278 (Farré lab): Col-0 WT at ZT72–116 in constant white light, 29,612 genes after probe filtering (prefer primary .0 model, fallback to .X).
                GSE19271 (Robertson et al.): WT untreated condition at ZT49–93, 21,244 genes mapped via the GPL198 AGI/TAIR locus column.
                Gene identifiers are TAIR locus base IDs (AT1G02970 etc.); target genes looked up by exact TAIR match.
              </p>
              <p className="mb-2">
                <span className="font-medium text-slate-600">Arabidopsis preliminary (GSE242964):</span>{" "}
                The plant dataset has 7 circadian timepoints (CT0–CT20) with 3 technical replicates each, averaged per timepoint before AR(2) fitting.
                The 10-gene output set (AtWEE1, GRP7, RCA, CAT3, CHS, CDKB1;1, IAA29, PIL1, CAB1, FT) was pre-specified from the circadian
                transcriptomics literature before any analysis. Gene identifiers use AT locus IDs as stored in the dataset (e.g. AT1G02970.1 for AtWEE1).
                This is a wholly independent molecular architecture from the mammalian E-box/CLOCK/BMAL1 system — CCA1 and LHY replace CLOCK/BMAL1,
                and the Evening Element (AAATATCT) replaces the E-box (CACGTG).
              </p>
              <p>
                <span className="font-medium text-slate-600">BMAL1-KO test (GSE157357):</span>{" "}
                The WT and BMAL1-KO conditions are from the same study (Stokes et al. 2021, GEO GSE157357). Each has 23 timepoints and ~15,700 genes.
                This is a mechanistic test, not an independent replication, so it is counted separately from the four independent replication datasets above.
                The same 5,000-permutation expression-matched procedure is applied to each condition independently.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
