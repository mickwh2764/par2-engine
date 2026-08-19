import { Router } from "express";
import fs from "fs";
import path from "path";
import archiver from "archiver";

export const assessmentPackageRouter = Router();

const ROOT = process.cwd();

function readIfExists(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

const README = `# PAR(2) Discovery Engine — AI Assessment Package
Generated: {{DATE}}

This package contains everything needed for a comprehensive AI assessment of
the PAR(2) Discovery Engine platform (par2discovery.com).

## What is PAR(2)?
PAR(2) is a time-series analysis framework that measures the temporal
persistence of gene expression dynamics using second-order autoregressive
(AR(2)) models. The core output is an eigenvalue modulus |λ| that quantifies
how self-sustaining a gene's dynamics are. The framework is applied to
circadian biology, cancer, neurodegeneration, and metabolic disease.

## Package contents

### /book/
The full companion book chapters explaining the framework, methods, worked
examples, and glossary. Start here for an overview.

  book_preface.md          — Context, companion framing, and the three-tier
                             confidence system (Established / Exploratory /
                             Prediction)
  book_fibonacci_foundations.md — Mathematical proofs establishing 1/φ as the
                             AR(2) stability supremum under Fibonacci structure
  book_methods_comparison.md    — How PAR(2) compares to JTK_CYCLE, cosinor,
                             RAIN, DESeq2 etc.
  book_worked_example.md   — Step-by-step: raw GEO data → eigenvalue modulus
  book_glossary.md         — All technical terms defined

### /papers/
Published and submitted manuscripts.

  paper_g_fibonacci_reply.pdf  — Accepted paper in The Fibonacci Quarterly
                                 (doi:10.1080/00150517.2026.2716122). Contains
                                 all algebraic proofs.
  paper_o_organoid.pdf         — Organoid circadian hierarchy (Paper O).

### /validation/
Key validation and evidence documents.

  PAR2_CORE_PIPELINE_v1.0.md  — Normative pipeline spec (v1.0, frozen
                                  2026-08-14). Authoritative definition of
                                  the five-dataset clock–target eigenvalue
                                  hierarchy analysis: inputs, AR(2) estimator,
                                  eigenvalue computation, and permutation scheme.
  MASTER_VALIDATION_RESULTS.md — Summary of all pre-registered predictions
                                  and their outcomes.
  RECONCILIATION_TABLE.md      — Cross-preprocessing reconciliation: Clock >
                                  Target under Raw OLS, Detrended, Global-mean
                                  residual, and PC1 residual AR(2).
  PREREGISTERED_VALIDATION_PLAN.md — The pre-registration document (filed
                                     before analyses were run).
  Appendix_Dataset_Admissibility.md — Dataset inclusion/exclusion criteria.

## Three-tier confidence system
Claims throughout are tagged:
  🟢 Established  — reproduced across independent datasets, verifiable at
                     par2discovery.com today
  🟡 Exploratory  — consistent but not yet independently replicated
  🔵 Prediction   — untested; requires external data or wet-lab experiments

## Live platform
All analyses are reproducible interactively at:
  par2discovery.com/dashboard
  par2discovery.com/robustness-suite
  par2discovery.com/validation-suite
  par2discovery.com/method-validation
  par2discovery.com/boman-simulation

Source code archived at Zenodo (archive in preparation; DOI to be confirmed).
Correspondence: mickwh@msn.com
`;

assessmentPackageRouter.get("/api/assessment-package/download", async (req, res) => {
  try {
    const archive = archiver("zip", { zlib: { level: 6 } });

    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="PAR2_Assessment_Package.zip"'
    );

    archive.on("error", (err) => {
      console.error("Assessment package archive error:", err);
      if (!res.headersSent) res.status(500).json({ error: "Archive failed" });
    });

    archive.pipe(res);

    // README
    archive.append(
      README.replace("{{DATE}}", new Date().toISOString().split("T")[0]),
      { name: "README.md" }
    );

    // Book chapters
    const bookFiles = [
      "book_preface.md",
      "book_fibonacci_foundations.md",
      "book_methods_comparison.md",
      "book_worked_example.md",
      "book_glossary.md",
    ];
    for (const f of bookFiles) {
      const content = readIfExists(path.join(ROOT, "manuscripts", f));
      if (content) archive.append(content, { name: `book/${f}` });
    }

    // Validation / evidence documents
    const validationFiles = [
      "PAR2_CORE_PIPELINE_v1.0.md",
      "MASTER_VALIDATION_RESULTS.md",
      "PREREGISTERED_VALIDATION_PLAN.md",
      "Appendix_Dataset_Admissibility.md",
      "REVIEWER_SAFE_SUMMARY.md",
    ];
    for (const f of validationFiles) {
      const content = readIfExists(path.join(ROOT, "manuscripts", f));
      if (content) archive.append(content, { name: `validation/${f}` });
    }

    // Reconciliation table — always added as a named file
    const reconcContent = readIfExists(path.join(ROOT, "manuscripts", "RECONCILIATION_TABLE.md"));
    if (reconcContent) {
      archive.append(reconcContent, { name: "validation/RECONCILIATION_TABLE.md" });
    }

    // Static PDFs from public/downloads
    const downloadsDir = path.join(ROOT, "public", "downloads");
    const pdfMap: Record<string, string> = {
      "Whiteside_FQ_Revision_v2_0_corrected.pdf": "papers/paper_g_fibonacci_reply.pdf",
      "PaperO_Organoid_Circadian_Hierarchy.pdf":   "papers/paper_o_organoid.pdf",
    };
    for (const [src, dest] of Object.entries(pdfMap)) {
      const fullPath = path.join(downloadsDir, src);
      if (fs.existsSync(fullPath)) {
        archive.file(fullPath, { name: dest });
      }
    }

    // Benchmark comparison — AR(2) vs JTK_CYCLE vs Cosinor
    const benchmarkDir = path.join(ROOT, "analysis", "outputs", "benchmark");
    const benchmarkSummary = readIfExists(path.join(benchmarkDir, "benchmark_summary.txt"));
    if (benchmarkSummary) {
      archive.append(benchmarkSummary, { name: "validation/benchmark_vs_jtk_cosinor.txt" });
    }
    const benchmarkCsv = readIfExists(path.join(benchmarkDir, "GSE70499_benchmark_results.csv"));
    if (benchmarkCsv) {
      archive.append(benchmarkCsv, { name: "validation/benchmark_results.csv" });
    }
    const benchmarkFigures = [
      { src: "benchmark_scatter.png",     dest: "validation/figures/benchmark_scatter.png" },
      { src: "benchmark_concordance.png", dest: "validation/figures/benchmark_concordance.png" },
      { src: "benchmark_clock_genes.png", dest: "validation/figures/benchmark_clock_genes.png" },
    ];
    for (const { src, dest } of benchmarkFigures) {
      const fullPath = path.join(benchmarkDir, src);
      if (fs.existsSync(fullPath)) {
        archive.file(fullPath, { name: dest });
      }
    }

    await archive.finalize();
  } catch (err) {
    console.error("Assessment package error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to generate assessment package" });
    }
  }
});

