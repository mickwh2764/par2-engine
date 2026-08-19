import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Download, FileText, CheckCircle, AlertCircle, Archive, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const CHANGES = [
  {
    reviewer: "Reviewer 1 · Comment 1",
    status: "addressed",
    summary: "Cell-type rationale made explicit",
    detail:
      "Section 5 now opens with a structured 3-part rationale: GSE157357 is the only publicly available simultaneous WT/clock-disrupted circadian crypt time-series; tuft cells are chosen for their ≥28-day lifespan (most sensitive eigenvalue readout); DCS cells are chosen as physical implementors of the PAR(2) memory kernels at the crypt base.",
  },
  {
    reviewer: "Reviewer 1 · Comment 2",
    status: "addressed",
    summary: "Mouse/human mismatch prominently flagged",
    detail:
      'Bold-labelled "Limitation: model–data mismatch" paragraph added in Section 4, naming specific biological differences (LGR5 density, villus structure, crypt length, cancer susceptibility). States these are proof-of-concept fits only.',
  },
  {
    reviewer: "Reviewer 1 · Comment 3",
    status: "addressed",
    summary: "Reference 5 attribution corrected",
    detail:
      'Citation changed from "Speck and colleagues" to "Bormashenko". Reference reformatted correctly: Bormashenko, E. Fibonacci sequences, symmetry and order… Foundations. 2(3):Art. 27, 2022.',
  },
  {
    reviewer: "Reviewer 1 · Comment 4",
    status: "addressed",
    summary: "Fibonacci-consistent manifold formally defined in Section 6",
    detail:
      "Manifold defined as the subset of the stable AR(2) stationarity triangle within a specified Euclidean distance of the ray from the origin through the Fibonacci point (1,1), bounded by Rules 3 & 4. Future-work language ('formalise a Fibonacci-consistent region') removed — replaced with a cross-reference back to the definition.",
  },
  {
    reviewer: "Reviewer 1 · Comment 5",
    status: "addressed",
    summary: "Damped vs unstable roots explicitly clarified in Section 6",
    detail:
      "New 'Critical clarification' paragraph: the Fibonacci point (1,1) has |λ|≈1.618 (explosive, outside stationarity triangle). Observed biological roots range 0.366–0.832 across seven crypt genes (corrected analysis; see Table 1 note), all well within the unit disk. Four genes (Axin2, Nr1d1, Nr1d2, Hes1) fall within ±0.05 of 1/φ = 0.618. The five rules enforce the sub-unit-root regime; 1/φ is the geometric boundary landmark of the admissible parameter space.",
  },
  {
    reviewer: "Editor · e.g. → e.g.,",
    status: "addressed",
    summary: "All 'e.g.' instances corrected throughout",
    detail: "Zero instances of 'e.g.' without a trailing comma remain in the .tex source (verified by grep).",
  },
  {
    reviewer: "Editor · Disclosure Statement",
    status: "addressed",
    summary: "Disclosure statement updated — patent declared",
    detail:
      'UK patent application GB2518973.9 (related to the AR(2) eigenvalue methodology) declared. Full statement: "The author has filed a UK patent application (GB2518973.9) related to the AR(2) eigenvalue methodology described in this work. The author declares no other conflicts of interest."',
  },
  {
    reviewer: "Editor · References",
    status: "addressed",
    summary: "References reformatted to FQ alphabetical style",
    detail:
      "All 11 references in alphabetical order by last name, Last Name Initials format, no quotation marks, abbreviated journal titles. Duplicate [11] removed. Phys.org news article (no author) removed.",
  },
  {
    reviewer: "Editor · Pages 11–19",
    status: "addressed",
    summary: "Extraneous pages removed",
    detail: "Revised manuscript is 8 pages (down from 19).",
  },
];

