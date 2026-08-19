import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Loader2, Eye, EyeOff, Info, Zap, Link2, CircleDot, ChevronRight,
  Play, Pause, RotateCcw, FastForward, Download,
} from "lucide-react";
import { downloadAsCSV } from "@/components/DownloadResultsButton";
import PaperCrossLinks from "@/components/PaperCrossLinks";
import GeneTooltip from "@/components/GeneTooltip";

interface GeneNode {
  gene: string;
  peakPhase: number;
  troughPhase: number;
  amplitude: number;
  meanExpression: number;
  r2: number;
  category: string;
  subcategory: string;
  color: string;
  description: string;
  coupling: {
    clockPredictor: string;
    deltaAIC: number;
    couplingPValue: number;
    deltaR2: number;
    significant: boolean;
  } | null;
}

interface CouplingLink {
  source: string;
  target: string;
  pValue: number;
  deltaAIC: number;
  deltaR2: number;
  significant: boolean;
  type: string;
}

interface KnownInteraction {
  source: string;
  target: string;
  type: string;
  description: string;
  evidence: string;
}

interface Category {
  id: string;
  label: string;
  genes: string[];
  color: string;
  icon: string;
}

interface PortraitData {
  dataset: string;
  geneNodes: GeneNode[];
  couplingLinks: CouplingLink[];
  categories: Category[];
  knownInteractions: KnownInteraction[];
  phaseLocking: {
    rayleighP: number;
    rayleighZ: number;
    significant: boolean;
    circularMean: number;
    circularSD: number;
  };
  phaseOpposition: {
    wee1Cdk1: { phaseDifference: number; consistent: boolean; deviationFromOpposition: number } | null;
    wee1Ccnb1: { phaseDifference: number; consistent: boolean; deviationFromOpposition: number } | null;
  };
  overallAssessment: {
    phaseLockingSupported: boolean;
    phaseOppositionSupported: boolean;
    couplingSupported: boolean;
    overallVerdict: string;
    caveats: string[];
  };
}

const OTHER_DATASETS = [
  { id: "GSE11923_Liver_1h_48h_genes.csv", label: "Mouse Liver (Hughes 2009, 1h res)" },
];

type LinkLayer = 'coupling' | 'known' | 'opposition';

const LINK_LAYERS: { id: LinkLayer; label: string; color: string }[] = [
  { id: 'coupling', label: 'PAR(2) Coupling (significant)', color: '#22d3ee' },
  { id: 'known', label: 'Known Interactions (literature)', color: '#a3e635' },
  { id: 'opposition', label: 'Phase Opposition Pairs', color: '#fb923c' },
];

function phaseToAngle(phase: number): number {
  return ((phase / 24) * 360 - 90) * (Math.PI / 180);
}

function polarToXY(phase: number, radius: number, cx: number, cy: number): [number, number] {
  const angle = phaseToAngle(phase);
  return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
}

function phaseDist(a: number, b: number): number {
  const d = Math.abs(a - b);
  return Math.min(d, 24 - d);
}

