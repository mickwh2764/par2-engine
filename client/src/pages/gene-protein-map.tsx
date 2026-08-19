import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Link } from "wouter";
import { ArrowLeft, Loader2, Check, AlertTriangle, ChevronDown, ChevronUp, Search, ExternalLink } from "lucide-react";
import GeneTooltip from "@/components/GeneTooltip";

interface GeneProteinMapEntry {
  gene: string;
  type: 'clock' | 'target' | 'other';
  cycling: boolean;
  mrnaEigenvalue: number;
  proteinEigenvalue: number;
  mrnaR2: number;
  proteinR2: number;
  delta: number;
}

interface GeneProteinMapData {
  success: boolean;
  entries: GeneProteinMapEntry[];
  stats: {
    totalMatched: number;
    pearsonR: number;
    spearmanRho: number;
    clockCount: number;
    targetCount: number;
    cyclingCount: number;
    meanMrnaEigenvalue: number;
    meanProteinEigenvalue: number;
    mrnaHigherCount: number;
    proteinHigherCount: number;
    concordanceByType: { type: string; count: number; meanMrna: number; meanProtein: number; delta: number }[];
  };
  independentEvidence: { finding: string; source: string; agrees: boolean }[];
  plainEnglishSummary: string[];
}

type HighlightMode = 'none' | 'cycling' | 'target' | 'high-delta' | 'high-r2';
type SortField = 'gene' | 'mrna' | 'protein' | 'delta';

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center" data-testid={`stat-${label.toLowerCase().replace(/\s/g, '-')}`}>
      <p className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</p>
      <p className={`text-lg font-mono font-bold ${color || 'text-slate-900'}`}>{value}</p>
      {sub && <p className="text-[10px] text-slate-500">{sub}</p>}
    </div>
  );
}

