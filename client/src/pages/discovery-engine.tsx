import { useState, useRef, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, Cell, ScatterChart, Scatter, ZAxis, ReferenceLine, ReferenceArea
} from "recharts";
import {
  Upload, FileUp, Activity, Loader2, AlertCircle, CheckCircle2,
  ArrowLeft, Download, Info, TrendingUp, Zap, Clock, Target,
  BarChart3, X, ShieldCheck, ShieldAlert, ChevronDown, ChevronUp,
  Share2, Copy, Check, FolderOpen, Save, Play, Globe
} from "lucide-react";
import { Link } from "wouter";
import HowTo from "@/components/HowTo";
import ExportReport from "@/components/ExportReport";
import { Term } from "@/components/Glossary";
import GeneTooltip from "@/components/GeneTooltip";

interface QualityCheck {
  name: string;
  passed: boolean;
  value: string;
  explanation: string;
  severity: 'info' | 'warning' | 'critical';
}

interface EdgeCaseDiagnostic {
  id: string;
  label: string;
  triggered: boolean;
  severity: 'info' | 'warning' | 'critical';
  detail: string;
}

interface ChannelResult {
  channel: string;
  unit: string;
  sampleCount: number;
  phi1: number;
  phi2: number;
  eigenvalue: number;
  r2: number;
  isComplex: boolean;
  lambda1Real: number;
  lambda1Imag: number;
  lambda2Real: number;
  lambda2Imag: number;
  halfLife: number | null;
  impliedPeriod: number | null;
  mean: number;
  std: number;
  min: number;
  max: number;
  stability: string;
  stabilityColor: string;
  ljungBoxPassed: boolean;
  ljungBoxPValue: number;
  timeSeriesPreview: number[];
  residuals: number[];
  acf: number[];
  qualityChecks?: QualityCheck[];
  edgeCaseDiagnostics?: EdgeCaseDiagnostic[];
  overallConfidence?: 'High' | 'Moderate' | 'Low' | 'Unreliable';
  confidenceColor?: string;
  confidenceScore?: number;
}

interface GearboxAnalysis {
  clockChannel: string;
  clockEigenvalue: number;
  targetChannel: string;
  targetEigenvalue: number;
  gap: number;
  gapUncertainty?: number;
  gapReliable?: boolean;
  hierarchyStatus: string;
  hierarchyColor: string;
}

interface PerGeneAnalysis {
  totalGenes: number;
  clockGenesFound: number;
  targetGenesAnalyzed: number;
  timepointCount: number;
  timepoints: number[];
  clockMeanEigenvalue: number;
  targetMeanEigenvalue: number;
  topByEigenvalue: { gene: string; eigenvalue: number; geneType: string; stability: string }[];
  bottomByEigenvalue: { gene: string; eigenvalue: number; geneType: string; stability: string }[];
}

interface DataDomainClassification {
  domain: 'biological' | 'wearable' | 'non-biological' | 'unknown';
  confidence: number;
  signals: string[];
  warning: string | null;
}

interface BiasAuditTest {
  testName: string;
  description: string;
  passed: boolean;
  verdict: string;
  details: Record<string, any>;
}

interface BiasAudit {
  summary: string;
  overallVerdict: string;
  overallColor: string;
  tests: BiasAuditTest[];
}

interface AnalysisResponse {
  detectedFormat: string;
  fileName: string;
  fileSize: number;
  totalRecords: number;
  channelsAnalyzed: number;
  results: ChannelResult[];
  gearboxAnalysis: GearboxAnalysis | null;
  dataDomain?: DataDomainClassification;
  skippedChannels?: string[];
  perGeneAnalysis?: PerGeneAnalysis;
  biasAudit?: BiasAudit | null;
  dataWarnings?: { type: string; message: string; severity: 'info' | 'warning' | 'error'; genes?: string[] }[];
  parsingValidation?: {
    formatDetected: string;
    formatConfidence: string;
    columnsFound: number;
    rowsRead: number;
    channelsExtracted: number;
    channelsAnalyzed: number;
    channelsSkipped: number;
    checks: { test: string; passed: boolean; detail: string }[];
    summary: string;
    dataReliable: boolean;
  };
  safeguards?: {
    disclaimer: string;
    contextWarning: string;
    minimumTimepoints: number;
    lowPowerChannels: string[];
    negativeResult: boolean;
  };
  metadata: {
    engine: string;
    algorithm: string;
    equation: string;
    eigenvalueEquation: string;
    reference: string;
    timestamp: string;
  };
}

function StabilityRing({ eigenvalue, size = 180, label }: { eigenvalue: number; size?: number; label?: string }) {
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(eigenvalue, 1.2) / 1.2;
  const strokeDashoffset = circumference * (1 - progress);

  let color = '#22c55e';
  if (eigenvalue >= 0.95) color = '#dc2626';
  else if (eigenvalue >= 0.85) color = '#f97316';
  else if (eigenvalue >= 0.7) color = '#facc15';
  else if (eigenvalue >= 0.5) color = '#4ade80';

  const bgColor = `${color}20`;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={bgColor}
          strokeWidth="8"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 1s ease-in-out, stroke 0.5s ease' }}
        />
        <text x={size / 2} y={size / 2 - 8} textAnchor="middle" fill={color} fontSize="28" fontWeight="bold">
          {eigenvalue.toFixed(3)}
        </text>
        <text x={size / 2} y={size / 2 + 14} textAnchor="middle" fill="#94a3b8" fontSize="11">
          persistence score
        </text>
      </svg>
      {label && <span className="text-xs text-slate-500 font-medium">{label}</span>}
    </div>
  );
}

function UnitCirclePlot({ results }: { results: ChannelResult[] }) {
  const size = 380;
  const cx = size / 2;
  const cy = size / 2;
  const plotRadius = size / 2 - 40;

  const eigenPoints = results.flatMap(r => {
    const pts = [];
    pts.push({
      channel: r.channel,
      real: r.lambda1Real,
      imag: r.lambda1Imag,
      modulus: Math.sqrt(r.lambda1Real ** 2 + r.lambda1Imag ** 2),
      color: r.stabilityColor,
      label: r.isComplex ? `λ₁` : `λ₁`,
    });
    if (r.isComplex || Math.abs(r.lambda1Real - r.lambda2Real) > 0.001 || Math.abs(r.lambda1Imag - r.lambda2Imag) > 0.001) {
      pts.push({
        channel: r.channel,
        real: r.lambda2Real,
        imag: r.lambda2Imag,
        modulus: Math.sqrt(r.lambda2Real ** 2 + r.lambda2Imag ** 2),
        color: r.stabilityColor,
        label: `λ₂`,
      });
    }
    return pts;
  });

  const maxExtent = Math.max(1.15, ...eigenPoints.map(p => Math.max(Math.abs(p.real), Math.abs(p.imag))) ) * 1.1;
  const scale = plotRadius / maxExtent;

  const toX = (real: number) => cx + real * scale;
  const toY = (imag: number) => cy - imag * scale;

  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <Card className="bg-gradient-to-r from-slate-900 to-slate-900/80 border-slate-200">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Activity size={18} className="text-purple-400" />
          Unit Circle Plot
        </CardTitle>
        <CardDescription className="text-slate-500">
          Eigenvalues plotted in the complex plane. Points inside the unit circle are stable (decaying signal), on the boundary are critical, and outside are divergent. Complex conjugate pairs indicate oscillatory dynamics.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible" data-testid="unit-circle-plot">
            <defs>
              <radialGradient id="uc-stable-zone" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#22c55e" stopOpacity="0.06" />
                <stop offset="70%" stopColor="#22c55e" stopOpacity="0.03" />
                <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
              </radialGradient>
            </defs>

            <circle cx={cx} cy={cy} r={1.0 * scale} fill="url(#uc-stable-zone)" stroke="#22c55e" strokeWidth="1.5" strokeDasharray="6 3" opacity="0.6" />

            <line x1={cx - plotRadius - 5} y1={cy} x2={cx + plotRadius + 5} y2={cy} stroke="#334155" strokeWidth="1" />
            <line x1={cx} y1={cy - plotRadius - 5} x2={cx} y2={cy + plotRadius + 5} stroke="#334155" strokeWidth="1" />

            {[-0.5, 0.5, -1, 1].filter(v => Math.abs(v) * scale <= plotRadius).map(v => (
              <g key={`tick-r-${v}`}>
                <line x1={toX(v)} y1={cy - 3} x2={toX(v)} y2={cy + 3} stroke="#475569" strokeWidth="1" />
                <text x={toX(v)} y={cy + 14} textAnchor="middle" fill="#64748b" fontSize="9">{v}</text>
              </g>
            ))}
            {[-0.5, 0.5, -1, 1].filter(v => Math.abs(v) * scale <= plotRadius).map(v => (
              <g key={`tick-i-${v}`}>
                <line x1={cx - 3} y1={toY(v)} x2={cx + 3} y2={toY(v)} stroke="#475569" strokeWidth="1" />
                <text x={cx - 10} y={toY(v) + 3} textAnchor="end" fill="#64748b" fontSize="9">{v}i</text>
              </g>
            ))}

            <text x={cx + plotRadius + 8} y={cy + 4} fill="#64748b" fontSize="10" textAnchor="start">Re</text>
            <text x={cx + 4} y={cy - plotRadius - 8} fill="#64748b" fontSize="10" textAnchor="start">Im</text>

            {[0.25, 0.5, 0.75].filter(r => r * scale <= plotRadius).map(r => (
              <circle key={`grid-${r}`} cx={cx} cy={cy} r={r * scale} fill="none" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="3 4" />
            ))}

            {eigenPoints.map((pt, i) => {
              const px = toX(pt.real);
              const py = toY(pt.imag);
              const isHov = hovered === i;
              return (
                <g key={i}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                  style={{ cursor: 'pointer' }}
                >
                  {isHov && <circle cx={px} cy={py} r={12} fill={pt.color} opacity="0.15" />}
                  <circle
                    cx={px} cy={py}
                    r={isHov ? 7 : 5}
                    fill={pt.color}
                    stroke="#0f172a"
                    strokeWidth="1.5"
                    opacity={hovered !== null && !isHov ? 0.4 : 1}
                    style={{ transition: 'r 0.15s, opacity 0.15s' }}
                  />
                  {isHov && (
                    <g>
                      <rect x={px + 10} y={py - 32} width={Math.max(120, pt.channel.length * 7 + 20)} height={42} rx="4" fill="#1e293b" stroke="#334155" strokeWidth="1" />
                      <text x={px + 16} y={py - 18} fill="#e2e8f0" fontSize="11" fontWeight="600">{pt.channel}</text>
                      <text x={px + 16} y={py - 4} fill="#94a3b8" fontSize="10">
                        {pt.real.toFixed(3)}{pt.imag >= 0 ? ' + ' : ' − '}{Math.abs(pt.imag).toFixed(3)}i
                      </text>
                      <text x={px + 16} y={py + 8} fill="#94a3b8" fontSize="9">|λ| = {pt.modulus.toFixed(4)}</text>
                    </g>
                  )}
                </g>
              );
            })}

            <text x={cx + 1.0 * scale + 4} y={cy - 6} fill="#22c55e" fontSize="9" opacity="0.7">|λ|=1</text>
          </svg>
        </div>

        <div className="mt-4 flex flex-wrap gap-3 justify-center">
          {results.map((r, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs text-slate-500">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: r.stabilityColor }} />
              <span>{r.channel}</span>
              <span className="text-slate-500 font-mono">|λ|={r.eigenvalue.toFixed(3)}</span>
              {r.halfLife != null && <span className="text-emerald-500 font-mono">t½={r.halfLife.toFixed(1)}</span>}
            </div>
          ))}
        </div>

        <p className="text-[11px] text-slate-500 mt-3 text-center">
          Dashed green circle = unit circle boundary (|λ| = 1). Points inside: stable, decaying dynamics. Complex conjugate pairs appear mirrored across the real axis.
        </p>
      </CardContent>
    </Card>
  );
}