function PhaseClockSVG({
  genes,
  links,
  knownInteractions,
  activeCategories,
  activeLinkLayers,
  selectedGene,
  onSelectGene,
  hoveredGene,
  onHoverGene,
  animationTime,
  isAnimating,
  animationSpeed,
  onAnimationTimeUpdate,
}: {
  genes: GeneNode[];
  links: CouplingLink[];
  knownInteractions: KnownInteraction[];
  activeCategories: Set<string>;
  activeLinkLayers: Set<LinkLayer>;
  selectedGene: string | null;
  onSelectGene: (g: string | null) => void;
  hoveredGene: string | null;
  onHoverGene: (g: string | null) => void;
  animationTime: number | null;
  isAnimating: boolean;
  animationSpeed: number;
  onAnimationTimeUpdate: (time: number) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const cursorGroupRef = useRef<SVGGElement>(null);
  const localTimeRef = useRef(animationTime ?? 0);
  const lastReportRef = useRef(0);

  useEffect(() => {
    localTimeRef.current = animationTime ?? 0;
  }, [animationTime]);

  useEffect(() => {
    if (!isAnimating) return;
    let lastTs = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const dt = (now - lastTs) / 1000;
      lastTs = now;
      localTimeRef.current = (localTimeRef.current + dt * animationSpeed * 2) % 24;

      if (cursorGroupRef.current) {
        const t = localTimeRef.current;
        const angle = ((t / 24) * 360 - 90) * (Math.PI / 180);
        const lx = 300 + 228 * Math.cos(angle);
        const ly = 300 + 228 * Math.sin(angle);
        const line = cursorGroupRef.current.querySelector('.cursor-line') as SVGLineElement;
        const dot = cursorGroupRef.current.querySelector('.cursor-dot') as SVGCircleElement;
        const label = cursorGroupRef.current.querySelector('.cursor-label') as SVGTextElement;
        if (line) { line.setAttribute('x2', String(lx)); line.setAttribute('y2', String(ly)); }
        if (dot) { dot.setAttribute('cx', String(lx)); dot.setAttribute('cy', String(ly)); }
        if (label) { label.textContent = `CT${t.toFixed(1)}`; }
      }

      if (now - lastReportRef.current > 150) {
        lastReportRef.current = now;
        onAnimationTimeUpdate(localTimeRef.current);
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isAnimating, animationSpeed, onAnimationTimeUpdate]);
  const size = 600;
  const cx = size / 2;
  const cy = size / 2;
  const clockRadius = 220;
  const geneRadius = 180;
  const innerRadius = 100;

  const visibleGenes = useMemo(() => {
    return genes.filter(g => activeCategories.has(g.subcategory));
  }, [genes, activeCategories]);

  const genePositions = useMemo(() => {
    const positions = new Map<string, [number, number]>();
    const phaseGroups: Record<number, GeneNode[]> = {};
    for (const g of visibleGenes) {
      const roundedPhase = Math.round(g.peakPhase * 2) / 2;
      if (!phaseGroups[roundedPhase]) phaseGroups[roundedPhase] = [];
      phaseGroups[roundedPhase].push(g);
    }
    for (const phaseKey of Object.keys(phaseGroups)) {
      const phase = Number(phaseKey);
      const group = phaseGroups[phase];
      if (group.length === 1) {
        positions.set(group[0].gene, polarToXY(phase, geneRadius, cx, cy));
      } else {
        const spread = Math.min(0.8, group.length * 0.25);
        group.forEach((g: GeneNode, i: number) => {
          const offset = (i - (group.length - 1) / 2) * spread;
          const r = geneRadius + (i % 2 === 0 ? -12 : 12);
          positions.set(g.gene, polarToXY(phase + offset, r, cx, cy));
        });
      }
    }
    return positions;
  }, [visibleGenes, cx, cy]);

  const visibleLinks = useMemo(() => {
    const result: Array<{
      x1: number; y1: number; x2: number; y2: number;
      color: string; dashed: boolean; label: string; opacity: number;
    }> = [];
    const visibleGeneNames = new Set(visibleGenes.map(g => g.gene));

    if (activeLinkLayers.has('coupling')) {
      for (const link of links) {
        if (link.type === 'clock_coupling' && link.significant) {
          const srcPos = genePositions.get(link.source);
          const tgtPos = genePositions.get(link.target);
          if (srcPos && tgtPos && visibleGeneNames.has(link.source) && visibleGeneNames.has(link.target)) {
            const isHighlighted = selectedGene === link.source || selectedGene === link.target;
            result.push({
              x1: srcPos[0], y1: srcPos[1], x2: tgtPos[0], y2: tgtPos[1],
              color: '#22d3ee', dashed: false,
              label: `ΔAIC=${link.deltaAIC.toFixed(1)} p=${link.pValue.toFixed(3)}`,
              opacity: selectedGene ? (isHighlighted ? 1 : 0.15) : 0.7,
            });
          }
        }
      }
    }

    if (activeLinkLayers.has('opposition')) {
      for (const link of links) {
        if (link.type === 'phase_opposition') {
          const srcPos = genePositions.get(link.source);
          const tgtPos = genePositions.get(link.target);
          if (srcPos && tgtPos && visibleGeneNames.has(link.source) && visibleGeneNames.has(link.target)) {
            const isHighlighted = selectedGene === link.source || selectedGene === link.target;
            result.push({
              x1: srcPos[0], y1: srcPos[1], x2: tgtPos[0], y2: tgtPos[1],
              color: link.significant ? '#22c55e' : '#fb923c', dashed: !link.significant,
              label: link.significant ? 'Anti-phase confirmed' : 'Anti-phase NOT confirmed',
              opacity: selectedGene ? (isHighlighted ? 1 : 0.15) : 0.6,
            });
          }
        }
      }
    }

    if (activeLinkLayers.has('known')) {
      for (const ki of knownInteractions) {
        const srcPos = genePositions.get(ki.source);
        const tgtPos = genePositions.get(ki.target);
        if (srcPos && tgtPos && visibleGeneNames.has(ki.source) && visibleGeneNames.has(ki.target)) {
          const isHighlighted = selectedGene === ki.source || selectedGene === ki.target;
          const color = ki.type === 'activates' ? '#a3e635' : ki.type === 'represses' ? '#f87171' : ki.type === 'inhibits' ? '#fb923c' : '#94a3b8';
          result.push({
            x1: srcPos[0], y1: srcPos[1], x2: tgtPos[0], y2: tgtPos[1],
            color, dashed: true,
            label: `${ki.type}: ${ki.description.substring(0, 60)}`,
            opacity: selectedGene ? (isHighlighted ? 0.9 : 0.08) : 0.35,
          });
        }
      }
    }

    return result;
  }, [links, knownInteractions, genePositions, activeLinkLayers, selectedGene, visibleGenes]);

  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${size} ${size}`}
      className="w-full h-full"
      style={{ maxHeight: '600px' }}
      data-testid="svg-phase-portrait"
    >
      <defs>
        <radialGradient id="clockBg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#0f172a" />
        </radialGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <marker id="arrowhead-green" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#a3e635" opacity="0.6" />
        </marker>
        <marker id="arrowhead-red" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#f87171" opacity="0.6" />
        </marker>
        <marker id="arrowhead-cyan" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#22d3ee" opacity="0.7" />
        </marker>
        <marker id="arrowhead-orange" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#fb923c" opacity="0.6" />
        </marker>
        <filter id="activeGlow">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="cursorGlow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <circle cx={cx} cy={cy} r={clockRadius + 30} fill="url(#clockBg)" stroke="#334155" strokeWidth="1" />

      <circle cx={cx} cy={cy} r={clockRadius} fill="none" stroke="#475569" strokeWidth="1" opacity="0.5" />
      <circle cx={cx} cy={cy} r={innerRadius} fill="none" stroke="#334155" strokeWidth="1" opacity="0.3" />
      <circle cx={cx} cy={cy} r={geneRadius} fill="none" stroke="#334155" strokeWidth="1" strokeDasharray="4 4" opacity="0.3" />

      <path d={`M ${cx} ${cy - clockRadius + 5} L ${cx} ${cy + clockRadius - 5}`} stroke="#334155" strokeWidth="0.5" opacity="0.3" />
      <path d={`M ${cx - clockRadius + 5} ${cy} L ${cx + clockRadius - 5} ${cy}`} stroke="#334155" strokeWidth="0.5" opacity="0.3" />

      <rect x={cx - clockRadius - 20} y={cy - clockRadius - 20} width={clockRadius + 20} height={clockRadius + 20}
        fill="#facc15" opacity="0.03" rx="4" />
      <rect x={cx} y={cy - clockRadius - 20} width={clockRadius + 20} height={clockRadius + 20}
        fill="#facc15" opacity="0.02" rx="4" />
      <rect x={cx} y={cy} width={clockRadius + 20} height={clockRadius + 20}
        fill="#3b82f6" opacity="0.03" rx="4" />
      <rect x={cx - clockRadius - 20} y={cy} width={clockRadius + 20} height={clockRadius + 20}
        fill="#3b82f6" opacity="0.02" rx="4" />

      {hours.map(h => {
        const [tx, ty] = polarToXY(h, clockRadius + 18, cx, cy);
        const [lx1, ly1] = polarToXY(h, clockRadius - 3, cx, cy);
        const [lx2, ly2] = polarToXY(h, clockRadius + 3, cx, cy);
        const isMajor = h % 6 === 0;
        return (
          <g key={`hour-${h}`}>
            <line x1={lx1} y1={ly1} x2={lx2} y2={ly2}
              stroke={isMajor ? "#94a3b8" : "#475569"} strokeWidth={isMajor ? 1.5 : 0.5} />
            {(h % 3 === 0) && (
              <text x={tx} y={ty} textAnchor="middle" dominantBaseline="central"
                fill={isMajor ? "#e2e8f0" : "#94a3b8"} fontSize={isMajor ? 13 : 10} fontWeight={isMajor ? 600 : 400}>
                CT{h}
              </text>
            )}
          </g>
        );
      })}

      <text x={cx} y={cy - clockRadius - 28} textAnchor="middle" fill="#d97706" fontSize="10" opacity="1" fontWeight="600">DAWN</text>
      <text x={cx + clockRadius + 28} y={cy} textAnchor="middle" fill="#b45309" fontSize="10" opacity="1" fontWeight="600">NOON</text>
      <text x={cx} y={cy + clockRadius + 32} textAnchor="middle" fill="#2563eb" fontSize="10" opacity="1" fontWeight="600">DUSK</text>
      <text x={cx - clockRadius - 28} y={cy} textAnchor="middle" fill="#4338ca" fontSize="10" opacity="1" fontWeight="600">MIDNIGHT</text>

      {visibleLinks.map((link, i) => {
        const dx = link.x2 - link.x1;
        const dy = link.y2 - link.y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        const nx = dx / len;
        const ny = dy / len;
        const x1 = link.x1 + nx * 14;
        const y1 = link.y1 + ny * 14;
        const x2 = link.x2 - nx * 14;
        const y2 = link.y2 - ny * 14;
        const markerColor = link.color === '#a3e635' ? 'green' : link.color === '#f87171' ? 'red' : link.color === '#22d3ee' ? 'cyan' : 'orange';
        return (
          <line key={`link-${i}`}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={link.color} strokeWidth={link.dashed ? 1 : 2}
            strokeDasharray={link.dashed ? "6 3" : undefined}
            opacity={link.opacity}
            markerEnd={`url(#arrowhead-${markerColor})`}
          >
            <title>{link.label}</title>
          </line>
        );
      })}

      {animationTime !== null && (() => {
        const [lx, ly] = polarToXY(animationTime, clockRadius + 8, cx, cy);
        return (
          <g ref={cursorGroupRef}>
            <line className="cursor-line" x1={cx} y1={cy} x2={lx} y2={ly}
              stroke="#fbbf24" strokeWidth="2" opacity="0.8" filter="url(#cursorGlow)" />
            <circle className="cursor-dot" cx={lx} cy={ly} r="4" fill="#fbbf24" opacity="0.9" filter="url(#cursorGlow)" />
            <circle cx={cx} cy={cy} r="5" fill="#fbbf24" opacity="0.6" />
            <text className="cursor-label" x={cx} y={cy + 28} textAnchor="middle" fill="#fbbf24" fontSize="14" fontWeight="700" fontFamily="monospace">
              CT{animationTime.toFixed(1)}
            </text>
          </g>
        );
      })()}

      {visibleGenes.map(gene => {
        const pos = genePositions.get(gene.gene);
        if (!pos) return null;
        const [gx, gy] = pos;
        const isSelected = selectedGene === gene.gene;
        const isHovered = hoveredGene === gene.gene;
        const isDimmed = selectedGene !== null && !isSelected &&
          !links.some(l => (l.source === selectedGene && l.target === gene.gene) || (l.target === selectedGene && l.source === gene.gene)) &&
          !knownInteractions.some(ki => (ki.source === selectedGene && ki.target === gene.gene) || (ki.target === selectedGene && ki.source === gene.gene));

        const baseRadius = Math.max(8, Math.min(18, 6 + gene.r2 * 14));
        const hasCoupling = gene.coupling?.significant;

        const dist = animationTime !== null ? phaseDist(animationTime, gene.peakPhase) : 24;
        const isActive = dist < 1.5;
        const isPeaking = dist < 0.5;
        const activationIntensity = isActive ? Math.max(0, 1 - dist / 1.5) : 0;
        const pulseScale = isPeaking ? 1.4 : isActive ? 1 + activationIntensity * 0.3 : 1;
        const r = (isSelected ? baseRadius + 3 : isHovered ? baseRadius + 2 : baseRadius) * (animationTime !== null ? pulseScale : 1);

        const glowOpacity = isPeaking ? 0.9 : isActive ? activationIntensity * 0.6 : 0;
        const useGlow = isHovered || isSelected || isPeaking;
        const nodeOpacity = animationTime !== null
          ? (isActive ? 0.95 : 0.25 + gene.r2 * 0.2)
          : (isDimmed ? 0.2 : 0.85);

        return (
          <g key={gene.gene}
            onClick={() => onSelectGene(isSelected ? null : gene.gene)}
            onMouseEnter={() => onHoverGene(gene.gene)}
            onMouseLeave={() => onHoverGene(null)}
            style={{ cursor: 'pointer', transition: 'opacity 0.3s ease' }}
            opacity={isDimmed && animationTime === null ? 0.2 : 1}
            data-testid={`node-gene-${gene.gene}`}
          >
            {isActive && animationTime !== null && (
              <circle cx={gx} cy={gy} r={r + 8} fill={gene.color} opacity={glowOpacity * 0.3} filter="url(#activeGlow)" />
            )}
            {isSelected && (
              <circle cx={gx} cy={gy} r={r + 4} fill="none" stroke="#ffffff" strokeWidth="2" opacity="0.6" />
            )}
            {hasCoupling && (
              <circle cx={gx} cy={gy} r={r + 3} fill="none" stroke="#22d3ee" strokeWidth="1.5" strokeDasharray="3 2"
                opacity={animationTime !== null ? (isActive ? 0.9 : 0.2) : 0.8} />
            )}
            <circle cx={gx} cy={gy} r={r} fill={gene.color}
              opacity={nodeOpacity}
              filter={useGlow ? "url(#glow)" : undefined}
              style={{ transition: 'r 0.2s ease, opacity 0.2s ease' }}
            />
            <circle cx={gx} cy={gy} r={r} fill="none"
              stroke={isPeaking ? "#fbbf24" : isSelected ? "#ffffff" : gene.color}
              strokeWidth={isPeaking ? 2.5 : isSelected ? 2 : 1}
              opacity={animationTime !== null ? (isActive ? 0.95 : 0.3) : 0.9} />
            <text x={gx} y={gy - r - 5} textAnchor="middle"
              fill={isPeaking ? "#fbbf24" : isActive ? "#f1f5f9" : animationTime !== null ? "#64748b" : "#e2e8f0"}
              fontSize={isPeaking ? 12 : isSelected || isHovered ? 11 : 9}
              fontWeight={isPeaking ? 800 : isSelected ? 700 : isHovered ? 600 : 400}
              style={{ pointerEvents: 'none', transition: 'fill 0.2s ease' }}>
              {gene.gene}
            </text>
          </g>
        );
      })}

      {animationTime === null && (
        <>
          <text x={cx} y={cy - 8} textAnchor="middle" fill="#94a3b8" fontSize="11" fontWeight="500">24h Clock</text>
          <text x={cx} y={cy + 8} textAnchor="middle" fill="#475569" fontSize="9">Phase Portrait</text>
        </>
      )}
    </svg>
  );
}

