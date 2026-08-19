import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, Cell, ReferenceLine
} from "recharts";
import {
  ArrowLeft, Loader2, Dna, Search, Star, AlertTriangle, Download,
  CheckCircle2, Info, Sparkles, Globe
} from "lucide-react";
import { useState } from "react";

interface TissueEV {
  tissue: string;
  eigenvalue: number;
  isComplex: boolean;
  r2: number;
}

interface Candidate {
  gene: string;
  eigenvalue: number;
  beta1: number;
  beta2: number;
  isComplex: boolean;
  r2: number;
  meanExpression: number;
  expressionCV: number;
  percentileRank: number;
  tissuesFound: number;
  tissueList: string[];
  tissueEigenvalues: TissueEV[];
  meanCrossTissueEV: number;
  crossTissueConsistency: number;
  knownCategory: string;
}

interface TissueResult {
  tissue: string;
  totalGenes: number;
  genomeMedian: number;
  genomeMean: number;
  genomeP95: number;
  genomeP99: number;
  clockMedian: number;
  nAboveP95: number;
  nAboveP95Complex: number;
  topGenes: { gene: string; eigenvalue: number; isComplex: boolean; r2: number; category: string }[];
}

interface DiscoveryData {
  success: boolean;
  tissues: TissueResult[];
  candidates: Candidate[];
  knownClockRecovered: { gene: string; tissuesInTop: number; totalTissues: number; meanEV: number }[];
  novelCandidates: Candidate[];
  crossTissueReplicators: Candidate[];
  genomeStats: {
    totalGenesScanned: number;
    totalTissues: number;
    thresholdMethod: string;
    complexRootRequirement: string;
    crossTissueRequirement: string;
  };
  methodology: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  clock: '#f59e0b',
  target: '#ef4444',
  housekeeping: '#6b7280',
  immune: '#8b5cf6',
  metabolic: '#10b981',
  chromatin: '#ec4899',
  signaling: '#3b82f6',
  dna_repair: '#14b8a6',
  stem: '#f97316',
  other: '#94a3b8',
};

