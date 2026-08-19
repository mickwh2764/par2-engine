import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface DownloadResultsButtonProps {
  data: Record<string, any>[] | null | undefined;
  filename: string;
  label?: string;
  className?: string;
}

export function downloadAsCSV(data: Record<string, any>[], filename: string) {
  if (!data || data.length === 0) return;
  const headers = Object.keys(data[0]);
  const csv = [
    headers.join(","),
    ...data.map(row =>
      headers.map(h => {
        const val = row[h];
        if (val === null || val === undefined) return "";
        const str = String(val);
        return str.includes(",") || str.includes('"') || str.includes("\n")
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      }).join(",")
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DownloadResultsButton({ data, filename, label = "Download Results (CSV)", className = "" }: DownloadResultsButtonProps) {
  if (!data || data.length === 0) return null;
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => downloadAsCSV(data, filename)}
      className={`gap-2 border-slate-300 text-slate-700 hover:bg-slate-50 ${className}`}
      data-testid="button-download-results"
    >
      <Download className="h-4 w-4" />
      {label}
    </Button>
  );
}