function GeneDetailPanel({ gene, genes, links, knownInteractions }: {
  gene: string;
  genes: GeneNode[];
  links: CouplingLink[];
  knownInteractions: KnownInteraction[];
}) {
  const geneData = genes.find(g => g.gene === gene);
  if (!geneData) return null;

  const relatedCouplings = links.filter(l => l.source === gene || l.target === gene);
  const relatedInteractions = knownInteractions.filter(ki => ki.source === gene || ki.target === gene);

  return (
    <div className="space-y-4" data-testid={`panel-gene-detail-${gene}`}>
      <div className="flex items-center gap-3">
        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: geneData.color }} />
        <div>
          <h3 className="text-lg font-bold text-slate-900 font-mono"><GeneTooltip gene={gene}>{gene}</GeneTooltip></h3>
          <p className="text-xs text-slate-500">{geneData.description}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider">Peak Phase</div>
          <div className="text-lg font-mono font-bold text-slate-900">CT{geneData.peakPhase.toFixed(1)}</div>
        </div>
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider">Trough</div>
          <div className="text-lg font-mono font-bold text-slate-900">CT{geneData.troughPhase.toFixed(1)}</div>
        </div>
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider">Cosinor R²</div>
          <div className={`text-lg font-mono font-bold ${geneData.r2 > 0.3 ? 'text-emerald-400' : geneData.r2 > 0.1 ? 'text-amber-400' : 'text-red-400'}`}>
            {geneData.r2.toFixed(3)}
          </div>
        </div>
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider">Amplitude</div>
          <div className="text-lg font-mono font-bold text-slate-900">{geneData.amplitude.toFixed(1)}</div>
        </div>
      </div>

      <div className="bg-slate-50 rounded-lg p-3">
        <div className="text-xs text-slate-500 mb-1">Category</div>
        <Badge style={{ backgroundColor: geneData.color + '30', color: geneData.color, borderColor: geneData.color + '50' }} variant="outline">
          {geneData.subcategory}
        </Badge>
      </div>

      {geneData.coupling && (
        <div className={`rounded-lg p-3 border ${geneData.coupling.significant ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-slate-50 border-slate-200'}`}>
          <div className="text-xs text-slate-500 mb-2">Clock Coupling (AR(2) + {geneData.coupling.clockPredictor})</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-slate-500">ΔAIC: </span>
              <span className={`font-mono ${geneData.coupling.deltaAIC > 2 ? 'text-emerald-400' : 'text-slate-600'}`}>
                {geneData.coupling.deltaAIC.toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-slate-500">p: </span>
              <span className={`font-mono ${geneData.coupling.couplingPValue < 0.05 ? 'text-emerald-400' : 'text-slate-600'}`}>
                {geneData.coupling.couplingPValue.toFixed(4)}
              </span>
            </div>
            <div>
              <span className="text-slate-500">ΔR²: </span>
              <span className="font-mono text-slate-600">{geneData.coupling.deltaR2.toFixed(4)}</span>
            </div>
            <div>
              {geneData.coupling.significant
                ? <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">Significant</Badge>
                : <Badge className="bg-slate-100 text-slate-500 border-slate-200 text-[10px]">Not significant</Badge>}
            </div>
          </div>
        </div>
      )}

      {relatedCouplings.length > 0 && (
        <div>
          <div className="text-xs text-slate-500 mb-2 flex items-center gap-1">
            <Zap size={10} />
            PAR(2) Coupling Links ({relatedCouplings.length})
          </div>
          {relatedCouplings.map((link, i) => (
            <div key={i} className="flex items-center gap-2 text-xs py-1 border-b border-slate-800 last:border-0">
              <span className="font-mono text-slate-900"><GeneTooltip gene={link.source}>{link.source}</GeneTooltip></span>
              <ChevronRight size={10} className="text-cyan-400" />
              <span className="font-mono text-slate-900"><GeneTooltip gene={link.target}>{link.target}</GeneTooltip></span>
              <span className={`ml-auto font-mono ${link.significant ? 'text-emerald-400' : 'text-slate-500'}`}>
                p={link.pValue.toFixed(3)}
              </span>
            </div>
          ))}
        </div>
      )}

      {relatedInteractions.length > 0 && (
        <div>
          <div className="text-xs text-slate-500 mb-2 flex items-center gap-1">
            <Link2 size={10} />
            Known Interactions ({relatedInteractions.length})
          </div>
          {relatedInteractions.map((ki, i) => {
            const typeColor = ki.type === 'activates' ? 'text-green-400' : ki.type === 'represses' ? 'text-red-400' : ki.type === 'inhibits' ? 'text-orange-400' : 'text-slate-500';
            return (
              <div key={i} className="text-xs py-2 border-b border-slate-800 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-slate-900"><GeneTooltip gene={ki.source}>{ki.source}</GeneTooltip></span>
                  <span className={`${typeColor} font-medium`}>{ki.type}</span>
                  <span className="font-mono text-slate-900"><GeneTooltip gene={ki.target}>{ki.target}</GeneTooltip></span>
                </div>
                <p className="text-slate-500 mt-1">{ki.description}</p>
                <p className="text-slate-500 text-[10px] mt-0.5">{ki.evidence}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function PhasePortrait() {
  const [selectedTissue, setSelectedTissue] = useState("Liver");
  const [selectedOtherDataset, setSelectedOtherDataset] = useState<string | null>(null);
  const [activeCategories, setActiveCategories] = useState<Set<string>>(new Set());
  const [activeLinkLayers, setActiveLinkLayers] = useState<Set<LinkLayer>>(new Set<LinkLayer>(['coupling', 'known']));
  const [selectedGene, setSelectedGene] = useState<string | null>(null);
  const [hoveredGene, setHoveredGene] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationTime, setAnimationTime] = useState<number | null>(null);
  const [animationSpeed, setAnimationSpeed] = useState(1);

  const { data: tissueList } = useQuery<{ tissues: { id: string; label: string }[] }>({
    queryKey: ["/api/phase-portrait/tissues"],
    queryFn: async () => {
      const res = await fetch("/api/phase-portrait/tissues");
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    staleTime: 60 * 60 * 1000,
  });

  const toggleAnimation = useCallback(() => {
    if (!isAnimating) {
      if (animationTime === null) setAnimationTime(0);
      setIsAnimating(true);
    } else {
      setIsAnimating(false);
    }
  }, [isAnimating, animationTime]);

  const resetAnimation = useCallback(() => {
    setIsAnimating(false);
    setAnimationTime(null);
  }, []);

  const cycleSpeed = useCallback(() => {
    setAnimationSpeed(prev => prev >= 4 ? 0.5 : prev * 2);
  }, []);

  const queryUrl = selectedOtherDataset
    ? `/api/phase-portrait/data?dataset=${encodeURIComponent(selectedOtherDataset)}`
    : `/api/phase-portrait/data?tissue=${encodeURIComponent(selectedTissue)}`;

  const { data, isLoading, error } = useQuery<PortraitData>({
    queryKey: ["/api/phase-portrait/data", selectedOtherDataset || selectedTissue],
    queryFn: async () => {
      const res = await fetch(queryUrl);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const activeGenes = useMemo(() => {
    if (animationTime === null) return [];
    return (data?.geneNodes ?? [])
      .filter(g => activeCategories.has(g.subcategory) && phaseDist(animationTime, g.peakPhase) < 0.5)
      .sort((a, b) => phaseDist(animationTime, a.peakPhase) - phaseDist(animationTime, b.peakPhase));
  }, [animationTime, data, activeCategories]);

  useEffect(() => {
    if (data && !initialized) {
      setActiveCategories(new Set(data.categories.map(c => c.label)));
      setInitialized(true);
    }
  }, [data, initialized]);

  useEffect(() => {
    setInitialized(false);
    setSelectedGene(null);
    setIsAnimating(false);
    setAnimationTime(null);
  }, [selectedTissue, selectedOtherDataset]);

  const toggleCategory = useCallback((label: string) => {
    setActiveCategories(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }, []);

  const toggleLinkLayer = useCallback((layer: LinkLayer) => {
    setActiveLinkLayers(prev => {
      const next = new Set(prev);
      if (next.has(layer)) next.delete(layer);
      else next.add(layer);
      return next;
    });
  }, []);

  const showAll = useCallback(() => {
    if (data) setActiveCategories(new Set(data.categories.map(c => c.label)));
  }, [data]);

  const hideAll = useCallback(() => {
    setActiveCategories(new Set());
  }, []);

  const visibleCount = data ? data.geneNodes.filter(g => activeCategories.has(g.subcategory)).length : 0;
  const significantCouplings = data ? data.couplingLinks.filter(l => l.type === 'clock_coupling' && l.significant).length : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 text-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/">
            <Button variant="outline" size="sm" className="gap-2 border-slate-200 text-slate-600 hover:bg-slate-100" data-testid="link-back-home">
              <ArrowLeft size={14} />
              Home
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent flex items-center gap-2" data-testid="text-page-title">
              <CircleDot size={24} className="text-cyan-400" />
              Phase Portrait Explorer
            </h1>
            <p className="text-sm text-slate-500 mt-1">Interactive circadian phase map across 12 tissues — compare gene timing, coupling, and interactions</p>
            <div className="rounded-lg bg-slate-100 border border-slate-200 p-4 mt-3">
              <p className="text-sm text-slate-600 leading-relaxed">
                <strong className="text-slate-900">What you can do:</strong> Visualizes gene expression patterns over a 24-hour cycle across 12 mouse tissues. BMAL1 coupling analysis tests for statistical association between each gene and the BMAL1 clock gene. Download coupling results for your tissue-specific analysis.
              </p>
            </div>
          </div>
          {data && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-slate-300 text-slate-600 hover:bg-slate-100"
              data-testid="button-download-results"
              onClick={() => {
                const csvData = data.geneNodes.map(g => ({
                  gene: g.gene,
                  peakPhase: g.peakPhase,
                  troughPhase: g.troughPhase,
                  amplitude: g.amplitude,
                  meanExpression: g.meanExpression,
                  r2: g.r2,
                  category: g.category,
                  subcategory: g.subcategory,
                  couplingPredictor: g.coupling?.clockPredictor ?? '',
                  couplingDeltaAIC: g.coupling?.deltaAIC ?? '',
                  couplingPValue: g.coupling?.couplingPValue ?? '',
                  couplingDeltaR2: g.coupling?.deltaR2 ?? '',
                  couplingSignificant: g.coupling?.significant ?? '',
                }));
                downloadAsCSV(csvData, "PAR2_PhasePortrait_Results.csv");
              }}
            >
              <Download className="h-4 w-4" />
              Download Results (CSV)
            </Button>
          )}
        </div>

        <PaperCrossLinks currentPage="/phase-portrait" />

        <Card className="bg-white border-slate-200 mb-4" data-testid="card-dataset-selector">
          <CardContent className="pt-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <label className="text-sm font-medium text-slate-600 whitespace-nowrap">Tissue</label>
                <div className="flex flex-wrap gap-1.5">
                  {(tissueList?.tissues ?? []).map(t => (
                    <Button
                      key={t.label}
                      size="sm"
                      variant={selectedTissue === t.label && !selectedOtherDataset ? "default" : "outline"}
                      className={`text-xs h-7 px-2.5 ${selectedTissue === t.label && !selectedOtherDataset ? 'bg-cyan-600 hover:bg-cyan-700 text-slate-900 border-cyan-500' : 'border-slate-300 text-slate-600 hover:bg-slate-200'}`}
                      onClick={() => { setSelectedTissue(t.label); setSelectedOtherDataset(null); }}
                      data-testid={`btn-tissue-${t.label}`}
                    >
                      {t.label}
                    </Button>
                  ))}
                </div>
                <div className="flex items-center gap-3 ml-auto text-xs text-slate-500">
                  <span>{visibleCount} genes visible</span>
                  <span className="text-cyan-400">{significantCouplings} coupled</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs text-slate-500 whitespace-nowrap">Other datasets</label>
                <Select
                  value={selectedOtherDataset ?? "__none__"}
                  onValueChange={(v) => { if (v === "__none__") { setSelectedOtherDataset(null); } else { setSelectedOtherDataset(v); } }}
                >
                  <SelectTrigger className="bg-slate-50 border-slate-200 text-slate-600 text-xs h-7 max-w-xs" data-testid="select-other-dataset">
                    <SelectValue placeholder="Zhang 2014 tissues selected" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-100 border-slate-200">
                    <SelectItem value="__none__" className="text-xs">Use tissue selector above</SelectItem>
                    {OTHER_DATASETS.map(ds => (
                      <SelectItem key={ds.id} value={ds.id} className="text-xs" data-testid={`select-dataset-item-${ds.id}`}>
                        {ds.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-[10px] text-slate-500">
                  {selectedOtherDataset ? 'Showing: ' + OTHER_DATASETS.find(d => d.id === selectedOtherDataset)?.label : `GSE54650 · ${selectedTissue} · Zhang et al. 2014`}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20" data-testid="loading-state">
            <Loader2 className="h-10 w-10 animate-spin text-cyan-400 mb-4" />
            <p className="text-slate-500 text-lg">Computing phase portrait...</p>
          </div>
        )}

        {error && (
          <Card className="bg-red-500/10 border-red-500/30 mb-6" data-testid="error-state">
            <CardContent className="pt-4">
              <p className="text-red-400 text-sm">{(error as Error).message}</p>
            </CardContent>
          </Card>
        )}

        {data && !isLoading && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-1 space-y-4">
              <Card className="bg-white border-slate-200" data-testid="card-categories">
                <CardHeader className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm text-slate-900">Gene Categories ({data.categories.length})</CardTitle>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={showAll} className="text-[10px] h-6 px-2 text-slate-500 hover:text-slate-700" data-testid="button-show-all">
                        <Eye size={10} className="mr-1" /> All
                      </Button>
                      <Button variant="ghost" size="sm" onClick={hideAll} className="text-[10px] h-6 px-2 text-slate-500 hover:text-slate-700" data-testid="button-hide-all">
                        <EyeOff size={10} className="mr-1" /> None
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="py-0 px-4 pb-4 space-y-1">
                  {data.categories.map(cat => {
                    const isActive = activeCategories.has(cat.label);
                    const geneCount = data.geneNodes.filter(g => g.subcategory === cat.label).length;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => toggleCategory(cat.label)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-left transition-all ${
                          isActive ? 'bg-slate-50 hover:bg-slate-100' : 'opacity-40 hover:opacity-70'
                        }`}
                        data-testid={`toggle-category-${cat.id}`}
                      >
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color, opacity: isActive ? 1 : 0.3 }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-slate-900 truncate">{cat.label}</div>
                          <div className="text-[10px] text-slate-500">{geneCount} gene{geneCount !== 1 ? 's' : ''}</div>
                        </div>
                        {isActive ? <Eye size={12} className="text-slate-500 shrink-0" /> : <EyeOff size={12} className="text-slate-500 shrink-0" />}
                      </button>
                    );
                  })}
                </CardContent>
              </Card>

              <Card className="bg-white border-slate-200" data-testid="card-link-layers">
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm text-slate-900">Connection Layers</CardTitle>
                </CardHeader>
                <CardContent className="py-0 px-4 pb-4 space-y-1">
                  {LINK_LAYERS.map(layer => {
                    const isActive = activeLinkLayers.has(layer.id);
                    return (
                      <button
                        key={layer.id}
                        onClick={() => toggleLinkLayer(layer.id)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-left transition-all ${
                          isActive ? 'bg-slate-50 hover:bg-slate-100' : 'opacity-40 hover:opacity-70'
                        }`}
                        data-testid={`toggle-link-${layer.id}`}
                      >
                        <div className="w-6 h-0.5 shrink-0" style={{ backgroundColor: layer.color, opacity: isActive ? 1 : 0.3 }} />
                        <span className="text-xs text-slate-900 flex-1">{layer.label}</span>
                        {isActive ? <Eye size={12} className="text-slate-500" /> : <EyeOff size={12} className="text-slate-500" />}
                      </button>
                    );
                  })}
                </CardContent>
              </Card>

              <Card className="bg-white border-slate-200" data-testid="card-assessment">
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm text-slate-900">Statistical Assessment</CardTitle>
                </CardHeader>
                <CardContent className="py-0 px-4 pb-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Phase-locking</span>
                    <Badge className={data.overallAssessment.phaseLockingSupported
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                      : "bg-red-500/20 text-red-400 border-red-500/30"} variant="outline">
                      {data.overallAssessment.phaseLockingSupported ? 'Supported' : 'Not supported'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Phase opposition</span>
                    <Badge className={data.overallAssessment.phaseOppositionSupported
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                      : "bg-red-500/20 text-red-400 border-red-500/30"} variant="outline">
                      {data.overallAssessment.phaseOppositionSupported ? 'Supported' : 'Not supported'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Clock coupling</span>
                    <Badge className={data.overallAssessment.couplingSupported
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                      : "bg-amber-500/20 text-amber-400 border-amber-500/30"} variant="outline">
                      {data.overallAssessment.couplingSupported ? 'Supported' : 'Gene-specific'}
                    </Badge>
                  </div>
                  <div className="mt-2 bg-slate-50 rounded p-2">
                    <p className="text-[10px] text-slate-500 leading-relaxed">{data.overallAssessment.overallVerdict}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border-slate-200" data-testid="card-coupling-summary">
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm text-slate-900">Coupling by Category</CardTitle>
                  <CardDescription className="text-[10px] text-slate-500">Significant BMAL1 coupling rate per gene group</CardDescription>
                </CardHeader>
                <CardContent className="py-0 px-4 pb-4 space-y-1.5">
                  {data.categories.filter(cat => !['Core Clock Activators', 'Period Genes', 'Cryptochrome Genes', 'Nuclear Receptors', 'Clock-Controlled Output'].includes(cat.label) && data.geneNodes.some(g => g.subcategory === cat.label)).map(cat => {
                    const catGenes = data.geneNodes.filter(g => g.subcategory === cat.label);
                    const coupled = catGenes.filter(g => g.coupling?.significant);
                    const rate = catGenes.length > 0 ? (coupled.length / catGenes.length * 100).toFixed(0) : '0';
                    const isControl = cat.id === 'housekeeping';
                    const isZero = coupled.length === 0;
                    return (
                      <div key={cat.id} className="flex items-center gap-2 text-xs">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                        <span className="text-slate-600 flex-1 truncate">{cat.label}</span>
                        <span className={`font-mono font-bold ${isZero ? 'text-slate-500' : isControl ? 'text-amber-400' : 'text-cyan-400'}`}>
                          {coupled.length}/{catGenes.length}
                        </span>
                        <span className={`font-mono text-[10px] w-8 text-right ${isZero ? 'text-slate-500' : isControl ? 'text-amber-400' : 'text-cyan-300'}`}>
                          {rate}%
                        </span>
                      </div>
                    );
                  })}
                  <div className="mt-2 bg-amber-500/10 border border-amber-500/20 rounded p-2">
                    <p className="text-[10px] text-amber-300 leading-relaxed">
                      {(() => {
                        const hkGenes = data.geneNodes.filter(g => g.subcategory === 'Housekeeping Genes');
                        const hkCoupled = hkGenes.filter(g => g.coupling?.significant);
                        const repairGenes = data.geneNodes.filter(g => g.subcategory === 'DNA Repair Genes');
                        const repairCoupled = repairGenes.filter(g => g.coupling?.significant);
                        if (hkCoupled.length > 0 && repairCoupled.length === 0) {
                          return `Caveat: ${hkCoupled.length} "housekeeping" genes show coupling (R² > 0.4), suggesting they oscillate in liver tissue — not true negative controls. DNA repair at 0/${repairGenes.length} may indicate post-transcriptional regulation.`;
                        }
                        if (repairCoupled.length === 0) {
                          return `DNA repair genes show 0/${repairGenes.length} coupling, possibly indicating post-transcriptional circadian regulation (protein-level, not mRNA).`;
                        }
                        return 'Cross-category coupling patterns reveal pathway-specific circadian regulation.';
                      })()}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2">
              <Card className="bg-white border-slate-200" data-testid="card-phase-clock">
                <CardContent className="p-4">
                  <PhaseClockSVG
                    genes={data.geneNodes}
                    links={data.couplingLinks}
                    knownInteractions={data.knownInteractions}
                    activeCategories={activeCategories}
                    activeLinkLayers={activeLinkLayers}
                    selectedGene={selectedGene}
                    onSelectGene={setSelectedGene}
                    hoveredGene={hoveredGene}
                    onHoverGene={setHoveredGene}
                    animationTime={animationTime}
                    isAnimating={isAnimating}
                    animationSpeed={animationSpeed}
                    onAnimationTimeUpdate={setAnimationTime}
                  />

                  <div className="flex items-center justify-center gap-2 mt-3" data-testid="animation-controls">
                    <Button variant="outline" size="sm"
                      onClick={toggleAnimation}
                      className={`gap-1.5 h-8 text-xs ${isAnimating ? 'border-amber-500/50 text-amber-400 hover:bg-amber-500/10' : 'border-slate-300 text-slate-600 hover:bg-slate-100'}`}
                      data-testid="button-play-pause"
                    >
                      {isAnimating ? <Pause size={12} /> : <Play size={12} />}
                      {isAnimating ? 'Pause' : animationTime !== null ? 'Resume' : 'Animate 24h Cycle'}
                    </Button>
                    {animationTime !== null && (
                      <>
                        <Button variant="outline" size="sm" onClick={cycleSpeed}
                          className="gap-1 h-8 text-xs border-slate-300 text-slate-600 hover:bg-slate-100"
                          data-testid="button-speed"
                        >
                          <FastForward size={12} />
                          {animationSpeed}x
                        </Button>
                        <Button variant="outline" size="sm" onClick={resetAnimation}
                          className="gap-1 h-8 text-xs border-slate-300 text-slate-600 hover:bg-slate-100"
                          data-testid="button-reset"
                        >
                          <RotateCcw size={12} />
                          Reset
                        </Button>
                      </>
                    )}
                  </div>

                  {animationTime !== null && activeGenes.length > 0 && (
                    <div className="mt-2 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2" data-testid="active-genes-ticker">
                      <div className="text-[10px] text-amber-300/70 uppercase tracking-wider mb-1">Peaking Now</div>
                      <div className="flex flex-wrap gap-1.5">
                        {activeGenes.map(g => (
                          <Badge key={g.gene}
                            className="text-[10px] font-mono cursor-pointer hover:opacity-80"
                            style={{ backgroundColor: g.color + '30', color: g.color, borderColor: g.color + '50' }}
                            onClick={() => { setSelectedGene(g.gene); setIsAnimating(false); }}
                          >
                            {g.gene}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-center gap-6 mt-3 text-[10px] text-slate-500">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-slate-400" /> Node size = cosinor R²
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-4 h-0.5 bg-cyan-400" /> PAR(2) coupling
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-4 h-0.5 bg-green-400 border-dashed" style={{ borderTop: '1px dashed #a3e635' }} /> Known interaction
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full border border-cyan-400 border-dashed" /> Has coupling
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-1">
              <Card className="bg-white border-slate-200 sticky top-4" data-testid="card-gene-detail">
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm text-slate-900">
                    {selectedGene ? `Gene Detail: ${selectedGene}` : hoveredGene ? `Hovering: ${hoveredGene}` : 'Click a gene for details'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-0 px-4 pb-4">
                  {(selectedGene || hoveredGene) ? (
                    <GeneDetailPanel
                      gene={selectedGene || hoveredGene!}
                      genes={data.geneNodes}
                      links={data.couplingLinks}
                      knownInteractions={data.knownInteractions}
                    />
                  ) : (
                    <div className="text-center py-8">
                      <Info size={32} className="mx-auto text-slate-500 mb-3" />
                      <p className="text-xs text-slate-500">Click any gene on the phase portrait to see its full details, coupling status, and known interactions.</p>
                      <p className="text-[10px] text-slate-500 mt-2">Hover for quick preview</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}