// Manifest — lets the client know what will be in the ZIP before downloading
assessmentPackageRouter.get("/api/assessment-package/manifest", (_req, res) => {
  const bookFiles = [
    "book_preface.md",
    "book_fibonacci_foundations.md",
    "book_methods_comparison.md",
    "book_worked_example.md",
    "book_glossary.md",
  ];
  const validationFiles = [
    "PAR2_CORE_PIPELINE_v1.0.md",
    "MASTER_VALIDATION_RESULTS.md",
    "RECONCILIATION_TABLE.md",
    "PREREGISTERED_VALIDATION_PLAN.md",
    "Appendix_Dataset_Admissibility.md",
    "REVIEWER_SAFE_SUMMARY.md",
  ];
  const pdfs = [
    "Whiteside_FQ_Revision_v2_0_corrected.pdf",
    "PaperO_Organoid_Circadian_Hierarchy.pdf",
  ];

  const benchmarkDir = path.join(ROOT, "analysis", "outputs", "benchmark");
  const benchmarkItems = [
    {
      folder: "validation",
      name: "benchmark_vs_jtk_cosinor.txt",
      description: "Head-to-head benchmark: AR(2) vs JTK_CYCLE vs Cosinor — concordance rates and clock gene ranking table",
      exists: fs.existsSync(path.join(benchmarkDir, "benchmark_summary.txt")),
    },
    {
      folder: "validation",
      name: "benchmark_results.csv",
      description: "Full per-gene benchmark results table (GSE70499) with AR(2), JTK_CYCLE, and Cosinor calls",
      exists: fs.existsSync(path.join(benchmarkDir, "GSE70499_benchmark_results.csv")),
    },
    {
      folder: "validation",
      name: "figures/benchmark_scatter.png",
      description: "Scatter plot: AR(2) |λ| vs JTK_CYCLE BH.Q — figure showing method agreement",
      exists: fs.existsSync(path.join(benchmarkDir, "benchmark_scatter.png")),
    },
    {
      folder: "validation",
      name: "figures/benchmark_concordance.png",
      description: "Concordance bar chart — AR(2) vs JTK_CYCLE vs Cosinor overlap on clock genes",
      exists: fs.existsSync(path.join(benchmarkDir, "benchmark_concordance.png")),
    },
    {
      folder: "validation",
      name: "figures/benchmark_clock_genes.png",
      description: "Clock gene ranking panel — per-gene |λ| ranked by AR(2) alongside JTK/Cosinor calls",
      exists: fs.existsSync(path.join(benchmarkDir, "benchmark_clock_genes.png")),
    },
  ];

  const items = [
    ...bookFiles.map((f) => ({
      folder: "book",
      name: f,
      description: getBookDesc(f),
      exists: fs.existsSync(path.join(ROOT, "manuscripts", f)),
    })),
    ...validationFiles.map((f) => ({
      folder: "validation",
      name: f,
      description: getValidationDesc(f),
      exists: fs.existsSync(path.join(ROOT, "manuscripts", f)),
    })),
    ...benchmarkItems,
    ...pdfs.map((f) => ({
      folder: "papers",
      name: getPdfDest(f),
      description: getPdfDesc(f),
      exists: fs.existsSync(path.join(ROOT, "public", "downloads", f)),
    })),
  ];

  res.json({ items, totalFiles: items.filter((i) => i.exists).length });
});

