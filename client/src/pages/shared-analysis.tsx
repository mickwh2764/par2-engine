import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, ReferenceLine
} from "recharts";
import {
  Activity, Loader2, AlertCircle, ArrowLeft, Clock, Target,
  Share2, ShieldCheck, ShieldAlert
} from "lucide-react";
import { Link, useParams } from "wouter";

interface ChannelResult {
  channel: string;
  unit: string;
  sampleCount: number;
  phi1: number;
  phi2: number;
  eigenvalue: number;
  r2: number;
  isComplex: boolean;
  impliedPeriod: number | null;
  mean: number;
  std: number;
  min: number;
  max: number;
  stability: string;
  stabilityColor: string;
  ljungBox?: { statistic: number; pValue: number; isWhiteNoise: boolean; lags: number };
  edgeCaseDiagnostics?: { id: string; label: string; triggered: boolean; severity: string; detail: string }[];
  confidenceScore?: number;
}

interface GearboxAnalysis {
  hierarchy: { channel: string; eigenvalue: number; role: string }[];
  gap: number;
  hierarchyPreserved: boolean;
  interpretation: string;
}

interface SharedData {
  id: string;
  fileName: string;
  detectedFormat: string;
  createdAt: string;
  analysisData: {
    detectedFormat: string;
    fileName: string;
    fileSize: number;
    totalRecords: number;
    channelsAnalyzed: number;
    results: ChannelResult[];
    gearboxAnalysis: GearboxAnalysis | null;
    metadata: {
      engine: string;
      algorithm: string;
      timestamp: string;
    };
  };
}

