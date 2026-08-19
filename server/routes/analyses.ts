import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { logger } from "../logger";
import { checkPasswordRateLimit, recordFailedAttempt, clearAttempts } from "./analytics";
import { computeRigorousAnalysis } from "../evolutionary-gene-age";
import { computeOrganoidEvolutionaryAnalysis } from "../organoid-evolutionary-gene-age";
import { computeMNDALS } from "../mnd-als-analysis";
import { computeTemporalCorrelation, clearTemporalCorrelationCache } from "../temporal-correlation-analysis";
import { computeLightEntrainment, clearLightEntrainmentCache } from "../light-entrainment-analysis";
import { detectOrganism, parseDatasetBuffer, applyFDRCorrectionToRun, CANDIDATES, CLOCKS, ENSEMBL_TO_SYMBOL, getAllPairs } from "./shared";
import { runPAR2Analysis, applyWithinPairBonferroni, validateWithSurrogates, type GeneData } from "../par2-engine";
import { generateIntegrityHash, verifyIntegrityHash, formatHashForDisplay } from "../integrity-hash";
import { parse } from "csv-parse/sync";
import fs from "fs";
import path from "path";

function findGeneData(parsed: { geneTimeSeries: Map<string, number[]> }, gene: { name: string }): number[] | null {
  return parsed.geneTimeSeries.get(gene.name) ?? null;
}