function getBookDesc(f: string): string {
  const map: Record<string, string> = {
    "book_preface.md": "Context, companion framing, and the three-tier confidence system",
    "book_fibonacci_foundations.md": "Mathematical proofs establishing 1/φ as the AR(2) stability supremum",
    "book_methods_comparison.md": "PAR(2) vs JTK_CYCLE, cosinor, RAIN — what each method measures",
    "book_worked_example.md": "Step-by-step: raw GEO data → eigenvalue modulus (Python code included)",
    "book_glossary.md": "All technical terms defined for biology, maths, and clinical readers",
  };
  return map[f] ?? f;
}

function getValidationDesc(f: string): string {
  const map: Record<string, string> = {
    "PAR2_CORE_PIPELINE_v1.0.md": "Normative pipeline spec v1.0 — authoritative definition of inputs, AR(2) estimator, eigenvalue computation, stability gate, and permutation scheme used in all manuscripts",
    "MASTER_VALIDATION_RESULTS.md": "All pre-registered predictions and their outcomes",
    "RECONCILIATION_TABLE.md": "Cross-preprocessing reconciliation — Clock > Target finding under Raw OLS, Detrended, Global-mean residual, and PC1 residual AR(2)",
    "PREREGISTERED_VALIDATION_PLAN.md": "Pre-registration document filed before analyses ran",
    "Appendix_Dataset_Admissibility.md": "Dataset inclusion/exclusion criteria",
    "REVIEWER_SAFE_SUMMARY.md": "Reviewer-facing summary of the evidence",
  };
  return map[f] ?? f;
}

function getPdfDest(f: string): string {
  const map: Record<string, string> = {
    "Whiteside_FQ_Revision_v2_0_corrected.pdf": "paper_g_fibonacci_reply.pdf",
    "PaperO_Organoid_Circadian_Hierarchy.pdf": "paper_o_organoid.pdf",
  };
  return map[f] ?? f;
}

function getPdfDesc(f: string): string {
  const map: Record<string, string> = {
    "Whiteside_FQ_Revision_v2_0_corrected.pdf":
      "Accepted paper — The Fibonacci Quarterly (doi:10.1080/00150517.2026.2716122). All algebraic proofs.",
    "PaperO_Organoid_Circadian_Hierarchy.pdf":
      "Organoid circadian hierarchy paper (Paper O).",
  };
  return map[f] ?? f;
}
