import { useQuery } from "@tanstack/react-query";
import { Loader2, Download, ExternalLink, Info } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, Cell
} from "recharts";

type GeneResult = {
  gene: string;
  category: string;
  tissue: string;
  eigenvalue: number;
  phi1: number;
  phi2: number;
  r2: number;
  isComplex: boolean;
  meanExpression: number;
  expressionCV: number;
  moscotRole: string;
  eigenvaluePercentile: number;
};

type PermTest = {
  observedMean: number;
  nullMean: number;
  nullSd: number;
  pValue: number;
  zScore: number;
  nPerm: number;
  interpretation: string;
};

type MoscotAnalysisResult = {
  dataset: {
    name: string;
    tissue: string;
    nTimepoints: number;
    timepointSpacing: string;
    totalGenesAnalysed: number;
    moscotReference: string;
    moscotDoi: string;
  };
  geneResults: GeneResult[];
  categorySummary: Record<string, { mean: number; median: number; n: number; label: string }>;
  permutationTests: {
    moscot_vs_background: PermTest;
    islet_vs_background: PermTest;
  };
  backgroundDistribution: {
    bins: Array<{ bin: number; count: number }>;
    mean: number;
    median: number;
    n: number;
  };
  keyFindings: string[];
};

const CATEGORY_COLORS: Record<string, string> = {
  clock: '#6366f1',
  moscot_tf: '#f59e0b',
  islet_effector: '#10b981',
  background: '#6b7280',
};

const CATEGORY_LABELS: Record<string, string> = {
  clock: 'Clock gene',
  moscot_tf: 'Moscot lineage TF',
  islet_effector: 'Islet effector',
  background: 'Background',
};

function pFmt(p: number): string {
  if (p < 0.001) return 'p < 0.001';
  return `p = ${p.toFixed(3)}`;
}