export default function SharedAnalysis() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<SharedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/shared-analysis/${params.id}`);
        if (!res.ok) {
          if (res.status === 404) throw new Error('This shared analysis was not found or may have expired.');
          throw new Error('Failed to load shared analysis');
        }
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-400 mx-auto mb-3" />
          <p className="text-slate-500">Loading shared analysis...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 p-6">
        <div className="max-w-2xl mx-auto mt-20">
          <Alert className="bg-red-900/30 border-red-700/50">
            <AlertCircle className="h-4 w-4 text-red-400" />
            <AlertTitle className="text-red-300">Analysis Not Found</AlertTitle>
            <AlertDescription className="text-red-200/70">
              {error || 'This shared analysis could not be loaded.'}
            </AlertDescription>
          </Alert>
          <div className="mt-4 text-center">
            <Link href="/discovery-engine">
              <Button variant="outline" className="border-slate-200 text-slate-600">
                <ArrowLeft size={14} className="mr-1" />
                Go to Discovery Engine
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const result = data.analysisData;

  const eigenvalueBarData = result.results.map(ch => ({
    channel: ch.channel,
    eigenvalue: +ch.eigenvalue.toFixed(4),
    color: ch.stabilityColor,
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/discovery-engine">
            <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-700" data-testid="link-back-discovery">
              <ArrowLeft size={16} className="mr-1" />
              Discovery Engine
            </Button>
          </Link>
        </div>

        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Share2 className="h-5 w-5 text-cyan-400" />
              <h1 className="text-2xl font-bold text-slate-900" data-testid="text-shared-title">Shared Analysis</h1>
            </div>
            <p className="text-slate-500 text-sm">
              File: <span className="text-slate-600" data-testid="text-shared-filename">{data.fileName}</span>
              {' | '}Format: <span className="text-slate-600">{data.detectedFormat}</span>
              {' | '}Shared: <span className="text-slate-600">{new Date(data.createdAt).toLocaleDateString()}</span>
            </p>
          </div>
          <Badge className="bg-cyan-900/30 text-cyan-300 border-cyan-700/50">
            {result.metadata?.engine || 'PAR(2) Engine'}
          </Badge>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Card className="bg-white border-slate-200">
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-2xl font-bold text-slate-900" data-testid="text-total-records">{result.totalRecords?.toLocaleString()}</p>
              <p className="text-xs text-slate-500">Total Records</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-slate-200">
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-2xl font-bold text-slate-900" data-testid="text-channels-count">{result.channelsAnalyzed}</p>
              <p className="text-xs text-slate-500">Channels</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-slate-200">
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-2xl font-bold text-slate-900">{result.fileSize ? (result.fileSize / 1024).toFixed(1) + ' KB' : '-'}</p>
              <p className="text-xs text-slate-500">File Size</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-slate-200">
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-2xl font-bold text-slate-900">{data.detectedFormat}</p>
              <p className="text-xs text-slate-500">Format</p>
            </CardContent>
          </Card>
        </div>

        {result.results.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {result.results.map((ch, idx) => (
              <Card key={idx} className="bg-white border-slate-200">
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-slate-900 text-base" data-testid={`text-shared-channel-${idx}`}>{ch.channel}</h3>
                      <p className="text-xs text-slate-500">{ch.sampleCount} samples | {ch.unit}</p>
                    </div>
                    <Badge
                      className="text-xs"
                      style={{ backgroundColor: `${ch.stabilityColor}20`, color: ch.stabilityColor, borderColor: `${ch.stabilityColor}40` }}
                    >
                      {ch.stability}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">|λ| Eigenvalue</span>
                      <span className="font-mono font-bold text-slate-900">{ch.eigenvalue.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">φ₁ (AR coeff)</span>
                      <span className="font-mono text-slate-600">{ch.phi1.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">φ₂ (AR coeff)</span>
                      <span className="font-mono text-slate-600">{ch.phi2.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">R²</span>
                      <span className="font-mono text-slate-600">{ch.r2.toFixed(4)}</span>
                    </div>
                    {ch.ljungBox && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Ljung-Box p</span>
                        <span className={`font-mono ${ch.ljungBox.isWhiteNoise ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {ch.ljungBox.pValue.toFixed(4)}
                        </span>
                      </div>
                    )}
                    {ch.confidenceScore !== undefined && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Confidence</span>
                        <span className={`font-mono ${ch.confidenceScore >= 70 ? 'text-emerald-400' : ch.confidenceScore >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                          {ch.confidenceScore}/100
                        </span>
                      </div>
                    )}
                  </div>

                  {ch.edgeCaseDiagnostics && ch.edgeCaseDiagnostics.some(d => d.triggered) && (
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                        <ShieldAlert size={12} /> Diagnostics
                      </p>
                      {ch.edgeCaseDiagnostics.filter(d => d.triggered).map((d, i) => (
                        <p key={i} className={`text-xs mt-0.5 ${d.severity === 'critical' ? 'text-red-400' : d.severity === 'warning' ? 'text-amber-400' : 'text-blue-400'}`}>
                          {d.label}
                        </p>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {eigenvalueBarData.length > 1 && (
          <Card className="bg-white border-slate-200 mb-6">
            <CardHeader>
              <CardTitle className="text-slate-900 text-lg flex items-center gap-2">
                <Activity size={18} className="text-cyan-400" />
                Eigenvalue Comparison
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={eigenvalueBarData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="channel" tick={{ fill: '#64748b', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }} />
                  <ReferenceLine y={1} stroke="#ef4444" strokeDasharray="3 3" label={{ value: '|λ|=1', fill: '#ef4444', fontSize: 10 }} />
                  <Bar dataKey="eigenvalue" radius={[4, 4, 0, 0]}>
                    {eigenvalueBarData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {result.gearboxAnalysis && (
          <Card className="bg-white border-slate-200 mb-6">
            <CardHeader>
              <CardTitle className="text-slate-900 text-lg flex items-center gap-2">
                {result.gearboxAnalysis.hierarchyPreserved
                  ? <ShieldCheck size={18} className="text-emerald-400" />
                  : <ShieldAlert size={18} className="text-amber-400" />}
                Gearbox Hierarchy Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500 mb-2">Channel Hierarchy (by |λ|)</p>
                  <div className="space-y-1">
                    {result.gearboxAnalysis.hierarchy.map((h, i) => (
                      <div key={i} className="flex items-center justify-between text-sm bg-slate-50 px-3 py-1.5 rounded">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 text-xs w-4">{i + 1}.</span>
                          {h.role === 'clock' ? <Clock size={12} className="text-cyan-400" /> : <Target size={12} className="text-violet-400" />}
                          <span className="text-slate-600">{h.channel}</span>
                        </div>
                        <span className="font-mono text-slate-900">{h.eigenvalue.toFixed(4)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-2">Summary</p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Gap (Δ|λ|)</span>
                      <span className="font-mono font-bold text-slate-900">{result.gearboxAnalysis.gap.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Hierarchy Preserved</span>
                      <Badge className={result.gearboxAnalysis.hierarchyPreserved ? 'bg-emerald-900/30 text-emerald-300' : 'bg-red-900/30 text-red-300'}>
                        {result.gearboxAnalysis.hierarchyPreserved ? 'Yes' : 'No'}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-3">{result.gearboxAnalysis.interpretation}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="text-center text-xs text-slate-500 py-4">
          <p>{result.metadata?.algorithm}</p>
          <p className="mt-1">{result.metadata?.engine} | Analysis shared on {new Date(data.createdAt).toLocaleString()}</p>
          <Link href="/discovery-engine">
            <Button variant="link" size="sm" className="text-cyan-500 mt-2" data-testid="link-try-discovery">
              Try the Discovery Engine yourself
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}