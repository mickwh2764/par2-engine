import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  ReferenceLine, ScatterChart, Scatter, ZAxis
} from "recharts";
import {
  ArrowLeft, Loader2, FlaskConical, XCircle, CheckCircle2, ArrowUpDown, Dna, Beaker, Activity
} from "lucide-react";
import { Link } from "wouter";
import HowTo from "@/components/HowTo";
import InsightCallout from "@/components/InsightCallout";

interface CryptVillusGene {
  symbol: string;
  ensembl: string;
  category: 'crypt' | 'villus';
  beta1: number;
  beta2: number;
  r: number;
  theta: number;
  thetaDeg: number;
  eigenvalue: number;
  r2: number;
  isComplex: boolean;
}

interface DatasetResult {
  label: string;
  genes: CryptVillusGene[];
  cryptCount: number;
  villusCount: number;
  cryptComplexCount: number;
  villusComplexCount: number;
  allCryptMeanTheta: number;
  allVillusMeanTheta: number;
  allSeparationDeg: number;
  allPermutationP: number;
  complexCryptMeanTheta: number | null;
  complexVillusMeanTheta: number | null;
  complexSeparationDeg: number | null;
  complexPermutationP: number | null;
  cryptNear137: string[];
  villusNear137: string[];
}

interface GenomeWideContext {
  totalGenes: number;
  complexGenes: number;
  near137Count: number;
  near137Pct: number;
  near222Count: number;
  near222Pct: number;
  uniformExpectation: number;
  thetaBins: { center: number; count: number }[];
}

interface CryptVillusResult {
  datasets: DatasetResult[];
  genomeWide: GenomeWideContext;
  phyllotaxisAngleDeg: number;
  productionAngleDeg: number;
  bandWidthDeg: number;
  verdict: string;
  verdictDetail: string;
  isSignificant: boolean;
}

interface SpatialTemporalResult {
  test1: {
    genotypes: { label: string; spatial: string; temporal: string; meanClock: number; meanTarget: number; gap: number; hierarchyPct: number; oscPct: number; totalGenes: number; clockCount: number; targetCount: number }[];
    perturbations: { label: string; allGeneShift: number; effectSize: number; pValue: number; clockShift: number; clockP: number; wtGap: number; newGap: number; wtOscPct: number; newOscPct: number }[];
    interaction: { apcEffect: number; bmalEffect: number; expectedAdditive: number; observedDouble: number; interactionTerm: number; interpretation: string; gapApcEffect: number; gapBmalEffect: number; gapExpected: number; gapObserved: number; gapInteraction: number; gapInterpretation: string };
    headToHead: { apcMean: number; bmalMean: number; effectSize: number; pValue: number };
  };
  test2: {
    tissues: { label: string; spatialComplexity: string; reason: string; meanClock: number; meanTarget: number; gap: number; hierarchyPct: number; pValue: number; significant: boolean; oscPct: number; clockCount: number; targetCount: number }[];
    correlation: { gapVsComplexity: number; oscVsComplexity: number; interpretation: string };
    groups: { high: { mean: number; std: number; n: number }; medium: { mean: number; std: number; n: number }; low: { mean: number; std: number; n: number }; highVsLowP: number };
  };
  test3: {
    sharedGenes: number;
    eigenCorrelations: { wtVsApc: number; wtVsBmal: number; apcVsBmal: number };
    shiftCorrelation: { r: number; interpretation: string };
    duallyAffected: { total: number; concordant: number; discordant: number; concordantPct: number };
    topGenes: { gene: string; category: string; apcShift: number; bmalShift: number; direction: string }[];
    categoryBreakdown: { category: string; total: number; concordant: number; discordant: number }[];
  };
}

type ActiveTab = 'angular' | 'perturbation' | 'tissue' | 'pergene';

