import { useState, useMemo } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, GitMerge, Microscope, Dna, Activity, Zap, ChevronDown, ArrowRight
} from "lucide-react";
import {
  type DiscoveryNode,
  DISCOVERIES,
  SOURCE_COLORS,
  TISSUE_CODE_RULES,
  CIRCADIAN_CONVERGENCES,
  WADDINGTON_CONVERGENCES,
} from "./convergence-map-data";

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const cls =
    confidence >= 85
      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
      : confidence >= 75
      ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
      : confidence >= 65
      ? "bg-orange-500/15 text-orange-400 border-orange-500/30"
      : "bg-red-500/15 text-red-400 border-red-500/30";
  return <Badge className={`${cls} text-[10px]`}>{confidence}%</Badge>;
}

function NodeCard({
  node,
  isSelected,
  onClick,
}: {
  node: DiscoveryNode;
  isSelected: boolean;
  onClick: () => void;
}) {
  const colorMap: Record<string, string> = {
    boman: "border-blue-500/40 bg-blue-500/[0.06] hover:border-blue-500/70",
    par2: "border-cyan-500/40 bg-cyan-500/[0.06] hover:border-cyan-500/70",
    convergence: "border-amber-500/40 bg-amber-500/[0.06] hover:border-amber-500/70",
  };
  const selectedMap: Record<string, string> = {
    boman: "border-blue-500 bg-blue-500/15 ring-1 ring-blue-500/30",
    par2: "border-cyan-500 bg-cyan-500/15 ring-1 ring-cyan-500/30",
    convergence: "border-amber-500 bg-amber-500/15 ring-1 ring-amber-500/30",
  };
  const labelMap: Record<string, string> = {
    boman: "text-blue-400",
    par2: "text-cyan-400",
    convergence: "text-amber-400",
  };

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-lg border p-3 transition-all ${
        isSelected ? selectedMap[node.source] : colorMap[node.source]
      }`}
      data-testid={`button-node-${node.id}`}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className={`text-[10px] font-semibold uppercase tracking-wider ${labelMap[node.source]}`}>
          {node.year}
        </span>
        {node.confidence && <ConfidenceBadge confidence={node.confidence} />}
      </div>
      <p className="text-sm font-semibold text-slate-900 leading-tight">{node.label}</p>
      <p className="text-[11px] text-slate-500 mt-1 leading-snug line-clamp-2">{node.detail}</p>
    </button>
  );
}

function ConvergenceFlowDiagram({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const bomanNodes = DISCOVERIES.filter(d => d.source === "boman").sort(
    (a, b) => a.position[1] - b.position[1]
  );
  const par2Nodes = DISCOVERIES.filter(d => d.source === "par2").sort(
    (a, b) => a.position[1] - b.position[1]
  );
  const convergenceNodes = DISCOVERIES.filter(d => d.source === "convergence").sort(
    (a, b) => a.position[1] - b.position[1]
  );

  const toggle = (id: string) => onSelect(selected === id ? null : id);

  return (
    <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] gap-0 items-start">
      <div className="flex flex-col gap-3 py-2">
        <div className="px-3 py-1.5 rounded-md bg-blue-500/10 border border-blue-500/20 mb-1 text-center">
          <p className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center justify-center gap-1.5">
            <Microscope size={12} /> Boman Lab
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">Published 2001–2026</p>
        </div>
        {bomanNodes.map(n => (
          <NodeCard key={n.id} node={n} isSelected={selected === n.id} onClick={() => toggle(n.id)} />
        ))}
      </div>

      <div className="flex flex-col items-center justify-start pt-14 px-2 gap-1 self-stretch">
        <div className="w-px bg-gradient-to-b from-transparent via-slate-300 to-transparent flex-1" />
        <ArrowRight size={14} className="text-amber-400 shrink-0" />
        <div className="w-px bg-gradient-to-b from-transparent via-slate-300 to-transparent flex-1" />
      </div>

      <div className="flex flex-col gap-3 py-2">
        <div className="px-3 py-1.5 rounded-md bg-amber-500/10 border border-amber-500/20 mb-1 text-center">
          <p className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center justify-center gap-1.5">
            <GitMerge size={12} /> Convergence Points
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">Independent agreement</p>
        </div>
        {convergenceNodes.map(n => (
          <NodeCard key={n.id} node={n} isSelected={selected === n.id} onClick={() => toggle(n.id)} />
        ))}
      </div>

      <div className="flex flex-col items-center justify-start pt-14 px-2 gap-1 self-stretch">
        <div className="w-px bg-gradient-to-b from-transparent via-slate-300 to-transparent flex-1" />
        <ArrowRight size={14} className="text-amber-400 shrink-0 rotate-180" />
        <div className="w-px bg-gradient-to-b from-transparent via-slate-300 to-transparent flex-1" />
      </div>

      <div className="flex flex-col gap-3 py-2">
        <div className="px-3 py-1.5 rounded-md bg-cyan-500/10 border border-cyan-500/20 mb-1 text-center">
          <p className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center justify-center gap-1.5">
            <Dna size={12} /> PAR(2) Engine
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">Independent discovery</p>
        </div>
        {par2Nodes.map(n => (
          <NodeCard key={n.id} node={n} isSelected={selected === n.id} onClick={() => toggle(n.id)} />
        ))}
      </div>
    </div>
  );
}

function DetailPanel({ node }: { node: DiscoveryNode }) {
  const sourceLabel =
    node.source === "boman"
      ? "Boman Lab (Published)"
      : node.source === "par2"
      ? "PAR(2) Engine (Independent)"
      : "Convergence Point";
  const sourceColor =
    node.source === "boman"
      ? "text-blue-400"
      : node.source === "par2"
      ? "text-cyan-400"
      : "text-amber-400";
  const sourceBg =
    node.source === "boman"
      ? "bg-blue-500/10 border-blue-500/30"
      : node.source === "par2"
      ? "bg-cyan-500/10 border-cyan-500/30"
      : "bg-amber-500/10 border-amber-500/30";

  return (
    <div className={`border rounded-lg p-4 ${sourceBg}`} data-testid={`detail-${node.id}`}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="font-bold text-slate-900 text-lg">{node.label}</h3>
          <p className={`text-xs font-medium ${sourceColor}`}>
            {sourceLabel} — {node.year}
          </p>
        </div>
        {node.confidence && (
          <Badge
            className={`${
              node.confidence >= 80
                ? "bg-emerald-500/20 text-emerald-400"
                : node.confidence >= 60
                ? "bg-amber-500/20 text-amber-400"
                : "bg-red-500/20 text-red-400"
            }`}
          >
            {node.confidence}% confidence
          </Badge>
        )}
      </div>
      <p className="text-sm text-slate-600 leading-relaxed">{node.detail}</p>
      {node.citation && (
        <p className="text-xs text-slate-500 mt-2 italic">{node.citation}</p>
      )}
    </div>
  );
}

function FiveRulesSection() {
  const [selectedRule, setSelectedRule] = useState<number | null>(null);
  const activeRule = selectedRule ? TISSUE_CODE_RULES.find(r => r.rule === selectedRule) : null;

  return (
    <>
      <div className="mb-6 mt-12">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-purple-500/10">
            <Zap size={24} className="text-purple-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900" data-testid="text-five-rules-heading">
              The Five Biological Rules → PAR(2) Translation
            </h2>
            <p className="text-sm text-muted-foreground">
              From Boman et al., <em>Biology of the Cell</em> (Wiley, July 2025) — DOI: 10.1111/boc.70017
            </p>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-2 max-w-3xl leading-relaxed">
          Boman's team identified five mathematical laws — a "tissue code" — that encode how colonic
          epithelium maintains precise cellular organization during continuous renewal. Each rule maps
          onto an independent AR(2) observation. The PAR(2) translations below are associative — they
          show where the equation's outputs are consistent with Boman's rules, not that the equation
          proves them.
        </p>
      </div>

      <div className="grid sm:grid-cols-5 gap-3 mb-6">
        {TISSUE_CODE_RULES.map(r => (
          <button
            key={r.id}
            className={`text-left p-3 rounded-lg border transition-all ${
              selectedRule === r.rule
                ? "border-purple-500 bg-purple-500/10 ring-1 ring-purple-500/30"
                : "border-slate-200 bg-slate-50 hover:border-purple-500/40"
            }`}
            onClick={() => setSelectedRule(selectedRule === r.rule ? null : r.rule)}
            data-testid={`button-rule-${r.rule}`}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-6 h-6 rounded bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold text-xs shrink-0">
                {r.rule}
              </div>
              <ConfidenceBadge confidence={r.confidence} />
            </div>
            <p className="text-xs font-semibold text-slate-900">{r.bomanLabel}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">→ {r.par2Label}</p>
            {r.speculative && (
              <p className="text-[9px] text-orange-400/70 mt-1 uppercase tracking-wider">Speculative</p>
            )}
          </button>
        ))}
      </div>

      {activeRule ? (
        <Card className="bg-white border-purple-500/30 mb-6" data-testid={`rule-detail-${activeRule.rule}`}>
          <CardContent className="p-0">
            <div className="bg-slate-50 px-5 py-3 flex items-center gap-3 border-b border-slate-200">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold text-sm shrink-0">
                {activeRule.rule}
              </div>
              <p className="text-sm font-semibold text-slate-900 flex-1">
                Rule {activeRule.rule}: {activeRule.bomanLabel}
              </p>
              {activeRule.speculative && (
                <Badge className="bg-orange-500/15 text-orange-400 border-orange-500/30 text-[10px] mr-1">
                  SPECULATIVE TRANSLATION
                </Badge>
              )}
              <ConfidenceBadge confidence={activeRule.confidence} />
            </div>
            <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200/50">
              <div className="p-5 bg-blue-500/[0.03]">
                <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Microscope size={12} /> Boman — Tissue Code
                </p>
                <p className="text-sm font-medium text-slate-900 mb-1.5">{activeRule.bomanLabel}</p>
                <p className="text-xs text-slate-500 leading-relaxed">{activeRule.bomanDetail}</p>
                <p className="text-[10px] text-slate-500 italic mt-2">
                  Boman et al., Biology of the Cell (Wiley), July 2025
                </p>
              </div>
              <div className="p-5 bg-cyan-500/[0.03]">
                <p className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Dna size={12} /> PAR(2) Translation
                </p>
                <p className="text-sm font-medium text-slate-900 mb-1.5">{activeRule.par2Label}</p>
                <p className="text-xs text-slate-500 leading-relaxed mb-2">{activeRule.par2Detail}</p>
                <p className="text-[10px] text-emerald-400/70 font-mono">{activeRule.par2Evidence}</p>
                <Link
                  href={activeRule.link}
                  className="text-[10px] text-cyan-500 hover:underline mt-1 inline-block"
                >
                  View full analysis →
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6">
          <p className="text-xs text-slate-500 text-center">Select a rule above to see details</p>
        </div>
      )}

      <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4 mb-8">
        <p className="text-xs text-amber-400 font-semibold mb-1">Important Context</p>
        <p className="text-xs text-slate-500 leading-relaxed">
          Boman's five rules were discovered through mathematical modeling of crypt renewal dynamics
          using discrete and continuous ODE models, validated against immunohistochemistry and
          lineage-tracing data. The PAR(2) translations are independent observations from fitting a
          two-coefficient regression to publicly available time-series data. The mappings above show
          where AR(2) outputs are <em>consistent with</em> each tissue code rule — they do not
          constitute independent proof. Both approaches could share biases (e.g., focus on colonic
          tissue, similar gene panels). Prospective experimental testing is needed to confirm these
          associations.
        </p>
      </div>
    </>
  );
}

function CircadianCanonSection() {
  const [selectedNum, setSelectedNum] = useState<number | null>(null);
  const activeCC = selectedNum
    ? CIRCADIAN_CONVERGENCES.find(cc => cc.num === selectedNum)
    : null;

  return (
    <>
      <div className="mb-6 mt-12">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-amber-500/10">
            <Activity size={24} className="text-amber-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900" data-testid="text-circadian-canon-heading">
              Circadian Canon → PAR(2) Convergence
            </h2>
            <p className="text-sm text-muted-foreground">
              Takahashi & Hogenesch — two decades of circadian biology independently rediscovered by one equation
            </p>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-2 max-w-3xl leading-relaxed">
          Joseph Takahashi (UT Southwestern) defined the molecular architecture of mammalian circadian
          clocks. John Hogenesch (Cincinnati) mapped genome-wide circadian expression across tissues
          and species. Together their work established the circadian canon — the foundational
          principles of how biological clocks organize gene expression. The six convergence points
          below show where AR(2) eigenvalue analysis independently recovers the same principles from
          time-series data alone.
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        {CIRCADIAN_CONVERGENCES.map(cc => (
          <button
            key={cc.id}
            className={`text-left p-3 rounded-lg border transition-all ${
              selectedNum === cc.num
                ? "border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/30"
                : "border-slate-200 bg-slate-50 hover:border-amber-500/40"
            }`}
            onClick={() => setSelectedNum(selectedNum === cc.num ? null : cc.num)}
            data-testid={`button-circadian-${cc.num}`}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-6 h-6 rounded bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-xs shrink-0">
                {cc.num}
              </div>
              <ConfidenceBadge confidence={cc.confidence} />
            </div>
            <p className="text-xs font-semibold text-slate-900">{cc.canonLabel}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">→ {cc.par2Label}</p>
          </button>
        ))}
      </div>

      {activeCC ? (
        <Card
          className="bg-white border-amber-500/30 mb-6"
          data-testid={`circadian-detail-${activeCC.num}`}
        >
          <CardContent className="p-0">
            <div className="bg-slate-50 px-5 py-3 flex items-center gap-3 border-b border-slate-200">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-sm shrink-0">
                {activeCC.num}
              </div>
              <p className="text-sm font-semibold text-slate-900 flex-1">{activeCC.canonLabel}</p>
              <ConfidenceBadge confidence={activeCC.confidence} />
            </div>
            <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200/50">
              <div className="p-5 bg-amber-500/[0.03]">
                <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Activity size={12} /> Circadian Canon
                </p>
                <p className="text-sm font-medium text-slate-900 mb-1.5">{activeCC.canonLabel}</p>
                <p className="text-xs text-slate-500 leading-relaxed">{activeCC.canonDetail}</p>
                <p className="text-[10px] text-slate-500 italic mt-2">{activeCC.canonSource}</p>
              </div>
              <div className="p-5 bg-cyan-500/[0.03]">
                <p className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Dna size={12} /> PAR(2) Discovery
                </p>
                <p className="text-sm font-medium text-slate-900 mb-1.5">{activeCC.par2Label}</p>
                <p className="text-xs text-slate-500 leading-relaxed mb-2">{activeCC.par2Detail}</p>
                <p className="text-[10px] text-emerald-400/70 font-mono">{activeCC.par2Evidence}</p>
                <Link
                  href={activeCC.link}
                  className="text-[10px] text-cyan-500 hover:underline mt-1 inline-block"
                >
                  View full analysis →
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6">
          <p className="text-xs text-slate-500 text-center">Select a convergence point above to see details</p>
        </div>
      )}

      <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4 mb-8">
        <p className="text-xs text-amber-400 font-semibold mb-1">Scientific Context</p>
        <p className="text-xs text-slate-500 leading-relaxed">
          Takahashi's TTFL architecture and Hogenesch's genome-wide circadian atlas represent the
          foundational canon of circadian biology, established through decades of mutagenesis screens,
          ChIP-seq, RNA-seq time courses, and cross-species comparisons. The PAR(2) convergence
          points above show where a single autoregressive equation, applied to publicly available
          data, recovers principles consistent with this canon. However, consistency is not proof —
          AR(2) is a statistical tool that measures temporal autocorrelation. It cannot distinguish
          whether high persistence reflects circadian regulation specifically vs. other slow-changing
          processes. The convergences are strongest where PAR(2) predictions align with specific
          published values (e.g., clock gene rankings) and weakest where the mapping is conceptual
          rather than quantitative.
        </p>
      </div>
    </>
  );
}

function WaddingtonSection() {
  const [expandedNum, setExpandedNum] = useState<number | null>(null);

  return (
    <>
      <div className="mb-6 mt-12">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-purple-500/10">
            <Zap size={24} className="text-purple-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900" data-testid="text-waddington-heading">
              Waddington's Epigenetic Landscape → Root-Space Geometry
            </h2>
            <p className="text-sm text-muted-foreground">
              A 1957 metaphor made quantitative — independently recovered by AR(2) parameter mapping
            </p>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-2 max-w-3xl leading-relaxed">
          Conrad Waddington proposed that cell fates are valleys in a landscape shaped by gene
          regulatory networks. Modern formalizations (Huang 2012, Wang 2011, Ferrell 2012) made this
          metaphor mathematically rigorous — valleys are attractors, ridges are barriers, and
          bifurcations are fate decisions. The AR(2) root-space independently produces a structured
          parameter landscape with clusters, voids, and boundaries that parallel Waddington's
          framework — from time-series regression alone, without knowledge of underlying regulatory
          networks.
        </p>
      </div>

      <Card className="bg-white border-purple-500/30 mb-6" data-testid="card-waddington-linear">
        <CardContent className="p-0">
          <div className="grid grid-cols-[1fr_auto_1fr] items-stretch">
            <div className="px-5 py-3 bg-purple-500/[0.04] border-b border-slate-200">
              <p className="text-xs font-bold text-purple-400 uppercase tracking-wider">
                Waddington Landscape
              </p>
              <p className="text-[10px] text-slate-500">Cell Fate Framework (1957–2025)</p>
            </div>
            <div className="flex items-center justify-center px-4 border-b border-slate-200 bg-slate-50">
              <p className="text-[10px] text-slate-500 font-medium">Confidence</p>
            </div>
            <div className="px-5 py-3 bg-cyan-500/[0.04] border-b border-slate-200">
              <p className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                PAR(2) Root-Space
              </p>
              <p className="text-[10px] text-slate-500">Independent Discovery</p>
            </div>
          </div>

          {WADDINGTON_CONVERGENCES.map((wc, i) => {
            const isExpanded = expandedNum === wc.num;
            const isLast = i === WADDINGTON_CONVERGENCES.length - 1;

            return (
              <div key={wc.id}>
                <button
                  className={`w-full grid grid-cols-[1fr_auto_1fr] items-center transition-colors hover:bg-slate-50 ${
                    !isLast || isExpanded ? "border-b border-slate-200" : ""
                  }`}
                  onClick={() => setExpandedNum(isExpanded ? null : wc.num)}
                  data-testid={`button-waddington-${wc.num}`}
                >
                  <div className="px-5 py-3.5 text-left flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-purple-500/15 flex items-center justify-center text-purple-400 font-bold text-xs shrink-0 border border-purple-500/20">
                      {wc.num}
                    </div>
                    <p className="text-sm text-slate-900 font-medium leading-tight">{wc.wadLabel}</p>
                  </div>

                  <div className="px-4 flex flex-col items-center gap-1">
                    <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          wc.confidence >= 80
                            ? "bg-emerald-500"
                            : wc.confidence >= 75
                            ? "bg-amber-500"
                            : "bg-orange-500"
                        }`}
                        style={{ width: `${wc.confidence}%` }}
                      />
                    </div>
                    <span
                      className={`text-[10px] font-mono font-bold ${
                        wc.confidence >= 80
                          ? "text-emerald-400"
                          : wc.confidence >= 75
                          ? "text-amber-400"
                          : "text-orange-400"
                      }`}
                    >
                      {wc.confidence}%
                    </span>
                  </div>

                  <div className="px-5 py-3.5 text-left flex items-center gap-3">
                    <p className="text-sm text-slate-900 font-medium leading-tight">{wc.par2Label}</p>
                    <ChevronDown
                      size={14}
                      className={`text-slate-500 shrink-0 ml-auto transition-transform ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </button>

                {isExpanded && (
                  <div
                    className={`grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200/30 ${
                      !isLast ? "border-b border-slate-200" : ""
                    }`}
                  >
                    <div className="p-5 bg-purple-500/[0.03]">
                      <p className="text-xs font-semibold text-purple-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Zap size={12} /> Waddington Framework
                      </p>
                      <p className="text-xs text-slate-500 leading-relaxed">{wc.wadDetail}</p>
                      <p className="text-[10px] text-slate-500 italic mt-2">{wc.wadSource}</p>
                    </div>
                    <div className="p-5 bg-cyan-500/[0.03]">
                      <p className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Dna size={12} /> PAR(2) Root-Space
                      </p>
                      <p className="text-xs text-slate-500 leading-relaxed mb-2">{wc.par2Detail}</p>
                      <p className="text-[10px] text-emerald-400/70 font-mono">{wc.par2Evidence}</p>
                      <Link
                        href={wc.link}
                        className="text-[10px] text-cyan-500 hover:underline mt-1 inline-block"
                      >
                        View full analysis →
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-4 mb-8">
        <p className="text-xs text-purple-400 font-semibold mb-1">
          Important Caveat — Conceptual Analogy, Not Causal Proof
        </p>
        <p className="text-xs text-slate-500 leading-relaxed">
          Waddington's landscape describes <span className="text-purple-300">cell-level</span> fate
          decisions through gene regulatory network dynamics. AR(2) root-space describes{" "}
          <span className="text-cyan-300">gene-level</span> temporal dynamics from time-series
          regression. The structural parallels — clusters/valleys, voids/ridges, boundaries/barriers
          — are conceptually striking, but the two frameworks operate at different levels of
          biological organization. Formal mathematical proof connecting the two frameworks remains an
          open problem. These mappings are associative, not causal.
        </p>
      </div>
    </>
  );
}

export default function ConvergenceMap() {
  const [selected, setSelected] = useState<string | null>(null);

  const selectedNode = useMemo(
    () => DISCOVERIES.find(d => d.id === selected) ?? null,
    [selected]
  );

  const connectedNodes = useMemo(() => {
    if (!selected) return [];
    const node = DISCOVERIES.find(d => d.id === selected);
    if (!node) return [];
    const connectedIds = new Set(node.connections);
    DISCOVERIES.forEach(d => {
      if (d.connections.includes(selected)) connectedIds.add(d.id);
    });
    return DISCOVERIES.filter(d => connectedIds.has(d.id));
  }, [selected]);

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50"
      data-testid="convergence-map-page"
    >
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-3 mb-2">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-1" data-testid="link-back">
              <ArrowLeft size={14} /> Home
            </Button>
          </Link>
        </div>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <GitMerge size={24} className="text-amber-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900" data-testid="text-heading">
                Convergence Map
              </h1>
              <p className="text-sm text-muted-foreground">
                Two independent research programs — same biological truth
              </p>
            </div>
          </div>
          <p className="text-sm text-slate-600 max-w-3xl leading-relaxed mt-3">
            Boman Lab's published tissue renewal research (2001–2026) and the PAR(2) Engine's
            independent autoregressive analysis arrived at the same conclusions through entirely
            different methods. Click any node below to see details and connections.
          </p>
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/30">
              Boman Lab: 5 rules
            </Badge>
            <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/30">
              Circadian Canon: 6 points
            </Badge>
            <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/30">
              Waddington: 5 points
            </Badge>
            <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30">
              PAR(2): independent rediscovery
            </Badge>
          </div>
        </div>

        <Card className="bg-white border-slate-200 mb-6">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-sm text-slate-700 flex items-center gap-2">
              <GitMerge size={15} className="text-amber-500" />
              Discovery Convergence — Boman Lab ↔ PAR(2) Engine
            </CardTitle>
            <CardDescription className="text-xs">
              Click any node to see its full description and connected discoveries
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <ConvergenceFlowDiagram selected={selected} onSelect={setSelected} />
          </CardContent>
        </Card>

        {selectedNode && (
          <div className="mb-6 space-y-3" data-testid="detail-panel">
            <DetailPanel node={selectedNode} />
            {connectedNodes.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
                  Connected Discoveries
                </p>
                {connectedNodes.map(n => (
                  <DetailPanel key={n.id} node={n} />
                ))}
              </div>
            )}
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <Card className="bg-blue-500/5 border-blue-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-blue-400 flex items-center gap-2">
                <Microscope size={16} /> Boman Lab Stream
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Published research (2001–2026)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {DISCOVERIES.filter(d => d.source === "boman").map(n => (
                <button
                  key={n.id}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selected === n.id
                      ? "bg-blue-500/15 border-blue-500/40"
                      : "bg-slate-50 border-slate-200 hover:border-blue-500/30"
                  }`}
                  onClick={() => setSelected(selected === n.id ? null : n.id)}
                  data-testid={`button-node-list-${n.id}`}
                >
                  <p className="text-sm font-medium text-slate-900">{n.label}</p>
                  <p className="text-[10px] text-blue-400/70 mt-0.5">{n.year}</p>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-amber-500/5 border-amber-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-amber-400 flex items-center gap-2">
                <GitMerge size={16} /> Convergence Points
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Where both streams agree independently
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {DISCOVERIES.filter(d => d.source === "convergence").map(n => (
                <button
                  key={n.id}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selected === n.id
                      ? "bg-amber-500/15 border-amber-500/40"
                      : "bg-slate-50 border-slate-200 hover:border-amber-500/30"
                  }`}
                  onClick={() => setSelected(selected === n.id ? null : n.id)}
                  data-testid={`button-node-list-${n.id}`}
                >
                  <p className="text-sm font-medium text-slate-900">{n.label}</p>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-cyan-500/5 border-cyan-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-cyan-400 flex items-center gap-2">
                <Dna size={16} /> PAR(2) Engine Stream
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Independent autoregressive discoveries
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {DISCOVERIES.filter(d => d.source === "par2").map(n => (
                <button
                  key={n.id}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selected === n.id
                      ? "bg-cyan-500/15 border-cyan-500/40"
                      : "bg-slate-50 border-slate-200 hover:border-cyan-500/30"
                  }`}
                  onClick={() => setSelected(selected === n.id ? null : n.id)}
                  data-testid={`button-node-list-${n.id}`}
                >
                  <p className="text-sm font-medium text-slate-900">{n.label}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-[10px] text-cyan-400/70">{n.year}</p>
                    {n.confidence && <ConfidenceBadge confidence={n.confidence} />}
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        <FiveRulesSection />
        <CircadianCanonSection />
        <WaddingtonSection />
      </div>
    </div>
  );
}
