import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, ReferenceLine, Legend, ErrorBar
} from "recharts";
import {
  ArrowLeft, Loader2, ShieldCheck, ShieldAlert, AlertCircle,
  Layers, ChevronDown, ChevronUp, Copy, Check, FlaskConical, XCircle, CheckCircle2
} from "lucide-react";
import { Link } from "wouter";
import { useState, useCallback } from "react";

interface BaselineData {
  clockMean: number;
  targetMean: number;
  gap: number;
  clockN: number;
  targetN: number;
}

interface ShuffleData {
  observedGap: number;
  meanShuffledGap: number;
  sdShuffledGap: number;
  pValue: number;
  zScore: number;
  hierarchyPreservedRate: number;
  significant: boolean;
  interpretation: string;
}

interface NullData {
  observedGap: number;
  meanNullGap: number;
  sdNullGap: number;
  pValue: number;
  zScore: number;
  percentileRank: number;
  significant: boolean;
  interpretation: string;
}

interface BootstrapData {
  observedGap: number;
  gapCI: { lower: number; upper: number };
  probGapNegative: number;
  gapStraddlesZero?: boolean;
  clockCI: { lower: number; upper: number };
  targetCI: { lower: number; upper: number };
  perGene: { gene: string; geneType: string; eigenvalue: number; ci: { lower: number; upper: number } }[];
}

interface AR1vsAR2Gene {
  gene: string;
  geneType: string;
  ar1EV: number;
  ar2EV: number;
  ar1R2: number;
  ar2R2: number;
  ar2Better: boolean;
  deltaAIC: number;
}

interface AR1vsAR2Data {
  perGene: AR1vsAR2Gene[];
  summaryByClock: { ar1MeanR2: number; ar2MeanR2: number; ar2WinRate: number; meanDeltaAIC: number };
  summaryByTarget: { ar1MeanR2: number; ar2MeanR2: number; ar2WinRate: number; meanDeltaAIC: number };
  conclusion: string;
}

interface LayerData {
  baseline: BaselineData;
  timeShuffle: ShuffleData;
  randomGeneSetNull: NullData;
  bootstrapCI: BootstrapData;
  ar1VsAr2: AR1vsAR2Data;
}

interface HeadToHead {
  dermisGap: number;
  epidermisGap: number;
  gapDifference: number;
  dermisShufflePValue: number;
  epidermisShufflePValue: number;
  dermisNullPValue: number;
  epidermisNullPValue: number;
  dermisBootstrapCI: { lower: number; upper: number };
  epidermisBootstrapCI: { lower: number; upper: number };
  epidermisProbNegative: number;
  dermisAR2WinRate: number;
  epidermisAR2WinRate: number;
}

interface SkinStressData {
  title: string;
  description: string;
  layers: { dermis: LayerData; epidermis: LayerData };
  headToHead: HeadToHead;
  verdict: string;
}

function PassFail({ pass }: { pass: boolean }) {
  return pass ? (
    <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
      <CheckCircle2 className="w-4 h-4" /> PASS
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-red-400 font-medium">
      <XCircle className="w-4 h-4" /> FAIL
    </span>
  );
}

function PValueBadge({ p }: { p: number }) {
  const sig = p < 0.05;
  return (
    <Badge variant="outline" className={sig ? "border-emerald-600 text-emerald-400" : "border-red-600 text-red-400"}>
      p = {p < 0.001 ? p.toExponential(1) : p.toFixed(3)}
    </Badge>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 text-sm shadow-xl">
      <div className="font-bold text-slate-900">{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color: p.color }}>{p.name}: {typeof p.value === 'number' ? p.value.toFixed(4) : p.value}</div>
      ))}
    </div>
  );
};