function StateSpacePlot({ results }: { results: ChannelResult[] }) {
  const data = results.map(r => ({
    name: r.channel,
    phi1: r.phi1,
    phi2: r.phi2,
    eigenvalue: r.eigenvalue,
    stability: r.stability,
    color: r.stabilityColor,
    size: 200
  }));

  const stationarityBottom = Array.from({ length: 41 }, (_, i) => {
    const b1 = -2 + i * 0.1;
    return { x: b1, y: -1 };
  });
  const stationarityRight = Array.from({ length: 21 }, (_, i) => {
    const b1 = -2 + i * 0.2;
    return { x: b1, y: 1 - b1 };
  });
  const stationarityLeft = Array.from({ length: 21 }, (_, i) => {
    const b1 = -2 + i * 0.2;
    return { x: b1, y: 1 + b1 };
  });
  const oscillatoryParabola = Array.from({ length: 41 }, (_, i) => {
    const b1 = -2 + i * 0.1;
    return { x: b1, y: -(b1 * b1) / 4 };
  });

  return (
    <ResponsiveContainer width="100%" height={340} minWidth={1} minHeight={1}>
      <ScatterChart margin={{ top: 20, right: 20, bottom: 30, left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis type="number" dataKey="x" name="β₁" domain={[-2.2, 2.2]}
          tick={{ fill: '#64748b', fontSize: 11 }} label={{ value: 'β₁ (phi1)', position: 'bottom', fill: '#64748b', fontSize: 11, offset: 15 }} />
        <YAxis type="number" dataKey="y" name="β₂" domain={[-1.3, 1.2]}
          tick={{ fill: '#64748b', fontSize: 11 }} label={{ value: 'β₂ (phi2)', angle: -90, position: 'left', fill: '#64748b', fontSize: 11 }} />
        <ZAxis type="number" dataKey="size" range={[200, 200]} />

        <Scatter data={stationarityBottom} fill="none" line={{ stroke: '#475569', strokeWidth: 1.5, strokeDasharray: '6 3' }} shape={() => <circle r={0} />} legendType="none" />
        <Scatter data={stationarityRight} fill="none" line={{ stroke: '#475569', strokeWidth: 1.5, strokeDasharray: '6 3' }} shape={() => <circle r={0} />} legendType="none" />
        <Scatter data={stationarityLeft} fill="none" line={{ stroke: '#475569', strokeWidth: 1.5, strokeDasharray: '6 3' }} shape={() => <circle r={0} />} legendType="none" />
        <Scatter data={oscillatoryParabola} fill="none" line={{ stroke: '#eab308', strokeWidth: 1.5, strokeDasharray: '4 2' }} shape={() => <circle r={0} />} legendType="none" />

        <ReferenceLine y={0} stroke="#47556950" strokeDasharray="3 3" />
        <ReferenceLine x={0} stroke="#47556950" strokeDasharray="3 3" />
        <Tooltip content={({ payload }) => {
          if (!payload || !payload.length) return null;
          const d = payload[0].payload;
          if (!d.name) return null;
          return (
            <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs">
              <div className="font-bold text-slate-900 mb-1">{d.name}</div>
              <div className="text-slate-600">β₁ = {d.x?.toFixed(4)}</div>
              <div className="text-slate-600">β₂ = {d.y?.toFixed(4)}</div>
              <div style={{ color: d.color }}>|λ| = {d.eigenvalue?.toFixed(4)}</div>
              <div style={{ color: d.color }}>{d.stability}</div>
            </div>
          );
        }} />
        <Scatter data={data.map(d => ({ ...d, x: d.phi1, y: d.phi2 }))} fill="#22d3ee">
          {data.map((entry, index) => (
            <Cell key={index} fill={entry.color} stroke={entry.color} strokeWidth={2} />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}

const FORMAT_INFO: Record<string, { label: string; description: string; example: string }> = {
  generic: {
    label: 'Generic CSV',
    description: 'Any CSV with numeric time-series columns — gene expression, lab measurements, or custom data',
    example: 'time,Gene_A,Gene_B\n0,10.5,20.3\n4,11.2,19.8\n8,9.8,21.1'
  },
  gene_expression: {
    label: 'Gene Expression',
    description: 'Time-course expression data with genes as columns and timepoints as rows',
    example: 'timepoint,Bmal1,Per2,Cry1\n0,8.2,3.1,5.4\n4,6.7,7.8,4.2\n8,4.1,9.5,3.8'
  },
  dexcom: {
    label: 'Dexcom CGM',
    description: 'Continuous Glucose Monitor data export',
    example: 'Timestamp,Glucose Value (mg/dL)\n2025-01-01 00:00,95\n2025-01-01 00:05,97'
  },
  oura: {
    label: 'Oura Ring',
    description: 'Sleep/readiness data with HRV and temperature',
    example: 'date,hrv,temperature_deviation\n2025-01-01,45,0.2\n2025-01-02,42,-0.1'
  },
  gene_expression_matrix: {
    label: 'Gene Expression Matrix',
    description: 'Circadian time-course data — genes as rows, time points as columns. Per-gene AR(2) eigenvalue analysis.',
    example: 'Gene,CT18,CT20,CT22,CT24,CT26,CT28\nPer2,8.2,9.1,7.3,5.4,4.2,6.8\nBmal1,5.1,4.2,3.8,6.7,8.2,7.1'
  },
  heartrate: {
    label: 'Heart Rate',
    description: 'Any device with heart rate time series',
    example: 'timestamp,heart_rate\n2025-01-01 00:00,72\n2025-01-01 00:05,74'
  }
};

const TISSUE_BASELINES: Record<string, { label: string; clockMean: number; targetMean: number; gap: number; description: string }> = {
  generic:         { label: 'Generic (no tissue prior)', clockMean: 0.670, targetMean: 0.540, gap: 0.130, description: 'Cross-tissue average across 22 datasets' },
  liver_mouse:     { label: 'Mouse Liver',               clockMean: 0.720, targetMean: 0.574, gap: 0.146, description: 'GSE54650 / GSE11923 — canonical circadian atlas' },
  heart_mouse:     { label: 'Mouse Heart',               clockMean: 0.694, targetMean: 0.558, gap: 0.136, description: 'GSE54650 — cardiac tissue' },
  intestine_mouse: { label: 'Mouse Intestine / Colon',   clockMean: 0.683, targetMean: 0.549, gap: 0.134, description: 'GSE54650 + GSE157357 organoids' },
  cerebellum_mouse:{ label: 'Mouse Cerebellum',          clockMean: 0.671, targetMean: 0.547, gap: 0.124, description: 'GSE54650 — cerebellar tissue' },
  blood_human:     { label: 'Human Blood',               clockMean: 0.647, targetMean: 0.527, gap: 0.120, description: 'GSE48113 — peripheral blood' },
  blood_mouse:     { label: 'Mouse Blood',               clockMean: 0.652, targetMean: 0.531, gap: 0.121, description: 'GSE54650 — circulating' },
  glial:           { label: 'Glial / Astrocyte',         clockMean: 0.631, targetMean: 0.513, gap: 0.118, description: 'Paper H — AD glial clock dataset' },
};

type FlagSeverity = 'normal' | 'warning' | 'critical' | 'info';
interface ClinicalFlag { severity: FlagSeverity; label: string; detail: string; metric: string; }

function computeClinicalFlags(result: AnalysisResponse, tissueKey: string): ClinicalFlag[] {
  const flags: ClinicalFlag[] = [];
  const pga = result.perGeneAnalysis;
  const baseline = TISSUE_BASELINES[tissueKey] ?? TISSUE_BASELINES['generic'];

  if (pga && pga.clockGenesFound > 0) {
    const gap = pga.clockMeanEigenvalue - pga.targetMeanEigenvalue;
    if (gap > baseline.gap * 0.5) {
      flags.push({ severity: 'normal', label: 'Normal Regulation', detail: `Circadian hierarchy preserved. Clock |λ| (${pga.clockMeanEigenvalue.toFixed(3)}) exceeds target |λ| (${pga.targetMeanEigenvalue.toFixed(3)}) — within expected range for ${baseline.label} (baseline gap ≈ ${baseline.gap.toFixed(3)}).`, metric: `Gap: +${gap.toFixed(3)}` });
    } else if (gap >= 0) {
      flags.push({ severity: 'warning', label: 'Hierarchy Degraded', detail: `Clock–target gap (${gap.toFixed(3)}) is reduced vs ${baseline.label} baseline (expected ≥ ${(baseline.gap * 0.5).toFixed(3)}). Hierarchy structurally present but weakened.`, metric: `Gap: +${gap.toFixed(3)} (reduced)` });
    } else if (gap > -0.05) {
      flags.push({ severity: 'critical', label: 'Hierarchy Inverted', detail: `Clock |λ| (${pga.clockMeanEigenvalue.toFixed(3)}) is BELOW target |λ| (${pga.targetMeanEigenvalue.toFixed(3)}). Expected clock-drives-target ordering has reversed. Pattern consistent with APC-KO-type WNT inversion.`, metric: `Gap: ${gap.toFixed(3)} (inverted)` });
    } else {
      flags.push({ severity: 'critical', label: 'Hierarchical Collapse', detail: `Clock hierarchy has substantially collapsed (gap = ${gap.toFixed(3)}). Consistent with BMAL1-KO profile (reference collapse gap ≈ −0.095). Consider loss-of-clock or constitutive activation pathology.`, metric: `Gap: ${gap.toFixed(3)} (collapsed)` });
    }
  } else if (pga && pga.clockGenesFound === 0) {
    flags.push({ severity: 'info', label: 'No Clock Genes Detected', detail: 'No core circadian clock genes (ARNTL/BMAL1, PER1/2, CRY1/2, etc.) were found in this dataset. Hierarchy assessment requires at least one recognised clock gene.', metric: 'N/A' });
  }

  const nearCritical = result.results.filter(r => r.eigenvalue >= 0.90);
  if (nearCritical.length > 0) {
    const names = nearCritical.slice(0, 3).map(r => `${r.channel} (${r.eigenvalue.toFixed(3)})`).join(', ');
    flags.push({ severity: 'warning', label: 'Near-Critical Persistence Detected', detail: `${nearCritical.length} channel(s) show |λ| ≥ 0.90, approaching constitutive activation boundary: ${names}${nearCritical.length > 3 ? ` + ${nearCritical.length - 3} more` : ''}.`, metric: `${nearCritical.length} near-critical` });
  }

  if (result.biasAudit) {
    const failed = result.biasAudit.tests.filter(t => !t.passed);
    if (failed.length > 0) {
      flags.push({ severity: 'warning', label: 'Bias Audit: Review Required', detail: `${failed.length} of ${result.biasAudit.tests.length} bias audit test(s) flagged: ${failed.map(t => t.testName).join(', ')}. Eigenvalue hierarchy may partly reflect non-biological structure.`, metric: `${failed.length}/${result.biasAudit.tests.length} failed` });
    } else {
      flags.push({ severity: 'normal', label: 'Bias Audit Passed', detail: `All ${result.biasAudit.tests.length} bias audit tests passed — eigenvalue hierarchy reflects genuine temporal structure.`, metric: `${result.biasAudit.tests.length}/${result.biasAudit.tests.length} passed` });
    }
  }

  const lowPower = result.results.filter(r => r.sampleCount < 10);
  if (lowPower.length > 0) {
    const minTp = result.safeguards?.minimumTimepoints ?? 6;
    flags.push({ severity: 'info', label: 'Low Statistical Power', detail: `${lowPower.length} channel(s) have < 10 timepoints (engine minimum: ${minTp}). Clinical reliability requires ≥ 10 sequential timepoints per channel for meaningful confidence intervals.`, metric: `${lowPower.length} low-power channels` });
  }

  return flags;
}

export default function DiscoveryEngine() {
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResponse | null>(() => {
    try {
      const stored = sessionStorage.getItem('par2_last_result');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadingDataset, setLoadingDataset] = useState<string | null>(null);
  const [fromSession, setFromSession] = useState(() => {
    try { return !!sessionStorage.getItem('par2_last_result'); } catch { return false; }
  });
  const [datasetsExpanded, setDatasetsExpanded] = useState(true);
  const [techDetailsExpanded, setTechDetailsExpanded] = useState(false);
  const [humanBatchId, setHumanBatchId] = useState<string | null>(null);
  const [humanBatchRunning, setHumanBatchRunning] = useState(false);
  const [humanBatchDone, setHumanBatchDone] = useState(false);
  const [humanBatchProgress, setHumanBatchProgress] = useState<{completed: number; total: number; current: string}>({ completed: 0, total: 3, current: '' });
  const [tissueType, setTissueType] = useState<string>('generic');
  const [controlFile, setControlFile] = useState<File | null>(null);
  const [controlResult, setControlResult] = useState<AnalysisResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // The Rosen et al. CSVs ship separately from the app, so only offer them
  // when the deployment actually has them.
  const [rosenAvailable, setRosenAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/sample-data/rosen2026', { method: 'HEAD' })
      .then((res) => {
        if (!cancelled) setRosenAvailable(res.ok);
      })
      .catch(() => {
        if (!cancelled) setRosenAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const controlFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (result) {
      try {
        sessionStorage.setItem('par2_last_result', JSON.stringify(result));
      } catch {}
    }
  }, [result]);

  const handleFile = useCallback((f: File) => {
    const name = f.name.toLowerCase();
    if (!name.endsWith('.csv') && !name.endsWith('.tsv') && !name.endsWith('.txt')) {
      setError(`Invalid file type: "${f.name}". Please upload a CSV, TSV, or TXT file.`);
      return;
    }
    if (f.size > 500 * 1024 * 1024) {
      setError('File too large (max 500 MB). Please use a smaller file.');
      return;
    }
    setFile(f);
    setError(null);
    setResult(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && (f.name.endsWith('.csv') || f.name.endsWith('.txt') || f.name.endsWith('.tsv'))) {
      handleFile(f);
    } else {
      setError("Please upload a CSV file");
    }
  }, [handleFile]);

  const runAnalysis = async () => {
    if (!file) return;
    setAnalyzing(true);
    setError(null);
    setControlResult(null);

    const analyzeOneFile = async (f: File): Promise<AnalysisResponse> => {
      try {
        const { analyzeCSVInBrowser } = await import('@/lib/par2-browser');
        return (await analyzeCSVInBrowser(f)) as any;
      } catch {
        const formData = new FormData();
        formData.append('file', f);
        formData.append('format', 'auto');
        const response = await fetch('/api/analyze/wearable', { method: 'POST', body: formData });
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'Analysis failed');
        }
        return response.json();
      }
    };

    try {
      const [patientData, controlData] = await Promise.all([
        analyzeOneFile(file),
        controlFile ? analyzeOneFile(controlFile) : Promise.resolve(null),
      ]);
      setResult(patientData);
      if (controlData) setControlResult(controlData);
      setFromSession(false);
    } catch (err: any) {
      setError(err.message || 'Failed to analyze file');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleShare = async () => {
    if (!result) return;
    setSharing(true);
    try {
      const res = await fetch('/api/shared-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysisData: result,
          fileName: result.fileName,
          detectedFormat: result.detectedFormat,
        }),
      });
      if (!res.ok) throw new Error('Failed to create share link');
      const data = await res.json();
      const url = `${window.location.origin}/shared/${data.id}`;
      setShareUrl(url);
    } catch (err: any) {
      setError(err.message || 'Failed to share analysis');
    } finally {
      setSharing(false);
    }
  };

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveToReports = async () => {
    if (!result) return;
    setSaving(true);
    try {
      const pga = result.perGeneAnalysis;
      const isGeneMatrix = !!pga;
      const genes = pga
        ? (pga.topByEigenvalue || []).concat(pga.bottomByEigenvalue || [])
        : result.results.map((r: any) => ({
            gene: r.channel,
            eigenvalue: r.eigenvalue,
            phi1: r.phi1,
            phi2: r.phi2,
            r2: r.r2,
            stability: r.stability,
            geneType: 'other',
          }));

      const payload = {
        genes,
        fileName: result.fileName,
        detectedFormat: result.detectedFormat,
        gearboxAnalysis: result.gearboxAnalysis || null,
        perGeneAnalysis: pga ? {
          totalGenes: pga.totalGenes,
          clockGenesFound: pga.clockGenesFound,
          clockMeanEigenvalue: pga.clockMeanEigenvalue,
          targetMeanEigenvalue: pga.targetMeanEigenvalue,
        } : null,
      };

      const summary = pga
        ? `${pga.totalGenes} genes, ${pga.clockGenesFound} clock genes. Clock |λ| = ${pga.clockMeanEigenvalue?.toFixed(4) || 'N/A'}, Target |λ| = ${pga.targetMeanEigenvalue?.toFixed(4) || 'N/A'}`
        : `${result.channelsAnalyzed} channels analyzed from ${result.detectedFormat} data`;

      const res = await fetch('/api/saved-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Discovery Engine — ${result.fileName || 'Analysis'}`,
          sourcePage: 'discovery-engine',
          reportType: 'gene_eigenvalue_list',
          summary,
          geneCount: pga ? pga.totalGenes : result.channelsAnalyzed,
          payload,
        }),
      });
      if (!res.ok) throw new Error('Failed to save report');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save report');
    } finally {
      setSaving(false);
    }
  };

  const loadRosenData = async (variant: 'topflash' | 'bcat') => {
    setError(null);
    setResult(null);
    try {
      const endpoint = variant === 'bcat' ? '/api/sample-data/rosen2026-bcat' : '/api/sample-data/rosen2026';
      const response = await fetch(endpoint);
      if (response.status === 404) {
        throw new Error('The Rosen et al. dataset is not available on this deployment.');
      }
      if (!response.ok) throw new Error('Failed to load Rosen et al. data');
      const blob = await response.blob();
      const filename = variant === 'bcat' 
        ? 'Rosen2026_BetaCatenin_AllConditions.csv' 
        : 'Rosen2026_Wnt_AntiResonance_AllConditions.csv';
      const f = new File([blob], filename, { type: 'text/csv' });
      handleFile(f);
    } catch (err: any) {
      setError(err.message || 'Failed to load sample data');
    }
  };

  const loadDataset = async (name: string, _filename: string) => {
    setError(null);
    setResult(null);
    setFile(null);
    setLoadingDataset(name);
    try {
      // Server reads & analyses the file directly — no browser download/upload
      const response = await fetch(`/api/analyze/named-dataset/${name}`);
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to analyse dataset: ${name}`);
      }
      const data = await response.json();
      setResult(data);
      setFromSession(false);
    } catch (err: any) {
      setError(err.message || 'Failed to load dataset');
    } finally {
      setLoadingDataset(null);
    }
  };

  const runHumanBatch = async () => {
    setHumanBatchRunning(true);
    setHumanBatchDone(false);
    setHumanBatchProgress({ completed: 0, total: 5, current: 'Starting...' });
    try {
      const res = await fetch('/api/analyses/batch/human-datasets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period: 24, threshold: 0.05 })
      });
      if (!res.ok) throw new Error('Failed to start batch');
      const data = await res.json();
      setHumanBatchId(data.batchId);

      // Poll status every 8 seconds
      const poll = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/analyses/batch/${data.batchId}`);
          if (!statusRes.ok) return;
          const status = await statusRes.json();
          setHumanBatchProgress({
            completed: status.completedTissues || 0,
            total: status.totalTissues || 5,
            current: status.currentTissue || ''
          });
          if (status.status === 'completed' || status.status === 'failed') {
            clearInterval(poll);
            setHumanBatchRunning(false);
            setHumanBatchDone(status.status === 'completed');
          }
        } catch {}
      }, 8000);
    } catch (err: any) {
      setHumanBatchRunning(false);
      setError(err.message || 'Failed to start human batch analysis');
    }
  };

  const generateSampleCSV = (type: string) => {
    let csv = '';
    if (type === 'glucose') {
      csv = 'Timestamp,Glucose Value (mg/dL)\n';
      const baseGlucose = 95;
      for (let i = 0; i < 288; i++) {
        const hour = (i * 5 / 60) % 24;
        const circadian = 15 * Math.sin(2 * Math.PI * (hour - 6) / 24);
        const meal = (hour >= 7 && hour < 9) || (hour >= 12 && hour < 14) || (hour >= 18 && hour < 20) ? 12 : 0;
        const noise = (Math.random() - 0.5) * 8;
        const glucose = Math.round((baseGlucose + circadian + meal + noise) * 10) / 10;
        const date = new Date(2025, 0, 1, Math.floor(i * 5 / 60), (i * 5) % 60);
        csv += `${date.toISOString()},${glucose}\n`;
      }
    } else if (type === 'hrv') {
      csv = 'date,hrv_rmssd,temperature_deviation\n';
      for (let d = 0; d < 30; d++) {
        const date = new Date(2025, 0, d + 1);
        const hrv = 42 + 8 * Math.sin(2 * Math.PI * d / 7) + (Math.random() - 0.5) * 10;
        const temp = 0.1 * Math.sin(2 * Math.PI * d / 28) + (Math.random() - 0.5) * 0.3;
        csv += `${date.toISOString().split('T')[0]},${hrv.toFixed(1)},${temp.toFixed(2)}\n`;
      }
    } else {
      csv = 'time,signal_A,signal_B\n';
      for (let t = 0; t < 100; t++) {
        const a = 5 * Math.sin(2 * Math.PI * t / 24) + (Math.random() - 0.5) * 2;
        const b = 3 * Math.cos(2 * Math.PI * t / 12) + 0.7 * (t > 0 ? 3 * Math.cos(2 * Math.PI * (t - 1) / 12) : 0) + (Math.random() - 0.5) * 1.5;
        csv += `${t},${a.toFixed(3)},${b.toFixed(3)}\n`;
      }
    }
    const blob = new Blob([csv], { type: 'text/csv' });
    const f = new File([blob], type === 'glucose' ? 'sample_glucose.csv' : type === 'hrv' ? 'sample_oura.csv' : 'sample_generic.csv', { type: 'text/csv' });
    handleFile(f);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 text-slate-900">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* ── PAGE HEADER ── */}
        <div className="mb-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Link href="/">
                <button className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors mb-2 -ml-0.5" data-testid="link-back-home">
                  <ArrowLeft size={12} /> Home
                </button>
              </Link>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-500 to-blue-500 bg-clip-text text-transparent" data-testid="text-page-title">
                PAR(2) Discovery Engine
              </h1>
              <p className="text-sm text-slate-500 mt-1">Upload any CSV time-series data for real-time AR(2) eigenvalue analysis</p>
            </div>
            <div className="flex items-center gap-2 shrink-0 mt-1">
              <Link href="/ar2-diagnostics">
                <Button variant="outline" size="sm" className="gap-2 border-amber-300 text-amber-600 hover:bg-amber-50" data-testid="link-validation-suite">
                  <ShieldCheck size={14} />
                  Stress Tests
                </Button>
              </Link>
              <Badge variant="outline" className="border-cyan-500/50 text-cyan-600 bg-cyan-50/50">
                <Activity size={12} className="mr-1" /> Live Analysis
              </Badge>
            </div>
          </div>

          {/* Scannable 3-step summary strip */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="flex items-center gap-2.5 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5 text-sm text-slate-600">
              <Upload size={15} className="text-cyan-500 shrink-0" />
              <span><strong className="text-slate-800">Upload</strong> any CSV — gene expression, wearable, or lab data</span>
            </div>
            <div className="flex items-center gap-2.5 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5 text-sm text-slate-600">
              <Activity size={15} className="text-emerald-500 shrink-0" />
              <span><strong className="text-slate-800">Get |λ| scores</strong> — persistence for each channel in seconds</span>
            </div>
            <div className="flex items-center gap-2.5 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5 text-sm text-slate-600">
              <Share2 size={15} className="text-indigo-500 shrink-0" />
              <span><strong className="text-slate-800">Share results</strong> — download report or generate a link</span>
            </div>
          </div>
        </div>

        {!result ? (
          <div className="space-y-6">
            <Card className="bg-white border-slate-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Upload size={18} className="text-cyan-400" />
                  Upload Your Data
                </CardTitle>
                <CardDescription className="text-slate-500">
                  Upload any CSV with numeric time-series columns — gene expression, lab data, wearable exports, or custom signals. The engine auto-detects the format.
                </CardDescription>
                <div className="flex items-start gap-2 mt-2 rounded-md bg-blue-500/5 border border-blue-500/20 px-3 py-2">
                  <Info size={14} className="text-blue-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-slate-500">
                    <span className="text-blue-400 font-medium">Data privacy:</span> Your file is analysed entirely in your browser — it is never uploaded to any server. Only if you choose to share results does any data leave your device.
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                <div
                  className={`border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer ${
                    dragOver ? 'border-cyan-400 bg-cyan-400/5' : file ? 'border-green-500/50 bg-green-500/5' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="dropzone-upload"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.txt,.tsv"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                    data-testid="input-file"
                  />
                  {file ? (
                    <div className="space-y-3">
                      <CheckCircle2 size={40} className="text-green-400 mx-auto" />
                      <div>
                        <p className="font-medium text-slate-900" data-testid="text-filename">{file.name}</p>
                        <p className="text-sm text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <Button
                        onClick={(e) => { e.stopPropagation(); setFile(null); setResult(null); }}
                        variant="outline"
                        size="sm"
                        className="border-slate-300 text-slate-600"
                        data-testid="button-clear-file"
                      >
                        <X size={14} className="mr-1" /> Choose Different File
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <FileUp size={40} className="text-slate-500 mx-auto" />
                      <div>
                        <p className="font-medium text-slate-600">Drop your CSV file here, or click to browse</p>
                        <p className="text-sm text-slate-500 mt-1">Supports gene expression time series, lab measurements, wearable exports, or any CSV with numeric columns</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5" htmlFor="tissue-select">
                      Tissue / Context <span className="text-slate-400 font-normal">(for baseline comparison)</span>
                    </label>
                    <select
                      id="tissue-select"
                      data-testid="select-tissue-type"
                      value={tissueType}
                      onChange={e => setTissueType(e.target.value)}
                      className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                    >
                      {Object.entries(TISSUE_BASELINES).map(([key, b]) => (
                        <option key={key} value={key}>{b.label}</option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-400 mt-1">{TISSUE_BASELINES[tissueType]?.description}</p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5" htmlFor="control-file-input">
                      Control / Baseline Dataset <span className="text-slate-400 font-normal">(optional — enables differential report)</span>
                    </label>
                    <div
                      className={`border rounded-md px-3 py-2 flex items-center gap-2 cursor-pointer transition-colors ${
                        controlFile ? 'border-green-500/50 bg-green-500/5' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                      onClick={() => controlFileInputRef.current?.click()}
                      data-testid="dropzone-control-file"
                    >
                      <input
                        ref={controlFileInputRef}
                        id="control-file-input"
                        type="file"
                        accept=".csv,.txt,.tsv"
                        className="hidden"
                        onChange={e => {
                          const f = e.target.files?.[0];
                          if (f) setControlFile(f);
                        }}
                        data-testid="input-control-file"
                      />
                      {controlFile ? (
                        <>
                          <CheckCircle2 size={14} className="text-green-400 shrink-0" />
                          <span className="text-xs text-slate-700 truncate flex-1">{controlFile.name}</span>
                          <button
                            className="text-slate-400 hover:text-slate-600 shrink-0"
                            onClick={e => { e.stopPropagation(); setControlFile(null); }}
                            data-testid="button-clear-control-file"
                          >
                            <X size={12} />
                          </button>
                        </>
                      ) : (
                        <>
                          <FileUp size={14} className="text-slate-400 shrink-0" />
                          <span className="text-xs text-slate-400">Upload control CSV…</span>
                        </>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Upload a healthy-control or baseline dataset. The engine will run both and generate a differential Persistence Integrity Report.
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-start gap-2 rounded-md bg-slate-50 border border-slate-200 px-3 py-2">
                  <Info size={13} className="text-slate-400 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-slate-500">
                    <span className="text-slate-600 font-medium">Timepoint minimum:</span> AR(2) requires at least <span className="font-semibold text-slate-700">6 sequential timepoints</span> per channel to fit a second-order model. Clinical reliability is highest with <span className="font-semibold text-slate-700">≥ 10 timepoints</span>. Channels below the minimum are automatically excluded from analysis.
                  </p>
                </div>

                {file && (
                  <div className="mt-4 flex flex-col items-center gap-3">
                    <Button
                      onClick={runAnalysis}
                      disabled={analyzing}
                      className="gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-slate-900 px-8"
                      data-testid="button-analyze"
                    >
                      {analyzing ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Zap size={16} />
                          Run AR(2) Analysis
                        </>
                      )}
                    </Button>
                    {analyzing && file && (
                      <div className="text-center text-sm text-slate-500 max-w-md">
                        <span className="text-amber-400 font-medium">
                          {file.size > 200 * 1024 * 1024
                            ? 'Large dataset (~' + (file.size / (1024 * 1024)).toFixed(0) + ' MB) — expect 3–8 minutes'
                            : file.size > 50 * 1024 * 1024
                            ? 'Large dataset (~' + (file.size / (1024 * 1024)).toFixed(0) + ' MB) — expect 1–3 minutes'
                            : file.size > 10 * 1024 * 1024
                            ? 'Medium dataset (~' + (file.size / (1024 * 1024)).toFixed(0) + ' MB) — expect up to 1 minute'
                            : null}
                        </span>
                        {file.size > 10 * 1024 * 1024 && (
                          <span className="block text-slate-500 text-xs mt-1">
                            AR(2) is fitting one model per gene — this is compute-intensive for large gene matrices. Please keep this tab open.
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {error && (
                  <Alert variant="destructive" className="mt-4">
                    <AlertCircle size={16} />
                    <AlertTitle>Analysis Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* |λ| scale reference — shown after upload widget so it doesn't block the drop zone */}
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="flex gap-3">
                <Info size={15} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-2 text-sm text-slate-700">
                  <p>
                    <span className="font-semibold">What you'll get:</span> A <span className="font-semibold">persistence score (|λ|)</span> for each column — a number from 0 to 1 measuring how self-sustaining each signal is over time.
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded bg-white border border-amber-100 px-2 py-1.5">
                      <div className="font-bold text-red-500">|λ| &lt; 0.5</div>
                      <div className="text-slate-500 mt-0.5">Low persistence — each measurement is largely independent of the last</div>
                    </div>
                    <div className="rounded bg-white border border-amber-100 px-2 py-1.5">
                      <div className="font-bold text-amber-600">|λ| 0.5 – 0.7</div>
                      <div className="text-slate-500 mt-0.5">Moderate memory — past values carry some predictive weight</div>
                    </div>
                    <div className="rounded bg-white border border-amber-100 px-2 py-1.5">
                      <div className="font-bold text-emerald-600">|λ| &gt; 0.7</div>
                      <div className="text-slate-500 mt-0.5">High persistence — current level strongly predicts the next measurement</div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">
                    <span className="font-medium text-slate-600">Note:</span> Persistence ≠ rhythmicity. A signal can score high without oscillating. Complex AR(2) roots indicate oscillatory dynamics; real roots indicate monotone decay or growth.
                  </p>
                </div>
              </div>
            </div>

            <HowTo
              title="Discovery Engine"
              summary="Upload any CSV time-series data — gene expression profiles, lab measurements, wearable exports, or custom signals — and run AR(2) eigenvalue analysis. The engine detects channels, fits AR(2) models, computes eigenvalues, and provides full quality diagnostics."
              steps={[
                { label: "Upload a CSV", detail: "Drag and drop or click to upload. Each numeric column is treated as a channel." },
                { label: "Run analysis", detail: "The engine fits AR(2) models to each channel and reports eigenvalues, R², and stability." },
                { label: "Review diagnostics", detail: "Edge-case checks flag trends, small samples, or non-stationarity that might affect results." },
                { label: "Share results", detail: "Generate a unique shareable link so others can view your analysis." }
              ]}
              defaultOpen={true}
            />

            <Card className="bg-white border-slate-200">
              <CardHeader
                className="cursor-pointer select-none"
                onClick={() => setDatasetsExpanded(e => !e)}
              >
                <CardTitle className="text-sm flex items-center justify-between text-slate-600">
                  <span className="flex items-center gap-2">
                    <Download size={14} className="text-amber-400" />
                    Try with Sample Data
                  </span>
                  {datasetsExpanded ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
                </CardTitle>
                <CardDescription className="text-slate-500 text-xs">
                  Load real experimental datasets from published studies or synthetic examples
                </CardDescription>
              </CardHeader>
              {datasetsExpanded && <CardContent className="space-y-5">

                {/* ── Wnt Signaling (Rosen et al.) ──────────────────────── */}
                {rosenAvailable !== false && <div>
                  <p className="text-xs text-emerald-400 font-semibold uppercase tracking-wider mb-2">Wnt Signaling (Rosen et al. 2026)</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Button variant="outline" className="h-auto py-3 px-4 border-emerald-700/50 hover:bg-emerald-900/20 flex flex-col items-start gap-1 text-left whitespace-normal" onClick={() => loadRosenData('topflash')} disabled={!!loadingDataset} data-testid="button-sample-rosen-tf">
                      <span className="font-medium text-emerald-400">TopFlash + Beta-Catenin (All Conditions)</span>
                      <span className="text-xs text-slate-500 leading-snug">14 channels: 7 TF + 7 bcat across NL, 6hr, 9hr, 15hr, 18hr, 21hr, 24hr Wnt pulses. 231 timepoints.</span>
                    </Button>
                    <Button variant="outline" className="h-auto py-3 px-4 border-emerald-700/50 hover:bg-emerald-900/20 flex flex-col items-start gap-1 text-left whitespace-normal" onClick={() => loadRosenData('bcat')} disabled={!!loadingDataset} data-testid="button-sample-rosen-bcat">
                      <span className="font-medium text-emerald-400">Beta-Catenin Only</span>
                      <span className="text-xs text-slate-500 leading-snug">7 conditions of beta-catenin protein dynamics. Upstream signal with wide |λ| range (0.91–0.997).</span>
                    </Button>
                  </div>
                </div>}

                {/* ── 1. Core Circadian Reference ───────────────────────── */}
                <div>
                  <p className="text-xs text-blue-400 font-semibold uppercase tracking-wider mb-2">Core Circadian Reference (Canonical)</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Button variant="outline" className="h-auto py-3 px-4 border-blue-700/50 hover:bg-blue-900/20 flex flex-col items-start gap-1 text-left whitespace-normal" onClick={() => loadDataset('mouse-liver', 'GSE54650_Liver_circadian.csv')} disabled={!!loadingDataset} data-testid="button-sample-mouse-liver">
                      <span className="font-medium text-blue-400">{loadingDataset === 'mouse-liver' ? 'Loading...' : 'Mouse Liver (GSE54650)'}</span>
                      <span className="text-xs text-slate-500 leading-snug">Hughes et al. Circadian Atlas. ~21K genes, 24 timepoints across 2 circadian cycles. The canonical starting point.</span>
                    </Button>
                    <Button variant="outline" className="h-auto py-3 px-4 border-blue-700/50 hover:bg-blue-900/20 flex flex-col items-start gap-1 text-left whitespace-normal" onClick={() => loadDataset('mouse-liver-highres', 'GSE11923_Liver_1h_48h.csv')} disabled={!!loadingDataset} data-testid="button-sample-mouse-liver-highres">
                      <span className="font-medium text-blue-400">{loadingDataset === 'mouse-liver-highres' ? 'Loading...' : 'Mouse Liver High-Resolution (GSE11923)'}</span>
                      <span className="text-xs text-slate-500 leading-snug">48 hourly timepoints — highest-resolution liver circadian dataset. Second independent source for Wee1 Tier 0 validation.</span>
                    </Button>
                    <Button variant="outline" className="h-auto py-3 px-4 border-blue-700/50 hover:bg-blue-900/20 flex flex-col items-start gap-1 text-left whitespace-normal" onClick={() => loadDataset('human-blood', 'GSE113883_Human_WholeBlood.csv')} disabled={!!loadingDataset} data-testid="button-sample-human-blood">
                      <span className="font-medium text-blue-400">{loadingDataset === 'human-blood' ? 'Loading...' : 'Human Whole Blood (GSE113883)'}</span>
                      <span className="text-xs text-slate-500 leading-snug">Braun et al. 2018 PNAS (TimeSignature). ~58K transcripts, 15 timepoints. 28-hour constant routine.</span>
                    </Button>
                    <Button variant="outline" className="h-auto py-3 px-4 border-blue-700/50 hover:bg-blue-900/20 flex flex-col items-start gap-1 text-left whitespace-normal" onClick={() => loadDataset('baboon-liver', 'GSE98965_baboon_FPKM.csv')} disabled={!!loadingDataset} data-testid="button-sample-baboon-liver">
                      <span className="font-medium text-blue-400">{loadingDataset === 'baboon-liver' ? 'Loading...' : 'Baboon Liver (GSE98965)'}</span>
                      <span className="text-xs text-slate-500 leading-snug">Primate liver circadian expression. ~29K genes. Cross-species hierarchy validation — does the clock&gt;target gap hold in primates?</span>
                    </Button>
                  </div>
                </div>

                {/* ── 2. Mouse Tissue Atlas (GSE54650) ─────────────────── */}
                <div>
                  <p className="text-xs text-indigo-400 font-semibold uppercase tracking-wider mb-2">Mouse Tissue Atlas — All 12 Tissues (GSE54650, Hughes et al.)</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { key: 'mouse-heart',       label: 'Heart',          desc: 'Tead1/YAP1-linked Hippo gating module. Tier 1 cross-tissue hit.' },
                      { key: 'mouse-cerebellum',  label: 'Cerebellum',     desc: 'Cdk1-centred direct mitotic gating. Distinct from liver/heart modules.' },
                      { key: 'mouse-kidney',      label: 'Kidney',         desc: 'Metabolic and filtration-linked circadian gating.' },
                      { key: 'mouse-lung',        label: 'Lung',           desc: 'Respiratory tissue circadian programme.' },
                      { key: 'mouse-muscle',      label: 'Skeletal Muscle',desc: 'Exercise-metabolism-circadian intersection.' },
                      { key: 'mouse-adrenal',     label: 'Adrenal Gland',  desc: 'HPA axis circadian output tissue. Cortisol rhythm origin.' },
                      { key: 'mouse-aorta',       label: 'Aorta',          desc: 'Vascular circadian programme. Cardiovascular risk timing.' },
                      { key: 'mouse-brainstem',   label: 'Brainstem',      desc: 'Central oscillator output. Compare with cerebellum.' },
                      { key: 'mouse-brown-fat',   label: 'Brown Fat',      desc: 'Thermogenic adipose tissue. Metabolic circadian control.' },
                      { key: 'mouse-hypothalamus',label: 'Hypothalamus',   desc: 'SCN-proximal tissue. Nearest to the master pacemaker.' },
                      { key: 'mouse-white-fat',   label: 'White Fat',      desc: 'Storage adipose. Shows unexpectedly large clock>target gap.' },
                    ].map(({ key, label, desc }) => (
                      <Button key={key} variant="outline" className="h-auto py-2 px-3 border-indigo-700/50 hover:bg-indigo-900/20 flex flex-col items-start gap-0.5 text-left whitespace-normal" onClick={() => loadDataset(key, '')} disabled={!!loadingDataset} data-testid={`button-sample-${key}`}>
                        <span className="font-medium text-indigo-300 text-xs">{loadingDataset === key ? 'Loading...' : label}</span>
                        <span className="text-[10px] text-slate-500 leading-snug">{desc}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                {/* ── 3. Intestinal Organoids — Four Genotypes ─────────── */}
                <div>
                  <p className="text-xs text-rose-400 font-semibold uppercase tracking-wider mb-2">Intestinal Organoids — Four Genotypes (GSE157357) <span className="text-slate-500 normal-case font-normal">⚠ 22h window — eigenvalues indicative only</span></p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Button variant="outline" className="h-auto py-3 px-4 border-rose-700/50 hover:bg-rose-900/20 flex flex-col items-start gap-1 text-left whitespace-normal" onClick={() => loadDataset('organoid-wt', '')} disabled={!!loadingDataset} data-testid="button-sample-organoid-wt">
                      <span className="font-medium text-rose-400">{loadingDataset === 'organoid-wt' ? 'Loading...' : 'Organoid WT'}</span>
                      <span className="text-xs text-slate-500 leading-snug">Wild-type baseline. Clock median |λ|=0.601, target=0.527. Hierarchy gap +0.073. Start here.</span>
                    </Button>
                    <Button variant="outline" className="h-auto py-3 px-4 border-rose-700/50 hover:bg-rose-900/20 flex flex-col items-start gap-1 text-left whitespace-normal" onClick={() => loadDataset('organoid-apcko', '')} disabled={!!loadingDataset} data-testid="button-sample-organoid-apcko">
                      <span className="font-medium text-rose-400">{loadingDataset === 'organoid-apcko' ? 'Loading...' : 'Organoid ApcKO (cancer model)'}</span>
                      <span className="text-xs text-slate-500 leading-snug">Wnt pathway activation. Gap collapses to −0.024 via target elevation. Wee1 rises to |λ|=0.877.</span>
                    </Button>
                    <Button variant="outline" className="h-auto py-3 px-4 border-rose-700/50 hover:bg-rose-900/20 flex flex-col items-start gap-1 text-left whitespace-normal" onClick={() => loadDataset('organoid-bmalko', '')} disabled={!!loadingDataset} data-testid="button-sample-organoid-bmalko">
                      <span className="font-medium text-rose-400">{loadingDataset === 'organoid-bmalko' ? 'Loading...' : 'Organoid BmalKO (clock loss)'}</span>
                      <span className="text-xs text-slate-500 leading-snug">Clock gene suppression. Gap collapses to −0.078 via clock suppression. Opposite mechanism to ApcKO.</span>
                    </Button>
                    <Button variant="outline" className="h-auto py-3 px-4 border-rose-700/50 hover:bg-rose-900/20 flex flex-col items-start gap-1 text-left whitespace-normal" onClick={() => loadDataset('organoid-dblko', '')} disabled={!!loadingDataset} data-testid="button-sample-organoid-dblko">
                      <span className="font-medium text-rose-400">{loadingDataset === 'organoid-dblko' ? 'Loading...' : 'Organoid ApcKO/BmalKO DblKO (paradox)'}</span>
                      <span className="text-xs text-slate-500 leading-snug">Double knockout paradoxically restores hierarchy gap to +0.058. Non-additive compensatory effects.</span>
                    </Button>
                  </div>
                </div>

                {/* ── 4. Clock Perturbation (BMAL1) ─────────────────────── */}
                <div>
                  <p className="text-xs text-rose-400 font-semibold uppercase tracking-wider mb-2">Clock Perturbation — BMAL1 Knockout (GSE70499, Mouse Liver)</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Button variant="outline" className="h-auto py-3 px-4 border-rose-700/50 hover:bg-rose-900/20 flex flex-col items-start gap-1 text-left whitespace-normal" onClick={() => loadDataset('bmal1-wt-liver', '')} disabled={!!loadingDataset} data-testid="button-sample-bmal1-wt">
                      <span className="font-medium text-rose-400">{loadingDataset === 'bmal1-wt-liver' ? 'Loading...' : 'BMAL1 WT — Mouse Liver (GSE70499)'}</span>
                      <span className="text-xs text-slate-500 leading-snug">Wild-type control. Establishes the intact clock hierarchy baseline for direct KO comparison.</span>
                    </Button>
                    <Button variant="outline" className="h-auto py-3 px-4 border-rose-700/50 hover:bg-rose-900/20 flex flex-col items-start gap-1 text-left whitespace-normal" onClick={() => loadDataset('bmal1-ko-liver', '')} disabled={!!loadingDataset} data-testid="button-sample-bmal1-ko">
                      <span className="font-medium text-rose-400">{loadingDataset === 'bmal1-ko-liver' ? 'Loading...' : 'BMAL1 KO — Mouse Liver (GSE70499)'}</span>
                      <span className="text-xs text-slate-500 leading-snug">Core clock deletion. Tests whether |λ| drops from ~0.85 to ~0.50 as predicted by the generational memory model.</span>
                    </Button>
                  </div>
                </div>

                {/* ── 5. Cancer ─────────────────────────────────────────── */}
                <div>
                  <p className="text-xs text-rose-400 font-semibold uppercase tracking-wider mb-2">Cancer</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Button variant="outline" className="h-auto py-3 px-4 border-rose-700/50 hover:bg-rose-900/20 flex flex-col items-start gap-1 text-left whitespace-normal" onClick={() => loadDataset('neuroblastoma-myc-on', '')} disabled={!!loadingDataset} data-testid="button-sample-neuro-myc-on">
                      <span className="font-medium text-rose-400">{loadingDataset === 'neuroblastoma-myc-on' ? 'Loading...' : 'Neuroblastoma MYC-ON (GSE221103)'}</span>
                      <span className="text-xs text-slate-500 leading-snug">Cancer cells with MYC oncogene active. ~60K genes, 14 timepoints. Disrupted circadian hierarchy.</span>
                    </Button>
                    <Button variant="outline" className="h-auto py-3 px-4 border-rose-700/50 hover:bg-rose-900/20 flex flex-col items-start gap-1 text-left whitespace-normal" onClick={() => loadDataset('neuroblastoma-myc-off', '')} disabled={!!loadingDataset} data-testid="button-sample-neuro-myc-off">
                      <span className="font-medium text-rose-400">{loadingDataset === 'neuroblastoma-myc-off' ? 'Loading...' : 'Neuroblastoma MYC-OFF (GSE221103)'}</span>
                      <span className="text-xs text-slate-500 leading-snug">Same cells with MYC silenced. Does hierarchy recover? Compare directly against MYC-ON.</span>
                    </Button>
                    <Button variant="outline" className="h-auto py-3 px-4 border-rose-700/50 hover:bg-rose-900/20 flex flex-col items-start gap-1 text-left whitespace-normal" onClick={() => loadDataset('gbm-zmanseq', '')} disabled={!!loadingDataset} data-testid="button-sample-gbm">
                      <span className="font-medium text-rose-400">{loadingDataset === 'gbm-zmanseq' ? 'Loading...' : 'GBM Zman-seq (GSE232040)'}</span>
                      <span className="text-xs text-slate-500 leading-snug">Glioblastoma time-binned expression. NK cell exhaustion / circadian immune evasion context.</span>
                    </Button>
                  </div>
                </div>

                {/* ── 6. Sleep & Human Physiology ───────────────────────── */}
                <div>
                  <p className="text-xs text-amber-400 font-semibold uppercase tracking-wider mb-2">Sleep & Human Physiology</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                    <Button variant="outline" className="h-auto py-3 px-4 border-amber-700/50 hover:bg-amber-900/20 flex flex-col items-start gap-1 text-left whitespace-normal" onClick={() => loadDataset('sleep-sufficient', '')} disabled={!!loadingDataset} data-testid="button-sample-sleep-sufficient">
                      <span className="font-medium text-amber-400">{loadingDataset === 'sleep-sufficient' ? 'Loading...' : 'Sufficient Sleep (GSE39445)'}</span>
                      <span className="text-xs text-slate-500 leading-snug">Human blood, adequate sleep. ~19K genes, 10 timepoints. The healthy human reference for sleep studies.</span>
                    </Button>
                    <Button variant="outline" className="h-auto py-3 px-4 border-amber-700/50 hover:bg-amber-900/20 flex flex-col items-start gap-1 text-left whitespace-normal" onClick={() => loadDataset('sleep-restriction', '')} disabled={!!loadingDataset} data-testid="button-sample-sleep-restrict">
                      <span className="font-medium text-amber-400">{loadingDataset === 'sleep-restriction' ? 'Loading...' : 'Sleep Restriction (GSE39445)'}</span>
                      <span className="text-xs text-slate-500 leading-snug">Same subjects after sleep restriction. Compare against Sufficient Sleep to quantify hierarchy erosion.</span>
                    </Button>
                    <Button variant="outline" className="h-auto py-3 px-4 border-amber-700/50 hover:bg-amber-900/20 flex flex-col items-start gap-1 text-left whitespace-normal" onClick={() => loadDataset('forced-desync-aligned', '')} disabled={!!loadingDataset} data-testid="button-sample-desync-aligned">
                      <span className="font-medium text-amber-400">{loadingDataset === 'forced-desync-aligned' ? 'Loading...' : 'Forced Desynchrony — Aligned (GSE48113)'}</span>
                      <span className="text-xs text-slate-500 leading-snug">Human blood, sleep aligned with circadian phase. Forced desynchrony protocol baseline.</span>
                    </Button>
                    <Button variant="outline" className="h-auto py-3 px-4 border-amber-700/50 hover:bg-amber-900/20 flex flex-col items-start gap-1 text-left whitespace-normal" onClick={() => loadDataset('forced-desync-misaligned', '')} disabled={!!loadingDataset} data-testid="button-sample-desync-misaligned">
                      <span className="font-medium text-amber-400">{loadingDataset === 'forced-desync-misaligned' ? 'Loading...' : 'Forced Desynchrony — Misaligned (GSE48113)'}</span>
                      <span className="text-xs text-slate-500 leading-snug">Same subjects with sleep misaligned from circadian phase. Gold-standard circadian disruption model.</span>
                    </Button>
                    <Button variant="outline" className="h-auto py-3 px-4 border-amber-700/50 hover:bg-amber-900/20 flex flex-col items-start gap-1 text-left whitespace-normal" onClick={() => loadDataset('nurses-day', '')} disabled={!!loadingDataset} data-testid="button-sample-nurses-day">
                      <span className="font-medium text-amber-400">{loadingDataset === 'nurses-day' ? 'Loading...' : 'Nurses — Day Shift (GSE122541)'}</span>
                      <span className="text-xs text-slate-500 leading-snug">~20K genes, 8 timepoints. Normal circadian alignment. Real-world shift-work baseline.</span>
                    </Button>
                    <Button variant="outline" className="h-auto py-3 px-4 border-amber-700/50 hover:bg-amber-900/20 flex flex-col items-start gap-1 text-left whitespace-normal" onClick={() => loadDataset('nurses-night', '')} disabled={!!loadingDataset} data-testid="button-sample-nurses-night">
                      <span className="font-medium text-amber-400">{loadingDataset === 'nurses-night' ? 'Loading...' : 'Nurses — Night Shift (GSE122541)'}</span>
                      <span className="text-xs text-slate-500 leading-snug">Same nurses during night-shift rotation. Real-world circadian disruption model. Compare day vs night.</span>
                    </Button>
                    <Button variant="outline" className="h-auto py-3 px-4 border-amber-700/50 hover:bg-amber-900/20 flex flex-col items-start gap-1 text-left whitespace-normal" onClick={() => loadDataset('human-skeletal-muscle', '')} disabled={!!loadingDataset} data-testid="button-sample-skeletal-muscle">
                      <span className="font-medium text-amber-400">{loadingDataset === 'human-skeletal-muscle' ? 'Loading...' : 'Human Skeletal Muscle (GSE108539)'}</span>
                      <span className="text-xs text-slate-500 leading-snug">Human circadian muscle transcriptome. Exercise timing, metabolism, and performance rhythmicity.</span>
                    </Button>
                  </div>

                  {/* Human Cross-Condition Comparison Panel */}
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 mt-2" data-testid="human-comparison-panel">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Globe size={14} className="text-amber-400 shrink-0" />
                          <span className="text-sm font-semibold text-amber-300">Human Cross-Condition Comparison</span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          Run the 3 adequately-powered human datasets (Sufficient Sleep, Sleep Restriction, Whole Blood — each ≥10 timepoints) through the full phase-gating panel. Results are saved and appear in the Cross-Condition Comparison on the Dashboard. The Nurses and Forced Desynchrony datasets are available individually but have ≤8 timepoints, insufficient for PAR(2) significance testing.
                        </p>
                        {humanBatchRunning && (
                          <div className="mt-3 space-y-1">
                            <div className="flex items-center justify-between text-xs text-slate-400">
                              <span>{humanBatchProgress.current || 'Processing...'}</span>
                              <span>{humanBatchProgress.completed}/{humanBatchProgress.total}</span>
                            </div>
                            <Progress value={(humanBatchProgress.completed / humanBatchProgress.total) * 100} className="h-1.5" />
                          </div>
                        )}
                        {humanBatchDone && (
                          <div className="mt-2 flex items-center gap-1.5 text-xs text-green-400">
                            <CheckCircle2 size={12} />
                            All 3 human datasets analysed — open the Dashboard and select them in Cross-Condition Comparison.
                          </div>
                        )}
                      </div>
                      <Button size="sm" onClick={runHumanBatch} disabled={humanBatchRunning} className="shrink-0 bg-amber-600 hover:bg-amber-500 text-white text-xs" data-testid="btn-run-human-batch">
                        {humanBatchRunning ? (
                          <><Loader2 size={13} className="mr-1.5 animate-spin" />Running…</>
                        ) : humanBatchDone ? (
                          <><CheckCircle2 size={13} className="mr-1.5" />Re-run</>
                        ) : (
                          <><Play size={13} className="mr-1.5" />Run All 3</>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* ── 7. Gut & Enteroid ─────────────────────────────────── */}
                <div>
                  <p className="text-xs text-teal-400 font-semibold uppercase tracking-wider mb-2">Gut & Enteroid</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Button variant="outline" className="h-auto py-3 px-4 border-teal-700/50 hover:bg-teal-900/20 flex flex-col items-start gap-1 text-left whitespace-normal" onClick={() => loadDataset('human-enteroid', '')} disabled={!!loadingDataset} data-testid="button-sample-human-enteroid">
                      <span className="font-medium text-teal-400">{loadingDataset === 'human-enteroid' ? 'Loading...' : 'Human Enteroid (GSE161566)'}</span>
                      <span className="text-xs text-slate-500 leading-snug">Human intestinal organoid circadian expression. Complements the mouse organoid four-genotype series above.</span>
                    </Button>
                    <Button variant="outline" className="h-auto py-3 px-4 border-teal-700/50 hover:bg-teal-900/20 flex flex-col items-start gap-1 text-left whitespace-normal" onClick={() => loadDataset('mouse-enteroid', '')} disabled={!!loadingDataset} data-testid="button-sample-mouse-enteroid">
                      <span className="font-medium text-teal-400">{loadingDataset === 'mouse-enteroid' ? 'Loading...' : 'Mouse Enteroid (GSE179027)'}</span>
                      <span className="text-xs text-slate-500 leading-snug">Mouse intestinal organoid circadian time series. Used for raw-TPM Gene Eigenvalue Atlas validation.</span>
                    </Button>
                  </div>
                </div>

                {/* ── 8. Immune & Infection ─────────────────────────────── */}
                <div>
                  <p className="text-xs text-purple-400 font-semibold uppercase tracking-wider mb-2">Immune & Infection</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Button variant="outline" className="h-auto py-3 px-4 border-purple-700/50 hover:bg-purple-900/20 flex flex-col items-start gap-1 text-left whitespace-normal" onClick={() => loadDataset('macrophage-circadian', '')} disabled={!!loadingDataset} data-testid="button-sample-macrophage">
                      <span className="font-medium text-purple-400">{loadingDataset === 'macrophage-circadian' ? 'Loading...' : 'Macrophage Circadian (GSE25585)'}</span>
                      <span className="text-xs text-slate-500 leading-snug">Bone marrow-derived macrophage circadian transcriptome. Innate immune gating by the clock.</span>
                    </Button>
                    <Button variant="outline" className="h-auto py-3 px-4 border-purple-700/50 hover:bg-purple-900/20 flex flex-col items-start gap-1 text-left whitespace-normal" onClick={() => loadDataset('influenza-h3n2', '')} disabled={!!loadingDataset} data-testid="button-sample-influenza">
                      <span className="font-medium text-purple-400">{loadingDataset === 'influenza-h3n2' ? 'Loading...' : 'Influenza H3N2 — Human Blood (Zaas 2009)'}</span>
                      <span className="text-xs text-slate-500 leading-snug">Human transcriptomic response to influenza infection. Tests persistence hierarchy under acute viral challenge.</span>
                    </Button>
                    <Button variant="outline" className="h-auto py-3 px-4 border-purple-700/50 hover:bg-purple-900/20 flex flex-col items-start gap-1 text-left whitespace-normal" onClick={() => loadDataset('rabani-lps-curated', '')} disabled={!!loadingDataset} data-testid="button-sample-rabani-curated">
                      <span className="font-medium text-purple-400">{loadingDataset === 'rabani-lps-curated' ? 'Loading...' : 'DC LPS Response — Curated 39 genes (Rabani 2014)'}</span>
                      <span className="text-xs text-slate-500 leading-snug">Fast responders vs sustained effectors vs housekeeping. Tests regulator→effector hierarchy beyond circadian.</span>
                    </Button>
                    <Button variant="outline" className="h-auto py-3 px-4 border-purple-700/50 hover:bg-purple-900/20 flex flex-col items-start gap-1 text-left whitespace-normal" onClick={() => loadDataset('rabani-lps-full', '')} disabled={!!loadingDataset} data-testid="button-sample-rabani-full">
                      <span className="font-medium text-purple-400">{loadingDataset === 'rabani-lps-full' ? 'Loading...' : 'DC LPS Response — Full 3,147 genes (Rabani 2014)'}</span>
                      <span className="text-xs text-slate-500 leading-snug">Genome-wide innate immune response (0–12h post-LPS). Persistence hierarchy in a non-circadian context.</span>
                    </Button>
                  </div>
                </div>

                {/* ── 9. Proteomics ─────────────────────────────────────── */}
                <div>
                  <p className="text-xs text-violet-400 font-semibold uppercase tracking-wider mb-2">Proteomics</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Button variant="outline" className="h-auto py-3 px-4 border-violet-700/50 hover:bg-violet-900/20 flex flex-col items-start gap-1 text-left whitespace-normal" onClick={() => loadDataset('mouse-liver-proteomics', '')} disabled={!!loadingDataset} data-testid="button-sample-proteomics">
                      <span className="font-medium text-violet-400">{loadingDataset === 'mouse-liver-proteomics' ? 'Loading...' : 'Mouse Liver Circadian Proteomics'}</span>
                      <span className="text-xs text-slate-500 leading-snug">Circadian protein-level expression. 16 timepoints. Compare protein vs mRNA persistence for clock genes.</span>
                    </Button>
                    <Button variant="outline" className="h-auto py-3 px-4 border-violet-700/50 hover:bg-violet-900/20 flex flex-col items-start gap-1 text-left whitespace-normal" onClick={() => loadDataset('human-plasma-proteomics', '')} disabled={!!loadingDataset} data-testid="button-sample-human-plasma-proteomics">
                      <span className="font-medium text-violet-400">{loadingDataset === 'human-plasma-proteomics' ? 'Loading...' : 'Human Plasma Proteome Diurnal (2025)'}</span>
                      <span className="text-xs text-slate-500 leading-snug">Diurnal plasma proteomics from human subjects. Tests whether eigenvalue hierarchy holds at the secreted protein level.</span>
                    </Button>
                  </div>
                </div>

                {/* ── 10. Aging ─────────────────────────────────────────── */}
                <div>
                  <p className="text-xs text-orange-400 font-semibold uppercase tracking-wider mb-2">Aging</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Button variant="outline" className="h-auto py-3 px-4 border-orange-700/50 hover:bg-orange-900/20 flex flex-col items-start gap-1 text-left whitespace-normal" onClick={() => loadDataset('young-kidney', '')} disabled={!!loadingDataset} data-testid="button-sample-young-kidney">
                      <span className="font-medium text-orange-400">{loadingDataset === 'young-kidney' ? 'Loading...' : 'Young Kidney — Aging Study (GSE201207)'}</span>
                      <span className="text-xs text-slate-500 leading-snug">Kidney transcriptome from young animals in an aging study. Does the hierarchy weaken with age?</span>
                    </Button>
                  </div>
                </div>

                {/* ── 11. Non-Mammalian / Cross-Kingdom ────────────────── */}
                <div>
                  <p className="text-xs text-green-400 font-semibold uppercase tracking-wider mb-2">Non-Mammalian / Cross-Kingdom</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Button variant="outline" className="h-auto py-3 px-4 border-green-700/50 hover:bg-green-900/20 flex flex-col items-start gap-1 text-left whitespace-normal" onClick={() => loadDataset('yeast-metabolic', '')} disabled={!!loadingDataset} data-testid="button-sample-yeast">
                      <span className="font-medium text-green-400">{loadingDataset === 'yeast-metabolic' ? 'Loading...' : 'Yeast Metabolic Cycle (GSE3431)'}</span>
                      <span className="text-xs text-slate-500 leading-snug">Tu et al. ~6.7K genes, ultradian ~4–5h metabolic oscillation. Does the hierarchy appear in a non-circadian oscillator?</span>
                    </Button>
                    <Button variant="outline" className="h-auto py-3 px-4 border-green-700/50 hover:bg-green-900/20 flex flex-col items-start gap-1 text-left whitespace-normal" onClick={() => loadDataset('arabidopsis-wt', '')} disabled={!!loadingDataset} data-testid="button-sample-arabidopsis">
                      <span className="font-medium text-green-400">{loadingDataset === 'arabidopsis-wt' ? 'Loading...' : 'Arabidopsis WT — Constant Light (GSE19271)'}</span>
                      <span className="text-xs text-slate-500 leading-snug">Plant circadian oscillator under constant light. Entirely different molecular clock machinery — does hierarchy hold?</span>
                    </Button>
                    <Button variant="outline" className="h-auto py-3 px-4 border-green-700/50 hover:bg-green-900/20 flex flex-col items-start gap-1 text-left whitespace-normal" onClick={() => loadDataset('drosophila-lddd', '')} disabled={!!loadingDataset} data-testid="button-sample-drosophila">
                      <span className="font-medium text-green-400">{loadingDataset === 'drosophila-lddd' ? 'Loading...' : 'Drosophila LD→DD (GSE3830)'}</span>
                      <span className="text-xs text-slate-500 leading-snug">Fly circadian transcriptome transitioning from light:dark to constant dark. Insect clock cross-kingdom test.</span>
                    </Button>
                    <Button variant="outline" className="h-auto py-3 px-4 border-green-700/50 hover:bg-green-900/20 flex flex-col items-start gap-1 text-left whitespace-normal" onClick={() => loadDataset('drosophila-embryo', '')} disabled={!!loadingDataset} data-testid="button-sample-drosophila-embryo">
                      <span className="font-medium text-green-400">{loadingDataset === 'drosophila-embryo' ? 'Loading...' : 'Drosophila Embryo Development (Arbeitman 2002)'}</span>
                      <span className="text-xs text-slate-500 leading-snug">~4.5K genes across fly embryogenesis. Developmental rather than circadian oscillation — tests framework generality.</span>
                    </Button>
                    <Button variant="outline" className="h-auto py-3 px-4 border-green-700/50 hover:bg-green-900/20 flex flex-col items-start gap-1 text-left whitespace-normal" onClick={() => loadDataset('pfalciparum', '')} disabled={!!loadingDataset} data-testid="button-sample-pfalciparum">
                      <span className="font-medium text-green-400">{loadingDataset === 'pfalciparum' ? 'Loading...' : 'P. falciparum — Intraerythrocytic Cycle (GSE24416)'}</span>
                      <span className="text-xs text-slate-500 leading-snug">Malaria parasite IDC ~48h cycle. Protozoan oscillator — most distant kingdom test of eigenvalue persistence.</span>
                    </Button>
                  </div>
                </div>

                {/* ── 12. Synthetic ─────────────────────────────────────── */}
                <div>
                  <p className="text-xs text-cyan-400 font-semibold uppercase tracking-wider mb-2">Synthetic (Quick Demo)</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Button variant="outline" className="h-auto py-3 px-4 border-slate-200 hover:bg-slate-100 flex flex-col items-start gap-1 text-left whitespace-normal" onClick={() => generateSampleCSV('generic')} disabled={!!loadingDataset} data-testid="button-sample-generic">
                      <span className="font-medium text-cyan-400">Synthetic Multi-Channel</span>
                      <span className="text-xs text-slate-500 leading-snug">Two synthetic oscillatory signals with different periods. Instant demo of multi-channel AR(2) analysis without waiting for a real dataset to load.</span>
                    </Button>
                  </div>
                </div>

                {loadingDataset && (
                  <div className="mt-2 p-3 rounded-lg bg-amber-950/30 border border-amber-800/40 text-center">
                    <p className="text-amber-400 font-medium text-sm">
                      {loadingDataset === 'baboon-liver'
                        ? 'Baboon Liver (242 MB, ~29K genes) — server is reading and analysing the file. Expect 5–8 minutes.'
                        : loadingDataset === 'human-blood' || loadingDataset === 'neuroblastoma-myc-on' || loadingDataset === 'neuroblastoma-myc-off'
                        ? 'Large dataset (~60K transcripts) — expect 3–5 minutes.'
                        : loadingDataset === 'rabani-lps-full'
                        ? 'Genome-wide dataset (3,147 genes) — expect 1–2 minutes.'
                        : loadingDataset === 'mouse-liver-highres'
                        ? 'High-resolution dataset (48h × 1h) — expect 2–3 minutes.'
                        : 'Analysing dataset — please wait…'}
                    </p>
                    <p className="text-slate-500 text-xs mt-1">
                      Analysis runs entirely on the server — no upload required. Keep this tab open.
                    </p>
                  </div>
                )}
              </CardContent>}
            </Card>

            <Card className="bg-white border-slate-200">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2 text-slate-600">
                  <Info size={14} className="text-blue-400" />
                  Supported Formats
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(FORMAT_INFO).map(([key, info]) => (
                    <div key={key} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs border-slate-300">{info.label}</Badge>
                      </div>
                      <p className="text-xs text-slate-500 mb-2">{info.description}</p>
                      <pre className="text-[10px] text-slate-500 bg-white rounded p-2 overflow-x-auto">{info.example}</pre>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-6">
            {fromSession && (
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-100 px-4 py-2.5" data-testid="session-results-banner">
                <span className="text-xs text-slate-500">Showing results from your previous session — upload a new file or load a dataset to run a fresh analysis.</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-slate-500 hover:text-slate-700 gap-1.5"
                  onClick={() => { setResult(null); try { sessionStorage.removeItem('par2_last_result'); } catch {} setFromSession(false); }}
                  data-testid="clear-session-results"
                >
                  <X size={12} /> Clear
                </Button>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge className="bg-green-600/20 text-green-400 border-green-600/30">Analysis Complete</Badge>
                {(result as any).processedInBrowser && (
                  <Badge className="bg-blue-600/20 text-blue-400 border-blue-600/30 text-xs" title="Your file was processed entirely in your browser. No data was sent to any server.">
                    🔒 Processed locally
                  </Badge>
                )}
                <span className="text-sm text-slate-500">
                  {result.fileName} | {result.totalRecords} {result.detectedFormat === 'gene_expression_matrix' ? 'genes' : 'records'} | Format: {FORMAT_INFO[result.detectedFormat]?.label || result.detectedFormat}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-green-700 text-green-400 hover:bg-green-900/30"
                  onClick={async () => {
                    if (!result) return;
                    const reportLines: string[] = [];
                    reportLines.push('PAR(2) Discovery Engine - Analysis Report');
                    reportLines.push('='.repeat(50));
                    reportLines.push('');
                    reportLines.push('DISCLAIMER: These results are for hypothesis generation only.');
                    reportLines.push('AR(2) eigenvalue analysis identifies temporal persistence patterns');
                    reportLines.push('but does not establish causation or clinical utility without');
                    reportLines.push('independent validation. Eigenvalue interpretation is context-');
                    reportLines.push('dependent across organisms, tissues, and conditions.');
                    reportLines.push('');
                    reportLines.push('='.repeat(50));
                    reportLines.push(`File: ${result.fileName}`);
                    reportLines.push(`Records: ${result.totalRecords}`);
                    reportLines.push(`Format: ${FORMAT_INFO[result.detectedFormat]?.label || result.detectedFormat}`);
                    reportLines.push(`Date: ${new Date().toLocaleString()}`);
                    if (result.skippedChannels && result.skippedChannels.length > 0) {
                      reportLines.push(`Skipped Channels (< 6 timepoints): ${result.skippedChannels.join(', ')}`);
                    }
                    reportLines.push('');
                    reportLines.push('CHANNEL RESULTS');
                    reportLines.push('-'.repeat(50));
                    for (const ch of result.results) {
                      reportLines.push('');
                      reportLines.push(`Channel: ${ch.channel} (${ch.unit})`);
                      reportLines.push(`  Samples: ${ch.sampleCount}`);
                      reportLines.push(`  phi1 (β₁): ${ch.phi1.toFixed(6)}`);
                      reportLines.push(`  phi2 (β₂): ${ch.phi2.toFixed(6)}`);
                      reportLines.push(`  Eigenvalue |λ|: ${ch.eigenvalue.toFixed(6)}`);
                      reportLines.push(`  R²: ${ch.r2 != null ? ch.r2.toFixed(6) : 'N/A'}`);
                      reportLines.push(`  Ljung-Box p-value: ${ch.ljungBoxPValue.toFixed(6)} (${ch.ljungBoxPassed ? 'PASS - residuals are white noise' : 'FAIL - residuals have structure'})`);
                      const eig = ch.eigenvalue;
                      const zone = eig < 0.5 ? 'Low Persistence (Resilient)' : eig < 0.8 ? 'Moderate Persistence' : eig < 0.95 ? 'High Persistence' : 'Near-Critical';
                      reportLines.push(`  Persistence Zone: ${zone} (exploratory classification, not clinically validated)`);
                      reportLines.push(`  Stability: ${ch.stability}`);
                      if (ch.halfLife != null) reportLines.push(`  Half-Life: ${ch.halfLife.toFixed(1)} time steps`);
                      if (ch.impliedPeriod) reportLines.push(`  Implied Period: ${ch.impliedPeriod.toFixed(1)} time units`);
                      reportLines.push(`  Mean: ${ch.mean.toFixed(4)}, Std: ${ch.std.toFixed(4)}, Min: ${ch.min.toFixed(4)}, Max: ${ch.max.toFixed(4)}`);
                      if (ch.overallConfidence) {
                        reportLines.push(`  Confidence: ${ch.overallConfidence} (score: ${ch.confidenceScore ?? 'N/A'}/100)`);
                      }
                      const triggered = (ch.edgeCaseDiagnostics || []).filter(d => d.triggered);
                      if (triggered.length > 0) {
                        reportLines.push(`  ⚠ EDGE CASE WARNINGS (${triggered.length}):`);
                        for (const d of triggered) {
                          reportLines.push(`    [${d.severity.toUpperCase()}] ${d.label}: ${d.detail}`);
                        }
                      }
                    }
                    if (result.gearboxAnalysis) {
                      reportLines.push('');
                      reportLines.push('GEARBOX HIERARCHY ANALYSIS');
                      reportLines.push('-'.repeat(50));
                      reportLines.push(`  Clock Proxy: ${result.gearboxAnalysis.clockChannel} (|λ| = ${result.gearboxAnalysis.clockEigenvalue.toFixed(4)})`);
                      reportLines.push(`  Target Proxy: ${result.gearboxAnalysis.targetChannel} (|λ| = ${result.gearboxAnalysis.targetEigenvalue.toFixed(4)})`);
                      reportLines.push(`  Gap (Target - Clock): ${result.gearboxAnalysis.gap.toFixed(4)}`);
                      if (result.gearboxAnalysis.gapUncertainty != null) {
                        reportLines.push(`  Gap Uncertainty: ±${result.gearboxAnalysis.gapUncertainty.toFixed(4)}`);
                        reportLines.push(`  Gap Reliable: ${result.gearboxAnalysis.gapReliable ? 'YES — gap exceeds noise band' : 'NO — gap is within noise band, hierarchy call is uncertain'}`);
                      }
                      reportLines.push(`  Hierarchy Status: ${result.gearboxAnalysis.hierarchyStatus}`);
                    }

                    try {
                      const stressRes = await fetch('/api/stress-tests/run');
                      if (stressRes.ok) {
                        const stress = await stressRes.json();
                        const num = (v: any, d = 4) => typeof v === 'number' ? v.toFixed(d) : 'N/A';
                        reportLines.push('');
                        reportLines.push('');
                        reportLines.push('ENGINE VALIDATION & STRESS TEST RESULTS');
                        reportLines.push('='.repeat(50));
                        reportLines.push(`Overall Verdict: ${stress.overallVerdict || 'UNKNOWN'}`);
                        reportLines.push(`Download Timestamp: ${new Date().toISOString()}`);

                        if (stress.syntheticTests?.tests) {
                          reportLines.push('');
                          reportLines.push('SYNTHETIC ROUND-TRIP TESTS');
                          reportLines.push('-'.repeat(50));
                          const passed = stress.syntheticTests.tests.filter((t: any) => t.passed).length;
                          reportLines.push(`Pass Rate: ${stress.syntheticTests.passRate ?? 'N/A'}% (${passed}/${stress.syntheticTests.tests.length})`);
                          reportLines.push(`Mean Absolute Error: ${stress.syntheticTests.meanAbsError ?? 'N/A'}`);
                          for (const t of stress.syntheticTests.tests) {
                            reportLines.push(`  ${t.passed ? 'PASS' : 'FAIL'} | ${t.name || 'unnamed'} | True |λ|=${num(t.trueEigenvalue)}, Recovered=${num(t.recoveredEigenvalue)}, Error=${num(t.eigenvalueError)}`);
                          }
                        }

                        if (stress.referenceComparison?.tests) {
                          reportLines.push('');
                          reportLines.push('REFERENCE COMPARISON');
                          reportLines.push('-'.repeat(50));
                          reportLines.push(`Pass Rate: ${stress.referenceComparison.passRate ?? 'N/A'}%`);
                          for (const t of stress.referenceComparison.tests) {
                            reportLines.push(`  ${t.passed ? 'PASS' : 'FAIL'} | ${t.name || 'unnamed'} | Ours=${num(t.ourValue)}, Ref=${num(t.referenceValue)}, Error=${num(t.error)}`);
                          }
                        }

                        if (stress.sensitivityAnalysis) {
                          reportLines.push('');
                          reportLines.push('SENSITIVITY ANALYSIS');
                          reportLines.push('-'.repeat(50));
                          const sa = stress.sensitivityAnalysis;
                          if (sa.noiseSensitivity?.values) {
                            reportLines.push('Noise Sensitivity (σ → recovered |λ|, avg over 10 trials):');
                            for (let i = 0; i < sa.noiseSensitivity.values.length; i++) {
                              reportLines.push(`  σ=${sa.noiseSensitivity.values[i]} → |λ|=${num(sa.noiseSensitivity.recoveredEigenvalues?.[i])}, error=${num(sa.noiseSensitivity.errors?.[i])}`);
                            }
                          }
                          if (sa.sampleSizeSensitivity?.values) {
                            reportLines.push('Sample Size Sensitivity (n → recovered |λ|, avg over 10 trials):');
                            for (let i = 0; i < sa.sampleSizeSensitivity.values.length; i++) {
                              reportLines.push(`  n=${sa.sampleSizeSensitivity.values[i]} → |λ|=${num(sa.sampleSizeSensitivity.recoveredEigenvalues?.[i])}, error=${num(sa.sampleSizeSensitivity.errors?.[i])}`);
                            }
                          }
                          if (sa.missingDataSensitivity?.values) {
                            reportLines.push('Missing Data Sensitivity (% missing → recovered |λ|):');
                            for (let i = 0; i < sa.missingDataSensitivity.values.length; i++) {
                              reportLines.push(`  ${sa.missingDataSensitivity.values[i]}% → |λ|=${num(sa.missingDataSensitivity.recoveredEigenvalues?.[i])}, error=${num(sa.missingDataSensitivity.errors?.[i])}`);
                            }
                          }
                        }

                        if (stress.distributionTest?.separation) {
                          reportLines.push('');
                          reportLines.push('DISTRIBUTION SEPARATION TEST');
                          reportLines.push('-'.repeat(50));
                          const sep = stress.distributionTest.separation;
                          reportLines.push(`White Noise mean |λ|: ${num(sep.noiseMean)} (std: ${num(sep.noiseStd)})`);
                          reportLines.push(`Healthy mean |λ|: ${num(sep.healthyMean)} (std: ${num(sep.healthyStd)})`);
                          reportLines.push(`Stressed mean |λ|: ${num(sep.stressedMean)} (std: ${num(sep.stressedStd)})`);
                          reportLines.push(`Clusters Separated: ${sep.separated ? 'YES' : 'NO'}`);
                        }
                      } else {
                        reportLines.push('');
                        reportLines.push('ENGINE VALIDATION: Stress tests unavailable (server returned an error).');
                      }
                    } catch (e) {
                      reportLines.push('');
                      reportLines.push('ENGINE VALIDATION: Stress tests could not be loaded at download time.');
                    }

                    reportLines.push('');
                    reportLines.push('='.repeat(50));
                    reportLines.push('Generated by PAR(2) Discovery Engine');
                    reportLines.push('AR(2) model: y(t) = β₁·y(t-1) + β₂·y(t-2) + ε');

                    const csvLines: string[] = [];
                    csvLines.push('Channel,Unit,Samples,phi1,phi2,Eigenvalue,R_Squared,LjungBox_pValue,LjungBox_Pass,Clinical_Zone,Stability,Mean,Std,Min,Max');
                    for (const ch of result.results) {
                      const eig = ch.eigenvalue;
                      const zone = eig < 0.5 ? 'Healthy' : eig < 0.8 ? 'Moderate' : eig < 0.95 ? 'High' : 'Critical';
                      const safe = (v: number | null | undefined, n: number) => v != null ? v.toFixed(n) : 'N/A';
                      csvLines.push(`${ch.channel},${ch.unit},${ch.sampleCount},${safe(ch.phi1,6)},${safe(ch.phi2,6)},${safe(eig,6)},${safe(ch.r2,6)},${safe(ch.ljungBoxPValue,6)},${ch.ljungBoxPassed},${zone},${ch.stability},${safe(ch.mean,4)},${safe(ch.std,4)},${safe(ch.min,4)},${safe(ch.max,4)}`);
                    }

                    const fullReport = reportLines.join('\n') + '\n\n--- CSV DATA ---\n' + csvLines.join('\n');
                    const blob = new Blob([fullReport], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `PAR2_Analysis_${result.fileName.replace(/\.[^.]+$/, '')}_${new Date().toISOString().slice(0, 10)}.txt`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  data-testid="button-download-results"
                >
                  <Download size={14} className="mr-1" />
                  Download Results
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-slate-200 text-slate-600"
                  onClick={handleShare}
                  disabled={sharing}
                  data-testid="button-share-analysis"
                >
                  {sharing ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Share2 size={14} className="mr-1" />}
                  {sharing ? 'Sharing...' : 'Share'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className={saved ? "border-emerald-700 text-emerald-400" : "border-slate-200 text-slate-600"}
                  onClick={handleSaveToReports}
                  disabled={saving || saved}
                  data-testid="button-save-to-reports"
                >
                  {saving ? <Loader2 size={14} className="mr-1 animate-spin" /> : saved ? <Check size={14} className="mr-1" /> : <Save size={14} className="mr-1" />}
                  {saving ? 'Saving...' : saved ? 'Saved!' : 'Save to Reports'}
                </Button>
                <ExportReport
                  title={`PAR(2) Discovery Engine — ${result.fileName || 'Analysis'}`}
                  subtitle={`Format: ${result.detectedFormat} | ${result.channelsAnalyzed} channels | ${result.totalRecords} records | Generated ${new Date().toLocaleDateString()}`}
                  sections={[
                    ...(result.perGeneAnalysis ? [
                      { heading: 'Gene Expression Matrix Summary', content: { type: 'stats' as const, items: [
                        { label: 'Total Genes', value: result.perGeneAnalysis.totalGenes },
                        { label: 'Clock Genes Found', value: result.perGeneAnalysis.clockGenesFound },
                        { label: 'Time Points', value: result.perGeneAnalysis.timepointCount },
                        { label: 'Clock Mean |λ|', value: result.perGeneAnalysis.clockMeanEigenvalue?.toFixed(4) || 'N/A' },
                        { label: 'Target Mean |λ|', value: result.perGeneAnalysis.targetMeanEigenvalue?.toFixed(4) || 'N/A' },
                      ]}},
                      { heading: 'Hierarchy (Gearbox) Analysis', content: result.gearboxAnalysis ? `Clock mean |λ| = ${result.gearboxAnalysis.clockEigenvalue?.toFixed(4) || 'N/A'} vs Target mean |λ| = ${result.gearboxAnalysis.targetEigenvalue?.toFixed(4) || 'N/A'}. Gap = ${result.gearboxAnalysis.gap?.toFixed(4) || 'N/A'}. Status: ${result.gearboxAnalysis.hierarchyStatus || 'Unknown'}.` : 'No gearbox analysis available.' },
                      { heading: 'Top 20 Genes by Eigenvalue', content: { type: 'table' as const, headers: ['Rank', 'Gene', 'Type', '|λ|', 'Stability'], rows: (result.perGeneAnalysis.topByEigenvalue || []).map((g: any, i: number) => [String(i+1), g.gene, g.geneType, g.eigenvalue.toFixed(4), g.stability]) }},
                      { heading: 'Bottom 10 Genes by Eigenvalue', content: { type: 'table' as const, headers: ['Rank', 'Gene', 'Type', '|λ|', 'Stability'], rows: (result.perGeneAnalysis.bottomByEigenvalue || []).map((g: any, i: number) => [String(i+1), g.gene, g.geneType, g.eigenvalue.toFixed(4), g.stability]) }},
                    ] : [
                      { heading: 'Analysis Summary', content: { type: 'stats' as const, items: [
                        { label: 'Channels Analyzed', value: result.channelsAnalyzed },
                        { label: 'Total Records', value: result.totalRecords },
                        { label: 'Format', value: result.detectedFormat },
                      ]}},
                      { heading: 'Channel Results', content: { type: 'table' as const, headers: ['Channel', '|λ|', 'φ₁', 'φ₂', 'R²', 'Stability'], rows: result.results.slice(0, 50).map((ch: any) => [ch.channel, ch.eigenvalue?.toFixed(4) ?? 'N/A', ch.phi1?.toFixed(4) ?? 'N/A', ch.phi2?.toFixed(4) ?? 'N/A', ch.r2?.toFixed(4) ?? 'N/A', ch.stability]) }},
                    ]),
                    { heading: 'Methodology', content: `Engine: ${result.metadata?.engine || 'PAR(2) Discovery Engine'}. Algorithm: ${result.metadata?.algorithm || 'AR(2) OLS regression'}. Equation: y(t) = φ₁·y(t-1) + φ₂·y(t-2) + ε. Eigenvalue equation: λ² - φ₁·λ - φ₂ = 0.` },
                  ]}
                  className="border-slate-200 text-slate-600"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="border-slate-200 text-slate-600"
                  onClick={() => { setResult(null); setFile(null); setControlFile(null); setControlResult(null); setShareUrl(null); }}
                  data-testid="button-new-analysis"
                >
                  New Analysis
                </Button>
              </div>
            </div>

            {result.results.length > 0 && (() => {
              const flags = computeClinicalFlags(result, tissueType);
              const baseline = TISSUE_BASELINES[tissueType] ?? TISSUE_BASELINES['generic'];
              const severityOrder: Record<FlagSeverity, number> = { critical: 3, warning: 2, info: 1, normal: 0 };
              const worstSeverity = flags.reduce<FlagSeverity>((acc, f) => severityOrder[f.severity] > severityOrder[acc] ? f.severity : acc, 'normal');
              const overallStyle = {
                critical: { border: 'border-red-700/60', bg: 'bg-red-950/25', title: 'text-red-300', badge: 'bg-red-900/50 text-red-300 border-red-700/50', icon: 'text-red-400', label: 'Review Required' },
                warning:  { border: 'border-amber-700/50', bg: 'bg-amber-950/20', title: 'text-amber-300', badge: 'bg-amber-900/40 text-amber-300 border-amber-700/50', icon: 'text-amber-400', label: 'Caution' },
                info:     { border: 'border-blue-700/40', bg: 'bg-blue-950/20', title: 'text-blue-300', badge: 'bg-blue-900/40 text-blue-300 border-blue-700/40', icon: 'text-blue-400', label: 'Note' },
                normal:   { border: 'border-green-700/50', bg: 'bg-green-950/20', title: 'text-green-300', badge: 'bg-green-900/40 text-green-300 border-green-700/50', icon: 'text-green-400', label: 'Normal' },
              }[worstSeverity];
              const flagStyle = (s: FlagSeverity) => ({
                critical: { bg: 'bg-red-950/40', border: 'border-red-800/60', label: 'text-red-300', detail: 'text-red-200/80', metric: 'text-red-400', icon: '🔴' },
                warning:  { bg: 'bg-amber-950/30', border: 'border-amber-800/50', label: 'text-amber-300', detail: 'text-amber-100/70', metric: 'text-amber-400', icon: '🟡' },
                info:     { bg: 'bg-blue-950/25', border: 'border-blue-800/40', label: 'text-blue-300', detail: 'text-blue-100/70', metric: 'text-blue-400', icon: 'ℹ️' },
                normal:   { bg: 'bg-green-950/25', border: 'border-green-800/40', label: 'text-green-300', detail: 'text-green-100/70', metric: 'text-green-400', icon: '✅' },
              }[s]);
              return (
                <Card className={`${overallStyle.border} ${overallStyle.bg}`} data-testid="clinical-integrity-report">
                  <CardHeader className="pb-3">
                    <CardTitle className={`text-base flex items-center justify-between gap-3 ${overallStyle.title}`}>
                      <span className="flex items-center gap-2">
                        <ShieldCheck size={16} />
                        Persistence Integrity Report
                      </span>
                      <Badge variant="outline" className={`${overallStyle.badge} text-xs font-semibold`} data-testid="clinical-overall-status">
                        {overallStyle.label}
                      </Badge>
                    </CardTitle>
                    <CardDescription className="text-slate-500 text-xs mt-1">
                      Tissue context: <span className="text-slate-400 font-medium">{baseline.label}</span>
                      {result.perGeneAnalysis && (
                        <> · Clock mean |λ| baseline: <span className="font-mono text-slate-400">{baseline.clockMean.toFixed(3)}</span> · Target baseline: <span className="font-mono text-slate-400">{baseline.targetMean.toFixed(3)}</span> · Expected gap: <span className="font-mono text-slate-400">+{baseline.gap.toFixed(3)}</span></>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2" data-testid="clinical-flags-list">
                      {flags.map((flag, i) => {
                        const s = flagStyle(flag.severity);
                        return (
                          <div key={i} className={`rounded-lg border ${s.border} ${s.bg} px-4 py-3`} data-testid={`clinical-flag-${i}`}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-semibold ${s.label}`}>{s.icon} {flag.label}</p>
                                <p className={`text-xs mt-0.5 leading-relaxed ${s.detail}`}>{flag.detail}</p>
                              </div>
                              <span className={`text-xs font-mono shrink-0 mt-0.5 ${s.metric}`}>{flag.metric}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {result.perGeneAnalysis && (
                      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          { label: 'Clock Mean |λ|', value: result.perGeneAnalysis.clockMeanEigenvalue.toFixed(3), ref: baseline.clockMean.toFixed(3), color: 'text-cyan-400' },
                          { label: 'Target Mean |λ|', value: result.perGeneAnalysis.targetMeanEigenvalue.toFixed(3), ref: baseline.targetMean.toFixed(3), color: 'text-blue-400' },
                          { label: 'Hierarchy Gap', value: (result.perGeneAnalysis.clockMeanEigenvalue - result.perGeneAnalysis.targetMeanEigenvalue) >= 0 ? `+${(result.perGeneAnalysis.clockMeanEigenvalue - result.perGeneAnalysis.targetMeanEigenvalue).toFixed(3)}` : (result.perGeneAnalysis.clockMeanEigenvalue - result.perGeneAnalysis.targetMeanEigenvalue).toFixed(3), ref: `+${baseline.gap.toFixed(3)}`, color: (result.perGeneAnalysis.clockMeanEigenvalue - result.perGeneAnalysis.targetMeanEigenvalue) >= 0 ? 'text-green-400' : 'text-red-400' },
                          { label: 'Clock Genes Found', value: String(result.perGeneAnalysis.clockGenesFound), ref: '13–15', color: 'text-violet-400' },
                        ].map((m, i) => (
                          <div key={i} className="bg-slate-900/60 rounded-lg px-3 py-2 border border-slate-700/40">
                            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">{m.label}</div>
                            <div className={`text-lg font-bold font-mono ${m.color}`} data-testid={`metric-${m.label.replace(/\s+/g, '-').toLowerCase()}`}>{m.value}</div>
                            <div className="text-[10px] text-slate-500">Baseline: {m.ref}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    <p className="text-[10px] text-slate-500 mt-3">
                      This report is for hypothesis generation and research decision support only. Results are not clinically validated and do not constitute a medical diagnosis. Verify independently before any clinical application.
                    </p>
                  </CardContent>
                </Card>
              );
            })()}

            {controlResult && (() => {
              const patientPga = result.perGeneAnalysis;
              const controlPga = controlResult.perGeneAnalysis;
              if (!patientPga || !controlPga) return null;
              const patientGap = patientPga.clockMeanEigenvalue - patientPga.targetMeanEigenvalue;
              const controlGap = controlPga.clockMeanEigenvalue - controlPga.targetMeanEigenvalue;
              const gapChange = patientGap - controlGap;
              const clockDelta = patientPga.clockMeanEigenvalue - controlPga.clockMeanEigenvalue;
              const targetDelta = patientPga.targetMeanEigenvalue - controlPga.targetMeanEigenvalue;
              const patientGenes = new Map(result.results.map(r => [r.channel, r]));
              const differentialGenes = controlResult.results
                .filter(cr => patientGenes.has(cr.channel))
                .map(cr => {
                  const pr = patientGenes.get(cr.channel)!;
                  return { gene: cr.channel, patient: pr.eigenvalue, control: cr.eigenvalue, delta: pr.eigenvalue - cr.eigenvalue, stability: pr.stability };
                })
                .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
                .slice(0, 20);
              return (
                <Card className="border-violet-700/50 bg-violet-950/20" data-testid="differential-report">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base text-violet-300 flex items-center gap-2">
                      <BarChart3 size={16} />
                      Differential Persistence Report
                      <Badge variant="outline" className="bg-violet-900/40 text-violet-300 border-violet-700/50 text-xs ml-1">Patient vs Control</Badge>
                    </CardTitle>
                    <CardDescription className="text-slate-500 text-xs">
                      Patient: <span className="text-slate-400">{result.fileName}</span> · Control: <span className="text-slate-400">{controlResult.fileName}</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      {[
                        { label: 'Hierarchy Gap Change', value: gapChange >= 0 ? `+${gapChange.toFixed(3)}` : gapChange.toFixed(3), color: gapChange < -0.05 ? 'text-red-400' : gapChange < 0 ? 'text-amber-400' : 'text-green-400', detail: 'Patient gap vs control gap' },
                        { label: 'Clock Mean Δ|λ|', value: clockDelta >= 0 ? `+${clockDelta.toFixed(3)}` : clockDelta.toFixed(3), color: 'text-cyan-400', detail: 'Patient clock vs control clock' },
                        { label: 'Target Mean Δ|λ|', value: targetDelta >= 0 ? `+${targetDelta.toFixed(3)}` : targetDelta.toFixed(3), color: 'text-blue-400', detail: 'Patient targets vs control targets' },
                      ].map((m, i) => (
                        <div key={i} className="bg-slate-900/60 rounded-lg px-3 py-2 border border-slate-700/40 text-center">
                          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">{m.label}</div>
                          <div className={`text-xl font-bold font-mono ${m.color}`}>{m.value}</div>
                          <div className="text-[10px] text-slate-500">{m.detail}</div>
                        </div>
                      ))}
                    </div>
                    {differentialGenes.length > 0 && (
                      <div>
                        <p className="text-xs text-slate-500 font-medium mb-2">Top genes by |λ| change (patient − control)</p>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-slate-500 border-b border-slate-700/40">
                                <th className="text-left py-1.5 pr-3">Gene</th>
                                <th className="text-right py-1.5 pr-3">Patient |λ|</th>
                                <th className="text-right py-1.5 pr-3">Control |λ|</th>
                                <th className="text-right py-1.5 pr-3">Δ|λ|</th>
                                <th className="text-right py-1.5">Direction</th>
                              </tr>
                            </thead>
                            <tbody>
                              {differentialGenes.map((g, i) => (
                                <tr key={i} className="border-b border-slate-800/40 hover:bg-slate-800/20">
                                  <td className="py-1.5 pr-3 font-mono text-slate-300">{g.gene}</td>
                                  <td className="py-1.5 pr-3 text-right font-mono text-cyan-400">{g.patient.toFixed(3)}</td>
                                  <td className="py-1.5 pr-3 text-right font-mono text-slate-400">{g.control.toFixed(3)}</td>
                                  <td className={`py-1.5 pr-3 text-right font-mono font-semibold ${g.delta > 0.05 ? 'text-red-400' : g.delta < -0.05 ? 'text-green-400' : 'text-slate-400'}`}>
                                    {g.delta >= 0 ? '+' : ''}{g.delta.toFixed(3)}
                                  </td>
                                  <td className="py-1.5 text-right text-slate-500">{g.delta > 0.02 ? '↑ increased' : g.delta < -0.02 ? '↓ decreased' : '≈ unchanged'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })()}

            {shareUrl && (
              <Alert className="bg-emerald-900/30 border-emerald-700/50">
                <Share2 className="h-4 w-4 text-emerald-400" />
                <AlertTitle className="text-emerald-300">Share Link Created</AlertTitle>
                <AlertDescription className="flex items-center gap-2 mt-1">
                  <code className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600 flex-1 truncate" data-testid="text-share-url">{shareUrl}</code>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-emerald-700 text-emerald-300 shrink-0"
                    onClick={handleCopyLink}
                    data-testid="button-copy-share-link"
                  >
                    {copied ? <Check size={14} className="mr-1" /> : <Copy size={14} className="mr-1" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            <Alert className="bg-amber-950/30 border-amber-800/50" data-testid="alert-disclaimer-banner">
              <ShieldAlert className="h-4 w-4 text-amber-400" />
              <AlertTitle className="text-amber-300">Important: Exploration Tool</AlertTitle>
              <AlertDescription className="text-xs text-slate-500 space-y-1 mt-1">
                <p>These results help you <span className="text-amber-300 font-semibold">generate hypotheses</span> — they show patterns in your data but don't prove cause and effect on their own.</p>
                <p>The same persistence score can mean different things in different biological contexts. <span className="text-amber-300 font-semibold">Always validate</span> with additional experiments or domain knowledge.</p>
                {result.results.some(ch => ch.sampleCount < 20) && (
                  <p className="text-amber-400 font-semibold">Low sample count detected ({result.results.filter(ch => ch.sampleCount < 20).map(ch => `${ch.channel}: ${ch.sampleCount}`).join(', ')}). Results with fewer than 20 timepoints have reduced statistical power and wider confidence intervals.</p>
                )}
              </AlertDescription>
            </Alert>

            {result.dataDomain?.warning && (
              <Alert className={`${result.dataDomain.domain === 'non-biological' ? 'bg-orange-950/40 border-orange-700/60' : 'bg-amber-950/30 border-amber-700/50'}`} data-testid="alert-data-domain">
                <AlertCircle className={`h-4 w-4 ${result.dataDomain.domain === 'non-biological' ? 'text-orange-400' : 'text-amber-400'}`} />
                <AlertTitle className={result.dataDomain.domain === 'non-biological' ? 'text-orange-300' : 'text-amber-300'}>
                  {result.dataDomain.domain === 'non-biological' ? 'Non-Biological Data Detected' : 'Data Domain Uncertain'}
                </AlertTitle>
                <AlertDescription className="text-xs text-slate-600 space-y-2 mt-1">
                  <p>{result.dataDomain.warning}</p>
                  {result.dataDomain.signals.length > 0 && (
                    <details className="text-slate-500">
                      <summary className="cursor-pointer hover:text-slate-600 text-[11px]">Detection signals ({result.dataDomain.signals.length})</summary>
                      <ul className="mt-1 space-y-0.5 text-[11px] pl-3 list-disc">
                        {result.dataDomain.signals.map((s, i) => <li key={i}>{s}</li>)}
                      </ul>
                    </details>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {result.skippedChannels && result.skippedChannels.length > 0 && (
              <Alert className="bg-slate-50 border-slate-200" data-testid="alert-skipped-channels">
                <Info className="h-4 w-4 text-slate-500" />
                <AlertTitle className="text-slate-600">Channels Skipped</AlertTitle>
                <AlertDescription className="text-xs text-slate-500 mt-1">
                  {result.skippedChannels.length} channel(s) had fewer than {result.safeguards?.minimumTimepoints ?? 6} timepoints and were excluded from analysis: {result.skippedChannels.join(', ')}. AR(2) requires a minimum of 6 data points to fit a second-order model reliably.
                </AlertDescription>
              </Alert>
            )}

            {result.results.length === 0 && result.skippedChannels && result.skippedChannels.length > 0 && (
              <Alert className="bg-red-950/30 border-red-800/50" data-testid="alert-no-analyzable">
                <AlertCircle className="h-4 w-4 text-red-400" />
                <AlertTitle className="text-red-300">No Analyzable Channels</AlertTitle>
                <AlertDescription className="text-xs text-slate-500 mt-1">
                  All data channels were excluded because they had fewer than {result.safeguards?.minimumTimepoints ?? 6} timepoints. AR(2) modeling requires at least 6 sequential measurements. Please provide data with more timepoints per channel.
                </AlertDescription>
              </Alert>
            )}

            {result.results.length > 0 && result.results.every(ch => ch.r2 < 0.1) && !result.perGeneAnalysis && (
              <Alert className="bg-red-950/30 border-red-800/50" data-testid="alert-negative-result">
                <AlertCircle className="h-4 w-4 text-red-400" />
                <AlertTitle className="text-red-300">Negative Result Flag</AlertTitle>
                <AlertDescription className="text-xs text-slate-500 mt-1">
                  All channels show R² {"<"} 0.10, meaning the AR(2) model explains very little variance in this data. This is a legitimate and informative negative result — it suggests that second-order autoregressive dynamics are not the dominant pattern in this dataset. Consider alternative models or that the data may lack sufficient temporal structure.
                </AlertDescription>
              </Alert>
            )}

            {result.dataWarnings && result.dataWarnings.length > 0 && (
              <div className="space-y-2" data-testid="data-warnings">
                {result.dataWarnings.map((w, i) => (
                  <Alert key={i} className={
                    w.severity === 'error' ? 'bg-red-950/30 border-red-800/50' :
                    w.severity === 'warning' ? 'bg-amber-950/30 border-amber-800/50' :
                    'bg-blue-950/30 border-blue-800/50'
                  } data-testid={`warning-${w.type}`}>
                    <AlertCircle className={`h-4 w-4 ${
                      w.severity === 'error' ? 'text-red-400' :
                      w.severity === 'warning' ? 'text-amber-400' :
                      'text-blue-400'
                    }`} />
                    <AlertTitle className={
                      w.severity === 'error' ? 'text-red-300' :
                      w.severity === 'warning' ? 'text-amber-300' :
                      'text-blue-300'
                    }>
                      {w.type === 'duplicate_genes' ? 'Duplicate Genes Detected' :
                       w.type === 'constant_genes' ? 'Constant Expression Genes Excluded' :
                       w.type === 'corrupted_rows' ? 'Corrupted Data Rows Excluded' :
                       w.type === 'outlier_genes' ? 'Outlier Values Detected' :
                       'Data Quality Notice'}
                    </AlertTitle>
                    <AlertDescription className="text-xs text-slate-500 mt-1">
                      {w.message}
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            )}

            {result.parsingValidation && (
              <Card className={`${result.parsingValidation.dataReliable ? 'bg-white border-slate-200' : 'bg-red-950/30 border-red-700/50'}`} data-testid="parsing-validation">
                <CardContent className="pt-4 pb-3">
                  <details>
                    <summary className="cursor-pointer flex items-center gap-2 text-sm">
                      {result.parsingValidation.dataReliable ? (
                        <Badge className="bg-green-600/20 text-green-400 border-green-600/30 text-xs">
                          <ShieldCheck size={10} className="mr-1" />
                          Data Integrity Verified
                        </Badge>
                      ) : (
                        <Badge className="bg-red-600/20 text-red-400 border-red-600/30 text-xs">
                          <AlertCircle size={10} className="mr-1" />
                          Data Integrity Warning
                        </Badge>
                      )}
                      <span className="text-xs text-slate-500">{result.parsingValidation.summary}</span>
                    </summary>
                    <div className="mt-3 space-y-2">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center mb-3">
                        <div className="bg-slate-50 rounded px-2 py-1.5">
                          <div className="text-sm font-medium text-slate-900">{result.parsingValidation.formatDetected}</div>
                          <div className="text-[10px] text-slate-500">Format Detected</div>
                        </div>
                        <div className="bg-slate-50 rounded px-2 py-1.5">
                          <div className="text-sm font-medium text-cyan-400">{result.parsingValidation.columnsFound}</div>
                          <div className="text-[10px] text-slate-500">Columns Found</div>
                        </div>
                        <div className="bg-slate-50 rounded px-2 py-1.5">
                          <div className="text-sm font-medium text-slate-900">{result.parsingValidation.channelsAnalyzed}</div>
                          <div className="text-[10px] text-slate-500">Channels Analyzed</div>
                        </div>
                        <div className="bg-slate-50 rounded px-2 py-1.5">
                          <div className="text-sm font-medium text-slate-900">{result.parsingValidation.rowsRead.toLocaleString()}</div>
                          <div className="text-[10px] text-slate-500">Data Points</div>
                        </div>
                      </div>
                      {result.parsingValidation.checks.map((check, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs">
                          <span className={`mt-0.5 flex-shrink-0 ${check.passed ? 'text-green-400' : 'text-red-400'}`}>
                            {check.passed ? '✓' : '✗'}
                          </span>
                          <div>
                            <span className="text-slate-600 font-medium">{check.test}:</span>
                            <span className="text-slate-500 ml-1">{check.detail}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                </CardContent>
              </Card>
            )}

            {result.perGeneAnalysis && (
              <Card className="bg-emerald-950/30 border-emerald-700/50" data-testid="per-gene-summary">
                <CardContent className="pt-5 space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className="bg-emerald-600/30 text-emerald-400 border-emerald-600/40">Gene Expression Matrix Detected</Badge>
                    <span className="text-xs text-slate-500">Per-gene AR(2) eigenvalue analysis</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                    <div className="bg-slate-50 rounded-lg p-3">
                      <div className="text-xl font-bold text-slate-900" data-testid="text-total-genes">{result.perGeneAnalysis.totalGenes.toLocaleString()}</div>
                      <div className="text-xs text-slate-500">Genes Analyzed</div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <div className="text-xl font-bold text-cyan-400" data-testid="text-timepoints">{result.perGeneAnalysis.timepointCount}</div>
                      <div className="text-xs text-slate-500">Time Points</div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <div className="text-xl font-bold text-amber-400" data-testid="text-clock-genes">{result.perGeneAnalysis.clockGenesFound}</div>
                      <div className="text-xs text-slate-500">Clock Genes Found</div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <div className="text-xl font-bold text-emerald-400" data-testid="text-hierarchy-gap">
                        {(result.perGeneAnalysis.targetMeanEigenvalue - result.perGeneAnalysis.clockMeanEigenvalue).toFixed(3)}
                      </div>
                      <div className="text-xs text-slate-500">Clock→Target Gap</div>
                    </div>
                  </div>
                  {result.perGeneAnalysis.bottomByEigenvalue.length === 0 ? (
                    <div>
                      <h4 className="font-semibold text-slate-600 mb-2">All Genes (ranked by persistence)</h4>
                      <div className="space-y-1 text-xs">
                        {result.perGeneAnalysis.topByEigenvalue.map((g, i) => (
                          <div key={i} className="flex justify-between items-center bg-slate-50 rounded px-2 py-1">
                            <span className="text-slate-500 w-5">{i + 1}.</span>
                            <span className={`flex-1 ${g.geneType === 'clock' ? 'text-cyan-400 font-medium' : 'text-slate-600'}`}><GeneTooltip gene={g.gene}>{g.gene}</GeneTooltip></span>
                            <span className="text-slate-500">|λ| = {g.eigenvalue.toFixed(4)}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-slate-500 mt-2 italic">Dataset has {result.perGeneAnalysis.totalGenes ?? result.perGeneAnalysis.topByEigenvalue.length} genes — all shown above. Top/bottom split requires more than 20 genes.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div>
                        <h4 className="font-semibold text-slate-600 mb-2">Highest Persistence (Top {Math.min(20, result.perGeneAnalysis.topByEigenvalue.length)})</h4>
                        <div className="space-y-1">
                          {result.perGeneAnalysis.topByEigenvalue.slice(0, 10).map((g, i) => (
                            <div key={i} className="flex justify-between items-center bg-slate-50 rounded px-2 py-1">
                              <span className={g.geneType === 'clock' ? 'text-cyan-400 font-medium' : 'text-slate-600'}><GeneTooltip gene={g.gene}>{g.gene}</GeneTooltip></span>
                              <span className="text-slate-500">|λ| = {g.eigenvalue.toFixed(4)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-600 mb-2">Lowest Persistence (Bottom {result.perGeneAnalysis.bottomByEigenvalue.length})</h4>
                        <div className="space-y-1">
                          {result.perGeneAnalysis.bottomByEigenvalue.slice(0, 10).map((g, i) => (
                            <div key={i} className="flex justify-between items-center bg-slate-50 rounded px-2 py-1">
                              <span className={g.geneType === 'clock' ? 'text-cyan-400 font-medium' : 'text-slate-600'}><GeneTooltip gene={g.gene}>{g.gene}</GeneTooltip></span>
                              <span className="text-slate-500">|λ| = {g.eigenvalue.toFixed(4)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  {result.perGeneAnalysis.clockGenesFound > 0 && (
                    <div className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3">
                      <span className="text-cyan-400">Clock genes</span> mean |λ| = {result.perGeneAnalysis.clockMeanEigenvalue.toFixed(4)} vs all other genes mean |λ| = {result.perGeneAnalysis.targetMeanEigenvalue.toFixed(4)}
                      {result.perGeneAnalysis.targetMeanEigenvalue > result.perGeneAnalysis.clockMeanEigenvalue
                        ? ' — Clock < Target hierarchy confirmed (clock genes have lower persistence, consistent with faster-cycling regulatory role)'
                        : ' — Hierarchy not confirmed in this dataset'}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {result.biasAudit && (
              <Card className="bg-white border-slate-200" data-testid="bias-audit-card">
                <CardContent className="pt-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke={result.biasAudit.overallColor} strokeWidth="2"><path d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <h3 className="font-bold text-slate-900 text-lg">Bias Audit</h3>
                    </div>
                    <Badge className="text-xs" style={{ backgroundColor: result.biasAudit.overallColor + '20', color: result.biasAudit.overallColor, borderColor: result.biasAudit.overallColor }} data-testid="bias-audit-summary">
                      {result.biasAudit.summary}
                    </Badge>
                  </div>
                  <p className="text-sm mb-4" style={{ color: result.biasAudit.overallColor }}>{result.biasAudit.overallVerdict}</p>
                  <div className="space-y-4">
                    {result.biasAudit.tests.map((test, tIdx) => (
                      <div key={tIdx} className={`rounded-lg p-4 border ${test.passed ? 'border-green-800/50 bg-green-950/20' : 'border-amber-800/50 bg-amber-950/20'}`} data-testid={`bias-test-${tIdx}`}>
                        <div className="flex items-start gap-2 mb-2">
                          <span className={`text-lg mt-0.5 ${test.passed ? 'text-green-400' : 'text-amber-400'}`}>{test.passed ? '✓' : '⚠'}</span>
                          <div className="flex-1">
                            <h4 className="font-semibold text-slate-900 text-sm">{test.testName}</h4>
                            <p className="text-xs text-slate-500 mt-1">{test.description}</p>
                          </div>
                        </div>
                        <p className={`text-xs mt-2 ${test.passed ? 'text-green-300' : 'text-amber-300'}`}>{test.verdict}</p>
                        {test.details && (
                          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {Object.entries(test.details).filter(([, v]) => typeof v !== 'object').map(([key, value]) => (
                              <div key={key} className="bg-slate-100 rounded px-2 py-1">
                                <div className="text-[10px] text-slate-500">{key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</div>
                                <div className="text-xs text-slate-600 font-mono">{typeof value === 'number' ? value.toFixed?.(4) ?? value : String(value)}</div>
                              </div>
                            ))}
                            {test.details.correlations && (
                              <div className="col-span-full mt-1">
                                <div className="text-[10px] text-slate-500 mb-1">Spearman Correlations with Eigenvalue</div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                                  {(test.details.correlations as any[]).map((c: any, ci: number) => (
                                    <div key={ci} className="flex justify-between items-center bg-slate-100 rounded px-2 py-1">
                                      <span className="text-[10px] text-slate-500">{c.metric}</span>
                                      <span className={`text-xs font-mono ${Math.abs(c.spearmanRho) > 0.4 ? 'text-amber-400' : Math.abs(c.spearmanRho) > 0.15 ? 'text-yellow-400' : 'text-green-400'}`}>
                                        ρ = {c.spearmanRho.toFixed(3)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {result.results.length > 0 && (
              <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 px-1" data-testid="persistence-legend">
                <span className="font-medium text-slate-600">{result.perGeneAnalysis ? 'Top genes by persistence:' : 'Persistence scale:'}</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-500" /> Low (fades quickly)</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-yellow-400" /> Moderate (lingers)</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-orange-500" /> High (persistent)</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500" /> Near-critical (very slow decay)</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {result.results.map((ch, idx) => (
                  <Card key={idx} className="bg-white border-slate-200">
                    <CardContent className="pt-5">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-bold text-slate-900 text-base" data-testid={`text-channel-name-${idx}`}>{ch.channel}</h3>
                          <p className="text-xs text-slate-500">{ch.sampleCount} samples | {ch.unit}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge
                            className="text-xs"
                            style={{ backgroundColor: `${ch.stabilityColor}20`, color: ch.stabilityColor, borderColor: `${ch.stabilityColor}40` }}
                            variant="outline"
                          >
                            {ch.stability}
                          </Badge>
                          {ch.overallConfidence && (
                            <Badge
                              className="text-xs gap-1"
                              style={{ backgroundColor: `${ch.confidenceColor}15`, color: ch.confidenceColor, borderColor: `${ch.confidenceColor}30` }}
                              variant="outline"
                              data-testid={`badge-confidence-${idx}`}
                            >
                              {ch.overallConfidence === 'High' ? <ShieldCheck size={10} /> : <ShieldAlert size={10} />}
                              {ch.overallConfidence} ({ch.confidenceScore}%)
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-center mb-4">
                        <StabilityRing eigenvalue={ch.eigenvalue} size={140} label={ch.channel} />
                      </div>

                      {ch.mean !== 0 && Math.abs(ch.std / ch.mean) < 0.05 && (
                        <div className="flex items-center gap-1.5 mb-3 px-2 py-1.5 rounded bg-amber-500/10 border border-amber-500/20" data-testid={`warning-low-amplitude-${idx}`}>
                          <AlertCircle size={12} className="text-amber-400 shrink-0" />
                          <span className="text-[11px] text-amber-400">Low response amplitude — eigenvalue may be less informative</span>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-slate-50 rounded p-2">
                          <span className="text-slate-500"><Term>phi1</Term> (recent influence)</span>
                          <div className="font-mono text-slate-900" data-testid={`text-phi1-${idx}`}>{ch.phi1.toFixed(4)}</div>
                        </div>
                        <div className="bg-slate-50 rounded p-2">
                          <span className="text-slate-500"><Term>phi2</Term> (older influence)</span>
                          <div className="font-mono text-slate-900" data-testid={`text-phi2-${idx}`}>{ch.phi2.toFixed(4)}</div>
                        </div>
                        <div className="bg-slate-50 rounded p-2">
                          <span className="text-slate-500"><Term>R-squared</Term> (model fit)</span>
                          <div className="font-mono text-slate-900" data-testid={`text-r2-${idx}`}>{ch.r2 != null ? ch.r2.toFixed(4) : 'N/A'}</div>
                        </div>
                        <div className="bg-slate-50 rounded p-2">
                          <span className="text-slate-500"><Term>Ljung-Box</Term> (fit quality)</span>
                          <div className={`font-mono ${ch.ljungBoxPassed ? 'text-green-400' : 'text-amber-400'}`} data-testid={`text-ljung-${idx}`}>
                            {ch.ljungBoxPassed ? 'PASS' : 'FAIL'} (p={ch.ljungBoxPValue.toFixed(3)})
                          </div>
                        </div>
                        {ch.halfLife != null && (
                          <div className="bg-slate-50 rounded p-2">
                            <span className="text-slate-500"><Term>half-life</Term> (expression persistence)</span>
                            <div className="font-mono text-emerald-400" data-testid={`text-halflife-${idx}`}>{ch.halfLife.toFixed(1)} steps</div>
                          </div>
                        )}
                        {ch.isComplex && ch.impliedPeriod && (
                          <div className="bg-slate-50 rounded p-2">
                            <span className="text-slate-500"><Term>implied period</Term> (cycle length)</span>
                            <div className="font-mono text-cyan-400">{ch.impliedPeriod.toFixed(1)} time units</div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              </div>
            )}

            {result.gearboxAnalysis && result.dataDomain?.domain !== 'non-biological' && (
              <Card className="bg-gradient-to-r from-slate-900 to-slate-900/80 border-slate-200">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Target size={18} className="text-amber-400" />
                    Persistence Hierarchy
                  </CardTitle>
                  <CardDescription className="text-slate-500">
                    Does one channel persist longer than the other? In healthy circadian systems, the "clock" signal should outlast the "target" signal — like a conductor leading an orchestra.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <Clock size={16} className="text-blue-400" />
                        <span className="text-sm text-slate-500">Clock Proxy</span>
                      </div>
                      <StabilityRing eigenvalue={result.gearboxAnalysis.clockEigenvalue} size={120} label={result.gearboxAnalysis.clockChannel} />
                    </div>

                    <div className="text-center space-y-3">
                      <div className="text-3xl font-bold" style={{ color: result.gearboxAnalysis.hierarchyColor }} data-testid="text-gearbox-gap">
                        {result.gearboxAnalysis.gap >= 0 ? '+' : ''}{result.gearboxAnalysis.gap.toFixed(3)}
                      </div>
                      <div className="text-sm font-medium" style={{ color: result.gearboxAnalysis.hierarchyColor }} data-testid="text-gearbox-status">
                        {result.gearboxAnalysis.hierarchyStatus}
                      </div>
                      <div className="flex items-center justify-center gap-1">
                        <div className="h-1 flex-1 rounded-full" style={{ backgroundColor: `${result.gearboxAnalysis.hierarchyColor}40` }}>
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.min(100, Math.abs(result.gearboxAnalysis.gap) * 200)}%`,
                              backgroundColor: result.gearboxAnalysis.hierarchyColor
                            }}
                          />
                        </div>
                      </div>
                      {result.gearboxAnalysis.gapUncertainty != null && (
                        <p className="text-xs text-slate-500 font-mono">
                          ±{result.gearboxAnalysis.gapUncertainty.toFixed(3)}
                          {result.gearboxAnalysis.gapReliable === false && (
                            <span className="text-amber-400 ml-1">(uncertain)</span>
                          )}
                        </p>
                      )}
                      <p className="text-xs text-slate-500">
                        Healthy gap: +0.22 to +0.39 (manuscript reference)
                      </p>
                    </div>

                    <div className="text-center">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <Target size={16} className="text-orange-400" />
                        <span className="text-sm text-slate-500">Target Proxy</span>
                      </div>
                      <StabilityRing eigenvalue={result.gearboxAnalysis.targetEigenvalue} size={120} label={result.gearboxAnalysis.targetChannel} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Tabs defaultValue="quality" className="w-full">
              <TabsList className="bg-slate-100 border border-slate-200">
                <TabsTrigger value="quality" data-testid="tab-quality" className="gap-1">
                  <ShieldCheck size={14} />
                  Quality Checks
                </TabsTrigger>
                <TabsTrigger value="timeseries" data-testid="tab-timeseries">Raw Data</TabsTrigger>
                <TabsTrigger value="statespace" data-testid="tab-statespace">Dynamics Map</TabsTrigger>
                <TabsTrigger value="unitcircle" data-testid="tab-unitcircle">Unit Circle</TabsTrigger>
                <TabsTrigger value="residuals" data-testid="tab-residuals">Model Fit</TabsTrigger>
                <TabsTrigger value="acf" data-testid="tab-acf">Pattern Check</TabsTrigger>
              </TabsList>

              <TabsContent value="quality">
                <Card className="bg-white border-slate-200">
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ShieldCheck size={16} className="text-cyan-400" />
                      How Trustworthy Are These Results?
                    </CardTitle>
                    <CardDescription className="text-slate-500">
                      Seven independent checks test whether the results are reliable or might be misleading.
                      Each check contributes to an overall confidence score (0–100).
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {result.results.map((ch, idx) => (
                      <div key={idx} className="border border-slate-200 rounded-lg p-4" data-testid={`quality-panel-${idx}`}>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <h3 className="font-bold text-slate-900">{ch.channel}</h3>
                            <span className="text-xs text-slate-500">({ch.sampleCount} samples)</span>
                          </div>
                          {ch.overallConfidence && (
                            <div className="flex items-center gap-2">
                              <div className="text-right">
                                <div className="text-xs text-slate-500">Confidence</div>
                                <div className="font-bold text-lg" style={{ color: ch.confidenceColor }} data-testid={`text-confidence-${idx}`}>
                                  {ch.overallConfidence}
                                </div>
                              </div>
                              <div className="relative w-12 h-12">
                                <svg viewBox="0 0 36 36" className="w-12 h-12 -rotate-90">
                                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#334155" strokeWidth="3" />
                                  <circle cx="18" cy="18" r="15.9" fill="none" stroke={ch.confidenceColor}
                                    strokeWidth="3" strokeDasharray={`${(ch.confidenceScore || 0)} ${100 - (ch.confidenceScore || 0)}`}
                                    strokeLinecap="round" />
                                </svg>
                                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold" style={{ color: ch.confidenceColor }}>
                                  {ch.confidenceScore}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        {ch.qualityChecks && ch.qualityChecks.length > 0 && (
                          <div className="space-y-2">
                            {ch.qualityChecks.map((qc, qIdx) => (
                              <div key={qIdx} className={`rounded-lg p-3 border ${
                                qc.severity === 'critical' ? 'bg-red-950/30 border-red-900/50' :
                                qc.severity === 'warning' ? 'bg-amber-950/30 border-amber-900/50' :
                                'bg-slate-50 border-slate-200'
                              }`} data-testid={`quality-check-${idx}-${qIdx}`}>
                                <div className="flex items-start gap-3">
                                  <div className="mt-0.5">
                                    {qc.passed ? (
                                      <CheckCircle2 size={16} className="text-green-400" />
                                    ) : qc.severity === 'critical' ? (
                                      <ShieldAlert size={16} className="text-red-400" />
                                    ) : (
                                      <AlertCircle size={16} className="text-amber-400" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-sm font-medium text-slate-900">{qc.name}</span>
                                      <span className={`text-xs font-mono px-2 py-0.5 rounded ${
                                        qc.passed ? 'bg-green-900/30 text-green-400' :
                                        qc.severity === 'critical' ? 'bg-red-900/30 text-red-400' :
                                        'bg-amber-900/30 text-amber-400'
                                      }`}>
                                        {qc.value}
                                      </span>
                                    </div>
                                    <p className="text-xs text-slate-500 leading-relaxed">{qc.explanation}</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {ch.edgeCaseDiagnostics && ch.edgeCaseDiagnostics.some(d => d.triggered) && (
                          <div className="mt-3 space-y-2">
                            <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                              <ShieldAlert size={12} />
                              Edge Case Warnings
                            </h4>
                            {ch.edgeCaseDiagnostics.filter(d => d.triggered).map((d, dIdx) => (
                              <div key={dIdx} className={`rounded-lg p-3 border ${
                                d.severity === 'critical' ? 'bg-red-950/30 border-red-900/50' :
                                'bg-amber-950/30 border-amber-900/50'
                              }`} data-testid={`edge-case-${idx}-${d.id}`}>
                                <div className="flex items-start gap-3">
                                  <div className="mt-0.5">
                                    {d.severity === 'critical' ? (
                                      <ShieldAlert size={16} className="text-red-400" />
                                    ) : (
                                      <AlertCircle size={16} className="text-amber-400" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <span className="text-sm font-medium text-slate-900">{d.label}</span>
                                    <p className="text-xs text-slate-500 leading-relaxed mt-1">{d.detail}</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {ch.overallConfidence && (
                          <div className={`mt-4 p-3 rounded-lg border ${
                            ch.overallConfidence === 'High' ? 'bg-green-950/20 border-green-900/40' :
                            ch.overallConfidence === 'Moderate' ? 'bg-yellow-950/20 border-yellow-900/40' :
                            ch.overallConfidence === 'Low' ? 'bg-orange-950/20 border-orange-900/40' :
                            'bg-red-950/20 border-red-900/40'
                          }`}>
                            <div className="flex items-start gap-2">
                              {ch.overallConfidence === 'High' ? (
                                <ShieldCheck size={16} className="text-green-400 mt-0.5" />
                              ) : (
                                <ShieldAlert size={16} className={`mt-0.5 ${
                                  ch.overallConfidence === 'Moderate' ? 'text-yellow-400' :
                                  ch.overallConfidence === 'Low' ? 'text-orange-400' : 'text-red-400'
                                }`} />
                              )}
                              <p className="text-xs text-slate-600">
                                {ch.overallConfidence === 'High' && 'All major quality checks passed. This eigenvalue estimate is reliable and unlikely to be an artifact.'}
                                {ch.overallConfidence === 'Moderate' && 'Most quality checks passed, but some minor concerns exist. The eigenvalue estimate is likely meaningful, but interpret with some caution.'}
                                {ch.overallConfidence === 'Low' && 'Several quality checks flagged issues. The eigenvalue estimate may be affected by data quality problems. Consider collecting more data or preprocessing.'}
                                {ch.overallConfidence === 'Unreliable' && 'Critical quality issues detected. The eigenvalue estimate is likely unreliable and may be an artifact of data problems. Do not draw conclusions from this result.'}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="timeseries">
                <Card className="bg-white border-slate-200">
                  <CardHeader>
                    <CardTitle className="text-sm">Your Raw Data Over Time</CardTitle>
                    <CardDescription className="text-slate-500 text-xs">
                      Each chart shows the original measurements for one channel, plotted in order. Look for repeating patterns or trends.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {result.results.map((ch, idx) => (
                      <div key={idx} className="mb-6">
                        <h4 className="text-xs font-medium text-slate-500 mb-2">{ch.channel} ({ch.unit})</h4>
                        <ResponsiveContainer width="100%" height={180} minWidth={1} minHeight={1}>
                          <LineChart data={ch.timeSeriesPreview.map((v, i) => ({ t: i, value: v }))}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis dataKey="t" tick={{ fill: '#64748b', fontSize: 10 }} />
                            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} domain={['auto', 'auto']} />
                            <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: '11px' }} />
                            <Line type="monotone" dataKey="value" stroke={ch.stabilityColor} dot={false} strokeWidth={1.5} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="statespace">
                <Card className="bg-white border-slate-200">
                  <CardHeader>
                    <CardTitle className="text-sm">Dynamics Map</CardTitle>
                    <CardDescription className="text-slate-500 text-xs">
                      Each dot is one of your channels. Position shows its behaviour: inside the dashed triangle = stable, above the gold curve = oscillating.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <StateSpacePlot results={result.results} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="unitcircle">
                <UnitCirclePlot results={result.results} />
              </TabsContent>

              <TabsContent value="residuals">
                <Card className="bg-white border-slate-200">
                  <CardHeader>
                    <CardTitle className="text-sm">Model Fit — What the Model Missed</CardTitle>
                    <CardDescription className="text-slate-500 text-xs">
                      These bars show the leftover patterns after the model's predictions are subtracted. Random-looking bars = good fit.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {result.results.map((ch, idx) => (
                      <div key={idx} className="mb-6">
                        <h4 className="text-xs font-medium text-slate-500 mb-2">
                          {ch.channel} residuals {ch.ljungBoxPassed ?
                            <span className="text-green-400 ml-2">White noise (good fit)</span> :
                            <span className="text-amber-400 ml-2">Autocorrelated (poor fit)</span>
                          }
                        </h4>
                        <ResponsiveContainer width="100%" height={150} minWidth={1} minHeight={1}>
                          <BarChart data={ch.residuals.map((v, i) => ({ t: i, residual: v }))}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis dataKey="t" tick={{ fill: '#64748b', fontSize: 10 }} />
                            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                            <ReferenceLine y={0} stroke="#64748b" />
                            <Bar dataKey="residual" fill={ch.ljungBoxPassed ? '#22c55e40' : '#f9731640'} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="acf">
                <Card className="bg-white border-slate-200">
                  <CardHeader>
                    <CardTitle className="text-sm">Pattern Check — Any Leftover Structure?</CardTitle>
                    <CardDescription className="text-slate-500 text-xs">
                      Tests if any repeating patterns remain after the model. Bars inside the dashed lines = the model captured everything. Red bars = missed patterns.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {result.results.map((ch, idx) => {
                      const confBound = 1.96 / Math.sqrt(ch.sampleCount);
                      return (
                        <div key={idx} className="mb-6">
                          <h4 className="text-xs font-medium text-slate-500 mb-2">{ch.channel}</h4>
                          <ResponsiveContainer width="100%" height={150} minWidth={1} minHeight={1}>
                            <BarChart data={ch.acf.map((v, i) => ({ lag: i + 1, acf: v }))}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                              <XAxis dataKey="lag" tick={{ fill: '#64748b', fontSize: 10 }} label={{ value: 'Lag', position: 'bottom', fill: '#64748b', fontSize: 10 }} />
                              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} domain={[-0.5, 0.5]} />
                              <ReferenceLine y={confBound} stroke="#64748b" strokeDasharray="5 5" label={{ value: '95% CI', fill: '#64748b', fontSize: 9 }} />
                              <ReferenceLine y={-confBound} stroke="#64748b" strokeDasharray="5 5" />
                              <ReferenceLine y={0} stroke="#475569" />
                              <Bar dataKey="acf">
                                {ch.acf.map((v, i) => (
                                  <Cell key={i} fill={Math.abs(v) > confBound ? '#ef4444' : '#22c55e80'} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <Card className="bg-white border-slate-200">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2 text-slate-600">
                  <BarChart3 size={14} className="text-slate-500" />
                  Persistence Score Comparison
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={result.results.map(r => ({
                    channel: r.channel,
                    eigenvalue: r.eigenvalue,
                    color: r.stabilityColor
                  }))} layout="vertical" margin={{ left: 100 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis type="number" domain={[0, 1.1]} tick={{ fill: '#64748b', fontSize: 11 }} />
                    <YAxis type="category" dataKey="channel" tick={{ fill: '#64748b', fontSize: 11 }} width={90} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
                    <ReferenceLine x={0.7} stroke="#facc15" strokeDasharray="5 5" label={{ value: "Moderate", fill: '#facc1580', fontSize: 10 }} />
                    <ReferenceLine x={1.0} stroke="#ef4444" strokeDasharray="5 5" label={{ value: "Unstable", fill: '#ef444480', fontSize: 10 }} />
                    <Bar dataKey="eigenvalue" radius={[0, 4, 4, 0]}>
                      {result.results.map((r, i) => (
                        <Cell key={i} fill={r.stabilityColor} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200">
              <CardHeader
                className="cursor-pointer select-none py-3"
                onClick={() => setTechDetailsExpanded(e => !e)}
              >
                <CardTitle className="text-xs flex items-center justify-between text-slate-500">
                  <span className="flex items-center gap-2">
                    <Info size={12} className="text-slate-500" />
                    Technical details
                  </span>
                  {techDetailsExpanded ? <ChevronUp size={12} className="text-slate-600" /> : <ChevronDown size={12} className="text-slate-600" />}
                </CardTitle>
              </CardHeader>
              {techDetailsExpanded && (
                <CardContent className="pt-0 pb-3">
                  <div className="flex items-start gap-3 text-xs text-slate-500">
                    <div>
                      <p className="mb-1"><strong className="text-slate-500">Engine:</strong> {result.metadata.engine}</p>
                      <p className="mb-1"><strong className="text-slate-500">Algorithm:</strong> {result.metadata.algorithm}</p>
                      <p className="mb-1"><strong className="text-slate-500">Model:</strong> {result.metadata.equation}</p>
                      <p><strong className="text-slate-500">Eigenvalue:</strong> {result.metadata.eigenvalueEquation}</p>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