function downloadCSV(data: GeneResult[], filename: string) {
  const header = 'Gene,Category,Tissue,|λ|,φ₁,φ₂,R²,ComplexRoots,MeanExpression,CV,GenomePercentile,MoscotRole';
  const rows = data.map(g =>
    [g.gene, g.category, g.tissue, g.eigenvalue, g.phi1, g.phi2, g.r2,
     g.isComplex, g.meanExpression, g.expressionCV, g.eigenvaluePercentile,
     `"${g.moscotRole}"`].join(',')
  );
  const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function MoscotPancreas() {
  const { data, isLoading, error } = useQuery<MoscotAnalysisResult>({
    queryKey: ['/api/analysis/moscot-pancreas'],
    staleTime: Infinity,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3" data-testid="loading-moscot">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        <span className="text-lg text-muted-foreground">Running AR(2) on moscot × PAR(2) gene set…</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen" data-testid="error-moscot">
        <div className="text-destructive text-center">
          <p className="text-lg font-semibold">Analysis failed</p>
          <p className="text-sm mt-1">{String(error)}</p>
        </div>
      </div>
    );
  }

  const { dataset, geneResults, categorySummary, permutationTests, backgroundDistribution, keyFindings } = data;

  const chartData = geneResults.map(g => ({
    ...g,
    fill: CATEGORY_COLORS[g.category] || '#6b7280',
  }));

  const clockMean = categorySummary.clock?.mean ?? 0;
  const bgMean = backgroundDistribution.mean;

  const moscotPerm = permutationTests.moscot_vs_background;
  const isletPerm = permutationTests.islet_vs_background;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8" data-testid="page-moscot-pancreas">

      {/* Header */}
      <div className="border-b pb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Moscot × PAR(2): Pancreatic Lineage TFs in Adult Tissue
            </h1>
            <p className="mt-2 text-muted-foreground text-sm max-w-2xl">
              AR(2) eigenvalue modulus |λ| is computed for genes identified by optimal-transport
              lineage tracing (moscot) as drivers of pancreatic endocrine differentiation.
              The question: do these developmental regulators maintain temporal persistence in adult
              circadian tissue?
            </p>
          </div>
          <button
            data-testid="button-download-moscot-csv"
            onClick={() => downloadCSV(geneResults, 'moscot_par2_eigenvalues.csv')}
            className="flex items-center gap-2 px-3 py-2 rounded-md border text-sm hover:bg-muted transition-colors whitespace-nowrap"
          >
            <Download className="h-4 w-4" /> Download CSV
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <div className="text-xs bg-muted rounded px-2 py-1">
            <span className="font-medium">Dataset:</span> {dataset.name}
          </div>
          <div className="text-xs bg-muted rounded px-2 py-1">
            <span className="font-medium">Timepoints:</span> {dataset.nTimepoints} ({dataset.timepointSpacing})
          </div>
          <div className="text-xs bg-muted rounded px-2 py-1">
            <span className="font-medium">Background:</span> {dataset.totalGenesAnalysed.toLocaleString()} genes
          </div>
          <a
            href={`https://doi.org/${dataset.moscotDoi}`}
            target="_blank"
            rel="noreferrer"
            data-testid="link-moscot-doi"
            className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded px-2 py-1 flex items-center gap-1 hover:bg-amber-100 transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            {dataset.moscotReference}
          </a>
        </div>
      </div>

      {/* Key findings */}
      {keyFindings.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4" data-testid="section-key-findings">
          <div className="flex items-center gap-2 mb-3">
            <Info className="h-4 w-4 text-blue-600" />
            <h2 className="font-semibold text-blue-900 text-sm">Key Findings</h2>
          </div>
          <ul className="space-y-1.5">
            {keyFindings.map((f, i) => (
              <li key={i} className="text-sm text-blue-800" data-testid={`finding-${i}`}>• {f}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Category summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="section-category-summary">
        {Object.entries(categorySummary).map(([cat, stats]) => (
          <div
            key={cat}
            data-testid={`summary-card-${cat}`}
            className="rounded-lg border p-4 text-center"
            style={{ borderColor: CATEGORY_COLORS[cat] + '55', background: CATEGORY_COLORS[cat] + '0D' }}
          >
            <div className="text-xs text-muted-foreground mb-1">{stats.label}</div>
            <div
              className="text-2xl font-bold"
              style={{ color: CATEGORY_COLORS[cat] }}
            >
              {stats.mean.toFixed(3)}
            </div>
            <div className="text-xs text-muted-foreground">mean |λ| (n={stats.n})</div>
            <div className="text-xs text-muted-foreground mt-0.5">median {stats.median.toFixed(3)}</div>
          </div>
        ))}
      </div>

      {/* Main ranked bar chart */}
      <div className="rounded-lg border p-5" data-testid="section-eigenvalue-chart">
        <h2 className="font-semibold mb-1">Ranked |λ| — All Focal Genes</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Each bar is a gene coloured by category. Dashed lines show clock gene mean and genome background mean.
        </p>
        <ResponsiveContainer width="100%" height={420}>
          <BarChart
            data={chartData}
            margin={{ top: 5, right: 20, left: 0, bottom: 80 }}
            barCategoryGap={4}
          >
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis
              dataKey="gene"
              angle={-55}
              textAnchor="end"
              tick={{ fontSize: 11 }}
              interval={0}
            />
            <YAxis
              domain={[0, 1]}
              tickFormatter={v => v.toFixed(2)}
              label={{ value: '|λ|', angle: -90, position: 'insideLeft', offset: 12, fontSize: 12 }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const g = payload[0].payload as GeneResult & { fill: string };
                return (
                  <div className="bg-white border rounded shadow-lg p-3 text-xs max-w-xs">
                    <div className="font-bold text-sm mb-1">{g.gene}</div>
                    <div className="text-muted-foreground mb-1">{CATEGORY_LABELS[g.category]}</div>
                    <div><b>|λ|</b> = {g.eigenvalue.toFixed(4)}</div>
                    <div><b>Genome percentile:</b> {g.eigenvaluePercentile}th</div>
                    <div><b>φ₁</b> = {g.phi1.toFixed(4)}, <b>φ₂</b> = {g.phi2.toFixed(4)}</div>
                    <div><b>R²</b> = {g.r2.toFixed(4)}</div>
                    <div><b>Complex roots:</b> {g.isComplex ? 'Yes (oscillatory)' : 'No (monotone)'}</div>
                    <div><b>Mean expression:</b> {g.meanExpression.toFixed(1)}</div>
                    <div><b>CV:</b> {g.expressionCV.toFixed(3)}</div>
                    <div><b>Tissue:</b> {g.tissue}</div>
                    {g.moscotRole && <div className="mt-1 text-amber-700"><b>Moscot role:</b> {g.moscotRole}</div>}
                  </div>
                );
              }}
            />
            <ReferenceLine
              y={clockMean}
              stroke="#6366f1"
              strokeDasharray="6 2"
              label={{ value: `Clock mean ${clockMean.toFixed(3)}`, position: 'insideRight', fontSize: 10, fill: '#6366f1' }}
            />
            <ReferenceLine
              y={bgMean}
              stroke="#9ca3af"
              strokeDasharray="4 4"
              label={{ value: `Background ${bgMean.toFixed(3)}`, position: 'insideTopRight', fontSize: 10, fill: '#9ca3af' }}
            />
            <Bar dataKey="eigenvalue" maxBarSize={24}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-2 justify-center">
          {Object.entries(CATEGORY_COLORS).filter(([k]) => k !== 'background').map(([cat, color]) => (
            <div key={cat} className="flex items-center gap-1.5 text-xs">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: color }} />
              {CATEGORY_LABELS[cat]}
            </div>
          ))}
        </div>
      </div>

      {/* Permutation tests */}
      <div className="grid md:grid-cols-2 gap-4" data-testid="section-permutation-tests">
        {([
          { key: 'moscot_vs_background', label: 'Moscot TFs vs Genome Background', perm: moscotPerm, color: '#f59e0b' },
          { key: 'islet_vs_background', label: 'Islet Effectors vs Genome Background', perm: isletPerm, color: '#10b981' },
        ] as const).map(({ key, label, perm, color }) => (
          <div key={key} className="rounded-lg border p-4" data-testid={`perm-test-${key}`}>
            <h3 className="font-semibold text-sm mb-3">{label}</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Observed mean |λ|</span>
                <span className="font-mono font-medium" style={{ color }}>{perm.observedMean.toFixed(4)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Null mean (n={perm.nPerm.toLocaleString()} permutations)</span>
                <span className="font-mono">{perm.nullMean.toFixed(4)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">z-score</span>
                <span className="font-mono">{perm.zScore.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">p-value (one-sided)</span>
                <span className={`font-mono font-semibold ${perm.pValue < 0.05 ? 'text-blue-700' : 'text-muted-foreground'}`}>
                  {pFmt(perm.pValue)}
                </span>
              </div>
            </div>
            <div className={`mt-3 text-xs rounded px-2 py-1.5 ${perm.pValue < 0.05 ? 'bg-blue-50 text-blue-800' : 'bg-gray-50 text-gray-600'}`}>
              {perm.interpretation}
            </div>
          </div>
        ))}
      </div>

      {/* Per-gene table */}
      <div className="rounded-lg border" data-testid="section-gene-table">
        <div className="px-5 py-4 border-b flex justify-between items-center">
          <h2 className="font-semibold">Per-Gene Results</h2>
          <span className="text-xs text-muted-foreground">{geneResults.length} genes, ranked by |λ|</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                <th className="px-4 py-2 text-left">Gene</th>
                <th className="px-4 py-2 text-left">Category</th>
                <th className="px-4 py-2 text-left">Tissue</th>
                <th className="px-4 py-2 text-right">|λ|</th>
                <th className="px-4 py-2 text-right">Percentile</th>
                <th className="px-4 py-2 text-right">φ₁</th>
                <th className="px-4 py-2 text-right">φ₂</th>
                <th className="px-4 py-2 text-right">R²</th>
                <th className="px-4 py-2 text-center">Complex</th>
                <th className="px-4 py-2 text-right">Mean expr</th>
                <th className="px-4 py-2 text-left">Moscot role</th>
              </tr>
            </thead>
            <tbody>
              {geneResults.map((g, i) => (
                <tr
                  key={g.gene}
                  data-testid={`gene-row-${g.gene}`}
                  className={`border-b hover:bg-muted/20 transition-colors ${i % 2 === 0 ? '' : 'bg-muted/10'}`}
                >
                  <td className="px-4 py-2 font-medium font-mono">{g.gene}</td>
                  <td className="px-4 py-2">
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{
                        background: CATEGORY_COLORS[g.category] + '20',
                        color: CATEGORY_COLORS[g.category],
                      }}
                    >
                      {CATEGORY_LABELS[g.category]}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground text-xs">{g.tissue}</td>
                  <td className="px-4 py-2 text-right font-mono font-semibold">{g.eigenvalue.toFixed(4)}</td>
                  <td className="px-4 py-2 text-right">
                    <span className={`text-xs font-medium ${g.eigenvaluePercentile >= 90 ? 'text-purple-700' : g.eigenvaluePercentile >= 75 ? 'text-blue-700' : g.eigenvaluePercentile >= 50 ? 'text-green-700' : 'text-muted-foreground'}`}>
                      {g.eigenvaluePercentile}th
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-xs">{g.phi1.toFixed(4)}</td>
                  <td className="px-4 py-2 text-right font-mono text-xs">{g.phi2.toFixed(4)}</td>
                  <td className="px-4 py-2 text-right font-mono text-xs">{g.r2.toFixed(4)}</td>
                  <td className="px-4 py-2 text-center text-xs">{g.isComplex ? '✓' : '—'}</td>
                  <td className="px-4 py-2 text-right text-xs">{g.meanExpression.toFixed(0)}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground max-w-[220px]">{g.moscotRole}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Background distribution histogram */}
      <div className="rounded-lg border p-5" data-testid="section-background-histogram">
        <h2 className="font-semibold mb-1">Genome Background |λ| Distribution</h2>
        <p className="text-xs text-muted-foreground mb-4">
          {backgroundDistribution.n.toLocaleString()} genes from GSE54650 Hypothalamus.
          Mean = {backgroundDistribution.mean.toFixed(3)}, Median = {backgroundDistribution.median.toFixed(3)}.
        </p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={backgroundDistribution.bins} margin={{ top: 5, right: 20, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="bin" tickFormatter={v => v.toFixed(2)} tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v: number) => [v, 'Genes']} labelFormatter={l => `|λ| ≥ ${l}`} />
            <Bar dataKey="count" fill="#6b7280" opacity={0.6} />
            <ReferenceLine x={backgroundDistribution.mean.toFixed(2)} stroke="#ef4444" strokeDasharray="4 2" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Methods note */}
      <div className="bg-muted/30 rounded-lg p-5 text-xs text-muted-foreground space-y-1.5" data-testid="section-methods">
        <div className="font-semibold text-foreground mb-2">Methods</div>
        <p>
          AR(2) model fitted by ordinary least squares on mean-centred expression: y(t) = φ₁·y(t−1) + φ₂·y(t−2) + ε.
          Eigenvalue modulus |λ| is the maximum modulus of the characteristic polynomial roots.
          Complex roots (φ₁² + 4φ₂ &lt; 0) indicate oscillatory dynamics; |λ| = √(−φ₂) in that case.
        </p>
        <p>
          Dataset: {dataset.name}. Tissue: {dataset.tissue}.
          {dataset.nTimepoints} timepoints, {dataset.timepointSpacing}.
          Gene Neurod1 uses Cerebellum data where cerebellum mean expression exceeds hypothalamus by &gt;5×.
        </p>
        <p>
          Permutation test: {(5000).toLocaleString()} resamples of focal-gene-set size drawn from the combined
          focal + background pool; one-sided test for observed mean &gt; null distribution.
        </p>
        <p>
          Moscot reference: Klein et al., Nature <b>638</b>, 1065–1075 (2025).{' '}
          <a href={`https://doi.org/${dataset.moscotDoi}`} target="_blank" rel="noreferrer"
             className="underline hover:text-foreground">doi:{dataset.moscotDoi}</a>.
          NEUROD2 validated as epsilon-cell transcription factor; lineage TF gene set from moscot
          optimal-transport analysis of developing mouse pancreas.
        </p>
      </div>
    </div>
  );
}
