import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2, Activity, CheckCircle2, XCircle, ArrowUpDown, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import HowTo from "@/components/HowTo";
import InsightCallout from "@/components/InsightCallout";
import EvidenceLink from "@/components/EvidenceLink";
import DownloadResultsButton from "@/components/DownloadResultsButton";
import { useLoadedReport } from "@/hooks/useLoadedReport";
import LoadedReportBanner from "@/components/LoadedReportBanner";

interface HealthScore {
  datasetId: string;
  datasetName: string;
  species: string;
  meanClockEigenvalue: number;
  meanTargetEigenvalue: number;
  gearboxGap: number;
  hierarchyPreserved: boolean;
  clockCount: number;
  targetCount: number;
  hierarchyRate: number;
  meanR2Clock: number;
  healthScore: number;
  grade: string;
  interpretation: string;
}

const GRADE_COLORS: Record<string, string> = {
  A: "#10b981",
  B: "#06b6d4",
  C: "#f59e0b",
  D: "#f97316",
  F: "#ef4444",
};

function getGradeColor(grade: string): string {
  return GRADE_COLORS[grade] || "#94a3b8";
}

function gradeBadgeClass(grade: string): string {
  switch (grade) {
    case "A": return "bg-emerald-900/50 text-emerald-300 border-emerald-700";
    case "B": return "bg-cyan-900/50 text-cyan-300 border-cyan-700";
    case "C": return "bg-amber-900/50 text-amber-300 border-amber-700";
    case "D": return "bg-orange-900/50 text-orange-300 border-orange-700";
    case "F": return "bg-red-900/50 text-red-300 border-red-700";
    default: return "text-slate-500 border-slate-300";
  }
}

function ScoreGauge({ score, grade }: { score: number; grade: string }) {
  const color = getGradeColor(grade);
  return (
    <svg width="100" height="100" viewBox="0 0 100 100" data-testid="score-gauge">
      <circle cx="50" cy="50" r="40" fill="none" stroke="#1e293b" strokeWidth="8" />
      <circle
        cx="50" cy="50" r="40" fill="none" stroke={color} strokeWidth="8"
        strokeDasharray={`${score * 2.51} 251`} strokeLinecap="round"
        transform="rotate(-90 50 50)"
      />
      <text x="50" y="50" textAnchor="middle" dominantBaseline="central"
        fill="white" fontSize="24" fontWeight="bold">{grade}</text>
      <text x="50" y="68" textAnchor="middle" fill="#94a3b8" fontSize="10">{score}/100</text>
    </svg>
  );
}

