import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Trash2, ExternalLink, FolderOpen, Clock, FileText, Dna } from "lucide-react";
import { Link, useLocation } from "wouter";

interface SavedReport {
  id: string;
  title: string;
  sourcePage: string;
  reportType: string;
  summary: string | null;
  geneCount: number | null;
  payload: any;
  createdAt: string;
}

const CONSUMER_PAGES: Record<string, { label: string; path: string }[]> = {
  gene_eigenvalue_list: [
    { label: "Root-Space Geometry", path: "/root-space" },
    { label: "Chronotherapy Predictor", path: "/chronotherapy-predictor" },
    { label: "Cross-Metric Independence", path: "/cross-metric-independence" },
  ],
};

const SOURCE_LABELS: Record<string, string> = {
  "discovery-engine": "Discovery Engine",
  "root-space": "Root-Space Geometry",
  "health-score": "Circadian Health Score",
  "cross-metric-independence": "Cross-Metric Independence",
};

export default function ReportLibrary() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: reports, isLoading } = useQuery<SavedReport[]>({
    queryKey: ["/api/saved-reports"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/saved-reports/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-reports"] });
      setDeletingId(null);
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 text-slate-900">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-slate-500" data-testid="button-back">
              <ArrowLeft size={16} className="mr-1" /> Home
            </Button>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <FolderOpen className="text-cyan-400" size={28} />
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Saved Reports</h1>
            <p className="text-slate-500 text-sm">
              Reports saved from analysis pages. Load them into compatible pages for further analysis.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-cyan-400" size={32} />
          </div>
        ) : !reports || reports.length === 0 ? (
          <Card className="bg-white border-slate-800">
            <CardContent className="py-16 text-center">
              <FileText className="mx-auto text-slate-600 mb-4" size={48} />
              <h3 className="text-lg font-semibold text-slate-600 mb-2" data-testid="text-empty-state">No saved reports yet</h3>
              <p className="text-slate-500 text-sm max-w-md mx-auto">
                Run an analysis on the Discovery Engine and click "Save to Reports" to save results here.
                You can then load them into other analysis pages like Root-Space or Health Score.
              </p>
              <Link href="/discovery-engine">
                <Button className="mt-6 bg-cyan-700 hover:bg-cyan-600" data-testid="button-go-discovery">
                  Go to Discovery Engine
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">{reports.length} saved report{reports.length !== 1 ? 's' : ''}</p>
            {reports.map((report) => {
              const consumers = CONSUMER_PAGES[report.reportType] || [];
              return (
                <Card key={report.id} className="bg-white border-slate-800 hover:border-slate-200 transition-colors" data-testid={`card-report-${report.id}`}>
                  <CardContent className="py-4 px-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-slate-800 truncate" data-testid={`text-report-title-${report.id}`}>{report.title}</h3>
                          <Badge variant="outline" className="text-[10px] border-cyan-800 text-cyan-400 shrink-0">
                            {report.reportType.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500 mb-2">
                          <span className="flex items-center gap-1">
                            <Clock size={11} />
                            {new Date(report.createdAt).toLocaleDateString()} {new Date(report.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span>From: {SOURCE_LABELS[report.sourcePage] || report.sourcePage}</span>
                          {report.geneCount && (
                            <span className="flex items-center gap-1">
                              <Dna size={11} />
                              {report.geneCount} genes
                            </span>
                          )}
                        </div>
                        {report.summary && (
                          <p className="text-xs text-slate-500 line-clamp-2">{report.summary}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {consumers.length > 0 && (
                          <div className="flex gap-1">
                            {consumers.map((c) => (
                              <Button
                                key={c.path}
                                variant="outline"
                                size="sm"
                                className="text-xs border-slate-200 text-slate-600 hover:bg-slate-100"
                                onClick={() => navigate(`${c.path}?reportId=${report.id}`)}
                                data-testid={`button-open-in-${c.path.slice(1)}-${report.id}`}
                              >
                                <ExternalLink size={12} className="mr-1" />
                                {c.label}
                              </Button>
                            ))}
                          </div>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-400 hover:text-red-300 hover:bg-red-950/30"
                          onClick={() => {
                            if (deletingId === report.id) {
                              deleteMutation.mutate(report.id);
                            } else {
                              setDeletingId(report.id);
                              setTimeout(() => setDeletingId(null), 3000);
                            }
                          }}
                          data-testid={`button-delete-${report.id}`}
                        >
                          <Trash2 size={14} />
                          {deletingId === report.id && <span className="ml-1 text-xs">Confirm?</span>}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