export default function GeneProteinMap() {
  const { data, isLoading } = useQuery<GeneProteinMapData>({
    queryKey: ["/api/validation/gene-protein-map"],
    staleTime: 60 * 60 * 1000,
  });

  const [highlight, setHighlight] = useState<HighlightMode>('none');
  const [searchTerm, setSearchTerm] = useState('');
  const [showTable, setShowTable] = useState(false);
  const [sortField, setSortField] = useState<SortField>('delta');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [hoveredGene, setHoveredGene] = useState<string | null>(null);

  const filteredEntries = useMemo(() => {
    if (!data) return [];
    let entries = [...data.entries];
    if (searchTerm) {
      const term = searchTerm.toUpperCase();
      entries = entries.filter(e => e.gene.toUpperCase().includes(term));
    }
    entries.sort((a, b) => {
      let va: number, vb: number;
      switch (sortField) {
        case 'gene': return sortDir === 'asc' ? a.gene.localeCompare(b.gene) : b.gene.localeCompare(a.gene);
        case 'mrna': va = a.mrnaEigenvalue; vb = b.mrnaEigenvalue; break;
        case 'protein': va = a.proteinEigenvalue; vb = b.proteinEigenvalue; break;
        case 'delta': va = Math.abs(a.delta); vb = Math.abs(b.delta); break;
        default: va = 0; vb = 0;
      }
      return sortDir === 'asc' ? va - vb : vb - va;
    });
    return entries;
  }, [data, searchTerm, sortField, sortDir]);

  const hoveredEntry = useMemo(() => {
    if (!hoveredGene || !data) return null;
    return data.entries.find(e => e.gene === hoveredGene) || null;
  }, [hoveredGene, data]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin text-teal-400 mx-auto mb-3" size={32} />
          <p className="text-slate-500 text-sm">Running AR(2) on 2,700+ gene-protein pairs...</p>
        </div>
      </div>
    );
  }

  if (!data || data.entries.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 p-6">
        <p className="text-slate-500">No gene-protein map data available.</p>
      </div>
    );
  }

  const isHighlighted = (e: GeneProteinMapEntry): boolean => {
    switch (highlight) {
      case 'cycling': return e.cycling;
      case 'target': return e.type === 'target';
      case 'high-delta': return Math.abs(e.delta) > 0.3;
      case 'high-r2': return e.mrnaR2 > 0.3 && e.proteinR2 > 0.3;
      default: return false;
    }
  };

  const getDotProps = (e: GeneProteinMapEntry) => {
    const hl = highlight !== 'none';
    const isHl = isHighlighted(e);
    const isHovered = hoveredGene === e.gene;

    let fill = '#64748b';
    if (e.type === 'clock') fill = '#22d3ee';
    else if (e.type === 'target') fill = '#f472b6';
    else if (e.cycling) fill = '#2dd4bf';

    let r = e.type === 'other' && !e.cycling ? 1.3 : e.type === 'other' ? 2 : 3;
    let opacity = hl ? (isHl ? 0.85 : 0.06) : (e.type === 'other' && !e.cycling ? 0.18 : 0.6);

    if (isHovered) { r = 5; opacity = 1; fill = '#fbbf24'; }

    return { fill, r, opacity };
  };

  const toX = (v: number) => 50 + Math.min(Math.max(v, 0), 1) * 340;
  const toY = (v: number) => 300 - Math.min(Math.max(v, 0), 1) * 280;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/convergence-map">
            <button className="text-slate-500 hover:text-slate-700 transition-colors" data-testid="button-back">
              <ArrowLeft size={20} />
            </button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900" data-testid="text-page-title">Gene-Protein Persistence Map</h1>
            <p className="text-sm text-slate-500">{data.stats.totalMatched.toLocaleString()} genes · mRNA vs protein AR(2) eigenvalue comparison</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <StatCard label="Genes Mapped" value={data.stats.totalMatched.toLocaleString()} sub="Both mRNA & protein" />
          <StatCard label="Pearson r" value={data.stats.pearsonR.toFixed(3)} sub="Linear correlation" color={Math.abs(data.stats.pearsonR) < 0.1 ? 'text-amber-400' : 'text-green-400'} />
          <StatCard label="Spearman ρ" value={data.stats.spearmanRho.toFixed(3)} sub="Rank correlation" color={Math.abs(data.stats.spearmanRho) < 0.1 ? 'text-amber-400' : 'text-green-400'} />
          <StatCard label="mRNA Higher" value={`${Math.round(data.stats.mrnaHigherCount / data.stats.totalMatched * 100)}%`} sub={`${data.stats.mrnaHigherCount} genes`} color="text-blue-400" />
          <StatCard label="Protein Higher" value={`${Math.round(data.stats.proteinHigherCount / data.stats.totalMatched * 100)}%`} sub={`${data.stats.proteinHigherCount} genes`} color="text-teal-400" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div className="lg:col-span-2 bg-slate-100 border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-900">Scatter Plot: mRNA |λ| vs Protein |λ|</h2>
              <div className="flex gap-1.5">
                {(['none', 'cycling', 'target', 'high-delta', 'high-r2'] as HighlightMode[]).map(mode => (
                  <button key={mode} onClick={() => setHighlight(mode)}
                    className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${highlight === mode
                      ? 'bg-slate-600 border-slate-300 text-slate-900'
                      : 'border-slate-200 text-slate-500 hover:text-slate-600'}`}
                    data-testid={`button-highlight-${mode}`}>
                    {mode === 'none' ? 'All' : mode === 'high-delta' ? '|Δ| > 0.3' : mode === 'high-r2' ? 'High R²' : mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <svg width="100%" viewBox="0 0 440 360" className="mx-auto" data-testid="scatter-plot">
              <defs>
                <clipPath id="gpm-clip"><rect x={50} y={10} width={340} height={290} /></clipPath>
              </defs>
              <rect x={50} y={10} width={340} height={290} fill="#0f172a" rx={4} />
              <line x1={50} y1={300} x2={390} y2={10} stroke="#334155" strokeWidth={0.5} strokeDasharray="6 4" />

              {[0, 0.2, 0.4, 0.6, 0.8, 1.0].map(v => (
                <g key={`grid-${v}`}>
                  <line x1={50} y1={toY(v)} x2={390} y2={toY(v)} stroke="#1e293b" strokeWidth={0.5} />
                  <line x1={toX(v)} y1={10} x2={toX(v)} y2={300} stroke="#1e293b" strokeWidth={0.5} />
                  <text x={46} y={toY(v) + 3} textAnchor="end" fill="#475569" fontSize={8}>{v.toFixed(1)}</text>
                  <text x={toX(v)} y={314} textAnchor="middle" fill="#475569" fontSize={8}>{v.toFixed(1)}</text>
                </g>
              ))}

              <text x={220} y={340} textAnchor="middle" fill="#94a3b8" fontSize={10} fontWeight={600}>mRNA Eigenvalue |λ|</text>
              <text x={14} y={160} textAnchor="middle" fill="#94a3b8" fontSize={10} fontWeight={600} transform="rotate(-90, 14, 160)">Protein Eigenvalue |λ|</text>

              <g clipPath="url(#gpm-clip)">
                {data.entries.map((e, i) => {
                  const props = getDotProps(e);
                  return (
                    <circle key={i} cx={toX(e.mrnaEigenvalue)} cy={toY(e.proteinEigenvalue)}
                      r={props.r} fill={props.fill} opacity={props.opacity}
                      onMouseEnter={() => setHoveredGene(e.gene)}
                      onMouseLeave={() => setHoveredGene(null)}
                      style={{ cursor: 'pointer', transition: 'r 0.15s, opacity 0.15s' }} />
                  );
                })}
              </g>

              <line x1={50} y1={300} x2={390} y2={300} stroke="#475569" strokeWidth={1} />
              <line x1={50} y1={10} x2={50} y2={300} stroke="#475569" strokeWidth={1} />
            </svg>

            <div className="flex flex-wrap gap-4 justify-center mt-2 text-[10px] text-slate-500">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block" /> Clock ({data.stats.clockCount})</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-pink-400 inline-block" /> Target ({data.stats.targetCount})</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-teal-400 inline-block" /> Cycling ({data.stats.cyclingCount})</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-500 inline-block" /> Other</span>
              <span className="text-slate-500">Dashed = equal line</span>
            </div>

            {hoveredEntry && (
              <div className="mt-3 bg-slate-100 border border-slate-200 rounded-lg p-2.5 text-xs" data-testid="gene-tooltip">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-slate-900 font-mono">{hoveredEntry.gene}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${hoveredEntry.type === 'clock' ? 'bg-cyan-500/20 text-cyan-400' : hoveredEntry.type === 'target' ? 'bg-pink-500/20 text-pink-400' : hoveredEntry.cycling ? 'bg-teal-500/20 text-teal-400' : 'bg-slate-600/50 text-slate-500'}`}>
                    {hoveredEntry.type === 'other' ? (hoveredEntry.cycling ? 'cycling' : 'other') : hoveredEntry.type}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><span className="text-blue-400">mRNA |λ| = {hoveredEntry.mrnaEigenvalue.toFixed(3)}</span> <span className="text-slate-500">(R² = {hoveredEntry.mrnaR2.toFixed(3)})</span></div>
                  <div><span className="text-teal-400">Protein |λ| = {hoveredEntry.proteinEigenvalue.toFixed(3)}</span> <span className="text-slate-500">(R² = {hoveredEntry.proteinR2.toFixed(3)})</span></div>
                </div>
                <p className="text-slate-500 mt-1">Δ = {hoveredEntry.delta > 0 ? '+' : ''}{hoveredEntry.delta.toFixed(3)} — {hoveredEntry.delta > 0 ? 'Protein persists more' : 'mRNA persists more'}</p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="bg-slate-100 border border-slate-200 rounded-xl p-4">
              <h2 className="text-sm font-semibold text-slate-900 mb-3">By Category</h2>
              <div className="space-y-3">
                {data.stats.concordanceByType.map(ct => (
                  <div key={ct.type} className="bg-slate-100 rounded-lg p-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-semibold capitalize ${ct.type === 'clock' ? 'text-cyan-400' : ct.type === 'target' ? 'text-pink-400' : ct.type === 'cycling' ? 'text-teal-400' : 'text-slate-500'}`}>
                        {ct.type}
                      </span>
                      <span className="text-[10px] text-slate-500">{ct.count} genes</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div>
                        <span className="text-slate-500">mRNA</span>
                        <div className="flex items-center gap-1 mt-0.5">
                          <div className="flex-1 bg-slate-600 rounded-full h-1.5">
                            <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${Math.min(ct.meanMrna * 100, 100)}%` }} />
                          </div>
                          <span className="text-blue-400 font-mono w-10 text-right">{ct.meanMrna.toFixed(3)}</span>
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-500">Protein</span>
                        <div className="flex items-center gap-1 mt-0.5">
                          <div className="flex-1 bg-slate-600 rounded-full h-1.5">
                            <div className="h-1.5 rounded-full bg-teal-500" style={{ width: `${Math.min(ct.meanProtein * 100, 100)}%` }} />
                          </div>
                          <span className="text-teal-400 font-mono w-10 text-right">{ct.meanProtein.toFixed(3)}</span>
                        </div>
                      </div>
                    </div>
                    <p className={`text-[10px] mt-1 ${ct.delta > 0 ? 'text-teal-400' : 'text-blue-400'}`}>
                      Δ = {ct.delta > 0 ? '+' : ''}{ct.delta.toFixed(3)} — {ct.delta > 0 ? 'protein higher' : 'mRNA higher'}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-100 border border-slate-200 rounded-xl p-4">
              <h2 className="text-sm font-semibold text-slate-900 mb-2">Distribution</h2>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                    <span>mRNA persists more</span>
                    <span>Protein persists more</span>
                  </div>
                  <div className="flex h-5 rounded overflow-hidden">
                    <div className="bg-blue-500/60 flex items-center justify-center"
                      style={{ width: `${data.stats.mrnaHigherCount / data.stats.totalMatched * 100}%` }}>
                      <span className="text-[9px] text-slate-900 font-mono">{data.stats.mrnaHigherCount}</span>
                    </div>
                    <div className="bg-teal-500/60 flex items-center justify-center"
                      style={{ width: `${data.stats.proteinHigherCount / data.stats.totalMatched * 100}%` }}>
                      <span className="text-[9px] text-slate-900 font-mono">{data.stats.proteinHigherCount}</span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div className="text-center">
                    <p className="text-slate-500">Mean mRNA |λ|</p>
                    <p className="text-blue-400 font-mono text-sm">{data.stats.meanMrnaEigenvalue.toFixed(3)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-slate-500">Mean Protein |λ|</p>
                    <p className="text-teal-400 font-mono text-sm">{data.stats.meanProteinEigenvalue.toFixed(3)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-100 border border-slate-200 rounded-xl p-5 mb-6">
          <h2 className="text-base font-bold text-slate-900 mb-4">In Plain English</h2>
          <div className="space-y-4">
            {data.plainEnglishSummary.map((s, i) => (
              <p key={i} className={`text-sm leading-relaxed ${i === data.plainEnglishSummary.length - 1 ? 'text-slate-900 font-medium border-t border-slate-200 pt-4' : 'text-slate-600'}`} data-testid={`text-summary-${i}`}>
                {s}
              </p>
            ))}
          </div>
        </div>

        <div className="bg-slate-100 border border-slate-200 rounded-xl p-5 mb-6">
          <h2 className="text-base font-bold text-slate-900 mb-4">Independent Evidence</h2>
          <p className="text-xs text-slate-500 mb-4">Published findings from other labs and methods that either support or challenge what the gene-protein map shows.</p>
          <div className="space-y-3">
            {data.independentEvidence.map((ev, i) => (
              <div key={i} className={`border rounded-lg p-3.5 ${ev.agrees ? 'bg-green-500/5 border-green-500/20' : 'bg-amber-500/5 border-amber-500/20'}`} data-testid={`evidence-item-${i}`}>
                <div className="flex items-start gap-2.5">
                  <span className={`mt-0.5 flex-shrink-0 ${ev.agrees ? 'text-green-400' : 'text-amber-400'}`}>
                    {ev.agrees ? <Check size={14} /> : <AlertTriangle size={14} />}
                  </span>
                  <div>
                    <p className="text-xs text-slate-800 leading-relaxed">{ev.finding}</p>
                    <p className="text-[10px] text-slate-500 mt-1.5 italic flex items-center gap-1">
                      <ExternalLink size={9} className="flex-shrink-0" />
                      {ev.source}
                    </p>
                    <span className={`inline-block text-[10px] mt-1.5 px-1.5 py-0.5 rounded ${ev.agrees ? 'bg-green-500/15 text-green-400' : 'bg-amber-500/15 text-amber-400'}`}>
                      {ev.agrees ? 'Consistent with our findings' : 'Partially differs — adds nuance'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-100 border border-slate-200 rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-slate-900">Gene Table</h2>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
                <input type="text" placeholder="Search gene..."
                  value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  className="bg-slate-100 border border-slate-200 rounded pl-7 pr-3 py-1 text-xs text-slate-900 placeholder:text-slate-400 w-40 focus:outline-none focus:border-slate-300"
                  data-testid="input-gene-search" />
              </div>
              <button onClick={() => setShowTable(!showTable)}
                className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 transition-colors"
                data-testid="button-toggle-table">
                {showTable ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {showTable ? 'Hide' : `Show ${filteredEntries.length} genes`}
              </button>
            </div>
          </div>

          {showTable && (
            <div className="max-h-[500px] overflow-y-auto">
              <table className="w-full text-xs" data-testid="table-genes">
                <thead className="sticky top-0 bg-slate-100">
                  <tr className="text-slate-500">
                    {([['gene', 'Gene'], ['mrna', 'mRNA |λ|'], ['protein', 'Protein |λ|'], ['delta', '|Δ|']] as [SortField, string][]).map(([field, label]) => (
                      <th key={field} className="text-left py-1.5 px-2 cursor-pointer hover:text-slate-700 transition-colors"
                        onClick={() => { setSortField(field); setSortDir(sortField === field && sortDir === 'desc' ? 'asc' : 'desc'); }}>
                        <span className="flex items-center gap-1">
                          {label}
                          {sortField === field && <span className="text-[8px]">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                        </span>
                      </th>
                    ))}
                    <th className="text-left py-1.5 px-2">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.slice(0, 200).map(e => (
                    <tr key={e.gene} className="border-t border-slate-200 hover:bg-slate-100 transition-colors"
                      onMouseEnter={() => setHoveredGene(e.gene)} onMouseLeave={() => setHoveredGene(null)}>
                      <td className="py-1 px-2 font-mono text-slate-900"><GeneTooltip gene={e.gene}>{e.gene}</GeneTooltip></td>
                      <td className="py-1 px-2 font-mono text-blue-400">{e.mrnaEigenvalue.toFixed(3)}</td>
                      <td className="py-1 px-2 font-mono text-teal-400">{e.proteinEigenvalue.toFixed(3)}</td>
                      <td className={`py-1 px-2 font-mono ${e.delta > 0 ? 'text-teal-400' : 'text-blue-400'}`}>
                        {e.delta > 0 ? '+' : ''}{e.delta.toFixed(3)}
                      </td>
                      <td className="py-1 px-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${e.type === 'clock' ? 'bg-cyan-500/20 text-cyan-400' : e.type === 'target' ? 'bg-pink-500/20 text-pink-400' : e.cycling ? 'bg-teal-500/20 text-teal-400' : 'text-slate-500'}`}>
                          {e.type === 'other' ? (e.cycling ? 'cycling' : '') : e.type}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredEntries.length > 200 && (
                <p className="text-[10px] text-slate-500 text-center py-2">Showing first 200 of {filteredEntries.length} genes</p>
              )}
            </div>
          )}
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-6 text-center">
          <p className="text-[10px] text-slate-500">
            Data sources: mRNA from GSE11923 (mouse liver, 48 timepoints, 1h resolution) · Protein from Robles et al. 2014, PLOS Genetics (mouse liver, 16 timepoints, SILAC) ·
            Cycling annotations from Robles Table S2 (186 proteins, JTK_CYCLE) · All peer-reviewed, publicly available data
          </p>
        </div>

        <div className="text-center pb-6">
          <Link href="/convergence-map">
            <span className="text-xs text-slate-500 hover:text-slate-700 transition-colors cursor-pointer" data-testid="link-back-landscape">
              ← Convergence Map
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
