/**
 * REST API endpoints for programmatic PAR(2) analysis.
 *
 * These endpoints allow external tools, scripts, and pipelines to submit
 * expression data and receive AR(2) eigenvalue results as JSON, without
 * needing to use the web UI.
 *
 * Endpoints:
 *   POST /api/v1/analyze       — Fit AR(2) to uploaded CSV, return per-gene results + hierarchy
 *   POST /api/v1/analyze/json  — Fit AR(2) to JSON payload (no file upload needed)
 *   GET  /api/v1/health        — Health check
 */

import type { Express, Request, Response } from "express";
import multer from "multer";
import { fitAR2, computeEigenvalue, computeEigenperiod, computeHalfLife, classifyStability } from "../ar2-shared";
import { APP_VERSION } from "@shared/version";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".csv", ".tsv", ".txt"];
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf("."));
    cb(null, allowed.includes(ext));
  },
});

const CORE_CLOCK_GENES = new Set([
  "Per1", "Per2", "Per3", "Cry1", "Cry2", "Clock", "Arntl", "Bmal1",
  "Nr1d1", "Nr1d2", "Dbp", "Tef", "Npas2", "Rorc", "Rora",
  "PER1", "PER2", "PER3", "CRY1", "CRY2", "CLOCK", "ARNTL",
  "NR1D1", "NR1D2", "DBP", "TEF", "NPAS2", "RORC", "RORA",
]);

const KNOWN_TARGET_GENES = new Set([
  "Myc", "Ccnd1", "Wee1", "Chek2", "Tp53", "Cdkn1a", "Bcl2", "Bax",
  "Ccne1", "Ccne2", "Mcm6", "Mki67", "Lgr5", "Axin2",
  "MYC", "CCND1", "WEE1", "CHEK2", "TP53", "CDKN1A", "BCL2", "BAX",
  "CCNE1", "CCNE2", "MCM6", "MKI67", "LGR5", "AXIN2",
]);

interface GeneResult {
  gene: string;
  eigenvalue: number;
  phi1: number;
  phi2: number;
  r2: number;
  root_type: "Complex" | "Real";
  half_life: number | null;
  eigenperiod: number | null;
  stability: string;
  layer: "Clock" | "Target" | "Background";
}

function classifyLayer(gene: string): "Clock" | "Target" | "Background" {
  if (CORE_CLOCK_GENES.has(gene)) return "Clock";
  if (KNOWN_TARGET_GENES.has(gene)) return "Target";
  return "Background";
}

function parseCSV(content: string, delimiter: string = ","): { genes: string[]; matrix: number[][] } {
  const lines = content.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error("CSV must have at least a header row and one data row");

  const genes: string[] = [];
  const matrix: number[][] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delimiter);
    if (cols.length < 2) continue;

    const gene = cols[0].trim().replace(/^"|"$/g, "");
    if (!gene) continue;

    const values = cols.slice(1).map(v => {
      const n = parseFloat(v.trim());
      return isNaN(n) ? NaN : n;
    });

    genes.push(gene);
    matrix.push(values);
  }

  return { genes, matrix };
}