function RootSpaceScatter({ genes, phyllotaxisAngle }: { genes: CryptVillusGene[]; phyllotaxisAngle: number }) {
  const svgX = (b1: number) => 50 + (b1 + 2) * (500 / 4);
  const svgY = (b2: number) => 380 - (b2 + 1) * (350 / 2);
  const [hovered, setHovered] = useState<CryptVillusGene | null>(null);

  const parabolaPoints = useMemo(() => {
    const pts: string[] = [];
    for (let b1 = -2; b1 <= 2; b1 += 0.05) {
      const b2v = b1 * b1 / 4;
      if (b2v <= 1) pts.push(`${svgX(b1)},${svgY(b2v)}`);
    }
    return pts.join(" ");
  }, []);

  const trianglePoints = `${svgX(-2)},${svgY(-1)} ${svgX(0)},${svgY(1)} ${svgX(2)},${svgY(-1)}`;

  return (
    <div className="relative">
      <svg viewBox="0 0 600 420" className="w-full" style={{ maxHeight: 420 }} data-testid="crypt-villus-scatter-svg">
        <rect width="600" height="420" fill="#0f172a" />
        <polygon points={trianglePoints} fill="none" stroke="#475569" strokeWidth="1.5" strokeDasharray="6 3" />
        <polyline points={parabolaPoints} fill="none" stroke="#eab308" strokeWidth="1" strokeDasharray="4 3" opacity="0.6" />
        <line x1={svgX(-2)} y1={svgY(0)} x2={svgX(2)} y2={svgY(0)} stroke="#334155" strokeWidth="0.5" />
        <line x1={svgX(0)} y1={svgY(-1)} x2={svgX(0)} y2={svgY(1)} stroke="#334155" strokeWidth="0.5" />
        {genes.map((g, i) => (
          <circle
            key={i}
            cx={svgX(g.beta1)}
            cy={svgY(g.beta2)}
            r={hovered?.symbol === g.symbol ? 8 : 5}
            fill={g.category === 'crypt' ? '#22d3ee' : '#f472b6'}
            stroke={hovered?.symbol === g.symbol ? '#fff' : 'none'}
            strokeWidth={2}
            opacity={0.85}
            onMouseEnter={() => setHovered(g)}
            onMouseLeave={() => setHovered(null)}
            className="cursor-pointer"
          />
        ))}
        <text x={15} y={20} fill="#94a3b8" fontSize="11">Stationarity Triangle</text>
        <circle cx={20} cy={395} r={5} fill="#22d3ee" />
        <text x={30} y={399} fill="#22d3ee" fontSize="10">Crypt (stem)</text>
        <circle cx={120} cy={395} r={5} fill="#f472b6" />
        <text x={130} y={399} fill="#f472b6" fontSize="10">Villus (differentiated)</text>
      </svg>
      {hovered && (
        <div className="absolute top-2 right-2 bg-slate-100 border border-slate-300 rounded p-2 text-xs">
          <div className="font-bold text-slate-900">{hovered.symbol}</div>
          <div className="text-slate-500">{hovered.category} | |λ|={hovered.eigenvalue.toFixed(3)}</div>
          <div className="text-slate-500">θ={hovered.thetaDeg.toFixed(1)}° | β₁={hovered.beta1.toFixed(3)}, β₂={hovered.beta2.toFixed(3)}</div>
        </div>
      )}
    </div>
  );
}

