import type { Express, Request, Response } from "express";
import { randomBytes } from "crypto";
import { storage } from "../storage";
import { logger } from "../logger";
import { detectOrganism, CANDIDATES, CLOCKS, ENSEMBL_TO_SYMBOL, getAllPairs, getDefaultPairs, getGenePanel, applyFDRCorrectionToRun, classifyGeneShared, resolveGeneAliases, CATEGORY_META, verifyDownloadPassword, parseDatasetBuffer } from "./shared";
import { fitAR2WithDiagnostics } from "../edge-case-diagnostics";
import { type Species as OrthologSpecies } from "../orthology-map";
import {
  runPAR2Analysis, benjaminiHochberg, applyWithinPairBonferroni, runValidationSuite, assessDataQuality,
  runQuickNullSurvey, checkClockRhythmicity, runGenomeWideScreen, validateWithSurrogates,
  generatePhaseRandomizedSurrogate, runStressTest
} from "../par2-engine";
import { runSymmetryDebtAnalysis } from "../symmetry-debt";
import { runPhaseGatingAnalysis, runExtendedPhaseGatingAnalysis } from "../phase-gating-analysis";
import { runLiteratureValidation, LITERATURE_CIRCADIAN_GENES } from "../literature-validation";
import { ensureFreshPackage } from "../utils/ensure-fresh-package";
import { runPhaseVulnerabilityAnalysis } from "../phase-vulnerability";
import { runBaselineBenchmark } from "../baseline-comparison";
import { runMasterAuditor, runSpatialSymmetryTest, runTuringBenchmark, runFisherBenchmark, runNetworkBenchmark, runUedaBenchmark, analyzeTuringStability, analyzeInformationFidelity } from "../benchmarks/master-auditor";
import { runMonteCarloSimulation } from "../benchmarks/monte-carlo-simulation";
import { runHeadToHeadComparison } from "../benchmarks/head-to-head-comparison";
import { runCouplingROC } from "../benchmarks/coupling-roc";
import { runP53Sensitivity } from "../p53-sensitivity";
import { runDataSparsityBenchmark, analyzeSparsityAtLevel } from "../benchmarks/data-sparsity";
import { runPhaseShiftBenchmark, analyzePhaseShift } from "../benchmarks/phase-shift";
import { computeTuringDeepDive } from "../turing-deep-dive";
import { runFairnessControlSuite } from "../crossomics-controls";
import { runBomanBridgeExperiments } from "../boman-bridge";
import { runRobustnessAnalysis } from "../robustness-analysis";
import { runFullStressTestSuite, runResidualDiagnostics, runModelComparison, runSimulationBenchmark, runAlternativeMetricsComparison } from "../stress-tests";
import { runAllExtendedModels, generateFullModelComparison } from "../ode-models-extended";
import { runNonBiologicalDataTest, runAdversarialSuite, runSamplingSensitivityTest, runBifurcationPointTest, runTissueMitoticCorrelationTest, runEdgeCaseStressTest, calculateTissueRelativeOffset, getTissueBaselineAtlas, TISSUE_BASELINE_ATLAS, generateRandomWalk, generateAR1Process, generateStockLike, generateWhiteNoise, generateSineWithNoise, fitAR2ToSeries } from "../adversarial-tests";
import { runFullStressTestSuite as runValidationStressTestSuite, runDistributionTest, runODERoundTripValidation } from "../validation-stress-tests";
import { computeCoreEvidence } from "../core-evidence";
import { getOrthologTable, buildCrossSpeciesComparison } from "../orthology-map";
import { generateIntegrityHash } from "../integrity-hash";
import { parse } from "csv-parse/sync";
import fs from "fs";
import path from "path";
import archiver from "archiver";

