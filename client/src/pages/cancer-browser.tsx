import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ScatterChart, Scatter, Cell, ReferenceLine
} from "recharts";
import { 
  ArrowLeft, Activity, AlertTriangle, CheckCircle2, XCircle, 
  TrendingUp, TrendingDown, Info, Microscope, Shield, ShieldAlert, Loader2, FileCheck, RefreshCw
} from "lucide-react";
import { useState } from "react";
import HowTo from "@/components/HowTo";
import PaperCrossLinks from "@/components/PaperCrossLinks";
import InsightCallout from "@/components/InsightCallout";
import ViewInRootSpace from "@/components/ViewInRootSpace";
import GeneTooltip from "@/components/GeneTooltip";

interface GeneEigenvalue {
  gene: string;
  value: number;
}

interface CancerCohort {
  name: string;
  geoId: string;
  tumorType: string;
  organism: string;
  nSamples: number;
  hasMatchedNormal: boolean;
  timepoints: number;
  clockEigenvalues: GeneEigenvalue[];
  targetEigenvalues: GeneEigenvalue[];
  gearboxGap: number;
  gearboxIntact: boolean;
}

interface FDRGuidance {
  level: string;
  color: string;
  message: string;
  recommendations: string[];
  caveats: string[];
}

interface VerificationGeneResult {
  gene: string;
  displayedValue: number;
  computedValue: number | null;
  difference: number | null;
  verified: boolean;
  r2: number | null;
}

interface VerificationResult {
  cohortName: string;
  geoId: string;
  datasetFile: string;
  datasetExists: boolean;
  clockGenes: VerificationGeneResult[];
  targetGenes: VerificationGeneResult[];
  overallVerified: boolean;
  computedGap: number | null;
  displayedGap: number;
  gapDifference: number | null;
  warnings: string[];
  timestamp: string;
}

interface VerificationReport {
  generatedAt: string;
  totalCohorts: number;
  verifiedCohorts: number;
  partiallyVerified: number;
  dataNotAvailable: number;
  results: VerificationResult[];
  summary: {
    allValuesMatch: boolean;
    meanDifference: number;
    maxDifference: number;
    interpretation: string;
  };
  methodology: string;
  diagnosticsNote?: string;
}

function FDRWarningBadge({ level }: { level: 'EXPLORATORY' | 'REPLICATED' | 'VALIDATED' }) {
  const colors = {
    EXPLORATORY: 'bg-red-500/20 text-red-400 border-red-500/30',
    REPLICATED: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    VALIDATED: 'bg-green-500/20 text-green-400 border-green-500/30'
  };
  
  const icons = {
    EXPLORATORY: <AlertTriangle className="w-3 h-3" />,
    REPLICATED: <Info className="w-3 h-3" />,
    VALIDATED: <CheckCircle2 className="w-3 h-3" />
  };

  return (
    <Badge className={`${colors[level]} border flex items-center gap-1`}>
      {icons[level]}
      {level}
    </Badge>
  );
}