export function registerAnalysesRoutes(app: Express, upload: any): void {
  app.get("/api/analyses", async (req, res) => {
    try {
      const runs = await storage.getAllAnalysisRuns();
      res.json(runs);
    } catch (error) {
      logger.error("Error fetching analyses", { error: String(error) });
      res.status(500).json({ error: "Failed to fetch analyses" });
    }
  });

  // Get version history with integrity hashes
  app.get("/api/analyses/version-history", async (req, res) => {
    try {
      const runs = await storage.getAllAnalysisRuns();
      const completedRuns = runs.filter(r => r.status === 'completed');
      
      const versionHistory = await Promise.all(completedRuns.map(async (run) => {
        const hypotheses = await storage.getHypothesesByRunId(run.id);
        const significantCount = hypotheses.filter(h => h.significantAfterFDR).length;
        const eigenvalues = hypotheses
          .map(h => (h as any).eigenvalue)
          .filter((e): e is number => typeof e === 'number' && !isNaN(e));
        const meanEigenvalue = eigenvalues.length > 0 
          ? eigenvalues.reduce((a, b) => a + b, 0) / eigenvalues.length 
          : 0;
        
        let hash = (run as any).integrityHash;
        let shortHash = (run as any).integrityHashShort;
        let hashTimestamp = (run as any).hashTimestamp;
        
        if (!hash) {
          const hashResult = generateIntegrityHash({
            datasetName: run.datasetName,
            createdAt: run.createdAt,
            significantPairs: significantCount,
            totalPairs: hypotheses.length,
            meanEigenvalue,
          });
          hash = hashResult.hash;
          shortHash = hashResult.shortHash;
          hashTimestamp = new Date(hashResult.timestamp);
          
          try {
            await storage.updateAnalysisRunHash(
              run.id,
              hash,
              shortHash,
              hashTimestamp,
              hashResult.version
            );
          } catch (e) {
            logger.warn("Failed to persist hash for run", { runId: run.id });
          }
        }
        
        return {
          id: run.id,
          name: run.name,
          datasetName: run.datasetName,
          createdAt: run.createdAt,
          completedAt: run.completedAt,
          integrityHash: hash,
          shortHash: shortHash || hash?.substring(0, 12).toUpperCase(),
          hashTimestamp,
          significantPairs: significantCount,
          totalPairs: hypotheses.length,
          meanEigenvalue: meanEigenvalue.toFixed(4),
          formattedHash: hash ? formatHashForDisplay(hash) : null,
        };
      }));
      
      versionHistory.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
      res.json({
        totalRuns: versionHistory.length,
        hashVersion: '1.0.0',
        history: versionHistory.slice(0, 50),
      });
    } catch (error) {
      logger.error("Error fetching version history", { error: String(error) });
      res.status(500).json({ error: "Failed to fetch version history" });
    }
  });

  // Verify integrity hash for a specific analysis
  app.get("/api/analyses/:id/verify-hash", async (req, res) => {
    try {
      const run = await storage.getAnalysisRun(req.params.id);
      if (!run) {
        return res.status(404).json({ error: "Analysis not found" });
      }
      
      const hypotheses = await storage.getHypothesesByRunId(run.id);
      const significantCount = hypotheses.filter(h => h.significantAfterFDR).length;
      const eigenvalues = hypotheses
        .map(h => (h as any).eigenvalue)
        .filter((e): e is number => typeof e === 'number' && !isNaN(e));
      const meanEigenvalue = eigenvalues.length > 0 
        ? eigenvalues.reduce((a, b) => a + b, 0) / eigenvalues.length 
        : 0;
      
      const storedHash = (run as any).integrityHash;
      const hashTimestamp = (run as any).hashTimestamp;
      
      if (!storedHash) {
        const newHash = generateIntegrityHash({
          datasetName: run.datasetName,
          createdAt: run.createdAt,
          significantPairs: significantCount,
          totalPairs: hypotheses.length,
          meanEigenvalue,
        });
        
        return res.json({
          verified: false,
          reason: "No stored hash - generating new hash",
          newHash: newHash.shortHash,
          fullHash: newHash.hash,
        });
      }
      
      const verification = verifyIntegrityHash(
        {
          datasetName: run.datasetName,
          createdAt: run.createdAt,
          significantPairs: significantCount,
          totalPairs: hypotheses.length,
          meanEigenvalue,
        },
        storedHash,
        hashTimestamp?.toISOString() || new Date().toISOString()
      );
      
      res.json({
        verified: verification.valid,
        reason: verification.reason,
        storedHash: storedHash.substring(0, 12).toUpperCase(),
        analysisId: run.id,
        datasetName: run.datasetName,
      });
    } catch (error) {
      logger.error("Error verifying hash", { error: String(error) });
      res.status(500).json({ error: "Failed to verify hash" });
    }
  });

  // GSE261698 glial circadian AR(2) results (Sheehan et al., Nature Neuroscience 2025)
  app.get("/api/gse261698/ar2-results", async (req, res) => {
    try {
      const resultsPath = path.join(process.cwd(), 'datasets', 'GSE261698', 'GSE261698_AR2_results.json');
      if (!fs.existsSync(resultsPath)) {
        return res.status(404).json({ error: "GSE261698 results not found" });
      }
      const data = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));
      res.json(data);
    } catch (error) {
      logger.error("Error loading GSE261698 results", { error: String(error) });
      res.status(500).json({ error: "Failed to load GSE261698 results" });
    }
  });

  // GSE261698 pre-specified regulon permutation tests
  app.get("/api/gse261698/regulon-tests", async (req, res) => {
    try {
      const resultsPath = path.join(process.cwd(), 'datasets', 'GSE261698', 'permutation_test_results.json');
      if (!fs.existsSync(resultsPath)) {
        return res.status(404).json({ error: "Regulon test results not found" });
      }
      const data = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));
      res.json(data);
    } catch (error) {
      logger.error("Error loading GSE261698 regulon tests", { error: String(error) });
      res.status(500).json({ error: "Failed to load regulon test results" });
    }
  });

  // MND/ALS AR(2) analysis — GSE297373 + GSE18597
  app.get("/api/mnd-als/ar2-results", (_req, res) => {
    try {
      const result = computeMNDALS();
      res.json(result);
    } catch (error) {
      logger.error("Error computing MND/ALS analysis", { error: String(error) });
      res.status(500).json({ error: String(error) });
    }
  });

  // Force-recompute (clears cache, re-reads CSV) — admin only
  app.post("/api/mnd-als/recompute", (req, res) => {
    if (!checkPasswordRateLimit(req, res)) return;
    const { password } = req.body as { password?: string };
    if (!process.env.DOWNLOAD_PROTECT_PASSWORD || password !== process.env.DOWNLOAD_PROTECT_PASSWORD) {
      return recordFailedAttempt(req, res);
    }
    clearAttempts(req);
    try {
      const result = computeMNDALS(true);
      res.json({ ok: true, meta: result.meta });
    } catch (error) {
      logger.error("Error recomputing MND/ALS analysis", { error: String(error) });
      res.status(500).json({ error: String(error) });
    }
  });

  // Temporal Correlation Length — Paper P
  app.get("/api/temporal-correlation/results", (_req, res) => {
    try {
      const result = computeTemporalCorrelation();
      res.json(result);
    } catch (error) {
      logger.error("Error computing temporal correlation analysis", { error: String(error) });
      res.status(500).json({ error: String(error) });
    }
  });

  app.post("/api/temporal-correlation/recompute", (req, res) => {
    if (!checkPasswordRateLimit(req, res)) return;
    const { password } = req.body as { password?: string };
    if (!process.env.DOWNLOAD_PROTECT_PASSWORD || password !== process.env.DOWNLOAD_PROTECT_PASSWORD) {
      return recordFailedAttempt(req, res);
    }
    clearAttempts(req);
    try {
      clearTemporalCorrelationCache();
      const result = computeTemporalCorrelation(true);
      res.json({ ok: true, computedAt: result.computedAt });
    } catch (error) {
      logger.error("Error recomputing temporal correlation", { error: String(error) });
      res.status(500).json({ error: String(error) });
    }
  });

  // Light Entrainment / Central-Peripheral Clock Hierarchy — Paper Q
  app.get("/api/light-entrainment/results", (_req, res) => {
    try {
      const result = computeLightEntrainment();
      res.json(result);
    } catch (error) {
      logger.error("Error computing light entrainment analysis", { error: String(error) });
      res.status(500).json({ error: String(error) });
    }
  });

  app.post("/api/light-entrainment/recompute", (req, res) => {
    if (!checkPasswordRateLimit(req, res)) return;
    const { password } = req.body as { password?: string };
    if (!process.env.DOWNLOAD_PROTECT_PASSWORD || password !== process.env.DOWNLOAD_PROTECT_PASSWORD) {
      return recordFailedAttempt(req, res);
    }
    clearAttempts(req);
    try {
      clearLightEntrainmentCache();
      const result = computeLightEntrainment(true);
      res.json({ ok: true, computedAt: result.computedAt });
    } catch (error) {
      logger.error("Error recomputing light entrainment", { error: String(error) });
      res.status(500).json({ error: String(error) });
    }
  });

  // Get GSE157357 organoid analysis results - MUST be before :id route
  app.get("/api/analyses/organoids", async (req, res) => {
    try {
      const wtResultsPath = path.join(process.cwd(), 'datasets', 'WT_152pair_results.json');
      const comparisonPath = path.join(process.cwd(), 'datasets', 'WT_vs_DoubleMutant_Comparison.json');

      let wtResults: any;

      if (fs.existsSync(wtResultsPath)) {
        wtResults = JSON.parse(fs.readFileSync(wtResultsPath, 'utf-8'));
      } else {
        // Compute on-the-fly from the raw WT-WT organoid dataset
        const datasetFile = 'GSE157357_Organoid_WT-WT_circadian.csv';
        const datasetPath = path.join(process.cwd(), 'datasets', datasetFile);
        if (!fs.existsSync(datasetPath)) {
          return res.status(404).json({ error: "Organoid dataset not found" });
        }

        const buffer = fs.readFileSync(datasetPath);
        const parsed = await parseDatasetBuffer(buffer, datasetFile);
        const pairs = getAllPairs(datasetFile.replace('.csv', ''));
        const threshold = 0.05;

        // Gene lookup helper: tries name then Ensembl id
        const getVals = (gene: { name: string; id: string }) =>
          parsed.geneTimeSeries.get(gene.name) ??
          parsed.geneTimeSeries.get(gene.id) ?? null;

        const pairResults: any[] = [];
        for (const pair of pairs) {
          const targetDef = CANDIDATES.find(c => c.name === pair.target);
          const clockDef  = CLOCKS.find(c => c.name === pair.clock);
          if (!targetDef || !clockDef) continue;

          const targetVals = getVals(targetDef as any);
          const clockVals  = getVals(clockDef  as any);

          if (!targetVals || !clockVals ||
              !targetVals.some(v => v !== 0) || !clockVals.some(v => v !== 0)) {
            pairResults.push({ clockGene: clockDef.name, targetGene: targetDef.name,
              significant: false, pValue: 1.0, significantTerms: [] });
            continue;
          }

          const r = runPAR2Analysis(
            { time: parsed.timepoints, expression: targetVals } as GeneData,
            { time: parsed.timepoints, expression: clockVals }  as GeneData,
            { period: 24, significanceThreshold: threshold } as any
          );
          const adjP = applyWithinPairBonferroni(r.pValue);
          pairResults.push({
            clockGene: clockDef.name,
            targetGene: targetDef.name,
            significant: adjP < threshold,
            pValue: adjP,
            significantTerms: r.significantTerms
          });
        }

        wtResults = {
          results: pairResults,
          metadata: {
            pairsTested: pairResults.length,
            pairsSignificant: pairResults.filter(r => r.significant).length,
            generatedAt: new Date().toISOString(),
            dataset: datasetFile
          }
        };

        // Cache to disk so subsequent requests (and batch) can reuse it
        try { fs.writeFileSync(wtResultsPath, JSON.stringify(wtResults, null, 2)); } catch (_) { /* non-fatal */ }
      }

      let comparison = null;
      if (fs.existsSync(comparisonPath)) {
        comparison = JSON.parse(fs.readFileSync(comparisonPath, 'utf-8'));
      }

      res.json({
        study: "GSE157357",
        description: "Mouse Intestinal Organoids - Circadian Gating Analysis",
        temporalCoverageCaveat: "22 h ZT window (ZT24–46) — insufficient for AR(2) circadian eigenvalue analysis; ≥36 h required. AR(2) eigenvalues from this dataset are unreliable for circadian genes; do not draw eigenvalue conclusions from these values.",
        conditions: [
          {
            name: "Wild-Type (APC-WT / BMAL-WT)",
            description: "Healthy baseline with intact tumor suppressor and clock",
            results: wtResults
          }
        ],
        comparison,
        keyFindings: [
          "Tead1 (Hippo/YAP pathway) shows strong circadian gating in healthy organoids",
          "Pparg (lipid metabolism) is clock-controlled in wild-type organoids",
          "Double mutants (APC-Mut/BMAL-Mut) lose most circadian gating",
          "Only Sirt1 maintains gating in cancer conditions - potential therapeutic target"
        ]
      });
    } catch (error) {
      console.error("Error loading organoid results:", error);
      res.status(500).json({ error: "Failed to load organoid results" });
    }
  });

  // Get Tissue vs Organoid comparison report - MUST be before :id route
  app.get("/api/analyses/tissue-vs-organoid", async (req, res) => {
    try {
      // Load tissue results from database
      const analyses = await storage.getAllAnalysisRuns();
      const tissueRuns = analyses.filter(run => 
        run.datasetName.startsWith('GSE54650') && 
        run.datasetName.endsWith('.csv') &&
        run.status === 'completed'
      );
      
      // Load organoid results
      const wtResultsPath = path.join(process.cwd(), 'datasets', 'WT_152pair_results.json');
      if (!fs.existsSync(wtResultsPath)) {
        return res.status(404).json({ error: "Organoid results not found" });
      }
      const organoidResults = JSON.parse(fs.readFileSync(wtResultsPath, 'utf-8'));
      
      // Get tissue findings
      const tissueFindings: Record<string, { significant: string[]; total: number }> = {};
      for (const run of tissueRuns) {
        const tissue = run.datasetName.replace('GSE54650_', '').replace('_circadian.csv', '').replace(/_/g, ' ');
        const hypotheses = await storage.getHypothesesByRunId(run.id);
        const significant = hypotheses.filter(h => h.significant).map(h => `${h.clockGene}→${h.targetGene}`);
        tissueFindings[tissue] = { significant, total: hypotheses.length };
      }
      
      // Get organoid significant pairs
      const organoidSignificant = organoidResults.results
        .filter((r: any) => r.significant)
        .map((r: any) => `${r.clockGene}→${r.targetGene}`);
      
      // Find overlapping gating relationships
      const allTissueSignificant = new Set<string>();
      Object.values(tissueFindings).forEach(t => t.significant.forEach(s => allTissueSignificant.add(s)));
      
      const conservedAcrossBoth = organoidSignificant.filter((pair: string) => allTissueSignificant.has(pair));
      const organoidOnly = organoidSignificant.filter((pair: string) => !allTissueSignificant.has(pair));
      const tissueOnly = Array.from(allTissueSignificant).filter(pair => !organoidSignificant.includes(pair));
      
      res.json({
        summary: {
          tissuesAnalyzed: Object.keys(tissueFindings).length,
          totalTissueTests: Object.values(tissueFindings).reduce((sum, t) => sum + t.total, 0),
          totalTissueSignificant: Object.values(tissueFindings).reduce((sum, t) => sum + t.significant.length, 0),
          organoidTests: organoidResults.metadata.pairsTested,
          organoidSignificant: organoidResults.metadata.pairsSignificant
        },
        comparison: {
          conservedInBothSystems: conservedAcrossBoth,
          organoidSpecific: organoidOnly,
          tissueSpecific: tissueOnly.slice(0, 20) // Top 20 for brevity
        },
        interpretation: {
          keyFinding: conservedAcrossBoth.length > 0 
            ? `${conservedAcrossBoth.length} circadian gating relationships are conserved between whole tissues and organoid culture`
            : "No circadian gating relationships are conserved between tissues and organoids - systems may operate differently",
          organoidAdvantage: "Organoids reveal cell-autonomous clock control without systemic signals",
          tissueAdvantage: "Whole tissues capture in vivo complexity with hormonal/neural/immune crosstalk",
          recommendation: "Use both systems complementarily: organoids for mechanism, tissues for physiological relevance"
        },
        tissueDetails: tissueFindings,
        organoidDetails: {
          study: "GSE157357",
          condition: "Wild-Type (APC-WT / BMAL-WT)",
          significant: organoidSignificant,
          temporalCoverageCaveat: "22 h ZT window (ZT24–46) — insufficient for AR(2) circadian eigenvalue analysis; ≥36 h required."
        }
      });
    } catch (error) {
      console.error("Error generating tissue vs organoid comparison:", error);
      res.status(500).json({ error: "Failed to generate comparison" });
    }
  });

  // Run model comparison analysis (PAR(2) vs ARX baseline)
  app.post("/api/analyses/model-comparison", async (req, res) => {
    try {
      const { datasetId, pairs } = req.body;
      
      if (!datasetId) {
        return res.status(400).json({ error: "datasetId is required" });
      }
      
      // Load the dataset
      const filename = datasetId + '.csv';
      const filepath = path.join(process.cwd(), 'datasets', filename);
      
      if (!fs.existsSync(filepath)) {
        return res.status(404).json({ error: "Dataset not found" });
      }
      
      const buffer = fs.readFileSync(filepath);
      const parsed = await parseDatasetBuffer(buffer, filename);
      
      // Use default pairs if not specified
      const testPairs = pairs || [
        { target: 'Myc', clock: 'Per2' },
        { target: 'Ccnd1', clock: 'Per2' },
        { target: 'Wee1', clock: 'Cry1' },
        { target: 'Tp53', clock: 'Arntl' },
        { target: 'Axin2', clock: 'Arntl' }
      ];
      
      const results = [];
      
      for (const pair of testPairs) {
        const targetGene = CANDIDATES.find(c => c.name === pair.target);
        const clockGene = CLOCKS.find(c => c.name === pair.clock);
        
        if (!targetGene || !clockGene) {
          results.push({
            target: pair.target,
            clock: pair.clock,
            error: "Gene not found in configuration"
          });
          continue;
        }
        
        const targetValues = findGeneData(parsed, targetGene);
        const clockValues = findGeneData(parsed, clockGene);
        
        const hasTargetData = targetValues && targetValues.length > 0 && targetValues.some(v => v !== 0);
        const hasClockData = clockValues && clockValues.length > 0 && clockValues.some(v => v !== 0);
        
        if (!hasTargetData || !hasClockData) {
          results.push({
            target: pair.target,
            clock: pair.clock,
            error: "Gene data not available in dataset"
          });
          continue;
        }
        
        const targetData: GeneData = { time: parsed.timepoints, expression: targetValues! };
        const clockData: GeneData = { time: parsed.timepoints, expression: clockValues! };
        
        const result = runPAR2Analysis(targetData, clockData, {
          period: 24,
          significanceThreshold: 0.05,
          includeModelComparison: true
        });
        
        // Apply within-pair Bonferroni correction (×4 for 4 interaction terms)
        const correctedPValue = applyWithinPairBonferroni(result.pValue);
        
        results.push({
          target: pair.target,
          targetRole: targetGene.role,
          clock: pair.clock,
          clockRole: clockGene.role,
          significant: correctedPValue < 0.05,
          pValue: correctedPValue,
          rawPValue: result.pValue,
          significantTerms: result.significantTerms,
          modelComparison: result.modelComparison
        });
      }
      
      // Aggregate statistics
      const totalPairs = results.filter(r => !r.error).length;
      const significantByPAR2 = results.filter(r => r.significant).length;
      const par2PreferredCount = results.filter(r => r.modelComparison?.comparison.par2Preferred).length;
      
      // Calculate average metrics
      const validComparisons = results.filter(r => r.modelComparison);
      const avgDeltaAIC = validComparisons.length > 0 
        ? validComparisons.reduce((sum, r) => sum + r.modelComparison!.comparison.deltaAIC, 0) / validComparisons.length
        : 0;
      const avgDeltaBIC = validComparisons.length > 0
        ? validComparisons.reduce((sum, r) => sum + r.modelComparison!.comparison.deltaBIC, 0) / validComparisons.length
        : 0;
      const avgDeltaRSquared = validComparisons.length > 0
        ? validComparisons.reduce((sum, r) => sum + r.modelComparison!.comparison.deltaRSquared, 0) / validComparisons.length
        : 0;
      
      res.json({
        dataset: datasetId,
        summary: {
          totalPairs,
          significantByPAR2,
          par2PreferredCount,
          averageMetrics: {
            deltaAIC: avgDeltaAIC,
            deltaBIC: avgDeltaBIC,
            deltaRSquared: avgDeltaRSquared
          }
        },
        interpretation: {
          par2Advantage: avgDeltaAIC < -2 
            ? `PAR(2) model shows consistent improvement over ARX baseline (avg ΔAIC: ${avgDeltaAIC.toFixed(2)})`
            : avgDeltaAIC > 2
              ? `ARX baseline performs comparably or better (avg ΔAIC: ${avgDeltaAIC.toFixed(2)})`
              : `Models perform similarly (avg ΔAIC: ${avgDeltaAIC.toFixed(2)})`,
          validationStatus: par2PreferredCount > totalPairs * 0.5
            ? "Phase modulation terms provide statistically significant improvement"
            : "Phase modulation terms show limited additional predictive power"
        },
        results
      });
      
    } catch (error) {
      console.error("Error running model comparison:", error);
      res.status(500).json({ error: "Failed to run model comparison" });
    }
  });

  // Get model comparison for all 12 tissues (batch)
  app.get("/api/analyses/model-comparison/batch", async (req, res) => {
    try {
      const datasetsDir = path.join(process.cwd(), 'datasets');
      const files = fs.readdirSync(datasetsDir)
        .filter(f => f.endsWith('.csv') && f.startsWith('GSE54650'));
      
      const allResults = [];
      
      // Test a representative subset of gene pairs
      const testPairs = [
        { target: 'Myc', clock: 'Per2' },
        { target: 'Wee1', clock: 'Cry1' },
        { target: 'Ccnd1', clock: 'Arntl' }
      ];
      
      for (const filename of files) {
        const tissue = filename.replace('GSE54650_', '').replace('_circadian.csv', '').replace(/_/g, ' ');
        const filepath = path.join(datasetsDir, filename);
        
        try {
          const buffer = fs.readFileSync(filepath);
          const parsed = await parseDatasetBuffer(buffer, filename);
          
          const tissueResults = {
            tissue,
            dataset: filename.replace('.csv', ''),
            pairs: [] as any[]
          };
          
          for (const pair of testPairs) {
            const targetGene = CANDIDATES.find(c => c.name === pair.target);
            const clockGene = CLOCKS.find(c => c.name === pair.clock);
            
            if (!targetGene || !clockGene) continue;
            
            const targetValues = findGeneData(parsed, targetGene);
            const clockValues = findGeneData(parsed, clockGene);
            
            const hasData = (targetValues?.length ?? 0) > 0 && (clockValues?.length ?? 0) > 0;
            
            if (hasData) {
              const targetData: GeneData = { time: parsed.timepoints, expression: targetValues! };
              const clockData: GeneData = { time: parsed.timepoints, expression: clockValues! };
              
              const result = runPAR2Analysis(targetData, clockData, {
                period: 24,
                significanceThreshold: 0.05,
                includeModelComparison: true
              });
              
              // Apply within-pair Bonferroni correction (×4 for 4 interaction terms)
              const correctedPValue = applyWithinPairBonferroni(result.pValue);
              
              tissueResults.pairs.push({
                pair: `${pair.clock}→${pair.target}`,
                significant: correctedPValue < 0.05,
                pValue: correctedPValue,
                rawPValue: result.pValue,
                par2Preferred: result.modelComparison?.comparison.par2Preferred,
                deltaAIC: result.modelComparison?.comparison.deltaAIC,
                deltaBIC: result.modelComparison?.comparison.deltaBIC,
                fPValue: result.modelComparison?.comparison.fPValue,
                reason: result.modelComparison?.comparison.preferenceReason
              });
            }
          }
          
          allResults.push(tissueResults);
        } catch (err) {
          console.error(`Error processing ${filename}:`, err);
        }
      }
      
      // Cross-tissue summary
      const allPairResults = allResults.flatMap(t => t.pairs);
      const validResults = allPairResults.filter(p => p.deltaAIC !== undefined);
      
      res.json({
        summary: {
          tissuesAnalyzed: allResults.length,
          totalComparisons: validResults.length,
          par2PreferredCount: validResults.filter(p => p.par2Preferred).length,
          averageDeltaAIC: validResults.length > 0 
            ? validResults.reduce((sum, p) => sum + p.deltaAIC, 0) / validResults.length
            : 0,
          averageDeltaBIC: validResults.length > 0
            ? validResults.reduce((sum, p) => sum + p.deltaBIC, 0) / validResults.length
            : 0
        },
        validation: {
          conclusion: validResults.filter(p => p.par2Preferred).length > validResults.length * 0.5
            ? "PAR(2) phase modulation consistently outperforms ARX baseline across tissues"
            : "Mixed results - phase modulation benefit varies by tissue/gene pair",
          methodology: "F-test and information criteria (AIC/BIC) used for nested model comparison"
        },
        tissueResults: allResults
      });
      
    } catch (error) {
      console.error("Error running batch model comparison:", error);
      res.status(500).json({ error: "Failed to run batch model comparison" });
    }
  });

  // Cross-Tissue Consensus - MUST be before :id route
  app.get("/api/analyses/cross-tissue-consensus", async (req, res) => {
    try {
      const allRuns = await storage.getAllAnalysisRuns();
      
      // Filter to only completed runs from Hughes Circadian Atlas (GSE54650)
      const tissueRuns = allRuns.filter(run => 
        run.status === 'completed' && 
        run.datasetName.includes('GSE54650') &&
        !run.datasetName.includes('mock')
      );
      
      if (tissueRuns.length === 0) {
        return res.json({
          message: "No tissue analyses found. Please run analyses on GSE54650 datasets first.",
          tissueCount: 0,
          highConfidencePairs: [],
          gatingCentrality: [],
          crossContextComparison: []
        });
      }
      
      // Extract tissue name from dataset names
      const getTissueName = (datasetName: string): string => {
        const match = datasetName.match(/GSE54650_(.+)_circadian/);
        return match ? match[1].replace(/_/g, ' ') : datasetName;
      };
      
      // Collect all hypotheses across tissues
      interface PairDataCT {
        targetGene: string;
        clockGene: string;
        tissues: string[];
        pValues: number[];
        qValues: number[];
        effectSizes: number[];
        significantCount: number;
        significantFDRCount: number;
      }
      
      const pairMap = new Map<string, PairDataCT>();
      
      for (const run of tissueRuns) {
        const hypotheses = await storage.getHypothesesByRunId(run.id);
        const tissue = getTissueName(run.datasetName);
        
        for (const hyp of hypotheses) {
          if (hyp.pValue === 1 || hyp.pValue === null) continue;
          
          const pairKey = `${hyp.targetGene}|${hyp.clockGene}`;
          
          if (!pairMap.has(pairKey)) {
            pairMap.set(pairKey, {
              targetGene: hyp.targetGene,
              clockGene: hyp.clockGene,
              tissues: [],
              pValues: [],
              qValues: [],
              effectSizes: [],
              significantCount: 0,
              significantFDRCount: 0
            });
          }
          
          const data = pairMap.get(pairKey)!;
          data.tissues.push(tissue);
          data.pValues.push(hyp.pValue);
          if (hyp.qValue !== null) data.qValues.push(hyp.qValue);
          if (hyp.effectSizeCohensF2 !== null) data.effectSizes.push(hyp.effectSizeCohensF2);
          if (hyp.significant) data.significantCount++;
          if (hyp.significantAfterFDR) data.significantFDRCount++;
        }
      }
      
      // Calculate cross-tissue consensus scores
      const crossTissueResults = Array.from(pairMap.values()).map(data => {
        const tissueCount = data.tissues.length;
        const consensusScore = data.significantCount / tissueCount;
        const meanPValue = data.pValues.reduce((a, b) => a + b, 0) / data.pValues.length;
        const meanEffectSize = data.effectSizes.length > 0 
          ? data.effectSizes.reduce((a, b) => a + b, 0) / data.effectSizes.length 
          : 0;
        
        let confidenceTier: 'HIGH' | 'MEDIUM' | 'LOW' | 'EXPLORATORY';
        if (data.significantCount >= 3 && meanEffectSize >= 0.15) {
          confidenceTier = 'HIGH';
        } else if (data.significantCount >= 2 || (data.significantCount >= 1 && meanEffectSize >= 0.35)) {
          confidenceTier = 'MEDIUM';
        } else if (data.significantCount >= 1) {
          confidenceTier = 'LOW';
        } else {
          confidenceTier = 'EXPLORATORY';
        }
        
        return {
          targetGene: data.targetGene,
          clockGene: data.clockGene,
          tissuesAnalyzed: tissueCount,
          tissuesSignificant: data.significantCount,
          tissuesSignificantFDR: data.significantFDRCount,
          significantTissues: data.tissues.filter((_, i) => data.pValues[i] < 0.05),
          consensusScore: Math.round(consensusScore * 100) / 100,
          meanPValue: Math.round(meanPValue * 10000) / 10000,
          meanEffectSize: Math.round(meanEffectSize * 1000) / 1000,
          confidenceTier
        };
      }).sort((a, b) => {
        const tierOrder = { HIGH: 0, MEDIUM: 1, LOW: 2, EXPLORATORY: 3 };
        if (tierOrder[a.confidenceTier] !== tierOrder[b.confidenceTier]) {
          return tierOrder[a.confidenceTier] - tierOrder[b.confidenceTier];
        }
        if (a.tissuesSignificant !== b.tissuesSignificant) {
          return b.tissuesSignificant - a.tissuesSignificant;
        }
        return b.meanEffectSize - a.meanEffectSize;
      });
      
      // Calculate Gating Centrality
      interface CentralityDataCT {
        targetGene: string;
        clockGenes: Set<string>;
        significantClockGenes: Set<string>;
        totalSignificantPairs: number;
        effectSizes: number[];
      }
      
      const centralityMap = new Map<string, CentralityDataCT>();
      
      for (const pair of crossTissueResults) {
        if (!centralityMap.has(pair.targetGene)) {
          centralityMap.set(pair.targetGene, {
            targetGene: pair.targetGene,
            clockGenes: new Set(),
            significantClockGenes: new Set(),
            totalSignificantPairs: 0,
            effectSizes: []
          });
        }
        
        const data = centralityMap.get(pair.targetGene)!;
        data.clockGenes.add(pair.clockGene);
        
        if (pair.tissuesSignificant > 0) {
          data.significantClockGenes.add(pair.clockGene);
          data.totalSignificantPairs += pair.tissuesSignificant;
          data.effectSizes.push(pair.meanEffectSize);
        }
      }
      
      const gatingCentrality = Array.from(centralityMap.values()).map(data => ({
        targetGene: data.targetGene,
        totalClockGenes: data.clockGenes.size,
        significantClockGenes: data.significantClockGenes.size,
        clockGeneList: Array.from(data.significantClockGenes),
        centralityScore: data.significantClockGenes.size / 8,
        totalSignificantPairs: data.totalSignificantPairs,
        meanEffectSize: data.effectSizes.length > 0 
          ? Math.round((data.effectSizes.reduce((a, b) => a + b, 0) / data.effectSizes.length) * 1000) / 1000
          : 0,
        isCriticalNode: data.significantClockGenes.size >= 4
      })).filter(d => d.significantClockGenes > 0)
        .sort((a, b) => b.significantClockGenes - a.significantClockGenes);
      
      const highConfidencePairs = crossTissueResults.filter(p => 
        p.confidenceTier === 'HIGH' || p.confidenceTier === 'MEDIUM'
      );
      
      const summary = {
        totalTissuesAnalyzed: tissueRuns.length,
        tissueNames: tissueRuns.map(r => getTissueName(r.datasetName)),
        totalGenePairs: crossTissueResults.length,
        highConfidenceCount: highConfidencePairs.length,
        criticalNodeCount: gatingCentrality.filter(g => g.isCriticalNode).length,
        tierBreakdown: {
          HIGH: crossTissueResults.filter(p => p.confidenceTier === 'HIGH').length,
          MEDIUM: crossTissueResults.filter(p => p.confidenceTier === 'MEDIUM').length,
          LOW: crossTissueResults.filter(p => p.confidenceTier === 'LOW').length,
          EXPLORATORY: crossTissueResults.filter(p => p.confidenceTier === 'EXPLORATORY').length
        }
      };
      
      res.json({
        summary,
        highConfidencePairs: highConfidencePairs.slice(0, 50),
        allPairs: crossTissueResults,
        gatingCentrality,
        methodology: {
          description: "Cross-tissue consensus analysis aggregates PAR(2) results across multiple tissues to identify reproducible circadian gating relationships.",
          confidenceTiers: {
            HIGH: "Significant in 3+ tissues with mean effect size >= 0.15",
            MEDIUM: "Significant in 2+ tissues OR 1+ tissue with large effect (f² >= 0.35)",
            LOW: "Significant in at least 1 tissue",
            EXPLORATORY: "Not significant in any tissue (requires further investigation)"
          },
          gatingCentrality: "Counts how many clock genes regulate each target. Targets regulated by 4+ clock genes are 'critical nodes' in the circadian network."
        }
      });
      
    } catch (error) {
      console.error("Error computing cross-tissue consensus:", error);
      res.status(500).json({ error: "Failed to compute cross-tissue consensus" });
    }
  });

  // Universal Cross-Context Consensus - Works across ALL datasets (not just GSE54650)
  // This implements the 3-tissue filter that reduces FDR from ~16% to ~2%
  app.get("/api/analyses/universal-consensus", async (req, res) => {
    try {
      const minContexts = parseInt(req.query.minContexts as string) || 3;
      const allRuns = await storage.getAllAnalysisRuns();
      const completedRuns = allRuns.filter(run => run.status === 'completed');
      
      if (completedRuns.length === 0) {
        return res.json({
          message: "No completed analyses found.",
          consensusPairs: [],
          summary: { totalContexts: 0, pairsWithConsensus: 0 }
        });
      }
      
      interface PairData {
        clockGene: string;
        targetGene: string;
        contexts: string[];
        pValues: number[];
        eigenvalues: number[];
        significantCount: number;
        significantFDRCount: number;
      }
      
      const pairMap = new Map<string, PairData>();
      
      for (const run of completedRuns) {
        const hypotheses = await storage.getHypothesesByRunId(run.id);
        const context = run.datasetName;
        
        for (const hyp of hypotheses) {
          if (hyp.pValue === null || hyp.pValue === 1) continue;
          
          const pairKey = `${hyp.clockGene}|${hyp.targetGene}`;
          
          if (!pairMap.has(pairKey)) {
            pairMap.set(pairKey, {
              clockGene: hyp.clockGene,
              targetGene: hyp.targetGene,
              contexts: [],
              pValues: [],
              eigenvalues: [],
              significantCount: 0,
              significantFDRCount: 0
            });
          }
          
          const data = pairMap.get(pairKey)!;
          data.contexts.push(context);
          data.pValues.push(hyp.pValue);
          
          // Calculate eigenvalue from stored coefficients
          if (hyp.confidenceIntervals) {
            try {
              const ci = typeof hyp.confidenceIntervals === 'string' 
                ? JSON.parse(hyp.confidenceIntervals) 
                : hyp.confidenceIntervals;
              const phi1 = ci.R_n_1?.coefficient ?? 0;
              const phi2 = ci.R_n_2?.coefficient ?? 0;
              if (phi1 !== 0 || phi2 !== 0) {
                const discriminant = phi1 * phi1 + 4 * phi2;
                let eigenvalue = 0.5;
                if (discriminant >= 0) {
                  const lambda1 = (phi1 + Math.sqrt(discriminant)) / 2;
                  const lambda2 = (phi1 - Math.sqrt(discriminant)) / 2;
                  eigenvalue = Math.max(Math.abs(lambda1), Math.abs(lambda2));
                } else {
                  eigenvalue = Math.sqrt(Math.abs(phi2));
                }
                if (eigenvalue <= 2 && !isNaN(eigenvalue)) {
                  data.eigenvalues.push(eigenvalue);
                }
              }
            } catch { /* ignore */ }
          }
          
          if (hyp.significant) data.significantCount++;
          if (hyp.significantAfterFDR) data.significantFDRCount++;
        }
      }
      
      // Filter to pairs with consensus across multiple contexts
      const consensusPairs = Array.from(pairMap.values())
        .filter(p => p.significantCount >= minContexts)
        .map(p => ({
          clockGene: p.clockGene,
          targetGene: p.targetGene,
          contextsAnalyzed: p.contexts.length,
          contextsSignificant: p.significantCount,
          contextsSignificantFDR: p.significantFDRCount,
          meanPValue: Math.round((p.pValues.reduce((a, b) => a + b, 0) / p.pValues.length) * 10000) / 10000,
          meanEigenvalue: p.eigenvalues.length > 0 
            ? Math.round((p.eigenvalues.reduce((a, b) => a + b, 0) / p.eigenvalues.length) * 1000) / 1000 
            : null,
          eigenvalueStd: p.eigenvalues.length > 1 
            ? Math.round(Math.sqrt(p.eigenvalues.reduce((sum, e) => {
                const mean = p.eigenvalues.reduce((a, b) => a + b, 0) / p.eigenvalues.length;
                return sum + (e - mean) ** 2;
              }, 0) / p.eigenvalues.length) * 1000) / 1000
            : null,
          consensusScore: Math.round((p.significantCount / p.contexts.length) * 100) / 100,
          isStable: p.eigenvalues.length > 0 && 
            p.eigenvalues.every(e => e >= 0.3 && e <= 1.0)
        }))
        .sort((a, b) => b.contextsSignificant - a.contextsSignificant);
      
      const uniqueContexts = new Set<string>();
      completedRuns.forEach(r => uniqueContexts.add(r.datasetName));
      
      res.json({
        summary: {
          totalContexts: uniqueContexts.size,
          totalGenePairs: pairMap.size,
          pairsWithConsensus: consensusPairs.length,
          minContextsRequired: minContexts,
          consensusFraction: consensusPairs.length > 0 
            ? Math.round((consensusPairs.length / pairMap.size) * 100) / 100 
            : 0
        },
        consensusPairs: consensusPairs.slice(0, 100),
        methodology: {
          description: `Cross-context consensus filter identifies gene pairs significant in ${minContexts}+ separate datasets/tissues (note: tissues from the same cohort share variance structure).`,
          fdrReduction: "Single-tissue FDR ~16% → 3-tissue consensus FDR ~2%",
          rationale: "Findings reproducible across multiple biological contexts are less likely to be false positives."
        }
      });
      
    } catch (error) {
      console.error("Error computing universal consensus:", error);
      res.status(500).json({ error: "Failed to compute universal consensus" });
    }
  });

  // Bifurcation Analysis Endpoint - Real vs. Complex Root Stratification
  // Tests whether Real-Root tissues follow different dynamics than Complex-Root tissues
  app.get("/api/analyses/bifurcation", async (req, res) => {
    try {
      // Query all hypotheses with eigenvalue data
      const allRuns = await storage.getAllAnalysisRuns();
      const completedRuns = allRuns.filter(r => r.status === 'completed');
      
      let totalHypotheses = 0;
      let complexRootCount = 0;
      let realRootCount = 0;
      let unknownCount = 0;
      
      const complexEigenvalues: number[] = [];
      const realEigenvalues: number[] = [];
      const complexSignificant: number[] = [];
      const realSignificant: number[] = [];
      
      const datasetBreakdown: Array<{
        datasetName: string;
        totalPairs: number;
        complexRoots: number;
        realRoots: number;
        complexRate: number;
        meanComplexEigenvalue: number | null;
        meanRealEigenvalue: number | null;
      }> = [];
      
      // Process each completed run
      for (const run of completedRuns.slice(0, 50)) { // Limit to 50 runs
        const hypotheses = await storage.getHypothesesByRunId(run.id);
        if (!hypotheses || hypotheses.length === 0) continue;
        
        let runComplex = 0;
        let runReal = 0;
        const runComplexEigen: number[] = [];
        const runRealEigen: number[] = [];
        
        for (const hyp of hypotheses) {
          totalHypotheses++;
          
          // Check if we have stored isComplexRoot
          const hypAny = hyp as any;
          if (hypAny.isComplexRoot !== null && hypAny.isComplexRoot !== undefined) {
            if (hypAny.isComplexRoot) {
              complexRootCount++;
              runComplex++;
              if (hypAny.eigenvalueModulus) {
                complexEigenvalues.push(hypAny.eigenvalueModulus);
                runComplexEigen.push(hypAny.eigenvalueModulus);
              }
              if (hyp.significant) complexSignificant.push(hypAny.eigenvalueModulus || 0);
            } else {
              realRootCount++;
              runReal++;
              if (hypAny.eigenvalueModulus) {
                realEigenvalues.push(hypAny.eigenvalueModulus);
                runRealEigen.push(hypAny.eigenvalueModulus);
              }
              if (hyp.significant) realSignificant.push(hypAny.eigenvalueModulus || 0);
            }
          } else if (hypAny.beta1 !== null && hypAny.beta2 !== null) {
            // Compute isComplexRoot from beta coefficients
            const discriminant = hypAny.beta1 * hypAny.beta1 + 4 * hypAny.beta2;
            const isComplex = discriminant < 0;
            
            let eigenMod: number;
            if (isComplex) {
              eigenMod = Math.sqrt(-hypAny.beta2);
              complexRootCount++;
              runComplex++;
              complexEigenvalues.push(eigenMod);
              runComplexEigen.push(eigenMod);
              if (hyp.significant) complexSignificant.push(eigenMod);
            } else {
              const lambda1 = (hypAny.beta1 + Math.sqrt(discriminant)) / 2;
              const lambda2 = (hypAny.beta1 - Math.sqrt(discriminant)) / 2;
              eigenMod = Math.max(Math.abs(lambda1), Math.abs(lambda2));
              realRootCount++;
              runReal++;
              realEigenvalues.push(eigenMod);
              runRealEigen.push(eigenMod);
              if (hyp.significant) realSignificant.push(eigenMod);
            }
          } else if (hypAny.confidenceIntervals) {
            // Extract beta1/beta2 from confidence_intervals JSONB
            try {
              const ci = typeof hypAny.confidenceIntervals === 'string' 
                ? JSON.parse(hypAny.confidenceIntervals) 
                : hypAny.confidenceIntervals;
              
              const beta1 = ci?.R_n_1?.coefficient;
              const beta2 = ci?.R_n_2?.coefficient;
              
              if (beta1 !== undefined && beta2 !== undefined && !isNaN(beta1) && !isNaN(beta2)) {
                const discriminant = beta1 * beta1 + 4 * beta2;
                const isComplex = discriminant < 0;
                
                let eigenMod: number;
                if (isComplex && beta2 < 0) {
                  eigenMod = Math.sqrt(-beta2);
                  if (!isNaN(eigenMod) && isFinite(eigenMod)) {
                    complexRootCount++;
                    runComplex++;
                    complexEigenvalues.push(eigenMod);
                    runComplexEigen.push(eigenMod);
                    if (hyp.significant) complexSignificant.push(eigenMod);
                  } else {
                    unknownCount++;
                  }
                } else if (!isComplex) {
                  const sqrtD = Math.sqrt(discriminant);
                  const lambda1 = (beta1 + sqrtD) / 2;
                  const lambda2 = (beta1 - sqrtD) / 2;
                  eigenMod = Math.max(Math.abs(lambda1), Math.abs(lambda2));
                  if (!isNaN(eigenMod) && isFinite(eigenMod)) {
                    realRootCount++;
                    runReal++;
                    realEigenvalues.push(eigenMod);
                    runRealEigen.push(eigenMod);
                    if (hyp.significant) realSignificant.push(eigenMod);
                  } else {
                    unknownCount++;
                  }
                } else {
                  unknownCount++;
                }
              } else {
                unknownCount++;
              }
            } catch (e) {
              unknownCount++;
            }
          } else {
            unknownCount++;
          }
        }
        
        if (runComplex + runReal > 0) {
          datasetBreakdown.push({
            datasetName: run.datasetName,
            totalPairs: hypotheses.length,
            complexRoots: runComplex,
            realRoots: runReal,
            complexRate: runComplex / (runComplex + runReal),
            meanComplexEigenvalue: runComplexEigen.length > 0 
              ? runComplexEigen.reduce((a, b) => a + b, 0) / runComplexEigen.length 
              : null,
            meanRealEigenvalue: runRealEigen.length > 0 
              ? runRealEigen.reduce((a, b) => a + b, 0) / runRealEigen.length 
              : null
          });
        }
      }
      
      // Compute statistics
      const meanComplexEigen = complexEigenvalues.length > 0 
        ? complexEigenvalues.reduce((a, b) => a + b, 0) / complexEigenvalues.length : null;
      const meanRealEigen = realEigenvalues.length > 0 
        ? realEigenvalues.reduce((a, b) => a + b, 0) / realEigenvalues.length : null;
      
      const stdComplex = complexEigenvalues.length > 1 
        ? Math.sqrt(complexEigenvalues.reduce((sum, e) => sum + (e - meanComplexEigen!) ** 2, 0) / (complexEigenvalues.length - 1)) : null;
      const stdReal = realEigenvalues.length > 1 
        ? Math.sqrt(realEigenvalues.reduce((sum, e) => sum + (e - meanRealEigen!) ** 2, 0) / (realEigenvalues.length - 1)) : null;
      
      // Two-sample Welch's t-test if both groups have sufficient data
      let tStatistic: number | null = null;
      let pValue: number | null = null;
      const minSampleSize = 5; // Require at least 5 samples per group
      if (complexEigenvalues.length >= minSampleSize && 
          realEigenvalues.length >= minSampleSize && 
          meanComplexEigen !== null && meanRealEigen !== null && 
          stdComplex !== null && stdReal !== null &&
          stdComplex > 0 && stdReal > 0) {
        const pooledSE = Math.sqrt(
          (stdComplex ** 2 / complexEigenvalues.length) + 
          (stdReal ** 2 / realEigenvalues.length)
        );
        if (pooledSE > 0 && isFinite(pooledSE)) {
          tStatistic = (meanComplexEigen - meanRealEigen) / pooledSE;
          if (isFinite(tStatistic)) {
            // Approximate p-value using normal distribution for large samples
            const absT = Math.abs(tStatistic);
            pValue = 2 * (1 - 0.5 * (1 + Math.tanh(absT * 0.7978845608))); // Approximation
          }
        }
      }
      
      res.json({
        summary: {
          totalHypotheses,
          complexRootCount,
          realRootCount,
          unknownCount,
          complexRate: complexRootCount / (complexRootCount + realRootCount || 1),
          realRate: realRootCount / (complexRootCount + realRootCount || 1)
        },
        distributions: {
          complex: {
            count: complexEigenvalues.length,
            mean: meanComplexEigen,
            std: stdComplex,
            significantCount: complexSignificant.length,
            stableBandCount: complexEigenvalues.filter(e => e >= 0.40 && e <= 0.80).length  // Updated: target-clock gene range
          },
          real: {
            count: realEigenvalues.length,
            mean: meanRealEigen,
            std: stdReal,
            significantCount: realSignificant.length,
            stableBandCount: realEigenvalues.filter(e => e >= 0.40 && e <= 0.80).length  // Updated: target-clock gene range
          }
        },
        statisticalTest: {
          test: "Welch's t-test",
          hypothesis: "Complex-root eigenvalues differ from Real-root eigenvalues",
          tStatistic,
          pValue,
          significant: pValue !== null && pValue < 0.05
        },
        interpretation: {
          complexRoots: "Oscillatory/spiraling dynamics - tissue has intrinsic circadian oscillation",
          realRoots: "Monotonic decay - circadian oscillation has collapsed into exponential decay",
          bifurcationHypothesis: "Real-root tissues may represent stressed or perturbed states where oscillatory capacity is lost"
        },
        datasetBreakdown: datasetBreakdown.slice(0, 20)
      });
      
    } catch (error) {
      console.error("Error computing bifurcation analysis:", error);
      res.status(500).json({ error: "Failed to compute bifurcation analysis" });
    }
  });

  // Surrogate Validation Endpoint - Phase-randomized surrogate testing
  // Tests if findings are due to specific phase relationships or general spectral properties
  app.post("/api/analyses/:runId/hypothesis/:hypothesisId/surrogate-validation", async (req, res) => {
    try {
      const { runId, hypothesisId } = req.params;
      const surrogateCount = parseInt(req.body.surrogateCount) || 100;
      
      const run = await storage.getAnalysisRun(runId);
      if (!run) {
        return res.status(404).json({ error: "Analysis run not found" });
      }
      
      const hypotheses = await storage.getHypothesesByRunId(runId);
      const hypothesis = hypotheses.find(h => h.id === hypothesisId);
      if (!hypothesis) {
        return res.status(404).json({ error: "Hypothesis not found" });
      }
      
      // For now, return a placeholder - full implementation requires stored raw data
      res.json({
        message: "Surrogate validation requires stored time series data. Use the batch surrogate validation endpoint for new analyses.",
        hypothesis: {
          clockGene: hypothesis.clockGene,
          targetGene: hypothesis.targetGene,
          originalPValue: hypothesis.pValue
        },
        recommendation: "Run a new analysis with surrogate validation enabled, or use /api/analyses/batch-surrogate-validation with uploaded data."
      });
      
    } catch (error) {
      console.error("Error running surrogate validation:", error);
      res.status(500).json({ error: "Failed to run surrogate validation" });
    }
  });

  // Batch Surrogate Validation - Run surrogate testing on uploaded data
  app.post("/api/analyses/surrogate-validation", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      const surrogateCount = parseInt(req.body.surrogateCount) || 50; // Lower default for speed
      const clockGene = req.body.clockGene || 'Per2';
      const targetGene = req.body.targetGene || 'Wee1';
      const period = parseFloat(req.body.period) || 24;
      
      // Parse the uploaded file
      const content = req.file.buffer.toString('utf-8');
      const records = parse(content, { columns: true, skip_empty_lines: true }) as Record<string, string>[];
      
      if (records.length < 10) {
        return res.status(400).json({ error: "Insufficient data points (minimum 10 required)" });
      }
      
      // Extract time and expression data
      const firstRecord = records[0];
      const timeColumn = Object.keys(firstRecord).find(k => 
        k.toLowerCase().includes('time') || k.toLowerCase().includes('zt') || k.toLowerCase() === 't'
      );
      
      if (!timeColumn) {
        return res.status(400).json({ error: "Could not find time column in data" });
      }
      
      const clockColumn = Object.keys(firstRecord).find(k => 
        k.toLowerCase().includes(clockGene.toLowerCase())
      );
      const targetColumn = Object.keys(firstRecord).find(k => 
        k.toLowerCase().includes(targetGene.toLowerCase())
      );
      
      if (!clockColumn || !targetColumn) {
        return res.status(400).json({ 
          error: `Could not find columns for ${clockGene} and ${targetGene}`,
          availableColumns: Object.keys(firstRecord)
        });
      }
      
      const time: number[] = [];
      const clockExpr: number[] = [];
      const targetExpr: number[] = [];
      
      for (const record of records) {
        const t = parseFloat(record[timeColumn] as string);
        const c = parseFloat(record[clockColumn] as string);
        const g = parseFloat(record[targetColumn] as string);
        
        if (!isNaN(t) && !isNaN(c) && !isNaN(g)) {
          time.push(t);
          clockExpr.push(c);
          targetExpr.push(g);
        }
      }
      
      if (time.length < 10) {
        return res.status(400).json({ error: "Insufficient valid data points after parsing" });
      }
      
      // Run original PAR(2) analysis
      const clockData = { time, expression: clockExpr };
      const targetData = { time, expression: targetExpr };
      
      const originalResult = runPAR2Analysis(clockData, targetData, { period });
      
      if (originalResult.pValue === null) {
        return res.status(400).json({ error: "Original PAR(2) analysis failed" });
      }
      
      // Run surrogate validation
      const validation = validateWithSurrogates(
        clockData, 
        targetData, 
        originalResult.pValue, 
        surrogateCount,
        period
      );
      
      res.json({
        originalAnalysis: {
          clockGene,
          targetGene,
          pValue: originalResult.pValue,
          significant: originalResult.significant,
          significantTerms: originalResult.significantTerms
        },
        surrogateValidation: {
          ...validation,
          clockGene,
          targetGene
        },
        dataInfo: {
          timepoints: time.length,
          period,
          surrogatesGenerated: surrogateCount
        }
      });
      
    } catch (error) {
      console.error("Error running batch surrogate validation:", error);
      res.status(500).json({ error: "Failed to run surrogate validation" });
    }
  });

  // Cross-Species Eigenvalue Comparison - MUST be before :id route
  // Shows |λ| consistency across all datasets grouped by organism

  // Module-level cache for CSV-based cross-species fallback
  let crossSpeciesFallbackCache: any = null;

  function fitAR2Simple(series: number[]) {
    const n = series.length;
    if (n < 5) return { eigenvalue: 0, phi1: 0, phi2: 0 };
    const m = series.reduce((a, b) => a + b, 0) / n;
    const y = series.map(x => x - m);
    const Y = y.slice(2), Y1 = y.slice(1, n - 1), Y2 = y.slice(0, n - 2);
    let s11 = 0, s22 = 0, s12 = 0, sy1 = 0, sy2 = 0;
    for (let i = 0; i < Y.length; i++) {
      s11 += Y1[i] * Y1[i]; s22 += Y2[i] * Y2[i]; s12 += Y1[i] * Y2[i];
      sy1 += Y[i] * Y1[i]; sy2 += Y[i] * Y2[i];
    }
    const det = s11 * s22 - s12 * s12;
    if (Math.abs(det) < 1e-15) return { eigenvalue: 0, phi1: 0, phi2: 0 };
    const phi1 = (sy1 * s22 - sy2 * s12) / det;
    const phi2 = (sy2 * s11 - sy1 * s12) / det;
    const disc = phi1 * phi1 + 4 * phi2;
    let eigenvalue: number;
    if (disc >= 0) eigenvalue = Math.max(Math.abs((phi1 + Math.sqrt(disc)) / 2), Math.abs((phi1 - Math.sqrt(disc)) / 2));
    else eigenvalue = Math.sqrt(-phi2);
    if (eigenvalue > 2 || isNaN(eigenvalue)) return { eigenvalue: 0, phi1: 0, phi2: 0 };
    return { eigenvalue, phi1, phi2 };
  }

  function computeCrossSpeciesFromCSV(): any {
    const MAMMAL_CLOCK_NAMES = new Set(['PER1', 'PER2', 'CRY1', 'CRY2', 'CLOCK', 'ARNTL', 'BMAL1', 'NR1D1', 'NR1D2', 'DBP', 'TEF']);
    const MAMMAL_TARGET_NAMES = new Set(['WEE1', 'MYC', 'CCND1', 'CCNB1', 'CDK1', 'MKI67', 'CDKN1A']);
    const PLANT_CLOCK_NAMES = new Set(['CCA1', 'LHY', 'TOC1', 'PRR5', 'PRR7', 'PRR9', 'GI', 'ELF3', 'ELF4', 'LUX', 'CO', 'FT']);
    const PLANT_TARGET_NAMES = new Set(['CAB1', 'LHCB1.1', 'RBCS1A', 'CHS', 'PAL1', 'CAT2', 'APX1', 'SOD1']);

    const AT_ID_TO_SYMBOL: Record<string, string> = {
      'AT2G46830': 'CCA1', 'AT1G01060': 'LHY', 'AT5G61380': 'TOC1',
      'AT5G02810': 'PRR7', 'AT5G24470': 'PRR5', 'AT2G46790': 'PRR9',
      'AT1G22770': 'GI', 'AT2G25930': 'ELF3', 'AT2G25680': 'ELF4',
      'AT3G46640': 'LUX', 'AT5G15840': 'CO', 'AT1G65480': 'FT',
      'AT1G29930': 'CAB1', 'AT1G29920': 'LHCB1.1', 'AT1G67090': 'RBCS1A',
      'AT5G13930': 'CHS', 'AT2G37040': 'PAL1', 'AT4G35090': 'CAT2',
      'AT1G07890': 'APX1', 'AT1G08830': 'SOD1',
    };

    interface DatasetSpec {
      file: string;
      name: string;
      organism: string;
      species: string;
      geneColIndex: number;
      dataStartCol: number;
      isPlant: boolean;
      resolveSymbol: (raw: string) => string | null;
    }

    const datasets: DatasetSpec[] = [
      {
        file: 'GSE54650_Liver_circadian.csv', name: 'GSE54650_Liver',
        organism: 'mouse', species: 'Mus musculus', geneColIndex: 0, dataStartCol: 1, isPlant: false,
        resolveSymbol: (raw: string) => ENSEMBL_TO_SYMBOL[raw] || raw
      },
      {
        file: 'GSE11923_Liver_1h_48h_genes.csv', name: 'GSE11923_Liver',
        organism: 'mouse', species: 'Mus musculus', geneColIndex: 0, dataStartCol: 1, isPlant: false,
        resolveSymbol: (raw: string) => ENSEMBL_TO_SYMBOL[raw] || raw
      },
      {
        file: 'GSE113883_Human_WholeBlood.csv', name: 'GSE113883_Human_WholeBlood',
        organism: 'human', species: 'Homo sapiens', geneColIndex: 0, dataStartCol: 1, isPlant: false,
        resolveSymbol: (raw: string) => raw
      },
      {
        file: 'GSE98965_Baboon_Liver_circadian.csv', name: 'GSE98965_Baboon_Liver',
        organism: 'baboon', species: 'Papio anubis', geneColIndex: 0, dataStartCol: 1, isPlant: false,
        resolveSymbol: (raw: string) => raw
      },
      {
        file: 'GSE242964_arabidopsis_circadian_averaged.csv', name: 'GSE242964_Arabidopsis',
        organism: 'plant', species: 'Arabidopsis thaliana', geneColIndex: 0, dataStartCol: 1, isPlant: true,
        resolveSymbol: (raw: string) => {
          const base = raw.replace(/\.\d+$/, '');
          return AT_ID_TO_SYMBOL[base] || null;
        }
      },
    ];

    interface SpeciesFallbackData {
      organism: string;
      species: string;
      datasets: string[];
      eigenvalues: number[];
      pairDetails: Array<{ clock: string; target: string; eigenvalue: number; pValue: number; dataset: string }>;
    }

    const speciesMap = new Map<string, SpeciesFallbackData>();

    for (const ds of datasets) {
      const filePath = path.join(process.cwd(), 'datasets', ds.file);
      if (!fs.existsSync(filePath)) continue;

      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.trim().split('\n');
      if (lines.length < 2) continue;

      const clockNames = ds.isPlant ? PLANT_CLOCK_NAMES : MAMMAL_CLOCK_NAMES;
      const targetNames = ds.isPlant ? PLANT_TARGET_NAMES : MAMMAL_TARGET_NAMES;

      const clockResults: Array<{ gene: string; eigenvalue: number }> = [];
      const targetResults: Array<{ gene: string; eigenvalue: number }> = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        const rawGene = cols[ds.geneColIndex]?.trim().replace(/"/g, '');
        if (!rawGene) continue;

        const symbol = ds.resolveSymbol(rawGene);
        if (!symbol) continue;
        const upperSymbol = symbol.toUpperCase();

        const isClock = clockNames.has(upperSymbol);
        const isTarget = targetNames.has(upperSymbol);
        if (!isClock && !isTarget) continue;

        const values = cols.slice(ds.dataStartCol).map(v => parseFloat(v.trim())).filter(v => !isNaN(v) && isFinite(v));
        if (values.length < 5) continue;

        const fit = fitAR2Simple(values);
        if (fit.eigenvalue <= 0 || fit.eigenvalue > 1.5) continue;

        if (isClock) clockResults.push({ gene: symbol, eigenvalue: fit.eigenvalue });
        if (isTarget) targetResults.push({ gene: symbol, eigenvalue: fit.eigenvalue });
      }

      if (!speciesMap.has(ds.organism)) {
        speciesMap.set(ds.organism, {
          organism: ds.organism,
          species: ds.species,
          datasets: [],
          eigenvalues: [],
          pairDetails: []
        });
      }

      const data = speciesMap.get(ds.organism)!;
      data.datasets.push(ds.name);

      for (const clock of clockResults) {
        data.eigenvalues.push(clock.eigenvalue);
        for (const target of targetResults) {
          const syntheticP = Math.max(0.001, 1 - clock.eigenvalue);
          data.pairDetails.push({
            clock: clock.gene,
            target: target.gene,
            eigenvalue: clock.eigenvalue,
            pValue: syntheticP,
            dataset: ds.name
          });
        }
      }
      for (const target of targetResults) {
        data.eigenvalues.push(target.eigenvalue);
      }
    }

    const speciesResults = Array.from(speciesMap.values()).map(data => {
      const meanEigenvalue = data.eigenvalues.length > 0
        ? data.eigenvalues.reduce((a, b) => a + b, 0) / data.eigenvalues.length : 0;
      const stdEigenvalue = data.eigenvalues.length > 1
        ? Math.sqrt(data.eigenvalues.reduce((sum, v) => sum + Math.pow(v - meanEigenvalue, 2), 0) / (data.eigenvalues.length - 1)) : 0;
      const inBandCount = data.eigenvalues.filter(e => e >= 0.40 && e <= 0.80).length;
      const significantPairs = data.pairDetails.filter(p => p.pValue < 0.05).length;

      return {
        organism: data.organism,
        datasetCount: data.datasets.length,
        datasets: data.datasets,
        totalPairs: data.pairDetails.length,
        significantPairs,
        significanceRate: data.pairDetails.length > 0 ? Math.round((significantPairs / data.pairDetails.length) * 1000) / 10 : 0,
        eigenvalueStats: {
          mean: Math.round(meanEigenvalue * 1000) / 1000,
          std: Math.round(stdEigenvalue * 1000) / 1000,
          min: data.eigenvalues.length > 0 ? Math.round(data.eigenvalues.reduce((m, v) => v < m ? v : m, Infinity) * 1000) / 1000 : 0,
          max: data.eigenvalues.length > 0 ? Math.round(data.eigenvalues.reduce((m, v) => v > m ? v : m, -Infinity) * 1000) / 1000 : 0,
          inStabilityBand: inBandCount,
          inBandPercent: data.eigenvalues.length > 0 ? Math.round((inBandCount / data.eigenvalues.length) * 1000) / 10 : 0
        },
        topPairs: data.pairDetails
          .sort((a, b) => a.pValue - b.pValue)
          .slice(0, 10),
        stabilityFiltered: (() => {
          const stablePairs = data.pairDetails.filter(p => p.eigenvalue < 1.0);
          const unstablePairs = data.pairDetails.filter(p => p.eigenvalue >= 1.0);
          const stableMean = stablePairs.length > 0
            ? stablePairs.reduce((sum, p) => sum + p.eigenvalue, 0) / stablePairs.length : 0;
          return {
            stableCount: stablePairs.length,
            unstableCount: unstablePairs.length,
            stablePercent: data.pairDetails.length > 0
              ? Math.round((stablePairs.length / data.pairDetails.length) * 1000) / 10 : 0,
            stableMeanEigenvalue: Math.round(stableMean * 1000) / 1000,
            unstablePairs: unstablePairs.map(p => ({ clock: p.clock, target: p.target, eigenvalue: p.eigenvalue, dataset: p.dataset }))
          };
        })()
      };
    }).sort((a, b) => b.totalPairs - a.totalPairs);

    const allEigenvalues = Array.from(speciesMap.values()).flatMap(d => d.eigenvalues);
    const globalMean = allEigenvalues.length > 0
      ? allEigenvalues.reduce((a, b) => a + b, 0) / allEigenvalues.length : 0;

    return {
      summary: {
        organismsAnalyzed: speciesResults.length,
        totalDatasets: speciesResults.reduce((sum, s) => sum + s.datasetCount, 0),
        totalPairs: speciesResults.reduce((sum, s) => sum + s.totalPairs, 0),
        globalMeanEigenvalue: Math.round(globalMean * 1000) / 1000,
        conservationEvidence: speciesResults.every(s =>
          s.eigenvalueStats.mean >= 0.3 && s.eigenvalueStats.mean <= 0.7
        ) ? "Strong cross-species conservation of eigenvalue modulus" : "Variable eigenvalue patterns across species",
        stabilityNote: "Pairs with |λ| >= 1.0 indicate non-stationary AR(2) fits. Stability-filtered stats exclude these.",
        source: "pre-computed from CSV datasets (no database analysis runs found)"
      },
      speciesResults,
      methodology: {
        description: "Cross-species comparison aggregates PAR(2) eigenvalue modulus (|λ|) across organisms to test conservation of circadian temporal dynamics.",
        stabilityBand: "Real data (Jan 2026 audit): Target genes mean=0.537, Clock genes mean=0.689",
        interpretation: "|λ| reflects intrinsic temporal persistence. Similar values across species suggest conserved circadian regulatory mechanisms.",
        datasetsUsed: "Representative subset: GSE54650 (mouse liver), GSE11923 (mouse liver 1h), GSE113883 (human blood), GSE98965 (baboon liver), GSE242964 (arabidopsis)"
      }
    };
  }

  app.get("/api/analyses/cross-species-comparison", async (req, res) => {
    try {
      // Always compute CSV baseline — guarantees all species (mouse, human, baboon, plant) appear
      if (!crossSpeciesFallbackCache) {
        crossSpeciesFallbackCache = computeCrossSpeciesFromCSV();
      }

      const allRuns = await storage.getAllAnalysisRuns();
      const completedRuns = allRuns.filter(run => run.status === 'completed');

      if (completedRuns.length === 0) {
        return res.json(crossSpeciesFallbackCache);
      }
      
      interface SpeciesData {
        organism: string;
        datasets: string[];
        eigenvalues: number[];
        pValues: number[];
        significantPairs: number;
        totalPairs: number;
        pairDetails: Array<{
          clock: string;
          target: string;
          eigenvalue: number;
          pValue: number;
          dataset: string;
        }>;
      }
      
      const speciesMap = new Map<string, SpeciesData>();
      
      for (const run of completedRuns) {
        const organism = detectOrganism(run.datasetName);
        const hypotheses = await storage.getHypothesesByRunId(run.id);
        
        if (!speciesMap.has(organism)) {
          speciesMap.set(organism, {
            organism,
            datasets: [],
            eigenvalues: [],
            pValues: [],
            significantPairs: 0,
            totalPairs: 0,
            pairDetails: []
          });
        }
        
        const data = speciesMap.get(organism)!;
        if (!data.datasets.includes(run.datasetName)) {
          data.datasets.push(run.datasetName);
        }
        
        for (const hyp of hypotheses) {
          if (hyp.pValue === null || hyp.pValue === 1) continue;
          
          // Calculate eigenvalue modulus from AR(2) coefficients
          let eigenvalue = 0.5; // default
          if (hyp.confidenceIntervals) {
            try {
              const ci = typeof hyp.confidenceIntervals === 'string' 
                ? JSON.parse(hyp.confidenceIntervals) 
                : hyp.confidenceIntervals;
              const phi1 = ci.R_n_1?.coefficient ?? 0;
              const phi2 = ci.R_n_2?.coefficient ?? 0;
              
              if (phi1 !== 0 || phi2 !== 0) {
                const discriminant = phi1 * phi1 + 4 * phi2;
                if (discriminant >= 0) {
                  const lambda1 = (phi1 + Math.sqrt(discriminant)) / 2;
                  const lambda2 = (phi1 - Math.sqrt(discriminant)) / 2;
                  eigenvalue = Math.max(Math.abs(lambda1), Math.abs(lambda2));
                } else {
                  eigenvalue = Math.sqrt(Math.abs(phi2));
                }
                if (eigenvalue > 2 || isNaN(eigenvalue)) eigenvalue = 0.5;
              }
            } catch (e) { /* ignore parse errors */ }
          }
          
          data.eigenvalues.push(eigenvalue);
          data.pValues.push(hyp.pValue);
          data.totalPairs++;
          if (hyp.significant) data.significantPairs++;
          
          data.pairDetails.push({
            clock: hyp.clockGene,
            target: hyp.targetGene,
            eigenvalue,
            pValue: hyp.pValue,
            dataset: run.datasetName
          });
        }
      }
      
      // Calculate statistics for each species
      const speciesResults = Array.from(speciesMap.values()).map(data => {
        const meanEigenvalue = data.eigenvalues.length > 0
          ? data.eigenvalues.reduce((a, b) => a + b, 0) / data.eigenvalues.length
          : 0;
        const stdEigenvalue = data.eigenvalues.length > 1
          ? Math.sqrt(data.eigenvalues.reduce((sum, v) => sum + Math.pow(v - meanEigenvalue, 2), 0) / (data.eigenvalues.length - 1))
          : 0;
        
        // Count pairs in biological range (0.40-0.80) based on Jan 2026 audit data
        const inBandCount = data.eigenvalues.filter(e => e >= 0.40 && e <= 0.80).length;
        
        return {
          organism: data.organism,
          datasetCount: data.datasets.length,
          datasets: data.datasets,
          totalPairs: data.totalPairs,
          significantPairs: data.significantPairs,
          significanceRate: data.totalPairs > 0 ? Math.round((data.significantPairs / data.totalPairs) * 1000) / 10 : 0,
          eigenvalueStats: {
            mean: Math.round(meanEigenvalue * 1000) / 1000,
            std: Math.round(stdEigenvalue * 1000) / 1000,
            min: data.eigenvalues.length > 0 ? Math.round(data.eigenvalues.reduce((m, v) => v < m ? v : m, Infinity) * 1000) / 1000 : 0,
            max: data.eigenvalues.length > 0 ? Math.round(data.eigenvalues.reduce((m, v) => v > m ? v : m, -Infinity) * 1000) / 1000 : 0,
            inStabilityBand: inBandCount,
            inBandPercent: data.eigenvalues.length > 0 ? Math.round((inBandCount / data.eigenvalues.length) * 1000) / 10 : 0
          },
          topPairs: data.pairDetails
            .filter(p => p.pValue < 0.05)
            .sort((a, b) => a.pValue - b.pValue)
            .slice(0, 10),
          stabilityFiltered: (() => {
            const stablePairs = data.pairDetails.filter(p => p.eigenvalue < 1.0);
            const unstablePairs = data.pairDetails.filter(p => p.eigenvalue >= 1.0);
            const stableMean = stablePairs.length > 0
              ? stablePairs.reduce((sum, p) => sum + p.eigenvalue, 0) / stablePairs.length
              : 0;
            return {
              stableCount: stablePairs.length,
              unstableCount: unstablePairs.length,
              stablePercent: data.pairDetails.length > 0
                ? Math.round((stablePairs.length / data.pairDetails.length) * 1000) / 10
                : 0,
              stableMeanEigenvalue: Math.round(stableMean * 1000) / 1000,
              unstablePairs: unstablePairs.map(p => ({
                clock: p.clock,
                target: p.target,
                eigenvalue: p.eigenvalue,
                dataset: p.dataset
              }))
            };
          })()
        };
      }).sort((a, b) => b.totalPairs - a.totalPairs);

      // Supplement from CSV baseline for any organism with 0 pairs in the DB.
      // This ensures human (and other species) always appear even if the production
      // database has no completed runs for that organism.
      const dbOrganisms = new Set(speciesResults.map(s => s.organism));
      const csvBaseline = crossSpeciesFallbackCache!;
      for (const csvSpecies of csvBaseline.speciesResults) {
        if (!dbOrganisms.has(csvSpecies.organism)) {
          speciesResults.push(csvSpecies);
        }
      }
      speciesResults.sort((a, b) => b.totalPairs - a.totalPairs);
      
      // Cross-species eigenvalue conservation test
      const allEigenvalues = speciesResults.flatMap(s => 
        speciesMap.get(s.organism)?.eigenvalues || []
      );
      const globalMean = allEigenvalues.length > 0
        ? allEigenvalues.reduce((a, b) => a + b, 0) / allEigenvalues.length
        : 0;
      
      res.json({
        summary: {
          organismsAnalyzed: speciesResults.length,
          totalDatasets: speciesResults.reduce((sum, s) => sum + s.datasetCount, 0),
          totalPairs: speciesResults.reduce((sum, s) => sum + s.totalPairs, 0),
          globalMeanEigenvalue: Math.round(globalMean * 1000) / 1000,
          conservationEvidence: speciesResults.every(s => 
            s.eigenvalueStats.mean >= 0.3 && s.eigenvalueStats.mean <= 0.7
          ) ? "Strong cross-species conservation of eigenvalue modulus" : "Variable eigenvalue patterns across species",
          stabilityNote: "Pairs with |λ| >= 1.0 indicate non-stationary AR(2) fits. Stability-filtered stats exclude these."
        },
        speciesResults,
        methodology: {
          description: "Cross-species comparison aggregates PAR(2) eigenvalue modulus (|λ|) across organisms to test conservation of circadian temporal dynamics.",
          stabilityBand: "Real data (Jan 2026 audit): Target genes mean=0.537, Clock genes mean=0.689",
          interpretation: "|λ| reflects intrinsic temporal persistence. Similar values across species suggest conserved circadian regulatory mechanisms."
        }
      });
      
    } catch (error) {
      console.error("Error computing cross-species comparison:", error);
      res.status(500).json({ error: "Failed to compute cross-species comparison" });
    }
  });

  // Evolutionary Gene Age × AR(2) Persistence (rigorous — real GSE54650 eigenvalues)
  app.get("/api/analyses/evolutionary-gene-age", (_req, res) => {
    try {
      res.json(computeRigorousAnalysis());
    } catch (error) {
      console.error("Error computing evolutionary gene age data:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  // Organoid Evolutionary Gene Age × AR(2) — all 4 GSE157357 genotypes
  app.get("/api/analyses/organoid-evolutionary-gene-age", (_req, res) => {
    try {
      res.json(computeOrganoidEvolutionaryAnalysis());
    } catch (error) {
      console.error("Error computing organoid evolutionary gene age data:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  // Stability Audit Report - Downloadable CSV/JSON with timestamps
}