function PermutationResultCard({ ds }: { ds: DatasetResult }) {
  const sig = ds.allPermutationP < 0.05;
  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          {sig ? <CheckCircle2 className="h-4 w-4 text-green-400" /> : <XCircle className="h-4 w-4 text-red-400" />}
          Angular Separation: {ds.label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <div className="text-cyan-400 font-semibold">Crypt mean θ</div>
            <div className="text-slate-900 text-lg">{ds.allCryptMeanTheta.toFixed(1)}°</div>
          </div>
          <div>
            <div className="text-pink-400 font-semibold">Villus mean θ</div>
            <div className="text-slate-900 text-lg">{ds.allVillusMeanTheta.toFixed(1)}°</div>
          </div>
        </div>
        <div className="bg-slate-50 rounded p-2 text-xs">
          <div>Separation: <span className="font-mono text-slate-900">{ds.allSeparationDeg.toFixed(1)}°</span></div>
          <div>Permutation p: <span className={`font-mono ${sig ? 'text-green-400' : 'text-red-400'}`}>{ds.allPermutationP.toFixed(4)}</span></div>
          <div className="text-slate-500 mt-1">{sig ? 'Significant angular separation detected' : 'No significant angular separation (p > 0.05)'}</div>
        </div>
        {ds.complexSeparationDeg !== null && (
          <div className="bg-slate-50 rounded p-2 text-xs">
            <div className="text-slate-500 mb-1">Complex roots only:</div>
            <div>Separation: <span className="font-mono text-slate-900">{ds.complexSeparationDeg.toFixed(1)}°</span></div>
            <div>p: <span className="font-mono">{ds.complexPermutationP?.toFixed(4)}</span></div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function GeneTable({ genes }: { genes: CryptVillusGene[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs" data-testid="gene-results-table">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="text-left p-1">Gene</th>
            <th className="text-left p-1">Type</th>
            <th className="text-right p-1">|λ|</th>
            <th className="text-right p-1">θ°</th>
            <th className="text-right p-1">β₁</th>
            <th className="text-right p-1">β₂</th>
            <th className="text-right p-1">R²</th>
            <th className="text-center p-1">Osc</th>
          </tr>
        </thead>
        <tbody>
          {genes.map((g, i) => (
            <tr key={i} className="border-b border-slate-200 hover:bg-slate-50">
              <td className="p-1 font-mono text-slate-900">{g.symbol}</td>
              <td className="p-1"><Badge variant="outline" className={g.category === 'crypt' ? 'border-cyan-500 text-cyan-400' : 'border-pink-500 text-pink-400'}>{g.category}</Badge></td>
              <td className="p-1 text-right font-mono">{g.eigenvalue.toFixed(3)}</td>
              <td className="p-1 text-right font-mono">{g.thetaDeg.toFixed(1)}</td>
              <td className="p-1 text-right font-mono text-slate-500">{g.beta1.toFixed(3)}</td>
              <td className="p-1 text-right font-mono text-slate-500">{g.beta2.toFixed(3)}</td>
              <td className="p-1 text-right font-mono text-slate-500">{g.r2.toFixed(3)}</td>
              <td className="p-1 text-center">{g.isComplex ? '~' : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ThetaHistogram({ bins, phyllotaxisAngle }: { bins: { center: number; count: number }[]; phyllotaxisAngle: number }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={bins} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis dataKey="center" tick={{ fill: '#64748b', fontSize: 10 }} label={{ value: 'θ (degrees)', position: 'insideBottom', offset: -3, fill: '#64748b', fontSize: 10 }} />
        <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
        <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #475569', fontSize: 11 }} />
        <ReferenceLine x={phyllotaxisAngle} stroke="#eab308" strokeDasharray="5 3" label={{ value: '137.5°', fill: '#eab308', fontSize: 10, position: 'top' }} />
        <Bar dataKey="count" fill="#3b82f6" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function PerturbationTest({ data }: { data: SpatialTemporalResult['test1'] }) {
  const barData = data.genotypes.map(g => ({
    name: g.label.replace(/ \(.*\)/, ''),
    clockEig: +g.meanClock.toFixed(4),
    targetEig: +g.meanTarget.toFixed(4),
    gap: +g.gap.toFixed(4),
    hierPct: g.hierarchyPct,
    oscPct: g.oscPct,
  }));

  const gapColor = (gap: number) => gap > 0 ? '#22c55e' : '#ef4444';

  return (
    <div className="space-y-6">
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Beaker className="h-4 w-4 text-purple-400" />
            Eigenvalue Summary by Genotype
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs" data-testid="genotype-table">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="text-left p-2">Genotype</th>
                  <th className="text-center p-2">Spatial</th>
                  <th className="text-center p-2">Temporal</th>
                  <th className="text-right p-2">Clock |λ|</th>
                  <th className="text-right p-2">Target |λ|</th>
                  <th className="text-right p-2">Gap</th>
                  <th className="text-right p-2">Hierarchy %</th>
                  <th className="text-right p-2">Osc %</th>
                  <th className="text-right p-2"># Genes</th>
                </tr>
              </thead>
              <tbody>
                {data.genotypes.map((g, i) => (
                  <tr key={i} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="p-2 font-semibold text-slate-900">{g.label}</td>
                    <td className="p-2 text-center">
                      <Badge variant="outline" className={g.spatial === 'intact' ? 'border-green-500 text-green-400' : 'border-red-500 text-red-400'}>
                        {g.spatial}
                      </Badge>
                    </td>
                    <td className="p-2 text-center">
                      <Badge variant="outline" className={g.temporal === 'intact' ? 'border-green-500 text-green-400' : 'border-red-500 text-red-400'}>
                        {g.temporal}
                      </Badge>
                    </td>
                    <td className="p-2 text-right font-mono text-blue-400">{g.meanClock.toFixed(4)}</td>
                    <td className="p-2 text-right font-mono text-amber-400">{g.meanTarget.toFixed(4)}</td>
                    <td className="p-2 text-right font-mono" style={{ color: gapColor(g.gap) }}>{g.gap > 0 ? '+' : ''}{g.gap.toFixed(4)}</td>
                    <td className="p-2 text-right font-mono">{g.hierarchyPct}%</td>
                    <td className="p-2 text-right font-mono text-slate-500">{g.oscPct}%</td>
                    <td className="p-2 text-right font-mono text-slate-500">{g.totalGenes.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ResponsiveContainer width="100%" height={250} className="mt-4">
            <BarChart data={barData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} domain={[0, 0.9]} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #475569', fontSize: 11 }} />
              <Bar dataKey="clockEig" name="Clock |λ|" fill="#60a5fa" radius={[3, 3, 0, 0]} />
              <Bar dataKey="targetEig" name="Target |λ|" fill="#fbbf24" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-sm">Perturbation Effects vs WT</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.perturbations.map((p, i) => (
              <div key={i} className="bg-slate-50 rounded p-3 text-xs space-y-1">
                <div className="font-semibold text-slate-900">{p.label}</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>All genes shift: <span className="font-mono text-slate-900">{p.allGeneShift >= 0 ? '+' : ''}{p.allGeneShift.toFixed(4)}</span></div>
                  <div>Effect size d: <span className="font-mono text-slate-900">{p.effectSize.toFixed(3)}</span></div>
                  <div>p-value: <span className={`font-mono ${p.pValue < 0.05 ? 'text-green-400' : 'text-slate-500'}`}>{p.pValue.toExponential(2)}</span></div>
                  <div>Clock shift: <span className="font-mono text-slate-900">{p.clockShift >= 0 ? '+' : ''}{p.clockShift.toFixed(4)}</span></div>
                </div>
                <div className="flex gap-4 mt-1">
                  <div>Gap: <span className="font-mono" style={{ color: gapColor(p.wtGap) }}>{p.wtGap.toFixed(4)}</span> → <span className="font-mono" style={{ color: gapColor(p.newGap) }}>{p.newGap.toFixed(4)}</span></div>
                  <div>Osc: {p.wtOscPct}% → {p.newOscPct}%</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-sm">Interaction Analysis (Double KO)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="bg-slate-50 rounded p-3 space-y-2">
              <div className="text-slate-500 font-semibold uppercase text-[10px] tracking-wider">Mean |λ| Interaction</div>
              <div>ApcKO effect: <span className="font-mono text-slate-900">{data.interaction.apcEffect >= 0 ? '+' : ''}{data.interaction.apcEffect.toFixed(4)}</span></div>
              <div>BmalKO effect: <span className="font-mono text-slate-900">{data.interaction.bmalEffect >= 0 ? '+' : ''}{data.interaction.bmalEffect.toFixed(4)}</span></div>
              <div>Expected additive: <span className="font-mono text-slate-900">{data.interaction.expectedAdditive.toFixed(4)}</span></div>
              <div>Observed double KO: <span className="font-mono text-slate-900">{data.interaction.observedDouble.toFixed(4)}</span></div>
              <div>Interaction: <span className="font-mono text-slate-900">{data.interaction.interactionTerm >= 0 ? '+' : ''}{data.interaction.interactionTerm.toFixed(4)}</span></div>
              <Badge variant="outline" className={data.interaction.interpretation === 'SYNERGISTIC' ? 'border-red-500 text-red-400' : data.interaction.interpretation === 'ANTAGONISTIC' ? 'border-amber-500 text-amber-400' : 'border-slate-300'}>
                {data.interaction.interpretation}
              </Badge>
            </div>
            <div className="bg-slate-50 rounded p-3 space-y-2">
              <div className="text-slate-500 font-semibold uppercase text-[10px] tracking-wider">Clock-Target Gap Interaction</div>
              <div>ApcKO gap effect: <span className="font-mono text-slate-900">{data.interaction.gapApcEffect >= 0 ? '+' : ''}{data.interaction.gapApcEffect.toFixed(4)}</span></div>
              <div>BmalKO gap effect: <span className="font-mono text-slate-900">{data.interaction.gapBmalEffect >= 0 ? '+' : ''}{data.interaction.gapBmalEffect.toFixed(4)}</span></div>
              <div>Expected: <span className="font-mono text-slate-900">{data.interaction.gapExpected.toFixed(4)}</span></div>
              <div>Observed: <span className="font-mono text-slate-900">{data.interaction.gapObserved.toFixed(4)}</span></div>
              <div>Interaction: <span className="font-mono text-slate-900">{data.interaction.gapInteraction >= 0 ? '+' : ''}{data.interaction.gapInteraction.toFixed(4)}</span></div>
              <Badge variant="outline" className={data.interaction.gapInterpretation === 'SYNERGISTIC' ? 'border-red-500 text-red-400' : data.interaction.gapInterpretation === 'ANTAGONISTIC' ? 'border-amber-500 text-amber-400' : 'border-slate-300'}>
                {data.interaction.gapInterpretation}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <InsightCallout title="Test 1 Interpretation">
        Both ApcKO (spatial disruption) and BmalKO (temporal disruption) independently collapse the clock {'>'} target hierarchy, inverting the gap from positive to negative.
        The double KO shows an <strong>antagonistic</strong> interaction on mean eigenvalue (less than additive) but a <strong>synergistic</strong> interaction on gap recovery — disrupting both axes partially restores the hierarchy.
        This suggests spatial and temporal programs are not independent: they interact in how they regulate the eigenvalue structure.
        The strikingly different oscillatory fractions (ApcKO drops to {data.genotypes[1]?.oscPct}% while BmalKO rises to {data.genotypes[2]?.oscPct}%) reveal that spatial disruption suppresses oscillation while temporal disruption amplifies it.
      </InsightCallout>
    </div>
  );
}

function TissueTest({ data }: { data: SpatialTemporalResult['test2'] }) {
  const barData = data.tissues.map(t => ({
    name: t.label,
    gap: +t.gap.toFixed(4),
    complexity: t.spatialComplexity,
    fill: t.spatialComplexity === 'high' ? '#818cf8' : t.spatialComplexity === 'medium' ? '#fbbf24' : '#34d399',
  }));

  return (
    <div className="space-y-6">
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4 text-indigo-400" />
            12-Tissue Hierarchy Ranked by Clock-Target Gap
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs" data-testid="tissue-table">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="text-left p-2">Tissue</th>
                  <th className="text-center p-2">Spatial</th>
                  <th className="text-right p-2">Clock |λ|</th>
                  <th className="text-right p-2">Target |λ|</th>
                  <th className="text-right p-2">Gap</th>
                  <th className="text-right p-2">Hier%</th>
                  <th className="text-right p-2">p-value</th>
                  <th className="text-right p-2">Osc%</th>
                </tr>
              </thead>
              <tbody>
                {data.tissues.map((t, i) => (
                  <tr key={i} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="p-2 font-semibold text-slate-900">{t.label}</td>
                    <td className="p-2 text-center">
                      <Badge variant="outline" className={t.spatialComplexity === 'high' ? 'border-indigo-500 text-indigo-400' : t.spatialComplexity === 'medium' ? 'border-amber-500 text-amber-400' : 'border-emerald-500 text-emerald-400'}>
                        {t.spatialComplexity}
                      </Badge>
                    </td>
                    <td className="p-2 text-right font-mono text-blue-400">{t.meanClock.toFixed(4)}</td>
                    <td className="p-2 text-right font-mono text-amber-400">{t.meanTarget.toFixed(4)}</td>
                    <td className="p-2 text-right font-mono text-green-400">+{t.gap.toFixed(4)}</td>
                    <td className="p-2 text-right font-mono">{t.hierarchyPct}%</td>
                    <td className="p-2 text-right font-mono">
                      <span className={t.significant ? 'text-green-400' : 'text-slate-500'}>{t.pValue.toExponential(2)}{t.significant ? ' *' : ''}</span>
                    </td>
                    <td className="p-2 text-right font-mono text-slate-500">{t.oscPct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ResponsiveContainer width="100%" height={250} className="mt-4">
            <BarChart data={barData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 9 }} angle={-30} textAnchor="end" height={60} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} label={{ value: 'Gap (Clock - Target)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #475569', fontSize: 11 }} formatter={(v: number) => v.toFixed(4)} />
              <Bar dataKey="gap" radius={[3, 3, 0, 0]}>
                {barData.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-sm">Spatial Complexity Correlation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="space-y-2">
              <div className="flex justify-between"><span>Gap vs Complexity:</span><span className="font-mono text-slate-900">r = {data.correlation.gapVsComplexity.toFixed(3)}</span></div>
              <div className="flex justify-between"><span>Oscillatory vs Complexity:</span><span className="font-mono text-slate-900">r = {data.correlation.oscVsComplexity.toFixed(3)}</span></div>
            </div>
            <div className="text-slate-500 mt-2">{data.correlation.interpretation}</div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-sm">Group Comparison</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Badge variant="outline" className="border-indigo-500 text-indigo-400">High (n={data.groups.high.n})</Badge>
                <span className="font-mono text-slate-900">{data.groups.high.mean.toFixed(4)} ± {data.groups.high.std.toFixed(4)}</span>
              </div>
              <div className="flex justify-between items-center">
                <Badge variant="outline" className="border-amber-500 text-amber-400">Medium (n={data.groups.medium.n})</Badge>
                <span className="font-mono text-slate-900">{data.groups.medium.mean.toFixed(4)} ± {data.groups.medium.std.toFixed(4)}</span>
              </div>
              <div className="flex justify-between items-center">
                <Badge variant="outline" className="border-emerald-500 text-emerald-400">Low (n={data.groups.low.n})</Badge>
                <span className="font-mono text-slate-900">{data.groups.low.mean.toFixed(4)} ± {data.groups.low.std.toFixed(4)}</span>
              </div>
              <div className="text-slate-500 mt-2">High vs Low p = {data.groups.highVsLowP.toFixed(4)}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <InsightCallout title="Test 2 Interpretation">
        The clock {'>'} target hierarchy is significant in <strong>{data.tissues.filter(t => t.significant).length} of {data.tissues.length}</strong> tissues — confirming it as a near-universal property.
        However, the hierarchy strength shows <strong>no correlation</strong> with spatial complexity (r = {data.correlation.gapVsComplexity.toFixed(3)}). Low-complexity tissues like white fat and brown fat show gaps as large as highly structured organs like kidney and lung.
        This strongly suggests the clock-target eigenvalue hierarchy is a <strong>cell-autonomous</strong> property — intrinsic to the gene regulatory network itself, not dependent on tissue architecture.
        The strong negative correlation between spatial complexity and oscillatory fraction (r = {data.correlation.oscVsComplexity.toFixed(3)}) is notable: complex tissues tend to have fewer oscillatory genes, possibly because spatial signaling dampens temporal oscillations.
      </InsightCallout>
    </div>
  );
}

function PerGeneTest({ data }: { data: SpatialTemporalResult['test3'] }) {
  return (
    <div className="space-y-6">
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Dna className="h-4 w-4 text-cyan-400" />
            Per-Gene Eigenvalue Correlations ({data.sharedGenes.toLocaleString()} shared genes)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Eigenvalue Level Correlations</div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between bg-slate-50 rounded p-2">
                  <span>WT |λ| vs ApcKO |λ|:</span>
                  <span className="font-mono text-slate-900">r = {data.eigenCorrelations.wtVsApc.toFixed(3)}</span>
                </div>
                <div className="flex justify-between bg-slate-50 rounded p-2">
                  <span>WT |λ| vs BmalKO |λ|:</span>
                  <span className="font-mono text-slate-900">r = {data.eigenCorrelations.wtVsBmal.toFixed(3)}</span>
                </div>
                <div className="flex justify-between bg-slate-50 rounded p-2">
                  <span>ApcKO |λ| vs BmalKO |λ|:</span>
                  <span className="font-mono text-slate-900">r = {data.eigenCorrelations.apcVsBmal.toFixed(3)}</span>
                </div>
              </div>
              <p className="text-xs text-slate-500">Near-zero correlations for eigenvalue levels indicate each genotype produces an essentially independent eigenvalue landscape — a gene's persistence in WT does not predict its persistence under disruption.</p>
            </div>

            <div className="space-y-3">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Shift Correlation (Δ|λ| from WT)</div>
              <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded p-4 text-center">
                <div className="text-3xl font-bold text-slate-900">{data.shiftCorrelation.r.toFixed(3)}</div>
                <div className="text-xs text-slate-500 mt-1">ApcKO shift vs BmalKO shift</div>
                <Badge variant="outline" className={Math.abs(data.shiftCorrelation.r) > 0.3 ? 'border-green-500 text-green-400 mt-2' : 'border-slate-300 mt-2'}>
                  {data.shiftCorrelation.interpretation}
                </Badge>
              </div>
              <p className="text-xs text-slate-500">Shift correlation (r = {data.shiftCorrelation.r.toFixed(3)}) shows <strong>{Math.abs(data.shiftCorrelation.r) > 0.3 ? 'meaningful' : 'weak'}</strong> coupling: genes that change eigenvalue under spatial disruption tend to {data.shiftCorrelation.r > 0 ? 'also change under temporal disruption in the same direction' : 'change oppositely under temporal disruption'}.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-sm">Dually-Affected Genes (|shift| {'>'} 0.05 in both conditions)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="text-center bg-slate-50 rounded p-3">
              <div className="text-2xl font-bold text-slate-900">{data.duallyAffected.total.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Total Affected</div>
            </div>
            <div className="text-center bg-slate-50 rounded p-3">
              <div className="text-2xl font-bold text-green-400">{data.duallyAffected.concordant.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Concordant ({data.duallyAffected.concordantPct}%)</div>
            </div>
            <div className="text-center bg-slate-50 rounded p-3">
              <div className="text-2xl font-bold text-red-400">{data.duallyAffected.discordant.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Discordant ({100 - data.duallyAffected.concordantPct}%)</div>
            </div>
            <div className="text-center bg-slate-50 rounded p-3">
              <div className="text-2xl font-bold text-blue-400">{data.sharedGenes.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Total Shared</div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs" data-testid="top-genes-table">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="text-left p-2">Gene</th>
                  <th className="text-left p-2">Category</th>
                  <th className="text-right p-2">ApcKO Δ|λ|</th>
                  <th className="text-right p-2">BmalKO Δ|λ|</th>
                  <th className="text-center p-2">Direction</th>
                </tr>
              </thead>
              <tbody>
                {data.topGenes.map((g, i) => (
                  <tr key={i} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="p-2 font-mono text-slate-900">{g.gene}</td>
                    <td className="p-2"><Badge variant="outline" className="text-slate-500">{g.category}</Badge></td>
                    <td className="p-2 text-right font-mono" style={{ color: g.apcShift > 0 ? '#22c55e' : '#ef4444' }}>{g.apcShift > 0 ? '+' : ''}{g.apcShift.toFixed(4)}</td>
                    <td className="p-2 text-right font-mono" style={{ color: g.bmalShift > 0 ? '#22c55e' : '#ef4444' }}>{g.bmalShift > 0 ? '+' : ''}{g.bmalShift.toFixed(4)}</td>
                    <td className="p-2 text-center">
                      <Badge variant="outline" className={g.direction === 'concordant' ? 'border-green-500 text-green-400' : 'border-red-500 text-red-400'}>
                        {g.direction}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-sm">Category Breakdown of Dually-Affected Genes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.categoryBreakdown.map((c, i) => {
              const concPct = c.total > 0 ? Math.round(c.concordant / c.total * 100) : 0;
              return (
                <div key={i} className="flex items-center gap-3 text-xs">
                  <span className="w-24 text-slate-500">{c.category}</span>
                  <div className="flex-1 h-4 bg-slate-100 rounded overflow-hidden flex">
                    <div className="bg-green-600 h-full" style={{ width: `${concPct}%` }} />
                    <div className="bg-red-600 h-full" style={{ width: `${100 - concPct}%` }} />
                  </div>
                  <span className="w-32 text-right font-mono text-slate-900">{c.concordant}/{c.total} ({concPct}%)</span>
                </div>
              );
            })}
          </div>
          <div className="flex gap-4 mt-3 text-xs text-slate-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-600 rounded inline-block" /> Concordant</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-600 rounded inline-block" /> Discordant</span>
          </div>
        </CardContent>
      </Card>

      <InsightCallout title="Test 3 Interpretation">
        Eigenvalue <em>levels</em> show near-zero correlation between conditions (r ≈ 0.01-0.05), meaning each genotype creates a fundamentally different eigenvalue landscape.
        But eigenvalue <em>shifts</em> from WT show moderate correlation (r = {data.shiftCorrelation.r.toFixed(3)}): genes that change persistence under spatial disruption (ApcKO) tend to also change under temporal disruption (BmalKO) in the same direction.
        Of {data.duallyAffected.total.toLocaleString()} dually-affected genes, <strong>{data.duallyAffected.concordantPct}% shift concordantly</strong> — both disruptions push the same genes in the same direction.
        Clock genes show {data.categoryBreakdown.find(c => c.category === 'clock')?.concordant}/{data.categoryBreakdown.find(c => c.category === 'clock')?.total} concordant, and target genes show {data.categoryBreakdown.find(c => c.category === 'target')?.concordant}/{data.categoryBreakdown.find(c => c.category === 'target')?.total} concordant — both categories respond in lockstep to spatial and temporal perturbation.
      </InsightCallout>
    </div>
  );
}

export default function CryptVillusPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('perturbation');
  const [selectedDataset, setSelectedDataset] = useState(0);

  const { data: angularData, isLoading: angularLoading } = useQuery<CryptVillusResult>({
    queryKey: ['/api/analysis/crypt-villus'],
  });

  const { data: couplingData, isLoading: couplingLoading } = useQuery<SpatialTemporalResult>({
    queryKey: ['/api/analysis/spatial-temporal-coupling'],
  });

  const isLoading = angularLoading || couplingLoading;

  const tabs: { id: ActiveTab; label: string; icon: any; description: string }[] = [
    { id: 'perturbation', label: 'Perturbation Coupling', icon: Beaker, description: 'ApcKO vs BmalKO eigenvalue interaction' },
    { id: 'tissue', label: 'Cross-Tissue Hierarchy', icon: Activity, description: '12 tissues vs spatial complexity' },
    { id: 'pergene', label: 'Per-Gene Correlation', icon: Dna, description: 'Gene-level shift concordance' },
    { id: 'angular', label: 'Angular Separation', icon: FlaskConical, description: 'Crypt-villus golden ratio test (negative)' },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto max-w-6xl px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/root-space">
            <Button variant="ghost" size="sm" data-testid="button-back"><ArrowLeft className="h-4 w-4 mr-1" /> Root-Space</Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold" data-testid="text-page-title">Spatial-Temporal Coupling Analysis</h1>
            <p className="text-xs text-muted-foreground">Testing how tissue architecture (spatial) connects to circadian dynamics (temporal) through AR(2) eigenvalues</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <p className="text-sm text-muted-foreground">Running spatial-temporal coupling analysis across datasets...</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {tabs.map(tab => (
                <Button
                  key={tab.id}
                  variant={activeTab === tab.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex flex-col items-start h-auto py-2 px-3 ${activeTab === tab.id ? 'bg-slate-200' : 'border-slate-300 hover:bg-slate-100'}`}
                  data-testid={`tab-${tab.id}`}
                >
                  <div className="flex items-center gap-1.5">
                    <tab.icon className="h-3.5 w-3.5" />
                    <span className="text-xs font-semibold">{tab.label}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-normal">{tab.description}</span>
                </Button>
              ))}
            </div>

            {activeTab === 'perturbation' && couplingData && <PerturbationTest data={couplingData.test1} />}
            {activeTab === 'tissue' && couplingData && <TissueTest data={couplingData.test2} />}
            {activeTab === 'pergene' && couplingData && <PerGeneTest data={couplingData.test3} />}

            {activeTab === 'angular' && angularData && (
              <div className="space-y-6">
                <Card className="border-red-900/50 bg-red-950/20">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <XCircle className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-semibold text-red-400">Negative Result: Golden-Ratio Angular Hypothesis Not Supported</div>
                        <p className="text-xs text-slate-500 mt-1">{angularData.verdictDetail}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex flex-wrap gap-2">
                  {angularData.datasets.map((d, i) => (
                    <Button
                      key={i}
                      variant={selectedDataset === i ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedDataset(i)}
                      className={selectedDataset === i ? "bg-slate-200" : "border-slate-300 hover:bg-slate-100"}
                      data-testid={`button-dataset-${i}`}
                    >
                      {d.label}
                    </Button>
                  ))}
                </div>

                {angularData.datasets[selectedDataset] && (
                  <>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <Card className="border-slate-200">
                        <CardHeader>
                          <CardTitle className="text-sm">Root-Space Position: {angularData.datasets[selectedDataset].label}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <RootSpaceScatter genes={angularData.datasets[selectedDataset].genes} phyllotaxisAngle={angularData.phyllotaxisAngleDeg} />
                        </CardContent>
                      </Card>
                      <PermutationResultCard ds={angularData.datasets[selectedDataset]} />
                    </div>

                    <Card className="border-slate-200">
                      <CardHeader>
                        <CardTitle className="text-sm">Per-Gene AR(2) Results: {angularData.datasets[selectedDataset].label}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <GeneTable genes={angularData.datasets[selectedDataset].genes} />
                      </CardContent>
                    </Card>
                  </>
                )}

                <Card className="border-slate-200">
                  <CardHeader>
                    <CardTitle className="text-sm">Genome-Wide Angular Distribution (WT Organoids)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                      <div className="text-center">
                        <div className="text-lg font-bold text-slate-900">{angularData.genomeWide.totalGenes.toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">Total Genes</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-blue-400">{angularData.genomeWide.complexGenes.toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">Oscillatory (complex)</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-amber-400">{angularData.genomeWide.near137Pct}%</div>
                        <div className="text-xs text-muted-foreground">Near 137.5°</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-slate-500">{angularData.genomeWide.uniformExpectation}%</div>
                        <div className="text-xs text-muted-foreground">Uniform Expectation</div>
                      </div>
                    </div>
                    <ThetaHistogram bins={angularData.genomeWide.thetaBins} phyllotaxisAngle={angularData.phyllotaxisAngleDeg} />
                    <p className="text-xs text-slate-500 mt-2">
                      The genome-wide distribution peaks at 70-90° and drops sharply beyond 120°. The phyllotaxis angle (137.5°) sits in the tail, showing ~6% of genes rather than ~19% expected under uniformity. The distribution is shaped by AR(2) stationarity constraints, not golden-ratio geometry.
                    </p>
                  </CardContent>
                </Card>

                <InsightCallout title="Why Negative Results Matter">
                  This analysis tested whether the Douady-Couder phyllotaxis angle (137.5°) connects to gene expression dynamics in intestinal tissue.
                  The answer is no — crypt and villus genes do not separate at golden-ratio angles in AR(2) root-space. This rules out a specific hypothesis
                  and clarifies that the earlier golden-ratio enrichment finding (at 222.5°) is likely a coordinate mapping artifact.
                  The real spatial-temporal connection lives in eigenvalue magnitudes (radial axis), not angular positions — see the other three test tabs.
                </InsightCallout>
              </div>
            )}

            <Card className="border-slate-200 bg-slate-50">
              <CardHeader>
                <CardTitle className="text-sm">Overall Synthesis</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-slate-500 space-y-3">
                <p>
                  <strong className="text-slate-900">The real spatial-temporal connection lives in eigenvalue magnitudes, not angles.</strong>{' '}
                  The golden-ratio angular hypothesis was tested and found not supported (Test 4). But three lines of evidence reveal genuine coupling through the radial axis:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-white rounded p-3">
                    <div className="font-semibold text-purple-400 mb-1">Test 1: Perturbation</div>
                    <p>Both spatial (ApcKO) and temporal (BmalKO) disruptions collapse the clock {'>'} target hierarchy. The double KO shows <strong className="text-slate-900">non-additive interaction</strong> — proving spatial and temporal are not independent axes.</p>
                  </div>
                  <div className="bg-white rounded p-3">
                    <div className="font-semibold text-indigo-400 mb-1">Test 2: Cross-Tissue</div>
                    <p>The hierarchy is universal across 12 tissues but its strength <strong className="text-slate-900">does not depend on spatial complexity</strong> (r = {couplingData?.test2.correlation.gapVsComplexity.toFixed(3)}). The hierarchy is cell-autonomous, not tissue-architecture-dependent.</p>
                  </div>
                  <div className="bg-white rounded p-3">
                    <div className="font-semibold text-cyan-400 mb-1">Test 3: Per-Gene</div>
                    <p>Eigenvalue <em>shifts</em> correlate moderately (r = {couplingData?.test3.shiftCorrelation.r.toFixed(3)}) between conditions, with <strong className="text-slate-900">{couplingData?.test3.duallyAffected.concordantPct}% concordant</strong> — both disruptions push the same genes in the same direction.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