export default function PaperGRevision() {
  const [activeTab, setActiveTab] = useState<"changes" | "preview">("changes");

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
            <Badge variant="outline" className="text-muted-foreground font-mono text-xs">Whiteside_FQ_Revision_v1</Badge>
          </div>
          <h1 className="text-2xl font-bold text-foreground leading-tight">
            A Time-Domain Analogue to Fibonacci Structure via Phase-Gated AR(2) Dynamics
          </h1>
          <p className="text-sm text-muted-foreground">
            Published in The Fibonacci Quarterly (accepted 1 August 2026). Journal doi:{" "}
            <a href="https://doi.org/10.1080/00150517.2026.2716122" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">10.1080/00150517.2026.2716122</a>.
            Addresses all 9 reviewer and editorial points. Zenodo: <a href="https://doi.org/10.5281/zenodo.21683091" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">10.5281/zenodo.21683091</a>.
            See the{" "}
            <Link href="/paper-g-original">
              <span className="text-amber-400 hover:underline cursor-pointer">original submitted version</span>
            </Link>{" "}
            for comparison.
          </p>
        </div>

        {/* Download bar */}
        <div className="flex flex-wrap items-center gap-3 mb-3 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5">
          <Archive className="h-5 w-5 text-emerald-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-emerald-300">Published — The Fibonacci Quarterly · doi:10.1080/00150517.2026.2716122</p>
            <p className="text-xs text-muted-foreground">
              Zip contains: revised manuscript · interact.cls template · author reply letter
            </p>
          </div>
          <a href="/downloads/Whiteside_FQ_Revision_v1.zip" download>
            <Button size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700 shrink-0" data-testid="btn-download-revision-zip">
              <Download className="h-4 w-4" />
              Download full package (.zip)
            </Button>
          </a>
        </div>
        <div className="flex flex-wrap gap-2 mb-6">
          <a href="/downloads/Whiteside_FQ_Revision_v1.zip" download>
            <Button variant="outline" size="sm" className="gap-2 text-xs" data-testid="btn-download-zip-small">
              <Archive className="h-3.5 w-3.5" />
              Whiteside_FQ_Revision_v1.zip
            </Button>
          </a>
          <span className="text-xs text-muted-foreground self-center">Includes Author_Reply_Whiteside_FQ.tex — compile separately to produce the reviewer response PDF</span>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-2 mb-4">
          <Button
            variant={activeTab === "changes" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("changes")}
            data-testid="tab-changes"
          >
            <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
            All Changes ({CHANGES.length})
          </Button>
          <Button
            variant={activeTab === "preview" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("preview")}
            data-testid="tab-preview"
          >
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            PDF Preview
          </Button>
        </div>

        {/* Changes tab */}
        {activeTab === "changes" && (
          <div className="space-y-3">
            {CHANGES.map((c, i) => (
              <Card key={i} className="border-emerald-500/20 bg-card" data-testid={`card-change-${i}`}>
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs text-muted-foreground font-normal shrink-0">
                        {c.reviewer}
                      </Badge>
                      <CardTitle className="text-sm font-semibold text-foreground">
                        {c.summary}
                      </CardTitle>
                    </div>
                    <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0">
                  <p className="text-xs text-muted-foreground leading-relaxed">{c.detail}</p>
                </CardContent>
              </Card>
            ))}

            <div className="mt-4 p-4 rounded-xl border border-border bg-muted/30 flex items-start gap-3">
              <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-amber-300 mb-1">Submission checklist (completed — kept for the record)</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>☐ Compile in Overleaf using interact.cls — confirm 8 pages</li>
                  <li>☐ Read through compiled PDF once before uploading to journal</li>
                  <li>☐ Prepare point-by-point response letter to reviewers</li>
                  <li>☐ Submit via Fibonacci Quarterly submission portal by 21 June 2026</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* PDF Preview tab */}
        {activeTab === "preview" && (
          <div>
            <div className="flex items-center gap-3 mb-3">
              <p className="text-xs text-muted-foreground">
                Showing compiled PDF from earlier build. For the latest revision, compile
                <code className="bg-muted px-1 rounded mx-1">Whiteside_FQ_Revision_v1.tex</code>
                in Overleaf.
              </p>
              <a href="/downloads/PaperG_Fibonacci_PAR2_Revised.pdf" download className="shrink-0">
                <Button variant="outline" size="sm" className="gap-2" data-testid="btn-download-pdf-preview">
                  <Download className="h-3.5 w-3.5" />
                  Download PDF
                </Button>
              </a>
            </div>
            <div className="rounded-xl border border-border overflow-hidden bg-card" style={{ height: "75vh" }}>
              <iframe
                src="/downloads/PaperG_Fibonacci_PAR2_Revised.pdf"
                className="w-full h-full border-0"
                title="Revised Paper G PDF Preview"
                data-testid="iframe-revised-pdf"
              />
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