function downloadCSV(candidates: Candidate[], label: string) {
  let csv = 'Gene,Known Category,Tissues Found,Tissue List,Mean Cross-Tissue |λ|,Max |λ|,β₁,β₂,Complex Roots,R²,Consistency,Percentile Rank,Mean Expression,Expression CV\n';
  for (const c of candidates) {
    csv += `${c.gene},${c.knownCategory},${c.tissuesFound},"${c.tissueList.join('; ')}",${c.meanCrossTissueEV},${c.eigenvalue},${c.beta1},${c.beta2},${c.isComplex},${c.r2},${c.crossTissueConsistency},${c.percentileRank},${c.meanExpression},${c.expressionCV}\n`;
  }
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `regulatory_core_${label}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function GeneRow({ c, expanded, onToggle }: { c: Candidate; expanded: boolean; onToggle: () => void }) {
  return (
    <>
      <tr
        className="border-b border-gray-800 hover:bg-gray-750/40 cursor-pointer"
        onClick={onToggle}
        data-testid={`row-candidate-${c.gene}`}
      >
        <td className="p-3 font-medium">
          <div className="flex items-center gap-2">
            {c.knownCategory === 'clock' ? (
              <CheckCircle2 className="w-4 h-4 text-amber-400" />
            ) : c.knownCategory === 'other' ? (
              <Sparkles className="w-4 h-4 text-cyan-400" />
            ) : (
              <span className="w-4 h-4 rounded-full inline-block" style={{ backgroundColor: CATEGORY_COLORS[c.knownCategory] || '#94a3b8' }} />
            )}
            <span className={c.knownCategory === 'other' ? 'text-cyan-300 font-bold' : ''}>{c.gene}</span>
          </div>
        </td>
        <td className="p-3 text-center">
          <Badge
            variant="outline"
            className={c.knownCategory === 'other' ? 'border-cyan-500 text-cyan-400' : 'border-slate-300 text-slate-500'}
          >
            {c.knownCategory === 'other' ? 'NOVEL' : c.knownCategory}
          </Badge>
        </td>
        <td className="p-3 text-center font-mono font-bold">
          <span className={c.tissuesFound >= 6 ? 'text-green-400' : c.tissuesFound >= 4 ? 'text-yellow-400' : 'text-slate-600'}>
            {c.tissuesFound}
          </span>
        </td>
        <td className="p-3 text-right font-mono">{c.meanCrossTissueEV.toFixed(3)}</td>
        <td className="p-3 text-right font-mono">{c.eigenvalue.toFixed(3)}</td>
        <td className="p-3 text-right font-mono text-slate-500">{c.crossTissueConsistency.toFixed(2)}</td>
        <td className="p-3 text-right font-mono text-slate-500">{c.r2.toFixed(3)}</td>
      </tr>
      {expanded && (
        <tr className="border-b border-gray-800 bg-white">
          <td colSpan={7} className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div><span className="text-gray-500">β₁:</span> <span className="font-mono">{c.beta1.toFixed(4)}</span></div>
              <div><span className="text-gray-500">β₂:</span> <span className="font-mono">{c.beta2.toFixed(4)}</span></div>
              <div><span className="text-gray-500">Mean Expression:</span> <span className="font-mono">{c.meanExpression.toFixed(1)}</span></div>
              <div><span className="text-gray-500">Expression CV:</span> <span className="font-mono">{c.expressionCV.toFixed(3)}</span></div>
            </div>
            <div className="mt-3 text-xs text-slate-500">
              <span className="text-gray-500 font-medium">Tissue breakdown:</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-2">
              {c.tissueEigenvalues.map(te => (
                <Badge key={te.tissue} variant="outline" className="text-xs border-slate-300">
                  {te.tissue}: <span className="font-mono ml-1">{te.eigenvalue.toFixed(3)}</span>
                  {te.isComplex && <span className="text-purple-400 ml-1">osc</span>}
                  <span className="text-gray-500 ml-1">R²={te.r2.toFixed(2)}</span>
                </Badge>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function RegulatoryDiscovery() {
  const [expandedGene, setExpandedGene] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const { data, isLoading, error } = useQuery<DiscoveryData>({
    queryKey: ['/api/discovery/regulatory-core-scan'],
    queryFn: () => fetch('/api/discovery/regulatory-core-scan').then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 text-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/supplementary-analyses">
            <Button variant="ghost" size="sm" data-testid="link-back">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3" data-testid="text-page-title">
              <Search className="w-8 h-8 text-cyan-400" />
              Regulatory Core Discovery
            </h1>
            <p className="text-slate-500 mt-1">
              Pathway-agnostic identification of genes with clock-like dynamics across {data?.genomeStats?.totalTissues || '12'} tissues
            </p>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-20" data-testid="status-loading">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mr-3" />
            <span className="text-lg text-slate-600">Scanning ~21,000 genes across 12 tissues... this takes a moment</span>
          </div>
        )}

        {error && (
          <Card className="bg-red-900/30 border-red-700">
            <CardContent className="p-6">
              <p className="text-red-300" data-testid="text-error">Error: {(error as Error).message}</p>
            </CardContent>
          </Card>
        )}

        {data?.success && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
              <Card className="bg-slate-100/60 border-slate-200">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-cyan-400" data-testid="text-genes-scanned">
                    {(data.genomeStats.totalGenesScanned / 1000).toFixed(0)}K
                  </div>
                  <div className="text-xs text-slate-500">Gene×Tissue Scans</div>
                </CardContent>
              </Card>
              <Card className="bg-slate-100/60 border-slate-200">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-blue-400" data-testid="text-tissues">
                    {data.genomeStats.totalTissues}
                  </div>
                  <div className="text-xs text-slate-500">Independent Tissues</div>
                </CardContent>
              </Card>
              <Card className="bg-slate-100/60 border-slate-200">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-amber-400" data-testid="text-clock-recovered">
                    {data.knownClockRecovered.length}
                  </div>
                  <div className="text-xs text-slate-500">Clock Genes Recovered</div>
                </CardContent>
              </Card>
              <Card className="bg-slate-100/60 border-slate-200">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-green-400" data-testid="text-total-candidates">
                    {data.candidates.length}
                  </div>
                  <div className="text-xs text-slate-500">Total Candidates</div>
                </CardContent>
              </Card>
              <Card className="bg-slate-100/60 border-slate-200">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-cyan-300" data-testid="text-novel-candidates">
                    {data.novelCandidates.length}
                  </div>
                  <div className="text-xs text-slate-500">Novel (Uncategorised)</div>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-amber-900/20 border-amber-800 mb-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-amber-400" />
                  Positive Control: Known Clock Genes Recovered
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600 mb-3">
                  These known clock genes were independently identified in the top 5% persistent + oscillatory zone
                  across multiple tissues — validating the discovery protocol.
                </p>
                <div className="flex flex-wrap gap-2">
                  {data.knownClockRecovered.map(c => (
                    <Badge
                      key={c.gene}
                      className="bg-amber-800/50 text-amber-200 border-amber-600 text-sm px-3 py-1"
                    >
                      {c.gene}: {c.tissuesInTop}/{c.totalTissues} tissues, mean |λ| = {c.meanEV.toFixed(3)}
                    </Badge>
                  ))}
                </div>
                {data.knownClockRecovered.length === 0 && (
                  <p className="text-amber-400">No known clock genes met the cross-tissue threshold — positive control failed.</p>
                )}
              </CardContent>
            </Card>

            {data.crossTissueReplicators.length > 0 && (
              <Card className="bg-cyan-900/20 border-cyan-800 mb-6">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-cyan-400" />
                      Strongest Novel Candidates — Cross-Tissue Replicators
                    </CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadCSV(data.crossTissueReplicators, 'strong_replicators')}
                      data-testid="button-download-replicators"
                    >
                      <Download className="w-4 h-4 mr-1" /> CSV
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600 mb-3">
                    Genes with NO pre-existing category assignment that appear in the high-persistence oscillatory zone
                    across ≥{Math.max(3, Math.floor(data.genomeStats.totalTissues / 2))} tissues.
                    These are the strongest candidates for unknown regulatory cores.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" data-testid="table-replicators">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="text-left p-2">Gene</th>
                          <th className="text-center p-2">Tissues</th>
                          <th className="text-right p-2">Mean |λ|</th>
                          <th className="text-right p-2">Max |λ|</th>
                          <th className="text-right p-2">Consistency</th>
                          <th className="text-left p-2">Tissue List</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.crossTissueReplicators.slice(0, 30).map(c => (
                          <tr key={c.gene} className="border-b border-gray-800 hover:bg-gray-750/40" data-testid={`row-replicator-${c.gene}`}>
                            <td className="p-2 font-bold text-cyan-300">{c.gene}</td>
                            <td className="p-2 text-center font-mono font-bold text-green-400">{c.tissuesFound}</td>
                            <td className="p-2 text-right font-mono">{c.meanCrossTissueEV.toFixed(3)}</td>
                            <td className="p-2 text-right font-mono">{c.eigenvalue.toFixed(3)}</td>
                            <td className="p-2 text-right font-mono text-slate-500">{c.crossTissueConsistency.toFixed(2)}</td>
                            <td className="p-2 text-xs text-slate-500">{c.tissueList.join(', ')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <Card className="bg-slate-100/60 border-slate-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Candidates by Cross-Tissue Replication Count</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={(() => {
                        const counts: Record<number, { clock: number; novel: number; known: number }> = {};
                        for (const c of data.candidates) {
                          if (!counts[c.tissuesFound]) counts[c.tissuesFound] = { clock: 0, novel: 0, known: 0 };
                          if (c.knownCategory === 'clock') counts[c.tissuesFound].clock++;
                          else if (c.knownCategory === 'other') counts[c.tissuesFound].novel++;
                          else counts[c.tissuesFound].known++;
                        }
                        return Object.entries(counts)
                          .map(([k, v]) => ({ tissues: +k, ...v }))
                          .sort((a, b) => a.tissues - b.tissues);
                      })()}
                      margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="tissues" tick={{ fill: '#9ca3af' }} label={{ value: 'Tissues', position: 'bottom', fill: '#9ca3af', offset: -5 }} />
                      <YAxis tick={{ fill: '#9ca3af' }} label={{ value: 'Genes', angle: -90, position: 'insideLeft', fill: '#9ca3af' }} />
                      <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
                      <Bar dataKey="clock" stackId="a" fill="#f59e0b" name="Clock (positive control)" />
                      <Bar dataKey="known" stackId="a" fill="#6b7280" name="Other known category" />
                      <Bar dataKey="novel" stackId="a" fill="#06b6d4" name="Novel (uncategorised)" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="bg-slate-100/60 border-slate-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Tissue Genome Statistics (P95 Threshold)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={data.tissues.map(t => ({
                        tissue: t.tissue,
                        p95: t.genomeP95,
                        clockMed: t.clockMedian,
                        median: t.genomeMedian,
                      }))}
                      margin={{ top: 10, right: 20, left: 0, bottom: 40 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="tissue" tick={{ fill: '#9ca3af', fontSize: 10 }} angle={-35} textAnchor="end" />
                      <YAxis tick={{ fill: '#9ca3af' }} domain={[0, 'auto']} label={{ value: '|λ|', angle: -90, position: 'insideLeft', fill: '#9ca3af' }} />
                      <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
                      <Bar dataKey="median" fill="#4b5563" name="Genome Median" opacity={0.4} />
                      <Bar dataKey="p95" fill="#06b6d4" name="95th Percentile" opacity={0.7} />
                      <Bar dataKey="clockMed" fill="#f59e0b" name="Clock Median" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-slate-100/60 border-slate-200 mb-6">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Dna className="w-5 h-5 text-cyan-400" />
                    All Candidates — Full Table
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadCSV(data.candidates, 'all_candidates')}
                      data-testid="button-download-all"
                    >
                      <Download className="w-4 h-4 mr-1" /> All CSV
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadCSV(data.novelCandidates, 'novel_only')}
                      data-testid="button-download-novel"
                    >
                      <Download className="w-4 h-4 mr-1" /> Novel Only
                    </Button>
                    <Button
                      variant={showAll ? "default" : "outline"}
                      size="sm"
                      onClick={() => setShowAll(!showAll)}
                      data-testid="button-toggle-all"
                    >
                      {showAll ? 'Show Top 50' : `Show All (${data.candidates.length})`}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="table-all-candidates">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="text-left p-3">Gene</th>
                        <th className="text-center p-3">Category</th>
                        <th className="text-center p-3">Tissues</th>
                        <th className="text-right p-3">Mean |λ|</th>
                        <th className="text-right p-3">Max |λ|</th>
                        <th className="text-right p-3">Consistency</th>
                        <th className="text-right p-3">R²</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(showAll ? data.candidates : data.candidates.slice(0, 50)).map(c => (
                        <GeneRow
                          key={c.gene}
                          c={c}
                          expanded={expandedGene === c.gene}
                          onToggle={() => setExpandedGene(expandedGene === c.gene ? null : c.gene)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-100/60 border-slate-200 mb-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  Caveats and Interpretation
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-600 space-y-2">
                <p><strong>These are candidates, not validated regulatory cores.</strong> High |λ| + complex roots + cross-tissue replication makes a gene statistically interesting, but does not prove it drives oscillation. It could be a robust downstream readout of a true regulatory core.</p>
                <p><strong>Bulk tissue data.</strong> Cell-type composition changes over the circadian cycle could create apparent dynamics. A gene scoring high might reflect cell-type proportion shifts rather than intracellular oscillation.</p>
                <p><strong>12-timepoint resolution.</strong> Individual gene |λ| estimates are noisy. Cross-tissue replication mitigates this — a gene appearing in the top 5% oscillatory zone across 6+ independent tissues is unlikely to be noise.</p>
                <p><strong>Positive control validation.</strong> If known clock genes are NOT recovered by this protocol, the entire approach would be suspect. Their recovery confirms the method can detect true regulatory cores.</p>
              </CardContent>
            </Card>

            <Card className="bg-slate-100/60 border-slate-200 mb-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Info className="w-4 h-4 text-blue-400" />
                  Methodology
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs text-slate-500 whitespace-pre-wrap font-mono" data-testid="text-methodology">
                  {data.methodology}
                </pre>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
