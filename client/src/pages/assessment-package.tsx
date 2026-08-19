import { useQuery } from "@tanstack/react-query";
import { Download, FileText, BookOpen, Shield, CheckCircle, AlertCircle, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";

interface ManifestItem {
  folder: string;
  name: string;
  description: string;
  exists: boolean;
}

interface Manifest {
  items: ManifestItem[];
  totalFiles: number;
}

const FOLDER_META: Record<string, { label: string; icon: typeof BookOpen; color: string; bg: string }> = {
  book:       { label: "Book Chapters",        icon: BookOpen,  color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/20" },
  validation: { label: "Validation Documents", icon: Shield,    color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  papers:     { label: "Papers (PDF)",          icon: FileText,  color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/20" },
};

function groupByFolder(items: ManifestItem[]) {
  const groups: Record<string, ManifestItem[]> = {};
  for (const item of items) {
    if (!groups[item.folder]) groups[item.folder] = [];
    groups[item.folder].push(item);
  }
  return groups;
}

export default function AssessmentPackagePage() {
  const [downloading, setDownloading] = useState(false);

  const { data: manifest, isLoading } = useQuery<Manifest>({
    queryKey: ["/api/assessment-package/manifest"],
  });

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch("/api/assessment-package/download");
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "PAR2_Assessment_Package.zip";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    } finally {
      setDownloading(false);
    }
  };

  const groups = manifest ? groupByFolder(manifest.items) : {};

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12">

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">AI Assessment Package</h1>
              <p className="text-sm text-muted-foreground">Everything in one ZIP — upload to any AI model for a full platform review</p>
            </div>
          </div>
        </div>

        {/* What's inside summary */}
        <Card className="mb-8 border-primary/20 bg-primary/5">
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              The package bundles the five book chapters (companion text explaining
              methods, maths, worked example and glossary), validation and
              evidence documents including the head-to-head benchmark comparison
              of AR(2) vs JTK_CYCLE vs Cosinor, and the two main paper PDFs into
              a single downloadable ZIP. Upload the whole folder to an AI model —
              Claude, GPT-4o, Gemini, or any model that accepts file uploads —
              and it will have the full context needed to assess the framework,
              its evidence base, and its honest limitations.
            </p>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">5 book chapters</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">validation docs + benchmark</span>
              <span className="px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20">2 paper PDFs</span>
              <span className="px-2 py-0.5 rounded-full bg-slate-500/15 text-slate-400 border border-slate-500/20">README with context</span>
            </div>
          </CardContent>
        </Card>

        {/* Download button */}
        <div className="mb-10">
          <Button
            size="lg"
            onClick={handleDownload}
            disabled={downloading || isLoading}
            className="w-full sm:w-auto gap-2 text-sm font-medium"
            data-testid="button-download-assessment-package"
          >
            <Download className="h-4 w-4" />
            {downloading
              ? "Building ZIP…"
              : `Download PAR2_Assessment_Package.zip${manifest ? ` (${manifest.totalFiles} files)` : ""}`}
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            ~2–4 MB · includes README with suggested AI prompts
          </p>
        </div>

        <Separator className="mb-8" />

        {/* Manifest */}
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-5">
          Package contents
        </h2>

        {isLoading && (
          <div className="text-sm text-muted-foreground">Loading manifest…</div>
        )}

        {manifest && (
          <div className="space-y-6">
            {(["book", "validation", "papers"] as const).map((folder) => {
              const items = groups[folder] ?? [];
              if (!items.length) return null;
              const meta = FOLDER_META[folder];
              const FolderIcon = meta.icon;
              return (
                <Card key={folder} className={`border ${meta.bg}`}>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className={`text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5 ${meta.color}`}>
                      <FolderIcon className="h-3.5 w-3.5" />
                      {meta.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <div className="space-y-3">
                      {items.map((item) => (
                        <div key={item.name} className="flex items-start gap-2.5">
                          {item.exists ? (
                            <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                          )}
                          <div>
                            <div className="text-xs font-mono text-foreground/80">{item.name}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">{item.description}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <Separator className="my-8" />

        {/* Suggested AI prompts */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
            Suggested prompts once uploaded
          </h2>
          <div className="space-y-3">
            {[
              {
                label: "Full assessment",
                prompt: "Read all files in this package. Assess the PAR(2) framework's central claims, the quality of the evidence, what has been established vs. what remains exploratory, and what the most important open questions are. Be honest about weaknesses.",
              },
              {
                label: "Mathematical foundations",
                prompt: "Read book_fibonacci_foundations.md and paper_g_fibonacci_reply.pdf. Verify the algebraic argument. Is the claim that 1/φ is the stability supremum under the Fibonacci structural constraint correct? What does and doesn't follow from it?",
              },
              {
                label: "Methods critique",
                prompt: "Read book_methods_comparison.md and book_worked_example.md. How does PAR(2) eigenvalue analysis differ from existing circadian methods? Are the caveats about what it does and doesn't establish adequate?",
              },
              {
                label: "Replication & robustness",
                prompt: "Read MASTER_VALIDATION_RESULTS.md and PREREGISTERED_VALIDATION_PLAN.md. Which pre-registered predictions were confirmed, which failed, and which remain untested? Is the pre-registration methodology adequate?",
              },
            ].map((p) => (
              <div
                key={p.label}
                className="rounded-lg border border-border/50 bg-muted/30 p-3"
              >
                <Badge variant="outline" className="text-[10px] mb-2">
                  {p.label}
                </Badge>
                <p className="text-xs text-muted-foreground font-mono leading-relaxed">
                  {p.prompt}
                </p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