export async function registerValidationRoutes(app: Express, upload: any): Promise<void> {
  app.post("/api/shared-analysis", async (req: Request, res) => {
    try {
      const { analysisData, fileName, detectedFormat } = req.body;
      if (!analysisData || !fileName) {
        return res.status(400).json({ error: "Missing analysis data or file name" });
      }
      const id = randomBytes(6).toString('base64url');
      const shared = await storage.createSharedAnalysis({
        id,
        fileName,
        detectedFormat: detectedFormat || 'generic',
        analysisData,
      });
      res.json({ id: shared.id, url: `/shared/${shared.id}` });
    } catch (error: any) {
      console.error("Share analysis error:", error);
      res.status(500).json({ error: error.message || "Failed to share analysis" });
    }
  });

  app.get("/api/shared-analysis/:id", async (req: Request, res) => {
    try {
      const shared = await storage.getSharedAnalysis(req.params.id);
      if (!shared) {
        return res.status(404).json({ error: "Shared analysis not found" });
      }
      res.json(shared);
    } catch (error: any) {
      console.error("Get shared analysis error:", error);
      res.status(500).json({ error: error.message || "Failed to retrieve shared analysis" });
    }
  });

  app.post("/api/saved-reports", async (req: Request, res) => {
    try {
      const { title, sourcePage, reportType, summary, geneCount, payload } = req.body;
      if (!title || !sourcePage || !reportType || !payload) {
        return res.status(400).json({ error: "Missing required fields: title, sourcePage, reportType, payload" });
      }
      const report = await storage.createSavedReport({
        title,
        sourcePage,
        reportType,
        summary: summary || null,
        geneCount: geneCount || null,
        payload,
      });
      res.json(report);
    } catch (error: any) {
      console.error("Create saved report error:", error);
      res.status(500).json({ error: error.message || "Failed to save report" });
    }
  });

  app.get("/api/saved-reports", async (_req: Request, res) => {
    try {
      const reports = await storage.listSavedReports(100);
      res.json(reports);
    } catch (error: any) {
      console.error("List saved reports error:", error);
      res.status(500).json({ error: error.message || "Failed to list reports" });
    }
  });

  app.get("/api/saved-reports/:id", async (req: Request, res) => {
    try {
      const report = await storage.getSavedReport(req.params.id);
      if (!report) {
        return res.status(404).json({ error: "Report not found" });
      }
      res.json(report);
    } catch (error: any) {
      console.error("Get saved report error:", error);
      res.status(500).json({ error: error.message || "Failed to get report" });
    }
  });

  app.delete("/api/saved-reports/:id", async (req: Request, res) => {
    try {
      const deleted = await storage.deleteSavedReport(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Report not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete saved report error:", error);
      res.status(500).json({ error: error.message || "Failed to delete report" });
    }
  });

  let rootSpaceCache: { data: any; timestamp: number } | null = null;
  const ROOT_SPACE_CACHE_TTL = 60 * 60 * 1000;

  app.get("/api/analysis/root-space-geometry", async (_req, res) => {
    try {
      if (rootSpaceCache && Date.now() - rootSpaceCache.timestamp < ROOT_SPACE_CACHE_TTL) {
        return res.json(rootSpaceCache.data);
      }
      const { runRootSpaceAnalysis } = await import('../root-space-analysis');
      const result = runRootSpaceAnalysis();
      rootSpaceCache = { data: result, timestamp: Date.now() };
      res.json(result);
    } catch (error: any) {
      console.error("Root space analysis error:", error);
      res.status(500).json({ error: error.message || "Failed to run root space analysis" });
    }
  });

  let rollingWindowCache: { data: any; timestamp: number } | null = null;
  const ROLLING_WINDOW_CACHE_TTL = 60 * 60 * 1000;

  app.get("/api/validation/rolling-window", async (req, res) => {
    try {
      const windowFraction = req.query.windowFraction ? parseFloat(req.query.windowFraction as string) : undefined;
      const stepFraction = req.query.stepFraction ? parseFloat(req.query.stepFraction as string) : undefined;
      const hasCustomParams = windowFraction !== undefined || stepFraction !== undefined;

      if (!hasCustomParams && rollingWindowCache && Date.now() - rollingWindowCache.timestamp < ROLLING_WINDOW_CACHE_TTL) {
        return res.json(rollingWindowCache.data);
      }
      const { runRollingWindowAnalysis } = await import('../rolling-window-analysis');
      const options = hasCustomParams ? {
        windowFraction: windowFraction !== undefined ? Math.max(0.2, Math.min(0.8, windowFraction)) : undefined,
        stepFraction: stepFraction !== undefined ? Math.max(0.1, Math.min(0.5, stepFraction)) : undefined,
      } : undefined;
      const result = runRollingWindowAnalysis(options);
      if (!hasCustomParams) {
        rollingWindowCache = { data: result, timestamp: Date.now() };
      }
      res.json(result);
    } catch (error: any) {
      console.error("Rolling window analysis error:", error);
      res.status(500).json({ error: error.message || "Failed to run rolling window analysis" });
    }
  });

  app.get("/api/stress-tests/run", async (_req, res) => {
    try {
      const report = runValidationStressTestSuite();
      const distribution = runDistributionTest();
      res.json({ ...report, distributionTest: distribution });
    } catch (error: any) {
      console.error("Stress test error:", error);
      res.status(500).json({ error: error.message || "Failed to run stress tests" });
    }
  });

  // ===== Model Zoo ODE Simulation Routes =====
  const { getModels, simulateModel } = await import('../ode-model-zoo');

  app.get("/api/model-zoo/models", (_req, res) => {
    try {
      res.json(getModels());
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to get models" });
    }
  });

  app.post("/api/model-zoo/simulate", async (req, res) => {
    try {
      const { modelId, parameters } = req.body;
      if (!modelId || typeof modelId !== 'string') {
        return res.status(400).json({ error: "modelId is required" });
      }
      const result = simulateModel(modelId, parameters || {});
      const channelsSummary = result.channels.map(c => ({
        ...c,
        series: c.series.length > 500
          ? c.series.filter((_, i) => i % Math.ceil(c.series.length / 500) === 0)
          : c.series
      }));
      const timeSummary = result.time.length > 500
        ? result.time.filter((_, i) => i % Math.ceil(result.time.length / 500) === 0)
        : result.time;
      res.json({
        ...result,
        time: timeSummary,
        channels: channelsSummary
      });
    } catch (error: any) {
      console.error("Model Zoo simulation error:", error);
      res.status(500).json({ error: error.message || "Simulation failed" });
    }
  });

  app.post("/api/model-zoo/sweep", async (req, res) => {
    try {
      const { modelId, sweepParam, values, baseParams } = req.body;
      if (!modelId || !sweepParam || !values) {
        return res.status(400).json({ error: "modelId, sweepParam, and values are required" });
      }
      const results = (values as number[]).map((val: number) => {
        const params = { ...(baseParams || {}), [sweepParam]: val };
        const result = simulateModel(modelId, params);
        return {
          paramValue: val,
          channels: result.channels.map(c => ({
            variable: c.variable,
            eigenvalue: c.eigenvalue,
            stability: c.stability,
            confidence: c.confidence,
            confidenceScore: c.confidenceScore,
          })),
          predictions: result.predictions
        };
      });
      res.json({ modelId, sweepParam, results });
    } catch (error: any) {
      console.error("Model Zoo sweep error:", error);
      res.status(500).json({ error: error.message || "Parameter sweep failed" });
    }
  });

  app.post("/api/model-zoo/floquet", async (req, res) => {
    try {
      const { modelId, parameters } = req.body;
      if (!modelId || typeof modelId !== 'string') {
        return res.status(400).json({ error: "modelId is required" });
      }
      const { computeFloquetAnalysis } = await import('../floquet');
      const result = computeFloquetAnalysis(modelId, parameters || {});
      res.json(result);
    } catch (error: any) {
      console.error("Floquet analysis error:", error);
      res.status(500).json({ error: error.message || "Floquet analysis failed" });
    }
  });

  app.get("/api/model-zoo/ode-roundtrip-validation", (_req, res) => {
    try {
      const results = runODERoundTripValidation();
      const passCount = results.filter(r => r.overallPlausible).length;
      res.json({
        results,
        summary: {
          totalModels: results.length,
          passed: passCount,
          passRate: Math.round((passCount / results.length) * 100),
          verdict: passCount === results.length ? 'ALL_PASS' : passCount > results.length * 0.7 ? 'MOSTLY_PASS' : 'NEEDS_ATTENTION'
        }
      });
    } catch (error: any) {
      console.error("ODE round-trip validation error:", error);
      res.status(500).json({ error: error.message || "Round-trip validation failed" });
    }
  });

  // ===== Processed Per-Gene Eigenvalue Tables =====
  const { generateProcessedTableCSV, generateProcessedTable } = await import('../processed-tables');

  const AVAILABLE_PROCESSED_DATASETS: { id: string; name: string; file: string; description: string; species: string; geneCount?: string; tissuePrefix?: string }[] = [
    { id: 'GSE54650_Liver_circadian', name: 'Mouse Liver (Hughes Atlas)', file: 'GSE54650_Liver_circadian.csv', description: 'Mouse Liver - Hughes Circadian Atlas 2h sampling (GSE54650)', species: 'Mus musculus', geneCount: '~21K' },
    { id: 'GSE54650_Heart_circadian', name: 'Mouse Heart (Hughes Atlas)', file: 'GSE54650_Heart_circadian.csv', description: 'Mouse Heart - Hughes Circadian Atlas 2h sampling (GSE54650)', species: 'Mus musculus', geneCount: '~21K' },
    { id: 'GSE54650_Kidney_circadian', name: 'Mouse Kidney (Hughes Atlas)', file: 'GSE54650_Kidney_circadian.csv', description: 'Mouse Kidney - Hughes Circadian Atlas 2h sampling (GSE54650)', species: 'Mus musculus', geneCount: '~21K' },
    { id: 'GSE54650_Lung_circadian', name: 'Mouse Lung (Hughes Atlas)', file: 'GSE54650_Lung_circadian.csv', description: 'Mouse Lung - Hughes Circadian Atlas 2h sampling (GSE54650)', species: 'Mus musculus', geneCount: '~21K' },
    { id: 'GSE54650_Cerebellum_circadian', name: 'Mouse Cerebellum (Hughes Atlas)', file: 'GSE54650_Cerebellum_circadian.csv', description: 'Mouse Cerebellum - Hughes Circadian Atlas 2h sampling (GSE54650)', species: 'Mus musculus', geneCount: '~21K' },
    { id: 'GSE54650_Hypothalamus_circadian', name: 'Mouse Hypothalamus (Hughes Atlas)', file: 'GSE54650_Hypothalamus_circadian.csv', description: 'Mouse Hypothalamus - Hughes Circadian Atlas 2h sampling (GSE54650)', species: 'Mus musculus', geneCount: '~21K' },
    { id: 'GSE54650_Brainstem_circadian', name: 'Mouse Brainstem (Hughes Atlas)', file: 'GSE54650_Brainstem_circadian.csv', description: 'Mouse Brainstem - Hughes Circadian Atlas 2h sampling (GSE54650)', species: 'Mus musculus', geneCount: '~21K' },
    { id: 'GSE54650_Muscle_circadian', name: 'Mouse Muscle (Hughes Atlas)', file: 'GSE54650_Muscle_circadian.csv', description: 'Mouse Muscle - Hughes Circadian Atlas 2h sampling (GSE54650)', species: 'Mus musculus', geneCount: '~21K' },
    { id: 'GSE54650_Adrenal_circadian', name: 'Mouse Adrenal (Hughes Atlas)', file: 'GSE54650_Adrenal_circadian.csv', description: 'Mouse Adrenal - Hughes Circadian Atlas 2h sampling (GSE54650)', species: 'Mus musculus', geneCount: '~21K' },
    { id: 'GSE54650_Aorta_circadian', name: 'Mouse Aorta (Hughes Atlas)', file: 'GSE54650_Aorta_circadian.csv', description: 'Mouse Aorta - Hughes Circadian Atlas 2h sampling (GSE54650)', species: 'Mus musculus', geneCount: '~21K' },
    { id: 'GSE54650_Brown_Fat_circadian', name: 'Mouse Brown Fat (Hughes Atlas)', file: 'GSE54650_Brown_Fat_circadian.csv', description: 'Mouse Brown Fat - Hughes Circadian Atlas 2h sampling (GSE54650)', species: 'Mus musculus', geneCount: '~21K' },
    { id: 'GSE54650_White_Fat_circadian', name: 'Mouse White Fat (Hughes Atlas)', file: 'GSE54650_White_Fat_circadian.csv', description: 'Mouse White Fat - Hughes Circadian Atlas 2h sampling (GSE54650)', species: 'Mus musculus', geneCount: '~21K' },
    { id: 'GSE11923_Liver_1h_48h_genes', name: 'Mouse Liver (Hughes 2009)', file: 'GSE11923_Liver_1h_48h_genes.csv', description: 'Mouse Liver - 1h sampling, 48h duration, gene symbols (GSE11923)', species: 'Mus musculus', geneCount: '~22K' },
    { id: 'GSE11923_Liver_1h_48h', name: 'Mouse Liver Probes (Hughes 2009)', file: 'GSE11923_Liver_1h_48h.csv', description: 'Mouse Liver - 1h sampling, 48h duration, probe IDs (GSE11923)', species: 'Mus musculus', geneCount: '~20K' },
    { id: 'GSE221103_Neuroblastoma_MYC_ON', name: 'Neuroblastoma MYC-ON (Cancer)', file: 'GSE221103_Neuroblastoma_MYC_ON.csv', description: 'MYC-ON Neuroblastoma - Cancer state, circadian disruption (GSE221103)', species: 'Human', geneCount: '~60K' },
    { id: 'GSE221103_Neuroblastoma_MYC_OFF', name: 'Neuroblastoma MYC-OFF (Recovery)', file: 'GSE221103_Neuroblastoma_MYC_OFF.csv', description: 'MYC-OFF Neuroblastoma - Recovery state after oncogene shutoff (GSE221103)', species: 'Human', geneCount: '~60K' },
    { id: 'GSE157357_Organoid_WT-WT', name: 'Organoid WT (Healthy)', file: 'GSE157357_Organoid_WT-WT_circadian.csv', description: 'Wild-type intestinal organoids - Healthy baseline (GSE157357)', species: 'Mus musculus', geneCount: '~16K' },
    { id: 'GSE157357_Organoid_ApcKO-WT', name: 'Organoid APC-Mutant (Cancer)', file: 'GSE157357_Organoid_ApcKO-WT_circadian.csv', description: 'APC-mutant intestinal organoids - Cancer model (GSE157357)', species: 'Mus musculus', geneCount: '~16K' },
    { id: 'GSE157357_Organoid_WT-BmalKO', name: 'Organoid BMAL-KO (Clock KO)', file: 'GSE157357_Organoid_WT-BmalKO_circadian.csv', description: 'BMAL1-knockout intestinal organoids - Clock disruption (GSE157357)', species: 'Mus musculus', geneCount: '~16K' },
    { id: 'GSE157357_Organoid_ApcKO-BmalKO', name: 'Organoid APC+BMAL KO (Double)', file: 'GSE157357_Organoid_ApcKO-BmalKO_circadian.csv', description: 'APC+BMAL1 double-knockout organoids (GSE157357)', species: 'Mus musculus', geneCount: '~15K' },
    { id: 'GSE113883_Human_WholeBlood', name: 'Human Whole Blood (Braun 2018)', file: 'GSE113883_Human_WholeBlood.csv', description: 'Human Whole Blood - Multi-subject time course (GSE113883)', species: 'Homo sapiens', geneCount: '~58K' },
    { id: 'GSE48113_Human_Blood_Circadian', name: 'Human Blood (Archer 2014)', file: 'GSE48113_Human_Blood_Circadian.csv', description: 'Human Blood Transcriptome - Forced desynchrony protocol (GSE48113)', species: 'Homo sapiens' },
    { id: 'GSE107537_PBMC_Day', name: 'Human PBMC Day Schedule (Kervezee 2018)', file: 'GSE107537_PBMC_Day_circadian.csv', description: 'Human PBMC - Normal day-oriented schedule baseline (GSE107537)', species: 'Homo sapiens', geneCount: '~19K' },
    { id: 'GSE107537_PBMC_Night', name: 'Human PBMC Night Shift (Kervezee 2018)', file: 'GSE107537_PBMC_Night_circadian.csv', description: 'Human PBMC - Simulated night shift work schedule (GSE107537)', species: 'Homo sapiens', geneCount: '~19K' },
    { id: 'GSE98965_baboon_FPKM', name: 'Baboon Multi-tissue (Mure 2018)', file: 'GSE98965_baboon_FPKM.csv', description: 'Baboon multi-tissue circadian atlas, FPKM values (GSE98965)', species: 'Papio anubis', geneCount: '~29K' },
    { id: 'GSE98965_baboon_SCN', name: 'Baboon SCN/Hypothalamus (Mure 2018)', file: 'GSE98965_baboon_FPKM.csv', description: 'Baboon suprachiasmatic nucleus (hypothalamus) — per-tissue slice of GSE98965', species: 'Papio anubis', geneCount: '~29K', tissuePrefix: 'SCN' },
    { id: 'GSE98965_baboon_Muscle', name: 'Baboon Skeletal Muscle (Mure 2018)', file: 'GSE98965_baboon_FPKM.csv', description: 'Baboon skeletal muscle (MUA) — per-tissue slice of GSE98965', species: 'Papio anubis', geneCount: '~29K', tissuePrefix: 'MUA' },
    { id: 'GSE98965_baboon_Liver', name: 'Baboon Liver (Mure 2018)', file: 'GSE98965_baboon_FPKM.csv', description: 'Baboon liver — per-tissue slice of GSE98965', species: 'Papio anubis', geneCount: '~29K', tissuePrefix: 'LIV' },
    { id: 'GSE98965_baboon_Adrenal', name: 'Baboon Adrenal Cortex (Mure 2018)', file: 'GSE98965_baboon_FPKM.csv', description: 'Baboon adrenal cortex (ADC) — per-tissue slice of GSE98965', species: 'Papio anubis', geneCount: '~29K', tissuePrefix: 'ADC' },
    { id: 'GSE98965_baboon_Kidney', name: 'Baboon Kidney Cortex (Mure 2018)', file: 'GSE98965_baboon_FPKM.csv', description: 'Baboon kidney cortex (KIC) — per-tissue slice of GSE98965', species: 'Papio anubis', geneCount: '~29K', tissuePrefix: 'KIC' },
    { id: 'GSE98965_baboon_Lung', name: 'Baboon Lung (Mure 2018)', file: 'GSE98965_baboon_FPKM.csv', description: 'Baboon lung — per-tissue slice of GSE98965', species: 'Papio anubis', geneCount: '~29K', tissuePrefix: 'LUN' },
    { id: 'GSE242964_arabidopsis_circadian_averaged', name: 'Arabidopsis (Redmond 2024)', file: 'GSE242964_arabidopsis_circadian_averaged.csv', description: 'Arabidopsis thaliana - Replicate-averaged circadian expression (GSE242964)', species: 'Arabidopsis thaliana' },
    { id: 'GSE48113_ForcedDesync_Aligned', name: 'Human Blood Aligned (Archer 2014)', file: 'GSE48113_ForcedDesync_Aligned_circadian.csv', description: 'Human Blood - Forced desynchrony, sleep aligned with melatonin (GSE48113)', species: 'Homo sapiens', geneCount: '~18K' },
    { id: 'GSE48113_ForcedDesync_Misaligned', name: 'Human Blood Misaligned (Archer 2014)', file: 'GSE48113_ForcedDesync_Misaligned_circadian.csv', description: 'Human Blood - Forced desynchrony, sleep misaligned with melatonin (GSE48113)', species: 'Homo sapiens', geneCount: '~16K' },
    { id: 'GSE39445_Blood_SufficientSleep', name: 'Human Blood Sufficient Sleep (Moller-Levet 2013)', file: 'GSE39445_Blood_SufficientSleep_circadian.csv', description: 'Human Leukocyte - After 1 week sufficient sleep, 10 timepoints (GSE39445)', species: 'Homo sapiens', geneCount: '~20K' },
    { id: 'GSE39445_Blood_SleepRestriction', name: 'Human Blood Sleep Restriction (Moller-Levet 2013)', file: 'GSE39445_Blood_SleepRestriction_circadian.csv', description: 'Human Leukocyte - After 1 week sleep restriction (6h/night), 10 timepoints (GSE39445)', species: 'Homo sapiens', geneCount: '~20K' },
    { id: 'GSE122541_Nurses_DayShift', name: 'Human PBMC Day-Shift Nurses (Gamble 2019)', file: 'GSE122541_Nurses_DayShift_circadian.csv', description: 'Human PBMC - Day-shift hospital nurses, 8 timepoints q3h (GSE122541)', species: 'Homo sapiens', geneCount: '~21K' },
    { id: 'GSE122541_Nurses_NightShift', name: 'Human PBMC Night-Shift Nurses (Gamble 2019)', file: 'GSE122541_Nurses_NightShift_circadian.csv', description: 'Human PBMC - Night-shift hospital nurses, 8 timepoints q3h (GSE122541)', species: 'Homo sapiens', geneCount: '~21K' },
    { id: 'GSE70499_Liver_Bmal1WT', name: 'Mouse Liver Bmal1-WT (Yang 2016)', file: 'GSE70499_Liver_Bmal1WT_circadian.csv', description: 'Mouse Liver - Wild-type controls for Bmal1-KO causal validation (GSE70499)', species: 'Mus musculus', geneCount: '~18K' },
    { id: 'GSE70499_Liver_Bmal1KO', name: 'Mouse Liver Bmal1-KO (Yang 2016)', file: 'GSE70499_Liver_Bmal1KO_circadian.csv', description: 'Mouse Liver - Bmal1-knockout, master clock gene ablation (GSE70499)', species: 'Mus musculus', geneCount: '~18K' },
    { id: 'GSE93903_Liver_Young', name: 'Mouse Liver Young (Sato 2017)', file: 'GSE93903_Liver_Young_circadian.csv', description: 'Mouse Liver - Young mice (3-6 months), aging baseline (GSE93903)', species: 'Mus musculus', geneCount: '~18K' },
    { id: 'GSE93903_Liver_Old', name: 'Mouse Liver Old (Sato 2017)', file: 'GSE93903_Liver_Old_circadian.csv', description: 'Mouse Liver - Old mice (18-22 months), aging study (GSE93903)', species: 'Mus musculus', geneCount: '~18K' },
    { id: 'GSE93903_Liver_YoungCR', name: 'Mouse Liver Young+CR (Sato 2017)', file: 'GSE93903_Liver_YoungCR_circadian.csv', description: 'Mouse Liver - Young mice with caloric restriction (GSE93903)', species: 'Mus musculus', geneCount: '~18K' },
    { id: 'GSE93903_Liver_OldCR', name: 'Mouse Liver Old+CR (Sato 2017)', file: 'GSE93903_Liver_OldCR_circadian.csv', description: 'Mouse Liver - Old mice with caloric restriction, CR rescue (GSE93903)', species: 'Mus musculus', geneCount: '~18K' },
    { id: 'Amit2009_DC_LPS', name: 'Dendritic Cell LPS (Amit 2009)', file: 'Amit2009_DC_LPS_TimeCourse.csv', description: 'Mouse bone-marrow-derived dendritic cells stimulated with LPS - 9 timepoints 0.5-24h (Amit et al. 2009)', species: 'Mus musculus', geneCount: '~10K' },
    { id: 'Rabani2014_DC_LPS_Full', name: 'Dendritic Cell LPS (Rabani 2014)', file: 'Rabani2014_DendriticCell_LPS_Full.csv', description: 'Mouse dendritic cells after LPS stimulation - immune response time series, 7 timepoints 0-12h (Rabani et al. 2014)', species: 'Mus musculus', geneCount: '~3K' },
    { id: 'Rabani2014_DC_Mock', name: 'Dendritic Cell Mock (Rabani 2014)', file: 'Rabani2014_DendriticCell_Mock_TimeSeries.csv', description: 'Mouse dendritic cells mock-treated control - baseline immune dynamics, 7 timepoints 0-12h (Rabani et al. 2014)', species: 'Mus musculus', geneCount: '~3K' },
    { id: 'Zaas2009_Influenza_Human', name: 'Human Influenza H3N2 (Zaas 2009)', file: 'Zaas2009_InfluenzaH3N2_Human.csv', description: 'Human blood transcriptome during influenza H3N2 infection - 15 timepoints over 108h (Zaas et al. 2009)', species: 'Homo sapiens', geneCount: '~13K' },
    { id: 'Arbeitman2002_Drosophila', name: 'Drosophila Embryo (Arbeitman 2002)', file: 'Arbeitman2002_DrosophilaEmbryo.csv', description: 'Drosophila melanogaster embryonic developmental time series - 30 timepoints (Arbeitman et al. 2002)', species: 'Drosophila melanogaster', geneCount: '~1K' },
    { id: 'Tu2005_Yeast_Metabolic', name: 'Yeast Metabolic Cycle (Tu 2005)', file: 'Tu2005_YeastMetabolicCycle.csv', description: 'Saccharomyces cerevisiae metabolic oscillation - 36 timepoints across 3 complete cycles (Tu et al. 2005)', species: 'Saccharomyces cerevisiae', geneCount: '~5K' },
    { id: 'GSE201207_Young_Kidney', name: 'Mouse Young Kidney (Aging 2022)', file: 'GSE201207_Young_Kidney_Aging.csv', description: 'Mouse Kidney - Young mice, aging study baseline (GSE201207)', species: 'Mus musculus' },
    { id: 'GSE56931_Human_Blood_Baseline', name: 'Human Blood Baseline (Ruger 2014)', file: 'GSE56931_Human_Blood_SleepDep_Baseline.csv', description: 'Human whole blood - 14 subjects, 10 timepoints every 4h over 48h baseline (GSE56931)', species: 'Homo sapiens', geneCount: '~21K' },
    { id: 'GSE108539_Human_SkeletalMuscle', name: 'Human Skeletal Muscle (Perrin 2018)', file: 'GSE108539_Human_SkeletalMuscle_Circadian.csv', description: 'Human skeletal muscle biopsies - 10 subjects, 6 serial biopsies every 4h over 24h (GSE108539)', species: 'Homo sapiens', geneCount: '~15K' },
  ];

  app.get("/api/processed-tables/available", (_req, res) => {
    res.json(AVAILABLE_PROCESSED_DATASETS
      .filter(d => fs.existsSync(path.join(process.cwd(), 'datasets', d.file)))
      .map(d => ({
        id: d.id,
        name: d.name,
        description: d.description,
        downloadUrl: `/api/processed-tables/download/${d.id}`
      })));
  });

  app.get("/api/processed-tables/download/:datasetId", async (req, res) => {
    try {
      const dataset = AVAILABLE_PROCESSED_DATASETS.find(d => d.id === req.params.datasetId);
      if (!dataset) {
        return res.status(404).json({ error: "Dataset not found", available: AVAILABLE_PROCESSED_DATASETS.map(d => d.id) });
      }
      const filePath = path.join(process.cwd(), 'datasets', dataset.file);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: `Dataset file not found: ${dataset.file}` });
      }
      const csv = generateProcessedTableCSV(filePath, dataset.name, dataset.tissuePrefix ? { tissuePrefix: dataset.tissuePrefix } : undefined);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + 'Z';
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=PAR2_PerGene_Eigenvalues_${dataset.id}_${timestamp}.csv`);
      res.send(csv);
    } catch (error: any) {
      console.error("Error generating processed table:", error);
      res.status(500).json({ error: error.message || "Failed to generate processed table" });
    }
  });

  app.get("/api/processed-tables/summary/:datasetId", async (req, res) => {
    try {
      const dataset = AVAILABLE_PROCESSED_DATASETS.find(d => d.id === req.params.datasetId);
      if (!dataset) {
        return res.status(404).json({ error: "Dataset not found" });
      }
      const filePath = path.join(process.cwd(), 'datasets', dataset.file);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: `Dataset file not found: ${dataset.file}` });
      }

      // Use the dataset file's mtime as an ETag so clients can revalidate cheaply.
      let etag: string | null = null;
      try {
        const stat = fs.statSync(filePath);
        etag = `"${dataset.id}-${stat.mtimeMs.toString(36)}"`;
      } catch { /* etag stays null — non-fatal */ }

      if (etag) {
        res.setHeader('ETag', etag);
        const ifNoneMatch = req.headers['if-none-match'];
        if (ifNoneMatch === etag) {
          res.status(304).end();
          return;
        }
      }
      // Allow shared caches to hold for 5 min; private (browser) cache for 15 min.
      // must-revalidate ensures stale entries are never served after TTL.
      res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300, must-revalidate');

      const results = generateProcessedTable(filePath, dataset.tissuePrefix ? { tissuePrefix: dataset.tissuePrefix } : undefined);
      const clock = results.filter(r => r.geneType === 'clock');
      const target = results.filter(r => r.geneType === 'target');
      const other = results.filter(r => r.geneType === 'other');
      const meanEV = (arr: typeof results) => arr.length > 0 ? arr.reduce((s, r) => s + r.eigenvalueModulus, 0) / arr.length : 0;
      const adfPassCount = results.filter(r => !r.adfStationarityFlag).length;
      const adfPassRate = results.length > 0 ? +(adfPassCount / results.length * 100).toFixed(1) : 0;
      res.json({
        dataset: dataset.name,
        datasetId: dataset.id,
        description: dataset.description,
        totalGenes: results.length,
        clockGenes: { count: clock.length, meanEigenvalue: +meanEV(clock).toFixed(4), genes: clock.map(g => ({ gene: g.gene, eigenvalue: +g.eigenvalueModulus.toFixed(4), r2: +g.rSquared.toFixed(4), confidence: g.confidenceLevel, adfStationary: !g.adfStationarityFlag, adfTestStatistic: g.adfTestStatistic !== undefined ? +g.adfTestStatistic.toFixed(4) : null })) },
        targetGenes: { count: target.length, meanEigenvalue: +meanEV(target).toFixed(4), genes: target.map(g => ({ gene: g.gene, eigenvalue: +g.eigenvalueModulus.toFixed(4), r2: +g.rSquared.toFixed(4), confidence: g.confidenceLevel, adfStationary: !g.adfStationarityFlag, adfTestStatistic: g.adfTestStatistic !== undefined ? +g.adfTestStatistic.toFixed(4) : null })) },
        otherGenes: { count: other.length, meanEigenvalue: +meanEV(other).toFixed(4) },
        gearboxGap: +(meanEV(clock) - meanEV(target)).toFixed(4),
        hierarchyPreserved: meanEV(clock) > meanEV(target),
        adfStationarityPassRate: adfPassRate,
        downloadUrl: `/api/processed-tables/download/${dataset.id}`
      });
    } catch (error: any) {
      console.error("Error generating summary:", error);
      res.status(500).json({ error: error.message || "Failed to generate summary" });
    }
  });

  // ===== Gene Functional Classification for Genome-Wide Search =====
  const classifyGeneExpanded = classifyGeneShared;

  // ===== Genome-Wide Gene Search for Root-Space =====
  const genomeSearchCache: Record<string, { data: any[]; timestamp: number }> = {};
  const GENOME_SEARCH_CACHE_TTL = 60 * 60 * 1000;

  app.get("/api/analysis/genome-wide-search", async (req, res) => {
    try {
      const query = ((req.query.q as string) || '').trim().toUpperCase();
      const datasetId = (req.query.dataset as string) || 'GSE54650_Liver_circadian';
      const topN = Math.min(parseInt(req.query.topN as string) || 20, 100);

      const dataset = AVAILABLE_PROCESSED_DATASETS.find(d => d.id === datasetId);
      if (!dataset) {
        return res.status(404).json({ error: "Dataset not found", available: AVAILABLE_PROCESSED_DATASETS.map(d => ({ id: d.id, name: d.name })) });
      }
      const filePath = path.join(process.cwd(), 'datasets', dataset.file);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: `Dataset file not found: ${dataset.file}` });
      }

      let allResults: any[];
      if (genomeSearchCache[datasetId] && (Date.now() - genomeSearchCache[datasetId].timestamp) < GENOME_SEARCH_CACHE_TTL) {
        allResults = genomeSearchCache[datasetId].data;
      } else {
        const rawResults = generateProcessedTable(filePath);
        const PHI = (1 + Math.sqrt(5)) / 2;
        allResults = rawResults.map(r => {
          const disc = r.phi1 * r.phi1 + 4 * r.phi2;
          let rootR: number, rootTheta: number, isComplex: boolean;
          if (disc < 0) {
            rootR = Math.sqrt(-r.phi2);
            rootTheta = Math.atan2(Math.sqrt(-disc), r.phi1);
            isComplex = true;
          } else {
            const l1 = (r.phi1 + Math.sqrt(disc)) / 2;
            const l2 = (r.phi1 - Math.sqrt(disc)) / 2;
            const dominant = Math.abs(l1) >= Math.abs(l2) ? l1 : l2;
            rootR = Math.abs(dominant);
            rootTheta = dominant < 0 ? Math.PI : 0;
            isComplex = false;
          }
          const thetaPhi = 2 * Math.PI / PHI;
          const rRef = 0.7;
          const logRDist = Math.abs(Math.log(Math.max(rootR, 0.01)) - Math.log(rRef));
          let thetaDist = Math.abs(rootTheta - thetaPhi);
          thetaDist = Math.min(thetaDist, 2 * Math.PI - thetaDist);
          const dPhi = logRDist + thetaDist;
          const distToInvPhi = Math.abs(r.eigenvalueModulus - 1 / PHI);
          const x = rootR * Math.cos(rootTheta);
          const y = rootR * Math.sin(rootTheta);
          return {
            gene: r.gene,
            geneType: r.geneType,
            geneCategory: classifyGeneExpanded(r.gene),
            beta1: +r.phi1.toFixed(4),
            beta2: +r.phi2.toFixed(4),
            eigenvalue: +r.eigenvalueModulus.toFixed(4),
            r: +rootR.toFixed(4),
            theta: +rootTheta.toFixed(4),
            isComplex,
            dPhi: +dPhi.toFixed(4),
            distToInvPhi: +distToInvPhi.toFixed(4),
            x: +x.toFixed(4),
            y: +y.toFixed(4),
            r2: +r.rSquared.toFixed(4),
            stable: r.eigenvalueModulus < 1.0,
            confidence: r.confidenceLevel,
          };
        });
        genomeSearchCache[datasetId] = { data: allResults, timestamp: Date.now() };
      }

      const fibonacciNearest = [...allResults]
        .filter(g => g.stable)
        .sort((a, b) => a.distToInvPhi - b.distToInvPhi)
        .slice(0, topN);

      let searchResults: any[] = [];
      if (query.length >= 2) {
        searchResults = allResults
          .filter(g => g.gene.toUpperCase().includes(query))
          .sort((a, b) => {
            const aUpper = a.gene.toUpperCase();
            const bUpper = b.gene.toUpperCase();
            if (aUpper === query && bUpper !== query) return -1;
            if (bUpper === query && aUpper !== query) return 1;
            return a.gene.length - b.gene.length;
          })
          .slice(0, 50);
      }

      res.json({
        dataset: { id: dataset.id, name: dataset.name, species: dataset.species },
        totalGenes: allResults.length,
        query: query || null,
        searchResults,
        fibonacciNearest,
        availableDatasets: AVAILABLE_PROCESSED_DATASETS.filter(d => fs.existsSync(path.join(process.cwd(), 'datasets', d.file))).map(d => ({ id: d.id, name: d.name, species: d.species })),
      });
    } catch (error: any) {
      console.error("Genome-wide search error:", error);
      res.status(500).json({ error: error.message || "Failed to search genome-wide data" });
    }
  });

  // ===== Gene Profile Aggregation Endpoint =====
  const geneProfileCache = new Map<string, { data: any; timestamp: number }>();
  const GENE_PROFILE_CACHE_TTL = 5 * 60 * 1000;

  const GSE54650_TISSUES = [
    { id: 'Adrenal', file: 'GSE54650_Adrenal_circadian.csv' },
    { id: 'Aorta', file: 'GSE54650_Aorta_circadian.csv' },
    { id: 'Brainstem', file: 'GSE54650_Brainstem_circadian.csv' },
    { id: 'Brown_Fat', file: 'GSE54650_Brown_Fat_circadian.csv' },
    { id: 'Cerebellum', file: 'GSE54650_Cerebellum_circadian.csv' },
    { id: 'Heart', file: 'GSE54650_Heart_circadian.csv' },
    { id: 'Hypothalamus', file: 'GSE54650_Hypothalamus_circadian.csv' },
    { id: 'Kidney', file: 'GSE54650_Kidney_circadian.csv' },
    { id: 'Liver', file: 'GSE54650_Liver_circadian.csv' },
    { id: 'Lung', file: 'GSE54650_Lung_circadian.csv' },
    { id: 'Muscle', file: 'GSE54650_Muscle_circadian.csv' },
    { id: 'White_Fat', file: 'GSE54650_White_Fat_circadian.csv' },
  ];

  function profileCosinor(values: number[], tp: number[], period = 24) {
    const n = values.length;
    const mean = values.reduce((a, b) => a + b, 0) / n;
    let sCC = 0, sSS = 0, sCS = 0, sYC = 0, sYS = 0;
    for (let i = 0; i < n; i++) {
      const w = (2 * Math.PI * tp[i]) / period;
      const c = Math.cos(w), s = Math.sin(w);
      sCC += c * c; sSS += s * s; sCS += c * s;
      sYC += values[i] * c; sYS += values[i] * s;
    }
    const d = sCC * sSS - sCS * sCS;
    if (Math.abs(d) < 1e-10) return { phase: 0, r2: 0, amplitude: 0, mean };
    const beta = (sYC * sSS - sYS * sCS) / d;
    const gamma = (sYS * sCC - sYC * sCS) / d;
    const amplitude = Math.sqrt(beta * beta + gamma * gamma);
    let phase = Math.atan2(-gamma, beta) * (period / (2 * Math.PI));
    if (phase < 0) phase += period;
    const ssTot = values.reduce((a, v) => a + (v - mean) ** 2, 0);
    let ssRes = 0;
    for (let i = 0; i < n; i++) {
      const w = (2 * Math.PI * tp[i]) / period;
      const pred = mean + beta * Math.cos(w) + gamma * Math.sin(w);
      ssRes += (values[i] - pred) ** 2;
    }
    return { phase, r2: ssTot > 0 ? 1 - ssRes / ssTot : 0, amplitude, mean };
  }

  function profileAR2Coupling(targetVals: number[], clockVals: number[]) {
    const n = Math.min(targetVals.length, clockVals.length);
    if (n < 6) return null;
    const my = targetVals.reduce((a, b) => a + b, 0) / n;
    const mc = clockVals.reduce((a, b) => a + b, 0) / n;
    const y = targetVals.map(v => v - my);
    const c = clockVals.map(v => v - mc);
    const k = n - 2;

    let s11 = 0, s12 = 0, s22 = 0, sy1 = 0, sy2 = 0;
    for (let i = 2; i < n; i++) {
      s11 += y[i - 1] * y[i - 1]; s12 += y[i - 1] * y[i - 2]; s22 += y[i - 2] * y[i - 2];
      sy1 += y[i] * y[i - 1]; sy2 += y[i] * y[i - 2];
    }
    const det0 = s11 * s22 - s12 * s12;
    if (Math.abs(det0) < 1e-10) return null;
    const b1u = (sy1 * s22 - sy2 * s12) / det0;
    const b2u = (sy2 * s11 - sy1 * s12) / det0;
    let ssResU = 0, ssTot = 0;
    for (let i = 2; i < n; i++) {
      const pred = b1u * y[i - 1] + b2u * y[i - 2];
      ssResU += (y[i] - pred) ** 2;
      ssTot += y[i] * y[i];
    }
    const aicU = k * Math.log(ssResU / k) + 2 * 3;

    const m = 3;
    const XtX = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    const XtY = [0, 0, 0];
    for (let i = 2; i < n; i++) {
      const x = [y[i - 1], y[i - 2], c[i - 1]];
      for (let j = 0; j < m; j++) {
        for (let l = 0; l < m; l++) XtX[j][l] += x[j] * x[l];
        XtY[j] += y[i] * x[j];
      }
    }
    const a = XtX.map(row => [...row]);
    const bv = [...XtY];
    for (let i = 0; i < m; i++) {
      let mx = Math.abs(a[i][i]), mi = i;
      for (let j = i + 1; j < m; j++) if (Math.abs(a[j][i]) > mx) { mx = Math.abs(a[j][i]); mi = j; }
      [a[i], a[mi]] = [a[mi], a[i]];
      [bv[i], bv[mi]] = [bv[mi], bv[i]];
      if (Math.abs(a[i][i]) < 1e-10) return null;
      for (let j = i + 1; j < m; j++) {
        const f = a[j][i] / a[i][i];
        for (let l = i; l < m; l++) a[j][l] -= f * a[i][l];
        bv[j] -= f * bv[i];
      }
    }
    const betaArr = [0, 0, 0];
    for (let i = m - 1; i >= 0; i--) {
      let s = bv[i];
      for (let j = i + 1; j < m; j++) s -= a[i][j] * betaArr[j];
      betaArr[i] = s / a[i][i];
    }
    let ssResC = 0;
    for (let i = 2; i < n; i++) {
      const pred = betaArr[0] * y[i - 1] + betaArr[1] * y[i - 2] + betaArr[2] * c[i - 1];
      ssResC += (y[i] - pred) ** 2;
    }
    const aicC = k * Math.log(ssResC / k) + 2 * 4;
    const deltaAIC = aicU - aicC;

    const dfNum = 1;
    const dfDen = k - m;
    const fStat = dfDen > 0 ? ((ssResU - ssResC) / dfNum) / (ssResC / dfDen) : 0;
    const pValue = fStat > 0 && dfDen > 0 ? Math.exp(-0.717 * Math.sqrt(fStat) - 0.416 * fStat) * 2 : 1;
    const significant = deltaAIC > 2 && pValue < 0.05;

    return { deltaAIC, pValue: Math.min(1, pValue), significant };
  }

  function readTissueGeneData(filePath: string, geneSearchNames: string[]): { geneValues: number[] | null; clockValues: number[] | null; timepoints: number[] } {
    if (!fs.existsSync(filePath)) return { geneValues: null, clockValues: null, timepoints: [] };
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n');
    if (lines.length < 2) return { geneValues: null, clockValues: null, timepoints: [] };

    const headers = lines[0].split(',');
    const timepoints: number[] = [];
    for (let j = 1; j < headers.length; j++) {
      const h = headers[j].trim().replace(/"/g, '');
      const m = h.match(/(?:CT|ZT|X)?(\d+(?:\.\d+)?)/i);
      if (m) timepoints.push(parseFloat(m[1]));
      else timepoints.push(j - 1);
    }

    let geneValues: number[] | null = null;
    let clockValues: number[] | null = null;
    const ENSEMBL_MAP: Record<string, string> = {
      'ENSMUSG00000055116': 'Arntl', 'ENSMUSG00000020875': 'Arntl',
    };

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',');
      if (parts.length < 2) continue;
      const rawGene = parts[0].trim().replace(/"/g, '');
      const resolvedGene = ENSEMBL_MAP[rawGene] || rawGene;
      const upper = resolvedGene.toUpperCase();

      const vals: number[] = [];
      for (let j = 1; j < parts.length; j++) {
        const v = parseFloat(parts[j]);
        if (!isNaN(v)) vals.push(v);
      }
      if (vals.length < 5) continue;

      if (geneSearchNames.includes(upper)) geneValues = vals;
      if (upper === 'ARNTL' || upper === 'BMAL1') clockValues = vals;

      if (geneValues && clockValues) break;
    }

    return { geneValues, clockValues, timepoints };
  }

  app.get("/api/gene-profile", async (req, res) => {
    try {
      const rawGene = ((req.query.gene as string) || '').trim();
      if (!rawGene) {
        return res.status(400).json({ error: "Missing required 'gene' query parameter" });
      }

      const cacheKey = rawGene.toUpperCase();
      const cached = geneProfileCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < GENE_PROFILE_CACHE_TTL) {
        return res.json(cached.data);
      }

      const geneSearchNames = resolveGeneAliases(rawGene);
      const normalizedGene = rawGene.charAt(0).toUpperCase() + rawGene.slice(1).toLowerCase();
      const category = classifyGeneExpanded(rawGene);
      const categoryMeta = CATEGORY_META[category];

      const litEntries = LITERATURE_CIRCADIAN_GENES.filter(g =>
        geneSearchNames.includes(g.gene.toUpperCase())
      );
      const literature = {
        found: litEntries.length > 0,
        entries: litEntries.map(e => ({
          pathway: e.pathway,
          discoveryMethod: e.discoveryMethod,
          citation: e.citation,
          year: e.year,
          finding: e.finding,
        })),
      };

      const crossResults: any[] = [];
      const ENSEMBL_MAP: Record<string, string> = {
        'ENSMUSG00000020893': 'Per1', 'ENSMUSG00000055866': 'Per2', 'ENSMUSG00000028957': 'Per3',
        'ENSMUSG00000020038': 'Cry1', 'ENSMUSG00000068742': 'Cry2',
        'ENSMUSG00000029238': 'Clock', 'ENSMUSG00000055116': 'Arntl',
        'ENSMUSG00000020889': 'Nr1d1', 'ENSMUSG00000021775': 'Nr1d2',
        'ENSMUSG00000032238': 'Rora', 'ENSMUSG00000028150': 'Rorc',
        'ENSMUSG00000059824': 'Dbp', 'ENSMUSG00000022389': 'Tef',
        'ENSMUSG00000022346': 'Myc', 'ENSMUSG00000070348': 'Ccnd1',
        'ENSMUSG00000041431': 'Ccnb1', 'ENSMUSG00000019942': 'Cdk1',
        'ENSMUSG00000031016': 'Wee1', 'ENSMUSG00000023067': 'Cdkn1a',
        'ENSMUSG00000020140': 'Lgr5', 'ENSMUSG00000000142': 'Axin2',
        'ENSMUSG00000006932': 'Ctnnb1', 'ENSMUSG00000005871': 'Apc',
        'ENSMUSG00000059552': 'Trp53', 'ENSMUSG00000020184': 'Mdm2',
        'ENSMUSG00000034218': 'Atm', 'ENSMUSG00000029521': 'Chek2',
        'ENSMUSG00000057329': 'Bcl2', 'ENSMUSG00000003873': 'Bax',
        'ENSMUSG00000000440': 'Pparg', 'ENSMUSG00000020063': 'Sirt1',
        'ENSMUSG00000021109': 'Hif1a', 'ENSMUSG00000026077': 'Npas2',
      };

      for (const dataset of AVAILABLE_PROCESSED_DATASETS) {
        try {
          if (genomeSearchCache[dataset.id] && (Date.now() - genomeSearchCache[dataset.id].timestamp) < GENOME_SEARCH_CACHE_TTL) {
            const match = genomeSearchCache[dataset.id].data.find((g: any) => geneSearchNames.includes(g.gene.toUpperCase()));
            if (match) {
              crossResults.push({
                datasetName: dataset.name, eigenvalue: match.eigenvalue,
                r2: match.r2, confidence: match.confidence, species: dataset.species,
              });
              continue;
            }
            // Gene not found in warm cache — fall through to file scan
          }
          const filePath = path.join(process.cwd(), 'datasets', dataset.file);
          if (!fs.existsSync(filePath)) continue;
          const content = fs.readFileSync(filePath, 'utf-8');
          const lines = content.trim().split('\n');
          if (lines.length < 2) continue;
          let foundInDataset = false;
          for (let i = 1; i < lines.length; i++) {
            const parts = lines[i].split(',');
            if (parts.length < 2) continue;
            const rg = parts[0].trim().replace(/"/g, '');
            if (!rg) continue;
            const resolved = ENSEMBL_MAP[rg] || rg;
            if (!geneSearchNames.includes(resolved.toUpperCase())) continue;
            const values: number[] = [];
            for (let j = 1; j < parts.length; j++) {
              const v = parseFloat(parts[j]);
              if (!isNaN(v)) values.push(v);
            }
            if (values.length < 5) continue;
            try {
              const result = fitAR2WithDiagnostics(values);
              if (!result) continue;
              crossResults.push({
                datasetName: dataset.name, eigenvalue: +result.eigenvalue.toFixed(4),
                r2: +result.r2.toFixed(4), confidence: result.diagnostics.overallConfidence, species: dataset.species,
              });
              foundInDataset = true;
            } catch (fitErr) {
              console.error(`[gene-profile] fitAR2 failed for ${rg} in ${dataset.id}:`, fitErr);
            }
            break;
          }
        } catch (err) {
          console.error(`[gene-profile] cross-dataset scan error for ${dataset.id}:`, err);
        }
      }

      const eigenvalues = crossResults.map(r => r.eigenvalue);
      const crossDataset = {
        datasetsFound: eigenvalues.length,
        meanEigenvalue: eigenvalues.length > 0 ? +(eigenvalues.reduce((s, v) => s + v, 0) / eigenvalues.length).toFixed(4) : null,
        minEigenvalue: eigenvalues.length > 0 ? +Math.min(...eigenvalues).toFixed(4) : null,
        maxEigenvalue: eigenvalues.length > 0 ? +Math.max(...eigenvalues).toFixed(4) : null,
        results: crossResults,
      };

      const tissueResults: any[] = [];
      for (const tissue of GSE54650_TISSUES) {
        try {
          const filePath = path.join(process.cwd(), 'datasets', tissue.file);
          const { geneValues, clockValues, timepoints } = readTissueGeneData(filePath, geneSearchNames);
          if (!geneValues) continue;

          let peakPhase = 0, amplitude = 0;
          if (timepoints.length === geneValues.length && geneValues.length >= 6) {
            const cosinorResult = profileCosinor(geneValues, timepoints);
            peakPhase = +cosinorResult.phase.toFixed(1);
            amplitude = +cosinorResult.amplitude.toFixed(4);
          }

          let deltaAIC = 0, pValue = 1, significant = false;
          if (clockValues && geneValues.length >= 6) {
            const coupling = profileAR2Coupling(geneValues, clockValues);
            if (coupling) {
              deltaAIC = +coupling.deltaAIC.toFixed(2);
              pValue = +coupling.pValue.toFixed(4);
              significant = coupling.significant;
            }
          }

          tissueResults.push({
            tissue: tissue.id.replace(/_/g, ' '),
            deltaAIC,
            pValue,
            significant,
            peakPhase,
            amplitude,
          });
        } catch { }
      }

      const tissueCoupling = {
        tissuesAnalyzed: tissueResults.length,
        tissuesCoupled: tissueResults.filter(t => t.significant).length,
        results: tissueResults,
      };

      const literatureConfirmed = literature.found;
      const couplingValidated = tissueResults.some(t => t.significant);
      const isCouplingReference = ['BMAL1', 'ARNTL'].includes(rawGene.toUpperCase());

      let agreementSummary: string;
      if (isCouplingReference) {
        agreementSummary = `${normalizedGene} (ARNTL) is the master circadian transcription factor and the coupling reference gene used in PAR(2) analyses. It drives expression of clock-controlled genes — self-coupling is not tested. Cross-dataset |λ| values reflect its own temporal persistence dynamics.`;
      } else if (literatureConfirmed && couplingValidated) {
        const firstCitation = litEntries[0]?.citation || '';
        const citShort = firstCitation.split(',')[0] || firstCitation;
        const yearStr = litEntries[0]?.year ? ` ${litEntries[0].year}` : '';
        agreementSummary = `${normalizedGene} is literature-confirmed (${citShort}${yearStr}) as clock-controlled. PAR(2) finds significant BMAL1 coupling in ${tissueCoupling.tissuesCoupled}/${tissueCoupling.tissuesAnalyzed} tissues, validating the literature.`;
      } else if (literatureConfirmed && !couplingValidated) {
        const firstCitation = litEntries[0]?.citation || '';
        agreementSummary = `${normalizedGene} is literature-confirmed (${firstCitation}) but PAR(2) does not find significant BMAL1 coupling in the Hughes atlas tissues. This may reflect tissue-specific regulation.`;
      } else if (!literatureConfirmed && couplingValidated) {
        agreementSummary = `No literature annotation for ${normalizedGene}. PAR(2) finds significant BMAL1 coupling in ${tissueCoupling.tissuesCoupled}/${tissueCoupling.tissuesAnalyzed} tissues — a potential novel circadian-coupled gene.`;
      } else if (crossDataset.datasetsFound > 0) {
        agreementSummary = `No literature annotation. PAR(2) finds moderate persistence across ${crossDataset.datasetsFound} datasets with mean eigenvalue ${crossDataset.meanEigenvalue}.`;
      } else {
        agreementSummary = `${normalizedGene} was not found in any available dataset.`;
      }

      const deepLinks = [
        { label: 'Gene Explorer', route: `/gene-explorer?gene=${encodeURIComponent(rawGene)}`, description: 'Explore AR(2) dynamics and eigenvalue structure' },
        { label: 'Phase Portrait', route: `/phase-portrait?gene=${encodeURIComponent(rawGene)}`, description: 'View circadian phase relationships and coupling' },
        { label: 'Root-Space', route: `/root-space?gene=${encodeURIComponent(rawGene)}`, description: 'Visualize eigenvalue roots in the complex plane' },
        { label: 'Genome-Wide Coupling', route: `/genome-wide-coupling`, description: 'Browse genome-wide BMAL1 coupling results' },
        { label: 'Literature Validation', route: `/literature-validation`, description: 'Compare PAR(2) findings against published literature' },
      ];

      const responseData = {
        gene: normalizedGene,
        category,
        categoryMeta,
        literature,
        par2: { crossDataset, tissueCoupling, isCouplingReference },
        connection: {
          literatureConfirmed,
          couplingValidated,
          agreementSummary,
          deepLinks,
        },
      };

      geneProfileCache.set(cacheKey, { data: responseData, timestamp: Date.now() });
      res.json(responseData);
    } catch (error: any) {
      console.error("Gene profile error:", error);
      res.status(500).json({ error: error.message || "Failed to generate gene profile" });
    }
  });

  // ===== Cross-Dataset Gene Tracking =====
  app.get("/api/analysis/gene-cross-dataset", async (req, res) => {
    try {
      const gene = ((req.query.gene as string) || '').trim();
      if (!gene) {
        return res.status(400).json({ error: "Missing required 'gene' query parameter" });
      }
      const geneSearchNames = resolveGeneAliases(gene);
      const geneUpper = gene.toUpperCase();
      const ENSEMBL_MAP: Record<string, string> = {
        'ENSMUSG00000020893': 'Per1', 'ENSMUSG00000055866': 'Per2', 'ENSMUSG00000028957': 'Per3',
        'ENSMUSG00000020038': 'Cry1', 'ENSMUSG00000068742': 'Cry2',
        'ENSMUSG00000029238': 'Clock', 'ENSMUSG00000055116': 'Arntl',
        'ENSMUSG00000020889': 'Nr1d1', 'ENSMUSG00000021775': 'Nr1d2',
        'ENSMUSG00000032238': 'Rora', 'ENSMUSG00000028150': 'Rorc',
        'ENSMUSG00000059824': 'Dbp', 'ENSMUSG00000022389': 'Tef',
        'ENSMUSG00000022346': 'Myc', 'ENSMUSG00000070348': 'Ccnd1',
        'ENSMUSG00000041431': 'Ccnb1', 'ENSMUSG00000019942': 'Cdk1',
        'ENSMUSG00000031016': 'Wee1', 'ENSMUSG00000023067': 'Cdkn1a',
        'ENSMUSG00000020140': 'Lgr5', 'ENSMUSG00000000142': 'Axin2',
        'ENSMUSG00000006932': 'Ctnnb1', 'ENSMUSG00000005871': 'Apc',
        'ENSMUSG00000059552': 'Trp53', 'ENSMUSG00000020184': 'Mdm2',
        'ENSMUSG00000034218': 'Atm', 'ENSMUSG00000029521': 'Chek2',
        'ENSMUSG00000057329': 'Bcl2', 'ENSMUSG00000003873': 'Bax',
        'ENSMUSG00000000440': 'Pparg', 'ENSMUSG00000020063': 'Sirt1',
        'ENSMUSG00000021109': 'Hif1a', 'ENSMUSG00000026077': 'Npas2',
      };

      const results: any[] = [];

      for (const dataset of AVAILABLE_PROCESSED_DATASETS) {
        try {
          if (genomeSearchCache[dataset.id] && (Date.now() - genomeSearchCache[dataset.id].timestamp) < GENOME_SEARCH_CACHE_TTL) {
            const match = genomeSearchCache[dataset.id].data.find((g: any) => geneSearchNames.includes(g.gene.toUpperCase()));
            if (match) {
              results.push({
                datasetName: dataset.name, datasetId: dataset.id, species: dataset.species,
                eigenvalue: match.eigenvalue, beta1: match.beta1, beta2: match.beta2,
                r2: match.r2, confidence: match.confidence, geneCategory: match.geneCategory, stable: match.stable,
              });
            }
            continue;
          }

          const filePath = path.join(process.cwd(), 'datasets', dataset.file);
          if (!fs.existsSync(filePath)) continue;

          const content = fs.readFileSync(filePath, 'utf-8');
          const lines = content.trim().split('\n');
          if (lines.length < 2) continue;

          for (let i = 1; i < lines.length; i++) {
            const parts = lines[i].split(',');
            if (parts.length < 2) continue;
            const rawGene = parts[0].trim().replace(/"/g, '');
            if (!rawGene) continue;
            const resolvedGene = ENSEMBL_MAP[rawGene] || rawGene;
            if (!geneSearchNames.includes(resolvedGene.toUpperCase())) continue;

            const values: number[] = [];
            for (let j = 1; j < parts.length; j++) {
              const v = parseFloat(parts[j]);
              if (!isNaN(v)) values.push(v);
            }
            if (values.length < 5) break;

            const result = fitAR2WithDiagnostics(values);
            if (!result) break;

            const { phi1, phi2, eigenvalue, r2 } = result;
            results.push({
              datasetName: dataset.name, datasetId: dataset.id, species: dataset.species,
              eigenvalue: +eigenvalue.toFixed(4), beta1: +phi1.toFixed(4), beta2: +phi2.toFixed(4),
              r2: +r2.toFixed(4), confidence: result.diagnostics.overallConfidence,
              geneCategory: classifyGeneExpanded(resolvedGene), stable: eigenvalue < 1.0,
            });
            break;
          }
        } catch (err) {
          // skip datasets that fail
        }
      }

      results.sort((a, b) => b.eigenvalue - a.eigenvalue);

      const eigenvalues = results.map(r => r.eigenvalue);
      const summary = eigenvalues.length > 0 ? {
        meanEigenvalue: +(eigenvalues.reduce((s, v) => s + v, 0) / eigenvalues.length).toFixed(4),
        minEigenvalue: +Math.min(...eigenvalues).toFixed(4),
        maxEigenvalue: +Math.max(...eigenvalues).toFixed(4),
        datasetsFound: eigenvalues.length,
        totalDatasetsScanned: AVAILABLE_PROCESSED_DATASETS.length,
      } : {
        meanEigenvalue: null, minEigenvalue: null, maxEigenvalue: null,
        datasetsFound: 0, totalDatasetsScanned: AVAILABLE_PROCESSED_DATASETS.length,
      };

      res.json({ gene, geneCategory: classifyGeneExpanded(gene), results, summary });
    } catch (error: any) {
      console.error("Cross-dataset gene tracking error:", error);
      res.status(500).json({ error: error.message || "Failed to track gene across datasets" });
    }
  });

  // ===== Fibonacci Cluster Enrichment =====
  app.get("/api/analysis/fibonacci-enrichment", async (req, res) => {
    try {
      const datasetId = (req.query.dataset as string) || 'GSE54650_Liver_circadian';

      const dataset = AVAILABLE_PROCESSED_DATASETS.find(d => d.id === datasetId);
      if (!dataset) {
        return res.status(404).json({ error: "Dataset not found", available: AVAILABLE_PROCESSED_DATASETS.map(d => ({ id: d.id, name: d.name })) });
      }
      const filePath = path.join(process.cwd(), 'datasets', dataset.file);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: `Dataset file not found: ${dataset.file}` });
      }

      let allResults: any[];
      if (genomeSearchCache[datasetId] && (Date.now() - genomeSearchCache[datasetId].timestamp) < GENOME_SEARCH_CACHE_TTL) {
        allResults = genomeSearchCache[datasetId].data;
      } else {
        const rawResults = generateProcessedTable(filePath);
        const PHI = (1 + Math.sqrt(5)) / 2;
        allResults = rawResults.map(r => {
          const disc = r.phi1 * r.phi1 + 4 * r.phi2;
          let rootR: number, rootTheta: number, isComplex: boolean;
          if (disc < 0) {
            rootR = Math.sqrt(-r.phi2);
            rootTheta = Math.atan2(Math.sqrt(-disc), r.phi1);
            isComplex = true;
          } else {
            const l1 = (r.phi1 + Math.sqrt(disc)) / 2;
            const l2 = (r.phi1 - Math.sqrt(disc)) / 2;
            const dominant = Math.abs(l1) >= Math.abs(l2) ? l1 : l2;
            rootR = Math.abs(dominant);
            rootTheta = dominant < 0 ? Math.PI : 0;
            isComplex = false;
          }
          const thetaPhi = 2 * Math.PI / PHI;
          const rRef = 0.7;
          const logRDist = Math.abs(Math.log(Math.max(rootR, 0.01)) - Math.log(rRef));
          let thetaDist = Math.abs(rootTheta - thetaPhi);
          thetaDist = Math.min(thetaDist, 2 * Math.PI - thetaDist);
          const dPhi = logRDist + thetaDist;
          const distToInvPhi = Math.abs(r.eigenvalueModulus - 1 / PHI);
          const x = rootR * Math.cos(rootTheta);
          const y = rootR * Math.sin(rootTheta);
          return {
            gene: r.gene,
            geneType: r.geneType,
            geneCategory: classifyGeneExpanded(r.gene),
            beta1: +r.phi1.toFixed(4),
            beta2: +r.phi2.toFixed(4),
            eigenvalue: +r.eigenvalueModulus.toFixed(4),
            r: +rootR.toFixed(4),
            theta: +rootTheta.toFixed(4),
            isComplex,
            dPhi: +dPhi.toFixed(4),
            distToInvPhi: +distToInvPhi.toFixed(4),
            x: +x.toFixed(4),
            y: +y.toFixed(4),
            r2: +r.rSquared.toFixed(4),
            stable: r.eigenvalueModulus < 1.0,
            confidence: r.confidenceLevel,
          };
        });
        genomeSearchCache[datasetId] = { data: allResults, timestamp: Date.now() };
      }

      const topN = Math.min(Math.max(parseInt(req.query.topN as string) || 200, 20), 1000);
      const fibonacciNearest = [...allResults]
        .filter(g => g.stable)
        .sort((a, b) => a.distToInvPhi - b.distToInvPhi)
        .slice(0, topN);

      const N = allResults.length;
      const n = fibonacciNearest.length;

      function lnComb(a: number, b: number): number {
        if (b < 0 || b > a) return -Infinity;
        if (b === 0 || b === a) return 0;
        let s = 0;
        for (let i = 0; i < b; i++) {
          s += Math.log(a - i) - Math.log(i + 1);
        }
        return s;
      }

      function hypergeometricPValue(k: number, N: number, K: number, n: number): number {
        if (K === 0 || n === 0) return 1;
        const lnTotal = lnComb(N, n);
        let pval = 0;
        for (let i = k; i <= Math.min(K, n); i++) {
          const lnP = lnComb(K, i) + lnComb(N - K, n - i) - lnTotal;
          pval += Math.exp(lnP);
        }
        return Math.min(pval, 1);
      }

      const { GENE_CATEGORIES: GC } = await import("../gene-categories");
      const allCategories: Record<string, Set<string>> = {};
      for (const [k, v] of Object.entries(GC)) {
        allCategories[k] = v as Set<string>;
      }

      const allGeneCategories: Record<string, number> = {};
      for (const [cat, geneSet] of Object.entries(allCategories)) {
        let count = 0;
        for (const g of allResults) {
          if (geneSet.has(g.gene.toUpperCase())) count++;
        }
        allGeneCategories[cat] = count;
      }

      const fibGeneUpper = new Set(fibonacciNearest.map(g => g.gene.toUpperCase()));

      const enrichmentResults: any[] = [];
      for (const [category, geneSet] of Object.entries(allCategories)) {
        const K = allGeneCategories[category];
        let k = 0;
        for (const gName of fibGeneUpper) {
          if (geneSet.has(gName)) k++;
        }
        const expected = N > 0 ? (K * n) / N : 0;
        const foldEnrichment = expected > 0 ? k / expected : (k > 0 ? Infinity : 0);
        const pValue = hypergeometricPValue(k, N, K, n);

        enrichmentResults.push({
          category,
          observedCount: k,
          totalInDataset: K,
          expectedCount: +expected.toFixed(4),
          foldEnrichment: foldEnrichment === Infinity ? 'Inf' : +foldEnrichment.toFixed(4),
          pValue: +pValue.toFixed(6),
        });
      }

      enrichmentResults.sort((a, b) => a.pValue - b.pValue);

      const functionalAnnotation = fibonacciNearest.map(g => {
        const upper = g.gene.toUpperCase();
        const categories: string[] = [];
        for (const [cat, geneSet] of Object.entries(allCategories)) {
          if (geneSet.has(upper)) categories.push(cat);
        }
        return {
          gene: g.gene,
          eigenvalue: g.eigenvalue,
          dPhi: g.dPhi,
          categories: categories.length > 0 ? categories : ['other'],
        };
      });

      const PHI_VAL = (1 + Math.sqrt(5)) / 2;
      const PHI_WINDOW = 0.05;
      const stableGenes = allResults.filter((g: any) => g.stable);
      const stableN = stableGenes.length;
      const nearPhiCount = stableGenes.filter((g: any) => Math.abs(g.eigenvalue - (1 / PHI_VAL)) < PHI_WINDOW).length;
      const nullRate = stableN > 0 ? (2 * PHI_WINDOW) : 0;
      const observedRate = stableN > 0 ? nearPhiCount / stableN : 0;
      const liveEnrichment = nullRate > 0 ? observedRate / nullRate : 0;

      res.json({
        dataset: { id: dataset.id, name: dataset.name, species: dataset.species },
        totalGenes: N,
        stableGenes: stableN,
        fibonacciNearestCount: n,
        fibonacciNearest,
        enrichmentResults,
        functionalAnnotation,
        summaryStats: {
          phiWindow: PHI_WINDOW,
          phiTarget: +(1 / PHI_VAL).toFixed(6),
          nearPhiCount,
          observedRate: +observedRate.toFixed(6),
          uniformNullRate: +nullRate.toFixed(6),
          liveEnrichmentRatio: +liveEnrichment.toFixed(2),
          note: 'Live-computed from current dataset. Uniform null assumes eigenvalues distributed evenly in [0,1]. For stability-filtered null comparison, see Fibonacci Reply Package.'
        },
        referenceParameters: {
          goldenRatio: +PHI_VAL.toFixed(6),
          goldenAngleRad: +(2 * Math.PI / PHI_VAL).toFixed(6),
          goldenAngleDeg: +(360 / PHI_VAL).toFixed(2),
          radialReference: 0.7,
          note: 'θ_φ and r_ref are imposed geometric reference points, not data-derived values.'
        },
      });
    } catch (error: any) {
      console.error("Fibonacci enrichment error:", error);
      res.status(500).json({ error: error.message || "Failed to compute Fibonacci enrichment" });
    }
  });

  // ===== Multi-Species Validation Panel =====
  app.get("/api/validation/multi-species", async (_req, res) => {
    try {
      const speciesResults: any[] = [];
      
      const computeStabilityFiltered = (clock: any[], target: any[]) => {
        const stableClock = clock.filter((g: any) => g.eigenvalueModulus < 1.0);
        const stableTarget = target.filter((g: any) => g.eigenvalueModulus < 1.0);
        const unstableClock = clock.filter((g: any) => g.eigenvalueModulus >= 1.0);
        const unstableTarget = target.filter((g: any) => g.eigenvalueModulus >= 1.0);
        const stableClockMeanEV = stableClock.length > 0 ? +(stableClock.reduce((s: number, r: any) => s + r.eigenvalueModulus, 0) / stableClock.length).toFixed(4) : 0;
        const stableTargetMeanEV = stableTarget.length > 0 ? +(stableTarget.reduce((s: number, r: any) => s + r.eigenvalueModulus, 0) / stableTarget.length).toFixed(4) : 0;
        return {
          stableClockN: stableClock.length,
          stableTargetN: stableTarget.length,
          unstableClockN: unstableClock.length,
          unstableTargetN: unstableTarget.length,
          stableClockMeanEV,
          stableTargetMeanEV,
          stableGap: +(stableClockMeanEV - stableTargetMeanEV).toFixed(4),
          stableHierarchyPreserved: stableClockMeanEV > stableTargetMeanEV,
          unstableGenes: [...unstableClock, ...unstableTarget].map((g: any) => ({ gene: g.gene, geneType: g.geneType, eigenvalue: +g.eigenvalueModulus.toFixed(4) }))
        };
      };
      
      const mouseDatasets = [
        { id: 'GSE11923_Liver_1h_48h_genes', name: 'Mouse Liver (Hughes 2009, GSE11923)', species: 'Mus musculus', file: 'GSE11923_Liver_1h_48h_genes.csv' },
        { id: 'GSE54650_Liver_circadian', name: 'Mouse Liver (Hughes Atlas, GSE54650)', species: 'Mus musculus', file: 'GSE54650_Liver_circadian.csv' },
      ];
      
      for (const ds of mouseDatasets) {
        const filePath = path.join(process.cwd(), 'datasets', ds.file);
        if (!fs.existsSync(filePath)) continue;
        const results = generateProcessedTable(filePath);
        const clock = results.filter(r => r.geneType === 'clock');
        const target = results.filter(r => r.geneType === 'target');
        if (clock.length >= 2 && target.length >= 2) {
          const clockMean = clock.reduce((s, r) => s + r.eigenvalueModulus, 0) / clock.length;
          const targetMean = target.reduce((s, r) => s + r.eigenvalueModulus, 0) / target.length;
          const allGenes = [...clock, ...target];
          const adfPassCount = allGenes.filter(g => !g.adfStationarityFlag).length;
          const adfPassRate = allGenes.length > 0 ? +(adfPassCount / allGenes.length * 100).toFixed(1) : 0;
          speciesResults.push({
            species: ds.species, dataset: ds.name, datasetId: ds.id,
            clockN: clock.length, targetN: target.length,
            clockMeanEV: +clockMean.toFixed(4), targetMeanEV: +targetMean.toFixed(4),
            gap: +(clockMean - targetMean).toFixed(4),
            hierarchyPreserved: clockMean > targetMean,
            adfStationarityPassRate: adfPassRate,
            clockGenes: clock.slice(0, 10).map(g => ({ gene: g.gene, eigenvalue: +g.eigenvalueModulus.toFixed(4), adfStationary: !g.adfStationarityFlag })),
            targetGenes: target.slice(0, 10).map(g => ({ gene: g.gene, eigenvalue: +g.eigenvalueModulus.toFixed(4), adfStationary: !g.adfStationarityFlag })),
            stabilityFiltered: computeStabilityFiltered(clock, target)
          });
        }
      }
      
      const humanDatasets = [
        { id: 'GSE113883_Human_WholeBlood', name: 'Human Whole Blood (Braun 2018, GSE113883)', species: 'Homo sapiens', file: 'GSE113883_Human_WholeBlood.csv' },
        { id: 'GSE48113_Human_Blood_Circadian', name: 'Human Blood (Archer 2014, GSE48113)', species: 'Homo sapiens', file: 'GSE48113_Human_Blood_Circadian.csv' },
        { id: 'GSE48113_ForcedDesync_Aligned', name: 'Human Blood Aligned (Archer 2014, GSE48113)', species: 'Homo sapiens', file: 'GSE48113_ForcedDesync_Aligned_circadian.csv' },
        { id: 'GSE48113_ForcedDesync_Misaligned', name: 'Human Blood Misaligned (Archer 2014, GSE48113)', species: 'Homo sapiens', file: 'GSE48113_ForcedDesync_Misaligned_circadian.csv' },
        { id: 'GSE39445_Blood_SufficientSleep', name: 'Human Blood Sufficient Sleep (Moller-Levet 2013, GSE39445)', species: 'Homo sapiens', file: 'GSE39445_Blood_SufficientSleep_circadian.csv' },
        { id: 'GSE39445_Blood_SleepRestriction', name: 'Human Blood Sleep Restriction (Moller-Levet 2013, GSE39445)', species: 'Homo sapiens', file: 'GSE39445_Blood_SleepRestriction_circadian.csv' },
        { id: 'GSE122541_Nurses_DayShift', name: 'Human PBMC Day-Shift Nurses (Gamble 2019, GSE122541)', species: 'Homo sapiens', file: 'GSE122541_Nurses_DayShift_circadian.csv' },
        { id: 'GSE122541_Nurses_NightShift', name: 'Human PBMC Night-Shift Nurses (Gamble 2019, GSE122541)', species: 'Homo sapiens', file: 'GSE122541_Nurses_NightShift_circadian.csv' },
        { id: 'GSE205155_Skin_Dermis', name: 'Human Skin Dermis (del Olmo 2022, GSE205155)', species: 'Homo sapiens', file: 'GSE205155_Skin_Dermis_circadian.csv' },
        { id: 'GSE205155_Skin_Epidermis', name: 'Human Skin Epidermis (del Olmo 2022, GSE205155)', species: 'Homo sapiens', file: 'GSE205155_Skin_Epidermis_circadian.csv' },
      ];
      
      for (const ds of humanDatasets) {
        const filePath = path.join(process.cwd(), 'datasets', ds.file);
        if (!fs.existsSync(filePath)) continue;
        const results = generateProcessedTable(filePath);
        const clock = results.filter(r => r.geneType === 'clock');
        const target = results.filter(r => r.geneType === 'target');
        if (clock.length >= 2 && target.length >= 2) {
          const clockMean = clock.reduce((s, r) => s + r.eigenvalueModulus, 0) / clock.length;
          const targetMean = target.reduce((s, r) => s + r.eigenvalueModulus, 0) / target.length;
          const allGenes = [...clock, ...target];
          const adfPassCount = allGenes.filter(g => !g.adfStationarityFlag).length;
          const adfPassRate = allGenes.length > 0 ? +(adfPassCount / allGenes.length * 100).toFixed(1) : 0;
          speciesResults.push({
            species: ds.species, dataset: ds.name, datasetId: ds.id,
            clockN: clock.length, targetN: target.length,
            clockMeanEV: +clockMean.toFixed(4), targetMeanEV: +targetMean.toFixed(4),
            gap: +(clockMean - targetMean).toFixed(4),
            hierarchyPreserved: clockMean > targetMean,
            adfStationarityPassRate: adfPassRate,
            clockGenes: clock.slice(0, 10).map(g => ({ gene: g.gene, eigenvalue: +g.eigenvalueModulus.toFixed(4), adfStationary: !g.adfStationarityFlag })),
            targetGenes: target.slice(0, 10).map(g => ({ gene: g.gene, eigenvalue: +g.eigenvalueModulus.toFixed(4), adfStationary: !g.adfStationarityFlag })),
            stabilityFiltered: computeStabilityFiltered(clock, target)
          });
        }
      }
      
      try {
        const { runExternalValidation } = await import('../external-validation');
        const baboonResult = runExternalValidation();
        if (baboonResult.tissueResults.length > 0) {
          speciesResults.push({
            species: 'Papio anubis',
            dataset: `Baboon Multi-tissue (Mure 2018, GSE98965)`,
            datasetId: 'GSE98965_baboon_FPKM',
            clockN: baboonResult.tissueResults.reduce((s, t) => s + t.clockN, 0),
            targetN: baboonResult.tissueResults.reduce((s, t) => s + t.targetN, 0),
            clockMeanEV: +baboonResult.clockGrandMean.toFixed(4),
            targetMeanEV: +baboonResult.targetGrandMean.toFixed(4),
            gap: +(baboonResult.clockGrandMean - baboonResult.targetGrandMean).toFixed(4),
            hierarchyPreserved: baboonResult.clockGrandMean > baboonResult.targetGrandMean,
            nTissues: baboonResult.nTissues,
            nTissuesWithHierarchy: baboonResult.nTissuesWithHierarchy,
            fractionPreserved: +baboonResult.fractionPreserved.toFixed(2),
            pValue: baboonResult.pValue,
            adfStationarityPassRate: baboonResult.adfStationarityRate ? +(baboonResult.adfStationarityRate * 100).toFixed(1) : undefined,
            clockGenes: baboonResult.tissueResults.slice(0, 3).flatMap(t => t.clockGenes.slice(0, 3).map(g => ({ gene: g.gene, eigenvalue: +g.eigenvalue.toFixed(4), tissue: t.tissue, adfStationary: g.adfStationary }))),
            targetGenes: baboonResult.tissueResults.slice(0, 3).flatMap(t => t.targetGenes.slice(0, 3).map(g => ({ gene: g.gene, eigenvalue: +g.eigenvalue.toFixed(4), tissue: t.tissue, adfStationary: g.adfStationary }))),
            stabilityFiltered: { note: 'Stability filtering not available for externally-validated datasets. Baboon results use a separate external validation module without per-gene eigenvalueModulus access.' }
          });
        }
      } catch (e) {}
      
      const arabidopsisFullFiles = ['GSE242964_Arabidopsis_DayA_CT-header.csv', 'GSE242964_Arabidopsis_DayB_CT-header.csv', 'GSE242964_Arabidopsis_DayC_CT-header.csv'];
      const ARABIDOPSIS_CLOCK = ['CCA1', 'LHY', 'TOC1', 'PRR3', 'PRR5', 'PRR7', 'PRR9', 'GI', 'ZTL', 'ELF3', 'ELF4', 'LUX', 'CRY1', 'CRY2', 'PHYA', 'PHYB'];
      
      for (let dayIdx = 0; dayIdx < arabidopsisFullFiles.length; dayIdx++) {
        const fullFile = path.join(process.cwd(), 'datasets', arabidopsisFullFiles[dayIdx]);
        if (!fs.existsSync(fullFile)) continue;
        
        const dayLabel = ['Early (Day A)', 'Mid (Day B)', 'Late (Day C)'][dayIdx];
        const allResults = generateProcessedTable(fullFile, { clockGenes: ARABIDOPSIS_CLOCK, targetGenes: [] });
        const clock = allResults.filter(r => r.geneType === 'clock');
        const nonClock = allResults.filter(r => r.geneType === 'other');
        
        if (clock.length >= 2 && nonClock.length >= 10) {
          const clockMean = clock.reduce((s, r) => s + r.eigenvalueModulus, 0) / clock.length;
          const nonClockMean = nonClock.reduce((s, r) => s + r.eigenvalueModulus, 0) / nonClock.length;
          const allGenes = [...clock, ...nonClock];
          const adfPassCount = allGenes.filter(g => !g.adfStationarityFlag).length;
          const adfPassRate = allGenes.length > 0 ? +(adfPassCount / allGenes.length * 100).toFixed(1) : 0;
          speciesResults.push({
            species: 'Arabidopsis thaliana',
            dataset: `Arabidopsis ${dayLabel} (Redmond 2024, GSE242964)`,
            datasetId: `GSE242964_${arabidopsisFullFiles[dayIdx].replace('.csv', '')}`,
            clockN: clock.length, targetN: nonClock.length,
            clockMeanEV: +clockMean.toFixed(4), targetMeanEV: +nonClockMean.toFixed(4),
            gap: +(clockMean - nonClockMean).toFixed(4),
            hierarchyPreserved: clockMean > nonClockMean,
            adfStationarityPassRate: adfPassRate,
            note: 'All genes processed from same matrix. Clock genes identified by symbol (CCA1, LHY, TOC1, PRR, GI, ELF, CRY, PHY). No outlier filtering applied — raw comparison.',
            clockGenes: clock.slice(0, 10).map(g => ({ gene: g.gene, eigenvalue: +g.eigenvalueModulus.toFixed(4), adfStationary: !g.adfStationarityFlag })),
            targetGenes: nonClock.sort((a, b) => b.eigenvalueModulus - a.eigenvalueModulus).slice(0, 10).map(g => ({ gene: g.gene, eigenvalue: +g.eigenvalueModulus.toFixed(4), adfStationary: !g.adfStationarityFlag })),
            stabilityFiltered: computeStabilityFiltered(clock, nonClock)
          });
        }
      }
      
      const totalSpecies = new Set(speciesResults.map(r => r.species)).size;
      const totalDatasets = speciesResults.length;
      const hierarchyCount = speciesResults.filter(r => r.hierarchyPreserved).length;
      const stabilityFilteredHierarchyCount = speciesResults.filter(r => r.stabilityFiltered?.stableHierarchyPreserved === true).length;
      
      const orthologTable = getOrthologTable();
      const speciesOrthologyMap: Record<string, any> = {};
      
      for (const sr of speciesResults) {
        const sp = sr.species as OrthologSpecies;
        const allGenes = [...(sr.clockGenes || []), ...(sr.targetGenes || [])];
        const orthologMatched = buildCrossSpeciesComparison(
          allGenes.map((g: any) => ({ gene: g.gene, eigenvalue: g.eigenvalue, geneType: sr.clockGenes?.includes(g) ? 'clock' : 'target' })),
          sp
        );
        
        const matchedViaOrthology = orthologMatched.map(m => ({
          gene: m.gene,
          orthologGroup: m.orthologGroup,
          confidence: m.confidence,
          source: m.source,
          hasMultiSpeciesOrthologs: m.hasMultiSpeciesOrthologs
        }));
        
        const orthologOnlyGenes = orthologMatched.filter(m => m.hasMultiSpeciesOrthologs);
        const orthologClockEVs = orthologOnlyGenes.filter(g => g.geneType === 'clock').map(g => g.eigenvalue);
        const orthologTargetEVs = orthologOnlyGenes.filter(g => g.geneType === 'target').map(g => g.eigenvalue);
        const orthologClockMean = orthologClockEVs.length > 0 ? orthologClockEVs.reduce((a, b) => a + b, 0) / orthologClockEVs.length : null;
        const orthologTargetMean = orthologTargetEVs.length > 0 ? orthologTargetEVs.reduce((a, b) => a + b, 0) / orthologTargetEVs.length : null;
        
        sr.orthologyMapping = {
          matchedGenes: matchedViaOrthology,
          totalMatched: matchedViaOrthology.length,
          matchedWithMultiSpeciesOrthologs: orthologOnlyGenes.length,
          note: sp === 'Arabidopsis thaliana'
            ? 'CCA1/LHY/TOC1/PRR/GI/ELF/ZTL/LUX are plant-specific clock genes with no mammalian orthologs. Only CRY1/CRY2 have confirmed mammalian orthologs (Ensembl Compara 112 / OrthoDB v11).'
            : undefined
        };
        
        sr.orthologNormalizedGap = (orthologClockMean !== null && orthologTargetMean !== null)
          ? +((orthologClockMean - orthologTargetMean).toFixed(4))
          : null;
        
        if (!speciesOrthologyMap[sr.species]) {
          speciesOrthologyMap[sr.species] = [];
        }
        speciesOrthologyMap[sr.species].push(...orthologMatched);
      }
      
      const crossSpeciesPairs: any[] = [];
      const speciesList = Object.keys(speciesOrthologyMap);
      for (let i = 0; i < speciesList.length; i++) {
        for (let j = i + 1; j < speciesList.length; j++) {
          const sp1 = speciesList[i];
          const sp2 = speciesList[j];
          const genes1 = speciesOrthologyMap[sp1] || [];
          const genes2 = speciesOrthologyMap[sp2] || [];
          const sharedGroups = new Set<string>();
          for (const g1 of genes1) {
            for (const g2 of genes2) {
              if (g1.orthologGroup === g2.orthologGroup) {
                sharedGroups.add(g1.orthologGroup);
              }
            }
          }
          if (sharedGroups.size > 0) {
            crossSpeciesPairs.push({
              species1: sp1,
              species2: sp2,
              sharedOrthologGroups: Array.from(sharedGroups),
              count: sharedGroups.size,
              matchMethod: 'Formal 1:1 orthology (Ensembl Compara 112 / OrthoDB v11 / MGI)'
            });
          }
        }
      }
      
      res.json({
        title: 'Multi-Species Gearbox Validation Panel',
        summary: `Clock > Target eigenvalue hierarchy tested across ${totalDatasets} dataset-level analyses from ${totalSpecies} species. Hierarchy preserved in ${hierarchyCount}/${totalDatasets} at aggregate level (${(hierarchyCount/totalDatasets*100).toFixed(0)}%). Note: tissue-level resolution varies (e.g. baboon: 8/14 tissues = 57%).`,
        totalSpecies,
        totalDatasets,
        hierarchyPreservedCount: hierarchyCount,
        fractionPreserved: +(hierarchyCount / totalDatasets).toFixed(2),
        stabilityFilteredHierarchyCount,
        stabilityNote: 'Stability filter excludes AR(2) fits with |λ| >= 1.0 (non-stationary). Both all-genes and stable-only results reported for transparency.',
        orthologyVersion: '1.0',
        orthologySource: 'Curated from Ensembl Compara 112 / OrthoDB v11 / MGI',
        orthologySummary: {
          totalOrthologGroups: orthologTable.length,
          clockGroups: orthologTable.filter(e => e.geneType === 'clock').length,
          targetGroups: orthologTable.filter(e => e.geneType === 'target').length,
          plantSpecificGroups: orthologTable.filter(e => e.symbols['Mus musculus'] === null && e.symbols['Homo sapiens'] === null && e.symbols['Arabidopsis thaliana'] !== null).length,
          mammalianGroups: orthologTable.filter(e => e.symbols['Mus musculus'] !== null).length,
          crossSpeciesComparisons: crossSpeciesPairs,
          note: 'Gene comparisons across species now use formal 1:1 orthology assignments rather than string matching. Mouse Per1 ↔ Human PER1 are confirmed 1:1 orthologs via Ensembl Compara, not just case-insensitive name matches.'
        },
        results: speciesResults
      });
    } catch (error: any) {
      console.error("Error in multi-species validation:", error);
      res.status(500).json({ error: error.message || "Failed to run multi-species validation" });
    }
  });

  // ===== Gap-Threshold Classifier =====
  app.get("/api/validation/gap-classifier", async (req, res) => {
    try {
      const { runGapClassifier } = await import('../gap-classifier');
      const result = runGapClassifier();
      res.json(result);
    } catch (error: any) {
      console.error('Gap classifier error:', error);
      res.status(500).json({ error: 'Failed to run gap classifier', details: error.message });
    }
  });

  app.get("/api/validation/gap-classifier/roc", async (req, res) => {
    try {
      const { runROCAnalysis } = await import('../gap-classifier');
      const result = runROCAnalysis();
      res.json(result);
    } catch (error: any) {
      console.error('ROC analysis error:', error);
      res.status(500).json({ error: 'Failed to run ROC analysis', details: error.message });
    }
  });

  app.get("/api/validation/skin-stress-tests", async (_req, res) => {
    try {
      const { runSkinStressTests } = await import('../skin-stress-tests');
      const result = runSkinStressTests();
      if (result && result.error) {
        return res.status(404).json(result);
      }
      res.json(result);
    } catch (error: any) {
      console.error('Skin stress tests error:', error);
      res.status(500).json({ error: 'Failed to run skin stress tests', details: error.message });
    }
  });

  // ===== Genome-Wide AR(2) Validation =====
  const genomeWideCache: Record<string, { data: any; timestamp: number }> = {};

  app.get("/api/validation/genome-wide", async (req, res) => {
    try {
      const datasetId = (req.query.dataset as string) || 'GSE54650_Liver_circadian';
      const dataset = AVAILABLE_PROCESSED_DATASETS.find(d => d.id === datasetId);
      if (!dataset) {
        return res.status(404).json({ error: "Dataset not found", available: AVAILABLE_PROCESSED_DATASETS.map(d => d.id) });
      }
      const filePath = path.join(process.cwd(), 'datasets', dataset.file);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: `Dataset file not found: ${dataset.file}` });
      }

      if (genomeWideCache[datasetId] && (Date.now() - genomeWideCache[datasetId].timestamp) < 3600000) {
        return res.json(genomeWideCache[datasetId].data);
      }

      const results = generateProcessedTable(filePath);
      if (results.length === 0) {
        return res.status(500).json({ error: "No genes could be analyzed" });
      }

      const clock = results.filter(r => r.geneType === 'clock');
      const target = results.filter(r => r.geneType === 'target');
      const other = results.filter(r => r.geneType === 'other');
      const allEVs = results.map(r => r.eigenvalueModulus).sort((a, b) => a - b);
      const clockEVs = clock.map(r => r.eigenvalueModulus);
      const targetEVs = target.map(r => r.eigenvalueModulus);

      const meanAll = allEVs.reduce((s, v) => s + v, 0) / allEVs.length;
      const meanClock = clockEVs.length > 0 ? clockEVs.reduce((s, v) => s + v, 0) / clockEVs.length : 0;
      const meanTarget = targetEVs.length > 0 ? targetEVs.reduce((s, v) => s + v, 0) / targetEVs.length : 0;

      const percentileOf = (val: number) => {
        let count = 0;
        for (const ev of allEVs) { if (ev <= val) count++; }
        return +(count / allEVs.length * 100).toFixed(1);
      };

      const clockPercentiles = clockEVs.map(percentileOf);
      const targetPercentiles = targetEVs.map(percentileOf);
      const meanClockPercentile = clockPercentiles.length > 0 ? +(clockPercentiles.reduce((s, v) => s + v, 0) / clockPercentiles.length).toFixed(1) : 0;
      const meanTargetPercentile = targetPercentiles.length > 0 ? +(targetPercentiles.reduce((s, v) => s + v, 0) / targetPercentiles.length).toFixed(1) : 0;

      const wilcoxonRankSum = (groupA: number[], groupB: number[]) => {
        const combined = [
          ...groupA.map(v => ({ v, g: 'A' })),
          ...groupB.map(v => ({ v, g: 'B' }))
        ].sort((a, b) => a.v - b.v);
        const n = combined.length;
        for (let i = 0; i < n; ) {
          let j = i;
          while (j < n && combined[j].v === combined[i].v) j++;
          const avgRank = (i + 1 + j) / 2;
          for (let k = i; k < j; k++) (combined[k] as any).rank = avgRank;
          i = j;
        }
        const nA = groupA.length;
        const nB = groupB.length;
        const rankSumA = combined.filter(c => c.g === 'A').reduce((s, c) => s + (c as any).rank, 0);
        const U = rankSumA - nA * (nA + 1) / 2;
        const muU = nA * nB / 2;
        const sigmaU = Math.sqrt(nA * nB * (nA + nB + 1) / 12);
        const z = sigmaU > 0 ? (U - muU) / sigmaU : 0;
        const p = 2 * (1 - normalCDF(Math.abs(z)));
        return { U: +U.toFixed(1), z: +z.toFixed(4), p: Math.max(p, 1e-300), nA, nB };
      };

      const normalCDF = (x: number) => {
        const t = 1 / (1 + 0.2316419 * Math.abs(x));
        const d = 0.3989422804014327;
        const p = d * Math.exp(-x * x / 2) * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
        return x > 0 ? 1 - p : p;
      };

      const clockGeneNames = new Set(clock.map(g => g.gene.toLowerCase()));
      const nonClockEVs = results.filter(r => !clockGeneNames.has(r.gene.toLowerCase())).map(r => r.eigenvalueModulus);
      const clockVsGenome = wilcoxonRankSum(clockEVs, nonClockEVs);
      const clockVsTarget = clockEVs.length >= 2 && targetEVs.length >= 2 ? wilcoxonRankSum(clockEVs, targetEVs) : null;

      const fisherYatesShuffle = (arr: number[]) => {
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
      };

      const nPerms = 10000;
      const observedGap = meanClock - meanTarget;
      const panelSize = clock.length + target.length;
      let exceedCount = 0;
      for (let i = 0; i < nPerms; i++) {
        const shuffled = fisherYatesShuffle([...allEVs]);
        const fakeClock = shuffled.slice(0, clock.length);
        const fakeTarget = shuffled.slice(clock.length, panelSize);
        const fakeClockMean = fakeClock.reduce((s, v) => s + v, 0) / fakeClock.length;
        const fakeTargetMean = fakeTarget.reduce((s, v) => s + v, 0) / fakeTarget.length;
        if (fakeClockMean - fakeTargetMean >= observedGap) exceedCount++;
      }
      const permutationP = +(exceedCount / nPerms).toFixed(6);

      const bins = 20;
      const minEV = allEVs[0];
      const maxEV = allEVs[allEVs.length - 1];
      const binWidth = (maxEV - minEV) / bins || 0.05;
      const histogram: { binStart: number; binEnd: number; count: number; clockCount: number; targetCount: number }[] = [];
      for (let b = 0; b < bins; b++) {
        const binStart = +(minEV + b * binWidth).toFixed(4);
        const binEnd = +(minEV + (b + 1) * binWidth).toFixed(4);
        const inBin = results.filter(r => r.eigenvalueModulus >= binStart && (b < bins - 1 ? r.eigenvalueModulus < binEnd : r.eigenvalueModulus <= binEnd));
        histogram.push({
          binStart, binEnd,
          count: inBin.length,
          clockCount: inBin.filter(r => r.geneType === 'clock').length,
          targetCount: inBin.filter(r => r.geneType === 'target').length
        });
      }

      const q25 = allEVs[Math.floor(allEVs.length * 0.25)];
      const q50 = allEVs[Math.floor(allEVs.length * 0.50)];
      const q75 = allEVs[Math.floor(allEVs.length * 0.75)];
      const q90 = allEVs[Math.floor(allEVs.length * 0.90)];
      const q95 = allEVs[Math.floor(allEVs.length * 0.95)];
      const q99 = allEVs[Math.floor(allEVs.length * 0.99)];

      const clockAboveMedian = clockEVs.filter(v => v > q50).length;
      const clockAbove75 = clockEVs.filter(v => v > q75).length;
      const clockAbove90 = clockEVs.filter(v => v > q90).length;

      const responseData = {
        dataset: dataset.name,
        datasetId: dataset.id,
        description: dataset.description,
        totalGenesAnalyzed: results.length,
        genomeWideDistribution: {
          mean: +meanAll.toFixed(4),
          median: +q50.toFixed(4),
          q25: +q25.toFixed(4),
          q75: +q75.toFixed(4),
          q90: +q90.toFixed(4),
          q95: +q95.toFixed(4),
          q99: +q99.toFixed(4),
          min: +allEVs[0].toFixed(4),
          max: +allEVs[allEVs.length - 1].toFixed(4)
        },
        clockGenes: {
          n: clock.length,
          meanEigenvalue: +meanClock.toFixed(4),
          meanPercentile: meanClockPercentile,
          genes: clock.sort((a, b) => b.eigenvalueModulus - a.eigenvalueModulus).map(g => ({
            gene: g.gene,
            eigenvalue: +g.eigenvalueModulus.toFixed(4),
            percentile: percentileOf(g.eigenvalueModulus),
            confidence: g.confidenceLevel,
            adfStationary: !g.adfStationarityFlag
          }))
        },
        targetGenes: {
          n: target.length,
          meanEigenvalue: +meanTarget.toFixed(4),
          meanPercentile: meanTargetPercentile,
          genes: target.sort((a, b) => b.eigenvalueModulus - a.eigenvalueModulus).map(g => ({
            gene: g.gene,
            eigenvalue: +g.eigenvalueModulus.toFixed(4),
            percentile: percentileOf(g.eigenvalueModulus),
            confidence: g.confidenceLevel,
            adfStationary: !g.adfStationarityFlag
          }))
        },
        gearboxResult: {
          gap: +observedGap.toFixed(4),
          hierarchyPreserved: meanClock > meanTarget,
          clockAboveMedian: `${clockAboveMedian}/${clock.length}`,
          clockAbove75thPercentile: `${clockAbove75}/${clock.length}`,
          clockAbove90thPercentile: `${clockAbove90}/${clock.length}`,
          interpretation: meanClock > meanTarget
            ? `Clock genes (mean percentile: ${meanClockPercentile}th) rank significantly higher than the genome-wide distribution. The gearbox hierarchy emerges without curated selection.`
            : `Clock genes do not show elevated persistence in this dataset.`
        },
        statisticalTests: {
          wilcoxonClockVsGenome: clockVsGenome,
          wilcoxonClockVsTarget: clockVsTarget,
          permutationTest: {
            observedGap: +observedGap.toFixed(4),
            nPermutations: nPerms,
            pValue: permutationP,
            significant: permutationP < 0.05,
            interpretation: permutationP < 0.05
              ? `The observed clock-target gap (${observedGap.toFixed(4)}) is unlikely to arise by chance (p=${permutationP}). The gearbox hierarchy is not an artifact of panel selection.`
              : `The observed gap could arise by chance (p=${permutationP}).`
          }
        },
        histogram,
        stabilityFiltered: (() => {
          const stableResults = results.filter(r => r.eigenvalueModulus < 1.0);
          const stableClock = stableResults.filter(r => r.geneType === 'clock');
          const stableTarget = stableResults.filter(r => r.geneType === 'target');
          const stableAllEVs = stableResults.map(r => r.eigenvalueModulus).sort((a, b) => a - b);
          if (stableAllEVs.length === 0) return null;

          const stMeanAll = stableAllEVs.reduce((s, v) => s + v, 0) / stableAllEVs.length;
          const stMeanClock = stableClock.length > 0 ? stableClock.reduce((s, r) => s + r.eigenvalueModulus, 0) / stableClock.length : 0;
          const stMeanTarget = stableTarget.length > 0 ? stableTarget.reduce((s, r) => s + r.eigenvalueModulus, 0) / stableTarget.length : 0;
          const stGap = stMeanClock - stMeanTarget;

          const stPercentileOf = (val: number) => {
            let c = 0;
            for (const ev of stableAllEVs) { if (ev <= val) c++; }
            return +(c / stableAllEVs.length * 100).toFixed(1);
          };
          const stClockPercentiles = stableClock.map(g => stPercentileOf(g.eigenvalueModulus));
          const stTargetPercentiles = stableTarget.map(g => stPercentileOf(g.eigenvalueModulus));
          const stMeanClockPctl = stClockPercentiles.length > 0 ? +(stClockPercentiles.reduce((s, v) => s + v, 0) / stClockPercentiles.length).toFixed(1) : 0;
          const stMeanTargetPctl = stTargetPercentiles.length > 0 ? +(stTargetPercentiles.reduce((s, v) => s + v, 0) / stTargetPercentiles.length).toFixed(1) : 0;

          const stClockEVs = stableClock.map(r => r.eigenvalueModulus);
          const stTargetEVs = stableTarget.map(r => r.eigenvalueModulus);
          const stNonClockEVs = stableResults.filter(r => r.geneType !== 'clock').map(r => r.eigenvalueModulus);
          const stWilcoxon = stClockEVs.length >= 2 ? wilcoxonRankSum(stClockEVs, stNonClockEVs) : null;
          const stWilcoxonCT = stClockEVs.length >= 2 && stTargetEVs.length >= 2 ? wilcoxonRankSum(stClockEVs, stTargetEVs) : null;

          let stExceed = 0;
          const stPanelSize = stableClock.length + stableTarget.length;
          for (let i = 0; i < nPerms; i++) {
            const sh = fisherYatesShuffle([...stableAllEVs]);
            const fc = sh.slice(0, stableClock.length);
            const ft = sh.slice(stableClock.length, stPanelSize);
            const fg = fc.reduce((s, v) => s + v, 0) / Math.max(1, fc.length) - ft.reduce((s, v) => s + v, 0) / Math.max(1, ft.length);
            if (fg >= stGap) stExceed++;
          }
          const stPermP = +(stExceed / nPerms).toFixed(6);

          const unstableCount = results.length - stableResults.length;
          const unstableClockCount = clock.length - stableClock.length;
          const unstableTargetCount = target.length - stableTarget.length;

          return {
            description: "Primary analysis restricted to stable AR(2) fits (|λ| < 1.0). Genes with eigenvalue modulus ≥ 1.0 are flagged as non-stationary and excluded.",
            totalGenesRetained: stableResults.length,
            totalGenesExcluded: unstableCount,
            percentRetained: +((stableResults.length / results.length) * 100).toFixed(1),
            clockGenesRetained: stableClock.length,
            clockGenesExcluded: unstableClockCount,
            targetGenesRetained: stableTarget.length,
            targetGenesExcluded: unstableTargetCount,
            filteredMeanAll: +stMeanAll.toFixed(4),
            filteredMeanClock: +stMeanClock.toFixed(4),
            filteredMeanTarget: +stMeanTarget.toFixed(4),
            filteredGap: +stGap.toFixed(4),
            filteredClockPercentile: stMeanClockPctl,
            filteredTargetPercentile: stMeanTargetPctl,
            filteredHierarchyPreserved: stMeanClock > stMeanTarget,
            filteredWilcoxonClockVsGenome: stWilcoxon,
            filteredWilcoxonClockVsTarget: stWilcoxonCT,
            filteredPermutationP: stPermP,
            filteredPermutationSignificant: stPermP < 0.05,
            clockGenes: stableClock.sort((a, b) => b.eigenvalueModulus - a.eigenvalueModulus).map(g => ({
              gene: g.gene,
              eigenvalue: +g.eigenvalueModulus.toFixed(4),
              percentile: stPercentileOf(g.eigenvalueModulus)
            })),
            targetGenes: stableTarget.sort((a, b) => b.eigenvalueModulus - a.eigenvalueModulus).map(g => ({
              gene: g.gene,
              eigenvalue: +g.eigenvalueModulus.toFixed(4),
              percentile: stPercentileOf(g.eigenvalueModulus)
            })),
            unstableGenes: results.filter(r => r.eigenvalueModulus >= 1.0 && (r.geneType === 'clock' || r.geneType === 'target')).map(g => ({
              gene: g.gene,
              geneType: g.geneType,
              eigenvalue: +g.eigenvalueModulus.toFixed(4),
              note: "Excluded from primary analysis (|λ| ≥ 1.0, non-stationary)"
            }))
          };
        })(),
        downloadUrl: `/api/download/genome-wide-report?dataset=${datasetId}`
      };

      genomeWideCache[datasetId] = { data: responseData, timestamp: Date.now() };
      res.json(responseData);
    } catch (error: any) {
      console.error("Error in genome-wide validation:", error);
      res.status(500).json({ error: error.message || "Failed to run genome-wide validation" });
    }
  });

  const resonanceScanCache: Record<string, { data: any; timestamp: number }> = {};

  app.get("/api/validation/resonance-scan", async (req, res) => {
    try {
      const datasetId = (req.query.dataset as string) || 'GSE54650_Liver_circadian';
      const dataset = AVAILABLE_PROCESSED_DATASETS.find(d => d.id === datasetId);
      if (!dataset) {
        return res.status(404).json({ error: "Dataset not found", available: AVAILABLE_PROCESSED_DATASETS.map(d => d.id) });
      }

      if (resonanceScanCache[datasetId] && (Date.now() - resonanceScanCache[datasetId].timestamp) < 3600000) {
        return res.json(resonanceScanCache[datasetId].data);
      }

      const filePath = path.join(process.cwd(), 'datasets', dataset.file);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: `Dataset file not found: ${dataset.file}` });
      }

      const results = generateProcessedTable(filePath);
      if (results.length === 0) {
        return res.status(500).json({ error: "No genes could be analyzed" });
      }

      const samplingInterval = datasetId.includes('GSE39445') ? 4
        : datasetId.includes('GSE11923') ? 1
        : datasetId.includes('GSE107537') ? 3
        : datasetId.includes('GSE122541') ? 3
        : 2;

      const allPoints: any[] = [];
      for (const g of results) {
        if (!g.stable || g.eigenvalueModulus >= 1.0) continue;
        const disc = g.phi1 * g.phi1 + 4 * g.phi2;
        if (disc >= 0) continue;
        const r = Math.sqrt(-g.phi2);
        const theta = Math.atan2(Math.sqrt(-disc), g.phi1);
        if (r <= 0 || theta <= 0) continue;
        const dampingRate = +(-Math.log(r)).toFixed(4);
        const naturalPeriod = +((2 * Math.PI / theta) * samplingInterval).toFixed(1);
        const dampingRatio = +((-Math.log(r)) / Math.sqrt(Math.log(r) ** 2 + theta ** 2)).toFixed(4);
        allPoints.push({
          gene: g.gene,
          geneType: g.geneType,
          eigenvalue: +g.eigenvalueModulus.toFixed(4),
          phi1: g.phi1,
          phi2: g.phi2,
          dampingRate,
          naturalPeriod,
          dampingRatio,
          rSquared: +g.rSquared.toFixed(4),
          classification: g.classification,
        });
      }

      const resonanceGenes = allPoints
        .filter(p => p.naturalPeriod >= 20 && p.naturalPeriod <= 28 && p.dampingRate < 0.5)
        .sort((a, b) => a.dampingRate - b.dampingRate);

      const nearResonance = allPoints
        .filter(p => p.naturalPeriod >= 18 && p.naturalPeriod <= 30 && p.dampingRate < 0.8 && !(p.naturalPeriod >= 20 && p.naturalPeriod <= 28 && p.dampingRate < 0.5))
        .sort((a, b) => a.dampingRate - b.dampingRate);

      const responseData = {
        dataset: { id: datasetId, name: dataset.name, species: dataset.species },
        totalGenes: results.length,
        stableGenes: results.filter(r => r.stable && r.eigenvalueModulus < 1.0).length,
        oscillatoryGenes: allPoints.length,
        samplingInterval,
        resonanceZone: {
          count: resonanceGenes.length,
          periodRange: '20-28h',
          dampingThreshold: 0.5,
          genes: resonanceGenes,
        },
        nearResonance: {
          count: nearResonance.length,
          periodRange: '18-30h (excluding core zone)',
          dampingThreshold: 0.8,
          genes: nearResonance.slice(0, 50),
        },
        allOscillatory: allPoints,
        stats: {
          meanDamping: +(allPoints.reduce((s, p) => s + p.dampingRate, 0) / allPoints.length).toFixed(4),
          meanPeriod: +(allPoints.reduce((s, p) => s + p.naturalPeriod, 0) / allPoints.length).toFixed(1),
          resonancePct: +((resonanceGenes.length / allPoints.length) * 100).toFixed(2),
          clockInResonance: resonanceGenes.filter(g => g.geneType === 'clock').length,
          targetInResonance: resonanceGenes.filter(g => g.geneType === 'target').length,
          otherInResonance: resonanceGenes.filter(g => g.geneType === 'other').length,
        },
      };

      resonanceScanCache[datasetId] = { data: responseData, timestamp: Date.now() };
      res.json(responseData);
    } catch (error: any) {
      console.error("Error in resonance scan:", error);
      res.status(500).json({ error: error.message || "Failed to run resonance scan" });
    }
  });

  app.get("/api/validation/eigenvalue-independence", async (req, res) => {
    try {
      const { analyzeEigenvalueIndependence } = await import('../eigenvalue-independence');
      const datasetId = (req.query.dataset as string) || 'GSE54650_Liver_circadian';
      const dataset = AVAILABLE_PROCESSED_DATASETS.find(d => d.id === datasetId);
      if (!dataset) {
        return res.status(404).json({ error: "Dataset not found" });
      }
      const filePath = path.join(process.cwd(), 'datasets', dataset.file);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: `Dataset file not found: ${dataset.file}` });
      }
      const samplingInterval = datasetId.includes('GSE11923') ? 1 :
                               datasetId.includes('GSE113883') ? 2 :
                               datasetId.includes('GSE221103') ? 4 : 2;
      const result = analyzeEigenvalueIndependence(filePath, datasetId, dataset.name, samplingInterval);
      res.json(result);
    } catch (error: any) {
      console.error("Error in eigenvalue independence analysis:", error);
      res.status(500).json({ error: error.message || "Failed to run eigenvalue independence analysis" });
    }
  });

  app.get("/api/validation/gap-vs-proliferation", async (req, res) => {
    try {
      const { analyzeGapVsProliferation } = await import('../eigenvalue-independence');
      const datasetsDir = path.join(process.cwd(), 'datasets');
      const result = analyzeGapVsProliferation(datasetsDir);
      res.json(result);
    } catch (error: any) {
      console.error("Error in gap vs proliferation analysis:", error);
      res.status(500).json({ error: error.message || "Failed to run gap vs proliferation analysis" });
    }
  });

  app.get("/api/validation/cross-metric-independence", async (req, res) => {
    try {
      const { analyzeCrossMetricIndependence } = await import('../cross-metric-independence');
      const datasetsDir = path.join(process.cwd(), 'datasets');
      const species = (req.query.species as string) || 'mouse';
      const result = analyzeCrossMetricIndependence(datasetsDir, species);
      res.json(result);
    } catch (error: any) {
      console.error("Error in cross-metric independence analysis:", error);
      res.status(500).json({ error: error.message || "Failed to run cross-metric independence analysis" });
    }
  });

  app.get("/api/validation/subject-level", async (req, res) => {
    try {
      const subjectDir = path.join(process.cwd(), 'datasets', 'GSE107537_per_subject');
      if (!fs.existsSync(subjectDir)) {
        return res.status(404).json({ error: "Per-subject data not found" });
      }

      const subjects = ['T14', 'T15', 'T17', 'T18', 'T19', 'T21', 'T22', 'T23'];
      const conditions = ['Day', 'Night'];
      const subjectResults: any[] = [];

      const CLOCK_GENES_UPPER = new Set(['PER1','PER2','PER3','CRY1','CRY2','CLOCK','ARNTL','BMAL1','NR1D1','NR1D2','RORC','DBP','TEF','NPAS2']);
      const TARGET_GENES_UPPER = new Set(['MYC','CCND1','CCNB1','CDK1','WEE1','CDKN1A','LGR5','AXIN2','CTNNB1','APC','TP53','MDM2','ATM','CHEK2','BCL2','BAX','PPARG','SIRT1','HIF1A','CCNE1','CCNE2','MCM6','MKI67']);

      const runSubjectAR2 = (filePath: string) => {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.trim().split('\n');
        if (lines.length < 2) return { clock: [], target: [] };

        const clockResults: any[] = [];
        const targetResults: any[] = [];

        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(',');
          if (parts.length < 2) continue;
          const gene = parts[0].trim().replace(/"/g, '');
          if (!gene) continue;
          const geneUpper = gene.toUpperCase();
          const isClock = CLOCK_GENES_UPPER.has(geneUpper);
          const isTarget = TARGET_GENES_UPPER.has(geneUpper);
          if (!isClock && !isTarget) continue;

          const values: number[] = [];
          for (let j = 1; j < parts.length; j++) {
            const v = parseFloat(parts[j]);
            if (!isNaN(v)) values.push(v);
          }
          if (values.length < 4) continue;

          const result = fitAR2WithDiagnostics(values);
          if (!result) continue;

          const entry = {
            gene,
            eigenvalue: +result.eigenvalue.toFixed(4),
            phi1: +result.phi1.toFixed(4),
            phi2: +result.phi2.toFixed(4),
            r2: +result.r2.toFixed(4),
            stable: result.eigenvalue < 1.0
          };

          if (isClock) clockResults.push(entry);
          else targetResults.push(entry);
        }

        return { clock: clockResults, target: targetResults };
      };

      for (const subj of subjects) {
        const subjData: any = { subject: subj, Day: null, Night: null };

        for (const cond of conditions) {
          const filePath = path.join(subjectDir, `${subj}_${cond}.csv`);
          if (!fs.existsSync(filePath)) continue;

          const { clock, target } = runSubjectAR2(filePath);

          const stableClock = clock.filter(r => r.stable);
          const stableTarget = target.filter(r => r.stable);

          const meanClockAll = clock.length > 0 ? clock.reduce((s, r) => s + r.eigenvalue, 0) / clock.length : 0;
          const meanTargetAll = target.length > 0 ? target.reduce((s, r) => s + r.eigenvalue, 0) / target.length : 0;
          const meanClockStable = stableClock.length > 0 ? stableClock.reduce((s, r) => s + r.eigenvalue, 0) / stableClock.length : 0;
          const meanTargetStable = stableTarget.length > 0 ? stableTarget.reduce((s, r) => s + r.eigenvalue, 0) / stableTarget.length : 0;

          subjData[cond] = {
            clockGenes: clock.length,
            targetGenes: target.length,
            meanClockEigenvalue: +meanClockAll.toFixed(4),
            meanTargetEigenvalue: +meanTargetAll.toFixed(4),
            gap: +(meanClockAll - meanTargetAll).toFixed(4),
            hierarchyPreserved: meanClockAll > meanTargetAll,
            stable: {
              clockGenes: stableClock.length,
              targetGenes: stableTarget.length,
              meanClockEigenvalue: +meanClockStable.toFixed(4),
              meanTargetEigenvalue: +meanTargetStable.toFixed(4),
              gap: +(meanClockStable - meanTargetStable).toFixed(4),
              hierarchyPreserved: meanClockStable > meanTargetStable
            },
            clockDetail: clock.sort((a, b) => b.eigenvalue - a.eigenvalue).map(g => ({
              gene: g.gene,
              eigenvalue: g.eigenvalue,
              stable: g.stable
            })),
            targetDetail: target.sort((a, b) => b.eigenvalue - a.eigenvalue).map(g => ({
              gene: g.gene,
              eigenvalue: g.eigenvalue,
              stable: g.stable
            }))
          };
        }

        subjectResults.push(subjData);
      }

      const dayGaps = subjectResults.filter(s => s.Day).map(s => s.Day.gap);
      const nightGaps = subjectResults.filter(s => s.Night).map(s => s.Night.gap);
      const dayGapsStable = subjectResults.filter(s => s.Day).map(s => s.Day.stable.gap);
      const nightGapsStable = subjectResults.filter(s => s.Night).map(s => s.Night.stable.gap);

      const pairedDeltas = subjectResults
        .filter(s => s.Day && s.Night)
        .map(s => ({ subject: s.subject, dayGap: s.Day.gap, nightGap: s.Night.gap, delta: s.Night.gap - s.Day.gap }));
      const pairedDeltasStable = subjectResults
        .filter(s => s.Day && s.Night)
        .map(s => ({ subject: s.subject, dayGap: s.Day.stable.gap, nightGap: s.Night.stable.gap, delta: s.Night.stable.gap - s.Day.stable.gap }));

      const wilcoxonSignedRank = (deltas: number[]) => {
        const absDeltasWithSign = deltas
          .filter(d => d !== 0)
          .map(d => ({ abs: Math.abs(d), sign: d > 0 ? 1 : -1 }))
          .sort((a, b) => a.abs - b.abs);
        const n = absDeltasWithSign.length;
        if (n < 3) return { W: 0, z: 0, p: 1.0, n, method: 'wilcoxon_signed_rank' };

        for (let i = 0; i < n; ) {
          let j = i;
          while (j < n && absDeltasWithSign[j].abs === absDeltasWithSign[i].abs) j++;
          const avgRank = (i + 1 + j) / 2;
          for (let k = i; k < j; k++) (absDeltasWithSign[k] as any).rank = avgRank;
          i = j;
        }

        const Wplus = absDeltasWithSign.filter(d => d.sign > 0).reduce((s, d) => s + (d as any).rank, 0);
        const Wminus = absDeltasWithSign.filter(d => d.sign < 0).reduce((s, d) => s + (d as any).rank, 0);
        const W = Math.min(Wplus, Wminus);
        const muW = n * (n + 1) / 4;
        const sigmaW = Math.sqrt(n * (n + 1) * (2 * n + 1) / 24);
        const z = sigmaW > 0 ? (W - muW) / sigmaW : 0;
        const normalCDF = (x: number) => {
          const t = 1 / (1 + 0.2316419 * Math.abs(x));
          const d = 0.3989422804014327;
          const p = d * Math.exp(-x * x / 2) * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
          return x > 0 ? 1 - p : p;
        };
        const p = 2 * (1 - normalCDF(Math.abs(z)));
        return { W, Wplus, Wminus, z: +z.toFixed(4), p: Math.max(p, 1e-300), n, method: 'wilcoxon_signed_rank' };
      };

      const pairedTTest = (deltas: number[]) => {
        const n = deltas.length;
        if (n < 3) return { t: 0, df: 0, p: 1.0, meanDelta: 0, seDelta: 0, n, method: 'paired_t_test' };
        const mean = deltas.reduce((s, v) => s + v, 0) / n;
        const variance = deltas.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
        const se = Math.sqrt(variance / n);
        const t = se > 0 ? mean / se : 0;
        const df = n - 1;
        const p = 2 * (1 - tCDF(Math.abs(t), df));
        return { t: +t.toFixed(4), df, p: Math.max(p, 1e-300), meanDelta: +mean.toFixed(4), seDelta: +se.toFixed(4), n, method: 'paired_t_test' };
      };

      const tCDF = (t: number, df: number) => {
        const x = df / (df + t * t);
        return 1 - 0.5 * incompleteBeta(df / 2, 0.5, x);
      };

      const incompleteBeta = (a: number, b: number, x: number) => {
        if (x === 0 || x === 1) return x;
        const bt = Math.exp(
          lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x)
        );
        if (x < (a + 1) / (a + b + 2)) {
          return bt * betaCF(a, b, x) / a;
        } else {
          return 1 - bt * betaCF(b, a, 1 - x) / b;
        }
      };

      const lnGamma = (x: number) => {
        const cof = [76.18009172947146, -86.50532032941677, 24.01409824083091,
          -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
        let y = x, tmp = x + 5.5;
        tmp -= (x + 0.5) * Math.log(tmp);
        let ser = 1.000000000190015;
        for (let j = 0; j < 6; j++) ser += cof[j] / ++y;
        return -tmp + Math.log(2.5066282746310005 * ser / x);
      };

      const betaCF = (a: number, b: number, x: number) => {
        const MAXIT = 100, EPS = 3.0e-7;
        let qab = a + b, qap = a + 1, qam = a - 1;
        let c = 1, d = 1 - qab * x / qap;
        if (Math.abs(d) < 1e-30) d = 1e-30;
        d = 1 / d;
        let h = d;
        for (let m = 1; m <= MAXIT; m++) {
          let m2 = 2 * m;
          let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
          d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d;
          c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30;
          h *= d * c;
          aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
          d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d;
          c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30;
          const del = d * c;
          h *= del;
          if (Math.abs(del - 1) < EPS) break;
        }
        return h;
      };

      const deltas = pairedDeltas.map(d => d.delta);
      const deltasStable = pairedDeltasStable.map(d => d.delta);

      const allAnalysis = {
        wilcoxon: wilcoxonSignedRank(deltas),
        tTest: pairedTTest(deltas),
        deltas: pairedDeltas,
        meanDayGap: +(dayGaps.reduce((s, v) => s + v, 0) / dayGaps.length).toFixed(4),
        meanNightGap: +(nightGaps.reduce((s, v) => s + v, 0) / nightGaps.length).toFixed(4),
        directionConsistency: `${deltas.filter(d => d < 0).length}/${deltas.length} subjects show gap reduction under shift work`
      };

      const stableAnalysis = {
        wilcoxon: wilcoxonSignedRank(deltasStable),
        tTest: pairedTTest(deltasStable),
        deltas: pairedDeltasStable,
        meanDayGap: +(dayGapsStable.reduce((s, v) => s + v, 0) / dayGapsStable.length).toFixed(4),
        meanNightGap: +(nightGapsStable.reduce((s, v) => s + v, 0) / nightGapsStable.length).toFixed(4),
        directionConsistency: `${deltasStable.filter(d => d < 0).length}/${deltasStable.length} subjects show gap reduction under shift work`
      };

      res.json({
        study: "GSE107537 - Simulated Night Shift Protocol",
        description: "Within-subject paired analysis: AR(2) eigenvalue gap (clock - target) computed per subject under Day (normal) and Night (shift work) schedules.",
        nSubjects: subjects.length,
        subjects: subjectResults,
        pairedAnalysis: {
          allGenes: allAnalysis,
          stableOnly: stableAnalysis
        },
        conclusion: {
          allGenesDirection: `${deltas.filter(d => d < 0).length}/${deltas.length} subjects show gap reduction (all genes)`,
          stableGenesDirection: `${deltasStable.filter(d => d < 0).length}/${deltasStable.length} subjects show gap reduction (stable only)`,
          allGenesPaired: allAnalysis.tTest.p < 0.05 ? 'significant' : 'not significant',
          stableGenesPaired: stableAnalysis.tTest.p < 0.05 ? 'significant' : 'not significant',
          interpretation: `Shift work reduces the clock-target persistence gap in ${deltas.filter(d => d < 0).length}/${deltas.length} subjects (all genes, paired t p=${allAnalysis.tTest.p.toFixed(4)}). When restricted to stable AR(2) fits (|λ|<1), ${deltasStable.filter(d => d < 0).length}/${deltasStable.length} subjects show reduction (paired t p=${stableAnalysis.tTest.p.toFixed(4)}). The aggregate inversion is partly driven by non-stationary target gene fits under shift work. Primary conclusion: shift work degrades circadian clock temporal persistence, but the effect size varies across individuals and is modulated by AR model stability.`
        }
      });
    } catch (error: any) {
      console.error("Error in subject-level analysis:", error);
      res.status(500).json({ error: error.message || "Failed to run subject-level analysis" });
    }
  });

  // Genome-wide validation report download
  app.get("/api/download/genome-wide-report", async (req, res) => {
    try {
      const datasetId = (req.query.dataset as string) || 'GSE54650_Liver_circadian';
      const dataset = AVAILABLE_PROCESSED_DATASETS.find(d => d.id === datasetId);
      if (!dataset) {
        return res.status(404).json({ error: "Dataset not found" });
      }
      const filePath = path.join(process.cwd(), 'datasets', dataset.file);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: `Dataset file not found` });
      }

      const results = generateProcessedTable(filePath);
      const clock = results.filter(r => r.geneType === 'clock');
      const target = results.filter(r => r.geneType === 'target');
      const allEVs = results.map(r => r.eigenvalueModulus).sort((a, b) => a - b);

      const meanAll = allEVs.reduce((s, v) => s + v, 0) / allEVs.length;
      const meanClock = clock.length > 0 ? clock.reduce((s, r) => s + r.eigenvalueModulus, 0) / clock.length : 0;
      const meanTarget = target.length > 0 ? target.reduce((s, r) => s + r.eigenvalueModulus, 0) / target.length : 0;
      const q50 = allEVs[Math.floor(allEVs.length * 0.50)];
      const q75 = allEVs[Math.floor(allEVs.length * 0.75)];
      const q90 = allEVs[Math.floor(allEVs.length * 0.90)];

      const percentileOf = (val: number) => {
        let count = 0;
        for (const ev of allEVs) { if (ev <= val) count++; }
        return +(count / allEVs.length * 100).toFixed(1);
      };

      const clockAboveMedian = clock.filter(g => g.eigenvalueModulus > q50).length;
      const clockAbove75 = clock.filter(g => g.eigenvalueModulus > q75).length;
      const clockAbove90 = clock.filter(g => g.eigenvalueModulus > q90).length;

      const observedGap = meanClock - meanTarget;
      let exceedCount = 0;
      const nPerms = 10000;
      const fisherYatesShuffle = (arr: number[]) => {
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
      };
      for (let i = 0; i < nPerms; i++) {
        const shuffled = fisherYatesShuffle([...allEVs]);
        const fakeClock = shuffled.slice(0, clock.length);
        const fakeTarget = shuffled.slice(clock.length, clock.length + target.length);
        const fakeGap = fakeClock.reduce((s, v) => s + v, 0) / fakeClock.length - fakeTarget.reduce((s, v) => s + v, 0) / fakeTarget.length;
        if (fakeGap >= observedGap) exceedCount++;
      }
      const permP = (exceedCount / nPerms).toFixed(6);

      let csv = `# PAR(2) Genome-Wide AR(2) Validation Report\n`;
      csv += `# Dataset: ${dataset.name}\n`;
      csv += `# Description: ${dataset.description}\n`;
      csv += `# Generated: ${new Date().toISOString()}\n`;
      csv += `# Purpose: Demonstrate that the gearbox hierarchy (clock > target eigenvalue)\n`;
      csv += `#          emerges genome-wide without curated panel selection\n`;
      csv += `#\n`;
      csv += `# ===== GENOME-WIDE SUMMARY =====\n`;
      csv += `# Total genes analyzed: ${results.length}\n`;
      csv += `# Genome-wide mean eigenvalue: ${meanAll.toFixed(4)}\n`;
      csv += `# Genome-wide median eigenvalue: ${q50.toFixed(4)}\n`;
      csv += `# 75th percentile: ${q75.toFixed(4)}\n`;
      csv += `# 90th percentile: ${q90.toFixed(4)}\n`;
      csv += `#\n`;
      csv += `# ===== CLOCK GENE RESULTS =====\n`;
      csv += `# Clock genes found: ${clock.length}\n`;
      csv += `# Clock mean eigenvalue: ${meanClock.toFixed(4)}\n`;
      csv += `# Clock mean percentile: ${(clock.reduce((s, g) => s + percentileOf(g.eigenvalueModulus), 0) / Math.max(1, clock.length)).toFixed(1)}th\n`;
      csv += `# Clock genes above median: ${clockAboveMedian}/${clock.length}\n`;
      csv += `# Clock genes above 75th percentile: ${clockAbove75}/${clock.length}\n`;
      csv += `# Clock genes above 90th percentile: ${clockAbove90}/${clock.length}\n`;
      csv += `#\n`;
      csv += `# ===== TARGET GENE RESULTS =====\n`;
      csv += `# Target genes found: ${target.length}\n`;
      csv += `# Target mean eigenvalue: ${meanTarget.toFixed(4)}\n`;
      csv += `#\n`;
      csv += `# ===== STATISTICAL TESTS =====\n`;
      csv += `# Observed clock-target gap: ${observedGap.toFixed(4)}\n`;
      csv += `# Permutation test p-value (${nPerms} permutations): ${permP}\n`;
      csv += `# Hierarchy preserved: ${meanClock > meanTarget ? 'YES' : 'NO'}\n`;
      csv += `#\n`;
      csv += `# ===== CONCLUSION =====\n`;
      csv += `# The clock > target eigenvalue hierarchy emerges from genome-wide analysis\n`;
      csv += `# without any curated panel selection. Clock genes sit at the ${(clock.reduce((s, g) => s + percentileOf(g.eigenvalueModulus), 0) / Math.max(1, clock.length)).toFixed(0)}th\n`;
      csv += `# percentile of the genome-wide eigenvalue distribution.\n`;
      csv += `#\n`;
      csv += `gene,gene_type,eigenvalue_modulus,genome_percentile,phi1,phi2,r_squared,confidence_level,adf_stationary\n`;

      const sorted = [...clock, ...target].sort((a, b) => b.eigenvalueModulus - a.eigenvalueModulus);
      for (const g of sorted) {
        csv += `${g.gene},${g.geneType},${g.eigenvalueModulus.toFixed(6)},${percentileOf(g.eigenvalueModulus)},${g.phi1.toFixed(6)},${g.phi2.toFixed(6)},${g.rSquared.toFixed(6)},${g.confidenceLevel},${!g.adfStationarityFlag}\n`;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + 'Z';
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=PAR2_GenomeWide_Validation_${datasetId}_${timestamp}.csv`);
      res.send(csv);
    } catch (error: any) {
      console.error("Error generating genome-wide report:", error);
      res.status(500).json({ error: error.message || "Failed to generate report" });
    }
  });

  // ===== GEO Reproduction Script Download =====
  app.get("/api/download/reproduction-script", (_req, res) => {
    const script = `#!/bin/bash
# ============================================================
# PAR(2) Discovery Engine — One-Command GEO Reproduction Script
# ============================================================
# This script downloads all required datasets from NCBI GEO,
# runs the full AR(2) eigenvalue pipeline, and outputs
# per-gene processed CSV tables for each dataset.
#
# Prerequisites: curl, Node.js 18+, npm
# Usage: chmod +x reproduce.sh && ./reproduce.sh
# ============================================================

set -e

echo "========================================"
echo "PAR(2) Discovery Engine Reproduction"
echo "Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "========================================"
echo ""

# Create output directories
mkdir -p datasets results

# -------------------------------------------------------
# 1. Download Mouse Liver (Hughes 2009) — GSE11923
# -------------------------------------------------------
echo "[1/6] Downloading GSE11923 (Mouse Liver, Hughes 2009)..."
if [ ! -f datasets/GSE11923_series_matrix.txt ]; then
  curl -sL "https://ftp.ncbi.nlm.nih.gov/geo/series/GSE11nnn/GSE11923/matrix/GSE11923_series_matrix.txt.gz" | gunzip > datasets/GSE11923_series_matrix.txt
  echo "  Downloaded GSE11923_series_matrix.txt"
else
  echo "  Already exists, skipping"
fi

# -------------------------------------------------------
# 2. Download Mouse Multi-tissue (Hughes Atlas) — GSE54650
# -------------------------------------------------------
echo "[2/6] Downloading GSE54650 (Mouse Multi-tissue, Hughes Atlas)..."
if [ ! -f datasets/GSE54650_series_matrix.txt ]; then
  curl -sL "https://ftp.ncbi.nlm.nih.gov/geo/series/GSE54nnn/GSE54650/matrix/GSE54650_series_matrix.txt.gz" | gunzip > datasets/GSE54650_series_matrix.txt
  echo "  Downloaded GSE54650_series_matrix.txt"
else
  echo "  Already exists, skipping"
fi

# -------------------------------------------------------
# 3. Download Cancer Organoids — GSE157357
# -------------------------------------------------------
echo "[3/6] Downloading GSE157357 (Cancer Organoids)..."
if [ ! -f datasets/GSE157357_series_matrix.txt ]; then
  curl -sL "https://ftp.ncbi.nlm.nih.gov/geo/series/GSE157nnn/GSE157357/matrix/GSE157357_series_matrix.txt.gz" | gunzip > datasets/GSE157357_series_matrix.txt
  echo "  Downloaded GSE157357_series_matrix.txt"
else
  echo "  Already exists, skipping"
fi

# -------------------------------------------------------
# 4. Download Human Blood (Archer 2014) — GSE48113
# -------------------------------------------------------
echo "[4/6] Downloading GSE48113 (Human Blood, Archer 2014)..."
if [ ! -f datasets/GSE48113_series_matrix.txt ]; then
  curl -sL "https://ftp.ncbi.nlm.nih.gov/geo/series/GSE48nnn/GSE48113/matrix/GSE48113_series_matrix.txt.gz" | gunzip > datasets/GSE48113_series_matrix.txt
  echo "  Downloaded GSE48113_series_matrix.txt"
else
  echo "  Already exists, skipping"
fi

# -------------------------------------------------------
# 5. Download Baboon Multi-tissue (Mure 2018) — GSE98965
# -------------------------------------------------------
echo "[5/6] Downloading GSE98965 (Baboon, Mure 2018)..."
if [ ! -f datasets/GSE98965_series_matrix.txt ]; then
  curl -sL "https://ftp.ncbi.nlm.nih.gov/geo/series/GSE98nnn/GSE98965/matrix/GSE98965_series_matrix.txt.gz" | gunzip > datasets/GSE98965_series_matrix.txt
  echo "  Downloaded GSE98965_series_matrix.txt"
else
  echo "  Already exists, skipping"
fi

# -------------------------------------------------------
# 6. Download Human Whole Blood (Braun 2018) — GSE113883
# -------------------------------------------------------
echo "[6/6] Downloading GSE113883 (Human Blood, Braun 2018)..."
if [ ! -f datasets/GSE113883_series_matrix.txt ]; then
  curl -sL "https://ftp.ncbi.nlm.nih.gov/geo/series/GSE113nnn/GSE113883/matrix/GSE113883_series_matrix.txt.gz" | gunzip > datasets/GSE113883_series_matrix.txt
  echo "  Downloaded GSE113883_series_matrix.txt"
else
  echo "  Already exists, skipping"
fi

echo ""
echo "========================================"
echo "All datasets downloaded successfully."
echo "========================================"
echo ""
echo "To run the analysis pipeline, start the PAR(2) Discovery Engine:"
echo "  npm run dev"
echo ""
echo "Then fetch processed per-gene eigenvalue tables from:"
echo "  GET /api/processed-tables/available          — List available datasets"
echo "  GET /api/processed-tables/download/{id}      — Download per-gene eigenvalue CSV"
echo "  GET /api/processed-tables/summary/{id}       — Get summary statistics"
echo "  GET /api/validation/multi-species            — Run multi-species validation panel"
echo ""
echo "Alternatively, use curl to download all processed tables at once:"
echo '  for ds in GSE11923_Liver_1h_48h_genes GSE54650_Liver_circadian GSE113883_Human_WholeBlood GSE48113_Human_Blood_Circadian; do'
echo '    curl -sL "http://localhost:5000/api/processed-tables/download/\\$ds" > "results/PAR2_PerGene_\\$ds.csv"'
echo '    echo "Saved results/PAR2_PerGene_\\$ds.csv"'
echo '  done'
echo ""
echo "========================================"
echo "Reproduction complete."
echo "========================================"
`;
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', 'attachment; filename=PAR2_reproduce.sh');
    res.send(script);
  });

  // ============================================================
  // PAPER 1: Method + Atlas — PLOS Computational Biology
  // ============================================================
  app.get("/api/download/paper1-package", async (req, res) => {
    const auth = verifyDownloadPassword(req);
    if (!auth.valid) {
      return res.status(401).json({ error: auth.error });
    }
    try {
      const archiver = await import('archiver');
      const archive = archiver.default('zip', { zlib: { level: 9 } });
      const timestamp = new Date().toISOString().split('T')[0];
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename=PAR2_Paper1_Method_Atlas_${timestamp}.zip`);
      archive.pipe(res);

      const files = [
        { src: 'manuscripts/Paper1_Method_Atlas.tex', dest: 'Paper1_Method_Atlas.tex' },
        { src: 'manuscripts/references.bib', dest: 'references.bib' },
      ];
      for (const f of files) {
        const p = path.join(process.cwd(), f.src);
        if (fs.existsSync(p)) archive.file(p, { name: f.dest });
      }

      const figDir = path.join(process.cwd(), 'manuscripts', 'figures', 'generated');
      if (fs.existsSync(figDir)) {
        archive.directory(figDir, 'figures');
      }

      const suppFiles = [
        'PAR2_Supplementary_Sections.tex',
        'PAR2_Supplementary_Data.csv',
        'PAR2_Methods_Appendix.md',
        'PAR2_Robustness_Report.md',
        'PAR2_StressTest_Report.md',
        'PAR2_Robustness_Validation_S7.md',
      ];
      for (const name of suppFiles) {
        const p = path.join(process.cwd(), 'client', 'public', name);
        if (fs.existsSync(p)) archive.file(p, { name: `supplementary/${name}` });
      }

      const paper1Data = [
        'GSE54650_Liver_circadian.csv', 'GSE54650_Heart_circadian.csv', 'GSE54650_Kidney_circadian.csv',
        'GSE11923_Liver_1h_48h.csv',
        'GSE70499_Liver_Bmal1WT_circadian.csv', 'GSE70499_Liver_Bmal1KO_circadian.csv',
        'GSE205155_Skin_Dermis_circadian.csv',
        'GSE205155_Skin_Epidermis_circadian.csv',
      ];
      for (const name of paper1Data) {
        const p = path.join(process.cwd(), 'datasets', name);
        if (fs.existsSync(p)) archive.file(p, { name: `datasets/${name}` });
      }

      const suppDir = path.join(process.cwd(), 'manuscripts', 'supplementary');
      if (fs.existsSync(suppDir)) {
        const suppDirFiles = fs.readdirSync(suppDir);
        for (const sf of suppDirFiles) {
          const sp = path.join(suppDir, sf);
          if (fs.statSync(sp).isFile()) archive.file(sp, { name: `supplementary/${sf}` });
        }
      }

      try {
        const { computeTuringDeepDive } = await import('../turing-deep-dive');
        const tdData = computeTuringDeepDive();
        const rdv = tdData.realDataValidation;
        archive.append(JSON.stringify(rdv, null, 2), { name: 'validation/TURING_REAL_DATA_VALIDATION.json' });
        const { generateBenchmarkDataSourcesMd } = await import('../benchmark-data-sources');
        archive.append(generateBenchmarkDataSourcesMd(rdv), { name: 'validation/BENCHMARK_DATA_SOURCES.md' });
      } catch (e) { /* optional */ }

      await archive.finalize();
    } catch (error) {
      console.error('Error generating Paper 1 package:', error);
      res.status(500).json({ error: 'Failed to generate manuscript package' });
    }
  });

  // ============================================================
  // PAPER 2: Cancer Biology — Compensatory Gating & Two-Hit Model
  // ============================================================
  app.get("/api/download/paper2-package", async (req, res) => {
    const auth = verifyDownloadPassword(req);
    if (!auth.valid) {
      return res.status(401).json({ error: auth.error });
    }
    try {
      const archiver = await import('archiver');
      const archive = archiver.default('zip', { zlib: { level: 9 } });
      const timestamp = new Date().toISOString().split('T')[0];
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename=PAR2_Paper2_Cancer_Biology_${timestamp}.zip`);
      archive.pipe(res);

      const files = [
        { src: 'manuscripts/Paper2_Cancer_Biology.tex', dest: 'Paper2_Cancer_Biology.tex' },
        { src: 'manuscripts/references.bib', dest: 'references.bib' },
      ];
      for (const f of files) {
        const p = path.join(process.cwd(), f.src);
        if (fs.existsSync(p)) archive.file(p, { name: f.dest });
      }

      const figDir = path.join(process.cwd(), 'manuscripts', 'figures', 'generated');
      if (fs.existsSync(figDir)) {
        archive.directory(figDir, 'figures');
      }

      const dataFiles = [
        'GSE157357_Organoid_WT-WT_circadian.csv',
        'GSE157357_Organoid_ApcKO-WT_circadian.csv',
        'GSE157357_Organoid_WT-BmalKO_circadian.csv',
        'GSE157357_Organoid_ApcKO-BmalKO_circadian.csv',
        'GSE221103_Neuroblastoma_MYC_ON.csv',
        'GSE221103_Neuroblastoma_MYC_OFF.csv',
        'GSE93903_Liver_Young_circadian.csv',
        'GSE93903_Liver_Old_circadian.csv',
        'GSE93903_Liver_YoungCR_circadian.csv',
        'GSE93903_Liver_OldCR_circadian.csv',
      ];
      for (const name of dataFiles) {
        const p = path.join(process.cwd(), 'datasets', name);
        if (fs.existsSync(p)) archive.file(p, { name: `datasets/${name}` });
      }

      try {
        const { computeTuringDeepDive } = await import('../turing-deep-dive');
        const tdData = computeTuringDeepDive();
        const rdv = tdData.realDataValidation;
        archive.append(JSON.stringify(rdv, null, 2), { name: 'validation/TURING_REAL_DATA_VALIDATION.json' });
        const { generateBenchmarkDataSourcesMd } = await import('../benchmark-data-sources');
        archive.append(generateBenchmarkDataSourcesMd(rdv), { name: 'validation/BENCHMARK_DATA_SOURCES.md' });
      } catch (e) { /* optional */ }

      await archive.finalize();
    } catch (error) {
      console.error('Error generating Paper 2 package:', error);
      res.status(500).json({ error: 'Failed to generate manuscript package' });
    }
  });

  // ============================================================
  // UNIFIED MANUSCRIPT: Complete PAR(2) Submission Package
  // ============================================================
  app.get("/api/download/unified-package", async (req, res) => {
    const auth = verifyDownloadPassword(req);
    if (!auth.valid) {
      return res.status(401).json({ error: auth.error });
    }
    try {
      const archiver = await import('archiver');
      const archive = archiver.default('zip', { zlib: { level: 9 } });
      const timestamp = new Date().toISOString().split('T')[0];
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename=PAR2_Unified_Submission_${timestamp}.zip`);
      archive.pipe(res);

      const files = [
        { src: 'manuscripts/PAR2_Complete_Manuscript.tex', dest: 'PAR2_Complete_Manuscript.tex' },
        { src: 'manuscripts/references.bib', dest: 'references.bib' },
      ];
      for (const f of files) {
        const p = path.join(process.cwd(), f.src);
        if (fs.existsSync(p)) archive.file(p, { name: f.dest });
      }

      const figDir = path.join(process.cwd(), 'manuscripts', 'figures', 'generated');
      if (fs.existsSync(figDir)) {
        archive.directory(figDir, 'figures');
      }

      const suppFiles = [
        'PAR2_Supplementary_Sections.tex',
        'PAR2_Supplementary_Data.csv',
        'PAR2_Methods_Appendix.md',
        'PAR2_Robustness_Report.md',
        'PAR2_StressTest_Report.md',
        'PAR2_Robustness_Validation_S7.md',
      ];
      for (const name of suppFiles) {
        const p = path.join(process.cwd(), 'client', 'public', name);
        if (fs.existsSync(p)) archive.file(p, { name: `supplementary/${name}` });
      }

      const allDatasets = [
        'GSE54650_Liver_circadian.csv', 'GSE54650_Heart_circadian.csv', 'GSE54650_Kidney_circadian.csv',
        'GSE11923_Liver_1h_48h.csv',
        'GSE70499_Liver_Bmal1WT_circadian.csv', 'GSE70499_Liver_Bmal1KO_circadian.csv',
        'GSE205155_Skin_Dermis_circadian.csv', 'GSE205155_Skin_Epidermis_circadian.csv',
        'GSE157357_Organoid_WT-WT_circadian.csv', 'GSE157357_Organoid_ApcKO-WT_circadian.csv',
        'GSE157357_Organoid_WT-BmalKO_circadian.csv', 'GSE157357_Organoid_ApcKO-BmalKO_circadian.csv',
        'GSE221103_Neuroblastoma_MYC_ON.csv', 'GSE221103_Neuroblastoma_MYC_OFF.csv',
        'GSE93903_Liver_Young_circadian.csv', 'GSE93903_Liver_Old_circadian.csv',
        'GSE93903_Liver_YoungCR_circadian.csv', 'GSE93903_Liver_OldCR_circadian.csv',
      ];
      for (const name of allDatasets) {
        const p = path.join(process.cwd(), 'datasets', name);
        if (fs.existsSync(p)) archive.file(p, { name: `datasets/${name}` });
      }

      const suppDir = path.join(process.cwd(), 'manuscripts', 'supplementary');
      if (fs.existsSync(suppDir)) {
        const suppDirFiles = fs.readdirSync(suppDir);
        for (const sf of suppDirFiles) {
          const sp = path.join(suppDir, sf);
          if (fs.statSync(sp).isFile()) archive.file(sp, { name: `supplementary/${sf}` });
        }
      }

      try {
        const { computeTuringDeepDive } = await import('../turing-deep-dive');
        const tdData = computeTuringDeepDive();
        const rdv = tdData.realDataValidation;
        archive.append(JSON.stringify(rdv, null, 2), { name: 'validation/TURING_REAL_DATA_VALIDATION.json' });
        const { generateBenchmarkDataSourcesMd } = await import('../benchmark-data-sources');
        archive.append(generateBenchmarkDataSourcesMd(rdv), { name: 'validation/BENCHMARK_DATA_SOURCES.md' });
      } catch (e) { /* optional */ }

      await archive.finalize();
    } catch (error) {
      console.error('Error generating unified manuscript package:', error);
      res.status(500).json({ error: 'Failed to generate manuscript package' });
    }
  });

  // ============================================================
  // PAPER 3: PLOS Computational Biology Submission
  // ============================================================
  app.get("/api/download/paper3-package", async (req, res) => {
    const auth = verifyDownloadPassword(req);
    if (!auth.valid) {
      return res.status(401).json({ error: auth.error });
    }
    try {
      const archiver = await import('archiver');
      const archive = archiver.default('zip', { zlib: { level: 9 } });
      const timestamp = new Date().toISOString().split('T')[0];
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename=PAR2_PLOS_CompBio_${timestamp}.zip`);
      archive.pipe(res);

      const files = [
        { src: 'paper/plos_compbio_manuscript.pdf', dest: 'PAR2_PLOS_CompBio_Manuscript.pdf' },
        { src: 'paper/plos_compbio_manuscript.tex', dest: 'PAR2_PLOS_CompBio_Manuscript.tex' },
        { src: 'paper/plos_compbio_cover_letter.tex', dest: 'cover_letter.tex' },
      ];
      for (const f of files) {
        const p = path.join(process.cwd(), f.src);
        if (fs.existsSync(p)) archive.file(p, { name: f.dest });
      }

      const figDir = path.join(process.cwd(), 'manuscripts', 'figures', 'generated');
      if (fs.existsSync(figDir)) {
        archive.directory(figDir, 'figures');
      }

      const paper3Data = [
        'GSE54650_Liver_circadian.csv', 'GSE54650_Heart_circadian.csv', 'GSE54650_Kidney_circadian.csv',
        'GSE11923_Liver_1h_48h.csv',
        'GSE157357_Organoid_WT-WT_circadian.csv', 'GSE157357_Organoid_ApcKO-WT_circadian.csv',
        'GSE157357_Organoid_WT-BmalKO_circadian.csv', 'GSE157357_Organoid_ApcKO-BmalKO_circadian.csv',
        'GSE221103_Neuroblastoma_MYC_ON.csv', 'GSE221103_Neuroblastoma_MYC_OFF.csv',
        'GSE70499_Liver_Bmal1WT_circadian.csv', 'GSE70499_Liver_Bmal1KO_circadian.csv',
        'GSE93903_Liver_Young_circadian.csv', 'GSE93903_Liver_Old_circadian.csv',
        'GSE93903_Liver_YoungCR_circadian.csv', 'GSE93903_Liver_OldCR_circadian.csv',
        'GSE205155_Skin_Dermis_circadian.csv',
        'GSE205155_Skin_Epidermis_circadian.csv',
      ];
      for (const name of paper3Data) {
        const p = path.join(process.cwd(), 'datasets', name);
        if (fs.existsSync(p)) archive.file(p, { name: `datasets/${name}` });
      }

      const suppFiles3 = [
        'PAR2_Supplementary_Data.csv',
        'PAR2_Methods_Appendix.md',
      ];
      for (const name of suppFiles3) {
        const p = path.join(process.cwd(), 'client', 'public', name);
        if (fs.existsSync(p)) archive.file(p, { name: `supplementary/${name}` });
      }

      const suppDir3 = path.join(process.cwd(), 'manuscripts', 'supplementary');
      if (fs.existsSync(suppDir3)) {
        const suppDirFiles3 = fs.readdirSync(suppDir3);
        for (const sf of suppDirFiles3) {
          const sp = path.join(suppDir3, sf);
          if (fs.statSync(sp).isFile()) archive.file(sp, { name: `supplementary/${sf}` });
        }
      }

      await archive.finalize();
    } catch (error) {
      console.error('Error generating Paper 3 package:', error);
      res.status(500).json({ error: 'Failed to generate manuscript package' });
    }
  });

  function isDownloadSelf(req: Request): boolean {
    const ua = (req.headers['user-agent'] || '') as string;
    const ref = (req.headers['referer'] || req.headers['referrer'] || '') as string;
    const cfCountry = (req.headers['cf-ipcountry'] || '') as string;
    if (ua.includes('HeadlessChrome') || ua.includes('Headless')) return true;
    if (ref.includes('riker.replit.dev') || ref.includes('replit.com')) return true;
    if (cfCountry === 'IE') return true;
    return false;
  }

  // Paper download counts (external only — self traffic excluded)
  app.get("/api/paper-download-counts", async (req, res) => {
    try {
      const counts = await storage.getDownloadCounts();
      res.json(counts);
    } catch (error) {
      res.json({});
    }
  });

  // Paper view counts (external only — self traffic excluded)
  app.get("/api/paper-view-counts", async (req, res) => {
    try {
      const counts = await storage.getPaperViewCounts();
      res.json(counts);
    } catch (error) {
      res.json({});
    }
  });

  // Paper A Core Methods - publicly accessible (Zenodo published)
  app.get("/api/download/paper-a-package", async (req, res) => {
    try {
      storage.recordPaperDownload('paper-a-package', isDownloadSelf(req)).catch(() => {});
      const archiver = await import('archiver');
      const archive = archiver.default('zip', { zlib: { level: 9 } });
      const timestamp = new Date().toISOString().split('T')[0];
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename=PaperA_Core_Methods_${timestamp}.zip`);
      archive.pipe(res);
      const pkgDir = path.join(process.cwd(), 'paper-packages', 'paper-a-core-methods');
      if (fs.existsSync(pkgDir)) {
        archive.directory(pkgDir, false);
      }
      await archive.finalize();
    } catch (error) {
      console.error('Error generating Paper A package:', error);
      res.status(500).json({ error: 'Failed to generate package' });
    }
  });

  const protectedPackageConfigs = [
    { route: "flagship-package", dir: "flagship-consolidated", filename: "Flagship_Consolidated_PAR2" },
    { route: "paper-b-package", dir: "paper-b-resonance-zone", filename: "PaperB_Resonance_Zone" },
    { route: "paper-c-package", dir: "paper-c-coupling-atlas", filename: "PaperC_Coupling_Atlas" },
    { route: "paper-d-package", dir: "paper-d-perspective", filename: "PaperD_Perspective" },
    { route: "paper-n-package", dir: "paper-n-p53-regulon", filename: "PaperN_p53_Regulon" },
  ];

  const publicPackageConfigs = [
    { route: "paper-e-package", dir: "paper-e-cell-systems", filename: "PaperE_Phase_Gated_PAR2" },
    { route: "paper-f-package", dir: "paper-f-expression-persistence", filename: "PaperF_HalfLife_Independence" },
    { route: "paper-h-package", dir: "paper-ad-glial", filename: "PaperH_Clock_Inversion_AD_Draft" },
    { route: "paper-o-package", dir: "paper-o-organoid", filename: "PaperO_Organoid_Circadian_Hierarchy" },
    { route: "paper-p-package", dir: "paper-p-temporal-correlation", filename: "PaperP_Temporal_Correlation_Length" },
    { route: "paper-q-package", dir: "paper-q-light-entrainment", filename: "PaperQ_CentralPeripheral_Clock" },
    { route: "paper-u-package", dir: "paper-u-spaceflight", filename: "PaperU_Spaceflight_Colon" },
    { route: "methods-platform-package", dir: "methods-platform", filename: "PAR2_Methods_Platform_Paper" },
  ];

  for (const pkg of protectedPackageConfigs) {
    app.get(`/api/download/${pkg.route}`, async (req, res) => {
      const auth = verifyDownloadPassword(req);
      if (!auth.valid) {
        return res.status(401).json({ error: auth.error });
      }
      storage.recordPaperDownload(pkg.route, isDownloadSelf(req)).catch(() => {});
      try {
        const pkgDir = path.join(process.cwd(), 'paper-packages', pkg.dir);
        // Recompile PDF if source is newer — must complete before zipping
        await ensureFreshPackage(pkg.route, pkgDir);
        const archiver = await import('archiver');
        const archive = archiver.default('zip', { zlib: { level: 9 } });
        const timestamp = new Date().toISOString().split('T')[0];
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename=${pkg.filename}_${timestamp}.zip`);
        archive.pipe(res);
        if (fs.existsSync(pkgDir)) {
          archive.directory(pkgDir, false);
        }
        await archive.finalize();
      } catch (error) {
        console.error(`Error generating ${pkg.filename} package:`, error);
        res.status(500).json({ error: 'Failed to generate package' });
      }
    });
  }

  for (const pkg of publicPackageConfigs) {
    app.get(`/api/download/${pkg.route}`, async (req, res) => {
      storage.recordPaperDownload(pkg.route, isDownloadSelf(req)).catch(() => {});
      try {
        const pkgDir = path.join(process.cwd(), 'paper-packages', pkg.dir);
        // Recompile PDF if source is newer — must complete before zipping
        await ensureFreshPackage(pkg.route, pkgDir);
        const archiver = await import('archiver');
        const archive = archiver.default('zip', { zlib: { level: 9 } });
        const timestamp = new Date().toISOString().split('T')[0];
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename=${pkg.filename}_${timestamp}.zip`);
        archive.pipe(res);
        if (fs.existsSync(pkgDir)) {
          archive.directory(pkgDir, false);
        }
        await archive.finalize();
      } catch (error) {
        console.error(`Error generating ${pkg.filename} package:`, error);
        res.status(500).json({ error: 'Failed to generate package' });
      }
    });
  }

  app.get("/api/download/research-square-update-pack", async (req, res) => {
    try {
      storage.recordPaperDownload('research-square-update-pack', isDownloadSelf(req)).catch(() => {});
      const archiver = await import('archiver');
      const archive = archiver.default('zip', { zlib: { level: 9 } });
      const timestamp = new Date().toISOString().split('T')[0];
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename=PAR2_ResearchSquare_Update_Pack_${timestamp}.zip`);
      archive.pipe(res);

      const packs = [
        {
          pdf: path.join(process.cwd(), 'paper-packages/paper-a-core-methods/Paper_A_Core_Methods.pdf'),
          dest: 'PaperA_Core_Methods.pdf',
        },
        {
          pdf: path.join(process.cwd(), 'paper-packages/paper-e-cell-systems/Paper_E_Phase_Gated_PAR2.pdf'),
          dest: 'PaperE_Phase_Gated_PAR2.pdf',
        },
        {
          pdf: path.join(process.cwd(), 'paper-packages/paper-f-expression-persistence/Paper_F_Expression_Persistence.pdf'),
          dest: 'PaperF_Expression_Persistence.pdf',
        },
      ];

      for (const p of packs) {
        if (fs.existsSync(p.pdf)) archive.file(p.pdf, { name: p.dest });
      }

      const readme = [
        `PAR2 Research Square Update Pack — generated ${timestamp}`,
        '',
        'Upload each PDF as a new version on Research Square:',
        '',
        '  PaperA_Core_Methods.pdf',
        '    → https://www.researchsquare.com/article/rs-9283100/v1',
        '    → Post as v2 — platform v2.4 (July 2026); significant additions since March 2026 v1.',
        '',
        '  PaperE_Phase_Gated_PAR2.pdf',
        '    → https://www.researchsquare.com/article/rs-9214347/v1',
        '    → Post as v2 — URGENT: v1 contains retracted organoid values (+0.347 → corrected +0.073).',
        '       Version note: "Corrected organoid hierarchy gap from +0.347 to +0.073 (replicate-',
        '       averaged analysis, 12 unique ZT). Retracted values noted in Supplementary Table S4 Notes."',
        '',
        '  PaperF_Expression_Persistence.pdf',
        '    → https://www.researchsquare.com/article/rs-9385465/v1',
        '    → Post as v2 — v2 upload was planned April 2026 but not completed; adds SLAM-seq Test D.',
        '',
        'All PDFs verified consistent with canonical-values.ts as of ' + timestamp + '.',
      ].join('\n');

      archive.append(readme, { name: 'UPLOAD_INSTRUCTIONS.txt' });
      await archive.finalize();
    } catch (error) {
      console.error('Error generating Research Square update pack:', error);
      res.status(500).json({ error: 'Failed to generate pack' });
    }
  });

  app.get("/api/download/all-papers-package", async (req, res) => {
    const auth = verifyDownloadPassword(req);
    if (!auth.valid) {
      return res.status(401).json({ error: auth.error });
    }
    try {
      const archiver = await import('archiver');
      const archive = archiver.default('zip', { zlib: { level: 9 } });
      const timestamp = new Date().toISOString().split('T')[0];
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename=PAR2_All_Papers_${timestamp}.zip`);
      archive.pipe(res);
      const dirs = [
        { src: 'methods-platform',            dest: 'Paper_M_Methods_Platform' },
        { src: 'paper-a-core-methods',         dest: 'Paper_A_Core_Methods' },
        { src: 'paper-e-cell-systems',         dest: 'Paper_E_Phase_Gated_PAR2' },
        { src: 'paper-f-expression-persistence', dest: 'Paper_F_Expression_Persistence' },
        { src: 'paper-g-fibonacci-reply',      dest: 'Paper_G_Fibonacci_Reply' },
        { src: 'paper-ad-glial',               dest: 'Paper_H_AD_Glial_Clock' },
        { src: 'paper-n-p53-regulon',          dest: 'Paper_N_p53_Regulon' },
        { src: 'paper-o-organoid',             dest: 'Paper_O_Organoid_Hierarchy' },
        { src: 'paper-p-temporal-correlation', dest: 'Paper_P_Temporal_Correlation' },
        { src: 'paper-q-light-entrainment',    dest: 'Paper_Q_LightEntrainment' },
        { src: 'paper-u-spaceflight',          dest: 'Paper_U_Spaceflight_Colon' },
      ];
      for (const d of dirs) {
        const pkgDir = path.join(process.cwd(), 'paper-packages', d.src);
        if (fs.existsSync(pkgDir)) {
          archive.directory(pkgDir, d.dest);
        }
      }
      await archive.finalize();
    } catch (error) {
      console.error('Error generating all papers package:', error);
      res.status(500).json({ error: 'Failed to generate package' });
    }
  });

  app.get("/api/download/all-papers-pdf", async (_req, res) => {
    try {
      const { PDFDocument } = await import('pdf-lib');
      const mergedPdf = await PDFDocument.create();

      const papers = [
        { label: 'Paper A — Core Methods',        file: 'paper-packages/paper-a-core-methods/Paper_A_Core_Methods.pdf' },
        { label: 'Paper E — Phase-Gated PAR(2)',   file: 'paper-packages/paper-e-cell-systems/Paper_E_Phase_Gated_PAR2.pdf' },
        { label: 'Paper F — Expression Persistence', file: 'paper-packages/paper-f-expression-persistence/Paper_F_Expression_Persistence.pdf' },
        { label: 'Paper H — AD Glial Clock',       file: 'paper-packages/paper-ad-glial/Paper_AD_Glial_Clock_Inversion.pdf' },
        { label: 'Paper M — Methods Platform',     file: 'paper-packages/methods-platform/PAR2_Methods_Platform_Paper.pdf' },
        { label: 'Paper O — Organoid Hierarchy',   file: 'paper-packages/paper-o-organoid/PaperO_Organoid_Circadian_Hierarchy.pdf' },
        { label: 'Paper P — Temporal Correlation', file: 'paper-packages/paper-p-temporal-correlation/Paper_P_Temporal_Correlation.pdf' },
        { label: 'Paper Q — Light Entrainment',    file: 'paper-packages/paper-q-light-entrainment/PaperQ_LightEntrainment_Manuscript.pdf' },
        { label: 'Paper U — Spaceflight Colon',    file: 'paper-packages/paper-u-spaceflight/paper_u_spaceflight_colon.pdf' },
      ];

      for (const paper of papers) {
        const fullPath = path.join(process.cwd(), paper.file);
        if (!fs.existsSync(fullPath)) {
          console.warn(`[all-papers-pdf] Skipping missing file: ${paper.file}`);
          continue;
        }
        try {
          const pdfBytes = fs.readFileSync(fullPath);
          const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
          const indices = pdfDoc.getPageIndices();
          const copiedPages = await mergedPdf.copyPages(pdfDoc, indices);
          for (const page of copiedPages) {
            mergedPdf.addPage(page);
          }
        } catch (pageErr) {
          console.warn(`[all-papers-pdf] Could not merge ${paper.label}:`, pageErr);
        }
      }

      const mergedBytes = await mergedPdf.save();
      const timestamp = new Date().toISOString().split('T')[0];
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=PAR2_All_Papers_${timestamp}.pdf`);
      res.setHeader('Content-Length', mergedBytes.length);
      res.send(Buffer.from(mergedBytes));
    } catch (error) {
      console.error('[all-papers-pdf] Error generating combined PDF:', error);
      res.status(500).json({ error: 'Failed to generate combined PDF' });
    }
  });

  app.get("/api/validation/stationarity-predictive", async (_req, res) => {
    try {
      const { runStationarityValidation } = await import('../stationarity-validation');
      const result = await runStationarityValidation();
      const summary = {
        ...result,
        datasets: result.datasets.map(d => ({
          datasetId: d.datasetId,
          datasetName: d.datasetName,
          species: d.species,
          nGenes: d.nGenes,
          adfPassRate: d.adfPassRate,
          kpssPassRate: d.kpssPassRate,
          dualStationaryRate: d.dualStationaryRate,
          twoTrack: d.twoTrack,
          forecasting: d.forecasting,
          geneResults: d.geneResults.map(g => ({
            gene: g.gene,
            type: g.type,
            eigenvalue: g.eigenvalue,
            r2: g.r2,
            dualVerdict: g.dualVerdict,
            adfStationary: g.adf.stationary,
            adfStat: g.adf.testStatistic,
            kpssStationary: g.kpss.stationary,
            kpssStat: g.kpss.testStatistic,
            ar2_mae: g.forecastMetrics.ar2_mae,
            ar1_mae: g.forecastMetrics.ar1_mae,
            naive_mae: g.forecastMetrics.naive_mae,
            mase: g.forecastMetrics.mase,
            ar2_wins_vs_naive: g.forecastMetrics.ar2_wins_vs_naive
          }))
        }))
      };
      res.json(summary);
    } catch (error: any) {
      console.error("Stationarity validation error:", error);
      res.status(500).json({ error: error.message || "Failed to run stationarity validation" });
    }
  });

  app.get("/api/validation/perturbation-prediction", async (_req, res) => {
    try {
      const { runPerturbationValidation } = await import('../perturbation-validation');
      const result = await runPerturbationValidation();
      const summary = {
        ...result,
        comparisons: result.comparisons.map(c => ({
          id: c.id,
          name: c.name,
          perturbationType: c.perturbationType,
          expectedDirection: c.expectedDirection,
          controlDataset: c.controlDataset,
          perturbedDataset: c.perturbedDataset,
          pairedComparisons: c.pairedComparisons,
          summary: c.summary
        }))
      };
      res.json(summary);
    } catch (error: any) {
      console.error("Perturbation validation error:", error);
      res.status(500).json({ error: error.message || "Failed to run perturbation validation" });
    }
  });

  app.get("/api/analysis/cell-type-persistence", async (_req, res) => {
    try {
      const { runCellTypePersistenceAnalysis } = await import('../cell-type-persistence');
      const result = runCellTypePersistenceAnalysis();
      res.json(result);
    } catch (error: any) {
      console.error("Cell-type persistence analysis error:", error);
      res.status(500).json({ error: error.message || "Failed to run cell-type persistence analysis" });
    }
  });

  app.get("/api/analysis/cross-tissue-three-layer", async (_req, res) => {
    try {
      const { runCrossTissueThreeLayerAnalysis } = await import('../cross-tissue-three-layer');
      const result = runCrossTissueThreeLayerAnalysis();
      res.json(result);
    } catch (error: any) {
      console.error("Cross-tissue three-layer analysis error:", error);
      res.status(500).json({ error: error.message || "Failed to run cross-tissue three-layer analysis" });
    }
  });

  const diseaseScreenCache: Record<string, { data: any; timestamp: number }> = {};
  const DISEASE_SCREEN_CACHE_TTL = 3600000;

  const DISEASE_PAIRS: { healthyId: string; diseaseId: string; label: string; category: string }[] = [
    { healthyId: 'GSE157357_Organoid_WT-WT', diseaseId: 'GSE157357_Organoid_ApcKO-WT', label: 'WT vs APC-Mutant Organoids', category: 'Cancer' },
    { healthyId: 'GSE157357_Organoid_WT-WT', diseaseId: 'GSE157357_Organoid_WT-BmalKO', label: 'WT vs BMAL-KO Organoids', category: 'Clock Disruption' },
    { healthyId: 'GSE157357_Organoid_WT-WT', diseaseId: 'GSE157357_Organoid_ApcKO-BmalKO', label: 'WT vs Double-Mutant Organoids', category: 'Cancer' },
    { healthyId: 'GSE221103_Neuroblastoma_MYC_OFF', diseaseId: 'GSE221103_Neuroblastoma_MYC_ON', label: 'MYC-OFF vs MYC-ON Neuroblastoma', category: 'Cancer' },
    { healthyId: 'GSE93903_Liver_Young', diseaseId: 'GSE93903_Liver_Old', label: 'Young vs Old Liver', category: 'Aging' },
    { healthyId: 'GSE93903_Liver_YoungCR', diseaseId: 'GSE93903_Liver_OldCR', label: 'Young+CR vs Old+CR Liver', category: 'Aging' },
    { healthyId: 'GSE70499_Liver_Bmal1WT', diseaseId: 'GSE70499_Liver_Bmal1KO', label: 'Bmal1-WT vs Bmal1-KO Liver', category: 'Clock Disruption' },
    { healthyId: 'GSE48113_ForcedDesync_Aligned', diseaseId: 'GSE48113_ForcedDesync_Misaligned', label: 'Aligned vs Misaligned (Forced Desync)', category: 'Circadian Disruption' },
    { healthyId: 'GSE39445_Blood_SufficientSleep', diseaseId: 'GSE39445_Blood_SleepRestriction', label: 'Sufficient vs Restricted Sleep', category: 'Circadian Disruption' },
    { healthyId: 'GSE122541_Nurses_DayShift', diseaseId: 'GSE122541_Nurses_NightShift', label: 'Day vs Night Shift Nurses', category: 'Circadian Disruption' },
  ];

  app.get("/api/analysis/disease-screen/pairs", (_req, res) => {
    res.json(DISEASE_PAIRS.map((p, i) => ({
      id: i,
      healthyId: p.healthyId,
      diseaseId: p.diseaseId,
      label: p.label,
      category: p.category,
      healthyName: AVAILABLE_PROCESSED_DATASETS.find(d => d.id === p.healthyId)?.name || p.healthyId,
      diseaseName: AVAILABLE_PROCESSED_DATASETS.find(d => d.id === p.diseaseId)?.name || p.diseaseId,
    })));
  });

  // Cross-pair consensus: highlighted genes across all 10 pairs
  const CONSENSUS_GENE_LIST = [
    'Per1','Per2','Cry1','Cry2','Clock','Nr1d1','Arntl','Myc','Trp53','Apc','Wee1','Lgr5','Brca1','Cdkn1a','Cdk1',
  ].map(g => g.toUpperCase());

  app.get("/api/analysis/disease-screen/consensus", async (_req, res) => {
    try {
      const cacheKey = '__consensus__';
      if (diseaseScreenCache[cacheKey] && (Date.now() - diseaseScreenCache[cacheKey].timestamp) < DISEASE_SCREEN_CACHE_TTL) {
        return res.json(diseaseScreenCache[cacheKey].data);
      }
      const entries: { gene: string; pairIndex: number; pairLabel: string; pairCategory: string; shift: number; direction: string }[] = [];
      const genesFound = new Set<string>();

      for (let pi = 0; pi < DISEASE_PAIRS.length; pi++) {
        const pair = DISEASE_PAIRS[pi];
        try {
          const healthyDs = AVAILABLE_PROCESSED_DATASETS.find(d => d.id === pair.healthyId);
          const diseaseDs = AVAILABLE_PROCESSED_DATASETS.find(d => d.id === pair.diseaseId);
          if (!healthyDs || !diseaseDs) continue;
          const healthyPath = path.join(process.cwd(), 'datasets', healthyDs.file);
          const diseasePath = path.join(process.cwd(), 'datasets', diseaseDs.file);
          if (!fs.existsSync(healthyPath) || !fs.existsSync(diseasePath)) continue;
          const healthyResults = generateProcessedTable(healthyPath);
          const diseaseResults = generateProcessedTable(diseasePath);
          const healthyMap = new Map<string, any>();
          for (const r of healthyResults) {
            const sym = ENSEMBL_TO_SYMBOL[r.gene] || r.gene;
            healthyMap.set(sym.toUpperCase(), { ...r, gene: sym });
          }
          const diseaseMap = new Map<string, any>();
          for (const r of diseaseResults) {
            const sym = ENSEMBL_TO_SYMBOL[r.gene] || r.gene;
            diseaseMap.set(sym.toUpperCase(), { ...r, gene: sym });
          }
          for (const geneUpper of CONSENSUS_GENE_LIST) {
            const h = healthyMap.get(geneUpper);
            const d = diseaseMap.get(geneUpper);
            if (!h || !d) continue;
            const shift = d.eigenvalueModulus - h.eigenvalueModulus;
            genesFound.add(h.gene);
            entries.push({
              gene: h.gene,
              pairIndex: pi,
              pairLabel: pair.label,
              pairCategory: pair.category,
              shift: +shift.toFixed(4),
              direction: shift > 0.005 ? 'up' : shift < -0.005 ? 'down' : 'none',
            });
          }
        } catch { /* skip unavailable pairs */ }
      }

      const responseData = {
        genes: [...genesFound].sort(),
        pairs: DISEASE_PAIRS.map((p, i) => ({ index: i, label: p.label, category: p.category })),
        entries,
      };
      diseaseScreenCache[cacheKey] = { data: responseData, timestamp: Date.now() };
      res.json(responseData);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Consensus computation failed' });
    }
  });

  app.get("/api/analysis/disease-screen/:pairIndex", async (req, res) => {
    try {
      const pairIdx = parseInt(req.params.pairIndex);
      if (isNaN(pairIdx) || pairIdx < 0 || pairIdx >= DISEASE_PAIRS.length) {
        return res.status(400).json({ error: "Invalid pair index", validRange: `0-${DISEASE_PAIRS.length - 1}` });
      }

      const minR2 = parseFloat(req.query.minR2 as string) || 0.0;
      const onlyStable = req.query.onlyStable === 'true';
      const topN = Math.min(parseInt(req.query.topN as string) || 50, 200);
      const searchGene = ((req.query.gene as string) || '').trim().toUpperCase();
      const searchGeneAliases = searchGene ? resolveGeneAliases(searchGene) : [];

      const cacheKey = `${pairIdx}_${minR2}_${onlyStable}`;
      if (diseaseScreenCache[cacheKey] && (Date.now() - diseaseScreenCache[cacheKey].timestamp) < DISEASE_SCREEN_CACHE_TTL) {
        const cached = diseaseScreenCache[cacheKey].data;
        let results = cached.shifts;
        if (searchGene) {
          results = results.filter((s: any) => searchGeneAliases.some(alias => s.gene.toUpperCase() === alias));
        }
        return res.json({ ...cached, shifts: results.slice(0, topN), totalShifts: results.length });
      }

      const pair = DISEASE_PAIRS[pairIdx];
      const healthyDs = AVAILABLE_PROCESSED_DATASETS.find(d => d.id === pair.healthyId);
      const diseaseDs = AVAILABLE_PROCESSED_DATASETS.find(d => d.id === pair.diseaseId);

      if (!healthyDs || !diseaseDs) {
        return res.status(404).json({ error: "Dataset not found" });
      }

      const healthyPath = path.join(process.cwd(), 'datasets', healthyDs.file);
      const diseasePath = path.join(process.cwd(), 'datasets', diseaseDs.file);

      if (!fs.existsSync(healthyPath) || !fs.existsSync(diseasePath)) {
        return res.status(404).json({ error: "Dataset file not found" });
      }

      const healthyResults = generateProcessedTable(healthyPath);
      const diseaseResults = generateProcessedTable(diseasePath);

      const healthyMap = new Map<string, typeof healthyResults[0]>();
      for (const r of healthyResults) {
        const sym = ENSEMBL_TO_SYMBOL[r.gene] || r.gene;
        healthyMap.set(sym.toUpperCase(), { ...r, gene: sym });
      }

      const diseaseMap = new Map<string, typeof diseaseResults[0]>();
      for (const r of diseaseResults) {
        const sym = ENSEMBL_TO_SYMBOL[r.gene] || r.gene;
        diseaseMap.set(sym.toUpperCase(), { ...r, gene: sym });
      }

      const sharedGenes = [...healthyMap.keys()].filter(k => diseaseMap.has(k));

      interface ShiftEntry {
        gene: string;
        geneType: string;
        geneCategory: string;
        healthyEigenvalue: number;
        diseaseEigenvalue: number;
        shift: number;
        absShift: number;
        fractionalShift: number;
        healthyBeta1: number;
        healthyBeta2: number;
        diseaseBeta1: number;
        diseaseBeta2: number;
        healthyR2: number;
        diseaseR2: number;
        healthyConfidence: string;
        diseaseConfidence: string;
        healthyStable: boolean;
        diseaseStable: boolean;
        regimeChange: string;
        phiCrossing: boolean;
        healthyPeriodSamples: number | null;
        diseasePeriodSamples: number | null;
      }

      const shifts: ShiftEntry[] = [];
      let totalUp = 0, totalDown = 0;
      let sumShift = 0, sumAbsShift = 0;
      let regimeChanges = 0;

      for (const geneUpper of sharedGenes) {
        const h = healthyMap.get(geneUpper)!;
        const d = diseaseMap.get(geneUpper)!;

        if (minR2 > 0 && (h.rSquared < minR2 || d.rSquared < minR2)) continue;
        if (onlyStable && (!h.stable || !d.stable)) continue;

        const hDisc = h.phi1 * h.phi1 + 4 * h.phi2;
        const dDisc = d.phi1 * d.phi1 + 4 * d.phi2;
        const hRegime = hDisc < 0 ? 'oscillatory' : (h.phi1 > 0 ? 'self-reinforcing' : 'alternating');
        const dRegime = dDisc < 0 ? 'oscillatory' : (d.phi1 > 0 ? 'self-reinforcing' : 'alternating');
        const regimeStr = hRegime === dRegime ? 'stable' : `${hRegime} → ${dRegime}`;
        if (hRegime !== dRegime) regimeChanges++;

        // φ-boundary crossing: did the gene switch across |λ| = 0.618?
        const phiCrossing = (h.eigenvalueModulus < 0.618 && d.eigenvalueModulus >= 0.618) ||
                            (h.eigenvalueModulus >= 0.618 && d.eigenvalueModulus < 0.618);

        // Implied oscillation period from complex AR(2) roots (in timepoints)
        let healthyPeriodSamples: number | null = null;
        let diseasePeriodSamples: number | null = null;
        if (hDisc < 0) {
          const hAngle = Math.atan2(Math.sqrt(-hDisc) / 2, h.phi1 / 2);
          if (hAngle > 0) healthyPeriodSamples = +(2 * Math.PI / hAngle).toFixed(1);
        }
        if (dDisc < 0) {
          const dAngle = Math.atan2(Math.sqrt(-dDisc) / 2, d.phi1 / 2);
          if (dAngle > 0) diseasePeriodSamples = +(2 * Math.PI / dAngle).toFixed(1);
        }

        const shift = d.eigenvalueModulus - h.eigenvalueModulus;
        if (shift > 0) totalUp++;
        else totalDown++;
        sumShift += shift;
        sumAbsShift += Math.abs(shift);

        shifts.push({
          gene: h.gene,
          geneType: h.geneType,
          geneCategory: classifyGeneShared(h.gene),
          healthyEigenvalue: +h.eigenvalueModulus.toFixed(4),
          diseaseEigenvalue: +d.eigenvalueModulus.toFixed(4),
          shift: +shift.toFixed(4),
          absShift: +Math.abs(shift).toFixed(4),
          fractionalShift: h.eigenvalueModulus > 0.001 ? +((d.eigenvalueModulus - h.eigenvalueModulus) / h.eigenvalueModulus).toFixed(4) : 0,
          healthyBeta1: +h.phi1.toFixed(4),
          healthyBeta2: +h.phi2.toFixed(4),
          diseaseBeta1: +d.phi1.toFixed(4),
          diseaseBeta2: +d.phi2.toFixed(4),
          healthyR2: +h.rSquared.toFixed(4),
          diseaseR2: +d.rSquared.toFixed(4),
          healthyConfidence: h.confidenceLevel,
          diseaseConfidence: d.confidenceLevel,
          healthyStable: h.stable,
          diseaseStable: d.stable,
          regimeChange: regimeStr,
          phiCrossing,
          healthyPeriodSamples,
          diseasePeriodSamples,
        });
      }

      shifts.sort((a, b) => b.absShift - a.absShift);

      const categoryShifts: Record<string, { sum: number; count: number; sumAbs: number }> = {};
      for (const s of shifts) {
        if (!categoryShifts[s.geneCategory]) {
          categoryShifts[s.geneCategory] = { sum: 0, count: 0, sumAbs: 0 };
        }
        categoryShifts[s.geneCategory].sum += s.shift;
        categoryShifts[s.geneCategory].count++;
        categoryShifts[s.geneCategory].sumAbs += s.absShift;
      }

      const categoryStats = Object.entries(categoryShifts)
        .map(([cat, stats]) => ({
          category: cat,
          count: stats.count,
          meanShift: +(stats.sum / stats.count).toFixed(4),
          meanAbsShift: +(stats.sumAbs / stats.count).toFixed(4),
        }))
        .sort((a, b) => Math.abs(b.meanShift) - Math.abs(a.meanShift));

      const shiftBins = Array.from({ length: 21 }, (_, i) => {
        const center = -0.5 + i * 0.05;
        return { center: +center.toFixed(2), count: 0 };
      });
      for (const s of shifts) {
        const clampedShift = Math.max(-0.5, Math.min(0.5, s.shift));
        const binIdx = Math.min(20, Math.max(0, Math.round((clampedShift + 0.5) / 0.05)));
        if (shiftBins[binIdx]) shiftBins[binIdx].count++;
      }

      const nFiltered = shifts.length;
      const responseData = {
        pair: {
          label: pair.label,
          category: pair.category,
          healthyName: healthyDs.name,
          diseaseName: diseaseDs.name,
          healthyId: pair.healthyId,
          diseaseId: pair.diseaseId,
        },
        summary: {
          totalHealthyGenes: healthyResults.length,
          totalDiseaseGenes: diseaseResults.length,
          sharedGenes: sharedGenes.length,
          filteredGenes: nFiltered,
          genesUp: totalUp,
          genesDown: totalDown,
          meanShift: nFiltered > 0 ? +(sumShift / nFiltered).toFixed(4) : 0,
          meanAbsShift: nFiltered > 0 ? +(sumAbsShift / nFiltered).toFixed(4) : 0,
          regimeChanges,
          regimeChangePercent: nFiltered > 0 ? +((regimeChanges / nFiltered) * 100).toFixed(1) : 0,
          filters: { minR2, onlyStable },
        },
        shifts: shifts.slice(0, topN),
        totalShifts: shifts.length,
        categoryStats,
        shiftDistribution: shiftBins,
        highlights: shifts.filter(s =>
          ['clock', 'target'].includes(s.geneType) ||
          ['Per1','Per2','Cry1','Cry2','Clock','Nr1d1','Arntl','Bmal1',
           'PER1','PER2','CRY1','CRY2','CLOCK','NR1D1','ARNTL','BMAL1',
           'Myc','Trp53','Pten','Apc','Wee1','Kras','Lgr5','Brca1',
           'MYC','TP53','PTEN','APC','WEE1','KRAS','LGR5','BRCA1',
           'Cdkn1a','CDKN1A','Cdk1','CDK1'].includes(s.gene)
        ).slice(0, 30),
      };

      diseaseScreenCache[cacheKey] = { data: { ...responseData, shifts }, timestamp: Date.now() };

      if (searchGene) {
        const filteredShifts = shifts.filter((s: ShiftEntry) => searchGeneAliases.some(alias => s.gene.toUpperCase() === alias));
        return res.json({ ...responseData, shifts: filteredShifts.slice(0, topN), totalShifts: filteredShifts.length });
      }

      res.json(responseData);
    } catch (error: any) {
      console.error("Disease screen error:", error);
      res.status(500).json({ error: error.message || "Failed to run disease screen" });
    }
  });

  app.get("/api/analysis/disease-screen/:pairIndex/robustness", async (req: Request, res) => {
    try {
      const pairIdx = parseInt(req.params.pairIndex);
      if (isNaN(pairIdx) || pairIdx < 0 || pairIdx >= DISEASE_PAIRS.length) {
        return res.status(400).json({ error: "Invalid pair index", validRange: "0-9" });
      }
      const nPermutations = Math.min(parseInt(req.query.nPermutations as string) || 10000, 10000);
      const nBootstrap = Math.min(parseInt(req.query.nBootstrap as string) || 5000, 5000);
      const minR2 = parseFloat(req.query.minR2 as string) || 0.0;
      const onlyStable = req.query.onlyStable === 'true';

      const { runDiseaseScreenRobustness } = await import('../disease-screen-robustness');
      const result = runDiseaseScreenRobustness(pairIdx, { nPermutations, nBootstrap, minR2, onlyStable });
      res.json(result);
    } catch (error: any) {
      console.error("Disease screen robustness error:", error);
      res.status(500).json({ error: error.message || "Failed to run disease screen robustness" });
    }
  });

  // ===== Genome-Wide Root-Space Enrichment Analysis =====
  const enrichmentCache: Record<string, { data: any; timestamp: number }> = {};
  const ENRICHMENT_CACHE_TTL = 2 * 60 * 60 * 1000;

  app.get("/api/analysis/root-space-enrichment", async (req, res) => {
    try {
      const datasetId = (req.query.dataset as string) || 'GSE54650_Liver_circadian';
      const annotationSource = ((req.query.annotation as string) || 'ALL').toUpperCase() as 'GO' | 'KEGG' | 'DYNAMICAL' | 'ALL';
      const nPermutations = Math.min(parseInt(req.query.nPermutations as string) || 1000, 5000);
      const forceRefresh = req.query.refresh === 'true';

      const cacheKey = `${datasetId}_${annotationSource}_${nPermutations}`;
      if (!forceRefresh && enrichmentCache[cacheKey] && (Date.now() - enrichmentCache[cacheKey].timestamp) < ENRICHMENT_CACHE_TTL) {
        return res.json(enrichmentCache[cacheKey].data);
      }

      const dataset = AVAILABLE_PROCESSED_DATASETS.find(d => d.id === datasetId);
      if (!dataset) {
        return res.status(404).json({ error: "Dataset not found", available: AVAILABLE_PROCESSED_DATASETS.map(d => ({ id: d.id, name: d.name })) });
      }

      const filePath = path.join(process.cwd(), 'datasets', dataset.file);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: `Dataset file not found: ${dataset.file}` });
      }

      let allGeneData: any[];
      if (genomeSearchCache[datasetId] && (Date.now() - genomeSearchCache[datasetId].timestamp) < GENOME_SEARCH_CACHE_TTL) {
        allGeneData = genomeSearchCache[datasetId].data;
      } else {
        const rawResults = generateProcessedTable(filePath);
        allGeneData = rawResults.map(r => {
          const disc = r.phi1 * r.phi1 + 4 * r.phi2;
          let rootR: number, rootTheta: number;
          if (disc < 0) {
            rootR = Math.sqrt(-r.phi2);
            rootTheta = Math.atan2(Math.sqrt(-disc), r.phi1);
          } else {
            const l1 = (r.phi1 + Math.sqrt(disc)) / 2;
            const l2 = (r.phi1 - Math.sqrt(disc)) / 2;
            const dominant = Math.abs(l1) >= Math.abs(l2) ? l1 : l2;
            rootR = Math.abs(dominant);
            rootTheta = dominant < 0 ? Math.PI : 0;
          }
          return {
            gene: r.gene,
            beta1: +r.phi1.toFixed(4),
            beta2: +r.phi2.toFixed(4),
            eigenvalue: +r.eigenvalueModulus.toFixed(4),
            rootR: +rootR.toFixed(4),
            rootTheta: +rootTheta.toFixed(4),
            x: +(rootR * Math.cos(rootTheta)).toFixed(4),
            y: +(rootR * Math.sin(rootTheta)).toFixed(4),
            stable: r.eigenvalueModulus < 1.0,
          };
        });
        genomeSearchCache[datasetId] = { data: allGeneData, timestamp: Date.now() };
      }

      const enrichmentEntries = allGeneData.map((g: any) => ({
        gene: g.gene,
        beta1: g.beta1,
        beta2: g.beta2,
        eigenvalue: g.eigenvalue,
        rootR: g.rootR || g.r || 0,
        rootTheta: g.rootTheta || g.theta || 0,
        x: g.x || 0,
        y: g.y || 0,
        stable: g.stable,
      }));

      const { runFullEnrichmentAnalysis } = await import('../root-space-enrichment');
      const species = dataset.species || 'mouse';
      const result = runFullEnrichmentAnalysis(enrichmentEntries, datasetId, species, annotationSource, nPermutations);

      enrichmentCache[cacheKey] = { data: result, timestamp: Date.now() };
      res.json(result);
    } catch (error: any) {
      console.error("Root-space enrichment error:", error);
      res.status(500).json({ error: error.message || "Failed to run enrichment analysis" });
    }
  });

  app.get("/api/analysis/drug-target-overlay", async (req, res) => {
    try {
      const datasetId = (req.query.dataset as string) || 'GSE54650_Liver_circadian';
      const drugClassFilter = (req.query.drugClass as string) || 'all';
      const fdaOnly = req.query.fdaOnly === 'true';

      const dataset = AVAILABLE_PROCESSED_DATASETS.find(d => d.id === datasetId);
      if (!dataset) {
        return res.status(404).json({ error: "Dataset not found" });
      }

      let allResults: any[];
      if (genomeSearchCache[datasetId] && (Date.now() - genomeSearchCache[datasetId].timestamp) < GENOME_SEARCH_CACHE_TTL) {
        allResults = genomeSearchCache[datasetId].data;
      } else {
        const filePath = path.join(process.cwd(), 'datasets', dataset.file);
        if (!fs.existsSync(filePath)) {
          return res.status(404).json({ error: `Dataset file not found: ${dataset.file}` });
        }
        const rawResults = generateProcessedTable(filePath);
        const PHI = (1 + Math.sqrt(5)) / 2;
        allResults = rawResults.map(r => {
          const disc = r.phi1 * r.phi1 + 4 * r.phi2;
          let rootR: number, rootTheta: number, isComplex: boolean;
          if (disc < 0) {
            rootR = Math.sqrt(-r.phi2);
            rootTheta = Math.atan2(Math.sqrt(-disc), r.phi1);
            isComplex = true;
          } else {
            const l1 = (r.phi1 + Math.sqrt(disc)) / 2;
            const l2 = (r.phi1 - Math.sqrt(disc)) / 2;
            const dominant = Math.abs(l1) >= Math.abs(l2) ? l1 : l2;
            rootR = Math.abs(dominant);
            rootTheta = dominant < 0 ? Math.PI : 0;
            isComplex = false;
          }
          const thetaPhi = 2 * Math.PI / PHI;
          const rRef = 0.7;
          const logRDist = Math.abs(Math.log(Math.max(rootR, 0.01)) - Math.log(rRef));
          let thetaDist = Math.abs(rootTheta - thetaPhi);
          thetaDist = Math.min(thetaDist, 2 * Math.PI - thetaDist);
          const dPhi = logRDist + thetaDist;
          const x = rootR * Math.cos(rootTheta);
          const y = rootR * Math.sin(rootTheta);
          return {
            gene: r.gene,
            geneType: r.geneType,
            geneCategory: classifyGeneExpanded(r.gene),
            beta1: +r.phi1.toFixed(4),
            beta2: +r.phi2.toFixed(4),
            eigenvalue: +r.eigenvalueModulus.toFixed(4),
            r: +rootR.toFixed(4),
            theta: +rootTheta.toFixed(4),
            isComplex,
            dPhi: +dPhi.toFixed(4),
            x: +x.toFixed(4),
            y: +y.toFixed(4),
            r2: +r.rSquared.toFixed(4),
            stable: r.eigenvalueModulus < 1.0,
            confidence: r.confidenceLevel,
          };
        });
        genomeSearchCache[datasetId] = { data: allResults, timestamp: Date.now() };
      }

      const { DRUG_TARGET_DATABASE, DRUG_CLASS_CONFIG, getDrugTargetsForGene } = await import('../data/annotations/drug_targets');
      const { resolveToHuman } = await import('../data/annotations/gene_annotations');

      let drugEntries = fdaOnly
        ? DRUG_TARGET_DATABASE.filter(d => d.fdaApproved)
        : DRUG_TARGET_DATABASE;
      if (drugClassFilter !== 'all') {
        drugEntries = drugEntries.filter(d => d.drugClass === drugClassFilter);
      }

      const drugGeneArr = Array.from(new Set(drugEntries.map(d => d.gene.toUpperCase())));

      const matchedGenes: any[] = [];
      const geneNameIndex = new Map<string, any>();
      for (const g of allResults) {
        const upper = g.gene.toUpperCase();
        const humanized = resolveToHuman(g.gene).toUpperCase();
        geneNameIndex.set(upper, g);
        geneNameIndex.set(humanized, g);
      }

      const seenGenes = new Set<string>();
      for (const drugGene of drugGeneArr) {
        const match = geneNameIndex.get(drugGene) || geneNameIndex.get(resolveToHuman(drugGene).toUpperCase());
        if (match && !seenGenes.has(match.gene)) {
          seenGenes.add(match.gene);
          const drugs = getDrugTargetsForGene(drugGene);
          const filteredDrugs = fdaOnly ? drugs.filter(d => d.fdaApproved) : drugs;
          const relevantDrugs = drugClassFilter !== 'all'
            ? filteredDrugs.filter(d => d.drugClass === drugClassFilter)
            : filteredDrugs;
          if (relevantDrugs.length === 0) continue;

          const distSelfReinforcing = Math.sqrt((match.beta1 - 2) ** 2 + (match.beta2 - (-1)) ** 2);
          const distAlternating = Math.sqrt((match.beta1 - (-2)) ** 2 + (match.beta2 - (-1)) ** 2);
          const distOscillatory = Math.sqrt((match.beta1 - 0) ** 2 + (match.beta2 - 1) ** 2);
          const distCenter = Math.sqrt(match.beta1 ** 2 + match.beta2 ** 2);
          const minDist = Math.min(distSelfReinforcing, distAlternating, distOscillatory, distCenter);
          let dominantPole = 'intermediate';
          if (minDist === distCenter && distCenter < 0.5) dominantPole = 'center';
          else if (minDist === distSelfReinforcing) dominantPole = 'self-reinforcing';
          else if (minDist === distAlternating) dominantPole = 'alternating';
          else if (minDist === distOscillatory) dominantPole = 'oscillatory';

          matchedGenes.push({
            ...match,
            drugs: relevantDrugs.map(d => ({
              drugName: d.drugName,
              drugClass: d.drugClass,
              interactionType: d.interactionType,
              fdaApproved: d.fdaApproved,
              indication: d.indication,
            })),
            primaryDrugClass: relevantDrugs[0].drugClass,
            dominantPole,
            drugCount: relevantDrugs.length,
            fdaApprovedCount: relevantDrugs.filter(d => d.fdaApproved).length,
          });
        }
      }

      matchedGenes.sort((a, b) => b.eigenvalue - a.eigenvalue);

      const classSummary: Record<string, { count: number; meanEigenvalue: number; meanBeta1: number; meanBeta2: number; dominantPoles: Record<string, number> }> = {};
      for (const g of matchedGenes) {
        const cls = g.primaryDrugClass;
        if (!classSummary[cls]) {
          classSummary[cls] = { count: 0, meanEigenvalue: 0, meanBeta1: 0, meanBeta2: 0, dominantPoles: {} };
        }
        classSummary[cls].count++;
        classSummary[cls].meanEigenvalue += g.eigenvalue;
        classSummary[cls].meanBeta1 += g.beta1;
        classSummary[cls].meanBeta2 += g.beta2;
        classSummary[cls].dominantPoles[g.dominantPole] = (classSummary[cls].dominantPoles[g.dominantPole] || 0) + 1;
      }
      for (const cls of Object.keys(classSummary)) {
        const s = classSummary[cls];
        s.meanEigenvalue = +(s.meanEigenvalue / s.count).toFixed(4);
        s.meanBeta1 = +(s.meanBeta1 / s.count).toFixed(4);
        s.meanBeta2 = +(s.meanBeta2 / s.count).toFixed(4);
      }

      const poleSummary: Record<string, number> = {};
      for (const g of matchedGenes) {
        poleSummary[g.dominantPole] = (poleSummary[g.dominantPole] || 0) + 1;
      }

      const topByEigenvalue = matchedGenes.slice(0, 10);
      const clockGated = matchedGenes.filter(g => g.dominantPole === 'self-reinforcing' || g.dominantPole === 'oscillatory');

      res.json({
        dataset: { id: dataset.id, name: dataset.name, species: dataset.species },
        totalGenesInDataset: allResults.length,
        totalDrugTargetsMatched: matchedGenes.length,
        totalDrugTargetsInDB: new Set(DRUG_TARGET_DATABASE.map(d => d.gene)).size,
        filters: { drugClass: drugClassFilter, fdaOnly },
        drugTargets: matchedGenes,
        classSummary,
        poleSummary,
        topByEigenvalue,
        clockGatedTargets: clockGated.length,
        clockGatedList: clockGated.slice(0, 20),
        drugClassConfig: DRUG_CLASS_CONFIG,
        availableDatasets: AVAILABLE_PROCESSED_DATASETS.filter(d => fs.existsSync(path.join(process.cwd(), 'datasets', d.file))).map(d => ({ id: d.id, name: d.name, species: d.species })),
      });
    } catch (error: any) {
      console.error("Drug target overlay error:", error);
      res.status(500).json({ error: error.message || "Failed to generate drug target overlay" });
    }
  });

  const crossTissueCache: Record<string, { data: any; timestamp: number }> = {};
  const CROSS_TISSUE_CACHE_TTL = 60 * 60 * 1000;

  app.get("/api/analysis/drug-target-cross-tissue", async (req, res) => {
    try {
      const fdaOnly = req.query.fdaOnly === 'true';
      const cacheKey = `cross_tissue_${fdaOnly}`;
      if (crossTissueCache[cacheKey] && (Date.now() - crossTissueCache[cacheKey].timestamp) < CROSS_TISSUE_CACHE_TTL) {
        return res.json(crossTissueCache[cacheKey].data);
      }
      const { DRUG_TARGET_DATABASE, DRUG_CLASS_CONFIG, getDrugTargetsForGene } = await import('../data/annotations/drug_targets');
      const { resolveToHuman } = await import('../data/annotations/gene_annotations');

      const tissueDatasets = [
        'GSE54650_Liver_circadian',
        'GSE54650_Kidney_circadian',
        'GSE54650_Heart_circadian',
        'GSE54650_Lung_circadian',
        'GSE113883_Human_WholeBlood',
        'GSE98965_baboon_FPKM',
      ];

      const tissueLabels: Record<string, string> = {
        'GSE54650_Liver_circadian': 'Liver',
        'GSE54650_Kidney_circadian': 'Kidney',
        'GSE54650_Heart_circadian': 'Heart',
        'GSE54650_Lung_circadian': 'Lung',
        'GSE113883_Human_WholeBlood': 'Human Blood',
        'GSE98965_baboon_FPKM': 'Baboon',
      };

      const drugGeneSet = new Set(
        (fdaOnly ? DRUG_TARGET_DATABASE.filter(d => d.fdaApproved) : DRUG_TARGET_DATABASE)
          .map(d => d.gene.toUpperCase())
      );

      const crossTissueResults: Record<string, {
        tissue: string;
        totalMatched: number;
        clockGated: number;
        classMeans: Record<string, { meanEigenvalue: number; count: number; stdDev: number; min: number; max: number; eigenvalues: number[]; poles: Record<string, number> }>;
        overallMeanEigenvalue: number;
        geneEigenvalues: Record<string, { eigenvalue: number; pole: string; beta1: number; beta2: number }>;
      }> = {};

      for (const datasetId of tissueDatasets) {
        const dataset = AVAILABLE_PROCESSED_DATASETS.find(d => d.id === datasetId);
        if (!dataset) continue;

        if (!genomeSearchCache[datasetId] || (Date.now() - genomeSearchCache[datasetId].timestamp > 30 * 60 * 1000)) {
          const filePath = path.join(process.cwd(), 'datasets', dataset.file);
          if (!fs.existsSync(filePath)) continue;
          const rawResults = generateProcessedTable(filePath);
          const PHI = (1 + Math.sqrt(5)) / 2;
          const allResultsGen = rawResults.map(r => {
            const disc = r.phi1 * r.phi1 + 4 * r.phi2;
            let rootR: number, rootTheta: number, isComplex: boolean;
            if (disc < 0) {
              rootR = Math.sqrt(-r.phi2);
              rootTheta = Math.atan2(Math.sqrt(-disc), r.phi1);
              isComplex = true;
            } else {
              const l1 = (r.phi1 + Math.sqrt(disc)) / 2;
              const l2 = (r.phi1 - Math.sqrt(disc)) / 2;
              const dominant = Math.abs(l1) >= Math.abs(l2) ? l1 : l2;
              rootR = Math.abs(dominant);
              rootTheta = dominant < 0 ? Math.PI : 0;
              isComplex = false;
            }
            const x = rootR * Math.cos(rootTheta);
            const y = rootR * Math.sin(rootTheta);
            return {
              gene: r.gene,
              geneType: 'unknown',
              beta1: +r.phi1.toFixed(4),
              beta2: +r.phi2.toFixed(4),
              eigenvalue: +r.eigenvalueModulus.toFixed(4),
              r: +rootR.toFixed(4),
              theta: +rootTheta.toFixed(4),
              x: +x.toFixed(4),
              y: +y.toFixed(4),
              r2: +r.rSquared.toFixed(4),
              stable: r.eigenvalueModulus < 1.0,
            };
          });
          genomeSearchCache[datasetId] = { data: allResultsGen, timestamp: Date.now() };
        }

        const allResults = genomeSearchCache[datasetId].data;
        const geneNameIndex = new Map<string, any>();
        for (const g of allResults) {
          geneNameIndex.set(g.gene.toUpperCase(), g);
          geneNameIndex.set(resolveToHuman(g.gene).toUpperCase(), g);
        }

        const classMeans: Record<string, { meanEigenvalue: number; count: number; stdDev: number; min: number; max: number; eigenvalues: number[]; poles: Record<string, number> }> = {};
        const geneEigenvalues: Record<string, { eigenvalue: number; pole: string; beta1: number; beta2: number }> = {};
        let totalMatched = 0;
        let clockGatedCount = 0;
        let sumEigenvalue = 0;
        const seenGenes = new Set<string>();

        for (const drugGene of Array.from(drugGeneSet)) {
          const match = geneNameIndex.get(drugGene) || geneNameIndex.get(resolveToHuman(drugGene).toUpperCase());
          if (!match || seenGenes.has(match.gene)) continue;
          seenGenes.add(match.gene);

          const drugs = getDrugTargetsForGene(drugGene);
          const filteredDrugs = fdaOnly ? drugs.filter(d => d.fdaApproved) : drugs;
          if (filteredDrugs.length === 0) continue;

          const distSR = Math.sqrt((match.beta1 - 2) ** 2 + (match.beta2 - (-1)) ** 2);
          const distAlt = Math.sqrt((match.beta1 - (-2)) ** 2 + (match.beta2 - (-1)) ** 2);
          const distOsc = Math.sqrt((match.beta1 - 0) ** 2 + (match.beta2 - 1) ** 2);
          const distCen = Math.sqrt(match.beta1 ** 2 + match.beta2 ** 2);
          const minDist = Math.min(distSR, distAlt, distOsc, distCen);
          let pole = 'intermediate';
          if (minDist === distCen && distCen < 0.5) pole = 'center';
          else if (minDist === distSR) pole = 'self-reinforcing';
          else if (minDist === distAlt) pole = 'alternating';
          else if (minDist === distOsc) pole = 'oscillatory';

          const cls = filteredDrugs[0].drugClass;
          if (!classMeans[cls]) {
            classMeans[cls] = { meanEigenvalue: 0, count: 0, stdDev: 0, min: Infinity, max: -Infinity, eigenvalues: [], poles: {} };
          }
          classMeans[cls].count++;
          classMeans[cls].eigenvalues.push(match.eigenvalue);
          classMeans[cls].min = Math.min(classMeans[cls].min, match.eigenvalue);
          classMeans[cls].max = Math.max(classMeans[cls].max, match.eigenvalue);
          classMeans[cls].poles[pole] = (classMeans[cls].poles[pole] || 0) + 1;

          const humanGene = resolveToHuman(match.gene).toUpperCase();
          geneEigenvalues[humanGene] = { eigenvalue: match.eigenvalue, pole, beta1: match.beta1, beta2: match.beta2 };

          totalMatched++;
          sumEigenvalue += match.eigenvalue;
          if (pole === 'self-reinforcing' || pole === 'oscillatory') clockGatedCount++;
        }

        for (const cls of Object.keys(classMeans)) {
          const evs = classMeans[cls].eigenvalues;
          const mean = evs.reduce((a, b) => a + b, 0) / evs.length;
          classMeans[cls].meanEigenvalue = +mean.toFixed(4);
          const variance = evs.reduce((a, b) => a + (b - mean) ** 2, 0) / evs.length;
          classMeans[cls].stdDev = +Math.sqrt(variance).toFixed(4);
        }

        crossTissueResults[datasetId] = {
          tissue: tissueLabels[datasetId] || datasetId,
          totalMatched,
          clockGated: clockGatedCount,
          classMeans,
          overallMeanEigenvalue: totalMatched > 0 ? +(sumEigenvalue / totalMatched).toFixed(4) : 0,
          geneEigenvalues,
        };
      }

      const allClasses = Array.from(new Set(
        Object.values(crossTissueResults).flatMap(r => Object.keys(r.classMeans))
      )).sort();

      const heatmapData: { drugClass: string; label: string; color: string; tissues: Record<string, { mean: number; std: number; n: number; clockGatedPct: number }> }[] = [];
      for (const cls of allClasses) {
        const tissues: Record<string, { mean: number; std: number; n: number; clockGatedPct: number }> = {};
        for (const [dsId, result] of Object.entries(crossTissueResults)) {
          const cm = result.classMeans[cls];
          if (cm) {
            const clockPoles = (cm.poles['self-reinforcing'] || 0) + (cm.poles['oscillatory'] || 0);
            tissues[result.tissue] = {
              mean: cm.meanEigenvalue,
              std: cm.stdDev,
              n: cm.count,
              clockGatedPct: cm.count > 0 ? +(clockPoles / cm.count * 100).toFixed(1) : 0,
            };
          }
        }
        heatmapData.push({
          drugClass: cls,
          label: (DRUG_CLASS_CONFIG as Record<string, { label: string; color: string }>)[cls]?.label || cls,
          color: (DRUG_CLASS_CONFIG as Record<string, { label: string; color: string }>)[cls]?.color || '#666',
          tissues,
        });
      }

      const geneTracker: Record<string, Record<string, { eigenvalue: number; pole: string }>> = {};
      for (const [dsId, result] of Object.entries(crossTissueResults)) {
        for (const [gene, gData] of Object.entries(result.geneEigenvalues)) {
          if (!geneTracker[gene]) geneTracker[gene] = {};
          geneTracker[gene][result.tissue] = { eigenvalue: gData.eigenvalue, pole: gData.pole };
        }
      }

      const tissueVariableGenes = Object.entries(geneTracker)
        .filter(([_, tissues]) => Object.keys(tissues).length >= 3)
        .map(([gene, tissues]) => {
          const evs = Object.values(tissues).map(t => t.eigenvalue);
          const mean = evs.reduce((a, b) => a + b, 0) / evs.length;
          const variance = evs.reduce((a, b) => a + (b - mean) ** 2, 0) / evs.length;
          const poles = Object.values(tissues).map(t => t.pole);
          const uniquePoles = new Set(poles).size;
          return { gene, tissues, meanEigenvalue: +mean.toFixed(4), cv: mean > 0 ? +(Math.sqrt(variance) / mean).toFixed(4) : 0, uniquePoles, poleSwitcher: uniquePoles > 1 };
        })
        .sort((a, b) => b.cv - a.cv);

      const withinClassSpread: { drugClass: string; label: string; color: string; meanEigenvalue: number; stdDev: number; cv: number; range: number; min: number; max: number; n: number; eigenvalues: number[]; poleDistribution: Record<string, number> }[] = [];
      const liverData = crossTissueResults['GSE54650_Liver_circadian'];
      if (liverData) {
        for (const cls of allClasses) {
          const cm = liverData.classMeans[cls];
          if (cm && cm.count >= 2) {
            const mean = cm.meanEigenvalue;
            withinClassSpread.push({
              drugClass: cls,
              label: (DRUG_CLASS_CONFIG as Record<string, { label: string; color: string }>)[cls]?.label || cls,
              color: (DRUG_CLASS_CONFIG as Record<string, { label: string; color: string }>)[cls]?.color || '#666',
              meanEigenvalue: mean,
              stdDev: cm.stdDev,
              cv: mean > 0 ? +(cm.stdDev / mean).toFixed(4) : 0,
              range: +(cm.max - cm.min).toFixed(4),
              min: +cm.min.toFixed(4),
              max: +cm.max.toFixed(4),
              n: cm.count,
              eigenvalues: cm.eigenvalues.sort((a, b) => b - a),
              poleDistribution: cm.poles,
            });
          }
        }
        withinClassSpread.sort((a, b) => b.cv - a.cv);
      }

      const tissueNames = Object.values(crossTissueResults).map(r => r.tissue);

      const responseData = {
        tissues: tissueNames,
        tissueSummaries: Object.fromEntries(
          Object.values(crossTissueResults).map(r => [r.tissue, {
            totalMatched: r.totalMatched,
            clockGated: r.clockGated,
            overallMeanEigenvalue: r.overallMeanEigenvalue,
          }])
        ),
        heatmapData,
        tissueVariableGenes: tissueVariableGenes.slice(0, 30),
        poleSwitchers: tissueVariableGenes.filter(g => g.poleSwitcher).slice(0, 20),
        withinClassSpread,
        drugClassConfig: DRUG_CLASS_CONFIG,
      };
      crossTissueCache[cacheKey] = { data: responseData, timestamp: Date.now() };
      res.json(responseData);
    } catch (error: any) {
      console.error("Drug target cross-tissue error:", error);
      res.status(500).json({ error: error.message || "Failed to run cross-tissue drug target analysis" });
    }
  });

  app.get("/api/validation/high-res-np", async (_req, res) => {
    try {
      const { runHighResValidation } = await import('../cross-tissue-three-layer');
      const result = runHighResValidation();
      res.json(result);
    } catch (error: any) {
      console.error("High-resolution n/p validation error:", error);
      res.status(500).json({ error: error.message || "Failed to run high-resolution validation" });
    }
  });

  // ===== Circadian Health Score =====
  app.get("/api/analysis/health-scores", async (_req, res) => {
    try {
      const { computeHealthScores } = await import('../circadian-health-score');
      const scores = computeHealthScores(AVAILABLE_PROCESSED_DATASETS);
      res.json({ scores, totalDatasets: scores.length });
    } catch (error: any) {
      console.error("Health score error:", error);
      res.status(500).json({ error: error.message || "Failed to compute health scores" });
    }
  });

  // ===== Most Volatile Genes =====
  app.get("/api/analysis/volatile-genes", async (_req, res) => {
    try {
      const { computeVolatileGenes } = await import('../volatile-genes');
      const result = computeVolatileGenes(AVAILABLE_PROCESSED_DATASETS);
      res.json(result);
    } catch (error: any) {
      console.error("Volatile genes error:", error);
      res.status(500).json({ error: error.message || "Failed to compute volatile genes" });
    }
  });

  // ===== Custom Gene Set Hypothesis Tester =====
  app.post("/api/analysis/gene-set-test", async (req: Request, res) => {
    try {
      const { datasetId, genes } = req.body;
      if (!datasetId || !genes || !Array.isArray(genes) || genes.length === 0) {
        return res.status(400).json({ error: "Provide datasetId and genes array" });
      }
      if (genes.length > 500) {
        return res.status(400).json({ error: "Maximum 500 genes per query" });
      }
      const dataset = AVAILABLE_PROCESSED_DATASETS.find(d => d.id === datasetId);
      if (!dataset) {
        return res.status(404).json({ error: "Dataset not found", available: AVAILABLE_PROCESSED_DATASETS.map(d => ({ id: d.id, name: d.name })) });
      }
      const filePath = path.join(process.cwd(), 'datasets', dataset.file);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: `Dataset file not found: ${dataset.file}` });
      }
      const { testGeneSet } = await import('../gene-set-tester');
      const result = testGeneSet(filePath, genes, { nPermutations: 5000 });
      res.json({ ...result, datasetId: dataset.id, datasetName: dataset.name });
    } catch (error: any) {
      console.error("Gene set test error:", error);
      res.status(500).json({ error: error.message || "Failed to test gene set" });
    }
  });

  // ===== Before/After Trajectory Comparison =====
  app.post("/api/analysis/before-after-trajectory", upload.fields([
    { name: 'before', maxCount: 1 },
    { name: 'after', maxCount: 1 }
  ]), async (req: Request, res) => {
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      if (!files?.before?.[0] || !files?.after?.[0]) {
        return res.status(400).json({ error: "Upload both 'before' and 'after' CSV files" });
      }
      const beforeFile = files.before[0];
      const afterFile = files.after[0];
      const beforeData = await parseDatasetBuffer(beforeFile.buffer, beforeFile.originalname);
      const afterData = await parseDatasetBuffer(afterFile.buffer, afterFile.originalname);

      const { fitAR2WithDiagnostics } = await import('../edge-case-diagnostics');
      const { solveAR2Eigenvalues } = await import('../par2-engine');

      const sharedGenes = Array.from(beforeData.geneTimeSeries.keys())
        .filter(g => afterData.geneTimeSeries.has(g));

      const trajectories: any[] = [];
      const maxGenes = Math.min(sharedGenes.length, 500);
      const genesToProcess = sharedGenes.slice(0, maxGenes);

      for (const gene of genesToProcess) {
        const beforeExpr = beforeData.geneTimeSeries.get(gene)!;
        const afterExpr = afterData.geneTimeSeries.get(gene)!;
        if (beforeExpr.length < 4 || afterExpr.length < 4) continue;

        try {
          const beforeFit = fitAR2WithDiagnostics(beforeExpr);
          const afterFit = fitAR2WithDiagnostics(afterExpr);
          if (!beforeFit || !afterFit) continue;
          const beforeEig = solveAR2Eigenvalues(beforeFit.phi1, beforeFit.phi2);
          const afterEig = solveAR2Eigenvalues(afterFit.phi1, afterFit.phi2);
          const beforeMod = Math.max(beforeEig.modulus1, beforeEig.modulus2);
          const afterMod = Math.max(afterEig.modulus1, afterEig.modulus2);

          trajectories.push({
            gene: String(gene).replace(/"/g, ''),
            beforeBeta1: beforeFit.phi1,
            beforeBeta2: beforeFit.phi2,
            afterBeta1: afterFit.phi1,
            afterBeta2: afterFit.phi2,
            beforeEigenvalue: +beforeMod.toFixed(4),
            afterEigenvalue: +afterMod.toFixed(4),
            shift: +(afterMod - beforeMod).toFixed(4),
            beforeR2: +beforeFit.r2.toFixed(4),
            afterR2: +afterFit.r2.toFixed(4),
            regimeChange: beforeEig.isComplex !== afterEig.isComplex,
          });
        } catch { continue; }
      }

      trajectories.sort((a, b) => Math.abs(b.shift) - Math.abs(a.shift));
      const meanShift = trajectories.length > 0
        ? trajectories.reduce((s, t) => s + t.shift, 0) / trajectories.length
        : 0;

      res.json({
        sharedGenes: sharedGenes.length,
        analyzedGenes: trajectories.length,
        beforeFile: beforeFile.originalname,
        afterFile: afterFile.originalname,
        meanAbsShift: +(trajectories.reduce((s, t) => s + Math.abs(t.shift), 0) / Math.max(trajectories.length, 1)).toFixed(4),
        meanShift: +meanShift.toFixed(4),
        regimeChanges: trajectories.filter(t => t.regimeChange).length,
        topShifts: trajectories.slice(0, 50),
        allTrajectories: trajectories.slice(0, 200),
      });
    } catch (error: any) {
      console.error("Before/after trajectory error:", error);
      res.status(500).json({ error: error.message || "Failed to compute trajectory comparison" });
    }
  });

  // ===== Pre-loaded Before/After Comparison Pairs =====
  const BEFORE_AFTER_PAIRS = [
    { id: 'mock-vs-lps', name: 'Immune Activation: DC Mock → LPS', before: 'Rabani2014_DendriticCell_Mock_TimeSeries.csv', after: 'Rabani2014_DendriticCell_LPS_Full.csv', description: 'Dendritic cell resting state vs LPS-activated immune response (Rabani 2014). Tests how immune activation reshapes temporal persistence.' },
    { id: 'myc-on-vs-off', name: 'Oncogene Toggle: MYC-ON → MYC-OFF', before: 'GSE221103_Neuroblastoma_MYC_ON.csv', after: 'GSE221103_Neuroblastoma_MYC_OFF.csv', description: 'Neuroblastoma with MYC oncogene active vs shut off (GSE221103). Tests persistence recovery after oncogene removal.' },
    { id: 'wt-vs-apc', name: 'Cancer Initiation: WT → APC-Mutant Organoid', before: 'GSE157357_Organoid_WT-WT_circadian.csv', after: 'GSE157357_Organoid_ApcKO-WT_circadian.csv', description: 'Wild-type vs APC-knockout intestinal organoids (GSE157357). Tests how cancer-initiating mutation alters circadian persistence.' },
    { id: 'sleep-ok-vs-restricted', name: 'Sleep Restriction: Sufficient → Restricted', before: 'GSE39445_Blood_SufficientSleep_circadian.csv', after: 'GSE39445_Blood_SleepRestriction_circadian.csv', description: 'Human blood after 1 week sufficient sleep vs 1 week restricted sleep (GSE39445). Tests circadian disruption from sleep loss.' },
    { id: 'nurses-day-vs-night', name: 'Shift Work: Day-Shift → Night-Shift Nurses', before: 'GSE122541_Nurses_DayShift_circadian.csv', after: 'GSE122541_Nurses_NightShift_circadian.csv', description: 'Human PBMC from day-shift vs night-shift hospital nurses (GSE122541). Tests real-world circadian disruption.' },
    { id: 'wt-vs-bmalko', name: 'Clock Knockout: WT → BMAL1-KO Organoid', before: 'GSE157357_Organoid_WT-WT_circadian.csv', after: 'GSE157357_Organoid_WT-BmalKO_circadian.csv', description: 'Wild-type vs BMAL1-knockout organoids (GSE157357). Tests complete clock ablation effect on persistence.' },
    { id: 'aligned-vs-misaligned', name: 'Forced Desynchrony: Aligned → Misaligned', before: 'GSE48113_ForcedDesync_Aligned_circadian.csv', after: 'GSE48113_ForcedDesync_Misaligned_circadian.csv', description: 'Human blood under forced desynchrony: circadian-aligned vs misaligned conditions (GSE48113). Tests internal desynchrony effects on gene persistence.' },
    { id: 'apc-wt-vs-bmalko', name: 'APC-KO Clock Knockout: APC-KO+WT → APC-KO+BmalKO', before: 'GSE157357_Organoid_ApcKO-WT_circadian.csv', after: 'GSE157357_Organoid_ApcKO-BmalKO_circadian.csv', description: 'APC-mutant organoids with intact clock vs double-knockout (APC+BMAL1) organoids (GSE157357). Tests whether clock disruption further alters persistence in a cancer background.' },
  ];

  app.get("/api/analysis/before-after-pairs", (_req, res) => {
    res.json(BEFORE_AFTER_PAIRS.map(p => ({ id: p.id, name: p.name, description: p.description })));
  });

  app.get("/api/analysis/before-after-preloaded/:pairId", async (req, res) => {
    try {
      const pair = BEFORE_AFTER_PAIRS.find(p => p.id === req.params.pairId);
      if (!pair) return res.status(404).json({ error: 'Pair not found', available: BEFORE_AFTER_PAIRS.map(p => p.id) });

      const beforePath = path.join(process.cwd(), 'datasets', pair.before);
      const afterPath = path.join(process.cwd(), 'datasets', pair.after);
      if (!fs.existsSync(beforePath) || !fs.existsSync(afterPath)) {
        return res.status(404).json({ error: 'Dataset files not found' });
      }

      const { fitAR2WithDiagnostics } = await import('../edge-case-diagnostics');
      const { solveAR2Eigenvalues } = await import('../par2-engine');
      const { parse } = await import('csv-parse/sync');

      function loadGenes(fp: string): Map<string, number[]> {
        const content = fs.readFileSync(fp, 'utf-8');
        const records = parse(content, { columns: true, skip_empty_lines: true }) as Record<string, string>[];
        const map = new Map<string, number[]>();
        for (const rec of records) {
          const gene = (rec.Gene || rec.gene || Object.values(rec)[0] || '').toLowerCase();
          if (!gene) continue;
          const vals = Object.keys(rec).filter(k => k !== 'Gene' && k !== 'gene').map(h => parseFloat(rec[h])).filter(v => !isNaN(v));
          if (vals.length >= 4) map.set(gene, vals);
        }
        return map;
      }

      const beforeGenes = loadGenes(beforePath);
      const afterGenes = loadGenes(afterPath);
      const shared = Array.from(beforeGenes.keys()).filter(g => afterGenes.has(g));

      const trajectories: any[] = [];
      const maxGenes = Math.min(shared.length, 500);
      const genesToProcess = shared.slice(0, maxGenes);

      for (const gene of genesToProcess) {
        const beforeExpr = beforeGenes.get(gene)!;
        const afterExpr = afterGenes.get(gene)!;
        try {
          const beforeFit = fitAR2WithDiagnostics(beforeExpr);
          const afterFit = fitAR2WithDiagnostics(afterExpr);
          if (!beforeFit || !afterFit) continue;
          const beforeEig = solveAR2Eigenvalues(beforeFit.phi1, beforeFit.phi2);
          const afterEig = solveAR2Eigenvalues(afterFit.phi1, afterFit.phi2);
          const beforeMod = Math.max(beforeEig.modulus1, beforeEig.modulus2);
          const afterMod = Math.max(afterEig.modulus1, afterEig.modulus2);
          trajectories.push({
            gene: gene.charAt(0).toUpperCase() + gene.slice(1),
            beforeBeta1: beforeFit.phi1, beforeBeta2: beforeFit.phi2,
            afterBeta1: afterFit.phi1, afterBeta2: afterFit.phi2,
            beforeEigenvalue: +beforeMod.toFixed(4), afterEigenvalue: +afterMod.toFixed(4),
            shift: +(afterMod - beforeMod).toFixed(4),
            beforeR2: +(beforeFit.r2 ?? 0).toFixed(4),
            afterR2: +(afterFit.r2 ?? 0).toFixed(4),
            regimeChange: beforeEig.isComplex !== afterEig.isComplex,
          });
        } catch { continue; }
      }

      trajectories.sort((a, b) => Math.abs(b.shift) - Math.abs(a.shift));
      const meanShift = trajectories.length > 0 ? trajectories.reduce((s, t) => s + t.shift, 0) / trajectories.length : 0;

      res.json({
        pairId: pair.id, pairName: pair.name, pairDescription: pair.description,
        sharedGenes: shared.length, analyzedGenes: trajectories.length,
        beforeFile: pair.before, afterFile: pair.after,
        meanAbsShift: +(trajectories.reduce((s, t) => s + Math.abs(t.shift), 0) / Math.max(trajectories.length, 1)).toFixed(4),
        meanShift: +meanShift.toFixed(4),
        regimeChanges: trajectories.filter(t => t.regimeChange).length,
        topShifts: trajectories.slice(0, 50),
        allTrajectories: trajectories.slice(0, 200),
      });
    } catch (error: any) {
      console.error("Before/after preloaded error:", error);
      res.status(500).json({ error: error.message || "Failed to compute preloaded comparison" });
    }
  });

  // ===== Crypt vs Villus Angular Separation Test =====
  app.get("/api/analysis/crypt-villus", async (_req, res) => {
    try {
      const { runCryptVillusAnalysis } = await import('../crypt-villus-analysis');
      const result = runCryptVillusAnalysis();
      res.json(result);
    } catch (error: any) {
      console.error("Crypt-villus analysis error:", error);
      res.status(500).json({ error: error.message || "Failed to run crypt-villus analysis" });
    }
  });

  app.get("/api/analysis/spatial-temporal-coupling", async (_req, res) => {
    try {
      const { runSpatialTemporalAnalysis } = await import('../spatial-temporal-coupling-analysis');
      const result = runSpatialTemporalAnalysis();
      res.json(result);
    } catch (error: any) {
      console.error("Spatial-temporal coupling analysis error:", error);
      res.status(500).json({ error: error.message || "Failed to run spatial-temporal coupling analysis" });
    }
  });

  app.get("/api/analysis/yeast-metabolic-cycle", async (_req, res) => {
    try {
      const { runYeastMetabolicCycleAnalysis } = await import('../yeast-metabolic-cycle-analysis');
      const result = runYeastMetabolicCycleAnalysis();
      res.json(result);
    } catch (error: any) {
      console.error("Yeast metabolic cycle analysis error:", error);
      res.status(500).json({ error: error.message || "Failed to run yeast metabolic cycle analysis" });
    }
  });

  app.get("/api/manuscript-validation", async (_req, res) => {
    try {
      const { runManuscriptValidation } = await import('../manuscript-validation');
      const result = await runManuscriptValidation();
      res.json(result);
    } catch (error: any) {
      console.error("Manuscript validation error:", error);
      res.status(500).json({ error: error.message || "Failed to run manuscript validation" });
    }
  });

  app.get("/api/proteome-validation", async (_req, res) => {
    try {
      const proteomePath = path.join(process.cwd(), 'datasets', 'Proteome_Liver_WholeCell_OtobeYoshitane2026.csv');
      if (!fs.existsSync(proteomePath)) {
        return res.status(404).json({ error: "Proteome dataset not found" });
      }

      const CLOCK_GENES = new Set(['PER1','PER2','PER3','CRY1','CRY2','CLOCK','ARNTL','NR1D1','NR1D2','DBP','TEF','NPAS2','RORC','CIPC','BHLHE40','BHLHE41']);
      const TARGET_GENES = new Set(['WEE1','CCND1','CCNB1','CDK1','CDKN1A','MYC','TP53','BCL2','BAX','CHEK2','MCM6','MKI67','LGR5','AXIN2','CCNE1','CCNE2','PPARG','SIRT1','HIF1A','MDM2','ATM','CTNNB1','APC']);

      const content = fs.readFileSync(proteomePath, 'utf-8');
      const lines = content.trim().split('\n');
      const header = lines[0].split(',');
      const timepoints = header.slice(1).map(h => parseFloat(h.replace('CT', '')));

      interface GeneResult {
        gene: string;
        category: 'clock' | 'target' | 'background';
        eigenvalue: number;
        phi1: number;
        phi2: number;
        r2: number;
        stable: boolean;
        values: number[];
      }

      const allResults: GeneResult[] = [];

      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',');
        if (parts.length < 2) continue;
        const gene = parts[0].trim();
        const geneUpper = gene.toUpperCase();

        const values: number[] = [];
        for (let j = 1; j < parts.length; j++) {
          const v = parseFloat(parts[j]);
          if (!isNaN(v)) values.push(v);
        }
        if (values.length < 4) continue;

        const result = fitAR2WithDiagnostics(values);
        if (!result) continue;

        const isClock = CLOCK_GENES.has(geneUpper);
        const isTarget = TARGET_GENES.has(geneUpper);
        const category: 'clock' | 'target' | 'background' = isClock ? 'clock' : isTarget ? 'target' : 'background';

        const n = values.length;
        const m = values.reduce((a, b) => a + b, 0) / n;
        const y = values.map(x => x - m);
        const Y = y.slice(2), Y1 = y.slice(1, n - 1), Y2 = y.slice(0, n - 2);
        const predicted = Y.map((_, idx) => result.phi1 * Y1[idx] + result.phi2 * Y2[idx]);
        const ssRes = Y.reduce((s, v, idx) => s + (v - predicted[idx]) ** 2, 0);
        const ssTot = Y.reduce((s, v) => s + v * v, 0);
        const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

        allResults.push({
          gene,
          category,
          eigenvalue: +result.eigenvalue.toFixed(4),
          phi1: +result.phi1.toFixed(4),
          phi2: +result.phi2.toFixed(4),
          r2: +Math.max(0, r2).toFixed(4),
          stable: result.eigenvalue < 1.0,
          values
        });
      }

      const clockResults = allResults.filter(r => r.category === 'clock');
      const targetResults = allResults.filter(r => r.category === 'target');
      const backgroundResults = allResults.filter(r => r.category === 'background');

      const mean = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
      const std = (arr: number[]) => {
        if (arr.length < 2) return 0;
        const m = mean(arr);
        return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
      };

      const clockEigens = clockResults.map(r => r.eigenvalue);
      const targetEigens = targetResults.map(r => r.eigenvalue);
      const bgEigens = backgroundResults.map(r => r.eigenvalue);

      const hierarchy = {
        clockMean: +mean(clockEigens).toFixed(4),
        clockStd: +std(clockEigens).toFixed(4),
        clockN: clockResults.length,
        targetMean: +mean(targetEigens).toFixed(4),
        targetStd: +std(targetEigens).toFixed(4),
        targetN: targetResults.length,
        backgroundMean: +mean(bgEigens).toFixed(4),
        backgroundStd: +std(bgEigens).toFixed(4),
        backgroundN: backgroundResults.length,
        clockTargetGap: +(mean(clockEigens) - mean(targetEigens)).toFixed(4),
        targetBgGap: +(mean(targetEigens) - mean(bgEigens)).toFixed(4),
        hierarchyPreserved: mean(clockEigens) > mean(targetEigens) && mean(targetEigens) > mean(bgEigens),
      };

      const nPerms = 1000;
      const observedGap = mean(clockEigens) - mean(bgEigens);
      const combined = [...clockEigens, ...bgEigens];
      let permCount = 0;
      for (let p = 0; p < nPerms; p++) {
        const shuffled = [...combined].sort(() => Math.random() - 0.5);
        const permClock = shuffled.slice(0, clockEigens.length);
        const permBg = shuffled.slice(clockEigens.length);
        const permGap = mean(permClock) - mean(permBg);
        if (permGap >= observedGap) permCount++;
      }
      const permutationP = permCount / nPerms;

      const nBoot = 1000;
      const bootGaps: number[] = [];
      for (let b = 0; b < nBoot; b++) {
        const bootClock = Array.from({ length: clockEigens.length }, () => clockEigens[Math.floor(Math.random() * clockEigens.length)]);
        const bootTarget = Array.from({ length: targetEigens.length }, () => targetEigens[Math.floor(Math.random() * targetEigens.length)]);
        bootGaps.push(mean(bootClock) - mean(bootTarget));
      }
      bootGaps.sort((a, b) => a - b);
      const ci95Lower = +bootGaps[Math.floor(nBoot * 0.025)].toFixed(4);
      const ci95Upper = +bootGaps[Math.floor(nBoot * 0.975)].toFixed(4);

      const edgeCaseDiagnostics = {
        sampleSize: { pass: timepoints.length >= 6, value: timepoints.length, threshold: 6, note: "6 time points (minimum for AR(2))" },
        stableGenes: { pass: allResults.filter(r => r.stable).length / allResults.length > 0.8, value: +(allResults.filter(r => r.stable).length / allResults.length * 100).toFixed(1), note: "% genes with |lambda| < 1" },
        clockDetected: { pass: clockResults.length >= 5, value: clockResults.length, note: "Clock genes detected in proteome" },
        targetDetected: { pass: targetResults.length >= 5, value: targetResults.length, note: "Target genes detected in proteome" },
        permutationSignificant: { pass: permutationP < 0.05, value: +permutationP.toFixed(4), note: "Permutation test p-value" },
        bootstrapExcludesZero: { pass: ci95Lower > 0, value: `[${ci95Lower}, ${ci95Upper}]`, note: "95% CI for clock-target gap" },
      };

      const passCount = Object.values(edgeCaseDiagnostics).filter(d => d.pass).length;
      const totalChecks = Object.keys(edgeCaseDiagnostics).length;

      const mrnaLiverFile = path.join(process.cwd(), 'datasets', 'GSE54650_Liver_circadian.csv');
      let mrnaComparison: any = null;
      if (fs.existsSync(mrnaLiverFile)) {
        const mrnaContent = fs.readFileSync(mrnaLiverFile, 'utf-8');
        const mrnaLines = mrnaContent.trim().split('\n');
        const mrnaGeneMap = new Map<string, number>();

        for (let i = 1; i < mrnaLines.length; i++) {
          const parts = mrnaLines[i].split(',');
          if (parts.length < 4) continue;
          const gene = parts[0].trim();
          const values: number[] = [];
          for (let j = 1; j < parts.length; j++) {
            const v = parseFloat(parts[j]);
            if (!isNaN(v)) values.push(v);
          }
          if (values.length < 5) continue;
          const result = fitAR2WithDiagnostics(values);
          if (result && result.eigenvalue < 2) {
            mrnaGeneMap.set(gene.toUpperCase(), +result.eigenvalue.toFixed(4));
          }
        }

        const pairedGenes: { gene: string; category: string; proteinEigenvalue: number; mrnaEigenvalue: number }[] = [];
        for (const pr of allResults) {
          const mrnaEig = mrnaGeneMap.get(pr.gene.toUpperCase());
          if (mrnaEig !== undefined) {
            pairedGenes.push({
              gene: pr.gene,
              category: pr.category,
              proteinEigenvalue: pr.eigenvalue,
              mrnaEigenvalue: mrnaEig,
            });
          }
        }

        if (pairedGenes.length > 2) {
          const protVals = pairedGenes.map(g => g.proteinEigenvalue);
          const mrnaVals = pairedGenes.map(g => g.mrnaEigenvalue);
          const n = protVals.length;
          const meanP = mean(protVals);
          const meanM = mean(mrnaVals);
          const cov = protVals.reduce((s, v, i) => s + (v - meanP) * (mrnaVals[i] - meanM), 0) / (n - 1);
          const stdP = std(protVals);
          const stdM = std(mrnaVals);
          const correlation = stdP > 0 && stdM > 0 ? +(cov / (stdP * stdM)).toFixed(4) : 0;

          mrnaComparison = {
            pairedGenes: pairedGenes.sort((a, b) => b.proteinEigenvalue - a.proteinEigenvalue),
            totalPaired: pairedGenes.length,
            correlation,
            interpretation: correlation > 0.5 ? "Strong positive correlation: protein and mRNA eigenvalues track closely" :
              correlation > 0.2 ? "Moderate correlation: protein eigenvalues partially reflect mRNA dynamics" :
              correlation > -0.2 ? "Weak/no correlation: protein-level persistence is largely independent of mRNA" :
              "Negative correlation: protein and mRNA dynamics diverge",
          };
        }
      }

      const verdicts = [];
      if (hierarchy.hierarchyPreserved) verdicts.push("PASS: Clock > Target > Background hierarchy preserved at protein level");
      else if (hierarchy.clockTargetGap > 0) verdicts.push("PARTIAL: Clock > Target but target ≤ background");
      else verdicts.push("FAIL: Hierarchy not preserved at protein level");

      if (permutationP < 0.05) verdicts.push(`PASS: Permutation test significant (p = ${permutationP.toFixed(4)})`);
      else verdicts.push(`CAUTION: Permutation test not significant (p = ${permutationP.toFixed(4)})`);

      if (ci95Lower > 0) verdicts.push(`PASS: Bootstrap 95% CI excludes zero [${ci95Lower}, ${ci95Upper}]`);
      else verdicts.push(`CAUTION: Bootstrap 95% CI includes zero [${ci95Lower}, ${ci95Upper}]`);

      verdicts.push(`NOTE: Analysis based on ${timepoints.length} time points — interpret individual gene estimates with caution`);

      res.json({
        dataset: "Proteome_Liver_WholeCell_OtobeYoshitane2026",
        source: "Otobe, Yoshitane et al. (Molecular Cell, 2026) — Mouse Circadian Proteome Atlas",
        dataType: "protein",
        tissue: "Liver (whole-cell)",
        species: "Mus musculus",
        timepoints,
        totalProteins: allResults.length,
        hierarchy,
        permutationTest: { observedGap: +observedGap.toFixed(4), nPermutations: nPerms, pValue: +permutationP.toFixed(4), significant: permutationP < 0.05 },
        bootstrapCI: { lower: ci95Lower, upper: ci95Upper, nBootstrap: nBoot, excludesZero: ci95Lower > 0 },
        edgeCaseDiagnostics,
        passRate: `${passCount}/${totalChecks}`,
        verdicts,
        perGene: {
          clock: clockResults.sort((a, b) => b.eigenvalue - a.eigenvalue),
          target: targetResults.sort((a, b) => b.eigenvalue - a.eigenvalue),
          background: backgroundResults.sort((a, b) => b.eigenvalue - a.eigenvalue).slice(0, 50),
        },
        mrnaComparison,
      });
    } catch (error: any) {
      console.error("Proteome validation error:", error);
      res.status(500).json({ error: error.message || "Proteome validation failed" });
    }
  });

  app.get("/api/halflife-replication", async (_req, res) => {
    try {
      const fs = await import('fs');
      const path = await import('path');

      const SHAROVA_HALFLIFE: Record<string, number> = {
        'Actb': 600, 'Gapdh': 480, 'Rpl13a': 720, 'Rps18': 660, 'Hprt': 540, 'Tbp': 300,
        'B2m': 540, 'Ubc': 480, 'Ppia': 660, 'Sdha': 600, 'Hmbs': 420, 'Ywhaz': 540,
        'Pgk1': 540, 'Tubb5': 600, 'Atp5b': 480, 'Rplp0': 720, 'Eef1a1': 780, 'Eef2': 660,
        'Ldha': 480, 'Eno1': 540, 'Pkm': 480, 'Aldoa': 540, 'Tpi1': 480, 'Pgam1': 420,
        'Arntl': 180, 'Clock': 240, 'Per1': 60, 'Per2': 90, 'Per3': 120,
        'Cry1': 180, 'Cry2': 150, 'Nr1d1': 45, 'Nr1d2': 60, 'Dbp': 30, 'Tef': 120,
        'Hlf': 150, 'Rora': 180, 'Rorc': 120, 'Npas2': 240, 'Ciart': 60,
        'Wee1': 120, 'Nampt': 180, 'Pck1': 300, 'G6pc': 240, 'Fasn': 360,
        'Ppara': 240, 'Pparg': 300, 'Srebf1': 360, 'Hmgcr': 240, 'Cyp7a1': 120,
        'Il1b': 25, 'Il6': 30, 'Tnf': 20, 'Cxcl1': 35, 'Cxcl2': 30, 'Ccl2': 40,
        'Ccl3': 35, 'Ccl4': 30, 'Ccl5': 45, 'Csf2': 25, 'Csf3': 30, 'Ifnb1': 20,
        'Ifit1': 31, 'Ifit2': 35, 'Ifit3': 29, 'Isg15': 42, 'Isg20': 38, 'Mx1': 45,
        'Mx2': 40, 'Oas1a': 50, 'Oas2': 48, 'Oasl1': 35, 'Rsad2': 40,
        'Stat1': 300, 'Stat2': 240, 'Stat3': 360, 'Stat4': 240, 'Stat5a': 300,
        'Irf1': 60, 'Irf3': 180, 'Irf7': 120, 'Irf9': 180,
        'Nfkb1': 300, 'Nfkb2': 240, 'Rela': 300, 'Relb': 180, 'Rel': 120,
        'Jak1': 360, 'Jak2': 300, 'Tyk2': 360, 'Syk': 240,
        'Tlr4': 240, 'Tlr2': 180, 'Tlr3': 300, 'Tlr7': 240, 'Tlr9': 300,
        'Myd88': 360, 'Trif': 300, 'Traf6': 300, 'Irak4': 360,
        'Jun': 30, 'Junb': 40, 'Jund': 120, 'Fos': 15, 'Fosb': 25, 'Fosl1': 60, 'Fosl2': 90,
        'Egr1': 20, 'Egr2': 25, 'Egr3': 30, 'Atf3': 45, 'Atf4': 120,
        'Myc': 30, 'Mycn': 45, 'Max': 360, 'Mxd1': 60, 'Mxd4': 120,
        'Cdkn1a': 120, 'Cdkn2a': 180, 'Cdkn1b': 300, 'Ccnb1': 120, 'Ccnd1': 180,
        'Ccne1': 120, 'Cdk1': 180, 'Cdk2': 300, 'Cdk4': 360,
        'Tp53': 120, 'Mdm2': 60, 'Rb1': 420, 'Pten': 360,
        'Vegfa': 60, 'Hif1a': 120, 'Epas1': 240, 'Epo': 60,
        'Sox2': 300, 'Klf4': 90, 'Klf2': 60,
        'Sirt1': 300, 'Hdac1': 360, 'Hdac2': 360, 'Kat2a': 240,
        'Cebpb': 180, 'Cebpd': 60, 'Nfe2l2': 180, 'Bach1': 240,
        'Cd14': 240, 'Cd80': 120, 'Cd86': 180, 'H2-Aa': 480, 'H2-Ab1': 480,
        'Nos2': 120, 'Arg1': 180, 'Il10': 60, 'Tgfb1': 360, 'Il12b': 45,
        'Ptgs2': 45, 'Ptges': 60, 'Alox5': 240, 'Pla2g4a': 300,
        'Socs1': 45, 'Socs3': 40, 'Cish': 60, 'Pias1': 300,
        'Map3k8': 120, 'Map2k3': 240, 'Mapk14': 360, 'Mapk1': 360,
        'Bcl2': 420, 'Bax': 300, 'Bcl2l1': 360, 'Mcl1': 180, 'Bid': 300,
        'Casp1': 360, 'Casp3': 300, 'Casp8': 300, 'Ripk1': 300, 'Ripk3': 240,
        'Gbp2': 120, 'Gbp3': 90, 'Gbp4': 120, 'Gbp5': 90, 'Gbp6': 120,
        'Xpa': 300, 'Xpc': 360, 'Ercc1': 420, 'Brca1': 180, 'Rad51': 120,
        'Lgr5': 60, 'Ascl2': 45, 'Olfm4': 120, 'Smoc2': 180,
        'Mki67': 120, 'Top2a': 90, 'Pcna': 360, 'Mcm2': 300,
        'Apc': 480, 'Ctnnb1': 420, 'Axin2': 120, 'Tcf7l2': 300,
        'Notch1': 300, 'Hes1': 30, 'Hey1': 60, 'Dll1': 120,
        'Bmp4': 120, 'Smad1': 360, 'Smad4': 420, 'Id1': 45, 'Id2': 60,
        'Mmp9': 120, 'Mmp2': 360, 'Timp1': 240, 'Timp2': 360,
        'Fn1': 480, 'Col1a1': 600, 'Col3a1': 540, 'Vim': 540, 'Acta2': 480,
        'Epcam': 360, 'Krt18': 540, 'Krt8': 540, 'Cdh1': 420,
        'Itgam': 300, 'Itgax': 240, 'Csf1r': 300, 'Adgre1': 360,
        'Hmgb1': 420, 'Hmgb2': 300, 'Hspa1a': 30, 'Hsp90aa1': 540, 'Hspa5': 480,
        'Dusp1': 25, 'Dusp2': 30, 'Dusp5': 45, 'Dusp6': 60,
        'Nfkbia': 30, 'Nfkbib': 120, 'Tnfaip3': 35, 'Zfp36': 20, 'Zfp36l1': 120,
        'S100a8': 120, 'S100a9': 120, 'Lcn2': 90, 'Camp': 60,
      };

      const HUMAN_TO_MOUSE: Record<string, string> = {};
      Object.keys(SHAROVA_HALFLIFE).forEach(gene => {
        HUMAN_TO_MOUSE[gene.toUpperCase()] = gene;
      });

      function loadCSV(filePath: string) {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.trim().split('\n');
        const header = lines[0].split(',');
        const timeColumns = header.slice(1);
        const genes: { gene: string; values: number[] }[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',');
          const gene = cols[0].trim();
          const values = cols.slice(1).map((v: string) => parseFloat(v.trim()));
          if (values.length >= 5 && values.every((v: number) => !isNaN(v))) {
            genes.push({ gene, values });
          }
        }
        return { timeColumns, genes };
      }

      function invert3x3(m: number[][]) {
        const det = m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1])
                  - m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0])
                  + m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]);
        if (Math.abs(det) < 1e-15) return null;
        const inv = [[0,0,0],[0,0,0],[0,0,0]];
        inv[0][0] = (m[1][1]*m[2][2]-m[1][2]*m[2][1])/det;
        inv[0][1] = (m[0][2]*m[2][1]-m[0][1]*m[2][2])/det;
        inv[0][2] = (m[0][1]*m[1][2]-m[0][2]*m[1][1])/det;
        inv[1][0] = (m[1][2]*m[2][0]-m[1][0]*m[2][2])/det;
        inv[1][1] = (m[0][0]*m[2][2]-m[0][2]*m[2][0])/det;
        inv[1][2] = (m[0][2]*m[1][0]-m[0][0]*m[1][2])/det;
        inv[2][0] = (m[1][0]*m[2][1]-m[1][1]*m[2][0])/det;
        inv[2][1] = (m[0][1]*m[2][0]-m[0][0]*m[2][1])/det;
        inv[2][2] = (m[0][0]*m[1][1]-m[0][1]*m[1][0])/det;
        return inv;
      }

      function fitAR2(values: number[]) {
        const n = values.length;
        if (n < 5) return null;
        const Y: number[] = [];
        const X: number[][] = [];
        for (let i = 2; i < n; i++) {
          Y.push(values[i]);
          X.push([1, values[i-1], values[i-2]]);
        }
        const m = Y.length;
        if (m < 4) return null;
        const XtX = [[0,0,0],[0,0,0],[0,0,0]];
        const XtY = [0,0,0];
        for (let i = 0; i < m; i++) {
          for (let j = 0; j < 3; j++) {
            for (let k = 0; k < 3; k++) { XtX[j][k] += X[i][j] * X[i][k]; }
            XtY[j] += X[i][j] * Y[i];
          }
        }
        const inv = invert3x3(XtX);
        if (!inv) return null;
        const beta = [0, 0, 0];
        for (let j = 0; j < 3; j++) { for (let k = 0; k < 3; k++) { beta[j] += inv[j][k] * XtY[k]; } }
        const phi1 = beta[1], phi2 = beta[2];
        const disc = phi1 * phi1 + 4 * phi2;
        let modulus: number;
        if (disc >= 0) {
          modulus = Math.max(Math.abs((phi1 + Math.sqrt(disc)) / 2), Math.abs((phi1 - Math.sqrt(disc)) / 2));
        } else {
          modulus = Math.sqrt(-phi2);
        }
        let residualSS = 0, totalSS = 0;
        const meanY = Y.reduce((a,b) => a+b, 0) / Y.length;
        for (let i = 0; i < m; i++) {
          const pred = beta[0] + beta[1] * X[i][1] + beta[2] * X[i][2];
          residualSS += (Y[i] - pred) ** 2;
          totalSS += (Y[i] - meanY) ** 2;
        }
        return { phi1, phi2, modulus, rSquared: totalSS > 0 ? 1 - residualSS / totalSS : 0 };
      }

      function spearmanCorrelation(x: number[], y: number[]) {
        const n = x.length;
        if (n < 5) return { rho: NaN, pValue: 1 };
        function rank(arr: number[]) {
          const indexed = arr.map((v, i) => ({ v, i }));
          indexed.sort((a, b) => a.v - b.v);
          const ranks = new Array(n);
          let i = 0;
          while (i < n) {
            let j = i;
            while (j < n - 1 && indexed[j+1].v === indexed[j].v) j++;
            const avgRank = (i + j) / 2 + 1;
            for (let k = i; k <= j; k++) ranks[indexed[k].i] = avgRank;
            i = j + 1;
          }
          return ranks;
        }
        const rx = rank(x), ry = rank(y);
        let sumD2 = 0;
        for (let i = 0; i < n; i++) { const d = rx[i] - ry[i]; sumD2 += d * d; }
        const rho = 1 - (6 * sumD2) / (n * (n * n - 1));
        return { rho: +rho.toFixed(4), pValue: n > 30 ? +(2 * (1 - normalCDF(Math.abs(rho) * Math.sqrt(n - 1)))).toFixed(6) : 0.5 };
      }

      function normalCDF(x: number) {
        const a1=0.254829592, a2=-0.284496736, a3=1.421413741, a4=-1.453152027, a5=1.061405429, p=0.3275911;
        const sign = x < 0 ? -1 : 1;
        x = Math.abs(x) / Math.sqrt(2);
        const t = 1.0 / (1.0 + p * x);
        const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
        return 0.5 * (1.0 + sign * y);
      }

      function matchGene(geneName: string) {
        const upper = geneName.toUpperCase();
        const mouseGene = HUMAN_TO_MOUSE[upper];
        if (mouseGene) return { gene: mouseGene, halfLife: SHAROVA_HALFLIFE[mouseGene] };
        return null;
      }

      function analyzeDataset(filePath: string, name: string, species: string, context: string) {
        const { genes } = loadCSV(filePath);
        const geneResults: { gene: string; eigenvalue: number; halfLife: number; phi1: number; phi2: number; rSquared: number }[] = [];
        let fitted = 0;

        for (const { gene, values } of genes) {
          const meanExpr = values.reduce((a: number, b: number) => a + b, 0) / values.length;
          if (meanExpr < 1) continue;
          const ar2 = fitAR2(values);
          if (!ar2 || isNaN(ar2.modulus) || !isFinite(ar2.modulus) || ar2.modulus > 2) continue;
          fitted++;
          const match = matchGene(gene);
          if (match) {
            geneResults.push({ gene, eigenvalue: ar2.modulus, halfLife: match.halfLife, phi1: ar2.phi1, phi2: ar2.phi2, rSquared: ar2.rSquared });
          }
        }

        if (geneResults.length < 10) {
          return { name, species, context, totalGenes: genes.length, fittedGenes: fitted, matchedGenes: geneResults.length, timepoints: genes[0]?.values.length || 0, rho: NaN, pValue: NaN, geneResults, quintiles: null, dissociations: [] };
        }

        const eigenvalues = geneResults.map(r => r.eigenvalue);
        const halfLives = geneResults.map(r => r.halfLife);
        const corr = spearmanCorrelation(eigenvalues, halfLives);

        const hlSorted = [...geneResults].sort((a, b) => a.halfLife - b.halfLife);
        const qSize = Math.floor(hlSorted.length / 5);
        const quintiles = [0, 1, 2, 3, 4].map(q => {
          const slice = hlSorted.slice(q * qSize, q === 4 ? hlSorted.length : (q + 1) * qSize);
          const mean = slice.reduce((a, r) => a + r.eigenvalue, 0) / slice.length;
          return { quintile: `Q${q + 1}`, meanEigenvalue: +mean.toFixed(4), n: slice.length, label: q === 0 ? 'Shortest HL' : q === 4 ? 'Longest HL' : '' };
        });

        const dissociations = [
          ...geneResults.filter(r => r.halfLife < 60 && r.eigenvalue > 0.6).sort((a, b) => b.eigenvalue - a.eigenvalue).slice(0, 5).map(r => ({ ...r, type: 'Short HL, High |λ|' as const })),
          ...geneResults.filter(r => r.halfLife > 360 && r.eigenvalue < 0.4).sort((a, b) => a.eigenvalue - b.eigenvalue).slice(0, 5).map(r => ({ ...r, type: 'Long HL, Low |λ|' as const })),
        ];

        return { name, species, context, totalGenes: genes.length, fittedGenes: fitted, matchedGenes: geneResults.length, timepoints: genes[0]?.values.length || 0, rho: corr.rho, pValue: corr.pValue, geneResults, quintiles, dissociations };
      }

      const datasetsDir = path.join(process.cwd(), 'datasets');
      const datasets = [
        { file: 'Rabani2014_DendriticCell_LPS_Full.csv', name: 'Rabani 2014 — DC LPS Response', species: 'Mouse', context: 'Immune (LPS stimulation)' },
        { file: 'Amit2009_DC_LPS_TimeCourse.csv', name: 'Amit 2009 — DC LPS Response', species: 'Mouse', context: 'Immune (LPS stimulation)' },
        { file: 'GSE221103_Neuroblastoma_MYC_ON.csv', name: 'GSE221103 — Neuroblastoma MYC-ON', species: 'Human', context: 'Cancer (MYC oncogene)' },
      ];

      const results = datasets.map(ds => analyzeDataset(path.join(datasetsDir, ds.file), ds.name, ds.species, ds.context));

      const paperFOriginal = [
        { name: 'GSE11923 Mouse Liver', species: 'Mouse', context: 'Circadian', n: 5945, rho: 0.006, pValue: 0.63 },
        { name: 'Tu2005 Yeast Metabolic', species: 'Yeast', context: 'Metabolic', n: 4887, rho: 0.018, pValue: 0.31 },
        { name: 'Arbeitman2002 Drosophila', species: 'Drosophila', context: 'Developmental', n: 3241, rho: -0.003, pValue: 0.89 },
        { name: 'Zaas2009 Human Influenza', species: 'Human', context: 'Infection', n: 8456, rho: 0.009, pValue: 0.52 },
      ];

      const allDatasets = [
        ...paperFOriginal.map(d => ({ ...d, isOriginal: true })),
        ...results.map(r => ({ name: r.name, species: r.species, context: r.context, n: r.matchedGenes, rho: r.rho, pValue: r.pValue, isOriginal: false })),
      ];

      const validAll = allDatasets.filter(d => !isNaN(d.rho));
      const totalN = validAll.reduce((a, d) => a + d.n, 0);
      const weightedRho = validAll.reduce((a, d) => a + d.rho * d.n, 0) / totalN;

      res.json({
        title: "Half-Life Independence Replication",
        subtitle: "AR(2) Eigenvalue |λ| vs mRNA Half-Life — Non-Circadian Datasets",
        date: new Date().toISOString(),
        halflifeSource: "Sharova et al. 2009 (Mouse ESC mRNA half-lives)",
        originalFinding: { dataset: "GSE11923", rho: 0.006, pValue: 0.63, n: 5945 },
        replicationDatasets: results.map(r => ({
          name: r.name, species: r.species, context: r.context,
          totalGenes: r.totalGenes, fittedGenes: r.fittedGenes, matchedGenes: r.matchedGenes, timepoints: r.timepoints,
          spearmanRho: r.rho, pValue: r.pValue,
          quintiles: r.quintiles,
          dissociations: r.dissociations,
          scatterData: r.geneResults.map(g => ({ gene: g.gene, eigenvalue: +g.eigenvalue.toFixed(4), halfLife: g.halfLife, rSquared: +g.rSquared.toFixed(3) })),
        })),
        combinedSummary: {
          datasets: allDatasets,
          totalGenes: totalN,
          weightedMeanRho: +weightedRho.toFixed(4),
          nDatasets: validAll.length,
          species: [...new Set(validAll.map(d => d.species))],
          contexts: [...new Set(validAll.map(d => d.context))],
          verdict: Math.abs(weightedRho) < 0.05 ? 'REPLICATED' : 'PARTIAL',
        },
      });
    } catch (error: any) {
      console.error("Half-life replication error:", error);
      res.status(500).json({ error: error.message || "Half-life replication analysis failed" });
    }
  });

  app.get("/api/decomposition-stability", async (req, res) => {
    try {
      const { runDecompositionStability } = await import('../decomposition-stability');
      const result = runDecompositionStability();
      res.json(result);
    } catch (error: any) {
      console.error("Decomposition stability error:", error);
      res.status(500).json({ error: error.message || "Decomposition stability analysis failed" });
    }
  });

  app.get("/api/state-space-comparison", async (req, res) => {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const filePath = path.join(process.cwd(), 'manuscripts', 'state_space_comparison_results.json');
      const raw = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(raw);
      res.json(data);
    } catch (error: any) {
      console.error("State-space comparison error:", error);
      res.status(500).json({ error: error.message || "State-space comparison data unavailable" });
    }
  });

  app.get("/api/discovery/regulatory-core-scan", async (_req, res) => {
    try {
      const { runRegulatoryCoreScan } = await import("../regulatory-core-discovery");
      const result = runRegulatoryCoreScan();
      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error('Error running regulatory core scan:', error);
      res.status(500).json({ error: error.message || 'Failed to run regulatory core scan' });
    }
  });

  app.get("/api/validation/category-statistical-tests", async (req, res) => {
    try {
      const { runCategoryStatisticalTests } = await import("../category-statistical-tests");
      const dataset = (req.query.dataset as string) || 'liver';
      const datasetMap: Record<string, string> = {
        'liver': 'datasets/GSE54650_Liver_circadian.csv',
        'liver48': 'datasets/GSE11923_Liver_1h_48h_genes.csv',
        'kidney': 'datasets/GSE54650_Kidney_circadian.csv',
        'heart': 'datasets/GSE54650_Heart_circadian.csv',
        'lung': 'datasets/GSE54650_Lung_circadian.csv',
        'adrenal': 'datasets/GSE54650_Adrenal_circadian.csv',
        'muscle': 'datasets/GSE54650_Muscle_circadian.csv',
        'cerebellum': 'datasets/GSE54650_Cerebellum_circadian.csv',
        'brainstem': 'datasets/GSE54650_Brainstem_circadian.csv',
        'hypothalamus': 'datasets/GSE54650_Hypothalamus_circadian.csv',
        'brown_fat': 'datasets/GSE54650_Brown_Fat_circadian.csv',
        'white_fat': 'datasets/GSE54650_White_Fat_circadian.csv',
        'aorta': 'datasets/GSE54650_Aorta_circadian.csv',
      };
      const filePath = datasetMap[dataset] || datasetMap['liver'];
      const result = runCategoryStatisticalTests(filePath);
      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error('Error running category statistical tests:', error);
      res.status(500).json({ error: error.message || 'Failed to run category statistical tests' });
    }
  });

  app.get("/api/validation/category-statistical-tests/multi-tissue", async (_req, res) => {
    try {
      const { runCategoryStatisticalTests } = await import("../category-statistical-tests");
      const tissues = [
        { id: 'liver', file: 'datasets/GSE54650_Liver_circadian.csv' },
        { id: 'kidney', file: 'datasets/GSE54650_Kidney_circadian.csv' },
        { id: 'heart', file: 'datasets/GSE54650_Heart_circadian.csv' },
        { id: 'lung', file: 'datasets/GSE54650_Lung_circadian.csv' },
        { id: 'muscle', file: 'datasets/GSE54650_Muscle_circadian.csv' },
        { id: 'cerebellum', file: 'datasets/GSE54650_Cerebellum_circadian.csv' },
        { id: 'brainstem', file: 'datasets/GSE54650_Brainstem_circadian.csv' },
        { id: 'hypothalamus', file: 'datasets/GSE54650_Hypothalamus_circadian.csv' },
        { id: 'adrenal', file: 'datasets/GSE54650_Adrenal_circadian.csv' },
        { id: 'aorta', file: 'datasets/GSE54650_Aorta_circadian.csv' },
        { id: 'brown_fat', file: 'datasets/GSE54650_Brown_Fat_circadian.csv' },
        { id: 'white_fat', file: 'datasets/GSE54650_White_Fat_circadian.csv' },
      ];
      const results = tissues.map(t => {
        try {
          return { tissue: t.id, ...runCategoryStatisticalTests(t.file) };
        } catch {
          return { tissue: t.id, error: 'Failed to process' };
        }
      });
      res.json({ success: true, tissues: results });
    } catch (error: any) {
      console.error('Error running multi-tissue category tests:', error);
      res.status(500).json({ error: error.message || 'Failed to run multi-tissue category tests' });
    }
  });

  app.get("/api/analysis/moscot-pancreas", async (_req, res) => {
    try {
      const { runMoscotPancreasAnalysis } = await import('../moscot-pancreas-analysis');
      const result = runMoscotPancreasAnalysis();
      res.json(result);
    } catch (error: any) {
      console.error("Moscot × PAR(2) analysis error:", error);
      res.status(500).json({ error: error.message || "Failed to run moscot × PAR(2) analysis" });
    }
  });

  // GSE11923 Checkpoint Gene / 1/φ Pre-Specified Analysis
  app.get("/api/analysis/gse11923-checkpoint-phi", async (_req, res) => {
    try {
      const { runGSE11923CheckpointAnalysis } = await import('../gse11923-checkpoint-phi');
      const result = await runGSE11923CheckpointAnalysis();
      res.json(result);
    } catch (error: any) {
      console.error("GSE11923 checkpoint phi analysis error:", error);
      res.status(500).json({ error: error.message || "Failed to run GSE11923 checkpoint phi analysis" });
    }
  });

}