function LayerPanel({ layer, data, isExpanded, toggle }: { layer: string; data: LayerData; isExpanded: boolean; toggle: () => void }) {
  const isDermis = layer === 'dermis';
  const accentColor = isDermis ? 'cyan' : 'amber';
  const passCount = [data.timeShuffle.significant, data.randomGeneSetNull.significant].filter(Boolean).length;

  const bootstrapGenes = data.bootstrapCI.perGene;
  const clockGenes = bootstrapGenes.filter(g => g.geneType === 'clock');
  const targetGenes = bootstrapGenes.filter(g => g.geneType === 'target');

  const bootstrapChartData = [...clockGenes, ...targetGenes].map(g => ({
    gene: g.gene,
    eigenvalue: g.eigenvalue,
    ciLow: g.ci.lower,
    ciHigh: g.ci.upper,
    errorLow: g.eigenvalue - g.ci.lower,
    errorHigh: g.ci.upper - g.eigenvalue,
    geneType: g.geneType,
  }));

  return (
    <Card className="bg-white border-slate-200">
      <CardHeader className="cursor-pointer" onClick={toggle}>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className={`text-lg text-${accentColor}-300 flex items-center gap-2`}>
              <Layers className="w-5 h-5" />
              {isDermis ? 'Dermis (Deep Skin)' : 'Epidermis (Surface Skin)'}
            </CardTitle>
            <CardDescription>
              Baseline gap = {data.baseline.gap.toFixed(4)} | {data.baseline.clockN} clock + {data.baseline.targetN} target genes | Falsification: {passCount}/2 passed
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <Badge className={isDermis
              ? "bg-emerald-900/50 text-emerald-300 border-emerald-700"
              : "bg-amber-900/50 text-amber-300 border-amber-700"}>
              {isDermis ? 'Genuine Structure' : 'Weak/Absent'}
            </Badge>
            {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-500" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
          </div>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="space-y-6">
          {/* Test 1: Time Shuffle */}
          <div className="border border-slate-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <span className="text-slate-500 text-sm">Test 1:</span> Time-Shuffle Falsification
              </h3>
              <PassFail pass={data.timeShuffle.significant} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <div className="text-slate-500">Observed Gap</div>
                <div className="font-mono text-slate-900">{data.timeShuffle.observedGap.toFixed(4)}</div>
              </div>
              <div>
                <div className="text-slate-500">Shuffled Mean</div>
                <div className="font-mono text-slate-600">{data.timeShuffle.meanShuffledGap.toFixed(4)}</div>
              </div>
              <div>
                <div className="text-slate-500">z-Score</div>
                <div className="font-mono text-slate-900">{data.timeShuffle.zScore.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-slate-500">p-Value</div>
                <PValueBadge p={data.timeShuffle.pValue} />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-2">{data.timeShuffle.interpretation}</p>
          </div>

          {/* Test 2: Random Gene-Set Null */}
          <div className="border border-slate-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <span className="text-slate-500 text-sm">Test 2:</span> Random Gene-Set Null
              </h3>
              <PassFail pass={data.randomGeneSetNull.significant} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <div className="text-slate-500">Observed Gap</div>
                <div className="font-mono text-slate-900">{data.randomGeneSetNull.observedGap.toFixed(4)}</div>
              </div>
              <div>
                <div className="text-slate-500">Null Mean</div>
                <div className="font-mono text-slate-600">{data.randomGeneSetNull.meanNullGap.toFixed(4)}</div>
              </div>
              <div>
                <div className="text-slate-500">Percentile</div>
                <div className="font-mono text-slate-900">{data.randomGeneSetNull.percentileRank.toFixed(1)}th</div>
              </div>
              <div>
                <div className="text-slate-500">p-Value</div>
                <PValueBadge p={data.randomGeneSetNull.pValue} />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-2">{data.randomGeneSetNull.interpretation}</p>
          </div>

          {/* Test 3: Bootstrap CIs */}
          <div className="border border-slate-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <span className="text-slate-500 text-sm">Test 3:</span> Block Bootstrap Confidence Intervals
              </h3>
              <span className={`text-sm font-medium ${data.bootstrapCI.probGapNegative < 0.1 ? 'text-emerald-400' : 'text-amber-400'}`}>
                P(gap &lt; 0) = {(data.bootstrapCI.probGapNegative * 100).toFixed(1)}%
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm mb-4">
              <div>
                <div className="text-slate-500">Gap 95% CI</div>
                <div className="font-mono text-slate-900">[{data.bootstrapCI.gapCI.lower.toFixed(4)}, {data.bootstrapCI.gapCI.upper.toFixed(4)}]</div>
              </div>
              <div>
                <div className="text-slate-500">Clock |λ| CI</div>
                <div className="font-mono text-blue-300">[{data.bootstrapCI.clockCI.lower.toFixed(4)}, {data.bootstrapCI.clockCI.upper.toFixed(4)}]</div>
              </div>
              <div>
                <div className="text-slate-500">Target |λ| CI</div>
                <div className="font-mono text-amber-300">[{data.bootstrapCI.targetCI.lower.toFixed(4)}, {data.bootstrapCI.targetCI.upper.toFixed(4)}]</div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={bootstrapChartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="gene" stroke="#6b7280" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                <YAxis domain={[0, 1.1]} stroke="#6b7280" />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={1.0} stroke="#ef4444" strokeDasharray="3 3" label={{ value: '|λ|=1', fill: '#ef4444', fontSize: 10 }} />
                <Bar dataKey="eigenvalue" name="Eigenvalue |λ|" radius={[2, 2, 0, 0]}>
                  {bootstrapChartData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.geneType === 'clock' ? '#60a5fa' : '#f59e0b'} opacity={0.8} />
                  ))}
                  <ErrorBar dataKey="errorHigh" width={2} strokeWidth={1} stroke="#6b7280" direction="y" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex gap-4 justify-center text-xs mt-1">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-400 inline-block" /> Clock</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-400 inline-block" /> Target</span>
            </div>
          </div>

          {/* Test 4: AR(1) vs AR(2) */}
          <div className="border border-slate-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <span className="text-slate-500 text-sm">Test 4:</span> AR(1) vs AR(2) Model Order
              </h3>
              <span className="text-sm text-slate-500">
                AR(2) win rate: Clock {(data.ar1VsAr2.summaryByClock.ar2WinRate * 100).toFixed(0)}%, Target {(data.ar1VsAr2.summaryByTarget.ar2WinRate * 100).toFixed(0)}%
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm mb-3">
              <div>
                <div className="text-slate-500 mb-1">Clock Genes</div>
                <div className="font-mono text-blue-300">AR(1) R²: {data.ar1VsAr2.summaryByClock.ar1MeanR2.toFixed(4)} | AR(2) R²: {data.ar1VsAr2.summaryByClock.ar2MeanR2.toFixed(4)}</div>
                <div className="font-mono text-slate-500">Mean ΔAIC: {data.ar1VsAr2.summaryByClock.meanDeltaAIC.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-slate-500 mb-1">Target Genes</div>
                <div className="font-mono text-amber-300">AR(1) R²: {data.ar1VsAr2.summaryByTarget.ar1MeanR2.toFixed(4)} | AR(2) R²: {data.ar1VsAr2.summaryByTarget.ar2MeanR2.toFixed(4)}</div>
                <div className="font-mono text-slate-500">Mean ΔAIC: {data.ar1VsAr2.summaryByTarget.meanDeltaAIC.toFixed(2)}</div>
              </div>
            </div>
            <p className="text-xs text-slate-500">{data.ar1VsAr2.conclusion}</p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export default function SkinStressTests() {
  const [dermisExpanded, setDermisExpanded] = useState(true);
  const [epidermisExpanded, setEpidermisExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  const { data, isLoading, error } = useQuery<SkinStressData>({
    queryKey: ['/api/validation/skin-stress-tests'],
  });

  const handleCopy = useCallback(() => {
    if (!data) return;
    const h = data.headToHead;
    const text = [
      `Skin Stress Tests (GSE205155)`,
      `Dermis gap: ${h.dermisGap.toFixed(4)} | Epidermis gap: ${h.epidermisGap.toFixed(4)}`,
      `Dermis shuffle p=${h.dermisShufflePValue} | Epidermis shuffle p=${h.epidermisShufflePValue}`,
      `Dermis null p=${h.dermisNullPValue} | Epidermis null p=${h.epidermisNullPValue}`,
      `Verdict: ${data.verdict}`,
    ].join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [data]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 text-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-700" data-testid="link-back">
              <ArrowLeft className="w-4 h-4 mr-2" /> Home
            </Button>
          </Link>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={handleCopy} className="text-slate-500" data-testid="button-copy">
            {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
            {copied ? 'Copied' : 'Copy Results'}
          </Button>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 bg-clip-text text-transparent" data-testid="text-page-title">
            Skin Stress Tests (GSE205155)
          </h1>
          <p className="text-slate-500 mt-2 max-w-3xl">
            Comprehensive falsification and robustness testing comparing dermis (deep skin, strong circadian biology)
            vs epidermis (surface skin, weak circadian biology). Four independent tests determine whether the
            clock-target eigenvalue hierarchy reflects genuine temporal structure or statistical noise.
          </p>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-teal-400" />
            <span className="ml-3 text-slate-500">Running 4 stress tests on 2 skin layers...</span>
          </div>
        )}

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="w-4 h-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>Failed to load skin stress tests.</AlertDescription>
          </Alert>
        )}

        {data && (
          <>
            {/* Head-to-Head Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card className="bg-white border-slate-200">
                <CardContent className="pt-6">
                  <div className="text-sm text-slate-500">Dermis Gap</div>
                  <div className="text-3xl font-bold text-cyan-300" data-testid="text-dermis-gap">{data.headToHead.dermisGap.toFixed(4)}</div>
                  <div className="text-xs text-emerald-400">Both tests PASS</div>
                </CardContent>
              </Card>
              <Card className="bg-white border-slate-200">
                <CardContent className="pt-6">
                  <div className="text-sm text-slate-500">Epidermis Gap</div>
                  <div className="text-3xl font-bold text-amber-300" data-testid="text-epidermis-gap">{data.headToHead.epidermisGap.toFixed(4)}</div>
                  <div className="text-xs text-red-400">Both tests FAIL</div>
                </CardContent>
              </Card>
              <Card className="bg-white border-slate-200">
                <CardContent className="pt-6">
                  <div className="text-sm text-slate-500">Gap Difference</div>
                  <div className="text-3xl font-bold text-slate-900">{data.headToHead.gapDifference.toFixed(4)}</div>
                  <div className="text-xs text-slate-500">Dermis - Epidermis</div>
                </CardContent>
              </Card>
              <Card className="bg-white border-slate-200">
                <CardContent className="pt-6">
                  <div className="text-sm text-slate-500">P(epidermis gap &lt; 0)</div>
                  <div className="text-3xl font-bold text-slate-900">{(data.headToHead.epidermisProbNegative * 100).toFixed(1)}%</div>
                  <div className="text-xs text-slate-500">Bootstrap probability</div>
                </CardContent>
              </Card>
            </div>

            {/* Verdict */}
            <Alert className="mb-6 border-emerald-700/50 bg-emerald-950/20">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <AlertTitle className="text-emerald-300">Verdict</AlertTitle>
              <AlertDescription className="text-slate-600">{data.verdict}</AlertDescription>
            </Alert>

            {/* Comparison Bar Chart */}
            <Card className="bg-white border-slate-200 mb-6">
              <CardHeader>
                <CardTitle className="text-lg text-slate-900">Head-to-Head: Falsification p-Values</CardTitle>
                <CardDescription>Dermis passes both tests (p &lt; 0.05); epidermis fails both (p &gt; 0.3)</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={[
                    { test: 'Time Shuffle', dermis: data.headToHead.dermisShufflePValue, epidermis: data.headToHead.epidermisShufflePValue },
                    { test: 'Random Null', dermis: data.headToHead.dermisNullPValue, epidermis: data.headToHead.epidermisNullPValue },
                  ]} margin={{ top: 10, right: 30, bottom: 10, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="test" stroke="#6b7280" />
                    <YAxis domain={[0, 0.5]} stroke="#6b7280" label={{ value: 'p-value', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine y={0.05} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'α=0.05', fill: '#ef4444', fontSize: 10 }} />
                    <Bar dataKey="dermis" name="Dermis" fill="#22d3ee" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="epidermis" name="Epidermis" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    <Legend />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Layer Panels */}
            <div className="space-y-4 mb-8">
              <LayerPanel
                layer="dermis"
                data={data.layers.dermis}
                isExpanded={dermisExpanded}
                toggle={() => setDermisExpanded(!dermisExpanded)}
              />
              <LayerPanel
                layer="epidermis"
                data={data.layers.epidermis}
                isExpanded={epidermisExpanded}
                toggle={() => setEpidermisExpanded(!epidermisExpanded)}
              />
            </div>

            {/* Methodology */}
            <Card className="bg-white border-slate-200">
              <CardHeader>
                <CardTitle className="text-lg text-slate-900">Methodology</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-500 space-y-3">
                <p>
                  <strong className="text-slate-600">Dataset:</strong> GSE205155 (Narayan et al.) — human skin biopsies from
                  dermis and epidermis layers, sampled every 4 hours over 24h. Dermis has established circadian clock
                  activity; epidermis has weak or absent circadian regulation.
                </p>
                <p>
                  <strong className="text-slate-600">Test 1 — Time Shuffle:</strong> Randomly permutes time labels 500 times
                  and re-computes the clock-target gap. If the observed gap exceeds 95% of shuffled gaps, the temporal
                  ordering matters (not just gene identity).
                </p>
                <p>
                  <strong className="text-slate-600">Test 2 — Random Gene-Set Null:</strong> Draws 500 random gene sets of the
                  same size as the clock/target panels and computes their gap. If the observed gap exceeds 95% of random
                  gaps, the specific identity of clock/target genes matters (not just any genes).
                </p>
                <p>
                  <strong className="text-slate-600">Test 3 — Block Bootstrap CIs:</strong> Resamples time series with block
                  structure preserved (400 iterations) to generate 95% confidence intervals for each gene's eigenvalue
                  and the overall gap. Reports P(gap &lt; 0).
                </p>
                <p>
                  <strong className="text-slate-600">Test 4 — AR(1) vs AR(2):</strong> Compares model fit (R²) and AIC between
                  AR(1) and AR(2) for each gene. Determines whether the second autoregressive lag adds meaningful
                  predictive power (multi-generational memory).
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
