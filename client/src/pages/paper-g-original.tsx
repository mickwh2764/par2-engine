import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Download, FileText, ExternalLink, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export default function PaperGOriginal() {
  const [pdfError, setPdfError] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2" data-testid="btn-back-home">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
        </div>

        <div className="flex flex-col gap-2 mb-6">
          <div className="flex items-center gap-3 flex-wrap">
            <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
              <CheckCircle className="h-3 w-3 mr-1" />
              In Press
            </Badge>
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
              <CheckCircle className="h-3 w-3 mr-1" />
              Accepted 1 August 2026
            </Badge>
            <Badge variant="outline" className="text-muted-foreground">Paper G · Fibonacci Quarterly</Badge>
          </div>
          <h1 className="text-2xl font-bold text-foreground leading-tight">
            A Time-Domain Analogue to Fibonacci Structure via Phase-Gated AR(2) Dynamics
          </h1>
          <p className="text-sm text-muted-foreground">
            Original submitted manuscript — now published in The Fibonacci Quarterly (doi:10.1080/00150517.2026.2716122).
            This is the version sent to reviewers. See the{" "}
            <Link href="/paper-g-revision">
              <span className="text-emerald-400 hover:underline cursor-pointer">revised version</span>
            </Link>{" "}
            for the accepted manuscript incorporating all reviewer corrections.
          </p>
        </div>

        {/* Reviewer summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card className="border-amber-500/20 bg-amber-500/5">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-amber-400 mb-2">Reviewer 1 — 5 Scientific Comments</h3>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>1. Rationale for tuft/DCS/organoid selection not sufficiently explicit</li>
                <li>2. Mouse/human model mismatch not clearly caveated</li>
                <li>3. Reference 5 attribution incorrect (Speck vs Bormashenko)</li>
                <li>4. "Fibonacci-consistent manifold" not formally defined</li>
                <li>5. Damped vs unstable roots distinction not explicit in Section 6</li>
              </ul>
            </CardContent>
          </Card>
          <Card className="border-blue-500/20 bg-blue-500/5">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-blue-400 mb-2">Reviewer 2 (Editor) — Formatting</h3>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>· "e.g." → "e.g.," throughout</li>
                <li>· Add Disclosure Statement</li>
                <li>· Reformat references to FQ alphabetical style</li>
                <li>· Remove duplicate reference [11]</li>
                <li>· Fix "News article" reference (no author)</li>
                <li>· Remove extraneous pages 11–19</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Download bar */}
        <div className="flex items-center gap-3 mb-4">
          <a href="/downloads/Paper_G_Fibonacci_Reply_Original.pdf" download>
            <Button variant="outline" size="sm" className="gap-2" data-testid="btn-download-original">
              <Download className="h-4 w-4" />
              Download Original PDF
            </Button>
          </a>
          <span className="text-xs text-muted-foreground">Paper_G_Fibonacci_Reply_Original.pdf · 377 KB</span>
        </div>

        {/* PDF viewer */}
        <div className="rounded-xl border border-border overflow-hidden bg-card" style={{ height: "75vh" }}>
          {pdfError ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
              <FileText className="h-12 w-12 opacity-40" />
              <p className="text-sm">PDF preview unavailable in this browser.</p>
              <a href="/downloads/Paper_G_Fibonacci_Reply_Original.pdf" download>
                <Button variant="default" size="sm" className="gap-2">
                  <Download className="h-4 w-4" />
                  Download to view
                </Button>
              </a>
            </div>
          ) : (
            <iframe
              src="/downloads/Paper_G_Fibonacci_Reply_Original.pdf"
              className="w-full h-full border-0"
              title="Original Paper G PDF"
              onError={() => setPdfError(true)}
              data-testid="iframe-original-pdf"
            />
          )}
        </div>

        <div className="mt-4 flex justify-between items-center">
          <p className="text-xs text-muted-foreground">
            Preprint: <a href="https://research-square.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">Research Square</a>
          </p>
          <Link href="/paper-g-revision">
            <Button size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700" data-testid="btn-view-revision">
              View Revised Version
              <ExternalLink className="h-3 w-3" />
            </Button>
          </Link>
        </div>

      </div>
    </div>
  );
}