function GearboxIndicator({ intact, gap }: { intact: boolean; gap: number }) {
  if (intact) {
    return (
      <div className="flex items-center gap-2 text-green-400" data-testid="gearbox-intact">
        <CheckCircle2 className="w-4 h-4" />
        <span>Intact (+{gap.toFixed(2)})</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 text-red-400" data-testid="gearbox-disrupted">
      <XCircle className="w-4 h-4" />
      <span>Disrupted ({gap.toFixed(2)})</span>
    </div>
  );
}

export default function CancerBrowser() {
  const [selectedCohort, setSelectedCohort] = useState<CancerCohort | null>(null);
  const [verificationReport, setVerificationReport] = useState<VerificationReport | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const { data: cohortsData, isLoading } = useQuery<{ cohorts: CancerCohort[]; count: number }>({
    queryKey: ['/api/cancer-browser/cohorts'],
  });
  
  const cohorts = cohortsData?.cohorts || [];

  const { data: fdrGuidance } = useQuery<FDRGuidance>({
    queryKey: ['/api/fdr-guidance/EXPLORATORY'],
  });

  const runVerification = async () => {
    setIsVerifying(true);
    try {
      const response = await fetch('/api/cancer-browser/verify');
      const data = await response.json();
      setVerificationReport(data);
    } catch (error) {
      console.error('Verification failed:', error);
    } finally {
      setIsVerifying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex items-center justify-center">
        <Activity className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  const cancerCohorts = cohorts.filter(c => c.tumorType !== 'Normal');
  const normalCohorts = cohorts.filter(c => c.tumorType === 'Normal');

  const comparisonData = cohorts.map(c => ({
    name: c.name.length > 20 ? c.name.substring(0, 20) + '...' : c.name,
    fullName: c.name,
    clockMean: c.clockEigenvalues.reduce((a, b) => a + b.value, 0) / c.clockEigenvalues.length,
    targetMean: c.targetEigenvalues.reduce((a, b) => a + b.value, 0) / c.targetEigenvalues.length,
    gap: c.gearboxGap,
    intact: c.gearboxIntact,
    tumorType: c.tumorType
  })) || [];

  const scatterData = cohorts?.map(c => ({
    name: c.name,
    clock: c.clockEigenvalues.reduce((a, b) => a + b.value, 0) / c.clockEigenvalues.length,
    target: c.targetEigenvalues.reduce((a, b) => a + b.value, 0) / c.targetEigenvalues.length,
    intact: c.gearboxIntact,
    tumorType: c.tumorType
  })) || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm" data-testid="link-back-home">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Home
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-3">
                <Microscope className="w-6 h-6 text-cyan-400" />
                Cancer Cohort Browser
              </h1>
              <p className="text-slate-500 text-sm">
                Compare clock-target eigenvalue dynamics across tumor types
              </p>
            </div>
          </div>
          <FDRWarningBadge level="EXPLORATORY" />
        </div>

        <PaperCrossLinks currentPage="/cancer-browser" />

        <HowTo
          title="Cancer Cohort Browser"
          summary="Compares AR(2) eigenvalue signatures between clock and target genes in cancer datasets. The Gearbox Hypothesis predicts that clock genes maintain higher temporal persistence (|λ|) than target genes — this page tests whether that hierarchy is preserved or disrupted in each cancer cohort."
          steps={[
            { label: "Review cohorts", detail: "Each card shows a cancer dataset with its clock vs. target eigenvalue gap and whether the hierarchy is intact." },
            { label: "Check the gap", detail: "A positive gap (clock > target) means the Gearbox Hypothesis is supported. A negative gap means disruption." },
            { label: "Verify values", detail: "Click 'Verify' on any cohort to recompute eigenvalues from raw data and confirm the displayed results match." }
          ]}
        />

        {/* FDR Warning Card */}
        {fdrGuidance && (
          <Card className="bg-red-500/10 border-red-500/30">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5" />
                <div>
                  <p className="text-red-300 font-medium">{fdrGuidance.message}</p>
                  <ul className="text-red-400/80 text-sm mt-2 space-y-1">
                    {fdrGuidance.caveats.map((c, i) => (
                      <li key={i}>• {c}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="comparison" className="space-y-4">
          <TabsList className="bg-slate-100">
            <TabsTrigger value="comparison" data-testid="tab-comparison">Comparison Chart</TabsTrigger>
            <TabsTrigger value="scatter" data-testid="tab-scatter">Clock vs Target</TabsTrigger>
            <TabsTrigger value="table" data-testid="tab-table">Full Table</TabsTrigger>
            <TabsTrigger value="verify" data-testid="tab-verify" className="flex items-center gap-1">
              <Shield className="w-3 h-3" />
              Verify Data
            </TabsTrigger>
          </TabsList>

          <TabsContent value="comparison">
            <Card className="bg-slate-50 border-slate-200">
              <CardHeader>
                <CardTitle>Gearbox Gap by Cohort</CardTitle>
                <CardDescription>
                  Positive gap = clock &gt; target (intact hierarchy). Negative = disrupted.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                    <BarChart data={comparisonData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis type="number" domain={[-0.2, 0.5]} stroke="#64748b" />
                      <YAxis type="category" dataKey="name" width={150} stroke="#64748b" tick={{ fontSize: 11 }} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                        formatter={(value: number) => [value.toFixed(3), 'Gap']}
                        labelFormatter={(label) => comparisonData.find(d => d.name === label)?.fullName || label}
                      />
                      <ReferenceLine x={0} stroke="#ef4444" strokeDasharray="5 5" />
                      <Bar dataKey="gap" radius={[0, 4, 4, 0]}>
                        {comparisonData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.intact ? '#22c55e' : '#ef4444'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="scatter">
            <Card className="bg-slate-50 border-slate-200">
              <CardHeader>
                <CardTitle>Clock vs Target Eigenvalues</CardTitle>
                <CardDescription>
                  Points above diagonal = intact gearbox. Below = disrupted hierarchy.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                    <ScatterChart>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis 
                        type="number" 
                        dataKey="target" 
                        name="Target |λ|" 
                        domain={[0.2, 0.8]} 
                        stroke="#64748b"
                        label={{ value: 'Target |λ|', position: 'bottom', fill: '#64748b' }}
                      />
                      <YAxis 
                        type="number" 
                        dataKey="clock" 
                        name="Clock |λ|" 
                        domain={[0.4, 0.9]} 
                        stroke="#64748b"
                        label={{ value: 'Clock |λ|', angle: -90, position: 'insideLeft', fill: '#64748b' }}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                        formatter={(value: number) => value.toFixed(3)}
                        labelFormatter={(_, payload) => payload?.[0]?.payload?.name || ''}
                      />
                      <ReferenceLine 
                        segment={[{ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.8 }]} 
                        stroke="#64748b" 
                        strokeDasharray="5 5"
                        label={{ value: 'y=x', fill: '#64748b', fontSize: 10 }}
                      />
                      <Scatter data={scatterData} shape="circle">
                        {scatterData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.intact ? '#22c55e' : '#ef4444'}
                            r={8}
                          />
                        ))}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-6 mt-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="text-slate-500">Gearbox Intact</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span className="text-slate-500">Gearbox Disrupted</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="table">
            <Card className="bg-slate-50 border-slate-200">
              <CardHeader>
                <CardTitle>All Cohorts</CardTitle>
                <CardDescription>
                  {cancerCohorts.length} cancer cohorts, {normalCohorts.length} normal controls
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="table-cohorts">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left p-3 text-slate-500">Cohort</th>
                        <th className="text-left p-3 text-slate-500">GEO ID</th>
                        <th className="text-left p-3 text-slate-500">Type</th>
                        <th className="text-center p-3 text-slate-500">Samples</th>
                        <th className="text-center p-3 text-slate-500">Clock |λ|</th>
                        <th className="text-center p-3 text-slate-500">Target |λ|</th>
                        <th className="text-center p-3 text-slate-500">Gap</th>
                        <th className="text-center p-3 text-slate-500">Gearbox</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cohorts?.map((cohort, idx) => {
                        const clockMean = cohort.clockEigenvalues.reduce((a, b) => a + b.value, 0) / cohort.clockEigenvalues.length;
                        const targetMean = cohort.targetEigenvalues.reduce((a, b) => a + b.value, 0) / cohort.targetEigenvalues.length;
                        return (
                          <tr 
                            key={idx} 
                            className="border-b border-slate-200 hover:bg-slate-50 cursor-pointer"
                            onClick={() => setSelectedCohort(cohort)}
                            data-testid={`row-cohort-${idx}`}
                          >
                            <td className="p-3 font-medium">
                              {cohort.name}
                              {cohort.geoId === 'GSE157357' && (
                                <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-blue-600 bg-blue-50 border border-blue-300 rounded px-1.5 py-0.5" data-testid="gse157357-correction-badge-row">
                                  <RefreshCw className="w-2.5 h-2.5" />
                                  Values updated April 2026 — see Zenodo V6
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-cyan-400">{cohort.geoId}</td>
                            <td className="p-3">
                              <Badge variant={cohort.tumorType === 'Normal' ? 'outline' : 'destructive'}>
                                {cohort.tumorType}
                              </Badge>
                            </td>
                            <td className="p-3 text-center">{cohort.nSamples}</td>
                            <td className="p-3 text-center text-cyan-400">{clockMean.toFixed(3)}</td>
                            <td className="p-3 text-center text-pink-400">{targetMean.toFixed(3)}</td>
                            <td className="p-3 text-center">
                              <span className={cohort.gearboxGap > 0 ? 'text-green-400' : 'text-red-400'}>
                                {cohort.gearboxGap > 0 ? '+' : ''}{cohort.gearboxGap.toFixed(3)}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <GearboxIndicator intact={cohort.gearboxIntact} gap={cohort.gearboxGap} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="verify">
            <Card className="bg-slate-50 border-slate-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-cyan-400" />
                  Data Verification
                </CardTitle>
                <CardDescription>
                  Run live AR(2) analysis on actual GEO datasets to verify displayed eigenvalues
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4" data-testid="diagnostics-banner">
                  <div className="flex items-start gap-3">
                    <ShieldAlert className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-amber-300 font-medium text-sm" data-testid="diagnostics-banner-title">Edge Case Diagnostics Available</p>
                      <p className="text-amber-400/80 text-xs mt-1" data-testid="diagnostics-banner-description">
                        This browser uses pre-computed eigenvalues. Full edge case diagnostics (stationarity checks, 
                        condition numbers, short-series warnings) are available when running live AR(2) analysis 
                        on raw time-series data via the discovery engine.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-100 rounded-lg p-4">
                  <p className="text-slate-600 text-sm mb-4">
                    This verification runs the AR(2) algorithm directly on downloaded GEO expression data
                    and compares the computed eigenvalues to the values displayed in this browser.
                  </p>
                  <Button 
                    onClick={runVerification}
                    disabled={isVerifying}
                    className="w-full"
                    data-testid="button-run-verification"
                  >
                    {isVerifying ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Running Live Verification...
                      </>
                    ) : (
                      <>
                        <FileCheck className="w-4 h-4 mr-2" />
                        Run Live Verification on GEO Data
                      </>
                    )}
                  </Button>
                </div>

                {verificationReport && (
                  <div className="space-y-4">
                    <div className={`rounded-lg p-4 ${verificationReport.summary.allValuesMatch ? 'bg-green-500/10 border border-green-500/30' : 'bg-yellow-500/10 border border-yellow-500/30'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        {verificationReport.summary.allValuesMatch ? (
                          <CheckCircle2 className="w-5 h-5 text-green-400" />
                        ) : (
                          <AlertTriangle className="w-5 h-5 text-yellow-400" />
                        )}
                        <span className={`font-medium ${verificationReport.summary.allValuesMatch ? 'text-green-400' : 'text-yellow-400'}`}>
                          {verificationReport.summary.allValuesMatch ? 'All Values Verified' : 'Partial Verification'}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600">{verificationReport.summary.interpretation}</p>
                      <div className="grid grid-cols-3 gap-4 mt-4 text-center">
                        <div>
                          <div className="text-2xl font-bold text-green-400">{verificationReport.verifiedCohorts}</div>
                          <div className="text-xs text-slate-500">Verified</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-yellow-400">{verificationReport.partiallyVerified}</div>
                          <div className="text-xs text-slate-500">Partial</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-slate-500">{verificationReport.dataNotAvailable}</div>
                          <div className="text-xs text-slate-500">No Data</div>
                        </div>
                      </div>
                    </div>

                    {verificationReport.diagnosticsNote && (
                      <div className="bg-slate-100 border border-slate-300 rounded-lg p-4" data-testid="diagnostics-note">
                        <div className="flex items-start gap-3">
                          <ShieldAlert className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-cyan-300 font-medium text-sm" data-testid="diagnostics-note-title">Diagnostics Note</p>
                            <p className="text-slate-600 text-xs mt-1" data-testid="diagnostics-note-content">
                              {verificationReport.diagnosticsNote}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {verificationReport.results.map((result, idx) => (
                      <Card key={idx} className={`border ${result.overallVerified ? 'border-green-500/30 bg-green-500/5' : result.datasetExists ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-slate-200 bg-slate-50'}`}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base flex items-center justify-between">
                            <span>{result.cohortName}</span>
                            <Badge variant={result.overallVerified ? 'default' : result.datasetExists ? 'secondary' : 'outline'}>
                              {result.overallVerified ? 'Verified' : result.datasetExists ? 'Partial' : 'No Data'}
                            </Badge>
                          </CardTitle>
                          <CardDescription className="text-xs">
                            {result.datasetFile} • {result.geoId}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          {result.datasetExists ? (
                            <div className="grid grid-cols-2 gap-4 text-xs">
                              <div>
                                <div className="text-cyan-400 font-medium mb-2">Clock Genes</div>
                                {result.clockGenes.map((g, i) => (
                                  <div key={i} className="flex justify-between items-center py-1 border-b border-slate-200">
                                    <span><GeneTooltip gene={g.gene}>{g.gene}</GeneTooltip></span>
                                    <div className="flex items-center gap-2">
                                      <span className="text-slate-500">D: {g.displayedValue.toFixed(2)}</span>
                                      <span className={g.verified ? 'text-green-400' : 'text-yellow-400'}>
                                        C: {g.computedValue?.toFixed(2) || 'N/A'}
                                      </span>
                                      {g.verified ? <CheckCircle2 className="w-3 h-3 text-green-400" /> : <AlertTriangle className="w-3 h-3 text-yellow-400" />}
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <div>
                                <div className="text-pink-400 font-medium mb-2">Target Genes</div>
                                {result.targetGenes.map((g, i) => (
                                  <div key={i} className="flex justify-between items-center py-1 border-b border-slate-200">
                                    <span><GeneTooltip gene={g.gene}>{g.gene}</GeneTooltip></span>
                                    <div className="flex items-center gap-2">
                                      <span className="text-slate-500">D: {g.displayedValue.toFixed(2)}</span>
                                      <span className={g.verified ? 'text-green-400' : 'text-yellow-400'}>
                                        C: {g.computedValue?.toFixed(2) || 'N/A'}
                                      </span>
                                      {g.verified ? <CheckCircle2 className="w-3 h-3 text-green-400" /> : <AlertTriangle className="w-3 h-3 text-yellow-400" />}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <p className="text-slate-500 text-sm">Dataset file not available for verification</p>
                          )}
                          {result.warnings.length > 0 && (
                            <div className="mt-2 text-xs text-yellow-400">
                              {result.warnings.map((w, i) => <div key={i}>• {w}</div>)}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}

                    <Card className="bg-slate-100 border-slate-200">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Methodology</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <pre className="text-xs text-slate-500 whitespace-pre-wrap font-mono">
                          {verificationReport.methodology}
                        </pre>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Selected Cohort Detail */}
        {selectedCohort && (
          <Card className="bg-slate-50 border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{selectedCohort.name}</CardTitle>
                <CardDescription>
                  {selectedCohort.geoId} • {selectedCohort.organism} • {selectedCohort.timepoints} timepoints
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedCohort(null)}>
                ✕
              </Button>
            </CardHeader>
            <CardContent>
              {selectedCohort.geoId === 'GSE157357' && (
                <div className="mb-4 flex items-start gap-2 rounded-lg border border-blue-400 bg-blue-50 px-3 py-2" data-testid="gse157357-correction-notice-panel">
                  <RefreshCw className="h-3.5 w-3.5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-900">
                    <strong className="font-semibold">Values updated April 2026</strong> — eigenvalues recomputed from replicate-averaged chronological series. See <strong>Zenodo V6</strong> for full details.
                  </p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-medium text-slate-500 mb-3">Clock Genes</h4>
                  <div className="space-y-2">
                    {selectedCohort.clockEigenvalues.map((g, i) => (
                      <div key={i} className="flex justify-between items-center">
                        <span className="text-cyan-400"><GeneTooltip gene={g.gene}>{g.gene}</GeneTooltip></span>
                        <span className="font-mono">{g.value.toFixed(3)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-slate-500 mb-3">Target Genes</h4>
                  <div className="space-y-2">
                    {selectedCohort.targetEigenvalues.map((g, i) => (
                      <div key={i} className="flex justify-between items-center">
                        <span className="text-pink-400"><GeneTooltip gene={g.gene}>{g.gene}</GeneTooltip></span>
                        <span className="font-mono">{g.value.toFixed(3)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <InsightCallout variant="warning">
          When the gearbox gap collapses (clock and target eigenvalues converge), it indicates loss of the hierarchical temporal organization that healthy tissue maintains. This is a quantitative signature of circadian disruption in cancer.
        </InsightCallout>

        <div className="my-4">
          <ViewInRootSpace />
        </div>

        {/* Summary Statistics */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="bg-slate-50 border-slate-200">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-green-400">
                {normalCohorts.filter(c => c.gearboxIntact).length}/{normalCohorts.length}
              </div>
              <div className="text-sm text-slate-500">Normal with intact gearbox</div>
            </CardContent>
          </Card>
          <Card className="bg-slate-50 border-slate-200">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-red-400">
                {cancerCohorts.filter(c => !c.gearboxIntact).length}/{cancerCohorts.length}
              </div>
              <div className="text-sm text-slate-500">Cancer with disrupted gearbox</div>
            </CardContent>
          </Card>
          <Card className="bg-slate-50 border-slate-200">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-cyan-400">
                {cohorts?.length || 0}
              </div>
              <div className="text-sm text-slate-500">Total cohorts analyzed</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
