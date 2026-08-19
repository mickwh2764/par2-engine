import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";

interface LoadedGene {
  gene: string;
  eigenvalue: number;
  geneType: string;
  phi1?: number;
  phi2?: number;
  r2?: number;
  stability?: string;
}

interface LoadedReport {
  id: string;
  title: string;
  sourcePage: string;
  reportType: string;
  summary: string | null;
  geneCount: number | null;
  payload: {
    genes: LoadedGene[];
    fileName: string;
    detectedFormat: string;
    gearboxAnalysis?: any;
    perGeneAnalysis?: any;
  };
  createdAt: string;
}

export function useLoadedReport() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const reportId = params.get("reportId");

  const { data: report, isLoading } = useQuery<LoadedReport>({
    queryKey: ["/api/saved-reports", reportId],
    queryFn: async () => {
      const res = await fetch(`/api/saved-reports/${reportId}`);
      if (!res.ok) throw new Error("Failed to load report");
      return res.json();
    },
    enabled: !!reportId,
  });

  const geneNames = report?.payload?.genes?.map((g: LoadedGene) => g.gene.toUpperCase()) || [];
  const geneSet = new Set(geneNames);

  return {
    reportId,
    report,
    isLoading: isLoading && !!reportId,
    hasReport: !!report,
    geneNames,
    geneSet,
    genes: report?.payload?.genes || [],
  };
}