export default function HealthScorePage() {
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [speciesFilter, setSpeciesFilter] = useState<string>("all");
  const [gradeFilter, setGradeFilter] = useState<string>("all");
  const { report, hasReport } = useLoadedReport();

  const { data, isLoading } = useQuery<{ scores: HealthScore[]; totalDatasets: number }>({
    queryKey: ["/api/analysis/health-scores"],
    staleTime: 1000 * 60 * 30,
  });

  const scores = data?.scores ?? [];

  const speciesList = useMemo(() => {
    const set = new Set(scores.map((s) => s.species));
    return Array.from(set).sort();
  }, [scores]);

  const gradeList = useMemo(() => {
    const set = new Set(scores.map((s) => s.grade));
    return Array.from(set).sort();
  }, [scores]);

  const filteredScores = useMemo(() => {
    let list = [...scores];
    if (speciesFilter !== "all") list = list.filter((s) => s.species === speciesFilter);
    if (gradeFilter !== "all") list = list.filter((s) => s.grade === gradeFilter);
    list.sort((a, b) => sortDir === "desc" ? b.healthScore - a.healthScore : a.healthScore - b.healthScore);
    return list;
  }, [scores, speciesFilter, gradeFilter, sortDir]);

  const meanScore = scores.length > 0
    ? Math.round(scores.reduce((sum, s) => sum + s.healthScore, 0) / scores.length)
    : 0;
  const abCount = scores.filter((s) => s.grade === "A" || s.grade === "B").length;
  const dfCount = scores.filter((s) => s.grade === "D" || s.grade === "F").length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex items-center justify-center" data-testid="loading-screen">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 p-4 md:p-8" data-testid="health-score-page">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="link-back-home">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
              <Activity className="h-6 w-6 text-cyan-400" />
              Circadian Health Score
            </h1>
            <p className="text-sm text-muted-foreground">
              Composite health scores for circadian clock-target hierarchy integrity across all datasets
            </p>
            <div className="rounded-lg bg-slate-100 border border-slate-200 p-4 mt-3">
              <p className="text-sm text-slate-600 leading-relaxed">
                <strong className="text-slate-900">What you can do:</strong> Each dataset receives a 0-100 score and A-F grade based on the consistency of the clock &gt; target eigenvalue hierarchy in that dataset. Use these scores to compare hierarchy consistency across datasets and conditions. Download the table for use in your own analyses.
              </p>
            </div>
          </div>
          <DownloadResultsButton
            data={scores.map(s => ({
              datasetId: s.datasetId,
              datasetName: s.datasetName,
              species: s.species,
              healthScore: s.healthScore,
              grade: s.grade,
              meanClockEigenvalue: s.meanClockEigenvalue,
              meanTargetEigenvalue: s.meanTargetEigenvalue,
              gearboxGap: s.gearboxGap,
              hierarchyPreserved: s.hierarchyPreserved,
              hierarchyRate: s.hierarchyRate,
              meanR2Clock: s.meanR2Clock,
              interpretation: s.interpretation,
            }))}
            filename="PAR2_HealthScores.csv"
          />
        </div>

        {hasReport && report && (
          <LoadedReportBanner
            title={report.title}
            summary={report.summary}
            geneCount={report.geneCount}
            sourcePage={report.sourcePage}
          />
        )}

        <HowTo
          title="Circadian Health Score"
          summary="The health score (0–100) quantifies how intact the circadian clock-target gene hierarchy is in each dataset. It combines eigenvalue separation (gearbox gap), hierarchy preservation rate, model fit (R²), and gene coverage into a single composite metric."
          steps={[
            { label: "Score components", detail: "Gearbox gap measures eigenvalue separation between clock and target genes. Hierarchy rate measures how often clock eigenvalues exceed target eigenvalues." },
            { label: "Grade scale", detail: "A (80–100) = strong circadian hierarchy, B (60–79) = moderate, C (40–59) = weak, D (20–39) = disrupted, F (0–19) = severely disrupted." },
            { label: "Compare datasets", detail: "Sort by score or filter by species and grade to identify which tissues, conditions, or species show intact vs. disrupted circadian programs." },
            { label: "Interpretation", detail: "Each card includes a brief interpretation of what the score means for that specific dataset's circadian biology." },
          ]}
        />

        <div className="flex items-center gap-2 flex-wrap mt-2 mb-4">
          <EvidenceLink label="Cross-context validation" to="/cross-context-validation" hash="hierarchy-summary" />
          <EvidenceLink label="Validation suite" to="/validation-suite" hash="eigenvalue-independence" />
          <EvidenceLink label="Robustness suite" to="/robustness-suite" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="summary-stats">
          <Card className="border-slate-200">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-slate-900" data-testid="stat-total-datasets">{data?.totalDatasets ?? 0}</div>
              <div className="text-xs text-muted-foreground">Total Datasets</div>
            </CardContent>
          </Card>
          <Card className="border-slate-200">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-cyan-400" data-testid="stat-mean-score">{meanScore}</div>
              <div className="text-xs text-muted-foreground">Mean Score</div>
            </CardContent>
          </Card>
          <Card className="border-slate-200">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-emerald-400" data-testid="stat-ab-count">{abCount}</div>
              <div className="text-xs text-muted-foreground">A/B Grades</div>
            </CardContent>
          </Card>
          <Card className="border-slate-200">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-red-400" data-testid="stat-df-count">{dfCount}</div>
              <div className="text-xs text-muted-foreground">Disrupted (D/F)</div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-slate-200">
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                className="border-slate-300 hover:bg-slate-100"
                onClick={() => setSortDir(sortDir === "desc" ? "asc" : "desc")}
                data-testid="button-sort-score"
              >
                <ArrowUpDown className="h-4 w-4 mr-1" />
                Score {sortDir === "desc" ? "↓" : "↑"}
              </Button>

              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Species:</span>
                <Select value={speciesFilter} onValueChange={setSpeciesFilter} data-testid="select-species">
                  <SelectTrigger className="w-[160px] bg-slate-100 border-slate-200" data-testid="select-species-trigger">
                    <SelectValue placeholder="All species" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" data-testid="select-species-all">All species</SelectItem>
                    {speciesList.map((sp) => (
                      <SelectItem key={sp} value={sp} data-testid={`select-species-${sp}`}>{sp}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Grade:</span>
                <Select value={gradeFilter} onValueChange={setGradeFilter} data-testid="select-grade">
                  <SelectTrigger className="w-[120px] bg-slate-100 border-slate-200" data-testid="select-grade-trigger">
                    <SelectValue placeholder="All grades" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" data-testid="select-grade-all">All grades</SelectItem>
                    {gradeList.map((g) => (
                      <SelectItem key={g} value={g} data-testid={`select-grade-${g}`}>{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="score-grid">
          {filteredScores.map((s) => (
            <Card key={s.datasetId} className="border-slate-200 hover:border-slate-300 transition-colors" data-testid={`card-dataset-${s.datasetId}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="truncate" data-testid={`text-dataset-name-${s.datasetId}`}>{s.datasetName}</span>
                  <Badge className={gradeBadgeClass(s.grade)} data-testid={`badge-grade-${s.datasetId}`}>{s.grade}</Badge>
                </CardTitle>
                <Badge variant="outline" className="w-fit text-xs text-slate-500 border-slate-300" data-testid={`badge-species-${s.datasetId}`}>
                  {s.species}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-center">
                  <ScoreGauge score={s.healthScore} grade={s.grade} />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">Gearbox Gap:</span>
                    <span className="font-mono text-slate-900" data-testid={`text-gap-${s.datasetId}`}>{s.gearboxGap.toFixed(4)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">Hierarchy:</span>
                    {s.hierarchyPreserved ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" data-testid={`icon-hierarchy-yes-${s.datasetId}`} />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-red-400" data-testid={`icon-hierarchy-no-${s.datasetId}`} />
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">Clock genes:</span>
                    <span className="font-mono text-slate-900" data-testid={`text-clock-count-${s.datasetId}`}>{s.clockCount}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">Target genes:</span>
                    <span className="font-mono text-slate-900" data-testid={`text-target-count-${s.datasetId}`}>{s.targetCount}</span>
                  </div>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed" data-testid={`text-interpretation-${s.datasetId}`}>
                  {s.interpretation}
                </p>

                <div className="flex flex-wrap gap-2 pt-1">
                  <Link href={`/gene-explorer`}>
                    <Button variant="outline" size="sm" className="text-xs gap-1 border-slate-300 hover:bg-slate-100 h-7 px-2" data-testid={`button-explore-${s.datasetId}`}>
                      <ExternalLink size={10} />
                      Explore Genes
                    </Button>
                  </Link>
                  <Link href={`/volatile-genes`}>
                    <Button variant="outline" size="sm" className="text-xs gap-1 border-slate-300 hover:bg-slate-100 h-7 px-2" data-testid={`button-volatile-${s.datasetId}`}>
                      <ExternalLink size={10} />
                      Volatility
                    </Button>
                  </Link>
                  <Link href={`/root-space`}>
                    <Button variant="outline" size="sm" className="text-xs gap-1 border-slate-300 hover:bg-slate-100 h-7 px-2" data-testid={`button-rootspace-${s.datasetId}`}>
                      <ExternalLink size={10} />
                      Root Space
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredScores.length === 0 && !isLoading && (
          <div className="text-center py-12 text-muted-foreground" data-testid="empty-state">
            No datasets match the current filters.
          </div>
        )}

        <InsightCallout title="Understanding Health Scores">
          The health score summarizes how intact the circadian clock-target hierarchy is in each dataset.
          Wild-type tissues typically score 70–90 (B–A grade), while perturbed conditions and genetic knockouts
          often score below 40 (D–F). Scores reflect hierarchy integrity, not clinical diagnosis.
        </InsightCallout>
      </div>
    </div>
  );
}
