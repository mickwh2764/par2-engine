import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Search, Clock, Pill, Info, ChevronUp, ChevronDown, Filter } from "lucide-react";

const ROLE_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  clock_core:       { label: 'Clock Core',       color: 'bg-violet-500/20 text-violet-300 border-violet-500/30', dot: 'bg-violet-400' },
  clock_output:     { label: 'Clock Output',      color: 'bg-blue-500/20 text-blue-300 border-blue-500/30',     dot: 'bg-blue-400' },
  cell_cycle:       { label: 'Cell Cycle',        color: 'bg-amber-500/20 text-amber-300 border-amber-500/30',  dot: 'bg-amber-400' },
  tumor_suppressor: { label: 'Tumour Suppressor', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', dot: 'bg-emerald-400' },
  oncogene:         { label: 'Oncogene',          color: 'bg-red-500/20 text-red-300 border-red-500/30',        dot: 'bg-red-400' },
  signaling:        { label: 'Signalling',        color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',     dot: 'bg-cyan-400' },
};

const ZT_LABELS = [
  { label: 'ZT0',  zt: 0  },
  { label: 'ZT6',  zt: 6  },
  { label: 'ZT12', zt: 12 },
  { label: 'ZT18', zt: 18 },
];

function mod24(h: number) { return ((h % 24) + 24) % 24; }

function ztToXY(zt: number, cx: number, cy: number, r: number) {
  const angle = (zt / 24) * 2 * Math.PI - Math.PI / 2;
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

function arcPath(zt1: number, zt2: number, cx: number, cy: number, r: number) {
  const p1 = ztToXY(zt1, cx, cy, r);
  const p2 = ztToXY(zt2, cx, cy, r);
  const span = mod24(zt2 - zt1);
  const largeArc = span > 12 ? 1 : 0;
  return `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
}

function CircadianClock({ gene }: { gene: any }) {
  const cx = 90; const cy = 90; const r = 62; const tickR = 74;
  const peakPt = ztToXY(gene.peakZT, cx, cy, r - 4);
  const windowArc = arcPath(gene.optimalDosingWindowStart, gene.optimalDosingWindowEnd, cx, cy, r);
  const lightArc  = arcPath(0, 12, cx, cy, r + 12);
  const darkArc   = arcPath(12, 24, cx, cy, r + 12);
  const hourTicks = Array.from({ length: 24 }, (_, i) => {
    const inner = ztToXY(i, cx, cy, r - 10);
    const outer = ztToXY(i, cx, cy, r - 2);
    return { i, inner, outer };
  });
  return (
    <svg viewBox="0 0 180 200" className="w-full max-w-[220px]" data-testid="chrono-clock-svg">
      <circle cx={cx} cy={cy} r={r + 14} fill="#0f172a" />
      <path d={lightArc} fill="none" stroke="#fbbf24" strokeWidth={12} strokeLinecap="butt" opacity={0.18} />
      <path d={darkArc}  fill="none" stroke="#1e3a5f" strokeWidth={12} strokeLinecap="butt" opacity={0.35} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#334155" strokeWidth={1} />
      {hourTicks.map(({ i, inner, outer }) => (
        <line key={i} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y}
          stroke={i % 6 === 0 ? '#64748b' : '#1e293b'} strokeWidth={i % 6 === 0 ? 1.5 : 0.8} />
      ))}
      <path d={windowArc} fill="none" stroke="#f97316" strokeWidth={10} strokeLinecap="round" opacity={0.75} />
      <circle cx={peakPt.x} cy={peakPt.y} r={5} fill="#22d3ee" stroke="#0f172a" strokeWidth={1.5} />
      {ZT_LABELS.map(({ label, zt }) => {
        const pt = ztToXY(zt, cx, cy, tickR);
        return (
          <text key={label} x={pt.x} y={pt.y} textAnchor="middle" dominantBaseline="middle"
            fill="#e2e8f0" fontSize="7" fontFamily="monospace">{label}</text>
        );
      })}
      <text x={cx} y={cy - 8} textAnchor="middle" fill="#f1f5f9" fontSize="11" fontWeight="bold" fontFamily="monospace">
        {gene.gene}
      </text>
      <text x={cx} y={cy + 5} textAnchor="middle" fill="#e2e8f0" fontSize="6.5" fontFamily="sans-serif">
        peak ZT{gene.peakZT}
      </text>
      <text x={cx} y={cy + 15} textAnchor="middle" fill="#f97316" fontSize="6" fontFamily="sans-serif">
        ZT{gene.optimalDosingWindowStart}–ZT{gene.optimalDosingWindowEnd}
      </text>
      <text x={14} y={cy + 2} textAnchor="middle" fill="#fbbf24" fontSize="5.5" opacity={0.7}>DAY</text>
      <text x={166} y={cy + 2} textAnchor="middle" fill="#60a5fa" fontSize="5.5" opacity={0.7}>NIGHT</text>
      {/* Legend — below clock face */}
      <line x1={10} y1={172} x2={170} y2={172} stroke="#1e293b" strokeWidth={0.8} />
      <circle cx={28} cy={183} r={4} fill="#22d3ee" />
      <text x={36} y={187} fill="#e2e8f0" fontSize="7.5" fontFamily="sans-serif">Peak expression</text>
      <rect x={99} y={180} width={9} height={5} rx={2.5} fill="#f97316" opacity={0.85} />
      <text x={112} y={187} fill="#e2e8f0" fontSize="7.5" fontFamily="sans-serif">Dosing window</text>
    </svg>
  );
}

function MiniClock({ peakZT, winStart, winEnd }: { peakZT: number; winStart: number; winEnd: number }) {
  const cx = 12; const cy = 12; const r = 9;
  const peak = ztToXY(peakZT, cx, cy, r - 2);
  const arc = arcPath(winStart, winEnd, cx, cy, r);
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6 mx-auto" aria-label={`Clock ZT${peakZT}`}>
      <circle cx={cx} cy={cy} r={r} fill="#0f172a" stroke="#334155" strokeWidth={0.8} />
      <path d={arc} fill="none" stroke="#f97316" strokeWidth={4} strokeLinecap="round" opacity={0.7} />
      <circle cx={peak.x} cy={peak.y} r={1.8} fill="#22d3ee" />
    </svg>
  );
}

function SortIcon({ col, sortBy, sortAsc }: { col: string; sortBy: string; sortAsc: boolean }) {
  if (sortBy !== col) return <span className="opacity-30">↕</span>;
  return sortAsc
    ? <ChevronUp size={10} className="inline ml-0.5" />
    : <ChevronDown size={10} className="inline ml-0.5" />;
}

export default function ChronotherapyPredictor() {
  const [search, setSearch]         = useState('');
  const [selected, setSelected]     = useState<string>('WEE1');
  const [sortBy, setSortBy]         = useState<'gene' | 'peakZT' | 'eigenvalue'>('peakZT');
  const [sortAsc, setSortAsc]       = useState(true);
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [drugsOnly, setDrugsOnly]   = useState(false);

  const { data, isLoading, isError } = useQuery<any>({
    queryKey: ['/api/chronotherapy-predictor'],
    staleTime: Infinity,
  });

  const genes: any[] = useMemo(() => data?.genes ?? [], [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toUpperCase();
    return genes.filter(g => {
      if (roleFilter !== 'all' && g.role !== roleFilter) return false;
      if (drugsOnly && !g.hasDrug) return false;
      if (!q) return true;
      return (
        g.gene.toUpperCase().includes(q) ||
        (g.mouseGene || '').toUpperCase().includes(q) ||
        (g.role || '').toUpperCase().includes(q) ||
        (g.biologicalContext || '').toUpperCase().includes(q) ||
        (g.peakPhaseLabel || '').toUpperCase().includes(q)
      );
    });
  }, [genes, search, roleFilter, drugsOnly]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if      (sortBy === 'gene')      cmp = a.gene.localeCompare(b.gene);
      else if (sortBy === 'peakZT')    cmp = a.peakZT - b.peakZT;
      else                             cmp = b.eigenvalue - a.eigenvalue;
      return sortAsc ? cmp : -cmp;
    });
  }, [filtered, sortBy, sortAsc]);

  const activeGene = useMemo(
    () => genes.find((g: any) => g.gene === selected) ?? (genes.length > 0 ? genes[0] : null),
    [genes, selected]
  );

  function toggleSort(col: typeof sortBy) {
    if (sortBy === col) setSortAsc(v => !v);
    else { setSortBy(col); setSortAsc(true); }
  }

  function handleSelectGene(gene: string) {
    setSelected(gene);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const roles = useMemo(() => {
    const seen = new Set<string>();
    genes.forEach(g => seen.add(g.role));
    return Array.from(seen);
  }, [genes]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Clock size={32} className="text-orange-400 mx-auto mb-3 animate-pulse" />
          <p className="text-slate-400 text-sm">Loading chronotherapy data…</p>
        </div>
      </div>
    );
  }

  if (isError || genes.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 text-sm">Failed to load gene data. Please refresh.</p>
          <Link href="/" className="text-orange-400 text-sm mt-2 block">← Back to home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/" className="text-slate-500 hover:text-slate-300 transition-colors" data-testid="back-link">
            <ArrowLeft size={18} />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <Clock size={18} className="text-orange-400" />
              Chronotherapy Dosing Window Predictor
            </h1>
            <p className="text-sm text-slate-300 mt-0.5">
              AR(2) eigenvalue–derived optimal administration windows for circadian-regulated drug targets
            </p>
          </div>
          <div className="text-right text-sm text-slate-300">
            <div>{genes.length} genes</div>
            <div>{data?.genesWithDrugs ?? 0} with drug data</div>
          </div>
        </div>

        {/* Disclaimer banner */}
        <div className="flex items-start gap-3 bg-amber-950/40 border border-amber-600/40 rounded-lg p-3 mb-5" data-testid="disclaimer-banner">
          <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <div>
            <p className="text-amber-300 font-semibold text-sm mb-0.5">Research use only — not clinical advice</p>
            <p className="text-amber-200/80 text-sm leading-relaxed">
              All dosing windows shown are computational predictions derived from AR(2) eigenvalue modelling of circadian gene expression data.
              They have <strong className="text-amber-200">not been clinically validated</strong> and must not be used to guide any treatment, prescribing, or clinical decision-making.
              This tool is intended solely for hypothesis generation in a research context.
              Always consult a qualified healthcare professional for any medical decisions.
            </p>
          </div>
        </div>

        {/* Search + Filter row */}
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search gene, role, or biological context…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-800/60 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-orange-400/60 focus:ring-1 focus:ring-orange-400/20"
              data-testid="gene-search-input"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-sm"
                data-testid="clear-search"
              >✕</button>
            )}
          </div>
        </div>

        {/* Role filter pills */}
        <div className="flex flex-wrap gap-1.5 mb-5" data-testid="role-filter-pills">
          <button
            onClick={() => setRoleFilter('all')}
            className={`px-2.5 py-1 rounded-full text-sm font-medium transition-colors ${roleFilter === 'all' && !drugsOnly ? 'bg-slate-600 text-slate-100' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300'}`}
            data-testid="filter-all"
          >
            All ({genes.length})
          </button>
          {roles.map(role => (
            <button
              key={role}
              onClick={() => { setRoleFilter(roleFilter === role ? 'all' : role); setDrugsOnly(false); }}
              className={`px-2.5 py-1 rounded-full text-sm font-medium transition-colors flex items-center gap-1 ${roleFilter === role && !drugsOnly ? `${ROLE_CONFIG[role]?.color} border` : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300'}`}
              data-testid={`filter-${role}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${ROLE_CONFIG[role]?.dot}`} />
              {ROLE_CONFIG[role]?.label ?? role}
            </button>
          ))}
          {/* Drugs-only quick filter */}
          <button
            onClick={() => { setDrugsOnly(v => !v); setRoleFilter('all'); }}
            className={`px-2.5 py-1 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 ${drugsOnly ? 'bg-violet-600/30 text-violet-300 border border-violet-500/40' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300'}`}
            data-testid="filter-drugs-only"
          >
            <Pill size={10} className={drugsOnly ? 'text-violet-300' : 'text-slate-500'} />
            Drugs only ({data?.genesWithDrugs ?? 0})
          </button>
        </div>

        {/* Gene selector cards (compact) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 mb-6" data-testid="gene-selector-grid">
          {sorted.map(g => (
            <button
              key={g.gene}
              onClick={() => handleSelectGene(g.gene)}
              className={`text-left rounded-lg p-2.5 border transition-all text-sm group ${
                g.gene === selected
                  ? 'bg-orange-900/30 border-orange-500/60 shadow-lg shadow-orange-900/20'
                  : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800 hover:border-slate-600'
              }`}
              data-testid={`gene-card-${g.gene}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`font-mono font-bold text-sm ${g.gene === selected ? 'text-orange-300' : 'text-slate-200 group-hover:text-slate-100'}`}>
                  {g.gene}
                </span>
                <div className="flex items-center gap-1">
                  {g.lowEigenvalueWarning && (
                    <span title="Low |λ|: oscillation assumption tenuous" className="text-amber-400 text-[10px] leading-none">⚠</span>
                  )}
                  {g.hasDrug && (
                    <Pill size={10} className={g.gene === selected ? 'text-orange-400' : 'text-slate-500'} />
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 mb-1">
                <MiniClock peakZT={g.peakZT} winStart={g.optimalDosingWindowStart} winEnd={g.optimalDosingWindowEnd} />
                <span className="text-slate-300 font-mono text-sm">ZT{g.peakZT}</span>
              </div>
              <span className={`text-[11px] px-1 py-0.5 rounded border ${ROLE_CONFIG[g.role]?.color}`}>
                {ROLE_CONFIG[g.role]?.label}
              </span>
              {g.tissueSource && (
                <div className="mt-1.5 text-[10px] text-slate-500 truncate" title={g.tissueSource}>
                  {g.tissueSource}
                </div>
              )}
            </button>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-8 text-slate-400 text-sm">
            No genes match your search or filter. <button className="text-orange-400 hover:text-orange-300" onClick={() => { setSearch(''); setRoleFilter('all'); setDrugsOnly(false); }}>Clear filters</button>
          </div>
        )}

        {/* Detail panel */}
        {activeGene && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6" data-testid="gene-detail-panel">
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-slate-100 text-base flex flex-wrap items-center gap-2">
                    <span className="font-mono text-orange-300">{activeGene.gene}</span>
                    <Badge className={`text-sm ${ROLE_CONFIG[activeGene.role]?.color}`}>
                      {ROLE_CONFIG[activeGene.role]?.label}
                    </Badge>
                    {activeGene.lowEigenvalueWarning && (
                      <span className="inline-flex items-center gap-1 text-[11px] bg-amber-900/30 text-amber-400 border border-amber-500/30 rounded px-1.5 py-0.5 font-normal">
                        ⚠ Low |λ| — oscillation assumption tenuous
                      </span>
                    )}
                  </CardTitle>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm text-slate-300 font-mono">mouse: {activeGene.mouseGene}</div>
                    {activeGene.tissueSource && (
                      <div className="text-[11px] text-slate-400 mt-0.5">📍 {activeGene.tissueSource}</div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-4 mb-4">
                  <CircadianClock gene={activeGene} />
                  <div className="flex-1 space-y-2 text-sm">
                    <div className="bg-slate-800 rounded p-2">
                      <div className="text-slate-300 mb-0.5">Peak expression</div>
                      <div className="text-cyan-300 font-semibold">ZT{activeGene.peakZT} — {activeGene.peakPhaseLabel}</div>
                    </div>
                    <div className="bg-orange-900/30 border border-orange-500/30 rounded p-2">
                      <div className="text-orange-400 mb-0.5 font-semibold flex items-center gap-1">
                        <Pill size={10} /> Optimal dosing window
                      </div>
                      <div className="text-orange-200 font-mono font-bold text-sm">
                        ZT{activeGene.optimalDosingWindowStart} – ZT{activeGene.optimalDosingWindowEnd}
                      </div>
                      <div className="text-slate-300 text-sm mt-0.5">
                        Descending phase · peak + 3h to peak + 9h
                      </div>
                    </div>
                    <div className="bg-slate-800 rounded p-2 space-y-1">
                      <div className="text-slate-300">AR(2) parameters</div>
                      <div className="font-mono text-sm text-slate-300">
                        |λ| = <span className="text-emerald-400">{activeGene.eigenvalue.toFixed(3)}</span>
                        &nbsp;·&nbsp;φ₁ = <span className="text-blue-300">{activeGene.phi1.toFixed(3)}</span>
                        &nbsp;·&nbsp;φ₂ = <span className="text-red-300">{activeGene.phi2.toFixed(3)}</span>
                      </div>
                      <div className="font-mono text-sm text-slate-300">Period ≈ {activeGene.periodHours}h</div>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-800/60 rounded p-3 mb-3">
                  <div className="text-sm text-slate-300 mb-1 font-semibold">Biological context</div>
                  <p className="text-sm text-slate-300 leading-relaxed">{activeGene.biologicalContext}</p>
                  <p className="text-sm text-slate-400 mt-1 italic">{activeGene.evidenceKey}</p>
                </div>

                <div className="bg-orange-900/20 border border-orange-500/20 rounded p-3">
                  <div className="text-sm text-orange-400 mb-1 font-semibold">Chronotherapy rationale</div>
                  <p className="text-sm text-slate-300 leading-relaxed">{activeGene.dosingRationale}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-slate-100 text-sm flex items-center gap-2">
                  <Pill size={14} className="text-violet-400" />
                  Drugs targeting {activeGene.gene}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {activeGene.drugs.length === 0 ? (
                  <div>
                    <p className="text-sm text-slate-400 italic mb-3">No clinical/investigational drugs in current database for this target.</p>
                    {activeGene.researchCompounds?.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <span className="text-[11px] bg-sky-900/30 text-sky-300 border border-sky-500/30 rounded px-1.5 py-0.5 font-semibold">Research tools</span>
                          <span className="text-xs text-slate-400">— not clinical drugs</span>
                        </div>
                        <div className="space-y-2" data-testid="research-compound-list">
                          {activeGene.researchCompounds.map((rc: any, i: number) => (
                            <div key={i} className="bg-sky-950/30 border border-sky-700/30 rounded p-2.5 text-sm" data-testid={`research-compound-${i}`}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-semibold text-sky-200 font-mono">{rc.name}</span>
                                <Badge className="bg-sky-900/30 text-sky-400 border-sky-600/30 text-[11px]">Research tool</Badge>
                              </div>
                              <div className="text-slate-300 text-sm mb-1">{rc.mechanism}</div>
                              <div className="text-slate-400 text-xs italic">{rc.note}</div>
                              <div className="mt-1.5 bg-orange-900/20 border border-orange-500/20 rounded px-2 py-1">
                                <span className="text-orange-400 text-sm">Predicted window: </span>
                                <span className="text-orange-200 font-mono text-sm font-semibold">
                                  ZT{activeGene.optimalDosingWindowStart}–ZT{activeGene.optimalDosingWindowEnd}
                                </span>
                                <span className="text-slate-400 text-xs"> (hypothesis only)</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2" data-testid="drug-list">
                    {activeGene.drugs.map((d: any, i: number) => (
                      <div key={i} className="bg-slate-800 rounded p-2.5 text-sm" data-testid={`drug-entry-${i}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-slate-200">{d.drugName}</span>
                          {d.fdaApproved
                            ? <Badge className="bg-emerald-900/40 text-emerald-400 text-[11px]">FDA approved</Badge>
                            : <Badge className="bg-slate-700 text-slate-400 text-[11px]">Investigational</Badge>}
                        </div>
                        <div className="text-slate-300">{d.indication}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-slate-300">{d.interactionType}</span>
                          <span className="text-slate-300">·</span>
                          <span className="text-slate-300">{d.drugClass.replace(/_/g, ' ')}</span>
                        </div>
                        <div className="mt-1.5 bg-orange-900/20 border border-orange-500/20 rounded px-2 py-1">
                          <span className="text-orange-400 text-sm">Predicted optimal: </span>
                          <span className="text-orange-200 font-mono text-sm font-semibold">
                            ZT{activeGene.optimalDosingWindowStart}–ZT{activeGene.optimalDosingWindowEnd}
                          </span>
                          <span className="text-slate-300 text-sm">
                            {' '}({activeGene.interactionType === 'inhibitor_target' ? 'descending phase' : 'ascending phase'})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 border-t border-slate-800 pt-3">
                  <div className="text-sm text-slate-300 font-semibold mb-2">Phase derivation</div>
                  <div className="text-sm text-slate-300 leading-relaxed space-y-1">
                    <p>θ = arccos(φ₁ / 2|λ|) = {((Math.acos(activeGene.phi1 / (2 * activeGene.eigenvalue))) * 180 / Math.PI).toFixed(1)}°</p>
                    <p>Period = 360 / θ × 2h sampling = {activeGene.periodHours}h</p>
                    <p>Vulnerability window = peak + 3h → peak + 9h</p>
                    <p className="italic text-slate-300 mt-1">
                      Window is a prediction, not a clinical recommendation.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Full table */}
        <Card className="bg-slate-900 border-slate-700 mb-6">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-slate-100 text-sm flex items-center gap-2">
                <Filter size={13} className="text-slate-400" />
                All Genes — Chronotherapy Database
                <span className="text-slate-300 font-normal text-sm">
                  ({sorted.length}{sorted.length !== genes.length ? ` of ${genes.length}` : ''} genes)
                </span>
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="chrono-full-table">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-800">
                    <th className="text-left py-2 px-3 cursor-pointer hover:text-slate-300 select-none" onClick={() => toggleSort('gene')}>
                      Gene <SortIcon col="gene" sortBy={sortBy} sortAsc={sortAsc} />
                    </th>
                    <th className="text-left py-2 px-2">Role</th>
                    <th className="text-right py-2 px-2 cursor-pointer hover:text-slate-300 select-none" onClick={() => toggleSort('eigenvalue')}>
                      |λ| <SortIcon col="eigenvalue" sortBy={sortBy} sortAsc={sortAsc} />
                    </th>
                    <th className="text-right py-2 px-2 cursor-pointer hover:text-slate-300 select-none" onClick={() => toggleSort('peakZT')}>
                      Peak ZT <SortIcon col="peakZT" sortBy={sortBy} sortAsc={sortAsc} />
                    </th>
                    <th className="text-center py-2 px-2">Clock</th>
                    <th className="text-center py-2 px-2">Dosing window</th>
                    <th className="text-center py-2 px-2">Drugs</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((g: any) => {
                    const isActive = g.gene === selected;
                    return (
                      <tr
                        key={g.gene}
                        onClick={() => handleSelectGene(g.gene)}
                        className={`border-b border-slate-800/50 cursor-pointer transition-colors ${isActive ? 'bg-orange-900/20 border-l-2 border-l-orange-500' : 'hover:bg-slate-800/40'}`}
                        data-testid={`gene-row-${g.gene}`}
                      >
                        <td className={`py-2 px-3 font-mono font-semibold ${isActive ? 'text-orange-300' : 'text-slate-200'}`}>
                          {g.gene}
                        </td>
                        <td className="py-2 px-2">
                          <Badge className={`text-[11px] ${ROLE_CONFIG[g.role]?.color}`}>
                            {ROLE_CONFIG[g.role]?.label ?? g.role}
                          </Badge>
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-emerald-300">{g.eigenvalue.toFixed(3)}</td>
                        <td className="py-2 px-2 text-right font-mono text-cyan-300">ZT{g.peakZT}</td>
                        <td className="py-2 px-2">
                          <MiniClock peakZT={g.peakZT} winStart={g.optimalDosingWindowStart} winEnd={g.optimalDosingWindowEnd} />
                        </td>
                        <td className="py-2 px-2 text-center font-mono text-orange-300 text-sm">
                          ZT{g.optimalDosingWindowStart}–{g.optimalDosingWindowEnd}
                        </td>
                        <td className="py-2 px-2 text-center">
                          {g.hasDrug
                            ? <Badge className="bg-violet-900/40 text-violet-300 text-[11px]">{g.drugs.length} drug{g.drugs.length > 1 ? 's' : ''}</Badge>
                            : g.hasResearchCompound
                              ? <Badge className="bg-sky-900/30 text-sky-400 border border-sky-600/30 text-[11px]">tool</Badge>
                              : <span className="text-slate-600 text-sm">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* COFE cross-reference */}
        <div className="bg-slate-900/60 border border-teal-700/30 rounded-lg p-4 mb-4" data-testid="cofe-chrono-crossref">
          <div className="flex items-center gap-2 mb-2">
            <Info size={13} className="text-teal-400" />
            <span className="text-sm text-teal-300 font-semibold">COFE cross-reference — drug target rhythmicity in human cancer</span>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed mb-2">
            Gupta et al. (2024) applied COFE to 11 human adenocarcinomas in TCGA and found that the majority of FDA-approved
            cancer drug targets are rhythmic in tumour tissue. Three proteins were rhythmic in <em>all</em> 11 cancers:
            androgen receptor (<strong className="text-slate-200">AR</strong>), phospho-SRC
            (<strong className="text-slate-200">SRC pY416/pY527</strong>), and phospho-Tuberin
            (<strong className="text-slate-200">TSC2 pT1462</strong>). Critically, COFE measures when these targets
            peak (phase/amplitude), while PAR(2) measures how strongly their past constrains their future (|λ|).
            The two metrics are orthogonal — a target that is both rhythmic by COFE and persistent by PAR(2) is the
            highest-priority chronotherapy candidate, because it has a predictable timing window <em>and</em> deep
            autoregressive memory that enforces that window.
          </p>
          <div className="grid grid-cols-3 gap-2 text-xs mb-2">
            {[
              { protein: "AR", gene: "AR", cofe: "Rhythmic in 11/11 ACs", detail: "Largest amplitude in BRCA" },
              { protein: "SRC pY416/Y527", gene: "SRC", cofe: "Rhythmic in 11/11 ACs", detail: "Phosphorylation timing is also rhythmic" },
              { protein: "Tuberin pT1462", gene: "TSC2", cofe: "Rhythmic in 11/11 ACs", detail: "mTORC1 pathway gating" },
            ].map((p, i) => (
              <div key={i} className="bg-slate-800/60 border border-slate-700 rounded p-2" data-testid={`cofe-target-${p.gene}`}>
                <div className="font-mono font-semibold text-slate-200 mb-0.5">{p.protein}</div>
                <div className="text-teal-400 mb-0.5">{p.cofe}</div>
                <div className="text-slate-400">{p.detail}</div>
              </div>
            ))}
          </div>
          <p className="text-sm text-slate-400 leading-relaxed">
            <strong className="text-slate-300">Cell cycle coupling:</strong> COFE also shows that the circadian clock and
            cell cycle are synchronised in 10/11 ACs (all except KIRC). WEE1 — the canonical circadian gate on
            cell-cycle entry — has the highest Floquet proximity count (7 cases) in the PAR(2) platform's monodromy table,
            providing independent PAR(2) corroboration of the circadian–cell-cycle coupling COFE observes empirically.
          </p>
          <div className="mt-2 text-xs text-slate-500">
            Gupta et al. (2024) bioRxiv doi:10.1101/2024.03.13.584582 ·{' '}
            <a href="/convergence-map" className="text-teal-400 hover:text-teal-300 underline">Full COFE cross-reference page</a>
          </div>
        </div>

        {/* Methodology */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Info size={13} className="text-slate-500" />
            <span className="text-sm text-slate-300 font-semibold">Methodology &amp; Limitations</span>
          </div>
          <div className="text-sm text-slate-300 leading-relaxed space-y-1.5">
            <p><span className="text-slate-200 font-medium">Phase angle:</span> θ = arccos(φ₁ / 2|λ|) derived from AR(2) characteristic roots assuming oscillating complex-conjugate roots with circadian-range period.</p>
            <p><span className="text-slate-200 font-medium">Dosing window:</span> Optimal window = peak ZT + 3h to peak ZT + 9h (descending phase). Inhibitor administration during natural decline requires lower doses for equivalent suppression. Not a clinical recommendation.</p>
            <p><span className="text-slate-200 font-medium">Eigenvalue sources:</span> GSE157357 WT intestinal organoids for crypt-expressed genes; liver circadian datasets (GSE11923, GSE54650) and literature calibration for systemic targets.</p>
            <p><span className="text-slate-200 font-medium">Peak ZT sources:</span> Storch et al. 2002 Nature; Hughes et al. 2009 Science; Koike et al. 2012 Science; Zhang et al. 2014 Science; Matsuo et al. 2003 Science; CircaDB (Pizarro et al. 2013).</p>
            <p className="text-amber-400/80 italic font-medium">⚠ This predictor is a research hypothesis-generation tool only. All predictions are computational, not clinically validated, and must not inform any clinical or prescribing decision.</p>
          </div>
        </div>

      </div>
    </div>
  );
}