function analyzeMatrix(
  genes: string[],
  matrix: number[][],
  samplingInterval: number,
): { results: GeneResult[]; hierarchy: any } {
  const results: GeneResult[] = [];

  for (let i = 0; i < genes.length; i++) {
    const values = matrix[i].filter(v => !isNaN(v));
    if (values.length < 6) continue;

    const fit = fitAR2(values);
    if (!fit) continue;

    const eigenperiod = computeEigenperiod(fit.phi1, fit.phi2, samplingInterval);
    const halfLife = computeHalfLife(fit.eigenvalue, samplingInterval);
    const { stability } = classifyStability(fit.eigenvalue);

    results.push({
      gene: genes[i],
      eigenvalue: Math.round(fit.eigenvalue * 1e6) / 1e6,
      phi1: Math.round(fit.phi1 * 1e6) / 1e6,
      phi2: Math.round(fit.phi2 * 1e6) / 1e6,
      r2: Math.round(fit.r2 * 1e6) / 1e6,
      root_type: fit.isComplex ? "Complex" : "Real",
      half_life: halfLife !== null ? Math.round(halfLife * 1e4) / 1e4 : null,
      eigenperiod: eigenperiod !== null ? Math.round(eigenperiod * 1e4) / 1e4 : null,
      stability,
      layer: classifyLayer(genes[i]),
    });
  }

  results.sort((a, b) => b.eigenvalue - a.eigenvalue);

  // Hierarchy
  const clockEVs = results.filter(r => r.layer === "Clock").map(r => r.eigenvalue);
  const targetEVs = results.filter(r => r.layer === "Target").map(r => r.eigenvalue);
  const bgEVs = results.filter(r => r.layer === "Background").map(r => r.eigenvalue);

  const median = (arr: number[]) => {
    if (!arr.length) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };

  const clockMed = median(clockEVs);
  const targetMed = median(targetEVs);
  const bgMed = median(bgEVs);
  const gap = clockMed - targetMed;

  let healthGrade: string;
  if (gap >= 0.15) healthGrade = "A";
  else if (gap >= 0.10) healthGrade = "B";
  else if (gap >= 0.05) healthGrade = "C";
  else if (gap >= 0.02) healthGrade = "D";
  else healthGrade = "F";

  const hierarchy = {
    clock_median: Math.round(clockMed * 1e4) / 1e4,
    target_median: Math.round(targetMed * 1e4) / 1e4,
    background_median: Math.round(bgMed * 1e4) / 1e4,
    gearbox_gap: Math.round(gap * 1e4) / 1e4,
    hierarchy_preserved: clockMed > targetMed && targetMed > bgMed,
    health_grade: healthGrade,
    n_clock: clockEVs.length,
    n_target: targetEVs.length,
    n_background: bgEVs.length,
  };

  return { results, hierarchy };
}

export function registerAPIRoutes(app: Express): void {
  // Health check
  app.get("/api/v1/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      api_version: "v1",
      version: APP_VERSION,
      engine: "PAR(2) Discovery Engine",
      endpoints: [
        "POST /api/v1/analyze       — Upload CSV for analysis",
        "POST /api/v1/analyze/json  — Submit JSON payload",
        "GET  /api/v1/health        — This endpoint",
      ],
    });
  });

  // CSV upload analysis
  app.post("/api/v1/analyze", upload.single("file"), (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No file uploaded. Send a CSV as multipart form-data with field name 'file'." });
        return;
      }

      const delimiter = (req.query.delimiter as string) || ",";
      const samplingInterval = parseFloat((req.query.sampling_interval as string) || "2");

      const content = req.file.buffer.toString("utf-8");
      const { genes, matrix } = parseCSV(content, delimiter);

      if (genes.length === 0) {
        res.status(400).json({ error: "No valid gene rows found in CSV." });
        return;
      }

      const { results, hierarchy } = analyzeMatrix(genes, matrix, samplingInterval);

      const topN = req.query.top ? parseInt(req.query.top as string, 10) : undefined;
      const filteredResults = topN ? results.slice(0, topN) : results;

      res.json({
        meta: {
          n_genes_input: genes.length,
          n_genes_fitted: results.length,
          n_timepoints: matrix[0]?.length || 0,
          sampling_interval_hours: samplingInterval,
          filename: req.file.originalname,
        },
        hierarchy,
        results: filteredResults,
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message || "Failed to parse CSV" });
    }
  });

  // JSON payload analysis (no file upload needed)
  app.post("/api/v1/analyze/json", (req: Request, res: Response) => {
    try {
      const { genes, matrix, sampling_interval = 2 } = req.body;

      if (!genes || !Array.isArray(genes)) {
        res.status(400).json({
          error: "Request body must include 'genes' (array of gene name strings).",
          example: {
            genes: ["Per2", "Arntl", "Gapdh"],
            matrix: [[1.2, 3.4, 2.1, 4.5, 3.2, 5.1], [2.3, 4.5, 3.2, 5.6, 4.3, 6.2], [5.0, 5.1, 4.9, 5.0, 5.1, 5.0]],
            sampling_interval: 2,
          },
        });
        return;
      }

      if (!matrix || !Array.isArray(matrix) || matrix.length !== genes.length) {
        res.status(400).json({ error: "'matrix' must be a 2D array with one row per gene." });
        return;
      }

      const { results, hierarchy } = analyzeMatrix(genes, matrix, sampling_interval);

      res.json({
        meta: {
          n_genes_input: genes.length,
          n_genes_fitted: results.length,
          n_timepoints: matrix[0]?.length || 0,
          sampling_interval_hours: sampling_interval,
        },
        hierarchy,
        results,
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message || "Analysis failed" });
    }
  });
}
